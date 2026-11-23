import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrackedUrl, cookieDomainIndex, fbcCookie, readCookie } from '../dist/tracking.js';

const destination = 'https://recebaplx.bet/?r=54jwjv';
const now = 1795320000000;

test('forwards all incoming parameters, repeated values and literal special characters', () => {
  const params = new URLSearchParams([
    ['utm_source', 'facebook'], ['utm_campaign', 'Promoção + 50% & ação'],
    ['gclid', 'google'], ['ttclid', 'tiktok'], ['msclkid', 'bing'],
    ['gbraid', 'braid'], ['wbraid', 'web-braid'], ['campaign_id', '123'],
    ['adset_id', '456'], ['ad_id', '789'], ['custom', 'one'], ['custom', 'two'],
    ['empty', ''], ['nested', 'https://example.com/?a=1&b=two'],
  ]);
  const url = buildTrackedUrl(destination, { search: params.toString() });
  for (const key of params.keys()) assert.deepEqual(url.searchParams.getAll(key), params.getAll(key));
  assert.equal(url.searchParams.get('r'), '54jwjv');
});

test('preserves the fixed destination and affiliate code against incoming collisions', () => {
  const url = buildTrackedUrl(destination, { search: '?r=other&r=third&redirect=https://other.example&next=//other.example' });
  assert.equal(url.origin, 'https://recebaplx.bet');
  assert.equal(url.pathname, '/');
  assert.deepEqual(url.searchParams.getAll('r'), ['54jwjv']);
});

test('generates fbc from the current fbclid, preserving its case', () => {
  const url = buildTrackedUrl(destination, { search: '?fbclid=AbC.123%2Bxyz', now });
  assert.equal(url.searchParams.get('fbclid'), 'AbC.123+xyz');
  assert.equal(url.searchParams.get('fbc'), `fb.1.${now}.AbC.123+xyz`);
  assert.equal(url.searchParams.get('_fbc'), url.searchParams.get('fbc'));
  assert.equal(url.searchParams.has('fbp'), false);
});

test('forwards existing Meta cookies, without forwarding unrelated cookies', () => {
  const cookie = 'session=secret; _fbc=fb.1.1700000000000.click; _fbp=fb.1.1700000000000.12345; auth=secret';
  const url = buildTrackedUrl(destination, { cookie });
  assert.equal(url.searchParams.get('fbc'), 'fb.1.1700000000000.click');
  assert.equal(url.searchParams.get('fbp'), 'fb.1.1700000000000.12345');
  assert.equal(url.searchParams.get('_fbp'), url.searchParams.get('fbp'));
  assert.equal(url.searchParams.has('session'), false);
  assert.equal(url.searchParams.has('auth'), false);
});

test('keeps a matching fbc timestamp and replaces an older unrelated click', () => {
  const cookie = '_fbc=fb.1.1700000000000.previous';
  const same = buildTrackedUrl(destination, { search: '?fbclid=previous', cookie, now });
  assert.equal(same.searchParams.get('fbc'), 'fb.1.1700000000000.previous');
  const next = buildTrackedUrl(destination, { search: '?fbclid=next', cookie, now });
  assert.equal(next.searchParams.get('fbc'), `fb.1.${now}.next`);
});

test('prefers explicit URL attribution and accepts underscore aliases', () => {
  const search = '?_fbc=fb.1.1700000000000.current&_fbp=fb.1.1700000000000.999';
  const url = buildTrackedUrl(destination, { search, cookie: '_fbc=fb.1.1600000000000.old; _fbp=fb.1.1600000000000.111' });
  assert.equal(url.searchParams.get('fbc'), 'fb.1.1700000000000.current');
  assert.equal(url.searchParams.get('fbp'), 'fb.1.1700000000000.999');
});

test('new fbclid wins over conflicting fbc query parameters', () => {
  const url = buildTrackedUrl(destination, { search: '?fbclid=new&fbc=fb.1.1700000000000.old&_fbc=fb.1.1700000000000.old', now });
  assert.equal(url.searchParams.get('fbc'), `fb.1.${now}.new`);
  assert.equal(url.searchParams.get('_fbc'), `fb.1.${now}.new`);
});

test('an unformatted fbc that equals fbclid still gets a valid Meta prefix', () => {
  const url = buildTrackedUrl(destination, { search: '?fbclid=current&fbc=current', now });
  assert.equal(url.searchParams.get('fbc'), `fb.1.${now}.current`);
});

test('does not invent identifiers on an untracked visit', () => {
  assert.equal(buildTrackedUrl(destination).href, destination);
  assert.equal(buildTrackedUrl(destination, { search: '?utm_source=organic' }).searchParams.has('fbc'), false);
});

test('retains the server observation when cookies cannot be read', () => {
  const url = buildTrackedUrl(destination, { search: '?fbclid=current', observedFbc: 'fb.1.1700000000000.current', now });
  assert.equal(url.searchParams.get('fbc'), 'fb.1.1700000000000.current');
});

test('handles encoded and malformed cookies without breaking navigation', () => {
  assert.equal(readCookie('_fbc=fb.1.1700000000000.A%2BB%3DC', '_fbc'), 'fb.1.1700000000000.A+B=C');
  assert.equal(readCookie('_fbc=bad%value', '_fbc'), 'bad%value');
  assert.equal(readCookie('not_fbc=other', '_fbc'), '');
  assert.ok(buildTrackedUrl(destination, { search: '?fbclid=ok', cookie: '_fbc=%', now }).href);
});

test('writes a host-only attribution cookie with a 90-day expiration and HTTPS support', () => {
  assert.equal(cookieDomainIndex('pressel.example.com'), 2);
  const cookie = fbcCookie(`fb.2.${now}.A+B`, true);
  assert.ok(cookie.includes('A%2BB'));
  assert.ok(cookie.includes('Max-Age=7776000; SameSite=Lax; Secure'));
  assert.equal(cookie.includes('Domain='), false);
  assert.equal(fbcCookie('value', false).includes('Secure'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTRIBUTION_TTL, attributionCookie, parseAttribution, resolveAttribution } from '../dist/attribution.js';
import { trackDestination, readCookie } from '../dist/tracking.js';

const now = 1795370000000;
const destination = 'https://recebaplx.bet/?r=54jwjv';
const search = '?utm_source=facebook&utm_campaign=campanha1&fbclid=ClickA&ad_id=123&extra=one&extra=two';
const initial = () => trackDestination(destination, { search, now }).record;

test('restores the complete campaign after reloading a clean URL', () => {
  const first = initial();
  const restored = trackDestination(destination, { search: '', stored: [JSON.stringify(first)], now: now + 30000 });
  for (const [key] of new URLSearchParams(search)) {
    assert.deepEqual(restored.url.searchParams.getAll(key), new URLSearchParams(search).getAll(key));
  }
  assert.equal(restored.url.searchParams.get('fbc'), first.fbc);
  assert.equal(restored.record.capturedAt, first.capturedAt);
  assert.equal(restored.url.searchParams.get('r'), '54jwjv');
});

test('a second campaign replaces the first without importing its ad IDs or UTMs', () => {
  const result = trackDestination(destination, { search: '?fbclid=ClickB&utm_source=instagram', stored: [initial()], now: now + 30000 });
  assert.equal(result.url.searchParams.get('fbclid'), 'ClickB');
  assert.equal(result.url.searchParams.get('utm_source'), 'instagram');
  assert.equal(result.url.searchParams.has('utm_campaign'), false);
  assert.equal(result.url.searchParams.has('ad_id'), false);
  assert.equal(result.url.searchParams.has('extra'), false);
  assert.equal(result.url.searchParams.get('fbc'), `fb.1.${now + 30000}.ClickB`);
});

test('a matching click on a shortened link keeps the original campaign fields', () => {
  const result = resolveAttribution('?fbclid=ClickA', [initial()], now + 30000);
  assert.equal(new URLSearchParams(result.search).get('utm_campaign'), 'campanha1');
  assert.equal(result.capturedAt, now);
});

test('per-tab attribution wins on a clean URL and matching incoming ads win across tabs', () => {
  const first = initial();
  const second = resolveAttribution('?fbclid=ClickB&utm_campaign=campanha2', [], now + 1000);
  assert.equal(new URLSearchParams(resolveAttribution('', [first, second], now + 2000).search).get('fbclid'), 'ClickA');
  const matching = resolveAttribution('?fbclid=ClickB', [first, second], now + 2000);
  assert.equal(new URLSearchParams(matching.search).get('utm_campaign'), 'campanha2');
  assert.equal(matching.capturedAt, second.capturedAt);
});

test('custom query values override saved values without losing the rest of the campaign', () => {
  const result = resolveAttribution('?extra=three&empty=', [initial()], now + 30000);
  const params = new URLSearchParams(result.search);
  assert.deepEqual(params.getAll('extra'), ['three']);
  assert.equal(params.get('empty'), '');
  assert.equal(params.get('fbclid'), 'ClickA');
});

test('a changed UTM campaign starts fresh even without a click identifier', () => {
  const result = resolveAttribution('?utm_campaign=campanha2', [initial()], now + 30000);
  assert.equal(new URLSearchParams(result.search).has('fbclid'), false);
  assert.equal(result.fbc, '');
  assert.equal(result.capturedAt, now + 30000);
});

test('browser Meta identifiers remain available when only the attribution record survives', () => {
  const first = trackDestination(destination, { search, cookie: '_fbp=fb.1.1700000000000.123', now });
  const restored = trackDestination(destination, { stored: [first.record], now: now + 30000 });
  assert.equal(restored.url.searchParams.get('fbp'), 'fb.1.1700000000000.123');
  assert.equal(restored.url.searchParams.get('_fbp'), 'fb.1.1700000000000.123');
});

test('invalid, corrupted and expired storage is ignored without breaking the button', () => {
  for (const value of ['broken json', 'null', '{}', { version: 1, search, capturedAt: now + 100000 }, { ...initial(), capturedAt: now - ATTRIBUTION_TTL }]) {
    assert.equal(parseAttribution(value, now), null);
    assert.equal(trackDestination(destination, { stored: [value], now }).url.href, destination);
  }
});

test('tracking cookies round-trip repeated and encoded values without losing data', () => {
  const record = resolveAttribution('?utm_campaign=A%C3%A7%C3%A3o%2B%25&x=1&x=2', [], now);
  const header = attributionCookie(record, true, now);
  assert.deepEqual(parseAttribution(readCookie(header, '_pressel_attribution'), now), record);
  assert.ok(header.includes('Max-Age=7776000; Path=/; SameSite=Lax; Secure'));
  assert.equal(header.includes('Domain='), false);
});

test('oversized campaigns remain complete in storage and clear the obsolete cookie', () => {
  const largeSearch = new URLSearchParams({ fbclid: 'LongClick', custom: 'A+B&'.repeat(1800) }).toString();
  const record = resolveAttribution(largeSearch, [], now);
  assert.equal(record.search, largeSearch);
  assert.ok(attributionCookie(record, true, now).includes('Max-Age=0'));
  assert.equal(trackDestination(destination, { stored: [JSON.stringify(record)], now }).url.searchParams.get('custom'), 'A+B&'.repeat(1800));
});

test('restoring a campaign does not renew its original 90-day attribution window', () => {
  const record = initial();
  assert.ok(attributionCookie(record, false, now + 10000).includes('Max-Age=7775990'));
});

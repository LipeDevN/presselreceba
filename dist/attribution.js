export const ATTRIBUTION_STORAGE_KEY = 'pressel.attribution.v1';
export const ATTRIBUTION_COOKIE = '_pressel_attribution';
export const ATTRIBUTION_TTL = 90 * 24 * 60 * 60 * 1000;

const campaignKeys = new Set([
  'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'ttclid',
  'twclid', 'li_fat_id', 'ScCid', 'sccid', 'yclid', 'epik', 'click_id', 'clickid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term',
  'campaign_id', 'campaignid', 'adset_id', 'adsetid', 'ad_id', 'adid',
]);

export function parseAttribution(value, now = Date.now()) {
  if (!value) return null;
  try {
    const record = typeof value === 'string' ? JSON.parse(value) : value;
    if (record.version !== 1 || typeof record.search !== 'string'
      || !Number.isSafeInteger(record.capturedAt) || record.capturedAt < 0
      || record.capturedAt > now + 60000 || now - record.capturedAt >= ATTRIBUTION_TTL) return null;
    return {
      version: 1,
      search: record.search,
      capturedAt: record.capturedAt,
      fbc: typeof record.fbc === 'string' ? record.fbc : '',
      fbp: typeof record.fbp === 'string' ? record.fbp : '',
    };
  } catch {
    return null;
  }
}

function sameValues(left, right, key) {
  return JSON.stringify(left.getAll(key)) === JSON.stringify(right.getAll(key));
}

/** Current campaign values take precedence; a new campaign never inherits old UTMs. */
export function resolveAttribution(search, stored = [], now = Date.now()) {
  const incoming = new URLSearchParams(search);
  const candidates = stored.map(value => parseAttribution(value, now)).filter(Boolean);
  const identityKeys = [...new Set(incoming.keys())].filter(key => campaignKeys.has(key) && incoming.getAll(key).some(Boolean));
  const matching = candidates.find(record => {
    const previous = new URLSearchParams(record.search);
    return identityKeys.length > 0 && identityKeys.every(key => sameValues(incoming, previous, key));
  });
  let previous = matching || candidates[0];
  if (previous && identityKeys.length > 0 && !matching) previous = null;

  const combined = new URLSearchParams(previous?.search || '');
  for (const key of new Set(incoming.keys())) {
    combined.delete(key);
    for (const value of incoming.getAll(key)) combined.append(key, value);
  }

  return {
    version: 1,
    search: combined.toString(),
    capturedAt: previous?.capturedAt ?? now,
    fbc: previous?.fbc || '',
    fbp: previous?.fbp || '',
  };
}

export function hasAttribution(record) {
  return Boolean(record.search || record.fbc || record.fbp);
}

/** Never truncate long campaigns to fit a cookie: browser storage keeps the full record. */
export function attributionCookie(record, secure, now = Date.now()) {
  const attributes = `; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
  const value = encodeURIComponent(JSON.stringify(record));
  if (!hasAttribution(record) || ATTRIBUTION_COOKIE.length + value.length + attributes.length + 40 > 3800) {
    return `${ATTRIBUTION_COOKIE}=; Max-Age=0${attributes}`;
  }
  const remainingSeconds = Math.max(0, Math.floor((record.capturedAt + ATTRIBUTION_TTL - now) / 1000));
  return `${ATTRIBUTION_COOKIE}=${value}; Max-Age=${remainingSeconds}${attributes}`;
}

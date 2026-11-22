/** Read only the requested attribution cookie, never the whole cookie jar. */
export function readCookie(cookieHeader, name) {
  const entry = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  if (!entry) return '';
  const value = entry.slice(name.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function cookieDomainIndex(hostname) {
  return Math.max(0, hostname.split('.').length - 1);
}

/** Preserve campaign values and repeated parameters without changing the destination. */
export function buildTrackedUrl(destination, {
  search = '',
  cookie = '',
  now = Date.now(),
  subdomainIndex = 1,
  observedFbc = '',
} = {}) {
  const url = new URL(destination);
  const incoming = new URLSearchParams(search);
  const reserved = new Set(url.searchParams.keys());

  for (const [key, value] of incoming) {
    if (!reserved.has(key)) url.searchParams.append(key, value);
  }

  const firstValue = key => incoming.getAll(key).find(value => value !== '') || '';
  const fbclid = firstValue('fbclid');
  const candidates = [firstValue('fbc'), firstValue('_fbc'), readCookie(cookie, '_fbc'), observedFbc].filter(Boolean);
  let fbc = candidates[0] || '';

  if (fbclid) {
    // A new ad click must not inherit another click's identifier or timestamp.
    fbc = candidates.find(value => value.match(/^fb\.\d+\.\d+\.(.+)$/)?.[1] === fbclid)
      || `fb.${subdomainIndex}.${now}.${fbclid}`;
  }

  const fbp = firstValue('fbp') || firstValue('_fbp') || readCookie(cookie, '_fbp');
  for (const [key, value] of [['fbc', fbc], ['_fbc', fbc], ['fbp', fbp], ['_fbp', fbp]]) {
    if (value && !reserved.has(key)) url.searchParams.set(key, value);
  }

  return url;
}

export function fbcCookie(value, secure) {
  return `_fbc=${encodeURIComponent(value)}; Path=/; Max-Age=7776000; SameSite=Lax${secure ? '; Secure' : ''}`;
}

// The server prepares the link first. This refreshes cookies set later by a Pixel,
// and also supports hosts that serve the dist directory as plain static files.
if (typeof document !== 'undefined') {
  for (const link of document.querySelectorAll('[data-track-outbound]')) {
    const destination = link.getAttribute('data-track-base') || link.href;
    const initialSearch = window.location.search;
    const observedAt = Date.now();
    let observedFbc = new URL(link.href).searchParams.get('fbc') || '';

    const refresh = () => {
      let cookie = '';
      try { cookie = document.cookie; } catch { /* Cookies may be disabled. */ }

      const search = window.location.search || initialSearch;
      const url = buildTrackedUrl(destination, {
        search,
        cookie,
        now: observedAt,
        subdomainIndex: cookieDomainIndex(window.location.hostname),
        observedFbc,
      });
      link.href = url.href;
      observedFbc = url.searchParams.get('fbc') || '';

      if (new URLSearchParams(search).get('fbclid') && observedFbc && readCookie(cookie, '_fbc') !== observedFbc) {
        try {
          document.cookie = fbcCookie(observedFbc, window.location.protocol === 'https:');
        } catch { /* Forward the URL even when cookie writes are blocked. */ }
      }
    };

    refresh();
    for (const event of ['pointerdown', 'click', 'auxclick', 'contextmenu', 'focus']) {
      link.addEventListener(event, refresh);
    }
    window.addEventListener('pageshow', refresh);
  }
}

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { buildTrackedUrl, cookieDomainIndex, fbcCookie, readCookie } from './dist/tracking.js';

const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '0.0.0.0';
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ['/tracking.js', ['tracking.js', 'text/javascript; charset=utf-8']],
]);

function escapeAttribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  const route = files.get(requestUrl.pathname);
  if (!route) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Página não encontrada.');
    return;
  }

  try {
    let contents = await readFile(new URL(`./dist/${route[0]}`, import.meta.url));
    if (route[0] === 'index.html') {
      const cookie = request.headers.cookie || '';
      const secure = request.socket.encrypted || request.headers['x-forwarded-proto']?.split(',')[0].trim() === 'https';
      contents = Buffer.from(contents.toString('utf8').replace(
        /(<a\b[^>]*\bdata-track-outbound\b[^>]*\bhref=")([^"]+)(")/,
        (_, prefix, destination, suffix) => {
          const url = buildTrackedUrl(destination.replaceAll('&amp;', '&'), {
            search: requestUrl.search,
            cookie,
            subdomainIndex: cookieDomainIndex(requestUrl.hostname),
          });
          const fbc = url.searchParams.get('fbc');
          if (requestUrl.searchParams.get('fbclid') && fbc && readCookie(cookie, '_fbc') !== fbc) {
            response.setHeader('Set-Cookie', fbcCookie(fbc, secure));
          }
          return `${prefix}${escapeAttribute(url.href)}${suffix} data-track-base="${escapeAttribute(destination.replaceAll('&amp;', '&'))}"`;
        },
      ));
    }
    response.writeHead(200, {
      'Content-Type': route[1],
      'Content-Length': contents.length,
      'Cache-Control': 'no-store',
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Não foi possível carregar a página.');
  }
}).listen(port, host, () => {
  console.log(`Servidor disponível em http://${host}:${port}`);
});

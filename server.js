import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, MAX_BODY_BYTES } from './lib/api.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: http: data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const loopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);

function publicOrigin(value) {
  if (value === undefined) return '';
  try {
    if (typeof value !== 'string' || value !== value.trim()) throw new Error();
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !/^https?:\/\/[^/?#]+\/?$/i.test(value)) throw new Error();
    return url.origin;
  } catch { throw new Error('OPENREEL_PUBLIC_ORIGIN must be an absolute http or https origin without credentials, a path, query or fragment.'); }
}

export function createAppServer(env = process.env) {
  const configuredPublicOrigin = publicOrigin(env.OPENREEL_PUBLIC_ORIGIN);
  return createServer(async (incoming, outgoing) => {
    outgoing.setHeader('x-content-type-options', 'nosniff');
    outgoing.setHeader('referrer-policy', 'no-referrer');
    outgoing.setHeader('content-security-policy', csp);
    try {
      const host = incoming.headers.host || 'localhost';
      if (!/^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d{1,5})?$/i.test(host)) { outgoing.writeHead(400); outgoing.end('Invalid Host header.'); return; }
      const url = new URL(incoming.url || '/', `http://${host}`);
      if (url.origin !== `http://${host.toLowerCase()}` && new URL(`http://${host}`).origin !== url.origin) { outgoing.writeHead(400); outgoing.end('Invalid request target.'); return; }
      if (url.pathname.startsWith('/api/')) {
        let body;
        if (!['GET', 'HEAD'].includes(incoming.method)) {
          let bytes = 0;
          const chunks = [];
          for await (const chunk of incoming) {
            bytes += chunk.length;
            if (bytes > MAX_BODY_BYTES) { outgoing.writeHead(413, { 'content-type': 'application/json' }); outgoing.end(JSON.stringify({ error: 'Request body exceeds 2 MiB.' })); return; }
            chunks.push(chunk);
          }
          body = Buffer.concat(chunks);
        }
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        headers.delete('cf-connecting-ip');
        headers.set('x-openreel-client-ip', incoming.socket.remoteAddress || 'unknown');
        // Public origin is operator configuration; forwarded request headers are never trusted.
        const apiUrl = configuredPublicOrigin ? new URL(url.pathname + url.search, configuredPublicOrigin) : url;
        const request = new Request(apiUrl.href, { method: incoming.method, headers, ...(body ? { body } : {}) });
        const response = await handleApi(request, { ...env, OPENREEL_LOCAL_REQUEST: !configuredPublicOrigin && loopback(incoming.socket.remoteAddress) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) });
        outgoing.writeHead(response.status, Object.fromEntries(response.headers));
        outgoing.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      if (!['GET', 'HEAD'].includes(incoming.method)) { outgoing.writeHead(405, { allow: 'GET, HEAD' }); outgoing.end('Method not allowed.'); return; }
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { outgoing.writeHead(400); outgoing.end('Invalid path.'); return; }
      const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(root + sep)) { outgoing.writeHead(403); outgoing.end('Forbidden.'); return; }
      try {
        const data = await readFile(file);
        outgoing.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
        outgoing.end(incoming.method === 'HEAD' ? undefined : data);
      } catch { outgoing.writeHead(404); outgoing.end('Not found.'); }
    } catch { if (!outgoing.headersSent) outgoing.writeHead(500, { 'content-type': 'application/json' }); outgoing.end(JSON.stringify({ error: 'The request could not be completed.' })); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  createAppServer().listen(port, host, () => console.log(`OpenReel is available at http://${host}:${port}`));
}

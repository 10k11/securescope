import http from 'node:http';
import https from 'node:https';
import { resolvePublic, UnsafeTargetError } from './net.js';

const MAX_BODY = 256 * 1024;

function once(urlStr, { method, timeout }) {
  return new Promise(async (resolve, reject) => {
    const u = new URL(urlStr);
    let addr;
    try { addr = await resolvePublic(u.hostname); } catch (e) { return reject(e); }

    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method,
        hostname: u.hostname.replace(/^\[|\]$/g, ''),
        port: u.port || undefined,
        path: u.pathname + u.search,
        timeout,
        headers: { 'user-agent': 'SecureScope/1.0 (+passive security posture scan)', accept: '*/*' },
        // Pin the socket to the address we already validated (anti DNS rebinding).
        lookup: (_h, _o, cb) => (_o && _o.all ? cb(null, [{ address: addr.address, family: addr.family }]) : cb(null, addr.address, addr.family)),
        rejectUnauthorized: false, // we inspect TLS ourselves and report problems as findings
      },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size <= MAX_BODY) chunks.push(c);
          else req.destroy();
        });
        const done = () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), url: urlStr, address: addr.address });
        res.on('end', done);
        res.on('close', done);
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end();
  });
}

/** SSRF-safe fetch. Redirects are followed manually so every hop is re-validated. */
export async function safeFetch(urlStr, { method = 'GET', maxRedirects = 0, timeout = 8000 } = {}) {
  let current = urlStr;
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await once(current, { method, timeout });
    const loc = res.headers.location;
    if (res.status >= 300 && res.status < 400 && loc && i < maxRedirects) {
      const next = new URL(loc, current);
      if (!['http:', 'https:'].includes(next.protocol)) throw new UnsafeTargetError('Redirect to non-http(s) scheme blocked');
      current = next.toString();
      continue;
    }
    return res;
  }
}

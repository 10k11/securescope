import dns from 'node:dns/promises';
import crypto from 'node:crypto';
import { safeFetch } from '../utils/http.js';

export const newToken = () => crypto.randomBytes(18).toString('hex');

export function instructions(target) {
  const t = target.verifyToken;
  return {
    dns: { host: target.hostname, type: 'TXT', value: `securescope-verify=${t}` },
    file: { path: '/.well-known/securescope.txt', content: t },
    meta: { tag: `<meta name="securescope-verification" content="${t}">` },
  };
}

/** Prove control of the domain before we allow any scanning. Returns the method that worked, or null. */
export async function checkOwnership(target) {
  const t = target.verifyToken;

  try {
    const txt = (await dns.resolveTxt(target.hostname)).map((r) => r.join(''));
    if (txt.includes(`securescope-verify=${t}`)) return 'dns';
  } catch { /* no TXT record */ }

  try {
    const r = await safeFetch(`${target.url}/.well-known/securescope.txt`, { maxRedirects: 2, timeout: 6000 });
    if (r.status === 200 && r.body.trim() === t) return 'file';
  } catch { /* ignore */ }

  try {
    const r = await safeFetch(`${target.url}/`, { maxRedirects: 2, timeout: 6000 });
    const m = /<meta[^>]+name=["']securescope-verification["'][^>]+content=["']([^"']+)["']/i.exec(r.body);
    if (m && m[1] === t) return 'meta';
  } catch { /* ignore */ }

  return null;
}

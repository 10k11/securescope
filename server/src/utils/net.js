import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from '../config/env.js';

/**
 * SSRF defence. Because SecureScope makes outbound requests to user-supplied
 * URLs, we must never let those requests reach internal infrastructure
 * (cloud metadata at 169.254.169.254, localhost services, RFC1918 ranges...).
 */
const blocked = new net.BlockList();
[
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
].forEach(([addr, bits]) => blocked.addSubnet(addr, bits, 'ipv4'));
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6'); // unique local
blocked.addSubnet('fe80::', 10, 'ipv6'); // link local
blocked.addSubnet('ff00::', 8, 'ipv6'); // multicast
blocked.addSubnet('64:ff9b::', 96, 'ipv6'); // NAT64

export function isBlockedIp(ip) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return blocked.check(mapped[1], 'ipv4');
  const family = net.isIP(ip);
  if (!family) return true; // not an IP at all -> refuse
  return blocked.check(ip, family === 6 ? 'ipv6' : 'ipv4');
}

export class UnsafeTargetError extends Error {
  constructor(msg) { super(msg); this.name = 'UnsafeTargetError'; }
}

const SAFE_PORTS = new Set(['', '80', '443', '8080', '8443']);

/** Parse + normalise a user-supplied URL to an http(s) origin, rejecting anything odd. */
export function normalizeTargetUrl(input) {
  let u;
  try { u = new URL(input); } catch { throw new UnsafeTargetError('Invalid URL'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new UnsafeTargetError('Only http(s) URLs are allowed');
  if (u.username || u.password) throw new UnsafeTargetError('Credentials in URL are not allowed');
  if (!env.allowPrivateTargets && !SAFE_PORTS.has(u.port)) throw new UnsafeTargetError('Port not allowed');
  return u.origin;
}

/**
 * Resolve a hostname and make sure EVERY address it maps to is public.
 * Returns one address that callers must pin the connection to, which defeats
 * DNS-rebinding (resolve-then-connect races).
 */
export async function resolvePublic(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  let addrs;
  if (net.isIP(host)) addrs = [{ address: host, family: net.isIP(host) }];
  else {
    try { addrs = await dns.lookup(host, { all: true, verbatim: true }); }
    catch { throw new UnsafeTargetError(`Could not resolve ${hostname}`); }
  }
  if (!addrs.length) throw new UnsafeTargetError(`Could not resolve ${hostname}`);
  if (!env.allowPrivateTargets && addrs.some((a) => isBlockedIp(a.address))) {
    throw new UnsafeTargetError('Target resolves to a private or reserved address');
  }
  return addrs[0];
}

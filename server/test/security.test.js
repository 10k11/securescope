import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { isBlockedIp, normalizeTargetUrl, resolvePublic, UnsafeTargetError } from '../src/utils/net.js';
import { safeFetch } from '../src/utils/http.js';
import { analyzeHeaders, analyzeCookies, analyzeTransport, analyzeExposure } from '../src/services/scanner/analyzers.js';
import { score } from '../src/services/scanner/scoring.js';

test('SSRF: private, loopback, metadata and mapped addresses are blocked', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.5.5', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', 'garbage']) {
    assert.equal(isBlockedIp(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isBlockedIp(ip), false, ip);
});

test('SSRF: URL normalisation rejects dangerous inputs', () => {
  assert.equal(normalizeTargetUrl('https://example.com/a/b?x=1'), 'https://example.com');
  for (const bad of ['file:///etc/passwd', 'ftp://example.com', 'javascript:alert(1)', 'https://user:pw@example.com', 'https://example.com:22', 'not a url']) {
    assert.throws(() => normalizeTargetUrl(bad), UnsafeTargetError, bad);
  }
});

test('SSRF: resolvePublic refuses literal and DNS-resolved internal hosts', async () => {
  await assert.rejects(resolvePublic('127.0.0.1'), UnsafeTargetError);
  await assert.rejects(resolvePublic('169.254.169.254'), UnsafeTargetError);
  await assert.rejects(resolvePublic('localhost'), UnsafeTargetError);
});

test('SSRF: safeFetch never reaches a local server, even via redirect', async () => {
  let hit = false;
  const srv = http.createServer((_q, s) => { hit = true; s.end('secret'); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  await assert.rejects(safeFetch(`http://127.0.0.1:${port}/`), UnsafeTargetError);
  await assert.rejects(safeFetch(`http://localhost:${port}/`), UnsafeTargetError);
  srv.close();
  assert.equal(hit, false);
});

test('headers analyzer flags a bare response and passes a hardened one', () => {
  const bad = analyzeHeaders({ headers: { server: 'nginx/1.18.0', 'x-powered-by': 'Express' }, isHttps: true }).map((f) => f.id);
  for (const id of ['missing-csp', 'missing-hsts', 'missing-nosniff', 'missing-clickjacking', 'missing-referrer-policy', 'info-disclosure']) assert.ok(bad.includes(id), id);

  const good = analyzeHeaders({
    isHttps: true,
    headers: {
      'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
      'strict-transport-security': 'max-age=63072000; includeSubDomains',
      'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=()',
    },
  });
  assert.deepEqual(good, []);
});

test('headers analyzer: wildcard CORS with credentials is high severity', () => {
  const f = analyzeHeaders({ isHttps: false, headers: { 'access-control-allow-origin': '*', 'access-control-allow-credentials': 'true' } });
  assert.equal(f.find((x) => x.id === 'cors-wildcard-creds').severity, 'high');
});

test('cookie analyzer', () => {
  const f = analyzeCookies({ isHttps: true, setCookies: ['session=abc; Path=/', 'pref=1; Secure; HttpOnly; SameSite=Lax'] });
  const ids = f.map((x) => x.id);
  assert.ok(ids.includes('cookie-secure-session') && ids.includes('cookie-httponly-session') && ids.includes('cookie-samesite-session'));
  assert.ok(!ids.some((i) => i.endsWith('-pref')));
  assert.equal(f.find((x) => x.id === 'cookie-httponly-session').severity, 'medium');
});

test('transport analyzer', () => {
  assert.equal(analyzeTransport({ isHttps: false })[0].id, 'no-https');
  const ids = analyzeTransport({ isHttps: true, httpRedirectsToHttps: false, tls: { authorized: true, daysLeft: -2, protocol: 'TLSv1' } }).map((x) => x.id);
  assert.deepEqual(ids.sort(), ['no-http-redirect', 'tls-expired', 'tls-old-protocol'].sort());
});

test('exposure analyzer avoids false positives on SPA catch-all HTML', () => {
  const html = { status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html><html></html>' };
  assert.deepEqual(analyzeExposure('/.env', html), []);
  assert.deepEqual(analyzeExposure('/.git/HEAD', html), []);
  assert.equal(analyzeExposure('/.git/HEAD', { status: 200, headers: {}, body: 'ref: refs/heads/main\n' })[0].severity, 'critical');
  assert.equal(analyzeExposure('/.env', { status: 200, headers: { 'content-type': 'text/plain' }, body: 'DB_PASSWORD=hunter2\n' })[0].id, 'exposed-env');
});

test('scoring', () => {
  assert.deepEqual(score([]), { score: 100, grade: 'A', counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } });
  const r = score([{ severity: 'critical' }, { severity: 'high' }, { severity: 'medium' }]);
  assert.equal(r.score, 52);
  assert.equal(r.grade, 'F');
  assert.equal(score(Array(10).fill({ severity: 'critical' })).score, 0);
});

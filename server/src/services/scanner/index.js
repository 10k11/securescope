import tls from 'node:tls';
import { safeFetch } from '../../utils/http.js';
import { resolvePublic } from '../../utils/net.js';
import { analyzeHeaders, analyzeCookies, analyzeTransport, analyzeExposure, EXPOSURE_PATHS } from './analyzers.js';
import { score, sortFindings } from './scoring.js';

function getTlsInfo(hostname, port) {
  return new Promise(async (resolve) => {
    let addr;
    try { addr = await resolvePublic(hostname); } catch { return resolve(null); }
    const sock = tls.connect(
      { host: addr.address, port: Number(port) || 443, servername: hostname, rejectUnauthorized: false, timeout: 8000 },
      () => {
        const cert = sock.getPeerCertificate();
        const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
        resolve({
          authorized: sock.authorized,
          authError: sock.authorizationError ? String(sock.authorizationError) : '',
          protocol: sock.getProtocol(),
          daysLeft: validTo ? Math.floor((validTo - Date.now()) / 86400000) : null,
        });
        sock.end();
      }
    );
    sock.on('error', () => resolve(null));
    sock.on('timeout', () => { sock.destroy(); resolve(null); });
  });
}

/** Run every passive check against a (verified) target origin. */
export async function runScan(origin) {
  const started = Date.now();
  const u = new URL(origin);
  const isHttps = u.protocol === 'https:';

  const main = await safeFetch(origin + '/', { maxRedirects: 3 });
  const finalIsHttps = new URL(main.url).protocol === 'https:';
  const setCookies = [].concat(main.headers['set-cookie'] || []);

  let httpRedirectsToHttps;
  if (isHttps) {
    try {
      const plain = await safeFetch(`http://${u.hostname}/`, { maxRedirects: 0, timeout: 5000 });
      httpRedirectsToHttps = plain.status >= 300 && plain.status < 400 && /^https:/i.test(plain.headers.location || '');
    } catch { httpRedirectsToHttps = undefined; } // port 80 closed: nothing to downgrade to
  }

  const tlsInfo = finalIsHttps ? await getTlsInfo(new URL(main.url).hostname, new URL(main.url).port) : null;

  const exposureFindings = [];
  for (const path of EXPOSURE_PATHS) {
    try {
      const res = await safeFetch(origin + path, { maxRedirects: 0, timeout: 5000 });
      exposureFindings.push(...analyzeExposure(path, res));
    } catch { /* unreachable path: nothing to report */ }
  }

  const findings = sortFindings([
    ...analyzeTransport({ isHttps: finalIsHttps, httpRedirectsToHttps, tls: tlsInfo }),
    ...analyzeHeaders({ headers: main.headers, isHttps: finalIsHttps }),
    ...analyzeCookies({ setCookies, isHttps: finalIsHttps }),
    ...exposureFindings,
  ]);
  return { findings, ...score(findings), durationMs: Date.now() - started };
}

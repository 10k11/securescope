// Pure analyzers: data in -> findings out. No network, so they are trivially unit-testable.

const f = (id, title, severity, category, description, remediation, evidence = '') => ({
  id, title, severity, category, description, remediation, evidence,
});

export function analyzeHeaders({ headers, isHttps }) {
  const out = [];
  const h = (k) => headers[k];

  const csp = h('content-security-policy');
  if (!csp) {
    out.push(f('missing-csp', 'Content-Security-Policy header missing', 'medium', 'headers',
      'Without a CSP, any XSS bug can load attacker scripts freely.',
      "Add a CSP, e.g. `Content-Security-Policy: default-src 'self'; object-src 'none'; frame-ancestors 'none'`."));
  } else if (/'unsafe-inline'|'unsafe-eval'/.test(csp) && /script-src|default-src/.test(csp)) {
    out.push(f('weak-csp', 'CSP allows unsafe-inline / unsafe-eval', 'low', 'headers',
      'unsafe-inline/unsafe-eval largely negate the XSS protection a CSP provides.',
      'Use nonces or hashes for inline scripts and remove unsafe-eval.', csp.slice(0, 200)));
  }

  if (isHttps) {
    const hsts = h('strict-transport-security');
    if (!hsts) {
      out.push(f('missing-hsts', 'HSTS header missing', 'medium', 'headers',
        'Browsers may be downgraded to HTTP by a network attacker (SSL stripping).',
        'Send `Strict-Transport-Security: max-age=31536000; includeSubDomains`.'));
    } else {
      const age = Number(/max-age=(\d+)/i.exec(hsts)?.[1] ?? 0);
      if (age < 15552000) {
        out.push(f('short-hsts', 'HSTS max-age is short', 'low', 'headers',
          'HSTS lifetime under 180 days gives weak downgrade protection.',
          'Raise max-age to at least 31536000 (1 year).', hsts));
      }
    }
  }

  if ((h('x-content-type-options') || '').toLowerCase() !== 'nosniff') {
    out.push(f('missing-nosniff', 'X-Content-Type-Options missing', 'low', 'headers',
      'Browsers may MIME-sniff responses and execute content as a different type.',
      'Send `X-Content-Type-Options: nosniff`.'));
  }

  const hasFrameAncestors = /frame-ancestors/i.test(csp || '');
  if (!h('x-frame-options') && !hasFrameAncestors) {
    out.push(f('missing-clickjacking', 'No clickjacking protection', 'medium', 'headers',
      'The page can be embedded in a hostile iframe and used for UI redress attacks.',
      "Send `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`."));
  }

  if (!h('referrer-policy')) {
    out.push(f('missing-referrer-policy', 'Referrer-Policy missing', 'low', 'headers',
      'Full URLs (possibly with tokens) can leak to third parties via the Referer header.',
      'Send `Referrer-Policy: strict-origin-when-cross-origin`.'));
  }

  if (!h('permissions-policy')) {
    out.push(f('missing-permissions-policy', 'Permissions-Policy missing', 'info', 'headers',
      'Powerful browser features (camera, geolocation...) are not explicitly restricted.',
      'Send `Permissions-Policy: camera=(), microphone=(), geolocation=()`.'));
  }

  const disclosure = [h('server'), h('x-powered-by')].filter(Boolean).join(' | ');
  if (h('x-powered-by') || /\d+\.\d+/.test(h('server') || '')) {
    out.push(f('info-disclosure', 'Server technology / version disclosed', 'low', 'disclosure',
      'Version banners help attackers pick matching exploits.',
      'Remove X-Powered-By and strip version numbers from the Server header.', disclosure));
  }

  const acao = h('access-control-allow-origin');
  if (acao === '*' && String(h('access-control-allow-credentials')).toLowerCase() === 'true') {
    out.push(f('cors-wildcard-creds', 'CORS: wildcard origin with credentials', 'high', 'cors',
      'Any origin is allowed to make credentialed requests, enabling cross-site data theft.',
      'Reflect only an allow-list of trusted origins; never combine * with credentials.', 'ACAO: *, ACAC: true'));
  } else if (acao === '*') {
    out.push(f('cors-wildcard', 'CORS allows any origin', 'low', 'cors',
      'Any website can read responses from this endpoint.',
      'Restrict Access-Control-Allow-Origin to trusted origins if the data is not public.'));
  }
  return out;
}

export function analyzeCookies({ setCookies = [], isHttps }) {
  const out = [];
  for (const raw of setCookies) {
    const parts = raw.split(';').map((s) => s.trim());
    const name = parts[0].split('=')[0];
    const attrs = parts.slice(1).map((p) => p.toLowerCase());
    const has = (a) => attrs.some((x) => x === a || x.startsWith(`${a}=`));
    const sensitive = /sess|token|auth|jwt|sid|login/i.test(name);

    if (isHttps && !has('secure')) {
      out.push(f(`cookie-secure-${name}`, `Cookie "${name}" missing Secure flag`, sensitive ? 'medium' : 'low', 'cookies',
        'The cookie can be sent over plain HTTP and sniffed.', 'Add the `Secure` attribute.', raw.split('=')[0]));
    }
    if (!has('httponly')) {
      out.push(f(`cookie-httponly-${name}`, `Cookie "${name}" missing HttpOnly flag`, sensitive ? 'medium' : 'low', 'cookies',
        'JavaScript (and therefore XSS) can read this cookie.', 'Add the `HttpOnly` attribute.', name));
    }
    const ss = attrs.find((a) => a.startsWith('samesite='));
    if (!ss) {
      out.push(f(`cookie-samesite-${name}`, `Cookie "${name}" missing SameSite`, 'low', 'cookies',
        'Without SameSite the cookie is sent on cross-site requests, aiding CSRF.', 'Add `SameSite=Lax` (or Strict).', name));
    } else if (ss === 'samesite=none' && !has('secure')) {
      out.push(f(`cookie-none-${name}`, `Cookie "${name}" SameSite=None without Secure`, 'medium', 'cookies',
        'Browsers reject or mishandle this combination.', 'Add `Secure` or use SameSite=Lax.', name));
    }
  }
  return out;
}

export function analyzeTransport({ isHttps, httpRedirectsToHttps, tls }) {
  const out = [];
  if (!isHttps) {
    out.push(f('no-https', 'Site is served over HTTP only', 'high', 'transport',
      'All traffic, including credentials and cookies, is readable and modifiable on the network.',
      'Obtain a TLS certificate (e.g. Let\'s Encrypt) and serve the site over HTTPS.'));
    return out;
  }
  if (httpRedirectsToHttps === false) {
    out.push(f('no-http-redirect', 'HTTP does not redirect to HTTPS', 'medium', 'transport',
      'Users typing the bare domain land on an unencrypted page.',
      'Return a 301 redirect from http:// to https:// for all paths.'));
  }
  if (tls) {
    if (!tls.authorized) {
      out.push(f('tls-invalid', 'TLS certificate is not trusted', 'critical', 'transport',
        'Browsers will warn users and connections can be intercepted.',
        'Install a valid certificate issued by a trusted CA with the full chain.', tls.authError || ''));
    }
    if (tls.daysLeft != null) {
      if (tls.daysLeft < 0) {
        out.push(f('tls-expired', 'TLS certificate expired', 'critical', 'transport',
          'The certificate is past its expiry date.', 'Renew the certificate immediately.', `Expired ${-tls.daysLeft} day(s) ago`));
      } else if (tls.daysLeft < 14) {
        out.push(f('tls-expiring', 'TLS certificate expires soon', 'high', 'transport',
          'An expired certificate will take the site down for users.', 'Renew now and automate renewal.', `${tls.daysLeft} day(s) left`));
      } else if (tls.daysLeft < 30) {
        out.push(f('tls-expiring-soon', 'TLS certificate expires within 30 days', 'low', 'transport',
          'Renewal should be happening automatically by now.', 'Verify auto-renewal works.', `${tls.daysLeft} day(s) left`));
      }
    }
    if (tls.protocol && ['TLSv1', 'TLSv1.1', 'SSLv3'].includes(tls.protocol)) {
      out.push(f('tls-old-protocol', 'Deprecated TLS protocol negotiated', 'high', 'transport',
        `${tls.protocol} has known weaknesses and is deprecated.`, 'Disable TLS < 1.2 on the server.', tls.protocol));
    }
  }
  return out;
}

const EXPOSURES = {
  '/.git/HEAD': {
    check: (r) => r.status === 200 && /^ref:\s/.test(r.body.trim()),
    finding: (r) => f('exposed-git', 'Git repository exposed (/.git/HEAD)', 'critical', 'exposure',
      'The .git directory is downloadable, allowing full source code and secret recovery.',
      'Block access to dotfiles at the web server and redeploy without the .git directory.', r.body.trim().slice(0, 60)),
  },
  '/.env': {
    check: (r) => r.status === 200 && !/html/i.test(r.headers['content-type'] || '') && /^[A-Z][A-Z0-9_]*\s*=/m.test(r.body),
    finding: () => f('exposed-env', 'Environment file exposed (/.env)', 'critical', 'exposure',
      'A .env file is publicly readable and likely contains credentials and API keys.',
      'Remove the file from the web root, block dotfiles, and ROTATE every secret it contained.', 'Contents intentionally not stored'),
  },
};

export const EXPOSURE_PATHS = [...Object.keys(EXPOSURES), '/.well-known/security.txt'];

export function analyzeExposure(path, res) {
  if (!res) return [];
  if (path === '/.well-known/security.txt') {
    return res.status === 200 && /contact:/i.test(res.body) ? [] : [
      f('missing-security-txt', 'No security.txt published', 'info', 'exposure',
        'Researchers have no standard way to report vulnerabilities to you.',
        'Publish /.well-known/security.txt (RFC 9116) with a Contact field.')];
  }
  const rule = EXPOSURES[path];
  return rule && rule.check(res) ? [rule.finding(res)] : [];
}

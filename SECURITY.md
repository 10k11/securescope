# Security model

SecureScope makes outbound HTTP requests to user-supplied URLs, so it is itself a high-risk SSRF/abuse surface. Design decisions:

| Threat | Mitigation | Where |
|---|---|---|
| SSRF to internal services / cloud metadata | Every resolved IP checked against private, loopback, link-local, CGNAT, multicast, NAT64 and IPv4-mapped ranges | `server/src/utils/net.js` |
| DNS rebinding (TOCTOU) | Validated IP is *pinned* into the socket `lookup`; no second resolution | `server/src/utils/http.js` |
| Redirect-based SSRF | Redirects followed manually, each hop re-validated; non-http(s) schemes refused | `http.js` |
| Scanning third parties | Targets must be verified (DNS TXT / well-known file / meta tag) before any scan | `services/verify.js` |
| Abuse / DoS | Per-user scan rate limit, 256 KB body cap, timeouts, one running scan per target, 25 target cap, port allow-list | middleware, routes |
| NoSQL injection | Zod schemas enforce primitive types on all input (`{"$ne":null}` rejected) | `middleware/validate` |
| IDOR | Every query is scoped by `owner` | `routes/*` |
| Credential stuffing | Rate limit, account lockout (5 fails → 15 min), constant-time dummy hash for unknown users | `routes/auth.js` |
| Token theft | Short-lived access token kept in memory; refresh token is httpOnly + SameSite=Strict, rotated, hashed at rest, **reuse detection revokes all sessions** | `routes/auth.js`, `client/src/api.js` |
| Browser attacks | `helmet`, strict CORS origin, 10 KB JSON limit | `app.js` |

The scanner is **passive**: ordinary GET requests (home page, `/.git/HEAD`, `/.env`, `/.well-known/security.txt`) and a TLS handshake. No payloads, fuzzing or exploitation.

`ALLOW_PRIVATE_TARGETS` exists only for local demos and is force-disabled when `NODE_ENV=production`.

Found a vulnerability? Please open a private security advisory on GitHub.

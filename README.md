# 🛡️ SecureScope

**Continuous, passive web-security posture monitoring — built with the MERN stack, and hardened like the thing it audits.**

Small teams and indie devs ship sites with missing security headers, insecure cookies, expiring TLS certificates, or even an exposed `.git` / `.env` — and only find out after an incident. Enterprise scanners are heavy and expensive; one-off online checkers don't track anything over time.

SecureScope lets you add your sites, **prove you own them**, and get a scored (A–F) report with concrete fixes, a history trend, and scheduled re-scans so regressions get caught.

## Features

- **Ownership verification** (DNS TXT, `/.well-known` file, or `<meta>` tag) — no scanning of sites you don't control
- **Passive checks**: security headers (CSP, HSTS, clickjacking, nosniff, referrer/permissions policy, CORS misconfig), cookie flags (Secure/HttpOnly/SameSite), TLS (validity, expiry, deprecated protocols), HTTP→HTTPS redirect, info disclosure, exposed `.git`/`.env`, `security.txt`
- **Scoring & grades** with severity-ranked findings, evidence and remediation steps
- **History & trend chart**, per-target auto-scan scheduler (6h / daily / weekly)
- **Per-user audit log** (logins, failed logins, token-reuse alerts, scans)

## Security engineering (the point of the project)

Auth is JWT access token (memory-only) + rotating httpOnly refresh cookie with **reuse detection**, bcrypt(12), lockout and rate limiting. The scanner defends against **SSRF and DNS rebinding** by validating and pinning resolved IPs and re-validating every redirect hop. Full table in [SECURITY.md](SECURITY.md) — and the SSRF tests prove a local server is never reached.

## Stack

React 18 + Vite · Node/Express 4 · MongoDB/Mongoose · Zod · Helmet · node:test

```
client/   React SPA (login, targets dashboard, scan detail, audit log)
server/   Express API, scanner engine (services/scanner), SSRF-safe HTTP client (utils)
demo-vulnerable-site/   deliberately insecure local site to demo findings
```

## Run it

```bash
npm run install:all
docker compose up -d                       # MongoDB (or point MONGO_URI at Atlas)
cp server/.env.example server/.env         # fill in the two JWT secrets
npm run dev:server                         # :5000
npm run dev:client                         # :5173
```

### Try it on the bundled vulnerable site

```bash
npm run demo                               # http://localhost:8080 (intentionally insecure)
# set ALLOW_PRIVATE_TARGETS=true in server/.env (dev only), restart the API
# add http://localhost:8080, then serve the shown token: VERIFY_TOKEN=<token> npm run demo
```
You'll get an **F** with 2 critical findings (exposed `.git` and `.env`).

## Tests

```bash
npm test      # SSRF guards, analyzers, scoring
```

## API

| Method | Route | |
|---|---|---|
| POST | `/api/auth/register` `login` `refresh` `logout` | auth |
| GET/POST | `/api/targets` | list / add |
| GET/PATCH/DELETE | `/api/targets/:id` | detail / auto-scan interval / delete |
| POST | `/api/targets/:id/verify` | prove ownership |
| POST | `/api/targets/:id/scan` | start scan (202) |
| GET | `/api/targets/:id/scans`, `/api/scans/:id` | history / full report |
| GET | `/api/stats`, `/api/audit` | dashboard / audit log |

## Responsible use

Only scan assets you own or are authorised to test. The scanner is passive by design and enforces ownership verification.

## License

MIT

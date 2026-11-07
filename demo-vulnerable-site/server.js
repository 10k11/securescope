// Intentionally insecure site for demoing SecureScope locally. NEVER deploy this.
// Run:  node server.js            (serves on http://localhost:8080)
// Then start the API with ALLOW_PRIVATE_TARGETS=true and add http://localhost:8080 as a target.
import http from 'node:http';

const TOKEN_FILE = process.env.VERIFY_TOKEN; // optional: set to pass file-based ownership verification

http
  .createServer((req, res) => {
    if (TOKEN_FILE && req.url === '/.well-known/securescope.txt') return res.end(TOKEN_FILE);
    if (req.url === '/.git/HEAD') return res.end('ref: refs/heads/main\n');
    if (req.url === '/.env') {
      res.setHeader('content-type', 'text/plain');
      return res.end('DB_PASSWORD=hunter2\nJWT_SECRET=changeme\n');
    }
    res.setHeader('server', 'nginx/1.14.0');
    res.setHeader('x-powered-by', 'Express 3.0');
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('set-cookie', ['session=abc123; Path=/']);
    res.setHeader('content-type', 'text/html');
    res.end('<h1>Totally secure bank</h1>');
  })
  .listen(8080, () => console.log('Vulnerable demo on http://localhost:8080'));

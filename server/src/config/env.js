const prod = process.env.NODE_ENV === 'production';

function secret(name) {
  const v = process.env[name];
  if (v && v.length >= 32) return v;
  if (prod) throw new Error(`${name} must be set (>= 32 chars) in production`);
  return `dev-only-insecure-${name}-do-not-use-in-production`;
}

export const env = {
  prod,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/securescope',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  accessSecret: secret('JWT_ACCESS_SECRET'),
  refreshSecret: secret('JWT_REFRESH_SECRET'),
  accessTtl: '15m',
  refreshTtlMs: 7 * 24 * 60 * 60 * 1000,
  // Dev/demo only: lets the scanner reach localhost/private IPs (e.g. the bundled demo site).
  allowPrivateTargets: process.env.ALLOW_PRIVATE_TARGETS === 'true' && !prod,
  schedulerEnabled: process.env.SCHEDULER !== 'off',
};

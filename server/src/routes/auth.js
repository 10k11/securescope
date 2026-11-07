import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { HttpError, validate, requireAuth, authLimiter, audit } from '../middleware/index.js';

const r = Router();
r.use(authLimiter);

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
// Compared against when the user doesn't exist so response time doesn't reveal valid emails.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const cookieOpts = {
  httpOnly: true, secure: env.prod, sameSite: 'strict', path: '/api/auth', maxAge: env.refreshTtlMs,
};

const signAccess = (id) => jwt.sign({}, env.accessSecret, { subject: String(id), expiresIn: env.accessTtl, algorithm: 'HS256' });
const signRefresh = (id) =>
  jwt.sign({ jti: crypto.randomUUID() }, env.refreshSecret, { subject: String(id), expiresIn: Math.floor(env.refreshTtlMs / 1000), algorithm: 'HS256' });

async function issue(res, user) {
  const refresh = signRefresh(user._id);
  await User.updateOne({ _id: user._id }, { $push: { refreshHashes: { $each: [sha(refresh)], $slice: -5 } } });
  res.cookie('refresh_token', refresh, cookieOpts);
  return signAccess(user._id);
}

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email });

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10, 'Use at least 10 characters').max(128)
    .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), 'Needs upper, lower case and a digit'),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });

r.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (await User.exists({ email })) throw new HttpError(409, 'Email already registered');
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
    req.userId = user._id;
    audit(req, 'auth.register');
    res.status(201).json({ user: publicUser(user), accessToken: await issue(res, user) });
  } catch (e) { next(e); }
});

r.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash');
    if (user?.lockUntil && user.lockUntil > new Date()) throw new HttpError(423, 'Account temporarily locked. Try again later.');
    const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
    if (!user || !ok) {
      if (user) {
        const fails = user.failedLogins + 1;
        await User.updateOne({ _id: user._id }, fails >= MAX_FAILS
          ? { failedLogins: 0, lockUntil: new Date(Date.now() + LOCK_MS) }
          : { failedLogins: fails });
        req.userId = user._id;
        audit(req, 'auth.login_failed', { attempts: fails });
      }
      throw new HttpError(401, 'Invalid email or password');
    }
    await User.updateOne({ _id: user._id }, { failedLogins: 0, lockUntil: null });
    req.userId = user._id;
    audit(req, 'auth.login');
    res.json({ user: publicUser(user), accessToken: await issue(res, user) });
  } catch (e) { next(e); }
});

/** Refresh-token rotation with reuse detection: a replayed (already-rotated) token revokes every session. */
r.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) throw new HttpError(401, 'No session');
    let payload;
    try { payload = jwt.verify(token, env.refreshSecret, { algorithms: ['HS256'] }); }
    catch { throw new HttpError(401, 'Invalid session'); }
    const user = await User.findById(payload.sub).select('+refreshHashes');
    if (!user) throw new HttpError(401, 'Invalid session');
    const h = sha(token);
    if (!user.refreshHashes.includes(h)) {
      await User.updateOne({ _id: user._id }, { refreshHashes: [] });
      req.userId = user._id;
      audit(req, 'auth.refresh_reuse_detected');
      res.clearCookie('refresh_token', { ...cookieOpts, maxAge: undefined });
      throw new HttpError(401, 'Session revoked');
    }
    await User.updateOne({ _id: user._id }, { $pull: { refreshHashes: h } });
    res.json({ user: publicUser(user), accessToken: await issue(res, user) });
  } catch (e) { next(e); }
});

r.post('/logout', async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (token) {
    try {
      const p = jwt.verify(token, env.refreshSecret);
      await User.updateOne({ _id: p.sub }, { $pull: { refreshHashes: sha(token) } });
    } catch { /* already invalid */ }
  }
  res.clearCookie('refresh_token', { ...cookieOpts, maxAge: undefined });
  res.json({ ok: true });
});

r.get('/me', requireAuth, async (req, res, next) => {
  try {
    const u = await User.findById(req.userId);
    if (!u) throw new HttpError(401, 'User not found');
    res.json({ user: publicUser(u) });
  } catch (e) { next(e); }
});

export default r;

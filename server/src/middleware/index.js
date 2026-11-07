import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { UnsafeTargetError } from '../utils/net.js';
import { Audit } from '../models/index.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function requireAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    const p = jwt.verify(token, env.accessSecret, { algorithms: ['HS256'] });
    req.userId = p.sub;
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

/** Zod validation. Parsed (and therefore type-coerced / stripped) data replaces req.body, which also blocks NoSQL operator injection. */
export const validate = (schema) => (req, _res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return next(r.error);
  req.body = r.data;
  next();
};

export const validId = (param = 'id') => (req, _res, next) =>
  mongoose.isValidObjectId(req.params[param]) ? next() : next(new HttpError(400, 'Invalid id'));

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Rate limit exceeded' },
});
export const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { error: 'Scan limit reached (30/hour)' },
});

export const audit = (req, action, meta) =>
  Audit.create({ user: req.userId, action, ip: req.ip, meta }).catch(() => {});

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
  }
  if (err instanceof UnsafeTargetError) return res.status(400).json({ error: err.message });
  if (err.code === 11000) return res.status(409).json({ error: 'Already exists' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
}

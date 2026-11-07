import { Router } from 'express';
import { z } from 'zod';
import { Target, Scan } from '../models/index.js';
import { HttpError, requireAuth, validate, validId, scanLimiter, audit } from '../middleware/index.js';
import { normalizeTargetUrl, resolvePublic } from '../utils/net.js';
import { newToken, instructions, checkOwnership } from '../services/verify.js';
import { startScan } from '../services/scanRunner.js';

const r = Router();
r.use(requireAuth);

const view = (t) => ({ ...t.toObject(), verifyToken: undefined, verification: t.verified ? undefined : instructions(t) });

const addSchema = z.object({ url: z.string().trim().min(3).max(300).transform((s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`)) });
const patchSchema = z.object({ scanIntervalHours: z.number().int().min(0).max(720) });

r.get('/', async (req, res, next) => {
  try {
    const targets = await Target.find({ owner: req.userId }).sort({ createdAt: -1 });
    res.json({ targets: targets.map(view) });
  } catch (e) { next(e); }
});

r.post('/', validate(addSchema), async (req, res, next) => {
  try {
    if ((await Target.countDocuments({ owner: req.userId })) >= 25) throw new HttpError(400, 'Target limit (25) reached');
    const url = normalizeTargetUrl(req.body.url);
    await resolvePublic(new URL(url).hostname); // reject internal addresses up front
    const t = await Target.create({ owner: req.userId, url, hostname: new URL(url).hostname, verifyToken: newToken() });
    audit(req, 'target.add', { url });
    res.status(201).json({ target: view(t) });
  } catch (e) { next(e); }
});

r.get('/:id', validId(), async (req, res, next) => {
  try {
    const t = await Target.findOne({ _id: req.params.id, owner: req.userId });
    if (!t) throw new HttpError(404, 'Target not found');
    res.json({ target: view(t) });
  } catch (e) { next(e); }
});

r.patch('/:id', validId(), validate(patchSchema), async (req, res, next) => {
  try {
    const t = await Target.findOneAndUpdate({ _id: req.params.id, owner: req.userId }, { scanIntervalHours: req.body.scanIntervalHours }, { new: true });
    if (!t) throw new HttpError(404, 'Target not found');
    res.json({ target: view(t) });
  } catch (e) { next(e); }
});

r.delete('/:id', validId(), async (req, res, next) => {
  try {
    const t = await Target.findOneAndDelete({ _id: req.params.id, owner: req.userId });
    if (!t) throw new HttpError(404, 'Target not found');
    await Scan.deleteMany({ target: t._id });
    audit(req, 'target.delete', { url: t.url });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post('/:id/verify', validId(), scanLimiter, async (req, res, next) => {
  try {
    const t = await Target.findOne({ _id: req.params.id, owner: req.userId });
    if (!t) throw new HttpError(404, 'Target not found');
    if (t.verified) return res.json({ target: view(t) });
    const method = await checkOwnership(t);
    if (!method) throw new HttpError(422, 'Verification token not found. Check the DNS record, file or meta tag and retry (DNS can take a while).');
    t.set({ verified: true, verifiedAt: new Date(), verifiedMethod: method });
    await t.save();
    audit(req, 'target.verified', { url: t.url, method });
    res.json({ target: view(t) });
  } catch (e) { next(e); }
});

r.post('/:id/scan', validId(), scanLimiter, async (req, res, next) => {
  try {
    const t = await Target.findOne({ _id: req.params.id, owner: req.userId });
    if (!t) throw new HttpError(404, 'Target not found');
    if (!t.verified) throw new HttpError(403, 'Verify ownership of this target before scanning');
    if (await Scan.exists({ target: t._id, status: 'running' })) throw new HttpError(409, 'A scan is already running');
    const scan = await startScan(t);
    audit(req, 'scan.start', { url: t.url });
    res.status(202).json({ scan });
  } catch (e) { next(e); }
});

r.get('/:id/scans', validId(), async (req, res, next) => {
  try {
    if (!(await Target.exists({ _id: req.params.id, owner: req.userId }))) throw new HttpError(404, 'Target not found');
    const scans = await Scan.find({ target: req.params.id, owner: req.userId }).select('-findings').sort({ createdAt: -1 }).limit(50);
    res.json({ scans });
  } catch (e) { next(e); }
});

export default r;

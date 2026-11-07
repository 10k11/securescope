import { Router } from 'express';
import { Scan, Target, Audit } from '../models/index.js';
import { HttpError, requireAuth, validId } from '../middleware/index.js';
import mongoose from 'mongoose';

const r = Router();
r.use(requireAuth);

r.get('/scans/:id', validId(), async (req, res, next) => {
  try {
    const scan = await Scan.findOne({ _id: req.params.id, owner: req.userId });
    if (!scan) throw new HttpError(404, 'Scan not found');
    res.json({ scan });
  } catch (e) { next(e); }
});

r.get('/stats', async (req, res, next) => {
  try {
    const owner = new mongoose.Types.ObjectId(req.userId);
    const [targets, latest] = await Promise.all([
      Target.find({ owner }),
      Scan.aggregate([
        { $match: { owner, status: 'completed' } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$target', counts: { $first: '$counts' } } },
      ]),
    ]);
    const severity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const s of latest) for (const k of Object.keys(severity)) severity[k] += s.counts?.[k] || 0;
    const scored = targets.filter((t) => t.lastScore != null);
    res.json({
      targets: targets.length,
      verified: targets.filter((t) => t.verified).length,
      averageScore: scored.length ? Math.round(scored.reduce((a, t) => a + t.lastScore, 0) / scored.length) : null,
      openFindings: severity,
    });
  } catch (e) { next(e); }
});

r.get('/audit', async (req, res, next) => {
  try {
    const logs = await Audit.find({ user: req.userId }).sort({ createdAt: -1 }).limit(100);
    res.json({ logs });
  } catch (e) { next(e); }
});

export default r;

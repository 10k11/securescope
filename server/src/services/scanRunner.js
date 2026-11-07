import { Scan, Target } from '../models/index.js';
import { runScan } from './scanner/index.js';

/** Creates a Scan doc and runs the scan in the background. Returns the (running) scan immediately. */
export async function startScan(target, trigger = 'manual') {
  const scan = await Scan.create({ target: target._id, owner: target.owner, trigger, status: 'running' });
  (async () => {
    try {
      const result = await runScan(target.url);
      scan.set({ status: 'completed', score: result.score, grade: result.grade, counts: result.counts, findings: result.findings, durationMs: result.durationMs });
      await Target.updateOne({ _id: target._id }, { lastScore: result.score, lastGrade: result.grade, lastScanAt: new Date() });
    } catch (e) {
      scan.set({ status: 'failed', error: String(e.message || e).slice(0, 300) });
    }
    await scan.save();
  })();
  return scan;
}

/** Simple in-process scheduler: re-scan verified targets whose interval has elapsed. */
export function startScheduler(everyMs = 5 * 60 * 1000) {
  const tick = async () => {
    try {
      const targets = await Target.find({ verified: true, scanIntervalHours: { $gt: 0 } });
      for (const t of targets) {
        const due = !t.lastScanAt || Date.now() - t.lastScanAt.getTime() >= t.scanIntervalHours * 3600_000;
        if (!due) continue;
        if (await Scan.exists({ target: t._id, status: 'running' })) continue;
        await startScan(t, 'scheduled');
      }
    } catch (e) { console.error('scheduler error', e.message); }
  };
  const timer = setInterval(tick, everyMs);
  timer.unref();
  return timer;
}

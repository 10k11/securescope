const PENALTY = { critical: 25, high: 15, medium: 8, low: 3, info: 0 };

export function score(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  let s = 100;
  for (const x of findings) {
    counts[x.severity] += 1;
    s -= PENALTY[x.severity] ?? 0;
  }
  s = Math.max(0, s);
  const grade = s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 55 ? 'D' : 'F';
  return { score: s, grade, counts };
}

const ORDER = ['critical', 'high', 'medium', 'low', 'info'];
export const sortFindings = (fs) => [...fs].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));

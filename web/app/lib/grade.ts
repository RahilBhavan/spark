/**
 * Channel grade (A–F) from local/capacity ratio.
 * A = ratio within 5% of 0.5, B = 10%, C = 20%, D = 35%, F = worse.
 */
export function gradeFromRatio(ratio: number): string {
  const dev = Math.abs(ratio - 0.5);
  if (dev <= 0.05) return "A";
  if (dev <= 0.1) return "B";
  if (dev <= 0.2) return "C";
  if (dev <= 0.35) return "D";
  return "F";
}

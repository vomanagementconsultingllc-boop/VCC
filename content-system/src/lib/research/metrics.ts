/**
 * "Proven" is numeric. A video is an outlier when its views are at least 3x
 * the creator's median views over their last 20 posts. Raw view count alone
 * is not a signal: 200k views is ordinary for a big account and remarkable
 * for a small one.
 */
export const OUTLIER_RATIO = 3;
export const MEDIAN_WINDOW = 20;

export function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Median views of a creator's most recent posts (newest first), capped at the last 20. */
export function creatorMedian(recentViews: number[]): number | null {
  return median(recentViews.slice(0, MEDIAN_WINDOW));
}

export function performanceRatio(views: number, medianViews: number | null): number | null {
  if (!medianViews || medianViews <= 0) return null;
  return Math.round((views / medianViews) * 100) / 100;
}

export function isOutlier(ratio: number | null | undefined): boolean {
  return ratio != null && ratio >= OUTLIER_RATIO;
}

// Returns a monotonically increasing integer that advances every 7 days.
// Deterministic: same value for all callers within the same 7-day window.
// Epoch-days ÷ 7 — simpler than ISO week; avoids year-boundary edge cases.
// Used as an implicit cache-key input for HeroModule (D-07) and WhereCollectionsGo (D-13).
export function getWeekIndex(now: Date): number {
  return Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))
}

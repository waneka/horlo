/**
 * Relative time formatter per Phase 10 UI-SPEC § Copywriting Contract.
 *
 *   < 60s        → 'now'
 *   < 60m        → '{N}m'
 *   < 24h        → '{N}h'
 *   < 7d         → '{N}d'
 *   < 4w (28d)   → '{N}w'
 *   >= 4w        → locale 'MMM d' (e.g. 'Apr 21')
 *
 * Deterministic — accepts an optional `now` parameter so unit tests can pin
 * the reference instant. Negative deltas (input in the future, e.g. clock
 * skew across client/server) clamp to 'now'.
 *
 * @param input   ISO 8601 string or Date — the event time
 * @param now     Reference "now" — defaults to new Date()
 */
export function timeAgo(input: string | Date, now: Date = new Date()): string {
  const then = typeof input === 'string' ? new Date(input) : input
  const deltaMs = Math.max(0, now.getTime() - then.getTime())
  const s = Math.floor(deltaMs / 1000)
  if (s < 60) return 'now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  const w = Math.floor(d / 7)
  if (w < 4) return `${w}w`
  return then.toLocaleString('en-US', { month: 'short', day: 'numeric' })
}

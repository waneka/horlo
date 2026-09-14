import { DISPOSAL_REASON_LABELS } from '@/lib/constants'
import type { DisposalReason } from '@/lib/types'

/**
 * Phase 85 D-16 — reason·date badge copy for a previously-owned collection
 * card ("Sold · Mar 2026", or "Sold" alone when no disposal date is set).
 *
 * Returns null when there is no reason to show (the watch isn't disposed).
 * Date formatting is pinned to a fixed UTC clock + `'en-US'` — the same
 * React #418 guard used elsewhere in this codebase (`project_react_418_date_tz_hydration`)
 * — so server and client render identical month/year text regardless of the
 * viewer's local timezone, and a date like '2026-01-01' never off-by-one's
 * into "Dec 2025" from a locale-naive `new Date(date)` parse.
 */
export function formatDisposalBadge(
  reason: DisposalReason | undefined,
  date: string | undefined,
): string | null {
  if (!reason) return null

  const label = DISPOSAL_REASON_LABELS[reason]

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const formatted = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`))
    return `${label} · ${formatted}`
  }

  return label
}

export function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Format the current date as `YYYY-MM-DD` in the caller's local timezone.
 *
 * Phase 15 WR-02: previously the WYWT preflight (client) and the
 * `logWearWithPhoto` / `markAsWorn` Server Actions both computed `today` via
 * `new Date().toISOString().split('T')[0]`, which is UTC. For users in
 * non-UTC timezones near the day boundary this caused two visible defects:
 *   1. Duplicate-day false positives — logging the same watch at 11pm PT
 *      day D (UTC=D+1) and again at 9am PT day D+1 (UTC=D+1) collided on
 *      the UNIQUE(user_id, watch_id, worn_date) constraint with a
 *      "Already logged this watch today" error.
 *   2. Preflight mismatch — the picker disabled a watch as "Worn today" on
 *      the morning of D+1 because the previous evening's wear was tagged
 *      D+1 UTC.
 *
 * Resolution: client AND server both call this helper so the canonical
 * "wear day" is the user's local calendar day. Single-user MVP (no
 * multi-tenant clock skew concern); when an authenticated session is added
 * later the user's profile timezone can be threaded through if needed.
 *
 * Returns a string matching `^\d{4}-\d{2}-\d{2}$` — kept compatible with
 * the zod schema in `src/app/actions/wearEvents.ts` (`preflightSchema`).
 */
export function todayLocalISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export const SLEEPING_BEAUTY_DAYS = 30

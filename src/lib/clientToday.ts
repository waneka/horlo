/**
 * Shared client-supplied "today" validators.
 *
 * Used by `logBackfillWear` (Phase 84, `src/app/actions/wearEvents.ts`) and the
 * Phase 85 disposal actions (`markWatchPreviouslyOwned` / `editWatch` in
 * `src/app/actions/watches.ts`). Neither helper reads the user's calendar
 * day — the client owns "today" (260622-exo invariant; see the header comment
 * on `todayLocalISO` in `src/lib/wear.ts`). Server Actions run on the Vercel
 * runtime where the process zone is UTC, which diverges from the user's local
 * day near a midnight boundary — computing "today" server-side already caused
 * a shipped incident (260622-exo) this module exists to prevent from recurring.
 *
 * Extracted out of `wearEvents.ts` (a `'use server'` file, which may only
 * export async functions) into this plain module so both action files can
 * import the same pure helpers.
 */

import { z } from 'zod'

/**
 * ISO calendar-date schema shared by every client-supplied date field
 * (`wornDate`, `today`, `disposalDate`, ...). The regex alone accepts shapes
 * like `2026-02-30` that are not real calendar days; the `.refine` re-parses
 * as a UTC date and checks the round-tripped ISO string matches the input
 * exactly. This validates calendar validity ONLY — it never reads the current
 * clock, so it cannot be (mis)used to derive "today" server-side.
 */
export const isoCalendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
  }, 'Invalid calendar date')

/**
 * 84-REVIEW WR-01 — timezone-tolerant sanity bound on a client-supplied
 * `today`. This does NOT derive the user's calendar day (260622-exo still
 * holds: the client owns "today"); it only rejects values no real timezone
 * could produce right now. Every real zone lies within UTC-12..UTC+14, so a
 * genuine local date is always between the UTC date of (now - 14h) and the
 * UTC date of (now + 14h) — i.e. never more than one calendar day off the
 * server's UTC date. A crafted `today` far in the future (pinning a wear to
 * the top of the WYWT rail, or forging an early disposal date) or far in the
 * past (posting an old backfill as new feed activity via the D-06
 * `wornDate === today` gate) is rejected.
 */
export const TODAY_TOLERANCE_MS = 14 * 60 * 60 * 1000

export function isPlausibleClientToday(today: string, nowMs: number = Date.now()): boolean {
  const minPlausible = new Date(nowMs - TODAY_TOLERANCE_MS).toISOString().slice(0, 10)
  const maxPlausible = new Date(nowMs + TODAY_TOLERANCE_MS).toISOString().slice(0, 10)
  return today >= minPlausible && today <= maxPlausible
}

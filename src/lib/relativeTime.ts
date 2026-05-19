// Phase 47 — shared freshness helpers for curated lists (D-01).
//
// WR-06: getRelativeTimestamp and isNew were copy-pasted verbatim into
// src/app/explore/lists/[id]/page.tsx and src/components/explore/RailListCard.tsx.
// They are extracted here so there is a single definition.
//
// NOTE on the editorial copy contract: this is intentionally DISTINCT from
// src/lib/timeAgo.ts. timeAgo() produces terse social-feed copy ('3d', 'Apr 21');
// these helpers produce the curated-list voice via Intl.RelativeTimeFormat
// ('Today', '3 days ago', 'last week'). The two formats must not be merged —
// they serve different surfaces (D-01 freshness indicator vs. activity feed).
//
// Cache caveat (WR-06): both helpers accept an explicit `now` reference. When
// called inside a 'use cache' scope (RailListCard renders inside
// CuratedListsRail's cache), the default `new Date()` is frozen at
// cache-population time, so the "New" badge / relative timestamp are accurate
// only to the cacheLife('hours') granularity. That hours-level drift is
// accepted for v1; a future precise-to-the-minute badge would compute `isNew`
// on the client. The `now` parameter exists so unit tests can pin the instant.

// D-01: "New" badge recency window — 7 days (Claude's Discretion, UI-SPEC).
const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const DAY_MS = 86400000

/**
 * Relative timestamp via Intl.RelativeTimeFormat — "Today", "3 days ago",
 * "last week", "2 months ago". Returns an empty string when publishedAt is null.
 *
 * @param publishedAt the list's publish instant, or null
 * @param now         reference "now" — defaults to new Date()
 */
export function getRelativeTimestamp(
  publishedAt: Date | null,
  now: Date = new Date(),
): string {
  if (!publishedAt) return ''
  const diffMs = now.getTime() - publishedAt.getTime()
  const diffDays = Math.floor(diffMs / DAY_MS)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (diffDays < 1) return 'Today'
  if (diffDays < 7) return rtf.format(-diffDays, 'day')
  if (diffDays < 30) return rtf.format(-Math.floor(diffDays / 7), 'week')
  return rtf.format(-Math.floor(diffDays / 30), 'month')
}

/**
 * True when publishedAt is within the D-01 "New" badge window (7 days).
 *
 * @param publishedAt the list's publish instant, or null
 * @param now         reference "now" — defaults to new Date()
 */
export function isNew(publishedAt: Date | null, now: Date = new Date()): boolean {
  if (!publishedAt) return false
  return now.getTime() - publishedAt.getTime() < NEW_WINDOW_MS
}

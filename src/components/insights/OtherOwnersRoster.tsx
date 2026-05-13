import Link from 'next/link'

import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import type { CatalogCollector } from '@/data/discovery'

/**
 * Phase 39b NSV-18 — OtherOwnersRoster (DISC-AUDIT-70 / DISC-AUDIT-72).
 *
 * Server Component (no 'use client') — pure presentation over CatalogCollector
 * rows resolved by getCollectorsForCatalog at the page boundary. Renders a
 * compact horizontal avatar+@username chip row on /catalog/{id} only
 * (D-39b-04: catalog-only; /watch/{id} does NOT get this roster — UI-SPEC
 * §Render Order line 288).
 *
 * Contracts:
 * - D-39b-07 / D-39b-09 hide-if-empty: returns null when collectors.length === 0
 *   so the section is entirely absent from the DOM (no empty-state card).
 * - Count label is rendered for any totalCount >= 1 with singular
 *   ("1 collector owns this") / plural ("{N} collectors own this") copy.
 *   Quick task 260513-m31 SUPERSEDES the shipped D-39b-09 "≤5 → suppress
 *   label" rule per Phase 39b UAT test 7 product feedback — the count label
 *   is useful at any non-zero count, so the prior `totalCount > 5 &&` gate
 *   was reversed.
 * - D-39b-11 layout: vertical compact chip (`w-16 shrink-0 flex-col`) per
 *   collector, absolute-inset <Link> as the click surface (matches the
 *   PopularCollectorRow pattern). No FollowButton (browse-only, not
 *   action-eligible — CONTEXT).
 * - A11y: focus-visible:ring-2 on the absolute-inset link (UI-SPEC
 *   §Pointer/hover); aria-label uses displayName fallback to @username.
 *
 * Pitfall 1 / A4 deviation: UI-SPEC §NSV-18 specifies avatar size=36, but the
 * AvatarDisplay primitive (`src/components/profile/AvatarDisplay.tsx:10`)
 * only accepts a literal union of 40/64/96. Substitute the smallest legal
 * value per RESEARCH A4 RECOMMEND; documented in SUMMARY. The 64px chip
 * width still accommodates the 40px avatar with breathing room.
 *
 * XSS: React text-node auto-escape on `{c.username}` + `{c.displayName}`;
 * aria-label constructed via template literal (also auto-escaped). Username
 * is regex-validated at signup. No dangerouslySetInnerHTML.
 */
interface OtherOwnersRosterProps {
  collectors: CatalogCollector[]
  totalCount: number
}

export function OtherOwnersRoster({
  collectors,
  totalCount,
}: OtherOwnersRosterProps) {
  if (collectors.length === 0) return null // D-39b-07 / D-39b-09 hide-if-empty

  return (
    <section className="space-y-2">
      {/* Quick task 260513-m31 — supersedes D-39b-09 "≤5 → suppress" rule;
          count label renders for any totalCount >= 1 with singular/plural copy. */}
      <p className="text-sm text-muted-foreground">
        {totalCount === 1
          ? '1 collector owns this'
          : `${totalCount} collectors own this`}
      </p>
      <div className="flex gap-2 overflow-x-auto scroll-smooth pb-1">
        {collectors.map((c) => {
          const name = c.displayName ?? `@${c.username}`
          return (
            <div
              key={c.userId}
              className="group relative flex flex-col items-center gap-2 w-16 shrink-0"
            >
              <Link
                href={`/u/${c.username}/collection`}
                aria-label={`${name}'s collection`}
                className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {/* UI-SPEC requests size=36; AvatarDisplay primitive only supports 40/64/96 — substitute 40 per RESEARCH A4 */}
              <AvatarDisplay
                avatarUrl={c.avatarUrl}
                displayName={c.displayName}
                username={c.username}
                size={40}
              />
              <p className="text-xs text-muted-foreground truncate w-full text-center">
                @{c.username}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

import Link from 'next/link'

import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import type { FollowedOwner } from '@/data/follows'

/**
 * Phase 65 FOLL-01..04 — FollowedOwnersModule.
 *
 * Pure-presentation Server Component (RSC) — no client directive, no hooks,
 * no event handlers, no `'use cache'`. Renders the "From your circle" chip
 * stack in the right column of `WatchDetailHero` (D-10 placement, between
 * the LikeButton+jump row and the Last-Worn line). Pre-resolved data
 * arrives as props — Plan 03 wires the call site in `src/app/w/[ref]/page.tsx`
 * and threads `followedOwners`/`followedOwnersTotal` through
 * `WatchDetailHeroProps`. This component depends only on the FollowedOwner
 * TYPE from `@/data/follows` (D-11 — `import type`); the server-only DAL
 * function `getFollowedOwnersForCatalog` is NEVER imported here, preserving
 * the Phase 51/52/61 PPR boundary on `/w/[ref]` once Plan 03 wires the
 * client-island hero into this RSC sibling.
 *
 * Contracts:
 *  - FOLL-01 hide-if-empty: returns `null` when `owners.length === 0` so the
 *    entire module is absent from the DOM (no header, no skeleton, no
 *    placeholder). The same return-null path covers the Branch 1
 *    null-catalogId case once Plan 03 short-circuits to
 *    `{ owners: [], totalCount: 0 }` at the page-level call site.
 *  - D-04 layout: vertical chip stack (semantic `<ul>` with one `<li>` per
 *    owner) — NOT the horizontal-scroll layout of `OtherOwnersRoster`. The
 *    hero right column is the narrow `2fr` track; a vertical stack fits
 *    naturally and collapses single-column on mobile without responsive
 *    variants.
 *  - D-04a / Copywriting Contract: visible header is the warmer literal
 *    "From your circle" (Rdio-inspired identity framing). The wrapping
 *    `<section>` also carries the literal SR `aria-label="People you follow
 *    who own this"` (two-layer copy: visible warmer / SR literal).
 *  - D-04c: plain-text overflow caption `"and {totalCount - owners.length}
 *    more"` rendered ONLY when `totalCount > owners.length` (strict `>`).
 *    NO see-all link, NO inline expand — out of scope for Phase 65.
 *  - D-04b / FOLL-03 + D-02a: at most 5 chips (the DAL's default
 *    `limit: 5` — the component itself does NOT slice, it trusts the prop);
 *    each chip is a single tap target via an absolute-inset `<Link>` to
 *    `/u/${username}/collection` with
 *    `aria-label="${displayName ?? '@'+username}'s collection"`,
 *    `AvatarDisplay size={40}` (the smallest legal value in the
 *    `40 | 64 | 96` literal union per `AvatarDisplay.tsx:10` — matches
 *    `OtherOwnersRoster`), and `min-h-[44px]` on the `<li>` for a mobile-
 *    friendly tap target.
 *  - PAGE-03 preserve: this file MUST stay pure RSC. No `'use client'`. No
 *    `'use cache'`. The static guard at
 *    `tests/static/followed-owners-module-rsc.test.ts` (Task 3) enforces
 *    this — a future "add hover state" refactor that adds `'use client'`
 *    will fail CI.
 *
 * XSS: React text-node auto-escape on `{o.username}` and `{o.displayName}`;
 * template-literal interpolations in `href` and `aria-label` are also
 * auto-escaped. Username is regex-validated at signup. No
 * `dangerouslySetInnerHTML`. Same hardened contract as
 * `OtherOwnersRoster.tsx:36-39`.
 */
interface FollowedOwnersModuleProps {
  owners: FollowedOwner[]
  totalCount: number
}

export function FollowedOwnersModule({
  owners,
  totalCount,
}: FollowedOwnersModuleProps) {
  if (owners.length === 0) return null // FOLL-01 hide-if-empty

  return (
    <section
      className="space-y-2"
      aria-label="People you follow who own this"
    >
      <h3 className="text-sm font-medium text-foreground">From your circle</h3>
      <ul className="space-y-2">
        {owners.map((owner) => {
          const name = owner.displayName ?? `@${owner.username}`
          return (
            <li
              key={owner.userId}
              className="group relative flex items-center gap-3 min-h-[44px]"
            >
              <Link
                href={`/u/${owner.username}/collection`}
                aria-label={`${name}'s collection`}
                className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <AvatarDisplay
                avatarUrl={owner.avatarUrl}
                displayName={owner.displayName}
                username={owner.username}
                size={40}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  @{owner.username}
                </p>
                {owner.displayName && (
                  <p className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                    {owner.displayName}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {totalCount > owners.length && (
        <p className="text-xs text-muted-foreground">
          and {totalCount - owners.length} more
        </p>
      )}
    </section>
  )
}

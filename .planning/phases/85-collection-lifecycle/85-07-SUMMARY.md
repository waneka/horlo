---
phase: 85-collection-lifecycle
plan: 07
subsystem: ui
tags: [react, nextjs, drizzle, wear-detail, d-14, visibility]

# Dependency graph
requires:
  - phase: 85-04
    provides: "repo-wide 'sold' literal sweep closed; npm run build green baseline"
provides:
  - "watchLinkable prop threaded WearCard -> WearVideoClient/WearPhotoClient/WearDetailHero -> WearPhotoOverlays (Link vs plain text)"
  - "getWearEventByIdForViewer watchStatus projection"
  - "/wear/[wearEventId] server-computed watchLinkable (owner always true; visitor false iff watch is previously_owned)"
affects: [85-08, 85-09, 85-10, 85-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional boolean prop defaulting true, threaded through a chain of presentational components, to swap a Link for equivalent-styled plain text at the leaf without touching any other consumer's default behavior"

key-files:
  created:
    - tests/components/wear/WearPhotoOverlays.linkable.test.tsx
  modified:
    - src/components/wear/WearDetailHero.tsx
    - src/components/wear/WearPhotoClient.tsx
    - src/components/wear/WearVideoClient.tsx
    - src/components/wear/WearCard.tsx
    - src/data/wearEvents.ts
    - src/app/wear/[wearEventId]/page.tsx

key-decisions:
  - "watchLinkable computed once in WearDetailPage (wear.userId === viewerId || wear.watchStatus !== 'previously_owned') and threaded through WearPhotoStreamed into WearCard — no duplicate logic in the client components, which only render Link-vs-div based on the prop they receive"
  - "No WHERE-clause or visibility change in getWearEventByIdForViewer — only an additive SELECT projection (watchStatus). D-17 (wear itself stays visible under existing rules) is satisfied by construction: nothing about visibility was touched"
  - "WearsLane (/wears/[username]) intentionally NOT touched — accepted per the plan's threat model (T-85-18) as not a D-14-named surface, with a 48h rail window making the case rare and the destination still 404ing server-side"

patterns-established: []

requirements-completed: [LIFE-05]

# Metrics
duration: ~30min
completed: 2026-09-14
---

# Phase 85 Plan 07: Wear detail no-dead-link (D-14) Summary

**Optional `watchLinkable` prop threaded from `/wear/[wearEventId]`'s server-computed owner/status check down through `WearCard` → `WearPhotoClient`/`WearVideoClient`/`WearDetailHero` → `WearPhotoOverlays`, swapping the brand/model `<Link href="/w/[id]">` for identically-styled plain text whenever a visitor would otherwise land on a 404.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 (Task 1 tdd, Task 2 auto)
- **Files modified:** 7 (5 source components, 1 DAL file, 1 page; 1 new test file)

## Accomplishments

- `WearPhotoOverlays` (in `WearDetailHero.tsx`) gained an optional `watchLinkable?: boolean` prop (default `true`). The bottom overlay renders the existing `<Link href="/w/${watchId}">` when `true`, or a `<div className={cn('text-sm', textClass)}>` with the same two spans (`font-semibold` brand + block model) and no `onClick`/`stopPropagation` when `false` — visually identical text, no navigable link.
- `WearDetailHero` itself, `WearPhotoClient`, `WearVideoClient`, and `WearCard` each gained the same optional `watchLinkable?: boolean` (default `true`) and pass it through to every `WearPhotoOverlays` render site (2 in `WearDetailHero`, 3 in `WearPhotoClient`, 2 in `WearVideoClient`, and threaded into all 3 photo-layer branches of `WearCard`). Every existing call site that omits the prop is byte-identical in behavior (defaults to `true`) — no regression to any other `WearCard` consumer (stories lane, etc.).
- `getWearEventByIdForViewer` (`src/data/wearEvents.ts`) gained an additive `watchStatus: watches.status` projection alongside the existing `brand`/`model` columns — no change to the function's WHERE clause or three-tier visibility gate (D-17: the wear itself still surfaces under the exact same rules as before).
- `WearDetailPage` (`src/app/wear/[wearEventId]/page.tsx`) computes `watchLinkable = wear.userId === viewerId || wear.watchStatus !== 'previously_owned'` immediately after the `notFound()` guard, threads it through the streamed `WearPhotoStreamed` server child's props, and passes it into `<WearCard>`. A visitor viewing a wear of a watch its owner has since disposed of now sees plain, unlinked brand/model text; the owner (and any wear of a still-owned/wishlisted/grail watch) keeps the link exactly as before.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing test for wear overlay watchLinkable (D-14)** - `82269722` (test)
2. **Task 1 GREEN: thread watchLinkable prop through wear photo/video layers** - `6ccf363b` (feat)
3. **Task 2: compute watchLinkable on /wear/[id] from watch status (D-14)** - `bf351bd6` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `tests/components/wear/WearPhotoOverlays.linkable.test.tsx` - new: Link-vs-plain-text contract at the `WearPhotoOverlays`/`WearDetailHero` level
- `src/components/wear/WearDetailHero.tsx` - `watchLinkable` prop on both `WearPhotoOverlaysProps` and `WearDetailHero`'s own props; Link↔div swap in the bottom overlay
- `src/components/wear/WearPhotoClient.tsx` - `watchLinkable` pass-through to all 3 `WearPhotoOverlays` render sites (happy-path, and both failed-state fallback branches)
- `src/components/wear/WearVideoClient.tsx` - `watchLinkable` pass-through to both `WearPhotoOverlays` render sites (error-fallback and playing branches)
- `src/components/wear/WearCard.tsx` - `watchLinkable` prop on `WearCardProps`, passed to `WearVideoClient`, `WearPhotoClient`, and `WearDetailHero`
- `src/data/wearEvents.ts` - `watchStatus: watches.status` added to `getWearEventByIdForViewer`'s SELECT projection
- `src/app/wear/[wearEventId]/page.tsx` - `watchLinkable` computed in `WearDetailPage`, threaded through `WearPhotoStreamed`'s props into `<WearCard>`

## Decisions Made

See `key-decisions` in frontmatter. No deviation from the plan's discretion choices — the plan fully specified the prop shape, default, and computation; nothing was left to Claude's discretion in this plan.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The RED test (`tests/components/wear/WearPhotoOverlays.linkable.test.tsx`) failed exactly as expected on first run (2 of 4 assertions failed — the `watchLinkable={false}` cases — while the 2 default-`true` cases already passed against the unmodified component, confirming the test correctly targets only the new behavior).

## User Setup Required

None - no external service configuration required.

## Verification

- `npx vitest run tests/components/wear/WearPhotoOverlays.linkable.test.tsx tests/components/wear/WearCard.test.tsx tests/components/wear/WearCard.video.test.tsx tests/components/wear/WearVideoClient.test.tsx` - 12/12 pass.
- `npx vitest run tests/unit/dalMediaColumns.test.ts tests/integration/phase15-wear-detail-gating.test.ts tests/components/wear/` - 28 passed | 14 skipped (0 failed) — `phase15-wear-detail-gating.test.ts` is a pre-existing env-gated skip, unrelated to this plan.
- `npm run build` - exit code 0 (captured directly), all 36 routes generated.
- Acceptance-criteria greps: `watchLinkable` count in `WearDetailHero.tsx` = 8 (≥4 required), `WearPhotoClient.tsx` = 6 (≥2), `WearVideoClient.tsx` = 5 (≥2), `WearCard.tsx` = 5 (≥2); `watchStatus: watches.status` in `wearEvents.ts` = 1 (exactly 1 required); `wear.watchStatus !== 'previously_owned'` present in `page.tsx`; `watchLinkable` count in `page.tsx` = 6 (≥4 required).
- **Local-first verification against real local Supabase (CLAUDE.md gate):** inserted a temporary `wear_events` fixture row on the existing local `previously_owned` watch (`vintage_anna`, `a915158f-…`), ran `getWearEventByIdForViewer` directly via `tsx --env-file=.env.development.local` for both the owner (`vintage_anna`) and a different real profile (`twwaneka`) as viewer. Confirmed the DAL returns `watchStatus: 'previously_owned'` in both cases (visibility gate unaffected) and that the page's `watchLinkable` formula evaluates to `true` for the owner and `false` for the visitor — the exact D-14 contract this plan implements. Fixture row deleted afterward; no fixture data left in local DB.

## Next Phase Readiness

- D-14's no-dead-link rule is now closed on the one surface RESEARCH identified as needing it: `/wear/[id]`. The Worn tab's own rows already link to `/wear/[id]` (not `/w/[id]`), and its leaderboard is owned-only, so neither needed a change.
- WearsLane (`/wears/[username]`) intentionally keeps its default (linkable) behavior — accepted risk per the plan's threat model (T-85-18), not a gap in this plan's scope.
- 85-08 (disposal dialog + muted card + badge), 85-09 (celebration), 85-10 (edit-form disposal fields), and 85-11 (final UAT walk) can proceed independently — this plan touches none of their files.

---
*Phase: 85-collection-lifecycle*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: tests/components/wear/WearPhotoOverlays.linkable.test.tsx
- FOUND: src/components/wear/WearDetailHero.tsx
- FOUND: src/components/wear/WearPhotoClient.tsx
- FOUND: src/components/wear/WearVideoClient.tsx
- FOUND: src/components/wear/WearCard.tsx
- FOUND: src/data/wearEvents.ts
- FOUND: src/app/wear/[wearEventId]/page.tsx
- FOUND: .planning/phases/85-collection-lifecycle/85-07-SUMMARY.md
- FOUND commit: 82269722 (Task 1 RED)
- FOUND commit: 6ccf363b (Task 1 GREEN)
- FOUND commit: bf351bd6 (Task 2)

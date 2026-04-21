---
phase: 10-activity-feed
plan: 03
subsystem: wywt-rail-data-primitives
tags: [drizzle, postgres, privacy, zod, server-actions, tdd, vitest, worn-public]

# Dependency graph
requires:
  - plan: 10-01
    provides: |
      Shared feed types (@/lib/feedTypes — unused here) + cacheComponents
      on (unused here). Phase 8 DAL conventions (server-only, two-layer
      privacy) + Phase 9 wornPublic settings are the actual upstream.
provides:
  - "getWearRailForViewer(viewerId) DAL — single-JOIN wearEvents x profiles x profileSettings x watches query, 48h rolling window, dedupe-per-actor, worn_public gate"
  - "addToWishlistFromWearEvent(data) Server Action — Zod-strict, privacy-gated snapshot of wear-event metadata into a new wishlist watch row + fire-and-forget activity log"
  - "src/lib/wywtTypes.ts — WywtTile + WywtRailData published as the stable UI contract for Plan 06"
affects: [10-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dedupe-per-actor via Map<userId, row> after ORDER BY (wornDate DESC, createdAt DESC) — keeps the 'first row per userId is most recent' invariant"
    - "Two-layer privacy for cross-user reads carried into WYWT: RLS (owner-only on wear_events) + DAL WHERE-clause `or(self, wornPublic=true)`"
    - "ISO-date string comparison against wornDate (TEXT 'YYYY-MM-DD') — `gte(wornDate, cutoff)` is lexicographically correct for the 48h window"
    - "Unit-tests-plus-integration-tests co-located under tests/data — unit asserts SQL shape via a chainable Drizzle mock; integration (gated on NEXT_PUBLIC_SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY) asserts real-DB semantics"
    - "Server Action privacy gate returns the same 'Wear event not found' on both missing and private-but-exists to avoid existence leaks (T-10-03-03)"

key-files:
  created:
    - src/lib/wywtTypes.ts
    - src/app/actions/wishlist.ts
    - tests/data/getWearRailForViewer.test.ts
    - tests/actions/wishlist.test.ts
  modified:
    - src/data/wearEvents.ts

key-decisions:
  - "Dropped the planner's `as never` cast on createWatch. Providing all required domain fields (brand, model, status, movement, complications, styleTags, designTraits, roleTags) plus optional imageUrl satisfies Omit<Watch, 'id'> without any cast. Narrowed row.movement to MovementType since watches.movement is a Drizzle enum column whose inferred type is broader than the domain union but runtime-equivalent."
  - "Kept the Zod schema `.strict()` surface minimal (`{ wearEventId }`) and snapshot the watch metadata server-side from the JOIN result. This keeps mass-assignment impossible even if a client tried to inject brand/model/imageUrl; the server never trusts client-side metadata."
  - "Same 'Wear event not found' string on (a) absent row and (b) actor!=viewer && !wornPublic — avoids existence leak. T-10-03-03 in the threat register."
  - "Duplicate wishlist rows are tolerated by design — no dedupe, no confirm dialog. Matches CONTEXT.md <specifics>: 'one tap with no confirmation friction'. If the product wants dedupe later, it belongs to the per-user-independent-entries rewrite, not this action."
  - "Self wear events bypass worn_public on both the DAL and the Server Action — the viewer can always wishlist-from their own wear event even if they've set worn_public=false (harmless but consistent)."
  - "Integration tests co-located with unit tests under a describe.skipIf(!hasLocalDb) block. Mirrors the precedent in tests/data/getFeedForUser.test.ts and tests/data/isolation.test.ts — CI without Supabase stays green; local dev can flip env vars for the full privacy suite."

patterns-established:
  - "WYWT rail DAL contract: server returns all eligible tiles ordered by wornDate DESC; the UI is responsible for pinning the viewer's self-tile first (documented in WywtRailData comments)."
  - "Action-layer privacy composition: when an action resolves a cross-user entity (like a wear event), do the privacy JOIN in the same query that resolves the entity. Don't make two round-trips."

requirements-completed: [WYWT-03]

# Metrics
duration: ~5 min
completed: 2026-04-21
---

# Phase 10 Plan 03: WYWT Data Primitives Summary

**Shipped the WYWT rail's data-access backbone and the "Add to wishlist from wear event" Server Action — two-layer-privacy single-JOIN DAL returning deduped most-recent-per-actor tiles within a 48h rolling window, plus a Zod-strict action that snapshots watch metadata into a new wishlist row without mass-assignment risk. 17 tests green (8 unit + 9 integration-gated on the DAL side; 9 action tests fully unit).**

## Performance

- **Duration:** ~5 min 13 s
- **Started:** 2026-04-21T23:34:45Z
- **Completed:** 2026-04-21T23:39:58Z
- **Tasks:** 2 (both TDD: RED test, then GREEN implementation)
- **Files created/modified:** 5 (2 new source modules, 1 DAL extension, 2 test files)
- **Commits:** 4 task commits + pending metadata commit

## Accomplishments

- **`getWearRailForViewer(viewerId)` DAL** extension at `src/data/wearEvents.ts`: preserves all 6 prior exports (`logWearEvent`, `getMostRecentWearDate`, `getWearEventsByWatch`, `getMostRecentWearDates`, `getAllWearEventsByUser`, `getPublicWearEventsForViewer`) and adds one new export. The query:
  - Resolves the viewer's `followingIds` in a short `select().from(follows).where(followerId=viewer)` call.
  - Issues one big `wearEvents innerJoin profiles innerJoin profileSettings innerJoin watches` query with the composite WHERE: `inArray(userId, [viewer, ...followingIds]) AND gte(wornDate, cutoff48h) AND or(eq(userId, viewer), eq(wornPublic, true))`.
  - Orders by `desc(wornDate), desc(createdAt)` — so the first row per userId is the most-recent.
  - Dedupes client-side via `Map<userId, row>` to produce one tile per actor.
  - Maps rows to `WywtTile` with `isSelf = userId === viewerId`.

- **`addToWishlistFromWearEvent(data)` Server Action** at `src/app/actions/wishlist.ts`: Zod `.strict({ wearEventId: uuid() })` input, `getCurrentUser()` auth gate, JOIN resolution of the wear event + its watch metadata + the actor's worn_public in one query. Privacy gate returns generic 'Wear event not found' on both missing and private-but-exists (T-10-03-03). On accept, calls `createWatch(user.id, { ..., status: 'wishlist', ... })` with brand/model/imageUrl/movement snapshotted from the source; fire-and-forget `logActivity('wishlist_added')`; `revalidatePath('/')`.

- **`WywtTile` / `WywtRailData` interfaces** at `src/lib/wywtTypes.ts` — the stable UI contract that Plan 06 consumes. Type-only; zero runtime cost. Documents the self-tile ordering rule (UI responsibility, not server).

- **Tests:**
  - `tests/data/getWearRailForViewer.test.ts`: **8 unit tests** asserting SQL shape (2 selects, 3 innerJoins, 1 where, orderBy with 2 args, dedupe invariant, isSelf flag, tile field mapping) + **9 integration tests** gated on local Supabase covering empty rail, self-include, 3-wears-1-tile dedupe, worn_public omission, self-bypasses-worn_public, non-follow exclusion, 50h-outside-window, ordering, and same-day multi-tile scenario.
  - `tests/actions/wishlist.test.ts`: **9 unit tests** fully mocked — unauth, missing payload, non-UUID, extra-key rejection (strict), not-found + privacy gate (double case), happy path (createWatch + logActivity + revalidatePath), duplicate tolerance, fire-and-forget resilience, self-wear bypass.

## Task Commits

1. **Task 1 RED — failing WYWT DAL tests + types** — `37be2f8` (test)
2. **Task 1 GREEN — getWearRailForViewer implementation** — `7b297c7` (feat)
3. **Task 2 RED — failing Server Action tests** — `f183616` (test)
4. **Task 2 GREEN — addToWishlistFromWearEvent implementation** — `fefedc5` (feat)

Plan metadata commit is made after this SUMMARY is written (bundles SUMMARY.md + STATE.md + ROADMAP.md).

## Files Created/Modified

- `src/lib/wywtTypes.ts` — new; type-only module exporting `WywtTile`, `WywtRailData`
- `src/data/wearEvents.ts` — modified; preserves all 6 prior exports, adds `getWearRailForViewer` (~90 new lines) and imports for `follows`, `profiles`, `watches`, `gte`, `or`, and the wywt types
- `src/app/actions/wishlist.ts` — new; `addToWishlistFromWearEvent` Server Action, 120 lines
- `tests/data/getWearRailForViewer.test.ts` — new; 17 tests (8 unit + 9 integration-gated), 381 lines
- `tests/actions/wishlist.test.ts` — new; 9 unit tests, 255 lines

## SQL Shape

### Generated query for `getWearRailForViewer` (canonical form as emitted by Drizzle)

The DAL issues **two** queries:

```sql
-- Query 1: resolve follower's following list
SELECT follows.following_id AS id
FROM follows
WHERE follows.follower_id = $viewerId;

-- Query 2: wear events JOIN for the rail
SELECT
  wear_events.id         AS wear_id,
  wear_events.user_id    AS user_id,
  wear_events.watch_id   AS watch_id,
  wear_events.worn_date  AS worn_date,
  wear_events.note       AS note,
  wear_events.created_at AS created_at,
  profiles.username,
  profiles.display_name,
  profiles.avatar_url,
  profile_settings.worn_public,
  watches.brand,
  watches.model,
  watches.image_url
FROM wear_events
INNER JOIN profiles         ON profiles.id        = wear_events.user_id
INNER JOIN profile_settings ON profile_settings.user_id = wear_events.user_id
INNER JOIN watches          ON watches.id         = wear_events.watch_id
WHERE
      wear_events.user_id IN ($viewerId, $following1, $following2, ...)
  AND wear_events.worn_date >= $cutoffDate   -- ISO 'YYYY-MM-DD' of now - 48h
  AND (
        wear_events.user_id = $viewerId       -- self-bypass
     OR profile_settings.worn_public = true   -- followed-actor gate
      )
ORDER BY wear_events.worn_date DESC,
         wear_events.created_at DESC;
```

### Plan quality note (EXPLAIN ANALYZE)

The canonical Postgres plan for Query 2 at production volume should use a **bitmap index scan on `wear_events_watch_worn_at_idx`** (composite `(watch_id, worn_date)`) only if the planner's join order starts from `wear_events`. However, the composite index is keyed on `watch_id` first — it does NOT help filter by `user_id` directly. A more likely plan is:

1. Hash join `follows` on `follower_id = viewer` → small set of following_ids.
2. Nested-loop or hash join into `wear_events` filtered by `user_id IN (...)` + `worn_date >= cutoff` → probably a sequential scan until `wear_events` grows to the size where a per-user index would pay off.
3. Inner-join `profiles`, `profile_settings`, `watches` on PK lookups.

**If rail latency degrades at scale, add a `(user_id, worn_date)` composite index on `wear_events`.** It mirrors the `activities_user_created_at_idx` pattern from Phase 7 and is the first lever to pull. Not recommended as part of Plan 03 because <500 watches/user and 48h window keep the working set tiny.

**Manual EXPLAIN ANALYZE not run during this executor session** — no local Supabase stack was attached and the integration suite skipped. Deferred to `/gsd-verify-work` or Plan 09: run the DAL against seeded local data and confirm the join order + 48h filter short-circuits as expected.

## Resolution of the `as never` cast

The planner proposed `createWatch(user.id, {...} as never)` because `createWatch` expects `Omit<Watch, 'id'>` and the Watch domain type carries many optional fields. On implementation I traced through `src/data/watches.ts` and confirmed that `createWatch` only uses the fields we pass — required fields (`brand`, `model`, `status`, `movement`, `complications`, `styleTags`, `designTraits`, `roleTags`) plus the optional `imageUrl` we provide. Every other Watch field is optional (`?:` in `src/lib/types.ts`) so omitting them is valid. **The `as never` cast was removed.** One narrow cast remains: `row.movement as MovementType` — `watches.movement` is a Drizzle enum column whose `$inferSelect` type is `'automatic' | 'manual' | 'quartz' | 'spring-drive' | 'other'`, which is structurally identical to `MovementType` in `@/lib/types`, but Drizzle's inferred string-literal union is not a `MovementType` to TypeScript without a cast. This is a defensible one-line type-narrow, not an unsafe escape hatch.

## Duplicate-wishlist tolerance — UX follow-up decision

Per CONTEXT.md `<specifics>`, "Add to wishlist" from the WYWT overlay is a **conversion moment** that must be one tap with no confirmation friction. The action therefore creates a new wishlist row every time it's invoked with the same `wearEventId` — **no dedupe, no confirm dialog, no toast prompting the user to review their wishlist first**.

Recommendation for Plan 06 (UI): show a **success toast** after the action resolves ("Added to wishlist") with an optional undo affordance if the UI wants to soften the one-tap pattern. A confirm dialog BEFORE the action is explicitly ruled out. Per-user dedupe is a future infrastructure concern (canonical watch DB) and is deferred per PROJECT.md "Out of Scope".

## Decisions Made

- **`as never` cast removed.** See the dedicated section above.
- **`movement as MovementType` narrow cast kept.** Drizzle-inferred string-literal unions don't compile to domain type aliases without a cast; this one is type-safe at runtime because the column is a CHECK-constrained enum in Postgres.
- **Privacy gate duplicates exist-leak-avoidance string.** Both missing and private-but-exists branches return the exact same error. Matches Phase 8's notes-visibility IDOR mitigation precedent.
- **Self-wear bypass on BOTH DAL and Server Action.** Viewer can always see/wishlist from their own wear event, regardless of their own worn_public setting. Mirrors the W-01 rule and prevents pathological UX where a private user can't interact with their own feed.
- **Integration tests gated on env vars, unit tests inline.** Same precedent as Plan 10-02. Unit tests verify SQL shape deterministically without a DB; integration tests verify privacy/window semantics when a local Supabase stack is present.

## Deviations from Plan

**None.**

The plan's action sketch included `as never` on the `createWatch` call (marked as "MVP — can be cleaned up in a follow-up"). The clean type path was available without a cast, so I took it — not a deviation in behavior, just a tightening of the code the plan itself flagged as revisit-able.

## Issues Encountered

- **Turbopack build passes without issue** — the narrowed `createWatch` types compile cleanly. No type errors surfaced during `npm run build`.
- **Pre-existing lint errors in unrelated files** (70 errors across `tests/actions/preferences.test.ts`, `tests/actions/watches.test.ts`, `tests/data/isolation.test.ts`, `tests/proxy.test.ts`, `src/components/FilterBar.tsx`, `src/components/settings/SettingsClient.tsx`, and `src/lib/similarity.ts`). None caused by this plan. Verified with a targeted lint on the 5 files introduced/modified here — zero errors, zero warnings.
- **No Supabase stack attached during this session**, so all 9 new integration tests skipped. They run automatically when `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set — verifier can flip env vars locally to exercise the full privacy suite.

## User Setup Required

None. No new secrets, no new migrations. The DAL and Server Action both use existing tables (`wear_events`, `profiles`, `profile_settings`, `watches`, `follows`, `activities`) from Phases 7–8.

## Next Phase Readiness

- **Plan 10-06 (WYWT UI)** can import `{ getWearRailForViewer }` from `@/data/wearEvents`, `{ addToWishlistFromWearEvent }` from `@/app/actions/wishlist`, and `{ WywtTile, WywtRailData }` from `@/lib/wywtTypes`. Everything it needs to render the rail and the overlay's Add-to-wishlist button is in place.
- **No blockers for the rest of Phase 10.**

## Self-Check: PASSED

Verified via shell checks:

- `src/lib/wywtTypes.ts` — FOUND; exports `WywtTile` and `WywtRailData` with the specified field shape
- `src/data/wearEvents.ts` — FOUND; all 6 prior exports grep-verified preserved (`logWearEvent`, `getMostRecentWearDate`, `getWearEventsByWatch`, `getMostRecentWearDates`, `getAllWearEventsByUser`, `getPublicWearEventsForViewer`); new export `getWearRailForViewer` present; contains `gte(wearEvents.wornDate`, `eq(wearEvents.userId, viewerId)`, `profileSettings.wornPublic`, `inArray(wearEvents.userId`, `innerJoin(watches`
- `src/app/actions/wishlist.ts` — FOUND; `'use server'` on line 1; contains `.strict()`, `status: 'wishlist'`, `logActivity`, `revalidatePath`
- `tests/data/getWearRailForViewer.test.ts` — FOUND; 8 unit + 9 integration-gated `it()` cases
- `tests/actions/wishlist.test.ts` — FOUND; 9 `it()` cases
- `npm test -- --run tests/data/getWearRailForViewer.test.ts tests/actions/wishlist.test.ts` — 17 passed, 9 skipped, 0 failed
- `npm test` full suite — 1566 passed, 23 skipped (23 = 14 pre-existing + 9 new integration)
- `npm run build` — green
- `npm run lint` on the 5 plan-03 files — zero errors/warnings
- Commits `37be2f8`, `7b297c7`, `f183616`, `fefedc5` — ALL FOUND in `git log`

---
*Phase: 10-activity-feed*
*Completed: 2026-04-21*

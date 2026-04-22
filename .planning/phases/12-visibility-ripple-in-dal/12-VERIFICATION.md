---
phase: 12-visibility-ripple-in-dal
verified: 2026-04-22T22:00:00Z
status: gaps_found
score: 4/5 roadmap success criteria verified
overrides_applied: 0
gaps:
  - truth: "Integration tests cover all three visibility tiers across all surfaces; test suite passes with no new failures introduced by Phase 12"
    status: failed
    reason: "tests/actions/wishlist.test.ts still uses the old wornPublic-based mock contract. The mock fixture (publicWearJoinRow) returns { wornPublic: true } instead of { visibility: 'public', profilePublic: true }. The mock chain does not handle the second follow-check query issued for followers-tier events. Tests 5 (Case B), 9, and at least one additional case fail because row.visibility is undefined and the canSee logic falls through to false unexpectedly."
    artifacts:
      - path: "tests/actions/wishlist.test.ts"
        issue: "publicWearJoinRow helper at line 61 returns wornPublic instead of visibility + profilePublic. makeSelectChain at line 32 only handles the first query (wear+watch+settings JOIN); the second db.select() call for the followers check has no mock return value. Tests 5 Case B and Test 9 (bonus) assert against wornPublic=false semantics that no longer exist in the action."
    missing:
      - "Update publicWearJoinRow to return { visibility: 'public', profilePublic: true } instead of { wornPublic: true }"
      - "Update Test 5 Case B to set mockJoinRows with { visibility: 'private' } (or followers without follow) instead of wornPublic: false"
      - "Update Test 9 (bonus) to use { visibility: 'public', actorId: viewerUserId } — self-bypass is now G-5 isSelf check, not wornPublic"
      - "Make makeSelectChain return value configurable OR use vi.mocked(db.select) per-call so the follows check query can return an empty array for non-followers and a row for followers"
      - "Add Test 10: follower-tier event returns success when viewer follows actor (mock follows query returns one row)"
      - "Add Test 11: follower-tier event returns 'Wear event not found' when viewer does not follow actor (mock follows query returns empty array)"
human_verification:
  - test: "Prod smoke test: verify worn_public column is absent in production database"
    expected: "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profile_settings' AND column_name='worn_public' returns 0 rows"
    why_human: "User confirmed supabase db push --linked --include-all succeeded per context; cannot query remote prod DB programmatically from this environment. Context states this was confirmed."
  - test: "Browser smoke: /settings renders 3 toggles (Profile, Collection, Wishlist) with no error after prod column drop"
    expected: "Settings page loads, all 3 toggles interactive, no runtime errors, no 'wornPublic' reference"
    why_human: "Requires running prod browser session"
  - test: "Browser smoke: /u/<self>/worn shows own wears correctly after column drop"
    expected: "Worn tab renders without error; owner sees all own wears including private ones; non-owner sees only public/followers tier"
    why_human: "Requires running prod browser session"
---

# Phase 12: Visibility Ripple in DAL Verification Report

**Phase Goal:** Every existing function that reads `wear_events` for non-owner viewers correctly enforces the three-tier visibility gate so followers-only wears are never exposed publicly.
**Verified:** 2026-04-22T22:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `getPublicWearEventsForViewer` (now `getWearEventsForViewer`) returns followers wear only to viewer-follows-actor; stranger sees nothing; wornPublic no longer the gate | VERIFIED | `src/data/wearEvents.ts:102` — `getWearEventsForViewer` exported; `getPublicWearEventsForViewer` exists only in a JSDoc comment (line 83). Three-tier predicate with `visibilityPredicate` OR logic + `eq(profileSettings.profilePublic, true)` G-4 outer gate + per-profile follow boolean check. No reference to `wornPublic` in live code. |
| 2 | `getWearRailForViewer` includes followers-only tiles only for followed actors; wornPublic=true on profile_settings does not gate anymore | VERIFIED | `src/data/wearEvents.ts:173` — `getWearRailForViewer` uses `leftJoin(follows, and(eq(follows.followerId, viewerId), eq(follows.followingId, wearEvents.userId)))` at line 205. WHERE clause uses three-tier OR with `sql\`${follows.id} IS NOT NULL\`` for the followers branch. G-4 outer gate (`eq(profileSettings.profilePublic, true)`) at line 219. G-5 self-bypass at line 217. No `wornPublic` in SELECT or WHERE. |
| 3 | `getFeedForUser` watch_worn rows gate on per-row metadata visibility; no JOIN to wear_events on feed hot path | VERIFIED | `src/data/activities.ts:164` — `OR (${activities.type} = 'watch_worn' AND ${activities.metadata}->>'visibility' IN ('public','followers'))`. Load-bearing comments: ASSUMPTION A2 (line 149) + D-09 fail-closed (line 155). No JOIN to wear_events. `src/lib/feedTypes.ts:51` carries `visibility?: WearVisibility` on RawFeedRow.metadata. |
| 4 | Profile worn tab calls viewer-aware DAL; private wears don't appear in non-owner rendered worn tab | VERIFIED | `src/app/u/[username]/[tab]/page.tsx:10` imports `getWearEventsForViewer`. Lines 167 and 210: two call sites (worn tab + stats tab non-owner branch). The `LockedTabCard` worn-tab branch replaced with explanatory comment at lines 107-117. `getPublicWearEventsForViewer` has zero live call sites in `src/`. |
| 5 | Integration tests cover public/followers/private × owner/follower/stranger before phase ships; all pass | PARTIAL — test fixture gap | `tests/integration/phase12-visibility-matrix.test.ts` exists (330 lines, 17 `it()` cells, env-gated). Plan 01 red-state confirmed; Plans 02-06 turn cells green. However `tests/actions/wishlist.test.ts` still uses the old `wornPublic` mock contract — 3 tests fail because `publicWearJoinRow` provides `wornPublic` not `visibility`/`profilePublic`, and the mock chain doesn't handle the second follow-check query. |

**Score:** 4/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/wearVisibility.ts` | WearVisibility type export | VERIFIED | `export type WearVisibility = 'public' \| 'followers' \| 'private'` at line 14 |
| `src/data/wearEvents.ts` | getWearEventsForViewer + getWearRailForViewer with three-tier predicate | VERIFIED | Both functions present, leftJoin on follows in rail, three-tier OR in both, no wornPublic |
| `src/lib/wywtTypes.ts` | WywtTile carries visibility: WearVisibility | VERIFIED | `visibility: WearVisibility` at line 29 |
| `src/data/activities.ts` | getFeedForUser metadata gate + WatchWornMetadata | VERIFIED | jsonb gate at line 164; WatchWornMetadata type at line 41 with `visibility: WearVisibility` |
| `src/app/actions/wearEvents.ts` | markAsWorn passes visibility:'public' | VERIFIED | Line 43: `visibility: 'public'` in logActivity call |
| `src/lib/feedTypes.ts` | RawFeedRow.metadata.visibility optional | VERIFIED | Line 51: `visibility?: WearVisibility` |
| `src/app/u/[username]/[tab]/page.tsx` | Calls getWearEventsForViewer; no LockedTabCard worn branch | VERIFIED | Import at line 10; 2 call sites at lines 167, 210; LockedTabCard worn branch replaced with comment |
| `src/app/actions/wishlist.ts` | Three-tier gate via visibility + follows; no wornPublic | VERIFIED | `visibility: wearEvents.visibility` at line 70; `profilePublic` at line 69; `isSelf` G-5 at line 84; follows check at lines 86-100; uniform error strings at lines 80 and 111 |
| `src/data/profiles.ts` | ProfileSettings without wornPublic | VERIFIED | Zero matches for wornPublic in live code |
| `src/app/actions/profile.ts` | VISIBILITY_FIELDS without 'wornPublic' | VERIFIED | Zero matches for wornPublic |
| `src/app/settings/page.tsx` | No wornPublic in settings prop | VERIFIED | Zero matches for wornPublic |
| `src/components/settings/SettingsClient.tsx` | No Worn History toggle; no wornPublic in props | VERIFIED | Zero matches for wornPublic or 'Worn History' |
| `src/db/schema.ts` | profileSettings without wornPublic column declaration | VERIFIED | Line 183 is a comment only; no `boolean('worn_public')` declaration |
| `drizzle/0003_phase12_drop_worn_public.sql` | ALTER TABLE ... DROP COLUMN "worn_public" | VERIFIED | File exists; contains `ALTER TABLE "profile_settings" DROP COLUMN "worn_public"` in the last statement |
| `supabase/migrations/20260424000001_phase12_drop_worn_public.sql` | BEGIN/COMMIT/DROP COLUMN worn_public | VERIFIED | File exists; `ALTER TABLE profile_settings DROP COLUMN worn_public` present |
| `tests/integration/phase12-visibility-matrix.test.ts` | 15+ cells, env-gated, imports getWearEventsForViewer | VERIFIED | 17 it() cells; `const maybe = process.env.DATABASE_URL ? describe : describe.skip`; imports `getWearEventsForViewer` |
| `tests/data/getWearRailForViewer.test.ts` | Unit 9-11 asserting new SQL shape | VERIFIED | Lines 216, 222, 246 confirm Unit 9, 10, 11 present |
| `tests/data/getFeedForUser.test.ts` | 3 Phase 12 tests asserting metadata gate | VERIFIED | Lines 191, 213, 240 confirm 3 Phase 12 tests present |
| `tests/actions/wishlist.test.ts` | Mocks updated for three-tier contract | FAILED | Mock fixture returns `wornPublic` not `visibility`/`profilePublic`; 3 test cases assert against old contract |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/data/wearEvents.ts (getWearEventsForViewer)` | `wearEvents.visibility + follows + profileSettings.profilePublic` | Drizzle three-tier OR predicate | WIRED | `eq(wearEvents.visibility, 'followers')` at lines 134-135; `eq(profileSettings.profilePublic, true)` at line 155; per-profile follow check at lines 117-131 |
| `src/data/wearEvents.ts (getWearRailForViewer)` | `follows table` | leftJoin on viewer→actor direction | WIRED | `leftJoin(follows, and(eq(follows.followerId, viewerId), eq(follows.followingId, wearEvents.userId)))` at line 205 |
| `src/data/activities.ts (getFeedForUser)` | `activities.metadata jsonb` | Drizzle sql template `->>` operator | WIRED | `${activities.metadata}->>'visibility' IN ('public','followers')` at line 164; D-09 fail-closed comment at line 155 |
| `src/app/u/[username]/[tab]/page.tsx` | `src/data/wearEvents.ts (getWearEventsForViewer)` | import + 2 call sites | WIRED | Import at line 10; calls at lines 167 and 210 |
| `src/app/actions/wishlist.ts` | `wear_events.visibility + follows table + profileSettings.profilePublic` | Inline three-tier TS evaluation post-fetch | WIRED | SELECT includes `visibility` and `profilePublic`; follow check on followers tier; canSee logic at lines 103-108 |
| `src/app/settings/page.tsx` | `src/components/settings/SettingsClient.tsx` | settings prop (3 fields: profilePublic, collectionPublic, wishlistPublic) | WIRED | No wornPublic in either file |
| `src/app/actions/profile.ts` | `src/data/profiles.ts updateProfileSettingsField` | VISIBILITY_FIELDS Zod enum | WIRED | VISIBILITY_FIELDS has 3 entries, no wornPublic |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `getWearEventsForViewer` | viewerFollowsActor boolean → visibilityPredicate | `db.select({id}).from(follows).where(eq(followerId,viewerUserId), eq(followingId,profileUserId))` | Yes — live Drizzle query | FLOWING |
| `getWearRailForViewer` | `follows.id IS NOT NULL` per-row check | `leftJoin(follows, ...)` in the main query | Yes — leftJoin per row | FLOWING |
| `getFeedForUser` | `metadata->>'visibility' IN (...)` | activities.metadata jsonb column | Yes — inline Postgres jsonb operator; fails closed for NULL (D-09) | FLOWING |
| `addToWishlistFromWearEvent` | row.visibility, row.profilePublic, isFollower | JOIN result + conditional follows query | Yes — live Drizzle queries | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry point without starting the dev server and connecting to a live database. Integration tests cover the behavioral assertions; the test suite requires DATABASE_URL.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WYWT-10 | Plans 01-04 | Three-tier visibility wired through every wear-reading DAL | SATISFIED | `getWearEventsForViewer`, `getWearRailForViewer`, `getFeedForUser`, `addToWishlistFromWearEvent`, profile worn tab — all gated on per-row visibility. No live reference to `wornPublic` in any DAL or action. |
| WYWT-11 | Plans 05-06 | `worn_public` column removed from profile_settings after backfill verified | SATISFIED (code) / PENDING (prod human confirm per context) | `src/db/schema.ts` has only a comment at line 183. Drizzle migration `0003_phase12_drop_worn_public.sql` + Supabase migration `20260424000001_phase12_drop_worn_public.sql` both exist. Local DB drop confirmed in 12-06-SUMMARY.md. Prod push confirmed by user per context (autonomous: false checkpoint). |

Note: REQUIREMENTS.md traceability table maps WYWT-11 to Phase 11, not Phase 12. The actual column drop (completing WYWT-11) occurs in Phase 12. This is a traceability discrepancy in the requirements table — not a code issue.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/actions/wishlist.test.ts` | 61-71 | `publicWearJoinRow` returns `wornPublic: true` — dead mock field; action no longer reads this key | Blocker | 3 tests assert against old wornPublic semantics; mock does not provide `visibility` or `profilePublic` fields the action now reads; tests either fail or pass for the wrong reason |
| `tests/actions/wishlist.test.ts` | 32-46 | `makeSelectChain` handles only one `db.select()` call; action now issues a second `db.select()` for the follows check when `visibility === 'followers'` | Blocker | Any test asserting followers-tier behavior will have the follow check query resolve to undefined instead of `[]`, causing unexpected behavior |
| `supabase/migrations/20260422000000_phase10_activities_feed_select.sql` | 5 | Stale comment "worn_public from profile_settings" in Phase 10 migration (CR-01 from code review) | Warning | Misleading to future privacy auditors; migrations are append-only so cannot edit in place. Recommendation: add a superseding NOTE in Phase 12 drop migration or a small follow-up migration with a comment. No code impact. |
| `src/data/wearEvents.ts` | 250 | `visibility: r.visibility as WearVisibility` — unchecked cast (IN-03 from code review) | Info | Safe in practice (pgEnum constrains values); loses compiler coverage on future enum expansion |

### Human Verification Required

Per the context statement that the user confirmed `supabase db push --linked --include-all` succeeded, the prod push is considered complete. The following items remain as verification checkpoints:

**1. Prod schema confirmation**

**Test:** Run `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profile_settings' ORDER BY column_name;` against production Supabase
**Expected:** 5 rows: collection_public, profile_public, updated_at, user_id, wishlist_public. No worn_public row.
**Why human:** Cannot query remote prod DB programmatically

**2. Prod browser smoke — settings page**

**Test:** Visit `/settings` in production browser
**Expected:** Page renders with exactly 3 privacy toggles (Profile · Collection · Wishlist); no runtime errors; no "wornPublic" reference in page source
**Why human:** Requires prod browser session

**3. Prod browser smoke — worn tab**

**Test:** Visit `/u/<self>/worn` (owner view) and `/u/<another-user>/worn` (non-owner view) in production
**Expected:** Own wears render without error; non-owner sees only public/followers wears (or empty state); no 500 errors
**Why human:** Requires prod browser session

### Gaps Summary

One gap blocks goal achievement: **tests/actions/wishlist.test.ts mock fixtures are not updated for the three-tier contract**.

The gap is isolated to the test file — the production code in `src/app/actions/wishlist.ts` correctly implements the three-tier gate (verified at code level). The test mock `publicWearJoinRow` still returns `{ wornPublic: true }` instead of `{ visibility: 'public', profilePublic: true }`. Additionally, `makeSelectChain` handles only the first `db.select()` call but the action now conditionally issues a second query for the follows check on followers-tier events.

This means:
- Test 5 Case B (actor has wornPublic=false, not viewer) passes `{ wornPublic: false }` but the action reads `row.visibility` which is `undefined`. `undefined === 'public'` is false and `undefined === 'followers'` is false, so `canSee` evaluates to `false` — the test may pass accidentally for the wrong reason.
- Test 9 (self wear event allowed even when wornPublic=false) passes `{ actorId: viewerUserId, wornPublic: false }` but no `visibility` field. `isSelf` is true so it short-circuits to `canSee = true` — this test passes but by coincidence, not by testing the new contract.
- The 12-05-SUMMARY.md acknowledges "3 pre-existing failures in tests/actions/wishlist.test.ts (3 tests — pre-existing from Plan 12-04 three-tier gate changes)".

The fix requires: (1) updating `publicWearJoinRow` to provide `visibility` and `profilePublic` instead of `wornPublic`, (2) making the mock chain handle the conditional second query for follows, and (3) updating test case assertions to reflect the new contract.

---

_Verified: 2026-04-22T22:00:00Z_
_Verifier: Claude (gsd-verifier)_

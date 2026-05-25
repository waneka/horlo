---
phase: 56A-wear-view-unification
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/data/getActiveWearsForUser.test.ts
  - tests/components/wear/WearCard.test.tsx
  - tests/integration/phase56a-wears-lane.test.ts
  - tests/e2e/wears-lane.test.ts
  - src/data/wearEvents.ts
autonomous: true
requirements: [SC-1, SC-2, SC-3, SC-4, SC-5]
must_haves:
  truths:
    - "getActiveWearsForUser(viewer, actor) returns ALL of one actor's wear events within the 48h window, oldest-first (D-04, D-05)"
    - "getActiveWearsForUser applies the three-tier visibility gate: self sees all; non-owner gated by profile_public + public/followers (SEC / Access Control)"
    - "getActiveWearsForUser returns raw photoUrl Storage paths, never signed URLs (Pitfall F-2)"
    - "Wave 0 RED test files exist for SC-1, SC-2, SC-3, SC-4, SC-5, D-07, D-09, F-2 and run under vitest/playwright"
  artifacts:
    - path: "src/data/wearEvents.ts"
      provides: "getActiveWearsForUser export (D-04 48h window, D-05 oldest-first, three-tier gate)"
      contains: "export async function getActiveWearsForUser"
    - path: "tests/data/getActiveWearsForUser.test.ts"
      provides: "DAL unit tests — D-07 (0 rows), F-2 (raw photoUrl), oldest-first ordering, gate"
    - path: "tests/components/wear/WearCard.test.tsx"
      provides: "Wave 0 RED scaffold for SC-4 (shared single-source) + D-09 (wishlist hidden)"
    - path: "tests/integration/phase56a-wears-lane.test.ts"
      provides: "Wave 0 RED scaffold for SC-1, D-07, SC-5"
    - path: "tests/e2e/wears-lane.test.ts"
      provides: "Wave 0 RED scaffold for SC-1, SC-2, SC-3 via Playwright"
  key_links:
    - from: "src/data/wearEvents.ts:getActiveWearsForUser"
      to: "drizzle asc() ordering"
      via: "orderBy(asc(wornDate), asc(createdAt))"
      pattern: "asc\\(wearEvents\\.wornDate\\)"
    - from: "tests/data/getActiveWearsForUser.test.ts"
      to: "src/data/wearEvents.ts:getActiveWearsForUser"
      via: "mocked-drizzle SQL-shape assertions"
      pattern: "getActiveWearsForUser"
---

<objective>
Lay the data + test foundation for Phase 56A. Add the new `getActiveWearsForUser(viewerId, actorId)` DAL read that powers the `/wears/[username]` stories lane (ALL of one actor's active wears in the 48h window, oldest-first, three-tier visibility gated), and author the Wave 0 test scaffolds that the rest of the phase satisfies.

Purpose: The stories lane needs a per-user "all active wears" read that the existing `getWearRailForViewer` (most-recent-per-actor across followings) cannot provide. This DAL is the keystone read for the new route. The Wave 0 scaffolds make every success criterion (SC-1..SC-5) and locked decision (D-07, D-09, F-2) testable before implementation lands (Nyquist Dimension 8).

Output: One new DAL function + four test files (one with real assertions for the DAL, three RED scaffolds completed by later plans).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/56A-wear-view-unification/56A-CONTEXT.md
@.planning/phases/56A-wear-view-unification/56A-RESEARCH.md
@.planning/phases/56A-wear-view-unification/56A-PATTERNS.md
@.planning/phases/56A-wear-view-unification/56A-VALIDATION.md

<interfaces>
<!-- Existing DAL contracts the executor implements against. No codebase exploration needed. -->

From src/data/wearEvents.ts (existing, top of file line 5 — `asc` is NOT yet imported):
```
import { eq, and, desc, inArray, gte, or, sql } from 'drizzle-orm'
```
getWearEventsForViewer(viewerUserId, profileUserId)  — three-tier gate analog (lines 161-221): follow-row lookup → visibilityPredicate → single WHERE with profileSettings.profilePublic G-4 gate.
getWearRailForViewer(viewerId): Promise<WywtRailData>  — 48h cutoff analog (lines 317-320): cutoffMs = Date.now() - 48*60*60*1000; cutoffDate = new Date(cutoffMs).toISOString().slice(0,10).

From src/data/reactions.ts:
```
export type LikeTarget = { type: 'watch' | 'wear'; id: string }
export async function getLikesForTargetCached(viewerId: string, target: LikeTarget): Promise<LikesResult>  // { viewerHasLiked: boolean; count: number }
```

From src/data/profiles.ts:
```
export async function getProfileByUsername(username: string)  // case-insensitive; returns full profiles row (incl. id) or null
```

From src/lib/types.ts:
```
export type WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'
```

Test infra (vitest.config.ts): environment jsdom, setupFiles ./tests/setup.tsx, include tests/**/*.test.{ts,tsx} + src/**/*.test.{ts,tsx}. Run command: `npm run test` (vitest run). E2E: `npm run test:e2e` (playwright test). Existing analog test for SQL-shape mocking: tests/data/getWearRailForViewer.test.ts (PART A mocks drizzle chain to assert JOIN targets / cutoff / ordering). Existing e2e analog: tests/e2e/profile-tab-nav.test.ts (imports from '@playwright/test', inherits storageState from setup project).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add getActiveWearsForUser DAL read</name>
  <files>src/data/wearEvents.ts</files>
  <read_first>
    - src/data/wearEvents.ts (the file being modified — read getWearEventsForViewer at lines 161-221 for the three-tier gate, getWearRailForViewer at lines 317-407 for the 48h cutoff + JOIN/select shape + asc/desc usage, and the import line 5)
    - .planning/phases/56A-wear-view-unification/56A-PATTERNS.md (§ `src/data/wearEvents.ts — add getActiveWearsForUser` — has the exact function body shape, self-bypass branch, follow check, visibilityPredicate, and the `asc` import correction)
    - .planning/phases/56A-wear-view-unification/56A-RESEARCH.md (§ New DAL Function — query shape, visibility gate G-4/G-5, Pitfall F-2 raw-photoUrl rule)
  </read_first>
  <behavior>
    - Test 1 (oldest-first): orderBy is asc(wornDate) then asc(createdAt) — NOT desc. Drives D-05.
    - Test 2 (48h cutoff): WHERE includes gte(wearEvents.wornDate, cutoffDate) where cutoffDate = Date.now() - 48h sliced to YYYY-MM-DD (identical to getWearRailForViewer).
    - Test 3 (self-bypass G-5): when viewerId === actorId, no profileSettings JOIN / no profilePublic predicate — owner sees all their own active wears regardless of visibility.
    - Test 4 (non-self gate): when viewerId !== actorId, WHERE includes eq(profileSettings.profilePublic, true) (G-4) AND a visibilityPredicate that is public-only when viewer does not follow actor, or public-OR-followers when viewer follows actor.
    - Test 5 (raw photoUrl, F-2): the select projects wearEvents.photoUrl (raw Storage path); the function has NO 'use cache' directive and never calls createSignedUrl.
    - Test 6 (filter by actor): WHERE includes eq(wearEvents.userId, actorId).
  </behavior>
  <action>
    Add `asc` to the existing drizzle-orm import at line 5 so it reads `import { eq, and, desc, inArray, gte, or, sql, asc } from 'drizzle-orm'`.

    Add a new exported async function `getActiveWearsForUser(viewerId: string, actorId: string)` to `src/data/wearEvents.ts`. Compute the 48h cutoff identically to `getWearRailForViewer`: `const cutoffMs = Date.now() - 48 * 60 * 60 * 1000` and `const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10)`.

    The function returns rows with this SELECT projection (all columns needed by WearCard without extra reads): `id` (wearEvents.id), `userId`, `watchId`, `wornDate`, `note`, `photoUrl` (RAW wearEvents.photoUrl — Pitfall F-2: never sign here), `visibility`, `createdAt`, plus JOINed `username` (profiles.username), `displayName` (profiles.displayName), `avatarUrl` (profiles.avatarUrl), `brand` (watches.brand), `model` (watches.model), `watchImageUrl` (watches.imageUrl).

    Branch on self-bypass (G-5) FIRST: when `viewerId === actorId`, SELECT from wearEvents innerJoin profiles (eq(profiles.id, wearEvents.userId)) innerJoin watches (eq(watches.id, wearEvents.watchId)); WHERE `and(eq(wearEvents.userId, actorId), gte(wearEvents.wornDate, cutoffDate))`; orderBy `asc(wearEvents.wornDate), asc(wearEvents.createdAt)` (oldest-first, D-05). Do NOT join profileSettings on the self branch.

    Non-self branch: resolve the follow relationship with a single one-row lookup (same as getWearEventsForViewer lines 173-186): `db.select({ id: follows.id }).from(follows).where(and(eq(follows.followerId, viewerId), eq(follows.followingId, actorId))).limit(1)`; set `viewerFollowsActor = followRows.length > 0`. Compose `visibilityPredicate = viewerFollowsActor ? or(eq(wearEvents.visibility,'public'), eq(wearEvents.visibility,'followers')) : eq(wearEvents.visibility,'public')`. Then SELECT the same projection from wearEvents innerJoin profileSettings (eq(profileSettings.userId, wearEvents.userId)) innerJoin profiles innerJoin watches; WHERE `and(eq(wearEvents.userId, actorId), gte(wearEvents.wornDate, cutoffDate), eq(profileSettings.profilePublic, true), visibilityPredicate)`; orderBy `asc(wearEvents.wornDate), asc(wearEvents.createdAt)`.

    Add a JSDoc header matching the PATTERNS.md text: returns ALL wear events for actorId within 48h (D-04), visible to viewerId, oldest→newest (D-05); three-tier gate mirrors getWearEventsForViewer; returns raw photoUrl, caller mints signed URLs per-request (Pitfall F-2). Do NOT add a `'use cache'` directive. Mirror the existing return-type inference style (no explicit return type annotation; the analog functions infer their row type).
  </action>
  <verify>
    <automated>npm run test -- getActiveWearsForUser</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export async function getActiveWearsForUser" src/data/wearEvents.ts` returns one match
    - `grep -n "asc," src/data/wearEvents.ts` shows `asc` added to the drizzle-orm import on line 5
    - `getActiveWearsForUser` body contains `asc(wearEvents.wornDate)` and `asc(wearEvents.createdAt)` and does NOT contain `desc(wearEvents.wornDate)` within its scope
    - `getActiveWearsForUser` scope contains `gte(wearEvents.wornDate, cutoffDate)` and `eq(wearEvents.userId, actorId)`
    - The non-self branch contains `eq(profileSettings.profilePublic, true)`; the `viewerId === actorId` branch does NOT join profileSettings
    - `getActiveWearsForUser` scope does NOT contain `'use cache'` nor `createSignedUrl` (Pitfall F-2)
    - `grep -v '^#' src/data/wearEvents.ts | grep -c "createSignedUrl"` returns 0 (DAL never signs)
    - `npm run test -- getActiveWearsForUser` exits 0 (the Task 2 DAL test passes against this implementation)
  </acceptance_criteria>
  <done>getActiveWearsForUser exists, applies the 48h window + oldest-first ordering + three-tier gate, returns raw photoUrl, and its dedicated test passes.</done>
</task>

<task type="auto">
  <name>Task 2: Author Wave 0 test scaffolds (DAL real + three RED)</name>
  <files>tests/data/getActiveWearsForUser.test.ts, tests/components/wear/WearCard.test.tsx, tests/integration/phase56a-wears-lane.test.ts, tests/e2e/wears-lane.test.ts</files>
  <read_first>
    - tests/data/getWearRailForViewer.test.ts (the SQL-shape mocked-drizzle analog — copy the PART A drizzle chain mock structure: makeFollowingChain / makeWearChain / calls array / op assertions)
    - tests/e2e/profile-tab-nav.test.ts (the Playwright analog — `import { test, expect } from '@playwright/test'`, storageState inherited from the `setup` project, console-error capture pattern)
    - .planning/phases/56A-wear-view-unification/56A-VALIDATION.md (the per-criterion test map: which file covers which SC / D-NN)
    - src/data/wearEvents.ts (read the getActiveWearsForUser you just wrote so the DAL test asserts the real SQL shape)
  </read_first>
  <action>
    Create `tests/data/getActiveWearsForUser.test.ts` with REAL passing assertions (this is the green DAL test, not a RED scaffold). Mirror the mocked-drizzle PART A structure from `tests/data/getWearRailForViewer.test.ts`: mock `@/db` so `db.select(...).from(...).innerJoin(...).where(...).orderBy(...)` records ops into a `calls` array and resolves to a controllable rows fixture. Assert: (1) orderBy receives `asc` ordering for wornDate then createdAt (D-05); (2) the WHERE composition includes the 48h `gte` cutoff and `eq(userId, actorId)`; (3) self-bypass branch (viewerId===actorId) does NOT call innerJoin against profileSettings; (4) non-self branch includes the profilePublic predicate; (5) the returned rows expose `photoUrl` as the raw value passed in (no signing, F-2); (6) D-07 precondition — when the mocked query resolves to `[]`, the function returns `[]` (the page-level redirect is asserted in the integration scaffold). Tag covered criteria in comments: D-05, D-04/48h, SEC gate, F-2.

    Create `tests/components/wear/WearCard.test.tsx` as a RED scaffold for SC-4 + D-09. Use `it.todo` or `it(..., { fails: ... })` style is NOT used here — instead write real assertions guarded so they fail until WearCard exists: a top-of-file comment "Wave 0 RED — completed by Plan 02/03". Assert intent: (a) SC-4 — importing `WearCard` from `@/components/wear/WearCard` resolves to a function (single shared source); (b) D-09 — when `showAddToWishlist={false}` the rendered output contains no "Add to wishlist" menu item, and when `showAddToWishlist={true}` it does. Since WearCard does not yet exist, leave the import + render in a `describe` that the harness reports RED; the executor of Plan 02/03 makes it green. Mark with `// EXPECTED RED until Plan 02 lands WearCard`.

    Create `tests/integration/phase56a-wears-lane.test.ts` as a RED scaffold for SC-1, D-07, SC-5. Assert intent: (a) D-07 — a page-level helper or the route module redirects to `/u/[username]` when getActiveWearsForUser returns []; (b) SC-1 — the rail tile navigation target is `/wears/${username}` (assert against the WywtRail openAt contract once it lands); (c) SC-5 — `WywtOverlay`/`WywtSlide` modules are removed (assert via a dynamic import that should reject after Plan 05, or a fs existence check). Mark each with `// EXPECTED RED until Plan 03 / Plan 05`.

    Create `tests/e2e/wears-lane.test.ts` as a Playwright RED scaffold for SC-1, SC-2, SC-3. Import from `@playwright/test`, inherit storageState from the `setup` project (match profile-tab-nav.test.ts). Assert intent with `--grep "wears-lane"`-discoverable test names: (a) SC-1 tapping a home-rail tile lands on a URL matching `/wears/`; (b) SC-2 on `/wears/[username]` the BottomNav (`nav[aria-label="Primary"]`) is NOT present; (c) SC-3 `/wear/[id]` retains the nav and is vertically scrollable. Mark `// EXPECTED RED until Plans 03/04/05`.
  </action>
  <verify>
    <automated>npm run test -- getActiveWearsForUser</automated>
  </verify>
  <acceptance_criteria>
    - All four files exist: `ls tests/data/getActiveWearsForUser.test.ts tests/components/wear/WearCard.test.tsx tests/integration/phase56a-wears-lane.test.ts tests/e2e/wears-lane.test.ts` lists all four
    - `npm run test -- getActiveWearsForUser` exits 0 (DAL test is green against Task 1's implementation)
    - `tests/components/wear/WearCard.test.tsx` references `@/components/wear/WearCard` and asserts a "Add to wishlist" presence/absence pair (D-09)
    - `tests/integration/phase56a-wears-lane.test.ts` asserts a `/wears/` navigation target (SC-1) and a `/u/` redirect on empty wears (D-07)
    - `tests/e2e/wears-lane.test.ts` imports from `@playwright/test` and contains a test name matching `wears-lane`
    - Each RED scaffold file carries an `EXPECTED RED until Plan` comment naming the plan that turns it green
  </acceptance_criteria>
  <done>The DAL test is green; the three RED scaffolds exist with concrete assertions for SC-1/2/3/4/5, D-07, D-09, F-2, each annotated with the plan that satisfies it.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → DAL (getActiveWearsForUser) | `username` from the URL is resolved server-side; `viewerId` always from session, never client-supplied |
| DAL → Storage | photoUrl is a raw Storage path; signing happens later in the page, never in this read |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-56A-01 | Information Disclosure | getActiveWearsForUser leaking wears the viewer cannot see (IDOR-adjacent) | mitigate | Three-tier gate replicated from getWearEventsForViewer: self-bypass only when viewerId===actorId; non-owner requires profileSettings.profilePublic=true AND public (or followers when viewerFollowsActor). Asserted by Task 2 gate tests. |
| T-56A-02 | Information Disclosure | Signed-URL caching / leakage via DAL (Pitfall F-2) | mitigate | DAL returns raw photoUrl only; no `'use cache'`, no createSignedUrl in this function. Asserted by Task 1 acceptance grep + Task 2 F-2 test. |
| T-56A-03 | Spoofing | viewerId spoofed via client input | accept | viewerId is supplied by the page from `getCurrentUser()`, not by this DAL's callers from the client; the DAL is server-only (`import 'server-only'` at top of wearEvents.ts). No additional control needed at this layer. |
</threat_model>

<verification>
- `npm run test -- getActiveWearsForUser` exits 0
- `npm run test` does not regress existing green tests (the three RED scaffolds are expected red and are not counted as regressions — confirm only previously-green suites stay green)
- `grep -c "createSignedUrl" src/data/wearEvents.ts` shows no new occurrences inside getActiveWearsForUser
</verification>

<success_criteria>
- getActiveWearsForUser exists with the 48h window, oldest-first ordering, three-tier gate, and raw-photoUrl return (no caching/signing)
- Four Wave 0 test files exist; the DAL test is green; the three scaffolds carry concrete RED assertions mapped to SC-1..SC-5, D-07, D-09, F-2
</success_criteria>

<output>
After completion, create `.planning/phases/56A-wear-view-unification/56A-01-SUMMARY.md`
</output>

---
phase: 09-follow-system-collector-profiles
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/data/follows.ts
  - src/app/actions/follows.ts
  - src/lib/tasteOverlap.ts
  - tests/data/follows.test.ts
  - tests/actions/follows.test.ts
  - tests/lib/tasteOverlap.test.ts
autonomous: true
requirements: [FOLL-01, FOLL-02, FOLL-03, FOLL-04, PROF-09]
must_haves:
  truths:
    - "followUser Server Action inserts a follows row for an authenticated caller and is idempotent on repeat calls"
    - "followUser rejects when followerId === followingId (self-follow) and returns ActionResult.error='Cannot follow yourself'"
    - "unfollowUser deletes only the follow row belonging to the authenticated caller (WHERE follower_id = user.id)"
    - "followUser and unfollowUser both call revalidatePath('/u/[username]', 'layout') on success so the layout re-fetches getFollowerCounts → FOLL-03 end-to-end reconciliation"
    - "getFollowerCounts returns accurate counts computed by SQL COUNT(*) over the follows table with no denormalized cache"
    - "getFollowersForProfile and getFollowingForProfile return one row per relationship joined with profile + profile_settings + watch counts in a single query (no N+1)"
    - "isFollowing(followerId, followingId) returns true when the pair exists, false otherwise"
    - "getTasteOverlapData is wrapped in React `cache()` so a single render that calls it twice (layout + common-ground tab page) incurs one DB roundtrip per request — preserves D-03 'no cache across renders'"
    - "computeTasteOverlap returns shared watches using normalized (lowercased + trimmed) brand+model intersection"
    - "computeTasteOverlap returns one of the three literal overlapLabel values: 'Strong overlap' | 'Some overlap' | 'Different taste'"
    - "computeTasteOverlap handles viewer with zero watches gracefully (returns taste-tag intersection and 'Different taste' label per D-05)"
  artifacts:
    - path: "src/data/follows.ts"
      provides: "followUser, unfollowUser, isFollowing, getFollowersForProfile, getFollowingForProfile, getTasteOverlapData DAL functions"
      exports: ["followUser", "unfollowUser", "isFollowing", "getFollowersForProfile", "getFollowingForProfile", "getTasteOverlapData"]
    - path: "src/app/actions/follows.ts"
      provides: "followUser and unfollowUser Server Actions with Zod validation, auth gate, self-follow rejection"
      exports: ["followUser", "unfollowUser"]
    - path: "src/lib/tasteOverlap.ts"
      provides: "computeTasteOverlap pure function returning TasteOverlapResult"
      exports: ["computeTasteOverlap", "TasteOverlapResult"]
    - path: "tests/lib/tasteOverlap.test.ts"
      provides: "Unit tests covering intersection, normalization, label thresholds, and empty-viewer"
      contains: "describe('computeTasteOverlap'"
    - path: "tests/data/follows.test.ts"
      provides: "Unit tests for DAL idempotency and SQL shape"
      contains: "describe('follows DAL'"
    - path: "tests/actions/follows.test.ts"
      provides: "Tests for self-follow rejection, unauth rejection, Zod validation, and FOLL-03 revalidatePath spy (end-to-end count path)"
      contains: "describe('followUser'"
  key_links:
    - from: "src/app/actions/follows.ts"
      to: "src/data/follows.ts"
      via: "direct import followUser/unfollowUser DAL functions"
      pattern: "import \\* as followsDAL from '@/data/follows'"
    - from: "src/app/actions/follows.ts"
      to: "src/lib/auth.ts"
      via: "getCurrentUser() auth gate on every action entry"
      pattern: "await getCurrentUser\\(\\)"
    - from: "src/app/actions/follows.ts"
      to: "revalidatePath('/u/[username]', 'layout')"
      via: "next/cache revalidatePath called on every successful mutation (FOLL-03 end-to-end count path)"
      pattern: "revalidatePath\\('/u/\\[username\\]', 'layout'\\)"
    - from: "src/data/follows.ts::getTasteOverlapData"
      to: "react::cache"
      via: "wrap the exported function in React cache() so per-request callers (layout + [tab]/page.tsx) hit it once"
      pattern: "import \\{ cache \\} from 'react'"
    - from: "src/lib/tasteOverlap.ts"
      to: "src/lib/similarity.ts"
      via: "imports analyzeSimilarity + GOAL_THRESHOLDS for label derivation"
      pattern: "from '@/lib/similarity'"
    - from: "src/lib/tasteOverlap.ts"
      to: "src/lib/stats.ts"
      via: "imports styleDistribution + roleDistribution for side-by-side bars"
      pattern: "from '@/lib/stats'"
---

<objective>
Ship the full data and pure-logic foundation for Phase 9: follow/unfollow DAL, follow/unfollow Server Actions (Zod-validated, self-follow rejected, idempotent), follower/following list DAL with single-query joins, isFollowing check DAL, getTasteOverlapData DAL (loads both users' watches + preferences + tasteTags for server-side computation, wrapped in React `cache()` for per-request memoization), and the pure-function `src/lib/tasteOverlap.ts` that returns `TasteOverlapResult` with shared watches, shared taste tags, overlap label, and shared style/role rows.

Purpose: Plans 02, 03, and 04 consume these functions. This plan is the foundation wave — no UI. Wave 0 validation per 09-VALIDATION.md lands here alongside the code (Nyquist compliance — every behavior verified by automated test at commit time).

Output: Three new production files (src/data/follows.ts, src/app/actions/follows.ts, src/lib/tasteOverlap.ts) and three new test files covering FOLL-01/02/03/04 and PROF-09 at the pure-function + DAL level.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-follow-system-collector-profiles/09-CONTEXT.md
@.planning/phases/09-follow-system-collector-profiles/09-RESEARCH.md
@.planning/phases/09-follow-system-collector-profiles/09-VALIDATION.md
@CLAUDE.md
@AGENTS.md

<interfaces>
<!-- Extracted from the existing codebase. Executor uses these directly. -->

From src/db/schema.ts (lines 144-157, 159-166):
```typescript
export const follows = pgTable('follows', {
  id: uuid('id').defaultRandom().primaryKey(),
  followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('follows_follower_idx').on(table.followerId),
  index('follows_following_idx').on(table.followingId),
  unique('follows_unique_pair').on(table.followerId, table.followingId),
])

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  username: text('username').notNull().unique(),
  displayName: text('display_name'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  // ...
})

export const profileSettings = pgTable('profile_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  profilePublic: boolean('profile_public').notNull().default(true),
  collectionPublic: boolean('collection_public').notNull().default(true),
  wishlistPublic: boolean('wishlist_public').notNull().default(true),
  wornPublic: boolean('worn_public').notNull().default(true),
  updatedAt: timestamp(...),
})

export const watches = pgTable('watches', {
  id: uuid, userId: uuid (FK to users.id),
  brand: text notNull, model: text notNull,
  status: 'owned' | 'wishlist' | 'sold' | 'grail',
  styleTags: text[], roleTags: text[], designTraits: text[],
  // ... (see types.ts for full Watch shape)
})
```

From src/lib/types.ts:
```typescript
export interface Watch {
  id: string; brand: string; model: string; status: WatchStatus;
  styleTags: string[]; roleTags: string[]; designTraits: string[];
  complications: string[]; movement: MovementType;
  caseSizeMm?: number; waterResistanceM?: number; strapType?: StrapType;
  dialColor?: string; /* ... */
}
export interface UserPreferences {
  preferredStyles: string[]; dislikedStyles: string[];
  /* ... */
  overlapTolerance: 'low' | 'medium' | 'high';
  collectionGoal?: 'balanced' | 'specialist' | 'variety-within-theme' | 'brand-loyalist';
}
```

From src/lib/actionTypes.ts:
```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

From src/lib/auth.ts:
```typescript
export class UnauthorizedError extends Error { /* ... */ }
export async function getCurrentUser(): Promise<{ id: string; email: string }>
```

From src/lib/similarity.ts (exports):
```typescript
export function analyzeSimilarity(
  targetWatch: Watch, collection: Watch[], preferences: UserPreferences
): SimilarityResult  // SimilarityResult.score is a number in [0,1]
export const GOAL_THRESHOLDS: Record<CollectionGoal, { coreFit: number; familiarTerritory: number; roleConflict: number }>
// GOAL_THRESHOLDS.balanced = { coreFit: 0.65, familiarTerritory: 0.45, roleConflict: 0.70 }
export function detectLoyalBrands(owned: Watch[]): string[]
```

From src/lib/stats.ts (exports):
```typescript
export interface DistributionRow { label: string; count: number; percentage: number }
export function styleDistribution(watches: Watch[]): DistributionRow[]
export function roleDistribution(watches: Watch[]): DistributionRow[]
```

From src/lib/tasteTags.ts:
```typescript
export interface TasteTagInput { watches: Watch[]; totalWearEvents: number; collectionAgeDays: number }
export function computeTasteTags(input: TasteTagInput): string[]  // returns up to 3 tags
```

From src/data/profiles.ts (existing — DO NOT MODIFY):
```typescript
export async function getProfileByUsername(username: string): Promise<{ id, username, displayName, bio, avatarUrl, createdAt, updatedAt } | null>
export async function getProfileById(userId: string): Promise<{ id, username, ... } | null>
export async function getProfileSettings(userId: string): Promise<ProfileSettings>  // defaults to all-public
export async function getFollowerCounts(userId: string): Promise<{ followers: number; following: number }>
```

From src/data/watches.ts (existing):
```typescript
export async function getWatchesByUser(userId: string): Promise<Watch[]>
```

From src/data/preferences.ts (existing):
```typescript
export async function getPreferencesByUser(userId: string): Promise<UserPreferences>  // returns defaults when no row
```

From `react` (Next.js 16 App Router built-in):
```typescript
// Per-request memoization — scope is a single render pass. Different requests get
// different cache stores. Preserves CONTEXT.md D-03 "compute on every render, no cache
// across renders" while eliminating redundant work inside one render.
import { cache } from 'react'
// cache<F extends (...args: any[]) => any>(fn: F): F
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Wave 0 — write failing tests for all Phase 9 library/DAL/action behaviors</name>
  <files>tests/lib/tasteOverlap.test.ts, tests/data/follows.test.ts, tests/actions/follows.test.ts</files>
  <read_first>
    - .planning/phases/09-follow-system-collector-profiles/09-VALIDATION.md (sampling strategy, Wave 0 requirements)
    - .planning/phases/09-follow-system-collector-profiles/09-RESEARCH.md (Validation Architecture section, lines ~820-860)
    - tests/setup.ts (existing global test setup)
    - tests/shims/server-only.ts (server-only shim for vitest jsdom env)
    - tests/data/profiles.test.ts (precedent for DAL tests with `vi.mock('@/db')` chain mock)
    - tests/actions/watches.test.ts (precedent for Server Action tests with auth + Zod validation; shows `vi.mock('next/cache')` for revalidatePath spy)
    - tests/lib/tasteTags.test.ts (precedent for pure-function unit tests with Watch factory)
    - vitest.config.ts (confirms jsdom env, setup files, and server-only alias)
  </read_first>
  <behavior>
    Create three test files with failing-first tests. All tests fail until the Task 2/3/4 implementations land. Each test must map directly to a must_have truth.

    tests/lib/tasteOverlap.test.ts — covers PROF-09:
    - `returns sharedWatches via case-insensitive brand+model match` — input viewer with watch {brand:'Rolex ', model:'Submariner'}, owner with {brand:'rolex', model:'submariner'} → expects sharedWatches.length === 1
    - `returns sharedWatches of length 0 when no pair matches`
    - `sharedTasteTags is the intersection of viewer.tasteTags and owner.tasteTags preserving viewer order`
    - `overlapLabel === 'Strong overlap' when average similarity >= GOAL_THRESHOLDS.balanced.coreFit (0.65)` — feed viewer+owner collections with 3 near-identical Subs
    - `overlapLabel === 'Some overlap' when average similarity is in [0.45, 0.65)` — GOAL_THRESHOLDS.balanced.familiarTerritory = 0.45
    - `overlapLabel === 'Different taste' when average similarity < 0.45 OR when viewer has zero owned watches`
    - `returns empty sharedStyleRows and sharedRoleRows when either side has fewer than 3 owned watches`
    - `returns sharedStyleRows with { label, viewerPct, ownerPct } when both sides have >=3 owned watches`
    - `viewer with zero owned watches: sharedWatches=[], sharedTasteTags=intersection, overlapLabel='Different taste' (D-05)`
    - `owner with zero owned watches: sharedWatches=[], overlapLabel='Different taste'`
    - `filters non-owned watches from intersection (status='wishlist' should NOT create a sharedWatch entry)`

    tests/data/follows.test.ts — covers FOLL-01/FOLL-02/FOLL-03/FOLL-04. Use the `vi.mock('@/db')` chain mock precedent from tests/data/profiles.test.ts.
    - `followUser DAL calls db.insert(follows).values({followerId, followingId}).onConflictDoNothing()` — verify the chain
    - `unfollowUser DAL builds a DELETE with WHERE follower_id=X AND following_id=Y`
    - `isFollowing returns true when a row exists, false otherwise`
    - `getFollowersForProfile SQL includes JOIN on profiles and profile_settings, GROUP BY follower_id, ORDER BY follows.created_at DESC`
    - `getFollowingForProfile mirrors the shape but swaps follower_id <-> following_id`
    - `getTasteOverlapData returns { viewer, owner } in a single call with each side carrying { watches, preferences, tasteTags }`
    - `getTasteOverlapData is React.cache()-wrapped` — verify via `import * as React from 'react'; vi.spyOn(React, 'cache')` OR by grep-level assertion `typeof getTasteOverlapData.toString() === 'function'` with a comment noting the behavior is tested through module structure

    tests/actions/follows.test.ts — covers FOLL-01/FOLL-02/FOLL-03 at the action boundary. Mock `@/lib/auth` and `@/data/follows` per tests/actions/watches.test.ts precedent, AND mock `next/cache` for the revalidatePath spy.
    - `followUser action returns { success: false, error: 'Not authenticated' } when getCurrentUser throws UnauthorizedError`
    - `followUser rejects non-UUID userId with { success: false, error: 'Invalid request' }`
    - `followUser rejects self-follow: user.id === userId returns { success: false, error: 'Cannot follow yourself' } and DOES NOT call DAL`
    - `followUser rejects extra keys via .strict(): { userId: '...', role: 'admin' } fails Zod parse`
    - `followUser on success calls followsDAL.followUser(user.id, userId) then revalidatePath('/u/[username]', 'layout')` — spy on `revalidatePath` from next/cache mock, assert it is called exactly once per successful `followUser` invocation with the EXACT arguments `('/u/[username]', 'layout')` (FOLL-03 end-to-end reconciliation path)
    - `unfollowUser on success calls followsDAL.unfollowUser(user.id, userId) then revalidatePath('/u/[username]', 'layout')` — mirror assertion to pin the unfollow side of FOLL-03
    - `followUser swallows duplicate-key error from DAL (idempotent) returning { success: true }`
    - `unfollowUser has identical auth/Zod/revalidation semantics`
  </behavior>
  <action>
Create three test files exactly at the paths listed in <files>.

For tests/lib/tasteOverlap.test.ts: write pure-function unit tests. NO mocks needed — `computeTasteOverlap` is a pure function. Create Watch fixture factory (copy the `w(overrides)` pattern from tests/lib/tasteTags.test.ts). Required fixtures: two watches differing only by whitespace/case for the normalization test; a Watch array of 4 Rolex Submariners (all owned, identical styleTags/roleTags/designTraits) for the "Strong overlap" test; a UserPreferences literal with `overlapTolerance: 'medium', collectionGoal: 'balanced'`. Import GOAL_THRESHOLDS from '@/lib/similarity' in the test to compute the thresholds dynamically (so tests stay aligned if thresholds change).

For tests/data/follows.test.ts: follow the tests/data/profiles.test.ts precedent — `vi.mock('@/db')` with a chainable mock. Declare `let mockRows: unknown[] = []` at the top and reset in `beforeEach`. Mock `db.insert`, `db.delete`, `db.select` as thenable chains. Capture the arguments passed to `db.select().from().where().orderBy()` to assert SQL shape via spy/recording.

For tests/actions/follows.test.ts: follow the tests/actions/watches.test.ts precedent — `vi.mock('@/lib/auth')` to control getCurrentUser return vs. throw; `vi.mock('@/data/follows')` to stub DAL functions; `vi.mock('next/cache')` to spy on revalidatePath. Import `followUser, unfollowUser` from '@/app/actions/follows' inside the test file AFTER the mocks are declared.

Test structure for the FOLL-03 revalidate spy (critical for end-to-end coverage):
```typescript
import { revalidatePath } from 'next/cache'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

it('calls revalidatePath(/u/[username], layout) on successful followUser', async () => {
  ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: 'viewer-uuid', email: 'v@example.com' })
  ;(followsDAL.followUser as Mock).mockResolvedValueOnce(undefined)
  const result = await followUser({ userId: '00000000-0000-0000-0000-000000000001' })
  expect(result.success).toBe(true)
  expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/u/[username]', 'layout')
})

it('calls revalidatePath(/u/[username], layout) on successful unfollowUser', async () => {
  ;(getCurrentUser as Mock).mockResolvedValueOnce({ id: 'viewer-uuid', email: 'v@example.com' })
  ;(followsDAL.unfollowUser as Mock).mockResolvedValueOnce(undefined)
  await unfollowUser({ userId: '00000000-0000-0000-0000-000000000001' })
  expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/u/[username]', 'layout')
})
```

Every test MUST fail on first run (RED) since Tasks 2/3/4 have not yet landed. Commit message MUST be `test(09-01): add failing tests for follows DAL, actions, and tasteOverlap` per TDD RED commit convention.

After writing the tests, run: `npx vitest run tests/lib/tasteOverlap.test.ts tests/data/follows.test.ts tests/actions/follows.test.ts --reporter=dot`. Expected output: all three files fail with either "Cannot find module '@/lib/tasteOverlap'" / "'@/data/follows'" / "'@/app/actions/follows'" OR with assertion failures. Document the red state in the commit body.
  </action>
  <verify>
    <automated>npx vitest run tests/lib/tasteOverlap.test.ts tests/data/follows.test.ts tests/actions/follows.test.ts --reporter=dot 2>&1 | tee /tmp/09-01-t1.log; grep -E "(FAIL|Test Files .*failed)" /tmp/09-01-t1.log</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/lib/tasteOverlap.test.ts` exists and contains `describe('computeTasteOverlap'` (grep): `grep -c "describe('computeTasteOverlap'" tests/lib/tasteOverlap.test.ts` returns `>= 1`
    - File `tests/data/follows.test.ts` exists and contains `describe('follows DAL'` OR `describe('followUser DAL'`: `grep -cE "describe\\('(follows DAL|followUser DAL)'" tests/data/follows.test.ts` returns `>= 1`
    - File `tests/actions/follows.test.ts` exists and contains `describe('followUser'`: `grep -c "describe('followUser'" tests/actions/follows.test.ts` returns `>= 1`
    - tests/lib/tasteOverlap.test.ts contains test cases referencing all three label literals: `grep -c "'Strong overlap'" tests/lib/tasteOverlap.test.ts >= 1`, `grep -c "'Some overlap'" tests/lib/tasteOverlap.test.ts >= 1`, `grep -c "'Different taste'" tests/lib/tasteOverlap.test.ts >= 1`
    - tests/lib/tasteOverlap.test.ts contains normalization test with whitespace/case fixture: `grep -c "Rolex " tests/lib/tasteOverlap.test.ts >= 1` AND `grep -ic "rolex.*submariner" tests/lib/tasteOverlap.test.ts >= 1`
    - tests/actions/follows.test.ts contains a self-follow rejection test: `grep -c "Cannot follow yourself" tests/actions/follows.test.ts >= 1`
    - tests/actions/follows.test.ts contains a strict-Zod test case covering extra keys
    - tests/actions/follows.test.ts mocks next/cache and asserts revalidatePath on both follow and unfollow paths: `grep -c "vi.mock('next/cache'" tests/actions/follows.test.ts >= 1` AND `grep -cE "revalidatePath.*'/u/\\[username\\]'.*'layout'" tests/actions/follows.test.ts >= 2`
    - Running the three test files exits non-zero (RED state — tests must fail before implementation): `npx vitest run tests/lib/tasteOverlap.test.ts tests/data/follows.test.ts tests/actions/follows.test.ts --reporter=dot; echo $?` returns non-zero
  </acceptance_criteria>
  <done>All three test files exist with complete test bodies, each test file imports from `@/lib/tasteOverlap` / `@/data/follows` / `@/app/actions/follows`, tests/actions/follows.test.ts includes revalidatePath spy assertions on both follow and unfollow, running vitest on these files exits non-zero (RED), commit message is `test(09-01): add failing tests for follows DAL, actions, and tasteOverlap`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement follows DAL + tasteOverlap library to make Task 1 tests pass (GREEN)</name>
  <files>src/data/follows.ts, src/lib/tasteOverlap.ts</files>
  <read_first>
    - src/data/follows.ts (verify does NOT yet exist — `ls src/data/follows.ts` should fail)
    - src/data/profiles.ts (existing DAL patterns: `import 'server-only'`, `db` chain usage, Promise.all for parallel queries)
    - src/data/wearEvents.ts (pattern for `onConflictDoNothing` — lines 13-17, and `inArray` with static import at top)
    - src/data/watches.ts (pattern for row→domain mapping)
    - src/db/schema.ts (lines 144-166 for follows / profiles / profileSettings shapes)
    - src/lib/similarity.ts (public exports: analyzeSimilarity, GOAL_THRESHOLDS, detectLoyalBrands — verify `'use client'` is absent, confirming server-safe)
    - src/lib/stats.ts (styleDistribution, roleDistribution signatures)
    - src/lib/tasteTags.ts (computeTasteTags signature — consumed by `getTasteOverlapData` DAL)
    - tests/lib/tasteOverlap.test.ts (written in Task 1 — implementation must pass these assertions verbatim)
    - tests/data/follows.test.ts (written in Task 1 — DAL functions must match this SQL shape)
    - .planning/phases/09-follow-system-collector-profiles/09-RESEARCH.md (Pattern 4 lines ~306-365 for tasteOverlap shape; "Follower list fetches N+1" Pitfall 7 ~lines 556-564)
  </read_first>
  <action>
Create `src/data/follows.ts`. First line: `import 'server-only'`. Export the following Drizzle-backed functions. Use `import { db } from '@/db'` and `import { follows, profiles, profileSettings, watches } from '@/db/schema'`. Also import React's `cache` helper — `import { cache } from 'react'` — for per-request memoization of `getTasteOverlapData` (see Step: wrap with cache at the end of the file).

```typescript
// followUser: idempotent insert via onConflictDoNothing (D-10; unique pair constraint on follower_id+following_id)
export async function followUser(followerId: string, followingId: string): Promise<void>

// unfollowUser: DELETE WHERE follower_id = followerId AND following_id = followingId (D-21)
export async function unfollowUser(followerId: string, followingId: string): Promise<void>

// isFollowing: SELECT id FROM follows WHERE follower_id=followerId AND following_id=followingId LIMIT 1; returns rows.length > 0
export async function isFollowing(followerId: string, followingId: string): Promise<boolean>
```

For follower/following lists (D-12, D-13), write SINGLE-QUERY joins (Pitfall 7 — no N+1). Interface:

```typescript
export interface FollowerListEntry {
  userId: string            // follows.followerId (for /followers) or follows.followingId (for /following)
  username: string          // profiles.username
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  profilePublic: boolean    // for visibility gating per D-21
  watchCount: number        // count of watches where status='owned'
  wishlistCount: number     // count of watches where status IN ('wishlist','grail')
  followedAt: string        // follows.createdAt ISO string — displayed only on /followers per UI-SPEC
}

// getFollowersForProfile: returns all followers of userId, ordered by follows.created_at DESC (D-13)
// Single query: JOIN follows ON follows.follower_id = profiles.id
//               LEFT JOIN profile_settings ON profile_settings.user_id = profiles.id
//               LEFT JOIN aggregate subquery for watchCount/wishlistCount grouped by watches.user_id
//               WHERE follows.following_id = $userId
//               ORDER BY follows.created_at DESC
export async function getFollowersForProfile(userId: string): Promise<FollowerListEntry[]>

// getFollowingForProfile: mirrors getFollowersForProfile but follows.follower_id = $userId
// returns the profiles followed BY userId
export async function getFollowingForProfile(userId: string): Promise<FollowerListEntry[]>
```

Implementation sketch for `getFollowersForProfile`:
```typescript
import { db } from '@/db'
import { follows, profiles, profileSettings, watches } from '@/db/schema'
import { eq, and, sql, desc, inArray } from 'drizzle-orm'

export async function getFollowersForProfile(userId: string): Promise<FollowerListEntry[]> {
  // Step 1: resolve follower ids with timestamps (ordered).
  const followerRows = await db
    .select({
      userId: follows.followerId,
      followedAt: follows.createdAt,
    })
    .from(follows)
    .where(eq(follows.followingId, userId))
    .orderBy(desc(follows.createdAt))

  if (followerRows.length === 0) return []
  const followerIds = followerRows.map((r) => r.userId)

  // Step 2: batch-fetch profiles + settings in one query each.
  const [profileRows, settingRows, watchRows] = await Promise.all([
    db.select().from(profiles).where(inArray(profiles.id, followerIds)),
    db.select().from(profileSettings).where(inArray(profileSettings.userId, followerIds)),
    db
      .select({
        userId: watches.userId,
        watchCount: sql<number>`count(*) FILTER (WHERE ${watches.status} = 'owned')::int`,
        wishlistCount: sql<number>`count(*) FILTER (WHERE ${watches.status} IN ('wishlist','grail'))::int`,
      })
      .from(watches)
      .where(inArray(watches.userId, followerIds))
      .groupBy(watches.userId),
  ])

  // Step 3: merge by userId, preserving followerRows order (DESC).
  const profileById = new Map(profileRows.map((p) => [p.id, p]))
  const settingsById = new Map(settingRows.map((s) => [s.userId, s]))
  const watchById = new Map(watchRows.map((w) => [w.userId, w]))

  return followerRows.flatMap((row) => {
    const p = profileById.get(row.userId); if (!p) return []
    const s = settingsById.get(row.userId)
    const w = watchById.get(row.userId)
    return [{
      userId: row.userId,
      username: p.username,
      displayName: p.displayName,
      bio: p.bio,
      avatarUrl: p.avatarUrl,
      profilePublic: s?.profilePublic ?? true,
      watchCount: w?.watchCount ?? 0,
      wishlistCount: w?.wishlistCount ?? 0,
      followedAt: row.followedAt.toISOString(),
    }]
  })
}
```

Also add the Common Ground data loader, **wrapped in React `cache()`** for per-request memoization (Warning 5 remediation: layout.tsx and [tab]/page.tsx in Plan 04 both invoke this function; `cache()` ensures a single render pass hits the database once. Per-render-cycle only — across different requests each gets a fresh store, preserving D-03 "no cache across renders"):

```typescript
// getTasteOverlapData: loads both users' watches + preferences + tasteTags in parallel
// so src/lib/tasteOverlap.ts receives everything it needs without additional DAL roundtrips.
// Called by layout.tsx AND [tab]/page.tsx in Plan 04 — `cache()` memoizes within a
// single request so the double invocation is a single DB trip. Across requests, no cache.
import { cache } from 'react'
import { getWatchesByUser } from './watches'
import { getPreferencesByUser } from './preferences'
import { getAllWearEventsByUser } from './wearEvents'
import { computeTasteTags } from '@/lib/tasteTags'
import type { Watch, UserPreferences } from '@/lib/types'

export interface TasteOverlapData {
  viewer: { watches: Watch[]; preferences: UserPreferences; tasteTags: string[] }
  owner:  { watches: Watch[]; preferences: UserPreferences; tasteTags: string[] }
}

async function _getTasteOverlapDataImpl(viewerId: string, ownerId: string): Promise<TasteOverlapData> {
  const [viewerWatches, viewerPrefs, viewerWears, ownerWatches, ownerPrefs, ownerWears] = await Promise.all([
    getWatchesByUser(viewerId),
    getPreferencesByUser(viewerId),
    getAllWearEventsByUser(viewerId),
    getWatchesByUser(ownerId),
    getPreferencesByUser(ownerId),
    getAllWearEventsByUser(ownerId),
  ])
  // collectionAgeDays computation mirrors layout.tsx (default 30 if unknown).
  const ageDays = (w: Watch[]) => {
    const earliest = w.map((x) => x.acquisitionDate).filter((d): d is string => Boolean(d)).sort()[0]
    if (!earliest) return 30
    return Math.max(1, Math.floor((Date.now() - new Date(earliest).getTime()) / 86_400_000))
  }
  return {
    viewer: {
      watches: viewerWatches, preferences: viewerPrefs,
      tasteTags: computeTasteTags({ watches: viewerWatches, totalWearEvents: viewerWears.length, collectionAgeDays: ageDays(viewerWatches) }),
    },
    owner: {
      watches: ownerWatches, preferences: ownerPrefs,
      tasteTags: computeTasteTags({ watches: ownerWatches, totalWearEvents: ownerWears.length, collectionAgeDays: ageDays(ownerWatches) }),
    },
  }
}

// Wrap with React cache() for per-request memoization.
// Scope is a single render pass. Different requests get different caches.
// This is compatible with CONTEXT.md D-03 "compute on every render, no cache
// across renders" because cache() does NOT persist across requests.
export const getTasteOverlapData = cache(_getTasteOverlapDataImpl)
```

Create `src/lib/tasteOverlap.ts`. NO `'server-only'` directive (pure function — must be unit-testable under jsdom; matches `src/lib/similarity.ts` precedent). Export:

```typescript
import type { Watch, UserPreferences } from '@/lib/types'
import { analyzeSimilarity, GOAL_THRESHOLDS } from '@/lib/similarity'
import { styleDistribution, roleDistribution } from '@/lib/stats'

export interface SharedWatchEntry {
  brand: string
  model: string
  viewerWatch: Watch   // the viewer's instance (has their acquisitionDate, pricePaid, etc.)
  ownerWatch: Watch    // the owner's instance (rendered in Common Ground shared grid — owner's image)
}

export interface SharedDistributionRow {
  label: string
  viewerPct: number   // 0-100
  ownerPct: number    // 0-100
}

export interface TasteOverlapResult {
  sharedWatches: SharedWatchEntry[]
  sharedTasteTags: string[]
  overlapLabel: 'Strong overlap' | 'Some overlap' | 'Different taste'
  sharedStyleRows: SharedDistributionRow[]   // only filled when BOTH sides have >= 3 owned watches
  sharedRoleRows: SharedDistributionRow[]
  hasAny: boolean   // true iff sharedWatches.length > 0 OR sharedTasteTags.length > 0
}

interface OverlapInput {
  watches: Watch[]
  preferences: UserPreferences
  tasteTags: string[]
}

export function computeTasteOverlap(viewer: OverlapInput, owner: OverlapInput): TasteOverlapResult {
  // 1. Normalize brand+model pairs for case/whitespace-insensitive intersection (D-01, Pitfall 2)
  const norm = (w: Watch) => `${w.brand.trim().toLowerCase()}|${w.model.trim().toLowerCase()}`
  const viewerOwned = viewer.watches.filter((w) => w.status === 'owned')
  const ownerOwned  = owner.watches.filter((w) => w.status === 'owned')
  const ownerByKey = new Map(ownerOwned.map((w) => [norm(w), w]))
  const sharedWatches: SharedWatchEntry[] = viewerOwned
    .filter((v) => ownerByKey.has(norm(v)))
    .map((v) => ({
      brand: v.brand, model: v.model,
      viewerWatch: v, ownerWatch: ownerByKey.get(norm(v))!,
    }))

  // 2. Shared taste tags (case-sensitive — computeTasteTags produces canonical strings)
  const sharedTasteTags = viewer.tasteTags.filter((t) => owner.tasteTags.includes(t))

  // 3. Overlap label — derive from avg similarity (viewer's watches vs. owner's collection).
  //    Thresholds anchored to GOAL_THRESHOLDS.balanced (D-03 + Assumptions Log A2).
  const thresholds = GOAL_THRESHOLDS.balanced  // { coreFit: 0.65, familiarTerritory: 0.45, roleConflict: 0.70 }
  let overlapLabel: TasteOverlapResult['overlapLabel'] = 'Different taste'
  if (viewerOwned.length > 0 && ownerOwned.length > 0) {
    const scores = viewerOwned.map((vw) =>
      analyzeSimilarity(vw, ownerOwned, viewer.preferences).score
    )
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    if (avg >= thresholds.coreFit) overlapLabel = 'Strong overlap'
    else if (avg >= thresholds.familiarTerritory) overlapLabel = 'Some overlap'
    // else stays 'Different taste'
  }
  // D-05: viewer with zero owned → overlapLabel='Different taste' (already handled above).

  // 4. Shared style + role distributions (side-by-side). Only when BOTH sides >=3 owned.
  let sharedStyleRows: SharedDistributionRow[] = []
  let sharedRoleRows: SharedDistributionRow[] = []
  if (viewerOwned.length >= 3 && ownerOwned.length >= 3) {
    const viewerStyles = styleDistribution(viewerOwned)
    const ownerStyles  = styleDistribution(ownerOwned)
    const viewerRoles  = roleDistribution(viewerOwned)
    const ownerRoles   = roleDistribution(ownerOwned)

    const zip = (a: typeof viewerStyles, b: typeof ownerStyles): SharedDistributionRow[] => {
      const byLabel = new Map<string, SharedDistributionRow>()
      for (const r of a) byLabel.set(r.label, { label: r.label, viewerPct: r.percentage, ownerPct: 0 })
      for (const r of b) {
        const existing = byLabel.get(r.label)
        if (existing) existing.ownerPct = r.percentage
        else byLabel.set(r.label, { label: r.label, viewerPct: 0, ownerPct: r.percentage })
      }
      return [...byLabel.values()].sort((x, y) => (y.viewerPct + y.ownerPct) - (x.viewerPct + x.ownerPct))
    }

    sharedStyleRows = zip(viewerStyles, ownerStyles)
    sharedRoleRows  = zip(viewerRoles, ownerRoles)
  }

  const hasAny = sharedWatches.length > 0 || sharedTasteTags.length > 0

  return { sharedWatches, sharedTasteTags, overlapLabel, sharedStyleRows, sharedRoleRows, hasAny }
}
```

Document the chosen thresholds (`GOAL_THRESHOLDS.balanced.coreFit = 0.65` → Strong; `>= 0.45` → Some; else Different) in a JSDoc comment above `computeTasteOverlap`. Rationale: aligns with the similarity engine's calibrated "core fit" and "familiar territory" concepts, so Common Ground labels track any future re-tuning of the similarity weights.

After writing implementation, run the Task 1 tests to verify GREEN.

Commit message: `feat(09-01): follows DAL + tasteOverlap library (FOLL-01..04, PROF-09)`.
  </action>
  <verify>
    <automated>npx vitest run tests/lib/tasteOverlap.test.ts tests/data/follows.test.ts --reporter=dot 2>&1 | tee /tmp/09-01-t2.log; grep -qE "Test Files .*passed" /tmp/09-01-t2.log && grep -qE "0 failed" /tmp/09-01-t2.log</automated>
  </verify>
  <acceptance_criteria>
    - File `src/data/follows.ts` exists with `import 'server-only'` on line 1: `head -1 src/data/follows.ts` outputs `import 'server-only'`
    - `src/data/follows.ts` exports every required function: `grep -cE "^export (async )?function (followUser|unfollowUser|isFollowing|getFollowersForProfile|getFollowingForProfile)\\b|^export const getTasteOverlapData\\b" src/data/follows.ts >= 6`
    - `src/data/follows.ts` imports React `cache`: `grep -cE "import \\{ cache \\} from 'react'" src/data/follows.ts >= 1`
    - `src/data/follows.ts` exports `getTasteOverlapData` as a `cache()`-wrapped value: `grep -cE "^export const getTasteOverlapData = cache\\(" src/data/follows.ts >= 1`
    - `src/data/follows.ts` uses `onConflictDoNothing` for idempotent follow: `grep -c "onConflictDoNothing" src/data/follows.ts >= 1`
    - `src/data/follows.ts` orders follower lists by `desc(follows.createdAt)`: `grep -cE "desc\\(follows\\.createdAt\\)" src/data/follows.ts >= 2` (once for followers, once for following)
    - `src/data/follows.ts` does NOT contain a per-follower-id loop (no N+1): `grep -cE "for.*(followerIds|followingIds).*await" src/data/follows.ts` returns `0`
    - `src/data/follows.ts` uses `inArray` for batch aggregate: `grep -c "inArray" src/data/follows.ts >= 1`
    - File `src/lib/tasteOverlap.ts` exists and exports `computeTasteOverlap` + `TasteOverlapResult`: `grep -cE "^export (function computeTasteOverlap|interface TasteOverlapResult)" src/lib/tasteOverlap.ts >= 2`
    - `src/lib/tasteOverlap.ts` does NOT contain `'server-only'` directive (must be pure, testable under jsdom): `grep -c "server-only" src/lib/tasteOverlap.ts` returns `0`
    - `src/lib/tasteOverlap.ts` normalizes brand+model with `.trim().toLowerCase()`: `grep -cE "\\.trim\\(\\)\\.toLowerCase\\(\\)" src/lib/tasteOverlap.ts >= 2`
    - `src/lib/tasteOverlap.ts` imports `analyzeSimilarity` and `GOAL_THRESHOLDS` from similarity module: `grep -c "from '@/lib/similarity'" src/lib/tasteOverlap.ts >= 1`
    - `src/lib/tasteOverlap.ts` outputs one of the three exact label literals (no other strings): `grep -cE "'Strong overlap'|'Some overlap'|'Different taste'" src/lib/tasteOverlap.ts >= 3`
    - `src/lib/tasteOverlap.ts` guards dual-bars on `>= 3` owned both sides: `grep -cE "\\.length >= 3" src/lib/tasteOverlap.ts >= 2` OR grep for matching guard
    - Running task 1 tests for DAL and tasteOverlap passes: `npx vitest run tests/lib/tasteOverlap.test.ts tests/data/follows.test.ts --reporter=dot` exits 0
    - Running `npx tsc --noEmit` produces no errors in the two new files: `npx tsc --noEmit 2>&1 | grep -E "(follows\\.ts|tasteOverlap\\.ts)" | wc -l` returns `0`
  </acceptance_criteria>
  <done>Both files compile under strict TS, pass all Task 1 unit tests (GREEN), `getTasteOverlapData` wrapped in React `cache()`, no 'server-only' on tasteOverlap.ts, no N+1 loop in follows.ts DAL, commit `feat(09-01): follows DAL + tasteOverlap library` landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement follow Server Actions + verify RLS policies (make action tests pass)</name>
  <files>src/app/actions/follows.ts</files>
  <read_first>
    - src/app/actions/follows.ts (verify does NOT yet exist — create fresh)
    - src/app/actions/profile.ts (precedent: 'use server', Zod `.strict()`, ActionResult, getCurrentUser gate, revalidatePath layout pattern)
    - src/app/actions/notes.ts (precedent: WR-07 revalidatePath('/u/[username]', 'layout') fix)
    - src/data/follows.ts (just created in Task 2 — action imports from here)
    - src/lib/actionTypes.ts (ActionResult<T> discriminated union)
    - src/lib/auth.ts (getCurrentUser + UnauthorizedError)
    - tests/actions/follows.test.ts (written in Task 1 — implementation must satisfy these assertions, including the revalidatePath spy on both follow + unfollow paths for FOLL-03)
    - supabase/migrations/20260420000001_social_tables_rls.sql (lines 15-20: follows RLS already exists in repo; verify applied via `supabase migration list --linked` or mark deferred)
    - .planning/phases/09-follow-system-collector-profiles/09-RESEARCH.md (Pattern 3 lines ~265-305 for ActionResult pattern; Security Domain section ~lines 862-903 for STRIDE checklist)
  </read_first>
  <action>
Create `src/app/actions/follows.ts`. First line: `'use server'`. Full file body:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as followsDAL from '@/data/follows'
import { getCurrentUser } from '@/lib/auth'
import type { ActionResult } from '@/lib/actionTypes'

// T-09-01 mass-assignment protection: .strict() rejects unknown keys.
// userId is the *target* user (the one being followed). followerId is NEVER
// accepted from client input — always derived from getCurrentUser() session.
const followSchema = z.object({ userId: z.string().uuid() }).strict()

export async function followUser(data: unknown): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = followSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  // D-10 + T-09-02: self-follow rejected at app layer.
  // The follows_insert_own RLS policy permits follower_id = auth.uid() → does NOT block self-follow.
  // Application-layer rejection is load-bearing here.
  if (parsed.data.userId === user.id) {
    return { success: false, error: 'Cannot follow yourself' }
  }

  try {
    // D-10 idempotent: DAL uses onConflictDoNothing. Duplicate pair = silent no-op.
    await followsDAL.followUser(user.id, parsed.data.userId)
    // FOLL-03 end-to-end count path: WR-07 carry-forward. Route template is
    // '/u/[username]', invalidate at 'layout' so ProfileHeader (via
    // getFollowerCounts) re-reads on next navigation. Spied in tests/actions/follows.test.ts.
    revalidatePath('/u/[username]', 'layout')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[followUser] unexpected error:', err)
    return { success: false, error: "Couldn't follow. Try again." }
  }
}

export async function unfollowUser(data: unknown): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = followSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  // Self-unfollow is also rejected for symmetry and to surface bugs early.
  if (parsed.data.userId === user.id) {
    return { success: false, error: 'Cannot unfollow yourself' }
  }

  try {
    await followsDAL.unfollowUser(user.id, parsed.data.userId)
    // FOLL-03 end-to-end count path mirror: revalidate the same layout slot on unfollow.
    revalidatePath('/u/[username]', 'layout')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[unfollowUser] unexpected error:', err)
    return { success: false, error: "Couldn't unfollow. Try again." }
  }
}
```

Verify the `follows` RLS policies are present in a migration: run `grep -c "follows_insert_own\|follows_delete_own\|follows_select_all" supabase/migrations/20260420000001_social_tables_rls.sql` — must be >= 3. If missing, the checker flags it and Plan 01 splits; current repo state has them so this is a pass-through verification.

Document in commit body: "RLS verification: follows_insert_own (WITH CHECK follower_id=auth.uid()), follows_delete_own (USING follower_id=auth.uid()), follows_select_all (public read). No new migration needed. Production application state verified separately in STATE.md per the deferred open question."

Commit: `feat(09-01): follow/unfollow Server Actions with Zod + self-follow rejection (FOLL-01, FOLL-02, FOLL-03)`.
  </action>
  <verify>
    <automated>npx vitest run tests/actions/follows.test.ts --reporter=dot 2>&1 | tee /tmp/09-01-t3.log; grep -qE "Test Files .*passed" /tmp/09-01-t3.log &amp;&amp; grep -qE "0 failed" /tmp/09-01-t3.log</automated>
  </verify>
  <acceptance_criteria>
    - File `src/app/actions/follows.ts` exists with `'use server'` on line 1: `head -1 src/app/actions/follows.ts` outputs `'use server'`
    - Exports both `followUser` and `unfollowUser`: `grep -cE "^export async function (followUser|unfollowUser)\\b" src/app/actions/follows.ts` returns `2`
    - Uses Zod `.strict()`: `grep -c "\\.strict()" src/app/actions/follows.ts >= 1`
    - Rejects self-follow with exact error string: `grep -c "'Cannot follow yourself'" src/app/actions/follows.ts >= 1`
    - Calls `getCurrentUser()` on entry of both actions: `grep -c "await getCurrentUser()" src/app/actions/follows.ts >= 2`
    - Uses `revalidatePath('/u/[username]', 'layout')` (not 'page') on BOTH action success paths (FOLL-03 end-to-end): `grep -cE "revalidatePath\\('/u/\\[username\\]', 'layout'\\)" src/app/actions/follows.ts >= 2`
    - Imports DAL as namespace: `grep -c "import \\* as followsDAL" src/app/actions/follows.ts >= 1`
    - Returns `ActionResult<void>` shape: `grep -cE "Promise<ActionResult" src/app/actions/follows.ts >= 2`
    - NO client-supplied followerId (only derived from session): `grep -c "followerId.*data\\." src/app/actions/follows.ts` returns `0`
    - follows RLS policies present in repo: `grep -cE "(follows_insert_own|follows_delete_own|follows_select_all)" supabase/migrations/20260420000001_social_tables_rls.sql >= 3`
    - All Task 1 action tests pass (including the revalidatePath spy assertions): `npx vitest run tests/actions/follows.test.ts --reporter=dot` exits 0
    - Full test suite still passes: `npx vitest run --reporter=dot` exits 0
    - `npx tsc --noEmit` reports no errors touching `src/app/actions/follows.ts`: `npx tsc --noEmit 2>&1 | grep "src/app/actions/follows.ts" | wc -l` returns `0`
  </acceptance_criteria>
  <done>Both Server Actions pass unit tests (including revalidatePath spies on both follow + unfollow paths), TypeScript strict mode clean, RLS policies verified in migration file, commit landed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → Server Action | followUser / unfollowUser POSTs cross the unauthenticated boundary; Zod + getCurrentUser() enforce authorization server-side |
| DAL → Postgres | Drizzle via DATABASE_URL uses a service-role connection that bypasses RLS (documented in supabase/migrations/20260420000000_rls_existing_tables.sql) — DAL code is the sole authorization gate for service-role queries |
| Third-party fetch → anon key path | Direct Supabase anon-key queries MUST be blocked by RLS on follows table (follows_insert_own, follows_delete_own) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-01 | Spoofing / Tampering | `followUser` Server Action — client-supplied followerId used as caller identity | mitigate | followerId is derived exclusively from `getCurrentUser().id`; Zod schema accepts only `userId` (the target). Client-supplied `followerId` keys are rejected by `.strict()`. |
| T-09-02 | Tampering / Repudiation | Self-follow to inflate own follower count | mitigate | Server Action rejects `parsed.data.userId === user.id` with `'Cannot follow yourself'` before DAL call. Verified by test `tests/actions/follows.test.ts`. |
| T-09-03 | Tampering | IDOR on unfollow — deleting another user's follow row | mitigate | DAL DELETE is scoped `WHERE follower_id = $viewerSessionId AND following_id = $targetId`. RLS belt-and-suspenders: `follows_delete_own` requires `follower_id = (SELECT auth.uid())`. |
| T-09-04 | Denial of Service | Duplicate-key race on rapid Follow clicks | mitigate | `follows_unique_pair` UNIQUE constraint + `onConflictDoNothing()` → race-safe, no throw. Idempotent by design. |
| T-09-05 | Information Disclosure | Mass-assignment via unexpected payload keys (e.g., role, followerId) | mitigate | Zod `.strict()` on the follow schema rejects any extra keys. |
| T-09-06 | Information Disclosure | Enumerating private users via `getFollowersForProfile` output leak | accept | Follow graph is public by D-21 — listing usernames is by product design. Per-row watch counts in the response respect the owner's `collection_public` at render time in Plan 03 (UI layer, not DAL — documented as accepted risk since usernames + watch counts are low-sensitivity). |
| T-09-07 | Information Disclosure | DAL bypassing RLS returns data even if anon-key would be blocked | accept | Drizzle service-role bypass is documented architectural choice (supabase/migrations/20260420000000_rls_existing_tables.sql:6-8). DAL functions are the sole app-layer gate. Every DAL in this plan receives viewerId/ownerId explicitly — no callers trust `auth.uid()` context inside the SQL. |
| T-09-08 | Information Disclosure | Leaking full owner collection through tasteOverlap client payload | mitigate | `computeTasteOverlap` runs server-side only (no `'use client'` on the file; never imported into Client Components). Only the `TasteOverlapResult` object (aggregated label + shared watches + shared tags + distributions) is serialized to the client — not raw `owner.watches`. Verified in Plan 04 by grepping the consumers. |
| T-09-09 | Tampering | Whitespace/case variant watches fooling intersection | mitigate | `norm(w) = brand.trim().toLowerCase() + '|' + model.trim().toLowerCase()` in `computeTasteOverlap`. Unit test in `tests/lib/tasteOverlap.test.ts` pins this behavior with a `'Rolex '` vs `'rolex'` fixture. |
</threat_model>

<verification>
After all three tasks commit:

1. Full test suite: `npx vitest run --reporter=dot` — all tests green including the three new files.
2. TypeScript strict mode: `npx tsc --noEmit` — zero errors.
3. ESLint on new files: `npx eslint src/data/follows.ts src/app/actions/follows.ts src/lib/tasteOverlap.ts` — zero warnings/errors.
4. Verify no UI file consumes `src/data/follows.ts` or `src/app/actions/follows.ts` yet (Wave 1 is data-layer-only): `grep -rE "from '@/data/follows'|from '@/app/actions/follows'" src/components src/app | wc -l` returns 0.
5. Confirm `src/lib/tasteOverlap.ts` is never imported from a Client Component (no 'use client' file imports it): `grep -l "'use client'" src/ -r | xargs grep -l "from '@/lib/tasteOverlap'" 2>/dev/null | wc -l` returns 0.
6. Confirm `follows` RLS policies still present and unchanged: `grep -cE "(follows_insert_own|follows_delete_own|follows_select_all)" supabase/migrations/20260420000001_social_tables_rls.sql` returns 3.
7. Confirm `getTasteOverlapData` is `cache()`-wrapped: `grep -cE "^export const getTasteOverlapData = cache\\(" src/data/follows.ts` returns 1.
</verification>

<success_criteria>
- `followUser` Server Action inserts into `follows` table idempotently; self-follow rejected at app layer; unauth callers get `Not authenticated`; unknown payload keys rejected via Zod `.strict()`; on success, `revalidatePath('/u/[username]', 'layout')` is called exactly once (pinned by test — FOLL-03 end-to-end).
- `unfollowUser` Server Action deletes the row with `WHERE follower_id = user.id AND following_id = $target`; unauth + Zod failure handled identically to followUser; on success, `revalidatePath('/u/[username]', 'layout')` is called exactly once (pinned by test — FOLL-03 end-to-end).
- `isFollowing(followerId, followingId)` returns boolean, used by Plan 02 ProfileHeader fetch to hydrate initial button state.
- `getFollowersForProfile(userId)` and `getFollowingForProfile(userId)` return list of FollowerListEntry in ORDER BY follows.created_at DESC; queries are NOT N+1 (batched joins via inArray).
- `getFollowerCounts(userId)` continues to work (existing DAL from Phase 7/8 — unchanged; no denormalized counts added).
- `getTasteOverlapData(viewerId, ownerId)` loads both users' watches + prefs + tasteTags in parallel, wrapped in React `cache()` so concurrent callers within a single render pass (layout + common-ground tab page) share one DB roundtrip; across requests no state is retained (D-03 preserved).
- `computeTasteOverlap(viewer, owner)` pure function:
  - Returns `sharedWatches` via case/whitespace-normalized (brand, model) intersection — only entries where both users have status='owned'.
  - Returns `sharedTasteTags` as intersection of tasteTags arrays.
  - Returns `overlapLabel` as one of the three exact string literals `'Strong overlap' | 'Some overlap' | 'Different taste'` derived from average similarity scores against `GOAL_THRESHOLDS.balanced` (>= 0.65 → Strong, >= 0.45 → Some, else Different).
  - Returns `sharedStyleRows` and `sharedRoleRows` only when both sides have >= 3 owned watches; empty arrays otherwise.
  - Returns `hasAny: boolean` used by Plan 04 to gate the hero band and 6th tab.
  - Handles `viewer.watches.length === 0` per D-05: returns `sharedWatches=[]`, preserves tag intersection, label='Different taste'.
- All Wave 0 tests (three files, 20+ test cases) pass green, pinning the behaviors above.
</success_criteria>

<output>
After completion, create `.planning/phases/09-follow-system-collector-profiles/09-01-SUMMARY.md` with:
- Files created: src/data/follows.ts, src/app/actions/follows.ts, src/lib/tasteOverlap.ts
- Test files created: tests/lib/tasteOverlap.test.ts, tests/data/follows.test.ts, tests/actions/follows.test.ts
- Test count and green status (note: the revalidatePath spy assertions on both follow + unfollow paths pin the FOLL-03 end-to-end reconciliation)
- Public API signatures (copy the exported types + function signatures — Plans 02/03/04 read this SUMMARY to wire up consumers); note that `getTasteOverlapData` is exported as a React `cache()`-wrapped function (still callable as an async function)
- Threshold values chosen for tasteOverlap labels (documented for Phase 11+ calibration)
- Any assumptions validated / invalidated during implementation
</output>

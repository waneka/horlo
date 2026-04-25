---
phase: 16-people-search
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - src/lib/searchTypes.ts
  - tests/data/searchProfiles.test.ts
  - tests/components/search/useSearchState.test.tsx
  - tests/components/search/PeopleSearchRow.test.tsx
  - tests/app/search/SearchPageClient.test.tsx
  - tests/components/layout/DesktopTopNav.test.tsx
autonomous: true
requirements:
  - SRCH-01
  - SRCH-02
  - SRCH-03
  - SRCH-04
  - SRCH-05
  - SRCH-06
  - SRCH-07

must_haves:
  truths:
    - "Five RED test files exist matching VALIDATION.md Wave 0 list"
    - "src/lib/searchTypes.ts exports SearchProfileResult and SearchTab"
    - "All Wave 0 tests fail BEFORE implementation (RED state) — execution proves the assertions are wired"
    - "Test files exercise every CONTEXT.md decision: D-03 (250ms + AbortController), D-04 (router.replace scroll:false), D-15 (XSS-safe highlighting), D-18 (profile_public gate), D-20 (2-char min), D-21 (bio ≥3-char), D-22 (overlap DESC + username ASC + LIMIT 20), D-23 (HeaderNav absent), D-24 (magnifier + muted fill)"
    - "PART B integration tests use the canonical `const maybe = hasLocalDb ? describe : describe.skip` env-gate pattern from tests/data/getSuggestedCollectors.test.ts:133-137 (NOT describe.runIf)"
    - "PART B includes an automated EXPLAIN check that asserts the username ILIKE plan contains \"Bitmap Index Scan\" — automated regression coverage for Pitfall C-1 (Plan 05 manual EXPLAIN ANALYZE remains as final production gate)"
  artifacts:
    - path: "src/lib/searchTypes.ts"
      provides: "SearchProfileResult, SearchTab type contracts that downstream plans implement"
      exports: ["SearchProfileResult", "SearchTab"]
    - path: "tests/data/searchProfiles.test.ts"
      provides: "Drizzle chainable mock unit tests + integration tests (env-gated)"
      contains: "profile_public"
    - path: "tests/components/search/useSearchState.test.tsx"
      provides: "Debounce + AbortController + URL sync + 2-char client gate"
      contains: "router.replace"
    - path: "tests/components/search/PeopleSearchRow.test.tsx"
      provides: "Row rendering + match-highlighting + XSS-safety + initialIsFollowing"
      contains: "<script>"
    - path: "tests/app/search/SearchPageClient.test.tsx"
      provides: "4-tab render + tab gate + suggested-collectors children + tab URL sync + D-02 autofocus"
      contains: "coming-soon-card-compact"
    - path: "tests/components/layout/DesktopTopNav.test.tsx"
      provides: "Extended D-23 (no HeaderNav) + D-24 (magnifier + muted fill) assertions"
      contains: "HeaderNav"
  key_links:
    - from: "tests/data/searchProfiles.test.ts"
      to: "src/lib/searchTypes.ts"
      via: "import type { SearchProfileResult }"
      pattern: "from '@/lib/searchTypes'"
    - from: "tests/components/search/PeopleSearchRow.test.tsx"
      to: "src/lib/searchTypes.ts"
      via: "import type { SearchProfileResult }"
      pattern: "SearchProfileResult"
    - from: "tests/components/layout/DesktopTopNav.test.tsx"
      to: "src/components/layout/DesktopTopNav.tsx"
      via: "RTL render assertion"
      pattern: "DesktopTopNav"
---

<objective>
Wave 0 RED. Author the contract for Phase 16 by (1) defining the canonical type interface (SearchProfileResult, SearchTab) downstream plans build against, and (2) writing five test files that RED-fail before any implementation exists.

Purpose: Tests-first locks every CONTEXT.md decision (D-01..D-29) to a verifiable assertion. The type file lets Plans 02 (DAL) and 03 (components) run in parallel during Wave 1 because both reference the same interface, not each other.

Output: 1 type file + 5 test files. After this plan, `npm run test` shows the new tests as RED (failing imports / missing implementations) — that is the desired outcome of Wave 0.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/16-people-search/16-CONTEXT.md
@.planning/phases/16-people-search/16-RESEARCH.md
@.planning/phases/16-people-search/16-VALIDATION.md

@src/lib/discoveryTypes.ts
@src/data/suggestions.ts
@src/components/home/SuggestedCollectorRow.tsx
@src/components/layout/DesktopTopNav.tsx
@src/lib/actionTypes.ts
@tests/data/getSuggestedCollectors.test.ts
@tests/components/layout/DesktopTopNav.test.tsx

<interfaces>
<!-- Existing types and patterns the test author MUST mirror -->

From src/lib/discoveryTypes.ts:
```ts
export interface SuggestedCollector {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  overlap: number  // 0..1
  sharedCount: number
  sharedWatches: Array<{ watchId: string; brand: string; model: string; imageUrl: string | null }>
}
```

From src/data/suggestions.ts (chainable Drizzle mock pattern to mirror):
```ts
// Mock pattern — mirrors tests/data/getSuggestedCollectors.test.ts:
// vi.mock('@/db', () => ({ db: { select: () => chainable } }))
// chainable: { from, innerJoin, where, limit } — each returns chain or Promise
```

From src/lib/actionTypes.ts:
```ts
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

From src/components/profile/FollowButton.tsx:
```ts
// FollowButton accepts: viewerId, targetUserId, targetDisplayName,
// initialIsFollowing (boolean — drives "Follow" vs "Following" copy),
// variant?: 'primary' | 'locked' | 'inline'
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create src/lib/searchTypes.ts contract file</name>
  <files>src/lib/searchTypes.ts</files>
  <read_first>
    - src/lib/discoveryTypes.ts (mirror SuggestedCollector shape)
    - src/lib/actionTypes.ts (ActionResult shape)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-13 row layout, D-19 DAL contract)
    - .planning/phases/16-people-search/16-RESEARCH.md (Pattern 5 SearchProfileResult exact fields)
  </read_first>
  <action>
Create `src/lib/searchTypes.ts` with exactly these exports (no implementation, just type contracts):

```ts
// Type contracts for Phase 16 People Search.
// Pure type-only module — no runtime cost; importable from server, client, and tests.
//
// SearchProfileResult is the row payload returned by `searchProfiles` DAL (D-19)
// and consumed by `<PeopleSearchRow>`. Mirrors SuggestedCollector with two
// additions: `bio`/`bioSnippet` (the bio-search match surface, D-13/D-14) and
// `isFollowing` (per-row state for the inline FollowButton, D-19 + Pitfall C-4).

export interface SearchProfileResult {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  bioSnippet: string | null
  overlap: number  // 0..1, derived from computeTasteOverlap bucket (D-16)
  sharedCount: number
  sharedWatches: Array<{
    watchId: string
    brand: string
    model: string
    imageUrl: string | null
  }>
  isFollowing: boolean
}

// Tab discriminant for the /search 4-tab control (D-05 default, D-12 URL sync).
// Default tab = 'all'; 'all' is OMITTED from the URL when active.
export type SearchTab = 'all' | 'people' | 'watches' | 'collections'
```

The exact field set is the contract Plans 02 (DAL) and 03 (components) implement against.
  </action>
  <verify>
    <automated>test -f src/lib/searchTypes.ts &amp;&amp; grep -q 'export interface SearchProfileResult' src/lib/searchTypes.ts &amp;&amp; grep -q "export type SearchTab = 'all' | 'people' | 'watches' | 'collections'" src/lib/searchTypes.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/lib/searchTypes.ts` returns 0
    - `grep -q 'export interface SearchProfileResult' src/lib/searchTypes.ts` matches
    - `grep -q 'isFollowing: boolean' src/lib/searchTypes.ts` matches
    - `grep -q 'bioSnippet: string | null' src/lib/searchTypes.ts` matches
    - `grep -q "export type SearchTab" src/lib/searchTypes.ts` matches
    - `npx tsc --noEmit` exits 0 (type file is well-formed)
  </acceptance_criteria>
  <done>Type contract file exists, exports SearchProfileResult + SearchTab, type-checks clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Author RED test — tests/data/searchProfiles.test.ts (DAL)</name>
  <files>tests/data/searchProfiles.test.ts</files>
  <read_first>
    - tests/data/getSuggestedCollectors.test.ts (Drizzle chainable mock pattern; 80-line PART A unit + PART B integration template — mirror this structure exactly)
    - src/lib/searchTypes.ts (just created — import SearchProfileResult)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-18, D-20, D-21, D-22 — exact predicates)
    - .planning/phases/16-people-search/16-RESEARCH.md Pattern 5 (full searchProfiles DAL shape)
    - .planning/phases/16-people-search/16-VALIDATION.md "Per-Task Verification Map" row 16-W0-01
  </read_first>
  <behavior>
    PART A — Drizzle chainable mock unit tests (always run):
    - Test 1: `searchProfiles({ q: 'b', viewerId, limit: 20 })` returns `[]` and makes ZERO db.select calls (D-20 server-side 2-char min, Pitfall C-2)
    - Test 2: `searchProfiles({ q: '   ', viewerId })` returns `[]` (trim before length check)
    - Test 3: WHERE clause for q='bo' (length 2) includes `eq(profileSettings.profilePublic, true)` and `ilike(profiles.username, '%bo%')` but NOT bio ILIKE — assert by inspecting captured `where` args structurally OR by drizzle SQL string serialization (D-21 / Pitfall C-5)
    - Test 4: WHERE clause for q='bob' (length 3) includes `or(ilike(username, '%bob%'), ilike(bio, '%bob%'))` — bio ILIKE present (D-21)
    - Test 5: `eq(profileSettings.profilePublic, true)` is present in WHERE (D-18 / Pitfall C-3)
    - Test 6: viewer self-exclusion present (`sql\`${profiles.id} != ${viewerId}\`` predicate — assert by snapshot of captured args)
    - Test 7: ORDER BY happens in JS — fixture two candidates with overlap 0.85 + 0.55 returns `[strong, weak]` sorted DESC
    - Test 8: Tie-break: two candidates with overlap=0.85, usernames "zoe" and "alice" → result order ["alice", "zoe"] (D-22 username ASC tie-break)
    - Test 9: LIMIT 20: with 25 fixture candidates, result.length === 20 (D-22)
    - Test 10: Pre-LIMIT candidate cap — DAL select chain receives `.limit(50)` BEFORE the JS sort+slice (Pitfall 5)
    - Test 11: Batched isFollowing: assert ONE follows-table SELECT after candidate resolution; uses `inArray(follows.followingId, topIds)` (Pitfall C-4)
    - Test 12: `isFollowing` flag wired correctly on each result row from the followingSet
    - Test 13: Empty candidate set short-circuits with `[]` and ZERO follows query

    PART B — Integration tests (env-gated; skip when SUPABASE env vars unset, via the same `maybe` pattern):
    - Test 14: Real Postgres ILIKE seeded with 3 public + 1 private profile, query "alice" returns only public matches; private profile excluded
    - Test 15: Real Postgres ILIKE bio match for q="watches" matches a profile whose bio contains "watches" (length >= 3 fires bio search)
    - Test 16 (Pitfall C-1 automated coverage): EXPLAIN the username ILIKE query against the seeded local DB and assert the planner output contains "Bitmap Index Scan". This is the automated counterpart to the Plan 05 manual EXPLAIN ANALYZE checkpoint — Plan 05 remains as the final-gate human-verified evidence, but this gives Wave 0 a regression alarm if a future migration drops or breaks the GIN trigram index.
  </behavior>
  <action>
Create `tests/data/searchProfiles.test.ts` mirroring the structure of `tests/data/getSuggestedCollectors.test.ts` byte-for-byte for the Drizzle chainable mock setup. Key differences:

1. **PART A header comment**: "Unit tests verifying searchProfiles DAL contract per CONTEXT.md D-18, D-20, D-21, D-22 and Pitfalls C-2, C-3, C-4, C-5."
2. **Mock chain**: candidates chain has `.from`, `.innerJoin`, `.where`, **and `.limit`** (because searchProfiles applies pre-LIMIT 50 — Pitfall 5).
3. **Capture WHERE args**: push the actual drizzle expression objects into `calls`. For asserting predicates, use `expect(JSON.stringify(call.args)).toContain('profile_public')` for the privacy gate, and `toContain('ilike')` plus `toContain('bio')` (or absence thereof) for the compound predicate.
4. **Behavior tests** (write each `it(...)` block exactly per the `<behavior>` section):
   - `it('returns empty + zero db calls when q.trim().length < 2', async () => { ... })` — assert `selectCount === 0`
   - `it('uses username-only ILIKE when q.length === 2', async () => { ... })` — capture WHERE, assert no bio ILIKE
   - `it('uses or(username, bio) ILIKE when q.length >= 3', async () => { ... })` — capture WHERE, assert bio ILIKE present
   - `it('gates with eq(profileSettings.profilePublic, true)', async () => { ... })`
   - `it('excludes viewer self via sql predicate', async () => { ... })`
   - `it('orders results by overlap DESC then username ASC', async () => { ... })`
   - `it('limits to 20 rows', async () => { ... })`
   - `it('applies pre-LIMIT cap of 50 to candidate query', async () => { ... })` — assert `.limit(50)` was called on candidate chain
   - `it('issues exactly ONE batched follows query for isFollowing', async () => { ... })` — count `op === 'follows.from'` calls
   - `it('wires isFollowing flag onto each result', async () => { ... })`
   - `it('short-circuits when candidate set is empty', async () => { ... })`
5. **PART B integration**: copy the env-gate pattern from `tests/data/getSuggestedCollectors.test.ts` lines 133-137 verbatim — declare `const hasLocalDb = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)` and `const maybe = hasLocalDb ? describe : describe.skip`, then `maybe('searchProfiles — integration', () => { ... })`. Do NOT use `describe.runIf(...)` — match the existing codebase precedent. Inside the `maybe` block: seed 3 public profiles + 1 private profile via the `supabase` admin client; assert `searchProfiles({ q: 'alice', viewerId })` returns only the public match.
6. **Import target**: `import { searchProfiles } from '@/data/search'` — this file doesn't exist yet (Plan 02 creates it). The test will fail at import resolution, which is the RED state.
7. **Type import**: `import type { SearchProfileResult } from '@/lib/searchTypes'` — exists from Task 1.

5b. **Test 16 — EXPLAIN automated check (Pitfall C-1)**: inside the same `maybe` block, write:

```ts
it('uses Bitmap Index Scan on profiles_username_trgm_idx for ILIKE (Pitfall C-1)', async () => {
  // Drizzle escape hatch: use db.execute with a raw EXPLAIN. We do NOT need
  // ANALYZE here — the planner choice (Bitmap vs Seq) is what we care about,
  // and EXPLAIN is fast + deterministic without timing.
  const { rows } = await dbModule.db.execute(
    sql`EXPLAIN SELECT id FROM profiles WHERE username ILIKE ${'%ali%'}`,
  )
  const planText = rows.map((r) => Object.values(r)[0]).join('\n')
  expect(planText).toContain('Bitmap Index Scan')
})
```

Notes for the executor:
- Import `sql` from `drizzle-orm` and load the `db` module as `dbModule` per the existing PART B import pattern (mirrors `tests/data/getSuggestedCollectors.test.ts` line ~140).
- Seed at least 3 public profiles before this test runs so the planner has enough rows to prefer the index. The seed setup from Test 14 already handles this — share fixtures via a `beforeAll` if needed, or copy the seed body into Test 16.
- This complements (does NOT replace) the Plan 05 Task 3 manual EXPLAIN ANALYZE checkpoint. Plan 05 remains the final human-verified production gate; this test is the automated regression alarm.

Use D-19 file location (`@/data/search` — new file per Open Question 1 recommendation; Plan 02 will honor this).
  </action>
  <verify>
    <automated>npm run test -- tests/data/searchProfiles.test.ts 2&gt;&amp;1 | grep -q 'Cannot find module' || npm run test -- tests/data/searchProfiles.test.ts 2&gt;&amp;1 | grep -qE 'fail|FAIL'</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/data/searchProfiles.test.ts` returns 0
    - `grep -q "from '@/data/search'" tests/data/searchProfiles.test.ts` matches (target import — will RED-fail until Plan 02)
    - `grep -q "from '@/lib/searchTypes'" tests/data/searchProfiles.test.ts` matches
    - `grep -q 'profile_public' tests/data/searchProfiles.test.ts` matches (D-18 assertion)
    - `grep -q 'localeCompare' tests/data/searchProfiles.test.ts` matches (D-22 username ASC tie-break verification)
    - `grep -qE "limit\\(\\s*50\\s*\\)|limit:\\s*50" tests/data/searchProfiles.test.ts` matches (pre-LIMIT cap)
    - `grep -q 'inArray' tests/data/searchProfiles.test.ts` matches (Pitfall C-4)
    - `grep -q 'q.trim().length' tests/data/searchProfiles.test.ts` matches (D-20)
    - `npm run test -- tests/data/searchProfiles.test.ts` exits non-zero (RED state — module not yet created)
  </acceptance_criteria>
  <done>Test file exists with all 13 unit tests + 3 integration tests (incl. Test 16 EXPLAIN check, env-gated via `maybe`), RED-fails because `@/data/search` doesn't exist yet.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Author RED test — tests/components/search/useSearchState.test.tsx</name>
  <files>tests/components/search/useSearchState.test.tsx</files>
  <read_first>
    - .planning/phases/16-people-search/16-CONTEXT.md (D-03, D-04, D-28)
    - .planning/phases/16-people-search/16-RESEARCH.md Pattern 2 (full hook sketch with debounce + AbortController + URL sync)
    - .planning/phases/16-people-search/16-VALIDATION.md row 16-W0-02
    - tests/components/home/ (browse for existing renderHook + fakeTimers patterns)
  </read_first>
  <behavior>
    - Test 1: 250ms debounce — typing 'b' then 'bo' fires debouncedQ='bo' once after 250ms (use `vi.useFakeTimers()` + `vi.advanceTimersByTime(250)`)
    - Test 2: 2-char client minimum — q='b' (after debounce) does NOT call searchPeopleAction; q='bo' DOES
    - Test 3: AbortController stale-cancel — fire q='bo', then q='bob' before first fetch resolves; assert first AbortController.abort() called and only the second result is committed to state
    - Test 4: URL sync — after debouncedQ='bob', `router.replace` called once with `/search?q=bob` AND `{ scroll: false }` (D-04)
    - Test 5: tab='all' — `?tab=` param OMITTED from URL when active (D-12); URL is `/search?q=bob` not `/search?q=bob&tab=all`
    - Test 6: tab='people' — `?tab=people` present in URL
    - Test 7: tab='watches' — fetch effect does NOT call searchPeopleAction (tab gate from research Pattern 2)
    - Test 8: tab='collections' — fetch effect does NOT call searchPeopleAction
    - Test 9: Initial mount with `?q=foo` searchParams pre-populates `q` AND fires fetch immediately (D-02)
    - Test 10: Cleanup — unmount during in-flight fetch fires controller.abort() (cleanup function returned by useEffect)
    - Test 11 (D-04 / D-20 inverse case): typing q='ab' (length 2) sets URL to /search?q=ab; then deleting one character so q='b' (sub-2-char) calls router.replace exactly once with the bare path '/search' (no querystring). Asserts the URL is correctly CLEARED on input shrink — not stale-stuck on the previous query.
  </behavior>
  <action>
Create `tests/components/search/useSearchState.test.tsx` using `renderHook` from `@testing-library/react` and `vi.useFakeTimers()`.

Test scaffolding:
```tsx
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockReplace = vi.fn()
const mockSearchParams = { get: vi.fn() }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}))

const mockSearchPeopleAction = vi.fn()
vi.mock('@/app/actions/search', () => ({
  searchPeopleAction: (...args: unknown[]) => mockSearchPeopleAction(...args),
}))

// Import AFTER mocks
import { useSearchState } from '@/components/search/useSearchState'
```

Each `it(...)` block follows the `<behavior>` enumeration. Critical assertions:
- `expect(mockReplace).toHaveBeenCalledWith('/search?q=bob', { scroll: false })` (D-04)
- `expect(mockSearchPeopleAction).not.toHaveBeenCalled()` for tab gate tests
- For abort: `mockSearchPeopleAction.mockImplementation(() => new Promise(() => {}))` to keep first call pending; trigger second q change; assert the abort flag was respected by checking only the second result lands in `result.current.results`.

Use `vi.useFakeTimers({ shouldAdvanceTime: false })` in `beforeEach`; `vi.useRealTimers()` in `afterEach`. Advance 250ms with `act(() => vi.advanceTimersByTime(250))`.

Initial mount test (Test 9): set `mockSearchParams.get.mockImplementation((k) => k === 'q' ? 'foo' : null)` BEFORE `renderHook`.

Import target: `from '@/components/search/useSearchState'` — does not exist yet (Plan 03 creates it).
  </action>
  <verify>
    <automated>npm run test -- tests/components/search/useSearchState.test.tsx 2&gt;&amp;1 | grep -qE 'fail|FAIL|Cannot find module'</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/components/search/useSearchState.test.tsx` returns 0
    - `grep -q "from '@/components/search/useSearchState'" tests/components/search/useSearchState.test.tsx` matches
    - `grep -q '250' tests/components/search/useSearchState.test.tsx` matches (debounce ms — D-03)
    - `grep -q 'AbortController' tests/components/search/useSearchState.test.tsx` matches OR `grep -q 'abort' tests/components/search/useSearchState.test.tsx` matches (stale-cancel — D-03)
    - `grep -qE "router\\.replace.*['\"]/search['\"]\\s*,|toHaveBeenCalledWith\\(\\s*['\"]/search['\"]" tests/components/search/useSearchState.test.tsx` matches OR a more lenient `grep -q "'/search'" tests/components/search/useSearchState.test.tsx` matches (Test 11 — bare /search path on shrink)
    - `grep -q "router.replace\\|mockReplace" tests/components/search/useSearchState.test.tsx` matches
    - `grep -q "scroll: false" tests/components/search/useSearchState.test.tsx` matches (D-04)
    - `grep -q "useFakeTimers" tests/components/search/useSearchState.test.tsx` matches
    - `npm run test -- tests/components/search/useSearchState.test.tsx` exits non-zero (RED — module not yet created)
  </acceptance_criteria>
  <done>Test file exists with 11 tests covering debounce, AbortController, URL sync (incl. bare /search on shrink), tab gate, mount-with-q. RED-fails on missing module.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Author RED test — tests/components/search/PeopleSearchRow.test.tsx</name>
  <files>tests/components/search/PeopleSearchRow.test.tsx</files>
  <read_first>
    - src/components/home/SuggestedCollectorRow.tsx (visual pattern this row mirrors)
    - src/components/profile/FollowButton.tsx (initialIsFollowing prop)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-13, D-14, D-15, D-16, D-17)
    - .planning/phases/16-people-search/16-RESEARCH.md Pattern 4 (HighlightedText) + §Anti-Patterns + §Security V8/V10
    - .planning/phases/16-people-search/16-VALIDATION.md row 16-W0-03
  </read_first>
  <behavior>
    - Test 1: Renders avatar (img or fallback), username, bio snippet (line-clamp-1 class), `{N}% taste overlap` line
    - Test 2: Whole-row Link to `/u/{username}/collection`
    - Test 3: Inline FollowButton renders with `initialIsFollowing` from `result.isFollowing`
    - Test 4: Match highlighting — query "li" + username "liam" — DOM contains a `<strong>` (or `<span class~="font-semibold">`) wrapping "li", with "am" outside
    - Test 5: Case-insensitive match — query "LI" + username "liam" — match rendered, with the matched substring wrapped in a `<strong>` (or font-semibold span). Use a case-insensitive matcher: `screen.getByText(/li/i)` — do NOT depend on the exact casing of the wrapped text node, only that A wrapping element exists for the matched substring AND has the highlight class.
    - Test 5b: Inverse-casing case-insensitive match — query "li" + username "LIAM" — DOM renders `<strong>LI</strong>AM` (the wrapping element exists and contains "LI"; the trailing "AM" is outside the strong). Asserts highlight works regardless of which side has the casing variant.
    - Test 6: XSS-safety — bio = `<script>alert(1)</script>nice watch` rendered with `<HighlightedText>`. Query DOM for any actual `<script>` element; expect zero. Plain text "<script>alert(1)</script>nice watch" should appear as text node
    - Test 7: Regex metachar safety — query "(.*)" does not crash (escape regex metachars before constructing RegExp)
    - Test 8: Bio snippet line-clamp-1 class present (truncation behavior tested via DOM class assertion only — actual line-clamping is CSS not unit-testable)
    - Test 9: Mini-thumb cluster hidden on mobile via `hidden sm:flex` class assertion (D-17)
    - Test 10: Mini-thumb cluster shows up to 3 watches + `{N} shared` count when sharedWatches.length > 0
  </behavior>
  <action>
Create `tests/components/search/PeopleSearchRow.test.tsx` using RTL `render` + `screen` queries.

Fixture builder (top of file):
```tsx
import type { SearchProfileResult } from '@/lib/searchTypes'

const baseResult: SearchProfileResult = {
  userId: 'user-1',
  username: 'liam',
  displayName: 'Liam Smith',
  avatarUrl: null,
  bio: 'Loves vintage chronographs',
  bioSnippet: 'Loves vintage chronographs',
  overlap: 0.85,
  sharedCount: 3,
  sharedWatches: [
    { watchId: 'w1', brand: 'Rolex', model: 'Submariner', imageUrl: null },
    { watchId: 'w2', brand: 'Omega', model: 'Speedmaster', imageUrl: null },
    { watchId: 'w3', brand: 'Tudor', model: 'Pelagos', imageUrl: null },
  ],
  isFollowing: false,
}
```

Mock `@/components/profile/FollowButton` to a simple `<button data-testid="follow-button" data-following={initialIsFollowing}>` so tests can read the `data-following` attribute (Test 3).

Critical assertions:
- Test 4 (highlighting positive): `const li = screen.getByText(/li/i); expect(li.tagName).toMatch(/STRONG|SPAN/); expect(li).toHaveClass('font-semibold')` — the matched substring is wrapped in a styled element. Use the case-insensitive regex matcher to keep Tests 4, 5, and 5b structurally identical (only the fixture casing changes per test).
- Test 5b (inverse casing): fixture `username='LIAM'`, q='li'; render PeopleSearchRow with q='li'; `const matched = screen.getByText('LI'); expect(matched.tagName).toMatch(/STRONG|SPAN/); expect(matched).toHaveClass('font-semibold')` — note the matcher is the LITERAL string 'LI' here because the wrapping element preserves the original text casing. RTL's `getByText('LI')` will hit the inner text node of the strong element while NOT matching the unwrapped "AM" text node.
- Test 6 (XSS-safety): `render(<PeopleSearchRow result={{...baseResult, bio: '<script>alert(1)</script>nice'}} q="nice" viewerId="me" />); expect(document.querySelector('script')).toBeNull(); expect(screen.getByText(/<script>alert\(1\)<\/script>nice/)).toBeInTheDocument()` — script appears as text, not DOM.
- Test 7 (regex safety): wrap render in `expect(() => render(<PeopleSearchRow result={baseResult} q="(.*)" viewerId="me" />)).not.toThrow()`.

Import target: `from '@/components/search/PeopleSearchRow'` — does not exist (Plan 03 creates).
  </action>
  <verify>
    <automated>npm run test -- tests/components/search/PeopleSearchRow.test.tsx 2&gt;&amp;1 | grep -qE 'fail|FAIL|Cannot find module'</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/components/search/PeopleSearchRow.test.tsx` returns 0
    - `grep -q "from '@/components/search/PeopleSearchRow'" tests/components/search/PeopleSearchRow.test.tsx` matches
    - `grep -q "from '@/lib/searchTypes'" tests/components/search/PeopleSearchRow.test.tsx` matches
    - `grep -q '<script>' tests/components/search/PeopleSearchRow.test.tsx` matches (XSS test fixture)
    - `grep -qE "(\\.\\*)|metachar|regex" tests/components/search/PeopleSearchRow.test.tsx` matches (regex safety test)
    - `grep -q 'line-clamp-1' tests/components/search/PeopleSearchRow.test.tsx` matches (D-14)
    - `grep -q 'hidden sm:flex' tests/components/search/PeopleSearchRow.test.tsx` matches (D-17)
    - `grep -q 'isFollowing' tests/components/search/PeopleSearchRow.test.tsx` matches
    - `npm run test -- tests/components/search/PeopleSearchRow.test.tsx` exits non-zero (RED)
  </acceptance_criteria>
  <done>11-test file (Tests 1-10 + Test 5b) covering visual layout, highlighting (incl. inverse casing), XSS-safety, regex-safety, mobile responsive class. RED-fails on missing module.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Author RED test — tests/app/search/SearchPageClient.test.tsx</name>
  <files>tests/app/search/SearchPageClient.test.tsx</files>
  <read_first>
    - .planning/phases/16-people-search/16-CONTEXT.md (D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-29)
    - .planning/phases/16-people-search/16-RESEARCH.md Pattern 3 (Server Component child via children prop) + §Architecture Patterns
    - .planning/phases/16-people-search/16-VALIDATION.md row 16-W0-04
  </read_first>
  <behavior>
    - Test 1 (SRCH-01): Renders 4 tabs labeled "All", "Watches", "People", "Collections"
    - Test 2 (SRCH-01 / D-05): Default mounted tab is "All" when no `?tab=` is in URL
    - Test 3 (D-12 / SRCH-01): Clicking "People" tab updates URL to `/search?tab=people` via router.replace; clicking "All" REMOVES `?tab=` from URL
    - Test 4 (SRCH-02): Clicking "Watches" tab does NOT call `searchPeopleAction`; renders coming-soon copy
    - Test 5 (SRCH-02): Clicking "Collections" tab does NOT call `searchPeopleAction`; renders coming-soon copy
    - Test 6 (SRCH-07): On mount with no `?q=` and tab='all' or 'people', renders the suggested-collectors `children` prop and the literal heading `Collectors you might like` (D-11)
    - Test 7 (SRCH-07): On mount with no `?q=`, `searchPeopleAction` is NOT called (q.length < 2 short-circuit)
    - Test 8 (SRCH-06 / D-10): When q='zzzznotfound' resolves with 0 results, renders the literal heading `No collectors match "zzzznotfound"` and renders the suggested-collectors `children` prop below
    - Test 9 (SRCH-06 / D-10): No-results sub-header renders `Try someone you'd like to follow`
    - Test 10 (D-09): While q-fetch is pending, renders `<SearchResultsSkeleton>` (assert via `data-testid="search-skeleton"` or by class `animate-pulse` count of 3-5 rows)
    - Test 11 (D-06): On the "All" tab, two compact coming-soon footer cards render BENEATH the result list / suggested-collectors block. Assert: `expect(screen.getAllByTestId('coming-soon-card-compact')).toHaveLength(2)`. Use the COMPACT-specific testid so the assertion does not collide with full-page panels (Issue #2 — Plan 03 Task 5 ships differentiated testids).
    - Test 12 (D-07): On the "People" tab, NO compact coming-soon footer cards render. Assert: `expect(screen.queryAllByTestId('coming-soon-card-compact')).toHaveLength(0)`. Use the COMPACT-specific testid only — full-page panels are not part of the People tab and do not affect this assertion.
    - Test 13 (D-02 autofocus): On mount with searchParams q='foo' (so `useSearchState` initial state has q='foo'), the page-level <Input role="searchbox"> is the active element. Assert: render SearchPageClient with mockSearchParams.get returning 'foo' for 'q'; `await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('searchbox')))`. This locks in that Plan 05 Task 1's `autoFocus` attribute is wired to the page-level input (NOT silently lost via a non-forwarded ref).
  </behavior>
  <action>
Create `tests/app/search/SearchPageClient.test.tsx` using RTL `render` + `userEvent` for tab clicks.

Fixture (top of file):
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReplace = vi.fn()
const mockSearchParams = { get: vi.fn().mockReturnValue(null) }

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}))

const mockSearchPeopleAction = vi.fn()
vi.mock('@/app/actions/search', () => ({
  searchPeopleAction: (...args: unknown[]) => mockSearchPeopleAction(...args),
}))

import { SearchPageClient } from '@/components/search/SearchPageClient'
```

Render shape: `<SearchPageClient viewerId="me"><div data-testid="suggested-children">SUGGESTED</div></SearchPageClient>`. The `children` prop stand-in is the suggested-collectors block (Plan 05 will pass the real `<SuggestedCollectors>` Server Component).

Each `it(...)` block per `<behavior>`. Critical assertions:
- Test 6: `expect(screen.getByTestId('suggested-children')).toBeInTheDocument(); expect(screen.getByText('Collectors you might like')).toBeInTheDocument()`
- Test 8: `mockSearchPeopleAction.mockResolvedValue({ success: true, data: [] })`; type 'zzzznotfound' (use fake timers + advance 250ms); `await waitFor(() => expect(screen.getByText('No collectors match "zzzznotfound"')).toBeInTheDocument())`
- Test 11: `expect(screen.getAllByTestId('coming-soon-card-compact')).toHaveLength(2)` for the All tab (Plan 03 Task 5 testid)
- Test 12: `expect(screen.queryAllByTestId('coming-soon-card-compact')).toHaveLength(0)` for the People tab
- Test 13 (autofocus): `mockSearchParams.get.mockImplementation((k) => k === 'q' ? 'foo' : null)`; render SearchPageClient with that mock; `await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('searchbox')))`. The `waitFor` is needed because RTL renders before microtask flushes; `autoFocus` is applied during the commit phase but the active-element check stabilizes after the next tick. NOTE: jsdom honors the `autoFocus` attribute on `<input>` reliably — this assertion catches the regression where ref-based focus would silently no-op against the shadcn Input wrapper.

Use `vi.useFakeTimers()` for any test exercising debounce.

Import target: `from '@/components/search/SearchPageClient'` — does not exist (Plan 05 creates).
  </action>
  <verify>
    <automated>npm run test -- tests/app/search/SearchPageClient.test.tsx 2&gt;&amp;1 | grep -qE 'fail|FAIL|Cannot find module'</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/app/search/SearchPageClient.test.tsx` returns 0
    - `grep -q "from '@/components/search/SearchPageClient'" tests/app/search/SearchPageClient.test.tsx` matches
    - `grep -q "Collectors you might like" tests/app/search/SearchPageClient.test.tsx` matches (D-11 literal copy)
    - `grep -q 'No collectors match' tests/app/search/SearchPageClient.test.tsx` matches (D-10 literal copy)
    - `grep -q "Try someone you'd like to follow" tests/app/search/SearchPageClient.test.tsx` matches (D-10 sub-header)
    - `grep -q 'coming-soon-card-compact' tests/app/search/SearchPageClient.test.tsx` matches (D-06 footer assertion uses the differentiated compact testid from Plan 03 Task 5)
    - `grep -q 'document.activeElement' tests/app/search/SearchPageClient.test.tsx` matches (Test 13 — D-02 autofocus assertion)
    - `grep -q 'searchbox' tests/app/search/SearchPageClient.test.tsx` matches (Test 13 — getByRole('searchbox') target)
    - `grep -qE "tab=people|'people'" tests/app/search/SearchPageClient.test.tsx` matches (D-12 URL sync)
    - `grep -q 'searchPeopleAction' tests/app/search/SearchPageClient.test.tsx` matches (mock + tab gate)
    - `npm run test -- tests/app/search/SearchPageClient.test.tsx` exits non-zero (RED)
  </acceptance_criteria>
  <done>13-test file covering 4-tab structure, tab gate, pre-query state, no-results state, loading skeleton, All-vs-People footer differential, and D-02 autofocus on the page-level input. RED-fails on missing module.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Extend tests/components/layout/DesktopTopNav.test.tsx with D-23 + D-24 assertions</name>
  <files>tests/components/layout/DesktopTopNav.test.tsx</files>
  <read_first>
    - tests/components/layout/DesktopTopNav.test.tsx (existing tests — preserve all existing assertions)
    - src/components/layout/DesktopTopNav.tsx (current shape — HeaderNav still imported)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-23, D-24)
    - .planning/phases/16-people-search/16-VALIDATION.md row 16-W0-05
  </read_first>
  <behavior>
    Append new `describe('Phase 16 polish (D-23, D-24)', () => { ... })` block:
    - Test A (D-23): DesktopTopNav DOES NOT render any link with text "Collection", "Profile", or "Settings" inside the header chrome (those are now exclusively in UserMenu's dropdown). Specifically: `screen.queryByRole('link', { name: 'Collection' })` returns null. NOTE: the wordmark "Horlo" links to `/` and the Explore link MUST still exist — do not over-broaden the assertion.
    - Test B (D-23): No `HeaderNav` element rendered (assert by `data-slot` if HeaderNav had one, or by absence of `data-testid="header-nav"`)
    - Test C (D-24): The persistent search input renders WITH a leading magnifier icon — assert by querying `screen.getByRole('searchbox')` (the input) and confirming a sibling/preceding `Search` icon (lucide-react Search renders as `<svg>` with `aria-hidden`). Use `expect(searchbox.parentElement?.querySelector('svg')).not.toBeNull()`.
    - Test D (D-24): Search input has muted-fill class — `expect(input).toHaveClass(/bg-muted/)` (matches `bg-muted/50`, `bg-muted/30`, etc.)
    - Test E (D-24 preserved behavior): Submit handler still routes to `/search?q={encoded}` — fire submit on the form, assert window.location was navigated (mock `window.location.href` setter and assert call).
  </behavior>
  <action>
Read the existing `tests/components/layout/DesktopTopNav.test.tsx` first to understand its setup (mocks for `next/navigation`, `NavWearButton`, etc.). Append new tests at the bottom:

```tsx
describe('Phase 16 polish (D-23 HeaderNav removed; D-24 nav search restyle)', () => {
  // Test A: HeaderNav inline links removed
  it('does not render Collection/Profile/Settings inline nav links (D-23)', () => {
    render(<DesktopTopNav user={{...}} username="me" ownedWatches={[]} bell={null} />)
    expect(screen.queryByRole('link', { name: 'Collection' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Profile' })).toBeNull()
    expect(screen.queryByRole('link', { name: /^Settings$/ })).toBeNull()
    // Sanity: Explore link DOES still exist
    expect(screen.getByRole('link', { name: 'Explore' })).toBeInTheDocument()
  })

  // Test B: explicit assertion HeaderNav component is gone
  it('does not render the HeaderNav nav element', () => {
    render(<DesktopTopNav user={{...}} username="me" ownedWatches={[]} bell={null} />)
    // HeaderNav rendered an inner <nav> with role="navigation"
    // After D-23 there should be no inner nav inside the header chrome
    // (the outer <header> is the only navigation landmark)
    const navs = screen.queryAllByRole('navigation')
    expect(navs.length).toBeLessThanOrEqual(1)
  })

  // Test C: leading magnifier icon
  it('renders a leading Search icon in the persistent search input (D-24)', () => {
    render(<DesktopTopNav user={{...}} username="me" ownedWatches={[]} bell={null} />)
    const input = screen.getByRole('searchbox')
    const wrapper = input.closest('form') ?? input.parentElement
    expect(wrapper?.querySelector('svg')).not.toBeNull()
  })

  // Test D: muted fill class
  it('applies muted fill background to the persistent search input (D-24)', () => {
    render(<DesktopTopNav user={{...}} username="me" ownedWatches={[]} bell={null} />)
    const input = screen.getByRole('searchbox')
    expect(input.className).toMatch(/bg-muted/)
  })

  // Test E: submit-only behavior preserved
  it('submit-only handler navigates to /search?q={encoded} (D-25 preserved)', async () => {
    const setHref = vi.fn()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '', set href(v: string) { setHref(v) } },
    })
    render(<DesktopTopNav user={{...}} username="me" ownedWatches={[]} bell={null} />)
    const input = screen.getByRole('searchbox')
    await userEvent.type(input, 'bob{Enter}')
    expect(setHref).toHaveBeenCalledWith('/search?q=bob')
  })
})
```

Adapt the user/ownedWatches/bell fixtures from the existing test setup at the top of the file (do not change them). Do NOT remove or modify any existing tests.
  </action>
  <verify>
    <automated>npm run test -- tests/components/layout/DesktopTopNav.test.tsx 2&gt;&amp;1 | grep -qE 'fail|FAIL'</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q 'Phase 16 polish' tests/components/layout/DesktopTopNav.test.tsx` matches (new describe block added)
    - `grep -q "queryByRole('link', { name: 'Collection' })" tests/components/layout/DesktopTopNav.test.tsx` matches (D-23 assertion)
    - `grep -q "bg-muted" tests/components/layout/DesktopTopNav.test.tsx` matches (D-24 fill assertion)
    - `grep -q "searchbox" tests/components/layout/DesktopTopNav.test.tsx` matches (D-24 input role)
    - `grep -q "/search?q=" tests/components/layout/DesktopTopNav.test.tsx` matches (D-25 submit navigation)
    - All pre-existing tests in this file still present (count of `it(` and `test(` matchers does not decrease)
    - `npm run test -- tests/components/layout/DesktopTopNav.test.tsx` exits non-zero (the 5 new tests RED until Plan 04 lands)
  </acceptance_criteria>
  <done>5 new tests appended; existing tests untouched. RED-fails on the 5 new assertions until Plan 04 ships D-23 + D-24.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Test author → test file | Test author is trusted; tests are NOT a runtime trust boundary, but RED tests authored before implementation lock in the security contract that downstream code must satisfy. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-16-01 | Tampering (SQLi) | tests/data/searchProfiles.test.ts | mitigate | Test 4 + Test 5 assert WHERE includes `eq(profileSettings.profilePublic, true)` and parameterized `ilike()` predicates — Plan 02 must satisfy these tests, locking in parameterized SQL. |
| T-16-02 | Tampering / Info Disclosure (stored XSS via bio) | tests/components/search/PeopleSearchRow.test.tsx | mitigate | Test 6 fixtures `bio: '<script>alert(1)</script>...'` + asserts `document.querySelector('script') === null`. Plan 03 must implement HighlightedText via React node arrays (no `dangerouslySetInnerHTML`) to satisfy. |
| T-16-03 | Information Disclosure (privacy leak via private profile search) | tests/data/searchProfiles.test.ts | mitigate | Test 5 captures WHERE arg, asserts `profile_public` predicate present. PART B integration test seeds 1 private profile and asserts it does NOT appear in results. |
| T-16-04 | DoS (search-driven DB load) | tests/components/search/useSearchState.test.tsx + tests/data/searchProfiles.test.ts | mitigate | Tests assert: 250ms debounce, 2-char client gate, 2-char server gate (D-20), 50-row pre-LIMIT cap, AbortController cancels stale requests. |
| T-16-05 | DoS (regex DoS in highlighting) | tests/components/search/PeopleSearchRow.test.tsx | mitigate | Test 7 fixtures `q="(.*)"` + asserts render does not throw — Plan 03 must implement regex metachar escape `q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`. |
| T-16-06 | Tampering (self-follow exploitation) | tests/data/searchProfiles.test.ts | mitigate | Test 6 asserts `sql\`profiles.id != ${viewerId}\`` viewer self-exclusion in WHERE. (FollowButton has additional defense.) |
| T-16-07 | DoS / performance (N+1 follow lookup) | tests/data/searchProfiles.test.ts | mitigate | Test 11 counts follows-table SELECTs; expects EXACTLY 1 (batched `inArray` from Pitfall C-4). |
| T-16-08 | Tampering (CSRF on Server Action) | n/a (Wave 0 doesn't write the action) | accept | Next.js 16 Server Actions have built-in origin-header CSRF protection (RESEARCH.md verified). No test needed in Wave 0; Plan 02 will add `getCurrentUser()` auth gate. |
</threat_model>

<verification>
After all 6 tasks complete:

1. `npm run test` — full suite is RED on the 5 new files (expected; Wave 0 RED commit). Other phases' tests remain GREEN.
2. `npx tsc --noEmit` — exits 0 (`searchTypes.ts` is well-formed; test files type-check against the new types).
3. Each test file's grep-based acceptance criteria passes.
4. `git diff --stat` shows: 1 new src file, 4 new test files, 1 extended test file. No production code changes.
</verification>

<success_criteria>
Plan 01 succeeds when:
- All 6 tasks pass their `<verify>` and acceptance criteria
- `src/lib/searchTypes.ts` exports `SearchProfileResult` and `SearchTab`
- 5 test files exist with the assertions described in `<behavior>` blocks
- `npm run test` shows expected RED state on the 5 new files (no other regressions)
- A single commit `test(16): add Wave 0 RED tests + searchTypes contract` records the RED baseline
</success_criteria>

<output>
After completion, create `.planning/phases/16-people-search/16-01-SUMMARY.md` recording:
- Files created (counts + paths)
- Test counts per file
- Snapshot of `npm run test` output showing exactly which 5 files are RED
- Confirmation that pre-existing test files remain GREEN (no regressions introduced)
</output>

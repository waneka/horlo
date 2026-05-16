---
phase: 39b
plan: 04
type: execute
wave: 2
depends_on:
  - 39b-01
  - 39b-02
files_modified:
  - src/data/discovery.ts
  - src/components/insights/OtherOwnersRoster.tsx
  - src/app/catalog/[catalogId]/page.tsx
  - tests/data/getCollectorsForCatalog.test.ts
autonomous: true
requirements:
  - DISC-11
nsv_rows:
  - NSV-18
disc_audit_rows:
  - DISC-AUDIT-70
  - DISC-AUDIT-72
commit_strategy: per-task

must_haves:
  truths:
    - "`getCollectorsForCatalog(catalogId, viewerId)` returns the top 5 public collectors ordered by `watches.created_at DESC`, plus a `totalCount` representing distinct collectors beyond the limit"
    - "DAL WHERE clause enforces `profileSettings.profilePublic = true AND profileSettings.collectionPublic = true AND profiles.id != viewerId` (two-layer privacy + self-exclusion) — T-39b-01 / T-39b-04 mitigation"
    - "DAL filters `watches.status IN ('owned', 'wishlist', 'grail')` to exclude `sold` (Q1 RECOMMEND, A1)"
    - "`/catalog/{id}` renders the OtherOwnersRoster section between the verdict card and the SameFamilyRail when `totalCount > 0`"
    - "Roster section is fully absent from the DOM when `totalCount === 0` (D-39b-07 / D-39b-09 hide-if-empty)"
    - "Count label '{N} collectors own this' renders ONLY when `totalCount > 5`; hidden when totalCount <= 5"
    - "Integration test proves: private-profile collector NOT visible; private-collection collector NOT visible; viewer self NOT visible; sold-status row NOT counted"
  artifacts:
    - path: "src/data/discovery.ts"
      provides: "getCollectorsForCatalog DAL with two-layer privacy + self-exclusion + status filter + JS dedup + totalCount second query"
      contains: "getCollectorsForCatalog"
    - path: "src/components/insights/OtherOwnersRoster.tsx"
      provides: "Server RSC rendering horizontal chip row (avatar + @username), hide-if-empty"
      contains: "OtherOwnersRoster"
    - path: "tests/data/getCollectorsForCatalog.test.ts"
      provides: "Integration test asserting two-layer privacy + self-exclusion + sold-status filter + dedup"
      contains: "profilePublic"
  key_links:
    - from: "src/app/catalog/[catalogId]/page.tsx"
      to: "src/data/discovery.ts getCollectorsForCatalog"
      via: "Server fetch in Promise.all alongside catalogEntry + collection + viewerOwnedRow + viewerProfile"
      pattern: "getCollectorsForCatalog\\(catalogId, user\\.id"
    - from: "src/components/insights/OtherOwnersRoster.tsx"
      to: "/u/${username}/collection"
      via: "Per-chip absolute-inset <Link>"
      pattern: "href=\\{`/u/\\$\\{c\\.username\\}/collection`\\}"
    - from: "src/data/discovery.ts (privacy gate)"
      to: "profileSettings.profilePublic + .collectionPublic"
      via: "Drizzle AND clause"
      pattern: "profileSettings\\.profilePublic.*true.*profileSettings\\.collectionPublic.*true"
---

<objective>
Ship the NSV-18 closure: the catalog other-owners roster on `/catalog/{id}`.
Adds a new DAL function `getCollectorsForCatalog` to `src/data/discovery.ts`
(two-layer privacy + self-exclusion + sold-status filter), a new server RSC
`OtherOwnersRoster` rendering a horizontal avatar+@username chip row, a page
mount on `/catalog/{id}` between the verdict card and SameFamilyRail (UI-SPEC
§Render Order line 279), and an integration test asserting all 4 privacy
edges + dedup behavior.

Purpose: closes Phase 33b NSV-18 (DISC-AUDIT-70 + DISC-AUDIT-72). The DAL is
load-bearing for T-39b-01 (Information Disclosure of private collector via
NSV-18) — the WHERE clause must enforce both `profileSettings.profilePublic`
and `profileSettings.collectionPublic` (D-39b-09 ships the second-layer gate
that does not exist in `getMostFollowedCollectors`).

Output: One DAL function + one new component + one page mount + one
integration test. Four per-task commits.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md
@CLAUDE.md
@AGENTS.md
@.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-01-SUMMARY.md
@src/data/discovery.ts
@src/data/search.ts
@src/data/profiles.ts
@src/db/schema.ts
@src/components/explore/PopularCollectorRow.tsx
@src/components/profile/AvatarDisplay.tsx
@src/app/catalog/[catalogId]/page.tsx
@tests/data/getMostFollowedCollectors.test.ts

<interfaces>
<!-- Key types and contracts. Extracted from codebase. -->

From src/data/discovery.ts:1-12 (existing imports — extend the list as needed):
```typescript
import 'server-only'
import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { follows, profiles, profileSettings, watches, watchesCatalog } from '@/db/schema'
```

From src/data/discovery.ts:57-121 §getMostFollowedCollectors (canonical sibling — copy two-layer privacy shape):
```typescript
// .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
// .where(and(eq(profileSettings.profilePublic, true), sql`${profiles.id} != ${viewerId}`, ...))
```

From src/data/search.ts:83-90 (self-exclusion sql predicate canonical):
```typescript
sql`${profiles.id} != ${viewerId}`
```

From src/components/profile/AvatarDisplay.tsx (verified Pitfall 1):
- `size` accepts only `40 | 64 | 96` — NOT 36 (UI-SPEC asks for 36; substitute 40 per A4 RECOMMEND)

From src/components/explore/PopularCollectorRow.tsx (server-imports-client absolute-inset Link analog).

NEW exports this plan ships:
```typescript
// src/data/discovery.ts
export interface CatalogCollector {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}
export async function getCollectorsForCatalog(
  catalogId: string,
  viewerId: string,
  opts?: { limit?: number },
): Promise<{ collectors: CatalogCollector[]; totalCount: number }>

// src/components/insights/OtherOwnersRoster.tsx
export interface OtherOwnersRosterProps {
  collectors: CatalogCollector[]
  totalCount: number
}
export function OtherOwnersRoster(props: OtherOwnersRosterProps): JSX.Element | null
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write integration test for getCollectorsForCatalog (RED — DAL does not yet exist)</name>
  <files>tests/data/getCollectorsForCatalog.test.ts</files>
  <read_first>
    - tests/data/getMostFollowedCollectors.test.ts (FULL — canonical DAL integration test scaffold; uses Supabase admin client to seed profiles, then queries via Drizzle)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §16 (lines 1219-1244 — integration test skeleton with all 7 cases)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md §"Validation Architecture" + §"Open Questions" Q1/Q4
    - src/db/schema.ts §profileSettings + §watches + §profiles (confirm column names + status enum)
    - Phase 36 STATE.md memory: "vitest env loading — Required workaround: `set -a; source .env.local; set +a; npx vitest run ...`"
  </read_first>
  <behavior>
    Six integration test cases (all gated on `hasDrizzle && hasSupabaseAdmin`):
    1. Excludes private-profile users (profileSettings.profilePublic = false → collector NOT in result) — T-39b-01 mitigation primary
    2. Excludes collectionPublic = false users (profileSettings.collectionPublic = false → collector NOT in result) — T-39b-01 mitigation second layer / D-39b-09 NEW gate
    3. Excludes viewer self (profiles.id === viewerId → NOT in result) — T-39b-04 mitigation
    4. Excludes sold-status rows (watches.status = 'sold' → row NOT counted as ownership) — A1 / Q1 verdict
    5. Orders by watches.created_at DESC (latest-added collector first)
    6. Deduplicates multi-row-per-user (same collector with both owned + wishlist on same catalog appears once)
    7. (optional) totalCount reflects distinct-collector count beyond top-N limit
  </behavior>
  <action>
    Create `tests/data/getCollectorsForCatalog.test.ts` using `tests/data/getMostFollowedCollectors.test.ts` as the structural analog. Copy:
    - The `hasDrizzle && hasSupabaseAdmin` `maybe = describe : describe.skip` gate (lines 1-15 of analog)
    - The `seedProfile` helper that uses the Supabase admin client to create a profile + profile_settings row (lines 37-59 of analog)

    Add a complementary helper `seedWatchForCatalog(userId, catalogId, status, createdAt?)` that inserts a row into `watches` via the Drizzle client.

    Implement the six test cases:

    Test 1 — private profile filtered:
    ```typescript
    it('excludes private-profile users (T-39b-01 layer 1)', async () => {
      const viewer = await seedProfile({ profilePublic: true, collectionPublic: true })
      const privateOwner = await seedProfile({ profilePublic: false, collectionPublic: true })
      const catalogId = await seedTestCatalogRow()  // helper inserts a row into watches_catalog
      await seedWatchForCatalog(privateOwner.id, catalogId, 'owned')
      const { collectors, totalCount } = await getCollectorsForCatalog(catalogId, viewer.id)
      expect(collectors.find((c) => c.userId === privateOwner.id)).toBeUndefined()
      expect(totalCount).toBe(0)
    })
    ```

    Test 2 — collectionPublic=false filtered (D-39b-09 NEW gate):
    ```typescript
    it('excludes collectionPublic=false users (T-39b-01 layer 2 / D-39b-09)', async () => {
      const viewer = await seedProfile({ profilePublic: true, collectionPublic: true })
      const privateCollOwner = await seedProfile({ profilePublic: true, collectionPublic: false })
      const catalogId = await seedTestCatalogRow()
      await seedWatchForCatalog(privateCollOwner.id, catalogId, 'owned')
      const { collectors } = await getCollectorsForCatalog(catalogId, viewer.id)
      expect(collectors.find((c) => c.userId === privateCollOwner.id)).toBeUndefined()
    })
    ```

    Test 3 — viewer self excluded:
    ```typescript
    it('excludes viewer self (T-39b-04)', async () => {
      const viewer = await seedProfile({ profilePublic: true, collectionPublic: true })
      const catalogId = await seedTestCatalogRow()
      await seedWatchForCatalog(viewer.id, catalogId, 'owned')
      const { collectors } = await getCollectorsForCatalog(catalogId, viewer.id)
      expect(collectors.find((c) => c.userId === viewer.id)).toBeUndefined()
    })
    ```

    Test 4 — sold-status excluded:
    ```typescript
    it('excludes sold-status rows (A1 / Q1 RECOMMEND)', async () => {
      const viewer = await seedProfile({ profilePublic: true, collectionPublic: true })
      const owner = await seedProfile({ profilePublic: true, collectionPublic: true })
      const catalogId = await seedTestCatalogRow()
      await seedWatchForCatalog(owner.id, catalogId, 'sold')
      const { collectors, totalCount } = await getCollectorsForCatalog(catalogId, viewer.id)
      expect(collectors.find((c) => c.userId === owner.id)).toBeUndefined()
      expect(totalCount).toBe(0)
    })
    ```

    Test 5 — ordering by created_at DESC:
    ```typescript
    it('orders by watches.created_at DESC', async () => {
      const viewer = await seedProfile({ profilePublic: true, collectionPublic: true })
      const oldOwner = await seedProfile({ profilePublic: true, collectionPublic: true })
      const newOwner = await seedProfile({ profilePublic: true, collectionPublic: true })
      const catalogId = await seedTestCatalogRow()
      await seedWatchForCatalog(oldOwner.id, catalogId, 'owned', new Date('2024-01-01'))
      await seedWatchForCatalog(newOwner.id, catalogId, 'owned', new Date('2025-01-01'))
      const { collectors } = await getCollectorsForCatalog(catalogId, viewer.id)
      expect(collectors[0].userId).toBe(newOwner.id)
    })
    ```

    Test 6 — multi-row-per-user dedup (Pitfall 3):
    ```typescript
    it('deduplicates multi-row-per-user (owned + wishlist same catalog)', async () => {
      const viewer = await seedProfile({ profilePublic: true, collectionPublic: true })
      const owner = await seedProfile({ profilePublic: true, collectionPublic: true })
      const catalogId = await seedTestCatalogRow()
      await seedWatchForCatalog(owner.id, catalogId, 'owned')
      await seedWatchForCatalog(owner.id, catalogId, 'wishlist')
      const { collectors, totalCount } = await getCollectorsForCatalog(catalogId, viewer.id)
      expect(collectors.filter((c) => c.userId === owner.id).length).toBe(1)
      expect(totalCount).toBe(1)
    })
    ```

    Add an `afterAll` cleanup that deletes the seeded profiles + watches + catalog rows. Mirror the cleanup pattern in `tests/data/getMostFollowedCollectors.test.ts`.

    Critical env-loading note: per Phase 36 STATE memory, tests require `set -a; source .env.local; set +a; npx vitest run ...` to run. The maybe-gate auto-skips when env is missing — that is expected behavior locally for users without DB env.

    Forbidden:
    - Do NOT mock `db` from `@/db`. The test exercises real Drizzle queries.
    - Do NOT skip the cleanup in afterAll — leaked rows pollute subsequent runs.
  </action>
  <verify>
    <automated>test -f tests/data/getCollectorsForCatalog.test.ts && echo "file exists"</automated>
    <automated>set -a; [ -f .env.local ] && source .env.local; set +a; npx vitest run tests/data/getCollectorsForCatalog.test.ts 2>&1 | tail -25</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/data/getCollectorsForCatalog.test.ts` exits 0
    - `grep -c "it(" tests/data/getCollectorsForCatalog.test.ts` returns ≥ 6
    - `grep "profilePublic: false" tests/data/getCollectorsForCatalog.test.ts` returns ≥ 1 line (T-39b-01 layer 1 test)
    - `grep "collectionPublic: false" tests/data/getCollectorsForCatalog.test.ts` returns ≥ 1 line (T-39b-01 layer 2 test)
    - `grep "'sold'" tests/data/getCollectorsForCatalog.test.ts` returns ≥ 1 line (A1 test)
    - `grep "maybe(" tests/data/getCollectorsForCatalog.test.ts` returns 1 line (env-gate pattern matches analog)
    - When env is unset: `npx vitest run tests/data/getCollectorsForCatalog.test.ts` skips all tests (describe.skip) — exit 0
    - When env is set: tests FAIL because `getCollectorsForCatalog` is not yet exported from `src/data/discovery.ts`. RED state is expected. Task 2 lands the function and the test transitions to GREEN.
    - SUMMARY records the RED status of this test until Task 2 completes
  </acceptance_criteria>
  <done>
    Integration test file ships in RED state (or skipped state when env absent). Task 2 closes it to GREEN.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement getCollectorsForCatalog DAL in src/data/discovery.ts</name>
  <files>src/data/discovery.ts</files>
  <read_first>
    - src/data/discovery.ts (FULL — 285 lines; getMostFollowedCollectors at lines 57-121 + getTrendingCatalogWatches at lines 135-160 for sibling-fn patterns)
    - src/data/search.ts (lines 60-93 — self-exclusion sql predicate canonical pattern)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §5 (lines 365-476 — full function shape ready to copy)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-RESEARCH.md §Pattern 1 (NSV-18 DAL aggregation pattern) + §Pitfalls 3 + 4
    - src/db/schema.ts §watches (status enum) + §profileSettings (profilePublic, collectionPublic columns) + §profiles
    - tests/data/getCollectorsForCatalog.test.ts (Task 1 — the test this DAL must close)
  </read_first>
  <behavior>
    Exports `getCollectorsForCatalog(catalogId, viewerId, opts?)` returning `{ collectors: CatalogCollector[]; totalCount: number }`:

    1. Joins `watches` ⋈ `profiles` ⋈ `profileSettings`.
    2. WHERE clause enforces:
       - `eq(watches.catalogId, catalogId)`
       - `eq(profileSettings.profilePublic, true)` (T-39b-01 layer 1)
       - `eq(profileSettings.collectionPublic, true)` (T-39b-01 layer 2 — D-39b-09 NEW)
       - `sql`${profiles.id} != ${viewerId}`` (T-39b-04 self-exclusion)
       - `inArray(watches.status, ['owned', 'wishlist', 'grail'])` (A1 / Q1 RECOMMEND — exclude sold)
    3. ORDER BY `desc(watches.createdAt), asc(profiles.username)` (D-39b-10)
    4. LIMIT 50 (Pitfall 3 — overfetch for JS-side dedup)
    5. Second query for `totalCount` using `count(DISTINCT ${profiles.id})::int` (Pitfall 4 — same WHERE clause)
    6. JS-side dedup: keep first occurrence per `userId`, slice top `limit` (default 5)
    7. Returns `{ collectors: CatalogCollector[]; totalCount: number }`
  </behavior>
  <action>
    Append the new export to `src/data/discovery.ts`. Use 39b-PATTERNS.md §5 (lines 397-467) verbatim — the function shape is copy-paste-ready.

    Step 1 — Verify the existing imports (line 1-12) already include `and, asc, desc, eq, inArray, sql` from `drizzle-orm` and `profiles, profileSettings, watches` from `@/db/schema`. If `inArray` or `sql` is missing, extend the import list.

    Step 2 — Add the `CatalogCollector` interface export:
    ```typescript
    export interface CatalogCollector {
      userId: string
      username: string
      displayName: string | null
      avatarUrl: string | null
    }
    ```

    Step 3 — Implement `getCollectorsForCatalog` exactly as in 39b-PATTERNS.md §5 lines 405-467. Key requirements:

    a. **Two-layer privacy** — the WHERE clause MUST contain BOTH:
       - `eq(profileSettings.profilePublic, true)` AND
       - `eq(profileSettings.collectionPublic, true)`
       (T-39b-01 mitigation — D-39b-09 NEW second layer.)

    b. **Self-exclusion** — `sql`${profiles.id} != ${viewerId}`` (T-39b-04).

    c. **Sold-status filter** — `inArray(watches.status, ['owned', 'wishlist', 'grail'])` (A1 / Q1 RECOMMEND).

    d. **Overfetch + JS dedup** — LIMIT 50 in the SQL, JS for-loop dedups by `userId` using a `Set`, slice top `limit` (default 5).

    e. **Separate totalCount query** — second query with identical WHERE clause but `select({ count: sql<number>`count(DISTINCT ${profiles.id})::int` })` (Pitfall 4).

    Step 4 — Add a JSDoc/inline comment block above the function citing:
    - Phase 39b NSV-18 / D-39b-09
    - T-39b-01 (Information Disclosure) mitigation contract
    - Pitfall 3 + 4 cross-reference

    Forbidden:
    - Do NOT skip the second totalCount query (the first query is capped at 50 — Pitfall 4 means totalCount cannot be derived from `rows.length` because the result is dedup'd and limited).
    - Do NOT use `inArray(profiles.id, [...subquery...])` — the direct JOIN shape from `getMostFollowedCollectors` is the canonical pattern.
    - Do NOT bypass the `profileSettings` JOIN — it is load-bearing for both privacy layers.
    - Do NOT change the order of `desc(watches.createdAt), asc(profiles.username)` (D-39b-10 + alphabetical tiebreaker).
  </action>
  <verify>
    <automated>grep -c "export.*function getCollectorsForCatalog\|export.*getCollectorsForCatalog" src/data/discovery.ts</automated>
    <automated>grep "profileSettings.profilePublic" src/data/discovery.ts</automated>
    <automated>grep "profileSettings.collectionPublic" src/data/discovery.ts</automated>
    <automated>grep "profiles.id} != \${viewerId" src/data/discovery.ts</automated>
    <automated>grep "inArray(watches.status" src/data/discovery.ts</automated>
    <automated>grep "count(DISTINCT" src/data/discovery.ts</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
    <automated>set -a; [ -f .env.local ] && source .env.local; set +a; npx vitest run tests/data/getCollectorsForCatalog.test.ts 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "export (async )?function getCollectorsForCatalog" src/data/discovery.ts` returns 1 line
    - `grep -E "profileSettings\.profilePublic.*true" src/data/discovery.ts` returns ≥ 2 lines (first query + second totalCount query — both enforce layer 1)
    - `grep -E "profileSettings\.collectionPublic.*true" src/data/discovery.ts` returns ≥ 2 lines (D-39b-09 NEW layer 2 — both queries)
    - `grep "profiles.id} != \${viewerId" src/data/discovery.ts` returns ≥ 2 lines (T-39b-04 self-exclusion — both queries)
    - `grep "inArray(watches.status" src/data/discovery.ts` returns ≥ 2 lines (A1 sold-filter — both queries)
    - `grep -E "owned.*wishlist.*grail" src/data/discovery.ts` returns ≥ 1 line (the inArray array literal)
    - `grep -E "count\(DISTINCT.*profiles\.id" src/data/discovery.ts` returns ≥ 1 line (Pitfall 4 totalCount query)
    - `grep "export interface CatalogCollector" src/data/discovery.ts` returns 1 line
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline)
    - When DB env is set: `npx vitest run tests/data/getCollectorsForCatalog.test.ts` exits 0 (all 6+ tests pass — RED → GREEN transition complete)
    - When DB env is unset: tests skip via maybe-gate; exit 0
  </acceptance_criteria>
  <done>
    DAL exports getCollectorsForCatalog with two-layer privacy + self-exclusion + sold-filter + dedup + separate totalCount query. Integration test (Task 1) closes RED→GREEN with DB env.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create OtherOwnersRoster component</name>
  <files>src/components/insights/OtherOwnersRoster.tsx</files>
  <read_first>
    - src/components/explore/PopularCollectorRow.tsx (FULL — analog for absolute-inset Link + AvatarDisplay row)
    - src/components/profile/AvatarDisplay.tsx (verify `size` only accepts `40 | 64 | 96` — Pitfall 1)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §9 (lines 719-772 — full component ready to copy with size=40 substitution)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §"NSV-18 — Other-Owners Roster" (lines 396-454) + §Copywriting Contract (line 531)
  </read_first>
  <behavior>
    Server component that:
    1. Returns null when `collectors.length === 0` (D-39b-07 / D-39b-09 hide-if-empty)
    2. Renders count label `"{totalCount} collectors own this"` ONLY when `totalCount > 5`
    3. Renders horizontal chip row: each chip is `w-16 shrink-0` flex-col, contains an absolute-inset `<Link href="/u/${username}/collection">` + AvatarDisplay (size=40) + @username text
    4. No per-chip hover background (absolute-inset link is the click surface)
  </behavior>
  <action>
    Create `src/components/insights/OtherOwnersRoster.tsx` using 39b-PATTERNS.md §9 (lines 726-770) verbatim.

    Step 1 — Imports:
    ```typescript
    import Link from 'next/link'
    import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
    import type { CatalogCollector } from '@/data/discovery'
    ```

    Step 2 — Props interface:
    ```typescript
    interface OtherOwnersRosterProps {
      collectors: CatalogCollector[]
      totalCount: number
    }
    ```

    Step 3 — Component body (39b-PATTERNS.md §9 lines 737-769):
    - Early return `null` when `collectors.length === 0` (D-39b-07 hide-if-empty)
    - `<section className="space-y-2">`
    - Count label conditional on `totalCount > 5`: `<p className="text-sm text-muted-foreground">{totalCount} collectors own this</p>` (UI-SPEC §Copywriting Contract — copy verbatim, no period, no comma in "X collectors")
    - Chip row container: `<div className="flex gap-2 overflow-x-auto scroll-smooth pb-1">`
    - Per-chip: `w-16 shrink-0 flex-col items-center gap-2` with absolute-inset Link, AvatarDisplay size=40, `@${c.username}` text

    Step 4 — Avatar size: use `size={40}` (Pitfall 1 + A4 RECOMMEND — UI-SPEC asks for 36 but the primitive only supports 40/64/96; substitute 40 + document deviation in SUMMARY). Add an inline code comment: `{/* UI-SPEC requests size=36; AvatarDisplay primitive only supports 40/64/96 — substitute 40 per RESEARCH A4 */}`.

    Step 5 — DisplayName fallback per chip: `const name = c.displayName ?? \`@${c.username}\``. The `aria-label` on the Link uses this: `\`${name}'s collection\``.

    Step 6 — NO `'use client'` directive (pure server component — UI-SPEC §Server vs Client component constraints).

    Forbidden:
    - Do NOT extend the AvatarDisplay primitive (deferred to follow-up patch if real-world chip row feels too large).
    - Do NOT add per-chip hover background (UI-SPEC §Pointer/hover — absolute-inset Link handles the click surface).
    - Do NOT add a FollowButton inside the chip (CONTEXT — roster is browse-only, not action-eligible).
    - Do NOT render `totalCount` label when `<= 5` (UI-SPEC §Chip-row §Count label rule).
    - Do NOT add `snap-x` to the chip row (chips are narrow; natural scroll is sufficient per UI-SPEC).
    - The count-label copy is LOAD-BEARING: `{N} collectors own this` (no period, no comma between digit and "collectors").
  </action>
  <verify>
    <automated>test -f src/components/insights/OtherOwnersRoster.tsx && echo "file exists"</automated>
    <automated>grep "export function OtherOwnersRoster" src/components/insights/OtherOwnersRoster.tsx</automated>
    <automated>grep "collectors own this" src/components/insights/OtherOwnersRoster.tsx</automated>
    <automated>grep "size={40}" src/components/insights/OtherOwnersRoster.tsx</automated>
    <automated>grep "totalCount > 5" src/components/insights/OtherOwnersRoster.tsx</automated>
    <automated>grep "if (collectors.length === 0) return null" src/components/insights/OtherOwnersRoster.tsx</automated>
    <automated>grep -cE "^['\"]use client['\"]" src/components/insights/OtherOwnersRoster.tsx</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/insights/OtherOwnersRoster.tsx` exits 0
    - `grep "export function OtherOwnersRoster" src/components/insights/OtherOwnersRoster.tsx` returns 1 line
    - `grep "collectors own this" src/components/insights/OtherOwnersRoster.tsx` returns 1 line (load-bearing copy)
    - `grep "size={40}" src/components/insights/OtherOwnersRoster.tsx` returns 1 line (Pitfall 1 substitution explicit)
    - `grep "totalCount > 5" src/components/insights/OtherOwnersRoster.tsx` returns 1 line (count label rule)
    - `grep "if (collectors.length === 0) return null" src/components/insights/OtherOwnersRoster.tsx` returns 1 line (D-39b-07 hide-if-empty)
    - `grep -cE "^['\"]use client['\"]" src/components/insights/OtherOwnersRoster.tsx` returns 0 (Server Component lock)
    - `grep "import { AvatarDisplay }" src/components/insights/OtherOwnersRoster.tsx` returns 1 line
    - `grep "import type { CatalogCollector }" src/components/insights/OtherOwnersRoster.tsx` returns 1 line
    - `grep "href={\`/u/\${c.username}/collection\`}" src/components/insights/OtherOwnersRoster.tsx` returns 1 line
    - `grep "absolute inset-0" src/components/insights/OtherOwnersRoster.tsx` returns ≥ 1 line (absolute-inset Link per PopularCollectorRow analog)
    - `grep "focus-visible:ring-2" src/components/insights/OtherOwnersRoster.tsx` returns ≥ 1 line (a11y focus ring per UI-SPEC §Pointer/hover)
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline)
  </acceptance_criteria>
  <done>
    OtherOwnersRoster component renders avatar+@username chip row, hides when empty, count label when > 5. AvatarDisplay size=40 substitution documented (Pitfall 1).
  </done>
</task>

<task type="auto">
  <name>Task 4: Mount OtherOwnersRoster on /catalog/{id}</name>
  <files>src/app/catalog/[catalogId]/page.tsx</files>
  <read_first>
    - src/app/catalog/[catalogId]/page.tsx (FULL — 211 lines; Plan 39b-02 ALREADY added ReferenceIdentityCard mount above lines 112-113 — keep that intact)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-PATTERNS.md §8 (lines 666-716 — page mount pattern with full Promise.all extension)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md §"/catalog/{id} render order" (lines 272-288)
    - .planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-02-SUMMARY.md (where Plan 39b-04 mount placeholder comment was left)
  </read_first>
  <action>
    Patch `src/app/catalog/[catalogId]/page.tsx` to fetch + mount OtherOwnersRoster between the verdict card and the SameFamilyRail (UI-SPEC §Render Order line 279).

    Step 1 — Add imports (after existing component imports — Plan 39b-02 already added ReferenceIdentityCard):
    ```typescript
    import { OtherOwnersRoster } from '@/components/insights/OtherOwnersRoster'
    import { getCollectorsForCatalog } from '@/data/discovery'
    ```

    Step 2 — Extend the existing `Promise.all` (or sequential awaits) that fetches catalogEntry / collection / preferences / viewerOwnedRow / viewerProfile. Add:
    ```typescript
    getCollectorsForCatalog(catalogId, user.id, { limit: 5 }),
    ```
    Destructure the result as `roster` (or `{ collectors, totalCount } = roster`).

    Step 3 — Mount the roster in the JSX. Render position: AFTER the verdict-card block (CollectionFitCard OR ReferenceIdentityCard OR fallback caption) and BEFORE the planned SameFamilyRail/LineageRail mount (which Plan 39b-05 owns). Locate the placeholder comment from Plan 39b-02 (`{/* Plan 39b-04 mounts OtherOwnersRoster here */}`) and replace it with:

    ```tsx
    <OtherOwnersRoster collectors={roster.collectors} totalCount={roster.totalCount} />
    ```

    The roster section is the SAME mount regardless of viewer state (fresh-account / cross-user / owner — UI-SPEC §"/catalog/{id} render order" is unconditional on viewer state; it just relies on the DAL self-exclusion + hide-if-empty to do the right thing per viewer).

    Step 4 — `/watch/{id}` does NOT get the roster — only `/catalog/{id}` (UI-SPEC §Render Order note line 288: "`/watch/{id}` does NOT get the other-owners roster (per D-39b scope: catalog only)").

    Forbidden:
    - Do NOT mount the roster on `/watch/{id}` (UI-SPEC explicit exclusion).
    - Do NOT mount the roster ABOVE the verdict card (UI-SPEC §Render Order — position #2).
    - Do NOT add a conditional `{collectors.length > 0 && <OtherOwnersRoster ...>}` wrapper — the component already returns null for the empty case (D-39b-07). Belt-and-suspenders is acceptable but unnecessary.
    - Do NOT add `'use client'`.
  </action>
  <verify>
    <automated>grep -c "OtherOwnersRoster" 'src/app/catalog/[catalogId]/page.tsx'</automated>
    <automated>grep "getCollectorsForCatalog(catalogId" 'src/app/catalog/[catalogId]/page.tsx'</automated>
    <automated>grep -c "OtherOwnersRoster" 'src/app/watch/[id]/page.tsx'</automated>
    <automated>npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
    <automated>npm run build 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "OtherOwnersRoster" 'src/app/catalog/[catalogId]/page.tsx'` returns ≥ 2 (import + JSX mount)
    - `grep "getCollectorsForCatalog(catalogId" 'src/app/catalog/[catalogId]/page.tsx'` returns ≥ 1 line
    - `grep -c "OtherOwnersRoster" 'src/app/watch/[id]/page.tsx'` returns 0 (NOT mounted on /watch/{id} per UI-SPEC §Render Order line 288)
    - `npx tsc --noEmit 2>&1 | grep -c "error TS"` ≤ 27 (Phase 36 baseline)
    - `npm run build 2>&1 | tail -3` exits 0 (Next 16 boundary smoke)
    - Roster appears BETWEEN verdict card and the SameFamilyRail placeholder comment (verify by reading the patched file's JSX section)
  </acceptance_criteria>
  <done>
    OtherOwnersRoster mounted on /catalog/{id} only. Server-side fetch wired via getCollectorsForCatalog. Hide-if-empty handled by the component itself.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Postgres pooler (service-role bypass) → DAL WHERE clause | Service-role connection bypasses RLS; DAL WHERE is the load-bearing privacy gate for cross-user reads |
| `src/data/discovery.ts:getCollectorsForCatalog` → rendered HTML | All projected fields (username, displayName, avatarUrl) are reads from validated profile data; React text auto-escape applies |
| Viewer auth (getCurrentUser) → DAL viewerId param | viewerId passed through verbatim; SQL parameterized via `sql\`\${profiles.id} != \${viewerId}\`` |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-39b-01 | Information Disclosure | src/data/discovery.ts:getCollectorsForCatalog | mitigate | Two-layer privacy gate at DAL WHERE: `eq(profileSettings.profilePublic, true) AND eq(profileSettings.collectionPublic, true)` — both layers enforced on BOTH the rows query AND the totalCount query. Integration tests #1 and #2 (Task 1) prove each layer independently. Service-role bypass of RLS means DAL WHERE is load-bearing; no defense at the rendering layer. |
| T-39b-04 | Information Disclosure (low) | src/data/discovery.ts:getCollectorsForCatalog | mitigate | `sql\`\${profiles.id} != \${viewerId}\`` predicate on both queries; integration test #3 (Task 1) proves viewer self is excluded. |
| SQL injection via catalogId | Tampering | src/data/discovery.ts:getCollectorsForCatalog | mitigate | Drizzle ORM parameterizes all values via `sql` template tags; UUID regex check upstream at `src/app/catalog/[catalogId]/page.tsx:46-48` rejects malformed input before the DAL is reached. |
| Data exfil via over-fetch | Information Disclosure (low) | src/data/discovery.ts:getCollectorsForCatalog | mitigate | Hard LIMIT 50 in the rows query (Pitfall 3); JS slice to top-N (default 5) after dedup. totalCount query uses `count(DISTINCT)` — no row leak. |
| XSS via collector username / displayName | XSS | src/components/insights/OtherOwnersRoster.tsx | mitigate | React text-node auto-escape on `{c.username}` + `{c.displayName}`; `aria-label` constructed via template literal (also auto-escaped). No `dangerouslySetInnerHTML`. Username regex-validated at signup. |
</threat_model>

<verification>
After all 4 tasks:
- `set -a; source .env.local; set +a; npx vitest run tests/data/getCollectorsForCatalog.test.ts` exits 0 (all 6 tests green when DB env present)
- `npm test 2>&1 | tail -10` — no NEW test failures other than the intentional RED state from Plan 39b-01 Task 2 (the `tests/static/hierarchy.lineage-3-node.test.ts` assertion "getSameFamilyForCatalog function is exported" remains RED until Plan 39b-05 lands the DAL). Phase 36 baseline otherwise preserved.
- `npm run build 2>&1 | tail -10` exits 0 (Next 16 boundary check)
- Manual smoke (operator UAT, optional):
  - Sign in as viewer-A; navigate to `/catalog/{id}` where viewer-B (profilePublic=true, collectionPublic=true) owns the catalog — verify viewer-B's chip is in the roster.
  - As viewer-B, sign in and navigate to the same `/catalog/{id}` — verify viewer-B's chip is NOT visible (self-exclusion).
  - Sign in as viewer-C (profilePublic=false) — own a watch with the same catalogId — sign in as viewer-A and verify viewer-C's chip is NOT visible.
  - Visit `/catalog/{id}` for a catalog no one owns — verify the OtherOwnersRoster section is entirely absent from the DOM (D-39b-07 hide-if-empty).
</verification>

<success_criteria>
- `getCollectorsForCatalog` exports with two-layer privacy + self-exclusion + sold-filter + dedup + separate totalCount query
- `OtherOwnersRoster` server component renders horizontal chip row with hide-if-empty + count-label-only-when-totalCount-greater-than-5
- `/catalog/{id}` renders the roster between verdict card and SameFamilyRail placeholder (UI-SPEC §Render Order #2)
- `/watch/{id}` does NOT render the roster (UI-SPEC §Render Order note line 288)
- Integration test asserts all 4 privacy edges: private-profile filtered, private-collection filtered, viewer self excluded, sold-status excluded (T-39b-01 + T-39b-04 mitigation)
- AvatarDisplay size=40 substitution documented in SUMMARY (Pitfall 1 / A4 deviation tracking)
- No new tsc errors above Phase 36 baseline; npm run build green
</success_criteria>

<output>
After completion, create `.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-04-SUMMARY.md` with:
- DAL ship state (two-layer privacy clause verbatim from the rows query + totalCount query)
- Integration test transition (RED → GREEN with DB env; skipped when env absent)
- AvatarDisplay deviation note (UI-SPEC size=36 → ship size=40 — Pitfall 1 / A4 RECOMMEND)
- Q1 decision capture (A1 sold-status exclusion: SHIPPED per RECOMMEND — semantics match "X collectors own this" copy)
- Page render-order verification (verdict-card → roster → family-rail-placeholder in /catalog/{id}; /watch/{id} unchanged)
- T-39b-01 + T-39b-04 mitigation proof: cite the test names + commands
- Note any deviation from CONTEXT D-39b-09 / D-39b-10 / D-39b-11 or UI-SPEC §NSV-18
</output>

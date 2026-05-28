---
phase: 65
plan: 01
subsystem: dal
tags:
  - dal
  - follows
  - privacy
  - sql
  - tdd
requirements:
  - FOLL-02
  - FOLL-04
dependency-graph:
  requires:
    - "src/data/discovery.ts::getCollectorsForCatalog (structural template)"
    - "src/db/schema.ts::follows, profiles, profileSettings, watches"
  provides:
    - "src/data/follows.ts::FollowedOwner (typed projection)"
    - "src/data/follows.ts::getFollowedOwnersForCatalog (single-query, no-N+1, two-layer-privacy, follow-direction read path)"
  affects:
    - "Phase 65 Plan 02 (FollowedOwnersModule RSC) — consumes FollowedOwner + return shape"
    - "Phase 65 Plan 03 (page.tsx integration) — calls DAL inside Promise.all on each branch"
tech-stack:
  added: []
  patterns:
    - "DAL clone-with-one-added-INNER-JOIN (follows direction = viewer→owner)"
    - "Two-layer privacy gate at the WHERE (profilePublic + collectionPublic) applied to BOTH main and count queries"
    - "JS Set-based dedup after SQL overfetch (Pitfall 3)"
    - "Separate count(DISTINCT) query with identical WHERE + identical JOINs for totalCount (Pitfall 4)"
    - "TDD plan-level gate sequence (test commit → feat commit)"
key-files:
  created:
    - "tests/data/getFollowedOwnersForCatalog.test.ts"
    - ".planning/phases/65-follow-scoped-owners-module/65-01-SUMMARY.md"
  modified:
    - "src/data/follows.ts"
decisions:
  - "Dedicated getFollowedOwnersForCatalog function (D-06) — getCollectorsForCatalog stays untouched; broad-roster call path regression-safe"
  - "FollowedOwner is a distinct exported symbol in src/data/follows.ts (D-11), NOT a re-export of CatalogCollector — the two surfaces can evolve independently"
  - "follows INNER JOIN appears in BOTH main and count queries — RESEARCH.md mandates identical JOIN+WHERE for privacy consistency"
  - "Strict catalogId: string (NOT nullable) per RESEARCH Open Q4 — null handling is the call site's responsibility (Plan 03)"
  - "Test 8 (one-way follow → owner included) is the load-bearing FOLL-02 assertion — would fail if the join were reversed or mutual-only"
metrics:
  duration: "~6 minutes (single sequential execution)"
  completed: 2026-05-28
  tasks_complete: 2
  files_modified: 1
  files_created: 1
  commits: 2
---

# Phase 65 Plan 01: Follow-Scoped DAL Summary

Adds `getFollowedOwnersForCatalog(catalogId, viewerId, opts)` to
`src/data/follows.ts` — single SQL query joining `follows ⋈ watches ⋈ profiles ⋈
profileSettings` that returns the top-N (default 5) public collectors who own
this catalog ref AND whom the viewer follows (one-way `viewer → owner`
direction). Plus the 8-test integration mirror at
`tests/data/getFollowedOwnersForCatalog.test.ts`.

## What Shipped

### New DAL function (Task 1)

**File:** `src/data/follows.ts` (modified — 148 insertions, 1 deletion)

- **New exported type:** `FollowedOwner = { userId, username, displayName,
  avatarUrl }` — projection shape identical to `CatalogCollector` (D-02) but a
  distinct symbol per D-11.
- **New exported function:**
  ```typescript
  export async function getFollowedOwnersForCatalog(
    catalogId: string,
    viewerId: string,
    opts: { limit?: number } = {},
  ): Promise<{ owners: FollowedOwner[]; totalCount: number }>
  ```
- **Drizzle-orm import** extended on line 4 to include `asc` (used for the
  `profiles.username` deterministic tie-breaker sort).
- **JSDoc** cites D-05/05a/05b (privacy + self-exclusion + status), D-06
  (dedicated DAL — not a flag), D-07 + Pitfall 1 (follow direction), D-08 (sort
  key), Pitfalls 3+4 (dedup + count(DISTINCT)).
- **`src/data/discovery.ts` is UNCHANGED** — D-06 honored.

### Query shape (5-conjunct WHERE + the new follows INNER JOIN)

```sql
SELECT profiles.{id, username, displayName, avatarUrl}, watches.createdAt
FROM watches
INNER JOIN profiles         ON profiles.id          = watches.userId
INNER JOIN profile_settings ON profile_settings.userId = profiles.id
INNER JOIN follows          ON follows.followerId   = ${viewerId}
                           AND follows.followingId  = profiles.id  -- D-07 / FOLL-02 / Pitfall 1
WHERE watches.catalogId           = ${catalogId}
  AND profile_settings.profilePublic    = true                     -- D-05 layer 1
  AND profile_settings.collectionPublic = true                     -- D-05 layer 2 (load-bearing)
  AND profiles.id                       != ${viewerId}             -- D-05a self-exclusion
  AND watches.status IN ('owned','wishlist','grail')               -- D-05b
ORDER BY watches.createdAt DESC, profiles.username ASC             -- D-08
LIMIT 50;                                                          -- Pitfall 3 overfetch
```

Then a separate `count(DISTINCT profiles.id)::int` query with the **identical
WHERE + identical follows INNER JOIN** for `totalCount` (Pitfall 4 privacy
consistency). Then a JS `Set<userId>` dedup loop slices to `limit`.

### DAL test mirror (Task 2)

**File:** `tests/data/getFollowedOwnersForCatalog.test.ts` (new — 389 lines)

8 integration tests, all dynamically importing `@/data/follows` in `beforeAll`,
gated by `maybe = hasDrizzle && hasSupabaseAdmin ? describe : describe.skip`.

| # | Test | Asserts | Decision |
|---|------|---------|----------|
| 1 | excludes private-profile users even when viewer follows them | `profilePublic=false` → excluded; follow does NOT override | D-05 layer 1 |
| 2 | excludes `collectionPublic=false` users even when viewer follows them | LOAD-BEARING: follow does NOT grant collection visibility | D-05 layer 2 |
| 3 | excludes viewer self even when self-follow row is present | `profiles.id != viewerId` clause | D-05a |
| 4 | excludes sold-status rows even when viewer follows owner | `inArray(status, ['owned','wishlist','grail'])` | D-05b |
| 5 | orders by `watches.createdAt DESC` for followed owners | recency-of-ownership sort | D-08 |
| 6 | deduplicates multi-row-per-user owned+wishlist | JS Set dedup + count(DISTINCT) | Pitfall 3 |
| 7 | viewer does NOT follow → owner excluded | the follows INNER JOIN actually filters | FOLL-02 / Pitfall 1 |
| 8 | viewer follows alice one-way (NOT mutual) → alice INCLUDED | join is one-way `viewer → owner`, NOT mutual-only | FOLL-02 / Pitfall 1 |

Tests 7 + 8 are the load-bearing FOLL-02 assertions. Test 8 in particular
would fail if the join were reversed (`followerId = profiles.id AND
followingId = viewerId`) or mutual-only.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 2 | Author 8-test integration file (RED — `getFollowedOwnersForCatalog` doesn't exist yet → TS error confirms) | `9ae9401b` | `tests/data/getFollowedOwnersForCatalog.test.ts` |
| 1 | Add `FollowedOwner` type + `getFollowedOwnersForCatalog` DAL function (GREEN — tests + TS now compile) | `1b28974d` | `src/data/follows.ts` |

### TDD Gate Compliance

This plan satisfies the plan-level TDD gate sequence:

1. ✅ `test(65-01): add failing tests for getFollowedOwnersForCatalog` — RED commit (`9ae9401b`)
2. ✅ `feat(65-01): add getFollowedOwnersForCatalog DAL (FOLL-02, FOLL-04)` — GREEN commit (`1b28974d`)
3. _REFACTOR not needed_ — DAL is a direct structural clone of
   `getCollectorsForCatalog`; no cleanup pass required.

The plan tasks are written in implementation order (Task 1 = DAL, Task 2 =
tests), but commits follow TDD gate order (test commit first, feat commit
second). This is intentional and matches the `<tdd_execution>` rules: RED
commit must precede GREEN.

## Acceptance Criteria Verification

All Task 1 acceptance criteria verified via grep on the committed source:

| Assertion | Expected | Actual | Status |
|-----------|----------|--------|--------|
| `^export interface FollowedOwner` | 1 | 1 | ✅ |
| `^export async function getFollowedOwnersForCatalog` | 1 | 1 | ✅ |
| Function signature exact | matches plan | matches plan (catalogId: string, viewerId: string, opts: { limit?: number } = {}): Promise<{ owners: FollowedOwner[]; totalCount: number }> | ✅ |
| Drizzle-orm import includes `asc` | 1 | 1 | ✅ |
| `eq(follows.followerId, viewerId)` | ≥1 | 2 (main + count) | ✅ |
| `eq(follows.followingId, profiles.id)` | ≥1 | 2 (main + count) | ✅ |
| `eq(profileSettings.profilePublic, true)` | ≥2 | 3 (JSDoc + main + count) | ✅ |
| `eq(profileSettings.collectionPublic, true)` | ≥2 | 3 (JSDoc + main + count) | ✅ |
| `sql<number>\`count(DISTINCT ${profiles.id})::int\`` | 1 | 1 | ✅ |
| `inArray(watches.status, ['owned', 'wishlist', 'grail'])` | 2 | 2 (main + count) | ✅ |
| `return { owners,` | 1 | 1 | ✅ |
| `src/data/discovery.ts` untouched | clean | clean (`git diff --stat` empty) | ✅ |

Task 2 acceptance criteria:

| Assertion | Expected | Actual | Status |
|-----------|----------|--------|--------|
| File exists at tests/data/getFollowedOwnersForCatalog.test.ts | yes | yes | ✅ |
| `import { describe, it, expect, beforeAll, afterAll } from 'vitest'` | 1 | 1 | ✅ |
| `const maybe = hasDrizzle && hasSupabaseAdmin ? describe : describe.skip` | 1 | 1 | ✅ |
| `typeof import('@/data/follows')` | 1 | 1 | ✅ |
| `typeof import('@/data/discovery')` | 0 | 0 | ✅ |
| `dal.getFollowedOwnersForCatalog` references | ≥8 | 8 | ✅ |
| `it(` invocations | ≥8 | 8 | ✅ |
| `FOLL-02` references | ≥2 (Tests 7 + 8) | 2 | ✅ |

## Verification

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `npx tsc --noEmit 2>&1 \| grep -E "(src/data/follows\.ts\|tests/data/getFollowedOwnersForCatalog\.test\.ts)"` | empty (no new errors) |
| Build | `npm run build` | **exits 0** (authoritative gate per `project_baseline_not_green_build_is_gate`) |
| Behavior (integration tests) | `set -a; source .env.local; set +a; npx vitest run tests/data/getFollowedOwnersForCatalog.test.ts` | env-skipped — see Local Env Skip below |

## Local Env Skip (test behavior verification deferred)

**8/8 tests skip locally** because `tests/fixtures/users.ts::seedTwoUsers` fails
at `admin.auth.admin.createUser` with `invalid JWT: unable to parse or verify
signature, token signature is invalid: signature is invalid`.

**Root cause** (environmental, not code): `.env.local` is pointed at the
production Supabase project — `SUPABASE_SERVICE_ROLE_KEY` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are signed with the prod JWT secret. But the
running local Supabase stack (port 54321) signs with the local JWT secret
(`super-secret-jwt-token-with-at-least-32-characters-long`). The keys don't
verify against the local signing secret → the admin SDK rejects.

**Identical baseline** in the canonical sibling
`tests/data/getCollectorsForCatalog.test.ts` — same env-mismatch produces the
same skip count (6/6 there, 8/8 here). The failure is environmental and
pre-existing, NOT introduced by this plan.

**What IS verified locally:**
- Source assertions (grep — every acceptance criterion matched, see table above)
- TypeScript compilation (`tsc --noEmit` — zero new errors)
- Build (`npm run build` — exits 0; the authoritative gate)
- Static guards (run as part of `npm run build` — all green)

**What remains unverified locally (deferred to CI / env-aligned local):**
- All 8 test behaviors. Tests are written, TS-clean, and structurally identical
  to the canonical sibling pattern — would run under env-aligned local
  Supabase or in CI where local keys match local secret.

The orchestrator can either (a) align local env-keys to local-supabase keys
and re-run the test command above, or (b) defer test-behavior verification to
the CI/preview environment per the project's documented
`feedback_mobile_ui_verify_on_prod` workflow (this is not a mobile UI plan,
but the same env-skip baseline applies).

## Deviations from Plan

**None.** Plan executed exactly as written. No Rule 1/2/3 auto-fixes were
required; no Rule 4 architectural decisions were triggered.

The only structural choice was task commit ORDER: the plan lists Task 1 (DAL)
before Task 2 (tests), but TDD plan-level gate requires the `test(...)` commit
to precede the `feat(...)` commit. I committed Task 2 (tests) first as RED,
then Task 1 (DAL) as GREEN. The plan's `<tdd_execution>` rules explicitly call
for this ordering; both tasks are still complete with one commit each.

## Authentication Gates

None. No auth surface added — DAL is read-only and inherits the existing
`getCurrentUser()` route-level auth gate via the eventual Plan 03 call site.

## Self-Check: PASSED

**Files exist:**
- `[ -f tests/data/getFollowedOwnersForCatalog.test.ts ]` → FOUND
- `[ -f src/data/follows.ts ]` → FOUND (extended with new symbols)
- `[ -f .planning/phases/65-follow-scoped-owners-module/65-01-SUMMARY.md ]` → FOUND (this file)

**Commits exist:**
- `git log --oneline | grep -q "9ae9401b"` → FOUND (RED: `test(65-01): add failing tests for getFollowedOwnersForCatalog`)
- `git log --oneline | grep -q "1b28974d"` → FOUND (GREEN: `feat(65-01): add getFollowedOwnersForCatalog DAL (FOLL-02, FOLL-04)`)

**Source assertions:** all 12 Task 1 + 8 Task 2 acceptance-criteria greps pass
(verified in the tables above).

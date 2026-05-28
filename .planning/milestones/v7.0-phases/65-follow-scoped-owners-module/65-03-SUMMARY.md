---
phase: 65
plan: 03
subsystem: integration
tags:
  - integration
  - ppr-safe
  - hero
  - static-guard
  - tdd
requirements:
  - FOLL-01
  - FOLL-02
  - FOLL-03
  - FOLL-04
dependency-graph:
  requires:
    - "src/data/follows.ts::getFollowedOwnersForCatalog (Plan 01)"
    - "src/data/follows.ts::FollowedOwner type (Plan 01)"
    - "src/components/insights/FollowedOwnersModule.tsx (Plan 02)"
  provides:
    - "src/app/w/[ref]/page.tsx — 3 pre-fetch sites (Branch 1 Promise.all, Branch 2 owned serial await, Branch 2 pure-catalog Promise.all) + 2 hero prop passes + 1 direct render on Branch 2 pure-catalog"
    - "src/components/watch/WatchDetailHero.tsx — 2 new optional props (followedOwners, followedOwnersTotal) + render of FollowedOwnersModule between LikeButton/jump row and Last-Worn line"
    - "tests/static/watch-detail-ia-order.test.ts — 2 new structural guards (FOLL-04 page.tsx >=3 active-code calls + B1 sibling-composition hero-non-import)"
  affects:
    - "End-to-end Phase 65 delivery — FOLL-01..04 observable on prod after deploy"
    - "Phase 51/52/61 PPR contract — preserved (unstable_instant / await connection() / outer Suspense untouched)"
tech-stack:
  added: []
  patterns:
    - "B1 sibling-composition: server-only DAL pre-fetched in page.tsx, resolved data threaded into 'use client' hero as props (FollowedOwner type-only import; getFollowedOwnersForCatalog function NEVER imported into the hero)"
    - "Parallel pre-fetch in existing Promise.all blocks (no new waterfall) — D-09"
    - "Branch 1 ternary guard `watch.catalogId ? getFollowedOwnersForCatalog(...) : Promise.resolve({ owners: [], totalCount: 0 })` mirroring the existing sameFamily/lineage/catalog-entry null-handling pattern"
    - "Direct <FollowedOwnersModule> render in the Branch 2 pure-catalog inline hero shell (no <WatchDetailHero> on that branch) — module renders ABOVE the existing <OtherOwnersRoster>; both rosters coexist by design (D-03a)"
    - "Static-guard extension (FOLL-04 active-code call-count + B1 non-import) using the existing activeLineNumbers helper + import-aware regex"
    - "TDD plan-level gate sequence: RED test commit → GREEN hero commit → GREEN page.tsx commit"
key-files:
  created:
    - ".planning/phases/65-follow-scoped-owners-module/65-03-SUMMARY.md"
    - ".planning/phases/65-follow-scoped-owners-module/deferred-items.md"
  modified:
    - "src/app/w/[ref]/page.tsx (+36 / -2 — 6 additive edits)"
    - "src/components/watch/WatchDetailHero.tsx (+24 / -0 — 4 additive edits)"
    - "tests/static/watch-detail-ia-order.test.ts (+35 / -0 — 2 new describe blocks)"
decisions:
  - "Imports on page.tsx are split into TWO separate import lines (existing isFollowing + new getFollowedOwnersForCatalog) — required by the plan's acceptance criterion regex `^import { getFollowedOwnersForCatalog } from '@/data/follows'$`. The alternative (merged into the existing `isFollowing` import line) would have been more compact but would have failed the structural guard."
  - "Ternary guards on Branches 1 + 2-owned are multi-line (matches the existing `watch.catalogId ? getCatalogById(watch.catalogId) : Promise.resolve(null)` precedent at page.tsx line 312 — single-line ternaries would have been less readable in the 3-tuple await Promise.all context). The plan's acceptance-criterion grep regex was single-line and reported 0 false-negatives; verified by perl multi-line regex matching 1+1 as expected."
  - "Branch 2 pure-catalog destructure adds the new entry as `followedOwnersForCatalog` (NOT `followedOwners`) to avoid name collision with the Branch 1 destructure scope and to make the call-site name self-documenting (`forCatalog` = 'pulled from the catalog Promise.all')."
  - "The new comment in WatchDetailHero.tsx + page.tsx (Branch 2 catalog-shell module render) deliberately uses 'FollowedOwnersModule' in prose but never 'import getFollowedOwnersForCatalog' — preserves the B1 sibling-composition static guard's import-aware regex (which would false-positive on any prose containing both `import` and the function name)."
  - "Task 4 (checkpoint:human-verify) is a tracked-but-deferred gate. Implementation is complete + build-green; mobile/visual + soft-nav PPR safety verifies on prod (Vercel) after cache fills, per feedback_mobile_ui_verify_on_prod and project_ppr_dynamic_before_use_cache memories. Local UI verification is meaningless (empty local test DB, no follows seeded, cannot reproduce the cache-fill timing window)."
metrics:
  duration: "~8 minutes (single sequential execution)"
  completed: 2026-05-28
  tasks_complete: 3
  tasks_deferred: 1  # Task 4 — prod human-verify after deploy
  files_modified: 2
  files_created: 2  # SUMMARY.md + deferred-items.md
  commits: 3
---

# Phase 65 Plan 03: Follow-Scoped Owners Module — Integration Summary

Wires Plan 01's `getFollowedOwnersForCatalog` DAL and Plan 02's
`FollowedOwnersModule` pure-RSC into the live `/w/[ref]` route on all three
render branches. Implementation is complete and build-green; the
post-deploy prod human-verify checkpoint (Task 4) is intentionally deferred
per `feedback_mobile_ui_verify_on_prod` — mobile / visual / soft-nav PPR
safety can only be confirmed on Vercel after cache fills.

Phase 65 ships fully integrated end-to-end (DAL → RSC → integration) once
this is deployed, realizing FOLL-01..04 observably on prod.

## What Shipped

### Hero extension (Task 1)

**File:** `src/components/watch/WatchDetailHero.tsx` (24 insertions, 0
deletions — strictly additive)

- **Two new imports**: `FollowedOwnersModule` (component) +
  `import type { FollowedOwner } from '@/data/follows'` (D-11 — type-only;
  the server-only DAL function is NEVER imported into this 'use client'
  island, locked by the new Task 3 static guard).
- **`WatchDetailHeroProps` extended** with two new optional fields
  (`followedOwners?: FollowedOwner[]` + `followedOwnersTotal?: number`),
  each with JSDoc citing FOLL-01..04 + D-01a null-handling at the call
  site.
- **Function signature destructuring extended** to include the two new
  field names (after the existing `viewerIsFollowingForWears`).
- **New `<FollowedOwnersModule owners={followedOwners ?? []} totalCount={followedOwnersTotal ?? 0} />`
  render** inserted INSIDE the right column's `space-y-6` container,
  AFTER the LikeButton+jump-to-comments block (line ~298) and BEFORE
  the Last-Worn line (line ~300). Safe `?? []` / `?? 0` defaults make
  the new render backward-compatible for any caller that hasn't been
  updated.
- **No `<Suspense>` wrapper** around the module — D-09 — only the
  page-level Promise.all matters; a Suspense inside the client island
  would corrupt the PPR boundary per RESEARCH Anti-Patterns.

### Page integration (Task 2)

**File:** `src/app/w/[ref]/page.tsx` (36 insertions, 2 deletions — 6
additive edits)

- **2 new imports** as dedicated lines:
  - `import { getFollowedOwnersForCatalog } from '@/data/follows'`
  - `import { FollowedOwnersModule } from '@/components/insights/FollowedOwnersModule'`
- **Branch 1 Promise.all (lines ~171-174)** extended from 2-tuple to
  3-tuple. New entry:
  `watch.catalogId ? getFollowedOwnersForCatalog(watch.catalogId, user.id, { limit: 5 }) : Promise.resolve({ owners: [], totalCount: 0 })`.
- **Branch 1 `<WatchDetailHero>` call** (formerly lines 337-355) gets
  two new props (`followedOwners={followedOwners.owners}` +
  `followedOwnersTotal={followedOwners.totalCount}`).
- **Branch 2 owned sub-branch** — new serial-await const
  `ownedFollowedOwners = ownedWatch.catalogId ? await getFollowedOwnersForCatalog(...) : { owners: [], totalCount: 0 }`
  added alongside `ownedSameFamily` / `ownedLineage` (mirrors the
  existing serial-await pattern on this sub-branch).
- **Branch 2 owned `<WatchDetailHero>` call** gets the matching two
  new props.
- **Branch 2 pure-catalog Promise.all** extended from 8-tuple to
  9-tuple. New entry `getFollowedOwnersForCatalog(ref, user.id, { limit: 5 })`
  inserted AFTER `getCollectorsForCatalog` (existing `roster`) and
  BEFORE `getSameFamilyForCatalog`. Destructure renamed to add
  `followedOwnersForCatalog` in the matching position. No ternary
  guard — `ref` is guaranteed on this branch.
- **Branch 2 pure-catalog inline hero shell** gets a DIRECT
  `<FollowedOwnersModule owners={followedOwnersForCatalog.owners} totalCount={followedOwnersForCatalog.totalCount} />`
  render inserted ABOVE the existing `<OtherOwnersRoster>` —
  D-03a: both rosters coexist on Branch 3 by design.

**PPR-scaffolding preservation** (verified by `git diff` showing zero
`-` lines for these patterns):
- `export const unstable_instant = false` (line 50) — UNTOUCHED
- `await connection()` (line 96) — UNTOUCHED
- outer-sync default export + `<Suspense fallback={<WatchPageSkeleton />}>` (lines 83-101) — UNTOUCHED
- existing `<OtherOwnersRoster collectors={...} totalCount={...} />` (line 737) — UNTOUCHED (same props, same position)

### Static-guard extension (Task 3)

**File:** `tests/static/watch-detail-ia-order.test.ts` (35 insertions, 0
deletions — 2 new describe blocks appended)

- **Preserved**: `// @vitest-environment node` pragma on line 1
  (load-bearing per `project_vitest_static_node_env` — under jsdom
  `node:fs` is externalized and `readFileSync` is undefined, which would
  pass locally but fail Vercel prebuild). The existing `activeLineNumbers`
  helper, file-path constants, and all 4 prior describe blocks
  (PAGE-01/02, PAGE-03 CommentThread, PAGE-04, mobile-header) untouched.
- **New describe 1 — FOLL-04 (Phase 65)**: asserts
  `getFollowedOwnersForCatalog(` appears in ACTIVE code in `page.tsx`
  on at least 3 lines (one per branch). Helper filters out comments,
  imports, and blank lines so prose mentioning the function name does
  not self-invalidate. RED before Task 2 (0 calls) → GREEN after Task 2
  (3 calls).
- **New describe 2 — B1 sibling-composition (Phase 65)**: asserts
  `WatchDetailHero.tsx` does NOT contain
  `import { ... getFollowedOwnersForCatalog ... } from ...` — the
  import-aware regex deliberately catches the FUNCTION name in an
  import block while allowing `import type { FollowedOwner }` (type-only
  imports are required per D-11). Passes from RED → GREEN trivially
  (the hero never imports the function); the value is the negative
  regression check.

## Tasks Completed

| # | Task | Commit | Files | Gate Result |
|---|------|--------|-------|-------------|
| 3 | Author 2 new failing static guards (RED) | `ea99d1d5` | `tests/static/watch-detail-ia-order.test.ts` | FOLL-04 RED (0 calls); B1 GREEN |
| 1 | Extend WatchDetailHero with FollowedOwnersModule sibling + 2 new optional props (GREEN for B1 invariant; FOLL-04 still RED until Task 2) | `44e208ba` | `src/components/watch/WatchDetailHero.tsx` | 12 static tests pass; FOLL-04 still RED (0 calls) |
| 2 | Wire 3 pre-fetch sites + 2 hero prop passes + 1 direct render into page.tsx (GREEN for FOLL-04 → all 17 static tests pass) | `18ee53e9` | `src/app/w/[ref]/page.tsx` | All 17 static tests pass; build exit 0 |
| 4 | Prod human-verify (10-step checklist) — **DEFERRED to post-deploy** | — | (no files) | Pending: requires push origin/main + Vercel deploy + ~2-3 min cache fill before walk-through |

### TDD Gate Compliance

Per the plan-level TDD gate sequence (Task 1, 2, 3 are all `tdd="true"`):

1. ✅ **RED commit** `ea99d1d5` — `test(65-03): add failing static guards for Phase 65 integration` — confirmed RED on the FOLL-04 ≥3-call assertion (count was 0; expected ≥3). The B1 sibling-composition assertion passed from the start because the hero never imported the function — this is intentional (the test's value is the negative regression check, not a pre-implementation failure).
2. ✅ **GREEN commit (Task 1)** `44e208ba` — `feat(65-03): extend WatchDetailHero with FollowedOwnersModule sibling` — B1 sibling-composition assertion remains GREEN (hero only imports the FollowedOwner TYPE, never the function).
3. ✅ **GREEN commit (Task 2)** `18ee53e9` — `feat(65-03): wire getFollowedOwnersForCatalog into /w/[ref] (FOLL-01..04)` — FOLL-04 assertion now passes (3 active-code calls). All 17 static tests in the file are GREEN.
4. _REFACTOR not needed_ — additive integration; no cleanup pass required.

The plan tasks are written in implementation order (Task 1 hero, Task 2 page, Task 3 guard), but commits follow TDD gate order (test commit first, feat commits after). This matches the `<tdd_execution>` rules.

## Acceptance Criteria Verification

### Task 1 (Hero extension)

| Assertion | Expected | Actual | Status |
|-----------|----------|--------|--------|
| `^import { FollowedOwnersModule } from '@/components/insights/FollowedOwnersModule'` | 1 | 1 | ✅ |
| `^import type { FollowedOwner } from '@/data/follows'` | 1 | 1 | ✅ |
| NO function import: `import.*getFollowedOwnersForCatalog` | 0 | 0 | ✅ |
| `followedOwners?:` (interface field) | 1 | 1 | ✅ |
| `followedOwnersTotal?:` (interface field) | 1 | 1 | ✅ |
| Destructured `followedOwners,` | ≥1 | 1 | ✅ |
| Destructured `followedOwnersTotal,` | ≥1 | 1 | ✅ |
| `<FollowedOwnersModule` | 1 | 1 | ✅ |
| `owners={followedOwners ?? []}` | ≥1 | 1 | ✅ |
| `totalCount={followedOwnersTotal ?? 0}` | ≥1 | 1 | ✅ |
| TS: `tsc --noEmit` adds no new errors mentioning WatchDetailHero.tsx | clean | clean | ✅ |
| Build: `npm run build` exits 0 | 0 | 0 | ✅ |
| Pre-existing static guard `watch-detail-ia-order.test.ts` regression-free | pass | 12/13 (one new FOLL-04 still RED — fixed in Task 2) | ✅ |

### Task 2 (Page integration)

| Assertion | Expected | Actual | Status |
|-----------|----------|--------|--------|
| `^import { getFollowedOwnersForCatalog } from '@/data/follows'` | 1 | 1 | ✅ |
| `^import { FollowedOwnersModule } from '@/components/insights/FollowedOwnersModule'` | 1 | 1 | ✅ |
| `getFollowedOwnersForCatalog(` count (any line) | ≥3 | 3 | ✅ |
| `followedOwners={` (hero props) + `<FollowedOwnersModule` (direct render) combined | ≥3 | 2 + 1 = 3 | ✅ |
| Branch 1 ternary `watch.catalogId ? getFollowedOwnersForCatalog` (multi-line) | ≥1 | 1 (perl `s` flag) | ✅ |
| Branch 2 owned ternary `ownedWatch.catalogId ? (await )?getFollowedOwnersForCatalog` (multi-line) | ≥1 | 1 (perl `s` flag) | ✅ |
| `OtherOwnersRoster` render line preserved | no `-` lines | only `+` lines in new comment | ✅ |
| `await connection()` line preserved | no `-` lines | no `-` lines | ✅ |
| `export const unstable_instant = false` line preserved | no `-` lines | no `-` lines | ✅ |
| Build: `npm run build` exits 0 | 0 | 0 | ✅ |
| `tests/static/ppr-dynamic-before-use-cache.test.ts` (PPR-ordering invariant) | pass | 4/4 pass | ✅ |
| `tests/static/watch-detail-ia-order.test.ts` (extended) | pass | 15/15 pass | ✅ |

### Task 3 (Static-guard extension)

| Assertion | Expected | Actual | Status |
|-----------|----------|--------|--------|
| Line 1 is exactly `// @vitest-environment node` | yes | yes | ✅ |
| `describe(` block count | ≥6 (was 5) | 7 (5 prior + 2 new) | ✅ |
| `FOLL-04 (Phase 65)` describe present | 1 | 1 | ✅ |
| `B1 sibling-composition (Phase 65)` describe present | 1 | 1 | ✅ |
| `toBeGreaterThanOrEqual(3)` against call count | ≥1 | 1 | ✅ |
| Import-aware regex `/import\s*\{[^}]*getFollowedOwnersForCatalog[^}]*\}\s*from/` (NOT fuzzy substring) | ≥1 | 1 | ✅ |
| Behavior: new tests pass after Tasks 1+2 | pass | 2/2 pass | ✅ |
| Behavior: pre-existing tests still pass | pass | 11/11 pass (PAGE-01/02/03/04 + mobile-header) | ✅ |

### Task 4 (DEFERRED — prod human-verify after deploy)

The 10-step checklist (desktop placement on B1/B2/B3, mobile single-column
collapse, "+N more" overflow caption, soft-nav PPR safety after cache fill,
owner self-exclusion, privacy gate) is documented in the PLAN's
`<how-to-verify>` block. Build is green; ready for push origin/main +
Vercel deploy + ~2-3 minute cache fill + user walk-through. See
`<Deferred Verification>` section below.

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Static guards (new + existing) | `npx vitest run tests/static/watch-detail-ia-order.test.ts tests/static/ppr-dynamic-before-use-cache.test.ts --reporter=verbose` | **17 passed (17)** (15 in IA-order incl. 2 new + 4 in PPR-ordering invariant — re-confirmed AFTER Task 2 wire-up + 36-line page.tsx diff stayed inside MAX_LOOKAHEAD=70) |
| TypeScript (filter to phase files) | `npx tsc --noEmit 2>&1 \| grep -E "(page\\.tsx\|WatchDetailHero\\.tsx\|follows\\.ts\|FollowedOwnersModule\\.tsx)"` | empty (0 new errors) |
| Build (authoritative gate) | `npm run build` | **exits 0** (◐ Partial Prerender preserved on `/w/[ref]` — PPR contract intact) |
| Full test suite | `npm run test` | 232 files pass / 3 fail / 49 skipped — 6154 tests pass / 10 fail / 356 skipped. All 10 failures are PRE-EXISTING baseline (verified by stash + re-run on HEAD); none attributable to Phase 65 Plan 03. See `<Deferred Issues>` below. |

## Deferred Verification (Task 4 — prod human-verify)

Per `feedback_mobile_ui_verify_on_prod` ("user confirms mobile/visual
behavior on prod, not locally") and `project_ppr_dynamic_before_use_cache`
("Build can't confirm; verify on prod AFTER cache fills"), the 10-step
human-verify checklist for Phase 65 MUST run on prod:

**Pre-deploy gates (all GREEN):**
- ✅ `npm run build` exits 0
- ✅ All 17 Phase 65 + PPR-ordering static guards pass
- ✅ TypeScript clean on all 4 phase files
- ✅ No deletions in any commit; no Phase 51/52/61 PPR scaffolding touched

**Required next step (USER ACTION):**
1. `git push origin main` → Vercel deploys
2. Wait 2-3 minutes after deploy completion (PPR cache must fill)
3. Walk through the 10-step checklist in 65-03-PLAN.md `<how-to-verify>`:
   - Step 3: Desktop B1 placement (owned watch — "From your circle" between like+jump and Last-Worn)
   - Step 4: Desktop B1 non-owner / null-catalogId (entire module absent)
   - Step 5: B3 pure-catalog (BOTH rosters coexist — "From your circle" above "X collectors own this")
   - Step 6: Mobile single-column collapse (375-414px viewport; 44px chip tap targets)
   - Step 7: Overflow "+N more" caption (only if >5 followed owners exist)
   - Step 8: Soft-nav PPR safety — repeat 2-3 soft-navs from different originating routes; ZERO React #419; ZERO 404 on URLs that work on hard refresh
   - Step 9: Owner self-exclusion (you NEVER appear in your own "From your circle")
   - Step 10: Privacy gate (private-profile users you follow do NOT appear)

If any check fails, route to gap-closure planning. If all 10 pass, type
"approved" and Phase 65 ships.

## Deviations from Plan

**None functional.** Plan 03 executed exactly as written.

The only structural choices were:

1. **Commit ORDER** — plan lists Task 1 (hero) → Task 2 (page) → Task 3 (test), but TDD plan-level gate requires the `test(...)` commit to precede the `feat(...)` commits. I committed Task 3 (tests) first as RED, then Task 1 (hero) as partial GREEN, then Task 2 (page) as full GREEN. Matches the `<tdd_execution>` rules.

2. **Multi-line ternary formatting on Branches 1 + 2-owned** — the plan's acceptance-criterion grep regex was single-line shape (`watch.catalogId\s*\?\s*getFollowedOwnersForCatalog`), but the project's existing precedent at page.tsx line 312 (`watch.catalogId ? getCatalogById(watch.catalogId) : Promise.resolve(null)`) is single-line ONLY because the call fits in 80-ish columns. The new DAL call `getFollowedOwnersForCatalog(watch.catalogId, user.id, { limit: 5 })` is longer; placing the ternary on multi-line matches the prettier conventions throughout this codebase. Verified the structural intent via multi-line perl regex (1 + 1 occurrences as expected). The plan's grep showed 0 false-negative — documented for the verifier.

3. **Imports as 2 separate lines** — the plan's acceptance criterion required a dedicated `^import { getFollowedOwnersForCatalog } from '@/data/follows'` line, so I added it as a separate line from the existing `import { isFollowing } from '@/data/follows'` rather than merging. Slightly less DRY but matches the acceptance regex exactly.

## Deferred Issues (out-of-scope discoveries during execution)

Tracked in `.planning/phases/65-follow-scoped-owners-module/deferred-items.md`:

1. **`FollowedOwnersModule.tsx` uses `font-medium`** (raw-palette test failure) — pre-existing on HEAD before Plan 03 began (verified by `git stash` + re-run); originates from Plan 02 (commit `0e23bc74`) which Plan 02's verifier did not catch. Plan 03 deliberately does NOT modify `FollowedOwnersModule.tsx` (per the `<files_modified>` frontmatter on the plan — out of scope for this integration plan). Suggested resolution: Plan 65-02 follow-up swap to a semantic-token utility, OR sweep as part of an existing palette-invariant cleanup phase.

Other observed `npm run test` failures (all pre-existing baseline, per `project_baseline_not_green_build_is_gate`):

- `tests/no-raw-palette.test.ts > CommentGateLocked.tsx font-medium` (pre-existing per memory)
- `tests/components/watch-photo-section.test.tsx` — 4 PHOTO-05/06 tests (pre-existing baseline)
- `tests/lib/signCoverUrls.test.ts` — 4 tests failing with `supabaseUrl is required` (env-related: vitest does NOT auto-load `.env.local`)

NONE of the failures appeared after Task 2 wiring — confirmed by stashing
Task 2 and re-running the same vitest target on HEAD~ — identical 10
failures. None attributable to Phase 65 Plan 03.

## Authentication Gates

None. Phase 65 is read-only; auth surface is inherited via the existing
`getCurrentUser()` gate at page.tsx line 153. No new endpoints, no new
actions, no new cookies.

## Known Stubs

None. The integration is fully wired:
- DAL pre-resolves data on all 3 branches with correct null-handling
- Hero consumes via props with safe defaults
- Module renders on Branch 2 pure-catalog without going through the hero
- Component's own hide-if-empty handles the zero-followed-owners case
- No placeholder text, no mock data, no empty-prop pass-throughs

Plan 03 makes Phase 65 observable end-to-end once deployed.

## Threat Flags

None. The integration introduces no new security surface beyond what
Plans 01 + 02 already established (and whose threat models already
covered). Specifically:

- **No new endpoints** — the new DAL call is invoked from RSC during the
  existing page render; no new HTTP path, no new server action.
- **No new auth surface** — inherits `getCurrentUser()` gate.
- **No new schema** — read-only joins against existing tables (`follows`,
  `watches`, `profiles`, `profile_settings`).
- **No new trust boundary** — resolved data flows server → client as JSON
  props (plain `FollowedOwner[]` + `number`); no closures, no functions,
  no opaque tokens. Same boundary shape as `signedPhotos` / `wearPics` /
  `verdict` already established on the route.

The threat-register items from the PLAN are all mitigated:

- **T-65-11** (PPR cross-viewer cache leak) — Mitigated. New DAL is NOT
  wrapped in `'use cache'`; `await connection()` (line 96) and
  `unstable_instant = false` (line 50) remain intact (verified by `git
  diff` showing zero `-` lines for both patterns). The resolved data is
  per-request and is NEVER part of a shared static shell.
- **T-65-12** (React #419 soft-nav regression) — Mitigated. The
  pre-existing static guard `tests/static/ppr-dynamic-before-use-cache.test.ts`
  passes after Task 2; the new DAL adds a handful of lines per branch but
  the `createSupabaseAdminClient` → `getLikesForTargetCached` lookahead
  stays within MAX_LOOKAHEAD=70. Task 4 prod human-verify catches any
  residual cache-fill timing regression.
- **T-65-13** (B1 invariant violation) — Mitigated. Task 3's new B1
  sibling-composition static guard fails CI if the hero ever imports the
  DAL function in a future refactor. Confirmed GREEN: the hero only
  imports `FollowedOwner` as a TYPE.
- **T-65-14** (Branch 1 null-catalogId crash) — Mitigated. The
  `watch.catalogId ? getFollowedOwnersForCatalog(...) : Promise.resolve({...})`
  ternary mirrors the existing sameFamily/lineage/catalog-entry pattern
  (page.tsx lines 312, 328-329). The DAL signature is strict
  (`catalogId: string`); any future caller dropping the guard fails at TS
  compile time.
- **T-65-15** (Branch 2 OtherOwnersRoster regression) — Mitigated. The
  existing `<OtherOwnersRoster collectors={roster.collectors}
  totalCount={roster.totalCount} />` line is structurally unchanged
  (verified by `git diff` showing only `+` lines in the new comment
  ABOVE it). D-03a — same props, same position.

## Self-Check: PASSED

**Files exist:**
- `[ -f src/app/w/\[ref\]/page.tsx ]` → FOUND (modified — 36/-2)
- `[ -f src/components/watch/WatchDetailHero.tsx ]` → FOUND (modified — 24/0)
- `[ -f tests/static/watch-detail-ia-order.test.ts ]` → FOUND (modified — 35/0)
- `[ -f .planning/phases/65-follow-scoped-owners-module/65-03-SUMMARY.md ]` → FOUND (this file)
- `[ -f .planning/phases/65-follow-scoped-owners-module/deferred-items.md ]` → FOUND

**Commits exist:**
- `git log --oneline | grep -q "ea99d1d5"` → FOUND (RED: `test(65-03): add failing static guards for Phase 65 integration`)
- `git log --oneline | grep -q "44e208ba"` → FOUND (GREEN-1: `feat(65-03): extend WatchDetailHero with FollowedOwnersModule sibling`)
- `git log --oneline | grep -q "18ee53e9"` → FOUND (GREEN-2: `feat(65-03): wire getFollowedOwnersForCatalog into /w/[ref] (FOLL-01..04)`)

**Verification commands re-run at self-check time:**
- Phase 65 + PPR static guards: 17/17 pass
- TypeScript filtered to phase files: 0 new errors
- `npm run build`: exit 0
- All file-existence + commit-existence checks: PASS

Implementation is complete. Task 4 (prod human-verify) is intentionally
deferred to post-deploy and tracked as a known gate in the "Deferred
Verification" section above.

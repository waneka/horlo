---
phase: 81-recommender-display-server-action-swap
plan: 03
subsystem: server-actions / write-path / canonical-overwrite
tags:
  - phase-81
  - server-actions
  - canonical-overwrite
  - write-path
  - DISP-01
  - DISP-02
dependency-graph:
  requires:
    - Plan 01 extended catalog helper return shapes (getCatalogById → CatalogEntryWithCanonical; upsertCatalogFromUserInput → { catalogId, brandName, familyName })
    - Phase 80 NOT NULL watches_catalog.brand_id + family_id (INGEST-01..04)
    - Phase 75 D-02 read-your-own-write via updateTag (invariant preserved)
  provides:
    - addWatch persists canonical brand/model on BOTH branches (catalogId-supplied + user-input)
    - editWatch canonical overwrite before UPDATE (guarded on priorRow.catalogId + brand/model edit)
    - Non-catalog-linked (Phase 17 ON DELETE SET NULL legacy) watches bypass overwrite — user-typed strings persist
    - 4 new unit cases exercising all four DISP surfaces
  affects:
    - Plan 04 (local-first drift-fixture UAT) — write-path canonicalization is the final piece of the Hamilton drift-loop closure
tech-stack:
  added: []
  patterns:
    - Guarded conditional overwrite (`if priorRow.catalogId && (brand !== undefined || model !== undefined)`)
    - Dual-payload mutation (cleanData + updatePayload both updated for transaction- and non-transaction-path parity)
    - Defensive catalogRow-null skip (fail-safe over fail-loud — implies a race with catalog deletion)
    - Test-mock-shape adaptation for pre-existing tests unaware of Plan 01's widened return shape (Rule 1)
    - TDD RED/GREEN sequenced across two commits (test-only commit, then impl+test-mock-fixup commit)
key-files:
  created:
    - .planning/phases/81-recommender-display-server-action-swap/81-03-SUMMARY.md
  modified:
    - src/app/actions/watches.ts
    - src/app/actions/__tests__/watches-recs-invalidation.test.ts
    - tests/actions/watches.test.ts
decisions:
  - Selected inline dual-payload updates (cleanData + updatePayload both mutated) over a single-payload helper — the owned→sold transaction path (L708-731) reads updatePayload via Object.entries; the non-transaction path (L737) reads updatePayload directly. Both consumers stay pointed at updatePayload so the transaction-boundary semantics of D-11 are preserved.
  - Kept defensive catalogRow-null skip (fail-safe over fail-loud). priorRow.catalogId is guaranteed non-null by the guard, but a race with catalog deletion between priorRow fetch and getCatalogById fetch is theoretically possible; fail-safe matches the recommender's LEFT-JOIN degradation pattern and avoids a 500 on the user's edit.
  - Two test-mock fixups counted as Rule 1 (bug fixes on scope-adjacent tests that predated the Plan 01 shape widening and now fail on Plan 03's canonical-source swap). Alternative was a Plan 01 retroactive test update, but Plan 01's summary didn't touch tests/actions/watches.test.ts — Plan 03's canonicalBrand swap surfaced the gap.
  - Case 8 (non-catalog-linked skip) already passed at RED — the test asserts today's no-op behavior which happens to be identical to the Phase 81 desired behavior. Kept the case anyway; it's now a regression guard against future edits that accidentally wire overwrite unconditionally.
metrics:
  duration: 7m
  completed: 2026-07-12
  tasks_completed: 1/1
  files_modified: 3
  commits: 2
---

# Phase 81 Plan 03: Canonical Write-Time Overwrite Summary

**One-liner:** Wired DISP-01 (addWatch canonical brand/model persist on both branches) + DISP-02 (editWatch canonical overwrite before UPDATE) — the write-path complement to Plan 02's read-path canonicalization; personal watches now never carry free-text drift on new writes.

## Tasks Executed

| # | Name | Commit(s) | Status |
|---|------|-----------|--------|
| 1 | Wire DISP-01/02 canonical overwrite into addWatch (both branches) + editWatch, preserving fail-loud + ActionResult contract; extend watches-recs-invalidation.test.ts with 4 DISP cases | f06f367f (RED) → b62a17b6 (GREEN) | ✓ |

## File Diff Shape

| File | Before | After | Change |
|------|-------:|------:|:------:|
| src/app/actions/watches.ts | 904 | 963 | +59 — canonicalBrand/canonicalFamily swap on addWatch catalogId branch; upsertResult.brandName/familyName consumption on user-input branch (comment-marker → actual assignment); new DISP-02 overwrite block (44 lines including JSDoc) in editWatch before owned→sold detection |
| src/app/actions/__tests__/watches-recs-invalidation.test.ts | 231 | 462 | +231 — mkWatchRow accepts catalogId override (null path for Case 8); new mkCatalogRow helper builds CatalogEntryWithCanonical mocks; 4 new DISP cases (Cases 5-8) with Hamilton drift-loop fixture (canonical `Hamilton` vs denorm `Hamilton Watch`) |
| tests/actions/watches.test.ts | 461 | 470 | +9 — catalogRow mock projects canonicalBrand/canonicalFamily (Rule 1 fix — was breaking CONF-11 test (c)); upsertCatalogFromUserInput default mock returns brandName='Omega' / familyName='Seamaster' matching validWatch (Rule 1 fix — was breaking AUTH-02 test) |

## Interface Contracts Consumed (from Plan 01)

- `getCatalogById(id): Promise<CatalogEntryWithCanonical | null>` — extended with `canonicalBrand: string` + `canonicalFamily: string`. Consumed at addWatch L143 + editWatch L664.
- `upsertCatalogFromUserInput(input): Promise<{ catalogId, brandName, familyName } | null>` — the `brandName` + `familyName` fields (unused until Plan 03) are consumed at addWatch L197-198.

## Verification (all pass)

- **`npm run build` → exits 0** — 6.3s. Authoritative gate per `[[baseline-not-green-build-is-gate]]`.
- **`npm run test -- src/app/actions/__tests__/watches-recs-invalidation.test.ts` → 8/8 pass** (4 Phase 75 cache-invalidation + 4 Phase 81 DISP-01/02). Duration ~63ms test-run.
- **Broader Server Action suite** (`tests/actions/watches.test.ts + src/app/actions/__tests__/moveWishlistToCollection.test.ts + watches-recs-invalidation.test.ts`) — 8 failures / 36 passing / 44 total. The 8 failures are IDENTICAL to the pre-Plan-03 baseline (activity-log DrizzleQueryError runtime noise — DAL mocks don't wire a working `db` object; out of scope per `[[baseline-not-green-build-is-gate]]`). 0 new failures introduced by Plan 03.
- **Grep armor final counts on src/app/actions/watches.ts:**
  - `canonicalBrand` → 3 matches (L161 addWatch catalogId branch, L667+L668 editWatch overwrite path) — meets ≥ 3 threshold.
  - `upsertResult.brandName|upsertResult.familyName` → 2 matches (L197, L198 addWatch user-input branch) — meets ≥ 2 threshold.
  - `priorRow.catalogId` → 6 matches (comment refs + guard at L661 + fetch at L664 + owned→sold pre-transaction guard at L694 + transaction non-null assertion at L708) — meets ≥ 1 threshold.
  - `updateTag` → 4 recs-tag call sites (addWatch L362, moveWishlistToCollection L554, editWatch L743, removeWatch L795) unchanged from pre-Plan-03 baseline — no invalidation regressed.
  - `= ANY(` → 0 matches — Drizzle `sql\`= ANY(${arr})\`` anti-pattern intentionally NOT introduced (`[[drizzle-sql-any-array-pitfall]]` respected).
- **Fail-loud contract preserved:** L184-186 in addWatch user-input branch — the `if (!upsertResult) throw new Error(...)` guard is intact and executes BEFORE the L197-198 destructure would otherwise crash on null.
- **Cache-invalidation contract preserved verbatim:**
  - addWatch: `updateTag(\`viewer:${user.id}:recs\`)` (L362) + `revalidateTag('explore', 'max')` (L382) + `revalidateTag(\`profile:${username}\`, 'max')` (L371) — all present.
  - editWatch: `updateTag(\`viewer:${user.id}:recs\`)` (L743) + `revalidateTag('explore', 'max')` (L761) + `revalidateTag(\`profile:${username}\`, 'max')` (L752) — all present. (Line numbers shifted +67 vs pre-Plan-03 due to the DISP-02 overwrite block insertion; call semantics identical.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing tests in tests/actions/watches.test.ts had catalog / upsert mocks unaware of Plan 01's return-shape widening; broke on Plan 03's canonicalBrand swap**

- **Found during:** Task 1 GREEN verification (after RED landed, before final commit) — broader `tests/actions/watches.test.ts` run showed 10 failures vs. 8 pre-Plan-03 baseline. Two new failures.
- **Issue:**
  1. `AUTH-02 > addWatch calls DAL.createWatch with session user.id` (L109) — passes `validWatch = { brand: 'Omega', model: 'Seamaster', ... }` and asserts `createWatch(_, _, expect.objectContaining(validWatch))`. Under Plan 03, addWatch's user-input branch NOW overwrites cleanData.brand/model from the upsertCatalogFromUserInput mock's return. Pre-Plan-03, the default mock returned `brandName: 'MockBrand', familyName: 'MockModel'` (added in Plan 01) which mismatched validWatch — so the assertion failed on `brand='MockBrand'` vs expected `brand='Omega'`.
  2. `addWatch — catalogId branch (CONF-11) > (c) catalogId + client brand="WRONG" → created watch uses catalogRow.brand` (L406) — passes catalogRow with `brand: 'Omega'` but no `canonicalBrand` field, and asserts `createWatch(_, _, expect.objectContaining({ brand: 'Omega' }))`. Under Plan 03, the catalogId branch reads `catalogRow.canonicalBrand` which is `undefined` in the mock → `brand=undefined` in the payload → assertion fails.
- **Fix:**
  1. Updated `upsertCatalogFromUserInput` default mock (L37-46) to return `brandName: 'Omega', familyName: 'Seamaster'` matching validWatch verbatim. Added a comment explaining why the mock values must track validWatch (see file L36-42).
  2. Added `canonicalBrand: 'Omega'` + `canonicalFamily: 'Speedmaster'` to the CONF-11 catalogRow mock (L390-391). Kept them identical to the denorm columns since the CONF-11 suite predates Phase 81's drift-loop scope and doesn't exercise drift.
- **Files modified:** `tests/actions/watches.test.ts` (+9 LOC — 2 mock updates + 8-line explanatory comment).
- **Commit:** `b62a17b6` (bundled with the impl in the GREEN commit — Rule 1 fix directly caused by the impl change, so co-located).

### None: Rule 2 (missing critical functionality)

The fail-loud on catalog-upsert-null, ownership gate via priorRow, and cache-invalidation contract were all already in place; Plan 03 preserved them verbatim without needing to add any critical functionality.

### None: Rule 3 (blocking issues)

Plan 01 already extended the catalog helper return shapes and updated all documented callsites (5 planned + 2 build-forced script callsites per Plan 01 summary). Plan 03 had no blocking upstream gaps.

### None: Rule 4 (architectural changes)

The DISP-02 overwrite path fit cleanly into the existing editWatch flow. No new tables, no schema changes, no new services. The dual-payload update pattern (cleanData + updatePayload) is a minor coordination detail, not architectural.

## Runtime Behavior

- **addWatch catalogId branch:** identical shape to Phase 79 backfill semantics — the denorm columns are IGNORED as an identity source; the FK-resolved canonical strings from `brands.name` / `watch_families.name` are the source of truth. Drift resistance verified via Case 5 (Hamilton fixture — canonical `Hamilton` vs drift denorm `Hamilton Watch`).
- **addWatch user-input branch:** the Phase 80 resolver already landed the catalog row on canonical brand_id + family_id; Plan 03 now surfaces the canonical strings the resolver produced (via Plan 01's CTE extension) into the personal `watches` row. User-typed drift like `Hamilton Watch` becomes `Hamilton` on save.
- **editWatch:** on a catalog-linked watch, editing brand or model triggers a canonical re-resolve via `getCatalogById(priorRow.catalogId)`. Rebranding attempts (typing a wholly different brand) still write the CATALOG's canonical brand — the schema doesn't let the user re-catalog via edit; they'd need to remove + re-add. This matches D-10 identity-truth semantics from Phase 38.
- **Non-catalog-linked (priorRow.catalogId=null) edits:** the guard short-circuits before any getCatalogById fetch — no wasted round-trip, and the user's typed brand/model persists. This is the Phase 17 `onDelete: 'set null'` legacy edge case; verified via Case 8.

## Local-First Development Gate

Per D-81-04, the drift-fixture walkthrough is milestone-close verification (Plan 04's responsibility). Plan 03's runtime effects are unit-test-covered end-to-end at the Server Action boundary (all 4 DISP cases assert the persisted payload), and the failure surfaces are typechecked (build passes). The bundled walkthrough at Plan 04 will exercise DISP-01/02 in `npm run dev` against local Supabase per the D-81-04 recipe (add a watch with brand `Hamilton Watch` → assert persisted as `Hamilton`; edit that watch, retype brand as `Hamilton Watch` → assert save persists as `Hamilton`).

## Requirements Marked Complete

- **DISP-01** — addWatch persists canonical brand/model on BOTH branches. Verified via Cases 5 (catalogId branch) + 6 (user-input branch) asserting `createCalls[0][2]` contains canonical strings.
- **DISP-02** — editWatch overwrites brand/model from canonical strings on catalog-linked watches. Verified via Case 7 asserting `updateCalls[0][2]` contains canonical strings after user-typed drift. Case 8 guards the non-catalog-linked-watch bypass (no `getCatalogById` call; user string persists).

## Self-Check: PASSED

- File `.planning/phases/81-recommender-display-server-action-swap/81-03-SUMMARY.md` exists (this file).
- Commit `f06f367f` exists in git log (RED — 4 failing DISP-01/02 cases added).
- Commit `b62a17b6` exists in git log (GREEN — impl + Rule 1 test-mock fixups).
- `npm run build` last run exits 0 in 6.3s.
- 8/8 targeted vitest cases pass on src/app/actions/__tests__/watches-recs-invalidation.test.ts.
- 0 new failures introduced across broader `tests/actions/watches.test.ts + src/app/actions/__tests__/moveWishlistToCollection.test.ts` — 8 pre-existing baseline failures unchanged.
- Grep armor thresholds met (canonicalBrand ≥3, upsertResult.brandName|familyName ≥2, priorRow.catalogId ≥1, = ANY( = 0).
- Cache-invalidation contract preserved verbatim: 4 `updateTag(\`viewer:${user.id}:recs\`)` call sites unchanged; 5 `revalidateTag('explore', 'max')` unchanged; 4 `revalidateTag(\`profile:...\`, 'max')` unchanged.
- Fail-loud on null-upsert preserved (L184-186 in addWatch user-input branch).
- Plan 04 (local-first UAT) can consume the Plan 03 write-path canonicalization without further code work.

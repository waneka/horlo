---
phase: 67-server-action-dal-extensions
verified: 2026-05-28T18:30:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "D-05 ORDER BY DESC NULLS LAST — fixed in commit eb65358a; both exactRefOrderTier branches now emit raw SQL with NULLS LAST modifier"
    - "D-10 reference-override null bypass — fixed in commit 8fe6498b; line 140 now unconditionally assigns catalogRow.reference ?? undefined; test case (f) added"
  gaps_remaining: []
  regressions: []
---

# Phase 67: Server Action + DAL Extensions — Verification Report

**Phase Goal:** The server-side seams that UI components will consume are in place — a new `searchCatalogForAddFlow` Server Action, `addWatch` with optional `catalogId` passthrough, and a `getWatchIdByCatalogId` DAL helper
**Verified:** 2026-05-28T18:30:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (commits eb65358a, 8fe6498b)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `searchCatalogForAddFlow('speedmaster')` returns catalog rows sorted with exact-reference matches first, each row including a `viewerState` badge field (`owned` / `wishlist` / null), with no N+1 queries | VERIFIED | src/data/catalog.ts:562-565. `exactRefOrderTier` now emits `sql\`... DESC NULLS LAST\`` for both the query-normalized and empty-query branches. viewerState hydration via single batched query lines 601-615. |
| 2 | `addWatch(data)` with `catalogId` supplied skips `upsertCatalogFromUserInput` and binds the new watch row to the existing catalog row via `getCatalogById` | VERIFIED | src/app/actions/watches.ts:126-158. When `cleanData.catalogId` is truthy: `getCatalogById` called; `upsertCatalogFromUserInput` call skipped; `catalogId = cleanData.catalogId` passed to `createWatch`. Test case (a) passes. |
| 3 | `findViewerWatchByCatalogId(userId, catalogId)` (named per D-06 — extends in place, not renamed) returns the user's watch `id` for a catalog row they own, or `null` if they don't — verified by a unit test | VERIFIED | src/data/watches.ts:295-322. Function extended in-place. Returns `{ id, status }` or null. 5/5 unit tests pass. |
| 4 | D-01 respected: `searchCatalogForAddFlow` is a new sibling Server Action + DAL function; `searchCatalogWatches` and `searchWatchesAction` are untouched | VERIFIED | `grep -c "export async function searchCatalogWatches" src/data/catalog.ts` = 1; `grep -c "export async function searchWatchesAction" src/app/actions/search.ts` = 1. Both originals unchanged. |
| 5 | D-02 auth-first gate: `getCurrentUser` runs before Zod parse in `searchCatalogForAddFlow` | VERIFIED | src/app/actions/search.ts:161-166. `getCurrentUser()` in try/catch before `addFlowSearchSchema.safeParse(data)`. |
| 6 | D-05 ORDER BY: exact-reference tier uses `DESC NULLS LAST` so NULL-reference rows sort last | VERIFIED | src/data/catalog.ts:562-565. `exactRefOrderTier` computed as raw SQL: `sql\`(${watchesCatalog.referenceNormalized} = ${queryNormalized}) DESC NULLS LAST\`` (non-empty query) and `sql\`false DESC NULLS LAST\`` (empty query). Comment at line 559 documents the D-05 rationale. Drizzle `desc()` wrapper removed — raw fragment passed directly into `.orderBy()`. |
| 7 | D-10 identity override: `cleanData.reference` is always set from `catalogRow.reference` (including null), not conditionally | VERIFIED | src/app/actions/watches.ts:134-140. Line 140: `cleanData.reference = catalogRow.reference ?? undefined` — unconditional assignment. Comment at lines 134-137 documents the D-10 rationale and explicitly explains the null-coerce. Test case (f) at tests/actions/watches.test.ts:435-449 confirms `createWatch` is NOT called with `reference: 'FAKE-REF'` when `catalogRow.reference` is null. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/data/watches.ts` | Extended `findViewerWatchByCatalogId` with `statuses` param and widened return type | VERIFIED | Lines 295-322. Signature: `statuses: ('owned' | 'wishlist')[] = ['owned']`. Return: `{ id: string; status: 'owned' | 'wishlist' } | null`. CASE ORDER BY for D-08 owned-wins. |
| `src/data/catalog.ts` | New `searchCatalogForAddFlow` DAL function (sibling of `searchCatalogWatches`) | VERIFIED | Function exists (lines 518-641) with correct structure. Both ORDER BY tier 1 branches use raw `DESC NULLS LAST` SQL fragments as required by D-05. |
| `src/app/actions/search.ts` | New `searchCatalogForAddFlow` Server Action + `addFlowSearchSchema` Zod schema | VERIFIED | Lines 135-184. Sibling of `searchWatchesAction`. `addFlowSearchSchema` is a new `{ q: z.string(), limit: z.number().int().min(1).max(50).optional() }`. Auth-first gate. T-19-02-04 prefix. |
| `src/app/actions/watches.ts` | Extended `addWatch` with catalogId branch (D-09/D-10/D-11) + extended `insertWatchSchema` | VERIFIED | `catalogId: z.string().uuid().optional()` in schema (line 50). D-09 fail-fast present (line 130). D-11 enrichment-skip present (lines 171-240). D-10 brand/model/reference override all unconditional (lines 138-140). |
| `tests/data/findViewerWatchByCatalogId.test.ts` | 5-case unit test suite | VERIFIED | 5/5 tests pass. Covers cases (a) owned-only, (b) wishlist-only, (c) both-returns-owned (D-08), (d) no-rows, (e) default-owned-only backward-compat (BUG-01). |
| `tests/data/searchCatalogForAddFlow.test.ts` | 7-case unit test suite | VERIFIED | 7/7 tests pass. Covers 2-char gate, ORDER BY tiers, WHERE shape, empty short-circuit, anti-N+1, D-05 owned-wins, result mapping. |
| `tests/actions/watches.test.ts` | 6 new integration tests for CONF-11 catalogId branch (5 original + case (f)) | VERIFIED | 28/28 tests pass (6 new + 22 pre-existing). All 6 CONF-11 cases pass: (a) no-upsert, (b) fail-fast, (c) brand-override, (d) enrichment-skip, (e) enrichment-trigger, (f) D-10 null-clear. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/actions/search.ts searchCatalogForAddFlow` | `src/data/catalog.ts searchCatalogForAddFlow` | `import { searchCatalogForAddFlow as searchCatalogForAddFlowDAL } from '@/data/catalog'` | WIRED | Named import alias confirmed; action calls `searchCatalogForAddFlowDAL(...)` at line 174 |
| `src/app/actions/watches.ts addWatch` | `src/data/catalog.ts getCatalogById` | `catalogDAL.getCatalogById(cleanData.catalogId)` | WIRED | Line 128; inside `if (cleanData.catalogId)` branch |
| `src/data/catalog.ts searchCatalogForAddFlow` | `watches table viewerState query` | `inArray(watches.catalogId, topIds)` single batched query | WIRED | Lines 601-615; `topIds.length` guard present (Pitfall 4); single `db.select()` for hydration confirmed by test |
| `src/data/watches.ts findViewerWatchByCatalogId` | `src/app/w/[ref]/page.tsx` caller | structural-superset return type — caller reads only `.id` | WIRED | Confirmed: caller at line 439 reads `viewerOwnedRow.id` only at lines 473 and 497. Zero caller changes required. |

### Data-Flow Trace (Level 4)

The phase delivers server-side primitives (Server Actions + DAL helpers), not rendering components. Data-flow trace at Level 4 (component rendering) is not applicable. The DAL functions are the data-source layer; their test coverage verifies real query structure through Drizzle mock captures.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 5-case DAL test suite (findViewerWatchByCatalogId) | `npm test -- tests/data/findViewerWatchByCatalogId.test.ts --run` | 5/5 pass, exit 0 | PASS |
| 7-case DAL test suite (searchCatalogForAddFlow) | `npm test -- tests/data/searchCatalogForAddFlow.test.ts --run` | 7/7 pass, exit 0 | PASS |
| 6 CONF-11 integration tests (addWatch catalogId branch, incl. case (f)) | `npm test -- tests/actions/watches.test.ts --run` | 28/28 pass (6 new + 22 pre-existing), exit 0 | PASS |
| Full 3-suite run (40 targeted tests) | `npm test -- tests/data/findViewerWatchByCatalogId.test.ts tests/data/searchCatalogForAddFlow.test.ts tests/actions/watches.test.ts --run` | 40/40 pass (3 test files), exit 0 | PASS |
| Build gate | `npm run build` | "Compiled successfully in 5.5s", exit 0 | PASS |

### Probe Execution

No probe scripts declared or conventional for this phase type. Step 7c: SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CONF-11 | Plan 03 | `addWatch` Zod schema gains optional `catalogId`; when supplied, calls `getCatalogById` to bind watch row to existing catalog row | SATISFIED | `catalogId: z.string().uuid().optional()` in `insertWatchSchema` line 50; `getCatalogById` branch at lines 126-158; 6/6 integration tests green including D-10 null-clear case (f). |
| DUPE-01 (DAL part) | Plans 01, 02 | `findViewerWatchByCatalogId` returns user's owned watch id for a catalog row they own | SATISFIED | Function extended in-place; returns `{ id, status: 'owned' }` for owned rows; default `statuses=['owned']` preserves BUG-01 contract; 5/5 unit tests green. |
| DUPE-03 (DAL part) | Plans 01, 02 | Same function returns user's wishlist watch id (status surfaced for Phase 70 branching) | SATISFIED | `statuses=['owned', 'wishlist']` call returns wishlist row when no owned row exists; returns owned row when both exist (D-08 owned-wins); test cases (b) and (c) verify both. |

Note: REQUIREMENTS.md traceability maps DUPE-01 and DUPE-03 to Phase 70 (where user-observable UI behavior lands). Phase 67 delivers the DAL primitives these requirements depend on. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/data/watches.ts` | ~399 | `linkWatchToCatalog` is exported and has `@deprecated` marker since Phase 38; no callers in `src/` | INFO | Pre-existing dead code (WR-03 from REVIEW.md). Not introduced by Phase 67. Not a BLOCKER per debt-marker gate (the deprecated annotation is the documented marker; no unreferenced TBD/FIXME/XXX). |

### Human Verification Required

None — this phase delivers server-side primitives (Server Actions + DAL functions) that are fully verifiable through unit and integration tests plus the build gate. No visual rendering, real-time behavior, or external service integration is involved.

---

## Re-verification

**Initial status:** gaps_found (5/7), verified 2026-05-29T17:45:00Z

### Gap 1 — CR-02: D-05 ORDER BY missing NULLS LAST (CLOSED)

**Commit:** eb65358a

**Fix:** `desc(sql\`...\`)` wrappers removed from both branches of `exactRefOrderTier` in `src/data/catalog.ts`. Both branches now emit raw SQL fragments with the `DESC NULLS LAST` modifier inline:
- Non-empty query: `sql\`(${watchesCatalog.referenceNormalized} = ${queryNormalized}) DESC NULLS LAST\``
- Empty query fallback: `sql\`false DESC NULLS LAST\``

The D-05 rationale comment was also added (lines 559-561) explaining why the raw fragment is required instead of Drizzle's `desc()` helper.

**Evidence:** `src/data/catalog.ts:562-565` — both branches confirmed.

### Gap 2 — CR-01: D-10 reference-override null bypass (CLOSED)

**Commit:** 8fe6498b

**Fix:** Conditional `if (catalogRow.reference) cleanData.reference = catalogRow.reference` replaced with unconditional `cleanData.reference = catalogRow.reference ?? undefined` at `src/app/actions/watches.ts:140`. A four-line explanatory comment (lines 134-137) was added documenting the D-10 requirement and the null-coerce rationale.

**Test case (f) added:** `tests/actions/watches.test.ts:435-449`. Case (f) supplies `reference: 'FAKE-REF'` with `catalogRow.reference = null` and asserts `createWatch` is NOT called with `reference: 'FAKE-REF'` via `expect.not.objectContaining`. Test passes.

**Evidence:** `src/app/actions/watches.ts:140` and `tests/actions/watches.test.ts:435-449` — both confirmed. 40/40 tests pass, build exits 0.

---

_Verified: 2026-05-28T18:30:00Z_
_Verifier: Claude (gsd-verifier)_

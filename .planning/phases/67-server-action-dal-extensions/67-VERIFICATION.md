---
phase: 67-server-action-dal-extensions
verified: 2026-05-29T17:45:00Z
status: gaps_found
score: 5/7 must-haves verified
overrides_applied: 0
gaps:
  - truth: "searchCatalogForAddFlow ORDER BY tier 1 uses DESC NULLS LAST so rows with reference_normalized IS NULL sort after non-matching rows (D-05 spec)"
    status: failed
    reason: "Implementation uses desc(sql`(${watchesCatalog.referenceNormalized} = ${queryNormalized})`) which emits plain DESC. PostgreSQL's default NULLS FIRST under DESC causes rows with reference_normalized IS NULL to sort ahead of non-exact-matching rows that do have a reference — the inverse of the intended ordering."
    artifacts:
      - path: "src/data/catalog.ts"
        issue: "Line 561: desc(sql`(${watchesCatalog.referenceNormalized} = ${queryNormalized})`) emits DESC without NULLS LAST. Fix: sql`(${watchesCatalog.referenceNormalized} = ${queryNormalized}) DESC NULLS LAST` (raw SQL fragment, not wrapped in desc())"
    missing:
      - "Replace desc(sql`...reference_normalized...`) with sql`(${watchesCatalog.referenceNormalized} = ${queryNormalized}) DESC NULLS LAST` — same fix for the empty-query fallback: sql`false DESC NULLS LAST`"
      - "Update .orderBy() call to pass the raw SQL fragment directly instead of wrapping in desc()"

  - truth: "D-10 server-side identity override sets cleanData.reference to null when catalogRow.reference is null (catalog row IS the identity truth for the reference field)"
    status: failed
    reason: "Line 136 in src/app/actions/watches.ts: `if (catalogRow.reference) cleanData.reference = catalogRow.reference`. When catalogRow.reference is null the if-guard is falsy and the client-supplied reference passes through unmodified. For catalog rows with no reference number the canonical value is null, but a client can forge any reference string and it will be written to the watches row."
    artifacts:
      - path: "src/app/actions/watches.ts"
        issue: "Line 136: `if (catalogRow.reference) cleanData.reference = catalogRow.reference` — conditional guard prevents the null-override. D-10 requires unconditional assignment of the catalog identity truth."
    missing:
      - "Replace the conditional with an unconditional assignment: `cleanData.reference = catalogRow.reference ?? undefined` (null coerces to undefined to match the Watch domain type which uses string | undefined, not string | null)"
      - "Add a test case (f) to tests/actions/watches.test.ts: catalogId + catalogRow.reference=null + client reference='FAKE-REF' → createWatch called with reference that does NOT equal 'FAKE-REF' (verifies the null-clear)"
---

# Phase 67: Server Action + DAL Extensions — Verification Report

**Phase Goal:** The server-side seams that UI components will consume are in place — a new `searchCatalogForAddFlow` Server Action, `addWatch` with optional `catalogId` passthrough, and a `getWatchIdByCatalogId` DAL helper
**Verified:** 2026-05-29T17:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `searchCatalogForAddFlow('speedmaster')` returns catalog rows sorted with exact-reference matches first, each row including a `viewerState` badge field (`owned` / `wishlist` / null), with no N+1 queries | PARTIAL | DAL function exists and is wired; viewerState hydration is anti-N+1; ORDER BY has the exact-reference tier BUT uses plain `DESC` instead of `DESC NULLS LAST` — rows with NULL reference sort incorrectly (NULLS FIRST under PostgreSQL DESC) violating D-05 |
| 2 | `addWatch(data)` with `catalogId` supplied skips `upsertCatalogFromUserInput` and binds the new watch row to the existing catalog row via `getCatalogById` | VERIFIED | src/app/actions/watches.ts:126-158. When `cleanData.catalogId` is truthy: `getCatalogById` called; `upsertCatalogFromUserInput` call skipped; `catalogId = cleanData.catalogId` passed to `createWatch`. Test case (a) passes. |
| 3 | `findViewerWatchByCatalogId(userId, catalogId)` (named per D-06 — extends in place, not renamed) returns the user's watch `id` for a catalog row they own, or `null` if they don't — verified by a unit test | VERIFIED | src/data/watches.ts:295-322. Function extended in-place. Returns `{ id, status }` or null. 5/5 unit tests pass. |
| 4 | D-01 respected: `searchCatalogForAddFlow` is a new sibling Server Action + DAL function; `searchCatalogWatches` and `searchWatchesAction` are untouched | VERIFIED | `grep -c "export async function searchCatalogWatches" src/data/catalog.ts` = 1; `grep -c "export async function searchWatchesAction" src/app/actions/search.ts` = 1. Both originals unchanged. |
| 5 | D-02 auth-first gate: `getCurrentUser` runs before Zod parse in `searchCatalogForAddFlow` | VERIFIED | src/app/actions/search.ts:161-166. `getCurrentUser()` in try/catch before `addFlowSearchSchema.safeParse(data)`. |
| 6 | D-05 ORDER BY: exact-reference tier uses `DESC NULLS LAST` so NULL-reference rows sort last | FAILED | src/data/catalog.ts:561. `desc(sql\`(${watchesCatalog.referenceNormalized} = ${queryNormalized})\`)` emits plain `DESC` without NULLS LAST. PostgreSQL default for DESC is NULLS FIRST — NULL-reference rows sort before non-matching rows. D-05 spec explicitly requires `DESC NULLS LAST`. |
| 7 | D-10 identity override: `cleanData.reference` is always set from `catalogRow.reference` (including null), not conditionally | FAILED | src/app/actions/watches.ts:136: `if (catalogRow.reference) cleanData.reference = catalogRow.reference`. When catalog row has `reference = null` the guard is falsy and the client-supplied reference passes through unmodified. D-10 states the catalog row IS the truth for the (brand, model, reference) tuple. |

**Score:** 5/7 truths verified (2 FAILED — both are correctness violations of locked decisions D-05 and D-10)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/data/watches.ts` | Extended `findViewerWatchByCatalogId` with `statuses` param and widened return type | VERIFIED | Lines 295-322. Signature: `statuses: ('owned' | 'wishlist')[] = ['owned']`. Return: `{ id: string; status: 'owned' | 'wishlist' } | null`. CASE ORDER BY for D-08 owned-wins. |
| `src/data/catalog.ts` | New `searchCatalogForAddFlow` DAL function (sibling of `searchCatalogWatches`) | STUB (partial) | Function exists (lines 518-641) with correct structure, but ORDER BY tier 1 violates D-05 spec (plain DESC, not DESC NULLS LAST) |
| `src/app/actions/search.ts` | New `searchCatalogForAddFlow` Server Action + `addFlowSearchSchema` Zod schema | VERIFIED | Lines 135-184. Sibling of `searchWatchesAction`. `addFlowSearchSchema` is a new `{ q: z.string(), limit: z.number().int().min(1).max(50).optional() }`. Auth-first gate. T-19-02-04 prefix. |
| `src/app/actions/watches.ts` | Extended `addWatch` with catalogId branch (D-09/D-10/D-11) + extended `insertWatchSchema` | PARTIAL | `catalogId: z.string().uuid().optional()` in schema (line 50). D-09 fail-fast present (line 130). D-11 enrichment-skip present (lines 171-240). D-10 brand/model override present (lines 134-135) BUT reference override has a conditional guard (line 136) that silently passes through client-supplied reference when `catalogRow.reference` is null. |
| `tests/data/findViewerWatchByCatalogId.test.ts` | 5-case unit test suite | VERIFIED | 5/5 tests pass. Covers cases (a) owned-only, (b) wishlist-only, (c) both-returns-owned (D-08), (d) no-rows, (e) default-owned-only backward-compat (BUG-01). |
| `tests/data/searchCatalogForAddFlow.test.ts` | 7-case unit test suite | VERIFIED | 7/7 tests pass. Covers 2-char gate, ORDER BY tiers, WHERE shape, empty short-circuit, anti-N+1, D-05 owned-wins, result mapping. (Note: test does not catch the NULLS LAST issue as it tests ORDER BY arg structure not SQL text output.) |
| `tests/actions/watches.test.ts` | 5 new integration tests for CONF-11 catalogId branch | VERIFIED | 27/27 tests pass (5 new + 22 pre-existing). All 5 CONF-11 cases pass: (a) no-upsert, (b) fail-fast, (c) brand-override, (d) enrichment-skip, (e) enrichment-trigger. |

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
| 5 CONF-11 integration tests (addWatch catalogId branch) | `npm test -- tests/actions/watches.test.ts --run` | 27/27 pass (5 new + 22 pre-existing), exit 0 | PASS |
| Build gate | `npm run build` | exit 0; prebuild static guard passes (361 tests) | PASS |

### Probe Execution

No probe scripts declared or conventional for this phase type. Step 7c: SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CONF-11 | Plan 03 | `addWatch` Zod schema gains optional `catalogId`; when supplied, calls `getCatalogById` to bind watch row to existing catalog row | SATISFIED | `catalogId: z.string().uuid().optional()` in `insertWatchSchema` line 50; `getCatalogById` branch at lines 126-158; 5/5 integration tests green. CR-01 (D-10 null-reference bypass) is a correctness gap within CONF-11 but the headline CONF-11 requirement (catalogId passthrough + getCatalogById binding) is satisfied. |
| DUPE-01 (DAL part) | Plans 01, 02 | `findViewerWatchByCatalogId` returns user's owned watch id for a catalog row they own | SATISFIED | Function extended in-place; returns `{ id, status: 'owned' }` for owned rows; default `statuses=['owned']` preserves BUG-01 contract; 5/5 unit tests green. |
| DUPE-03 (DAL part) | Plans 01, 02 | Same function returns user's wishlist watch id (status surfaced for Phase 70 branching) | SATISFIED | `statuses=['owned', 'wishlist']` call returns wishlist row when no owned row exists; returns owned row when both exist (D-08 owned-wins); test cases (b) and (c) verify both. |

Note: REQUIREMENTS.md traceability maps DUPE-01 and DUPE-03 to Phase 70 (where user-observable UI behavior lands). Phase 67 delivers the DAL primitives these requirements depend on. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/data/catalog.ts` | 561 | `desc(sql\`(referenceNormalized = queryNormalized)\`)` — missing NULLS LAST | BLOCKER | Violates D-05 spec. PostgreSQL DESC defaults to NULLS FIRST, so NULL-reference rows sort before non-matching rows with a reference. Breaks the "exact-reference matches first" contract of Success Criterion 1. |
| `src/app/actions/watches.ts` | 136 | `if (catalogRow.reference) cleanData.reference = catalogRow.reference` — conditional guard prevents null-override | BLOCKER | Violates D-10 spec. When catalog row has `reference = null`, client-supplied reference passes through unmodified. D-10 states the catalog row IS the identity truth for (brand, model, reference). |
| `src/data/watches.ts` | ~399 | `linkWatchToCatalog` is exported and has `@deprecated` marker since Phase 38; no callers in `src/` | INFO | Pre-existing dead code (WR-03 from REVIEW.md). Not introduced by Phase 67. Not a BLOCKER per debt-marker gate (the deprecated annotation is the documented marker; no unreferenced TBD/FIXME/XXX). |

### Human Verification Required

None — this phase delivers server-side primitives (Server Actions + DAL functions) that are fully verifiable through unit and integration tests plus the build gate. No visual rendering, real-time behavior, or external service integration is involved.

---

## Gaps Summary

Two correctness bugs are blocking the phase goal:

**Gap 1 — CR-02: D-05 ORDER BY missing NULLS LAST (BLOCKER)**

`searchCatalogForAddFlow` DAL function at `src/data/catalog.ts:561` uses `desc(sql`...`)` which emits plain `DESC`. PostgreSQL's default behavior for `DESC` is `NULLS FIRST`, meaning rows where `reference_normalized IS NULL` sort above non-matching rows that have a reference. The D-05 spec explicitly mandates `DESC NULLS LAST`. This violates Success Criterion 1 ("sorted with exact-reference matches first").

Fix: replace `desc(sql\`(${watchesCatalog.referenceNormalized} = ${queryNormalized})\`)` with `sql\`(${watchesCatalog.referenceNormalized} = ${queryNormalized}) DESC NULLS LAST\`` and remove the `desc()` wrapper. Apply the same fix to the empty-query fallback `desc(sql\`false\`)` → `sql\`false DESC NULLS LAST\``. Update `.orderBy()` to pass the raw SQL fragments directly.

**Gap 2 — CR-01: D-10 reference-override null bypass (BLOCKER)**

`addWatch` at `src/app/actions/watches.ts:136` uses `if (catalogRow.reference) cleanData.reference = catalogRow.reference`. When `catalogRow.reference` is null (watches with no reference number), the condition is falsy and the client-supplied reference passes through to `createWatch`. D-10 states the catalog row IS the identity truth for the (brand, model, reference) tuple — null is the canonical value for watches with no reference number, not whatever the client sent.

Fix: replace with `cleanData.reference = catalogRow.reference ?? undefined` (null coerces to undefined to match the `Watch.reference: string | undefined` domain type). Also add test case (f) to `tests/actions/watches.test.ts` covering this scenario as noted in REVIEW.md IN-01.

Both gaps are confirmed violations of locked decisions (D-05 and D-10). Both fixes are surgical single-line changes.

---

_Verified: 2026-05-29T17:45:00Z_
_Verifier: Claude (gsd-verifier)_

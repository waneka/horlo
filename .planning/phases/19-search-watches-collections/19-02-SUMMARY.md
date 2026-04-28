---
phase: 19-search-watches-collections
plan: 02
subsystem: search
tags: [search, server-actions, zod, auth, security, mass-assignment-guard]

# Dependency graph
requires:
  - phase: 19-search-watches-collections
    provides: Plan 01 — searchCatalogWatches DAL + searchCollections DAL + SearchCatalogWatchResult / SearchCollectionResult types
  - phase: 16-people-search
    provides: searchPeopleAction Server Action contract template (Zod .strict().max(200), getCurrentUser auth gate, generic error copy, viewerId from session)
provides:
  - searchWatchesAction Server Action (SRCH-09) — wraps searchCatalogWatches with auth + Zod + generic error contract
  - searchCollectionsAction Server Action (SRCH-11) — wraps searchCollections with auth + Zod + generic error contract
  - 21 contract tests (7 × 3 actions) locking the carry-forward Phase 16 Server Action shape
  - T-19-02-04 information-disclosure regression lock — DAL schema details cannot leak to the client
affects: [19-03 watches-tab-ui, 19-04 collections-tab-ui, 19-05 unified-search-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-actions-not-one-fan-out: separate Server Actions per tab for error isolation, per-section paint timing, cache opportunity per section, and AbortController granularity (RESEARCH.md Q4 + Q8)"
    - "Server Action contract carry-forward from Phase 16: getCurrentUser auth gate FIRST, then Zod .strict().max(200) safeParse, then DAL try/catch, then generic 'Couldn't run search.' on failure with console.error([{actionName}] prefix)"
    - "viewerId always sourced from session — never from caller; .strict() schema rejects mass-assignment attempts before they reach the DAL"

key-files:
  created:
    - tests/actions/search.test.ts (21 contract tests across 3 actions — Zod, auth, error copy, viewerId-from-session, success path)
  modified:
    - src/app/actions/search.ts (appended searchWatchesAction + searchCollectionsAction; existing searchPeopleAction byte-identical inside its function body)

key-decisions:
  - "Three actions, not one fan-out searchAllAction: error isolation, per-section paint, cache opportunity per section, AbortController granularity"
  - "Reused the existing searchSchema constant (no per-action schema) — single Zod source of truth for all three search actions"
  - "DAL enforces 2-char minimum; Server Action does NOT pre-filter — keeps the security invariant in one place"

patterns-established:
  - "Multi-action contract test pattern: parametrize a single describe block over an array of [name, action, dalMock, errPrefix] tuples to assert identical contracts across multiple Server Actions without duplicating test bodies"

requirements-completed: [SRCH-09, SRCH-11]

# Metrics
duration: ~5min
completed: 2026-04-28
---

# Phase 19 Plan 02: Search Server Actions Summary

**Two new Server Actions — `searchWatchesAction` and `searchCollectionsAction` — wrap the Wave 1 DAL exports with the carry-forward Phase 16 contract: Zod `.strict().max(200)` input, `getCurrentUser` auth gate, generic `"Couldn't run search."` copy, and `viewerId` always sourced from session.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2 of 2 completed
- **Files created:** 1
- **Files modified:** 1
- **Tests added:** 21 (7 contract tests × 3 actions)

## Accomplishments

- `searchWatchesAction` exported from `src/app/actions/search.ts` — auth-gated, Zod-validated, wraps `searchCatalogWatches({ q, viewerId, limit: 20 })` from Wave 1; generic copy on DAL failure with `[searchWatchesAction]` prefixed `console.error`.
- `searchCollectionsAction` exported alongside — same contract shape, wraps `searchCollections({ q, viewerId, limit: 20 })`. The DAL still owns the two-layer privacy invariant (Plan 01); the action layer adds NO new surface to that invariant beyond auth + input bounds.
- Existing `searchPeopleAction` function body byte-identical (only the import header changed to fold in the two new DAL imports + two new type imports). The diff shows zero deletions inside the existing function body.
- 21 contract tests parametrized across all three actions assert: Zod `.strict()` rejects extra keys (mass-assignment guard), `.max(200)` rejects oversized payloads (DoS bound), missing `q` rejected, `getCurrentUser` throw → `Not authenticated` early return, DAL exception → generic copy + prefixed log AND no schema details leak (T-19-02-04 regression lock — explicitly asserts response body does NOT contain `'postgres'` or `'column'`), `viewerId` flows from session not caller, success path returns wrapped data.

## Task Commits

Each task committed atomically:

1. **Task 1: Add searchWatchesAction + searchCollectionsAction** — `821f4f8` (feat)
2. **Task 2: Server Action contract tests** — `f9543dd` (test)

## Files Created/Modified

### Created

- **`tests/actions/search.test.ts`** — 21 tests parametrized over an `ACTIONS` tuple array (3 actions × 7 tests each). Mocks `@/lib/auth.getCurrentUser`, `@/data/search.searchProfiles`, `@/data/search.searchCollections`, and `@/data/catalog.searchCatalogWatches`. Each `describe` block runs the same 7 contract tests against a different action, ensuring all three actions share identical contract shape.

### Modified

- **`src/app/actions/search.ts`** — Added imports for `searchCatalogWatches` (from `@/data/catalog`), `searchCollections` (folded into the existing `@/data/search` import line), and `SearchCatalogWatchResult` + `SearchCollectionResult` (folded into a multi-line `import type` block alongside `SearchProfileResult`). Appended two new exported async functions after `searchPeopleAction`. The existing `searchPeopleAction` function body is unchanged.

## Decisions Made

None unique to this plan — followed the plan as specified, mirroring the Phase 16 Server Action shape exactly. The "three actions not one fan-out" decision was made upstream in 19-RESEARCH.md (Q4 + Q8) and is honored here.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed on the first attempt with all acceptance criteria, type-check, lint, and test runs clean. No Rule 1/2/3 auto-fixes triggered. No Rule 4 architectural decisions surfaced.

## Threat Model Coverage (Plan 02 scope)

All threats listed in `19-02-PLAN.md` `<threat_model>` are mitigated:

- **T-19-02-01** (Spoofing — unauthenticated call) — `getCurrentUser()` throws on no session; both new actions return `{ success: false, error: 'Not authenticated' }` before touching the DAL. Verified by Test 4 in each action's `describe` block.
- **T-19-02-02** (Tampering — mass-assignment via extra keys) — Zod `.strict()` rejects unknown keys; `viewerId` field cannot be injected from the client. DAL receives `viewerId: user.id` from session only. Verified by Test 1 (extra-keys rejection) + Test 6 (viewerId-from-session).
- **T-19-02-03** (DoS — unbounded `q` length) — Zod `.max(200)` rejects oversized payloads. Verified by Test 2 in each action's `describe` block.
- **T-19-02-04** (Information Disclosure — DAL schema details leak) — `try/catch` around DAL call; client receives generic `"Couldn't run search."`; `console.error('[<actionName>] unexpected error:', err)` logs server-side only. Test 5 explicitly asserts the response body does NOT contain `'postgres'` or `'column'` even when the DAL throws an error string containing those tokens.
- **T-19-02-05** (CSRF) — Inherited from Next.js 16 Server Action token framework protection; out of scope for hand-rolled mitigation.
- **T-19-02-06** (Repudiation — error log retention) — Accepted at v4.0 single-user MVP scale; `console.error` to Vercel logs is sufficient.
- **T-19-02-07** (Information Disclosure — private collection enumeration) — DAL (Plan 01 — `searchCollections`) enforces two-layer privacy. The Server Action layer adds NO additional surface. RLS on `profiles` is the second defense layer.

## Verification

- `npx vitest run tests/actions/search.test.ts --reporter=verbose` → **21/21 passed**
- `npx vitest run tests/actions/search.test.ts tests/data/searchProfiles.test.ts tests/data/searchCatalogWatches.test.ts tests/data/searchCollections.test.ts` → **62 passed | 3 skipped (no regression in Wave 1)**
- `npx tsc --noEmit` → no diagnostics referencing `src/app/actions/search.ts` or `tests/actions/search.test.ts`
- `npx eslint src/app/actions/search.ts tests/actions/search.test.ts` → clean
- Regression lock verified — `git diff src/app/actions/search.ts` shows only ADDITIONS inside / after the existing `searchPeopleAction` function body. The two diff deletions are on the IMPORT lines only (where `searchProfiles` and `SearchProfileResult` were folded into multi-import statements alongside the new imports). The function body of `searchPeopleAction` is byte-identical.

## Wave 2 Handoff

Plans 03 + 04 + 05 (UI waves) consume:

- `searchWatchesAction(data: { q: string }): Promise<ActionResult<SearchCatalogWatchResult[]>>` — call from the Watches tab Client Component (Plan 03 / 05); discriminate `result.success`.
- `searchCollectionsAction(data: { q: string }): Promise<ActionResult<SearchCollectionResult[]>>` — call from the Collections tab Client Component (Plan 04 / 05).
- Both actions handle 2-char minimum at the DAL layer; the client-side `useSearchState` hook may still pre-filter for UX, but the security invariant is server-side.

The unified `/search` page (Plan 05) calls all three actions in parallel via three separate AbortControllers, one per tab — the three-actions architecture intentionally enables that parallelism without coupling.

## Self-Check: PASSED

Created files exist:
- `src/app/actions/search.ts` — modified ✓ (143 lines, 4524 bytes)
- `tests/actions/search.test.ts` — created ✓ (115 lines, 4575 bytes)

Commits exist:
- `821f4f8` — Task 1 feat ✓
- `f9543dd` — Task 2 test ✓

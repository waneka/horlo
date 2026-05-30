---
phase: 69
plan: 06
subsystem: watch-add-flow
tags: [ssr, prop-drill, integration-test, phase-gate, CLNP-07]
requires: [69-01, 69-02, 69-03, 69-04, 69-05]
provides:
  - "SSR plumbing complete: listCatalogBrands flows /watch/new/page.tsx → AddWatchFlow.catalogBrands"
  - "CLNP-07 four-cache composition proof in AddWatchFlow.test.tsx"
  - "Phase 69 build gate green; all 6 plans landed"
affects:
  - "Phase 70 (state-machine rewrite + SearchEntry mount) — consumes catalogBrands prop already wired"
tech_stack_added: []
patterns_added: []
key_files_created: []
key_files_modified:
  - src/app/watch/new/page.tsx
  - src/components/watch/AddWatchFlow.test.tsx
decisions:
  - "D-13 honored: listCatalogBrands fetched per-request in Promise.all (no 'use cache')"
  - "D-09 honored: behavioral integration test using direct hook calls + __resetForTests; no static fs-walking guard"
  - "Hook-call site simplification: the 4 cache hooks return plain {get,set} over module-scope state with no React-tracked subscribers, so direct calls in the test body produce the same observable behavior as renderHook; no harness component needed"
  - "Collection revision held at 1 across user-a/user-b verdict cache reads so the OUTER user-switch guard is the sole invalidator under test (inner revision guard is unit-tested separately in Plan 03)"
metrics:
  duration_minutes: 4
  tasks_total: 2
  tasks_completed: 2
  files_modified: 2
  commits: 2
  completed_date: 2026-05-29
---

# Phase 69 Plan 06: Wire SSR catalogBrands + CLNP-07 Integration Test Summary

Closed Phase 69 with two integration changes: wired `listCatalogBrands` SSR through `/watch/new/page.tsx → AddWatchFlow`, and proved the four module-scope caches all reset on user-switch via a single behavioral integration test in `AddWatchFlow.test.tsx`. Build green; all 14 Phase 69 REQ-IDs closed.

## What Was Built

### Task 1 — SSR plumbing (D-13)

**`src/app/watch/new/page.tsx`** — replaced the Plan 03 placeholder `catalogBrands={[]}` with the live SSR value:

- Added `listCatalogBrands` to the existing `from '@/data/catalog'` import line.
- Extended the existing `Promise.all` from a 3-tuple destructure to a 4-tuple: `[collection, catalogPrefill, viewerProfile, catalogBrands]`.
- Replaced the empty-array placeholder JSX prop with `catalogBrands={catalogBrands}`.
- Comment rewritten to "uncached on purpose" so the literal `'use cache'` string never appears in scope (the counter-assertion grep is now 0 not just "directive-only 0").

No new files. The `listCatalogBrands` DAL fn was shipped in Plan 01; this plan only supplies the value.

### Task 2 — CLNP-07 integration test (D-09)

**`src/components/watch/AddWatchFlow.test.tsx`** — extended in two steps:

**Step A (compilation gate).** All 12 existing `<AddWatchFlow ...>` render sites updated with the two now-required props:
```tsx
viewerUserId="user-a"
catalogBrands={[]}
```
`replace_all` on the shared `viewerUsername={null}` final-prop line did all 12 in one shot — the file compiles against Plan 03's `AddWatchFlowProps` extension and all 12 pre-existing tests still pass.

**Step B (CLNP-07 proof).** New top-level describe block `Phase 69 — cache hygiene integration (CLNP-07)`:

- `beforeEach` resets all 4 caches via dynamic `import()` of `__resetUrlExtractCacheForTests` / `__resetVerdictCacheForTests` / `__resetCatalogSearchCacheForTests` / `__resetStructuredExtractCacheForTests`.
- Single test seeds `user-a` entries in all four caches via direct hook calls (`useCatalogSearchCache`, `useStructuredExtractCache`, `useUrlExtractCache`, `useWatchSearchVerdictCache`).
- Verifies each `get(key)` returns the seeded value for `user-a` (sanity gate so the test isn't tautological).
- Re-invokes each hook with `viewerUserId='user-b'` — the in-render `if (moduleUserId !== viewerUserId) moduleCache = new Map()` guard fires once per call.
- Asserts `bCatalog.get(catalogKey)`, `bStructured.get(structuredKey)`, `bUrl.get(urlKey)`, `bVerdict.get(verdictKey)` all return `undefined`.
- `collectionRevision=1` held constant across both verdict-cache calls so the outer user-switch guard is the sole invalidator under test.
- Reuses the file-level `fixtureFullVerdict` for the verdict payload (already valid `VerdictBundle` per ARCH-02 alias).
- Cache `__resetForTests` exports already null all module state (`moduleCache`, `moduleUserId`, `moduleRevision`) — no extra setup churn.

## How It Was Built

- Task 1: 3 small Edits + build gate exit 0 → commit.
- Task 2 Step A: single `replace_all` on the `viewerUsername={null}` line pattern (12 hits → 12 props pairs). Re-ran the test file standalone to confirm all 12 pre-existing tests still green.
- Task 2 Step B: appended one describe block to file tail (137 lines added in total). Direct-hook-call strategy avoids `renderHook` ceremony — the hooks have no React state, only module-scope state, so calling them in a test body is observably identical to a render harness.
- Final phase gate: `npm run build` exit 0 (5.8s compile). `npm run test -- --run src/components/watch/AddWatchFlow.test.tsx` exit 0 (13/13 tests).

## How It Was Verified

- **Task 1 (D-13 wire):** acceptance greps all 6 pass — import count 1, 4-tuple destructure 1, `listCatalogBrands()` call 1, JSX prop 1, "use cache" text 0, `catalogBrands={[]}` placeholder 0. `npm run build` exit 0.
- **Task 2 (D-09 integration):** acceptance greps all 5 pass — describe block 1, 4-cache reset imports 10 (≥4), `catalogBrands={[]}` 12 (≥1), `@vitest-environment` 0, static fs guards 0. `npm run test -- --run src/components/watch/AddWatchFlow.test.tsx` exit 0 with 13/13 passing (12 pre-existing + 1 new CLNP-07 test).
- **Phase gate:** `npm run build` exits 0 after both commits — confirms the Plan 03 retrofit + Plan 04/05 components + this plan's SSR plumbing compose cleanly end-to-end.

## Decisions Made

1. **`'use cache'` counter-assertion compliance.** First pass of the SSR comment included the literal text `(no 'use cache')` as a disclaimer, which made the regex grep count 1. Rewrote to "uncached on purpose" so the grep is 0 AND no actual directive exists. Honored both the literal string check and the underlying D-13 intent.

2. **Hook calls outside a render harness.** All 4 cache hooks return plain `{get, set}` over module-scope variables. They do read `viewerUserId` inside the hook body and conditionally mutate module state (in-render sync mutation — D-06 pattern). They never call `useState`, `useEffect`, or any React subscriber API. Direct invocation in a test body produces observably identical behavior to `renderHook` and keeps the test 1 file scoped. The plan offered this as an option; chose it for surface minimality.

3. **`collectionRevision=1` on both verdict cache reads.** `useWatchSearchVerdictCache(collectionRevision, viewerUserId)` has TWO reset guards (revision-change and user-switch). Holding revision constant isolates the user-switch guard as the sole invalidator under test in this integration block — the revision guard already has a dedicated unit test in Plan 03.

4. **Single test, not 4 sibling tests.** The CLNP-07 contract is "a single user-switch clears all 4 caches" — a single test that exercises all 4 in one rerender is the contract proof. Per-cache reset semantics are unit-tested in Plans 02 + 03; this test is the composition check.

5. **`viewerUserId="user-a"` for the 12 pre-existing tests.** Step A required a string for `viewerUserId`. Picked `"user-a"` (the same fixture user-id used in the new test) for visual consistency. None of the 12 pre-existing tests exercise viewer-keyed logic, so the literal value is inert.

## Deviations from Plan

None. The plan was executed exactly as written, including:
- Task 1 acceptance criteria all 6 pass (including the counter-assertion grep after the comment-text tightening, which is consistent with the intent of D-13).
- Task 2 acceptance criteria all 5 pass with healthy margin (10 reset-import matches > 4 required; 12 catalogBrands matches > 1 required).
- Phase-level verification triple (test file green, build green, no SearchEntry/StructuredEntryPanel mount in either page or AddWatchFlow) all hold.

## Threat Flags

None. No new network endpoints, no new auth/RLS shapes, no new user data flows. `listCatalogBrands` reads catalog brand strings under public-read RLS (already in place since Phase 19). The test file is non-production code.

## Self-Check: PASSED

**Files claimed modified — both exist and committed:**
- `src/app/watch/new/page.tsx` (modified in commit `0344131a`)
- `src/components/watch/AddWatchFlow.test.tsx` (modified in commit `d4fce336`)

**Commits claimed — both exist in git log:**
- `0344131a` — `feat(69-06): wire listCatalogBrands SSR into /watch/new` ✓
- `d4fce336` — `test(69-06): CLNP-07 four-cache user-switch integration` ✓

**Verification commands all exit 0:**
- `npm run test -- --run src/components/watch/AddWatchFlow.test.tsx` → 13/13 passed ✓
- `npm run build` → "✓ Compiled successfully in 5.8s" ✓

**Counter-assertions hold:**
- `grep "SearchEntry\|StructuredEntryPanel" src/components/watch/AddWatchFlow.tsx src/app/watch/new/page.tsx` → no matches (Phase 70 owns mounting) ✓
- `catalogBrands={[]}` placeholder in page.tsx: 0 ✓
- `'use cache'` directive in /watch/new/page.tsx: 0 ✓
- `@vitest-environment` in AddWatchFlow.test.tsx: 0 ✓
- `readdirSync\|fs.readdir` in AddWatchFlow.test.tsx: 0 ✓

---

## Phase 69 Closeout (5/5 Success Criteria Provable)

With Plan 06 landed, the 5 Phase 69 success criteria are now all traceable:

| SC | Criterion | Proof |
|----|-----------|-------|
| #1 | Debounce + 2-char + result row contents | `SearchEntry.test.tsx` (Plan 05) |
| #2 | HighlightedText + owners count | `SearchEntry.test.tsx` (Plan 05) |
| #3 | Up/Down/Enter + ARIA roles | `SearchEntry.test.tsx` (Plan 05) |
| #4 | No-match expand + URL backup + SRCH-24 footer | `SearchEntry.test.tsx` + `StructuredEntryPanel.test.tsx` (Plans 04+05) |
| #5 | signOut clears all 4 caches | `AddWatchFlow.test.tsx` integration test (this plan) |

14 of 14 Phase 69 REQ-IDs closed (SRCH-17..26, EXTR-05, EXTR-06, EXTR-07, CLNP-07).

Components ship DORMANT. Phase 70 (state-machine rewrite) mounts SearchEntry / StructuredEntryPanel and exercises them on prod.

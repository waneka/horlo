---
phase: 72-search-composition-fixes
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/watch/SearchEntry.test.tsx
  - src/components/watch/SearchEntry.tsx
  - src/data/__tests__/catalog-search-tokens.test.ts
  - src/data/catalog.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 72: Code Review Report

**Reviewed:** 2026-05-30
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 72 delivers three targeted fixes (SRCH-01 multi-token tokenization in `catalog.ts`, SRCH-02 keyboard navigation via `isItemEqualToValue` + removal of `index={i}`, SRCH-03 footer relocation outside `<Combobox.List>`) plus regression tests in both `SearchEntry.test.tsx` and `catalog-search-tokens.test.ts`.

The core logic of each fix is sound. The SQL tokenization in `searchCatalogForAddFlow` correctly produces AND-of-ORs with Drizzle parameterized binds (T-67-02-01 mitigated). The `isItemEqualToValue` prop is present; no `index={i}` appears on `<Combobox.Item>`; the footer button is a sibling of `<Combobox.List>` not a descendant. No `font-medium` appears in any class attribute in `SearchEntry.tsx`. Props `onPick`/`onSubmitStructured`/`onSwitchToUrl` signatures are frozen per D-03. No `@vitest-environment node` pragma on either new test file. No hardcoded secrets or injection vulnerabilities.

Three warnings were found, two informational items. No blockers.

---

## Warnings

### WR-01: SRCH-02 and SRCH-03 describe blocks missing `afterEach(() => vi.useRealTimers())`

**File:** `src/components/watch/SearchEntry.test.tsx:738` and `src/components/watch/SearchEntry.test.tsx:815`

**Issue:** Both the "keyboard arrow-key navigation (SRCH-02)" and "footer placement (SRCH-03)" describe blocks call `vi.useRealTimers()` in `beforeEach` but have no matching `afterEach`. Timer mode is left as "real" after those describe suites finish. The immediately-following "Phase 70 gap plan 06" describe is saved only because its own `beforeEach` explicitly calls `vi.useFakeTimers()`. Any future describe block inserted between SRCH-03 and Phase 70 gap plan 06 that omits a timer-mode reset will silently run with real timers, causing 250 ms `setTimeout` debounce calls to execute in real time and likely causing `waitFor` timeouts in CI.

The existing pattern in every other describe block in this file is to pair `vi.useFakeTimers()` in `beforeEach` with `vi.useRealTimers()` in `afterEach`. SRCH-02 and SRCH-03 invert this (real timers as the "special mode") without the cleanup pairing.

**Fix:** Add `afterEach` to both describe blocks:

```typescript
// In "keyboard arrow-key navigation (SRCH-02)" describe
afterEach(() => {
  vi.useRealTimers()
})

// In "footer placement (SRCH-03)" describe
afterEach(() => {
  vi.useRealTimers()
})
```

---

### WR-02: Stale "WILL FAIL" and "RED test scaffold" comments shipped in post-fix test file

**File:** `src/components/watch/SearchEntry.test.tsx:2`, `src/components/watch/SearchEntry.test.tsx:31`, `src/components/watch/SearchEntry.test.tsx:828`

**Issue:** Three comments describe a pre-implementation state that no longer applies:

- Line 2: `"Phase 69 Plan 05 — RED test scaffold for SearchEntry."` — this file is no longer a red scaffold; `SearchEntry` shipped in Plan 05.
- Line 31: `"RED until Plan 05 ships \`@/components/watch/SearchEntry\`."` — Plan 05 has shipped; `SearchEntry` exists.
- Line 828–832: `"This test WILL FAIL against the current SearchEntry.tsx where the footer button lives INSIDE <Combobox.List>"` — the SRCH-03 fix has moved the button outside the list; this test now passes on the submitted code, but the comment says it "WILL FAIL."

A reviewer or future engineer reading line 828 would incorrectly conclude the submitted implementation is broken. This is a maintainability hazard: engineers triaging a CI failure may waste time tracking down "the known WILL FAIL test" that actually passes, or conversely trust a regression is expected when it is not.

**Fix:** Update the file-level docstring to describe the current state, and rewrite line 828:

```typescript
// Line 2 / header: change "RED test scaffold" → "Regression test suite"
// Line 31: remove the "RED until..." sentence entirely

// Line 828-832: replace with:
// After the SRCH-03 fix the footer button lives OUTSIDE <Combobox.List>.
// This assertion guards against regression to the pre-fix placement where the
// button was INSIDE Combobox.List and prod browsers swallowed the click.
```

---

### WR-03: `catalog-search-tokens.test.ts` tests the DAL directly, bypassing the Server Action's auth and Zod validation layers

**File:** `src/data/__tests__/catalog-search-tokens.test.ts:73`

**Issue:** The test imports `searchCatalogForAddFlow` from `@/data/catalog` (the raw DAL function) rather than from `@/app/actions/search` (the Server Action that `SearchEntry.tsx` actually calls at runtime). The production call chain is:

```
SearchEntry → Server Action (auth check + Zod validation) → DAL
```

The test exercises only the DAL leg. The Server Action layer — which contains the `getCurrentUser()` auth gate, `addFlowSearchSchema.safeParse()` input validation, and the `{ success, error }` response envelope — has no test coverage in this phase. Specifically:

1. An unauthenticated caller is not tested; `{ success: false, error: 'Not authenticated' }` is never exercised.
2. A query that fails Zod validation (e.g., non-string `q`) is not tested.
3. The mapping from the `ActionResult<SearchCatalogWatchResult[]>` envelope to `res.success` / `res.data` that `SearchEntry.tsx` uses (lines 183–185) is not covered.

This is acceptable as a unit-test-the-DAL strategy, but the stated intent in `72-01-PLAN.md` and the phase context is regression coverage for SRCH-01. The Server Action wrapping layer is a plausible failure surface (e.g., Zod schema rejecting the query before it reaches the new tokenization code). The test should either be re-targeted at the Server Action or a companion test should cover the action path.

**Fix (minimum):** Add a note in the test file's header comment explicitly documenting that the DAL is tested in isolation and that Server Action coverage is deferred. This prevents future maintainers from treating the test as full-stack coverage.

**Fix (preferred):** Add at least one test that imports from `@/app/actions/search` and mocks `@/db` + `getCurrentUser` to verify the `{ success: true, data: [...] }` envelope is returned and the result flows through correctly.

---

## Info

### IN-01: `limit` parameter typed as `limit: number` (non-optional) despite having a runtime default

**File:** `src/data/catalog.ts:561`

**Issue:** The destructured parameter `limit = SEARCH_ADD_FLOW_DEFAULT_LIMIT` provides a runtime default, but the type annotation says `limit: number` — required, not optional. TypeScript's strict mode treats this as a required parameter at all call sites. In practice every caller does pass `limit` explicitly (the Server Action passes `parsed.data.limit ?? 20`), so there is no runtime defect. However the annotation is misleading: a future caller who omits `limit` will get a type error rather than silently picking up the default.

The parallel function `searchCatalogWatches` declares `limit?: number` (explicitly optional with a default), which is the correct pattern for the codebase.

**Fix:**
```typescript
// Change
limit: number
// To
limit?: number
```

---

### IN-02: `or()` results in `tokenClauses` are typed `SQL | undefined` but passed directly to `and()` without non-null assertion — inconsistent with adjacent `searchCatalogWatches` pattern

**File:** `src/data/catalog.ts:590–598`, compare `src/data/catalog.ts:413–421`

**Issue:** In `searchCatalogWatches`, the `or(...)` call is followed by a non-null assertion (`!`) before being pushed into the `predicates` array:

```typescript
predicates.push(
  or(
    ilike(watchesCatalog.brandNormalized, pattern),
    ilike(watchesCatalog.modelNormalized, pattern),
    refPattern ? ilike(watchesCatalog.referenceNormalized, refPattern) : sql`false`,
  )!,  // <-- non-null assertion
)
```

In `searchCatalogForAddFlow`, the `or()` return is used as-is:

```typescript
return or(
  ilike(watchesCatalog.brandNormalized, colPattern),
  ilike(watchesCatalog.modelNormalized, colPattern),
  refToken.length > 0 ? ilike(...) : sql`false`,
)
// No ! assertion — type is SQL | undefined
```

`tokenClauses` is therefore `(SQL | undefined)[]`. Drizzle's `and()` accepts `(SQLWrapper | undefined)[]` and silently ignores `undefined` entries — meaning if `or()` returned `undefined` for a given token, that token's constraint would be silently dropped, potentially returning rows that do not match all query tokens. In practice `or()` cannot return `undefined` here because `ilike()` and `sql\`false\`` never return `undefined`, so there is no live defect. But the type-level inconsistency diverges from the established codebase pattern and creates a latent risk if the token-clause construction is ever modified to include a potentially-undefined condition.

**Fix:** Add non-null assertions to match the `searchCatalogWatches` pattern:
```typescript
const tokenClauses = tokens.map((token) => {
  const colPattern = `%${token}%`
  const refToken = token.replace(/[^a-z0-9]+/g, '')
  return or(
    ilike(watchesCatalog.brandNormalized, colPattern),
    ilike(watchesCatalog.modelNormalized, colPattern),
    refToken.length > 0
      ? ilike(watchesCatalog.referenceNormalized, `%${refToken}%`)
      : sql`false`,
  )!  // non-null assertion matches searchCatalogWatches:413-421 pattern
})
```

---

_Reviewed: 2026-05-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

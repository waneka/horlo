# Phase 16 — Deferred Items

Out-of-scope items discovered during execution.

## Pre-existing TypeScript Errors

**Discovered:** Plan 16-01 Task 1 (during `npx tsc --noEmit` after creating `src/lib/searchTypes.ts`)

**Errors:**
- `tests/components/preferences/PreferencesClient.debt01.test.tsx(86,67)` — `Type 'undefined' is not assignable to type 'UserPreferences'`
- `tests/components/preferences/PreferencesClient.debt01.test.tsx(129,7)` — `Type 'undefined' is not assignable to type 'UserPreferences'`

**Origin:** Phase 14-09 commit `c95b726` (`test(14-09): add DEBT-01 regression-lock test for PreferencesClient`)

**Verification:** `git stash` confirms errors persist on `aaa062d` without Phase 16 changes — pre-existing, unrelated to People Search.

**Action:** Out of scope for Phase 16. Candidate for `/gsd-quick` follow-up (likely a missing non-null assertion or default parameter in the test fixture).

---

## Pre-existing TypeScript Error in Plan 01 Test File

**Discovered:** Plan 16-03 Task 2 (during `npx tsc --noEmit` after creating `HighlightedText.tsx`)

**Error:**
- `tests/components/search/useSearchState.test.tsx(254,5)` — `Unused '@ts-expect-error' directive.`

**Origin:** Plan 16-01 Task 3 commit `6cb2204` (RED test for useSearchState). The `@ts-expect-error overriding for spy` directive was added before `global.AbortController = SpyAbortController`, but `@types/node`'s typings for `global.AbortController` (which is reassignable in node 18+) no longer raise an error here, making the directive unused.

**Verification:** Reproduces against `aaa062d` (the Phase 16-01 baseline) — pre-existing, unrelated to Plan 03's hook implementation.

**Action:** Out of scope for Phase 16-03. Trivial follow-up: remove the `// @ts-expect-error overriding for spy` comment in the test (the assignment is now valid TS).

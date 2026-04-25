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

---
phase: "04"
plan: 4
plan_name: server-actions-refactor
subsystem: authentication
tags: [phase-4, wave-3, server-actions, idor, auth-02, auth-03]
requirements: [AUTH-02, AUTH-03]
wave: 3
depends_on: [2]
dependency_graph:
  requires:
    - "src/lib/auth.ts — getCurrentUser() + UnauthorizedError (from 04-02)"
    - "src/data/watches.ts — DAL with userId-scoped queries (from Phase 3)"
    - "src/data/preferences.ts — upsertPreferences DAL (from Phase 3)"
    - "tests/actions/watches.test.ts stub (from 04-01)"
    - "tests/actions/preferences.test.ts stub (from 04-01)"
    - "tests/data/isolation.test.ts stub (from 04-01)"
    - "tests/fixtures/users.ts — seedTwoUsers (from 04-01)"
  provides:
    - "src/app/actions/watches.ts — addWatch(data), editWatch(watchId, data), removeWatch(watchId)"
    - "src/app/actions/preferences.ts — savePreferences(data)"
    - "tests/actions/watches.test.ts — 7 passing AUTH-02 assertions"
    - "tests/actions/preferences.test.ts — 3 passing AUTH-02 assertions"
    - "tests/data/isolation.test.ts — 3 IDOR integration assertions (AUTH-03)"
  affects:
    - "package.json, package-lock.json (drizzle-orm + postgres added)"
tech-stack:
  added:
    - "drizzle-orm (was referenced in Phase 3 DAL but missing from package.json)"
    - "postgres (Node.js Postgres client, required by drizzle-orm/postgres-js)"
    - "drizzle-kit (CLI for schema push)"
  patterns:
    - "Server Action session-gate prologue: let user; try { user = await getCurrentUser() } catch { return { success:false, error:'Not authenticated' } }"
    - "DAL error mapping: 'not found or access denied' -> { success:false, error:'Not found' } (D-05)"
    - "Integration test with describe.skip guard — runs against real Postgres when SUPABASE env vars set, skips on CI"
    - "Dynamic imports inside beforeAll so drizzle-orm only resolves when stack is live"
key-files:
  created: []
  modified:
    - path: "src/app/actions/watches.ts"
      change: "Dropped userId param from addWatch/editWatch/removeWatch; added getCurrentUser prologue per D-02/D-04; maps DAL not-found to Not found per D-05; removed TODO(Phase 4)"
    - path: "src/app/actions/preferences.ts"
      change: "Dropped userId param from savePreferences; added getCurrentUser prologue per D-02/D-04; removed TODO(Phase 4)"
    - path: "tests/actions/watches.test.ts"
      change: "Replaced 4 it.todo stubs with 7 real assertions (expanded to cover editWatch two-arg sig, removeWatch one-arg sig, and DAL error mapping)"
    - path: "tests/actions/preferences.test.ts"
      change: "Replaced 2 it.todo stubs with 3 real assertions"
    - path: "tests/data/isolation.test.ts"
      change: "Replaced 3 it.todo stubs with 3 real IDOR integration assertions against live Postgres"
    - path: "package.json"
      change: "Added drizzle-orm, postgres, drizzle-kit (were missing from Phase 3)"
decisions:
  - "Catch ALL errors in getCurrentUser prologue (not just UnauthorizedError) per D-15 — non-Unauthorized errors are unexpected but must not throw across the Server Action boundary"
  - "Integration test uses dynamic imports inside beforeAll so drizzle-orm is only resolved when env vars confirm the stack is live — avoids import-time failures in CI"
  - "Used describe.skip (not it.skip) so the entire fixture setup is bypassed when env vars are absent, preventing seedTwoUsers from throwing"
metrics:
  duration_minutes: 25
  tasks_completed: 3
  files_created: 0
  files_modified: 5
  completed_date: 2026-04-13
---

# Phase 4 Plan 4: Server Actions Refactor Summary

**One-liner:** Dropped `userId` from all Server Action signatures and wired `getCurrentUser()` session-gate prologues (D-02/D-04), then proved IDOR denial end-to-end with a real two-user Postgres fixture (AUTH-03).

## Outcome

All three Server Action files now enforce the D-02 contract — callers never pass a userId, the session id is read inside the action and forwarded to the DAL:

1. `addWatch(data)`, `editWatch(watchId, data)`, `removeWatch(watchId)` — new signatures in `src/app/actions/watches.ts`
2. `savePreferences(data)` — new signature in `src/app/actions/preferences.ts`
3. Every action returns `{ success: false, error: 'Not authenticated' }` when `getCurrentUser()` fails (D-04, D-15)
4. `editWatch` and `removeWatch` map the DAL's "not found or access denied" error to `{ success: false, error: 'Not found' }` (D-05, T-4-05 information disclosure mitigation)
5. IDOR proven end-to-end: User A calling `editWatch` or `removeWatch` with User B's watchId returns `Not found` — the DAL's `WHERE userId = ? AND id = ?` clause rejects the cross-user access without leaking whether the row exists

Full test suite: **616 passed, 3 skipped, 11 todo, 0 failed** (up from 470/20/0 — 10 formerly-todo tests converted to real assertions).

## Task Log

### Task 1 — Refactor src/app/actions/watches.ts + watches unit tests
- Commit: `73dbfd7`
- Rewrote watches.ts with new signatures (D-02), getCurrentUser prologue (D-04), DAL error mapping (D-05)
- Replaced 4 it.todo stubs with 7 real assertions (added editWatch two-arg sig test, removeWatch one-arg sig test, DAL error mapping test)
- Auto-fix: test assertion used `toHaveBeenCalledWith` with exact object literal — Zod schema adds array defaults (`complications`, `styleTags`, etc.) so switched to `expect.objectContaining` for the data argument

### Task 2 — Refactor src/app/actions/preferences.ts + preferences unit tests
- Commit: `f2fd306`
- Rewrote preferences.ts with new signature (D-02), getCurrentUser prologue (D-04)
- Replaced 2 it.todo stubs with 3 real assertions
- Clean — no deviations

### Task 3 — Wire IDOR integration test against local Supabase
- Commit: `1461cc3`
- Replaced 3 it.todo stubs with 3 real integration assertions
- Proved IDOR: editWatch + removeWatch on cross-user watch return `{ success:false, error:'Not found' }`
- Control case: addWatch with UserA session creates watch scoped to UserA only
- describe.skip guard: 3 tests skip cleanly when env vars absent; all 3 pass with live stack

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion too strict for Zod-parsed data**
- **Found during:** Task 1 vitest run
- **Issue:** `editWatch` test used `toHaveBeenCalledWith('u-1', 'w-1', { brand: 'Rolex' })` but Zod's `partial()` schema applies array defaults (`complications: []`, `styleTags: []`, `designTraits: []`, `roleTags: []`) to the parsed output, so the actual call includes those defaults
- **Fix:** Changed assertion to `toHaveBeenCalledWith('u-1', 'w-1', expect.objectContaining({ brand: 'Rolex' }))` — still verifies the userId and watchId routing, and that `brand` is present, without being brittle to schema defaults
- **Files modified:** `tests/actions/watches.test.ts`
- **Commit:** `73dbfd7`

**2. [Rule 3 - Blocking] drizzle-orm and postgres missing from package.json**
- **Found during:** Task 3 first vitest run — `Failed to resolve import "drizzle-orm"`
- **Issue:** Phase 3 built the entire DAL using drizzle-orm and postgres, but never added them to package.json. They were never detected because all prior tests mocked the DAL entirely — this integration test is the first to import it for real
- **Fix:** `npm install drizzle-orm postgres drizzle-kit`
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** `1461cc3`

**3. [Rule 1 - Bug] Dynamic import circular stack overflow**
- **Found during:** Task 3 first iteration — `RangeError: Maximum call stack size exceeded`
- **Issue:** Initial approach mocked `@/data/watches` with stubs, then used `vi.importActual` inside `beforeAll` to restore real implementations. This created a circular resolution loop when the mock tried to call through to itself
- **Fix:** Removed the `vi.mock('@/data/watches')` entirely. Instead, the test uses only a `vi.mock('@/lib/auth')` (for session control) and performs all DAL imports dynamically inside `beforeAll` via `await import('@/data/watches')`. The `describe.skip` guard ensures these dynamic imports never run on CI without the stack
- **Files modified:** `tests/data/isolation.test.ts`
- **Commit:** `1461cc3`

## Known Stubs

None. This plan consumed 10 of the 20 remaining stubs from Plan 01. All test files in scope have zero `it.todo` entries.

## Threat Flags

None. All security-relevant surface changes in this plan were already in the plan's `<threat_model>`:

| Threat | Mitigation applied |
|--------|--------------------|
| T-4-03 Elevation of privilege (IDOR via editWatch/removeWatch) | D-02 drops `userId` param entirely; session id injected inside action; Task 3 proves end-to-end with real two-user DB fixture |
| T-4-05 Information disclosure ("not found" vs "access denied" wording) | Action maps DAL error to neutral `'Not found'` (D-05) — does not leak row existence for other users |
| T-4-02 Spoofing (tampered cookie) | `getCurrentUser()` uses `supabase.auth.getUser()` (server-verified) from Plan 02 — tampered cookie fails prologue |

## Commits

- `73dbfd7` — feat(04-04): refactor watches Server Actions — drop userId, add getCurrentUser prologue
- `f2fd306` — feat(04-04): refactor preferences Server Action — drop userId, add getCurrentUser prologue
- `1461cc3` — test(04-04): wire IDOR integration test + install drizzle-orm/postgres

## Self-Check

- FOUND: src/app/actions/watches.ts
- FOUND: src/app/actions/preferences.ts
- FOUND: tests/actions/watches.test.ts
- FOUND: tests/actions/preferences.test.ts
- FOUND: tests/data/isolation.test.ts
- VERIFIED: watches.ts does NOT contain "TODO(Phase 4)"
- VERIFIED: preferences.ts does NOT contain "TODO(Phase 4)"
- VERIFIED: watches.ts contains getCurrentUser 4 times (once per action + import)
- VERIFIED: addWatch(data) — one param; editWatch(watchId, data) — two params; removeWatch(watchId) — one param
- VERIFIED: savePreferences(data) — one param
- VERIFIED: Full suite 616 passed, 3 skipped (isolation sans env vars), 0 failed
- VERIFIED: Integration test passes with live Supabase (3/3 passing)
- FOUND: commit 73dbfd7
- FOUND: commit f2fd306
- FOUND: commit 1461cc3

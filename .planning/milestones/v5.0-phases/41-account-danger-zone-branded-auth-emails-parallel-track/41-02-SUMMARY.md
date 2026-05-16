---
phase: 41-account-danger-zone-branded-auth-emails-parallel-track
plan: 02
subsystem: backend/server-actions
tags: [supabase, server-actions, account-management, danger-zone, storage-purge, service-role]

# Dependency graph
requires:
  - phase: 41-account-danger-zone-branded-auth-emails-parallel-track
    plan: 01
    provides: "SUPABASE_SERVICE_ROLE_KEY confirmed + RED test scaffolds"
provides:
  - "createSupabaseAdminClient factory in src/lib/supabase/admin.ts"
  - "wipeCollection server action — deletes watches + wear_events + storage; preserves account/profile/follows"
  - "deleteAccount server action — purges storage, deletes public.users (cascade), calls auth.admin.deleteUser()"
affects:
  - 41-03-danger-zone-modals

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "purgeWearPhotos shared helper: paginated .list(userId, {limit:1000, offset:n}) + .remove(paths) loop"
    - "Storage-before-DB ordering enforced in both actions (RESEARCH Pitfall 2 / success criterion 2)"
    - "Service-role client created per-call inside factory (never module-scoped — RESEARCH Anti-Pattern)"
    - "vi.hoisted() for shared mock references accessed in both vi.mock() factories and test body"

key-files:
  created:
    - "src/lib/supabase/admin.ts"
    - "src/app/actions/account.ts"
  modified:
    - "tests/integration/account-delete.test.ts (hoisting bug fix)"

key-decisions:
  - "purgeWearPhotos extracted as a shared internal helper to avoid duplication between wipeCollection and deleteAccount"
  - "DB delete order for wipeCollection: wearEvents first, then watches (explicit; cascade would also cover it)"
  - "deleteAccount order: storage purge → db.delete(users) → auth.admin.deleteUser() (Pitfall 1: no FK from public.users to auth.users)"
  - "Revalidation mirrors removeWatch: revalidatePath('/') + profile tag + explore tag (RESEARCH Open Question 3 — explore-rail staleness accepted as pre-existing)"

# Metrics
duration: 5 minutes
completed: 2026-05-16
---

# Phase 41 Plan 02: Track A Server Actions Summary

**Service-role Supabase admin client + wipeCollection + deleteAccount server actions implementing the Danger Zone backend with storage-before-DB ordering and explicit public.users deletion**

## Performance

- **Duration:** 5 minutes
- **Tasks:** 3
- **Files created/modified:** 3

## Accomplishments

- Created `src/lib/supabase/admin.ts` — service-role client factory with `import 'server-only'` guard, `auth: { autoRefreshToken: false, persistSession: false }`, per-call construction (never module-scoped)
- Created `src/app/actions/account.ts` with both server actions:
  - `wipeCollection()` — purges `wear-photos/{userId}/` storage via paginated list-then-remove, then deletes `wear_events` + `watches` rows, then revalidates caches; preserves `public.users`, `profiles`, `follows`
  - `deleteAccount()` — purges storage FIRST, then `db.delete(users)` (cascades all 9 child tables), then `auth.admin.deleteUser()` (removes `auth.users`); no sign-out/redirect (D-07)
- Both integration test files (`account-wipe.test.ts`, `account-delete.test.ts`) pass (module-contract tests GREEN; env-gated tests skip cleanly without `DATABASE_URL`)

## Task Commits

| # | Task | Commit | Type | Files |
|---|------|--------|------|-------|
| 1 | Create service-role admin client | `955d1fc` | feat | src/lib/supabase/admin.ts |
| 2 | Implement wipeCollection server action | `b47527f` | feat | src/app/actions/account.ts |
| 3 | Implement deleteAccount + fix test hoisting | `e0055be` | feat | tests/integration/account-delete.test.ts |

## Files Created/Modified

- `src/lib/supabase/admin.ts` — `createSupabaseAdminClient()` factory; `import 'server-only'`; base SDK `createClient` (not `@supabase/ssr`); `SUPABASE_SERVICE_ROLE_KEY`; `persistSession: false`
- `src/app/actions/account.ts` — `'use server'`; `wipeCollection` + `deleteAccount`; `purgeWearPhotos` shared helper; all auth guards via `getCurrentUser()` try/catch
- `tests/integration/account-delete.test.ts` — Rule 1 fix: replaced top-level `const mockX = vi.fn()` refs used inside `vi.mock()` factories with `vi.hoisted()` pattern

## Decisions Made

- **Storage-before-DB enforced in both actions:** `purgeWearPhotos` runs before any `db.delete()` call in both `wipeCollection` and `deleteAccount`. This satisfies success criterion 2 and RESEARCH Pitfall 2 — if storage purge fails, no DB rows are deleted (fail-closed).
- **Explicit `db.delete(users)` is load-bearing:** `auth.admin.deleteUser()` deletes only the `auth.users` row; `public.users` has no FK to `auth.users` (RESEARCH Pitfall 1). The explicit delete cascades to all 9 child tables.
- **`purgeWearPhotos` shared helper:** Both actions perform identical storage purge logic. Extracted as a module-internal helper to avoid duplication while keeping the file self-contained (not a separate module).
- **D-07 honored:** `deleteAccount` returns `{ success: true, data: undefined }` with no sign-out, no redirect — the browser modal (41-03) owns the post-delete sign-out + redirect to `/`.
- **D-08 honored:** No `notifications.actor_id` cascade copy appears anywhere in the action code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Vitest hoisting crash in account-delete.test.ts (41-01 RED scaffold)**
- **Found during:** Task 3 (running integration tests)
- **Issue:** `tests/integration/account-delete.test.ts` declared `const mockStorageList = vi.fn()...` at module scope but referenced these constants inside `vi.mock()` factory functions. Vitest hoists `vi.mock()` calls above all other code, so the `const` bindings were not yet initialized when the factories executed — causing `ReferenceError: Cannot access 'mockStorageList' before initialization`.
- **Fix:** Replaced the four top-level `const mock* = vi.fn()` declarations with a single `vi.hoisted()` call that returns all four as an object. `vi.hoisted()` runs before Vitest's hoist step, so the refs are available to both factory closures and the test body. Also added `vi.mock('next/cache')` and `vi.mock('@/data/profiles')` that the action now requires.
- **Files modified:** `tests/integration/account-delete.test.ts`
- **Commit:** `e0055be`

**2. [Rule 1 - Bug] Reverted accidental commit to main from cwd-drift**
- **Found during:** Task 1
- **Issue:** First `git add + git commit` ran in the main repo (`/Users/tylerwaneka/Documents/horlo`) instead of the worktree because the `cd` command changed cwd. Commit `e2093de` landed on `main`.
- **Fix:** Reverted `e2093de` on `main` via `git revert` (commit `6870555`). Re-created `admin.ts` in the worktree root and committed correctly from there.
- **Net effect on main:** No-op after revert.

## Threat Model Coverage

All STRIDE threats from the plan's `<threat_model>` are mitigated:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-41-03 | Both actions derive user id ONLY from `getCurrentUser()` (server-side `auth.getUser()`); no client-supplied id accepted; every delete scoped `eq(...userId, user.id)` |
| T-41-04 | `import 'server-only'` in `admin.ts`; client created per-call; confined to `src/app/actions/account.ts` only |
| T-41-05 | Auth guard via `getCurrentUser()` try/catch; session check rejects unauthenticated callers; re-auth is a confirmation gate in the modal (41-03), not the authZ boundary here |
| T-41-06 | Storage purge prefix is `${user.id}/` derived from authenticated session — never from client input |
| T-41-07 | Fail-closed: storage purge before DB delete; if purge throws, no DB delete occurs. If `db.delete(users)` succeeds but `auth.admin.deleteUser` fails, returns error — orphaned `auth.users` row is recoverable by re-running. Documented as accepted residual. |

## Known Stubs

None — both server actions are fully implemented and wired to real storage/DB/auth calls.

## Self-Check: PASSED

Files verified present:
- `src/lib/supabase/admin.ts` — FOUND
- `src/app/actions/account.ts` — FOUND

Commits verified in git log:
- `955d1fc` — FOUND (feat(41-02): create service-role Supabase admin client)
- `b47527f` — FOUND (feat(41-02): implement wipeCollection server action)
- `e0055be` — FOUND (feat(41-02): implement deleteAccount server action + fix test hoisting)

---
phase: "04"
plan: 2
plan_name: auth-lib
subsystem: authentication
tags: [phase-4, wave-2, supabase, auth-lib, server-action]
requirements: [AUTH-01, AUTH-02]
wave: 2
depends_on: [1]
dependency_graph:
  requires:
    - "@supabase/ssr 0.10.2 (from 04-01)"
    - "tests/helpers/mock-supabase.ts (from 04-01)"
    - "tests/auth.test.ts stubs (from 04-01)"
    - "tests/actions/auth.test.ts stub (from 04-01)"
  provides:
    - "src/lib/supabase/server.ts — createSupabaseServerClient()"
    - "src/lib/supabase/client.ts — createSupabaseBrowserClient()"
    - "src/lib/supabase/proxy.ts — updateSession(request)"
    - "src/lib/auth.ts — getCurrentUser() + UnauthorizedError"
    - "src/app/actions/auth.ts — logout Server Action"
    - "tests/shims/server-only.ts — vitest alias target"
  affects:
    - "vitest.config.ts (added server-only alias)"
tech-stack:
  added: []
  patterns:
    - "Three-file Supabase helper split: server/client/proxy"
    - "supabase.auth.getUser() (server-verified) — never getSession()"
    - "getAll/setAll cookie adapter — never get/set/remove (0.10.2 shape)"
    - "let response closure idiom in proxy for cookie propagation"
    - "server-only guard on server modules; vitest alias shim for unit test"
key-files:
  created:
    - path: "src/lib/supabase/server.ts"
      purpose: "createSupabaseServerClient() — await cookies() + getAll/setAll adapter"
    - path: "src/lib/supabase/client.ts"
      purpose: "createSupabaseBrowserClient() for 'use client' form components"
    - path: "src/lib/supabase/proxy.ts"
      purpose: "updateSession(request) — cookie-propagating helper for proxy.ts (Plan 03)"
    - path: "src/lib/auth.ts"
      purpose: "getCurrentUser() + UnauthorizedError facade"
    - path: "src/app/actions/auth.ts"
      purpose: "logout Server Action (signOut + redirect)"
    - path: "tests/shims/server-only.ts"
      purpose: "Vitest shim aliasing 'server-only' to a no-op for unit tests"
  modified:
    - path: "vitest.config.ts"
      change: "Added server-only alias to tests/shims/server-only.ts"
    - path: "tests/auth.test.ts"
      change: "Replaced 4 todos + added cookies-await test; now 6 real passing tests"
    - path: "tests/actions/auth.test.ts"
      change: "Replaced 1 todo with real signOut+redirect assertion"
decisions:
  - "Used vitest resolve.alias to stub `server-only` in tests instead of vi.mock per file — one-time config vs. repeated boilerplate"
  - "Kept the three-file Supabase helper split verbatim from RESEARCH Q1/Q3 — no reinvention, all shapes validated by @supabase/ssr 0.10.2 types"
  - "getCurrentUser uses supabase.auth.getUser (server-verified) — rejects tampered-but-valid-shaped JWTs (T-4-02 mitigation)"
  - "logout throws NEXT_REDIRECT by design — it is the single documented exception to Phase 3 D-12 'never throw across Server Action boundary'"
metrics:
  duration_minutes: 15
  tasks_completed: 3
  files_created: 6
  files_modified: 3
  completed_date: 2026-04-13
---

# Phase 4 Plan 2: Auth Library Summary

**One-liner:** Shipped the shared Supabase auth library (three-file server/client/proxy helpers + getCurrentUser facade + logout Server Action) that every downstream Wave 3 plan imports from; converted all five AUTH-01/02 stubs in tests/auth.test.ts and tests/actions/auth.test.ts from `it.todo` to real passing assertions.

## Outcome

Every import listed in the plan's `<success_criteria>` now resolves and typechecks:

1. `import { createSupabaseServerClient } from '@/lib/supabase/server'`
2. `import { createSupabaseBrowserClient } from '@/lib/supabase/client'`
3. `import { updateSession } from '@/lib/supabase/proxy'`
4. `import { getCurrentUser, UnauthorizedError } from '@/lib/auth'`
5. `import { logout } from '@/app/actions/auth'`

Full test suite: **470 passed, 20 todo, 0 failed** (up from 463/25/0 — the 5 formerly-todo tests in scope of this plan are now real passing assertions).

## Task Log

### Task 1 — Create src/lib/supabase/{server,client,proxy}.ts helpers
- Commit: `c5f555b`
- Wrote server.ts, client.ts, proxy.ts verbatim from RESEARCH Q1/Q3
- Discovered `@supabase/ssr` was missing from node_modules (stale install) — ran `npm install` to restore
- Added `tests/shims/server-only.ts` + `vitest.config.ts` alias so server-only modules can be unit tested under jsdom
- First real test: `createSupabaseServerClient awaits cookies() from next/headers`
- Vitest: 1 passing + 4 remaining todos (getCurrentUser, deferred to Task 2)
- Grep checks: contains `'server-only'`, `await cookies()`, `getAll()`, `setAll(`; does NOT contain `get(name`

### Task 2 — Create src/lib/auth.ts with getCurrentUser + UnauthorizedError
- Commit: `84f4442`
- Wrote src/lib/auth.ts verbatim from RESEARCH Q3/Q8
- Converted all four getCurrentUser/UnauthorizedError todos in tests/auth.test.ts to real assertions plus the cookies-await carryover from Task 1 → 6 passing tests
- `supabase.auth.getUser()` used; `getSession()` NEVER used (grep clean)
- T-4-02 Spoofing mitigation verified: server-verified user lookup, not JWT-decode

### Task 3 — Create logout Server Action at src/app/actions/auth.ts
- Commit: `f968a56`
- Wrote src/app/actions/auth.ts verbatim from RESEARCH Q6
- Replaced single todo in tests/actions/auth.test.ts with real assertion covering signOut-then-redirect order (via `invocationCallOrder`)
- Logout throws NEXT_REDIRECT by design (Phase 3 D-12 documented exception per CONTEXT specifics)

## Deviations from Plan

**[Rule 3 - Blocking] `@supabase/ssr` missing from node_modules**
- **Found during:** Task 1 first vitest run
- **Issue:** Despite Plan 01 adding `@supabase/ssr@0.10.2` to package.json, node_modules/@supabase/ was not present (probably stale install from a worktree operation)
- **Fix:** Ran `npm install` to reconcile lockfile with node_modules
- **Files modified:** none (lockfile was already correct)

**[Rule 3 - Blocking] `server-only` import breaks vitest transform**
- **Found during:** Task 1 first vitest run
- **Issue:** Real `server-only` package throws on import outside a Server Component context, breaking any unit test that imports src/lib/supabase/server.ts or src/lib/auth.ts
- **Fix:** Added `tests/shims/server-only.ts` (empty module) and a `resolve.alias` entry in `vitest.config.ts` mapping `'server-only'` → the shim. Industry-standard approach for Next.js server-module unit tests
- **Files modified:** `vitest.config.ts`, `tests/shims/server-only.ts` (new)
- **Commit:** `c5f555b`

**[Rule 3 - Blocking] Missing env vars in unit tests**
- **Found during:** Task 1 first vitest run
- **Issue:** `createServerClient` throws "supabaseUrl is required" when env vars are unset in the vitest process
- **Fix:** Set `process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'` and `NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'` at the top of `tests/auth.test.ts`. Uses `??=` to defer to real env if set (e.g., CI)
- **Files modified:** `tests/auth.test.ts`
- **Commit:** `c5f555b`

All three auto-fixes were scoped to the current plan's test entry point and did not touch unrelated files.

## Authentication Gates

None. Task 2 in Plan 01 was the local Supabase bring-up gate; Plan 02 is unit-test-only and needs no live Supabase.

## Known Stubs

None introduced by this plan. The plan consumed 5 of the 25 stubs created by Plan 01:

| Test file | Stubs converted |
|-----------|-----------------|
| `tests/auth.test.ts` | 4 → all 4 real + 1 new cookies-await test (5 real total) |
| `tests/actions/auth.test.ts` | 1 → real |

Remaining 20 todo placeholders are out of scope (Plans 03/04/05/06 will replace them).

## Verification (from plan)

- [x] `npx vitest run tests/auth.test.ts tests/actions/auth.test.ts` — zero failures, zero remaining todos in these files
- [x] `npx tsc --noEmit` — zero errors in src/lib/supabase/**, src/lib/auth.ts, src/app/actions/auth.ts (unrelated pre-existing drizzle module-resolution errors in src/data/** + drizzle.config.ts untouched per Scope Boundary)
- [x] `grep -r "getSession()" src/lib src/app/actions` — no matches
- [x] `grep -r "get(name" src/lib/supabase` — no matches

## Commits

- `c5f555b` — feat(04-02): add supabase server/client/proxy helpers
- `84f4442` — feat(04-02): add getCurrentUser + UnauthorizedError facade
- `f968a56` — feat(04-02): add logout Server Action

## Self-Check: PASSED

- FOUND: src/lib/supabase/server.ts
- FOUND: src/lib/supabase/client.ts
- FOUND: src/lib/supabase/proxy.ts
- FOUND: src/lib/auth.ts
- FOUND: src/app/actions/auth.ts
- FOUND: tests/shims/server-only.ts
- FOUND: commit c5f555b
- FOUND: commit 84f4442
- FOUND: commit f968a56
- VERIFIED: tests/auth.test.ts reports 6 passed, 0 todo
- VERIFIED: tests/actions/auth.test.ts reports 1 passed, 0 todo
- VERIFIED: full suite 470 passed, 20 todo, 0 failed

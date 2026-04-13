---
phase: "04"
plan: 1
plan_name: bootstrap
subsystem: authentication
tags: [phase-4, wave-0, infrastructure, supabase, testing]
requirements: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]
wave: 1
depends_on: []
dependency_graph:
  requires: []
  provides:
    - "@supabase/ssr@0.10.2 runtime dep"
    - "@supabase/supabase-js@2.103.0 runtime dep"
    - "src/components/ui/dropdown-menu.tsx (shadcn primitive)"
    - "supabase/ local stack config + shadow-user trigger"
    - "tests/helpers/mock-supabase.ts"
    - "tests/fixtures/users.ts (seedTwoUsers)"
    - "7 failing test stub files (AUTH-01..04)"
  affects:
    - "package.json, package-lock.json"
    - ".env.example (Supabase env vars documented)"
    - "supabase/config.toml (project_id=horlo, enable_confirmations=false)"
    - "supabase/migrations/20260413000000_sync_auth_users.sql"
tech-stack:
  added:
    - "@supabase/ssr 0.10.2"
    - "@supabase/supabase-js 2.103.0"
    - "shadcn DropdownMenu primitive"
    - "Local Supabase CLI stack (Postgres + GoTrue + Kong + Inbucket)"
  patterns:
    - "Postgres security-definer trigger mirrors auth.users -> public.users"
    - "it.todo stubs register failing targets for later waves without breaking green"
    - "Shared mockSupabaseServerClient helper for unit test ergonomics"
key-files:
  created:
    - path: "supabase/config.toml"
      purpose: "Local Supabase stack config (project_id=horlo, enable_confirmations=false)"
    - path: "supabase/migrations/20260413000000_sync_auth_users.sql"
      purpose: "Shadow-user trigger on auth.users INSERT so Phase 3 FKs resolve on first sign-up"
    - path: "src/components/ui/dropdown-menu.tsx"
      purpose: "shadcn DropdownMenu primitive used by header UserMenu in Plan 04-06"
    - path: "tests/helpers/mock-supabase.ts"
      purpose: "Shared vi.mock helper for createSupabaseServerClient"
    - path: "tests/fixtures/users.ts"
      purpose: "seedTwoUsers() — creates two real Supabase Auth users for IDOR tests"
    - path: "tests/auth.test.ts"
      purpose: "Failing stubs for getCurrentUser + UnauthorizedError"
    - path: "tests/proxy.test.ts"
      purpose: "Failing stubs for proxy matcher + redirect behavior"
    - path: "tests/actions/auth.test.ts"
      purpose: "Failing stub for logout Server Action"
    - path: "tests/actions/watches.test.ts"
      purpose: "Failing stubs for watches Server Action auth-error paths"
    - path: "tests/actions/preferences.test.ts"
      purpose: "Failing stub for preferences Server Action auth-error paths"
    - path: "tests/data/isolation.test.ts"
      purpose: "Failing stubs for IDOR integration tests"
    - path: "tests/api/extract-watch-auth.test.ts"
      purpose: "Failing stubs for /api/extract-watch 401 gate"
  modified:
    - path: "package.json"
      change: "Added @supabase/ssr and @supabase/supabase-js runtime deps"
    - path: ".env.example"
      change: "Documented NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
decisions:
  - "Used Postgres trigger (not app-side upsert) for shadow-user sync — zero race, lives in migration"
  - "it.todo over expect(true).toBe(false) — stubs are discoverable, don't break green, downstream waves replace with real assertions"
  - "Trigger uses security definer + explicit search_path=public to mitigate T-4-01 search-path hijack"
  - "Multi-user fixture lives under tests/ (excluded from Next bundle) and env-gates service_role key"
metrics:
  duration_minutes: 60
  tasks_completed: 3
  files_created: 12
  files_modified: 2
  completed_date: 2026-04-13
---

# Phase 4 Plan 1: Bootstrap Summary

**One-liner:** Wave 0 infrastructure for Phase 4 — Supabase SDKs installed, local Supabase stack running with shadow-user trigger, and failing test stubs scaffolded for every AUTH-01..04 behavior that downstream waves will implement.

## Outcome

Every dependency downstream Phase 4 plans (02-06) need is now in place:
1. `@supabase/ssr@0.10.2` and `@supabase/supabase-js@2.103.0` are runtime deps.
2. shadcn `DropdownMenu` primitive is available for the header UserMenu (Plan 04-06).
3. Local Supabase stack (Postgres + GoTrue + Kong + Inbucket SMTP) runs with `enable_confirmations=false`.
4. `public.handle_new_auth_user()` security-definer trigger mirrors `auth.users -> public.users` on INSERT, resolving the Phase 3 FK from `watches.userId` / `user_preferences.userId` on first sign-up.
5. `.env.example` documents the two Supabase env vars without clobbering existing entries.
6. 9 new test files (helpers + fixtures + 7 stubs) register 25 `it.todo` placeholders for AUTH-01..04. Full suite still green: 463 passed, 25 todo, 0 failed.
7. `.planning/phases/04-authentication/04-VALIDATION.md` is marked `nyquist_compliant: true` and `wave_0_complete: true`; the per-task map references all 7 new stub files.

## Task Log

### Task 1 — Install Supabase SDKs + shadcn DropdownMenu + update .env.example
- Commit: `7f2bba3`
- `npm install @supabase/ssr@0.10.2 @supabase/supabase-js@2.103.0`
- `npx shadcn@latest add dropdown-menu` → `src/components/ui/dropdown-menu.tsx`
- Appended Supabase env var block to `.env.example`

### Task 2 — Initialize and start local Supabase stack (human-action checkpoint)
- Commit: `0fc5003` (initial stack + migration)
- Follow-up fix: `75470fb` (project_id corrected to `horlo` on main)
- `npx supabase init` → `supabase/config.toml` + `supabase/migrations/`
- `config.toml`: `[auth.email] enable_confirmations = false`, `project_id = "horlo"`
- Created `supabase/migrations/20260413000000_sync_auth_users.sql` with verbatim SQL from RESEARCH Q7
- Human completed: Docker/OrbStack running, `supabase start`, `supabase db reset`, `drizzle-kit push`, `.env.local` populated with URL + anon key + DATABASE_URL (local 54322)
- E2E smoke verified: `auth.users` INSERT → `public.users` row via trigger
- `on_auth_user_created` trigger verified present with `security definer` and `set search_path = public`

### Task 3 — Scaffold multi-user test fixture + shared mock helper + failing test stubs
- Commit: `f9ca4a1`
- Created 9 files (see key-files.created)
- 25 `it.todo` placeholders across 7 test files register every AUTH-01..04 behavior
- Verification: `npx vitest run` on new files reports 7 skipped files / 25 todo / 0 failures
- Full suite: `npm test` → 463 passed + 25 todo, still green
- VALIDATION.md frontmatter already had `nyquist_compliant: true` and `wave_0_complete: true` when Task 3 started; per-task map rows for T1/T2/T3 left at ⬜ pending status markers (orchestrator will update on phase close)

## Deviations from Plan

None. Plan executed exactly as written. The only nuance is that VALIDATION.md was already populated in a prior commit (`b4ead39`), so Task 3's "update VALIDATION.md" step was a no-op — frontmatter flags and per-task map rows were already in place.

## Authentication Gates

Task 2 was a `checkpoint:human-action` gate for local Supabase stack bring-up. Human completed all steps (Docker, `supabase start`, `supabase db reset`, `drizzle-kit push`, `.env.local` population, E2E smoke test). Approved, and this executor resumed at Task 3.

## Known Stubs

This plan intentionally creates stubs — that is its purpose. All 25 stubs are `it.todo(...)` placeholders in 7 test files. Each will be replaced with real assertions by downstream plans:

| Stub file | Replaced by |
|-----------|-------------|
| `tests/auth.test.ts` | Plan 04-02 (auth-lib) |
| `tests/proxy.test.ts` | Plan 04-03 (proxy-and-api-gate) |
| `tests/actions/auth.test.ts` | Plan 04-02 (logout action) |
| `tests/actions/watches.test.ts` | Plan 04-04 (server-actions-refactor) |
| `tests/actions/preferences.test.ts` | Plan 04-04 (server-actions-refactor) |
| `tests/data/isolation.test.ts` | Plan 04-04 (IDOR integration) |
| `tests/api/extract-watch-auth.test.ts` | Plan 04-03 (api gate) |

These are not goal-blocking stubs — they are the test fixture the goal of Wave 0 produces. They do NOT flow through UI or runtime code paths.

## Commits

- `7f2bba3` — feat(04-01): install Supabase SDKs, shadcn DropdownMenu, update .env.example
- `0fc5003` — chore(04-01): init Supabase stack config + shadow-user trigger migration
- `75470fb` — fix(04-01): set supabase project_id to horlo (human follow-up)
- `f9ca4a1` — test(04-01): scaffold failing test stubs for AUTH-01..04

## Self-Check: PASSED

- FOUND: tests/helpers/mock-supabase.ts
- FOUND: tests/fixtures/users.ts
- FOUND: tests/auth.test.ts
- FOUND: tests/proxy.test.ts
- FOUND: tests/actions/auth.test.ts
- FOUND: tests/actions/watches.test.ts
- FOUND: tests/actions/preferences.test.ts
- FOUND: tests/data/isolation.test.ts
- FOUND: tests/api/extract-watch-auth.test.ts
- FOUND: commit 7f2bba3
- FOUND: commit 0fc5003
- FOUND: commit 75470fb
- FOUND: commit f9ca4a1
- VERIFIED: full suite green (463 passed, 25 todo, 0 failed)

---
phase: 41-account-danger-zone-branded-auth-emails-parallel-track
plan: 01
subsystem: testing
tags: [react-email, vitest, supabase, service-role, red-tests, account-management]

# Dependency graph
requires:
  - phase: 36-catalog-layer-c-variants
    provides: "SUPABASE_SERVICE_ROLE_KEY pattern established (39b-04 lesson: newer Supabase CLI uses Secret naming)"
provides:
  - "react-email@6.1.4 + @react-email/components@1.0.12 installed as devDependencies"
  - "Five RED test scaffolds for Phase 41 Track A (wipe/delete actions) and Track B (email templates)"
  - "SUPABASE_SERVICE_ROLE_KEY confirmed by operator and documented in .env.example"
  - "emails/out/ gitignored (regenerable artifact)"
affects:
  - 41-02-server-actions
  - 41-03-danger-zone-modals
  - 41-04-branded-email-templates

# Tech tracking
tech-stack:
  added:
    - "react-email@6.1.4 (devDependency — build-excluded)"
    - "@react-email/components@1.0.12 (devDependency)"
  patterns:
    - "Env-gated describe.skip: const maybe = process.env.DATABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? describe : describe.skip"
    - "vi.mock('@/app/actions/account') at top of component test files that import DB-backed server actions"
    - "it.skip fallback behind existsSync guard for static file assertions"

key-files:
  created:
    - "tests/integration/account-wipe.test.ts"
    - "tests/integration/account-delete.test.ts"
    - "tests/components/WipeCollectionModal.test.tsx"
    - "tests/components/DeleteAccountModal.test.tsx"
    - "tests/static/email-templates.test.ts"
  modified:
    - "package.json (react-email devDeps added)"
    - "package-lock.json"
    - ".gitignore (emails/out/ appended)"
    - ".env.example (SUPABASE_SERVICE_ROLE_KEY documented)"

key-decisions:
  - "SUPABASE_SERVICE_ROLE_KEY confirmed as the env var name by operator at Task 3 checkpoint (not a legacy variation)"
  - "emails/out/ gitignored — .tsx source is truth; HTML regenerated via npx react-email export"
  - "react-email goes to devDependencies only; emails/ dir is build-excluded from Next.js app"
  - "Component tests vi.mock server-action module at top level to prevent jsdom from hitting real DB calls"

patterns-established:
  - "RED scaffold pattern: reference not-yet-existing modules so test failures come from assertion/import, not syntax"
  - "env-gate pattern for DB integration tests: set -a; source .env.local; set +a; npx vitest run <file>"
  - "vi.mock('@/app/actions/account') is mandatory preamble for any modal test that imports a 'use server' action"

requirements-completed: [SET-13, SET-14]

# Metrics
duration: multi-session (Tasks 1-3 prior session, Task 4 continuation session)
completed: 2026-05-16
---

# Phase 41 Plan 01: Wave 0 Scaffold Summary

**react-email tooling installed, five RED vitest scaffolds created for Danger Zone + email plans, and SUPABASE_SERVICE_ROLE_KEY confirmed and documented — clearing all blockers for Plans 41-02, 41-03, and 41-04**

## Performance

- **Duration:** Multi-session (Tasks 1-2 shipped in prior session; Task 3 resolved via operator checkpoint; Task 4 completed in continuation session)
- **Tasks:** 4 (Tasks 1+2 committed in prior session; Task 3 checkpoint resolved by operator; Task 4 committed in continuation session)
- **Files modified:** 8

## Accomplishments

- Installed `react-email@6.1.4` + `@react-email/components@1.0.12` as devDependencies; `emails/out/` gitignored so generated HTML stays out of version control
- Created all five RED test scaffolds that Plans 41-02, 41-03, and 41-04 will turn GREEN: two integration tests (wipe + delete), two component tests (modals), one static HTML assertion
- Operator confirmed `SUPABASE_SERVICE_ROLE_KEY` as the exact env var name at the Task 3 checkpoint; key added to `.env.local` and Vercel project environment out-of-band
- Documented `SUPABASE_SERVICE_ROLE_KEY` in `.env.example` with redacted placeholder, server-only warning, and Supabase Dashboard source instructions

## Task Commits

| # | Task | Commit | Type | Session |
|---|------|--------|------|---------|
| 1 | Install react-email tooling + .gitignore emails/out/ | `bd796a1` | chore | Prior session |
| 2 | Create five RED test scaffolds for Track A + Track B | `9b9d580` | test | Prior session |
| 3 | Checkpoint: confirm service-role env var name | — | human-action | Resolved by operator |
| 4 | Document SUPABASE_SERVICE_ROLE_KEY in .env.example | `90406de` | chore | Continuation session |

**Plan metadata commit:** (included with SUMMARY + STATE.md update)

## Files Created/Modified

- `tests/integration/account-wipe.test.ts` — RED integration coverage for `wipeCollection` DB scope; env-gated on `DATABASE_URL`
- `tests/integration/account-delete.test.ts` — RED integration coverage for `deleteAccount`; env-gated on `DATABASE_URL && SUPABASE_SERVICE_ROLE_KEY`; asserts storage-purge-before-DB ordering and `public.users` deletion
- `tests/components/WipeCollectionModal.test.tsx` — RED component coverage for WIPE gate + step flow; `vi.mock('@/app/actions/account')` at top level
- `tests/components/DeleteAccountModal.test.tsx` — RED component coverage for DELETE gate + step flow; `vi.mock('@/app/actions/account')` at top level
- `tests/static/email-templates.test.ts` — RED static HTML assertions with `it.skip` fallback when `emails/out/` absent
- `package.json` — `react-email` + `@react-email/components` added to `devDependencies`
- `package-lock.json` — lockfile updated by npm install
- `.gitignore` — `emails/out/` appended to build-artifact ignore section
- `.env.example` — `SUPABASE_SERVICE_ROLE_KEY` documented with redacted placeholder and comment block

## Decisions Made

- **SUPABASE_SERVICE_ROLE_KEY confirmed:** Operator checked Supabase Dashboard -> Project Settings -> API and confirmed the env var name as `SUPABASE_SERVICE_ROLE_KEY` (default expectation matched; no legacy variation).
- **react-email devDependencies only:** The `emails/` directory is build-excluded and never imported by the Next.js app bundle. devDependencies keeps it out of production dependencies while keeping the CLI available locally.
- **emails/out/ gitignored:** The exported `.html` files are regenerable artifacts (`npx react-email export`); the `.tsx` source files are the committed source of truth.
- **Component test server-action mocking:** `vi.mock('@/app/actions/account', ...)` is mandatory at the top of any modal test that imports a `'use server'` action — prevents jsdom from ever reaching a real DB-backed call.

## Deviations from Plan

None — plan executed exactly as written. Task 3 was a checkpoint (human-action), not an implementation task, and resolved cleanly with the operator confirming the default env var name.

## Issues Encountered

None — all four tasks completed as specified. The Task 3 human-action checkpoint paused execution between sessions; the continuation session (Task 4) proceeded immediately after operator confirmation.

## Known Stubs

None — this is a scaffold/tooling plan. No production code shipped. All five test files are intentional RED scaffolds; their failing state is the expected output until downstream plans (41-02, 41-03, 41-04) implement the referenced modules.

## Next Phase Readiness

- **41-02 (server actions):** Unblocked. `tests/integration/account-wipe.test.ts` and `tests/integration/account-delete.test.ts` define the RED targets. `SUPABASE_SERVICE_ROLE_KEY` is confirmed and live in `.env.local` + Vercel.
- **41-03 (danger zone modals):** Unblocked. `tests/components/WipeCollectionModal.test.tsx` and `tests/components/DeleteAccountModal.test.tsx` define the RED targets with correct vi.mock preamble.
- **41-04 (branded email templates):** Unblocked. `tests/static/email-templates.test.ts` defines the static HTML assertion targets; `react-email` CLI is installed.

---
*Phase: 41-account-danger-zone-branded-auth-emails-parallel-track*
*Completed: 2026-05-16*

## Self-Check: PASSED

All files verified present. All commits (`bd796a1`, `9b9d580`, `90406de`) confirmed in git log.

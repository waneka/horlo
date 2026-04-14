---
phase: 05-migration-zustand-cleanup-similarity-rewire-prod-db-bootstrap
plan: 02
subsystem: infra
tags: [docs, ops, supabase, drizzle, vercel, runbook]

requires:
  - phase: 03-data-layer-foundation
    provides: Drizzle schema + migration tooling that the runbook drives
  - phase: 04-authentication
    provides: shadow-user trigger migration (20260413000000_sync_auth_users.sql) that the runbook applies
provides:
  - docs/deploy-db-setup.md — authoritative OPS-01 prod bootstrap runbook
  - Explicit DATABASE_URL guidance (direct connection for drizzle-kit, session pooler for Vercel runtime)
  - Smoke test and rollback procedures for Plan 06 execution checkpoint
affects: [05-06, future deploy cycles, onboarding new operators]

tech-stack:
  added: []
  patterns:
    - "Runbook format: numbered H2 sections, copy-pasteable commands, <ANGLE_BRACKET> placeholders, expected-output snippets, footgun callouts"

key-files:
  created:
    - docs/deploy-db-setup.md
  modified: []

key-decisions:
  - "DATABASE_URL for drizzle-kit migrate uses direct connection (port 5432, db.<ref>.supabase.co) — transaction pooler breaks prepared statements"
  - "DATABASE_URL for Vercel runtime uses session-mode pooler (pooler.supabase.com) — standard app runtime guidance"
  - "Every vercel env add command must explicitly pass production scope — preview/development is the silent default"

patterns-established:
  - "Runbook pattern: preconditions → numbered sections → smoke test → rollback section covering top failure modes"

requirements-completed: [OPS-01]

duration: 5min
completed: 2026-04-14
---

# Phase 05 Plan 02: Prod DB Bootstrap Runbook Summary

**OPS-01 runbook shipped — copy-pasteable single-pass procedure for linking prod Supabase (`wdntzsckjaoqodsyscns`) and Vercel `horlo.app` with explicit DATABASE_URL scope guidance and rollback procedures.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-14T05:30:00Z
- **Completed:** 2026-04-14T05:35:00Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments

- `docs/deploy-db-setup.md` created with all 5 required H2 sections (Link Supabase, Apply migrations, Set Vercel env vars, Smoke test, Rollback)
- Direct-connection vs session-pooler DATABASE_URL distinction captured as explicit footgun callout
- Vercel env var `production` scope footgun captured as explicit callout
- Rollback section covers all 5 documented failure modes (partial drizzle migration, trigger re-run, wrong env vars, stuck signup, full deploy rollback)
- No real secrets in committed file (verified via `grep -E "eyJ|postgres://postgres:[^<]"` — only descriptive `eyJ...` prose match, no real JWT or password)

## Task Commits

1. **Task 1: Create docs/deploy-db-setup.md — prod DB bootstrap runbook** — `7a5a2fa` (docs)

## Files Created/Modified

- `docs/deploy-db-setup.md` — OPS-01 prod bootstrap runbook (created; `docs/` directory also created as part of this task)

## Decisions Made

- None beyond what the plan already specified. Runbook content was produced verbatim per plan Task 1 action block.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The `docs/` directory did not yet exist; created it as part of the task (expected per plan instructions).

## User Setup Required

**External services require manual configuration during Plan 06 execution (not now).** The runbook itself lists preconditions:

- Supabase CLI 2.x installed and authenticated
- Vercel CLI installed and `vercel link`ed to the horlo.app project
- Dashboard access to Supabase project `wdntzsckjaoqodsyscns`
- Dashboard access to the Vercel `horlo.app` project

See `docs/deploy-db-setup.md` for the full step-by-step procedure the operator will execute in Plan 06.

## Next Phase Readiness

- Runbook is ready for Plan 06 execution checkpoint (the human-action gate that actually runs these steps against prod)
- No blockers
- Parallel code-refactor plans (01/03/04/05) are unaffected by this docs-only change

## Self-Check: PASSED

- FOUND: docs/deploy-db-setup.md
- FOUND: commit 7a5a2fa

---
*Phase: 05-migration-zustand-cleanup-similarity-rewire-prod-db-bootstrap*
*Completed: 2026-04-14*

---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: Watch Photos & Detail Redesign
status: executing
stopped_at: Phase 59 Plan 01 complete — ready for Plan 02
last_updated: "2026-05-25T06:43:00.000Z"
last_activity: 2026-05-25
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 3
  completed_plans: 1
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25 — v7.0 roadmap created)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 59 — unified-route-variant-c

## Current Position

Phase: 59 (unified-route-variant-c) — EXECUTING
Plan: 2 of 3
Status: Ready to execute
Last activity: 2026-05-25

Progress: [███░░░░░░░] 33%

## Performance Metrics

- v6.0: 8 phases (53-58 + 56A + 57.1), 37 plans, 3 days
- 34/34 v6.0 requirements shipped
- Blockers encountered: 0

## Accumulated Context

### Key Decisions

- **Variant C is a hard cutover** (operator decision 2026-05-25) — legacy `/watch/[id]` + `/catalog/[catalogId]` routes are REMOVED (no redirect); un-migrated links fail loudly; CI guard is the completeness guarantee (ROUTE-03).
- **`watches_catalog` is NOT wipeable** — in-place ALTER only for photo schema; data migrations keyed by (brand, model, reference), not id (ids diverge local/prod).
- **`workflow.use_worktrees = false` is permanent** — this project is build-gated + DB-touching; `.env.local` unavailable in worktrees.
- **DB migrations**: `drizzle-kit push` LOCAL ONLY; prod uses `supabase db push --linked`.
- **Phase ordering is locked**: 59 (route merge) → 60 (photo schema/DAL) → 61 (photo UI) → 62 (wear pics surfacing) → 63 (grid engagement, depends on 59 only) → 64 (IA redesign, depends on 61+62+63).
- **`unstable_instant = false` on `/u/[username]/[tab]` is PERMANENT** — do not re-enable (Phase 52 lesson).
- **Phase 64 must preserve Phase 51/52 Cache Components structure** — CommentThread stays an uncached Suspense sibling.

### Pending Todos

None.

### Blockers/Concerns

None blocking. Plan 01 complete. CI guard is RED (expected — 26 legacy literals remain; Plan 03 re-points them). Route merge (~36 files / ~26 link literals) is the highest-complexity step; CI guard (ROUTE-03) is the safety net.

## Session Continuity

Last activity: 2026-05-25 — Phase 59 Plan 01 complete (DAL extraction, CI guard, integration test scaffold).
Stopped at: Phase 59 Plan 01 complete — ready for Plan 02
Next action: Execute Phase 59 Plan 02 (unified /w/[ref] page + /w/[ref]/edit page)

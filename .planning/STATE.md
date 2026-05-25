---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: Watch Photos & Detail Redesign
status: planning
stopped_at: Phase 59 context gathered
last_updated: "2026-05-25T06:00:11.626Z"
last_activity: 2026-05-25 — v7.0 roadmap created (6 phases, 30/30 requirements mapped)
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25 — v7.0 roadmap created)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** v7.0 Watch Photos & Detail Redesign — Phase 59 (Unified Route, Variant C) is next.

## Current Position

Phase: Not started (Phase 59 ready to plan)
Plan: —
Status: Ready to plan Phase 59
Last activity: 2026-05-25 — v7.0 roadmap created (6 phases, 30/30 requirements mapped)

Progress: [░░░░░░░░░░] 0%

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

None blocking. Route merge (~36 files / ~55 link literals) is the highest-complexity phase; CI guard (ROUTE-03) is the safety net.

## Session Continuity

Last activity: 2026-05-25 — v7.0 roadmap created (Phases 59-64, 30/30 requirements).
Stopped at: Phase 59 context gathered
Next action: `/gsd-plan-phase 59`

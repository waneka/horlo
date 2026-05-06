---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Discovery North Star
status: planning
last_updated: "2026-05-06T20:05:03.964Z"
last_activity: 2026-05-06
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-05 — v4.1 milestone shipped)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Planning next milestone (v5.0 Discovery North Star — SEED-004 anchored on CAT-13 catalog → similarity rewire). SEED-006 premium-features audit completed 2026-05-06 — outcome: **no paywall in v5.0; build Horlo as fully free; revisit monetization post-recommender**. v5.0 scopes freely with no gating decisions to make. See `.planning/research/PREMIUM-MAP.md`.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-06 — Milestone v5.0 started

## Progress Bar

```
v1.0 MVP                          [x] shipped 2026-04-19
v2.0 Taste Network Foundation     [x] shipped 2026-04-22
v3.0 Production Nav & Daily Wear  [x] shipped 2026-04-27
v4.0 Discovery & Polish           [x] shipped 2026-05-03
v4.1 Polish & Patch               [x] shipped 2026-05-05
v5.0 Discovery North Star         [ ] planted (SEED-004)
v6.0 Market Value                 [ ] planted (SEED-005)

[██████████████████████] 5 milestones shipped
```

## Accumulated Context

### Carried Forward

The full Key Decisions log lives in `.planning/PROJECT.md` (Key Decisions table). Per-milestone retrospective in `.planning/RETROSPECTIVE.md`. Active todos and tech debt now live in PROJECT.md `## Requirements → ### Active`. Milestone archives in `.planning/milestones/`.

### Blockers

None. v4.1 closed cleanly.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 2026-05-05-form04-gap3 | useUrlExtractCache — cache /api/extract-watch responses by URL so re-paste skips the round-trip (FORM-04 Gap 3, post-29-05/06 UAT) | 2026-05-05 | 0815c96 | [2026-05-05-form04-gap3-url-extract-cache](./quick/2026-05-05-form04-gap3-url-extract-cache/) |

### Deferred to v4.2 / v5.0+

- **DEBT-09 (NEW from v4.1 Phase 31 audit, HIGH severity)** — `addWatch` / `editWatch` in `src/app/actions/watches.ts` do not persist `notesPublic` and do not call `revalidatePath('/u/{username}/{tab}')`. Phase 23 SUMMARY-claimed implementation never reached `main`. Owner: v4.2 patch or v5.0 carryover.
- ~33 deferred human UAT items across v4.0 Phases 18 / 20 / 20.1 / 22 / 23
- 31 v3.0 deferred human-verification UAT items
- CAT-13 catalog → similarity engine rewire (anchor for v5.0)
- CAT-14 `SET NOT NULL` on `watches.catalog_id` — after 100% backfill verified across two consecutive deploys
- SMTP-06 staging-prod sender split — pending staging Supabase project
- DISC-09/10, SRCH-16/17, FIT-05, SET-13/14, UX-10/11 — see `milestones/v4.0-REQUIREMENTS.md` Future Requirements
- `useWatchSearchVerdictCache` signOut invalidation — pre-existing post-29-05 risk
- Nyquist hardening sweep — 4/5 v4.1 phases PARTIAL; bundle for v5.0 cleanup phase
- Phase 999.1 directory still in `.planning/phases/` (v3.0 archival miss)
- DEBT (Phase 17 local DB reset hygiene) — see PROJECT.md Active

## Session Continuity

Last session: 2026-05-06T05:35:00.000Z
Stopped at: SEED-006 premium-features audit resolved (no paywall in v5.0)
Resume file: N/A — between milestones
Next action: `/clear` then `/gsd-new-milestone` to scope v5.0 Discovery North Star. SEED-006 audit complete (see `.planning/research/PREMIUM-MAP.md`) — v5.0 scopes freely with no monetization gating decisions to make.

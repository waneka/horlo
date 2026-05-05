---
gsd_state_version: 1.0
milestone: v4.1
milestone_name: Polish & Patch
status: executing
stopped_at: Phase 29 Plan 02 complete
last_updated: "2026-05-05T07:25:19.000Z"
last_activity: 2026-05-05 -- Phase 29 Plan 02 (NAV-16 UserMenu Profile row removal) shipped
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 14
  completed_plans: 12
  percent: 86
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03 — v4.0 milestone shipped)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 29 — nav-profile-chrome-cleanup

## Current Position

Phase: 29 (nav-profile-chrome-cleanup) — EXECUTING
Plan: 3 of 4
Status: Executing Phase 29 (Plans 01 + 02 shipped)
Last activity: 2026-05-05 -- Phase 29 Plan 02 (NAV-16 UserMenu Profile row removal) shipped

## Progress Bar

```
v1.0 MVP                          [x] shipped 2026-04-19
v2.0 Taste Network Foundation     [x] shipped 2026-04-22
v3.0 Production Nav & Daily Wear  [x] shipped 2026-04-27
v4.0 Discovery & Polish           [x] shipped 2026-05-03
v4.1 Polish & Patch               [ ] in progress (12/14 plans complete; 86%)
v5.0 Discovery North Star         [ ] planted (SEED-004)
v6.0 Market Value                 [ ] planted (SEED-005)

[████████████████████] 4 milestones shipped
```

## v4.1 Phase Map

| Phase | Name | Requirements |
|-------|------|--------------|
| 27 | Watch Card & Collection Render Polish | WISH-01, VIS-07, VIS-08 |
| 28 | Add-Watch Flow & Verdict Copy Polish | FIT-06, ADD-08, UX-09 |
| 29 | Nav & Profile Chrome Cleanup | NAV-16, PROF-10 |
| 30 | WYWT Capture Alignment Fix | WYWT-22 |
| 31 | v4.0 Verification Backfill | DEBT-07, DEBT-08 |

Coverage: 11/11 requirements mapped.

## Accumulated Context

### Carried Forward

The full Key Decisions log lives in `.planning/PROJECT.md` (Key Decisions table). Per-milestone retrospective in `.planning/RETROSPECTIVE.md`. Active todos and tech debt now live in PROJECT.md `## Requirements → ### Active`. Milestone archives in `.planning/milestones/`.

### Blockers

None.

### Deferred to v5.0+

- ~33 deferred human UAT items across Phases 18 / 20 / 20.1 / 22 / 23
- CAT-13 catalog → similarity engine rewire (anchor for v5.0 — see SEED-004)
- CAT-14 `SET NOT NULL` on `watches.catalog_id` — after 100% backfill verified across two consecutive deploys
- SMTP-06 staging-prod sender split — pending staging Supabase project
- DISC-09/10, SRCH-16/17, FIT-05, SET-13/14, UX-10/11 — see `milestones/v4.0-REQUIREMENTS.md` Future Requirements

### Pulled into v4.1

- Phase 23 + Phase 24 phase-level VERIFICATION.md backfill (DEBT-07, DEBT-08) — close v4.0 verification asymmetry as part of polish/patch
- 5 small features / bug fixes spanning watch card UX, add-watch flow polish, nav chrome cleanup, and WYWT capture math

## Session Continuity

Last session: 2026-05-05T07:25:19.000Z
Stopped at: Phase 29 Plan 02 complete
Next action: Execute Phase 29 Plan 03 (PROF-10 — ProfileTabs horizontal-only scroll className override) or Plan 04 (FORM-04 implementation; depends on Plan 01 test scaffolds, which are shipped). Plans 03 and 04 are independent surfaces; either can run next, or both in parallel since their files do not overlap. Plan 02 shipped NAV-16 UserMenu Profile-row removal (commits 9c2b72c + 37e0aa1): deleted the `{username && <DropdownMenuItem render={<Link href="/u/${username}/collection">Profile</Link>} />}` block from UserMenu.tsx (4 lines + 1 JSDoc adjustment); preserved BOTH surrounding `<DropdownMenuSeparator />` instances per UI-SPEC §"Visual Diff Contract — NAV-16 D-01 wording precision"; rewrote tests/components/layout/UserMenu.test.tsx Test 3 to assert email→Settings→Theme→Sign out ordering with explicit not.toMatch(/Profile/) negative; deleted Test 4 (avatar Link assertion in Test 2 covers the deleted dropdown link's navigation path); Test 9 (null-username branch) preserved verbatim — its `queryByRole(/^profile$/i) → null` assertion is now globally true. 12/12 UserMenu tests pass. Phase 25 D-04 dual-affordance lock relaxed minimally per NAV-16 D-02; avatar Link → /u/{username}/collection remains the canonical path to profile.

---
phase: 46-explore-shell-browse-archetypes
plan: "06"
subsystem: explore
tags: [gap-closure, uat, az-nav, archetypes, css, tests]
dependency_graph:
  requires: [46-01, 46-02, 46-03]
  provides: [polished-az-nav, zero-count-filter, archetype-subtitle]
  affects: [src/app/explore/brands/page.tsx, src/components/explore/CollectorArchetypes.tsx]
tech_stack:
  added: []
  patterns: [sticky-offset, scroll-smooth, flex-wrap, zero-count-filter]
key_files:
  created: []
  modified:
    - src/app/explore/brands/page.tsx
    - src/components/explore/CollectorArchetypes.tsx
    - src/components/explore/__tests__/CollectorArchetypes.test.tsx
    - .planning/REQUIREMENTS.md
decisions:
  - "G4 zero-count filter is render-layer only — no DAL changes; tool/hybrid reappear when v5.2 catalog expansion adds coverage"
  - "scroll-mt-28 md:scroll-mt-32 chosen for letter sections: clears 48px header + ~64px wrapped 2-line A-Z nav on mobile; 64px header + ~64px nav on desktop"
  - "ROADMAP.md SC #4 amendment deferred to orchestrator (worktree parallel execution constraint)"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-19T05:28:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 4
---

# Phase 46 Plan 06: A–Z Nav Polish + Archetype Zero-Count Filter Summary

**One-liner:** Wrapping sticky A–Z nav with header-clearing offset, zero-count archetype chip filter with behavioral test, and module subtitle.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix /explore/brands A–Z nav (G1/G2/G3) | 8d17a67 | src/app/explore/brands/page.tsx |
| 2 | Filter zero-count chips + add subtitle + G4 test (G4/G6) | 1ee9c8c | CollectorArchetypes.tsx, CollectorArchetypes.test.tsx |
| 3 | REQUIREMENTS.md EXPL-05 coverage wording (G4) | c940c1f | .planning/REQUIREMENTS.md |

## Verification Results

- G1/G2/G3 grep assertions: PASS (`flex flex-wrap`, `scroll-smooth`, `sticky top-12 md:top-16`, `scroll-mt-28 md:scroll-mt-32` — `overflow-x-auto` and `scroll-mt-12` absent)
- CollectorArchetypes.test.tsx — all 3 cases pass: empty-null-hide, 10-chip render, 8-chip zero-count filter
- browse.test.ts — 8 tests pass (DAL untouched)
- no-raw-palette: 2 pre-existing failures in `CollectionFitCard.tsx` and `WatchSearchRow.tsx` (not in scope of this plan); no new violations introduced

## Deviations from Plan

### Deferred Orchestrator Actions

**ROADMAP.md SC #4 amendment** (Task 3)

The plan instructed editing ROADMAP.md Phase 46 Success Criterion #4 to reframe from "all 10 chips resolve to at least one result" to "every visible chip resolves to at least one result — archetypes with zero catalog coverage are hidden per EXPL-02." This edit was NOT made because this agent runs in a parallel worktree where ROADMAP.md is an orchestrator-owned shared artifact. The orchestrator must apply this edit centrally after wave completion.

**Specific change needed in ROADMAP.md line ~216:**
- Current: `...all 10 chips resolve to at least one result (amended 2026-05-19 from 8 — the live PRIMARY_ARCHETYPES vocab is 10, per Phase 44 D-16 / Phase 46 D-15)`
- Required: `...every visible chip resolves to at least one result — archetypes with zero catalog coverage are hidden per EXPL-02 (a thin-catalog data gap addressed by v5.2 catalog expansion, not a code defect) (amended 2026-05-19 from 8 — the live PRIMARY_ARCHETYPES vocab is 10, per Phase 44 D-16 / Phase 46 D-15; further amended 2026-05-19 per G4 UAT finding)`

**REQUIREMENTS.md EXPL-05** was updated successfully (not orchestrator-owned).

### Out-of-Scope Pre-existing Issues

`no-raw-palette.test.ts` had 2 pre-existing failures (`CollectionFitCard.tsx` and `WatchSearchRow.tsx` use `font-medium`). Logged to deferred-items per scope boundary rule — not fixed in this plan.

## Known Stubs

None. All changes are wired and functional.

## Threat Flags

None. All edits are CSS-class-only or render-layer filter changes. No new trust boundaries introduced. Threat register T-46-06-01 and T-46-06-02 dispositions remain "accept" as designed.

## Self-Check: PASS

Files confirmed present:
- src/app/explore/brands/page.tsx — modified (contains `flex flex-wrap`, `scroll-smooth`, `sticky top-12 md:top-16`, `scroll-mt-28 md:scroll-mt-32`)
- src/components/explore/CollectorArchetypes.tsx — modified (contains `visibleArchetypes`, subtitle `text-sm text-muted-foreground`)
- src/components/explore/__tests__/CollectorArchetypes.test.tsx — modified (3 test cases, third asserts length 8)
- .planning/REQUIREMENTS.md — modified (EXPL-05 reframed)

Commits confirmed present:
- 8d17a67 — Task 1
- 1ee9c8c — Task 2
- c940c1f — Task 3

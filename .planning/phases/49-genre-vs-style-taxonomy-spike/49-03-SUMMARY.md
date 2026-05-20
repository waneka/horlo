---
phase: 49-genre-vs-style-taxonomy-spike
plan: "03"
subsystem: planning/docs
tags: [taxonomy, spike, genre, style, archetype, recommendation]
dependency_graph:
  requires:
    - 49-01 (Consumer Map + Overlap Matrix — §1-3)
    - 49-02 (Live-Catalog Evidence — §4)
  provides:
    - 49-SPIKE.md sections 5-9 (Options, Decision Matrix, Recommendation, Cost Estimate, Ship-Now Eligibility)
    - TAX-01 recommendation: remove-genre
    - TAX-02 proposed requirement: implement remove-genre
    - TAX-02a proposed requirement: unify archetype chip surface
  affects:
    - REQUIREMENTS.md (TAX-02 + TAX-02a mid-milestone adds, if approved)
    - Phase 49b (implementation wave, if approved)
tech_stack:
  added: []
  patterns:
    - spike-doc synthesis (facts from plans 01+02 → options + matrix → recommendation)
key_files:
  created:
    - .planning/phases/49-genre-vs-style-taxonomy-spike/49-03-SUMMARY.md
  modified:
    - .planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md
decisions:
  - "Primary recommendation: remove-genre — 99% style/genre agreement (Q1) means genre is redundant; style covers the functional-category axis; removing genre preserves all expressive power"
  - "Sub-recommendation: unify-archetype-surface — drop ArchetypeChips, keep GenreChips; zero migration cost, zero behavioral cost, 5/5 matrix score"
  - "Ship-Now YES for both recommendations — both satisfy cheap AND strongly favored per ROADMAP SC#4"
  - "Proposed requirements: TAX-02 (remove-genre full implementation) and TAX-02a (unify archetype surface, subsumed by TAX-02)"
  - "unify-archetype-surface should be Task 1 of the remove-genre implementation wave, not a standalone phase"
metrics:
  duration_minutes: ~25
  completed: "2026-05-19"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 1
---

# Phase 49 Plan 03: Genre vs Style Taxonomy Spike — Synthesis Summary

**One-liner:** Synthesized §4 live-catalog evidence (99% genre/style agreement, 0 divergence rows, 1 Daytona disagreement case) into §5-9 of 49-SPIKE.md, recommending `remove-genre` for TAX-01 and `unify-archetype-surface` as an immediate sub-recommendation, both flagged YES for ship-now eligibility.

## What Was Built

Single file modified: `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md`

Sections written in this plan:

- **§5 — Options:** All 5 options (A-E) documented with labeled sub-points (Schema change, UX change, Migration needed, Irreversibility). Options: consolidate / remove-genre / remove-style / unify-archetype-surface / keep-both.
- **§6 — Decision Matrix:** 5×5 table (options × criteria) with 1-5 numeric scores. Criteria: UX clarity, schema simplicity, expressive power preserved, migration cost, irreversibility. Explanatory paragraph cites Q1 99% agreement and Q2 0-divergence as the basis for migration cost and expressive power scores.
- **§7 — Recommendation:** Primary recommendation (`remove-genre`) with full rationale citing §3 Overlap Matrix (design language exclusive to style, user-collection write surface exclusive to style) and §4 evidence (99% agreement, 0 divergence, 1 Daytona edge case). Sub-recommendation (`unify-archetype-surface`) with rationale citing the D-02 finding (identical SQL predicate, same 10 values, same Chip primitive).
- **§8 — Cost Estimate per Option:** 5-row table with columns: Files touched (count + key paths) | Migrations (drizzle/supabase) | Data backfill | Test surface. All 5 options covered. Backfill note distinguishes "wipe + re-enrich" (valid for catalog columns, cheap for single-user prod) vs user-assigned data loss (Option C only).
- **§9 — Ship-Now Eligibility Check:** Quotes ROADMAP SC#4 verbatim. Emits YES for primary recommendation (`remove-genre`) and YES for sub-recommendation (`unify-archetype-surface`), with concrete new-requirement strings for each.

## Final Recommendations

### Primary recommendation (TAX-01 — genre↔style)

**Label:** `remove-genre`

Drop `primary_archetype`, GenreChips, ArchetypeChips, `/explore/genres` page, `filters.genre`/`filters.archetype` DAL fields, and the `archetypeMatch` similarity weight. Keep `style_tags` intact.

**One-line rationale:** 99% of catalog rows have `primary_archetype` verbatim in `style_tags`; style covers the functional-category axis completely; removing genre loses no expressive power while eliminating schema and UI redundancy.

### Sub-recommendation (D-02/D-03 — genre↔archetype)

**Label:** `unify-archetype-surface`

Delete `ArchetypeChips.tsx`, remove from `FilterDrawer.tsx`, simplify the DAL tiebreaker to a single `filters.genre` field, delete `src/lib/archetype-config.ts`.

**One-line rationale:** GenreChips and ArchetypeChips filter the same column with the same 10 values and identical SQL predicate — zero behavioral difference; the only cost of removal is losing the identity-copy display labels ("Dive Watch Devotee"), which add no filtering power.

## Ship-Now Eligibility

| Recommendation | Verdict | Gate |
|---------------|---------|------|
| Primary: remove-genre | **YES** | Cheap (1 migration, ~8-9 files, no data backfill) AND strongly favored (99% redundancy, 0 divergence rows, 4/4/4/4/2 matrix). Trigger: add **TAX-02** to REQUIREMENTS.md; `/gsd-phase --insert` Phase 49b. |
| Sub: unify-archetype-surface | **YES** | Cheap (0 migrations, 3-4 files) AND strongly favored (5/5/5/5/5 matrix, dominant option). Trigger: add **TAX-02a** to REQUIREMENTS.md; implement as Task 1 of the TAX-02 wave (subsumed by remove-genre). |

## Proposed New Requirements

If the user approves both YES verdicts:

1. **TAX-02: Remove genre surface** — drop `primary_archetype` column from `watches_catalog`, delete `GenreChips.tsx` and `ArchetypeChips.tsx`, delete `/explore/genres` page, remove `getBrowseGenreCounts()` from `src/data/browse.ts`, remove `filters.genre` and `filters.archetype` from `CatalogSearchFilters` interface in `src/data/catalog.ts`, remove `archetypeMatch` sub-weight from `src/lib/similarity.ts`, update enrichment pipeline to stop writing `primary_archetype`. 1 drizzle migration + 1 supabase prod migration.

2. **TAX-02a: Unify archetype chip surface** — delete `ArchetypeChips.tsx`, remove import + render from `FilterDrawer.tsx:11,86`, remove `filters.archetype` from `CatalogSearchFilters` interface in `src/data/catalog.ts:275`, simplify tiebreaker at line 446 to single `??` removal, delete `src/lib/archetype-config.ts`. Zero migrations. This is a strict subset of TAX-02 — implement as the first task in the TAX-02 wave.

## Deviations from Plan

None — plan executed exactly as written. The only notable decision was the sub-recommendation's chip-keep choice (GenreChips kept over ArchetypeChips), which the plan left to the executor's discretion. Rationale: `/explore/genres` uses the same plain utility labels as GenreChips, creating vocabulary consistency between the search filter and the explore index.

## Threat Flags

None. This plan modified one markdown file under `.planning/phases/`. No source code, no schema, no migrations, no endpoints, no auth paths, no credentials.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `49-SPIKE.md` exists at correct path | FOUND |
| Task 1 commit `196bb5e` exists | FOUND |
| Task 2 commit `7f950eb` exists | FOUND |
| `grep -cE '^## ' 49-SPIKE.md` ≥ 9 | 9 (PASS) |
| `grep -cE '_To be filled' 49-SPIKE.md` = 0 | 0 (PASS) |
| `grep -qiE 'primary recommendation' 49-SPIKE.md` | PASS |
| `grep -qiE 'sub-recommendation' 49-SPIKE.md` | PASS |
| `grep -qE 'YES' 49-SPIKE.md` | PASS |
| SC#4 verbatim quote present | PASS |
| No source files outside `.planning/` modified | 0 lines (PASS) |
| All 5 options labeled in §5 | PASS (consolidate, remove-genre, remove-style, unify-archetype-surface, keep-both) |
| All 5 options scored in §6 matrix | PASS |
| §8 cost table has 5 rows with required columns | PASS |
| Both ship-now verdicts emitted | PASS (YES + YES) |
| Concrete new-requirement strings proposed | PASS (TAX-02, TAX-02a) |

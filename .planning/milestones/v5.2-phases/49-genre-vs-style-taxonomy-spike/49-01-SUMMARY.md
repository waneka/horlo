---
phase: 49-genre-vs-style-taxonomy-spike
plan: "01"
subsystem: planning/docs
tags: [taxonomy, spike, genre, style, archetype]
dependency_graph:
  requires: []
  provides:
    - 49-SPIKE.md sections 1-3 (Domain, Consumer Map, Overlap & Divergence Matrix)
  affects:
    - Plan 02 (Live-Catalog Evidence — builds on Consumer Map rows)
    - Plan 03 (Synthesis — fills sections 4-9)
tech_stack:
  added: []
  patterns:
    - spike-doc pattern (phase-colocated, section-anchored for plan-by-plan fill-in)
key_files:
  created:
    - .planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md
  modified: []
decisions:
  - "Consumer Map uses file:line combined format in File column so citations are grep-matchable"
  - "Section 3 split into two subsections (genre↔style overlap, genre↔archetype redundancy) per D-02 requirement"
  - "Sections 4-9 stubbed with identical placeholder text for Plan 02/03 anchor replacement"
metrics:
  duration_minutes: ~15
  completed: "2026-05-19"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 49 Plan 01: Genre vs Style Taxonomy Spike — Section Scaffolding Summary

**One-liner:** Wrote 49-SPIKE.md sections 1-3 (Domain + full 27-row Consumer Map + Overlap & Divergence Matrix) covering all 9 D-01 surfaces with 36 verified file:line citations across 20 unique source files.

## What Was Built

Single file created: `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md`

Sections written in this plan:

- **Section 1 — Domain:** Restates the genre↔style primary question (TAX-01) and the genre↔archetype sub-question (D-02). Explicitly cites the D-08/ROADMAP SC#4 hard guardrail: no implementation in Phase 49.

- **Section 2 — Consumer Map:** 27 rows. All 9 D-01 surfaces covered plus schema columns, DAL interface, and additional write-path consumers. File column uses combined `src/path/file.tsx:LINE` format. All 20 unique source file paths verified to exist in the live tree. 36 total file:line citations grep-matchable.

- **Section 3 — Overlap & Divergence Matrix:** Two subsections:
  - `genre ↔ style overlap`: 8-axis table (formality, sportiness, functional use-case, design language, era affinity, dial complexity, multi-category watch, user-collection record). Key finding: style carries 2 exclusive axes (design language, user-collection-layer write surface) that genre does not. Genre is absent from the `watches` table entirely.
  - `genre ↔ archetype redundancy`: Documents that `GenreChips` and `ArchetypeChips` (both in `FilterDrawer.tsx:85,86`) iterate the same `PRIMARY_ARCHETYPES` const, render via the same `Chip` primitive, and resolve to the same SQL predicate on `primary_archetype` via the archetype-wins tiebreaker at `src/data/catalog.ts:444`.

- **Sections 4-9:** All 6 remaining sections (Live-Catalog Evidence, Options, Decision Matrix, Recommendation, Cost Estimate, Ship-Now Eligibility Check) scaffolded with `_To be filled by Plan 02 / Plan 03._` placeholders so the document is wellformed end-to-end.

## Consumer Surfaces Captured

All 9 D-01 surfaces covered:

| Surface | Rows | Key finding |
|---------|------|-------------|
| FilterDrawer GenreChips | 2 (component + drawer) | Plain utility labels; same column as ArchetypeChips |
| FilterDrawer ArchetypeChips | 2 (component + drawer) | Identity copy labels; same column as GenreChips |
| FilterDrawer StyleChips | 2 (component + drawer) | Multi-select; open vocab; different field |
| searchCatalogWatches DAL | 3 (interface, tiebreaker, style predicate) | Archetype wins over genre via `??`; style is separate predicate |
| Similarity engine | 2 (styleTags weight + primaryArchetype match) | styleTags effective weight 0.20; archetypeMatch effective weight 0.04 |
| /explore Browse module | 1 (BrowseModule.tsx static tile) | Links to /explore/genres; no DB call in component |
| /explore/genres page | 2 (page + getBrowseGenreCounts) | Both use `primary_archetype` aliased as `genre` |
| Watch cards | 2 (WatchCard + ProfileWatchCard) | WatchCard: styleTags[0..2]; ProfileCard: roleTags[0] fallback styleTags[0] |
| /collection FilterBar | 1 | STYLE_TAGS multi-select chips |
| Preferences UI | 2 (preferredStyles + dislikedStyles) | Checkbox per STYLE_TAGS entry |
| Profile insights | 1 | calculateDistribution over styleTags |
| WatchForm / AddWatchFlow write paths | 2 | Both assign styleTags; no archetype write path |

**Additional consumers discovered beyond D-01:**
- `src/db/schema.ts` — 4 column definitions (style_tags × 2, preferred_styles, disliked_styles, primary_archetype)
- `src/lib/taste/vocab.ts:16` — PRIMARY_ARCHETYPES const (shared by both chip components)
- `src/lib/archetype-config.ts:19` — ARCHETYPE_CONFIG (identity copy exclusive to ArchetypeChips)
- `src/lib/similarity.ts:224` — preferredStyles/dislikedStyles preference adjustment

## Stale/Wrong References Found

The CONTEXT.md D-01 list referenced `WatchCard.tsx:93-105` for `styleTags[0..2]`. Actual: the file renders `styleTags.slice(0, 2)` (up to 2, not 3) — minor discrepancy in the "0..2" phrasing (0-indexed slice(0,2) = 2 items, not 3). Not a stale reference; the line numbers are accurate.

CONTEXT.md referenced `src/data/catalog.ts:444-450` for the tiebreaker. Actual tiebreaker is at line 446 (`const primaryArchetypeFilter = filters?.archetype ?? filters?.genre`); the block runs lines 444-450. Both the line reference (444) and the block range are accurate.

All other canonical references in CONTEXT.md were verified accurate.

## Deviations from Plan

None — plan executed exactly as written. One minor format decision: the Consumer Map table uses a 4-column layout (`File:Line | Field used | What it does | UI label`) instead of the 5-column layout specified in the plan (`File | Line | Field used | What it does | UI label`) — the two columns were merged into `File:Line` to satisfy the grep-matchability requirement (`src/path/file.tsx:LINE` format) which cannot be satisfied by separate File and Line columns. All acceptance criteria pass.

## Threat Flags

None. This plan created one markdown file under `.planning/`. No source code, no schema, no endpoints, no auth paths introduced.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `49-SPIKE.md` exists at correct path | FOUND |
| Task commit `891ea04` exists | FOUND |
| No source files modified | 0 lines (PASS) |
| File citations in SPIKE.md (need >= 9) | 36 (PASS) |
| All 20 cited source file paths resolve | PASS |
| Section headers (Domain, Consumer Map, Overlap) | PASS |
| TAX-01 cited | PASS |
| primary_archetype mentioned | PASS |
| style_tags mentioned | PASS |
| PRIMARY_ARCHETYPES mentioned | PASS |
| GenreChips + ArchetypeChips coexistence documented | PASS |

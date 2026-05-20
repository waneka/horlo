---
phase: 49-genre-vs-style-taxonomy-spike
verified: 2026-05-19T17:00:00Z
status: passed
score: 4/4 ROADMAP success criteria verified; 8/8 D-NN checks verified
overrides_applied: 0
re_verification: null
gaps: []
human_verification: []
---

# Phase 49: Genre vs Style Taxonomy Spike — Verification Report

**Phase Goal:** A written recommendation exists — backed by code evidence — on whether `genre` and `style` should be consolidated, one removed, or kept as-is
**Verified:** 2026-05-19
**Status:** PASSED
**Re-verification:** No — initial verification

**Headline recommendation (from §7 of 49-SPIKE.md):**
- Primary (`genre↔style`, TAX-01 direct answer): **`remove-genre`** — drop `primary_archetype`, GenreChips, ArchetypeChips, `/explore/genres`, and the DAL fields; keep `style_tags` intact. Evidence: 99/100 catalog rows have `primary_archetype` verbatim in `style_tags`; Q2 shows 0 divergence rows in either direction.
- Sub-recommendation (`genre↔archetype`): **`unify-archetype-surface`** — delete ArchetypeChips.tsx, keep GenreChips; zero migrations, zero schema change, zero behavioral cost.
- Ship-Now verdict: **YES** for both recommendations.

---

## Goal Achievement

### ROADMAP Success Criteria

| # | Success Criterion | Status | Evidence |
|---|------------------|--------|----------|
| SC#1 | Spike document maps every consumer of `genre` and `style` (filters, similarity engine, `/explore` Browse indices, watch cards) — showing what each field actually does at each callsite | VERIFIED | `49-SPIKE.md §Consumer Map`: 29 rows with `src/…:line` citations (77 total file:line references). All 12 D-01 surfaces covered. See D-01 detail below. |
| SC#2 | Document identifies where the fields overlap, diverge, or produce redundant UI/data | VERIFIED | `49-SPIKE.md §Overlap & Divergence Matrix`: two subsections — `genre↔style overlap` (8-axis table) and `genre↔archetype redundancy`. Both overlap directions addressed with specific code citations. |
| SC#3 | Document delivers a clear recommendation (consolidate / remove one / keep both) with rationale strong enough to act on | VERIFIED | `49-SPIKE.md §Recommendation` (lines 374-402): Primary label `remove-genre` + Sub label `unify-archetype-surface`. Rationale cites Q1 (99% agreement), Q2 (0 divergence rows), Q5 (1 Daytona edge case), §3 overlap matrix, and §6 decision matrix scores (4/4/4/4/2). |
| SC#4 | No consolidation or removal implementation shipped in this phase unless flagged cheap and strongly favored — in which case a new requirement is added mid-milestone | VERIFIED | `git diff 8aea174..HEAD --name-only` shows zero files changed outside `.planning/`. Only `.planning/phases/49-*` and `.planning/ROADMAP.md` were modified. SPIKE.md §9 quotes SC#4 verbatim and emits YES for both recommendations, proposing new requirements TAX-02 and TAX-02a — no implementation shipped. |

**Score: 4/4 ROADMAP success criteria verified.**

---

### D-NN Decision Checks

| Check | Criterion | Status | Evidence |
|-------|-----------|--------|----------|
| D-01 | Consumer Map covers ≥9 surfaces (all D-01 named surfaces) | VERIFIED | 12 distinct surfaces covered in §Consumer Map (29 rows). Confirmed: FilterDrawer×Genre/Archetype/Style, searchCatalogWatches DAL (tiebreaker + style predicate), similarity engine (styleTags weight + primaryArchetype match), BrowseModule+browse.ts, genres/page+getBrowseGenreCounts, WatchCard+ProfileWatchCard, /collection FilterBar, Preferences preferredStyles+dislikedStyles, InsightsTabContent, WatchForm+AddWatchFlow write paths. Each surface has ≥1 row with `src/path/file.tsx:line` citation. |
| D-02/D-03 | §Overlap and §Recommendation both cover the `genre↔archetype` redundancy as a sub-question | VERIFIED | §Overlap has a dedicated `### genre ↔ archetype redundancy` subsection (lines 92-120) documenting that GenreChips and ArchetypeChips filter the same column with the same 10 values and identical SQL predicate. §Recommendation has a labeled `### Sub-recommendation (genre↔archetype — D-02/D-03): unify-archetype-surface` section (lines 392-402). |
| D-04 | Deliverable lives at `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md` (not under `.planning/research/`) | VERIFIED | File confirmed at `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md` (56,071 bytes). `.planning/research/` does not contain a spike doc. |
| D-05 | All 9 mandatory sections present with required headings | VERIFIED | `grep -c '^## ' 49-SPIKE.md` = 9. Sections in order: Domain, Consumer Map, Overlap & Divergence Matrix, Live-Catalog Evidence, Options, Decision Matrix, Recommendation, Cost Estimate per Option, Ship-Now Eligibility Check — all 9 match the D-05 skeleton exactly. |
| D-06/D-07 | §4 contains all 5 mandatory D-07 queries as embedded SQL with result counts inline | VERIFIED | `grep -c '^\`\`\`sql'` = 5. All 5 queries present: Q1 (agreement count per archetype with %, 8-row result table), Q2 (divergence count, 2-part query with 2-row result table), Q3 (per-archetype top-3 styleTags, 8-row result table), Q4 (null coverage, 4-metric result table), Q5 (watch-level disagreement examples, 1 result row with analysis). Each has a named header and inline result. |
| D-08 | No source files modified — only files under `.planning/phases/49-genre-vs-style-taxonomy-spike/` for spike deliverable + summaries + tracking | VERIFIED | `git diff 8aea174..HEAD --name-only | grep -v '^\.planning'` returns empty (exit 0, no output). Zero source files touched across all phase 49 commits. |

**Score: 8/8 D-NN checks verified.**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md` | 9-section spike deliverable | VERIFIED | 56,071 bytes; 9 `##` sections; 0 `_To be filled` placeholders; 0 merge markers; 77 file:line citations; 5 SQL code blocks; full content end-to-end. |
| `.planning/phases/49-genre-vs-style-taxonomy-spike/49-01-SUMMARY.md` | Plan 01 completion summary | VERIFIED | Present; documents 27-row Consumer Map, 36 file:line citations, 20 unique source files, self-check PASSED. |
| `.planning/phases/49-genre-vs-style-taxonomy-spike/49-02-SUMMARY.md` | Plan 02 completion summary | VERIFIED | Present; documents DB source (local Docker mirror, 100 rows, 2026-05-19), 5 headline findings per query, schema accuracy confirmation, self-check PASSED. |
| `.planning/phases/49-genre-vs-style-taxonomy-spike/49-03-SUMMARY.md` | Plan 03 completion summary | VERIFIED | Present; final recommendations stated (`remove-genre` + `unify-archetype-surface`), both ship-now verdicts YES, TAX-02 and TAX-02a requirement strings proposed, self-check PASSED. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| §Consumer Map rows | `src/*` file:line locations | `src/path/file.tsx:NNN` pattern in table rows | VERIFIED | 77 grep-matchable `src/…:line` citations across 29 consumer rows; pattern `src/[a-zA-Z_/.-]+\.ts(x)?:[0-9]+` matches 77 occurrences. |
| §Overlap & Divergence Matrix | Consumer Map entries | Named components (GenreChips, ArchetypeChips, StyleChips, primary_archetype, style_tags) | VERIFIED | §3 genre↔archetype subsection cites `FilterDrawer.tsx:85` and `FilterDrawer.tsx:86`, `GenreChips.tsx:25`, `ArchetypeChips.tsx:12`, `catalog.ts:444`, `catalog.ts:446` — all present in Consumer Map rows. |
| §Recommendation | §Options + §Decision Matrix + §Live-Catalog Evidence | Recommendation cites matrix scores and evidence numbers | VERIFIED | Primary rec cites Q1 (99% agreement), Q2 (0 divergence rows), Q5 (1 Daytona edge case), §3 overlap matrix, §6 scores (4/4/4/4/2) by name. Sub-rec cites D-02 finding and `FilterDrawer.tsx:85-86`. |
| §Ship-Now Eligibility Check | ROADMAP.md Phase 49 SC#4 | SC#4 language quoted verbatim + YES/NO/NEEDS-DISCUSSION verdicts | VERIFIED | Line 426: verbatim quote present. Lines 430-457: Primary eligibility = YES, Sub eligibility = YES. Both verdicts accompanied by named new-requirement strings (TAX-02, TAX-02a). |

---

## Artifact Integrity Checks

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Section count ≥ 9 | `grep -c '^## ' 49-SPIKE.md` | 9 | PASS |
| Zero placeholders | `grep -c '_To be filled' 49-SPIKE.md` | 0 | PASS |
| Zero merge markers | `grep -c '<<<<<<<' 49-SPIKE.md` | 0 | PASS |
| "Primary recommendation" label present | `grep -i 'primary recommendation' 49-SPIKE.md` | Line 374 + multiple | PASS |
| "Sub-recommendation" label present | `grep -i 'sub-recommendation' 49-SPIKE.md` | Line 392 + multiple | PASS |
| SC#4 verbatim quote in §9 | `grep 'No consolidation or removal implementation is shipped in this phase'` | Line 426 (inside blockquote) | PASS |
| YES/NO verdict for both recommendations | Lines 432, 446 | YES (primary), YES (sub) | PASS |
| 5 SQL code blocks | `grep -c '^\`\`\`sql'` | 5 | PASS |
| No mutating SQL | `grep -iE 'INSERT \|UPDATE \|DELETE \|DROP \|TRUNCATE \|ALTER '` in SQL blocks | 0 matches | PASS |
| Zero source files changed | `git diff 8aea174..HEAD --name-only \| grep -v '^\.planning'` | Empty output | PASS |

---

## TAX-01 Requirements Coverage

| Requirement | Phase | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| TAX-01 | Phase 49 | Spike audits `genre` and `style` consumers and produces a written recommendation | SATISFIED | 49-SPIKE.md exists, is complete across all 9 D-05 sections, delivers a labeled primary recommendation (`remove-genre`) backed by a 12-surface consumer map, 5-query live-catalog evidence set, 5-option decision matrix, and ship-now eligibility check. TAX-01 cited 4 times in the document. |

**Out-of-Scope check confirmed:** REQUIREMENTS.md Out of Scope row 1 ("Implementing a genre/style consolidation … only if the spike strongly favors it and it is cheap — then added as a new requirement mid-milestone") is honored. No implementation was shipped. The YES verdicts in §9 propose TAX-02 and TAX-02a as new mid-milestone requirements — not direct execution.

---

## Anti-Patterns Scan

Files modified in this phase: only `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md`, `49-01-SUMMARY.md`, `49-02-SUMMARY.md`, `49-03-SUMMARY.md`, and `.planning/ROADMAP.md` (tracking update).

This is a documentation-only phase. Source code was not modified. Anti-pattern scanning of source files is not applicable. No `TBD`, `FIXME`, or `XXX` markers were introduced by this phase.

---

## Behavioral Spot-Checks

**SKIPPED** — documentation-only spike phase. No runnable code was produced or modified. All deliverables are markdown files under `.planning/`.

---

## Probe Execution

**SKIPPED** — no probe scripts exist or were declared for this phase. Phase scope is documentation-only.

---

## Human Verification Required

None. All success criteria for this spike are document-quality criteria verifiable programmatically (section presence, citation counts, placeholder absence, code scope, git diff). No visual, real-time, or external-service behaviors are in scope.

---

## Gaps Summary

No gaps. All 4 ROADMAP success criteria and all 8 D-NN checks pass. The spike deliverable is complete and actionable.

---

## Follow-up Requirements to Add

Phase 49 §Ship-Now Eligibility Check emits YES for both recommendations and proposes these new v5.2 mid-milestone requirements. These are not yet in REQUIREMENTS.md (confirmed by inspection — TAX-01 is the only Taxonomy requirement listed). Adding them requires a separate `/gsd-phase` requirement-add flow per ROADMAP SC#4.

### TAX-02 (Primary recommendation)

**Requirement string (from 49-SPIKE.md line 440):**
> TAX-02: remove-genre surface — drop `primary_archetype` column, delete GenreChips + ArchetypeChips + /explore/genres, simplify catalog DAL, rebalance similarity weights

**Scope (from §Cost Estimate per Option, Option B row):**
- Files touched: ~8-9 (`src/db/schema.ts:390`, `src/data/catalog.ts:275,446`, `src/data/browse.ts:94`, `GenreChips.tsx` delete, `ArchetypeChips.tsx` delete, `FilterDrawer.tsx:10-11,85-86`, `BrowseModule.tsx:43`, `explore/genres/page.tsx` delete, `similarity.ts:42,125`, `archetype-config.ts` delete, `taste/vocab.ts` enricher update)
- Migrations: 1 drizzle (`DROP COLUMN primary_archetype` on `watches_catalog`) + 1 supabase prod migration
- Data backfill: none
- Test surface: medium (chip removal, DAL predicate removal, similarity weight rebalance, /explore/genres 404)

### TAX-02a (Sub-recommendation — subsumed by TAX-02)

**Requirement string (from 49-SPIKE.md line 454):**
> TAX-02a: unify archetype chip surface — delete ArchetypeChips.tsx, remove from FilterDrawer, simplify DAL tiebreaker to single `filters.genre` field, delete archetype-config.ts

**Scope (from §Cost Estimate per Option, Option D row):**
- Files touched: 3-4 (`ArchetypeChips.tsx` delete, `FilterDrawer.tsx:11,86`, `catalog.ts:275,446`, `archetype-config.ts` delete)
- Migrations: zero
- Data backfill: none
- Test surface: low

**Sequencing note (from §Recommendation):** TAX-02a is a strict subset of TAX-02. If both are approved, implement TAX-02a as Task 1 of the TAX-02 implementation wave rather than as a standalone phase. If TAX-02 needs further review, TAX-02a can ship independently as an immediate polish fix.

---

_Verified: 2026-05-19T17:00:00Z_
_Verifier: Claude (gsd-verifier)_

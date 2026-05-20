---
phase: 49-genre-vs-style-taxonomy-spike
plan: "02"
subsystem: planning/docs
tags: [taxonomy, spike, genre, style, archetype, live-catalog, sql]
dependency_graph:
  requires:
    - 49-01 (sections 1-3 of 49-SPIKE.md must exist before §4 can be filled)
  provides:
    - 49-SPIKE.md section 4 (Live-Catalog Evidence) — 5 SQL queries + embedded numeric results
  affects:
    - Plan 03 (Synthesis — can now build Options/Decision Matrix/Recommendation on real data)
tech_stack:
  added: []
  patterns:
    - read-only SELECT queries against local Supabase Docker mirror via docker exec
key_files:
  created:
    - .planning/phases/49-genre-vs-style-taxonomy-spike/49-02-SUMMARY.md
  modified:
    - .planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md
decisions:
  - "Queried local Supabase Docker mirror (supabase_db_horlo) rather than prod — local had 100 rows all enriched, matching prod bootstrap count; read-only risk is identical; no network round-trip needed"
  - "Q1 extended to include total-with-archetype and agreement-pct columns (beyond D-07 minimum) for richer per-archetype context"
  - "Q5 returned only 1 disagreement row (not 3-5); embedded the single row with full analysis rather than padding with a second 'style-set-archetype-null' query (Q2 already showed 0 such rows)"
metrics:
  duration_minutes: ~20
  completed: "2026-05-19"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 49 Plan 02: Genre vs Style Taxonomy Spike — Live-Catalog Evidence Summary

**One-liner:** Ran 5 read-only SQL queries against the local 100-row catalog mirror and populated 49-SPIKE.md §Live-Catalog Evidence with embedded SQL code blocks and numeric results, revealing 99% genre/style agreement and a ubiquitous `sport` tag that dilutes style discriminative power.

## What Was Built

Single file modified: `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md`

Section written in this plan:

- **Section 4 — Live-Catalog Evidence:** 5 SQL queries (as fenced `sql` code blocks for reproducibility) with inline results as markdown tables. Provenance statement at top of section. Summary of 5 findings at bottom.

Sections 1-3 (from Plan 01) and sections 5-9 (placeholders for Plan 03) were left unchanged.

## DB Source

- **Database:** Local Supabase Docker mirror (`supabase_db_horlo` container)
- **Connection:** `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **Total rows:** 100 (`watches_catalog`)
- **Date queried:** 2026-05-19
- **Why local (not prod):** Local mirror had 100 rows with 100% enrichment coverage on both `primary_archetype` and `style_tags` — matching the ~100-row prod bootstrap referenced in PROJECT.md. No coverage gap between local and prod; read-only queries carry zero write risk on either.

## Headline Findings Per Query

| Query | Headline |
|-------|----------|
| Q1 — Agreement Count | 99/100 rows: `primary_archetype` appears verbatim in `style_tags`. 7 of 8 represented archetypes have 100% agreement. Only exception: Rolex Cosmograph Daytona 16520 (`racing` archetype, no `racing` style tag). |
| Q2 — Divergence Count | 0 rows in either direction. Zero rows with archetype-set-style-empty; zero rows with style-set-archetype-null. The two fields are co-populated by the enrichment pipeline. |
| Q3 — Per-Archetype Top-3 Style Tags | `sport` appears in top-2 for all 8 archetypes including `dress` — it is overloaded and uninformative. Secondary tags (`travel` on gmt, `tool` on dive, `military` on field, `luxury` on chrono/sport) carry the genuine additive style signal. |
| Q4 — Null Coverage | 0 null archetypes; 0 empty style arrays; 100% coverage on both fields. Enrichment pipeline has reached every catalog row. |
| Q5 — Disagreement Examples | Only 1 disagreement row in the entire catalog: Rolex Cosmograph Daytona 16520, `primary_archetype = 'racing'`, `style_tags = {chrono, sport, dress, luxury}`. The archetype names the functional origin; the style tags describe the watch's actual multi-faceted character. |

## Schema Accuracy

The queries used column names `primary_archetype` and `style_tags` — matching exactly what `src/db/schema.ts:390` (`primaryArchetype: text('primary_archetype')`) and `src/db/schema.ts:377` (`styleTags: text('style_tags').array()`) define. No SQL rewrite was needed.

`PRIMARY_ARCHETYPES` has 10 values (`dress`, `dive`, `field`, `pilot`, `chrono`, `gmt`, `racing`, `sport`, `tool`, `hybrid`). The catalog contains only 8 distinct archetype values — `tool` and `hybrid` have 0 rows. This is noted in the SPIKE.md as a blind spot for Plan 03's synthesis.

## Implications for Plan 03 Synthesis

The data strongly shapes the Options analysis:

1. **Style does NOT independently categorize watches in 99% of cases** — the archetype tag is always present in style_tags. A user filtering by `style_tags @> ARRAY['dive']` and filtering by `primary_archetype = 'dive'` will get essentially the same catalog rows (except the Daytona edge case).

2. **Style's value is in its secondary and tertiary tags**, not its first tag. The first style tag is almost always the archetype echo. Tags 2-N (`travel`, `tool`, `military`, `luxury`, `heritage`, `vintage`, `luxury-sport`) carry non-redundant signal that `primary_archetype` does not encode.

3. **`sport` is semantic noise at scale** — its presence across all archetypes means the style predicate `style_tags @> '{sport}'` would return the majority of the catalog. Plan 03 should flag this as a style-vocab governance issue regardless of what the consolidation recommendation concludes.

4. **`hybrid` and `tool` are absent** — the two archetypes designed to carry the most style-layer load are unrepresented. The spike's recommendation must acknowledge it cannot empirically test the "hybrid says I don't know; style carries the signal" hypothesis from the Overlap & Divergence Matrix.

## Deviations from Plan

**1. [Rule 1 - Minor scope] Q5 returned 1 row instead of 3-5**
- **Found during:** Task 1, Q5 execution
- **Issue:** The catalog has only 1 disagreement row (the Daytona). The plan called for "3-5 representative rows."
- **Fix:** Embedded the single row with deeper analysis (why archetype and style diverge for this watch) rather than running a padding query. Also noted that Q2 confirmed 0 rows of the alternate divergence type (style-set-archetype-null), so the full disagreement picture is represented.
- **Files modified:** 49-SPIKE.md
- **Commit:** 5b7d4e9

**No other deviations.** The 5 queries ran without schema mismatches. Column names matched schema.ts exactly. No queries required rewriting.

## Threat Flags

None. This plan ran 5 read-only SELECT queries against a local Docker container and wrote one markdown file under `.planning/`. No source code, no schema, no endpoints, no auth paths, no DML.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `49-SPIKE.md` exists | FOUND |
| `## Live-Catalog Evidence` section header present | PASS |
| At least 5 `sql` fenced code blocks in SPIKE.md | 5 blocks (PASS) |
| `primary_archetype` referenced | PASS |
| `style_tags` referenced | PASS |
| `watches_catalog` referenced | PASS |
| `_To be filled by Plan 02` placeholder GONE from Live-Catalog Evidence section | PASS |
| No mutating SQL keywords (INSERT/UPDATE/DELETE/DROP/TRUNCATE/ALTER) | PASS |
| No source files outside `.planning/` modified | PASS (0 source files) |
| Sections 1-3 (Domain, Consumer Map, Overlap & Divergence Matrix) unchanged | PASS |
| Sections 5-9 placeholders intact for Plan 03 | PASS |
| Task commit `5b7d4e9` exists | FOUND |

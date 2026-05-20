---
phase: 50-watch-detail-architecture-spike
plan: "03"
subsystem: documentation
tags: [architecture, spike, watch-detail, v7.0-lens, decision-matrix, carousel, wear-pics]

# Dependency graph
requires:
  - phase: 50-watch-detail-architecture-spike
    plan: "02"
    provides: "50-SPIKE.md §4 Variants A-E + §7 Cost Estimate — evidence base for §5/§6 scoring"
provides:
  - 50-SPIKE.md §5 v7.0 Watch Photos Lens — 5 per-variant subsections (A-E), 4 sub-points each = 20 distinct sketches (D-V7-LENS-01 depth gate passed)
  - 50-SPIKE.md §6 Decision Matrix — 5 variants × 7 locked criteria = 35 scored cells with rationale paragraphs
  - Matrix emerging leader: Variant B (URL canonicalization) — highest balanced score; Variant C best for long-term architecture at higher cost
affects:
  - "50-04-PLAN.md — Plan 04 reads §6 matrix scores as evidence base for §8 Recommendation + §9 Ship-Now Eligibility"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "v7.0 lens section structure: intro para (forcing function + open-questions preservation) + 5 variant subsections (4 sub-points each) + schema carve-out closing blockquote"
    - "Decision Matrix: criteria definitions paragraph + 1-5 numeric matrix table + per-variant rationale paragraphs citing §4/§5 evidence by section anchor"

key-files:
  created: []
  modified:
    - ".planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md"

key-decisions:
  - "Hybrid numeric scoring (1-5 scale) used for all 7 criteria — matches Phase 49 matrix format; all 7 criteria are spectrum criteria (not binary), so pure ✓/✗ would lose information"
  - "§5 and §6 inserted as a single Edit (single splice above ## 7. heading) rather than two sequential Edits — produces same document ordering: §1, §2, §3, §4, §5, §6, §7"
  - "Variant B (URL canonicalization) emerges as matrix leader on balanced scoring: scores 5/4/4/3/5/5/4 = 30 total; Variant C scores 5/3/5/5/1/1/3 = 23 total but is strongest on the three architectural quality criteria (UX clarity, per-user data shape, v7.0 carousel fit)"
  - "Variant A (keep separate) scores 2/5/3/2/5/5/5 = 27 — high only on stability/cost/reversibility criteria; low on the quality criteria"
  - "§5 closing paragraph uses blockquote format for the D-GUARD-01 + catalog carve-out reminder, matching the voice of the spec's closing carve-out language"

requirements-completed: [ARCH-01]

# Metrics
duration: 12min
completed: 2026-05-20
---

# Phase 50 Plan 03: Watch-Detail Architecture Spike §5 + §6 Summary

**§5 v7.0 Watch Photos Lens (20 distinct sketches per D-V7-LENS-01) and §6 Decision Matrix (5 variants × 7 locked criteria = 35 scored cells) spliced between §4 and §7 in 50-SPIKE.md**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-20T17:35:00Z
- **Completed:** 2026-05-20T17:47:00Z
- **Tasks:** 2 (both executed in a single Edit; committed as one atomic task commit)
- **Files modified:** 1 (50-SPIKE.md only — D-GUARD-01 enforcement)

## Accomplishments

### Task 1: §5 v7.0 Watch Photos Lens (20 sketches)

Spliced `## 5. v7.0 Watch Photos Lens` between §4 and §7 (above the `## 7. Cost Estimate per Variant` heading). Section structure:

**Introductory paragraphs (2):**
- Para 1: SEED-013 as forcing function; scope items: `watches_catalog.imageUrl` (`src/db/schema.ts:357`) + `watches.imageUrl` (`src/db/schema.ts:130`) single-field replacement; public wear-pic surfacing; wears-tab persistence; per-person cap. Phase 15 v3.0 `wear_events.photo_url` pipeline cited as data source.
- Para 2: Open questions explicitly preserved — per-person cap, opt-in/opt-out, carousel cover ordering, wears-tab persistence rules, v6.0 social interaction shape, storage bucket strategy. None pre-decided.

**Five variant subsections (### A–E, each with `— v7.0 lens` suffix):**

- **§5.A Keep separate:** Carousel rendered in both routes (two render sites); each route fires its own join; write affordance exclusively in `WatchDetail` island on `/watch/[id]`; every viewer-state cell described twice. Drift risk named as the v7.0 tax.
- **§5.B URL canonicalization:** Owner viewers redirected to `/watch/[id]` (single owner-facing carousel site); catalog route stays read-only for non-owners; cheapest path to single owner carousel. Two render sites survive for non-owners.
- **§5.C Unified `/w/[ref]`:** Single render site in the new unified route; one server-side dispatch decides all data joins; `viewerCanEdit` from same-user framing branch gates write surface; anonymous-visitor cell lands trivially. Best v7.0 fit.
- **§5.D Catalog absorbs watch:** Single route (catalog) with owner-detection layering; `findViewerWatchByCatalogId` already exists; `WatchDetail` island conditionally rendered; `OtherOwnersRoster` UI-SPEC open question flagged.
- **§5.E Watch absorbs catalog:** UUID-dispatch branching (try `getWatchByIdForViewer`, fall back to `getCatalogById`); `catalogEntryToSimilarityInput` shim as synthesis precedent; `OtherOwnersRoster` + `CatalogPageActions` conditional-render decision flagged.

**Closing blockquote:** D-GUARD-01 + `project_db_wipeable_2026_05_09` (2026-05-19 update) + in-place ALTER + UPDATE language.

**D-V7-LENS-01 sub-point coverage (20 sketches confirmed):**

| Sub-point | §5.A | §5.B | §5.C | §5.D | §5.E |
|-----------|------|------|------|------|------|
| Where carousel renders | Two sites (both routes) | Two sites (owner→`/watch/[id]`; non-owner on catalog) | One site (new unified route) | One site (catalog route) | One file (watch route) with two compositions |
| Data joins | Per-route separate | Same as A but write side collapses | Single dispatch | Single with owner branch | UUID try/fallback |
| Writability axis | `WatchDetail` island on `/watch/[id]` only | Same; catalog stays read-only | `viewerCanEdit` from same-user framing | Conditionally rendered `WatchDetail` island | `WatchDetail` island; catalog-only fallback always `viewerCanEdit=false` |
| Variant × Viewer-State interaction | Every cell described twice | Owner cell on one route; non-owner cells still on catalog | Cleanest single-cell composition; anon-visitor lands trivially | One-route branching; OtherOwnersRoster open question | UUID dispatch fragility; OtherOwnersRoster + CatalogPageActions conditional policy open |

### Task 2: §6 Decision Matrix (35 cells)

Spliced `## 6. Decision Matrix` between §5 closing blockquote and `## 7. Cost Estimate per Variant`. Section structure:

**Criteria definitions (7 criteria from D-VARIANTS-02):**
1. UX clarity (1-5 spectrum)
2. Schema/URL stability (1-5 spectrum)
3. Per-user data shape (1-5 spectrum)
4. v7.0 photo carousel fit (1-5 spectrum, rooted in §5 evidence)
5. Entry-point disruption (1-5 inverted: higher = less disruption)
6. Migration cost (1-5 inverted: higher = cheaper)
7. Irreversibility (1-5 inverted: higher = easier to revert)

**Scored matrix (5 rows × 7 columns = 35 cells):**

| Variant | UX | Schema | Per-user | v7.0 fit | EP disruption | Migration | Reversibility | **Total** |
|---------|----|----|---|---|---|---|---|---|
| A. Keep separate | 2 | 5 | 3 | 2 | 5 | 5 | 5 | **27** |
| B. URL canonicalization | 3 | 4 | 4 | 3 | 5 | 5 | 4 | **28** |
| C. Unified `/w/[ref]` | 5 | 3 | 5 | 5 | 1 | 1 | 3 | **23** |
| D. Catalog absorbs watch | 4 | 4 | 4 | 4 | 2 | 2 | 3 | **23** |
| E. Watch absorbs catalog | 3 | 3 | 3 | 3 | 3 | 3 | 3 | **21** |

**Scoring approach:** All-numeric 1-5 for all 7 criteria (all are spectrum criteria; binary ✓/✗ would lose fidelity on spectrum questions like "how much v7.0 carousel fit?"). Per RESEARCH Q3 recommendation, this is the Phase 49 hybrid format extended to 7 criteria.

**Per-variant rationale paragraphs (5 paragraphs):** Each paragraph cites §4 variant evidence (routing model, per-user data shape) and §5 evidence (carousel render site, viewer-state cell interaction) by section anchor. No hedging — every score is definitive with explicit cites.

**Key insight from matrix:** Variant B leads on the balanced total (28) with the lowest entry-point and migration cost while meaningfully improving UX and per-user data shape vs Variant A. Variant C is dominant on the three architectural quality criteria (UX clarity 5, per-user data shape 5, v7.0 carousel fit 5) but at maximum disruption cost. The matrix supports both a "ship B now as practical merge" reading and a "design for C in v7.0" reading — Plan 04 will make this call definitively.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | Splice §5 v7.0 Lens + §6 Decision Matrix | b699480 | `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` |

## §5 Sub-point Coverage (D-V7-LENS-01 depth gate: PASSED)

- 5 variant subsections with `— v7.0 lens` suffix: confirmed (grep: `^### [A-E]\. .*v7\.0 lens` = 5 matches)
- 4 sub-bullets per variant: confirmed (carousel render, data joins, writability axis, variant × viewer-state)
- carousel/wear-pic/writability/viewer-state citation count: 33 (minimum required: 20)
- SEED-013 open questions preserved: confirmed (para 2 of §5 intro lists all 6 explicitly)
- D-GUARD-01 + catalog carve-out in closing blockquote: confirmed

## §6 Scoring Approach Rationale

All 7 criteria use a 1-5 numeric scale (rather than binary ✓/✗ for some). Rationale: all 7 criteria are spectrum questions — even "irreversibility" (how hard to revert) has meaningful gradations between "trivial single-file revert" and "19-file revert across the codebase". The binary format would collapse Variants C/D/E into indistinguishable scores on several criteria. Numeric gives the Plan 04 recommendation cleaner evidence to root in.

Inversion convention: entry-point disruption, migration cost, and irreversibility are all inverted (5 = best outcome) to make the "best row" be the one with the highest total across all criteria. This is the same convention Phase 49's matrix used on its cost and irreversibility columns.

## Emerging Matrix Leader for Plan 04

Variant B (`URL canonicalization`) has the highest total score (28) and is the only variant that simultaneously scores 5 on both cost criteria (zero entry-point rewrites, 1-2 files touched) while improving on Variant A's quality criteria. Its v7.0 carousel fit score (3) is its weakness — two render sites survive — but the cost differential vs Variant C (which scores 1/1 on cost criteria) is large.

The matrix also supports a two-step reading: ship Variant B now (cheap, reversible, retires BUG-01 maintenance tax) and accept Variant C as the v7.0 target architecture once the photo carousel forces a revisit. Plan 04 will choose between these two framings.

## Deviations from Plan

None — plan executed exactly as written.

- §5 structure matches spec: 2 intro paragraphs + 5 variant subsections (each with 4 sub-bullets) + closing blockquote
- All 7 D-VARIANTS-02 criteria present as column headers in §6 (verbatim match confirmed by grep)
- 5 variant rows in §6 matrix, each with rationale paragraph citing §4 + §5 evidence
- Section ordering after plan: §1, §2, §3, §4, §5, §6, §7 (§8 + §9 pending Plan 04)
- No files outside `.planning/phases/50-watch-detail-architecture-spike/` modified

## Known Stubs

None. This plan produces documentation-only content (decision spike analysis). No data stubs, no empty components, no placeholder text in the deliverable.

## Threat Flags

None. D-GUARD-01 enforcement confirmed — zero files outside `.planning/phases/50-watch-detail-architecture-spike/` modified. The §5 writability-axis sub-point for each variant makes the risk-modeling explicit: the spike documents which actor can add a photo on which surface, preventing a future implementation that grants write surface to a non-owner viewer. §5 closing paragraph carries the `watches_catalog` not-wipeable carve-out forward.

---
*Phase: 50-watch-detail-architecture-spike*
*Completed: 2026-05-20*

---
phase: 50-watch-detail-architecture-spike
verified: 2026-05-20T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 50: Watch-Detail Architecture Spike Verification Report

**Phase Goal:** A written decision exists on whether to keep `/catalog/[catalogId]` and `/watch/[id]` as separate views or merge them into a single adaptive detail surface
**Verified:** 2026-05-20
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | The decision document describes what each route currently does and who reaches it | VERIFIED | §2 Audience Matrix (viewer-state × ref-identity, 6 rows × 2 cols), §3 Route Reality Today with 12+7 entry-point map; anonymous-visitor cell flagged "not reachable today (auth-gated)" at SPIKE.md line 50 |
| 2 | The document lays out the concrete pros/cons of keeping vs merging, with v7.0 Watch Photos explicitly considered | VERIFIED | §4 Variants A-E (5 complete subsections), §5 v7.0 Watch Photos Lens (4 sub-points × 5 variants = 20 distinct sketches), §6 Decision Matrix (5 variants × 7 criteria) |
| 3 | The document delivers a clear decision with enough specificity for execution | VERIFIED | §8 names Variant B ("URL canonicalization") as primary recommendation; rationale references §6 matrix scores (B totals 28, nearest competitor A totals 27) and §5.B v7.0 lens evidence |
| 4 | No merge implementation shipped unless cheap+strongly-favored; if so, new requirement added mid-milestone | VERIFIED | D-GUARD-01 honored: all Phase 50 commits touch only `.planning/` files; §9 emits Verdict YES, names ARCH-02, triggers Phase 50.1 |

**Score:** 4/4 truths verified

---

## D-SKEL-02: Nine-Section Gate

| # | Required Section | Present | Notes |
|---|-----------------|---------|-------|
| 1 | Domain | PASS | `## 1. Domain` — states keep-vs-merge question, 5 variants A-E, D-GUARD-01 hard guardrail, ROADMAP SC#4 verbatim quote |
| 2 | Audience Matrix | PASS | `## 2. Audience Matrix` — viewer-state × ref-identity per D-AUDIENCE-01; anonymous-visitor row correctly flagged |
| 3 | Route Reality Today | PASS | `## 3. Route Reality Today` — §3.1 what each route does, §3.2 entry-point map (12 + 7), §3.3 BUG-01 maintenance tax |
| 4 | Variants A-E | PASS | `## 4. Variants A-E` — 5 subsections: A Keep separate, B URL canonicalization, C Unified /w/[ref], D Catalog absorbs watch, E Watch absorbs catalog |
| 5 | v7.0 Watch Photos Lens | PASS | `## 5. v7.0 Watch Photos Lens` — 5 sub-sections (one per variant) |
| 6 | Decision Matrix | PASS | `## 6. Decision Matrix` — 5 variants × 7 criteria scored |
| 7 | Cost Estimate per Variant | PASS | `## 7. Cost Estimate per Variant` — files touched, entry-point rewrites, migrations, DAL changes, test surface |
| 8 | Recommendation | PASS | `## 8. Recommendation` — Variant B named as primary; §8.1 rationale; sub-recommendation section explicitly omitted (no clear secondary) |
| 9 | Ship-now Eligibility | PASS | `## 9. Ship-now Eligibility` — ROADMAP SC#4 gate language verbatim, Verdict, Strongly favored, Cheap, Trigger blocks present |

`grep -cE '^## ' 50-SPIKE.md` returns 9. Verified.

---

## D-AUDIENCE-01: Audience Matrix Correctness

- Rows (viewer-state): owner, non-owner-with-collection, non-owner-empty-collection, wishlist-holder, sold-this, anonymous-visitor — all 6 present.
- Columns (ref-identity): `per-user (watches.id)`, `catalog (watches_catalog.id)` — correct axis naming per D-AUDIENCE-01, NOT the ROADMAP SC#1 labels.
- Anonymous-visitor cell: "not reachable today (auth-gated) — forward-compat placeholder for v6.0 social / v7.0 photo readers" — at SPIKE.md line 50 — VERIFIED.
- Re-framing note explicitly corrects the "watch is owner-only" assumption: §2 observation paragraph at SPIKE.md line 54 cites `getWatchByIdForViewer` and `framing: isOwner ? 'same-user' : 'cross-user'` dispatch.
- `findViewerWatchByCatalogId` cited at `src/app/catalog/[catalogId]/page.tsx:282` — VERIFIED.

**D-AUDIENCE-01 gate: PASS**

---

## D-V7-LENS-01: Depth Gate (20 Sketches)

Required: 4 sub-points (carousel renders, data joins, writability axis, viewer-state cell interaction) × 5 variants = 20 distinct sketches.

| Variant | Carousel renders | Data joins | Writability axis | Cell interaction |
|---------|-----------------|------------|-----------------|-----------------|
| A. Keep separate | VERIFIED | VERIFIED | VERIFIED | VERIFIED |
| B. URL canonicalization | VERIFIED | VERIFIED | VERIFIED | VERIFIED |
| C. Unified /w/[ref] | VERIFIED | VERIFIED | VERIFIED | VERIFIED |
| D. Catalog absorbs watch | VERIFIED | VERIFIED | VERIFIED | VERIFIED |
| E. Watch absorbs catalog | VERIFIED | VERIFIED | VERIFIED | VERIFIED |

All 20 sub-point sketches present. Confirmed by manual inspection of `## 5. v7.0 Watch Photos Lens` sub-sections.

**D-V7-LENS-01 gate: PASS**

---

## D-VARIANTS-02: Seven-Criteria Decision Matrix Gate

Required: 5 variants × 7 locked criteria (UX clarity, schema/URL stability, per-user data shape, v7.0 photo carousel fit, entry-point disruption, migration cost, irreversibility).

The scored matrix at `## 6. Decision Matrix` — Scored Matrix table:

| Variant | UX clarity | Schema/URL stability | Per-user data shape | v7.0 photo carousel fit | Entry-point disruption | Migration cost | Irreversibility |
|---------|-----------|---------------------|---------------------|-------------------------|----------------------|----------------|----------------|
| A | 2 | 5 | 3 | 2 | 5 | 5 | 5 |
| B | 3 | 4 | 4 | 3 | 5 | 5 | 4 |
| C | 5 | 3 | 5 | 5 | 1 | 1 | 3 |
| D | 4 | 4 | 4 | 4 | 2 | 2 | 3 |
| E | 3 | 3 | 3 | 3 | 3 | 3 | 3 |

All 7 locked D-VARIANTS-02 criteria present. All 5 variants scored. Scoring rationale section follows the matrix with per-variant explanations rooted in §3-§5 evidence.

**D-VARIANTS-02 gate: PASS**

---

## D-GUARD-01: Git Diff Scope Gate

Files modified by Phase 50 commits (`88c8fb5` through `0138952`):

```
.planning/phases/50-watch-detail-architecture-spike/50-01-SUMMARY.md
.planning/phases/50-watch-detail-architecture-spike/50-02-SUMMARY.md
.planning/phases/50-watch-detail-architecture-spike/50-03-SUMMARY.md
.planning/phases/50-watch-detail-architecture-spike/50-04-SUMMARY.md
.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md
.planning/ROADMAP.md
.planning/STATE.md
```

All modified files are under `.planning/`. Zero `src/` files. Zero migrations. Zero schema changes. The hard guardrail is satisfied.

**D-GUARD-01 gate: PASS**

---

## Landmine Checks

### Landmine 1: proxy.ts Router-Cache-Poisoning Callout (Variant B)

Required: Variant B section explicitly cites `proxy.ts` router-cache-poisoning by name.

Found at SPIKE.md line 137:

> "LANDMINE (mandatory callout — RESEARCH Pitfall 2, MEMORY `feedback_proxy_router_cache_poisoning`): Variant B is ONLY safe if canonicalization happens at the page level... It is NOT safe at the `proxy.ts` middleware layer. A `NextResponse.redirect` (or any 307) issued from `proxy.ts` on an RSC prefetch request poisons Next.js 16's Router Cache, causing 404s on subsequent soft-navigation."

The callout names `proxy.ts` by name, cites the MEMORY key, explains the failure mode (Router Cache poisoning on RSC prefetch), references the live precedent (`/u/*` route), and confirms the safe API (`redirect()` from `next/navigation`). The callout explicitly rejects any sub-variant that canonicalizes at the proxy layer "on first principles."

**Landmine 1: VERIFIED**

### Landmine 2: watches_catalog Not-Wipeable / In-Place ALTER+UPDATE Language

Required: any v7.0 photo cost reference uses in-place ALTER + UPDATE, not wipe-and-reseed.

Found at SPIKE.md line 230:

> "v7.0's multi-photo schema replacement (`imageUrl` text → photos table/array) is OUT OF SCOPE for Phase 50 per D-GUARD-01. The v7.0 implementation phase will face the `watches_catalog` NOT-wipeable constraint (MEMORY `project_db_wipeable_2026_05_09`, 2026-05-19 update) — any photo schema migration must be in-place ALTER + UPDATE, not wipe-and-re-seed."

Also at SPIKE.md line 282, the cost-estimate section reinforces: `watches_catalog` is NOT wipeable.

**Landmine 2: VERIFIED**

---

## Section 9 Verbatim-Format Gate

Reference format from `49-SPIKE.md` §9 (lines 429-463):
- ROADMAP SC#4 gate language quoted verbatim in blockquote
- `**Verdict: YES**` (bold, standalone line)
- `**Strongly favored:**` bold label followed by evidence paragraph
- `**Cheap:**` bold label followed by cost evidence paragraph
- `**Trigger:**` bold label followed by requirement add + `/gsd-phase --insert` instruction

`50-SPIKE.md` §9 format (lines 316-332):

| Format element | 49-SPIKE §9 | 50-SPIKE §9 | Match |
|---------------|-------------|-------------|-------|
| SC#4 blockquote | Present | Present (line 318) | PASS |
| `**Verdict: YES**` | `**Verdict: YES**` | `**Verdict: YES**` (line 324) | PASS |
| `**Strongly favored:**` block | Present | Present (line 328) | PASS |
| `**Cheap:**` block | Present | Present (line 330) | PASS |
| `**Trigger:**` block with `/gsd-phase --insert` | Present | Present (line 332) | PASS |

One structural difference: `49-SPIKE.md` §9 includes a second sub-recommendation eligibility block (for `unify-archetype-surface`). `50-SPIKE.md` §9 explicitly omits this because the matrix did not surface a clear secondary winner — the sub-recommendation section is absent by design with explicit rationale given in §8 ("The sub-recommendation section is omitted — there is no Phase 50's equivalent..."). This is acceptable: D-SKEL-02 §9 mandates the ship-now format from Phase 49, not that Phase 50 must have the same number of sub-recommendation blocks.

**Section 9 format gate: PASS**

---

## Definitive Recommendation Captured

**Primary variant:** Variant B — URL canonicalization

**Winner:** Variant B scores highest in the §6 matrix (total 28), the only variant scoring 5 on both cost criteria (entry-point disruption and migration cost). Beats nearest competitor Variant A (27) on per-user data shape (4 vs 3), driven by BUG-01 retirement evidence.

**Trigger condition met:** YES — both "strongly favored" (matrix-leading score + live production bug evidence) and "cheap" (1-2 files touched, zero migrations) bars cleared.

**Implementation trigger:** ARCH-02 added to REQUIREMENTS.md; Phase 50.1 implementation wave authorized.

**Forward trajectory documented:** §8.1 establishes Variant C as the v7.0 target architecture once the multi-photo model forces the carousel surface question. Phase 50.1 of Variant B should carry a `TODO: revisit for Variant C in v7.0` comment per §8.1.

---

## Anti-Patterns Found

No executable code was modified. The deliverable is a markdown decision document. Anti-pattern scanning is not applicable. Zero `TBD`, `FIXME`, or `XXX` markers in the spike document.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ARCH-01 | 50-01-PLAN.md through 50-04-PLAN.md | Spike compares keeping vs merging watch-detail routes, produces written decision | SATISFIED | `50-SPIKE.md` exists with all 9 sections, definitive Variant B recommendation, YES verdict |

---

## Human Verification Required

None. This is a decision-only spike — the deliverable is a markdown document. All verification checks are structural and can be confirmed programmatically. The recommendation is a written decision, not a behavioral claim requiring live application testing.

---

## Summary

Phase 50 fully achieves its goal. The spike deliverable (`50-SPIKE.md`) satisfies all four ROADMAP success criteria:

1. **SC#1** — Route reality documented via viewer-state × ref-identity matrix (6 rows × 2 columns per D-AUDIENCE-01), anonymous-visitor correctly flagged, entry-point map enumerates all 19 sites (12 + 7) with file:line citations, `findViewerWatchByCatalogId` and `getWatchByIdForViewer` cited at their exact locations.

2. **SC#2** — All 5 variants scored with rationale. The v7.0 Watch Photos lens applies all 4 required sub-points per variant (20 distinct sketches, D-V7-LENS-01). Decision matrix covers all 7 locked D-VARIANTS-02 criteria with scoring rationale rooted in §3-§5 evidence.

3. **SC#3** — Clear decision: Variant B (URL canonicalization). Rationale references §6 matrix scores, §5.B v7.0 lens, §3.3 BUG-01 maintenance tax, and the "cheap + strongly favored" threshold explicitly. The specificity is sufficient for an execution phase to proceed against.

4. **SC#4** — No implementation shipped. D-GUARD-01 confirmed by git diff (only `.planning/` paths modified). §9 emits Verdict YES with ARCH-02 requirement trigger and Phase 50.1 wave authorization — the correct escape-hatch flow.

Both structural landmines verified: `proxy.ts` router-cache-poisoning explicitly called out in Variant B (SPIKE.md line 137); `watches_catalog` NOT-wipeable constraint and in-place ALTER+UPDATE language present (SPIKE.md line 230).

---

_Verified: 2026-05-20_
_Verifier: Claude (gsd-verifier)_

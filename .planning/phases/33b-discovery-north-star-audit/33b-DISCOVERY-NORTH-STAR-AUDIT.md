---
title: Discovery North-Star Audit — v5.0 SEED-004 Drift-Vector Map
status: draft
date: 2026-05-08
audit_seed: SEED-004
phase: 33b-discovery-north-star-audit
requirement: DISC-12
decision: pending
predecessor_audit: 33-discovery-audit
---

# Discovery North-Star Audit — v5.0

> Read-only product-framed audit of v5.0 discovery surfaces against the SEED-004 Rdio principle.
> Zero code, schema, or dependency changes ship in this phase
> (per ROADMAP §Phase 33b success criterion #5; per NSD-15 rule 6).
> Phase 33's `33-DISCOVERY-AUDIT.md` is the IMMUTABLE research substrate; this audit cites
> DISC-AUDIT-NN row ids only and never modifies that table.

## Pass/Fail Criteria

The audit passes IFF ALL 6 rules below hold (mechanically enforced by
`.planning/phases/33b-discovery-north-star-audit/checks/full.sh`):

1. 42 cells, no skipped (entity × vector) pairs (6 entities × 7 vectors).
2. Every missing AND partial cell carries a leverage tag (high/med/low) per NSD-10/NSD-11.
3. Every missing AND partial cell cites ≥1 DISC-AUDIT-NN backing row from Phase 33 in the `backing_rows` column (— allowed only with explicit rationale for the absence).
4. Every missing cell's `rationale` cites the SEED-004 line 15 Rdio quote violation explicitly (`Rdio violation: …` or `SEED-004: …` syntax).
5. All 4 D-17 decisions in the final § have explicit YES/NO/DEFERRED resolution with 2–4 sentence rationale citing ≥1 NSV-NN row AND ≥1 DISC-AUDIT-NN backing row + a downstream-phase impact line.
6. Zero code/schema/dependency changes ship; zero modifications to `33-DISCOVERY-AUDIT.md` (verified by `git diff` returning empty).

### Status enum (NSD-04)

- **ship** — drift vector renders AND is clickable; viewer can drift in this direction without leaving the surface.
- **partial** — drift vector is visible to the viewer (name shown, list rendered, label present) but is not clickable; the viewer can SEE the drift direction but cannot ACT on it without leaving the surface (e.g., DISC-AUDIT-82 mostSimilar text-only verdict list; DISC-AUDIT-129 InsightsTabContent SleepingBeauties section with no Link).
- **missing** — no surface-level acknowledgment of the drift direction — neither label nor list nor data anchor exists (e.g., DISC-AUDIT-130 catalog page has no affordance to walk to other watches in the same family).
- **N-A** — drift vector is not applicable to this entity (e.g., search results aren't entity-specific until clicked — `same-family/lineage` is N-A there).

### Leverage enum (NSD-11)

- **high** — gates a v5.0 phase (most often Phase 39 polish, occasionally Phase 35 or Phase 38 scope) AND violates SEED-004 directly AND a single-user collector would frequently encounter the drift opportunity.
- **med** — gates a v5.x phase OR violates SEED-004 directly OR a collector would frequently encounter the drift, but not all three.
- **low** — none of the above; theoretical Rdio drift the audit captures for completeness but explicitly DEFERRED beyond v5.x.
- **—** — used for `ship` and `N-A` cells only (NSD-10: leverage scored on missing/partial cells only).

## Rdio Principle Anchor

The single anchor for every missing-vector row's rationale is SEED-004 line 15:

> a collector should be able to drift from one watch / collector / family / reference to another by clicking, without ever feeling lost or running into a dead end.

Source: `.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15.

This is the SINGLE rubric per NSD-15 rule 4 (inheriting Phase 33 D-12) — no alternative anchors permitted. Every `missing` row's `rationale` cell MUST cite this principle explicitly via `Rdio violation: …` or `SEED-004: …` syntax.

## Vector Definitions

The 7-vector canonical taxonomy per NSD-07 (locked; applied uniformly to all 6 entity blocks per NSD-02). Every cell in the Drift-Vector Audit table scores against exactly one of these vectors using the locked one-line definition.

| Vector | One-line definition | PROD or planned anchor |
|--------|---------------------|------------------------|
| similar-by-taste | walk to watches similar in style/role/taste to this one | `analyzeSimilarity()` (PROD); CAT-13 catalog taste columns post-Phase 38 |
| same-family/lineage | walk to watches in the same family or sharing a lineage edge | CAT-15 brands/families (Phase 34); CAT-16 lineage edges (Phase 35) |
| same-era | walk to watches from the same era / generation | `era_signal` column (Phase 19.1 LLM-derived; CAT-13 reads it post-Phase 38) |
| other-owners | walk to other collectors who own / wishlist this watch | cross-collector graph (PROD via /catalog catalog-page collector list) |
| owner-overlap | walk to overlap with this collector — shared taste / shared collection | common-ground (PROD `/u/{user}/common-ground`) |
| evaluative-verdict | "does this fit my collection" answer for the viewer | Collection Fit verdict (PROD `/watch`, `/catalog`, search inline-expand) |
| see-more-like-this | walk to a paginated rail/feed of more affordances like this one | trending/popular/gaining-traction rails (PROD `/explore`); recommender layer (SEED-002 future) |

## Leverage Bucket Key

Per NSD-11. Leverage is scored on `missing` and `partial` cells only (NSD-10); `ship` and `N-A` cells receive `—`.

- **high** — gates a v5.0 phase (most often Phase 39 polish, occasionally Phase 35 or Phase 38 scope) AND violates SEED-004 directly AND a single-user collector would frequently encounter the drift opportunity.
- **med** — gates a v5.x phase OR violates SEED-004 directly OR a collector would frequently encounter the drift, but not all three.
- **low** — none of the above; theoretical Rdio drift the audit captures for completeness but explicitly DEFERRED beyond v5.x.
- **—** — `ship` and `N-A` cells (no leverage scoring per NSD-10).

## Drift-Vector Audit

<!-- skeleton -->
<!-- Wave 1 (Plan 02) MUST remove this sentinel as part of its first NSV-NN row commit. -->
<!-- After sentinel removal, full.sh enforces 42 rows (NSV-01..NSV-42), all rules. -->

| row_id | entity | vector | status | leverage | rationale | backing_rows |
|--------|--------|--------|--------|----------|-----------|--------------|

## Decisions

The 4 D-17 decisions deferred from Phase 33 per NSD-16. Each verdict uses the Phase 33 D-16 template extended with NSV-NN cites alongside DISC-AUDIT-NN cites. Wave 2 (Plan 03) fills in YES/NO/DEFERRED with rationale, cited NSV rows, backing DISC-AUDIT rows, and downstream-phase drives.

### Decision Q1: Combine home and explore?

**Verdict:** TBD (YES | NO | DEFERRED — set in Wave 2)
**Rationale:** TBD by Wave 2 (Plan 03) — 2–4 sentences citing audit findings.
**Cited NSV rows:** TBD
**Backing DISC-AUDIT rows:** TBD
**Drives:** TBD downstream phase / item gated by this verdict.

### Decision Q2: Lineage browse priority

**Verdict:** TBD (YES | NO | DEFERRED — set in Wave 2)
**Rationale:** TBD by Wave 2 (Plan 03) — 2–4 sentences citing audit findings.
**Cited NSV rows:** TBD
**Backing DISC-AUDIT rows:** TBD
**Drives:** TBD downstream phase / item gated by this verdict.

### Decision Q3: Dead-end closure priority

**Verdict:** TBD (YES | NO | DEFERRED — set in Wave 2)
**Rationale:** TBD by Wave 2 (Plan 03) — 2–4 sentences citing audit findings.
**Cited NSV rows:** TBD
**Backing DISC-AUDIT rows:** TBD
**Drives:** TBD downstream phase / item gated by this verdict.

### Decision Q4: CAT-13 discovery framing

**Verdict:** TBD (YES | NO | DEFERRED — set in Wave 2)
**Rationale:** TBD by Wave 2 (Plan 03) — 2–4 sentences citing audit findings.
**Cited NSV rows:** TBD
**Backing DISC-AUDIT rows:** TBD
**Drives:** TBD downstream phase / item gated by this verdict.

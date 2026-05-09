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

| row_id | entity | vector | status | leverage | rationale | backing_rows |
|--------|--------|--------|--------|----------|-----------|--------------|
| NSV-01 | Watch Detail | similar-by-taste | partial | high | mostSimilar list inside CollectionFitCard renders watch identity (brand+model) as text-only `<li>` rows with no `<Link>` wrap — viewer can SEE the drift direction (which watches are most similar) but cannot ACT on it without copy/paste. NSD-09 inputs present: (1) explicit Rdio dead-end — viewer feels lost when the surface names a target but offers no click-through; (2) downstream impact — gates Phase 39 polish (one-line text→Link patch is the cheapest high-leverage closure); (3) collector frequency — every owner viewer with populated collection encounters this block on every /watch view. | DISC-AUDIT-82 |
| NSV-02 | Watch Detail | same-family/lineage | missing | high | Rdio violation: /watch/{id} surfaces no affordance — neither label nor list nor data anchor — to walk to other watches sharing a brand/family/lineage edge from the current watch; SEED-004 line 15 dead-end (the viewer "feels lost" with no navigable path to siblings of the current ref). NSD-09 inputs present: (1) explicit principle violation — family is a canonical Rdio drift direction; (2) downstream impact — Q2 anchor co-cell with NSV-16; gates Phase 35 lineage browse UI scope (CAT-15/CAT-16); (3) collector frequency — high (any viewer browsing a hierarchy-aware product expects family walk). Backing absent because Phase 33 enumerated affordances that exist; CAT-15/CAT-16 are v5.0-roadmap planned anchors not yet shipped, so no DISC-AUDIT-NN row anchors this absence. | — |
| NSV-03 | Watch Detail | same-era | missing | med | Rdio violation: /watch/{id} surfaces no affordance to walk to other watches from the same era/generation despite Phase 19.1 shipping the `era_signal` column on watches_catalog; SEED-004 dead-end at the era-drift direction. NSD-09 inputs present: (1) principle violation — era is a canonical Rdio drift dimension; (2) downstream impact — Phase 38/39 candidate (engine post-rewire reads era_signal; UI rail comes after); (3) collector frequency — moderate (era browsing is a watch-collector reflex but less universal than family). Backing absent because the affordance is absent at the surface — Phase 33 did not flag a Missing row for non-shipped vectors with no UI anchor; absence per NSD-15 rule 3 with explicit rationale. | — |
| NSV-04 | Watch Detail | other-owners | missing | low | Rdio violation: /watch/{id} is per-user-watch (the viewer's owned/wishlist/grail row); the cross-collector graph (other owners of the same catalog ref) lives on /catalog per NSD-07 PROD anchor — DISC-AUDIT-76..83 enumerate only owner-actions and the verdict block, no other-owners roster. The viewer hits a dead-end at the other-owners drift direction; SEED-004 violation. NSD-09 inputs present: (1) principle violation — yes; (2) downstream impact — low (the canonical home for this vector is /catalog NSV-18, not /watch); (3) collector frequency — low (collectors typically reach other-owners via catalog/people-search, not the per-user-watch detail). | — |
| NSV-05 | Watch Detail | owner-overlap | N-A | — | /watch/{id} is the per-user-watch detail surface (owner viewing own watch, or cross-user framing per Phase 20 D-08). owner-overlap (shared-taste / common-ground walk between TWO collectors) requires a collector-pair frame that /watch does not host — the page is single-watch, not collector-pair. The vector applies natively at /u/{user}/common-ground (NSV-12) and is genuinely inapplicable at the per-user-watch level: there is no path to make it apply meaningfully without making /watch into a profile-comparison surface, which would dilute its single-watch evaluative purpose. Author judgment per A5 in RESEARCH Assumptions Log: confirmed N-A (not missing) because cross-user framing on /watch concerns one viewer evaluating one watch, not two-collector overlap. | — |
| NSV-06 | Watch Detail | evaluative-verdict | partial | high | Verdict label/pill renders on CollectionFitCard for owner-populated viewers (DISC-AUDIT-81) but is suppressed entirely for fresh-account viewers under the G-6 collection.length>0 branch (DISC-AUDIT-131 — verdict stays null and CollectionFitCard does not render). Per NSD-06 worst-case viewer-state aggregation, the cell takes the WORST status — partial — because the fresh-account viewer can SEE the watch detail but not the verdict that anchors the evaluative-discovery surface. Rdio violation: fresh-account viewer hits a dead-end at the canonical "does this fit my collection" answer. NSD-09 inputs present: (1) explicit fresh-account dead-end at SEED-004's evaluative direction; (2) downstream impact — Q4 CAT-13 framing anchor; gates Phase 38 motivation (discovery improvement vs tech debt); (3) collector frequency — every fresh-account viewer encounters this gap on every /watch view in cross-user framing. | DISC-AUDIT-81, DISC-AUDIT-131 |
| NSV-07 | Watch Detail | see-more-like-this | missing | med | Rdio violation: /watch/{id} surfaces no paginated rail/feed of "more watches like this" — DISC-AUDIT-76..83 enumerate owner actions, the verdict block, and a Flag-as-good-deal toggle; no rail of related catalog refs or related per-user watches; SEED-004 dead-end at the see-more-like-this direction. NSD-09 inputs present: (1) principle violation — see-more-like-this is a canonical Rdio drift; (2) downstream impact — Phase 39 polish candidate (or recommender layer SEED-002 future); (3) collector frequency — moderate (every viewer would plausibly want a "more like this" rail, but the existing mostSimilar list partly satisfies the want once made clickable per NSV-01). Backing absent because the rail surface itself does not exist on /watch — absence per NSD-15 rule 3 with explicit rationale. | — |

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

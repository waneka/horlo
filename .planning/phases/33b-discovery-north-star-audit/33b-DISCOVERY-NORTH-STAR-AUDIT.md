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
| NSV-08 | Collector Profile | similar-by-taste | missing | high | Rdio violation: InsightsTabContent SleepingBeautiesSection / GoodDealsSection list watches by brand/model identity but offer no `<Link>` wrap — owner sees a curated taste-derived list (sleeping beauties, good deals) and cannot click through to /watch/{id}; SEED-004 line 15 dead-end at the similar-by-taste drift direction (the surface explicitly names taste-derived candidates and provides no path to act on them). NSD-09 inputs present: (1) explicit principle violation — taste cards label drift candidates without click-through; (2) downstream impact — Phase 39 polish (one-line `<Link>` wrap is the cheapest high-leverage closure); (3) collector frequency — high (owner self-view of the insights tab is a frequent ritual; every owner with collection signal hits this list). | DISC-AUDIT-129 |
| NSV-09 | Collector Profile | same-family/lineage | missing | med | Rdio violation: profile tabs (Collection, Wishlist, Worn, Notes, Stats) render watches grouped by user-action (owned/wished/worn/noted/stats-counted), not by family or lineage edge — the viewer cannot drift from "owner has this Sub" to "show me the owner's other watches in the same family/lineage"; SEED-004 dead-end at family drift on the profile surface. NSD-09 inputs present: (1) principle violation — family drift is a canonical Rdio direction the profile-level browse does not honor; (2) downstream impact — Phase 39 candidate gated on Phase 34/35 schema; (3) collector frequency — moderate (collectors browse by brand/family but most reach this via /catalog NSV-16 not via profile). Backing absent because Phase 33 enumerated affordances that exist; profile-level family-walk is non-existent at the surface, so no DISC-AUDIT-NN row anchors the absence. | — |
| NSV-10 | Collector Profile | same-era | missing | low | Rdio violation: profile surfaces show watches with reference data but provide no era-grouping or era-walk affordance — the viewer cannot say "show me this collector's other watches from the same era" despite Phase 19.1's `era_signal` column existing on watches_catalog; SEED-004 dead-end at the era direction on the profile surface. NSD-09 inputs present: (1) principle violation — yes (era is a canonical Rdio drift); (2) downstream impact — low (post-v5.x candidate; not a v5.0 phase gate); (3) collector frequency — low (era browsing is usually catalog-anchored, rarely profile-anchored). Backing absent because the affordance is absent at the surface — absence per NSD-15 rule 3 with explicit rationale. | — |
| NSV-11 | Collector Profile | other-owners | N-A | — | The Collector Profile entity IS the collector — `/u/{user}` is the canonical surface for one specific collector, not a watch surface. The "other-owners" vector asks "who else owns THIS WATCH" and applies natively at /catalog NSV-18, not at /u/{user} which scopes to one collector. There is no path to make "other-owners-of-this-collector" meaningful — the vector is genuinely inapplicable at the entity level. (The semantically adjacent vector — other collectors with similar taste — is captured at /explore NSV-32 PopularCollectors and SuggestedCollectors at NSV-25, not folded into the profile entity.) | — |
| NSV-12 | Collector Profile | owner-overlap | partial | high | Common-ground tab ships clickable shared-watch ProfileWatchCard rows for the owner-populated branch where viewer follows owner AND overlap.hasAny (DISC-AUDIT-125 G-12 owner-populated; DISC-AUDIT-126 redundant hero-band Link). However, the fresh-account / no-overlap branch fires `notFound()` at /u/{user}/common-ground returning a hard 404 with no walk-back affordance to /explore, /search, or other follows (DISC-AUDIT-127 G-12 fresh-account branch). Per NSD-06 worst-case viewer-state aggregation, the cell takes the WORST status — partial — because the fresh-account viewer following an owner with no overlap hits a Rdio dead-end where the owner-overlap surface either ships or 404s with no graceful degradation. Rdio violation at the 404 path. NSD-09 inputs present: (1) explicit dead-end at the 404 fallback; (2) downstream impact — Q3 dead-end closure ordering anchor; gates Phase 39 polish (404 → fallback page with walk-back CTAs); (3) collector frequency — moderate-high (any fresh-account viewer following one collector with no shared watches hits the 404). | DISC-AUDIT-125, DISC-AUDIT-126, DISC-AUDIT-127 |
| NSV-13 | Collector Profile | evaluative-verdict | N-A | — | Profile renders the OWNER's watches (their collection, wishlist, worn, notes, stats, common-ground, insights), not the VIEWER-EVALUATIVE-AGAINST-VIEWER's-OWN-COLLECTION verdict. The evaluative-verdict surface is the Collection Fit verdict whose canonical homes are /watch (NSV-06) and /catalog (NSV-20) — both per-watch surfaces where the viewer's own collection is the comparator. There is no path to make "verdict on this profile" meaningful at the collector entity level without conflating profile-of-collector with verdict-on-watch — the vector is genuinely inapplicable to the entity. (The owner-self insights tab DISC-AUDIT-128 is a summary view of the owner's OWN collection insights, not a verdict the viewer evaluates against their own collection.) | — |
| NSV-14 | Collector Profile | see-more-like-this | missing | high | Rdio violation cluster — the dominant Q3 dead-end aggregate on the profile surface; SEED-004 line 15 dead-end at the see-more-like-this / walk-back direction across SEVEN distinct sub-cells: (a) LockedTabCard variants for collection / wishlist / notes / stats (DISC-AUDIT-97, 102, 122, 124) render lock UI for fresh-account viewers without a Connect/Follow CTA — viewer feels lost with no path back to discovery; (b) WornCalendar day-cells (DISC-AUDIT-111) render photo+badge but expose no onClick — viewer cannot drill into the wear event detail; (c) StatsTabContent rows (DISC-AUDIT-123) list watch identity without `<Link>` wraps — viewer cannot click through to /watch/{id}; (d) Common Ground 404 fallback (DISC-AUDIT-127) returns hard 404 with no walk-back to /explore or other follows; (e) wishlist drag-handle silent no-op (DISC-AUDIT-99) WR-07 pattern — wired-but-broken affordance where drag commits to DB but page does not refresh until manual reload (Phase 33 classified Dead; Phase 33b folds into the cluster as a "wired-but-broken" sub-cell rather than a clean missing dead-end per A2 in RESEARCH Assumptions Log). NSD-09 inputs present: (1) explicit cluster of Rdio dead-ends — multiple distinct paths where the viewer "feels lost" or "runs into a dead end"; (2) downstream impact — Phase 39 polish ordering anchor (Q3 verdict consumes this aggregate); (3) collector frequency — varies per sub-cell (calendar day-cells + stats rows + common-ground 404 are universal-encounter; locked-tab cells are fresh-account-only) — leverage rating reflects the WORST sub-cell which is high. | DISC-AUDIT-97, DISC-AUDIT-99, DISC-AUDIT-102, DISC-AUDIT-111, DISC-AUDIT-122, DISC-AUDIT-123, DISC-AUDIT-124, DISC-AUDIT-127 |
| NSV-15 | Catalog | similar-by-taste | partial | high | Verdict mostSimilar list inside CollectionFitCard renders watch identity (brand+model) as text-only `<li>` rows with no `<Link>` wrap — same pattern as NSV-01 on /watch but anchored at /catalog (DISC-AUDIT-71); viewer can SEE the drift direction but cannot ACT on it. NSD-09 inputs present: (1) explicit Rdio dead-end at the named-target-without-click pattern; (2) downstream impact — Phase 39 polish (one-line text→Link patch shared with NSV-01 — closing both is a single Phase 39 line item); (3) collector frequency — high (any owner-populated viewer browsing catalog refs hits this list). Worst-case viewer aggregation note: the mostSimilar list itself is gated on the same G-4 collection.length>0 branch as DISC-AUDIT-70 — fresh-account viewers (DISC-AUDIT-130 branch) don't see this list at all, but that absence is captured in NSV-20 not NSV-15 because the suppression is verdict-block-wide; NSV-15 scores the partial state where the list IS rendered. | DISC-AUDIT-71 |
| NSV-16 | Catalog | same-family/lineage | missing | high | Rdio violation: /catalog/{catalogId} has NO affordance — neither label nor list nor data anchor — to walk to other watches in the same family or sharing a lineage edge from the current catalog ref (DISC-AUDIT-130 explicitly captures this absence as part of its fresh-account suppression rationale: "no walk-back to other watches in the same family"); SEED-004 line 15 dead-end at the family/lineage drift direction. The Q2 lineage browse priority anchor — /catalog is the entity where family-walk SHOULD live (CAT-15 brands+watch_families schema and CAT-16 lineage edges are Phase 34/35 planned anchors). NSD-09 inputs present: (1) explicit principle violation — family is a canonical Rdio drift direction the catalog surface fails to honor; (2) downstream impact — Q2 anchor; gates Phase 35 schema-only vs schema+UI scope (verdict drives whether the lineage browse UI ships in Phase 35 or defers to Phase 39 / v5.x); (3) collector frequency — high (every catalog page view in a hierarchy-aware product expects the family walk; collectors actively look for siblings of the named ref). | DISC-AUDIT-130 |
| NSV-17 | Catalog | same-era | missing | med | Rdio violation: /catalog/{catalogId} surfaces no era-grouping or era-walk affordance despite Phase 19.1's `era_signal` column existing on watches_catalog (the canonical schema home for era data); SEED-004 dead-end at the era direction — a viewer cannot walk from a 1970s ref to other 1970s refs without leaving the surface. NSD-09 inputs present: (1) principle violation — era is a canonical Rdio drift; (2) downstream impact — Phase 39 candidate post-Phase 38 engine rewire (engine reads era_signal at JOIN time per CAT-13); (3) collector frequency — moderate (era-anchored browsing is common for vintage collectors; less universal). Backing absent because the affordance is absent at the surface — Phase 33 enumerated rendered affordances; absence per NSD-15 rule 3 with explicit rationale. | — |
| NSV-18 | Catalog | other-owners | missing | high | Rdio violation: /catalog/{catalogId} surfaces NO list of other collectors who own or wishlist this catalog ref — DISC-AUDIT-70..75 enumerate verdict, mostSimilar, "You own this" self-callout (DISC-AUDIT-72 — the viewer's OWN watch, not other owners), and three CTAs (Add to Wishlist / Add to Collection / Skip); no roster, no chips, no "X collectors own this" line; SEED-004 line 15 dead-end at the other-owners drift direction despite NSD-07 designating /catalog as the canonical PROD anchor for the cross-collector graph. Author judgment per A4 in RESEARCH Assumptions Log RESOLVED: NSD-07's PROD-anchor hint ("cross-collector graph (PROD via /catalog catalog-page collector list)") was aspirational — Phase 33's source-pass enumeration confirms no collector list ships at /catalog. NSD-09 inputs present: (1) explicit principle violation — other-owners is a canonical Rdio drift the catalog surface fails to honor; (2) downstream impact — Phase 39 polish or v5.x feature work (the cross-collector graph requires aggregation queries that Phase 34 + Phase 36 clean-slate enable); (3) collector frequency — high (catalog page is the natural place to surface "who else owns this Sub" — every catalog visit invites the question). | DISC-AUDIT-70, DISC-AUDIT-72 |
| NSV-19 | Catalog | owner-overlap | N-A | — | /catalog/{catalogId} is a canonical reference surface (one watch ref, viewer-evaluating), not a collector-pair surface. owner-overlap requires a TWO-collector frame (the viewer's collection vs another collector's collection) — that vector applies natively at /u/{user}/common-ground (NSV-12) and is genuinely inapplicable at the catalog ref level: /catalog has no second-collector context to overlap against. Folding owner-overlap into /catalog would require fundamentally changing the catalog page from "ref evaluation against your own collection" to "ref evaluation against a specific other collector's collection", which would dilute its single-ref discovery purpose. Vector is genuinely inapplicable. | — |
| NSV-20 | Catalog | evaluative-verdict | partial | high | Verdict label/pill renders on CollectionFitCard for owner-populated viewers under the G-4 collection.length>0 branch (DISC-AUDIT-70) but the entire verdict + CatalogPageActions block is suppressed for fresh-account viewers under the G-4 empty-collection branch (DISC-AUDIT-130 — verdict stays null AND actionsSpec stays null → no card, no CTAs, header + image only). Per NSD-06 worst-case viewer-state aggregation, the cell takes the WORST status — partial — because the fresh-account viewer hits a Rdio dead-end where the canonical "does this fit my collection" answer is silently absent (no even-skeletal verdict surface). Q4 CAT-13 framing co-anchor with NSV-06: the visibility of the missing taste-aware verdict signal at /catalog (NSV-20) and /watch (NSV-06) is what makes CAT-13 a "discovery improvement" rather than "tech debt". Rdio violation explicitly cited in DISC-AUDIT-130 evidence ("Rdio violation: fresh-account viewer lands on /catalog/{id} with header + image only — no verdict, no walk-forward affordance"). NSD-09 inputs present: (1) explicit fresh-account dead-end at the evaluative direction; (2) downstream impact — Q4 CAT-13 framing; gates Phase 38 motivation; (3) collector frequency — high (every fresh-account viewer hits this gap on every /catalog visit). | DISC-AUDIT-70, DISC-AUDIT-130 |
| NSV-21 | Catalog | see-more-like-this | missing | med | Rdio violation: /catalog/{catalogId} surfaces no paginated rail of "more catalog refs like this" — DISC-AUDIT-70..75 enumerate the verdict block, the mostSimilar list, and three CTAs; no "more references" section, no "browse similar" rail; SEED-004 dead-end at the see-more-like-this direction. NSD-09 inputs present: (1) principle violation — see-more-like-this is a canonical Rdio drift; (2) downstream impact — Phase 39 polish candidate (could share rail infrastructure with /explore TrendingWatches DiscoveryWatchCard pattern); (3) collector frequency — moderate (the existing mostSimilar list partly serves this want once made clickable per NSV-15; a separate paginated rail is incrementally valuable, not foundational). Backing absent because the rail surface itself does not exist on /catalog — absence per NSD-15 rule 3 with explicit rationale. | — |

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

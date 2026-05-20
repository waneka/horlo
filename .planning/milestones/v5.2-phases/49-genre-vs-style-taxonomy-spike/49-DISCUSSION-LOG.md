# Phase 49: Genre vs Style Taxonomy Spike - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 49-genre-vs-style-taxonomy-spike
**Areas discussed:** Audit breadth, Genre vs Archetype, Deliverable structure, Code vs data evidence

---

## Pre-discussion finding (surfaced during codebase scout)

Before the gray-area selection, the scout flagged that **`GenreChips` and `ArchetypeChips` both filter the same `watches_catalog.primary_archetype` column** with the same 10 values from `PRIMARY_ARCHETYPES`, and `src/data/catalog.ts:444-450` has an explicit "archetype wins when both set" tiebreaker. This is a genre-vs-genre redundancy living inside the genre side — surfaced because it reframed TAX-01 from "genre vs style" into potentially "genre vs archetype vs style." The finding became its own discussion area (see "Genre vs Archetype" below).

---

## Audit breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Every consumer | Sweep all ~9 consumers (4 named + /explore/genres index, /collection FilterBar, preferences UI, profile insights, add-watch flow). +30min cost; full hidden-dependency safety. | ✓ |
| Just the 4 named | Stick literally to TAX-01 wording. Risk: recommendation may break an unnamed consumer. | |
| Named + obvious extras | The 4 named + /explore/genres + /collection FilterBar; skip preferences/insights/add-watch unless surfaced. | |

**User's choice:** Every consumer
**Notes:** No clarifications added; the recommendation rationale ("a recommendation to remove a field has to account for EVERY callsite") was accepted as-is. Recorded as D-01 in CONTEXT.md.

---

## Genre vs Archetype

| Option | Description | Selected |
|--------|-------------|----------|
| Fold it in | Spike covers genre↔style AND genre↔archetype; the audit can't honestly ignore that genre is one of TWO surfaces over the same column. May tip the recommendation toward "unify the archetype surface first." | ✓ |
| Strictly genre vs style | Honor literal TAX-01 wording; note genre↔archetype as a deferred future spike. Cleaner scope, partial recommendation. | |
| Audit both, recommend only on G↔S | Map both overlaps but the recommendation itself stays strictly on genre vs style; genre↔archetype is a flagged-for-followup item in the doc. | |

**User's choice:** Fold it in
**Notes:** Recorded as D-02/D-03 in CONTEXT.md. Spike doc may produce two recommendations (primary on genre↔style; sub-recommendation on genre↔archetype). If the genre↔archetype sub-recommendation is "cheap and strongly favored," it becomes a candidate for the v5.2 mid-milestone requirement-add per ROADMAP SC#4.

---

## Deliverable structure — content

| Option | Description | Selected |
|--------|-------------|----------|
| Map + matrix + cost | Consumer map table, overlap/divergence matrix, decision matrix with criteria, recommendation, per-option cost estimate (files, migrations, backfill). Strong enough to act on without re-investigation. | ✓ |
| Map + rationale only | Consumer map + prose rationale + final recommendation. Lighter. Risk: re-do the cost work at v6.0. | |
| Map + matrix + cost + sample diff | Everything in option 1 + a sample diff/PR sketch for the recommended path. Heaviest; borders on implementation. | |

**User's choice:** Map + matrix + cost
**Notes:** Recorded as D-05 in CONTEXT.md with a 9-section mandatory skeleton. Sample-diff option (3) was rejected — implementation belongs in a separate follow-up requirement add per ROADMAP SC#4, not inside the spike.

## Deliverable structure — location

| Option | Description | Selected |
|--------|-------------|----------|
| Phase dir | `.planning/phases/49-genre-vs-style-taxonomy-spike/49-SPIKE.md` — co-located with discussion/research/plan artifacts. | ✓ |
| `.planning/research/` | Standalone research doc (pattern of SEED-007 pricing research). Better for long-term reference. | |
| Both | Phase dir during work, symlink/copy to research dir at phase close. | |

**User's choice:** Phase dir
**Notes:** Recorded as D-04 in CONTEXT.md.

---

## Code vs data evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, query the catalog | Read-only SELECTs against prod or local mirror: agreement/divergence counts, top styleTags per archetype, null coverage, sample disagreement examples. ~5 queries, ~15min. | ✓ |
| No — code only | Pure code/schema audit. Faster. Risk: recommendation rests on intuition about LLM enricher behavior, not data. | |
| Code first, queries only if ambiguous | Researcher does the code audit; runs SQL only if the code audit ends with "depends on data." | |

**User's choice:** Yes, query the catalog
**Notes:** Recorded as D-06/D-07 in CONTEXT.md. Minimum 5-query set specified (agreement, divergence, per-archetype top styleTags, null coverage, disagreement examples). Numbers must be embedded in the spike doc with enough query text that a reader can reproduce them.

---

## Claude's Discretion

- Exact ordering of sections within `49-SPIKE.md` (the 9-section skeleton in D-05 is mandatory; sequencing is the planner's call)
- Format of the Decision Matrix (numeric scores vs ✓/✗ vs prose)
- Whether to break the live-catalog queries into a separate appendix or inline them per finding
- Whether to query prod or local mirror for D-07 (prefer prod; either is safe since queries are read-only)

## Deferred Ideas

- Any implementation of consolidation/removal in this phase — forbidden by ROADMAP SC#4 + REQUIREMENTS Out of Scope. A cheap+strongly-favored path triggers a new requirement add (separate `/gsd-phase` flow), not direct execution.
- Watch-detail architecture (`/catalog/[catalogId]` vs `/watch/[id]`) — Phase 50 / ARCH-01
- Style vocab governance (open vocab → closed enum) — possible v6.0+ follow-up if spike recommends "keep style but tighten it"
- Adding `preferredArchetypes` / `dislikedArchetypes` to `user_preferences` for symmetry with style — its own phase if spike keeps genre

---
id: SEED-004
status: dormant
planted: 2026-05-03
planted_during: post-v4.0 close — milestone roadmapping conversation
trigger_when: starting milestone v5.0, OR planning any home/explore consolidation, click-driven discovery, or catalog → similarity engine rewire
scope: large
related_phases: [v4.0 Phase 17 (catalog foundation), v4.0 Phase 18 (/explore), v4.0 Phase 20 (Collection Fit verdict reframe), v4.0 Phase 23/24 (VERIFICATION.md backfill carryover)]
---

# SEED-004: v5.0 Discovery North Star — Rdio-style click-driven discovery

## The Idea

v5.0 is the milestone where Horlo's North Star — Rdio-style click-driven discovery — gets explicit treatment. The animating principle: **a collector should be able to drift from one watch / collector / family / reference to another by clicking, without ever feeling lost or running into a dead end.**

**Phase 1 of v5.0 must be a discovery audit, not implementation.** Map current click-paths vs ideal click-paths across `/`, `/explore`, `/u/{user}`, `/catalog/{id}`, `/search`, `/watch/{id}`. Output: which surfaces overlap, which are dead, which need new affordances. The audit answers the open question "combine home and explore?" — don't pre-decide it.

**Likely subsequent phases (audit-driven):**
- Home/Explore consolidation (decided by audit; do not lock scope before audit ships)
- Discovery surface polish based on audit findings
- **CAT-13 catalog → similarity engine rewire** — belongs in v5.0 because rewiring the engine to read catalog taste at JOIN time IS a discovery feature: better verdicts → better evaluative discovery

**NOT in v5.0 (moved to v4.1):**
- Phase 23 + Phase 24 phase-level VERIFICATION.md backfill — landed in v4.1 Polish & Patch as part of v4.0 carryover cleanup

## Why This Matters

- **The North Star isn't yet load-bearing in the UX.** v4.0 shipped /explore + /search + Collection Fit verdict reframe — the *infrastructure* is there, but no audit has tied them together against the click-driven-discovery principle. v5.0 is where the principle becomes the organizing constraint.
- **Audit-first prevents premature consolidation.** "Combine home and explore?" is exactly the kind of question that gets decided wrong by gut. The audit makes the decision falsifiable.
- **CAT-13 has been deferred since v4.0** with a stated precondition (tag taxonomy audit phase must land first per PROJECT.md `Next Milestone Goals`). The v5.0 discovery audit IS that taxonomy audit if scoped to include taste-attribute coverage gaps.
- **Premium gating reshapes scope.** SEED-006 (premium features audit) must run BETWEEN v4.1 close and v5.0 start. If paid users see deeper trends and free users see surface, that decision changes what "discovery" means before v5.0 locks.

## Current State (post-v4.0)

- `/explore` ships 3 cached rails (Popular Collectors, Trending Watches, Gaining Traction) + sparse-network welcome hero — **raw popularity, not personalized** (see SEED-002 for the personalized layer story)
- `/search` ships 4 tabs (All / Watches / People / Collections) with anti-N+1 catalog watch search and two-layer-privacy collection search
- Collection Fit verdict reframe replaced raw scores across `/watch/{id}`, `/search` row inline-expand accordion, and new `/catalog/{catalogId}` route — this is the evaluative-discovery surface
- `/evaluate` route eliminated; URL paste flows into Add-Watch with verdict-as-step
- `analyzeSimilarity()` byte-locked across Phase 17 / 19.1 / 20 — currently reads from per-user `watches` data, not catalog taste columns. CAT-13 is the rewire.

## When to Surface

**Trigger:** When `/gsd-new-milestone` is run for v5.0, OR when any phase proposes home/explore consolidation, click-driven discovery affordances, or migrating `analyzeSimilarity()` to read catalog taste at JOIN time.

**Hard prerequisites before v5.0 locks:**
1. v4.1 Polish & Patch ships (clears v4.0 carryover)
2. SEED-006 premium features `/gsd-explore` session runs (premium gating reshapes scope)

## Scope Estimate

**Large — 2-3 weeks, multi-phase.** Likely shape:
- Phase 1: Discovery audit (`/gsd-explore` or read-only audit phase) — produces a click-path map and decisions document
- Phase 2: Home/Explore consolidation (decided by audit; may be a no-op if audit says "they're correctly distinct")
- Phase 3: Discovery surface polish — wherever the audit flags dead ends, missing affordances, or overlap
- Phase 4: CAT-13 catalog → similarity engine rewire — engine reads `watches_catalog.{formality, sportiness, heritage_score, primary_archetype, era_signal, design_motifs, confidence}` at JOIN time

## Breadcrumbs

- `.planning/PROJECT.md` — `Next Milestone Goals (v5.0 candidates)` lists CAT-13, DISC-09, SRCH-16, FIT-05, SET-13, SET-14
- `.planning/seeds/SEED-001-catalog-hierarchy-and-attributes.md` — Reference granularity is the precondition for any recommender layer
- `.planning/seeds/SEED-002-hybrid-recommender.md` — Three-layer hybrid recommender is the *next* milestone after v5.0 if the audit calls for personalization
- `.planning/seeds/SEED-003-onboarding-cold-start-flow.md` — 4-step onboarding pairs with the recommender, NOT v5.0 directly
- `src/lib/similarity.ts` — current scoring engine; CAT-13 rewire target
- `src/lib/taste/` — Phase 19.1 LLM-derived taste service module; CAT-13 reads from this layer
- `.planning/milestones/v4.0-MILESTONE-AUDIT.md` — Phase 23 + 24 VERIFICATION.md gaps documented

## Notes

- **The "Rdio click-driven" principle is qualitative, not quantitative.** Don't try to measure it with metrics on day one. The audit produces a click-path map; the polish phases close the gaps in the map. Quantification (engagement, dwell, click-through) is a v5.x or v6.x concern.
- **Don't conflate v5.0 with the recommender.** v5.0 is *audit-driven discovery polish*. The recommender (SEED-002) is a separate, larger effort with its own onboarding (SEED-003). Keep them in distinct milestones — the recommender wants its own RESEARCH and ARCHITECTURE phases.
- **CAT-13 is the natural anchor**, not the leader. The audit comes first. CAT-13 lands when the audit makes the case for it as a discovery improvement, not as a tech-debt cleanup. (It is tech debt, but framing it as discovery improvement makes the milestone narrative coherent.)
- **CAT-14 (`SET NOT NULL` on `watches.catalog_id`) is NOT v5.0 work.** It needs 100% backfill verified across two consecutive deploys per PROJECT.md. v5.0 may set up the precondition; the actual NOT NULL goes in v5.x or v6.0.
- **v5.0 may be the right home for SET-13 (Account → Delete/Wipe Collection)** — Danger Zone with multi-step confirm + soft-delete cron. It's adjacent territory and dovetails with the privacy/account UX surface. Decide during planning.

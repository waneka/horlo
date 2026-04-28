---
id: SEED-002
status: dormant
planted: 2026-04-27
planted_during: v4.0 / Phase 18
trigger_when: planning a recommender, "for you" feed, or any personalized discovery surface beyond raw counts/deltas
scope: large
related_phases: [Phase 18 (/explore — sets the discovery surface but uses raw rankings, no personalization), Phase 20 (/evaluate — current similarity engine), future recommender milestone]
---

# SEED-002: Three-layer hybrid recommender (CF + content + graph)

## The Idea

Build the recommender as three layers, blended with per-user learned weights:

**Layer 1 — Collaborative filtering on the user × Reference matrix.** Implicit-feedback signals weighted by intent:
- owned: `1.0`
- grail / wishlist: `0.7`
- tried-on (wear event, "worn at least once"): `0.4`
- favorited a post about it: `0.2`
- **sold (negative): `-0.3`** — distinct, valuable signal: "I had this and moved on"

Start with ALS (matrix factorization, the canonical implicit-feedback baseline). Move to a two-tower neural model once density supports it.

**Layer 2 — Content-based similarity on Reference attributes.** Embed structured attributes (and any text descriptions) → vector. Carries cold start; surfaces obscure references with no CF signal yet (critical for indies + vintage long tail).

**Layer 3 — Graph signals.**
- Lineage edges between References (predecessor / successor — see SEED-001)
- Brand co-occurrence (collectors who own X often own Y)
- Curator list membership ("References that frequently appear together in curated lists")

**Per-user blend weights**: some collectors are deep within one lineage, others eclectic. Model adapts.

**Diversity re-rank** at the end: don't show eight Submariner variants. Spread across families and price tiers to keep the rabbit hole interesting.

## Why This Matters

- **Pure CF fails at cold start.** First 6–12 months the user × Reference matrix is too sparse for CF alone to feel magical.
- **Pure content-based feels generic.** Doesn't capture the social-graph "this clicked for people whose taste is like yours" magic that defines Rdio's discovery feel.
- **Hybrid is how every successful music/discovery product solved this.** Spotify, Beats Music, Rdio all blended layers.
- **Negative signal from `sold` is rare and valuable.** Most platforms only have positive signal. Knowing "I owned it AND chose to part with it" is distinct from "I never owned it" and should pull the recommender *away* from things that pattern-match to past divestments.
- **Explainability is a differentiator.** "Recommended because 12 collectors with taste like yours own this" or "Because you have a 16610 and three others in your taste cluster moved to vintage Heuer" — Rdio didn't really do this, but it dramatically increases trust and click-through, and it makes the social-graph value legible. Every recommendation must come with a reason string.

## Current State (Phase 18 baseline)

- `analyzeSimilarity()` in `src/lib/similarity.ts` — content-based scoring against the user's collection. NOT a recommender, an evaluator. Single-watch: "does this fit your collection?"
- Phase 18 `/explore` rails are raw popularity rankings:
  - Trending: `owners_count + wishlist_count * 0.5 DESC` (global, not personalized)
  - Gaining Traction: 7-day delta on the same composite (global, not personalized)
  - Popular Collectors: most-followed (global, with viewer-aware exclusions only)
- No CF, no content embeddings, no graph signals.
- No `sold` signal captured anywhere yet.

## When to Surface

**Trigger:** When planning a milestone that proposes any of:
- A "for you" feed or personalized discovery surface
- Replacing or layering on top of `/explore`'s raw rankings with personalization
- A recommender service / scheduled job
- "References that frequently appear together" graph queries
- "Sold" / divestment tracking (see SEED-001 Provenance)

Likely milestones: v5.0+, after social graph density crosses some threshold (suggested: ~1k MAU with avg 5+ interactions per user, or earlier if cold-start hybrid is the launch story).

## Scope Estimate

**Large** — multi-phase milestone. Components:
- Signal extraction layer (events → weighted user × Reference matrix)
- Offline training pipeline (ALS first, then maybe two-tower)
- Content embedding service (over structured attributes from SEED-001)
- Graph-edge derivation (lineage from SEED-001, co-occurrence, curator list membership)
- Re-ranker with diversity constraints
- Reason-string generator (the explainability layer)
- Online serving + caching
- Eval harness (offline NDCG / precision@K, online A/B on dwell + follow + add-to-collection)

## Editorial Bootstrap (cold start)

> "In the first 6–12 months, before the user graph is dense enough for CF to shine, lean hard on editorial curation. Hire or partner with 10–20 respected collectors as launch curators. Their lists become the discovery substrate while the collaborative graph builds underneath. This is exactly how Rdio, Spotify, and Beats Music all bootstrapped — algorithm follows curation, never the other way around."

Implication for Phase 18 and earlier: Popular Collectors rail is a *raw popularity* signal today. Editorial curation (DISC-09, deferred to v4.x) is part of the cold-start story for the recommender, not a separate concern.

## Breadcrumbs

- `src/lib/similarity.ts` — current content-based evaluator (will inform Layer 2 attribute embedding)
- `src/db/schema.ts` `wearEvents`, `watches.status` (owned/wishlist), `watchesCatalog.ownersCount/wishlistCount` — signal sources today
- `src/data/follows.ts`, `src/data/profiles.ts` — social graph reads
- `.planning/REQUIREMENTS.md` DISC-09 — Editorial featured collector slot (deferred v4.x)
- `.planning/phases/18-explore-discovery-surface/18-CONTEXT.md` Deferred Ideas — DISC-10 (Trending feed widening) lives in this seed's territory

## Notes

- **Reference granularity is a hard prerequisite.** SEED-001 should ship before the recommender goes live — otherwise the user × item matrix is at the wrong level and CF quality degrades.
- **The `sold` negative signal can't be retrofitted from current data** — Phase 17 `wishlistDate` and current `watches.status` enum (`'owned' | 'wishlist'`) don't track transitions. Adding a `sold` status (or a `divestments` table) is a precondition for the negative-signal dimension and should land before the recommender milestone, ideally as part of the catalog hierarchy work in SEED-001.
- **Explainability constraint should shape the data model.** Every reason string needs structured precursors: "12 collectors with taste like yours" requires storing taste-cluster membership; "your 16610 and three others in your cluster moved to vintage Heuer" requires storing transitions. Plan the event log accordingly.
- **/explore Phase 18 is compatible.** Today's raw popularity rails coexist fine with a future personalized feed — the personalized surface is additive (likely a new `/feed` or a "For you" tab on `/explore`), not a replacement.

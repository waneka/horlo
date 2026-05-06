---
title: Premium Features Audit & Decision Map
status: decided
date: 2026-05-06
audit_seed: SEED-006
session: /gsd-explore (post-v4.1 close, pre-v5.0 start)
decision: No paywall in v5.0; build Horlo as fully free; revisit monetization post-recommender
---

# Premium Features Audit — Horlo

## TL;DR

**No paywall in v5.0.** Continue building Horlo as a fully free product. Defer monetization to a post-recommender milestone — earliest realistic ship is v6.0+, and only if a defensible wedge has emerged. SEED-002 hybrid recommender is the leading future paid-surface candidate, but it is not ready and should not be built under monetization pressure.

This document is the output the SEED-006 trigger requested. The seed is now resolved.

## Context

Run as a `/gsd-explore` session between v4.1 close (2026-05-05) and v5.0 (Discovery North Star) scoping. Triggered by SEED-006, which flagged the need to map paid-vs-free *before* v5.0 (discovery) and v6.0 (market value) lock scope — because gating decisions reshape both milestones' surfaces.

## Persona Considered

| Attribute | Value |
|---|---|
| Profile | Engaged collector |
| Collection size | 5+ watches owned |
| Collection value | $5k+ |
| App tenure | 30+ days active |
| Identity | Treats collection as part of self-identity |
| Spend posture | Comfortable spending on the hobby |
| Target price | ~$8/mo or $72/yr |

## Features Evaluated

### Final classification

| # | Feature | Initial position | Final classification | Reasoning |
|---|---|---|---|---|
| F1 | Taste profile & advanced collection insights | Paid (deepen) | **Free** | Horlo's core differentiator. Seed warning: *"Don't gate the differentiator."* Free engine + free meta-analysis is the wedge of the whole product. |
| F2 | Collection valuation & portfolio analytics | Paid (unlock) | **Free / commodity** | Watch Charts gives portfolio + total value + per-watch P&L + value-over-time + weekly emails for FREE. Charging here is a competitive non-starter. |
| F3 | Wishlist intelligence & price alerts | Paid (unlock) | **Free or commodity** | Watch Charts has freemium alerts (8 free with delay, unlimited paid at $160/yr Enthusiast). Hard ceiling on what Horlo could charge. |
| F4 | Sale history & provenance archive | Paid (unlock) | **Free** | Horlo-native, identity-tied, would have been a real wedge — but with no paywall in v5.0, ship as part of the free product. |
| F5 | Data export & insurance reports | Paid (unlock) | **Free** | Same: previously a wedge candidate, now part of the free product. |
| F6 | Collection size cap (free 10, paid unlimited) | Paid (unlock — maybe) | **No cap** | "Free is broken so you'll pay" anti-pattern. Watch Charts has unlimited free; capping at 10 looks user-hostile. |
| R1 | Personalized recommender (SEED-002) | Not in original list | **Future paid wedge candidate (deferred)** | Strongest *eventual* paid surface: real compute cost, Horlo-native, value scales with collection depth, explainability is a hard differentiator. Prereqs unmet (SEED-001 catalog hierarchy, sold-signal schema, density / editorial bootstrap). Earliest realistic ship: v6.0+. |

### Why F1 (taste profile) is free

Horlo's positioning ("taste-aware watch collection intelligence") puts the verdict labels (Core Fit / Role Duplicate / Hard Mismatch) and the FIT-05 pairwise drill-down at the center of the differentiation. Gating any of those demotes Horlo to "watch Letterboxd with a verdict feature locked behind paywall." The seed's strongest warning was explicit: *"Don't gate the differentiator."*

### Why F2/F3 (valuation & alerts) cannot be the wedge

Research conducted mid-session against Watch Charts (citations below):

- **Free Watch Charts account** creates two default portfolios with **unlimited watches**, purchase date, cost basis.
- **Total collection value** displayed on portfolio, with **weekly email updates**.
- **Per-watch P&L** computed from user-entered cost basis vs. current market value.
- **Value-over-time** shown at portfolio level (depth of historical chart possibly gated by 2yr/5yr premium tiers).
- Premium ($160/yr Enthusiast, $800/yr Professional) gates **deeper price history, advanced analytics, unlimited site access, instant unlimited alerts** — *not* core portfolio valuation.
- **Alerts**: free = 8 with delayed delivery, paid = unlimited with instant delivery.

Conclusion: charging $8/mo for valuation against a free competitor that does it better is a non-starter. The persona ($5k+ collection, identity-tied) almost certainly knows about Watch Charts and may already have an Enthusiast subscription there.

### Why F4/F5 (provenance & export) survive but ship free

Both are genuinely Horlo-native — Watch Charts cannot replicate provenance ("collector's diary that compounds in value over time" with photos, sold-watch history, narrative notes) or insurance-grade exports. Both would have been viable paid features.

But: **provenance + export + capped alerts alone is too thin a tier to justify $8/mo.** The persona looks at it and asks "is that all?" Better to ship them free as part of an excellent product than gate them and fail to convert.

### Why F6 (collection cap) is rejected outright

The seed flagged this anti-pattern explicitly: *"'Free is broken so you'll pay' is the worst pattern."* Watch Charts has unlimited free portfolio. A 10-watch cap on Horlo free-tier looks user-hostile by direct comparison and would cap the persona (5+ watches and growing) just as they're starting to invest in the product.

### Why R1 (recommender) is the *future* candidate, not current

SEED-002's hybrid recommender is the strongest paid wedge in principle:

- **Genuinely Horlo-native** — Watch Charts can't replicate it (no collection, no taste cluster, no social graph, no sold-signal).
- **Real compute cost** (offline training + embeddings + serving + cache) defends pricing.
- **Value scales with collection depth** — matches the persona profile exactly.
- **Explainability is a differentiator** ("recommended because 12 collectors with taste like yours own this").

But the recommender has unmet prerequisites:

| Prerequisite | State |
|---|---|
| SEED-001 catalog hierarchy + Reference granularity | Not shipped (CAT-13 is the v5.0 anchor; this is the *start* of the work, not the end) |
| `sold` negative signal in data model | Not shipped — `watches.status` is `'owned' \| 'wishlist'` only; no transitions, no `divestments` table |
| Cold-start density (~1k MAU × 5+ interactions, OR 6–12mo editorial bootstrap) | Neither — DISC-09 editorial curation deferred from v4.x |
| Reason-string scaffolding (taste-cluster membership, transition events) | Not yet baked into data model |

**Earliest realistic ship: v6.0 or v7.0.** Decision recorded here so that v5.0 lays groundwork (catalog hierarchy, sold-signal schema, editorial curator program, density growth) without monetization shaping any of those decisions.

## The Decision

**Horlo will not ship a paid tier in v5.0.**

The product continues to be built as fully free, with monetization revisited only when:

1. The recommender (SEED-002) reaches a serviceable state, AND
2. There is concrete evidence of a defensible wedge that justifies paid in the persona's eyes.

Until both conditions hold, no Subscription / Plan tab is added to `/settings`, no Stripe wiring lands, no feature is built with a paid-vs-free fork in mind.

## Reasoning Trail

1. **Keep momentum on "as useful as possible."** v5.0 Discovery North Star is the wrong moment to fork attention onto monetization mechanics.
2. **Watch Charts research nuked F2/F3 as wedge candidates.** Charging for commodity features against a free competitor doing them better is a losing position.
3. **Provenance + export alone is too thin.** A $3–5/mo "collector tools" tier is feasible but probably won't convert at scale and risks signaling that Horlo is a side project.
4. **The strongest wedge isn't ready.** SEED-002 has multi-milestone prerequisites, none of which exist on `main`. Building it under monetization pressure (gate / tease / tier-design constraints) would compromise the product before it has a chance to be great.
5. **The seed's meta-warning applies in full:** *"Don't ship a 'subscription' surface before the audit."* The audit's output is *don't ship one yet, period.*

## Implications for Upcoming Milestones

### v5.0 — Discovery North Star
- **No paid-tier gating decisions to make.** CAT-13 + SEED-001 catalog hierarchy work proceeds without scoping pressure.
- **`/explore` rails stay fully free.** No personalized-vs-popularity gating.
- **No Subscription tab in `/settings`.** Defer.

### v6.0 — Market Value
- **No paid-tier gating decisions to make.** Total collection value, per-watch market value, value-over-time charts all ship free.
- **Pricing-API integration (SEED-005, SEED-007 spike)** sized purely on cost-coverage, not revenue.

### Post-v6.0
- Revisit monetization once recommender is serviceable and a real wedge has emerged.
- If revisited and a tier ships, expected anchor is **R1 (SEED-002 recommender)**. F4 (provenance) + F5 (export) may join the tier as ride-alongs, but they're not the wedge.

## Carve-Outs / Things to Watch

- **Operational cost defense.** If LLM-extract or external-API costs become operationally painful before paid ships, a usage cap with "support the project to remove the cap" tier might surface earlier — but that's a cost-defense decision, not a product decision, and it should be framed as such.
- **Competitive surface erosion.** If a competitor (Watch Charts, Bezel, Hodinkee Insider, Calibrator) launches a taste-aware feature that erodes the differentiator, accelerate the recommender and revisit this decision.
- **Settings / Subscription tab.** Don't add one in v5.0. Adding it implies a tier exists; it doesn't.
- **Don't accidentally pre-build paid scaffolding.** No Stripe SDK, no entitlements table, no role-based feature flags shaped by "free vs paid." Those add cognitive load and bias future decisions toward shipping a tier prematurely.

## Source Research

Conducted mid-session via `gsd-phase-researcher` on 2026-05-06.

- Watch Charts portfolios (free, unlimited): https://watchcharts.com/about/portfolios
- Watch Charts portfolios landing: https://watchcharts.com/portfolios
- Watch Charts Premium tiers ($160/yr Enthusiast, $800/yr Professional): https://watchcharts.com/subscribe
- Watch Charts Alerts (8 free with delay, unlimited paid instant): https://watchcharts.com/about/alerts
- Robb Report on WatchCharts Portfolios: https://robbreport.com/style/watch-collector/how-to-use-watch-market-data-to-inform-collecting-1235677991/

## Cross-References

- `.planning/seeds/SEED-006-premium-features-audit.md` — the seed that triggered this audit (now resolved).
- `.planning/seeds/SEED-002-hybrid-recommender.md` — the future paid-surface candidate; build free.
- `.planning/seeds/SEED-004-v5-discovery-north-star.md` — v5.0 anchor; scopes freely with no gating decisions.
- `.planning/seeds/SEED-005-v6-market-value.md` — v6.0 anchor; scopes freely with no gating decisions.
- `.planning/seeds/SEED-001-catalog-hierarchy-and-attributes.md` — prerequisite for the recommender.
- `.planning/STATE.md` — `Next action` updated to reference this document.

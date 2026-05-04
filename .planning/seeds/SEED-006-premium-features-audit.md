---
id: SEED-006
status: dormant
planted: 2026-05-03
planted_during: post-v4.0 close — milestone roadmapping conversation
trigger_when: BETWEEN v4.1 close and v5.0 start — premium-tier scoping decisions reshape v5.0 (discovery) and v6.0 (market value) before either locks
scope: medium
related_phases: [v4.1 Polish & Patch (must complete first), v5.0 Discovery North Star (informed by this), v6.0 Market Value (informed by this)]
---

# SEED-006: Premium features audit — what gates behind paid?

## The Idea

A `/gsd-explore` session that produces a paid-vs-free feature map BEFORE v5.0 (discovery) and v6.0 (market value) lock scope. Premium tier is confirmed coming; the question is which capabilities live behind it.

**Goal of the session:** A scored map of every feature shipped or planned, classified into:
- **Free (must)** — table-stakes; gating these would kill the product
- **Free (lead)** — used to demonstrate value pre-conversion
- **Paid (deepen)** — power-user surface; same feature, more depth (e.g., free shows last-30-day trending, paid shows last-180-day with per-week deltas)
- **Paid (unlock)** — entirely paid surface (e.g., bulk export, advanced insights, API access)
- **Either (decide later)** — needs more product clarity

**Output:** A `.planning/research/PREMIUM-MAP.md` file (or similar) that v5.0 + v6.0 planning consume as input.

## Why This Matters

- **Paid gating reshapes "discovery."** If paid users see deeper trends and free users see surface, the home/explore consolidation question (v5.0 Phase 1 audit) has a different answer than if everything is free. v5.0 must lock its scope KNOWING the gating decision.
- **Paid gating reshapes "market value."** v6.0's total-value chart, paid-vs-market toggle, and per-watch deltas are plausible premium surfaces — but total-value-summary likely belongs in free as a hook. The exact line moves the v6.0 scope significantly.
- **Existing /settings tabs (Account, Profile, Preferences, Privacy, Notifications, Appearance) need a "Subscription" or "Plan" tab.** That's a surface decision; doing it in isolation is a bug. Doing it after the gating audit lets the tab match the actual gating rules.
- **`/gsd-explore` is the right tool**, not `/gsd-new-milestone`. The output is a decision document, not a roadmap. The DECISION informs subsequent milestone scoping; the audit itself isn't a milestone.

## When to Surface

**Trigger:** Run AFTER v4.1 ships and BEFORE v5.0 starts.

`/gsd-explore` session with a clear brief:
> "Premium features audit. Map current and planned features into Free (must) / Free (lead) / Paid (deepen) / Paid (unlock) / Either. Output `.planning/research/PREMIUM-MAP.md` to inform v5.0 (discovery) and v6.0 (market value) scoping."

## Scope Estimate

**Medium — half-day to one day of `/gsd-explore` session.**

Inputs the session should pull in:
- All shipped features in `.planning/PROJECT.md` `## Requirements → ### Validated`
- All planned items in `.planning/PROJECT.md` `Next Milestone Goals (v5.0 candidates)`
- All seeds (SEED-001 through SEED-005)
- Competitive teardown of comparable apps' tier breakdowns: Bezel (paid), Hodinkee Insider (paid content), Watch Charts (paid analytics), TimeTrove (subscription), Calibrator
- The Rdio North Star — what's the tier model for a Rdio-style discovery surface? (Spotify-pattern: free with ads/limits, paid is no-limits + better quality)

Outputs:
- `PREMIUM-MAP.md` with classification per feature
- A "tension list" — features where the right gating is non-obvious
- Pricing-model implications: per-month vs lifetime vs freemium-with-limits
- Sequencing implications: which milestones lock to free, which lock to paid, which contain mixed surfaces

## Open Questions to Resolve in the Session

- **Total collection value (v6.0)** — free or paid? Probably free-summary, paid-detail, but document the call.
- **CAT-13 rewire (v5.0)** — by definition free, since it's an engine improvement. Confirm.
- **/explore rails (v4.0 shipped)** — currently free. Does paid get personalized rails? See SEED-002 hybrid recommender.
- **/insights** (v4.0 shipped, mostly empty) — natural premium surface candidate, but the v3.0 retire-to-profile-tab decision needs revisiting.
- **Search facets (SRCH-16, deferred)** — free baseline. Advanced facets (price range, market trends) — paid?
- **FIT-05 pairwise drill-down (deferred)** — free, since it's the core taste-aware-evaluation differentiator. Don't gate the differentiator.
- **Bulk export, API access, multiple collection workspaces** — natural paid-unlock surfaces.
- **Rate limits on URL extract / LLM-fired surfaces** — free has a daily cap; paid has higher cap. Already plausible technically.

## Breadcrumbs

- `.planning/PROJECT.md` — `Next Milestone Goals (v5.0 candidates)` and `## Requirements → ### Validated`
- `.planning/seeds/SEED-004-v5-discovery-north-star.md` — must consume this seed's output
- `.planning/seeds/SEED-005-v6-market-value.md` — must consume this seed's output
- `.planning/seeds/SEED-002-hybrid-recommender.md` — recommender is most plausible paid surface; gating decision interacts with this
- `src/app/settings/` — the surface where a "Subscription" tab will land
- `src/proxy.ts` — auth gate; subscription enforcement layer would mount here

## Notes

- **Don't ship a "subscription" surface before the audit.** Wiring up Stripe + a Plan tab without the gating map is putting the cart before the horse.
- **Pricing-model decision is downstream of feature-gating decision.** Don't pick $X/month or $Y lifetime first; pick what's behind the wall, then price the wall.
- **Free tier must remain delightful.** "Free is broken so you'll pay" is the worst pattern. The v4.0 shipped product is the floor of free.
- **Personalization is the strongest paid hook.** SEED-002's hybrid recommender is the most defensibly-paid surface — it costs real money to run (compute + API calls) and the value scales with depth-of-collection.
- **Don't accidentally break SEED-003 onboarding by gating it.** Onboarding is acquisition; gating onboarding hurts conversion. The recommender ITSELF can be paid; the onboarding step that bootstraps it must be free.
- **This seed expires after v5.0 starts.** If v5.0 begins without a PREMIUM-MAP.md, it's running in the dark. Don't let that happen.

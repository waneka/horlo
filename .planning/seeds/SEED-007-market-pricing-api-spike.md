---
id: SEED-007
status: dormant
planted: 2026-05-03
planted_during: post-v4.0 close — milestone roadmapping conversation
trigger_when: BETWEEN v5.0 close and v6.0 start — short spike that compares external pricing API options before v6.0 locks scope
scope: small
related_phases: [v6.0 Market Value (consumes the spike output)]
---

# SEED-007: Market pricing API options spike

## The Idea

A short (~30 minute) `/gsd-spike` that compares external watch market pricing data sources before v6.0 (Market Value) locks scope. The spike produces a decision document, not implementation.

**Comparison axes:**
1. **Cost** — per-month / per-call / free tier limits
2. **Rate limits** — calls/sec, calls/day, burst behavior
3. **Catalog-identity matching** — does the API expose Reference IDs Horlo can map to `watches_catalog.reference`? Or is matching free-text only?
4. **Brand coverage** — mainstream (Rolex/Omega/AP/Patek) → indies (Habring², Kurono, Lorier) → vintage (60s/70s Heuer, JLC). What's covered, what isn't?
5. **Data quality** — asking price vs transaction price vs median? P50 vs P90? How recent? How is "market value" defined?
6. **Terms of service** — caching/storage allowed? Display attribution required? Resale allowed?
7. **API stability** — versioning, deprecation history, vendor stability
8. **Integration burden** — REST/GraphQL/SDK? Auth model? Error semantics?

**Output:** `.planning/research/MARKET-PRICING-API.md` with a recommended primary source, fallback strategy for unmatched References, projected cost at expected user scale, and any blockers.

## Why This Matters

- **v6.0 scope depends entirely on the API choice.** If Watch Charts has clean Reference matching, v6.0 ships clean. If only scraping is viable, v6.0 ships smaller (manual entry + lazy market data) or shifts later.
- **Indies + vintage coverage will likely fail somewhere.** The spike must surface the gap so v6.0 plans for manual fallback up front rather than discovering it mid-build.
- **Cost projections need to feed SEED-006 premium gating decisions.** If the API costs $X/MAU, total-value display is a likely paid feature. If it's flat-rate cheap, free tier can have it.
- **Terms-of-service review prevents a `git revert` later.** Some APIs forbid storing fetched prices in your own DB; v6.0's `market_prices` table assumes storage is allowed. Check before building.

## When to Surface

**Trigger:** BETWEEN v5.0 close and v6.0 start.

`/gsd-spike` session with brief:
> "30-min spike: compare Watch Charts vs Chrono24 vs eBay sold-listings vs scraping vs manual entry as the data source for v6.0 market value features. Output a recommendation document at `.planning/research/MARKET-PRICING-API.md`."

## Scope Estimate

**Small — 30 to 90 minutes.** Mostly external research + signup-for-trial-keys + one or two test calls per source.

The spike does NOT include:
- Actual API integration code
- Schema design (that's v6.0 Phase 1)
- UI mockups for total-value display

The spike DOES include:
- A scored matrix of options
- A recommended primary source + fallback
- A cost projection (free tier vs paid tier vs scaling cost)
- Identified blockers (if any source has terms that prevent the v6.0 design)

## Sources to Compare

| Source | Initial Hypothesis |
|--------|---------------------|
| Watch Charts API | Likely best fit — purpose-built for watch market data, collector-facing brand. Cost is the unknown. |
| Chrono24 API | Largest marketplace; asking price not transaction price. May overstate value. Reference matching likely solid for mainstream, weaker for indies/vintage. |
| eBay Browse API + sold-listings | Free, but free-text matching only; significant data-cleaning burden. Sold listings = real transaction prices (good). |
| Scraping (Chrono24, eBay) | Rule out unless above are blocked. Legal risk + maintenance + IP-block risk. |
| Hodinkee, Bezel APIs | Spike confirms availability and terms. |
| Manual entry | Fallback baseline. No external dependency, but undermines v6.0 differentiation. |

## Breadcrumbs

- `.planning/seeds/SEED-005-v6-market-value.md` — primary consumer of this spike's output
- `.planning/seeds/SEED-006-premium-features-audit.md` — cost projection feeds premium gating decision
- `.planning/PROJECT.md` `Out of Scope` — current line "Automated price tracking / market integrations / deal alerts" gets promoted in v6.0

## Notes

- **Don't rabbit-hole.** 30 minutes of focused research beats 8 hours of exhaustive comparison. The spike's output is a *direction*, not a *decision*. v6.0 Phase 1 will validate the direction with real integration.
- **Get trial API keys first.** Most pricing APIs have free trials. Burning 30 minutes signing up is fine; burning 30 minutes reading marketing pages without testing is not.
- **Reference-ID matching is the make-or-break axis.** If no API exposes a Reference ID schema Horlo can map to, the integration cost is 5-10× higher. Test this for at least 3 References (one mainstream Rolex, one mid-tier Omega, one indie like Habring² or Lorier) before declaring a winner.
- **Watch Charts has historically been the top contender** in collector circles. If the spike confirms reasonable cost + Reference matching + terms allow caching, this is likely a one-source decision. The fallback path then becomes manual entry, not a second API.
- **This seed expires when v6.0 starts.** A v6.0 milestone planned without this spike's output is planned blind.

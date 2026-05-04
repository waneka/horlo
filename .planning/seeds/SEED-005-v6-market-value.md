---
id: SEED-005
status: dormant
planted: 2026-05-03
planted_during: post-v4.0 close — milestone roadmapping conversation
trigger_when: starting milestone v6.0, OR planning any market pricing integration, total collection value surface, paid-vs-market toggle, or insights chart involving prices
scope: large
related_phases: [v4.0 Phase 17 (watches_catalog as catalog identity), v4.0 Phase 19.1 (taste enrichment as parallel "fire-and-forget on catalog write" pattern)]
---

# SEED-005: v6.0 Market Value — Watch Charts integration + total-value insights

## The Idea

v6.0 brings real market pricing into the product as a first-class data dimension. Three surfaces:

1. **Total collection value** on Collection page header — sum of market price across owned watches, with a paid-vs-market toggle
2. **Paid-vs-market chart** in `/insights` — visualize the spread between what the user paid and current market value, including individual watches drifting up/down
3. **Per-watch market price on cards** — wishlist target vs market, owned paid vs market

The data layer:
- `market_prices` table keyed on `catalog_id` with `(price_usd, currency, source, fetched_at)` — one row per Reference per source per snapshot date
- Daily refresh via pg_cron (mirrors Phase 17 catalog count refresh pattern)
- Backfill on catalog row creation; lazy refetch when stale (>30 days)
- Per-user `watches.paid_price` already exists in schema (verify); ensure `purchase_currency` + `purchase_date` columns exist for paid-vs-market math

## Why This Matters

- **Watch collecting is partly a financial activity.** Even collectors who say "I'd never sell" want to know "is what I have worth what I think it's worth?" Knowing market value is table stakes for any serious collection-management tool. Hodinkee, Bezel, and Watch Charts all surface it; not having it is a credibility gap.
- **`watches_catalog` was designed for this.** Phase 17 chose canonical Reference identity partly so cross-user signals (counts, snapshots) could compose cleanly. Market price is exactly the same shape: one truth per Reference per day, not per user. The catalog table earns its keep here.
- **Paid-vs-market is the differentiated surface.** Bezel/Chrono24 surface market price alone. Showing the *spread* — and the trajectory of the spread — is a use case that taste-aware-collection apps (which know what you paid AND what you own) are uniquely positioned for.
- **Premium gating candidate.** This is plausibly a paid-tier feature. SEED-006 (premium features audit) MUST resolve before v6.0 locks scope.

## When to Surface

**Trigger:** When `/gsd-new-milestone` is run for v6.0, OR when any phase proposes market price integration / total value display / paid-vs-market UX.

**Hard prerequisites before v6.0 locks:**
1. v5.0 ships (discovery North Star established; v6.0 layers on top)
2. **Market pricing API spike** (~30 min `/gsd-spike`) — compare Watch Charts vs Chrono24 vs scraping vs manual entry on cost, rate limits, catalog-identity matching, and brand coverage. Output: a recommendation document. Run this BETWEEN v5.0 close and v6.0 start.
3. SEED-006 premium-features decision (does total value gate behind paid?)

## Scope Estimate

**Large — 2-3 weeks, external-dependency-heavy.** Likely shape:
- Phase 1: API integration + `market_prices` schema + daily refresh job (pattern matches Phase 17 catalog count refresh)
- Phase 2: Backfill + identity matching (catalog Reference → API Reference is the long-pole; brand/model/reference normalization may need work, especially for indies + vintage)
- Phase 3: Total value + per-watch market price on cards + paid-vs-market toggle
- Phase 4: `/insights` chart — paid vs market over time, biggest movers, biggest deltas
- Phase 5: Premium gating wiring (depends on SEED-006 decisions)

## API Options (capture from spike)

The spike (run before v6.0 locks) should compare at minimum:

- **Watch Charts API** — purpose-built for watch market data; collector-facing brand. Cost + rate limits + brand coverage TBD by spike. Likely best fit if pricing is reasonable.
- **Chrono24 API** — largest marketplace; "asking price" not "transaction price." May overstate value. Catalog-identity matching by reference number likely solid for mainstream brands, weaker for indies.
- **Scraping (Chrono24, eBay sold listings)** — rule it out unless API options are blocked. Legal risk + maintenance burden + IP-block risk.
- **Manual entry** — fallback only. User enters market price per watch; no automated refresh. Acceptable for MVP-of-v6.0 if APIs are blocked, but undermines the differentiation.
- **Hodinkee Insider, Bezel API** — maybe a fit; spike confirms.

**Spike output:** Decision doc with recommended primary source, fallback strategy for unmatched References, refresh cadence, and cost projection at expected user scale.

## Schema Sketch

```sql
-- Per-Reference market price; one row per (catalog_id, source, snapshot_date)
CREATE TABLE market_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES watches_catalog(id),
  source text NOT NULL,                 -- 'watch_charts', 'chrono24', 'manual', etc
  price_usd numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  snapshot_date date NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb,                        -- API-source-specific extras
  UNIQUE (catalog_id, source, snapshot_date)
);

-- Per-user purchase context (some columns may already exist)
ALTER TABLE watches ADD COLUMN IF NOT EXISTS paid_currency text;
ALTER TABLE watches ADD COLUMN IF NOT EXISTS purchase_date date;
```

Refresh strategy:
- Daily pg_cron job (mirror Phase 17 pattern) refreshes catalog Refs with >0 owners or wishlist
- Long-tail Refs (no demand signal) refresh weekly
- Lazy refetch on read if last fetched_at is >30 days

## Breadcrumbs

- `.planning/PROJECT.md` — `Out of Scope` lists "Automated price tracking / market integrations / deal alerts" as deferred; v6.0 promotes them
- `.planning/seeds/SEED-001-catalog-hierarchy-and-attributes.md` — `market_prices.catalog_id` will need to migrate to whatever Reference granularity SEED-001 lands on (Reference is the right level today)
- `.planning/phases/17-catalog-foundation/17-CONTEXT.md` — daily pg_cron count refresh is the canonical pattern for `market_prices` daily refresh
- `src/db/schema.ts` `watchesCatalog` lines 276–326 — FK target
- `.planning/RETROSPECTIVE.md` (if exists) — Phase 17 retrospective for daily-refresh pattern lessons

## Notes

- **Identity matching is the long-pole.** External APIs key on their own Reference IDs (or sometimes free-text `brand model reference`). Catalog rows are keyed on normalized `(brand, model, reference)`. The matching layer needs deterministic mapping where possible + manual curation for edge cases. Build a `catalog_external_refs` lookup table early.
- **Indies + vintage are where APIs fail.** Watch Charts and Chrono24 may not cover Habring², Kurono, or 1960s Heuer Carrera variants. Plan for manual fallback per Reference.
- **Currency math is a spec hazard.** Normalize to USD on ingest; display in user-preferred currency. `paid_currency` + FX-rate-on-purchase-date is needed to do this correctly.
- **"Market price" is fuzzy.** Asking price, transaction price, median, P50/P90 — all different numbers. The API spike must surface what each source provides. Display copy should match the underlying definition (e.g., "Average asking price" not just "Market price").
- **Don't conflate market value with insurance value.** The latter wants replacement cost (often higher); the former wants liquidation value. v6.0 ships market value. Insurance-value support could be v6.x or never.
- **Cron / scheduled job risk.** Phase 17 already taught the SECDEF pattern. v6.0's daily refresh job will hit external APIs and must handle rate limits + retries + circuit breakers. Don't ship without per-source backoff.
- **Premium gating is a possibility, not a given.** If SEED-006 says "free tier shows count of watches with market value below paid; paid tier shows the chart and per-watch deltas," that's reasonable. But total-collection-value is so foundational it likely lands in free tier with paid layering on detail.

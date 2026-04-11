---
dimension: features
generated: 2026-04-11
---
# Features Research

## Summary

Personal watch collection apps that succeed (Klokker, Watchee, Chrono24's collection tool, iCollect Everything) share a core loop: catalog → wear → reflect → decide. The market has converged on cost-per-wear and rotation neglect alerts as the most-cited differentiators in wear tracking, while wishlist intelligence is largely underdeveloped — most apps stop at "save for later" without opinion. Horlo's taste-aware scoring engine puts it in a strong position to offer wishlist intelligence that competitors cannot: not just "what is this watch worth" but "does this watch fit your taste."

---

## Table Stakes

Features users expect from any personal collection app. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Collection CRUD with image | Every competitor has it; bare minimum of a "catalog" | Low | Already built |
| Status model (owned / wishlist / sold) | Mental model collectors use; maps to physical reality | Low | Already built |
| Filter by status / style / role | Navigation without it is unusable past ~10 items | Low | Already built |
| Watch detail view with key specs | Users must be able to see what they entered | Low | Already built |
| Wear logging ("wore today") | Any rotation-aware app must record this | Low | Already built; needs surfacing |
| "Last worn X days ago" in detail view | Collectors want to know if a watch is being neglected; wardrobe apps (Stylebook, Whering) all surface this | Low | Not yet surfaced in UI |
| Mobile-responsive layout | Most watch browsing happens on phone; not having it is a dealbreaker for daily use | Med | Active work item |
| Dark mode | Standard expectation for any enthusiast/hobby app; Watchicity, Clockwork both have it | Low | Active work item |
| Data persistence across devices | Users panic when data is browser-local; Klokker's "secure online backup" is a selling point | High | Requires auth + cloud milestone |
| Per-user data isolation | Required once multi-user auth exists; users must not see each other's collections | Med | Architectural — part of auth milestone |

---

## Differentiators

Features that set Horlo apart. Not universally expected, but high value when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Taste-aware similarity scoring with semantic labels | No competitor goes beyond raw specs; "Core Fit vs Role Duplicate" is meaningful collector language | High | Already built; `complicationExceptions` and `collectionGoal` are dead weight until wired up |
| Fix `complicationExceptions` in scoring | Turns a stored preference into an actual opinion; without this, the engine ignores user-declared exceptions | Low | Fix: apply exceptions before penalty is calculated in `similarity.ts` |
| Fix `collectionGoal` in scoring + insights | "Balanced collector" vs "specialist" should change how the engine penalizes overlap; currently ignored | Med | Fix: branch scoring thresholds on `collectionGoal` value |
| Wishlist "good deal" flag (manual) | Lets user mark a wishlist item as actionable / deal-tier; Chrono24's renamed Notepad→Wishlist shows demand for this | Low | Simple boolean field + visual treatment in wishlist card |
| Target price workflow | User sets a price they'd pay; displayed next to wishlist item as a decision anchor; Whisprice-style model applied to non-automated context | Low | Add `targetPrice` field to `Watch`; display vs market price |
| Wishlist gap-fill score | Use existing similarity engine to rank wishlist items by how much they'd add to the collection — differentiates from generic wishlisting | Med | Reuse `analyzeSimilarity()` on wishlist items against owned collection |
| Wear rotation insights ("Neglected" flag) | Klokker's "Sleeping Beauties" / "Neglect Alerts" are the most-cited feature in collector forums; surface watches not worn in configurable threshold | Low | Calculate `daysSinceWorn` from `lastWornDate`; flag at 30/60/90 days |
| Cost-per-wear display | Klokker and Watchee both show this; divides purchase price by wear count; changes how collectors think about value | Low | `purchasePrice / wearCount`; requires `purchasePrice` and `wearCount` fields |
| Collection balance visualization | Breakdown of owned collection by style, role, dial color already computed; displaying it as charts (donut/bar) makes it scannable | Med | Existing balance data in insights; needs chart components (e.g. Recharts) |
| Preference-aware gap analysis | "You own 4 dress watches and 0 field watches — your stated preference includes field" — only possible because preferences are explicit | Med | Derived from balance data + `UserPreferences`; no competitor has this |
| Collection goal influence on insights | If `collectionGoal === 'specialist'`, surface different insights than `'balanced'` | Low | Depends on `collectionGoal` fix |

---

## Anti-Features

Things to explicitly not build in the current roadmap phase.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Automated price tracking / market data pull | Requires external API (Chrono24 scraping is ToS-hostile; WatchCharts API is paid and adds significant infra); not core to taste-aware positioning | Manual "target price" field is sufficient for now; note as future milestone |
| Price alert push notifications | Requires automated price tracking (above) + notification infrastructure (email/push); two large dependencies for an unvalidated need | Re-evaluate after cloud persistence and auth are stable |
| Social / public collections | PROJECT.md explicitly out of scope; adds moderation complexity and dilutes personal-first value | Stay personal-first; sharing as future milestone post auth |
| AI recommendation ("best next watch") | Tempting but requires a larger training context than Horlo currently has per user; would produce mediocre output with small collections | Existing similarity engine + gap analysis gives directional guidance without overpromising |
| Community forums / comments | Zero infrastructure for this; adds moderation and community management burden; not the product | None needed in this roadmap |
| Barcode / case-back scanning | iCollect Everything has it; adds camera permissions, OCR infra; marginal value for mechanical watch collectors who know their references | URL import pipeline is the correct answer for Horlo |
| Per-notification granularity settings | Full notification preference center is over-engineered at this stage; Horlo has no notifications yet | Simple global toggle when notifications are added; expand later |
| Collection sharing / export to others | Out of scope per PROJECT.md until multi-user is established | Defer |

---

## UX Patterns Worth Stealing

Specific patterns from comparable apps that are well-regarded and applicable to Horlo.

### From Klokker
- **"Sleeping Beauties" neglect framing** — Don't say "hasn't been worn in 60 days." Say "Sleeping Beauty" or "Neglected." Collector language that creates gentle urgency without being accusatory. Easy to implement as a label variant alongside the days count.
- **Rotation profile label** — "The Faithful" (wears same watches repeatedly) vs "Active Enthusiast" (rotates broadly). A single derived label from wear data that feels like a personality insight rather than a stat. Low complexity, high delight.
- **Mixed carousel of favorites + pillars + unworn** — Home screen surfaces the right watch at the right moment rather than dumping the full grid. Horlo's insights panel could adopt this pattern.

### From Watchee
- **"Wear Today" tap → immediate feedback** — The wear action is on the detail view, one tap, with immediate cost-per-wear update. Makes the act of logging feel rewarding rather than administrative.
- **Cost-per-wear as a sell signal** — When cost-per-wear is high (expensive watch, rarely worn), Watchee surfaces "consider selling." Actionable insight rather than raw data. Horlo could do the same from the wear insight panel.

### From Chrono24's collection tool
- **Wishlist renamed from "Notepad" → "Wishlist"** — The naming change alone signals intent. Horlo's wishlist view should use decisive language: "Watching" → "On My Radar" or "Wishlist" is fine; avoid vague terms.
- **Market value shown inline on wishlist** — Even without automated tracking, displaying the user's manually-entered `targetPrice` next to the watch on the wishlist card creates a decision context at a glance.

### From wardrobe apps (Stylebook, Whering, Klokker)
- **Cost-per-wear encourages reflection, not just cataloging** — Every app that adds this metric reports that users start making different decisions (more wear, reconsider purchases, surface sells). It turns a catalog into a tool.
- **"Haven't worn in X days" as primary surface, not buried stat** — Wardrobe apps put this prominently in the item detail header, not in an analytics tab. Horlo should surface `daysSinceWorn` in the watch detail view header, not just the insights panel.

### From universal wishlist apps (Whisprice, Moonsift)
- **Target price as an anchor, not a tracker** — Users set a price they'd pay; the app holds them to it. No automation needed. The discipline is in having stated the number. Horlo can implement this as a simple field with display treatment ("Your target: $2,400") — it reframes the wishlist from aspiration to decision.

### General collection management UX
- **Treemap or donut for collection balance** — More scannable than a table of numbers. A donut chart for "Style breakdown" (Dress 40%, Sport 30%, Casual 30%) communicates the distribution in one glance. Recharts or Nivo are the standard React choices.
- **Empty states that teach** — When a filter returns zero results, or the wishlist is empty, the empty state should explain what the section is for. First-time users abandon apps that return blank screens.

---

## Feature Dependencies

```
Auth + cloud persistence
  ← required by: per-user preferences, data isolation, cross-device sync

complicationExceptions fix
  ← blocks: similarity engine returning accurate results for users with exceptions set

collectionGoal fix
  ← blocks: collection goal influence on insights, preference-aware gap analysis

wear logging (already built)
  ← enables: "last worn X days ago", neglect flag, cost-per-wear, rotation profile label

purchasePrice field (add to Watch type)
  ← enables: cost-per-wear calculation

targetPrice field (add to Watch type)
  ← enables: target price workflow on wishlist cards

collection balance data (already computed)
  ← enables: collection balance visualization (charts)

similarity engine (already built)
  ← enables: wishlist gap-fill score (reuse on wishlist vs owned)
```

---

## MVP Recommendation for Active Roadmap

**Prioritize in this order:**

1. Fix `complicationExceptions` and `collectionGoal` — low effort, eliminates dead code, makes the scoring engine actually respect user preferences. Users who set these fields are the most engaged users.
2. Wear tracking insights — surface `daysSinceWorn` in detail view and insights panel. Add neglect flag at 60-day threshold. Low complexity, high daily engagement value.
3. Wishlist intelligence — add `targetPrice` field, "good deal" boolean, and display both on wishlist cards. Reuse similarity engine to show gap-fill score on wishlist items.
4. Collection balance visualization — add a donut/bar chart to the insights panel for style and role distribution. Recharts is already a common dep in the ecosystem; low integration cost.
5. Auth + cloud persistence — highest complexity; blocks cross-device use and multi-user. Sequence after the feature completeness work so the data model is stable before migrating.

**Defer with rationale:**
- Cost-per-wear: Requires `purchasePrice` and `wearCount` fields not yet in the Watch type. Good candidate for the milestone after auth is complete.
- Rotation profile label ("The Faithful" etc.): Delightful but needs several weeks of wear data to be meaningful. Better in a post-auth milestone when data persists.
- Automated price tracking: Out of scope per PROJECT.md. Do not build.

# Phase 39: Audit-Driven Discovery Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 39-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 39-Audit-Driven Discovery Polish
**Areas discussed:** Scope appetite / partition, DISC-09 Editorial slot shape, Fresh-account verdict (NSV-06/20), Lineage browse UI (NSV-02/16)

---

## Scope appetite / partition

### Q1 — How should Phase 39's scope be partitioned?

| Option | Description | Selected |
|--------|-------------|----------|
| Single mega-phase (everything) | One Phase 39 covering all Q3 items + DISC-09 + Q2 lineage UI. Largest plan, single context. Risks: 10+ plans, scope drift. | |
| Split 39a (cheap) + 39b (heavy) | Phase 39a: cheap text→Link patches + DISC-09 + 404 fallback. Phase 39b: heavier UX. Recommended for momentum + observe-then-decide. | ✓ |
| Single phase, descope heaviest | One Phase 39, push NSV-18 + lineage UI to v5.x. | |
| Cheap-only Phase 39, defer everything else | Phase 39 = just NSV-01/15/08 + DISC-09 + NSV-12. Everything else gets its own phase or v5.x. | |

**User's choice:** Split 39a (cheap) + 39b (heavy)
**Notes:** Recommended option taken as-is.

### Q2 — How should the 39a/39b split be expressed structurally?

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate phases: 39 + 39b | Insert Phase 39b in ROADMAP. Mirrors Phase 33 → 33b pattern. | ✓ |
| One phase, two waves | Keep ROADMAP at Phase 39 only; structure as Wave 1 + Wave 2 internally. | |
| Phase 39 = cheap only; 39b is a new milestone item | Heaviest formal separation — 39b not pre-committed to v5.0. | |

**User's choice:** Two separate phases: 39 + 39b
**Notes:** Recommended option taken as-is.

### Q3 — Phase 39 items (cheap-patch phase)?

| Option | Description | Selected |
|--------|-------------|----------|
| NSV-01 + NSV-15 mostSimilar Link wraps | Single-component text→Link patch on CollectionFitCard. | ✓ |
| NSV-08 Insights Link wraps | Insights Link wraps; verify-before-patch needed since SleepingBeauties already wraps. | ✓ |
| DISC-09 Editorial Featured Collection slot | New /explore slot. (Subsequently DROPPED in Area 2 reframe.) | (initially ✓, dropped) |
| NSV-12 common-ground 404 → walk-back fallback | Soft fallback page replacing notFound() at no-overlap branch. | ✓ |

**User's choice:** All four selected. DISC-09 subsequently dropped after Area 2 reframe.

### Q4 — Phase 39b items (heavier UX phase)?

| Option | Description | Selected |
|--------|-------------|----------|
| NSV-06 + NSV-20 fresh-account verdict reshape | Post-CAT-13 verdict on /watch + /catalog when collection empty. | ✓ |
| NSV-14 Collector Profile 8-row sub-cluster | LockedTabCard CTAs, WornCalendar onClick, StatsTabContent Link wraps. | ✓ |
| NSV-18 catalog other-owners roster | "X collectors own this" on /catalog/{id}. Aggregation query work. | ✓ |

**User's choice:** All three selected. Lineage UI (NSV-02/16) routing resolved in Area 4.

---

## DISC-09 Editorial slot shape

### Q1 — Entity that gets featured

| Option | Description | Selected |
|--------|-------------|----------|
| Catalog reference | Click-through to /catalog/{id} (existing surface). | ✓ (later superseded) |
| Family | Click-through to /family/{id} (doesn't exist yet). | |
| Collector | Click-through to /u/{username}/collection. | |
| Mixed / curator's choice | Discriminated union accepting all three. | |

**User's choice:** Catalog reference. **Later superseded by Q5 reframe.**

### Q2 — Admin write surface

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded constant in code | Edit file + redeploy. Zero new schema. | ✓ (later superseded) |
| DB-backed `featured_collection` table | New Drizzle table + RLS + admin route. | |
| Settings page section + DB row | Admin UI inside /settings#account. | |

**User's choice:** Hardcoded constant. **Later superseded.**

### Q3 — Placement on /explore

| Option | Description | Selected |
|--------|-------------|----------|
| Top — above hero / above first rail | Editorial = most prominent placement. | ✓ (later superseded) |
| Between PopularCollectors and TrendingWatches | Mid-page; less prominent. | |
| Bottom — below all three existing rails | Least disruptive; lowest discovery probability. | |

**User's choice:** Top. **Later superseded.**

### Q4 — Card visual shape (REJECTED — user stepped back)

User declined to answer this question and stepped back to ask "we're talking about content that lives on the explore page right?" then asked for an overview of /explore + planned work. After review, user wrote a comprehensive 5-module Explore Page spec inline in the conversation.

### Q5 — Reframe — How to handle the new 5-module Explore spec?

| Option | Description | Selected |
|--------|-------------|----------|
| Reorganize milestone | Absorb the redesign into v5.0. Phase 39 = cheap patches + NSV-12 only (no DISC-09). New phases inserted. v5.0 ships ~2-4 weeks later. | |
| Defer redesign to v5.1 | Keep v5.0 as scoped. DROP DISC-09 entirely. Spec becomes v5.1 milestone. v5.0 ships on schedule. | ✓ |
| Ship hardcoded Hero seed in Phase 39 + commit rest to v5.x | DISC-09 still ships as hardcoded ref; spec gets v5.x track. | |
| Status quo | Ignore the spec; ship original DISC-09 scope. | |

**User's choice:** Option 2 — defer to v5.1.
**Notes:** User said "option 2 is what i want. this can be re-structured as 5.1." Spec captured at `.planning/seeds/SEED-008-v5.1-explore-redesign.md`. DISC-09 dropped from Phase 39 entirely; Phase 39 = 3 items now (NSV-01+15, NSV-08, NSV-12).

---

## Fresh-account verdict (NSV-06/20)

### Q1 — What does a fresh-account viewer see?

| Option | Description | Selected |
|--------|-------------|----------|
| Reference Identity card + CTAs | New pure-taste card (no fit-judgment) + existing Add-to-Wishlist/Collection/Skip CTAs. | ✓ |
| Engine fallback verdict ("Perfect fit, first watch!") | Surface existing engine fallback via CollectionFitCard. Cheapest but copy is wrong for /catalog browse. | |
| CTA-only card ("Start your collection") | Suppress verdict; show CTAs + onboarding caption only. | |
| Two-card stack | Reference Identity card + CTA card separated. | |

**User's choice:** Reference Identity card + CTAs.

### Q2 — Reference Identity card content

| Option | Description | Selected |
|--------|-------------|----------|
| All 6 fields, structured | Era + archetype headline; formality/sportiness/heritage sparkline-pills; design motifs chip cluster. | ✓ |
| Minimal: era + archetype + 3 top motifs | No numeric pills. | |
| Verbose: include LLM-derived 1-line narrative | Adds prose narrative composed from taste fields. | |

**User's choice:** All 6 fields, structured.

### Q3 — Confidence < 0.5 behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Suppress card; fall back to CTA-only | Honest about data quality; matches project-wide 0.5 gate. | ✓ |
| Show with 'low confidence' label | Surfaces something; risks misleading. | |
| Show pre-CAT-13 fields only | Sidesteps confidence question; misses CAT-13 point. | |

**User's choice:** Suppress card.

### Q4 — Same component on /watch and /catalog?

| Option | Description | Selected |
|--------|-------------|----------|
| Identical on both surfaces | One component, two callsites. | ✓ |
| /catalog only — skip /watch | Defensible but cross-user framing on /watch breaks the simplification. | |
| Different copy/density per surface | Adds shipping surface. | |

**User's choice:** Identical.

---

## Lineage browse UI (NSV-02/16)

### Q1 — Where does lineage browse UI ship?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 39b (preferred per 33b Q2 verdict) | Absorbed into Phase 39b alongside other Q3 items. | ✓ |
| Defer to v5.x | Phase 39b stays focused on the 3 Q3 items; lineage gets its own post-v5.0 phase. | |
| Phase 39 — cheap path only (just /catalog inline rail) | Cheapest version sneaks into Phase 39. Violates the clean 39 vs 39b separation. | |

**User's choice:** Phase 39b.

### Q2 — Lineage UI shape

| Option | Description | Selected |
|--------|-------------|----------|
| Inline rails only — no dedicated page | "Same family" + "Lineage" rails on /watch + /catalog. No /family/{id}. Click-through to existing /catalog detail. | ✓ |
| Inline rails + /family/{familyId} page | Adds new family-anchored browse surface. | |
| Inline rails + /family/{id} + /catalog predecessor/successor section | Heaviest — multiple new surfaces. | |

**User's choice:** Inline rails only.

### Q3 — Sparse data behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hide rail if empty; partial data renders what exists | Module-absent-not-empty pattern. Graceful degradation. | ✓ |
| Always render rail with "No siblings yet" empty state | More discoverable; risks looking like permanent dead-end. | |
| Don't ship UI until 50%+ of catalog refs have family_id | Heaviest — curation gates UI. | |

**User's choice:** Hide rail if empty.

### Q4 — Curation seed pass?

| Option | Description | Selected |
|--------|-------------|----------|
| Include small seed pass in Phase 39b — ~20 families + ~15 lineage edges | Operator-author seeds during plan execution. | ✓ |
| Ship UI only — seed work is separate quick task or v5.x | Rails render mostly empty until post-ship curation. | |
| Include curation pass AND minimal admin UI | Tiny /admin/lineage route for browser-based curation. | |

**User's choice:** Include small seed pass via operator script (no admin UI).

---

## Claude's Discretion

- Phase 39 wave packaging — three Phase 39 items (NSV-01+15, NSV-08 verify-and-patch, NSV-12 fallback) can ship in 1-3 plans. Planner discretion.
- NSV-12 fallback page copy refinement — D-10 copy is a starting point; planner can refine prose during plan authoring as long as structural decision holds.
- Reference Identity card visual treatment (Phase 39b) — sparkline-pill vs horizontal bar vs concentric dot. UI-SPEC for Phase 39b shapes this.

---

## Deferred Ideas

- **v5.1 milestone — 5-module /explore redesign** per `.planning/seeds/SEED-008-v5.1-explore-redesign.md`. SUPERSEDES original DISC-09. Pre-roadmap research: CMS approach decision.
- **`/family/{familyId}` dedicated page** — deferred to v5.x or absorbed by SEED-008 v5.1 Browse the Catalog module.
- **`/catalog/{id}` explicit predecessor/successor chain visualization** — v5.x polish item.
- **Admin UI for lineage edge curation** — Phase 39b uses operator script; admin UI is v5.x.
- **NSV-41 search inline-expand fresh-account verdict** — Phase 33b marked partial med. NOT in Phase 39 or 39b. ReferenceIdentityCard COULD be reused later if leverage rerates upward.
- **All 21 med/low-leverage Phase 33b cells** — explicitly DEFERRED to v5.x per Phase 33b Q3 verdict.
- **WishlistRail drag-handle silent no-op (DISC-AUDIT-99)** — "wired-but-broken" not "missing dead-end" per Phase 33b A2. Own bugfix ticket.
- **Confidence numeric percentage display** — D-39b-02 explicitly chose no numeric percentage. Reconsider if user feedback warrants.

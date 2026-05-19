---
id: SEED-011
status: active
planted: 2026-05-19
planted_during: 2026-05-19 bug/feature triage — post-v5.1 notes review
trigger_when: starting milestone v5.2 immediately (the next milestone). Run /gsd-new-milestone for v5.2.
scope: small
related_phases: [v5.1 /search facets (FilterDrawer, FU-01 chip components), v4.0 catalog/watch detail views (/catalog/[catalogId], /watch/[id]), taste taxonomy (style tags, genre, PRIMARY_ARCHETYPES)]
---

# SEED-011: v5.2 Polish + Taxonomy

## The Idea

A small, fast milestone that clears two user-facing bugs and runs two investigation spikes before the larger v6.0 / v7.0 work begins.

### Bug — wishlist watch mislabeled "you own this"

Verbatim note: *"specifically when clicking from search, viewing a watch detail page for a watch on my wishlist says 'you own this watch' and shows a truncated version of the watch details — it shouldn't show as owned. why are there two separate views for watch details? from search vs normal watch details?"*

A watch on the user's **wishlist**, reached via the catalog route (`/catalog/[catalogId]` — the cross-user, spec-only view used from search), is labeled "you own this watch" and rendered truncated. Wishlist ≠ owned — the ownership state is read wrong. Fix the labeling/state.

### Bug — dark-mode filter chip legibility

Verbatim note: *"legibility on the filter chips on /search is poor in dark mode - text color is black"*

`/search` filter chips render black text in dark mode. Pure CSS contrast fix. Note: FU-01 (quick task `260519-ga9`) just added Brand/Era/Genre/Archetype chip groups to that drawer — the bug may be in the new chips, the inline removable chips, or the pre-existing movement/size/style chips.

### Spike — genre vs style overlap

Verbatim note: *"genre and style properties on watches have too much overlap. what is being used for what? room for consolidation? or just removing one?"*

Audit how `genre` and `style` are each consumed — `/search` filters, the taste/similarity engine, `/explore` Browse indices, watch cards — and recommend consolidate / remove one / keep both. The recommendation may spawn a follow-on consolidation; that lands in v5.2 or is deferred per the spike.

### Spike — two watch-detail views

The architecture question from the bug note: pros/cons of keeping `/catalog/[catalogId]` (cross-user, spec-only) and `/watch/[id]` (owner per-user detail) as separate views vs merging them into one detail surface that adapts to owned / wishlist / neither. **Decision only** — no merge in v5.2 unless the spike strongly favors it and it is cheap.

## Why This Matters

- Both bugs are live in prod and user-visible (the "you own this" mislabel is misleading; the dark-mode chips are unreadable).
- The genre/style overlap is a data-model smell touching search, taste, and Browse — resolving it before v6.0/v7.0 build further on that data avoids compounding the confusion.
- The two-views question recurs whenever watch-detail work happens — it will in v7.0 Watch Photos (multi-photo carousel + wear-pic surfacing) — so having the spike verdict in hand de-risks that milestone.

## When to Surface

Trigger: `/gsd-new-milestone` for v5.2 — this is the immediate next milestone.

## Open Questions

- Genre/style: real redundancy, or genuinely different consumers? The spike answers this.
- Two views: does the bug fix alone resolve the user's pain, making a merge unnecessary?
- If consolidation is recommended, does it ship in v5.2 or become its own follow-on?

## Breadcrumbs

- `/catalog/[catalogId]` route + `/watch/[id]` route — the two watch-detail surfaces.
- `CollectionFitCard` — rendered across both, plus the `/search` inline expand.
- `FilterDrawer.tsx` + the v5.1 FU-01 chip components (`BrandChips` / `EraChips` / `GenreChips` / `ArchetypeChips`) — dark-mode chip bug.
- `src/lib/taste/vocab.ts`, style tags, `PRIMARY_ARCHETYPES` — taxonomy spike.

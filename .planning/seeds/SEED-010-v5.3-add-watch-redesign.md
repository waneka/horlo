---
id: SEED-010
status: dormant
planted: 2026-05-16
planted_during: 2026-05-16 bug/feature triage review — add-watch flow rethink (notes #6 + #7)
trigger_when: starting milestone v8.0 (renumbered from v5.3 in the 2026-05-19 roadmap reshape). Search-first add depends on catalog depth — see the prerequisite note below.
scope: medium-large
renumber_note: "2026-05-19 — moved from v5.3 to v8.0. Catalog Expansion (SEED-009) is now unscheduled, so the once-hard 'v5.2 Catalog Expansion must ship first' prerequisite is under review: scope v8.0 against whatever catalog depth exists, or pair it with a catalog-growth decision."
related_phases: [SEED-009 Catalog Expansion (catalog-depth dependency — now unscheduled, under review), v5.0 add-watch flow (AddWatchFlow / PasteSection / VerdictStep / WatchForm)]
---

# SEED-010: v8.0 Add-Watch Redesign — search-first add flow

## The Idea

Rework how a user adds a watch. Today the flow is **URL-extract or a manual form**, then a 3-button `VerdictStep` (Add to Wishlist / Add to Collection / Skip) that **locks `status`** before `WatchForm`. The redesign makes it **search-first**:

1. **Search the catalog first.** The user types what they want (e.g. `"omega speedmaster"`). Exact/near matches in `watches_catalog` are shown to pick from directly.
2. **No-match → no-URL extraction.** When no exact reference match exists, the **search query itself seeds an extraction**: the user supplies reference / year / other data, and that kicks off LLM extraction — no URL required.
3. **URL extraction demoted to second tier.** Still available, but no longer the headline path.
4. **Post-search confirm screen.** Before the watch is added, the user reviews and **edits fields — including grail status** — replacing today's status-locking `VerdictStep`. (Triage note #7: today grail can only be set via the manual path; the verdict step offers only wishlist/collection, so a URL-extracted watch can never be marked grail at add time.)

## Why This Matters

- **The current flow over-indexes on URLs.** Many watches a collector wants to add have no clean product URL — vintage pieces, discontinued references, watches they already know by name. URL-first makes the common case awkward.
- **Catalog reuse.** Search-first means new watches link to existing `catalog_id` rows instead of spawning duplicates — better data, better cross-user signals (counts, lineage, market price later).
- **Field review before commit.** Triage note #7: after extraction, several fields (status incl. grail, prices, provenance) deserve a review pass before the watch lands. The redesigned confirm screen is the natural home for this.

## When to Surface

**Trigger:** `/gsd-new-milestone` for v5.3, OR any phase proposing changes to `AddWatchFlow` / `VerdictStep` / `WatchForm`.

**Hard prerequisite:** **v5.2 Catalog Expansion (SEED-009) must ship first.** Search-first add is pointless against a sparse catalog — the user searches and finds nothing, defeating the whole flow. This ordering is non-negotiable.

## Open Questions

- Search matching — exact reference match vs fuzzy brand/model match; how to rank and present near-misses.
- The no-URL extraction input — which fields are required to kick off LLM extraction (brand + model minimum? reference? year?), and how much the extractor can infer from a bare query string.
- Confirm screen — full field editor (like today's `WatchForm`) or a lighter review pass with "edit more" affordance?
- How `status` is chosen now — if `VerdictStep`'s 3-button lock is replaced, where does collection/wishlist/grail selection live on the confirm screen?
- Does `CollectionFitCard` (the fit-vs-your-collection verdict) stay in the flow, and where — pre-confirm, on the confirm screen, or post-add?
- Fate of the manual-entry path (`?manual=1`) and URL-extract path — kept as explicit fallbacks, or folded into the search-first entry point?

## Breadcrumbs

- `src/components/watch/AddWatchFlow.tsx` — flow orchestrator.
- `src/components/watch/PasteSection.tsx` — current URL-paste entry (to be demoted).
- `src/components/watch/VerdictStep.tsx` — current 3-button status-locking step (to be replaced by the confirm screen).
- `src/components/watch/WatchForm.tsx` — field editor; status is locked when arriving from `VerdictStep`, editable on the manual path. Lists all editable fields incl. grail status and Phase 37 provenance columns.
- `src/app/api/extract-watch/route.ts` — extraction endpoint; today URL-driven, must learn a no-URL/structured-input mode.
- `.planning/seeds/SEED-009-v5.2-catalog-expansion.md` — the catalog-depth prerequisite.

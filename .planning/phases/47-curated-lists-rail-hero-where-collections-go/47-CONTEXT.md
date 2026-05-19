# Phase 47: Curated Lists Rail + Hero + Where Collections Go - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the three editorial `/explore` modules that Phase 46 left as `return null`
stubs, and ship the new public routes they link to. In scope (EXPL-06 through
EXPL-09):

- **Curated Lists Rail** (`CuratedListsRail.tsx`) — a horizontally-scrollable
  rail of up to 12 published curated lists (cover, title, curator name, watch
  count, freshness indicator), with a "View all" link to `/explore/lists`.
- **Curated list detail page** `/explore/lists/[id]` — renders the list's
  markdown intro copy and per-item editorial commentary.
- **`/explore/lists`** see-all page — every published list.
- **Hero** (`HeroModule.tsx`) — one quality-gated full-bleed featured list,
  auto-selected from published lists unless a manual pin overrides it; hides
  itself entirely when no eligible content exists.
- **Where Collections Go** (`WhereCollectionsGo.tsx`) — rotating published
  collection paths (seed watch + follow-on watches, each with editorial
  rationale and a path-type label), with an "Explore all paths" link.
- **`/explore/paths`** see-all page — every published path.
- A schema change: a new `published_at` column on `curated_lists` (drives the
  rail freshness indicator).

The CMS schema, the public-read DAL (`getPublishedLists`, `getListWithItems`,
`getPublishedPaths`, `getPathWithNodes`, `getCmsSettings`), the hero-pin write
machinery, and the admin authoring tools all already exist from Phase 45. This
phase is the **public read/render side** plus the one supporting schema add.

Out of scope: any new admin/CMS authoring surface (Phase 45 owns that); the
`featured_collector` Hero format (data shape accepts it, only `featured_list`
is wired — v5.x future); computed collection paths (`source = 'computed'` —
future); any `/explore` personalization (Home's job, Phase 33b Q1 verdict).

</domain>

<decisions>
## Implementation Decisions

### Curated Lists Rail — Freshness Indicator (EXPL-06)

- **D-01:** The rail card freshness indicator is **two parts**: a small
  **"New" badge** on recently-published lists, plus a **relative timestamp**
  ("Updated 3 days ago" style) shown on **every** card. The badge draws the
  eye to fresh content; the timestamp signals every list is maintained.
- **D-02:** Add a new **nullable `published_at` timestamp column** to
  `curated_lists`. It is set the first time a draft transitions to published
  and is the single source for both the "New" badge window and the relative
  timestamp. This is a **schema change** — Drizzle schema edit in
  `src/db/schema.ts` + a new `supabase/migrations/` file. Push path: drizzle
  push for local, `supabase db push --linked` for prod (see memory note
  `project_drizzle_supabase_db_mismatch` — filename/ordering gotchas apply).
- **D-03 [note for planner]:** `setListStatus` (`src/data/curatedLists.ts`)
  currently only flips `status`. It must be extended to **stamp `published_at`
  on the first draft→published transition** (only when `published_at` is
  still null — re-publishing after an unpublish must NOT reset it). The
  migration must **backfill `published_at = created_at`** for any list that is
  already `status = 'published'`, so existing lists show a sensible date
  rather than null.

### See-All Pages & List Detail (EXPL-06, EXPL-07, EXPL-09)

- **D-04:** `/explore/lists` (the rail's "View all" target — a **new route**)
  renders a **responsive grid of every published list**, reusing the rail
  card, **plus client-side sort/filter controls** (sort by newest /
  most watches). Needs a small `'use client'` controls component layered over
  a server-rendered list set.
- **D-05:** `/explore/paths` (the "Explore all paths" target — a **new
  route**) renders **every published path grouped into sections by path-type
  label** (`Going Deeper`, `Branching Out`, `Trading Up`, `Filling a Gap` —
  the vocab already defined at `src/app/actions/cms/collectionPaths.ts:33`).
  Reuse the Where Collections Go path renderer within each section.
- **D-06:** The curated list detail page `/explore/lists/[id]` (EXPL-07)
  renders the list's **markdown intro copy at the top** (via `react-markdown`,
  the established renderer), then each list item as a **magazine-style
  editorial row** — watch image on one side, the curator's per-item
  commentary prose on the other. The row **stacks vertically on mobile**
  (image above prose). Tapping a row's watch opens `/catalog/[catalogId]`.
  Reads via `getListWithItems`.

### Hero — Selection & Rotation (EXPL-08)

- **D-07:** When **no manual pin is active**, the Hero auto-selects via
  **weekly rotation** through the quality-gated eligible pool. Derive a
  deterministic **week index** from the current date; the displayed list is
  `eligiblePool[weekIndex % pool.length]` over a **stable ordering** of the
  pool (e.g. by `published_at`, then `id`). The week index is part of the
  cache key, so the selection auto-advances weekly with **no cron**.
- **D-08:** The Hero **quality gate** (locked by roadmap success criterion #2):
  a list is eligible iff `status = 'published'` AND it has **≥ 3 items** AND a
  **non-empty cover image** AND **non-empty intro copy**. "Non-empty" is the
  full bar for intro copy — no minimum character length.
- **D-09:** A **manual pin overrides** auto-selection whenever
  `cms_settings.pinned_list_id` is set and the pin is not expired
  (`pin_expires_at` is null or in the future). If the pinned list is no longer
  eligible/published, fall back to D-07 weekly auto-select. The Hero render
  must wrap its data read in a `'use cache'` scope tagged **`explore:hero`** so
  the Phase 45 write paths (`setPinnedHero`, `clearPinnedHero`, `publishList`,
  `unpublishList`) — which already call `revalidateTag('explore:hero')` —
  propagate immediately (roadmap criterion #3).
- **D-10:** The Hero **hides entirely** (`return null`, EXPL-02) when the
  eligible pool is empty and no valid pin exists. Tap-through goes to the
  featured list's detail page `/explore/lists/[id]`. The data shape is
  `HeroFeature` — a **discriminated union on `format`**; only `featured_list`
  is implemented this phase, but the shape must accept `featured_collector`
  (SEED-008 / Phase 45 forward-compat — do not hardcode away the union).

### Where Collections Go — Layout & Rotation (EXPL-09)

- **D-11:** On **mobile** (≥ 360px), each path renders as a **numbered
  vertical stack**: seed watch then follow-ons, each with a number badge
  (1, 2, 3, 4) and its rationale below, joined by a vertical connector
  line/arrow. This is the explicitly-recommended layout for the underspecified
  360px case (STATE.md Phase 47 research flag).
- **D-12:** On **desktop**, each path renders as a **horizontal sequence**
  (seed → next → next → next) with connectors/arrows and the rationale under
  each watch.
- **D-13:** The module shows **3 paths at a time**, chosen by **weekly
  rotation** through the published paths via a week-index cache key — the
  **same mechanism as the Hero (D-07)**. No cron, fully cacheable.
- **D-14:** Each path shows its **path-type label as a chip**. Tapping any
  watch in a path opens `/catalog/[catalogId]`. Robustness note: catalog
  watches referenced by a path **cannot be deleted** (Phase 45 D-07/D-08
  `ON DELETE RESTRICT` FKs) and have no publish status, so a path node always
  resolves — `getPathNodes`' `innerJoin` is safe by construction.

### Claude's Discretion

- The "New" badge recency window (e.g. 7 vs 14 days).
- Relative-timestamp formatting style ("3 days ago" vs "May 16").
- The **week-index derivation function** (ISO week vs epoch-days ÷ 7) — must
  be deterministic and **shared by Hero (D-07) and Where Collections Go
  (D-13)**; a single shared helper is strongly preferred over two copies.
- Cache tag names + `cacheLife` windows for the rail and paths modules (the
  Hero's `explore:hero` tag is locked by D-09).
- Whether `/explore/lists` sort/filter is URL-param-backed or local component
  state.
- Responsive grid column counts; exact section ordering on `/explore/paths`.
- Whether to extract the `PATH_TYPES` vocab (currently duplicated in
  `collectionPaths.ts` and `PathEditorClient.tsx`) to a shared constant now
  that `/explore/paths` (D-05) is a third consumer.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` § "Phase 47: Curated Lists Rail + Hero + Where
  Collections Go" — phase goal, EXPL-06..09, five success criteria. Criterion
  #2 locks the Hero quality gate (≥3 watches + cover + intro copy); criterion
  #3 locks `revalidateTag('explore:hero')`; criterion #5 locks the 360px
  mobile requirement for Where Collections Go.
- `.planning/REQUIREMENTS.md` § "Explore Page (EXPL)" — EXPL-06..09 text, plus
  EXPL-02 (absent-not-empty). § "Future Requirements" tracks the
  featured-collector format and computed paths as out-of-phase.

### Product Spec
- `.planning/seeds/SEED-008-v5.1-explore-redesign.md` § "Hero", § "Curated
  Lists Rail", § "Where Collections Go" — the authoritative module specs,
  acceptance bullets, and the `HeroFeature` discriminated-union requirement.
  NOTE: SEED-008's "rotated per session" / "auto-rotates weekly" language is
  resolved by D-07/D-13 to **weekly rotation via a week-index cache key**.

### Prior Phase Context (locked decisions to respect)
- `.planning/phases/45-cms-data-model-admin-routes/45-CONTEXT.md` — the CMS
  data model, the `cms_settings` hero-pin row, the two-layer draft-leak RLS
  pattern, and the `revalidateTag('explore:hero')` write-path lock this phase
  consumes.
- `.planning/phases/46-explore-shell-browse-archetypes/46-CONTEXT.md` — the
  `/explore` 5-module shell, the responsive grid layout, EXPL-02 absent-not-
  empty contract, and the Cache Components rules (per-viewer reads stay out of
  `'use cache'` scopes).

### Code Ground Truth
- `src/db/schema.ts` — `curatedLists` (gets the new `published_at` column),
  `curatedListItems`, `collectionPaths`, `collectionPathNodes`, `cmsSettings`
  (hero-pin: `pinnedListId`, `pinExpiresAt`, `heroFormat`).
- `src/data/curatedLists.ts` — `getPublishedLists`, `getListWithItems`,
  `getListItemCount`, `setListStatus` (extended by D-03 for `published_at`).
- `src/data/collectionPaths.ts` — `getPublishedPaths`, `getPathWithNodes`,
  `getPathNodes` (catalog-joined node reader).
- `src/data/cmsSettings.ts` — `getCmsSettings`, `setPinnedHero`,
  `clearPinnedHero` (read by the Hero for the pin override).
- `src/app/explore/page.tsx` — the 5-module shell; the three stub components
  it renders get wired this phase.
- `src/components/explore/CuratedListsRail.tsx`, `HeroModule.tsx`,
  `WhereCollectionsGo.tsx` — current `return null` stubs to replace.
- `src/components/explore/DiscoveryWatchCard.tsx` — existing catalog watch
  card, a candidate for reuse in list detail / path nodes.
- `src/app/actions/cms/collectionPaths.ts` § `PATH_TYPES` (line 33) — the
  four path-type label strings used for D-05 grouping.
- `src/app/catalog/[catalogId]/` — the catalog watch detail route every
  watch tap-through targets.

### Memory Notes (read before writing the migration)
- `project_drizzle_supabase_db_mismatch` — drizzle-kit push is LOCAL ONLY;
  prod uses `supabase db push --linked`; migration filename/ordering gotchas
  apply to the new `published_at` migration (D-02).
- `feedback_ui_spec_css_chain_blind_spot` — assert the CSS chain explicitly
  on the Hero's full-bleed image and the Where Collections Go connectors;
  6-pillar checks validate tokens, not whether the chain produces the visual.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The Phase 45 public-read DAL is complete — `getPublishedLists`,
  `getListWithItems`, `getListItemCount`, `getPublishedPaths`,
  `getPathWithNodes`, `getCmsSettings`. This phase mostly **consumes** the DAL;
  the only DAL change is extending `setListStatus` for `published_at` (D-03).
- `DiscoveryWatchCard.tsx` — catalog watch card; reusable for list-detail rows
  and path nodes (audit its props against the editorial-row layout in D-06).
- `react-markdown` (`^10.1.0`, already a dependency) — renders list intro copy.
- The `cms-covers` Supabase Storage bucket already holds list cover images;
  covers double as the Hero's full-bleed image (Phase 45 D-14/D-15: stored
  as-uploaded, rendered in a fixed aspect-ratio container with `object-cover`).

### Established Patterns
- Server Components by default; `/explore` and the new index/detail pages are
  Server Components. `'use client'` only for the `/explore/lists` sort/filter
  controls (D-04).
- Cache Components (`cacheComponents: true`): per-module `'use cache'` scopes;
  the editorial modules are viewer-independent → fully cacheable. The Hero
  scope is tagged `explore:hero` (D-09).
- EXPL-02 absent-not-empty: each module / the Hero `return null` when it has
  no content — the stubs already do this.
- `/explore` is auth-gated by `src/proxy.ts`; `getCurrentUser()` runs in the
  page body OUTSIDE any cache scope (Phase 46 convention).

### Integration Points
- The three stub components (`CuratedListsRail`, `HeroModule`,
  `WhereCollectionsGo`) get real implementations — `src/app/explore/page.tsx`
  already renders them, no shell change needed.
- New routes: `/explore/lists`, `/explore/lists/[id]`, `/explore/paths`
  (only `/explore/brands|eras|genres` exist today).
- `curated_lists.published_at` ← new migration + Drizzle schema; written by
  the extended `setListStatus`.
- The Hero render reads `cms_settings` (pin) + `curated_lists` (pool) and
  hooks the `explore:hero` revalidation tag established in Phase 45.

</code_context>

<specifics>
## Specific Ideas

- The week-index rotation helper (D-07, D-13) should be **one shared utility**
  consumed by both the Hero and Where Collections Go — same deterministic week
  derivation, so the page's two rotating modules advance in lockstep.
- The list detail page (D-06) should read like a **magazine article**, not a
  card grid — intro copy sets the editorial voice, then image-and-prose rows.
  This is the "Hodinkee-but-actually-useful" intent from SEED-008.
- The freshness indicator (D-01) and the Hero are deliberately distinct
  surfaces of the same list data: the rail signals *currency*, the Hero
  signals *editorial pick*. They must not read as the same treatment twice.

</specifics>

<deferred>
## Deferred Ideas

None new from this discussion — it stayed within phase scope. Two forward-
compat items are already tracked in `.planning/REQUIREMENTS.md` § "Future
Requirements" and must NOT be built this phase:
- **`featured_collector` Hero format** — the `HeroFeature` union accepts it
  (D-10), but only `featured_list` is wired in v5.1.
- **Computed collection paths** — the `source` field supports a future
  `manual | computed` transition; v5.1 paths are all hand-curated.

### Reviewed Todos (not folded)
None — no pending todos matched this phase's scope.

</deferred>

---

*Phase: 47-curated-lists-rail-hero-where-collections-go*
*Context gathered: 2026-05-19*

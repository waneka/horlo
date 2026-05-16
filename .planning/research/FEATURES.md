# Feature Research: v5.1 Explore Page Redesign

**Domain:** Editorial / taste-driven discovery surface for a personal watch collection app
**Researched:** 2026-05-16
**Confidence:** MEDIUM — editorial and taste-media patterns are well-evidenced; watch-specific collector-path UX is lightly documented (community observation + adjacent domains)

---

## Scope Note

SEED-008 already specifies the five module shapes. This file validates, enriches, and surfaces what the spec missed — organized per module with table stakes / differentiators / anti-features discipline, then cross-cutting concerns at the end. It does NOT restate the spec.

---

## Module 1: Hero

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single prominent visual at page top | Any editorial destination sets tone with a dominant image — Pitchfork, Hodinkee, Letterboxd journal all do this | LOW | Spec says full-bleed; that's correct |
| Tap/click navigates to content | Hero that doesn't link is a dead end — violates Phase 33b dead-end audit principles | LOW | Spec has this |
| Text overlay: title + short subtitle | Bare image gives no context for what it leads to; users don't click mystery boxes | LOW | Spec implies but does not enumerate minimum fields |
| Graceful hide when no eligible content | Empty hero is worse than no hero; spec has this right | LOW | No empty-state placeholder |
| Loading skeleton | LCP matters; bare white flash before image loads reads as broken | LOW | Spec has this |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Quality-gated auto-selection | Hero always feels intentional, not random; prevents a thin 1-watch list from headlining | MEDIUM | Spec calls for minimum watch count + cover image + intro copy thresholds — all three gates are necessary |
| Manual pin with optional expiry date | Admin can spotlight a key list launch without indefinitely blocking auto-rotation | LOW | Spec has pin/clear; add an optional "expires at" date so admin doesn't need to remember to unpin |
| Curator name visible in hero | Establishes editorial voice and gives collectors a person to follow; Hodinkee's byline model | LOW | Spec omits this — add curator attribution to hero layout |
| Secondary format slot (featured collector) | Extend editorial surface beyond lists; data shape already planned | MEDIUM | Spec has discriminated union shape; don't wire it up initially but keep the slot in layout |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-rotating hero carousel (multiple slides cycling) | Feels dynamic and surfaces more content | NNG research: users see slide 1 only; rotation before reading = comprehension failure; banner blindness triggered; A/B noise introduced | Single static hero per page load — rotation happens between sessions (weekly cadence), not within a session |
| Hero personalized to viewer's collection | Seems like obvious improvement over editorial | Violates SEED-008 non-goal: two users should see roughly the same page; personalization belongs on Home | Hold editorial hero; add "Fits your collection" badge on list cards if similarity data available later |
| Countdown timer showing "refreshes in N days" | Transparency about rotation cadence | Creates pressure to return on a specific day rather than organic curiosity; exposes admin scheduling | No countdown; hero feels fresh or it doesn't |

### Spec Gaps Found

- Minimum watch count threshold not specified — recommend 3 as floor (a 1- or 2-watch list is a stub, not a curated collection)
- Cover image dimension requirements not specified — recommend 1200x630 minimum for hero full-bleed; must crop gracefully on mobile (object-fit: cover)
- Intro copy length minimum not specified — recommend 50 characters minimum (one sentence) so hero subtitle has actual content
- Curator attribution is absent from hero layout in spec — meaningful omission for editorial voice

---

## Module 2: Collector Archetypes

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Chip rail renders all archetypes without overflow on mobile | Horizontal overflow at 375px reads as broken | LOW | Spec has this; enforce with wrapping or 2-row grid, not horizontal scroll on a fixed rail |
| Tap produces non-empty results | Dead end on tap destroys trust; zero results reads as broken app | LOW | Spec mandates build-time validation |
| Archetype filter state in URL | Shareable + browser-back works | LOW | Spec has this |
| Short descriptive label per archetype | "Dive Watch Devotee" is clear; single-word chips like "Dive" lose identity context | LOW | Spec uses full descriptive names — maintain these |
| Archetype-specific header copy above results | Confirms to the user that the filter is intentional, not a generic search dump | LOW | Spec has this |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Archetype chip shows watch count | Sets expectations before tap ("Modern Sport · 18 watches" vs blank); Spotify genre tiles do this | LOW | Spec omits this — add count from catalog at build/ISR time |
| Two additional archetypes covering under-served identities | Spec has 6 + "two TBD"; Tool Watch Minimalist and Complication Hunter fill the remaining identity space | MEDIUM | See taxonomy research below |
| Archetype → curated list cross-link | "Browse Dive Watch Devotee curated lists" below results closes a dead end and connects modules | LOW | Not in spec — cheap to add |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| UGC / user-defined archetypes | Feels democratic | Requires moderation; dilutes editorial voice; naming inconsistency | Admin-only archetype config for now; revisit at 500+ users |
| Personalized archetype ordering (reorder by viewer's collection fit) | Relevant-first feels smart | Breaks non-personalization principle; two users see different chip order and can't share the rail | Static editorial order |
| Archetypes as a first-class /search filter type | Archetypes and search filters share vocabulary | Creates labeling conflicts with style/role tags | Archetypes deep-link into /search with presets but are not first-class filter types |

### Watch Collecting Archetype Taxonomy (Research-Derived)

Community evidence confirms these eight identity clusters cover the collector landscape:

1. **Vintage Enthusiast** — patina, hand-wound, pre-1980 cases
2. **Modern Sport** — ceramic bezels, in-house movements, 41-43mm
3. **Dive Watch Devotee** — 200m+ WR, rotating bezel, tool-watch ethos
4. **Dress Watch Aficionado** — sub-38mm, thin profile, leather strap
5. **Microbrand Explorer** — independent design, direct-to-consumer, community-backed
6. **Swiss Purist** — manufacture movements, Geneva Seal, finishing quality
7. **Tool Watch Minimalist** (proposed TBD #1) — one watch for everything, functional over decorative, pilot/field watch style
8. **Complication Hunter** (proposed TBD #2) — GMT, perpetual calendar, minute repeater, chronograph as primary buying driver

### Spec Gaps Found

- The two TBD archetypes need names — Tool Watch Minimalist and Complication Hunter are the recommendation
- Chip rail layout not specified for desktop — recommend 4-column grid on >=768px
- Count badge on chip not specified — strongly recommended for trust (non-empty guarantee before tap)

---

## Module 3: Curated Lists Rail

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Cover image per list card | Letterboxd evidence: visual-first browsing; cover image is the primary click attractor | LOW | Spec has this |
| List title on card | Minimum identification | LOW | Spec has this |
| Curator name on card | Attribution is editorial table stakes; Hodinkee bylines, Pitchfork bylines | LOW | Spec has this |
| Watch count on card | Sets expectation before tap | LOW | Spec has this |
| Optional 1-line description on card | Differentiates lists with similar titles | LOW | Spec has this |
| List detail page: intro copy | What is this list about and why was it assembled? Without this, list is a gallery dump | LOW | Spec has this |
| List detail page: per-item commentary | Separates editorial lists from search results; Letterboxd's per-film notes are the canonical model | MEDIUM | Spec has this — do not cut it |
| Publish / unpublish toggle | Admin must prepare lists without publishing | LOW | Spec has this |
| Zero-watch lists cannot publish | Validates list has substance before going live | LOW | Spec has this gate |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Published date visible on list card | Signals freshness; "Published 3 days ago" vs "8 months ago" affects click-through | LOW | Not in spec — add `published_at` timestamp distinct from `created_at` |
| List mood tags (2-3 short tags per list) | Fast-scan browsing: "Vintage · Sub-$5K · Tool Watches" without reading title | LOW | Not in spec; cross-links to archetype taxonomy naturally |
| Preview image strip (3 watch thumbnails) | Spotify playlist-style mosaic — taste preview without opening; stronger than cover image alone | MEDIUM | Not in spec — add if cover image alone tests as insufficient |
| "Add to wishlist" inline on list items | Converts discovery directly into intent; reuses existing wishlist infrastructure | MEDIUM | Not in spec; high value if wishlist is a core collector loop |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| UGC list submission | Community engagement | Moderation overhead; quality collapse; SEED-008 explicitly defers to 500+ users | Admin-only authoring now |
| Pure chronological rail ordering with no editorial control | Simple, fair | Most recent list might be weak; stale top lists disappear from view | Admin drag-reorder or `display_order` field |
| Infinite lists in rail | More content = more value | 12 cards is past scrolling attention; "View all" is the right pattern | Cap at 12 in rail, paginate on /explore/lists |
| Rating or vote system on lists | Community engagement signal | Creates popularity bias crowding out new lists; gaming risk | Admin curates ordering |

### Letterboxd Model — Validated Patterns

- Per-item note when adding to list (optional but editorially encouraged)
- List has title + description (Markdown-formatted) + visible curator
- Featured lists are editorially selected, not algorithmic
- Lists tagged by curator for taxonomy context

### Spec Gaps Found

- Per-item commentary is optional in spec — make it strongly encouraged in admin UX with a placeholder prompt ("Why does this watch belong on this list?")
- List ordering within the rail is not specified — add `display_order` integer field + admin reorder UI
- Published date not in data model — add `published_at` timestamp
- Mood/thematic tags not in spec — add as optional admin-authored array field

---

## Module 4: Where Collections Go

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Seed watch → follow-on watches as a visual sequence | The "path" framing must be sequential, not a grid; horizontal arrow chain is expected | MEDIUM | Spec has this |
| Tap any watch → reference detail page | No dead ends — every node must navigate | LOW | Spec has this |
| Data model: source field (manual / computed) | Required for future algorithmic layer | LOW | Spec has this |
| Deleted/unpublished reference does not break page | Defensive rendering | MEDIUM | Requires null-safe path rendering |
| "Explore all paths" link | Module doesn't feel like the full content extent | LOW | Spec has this |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Editorial rationale per path | Without the "why," this is a sequence with no insight — the insight IS the differentiator | LOW | Not in spec — add `rationale` text field to path data model |
| Path type label (Gateway, Natural Upgrade, Lateral, Deep-Dive) | Tells the user what kind of progression this represents before reading the sequence | LOW | Not in spec — cheap admin-authored label on path |
| 10 seed paths at launch | Volume matters for rotation (3 paths shown per session from the pool) | LOW | Requires editorial authoring work, not code complexity |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Algorithmic path generation from Day 1 | Scales automatically | No behavioral data yet (Phase D divestments schema just landed); algorithmic paths without signal produce noise | Hand-curate 10 seeds; data model supports computed layer later |
| Social proof stats alongside paths ("42% of users who own X own Y") | Data-backed authority | Misleading at small user count; confuses editorial with social proof | Plain editorial rationale; add social data when n > 1000 |
| Paths longer than 4 watches | Completeness | At 360px width, 4 nodes + arrows is already tight; 5+ overflow or lose visual identity | Cap at seed + 3 follow-ons per spec |

### Collector Path Research — Natural Evolution Patterns

From watch community research, the high-credibility collection evolution paths are:

1. **Rolex Submariner → Explorer / GMT-Master / Sea-Dweller** (tool watch depth after entry)
2. **Seiko Presage → Grand Seiko** (Japanese dial craft appreciation path)
3. **Omega Speedmaster → Constellation / De Ville** (dress graduation from sport)
4. **Microbrand → Swiss independent → Watchmaker ateliers** (indie collector escalation)
5. **Rolex Datejust → Patek Calatrava** (dress watch graduation)

These inform the 10 seed paths. Each needs an editorial rationale.

### Spec Gaps Found

- `rationale` text field missing from data model spec — add per-path editorial text (1-3 sentences)
- Path type label not in spec — add optional admin-authored label
- Mobile layout for path sequence not specified at 360px — recommend stacking seed + follow-ons vertically with numbered progression indicator on narrow screens

---

## Module 5: Browse the Catalog

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Brand index with counts | Any catalog surface shows "Rolex (42)" — expected pattern | LOW | Spec has this |
| Era / Genre / Price band indices | The four natural browsing facets | LOW | All four must match /search facets (SRCH-16 synergy) |
| Tap grouping → search results filtered | Navigation terminates in results, not another index page | LOW | Spec has this |
| Empty groupings hidden | Zero-count entries create confusion | LOW | Spec has this |
| Count accuracy with defined cache strategy | Stale counts destroy trust in the entire Browse surface | MEDIUM | Spec flags as open question — recommendation below |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Brand index: show representative watch image or brand logo | Visual recognition; Chrono24 uses this effectively | MEDIUM | Depends on catalog enrichment phase having brand imagery |
| Era taxonomy: both decade and named era labels | "1970s" and "Neo-Vintage" are different semantic frames; collectors use both | MEDIUM | Spec flags era taxonomy as open question |
| Alphabetical jump nav for Brand index | Standard on A-Z brand lists; essential once brand count exceeds ~20 | LOW | Not in spec |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Live count queries per page load | Exact accuracy | COUNT(*) overhead at scale; catalog grows slowly enough that live counts are unnecessary | ISR with 24h revalidation; `revalidateTag('catalog-counts')` on admin catalog mutation |
| Dynamic quantile price bands | Statistical precision | Band labels shift as catalog grows, making URLs unstable and filter presets break | Fixed editorial bands: Under $500 / $500-2K / $2K-10K / $10K-50K / $50K+ |
| More than 6 price band buckets | Granularity | Long index harder to scan than /search; at 100 watches, fine-grained quantiles are noise | 5 fixed buckets covers the meaningful collector price psychology |
| Free-text search within Browse | Utility | Browse is for index-style intent; search intent belongs in /search header | Link "looking for something specific?" to global search |

### Open Questions — Recommendations

**Era taxonomy:** Dual-mode — decade facets (1960s, 1970s...) AND named era facets (Vintage pre-1980, Neo-Vintage 1980-2000, Modern 2000-2015, Contemporary 2015+) as separate Browse dimensions. Both exist in collector vocabulary.

**Price band ranges:** Fixed editorial buckets: Under $500 / $500-2K / $2K-10K / $10K-50K / $50K+. Static bands are stable, linkable, matchable to /search filter presets.

**Cache strategy:** ISR at 24h for Browse counts. `revalidateTag('catalog-counts')` called from any catalog admin mutation. Catalog grows slowly (admin-gated); live counts are unnecessary overhead.

### Spec Gaps Found

- Alphabetical jump nav for Brand index not specified — needed once brand count exceeds ~20
- Dual-era taxonomy not specified — both decade and named-era recommended
- Price band ranges not specified — 5 fixed buckets above recommended
- Route paths not fully enumerated — confirm: `/explore/brands`, `/explore/eras`, `/explore/genres`, `/explore/price-bands`

---

## Module 6: In-App Admin CMS

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Auth-gated admin route (`/admin/*`) | Non-admin users must not reach this surface | LOW | Next.js middleware gate; check admin role in session |
| List CRUD: create / edit / delete | Basic content lifecycle | LOW | Standard Server Actions pattern already established |
| Draft vs Published states | Admin must prepare lists without publishing | LOW | `status: 'draft' | 'published'` column; no review/approval for single-author |
| Watch picker for list items | Admin must search and add catalog watches to a list | MEDIUM | Reuses `searchCatalogWatches` DAL from Phase 19 |
| Per-item commentary editor | Table stakes of editorial lists; without this, admin just assigns watches without context | LOW | Plain textarea sufficient for MVP; rich text is a differentiator |
| Publish / unpublish with zero-watch gate | Spec has this | LOW | Server Action checks `watch_count >= 1` before flipping |
| Hero pin: set / clear | Admin override of auto-rotation | LOW | Single FK on `hero_settings` table; null = auto |
| Rail display order control | Editorial control over list ordering in rail | MEDIUM | `display_order` integer + admin reorder UI (drag or up/down) |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Rich text (Markdown) for intro copy and per-item commentary | Formatting adds polish; Letterboxd uses Markdown | MEDIUM | Plain textarea ships in v5.1; Markdown upgrade is v5.x |
| Preview mode before publish | Admin sees rendered list before publishing | MEDIUM | Next.js Draft Mode (`draftMode()`) supports this pattern |
| Cover image upload (not URL) | Consistent with Supabase Storage pattern already established | MEDIUM | Reuse `catalog-source-photos` bucket from Phase 19.1 |
| Duplicate list | Start a new editorial list from an existing one | LOW | SQL INSERT SELECT with new title; useful for themed series |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-author / contributor roles | Future-proofing | Single-author for personal app; role system adds complexity with no current beneficiary | Single admin role via session check; revisit if co-curators needed |
| Scheduled publish (publish at time T) | Content calendar workflow | Over-engineered for single author publishing manually | Admin publishes manually |
| Version history / rollback | Editorial safety net | `updated_at` timestamp is sufficient; full version history is CMS complexity without collaborator need | Keep `updated_at`; no version history |
| Approval workflow / review state | Editorial rigor | Single author doesn't review their own work; adds a step with zero value | Draft → Published directly; no review state |

### Single-Author Editorial Loop

The complete authoring flow should complete in under 10 minutes for a well-formed list:

1. Create list (title, cover image, intro copy)
2. Add watches from catalog via search picker
3. Add per-item commentary per watch
4. Preview → Publish
5. Optionally pin as hero
6. Reorder rail display position

Any feature that adds steps without improving output quality is an anti-feature for a single-author workflow.

---

## Cross-Cutting Concerns

### Feature Dependencies

```
Curated Lists Rail
    └──requires──> Admin CMS (authoring)
    └──requires──> Watch picker (catalog search DAL from Phase 19)

Hero
    └──requires──> Curated Lists Rail (at least 1 published, quality-gated list)
    └──requires──> Quality-gating logic (min watch count, cover image, intro copy)

Browse the Catalog
    └──requires──> Catalog Enrichment phase (brand/era/genre fields populated)
    └──requires──> ISR or mutation-triggered cache invalidation

Collector Archetypes
    └──requires──> /search accepting archetype preset in URL query string
    └──requires──> Non-empty catalog results for each archetype filter

Where Collections Go
    └──requires──> catalog_id FK on path nodes (already in schema from v5.0 Layer C)
    └──requires──> 10 seed paths authored before launch (editorial work, not code)

All modules
    └──require──> /explore shell + responsive layout grid + nav integration
```

### Dependency Notes

- **Hero requires at least 1 published quality-gated list before it can show.** Hero and Curated Lists must be built in sequence — CMS first, then lists authored, then Hero enabled.
- **Browse requires Catalog Enrichment.** A half-enriched catalog produces misleading brand/era/genre indices. The enrichment phase must land before Browse can be validated per spec.
- **Archetypes require /search URL preset support.** Phase 40 (SRCH-16) landed faceted filters; confirm the archetype header slot was not included and needs to be added.
- **Where Collections Go requires editorial authoring.** 10 seed paths must be authored before this module can be validated — this is an editorial dependency, not a code dependency.

### Freshness / Staleness Risk by Module

The largest UX failure mode for a non-personalized editorial surface is staleness. Research confirms users abandon editorial surfaces that feel stale.

| Module | Staleness Risk | Mitigation |
|--------|---------------|------------|
| Hero | LOW if 3+ quality-gated lists in pool | Weekly auto-rotation; admin pin override |
| Curated Lists Rail | HIGH if admin doesn't publish new lists | Publish date visible on card; "View all" surfaces older content without polluting rail |
| Collector Archetypes | NONE | Hardcoded config; evergreen by definition |
| Where Collections Go | MEDIUM | 3 paths per session from 10-seed pool gives limited variety; data model supports computed paths later |
| Browse the Catalog | LOW if ISR works | Catalog grows slowly; ISR 24h sufficient |

### Complexity Summary

| Module | Overall Complexity | Bottleneck |
|--------|-------------------|------------|
| Hero | MEDIUM | Quality-gating logic + rotation cron or weekly selection |
| Collector Archetypes | LOW | URL preset format for /search + chip layout on mobile |
| Curated Lists Rail | HIGH | Admin CMS build + per-item commentary editor + list data model |
| Where Collections Go | MEDIUM | Path data model + seed content authoring + mobile layout at 360px |
| Browse the Catalog | MEDIUM | Catalog enrichment dependency + era taxonomy decision + ISR cache |
| Admin CMS | HIGH | Watch picker integration + cover image upload + publish workflow |

### Existing Infrastructure Dependencies

| Explore Feature | Existing System | Confidence |
|----------------|-----------------|------------|
| Watch picker in admin CMS | `searchCatalogWatches` DAL — Phase 19 | HIGH |
| Archetype deep-links | `/search` URL query params — Phase 40 SRCH-16 | MEDIUM (facets landed; archetype header slot not confirmed) |
| Browse catalog counts | `watches_catalog` + `brands` + `watch_families` — Layer A/B | HIGH |
| Cover image upload | Supabase Storage — `catalog-source-photos` bucket, Phase 19.1 | HIGH |
| Path nodes as catalog references | `catalog_id` FK — Layer C | HIGH |
| Wishlist action from list items | Wishlist infrastructure — existing | MEDIUM (interaction design untested in this context) |

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Page shell + nav integration | HIGH | LOW | P1 |
| Browse the Catalog — all four indices | HIGH | MEDIUM | P1 |
| Collector Archetypes chip rail | HIGH | LOW | P1 |
| Admin CMS: list CRUD + watch picker | HIGH | HIGH | P1 |
| Curated Lists Rail | HIGH | HIGH | P1 |
| Hero auto-rotation + quality gate | HIGH | MEDIUM | P1 |
| Where Collections Go — path data model + seeds | MEDIUM | MEDIUM | P1 |
| Curator name in hero | MEDIUM | LOW | P1 |
| Published date on list cards | MEDIUM | LOW | P2 |
| `display_order` + rail reorder UI | MEDIUM | MEDIUM | P2 |
| `rationale` field on paths | HIGH | LOW | P2 |
| Path type label | MEDIUM | LOW | P2 |
| Count badge on archetype chips | MEDIUM | LOW | P2 |
| Hero pin optional expiry date | LOW | LOW | P2 |
| Alphabetical jump nav for Brand index | MEDIUM | LOW | P2 |
| Mood/thematic tags on lists | LOW | LOW | P3 |
| Rich text / Markdown in CMS | LOW | MEDIUM | P3 |
| Preview mode (Draft Mode) | LOW | MEDIUM | P3 |
| "Add to wishlist" inline on list items | MEDIUM | MEDIUM | P3 |
| Brand logos in Brand index | LOW | MEDIUM | P3 |
| Duplicate list in admin CMS | LOW | LOW | P3 |

---

## Sources

- SEED-008 v5.1 Explore Page Redesign spec (primary source — this file validates and enriches)
- Letterboxd lists FAQ and featured lists explainer — per-item notes, curator attribution, featured list selection patterns
- Nielsen Norman Group — carousel usability research; single static hero over rotation
- Logical UX — rotating banner anti-pattern; static hero vs carousel engagement data
- Baymard Institute — homepage carousel UX requirements
- Hodinkee Reference Points series — editorial voice, byline attribution, collector-depth content patterns
- Watch collecting community guides (Chrono24 Magazine, Teddy Baldassarre, Von Rieste, GearPatrol, Two Broke Watch Snobs) — collector archetype taxonomy, gateway watch patterns, collection evolution paths
- Spotify Browse UX — genre/mood chip rail patterns, editorial playlist structure (mood + identity categories)
- Material Design 3 Chips guidelines — chip component patterns for archetype rail
- Next.js Draft Mode documentation — preview pattern for admin CMS
- Revolution Watch — editorial coverage driving collecting behavior
- Matt Crawford — Letterboxd lists organization patterns

---
*Feature research for: v5.1 Explore Page Redesign — editorial / taste-driven discovery surface*
*Researched: 2026-05-16*

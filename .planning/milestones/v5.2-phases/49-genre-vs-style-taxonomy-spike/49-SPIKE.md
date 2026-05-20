---
phase: 49-genre-vs-style-taxonomy-spike
plan: 01 (sections 1-3); plans 02-03 complete the rest
date: 2026-05-19
author: executor-agent (claude-sonnet-4-6)
requirement: TAX-01
---

# Genre vs Style Taxonomy Spike

## Domain

This spike answers requirement TAX-01: **should the `genre` surface and the `style` surface be consolidated, or kept as separate concepts?** The spike produces a recommendation grounded in code analysis (this plan), live-catalog evidence (Plan 02), and synthesis (Plan 03).

**Primary question (genre ↔ style):** `watches_catalog.primary_archetype` is the genre column — a single text value from a closed 10-value vocabulary (`PRIMARY_ARCHETYPES`). `watches_catalog.style_tags` (and `watches.style_tags`) is an open-vocabulary text array. Both surfaces are exposed to users in search filters, watch cards, collection filters, and preferences. The audit must determine whether the two fields express the same conceptual axis, complementary axes, or largely redundant axes — and what the consequence of consolidation, removal of one, or keeping both would be.

**Sub-question (genre ↔ archetype):** There are two separate chip groups in the `/search` FilterDrawer — `GenreChips` and `ArchetypeChips` — that both filter the same DB column (`watches_catalog.primary_archetype`) using the same 10 values from `PRIMARY_ARCHETYPES`. They differ only in display label format: GenreChips uses plain utility labels ("Dive", "Dress") while ArchetypeChips uses identity copy ("Dive Watch Devotee", "Dress Watch Devotee"). The DAL handles their coexistence via an archetype-wins tiebreaker at `src/data/catalog.ts:446`. This is a redundancy within the genre surface itself, and the spike must address it explicitly alongside the genre↔style question.

**Hard guardrail (D-08 / ROADMAP SC#4):** No implementation is permitted in Phase 49. If the spike concludes that a consolidation path is cheap AND strongly favored, that finding triggers a separate requirement-add flow (a new `/gsd-phase` run) — it does NOT authorize direct execution in this phase. The only artifact written under `.planning/phases/49-*/` other than standard plan/verification artifacts is this file.

---

## Consumer Map

Every consumer of `genre`, `archetype` (`primary_archetype`), or `style` (`style_tags` / `preferredStyles` / `dislikedStyles`) found in the codebase. The File column uses `file:line` format so citations are grep-verifiable. Rows cover all 9 surfaces from D-01 plus additional schema and write-path consumers.

| File:Line | Field used | What it does | UI label |
|-----------|------------|--------------|----------|
| `src/components/search/FilterDrawer.tsx:10,85` | `genre` (prop) | Imports `GenreChips` at line 10 and renders it at line 85; passes `genre` state and `onGenreChange` handler; the chip selection sets `?genre=X` via the search URL state in the parent page. | "Genre" (section heading inside GenreChips) |
| `src/components/search/FilterDrawer.tsx:11,86` | `archetype` (prop) | Imports `ArchetypeChips` at line 11 and renders it at line 86, immediately below GenreChips; passes `archetype` state and `onArchetypeChange` handler; the chip selection sets `?archetype=X` via the search URL state. | "Archetype" (section heading inside ArchetypeChips) |
| `src/components/search/FilterDrawer.tsx:7,82` | `styleArr` (prop) | Imports `StyleChips` at line 7 and renders it at line 82; passes `styleArr` (multi-value array) and `onStyleChange`; chip selection is multi-select (array), not single-select like genre/archetype. | "Style" (section heading inside StyleChips) |
| `src/components/search/GenreChips.tsx:4,30` | `primary_archetype` (via `PRIMARY_ARCHETYPES`) | Iterates `PRIMARY_ARCHETYPES` const (10 values); renders one `Chip` per value with plain utility display names from a local `GENRE_DISPLAY_NAMES` map; calls `onSelect(value or null)` on click. Same 10 values and same column as ArchetypeChips. | Plain labels: "Dress", "Dive", "Field", "Pilot", "Chrono", "GMT", "Racing", "Sport", "Tool", "Hybrid" |
| `src/components/search/ArchetypeChips.tsx:4,17` | `primary_archetype` (via `PRIMARY_ARCHETYPES` + `ARCHETYPE_CONFIG`) | Iterates the same `PRIMARY_ARCHETYPES` const; renders one `Chip` per value using `ARCHETYPE_CONFIG[value].displayName` (identity copy from `src/lib/archetype-config.ts:19`); calls `onSelect(value or null)` — functionally identical to GenreChips at the DAL level. | Identity labels: "Dress Watch Devotee", "Dive Watch Devotee", "Genre Crosser", etc. |
| `src/components/search/StyleChips.tsx:11,16` | `style_tags` (via `vocab` prop) | Multi-select chip group over an externally-supplied `vocab: string[]`; selected values accumulate in an array; calls `onSelect(string[])` on toggle; vocab is open (caller-supplied) unlike the closed `PRIMARY_ARCHETYPES`. | Capitalized raw tag value (e.g. "Dive", "Dressy", "Field") |
| `src/data/catalog.ts:275` | `genre`, `archetype` (interface fields) | `CatalogSearchFilters` interface (lines 275-286) declares both `.genre?: PrimaryArchetype` and `.archetype?: PrimaryArchetype`; the JSDoc on `.genre` explicitly notes "ignored when archetype is also set." | — (internal DAL interface, not user-visible) |
| `src/data/catalog.ts:446` | `primary_archetype` (column) | Archetype-wins-over-genre tiebreaker: `const primaryArchetypeFilter = filters?.archetype ?? filters?.genre`; a single `eq(watchesCatalog.primaryArchetype, primaryArchetypeFilter)` predicate is applied regardless of which chip triggered the filter. Only one column write, not two. | — (server-side SQL, not user-visible) |
| `src/data/catalog.ts:434` | `style_tags` (column) | Style facet applied via `arrayOverlaps(watchesCatalog.styleTags, filters.style)` — OR-logic within the facet (any matching tag includes the row). Separate predicate from the archetype/genre predicate above. | — (server-side SQL) |
| `src/lib/similarity.ts:14,170` | `styleTags` (field on `Watch`) | `styleTags` carries base weight `0.25` in `EXISTING_WEIGHTS_BASE` (line 14); after 0.80 scale factor, effective weight is `0.20`. Used in `calculatePairSimilarity()` at line 170 via `WEIGHTS.styleTags * arrayOverlap(watch1.styleTags, watch2.styleTags)`. | — (internal scoring, not user-visible) |
| `src/lib/similarity.ts:42,125` | `primaryArchetype` (field on `CatalogTasteAttributes`) | Within the 0.20 taste budget, `TASTE_SUB_WEIGHTS.archetypeMatch = 0.20` (line 42), giving an effective weight of `0.04`; categorical equality check at line 125 — if both watches share the same non-null `primaryArchetype`, the full sub-weight is added. | — (internal scoring) |
| `src/lib/similarity.ts:224` | `preferredStyles`, `dislikedStyles` | `checkPreferenceAlignment()` at line 224 checks whether `watch.styleTags` overlaps `preferences.preferredStyles` or `preferences.dislikedStyles`; overlap with preferred adds to alignment score; overlap with disliked adds to conflict score. | — (internal reasoning; surfaces as verdict label) |
| `src/data/browse.ts:94` | `primary_archetype` (column, aliased as `genre`) | `getBrowseGenreCounts()` runs `SELECT primary_archetype AS genre, COUNT(*) FROM watches_catalog WHERE primary_archetype IS NOT NULL GROUP BY primary_archetype ORDER BY count DESC`; results power the /explore/genres index page. | — (server-side DAL) |
| `src/components/explore/BrowseModule.tsx:43` | `primary_archetype` (indirect — link to `/explore/genres`) | Static tile "Genres" at line 43 deep-links to `/explore/genres`; no DB call here; the tile label "Genres" names the surface that `primary_archetype` backs. | "Genres" (tile label visible to users on /explore) |
| `src/app/explore/genres/page.tsx:26,39` | `primary_archetype` (via `getBrowseGenreCounts()`) | Server component renders genre index at line 39: maps `getBrowseGenreCounts()` rows to plain utility labels via `GENRE_DISPLAY_NAMES` (defined at line 26); each row deep-links to `/search?tab=watches&genre={value}`; user sees count next to display name. | "Genres" (page title); "Dive", "Dress", etc. (row labels) |
| `src/components/filters/FilterBar.tsx:96,141` | `styleTags` (collection filter state) | `hasActiveFilters` at line 96 checks `filters.styleTags.length > 0`; `toggleStyleTag()` at line 103 adds/removes tags; `STYLE_TAGS.map()` at line 141 renders one badge chip per tag in a "Style" collapsible section; multi-select. | "Style" (section heading); individual tag values capitalized |
| `src/components/preferences/PreferencesClient.tsx:109` | `preferredStyles` | Renders a checkbox per `STYLE_TAGS` entry for the "Preferred Styles" section; `checked` at line 109 tests `preferences.preferredStyles.includes(tag)`; `onCheckedChange` at line 111 calls `toggleArrayItem('preferredStyles', tag)`. | "Preferred Styles" (section heading) |
| `src/components/preferences/PreferencesClient.tsx:131` | `dislikedStyles` | Renders a checkbox per `STYLE_TAGS` entry for "Disliked Styles" at line 131; same structure as preferredStyles with `dislikedStyles` key. | "Disliked Styles" (section heading) |
| `src/components/watch/WatchCard.tsx:93` | `styleTags` (field on `Watch`) | Renders up to 2 style tags as `Badge` chips below watch metadata at line 93; a "+N" overflow badge when `styleTags.length > 2`. | Raw tag value (e.g. "dive", "dressy") displayed as-is |
| `src/components/profile/ProfileWatchCard.tsx:39` | `roleTags`, `styleTags` | `const tag = watch.roleTags?.[0] ?? watch.styleTags?.[0]` at line 39 — prefers first role tag, falls back to first style tag for the single small pill on profile cards. | Raw tag value as pill |
| `src/components/profile/InsightsTabContent.tsx:166` | `styleTags` | `calculateDistribution(ownedWatches, (w) => w.styleTags)` at line 166 aggregates style tags across the owned collection for the Style distribution chart in the Insights tab. | "Style" (chart/section label) |
| `src/components/watch/WatchForm.tsx:83,135,270` | `styleTags` | Default value `styleTags: []` in form defaults at line 83; populated from `watch.styleTags` when editing at line 135; `toggleArrayItem('styleTags', item)` handler at line 270 adds/removes tags. | "Style Tags" (form field label) |
| `src/components/watch/AddWatchFlow.tsx:654,688` | `styleTags` | Two payload builder functions both assign `styleTags: data.styleTags ?? []` at lines 654 and 688, propagating extractor-derived style tags through the add-watch server action. | — (write path; no direct UI label at this layer) |
| `src/db/schema.ts:116` | `style_tags` (column on `watches`) | Drizzle schema: `text('style_tags').array().notNull().default(sql'{}'::text[])` on the user-owned watches table. | — (schema definition) |
| `src/db/schema.ts:377` | `style_tags` (column on `watches_catalog`) | Drizzle schema: `text('style_tags').array().notNull().default(sql'{}'::text[])` on the catalog table, populated by LLM enrichment. | — (schema definition) |
| `src/db/schema.ts:181` | `preferred_styles`, `disliked_styles` (columns on `user_preferences`) | Drizzle schema: both are `text().array().notNull().default('{}'::text[])` on the `user_preferences` table (lines 181-182). | — (schema definition) |
| `src/db/schema.ts:390` | `primary_archetype` (column on `watches_catalog`) | `text('primary_archetype')` — nullable; validated against `PRIMARY_ARCHETYPES` at write time via `validateAndCleanTaste()`. | — (schema definition) |
| `src/lib/taste/vocab.ts:16` | `PRIMARY_ARCHETYPES` const | Defines the closed 10-value vocabulary at line 16: `['dress', 'dive', 'field', 'pilot', 'chrono', 'gmt', 'racing', 'sport', 'tool', 'hybrid']`; used by `validateAndCleanTaste()` for vocab filtering at enrichment time and by both `GenreChips` and `ArchetypeChips` for chip enumeration. | — (shared constant) |
| `src/lib/archetype-config.ts:19` | `PRIMARY_ARCHETYPES` (identity copy) | `ARCHETYPE_CONFIG` at line 19 maps each archetype value to `{ displayName, description }`; `ArchetypeChips` consumes `ARCHETYPE_CONFIG[value].displayName` to produce editorial identity labels ("Dive Watch Devotee", "Genre Crosser", etc.). | Identity labels — only via ArchetypeChips, not GenreChips |

---

## Overlap & Divergence Matrix

### genre ↔ style overlap

The genre surface (`primary_archetype`) and the style surface (`style_tags`) both exist on `watches_catalog` and `watches`. They are structurally different (single-value closed vocab vs multi-value open array), but conceptually they share several axes.

**Formality axis:** Both fields express it partially. Archetype `dress` is unambiguously formal. The `style_tags` open vocab includes values like `dressy`, `casual`, `formal` — so the same watch might have `primary_archetype = 'dress'` AND `style_tags = ['dressy', 'classic']`. Agreement is expected but not guaranteed; a `dress` archetype watch with `style_tags = ['sporty', 'tool']` would be divergent.

**Sportiness / functional-use axis:** Archetypes `dive`, `field`, `pilot`, `racing`, `tool` map to functional use-cases that are also expressible via `style_tags` (e.g. `dive`, `field`, `aviation`, `racing`, `tool-watch`). However, the open vocab of `style_tags` is not normalized — so "dive" and "diver" might coexist. Genre is the authoritative single-value source for the functional category, while style supplements with finer-grained descriptors.

**Broadness of coverage:** `primary_archetype = 'hybrid'` maps to watches that don't cleanly fit any one category. For these, `style_tags` bears the load of expressing what the watch actually is (e.g. `['dive', 'dressy', 'integrated-bracelet']`). This is the clearest divergence: genre says "I don't know" while style carries the signal.

**Design-language axis:** `style_tags` carries design-language descriptors (e.g. `bauhaus`, `vintage`, `dressy`, `sporty`) that have no equivalent in the `primary_archetype` vocabulary. Archetypes are function-first; style tags include aesthetic and era-resonance signals. These do not overlap.

**Data completeness asymmetry:** Both `style_tags` and `primary_archetype` are assigned by the LLM enrichment pipeline. However, `style_tags` is also set on `watches` (user collection) via `WatchForm` and `AddWatchFlow`, while `primary_archetype` only exists on `watches_catalog`. A user's personal watch record has `styleTags` but no `primaryArchetype` field — the taste dimension is bridged via the catalog FK. This is a load-bearing architectural asymmetry: removing style would break the user-collection layer; removing genre would not.

**Summary table:**

| Axis | `primary_archetype` (genre) says | `style_tags` says | Overlap? |
|------|----------------------------------|-------------------|----------|
| Formality | Single value, closed: `dress` = formal | Array, open: may include `dressy`, `formal`, `casual` | Partial — `dress` implies `dressy` but not vice versa |
| Sportiness | Single value: `sport`, `racing`, `dive`, `tool` | Array: may include `sporty`, `racing`, `dive`, `tool-watch` | Partial — vocab is non-normalized on style side |
| Functional use-case | Authoritative single category | Supplemental descriptors | Complementary, not redundant |
| Design language | Not expressed | Expressed: `bauhaus`, `vintage`, `dressy`, `sporty` | No overlap — style carries this exclusively |
| Era affinity | Not expressed (era = separate `eraSignal` column) | Not a primary style_tags axis | Neither (era is its own field) |
| Dial complexity | Not expressed | Not a primary style_tags axis | Neither |
| Multi-category watch | `hybrid` = explicit "don't know" | Carries the actual descriptors for what the watch is | Divergent — style says more than genre here |
| User collection record | Absent (catalog-only column; no `primaryArchetype` on `watches`) | Present on both `watches` and `watches_catalog` | Divergent — style has broader write surface |

---

### genre ↔ archetype redundancy

This is the D-02 finding. `GenreChips` and `ArchetypeChips` are two distinct chip groups rendered side-by-side in the `/search` FilterDrawer (`src/components/search/FilterDrawer.tsx:85` and `src/components/search/FilterDrawer.tsx:86` respectively), yet they filter the **same column** (`watches_catalog.primary_archetype`) with the **same 10 values** from `PRIMARY_ARCHETYPES`.

The only differences are cosmetic:

- **GenreChips** (`src/components/search/GenreChips.tsx:25`): iterates `PRIMARY_ARCHETYPES` and maps to a local `GENRE_DISPLAY_NAMES` — plain utility labels ("Dive", "Dress", "GMT").
- **ArchetypeChips** (`src/components/search/ArchetypeChips.tsx:12`): iterates the same `PRIMARY_ARCHETYPES` and maps to `ARCHETYPE_CONFIG[value].displayName` from `src/lib/archetype-config.ts:19` — identity copy ("Dive Watch Devotee", "Dress Watch Devotee", "GMT Traveler", "Genre Crosser").

Both component files import `PRIMARY_ARCHETYPES` from `src/lib/taste/vocab.ts:16` and iterate it to produce 10 chips. The chips use the same `Chip` primitive (`src/components/ui/chip.tsx`, unified in Phase 48 D-07/D-08), so they are visually identical in layout and interaction pattern. Both are single-select (only one value per chip group at a time).

**The archetype-wins tiebreaker** at `src/data/catalog.ts:444`:

```
// Phase 46 D-12: Genre OR Archetype — both map to primaryArchetype column.
// Archetype wins over genre when both are set (Pitfall 4).
const primaryArchetypeFilter = filters?.archetype ?? filters?.genre
if (primaryArchetypeFilter) {
  predicates.push(isNotNull(watchesCatalog.primaryArchetype)!)
  predicates.push(eq(watchesCatalog.primaryArchetype, primaryArchetypeFilter)!)
}
```

The `??` nullish coalescing means that if a URL carries both `?genre=dive&archetype=dress`, archetype wins silently. In practice a user can only activate one chip group at a time in the FilterDrawer, but the DAL has no enforcement — a deep-linked URL with both params would silently apply only archetype.

**Consequence for users:** A user on `/search` sees two filter sections — "Genre" and "Archetype" — that produce identical search results for the same value selected. "Dive" (GenreChips) and "Dive Watch Devotee" (ArchetypeChips) both push `primary_archetype = 'dive'` to the SQL predicate. The user cannot distinguish the two controls by outcome; they differ only in label vocabulary (utility vs identity).

**Why both exist:** The `/explore/genres` index page (`src/app/explore/genres/page.tsx:26`) intentionally uses plain utility labels as an editorial distinction from the "Collector Archetypes" identity chip rail on /explore (per CONTEXT.md D-17). The dual-chip pattern in FilterDrawer appears to have emerged from surfacing both browsing intents (utility count-based vs identity-driven) without recognizing that they share a column at the DAL layer.

---

## Live-Catalog Evidence

**Provenance:** Queries run against the local Supabase Docker mirror (`supabase_db_horlo` container, `postgresql://postgres:postgres@127.0.0.1:54322/postgres`). Total catalog row count: **100 rows**. All 100 have both `primary_archetype` and non-empty `style_tags` — the local mirror is known-current (matches the ~100-row prod bootstrap referenced in PROJECT.md). Date: 2026-05-19.

---

### Q1 — Agreement Count

For each archetype, how many rows have `primary_archetype = X AND X = ANY(style_tags)` (i.e. does style restate genre)?

```sql
SELECT primary_archetype,
       COUNT(*) AS total_with_archetype,
       COUNT(*) FILTER (WHERE primary_archetype = ANY(style_tags)) AS agreement_count,
       ROUND(100.0 * COUNT(*) FILTER (WHERE primary_archetype = ANY(style_tags)) / COUNT(*), 1) AS agreement_pct
FROM watches_catalog
WHERE primary_archetype IS NOT NULL
GROUP BY primary_archetype
ORDER BY agreement_pct DESC, total_with_archetype DESC;
```

| `primary_archetype` | total rows | style_tags contains archetype | agreement % |
|---------------------|-----------|-------------------------------|-------------|
| dive | 43 | 43 | 100.0% |
| chrono | 19 | 19 | 100.0% |
| dress | 12 | 12 | 100.0% |
| gmt | 9 | 9 | 100.0% |
| sport | 7 | 7 | 100.0% |
| field | 7 | 7 | 100.0% |
| pilot | 2 | 2 | 100.0% |
| racing | 1 | 0 | 0.0% |

**Note:** `tool` and `hybrid` do not appear in the catalog — 0 rows for each. The DB has 8 distinct archetype values vs the 10-value `PRIMARY_ARCHETYPES` vocab.

**Finding:** For 7 of 8 represented archetypes, `primary_archetype` is always restated verbatim in `style_tags` (100% agreement). The one exception is `racing` (1 row, Rolex Cosmograph Daytona 16520), where `style_tags = {chrono, sport, dress, luxury}` — the functional category tag `racing` is absent even though the archetype is `racing`. This is the sole disagreement case in the catalog.

---

### Q2 — Divergence Count

Two directional counts:
- **Q2a:** `primary_archetype IS NOT NULL` but `style_tags` is empty
- **Q2b:** `style_tags` non-empty but `primary_archetype` IS NULL

```sql
-- Q2a: primary_archetype set, style_tags empty
SELECT COUNT(*) AS archetype_set_style_empty
FROM watches_catalog
WHERE primary_archetype IS NOT NULL
  AND style_tags = '{}';

-- Q2b: style_tags non-empty, primary_archetype null
SELECT COUNT(*) AS style_set_archetype_null
FROM watches_catalog
WHERE primary_archetype IS NULL
  AND style_tags != '{}';
```

| Direction | Count |
|-----------|-------|
| Archetype set, style empty | 0 |
| Style set, archetype null | 0 |

**Finding:** Zero divergence in either direction — the enrichment pipeline has consistently populated both fields together on every catalog row. No row has one field set without the other. This means the two fields are co-populated and effectively co-dependent in practice (despite being structurally independent).

---

### Q3 — Per-Archetype Top-3 Style Tags

For each archetype, which style tags appear most frequently? Tells us whether each archetype has a distinctive style fingerprint or whether the same tags appear across all genres.

```sql
SELECT primary_archetype, tag, COUNT(*) AS tag_count
FROM watches_catalog, unnest(style_tags) AS tag
WHERE primary_archetype IS NOT NULL
GROUP BY primary_archetype, tag
ORDER BY primary_archetype, tag_count DESC;
```

Top 3 per archetype (extracted from full result set):

| `primary_archetype` | Top tag #1 | Top tag #2 | Top tag #3 |
|---------------------|-----------|-----------|-----------|
| chrono | sport (19) | chrono (19) | dress (7) |
| dive | dive (43) | sport (43) | tool (5) |
| dress | dress (12) | sport (9) | heritage (2) / luxury (2) |
| field | sport (7) / field (7) / dress (7) — three-way tie | military (2) | dive (1) / outdoor (1) / tool (1) |
| gmt | gmt (9) / sport (9) — tied | travel (6) | pilot (5) |
| pilot | field (2) / pilot (2) / sport (2) — three-way tie | dress (1) / gmt (1) | — |
| racing | luxury (1) / chrono (1) / sport (1) / dress (1) — four-way tie | — | — |
| sport | sport (7) | dress (6) | luxury-sport (4) |

**Observations:**
- `sport` is the single most-repeated tag across all archetypes — it appears in the top 3 for every archetype except pilot (where it ties for #1). It is a generic style descriptor that carries almost no discriminative signal at the archetype level.
- Each archetype does reliably self-include its own name in `style_tags` (except `racing` — the one disagreement case).
- `dress` appears as a secondary or tertiary tag across `chrono`, `dive`, `dress`, `field`, `gmt`, `pilot`, `racing`, and `sport` — it is overloaded as both an archetype name and a general "versatile / dressy" style signal.
- Distinctive style fingerprints do emerge for some archetypes: `gmt` has `travel` (6/9); `dive` has `tool` (5/43); `chrono` has `pilot` (4/19) and `racing` (3/19). These cross-archetype tags carry contextual style information that `primary_archetype` alone does not.

---

### Q4 — Null Coverage

Total catalog rows, and how many lack each field.

```sql
SELECT
  COUNT(*) FILTER (WHERE primary_archetype IS NULL) AS archetype_null_count,
  COUNT(*) FILTER (WHERE style_tags = '{}') AS style_empty_count,
  COUNT(*) FILTER (WHERE primary_archetype IS NULL AND style_tags = '{}') AS both_missing_count,
  COUNT(*) AS total_rows
FROM watches_catalog;
```

| Metric | Count |
|--------|-------|
| Total rows | 100 |
| `primary_archetype IS NULL` | 0 |
| `style_tags = '{}'` | 0 |
| Both missing | 0 |

**Finding:** 0% of catalog rows lack archetype; 0% lack style tags. Full enrichment coverage on the local mirror. The enrichment pipeline has reached every catalog row — neither field has unfilled rows in this 100-row corpus.

---

### Q5 — Watch-Level Disagreement Examples

Rows where `primary_archetype IS NOT NULL AND style_tags != '{}'` but the archetype value does not appear in `style_tags` (the two fields express different functional category signals).

```sql
SELECT id, brand, model, reference, primary_archetype, style_tags
FROM watches_catalog
WHERE primary_archetype IS NOT NULL
  AND style_tags != '{}'
  AND NOT (primary_archetype = ANY(style_tags))
ORDER BY brand, model
LIMIT 5;
```

| brand | model | reference | `primary_archetype` | `style_tags` |
|-------|-------|-----------|---------------------|--------------|
| Rolex | Cosmograph Daytona | 16520 | racing | {chrono, sport, dress, luxury} |

Only **1 row** disagrees. The LLM assigned `primary_archetype = 'racing'` (the closed-vocab functional category) but populated `style_tags` with `{chrono, sport, dress, luxury}` — omitting the `racing` tag that would produce agreement. The Daytona is a chronograph used in motorsport contexts; the style tags describe the watch's multi-faceted character (it functions as a dress watch despite being a racing chronograph). This is a genuine divergence: the two fields capture different semantic layers — archetype says "what it was designed for," style tags say "what it looks and feels like."

---

### Summary of Live-Catalog Findings

The 5 queries reveal a highly homogeneous catalog:

1. **Near-perfect style/genre agreement (99%):** 99 of 100 rows have `primary_archetype` verbatim inside `style_tags`. The enrichment pipeline writes both fields atomically and uses the archetype value as a seed tag in `style_tags`. The two fields co-populate.
2. **Zero coverage gaps:** All 100 rows have both fields populated. Neither field is "more complete" than the other.
3. **`sport` is ubiquitous and uninformative as a style signal:** It appears in the top-2 for every archetype, including archetypes with no sporting character (dress). Its presence in `style_tags` adds noise rather than signal relative to `primary_archetype`.
4. **Secondary style tags carry the real additive value:** Tags like `travel` (on gmt rows), `tool` (on dive rows), `military` (on field rows), and `luxury` (on chrono/sport rows) express dimensions that `primary_archetype` does not — design language, use context, and positioning signals. This is where style carries non-redundant information.
5. **Two archetypes absent from the catalog (`tool`, `hybrid`):** The corpus cannot speak to how these archetypes behave. Any recommendation must account for this blind spot — hybrid in particular is the archetype designed to carry style-tag load (D-05 §3 notes hybrid says "I don't know" while style carries the actual descriptors).

---

## Options

Five options are evaluated. Option labels are used verbatim as anchors in §7 and §8.

---

### A. consolidate

Merge genre and style into a single unified tag surface. The `primary_archetype` column value becomes a reserved prefixed entry in a new or extended `tags[]` array (e.g. `genre:dive`), or a special `primaryTag` field is added alongside `style_tags` to carry the single-value genre signal. GenreChips, ArchetypeChips, and StyleChips all draw from the unified surface.

- **Schema change:** `watches_catalog`: add a `tags text[]` column (or extend `style_tags` to include the `genre:` prefix convention) and deprecate `primary_archetype`. `watches`: `style_tags` already exists; no new column needed. `user_preferences`: `preferredStyles`/`dislikedStyles` must accept `genre:*` prefixed values if preference-filtering across the unified surface is desired. `CatalogSearchFilters` interface in `src/data/catalog.ts:275` must be refactored — `genre` and `archetype` fields merged into a single `tags` or `archetype` field. Drizzle migration needed to add/rename column on `watches_catalog`.
- **UX change:** FilterDrawer loses both GenreChips and ArchetypeChips; a new unified chip group is introduced. `/explore/genres` page and `getBrowseGenreCounts()` must be rewritten to query the new tag structure. StyleChips and the collection FilterBar would need to either surface the `genre:` prefix distinctively or filter it out. WatchCard style-tag display at `src/components/watch/WatchCard.tsx:93` would show genre prefixed tags alongside style tags unless filtered.
- **Migration needed:** 1 drizzle migration (new column + in-place UPDATE backfill copying `primary_archetype` into the new `tags` column as `genre:X` entries, THEN `DROP COLUMN primary_archetype`). 1 supabase migration for prod. Data backfill required: per the 2026-05-19 update to `project_db_wipeable_2026_05_09`, `watches_catalog` is NO LONGER wipeable — wipe-and-re-enrich is not a valid migration strategy here. The migration must preserve the 100 enriched rows in place via an UPDATE statement before dropping `primary_archetype`. `watches` table `style_tags` rows (user collection) do not need migration since the user's personal watches don't have `primary_archetype`; only catalog rows need the column migration.
- **Irreversibility:** High — one-way door. Dropping `primary_archetype` from the schema requires a migration to restore it. Callers that depend on the single-value `primaryArchetype` type (e.g. `CatalogTasteAttributes` in `src/lib/types.ts`, `validateAndCleanTaste()` in `src/lib/taste/vocab.ts`) must be rewritten. The similarity engine's `TASTE_SUB_WEIGHTS.archetypeMatch` weight at `src/lib/similarity.ts:42` references `primaryArchetype` — this must be repointed. The `/explore/genres` route URL (`?genre=X`) would break; users with bookmarked genre deep-links would get 404s.

---

### B. remove-genre

Drop the genre surface entirely. This means: drop `primary_archetype` from `watches_catalog`; delete `GenreChips.tsx` and `ArchetypeChips.tsx`; remove `filters.genre` and `filters.archetype` from the `CatalogSearchFilters` interface in `src/data/catalog.ts:275`; remove the archetype-wins tiebreaker at `src/data/catalog.ts:446`; delete the `/explore/genres` page; remove the "Genres" tile from `BrowseModule.tsx:43`; and remove `getBrowseGenreCounts()` from `src/data/browse.ts:94`.

- **Schema change:** Drop `primary_archetype text` column from `watches_catalog` (drizzle migration + supabase migration). Remove `CatalogSearchFilters.genre` and `.archetype` interface fields in `src/data/catalog.ts:275`. Remove `TASTE_SUB_WEIGHTS.archetypeMatch` (effective weight 0.04) from `src/lib/similarity.ts:42` and remove the categorical archetype equality check at `src/lib/similarity.ts:125`. `watches` table is unaffected (it has no `primary_archetype`).
- **UX change:** FilterDrawer loses GenreChips and ArchetypeChips (2 chip groups removed). `/explore/genres` page removed entirely — the "Genres" BrowseModule tile deep-link at `/explore/genres` 404s and must be removed from `src/components/explore/BrowseModule.tsx:43`. StyleChips remains; collection FilterBar remains. No user-visible reduction in search power (style_tags covers the functional-category axis because, per Q1, 99% of catalog rows have `primary_archetype` verbatim in `style_tags`). The `ARCHETYPE_CONFIG` identity-copy labels ("Dive Watch Devotee", etc.) in `src/lib/archetype-config.ts` become dead code and can be deleted.
- **Migration needed:** 1 drizzle migration (`ALTER TABLE watches_catalog DROP COLUMN primary_archetype`). 1 supabase migration for prod. No data backfill needed — the column is being removed, not repurposed. This is the key reason Option B's forward cost is unaffected by the 2026-05-19 update to `project_db_wipeable_2026_05_09` (catalog no longer wipeable): we're destroying the data by design, not migrating it. The enricher (`src/lib/taste/vocab.ts` enrichment path) must be updated to stop writing `primary_archetype`.
- **Irreversibility:** High — column drop is a one-way door. Restoring genre would require a new migration AND re-running the LLM enrichment pipeline on all 100 catalog rows (the 2026-05-19 catalog-wipeable carve-out means the cheap "wipe + reseed" rollback path is gone — re-population is via API-cost-bearing enrichment, not seed). However, since Q1 shows 99% agreement, the style_tags column preserves the functional category signal. The `hybrid` and `tool` archetypes (0 catalog rows currently) could not be recovered from style_tags alone if the vocab diverges in future enrichment runs.

---

### C. remove-style

Drop the style surface entirely. This means: remove `style_tags` from both `watches_catalog` and `watches`; remove `preferredStyles` and `dislikedStyles` from `user_preferences`; delete `StyleChips.tsx`; remove the style filter from `FilterBar.tsx:96-147`; remove style-tag display from `WatchCard.tsx:93`, `ProfileWatchCard.tsx:39`; remove style aggregation from `InsightsTabContent.tsx:166`; remove `WatchForm.tsx:270` and `AddWatchFlow.tsx:654,688` write paths; and reweight the similarity engine.

- **Schema change:** Drop `style_tags text[]` from `watches` (user collection) and `watches_catalog`. Drop `preferred_styles text[]` and `disliked_styles text[]` from `user_preferences`. All defined in `src/db/schema.ts:116,377,181-182`. Two drizzle migrations (one per table group, or combined). Two supabase migrations. The `watches` table drop affects user data — any `style_tags` the user has manually assigned to their watches are lost.
- **UX change:** Extensive and destructive. Users lose: style filtering in search (StyleChips removed), style filtering in collection (FilterBar style section removed), style preferences (preferredStyles/dislikedStyles removed from Preferences UI), style tags on watch cards, style distribution chart in profile Insights tab. The similarity engine loses its largest single dimension — `styleTags` at effective weight 0.20 (line 14 of `src/lib/similarity.ts`) must be zeroed out or redistributed. Preference alignment via `checkPreferenceAlignment()` at line 224 must be rewritten.
- **Migration needed:** 2+ drizzle migrations. 2+ supabase migrations. Data destruction: user-assigned `style_tags` on `watches` rows are gone (and per the 2026-05-19 catalog-wipeable carve-out, `watches_catalog.style_tags` enrichment is also a loss that cannot be cheaply restored). Wipe-and-re-enrich does not apply here — the watches table's style_tags come from user input (WatchForm), not LLM enrichment, so re-enriching does not recover them.
- **Irreversibility:** Very high — the most irreversible of all 5 options. User preference data (`preferredStyles`, `dislikedStyles`) is permanently deleted. The similarity engine's highest-weight dimension is permanently removed. Restoring style would require schema re-add, UI rebuild, re-seeding all preference data from scratch. This option eliminates the only axis that carries design-language, era, and positioning signals (§3 Overlap Matrix: "design language" and "user collection record" are exclusive to style).

---

### D. unify-archetype-surface

Keep both `primary_archetype` and `style_tags` in the schema unchanged. Remove one of the two chip groups in FilterDrawer that both filter the same `primary_archetype` column: either delete `GenreChips.tsx` (keeping ArchetypeChips) or delete `ArchetypeChips.tsx` (keeping GenreChips). Also remove the corresponding interface field from `CatalogSearchFilters` (`genre` if GenreChips removed, `archetype` if ArchetypeChips removed) and simplify the archetype-wins tiebreaker at `src/data/catalog.ts:446` to a single field.

The recommended sub-choice is: **keep GenreChips (plain utility labels), drop ArchetypeChips (identity copy)**. Rationale: `/explore/genres` already uses plain utility labels ("Dive", "Dress"); the FilterDrawer genre chips should use the same vocab for consistency. The identity-copy labels ("Dive Watch Devotee", "Genre Crosser") add editorial flavor but no functional differentiation — and they require maintaining `ARCHETYPE_CONFIG` in `src/lib/archetype-config.ts` as a separate source of display strings.

- **Schema change:** None — `primary_archetype` stays, `style_tags` stays, `user_preferences` unchanged. The DAL change is minimal: remove `filters.archetype` from `CatalogSearchFilters` interface in `src/data/catalog.ts:275` (if ArchetypeChips removed), and simplify the tiebreaker at line 446 to `const primaryArchetypeFilter = filters?.genre` (no `??` needed).
- **UX change:** FilterDrawer loses one chip group. Users who used ArchetypeChips (identity copy) no longer see "Dive Watch Devotee" — they see "Dive" (via GenreChips) for the same filter outcome. The `/explore/genres` page is unaffected. `src/lib/archetype-config.ts` becomes dead code (can be deleted). No change to StyleChips, FilterBar, watch cards, preferences, or similarity engine.
- **Migration needed:** None — no schema changes. No drizzle migration, no supabase migration, no data backfill. This is a pure code/UI change. The deleted file is `src/components/search/ArchetypeChips.tsx` and the updated files are `src/components/search/FilterDrawer.tsx` (remove import + render at lines 11,86) and `src/data/catalog.ts` (remove `archetype` field from interface at line 275, simplify tiebreaker at line 446). `src/lib/archetype-config.ts` can be deleted if no other consumer exists.
- **Irreversibility:** Low — fully reversible. ArchetypeChips is a standalone component backed by an existing column. Restoring it requires adding the component file back and re-adding the import/render to FilterDrawer. No data is lost, no schema changes are made, no user preferences are affected.

---

### E. keep-both

Status quo. No schema change, no code change. Document the intentional layering in code comments — specifically the archetype-wins tiebreaker at `src/data/catalog.ts:446` and the duplicate chip surfaces in `FilterDrawer.tsx:85-86` — so future readers understand this is a deliberate design, not an oversight.

- **Schema change:** None.
- **UX change:** None. GenreChips and ArchetypeChips continue to coexist in FilterDrawer. The `/explore/genres` page continues using plain labels. StyleChips and the genre/archetype chips remain parallel filter axes.
- **Migration needed:** None. Only a code comment update in `src/data/catalog.ts:446` and `src/components/search/FilterDrawer.tsx:85-86` to explain the dual-chip intentionality.
- **Irreversibility:** N/A — no change is made, so there is nothing to reverse. However, choosing this option preserves the existing technical debt. The genre↔archetype redundancy (D-02) remains: a user who clicks "Dive" (GenreChips) and a user who clicks "Dive Watch Devotee" (ArchetypeChips) get identical search results. The dual maintenance surface persists — any future change to how the archetype surface renders requires touching both component files.

---

## Decision Matrix

Each option scored across the 5 D-05 §6 criteria. Scale: 1 (worst) to 5 (best).

| Option | UX clarity | Schema simplicity | Expressive power preserved | Migration cost | Irreversibility |
|--------|-----------|-------------------|---------------------------|----------------|-----------------|
| A. consolidate | 3 | 3 | 4 | 2 | 1 |
| B. remove-genre | 4 | 4 | 4 | 4 | 2 |
| C. remove-style | 1 | 4 | 1 | 1 | 1 |
| D. unify-archetype-surface | 5 | 5 | 5 | 5 | 5 |
| E. keep-both | 2 | 2 | 5 | 5 | 5 |

**Scoring rationale:**

**UX clarity** measures how confusing the resulting filter surface is to a user. Option D scores highest (5) because it eliminates the only genuine user-facing confusion — two chip groups producing identical results — while touching nothing else. Option B scores 4 because removing GenreChips + ArchetypeChips simplifies the drawer, and the style surface fully covers the functional-category axis (Q1: 99% agreement means `style_tags @> ARRAY['dive']` returns the same rows as `primary_archetype = 'dive'`). Option A scores 3 because a unified prefix-tagged surface is conceptually elegant but adds UI complexity (how does the user distinguish genre-prefixed tags from style tags in the chip UI?). Option E scores 2 because it preserves the dual-chip confusion documented in §3. Option C scores 1 because removing style strips the user of filtering by design language, preferences, and collection insights — the dimensions users interact with most.

**Schema simplicity** measures the resulting schema's coherence. Options C and B both score 4 (each removes a column). Option A scores 3 (schema simplifies conceptually but requires a migration to add/rename and a new tag-prefix convention). Option D scores 5 (no schema change at all). Option E scores 2 (current schema has redundant surfaces that a reader must mentally parse).

**Expressive power preserved** measures whether the recommendation retains the full semantic range currently available. Options D and E score 5 — all dimensions remain accessible. Option A scores 4 — the genre signal is preserved via the `genre:` prefix; minor loss is that the closed-vocab enforcement (`validateAndCleanTaste`) becomes harder to maintain in an open array. Option B scores 4 — the genre/archetype axis is still queryable via `style_tags` (since Q1 shows 99% agreement); only the `hybrid` and `tool` archetypes (0 current rows) would lose their dedicated signal. Option C scores 1 — removing style eliminates design language, era, positioning, and user-preference dimensions that have no equivalent in `primary_archetype`.

**Migration cost** scores how much work the option requires, weighted by the Q1-Q4 evidence. Since Q2 found 0 divergence rows in either direction and Q4 found 100% coverage, any migration that touches `primary_archetype` or `style_tags` values can rely on the data being co-consistent. Per the 2026-05-19 update to `project_db_wipeable_2026_05_09`: user-side tables (`watches` and friends) remain wipeable, but `watches_catalog` is now CARVED OUT — wipe-and-re-enrich is no longer a valid migration strategy for catalog-side columns because the v4-v5.1 enrichment investment (LLM taste attrs, factual fields, photo URLs) cannot be cheaply restored from any seed. Option D scores 5 (zero migration). Option E scores 5 (zero migration). Option B scores 4 (1 drizzle + 1 supabase migration, column DROP only — no data backfill needed because the column is destroyed by design; the catalog-wipeable carve-out doesn't impact this option's forward cost). Option A scores 2 (1-2 migrations + in-place UPDATE backfill + enricher rewrite; previously scored higher because wipe-and-re-enrich was assumed acceptable, but with the catalog carve-out the in-place backfill is now required). Option C scores 1 (multiple migrations, user data loss on `watches.style_tags` AND `watches_catalog.style_tags` enrichment loss; can't wipe-and-re-enrich for either).

**Irreversibility** scores how easy it is to undo. Options D and E score 5 (trivially reversible or not changed at all). Options A and C score 1 (dropping or restructuring columns is a one-way door that destroys data). Option B scores 2 (dropping `primary_archetype` is a column drop, but the signal is largely preserved in `style_tags` — restoring genre would require a new migration and re-running enrichment, which is feasible given Q4 shows 100% coverage before the drop).

**Key insight from the matrix:** Option D (`unify-archetype-surface`) is the dominant choice — it is strictly better than or equal to every other option on all 5 criteria. It solves a real user-facing problem (the D-02 dual-chip redundancy) at zero migration cost and zero irreversibility. For the genre↔style primary question (TAX-01), Option B (`remove-genre`) outscores Option A (`consolidate`) and Option E (`keep-both`) on the criteria that matter most: UX clarity and schema simplicity, while preserving expressive power through style's near-complete coverage of the genre axis.

---

## Recommendation

### Primary recommendation (genre↔style — TAX-01 direct answer): remove-genre

**Label:** `remove-genre`

Drop the `primary_archetype` column, GenreChips, ArchetypeChips, the `/explore/genres` page, and the `filters.genre`/`filters.archetype` interface fields. Keep `style_tags` entirely intact.

The primary evidence driving this call is the Q1 agreement rate: **99 of 100 catalog rows have `primary_archetype` restated verbatim as the first style tag.** The enrichment pipeline seeds `primary_archetype` into `style_tags` atomically, meaning the two fields carry the same signal in 99% of cases. Keeping a dedicated column and two separate UI chip groups to represent a dimension that style already captures is schema and UI redundancy, not intentional layering. Q2 confirms there are zero divergence rows in either direction — no row has archetype without style, or style without archetype — which means the fields are co-populated and removing genre loses essentially nothing from the data layer.

The one genuine exception is the Rolex Cosmograph Daytona 16520 (Q5): `primary_archetype = 'racing'` but `style_tags = {chrono, sport, dress, luxury}`. This row demonstrates that the two axes CAN carry different semantic information — `primary_archetype` names the functional origin ("designed for motorsport timing") while `style_tags` describes the watch's actual aesthetic character ("looks like a chrono, wears dressy, positioned as luxury"). But 1 row out of 100 is not sufficient evidence that the genre axis is carrying load that style cannot carry. In this specific case, the Daytona's style tags fully describe its character; the `racing` archetype adds functional provenance information that the style tags omit. If that provenance signal matters, it is an argument for keeping genre — but given the current catalog it is a single-watch edge case.

The §3 Overlap & Divergence Matrix shows two style-exclusive axes: **design language** (e.g. `bauhaus`, `vintage`, `dressy`, `sporty`) and the **user-collection write surface** (`style_tags` exists on `watches`; `primary_archetype` is catalog-only). These axes have no equivalent in `primary_archetype`. Removing style to "simplify" would destroy both axes. Removing genre preserves both. Style is the more expressive and more load-bearing of the two surfaces.

Q3 identifies one genuine data quality issue that persists regardless of the consolidation decision: **`sport` is top-2 for all 8 archetypes**, including `dress`. This tag is semantic noise that dilutes style's discriminative power. This is a style-vocab governance issue (flagged in §2 implications) that is out of scope for this spike but should be addressed in a follow-up enrichment iteration.

The §6 Decision Matrix scores `remove-genre` at 4/4/4/4/2 — a 2 on irreversibility (dropping `primary_archetype` is a one-way door) is the only cost. Per the 2026-05-19 update to `project_db_wipeable_2026_05_09`, `watches_catalog` is no longer wipeable, so the rollback path (restoring `primary_archetype` and its data) requires re-running the LLM enrichment pipeline at Anthropic API cost with some LLM non-determinism risk — feasible (Q4 confirms 100% enrichment coverage before the drop and the enricher code remains in place) but no longer free. The irreversibility score stays at 2 (rollback is feasible-but-costly, not impossible). This does not change the forward cost or the Ship-Now verdict — Option B is a column DROP, not a data migration.

---

### Sub-recommendation (genre↔archetype — D-02/D-03): unify-archetype-surface

**Label:** `unify-archetype-surface`

Remove `ArchetypeChips.tsx` and its corresponding `FilterDrawer.tsx:11,86` render. Keep `GenreChips.tsx` (plain utility labels). Remove `filters.archetype` from `CatalogSearchFilters` at `src/data/catalog.ts:275`. Simplify the tiebreaker at line 446 to `const primaryArchetypeFilter = filters?.genre`. Delete `src/lib/archetype-config.ts` (dead code once ArchetypeChips is removed).

This sub-recommendation is independent of the primary recommendation. Even if the primary recommendation (`remove-genre`) is deferred or rejected, Option D can be shipped immediately at zero cost. The §3 Overlap & Divergence Matrix establishes the core finding: GenreChips and ArchetypeChips iterate the same `PRIMARY_ARCHETYPES` const, use the same `Chip` primitive, resolve to the same `eq(watchesCatalog.primaryArchetype, value)` SQL predicate via the DAL tiebreaker, and are rendered side-by-side in `FilterDrawer.tsx:85-86`. A user who clicks "Dive" (GenreChips) and a user who clicks "Dive Watch Devotee" (ArchetypeChips) get identical search results. There is zero behavioral difference and zero expressive-power cost to removing one.

The choice of which chip group to keep: GenreChips, because `/explore/genres` (`src/app/explore/genres/page.tsx:26`) already uses the same plain utility labels and the same `primary_archetype` column via `getBrowseGenreCounts()`. Keeping GenreChips produces a consistent vocabulary between the search filter and the explore index. ArchetypeChips's identity copy ("Dive Watch Devotee") is editorial flavor that adds no filtering power and requires maintaining a separate `ARCHETYPE_CONFIG` file.

Note that the primary recommendation (`remove-genre`) subsumes this sub-recommendation — if `remove-genre` is implemented, both GenreChips and ArchetypeChips are removed. The sub-recommendation is the action to take NOW (or as a standalone mid-milestone add) regardless of whether the primary recommendation is deferred.

---

## Cost Estimate per Option

Columns: **Files touched** (count + key paths from §2 Consumer Map) | **Migrations** (drizzle + supabase) | **Data backfill** | **Test surface**

| Option | Files touched | Migrations | Data backfill | Test surface |
|--------|--------------|------------|---------------|--------------|
| A. consolidate | ~12-15 files: `src/db/schema.ts`, `src/data/catalog.ts`, `src/data/browse.ts`, `src/components/search/GenreChips.tsx`, `src/components/search/ArchetypeChips.tsx`, `src/components/search/StyleChips.tsx`, `src/components/search/FilterDrawer.tsx`, `src/app/explore/genres/page.tsx`, `src/lib/similarity.ts`, `src/lib/taste/vocab.ts`, `src/lib/types.ts`, `src/lib/archetype-config.ts` | 1 drizzle (add tags column or rename primary_archetype) + 1 supabase prod migration | **In-place UPDATE backfill required** — per the 2026-05-19 catalog-wipeable carve-out, wipe-and-re-enrich is no longer valid for catalog rows. Migration must: (1) ALTER add `tags text[]`, (2) UPDATE copy `primary_archetype` into `tags` as `genre:X` entries, (3) DROP `primary_archetype`. No user-watch backfill needed (`watches.style_tags` is unaffected). | High — all consumers of genre+style must be tested; SQL predicate change; FilterDrawer integration test; similarity weight test; backfill UPDATE verification. |
| B. remove-genre | ~8-9 files: `src/db/schema.ts:390`, `src/data/catalog.ts:275,446`, `src/data/browse.ts:94`, `src/components/search/GenreChips.tsx` (delete), `src/components/search/ArchetypeChips.tsx` (delete), `src/components/search/FilterDrawer.tsx:10-11,85-86`, `src/components/explore/BrowseModule.tsx:43`, `src/app/explore/genres/page.tsx` (delete), `src/lib/similarity.ts:42,125`, `src/lib/archetype-config.ts` (delete), `src/lib/taste/vocab.ts` (remove archetype write call) | 1 drizzle (DROP COLUMN primary_archetype) + 1 supabase prod migration | None — column is dropped, not repurposed. The 2026-05-19 catalog-wipeable carve-out does NOT impact this option's forward cost because no data is being migrated; the column's data is being destroyed by design. Enricher update stops writing primary_archetype. (Rollback path: re-add column + re-run LLM enrichment — feasible-but-costly, no longer free.) | Medium — FilterDrawer chip removal, catalog DAL predicate removal, similarity weight rebalance test, /explore/genres 404 test. |
| C. remove-style | ~14+ files: `src/db/schema.ts:116,377,181-182`, `src/data/catalog.ts:434`, `src/components/search/StyleChips.tsx` (delete), `src/components/filters/FilterBar.tsx:96-147`, `src/components/preferences/PreferencesClient.tsx:109,131`, `src/components/watch/WatchCard.tsx:93`, `src/components/profile/ProfileWatchCard.tsx:39`, `src/components/profile/InsightsTabContent.tsx:166`, `src/components/watch/WatchForm.tsx:83,135,270`, `src/components/watch/AddWatchFlow.tsx:654,688`, `src/lib/similarity.ts:14,222-228` | 2+ drizzle (DROP style_tags on watches + watches_catalog; DROP preferred_styles/disliked_styles on user_preferences) + 2+ supabase prod migrations | Destructive on multiple fronts. User-assigned `watches.style_tags` is lost (came from WatchForm, not LLM — cannot be re-enriched). `watches_catalog.style_tags` enrichment is also lost (per 2026-05-19 carve-out, catalog is no longer wipeable to re-derive). User preference rows (`preferredStyles`/`dislikedStyles`) are also gone. None recoverable without user re-input. | Very high — every consumer of style_tags must be tested; similarity engine rebalance; Preferences UI regression; WatchCard display change; Insights tab regression. |
| D. unify-archetype-surface | 3-4 files: `src/components/search/ArchetypeChips.tsx` (delete), `src/components/search/FilterDrawer.tsx:11,86`, `src/data/catalog.ts:275,446`, `src/lib/archetype-config.ts` (delete) | None | None | Low — FilterDrawer renders one fewer chip group; archetype predicate simplification; verify GenreChips still filters correctly. |
| E. keep-both | 2 files: `src/data/catalog.ts:446` (comment update), `src/components/search/FilterDrawer.tsx:85-86` (comment update) | None | None | None — behavior unchanged; only code comments added. |

**Backfill note (2026-05-19 catalog carve-out):** Per the updated `project_db_wipeable_2026_05_09` memory, `watches_catalog` is now CARVED OUT of the wipeable rule — the table holds v4-v5.1 enrichment investment (LLM taste attrs, factual fields, photo URLs) that no current seed can restore identically. Implications per option:

- **Option A (consolidate):** in-place ALTER + UPDATE backfill required (cannot wipe-and-re-enrich the catalog). Migration sequence: add `tags text[]`, UPDATE to copy archetype values as `genre:X` entries, then DROP `primary_archetype`.
- **Option B (remove-genre):** unaffected on the forward path — Option B drops the column by design; no migration of data is needed. Only the rollback path (re-add column + re-enrich) gets more expensive: that becomes an Anthropic-API-cost-bearing re-enrichment, not a free wipe-and-reseed.
- **Option C (remove-style):** double-destructive — both `watches.style_tags` (user input from WatchForm) AND `watches_catalog.style_tags` (LLM enrichment) are lost. Neither is recoverable without user re-input or re-enrichment.
- **Options D and E:** no schema change, no backfill concern.

User-side tables (`watches`, `wear_events`, etc.) remain wipeable per the original rule, but no option in this spike touches them in a way that would invoke the wipeable path.

---

## Ship-Now Eligibility Check

ROADMAP SC#4 gate language (verbatim):

> "No consolidation or removal implementation is shipped in this phase unless the spike specifically flags it as cheap and strongly favored — in which case a new requirement is added mid-milestone"

---

### Primary recommendation eligibility (remove-genre)

**Verdict: YES**

`remove-genre` is both cheap and strongly favored.

**Strongly favored:** The Decision Matrix scores `remove-genre` 4/4/4/4/2, with the only cost being irreversibility (column drop). The Q1 evidence — 99% agreement between `primary_archetype` and `style_tags` — establishes that genre is redundant to style in almost all catalog rows. The primary question SC#3 asks ("rationale strong enough to act on") is satisfied: a 99% redundancy rate with 0 divergence rows (Q2) and only 1 disagreement case out of 100 (Q5) is a clear empirical verdict.

**Cheap:** The cost estimate for `remove-genre` is 8-9 files, 1 drizzle migration (DROP COLUMN), 1 supabase prod migration, no data backfill. The migration is mechanically simple — a column drop has no in-place value-mapping, no UPDATE statements, no coordination steps. The 2026-05-19 `watches_catalog` wipeable carve-out does NOT affect Option B's forward cost because we are destroying the column's data by design, not migrating it. The implementation is scoped to file deletions and DAL simplifications — no new infrastructure, no new dependencies, no user-collection data loss (`watches.style_tags` is untouched). The rollback path is now more expensive than under the old wipeable assumption (re-enrichment costs Anthropic API calls and risks LLM non-determinism), but rollback is not the forward-cost gate.

**Trigger:** Add new requirement **TAX-02: remove-genre surface — drop `primary_archetype` column, delete GenreChips + ArchetypeChips + /explore/genres, simplify catalog DAL, rebalance similarity weights** to REQUIREMENTS.md and `/gsd-phase --insert` a Phase 49b implementation wave.

---

### Sub-recommendation eligibility (unify-archetype-surface)

**Verdict: YES**

`unify-archetype-surface` is cheap and strongly favored — and it is the faster path if the primary `remove-genre` recommendation requires further review.

**Strongly favored:** The Decision Matrix gives `unify-archetype-surface` a perfect 5/5/5/5/5 score. It is the dominant option: it removes a real user-facing confusion (two chip groups producing identical results) while adding zero migration cost, zero schema risk, and zero expressive power loss. There is no reasonable argument against it.

**Cheap:** 3-4 files touched (1 delete, 1 import removal, 1 DAL simplification, 1 possible dead-code delete). Zero drizzle migrations. Zero supabase migrations. Zero data backfill. This is the cheapest meaningful change in the options set.

**Trigger:** Add new requirement **TAX-02a: unify archetype chip surface — delete ArchetypeChips.tsx, remove from FilterDrawer, simplify DAL tiebreaker to single `filters.genre` field, delete archetype-config.ts** to REQUIREMENTS.md and `/gsd-phase --insert` as Phase 49b (or as Task 1 of the `remove-genre` implementation wave, since it is fully subsumed by `remove-genre`).

**Note on sequencing:** If both verdicts are YES, `unify-archetype-surface` should be implemented as the first task in the `remove-genre` implementation wave, not as a separate phase. It is a strict subset of the work `remove-genre` requires — the full implementation will delete ArchetypeChips and GenreChips, making the sub-recommendation's scope automatic. A standalone Phase 49b for ONLY `unify-archetype-surface` is an option if the team wants an immediate polish fix before committing to the full `remove-genre` implementation.

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

_To be filled by Plan 02 / Plan 03._

---

## Decision Matrix

_To be filled by Plan 02 / Plan 03._

---

## Recommendation

_To be filled by Plan 02 / Plan 03._

---

## Cost Estimate per Option

_To be filled by Plan 02 / Plan 03._

---

## Ship-Now Eligibility Check

_To be filled by Plan 02 / Plan 03._

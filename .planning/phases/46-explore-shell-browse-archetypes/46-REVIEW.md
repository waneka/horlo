---
phase: 46-explore-shell-browse-archetypes
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/lib/archetype-config.ts
  - src/data/browse.ts
  - src/data/discovery.ts
  - src/data/catalog.ts
  - src/app/actions/search.ts
  - src/components/search/useSearchState.ts
  - src/components/search/SearchPageClient.tsx
  - src/app/explore/page.tsx
  - src/components/explore/CollectorArchetypes.tsx
  - src/components/explore/BrowseModule.tsx
  - src/components/explore/HeroModule.tsx
  - src/components/explore/CuratedListsRail.tsx
  - src/components/explore/WhereCollectionsGo.tsx
  - src/app/explore/brands/page.tsx
  - src/app/explore/eras/page.tsx
  - src/app/explore/genres/page.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 46: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 46 ships the `/explore` 5-module shell, Browse index pages, the Collector
Archetypes chip rail, and four new `/search` Watches-tab facets (brand/era/genre/
archetype). The architecture is mostly sound: `'use cache'` scoping is correct
(auth assertions stay outside cache boundaries, no per-viewer data enters cached
scopes), and the brand-slug subquery is correctly Drizzle-parameterized — there
is **no SQL injection surface** in the new facet code.

However, the review found one BLOCKER and several WARNINGs centered on two
themes: (1) the new era/genre/archetype facet values reach the DAL with only a
loose `z.string().max(50)` Zod check — they are never validated against their
known enum vocabularies, and (2) the cache-invalidation claim in `browse.ts`'s
header is **factually wrong** — catalog mutations from the URL-extraction path
never call `revalidateTag('explore')`, so Browse/Archetype counts go stale.

## Critical Issues

### CR-01: Catalog mutations via URL extraction never invalidate Browse caches

**File:** `src/data/browse.ts:14-21` (claim) — root cause in `src/app/api/extract-watch/route.ts:146,213`
**Issue:** The `browse.ts` module header asserts:

> "The existing `revalidateTag('explore', 'max')` calls in watch mutation Server
> Actions already cover catalog-mutation invalidation ... No new revalidation
> wiring needed."

This is incorrect. The four Browse count DALs (`getBrowseArchetypeCounts`,
`getBrowseEraCounts`, `getBrowseGenreCounts`, `getBrowseBrandCounts`) and
`CollectorArchetypes` all cache under `cacheTag('explore', ...)` with
`cacheLife('hours')`. They count rows in `watches_catalog`.

`watches_catalog` is mutated by `upsertCatalogFromExtractedUrl` and
`updateCatalogTaste`, which are invoked by the **`/api/extract-watch` route
handler** (route.ts:146 and route.ts:213). That route handler contains **no
`revalidateTag` call at all** (verified via grep — zero matches for `revalidate`
in `route.ts`).

Concretely: a user imports a watch by URL → a new `watches_catalog` row is
inserted and its `primary_archetype` / `era_signal` are enriched → the Browse
genre/era/archetype counts and the Collector Archetypes count badges remain
**stale for up to one hour**. New archetypes with their first catalog row will
display a count of 0 (or be hidden by the `counts.length === 0` null-guard)
even though catalog content exists. This is incorrect, user-visible behavior
that the implementation explicitly (and wrongly) claimed was already handled.

(The `addWatch` Server Action path *is* covered — `watches.ts:294` calls
`revalidateTag('explore', 'max')` after its inline `upsertCatalogFromUserInput`
/ `updateCatalogTaste` calls. Only the URL-extraction route is unwired.)

**Fix:** Add a tag-revalidation call to the `/api/extract-watch` route handler
after a successful catalog upsert/enrich, and correct the misleading header
comment in `browse.ts`:
```ts
// src/app/api/extract-watch/route.ts — after catalog upsert/enrich succeeds
import { revalidateTag } from 'next/cache'
// ...
revalidateTag('explore') // busts explore + explore:browse + explore:archetypes
```
Then update the `browse.ts` header to state that the URL-extraction route is
the invalidation point, not "existing watch mutation Server Actions."

## Warnings

### WR-01: era/genre/archetype facet values are not validated against their enum vocabularies

**File:** `src/app/actions/search.ts:27-29`
**Issue:** The Zod schema validates the three new categorical facets as free
strings:
```ts
era:       z.string().max(50).optional(),
genre:     z.string().max(50).optional(),
archetype: z.string().max(50).optional(),
```
But `EraSignal` is a closed union (`'vintage-leaning' | 'modern' | 'contemporary'`)
and `PrimaryArchetype` is a closed 10-value union (`src/lib/types.ts:234-237`).
The existing `movement` and `size` facets in the *same schema* are correctly
constrained with `z.enum([...])`. The three Phase 46 facets break that pattern
and accept any string up to 50 chars. The value then flows unvalidated into
`eq(watchesCatalog.eraSignal, filters.era)` / `eq(watchesCatalog.primaryArchetype, ...)`
in `catalog.ts:422,430`. This is not an injection vuln (Drizzle parameterizes),
but it is a missing-input-validation defect: a crafted URL like
`/search?tab=watches&archetype=garbage` runs a real DB query that always returns
zero rows, and the phase brief explicitly calls for these to be Zod-validated.

**Fix:** Constrain to the known vocabularies:
```ts
era:       z.enum(['vintage-leaning', 'modern', 'contemporary']).optional(),
archetype: z.enum(['dress','dive','field','pilot','chrono','gmt','racing','sport','tool','hybrid']).optional(),
genre:     z.enum(['dress','dive','field','pilot','chrono','gmt','racing','sport','tool','hybrid']).optional(),
```
Better: derive the enum arrays from the `PrimaryArchetype` / `EraSignal` source
of truth so they cannot drift.

### WR-02: `CatalogSearchFilters` types era/genre/archetype as `string` instead of their unions

**File:** `src/data/catalog.ts:281-286`
**Issue:** `CatalogSearchFilters` declares `era?: string`, `genre?: string`,
`archetype?: string`. The DAL then calls `eq(watchesCatalog.eraSignal, filters.era)`
and `eq(watchesCatalog.primaryArchetype, primaryArchetypeFilter)`. Because the
filter fields are plain `string`, the type system provides no protection against
an out-of-vocabulary value reaching the query — the only gate is the Zod schema,
which (per WR-01) is also unconstrained. Two layers that should each catch a bad
value both pass it through. The adjacent `movement` and `size` fields in the
same interface are correctly typed as unions.

**Fix:** Type them with the domain unions:
```ts
era?: EraSignal
genre?: PrimaryArchetype
archetype?: PrimaryArchetype
```
`EraSignal` and `PrimaryArchetype` are already imported at `catalog.ts:9`.

### WR-03: Unsafe `as keyof typeof` cast on unvalidated URL value

**File:** `src/components/search/SearchPageClient.tsx:373`
**Issue:**
```ts
const archetypeConfig = archetype ? ARCHETYPE_CONFIG[archetype as keyof typeof ARCHETYPE_CONFIG] : null
```
`archetype` originates from a URL search param (`useSearchState` line 111,
`searchParams.get('archetype')`). The `as keyof typeof ARCHETYPE_CONFIG` cast
asserts to the type system that the value is one of the 10 known keys, which is
false for an arbitrary URL. The downstream code happens to handle the resulting
`undefined` (`archetypeConfig &&` guards, `archetypeConfig?.displayName ??`
fallbacks), so this does not crash today — but the cast actively suppresses the
type error that would otherwise force the value to be narrowed/validated first.
If a future edit assumes `archetypeConfig` is non-null, it will break silently.

**Fix:** Drop the cast and let the lookup be typed as `ArchetypeConfig | undefined`,
or validate `archetype` against `ARCHETYPE_CONFIG` keys before use:
```ts
const archetypeConfig =
  archetype && archetype in ARCHETYPE_CONFIG
    ? ARCHETYPE_CONFIG[archetype as PrimaryArchetype]
    : null
```

### WR-04: Brand slug subquery silently no-ops on an unknown slug

**File:** `src/data/catalog.ts:437-441`
**Issue:** The brand facet predicate is:
```ts
sql`${watchesCatalog.brandId} = (SELECT id FROM brands WHERE slug = ${filters.brand} LIMIT 1)`
```
When `filters.brand` does not match any `brands.slug`, the subquery yields
`NULL`, and `brandId = NULL` evaluates to `NULL` (not `false`) in SQL three-valued
logic — the row is excluded, so the query correctly returns zero results. That
is acceptable behavior, but it is silent: an unknown/stale brand slug from a
deep-link produces an empty Watches tab indistinguishable from "this brand has
no catalog watches." There is no validation that the slug resolves, and no
distinct UX path. Brand slugs are dynamic (not enumerable), so a Zod enum is not
possible — but the DAL could surface the unresolved-slug case so the UI can
render a clear "Unknown brand" state instead of a generic empty state.

**Fix:** Resolve the brand id explicitly before building the query and short-
circuit / signal when it does not resolve:
```ts
if (filters?.brand) {
  const [b] = await db.select({ id: brands.id }).from(brands)
    .where(eq(brands.slug, filters.brand)).limit(1)
  if (!b) return [] // or return a typed "unknown brand" marker
  predicates.push(eq(watchesCatalog.brandId, b.id))
}
```
At minimum, document the silent-no-op behavior in the function doc comment.

### WR-05: A–Z brand grouping discards non-alpha brand names into a `#` bucket with no `#` jump target

**File:** `src/app/explore/brands/page.tsx:33-38, 94`
**Issue:** Brands are bucketed by first letter:
```ts
const letter = brand.name[0]?.toUpperCase() ?? '#'
```
A brand whose name starts with a digit or symbol (e.g. "8 Faces", or any future
"+", "& Co" brand) is placed in a `'#'` bucket. But the rendered letter sections
only iterate `ALPHABET` (A–Z) at line 94: `ALPHABET.filter((l) => byLetter.has(l))`.
The `'#'` bucket is never in `ALPHABET`, so any such brand is **silently dropped
from the page entirely** — it has a count, a slug, and a row in the DAL result,
but never renders. The A–Z jump nav also has no `#` entry. With the current
catalog this may not trigger, but it is a latent data-loss-from-view bug the
moment a non-alpha brand is added.

**Fix:** Render the `#` bucket explicitly, e.g. iterate
`[...ALPHABET, '#'].filter((l) => byLetter.has(l))` and add a `#` jump target,
or normalize non-alpha brands into a defined section.

### WR-06: Era/genre deep-link values are not validated before becoming a query predicate

**File:** `src/app/explore/eras/page.tsx:63`, `src/app/explore/genres/page.tsx:75`
**Issue:** The index pages build deep-links from raw DAL values
(`/search?tab=watches&era=${row.era}`, `&genre=${row.genre}`). That is fine for
DB-sourced values, but combined with WR-01 (the `/search` action does not
constrain era/genre) it means the *only* validation of these categorical facets
anywhere in the chain is "the DAL happened to emit them." A hand-crafted URL
bypasses the index pages entirely. This is the consumer-side half of WR-01 and
is fixed by fixing WR-01; flagged separately so the fix is verified end-to-end
(index link → URL → useSearchState → action → DAL).

**Fix:** Covered by WR-01 — once the Zod schema enforces the enum, malformed
era/genre values are rejected at the Server Action boundary regardless of entry
point. No change needed on the index pages themselves beyond confirming the
emitted values are members of the enum.

## Info

### IN-01: `getBrowseGenreCounts` and `getBrowseArchetypeCounts` are byte-identical queries

**File:** `src/data/browse.ts:36-48` and `src/data/browse.ts:86-98`
**Issue:** The two functions run the exact same SQL (`GROUP BY primary_archetype
ORDER BY count DESC`) and differ only in the result alias (`archetype` vs
`genre`). The doc comments explain the intentional UI distinction, but the
duplicated query body means a future change to the counting logic (e.g. a
`WHERE` filter) must be made in two places or they will silently diverge.

**Fix:** Extract a single private query helper and have both public functions
re-key the result, or have `getBrowseGenreCounts` call `getBrowseArchetypeCounts`
and remap `{archetype} → {genre}`. Keep the two public names for the API
distinction.

### IN-02: Inline facet-chip JSX block is duplicated verbatim between two render branches

**File:** `src/components/search/SearchPageClient.tsx:391-438` and `474-521`
**Issue:** The "removable facet chips" block (archetype/brand/era/genre buttons,
~48 lines each) is copy-pasted between the browse-mode empty-state branch and
the has-results branch of `WatchesPanel`. Any change to chip styling, the clear
handler wiring, or accessibility copy must be made twice. This is a maintenance
hazard and the kind of duplication that drifts.

**Fix:** Extract a `<FacetChipRail>` subcomponent taking
`{archetype, brand, era, genre, archetypeConfig, onClear*}` and render it once
in each branch.

### IN-03: Brand/genre chip labels use naive `charAt(0).toUpperCase()` capitalization

**File:** `src/components/search/SearchPageClient.tsx:410, 432` (and 493, 515)
**Issue:** `brand.charAt(0).toUpperCase() + brand.slice(1)` capitalizes only the
first character of a slug. A brand slug like `grand-seiko` renders as
`Grand-seiko`, and `a-lange-sohne` as `A-lange-sohne`. The genre chips have the
same issue (though the 10 genre values are all single lowercase words, so they
render acceptably today). Eras already have a proper `ERA_DISPLAY_LABELS` map;
brands have none.

**Fix:** Thread the real `brand.name` through from the deep-link or a lookup
rather than title-casing the slug, or apply a per-hyphen-segment capitalization
as a stopgap. Genres could reuse a display-name map for consistency with the
`/explore/genres` page's `GENRE_DISPLAY_NAMES`.

### IN-04: `WatchesPanel` default-param values are dead — caller always passes them

**File:** `src/components/search/SearchPageClient.tsx:320-323`
**Issue:** `WatchesPanel` declares `archetype = null, brand = null, era = null,
genre = null` defaults and the props are typed optional (`archetype?`). The sole
call site (line 185-201) always passes all four explicitly, so the defaults and
the optional markers are never exercised. Minor — it implies an optionality that
does not exist and slightly obscures the real contract.

**Fix:** Make the props required (drop `?` and the `= null` defaults) to match
actual usage, or leave as-is if a future second call site is planned.

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

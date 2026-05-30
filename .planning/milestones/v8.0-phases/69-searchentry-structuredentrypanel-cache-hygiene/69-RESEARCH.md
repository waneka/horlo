# Phase 69: SearchEntry + StructuredEntryPanel + Cache Hygiene — Research

**Researched:** 2026-05-28
**Domain:** React component authoring, @base-ui/react/combobox, module-scope Map cache pattern, Drizzle DAL, Server Action debounce patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use `@base-ui/react/combobox` — already installed at 1.3.0
- **D-02:** Controlled query input (`inputValue` + `onInputValueChange`) + uncontrolled selection/open state
- **D-03:** Emit `onPick(result: SearchCatalogWatchResult)` upward — full row, not just id
- **D-04:** Mirror `useSearchState.ts:130–133` debounce (setTimeout 250ms) + `useSearchState.ts:228–253` AbortController stale-result guard, byte-for-byte
- **D-05:** No-match empty state renders OUTSIDE Combobox popup, inline below input in normal document flow; listbox closes when empty state mounts
- **D-06:** Each cache hook owns its own `lastUserId` check inline in render — mirrors `useWatchSearchVerdictCache.ts:42–45` pattern with `viewerUserId` as discriminant
- **D-07:** Prop-drill `viewerUserId` from `AddWatchFlow` — no `getUser()` inside hooks
- **D-08:** Add `viewerUserId` as **required positional arg** to both existing hooks (breaks callers intentionally so TypeScript surfaces every site)
- **D-09:** Per-hook unit tests + AddWatchFlow integration test; NO static fs-guard tests
- **D-10:** Inline expand under search input — query stays visible; panel below it
- **D-11:** `SearchEntry` renders `StructuredEntryPanel` as its no-match child
- **D-12:** Longest-prefix brand match against catalog brand list (sorted DESC by length) → fall back to naive 3-token split on miss; `year` always empty; full algorithm + 6 test cases pinned in CONTEXT.md
- **D-13:** New `listCatalogBrands(): Promise<string[]>` DAL fn in `src/data/catalog.ts`, SSR-fetched by `/watch/new/page.tsx`, prop-drilled as `catalogBrands: string[]`
- **D-14:** Single inline-expand mechanism, two entry points (footer when results > 0 AND empty state when results === 0 && query.length >= 3)
- **D-15:** 2-col responsive grid `grid grid-cols-1 gap-3 sm:grid-cols-2` for the 4-field panel
- **D-16:** Photo affordance inline (always rendered) below fields; URL backup ghost link below "Find specs" CTA
- **D-17:** In-place `<VerdictSkeleton>` during structured-extract round-trip; "Find specs" button disabled + spinner
- **D-18:** Cache key = `JSON.stringify({brand: lower+trim, model: lower+trim, reference: lower+trim, year: null})` for structured cache; `query.trim().toLowerCase()` for search cache

### Claude's Discretion

- Cache key for `useCatalogSearchCache`: `query.trim().toLowerCase()` — strip internal whitespace is planner's call
- `ExtractErrorCard` structured-mode `structured-data-missing` copy text — draft direction: "Couldn't find specs for that watch. Try adding a reference number, or enter manually."
- Viewer-state pill copy: spec text wins — "In collection" / "On wishlist" (NOT "Owned"/"Wishlist" from WatchSearchRow)
- Combobox slot className styling — planner picks tokens during UI-SPEC
- `HighlightedText` target: `${result.brand} ${result.model}` AND `result.reference` (matches WatchSearchRow:49–54 precedent)
- `/watch/new` page-prop addition `catalogBrands` alongside `viewerUserId`
- Owners count 0: render "0 collectors" (honest, no special "be the first" copy)
- Result-row scroll-into-view on arrow nav: base-ui handles automatically

### Deferred Ideas (OUT OF SCOPE)

- Extract `useTypeaheadSearch` shared hook
- Brand-list staleness handling
- "0 collectors" copy variant polish
- `<HorloCombobox>` wrapper abstraction
- Phase 70 follow-ups: DUPE wiring, `onSwitchToUrl()`, three-layer reset extension for new caches
- Phase 71 follow-ups: delete VerdictStep/WishlistRationalePanel/PasteSection, FlowState cleanup
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-17 | User can type in a search input as primary entry to `/watch/new` | SearchEntry component with Combobox.Input controlled by `inputValue` prop |
| SRCH-18 | Results fire at ≥2 chars with ~200–250ms debounce via Server Action | `searchCatalogForAddFlow` action (Phase 67-shipped); debounce mirrors `useSearchState.ts:130–133` |
| SRCH-19 | Each result row shows brand, model, reference, cover photo, viewer-state badge | `SearchCatalogWatchResult` has all these fields; pill copy per CONTEXT spec text |
| SRCH-20 | Keyboard navigation via `role="listbox"` + `role="option"` ARIA | `@base-ui/react/combobox` 1.3.0 provides full WAI-ARIA combobox pattern automatically |
| SRCH-21 | Clicking a result advances the flow (DUPE branching) | `onPick(result)` emitted upward per D-03; Phase 70 owns DUPE wiring |
| SRCH-22 | Matched-text substring highlighted via existing HighlightedText | `<HighlightedText text q />` API confirmed; reuse against brand/model and reference |
| SRCH-23 | Owners count displayed per row ("47 collectors") | `ownersCount` field on `SearchCatalogWatchResult`; "0 collectors" for zero |
| SRCH-24 | "Not finding it? Add manually" footer below results + in empty state | D-14: single expand mechanism, two entry points both wired to same handler |
| SRCH-25 | No-match empty state with structured-input CTA + URL backup link | D-05 renders inline below input; D-11 SearchEntry owns StructuredEntryPanel |
| SRCH-26 | Query pre-seeds structured-input fields | `parseSearchQuery(q, catalogBrands)` helper; D-12 algorithm pinned |
| EXTR-05 | Loading state during LLM round-trip; explicit "Find specs" button | `<VerdictSkeleton>` at `@/components/insights/VerdictSkeleton`; no-args API |
| EXTR-06 | Photo-upload affordance on structured-input screen | `<CatalogPhotoUploader onPhotoReady onError onClear? disabled? copy? />` |
| EXTR-07 | "Have a URL for this watch?" secondary affordance | Ghost link emitting `onSwitchToUrl()` upward (Phase 70 wires the routing) |
| CLNP-07 | All 4 module-scope caches clear on signOut via `lastUserId` check | Retrofit pattern from `useWatchSearchVerdictCache.ts:42–45`; D-06/D-07/D-08 |
</phase_requirements>

---

## Summary

Phase 69 builds eight discrete deliverables, all shipped dormant — Phase 70 wires them into `AddWatchFlow`. The two new components (`SearchEntry`, `StructuredEntryPanel`) are pure presenters in the Phase 68 tradition: props in, callbacks out, no internal data fetching beyond the debounced Server Action call inside SearchEntry.

The cache hygiene work (CLNP-07) touches four files: two new caches mirror the existing `useUrlExtractCache` shape, and two existing caches gain a required `viewerUserId` positional arg. The required-arg break is intentional — TypeScript surfaces all three call sites that need updating. The `WatchSearchRowsAccordion` site is on `/search`, and `viewerId` is already in scope there via `SearchPageClient`'s `viewerId` prop — the retrofit threads it to `WatchSearchRowsAccordion`.

The `@base-ui/react/combobox` installed at 1.3.0 (exact) provides the correct slot set. The key architectural decision is using `filteredItems` (not `items` + internal filter) for the async search case: pass the Server Action results as `filteredItems` so base-ui skips its own filter pass and renders exactly what the debounced fetch returned.

**Primary recommendation:** Build in file order — DAL fn, caches, parseSearchQuery helper, SearchEntry, StructuredEntryPanel, ExtractErrorCard mod, page/flow prop additions. Each piece is independently testable before the next depends on it.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Typeahead query + debounce | Browser / Client | — | Debounce is pure client-side timing; Server Action call fires from effect |
| Catalog search results fetch | API / Backend (Server Action) | Browser (cache) | `searchCatalogForAddFlow` runs server-side; results cached client-side in `useCatalogSearchCache` |
| Structured extract (LLM) | API / Backend | Browser (cache) | `/api/extract-watch?mode=structured` runs LLM server-side; result cached in `useStructuredExtractCache` |
| Brand list for pre-seed | Frontend Server (SSR) | — | `listCatalogBrands` fetched at SSR time in `/watch/new/page.tsx` per D-13 |
| Cache signOut hygiene | Browser / Client | — | Module-scope Map reset in render — no server involvement |
| Query pre-seeding | Browser / Client | — | `parseSearchQuery` is a pure client-side helper |

---

## Phase Goal Decomposition

Eight concrete deliverables:

1. `src/data/catalog.ts` — new `listCatalogBrands()` DAL fn
2. `src/lib/searchEntry/parseSearchQuery.ts` — pure query parser helper + test
3. `src/components/watch/useCatalogSearchCache.ts` — new module-scope cache (+ test)
4. `src/components/watch/useStructuredExtractCache.ts` — new module-scope cache (+ test)
5. Retrofit `src/components/watch/useUrlExtractCache.ts` — add `viewerUserId` arg + reset block
6. Retrofit `src/components/search/useWatchSearchVerdictCache.ts` — add `viewerUserId` arg + reset block
7. `src/components/watch/SearchEntry.tsx` — Combobox typeahead component
8. `src/components/watch/StructuredEntryPanel.tsx` — 4-field structured form
9. Retrofit `src/components/watch/ExtractErrorCard.tsx` — mode-branched copy for `structured-data-missing`
10. Retrofit `src/app/watch/new/page.tsx` — add `catalogBrands` prop
11. Retrofit `src/components/watch/AddWatchFlow.tsx` — add `catalogBrands` prop, update both cache call sites
12. Retrofit `src/components/search/WatchSearchRowsAccordion.tsx` — add `viewerUserId` to `useWatchSearchVerdictCache` call

(Note: items 5/6/9/10/11/12 are modifications to existing files; items 1–4, 7, 8 are new files.)

---

## Locked Decisions Summary (D-01..D-18 Quick Reference)

| # | Essence |
|---|---------|
| D-01 | `@base-ui/react/combobox` (1.3.0 installed) — already in production |
| D-02 | Controlled `inputValue`/`onInputValueChange`; uncontrolled open/selection |
| D-03 | `onPick(result: SearchCatalogWatchResult)` — emit full row, not just id |
| D-04 | Copy `useSearchState.ts:130–133` (debounce) and `:228–253` (AbortController) verbatim |
| D-05 | No-match renders OUTSIDE Combobox popup; listbox closes first |
| D-06 | `if (moduleUserId !== viewerUserId) { moduleCache = new Map(); moduleUserId = viewerUserId }` at top of each hook body |
| D-07 | Prop-drill `viewerUserId` from AddWatchFlow — no client `getUser()` |
| D-08 | Required positional `viewerUserId` breaks 3 existing callers by design |
| D-09 | Per-hook unit tests + AddWatchFlow integration test; no static fs guards |
| D-10 | Inline expand below search input; query stays visible at top |
| D-11 | SearchEntry owns StructuredEntryPanel (single composed entry surface) |
| D-12 | Longest-prefix brand match → fallback naive split; 6 canonical test cases pinned |
| D-13 | `listCatalogBrands()` SSR-fetched at `/watch/new`, prop-drilled through AddWatchFlow → SearchEntry |
| D-14 | Footer when results > 0 AND empty-state CTA when results === 0 — same expand handler |
| D-15 | Grid: `grid grid-cols-1 gap-3 sm:grid-cols-2`; row 1 = brand/model; row 2 = ref/year |
| D-16 | CatalogPhotoUploader always-visible below fields; URL ghost link below CTA |
| D-17 | `<VerdictSkeleton>` in-place below "Find specs"; button disabled+spinner |
| D-18 | JSON.stringify key with per-field lower+trim; `year: null` for absent |

---

## `@base-ui/react/combobox` API Reference (v1.3.0 Installed)

[VERIFIED: node_modules/@base-ui/react/combobox/]

### Slot Inventory

The installed package exports these slots via `Combobox.*`:

| Slot | Element | Purpose |
|------|---------|---------|
| `Root` | none (wraps) | State machine root — owns open/value/inputValue state |
| `Input` | `<input>` | Text entry; bind `inputValue` + `onInputValueChange` here |
| `Trigger` | `<button>` | Toggle-open button (optional for our use case — can omit) |
| `Positioner` | `<div>` | Anchor-positioned wrapper for the popup |
| `Popup` | `<div>` | Container for the list; shows/hides on open state |
| `List` | (implied via Item children) | Renders `role="listbox"` |
| `Item` | `<div>` with `role="option"` | Each result row; `value` prop is the picked value |
| `ItemIndicator` | `<span>` | Renders when item is selected (optional) |
| `Empty` | `<div>` | Renders ONLY when `items` prop is passed AND list is empty; NOT our pattern |
| `Status` | `<div>` | Announces list-change count to screen readers |
| `Clear` | `<button>` | Clears the input value |
| `Portal` | — | Renders popup outside current DOM tree |
| `Arrow` | `<div>` | Popup arrow |
| `Label` | `<label>` | Associated label |
| `Value` | `<span>` | Displays selected value text |
| `Chips` / `Chip` / `ChipRemove` | — | Multi-select chip UI (not used here) |

### Key Root Props

```typescript
// Source: node_modules/@base-ui/react/combobox/root/AriaCombobox.d.ts
<Combobox.Root<SearchCatalogWatchResult>
  // Controlled query — D-02 pattern
  inputValue={query}                          // string
  onInputValueChange={(val) => setQuery(val)} // fires on every keystroke
  
  // Uncontrolled selection — D-02 pattern (value / onValueChange handle selection)
  onValueChange={(picked) => {
    if (picked) onPick(picked)
  }}
  
  // For async external filtering: pass results as filteredItems
  // This bypasses base-ui's internal filter pass entirely
  filteredItems={results}
  
  // Uncontrolled open state — base-ui manages open/close
  // Pass open={false} to force-close when empty state should show
  
  // Optional — not needed for search-first UX
  autoHighlight={false}
  highlightItemOnHover={true}  // default
>
```

### Controlled-Query / Uncontrolled-Selection Pattern (D-02)

The critical distinction: `inputValue` + `onInputValueChange` control what the user typed; `onValueChange` fires when an item is actually selected. This is the correct model for "picker" semantics where the input value drives the debounced search but picking a row is a discrete event.

```typescript
// CORRECT — async external filtering pattern
// Source: node_modules/@base-ui/react/combobox/root/AriaCombobox.d.ts (filteredItems)
<Combobox.Root<SearchCatalogWatchResult>
  inputValue={query}
  onInputValueChange={(val) => setQuery(val)}
  filteredItems={results}           // pass DAL results directly
  filter={null}                     // MUST set filter=null to disable internal filter
  onValueChange={(picked) => {
    if (picked) onPick(picked)
  }}
>
```

**Pitfall:** If you pass `items` without `filter={null}`, base-ui will attempt to filter `items` using its internal string-match filter. For async search results (already filtered server-side), use `filteredItems` OR pass `items` with `filter={null}`.

### Item Value and String Conversion

Since `SearchCatalogWatchResult` objects don't have a `{ value, label }` shape, the planner must specify `itemToStringLabel` to prevent base-ui from attempting to stringify the object:

```typescript
itemToStringLabel={(result) => `${result.brand} ${result.model}`}
itemToStringValue={(result) => result.catalogId}
```

### Open Control for Empty State (D-05)

When `query.length >= 3 && results.length === 0`, SearchEntry should force-close the popup so StructuredEntryPanel renders below in normal flow. Use the `open` prop on `Combobox.Root` for this case:

```typescript
const forceClose = query.length >= 3 && results.length === 0
// Pass open={false} when forcing closed for empty state
open={forceClose ? false : undefined}   // undefined = uncontrolled
```

Alternatively, manage `open` fully controlled. Either approach is valid — planner picks.

### Item Composition

```typescript
// Each result row
<Combobox.Item
  value={result}           // full SearchCatalogWatchResult object
  key={result.catalogId}
  index={i}                // improves perf when count known
>
  {/* Custom row content — SearchEntry mirrors WatchSearchRow visually */}
  <Image ... />
  <span>{result.brand} {result.model}</span>
  {/* viewer-state pill */}
</Combobox.Item>
```

Data attributes on `Item` per base-ui convention: `data-highlighted` when keyboard-focused (use for CSS highlight state).

---

## Existing Patterns to Mirror

### Debounce — `useSearchState.ts:129–133`

[VERIFIED: src/components/search/useSearchState.ts]

```typescript
// COPY VERBATIM per D-04
useEffect(() => {
  const t = setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS)  // DEBOUNCE_MS = 250
  return () => clearTimeout(t)
}, [q])
```

SearchEntry has a simpler lifecycle (single query, not multi-tab), so `q` is the local `query` state and `debouncedQuery` drives the Server Action fetch.

### AbortController — `useSearchState.ts:228–253`

[VERIFIED: src/components/search/useSearchState.ts]

```typescript
// COPY VERBATIM per D-04 (adapted for searchCatalogForAddFlow)
useEffect(() => {
  if (debouncedQuery.trim().length < 2) {
    setResults([])
    return
  }
  // Check cache first (D-18 symmetric normalization)
  const cacheKey = debouncedQuery.trim().toLowerCase()
  const cached = cache.get(cacheKey)
  if (cached) {
    setResults(cached)
    return
  }

  const controller = new AbortController()
  setIsLoading(true)

  void (async () => {
    try {
      const res = await searchCatalogForAddFlow({ q: debouncedQuery })
      if (controller.signal.aborted) return  // stale-result guard
      if (res.success) {
        cache.set(cacheKey, res.data)
        setResults(res.data)
      } else {
        setResults([])
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      if (controller.signal.aborted) return
      setResults([])
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  })()

  return () => controller.abort()
}, [debouncedQuery])
```

### Cache In-Render Reset — `useWatchSearchVerdictCache.ts:38–45`

[VERIFIED: src/components/search/useWatchSearchVerdictCache.ts]

```typescript
// Current pattern (collectionRevision as discriminant)
export function useWatchSearchVerdictCache(collectionRevision: number) {
  if (moduleRevision !== collectionRevision) {
    moduleCache = new Map()
    moduleRevision = collectionRevision
  }
  ...
}

// Phase 69 retrofit pattern (viewerUserId ADDED as second required positional arg)
export function useWatchSearchVerdictCache(
  collectionRevision: number,
  viewerUserId: string,      // NEW — required, not optional
) {
  // User-switch check FIRST (outer guard)
  if (moduleUserId !== viewerUserId) {
    moduleCache = new Map()
    moduleUserId = viewerUserId
    moduleRevision = 0        // reset revision too so next check fires on revision
  }
  // Then revision check (inner guard — same as today)
  if (moduleRevision !== collectionRevision) {
    moduleCache = new Map()
    moduleRevision = collectionRevision
  }
  ...
}
```

Note: The planner must add `let moduleUserId = ''` module-level variable alongside the existing `let moduleRevision = 0`. The `__resetVerdictCacheForTests()` function must also reset `moduleUserId = ''`.

### `useUrlExtractCache.ts` Full Export Shape

[VERIFIED: src/components/watch/useUrlExtractCache.ts]

Current export surface:
```typescript
export type ExtractCacheEntry = { catalogId: string; extracted: ExtractedWatchData; catalogIdError: string | null }
export function __resetUrlExtractCacheForTests(): void  // resets moduleCache
export function useUrlExtractCache(): { get(url: string): ExtractCacheEntry | undefined; set(url: string, entry: ExtractCacheEntry): void }
```

Phase 69 retrofit:
```typescript
// Add viewerUserId as required positional arg
let moduleCache: Map<string, ExtractCacheEntry> = new Map()
let moduleUserId = ''                    // NEW module-level var

export function __resetUrlExtractCacheForTests(): void {
  moduleCache = new Map()
  moduleUserId = ''                      // ALSO reset this
}

export function useUrlExtractCache(viewerUserId: string) {  // NEW arg
  if (moduleUserId !== viewerUserId) {   // NEW in-render check
    moduleCache = new Map()
    moduleUserId = viewerUserId
  }
  return {
    get: (url: string) => moduleCache.get(url),
    set: (url: string, entry: ExtractCacheEntry) => { moduleCache.set(url, entry) },
  }
}
```

### `WatchSearchRow.tsx` Visual Reference

[VERIFIED: src/components/search/WatchSearchRow.tsx]

Row composition to mirror in SearchEntry items:
- Outer: `flex items-center gap-2 min-h-16` container
- Left: `size-10 md:size-12 rounded-full bg-muted ring-2 ring-card overflow-hidden` image circle; `<Image fill className="object-cover" unoptimized>` or `<WatchIcon>` fallback
- Middle: `flex-1 min-w-0` text block; `text-sm font-semibold truncate` for brand/model; `text-sm text-muted-foreground truncate` for reference
- Highlight: `<HighlightedText text={`${result.brand} ${result.model}`} q={query} />` and separately `<HighlightedText text={result.reference} q={query} />`
- Right: viewer-state pill — `text-xs font-semibold px-2 py-0.5 rounded-full shrink-0`

**Divergence from WatchSearchRow:** SearchEntry uses spec copy ("In collection" / "On wishlist"), not WatchSearchRow's "Owned" / "Wishlist". Also adds owners count ("47 collectors") per SRCH-23. Does NOT wrap the row in a `<Link>` — clicking the Item triggers onPick instead of navigating.

---

## Cache Hygiene Mechanism

### The Pattern (D-06) — Four Files

Each of the four module-scope caches adds this block at the top of the hook function body:

```typescript
// Module-level variables (alongside existing ones)
let moduleUserId = ''

// At top of hook body — BEFORE any other reads from moduleCache
if (moduleUserId !== viewerUserId) {
  moduleCache = new Map()
  moduleUserId = viewerUserId
  // If there's also a moduleRevision (verdict cache only), reset it too
}
```

This is intentional sync mutation in render. The JSDoc in `useWatchSearchVerdictCache.ts` explains why it is safe: "module state has no React-tracked subscribers, so this is a deterministic same-render reset."

### Why signOut Works Without a Subscriber

`logout()` in `src/app/actions/auth.ts` calls `supabase.auth.signOut()` then `redirect('/login')`. The redirect causes the entire `/watch/new` client tree to unmount. The next time a user signs in and navigates to `/watch/new`, the Server Component passes their `user.id` as `viewerUserId`. The first render of any cache-using component runs the `if (moduleUserId !== viewerUserId)` check, which fires because `moduleUserId` still holds the previous session's id (module scope survives page transitions). The cache is cleared then. No auth event subscription needed.

### Retrofit Call Site Map (D-08)

| File | Line | Current Call | After Retrofit |
|------|------|-------------|----------------|
| `src/components/watch/AddWatchFlow.tsx` | ~123 | `useWatchSearchVerdictCache(collectionRevision)` | `useWatchSearchVerdictCache(collectionRevision, viewerUserId)` |
| `src/components/watch/AddWatchFlow.tsx` | ~127 | `useUrlExtractCache()` | `useUrlExtractCache(viewerUserId)` |
| `src/components/search/WatchSearchRowsAccordion.tsx` | 47 | `useWatchSearchVerdictCache(collectionRevision)` | `useWatchSearchVerdictCache(collectionRevision, viewerUserId)` |

**WatchSearchRowsAccordion retrofit:** `viewerUserId` must be added as a new prop. The call chain is:
- `SearchPageClient` already has `viewerId: string` prop (the viewer's user id)
- `WatchesPanel` (internal to SearchPageClient) renders `WatchSearchRowsAccordion` at line ~456
- `WatchesPanel` currently does NOT accept `viewerId` in its prop signature
- The retrofit must: add `viewerId: string` to `WatchesPanel` props, pass it through from `SearchPageClient`, and pass it to `WatchSearchRowsAccordion` as `viewerUserId`

---

## `listCatalogBrands` DAL Pattern

[VERIFIED: src/data/catalog.ts — existing `getTopStyleTags` at line 662 as closest analog]

The closest existing analog is `getTopStyleTags` which uses a raw `db.execute(sql...)`. However, for a typed Drizzle query, use the ORM style:

```typescript
// New fn in src/data/catalog.ts
// Pattern mirrors: any existing SELECT with .from(watchesCatalog)
export async function listCatalogBrands(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ brand: watchesCatalog.brand })
    .from(watchesCatalog)
    .orderBy(asc(watchesCatalog.brand))
  return rows.map((r) => r.brand)
}
```

`selectDistinct` is Drizzle-ORM's equivalent of `SELECT DISTINCT`. The `asc` + `brand` ordering is consistent with the D-12 algorithm's normalization expectation. Public-read RLS on `watches_catalog` already allows this without a viewer identity argument.

**No `'use cache'` / `cacheLife` needed:** brand list is SSR-fetched per-request at `/watch/new` load — cheap SELECT DISTINCT at ~100 rows. Unlike `getTopStyleTags` which is wrapped in `'use cache'` for the Explore page, brand list staleness is the navigation-to-page cadence.

---

## Parser Test Matrix (D-12)

The 6 canonical test cases pinned in CONTEXT.md, plus 2 edge cases the planner should add:

| Input | catalogBrands includes | Expected output |
|-------|----------------------|-----------------|
| `"omega speedmaster 3135"` | `"Omega"` | `{ brand: 'Omega', model: 'Speedmaster', reference: '3135' }` |
| `"tag heuer monaco 1133b"` | `"Tag Heuer"` | `{ brand: 'Tag Heuer', model: 'Monaco', reference: '1133b' }` |
| `"rolex datejust"` | `"Rolex"` | `{ brand: 'Rolex', model: 'Datejust', reference: '' }` |
| `"omega"` | `"Omega"` | `{ brand: 'Omega', model: '', reference: '' }` |
| `"cartier 4329xx"` | _(Cartier not in list)_ | `{ brand: 'cartier', model: '', reference: '4329xx' }` (naive fallback) |
| `"speedmaster"` | `"Omega"` | `{ brand: 'speedmaster', model: '', reference: '' }` (no brand prefix match) |
| `"  A. Lange  Söhne  zeitwerk"` | `"A. Lange & Söhne"` | Test whitespace collapse in normalization; naive fallback expected |
| `""` (empty string) | any | `{ brand: '', model: '', reference: '' }` (edge: empty input) |

**Critical implementation note for test case (b):** The algorithm sorts `catalogBrands` by normalized length DESC before iterating. "Tag Heuer" (8 chars normalized: "tagheuer") must come before "Tag" (3 chars) so the multi-word brand wins. The match is whitespace-bounded prefix: `"tagheuermonaco1133b"` starts with `"tagheuer"` — wait, the prefix match is on the NORMALIZED form of the query, not the stripped form. The D-12 algorithm says "whitespace-bounded prefix of normalized q" — the planner must decide whether "normalized" means `lower(trim(collapse-whitespace))` only (not strip-non-alpha), or also strip non-alpha. Given D-12 says "normalize q (trim, collapse internal whitespace, lowercase)" the answer is trim+collapse+lower, not strip-non-alpha.

**Return type contract:**
```typescript
export function parseSearchQuery(
  query: string,
  catalogBrands: string[],
): { brand: string; model: string; reference: string }
// year is always empty; caller adds it from the separate year field
```

---

## `ExtractErrorCard` Mode-Branched Copy (Phase 66 D-06)

[VERIFIED: src/components/watch/ExtractErrorCard.tsx]

**Current state:** `CONTRACT_BY_CATEGORY` is a static `Record<ExtractErrorCategory, CategoryContract>`. The `structured-data-missing` entry has URL-mode copy:
```
heading: 'No watch info found'
body: "Couldn't find watch info on this page. Try the original product page or enter manually."
```

**Phase 69 change:** Add a `mode?: 'url' | 'structured'` prop to `ExtractErrorCardProps`. For `structured-data-missing` only, branch the body text on mode. The planner drafts the structured-mode copy per Claude's Discretion guidance.

**Implementation pattern (least churn):**
```typescript
// Add to ExtractErrorCardProps
mode?: 'url' | 'structured'

// In the component body, override body for the one affected row
const { Icon, heading, body: rawBody } = CONTRACT_BY_CATEGORY[category]
const body =
  category === 'structured-data-missing' && mode === 'structured'
    ? "Couldn't find specs for that watch. Try adding a reference number, or enter manually."
    : rawBody
```

The existing `ExtractErrorCard.test.tsx` tests LOCKED D-15 copy for the URL-mode `structured-data-missing` case — those tests must remain green. The planner adds a NEW test for `mode='structured'` asserting the structured-mode copy.

The `CONTRACT_BY_CATEGORY` constant JSDoc says "LOCKED per D-15 — DO NOT paraphrase." The one-row addition is explicitly authorized by Phase 66 D-06 — this is not a paraphrase, it is a NEW mode variant.

---

## Component Architecture

### SearchEntry

**File:** `src/components/watch/SearchEntry.tsx`
**Directive:** `'use client'`

Props:
```typescript
interface SearchEntryProps {
  viewerUserId: string
  catalogBrands: string[]
  onPick: (result: SearchCatalogWatchResult) => void
  onSubmitStructured: (result: ExtractedWatchData) => void
  onSwitchToUrl: () => void   // EXTR-07 escape hatch for Phase 70 wiring
}
```

Internal state:
- `query: string` — controlled input value
- `debouncedQuery: string` — 250ms debounced version
- `results: SearchCatalogWatchResult[]`
- `isLoading: boolean`
- `showPanel: boolean` — true when user explicitly clicked "Not finding it?" OR when empty state fires (query >= 3, results === 0)

Key wiring:
- `useCatalogSearchCache(viewerUserId)` for debounced fetch results
- `searchCatalogForAddFlow` Server Action
- AbortController cleanup per D-04
- `Combobox.Root` with `filteredItems={results}` + `filter={null}`

### StructuredEntryPanel

**File:** `src/components/watch/StructuredEntryPanel.tsx`
**Directive:** `'use client'`

Props:
```typescript
interface StructuredEntryPanelProps {
  viewerUserId: string
  initialBrand?: string
  initialModel?: string
  initialReference?: string
  onSubmitStructured: (result: ExtractedWatchData) => void
  onSwitchToUrl: () => void
}
```

Internal state: `brand`, `model`, `reference` (string), `year` (string | null), `photoBlob: Blob | null`, `isExtracting: boolean`, `extractError: ExtractErrorCategory | null`

Key wiring:
- `useStructuredExtractCache(viewerUserId)` for round-trip result
- POST to `/api/extract-watch` with `{ mode: 'structured', brand, model, reference, year }`
- `<ExtractErrorCard mode="structured">` for failure display

### useCatalogSearchCache

**File:** `src/components/watch/useCatalogSearchCache.ts`

```typescript
// Module scope
let moduleCache: Map<string, SearchCatalogWatchResult[]> = new Map()
let moduleUserId = ''

export function __resetCatalogSearchCacheForTests(): void {
  moduleCache = new Map()
  moduleUserId = ''
}

export function useCatalogSearchCache(viewerUserId: string) {
  if (moduleUserId !== viewerUserId) {
    moduleCache = new Map()
    moduleUserId = viewerUserId
  }
  return {
    get: (key: string) => moduleCache.get(key),
    set: (key: string, results: SearchCatalogWatchResult[]) => {
      if (moduleUserId !== viewerUserId) return  // stale-write guard
      moduleCache.set(key, results)
    },
  }
}
```

Cache key: `query.trim().toLowerCase()`

### useStructuredExtractCache

**File:** `src/components/watch/useStructuredExtractCache.ts`

Same shape as `useCatalogSearchCache` but:
- Value type: `ExtractCacheEntry` (imported from `useUrlExtractCache.ts` or re-declared)
- Cache key: `JSON.stringify({ brand: brand.trim().toLowerCase(), model: model.trim().toLowerCase(), reference: (reference ?? '').trim().toLowerCase(), year: year ?? null })`

---

## `/watch/new/page.tsx` SSR Block Addition

[VERIFIED: src/app/watch/new/page.tsx]

Current `Promise.all` at line 90:
```typescript
const [collection, catalogPrefill, viewerProfile] = await Promise.all([
  getWatchesByUser(user.id),
  catalogId ? hydrateCatalogPrefill(catalogId) : Promise.resolve(null),
  getProfileById(user.id),
])
```

D-13 adds `listCatalogBrands()` to this parallel fetch:
```typescript
const [collection, catalogPrefill, viewerProfile, catalogBrands] = await Promise.all([
  getWatchesByUser(user.id),
  catalogId ? hydrateCatalogPrefill(catalogId) : Promise.resolve(null),
  getProfileById(user.id),
  listCatalogBrands(),          // NEW — cheap SELECT DISTINCT ~100 rows
])
```

Then in the JSX:
```typescript
<AddWatchFlow
  ...
  viewerUserId={user.id}        // already present
  catalogBrands={catalogBrands} // NEW
/>
```

---

## AddWatchFlow Integration Test Extension (D-09)

[VERIFIED: src/components/watch/AddWatchFlow.test.tsx]

The existing `AddWatchFlow.test.tsx` tests the old URL-paste flow. D-09 requires an integration test that simulates user-switch and verifies no stale entry surfaces.

The new test describe block (separate from existing):

```typescript
describe('Phase 69 — cache hygiene integration (CLNP-07)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset all 4 caches before each test
    const { __resetUrlExtractCacheForTests } = await import('./useUrlExtractCache')
    const { __resetVerdictCacheForTests } = await import('@/components/search/useWatchSearchVerdictCache')
    const { __resetCatalogSearchCacheForTests } = await import('./useCatalogSearchCache')
    const { __resetStructuredExtractCacheForTests } = await import('./useStructuredExtractCache')
    __resetUrlExtractCacheForTests()
    __resetVerdictCacheForTests()
    __resetCatalogSearchCacheForTests()
    __resetStructuredExtractCacheForTests()
  })

  it('switching viewerUserId clears all 4 caches — no stale entry surfaces after rerender', async () => {
    // Seed caches for user 'a'
    // Re-render with viewerUserId='b'
    // Assert get(key) === undefined for all 4 caches
  })
})
```

**Key rendering challenge:** `AddWatchFlow` currently doesn't accept `catalogBrands` (not yet added). The integration test must be written after that prop is added, or the test file must add `catalogBrands={[]}` to all existing `render(<AddWatchFlow ...>)` calls.

The existing tests render `<AddWatchFlow>` without `viewerUserId` in some places (the prop was added in Phase 61 but the test file may not have been updated). Verify all existing `render(...)` calls have `viewerUserId` before adding new tests.

---

## Files to Create vs Modify

### New Files (5)

| File | Type | Contains |
|------|------|---------|
| `src/lib/searchEntry/parseSearchQuery.ts` | helper + export | Pure function; algorithm per D-12 |
| `src/lib/searchEntry/parseSearchQuery.test.ts` | unit test | 8 cases from Parser Test Matrix above |
| `src/components/watch/useCatalogSearchCache.ts` | cache hook | Module-scope Map + viewerUserId reset |
| `src/components/watch/useCatalogSearchCache.test.ts` | unit test | User-switch invalidation; set/get round-trip |
| `src/components/watch/useStructuredExtractCache.ts` | cache hook | Module-scope Map + D-18 key normalization |
| `src/components/watch/useStructuredExtractCache.test.ts` | unit test | Same shape as above |
| `src/components/watch/SearchEntry.tsx` | component | Combobox typeahead; debounce; inline panel |
| `src/components/watch/StructuredEntryPanel.tsx` | component | 4-field form; CatalogPhotoUploader; VerdictSkeleton |

(8 files including tests — the additional test files are part of the "5 new files" goal from CONTEXT.md but the research lists all 8 for clarity)

### Files to Modify (8)

| File | Change |
|------|--------|
| `src/data/catalog.ts` | Add `listCatalogBrands()` fn at end of DAL |
| `src/components/watch/useUrlExtractCache.ts` | Add `viewerUserId` arg; add `moduleUserId`; reset both in test helper |
| `src/components/search/useWatchSearchVerdictCache.ts` | Add `viewerUserId` arg; add `moduleUserId`; reset in test helper; update `__resetVerdictCacheForTests` |
| `src/components/watch/ExtractErrorCard.tsx` | Add `mode?` prop; branch `structured-data-missing` body |
| `src/components/watch/ExtractErrorCard.test.tsx` | Add test for `mode='structured'` structured-data-missing copy |
| `src/app/watch/new/page.tsx` | Add `listCatalogBrands()` to Promise.all; pass `catalogBrands` to AddWatchFlow |
| `src/components/watch/AddWatchFlow.tsx` | Add `catalogBrands: string[]` to props; update 2 cache call sites; forward to SearchEntry |
| `src/components/watch/AddWatchFlow.test.tsx` | Add Phase 69 cache-hygiene describe block; add `catalogBrands={[]}` to existing renders if missing |
| `src/components/search/WatchSearchRowsAccordion.tsx` | Add `viewerUserId` prop; pass to `useWatchSearchVerdictCache` |
| `src/components/search/SearchPageClient.tsx` | Thread `viewerId` into `WatchesPanel` → `WatchSearchRowsAccordion` as `viewerUserId` |

(10 file modifications; two were not in CONTEXT.md's "~4 retrofit sites" estimate — `SearchPageClient` and `WatchesPanel` props are collateral to the `WatchSearchRowsAccordion` retrofit)

---

## Validation Architecture

`nyquist_validation_enabled: true` — include.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (detected via `vitest.config.ts` / `package.json`) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm run test -- --run src/components/watch/useCatalogSearchCache.test.ts` |
| Full suite command | `npm run test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-18 | Results fire after ~250ms debounce | unit (timer mock) | `npm run test -- --run src/components/watch/SearchEntry.test.tsx` | ❌ Wave 0 |
| SRCH-20 | ARIA roles present on combobox | unit (RTL) | same as SRCH-18 | ❌ Wave 0 |
| SRCH-22 | HighlightedText renders inside result rows | unit (RTL) | same as SRCH-18 | ❌ Wave 0 |
| SRCH-26 | parseSearchQuery produces correct fields | unit (pure) | `npm run test -- --run src/lib/searchEntry/parseSearchQuery.test.ts` | ❌ Wave 0 |
| EXTR-05 | VerdictSkeleton renders during extract | unit (RTL) | `npm run test -- --run src/components/watch/StructuredEntryPanel.test.tsx` | ❌ Wave 0 |
| CLNP-07 | All 4 caches clear on viewerUserId switch | unit (render) | `npm run test -- --run src/components/watch/useCatalogSearchCache.test.ts` | ❌ Wave 0 |
| CLNP-07 | AddWatchFlow integration: user-switch clears all 4 | integration (RTL) | `npm run test -- --run src/components/watch/AddWatchFlow.test.tsx` | ✅ exists (add describe block) |
| D-15 | ExtractErrorCard locked URL-mode copy unchanged | unit | `npm run test -- --run src/components/watch/ExtractErrorCard.test.tsx` | ✅ exists (verify still passes) |
| Phase 66 D-06 | ExtractErrorCard structured-mode copy | unit | same as D-15 | ✅ exists (add test) |

### Sampling Rate

- **Per task commit:** `npm run test -- --run [specific test file]`
- **Per wave merge:** `npm run test -- --run`
- **Phase gate:** `npm run build` exit 0 (per `project_baseline_not_green_build_is_gate` memory)

### Wave 0 Gaps

- [ ] `src/lib/searchEntry/parseSearchQuery.test.ts` — covers SRCH-26, D-12 algorithm
- [ ] `src/components/watch/useCatalogSearchCache.test.ts` — covers CLNP-07 user-switch
- [ ] `src/components/watch/useStructuredExtractCache.test.ts` — covers CLNP-07 user-switch
- [ ] `src/components/watch/SearchEntry.test.tsx` — covers SRCH-18, SRCH-20, SRCH-22 (can be behavioral stubs until SearchEntry is implemented)
- [ ] `src/components/watch/StructuredEntryPanel.test.tsx` — covers EXTR-05

---

## Pitfalls / Memory Constraints

### 1. proxy_router_cache_poisoning — No `getUser()` in Cache Hooks

D-07 is motivated by this memory. Every hook that needs `viewerUserId` receives it as a prop-drilled argument from `AddWatchFlow`. Never call `createSupabaseBrowserClient().auth.getUser()` inside a cache hook — it adds per-render network cost and conflicts with the cookie-only session pattern that prevents cache poisoning.

### 2. project_vitest_static_node_env — Behavioral Tests Only

D-09 explicitly rejects static fs-guard tests (e.g., asserting the cache hook is imported from the canonical path by checking file system). If the planner is tempted to add a static guard for "these new caches are imported before they exist," do not — it will fail Vercel prebuild. Behavioral tests per D-09.

### 3. project_local_catalog_natural_key_drift — Normalization Alignment

The D-18 cache key normalization (`brand.trim().toLowerCase()`) must stay aligned with the catalog DAL's natural key normalization (`regexp_replace(lower(trim(...)), ...)`). The D-18 normalization is intentionally simpler (no strip-non-alpha) — this is acceptable for a cache key (false misses on near-duplicates are safe; false hits are the risk). If the DAL normalization ever changes, the cache key must change too.

### 4. SearchPageClient WatchesPanel prop threading

The `WatchSearchRowsAccordion` retrofit (D-08) requires threading `viewerUserId` into `WatchesPanel` (an internal function inside `SearchPageClient.tsx`). This is a collateral change to two functions in `SearchPageClient.tsx`. The TypeScript compiler will surface this when `viewerUserId` is added as a required prop to `WatchSearchRowsAccordion`.

### 5. base-ui `filteredItems` vs `items` + `filter={null}`

For async search (server-filtered results), use `filteredItems` on `Combobox.Root`. If you pass `items` without `filter={null}`, base-ui will re-filter the already-filtered results using its own string-match logic, potentially hiding rows. The `ComboboxEmpty` slot only renders when `items` is passed AND the filtered list is empty — it will NOT work correctly with `filteredItems` alone. Since D-05 specifies rendering the empty/no-match state OUTSIDE the Combobox popup anyway, this is not a problem: don't use `Combobox.Empty` at all; manage the no-match state externally via `results.length === 0 && debouncedQuery.length >= 3`.

### 6. ExtractErrorCard `mode` prop — test file has LOCKED copy

The existing `ExtractErrorCard.test.tsx` asserts the URL-mode `structured-data-missing` body verbatim as part of the LOCKED D-15 contract. Adding `mode='structured'` must NOT change the behavior when `mode` is absent or `'url'`. The fallback branch must preserve the existing URL-mode copy exactly.

### 7. mobile_ui_verify_on_prod

Both SearchEntry and StructuredEntryPanel are UI surfaces. Per the `feedback_mobile_ui_verify_on_prod` memory, mobile/visual UAT is done on prod (Vercel deploy), not locally. Plan the phase to ship dormant and bundle the prod verification with Phase 70's wiring push.

### 8. no-raw-palette guardrail (font-medium recurrence)

Phase 68 and Phase 65 both hit the `font-medium` → `font-semibold` guardrail. SearchEntry row text should use `font-semibold` for the primary brand/model text (per WatchSearchRow.tsx:48 precedent). Do not introduce `font-medium` as a raw Tailwind palette token.

---

## Open Questions / Gaps

None. CONTEXT.md covers all 18 decisions. All factual gaps resolved by source code inspection:

1. `@base-ui/react/combobox` 1.3.0 slot list — confirmed [VERIFIED]
2. `filteredItems` vs `items` for async search — confirmed `filteredItems` is the correct prop [VERIFIED]
3. `useSearchState.ts` debounce/AbortController line references — confirmed [VERIFIED]
4. `useWatchSearchVerdictCache.ts:42–45` reset pattern — confirmed [VERIFIED]
5. `useUrlExtractCache.ts` full export shape — confirmed [VERIFIED]
6. `SearchCatalogWatchResult` shape — confirmed; `ownersCount` present [VERIFIED]
7. `SearchPageClient.viewerId` available for WatchSearchRowsAccordion retrofit — confirmed [VERIFIED]
8. `AddWatchFlow.test.tsx` structure for integration test extension — confirmed [VERIFIED]
9. `VerdictSkeleton` zero-arg API — confirmed [VERIFIED]
10. `CatalogPhotoUploader` props contract — confirmed [VERIFIED]

One noteworthy finding that the CONTEXT.md anticipated but is now confirmed: `WatchesPanel` (internal to `SearchPageClient.tsx`) does NOT currently pass `viewerId` to `WatchSearchRowsAccordion`, and `WatchesPanel` does NOT have `viewerId` in its own prop signature. The retrofit is 3-layer: `SearchPageClient` → `WatchesPanel` (add `viewerId` prop) → `WatchSearchRowsAccordion` (add `viewerUserId` prop). This is more than the CONTEXT.md implied ("SearchPageClient likely has `user.id` available — confirm during planning"), but the fix is mechanical.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `filteredItems` with `filter={null}` is the correct pattern for async external filtering in base-ui Combobox 1.3.0 | `@base-ui/react/combobox` API Reference | Planner may need to use `items` + `filter={null}` instead if `filteredItems` has different open/close semantics |
| A2 | `selectDistinct` is available in the installed Drizzle ORM version used by this project | listCatalogBrands | May need `sql` raw query fallback if Drizzle version is too old |

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@base-ui/react/combobox/` — slot inventory, Root/Input/Item/Positioner/Popup/Empty type defs, AriaCombobox props (filteredItems, inputValue, onInputValueChange)
- `src/components/search/useSearchState.ts` — debounce pattern (L130–133), AbortController pattern (L228–253)
- `src/components/search/useWatchSearchVerdictCache.ts` — in-render reset pattern (L38–45), full export shape
- `src/components/watch/useUrlExtractCache.ts` — full export shape, ExtractCacheEntry type
- `src/components/search/WatchSearchRow.tsx` — row visual composition
- `src/components/search/HighlightedText.tsx` — API: `{ text: string, q: string }`
- `src/components/insights/VerdictSkeleton.tsx` — zero-arg component
- `src/components/watch/CatalogPhotoUploader.tsx` — full props contract
- `src/components/watch/ExtractErrorCard.tsx` — current shape, CONTRACT_BY_CATEGORY
- `src/components/watch/AddWatchFlow.tsx` — AddWatchFlowProps (L52–85), cache call sites (L123, L127)
- `src/components/watch/AddWatchFlow.test.tsx` — integration test structure + mock patterns
- `src/components/search/WatchSearchRowsAccordion.tsx` — L47 cache call site; existing props
- `src/components/search/SearchPageClient.tsx` — WatchesPanel props, WatchSearchRowsAccordion call site
- `src/app/watch/new/page.tsx` — SSR data-fetch block, AddWatchFlow props
- `src/app/actions/search.ts:158` — searchCatalogForAddFlow action signature
- `src/data/catalog.ts` — DAL patterns, getTopStyleTags analog, searchCatalogForAddFlow DAL
- `src/lib/searchTypes.ts` — SearchCatalogWatchResult shape (ownersCount confirmed)
- `.planning/phases/69-searchentry-structuredentrypanel-cache-hygiene/69-CONTEXT.md` — D-01..D-18, all locked decisions
- `.planning/REQUIREMENTS.md` — SRCH-17..26, EXTR-05/06/07, CLNP-07 requirement text

### Secondary (MEDIUM confidence)
- `node_modules/@base-ui/react/package.json` — version 1.3.0 confirmed

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all deps verified installed at exact versions
- Architecture: HIGH — all source files read; patterns verified
- Pitfalls: HIGH — based on direct code inspection, not training data
- Combobox API: HIGH — type defs read from node_modules directly
- `filteredItems` semantics: MEDIUM (A1) — type defs confirm prop exists; runtime behavior inferred from docs in type def comments

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (stable dep surface; base-ui 1.3.0 pinned)

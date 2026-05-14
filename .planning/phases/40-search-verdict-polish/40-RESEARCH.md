# Phase 40: Search & Verdict Polish — Research

**Researched:** 2026-05-14
**Domain:** Faceted search DAL extension + CollectionFitCard pure-renderer extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Browse mode:** Selecting any facet with empty `q` triggers a fetch. DAL lifts the `trimmed.length < 2` early-return when ≥1 facet predicate is active. Empty result + no facets + empty q still returns `[]` (pre-query state preserved).

**D-02 — Facets fire instantly, no debounce.** Chip click → URL update + immediate `searchWatchesAction` call. Separate code path from the 250ms `q` debounce in `useSearchState`.

**D-03 — URL params: separate per facet, comma-joined for multi.** `?q=sub&movement=auto&size=40-42&style=tool,diver`. Single-value facets (`movement`, `size`) are scalar; `style` is comma-joined. URL-safe encoding for edge values: `<36` → `lt36`; `46+` → `46plus`.

**D-04 — Watches tab only.** Facet params survive tab switches but ONLY influence the Watches sub-effect DAL path.

**D-05 — Case Size = 5 chip bands.** Exactly `<36` / `36-39` / `40-42` / `43-45` / `46+`. Each chip maps to a DAL `between()` predicate. REQUIREMENTS.md SRCH-16 says "numeric range slider" — that is wrong and must be updated as a paperwork task.

**D-06 — Style chip vocab: top-8 by frequency from `watches_catalog.style_tags`.** Computed once per request (or cached). No overflow expander.

**D-07 — Style multi-select OR-logic within facet.** Postgres `&&` overlap operator. Across facets, predicates AND-narrow.

**D-08 — NULL rows excluded when their facet is active.** `IS NOT NULL` added per active facet. Style array default `'{}'` naturally fails `&&` overlap when empty — no special handling.

**D-09 — Filter trigger: inline button above results, active-count badge.** Between Tabs row and WatchSearchRowsAccordion. Scrolls with page. Badge = total active facet count (style chips counted individually).

**D-10 — Same bottom-sheet on all widths.** `Sheet` primitive with `side='bottom'`.

**D-11 — Commit on chip-tap inside the sheet, no Apply button.** Footer has only "Clear all" + drag-handle close.

**D-12 — Drill-down placement: always-visible section below `mostSimilar`.** No accordion. Auto-targets `mostSimilar[0]`. Hidden when `mostSimilar.length === 0`.

**D-13 — 2-column layout, max 2 items on mobile.** Still 2 columns side-by-side — no third column.

**D-14 — 6 CAT-13 taste fields only:** `formality` / `sportiness` / `heritageScore` / `primaryArchetype` / `eraSignal` / `designMotifs`. No spec rows.

**D-15 — Confidence gate: hide entire section when either side is low-confidence.** `candidate.catalogTaste === null || candidate.catalogTaste.confidence < 0.5 || mostSimilar[0].watch.catalogTaste === null || mostSimilar[0].watch.catalogTaste.confidence < 0.5` → render nothing. Other CollectionFitCard sections still render.

**D-16 — Delta row: single highest-delta dimension as plain-language phrase.** 5-step algorithm (see Phase 40 CONTEXT.md § D-16).

**Pure-renderer invariant:** CollectionFitCard MUST NOT import `@/lib/similarity` or `@/lib/verdict/composer`. `tests/static/CollectionFitCard.no-engine.test.ts` must stay green.

**Phase 35 carry-forward:** SRCH-16 Movement Type facet MUST query `watches_catalog.movement_type` (pgEnum column), not deprecated free-text `movement`. ROADMAP SC#4 enforces this with a test assertion.

**Phase 38 carry-forward:** `Watch.catalogTaste` populated via `getWatchesByUser` LEFT JOIN — FIT-05 reads from `mostSimilar[i].watch.catalogTaste` without new DAL.

### Claude's Discretion

- Sheet internal layout — exact arrangement of the 3 chip groups inside the bottom-sheet (section headers, vertical stack). UI-SPEC decides.
- Top-N caching strategy for style vocab (D-06) — server fetch on /search page mount vs `use cache` DAL function vs client constant from separate endpoint. Planner picks.
- FIT-05 column header voice — "This watch" + "Your {Brand Model}" vs other framing. UI-SPEC picks.
- Delta row scalar threshold — `0.1` suggested floor; planner may calibrate.
- Case Size band labels in chip UI — `40-42mm` / `40-42` / `40 to 42mm`. UI-SPEC picks.

### Deferred Ideas (OUT OF SCOPE)

- Range slider variant of Case Size
- Filter on People + Collections + All tabs
- Apply button + staged preview count inside sheet
- Picker to swap which owned watch is compared in FIT-05
- Spec rows in FIT-05 compare table
- NSV-41 search inline-expand fresh-account verdict reshape
- Active facet chip strip above results
- Sticky filter button on scroll
- Right-side drawer on desktop
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-16 | `/search` Watches tab gains Movement Type, Case Size, Style faceted filters with bottom-sheet mobile UX and URL-shareable state | DAL extension via `between()`, `eq()`, `arrayOverlaps()` in Drizzle; `useSearchState` extended with facet sub-effect; `searchWatchesAction` Zod schema extended; `Sheet` primitive ready |
| FIT-05 | CollectionFitCard gains pairwise drill-down section comparing candidate vs `mostSimilar[0]` on 6 CAT-13 taste fields, with confidence gate and delta row | Candidate `catalogTaste` NOT currently in `VerdictBundleFull` — must be threaded in; `mostSimilar[0].watch.catalogTaste` IS already present via collection LEFT JOIN |
</phase_requirements>

---

## Summary

Phase 40 ships two UX additions over existing populated catalog data. No schema changes, no engine changes. Both features are reads-only consumers of work shipped in Phases 35 (movement_type enum) and 38 (CAT-13 catalogTaste LEFT JOIN).

**SRCH-16** extends three layers: the Drizzle DAL (`searchCatalogWatches` adds facet predicates + browse-mode 2-char guard lift), the Server Action (`searchWatchesAction` Zod schema gets optional facet fields), and the client hook (`useSearchState` adds facet state + URL sync + instant-trigger sub-effect for the Watches tab). The filter affordance is a `Sheet side='bottom'` trigger inline above results.

**FIT-05** extends `CollectionFitCard.tsx` with an always-visible 2-column compare section. The critical open question has been resolved: `mostSimilar[0].watch.catalogTaste` IS present (from `getWatchesByUser` LEFT JOIN threading through `analyzeSimilarity` → `VerdictBundleFull`), but the **candidate's** `catalogTaste` is NOT in `VerdictBundleFull` — `catalogEntryToSimilarityInput` (shims.ts) does not map taste fields, and the composer does not thread them into the bundle. This is the one NEW task: extend `VerdictBundleFull` with `candidateCatalogTaste: CatalogTasteAttributes | null` and thread it through the composer.

**Primary recommendation:** Plan in two distinct feature areas (SRCH-16 + FIT-05) with a shared Wave 0 for test scaffolding. FIT-05 needs a small type + composer extension task before the card render task.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Facet predicate composition | API / Backend (DAL) | — | SQL WHERE clause lives in `src/data/catalog.ts`; never in client |
| Facet URL state + instant trigger | Browser / Client | — | `useSearchState` hook in `'use client'` SearchPageClient |
| Facet Server Action input validation | API / Backend (Server Action) | — | Zod schema extension in `src/app/actions/search.ts` |
| Bottom-sheet filter UI | Browser / Client | — | Sheet primitive + chip groups in SearchPageClient |
| Style vocab top-8 query | API / Backend (DAL) or Frontend Server | — | New DAL function or Server Component fetch (D-06) |
| FIT-05 compare table render | Browser / Client (pure renderer) | — | CollectionFitCard is `'use client'`; no engine imports allowed |
| Candidate catalogTaste threading | API / Backend (composer + types) | — | `VerdictBundleFull` extension in `src/lib/verdict/types.ts` + `composer.ts` |
| Delta algorithm | Browser / Client (pure utility) | — | Must be computable from props only; no imports of composer or similarity |
| REQUIREMENTS.md paperwork edit | — | — | Non-code task; update SRCH-16 text to remove "numeric range slider" |

---

## CRITICAL OPEN QUESTION — RESOLVED

### Does `VerdictBundleFull` include the candidate's `catalogTaste`?

**Answer: NO — not currently.** Confirmed by reading:

1. `src/lib/verdict/types.ts:22-35` — `VerdictBundleFull` has no `candidateCatalogTaste` field. `VerdictMostSimilar.watch` is a full `Watch` (which has `catalogTaste?`), so the `mostSimilar[0].watch.catalogTaste` IS available.
2. `src/lib/verdict/composer.ts:91-96` — the composer maps `result.mostSimilarWatches` (which come from `collection`, i.e., `getWatchesByUser` output with LEFT JOIN taste) verbatim into `mostSimilar`. These watches DO carry `catalogTaste`.
3. `src/lib/verdict/shims.ts:43-63` — `catalogEntryToSimilarityInput` does NOT map `catalogTaste` or any taste fields onto the returned `Watch` object. The candidate's `catalogTaste` is `undefined` on that Watch.
4. `src/lib/verdict/composer.ts:47-53` — composer reads candidate taste into a `CandidateTasteSnapshot` (5 fields for template logic only) but does NOT include it in the returned `VerdictBundleFull`.

**Implication for planning:**

- `mostSimilar[0].watch.catalogTaste` — PRESENT. No new work.
- Candidate `catalogTaste` — MISSING from bundle. Requires:
  1. **Task A:** Add `candidateCatalogTaste: CatalogTasteAttributes | null` to `VerdictBundleFull` in `src/lib/verdict/types.ts`.
  2. **Task B:** Thread it through `computeVerdictBundle` in `composer.ts` — `catalogEntry` already provides all 7 taste fields (formality, sportiness, heritageScore, primaryArchetype, eraSignal, designMotifs, confidence) + extractedFromPhoto at lines 47-53; composer builds this into the bundle.
  3. **Task C:** All 3 call sites that build a `VerdictBundleFull` receive `catalogEntry` already — no new param needed. The 3 sites are: `src/app/catalog/[catalogId]/page.tsx:117`, `src/app/watch/[id]/page.tsx:52`, `src/app/actions/verdict.ts:63`.
  4. **Task D:** `CollectionFitCard.tsx` reads `verdict.candidateCatalogTaste` for the FIT-05 section.

- The static import-boundary guard `tests/static/CollectionFitCard.no-engine.test.ts` is unaffected — the new field is data on the bundle, not a new import.

---

## Standard Stack

### Core (all already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | `^0.45.2` | DAL query composition for facet predicates | Already in project; `between`, `arrayOverlaps`, `and`, `or` all available [VERIFIED: node_modules inspection] |
| `zod` | (project dep) | Server Action input validation | Already used in `searchSchema`; extend `.strict()` object |
| `@base-ui/react` | `^1.3.0` | Sheet/Dialog primitive for bottom-sheet | `src/components/ui/sheet.tsx` wraps `@base-ui/react/dialog`; `side='bottom'` via `data-side` CSS [VERIFIED: src/components/ui/sheet.tsx] |
| `next/cache` | (Next 16) | `use cache` / `cacheLife` for style vocab caching | `cacheComponents: true` already enabled in `next.config.ts` [VERIFIED: next.config.ts] |

### Drizzle Operators Needed for SRCH-16

All confirmed available in `drizzle-orm` root module [VERIFIED: node inspection]:

| Operator | Import | Use |
|----------|--------|-----|
| `between` | `drizzle-orm` | Case Size band ranges: `between(watchesCatalog.caseSizeMm, minVal, maxVal)` |
| `arrayOverlaps` | `drizzle-orm` | Style tag OR-logic: `arrayOverlaps(watchesCatalog.styleTags, selectedTags)` |
| `eq` | `drizzle-orm` | Movement Type exact match: `eq(watchesCatalog.movementType, selectedMovement)` |
| `isNotNull` | `drizzle-orm` | NULL exclusion when facet active: `isNotNull(watchesCatalog.movementType)` |
| `and`, `or` | `drizzle-orm` | Predicate composition |

`catalog.ts` currently imports: `and, asc, desc, eq, ilike, inArray, or, sql` — need to add `between`, `arrayOverlaps`, `isNotNull`. [VERIFIED: src/data/catalog.ts:6]

---

## Architecture Patterns

### System Architecture Diagram

```
User taps chip
     │
     ▼
useSearchState (client)
  ├── facet state: movement | size | style[]
  ├── URL sync: router.replace (scroll: false)
  │     params: ?q=&movement=auto&size=40-42&style=tool,diver
  └── Watches sub-effect (new dep: [debouncedQ, tab, movement, size, styleArr])
          │
          ├── browse-mode gate: q.length < 2 AND no facets active → skip
          ├── q.length < 2 AND ≥1 facet active → proceed (D-01)
          └── searchWatchesAction({ q, movement, size, style })
                │
                ▼
            searchWatchesAction (Server Action)
              Zod schema validation (.strict())
                │
                ▼
            searchCatalogWatches (DAL)
              WHERE:
                ILIKE OR (if q ≥ 2 chars)
                AND eq(movement_type, ...)    [if movement active]
                AND isNotNull(movement_type)  [if movement active]
                AND between(case_size_mm, ...) [if size active]
                AND isNotNull(case_size_mm)   [if size active]
                AND arrayOverlaps(style_tags, [...]) [if style active]
              ORDER BY popularity DESC, alpha
              LIMIT 50 → slice to 20
                │
                ▼
            SearchCatalogWatchResult[] → client state

FIT-05 data flow:
VerdictBundleFull (built in composer)
  ├── mostSimilar[0].watch.catalogTaste  ← PRESENT (collection LEFT JOIN)
  └── candidateCatalogTaste              ← ADD THIS (catalog entry taste fields)
           │
           ▼
       CollectionFitCard (pure renderer)
         FIT-05 section:
           confidence gate check (D-15)
             if pass → render 2-col compare table (6 fields)
                        + delta row (D-16 algorithm)
             if fail → render nothing
```

### Recommended Project Structure

No new directories needed. All changes are extensions within existing files.

```
src/
├── data/catalog.ts             # searchCatalogWatches + new getTopStyleTags
├── app/actions/search.ts       # searchWatchesAction Zod schema extended
├── lib/verdict/types.ts        # VerdictBundleFull + candidateCatalogTaste
├── lib/verdict/composer.ts     # thread candidateCatalogTaste into bundle
├── components/search/
│   ├── useSearchState.ts       # facet state + URL sync + sub-effect extended
│   ├── SearchPageClient.tsx    # Filter button + Sheet + WatchesPanel props
│   └── WatchFacetSheet.tsx     # NEW: sheet contents (chip groups)
└── components/insights/
    └── CollectionFitCard.tsx   # FIT-05 section added
tests/static/
└── catalog.movement-type-column.test.ts  # NEW: ROADMAP SC#4 assertion
```

### Pattern 1: DAL Facet Predicate Composition

**What:** Add optional `filters` param to `searchCatalogWatches`; build predicate array conditionally; AND-compose with existing ILIKE OR.

**When to use:** Any time a new optional filter needs to narrow the catalog search.

```typescript
// Source: drizzle-orm confirmed available [VERIFIED]
import { and, between, arrayOverlaps, isNotNull } from 'drizzle-orm'

interface CatalogSearchFilters {
  movement?: 'auto' | 'manual' | 'quartz' | 'spring_drive'
  size?: 'lt36' | '36-39' | '40-42' | '43-45' | '46plus'
  style?: string[]
}

const SIZE_BAND_MAP: Record<string, [number, number]> = {
  'lt36':    [0, 35.9],
  '36-39':   [36, 39],
  '40-42':   [40, 42],
  '43-45':   [43, 45],
  '46plus':  [46, 999],
}

// Predicate composition (partial sketch):
const predicates: SQL[] = []

// 2-char guard lift: when ≥1 facet active, proceed even if q is short
const hasActiveFacet = !!(filters?.movement || filters?.size || filters?.style?.length)
if (trimmed.length < SEARCH_WATCHES_TRIM_MIN_LEN && !hasActiveFacet) return []

if (trimmed.length >= SEARCH_WATCHES_TRIM_MIN_LEN) {
  predicates.push(
    or(
      ilike(watchesCatalog.brandNormalized, pattern),
      ilike(watchesCatalog.modelNormalized, pattern),
      refPattern ? ilike(watchesCatalog.referenceNormalized, refPattern) : sql`false`,
    )!,
  )
}

if (filters?.movement) {
  predicates.push(isNotNull(watchesCatalog.movementType))  // D-08 NULL exclusion
  predicates.push(eq(watchesCatalog.movementType, filters.movement))
}

if (filters?.size) {
  const [min, max] = SIZE_BAND_MAP[filters.size]
  predicates.push(isNotNull(watchesCatalog.caseSizeMm))   // D-08 NULL exclusion
  predicates.push(between(watchesCatalog.caseSizeMm, min, max))
}

if (filters?.style?.length) {
  predicates.push(arrayOverlaps(watchesCatalog.styleTags, filters.style))
  // No isNotNull needed — empty array '{}'::text[] fails && overlap naturally (D-08)
}

// WHERE: and(...predicates) — empty predicates array = no WHERE clause = full catalog
.where(predicates.length > 0 ? and(...predicates) : undefined)
```

**Pitfall:** When `predicates` is empty and `and()` receives nothing, Drizzle returns `undefined` — pass `undefined` to `.where()` safely (no WHERE clause, full table). [ASSUMED — verify Drizzle behavior for `and()` with zero args, or use `sql`true`` guard]

### Pattern 2: useSearchState Facet Extension

**What:** Add `movement`, `size`, `style[]` state to the hook; add URL read on mount; add new deps to Watches sub-effect dep array.

**Key insight:** The Watches sub-effect already has its own `AbortController` (line 167, 191 in `useSearchState.ts`). Adding facet values to the dep array `[debouncedQ, tab, movement, size, ...styleArr]` is sufficient — the existing abort wiring covers facet changes automatically.

**Browse-mode state logic:**
- When tab !== 'watches' && tab !== 'all': facets still stored in URL state (D-04), sub-effect is inactive.
- When tab === 'watches' or 'all': sub-effect fires if `debouncedQ.length >= 2 OR hasActiveFacet`.
- The CLIENT_MIN_CHARS guard (line 160) must change from unconditional to: `if (debouncedQ.trim().length < CLIENT_MIN_CHARS && !hasActiveFacet) { ... return }`.

**URL round-trip:** URL sync effect (effect 2, lines 99-105) must also write facet params alongside `q` and `tab`. When `style` is `['tool', 'diver']`, write `params.set('style', 'tool,diver')`.

**State shape:**
```typescript
const [movement, setMovement] = useState<string | null>(
  searchParams.get('movement') ?? null
)
const [size, setSize] = useState<string | null>(
  searchParams.get('size') ?? null
)
const [styleArr, setStyleArr] = useState<string[]>(
  searchParams.get('style')?.split(',').filter(Boolean) ?? []
)
```

### Pattern 3: VerdictBundleFull Candidate Taste Extension

**What:** Add `candidateCatalogTaste` to `VerdictBundleFull` and thread from composer.

```typescript
// src/lib/verdict/types.ts addition:
export interface VerdictBundleFull {
  // ... existing fields ...
  candidateCatalogTaste: CatalogTasteAttributes | null  // ADD THIS
}

// src/lib/verdict/composer.ts addition (line 86+):
return {
  framing,
  label: result.label,
  headlinePhrasing: HEADLINE_FOR_LABEL[result.label],
  contextualPhrasings,
  rationalePhrasings,
  mostSimilar: result.mostSimilarWatches.map(({ watch, score }) => ({ watch, score })),
  roleOverlap: result.roleOverlap,
  candidateCatalogTaste: catalogEntry  // ADD THIS
    ? {
        formality: catalogEntry.formality !== null ? Number(catalogEntry.formality) : null,
        sportiness: catalogEntry.sportiness !== null ? Number(catalogEntry.sportiness) : null,
        heritageScore: catalogEntry.heritageScore !== null ? Number(catalogEntry.heritageScore) : null,
        primaryArchetype: catalogEntry.primaryArchetype,
        eraSignal: catalogEntry.eraSignal,
        designMotifs: catalogEntry.designMotifs,
        confidence: catalogEntry.confidence !== null ? Number(catalogEntry.confidence) : null,
        extractedFromPhoto: catalogEntry.extractedFromPhoto,
      }
    : null,
}
```

**Numeric coercion note:** `watchesCatalog` Drizzle schema uses `numeric()` for taste scalars — they surface as strings via postgres-js. The same coercion pattern used in `getWatchesByUser` (lines 153-161) must be applied here. `catalogEntry` comes from `getCatalogById` (catalog DAL) — check whether that DAL already coerces or still returns strings. [ASSUMED — verify by reading `getCatalogById` return mapping]

### Pattern 4: FIT-05 Delta Algorithm (pure utility, no imports needed)

**What:** Pure function over two `CatalogTasteAttributes` objects. Lives inside `CollectionFitCard.tsx` or as a sibling module `src/lib/verdict/deltaPhrase.ts`.

**Algorithm skeleton (D-16):**

```typescript
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1
  const setA = new Set(a)
  const intersection = b.filter(x => setA.has(x)).length
  const union = new Set([...a, ...b]).size
  return union === 0 ? 1 : intersection / union
}

function computeDeltaPhrase(
  candidate: CatalogTasteAttributes,
  owned: CatalogTasteAttributes,
): string {
  const SCALAR_THRESHOLD = 0.1
  const MOTIF_THRESHOLD = 0.8

  // Step 1-3: compute deltas per dimension
  const formalityDelta = candidate.formality !== null && owned.formality !== null
    ? Math.abs(candidate.formality - owned.formality) : null
  const sportinessDelta = candidate.sportiness !== null && owned.sportiness !== null
    ? Math.abs(candidate.sportiness - owned.sportiness) : null
  const heritageDelta = candidate.heritageScore !== null && owned.heritageScore !== null
    ? Math.abs(candidate.heritageScore - owned.heritageScore) : null
  const archetypeMatch = candidate.primaryArchetype === owned.primaryArchetype ? 0 : 1
  const eraMatch = candidate.eraSignal === owned.eraSignal ? 0 : 1
  const motifSimilarity = jaccardSimilarity(candidate.designMotifs, owned.designMotifs)
  const motifDelta = 1 - motifSimilarity

  // Step 4: check if "very similar" fallback
  const allScalarsSmall = [formalityDelta, sportinessDelta, heritageDelta]
    .every(d => d === null || d < SCALAR_THRESHOLD)
  if (allScalarsSmall && archetypeMatch === 0 && eraMatch === 0 && motifSimilarity >= MOTIF_THRESHOLD) {
    return 'Very similar across all taste dimensions'
  }

  // Step 5: pick highest delta and emit phrase
  // ... compare all deltas, return templated phrase for winner
}
```

**Placement decision:** If placed inside `CollectionFitCard.tsx`, it stays within the pure-renderer boundary (no engine imports). If extracted to `src/lib/verdict/deltaPhrase.ts`, it's a utility with no forbidden imports — either is valid. The static test only forbids `@/lib/similarity` and `@/lib/verdict/composer` — a new `src/lib/verdict/deltaPhrase.ts` is not forbidden.

### Pattern 5: Sheet Bottom Drawer UX

**What:** `Sheet` primitive from `src/components/ui/sheet.tsx` wraps `@base-ui/react/dialog`. `SheetContent side='bottom'` gives full-width bottom drawer.

**Key finding:** The `SheetContent` component at `src/components/ui/sheet.tsx:39-81` accepts `side` prop controlling CSS via `data-side` attribute. `side='bottom'` applies:
- `data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t`
- Slide animation: `data-ending-style:translate-y-[2.5rem] data-starting-style:translate-y-[2.5rem]`

**Critical:** `SheetContent` does NOT include a visible drag handle by default — only an X close button (`showCloseButton=true` default). D-11 says "drag-handle close" — a drag handle affordance (a small centered bar) must be added either as a custom child element or by extending `SheetContent`. This is UI-SPEC territory.

**Exports from `src/components/ui/sheet.tsx`:** `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`. All available for SRCH-16.

### Anti-Patterns to Avoid

- **Importing `@/lib/similarity` or `@/lib/verdict/composer` into `CollectionFitCard.tsx`:** Violates Phase 20 D-04 pure-renderer invariant. Static test will catch it.
- **Adding facet debounce:** D-02 is explicit — facets fire instantly. No debounce on the facet sub-effect trigger path.
- **Filtering style tags with `arrayContains` (subset):** Must use `arrayOverlaps` (`&&` = ANY match). `arrayContains` (`@>`) requires ALL tags to be present — wrong for OR-logic.
- **Hardcoding style chip values as a client constant:** If style tags change in the catalog, a hardcoded constant goes stale. Prefer a server-fetched top-8 (either page-load or `'use cache'`).
- **Using the deprecated `movement` free-text column:** SRCH-16 MUST use `watchesCatalog.movementType` (pgEnum). ROADMAP SC#4 enforces this with a test.
- **Applying `isNotNull` to `style_tags`:** The column has `.notNull().default(sql\`'{}'\`)` — it is never NULL. The empty-array case is handled naturally by `arrayOverlaps`. Adding `isNotNull` is harmless but unnecessary.
- **Composing predicates with `and()` and 0 args without fallback:** Drizzle `and()` with 0 arguments may return `undefined`; always guard or use a conditional. [ASSUMED — treat carefully]
- **font-medium in new components:** `tests/no-raw-palette.test.ts:20` forbids `\bfont-medium\b` — use `font-semibold`. Pattern confirmed by three occurrences in Phase 39b.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Array overlap predicate | Custom SQL string concat | `arrayOverlaps()` from drizzle-orm | Parameterized; injection-safe |
| Range predicate | `sql\`case_size_mm >= ${min} AND ...\`` | `between(col, min, max)` from drizzle-orm | Parameterized; readable |
| Bottom drawer modal | Custom position + animation | `Sheet` / `SheetContent side='bottom'` | Already available; animation handled by base-ui |
| Chip toggle UI | Custom toggle-button group | Tailwind classes + `aria-pressed` state | No additional library needed; chip pattern already in project via Badge |
| Jaccard similarity | Third-party library | Inline pure function (5 lines) | The function is trivially small; no library justified |

---

## Runtime State Inventory

Step 2.5: SKIPPED. Phase 40 is a features-on-top-of-existing-data phase. No string renames, no schema renames, no live service config changes. All work is code additions on top of existing `watches_catalog.movement_type`, `case_size_mm`, `style_tags` columns and existing verdict bundle infrastructure.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `drizzle-orm` `between`, `arrayOverlaps` | DAL facet predicates | ✓ | 0.45.2 | — |
| `@base-ui/react/dialog` | Sheet bottom drawer | ✓ | 1.3.0 | — |
| `next/cache` `cacheLife` | Style vocab caching | ✓ | Next 16 (cacheComponents: true) | `unstable_cache` if needed |
| Postgres `&&` array operator | style_tags overlap | ✓ | (prod Supabase Postgres) | — |
| Postgres `BETWEEN` | case_size_mm band | ✓ | (prod Supabase Postgres) | — |

No missing dependencies. All tooling already available.

---

## Common Pitfalls

### Pitfall 1: facet `and()` predicate composition when no filters active

**What goes wrong:** Calling `and(...predicates)` with an empty array returns `undefined`. If this is passed to `.where(undefined)` that's fine in Drizzle (no WHERE clause), but if the empty-OR for the ILIKE is also undefined, the query returns all rows without limit control.

**Why it happens:** `or()` with 0 args also returns `undefined`. Both must be handled.

**How to avoid:** Guard each predicate push: only add predicates when inputs are non-empty. When `predicates` array is empty, pass `undefined` to `.where()` — Drizzle will omit the clause. Test the "all facets inactive + no q" path explicitly.

**Warning signs:** Search returning all 100 catalog rows when no q and no facets selected.

### Pitfall 2: numeric coercion on catalog taste fields (postgres-js string return)

**What goes wrong:** `catalogEntry.formality` from `getCatalogById` may be a string `"0.72"` rather than a number `0.72`. If FIT-05 renders `candidate.formality - owned.formality` without coercion, the delta is `NaN` (string minus number).

**Why it happens:** `watchesCatalog` uses `numeric()` Drizzle type; postgres-js surfaces these as strings at the JavaScript boundary. `getWatchesByUser` already coerces with `Number(taste.formality)` — but `getCatalogById` may not.

**How to avoid:** When building `candidateCatalogTaste` in the composer, apply `Number()` coercion to all 3 scalar fields (formality, sportiness, heritageScore) and confidence — matching the pattern at `src/data/watches.ts:153-161`.

**Warning signs:** FIT-05 delta row always shows 0 or NaN; TypeScript won't catch this because `CatalogTasteAttributes.formality` is typed as `number | null`.

### Pitfall 3: style vocab top-8 query and the `'use cache'` boundary

**What goes wrong:** A DAL function marked `'use cache'` that reads from a `'use client'` component's scope will fail at build time. The style vocab query must be in a Server Component or a non-client DAL.

**Why it happens:** `'use cache'` functions cannot close over request-scoped values (cookies, headers) unless passed as arguments. But a pure DB aggregate query has no such dependencies — it's safe to cache.

**How to avoid:** Put `getTopStyleTags(limit: number)` in `src/data/catalog.ts` (server-only). Add `'use cache'` directive inside the function with `cacheLife('hours')` or `cacheLife('days')` — the result changes only when catalog content changes, which is infrequent. Thread the result as a prop from the `/search` Server Component page into `SearchPageClient`.

**Recommended approach for D-06 (Claude's Discretion):** Server Component fetch at `/search` page mount with `'use cache'` on the DAL function. TTL: 1 hour (catalog style_tags change only on admin seed/enrichment runs). Props chain: `SearchPage` → `SearchPageClient.styleVocab: string[]` → `WatchesPanel` → `WatchFacetSheet`.

**Warning signs:** Build error referencing `'use cache'` scope violation; or style chip set changes after catalog updates but UI shows stale values.

### Pitfall 4: `useSearchState` URL sync and tab-switch preservation (D-04)

**What goes wrong:** If the URL sync effect only writes facet params when tab === 'watches', facet values disappear from the URL when the user switches to another tab and back.

**Why it happens:** D-04 says facet params survive tab switches.

**How to avoid:** Write facet params to the URL unconditionally in the URL sync effect (effect 2) — regardless of current tab. Only the Watches sub-effect (effect 3b) consumes them. Other sub-effects ignore facet state.

**Warning signs:** User activates a facet on Watches tab, switches to People tab, switches back — filter is gone.

### Pitfall 5: `searchWatchesAction` Zod `.strict()` breaks with unrecognized facet fields

**What goes wrong:** The current `searchSchema` is `z.object({ q: z.string().max(200) }).strict()`. If the client sends `{ q, movement, size, style }` without extending the schema first, `.strict()` rejects the request with "Unrecognized key" and returns `{ success: false, error: 'Invalid request' }`.

**Why it happens:** `.strict()` is an explicit mass-assignment guard. It rejects any key not in the schema. [VERIFIED: src/app/actions/search.ts:18-22]

**How to avoid:** Extend the schema with optional facet fields BEFORE changing the client to send them:
```typescript
const searchSchema = z.object({
  q: z.string().max(200),
  movement: z.enum(['auto', 'manual', 'quartz', 'spring_drive']).optional(),
  size: z.enum(['lt36', '36-39', '40-42', '43-45', '46plus']).optional(),
  style: z.string().max(500).optional(), // comma-joined; DAL splits
}).strict()
```

### Pitfall 6: `mostSimilar.length === 0` path in FIT-05

**What goes wrong:** If the viewer's collection is empty, `mostSimilar` is `[]` (from `similarity.ts:314`). FIT-05 reads `mostSimilar[0]` — `undefined`. The confidence gate checks `mostSimilar[0].watch.catalogTaste` — runtime error.

**Why it happens:** `CollectionFitCard` is only rendered when `collection.length > 0` per Phase 20 D-07, but `mostSimilar` can still be `[]` if collection has only `sold`/`wishlist` watches (no `owned`/`grail` for scoring).

**How to avoid:** Add an explicit guard: `if (verdict.mostSimilar.length === 0) return null` at the top of the FIT-05 section render path (before the confidence gate). D-12 already calls for this hidden state.

### Pitfall 7: font-medium forbidden by palette lint

**What goes wrong:** `tests/no-raw-palette.test.ts:20` regex `\bfont-medium\b` fails any file in `src/components/` that uses `font-medium`.

**Why it happens:** Project palette lint enforces `font-semibold` for heading-weight text.

**How to avoid:** Use `font-semibold` everywhere in new components. Confirmed pattern from Phase 39b (three Rule 1 auto-fixes on the same issue).

---

## Code Examples

### Style Vocab Top-8 DAL Function

```typescript
// Source: Pattern derived from existing catalog.ts DAL idiom
// Add to src/data/catalog.ts
export async function getTopStyleTags(limit = 8): Promise<string[]> {
  'use cache'
  cacheLife('hours')
  
  // Unnest the style_tags array and count frequency across all catalog rows.
  // Postgres unnest() + GROUP BY + ORDER BY is the canonical approach for
  // array element frequency. Drizzle's sql`` template is the escape hatch
  // when no typed helper exists for unnest.
  const rows = await db.execute(
    sql`SELECT tag, COUNT(*) AS freq
        FROM watches_catalog, unnest(style_tags) AS tag
        GROUP BY tag
        ORDER BY freq DESC
        LIMIT ${limit}`
  )
  return (rows as Array<{ tag: string }>).map(r => r.tag)
}
```

**Note:** `'use cache'` is valid inside server-only modules when `cacheComponents: true` is set in next.config.ts (already enabled). [VERIFIED: next.config.ts, CITED: node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md]

### ROADMAP SC#4 Static Test: movement_type column assertion

```typescript
// tests/static/catalog.movement-type-column.test.ts
// ROADMAP Phase 40 SC#4: SRCH-16 facets must use `movement_type` pgEnum column,
// not the deprecated free-text `movement` column.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('Phase 40 SC#4 — searchCatalogWatches references movement_type', () => {
  const dalSrc = readFileSync('src/data/catalog.ts', 'utf8')

  it('references watchesCatalog.movementType (movement_type column)', () => {
    expect(dalSrc).toMatch(/movementType/)
  })

  it('does NOT reference deprecated free-text movement column directly', () => {
    // The deprecated column was free-text `movement` — ensure no raw SQL
    // or Drizzle reference to it slips into the search predicate path.
    // The word `movement` alone would match movementType/movementCaliber (acceptable);
    // watch for the Drizzle column reference pattern `watchesCatalog.movement` (no suffix).
    expect(dalSrc).not.toMatch(/watchesCatalog\.movement[^TCa]/)
  })
})
```

**Pattern basis:** `tests/static/CollectionFitCard.no-engine.test.ts` — source-text reads with `readFileSync` and `expect(src).toMatch(...)`. [VERIFIED: tests/static/CollectionFitCard.no-engine.test.ts:21-24]

### FIT-05 Confidence Gate Pattern (module-absent-not-empty)

```typescript
// Inside CollectionFitCard.tsx, after mostSimilar list (line 86), before roleOverlap:
// This follows Phase 39b D-39b-07 module-absent-not-empty pattern.
{verdict.mostSimilar.length > 0 &&
  verdict.candidateCatalogTaste !== null &&
  verdict.candidateCatalogTaste.confidence !== null &&
  verdict.candidateCatalogTaste.confidence >= 0.5 &&
  verdict.mostSimilar[0].watch.catalogTaste !== null &&
  verdict.mostSimilar[0].watch.catalogTaste.confidence !== null &&
  verdict.mostSimilar[0].watch.catalogTaste.confidence >= 0.5 && (
  <PairwiseDrillDown
    candidate={verdict.candidateCatalogTaste}
    owned={verdict.mostSimilar[0].watch.catalogTaste}
    ownedBrand={verdict.mostSimilar[0].watch.brand}
    ownedModel={verdict.mostSimilar[0].watch.model}
  />
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-text `movement` column | `movement_type` pgEnum + `movement_caliber` TEXT | Phase 35 (shipped 2026-05-10) | SRCH-16 must use the enum column — hard requirement |
| `watches.catalogId` nullable | `watches.catalogId NOT NULL` | Phase 36 (shipped 2026-05-11) | All collection watches guaranteed to have a catalog reference |
| `Watch.catalogTaste` absent | `Watch.catalogTaste` populated by `getWatchesByUser` LEFT JOIN | Phase 38 | FIT-05 mostSimilar side is free |
| `unstable_cache` for non-fetch caching | `'use cache'` directive + `cacheLife()` | Next.js 16 (cacheComponents: true, already enabled) | Style vocab DAL can use `'use cache'` directly |

**Deprecated:**
- `movement` free-text column: replaced by `movementType` pgEnum in Phase 35. SRCH-16 must NOT reference it.
- `unstable_cache` is the "previous model" — project already uses `cacheComponents: true` and `'use cache'` (per Phase 39c ProfileShellResolver). Use `'use cache'` for style vocab.

---

## Sub-Question Answers (for planner)

### Q1: DAL extension shape

`searchCatalogWatches` gains an optional second `filters?: CatalogSearchFilters` parameter. Predicate array is built conditionally. Guard: `if (trimmed.length < 2 && !hasActiveFacet) return []`. When `predicates` is empty and q is also empty+short, the function returns `[]` (preserves pre-query state per D-01: "Empty result + no facets + empty q still returns `[]`"). When predicates are present, `.where(and(...predicates))` narrows results.

### Q2: Top-8 style vocab source (Claude's Discretion)

**Recommended:** Server Component fetch at `/search` page mount using `getTopStyleTags()` with `'use cache'` + `cacheLife('hours')` in the DAL. This piggybacks on the existing `Promise.all` in `SearchPage` (currently fetches `viewerCollection` + `viewerProfile`). Add a third fetch: `getTopStyleTags(8)`. Thread as `styleVocab: string[]` prop into `SearchPageClient` → `WatchesPanel` → `WatchFacetSheet`.

**Why not a client constant:** Style tags change when catalog enrichment runs. A constant requires a code deploy to update.

**Why not per-keystroke:** Per D-06 — vocab is computed "once per request (or cached)".

**Why `'use cache'` is appropriate:** `getTopStyleTags` takes no user-specific inputs; result is identical for all viewers. TTL 1 hour or 1 day is appropriate.

### Q3: useSearchState extension

Three new state slices: `movement: string | null`, `size: string | null`, `styleArr: string[]`. Initialized from URL on mount. URL sync effect writes all three. Watches sub-effect dep array: `[debouncedQ, tab, movement, size, ...styleArr]` — or more simply, a derived `hasFacet` boolean + individual values as deps.

**AbortController:** No changes needed. The Watches sub-effect already creates and cleans up its own `AbortController`. The new facet deps extend the dep array, triggering the same abort-and-restart behavior.

**Browse-mode CLIENT_MIN_CHARS guard change (line 160):** Change from:
```typescript
if (debouncedQ.trim().length < CLIENT_MIN_CHARS) { ...return }
```
to:
```typescript
const hasActiveFacet = !!(movement || size || styleArr.length)
if (debouncedQ.trim().length < CLIENT_MIN_CHARS && !hasActiveFacet) { ...return }
```

### Q4: Bottom-sheet trigger placement + active-count badge

Filter button mounts in `WatchesPanel` (lines 247-316 of SearchPageClient.tsx), between the `<Tabs>` row and `<WatchSearchRowsAccordion>`. The `WatchesPanel` function needs: `movement`, `size`, `styleArr`, `onFacetChange`, `styleVocab` props propagated from `useSearchState` output via the parent.

Active count: `const activeCount = [movement, size].filter(Boolean).length + styleArr.length`.

Badge label: `activeCount > 0 ? \`Filter (${activeCount})\` : 'Filter'`.

The sheet is a controlled component — `open` / `onOpenChange` state lives in SearchPageClient (not useSearchState, since it's pure UI state with no URL or server-action dependency).

### Q5: VerdictBundleFull candidate catalogTaste threading — CONFIRMED PLAN

- `src/lib/verdict/types.ts`: Add `candidateCatalogTaste: CatalogTasteAttributes | null` to `VerdictBundleFull`. Import `CatalogTasteAttributes` from `@/lib/types`. [VERIFIED: types.ts line 22-35]
- `src/lib/verdict/composer.ts`: Build `candidateCatalogTaste` from `catalogEntry` fields (same fields already read into `candidateTaste` at lines 47-53, but now surfaced as the full shape with numeric coercion). [VERIFIED: composer.ts line 47-53, 86-96]
- 3 call sites (`catalog/page.tsx`, `watch/[id]/page.tsx`, `actions/verdict.ts`) already pass `catalogEntry` — no new arguments needed. [VERIFIED: src/app/catalog/[catalogId]/page.tsx:117, src/app/actions/verdict.ts:63]
- `CollectionFitCard.tsx` reads `verdict.candidateCatalogTaste` — stays within pure-renderer boundary (no forbidden imports).

### Q6: FIT-05 delta algorithm

Lives in `CollectionFitCard.tsx` as a local helper, OR extracted to `src/lib/verdict/deltaPhrase.ts`. The static guard test does NOT forbid new files in `src/lib/verdict/` (it only checks `CollectionFitCard.tsx`). Extraction to `deltaPhrase.ts` is cleaner for unit testing. Either approach is valid — planner decides.

If extracted: import in `CollectionFitCard.tsx` is allowed (`@/lib/verdict/deltaPhrase` is not `@/lib/similarity` or `@/lib/verdict/composer`).

### Q7: NULL handling + confidence gate — NO DOUBLE-FILTERING

- DAL layer (D-08): `isNotNull(watchesCatalog.movementType)` when movement facet active; `isNotNull(watchesCatalog.caseSizeMm)` when size facet active. This is search-result filtering only.
- Composer layer: not involved in taste NULL handling; already gates template firing on `conf < 0.5`.
- Card layer (D-15): `candidateCatalogTaste === null || .confidence < 0.5` → hide FIT-05 section only. Other card sections (headline, mostSimilar, roleOverlap) still render.

There is no double-filtering risk: DAL NULL exclusion applies to search results. Card confidence gate applies to FIT-05 display. These are independent concerns.

### Q8: Test surface

Required tests:
1. **`tests/static/catalog.movement-type-column.test.ts`** — ROADMAP SC#4. Source-text assertion that `searchCatalogWatches` references `movementType` (not deprecated `movement`). [Pattern: CollectionFitCard.no-engine.test.ts]
2. **`tests/static/CollectionFitCard.no-engine.test.ts`** — existing; must stay green after FIT-05 addition. No new imports of forbidden modules.
3. **Unit test for delta algorithm** — if extracted to `deltaPhrase.ts`, a `tests/static/deltaPhrase.test.ts` covering: (a) all-similar fallback, (b) formality-dominant scalar, (c) archetype mismatch, (d) motif mismatch, (e) null scalar graceful handling.
4. **`searchWatchesAction` schema test** — assert Zod schema accepts the 4 optional facet fields and rejects unrecognized keys (following existing pattern in `tests/actions/`).

### Q9: REQUIREMENTS.md edit task

SRCH-16 currently reads: "Case Size (numeric range slider — sourced from `case_size_mm`)". Must change to: "Case Size (chip group with 5 pre-defined size bands: `<36` / `36-39` / `40-42` / `43-45` / `46+` — sourced from `case_size_mm`)". This is a small paperwork task, Wave 0 or standalone plan step.

### Q10: Next.js 16 specifics

- **`'use cache'`** is the correct caching primitive for `getTopStyleTags`. Already enabled via `cacheComponents: true`. Use `cacheLife('hours')` from `next/cache`. [VERIFIED: next.config.ts, node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md]
- **Server Actions with optional facet params:** No breaking changes in Next 16 for Server Action input shapes. The Zod `.strict()` pattern extends cleanly.
- **`useSearchParams()` in `'use client'`:** Already used correctly in `useSearchState`. Facet params added to `URLSearchParams` build in the URL sync effect — same pattern. `router.replace` with `{ scroll: false }` carries forward.
- **Server Action transport:** `AbortController` abort is honored at the browser fetch transport. The existing comment at `useSearchState.ts:65-67` documents this assumption. Facet changes use the same abort wiring — no new edge cases.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts) |
| Config file | vitest.config.ts (existing) |
| Quick run command | `npx vitest run tests/static/` |
| Full suite command | `npx vitest run` |

**Note on env loading:** `vitest.config.ts` does NOT auto-load `.env.local`. Integration tests that hit the DB require: `set -a; source .env.local; set +a; npx vitest run tests/integration/phase40*.test.ts`. Static tests do not need DB access.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-16 | DAL references `movement_type` column, not deprecated `movement` | static/source-text | `npx vitest run tests/static/catalog.movement-type-column.test.ts` | ❌ Wave 0 |
| SRCH-16 | `searchWatchesAction` Zod schema accepts facet fields | unit | `npx vitest run tests/actions/search.facets.test.ts` | ❌ Wave 0 |
| FIT-05 | `CollectionFitCard` imports no engine modules | static/import-boundary | `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts` | ✅ (existing) |
| FIT-05 | Delta algorithm covers all 5 D-16 cases | unit | `npx vitest run tests/static/deltaPhrase.test.ts` | ❌ Wave 0 (if extracted) |
| FIT-05 | `VerdictBundleFull.candidateCatalogTaste` populated correctly | unit | `npx vitest run tests/static/composer-engine-alignment.test.ts` | ✅ (extend existing) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/static/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/static/catalog.movement-type-column.test.ts` — covers ROADMAP SC#4 / SRCH-16
- [ ] `tests/actions/search.facets.test.ts` — covers Zod schema facet extension
- [ ] `tests/static/deltaPhrase.test.ts` — covers FIT-05 D-16 delta algorithm (conditional on extraction to `deltaPhrase.ts`)

Existing test infrastructure covers the import-boundary and composer-alignment tests; only the new DAL + action tests need Wave 0 scaffolding.

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` in `searchWatchesAction` — already present, unchanged |
| V3 Session Management | no | Search is stateless; no new session state |
| V4 Access Control | no | SRCH-16 is catalog read (public data); FIT-05 reads viewer's own collection (already scoped by userId in `getWatchesByUser`) |
| V5 Input Validation | yes | Zod `.strict()` schema extended with optional facet fields — must remain `.strict()` to block mass-assignment |
| V6 Cryptography | no | No new crypto surface |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via facet values | Tampering | Drizzle parameterized predicates (`between()`, `arrayOverlaps()`, `eq()`) — no string interpolation |
| Mass-assignment via extended Server Action schema | Tampering | `.strict()` preserved on Zod schema — unknown keys rejected |
| Style tag injection (user-supplied style values that don't match vocab) | Tampering | Zod validates `style` as a string; DAL splits and passes as parameterized array — no SQL text construction |
| Stale style vocab served to client | Information Disclosure | Low risk (catalog metadata only); `'use cache'` TTL keeps it fresh within acceptable window |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `and()` with 0 args in Drizzle returns `undefined` (safe to pass to `.where()`) | Pattern 1 | Query might error or return all rows; guard with `predicates.length > 0 ? and(...predicates) : undefined` |
| A2 | `getCatalogById` returns taste numeric fields as strings (not numbers) — same as `getWatchesByUser` | Pitfall 2 / Pattern 3 | If already coerced, the additional `Number()` coercion is a no-op; no harm |
| A3 | `tests/no-raw-palette.test.ts` forbids `font-medium` | Pitfall 7 | If the test changed scope, `font-semibold` is still stylistically correct and safe |
| A4 | `useSearchParams().get('style')?.split(',').filter(Boolean)` correctly parses comma-joined style chips | Pattern 2 | If `style=` (empty value) is present, `.filter(Boolean)` prevents empty string from entering the array |
| A5 | `arrayOverlaps` is importable from `drizzle-orm` root (not `drizzle-orm/pg-core`) | Standard Stack | Confirmed via node inspection — HIGH confidence |

---

## Open Questions

1. **`getCatalogById` numeric coercion**
   - What we know: `getWatchesByUser` applies `Number()` to taste numerics. `catalogEntry` comes from `getCatalogById`.
   - What's unclear: whether `getCatalogById` also coerces or returns raw postgres-js strings.
   - Recommendation: Read `src/data/catalog.ts` `getCatalogById` implementation before building the composer extension. Apply `Number()` coercion in the composer regardless (idempotent for already-numeric values).

2. **`WatchesPanel` prop threading for facet state**
   - What we know: `WatchesPanel` is a local function inside `SearchPageClient.tsx` (lines 247-316). It currently receives `q`, `results`, `isLoading`, `hasError`, `collectionRevision`, `viewerUsername`.
   - What's unclear: Whether to thread facet state directly to `WatchesPanel` or to a new `WatchFacetSheet` component that is a sibling of `WatchesPanel`.
   - Recommendation: Mount the Filter button + `Sheet` as a sibling of `WatchesPanel` within the `'watches'` tab content block, not inside `WatchesPanel` itself. This keeps `WatchesPanel` as a pure results renderer.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/verdict/types.ts` — confirmed `VerdictBundleFull` shape; `candidateCatalogTaste` absent
- `src/lib/verdict/composer.ts` — confirmed `mostSimilar` is passed from collection watches with `catalogTaste`; candidate taste not threaded into bundle
- `src/lib/verdict/shims.ts` — confirmed `catalogEntryToSimilarityInput` does NOT set `catalogTaste`
- `src/data/catalog.ts:257-389` — confirmed existing DAL structure; imports `and, asc, desc, eq, ilike, inArray, or, sql`
- `src/app/actions/search.ts:18-22` — confirmed Zod `.strict()` schema shape
- `src/components/search/useSearchState.ts` — confirmed 3-sub-effect structure; AbortController per sub-effect; dep arrays
- `src/components/ui/sheet.tsx` — confirmed `SheetContent side` prop; `side='bottom'` CSS via `data-[side=bottom]:*`
- `src/db/schema.ts:38-40` — confirmed `movementTypeEnum` pgEnum; `:359-377` confirmed `watchesCatalog.movementType`, `.caseSizeMm`, `.styleTags` columns
- `src/lib/types.ts:86` — confirmed `Watch.catalogTaste?: CatalogTasteAttributes | null`
- `src/data/watches.ts:126-163` — confirmed `getWatchesByUser` LEFT JOIN populates `catalogTaste` with numeric coercion
- `next.config.ts` — confirmed `cacheComponents: true` already enabled
- `node_modules/drizzle-orm` inspection — confirmed `arrayOverlaps`, `between`, `and`, `or` available
- `tests/static/CollectionFitCard.no-engine.test.ts` — confirmed static source-text assertion pattern

### Secondary (MEDIUM confidence)
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` — `'use cache'` + `cacheLife()` API confirmed for project
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md` — cache key semantics confirmed

### Tertiary (LOW confidence)
- Drizzle `and()` with 0 args → `undefined` behavior: confirmed by common usage but not verified against Drizzle 0.45.2 source; marked [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all libraries verified in node_modules and project source
- Architecture: HIGH — read all canonical source files; critical open question fully resolved
- Pitfalls: HIGH — confirmed from prior Phase 39b pattern history and static source reading
- Validation: HIGH — test pattern confirmed from existing static tests

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (30 days — stable stack, no fast-moving dependencies)

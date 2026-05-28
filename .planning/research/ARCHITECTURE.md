# Architecture Research

**Domain:** Search-first add-watch flow integration — v8.0 Add-Watch Redesign
**Researched:** 2026-05-28
**Confidence:** HIGH (primary sources: full codebase read across all relevant files)

---

## Integration Points

Four concrete seams where v8.0 touches the existing architecture. Everything else is new.

### Seam 1: `/api/extract-watch` — discriminated request shape

**Current:** The route handler reads `body.url` as a required string. Any request without a URL fails at line 97 (`URL is required`).

**Change needed:** Add a `mode` discriminator to the request body. Keep the existing URL-mode path byte-identical; add a structured-mode branch that bypasses `fetchAndExtract` and calls `extractWithLlm` directly with a synthesized prompt instead of scraped HTML.

**Discriminated shape:**
```typescript
type ExtractRequest =
  | { mode: 'url'; url: string }
  | { mode: 'structured'; brand: string; model: string; reference?: string; year?: number }
```

The `mode` field defaults to `'url'` for backward compat (omitted = url mode). This avoids breaking the existing `AddWatchFlow.handleExtract` call site (line 249 in `AddWatchFlow.tsx`) until that code is replaced.

**Structured-mode pipeline:** Skip `fetchAndExtract`. Build a plain-text prompt from the four fields and call `extractWithLlm` directly — but `extractWithLlm(html, structuredContext?)` takes raw HTML + optional JSON-LD. Use a thin wrapper: pass the brand/model/ref/year as the `structuredContext` argument (already an arbitrary string), and pass a minimal HTML stub as `html` (e.g., `<html><body></body></html>`). This keeps `extractWithLlm` unchanged.

**Catalog wiring:** Identical to the URL path. After extraction, call `upsertCatalogFromExtractedUrl` (not `upsertCatalogFromUserInput` — the structured extraction enriches spec columns). Then taste enrichment fire-and-forget. Then `revalidateTag('explore', 'max')`. Response shape is identical: `{ success, catalogId, catalogIdError, data }`.

**Error taxonomy:** Reuse the existing 5-category D-15 copy verbatim. Structured-mode cannot produce `host-403` (no fetch), so that branch maps to `generic-network`. Everything else (`LLM-timeout`, `quota-exceeded`, `structured-data-missing`, `generic-network`) applies as-is.

**Auth gate:** Stays first, unchanged.

**Verdict:** Single route with discriminated body. No sibling route. The existing route file grows by ~60 lines for the structured-mode branch; the error taxonomy, auth gate, and response shape are untouched.

---

### Seam 2: `addWatch` Server Action — `catalogId` passthrough

**Current behavior (line 127–139 in `watches.ts`):** `addWatch` always calls `upsertCatalogFromUserInput({ brand, model, reference })` to find-or-create a catalog row. When search finds an existing catalog row, this upsert is correct — it will `ON CONFLICT DO NOTHING` and return the existing id. No data integrity issue.

**The actual problem:** When the confirm screen passes a `catalogId` from search, `upsertCatalogFromUserInput` is redundant — it's a round-trip to the DB to find the row we already know. More importantly, `upsertCatalogFromUserInput` only writes the natural key (brand/model/reference) and `source='user_promoted'`. When search matched an existing catalog row that has rich spec data, there is nothing to upsert-enrich. The only wasted cost is one DB round-trip and one taste-enrichment call for a row that already has taste data (first-write-wins semantics in `updateCatalogTaste` will no-op if `confidence IS NOT NULL`).

**Decision: no schema change, no new field on `addWatch`.** The existing `insertWatchSchema` Zod schema does not accept `catalogId` from the client. The Zod `.strict()` equivalent behavior is: `insertWatchSchema.safeParse(data)` — and `catalogId` is not in that schema, so any client-supplied `catalogId` is silently stripped.

**How to pass catalogId through cleanly:** Add `catalogId` as an optional field to `insertWatchSchema` (it already accepts `photoSourcePath` as a special-purpose field using the same pattern). The field bypasses `upsertCatalogFromUserInput` when non-null. In the action body:

```typescript
if (parsed.data.catalogId) {
  // Validate it's a real UUID owned by watches_catalog (service-role read)
  const row = await catalogDAL.getCatalogById(parsed.data.catalogId)
  catalogIdResult = row?.id ?? null
} else {
  catalogIdResult = await catalogDAL.upsertCatalogFromUserInput({ ... })
}
```

**Security:** The `getCatalogById` lookup confirms the UUID exists in `watches_catalog`. Because `watches_catalog` has public-read RLS, a forged `catalogId` can only reference a real catalog row — not an arbitrary UUID. The worst outcome is a valid catalog linkage, which is the correct behavior. No IDOR risk.

**Taste enrichment:** When `catalogId` is pre-supplied and the row already has `confidence IS NOT NULL`, the `updateCatalogTaste` first-write-wins guard short-circuits without an LLM call. This is correct and efficient.

**Schema change:** Add `catalogId: z.string().uuid().optional()` to `insertWatchSchema`. No DB migration — `watches.catalog_id` already exists and is populated server-side.

---

### Seam 3: `searchCatalogWatches` — ranking for add-flow use

**Current ranking:** `ORDER BY (ownersCount + 0.5 * wishlistCount) DESC, brandNormalized ASC, modelNormalized ASC` with a 50-candidate cap, 20-result slice.

**Problem for add-flow:** When a user types "omega speedmaster 3570.50", the current ranking surfaces the most-collected Speedmaster first, which may not be the exact reference they typed. An exact reference match should rank above a popular brand/model match.

**Option A: JS post-sort on existing return shape.** `searchCatalogWatches` returns `reference` already. After calling `searchWatchesAction`, sort client-side: exact-reference-match rows first, then brand+model-only rows by popularity. This is ~10 lines and zero DB change.

**Option B: SQL ranking column.** Add a computed `rank` column to the SELECT: `CASE WHEN reference_normalized = :refNorm THEN 3 WHEN brand_normalized = :brandNorm AND model_normalized = :modNorm THEN 2 ELSE 1 END AS matchScore` and `ORDER BY matchScore DESC, popularity DESC`.

**Recommendation: Option A for v8.0.** The add-flow search surface shows at most 5–8 results; post-sort on the JS side is invisible at that scale and requires no DAL change. The existing `searchCatalogWatches` and `searchWatchesAction` are used by the `/search` page — modifying their SQL ranking for the add-flow would require introducing a new query parameter or a separate function, increasing change surface unnecessarily.

**New Server Action needed:** `searchCatalogForAddFlow` wrapping `searchCatalogWatches` with the JS post-sort and a tighter limit (5–8 results vs 20 for the search page). Lives in `src/app/actions/search.ts` alongside `searchWatchesAction`. Does not filter by `viewerState` (the add-flow doesn't need owned/wishlist badges — those are shown post-pick on the confirm screen).

---

### Seam 4: Phase 29 three-layer reset carries forward

The three-layer reset (Layer 1: per-request `crypto.randomUUID()` key on `<AddWatchFlow>` — REMOVED in Phase 61; Layer 2: `useLayoutEffect` cleanup-on-hide; Layer 3: explicit reset before `router.push`) must carry into the new flow.

**Key fact from Phase 61:** The `key` prop nonce was REMOVED in Phase 61 because `addWatch` calls `revalidatePath('/')` → the Server Component re-runs → a new UUID → key changes → `AddWatchFlow` remounts → destroys `photos-pending` state. The current reset relies on Layers 2+3 only.

**Carry-forward:** The new `AddWatchFlow` (or its replacement) must preserve the `useLayoutEffect` cleanup that resets on Activity-hide. The search query string (`searchQuery`) and structured-input draft (`brand`/`model`/`ref`/`year`) must be local state reset in that cleanup — but NOT the module-scope caches (which are intentionally cross-mount persistent).

---

## New Components

| Component | File Path | Role | Replaces |
|-----------|-----------|------|---------|
| `SearchEntry` | `src/components/watch/SearchEntry.tsx` | Controlled search input with debounced results list; calls `searchCatalogForAddFlow` Server Action; emits `onPick(catalogId, extracted)` or `onNoMatch(query)` | Part of `PasteSection` |
| `ConfirmStep` | `src/components/watch/ConfirmStep.tsx` | Compact review card: cover photo (from `catalogId` via existing `getCatalogById`), brand/model/ref display, status picker (all 4 statuses incl. grail), "Edit details" affordance, Save button. Pure presenter — receives `extracted`, `catalogId`, `onConfirm(status)`, `onEditMore()`, `onCancel()` | `VerdictStep` |
| `StructuredEntryPanel` | `src/components/watch/StructuredEntryPanel.tsx` | Brand + Model (required) + Reference + Year (optional) form for the no-match path; "Have a URL?" optional URL field; Submit fires structured-mode `/api/extract-watch` | New; replaces no-URL dead-end |
| `useCatalogSearchCache` | `src/components/watch/useCatalogSearchCache.ts` | Module-scope Map keyed by query string → `SearchCatalogWatchResult[]`. Same pattern as `useUrlExtractCache`. No TTL (catalog data is stable within a session). Cleared on new flow entry (keyed on a session token, see Cache Hygiene below) | New |
| `useStructuredExtractCache` | `src/components/watch/useStructuredExtractCache.ts` | Module-scope Map keyed by `"${brand}|${model}|${reference ?? ''}|${year ?? ''}"` → `ExtractCacheEntry`. Same interface as `useUrlExtractCache`. | New |

**Modified (not replaced):**

| File | Change |
|------|--------|
| `src/components/watch/flowTypes.ts` | New `FlowState` kinds: `searching`, `no-match`, `structured-extracting`, `confirm-ready`. Remove `verdict-ready`, `wishlist-rationale-open`, `submitting-wishlist`. Keep `form-prefill`, `manual-entry`, `photos-pending`, `extraction-failed` |
| `src/components/watch/AddWatchFlow.tsx` | Replace state machine handlers + render branches. Props interface gains no new required fields (same server-resolved props from page.tsx). Internals rewritten |
| `src/app/api/extract-watch/route.ts` | Add structured-mode branch (~60 lines). URL-mode branch untouched |
| `src/app/actions/searches.ts` | New `searchCatalogForAddFlow` action |
| `src/app/actions/watches.ts` | `insertWatchSchema` gains `catalogId?: z.string().uuid()`; `addWatch` gains the catalogId-passthrough branch |
| `src/app/watch/new/page.tsx` | Minor: remove dead `initialCatalogId`/`initialIntent` props if the deep-link-from-search path is removed; or keep them if the `/search` "Add" CTA still deep-links |

**Removed (after confirm screen ships):**

| File | Reason |
|------|--------|
| `src/components/watch/VerdictStep.tsx` | Replaced by `ConfirmStep` |
| `src/components/watch/VerdictStep.test.tsx` | Delete with component |
| `src/components/watch/WishlistRationalePanel.tsx` | Status picker on confirm screen replaces the 3-button flow; no separate rationale panel |
| `src/components/watch/WishlistRationalePanel.test.tsx` | Delete with component |
| `src/components/watch/PasteSection.tsx` | Replaced by `SearchEntry`; URL paste folds into `StructuredEntryPanel` |
| `src/components/watch/PasteSection.test.tsx` | Delete with component |

`RecentlyEvaluatedRail` — keep or remove at product discretion. With verdict dropped, the rail's purpose (re-open a previously-evaluated verdict) is gone. It can be repurposed as a "recently searched" chip rail showing the last 5 searches, or removed. Treat as a separate decision.

---

## Data Flow

### Branch A: Search Match

```
User types query
    → SearchEntry (debounce 250ms)
    → searchCatalogForAddFlow Server Action
    → searchCatalogWatches DAL (pg_trgm ILIKE, ranked)
    → results displayed; user picks a row

Pick emits (catalogId, extracted from catalog row)
    → AddWatchFlow transitions to `confirm-ready`
    → ConfirmStep rendered (cover photo, brand/model/ref, status picker)

User picks status + confirms
    → AddWatchFlow calls addWatch({ ...extracted, status, catalogId })
    → addWatch: getCatalogById(catalogId) to validate → skip upsert → createWatch
    → photos-pending state (Phase 61 WatchPhotoStep unchanged)
    → router.push(destination)
```

### Branch B: No Match → Structured Extraction

```
User types query, zero catalog matches (or explicitly "Can't find it")
    → AddWatchFlow transitions to `no-match`
    → StructuredEntryPanel shown (brand, model, ref, year + optional URL)

User fills fields + submits
    → AddWatchFlow transitions to `structured-extracting`
    → fetch('/api/extract-watch', { mode: 'structured', brand, model, reference, year })
    → Route: extractWithLlm(stub-html, brand+model+ref+year as structuredContext)
    → Route: upsertCatalogFromExtractedUrl (creates or enriches catalog row)
    → Route returns { catalogId, data }
    → AddWatchFlow transitions to `confirm-ready`
    → ConfirmStep rendered with extracted data

User confirms → same path as Branch A from "User picks status + confirms"
```

### Branch C: URL Paste (folded into no-match screen)

```
User on StructuredEntryPanel fills in "Have a URL?" field
    → AddWatchFlow transitions to `extracting` (existing URL-mode path)
    → fetch('/api/extract-watch', { mode: 'url', url })
    → Existing URL-mode pipeline (unchanged)
    → Route returns { catalogId, data }
    → AddWatchFlow transitions to `confirm-ready`
    → ConfirmStep rendered

User confirms → same path as Branch A
```

### Branch D: Manual Entry (Skip search link)

```
User clicks "Skip search — enter manually"
    → AddWatchFlow transitions to `manual-entry`
    → WatchForm without lockedStatus (unchanged from current `manual-entry` branch)
    → photos-pending on create success (unchanged)
```

### Status Flow (replaces VerdictStep 3-button lock)

`ConfirmStep` renders a 4-option status picker: Wishlist / Collection / Grail / Sold (all four statuses available from the start — no lock). The selected status is local state inside `ConfirmStep`. On "Save", it emits `onConfirm(status, notes?)`.

`AddWatchFlow` receives `status` and calls `addWatch({ ...extracted, status, catalogId })`. No `lockedStatus` prop needed for this path. `WatchForm` still accepts `lockedStatus` for the form-prefill path (deep-link from `/search?catalogId=X&intent=owned`) — that prop stays unchanged.

"Edit details" on `ConfirmStep` transitions `AddWatchFlow` to `form-prefill` with `lockedStatus` = whatever the user selected on confirm. This preserves the existing `WatchForm` form-prefill path.

---

## Module-Scope Cache Hygiene

**Existing caches (untouched):**
- `useWatchSearchVerdictCache` — verdict cache, keyed by `collectionRevision`. Still used by the `/search` accordion inline-expand path. Not used in the new add flow (verdict is out of scope for v8.0).
- `useUrlExtractCache` — URL → extract result. Still used if URL paste fires through the existing `handleExtract` code path.

**New caches:**
- `useCatalogSearchCache` — query string → search results. Module-scope, no TTL. Catalog data (brand/model/ref) is stable within a session; search results don't change because the user added a watch.
- `useStructuredExtractCache` — composite key → extract result. Same pattern as `useUrlExtractCache`.

**SignOut leak (existing Active item, line 168 in PROJECT.md):** `useWatchSearchVerdictCache` is not cleared on signOut — the `collectionRevision` from a previous user could coincidentally match the new user's revision after sign-in. The existing two new caches (search results, structured extracts) have the same theoretical exposure.

**Mitigation for new caches (v8.0 scope):** Implement a session-token invalidation key. The server passes `viewerUserId` to `AddWatchFlow` (already present as `viewerUserId` prop). Add a module-scope `lastUserId: string | null`. In each cache hook's `get`/`set` calls, check `if (moduleLastUserId !== currentUserId) { moduleCache.clear(); moduleLastUserId = currentUserId }`. This clears on user switch without clearing on remount. Apply this pattern to both new caches only (the existing signOut leak is a pre-existing issue in Active, not in v8.0 scope).

---

## Suggested Build Order (5–7 phases)

**Phase 1 — API Route Extension**
- Extend `/api/extract-watch` with structured-mode (`{ mode: 'structured', brand, model, reference?, year? }`)
- Thin wrapper calling `extractWithLlm` with structured context
- Same error taxonomy, auth gate, catalog upsert, taste enrichment, `revalidateTag`
- No UI changes; tested via the existing route test suite + new structured-mode test cases
- Dependency: none (self-contained)

**Phase 2 — Server Action + DAL extension**
- `insertWatchSchema` gains `catalogId?: z.string().uuid()`
- `addWatch` gains catalogId-passthrough branch (`getCatalogById` validate → skip `upsertCatalogFromUserInput`)
- New `searchCatalogForAddFlow` Server Action in `src/app/actions/search.ts` with JS post-sort
- No UI changes
- Dependency: Phase 1 (structured extraction returns a `catalogId` that the passthrough branch accepts)

**Phase 3 — ConfirmStep component**
- Build `ConfirmStep.tsx` (cover photo, brand/model/ref display, status picker, "Edit details" affordance)
- Status picker: 4 options (wishlist/owned/grail/sold), no lock
- "Edit details" → `onEditMore()` callback
- "Save" → `onConfirm(status)` callback
- No flow wiring yet; test in isolation
- Dependency: none (pure presenter)

**Phase 4 — SearchEntry + StructuredEntryPanel components**
- `SearchEntry.tsx`: debounced input, calls `searchCatalogForAddFlow`, renders result list, emits `onPick` or `onNoMatch`
- `StructuredEntryPanel.tsx`: brand/model/ref/year fields, optional URL field, submit calls structured-mode or URL-mode extract
- Module-scope cache hooks: `useCatalogSearchCache`, `useStructuredExtractCache`
- No flow wiring yet
- Dependency: Phase 2 (`searchCatalogForAddFlow` action)

**Phase 5 — AddWatchFlow state machine rewrite + flow wiring**
- New `FlowState` discriminated union in `flowTypes.ts`
- `AddWatchFlow.tsx` rewritten: new state machine handlers wiring SearchEntry → ConfirmStep → WatchPhotoStep
- All four branches: search-match, no-match/structured-extract, URL-paste, manual-entry
- Phase 29 three-layer reset carries forward (useLayoutEffect cleanup reset covers `searchQuery` + draft state)
- `photos-pending` integration via `onWatchCreated` callback — UNCHANGED
- Deep-link form-prefill path (`initialCatalogId + initialIntent`) preserved or removed (see below)
- Dependency: Phases 3 + 4 + 2

**Phase 6 — Dead code cleanup + tests**
- Delete `VerdictStep.tsx`, `VerdictStep.test.tsx`, `WishlistRationalePanel.tsx`, `WishlistRationalePanel.test.tsx`, `PasteSection.tsx`, `PasteSection.test.tsx`
- Update `AddWatchFlow.test.tsx` for new state machine
- Verify `tests/static/` guards (ROUTE-03 CI guard not affected — no `/watch/` or `/catalog/` links introduced)
- `RecentlyEvaluatedRail` removal or repurpose decision
- Dependency: Phase 5 complete and prod-verified

---

## Deep-Link Form-Prefill Path (`?catalogId=X&intent=owned`)

The current `/search` Watches tab has an "Add to Collection" CTA that navigates to `/watch/new?catalogId=X&intent=owned`. This uses `initialCatalogId` / `initialIntent` / `initialCatalogPrefill` props on `AddWatchFlow` to jump directly to `form-prefill`.

**Options:**
1. Keep the deep-link path as-is (jump to `form-prefill` via `WatchForm lockedStatus="owned"`). This means the old `form-prefill` state and `WatchForm lockedStatus` prop survive. Low risk, no search-page changes needed.
2. Redirect deep-link arrivals to `confirm-ready` instead (uses new ConfirmStep, status pre-set to `owned` but editable). Requires changing `/watch/new/page.tsx` and how `initialCatalogPrefill` is consumed.

**Recommendation: Option 1 for v8.0.** The deep-link path from search is a secondary surface. Keeping `form-prefill` / `lockedStatus` alive for that path means no changes to the `/search` page or `WatchSearchRowsAccordion`. The add-flow redesign ships independently of the search-page deep-link.

---

## Component Boundaries Summary

```
/watch/new (Server Component)
    └── AddWatchFlow (Client — state machine)
        ├── [idle / searching] SearchEntry
        │       → calls searchCatalogForAddFlow (Server Action)
        │       → useCatalogSearchCache (module-scope)
        │       → onPick(catalogId, extracted) → confirm-ready
        │       → onNoMatch(query) → no-match
        ├── [no-match] StructuredEntryPanel
        │       → fetch('/api/extract-watch', { mode: 'structured', ... })
        │       → useStructuredExtractCache (module-scope)
        │       → or fetch('/api/extract-watch', { mode: 'url', url })
        │       → useUrlExtractCache (module-scope, existing)
        │       → on result → confirm-ready
        ├── [structured-extracting / extracting] loading state
        ├── [extraction-failed] ExtractErrorCard (existing, unchanged)
        ├── [confirm-ready] ConfirmStep
        │       → onConfirm(status) → calls addWatch Server Action
        │       → onEditMore() → form-prefill (WatchForm lockedStatus=picked)
        │       → onCancel() → idle
        ├── [form-prefill] WatchForm lockedStatus (existing, unchanged)
        ├── [manual-entry] WatchForm no lock (existing, unchanged)
        └── [photos-pending] WatchPhotoStep (existing, unchanged)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Verdict in the add flow

**What:** Rendering `CollectionFitCard` or calling `getVerdictForCatalogWatch` during the add flow.
**Why bad:** Locked operator decision — verdict drops from the add path entirely in v8.0. The verdict lives on `/w/[ref]` (Phase 64). Adding it back in the add flow would re-introduce the cognitive load the redesign is trying to reduce.
**Instead:** Remove all `useWatchSearchVerdictCache` usage inside `AddWatchFlow`. The cache hook can stay in the codebase for the `/search` accordion path — just don't instantiate it in the new add flow.

### Anti-Pattern 2: Calling `upsertCatalogFromUserInput` when `catalogId` is already known

**What:** The current `addWatch` always calls `upsertCatalogFromUserInput` regardless of whether the caller already resolved a catalog row. When search finds an existing row, this is a wasted round-trip + potential source=`user_promoted` downgrade on an already-enriched row (mitigated by COALESCE semantics in the upsert, but still wasteful).
**Instead:** Pass `catalogId` through the `insertWatchSchema` and short-circuit to `getCatalogById` validation when it's present.

### Anti-Pattern 3: Separate route `/api/extract-watch-structured`

**What:** Creating a sibling route for the structured-extraction mode.
**Why bad:** Doubles the auth-gate surface, error-taxonomy surface, and cache-invalidation surface. The 5-category error taxonomy (Phase 25 D-15) is locked copy — any divergence between the two routes is a maintenance burden.
**Instead:** Single route with discriminated body. The mode field routes internally.

### Anti-Pattern 4: Storing status in module-scope cache

**What:** Adding `status` (wishlist/owned/grail) to `useCatalogSearchCache` or `useStructuredExtractCache`.
**Why bad:** Status is a per-user decision made at confirm time — it is not a property of the catalog row or the extraction result. Caching it would cause stale status to re-appear on revisit.
**Instead:** Status lives only in `ConfirmStep` local state and is passed to `addWatch` at commit time.

### Anti-Pattern 5: Calling `searchCatalogWatches` directly from a Client Component

**What:** Importing the DAL function from the client component.
**Why bad:** `src/data/catalog.ts` has `import 'server-only'` at line 1. Build fails with a `server-only` violation. Also exposes a DB round-trip to the client-side bundle.
**Instead:** Always call `searchCatalogForAddFlow` Server Action from the client. The Server Action wraps the DAL.

---

## Sources

All findings from direct codebase reads (HIGH confidence — primary source):

- `/Users/tylerwaneka/Documents/horlo/src/components/watch/AddWatchFlow.tsx` — state machine, cache instantiation, handler logic
- `/Users/tylerwaneka/Documents/horlo/src/components/watch/flowTypes.ts` — `FlowState` discriminated union
- `/Users/tylerwaneka/Documents/horlo/src/components/watch/useUrlExtractCache.ts` — module-scope cache pattern
- `/Users/tylerwaneka/Documents/horlo/src/components/search/useWatchSearchVerdictCache.ts` — revision-keyed module-scope cache, signOut leak note
- `/Users/tylerwaneka/Documents/horlo/src/app/api/extract-watch/route.ts` — auth gate, error taxonomy, catalog upsert, taste enrichment, revalidateTag
- `/Users/tylerwaneka/Documents/horlo/src/app/actions/watches.ts` — `addWatch` schema, catalogId upsert logic, `insertWatchSchema`
- `/Users/tylerwaneka/Documents/horlo/src/app/actions/search.ts` — `searchWatchesAction` pattern, `searchCatalogWatches` call site
- `/Users/tylerwaneka/Documents/horlo/src/data/catalog.ts` — `searchCatalogWatches` SQL, ranking, candidate cap; `upsertCatalogFromUserInput` vs `upsertCatalogFromExtractedUrl` semantics
- `/Users/tylerwaneka/Documents/horlo/src/lib/extractors/index.ts` — `fetchAndExtract` vs `extractWatchData` vs `extractWithLlm` call hierarchy
- `/Users/tylerwaneka/Documents/horlo/src/lib/extractors/llm.ts` — `extractWithLlm(html, structuredContext?)` signature
- `/Users/tylerwaneka/Documents/horlo/src/app/watch/new/page.tsx` — server-resolved props, hydrateCatalogPrefill, Phase 61 key-removal rationale
- `/Users/tylerwaneka/Documents/horlo/.planning/PROJECT.md` — Active items (signOut cache leak, Phase 29 three-layer reset decisions, Phase 61 photo step), v8.0 kickoff decisions
- `/Users/tylerwaneka/Documents/horlo/.planning/seeds/SEED-010-v5.3-add-watch-redesign.md` — original redesign motivation and open questions

---
*Architecture research for: v8.0 Add-Watch Redesign — search-first add flow integration with existing Horlo architecture*
*Researched: 2026-05-28*

# Phase 69: SearchEntry + StructuredEntryPanel + Cache Hygiene - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the two new entry surfaces the redesigned `/watch/new` flow will mount, plus close a long-standing tech-debt leak in the four module-scope caches that survive the per-request `AddWatchFlow` remount boundary.

Components shipped this phase (all dormant — Phase 70 wires them):

1. **`src/components/watch/SearchEntry.tsx`** — typeahead over `watches_catalog` built on `@base-ui/react/combobox`. Controlled-query input + uncontrolled selection/open state. Debounced fetch via `searchCatalogForAddFlow` Server Action (Phase 67 already shipped). Rows show brand/model/reference + cover photo + `HighlightedText` substring highlight + viewer-state pill ("In collection" / "On wishlist") + owners count (`"47 collectors"`). Picking a row emits `onPick(result: SearchCatalogWatchResult)` upward. When `query.length ≥ 3 && results.length === 0`, the listbox closes and `StructuredEntryPanel` mounts inline below the input with the query pre-seeded per SRCH-26. A "Not finding it? Add manually" footer rendered below results-when-present uses the same inline-expand mechanism.

2. **`src/components/watch/StructuredEntryPanel.tsx`** — 4-field structured-input form (brand required, model required, reference optional, year optional) in a 2-col responsive grid mirroring `WatchForm.tsx` Basic Information block. Inline `CatalogPhotoUploader` for the optional photo affordance (EXTR-06). Explicit "Find specs" button (EXTR-05 — gates the LLM call). In-place `VerdictSkeleton` loading state below the button during `/api/extract-watch` round-trip. "Have a URL for this watch?" ghost link below (EXTR-07 — routes back to the URL-paste path). On success, emits `onSubmitStructured(result)` upward.

3. **`src/components/watch/useCatalogSearchCache.ts`** — module-scope `Map<string, SearchCatalogWatchResult[]>` keyed by trimmed+lowercased query. Mirror primitive of `useUrlExtractCache.ts`. Accepts `viewerUserId` as a required positional arg; resets on `lastUserId` mismatch.

4. **`src/components/watch/useStructuredExtractCache.ts`** — module-scope `Map<string, ExtractCacheEntry>` keyed by a **normalized JSON tuple** of `{brand, model, reference, year}` (trim + lowercase per field). Same shape + invalidation semantics as #3.

5. **Retrofit of the two existing caches** — `useUrlExtractCache(viewerUserId)` and `useWatchSearchVerdictCache(collectionRevision, viewerUserId)` gain a required `viewerUserId` arg + the same `lastUserId`-reset block. Closes the pre-existing tech-debt leak on `useWatchSearchVerdictCache` as part of CLNP-07.

6. **`src/lib/searchEntry/parseSearchQuery.ts`** — pure helper. Given `(query: string, catalogBrands: string[])` returns `{ brand, model, reference }`. Algorithm: longest-prefix match against the case-insensitive normalized catalog brand list FIRST; on hit, the matched prefix is `brand`, remainder splits into model + reference (last whitespace-delimited token containing a digit becomes `reference`, everything else joins into `model`). On miss, fall back to the naive split (first token = `brand`, last digit-bearing token = `reference`, middle = `model`). Year stays empty in both paths (SRCH-26 example only mentions brand/model/reference).

7. **New DAL fn `listCatalogBrands(): Promise<string[]>`** in `src/data/catalog.ts` — `SELECT DISTINCT brand FROM watches_catalog ORDER BY brand`. Public-read RLS already allows it. Server-fetched by `/watch/new/page.tsx`, passed as a `catalogBrands: string[]` prop through `AddWatchFlow` → `SearchEntry` → `parseSearchQuery`.

8. **`ExtractErrorCard` mode-branched copy** — implements Phase 66 D-06: read `mode` field from `/api/extract-watch` response and switch the `structured-data-missing` user-facing copy to the structured variant ("Couldn't find specs for that watch. Try adding a reference number, or enter manually." or similar; planner drafts). URL-mode copy unchanged.

Requirements delivered (SRCH-17..26, EXTR-05, EXTR-06, EXTR-07, CLNP-07 — 14 of 14).

**Not this phase:**
- Mounting these into `AddWatchFlow` — Phase 70 (state-machine rewrite)
- DUPE-01/02/03 redirect / "Move to Collection" / "Add another copy" — Phase 70
- `?manual=1` priority + `?returnTo=` round-trip + three-layer reset extension — Phase 70
- `VerdictStep` + `WishlistRationalePanel` + `PasteSection` deletion + static guards — Phase 71
- `CollectionFitCard` mount anywhere in the add flow — out of scope per PROJECT.md "Verdict deliberately out of scope"
- Any change to `/search` page UX, `searchCatalogWatches` DAL, or `searchWatchesAction` Server Action
- Any change to `/w/[ref]` (the consumer of catalog rows; v8.0 milestone explicitly leaves it untouched)

</domain>

<decisions>
## Implementation Decisions

### Typeahead a11y primitive

- **D-01 (primitive):** **Use `@base-ui/react/combobox`.** Already installed alongside `accordion` + `drawer` (Horlo already runs base-ui in production; no new dep surface). Provides the full WAI-ARIA combobox contract headless: `role="listbox"` + `role="option"` (SRCH-20 requirement), expanded state, roving tabindex, Home/End/PageDown coverage, focus split between input and listbox. Eliminates the same custom-keydown surface Phase 68 D-04 left as planner discretion for the radiogroup. **Rejected:** raw `<input>` + custom listbox (matches `useSearchState` precedent but writes the keyboard matrix by hand for the third time in v8.0). **Rejected:** `@base-ui/react/autocomplete` (narrower shape — assumes free-text-with-hints rather than hard select-to-advance; wrong fit for "pick a catalog row" semantics).

- **D-02 (state model):** **Controlled query input + uncontrolled selection/open state.** Parent (`SearchEntry`) owns the `query` string state so the debounce hook + cache key can read it directly. `Combobox` owns its own open/closed boolean and active-option-index. On user selection, `Combobox.onValueChange` fires; `SearchEntry` hoists the picked row into `onPick(result)`. Smallest controlled surface that still gives the orchestrator full visibility into the input value.

- **D-03 (pick action):** **`onPick(result: SearchCatalogWatchResult)` — emit the full row upward.** `SearchEntry` is a pure presenter (Phase 68 precedent). Phase 70's `AddWatchFlow` inspects `result.viewerState` to branch: `'owned'` → redirect to `/w/[ref]` (DUPE-01), `'wishlist'` → confirm screen defaulting status to wishlist + "Move to Collection" affordance (DUPE-03), `null` → confirm screen with the user's chosen status. **Rejected:** `onPick(catalogId: string)` (wastes the row already in hand — Phase 70 would have to re-query). **Rejected:** two-callback split (`onPickOwned` / `onPickAvailable` — couples SearchEntry to DUPE policy; DUPE lives in Phase 70).

- **D-04 (debounce + stale-result):** **Mirror `useSearchState.ts:131` byte-for-byte.** `setTimeout(250 ms)` for `q → debouncedQ`. Per-effect `AbortController` with `if (controller.signal.aborted) return` stale-result guards. The 250 ms floor is what SC#1 quotes verbatim ("fires results after ~250 ms debounce"). `useDeferredValue` doesn't enforce a wall-clock floor and doesn't cancel inflight Server Actions — would need a stale-result ref anyway, mixing primitives raises the surprise budget. Extracting a `useTypeaheadSearch` hook for shared use with `/search` is a deferred refactor; this phase keeps the change local.

- **D-05 (no-match location):** **Empty state renders OUTSIDE the Combobox popup, inline below the input in normal document flow.** When `query.length ≥ 3 && results.length === 0`, the listbox closes (`Combobox.open = false`) and `SearchEntry` mounts `<StructuredEntryPanel>` + EXTR-07 backup link in standard document flow below the input. Keeps the 4-field form + photo uploader focusable, scrollable, and not stacked over content. Aligns with the seed's "no-match → structured extraction" narrative.

### CLNP-07 — signOut cache-clear wiring

- **D-06 (mechanism location):** **Each cache hook owns its own `lastUserId` check.** Inside each of the four hooks: `if (moduleUserId !== viewerUserId) { moduleCache = new Map(); moduleUserId = viewerUserId }` at the top of the hook body. Mirrors `useWatchSearchVerdictCache.ts:42-45` byte-for-byte — proven Horlo pattern, intentional sync mutation in render (not setState; module state has no React-tracked subscribers). The 4-line check duplicated across 4 files is acceptable per Phase 67 D-01 "inline vs extract" precedent; coordination via a shared hook risks the silent-leak case ("forget to call it once = miss"). **Rejected:** shared `useViewerCacheScope` coordinator hook (single failure mode for all 4 caches). **Rejected:** global `<CacheHygieneProvider>` + `onAuthStateChange` subscriber (over-engineering; the cache is only re-read when `/watch/new` mounts, and `logout()` already redirects).

- **D-07 (plumbing):** **Prop-drill `viewerUserId` from `AddWatchFlow`.** `/watch/new/page.tsx:130` already passes `viewerUserId={user.id}` server-side. `AddWatchFlow` forwards it as a typed prop into `SearchEntry`, `StructuredEntryPanel`, and the existing call sites for `useUrlExtractCache` + `useWatchSearchVerdictCache`. Static; no auth subscription; no extra round-trip. **Rejected:** `createSupabaseBrowserClient().auth.getUser()` per hook (adds per-render network cost; conflicts with the `proxy_router_cache_poisoning` lesson that direct cookie-only is the safer surface). **Rejected:** context provider (only one consumer level deep — prop-drill is shorter).

- **D-08 (retrofit scope):** **Add `viewerUserId` as a required positional arg to both pre-existing hooks in the same change.** `useUrlExtractCache()` → `useUrlExtractCache(viewerUserId)`; `useWatchSearchVerdictCache(collectionRevision)` → `useWatchSearchVerdictCache(collectionRevision, viewerUserId)`. Required (not optional) so TypeScript surfaces every caller: `AddWatchFlow.tsx:123`, `AddWatchFlow.tsx:127`, `WatchSearchRowsAccordion.tsx:47`. Closes success-criterion #5 verbatim ("the pre-existing `useWatchSearchVerdictCache` tech-debt leak is closed in the same change"). The `WatchSearchRowsAccordion` site is on `/search`, not `/watch/new`, so the planner threads `viewerUserId` through whatever the upstream Server Component already passes (`SearchPageClient` likely has `user.id` available — confirm during planning).

- **D-09 (testing):** **Per-hook unit tests + AddWatchFlow integration test.** Unit shape: render with `viewerUserId='a'`, set entry, re-render with `viewerUserId='b'`, assert `get(key) === undefined`. Co-located test next to each cache hook (`useCatalogSearchCache.test.ts`, `useStructuredExtractCache.test.ts`, retrofit existing tests). Integration test: in `AddWatchFlow.test.tsx`, simulate the user-switch (rerender `<AddWatchFlow viewerUserId='a' />` then `<AddWatchFlow viewerUserId='b' />`) and assert no stale entry surfaces in either of the four caches. **Rejected:** static guard test (the `vitest_static_node_env` memory bites — file system walks fail at Vercel prebuild; behavioral test gives stronger guarantees anyway).

### No-match panel layout + SRCH-26 pre-seed

- **D-10 (layout):** **Inline expand under the search input.** When no-match fires, `SearchEntry` keeps the query input visible at top and renders `<StructuredEntryPanel>` directly below it in normal document flow. The user can edit the query without losing structured fields (typing in the input re-fires the debounce + collapses the panel when results return; clearing the input also collapses). SRCH-26 pre-seed becomes a one-shot effect when the panel first mounts. **Rejected:** state transition / panel takeover (loses "refine the query" affordance; user has to navigate back to retype). **Rejected:** side-by-side / drawer (mobile-hostile).

- **D-11 (ownership):** **`SearchEntry` renders `StructuredEntryPanel` as its no-match child and emits `onSubmitStructured(result)` upward.** Phase 70 sees a single downstream callback per flow branch (`onPick` for catalog-row picks, `onSubmitStructured` for structured-input submissions). No new FlowState kind needed for the inline-expand case — `AddWatchFlow` treats both successful exit paths uniformly (extracted data → ConfirmStep). Couples `SearchEntry` to `StructuredEntryPanel` (one knows the other exists), which is acceptable: they ship as one composed entry surface; the v8.0 flow does not mount them independently. **Rejected:** Phase 70 mounts the panel after `SearchEntry.onNoMatch(query)` (expands FlowState surface; complicates orchestrator). **Rejected:** external `<SearchOrStructured>` wrapper (more files for negligible decoupling win).

- **D-12 (SRCH-26 pre-seed parser):** **Longest-prefix brand match against the catalog brand list, fall back to naive 3-token split on miss.** Pure helper `parseSearchQuery(q, catalogBrands)` colocated with `SearchEntry` (probably under `src/lib/searchEntry/parseSearchQuery.ts`). Algorithm:
  1. Normalize `q` (trim, collapse internal whitespace, lowercase).
  2. Normalize each `catalogBrand` the same way.
  3. Sort catalog brands by length DESC; iterate and find the first one that is a whitespace-bounded prefix of normalized `q` (matches "tag heuer" before "tag" — the multi-word brand case the user specifically flagged).
  4. On hit: `brand` = the original-case catalog brand value, `remainder` = `q` after the matched prefix, then within `remainder` the last whitespace-delimited token containing at least one digit becomes `reference`, everything else (joined with single spaces) becomes `model`.
  5. On miss: naive fall-back — `brand` = first token, last digit-bearing token = `reference`, middle = `model` (covers novel brands not yet in catalog).
  6. `year` stays empty in both paths.

  Test coverage: (a) `"omega speedmaster 3135"` → `('Omega', 'Speedmaster', '3135')` (case preserved from catalog); (b) `"tag heuer monaco 1133b"` → `('Tag Heuer', 'Monaco', '1133b')` — multi-word brand; (c) `"rolex datejust"` → `('Rolex', 'Datejust', '')`; (d) `"omega"` → `('Omega', '', '')`; (e) `"cartier 4329xx"` (Cartier not in catalog) → naive fallback → `('cartier', '', '4329xx')`; (f) `"speedmaster"` alone → naive → `('speedmaster', '', '')` (no brand match because nothing starts with a known brand prefix). Catalog-brand-list contains only existing-catalog brands at /watch/new render time — staleness is acceptable (just falls back to naive split for novel brands, no behavioral break).

- **D-13 (brand-list plumbing):** **New DAL fn `listCatalogBrands(): Promise<string[]>` in `src/data/catalog.ts`, server-fetched by `/watch/new/page.tsx`, prop-drilled as `catalogBrands: string[]` through AddWatchFlow → SearchEntry → parseSearchQuery.** Cheap SELECT DISTINCT + ORDER BY brand (~100 rows in prod). Public-read RLS already allows it. Server-side fetch (not client) matches the existing `viewerUserId` + `collectionRevision` plumbing pattern; avoids a round-trip on /watch/new mount. **Rejected:** client-side fetch via Server Action on SearchEntry mount (adds round-trip; misses cache-warm visits). **Rejected:** build-time JSON bake (the `catalog_id_divergence` memory: local/prod catalog content drifts; build-time is wrong).

- **D-14 (SRCH-24 footer integration):** **One inline-expand mechanism, two entry points (footer + empty state).** When `results > 0`, a `"Not finding it? Add manually"` button renders below the listbox results (still inside the popup or just under it — planner picks per UI-SPEC). When `results === 0 && query.length ≥ 3`, the empty state's primary CTA is the same affordance. Both click handlers trigger the same inline expand of `<StructuredEntryPanel>` with `parseSearchQuery(query, catalogBrands)` pre-seeded. Single behavior, single component, two surfaces.

### StructuredEntryPanel shape

- **D-15 (field layout):** **2-column responsive grid mirroring WatchForm.tsx Basic Information.** `grid grid-cols-1 gap-3 sm:grid-cols-2`: row 1 = brand | model (both required), row 2 = reference | year (both optional). Matches Phase 68 ConfirmStep inline-edit grid (D-07) for visual continuity across the v8.0 add flow.

- **D-16 (photo + URL backup placement):** **Photo affordance inline + always-visible below fields; URL backup as ghost link below "Find specs".** DOM order top→bottom:
  1. 4-field grid
  2. `<CatalogPhotoUploader>` inline (always rendered, not behind a reveal — EXTR-06 says "surfaced", reveal-on-click is borderline-noncompliant)
  3. "Find specs" primary button (full-width on mobile, flex-1 on desktop — match ConfirmStep CTA precedent)
  4. "Have a URL for this watch?" ghost link below (EXTR-07 — routes back to the URL-paste path; treated as the explicit fallback the user reaches for only if structured-extract feels wrong)

  Linear top-to-bottom flow; no hierarchy guessing for the user.

- **D-17 (loading state):** **In-place: fields stay; `<VerdictSkeleton>` renders below "Find specs" during the round-trip.** "Find specs" button disabled + spinner. Skeleton placeholder sits where the structured-extract result would land if we were inlining results (we are not — successful extract emits `onSubmitStructured(result)` upward, Phase 70 transitions to ConfirmStep). Matches EXTR-05 "reuse `VerdictSkeleton` or equivalent" verbatim. User keeps context (can re-read what they typed while waiting). **Rejected:** full-panel replacement (disorienting). **Rejected:** button-only spinner (doesn't telegraph "we're working on watch data").

- **D-18 (cache key shape):** **Normalized JSON tuple.** Key = `JSON.stringify({brand: brand.trim().toLowerCase(), model: model.trim().toLowerCase(), reference: (reference ?? '').trim().toLowerCase(), year: year ?? null})`. Catches the most common cache-key typo class ("Omega" vs "omega" vs " omega "). Mirrors the catalog upsert normalization the DAL already does (the catalog natural key uses `regexp_replace(lower(trim(...)), ...)` per `project_local_catalog_natural_key_drift` memory). **Rejected:** raw `${brand}|${model}|${reference}|${year}` (misses case/whitespace dupes; burns LLM call on typo repeats). **Rejected:** no cache (Phase 29 cache discipline says cache — back-button revisit case matters).

### Claude's Discretion

- **Cache key for `useCatalogSearchCache`:** symmetric normalization — `query.trim().toLowerCase()`. Same idiom as D-18 single-string version. Planner picks whether to also strip internal extra whitespace; consistent with how the Server Action's DAL already normalizes is the safer answer.
- **ExtractErrorCard mode-branched copy text (Phase 66 D-06 implementation):** planner drafts the structured-mode `structured-data-missing` user-facing copy. Direction is `"Couldn't find specs for that watch. Try adding a reference number, or enter manually."` or similar — has to read for the no-page context. URL-mode copy stays as the LOCKED Phase 25 D-15 text.
- **`viewerState` pill copy:** WatchSearchRow.tsx already uses "Owned" / "Wishlist" badges. SRCH-19 spec text says `"In collection"` / `"On wishlist"`. The seed/spec text wins; SearchEntry uses the spec wording — diverges from WatchSearchRow visually intentionally (the add-flow surface should communicate ownership state in fuller language to reinforce the DUPE behavior coming in Phase 70).
- **Combobox slot styling:** the `@base-ui/react/combobox` Trigger/Input/Popup/List/Item subcomponents take `className` via `render` prop or `cn(...)`. Planner picks tokens during UI-SPEC. Visual reference is `WatchSearchRowsAccordion` for results-row look and Phase 68 ConfirmStep for in-form-input look.
- **`HighlightedText` query target:** SRCH-22 cites the Phase 16 component; planner reuses the existing `<HighlightedText text={...} q={query} />` from `src/components/search/HighlightedText.tsx` against the combined `${result.brand} ${result.model}` string AND the reference string (matches `WatchSearchRow.tsx:49-54` precedent).
- **`@vitest-environment node` discipline for any filesystem-walking guard:** if planning adds any static guard tests (e.g., asserting `useCatalogSearchCache` is imported from the canonical path), the `vitest_static_node_env` memory applies. Behavioral tests are preferred per D-09.
- **`/watch/new` page-prop addition** (`catalogBrands`): `AddWatchFlowProps` already lives in `AddWatchFlow.tsx:52`. The planner adds `catalogBrands: string[]` alongside `viewerUserId: string` (Phase 61 prop-drill precedent). The Server Component pre-fetches both before passing into the client tree.
- **Owners-count format:** `"47 collectors"` matches SC#2 verbatim. When `ownersCount === 0`, render `"0 collectors"` (let it sit honestly — no special "be the first" copy here; that's a different milestone's concern).
- **Result-row scroll-into-view on arrow nav:** base-ui Combobox handles this by default per the WAI-ARIA spec; planner verifies during implementation that the active option scrolls into view when keyboard-navigating beyond viewport.

### Folded Todos

None — no pending todos matched Phase 69 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 69: SearchEntry + StructuredEntryPanel + Cache Hygiene" — phase goal, depends-on (Phase 67), 5 success criteria
- `.planning/REQUIREMENTS.md` §"Search Entry (SRCH)" items SRCH-17..SRCH-26 — full text + Phase 69 traceability
- `.planning/REQUIREMENTS.md` §"Structured-Input Extraction (EXTR)" items EXTR-05, EXTR-06, EXTR-07 — UI affordances on the structured panel + URL-backup link
- `.planning/REQUIREMENTS.md` §"Cleanup (CLNP)" item CLNP-07 — closes the pre-existing `useWatchSearchVerdictCache` tech-debt leak in this phase
- `.planning/seeds/SEED-010-v5.3-add-watch-redesign.md` — milestone rationale (URL → search-first pivot, why catalog-reuse matters, no-URL extraction as no-match fallback)
- `.planning/PROJECT.md` §"Current Milestone: v8.0 Add-Watch Redesign" — Goal, target features, "Verdict deliberately out of scope" lock, "no new auth/privacy/RLS shape"

### Cross-phase coordination
- `.planning/phases/66-api-route-extension/66-CONTEXT.md` — Phase 66 D-06: `/api/extract-watch` response carries `mode` field; **Phase 69 implements the `<ExtractErrorCard>` copy branch** that consumes it (one row of the D-15 copy table unlocked for the structured-mode `structured-data-missing` variant)
- `.planning/phases/67-server-action-dal-extensions/67-CONTEXT.md` — Phase 67 SHIPPED `searchCatalogForAddFlow` Server Action + DAL fn (D-01..D-05); SearchEntry calls this directly with debounce + module-scope cache. Phase 67 D-08 owned-wins precedence carries through `viewerState` for free
- `.planning/phases/68-confirmstep-component/68-CONTEXT.md` — Phase 68 ConfirmStep is the downstream consumer Phase 70 will mount AFTER SearchEntry/StructuredEntryPanel hand off via `onPick` / `onSubmitStructured`; Phase 68 D-03 prop contract is the wiring target
- **Phase 70** (`AddWatchFlow` rewrite + DUPE wiring) — primary consumer of both new components; owns the FlowState transitions, DUPE-01/02/03, `?manual=1` priority, `?returnTo=` round-trip. SearchEntry/StructuredEntryPanel ship dormant until Phase 70 wires.
- **Phase 71** (Dead Code Cleanup + Static Guards) — deletes `VerdictStep` + `WishlistRationalePanel` + `PasteSection`; happens AFTER Phase 70 prod-verifies the new flow.

### Existing components being mirrored / extended
- `src/components/search/useSearchState.ts:131` — `setTimeout(250ms)` debounce reference (D-04 mirrors byte-for-byte)
- `src/components/search/useSearchState.ts:228+` — `AbortController` stale-result guard pattern (D-04 mirrors per-effect)
- `src/components/search/useWatchSearchVerdictCache.ts:42-45` — `if (moduleRevision !== current) reset` in-render mutation pattern (D-06 mirrors with `viewerUserId` as the discriminant)
- `src/components/watch/useUrlExtractCache.ts` — module-scope `Map`-shape primitive; the new two caches mirror its export surface (`__resetForTests`, hook returns `{get, set}`)
- `src/components/search/WatchSearchRow.tsx` — row composition (image circle + brand/model text + reference subtitle + viewerState pill); SearchEntry result rows mirror visually
- `src/components/search/HighlightedText.tsx` — Phase 16 XSS-safe highlight component (SRCH-22 explicit reuse)
- `src/components/watch/WatchForm.tsx` Basic Information block — `grid grid-cols-1 gap-3 sm:grid-cols-2` layout token (D-15 mirrors for the 4-field structured panel)
- `src/components/watch/CatalogPhotoUploader.tsx` — inline-mounted in StructuredEntryPanel (EXTR-06)
- `src/components/watch/ExtractErrorCard.tsx` — mode-branched copy implemented here (Phase 66 D-06 coordination)
- `src/components/insights/VerdictSkeleton.tsx` — loading state during structured-extract round-trip (EXTR-05)

### Server actions + DAL surface
- `src/app/actions/search.ts:158` — `searchCatalogForAddFlow` Server Action (Phase 67-shipped); SearchEntry's debounced consumer
- `src/data/catalog.ts:542` — `searchCatalogForAddFlow` DAL (Phase 67-shipped); the action wraps it
- `src/data/catalog.ts` — `listCatalogBrands` NEW DAL fn lands here (D-13)
- `src/app/api/extract-watch/route.ts` — POST endpoint; StructuredEntryPanel's "Find specs" calls it with `mode: 'structured'` body (Phase 66 shipped the route extension)
- `src/lib/extractors/types.ts` — `ExtractedWatchData` shape; the `onSubmitStructured(result)` payload type

### Plumbing + page wiring
- `src/app/watch/new/page.tsx:130` — `viewerUserId={user.id}` already passed; D-07 extends to thread through SearchEntry/StructuredEntryPanel; D-13 adds `catalogBrands={await listCatalogBrands()}` alongside
- `src/components/watch/AddWatchFlow.tsx:52-85` — `AddWatchFlowProps` interface; new fields land here (`viewerUserId` is already typed; `catalogBrands: string[]` is new)
- `src/components/watch/AddWatchFlow.tsx:123,127` — existing `useWatchSearchVerdictCache(collectionRevision)` + `useUrlExtractCache()` call sites; D-08 retrofit changes both
- `src/components/search/WatchSearchRowsAccordion.tsx:47` — second `useWatchSearchVerdictCache` consumer on `/search`; D-08 retrofit also changes this site

### Auth + signOut surface
- `src/app/actions/auth.ts` — `logout()` Server Action; calls `supabase.auth.signOut()` + `redirect('/login')` (the redirect is what guarantees `/watch/new` client tree unmounts; D-06 mechanism relies on this)
- `src/components/layout/UserMenu.tsx:77` — `<form action={logout}>` only sign-out trigger surface in steady state
- `src/components/settings/DeleteAccountModal.tsx:98` — secondary sign-out path on account delete; also redirects post-signOut

### Constants + types
- `src/lib/searchTypes.ts` — `SearchCatalogWatchResult` shape (the `onPick` payload type)
- `src/lib/extractors/types.ts` — `ExtractedWatchData` shape (the `onSubmitStructured` payload type)
- `src/lib/types.ts` — `WatchStatus` union (not modified; SearchEntry doesn't touch status)

### A11y / WAI-ARIA references for base-ui Combobox
- `node_modules/@base-ui/react/combobox` — the primitive being adopted; planner reads the base-ui docs (combobox README) before wiring (`Trigger` / `Input` / `Popup` / `Positioner` / `List` / `Item` slot composition)
- WAI-ARIA Combobox Pattern (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) — for the cross-check on what base-ui handles automatically vs what SearchEntry needs to add

### Memories that constrain this phase
- `project_local_catalog_natural_key_drift` — catalog natural key uses `regexp_replace(lower(trim(...)), ...)` normalization; D-18 cache key + D-12 brand-match normalization align with this
- `project_vitest_static_node_env` — D-09 picks behavioral tests over filesystem-walking static guards
- `proxy_router_cache_poisoning` — D-07 picks prop-drill over client `getUser()` (cookie-only is the safer surface)
- `feedback_mobile_ui_verify_on_prod` — UI surfaces of this phase will need prod verification by the user; bundle the v8.0 milestone phases into a single push when possible
- `project_react_418_date_tz_hydration` — irrelevant here (no date formatting), but the broader hygiene lesson (server/client text divergence) applies if any "Just now" or relative-time strings sneak in (none planned)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`@base-ui/react/combobox`** — headless WAI-ARIA combobox primitive; already installed alongside `accordion` + `drawer` (no new dep)
- **`@base-ui/react/combobox` slots:** `Trigger`, `Input`, `Popup`, `Positioner`, `List`, `Item`, `Status`, `Empty`, `Clear` (planner checks current base-ui combobox README for exact slot list at planning time)
- **`searchCatalogForAddFlow` Server Action** (Phase 67) — SearchEntry's only network call for the typeahead path
- **`/api/extract-watch?mode=structured`** (Phase 66) — StructuredEntryPanel's "Find specs" call surface; response now carries `mode` for ExtractErrorCard copy branching
- **`<HighlightedText text q />`** — XSS-safe substring highlighter (SRCH-22 reuse)
- **`<VerdictSkeleton>`** — loading placeholder (EXTR-05 reuse)
- **`<CatalogPhotoUploader>`** — photo upload affordance (EXTR-06 reuse)
- **`<ExtractErrorCard category mode>`** — error card; D-06 copy table to be mode-branched
- **`setTimeout`-based debounce + `AbortController` stale-result idiom** — copy from `useSearchState.ts` verbatim
- **`Map`-as-module-state cache idiom** — copy from `useUrlExtractCache.ts` verbatim, parameterize on `viewerUserId`
- **`cn(...)` from `@/lib/utils`** — for selected-row / hover-row class composition
- **`<Image>` from `next/image`** with `unoptimized` + fixed dims — cover photo idiom from VerdictStep/WatchSearchRow

### Established Patterns
- **Pure presenter / props-in-callbacks-out** (Phase 68 D-03 precedent): SearchEntry + StructuredEntryPanel mirror — Phase 70 owns orchestration, these components ship dormant
- **Module-scope `Map` cache surviving the per-request UUID `key` boundary** (`useUrlExtractCache.ts:5-11` JSDoc) — the existing cache survives AddWatchFlow remounts triggered by `<AddWatchFlow key={requestId}>` on `/watch/new`; the two new caches inherit this lifecycle
- **`if (moduleX !== currentX) reset` in-render mutation pattern** (`useWatchSearchVerdictCache.ts:42-45`) — proven for revision-keyed invalidation; D-06 reuses verbatim with `viewerUserId` as the discriminant
- **`__resetForTests` exported test-only hook** (both existing caches) — new caches export the same shape so `AddWatchFlow.test.tsx` can deterministically clear them
- **Server-Component prop-drill of viewer-id** (`/watch/new/page.tsx:130` already does `viewerUserId={user.id}`) — D-13 extends to `catalogBrands={await listCatalogBrands()}`
- **Server Action discriminated `ActionResult<T>` envelope** (`src/lib/actionTypes.ts`) — SearchEntry inspects `.success` before pushing into `useCatalogSearchCache`
- **2-col responsive grid for form inputs** (`WatchForm.tsx` + Phase 68 ConfirmStep D-07) — `grid grid-cols-1 gap-3 sm:grid-cols-2`; StructuredEntryPanel inherits
- **EXTR-05 explicit "Find specs" button gates LLM call** — pattern: button submits a form; no on-blur or per-keystroke firing; cache check happens BEFORE the network call

### Integration Points
- **Phase 70 mounts SearchEntry + StructuredEntryPanel** in place of today's `idle` and `paste-error` FlowState branches; both new components emit `onPick(result)` / `onSubmitStructured(extracted)` and `onSwitchToUrl()` for EXTR-07 — wiring is Phase 70's call
- **`AddWatchFlow` `viewerUserId` thread** (already present) extends to the four caches via prop-drill (D-07)
- **`/watch/new/page.tsx` Server Component prop additions:** `catalogBrands: string[]` joins `viewerUserId: string` and the other existing server-fetched props; the new DAL `listCatalogBrands` fires at SSR time
- **`<ExtractErrorCard>` mode-branched copy** — implements Phase 66 D-06; the card already renders inside AddWatchFlow's existing extract-error branch; this phase adds the `mode` prop and the copy branch
- **`WatchSearchRowsAccordion.tsx:47`** — collateral retrofit site for `useWatchSearchVerdictCache(collectionRevision, viewerUserId)`; `SearchPageClient` is the upstream prop source (confirm during planning that viewer-id is already in scope there, else thread it)

</code_context>

<specifics>
## Specific Ideas

- **Multi-word brand matching (the user's specific concern)** — `"tag heuer monaco 1133b"` must produce `brand="Tag Heuer"`, NOT `brand="tag"`. D-12 algorithm sorts the catalog brand list by length DESC before iterating so longer matches always win. Test case (b) in D-12 pins this.
- **Original-case preservation from catalog** — when the brand matches, the returned `brand` value uses the catalog row's original casing ("Omega", "Tag Heuer", "A. Lange & Söhne"), not the user's input casing. The user typed "omega"; the pre-seed shows "Omega". Small but materially nicer.
- **Naive-split honesty** — on a catalog brand miss, the parser does the dumb split AND preserves the user's input casing ("cartier" stays "cartier" — user fixes if they care). Lying about case-from-catalog when we don't have it would surprise the user.
- **In-render reset (NOT setState)** — D-06's `if (moduleUserId !== viewerUserId) moduleCache = new Map()` is intentional sync mutation in render body. The `useWatchSearchVerdictCache` JSDoc spells out exactly why this is safe (no React subscribers to module state); same justification carries forward.
- **`viewerUserId` as a required positional arg** (D-08) — TypeScript surfaces every caller in the same compile. Optional + backward-compat would let the `WatchSearchRowsAccordion` site silently keep the leak. Required failure is the desired failure here.
- **Cache key normalization symmetry** — D-18's `JSON.stringify({brand: lower-trim, model: lower-trim, reference: lower-trim, year: number-or-null})` matches the catalog DAL's natural-key normalization. Two sites of the same normalization rule — a planner note to keep these aligned if catalog normalization ever changes (defer to a future shared normalize helper if it gets touched).
- **`<ExtractErrorCard mode>` branching is single-row only** — only the `structured-data-missing` user-facing copy varies by mode. The 4 other categories (`host-403`, `LLM-timeout`, `quota-exceeded`, `generic-network`) reuse the LOCKED Phase 25 D-15 copy in both modes. Per Phase 66 D-06: "unlocks ONE row of the D-15 copy table".

</specifics>

<deferred>
## Deferred Ideas

- **Extract `useTypeaheadSearch(query, action)` shared hook** — D-04 keeps the setTimeout+AbortController pattern local to SearchEntry. If `/search` ever gets retrofitted to share the hook, the refactor is its own phase (touches the existing `useSearchState.ts:131` for the third time).
- **Brand-list staleness handling** — `listCatalogBrands` is fetched once per `/watch/new` SSR. Users adding NEW brands via the structured-input path won't see them in the parser until the next page visit. Acceptable — the parser falls back to the naive split for novel brands. Revisit if catalog-growth velocity makes the staleness window painful.
- **Owners-count "0 collectors" copy variant** — Claude's discretion picks honest literal "0 collectors". If UAT shows this reads as discouraging, swap to "Be the first to add this" or similar. Future-phase polish.
- **`@base-ui/react/combobox` slot composition shared abstraction** — if the v8.0 milestone or a future flow adds a second combobox surface, factor out a Horlo `<HorloCombobox>` wrapper. Premature now (one consumer).
- **ExtractErrorCard mode-branched copy text drafting** — Claude's discretion picks the structured-mode `structured-data-missing` copy. Phase 70 UAT may rewrite it; pin the draft now, refine on prod evidence.
- **Phase 70 follow-ups carried forward from this phase:**
  - Wire `onPick(result)` to DUPE-01/02/03 branching (this phase ships SearchEntry agnostic to DUPE)
  - Wire `onSubmitStructured(extracted)` to ConfirmStep mount + addWatch flow
  - Wire `onSwitchToUrl()` to the URL-paste path (EXTR-07 routing)
  - Extend the Phase 29 three-layer reset to include `useCatalogSearchCache` + `useStructuredExtractCache` (CLNP-05)
  - "Skip search — enter manually" link from idle state routing to `?manual=1` (CLNP-06)
- **Phase 71 follow-ups:**
  - Delete `PasteSection.tsx` + `PasteSection.test.tsx` (replaced by EXTR-07 backup link in StructuredEntryPanel)
  - Delete `VerdictStep.tsx` + `VerdictStep.test.tsx` + `WishlistRationalePanel.tsx` + `WishlistRationalePanel.test.tsx`
  - Add `tests/static/AddWatchFlow.no-paste-section.test.ts` (with `// @vitest-environment node`) guard

### Reviewed Todos (not folded)
None — no pending todos matched Phase 69 scope.

</deferred>

---

*Phase: 69-searchentry-structuredentrypanel-cache-hygiene*
*Context gathered: 2026-05-29*

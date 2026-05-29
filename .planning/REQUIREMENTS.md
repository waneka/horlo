# Requirements: Horlo v8.0 Add-Watch Redesign

**Defined:** 2026-05-28
**Core Value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.

**Milestone Goal:** Replace today's URL-or-manual-form-then-status-lock add flow with a search-first flow that reuses the catalog when it can, extracts from structured input when it can't, and lets the user pick status (incl. grail) on a lighter confirm screen — without changing `/w/[ref]`.

## v8.0 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Search Entry (SRCH)

Entry surface for the redesigned add flow. Typeahead over `watches_catalog` is the primary path; structured-input + URL paste are no-match fallbacks.

- [x] **SRCH-17**: User can type in a search input as the primary entry to `/watch/new` (replaces today's `PasteSection` URL paste as the headline path)
- [x] **SRCH-18**: Search results fire at ≥2 characters with ~200–250 ms debounce via Server Action wrapping `searchCatalogWatches`
- [x] **SRCH-19**: Each result row shows brand, model, reference, cover photo, and a viewer-state badge ("In collection" for `owned`, "On wishlist" for `wishlist`) — sold/null states show no badge
- [x] **SRCH-20**: Keyboard navigation through results (Up/Down/Enter) using `role="listbox"` + `role="option"` combobox ARIA pattern
- [x] **SRCH-21**: Clicking a result advances the flow (to confirm screen for non-owned, to `/w/[ref]` for owned — see DUPE-01)
- [x] **SRCH-22**: Matched-text substring is highlighted in result rows via the existing Phase 16 XSS-safe `HighlightedText` component
- [x] **SRCH-23**: Owners count is displayed on each result row (e.g. "47 collectors") sourced from existing `ownersCount` field
- [x] **SRCH-24**: A persistent "Not finding it? Add manually" footer row appears below results (when results > 0) AND in the no-match empty state — both link to the structured-input screen
- [x] **SRCH-25**: When `query.length ≥ 3` and `results.length === 0`, a no-match empty state renders with structured-input CTA + "Have a URL for this watch?" backup link
- [x] **SRCH-26**: Search query string pre-seeds the structured-input screen fields (e.g. "omega speedmaster 3135" → brand="omega", model="speedmaster", reference="3135" best-effort split)

### Structured-Input Extraction (EXTR)

No-URL LLM extraction path for catalog misses.

- [x] **EXTR-01**: `/api/extract-watch` accepts a discriminated body `{ mode: 'url', url: string } | { mode: 'structured', brand: string, model: string, reference?: string, year?: number }`; existing URL behavior unchanged
- [x] **EXTR-02**: Structured mode short-circuits BEFORE the cheerio HTML stages (Pitfall 3 mitigation) — verified by integration test asserting no `cheerio` call when `mode === 'structured'`
- [x] **EXTR-03**: Brand and model are required fields; reference and year are optional inputs; the structured branch returns an `ExtractedWatchData` shape consistent with the URL branch
- [x] **EXTR-04**: A new LLM prompt variant ("given watch identity, infer known specs from training knowledge") drives the structured extraction via existing `@anthropic-ai/sdk` + `claude-sonnet-4-6` strict tool-use
- [x] **EXTR-05**: A loading state (reuse `VerdictSkeleton` or equivalent) renders during the LLM round-trip; explicit "Find specs" button gates the call (no per-keystroke firing)
- [x] **EXTR-06**: An optional photo-upload affordance is surfaced on the structured-input screen via the existing `CatalogPhotoUploader`, feeding Phase 19.1 photo-based taste enrichment when present
- [x] **EXTR-07**: The no-match panel includes a "Have a URL for this watch?" secondary affordance that routes the user back through the existing URL-paste extraction path (URL paste demoted, not deleted)
- [x] **EXTR-08**: Structured-extract catalog row creation uses `upsertCatalogFromUserInput` (ON CONFLICT DO NOTHING), NOT `upsertCatalogFromExtractedUrl` — prevents LLM-inferred values from overwriting truthful nulls (Pitfall 5 mitigation)

### Confirm Screen + Status Selection (CONF)

Lighter review surface that replaces `VerdictStep`. Status incl. grail picked here.

- [x] **CONF-01**: Confirm screen renders cover photo at top (catalog `imageUrl`, then extracted `imageUrl`, then watch-icon placeholder fallback)
- [x] **CONF-02**: Brand, model, reference identity is displayed read-only by default
- [x] **CONF-03**: A segmented status picker (button group) presents owned / wishlist / grail; the `sold` status is intentionally absent from the add flow
- [x] **CONF-04**: Grail is visually distinguished by an inline lucide-react `Star` icon next to the "Grail" label (option weight/size unchanged)
- [x] **CONF-05**: Reference and year are inline-editable text inputs on the confirm screen (distinct from "Edit details" → WatchForm)
- [x] **CONF-06**: A status-gated price field renders — "Price paid" for owned, "Target price" for wishlist/grail — using the same `isOwned` conditional logic established in `WatchForm`
- [x] **CONF-07**: An "Edit details" affordance opens the full `WatchForm` (or expands inline) with all extracted/catalog data pre-filled; `lockedStatus` is NOT set (user can still change status in the full form)
- [x] **CONF-08**: The primary CTA label reflects the chosen status ("Add to Collection" / "Add to Wishlist" / "Save as Grail")
- [x] **CONF-09**: A "Start over" escape returns the user to the search idle state without persisting partial data
- [x] **CONF-10**: Status default derives from a `?status=` URL parameter (e.g. `/watch/new?status=wishlist` from the wishlist empty-state CTA) by threading `initialStatus` through to the confirm screen
- [x] **CONF-11**: `addWatch` Server Action Zod schema gains optional `catalogId: z.string().uuid()`; when supplied, the action calls `getCatalogById(catalogId)` to bind the user's watch row to the existing catalog row (skipping redundant `upsertCatalogFromUserInput`)

### Existing-in-Collection Handling (DUPE)

What happens when search surfaces a catalog row the viewer already owns or wishlists.

- [x] **DUPE-01**: Clicking a search result with `viewerState === 'owned'` navigates the user to `/w/[ref]` instead of advancing the add flow — requires a new `getWatchIdByCatalogId(userId, catalogId)` DAL helper to resolve the user's watch ID
- [ ] **DUPE-02**: If the user explicitly wants to add a second copy of an already-owned reference, an "Add another copy" affordance on the confirm screen (reachable via the structured-input or URL paths) bypasses the redirect
- [x] **DUPE-03**: Clicking a search result with `viewerState === 'wishlist'` advances to the confirm screen with status defaulting to `wishlist` AND a secondary "Move to Collection" affordance that updates the existing watch row's status (UPDATE, not INSERT) — reuses the resolved existing watch ID

### Legacy Path Cleanup (CLNP)

Subtractions enforcing the new flow as canonical.

- [ ] **CLNP-01**: `VerdictStep.tsx`, `WishlistRationalePanel.tsx`, and `PasteSection.tsx` are deleted along with their test files; no callers remain in the codebase
- [ ] **CLNP-02**: Static guard `tests/static/AddWatchFlow.no-verdict-step.test.ts` (`// @vitest-environment node`) fails the build if any of the three deleted components reappear in `AddWatchFlow.tsx`
- [ ] **CLNP-03**: Static guard `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` (`// @vitest-environment node`) mirrors the Phase 20 `tests/static/CollectionFitCard.no-engine.test.ts` pattern — fails CI if `CollectionFitCard` is imported by any file in the add flow
- [ ] **CLNP-04**: `RecentlyEvaluatedRail` is removed from `AddWatchFlow`; component file disposition (delete vs. retain for future repurpose) decided during plan-phase
- [x] **CLNP-05**: `FlowState` discriminated union in `flowTypes.ts` is cleaned — old states (`verdict-ready`, `wishlist-rationale-open`, `submitting-wishlist`) removed; new states (`search-idle`, `search-results`, `structured-input`, `extracting-structured`, `confirming`) added; surviving states (`form-prefill`, `manual-entry`, `photos-pending`) preserved
- [ ] **CLNP-06**: A "Skip search — enter manually" link renders in the search idle state and routes to `?manual=1` (priority preserved above the new search-first default)
- [x] **CLNP-07**: All four module-scope caches (`useCatalogSearchCache`, `useStructuredExtractCache`, `useWatchSearchVerdictCache`, `useUrlExtractCache`) clear on signOut via a shared `lastUserId` check — closes the existing Active tech debt item for `useWatchSearchVerdictCache` in the same change *(Plan 02: 2 new caches; Plan 03: 2 existing caches retrofit + 3-layer thread; Plan 06: four-cache user-switch integration test in AddWatchFlow.test.tsx — green)*

## v2 Requirements

Deferred to a future milestone. Tracked but not in current roadmap.

### Optimistic-Commit UX

- **CONF-V2-01**: Optimistic commit on the confirm screen with Sonner action-slot "Undo" toast (Phase 28 pattern) — requires rollback Server Action + cache invalidation choreography; HIGH complexity, descope to v8.x

### Search Quality

- **SRCH-V2-01**: Levenshtein / pg_similarity fuzzy "did you mean X" suggestions — meaningful only at higher catalog depth (post-SEED-009 v9.0 Catalog Expansion)
- **SRCH-V2-02**: Search-history surface ("recently searched" chips) on the entry view — valuable but not in scope for v8.0

### Catalog Expansion

- **CAT-V2-NN**: Bulk catalog import / external sourcing — all SEED-009 scope, handled by v9.0 Catalog Expansion milestone

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| `CollectionFitCard` rendered inside the add flow | Operator decision: verdict lives on `/w/[ref]` only. Static guard CLNP-03 enforces this. |
| Any changes to `/w/[ref]` | v7.0 Phase 64 IA redesign is settled; this milestone is add-flow-only. |
| Catalog row breadth expansion | SEED-009 / v9.0 Catalog Expansion milestone owns this. v8.0 ships against the ~100-row catalog as-it-is. |
| Exact-reference-only filtering (no fuzzy match) | A collector typing "speedmaster" expects brand+model fuzzy; reference-exact-only defeats the search-first premise. Keep existing pg_trgm ILIKE behavior. |
| Server-side search on every keystroke (no debounce) | Hammers the DB; at 200–250 ms debounce the latency is imperceptible. |
| "No results" empty state at query length < 3 | Sub-3-char queries match too broadly to be meaningful (e.g. "ro" → Rolex + Rado + Rotary). Only show at ≥3 chars. |
| "Did you mean X" fuzzy correction suggestions | At ~100 catalog rows, no meaningful corpus for suggestion generation. Defer to v9.0 catalog depth. |
| Running LLM extraction on every keystroke as the user types brand/model | LLM cost + UX degrade. Require explicit "Find specs" button press. |
| Requiring reference or year before allowing extraction | Many collectors don't know ref numbers; brand+model alone is sufficient for well-known watches. Optional fields only. |
| Full `WatchForm` ON the extraction screen | Extraction screen is a "give me enough to run the LLM" step; the full form lives behind the confirm screen's "Edit details" affordance. |
| "Sold" in the add-flow status picker | Sold is a transition state, not an initial state. WatchForm in edit mode retains all 4 statuses. |
| Blocking the add flow entirely when a watch is already owned | Some duplicates are legitimate (multiple references, second copy of the same watch). Warn + DUPE-02 affordance, don't block. |
| Optimistic commit with undo toast | HIGH complexity; descoped to v8.x (CONF-V2-01). |
| Separate notes textarea on the confirm screen | Notes belong in `WatchForm` (reachable via "Edit details"). Adding to confirm bloats the screen. |
| `WishlistRationalePanel` in the new flow | The rationale step's deliberate friction was right for the URL-extract evaluate-then-decide path; wrong for the search-first "I know what I want" intent. |
| New API route at `/api/extract-watch-structured` | Single route with discriminated body is simpler and aligns with existing 5-category error taxonomy (Phase 25 D-15). |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SRCH-17 | Phase 69 | Complete |
| SRCH-18 | Phase 69 | Complete |
| SRCH-19 | Phase 69 | Complete |
| SRCH-20 | Phase 69 | Complete |
| SRCH-21 | Phase 69 | Complete |
| SRCH-22 | Phase 69 | Complete |
| SRCH-23 | Phase 69 | Complete |
| SRCH-24 | Phase 69 | Complete |
| SRCH-25 | Phase 69 | Complete |
| SRCH-26 | Phase 69 | Complete |
| EXTR-01 | Phase 66 | Complete |
| EXTR-02 | Phase 66 | Complete |
| EXTR-03 | Phase 66 | Complete |
| EXTR-04 | Phase 66 | Complete |
| EXTR-05 | Phase 69 | Complete |
| EXTR-06 | Phase 69 | Complete |
| EXTR-07 | Phase 69 | Complete |
| EXTR-08 | Phase 66 | Complete |
| CONF-01 | Phase 68 | Complete |
| CONF-02 | Phase 68 | Complete |
| CONF-03 | Phase 68 | Complete |
| CONF-04 | Phase 68 | Complete |
| CONF-05 | Phase 68 | Complete |
| CONF-06 | Phase 68 | Complete |
| CONF-07 | Phase 68 | Complete |
| CONF-08 | Phase 68 | Complete |
| CONF-09 | Phase 68 | Complete |
| CONF-10 | Phase 68 | Complete |
| CONF-11 | Phase 67 | Complete |
| DUPE-01 | Phase 70 | Complete |
| DUPE-02 | Phase 70 | Pending |
| DUPE-03 | Phase 70 | Complete |
| CLNP-01 | Phase 71 | Pending |
| CLNP-02 | Phase 71 | Pending |
| CLNP-03 | Phase 71 | Pending |
| CLNP-04 | Phase 71 | Pending |
| CLNP-05 | Phase 70 | Complete |
| CLNP-06 | Phase 70 | Pending |
| CLNP-07 | Phase 69 | Done (Plan 06: AddWatchFlow.test.tsx four-cache integration test green; build gate exit 0) |

**Notes on split requirements:**
- **DUPE-01**: `getWatchIdByCatalogId` DAL helper ships in Phase 67 as a primitive; the owned-result redirect click-handler (user-observable behavior) wires in Phase 70. Traceability maps DUPE-01 to Phase 70 (where the user sees the behavior).
- **DUPE-03**: Same pattern — Phase 67 delivers the DAL read of the existing watch ID; Phase 70 wires the wishlist-default + "Move to Collection" UPDATE path. Traceability maps DUPE-03 to Phase 70.

**Coverage:**
- v8.0 requirements: 39 total
- Mapped to phases: 39 (100%)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-28*
*Last updated: 2026-05-28 — traceability filled in by roadmapper (Phases 66-71)*

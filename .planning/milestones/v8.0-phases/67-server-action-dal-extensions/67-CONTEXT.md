# Phase 67: Server Action + DAL Extensions - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the three server-side primitives the Phase 68/69/70 UI layer will consume:

1. **`searchCatalogForAddFlow`** — a new Server Action in `src/app/actions/search.ts` + new sibling DAL fn in `src/data/catalog.ts`. Wraps a query-only search of `watches_catalog`, returns `SearchCatalogWatchResult[]` (same shape as the existing `searchWatchesAction`), with rows whose `reference_normalized` equals the normalized query bubbled to the top, then today's popularity-DESC + brand/model alpha tie-break.
2. **`addWatch` extension** — Zod schema gains optional `catalogId: z.string().uuid()`. When supplied, the action reads brand/model/reference from the catalog row via `getCatalogById(catalogId)` and skips `upsertCatalogFromUserInput`. Fail-fast `ActionResult` error on missing catalog row. Fire-and-forget side-effects (activity log, watch-overlap notifications, revalidates) run unchanged; taste enrichment + photo write-through skip only when the catalog row's `style_tags` are already populated.
3. **`findViewerWatchByCatalogId` extension** — extend the existing owned-only helper in `src/data/watches.ts:295` with `statuses?: ('owned' | 'wishlist')[]` (default `['owned']` preserves BUG-01 callers). Widen the return to `{ id: string; status: 'owned' | 'wishlist' } | null`. Owned wins over wishlist when both rows exist for the same catalogId (mirrors SRCH-10 D-05).

Requirements delivered:
- **CONF-11** — `addWatch` Zod schema gains optional `catalogId`; uses `getCatalogById` to bind the new watch row to the existing catalog row
- **DUPE-01 (DAL part)** — `findViewerWatchByCatalogId` returns the user's owned watch id for a catalog row they own
- **DUPE-03 (DAL part)** — same fn returns the user's wishlist watch id (status surfaced for Phase 70 to branch on)
- (CONF-11 success-criterion-2: `addWatch(data)` with `catalogId` supplied skips `upsertCatalogFromUserInput` and binds via `getCatalogById`)
- (DUPE-01/03 success-criterion-3: `findViewerWatchByCatalogId(userId, catalogId, ['owned', 'wishlist'])` returns owned row when present else wishlist row else null — verified by unit test)
- (Search-fn success-criterion-1: `searchCatalogForAddFlow('speedmaster')` returns rows with exact-reference matches first, each row carrying a `viewerState` of `owned` / `wishlist` / null, with no N+1)

**Not this phase:** UI components (`SearchEntry`, `ConfirmStep`, `StructuredEntryPanel` — Phases 68/69), `AddWatchFlow` state-machine rewrite + DUPE redirect/UPDATE wiring (Phase 70), the `?manual=1` priority + `?returnTo=` round-trip (Phase 70), the structured-input panel that calls `/api/extract-watch` (Phase 69), and the "Move to Collection" UPDATE-not-INSERT action (Phase 70 — separate action surface, NOT inside `addWatch`).

</domain>

<decisions>
## Implementation Decisions

### Search Action shape — `searchCatalogForAddFlow`
- **D-01:** **New sibling Server Action + new sibling DAL function.** Ship `searchCatalogForAddFlow` as a new export in `src/app/actions/search.ts` next to `searchWatchesAction`, AND a new fn in `src/data/catalog.ts` next to `searchCatalogWatches`. Two new files-of-callers; zero risk of /search-page regression; future divergence (no facets, different sort, possibly different limit) lands cleanly in one place. The existing `searchWatchesAction` + `searchCatalogWatches` are NOT modified. **Planner discretion:** the new DAL fn may either inline a near-duplicate of `searchCatalogWatches`'s candidate query + viewerState hydration, OR extract a private helper (e.g. `hydrateViewerStateForCatalogIds(viewerId, topIds)`) that both fns call. Recommend extract-helper when the viewerState hydration block is the only line-for-line duplicate.
- **D-02:** **Auth-required; same `ActionResult` contract as `searchWatchesAction`.** `getCurrentUser()` runs FIRST (AUTH-04 / D-14); on `UnauthorizedError` return `{ success: false, error: 'Not authenticated' }`. Viewer is required anyway for the viewerState badge hydration. Matches every other Server Action in the codebase.
- **D-03:** **Query + limit only — no facet surface.** Action signature: `searchCatalogForAddFlow(input: unknown): Promise<ActionResult<SearchCatalogWatchResult[]>>` where the Zod schema accepts `{ q: string, limit?: number }`. Default limit 20 (matches existing). No `movement` / `size` / `style` / `brand` / `era` filters — v8.0 has no facet UI in the add flow (Out-of-Scope row "Exact-reference-only filtering" already affirms the fuzzy-match direction; facets are pure /search-page surface). Future filter additions land via D-01's separate fn without coupling to `/search`.

### Sort behavior — exact-reference-first
- **D-04:** **Exact match = `reference_normalized = queryNormalized` only.** `queryNormalized = regexp_replace(lower(trim(q)), '[^a-z0-9]+', '', 'g')` — same expression used by `upsertCatalogFromUserInput` and `searchCatalogWatches`'s reference branch. Brand-exact / model-exact do NOT receive the sort bump (they still match via the existing ILIKE OR predicate, just without the priority tier). Matches the user's mental model when pasting a reference number. Reference-empty queries (e.g. `q = "rolex"` → `queryNormalized = "rolex"`) still produce a valid SQL comparison; rows whose `reference_normalized` happens to equal "rolex" (effectively none) just won't bubble.
- **D-05:** **Two-tier ORDER BY, popularity-DESC tie-break inside each tier.** SQL pattern: `ORDER BY (reference_normalized = ${queryNormalized}) DESC NULLS LAST, (owners_count + 0.5 * wishlist_count) DESC, brand_normalized ASC, model_normalized ASC`. Boolean-DESC in PostgreSQL puts `true` first (exact-ref rows). Within both tiers (bumped and not-bumped), preserve the existing popularity-DESC + alphabetical tie-break that `searchCatalogWatches` uses today. Predictability across surfaces.

### DAL helper overlap — `findViewerWatchByCatalogId`
- **D-06:** **Extend existing `findViewerWatchByCatalogId` (do not rename, do not duplicate).** Add an optional third parameter `statuses?: ('owned' | 'wishlist')[]` with default `['owned']`. Default preserves the existing BUG-01 contract (owned-only) for every current caller without code churn. New Phase 70 callers pass `['owned', 'wishlist']`.
- **D-07:** **Widen the return type to `{ id: string; status: 'owned' | 'wishlist' } | null`.** The old `{ id: string } | null` return is a structural subset (TypeScript will catch any caller relying on object identity); audit the 1-3 existing callers and update destructuring to ignore the new `status` field. Phase 70 needs `status` to branch DUPE-01 (owned → redirect) vs DUPE-03 (wishlist → confirm screen with status defaulting to wishlist + "Move to Collection" affordance). Returning status from the DAL is cheaper than re-querying the watches row from Phase 70.
- **D-08:** **Owned wins over wishlist when both rows exist for the same catalogId.** Mirrors `searchCatalogWatches`'s SRCH-10 / D-05 precedence ('owned' beats 'wishlist'). SQL: `ORDER BY CASE status WHEN 'owned' THEN 0 WHEN 'wishlist' THEN 1 ELSE 2 END, created_at DESC LIMIT 1`. The `created_at DESC` deterministic-pick (Phase 67 inheriting Phase 56-era D-05) carries into both the owned and wishlist sub-orderings. Returns at most one row.

### `addWatch` catalogId branch semantics
- **D-09:** **Fail-fast on invalid catalogId — return `ActionResult` error, no silent fallback to upsert.** If `getCatalogById(catalogId)` returns null (deleted row, malformed UUID after Zod-pass — Zod catches UUID format pre-DAL, so this is the "row gone" case), return `{ success: false, error: 'Catalog reference not found' }` and abort the action. NEVER fall back to `upsertCatalogFromUserInput` from the client-supplied brand/model — that would silently create a new catalog row and defeat the search-first dedup goal that motivates v8.0. Matches Phase 38 D-06 fail-loud direction (`catalog_id` is NOT NULL; bad data must not silently insert wrong rows). **Planner discretion:** the error string is free-text for this phase; if Phase 70 wants a typed code (`'CATALOG_NOT_FOUND'`) for UI branching, that's a Phase 70 follow-up against this contract.
- **D-10:** **Trust the catalogId — ignore client-supplied brand/model/reference when catalogId is present.** The catalog row IS the truth for the (brand, model, reference) tuple. When `catalogId` is supplied and `getCatalogById` succeeds, **server-side override** `parsed.data.brand`, `parsed.data.model`, and `parsed.data.reference` with `catalogRow.brand`, `catalogRow.model`, `catalogRow.reference` BEFORE passing to `createWatch`. All other fields (movement, case size, dial color, notes, price, status, photoSourcePath, etc.) still come from the client. Matches Phase 38 D-06 spirit (catalog is canonical for identity). Avoids cross-check normalization fragility (spaces, case, hyphenation drift) that the alternative "error on mismatch" approach would suffer.
- **D-11:** **Side-effect chain: skip taste enrichment + photo write-through ONLY when the catalog row's `style_tags` are already populated. Everything else runs unchanged.** When `catalogId` is supplied AND `catalogRow.style_tags?.length > 0`, skip the `enrichTasteAttributes` + `updateCatalogTaste` block AND the `applyUserUploadedPhoto` write-through (saves an LLM call + a signed-URL roundtrip on every "I picked from typeahead" add). When `style_tags` is empty/null (catalog row predates enrichment, or enrichment failed at upsert-time), DO run the enrichment block — the new add is a legitimate re-enrichment trigger. ALWAYS run regardless of catalogId source: `logActivity`, `findOverlapRecipients` + `logNotification` (watch-overlap notifications fire on `status === 'owned'`), `revalidatePath('/')`, `revalidatePath('/u/[username]', 'layout')`, `revalidateTag('profile:${username}', 'max')`, `revalidateTag('explore', 'max')`. The "already-enriched" signal is `style_tags?.length > 0` only (cheapest single check; taste pass owns this field). **Planner discretion:** if a conservative signal is desired (e.g. `style_tags.length > 0 && era_signal IS NOT NULL`), the planner may widen it — but `style_tags` is the most reliable taste-pass success indicator.

### Claude's Discretion
- **Server Action result type:** reuse `SearchCatalogWatchResult` from `@/lib/searchTypes` — same shape as `searchWatchesAction` returns. No new public type needed.
- **Zod schema for `searchCatalogForAddFlow`:** `z.object({ q: z.string(), limit: z.number().int().min(1).max(50).optional() })` — explicit limit cap of 50 prevents abuse; `q` not pre-length-gated (DAL enforces the 2-char floor as the single source of truth, matching `searchWatchesAction`'s "keep the gate in one place" contract).
- **DAL helper-extraction call:** when extracting `hydrateViewerStateForCatalogIds(viewerId, topIds)` (D-01's recommended path), the helper lives in `src/data/catalog.ts` as a module-private (non-exported) function. The SRCH-10 D-05 owned-wins logic lives inside it; both `searchCatalogWatches` and `searchCatalogForAddFlow` call it. Planner may inline instead if extraction creates a thin wrapper with no shared logic.
- **`addWatch` schema field addition:** `catalogId: z.string().uuid().optional()` placed in `insertWatchSchema` next to `imageUrl` (alphabetical / grouping flexibility — planner picks). The `updateWatchSchema = insertWatchSchema.partial()` derived schema picks it up automatically; `editWatch` ignoring it is a no-op (catalogId is set once at insert, never updated post-Phase-38 outside catalog-reseat tooling).
- **Server-side brand/model override placement in `addWatch`:** the override happens AFTER the Zod parse + photoSourcePath ownership check but BEFORE the wishlist-sortOrder computation block. Concretely: pull `catalogRow` first when `catalogId` is supplied; then build `createPayload` with `brand: catalogRow.brand, model: catalogRow.model, reference: catalogRow.reference`. The `enrichTasteAttributes` `spec: {...}` block (line 178-194 of `watches.ts`) reads from `parsed.data` today — switch those reads to the overridden values so taste enrichment (when it runs) sees the canonical identity.
- **Unit test layering for the DAL helper:** the helper-extension test (DUPE-01/03 success criterion) lives in `src/data/__tests__/watches.test.ts` and covers four cases: (a) statuses=['owned'] with only an owned row → returns `{id, status: 'owned'}`; (b) statuses=['owned', 'wishlist'] with only a wishlist row → returns `{id, status: 'wishlist'}`; (c) statuses=['owned', 'wishlist'] with BOTH → returns the owned row (D-08); (d) statuses=['owned', 'wishlist'] with neither (or a non-viewer-owned row) → returns null. Add a fifth backward-compat case: default invocation (`findViewerWatchByCatalogId(userId, catalogId)`) returns owned-only (proves the BUG-01 contract still holds).
- **Integration test for `addWatch` catalogId branch:** lives in `src/app/actions/__tests__/watches.test.ts`. Covers: (a) `catalogId` supplied AND row exists → no `upsertCatalogFromUserInput` call (mock+assert); (b) `catalogId` supplied AND row missing → returns `{success: false, error: 'Catalog reference not found'}`, no `createWatch` call; (c) `catalogId` supplied + client brand="WRONG" → created watch has `brand = catalogRow.brand` (D-10); (d) `catalogId` supplied + catalog row `style_tags = ['dress']` → no `enrichTasteAttributes` call (mock+assert); (e) `catalogId` supplied + catalog row `style_tags = []` → `enrichTasteAttributes` IS called.

### Folded Todos
None — no pending todos matched Phase 67 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 67: Server Action + DAL Extensions" — phase goal, depends-on (none, parallelizable with Phase 66), 3 success criteria
- `.planning/REQUIREMENTS.md` §"Confirm Screen + Status Selection (CONF)" item CONF-11 — `addWatch` Zod gains optional `catalogId`
- `.planning/REQUIREMENTS.md` §"Existing-in-Collection Handling (DUPE)" items DUPE-01, DUPE-03 — DAL helper primitives (DUPE-01/03 UI lands in Phase 70)
- `.planning/REQUIREMENTS.md` §"Traceability" notes-on-split — DUPE-01/03 DAL part lives in Phase 67; UI part in Phase 70
- `.planning/seeds/SEED-010-v5.3-add-watch-redesign.md` — milestone rationale (URL → search-first pivot; why DAL primitives matter before UI lands)
- `.planning/phases/66-api-route-extension/66-CONTEXT.md` — Phase 66 already locked: structured-mode response carries `mode` + `catalogId` (consumed by Phase 70, not by Phase 67); CONF-11 Zod direction confirmed

### Server Action surface being extended
- `src/app/actions/watches.ts:79-306` — existing `addWatch` action; full chain (auth → Zod parse → photoSourcePath ownership check → wishlist-sortOrder computation → catalog upsert at L128 [FAIL-LOUD, Phase 38 D-06] → `createWatch` at L142 → photo write-through L155-171 → taste enrichment L174-200 → activity log L204-222 → watch-overlap notifications L228-274 → revalidates L276-296)
- `src/app/actions/watches.ts:22-68` — `insertWatchSchema` (where `catalogId: z.string().uuid().optional()` lands per CONF-11)
- `src/app/actions/search.ts:97-138` — existing `searchWatchesAction` (precedent for the new `searchCatalogForAddFlow` action's auth + Zod + ActionResult shape)

### DAL functions being extended / referenced
- `src/data/catalog.ts:138-176` — `upsertCatalogFromUserInput` (CAT-06; skipped by the new catalogId-supplied branch)
- `src/data/catalog.ts:178-244` — `upsertCatalogFromExtractedUrl` (CAT-07; URL-extract only; NOT called from `addWatch`)
- `src/data/catalog.ts:254-258` — `getCatalogById` (CAT-11; THE function the new catalogId-supplied branch calls)
- `src/data/catalog.ts:332-511` — `searchCatalogWatches` (Phase 19 SRCH-09/10 + Phase 40 SRCH-16); reference implementation for the new `searchCatalogForAddFlow` DAL fn (candidate query + anti-N+1 viewerState hydration + SRCH-10 D-05 owned-wins precedence)
- `src/data/watches.ts:295-317` — `findViewerWatchByCatalogId` (the existing owned-only fn being EXTENDED per D-06/D-07/D-08; currently returns `{ id } | null` with `eq(watches.status, 'owned')` BUG-01 fix and `orderBy(desc(watches.createdAt))` D-05 deterministic pick)
- `src/data/watches.ts:326-352` — `createWatch` (Phase 38 D-06 IDIOM A: catalogId is a required second positional arg)
- `src/lib/searchTypes.ts` — `SearchCatalogWatchResult` type (Shape: `{ catalogId, brand, model, reference, imageUrl, ownersCount, wishlistCount, viewerState }`); the new fn returns this exact type

### Auth + error contract
- `src/lib/auth.ts` — `getCurrentUser`, `UnauthorizedError` (AUTH-04 / D-14 gate; `searchCatalogForAddFlow` follows the same pattern as `searchWatchesAction`)
- `src/lib/actionTypes.ts` — `ActionResult<T>` discriminated union (D-12 / D-15; the new action returns `ActionResult<SearchCatalogWatchResult[]>`; `addWatch` extension preserves the contract — never throws across the boundary)

### Cross-phase coordination (NOT in this phase, but Phase 67 decisions affect)
- **Phase 68** (`ConfirmStep`) — reads `addWatch`'s `ActionResult` shape; D-09's free-text error string carries through. CONF-11 unblocks Phase 68's CTA flow.
- **Phase 69** (`SearchEntry`) — calls `searchCatalogForAddFlow` directly with debounce + module-scope cache `useCatalogSearchCache`. D-01 + D-02 lock the Server Action signature.
- **Phase 70** (`AddWatchFlow` rewrite + DUPE wiring) — primary consumer of `findViewerWatchByCatalogId(userId, catalogId, ['owned', 'wishlist'])` (DUPE-01 redirect + DUPE-03 default-to-wishlist); D-07 widening surfaces `status` for branching. Phase 70 owns the "Move to Collection" UPDATE-not-INSERT action (separate from `addWatch`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`getCurrentUser()` + `UnauthorizedError`** (`src/lib/auth.ts`) — auth-first gate, identical pattern from `searchWatchesAction` and `addWatch`
- **`searchCatalogWatches` candidate query + viewerState hydration block** (`src/data/catalog.ts:332-511`) — reference implementation; the new `searchCatalogForAddFlow` DAL fn either inlines the same anti-N+1 hydration or extracts a shared private helper (D-01 + Claude's Discretion notes)
- **`getCatalogById` (`src/data/catalog.ts:254`)** — single-row read by id; called by the new `addWatch` catalogId branch; public-read RLS allows it
- **`SearchCatalogWatchResult` type** (`@/lib/searchTypes`) — exact shape the new action returns
- **`ActionResult<T>` envelope** (`@/lib/actionTypes`) — discriminated union; never-throws-across-boundary contract preserved
- **`mapRowToCatalogEntry` (`src/data/catalog.ts:53`)** — used internally by `getCatalogById`; consumer doesn't need to know

### Established Patterns
- **Auth-first gate** (Phase 25 / AUTH-04 / D-14) — `try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }` BEFORE Zod parse. Both the new action and the extended `addWatch` preserve this order.
- **DAL enforces the 2-char floor; action does not pre-filter** (`searchWatchesAction` comment, `actions/search.ts:90`) — "keeping the gate in one place makes the security invariant easier to audit." `searchCatalogForAddFlow` follows.
- **Phase 38 D-06 fail-loud catalog upsert** (`watches.ts:127-140`) — extended in D-09: the catalogId-supplied branch ALSO fails fast (catalog row missing → `ActionResult` error) instead of fallback-upsert. Same intent, different mechanism (no upsert call to fail).
- **SRCH-10 D-05 owned-wins viewerState precedence** (`searchCatalogWatches` lines 486-499) — reused verbatim in D-08 for the DAL helper's owned-over-wishlist tie-break.
- **Anti-N+1 batched viewerState hydration** (`searchCatalogWatches` lines 472-485) — a SINGLE `inArray(watches.catalogId, topIds)` keyed by viewerId. The new DAL fn must use the same pattern (success-criterion 1 explicitly requires "no N+1 queries"). The candidate query orders, slices to limit, then hydrates state for the top-N catalogIds in one round-trip.
- **Discriminated-input parsing via Zod** in Server Actions (`verdict.ts:3`, `comments.ts:4`, `wearEvents.ts:4`, `notifications.ts:4`, `wishlist.ts:4`, `search.ts:97`) — adoption is consistent; `catalogId: z.string().uuid().optional()` is incremental.
- **`createWatch(userId, catalogId, data)` requires catalogId positional** (Phase 38 D-06 IDIOM A) — both branches (upsert-path and catalogId-supplied-path) must end at a single `createWatch` call with a resolved catalogId.

### Integration Points
- **Phase 69 consumes `searchCatalogForAddFlow`** — `SearchEntry` typeahead invokes it with a debounced query; module-scope `useCatalogSearchCache` deduplicates inflight requests (Phase 69 owns the cache).
- **Phase 70 consumes BOTH the extended `addWatch` AND the extended `findViewerWatchByCatalogId`** — DUPE-01 redirect reads the helper's owned row; DUPE-02 "Add another copy" bypasses the redirect by calling `addWatch` without catalogId (or with a forced flag — Phase 70's call); DUPE-03 "Move to Collection" is a separate Phase 70 action that UPDATEs the wishlist watch row's status (NOT inside `addWatch`).
- **`/search` page is untouched** — `searchCatalogWatches` and `searchWatchesAction` are NOT modified; `/search` UX stays bit-identical.

</code_context>

<specifics>
## Specific Ideas

- **The exact ORDER BY for D-04 + D-05**: `ORDER BY (reference_normalized = ${queryNormalized}) DESC NULLS LAST, (owners_count + 0.5 * wishlist_count) DESC, brand_normalized ASC, model_normalized ASC`. The boolean-DESC-NULLS-LAST is the lever; PostgreSQL evaluates `(col = literal)` as a boolean that sorts `true` first under DESC. This is one line of ORDER BY change against the existing `searchCatalogWatches` template.
- **`statuses?` param default reflects safety**: `findViewerWatchByCatalogId(userId, catalogId, statuses = ['owned'])` — the default preserves BUG-01 for every existing caller without code changes. Audit existing callers (`grep -r "findViewerWatchByCatalogId" src/`) to confirm none destructure beyond `id`.
- **`getCatalogById` returns a `CatalogEntry`** — confirm the entry shape exposes `brand`, `model`, `reference`, and `styleTags` (or whatever the mapped name is). If `styleTags` is missing from the mapper, the D-11 already-enriched signal needs either a mapper extension or a direct query of the column.
- **Server-side override pattern in `addWatch`**: a small helper `resolveCatalogIdentity` could encapsulate "if catalogId supplied → read + override → return {brand, model, reference, catalogRow}; else → upsert + return {brand, model, reference, catalogId, catalogRow: null}" — both branches converge on a single `{brand, model, reference, catalogId, catalogRow}` shape, which the rest of the action consumes. Planner discretion: inline branch or extract helper.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 70 — "Move to Collection" UPDATE-not-INSERT action**: DUPE-03's UI behavior is a Phase 70 concern. The natural shape is a new action `moveWishlistToCollection(watchId)` (or extend `editWatch` with a `targetStatus: 'owned'` shortcut that triggers the wishlist→owned activity log + revalidates). Phase 67 ships only the DAL primitive that lets Phase 70 find the existing wishlist watch id.
- **Phase 70 — typed error codes from `addWatch`**: D-09 chose free-text error strings (`'Catalog reference not found'`). If Phase 70 wants discriminated codes (`'CATALOG_NOT_FOUND'` + UI branching), extend `ActionResult<T>` or add a `code?: string` companion field. Defer until Phase 70 surfaces the need.
- **Phase 70 — "Add another copy" affordance plumbing**: DUPE-02 lets a user explicitly add a second copy of an already-owned ref. The signal flows from Phase 70's UI; mechanically it's just `addWatch(data)` WITHOUT `catalogId` — back to the upsert path that already finds the existing catalog row (ON CONFLICT DO NOTHING). No `addWatch` change needed for DUPE-02; Phase 70's UI just bypasses the owned-redirect.
- **Helper extraction `hydrateViewerStateForCatalogIds`**: D-01 leaves this to planner discretion. If extracted, it lives module-private in `src/data/catalog.ts` and is shared by both `searchCatalogWatches` and `searchCatalogForAddFlow`. If duplicate divergence stays minimal, inline is fine.
- **Conservative "already-enriched" signal for D-11**: planner may widen `style_tags?.length > 0` to `style_tags?.length > 0 && era_signal IS NOT NULL` if production data shows partial-enrichment rows. Cheapest single check stays the recommendation.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 67 scope.

</deferred>

---

*Phase: 67-server-action-dal-extensions*
*Context gathered: 2026-05-28*

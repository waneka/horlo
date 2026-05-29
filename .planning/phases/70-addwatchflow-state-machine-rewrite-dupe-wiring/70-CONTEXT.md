# Phase 70: AddWatchFlow State Machine Rewrite + DUPE Wiring - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite `src/components/watch/AddWatchFlow.tsx` and `src/components/watch/flowTypes.ts` end-to-end so that the v8.0 search-first add-flow becomes the live behavior on `/watch/new`. Phases 66–69 shipped every dormant primitive — DAL helpers, Server Actions, `ConfirmStep`, `SearchEntry`, `StructuredEntryPanel`, the two new module caches, `catalogBrands` plumbing. Phase 70 is the orchestrator that wires them, owns FlowState transitions, lands the DUPE-01/02/03 behavior on top of `findViewerWatchByCatalogId`, and adds one new Server Action (`moveWishlistToCollection`) for the wishlist→collection UPDATE path.

What ships in this phase:

1. **`src/components/watch/flowTypes.ts` rewritten** — old `verdict-ready` / `wishlist-rationale-open` / `submitting-wishlist` / `submitting-collection` / `extracting` variants removed; new `search-idle` / `extracting-url` / `confirming` / `submitting` variants added (plus shape-revised `extraction-failed` with `mode`); surviving variants `form-prefill` / `manual-entry` / `photos-pending` preserved verbatim. ROADMAP CLNP-05 reconciliation: the literal enumeration listed `search-idle` + `search-results` + `structured-input` + `extracting-structured` as four separate states, but SearchEntry (Phase 69) owns the result/structured/extracting sub-states internally — splitting them at the orchestrator level would mirror SearchEntry's local state. Phase 70 collapses those four into the single orchestrator-level `search-idle` and records this in CONTEXT as a reasoned deviation (Phase 71's CLNP-05 static guard will match the final shape, not the ROADMAP draft).

2. **`src/components/watch/AddWatchFlow.tsx` rewritten** — `PasteSection`, `VerdictStep`, `WishlistRationalePanel` imports REMOVED (hard cutover; Phase 71 deletes the files + adds the static guards). New imports: `SearchEntry`, `ConfirmStep`, `DupeBanner` (new — see §3). New handlers: `handleSearchPick`, `handleStructuredSubmit`, `handleUrlBackup`, `handleConfirmPrimary`, `handleConfirmStartOver`, `handleConfirmEditDetails`, `handleSkipSearch`, `handleMoveToCollection`, `handleAddAnotherCopy`. `handleWatchCreated` (Phase 61 photos-pending intercept) preserved for `form-prefill` / `manual-entry` branches. Activity-hide `useLayoutEffect` cleanup gains the new FlowState kinds in its sentinel checks; module-scope caches are intentionally NOT cleared on Activity-hide (cross-user reset already handled by Phase 69 CLNP-07; same-user remount cache survival is the whole point of the caches).

3. **`src/components/watch/DupeBanner.tsx` new (small, sibling of ConfirmStep)** — a thin presenter that renders the DUPE-02 / DUPE-03 affordance ABOVE `ConfirmStep` when `confirming` state carries a `dupeContext`. Phase 68 D-03's ConfirmStep prop contract is LOCKED — adding `onMoveToCollection` / `onAddAnotherCopy` callbacks would break it. Rendering as a sibling banner under AddWatchFlow's control honors the contract. Props: `{ existingStatus: 'owned' | 'wishlist'; existingReference: string | null; onViewExisting: () => void; onMoveToCollection?: () => void; onAddAnotherCopy: () => void; pending?: boolean }`. Pure presenter (same shape as ConfirmStep — props in, callbacks out, no Server Action call, no router-push).

4. **`src/app/actions/watches.ts` new export `moveWishlistToCollection(watchId, opts?: { pricePaid?: number; notes?: string })`** — wraps `editWatch`-equivalent logic for the wishlist→owned status flip, AND fires the side-effects `editWatch` does NOT today: `logActivity('watch_added', ...)`, overlap notifications via `findOverlapRecipients` + `logNotification`, plus the same `revalidatePath` + `revalidateTag` matrix `addWatch` runs. Confirmed gap: `editWatch` at `src/app/actions/watches.ts:358-512` does NOT emit `logActivity` or `logNotification` — so a bare `editWatch({status:'owned'})` for DUPE-03 would silently skip the activity feed entry and overlap notifications. New action explicitly fires them.

5. **`/watch/new/page.tsx` is minimally touched** — already passes everything Phase 70 needs (`viewerUserId`, `viewerUsername`, `catalogBrands`, `initialReturnTo`, `initialStatus`, `initialManual`, `initialCatalogPrefill`, `collection.length`). No new server-fetched props.

6. **Phase 70 imports + uses (already shipped, dormant)**:
   - `SearchEntry` (Phase 69) → mounted in `search-idle` branch
   - `ConfirmStep` (Phase 68) → mounted in `confirming` branch
   - `StructuredEntryPanel` (Phase 69) → mounted inside SearchEntry, not at orchestrator level
   - `ExtractErrorCard` (Phase 25 / Phase 69 mode-branch) → mounted in `extraction-failed` branch with `mode` prop wired
   - `WatchForm` (existing) → mounted in `form-prefill` (Edit details / deep-link) + `manual-entry` (CLNP-06 / `?manual=1`) branches
   - `WatchPhotoStep` (Phase 61) → mounted in `photos-pending` branch, gated on `status === 'owned'`
   - `findViewerWatchByCatalogId(viewerId, catalogId, ['owned','wishlist'])` (Phase 67) → called in the structured-input + URL-backup paths to populate `confirming.dupeContext`
   - `addWatch` with `catalogId` (Phase 67) → primary CTA on confirming (search-pick + structured-input paths)
   - `defaultDestinationForStatus`, `canonicalize`, `validateReturnTo` (Phase 28) → post-commit nav, toast suppression, returnTo validation

Requirements delivered (5 of 5; DUPE-02 / CLNP-05 / CLNP-06 + the UI sides of DUPE-01 / DUPE-03):
- **DUPE-01** UI part — owned search-pick → `router.push('/w/${result.reference}')` (DAL part done in Phase 67)
- **DUPE-02** — "Add another copy" affordance on confirming when `dupeContext.existingStatus === 'owned'`
- **DUPE-03** UI part — wishlist search-pick → confirming with status defaulting to wishlist + DupeBanner "Move to Collection" affordance (UPDATE via new `moveWishlistToCollection`; DAL part done in Phase 67)
- **CLNP-05** — `FlowState` cleaned; old variants removed, new search-flow variants added
- **CLNP-06** — "Skip search — enter manually" link renders in the search-idle branch, transitions in-flow to `manual-entry` (no URL push), preserving `?manual=1` entry-point semantics for deep-links

**Not this phase:**
- Deleting `VerdictStep.tsx` / `WishlistRationalePanel.tsx` / `PasteSection.tsx` files + adding `tests/static/AddWatchFlow.no-verdict-step.test.ts` + `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` static guards — Phase 71 (CLNP-01/02/03)
- `RecentlyEvaluatedRail` disposition (delete vs. retain) — Phase 71 (CLNP-04). This phase simply does NOT render the rail; the file stays untouched.
- Any change to `/w/[ref]` — PROJECT.md milestone lock (Verdict deliberately out of scope; no `CollectionFitCard` in add flow; no `/w/[ref]` edits)
- Any change to `searchCatalogForAddFlow` DAL/action, `searchWatchesAction`, or `/search` — Phase 67 shipped the search seam; Phase 70 consumes it
- Any change to `WatchForm.tsx` prop contract — Phase 70 reuses the existing `onWatchCreated` intercept for photos-pending (Phase 61 wiring)
- Any change to ConfirmStep's prop contract — Phase 68 D-03 LOCKED; DupeBanner is a sibling, not a ConfirmStep extension
- Any change to `/api/extract-watch` (Phase 66 shipped the mode-discriminated route; Phase 70 calls it from the new `extracting-url` branch)

</domain>

<decisions>
## Implementation Decisions

### FlowState shape (CLNP-05 reconciliation)

- **D-01 (final union):** **Collapse the ROADMAP's four-new-states enumeration into one `search-idle` orchestrator state.** SearchEntry (Phase 69) owns `query` / `results` / `showPanel` / `isPopupOpen` / extracting-structured internally. Splitting `search-idle` / `search-results` / `structured-input` / `extracting-structured` at the orchestrator level would mirror SearchEntry's local state and force prop-drilling of SearchEntry's internals upward (or, worse, two redundant sources of truth). Final union:

  ```ts
  export type FlowState =
    | { kind: 'search-idle' }
    | { kind: 'extracting-url'; url: string }
    | { kind: 'extraction-failed'; partial: ExtractedWatchData | null; reason: string; category: ExtractErrorCategory; mode: 'url' | 'structured' }
    | { kind: 'confirming'; catalogId: string | null; extracted: ExtractedWatchData; pickedResult: SearchCatalogWatchResult | null; dupeContext: DupeContext | null; pending: boolean }
    | { kind: 'form-prefill'; catalogId: string; extracted: ExtractedWatchData }
    | { kind: 'manual-entry'; partial?: ExtractedWatchData | null }
    | { kind: 'photos-pending'; watchId: string; destination: string }

  interface DupeContext {
    existingWatchId: string
    existingStatus: 'owned' | 'wishlist'
    existingReference: string | null
  }
  ```

  Reconciles to ROADMAP CLNP-05 spirit (old verdict-flow variants removed; new search-flow variants added; surviving variants preserved). The Phase 71 static guard (CLNP-02 / no-verdict-step) asserts the absence of the removed component names — it does NOT enforce the literal ROADMAP CLNP-05 state-name list. Phase 71 plan should be told to assert against THIS final union, not the ROADMAP draft.

- **D-02 (state transition map — write this comment block in flowTypes.ts):**
  ```
  search-idle ──onPick (owned)──────────────────→ /w/[ref]                          [DUPE-01]
  search-idle ──onPick (wishlist)───────────────→ confirming(dupeContext: wishlist) [DUPE-03 entry]
  search-idle ──onPick (null)───────────────────→ confirming(dupeContext: null)
  search-idle ──onSubmitStructured──────────────→ confirming(dupeContext: lookup)   [DUPE-02 may apply]
  search-idle ──onSwitchToUrl───────────────────→ extracting-url
  search-idle ──Skip-search link────────────────→ manual-entry                       [CLNP-06]
  extracting-url ──success──────────────────────→ confirming(dupeContext: lookup)
  extracting-url ──failure──────────────────────→ extraction-failed(mode: 'url')
  confirming ──onPrimary (success)──────────────→ photos-pending (owned) | destination (wishlist/grail)
  confirming ──onPrimary (failure)──────────────→ confirming(pending: false) + toast.error
  confirming ──onEditDetails────────────────────→ form-prefill
  confirming ──onStartOver──────────────────────→ search-idle
  confirming ──DupeBanner.onViewExisting────────→ /w/[ref]                          [DUPE-02 opt-out for owned]
  confirming ──DupeBanner.onMoveToCollection────→ moveWishlistToCollection → /u/[username]/collection  [DUPE-03 commit]
  confirming ──DupeBanner.onAddAnotherCopy──────→ confirming(dupeContext: null)     [DUPE-02 explicit-bypass; clears dupe banner; CTA stays primary addWatch]
  form-prefill ──onWatchCreated─────────────────→ photos-pending
  manual-entry ──onWatchCreated─────────────────→ photos-pending
  manual-entry ──back affordance────────────────→ search-idle
  photos-pending ──onDone / onSkip──────────────→ destination
  extraction-failed ──retryAction───────────────→ search-idle (URL-backup mode) | search-idle (structured mode — same)
  extraction-failed ──manualAction──────────────→ /watch/new?manual=1 (router.push) [preserves Phase 28 returnTo round-trip]
  ```

- **D-03 (`?manual=1` priority preserved verbatim):** When `initialManual === true`, the page-load FlowState resolves to `{ kind: 'manual-entry', partial: null }` BEFORE the search-first default. `?catalogId=X&intent=owned&prefill` (the form-prefill deep-link) still wins over `?manual=1` (catalog deep-links carry full extracted data; manual=1 fallback for empty Wishlist + Collection-no-key CTAs continues to short-circuit search). This mirrors the existing `initialState` ternary at `AddWatchFlow.tsx:135-140`; Phase 70 changes the third branch from `'idle'` to `'search-idle'` and leaves the precedence untouched.

- **D-04 (`?returnTo=` round-trip preserved verbatim):** `validateReturnTo(sp.returnTo)` continues to gate at the Server Component (`/watch/new/page.tsx:81`). `initialReturnTo` continues to thread into `AddWatchFlow`. Every post-commit branch (confirming.onPrimary success, moveWishlistToCollection success, form-prefill.onWatchCreated, manual-entry.onWatchCreated, photos-pending.onDone / onSkip) honors `initialReturnTo ?? defaultDestinationForStatus(status, viewerUsername)`. The Phase 28 D-05 / D-06 suppress-toast canonicalization stays as-is. No new returnTo surface added.

### DUPE-01 — owned-pick redirect

- **D-05 (route directly to `/w/[result.reference]` — no watchId lookup):** `SearchCatalogWatchResult.reference` is the catalog row's reference; `/w/[ref]` is the v7.0 unified route that renders the owner's watch correctly when the viewer owns the catalog row (Phase 64 IA redesign). No need to call `findViewerWatchByCatalogId` for the search-pick owned branch — the URL is fully derivable from the picked result. Single line: `router.push(\`/w/\${encodeURIComponent(result.reference)}\`)` when `result.viewerState === 'owned' && result.reference`.

- **D-06 (null-reference fallback):** A catalog row with `reference === null` (legitimate — some watches lack a public reference number) cannot route to `/w/[ref]`. Fallback: fall through to the `confirming` branch with `dupeContext.existingStatus = 'owned'`. The DupeBanner surfaces "Add another copy" / "View existing" (but "View existing" is disabled or replaced with a soft "Already in your collection" notice since there's no /w/[ref] target). Rare in practice (catalog upserts require brand+model; reference is optional). **Planner discretion:** if the planner finds a per-watchId fallback route (e.g. `/u/[username]/watch/[id]`) cleaner, use it. The structural model is "owned pick + null ref → confirm with owned-banner, no implicit redirect".

### DUPE-02 — "Add another copy" affordance

- **D-07 (when it appears):** Only in the `confirming` state when `dupeContext.existingStatus === 'owned'`. SearchEntry pick with `viewerState === 'owned'` skips confirm entirely (DUPE-01 redirect) — so DUPE-02 surfaces only when the user reached confirm via a path that didn't pre-signal ownership: structured-input + URL-backup. Phase 70 calls `findViewerWatchByCatalogId(viewerId, catalogId, ['owned','wishlist'])` after the catalog upsert resolves, to set `dupeContext` before mounting ConfirmStep. The DupeBanner is the surface.

- **D-08 ("Add another copy" semantics):** Clicking it clears `dupeContext` from `confirming` and re-renders without the banner. CTA stays primary `addWatch(catalogId)` — adds a second watch row bound to the SAME catalog row. This is legitimate (two different references of the same model collapse to one catalog row when ref is null/mismatched; the user explicitly wants two rows). The catalog row is unchanged. `addWatch` with the same `catalogId` for the same user creates a second row — confirm there's no UNIQUE (userId, catalogId) constraint on `watches` before locking; if there is, planner adopts the "always re-upsert via brand/model to mint a new catalog row" fallback instead. **Planner verifies during planning** — but my read of Phase 38's `(userId, catalogId)` constraints is that none was added (catalog rows are catalog-wide, not per-user; users can own multiple rows pointing at one catalog row).

- **D-09 (no `/w/[ref]` modification for DUPE-02):** PROJECT.md "no changes to `/w/[ref]` in this milestone" is the hard line. DUPE-02 lives entirely within the add flow's confirming branch. The user who already redirected to `/w/[ref]` (DUPE-01) and wants to add another copy must navigate back to `/watch/new` and reach confirm via a non-search-pick path (URL or structured) — acceptable friction for the rare second-copy case; v9.0 catalog expansion + v10+ may revisit.

### DUPE-03 — "Move to Collection"

- **D-10 (new Server Action `moveWishlistToCollection`):** New export in `src/app/actions/watches.ts`. Signature: `moveWishlistToCollection(watchId: string, opts?: { pricePaid?: number; notes?: string }): Promise<ActionResult<Watch>>`. Internal logic:
  1. `getCurrentUser()` auth gate (same as `addWatch` / `editWatch` pattern).
  2. `watchDAL.getWatchById(user.id, watchId)` — null-or-not-yours → `{ success: false, error: 'Watch not found' }` (mirrors `editWatch` `priorRow` null branch).
  3. Assert `priorRow.status === 'wishlist'` — if already `'owned'` (race / double-click), return `{ success: true, data: priorRow }` (idempotent no-op). If `'sold'` / `'grail'`, return `{ success: false, error: 'Cannot move {status} watch to collection' }`.
  4. Build `updatePayload`: `status: 'owned'`, `pricePaid: opts?.pricePaid ?? null`, `notes: opts?.notes ?? priorRow.notes`. Strip `sortOrder` (WR-01 server-truth, mirrors editWatch).
  5. Call DAL `updateWatch(user.id, watchId, updatePayload)`.
  6. Fire `logActivity(user.id, 'watch_added', watchId, { brand, model, reference, source: 'wishlist_move' })` — adds a Network Activity feed entry (D-DEBT — the "moved to collection" semantic is communicated via the `source` field on the activity row, NOT a new `activity_type`; preserves backward compat with feed renderers).
  7. Fire overlap notifications via `findOverlapRecipients` + `logNotification('watch_overlap', ...)` for cross-user matches (matches `addWatch.ts:228-274` pattern).
  8. `revalidatePath('/')`, `revalidatePath('/u/[username]', 'layout')`, `revalidateTag(\`profile:\${username}\`, 'max')`, `revalidateTag('explore', 'max')` (matches `editWatch.ts:120-138`).
  9. Return `{ success: true, data: updatedWatch }`.

  Reason for new action vs. `editWatch({status:'owned'})`: confirmed at `src/app/actions/watches.ts:358-512` that `editWatch` does NOT emit `logActivity` or `logNotification`. A bare `editWatch` for this transition would silently skip the activity feed entry + overlap notifications, regressing the v6.0 social layer for wishlist-converters. **Planner discretion:** if there is shared logic with `addWatch.ts:228-296` notification block, extract a private helper (e.g. `fireWatchAddedSideEffects(watch, user)`); both addWatch and moveWishlistToCollection call it.

- **D-11 (DupeBanner placement when wishlist):** Renders ABOVE ConfirmStep. Phase 68 D-03 ConfirmStep contract is LOCKED — adding callbacks would break it. DupeBanner is a sibling presenter. ConfirmStep's `status` prop is set by AddWatchFlow to `'wishlist'` (matches DUPE-03 default + Phase 70 keeps the user's chosen status if they change it on the picker). The DupeBanner shows two affordances: "Move to Collection" (calls `moveWishlistToCollection(existingWatchId)`) and "Add another copy" (clears dupeContext per D-08). The user can ALSO ignore the banner, leave status at `wishlist`, click ConfirmStep's primary CTA, and the wishlist row will be... a second wishlist row bound to the same catalog row. That's a real edge — should it be blocked? **Decision: no block.** A user who deliberately ignores the banner and adds a second wishlist row is making an informed choice (same logic as DUPE-02 "Add another copy"). Phase 70 doesn't second-guess them. If UAT shows confusion, future polish adds an inline "You already have this on your wishlist — change to 'Owned' to move it, or click 'Add another copy' below" hint.

- **D-12 (CTA label when DupeBanner is mounted):** ConfirmStep's CTA label flows from its `status` prop (Phase 68 D-10): "Add to Wishlist" when status=wishlist, "Add to Collection" when owned, "Save as Grail" when grail. With DupeBanner mounted in wishlist context, the user clicks the DupeBanner's "Move to Collection" affordance to commit the UPDATE — the ConfirmStep primary CTA stays a (potentially confusing) "Add to Wishlist". **Planner discretion:** consider whether to visually de-emphasize ConfirmStep's primary CTA when DupeBanner is mounted (e.g. ghost styling instead of primary). For now, lock the behavior at "DupeBanner is the primary affordance when present; ConfirmStep CTA is secondary". UI-SPEC clarifies during planning.

- **D-13 (post-DUPE-03 navigation):** On `moveWishlistToCollection` success, route to `defaultDestinationForStatus('owned', viewerUsername)` = `/u/[username]/collection`. Show toast "Moved to collection" with "View" action targeting the same destination (suppression rules from Phase 28 D-05 / D-06 apply). Skip the photos-pending step — DUPE-03 is a status flip on an existing watch row, not a fresh add; the watch already had its "photos" moment (or didn't, on the original wishlist add). **Edge:** `initialReturnTo` continues to win over the default when set.

### URL-backup path (EXTR-07)

- **D-14 (inline mini-URL input, no PasteSection import):** Phase 71 deletes `PasteSection.tsx`; Phase 70 hard-cuts the import to honor Phase 71's `tests/static/AddWatchFlow.no-paste-section.test.ts` static guard ahead of time. When `onSwitchToUrl()` fires from StructuredEntryPanel (Phase 69 EXTR-07 escape hatch), AddWatchFlow transitions FlowState to `{ kind: 'extracting-url', url: '' }` — render branch mounts a small inline `<div>` with `<Input type="url" placeholder="Paste a watch URL" ... />` + `<Button>Find specs</Button>` + a "Back to search" ghost link. On submit, POST `/api/extract-watch` with `{ mode: 'url', url }` (Phase 66 D-08 mode-discriminated body — matches the existing call in `handleExtract` at AddWatchFlow.tsx:272-278, transplanted into Phase 70's new handler). On success, transition to `confirming` (with `catalogId` from the response, `extracted` from `data.data`, and a `findViewerWatchByCatalogId` lookup for `dupeContext`). On failure, transition to `extraction-failed` with `mode: 'url'`.

- **D-15 ("Back to search" affordance):** Always rendered in the `extracting-url` branch. Click handler: `setState({ kind: 'search-idle' })`. No history push; no router action. Mirrors the existing manual-entry "← Cancel — paste a URL instead" ghost link pattern at `AddWatchFlow.tsx:626-632`.

- **D-16 (URL-mode caching reuse):** `useUrlExtractCache(viewerUserId)` (Phase 69 D-08 retrofit) is still the cache surface — Phase 70's new URL-backup handler calls it identically to `AddWatchFlow.tsx:249-270` (cache hit short-circuits the network call; success persists `{catalogId, extracted, catalogIdError}`). The verdict-compute branch from the old `handleExtract` is REMOVED — verdict is out of scope.

### Photos-pending continuation + post-commit nav

- **D-17 (photos-pending gated on `status === 'owned'`):** v7.0 Phase 61 PHOTO-09 mounts WatchPhotoStep after every addWatch. For wishlist + grail status, the watch has no physical copy yet — photos-pending is semantically wrong. Phase 70 gates: only transition to `photos-pending` when the committed watch's `status === 'owned'`. Wishlist + grail commits skip directly to `defaultDestinationForStatus(status, viewerUsername)`. Form-prefill + manual-entry branches inherit the same gate (small regression on v7.0 manual-entry-wishlist path that DID show photos-pending — but inspecting `AddWatchFlow.tsx:485-487`, `handleWatchCreated` ALWAYS transitions to photos-pending today, regardless of status; that's the v7.0 behavior. Phase 70 changes it to gate on status — this is technically a v7.0 → v8.0 UX evolution worth calling out in UAT). **Planner discretion:** if the gate is too aggressive (user wanted to upload a future-looking photo for a wishlist watch), drop the gate and keep photos-pending universal. My default lean: gate it.

- **D-18 (post-commit destination matrix):**
  - **Fresh add (search-pick null / structured-input / URL-backup) — owned:** `confirming` → `photos-pending` → `defaultDestinationForStatus('owned', viewerUsername)` = `/u/[username]/collection` (or `initialReturnTo` when set).
  - **Fresh add — wishlist / grail:** `confirming` → `defaultDestinationForStatus(status, viewerUsername)` = `/u/[username]/wishlist` (or `initialReturnTo` when set). No photos step.
  - **DUPE-03 wishlist→owned (moveWishlistToCollection):** `defaultDestinationForStatus('owned', viewerUsername)` directly. No photos step (D-13).
  - **DUPE-01 search-pick owned:** `/w/${result.reference}` directly (D-05). No commit, no photos.
  - **DUPE-02 "Add another copy" → primary CTA:** same as Fresh add per the chosen status.
  - **Form-prefill (deep-link `?catalogId=X&intent=owned&prefill`):** unchanged from today — `handleWatchCreated` → `photos-pending` → destination. Status is locked to owned by WatchForm `lockedStatus`.
  - **Manual-entry (`?manual=1` or CLNP-06 skip-search link):** unchanged from today, EXCEPT D-17 photos-pending gate now applies. Wishlist+grail commits route direct.

### CLNP-06 — "Skip search — enter manually" link placement

- **D-19 (sibling-level under SearchEntry; in-flow transition; no `?manual=1` push):** The link renders as a small ghost button BELOW the SearchEntry component, inside the `search-idle` branch render. Visual: `<button className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground">Skip search — enter manually</button>`. Click handler: `setState({ kind: 'manual-entry', partial: null })`. NO router.push to `?manual=1` — the URL stays at `/watch/new` to differentiate "in-flow user skip" from "deep-link entry" (`?manual=1` semantic stays reserved for Wishlist empty-state CTA + Collection no-key fallback per Phase 25 D-09 / D-14 LITERAL).

- **D-20 (manual-entry "back to search" affordance):** When in `manual-entry`, render the existing back-affordance (`← Cancel — return to search`) wired to `setState({ kind: 'search-idle' })`. Replaces today's "← Cancel — paste a URL instead" label (URL paste isn't the primary path anymore). Preserves the same UX as today (in-flow escape from manual-entry).

### Default initial status (Phase 68 D-11 resolution)

- **D-21 (default `'wishlist'` when `?status=` is unset):** ConfirmStep is a controlled component; AddWatchFlow owns the status state. Initial value on FRESH `confirming` transitions: `initialStatus ?? 'wishlist'` where `initialStatus` is the threaded `'wishlist' | null` prop from `?status=` whitelist (Phase 25 D-05 already threads this). Matches `WatchForm.tsx:79` initialFormData. DUPE-03 wishlist context overrides → status defaults to `'wishlist'` anyway. DUPE-02 owned context → status defaults to `'owned'` (the user is reconsidering owning a second copy of something they already own; default to owned).

### Three-layer reset extension (Phase 29 / SC#5)

- **D-22 (Activity-hide cleanup updated for new FlowState kinds; module caches NOT cleared):** The existing `useLayoutEffect` cleanup at `AddWatchFlow.tsx:199-215` resets `state` to idle on Activity-hide (back-nav return). Phase 70 updates it:
  1. Skip case 1 (no user activity yet): `state.kind === 'search-idle' && url === '' && (no other accumulated state)`. Same intent; rename from `idle`.
  2. Skip case 2 (URL deep-link surviving state): `state.kind === 'form-prefill'` — unchanged.
  3. Skip case 3 (NEW): `state.kind === 'manual-entry' && partial === null` AND `initialManual === true` AND `initialStatus !== null` — manual-entry-from-deep-link surviving state (preserves the existing Wishlist empty-state CTA round-trip; without this, StrictMode's mount/cleanup/mount cycle would clobber the manual-entry default-status). **Planner verifies during planning:** confirm that `initialManual=true` page-load skip-case is needed by re-running the Phase 29 Plan 06 / FORM-04 D-14 StrictMode reasoning. If `manual-entry` is a STATE-LEVEL reset only and not derived from initialState, this guard is unnecessary.
  4. Reset case (otherwise): `setState({ kind: 'search-idle' })` (renamed from `idle`), `setUrl('')`, `setRail([])` (rail still removed; CLNP-04 leaves the component unrendered; this stays for safety).

  **Module-scope caches are intentionally NOT cleared in this effect** — Phase 69 CLNP-07 handles cross-user clearing via the in-render `viewerUserId` mismatch check at the top of each cache hook. Same-user remount cache survival is the WHOLE POINT of the module-scope pattern (cache-hit performance on URL re-paste / structured re-submit / catalog re-search). SC#5 wording "the Phase 29 three-layer reset is extended to the new caches" is satisfied by CLNP-07's shared `lastUserId` reset — confirmed Phase 69 already shipped this. No Phase 70 module-cache reset needed beyond confirming the new FlowState kinds don't trap state in the cleanup's sentinel checks.

### Claude's Discretion

- **`DupeBanner.tsx` styling:** muted-fill rounded card (border + `bg-muted/40` or similar shadcn token) above ConfirmStep with explicit hierarchy: short headline ("Already in your collection" / "On your wishlist"), 1-line subtext, action row. Use `cn(...)` + shadcn `<Button>` variants. Match Phase 65 FollowedOwnersModule's compact-card visual vocabulary (small, contextual, not screen-dominating). Avoid `font-medium` raw class — use `font-semibold` per `project_phase_68_complete` memory + no-raw-palette guardrail.
- **`moveWishlistToCollection` Zod schema:** `z.object({ watchId: z.string().uuid(), pricePaid: z.number().int().min(0).optional(), notes: z.string().max(2000).optional() })`. Matches the existing `addWatch` schema bounds (watches.ts `insertWatchSchema`). Watch ID validation is the IDOR guard (DAL ownership check is the second layer per D-10).
- **DupeBanner "View existing" route:** `/w/${existingReference}` when `existingReference` is non-null; hide the button when null (fall back to "Already owned — Add another copy or Start over" copy).
- **Test layering:**
  - `flowTypes.test.ts` (NEW) — exhaustive `kind` enumeration + serialization round-trip; matches CLNP-05 final shape; assertion test that the deleted variants no longer compile (Phase 71 finishes the static guards).
  - `AddWatchFlow.test.tsx` (RETROFIT — existing four-cache integration test from Phase 69 Plan 06 stays; ADD new tests for FlowState transitions covering search-pick branches, DUPE-01/02/03 paths, URL-backup, CLNP-06 link, photos-pending gate). Mock SearchEntry + ConfirmStep + StructuredEntryPanel + WatchPhotoStep + DupeBanner — test the orchestrator's transition logic, not the children (Phase 68/69 already tested those).
  - `DupeBanner.test.tsx` (NEW) — co-located; 4-5 cases (owned context + wishlist context + null reference + callbacks fire).
  - `moveWishlistToCollection.test.ts` (NEW) — co-located in `src/app/actions/__tests__/`; 6 cases (auth gate; wishlist→owned happy path; idempotent already-owned; sold/grail rejection; not-yours rejection; side-effect chain fires `logActivity` + overlap notifications).
- **CLNP-06 link copy:** "Skip search — enter manually" verbatim from REQUIREMENTS CLNP-06.
- **`AddWatchFlow.tsx` LOC reduction:** the old file is ~764 LOC with the verdict/wishlist-rationale plumbing. Phase 70's rewrite removes ~250–300 LOC of verdict-flow logic; gains ~100 LOC of new handler + DupeBanner branch + extracting-url branch. Net smaller file. Planner uses this as a sanity check during plan-phase: if the rewrite gains rather than loses LOC, scope creep likely.
- **`dupeContext` resolution timing:** Phase 70's `handleStructuredSubmit` and URL-backup success handler call `findViewerWatchByCatalogId(viewerUserId, catalogId, ['owned','wishlist'])` BEFORE transitioning to `confirming`. The lookup is a single anti-N+1 query (DAL helper from Phase 67). Surface the result as `dupeContext: { existingWatchId, existingStatus, existingReference }` or `null`. The catalog row's reference for `existingReference` is already in the response shape (catalog upsert returns the existing row); planner verifies the helper's return type or extends it to include the catalog's reference (small).
- **`existingReference` source:** the catalog DAL has the reference; the dupe context surfaces it for DupeBanner's "View existing" `/w/[ref]` link. Planner picks: extend `findViewerWatchByCatalogId` to also return the joined catalog reference, OR fetch separately. The latter is fine — catalog row is already fetched at the addWatch upsert layer; pass through.
- **Telemetry / observability:** add a single `console.warn` line per DUPE-02 surface ("[Phase 70] dupeContext: owned existing → confirm-with-banner") and DUPE-03 surface ("[Phase 70] dupeContext: wishlist existing → move-to-collection affordance"). Cheap operator visibility for the first prod sessions; can remove if noisy.
- **No `useTransition` for moveWishlistToCollection / DupeBanner actions:** matches `addWatch` pattern in current `AddWatchFlow.tsx` (plain async). The orchestrator sets `confirming.pending = true` before the await and `false` after — drives the disabled CTA + spinner UI via ConfirmStep's `pending` prop. Planner confirms this matches Phase 68's pending UX.

### Folded Todos
None — no pending todos matched Phase 70 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 70: AddWatchFlow State Machine Rewrite + DUPE Wiring" — phase goal, depends-on (66/67/68/69), 5 success criteria
- `.planning/ROADMAP.md` §"Phase 71: Dead Code Cleanup + Static Guards" — read for the downstream contract Phase 70 must enable (deletions + static guards reference the union shape Phase 70 ships)
- `.planning/REQUIREMENTS.md` §"Existing-in-Collection Handling (DUPE)" items DUPE-01, DUPE-02, DUPE-03 — full text + traceability (DAL part in Phase 67; UI in Phase 70)
- `.planning/REQUIREMENTS.md` §"Legacy Path Cleanup (CLNP)" items CLNP-05, CLNP-06 — FlowState union cleanup + Skip-search link
- `.planning/REQUIREMENTS.md` §"Traceability" notes-on-split — DUPE-01/03 DAL part lives in Phase 67; DUPE-02 has no DAL part (pure UI bypass)
- `.planning/seeds/SEED-010-v5.3-add-watch-redesign.md` — milestone rationale; confirm-screen replaces VerdictStep, status incl. grail, URL demoted, manual fallback retained
- `.planning/PROJECT.md` §"Current Milestone: v8.0 Add-Watch Redesign" — Goal, target features, "Verdict deliberately out of scope" lock, "no changes to /w/[ref]" lock, status reset hygiene carry-forward

### Cross-phase coordination
- `.planning/phases/66-api-route-extension/66-CONTEXT.md` — Phase 66 mode-discriminated route (D-08); the URL-backup path's body shape `{ mode: 'url', url }` consumes the locked contract; structured-input path response carries `mode: 'structured'` consumed by ExtractErrorCard (Phase 69)
- `.planning/phases/67-server-action-dal-extensions/67-CONTEXT.md` — Phase 67 SHIPPED `findViewerWatchByCatalogId(userId, catalogId, ['owned','wishlist'])` (D-06/D-07/D-08); `addWatch` `catalogId` branch (D-09/D-10/D-11); D-09's free-text error string contract; deferred "Move to Collection" UPDATE-not-INSERT to this phase
- `.planning/phases/68-confirmstep-component/68-CONTEXT.md` — Phase 68 ConfirmStep prop contract is **LOCKED** (D-03). DupeBanner is a sibling because adding callbacks to ConfirmStep is contract-breaking. D-11 deferred `initialStatus` default to this phase (recommend 'wishlist').
- `.planning/phases/69-searchentry-structuredentrypanel-cache-hygiene/69-CONTEXT.md` — Phase 69 SHIPPED SearchEntry `onPick(result)` + `onSubmitStructured(extracted)` + `onSwitchToUrl()` (D-03 / D-11); StructuredEntryPanel is mounted inside SearchEntry, not at orchestrator level; `useCatalogSearchCache` + `useStructuredExtractCache` ship with `viewerUserId` reset (CLNP-07); ExtractErrorCard `mode` prop wired (D-06)
- **Phase 71** — depends_on Phase 70; deletes `VerdictStep` + `WishlistRationalePanel` + `PasteSection` files + their tests; adds two static guards (`no-verdict-step`, `no-collection-fit-card`); resolves `RecentlyEvaluatedRail` disposition. Phase 70 must NOT import any of the soon-to-be-deleted files (hard cutover) so Phase 71 lands clean.

### Components being orchestrated (already shipped, dormant — Phase 70 mounts)
- `src/components/watch/SearchEntry.tsx` — Phase 69 dormant; mounted in `search-idle` branch. Props: `viewerUserId`, `catalogBrands`, `onPick(result)`, `onSubmitStructured(extracted)`, `onSwitchToUrl()`. Owns query/results/structured-panel internals.
- `src/components/watch/ConfirmStep.tsx` — Phase 68 dormant; mounted in `confirming` branch. Phase 68 D-03 PROPS LOCKED — Phase 70 wires against them as-is.
- `src/components/watch/StructuredEntryPanel.tsx` — Phase 69 dormant; mounted INSIDE SearchEntry. Phase 70 does NOT mount it directly.
- `src/components/watch/ExtractErrorCard.tsx` — extant + Phase 69 D-06 `mode` prop branch; mounted in `extraction-failed` branch.
- `src/components/watch/WatchPhotoStep.tsx` — Phase 61 PHOTO-09; mounted in `photos-pending` branch when `status === 'owned'` (D-17 gate).
- `src/components/watch/WatchForm.tsx` — extant; mounted in `form-prefill` + `manual-entry` branches; `onWatchCreated(watchId, dest)` intercept fires `setState({kind:'photos-pending', ...})` per D-17 gate.

### Components being orchestrated (NEW — Phase 70 ships)
- `src/components/watch/DupeBanner.tsx` (NEW) — sibling presenter mounted ABOVE ConfirmStep in `confirming` branch when `dupeContext` is set. Props per D-11 / D-08.
- `src/components/watch/DupeBanner.test.tsx` (NEW) — co-located 4-5 cases.

### Files being rewritten
- `src/components/watch/flowTypes.ts` — old FlowState union replaced with the D-01 shape; `DupeContext` interface added; obsolete `RailEntry` + `PendingTarget` cleanup deferred to Phase 71 CLNP-04 (rail disposition).
- `src/components/watch/AddWatchFlow.tsx` — full rewrite; net LOC reduction expected; imports change (NO `PasteSection` / `VerdictStep` / `WishlistRationalePanel`); handlers replaced per D-02 transition map.

### Server Actions + DAL surface
- `src/data/watches.ts:295-322` — `findViewerWatchByCatalogId(userId, catalogId, statuses)` (Phase 67 — returns `{id, status} | null` with owned-wins). Phase 70 calls with `['owned','wishlist']`; planner extends to also return joined catalog `reference` for DupeBanner's "View existing" link.
- `src/app/actions/watches.ts:82-355` — `addWatch` (Phase 67-extended catalogId branch). Primary CTA on `confirming` calls this; client-supplied brand/model/reference are SERVER-OVERRIDDEN with catalog row values per Phase 67 D-10 — confirmed expected.
- `src/app/actions/watches.ts:358-512` — `editWatch` (existing; does NOT fire `logActivity` or `logNotification`). Confirmed gap — moveWishlistToCollection cannot just delegate to editWatch (D-10).
- `src/app/actions/watches.ts` NEW export `moveWishlistToCollection` (D-10) — new Server Action lands here.
- `src/app/actions/__tests__/watches.test.ts` — Phase 67 tests for `addWatch` catalogId branch; Phase 70 adds `moveWishlistToCollection` tests (6 cases per Claude's discretion).
- `src/app/actions/search.ts:158` — `searchCatalogForAddFlow` (Phase 67-shipped); SearchEntry consumes; orchestrator doesn't call directly.
- `src/data/activities.ts` — `logActivity` import for moveWishlistToCollection.
- `src/lib/notifications/logger.ts` — `logNotification` import for moveWishlistToCollection.
- `src/data/notifications.ts` — `findOverlapRecipients` for moveWishlistToCollection (matches addWatch pattern).
- `src/lib/actionTypes.ts` — `ActionResult<T>` envelope.

### Plumbing + page wiring
- `src/app/watch/new/page.tsx:117-138` — Server Component already passes everything Phase 70 needs (viewerUserId, viewerUsername, catalogBrands, initialReturnTo, initialStatus, initialManual, initialCatalogPrefill, collectionRevision). Minimal touch — possibly zero edits.
- `src/lib/watchFlow/destinations.ts` — `defaultDestinationForStatus(status, username)` + `canonicalize` + `validateReturnTo` (Phase 28). Post-commit nav, toast suppression, returnTo validation. Phase 70 calls them in every commit branch.

### Existing patterns being mirrored
- `src/components/watch/AddWatchFlow.tsx:199-215` — Activity-hide `useLayoutEffect` cleanup; D-22 extends sentinel checks for new FlowState kinds; module-scope caches intentionally NOT cleared
- `src/components/watch/AddWatchFlow.tsx:225-361` (`handleExtract`) — URL-extract round-trip pattern (cache check → POST → success branch → cache set); Phase 70 extracts this into a new `handleUrlBackup` for the `extracting-url` branch (sans the verdict-compute branch — verdict is out of scope)
- `src/components/watch/AddWatchFlow.tsx:485-487` (`handleWatchCreated`) — Phase 61 photos-pending intercept; Phase 70 gates on `status === 'owned'` per D-17
- `src/components/watch/AddWatchFlow.tsx:498-501` (`handleStartOver`) — preserved verbatim for `confirming.onStartOver` and `extracting-url` "Back to search"
- `src/components/watch/AddWatchFlow.tsx:509-520` (`retryAction` / `manualAction`) — preserved for `extraction-failed` recovery; `manualAction` still pushes `?manual=1&returnTo=...` per Phase 28 D-12
- `src/components/watch/AddWatchFlow.tsx:626-632` — manual-entry back-affordance pattern; D-20 reuses with "← Cancel — return to search" label

### Auth + signOut surface (unchanged)
- `src/lib/auth.ts` — `getCurrentUser`; `moveWishlistToCollection` and any new code paths use the same auth-first gate (AUTH-04 / D-14)
- `src/app/actions/auth.ts` — `logout()` Server Action; no changes; CLNP-07 cache reset chain via `viewerUserId` already wired Phase 69

### Constants + types
- `src/lib/searchTypes.ts` — `SearchCatalogWatchResult` (D-05 reference field)
- `src/lib/extractors/types.ts` — `ExtractedWatchData` (the `onSubmitStructured(result)` + URL-backup success payload type)
- `src/lib/types.ts` — `WatchStatus` union (Phase 70 uses the 3-element `'owned' | 'wishlist' | 'grail'` subset on ConfirmStep + DupeBanner)
- `src/components/watch/ExtractErrorCard.tsx` — `ExtractErrorCategory` (re-exported for flowTypes)

### Memories that constrain this phase
- `project_phase_68_complete` — radiogroup pattern + `font-semibold` (NOT `font-medium`) guardrail recurrence. DupeBanner uses `font-semibold`.
- `project_router_cache_stale_instance` — for any one-shot transition affordance (DupeBanner's "Move to Collection" / "Add another copy" buttons), use `onPointerDown` if testing reveals stale-instance behavior; default to `onClick`.
- `project_baseline_not_green_build_is_gate` — `npm run build` exit 0 is THE gate. Plan adjusts expectations on full tsc / npm test baseline noise.
- `feedback_mobile_ui_verify_on_prod` — Phase 70 is UI-heavy; user verifies on prod after push. Bundle with Phase 71 if possible (single push covers both).
- `feedback_ppr_cache_fill_no_longer_call_out` — DO NOT bake #419 / soft-nav into UAT (the family is resolved infrastructure).
- `feedback_decision_coverage_gate_citations` — plan-phase D-NN gate scans frontmatter/designated headings; cite D-NN identifiers in `truths` to clear false-negative BLOCKs.
- `feedback_execute_phase_no_worktree_when_db` — `workflow.use_worktrees=false` is already permanent globally; Phase 70 inherits.
- `project_local_catalog_natural_key_drift` — irrelevant directly (Phase 70 doesn't write catalog rows), but planner aware if local-DB UAT surfaces catalog upsert failures (could be the constraint drift, not Phase 70 code).

### Phase 71 forward-coordination (write this code knowing Phase 71 follows)
- Phase 70 ends with `AddWatchFlow.tsx` NOT importing `PasteSection`, `VerdictStep`, `WishlistRationalePanel`, `RecentlyEvaluatedRail`, or `CollectionFitCard`. Phase 71 static guards lock the absence.
- `flowTypes.ts`'s final union per D-01 is what Phase 71's CLNP-05 audit asserts against — NOT the ROADMAP's draft enumeration. Phase 71 plan reads THIS CONTEXT to know the authoritative final shape.
- `flowTypes.ts`'s `RailEntry` and `PendingTarget` exports stay in Phase 70 (deletes happen in Phase 71 alongside `RecentlyEvaluatedRail` disposition).
- `VerdictStep.test.tsx` + `WishlistRationalePanel.test.tsx` + `PasteSection.test.tsx` continue to exist + pass through Phase 70 (Phase 71 deletes the files + their tests). Phase 70's build remains green throughout.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SearchEntry` + `ConfirmStep` + `StructuredEntryPanel` + `ExtractErrorCard` + `WatchPhotoStep`** — all shipped dormant; Phase 70 mounts and wires them
- **`findViewerWatchByCatalogId`** (Phase 67) — anti-N+1 dupe lookup; called from `handleStructuredSubmit` + `handleUrlBackup` success branches
- **`addWatch` with `catalogId`** (Phase 67) — primary CTA dispatch on `confirming`
- **`/api/extract-watch?mode=url`** (Phase 66) — `extracting-url` branch fetches this
- **`useUrlExtractCache(viewerUserId)`** (Phase 69 retrofit) — `extracting-url` branch reuses cache hit pattern
- **`useCatalogSearchCache` + `useStructuredExtractCache`** (Phase 69) — orchestrator does NOT consume directly (SearchEntry + StructuredEntryPanel own them); referenced only by Phase 70's awareness of CLNP-07
- **`useWatchSearchVerdictCache`** — Phase 70 STOPS consuming (no verdict compute in v8.0); cache hook stays in the codebase (still consumed by `/search` page's `WatchSearchRowsAccordion`); Phase 70 just drops the import from AddWatchFlow.tsx
- **`defaultDestinationForStatus`, `canonicalize`, `validateReturnTo`** (Phase 28) — post-commit nav matrix unchanged
- **`Loader2` + shadcn `<Button>` + `<Input>`** — DupeBanner + extracting-url inline input

### Established Patterns
- **Pure-presenter family** (`SearchEntry`, `StructuredEntryPanel`, `ConfirmStep`, `ExtractErrorCard`, `WatchPhotoStep`) — props in, callbacks out, no Server Action call, no router. DupeBanner extends. Orchestrator owns dispatch.
- **Auth-first gate in Server Actions** (Phase 25 / AUTH-04 / D-14) — `moveWishlistToCollection` follows the same `try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }` order BEFORE Zod parse.
- **In-render module-cache reset on `viewerUserId` mismatch** (Phase 69 D-06) — Phase 70 doesn't add new cache hooks; existing reset covers cross-user. Same-user Activity-hide reset is local state only.
- **`logActivity` + `logNotification` side-effect chain** (Phase 67 / addWatch) — `moveWishlistToCollection` fires identical chain; planner extracts shared helper if duplication is awkward.
- **Photos-pending intercept via `onWatchCreated`** (Phase 61) — WatchForm calls `onWatchCreated(watchId, dest)` instead of `router.push(dest)` when the prop is present. Phase 70 reuses for form-prefill + manual-entry. New search-first + structured-input + URL-backup paths set photos-pending via the orchestrator's own commit handler, gated on D-17 status.
- **Mobile-first stacked → desktop side-by-side button row** (`VerdictStep.tsx:102`) — DupeBanner's action row mirrors: `flex flex-col gap-2 sm:flex-row sm:gap-3`.
- **`aria-live="polite"` wrapper on add-flow steps** — DupeBanner inherits for the affordance text changes.
- **Stable callbacks via `useCallback`** (Phase 25 Plan 04 / T-25-04-04) — Phase 70's orchestrator handlers wrap with `useCallback` when threaded into multiple children to prevent identity churn / effect-loops downstream.

### Integration Points
- **`/watch/new/page.tsx`** — minimal/zero edits; Phase 69 already shipped all required SSR props
- **`AddWatchFlow.tsx`** — full rewrite; net LOC reduction expected; imports change per D-01
- **`flowTypes.ts`** — full union rewrite per D-01; `DupeContext` interface added
- **`src/app/actions/watches.ts`** — new export `moveWishlistToCollection`; existing `addWatch` + `editWatch` unchanged
- **`SearchEntry.tsx`** — orchestrator threads `onPick` / `onSubmitStructured` / `onSwitchToUrl`; Phase 69 contract honored
- **`ConfirmStep.tsx`** — orchestrator threads all 12 props per Phase 68 D-03; sibling DupeBanner above when dupeContext set
- **`WatchPhotoStep.tsx`** — Phase 61 contract honored; mounted on `photos-pending` per D-17 gate
- **`/search` page (`WatchSearchRowsAccordion.tsx:47`)** — unchanged; Phase 69 D-08 retrofit already shipped the `useWatchSearchVerdictCache(collectionRevision, viewerUserId)` signature
- **`/u/[username]/wishlist` + `/u/[username]/collection`** — post-commit nav targets; unchanged
- **`/w/[ref]`** — DUPE-01 redirect target + DupeBanner "View existing" link target; NO file edits per PROJECT.md milestone lock

</code_context>

<specifics>
## Specific Ideas

- **Hard cutover stance for legacy files** — Phase 70 ENDS with `AddWatchFlow.tsx` not importing `PasteSection`, `VerdictStep`, `WishlistRationalePanel`. The files still exist (Phase 71 deletes), but they're orphaned at end-of-phase. Mirrors the operator's v7.0 ROUTE-03 Variant C hard-cutover muscle memory: subtraction lands clean, in one direction, with no transitional fork.
- **`/w/[ref]` is the v7.0 unified route, ref-keyed** — DUPE-01 redirect and DupeBanner "View existing" both consume this. PROJECT.md prohibits Phase 70 edits to that route. The reference comes from `SearchCatalogWatchResult.reference` (search-pick) or the catalog row joined through `findViewerWatchByCatalogId` (URL-backup / structured-input).
- **DUPE-02 + DUPE-03 are mutually exclusive within a single `confirming` render** — `dupeContext.existingStatus` is one of `'owned'` / `'wishlist'`, not both. The user can change status on the picker (e.g. open in DUPE-03 wishlist context, change to "Owned" — but the existing watch is still wishlist; primary CTA + DupeBanner "Move to Collection" both make sense). Locks the state-machine simplicity.
- **`moveWishlistToCollection` is a status-flip, not a re-add** — UPDATE on the existing `watches` row, NOT INSERT. The activity log entry uses `activity_type: 'watch_added'` with a `source: 'wishlist_move'` metadata field to differentiate in the feed renderer (no new activity_type — backward compat with feed UI).
- **CLNP-06 link does NOT push `?manual=1`** — preserves the URL semantic for entry-point deep-links. In-flow user choice stays in-flow.
- **D-17 photos-pending gate is the only v7.0 → v8.0 UX regression worth calling out in UAT** — manual-entry-wishlist no longer mounts WatchPhotoStep. Acceptable (wishlist watches have no physical copy to photograph) but verify with user during prod UAT.
- **`useCallback` discipline for handlers threaded into SearchEntry / ConfirmStep / DupeBanner** — props identity stability matters for downstream effect deps. Mirrors the Phase 25 T-25-04-04 mitigation pattern. Planner spots which handlers benefit.
- **`StructuredEntryPanel`'s internal `useStructuredExtractCache`** — Phase 70 doesn't think about it. The panel's `onSubmitStructured` callback fires after the cache + LLM round-trip resolves; orchestrator just receives the result.
- **`onSubmitStructured` payload** — `ExtractedWatchData`. Phase 70 must extract `catalogId` separately. Either: (a) Phase 69 amends StructuredEntryPanel's emit to bundle `{extracted, catalogId}` (small contract change), OR (b) Phase 70 re-extracts catalogId from a side-channel (re-query catalog by (brand,model,reference) — expensive), OR (c) Phase 69 already bundles catalogId — VERIFY at plan time. Most likely Phase 69 D-11 + D-18 already capture catalogId in the cache value; if `onSubmitStructured` only emits `ExtractedWatchData`, planner upgrades the contract to `(extracted, catalogId)` as a Phase 69 follow-up patch. **Planner verifies first.** If Phase 69's emit doesn't include catalogId, this is a real coordination gap that Phase 70 closes by amending StructuredEntryPanel (cheap, single-line). Note this for plan-phase research.

</specifics>

<deferred>
## Deferred Ideas

- **`/w/[ref]` "+ Add another copy" button** — would close DUPE-02 for the search-pick owned path too (instead of requiring URL/structured re-entry). PROJECT.md prohibits `/w/[ref]` edits in v8.0; v9.0 / v10 polish.
- **`?status=` URL param plumbing for non-wishlist defaults** — Phase 25 D-05 whitelists only `'wishlist'`. If a future feature wants `?status=owned` or `?status=grail` for deep-links into ConfirmStep with a non-default status, extend the whitelist. Not needed for Phase 70.
- **Typed error code from `addWatch` and `moveWishlistToCollection`** — Phase 67 D-09 deferred `'CATALOG_NOT_FOUND'` typing. Phase 70 also returns free-text errors. Future ActionResult shape extension.
- **Cross-action shared helper `fireWatchAddedSideEffects(watch, user)`** — planner's discretion in D-10. Extract if `addWatch` lines 228-296 share enough with `moveWishlistToCollection`'s post-update block.
- **DupeBanner CTA emphasis swap** — D-12 leaves ConfirmStep's primary CTA visually unchanged when DupeBanner is mounted. If UAT shows confusion (user clicks "Add to Wishlist" CTA when they meant "Move to Collection" banner), Phase 70 polish task or a future phase swaps emphasis. Defer until UAT signal.
- **Phase 71 follow-ups carried forward from this phase:**
  - Delete `VerdictStep.tsx` + `VerdictStep.test.tsx`
  - Delete `WishlistRationalePanel.tsx` + `WishlistRationalePanel.test.tsx`
  - Delete `PasteSection.tsx` + `PasteSection.test.tsx`
  - Decide `RecentlyEvaluatedRail` disposition (CLNP-04) — likely delete since Phase 70 stops rendering it
  - Add `tests/static/AddWatchFlow.no-verdict-step.test.ts` (`// @vitest-environment node`)
  - Add `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` (`// @vitest-environment node`)
  - Audit `flowTypes.ts` for orphaned `RailEntry` + `PendingTarget` exports
  - Audit `WatchForm.tsx` for any verdict-rationale references (likely none)
- **Optimistic UI for DUPE-03 status change** — `moveWishlistToCollection` is a single round-trip; could optimistic-update the local UI (move from wishlist to collection) before the server confirms. Defer — current addWatch flow doesn't do this either; consistency wins for v8.0.
- **DUPE-02 "Add another copy" telemetry threshold** — observability + a future polish on the dupe banner if data shows users misuse "Add another copy" frequently. Defer until prod sessions yield data.
- **Photos-pending universal mode for wishlist/grail** — D-17 gates on owned. If UAT shows users want to upload "what I want it to look like" photos for wishlist watches, drop the gate. Defer until UAT signal.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 70 scope.

</deferred>

---

*Phase: 70-addwatchflow-state-machine-rewrite-dupe-wiring*
*Context gathered: 2026-05-29*

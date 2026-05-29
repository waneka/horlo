# Phase 70: AddWatchFlow State Machine Rewrite + DUPE Wiring - Research

**Researched:** 2026-05-29
**Domain:** React state machine orchestration, Server Action extension, discriminated-union rewrite
**Confidence:** HIGH — all findings are verified directly from codebase (no external searches needed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: FlowState final union collapses ROADMAP's four-new-states into one `search-idle`; SearchEntry owns internals
- D-02: Transition map comment block ships verbatim in flowTypes.ts
- D-03: `?manual=1` priority preserved — form-prefill > manual-entry > search-idle precedence unchanged
- D-04: `?returnTo=` round-trip preserved; validateReturnTo gating stays at page.tsx
- D-05: DUPE-01 routes to `/w/${result.reference}` directly (no watchId lookup)
- D-06: Null-reference fallback → confirming with owned-banner (planner discretion on per-watchId route)
- D-07: DUPE-02 only in confirming when dupeContext.existingStatus === 'owned'; not on search-pick owned (that's DUPE-01 redirect)
- D-08: "Add another copy" clears dupeContext; calls primary addWatch — NO second catalog row
- D-09: No `/w/[ref]` modification; PROJECT.md milestone lock absolute
- D-10: New Server Action `moveWishlistToCollection(watchId, opts?)` — confirmed gap in editWatch
- D-11: DupeBanner sibling above ConfirmStep; ConfirmStep D-03 contract LOCKED
- D-12: ConfirmStep primary CTA stays its own label; DupeBanner is primary affordance when present (planner discretion: ghost styling)
- D-13: DUPE-03 nav → defaultDestinationForStatus('owned', viewerUsername); no photos step
- D-14: inline mini-URL input in extracting-url; no PasteSection import
- D-15: "Back to search" in extracting-url → setState({kind:'search-idle'})
- D-16: useUrlExtractCache reused identically; verdict-compute branch removed
- D-17: photos-pending gated on status === 'owned' (v7.0 → v8.0 UX evolution)
- D-18: Full destination matrix defined
- D-19: CLNP-06 skip-search link below SearchEntry; setState({kind:'manual-entry'}); NO router.push ?manual=1
- D-20: manual-entry back affordance → setState({kind:'search-idle'}); label "← Cancel — return to search"
- D-21: default status 'wishlist' on fresh confirming; initialStatus ?? 'wishlist'
- D-22: useLayoutEffect cleanup extended for new FlowState kinds; module caches NOT cleared

### Claude's Discretion
- DupeBanner.tsx styling: muted-fill rounded card; font-semibold; match Phase 65 FollowedOwnersModule vocabulary
- moveWishlistToCollection Zod schema: z.object({ watchId: z.string().uuid(), pricePaid: z.number().int().min(0).optional(), notes: z.string().max(2000).optional() })
- DupeBanner "View existing" route: /w/${existingReference} when non-null; hide when null
- Test layering: flowTypes.test.ts (NEW), AddWatchFlow.test.tsx (RETROFIT), DupeBanner.test.tsx (NEW), moveWishlistToCollection.test.ts (NEW)
- CLNP-06 link copy: "Skip search — enter manually" verbatim
- No useTransition for moveWishlistToCollection / DupeBanner actions
- DupeBanner pending: confirming.pending = true before await, false after
- `existingReference` source: extend findViewerWatchByCatalogId OR fetch separately
- Extract fireWatchAddedSideEffects helper if addWatch:228-296 shares enough with moveWishlistToCollection

### Deferred Ideas (OUT OF SCOPE)
- /w/[ref] "+ Add another copy" button
- ?status=owned or ?status=grail deep-links
- Typed error codes from addWatch / moveWishlistToCollection
- Cross-action shared helper fireWatchAddedSideEffects (planner discretion)
- DupeBanner CTA emphasis swap (defer until UAT signal)
- Phase 71 cleanups (delete VerdictStep/WishlistRationalePanel/PasteSection, static guards, RecentlyEvaluatedRail disposition, RailEntry/PendingTarget orphan cleanup)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DUPE-01 (UI part) | Owned search-pick → router.push to /w/[result.reference] | SearchCatalogWatchResult.reference verified at searchTypes.ts:39; route pattern confirmed |
| DUPE-02 | "Add another copy" affordance in confirming when dupeContext.existingStatus === 'owned' | No UNIQUE(userId,catalogId) constraint on watches — VERIFIED (schema.ts:165-172 only has index, not unique) |
| DUPE-03 (UI part) | Wishlist search-pick → confirming with DupeBanner "Move to Collection" affordance + new moveWishlistToCollection action | editWatch at watches.ts:358-512 confirmed: does NOT fire logActivity or logNotification |
| CLNP-05 | FlowState union rewrite — old verdict-flow variants removed, new search-flow variants added | flowTypes.ts:17-35 verified; current union has idle/extracting/verdict-ready/wishlist-rationale-open/submitting-wishlist/submitting-collection/form-prefill/manual-entry/extraction-failed/photos-pending |
| CLNP-06 | "Skip search — enter manually" link in search-idle branch; in-flow transition to manual-entry | AddWatchFlow.tsx:626-632 pattern verified for back-affordance shape |
</phase_requirements>

---

## Summary

Phase 70 rewrites `AddWatchFlow.tsx` and `flowTypes.ts` as an orchestrator that mounts the dormant Phase 68/69 primitives (ConfirmStep, SearchEntry, StructuredEntryPanel, ExtractErrorCard) and introduces a new DupeBanner component plus a new `moveWishlistToCollection` Server Action. The research confirms all key "Planner verifies" items from CONTEXT.md with exact file:line citations.

The most critical finding is the `onSubmitStructured` emit gap: StructuredEntryPanel's callback signature at `StructuredEntryPanel.tsx:60` is `onSubmitStructured: (result: ExtractedWatchData) => void` — it does NOT emit catalogId. However, StructuredEntryPanel DOES store catalogId internally in its cache (`StructuredEntryPanel.tsx:151-155`) and the network response carries `envelope.catalogId`. Phase 70 must either (a) patch StructuredEntryPanel's emit to `(result: ExtractedWatchData, catalogId: string | null) => void`, or (b) use a side-channel. Option (a) is a single-line contract change to a dormant component — the planner should plan this as a Wave 0 patch to StructuredEntryPanel.

The `findViewerWatchByCatalogId` return type is `{ id: string; status: 'owned' | 'wishlist' } | null` — it does NOT join the catalog reference. Phase 70 must extend this DAL helper to also return `reference: string | null` for DupeBanner's "View existing" link.

No UNIQUE (userId, catalogId) constraint exists on the `watches` table — DUPE-02 "Add another copy" semantics are safe; two rows for the same user and catalogId are structurally permitted.

**Primary recommendation:** Start with Wave 0 patches (StructuredEntryPanel emit + findViewerWatchByCatalogId return shape), then rewrite flowTypes.ts, then AddWatchFlow.tsx, then add moveWishlistToCollection, then DupeBanner, then tests.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| FlowState machine + transitions | Client (AddWatchFlow) | — | AddWatchFlow is a client component; all state is local |
| DUPE lookup (findViewerWatchByCatalogId) | API/Backend DAL | — | DB query, server-only; called from handlers before transitioning |
| moveWishlistToCollection | API/Backend Server Action | — | Session auth, DB write, revalidation |
| DupeBanner render | Browser/Client | — | Pure presenter; no server calls |
| ConfirmStep render | Browser/Client | — | Phase 68 pure presenter, locked contract |
| SearchEntry render + catalog typeahead | Browser/Client | — | Phase 69; owns search/results/panel sub-state |
| Post-commit navigation | Browser/Client | — | router.push from orchestrator handlers |
| photos-pending step | Browser/Client | — | WatchPhotoStep (Phase 61) pure presenter |
| returnTo validation | Frontend Server (SSR) | — | validateReturnTo called in page.tsx before prop drill |

---

## Standard Stack

No new external libraries. Phase 70 uses the project's existing stack:

| Library | Version | Purpose | Usage in Phase 70 |
|---------|---------|---------|-------------------|
| React | 19.2.4 | UI + hooks | useCallback, useState, useLayoutEffect, useRef |
| Next.js | 16.2.3 | Router, Server Actions | useRouter, 'use server' actions |
| Zod | (in project) | Input validation | moveWishlistToCollection schema |
| Sonner | (in project) | Toast notifications | toast.success / toast.error on commit |
| Tailwind CSS 4 | ^4 | Styling | DupeBanner layout |
| shadcn Button | ^4.2.0 | UI primitives | DupeBanner CTAs |
| lucide-react | ^1.8.0 | Icons | Loader2 in extracting-url inline input |

---

## Verified Answers to "Planner verifies" / "Planner discretion" Markers

### D-08: UNIQUE (userId, catalogId) constraint on `watches`?

**VERIFIED: NO such constraint exists.** [VERIFIED: src/db/schema.ts:165-172]

```typescript
// schema.ts:165-172 — the watches table indexes only:
(table) => [
  index('watches_user_id_idx').on(table.userId),
  index('watches_catalog_id_idx').on(table.catalogId),
  index('watches_user_sort_idx').on(table.userId, table.sortOrder),
]
```

No `unique('...').on(table.userId, table.catalogId)` exists. DUPE-02 "Add another copy" is safe — the schema allows two watches rows for the same (userId, catalogId) pair. The `addWatch` path with `catalogId` supplied will create a second row bound to the same catalog row without violating any constraint.

### D-22: Is the manual-entry StrictMode skip-case (Skip case 3) actually needed?

**FINDING: Yes, add it.** [VERIFIED: AddWatchFlow.tsx:135-140]

The existing `initialState` ternary at lines 135-140 resolves to `{ kind: 'manual-entry', partial: null }` when `initialManual === true`. This is derived from URL params (like form-prefill). The Phase 29 reasoning was: StrictMode runs mount→cleanup→mount; the cleanup fires before any user interaction and must NOT clobber initialState-derived state. The `form-prefill` skip case (line 204) exists for exactly this reason. Adding a parallel skip case 3 for `manual-entry` from `initialManual=true` is correct and necessary. The guard condition: `s.kind === 'manual-entry' && s.partial === null && initialManual === true`. This mirrors the form-prefill skip case 2 semantically.

### StructuredEntryPanel `onSubmitStructured` — does it emit catalogId?

**GAP CONFIRMED: It does NOT emit catalogId.** [VERIFIED: StructuredEntryPanel.tsx:60, :151-156]

The callback type is:
```typescript
// StructuredEntryPanel.tsx:60
onSubmitStructured: (result: ExtractedWatchData) => void
```

The internal cache stores catalogId (`StructuredEntryPanel.tsx:151-155`):
```typescript
cache.set(key, {
  catalogId: envelope.catalogId ?? '',
  extracted: envelope.data,
  catalogIdError: null,
})
```

But `onSubmitStructured(envelope.data)` fires on line 156 — only `ExtractedWatchData`, no catalogId.

**Coordination gap:** Phase 70's `handleStructuredSubmit` needs the catalogId to call `findViewerWatchByCatalogId(viewerId, catalogId, ['owned','wishlist'])` and to pass to `addWatch({...data, catalogId})`. There are two options:

- **Option A (recommended):** Patch StructuredEntryPanel's `onSubmitStructured` to `(result: ExtractedWatchData, catalogId: string | null) => void`. One-line change on lines 60, 124, and 156. This is a dormant component with no current callers — the contract change is low-risk and keeps orchestrator logic clean.
- **Option B:** Phase 70 re-queries the catalog by (brand, model, reference) from `ExtractedWatchData` to get catalogId — expensive extra round-trip, anti-pattern.

**Planner action:** Plan a Wave 0 StructuredEntryPanel patch before the AddWatchFlow rewrite.

### `findViewerWatchByCatalogId` return shape — does it include catalog `reference`?

**GAP CONFIRMED: No catalog reference in return.** [VERIFIED: src/data/watches.ts:295-322]

```typescript
// watches.ts:299
): Promise<{ id: string; status: 'owned' | 'wishlist' } | null> {
```

The query projects only `id` and `status` from the `watches` table. DupeBanner needs `existingReference` (catalog row's reference) for its "View existing" `/w/[ref]` link.

**Planner action:** Extend `findViewerWatchByCatalogId` to JOIN `watches_catalog` and project `reference`. The return type becomes `{ id: string; status: 'owned' | 'wishlist'; reference: string | null } | null`. This is a Wave 0 DAL patch — needed before the main rewrite calls the helper.

### `addWatch.ts` lines 228-296 — extractable as `fireWatchAddedSideEffects`?

**Verified as partially extractable.** [VERIFIED: src/app/actions/watches.ts:247-318]

The notification block runs lines 247-318 (not 228-296 as cited in CONTEXT — the actual range after Phase 19.1 additions). It contains:
1. `logActivity` call (lines 248-266) — activity-type branching on `watch.status` ('wishlist'/'grail' → 'wishlist_added'; else → 'watch_added')
2. `findOverlapRecipients` + `logNotification` loop (lines 272-317) — only fires when `watch.status === 'owned'`

For `moveWishlistToCollection`, the semantics differ slightly:
- Activity type is `'watch_added'` (owned flip, not 'wishlist_added')
- The CONTEXT.md D-10 adds `source: 'wishlist_move'` to metadata — but `WatchAddedMetadata` type at `activities.ts:23-27` only has `brand`, `model`, `imageUrl`. The `source` field would require a type extension or a `console.warn` workaround.

**Finding:** The CONTEXT.md D-10 note "fire `logActivity(user.id, 'watch_added', watchId, { brand, model, reference, source: 'wishlist_move' })`" will cause a TypeScript error because `WatchAddedMetadata` doesn't have a `source` field. Options:
- Extend `WatchAddedMetadata` to add optional `source?: string`
- Omit the `source` field and just use a `console.warn` for differentiation
- Use the existing type as-is (no source field in metadata)

**Planner action:** Decide whether to extend `WatchAddedMetadata` or drop the `source` field from moveWishlistToCollection's logActivity call. The `console.warn` telemetry line from Claude's Discretion is a simpler approach that avoids the type extension.

The shared helper extraction is viable only if the type extension is done. Without it, inline the side-effect chain in moveWishlistToCollection (mirroring addWatch's pattern without duplication being too severe — the block is about 40 LOC).

### Phase 28 `validateReturnTo` / `defaultDestinationForStatus` / `canonicalize` signatures

**VERIFIED.** [VERIFIED: src/lib/watchFlow/destinations.ts:22-89]

```typescript
validateReturnTo(value: unknown): string | null
defaultDestinationForStatus(status: WatchStatus, username: string | null): string
canonicalize(path: string, viewerUsername: string | null): string
```

All three are already imported in AddWatchFlow.tsx (lines 19, 20). Phase 70 uses them identically in every commit branch. No signature changes needed.

### Phase 61 WatchPhotoStep mount/prop contract

**VERIFIED.** [VERIFIED: src/components/watch/WatchPhotoStep.tsx:37-51]

```typescript
export interface WatchPhotoStepProps {
  watchId: string
  userId: string
  onDone: () => void
  onSkip: () => void
}
```

Phase 70's photos-pending branch wires identically to the existing handler at `AddWatchFlow.tsx:648-669` but gated on `status === 'owned'`. The existing handler transitions `setState({ kind: 'idle' })` on both Done and Skip — Phase 70 renames this to `setState({ kind: 'search-idle' })`.

### D-17: Does the existing `handleWatchCreated` ALWAYS transition to photos-pending (regardless of status)?

**VERIFIED: Yes, it does today.** [VERIFIED: AddWatchFlow.tsx:485-487]

```typescript
// AddWatchFlow.tsx:485-487
const handleWatchCreated = (watchId: string, dest: string) => {
  setState({ kind: 'photos-pending', watchId, destination: dest })
}
```

No status gate exists today. Phase 70 adds the gate: when `onWatchCreated` fires (from WatchForm's form-prefill or manual-entry paths), check the committed watch's status from ConfirmStep's state OR from the WatchForm's form data. The cleanest approach: WatchForm's `onWatchCreated(watchId, dest)` callback doesn't pass status. Phase 70 must know the status to apply the D-17 gate.

**Finding:** WatchForm's `onWatchCreated` prop at `WatchForm.tsx:70` is `(watchId: string, destination: string) => void` — no status. The AddWatchFlow orchestrator tracks `status` state for ConfirmStep, but for the form-prefill path, WatchForm has `lockedStatus="owned"` (always owned → photos-pending always mounts). For manual-entry, WatchForm doesn't lock status — the user chooses. Phase 70 needs to receive the committed status to apply the gate.

**Options:**
- Extend WatchForm's `onWatchCreated` to `(watchId: string, destination: string, status: WatchStatus) => void` — clean but requires WatchForm change
- Track expected status in AddWatchFlow state for the form-prefill / manual-entry branches and apply the gate from orchestrator-side state, not from WatchForm's callback — works without WatchForm changes since form-prefill is always 'owned' (gate trivially true) and manual-entry status is visible in the WatchForm's form state (but not surfaced via callback)

**Planner action:** Decide whether to extend `onWatchCreated` or apply the D-17 gate by tracking status in AddWatchFlow's FlowState. The `form-prefill` branch is always owned (`lockedStatus="owned"`) — the gate is trivially always-pass there. For `manual-entry`, the user's chosen status is in WatchForm's internal state, not in the callback. Extending `onWatchCreated` to pass status is the cleaner option.

### D-06 null-reference fallback — per-watchId route available?

**VERIFIED: No per-watchId public route exists.** [VERIFIED: codebase search]

The v7.0 unified route is `/w/[ref]` — ref-keyed only. There is no `/u/[username]/watch/[id]` public route in the current codebase. For null-reference owned picks, the D-06 fallback (stay in confirming with owned-banner, "View existing" link hidden) is the only option.

---

## Architecture Patterns

### System Architecture Diagram

```
/watch/new page.tsx (SSR)
  └─ validates searchParams, fetches: collection.length, catalogBrands, catalogPrefill, viewerProfile
  └─ passes props → AddWatchFlow (client)

AddWatchFlow (client orchestrator)
  ├─ FlowState: search-idle
  │    └─ <SearchEntry viewerUserId catalogBrands onPick onSubmitStructured onSwitchToUrl />
  │    └─ <button>Skip search — enter manually</button>  [CLNP-06]
  │
  ├─ FlowState: extracting-url
  │    └─ inline <Input type="url" /> + <Button>Find specs</Button>
  │    └─ POST /api/extract-watch {mode:'url', url}
  │    └─ on success → findViewerWatchByCatalogId → confirming
  │    └─ on failure → extraction-failed {mode:'url'}
  │
  ├─ FlowState: confirming
  │    └─ [if dupeContext] <DupeBanner existingStatus existingReference onViewExisting onMoveToCollection onAddAnotherCopy />
  │    └─ <ConfirmStep ... onPrimary onEditDetails onStartOver pending />
  │    └─ onPrimary → addWatch({...extracted, catalogId}) → photos-pending OR destination
  │    └─ DupeBanner.onMoveToCollection → moveWishlistToCollection(existingWatchId) → destination
  │    └─ DupeBanner.onAddAnotherCopy → confirming {dupeContext:null}
  │
  ├─ FlowState: extraction-failed
  │    └─ <ExtractErrorCard category mode retryAction manualAction />
  │
  ├─ FlowState: form-prefill
  │    └─ <WatchForm mode="create" lockedStatus="owned" onWatchCreated />
  │
  ├─ FlowState: manual-entry
  │    └─ <button>← Cancel — return to search</button>
  │    └─ <WatchForm mode="create" defaultStatus onWatchCreated />
  │
  └─ FlowState: photos-pending (only when status === 'owned')
       └─ <WatchPhotoStep watchId userId onDone onSkip />
       └─ onDone/onSkip → router.push(destination)
```

### Recommended File Changes

```
src/components/watch/
├── flowTypes.ts              (REWRITE — new union per D-01)
├── AddWatchFlow.tsx          (REWRITE — new orchestrator)
├── DupeBanner.tsx            (NEW)
├── DupeBanner.test.tsx       (NEW)
├── StructuredEntryPanel.tsx  (PATCH — onSubmitStructured emit adds catalogId)
src/data/
├── watches.ts                (PATCH — findViewerWatchByCatalogId joins reference)
src/app/actions/
├── watches.ts                (ADD export moveWishlistToCollection)
├── __tests__/moveWishlistToCollection.test.ts (NEW)
src/components/watch/
├── AddWatchFlow.test.tsx     (RETROFIT — new Phase 70 test cases added)
```

### Pattern 1: FlowState discriminated-union rewrite

The new flowTypes.ts union (D-01 final shape). Old variants to REMOVE: `idle`, `extracting`, `verdict-ready`, `wishlist-rationale-open`, `submitting-wishlist`, `submitting-collection`. Variants to ADD: `search-idle`, `extracting-url`. Variants to PRESERVE verbatim: `form-prefill`, `manual-entry`, `extraction-failed` (gains `mode` field), `photos-pending`. `DupeContext` interface is new.

Key change in `extraction-failed`: add `mode: 'url' | 'structured'` field (Phase 69 D-06 wired this in ExtractErrorCard but the FlowState shape lacked it):

```typescript
// [VERIFIED: flowTypes.ts:29 — current shape lacks mode]
// Current:
| { kind: 'extraction-failed'; partial: ExtractedWatchData | null; reason: string; category: ExtractErrorCategory }
// Phase 70 adds mode:
| { kind: 'extraction-failed'; partial: ExtractedWatchData | null; reason: string; category: ExtractErrorCategory; mode: 'url' | 'structured' }
```

### Pattern 2: Activity-hide useLayoutEffect cleanup

Existing pattern at `AddWatchFlow.tsx:199-215`. Phase 70 updates:

```typescript
// Pattern to mirror (existing — verified at lines 199-215):
useLayoutEffect(() => {
  return () => {
    const s = stateRef.current
    if (s.kind === 'form-prefill') return          // Skip case 2 (unchanged)
    if (s.kind === 'idle' && urlRef.current === '' && railRef.current.length === 0) return  // Skip case 1 → renames to search-idle check
    setState({ kind: 'idle' })                     // → renames to 'search-idle'
    setUrl('')
    setRail([])
  }
}, [])
```

Phase 70 changes:
- Skip case 1: `s.kind === 'search-idle'` (renamed from `'idle'`; url and rail checks stay)
- Skip case 3 (NEW): `s.kind === 'manual-entry' && s.partial === null && initialManual === true`
- Reset target: `setState({ kind: 'search-idle' })` (renamed)
- `setUrl('')` and `setRail([])` remain (rail still referenced for safety; CLNP-04 deferred)

### Pattern 3: URL-extract cache reuse

`handleUrlBackup` mirrors `handleExtract` at `AddWatchFlow.tsx:225-361` with verdict-compute removed:

```typescript
// Pattern (existing, verified):
const cachedExtract = urlCache.get(trimmedUrl)
if (cachedExtract) {
  const { catalogId, extracted } = cachedExtract
  // Phase 70: skip verdict; do findViewerWatchByCatalogId instead
  // then setState({ kind: 'confirming', ...})
  return
}
// On network hit:
if (catalogId) {
  urlCache.set(trimmedUrl, { catalogId, extracted, catalogIdError })
}
```

### Pattern 4: Server Action auth-first gate

All new/existing Server Actions follow:
```typescript
// [VERIFIED: watches.ts:84]
let user
try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
// THEN Zod parse
```

moveWishlistToCollection must use auth-gate BEFORE Zod parse (matching addWatch/editWatch pattern).

### Pattern 5: logActivity + logNotification side-effect chain

Verified signatures:
```typescript
// [VERIFIED: activities.ts:70-106]
logActivity(userId: string, type: 'watch_added', watchId: string | null, metadata: WatchAddedMetadata): Promise<void>
// WatchAddedMetadata = { brand: string; model: string; imageUrl: string | null }
// NOTE: no `source` field — CONTEXT.md D-10's source:'wishlist_move' would require type extension

// [VERIFIED: notifications.ts:158-162]
findOverlapRecipients(input: { brand: string; model: string; actorUserId: string }): Promise<Array<{ userId: string }>>

// [VERIFIED: logger.ts:41-62 union discriminant]
logNotification({ type: 'watch_overlap', recipientUserId, actorUserId, payload: WatchOverlapPayload })
// WatchOverlapPayload requires: actor_username, actor_display_name, watch_id, watch_brand, watch_model, watch_brand_normalized, watch_model_normalized
// REQUIRES getProfileById(user.id) call before the loop (line 327 in addWatch pattern)
```

### Anti-Patterns to Avoid

- **`font-medium` class:** `tests/no-raw-palette.test.ts` has `/\bfont-medium\b/` in FORBIDDEN array — DupeBanner and extracting-url branch MUST use `font-semibold` or no weight class. Build gate will catch violations.
- **Importing PasteSection / VerdictStep / WishlistRationalePanel:** Phase 70 must NOT import these; Phase 71 static guards lock their absence.
- **Calling editWatch for DUPE-03:** editWatch does NOT fire logActivity or logNotification (verified lines 358-504 — no such calls). Must use new moveWishlistToCollection.
- **useTransition for moveWishlistToCollection:** CONTEXT.md Claude's Discretion says plain async; set confirming.pending = true/false manually.
- **Router.push to ?manual=1 from CLNP-06 skip-search link:** In-flow transition only — setState({kind:'manual-entry'}); URL stays at /watch/new.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| returnTo validation | custom regex | `validateReturnTo` (destinations.ts:22) | Phase 28 open-redirect-safe regex; already in use |
| Post-commit destination | custom logic | `defaultDestinationForStatus` (destinations.ts:41) | Handles null username, wishlist/grail/owned/sold mapping |
| Toast suppress check | custom compare | `canonicalize` (destinations.ts:69) | Handles /u/me/ shorthand, query strip, trailing slash |
| Auth check in Server Action | manual session | `getCurrentUser()` (auth.ts) | Single source of truth; consistent with all other actions |
| Catalog DUPE lookup | re-query inside confirming | `findViewerWatchByCatalogId` (watches.ts:295, + extended) | Anti-N+1 designed for this purpose |
| URL extract caching | new cache | `useUrlExtractCache(viewerUserId)` | Already wired Phase 69; same cross-user reset |

---

## Existing Code: Verified Line Numbers

### AddWatchFlow.tsx key line ranges

| Range | Content | Phase 70 treatment |
|-------|---------|-------------------|
| 1-25 | Imports (PasteSection, VerdictStep, WishlistRationalePanel, RecentlyEvaluatedRail, useWatchSearchVerdictCache, getVerdictForCatalogWatch, VerdictBundle) | REMOVE all these imports; ADD SearchEntry, ConfirmStep, DupeBanner, findViewerWatchByCatalogId, moveWishlistToCollection |
| 52-104 | AddWatchFlowProps interface | UPDATE catalogBrands from `_catalogBrands` aliased pass-through to active consumption by SearchEntry |
| 135-140 | initialState ternary | KEEP precedence; change third branch from `'idle'` to `'search-idle'` |
| 142-156 | useState + cache hooks | REMOVE useWatchSearchVerdictCache + hasCollection; KEEP urlCache; RENAME `const [url, setUrl]` usage still needed for extracting-url branch |
| 158-164 | auto-focus URL useEffect | REMOVE (was for idle/paste-url element; no longer exists) |
| 199-215 | useLayoutEffect cleanup | UPDATE skip cases per D-22 |
| 225-361 | handleExtract | REMOVE entire handler; EXTRACT URL-backup pattern into new handleUrlBackup |
| 362-408 | handleWishlist/handleCollection/handleSkip | REMOVE all three |
| 410-480 | handleWishlistConfirm/handleWishlistCancel | REMOVE both |
| 485-487 | handleWatchCreated | KEEP; update gate per D-17 + rename dest |
| 494-501 | handleManualEntry/handleStartOver | handleManualEntry REMOVED; handleStartOver KEEP, rename to handleSearchIdle-like |
| 509-520 | retryAction/manualAction | KEEP for extraction-failed branch; no change |
| 523-531 | handleRailSelect | REMOVE (rail stops being updated; CLNP-04 deferred) |
| 534-696 | JSX render branches | COMPLETE REWRITE — new branches per D-01/D-02 |

### watches.ts Server Actions

| Range | Content | Phase 70 treatment |
|-------|---------|-------------------|
| 82-355 | addWatch | UNCHANGED; Phase 70 calls as primary CTA on confirming |
| 247-266 | addWatch logActivity block | Pattern to mirror in moveWishlistToCollection |
| 272-318 | addWatch overlap notification block | Pattern to mirror in moveWishlistToCollection |
| 319-341 | addWatch revalidatePath/revalidateTag block | Pattern to mirror in moveWishlistToCollection (same paths + tags) |
| 358-512 | editWatch | UNCHANGED; confirmed does NOT fire logActivity/logNotification |
| 513+ | removeWatch | UNCHANGED |
| NEW | moveWishlistToCollection | ADD after line 350 (before editWatch) |

---

## Common Pitfalls

### Pitfall 1: onSubmitStructured emit missing catalogId

**What goes wrong:** handleStructuredSubmit receives ExtractedWatchData but no catalogId; cannot call findViewerWatchByCatalogId or pass catalogId to addWatch.

**Root cause:** StructuredEntryPanel.tsx:156 fires `onSubmitStructured(envelope.data)` — catalogId is available in the cache write on line 152 but not passed through.

**How to avoid:** Patch StructuredEntryPanel first (Wave 0) to emit `onSubmitStructured(envelope.data, envelope.catalogId ?? null)`. Update all call sites and the callback type on SearchEntry.tsx:74.

**Warning signs:** TypeScript error in handleStructuredSubmit when trying to read catalogId.

### Pitfall 2: findViewerWatchByCatalogId missing reference for DupeBanner

**What goes wrong:** DupeBanner receives `existingReference: undefined`; "View existing" link cannot be built; button hides unconditionally.

**Root cause:** The DAL query at watches.ts:301-306 only projects `id` and `status` from watches — no JOIN to watches_catalog.

**How to avoid:** Add Wave 0 DAL patch to join watches_catalog and project `reference`. Return type: `{ id: string; status: 'owned' | 'wishlist'; reference: string | null } | null`.

**Warning signs:** TypeScript error on DupeBanner when existingReference prop is required but return type lacks it.

### Pitfall 3: WatchAddedMetadata has no `source` field

**What goes wrong:** TypeScript error in moveWishlistToCollection when passing `{ ..., source: 'wishlist_move' }` to logActivity — WatchAddedMetadata at activities.ts:23-27 only has `brand`, `model`, `imageUrl`.

**Root cause:** CONTEXT.md D-10 mentions `source: 'wishlist_move'` in metadata, but the existing type doesn't support it.

**How to avoid:** Either extend `WatchAddedMetadata` to add `source?: string`, or omit `source` and use the CONTEXT.md's Claude's Discretion `console.warn` for telemetry instead. Omitting is simpler.

**Warning signs:** TypeScript type error on logActivity call in moveWishlistToCollection.

### Pitfall 4: font-medium class in DupeBanner or extracting-url branch

**What goes wrong:** Build fails at `npm run test` (no-raw-palette.test.ts catches `font-medium`).

**Root cause:** Recurring across Phases 65, 68 per project memory. DupeBanner is the highest-risk new file.

**How to avoid:** Use `font-semibold` for DupeBanner headlines and ConfirmStep-like primary text. No raw palette numbers either.

**Warning signs:** `npm run test` fails with "font-medium" match in no-raw-palette test.

### Pitfall 5: Activity-hide cleanup resets to 'idle' instead of 'search-idle'

**What goes wrong:** After Activity-hide reset, AddWatchFlow renders into the old 'idle' branch which no longer exists in the new union — TypeScript catches this, but misnamed reset causes the skipcase logic to miss.

**Root cause:** The `setState({ kind: 'idle' })` on line 211 is the reset target; it becomes `setState({ kind: 'search-idle' })`.

**How to avoid:** In the cleanup, check `s.kind === 'search-idle'` for skip case 1 and set to `{ kind: 'search-idle' }` for the reset.

### Pitfall 6: D-17 photos-pending gate: WatchForm's onWatchCreated doesn't pass status

**What goes wrong:** handleWatchCreated cannot know the committed watch's status to apply the D-17 gate (wishlist/grail → skip photos-pending).

**Root cause:** WatchForm.tsx:70 — `onWatchCreated?: (watchId: string, destination: string) => void` — no status.

**How to avoid:** For `form-prefill`: always owned (lockedStatus="owned"), gate is trivially true — photos-pending always mounts. For `manual-entry`: track status in AddWatchFlow state (which status the user had selected in WatchForm at commit time). Extend `onWatchCreated` to `(watchId: string, destination: string, status: WatchStatus) => void` — requires a WatchForm.tsx change but is cleaner.

### Pitfall 7: useWatchSearchVerdictCache still imported after Phase 70

**What goes wrong:** AddWatchFlow.tsx still imports `useWatchSearchVerdictCache` even though Phase 70 removes the verdict compute. The import is at line 15.

**Root cause:** Old import list; Phase 70 cuts it.

**How to avoid:** Explicitly remove line 15 import and lines 146 (`const cache = useWatchSearchVerdictCache(...)`) and 155 (`const hasCollection = ...`). The `useWatchSearchVerdictCache` hook itself is still consumed by `/search` page (`WatchSearchRowsAccordion.tsx:47`) — do NOT delete the hook file, just remove the import from AddWatchFlow.

### Pitfall 8: extracting-url branch caches on the old `url` state variable

**What goes wrong:** The existing `const [url, setUrl] = useState('')` was used by PasteSection. Phase 70's extracting-url branch needs its own URL state. Either reuse `url`/`setUrl` for the inline input, or the `extracting-url` FlowState carries `url: string` (it does per D-01 union).

**Root cause:** FlowState.extracting-url carries `url: string` in its payload. The inline input in extracting-url branch could be a new `useState` for the pending URL before transition, OR the transition captures it when the user submits.

**How to avoid:** Keep `const [url, setUrl] = useState('')` for the extracting-url inline input (it's the pending URL the user is typing). When the user clicks "Find specs", transition to `{ kind: 'extracting-url', url: url.trim() }` and start the fetch using `state.url` (from the state payload, not the local `url` useState). This mirrors the existing handleExtract pattern.

---

## Code Examples

### moveWishlistToCollection structure (pattern to implement)

```typescript
// [VERIFIED: src/app/actions/watches.ts — pattern mirrors addWatch:82-350]
'use server'

export async function moveWishlistToCollection(
  watchId: string,
  opts?: { pricePaid?: number; notes?: string }
): Promise<ActionResult<Watch>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  const parsed = z.object({
    watchId: z.string().uuid(),
    pricePaid: z.number().int().min(0).optional(),
    notes: z.string().max(2000).optional(),
  }).safeParse({ watchId, ...opts })
  if (!parsed.success) return { success: false, error: 'Invalid request' }

  try {
    const priorRow = await watchDAL.getWatchById(user.id, watchId)
    if (!priorRow) return { success: false, error: 'Watch not found' }
    if (priorRow.status !== 'wishlist') {
      if (priorRow.status === 'owned') return { success: true, data: priorRow } // idempotent
      return { success: false, error: `Cannot move ${priorRow.status} watch to collection` }
    }
    // ... updateWatch, logActivity, overlap notifications, revalidation
    return { success: true, data: updatedWatch }
  } catch (err) {
    console.error('[moveWishlistToCollection] unexpected error:', err)
    return { success: false, error: 'Failed to move watch to collection' }
  }
}
```

### DupeBanner structure

```typescript
// Pattern: pure presenter, font-semibold, mobile-first action row
// [VERIFIED: VerdictStep.tsx:102 mobile-first row pattern]
interface DupeBannerProps {
  existingStatus: 'owned' | 'wishlist'
  existingReference: string | null
  onViewExisting: () => void
  onMoveToCollection?: () => void
  onAddAnotherCopy: () => void
  pending?: boolean
}

// Action row mirrors VerdictStep.tsx:102:
// className="flex flex-col gap-2 sm:flex-row sm:gap-3"
```

### handleSearchPick (DUPE-01 + DUPE-03 branch)

```typescript
// [VERIFIED: D-05 / SearchCatalogWatchResult.reference at searchTypes.ts:39]
const handleSearchPick = useCallback((result: SearchCatalogWatchResult) => {
  if (result.viewerState === 'owned') {
    // DUPE-01: redirect directly
    if (result.reference) {
      router.push(`/w/${encodeURIComponent(result.reference)}`)
    } else {
      // D-06 null-reference fallback: fall through to confirming with owned banner
      // (findViewerWatchByCatalogId needed for existingWatchId)
    }
    return
  }
  // null or 'wishlist': go to confirming with dupeContext
  // ... findViewerWatchByCatalogId call
}, [router])
```

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 70 |
|--------------|------------------|---------------------|
| idle → extracting → verdict-ready → wishlist-rationale-open → submitting | search-idle → confirming → submitting | Removes ~250-300 LOC of verdict flow |
| PasteSection for URL input | Inline mini-URL input in extracting-url branch | PasteSection must NOT be imported |
| VerdictStep for commit decision | ConfirmStep (Phase 68) | Phase 68 LOCKED prop contract |
| useWatchSearchVerdictCache + getVerdictForCatalogWatch | Neither used in AddWatchFlow | Both imports removed from AddWatchFlow |
| addWatch always via form or paste | addWatch with catalogId (Phase 67) | Primary CTA in confirming passes catalogId |

---

## Runtime State Inventory

Step 2.5: SKIPPED — Phase 70 is a code rewrite/extension, not a rename/refactor/migration. No stored strings being renamed.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 70 has no external tool dependencies beyond the project's existing stack. All required packages (React, Next.js, Zod, Drizzle) are already installed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npx vitest run src/components/watch/ src/app/actions/__tests__/` |
| Full suite command | `npm run build` (exit 0 is the gate per `project_baseline_not_green_build_is_gate` memory) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DUPE-01 | Owned search-pick → router.push to /w/[ref] | unit | `npx vitest run src/components/watch/AddWatchFlow.test.tsx` | ✅ (retrofit) |
| DUPE-02 | "Add another copy" shows in confirming w/ owned dupeContext | unit | `npx vitest run src/components/watch/AddWatchFlow.test.tsx` | ✅ (retrofit) |
| DUPE-02 | DupeBanner renders owned context correctly | unit | `npx vitest run src/components/watch/DupeBanner.test.tsx` | ❌ Wave 0 |
| DUPE-03 | Wishlist pick → confirming w/ DupeBanner "Move to Collection" | unit | `npx vitest run src/components/watch/AddWatchFlow.test.tsx` | ✅ (retrofit) |
| DUPE-03 | moveWishlistToCollection auth gate | unit | `npx vitest run src/app/actions/__tests__/moveWishlistToCollection.test.ts` | ❌ Wave 0 |
| DUPE-03 | moveWishlistToCollection wishlist→owned happy path | unit | `npx vitest run src/app/actions/__tests__/moveWishlistToCollection.test.ts` | ❌ Wave 0 |
| DUPE-03 | moveWishlistToCollection idempotent already-owned | unit | `npx vitest run src/app/actions/__tests__/moveWishlistToCollection.test.ts` | ❌ Wave 0 |
| DUPE-03 | moveWishlistToCollection sold/grail rejection | unit | `npx vitest run src/app/actions/__tests__/moveWishlistToCollection.test.ts` | ❌ Wave 0 |
| DUPE-03 | moveWishlistToCollection not-yours rejection | unit | `npx vitest run src/app/actions/__tests__/moveWishlistToCollection.test.ts` | ❌ Wave 0 |
| DUPE-03 | moveWishlistToCollection side-effect chain fires | unit | `npx vitest run src/app/actions/__tests__/moveWishlistToCollection.test.ts` | ❌ Wave 0 |
| CLNP-05 | FlowState union shape matches D-01 final shape | unit | `npx vitest run src/components/watch/flowTypes.test.ts` | ❌ Wave 0 |
| CLNP-05 | Old variants (idle, verdict-ready, etc.) no longer in union | unit | `npx vitest run src/components/watch/flowTypes.test.ts` | ❌ Wave 0 |
| CLNP-06 | "Skip search — enter manually" link renders in search-idle | unit | `npx vitest run src/components/watch/AddWatchFlow.test.tsx` | ✅ (retrofit) |
| CLNP-06 | Skip link transitions to manual-entry (no router.push) | unit | `npx vitest run src/components/watch/AddWatchFlow.test.tsx` | ✅ (retrofit) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/watch/ src/app/actions/__tests__/`
- **Per wave merge:** `npm run build` (TypeScript compilation gate)
- **Phase gate:** `npm run build` exit 0 before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/watch/flowTypes.test.ts` — CLNP-05 kind enumeration
- [ ] `src/components/watch/DupeBanner.test.tsx` — DUPE-02/03 presenter cases
- [ ] `src/app/actions/__tests__/moveWishlistToCollection.test.ts` — DUPE-03 Server Action (6 cases)
- [ ] `src/components/watch/StructuredEntryPanel.tsx` PATCH — onSubmitStructured emit extended (not a new test file; existing StructuredEntryPanel.test.tsx must be updated to match new signature)
- [ ] `src/data/watches.ts` PATCH — findViewerWatchByCatalogId return type + JOIN (existing test coverage is a DAL integration pattern; unit tests for this specific helper may be thin)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` auth gate in moveWishlistToCollection |
| V3 Session Management | no | — |
| V4 Access Control | yes | `watchDAL.getWatchById(user.id, watchId)` ownership check (IDOR prevention) |
| V5 Input Validation | yes | Zod schema on moveWishlistToCollection; watchId must be UUID |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on moveWishlistToCollection | Elevation of Privilege | watchDAL.getWatchById(user.id, watchId) — two-layer: Zod uuid + DAL ownership check |
| Stale dupeContext after user changes their mind | Spoofing (minor) | dupeContext resolved at confirming-transition time; cleared on "Add another copy"; user can Start Over |
| Double-tap moveWishlistToCollection | Tampering | Idempotent: if priorRow.status === 'owned' → return { success: true, data: priorRow } |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | flowTypes.ts CLNP-05 — `extraction-failed` needs `mode: 'url' \| 'structured'` field added | Architecture Patterns | Low — if Phase 69's ExtractErrorCard already accepts mode without flowTypes carrying it, the mode is passed directly to ExtractErrorCard from handler state, not FlowState; planner verifies ExtractErrorCard.tsx call site in Phase 70's extraction-failed branch |

**All other claims verified directly from codebase files in this session.**

---

## Open Questions

1. **`onWatchCreated` status extension vs. form-prefill always-owned assumption**
   - What we know: form-prefill is always `lockedStatus="owned"` → photos-pending gate always passes. manual-entry: user chooses status, WatchForm doesn't pass it to onWatchCreated.
   - What's unclear: Is it simpler to extend `onWatchCreated` to `(watchId, dest, status)` or to track the manual-entry status separately in AddWatchFlow state?
   - Recommendation: Extend `onWatchCreated` signature. Phase 70 is already rewriting AddWatchFlow and WatchForm is a stable component — this single-line contract change enables clean D-17 gating. Planner adds a Wave 0 WatchForm.tsx patch task.

2. **`source: 'wishlist_move'` metadata field in logActivity for moveWishlistToCollection**
   - What we know: `WatchAddedMetadata` at activities.ts:23-27 has `{ brand, model, imageUrl }` only — no `source` field.
   - What's unclear: Whether to extend the type or omit `source`.
   - Recommendation: Omit `source` from logActivity metadata. Use the single `console.warn` line that CONTEXT.md Claude's Discretion specifies ("[Phase 70] dupeContext: wishlist existing → move-to-collection affordance") for operator visibility. Adding a `source` field to `WatchAddedMetadata` would require a DB migration or schema change (the metadata column is JSONB — actually safe to add an optional field). On reflection: since it's JSONB, adding `source?: string` to the TypeScript type is a safe no-migration change. Planner decides.

---

## Sources

### Primary (HIGH confidence — all verified from codebase in this session)
- `src/components/watch/AddWatchFlow.tsx` — full read; exact line ranges verified
- `src/components/watch/flowTypes.ts` — full read; current union shape confirmed
- `src/components/watch/SearchEntry.tsx` — full read; onPick/onSubmitStructured/onSwitchToUrl signatures confirmed
- `src/components/watch/StructuredEntryPanel.tsx` — full read; **onSubmitStructured emit gap confirmed**
- `src/components/watch/ConfirmStep.tsx` — full read; D-03 locked prop contract confirmed
- `src/components/watch/WatchPhotoStep.tsx` — full read; WatchPhotoStepProps confirmed
- `src/components/watch/WatchForm.tsx` — partial read; onWatchCreated signature confirmed
- `src/app/actions/watches.ts` — full read (551 lines); addWatch:82-350, editWatch:358-512 confirmed; no logActivity/logNotification in editWatch confirmed
- `src/data/watches.ts` — partial read (295-322); **findViewerWatchByCatalogId return shape gap confirmed**
- `src/db/schema.ts` — partial read; **no UNIQUE(userId,catalogId) constraint confirmed**
- `src/data/activities.ts` — partial read; logActivity overload signatures confirmed; WatchAddedMetadata fields confirmed
- `src/data/notifications.ts` — partial read; findOverlapRecipients signature confirmed
- `src/lib/notifications/logger.ts` — partial read; logNotification discriminated union confirmed
- `src/lib/watchFlow/destinations.ts` — full read; all three function signatures confirmed
- `src/lib/searchTypes.ts` — full read; SearchCatalogWatchResult.reference field confirmed
- `src/lib/actionTypes.ts` — full read; ActionResult<T> envelope confirmed
- `src/app/watch/new/page.tsx` — full read; SSR props confirmed; collectionRevision, catalogBrands, viewerUserId all present
- `src/components/watch/AddWatchFlow.test.tsx` — full read; test pattern and Phase 69 CLNP-07 integration test verified
- `src/app/actions/__tests__/reorderWishlist.test.ts` — partial read; Server Action test pattern confirmed (vi.mock pattern)
- `tests/no-raw-palette.test.ts` — partial read; font-medium FORBIDDEN confirmed
- `.planning/config.json` — full read; nyquist_validation: true confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing project dependencies; no new packages
- Architecture: HIGH — all patterns verified from actual source files with line citations
- Pitfalls: HIGH — root causes traced to specific file:line locations
- Planner verification items: HIGH — all "Planner verifies" markers answered with evidence

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (stable codebase; no fast-moving external deps)

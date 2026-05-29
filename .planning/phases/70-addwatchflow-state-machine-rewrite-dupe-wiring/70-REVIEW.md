---
phase: 70-addwatchflow-state-machine-rewrite-dupe-wiring
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/components/watch/StructuredEntryPanel.tsx
  - src/components/watch/StructuredEntryPanel.test.tsx
  - src/components/watch/SearchEntry.tsx
  - src/data/watches.ts
  - tests/data/findViewerWatchByCatalogId.test.ts
  - src/components/watch/WatchForm.tsx
  - src/components/watch/WatchForm.lockedStatus.test.tsx
  - src/components/watch/DupeBanner.tsx
  - src/components/watch/DupeBanner.test.tsx
  - src/app/actions/watches.ts
  - src/app/actions/__tests__/moveWishlistToCollection.test.ts
  - src/components/watch/flowTypes.ts
  - src/components/watch/flowTypes.test.ts
  - src/components/watch/AddWatchFlow.tsx
  - src/components/watch/AddWatchFlow.test.tsx
findings:
  critical: 2
  warning: 9
  info: 5
  total: 16
status: issues_found
---

# Phase 70: Code Review Report

**Reviewed:** 2026-05-29
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 70 wires the v8.0 add-watch search-first state machine: SearchEntry → ConfirmStep with a new sibling DupeBanner (owned/wishlist context) above ConfirmStep, plus a `moveWishlistToCollection` Server Action for the DUPE-03 commit. The `findViewerWatchByCatalogId` DAL is widened with a leftJoin on `watches_catalog.reference`, and a `findViewerWatchByCatalogIdAction` Server Action wraps it for the client orchestrator.

Most of the change set is well-covered by unit tests and the contract reads cleanly. However, two concrete defects ship in this diff:

1. **`StructuredEntryPanel` silently discards user-uploaded reference photos.** The `CatalogPhotoUploader` is rendered and accepts a Blob, but the write-only `setPhotoBlob` state is never read or forwarded upstream. The promised "Phase 70 forwards it to the catalog source-photo upload pipeline at ConfirmStep commit" is undone — the value goes into local state and dies there. Users will see the upload affordance succeed but no photo will reach the catalog.
2. **`AddWatchFlow.handleConfirmPrimary` payload propagates `imageUrl` from search/extract results into `addWatch`.** When a user picks an `owned`/`wishlist` watch from search, `searchResultToExtracted` carries the catalog `imageUrl` straight into the `Watch.imageUrl` field. The Zod schema accepts it, but the column was dropped in Phase 60 and is silently discarded by `mapDomainToRow` — so when the value is a Supabase storage path or signed URL, it falls into dead-code territory at best. The bigger correctness gap is that **the same payload sends `movement: 'auto'` as a default** for every search-picked submission, overriding any quartz/manual movement the catalog row already knows about — wishlist→add will record a watch with the wrong movement on the user's row whenever the search hit isn't an auto watch.

Additional warnings cover: DupeBanner-shown ConfirmStep can still create silent duplicates if the user clicks "Add" without reading the banner; SearchEntry's `aria-live="polite"` is on the StructuredEntryPanel container only (no announce on Combobox.Popup loading state); `findViewerWatchByCatalogIdAction` swallowed failures cause the DupeBanner to silently disappear (leading to surprise duplicates on transient DB outages); operator `console.warn` lines ship to production; and several smaller items around payload shape, `roleTags`, and notes overwrite semantics.

## Critical Issues

### CR-01: `StructuredEntryPanel` rendered photo uploader is non-functional — user-submitted reference photos are silently discarded

**File:** `src/components/watch/StructuredEntryPanel.tsx:99-103, 246-255`
**Issue:** The component renders `<CatalogPhotoUploader onPhotoReady={setPhotoBlob} ...>` but the corresponding `useState` destructures the setter only:

```tsx
const [, setPhotoBlob] = useState<Blob | null>(null)
```

The Blob value is written to component state and then never read or forwarded. There is no `onPhotoReady` callback in `StructuredEntryPanelProps`, the `handleFindSpecs` POST body does not include any photo path, and `onSubmitStructured` is not widened to surface the blob. The leading comment promises "Phase 70 forwards it to the catalog source-photo upload pipeline at ConfirmStep commit" — but this wiring is missing. Users will tap "Choose photo" through the EXIF/canvas pipeline successfully, see the photo confirmed in the uploader UI, and never have it persisted. There is no error/no-op telemetry to surface this — the failure is silent.

Worse: this is the structured-input path's only photo affordance per D-16/EXTR-06 (CatalogPhotoUploader inline always-visible). The PROD photo-upload contract for the structured flow is effectively missing while shipping as if implemented.

**Fix:** Either (a) thread the blob through to `AddWatchFlow.handleStructuredSubmit` via an `onPhotoReady` (or third arg on `onSubmitStructured`) and upload at `handleConfirmPrimary` time (mirroring `WatchForm` lines 222-249 + `photoSourcePath` payload), or (b) remove the CatalogPhotoUploader from `StructuredEntryPanel` until the wiring lands and update D-16 to defer EXTR-06 to a follow-up. Do not ship the affordance in a non-functional state.

```tsx
// (a) — minimal forward path
export interface StructuredEntryPanelProps {
  // ... existing props
  onPhotoReady?: (blob: Blob | null) => void
}

export function StructuredEntryPanel({ onPhotoReady, ... }) {
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  // ...
  <CatalogPhotoUploader
    onPhotoReady={(b) => { setPhotoBlob(b); onPhotoReady?.(b) }}
    onClear={() => { setPhotoBlob(null); onPhotoReady?.(null) }}
    onError={...}
    disabled={isExtracting}
  />
}
```

Then AddWatchFlow stores the blob, uploads via `uploadCatalogSourcePhoto` after `handleConfirmPrimary`, and includes `photoSourcePath` in the `addWatch` payload (the field is already in the Zod schema at `src/app/actions/watches.ts:67`).

---

### CR-02: `AddWatchFlow.handleConfirmPrimary` overwrites catalog-derived `movement` with the constant `'auto'` and forwards a dead `imageUrl` for search-picked watches

**File:** `src/components/watch/AddWatchFlow.tsx:377-402` (in conjunction with `searchResultToExtracted` at 739-746)
**Issue:** Two problems in the payload assembly:

1. **Movement default clobbers reality.** `searchResultToExtracted` returns only `{ brand, model, reference, imageUrl }` — no `movement`. `handleConfirmPrimary` then computes:

   ```ts
   movement: captured.extracted.movement ?? 'auto',
   ```

   For every search-pick or URL-cache-hit submission where the catalog/extracted result didn't ship a `movement`, the user's `watches` row will be persisted with `movement: 'auto'`. A user adding a quartz Grand Seiko or a hand-wound Speedmaster from search will have it recorded as auto — the catalog row may know the truth, but the `watches` row (which drives similarity and downstream displays) does not. The catalogId branch in `addWatch` only server-overrides `brand`/`model`/`reference`; `movement` is taken from `cleanData` verbatim. So this incorrect default ships through to the DB.

2. **`imageUrl` payload field is forwarded but the column was dropped.** `payload.imageUrl: captured.extracted.imageUrl` propagates whatever the search projection returned (which may be a Supabase storage path or signed URL) through Zod, through `createWatch`, through `mapDomainToRow` — where line 94 explicitly drops it ("imageUrl is NOT mapped here — the column was dropped in Phase 60 Plan 01"). The data is silently discarded. This is dead code, but it disguises the bug above: tests / readers see "imageUrl is in the payload" and assume the catalog cover propagates; it does not. The cover-fallback chain runs through `watches_catalog.imageUrl` exclusively (see `getWatchesByUser` lines 145-148 / 163-168).

**Fix:** For (1), default `movement` only when no catalog row is present; when `captured.catalogId` is set, omit `movement` from the payload entirely and let the catalog row supply identity-equivalent metadata via downstream taste enrichment / the ConfirmStep editable fields. For (2), strip `imageUrl` from the payload — the field is purely decorative and the column does not exist. Add a regression test that asserts a quartz catalog row stays `movement: 'quartz'` (or null) when added via SearchEntry → ConfirmStep, not silently downgraded to `'auto'`.

```ts
// Drop imageUrl entirely; gate movement default.
const payload: Record<string, unknown> = {
  brand: captured.extracted.brand ?? '',
  model: captured.extracted.model ?? '',
  reference: confirmReference || captured.extracted.reference || undefined,
  status: confirmStatus,
  complications: captured.extracted.complications ?? [],
  // ... other fields ...
}
if (captured.extracted.movement) payload.movement = captured.extracted.movement
if (!captured.catalogId && !captured.extracted.movement) payload.movement = 'auto'
if (captured.catalogId) payload.catalogId = captured.catalogId
```

(Also: confirm the ConfirmStep contract — since it doesn't expose a movement editor, a user has no way to correct the value before commit; this needs a UX decision.)

## Warnings

### WR-01: DupeBanner does not gate the underlying ConfirmStep — a single mis-click creates a silent duplicate

**File:** `src/components/watch/AddWatchFlow.tsx:594-630` (render branch)
**Issue:** When the orchestrator resolves a `dupeContext`, the DupeBanner mounts ABOVE the ConfirmStep (D-11). D-12 declares the banner the "primary affordance," but ConfirmStep's primary CTA is still active. A user who skips reading the banner and hits "Save / Add" inside ConfirmStep proceeds straight through `handleConfirmPrimary` → `addWatch` → a new row in `watches`. The DupeBanner's `pending` state only disables banner buttons; it never disables ConfirmStep. There is no client-side or server-side de-dupe (the DB has no unique-per-user-per-catalogId constraint — `findViewerWatchByCatalogId` deliberately uses `LIMIT 1`, allowing multiples).

This is a silent-duplicates path that contradicts the entire reason for the banner. Test coverage (T-70-03, T-70-04) verifies the banner appears and "Add another copy" clears dupeContext, but never asserts that ConfirmStep's primary is gated when dupeContext is present.

**Fix:** Either (a) disable ConfirmStep's primary CTA while `dupeContext != null` (force the user through one of the banner buttons), or (b) when ConfirmStep's primary fires while `dupeContext.existingStatus === 'wishlist'`, route through `moveWishlistToCollection` instead of `addWatch`. Option (a) is the minimal correct fix; option (b) is the UX-smoother variant.

```tsx
<ConfirmStep
  // ...
  pending={state.pending || state.dupeContext != null}
  // or: hide ConfirmStep entirely when dupeContext is set
/>
```

### WR-02: `findViewerWatchByCatalogIdAction` failures fall through to "no DupeBanner" — transient DB outages allow silent duplicates

**File:** `src/components/watch/AddWatchFlow.tsx:722-731` (`resolveDupeContext`)
**Issue:** When the Server Action returns `{ success: false, error: ... }`, the helper logs a warning and returns `null`. The orchestrator treats `null` as "no existing watch" and proceeds to the standard ConfirmStep without a DupeBanner. Combined with WR-01, this means a transient DB error during the dupe lookup gives the user an exact-duplicate `addWatch` path with no warning at all. A retry should be the default posture; a hard-fail with toast.error("Couldn't check your collection — try again") is the correct fallback for the dupe-resolution branch on owned/wishlist results.

**Fix:** Surface a `toast.error` on `resolveDupeContext` failure when the search result indicated `viewerState === 'owned' | 'wishlist'` (i.e., we KNOW a dupe exists per the search projection) and abort the transition rather than dropping into a confirm-without-banner state. For the structured/URL branches where `viewerState` isn't pre-known, the silent fallthrough is more defensible but still warrants a toast affordance.

### WR-03: `moveWishlistToCollection` re-writes `notes` to itself / to null even when the caller never intended to touch notes

**File:** `src/app/actions/watches.ts:446-452`
**Issue:** The update payload is constructed as:

```ts
const updatePayload: Partial<Watch> = {
  status: 'owned',
  pricePaid: parsed.data.pricePaid ?? undefined,
  notes: parsed.data.notes ?? priorRow.notes ?? undefined,
}
```

Because `notes` is unconditionally a key on the object (even when its value resolves to `undefined`), `mapDomainToRow` line 90 (`if ('notes' in data) row.notes = data.notes ?? null`) ALWAYS writes the notes column. When both `parsed.data.notes` and `priorRow.notes` are nullish, the action overwrites the DB column with `null` — even if the DB already had `null`, this is a write where there should be no write (touching `updated_at` for no behavioral reason). More dangerously, when `priorRow.notes` is `null` in the DB but `Watch.notes` surfaces as `undefined` (the domain mapping at `data/watches.ts:42` does `row.notes ?? undefined`), the round-trip preserves null — fine semantically but is a redundant write.

**Fix:** Construct the payload as a sparse object — only include `notes` / `pricePaid` keys when the caller actually supplied them:

```ts
const updatePayload: Partial<Watch> = { status: 'owned' }
if (parsed.data.pricePaid !== undefined) updatePayload.pricePaid = parsed.data.pricePaid
if (parsed.data.notes !== undefined) updatePayload.notes = parsed.data.notes
```

This matches the "Partial<Watch> means absent fields are not changed" comment at line 442 — currently the code violates it.

### WR-04: `StructuredEntryPanel` cache key uses `JSON.stringify({year: NaN})` for non-numeric inputs, collapsing distinct intents into one cache slot

**File:** `src/components/watch/StructuredEntryPanel.tsx:118-124`
**Issue:** `const yearNum = year.trim() ? Number(year) : null`. The `<Input type="number">` mostly rejects non-numeric input, but `Number('e')`, `Number('1e')`, and even leading-`.` cases can yield `NaN`. The cache key then becomes `JSON.stringify({brand, model, reference, year: NaN})` — and `JSON.stringify(NaN)` serializes to `null`. So `year="abc"` and `year=""` hit the same cache slot. The body POST also includes `body.year = NaN` (since the guard at line 150 is `yearNum !== null`, not `Number.isFinite(yearNum)`), which serializes to `null` in transit but bypasses the explicit null branch. This is a latent correctness issue, especially if the input control ever changes to `type="text"` or future browsers loosen the number-input filter.

**Fix:** Use `Number.isFinite` instead of nullish checks:

```ts
const yearNum = year.trim() && Number.isFinite(Number(year)) ? Number(year) : null
```

### WR-05: `useEffect` for SearchEntry server fetch omits `cache` from the dep array, intentionally per the inline comment — but `viewerUserId` is also missing, breaking the documented invariant

**File:** `src/components/watch/SearchEntry.tsx:149-191`
**Issue:** The lint-disable rationale says "The hook itself is keyed off `viewerUserId` which is stable across the current AddWatchFlow lifetime, so omitting it here is safe." That assumption is correct for the AddWatchFlow render lifecycle, but `SearchEntry` is a presenter and its `viewerUserId` prop could theoretically change at the parent (e.g., a future auth-aware wrapper). The effect closure captures `cache` (which reads `moduleUserId === viewerUserId`); if `viewerUserId` flips mid-flight, the in-flight result is correctly dropped by the cache stale-write guard, but the effect that called `searchCatalogForAddFlow` is still firing under the OLD `viewerUserId` and would write to the NEW user's `results` setState. The correct posture is to include `viewerUserId` in the dep array so a switch re-runs the effect and aborts the prior controller.

**Fix:** Include `viewerUserId` in the dep array. The `cache` exclusion remains justified per the comment.

```ts
}, [debouncedQuery, viewerUserId])
```

### WR-06: Operator-only `console.warn` lines in `AddWatchFlow` and `moveWishlistToCollection` ship to production browser console

**File:** `src/components/watch/AddWatchFlow.tsx:165, 187, 219, 332`; `src/app/actions/watches.ts:433`
**Issue:** Phase 70 introduces five `console.warn` statements explicitly labeled "Operator telemetry — cheap visibility for first prod sessions; remove if noisy." (`actions/watches.ts:431-433`) and four `[Phase 70] dupeContext: ...` warnings in `AddWatchFlow`. There is no removal gate, no `process.env.NODE_ENV !== 'production'` guard, and no structured logger. End users will see Phase 70 diagnostic noise in their browser DevTools on every dupe hit, and the server-side `console.warn` per `moveWishlistToCollection` call hits Vercel function logs at full traffic rate.

**Fix:** Gate behind `process.env.NODE_ENV !== 'production'`, or remove before merging. The comment promises removal; the diff doesn't deliver.

### WR-07: `AddWatchFlow.handleSearchPick` issues `router.push(/w/${reference})` based on the client-supplied `result.viewerState === 'owned'` without re-verifying

**File:** `src/components/watch/AddWatchFlow.tsx:158-162`
**Issue:** The owned-with-reference fast path trusts the search projection's `viewerState` and `reference` straight from the catalog DAL. If the user removed the watch in another tab (or via revalidate lag), `viewerState` is stale and the redirect lands on `/w/[ref]` which may show the catalog-branch view rather than the user's owned view — still functionally OK because `/w/[ref]/page.tsx` handles both cases. But the orchestrator never calls `resolveDupeContext` on this branch (unlike the null-reference branch at line 164), so the DupeBanner is bypassed entirely. If the user expected to confirm-with-banner (e.g., to add another copy) they have no entry point and must navigate back.

This is also a security-adjacent concern: the only verification on the owned branch is the client-supplied `viewerState`. A malicious DAL response can route any pick to `/w/[arbitrary]` (the page itself enforces auth, so no real IDOR — just a UX-trust note).

**Fix:** Either always call `resolveDupeContext` on the owned-pick branch (cheap; the server action is already exercised in the null-reference branch), or document explicitly that the search projection is the source of truth and accept the staleness window.

### WR-08: `WatchForm.lockedStatus.test.tsx` mocks `useRouter` without `forward`/`prefetch` — under Next 16 typed-router callers may compile-fail at use site

**File:** `src/components/watch/WatchForm.lockedStatus.test.tsx:22-24`
**Issue:** The mock returns `{ push, back }` only. The test currently passes because `WatchForm` only uses `push` and `back`, but the mock signature does not match Next's typed `AppRouterInstance` — any future addition to `WatchForm` that touches `router.refresh()` or `router.prefetch()` will TypeError in test. Mirrors a defensive concern, not a current bug.

**Fix:** Make the mock fuller or align it with the Next typed-router instance shape (`refresh: vi.fn(), prefetch: vi.fn(), replace: vi.fn(), forward: vi.fn()`).

### WR-09: `AddWatchFlow.handleStructuredSubmit` does not gate the `dupeContext` lookup on a non-null `catalogId` consistently — `catalogId === '' | null` cases collapse together

**File:** `src/components/watch/AddWatchFlow.tsx:212-242`
**Issue:** The structured panel emits `(extracted, catalogId)` where `catalogId` is `string | null`. `handleStructuredSubmit` does `const dupeRow = catalogId ? await resolveDupeContext(catalogId) : null`. This conflates `null` (catalog upsert failed) with `''` (StructuredEntryPanel cache stored an empty-string catalogId; see line 161 `cache.set(key, { catalogId: envelope.catalogId ?? '', ... })`). Both fall through to the no-dupe path, which is the desired posture, but a confused future change could read the cached `''` as a valid catalogId. The cache contract is shaky — `envelope.catalogId ?? ''` writes `''` and the read at line 133 coerces back to `null`. A single canonical null shape would be clearer.

**Fix:** Normalize the cache to `catalogId: string | null` end-to-end. Stop using `''` as a sentinel.

## Info

### IN-01: `linkWatchToCatalog` DAL function is documented `@deprecated Phase 38 D-06` but still exported (`src/data/watches.ts:411-420`)

**File:** `src/data/watches.ts:411`
**Issue:** Mark-for-deletion debt — the function has no callers per the JSDoc comment, and `addWatch` no longer uses it. Dead code that surface-widens the DAL.
**Fix:** Remove in this phase or queue an explicit follow-up — the comment says "Mark for deletion in Polish" but Polish has elapsed multiple times.

### IN-02: `flowTypes.RailEntry.verdict: unknown | null` erodes type safety until Phase 71 cleanup lands

**File:** `src/components/watch/flowTypes.ts:75`
**Issue:** Documented as planned cleanup deferred to Phase 71. Acceptable as a transition state; flagged so it isn't lost in the queue.
**Fix:** Track in Phase 71 SUMMARY.

### IN-03: `flowTypes.test.ts` "removed verdict-flow kinds are absent" assertion is documentation-grade, not enforcement

**File:** `src/components/watch/flowTypes.test.ts:41-47`
**Issue:** The test intersects `REMOVED_KINDS` against `ALL_KINDS` — but if a future change re-adds one of the old kinds to the union and `ALL_KINDS`, the test still passes because `REMOVED_KINDS` is a hand-maintained literal. The intent is to prevent regression but the mechanism is brittle.
**Fix:** Make it a TypeScript-level negative-assertion if possible (`type _NoLegacy = Extract<FlowState['kind'], 'idle' | 'verdict-ready' | ...>` should be `never`).

### IN-04: `AddWatchFlow.handleConfirmPrimary` references `result.data.id` (line 411) on a discriminated-union narrowing that relies on `result.success` truthiness — minor type-safety smell

**File:** `src/components/watch/AddWatchFlow.tsx:411`
**Issue:** `result.success` is narrowed by the early return at line 405; TypeScript should narrow `result.data` to `Watch` (which has `id: string`). Acceptable. Flagged because if `ActionResult` is ever loosened to `{ success: true; data?: T }`, this access becomes unsafe.
**Fix:** Tighten the assertion or use an explicit guard for resilience.

### IN-05: Empty-string defaults inside `searchResultToExtracted` / `extractedToPartialWatch` carry into the `watches` row identity

**File:** `src/components/watch/AddWatchFlow.tsx:739-746, 753-778`
**Issue:** `brand: data.brand ?? ''` and `model: data.model ?? ''` silently fall back to `''`. The Zod schema requires `brand.min(1)` and `model.min(1)`, so `addWatch` rejects the call — but with a generic "Brand is required" error rather than the upstream extraction failure. Better to fail loudly at the orchestrator level when extracted brand/model is missing, since the user can't have picked a search result without a brand/model.
**Fix:** Add a guard at the start of `handleConfirmPrimary`: `if (!captured.extracted.brand || !captured.extracted.model) { toast.error('Missing brand or model — please retry'); return }`.

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 70
plan: 06
subsystem: add-watch-flow
one_liner: Widens StructuredEntryPanel + SearchEntry onSubmitStructured contract to forward the EXIF-cleaned photoBlob upward (CR-01 upstream half) so AddWatchFlow can upload via uploadCatalogSourcePhoto in gap plan 07.
tags:
  - phase-70
  - gap-closure
  - cr-01
  - photo-blob-wiring
  - structured-entry
  - extr-06
requires:
  - StructuredEntryPanel shipped Phase 69 Plan 04 (onSubmitStructured 2-arg base)
  - SearchEntry shipped Phase 69 Plan 05 (pass-through 2-arg base)
  - CatalogPhotoUploader.onPhotoReady contract (EXIF-cleaned Blob)
provides:
  - 3-arg onSubmitStructured contract (result, catalogId, photoBlob?) on both StructuredEntryPanel and SearchEntry
  - Readable photoBlob state inside StructuredEntryPanel (no longer write-only)
  - End-to-end Blob propagation path from CatalogPhotoUploader → StructuredEntryPanel → SearchEntry → AddWatchFlow
affects:
  - src/components/watch/StructuredEntryPanel.tsx
  - src/components/watch/StructuredEntryPanel.test.tsx
  - src/components/watch/SearchEntry.tsx
  - src/components/watch/SearchEntry.test.tsx
tech_stack_added: []
patterns:
  - Additive optional-arg widen (Blob | undefined sentinel; undefined = absence)
  - Identity-stable callback pass-through preserves all args (JSX prop assignment)
key_files_created: []
key_files_modified:
  - src/components/watch/StructuredEntryPanel.tsx
  - src/components/watch/StructuredEntryPanel.test.tsx
  - src/components/watch/SearchEntry.tsx
  - src/components/watch/SearchEntry.test.tsx
decisions:
  - "photoBlob ?? undefined coercion at the StructuredEntryPanel call site — undefined is the canonical absence sentinel for the optional third arg; null would force consumers to handle no-pick vs post-clear via the same branch"
  - "3-arg widen (NOT a sibling onPhotoReady prop) — symmetric with how onSubmitStructured was widened from 1→2 args in Phase 69; CONTEXT.md explicitly directs this path; one less prop to thread through SearchEntry"
  - "Photo blob lifecycle stays in StructuredEntryPanel's local state — CatalogPhotoUploader.onPhotoReady writes setPhotoBlob; the blob is read only at handleFindSpecs commit; matches WatchForm.tsx pattern"
  - "SearchEntry pass-through remains identity-stable (line 345 onSubmitStructured={onSubmitStructured}) — no transformation; the TS widen makes the contract enforcement explicit at compile time"
metrics:
  duration: "5min"
  tasks_completed: 2
  files_modified: 4
  completed_at: "2026-05-29T18:07:00Z"
---

# Phase 70 Plan 06: StructuredEntryPanel + SearchEntry photoBlob forwarding (CR-01 upstream half) Summary

JWT-of-the-day one-liner: **The EXIF-cleaned photo Blob captured by `CatalogPhotoUploader` inside `StructuredEntryPanel` now flows upward via a widened 3-arg `onSubmitStructured(result, catalogId, photoBlob?)` contract through `SearchEntry` to `AddWatchFlow` — closing the upstream half of VERIFICATION gap #1 (CR-01).**

## Goal

Close VERIFICATION gap #1 half-A: the write-only `const [, setPhotoBlob] = useState<Blob | null>(null)` pattern at `StructuredEntryPanel.tsx:103` silently dropped the user's photo upload. This plan plumbs the captured Blob upward through the prop-callback chain so gap plan 07 can consume it in `AddWatchFlow.handleStructuredSubmit` and call `uploadCatalogSourcePhoto` before `addWatch` (mirroring `WatchForm.tsx:222-249`).

## Type Signatures: Before / After

### StructuredEntryPanel.tsx

| Site | Before | After |
|------|--------|-------|
| Prop type (line 65 → 76-80) | `onSubmitStructured: (result: ExtractedWatchData, catalogId: string \| null) => void` | `onSubmitStructured: (result: ExtractedWatchData, catalogId: string \| null, photoBlob?: Blob \| null) => void` |
| State (line 103 → 117) | `const [, setPhotoBlob] = useState<Blob \| null>(null)` (write-only) | `const [photoBlob, setPhotoBlob] = useState<Blob \| null>(null)` (readable) |
| Cache-hit emit (line 133 → 155) | `onSubmitStructured(cached.extracted, cached.catalogId \|\| null)` | `onSubmitStructured(cached.extracted, cached.catalogId \|\| null, photoBlob ?? undefined)` |
| Network-success emit (line 170 → 194) | `onSubmitStructured(envelope.data, envelope.catalogId ?? null)` | `onSubmitStructured(envelope.data, envelope.catalogId ?? null, photoBlob ?? undefined)` |

### SearchEntry.tsx

| Site | Before | After |
|------|--------|-------|
| Prop type (line 75 → 79-83) | `onSubmitStructured: (result: ExtractedWatchData, catalogId: string \| null) => void` | `onSubmitStructured: (result: ExtractedWatchData, catalogId: string \| null, photoBlob?: Blob \| null) => void` |
| Pass-through JSX (line 336 → 345) | `onSubmitStructured={onSubmitStructured}` (unchanged) | `onSubmitStructured={onSubmitStructured}` (unchanged — identity-stable) |

## Exact Line Numbers Changed

### StructuredEntryPanel.tsx
- Lines 5-19 (file-header JSDoc) — onSubmitStructured contract updated to reflect 3-arg shape + Phase 70 gap plan 06/07 narrative
- Lines 66-80 (prop JSDoc + type) — photoBlob? added, JSDoc rewritten
- Lines 112-117 (photoBlob state) — destructure pattern `[photoBlob, setPhotoBlob]` + comment update referencing CR-01 closure
- Lines 148-155 (cache-hit branch) — `photoBlob ?? undefined` third arg + coercion rationale comment
- Lines 187-194 (network-success branch) — `photoBlob ?? undefined` third arg + cross-ref to cache-hit comment

### StructuredEntryPanel.test.tsx
- Lines 37-58 (CatalogPhotoUploader mock) — extended with `catalog-photo-mock-pick` + `catalog-photo-mock-clear` buttons so tests drive the photoBlob lifecycle deterministically
- Line 237 — existing test 8 widened from `toHaveBeenCalledWith(extracted, 'cat-1')` to `(extracted, 'cat-1', undefined)`
- Line 286 — existing test 10 widened from `toHaveBeenCalledWith(extracted, 'cat-omega-speed')` to `(extracted, 'cat-omega-speed', undefined)`
- Lines 291-427 (new describe `'Phase 70 gap plan 06 — photoBlob forwarding (CR-01 closure)'`) — 4 regression cases:
  - P70-06-a — cache-hit path forwards captured Blob (instance + type='image/jpeg')
  - P70-06-b — network-success path forwards captured Blob (instance + type='image/jpeg')
  - P70-06-c — no-pick path forwards `undefined` explicitly
  - P70-06-d — post-clear path forwards `undefined` explicitly

### SearchEntry.tsx
- Lines 12-13 (file-header JSDoc) — contract description updated to 3-arg shape
- Lines 71-83 (prop JSDoc + type) — photoBlob? added, pure pass-through commentary

### SearchEntry.test.tsx
- Lines 54-94 (StructuredEntryPanel mock) — extended with `structured-panel-mock-submit-with-blob` button firing a 3-arg payload
- Lines 738-787 (new describe `'Phase 70 gap plan 06 — onSubmitStructured photoBlob pass-through (CR-01 closure)'`) — 1 regression case asserting the inner StructuredEntryPanel's 3-arg emit reaches the SearchEntry-external spy with the Blob preserved

## Blob Fixture Used in Tests

For 70-07's tests to mirror exactly:

```typescript
new Blob(['x'], { type: 'image/jpeg' })   // StructuredEntryPanel tests (the mock fires a 1-byte payload)
new Blob(['test'], { type: 'image/jpeg' }) // SearchEntry test (4-byte payload via the panel mock)
```

The shared invariant: `photoBlob instanceof Blob && photoBlob.type === 'image/jpeg'`. Plan 07 should assert the same shape on the AddWatchFlow.handleStructuredSubmit receiver side.

## Confirmation: `[, setPhotoBlob]` Pattern Gone

```bash
$ grep -nE "^\s*const\s*\[\s*,\s*setPhotoBlob\]" src/components/watch/StructuredEntryPanel.tsx
# returns: 0 matches (live code)
$ grep -nE "\[\s*,\s*setPhotoBlob\]" src/components/watch/StructuredEntryPanel.tsx
115:  // it (previously write-only via `[, setPhotoBlob]` — see CR-01) and forwards it
```

Only match is the inline JSDoc comment explaining the historical state — intentional narrative reference, not live code. The replacement `const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)` reads the captured value.

## Forward Signal to Gap Plan 07

`handleStructuredSubmit`'s third arg `photoBlob?: Blob | null` is now reaching the AddWatchFlow orchestrator boundary. Gap plan 07 should:

1. Widen `handleStructuredSubmit` from `(extracted, catalogId)` to `(extracted, catalogId, photoBlob?)`
2. Inside the body, mirror `WatchForm.tsx:222-249`:
   ```typescript
   let photoSourcePath: string | undefined = undefined
   if (photoBlob) {
     const { uploadCatalogSourcePhoto } = await import('@/lib/storage/catalogSourcePhotos')
     const uploadResult = await uploadCatalogSourcePhoto(viewerUserId, 'pending', photoBlob)
     if ('path' in uploadResult) photoSourcePath = uploadResult.path
   }
   ```
3. Thread `photoSourcePath` into the `addWatch` payload so the catalog source photo persists alongside the watch row
4. Reuse the same `new Blob(['x'], { type: 'image/jpeg' })` fixture pattern in AddWatchFlow.test.tsx regression cases

## Deviations from Plan

None — plan executed exactly as written:

- Task 1 (StructuredEntryPanel widen + 4 new tests) shipped as specified
- Task 2 (SearchEntry pass-through widen + 1 new test) shipped as specified
- No deviation rules triggered (Rules 1-4); no auto-fixes needed
- No authentication gates; no architectural changes
- `npm run build` exits 0; both vitest files exit 0 with 34/34 tests green

## Verification Results

```
$ npx vitest run src/components/watch/StructuredEntryPanel.test.tsx
✓ 14 tests passed (Phase 69 baseline 10 + Phase 70 gap plan 06 new 4)

$ npx vitest run src/components/watch/SearchEntry.test.tsx
✓ 20 tests passed (Phase 69 baseline 19 + Phase 70 gap plan 06 new 1)

$ npm run build
✓ Compiled successfully in 6.3s
```

All Plan 06 success criteria PASS:

- [x] VERIFICATION.md gaps[0] CR-01-side: captured Blob is no longer dropped — forwarded upward via the widened contract
- [x] Gap plan 07 unblocked: `photoBlob` reaches the AddWatchFlow orchestrator boundary
- [x] AddWatchFlow.tsx NOT touched — diff stays atomic
- [x] Build green; targeted tests green
- [x] CR-01 half-A closed (the upward data path); half-B closes in 70-07

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | StructuredEntryPanel onSubmitStructured 3-arg widen + photoBlob read + 4 tests | `0db88d1c` |
| 2 | SearchEntry pass-through 3-arg widen + 1 pass-through regression test | `03c88a5e` |

## Self-Check

Run after Write to verify all claims.

```bash
$ [ -f src/components/watch/StructuredEntryPanel.tsx ] && echo "FOUND" || echo "MISSING"
FOUND
$ [ -f src/components/watch/SearchEntry.tsx ] && echo "FOUND" || echo "MISSING"
FOUND
$ git log --oneline --all | grep -q "0db88d1c" && echo "FOUND: 0db88d1c" || echo "MISSING: 0db88d1c"
FOUND: 0db88d1c
$ git log --oneline --all | grep -q "03c88a5e" && echo "FOUND: 03c88a5e" || echo "MISSING: 03c88a5e"
FOUND: 03c88a5e
```

## Self-Check: PASSED

---
phase: 70
plan: 07
subsystem: add-watch-flow
one_liner: Closes VERIFICATION gap #1 fully — gates movement on catalogId (no synthetic auto default), strips dead imageUrl payload field, and wires uploadCatalogSourcePhoto in AddWatchFlow.handleConfirmPrimary so the StructuredEntryPanel-captured photoBlob lands in the watches row as photoSourcePath.
tags:
  - phase-70
  - gap-closure
  - cr-01
  - cr-02
  - photo-source-path-wiring
  - movement-gating
  - add-watch-flow
requires:
  - Phase 70 Plan 06 (widened onSubmitStructured contract — CR-01 upstream half)
  - Phase 67 D-10 addWatch catalogId branch (server-overrides identity tuple)
  - Phase 19.5 LLM-derived taste enrichment (movement-of-truth on catalog row)
  - WatchForm.tsx:222-249 (canonical pattern for uploadCatalogSourcePhoto)
provides:
  - 3-arg handleStructuredSubmit signature on AddWatchFlow (extracted, catalogId, photoBlob?)
  - photoBlob field on FlowState.confirming variant
  - Movement gating on captured.catalogId in handleConfirmPrimary payload
  - Removal of dead imageUrl payload field (Phase 60 dropped the column)
  - photoSourcePath forwarding via uploadCatalogSourcePhoto BEFORE addWatch
affects:
  - src/components/watch/AddWatchFlow.tsx
  - src/components/watch/AddWatchFlow.test.tsx
  - src/components/watch/flowTypes.ts
tech_stack_added: []
patterns:
  - Gate-on-catalogId payload assembly (no synthetic defaults when catalog row supplies truth)
  - Fire-and-forget photo upload BEFORE addWatch (mirrors WatchForm.tsx:222-249)
  - JSDoc-prose paraphrase to avoid grep-collision with done-criteria static greps
key_files_created: []
key_files_modified:
  - src/components/watch/AddWatchFlow.tsx
  - src/components/watch/AddWatchFlow.test.tsx
  - src/components/watch/flowTypes.ts
decisions:
  - "Movement field is OMITTED from the addWatch payload entirely when catalogId is set — never defaulted to 'auto'. The catalog row's downstream taste enrichment (Phase 19.5) supplies the movement of truth; the user's watches row inherits it via the server-side addWatch catalogId branch (Phase 67 D-10)."
  - "When no catalogId is present (URL-backup transient failure), extracted.movement is forwarded ONLY when actually provided — no synthetic 'auto' fallback ever. A quartz Grand Seiko added via URL with movement='quartz' persists as quartz; a movement-less extraction omits the field entirely."
  - "imageUrl payload field stripped completely (not just gated). Phase 60 dropped the watches.image_url column; mapDomainToRow:94 silently drops it at the DAL boundary. Keeping it in the orchestrator payload obscured the cover-fallback chain (which runs through watches_catalog.image_url only)."
  - "photoBlob lives on the confirming FlowState variant (NOT a useRef). Keeps the state machine single-source-of-truth; the optional field is null on all non-structured paths (search-pick + URL-backup) where there's no inline photo affordance."
  - "Photo upload is fire-and-forget on failure (matches WatchForm.tsx:222-249 D-09 posture). uploadResult.error is console.error'd but addWatch proceeds without photoSourcePath — the watch commit is never blocked by a photo upload failure."
  - "JSDoc-prose paraphrase pattern (recurrence-3 of feedback_decision_coverage_gate_citations): the explanation comment for the CR-02 fix originally backticked the literal pattern 'movement: captured.extracted.movement ?? \\'auto\\''. The plan's done-criteria static greps target that exact string; backticked prose would false-positive. Reworded to 'synthetic auto-default on the movement field' — semantic intent preserved, grep collision avoided."
metrics:
  duration: "9min"
  tasks_completed: 2
  files_modified: 3
  completed_at: "2026-05-29T18:18:00Z"
---

# Phase 70 Plan 07: AddWatchFlow handleConfirmPrimary payload cleanup + photoSourcePath wiring Summary

JWT-of-the-day one-liner: **VERIFICATION gap #1 fully closes — movement no longer corrupts non-auto catalog rows, dead imageUrl payload field is stripped, and the EXIF-cleaned Blob from StructuredEntryPanel reaches the watches row as photoSourcePath via uploadCatalogSourcePhoto.**

## Goal

Close VERIFICATION gap #1 fully. Three sub-gaps:

1. **CR-02 movement (the data-correctness blocker):** the pre-gap `handleConfirmPrimary` payload assembled a synthetic `'auto'` default on the movement field when `captured.extracted.movement` was undefined. Every search-pick / URL-cache-hit commit where the catalog/extracted result lacked movement persisted that lie to the user's watches row — overriding the truth of any quartz / hand-wound watch added via search. `addWatch`'s catalogId branch (Phase 67 D-10) only server-overrides brand/model/reference; movement flowed through verbatim.

2. **CR-02 imageUrl (the dead-code half):** the payload included `imageUrl: captured.extracted.imageUrl`. Phase 60 dropped the `watches.image_url` column; `mapDomainToRow:94` silently dropped the field at the DAL boundary. Dead-code that obscured the cover-fallback chain (which runs through `watches_catalog.image_url` only).

3. **CR-01 photoSourcePath (the photo upload consumer half):** Plan 06 widened `onSubmitStructured` to forward the photoBlob upward, but `AddWatchFlow.handleStructuredSubmit` was still a 2-arg signature; the Blob died at the orchestrator boundary. Users tapped "Choose photo" successfully but nothing reached the watches row.

## Payload Shape: Before / After

### Before (pre-gap, AddWatchFlow.tsx:371-422)

```typescript
const payload: Record<string, unknown> = {
  brand: captured.extracted.brand ?? '',
  model: captured.extracted.model ?? '',
  reference: confirmReference || captured.extracted.reference || undefined,
  status: confirmStatus,
  movement: captured.extracted.movement ?? 'auto',   // CR-02 BUG
  complications: captured.extracted.complications ?? [],
  // ... case/strap/crystal/dial/style/design/role/chronometer/marketPrice
  imageUrl: captured.extracted.imageUrl,             // CR-02 dead code
  productionYear: confirmYear,
}
if (captured.catalogId) payload.catalogId = captured.catalogId
// no photo upload — Blob died upstream in StructuredEntryPanel
```

### After (Plan 07, AddWatchFlow.tsx:404-457)

```typescript
const payload: Record<string, unknown> = {
  brand: captured.extracted.brand ?? '',
  model: captured.extracted.model ?? '',
  reference: confirmReference || captured.extracted.reference || undefined,
  status: confirmStatus,
  // movement REMOVED from base — gated below
  complications: captured.extracted.complications ?? [],
  // ... case/strap/crystal/dial/style/design/role/chronometer/marketPrice
  // imageUrl REMOVED entirely
  productionYear: confirmYear,
}
// CR-02 movement fix: when catalogId is set, the catalog row supplies movement
// via downstream taste enrichment; never default to 'auto'. When no catalogId
// (URL-backup transient failure), forward extracted.movement only if provided.
if (!captured.catalogId && captured.extracted.movement) {
  payload.movement = captured.extracted.movement
}
if (captured.catalogId) payload.catalogId = captured.catalogId

// CR-01 photo upload: dynamic-imports mirror WatchForm.tsx:222-249.
if (captured.photoBlob) {
  try {
    const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { uploadCatalogSourcePhoto } = await import('@/lib/storage/catalogSourcePhotos')
      const uploadResult = await uploadCatalogSourcePhoto(user.id, 'pending', captured.photoBlob)
      if ('path' in uploadResult) {
        payload.photoSourcePath = uploadResult.path
      } else {
        console.error('[AddWatchFlow gap-07] photo upload failed:', uploadResult.error)
      }
    }
  } catch (err) {
    console.error('[AddWatchFlow gap-07] photo upload exception (non-fatal):', err)
  }
}
```

## Movement Behavior Matrix

| Path                                    | catalogId | extracted.movement | Payload.movement       | Rationale                                                |
| --------------------------------------- | --------- | ------------------ | ---------------------- | -------------------------------------------------------- |
| Search-pick (always has catalogId)      | set       | absent             | OMITTED                | Catalog row + taste enrichment owns truth                |
| Structured-submit (catalogId set)       | set       | absent             | OMITTED                | Same as above                                            |
| Structured-submit (catalogId set)       | set       | present            | OMITTED                | Same — catalog row wins even if LLM volunteered movement |
| URL-backup cache-hit (catalogId set)    | set       | present            | OMITTED                | Same                                                     |
| URL-backup network success (no catalog) | null      | 'quartz'           | 'quartz'               | No catalog — extracted is the only truth source          |
| URL-backup network success (no catalog) | null      | undefined          | OMITTED                | No synthetic default ever                                |

The buggy pre-gap behavior persisted `movement: 'auto'` in row 1 (search-pick, the most common path) and row 6 (URL-backup with no movement). Both are now corrected.

## FlowState Extension

```typescript
// flowTypes.ts confirming variant (before):
| { kind: 'confirming'; catalogId: string | null; extracted: ExtractedWatchData; pickedResult: SearchCatalogWatchResult | null; dupeContext: DupeContext | null; pending: boolean }

// flowTypes.ts confirming variant (after):
| { kind: 'confirming'; catalogId: string | null; extracted: ExtractedWatchData; pickedResult: SearchCatalogWatchResult | null; dupeContext: DupeContext | null; pending: boolean; photoBlob?: Blob | null }
```

All 5 setState sites that transition INTO confirming now pass `photoBlob`:

| Site                                       | photoBlob value         | Why                                                                |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------ |
| AddWatchFlow.tsx:178 — search-pick owned-null-ref | `null`           | Search-pick has no inline photo affordance                         |
| AddWatchFlow.tsx:208 — search-pick wishlist/null  | `null`           | Same                                                               |
| AddWatchFlow.tsx:252 — handleStructuredSubmit     | `photoBlob ?? null`  | The captured Blob (or null if no pick / cleared)                   |
| AddWatchFlow.tsx:309 — URL-backup cache-hit       | `null`           | URL-backup has no inline photo affordance                          |
| AddWatchFlow.tsx:370 — URL-backup network success | `null`           | Same                                                               |

`handleAddAnotherCopy` spreads existing state with `{ ...state, dupeContext: null, pending: false }` so photoBlob is preserved automatically across that re-render.

## Regression Tests (5 new in the gap-plan-07 describe block; 3 additional structural coverage)

The plan called for 5 regression tests; I shipped 7 in the describe block + the 7 test names with their gap-truth mapping:

| Test                                                                                                          | Closes Gap-Truth                                                  |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `handleStructuredSubmit with photoBlob → addWatch payload includes photoSourcePath`                          | CR-01 consumer half (the Blob reaches uploadCatalogSourcePhoto)   |
| `handleStructuredSubmit without photoBlob → addWatch payload omits photoSourcePath`                          | CR-01 inverse — no upload attempt when no Blob                    |
| `handleConfirmPrimary proceeds when uploadCatalogSourcePhoto fails (fire-and-forget)`                        | CR-01 non-fatal posture (no toast.error on upload failure)        |
| `addWatch payload omits movement when catalogId is set (CR-02 fingerprint)` (structured-submit branch)        | CR-02 movement — the original review fingerprint                  |
| `search-pick → addWatch payload omits movement even when catalogId is set`                                   | CR-02 movement — the most common path (search-pick always has catalogId) |
| `addWatch payload omits imageUrl entirely (CR-02 dead-code)`                                                 | CR-02 imageUrl — dead column stripped                             |
| `URL-backup WITHOUT catalogId WITH extracted.movement="quartz" preserves movement verbatim`                  | CR-02 movement gate inverse — extracted.movement still flows when no catalog |
| `URL-backup WITHOUT catalogId AND WITHOUT extracted.movement omits movement entirely`                        | CR-02 critical-case — no synthetic 'auto' fallback ever           |

## Supabase + uploadCatalogSourcePhoto Mocks (for verifier's reproduction recipe)

```typescript
vi.mock('@/lib/storage/catalogSourcePhotos', () => ({
  uploadCatalogSourcePhoto: vi.fn(),
}))
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(),
}))

// Default impls in beforeEach of the gap-plan-07 describe:
vi.mocked(uploadCatalogSourcePhoto).mockResolvedValue({
  path: 'user-id-1/pending/abc.jpg',
})
vi.mocked(createSupabaseBrowserClient).mockReturnValue({
  auth: {
    getUser: () => Promise.resolve({ data: { user: { id: 'user-id-1' } }, error: null }),
  },
} as any)
vi.mocked(addWatch).mockResolvedValue({
  success: true,
  data: { id: 'new-watch-id', status: 'wishlist' } as any,
})
```

The dynamic imports inside `handleConfirmPrimary` (`await import('@/lib/storage/catalogSourcePhotos')` / `await import('@/lib/supabase/client')`) resolve to these mocks — Vitest's `vi.mock` intercepts static AND dynamic imports of the same specifier by default.

## Existing Tests: All 13 stay green

The 13 pre-existing tests in the `Phase 70 — AddWatchFlow orchestrator state machine` describe block (T-70-01..T-70-08c + CLNP-06 sub-cases) all remained green throughout — the orchestrator's render branches and transition logic are unchanged; only the payload-assembly internals + handler signature + state shape evolved. The Phase 69 CLNP-07 cache-hygiene integration test (in a sibling describe) also remained untouched and green.

## Confirmation: Static Greps

```bash
$ grep -nE "movement: captured.extracted.movement \?\? 'auto'" src/components/watch/AddWatchFlow.tsx | wc -l
0

$ grep -n "imageUrl: captured.extracted.imageUrl" src/components/watch/AddWatchFlow.tsx | wc -l
0

$ grep -n "imageUrl: captured" src/components/watch/AddWatchFlow.tsx | wc -l
0

$ grep -nc "uploadCatalogSourcePhoto" src/components/watch/AddWatchFlow.tsx
4

$ grep -nc "payload.photoSourcePath" src/components/watch/AddWatchFlow.tsx
1

$ grep -nc "photoBlob" src/components/watch/AddWatchFlow.tsx
15

$ grep -nc "photoBlob" src/components/watch/flowTypes.ts
5

$ grep -nc "photoSourcePath" src/components/watch/AddWatchFlow.tsx
4
```

All match plan done-criteria expectations:
- `movement: captured.extracted.movement ?? 'auto'` → 0 (buggy default gone)
- `imageUrl: captured.extracted.imageUrl` → 0 (dead code stripped)
- `uploadCatalogSourcePhoto` → 4 (upload pipeline wired)
- `payload.photoSourcePath` → 1 (path forwarded into addWatch payload)
- `photoBlob` in AddWatchFlow.tsx → 15 (handler signature + state setState × 5 + handleConfirmPrimary check + JSDoc references)
- `photoBlob` in flowTypes.ts → 5 (variant field + JSDoc references)

The single remaining `?? 'auto'` in AddWatchFlow.tsx is at line 815 in the `extractedToPartialWatch` helper which constructs a `Watch` domain object for WatchForm prefill — that's a different code path (`MovementType` is non-nullable in the Watch type) and is unrelated to the payload-assembly gap.

## Verification Results

```
$ npx vitest run src/components/watch/AddWatchFlow.test.tsx src/components/watch/flowTypes.test.ts \
                  src/components/watch/StructuredEntryPanel.test.tsx src/components/watch/SearchEntry.test.tsx
✓ 59 tests passed (21 + 4 + 14 + 20)

$ npm run build
✓ Compiled successfully in 12.9s
```

All Plan 07 success criteria PASS:

- [x] CR-02 movement: no synthetic `'auto'` default in the payload; omitted when catalogId supplies truth; verbatim when extracted volunteers it and no catalogId is set
- [x] CR-02 imageUrl: dead payload field stripped entirely (Phase 60 column drop closure)
- [x] CR-01 photoSourcePath: Blob reaches uploadCatalogSourcePhoto and photoSourcePath lands in addWatch payload
- [x] The verifier's `addWatch payload` Data-Flow Trace row changes from "STATIC + HOLLOW_FIELDS" to "FLOWING"
- [x] The verifier's `StructuredEntryPanel CatalogPhotoUploader` row changes from "DISCONNECTED" to "FLOWING"
- [x] Build green; all targeted tests green; no regression in the 13 existing AddWatchFlow tests

## Deviations from Plan

None — plan executed exactly as written, with one trivial preventive measure:

- **JSDoc-prose recurrence-3 preempt:** the explanation comment for the CR-02 fix initially backticked the literal pattern `movement: captured.extracted.movement ?? 'auto'` and `imageUrl: captured.extracted.imageUrl` for readability. The plan's done-criteria static greps target those exact strings, and backticked prose would false-positive (recurrence-3 of the `feedback_decision_coverage_gate_citations` family). Reworded to "synthetic auto-default on the movement field" / "the dead imageUrl payload field has been removed" — semantic intent preserved, grep collision avoided. Required because the plan's `done` block has hard `wc -l` counts.

No Rule 1-4 deviations triggered; no auto-fixes needed; no authentication gates; no architectural changes.

## Forward Signal to Gap Plan 08

`handleConfirmPrimary`'s payload is now clean — movement gated correctly, imageUrl stripped, photoSourcePath threaded. Gap plan 08 (WR-01 ConfirmStep pending-gate when DupeBanner mounted) can layer on top WITHOUT re-touching the payload. The ConfirmStep `pending` prop drives the primary-CTA disable; Plan 08 widens the condition to `pending || dupeContext != null` so a user can't bypass the banner by clicking ConfirmStep's primary directly. No further changes to handleConfirmPrimary internals.

## Commits

| Task | Description                                                                                | Commit     |
| ---- | ------------------------------------------------------------------------------------------ | ---------- |
| 1    | FlowState.confirming gains photoBlob; handleStructuredSubmit widened to 3-arg; 7 new tests | `53b22a34` |
| 2    | Movement gated on catalogId; imageUrl stripped; uploadCatalogSourcePhoto wired             | `7060799c` |

## Self-Check

```bash
$ [ -f src/components/watch/AddWatchFlow.tsx ] && echo "FOUND" || echo "MISSING"
FOUND
$ [ -f src/components/watch/flowTypes.ts ] && echo "FOUND" || echo "MISSING"
FOUND
$ [ -f src/components/watch/AddWatchFlow.test.tsx ] && echo "FOUND" || echo "MISSING"
FOUND
$ git log --oneline --all | grep -q "53b22a34" && echo "FOUND: 53b22a34" || echo "MISSING: 53b22a34"
FOUND: 53b22a34
$ git log --oneline --all | grep -q "7060799c" && echo "FOUND: 7060799c" || echo "MISSING: 7060799c"
FOUND: 7060799c
```

## Self-Check: PASSED

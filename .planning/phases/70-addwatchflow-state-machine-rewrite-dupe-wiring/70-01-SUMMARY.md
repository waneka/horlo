---
phase: 70
plan: 01
subsystem: addwatchflow
tags:
  - addwatchflow
  - phase-70
  - wave-0
  - dal-extension
  - structured-input
  - wave-0-prerequisite-patches
requires:
  - 67-server-action-dal-extensions (findViewerWatchByCatalogId, addWatch catalogId branch)
  - 68-confirmstep-component (ConfirmStep dormant, prop contract LOCKED)
  - 69-searchentry-structuredentrypanel-cache-hygiene (StructuredEntryPanel + SearchEntry dormant, useStructuredExtractCache stores catalogId)
provides:
  - StructuredEntryPanel.onSubmitStructured emits (extracted, catalogId)
  - SearchEntry.onSubmitStructured pass-through type widened identically
  - findViewerWatchByCatalogId returns reference via watches_catalog leftJoin
  - WatchForm.onWatchCreated emits (watchId, destination, status: WatchStatus)
affects:
  - 70-02 (DupeBanner — will consume existingReference from extended DAL)
  - 70-03 (moveWishlistToCollection — pattern-matches the catalogId surface)
  - 70-04 (flowTypes.ts rewrite — depends on the patched contracts)
  - 70-05 (AddWatchFlow orchestrator — primary consumer of all three Wave 0 patches)
tech-stack:
  added: []
  patterns:
    - "Additive contract widening at TypeScript boundary (parameter bivariance preserves old callers)"
    - "leftJoin watches_catalog for catalog-row-authoritative read of reference (T-70-04 mitigation)"
key-files:
  created: []
  modified:
    - src/components/watch/StructuredEntryPanel.tsx
    - src/components/watch/StructuredEntryPanel.test.tsx
    - src/components/watch/SearchEntry.tsx
    - src/data/watches.ts
    - tests/data/findViewerWatchByCatalogId.test.ts
    - src/components/watch/WatchForm.tsx
    - src/components/watch/WatchForm.lockedStatus.test.tsx
decisions:
  - "D-17 (CONTEXT) honored — WatchForm.onWatchCreated surfaces committed status via third arg (RESEARCH Open Question #1 resolved)"
  - "RESEARCH §1 gap closed — catalogId routed through StructuredEntryPanel emit boundary (no side-channel re-query needed in Plan 05)"
  - "RESEARCH §2 gap closed — findViewerWatchByCatalogId joins watches_catalog so DupeBanner /w/[ref] target is server-authoritative (T-70-04)"
  - "Backward-compat preserved — all Phase 67/68/69 tests stay green; existing /w/[ref] Branch 2 owned check (page.tsx:439) destructures only {id}; AddWatchFlow.tsx:485-487 2-arg handler still assignable to 3-arg WatchForm prop via TypeScript parameter bivariance"
metrics:
  duration_minutes: 17
  tasks_completed: 4
  files_modified: 7
  commits: 3
  completed_date: 2026-05-29
---

# Phase 70 Plan 01: Wave 0 Prerequisite Patches Summary

**One-liner:** Three additive contract widenings (StructuredEntryPanel emit, findViewerWatchByCatalogId return shape, WatchForm.onWatchCreated arity) that unblock the Phase 70 AddWatchFlow rewrite without breaking any Phase 67/68/69 test.

## Patches Delivered

### Patch 1 — `src/components/watch/StructuredEntryPanel.tsx` + `SearchEntry.tsx`

**Closes RESEARCH §1 coordination gap.** The structured-input emit now carries `catalogId` as the second arg so the AddWatchFlow orchestrator (Plan 05) can:

- call `findViewerWatchByCatalogId(viewerId, catalogId, ['owned','wishlist'])` for DUPE-02/03 lookup, and
- call `addWatch({...extracted, catalogId})` for the primary CTA,

without a side-channel re-query of the catalog by (brand, model, reference).

**Exact deltas (StructuredEntryPanel.tsx):**

- L60 prop type:
  `onSubmitStructured: (result: ExtractedWatchData) => void`
  →
  `onSubmitStructured: (result: ExtractedWatchData, catalogId: string | null) => void`
- L124 cache-hit emit:
  `onSubmitStructured(cached.extracted)`
  →
  `onSubmitStructured(cached.extracted, cached.catalogId || null)`
- L156 network-success emit:
  `onSubmitStructured(envelope.data)`
  →
  `onSubmitStructured(envelope.data, envelope.catalogId ?? null)`
- Header docstring updated to reflect the widened contract.

**Exact deltas (SearchEntry.tsx):**

- L72 pass-through prop type:
  `onSubmitStructured: (result: ExtractedWatchData) => void`
  →
  `onSubmitStructured: (result: ExtractedWatchData, catalogId: string | null) => void`
- JSX pass-through at line 333 unchanged (TypeScript contravariant assignability).

**Test updates:**

- `StructuredEntryPanel.test.tsx` Test (8) cache-hit assertion:
  `expect(onSubmitStructured).toHaveBeenCalledWith(cachedExtracted)`
  → `expect(onSubmitStructured).toHaveBeenCalledWith(cachedExtracted, 'cat-1')`
- `StructuredEntryPanel.test.tsx` Test (10) network-success assertion:
  `expect(onSubmitStructured).toHaveBeenCalledWith(extracted)`
  → `expect(onSubmitStructured).toHaveBeenCalledWith(extracted, 'cat-omega-speed')`
- Header docstring updated to reflect the widened tests.
- `SearchEntry.test.tsx` — no edits needed (mock at L63 declares `onSubmitStructured: (...args: unknown[]) => void` — permissive signature absorbs the widening; no behavioral assertions on the bubbled call).

### Patch 2 — `src/data/watches.ts` `findViewerWatchByCatalogId`

**Closes RESEARCH §2 coordination gap + threat T-70-04.** DupeBanner's "View existing" link (`/w/${reference}`) consumes `existingReference` from this return shape. The reference is JOINed from `watches_catalog` server-side — it is never client-supplied.

**Exact deltas:**

- Return type:
  `Promise<{ id: string; status: 'owned' | 'wishlist' } | null>`
  →
  `Promise<{ id: string; status: 'owned' | 'wishlist'; reference: string | null } | null>`
- `.select({...})` projection adds `reference: watchesCatalog.reference`.
- `.leftJoin(watchesCatalog, eq(watches.catalogId, watchesCatalog.id))` inserted between `.from(watches)` and `.where(...)`.
- Return mapping coerces `row.reference ?? null` (column is nullable in the catalog schema — legitimate; some watches have no public reference number).
- `watchesCatalog` already imported at the top of the file (line 5) — no new imports.
- Docblock comment block updated to reference Phase 70 Wave 0 + T-70-04.

**Test updates (`tests/data/findViewerWatchByCatalogId.test.ts`):**

- Chain mock gains a `leftJoin(...args)` step between `from()` and `where()`.
- `returnedRows` type widened to `Array<{ id: string; status: string; reference?: string | null }>`.
- Existing tests (a)/(b)/(c) updated to expect `reference: null` in the toEqual shape (mock rows omit reference → helper coerces undefined → null).
- New test (f) added: when the mock row includes `reference: '311.30.42.30.01.005'`, the helper surfaces it in the return.

**Existing consumer compatibility verified:**

- `src/app/w/[ref]/page.tsx:439` calls the helper with 2 args (no statuses) and destructures only `{id}` later — additive field is invisible to it.
- `tests/integration/phase59-unified-route.test.ts` uses `result!.id` only — unaffected.

### Patch 3 — `src/components/watch/WatchForm.tsx` `onWatchCreated`

**Closes RESEARCH Open Question #1 (CONTEXT D-17).** Phase 70 gates `photos-pending` on `status === 'owned'`; the manual-entry branch needs the user's chosen status to apply the gate. The form-prefill branch is trivially `owned` via `lockedStatus="owned"` — but the contract widening keeps both branches uniform.

**Exact deltas:**

- L70 prop type:
  `onWatchCreated?: (watchId: string, destination: string) => void`
  →
  `onWatchCreated?: (watchId: string, destination: string, status: WatchStatus) => void`
- L271 call site:
  `onWatchCreated(result.data.id, dest)`
  →
  `onWatchCreated(result.data.id, dest, finalStatus)`
- `finalStatus` (= `lockedStatus ?? formData.status`, computed at L202) already exists in scope — no new variable.
- `WatchStatus` already imported via the existing `import type { Watch, WatchStatus, ... } from '@/lib/types'` line (L39).
- Docblock comment updated to reference Phase 70 Wave 0 + D-17 rationale.

**Test updates (`WatchForm.lockedStatus.test.tsx`):**

- New 5th test added: "Phase 70 Wave 0 (D-17) — onWatchCreated fires with (watchId, destination, status) on create-success". Asserts `toHaveBeenCalledWith('w-create-1', expect.any(String), 'owned')` on a `lockedStatus="owned"` render.
- Original 4 tests untouched (they do not mock `onWatchCreated`).

**Existing consumer compatibility verified:**

- `src/components/watch/AddWatchFlow.tsx:485` — `const handleWatchCreated = (watchId: string, dest: string) => {...}` — assigns a 2-arg handler to a 3-arg prop type. TypeScript permits fewer-params assignment (parameter bivariance / variadic compatibility). Build exits 0 confirms.
- `/w/[ref]/edit/page.tsx:31` and `WatchForm.lockedStatus.test.tsx` other renders — don't pass `onWatchCreated` (optional prop).

## Verification

### Build gate (THE authoritative gate per `project_baseline_not_green_build_is_gate`)

```
npm run build
BUILD_EXIT: 0
✓ Compiled successfully in 5.8s
```

### Targeted test suite (Plan 04 verify hook)

```
npx vitest run \
  src/components/watch/StructuredEntryPanel.test.tsx \
  src/components/watch/SearchEntry.test.tsx \
  src/components/watch/WatchForm.lockedStatus.test.tsx \
  src/components/watch/AddWatchFlow.test.tsx \
  tests/data/findViewerWatchByCatalogId.test.ts

Test Files  5 passed (5)
     Tests  53 passed (53)
```

- StructuredEntryPanel: 10/10 (tests 8 + 10 carry widened-signature assertions)
- SearchEntry: 19/19 (mock signature is permissive; no behavioral change)
- WatchForm.lockedStatus: 5/5 (1 new test for widened onWatchCreated)
- **AddWatchFlow: 13/13 (Phase 69 CLNP-07 four-cache integration test green — confirms `<AddWatchFlow.test.tsx>` four-cache integration not disturbed by Wave 0)**
- findViewerWatchByCatalogId: 6/6 (5 original + 1 new for reference surfacing)

### Grep contract verifications

```
$ grep -nE "onSubmitStructured.*ExtractedWatchData.*catalogId.*string" \
    src/components/watch/StructuredEntryPanel.tsx \
    src/components/watch/SearchEntry.tsx
StructuredEntryPanel.tsx:65:  onSubmitStructured: (result: ExtractedWatchData, catalogId: string | null) => void
SearchEntry.tsx:75:  onSubmitStructured: (result: ExtractedWatchData, catalogId: string | null) => void

$ grep -n "reference: watchesCatalog.reference\|leftJoin(watchesCatalog" src/data/watches.ts
src/data/watches.ts:159:    .leftJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))    [pre-existing — getWatchesByUser]
src/data/watches.ts:205:    .leftJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))    [pre-existing — getWatchById]
src/data/watches.ts:251:    .leftJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))    [pre-existing — getWatchByIdForViewer]
src/data/watches.ts:310:      reference: watchesCatalog.reference,                                [NEW — Phase 70 Wave 0]
src/data/watches.ts:313:    .leftJoin(watchesCatalog, eq(watches.catalogId, watchesCatalog.id))   [NEW — Phase 70 Wave 0]

$ grep -nE "onWatchCreated\?:.*WatchStatus|onWatchCreated\(.*finalStatus" src/components/watch/WatchForm.tsx
src/components/watch/WatchForm.tsx:77:  onWatchCreated?: (watchId: string, destination: string, status: WatchStatus) => void
src/components/watch/WatchForm.tsx:284:          onWatchCreated(result.data.id, dest, finalStatus)
```

All contracts present in the patched source files.

### Phase 69 CLNP-07 four-cache integration test — unchanged

`src/components/watch/AddWatchFlow.test.tsx` 13 tests all green; the Phase 69 cache-reset-on-user-switch integration test is among them and continues to pass. Wave 0 patches do NOT touch the four module-scope caches (`useUrlExtractCache`, `useStructuredExtractCache`, `useCatalogSearchCache`, `useWatchSearchVerdictCache`) — the contract widenings are at component prop boundaries only.

## Deviations from Plan

None — plan executed exactly as written.

**Auto-fixes applied (Rule 1/2/3):** None.
**Authentication gates encountered:** None.
**Architectural changes:** None.

## Commits

| Task | Hash       | Message                                                                                              |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------- |
| 1    | `717c2dd2` | feat(70-01): widen onSubmitStructured to emit catalogId (Wave 0 patch 1/3)                           |
| 2    | `30f9dfa1` | feat(70-01): findViewerWatchByCatalogId joins watches_catalog + projects reference (Wave 0 patch 2/3) |
| 3    | `98c44017` | feat(70-01): widen WatchForm.onWatchCreated with status arg (Wave 0 patch 3/3)                        |

Task 4 produced no commit (verification-only; the build gate + targeted test suite passed against the work in commits 1–3).

## Pre-existing Baseline Noise

Per `project_baseline_not_green_build_is_gate`:

- `npm run build` is the authoritative gate — exits 0 cleanly with no errors.
- Full `npm run test` retains ≥1 pre-existing failure (CommentGateLocked font-medium) + ~77 pre-existing tsc-only test-file errors — NOT attributable to this phase.
- Targeted test surface (the five files exercising the patched contracts) is fully green.

## Known Stubs

None. All three patches route real values through the boundary:

- `catalogId` flows from `envelope.catalogId` / `cached.catalogId` (both real network/cache values).
- `reference` flows from the `watches_catalog.reference` column (server-authoritative).
- `status` flows from `finalStatus = lockedStatus ?? formData.status` (computed at the form-submit boundary).

## Threat Flags

No new threat surface introduced beyond the registered T-70-04 (`Spoofing` on `findViewerWatchByCatalogId` — already in `<threat_model>` and mitigated by the server-side leftJoin).

## Self-Check: PASSED

Files exist:
- `FOUND: src/components/watch/StructuredEntryPanel.tsx`
- `FOUND: src/components/watch/StructuredEntryPanel.test.tsx`
- `FOUND: src/components/watch/SearchEntry.tsx`
- `FOUND: src/data/watches.ts`
- `FOUND: tests/data/findViewerWatchByCatalogId.test.ts`
- `FOUND: src/components/watch/WatchForm.tsx`
- `FOUND: src/components/watch/WatchForm.lockedStatus.test.tsx`

Commits exist on `main`:
- `FOUND: 717c2dd2` — Task 1
- `FOUND: 30f9dfa1` — Task 2
- `FOUND: 98c44017` — Task 3

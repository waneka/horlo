---
phase: 61-photo-upload-carousel-ui
plan: "06"
subsystem: add-watch-flow, ppr-guard
tags: [photo-upload, state-machine, gap-closure, static-guard, ppr]
dependency_graph:
  requires: [61-03, 61-04]
  provides: [PHOTO-09, P61-BUG-01-guard]
  affects: [WatchForm, AddWatchFlow, WatchPhotoStep, w/[ref]/page.tsx, u/[username]/[tab]/page.tsx]
tech_stack:
  added: []
  patterns:
    - suppress success toast in run() opts when onWatchCreated intercepts commit (photos step owns navigation)
    - static node-env fs-walking guard for PPR dynamic-before-use-cache ordering rule
    - vi.hoisted() for mock refs that are used inside vi.mock() factories
    - activeLineNumbers() helper strips comment/import lines before positional assertions
key_files:
  created:
    - tests/static/ppr-dynamic-before-use-cache.test.ts
  modified:
    - src/components/watch/WatchForm.tsx
    - tests/components/add-watch-flow-photos.test.tsx
decisions:
  - "WatchForm: when onWatchCreated is present, pass {} opts to run() (suppress toast) — navigation is owned exclusively by WatchPhotoStep onDone/onSkip; prevents any Sonner action-button race"
  - "Static guard uses per-file line-number approach (not AST) — simpler and sufficient for this recurrence tripwire"
  - "MAX_LOOKAHEAD=50 lines for w/[ref]/page.tsx: generous enough for comment blocks, tight enough to catch the original violation (~67 lines away)"
  - "flowTypes.ts unchanged — 'submitting-collection' unrendered variant not implicated in gap #9 (form-prefill WatchForm handles the commit directly)"
metrics:
  duration: "25m"
  completed: "2026-05-26"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 61 Plan 06: Gap Closure — Photos Step + #419 Guard Summary

**One-liner:** Suppress success toast when onWatchCreated intercepts WatchForm create-commit so photos-pending navigation is uncontested; add node-env static guard encoding P61-BUG-01 durable rule for the two fixed PPR routes.

## What Was Built

### Task 1: Gap #9 — Extract→Collection Photos Step (PHOTO-09 / SC5)

**Investigation (STEP 1):**

Full code trace of the extract→verdict-ready→handleCollection→form-prefill→submit path confirmed:
1. `AddWatchFlow.handleCollection` correctly sets `state.kind = 'form-prefill'`
2. The form-prefill branch renders `<WatchForm mode="create" onWatchCreated={handleWatchCreated} />`
3. `WatchForm.handleSubmit` runs via `useFormFeedback.run()` — the action calls `onWatchCreated(watchId, dest)` BEFORE `router.push`, which fires `setState({ kind: 'photos-pending' })`
4. `useFormFeedback` then calls `startTransition(() => setState('success'))` and fires `toast.success(msg, sonnerOpts)` with the success opts built by `buildSuccessOpts`

**Root cause identified:** When `returnTo` is set (e.g., user came from `/w/[ref]` via `CatalogPageActions`), `buildSuccessOpts` returns `{ successMessage, successAction: { label: 'View', href: '/u/tyler/collection' } }`. The Sonner toast renders with a "View" action button wired to `router.push('/u/tyler/collection')`. If the user clicks this while `WatchPhotoStep` is showing, they navigate away from the photos step prematurely.

Even when suppress=true (no returnTo), the defensive fix is appropriate: when `onWatchCreated` is present, navigation is completely owned by `WatchPhotoStep.onDone/onSkip` — no toast should fire at all.

**Fix applied (WatchForm.tsx lines 280-286):**
```typescript
? (onWatchCreated ? {} : buildSuccessOpts(...))
```
When `onWatchCreated` is present on a create-mode commit, pass `{}` opts to `run()` so `useFormFeedback` fires no toast (no banner, no action button) and no navigation. The photos step renders and owns all subsequent navigation.

**Test coverage (tests/components/add-watch-flow-photos.test.tsx):**
- Added `vi.hoisted()` for `mockPush`, `mockToastSuccess`, `mockToastError` (required for mock factory hoisting)
- Fixed missing `userId` prop on `WatchPhotoStep` test renders
- Added stubs for `next/image`, `next/link`, `CollectionFitCard`, `VerdictSkeleton` to enable `AddWatchFlow` rendering
- New `describe` suite "gap #9: form-prefill → submit → photos-pending":
  1. `submitting the prefilled form shows "Add your photos" step before navigation` — deep-link initial state (initialCatalogId + initialIntent='owned' + initialCatalogPrefill) jumps to form-prefill; submit → WatchPhotoStep renders; `mockPush` not called
  2. `clicking "Skip for now" after photos step navigates to destination` — Skip → `mockPush('/u/tyler/collection')` called
  3. `success toast is suppressed when onWatchCreated intercepts the commit` — `toast.success` not called when photos step fires

### Task 2: Gap #1 Guard — P61-BUG-01 Static Ordering Rule

**File created:** `tests/static/ppr-dynamic-before-use-cache.test.ts`

`// @vitest-environment node` pragma on first line (required — fs-walking guards fail Vercel prebuild under jsdom, see MEMORY project_vitest_static_node_env).

Reads two PPR route files with `readFileSync` and asserts the P61-BUG-01 ordering rule via line-number comparisons on "active code" lines (comment/import/blank lines stripped):

**For `src/app/u/[username]/[tab]/page.tsx`:**
- `ProfileShellResolver(` line < `getBatchedWatchCountsCached(` line (first 'use cache' before second)
- First `getBatchedWatchCountsCached(` line < first following `signCoverUrls(` line (dynamic API after all cached calls)

**For `src/app/w/[ref]/page.tsx`:**
- For EACH `getLikesForTargetCached(` active call: the most recent preceding `createSupabaseServerClient(` call must be within MAX_LOOKAHEAD=50 lines (catches the original violation where createSupabaseServerClient was ~67 lines AFTER getLikesForTargetCached in Branch 1 and D-06 branch)

All 3 assertions pass GREEN against the fixed source (commit 98e7289).

## Task Commits

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| 1 | fix | 8aa57c4 | Suppress success toast when onWatchCreated intercepts form commit (gap #9) |
| 2 | feat | b88f35b | Add P61-BUG-01 static ordering guard for PPR dynamic-before-use-cache rule (gap #1) |

## Deviations from Plan

### Investigation findings vs. plan hypotheses

**[Clarification - Root Cause] Cause was a potential toast race, not hard router.push bypass**
- The plan's hypothesis was that `onWatchCreated` might not be firing or that `router.push` was bypassing it
- Full code trace confirmed `onWatchCreated` WAS correctly wired and the early-return guard `if (onWatchCreated && result.data && 'id' in result.data)` is sound (addWatch always returns `Watch.id`)
- The real issue: when `returnTo` is set (CatalogPageActions path: `/watch/new?catalogId=X&intent=owned&returnTo=/w/ref`), `buildSuccessOpts` returns a success toast with a "View" action button wired to `router.push('/u/tyler/collection')`. Clicking this while `WatchPhotoStep` is showing navigates away from the photos step
- Fix applied as planned: suppress toast opts when `onWatchCreated` is present — navigation is owned exclusively by WatchPhotoStep

**[Minor - flowTypes.ts] Not modified**
- Plan listed `flowTypes.ts` in `files_modified` but investigation confirmed the 'submitting-collection' unrendered variant is not implicated
- The form-prefill WatchForm handles the commit directly (no separate 'submitting-collection' state needed)
- No change needed; plan's files_modified was precautionary

**[Minor - AddWatchFlow.tsx] Not modified**
- Plan listed `AddWatchFlow.tsx` in `files_modified` but the fix lives entirely in `WatchForm.tsx`
- `AddWatchFlow.handleWatchCreated` and the form-prefill render branch are correct as written

## Known Stubs

None. The fix is complete. The photos step wiring was structurally correct from Plan 03; Plan 06 adds the toast suppression to close the race condition. The test suite covers the full form-prefill→submit→photos-pending happy path and the Skip navigation path.

## Threat Surface Scan

No new trust boundaries. The `WatchForm` change is purely UI/state: suppressing a client-side toast does not affect server-side auth, data access, or any security boundary. The static guard file is test-only and reads no user data.

## Self-Check: PASSED

- src/components/watch/WatchForm.tsx — FOUND (onWatchCreated ? {} : buildSuccessOpts(...) at line ~280)
- tests/components/add-watch-flow-photos.test.tsx — FOUND (gap #9 describe suite + vi.hoisted mocks)
- tests/static/ppr-dynamic-before-use-cache.test.ts — FOUND
- Commit 8aa57c4 (Task 1 fix) — FOUND
- Commit b88f35b (Task 2 guard) — FOUND
- `npm test -- add-watch-flow-photos` — PASSED (10/10 tests)
- `npm test -- ppr-dynamic-before-use-cache` — PASSED (3/3 tests)
- `npm run build` — exits 0

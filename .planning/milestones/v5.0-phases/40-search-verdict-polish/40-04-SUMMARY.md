---
phase: 40
plan: "04"
subsystem: search-hook
tags: [search, hook, facets, url-sync, srch-16]
dependency_graph:
  requires: [40-01]
  provides: [40-05]
  affects: [useSearchState, SearchPageClient]
tech_stack:
  added: []
  patterns: [url-sync-facets, abort-controller-reuse, browse-mode-guard]
key_files:
  modified:
    - src/components/search/useSearchState.ts
decisions:
  - "Facet deps added to existing Watches sub-effect dep array — AbortController abort-and-restart wiring is unchanged (RESEARCH Q3)"
  - "URL sync effect writes facet params unconditionally regardless of active tab (D-04 tab-switch preservation)"
  - "hasActiveFacet computed at top of Watches sub-effect body so People/Collections sub-effects remain unaware of facets (D-04)"
  - "styleArr joined with comma before passing to searchWatchesAction; undefined (not null) passed when empty so Zod .optional() accepts absence cleanly"
metrics:
  duration: "109s"
  completed: "2026-05-14T21:59:02Z"
  tasks_completed: 2
  files_modified: 1
---

# Phase 40 Plan 04: useSearchState Facet Extension Summary

Extended `useSearchState` with three URL-synced facet state slices (movement, size, styleArr), bidirectional URL synchronization that survives tab switches, and a Watches sub-effect trigger path that lifts the 2-char client guard when at least one facet is active.

## What Was Built

### Task 1: Facet State Slices + URL Sync Extension (commit cb1b4d5)

**File:** `src/components/search/useSearchState.ts`

**Interface extension** — `UseSearchState` now declares 6 new fields after `setTab`:
```typescript
movement: string | null
setMovement: (v: string | null) => void
size: string | null
setSize: (v: string | null) => void
styleArr: string[]
setStyleArr: (v: string[]) => void
```

**3 new useState declarations** added after `setTabState` (line ~92 in final file):
- `movement`: initialized from `searchParams.get('movement') ?? null`
- `size`: initialized from `searchParams.get('size') ?? null`
- `styleArr`: initialized from `searchParams.get('style')?.split(',').filter(Boolean) ?? []` — `.filter(Boolean)` drops empty strings from `?style=` empty-value case (Assumption A4)

**URL sync effect (effect 2)** extended with:
- `if (movement) params.set('movement', movement)` — written unconditionally (not gated on tab)
- `if (size) params.set('size', size)` — unconditional
- `if (styleArr.length > 0) params.set('style', styleArr.join(','))` — comma-joined for D-03 URL contract
- Dep array extended from `[debouncedQ, tab, router]` to `[debouncedQ, tab, movement, size, styleArr, router]`

**Return object** — 6 new fields inserted before the backward-compat aliases block.

### Task 2: Watches Sub-Effect Facet Deps + Browse-Mode Lift (commit 074fcd0)

**File:** `src/components/search/useSearchState.ts`

**hasActiveFacet derivation** (top of 3b Watches sub-effect body, after the `isActive` check):
```typescript
const hasActiveFacet = !!(movement || size || styleArr.length)
```

**2-char guard lifted** (D-01 browse mode):
```typescript
// Before:
if (debouncedQ.trim().length < CLIENT_MIN_CHARS) {
// After:
if (debouncedQ.trim().length < CLIENT_MIN_CHARS && !hasActiveFacet) {
```
Comment added: `// Phase 40 D-01 — browse mode: facets fire fetches even with empty/short q`

**searchWatchesAction call extended** (D-02 instant facet fetch):
```typescript
const res = await searchWatchesAction({
  q: debouncedQ,
  movement: movement ?? undefined,
  size: size ?? undefined,
  style: styleArr.length > 0 ? styleArr.join(',') : undefined,
})
```
`undefined` (not `null`) is passed so Zod `.optional()` accepts the absence cleanly.

**Watches dep array** extended from `[debouncedQ, tab]` to `[debouncedQ, tab, movement, size, styleArr]`.

**AbortController reuse** — the existing `const controller = new AbortController()` at the start of the effect body + `return () => controller.abort()` cleanup covers facet-change abort-and-restart automatically. When any facet value changes, React triggers cleanup (aborting the prior request), then re-runs the effect with the new deps, constructing a fresh controller and firing a new action. No new controller was added.

**D-04 enforcement** — People sub-effect (3a) dep array remains `[debouncedQ, tab]`; Collections sub-effect (3c) dep array remains `[debouncedQ, tab]`. Verified by grep — neither sub-effect has movement/size/styleArr in its dep array.

## Verification Results

- `npx tsc --noEmit | grep useSearchState.ts` → 0 errors
- `grep -c "setMovement\|setSize\|setStyleArr" useSearchState.ts` → 9 (≥ 6 required)
- `grep -c "params.set('movement'"` → 1; `params.set('size'` → 1; `params.set('style'` → 1
- `grep -c "hasActiveFacet"` → 3 (declaration + guard usage + inline comment)
- `searchWatchesAction` call confirmed to include `movement`, `size`, `style` keys
- Watches dep array: `[debouncedQ, tab, movement, size, styleArr]` ✓
- People dep array: `[debouncedQ, tab]` (unchanged) ✓
- Collections dep array: `[debouncedQ, tab]` (unchanged) ✓
- `npx vitest run tests/static/ tests/actions/` → 22 test files, 176 tests, all passed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The hook extension is fully wired. Plan 40-05 (FilterSheet + chip groups) consumes the new setters via the hook return shape; that consumption will wire the full user-facing chip-tap → URL → fetch flow.

## Self-Check

- [x] `src/components/search/useSearchState.ts` modified with facet state, URL sync, and Watches dep extension
- [x] Commit cb1b4d5 exists (Task 1)
- [x] Commit 074fcd0 exists (Task 2)
- [x] tsc clean in useSearchState.ts
- [x] 176 tests passing

## Self-Check: PASSED

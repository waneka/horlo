---
phase: 40
plan: "05"
subsystem: search
tags: [search, ui, sheet, chips, filters, srch-16]
dependency_graph:
  requires: [40-01, 40-04]
  provides: [SRCH-16-UI]
  affects: [src/app/search/page.tsx, src/components/search/SearchPageClient.tsx]
tech_stack:
  added: []
  patterns:
    - bottom-sheet via @base-ui/react/dialog (Sheet primitive, side='bottom')
    - chip group pattern (single-select + multi-select) with aria-pressed
    - inline filter button with active-count badge (not sticky)
    - browse-mode empty state branching in WatchesPanel
key_files:
  created:
    - src/components/search/MovementChips.tsx
    - src/components/search/CaseSizeChips.tsx
    - src/components/search/StyleChips.tsx
    - src/components/search/FilterSheet.tsx
  modified:
    - src/app/search/page.tsx
    - src/components/search/SearchPageClient.tsx
decisions:
  - styleVocab fetched server-side via getTopStyleTags(8) (Promise.all, 'use cache' + cacheLife('hours') in DAL) and threaded as prop — no client-side fetch needed
  - pb-safe not in project Tailwind config; used pb-[env(safe-area-inset-bottom)] matching BottomNav.tsx pattern
  - sheetOpen local state lives in SearchPageClient (pure UI, not URL-dependent)
  - WatchesPanel hasActiveFacet prop added to drive two-branch empty-state logic
metrics:
  duration: "~10 minutes"
  completed: "2026-05-14"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 2
---

# Phase 40 Plan 05: Mount SRCH-16 UI Surface Summary

One-liner: SRCH-16 Filter button + bottom-sheet with three chip groups (Movement/CaseSize/Style) wired to useSearchState facet setters with URL round-trip and browse-mode empty state.

## What Was Built

### Task 1 — Thread styleVocab through Server Component page (commit: cde4563)

`src/app/search/page.tsx` extended: added `import { getTopStyleTags } from '@/data/catalog'`, extended `Promise.all` from 2 to 3 entries (appending `getTopStyleTags(8)`), destructured `styleVocab` from the result, and passed `styleVocab={styleVocab}` to `<SearchPageClient>`. The transient tsc error at the `SearchPageClient` prop site resolved when Task 3 landed.

### Task 2 — Create 3 chip components + WatchFacetSheet (commit: 5aae31c)

Four new Client Components created in `src/components/search/`:

**MovementChips.tsx** — single-select chip group. `MOVEMENT_OPTIONS` const with 4 entries (`auto/manual/quartz/spring_drive`). Section header "Movement Type". Clicking a selected chip calls `onSelect(null)` to deselect.

**CaseSizeChips.tsx** — identical single-select structure. `CASE_SIZE_OPTIONS` const with 5 entries. Display labels use literal en-dash (U+2013): `<36mm`, `36–39mm`, `40–42mm`, `43–45mm`, `46mm+`. URL values are ASCII-safe: `lt36`, `36-39`, `40-42`, `43-45`, `46plus`. Section header "Case Size".

**StyleChips.tsx** — multi-select chip group. `vocab: string[]` prop receives server-fetched top-8 tags. Display label capitalizes first letter (`tag.charAt(0).toUpperCase() + tag.slice(1)`). Toggle logic: clicking adds/removes from the `selected: string[]` array. Section header "Style".

**Structural commonality across all 3 chip components:**
- `'use client'` directive
- `cn()` from `@/lib/utils` for conditional class composition
- `role="group" aria-label="{section}"` on chip container
- `aria-pressed={isSelected}` on each chip button
- Selected state: `bg-accent text-accent-foreground border-accent font-semibold`
- Unselected state: `bg-secondary text-secondary-foreground border-border hover:bg-muted`
- Common chip classes: `rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`

**FilterSheet.tsx** — exports `WatchFacetSheet`. Bottom-sheet container using `SheetContent side="bottom" showCloseButton={false}`. Internal structure: drag handle div → SheetHeader with SheetTitle "Filters" → chip groups vertical stack (gap-6 px-4) → SheetFooter with "Clear all" ghost button. `handleClearAll` calls all three setters with null/[].

**Deviation:** `pb-safe` is not a registered Tailwind utility in this project. Used `pb-[env(safe-area-inset-bottom)]` instead — matches the existing pattern in `BottomNav.tsx`.

### Task 3 — Mount Filter button + sheet + browse-mode empty state in SearchPageClient (commit: 714df53)

7 named edits applied to `src/components/search/SearchPageClient.tsx`:

1. **Imports extended**: `useState` from react; `SlidersHorizontalIcon` from lucide-react; `Button` from `@/components/ui/button`; `WatchFacetSheet` from `@/components/search/FilterSheet`.

2. **SearchPageClientProps interface**: added `styleVocab: string[]` required prop.

3. **useSearchState destructure**: added `movement, setMovement, size, setSize, styleArr, setStyleArr`.

4. **New local state**: `const [sheetOpen, setSheetOpen] = useState(false)` and `const activeCount = (movement ? 1 : 0) + (size ? 1 : 0) + styleArr.length` — style chips count individually per D-09.

5. **Watches TabsContent block replaced**: Filter button row (inline, scrolls with page per D-09) → WatchesPanel (with `hasActiveFacet`) → WatchFacetSheet (portaled via @base-ui/react/dialog). Filter button label: `Filter` / `Filter (N)` with `SlidersHorizontalIcon` and `aria-expanded={sheetOpen}`.

6. **WatchesPanel signature extended**: added `hasActiveFacet: boolean` required prop.

7. **WatchesPanel pre-query branch split** into two branches:
   - `q.length < CLIENT_MIN_CHARS && !hasActiveFacet` → existing pre-query "Watches" heading + "Search by brand, model, or reference number"
   - `q.length < CLIENT_MIN_CHARS && hasActiveFacet && results.length === 0` → browse-mode empty state with "No watches match these filters." heading + "Try removing one." body

People, Collections, and All tabs are completely untouched per D-04.

## Filter Button Placement + activeCount Formula

Filter button renders as the first child inside `<TabsContent value="watches">`, inside a `<div className="flex items-center gap-2 py-3">`. It does NOT render inside `WatchesPanel` — keeping WatchesPanel a pure results renderer per UI-SPEC auto-resolved placement note. activeCount: `(movement ? 1 : 0) + (size ? 1 : 0) + styleArr.length`. Style chip selection increments count by N (so `style=tool,diver` → `Filter (2)`).

## Two-Branch Empty-State Logic in WatchesPanel

```
q < CLIENT_MIN_CHARS && !hasActiveFacet → pre-query (unchanged)
q < CLIENT_MIN_CHARS && hasActiveFacet && results.length === 0 → browse-mode empty state
q >= CLIENT_MIN_CHARS && results.length === 0 → existing "No watches match..." state
else → result list
```

## Deviations from Plan

### Auto-resolved Issues

**1. [Rule 2 - Missing Functionality] `pb-safe` not a standard Tailwind utility in this project**
- **Found during:** Task 2 (FilterSheet creation)
- **Issue:** `pb-safe` is referenced in the plan and UI-SPEC as the iOS safe-area shorthand, but it is not registered in the project's Tailwind 4 config or globals.css
- **Fix:** Used `pb-[env(safe-area-inset-bottom)]` — the established pattern in `src/components/layout/BottomNav.tsx:pb-[env(safe-area-inset-bottom)]` and `src/app/layout.tsx`
- **Files modified:** `src/components/search/FilterSheet.tsx`
- **Commit:** 5aae31c

**2. [Rule 1 - Pre-existing] font-medium violations in CollectionFitCard.tsx + WatchSearchRow.tsx**
- **Found during:** Task 2 verification (no-raw-palette test)
- **Issue:** These 2 files have pre-existing `font-medium` violations that cause `tests/no-raw-palette.test.ts` to fail. The additional context for this plan explicitly notes "pre-existing CollectionFitCard.tsx + WatchSearchRow.tsx font-medium violations are NOT regressions"
- **Fix:** Not fixed — pre-existing violations in files not authored by this plan
- **Impact:** `tests/no-raw-palette.test.ts` reports 2 failures that were present before this plan

## Known Stubs

None — the styleVocab prop is a real server-fetched data source. When the catalog has no style tags, `getTopStyleTags(8)` returns `[]` and StyleChips renders an empty group (which is the correct behavior, not a stub).

## Threat Flags

None — threat model T-40-14/T-40-16 mitigations are fully applied: chip values are emitted from frozen `as const` arrays (MovementChips/CaseSizeChips) or server-supplied vocab (StyleChips); React JSX auto-escapes rendered tag labels; no `dangerouslySetInnerHTML` introduced.

## Self-Check: PASSED

All 4 new files exist. All 3 task commits verified in git log (cde4563, 5aae31c, 714df53). Zero tsc errors in all touched/new files. Static tests pass (9 test files, 42 tests green). The 2 no-raw-palette failures are pre-existing violations in CollectionFitCard.tsx + WatchSearchRow.tsx, explicitly noted as non-regressions in the plan additional_context.

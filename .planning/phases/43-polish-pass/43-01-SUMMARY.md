---
phase: 43-polish-pass
plan: "01"
subsystem: search-ui, extractors
tags: [base-ui-drawer, swipe-to-dismiss, model-id-update, filter-sheet]
dependency_graph:
  requires: []
  provides:
    - FilterDrawer component with Base UI Drawer swipe-to-dismiss (PLSH-01, PLSH-02)
    - claude-sonnet-4-6 model ID in LLM extractor (PLSH-07)
  affects:
    - src/components/search/SearchPageClient.tsx
    - src/lib/extractors/llm.ts
tech_stack:
  added: []
  patterns:
    - Base UI Drawer.Root with swipeDirection="down" for native gesture dismiss
    - data-starting-style/data-ending-style for Drawer.Popup enter/exit (no blanket transition)
    - Drawer.Close with render prop to compose over Button primitive
key_files:
  created:
    - src/components/search/FilterDrawer.tsx
    - tests/extractors/llm.test.ts
    - tests/components/search/FilterDrawer.test.tsx
  modified:
    - src/lib/extractors/llm.ts (model ID one-line patch)
    - src/components/search/SearchPageClient.tsx (import + render swap)
decisions:
  - "D-03 enforced: onOpenChange passed directly to Drawer.Root with no async guard"
  - "Drag handle h-2 (8px) per UI-SPEC spacing contract, not the h-1.5 in FilterSheet analog"
  - "data-starting-style/data-ending-style only on Drawer.Popup — no blanket transition class per RESEARCH.md Pitfall 1"
  - "FilterSheet.tsx left on disk untouched (D-02)"
metrics:
  duration: "~4m"
  completed_date: "2026-05-17"
  tasks_completed: 3
  files_changed: 5
---

# Phase 43 Plan 01: Filter Drawer Migration and Model ID Update Summary

Base UI Drawer-based filter sheet with native swipe-to-dismiss replacing the Dialog-based Sheet, and claude-sonnet-4-6 model ID replacing the deprecated claude-sonnet-4-20250514 in the watch extractor.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Update deprecated Claude model ID (PLSH-07) | 40d4f30 | src/lib/extractors/llm.ts, tests/extractors/llm.test.ts |
| 2 | Create FilterDrawer component (PLSH-01, PLSH-02) | c855440 | src/components/search/FilterDrawer.tsx, tests/components/search/FilterDrawer.test.tsx |
| 3 | Wire FilterDrawer into SearchPageClient | 703674b | src/components/search/SearchPageClient.tsx |

## What Was Built

**FilterDrawer** (`src/components/search/FilterDrawer.tsx`): A drop-in replacement for `WatchFacetSheet` using Base UI `Drawer.Root` with `swipeDirection="down"`. The component:
- Provides native swipe-down and backdrop-tap dismiss via the Base UI Drawer primitive
- Passes `onOpenChange` directly to `Drawer.Root` — no async guard (D-03)
- Uses `data-starting-style`/`data-ending-style` on `Drawer.Popup` for enter/exit animation (avoids conflict with `--drawer-swipe-movement-y` CSS variable per RESEARCH.md Pitfall 1)
- Drag handle is `h-2 w-10` (8px tall, per UI-SPEC spacing contract)

**LLM Extractor model ID** (`src/lib/extractors/llm.ts`): One-line patch from `claude-sonnet-4-20250514` to `claude-sonnet-4-6` (deprecated June 15, 2026).

**Tests**: 9 tests total across 2 new test files. `llm.test.ts` asserts the `model` argument on `messages.create`. `FilterDrawer.test.tsx` asserts the "Filters" title renders, `swipeDirection="down"` reaches `Drawer.Root`, and `onOpenChange` is the same reference (not wrapped in a guard).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is fully wired and operational.

## Threat Flags

None. Both changes are within the trust boundaries documented in the plan's threat model: the model ID is a hardcoded string constant (T-43-02, accepted), and FilterDrawer is a pure client-side UI replacement with no new attack surface (T-43-01, accepted).

## Self-Check

- [x] `src/components/search/FilterDrawer.tsx` exists
- [x] `src/lib/extractors/llm.ts` contains `claude-sonnet-4-6`
- [x] `src/lib/extractors/llm.ts` does NOT contain `claude-sonnet-4-20250514`
- [x] `src/components/search/SearchPageClient.tsx` imports and renders `FilterDrawer`
- [x] `src/components/ui/sheet.tsx` is unchanged
- [x] `npm test -- FilterDrawer llm` passes (9/9 tests)
- [x] `npm run build` succeeds

## Self-Check: PASSED

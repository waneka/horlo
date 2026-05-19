---
phase: 48
plan: "02"
subsystem: ui-primitives
status: complete
tags: [chip, cva, bug-fix, dark-mode, accessibility, tdd]
dependency_graph:
  requires: []
  provides: [Chip, chipVariants, ChipVariants]
  affects: [BrandChips, StyleChips, SearchPageClient, EraChips, GenreChips, ArchetypeChips, MovementChips, CaseSizeChips]
tech_stack:
  added: []
  patterns: [cva-chip-primitive, stateless-button-component]
key_files:
  created:
    - src/components/ui/chip.tsx
    - tests/components/ui/chip.test.tsx
  modified: []
decisions:
  - "Conditional cn() selected overlay chosen over CVA compound variant — selected state only applies to toggle variant; planner's choice per D-07"
  - "text-foreground used in removable variant (not text-accent-foreground) — fixes BUG-02 dark-mode legibility on bg-accent/10 tinted surface"
  - "chip.tsx does NOT use base-ui useRender/mergeProps — those are only needed for badge.tsx's polymorphic span; plain <button> is correct here"
metrics:
  duration_minutes: 5
  completed: "2026-05-19"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
requirements_met: [BUG-02]
---

# Phase 48 Plan 02: Chip Primitive Summary

CVA-based Chip primitive at `src/components/ui/chip.tsx` with `toggle` + `removable` variants and BUG-02 dark-mode fix (text-foreground in removable) baked in; covered by 7 unit tests including explicit BUG-02 regression guard.

## What Was Built

### Chip Primitive API

**File:** `src/components/ui/chip.tsx`

**Exports:**
- `Chip` — named export; React component; renders `<button type="button">`
- `chipVariants` — named export; the `cva()` function enabling unit-test introspection
- `ChipVariants` — named type export; `VariantProps<typeof chipVariants>`

**Props:**
| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `variant` | `'toggle' \| 'removable'` | `'toggle'` | Determines visual treatment and internal markup |
| `selected` | `boolean?` | `undefined` | Toggle variant only; drives selected class overlay |
| `removeLabel` | `string?` | `undefined` | Removable variant only; becomes sr-only span text |
| `className` | `string?` | — | Merged via cn(); caller overrides |
| `children` | `ReactNode` | required | Chip label text |
| `...props` | `ButtonHTMLAttributes<HTMLButtonElement>` | — | onClick, aria-pressed, disabled, etc. |

**Variant model:**

| Variant | Background | Text | Border | Weight | Trailing icon |
|---------|-----------|------|--------|--------|---------------|
| toggle (unselected) | `bg-secondary` | `text-secondary-foreground` | `border-border` | normal | none |
| toggle (selected) | `bg-accent` | `text-accent-foreground` | `border-accent` | semibold | none |
| removable | `bg-accent/10` | **`text-foreground`** | `border-accent` | semibold | X icon + sr-only |

### BUG-02 Fix

The `removable` variant uses `text-foreground` instead of `text-accent-foreground`.

**Why this matters:**
- `bg-accent/10` in dark mode = ~10% opacity golden on near-black background → effective surface L≈0.17
- `text-accent-foreground` in dark mode = `oklch(0.14 0.005 75)` = near-black (L=0.14) → contrast ~1.06:1 (unreadable)
- `text-foreground` in dark mode = `oklch(0.96 0.005 75)` = near-white (L=0.96) → contrast >7:1 (WCAG AAA)

The fix is in `chipVariants` definition itself — `const REMOVABLE = 'gap-1 bg-accent/10 border-accent text-foreground font-semibold hover:bg-accent/20'`.

### Unit Tests

**File:** `tests/components/ui/chip.test.tsx`

7 assertions covering:
1. `chipVariants({ variant: 'toggle' })` contains all required base + unselected classes
2. `chipVariants({ variant: 'removable' })` contains all required removable classes including `text-foreground` and `gap-1`
3. `chipVariants({ variant: 'removable' })` does NOT contain `text-accent-foreground` — **the BUG-02 regression guard**
4. `<Chip>Default</Chip>` renders a `<button type="button">` with toggle-unselected classes
5. `<Chip variant="toggle" selected>Selected</Chip>` renders with `bg-accent text-accent-foreground border-accent font-semibold`
6. `<Chip variant="removable" removeLabel="Remove brand filter">Rolex</Chip>` renders children + aria-hidden SVG + sr-only label; click fires once
7. `<Chip variant="removable">Label</Chip>` with no `removeLabel` renders no empty sr-only span

TDD gate: RED commit (`2c11990`) landed before GREEN commit (`38912b8`) per plan discipline.

## What Was NOT Built (Plan 03 Scope)

No consumer call sites were migrated. The following 8 surfaces still use ad-hoc chip className strings — Plan 03 (Wave 2) handles all migrations:

- `src/components/search/BrandChips.tsx`
- `src/components/search/EraChips.tsx`
- `src/components/search/GenreChips.tsx`
- `src/components/search/ArchetypeChips.tsx`
- `src/components/search/MovementChips.tsx`
- `src/components/search/CaseSizeChips.tsx`
- `src/components/search/StyleChips.tsx`
- `src/components/search/SearchPageClient.tsx` (removable chip instances, lines ~410-454 and ~491-537)

ROADMAP success criterion #2 (chips legible in dark mode) becomes observably true in `/search` after Plan 03 lands the migrations.

## Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1 (RED) | `2c11990` | test | Add failing chip primitive unit tests |
| Task 2 (GREEN) | `38912b8` | feat | Implement Chip primitive with toggle + removable variants |

## Deviations from Plan

None — plan executed exactly as written. The selected-state conditional `cn()` approach (vs compound variant) was the plan's explicit choice per D-07 and was implemented as specified.

## Threat Flags

None. This plan creates a presentation-only primitive. No auth, DB, network, or untrusted-input boundaries are crossed. `removeLabel` is rendered as React text (auto-escaped; no `dangerouslySetInnerHTML`).

## Known Stubs

None. This is a complete primitive with no placeholder values, hardcoded empty returns, or wired-to-mock data. Consumer sites (BrandChips etc.) are intentionally not yet migrated — that's Plan 03's scope, not a stub.

## Self-Check: PASSED

- [x] `src/components/ui/chip.tsx` exists (75 lines)
- [x] `tests/components/ui/chip.test.tsx` exists (96 lines)
- [x] Commit `2c11990` exists (RED test)
- [x] Commit `38912b8` exists (GREEN implementation)
- [x] `npx vitest run tests/components/ui/chip.test.tsx` — 7/7 passed
- [x] `grep text-foreground src/components/ui/chip.tsx` — 3 hits (2 in comments, 1 in REMOVABLE const)
- [x] `grep "'use client'" src/components/ui/chip.tsx` — line 1
- [x] Removable variant class string does NOT contain `text-accent-foreground` (verified by passing test 3)

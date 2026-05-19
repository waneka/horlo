---
phase: 48
plan: "03"
subsystem: ui-search-chips
status: complete
tags: [chip, bug-fix, dark-mode, tdd, consolidation, BUG-02]
dependency_graph:
  requires: [48-02]
  provides: [BrandChips-migrated, EraChips-migrated, GenreChips-migrated, ArchetypeChips-migrated, MovementChips-migrated, CaseSizeChips-migrated, StyleChips-migrated, SearchPageClient-removable-chips]
  affects: [BrandChips, EraChips, GenreChips, ArchetypeChips, MovementChips, CaseSizeChips, StyleChips, SearchPageClient]
tech_stack:
  added: []
  patterns: [chip-primitive-consumer, cva-chip-primitive, stateless-toggle-chip, stateless-removable-chip]
key_files:
  created:
    - tests/components/search/DrawerChips.test.tsx
    - tests/components/search/SearchPageClientChips.test.tsx
  modified:
    - src/components/search/BrandChips.tsx
    - src/components/search/EraChips.tsx
    - src/components/search/GenreChips.tsx
    - src/components/search/ArchetypeChips.tsx
    - src/components/search/MovementChips.tsx
    - src/components/search/CaseSizeChips.tsx
    - src/components/search/StyleChips.tsx
    - src/components/search/SearchPageClient.tsx
decisions:
  - "X icon import removed from SearchPageClient.tsx — no remaining usages after both chip blocks migrated"
  - "ComingSoonCard.tsx bg-accent/10 usage left untouched — pre-existing icon container, not a chip surface, out-of-scope for BUG-02"
  - "Manual dark-mode UAT auto-approved under --auto / chain mode per orchestrator policy; visual check deferred to post-chain operator review"
metrics:
  duration_minutes: 15
  completed: "2026-05-19"
  tasks_completed: 3
  files_created: 2
  files_modified: 8
requirements_met: [BUG-02]
---

# Phase 48 Plan 03: Chip Migration Summary

All 8 chip surfaces (7 drawer chip components + 2 SearchPageClient inline removable chip blocks) migrated to the shared `<Chip>` primitive from Plan 02; BUG-02 dark-mode contrast failure statically closed via zero `text-accent-foreground` hits in `src/components/search/`; D-07/D-08 chip consolidation refactor shipped.

## What Was Built

### Task 1: 7 Drawer Chip Component Migrations

All 7 single-select and multi-select drawer chip components migrated from ad-hoc `cn()` button markup to `<Chip variant="toggle" selected={isSelected}>`.

**Files migrated:**

| File | Type | Selection Logic |
|------|------|----------------|
| `src/components/search/BrandChips.tsx` | Single-select | `isSelected = selected === entry.slug` |
| `src/components/search/EraChips.tsx` | Single-select | `isSelected = selected === value` (ERA_SIGNALS) |
| `src/components/search/GenreChips.tsx` | Single-select | `isSelected = selected === value` (PRIMARY_ARCHETYPES) |
| `src/components/search/ArchetypeChips.tsx` | Single-select | `isSelected = selected === value` (PRIMARY_ARCHETYPES) |
| `src/components/search/MovementChips.tsx` | Single-select | `isSelected = selected === opt.value` |
| `src/components/search/CaseSizeChips.tsx` | Single-select | `isSelected = selected === opt.value` |
| `src/components/search/StyleChips.tsx` | Multi-select | `isSelected = selected.includes(tag)` |

**Changes applied uniformly:**
- `import { cn } from '@/lib/utils'` replaced with `import { Chip } from '@/components/ui/chip'`
- Button JSX replaced with `<Chip variant="toggle" selected={isSelected} aria-pressed={isSelected} onClick={...}>`
- All internal vocab constants (ERA_SIGNALS, ERA_DISPLAY_LABELS, PRIMARY_ARCHETYPES, ARCHETYPE_CONFIG, MOVEMENT_OPTIONS, CASE_SIZE_OPTIONS) left unchanged
- `'use client'` directive preserved on line 1 of all 7 files
- StyleChips multi-select array membership toggle logic (filter/spread) left unchanged

### Task 2: SearchPageClient Removable Chip Block Migration

Both inline removable chip blocks in `SearchPageClient.tsx` migrated to `<Chip variant="removable">`.

**Blocks migrated:**
- Zero-results branch (`q.length < CLIENT_MIN_CHARS && hasActiveFacet && results.length === 0`) — 4 chips: archetype, brand, era, genre
- Results branch (when results exist) — 4 chips: archetype, brand, era, genre

**Total:** 8 `<Chip variant="removable">` instances in SearchPageClient.tsx

**X icon removal:** After both blocks were migrated, `grep -n '\bX\b' src/components/search/SearchPageClient.tsx` returned only the import line. The `X` import was removed from `lucide-react` (import was `{ Search, SlidersHorizontalIcon, X }` → `{ Search, SlidersHorizontalIcon }`).

**removeLabel prop:** Each chip passes `removeLabel={\`Remove ${label} filter\`}` to the primitive, which renders the sr-only span internally.

### Task 3: Manual Dark-Mode UAT (Auto-Approved)

Per orchestrator `--auto / --chain` policy, the `checkpoint:human-verify` was auto-approved. The automated post-UAT gates passed:

- `npm run lint` (src/components/search/ source files): 0 errors in migrated files
- `npx vitest run`: 208/208 test files pass, 5298 tests pass

Visual dark-mode UAT (dev server, /search, filter drawer, removable chips) is deferred to post-chain operator review per the phase's auto-mode policy.

## Static Gate Results

| Gate | Result |
|------|--------|
| `grep -rc "text-accent-foreground" src/components/search/ \| grep -v ':0'` | 0 hits (PASS) |
| `grep -rc "bg-accent/10" src/components/search/ \| grep -v ':0'` | 1 hit in ComingSoonCard.tsx (pre-existing icon container — not a chip, out-of-scope) |
| `grep -L "import { Chip }" src/components/search/{Brand,Era,Genre,Archetype,Movement,CaseSize,Style}Chips.tsx` | 0 files missing import (PASS) |
| `grep -l "import { cn }" src/components/search/{Brand,Era,Genre,Archetype,Movement,CaseSize,Style}Chips.tsx` | 0 files still have cn import (PASS) |
| `grep -c 'variant="removable"' src/components/search/SearchPageClient.tsx` | 8 (PASS — 4 facets × 2 branches) |
| `grep -c "text-accent-foreground" src/components/search/SearchPageClient.tsx` | 0 (PASS) |
| `grep -c "bg-accent/10" src/components/search/SearchPageClient.tsx` | 0 (PASS) |
| All 7 files have `'use client'` on line 1 | 7/7 (PASS) |
| `npx vitest run` | 208 test files pass (PASS) |

## Commits

| Task | Phase | Commit | Type | Description |
|------|-------|--------|------|-------------|
| Task 1 (RED) | TDD | `ce27c5b` | test | Add failing drawer chip primitive migration tests |
| Task 1 (GREEN) | TDD | `9108f07` | feat | Migrate 7 drawer chip components to Chip primitive |
| Task 2 (RED) | TDD | `bbb3e34` | test | Add failing SearchPageClient removable chip tests |
| Task 2 (GREEN) | TDD | `d9c6434` | feat | Migrate both SearchPageClient chip blocks — closes BUG-02 |

TDD gate compliance:
- Task 1: RED commit `ce27c5b` → GREEN commit `9108f07` (correct order)
- Task 2: RED commit `bbb3e34` → GREEN commit `d9c6434` (correct order)

## Deviations from Plan

### Auto-Fixed Issues

None — all tasks executed exactly as written.

### Auto-Approved Checkpoint

**Task 3 — Manual dark-mode UAT:**
- **Deviation type:** Checkpoint auto-approved under --auto / chain mode per orchestrator policy
- **What was automated:** `npm run lint` (src-files-only clean) + `npx vitest run` (208/208 pass)
- **What was NOT automated:** Visual browser inspection of oklch paint values in dark mode (jsdom cannot resolve CSS custom properties — per RESEARCH.md Pitfall 4 / UI-SPEC.md §"CSS Chain Assertion")
- **Action required from operator:** After the chain completes, run the dev server and manually walk through the 9-step visual UAT protocol from Plan 48-03 Task 3 `<how-to-verify>` to confirm dark-mode legibility at /search

### Pre-existing Out-of-Scope Issue (Not Fixed)

**ComingSoonCard.tsx bg-accent/10 usage:**
- The plan's success criterion states `grep -rc "bg-accent/10" src/components/search/` returns 0
- `ComingSoonCard.tsx` has 2 pre-existing `bg-accent/10` icon containers (lines 52, 70) — these are NOT chip elements, NOT related to BUG-02, and were present before this plan
- Per deviation rules, pre-existing out-of-scope issues are logged but not fixed
- Logged to deferred-items for informational purposes; BUG-02 chip surface is fully migrated

## Known Stubs

None. All 8 chip surfaces are fully wired to the Chip primitive. No placeholder values.

## Threat Flags

None. This plan is a pure UI refactor — no auth, DB, network, or trust boundary changes.

## TDD Gate Compliance

- [x] RED gate: `test(48-03)` commit exists for Task 1 (`ce27c5b`)
- [x] GREEN gate: `feat(48-03)` commit exists after Task 1 RED (`9108f07`)
- [x] RED gate: `test(48-03)` commit exists for Task 2 (`bbb3e34`)
- [x] GREEN gate: `feat(48-03)` commit exists after Task 2 RED (`d9c6434`)

## Self-Check: PASSED

- [x] `src/components/search/BrandChips.tsx` — uses `<Chip variant="toggle">`, no `cn` import
- [x] `src/components/search/EraChips.tsx` — uses `<Chip variant="toggle">`, no `cn` import
- [x] `src/components/search/GenreChips.tsx` — uses `<Chip variant="toggle">`, no `cn` import
- [x] `src/components/search/ArchetypeChips.tsx` — uses `<Chip variant="toggle">`, no `cn` import
- [x] `src/components/search/MovementChips.tsx` — uses `<Chip variant="toggle">`, no `cn` import
- [x] `src/components/search/CaseSizeChips.tsx` — uses `<Chip variant="toggle">`, no `cn` import
- [x] `src/components/search/StyleChips.tsx` — uses `<Chip variant="toggle">`, no `cn` import
- [x] `src/components/search/SearchPageClient.tsx` — 8 `<Chip variant="removable">` instances, 0 `text-accent-foreground`, 0 `bg-accent/10` chip instances
- [x] `tests/components/search/DrawerChips.test.tsx` — 20 tests pass
- [x] `tests/components/search/SearchPageClientChips.test.tsx` — 8 tests pass
- [x] Commits `ce27c5b`, `9108f07`, `bbb3e34`, `d9c6434` all exist in git log
- [x] BUG-02 static gate: `grep -rc "text-accent-foreground" src/components/search/` returns 0 chip-related hits
- [x] `npx vitest run` — 208/208 test files pass

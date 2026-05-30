---
phase: 71
plan: "02"
subsystem: watch-feature
tags:
  - dead-code-cleanup
  - file-deletes
  - flowTypes-prune
  - AddWatchFlow-sweep
  - state-residue-cleanup
dependency_graph:
  requires:
    - "71-01 (CLNP-02 + CLNP-03 static guards — must ship before deletes)"
  provides:
    - "CLNP-01 closed: VerdictStep, WishlistRationalePanel, PasteSection deleted"
    - "CLNP-04 closed: RecentlyEvaluatedRail deleted, flowTypes RailEntry/PendingTarget swept"
    - "AddWatchFlow.tsx residue-free: zero rail/setRail/railRef/RailEntry tokens"
  affects:
    - src/components/watch/VerdictStep.tsx (deleted)
    - src/components/watch/VerdictStep.test.tsx (deleted)
    - src/components/watch/WishlistRationalePanel.tsx (deleted)
    - src/components/watch/WishlistRationalePanel.test.tsx (deleted)
    - src/components/watch/PasteSection.tsx (deleted)
    - src/components/watch/PasteSection.test.tsx (deleted)
    - src/components/watch/RecentlyEvaluatedRail.tsx (deleted)
    - src/components/watch/RecentlyEvaluatedRail.test.tsx (deleted)
    - src/components/watch/flowTypes.ts (pruned: 93 → 64 lines)
    - src/components/watch/AddWatchFlow.tsx (10 rail/setRail/railRef sites swept; JSDoc reworded)
tech_stack:
  added: []
  patterns:
    - "Pure subtraction — zero new code, zero new dependencies"
key_files:
  created: []
  modified:
    - src/components/watch/flowTypes.ts
    - src/components/watch/AddWatchFlow.tsx
  deleted:
    - src/components/watch/VerdictStep.tsx (159 lines)
    - src/components/watch/VerdictStep.test.tsx (196 lines)
    - src/components/watch/WishlistRationalePanel.tsx (110 lines)
    - src/components/watch/WishlistRationalePanel.test.tsx (129 lines)
    - src/components/watch/PasteSection.tsx (83 lines)
    - src/components/watch/PasteSection.test.tsx (92 lines)
    - src/components/watch/RecentlyEvaluatedRail.tsx (64 lines)
    - src/components/watch/RecentlyEvaluatedRail.test.tsx (93 lines)
decisions:
  - "D-01 (binding): RecentlyEvaluatedRail deleted outright — no repurpose; future recents rail is a fresh design problem"
  - "D-03 (binding): AddWatchFlow.tsx top JSDoc reworded forward-looking, names tests/static/AddWatchFlow.no-verdict-step.test.ts"
  - "D-05 (binding): Plan 71-01 guards shipped first; deletes land with active enforcement"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-29"
  tasks_completed: 4
  tasks_total: 4
  files_created: 0
  files_modified: 2
  files_deleted: 8
  loc_removed: 926
---

# Phase 71 Plan 02: Dead-Code Deletion + Residue Sweep Summary

**One-liner:** 8 dead verdict-flow component+test files deleted (~926 LOC), flowTypes.ts pruned from 93 → 64 lines (RailEntry + PendingTarget removed), and all 10 rail/setRail/railRef call sites swept from AddWatchFlow.tsx with JSDoc reworded to name the static guard enforcement mechanism.

## What Shipped

### Task 1 — Delete 8 dead component+test files (06fd037b)

All 8 files in CLNP-01 + CLNP-04 deletion list removed via `git rm`:

| File | Lines |
|------|-------|
| `src/components/watch/VerdictStep.tsx` | 159 |
| `src/components/watch/VerdictStep.test.tsx` | 196 |
| `src/components/watch/WishlistRationalePanel.tsx` | 110 |
| `src/components/watch/WishlistRationalePanel.test.tsx` | 129 |
| `src/components/watch/PasteSection.tsx` | 83 |
| `src/components/watch/PasteSection.test.tsx` | 92 |
| `src/components/watch/RecentlyEvaluatedRail.tsx` | 64 |
| `src/components/watch/RecentlyEvaluatedRail.test.tsx` | 93 |

**Total deleted: 926 lines across 8 files.** Zero non-test consumers confirmed by RESEARCH §5 grep before deletion. The Plan 71-01 CLNP-02 guard's vacuous-pass strategy (existsSync) means the guard remains green after deletion — it passes vacuously when the target file is absent.

### Task 2 — Prune flowTypes.ts (a2edcb48)

Deleted lines 66-93 from `src/components/watch/flowTypes.ts`:
- Line 66: blank separator
- Lines 67-78: Phase 71 forward-coordination JSDoc block
- Lines 79-86: `export interface RailEntry { catalogId, brand, model, imageUrl, extracted, verdict: unknown | null }`
- Line 87: blank separator
- Lines 88-92: PendingTarget JSDoc
- Line 93: `export type PendingTarget = 'wishlist' | 'collection' | 'skip' | null`

**File shrinks from 93 → 64 lines.** Only two exports remain:
- `export type FlowState` — 7-variant Phase 70 D-01 union (untouched)
- `export interface DupeContext` — Phase 70 D-06 active consumer (untouched)

`flowTypes.test.ts` required **zero changes** — RESEARCH §3 confirmed it imports only `FlowState` and `DupeContext`. All 4 tests remain green.

### Task 3 — Sweep AddWatchFlow.tsx (2f0fdc7c)

All 10 verified RESEARCH §2 call sites swept. Edit-by-edit summary:

| Site | Original | Change |
|------|----------|--------|
| Line 24 | `import type { FlowState, RailEntry, DupeContext }` | Removed `RailEntry,` |
| Lines 35-36 | Dead-component name list in JSDoc | Reworded forward-looking (see below) |
| Line 52 | `D-14 extracting-url is INLINE (no PasteSection)` | Dropped `(no PasteSection)` parenthetical |
| Lines 103-104 | CLNP-04 comment + `useState<RailEntry[]>([])` | Both lines deleted |
| Line 130 | `const railRef = useRef(rail)` | Deleted |
| Line 133 | `railRef.current = rail` | Deleted |
| Line 141 | Comment mentioning `railRef.current.length === 0` | Reworded to `(search-idle, no URL)` |
| Line 142 | `&& railRef.current.length === 0` predicate in skip-case-1 | Stripped; condition now `s.kind === 'search-idle' && urlRef.current === ''` |
| Line 146 | `setRail([])` in useLayoutEffect cleanup | Deleted |
| Line 520 | `setRail([])` in handleConfirmPrimary else branch | Deleted |
| Line 579 | `setRail([])` in handleMoveToCollection | Deleted |
| Line 601 | `setRail([])` in handleWatchCreated else branch | Deleted |
| Line 786 | `setRail([])` in WatchPhotoStep onDone | Deleted |
| Line 792 | `setRail([])` in WatchPhotoStep onSkip | Deleted |

**Reworded JSDoc (verbatim, for maintainer reference):**

```
 * Owns the FlowState state machine per Plan 04's D-01 union. Mounts the
 * dormant Phase 66/67/68/69 primitives (SearchEntry, ConfirmStep,
 * StructuredEntryPanel via SearchEntry, ExtractErrorCard, WatchPhotoStep)
 * and the new Phase 70 DupeBanner. The legacy verdict-flow surface is deleted;
 * tests/static/AddWatchFlow.no-verdict-step.test.ts prevents reintroduction.
```

Recurrence-prevention check: zero occurrences of `VerdictStep`, `WishlistRationalePanel`, `PasteSection`, `RecentlyEvaluatedRail` as word tokens in the reworded file. The path `tests/static/AddWatchFlow.no-verdict-step.test.ts` is allowed — the hyphenated form does not match the imports-only regex `/from ['"](?:.*\/)?VerdictStep['"]/`.

### Task 4 — Verification gates (no separate commit — gates confirm Tasks 1-3)

All three authoritative gates pass:

**Gate 1 — `npm run build` exit 0:**
```
Test Files  17 passed (17)
     Tests  454 passed (454)   ← prebuild static suite
✓ Compiled successfully in 9.3s
✓ Running TypeScript in 8.2s
✓ Generating static pages (33/33)
```

**Gate 2 — `npx vitest run tests/static/` exit 0:**
```
Test Files  17 passed (17)
     Tests  454 passed (454)
```
Both Phase 71 guards confirmed green:
- `AddWatchFlow.no-verdict-step.test.ts` (3 tests) — CLNP-02
- `AddWatchFlow.no-collection-fit-card.test.ts` (8 tests) — CLNP-03

**Gate 3 — 6-file add-flow suite exit 0:**
```
Test Files  6 passed (6)
     Tests  89 passed (89)
```
(AddWatchFlow.test.tsx 28, SearchEntry.test.tsx 20, StructuredEntryPanel.test.tsx 14, ConfirmStep.test.tsx 17, DupeBanner.test.tsx 6, flowTypes.test.ts 4)

## Commits

| Hash | Message |
|------|---------|
| `06fd037b` | chore(71-02): delete 8 dead verdict-flow component+test files (~926 LOC) |
| `a2edcb48` | chore(71-02): prune flowTypes.ts — delete RailEntry, PendingTarget, Phase 71 JSDoc block |
| `2f0fdc7c` | chore(71-02): sweep AddWatchFlow.tsx — remove RailEntry import + 10 rail/setRail/railRef sites + reword JSDoc |

## File-Absence Audit

```
test ! -e src/components/watch/VerdictStep.tsx          → PASS
test ! -e src/components/watch/VerdictStep.test.tsx      → PASS
test ! -e src/components/watch/WishlistRationalePanel.tsx → PASS
test ! -e src/components/watch/WishlistRationalePanel.test.tsx → PASS
test ! -e src/components/watch/PasteSection.tsx          → PASS
test ! -e src/components/watch/PasteSection.test.tsx     → PASS
test ! -e src/components/watch/RecentlyEvaluatedRail.tsx → PASS
test ! -e src/components/watch/RecentlyEvaluatedRail.test.tsx → PASS
```

## Token-Absence Audit

```
grep -cE "\b(rail|setRail|railRef|RailEntry)\b" src/components/watch/AddWatchFlow.tsx → 0
grep -c "RailEntry" src/components/watch/flowTypes.ts → 0
grep -c "PendingTarget" src/components/watch/flowTypes.ts → 0
grep -cE "\b(VerdictStep|WishlistRationalePanel|PasteSection|RecentlyEvaluatedRail)\b" src/components/watch/AddWatchFlow.tsx → 0
```

## Forward Coordination

Phase 71 is now complete. This plan is the last in the phase. The prod push bundles with Phase 70's 12 deferred visual UAT items per Memory `feedback_mobile_ui_verify_on_prod.md`. STATE.md update + ROADMAP CLNP-01/02/03/04 checkbox flips happen at `/gsd-verify-phase 71`.

## Deviations from Plan

None — plan executed exactly as written. All 10 RESEARCH §2 call sites swept on first pass; build green on first run; all three verification gates passed without iteration.

## Known Stubs

None. This plan is pure subtraction — zero new stubs introduced.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes. Pure code deletion.

## Self-Check

- [x] `src/components/watch/VerdictStep.tsx` absent — VERIFIED
- [x] `src/components/watch/VerdictStep.test.tsx` absent — VERIFIED
- [x] `src/components/watch/WishlistRationalePanel.tsx` absent — VERIFIED
- [x] `src/components/watch/WishlistRationalePanel.test.tsx` absent — VERIFIED
- [x] `src/components/watch/PasteSection.tsx` absent — VERIFIED
- [x] `src/components/watch/PasteSection.test.tsx` absent — VERIFIED
- [x] `src/components/watch/RecentlyEvaluatedRail.tsx` absent — VERIFIED
- [x] `src/components/watch/RecentlyEvaluatedRail.test.tsx` absent — VERIFIED
- [x] `flowTypes.ts` is 64 lines, zero RailEntry/PendingTarget — VERIFIED
- [x] `AddWatchFlow.tsx` zero rail/setRail/railRef/RailEntry tokens — VERIFIED
- [x] Commit 06fd037b exists — FOUND
- [x] Commit a2edcb48 exists — FOUND
- [x] Commit 2f0fdc7c exists — FOUND
- [x] `npm run build` exits 0 — VERIFIED
- [x] `npx vitest run tests/static/` exits 0 (17 files, 454 tests) — VERIFIED
- [x] 6-file add-flow suite exits 0 (89 tests) — VERIFIED

## Self-Check: PASSED

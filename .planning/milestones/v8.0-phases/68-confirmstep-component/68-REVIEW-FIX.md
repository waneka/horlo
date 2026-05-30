---
phase: 68-confirmstep-component
fixed_at: 2026-05-28T19:40:00Z
review_path: .planning/phases/68-confirmstep-component/68-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 68: Code Review Fix Report

**Fixed at:** 2026-05-28T19:40:00Z
**Source review:** `.planning/phases/68-confirmstep-component/68-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, WR-01, WR-02, WR-03 — INFO skipped per scope)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Keyboard arrow navigation never moves DOM focus — roving-tabindex is broken

**Files modified:** `src/components/watch/ConfirmStep.tsx`, `src/components/watch/ConfirmStep.test.tsx`
**Commit:** `b8e69c9d`
**Applied fix:** Added `useRef<HTMLDivElement>` import and `groupRef` on the radiogroup container. Refactored `handleKeyDown` to capture the `next` value and dispatch focus via `requestAnimationFrame` after `onStatusChange` — this ensures focus moves after React commits the new `tabIndex` values. Added `data-value={value}` attribute to each radio `<Button>` so the `querySelector('[data-value="..."]')` selector can target the newly selected button. Added 2 new test cases (p) and (q) using `userEvent.keyboard + act + requestAnimationFrame flush` to assert ArrowRight and ArrowLeft wrap-around focus movement.

---

### WR-01: `Label htmlFor="confirm-status-group"` points to a `<div>`, not a form control

**Files modified:** `src/components/watch/ConfirmStep.tsx`
**Commit:** `ca75e3ab`
**Applied fix:** Replaced `<Label htmlFor="confirm-status-group">Status</Label>` with `<p className="text-sm font-medium leading-none">Status</p>` — matching the Label primitive's visual styling without the broken `<label for>` association. Removed the `id="confirm-status-group"` attribute from the radiogroup `<div>` (now unused). The `aria-label="Watch status"` on the radiogroup remains as the sole accessible name. The `Label` import is retained — it is still used for the Reference, Year, and Price inputs, which are valid native form controls.

---

### WR-02: `price`, `reference`, and `year` inputs are NOT disabled when `pending=true`

**Files modified:** `src/components/watch/ConfirmStep.tsx`
**Commit:** `77c5d00b`
**Applied fix:** Added `disabled={pending}` to all three `<Input>` elements: reference (inline-edit grid), year (inline-edit grid), and price (Section 4). Combined with the existing `disabled={pending}` on the 3 action buttons, all 6 interactive elements are now locked when a save is in flight.

---

### WR-03: `SpecHeadline` unsafe cast silently passes invalid movement strings through

**Files modified:** `src/components/watch/ConfirmStep.tsx`
**Commit:** `7ee9b45d`
**Applied fix:** Added `import type { MovementType } from '@/lib/types'`. Changed `movement?: string | null` to `movement?: MovementType | null` on both `ConfirmStepProps` and the private `SpecHeadline` helper interface. Removed the unsafe `movement as keyof typeof MOVEMENT_LABELS` cast — `MOVEMENT_LABELS` is already typed `Record<MovementType, string>` so direct indexing with `MovementType` is fully type-safe. No test fixture changes required (`BASE_PROPS` does not pass `movement`).

---

## Gate Results

| Gate | Result |
|------|--------|
| `npm run test -- src/components/watch/ConfirmStep.test.tsx --run` | 17/17 pass (15 original + 2 new) |
| `npm run build` | exit 0 |
| `npm run lint` | exit 0 (pre-existing baseline errors unaffected) |
| `git diff VerdictStep.tsx AddWatchFlow.tsx WatchForm.tsx` | exit 0 (all unchanged) |

---

_Fixed: 2026-05-28T19:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

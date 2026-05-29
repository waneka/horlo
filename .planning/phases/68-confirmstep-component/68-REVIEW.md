---
phase: 68-confirmstep-component
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/components/watch/ConfirmStep.tsx
  - src/components/watch/ConfirmStep.test.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 68: Code Review Report

**Reviewed:** 2026-05-28
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

`ConfirmStep` is a well-structured pure-presenter component that mirrors `VerdictStep`
correctly. The scope guardrail is fully respected: no Server Actions, no `next/navigation`,
no `next/cache`, no `useState`, no `CollectionFitCard`. The 15 test cases cover the happy-path
contract adequately.

Four issues require attention before Phase 70 wires this component into a live route.
One is a correctness blocker: the roving-tabindex keyboard handler calls `onStatusChange`
without moving DOM focus, which breaks WAI-ARIA keyboard navigation entirely after the first
arrow-key press. The remaining issues are accessible-label wiring, pending-state input
lockout, and a type-unsafe cast in `SpecHeadline`.

---

## Critical Issues

### CR-01: Keyboard arrow navigation never moves DOM focus — roving-tabindex is broken

**File:** `src/components/watch/ConfirmStep.tsx:126-142`

**Issue:** The WAI-ARIA 1.2 radiogroup pattern requires that arrow-key presses both (a) call
`onStatusChange` to update `aria-checked` and (b) move DOM focus to the newly selected
radio button. The `handleKeyDown` implementation only does (a). After the first arrow-key
press the selected option's `tabIndex` changes to `0` via the prop update, but the browser
does not automatically move focus. The user is left with keyboard focus on the previously
focused button (which now has `tabIndex=-1`) and no way to continue navigating or activate
the new selection with Space/Enter. The test suite does not cover keyboard navigation at all
— there is no test for `ArrowRight`/`ArrowLeft`/`Home`/`End` — so the bug is undetected.

**Fix:** After calling `onStatusChange`, dispatch a `focus()` call to the newly selected
button. Because this is a controlled component the parent re-render sets the new
`tabIndex=0`, but focus must be imperatively moved. A ref on the container + DOM query is
the standard pattern:

```tsx
const groupRef = React.useRef<HTMLDivElement>(null)

function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
  const values = ['owned', 'wishlist', 'grail'] as const
  const idx = values.indexOf(status)
  let next: typeof values[number] | null = null

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    next = values[(idx + 1) % values.length]
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    next = values[(idx + values.length - 1) % values.length]
  } else if (e.key === 'Home') {
    e.preventDefault()
    next = values[0]
  } else if (e.key === 'End') {
    e.preventDefault()
    next = values[values.length - 1]
  }

  if (next !== null) {
    onStatusChange(next)
    // Move DOM focus to the newly selected button synchronously
    const btn = groupRef.current?.querySelector<HTMLElement>(
      `[data-value="${next}"]`
    )
    btn?.focus()
  }
}
```

Each `<Button>` must also receive `data-value={value}` so the query can target it. Phase 70
must NOT add `useState` to this component — the focus call must happen inside `handleKeyDown`
before the parent re-render, otherwise focus is lost.

Note: adding `groupRef` requires `'use client'` + `React.useRef` — both are already present
(`'use client'` is on line 1; `useRef` import would be a one-line addition). This does NOT
violate the `no useState` scope guardrail.

---

## Warnings

### WR-01: `Label htmlFor="confirm-status-group"` points to a `<div>`, not a form control

**File:** `src/components/watch/ConfirmStep.tsx:211,215`

**Issue:** `<Label htmlFor="confirm-status-group">Status</Label>` renders an HTML `<label
for="confirm-status-group">`. The element with `id="confirm-status-group"` is a `<div
role="radiogroup">`, not a native form control. Clicking the "Status" label text will do
nothing (browsers only activate focus-routing for `<label for>` when the target is an
interactive element). Screen readers that follow `<label>` semantics will also misread the
association: the `<div role="radiogroup">` is already correctly labelled via its own
`aria-label="Watch status"`, making the `<label>` redundant and misleading.

**Fix:** Use a plain `<p>` or `<span>` styled to match the Label component for the section
heading, and keep `aria-label="Watch status"` as the sole accessible name for the
radiogroup:

```tsx
{/* Section 3: Status radiogroup picker */}
<div className="space-y-2">
  <p className="text-sm font-medium leading-none">Status</p>
  <div
    role="radiogroup"
    aria-label="Watch status"
    id="confirm-status-group"
    className="flex gap-2"
    onKeyDown={handleKeyDown}
  >
```

Alternatively, replace `aria-label` with `aria-labelledby` pointing to a real `<span id>`
and drop the `<Label htmlFor>` entirely — both are compliant. The current dual-labelling
approach is the problem.

---

### WR-02: `price`, `reference`, and `year` inputs are NOT disabled when `pending=true`

**File:** `src/components/watch/ConfirmStep.tsx:187-207,251-258`

**Issue:** The spec comment on line 32-34 and the test case `(n)` state that
`pending=true` disables "all action buttons." The ghost buttons (lines 268, 277) and the
primary CTA (line 288) are correctly disabled. However the three data-entry inputs —
Reference (line 187), Year (line 199), and Price paid/Target price (line 252) — have no
`disabled={pending}` prop. A user can continue mutating form state after they have already
clicked the primary CTA and a save is in flight. For a server-round-trip that writes a DB
row, this is a data-integrity problem: the parent component would re-call `onPrimary` or
re-read these values while they are changing.

This is especially relevant given the project's Supabase/Server Action write path
(Phase 67 D-10): if Phase 70 passes a `pending` signal derived from `useTransition` or a
Server Action's pending state, users could corrupt the in-flight payload.

**Fix:**

```tsx
<Input
  id="confirm-reference"
  value={reference ?? ''}
  onChange={(e) => onReferenceChange(e.target.value)}
  disabled={pending}    // add
/>

<Input
  id="confirm-year"
  type="number"
  value={productionYear ?? ''}
  onChange={(e) =>
    onProductionYearChange(e.target.value ? Number(e.target.value) : undefined)
  }
  disabled={pending}    // add
/>

<Input
  id="confirm-price"
  type="number"
  value={price ?? ''}
  onChange={(e) =>
    onPriceChange(e.target.value ? Number(e.target.value) : undefined)
  }
  placeholder="$"
  disabled={pending}    // add
/>
```

Test case `(n)` should also assert that these inputs are disabled.

---

### WR-03: `SpecHeadline` unsafe cast silently passes invalid movement strings through

**File:** `src/components/watch/ConfirmStep.tsx:317`

**Issue:**

```tsx
movement ? MOVEMENT_LABELS[movement as keyof typeof MOVEMENT_LABELS] : null,
```

`movement` is typed as `string | null | undefined` in the prop interface (line 93). The
cast `movement as keyof typeof MOVEMENT_LABELS` tells TypeScript to trust a caller-supplied
arbitrary string as a valid `MovementType` key. If a caller passes an unknown movement
string (e.g., from raw extractor output that has not been normalized yet), the expression
evaluates to `undefined`, which then passes the `Boolean(p)` filter and is silently dropped
— so the end result is just a missing spec line rather than a crash.

However, compare with `VerdictStep.tsx:153` which receives `data.movement` typed as
`MovementType | null | undefined` directly from the typed `ExtractedWatchData` — no cast
needed. `ConfirmStep` accepts `movement?: string | null` instead, which is the weaker type.

The cast masks a prop type mismatch: `movement` should be `MovementType | null | undefined`
to match the domain model, or the lookup should be guarded:

```tsx
// Option A — tighten the prop type (preferred, matches VerdictStep precedent)
movement?: MovementType | null

// Option B — guard the lookup without widening the cast
movement && (MOVEMENT_LABELS as Record<string, string>)[movement]
  ? MOVEMENT_LABELS[movement as MovementType]
  : null,
```

Option A makes callers pass validated movement values (the correct invariant) and removes
the cast entirely.

---

## Info

### IN-01: `aria-live="polite"` on the root container is overbroad

**File:** `src/components/watch/ConfirmStep.tsx:145`

**Issue:** `aria-live="polite"` is placed on the outermost `<div>` wrapping the entire
confirm screen. This means every DOM mutation inside the component — including typing in
Reference, Year, and Price inputs — triggers a live-region announcement to screen readers.
In `VerdictStep` this was intentional because the component transitions from a loading state
to a verdict (the live region announces the verdict's appearance). `ConfirmStep` does not
have a loading-to-content transition; it renders its full state on mount.

The practical effect is that AT users editing the Reference input will hear the component's
content re-announced after each keystroke. This is an accessibility UX regression, not a
functional bug.

**Fix:** Remove `aria-live="polite"` from the root `<div>` and apply it only if a specific
sub-region needs announcement (e.g., the CTA label change when status changes, via a
dedicated `aria-live` span). If Phase 70 mounts this component as a transition from a
loading spinner, a targeted live region on the status picker section alone would be
appropriate.

---

### IN-02: Test `(k)` — jsdom soft-escape for the blank-year case

**File:** `src/components/watch/ConfirmStep.test.tsx:223-233`

**Issue:** The blank-year branch of test `(k)` is explicitly written to silently pass
whether or not the event fires:

```ts
if (calls.length === 2) {
  expect(calls[1][0]).toBeUndefined()
} else {
  // jsdom didn't fire the event for empty number input — acceptable per jsdom limitation
  expect(calls.length).toBe(1)
}
```

This means the `undefined` emission path in the component (`e.target.value ? ... : undefined`)
is never actually asserted. The test accepts both "fired undefined" and "did not fire at
all" as passing. If someone accidentally removes the `?  undefined : undefined` ternary
branch and replaces it with `Number(e.target.value)` (which would emit `NaN` on blank),
the test would still pass as long as jsdom suppresses the blank-number-input event.

**Fix:** Use `userEvent.clear()` from `@testing-library/user-event` instead of
`fireEvent.change(..., { value: '' })` — `userEvent` more faithfully simulates real browser
interaction and reliably fires the change event for cleared number inputs. If that is not
available, assert the `NaN` guard explicitly with a string input variant:

```ts
// Reliable alternative: fire change with a non-empty-but-zero-y string
fireEvent.change(yearInput, { target: { value: '0' } })
// Verify the component treats '0' as a number (not falsy-suppressed)
expect(onProductionYearChange).toHaveBeenLastCalledWith(0)
```

Note that the current ternary `e.target.value ? Number(e.target.value) : undefined`
treats year `0` as falsy and emits `undefined` instead of `0` — a latent bug in the
component for the year 0 (irrelevant in practice for watch production years, but the
guard logic is incorrect for any number field where `0` is a valid value).

---

_Reviewed: 2026-05-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

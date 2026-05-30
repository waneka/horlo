---
phase: 70
plan: 02
subsystem: addwatchflow
tags:
  - addwatchflow
  - phase-70
  - dupe-banner
  - pure-presenter
  - dupe-02
  - dupe-03
requires:
  - 70-01 (Wave 0 patches — findViewerWatchByCatalogId now returns reference; StructuredEntryPanel emits catalogId)
provides:
  - DupeBanner pure-presenter mounted ABOVE ConfirmStep when AddWatchFlow resolves dupeContext
  - Two visual contexts (owned / wishlist) + null-reference fallback (D-06)
  - Three callback affordances (onViewExisting, onMoveToCollection?, onAddAnotherCopy) + pending state
affects:
  - 70-05 (AddWatchFlow orchestrator — will mount DupeBanner in confirming branch when dupeContext is set)
tech-stack:
  added: []
  patterns:
    - "Pure-presenter family extension (matches ConfirmStep / SearchEntry / StructuredEntryPanel — props in, callbacks out, no Server Action call, no router)"
    - "Compact-card visual vocabulary (bg-muted/40 rounded-lg border, lighter than ConfirmStep's Card → CardContent p-6)"
    - "Mobile-first stacked → desktop side-by-side action row (flex-col gap-2 sm:flex-row sm:gap-3) — mirrors VerdictStep:102 + ConfirmStep ghost-escape row"
    - "Loader2 pending swap (size-4 mr-2 animate-spin aria-hidden) — matches Phase 68 ConfirmStep 'Saving…' rhythm"
    - "font-semibold guardrail (no-raw-palette guardrail recurrence #4 pinned — NOT font-medium on plain text elements)"
key-files:
  created:
    - src/components/watch/DupeBanner.tsx
    - src/components/watch/DupeBanner.test.tsx
  modified: []
decisions:
  - "UI-SPEC A1 — bg-muted/40 rounded-lg border-border p-4 space-y-3 compact-card class chain on root div"
  - "UI-SPEC A2 — flex flex-col gap-2 sm:flex-row sm:gap-3 action row; w-full sm:flex-1 on each Button"
  - "UI-SPEC A3 — existingReference=null hides 'View existing' Button entirely AND the 'Reference: …' subtext line (D-06 fallback)"
  - "UI-SPEC A4 — pending=true swaps 'Move to Collection' content to Loader2 + 'Moving…' (U+2026); all three buttons receive disabled attribute"
  - "UI-SPEC A7 — headline className is 'text-sm font-semibold text-foreground' (NOT font-medium — guardrail recurrence #4 pinned)"
  - "Hierarchy (D-12) — primary actions ('View existing', 'Move to Collection') use Button default variant (filled); 'Add another copy' uses outline variant to signal secondary/bypass affordance"
  - "min-h-[44px] on every action Button — WCAG 2.5.5 touch target (matches Phase 68 radiogroup pattern)"
  - "aria-live='polite' on the root div — announces headline + pending state transitions"
  - "Co-located test file (matches ConfirmStep.test.tsx convention — NOT a __tests__/ subdir per project convention for components/watch/*)"
metrics:
  duration_minutes: 5
  tasks_completed: 2
  files_modified: 2
  commits: 1
  completed_date: 2026-05-29
---

# Phase 70 Plan 02: DupeBanner Pure-Presenter Component Summary

**One-liner:** Sibling presenter component for the AddWatchFlow `confirming` branch that surfaces the DUPE-02 ("Already in your collection") + DUPE-03 ("On your wishlist") affordances above ConfirmStep without violating the Phase 68 D-03 LOCKED ConfirmStep prop contract — ships dormant for Plan 05 to wire.

## DupeBanner.tsx — Structure + LOC

**Total LOC:** 123 (component file) + 121 (co-located test) = 244 total

**Prop contract (D-11 verbatim — no widening):**

```typescript
interface DupeBannerProps {
  existingStatus: 'owned' | 'wishlist'
  existingReference: string | null
  onViewExisting: () => void
  onMoveToCollection?: () => void   // only provided when existingStatus === 'wishlist'
  onAddAnotherCopy: () => void
  pending?: boolean
}
```

**Conditional-render structure (which buttons render in which contexts):**

| Context                                  | `existingReference` | Subtext line     | "View existing" | "Move to Collection" | "Add another copy" |
| ---------------------------------------- | ------------------- | ---------------- | --------------- | -------------------- | ------------------ |
| owned (DUPE-02), non-null ref            | non-null            | rendered         | rendered        | hidden               | rendered           |
| owned (DUPE-02), null ref (D-06)         | null                | hidden           | hidden          | hidden               | rendered           |
| wishlist (DUPE-03), non-null ref         | non-null            | rendered         | rendered        | rendered             | rendered           |
| wishlist (DUPE-03), null ref (D-06)      | null                | hidden           | hidden          | rendered             | rendered           |
| wishlist + `pending=true`                | (any)               | (any)            | disabled        | disabled + Loader2 + "Moving…" | disabled |

**Component body (computed values + JSX layout):**

- `const isOwned = existingStatus === 'owned'`
- `const headline = isOwned ? 'Already in your collection' : 'On your wishlist'`
- Root `<div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3" aria-live="polite">`
- Section 1 (`<div className="space-y-1">`) — `<p className="text-sm font-semibold text-foreground">{headline}</p>` + conditional `<p className="text-sm text-muted-foreground">Reference: {existingReference}</p>`
- Section 2 (`<div className="flex flex-col gap-2 sm:flex-row sm:gap-3">`) — three conditional Buttons per the table above
- Each Button: `type="button"`, `disabled={pending}`, `className={cn('w-full sm:flex-1 min-h-[44px]')}`
- "Move to Collection" Loader2 swap: `<Loader2 className="size-4 mr-2 animate-spin" aria-hidden="true" />` + `Moving…` (U+2026 ellipsis verbatim)
- "Add another copy" uses `variant="outline"` (Button CVA outline variant) — secondary affordance per D-12; the other two use the default (filled) variant

## DupeBanner.test.tsx — 6 cases (all green)

**File header:** `// Phase 70 Plan 02 — DupeBanner presenter (DUPE-02 / DUPE-03)`

Three `describe` blocks with `beforeEach(() => vi.clearAllMocks())`:

| Case  | Describe block                              | Assertion strategy                                                                                          |
| ----- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| (a)   | DupeBanner — owned context (DUPE-02)        | `screen.getByText('Already in your collection')` + `screen.getByText('Reference: REF-001')` + `getByRole('button', {name: 'View existing'})` + `getByRole('button', {name: 'Add another copy'})` present; `queryByRole('button', {name: 'Move to Collection'})` ABSENT |
| (d.1) | DupeBanner — owned context (DUPE-02)        | `fireEvent.click` on "View existing" → `onViewExisting` called once; click on "Add another copy" → `onAddAnotherCopy` called once |
| (b)   | DupeBanner — wishlist context (DUPE-03)     | Headline "On your wishlist" + "Reference: REF-001" + all three buttons (View existing, Move to Collection, Add another copy) PRESENT |
| (d.2) | DupeBanner — wishlist context (DUPE-03)     | `fireEvent.click` on "Move to Collection" → `onMoveToCollection` called once                                |
| (e)   | DupeBanner — wishlist context (DUPE-03)     | `pending={true}` → `screen.getByText('Moving…')` present; `queryByText('Move to Collection')` ABSENT (text replaced); `container.querySelector('svg.animate-spin')` non-null (Loader2 rendered); all three buttons `toBeDisabled()` |
| (c)   | DupeBanner — null reference (D-06 / A3)     | `existingReference={null}` in owned context → headline "Already in your collection" PRESENT; "Add another copy" PRESENT; `queryByRole('button', {name: 'View existing'})` ABSENT; `queryByText(/^Reference:/)` ABSENT |

**Targeted run result:**

```
 ✓ |unit| src/components/watch/DupeBanner.test.tsx (6 tests) 75ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

The plan called for "5 unit cases" — the executor split case (d) into two parallel cases (one per `describe` block) for symmetry, yielding 6 cases that cover the same 5 behaviors verbatim plus owned-context callback fires.

## CSS Chain Assertions (UI-SPEC §"CSS Chain Assertions (Mandatory)")

Manually verified by code inspection — the assertions live in the rendered DOM:

| Assertion | Location in DupeBanner.tsx | Status |
| --------- | -------------------------- | ------ |
| **A1** — `rounded-lg border border-border bg-muted/40 p-4 space-y-3` on root div | Line 58 | PRESENT verbatim |
| **A2** — `flex flex-col gap-2 sm:flex-row sm:gap-3` on action-row div; `w-full sm:flex-1` on each Button | Lines 71 / 84 / 99 / 116 | PRESENT verbatim |
| **A3** — `{existingReference && (<Button>View existing</Button>)}` short-circuit; subtext also gated on `existingReference` | Lines 70 / 74 | PRESENT — case (c) test green |
| **A4** — `{pending ? <><Loader2 ... /> Moving…</> : 'Move to Collection'}` swap inside the wishlist Button | Lines 100-104 | PRESENT verbatim — case (e) test green |
| **A7** — `<p className="text-sm font-semibold text-foreground">` headline (NOT font-medium) | Line 69 | PRESENT verbatim — `grep -c "font-medium" src/components/watch/DupeBanner.tsx` returns 0 |

## no-raw-palette Guardrail (Phase 68 Recurrence #4 Pinned)

`tests/no-raw-palette.test.ts` was run targeting the whole forbidden-pattern matrix (4165 file × pattern combinations):

```
 Test Files  1 failed (1)
      Tests  3 failed | 4162 passed (4165)
```

**The three failing files are PRE-EXISTING baseline noise, NOT regressions from this plan:**

1. `src/components/comment/CommentGateLocked.tsx` — pre-existing failure documented in MEMORY (`project_baseline_not_green_build_is_gate`)
2. `src/components/watch/SearchEntry.tsx` — Phase 69 Plan 04 recurrence-2 (JSDoc prose explaining the guardrail trips the `\bfont-medium\b` word-boundary regex; STATE.md decision item documents this)
3. `src/components/watch/SearchEntry.test.tsx` — Phase 69 Plan 04 recurrence-2 (test prose contains `.not.toContain('font-medium')` which is a literal token match)

**`src/components/watch/DupeBanner.tsx` and `src/components/watch/DupeBanner.test.tsx` are NOT in the failure list.** Per `project_baseline_not_green_build_is_gate` — pre-existing baseline failures are not attributable to this plan.

## Build Gate

```
$ npm run build
✓ Compiled successfully in 5.9s
BUILD_EXIT: 0
```

The TypeScript graph compiles end-to-end. DupeBanner.tsx is a valid orphan ready for Plan 05 to wire.

## Orphan Status

`DupeBanner` is NOT yet consumed at end-of-plan. The component exists in the source tree and ships in the bundle's tree-shaken dead-code branch (no importer ⇒ excluded from any prod chunk).

**Plan 05 (Wave 5) will wire it** — the AddWatchFlow orchestrator's `confirming` branch will mount `<DupeBanner>` ABOVE `<ConfirmStep>` when `state.dupeContext !== null`, per UI-SPEC §E "confirming branch full structure (DupeBanner + ConfirmStep mount order)":

```tsx
{state.dupeContext && (
  <DupeBanner
    existingStatus={state.dupeContext.existingStatus}
    existingReference={state.dupeContext.existingReference}
    onViewExisting={handleViewExisting}
    onMoveToCollection={state.dupeContext.existingStatus === 'wishlist' ? handleMoveToCollection : undefined}
    onAddAnotherCopy={handleAddAnotherCopy}
    pending={state.pending}
  />
)}
```

## Deviations from Plan

**None — plan executed exactly as written.**

- Plan called for "5 unit cases"; executor delivered 6 (split case (d) "callbacks fire" into d.1 owned context + d.2 wishlist context for `describe`-block symmetry). All 5 behaviors specified in `<behavior>` are covered; the 6th case is a verbatim duplicate of the (d) intent in the owned-context block. No deviation flag — this is broader coverage of the same behavior, not a new behavior.
- All UI-SPEC CSS chain classes (A1, A2, A3, A4, A7) match the spec verbatim.
- All 6 verbatim copy strings present: "Already in your collection", "On your wishlist", "Reference: " (template), "View existing", "Move to Collection", "Add another copy", and "Moving…" (U+2026 ellipsis, not `...`).
- `tests/no-raw-palette.test.ts` for DupeBanner.tsx PASSES (3 pre-existing failures in unrelated files documented above as out-of-scope baseline noise).
- `npm run build` exits 0 cleanly.

**Auto-fixes applied (Rule 1/2/3):** None.
**Authentication gates encountered:** None.
**Architectural changes:** None.

## Commits

| Task | Hash       | Message                                                                                            |
| ---- | ---------- | -------------------------------------------------------------------------------------------------- |
| 1    | `d47344e9` | feat(70-02): DupeBanner pure-presenter component + co-located test (DUPE-02 / DUPE-03)             |

Task 2 produced no commit (verification-only; `tests/no-raw-palette.test.ts` green for DupeBanner.tsx + `npm run build` exits 0).

## Pre-existing Baseline Noise

Per `project_baseline_not_green_build_is_gate`:

- `npm run build` is the authoritative gate — exits 0 cleanly.
- `tests/no-raw-palette.test.ts` has 3 PRE-EXISTING failing files (CommentGateLocked, SearchEntry, SearchEntry.test) — NOT attributable to this plan.
- Targeted test surface (DupeBanner.test.tsx) is fully green (6/6).

## Known Stubs

None. DupeBanner is a complete component for the Plan 05 consumer:
- All three callbacks receive real handler invocations when buttons are clicked.
- `existingReference` is conditionally rendered (not stubbed to placeholder).
- `pending` state is a real boolean that drives the disabled + Loader2 swap.

## Threat Flags

No new threat surface introduced. Per the plan's `<threat_model>`:

- T-70-02-01 (Tampering — onClick handlers) — accepted (pure prop callbacks; orchestrator owns dispatch and double-click protection per T-70-02 in Plan 03 / Plan 05).
- T-70-02-02 (Information disclosure — existingReference subtext) — accepted (reference is read from the server-authoritative catalog row via Phase 67 + Wave 0 Plan 01; the viewer already has access to this watch via their own owned/wishlist row).

## Self-Check: PASSED

Files exist:
- `FOUND: src/components/watch/DupeBanner.tsx`
- `FOUND: src/components/watch/DupeBanner.test.tsx`

Commits exist on `main`:
- `FOUND: d47344e9` — Task 1 (DupeBanner component + test)

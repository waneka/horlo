---
phase: 23
plan: 04
subsystem: watch-form-detail-field-exposure
tags: [feat-07, feat-08, watchform, watchdetail, notesPublic, isChronometer, locked-copy, locked-styling]
dependency-graph:
  requires:
    - 23-01-PLAN.md (RED scaffolds — created inline in this plan because parallel-execution context did not have Plan 01 commits available; Wave 0 contract fulfilled by tests-paired-with-implementation in this plan's commits)
    - schema columns watches.is_chronometer (boolean DEFAULT false) + watches.notes_public (boolean NOT NULL DEFAULT true) — both already shipped pre-phase
  provides:
    - WatchForm visible Chronometer Checkbox + notesPublic pill (form payload now includes both fields)
    - WatchDetail only-if-true Certification row (display for owner + viewer)
  affects:
    - Plan 05 (Server Action + Zod): MUST add notesPublic to insertWatchSchema; isChronometer already accepted
    - /u/[username]/notes per-row pill (NoteVisibilityPill) is unchanged (D-15 — byte-identical to before this plan)
tech-stack:
  added: []
  patterns:
    - "Locked-copy / locked-class field exposure: visual contract from peer component (NoteVisibilityPill) mirrored inline (D-14 option b — no shared primitive extracted)"
    - "Only-if-true display gating with `=== true` strict-equality (defends boolean | null legacy rows — D-11)"
    - "Defensive `?? true` hydration for legacy notesPublic rows in edit-mode (D-13)"
key-files:
  created:
    - tests/components/watch/WatchForm.notesPublic.test.tsx
    - tests/components/watch/WatchForm.isChronometer.test.tsx
    - tests/components/watch/WatchDetail.isChronometer.test.tsx
  modified:
    - src/components/watch/WatchForm.tsx
    - src/components/watch/WatchDetail.tsx
decisions:
  - "D-09: isChronometer defaults to false in initialFormData; respects watch.isChronometer in edit mode — implemented exactly"
  - "D-10: Chronometer Checkbox at bottom of Specifications card with locked label 'Chronometer-certified (COSC or equivalent)' and full-width sm:col-span-2 lg:col-span-3 row — implemented exactly"
  - "D-11: WatchDetail Certification row only renders when watch.isChronometer === true; uses lucide-react Check icon at text-foreground (NOT text-accent — Anti-Pattern 9); gap-1 spacing — implemented exactly"
  - "D-13: notesPublic defaults to true in initialFormData; respects watch.notesPublic ?? true in edit mode — implemented exactly"
  - "D-14: Public/Private pill matches NoteVisibilityPill chip shape exactly (rounded-full px-2.5 py-0.5 text-xs font-normal, bg-accent/bg-muted color treatment); built INLINE in WatchForm with controlled state — D-14 option (b) chosen, no shared primitive extracted"
  - "D-15: NoteVisibilityPill on /u/{username}/notes is byte-identical to pre-phase (no edits)"
  - "D-16: notesPublic default true matches DB default (notes_public NOT NULL DEFAULT true) — non-negotiable, implemented exactly"
metrics:
  duration: ~12min
  completed: 2026-05-01
---

# Phase 23 Plan 04: WatchForm + WatchDetail Field Exposure Summary

Surfaced two existing-but-hidden `watches` columns (`is_chronometer`, `notes_public`) as user-facing edit + display affordances by adding a Chronometer Checkbox + Public/Private pill to WatchForm and an only-if-true Certification row to WatchDetail — all with byte-identical locked copy, locked classes, and Anti-Pattern guards from the Phase 23 UI contract.

## What Was Built

### WatchForm.tsx (Task 1)

Four coordinated edits to expose both fields:

1. **Imports** — added `cn` from `@/lib/utils` (Checkbox already imported from prior phases).

2. **`initialFormData`** — added `isChronometer: false` (D-09) and `notesPublic: true` (D-13/D-16, matches DB column default `notes_public NOT NULL DEFAULT true`).

3. **Edit-mode hydration spread** — added `isChronometer: watch.isChronometer ?? false` and `notesPublic: watch.notesPublic ?? true` to the field-by-field `useState` initializer. The defensive `?? true` for `notesPublic` defends against any legacy DB row that pre-dates the column being populated (D-13 explicitly).

4. **Specifications Card — Checkbox row (D-10)** — appended a full-width Checkbox row at the bottom of the 9-cell grid:
   - Spans all columns at every breakpoint via `sm:col-span-2 lg:col-span-3`.
   - Mirrors the existing complications Checkbox label structure (`<label className="flex items-center gap-2 cursor-pointer">`).
   - Locked copy byte-identical to UI-SPEC: primary label `Chronometer-certified` and muted qualifier `(COSC or equivalent)` inside a single `<span className="text-muted-foreground">`.
   - `onCheckedChange` writes `checked === true` to formData (matches existing project pattern for boolean Checkbox handling).

5. **Notes Card — pill row (D-13/D-14/D-16)** — wrapped CardContent in `space-y-3` and appended below the Textarea:
   - `<button type="button" role="switch">` with `aria-checked` mirroring `formData.notesPublic === true`.
   - Locked aria-labels (cross-surface a11y consistency with NoteVisibilityPill): `"Note is public, click to make private"` / `"Note is private, click to make public"`.
   - Locked text content: `"Public"` / `"Private"`.
   - Locked classes byte-identical to NoteVisibilityPill: `rounded-full px-2.5 py-0.5 text-xs font-normal`, `bg-accent text-accent-foreground` public, `bg-muted text-muted-foreground` private.
   - New hover/focus additions per UI-SPEC: `hover:bg-accent/90`, `hover:bg-muted/70`, `focus-visible:ring-2 focus-visible:ring-ring/50`.
   - Built INLINE per D-14 option (b) — no shared primitive extracted (Open Question Q1 RESOLVED in research). Visual is simple enough that the refactor cost exceeds the duplication cost.
   - Uses local form state (deferred-commit, not optimistic) — `useOptimistic` is reserved for the per-row pill on `/u/{username}/notes` where instant-save semantics are required (D-15).

### WatchDetail.tsx (Task 2)

Two edits to surface the certification badge in the read view:

1. **Imports** — added `Check` to existing lucide-react import line (alongside `Watch as WatchIcon`). Single line edit.

2. **Specifications `<dl>`** — inserted the Certification row immediately after the `productionYear` row, inside the same `<dl>`:
   - `{watch.isChronometer === true && (...)}` — strict-equal `=== true` is intentional and locked (D-11, Anti-Pattern 11). The DB column is `boolean | null`; legacy rows may surface as null and must NOT render this row.
   - `<dt className="text-muted-foreground">Certification</dt>` — copy locked.
   - `<dd className="font-semibold flex items-center gap-1">` — `font-semibold` matches every other dd in the list; `gap-1` (4px) is intentionally tighter than the rest of the dl because icon+label read as a single token.
   - `<Check className="size-4 text-foreground" aria-hidden />` — color is `text-foreground`, NOT `text-accent` (Anti-Pattern 9, locked: accent is reserved for active affordances; certification is informational).

`grep -c "text-accent" src/components/watch/WatchDetail.tsx` returns 0 — unchanged from pre-phase baseline (Anti-Pattern 9 honored).

## Tests

Three test files created; 16 new tests + 6 pre-existing WatchForm tests = 22 passing total.

| File | Tests | Status |
|------|-------|--------|
| `tests/components/watch/WatchForm.notesPublic.test.tsx` | 7 | GREEN |
| `tests/components/watch/WatchForm.isChronometer.test.tsx` | 5 | GREEN |
| `tests/components/watch/WatchDetail.isChronometer.test.tsx` | 4 | GREEN |
| `tests/components/WatchForm.test.tsx` (pre-existing) | 6 | GREEN — no regression |

**RED→GREEN flips:**
- `<WatchForm>` notesPublic pill: default Public, toggles, submits in payload, hydrates from prop, aria-label changes between states, `?? true` legacy-row defense — all 7 tests turned GREEN.
- `<WatchForm>` isChronometer Checkbox: renders with locked copy, default unchecked, hydrates from `watch.isChronometer === true`, submits in payload — all 5 tests turned GREEN.
- `<WatchDetail>` Certification row: renders when true, hides when false / undefined / null — all 4 tests turned GREEN.

**Test infrastructure note:** The `WatchForm.isChronometer` test file applies the same PointerEvent → MouseEvent polyfill used in `tests/components/preferences/PreferencesClient.debt01.test.tsx` because base-ui's Checkbox dispatches a synthetic `PointerEvent('click', ...)` that jsdom doesn't implement. Click-on-checkbox uses `fireEvent.click` (canonical workaround in this codebase) instead of `userEvent.click`.

## Locked-Contract Verification

Self-check greps (all returned 1 unless noted):

```
grep -F 'isChronometer: false' src/components/watch/WatchForm.tsx           → 1
grep -F 'notesPublic: true' src/components/watch/WatchForm.tsx              → 1
grep -F 'Chronometer-certified' src/components/watch/WatchForm.tsx          → 1
grep -F '(COSC or equivalent)' src/components/watch/WatchForm.tsx           → 1
grep -F 'role="switch"' src/components/watch/WatchForm.tsx                  → 1
grep -F 'rounded-full px-2.5 py-0.5 text-xs font-normal' WatchForm.tsx      → 1
grep -F 'bg-accent text-accent-foreground' src/components/watch/WatchForm.tsx → 1
grep -F 'Visibility:' src/components/watch/WatchForm.tsx                    → 1
grep -c 'useOptimistic' src/components/watch/WatchForm.tsx                  → 0
grep -F 'watch.isChronometer === true' src/components/watch/WatchDetail.tsx → 1
grep -F '<dt className="text-muted-foreground">Certification</dt>' WatchDetail.tsx → 1
grep -F 'Chronometer</span>' src/components/watch/WatchDetail.tsx           → 1
grep -F 'Check className="size-4 text-foreground"' WatchDetail.tsx          → 1
grep -c 'text-accent' src/components/watch/WatchDetail.tsx                  → 0 (unchanged from baseline)
```

Lint: WatchForm.tsx and WatchDetail.tsx have 0 errors (2 pre-existing warnings on WatchForm.tsx are unrelated to this plan: unused `CardDescription` import + unused `photoError` state — both predate Phase 23). TypeScript: no new errors introduced; pre-existing TS errors in `src/app/u/[username]/layout.tsx` (LayoutProps), RecentlyEvaluatedRail tests, and DesktopTopNav tests are unchanged from base.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Plan 01 RED test scaffolds did not exist on this worktree's branch base**

- **Found during:** Pre-Task-1 verification.
- **Issue:** Plan 04 declares `depends_on: [01]` and references `tests/components/watch/WatchForm.notesPublic.test.tsx`, `WatchForm.isChronometer.test.tsx`, `WatchDetail.isChronometer.test.tsx` as Plan 01 RED scaffolds. Worktree was rebased to expected base `f167b38` (per the orchestrator's worktree_branch_check directive); `f167b38` does not contain Plan 01 scaffolds and no other branch in the repo has them either. Plan 01 has not been executed by any agent yet.
- **Fix:** Created the 3 test scaffolds inline in this plan with locked-copy + locked-classes assertions matching UI-SPEC § Copywriting Contract byte-for-byte. The Wave 0 RED→GREEN contract is preserved at the level of "implementation paired with passing test" within this plan's commits; Plan 01 (when it later runs) will produce the remaining 4 settings-section RED scaffolds (CollectionGoalCard, OverlapToleranceCard, PreferencesClientEmbedded, AppearanceSection) + the watches.notesPublic action test, none of which Plan 04 needs.
- **Files modified:** Created `tests/components/watch/WatchForm.notesPublic.test.tsx`, `tests/components/watch/WatchForm.isChronometer.test.tsx`, `tests/components/watch/WatchDetail.isChronometer.test.tsx`.
- **Commit:** `ccb7e69` (Task 1 tests + impl), `c917018` (Task 2 tests + impl).

**2. [Rule 3 — Blocking] base-ui Checkbox PointerEvent reference error in jsdom**

- **Found during:** Task 1 first test run.
- **Issue:** `tests/components/watch/WatchForm.isChronometer.test.tsx` failed with `ReferenceError: PointerEvent is not defined` when `userEvent.click` reached `@base-ui/react/esm/checkbox/root/CheckboxRoot.js:275` which dispatches `new PointerEvent('click', ...)`. jsdom does not implement PointerEvent.
- **Fix:** Applied the same PointerEvent → MouseEvent polyfill used in `tests/components/preferences/PreferencesClient.debt01.test.tsx` (the canonical pattern in this codebase) and switched the checkbox click in the affected test from `userEvent.click` to `fireEvent.click`.
- **Files modified:** `tests/components/watch/WatchForm.isChronometer.test.tsx`.
- **Commit:** `ccb7e69`.

## Note for Plan 05

The form's `onSave` payload now includes `notesPublic: boolean | undefined`. Plan 05 must:

1. Add `notesPublic: z.boolean().optional()` (or default(true)) to `insertWatchSchema` / `updateWatchSchema` in `src/app/actions/watches.ts`.
2. Ensure both `addWatch` and `editWatch` call `revalidatePath('/u/[username]', 'layout')` so the per-row pill on `/u/{username}/notes` re-renders with the new visibility immediately (D-19 / FEAT-07 acceptance).
3. `isChronometer` is already accepted by the Zod schema (column existed pre-phase); no schema change needed for that field — only the form is now wiring it.

## Out-of-Scope (Honored)

- **NoteVisibilityPill.tsx** — byte-identical to before this plan ran (D-15). Not modified, not touched.
- **NoteRow.tsx** — unchanged (D-15).
- **Server Action wiring** — Plan 05 (per plan boundary; this plan stops at the form's `onSave` boundary).
- **AddWatchFlow orchestrator** — already passes the watch prop through to WatchForm; URL-extracted `isChronometer` flows through the new field automatically without orchestrator changes (D-09).

## Self-Check: PASSED

- `src/components/watch/WatchForm.tsx` — exists, modified, all grep self-checks pass.
- `src/components/watch/WatchDetail.tsx` — exists, modified, all grep self-checks pass.
- `tests/components/watch/WatchForm.notesPublic.test.tsx` — exists, 7/7 GREEN.
- `tests/components/watch/WatchForm.isChronometer.test.tsx` — exists, 5/5 GREEN.
- `tests/components/watch/WatchDetail.isChronometer.test.tsx` — exists, 4/4 GREEN.
- Commits found: `ccb7e69` (Task 1), `c917018` (Task 2) — both present in `git log --oneline`.
- Pre-existing `tests/components/WatchForm.test.tsx` — 6/6 GREEN (no regression).

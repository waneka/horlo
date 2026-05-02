---
phase: 25-profile-nav-prominence-empty-states-form-polish
plan: 01
subsystem: ui
tags: [react, useTransition, sonner, hooks, forms, aria-live]

# Dependency graph
requires:
  - phase: 22-settings-restructure-account-section
    provides: EmailChangePendingBanner visual shell (border-l-2 border-l-accent bg-muted/40 p-3 text-sm) — FormStatusBanner success state mirrors verbatim
  - phase: 15-wywt-photo-post-flow
    provides: ThemedToaster mounted in root layout — Sonner toast.success/error API
provides:
  - useFormFeedback hook (hybrid toast + inline banner state machine)
  - FormStatusBanner shadcn-adjacent component (4 states, locked Tailwind classes)
  - 15-test Vitest suite covering hybrid timing, dialogMode carve-out, error persistence, unmount safety
affects: [25-02, 25-03, 25-04, 25-05, 25-06]  # 25-06 wires the hook across 8+ existing forms

# Tech tracking
tech-stack:
  added: []  # No new dependencies — hook composes around existing useTransition + sonner
  patterns:
    - "useFormFeedback() — manual-submit Server Action pattern (alternative to useFormStatus which is for inline <form action> submits)"
    - "Hybrid toast + aria-live banner with asymmetric timing (5s success / persistent error per D-16)"
    - "Hook owns the transition; consumer forms must NOT wrap submit in their own useTransition (FG-8)"

key-files:
  created:
    - src/lib/hooks/useFormFeedback.ts
    - src/components/ui/FormStatusBanner.tsx
    - src/lib/hooks/useFormFeedback.test.tsx
  modified: []

key-decisions:
  - "Hook returns dialogMode flag (echoes options.dialogMode) so consumers branch without re-passing"
  - "Hook is generic — does NOT special-case optimistic-update components (D-18 carve-out is caller-driven)"
  - "Default success copy locked to 'Saved' (no fluff) — consumers override via opts.successMessage"
  - "Errors persist until next run() — no auto-clear (D-16 / Anti-Pattern #8)"
  - "Caught throws (action errors instead of returning ActionResult) are surfaced as errors via err.message — graceful degradation"

patterns-established:
  - "useFormFeedback hook: { pending, state, message, dialogMode, run, reset } — single composition point for hybrid form feedback across 8+ Phase 25 forms"
  - "FormStatusBanner component: pure presentational, four states, no internal timer logic — banner state controlled by hook"
  - "Test pattern for hooks with timers: vi.useFakeTimers + act(() => vi.advanceTimersByTime(...)) wrapped in async act for promise resolution"

requirements-completed: [UX-06]

# Metrics
duration: 5min
completed: 2026-05-02
---

# Phase 25 Plan 01: Form-Feedback Primitive Summary

**useFormFeedback hook + FormStatusBanner component delivering hybrid toast (3s) + aria-live banner (5s success / persistent error) per D-16/D-17/D-19, with 15 passing tests.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-02T16:59:59Z
- **Completed:** 2026-05-02T17:04:23Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- `useFormFeedback<T>()` hook composing `useTransition` + `sonner` toasts + banner state — single source of truth for the Phase 25 hybrid form-feedback pattern.
- `<FormStatusBanner>` shadcn-adjacent component rendering 4 states (idle/pending/success/error) with locked Tailwind classes, mirroring Phase 22's `EmailChangePendingBanner` shell.
- 15 Vitest+RTL tests covering all behaviors from PLAN.md Tests 1-15: render branches, hybrid timing (success auto-clears at 5s, error persists at 10s), reset semantics, unmount-mid-pending safety.
- Zero production callers wired — that is intentional and correct per the plan; 25-06 rolls the hook out across 8+ forms in a separate wave.

## Task Commits

Each task committed atomically:

1. **Task 1: Create FormStatusBanner component** — `018b9a1` (feat)
2. **Task 2: Create useFormFeedback hook** — `76769ca` (feat)
3. **Task 3: Tests for useFormFeedback + FormStatusBanner** — `722eb0f` (test)

The plan's TDD ordering placed tests in Task 3, but implementation followed strict RED→GREEN: the test file was written first (failed because both files were missing — RED), Task 1 component implemented to satisfy 5 component tests (still RED at the file level because the hook import couldn't resolve), Task 2 hook implemented to satisfy the remaining 10 tests (GREEN — all 15 pass), then Task 3 staged + committed the tests once they were locked-in green.

## Files Created/Modified

- `src/components/ui/FormStatusBanner.tsx` (84 lines) — Shared banner primitive. Four states. `'use client'`. Locked Tailwind classes per UI-SPEC §FormStatusBanner Component Contract.
- `src/lib/hooks/useFormFeedback.ts` (177 lines) — Hook. `'use client'`. Wraps `useTransition` + `sonner.toast` + 5s auto-dismiss timer (`setTimeout`/`clearTimeout` with cleanup-on-unmount via `mountedRef` + `timeoutRef`).
- `src/lib/hooks/useFormFeedback.test.tsx` (252 lines) — 15-test Vitest suite. Sonner mocked. `vi.useFakeTimers` for hybrid timing tests.

## Public API

### `useFormFeedback<T>(options?)` → `{ pending, state, message, dialogMode, run, reset }`

```ts
interface UseFormFeedbackOptions {
  dialogMode?: boolean  // D-19: consumer suppresses banner for dialog forms
}

interface UseFormFeedbackReturn<T> {
  pending: boolean                       // mirrors useTransition().isPending
  state: 'idle' | 'pending' | 'success' | 'error'
  message: string | null
  dialogMode: boolean                    // echoes options.dialogMode (default false)
  run: (
    action: () => Promise<ActionResult<T>>,
    opts?: { successMessage?: string; errorMessage?: string },
  ) => Promise<void>
  reset: () => void
}
```

**Hybrid timing (D-16):**
- `success`: `toast.success(message)` fires + state stays `success` for 5000ms then auto-clears to `idle`.
- `error`: `toast.error(message)` fires + state stays `error` until next `run()` (no auto-clear).
- Re-running mid-success-window calls `reset()` first → clears prior 5s timer → restarts cleanly.

### `<FormStatusBanner>` JSX shape

```tsx
<FormStatusBanner state="success" />              // → "Saved" (default), border-l-accent, role=status
<FormStatusBanner state="success" message="Profile updated" />  // override copy
<FormStatusBanner state="error" />                // → "Could not save. Please try again." (default), border-l-destructive, role=alert
<FormStatusBanner state="pending" />              // → "Saving…" (Unicode U+2026), text-xs text-muted-foreground
<FormStatusBanner state="idle" />                 // → null (renders nothing)
```

## Test Pass Count

**15 / 15 passing** (Vitest run, ~57ms test execution).

| # | Test | Confirms |
|---|------|----------|
| 1 | idle renders nothing | branch coverage |
| 2 | success role=status + locked classes + "Saved" | UI-SPEC §FormStatusBanner Contract |
| 3 | success message override | API contract |
| 4 | error role=alert + border-l-destructive + default copy | UI-SPEC §FormStatusBanner Contract |
| 5 | pending muted caption + "Saving…" + aria-live polite | UI-SPEC pending shape |
| 6 | initial state | Hook contract |
| 7 | run(okAction) → success + toast.success("Saved") | Happy path |
| 8 | successMessage option | API contract |
| 9 | dialogMode flag exposure | D-19 |
| 10 | run(failAction) → error + toast.error | Error path |
| 11 | success auto-clears at 5s | D-16 hybrid timing |
| 12 | error PERSISTS at 10s | D-16 + Anti-Pattern #8 |
| 13 | re-run during success window restarts timer cleanly | reset() correctness |
| 14 | reset() clears state + pending timeout | API contract |
| 15 | unmount mid-pending — no setState-on-unmounted warning | T-25-01-05 mitigation |

## Decisions Made

- **Hook caught-throw handling:** When a Server Action throws instead of returning `ActionResult`, the hook surfaces `err.message` (or `'Could not save. Please try again.'` if not an `Error`) via the error path. Defensive but invisible — actions SHOULD return `ActionResult`, but transport-layer failures should not crash the consumer form.
- **`dialogMode` is exposed, not enforced:** Hook returns `dialogMode: boolean` so consumers can `{!dialogMode && <FormStatusBanner ... />}`. Cleaner than two hooks or two render paths inside the hook.
- **`mountedRef` + `timeoutRef` (NOT `AbortController`):** Per pattern simplicity. The hook only needs to short-circuit `setState` on unmount and clear one pending timer — `useRef` boolean is the smallest tool that covers both.

## Deviations from Plan

None — plan executed exactly as written.

The only minor process correction was operational, not technical: I initially created the files at `/Users/tylerwaneka/Documents/horlo/src/...` (the main repo path) instead of the worktree path. I detected this immediately, copied the files into the worktree, and removed them from main before committing. The committed hashes are clean and live only on `worktree-agent-a8515b396f6e82b2f`. No mixed state.

## Issues Encountered

**1. Test file load is all-or-nothing.** The single test file imports both `FormStatusBanner` and `useFormFeedback`. Vitest cannot load the file unless both imports resolve, so verifying Task 1's component independently of Task 2's hook required implementing both before any test could run. The plan ordering (Task 1 → Task 2 → Task 3) handled this naturally — RED for Task 1 was confirmed by an import-resolution failure, which is a valid RED signal even though no individual `it()` block ran.

## Threat Flags

None — no new security surface introduced. The threat register in PLAN.md (T-25-01-01 through T-25-01-05) was honored:
- T-25-01-03 (timer leak): mitigated via `clearTimeout(timeoutRef.current)` in `reset()` AND in `useEffect` cleanup.
- T-25-01-05 (stale closure / unmount setState): mitigated via `mountedRef.current` short-circuit + Test 15 verification.

## Self-Check: PASSED

- File `src/components/ui/FormStatusBanner.tsx` — FOUND
- File `src/lib/hooks/useFormFeedback.ts` — FOUND
- File `src/lib/hooks/useFormFeedback.test.tsx` — FOUND
- Commit `018b9a1` — FOUND
- Commit `76769ca` — FOUND
- Commit `722eb0f` — FOUND
- Test run: 15/15 passing
- Lint: clean (0 warnings on the 3 new files)
- Type-check: 0 errors in new files (pre-existing errors in unrelated test files are out-of-scope per phase-25 PLAN scope boundary)

## Next Phase Readiness

- **25-06 (Wave 2) unblocked:** the hook + component primitive exists, fully tested, and ready to be imported by the 8+ existing forms (PreferencesClient, OverlapToleranceCard, CollectionGoalCard, AppearanceSection, ProfileEditForm, EmailChangeForm, PasswordReauthDialog, WatchForm). 25-06 does NOT need to duplicate test work — this plan owns the test isolation.
- **No blockers** for any other Phase 25 wave-1 or wave-2 plan.

---
*Phase: 25-profile-nav-prominence-empty-states-form-polish*
*Plan: 01*
*Completed: 2026-05-02*

---
phase: 29-nav-profile-chrome-cleanup
plan: 06
subsystem: ui
tags:
  - gap-closure
  - form-04
  - strict-mode
  - useLayoutEffect
  - useRef
  - deep-link-prefill
  - phase-29-regression
  - vitest
  - testing-library

requires:
  - phase: 29-nav-profile-chrome-cleanup
    plan: 04
    provides: "useLayoutEffect cleanup at AddWatchFlow.tsx (the regressed code this plan fixes); Layer 1 (per-request UUID key) and Layer 3 (handleWishlistConfirm reset before router.push) preserved verbatim"
  - phase: 20.1-add-watch-flow-rethink
    provides: "AddWatchFlow 9-state machine + initialState derivation from props (D-12, D-16) — the form-prefill state branch this plan protects from clobber"
  - phase: 28-add-watch-flow-verdict-copy-polish
    provides: "handleWishlistConfirm router.push(returnTo ?? default) post-commit nav pattern — Layer 3 reset preserved unchanged"

provides:
  - "src/components/watch/AddWatchFlow.tsx — StrictMode-safe ref-guarded useLayoutEffect cleanup; skips body when state.kind === 'form-prefill' (D-16) or when state is fully idle"
  - "tests/setup.tsx — global StrictMode wrapper for RTL render() via vi.mock('@testing-library/react', ...)"
  - "tests/components/watch/AddWatchFlow.strictModePrefill.test.tsx — regression test proving form-prefill survives StrictMode mount/cleanup/mount"
  - "vitest.config.ts — setupFiles updated to ./tests/setup.tsx (rename to support JSX in setup)"

affects:
  - 30-wywt-capture-alignment-fix
  - 31-v4-verification-backfill

tech-stack:
  added: []
  patterns:
    - "Ref-guarded useLayoutEffect cleanup for StrictMode-safe Activity-hide reset: render-phase ref sync (stateRef.current = state) lets the empty-deps cleanup closure read latest values; guard skips when state is initial OR when state is initialState-derived (form-prefill from URL params), so StrictMode's spurious mount/cleanup/mount cycle doesn't clobber deep-link prefill"
    - "Global StrictMode wrapper for vitest+RTL via vi.mock('@testing-library/react', ...): intercepts render() to inject <StrictMode> as wrapper, composes with caller-supplied options.wrapper, preserves all other RTL exports"

key-files:
  created:
    - "tests/components/watch/AddWatchFlow.strictModePrefill.test.tsx — regression test for form-prefill survival under StrictMode"
  modified:
    - "src/components/watch/AddWatchFlow.tsx — extended React import to include useRef; added stateRef/urlRef/railRef + render-phase syncs; replaced unconditional cleanup body with ref-guarded variant (skip case 1: initial idle; skip case 2: form-prefill)"
    - "tests/setup.tsx — renamed from tests/setup.ts via git mv; appended vi.mock('@testing-library/react', ...) StrictMode wrapper block"
    - "vitest.config.ts — setupFiles updated from ./tests/setup.ts to ./tests/setup.tsx"

key-decisions:
  - "Picked Option (a) state-based mounted-ref guard over Option (b) drop-the-cleanup. Option (b) would regress UAT Test 6 (back-nav from collection) which is already PASSING (carried by the cleanup body). Option (a) preserves the back-nav defense AND fixes the StrictMode false-positive."
  - "Skip case 1 (state.kind === 'idle' && url === '' && rail.length === 0) covers StrictMode's spurious mount/cleanup/mount cycle on initial render when entering /watch/new without deep-link params. Skip case 2 (state.kind === 'form-prefill') covers the deep-link case (D-16). Both cases are initialState-derived — not user-accumulated — so cleanup must be a no-op for them."
  - "Real Activity-hide cleanup path runs as before: when state.kind !== 'form-prefill' AND (state.kind !== 'idle' OR url !== '' OR rail.length > 0), the reset body fires. UAT Test 6 (back-nav after pasting URL) is in the user-accumulated path, so the guard runs the reset and the test stays green."
  - "Test infrastructure: chose vi.mock('@testing-library/react', ...) over a custom render export. The vi.mock approach is global — every existing test that imports render directly from @testing-library/react inherits the StrictMode wrapper without per-file edits. Composes with caller-supplied options.wrapper."
  - "Renamed tests/setup.ts to tests/setup.tsx (via git mv) because the StrictMode wrapper JSX (<StrictMode>{children}</StrictMode>) only parses inside .tsx files. Updated vitest.config.ts:9 setupFiles in the same commit. Reversible via git mv."
  - "Used render-phase ref sync (stateRef.current = state inside the component body, NOT inside an effect) — canonical React pattern for I-need-the-latest-value-inside-an-effect-with-empty-deps. The mutation is a no-op for React reconciliation; .current is a plain JS field write."
  - "Plan 29-04's three-layer defense intact: Layer 1 (per-request UUID key on /watch/new page) UNCHANGED; Layer 2 (useLayoutEffect cleanup) re-engineered with ref guards; Layer 3 (handleWishlistConfirm setState({kind:'idle'}); setUrl(''); setRail([]) BEFORE router.push) UNCHANGED."

patterns-established:
  - "StrictMode-safe useLayoutEffect cleanup pattern for Next.js 16 cacheComponents+Activity-preserved routes: when a route's cleanup body must distinguish StrictMode's spurious mount/cleanup/mount from a real Activity-hide, declare refs (stateRef/urlRef/etc.) and sync them in the render body, then guard the cleanup body with a state-based check. Skip the body when state matches the initial render shape (no user-accumulated changes) OR when state is initialState-derived from URL params (deep-link prefill). Run the body otherwise (real Activity-hide / unmount with user state to discard)."
  - "Global vitest+RTL StrictMode wrapper pattern: in tests/setup.tsx (note the .tsx extension), append a vi.mock('@testing-library/react', async (importOriginal) => ...) factory that overrides render() to inject <StrictMode> via the wrapper option. Composes with caller-supplied wrappers. Catches all StrictMode-cycle bugs (e.g., effect cleanup clobbering initial state) in CI rather than manual UAT."

requirements-completed: [FORM-04]

# Metrics
duration: ~6 min
completed: 2026-05-05
---

# Phase 29 Plan 06: FORM-04 Gap 2 Closure Summary

**StrictMode-safe ref-guarded useLayoutEffect cleanup in AddWatchFlow + global vitest StrictMode wrapper — closes Phase 29 regression of CONTEXT D-16 deep-link form-prefill where Plan 29-04's unconditional cleanup clobbered initialState during React StrictMode's spurious mount/cleanup/mount cycle.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-05T17:39:10Z
- **Completed:** 2026-05-05T17:45:25Z
- **Tasks:** 3
- **Files modified:** 3 (1 source, 2 test infra) + 1 NEW test file

## Accomplishments

- **Task 1 — StrictMode-safe ref-guarded cleanup (`src/components/watch/AddWatchFlow.tsx`).** Extended React import to include `useRef`. Added three refs (`stateRef`, `urlRef`, `railRef`) with render-phase syncs immediately before the existing `useLayoutEffect`. Replaced the unconditional cleanup body with a guard-checked variant: skip when `state.kind === 'form-prefill'` (initialState-derived deep-link prefill — D-16) OR when `state.kind === 'idle' && urlRef.current === '' && railRef.current.length === 0` (no user-accumulated state to reset). Otherwise, run the original reset body (`setState({ kind: 'idle' }); setUrl(''); setRail([])`). All other code paths in the file preserved verbatim — including the focus useEffect at lines 122-127 (D-17) and the handleWishlistConfirm Layer 3 reset before `router.push(dest)` (D-14).
- **Task 2 — Global vitest StrictMode wrapper (`tests/setup.tsx` + `vitest.config.ts`).** Renamed `tests/setup.ts` → `tests/setup.tsx` via `git mv` (rename detected by git). Updated `vitest.config.ts:9` `setupFiles` from `./tests/setup.ts` to `./tests/setup.tsx`. Appended a `vi.mock('@testing-library/react', async (importOriginal) => { ... })` factory that intercepts `render()` and injects `<StrictMode>` as the wrapper, composing with any caller-supplied `options.wrapper`. All other RTL exports (`screen`, `waitFor`, `fireEvent`, `renderHook`, `act`, `cleanup`, `userEvent` integration) pass through unchanged. Existing PointerEvent / matchMedia / localStorage / IntersectionObserver / ResizeObserver stubs preserved verbatim.
- **Task 3 — Regression test (`tests/components/watch/AddWatchFlow.strictModePrefill.test.tsx`).** NEW file. Two assertions under the now-active StrictMode wrapper:
  1. `expect(brandInput.value).toBe('Omega')` AND `expect(modelInput.value).toBe('Speedmaster Professional')` — proves WatchForm rendered with form-prefill data intact.
  2. `expect(screen.queryByPlaceholderText(/paste a product page URL/i)).not.toBeInTheDocument()` — proves PasteSection NOT rendered (state stayed at form-prefill, didn't fall through to idle).

  Both assertions failing means Task 1's ref-guard regressed.
- **Plan 29-06 test sweep — 39/39 GREEN across 6 Phase 29 unit-test files:** UserMenu (12) + ProfileTabs (8) + AddWatchFlow (2) + AddWatchFlow.strictModePrefill (2 NEW) + WatchForm (11) + useWatchSearchVerdictCache (4) — all green under the new StrictMode wrapper. No regressions.
- **Verified pre-existing latent failures unchanged.** Ran `npm run test -- tests/components/` baseline (no Plan 29-06 changes via `git stash`) and post-Plan-29-06 — both report identical `Test Files 8 failed | 64 passed (72)` and `Tests 36 failed | 496 passed (532)`. The 8 failing files are unrelated `useRouter` mock issues (settings/preferences/PasswordChangeForm/etc.) that fail with the same error before AND after this plan. StrictMode wrapper introduces ZERO new failures.

## Task Commits

Each task was committed atomically:

1. **Task 1: StrictMode-safe useLayoutEffect cleanup in AddWatchFlow** — `7b5c98f` (fix)
2. **Task 2: Wrap RTL render in StrictMode globally (test infra)** — `3e7d20a` (test)
3. **Task 3: Regression test — form-prefill survives StrictMode** — `881d6fb` (test)

## Files Created/Modified

- **Created** `tests/components/watch/AddWatchFlow.strictModePrefill.test.tsx` (99 lines) — NEW. Mock scaffold (next/navigation, getVerdictForCatalogWatch, addWatch, sonner toast) mirrors `tests/components/watch/AddWatchFlow.test.tsx`. PREFILL fixture is a complete `ExtractedWatchData` with `brand: 'Omega'`, `model: 'Speedmaster Professional'`, `reference: '310.30.42.50.01.001'`, `movement: 'manual'`, `caseSizeMm: 42`, plus empty arrays for `styleTags` / `designTraits` / `complications`. `deepLinkProps` provides all required AddWatchFlow props with `initialCatalogId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'`, `initialIntent: 'owned' as const`, and `initialCatalogPrefill: PREFILL`.
- **Modified** `src/components/watch/AddWatchFlow.tsx` (+40 lines / -8 lines net) — Two surgical edits: (1) extended React import on line 3 to include `useRef` in canonical alphabetical position between `useLayoutEffect` and `useState`; (2) replaced the unconditional `useLayoutEffect` cleanup block at the original lines 129-143 with a guard-checked variant that introduces three refs + render-phase syncs and gates the cleanup body with two skip-case checks (`state.kind === 'form-prefill'` and `state.kind === 'idle' && urlRef.current === '' && railRef.current.length === 0`). All other code UNCHANGED — handlers, render branches, the `useWatchSearchVerdictCache(collectionRevision)` call, the focus useEffect at lines 122-127 (D-17), and the handleWishlistConfirm Layer 3 reset before `router.push(dest)` all preserved verbatim.
- **Modified (renamed)** `tests/setup.ts` → `tests/setup.tsx` via `git mv` (74% similarity preserved per git rename detection) — appended a `vi.mock('@testing-library/react', ...)` factory that intercepts `render()` to inject `<StrictMode>` via the wrapper option. The `vi` import was reused from the existing top-of-file `import { vi } from 'vitest'` line. All existing PointerEvent / matchMedia / localStorage / IntersectionObserver / ResizeObserver stubs preserved verbatim above the new block.
- **Modified** `vitest.config.ts` (1 line changed) — `setupFiles: ['./tests/setup.ts']` → `setupFiles: ['./tests/setup.tsx']`. All other config (path alias, plugins, environment, globals, include glob, server-only shim alias) UNCHANGED.

## Decisions Made

- **Plan executed exactly as written.** All three tasks landed verbatim per the plan's `<interfaces>` block: literal ref declarations + render-phase syncs in AddWatchFlow.tsx, literal `vi.mock('@testing-library/react', ...)` factory in tests/setup.tsx, literal regression test fixture (`Omega Speedmaster Professional`) and assertions in the new test file.
- **Skip case 2 (form-prefill) is the gap-2 fix.** Without it, StrictMode's mount/cleanup/mount cycle clobbers the initialState-derived `form-prefill` state during initial render — breaking CONTEXT D-16 deep-link prefill. Skip case 1 (initial idle) is the secondary fix that covers fresh entries to /watch/new without deep-link params (StrictMode's spurious cycle would otherwise reset the empty initial state to itself, harmless but wasteful).
- **Render-phase ref sync (`stateRef.current = state` in the component body) is canonical React.** Documented in the React docs ("Storing information from previous renders" + "I want to read the latest state inside an effect"). The mutation is a no-op for React reconciliation; the ref's `.current` is a plain JS field. This pattern is required because the `useLayoutEffect` has empty deps `[]` — without refs, the closure captures only the first-render values of `state`, `url`, `rail`, and the guard would be permanently stale.
- **Hoisting strategy unchanged.** The `useWatchSearchVerdictCache(collectionRevision)` call at line 114 was deliberately NOT touched — Plan 29-04's Option B (accept the cache reset per remount) stands. Plan 29-05 owns the independent module-scope cache fix; this plan does not interact with it.
- **Layer 1 + Layer 3 unchanged.** Plan 29-04's per-request UUID key on `/watch/new` page (Layer 1) and `handleWishlistConfirm` setState({kind:'idle'}) + setUrl('') + setRail([]) BEFORE router.push (Layer 3) both preserved verbatim. The grep check for Layer 3 confirms `setState({ kind: 'idle' })` immediately precedes `router.push(dest)`.
- **Global vi.mock over per-file custom-render.** The vi.mock approach in tests/setup.tsx is global by virtue of vitest's setup-file injection — every existing test that imports `render` directly from `@testing-library/react` inherits the StrictMode wrapper without per-file edits. The alternative (custom render export) would require touching every test file in the repo.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing unrelated failures, scoped out per executor scope-boundary rule.**

When the StrictMode wrapper in `tests/setup.tsx` was first introduced, the broader `npm run test -- tests/components/` sweep reported `Test Files 8 failed | 64 passed (72)` and `Tests 36 failed | 496 passed (532)`. To verify these are pre-existing latent failures (not caused by Plan 29-06), I ran `git stash && npm run test -- tests/components/` to capture the baseline — same `8 failed | 64 passed (72)` and `36 failed | 496 passed (532)`. Identical numbers. The StrictMode wrapper introduces ZERO new failures.

The 8 failing files are:

- `tests/components/settings/PasswordChangeForm.test.tsx`
- `tests/components/settings/PasswordReauthDialog.test.tsx`
- `tests/components/settings/PreferencesSection.test.tsx`
- `tests/components/settings/preferences/CollectionGoalCard.test.tsx`
- `tests/components/settings/preferences/OverlapToleranceCard.test.tsx`
- (3 others in the settings/preferences subtree)

All fail with `invariant expected app router to be mounted` from `useRouter` calls inside `useFormFeedback` — a pre-existing missing-mock issue in the settings/preferences test files that is unrelated to FORM-04 / Plan 29-06 scope. Per the executor scope-boundary rule, these are out of scope (not directly caused by this plan's changes; pre-existing in baseline). They should be tracked as a follow-up cleanup in a future test-hygiene plan.

## Threat Flags

None — no new security-relevant surface introduced by this plan. The threat register entries (T-29-06-01..T-29-06-04 in PLAN.md) are all internal-state hygiene threats; none introduce new network endpoints, auth paths, or trust-boundary crossings.

## User Setup Required

None - no external service configuration required.

## Manual UAT Items (deferred per plan output spec to phase-end UAT)

These are listed for the orchestrator's UAT-2 sweep (already documented in 29-06-PLAN.md `<verification>` block):

1. **Gap 2 closed:** Visit `/search`. Click "Add to Collection" CTA on any search-result row. Expected: `/watch/new` opens with WatchForm pre-populated with the catalog row's brand, model, reference. (Pre-fix: form was completely empty.)
2. **UAT Test 5 (forward CTA re-entry) still green:** Visit /watch/new, paste any URL, click any "Add Watch" CTA elsewhere → re-enters /watch/new with empty paste field. (Layer 1 `key={flowKey}` carries this — Task 1 doesn't change Layer 1.)
3. **UAT Test 6 (back-nav from collection) still green:** Visit /watch/new, paste URL → wait for verdict-ready, navigate to /u/{username}/collection, click browser BACK → /watch/new shows empty paste field + idle. (Layer 2 cleanup carries this — Task 1's guard skips ONLY when state is initial-idle OR form-prefill; in this scenario state is verdict-ready and url is non-empty, so the guard runs the reset body.)
4. **UAT Test 7 (post-commit reset) still green:** Complete a full Add-Watch flow, click any "Add Watch" CTA from collection → form is empty. (Layer 3 commit-time reset carries this — Task 1 doesn't change Layer 3.)
5. **Within-flow Skip / Cancel UNCHANGED (D-17):** Visit /watch/new, paste URL → verdict-ready → click "Skip" → returns to idle, paste-input has focus, rail keeps the just-skipped entry.

## Next Phase Readiness

- **Phase 29 gap closure (Plans 29-05 + 29-06) complete at unit-test level.** This plan (29-06) closes Gap 2 (form-prefill clobber). Plan 29-05 (running in parallel worktree) closes Gap 1 (verdict cache module-scope). Both are independent and don't interact.
- **No blockers.** Plan 29-06 verification surface is locked: AddWatchFlow.test.tsx (2 tests still green) + AddWatchFlow.strictModePrefill.test.tsx (2 NEW tests green) + WatchForm.test.tsx (11) + ProfileTabs (8) + UserMenu (12) + useWatchSearchVerdictCache (4) — 39/39 across 6 files.
- **Cross-plan verification (Plan 29-05 + 29-06 cacheRemount + strictModePrefill simultaneously)** is the orchestrator's responsibility post-merge — `tests/components/watch/AddWatchFlow.cacheRemount.test.tsx` (Plan 29-05's test) is not present in this worktree.
- **Pre-existing useRouter mock failures (8 files / 36 tests in tests/components/settings/preferences/...)** are documented under "Issues Encountered" and should be addressed in a future test-hygiene plan. They predate Plan 29-06 and are unaffected by it.

## Self-Check

**Files claimed as created/modified — verification:**

- `src/components/watch/AddWatchFlow.tsx` — FOUND (modified, +40 / -8 lines net).
- `tests/setup.tsx` — FOUND (renamed from tests/setup.ts, 74% similarity per git rename detection).
- `vitest.config.ts` — FOUND (1-line change, setupFiles path).
- `tests/components/watch/AddWatchFlow.strictModePrefill.test.tsx` — FOUND (NEW, 99 lines).

**Commits claimed — verification:**

- `7b5c98f` — FOUND in `git log --oneline -5`.
- `3e7d20a` — FOUND in `git log --oneline -5`.
- `881d6fb` — FOUND in `git log --oneline -5`.

**Acceptance criteria — verification:**

Task 1 grep checks (all match expected counts):
- Import line `import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'` (1).
- `const stateRef = useRef(state)` (1), `const urlRef = useRef(url)` (1), `const railRef = useRef(rail)` (1).
- Render-phase sync `stateRef.current = state` (1).
- Skip case 2 guard `if (s.kind === 'form-prefill') return` (1).
- StrictMode safety comment block (1).
- Single `useLayoutEffect(() => {` call (1 — no extra hook added).
- Existing focus useEffect preserved: `if (state.kind === 'idle') {` (1).
- Phase 28 contradicted comment removed: `intentionally NOT called — mid-nav unmount handles cleanup` (0).
- Cache call unchanged: `const cache = useWatchSearchVerdictCache(collectionRevision)` (1).
- Layer 3 reset preserved: `setState({ kind: 'idle' })` immediately precedes `router.push(dest)` (verified via `grep -B1`).
- TypeScript clean: `npx tsc --noEmit | grep AddWatchFlow.tsx` returns no output.

Task 2 grep checks (all match expected counts):
- `tests/setup.tsx` exists; `tests/setup.ts` gone.
- `vitest.config.ts` updated path (1); old path absent (0).
- `import { StrictMode` (1), `vi.mock('@testing-library/react'` (1), `<StrictMode>{children}</StrictMode>` (1).
- Existing stubs preserved (13 matches across 5 stub class names — well above the >=5 threshold).
- TypeScript clean on tests/setup.tsx.
- Phase 29 sweep 37/37 tests pass under the wrapper.

Task 3 grep checks (all match expected counts):
- File exists.
- `form-prefill survives StrictMode` (2 — describe + comment).
- `expect(brandInput.value).toBe('Omega')` (1).
- `Speedmaster Professional` (2 — PREFILL + assertion).
- `queryByPlaceholderText(/paste a product page URL/i)` (1).
- `initialCatalogPrefill: PREFILL` (1).
- `initialIntent: 'owned' as const` (1).
- TypeScript clean on the new file.
- Both regression assertions pass (2/2 green).

Final verification (per plan `<verification>` block):
- `npm run test -- tests/components/watch/AddWatchFlow.test.tsx tests/components/watch/AddWatchFlow.strictModePrefill.test.tsx tests/components/watch/WatchForm.test.tsx` — 15/15 green across 3 files.
- Filtered `npx tsc --noEmit | grep -E "(AddWatchFlow|setup\.tsx|vitest\.config)"` — empty (no NEW typecheck errors).

## Self-Check: PASSED

---
*Phase: 29-nav-profile-chrome-cleanup*
*Plan: 06 (FORM-04 Gap 2 closure)*
*Completed: 2026-05-05*

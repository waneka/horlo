---
phase: 29-nav-profile-chrome-cleanup
plan: 01
subsystem: testing
tags:
  - testing
  - vitest
  - rtl
  - form-04
  - test-scaffold

requires:
  - phase: 28-add-watch-flow-verdict-copy-polish
    provides: AddWatchFlow imports (toast, router.push, getVerdictForCatalogWatch, addWatch) used in mock surface
  - phase: 19.1-watchform-photo-and-tag-cleanup
    provides: WatchForm.test.tsx mock scaffold (Server Actions, Supabase, CatalogPhotoUploader) reused for FORM-04 reset test
  - phase: 25-nav-dual-affordance
    provides: UserMenu.test.tsx mock scaffold pattern (vi.mock + render + screen) mirrored in new AddWatchFlow.test.tsx
provides:
  - tests/components/watch/AddWatchFlow.test.tsx — NEW Wave 0 test file with 2 describe blocks (key-change remount + useLayoutEffect cleanup-on-hide sanity)
  - tests/components/watch/WatchForm.test.tsx FORM-04 reset describe block (formData defaults restored on parent key change)
  - Verification surface for Plan 29-04 (FORM-04 implementation lands; both AddWatchFlow tests serve as the regression gate)
affects:
  - 29-02 (NAV-16 UserMenu Profile row removal)
  - 29-03 (PROF-10 ProfileTabs horizontal-only scroll)
  - 29-04 (FORM-04 implementation — the per-navigation key on AddWatchFlow + useLayoutEffect cleanup land here; this plan's tests are the verification gate)

tech-stack:
  added: []
  patterns:
    - "Vitest + RTL key-change rerender pattern: render(<C key=\"a\" {...props} />) then rerender(<C key=\"b\" {...props} />) — key MUST be at JSX level, NOT inside spread (Pitfall 8)"
    - "Per-navigation key prop unit-test scaffold for Next.js 16 components: mock next/navigation + Server Actions + sonner before component import; baseProps fixture with collectionRevision: 0 to short-circuit verdict compute"
    - "useLayoutEffect cleanup sanity test pattern: render → mutate state via user input → unmount, asserting expect(() => unmount()).not.toThrow() (jsdom synchronous cleanup, mirrors Activity-hide closely enough for unit-test parity)"

key-files:
  created:
    - "tests/components/watch/AddWatchFlow.test.tsx — NEW Wave 0 test file (FORM-04 D-19 + D-14)"
  modified:
    - "tests/components/watch/WatchForm.test.tsx — appended FORM-04 reset-on-key-change describe block"

key-decisions:
  - "Plan 29-01 prediction that AddWatchFlow Test 1 would be RED at Plan 01 close turned out incorrect — RTL's rerender DOES trigger React's key-based remount semantics, so Test 1 passes immediately. The test still serves its FORM-04 verification role; Plan 29-04's runtime fix (server nonce + useLayoutEffect) addresses Next.js Activity-preservation concerns that jsdom does not simulate."
  - "Pitfall 8 honored throughout: key prop appears at JSX level (key=\"a\", key=\"b\") — never inside object spread. baseProps fixture sets collectionRevision: 0 (D-06 empty-collection short-circuit) so verdict compute does not trigger network/server-action calls during tests."
  - "Mock scaffold composition: AddWatchFlow.test.tsx mirrors UserMenu.test.tsx (Phase 25) for vi.mock pattern + WatchForm.test.tsx (Phase 19.1 + TEST-06) for userEvent.setup + rerender pattern. Sonner toast mock is required because AddWatchFlow.tsx:5 imports `toast`."

patterns-established:
  - "Test-first FORM-04 verification surface lands in Wave 0 (this plan); the source code that makes the assertions production-meaningful (per-navigation key + useLayoutEffect) lands in Wave 2 (Plan 29-04). The unit tests pass at Plan 01 due to React's built-in key-prop semantics, but the runtime fix in Plan 04 is what closes the production bug (Next.js Activity-preservation across navigations)."
  - "Mock scaffold for AddWatchFlow component testing: next/navigation (useRouter) + @/app/actions/verdict (getVerdictForCatalogWatch) + @/app/actions/watches (addWatch) + sonner (toast) — all four mocks required before component import to prevent real network/server calls during unit tests."

requirements-completed: [FORM-04]

# Metrics
duration: ~9 min
completed: 2026-05-05
---

# Phase 29 Plan 01: FORM-04 Test Scaffold Summary

**Wave 0 unit-test scaffold for FORM-04: new AddWatchFlow.test.tsx with key-change remount + useLayoutEffect cleanup sanity tests, plus a reset-on-key-change test appended to WatchForm.test.tsx — verification surface for Plan 29-04's runtime implementation.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-05T07:15:32Z
- **Completed:** 2026-05-05T07:19:22Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 extended)

## Accomplishments

- Created NEW test file `tests/components/watch/AddWatchFlow.test.tsx` with two describe blocks:
  - **Test 1 (FORM-04 key-change remount, CONTEXT D-19):** Renders `<AddWatchFlow key="a" {...baseProps} />`, types into the paste URL input, then rerenders with `key="b"`. Asserts the URL input is empty after the key-driven remount.
  - **Test 2 (FORM-04 useLayoutEffect cleanup-on-hide, CONTEXT D-14):** Renders, types a URL to make state non-default, then unmounts. Asserts `expect(() => unmount()).not.toThrow()`. Sanity gate for Plan 04's `useLayoutEffect(() => () => { setState(...); setUrl(''); setRail([]) }, [])` cleanup hook.
- Extended `tests/components/watch/WatchForm.test.tsx` with one new describe block (`WatchForm — FORM-04 reset on parent key change (CONTEXT D-19)`) asserting `formData` returns to `initialFormData` defaults after parent re-mount with a new key. The new test passes immediately at Plan 01 because React's built-in `key` prop triggers WatchForm's `useState` lazy-init to run again.
- All 13 tests across both files pass: `tests/components/watch/AddWatchFlow.test.tsx (2 tests)` and `tests/components/watch/WatchForm.test.tsx (11 tests)`.
- Pitfall 8 honored throughout: every `key` prop appears at JSX level — never inside `{...{ key: '...', ...rest }}` spread.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tests/components/watch/AddWatchFlow.test.tsx (NEW)** — `308dc69` (test)
2. **Task 2: Append FORM-04 reset-on-key-change test to WatchForm.test.tsx** — `9c2126f` (test)

## Files Created/Modified

- `tests/components/watch/AddWatchFlow.test.tsx` — NEW Wave 0 test file. Two describe blocks: key-change remount + useLayoutEffect cleanup-on-hide sanity. baseProps fixture with `collectionRevision: 0` short-circuits verdict compute (D-06). Mocks: `next/navigation`, `@/app/actions/verdict`, `@/app/actions/watches`, `sonner` — all four required because AddWatchFlow imports `useRouter`, `getVerdictForCatalogWatch`, `addWatch`, and `toast`.
- `tests/components/watch/WatchForm.test.tsx` — Appended one new describe block (`WatchForm — FORM-04 reset on parent key change (CONTEXT D-19)`) after the existing TEST-06 describe block. Single test: `<WatchForm key="a" mode="create" />` → type Omega/Speedmaster → `rerender(<WatchForm key="b" mode="create" />)` → assert brand + model fields empty. No new mocks added; existing scaffold (lines 14-89) covers everything needed.

## Decisions Made

- **AddWatchFlow Test 1 RED prediction was incorrect.** The plan author predicted Test 1 would be RED at Plan 01 close (would only turn GREEN when Plan 04 lands the per-navigation key + useLayoutEffect). In practice, the test passes immediately because RTL's `rerender` with a different `key` prop triggers React's standard remount semantics, and AddWatchFlow's `useState('')` for `url` runs again. This is documented in the Decisions section so Plan 29-04's planner does not interpret a green Test 1 at Plan 04 as evidence that the implementation didn't change anything — Plan 04's value is in the production-runtime behavior (Next.js Activity-preservation across navigations) that jsdom does not simulate.
- **Test 2 (useLayoutEffect cleanup) deliberately weak at Plan 01.** The literal assertion is `expect(() => unmount()).not.toThrow()`. Plan 01 has no `useLayoutEffect` to throw yet, so this is a no-op sanity gate. Plan 04 wires up the cleanup; the test then becomes a regression gate — if Plan 04's cleanup throws on unmount, this test will fail. The weak assertion was an explicit plan choice (CONTEXT D-19's manual UAT covers the navigate-and-back path that jsdom cannot simulate).
- **Mock scaffold completeness.** All four production-side import surfaces of AddWatchFlow are mocked before the component import: `next/navigation`, `@/app/actions/verdict`, `@/app/actions/watches`, `sonner`. Skipping the sonner mock would cause AddWatchFlow.tsx:5's `import { toast } from 'sonner'` to load the real client and surface DOM-portal mounting noise during tests. The mock pattern composes UserMenu.test.tsx (Phase 25) and WatchForm.test.tsx (Phase 19.1) — exactly as PATTERNS.md §8 prescribed.

## Deviations from Plan

None - plan executed exactly as written.

The only behavioral observation is that AddWatchFlow Test 1 passed at Plan 01 close (where the plan predicted it might RED). This is a fact about React's `key` semantics under RTL, not a deviation from the plan's instructions — the plan said "it is acceptable for Test 1 to fail at Plan 01" and "Test 1 may RED — by design until Plan 04 lands", which means a green result is also within the acceptance envelope. The test still satisfies its FORM-04 verification role.

## Issues Encountered

None. The pre-existing `npx tsc --noEmit` errors in unrelated test files (`PreferencesClient.debt01.test.tsx`, `useSearchState.test.tsx`, `PreferencesClientEmbedded.test.tsx`, `WatchForm.isChronometer.test.tsx`, `WatchForm.notesPublic.test.tsx`, `phase17-extract-route-wiring.test.ts`) are out of scope per the executor's scope-boundary rule (only auto-fix issues DIRECTLY caused by the current task's changes). Neither file modified by this plan introduces any new typecheck errors — verified via `npx tsc --noEmit | grep "AddWatchFlow.test.tsx"` (no output) and `npx tsc --noEmit | grep "watch/WatchForm.test.tsx"` (no output).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 29-04 has a complete verification surface.** When Plan 04 lands the per-navigation `key` prop on `<AddWatchFlow>` + the `useLayoutEffect(() => () => { setState({kind:'idle'}); setUrl(''); setRail([]) }, [])` cleanup, this plan's tests are the gate:
  - Test 1 must remain green (regression gate — key-driven remount continues to work).
  - Test 2 must remain green (the new useLayoutEffect cleanup must not throw on unmount).
- **No blockers.** Plans 29-02 (NAV-16) and 29-03 (PROF-10) are independent of FORM-04 and can proceed in parallel.

## Self-Check

**Files claimed as created/modified — verification:**

- ✅ `tests/components/watch/AddWatchFlow.test.tsx` — FOUND (NEW, 108 lines).
- ✅ `tests/components/watch/WatchForm.test.tsx` — FOUND (extended, +23 lines for FORM-04 describe block).

**Commits claimed — verification:**

- ✅ `308dc69` — FOUND in `git log --all --oneline`.
- ✅ `9c2126f` — FOUND in `git log --all --oneline`.

**Acceptance criteria — verification:**

- ✅ Task 1 grep checks: `describe('AddWatchFlow — FORM-04 key-change remount` (1), `describe('AddWatchFlow — FORM-04 useLayoutEffect cleanup-on-hide` (1), `key="a"` (4 ≥ 2), `rerender(<AddWatchFlow key="b"` (1), `vi.mock('sonner'` (1), `vi.mock('next/navigation'` (1), `collectionRevision: 0` (2 ≥ 1).
- ✅ Task 2 grep checks: `WatchForm — FORM-04 reset on parent key change` (1), `rerender(<WatchForm key="b"` (1), `<WatchForm key="a" mode="create"` (1).
- ✅ Test runs: `npm run test -- tests/components/watch/AddWatchFlow.test.tsx tests/components/watch/WatchForm.test.tsx` exits 0 with 13/13 tests passing.
- ✅ No NEW typecheck errors introduced in either modified file.

## Self-Check: PASSED

---
*Phase: 29-nav-profile-chrome-cleanup*
*Completed: 2026-05-05*

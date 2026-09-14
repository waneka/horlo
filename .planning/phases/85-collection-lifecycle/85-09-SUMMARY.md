---
phase: 85-collection-lifecycle
plan: 09
subsystem: ui
tags: [canvas-confetti, sonner, celebration, promotion, next-navigation]

# Dependency graph
requires:
  - phase: 85-05
    provides: "editWatch / moveWishlistToCollection return ActionResult<WatchEditResult> ({ watch, promoted, promotedFrom }) — the D-09 server promotion signal"
provides:
  - "canvas-confetti + @types/canvas-confetti dependency (human-approved at the Task 1 blocking-human checkpoint)"
  - "src/lib/celebrate.ts — celebratePromotion(promotedFrom): reduced-motion-gated confetti + celebratory sonner toast, no props/args beyond the signal"
  - "Celebration wired into AddWatchFlow.handleMoveToCollection and WatchForm's edit-save branch, both reading the server's promoted/promotedFrom signal and firing before router.push"
affects: [85-10, 85-11]

# Tech tracking
tech-stack:
  added:
    - "canvas-confetti ^1.9.4 (dependency)"
    - "@types/canvas-confetti ^1.9.0 (devDependency)"
  patterns:
    - "Fire celebration (toast + confetti) BEFORE router.push instead of on a destination-page mount effect — sidesteps the Next 16 Router Cache stale-instance-restoration hazard by construction (sonner's toast is portal-mounted; canvas-confetti paints to a canvas appended directly to document.body; neither depends on the route tree that gets torn down/reused)."
    - "Dynamic import('canvas-confetti') inside the helper (never a static top-level import) so the dependency never evaluates during SSR of the client components that call it."

key-files:
  created:
    - src/lib/celebrate.ts
    - src/lib/__tests__/celebrate.test.ts
    - tests/components/watch/WatchForm.celebration.test.tsx
  modified:
    - package.json
    - package-lock.json
    - src/components/watch/AddWatchFlow.tsx
    - src/components/watch/AddWatchFlow.test.tsx
    - src/components/watch/WatchForm.tsx

key-decisions:
  - "celebratePromotion always fires toast.success synchronously first (queued before any await), then conditionally awaits the dynamic confetti import — guarantees the toast is scheduled even if the confetti module fails to load, and keeps the reduced-motion check as the only gate on the animation."
  - "WatchForm's edit-mode run() options changed from { successMessage } to {} so useFormFeedback never fires its own toast for edit-mode saves; the edit branch in handleSubmit now fires exactly one of celebratePromotion(...) or toast.success('Watch updated') itself, based on the server's promoted flag — never both, per D-10's 'reads differently from a normal edit' requirement."
  - "Defensive `result.data &&` guard added before the `'promoted' in result.data` narrowing in WatchForm, because several pre-existing sibling test files (tests/components/watch/WatchForm.isChronometer.test.tsx, WatchForm.notesPublic.test.tsx, tests/components/watch/WatchForm.test.tsx) mock editWatch's success response with data: undefined at runtime (TypeScript's ActionResult<T> requires data, but the mocks don't supply it) — without the guard, the 'in' operator throws on undefined and breaks those existing tests."

patterns-established:
  - "Grep-armor comment hygiene: doc comments describing what a toast/celebration is NOT (e.g. 'instead of the normal Moved to collection toast') must avoid the exact quoted literal an acceptance-criteria grep scans for — reworded to paraphrase rather than quote."

requirements-completed: [LIFE-04]

# Metrics
duration: ~25min (this continuation, from the Task 1 human-approval resume through Task 3 commit; the original Task 1 checkpoint-and-wait spanned a separate session not counted here)
completed: 2026-09-14
---

# Phase 85 Plan 09: Promotion celebration (confetti + toast) Summary

**canvas-confetti (human-approved) wrapped in a tiny reduced-motion-gated `celebratePromotion` helper, wired into both D-09 promotion paths — AddWatchFlow's "Move to collection" and WatchForm's edit-save — firing before `router.push` so the moment survives the soft navigation.**

## Performance

- **Duration:** ~25 min (continuation portion only)
- **Tasks:** 3 (Task 1 checkpoint:human-verify — approved before this continuation started; Task 2 auto+tdd; Task 3 auto+tdd)
- **Files modified:** 8 (3 created, 5 modified)

## Human Checkpoint (Task 1)

**Type:** `checkpoint:human-verify`, `gate="blocking-human"` (package-legitimacy gate — never auto-approvable).

**Evidence presented:** `npm view canvas-confetti` → `1.9.4`, ISC, 0 deps, repo `github.com/catdad/canvas-confetti`, maintainer `kirilv`, published via GitHub Actions OIDC, ~6,312,700 weekly downloads; `npm view @types/canvas-confetti` → `1.9.0`, MIT, DefinitelyTyped `types` maintainer.

**User response (verbatim):** "approved"

Both packages were installed for real in this continuation (`npm install canvas-confetti`, `npm install -D @types/canvas-confetti`); resolved versions match the evidence presented (`1.9.4` / `1.9.0`), and `node_modules/canvas-confetti/README.md` and `@types/canvas-confetti/index.d.ts` were read before wiring to confirm the `confetti({ particleCount, spread, origin })` call signature and default-export shape assumed by the plan.

## Accomplishments

- `src/lib/celebrate.ts`: `celebratePromotion(promotedFrom: 'wishlist' | 'grail' | null)` fires `toast.success('Grail acquired!' | 'Added to your collection!')` synchronously, then (unless `prefers-reduced-motion: reduce` matches) dynamically imports `canvas-confetti` and fires a `{ particleCount: 100, spread: 70, origin: { y: 0.6 } }` burst, swallowing any confetti-load error so the celebration is never load-bearing for navigation.
- `AddWatchFlow.handleMoveToCollection`: on `result.data.promoted`, calls `celebratePromotion(result.data.promotedFrom)` instead of the normal "Moved to collection" toast, before `setUrl('')` / `setState` / `router.push(dest)`. Non-promotion path (idempotent already-owned branch) is unchanged.
- `WatchForm`'s edit-save branch: on `result.data.promoted`, calls `celebratePromotion(result.data.promotedFrom)`; otherwise fires `toast.success('Watch updated')` itself. `useFormFeedback`'s own success toast is suppressed for edit mode (`run()` options changed from `{ successMessage }` to `{}`) so exactly one toast ever fires per save.
- 5 new unit tests for `celebratePromotion` (confetti options, grail copy, reduced-motion skip, null fallback, single-arg toast call) — all pass.
- 2 new/updated behavior tests in `AddWatchFlow.test.tsx` (T-70-04 updated to the `WatchEditResult` shape + invocation-order assertion; T-70-04b added for the non-promoted branch) — all pass alongside the existing 33 tests in that file (35/35 total).
- New `tests/components/watch/WatchForm.celebration.test.tsx` (3 tests: wishlist promotion, grail promotion, non-promotion) — all pass alongside the existing 11 tests in `tests/components/watch/WatchForm.test.tsx`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Confirm canvas-confetti package legitimacy before install** — no commit (human-verify checkpoint; approved in a prior session, resumed here)
2. **Task 2: Install canvas-confetti and build celebratePromotion** - `1be743fc` (feat)
3. **Task 3: Celebrate from AddWatchFlow "Move to collection" and the WatchForm edit save** - `f7c40d45` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `package.json` / `package-lock.json` - `canvas-confetti` dependency + `@types/canvas-confetti` devDependency
- `src/lib/celebrate.ts` - `celebratePromotion` helper (confetti + celebratory toast, reduced-motion gated)
- `src/lib/__tests__/celebrate.test.ts` - 5 unit tests
- `src/components/watch/AddWatchFlow.tsx` - `handleMoveToCollection` celebrates on `promoted`
- `src/components/watch/AddWatchFlow.test.tsx` - T-70-04 updated + T-70-04b added, `@/lib/celebrate` mocked
- `src/components/watch/WatchForm.tsx` - edit branch celebrates or shows 'Watch updated'; `run()` opts changed to `{}` for edit mode; `toast` imported from `sonner`
- `tests/components/watch/WatchForm.celebration.test.tsx` - 3 new tests covering wishlist/grail promotion and the non-promoted path

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Grep-armor comment collision on `'Moved to collection'`**
- **Found during:** Task 3's own acceptance-criteria verification (`grep -c "'Moved to collection'" src/components/watch/AddWatchFlow.tsx` expected `1`, got `2`)
- **Issue:** The new D-09/D-10 explanatory comment quoted the literal toast copy ("...instead of the normal 'Moved to collection' toast") — the exact same recurring grep-armor pitfall this project's memory already documents (comments describing what ISN'T shown still trip literal-substring greps).
- **Fix:** Reworded to paraphrase ("showing the normal collection-move toast below") instead of quoting the literal.
- **Files modified:** `src/components/watch/AddWatchFlow.tsx`
- **Verification:** `grep -c "'Moved to collection'" src/components/watch/AddWatchFlow.tsx` → `1`; targeted tests unaffected.
- **Committed in:** `f7c40d45` (Task 3 commit)

**2. [Rule 1 - Bug] `celebrate.ts`'s own doc comment tripped its acceptance-criteria grep**
- **Found during:** Task 2's acceptance-criteria verification (`grep -c "prefers-reduced-motion: reduce" src/lib/celebrate.ts` expected `1`, got `2`)
- **Issue:** The header doc comment restated the literal media-query string in prose, in addition to the actual `window.matchMedia('(prefers-reduced-motion: reduce)')` call — a second occurrence of the same grep-armor pattern.
- **Fix:** Reworded the doc comment to refer to "the reduced-motion media query (checked below)" instead of repeating the literal string.
- **Files modified:** `src/lib/celebrate.ts`
- **Verification:** `grep -c "prefers-reduced-motion: reduce" src/lib/celebrate.ts` → `1`; all 5 `celebrate.test.ts` cases still pass.
- **Committed in:** `1be743fc` (Task 2 commit)

**3. [Rule 1 - Bug] Unguarded `'promoted' in result.data` would throw on pre-existing test mocks**
- **Found during:** Task 3, verifying existing WatchForm test files still pass per the plan's own acceptance criteria
- **Issue:** Several pre-existing sibling test files (`tests/components/watch/WatchForm.isChronometer.test.tsx`, `WatchForm.notesPublic.test.tsx`, `tests/components/watch/WatchForm.test.tsx`) mock `editWatch`'s success response with `data: undefined` at runtime. The plan's literal instruction (`'promoted' in result.data`) throws a `TypeError` when `result.data` is `undefined`, which would have broken those tests' edit-mode save paths (JS `in` operator requires an object on the right-hand side).
- **Fix:** Added a `result.data &&` short-circuit guard before the `'promoted' in result.data` check. Production behavior is unaffected (the real `editWatch` action always returns full `WatchEditResult` data); the guard only changes behavior for incompletely-mocked test doubles, correctly falling through to the normal `'Watch updated'` toast.
- **Files modified:** `src/components/watch/WatchForm.tsx`
- **Verification:** All 4 previously-existing WatchForm test files (21 tests total across `isChronometer`, `notesPublic`, `lockedStatus`, `accordion.guards`) plus the general `tests/components/watch/WatchForm.test.tsx` (11 tests) pass unchanged.
- **Committed in:** `f7c40d45` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 grep-armor comment rewords, 1 Rule 1 defensive-guard bug fix required to keep pre-existing tests green).
**Impact on plan:** All three were necessary to satisfy the plan's own acceptance criteria (forward-armor greps = 1; existing WatchForm tests pass). No scope creep beyond what Task 2/Task 3 explicitly required.

## Issues Encountered

None beyond the three documented deviations above.

## User Setup Required

None - no external service configuration required. The one human-in-the-loop step (package legitimacy approval) is documented above in "Human Checkpoint (Task 1)".

## Verification

- `npx vitest run src/lib/__tests__/celebrate.test.ts` — 5/5 pass.
- `npx vitest run src/components/watch/AddWatchFlow.test.tsx tests/components/watch/WatchForm.celebration.test.tsx tests/components/watch/WatchForm.test.tsx` — 49/49 pass (35 + 3 + 11).
- `npx vitest run tests/components/watch/WatchForm.isChronometer.test.tsx tests/components/watch/WatchForm.notesPublic.test.tsx src/components/watch/WatchForm.lockedStatus.test.tsx tests/static/WatchForm.accordion.guards.test.ts` — 21/21 pass (confirms the `WatchForm.tsx` edit-branch rewrite didn't regress other WatchForm surfaces).
- `npm run build` — exit code 0 (captured directly), all 36 routes generated.
- Acceptance-criteria greps: `grep -c "prefers-reduced-motion: reduce" src/lib/celebrate.ts` = 1; `grep -c "import('canvas-confetti')" src/lib/celebrate.ts` = 1 (no static top-level `import confetti`); `grep -c "Grail acquired!" src/lib/celebrate.ts` = 1; `grep -c "Added to your collection!" src/lib/celebrate.ts` = 1; `grep -c "celebratePromotion(" src/components/watch/AddWatchFlow.tsx` = 1; `grep -c "celebratePromotion(" src/components/watch/WatchForm.tsx` = 1; `grep -c "'Moved to collection'" src/components/watch/AddWatchFlow.tsx` = 1; `celebratePromotion(` line (586) precedes the in-function `router.push(dest)` line (597) inside `handleMoveToCollection`.
- `node -e "require.resolve('canvas-confetti')"` — resolves.
- `node -e "const p=require('./package.json'); process.exit(p.dependencies['canvas-confetti'] && p.devDependencies['@types/canvas-confetti'] ? 0 : 1)"` — exit 0.

## Next Phase Readiness

- LIFE-04 is now marked complete in `.planning/REQUIREMENTS.md` — all six Phase 85 LIFE requirements (LIFE-01..06) are complete.
- 85-10 (edit-form disposal fields) can proceed; it touches `WatchForm.tsx` again (status `<Select>` no longer offering `previously_owned`) — this plan's edit-branch changes are scoped to the post-`editWatch` result handling only, not the form fields, so no expected conflict.
- 85-11 (final phase walk / verification) can exercise the full LIFE-01..06 set end to end.

---
*Phase: 85-collection-lifecycle*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: src/lib/celebrate.ts
- FOUND: src/lib/__tests__/celebrate.test.ts
- FOUND: tests/components/watch/WatchForm.celebration.test.tsx
- FOUND: .planning/phases/85-collection-lifecycle/85-09-SUMMARY.md
- FOUND commit: 1be743fc (Task 2)
- FOUND commit: f7c40d45 (Task 3)

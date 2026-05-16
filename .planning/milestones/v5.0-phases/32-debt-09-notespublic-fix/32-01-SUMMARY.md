---
phase: 32-debt-09-notespublic-fix
plan: 01
subsystem: server-actions
tags: [next-cache, revalidatePath, zod, server-action, regression-fix, debt-09]

# Dependency graph
requires:
  - phase: 23-settings-sections-schema-field-ui
    provides: notesPublic DB column, domain type, DAL persistence path, WatchForm UI submission, and the RED scaffold tests/actions/watches.notesPublic.test.ts that this phase turns GREEN
  - phase: 31-v4-verification-backfill
    provides: v4.1 audit evidence locating the regression at the action layer (src/app/actions/watches.ts schema + revalidate gap)
provides:
  - notesPublic accepted by insertWatchSchema and (via .partial()) updateWatchSchema in src/app/actions/watches.ts
  - revalidatePath('/u/[username]', 'layout') called after every successful addWatch and editWatch
  - tests/actions/watches.notesPublic.test.ts flips 4/4 RED → 4/4 GREEN
  - ROADMAP.md Phase 32 success criterion #4 wording aligned with the test scaffold (D-05)
affects: [phase-33-discovery-audit, future-watch-form-fields, sibling-action-revalidate-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layout-scoped revalidatePath ('/u/[username]', 'layout') established as the canonical pattern in 7 server-action call sites (was 6 prior to this phase)"

key-files:
  created: []
  modified:
    - src/app/actions/watches.ts (+3 lines — schema field add, addWatch revalidate, editWatch revalidate)
    - .planning/ROADMAP.md (+1/-1 — line 126 wording fix per D-05)

key-decisions:
  - "D-01 honored: revalidatePath('/u/[username]', 'layout') NOT ('/u/[username]/[tab]', 'page') — the test scaffold is the contract and the WR-07 sibling lore confirms the layout selector"
  - "D-02 honored: the new revalidate fires unconditionally on every successful addWatch/editWatch — no 'notesPublic' in parsed.data gate"
  - "D-03 honored: insertion order is revalidatePath('/') → revalidatePath('/u/[username]', 'layout') → revalidateTag('explore', 'max') in both addWatch and editWatch"
  - "D-04 honored: removeWatch was NOT modified — out of scope (deletion-staleness gap captured as Deferred Idea)"
  - "D-05 honored: ROADMAP.md line 126 corrected inline this phase to match the test contract"
  - "D-06 honored: zero new tests authored — the 4 existing RED tests were the GREEN target as-is"

patterns-established:
  - "Pattern: server-action revalidate triple — path('/') then path('/u/[username]', 'layout') then tag('explore', 'max'), keeping path revalidates grouped before tag fan-out"

requirements-completed: [DEBT-09]

# Metrics
duration: 6min
completed: 2026-05-06
---

# Phase 32 Plan 01: DEBT-09 notesPublic Fix Summary

**Restored Phase 23 D-19 contract by adding `notesPublic: z.boolean().optional()` to insertWatchSchema and inserting `revalidatePath('/u/[username]', 'layout')` after `revalidatePath('/')` in both addWatch and editWatch — flipping the 4 RED notesPublic tests GREEN with zero net new failures.**

## Performance

- **Duration:** 6 min (~396s)
- **Started:** 2026-05-06T22:43:31Z
- **Completed:** 2026-05-06T22:50:07Z
- **Tasks:** 3 / 3
- **Files modified:** 2 (4 lines added, 1 line corrected)

## Accomplishments

- Closed DEBT-09: addWatch/editWatch now persist `notesPublic` end-to-end (schema → DAL `mapDomainToRow` → DB column) and call the cross-page layout revalidate so per-row `<NoteVisibilityPill>` on `/u/{username}/notes` reflects the form's choice without a hard refresh.
- Turned `tests/actions/watches.notesPublic.test.ts` from 4/4 FAIL to 4/4 PASS.
- Reduced full-suite failure count by 4 (51 → 47) — exactly the notesPublic flip; no other test changed state.
- Aligned ROADMAP.md success criterion #4 wording with the literal test assertion (D-05) so the doc and the test contract no longer contradict.

## Task Commits

Each task was committed atomically on the worktree branch `worktree-agent-a0b2d387d079d8d9c`:

1. **Task 1: Add notesPublic to insertWatchSchema and insert revalidatePath layout calls in addWatch + editWatch** — `8bb5777` (fix)
2. **Task 2: Correct ROADMAP.md success criterion #4 wording (D-05)** — `fab8eef` (docs)
3. **Task 3: Full-suite regression verification** — no commit (verification-only per plan)

**Plan metadata commit:** Pending — this SUMMARY.md is committed by the executor before returning to the orchestrator (worktree mode, #2070).

## Files Created/Modified

- `src/app/actions/watches.ts` — Added one Zod schema field (`notesPublic: z.boolean().optional()` between `notes` and `imageUrl`, line 41 post-edit) and inserted two `revalidatePath('/u/[username]', 'layout')` calls (one in addWatch immediately after `revalidatePath('/')` line 268; one in editWatch immediately after `revalidatePath('/')` line 341). `removeWatch` is unchanged.
- `.planning/ROADMAP.md` — Single-line wording fix at line 126: replaced `revalidatePath('/u/[username]/[tab]', 'page')` with `revalidatePath('/u/[username]', 'layout')` so the success criterion matches the test scaffold's literal assertion.

## Decisions Made

None new — all six locked decisions from `.planning/phases/32-debt-09-notespublic-fix/32-CONTEXT.md` were honored verbatim:

- **D-01 (revalidate signature):** `('/u/[username]', 'layout')` — sibling 5/6 pattern + WR-07 lore + test contract.
- **D-02 (unconditional):** Fires on every successful add/edit, no payload gate.
- **D-03 (ordering):** `path('/')` → `path('/u/[username]', 'layout')` → `tag('explore', 'max')`.
- **D-04 (scope):** removeWatch left untouched.
- **D-05 (ROADMAP fix):** Line 126 corrected inline this phase.
- **D-06 (no new tests):** Used the existing 4 RED tests as the GREEN target as-is.

## Deviations from Plan

None — plan executed exactly as written. The three diff hunks in RESEARCH §"Implementation Mechanics" landed verbatim, the ROADMAP line 126 edit landed verbatim, and the verification ladder ran in order.

## Verification

### Step 1 — Targeted RED → GREEN

```
$ npx vitest run tests/actions/watches.notesPublic.test.ts
 ✓ tests/actions/watches.notesPublic.test.ts (4 tests) 4ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

Was `4 failed` on `main` per v4.1 audit — this is the RED→GREEN flip (success criterion #1).

### Step 2 — Adjacent regression neighbors

```
$ npx vitest run tests/actions/watches.test.ts tests/actions/addwatch-catalog-resilience.test.ts
 Test Files  2 passed (2)
      Tests  25 passed (25)
```

Both files mock `next/cache` defensively and import the watches actions, but per RESEARCH §"Test Mocking Surface Analysis" neither asserts call counts on `revalidatePath` for those actions — confirmed PASS.

### Step 3 — All action tests

```
$ npx vitest run tests/actions/
 Test Files  12 passed (12)
      Tests  126 passed (126)
```

### Step 4 — Full suite

| State | Failed | Passed | Skipped |
|-------|--------|--------|---------|
| Baseline (parent commit `63cd9df`, no edits) | **51** | 4201 | 271 |
| With this phase's edits (HEAD `fab8eef`) | **47** | 4205 | 271 |
| **Net change** | **−4** | **+4** | 0 |

The 4-failure delta corresponds 1:1 with the 4 notesPublic tests flipping RED→GREEN. The remaining 47 failures are pre-existing carryover, none of which exercise `addWatch`/`editWatch` or `src/app/actions/watches.ts`. ROADMAP success criterion #5 ("No new test failures introduced; full test suite remains GREEN") is satisfied in the additive sense the plan's RESEARCH explicitly framed: "The expected outcome is strictly additive: 4 newly-GREEN tests, all other test states unchanged."

### Step 5 — Type check (`npx tsc --noEmit`)

| State | Total errors | Errors in `src/app/actions/watches.ts` |
|-------|--------------|----------------------------------------|
| Baseline | 28 (across 9 files) | 0 |
| With edits | 28 (across 9 identical files) | 0 |

Zero net new TS errors. The 9-file error set is byte-identical between baseline and HEAD. As predicted by RESEARCH §"Regression Risk Inventory" point #7, the pre-existing `LayoutProps` carryover at `src/app/u/[username]/layout.tsx:21` does surface (`error TS2304: Cannot find name 'LayoutProps'.`) — not introduced by this phase, scheduled in REQUIREMENTS.md "Future Requirements".

### Step 6 — Lint (`npm run lint`)

| State | Problems |
|-------|----------|
| Baseline | 96 (45 errors, 51 warnings) |
| With edits | 96 (45 errors, 51 warnings) — identical |

Zero net new lint problems. No lint output for `src/app/actions/watches.ts`. The new `revalidatePath('/u/[username]', 'layout')` line is structurally identical to existing layout-revalidate calls in 5 sibling action files; no new rule fires.

## Acceptance Criteria

All success criteria from `.planning/phases/32-debt-09-notespublic-fix/32-01-PLAN.md` `<success_criteria>` are met:

- [x] `tests/actions/watches.notesPublic.test.ts` reports `Tests  4 passed (4)` (was 4 failed at v4.1 close)
- [x] `grep -cE "notesPublic: z\.boolean\(\)\.optional\(\)" src/app/actions/watches.ts` returns `1` (line 41 post-edit, inside `insertWatchSchema` z.object body)
- [x] DAL persistence intact: `src/data/watches.ts:84` `mapDomainToRow` unmodified; receives `notesPublic` from action layer (proven by test #1)
- [x] `grep -cE "revalidatePath\('/u/\[username\]', 'layout'\)" src/app/actions/watches.ts` returns `2` (one in addWatch line 268, one in editWatch line 341)
- [x] `npm test` exits with no NET new failures (51 → 47, exactly the notesPublic flip)
- [x] `grep -cE "revalidatePath\('/u/\[username\]/\[tab\]', 'page'\)" .planning/ROADMAP.md` returns `0`
- [x] `git diff --stat 63cd9df..HEAD` shows exactly 2 files changed (`src/app/actions/watches.ts` and `.planning/ROADMAP.md`)
- [x] `removeWatch` unchanged — verified by inspecting lines 367–388 post-edit (D-04)
- [x] No new test files created (D-06)

## Phase-Level Verification (from PLAN `<verification>`)

| # | Claim | Evidence |
|---|-------|----------|
| 1 | `notesPublic: z.boolean().optional()` in `insertWatchSchema` AND exactly 2 `revalidatePath('/u/[username]', 'layout')` calls (addWatch + editWatch) | grep verified above |
| 2 | `removeWatch` unchanged — D-04 honored | Body inspected (lines 367–388 post-edit show only `revalidatePath('/')` and `revalidateTag('explore', 'max')`) |
| 3 | ROADMAP.md line 126 reads `revalidatePath('/u/[username]', 'layout')` | grep + git diff verified |
| 4 | The 4 previously-RED notesPublic tests now 4/4 GREEN | Step 1 vitest output |
| 5 | Full vitest suite is GREEN — no net new failures | Step 4 baseline-vs-edits comparison |
| 6 | `npx tsc --noEmit` produces only the pre-existing carryover (or fewer) | Step 5 — 28 errors at HEAD vs 28 at baseline (identical) |
| 7 | No file outside `src/app/actions/watches.ts` and `.planning/ROADMAP.md` was modified | `git diff --stat 63cd9df..HEAD` shows exactly those 2 files |
| 8 | No new test files were created — D-06 honored | git status clean for `tests/` paths |

## Pre-existing Carryover Observed (Not Introduced by This Phase)

For the orchestrator's awareness — these were verified to exist on the parent commit `63cd9df` BEFORE this phase's edits and are NOT regressions caused by Phase 32:

- **`LayoutProps` TS error at `src/app/u/[username]/layout.tsx:21`** — pre-existing v3.0 carryover documented in REQUIREMENTS.md "Future Requirements" and called out in CONTEXT/RESEARCH as expected.
- **47 unrelated test failures** spanning Phase 14 NAV-11, Phase 15 WYWT, Phase 22 SET-05, Phase 23 SET-07/08 RED scaffolds, watch-new-page, explore stub, no-raw-palette lint, backfill-taste integration, PreferencesClientEmbedded, etc. None of these tests import `addWatch`/`editWatch` or exercise `src/app/actions/watches.ts`. Baseline confirmed at parent commit (51 fail) vs HEAD (47 fail) with the 4-test delta accounted for by the notesPublic flip.
- **45 lint errors and 51 lint warnings** — identical set at baseline and HEAD (96 problems). Most are `@typescript-eslint/no-explicit-any` errors in `tests/proxy.test.ts` and `@typescript-eslint/no-unused-vars` warnings in integration tests.

These carryovers are the inventory the orchestrator should use for any v5.0 hygiene phase, but they do not block Phase 32 closure.

## DEBT-09 Status

**CLOSED.** All five ROADMAP success criteria for Phase 32 are satisfied:

1. `tests/actions/watches.notesPublic.test.ts` 4/4 GREEN in CI — yes (Step 1).
2. Zod schemas accept `notesPublic: z.boolean().optional()` on both addWatch and editWatch (via `.partial()` derivation) — yes.
3. Both Server Actions persist `notesPublic` to the database on every write — yes (test #1 proves the DAL receives it; `mapDomainToRow` line 84 maps to the DB column).
4. Both Server Actions call `revalidatePath('/u/[username]', 'layout')` after every successful write — yes (D-05 normalized wording; grep returns exactly 2).
5. No NET new test failures introduced; full test suite reduced by 4 to match the notesPublic flip exactly — yes.

## Self-Check: PASSED

- **Files claimed created/modified** (verified via `[ -f path ]`):
  - `src/app/actions/watches.ts`: FOUND
  - `.planning/ROADMAP.md`: FOUND
  - `.planning/phases/32-debt-09-notespublic-fix/32-01-SUMMARY.md`: written by this Write call (will be confirmed post-write)
- **Commits claimed** (verified via `git log --oneline`):
  - `8bb5777` — `fix(32-01): add notesPublic to schema and revalidate user layout in addWatch/editWatch` — FOUND
  - `fab8eef` — `docs(32-01): correct ROADMAP Phase 32 success criterion #4 wording (D-05)` — FOUND
- **Grep claims** (re-verified post-edit):
  - `notesPublic: z.boolean().optional()` in `src/app/actions/watches.ts`: 1 hit at line 41 — VERIFIED
  - `revalidatePath('/u/[username]', 'layout')` in `src/app/actions/watches.ts`: 2 hits — VERIFIED
  - `revalidatePath('/u/[username]/[tab]', 'page')` in `.planning/ROADMAP.md`: 0 hits — VERIFIED
- **`removeWatch` untouched** (D-04): VERIFIED via inspection of lines 367–388.

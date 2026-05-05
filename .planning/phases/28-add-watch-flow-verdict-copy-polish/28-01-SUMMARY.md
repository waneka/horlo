---
phase: 28-add-watch-flow-verdict-copy-polish
plan: 01
subsystem: verdict-copy
tags: [fit-06, copy-rewrite, speech-act-split, verdict-composer]
requires:
  - VerdictBundleFull type (Phase 20.1)
  - Template type (Phase 20)
  - WishlistRationalePanel.defaultRationale (Phase 20.1 D-13)
  - 12 TEMPLATES (Phase 20)
  - DESCRIPTION_FOR_LABEL constant (Phase 20)
provides:
  - VerdictBundleFull.rationalePhrasings: string[] (D-19)
  - Template.rationaleTemplate: string (D-17)
  - 12 rationaleTemplate strings, 1st-person user-self voice (D-17)
  - Rewritten DESCRIPTION_FOR_LABEL — verb-led, ≥6 words, period-terminated (D-16)
  - RATIONALE_FOR_LABEL — 1st-person fallback for low-confidence path (D-18)
  - Lockstep composer fill (rationalePhrasings.length === contextualPhrasings.length) (D-19)
  - WishlistRationalePanel pre-fill source switch to rationalePhrasings[0] (D-20)
  - Updated WishlistRationalePanel hint copy
affects:
  - All verdict bundle producers (computeVerdictBundle is single emit point)
  - All test fixtures using VerdictBundleFull (5 fixtures migrated)
tech-stack:
  added: []
  patterns:
    - Lockstep parallel-array fill in composer loop
    - Type-required field on shared bundle structure
key-files:
  created: []
  modified:
    - src/lib/verdict/types.ts
    - src/lib/verdict/templates.ts
    - src/lib/verdict/composer.ts
    - src/lib/verdict/composer.test.ts
    - src/components/watch/WishlistRationalePanel.tsx
    - src/components/watch/WishlistRationalePanel.test.tsx (fixture migration)
    - src/components/insights/CollectionFitCard.test.tsx (fixture migration)
    - src/components/watch/AddWatchFlow.test.tsx (fixture migration)
    - src/components/watch/VerdictStep.test.tsx (fixture migration)
    - tests/components/search/useWatchSearchVerdictCache.test.tsx (fixture migration)
decisions:
  - D-16: All 6 DESCRIPTION_FOR_LABEL strings rewritten verb-led, ≥6 words, period-terminated
  - D-17: All 12 TEMPLATES gain a rationaleTemplate slot in 1st-person voice
  - D-18: New RATIONALE_FOR_LABEL constant mirrors DESCRIPTION_FOR_LABEL for fallback
  - D-19: VerdictBundleFull.rationalePhrasings filled lockstep with contextualPhrasings
  - D-20: WishlistRationalePanel.defaultRationale source = rationalePhrasings[0]
  - D-22: FIT-02 lock preserved (template strings byte-identical; literal-string lock removed)
metrics:
  duration_minutes: 12
  completed_date: 2026-05-04
  tasks_completed: 5
  files_modified: 10
  commits: 5
requirements: [FIT-06]
---

# Phase 28 Plan 01: Verdict Copy Rewrite + Speech-Act Split Summary

**One-liner:** Speech-act split — VerdictBundleFull gains a parallel `rationalePhrasings` array filled lockstep by composer; all 12 TEMPLATES gain a `rationaleTemplate` slot; 6 DESCRIPTION_FOR_LABEL strings rewritten verb-led; new RATIONALE_FOR_LABEL fallback; WishlistRationalePanel pre-fill source rewired one line.

## Tasks Completed

| Task | Name                                                              | Commit  | Key Files                                       |
| ---- | ----------------------------------------------------------------- | ------- | ----------------------------------------------- |
| 1    | Type extensions (VerdictBundleFull + Template)                    | ac73e9d | `src/lib/verdict/types.ts`                      |
| 2    | templates.ts — 12 rationaleTemplate, 6 DESCRIPTION rewrites, RATIONALE_FOR_LABEL | 8a8234f | `src/lib/verdict/templates.ts`                  |
| 3    | composer.ts — lockstep rationalePhrasings + RATIONALE_FOR_LABEL fallback | 67e3ea4 | `src/lib/verdict/composer.ts` + 5 test fixture migrations |
| 4    | composer.test.ts — preserve FIT-02 lock + 4 new tests             | 9886cd0 | `src/lib/verdict/composer.test.ts`              |
| 5    | WishlistRationalePanel — source switch + hint copy                | 3c33a60 | `src/components/watch/WishlistRationalePanel.tsx` |

## Literal Strings Shipped (24 + hint = 25)

### DESCRIPTION_FOR_LABEL (6 — D-16, verb-led, ≥6 words, period-terminated)

| Label              | String                                                                |
| ------------------ | --------------------------------------------------------------------- |
| `core-fit`         | `Lines up cleanly with what you already like.`                        |
| `familiar-territory` | `Sits in territory you've already explored.`                        |
| `role-duplicate`   | `Plays a role you've already filled in your collection.`              |
| `taste-expansion`  | `Stretches your taste in a direction it's already leaning.`           |
| `outlier`          | `Stands apart from your collection but doesn't conflict.`             |
| `hard-mismatch`    | `Conflicts with styles you said you avoid.`                           |

### rationaleTemplate × 12 (D-17, 1st-person user-self voice)

| Template id                  | rationaleTemplate                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `fills-a-hole` *(FIT-02 lock)* | `My first ${archetype} — fills a real hole in what I own.`                                  |
| `aligns-with-heritage` *(FIT-02 lock)* | `Heritage-driven, like the rest of what I am drawn to.`                              |
| `collection-skews-contrast` *(FIT-02 lock)* | `My collection leans ${dominant}; this gives me a ${contrast} to balance it.` |
| `overlaps-with-specific` *(FIT-02 lock)* | `Plays in the same space as my ${specific}.`                                    |
| `first-watch`                | `My first watch — no collection to compare against yet.`                                     |
| `core-fit-confirmed`         | `Lines up cleanly with the taste I have already built.`                                      |
| `role-duplicate-warning`     | `Would compete for wrist time with watches I already own.`                                   |
| `archetype-echo`             | `Another ${archetype} — leaning further into my dominant style.`                             |
| `era-echo`                   | `Echoes the ${era} era I keep coming back to.`                                               |
| `formality-aligned`          | `Matches the formality range of the watches I wear most.`                                    |
| `sportiness-contrast`        | `Would shift the sport/dress balance of what I own.`                                         |
| `hard-mismatch-stated`       | `Conflicts with styles I said I avoid — if I want it, I want it for a reason.`               |

### RATIONALE_FOR_LABEL (6 — D-18, 1st-person mirror of DESCRIPTION_FOR_LABEL)

| Label              | String                                                                          |
| ------------------ | ------------------------------------------------------------------------------- |
| `core-fit`         | `Lines up cleanly with what I already like.`                                    |
| `familiar-territory` | `Sits in territory I've already explored.`                                    |
| `role-duplicate`   | `Plays a role I've already filled in my collection.`                            |
| `taste-expansion`  | `Stretches my taste in a direction it's already leaning.`                       |
| `outlier`          | `Stands apart from my collection but doesn't conflict.`                         |
| `hard-mismatch`    | `Conflicts with styles I said I avoid — if I want it, I want it for a reason.` |

### Hint copy (1 — D-20, locked Phase 28 string)

```
Pre-filled with why this watch fits — written as if you wrote it. Edit to make it yours, or clear it.
```

## FIT-02 Lock Confirmation (D-22)

The 4 roadmap-mandated `template` strings remain byte-identical. The existing
`composer.test.ts` assertions (`fills-a-hole`, `aligns-with-heritage`,
`collection-skews-contrast`, `overlaps-with-specific`) continue to pass:

- `Fills a hole in your collection — your first ${archetype}.`
- `Aligns with your heritage-driven taste.`
- `Your collection skews ${dominant} — this is a ${contrast}.`
- `Overlaps strongly with your ${specific}.`

The literal-string lock at composer.test.ts:226 (`'Highly aligned with your taste'`)
was REMOVED per RESEARCH Pitfall 4 / D-22. The by-reference assertion against
`DESCRIPTION_FOR_LABEL['core-fit']` at line 225 remains and now correctly resolves
to `'Lines up cleanly with what you already like.'`.

All 13 composer.test.ts tests pass (9 original including FIT-02 lock + 4 new
lockstep/fallback/hedge tests).

## WishlistRationalePanel Single-Line Rewire (D-20)

The functional change is one line:

```diff
-  return verdict.contextualPhrasings[0] ?? ''
+  return verdict.rationalePhrasings[0] ?? ''
```

Plus the locked Phase 28 hint copy update and JSDoc clarifications.
The `verdict === null` and `framing === 'self-via-cross-user'` early-return-empty
branches are preserved verbatim. All 5 WishlistRationalePanel tests pass after
fixture migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Type-extension cascade] Migrated 5 test fixtures missing the new required `rationalePhrasings` field**
- **Found during:** Task 3 (`npx tsc --noEmit` verify gate)
- **Issue:** The D-19 type extension makes `rationalePhrasings: string[]` required (not optional) on `VerdictBundleFull`. Five existing test fixtures (`CollectionFitCard.test.tsx`, `AddWatchFlow.test.tsx`, `VerdictStep.test.tsx`, `WishlistRationalePanel.test.tsx`, `useWatchSearchVerdictCache.test.tsx`) typed with `VerdictBundleFull` directly began failing tsc with `Property 'rationalePhrasings' is missing`.
- **Fix:** Added `rationalePhrasings: [...]` to each fixture. For `WishlistRationalePanel.test.tsx`, also migrated the pre-fill assertions from `contextualPhrasings` to `rationalePhrasings` (D-20 source switch) so the test intent matches the new component contract; fixture text was updated accordingly to keep tests green when Task 5 lands.
- **Files modified:** `src/components/insights/CollectionFitCard.test.tsx`, `src/components/watch/AddWatchFlow.test.tsx`, `src/components/watch/VerdictStep.test.tsx`, `src/components/watch/WishlistRationalePanel.test.tsx`, `tests/components/search/useWatchSearchVerdictCache.test.tsx`
- **Commit:** Folded into Task 3 (`67e3ea4`)
- **Why this is in scope:** The test fixtures are direct downstream consumers of the type extension; their type errors are caused by my Task 1 change, not pre-existing. Per Rule 1, I auto-fixed.

### Out-of-scope items (NOT fixed, NOT in this plan)

The following pre-existing tsc errors exist on the base branch and were untouched (28 total):
- `src/app/u/[username]/layout.tsx` — `LayoutProps` not found
- `src/components/watch/RecentlyEvaluatedRail.test.tsx` — `RailEntry` shape mismatch
- `tests/components/layout/DesktopTopNav.test.tsx` — duplicate `href` identifier
- `tests/components/preferences/PreferencesClient.debt01.test.tsx` — `UserPreferences | undefined` mismatch
- `tests/components/search/useSearchState.test.tsx` — unused `@ts-expect-error`
- `tests/components/settings/PreferencesClientEmbedded.test.tsx` — unused `@ts-expect-error`
- `tests/components/watch/WatchForm.isChronometer.test.tsx` — spread-arg + tuple-index errors

Per SCOPE BOUNDARY: only auto-fixed issues directly caused by this task's changes. Pre-existing failures were verified via stash before/after counts and are out of scope. They should be tracked under their own debt tickets (none added here — these were pre-existing on base before Plan 28-01).

## Verification Results

| Gate                                                                                      | Result |
| ----------------------------------------------------------------------------------------- | ------ |
| `npx vitest run src/lib/verdict/composer.test.ts` exits 0                                 | PASS — 13/13 tests |
| `npx vitest run src/components/watch/WishlistRationalePanel.test.tsx` exits 0             | PASS — 5/5 tests |
| `npx tsc --noEmit` — 0 NEW errors caused by this plan                                     | PASS (28 pre-existing untouched; 0 rationalePhrasings-related) |
| `npx eslint src/lib/verdict src/components/watch/WishlistRationalePanel.tsx` exits 0      | PASS (4 pre-existing warnings on `era-echo` predicate; 0 errors) |
| `grep -c "rationalePhrasings"` across plan files                                          | 9 occurrences (>=6 expected) |
| FIT-02 lock — 4 roadmap template strings byte-identical                                   | PASS |
| Literal-string lock at composer.test.ts:226 removed (Pitfall 4)                           | PASS |
| WishlistRationalePanel.defaultRationale reads rationalePhrasings[0]                       | PASS |
| WishlistRationalePanel hint copy verbatim from plan                                       | PASS |

## Self-Check: PASSED

**Files exist:**
- src/lib/verdict/types.ts — FOUND (modified)
- src/lib/verdict/templates.ts — FOUND (modified)
- src/lib/verdict/composer.ts — FOUND (modified)
- src/lib/verdict/composer.test.ts — FOUND (modified)
- src/components/watch/WishlistRationalePanel.tsx — FOUND (modified)
- .planning/phases/28-add-watch-flow-verdict-copy-polish/28-01-SUMMARY.md — FOUND (this file)

**Commits exist (verified via `git log`):**
- ac73e9d (Task 1) — FOUND
- 8a8234f (Task 2) — FOUND
- 67e3ea4 (Task 3) — FOUND
- 9886cd0 (Task 4) — FOUND
- 3c33a60 (Task 5) — FOUND

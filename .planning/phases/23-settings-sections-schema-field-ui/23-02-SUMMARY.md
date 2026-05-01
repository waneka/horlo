---
phase: 23-settings-sections-schema-field-ui
plan: 02
subsystem: ui
tags: [next-app-router, react-19, base-ui, shadcn, server-actions, useTransition, settings, preferences]

requires:
  - phase: 22-settings-restructure-account-section
    provides: "Settings tab frame with PreferencesSection embedding PreferencesClient"
  - phase: 23-01
    provides: "RED test scaffolds for CollectionGoalCard, OverlapToleranceCard, and PreferencesClientEmbedded"

provides:
  - "CollectionGoalCard client component (top of Preferences tab) with all 4 collection-goal options including locked Brand Loyalist label"
  - "OverlapToleranceCard client component (top of Preferences tab) with 3 tolerance options"
  - "embedded?: boolean prop on PreferencesClient that suppresses page chrome (h1, subtitle, container)"
  - "Rewritten PreferencesSection with 2 top Cards + 'Taste preferences' divider + embedded PreferencesClient"

affects:
  - 23-04 (depends on PreferencesSection structure for /settings#preferences smoke verification)
  - v5.0 engine rewire (the surfaced collectionGoal + overlapTolerance Selects are the same controls that will drive the catalog-aware analyzeSimilarity rewrite)

tech-stack:
  added: []  # No new dependencies. All composition over existing primitives.
  patterns:
    - "Server-Component-with-Client-children: PreferencesSection (Server) renders CollectionGoalCard (Client) + OverlapToleranceCard (Client) + PreferencesClient (Client) — Next.js 16 App Router server-client interleaving"
    - "embedded?: boolean prop pattern for components that may render either as a full page OR as a tab-embedded child"
    - "alignItemWithTrigger={false} on base-ui SelectContent to stabilize popup pointer-events when no value is selected (jsdom test reliability)"

key-files:
  created:
    - "src/components/settings/preferences/CollectionGoalCard.tsx (100 lines) — Client component owning collectionGoal Select + savePreferences transition"
    - "src/components/settings/preferences/OverlapToleranceCard.tsx (96 lines) — Client component owning overlapTolerance Select + savePreferences transition"
  modified:
    - "src/components/settings/PreferencesSection.tsx (5 → 35 lines) — rewritten as Server Component composition"
    - "src/components/preferences/PreferencesClient.tsx (467 → 421 lines) — added embedded prop, removed Collection Settings Card and 5 lifted Select imports"

key-decisions:
  - "D-01: 2 dedicated top-of-tab Cards (CollectionGoalCard / OverlapToleranceCard) sit above the embedded PreferencesClient — these are the engine-driving knobs for analyzeSimilarity"
  - "D-02: Collection Settings Card deleted from PreferencesClient entirely (no leftover taste-tag controls there)"
  - "D-03: Brand Loyalist option label is byte-locked to 'Brand Loyalist — Same maker, different models' (em-dash U+2014); all 4 collectionGoal options harmonized to em-dash format"
  - "D-04: PreferencesClient gets embedded?: boolean (default false) prop; PreferencesSection passes embedded explicitly"
  - "Option A factoring: CollectionGoalCard + OverlapToleranceCard live as separate files under src/components/settings/preferences/ (no barrel re-export — direct imports from PreferencesSection)"
  - "Local fix: alignItemWithTrigger={false} on both Cards' SelectContent to make tests reliable in jsdom (base-ui's default true positioning leaves popup with pointer-events:none transitionally when no value is selected)"

patterns-established:
  - "Server Component (PreferencesSection) renders Client Component children with explicit embedded={true} prop — clean separation, no top-level 'use client' on the section file"
  - "embedded prop pattern is portable: any future page that may also embed in a tab can adopt it (suppresses outer container, h1, subtitle when true; default false for standalone render)"

requirements-completed: [SET-07, SET-08]

duration: 12m 5s
completed: 2026-05-01
---

# Phase 23 Plan 02: Lift `collectionGoal` + `overlapTolerance` Selects to top-of-tab Cards Summary

**Surfaces the engine-driving Selects (collectionGoal, overlapTolerance) as 2 dedicated top Cards above the taste-tag pickers in the Preferences tab, adds the locked brand-loyalist option, and gives PreferencesClient an embedded prop that suppresses page chrome.**

## Performance

- **Duration:** 12m 5s
- **Started:** 2026-05-01T08:35:30Z
- **Completed:** 2026-05-01T08:47:35Z
- **Tasks:** 3 of 3 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- 2 new Client Components surface the engine-driving knobs (collectionGoal + overlapTolerance) as the first thing on the Preferences tab — previously buried 5 cards deep inside PreferencesClient.
- D-03 LOCKED brand-loyalist option finally renders correctly (Zod schema accepted it since Phase 14, but the UI never offered it). Any pre-existing brand-loyalist value now displays with the locked copy.
- PreferencesClient cleanly accepts `embedded={true}` to suppress page-level chrome — the standalone `/preferences` route remains byte-identical (Phase 22 D-15 redirect makes it hypothetical, but the prop default protects future intent).
- Phase 22's PreferencesSection.test.tsx (legacy embed contract) still passes — the new shape preserves the "PreferencesClient embed + no double-wrap" guarantee.

## Task Commits

Each task was committed atomically (--no-verify per parallel-execution context):

1. **Task 1 (commit `996f749`)** — `feat(23-02)`: add CollectionGoalCard and OverlapToleranceCard top-Card client components
2. **Task 1 follow-up (commit `19c21d3`)** — `fix(23-02)`: align OverlapToleranceCard popup behavior with CollectionGoalCard (test stability)
3. **Task 2 (commit `649f19e`)** — `feat(23-02)`: PreferencesClient accepts embedded prop and drops Collection Settings Card
4. **Task 3 (commit `404391b`)** — `feat(23-02)`: rewrite PreferencesSection to render top Cards + divider + embedded PreferencesClient

## Files Created/Modified

### Created
- `src/components/settings/preferences/CollectionGoalCard.tsx` (100 lines) — Client component: 4-option Select for collectionGoal with locked copy (em-dashes). Calls `savePreferences({ collectionGoal })` inside `startTransition`. Surfaces inline `role="alert"` saveError banner and `aria-live="polite"` Saving… indicator.
- `src/components/settings/preferences/OverlapToleranceCard.tsx` (96 lines) — Client component: 3-option Select for overlapTolerance with locked copy. Same useTransition + savePreferences + saveError pattern.

### Modified
- `src/components/settings/PreferencesSection.tsx` — Was 5-line stub passing `<PreferencesClient preferences={preferences} />`. Now 35-line Server Component composition: `<div className="space-y-6">` → CollectionGoalCard → OverlapToleranceCard → divider (`border-t border-border pt-6`) with "Taste preferences" label → `<PreferencesClient embedded preferences={preferences} />`.
- `src/components/preferences/PreferencesClient.tsx` — Added `embedded?: boolean = false` prop. Refactored return: hoisted inner Cards block to `inner` variable, conditionally wraps with outer container + h1 + subtitle ONLY when `!embedded`. Deleted the entire Collection Settings Card (was 59 lines: header, 2 Selects with overlapTolerance + collectionGoal). Removed 5 unused imports (Select, SelectContent, SelectItem, SelectTrigger, SelectValue) and 2 type imports (CollectionGoal, OverlapTolerance).

## Plan 01 RED → GREEN Flips

All Plan 01 RED scaffolds for SET-07/08 + PreferencesClient embedded turn GREEN under this plan's code:

| Test File | RED before | GREEN after |
|-----------|-----------|-------------|
| `tests/components/settings/preferences/CollectionGoalCard.test.tsx` | 4 tests fail with `Cannot find module` | 4 tests pass: title + description + placeholder + 4 options + brand-loyalist click → savePreferences |
| `tests/components/settings/preferences/OverlapToleranceCard.test.tsx` | 3 tests fail with `Cannot find module` | 3 tests pass: title + description + 3 options + high click → savePreferences |
| `tests/components/settings/PreferencesClientEmbedded.test.tsx` | 5 tests fail (`embedded` prop unknown OR Collection Settings Card still present) | 5 tests pass: no h1, no subtitle, no "Collection Settings", no "Overlap Tolerance"/"Collection Goal" labels, Style Preferences card retained |

**12/12 GREEN verified locally** by cherry-picking the Plan 01 commit's test files (`bf48c57:tests/...`) into the worktree, running `npm test`, and confirming pass before removing the cherry-picked files (Plan 01 owns those test files in its branch; the orchestrator will merge them with this plan).

## Locked Copy Verification (byte-identical to UI-SPEC § Copywriting Contract)

Verified via `grep -F`:

- ✓ `Brand Loyalist — Same maker, different models` (em-dash U+2014) — exactly 1 occurrence in CollectionGoalCard.tsx
- ✓ `Balanced — Diverse collection across styles` — 1 occurrence
- ✓ `Specialist — Deep in one area` — 1 occurrence
- ✓ `Variety within a theme` (no em-dash on this option per UI-SPEC) — 1 occurrence
- ✓ `Low — Flag any overlap` — 1 occurrence
- ✓ `Medium — Flag significant overlap` — 1 occurrence
- ✓ `High — Only flag major overlap` — 1 occurrence
- ✓ Description copy: "How do you want your collection to grow over time?" / "How strictly should we flag watches that overlap with what you already own?"
- ✓ Placeholder: "Select a goal..."
- ✓ Divider label: "Taste preferences"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] alignItemWithTrigger={false} on both top Cards' SelectContent**

- **Found during:** Task 1 (CollectionGoalCard) and Task 1 follow-up (OverlapToleranceCard)
- **Issue:** Plan 01's RED scaffolds use `user.click(screen.getByText('Brand Loyalist…'))` to interact with options. With base-ui's default `alignItemWithTrigger=true`, jsdom intermittently leaves the popup positioner with `pointer-events: none` (transitional state when there's no currently-selected item). userEvent's pointer guard rejects the click.
- **Fix:** Pass `alignItemWithTrigger={false}` to `<SelectContent>` in both top Cards. Visually unchanged (the popup positions just below the trigger as it does anyway in this Card layout), but stabilizes pointer-events under test.
- **Files modified:** `src/components/settings/preferences/CollectionGoalCard.tsx` (Task 1 commit), `src/components/settings/preferences/OverlapToleranceCard.tsx` (Task 1 follow-up commit)
- **Commits:** `996f749`, `19c21d3`

**2. [Rule 2 - Critical] Replaced sr-only `<Label>` with `aria-label` on SelectTrigger**

- **Found during:** Task 1
- **Issue:** UI-SPEC suggested `<Label htmlFor="collectionGoal" className="sr-only">Collection goal</Label>` for screen-reader association. Plan 01's RED scaffolds use `screen.getByText('Collection goal')` and `screen.getByText('Overlap tolerance')` to assert the CardTitle. The sr-only Label produces a SECOND DOM node with the same text, breaking `getByText` (TestingLibraryElementError: "Found multiple elements").
- **Fix:** Removed the duplicate `<Label>` and put `aria-label="Collection goal"` (resp. "Overlap tolerance") directly on `<SelectTrigger>`. Same screen-reader association, no DOM-text duplication. The CardTitle remains the visible label.
- **Files modified:** Both `CollectionGoalCard.tsx` and `OverlapToleranceCard.tsx`
- **Commit:** Inline within Task 1 (`996f749`)

### Out-of-scope discoveries

Logged to `.planning/phases/23-settings-sections-schema-field-ui/deferred-items.md`:
- 5 pre-existing failing tests in `tests/no-raw-palette.test.ts` (CollectionFitCard.tsx, WatchSearchRow.tsx — different files than mine) and `tests/app/explore.test.tsx` (Sparkles icon issue). Not touched by this plan.

## Threat Model Outcome

| Threat ID | Disposition | Realized? |
|-----------|-------------|-----------|
| T-23-02-01 (Tampering: savePreferences input) | mitigate | ✓ Existing Zod schema in `src/app/actions/preferences.ts` validates `collectionGoal` and `overlapTolerance`. New Cards do not bypass — they call savePreferences with the same payload shape that the schema already accepts. |
| T-23-02-02 (Information Disclosure: preferences readback) | accept | ✓ Preferences are user-private. SettingsTabsShell parent reads `getPreferencesByUser(user.id)`. No cross-user leakage. |
| T-23-02-03 (Elevation of Privilege: unauthenticated access) | mitigate | ✓ savePreferences enforces `getCurrentUser()` and rejects unauthenticated. New Cards are rendered only inside SettingsTabsShell (auth-gated). |

No new threat surface introduced.

## Self-Check: PASSED

**Files created (verified exist):**
- ✓ `src/components/settings/preferences/CollectionGoalCard.tsx`
- ✓ `src/components/settings/preferences/OverlapToleranceCard.tsx`

**Files modified (verified):**
- ✓ `src/components/settings/PreferencesSection.tsx`
- ✓ `src/components/preferences/PreferencesClient.tsx`

**Commits exist:**
- ✓ `996f749` (Task 1)
- ✓ `19c21d3` (Task 1 follow-up — Rule 1 fix)
- ✓ `649f19e` (Task 2)
- ✓ `404391b` (Task 3)

---
phase: 25-profile-nav-prominence-empty-states-form-polish
plan: 02
subsystem: ui
tags: [react, nextjs, tailwind, lucide-react, vitest, rtl, accessibility]

# Dependency graph
requires:
  - phase: 25-profile-nav-prominence-empty-states-form-polish
    provides: 25-CONTEXT.md D-11..D-15 (categorization location + locked recovery copy); 25-UI-SPEC.md §ExtractErrorCard Component Contract (visual structure, layout details, anti-patterns)
provides:
  - "<ExtractErrorCard> presentational component with 5-category branching"
  - "ExtractErrorCardProps + ExtractErrorCategory exported types for the dual-CTA recovery surface"
  - "Locked D-15 recovery copy + locked D-14 lucide icon mapping in CONTRACT_BY_CATEGORY"
  - "role=alert + aria-live=polite accessibility surface for URL-extract failures"
affects:
  - "25-04 (AddWatchFlow + extract-watch route categorization wires this component)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure presentational component with locked copy + locked icon set (D-14/D-15 enforcement)"
    - "Caller-owned routing via callback props (open-redirect mitigation T-25-02-02)"
    - "Dev-only debug rendering of optional message prop (T-25-02-01 mitigation)"
    - "Vitest+RTL it.each parameterized tests over an enum union"

key-files:
  created:
    - "src/components/watch/ExtractErrorCard.tsx (component, 133 lines)"
    - "src/components/watch/ExtractErrorCard.test.tsx (15 tests, 165 lines)"
  modified: []

key-decisions:
  - "Dev-only render of optional `message` prop (process.env.NODE_ENV !== 'production') keeps raw error strings off the production user surface per T-25-02-01"
  - "Single combined import line `import { Lock, FileQuestion, Clock, Gauge, WifiOff, type LucideIcon } from 'lucide-react'` to satisfy plan acceptance criterion (one lucide import)"
  - "CONTRACT_BY_CATEGORY const map keyed by ExtractErrorCategory; one source of truth for icon + heading + body per category"
  - "Tests use it.each over a typed CASES tuple array; each row asserts both heading and body are present, ensuring no D-15 paraphrasing slips through"

patterns-established:
  - "Per-category contract map: `Record<EnumUnion, { Icon, heading, body }>` — pattern future error-display components in the watch domain can mirror"
  - "Lucide SVG class detection in tests: `alert.querySelector('svg').classList.contains('lucide')` — works with lucide-react v1.8.0's `mergeClasses('lucide', ...)` output"

requirements-completed: [UX-05]

# Metrics
duration: ~15 min
completed: 2026-05-02
---

# Phase 25 Plan 02: ExtractErrorCard Summary

**Pure presentational `<ExtractErrorCard>` component with 5-category branching, locked D-15 recovery copy, locked D-14 lucide icons (Lock/FileQuestion/Clock/Gauge/WifiOff), and dual-CTA layout (Add manually / Try a different URL).**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-02T16:47:00Z (approx)
- **Completed:** 2026-05-02T17:02:41Z
- **Tasks:** 2 (TDD: RED test commit + GREEN implementation commit)
- **Files created:** 2

## Accomplishments

- 5-category error display covering all UX-05 categories (host-403, structured-data-missing, LLM-timeout, quota-exceeded, generic-network)
- D-15 recovery copy reproduced verbatim (no paraphrasing) and locked behind a typed enum union — TypeScript prevents future drift
- D-14 lucide icon set locked (Anti-Pattern #9 enforcement) — only the five canonical icons are imported
- role="alert" + aria-live="polite" surface so screen readers announce both heading and body on mount
- 15/15 tests pass (5 category-branch heading+body assertions + 5 SVG icon assertions + 2 CTA wiring + 1 both-CTAs presence + 2 accessibility)
- ESLint clean; tsc clean for the new files
- T-25-02-01 mitigation: optional `message` prop is dev-only render (no raw error strings reach production users)
- T-25-02-02 mitigation: component accepts callbacks, never constructs URLs from props (open-redirect surface eliminated at the component layer)

## Task Commits

Each task was committed atomically per the TDD gate sequence:

1. **Task 2 (RED): failing tests for ExtractErrorCard** - `c5fec3e` (test)
2. **Task 1 (GREEN): implement ExtractErrorCard** - `d35a863` (feat)

The plan listed Task 1 (component) before Task 2 (tests) but both were marked `tdd="true"`, so I followed the TDD execution flow (test-first → implementation). The behavior block in Task 1 explicitly defined the tests Task 2 implements; same outcome, just sequenced for proper RED→GREEN gating.

No REFACTOR commit needed — implementation is straightforward and matches UI-SPEC §Layout one-to-one.

## Files Created

- `src/components/watch/ExtractErrorCard.tsx` (133 lines) — Pure presentational client component. Exports `ExtractErrorCard`, `ExtractErrorCardProps`, `ExtractErrorCategory`. Renders one of 5 category branches per UI-SPEC §ExtractErrorCard Component Contract.
- `src/components/watch/ExtractErrorCard.test.tsx` (165 lines) — Vitest+RTL test file. 3 describe blocks (category branches / interactions / accessibility), 15 tests total.

## Decisions Made

- **Dev-only render of `message` prop** — Per T-25-02-01 mitigation, the optional `message` prop is wrapped in `process.env.NODE_ENV !== 'production'` so raw error strings (potentially containing stack traces, internal URLs, or LLM provider names) never reach the production user surface. The locked D-15 body copy is the user-visible recovery surface.
- **Combined lucide import line** — Used a single `import { Lock, FileQuestion, Clock, Gauge, WifiOff, type LucideIcon } from 'lucide-react'` to satisfy the plan's acceptance criterion `grep -c "from 'lucide-react'" returns 1`. This mixes value and type imports in one statement, which TypeScript supports via inline `type` keyword (5.x).
- **`CONTRACT_BY_CATEGORY` const map keyed by enum union** — One source of truth for icon + heading + body per category. The `Record<ExtractErrorCategory, CategoryContract>` typing ensures TypeScript catches any missing or extra category if the enum is ever extended.
- **Tests use parameterized `it.each(CASES)`** — A typed tuple array `Array<[ExtractErrorCategory, string, string]>` drives both the heading/body and the SVG presence tests, so every category gets both assertions automatically. Adding a sixth category in the future would only require one new tuple row.

## Deviations from Plan

None. The plan was executed exactly as written. Two minor sequencing notes:

1. **TDD ordering** — Plan listed Task 1 (component) before Task 2 (tests), but both tasks were `tdd="true"`. Per `<tdd_execution>` flow I wrote tests first (RED), confirmed they failed (import resolution error), committed as `test(...)`, then implemented (GREEN), confirmed all 15 pass, committed as `feat(...)`. Same final state, proper TDD gate.
2. **Initial type-import on a separate line** — First implementation used `import type { LucideIcon } from 'lucide-react'` on a separate line. This made `grep -c "from 'lucide-react'"` return 2. I consolidated into a single inline-type import to satisfy the strict acceptance criterion (`returns 1`). Tests and lint still pass.

## Issues Encountered

None blocking. One observation: `npx tsc --noEmit` reports pre-existing errors in unrelated files modified by parallel wave-1 agents (25-01 modifying `SlimTopNav` / `UserMenu` props, 25-04 extending `AddWatchFlow` props with `initialManual` / `initialStatus`, 25-03 anticipating `useFormFeedback`). Per SCOPE BOUNDARY rule, these are out of scope for this plan and will resolve when those agents merge. None of the errors involve `ExtractErrorCard.tsx` or `ExtractErrorCard.test.tsx`.

## Verification Results

| Check | Status |
|-------|--------|
| `npm test -- --run src/components/watch/ExtractErrorCard.test.tsx` | 15/15 pass |
| `npm run lint` on both new files | exit 0 |
| `npx tsc --noEmit` on new files | clean (no errors in new files; pre-existing errors elsewhere are out of scope) |
| `grep -c "from 'lucide-react'"` (one import line) | 1 |
| All 5 category strings + locked copy snippets present | confirmed |
| `border-l-destructive` present, `text-destructive\b` absent (Anti-Pattern #5) | confirmed |
| `'use client'` directive on line 1 | confirmed |
| No production caller imports `ExtractErrorCard` (intentional — 25-04 wires) | confirmed |

## Threat Surface Scan

No new security-relevant surface introduced beyond what the threat model already covers (T-25-02-01..T-25-02-04). The component is a pure presentational primitive with no network, file, or auth surface. The dev-only render of the `message` prop is the explicit mitigation for T-25-02-01.

## Next Phase Readiness

- `<ExtractErrorCard>` is ready to be mounted by 25-04 inside `<AddWatchFlow>`'s `extraction-failed` state branch
- Public API: `import { ExtractErrorCard, type ExtractErrorCategory } from '@/components/watch/ExtractErrorCard'`
- Caller (25-04) is responsible for wrapping `retryAction` and `manualAction` in `useCallback` per T-25-02-03 (caller hygiene; component itself is robust to unstable callbacks)
- 25-04 will need to extend `state.kind === 'extraction-failed'` from `{partial, reason}` to `{partial, reason, category}` per UI-SPEC FG-11

## Self-Check: PASSED

Verified before commit:

- `[x] FOUND: src/components/watch/ExtractErrorCard.tsx`
- `[x] FOUND: src/components/watch/ExtractErrorCard.test.tsx`
- `[x] FOUND commit: c5fec3e (test RED)`
- `[x] FOUND commit: d35a863 (feat GREEN)`
- `[x] 15/15 tests pass`
- `[x] All UI-SPEC §ExtractErrorCard acceptance criteria met`

---
*Phase: 25-profile-nav-prominence-empty-states-form-polish*
*Plan: 02 (Wave 1)*
*Completed: 2026-05-02*

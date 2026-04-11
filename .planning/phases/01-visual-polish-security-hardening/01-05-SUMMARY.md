---
phase: 01-visual-polish-security-hardening
plan: 05
subsystem: visual-tokens
tags: [visual-polish, tokens, dark-mode, typography, invariant-test]
wave: 3
requires:
  - 01-01-PLAN.md (next-themes, @custom-variant dark wiring)
  - 01-03-PLAN.md (WatchCard/WatchDetail use next/image + getSafeImageUrl)
  - 01-04-PLAN.md (MobileNav, Sheet-based FilterBar, WatchDetail grid layout)
provides:
  - Warm/brass palette tokens in :root and .dark (UI-SPEC lines 109-159)
  - Semantic-token-only component tree under src/components and src/app
  - tests/no-raw-palette.test.ts invariant guard
  - Font-serif display headings on empty states and page titles
affects:
  - BalanceChart rendered as interim list (Plan 06 rewrites with Recharts)
  - SimilarityBadge no longer consumes labelDisplay.color (field dead-code in similarity.ts)
tech-stack:
  added: []
  patterns:
    - "Semantic tokens only: bg-card, text-muted-foreground, border-border, text-destructive, text-accent"
    - "variant=outline monochromatic badges for status"
    - "font-serif display class pulled via @theme inline --font-serif (wired in Plan 01-01)"
key-files:
  created:
    - tests/no-raw-palette.test.ts
  modified:
    - src/app/globals.css
    - src/app/insights/page.tsx
    - src/app/page.tsx
    - src/app/preferences/page.tsx
    - src/app/watch/[id]/edit/page.tsx
    - src/app/watch/new/page.tsx
    - src/components/filters/FilterBar.tsx
    - src/components/insights/BalanceChart.tsx
    - src/components/insights/SimilarityBadge.tsx
    - src/components/layout/Header.tsx
    - src/components/watch/UrlImport.tsx
    - src/components/watch/WatchCard.tsx
    - src/components/watch/WatchDetail.tsx
    - src/components/watch/WatchForm.tsx
    - src/components/watch/WatchGrid.tsx
decisions:
  - "BalanceChart: chose Option A (delete colors array + CSS bar div, render as sorted list) so invariant passes pre-Plan 06"
  - "Extended migration scope beyond files_modified to include Header/SimilarityBadge/WatchForm/new+edit pages because invariant test walks all of src/components and src/app (Rule 3 - blocking)"
  - "SimilarityBadge now uses variant=outline and ignores labelDisplay.color; the color field in src/lib/similarity.ts is left as dead code (outside invariant scope; cleanup deferred)"
  - "statusColors maps deleted from WatchCard and WatchDetail per UI-SPEC monochromatic badge rule"
  - "font-bold/font-medium migrated to font-semibold (UI-SPEC allows only 400 and 600 weights)"
metrics:
  duration_minutes: ~15
  completed_date: 2026-04-11
  tasks_completed: 2
  files_created: 1
  files_modified: 15
  commits: 2
---

# Phase 1 Plan 05: Warm/Brass Palette + Semantic Token Migration Summary

Replaced the pure-gray shadcn default palette with the UI-SPEC warm/brass paper-and-lume palette in both `:root` and `.dark`, then migrated every raw Tailwind palette utility in `src/components` and `src/app` to semantic tokens. Added a 323-assertion invariant test that fails the suite if any raw `bg-gray-*`/`text-gray-*`/`bg-green-100`/etc. class (or any `font-medium`/`font-bold`/`font-light`) reappears.

## What shipped

### Task 1: globals.css token rewrite

- `:root` — paper-warm off-white background `oklch(0.985 0.003 75)`, warm near-black foreground `oklch(0.18 0.01 75)`, brass accent `oklch(0.76 0.12 75)`, terracotta destructive `oklch(0.55 0.22 27)`, chart-1 through chart-5 tuned to brass/gray/terracotta/pale-brass
- `.dark` — warm near-black background `oklch(0.14 0.005 75)`, mirror foreground, slightly brighter brass accent `oklch(0.78 0.13 75)` for contrast on dark card surface
- Sidebar tokens mirrored onto new palette (previously pointing at old neutral grays) so any future sidebar surface inherits consistent theming
- `@custom-variant dark`, `@theme inline`, and `@layer base` left untouched per Plan 01-01 contract
- Commit: `f45ee1c`

### Task 2: component migration + invariant test

**Files migrated (per plan files_modified):**
- `WatchCard`, `WatchDetail`, `WatchGrid`, `UrlImport`, `FilterBar`, `BalanceChart`, `insights/page.tsx`, `preferences/page.tsx`, `page.tsx`

**Scope extension (Rule 3 - blocking):** the invariant test walks ALL of `src/components/` (excluding `src/components/ui/`) and `src/app/`, so the plan's stated files_modified list was insufficient. Added the following files to the migration to keep the test green:
- `src/components/layout/Header.tsx` — nav link colors, logo weight (bold → serif)
- `src/components/insights/SimilarityBadge.tsx` — dropped `className={labelDisplay.color}` in favor of `variant="outline"`; migrated `text-gray-*`, `text-yellow-600`, `font-medium`
- `src/components/watch/WatchForm.tsx` — `text-red-500` error text → `text-destructive`
- `src/app/watch/new/page.tsx` + `src/app/watch/[id]/edit/page.tsx` — H1s → `font-serif text-3xl md:text-4xl text-foreground`

**Empty state / display heading upgrades (UI-SPEC):**
- `WatchGrid` empty state — lucide `Watch` icon + "Your collection is empty." (Instrument Serif display 32px) + UI-SPEC body copy
- `insights/page.tsx` — "Collection Insights" H1 in `font-serif text-3xl md:text-4xl`; empty-state copy "Insights unlock once you add a few watches." per UI-SPEC
- `preferences/page.tsx` — H1 migrated to display
- `page.tsx` home — "Collection" H1 migrated to display
- New/edit watch pages — H1s migrated to display

**BalanceChart resolution (Option A from plan):** The plan called out an inconsistency between the invariant test and BalanceChart's hardcoded `bg-blue-500`/`bg-green-500`/... colors array. Chose Option A: delete the colors array, delete the inline CSS bar div, render as a simple sorted list (label left, count + percentage right in font-mono). Plan 01-06 rewrites this whole component file with Recharts through the shadcn Chart primitive.

**Status badge refactor:**
- `WatchCard`: `variant="secondary"` → `variant="outline"`
- `WatchDetail`: deleted `statusColors` record entirely, Badge now just `variant="outline"` with monochromatic treatment per UI-SPEC

**Invariant test (`tests/no-raw-palette.test.ts`):**
- Walks `src/components/` and `src/app/` recursively, skipping `src/components/ui/`
- Tests each file against 17 forbidden patterns (gray/green/blue/purple/yellow/red backgrounds + text + borders + hover variants, plus font-medium/font-bold/font-light)
- Produces 323 individual test cases, all passing

- Commit: `06cdf43`

## Verification

- `npx vitest run tests/no-raw-palette.test.ts` — 323/323 pass
- `npm test` — 6 test files, 367/367 pass (includes images, no-raw-img, ssrf, smoke, theme, no-raw-palette)
- `npm run build` — clean, all 8 routes generated
- `npm run lint` — 0 errors (6 pre-existing warnings for stale files in a nested worktree copy and unused imports in `src/lib/extractors/*`; all out of scope)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Expanded migration scope to cover all files walked by the invariant test**

- **Found during:** Task 2 preparation
- **Issue:** The plan's `files_modified` list covered 9 component/app files, but `tests/no-raw-palette.test.ts` walks every `.tsx`/`.jsx` file under `src/components/` (minus `ui/`) and `src/app/`. Header, SimilarityBadge, WatchForm, `watch/new/page.tsx`, and `watch/[id]/edit/page.tsx` all carried raw palette classes and would have failed the invariant immediately.
- **Fix:** Migrated those five additional files in the same Task 2 commit. Scope matches the plan's intent (success criteria bullet 2: "No raw … classes remain outside `src/components/ui/`").
- **Files modified:** `src/components/layout/Header.tsx`, `src/components/insights/SimilarityBadge.tsx`, `src/components/watch/WatchForm.tsx`, `src/app/watch/new/page.tsx`, `src/app/watch/[id]/edit/page.tsx`
- **Commit:** `06cdf43`

**2. [Rule 1 - Stale dead code] `labelDisplay.color` in similarity.ts no longer consumed**

- **Found during:** Task 2 SimilarityBadge migration
- **Issue:** `getSimilarityLabelDisplay` in `src/lib/similarity.ts` returns `{ text, color, description }` where `color` is a hardcoded `bg-green-100 text-green-800` string. Changing SimilarityBadge to `variant="outline"` means this field is now dead.
- **Fix:** Left the field in place. `src/lib/` is not walked by the invariant test, so it does not block. A future cleanup can remove the field and narrow the return type. Recording here so the next pass catches it.
- **Files modified:** none (noted for follow-up)

### Out of scope (not fixed — documented for follow-up)

- `src/lib/similarity.ts` — `labelDisplay.color` dead field (see above)
- `src/lib/extractors/html.ts`, `src/lib/extractors/llm.ts` — pre-existing `COMPLICATIONS`/`ROLE_TAGS` unused-var lint warnings (unrelated to palette work)
- Nested worktree copy at `.claude/worktrees/agent-a6a3c0df/src/...` — ESLint is scanning a stale duplicate that still has raw `<img>` tags. Not introduced by this plan.

## Known Stubs

None. BalanceChart is intentionally rendered as a list until Plan 01-06 — this is documented above and in the component comment.

## Threat Flags

None. Palette-only changes — no new network, auth, or file-access surface introduced.

## Self-Check: PASSED

Verified commits exist:
- `f45ee1c` feat(01-05): warm/brass palette tokens in globals.css — FOUND
- `06cdf43` feat(01-05): migrate components to semantic tokens + invariant test — FOUND

Verified files exist:
- `src/app/globals.css` — FOUND (tokens present: `oklch(0.985 0.003 75)`, `oklch(0.14 0.005 75)`, `oklch(0.76 0.12 75)`)
- `tests/no-raw-palette.test.ts` — FOUND (323 tests, all pass)
- All 14 modified source files — FOUND, all clean of raw palette per grep

Verified command results:
- `npx vitest run tests/no-raw-palette.test.ts` → 323 passed
- `npm test` → 367 passed
- `npm run build` → exit 0
- `npm run lint` → 0 errors

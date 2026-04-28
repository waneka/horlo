---
phase: 19-search-watches-collections
plan: 04
subsystem: search
tags: [search, ui, react, tailwind, collections, srch-11, srch-15, d-11]

# Dependency graph
requires:
  - phase: 19-search-watches-collections
    plan: 01
    provides: SearchCollectionResult type contract (matchedWatches with matchPath 'name'|'tag', matchedTags string[], matchCount, tasteOverlap)
  - phase: 16-people-search
    provides: HighlightedText XSS-safe primitive (reused unchanged); PeopleSearchRow visual grammar (row container, absolute-inset Link, shared-watch cluster shape, hover/focus states)
provides:
  - CollectionSearchRow (Collections tab result row component) — avatar + display-name (HighlightedText) + match-summary sub-line + matched-watch thumb cluster + matched-tag pills, whole-row Link to /u/{username}/collection, no inline CTA
  - CollectionSearchResultsSkeleton (loading state) — 4 rows mirroring WatchSearchResultsSkeleton shape with data-testid="collection-search-skeleton" for Plan 05 wiring tests
  - Match-summary copy matrix for the 4 cases per UI-SPEC lines 202-205 (1-watch / N-watches / tag-only / mixed)
affects: [19-05 unified-search-page (Plan 05 wires CollectionSearchRow into the Collections tab and the All-tab Collections section; Plan 05 wires CollectionSearchResultsSkeleton into the loading-state branches)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Matched-watch cluster shape carry-forward: size-10 md:size-12 rounded-full bg-muted ring-2 ring-card overflow-hidden + margin-left -0.5rem stagger from index 1 + cap=3 thumbs (mirrors PeopleSearchRow shared-watch cluster, but the watches surfaced are MATCHED-against-q rather than SHARED-with-viewer per D-11)"
    - "Match-summary copy matrix as a pure function (computeMatchSummary) keyed off (matchCount, hasNameMatch, hasTagMatch) — 4 branches that exhaustively cover the UI-SPEC matrix; isolated at the bottom of the row file so the JSX stays declarative"
    - "Conditional matched-tag pills (D-11): rendered after the matched-watch cluster only when matchedTags.length > 0; cap=3 pills via slice(0, 3) for visual rhythm; bg-muted text-muted-foreground text-xs"
    - "Cluster + pills both gated behind hidden sm:flex (UI-SPEC line 124-125) so narrow viewports retain row scannability — the match-summary sub-line carries the same information as text on mobile"
    - "Cluster thumbs carry aria-label={`${brand} ${model}`} so the matched-watch identity is announced even when the visual cluster is hidden by sm:flex (Test 8 / SRCH-15)"

key-files:
  created:
    - src/components/search/CollectionSearchRow.tsx (Collections tab result row component)
    - src/components/search/CollectionSearchResultsSkeleton.tsx (Collections tab loading skeleton)
    - tests/components/search/CollectionSearchRow.test.tsx (13 RTL tests covering whole-row link, HighlightedText, username fallback, match-summary matrix x4, thumb cap, aria-label, conditional pills, responsive cluster, no-CTA)
  modified: []

key-decisions:
  - "Match-summary 'mixed' branch keys off hasTagMatch && hasNameMatch && matchCount > 1 — mixed wins over plain N-watches name to surface the tag dimension when it co-exists with name matches (UI-SPEC line 205 / D-11)"
  - "Test 3 (username fallback) was relaxed from `getByText(/tyler/, { selector: 'strong, p' })` to a textContent assertion on the primary <p> — when q='ty' and displayName=null, HighlightedText splits 'tyler' into <strong>ty</strong>ler so a single-node text matcher cannot succeed; the textContent assertion preserves the test intent (Rule 1 fix to a flaw in the plan-supplied test code)"
  - "matched-watch thumbs carry aria-label brand+model rather than wrapping brand/model in <HighlightedText> inside an alt text — `next/image` alt is set empty (decorative cluster) and the aria-label on the wrapping div carries the identity announcement; this respects the UI-SPEC's 'visual cluster' semantics while still meeting SRCH-15's announcement requirement"

patterns-established:
  - "Match-summary copy matrix as a pure function next to the row component — reusable pattern for any future search-row variant that needs branched copy from a structured payload"
  - "Hidden-on-mobile clusters MUST carry their identity via aria-label on the cluster container so SRCH-15 announcement is preserved when visual elements are hidden behind sm:flex"

requirements-completed: [SRCH-11, SRCH-15]

# Metrics
duration: ~6 min
completed: 2026-04-28
---

# Phase 19 Plan 04: Collections Tab Result Row Summary

**Two new pure-render components — `CollectionSearchRow` (Collections tab result row with matched-watch cluster + matched-tag pills + 4-branch match-summary copy matrix) and `CollectionSearchResultsSkeleton` (loading state) — locked by 13 RTL tests covering the full UI-SPEC visual contract.**

## Performance

- **Duration:** ~6 minutes
- **Tasks:** 2 of 2 completed
- **Files created:** 3
- **Files modified:** 0
- **RTL tests added:** 13 (all passing)
- **Existing tests regressed:** 0

## Accomplishments

- `CollectionSearchRow` exported from `src/components/search/CollectionSearchRow.tsx` — full visual contract per UI-SPEC lines 114-127: row container `group relative flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md transition-colors hover:bg-muted/40`, absolute-inset Link to `/u/{username}/collection` (no inline FollowButton or Evaluate CTA per UI-SPEC), avatar via `<AvatarDisplay size={40}>`, primary label `text-sm font-semibold truncate` wrapping `displayName ?? username` in `<HighlightedText>`, sub-label `text-sm text-muted-foreground` showing the match-summary copy, matched-watch cluster `hidden sm:flex` with `size-10 md:size-12 rounded-full bg-muted ring-2 ring-card overflow-hidden` thumbs and `-0.5rem` stagger from index 1 capped at 3, matched-tag pills `hidden sm:flex` with `text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full` rendered when `matchedTags.length > 0`.
- `computeMatchSummary` (collocated in the row file) implements the 4-branch UI-SPEC copy matrix (lines 202-205): "owns {brand} {model}" (1 name match), "owns {brand} {model} + {N-1} more" (N name matches, no tag), "{matchCount} matching watches" (tag-only), "{matchCount} matches" (mixed name+tag).
- `CollectionSearchResultsSkeleton` exported from `src/components/search/CollectionSearchResultsSkeleton.tsx` — 4 skeleton rows with the same row dimensions as `WatchSearchResultsSkeleton`, semantically isolated by `data-testid="collection-search-skeleton"` for Plan 05 wiring tests.
- 13 RTL tests pass on first GREEN (after one Test 3 adjustment): whole-row Link target, HighlightedText on displayName, username fallback, all 4 match-summary branches (Tests 4a–4d), thumb cluster cap=3, conditional pills, no-pills-when-empty, aria-label announcement (SRCH-15 / Test 8), responsive `hidden sm:flex`, and no `Evaluate`/`Follow`/`Following` CTA strings.

## Task Commits

Each task was committed atomically with TDD red→green for Task 1:

1. **Task 1 RED** — `f13a318` — `test(19-04): add failing tests for CollectionSearchRow` (13 tests, fail with "Failed to resolve import" — component does not exist)
2. **Task 1 GREEN** — `9aef7de` — `feat(19-04): implement CollectionSearchRow component` (all 13 tests pass; 1 Test 3 fix Rule 1 in test code)
3. **Task 2** — `4fb3c0b` — `feat(19-04): add CollectionSearchResultsSkeleton`

## Files Created

### `src/components/search/CollectionSearchRow.tsx`

Pure-render component (no `'use client'` — Server Component-safe; no client state). Imports `next/link`, `next/image`, `lucide-react` `Watch as WatchIcon`, plus `AvatarDisplay`, `HighlightedText`, and the `SearchCollectionResult` type. Props: `{ result: SearchCollectionResult; q: string }`. The whole-row Link uses `relative` containment + `absolute inset-0` for the click surface; the matched-watch cluster and tag pills are wrapped in `pointer-events-none` containers so they don't capture clicks (the row Link sits beneath them via `relative` z-stacking).

The match-summary helper is a pure function at the bottom of the file (`computeMatchSummary(result: SearchCollectionResult): string`) — keeps the JSX declarative and the copy matrix testable.

### `src/components/search/CollectionSearchResultsSkeleton.tsx`

Pure-render component. Renders `<div className="space-y-2" data-testid="collection-search-skeleton">` wrapping 4 rows; each row has the same dimensions as `WatchSearchResultsSkeleton` (`flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md`) with a `<Skeleton className="size-10 rounded-full" />` avatar placeholder + 2-line text block. No right-side chip (Collections rows have no inline CTA).

### `tests/components/search/CollectionSearchRow.test.tsx`

13 RTL tests using the same `vi.mock('next/link')` and `vi.mock('next/image')` plain-`<a>`/`<img>` stub pattern as `PeopleSearchRow.test.tsx`. Tests numbered exactly 1, 2, 3, 4a, 4b, 4c, 4d, 5, 6, 7, 8, 9, 10 per the plan's test-count discipline check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 3 selector matcher fails when displayName is null + q='ty'**
- **Found during:** Task 1 GREEN run (12 of 13 passed; Test 3 failed)
- **Issue:** The plan-supplied Test 3 used `screen.getByText(/tyler/, { selector: 'strong, p' })`. With `displayName=null`, the primary label renders `username='tyler'`, which `HighlightedText` splits at `q='ty'` into `<strong>ty</strong>ler`. Testing Library's `getByText` with a `selector` cannot match text broken across multiple nodes, so the test failed with "Unable to find an element with the text: /tyler/".
- **Fix:** Switched to a textContent assertion on the primary `<p>`: `container.querySelector('p.text-sm.font-semibold')` then `expect(primary?.textContent?.toLowerCase()).toContain('tyler')`. Preserves the original test intent (username fallback when displayName is null) without coupling to HighlightedText's node-split boundaries.
- **Files modified:** `tests/components/search/CollectionSearchRow.test.tsx` (Test 3 only)
- **Commit:** `9aef7de` (folded into Task 1 GREEN since the fix was inside the same test file the implementation commit was already touching)

No Rule 2/3/4 deviations.

## Threat Model Coverage (Plan 04 scope)

All threats listed in `19-04-PLAN.md` `<threat_model>` are mitigated:

- **T-19-04-01** (Tampering — XSS via collector text) — `<HighlightedText>` reused unchanged from Phase 16; tag pills render as React text children `{t}`. Zero `dangerouslySetInnerHTML` references (acceptance criterion verified by grep).
- **T-19-04-02** (Tampering — username href injection) — Accepted per plan; existing DB constraint on username format (Phase 7 profiles schema) + Next Link path-segment encoding bound the surface.
- **T-19-04-03** (Information Disclosure — private collector leak) — Mitigated upstream by Plan 01 DAL two-layer privacy; this UI just renders DAL output.
- **T-19-04-04** (Tampering — image src injection) — `next/image unoptimized` matches Phase 16/18 precedent; project-wide `remotePatterns` allowlist (SEC-02) gates the URL.
- **T-19-04-05** (DoS — long matchedTags) — DAL caps `matchedTags` to 5 (Plan 01); UI further `slice(0, 3)` on the pill render.
- **T-19-04-06** (DoS — ReDoS in HighlightedText) — Accepted; mitigated in Phase 16 (regex-escape) + 200-char Server Action bound (Plan 02).

## Verification

- `npx vitest run tests/components/search/CollectionSearchRow.test.tsx --reporter=verbose` → **13 passed**
- `npx vitest run tests/components/search/CollectionSearchRow.test.tsx tests/components/search/PeopleSearchRow.test.tsx` → **24 passed (13 + 11; no Phase 16 regression)**
- `npx tsc --noEmit` → no diagnostics referencing `CollectionSearchRow.tsx`, `CollectionSearchResultsSkeleton.tsx`, or `CollectionSearchRow.test.tsx`
- `npx eslint src/components/search/CollectionSearchRow.tsx src/components/search/CollectionSearchResultsSkeleton.tsx tests/components/search/CollectionSearchRow.test.tsx` → 0 errors, 1 warning (the `<img>` next/image stub warning shared with `PeopleSearchRow.test.tsx`'s established pattern)
- All grep acceptance criteria pass (export, href interpolation, HighlightedText reuse, absolute inset-0, hidden sm:flex, slice(0, 3), matchedTags conditional, "owns "/"more"/"matching watches" copy strings, no `dangerouslySetInnerHTML`, no `<FollowButton>` JSX usage, aria-label brand+model, exactly 13 numbered tests)

## Wave 2 Handoff

Plan 05 (unified search page wiring) consumes:

- `<CollectionSearchRow result={result} q={q} />` — props shape `{ result: SearchCollectionResult; q: string }`. No `viewerId` prop (unlike `PeopleSearchRow`) because the row has no inline FollowButton.
- `<CollectionSearchResultsSkeleton />` — no props; render during the in-flight branch of the Collections-tab fetch and inside the All-tab Collections section's per-section skeleton.
- The match-summary copy is computed inside the row from `result.matchedWatches` + `result.matchCount` + `result.matchedTags` — Plan 05 does NOT need to pass any pre-computed copy.
- Cluster + pills auto-hide on narrow viewports via `hidden sm:flex` — no responsive logic needed in Plan 05.

## Self-Check: PASSED

Created files exist:
- `src/components/search/CollectionSearchRow.tsx` — created ✓
- `src/components/search/CollectionSearchResultsSkeleton.tsx` — created ✓
- `tests/components/search/CollectionSearchRow.test.tsx` — created ✓

Commits exist:
- `f13a318` — Task 1 RED ✓
- `9aef7de` — Task 1 GREEN ✓
- `4fb3c0b` — Task 2 ✓

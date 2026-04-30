---
phase: 20-collection-fit-surface-polish-verdict-copy
plan: 03
subsystem: insights-ui
tags: [react, rsc, pure-renderer, verdict, ui, skeleton, lucide-react]

# Dependency graph
requires:
  - phase: 20-collection-fit-surface-polish-verdict-copy
    plan: 01
    provides: VerdictBundle / Framing / VerdictBundleFull / VerdictBundleSelfOwned discriminated union at src/lib/verdict/types.ts; tests/static/CollectionFitCard.no-engine.test.ts vacuous-pass guard
provides:
  - "<CollectionFitCard> pure-renderer component (FIT-01 / D-04) consuming VerdictBundle and rendering 3 framings without computing the verdict"
  - "<VerdictSkeleton> structural skeleton matching the card's grid (D-06) for the FIT-04 search-row inline expand"
  - "Activated static guard: tests/static/CollectionFitCard.no-engine.test.ts now exercises real assertions (file-present path) verifying no @/lib/similarity / @/lib/verdict/composer / 'server-only' imports leak into the card"
  - "Replaced Plan 01 it.todo scaffold with 8 real RTL assertions in src/components/insights/CollectionFitCard.test.tsx"
affects: [20-04-watch-detail-integration, 20-05-search-accordion-action, 20-06-catalog-page-and-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-renderer card pattern: zero hooks / state / engine-import; consumes a finished discriminated-union prop and routes via `verdict.framing`"
    - "Deterministic UTC date formatting: Intl.DateTimeFormat({ timeZone: 'UTC' }) so SSR/CSR/test-env produce identical calendar days regardless of viewer locale (Pitfall 3 RSC-determinism corollary)"
    - "Pulse-dimension contract: skeleton cells named with the same Tailwind h-/w- classes the JSDoc lists, making the dimensional-stability invariant grep-checkable"
    - "RSC-safe component: no 'use client' directive — the file works in either a Server Component tree (Plans 04/06) or a Client Component tree (Plan 05 via Server Action)"

key-files:
  created:
    - src/components/insights/CollectionFitCard.tsx
    - src/components/insights/VerdictSkeleton.tsx
  modified:
    - src/components/insights/CollectionFitCard.test.tsx

key-decisions:
  - "UTC timezone in Intl.DateTimeFormat: viewer.acquisitionDate is stored as a wall-clock 'date you bought it' value (often midnight-UTC ISO from form input). Formatting in local TZ would render Apr 11 vs Apr 12 depending on viewer offset, breaking SSR/CSR consistency and causing flakey test runs across CI/local timezones. Pinning to UTC is the deterministic fix."
  - "First contextualPhrasing rendered as headline (text-sm font-medium); rest as bulleted muted list. Composer guarantees length >= 1 (Plan 02), so a defensive `headline && ...` guard ships nonetheless."
  - "AlertTriangle from lucide-react replaces SimilarityBadge.tsx's inline SVG. The role-overlap copy 'May compete for wrist time with similar watches' is preserved verbatim per UI-SPEC § Copywriting Contract."
  - "self-via-cross-user framing renders YouOwnThisCallout via early-return — entirely separate Card body, no shared header. Prevents accidental verdict leakage when caller threads the wrong framing."

requirements-completed: [FIT-01]

# Metrics
duration: 3min
completed: 2026-04-30
---

# Phase 20 Plan 03: Card Renderer Summary

**Shipped the pure-renderer `<CollectionFitCard>` (FIT-01 / D-04) and matching `<VerdictSkeleton>` loading state — the card consumes a finished `VerdictBundle` and routes via the discriminated union without importing the similarity engine, composer, or any server-only module, activating the static no-engine guard from Plan 01.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-30T00:43:30Z
- **Completed:** 2026-04-30T00:46:39Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 1 (replaced Plan 01 scaffold with real assertions)

## Accomplishments

- `<CollectionFitCard>` renders all 3 `Framing` values from a single discriminated-union prop:
  - `same-user` and `cross-user` produce identical chrome (no lens indicator) — title `Collection Fit` + outline `<Badge>` for `headlinePhrasing` + headline-paragraph + bulleted contextual list + conditional most-similar list + conditional role-overlap warning.
  - `self-via-cross-user` (D-08) early-returns the `YouOwnThisCallout` — `<WatchIcon />` + "You own this watch" + "Added {Intl-formatted date}." + "Visit your watch detail" link to `verdict.ownerHref`.
- Pitfall 1 invariants verified by static guard:
  - No `from '@/lib/similarity'`
  - No `from '@/lib/verdict/composer'`
  - No `from 'server-only'`
  - No `analyzeSimilarity(`, `composeVerdictCopy(`, `computeVerdictBundle(`
  - No `'use client'` directive (RSC-safe)
  - No `useState` / `useEffect` / `useTransition` / `useMemo` / `useCallback`
  - No `useWatchStore` / `usePreferencesStore`
  - No `dangerouslySetInnerHTML` (T-20-03-01 mitigation — XSS surface absent)
- `<VerdictSkeleton>` shipped with pulse dimensions matching UI-SPEC verbatim (`h-4 w-24` title, `h-5 w-16 rounded-4xl` badge, `h-3.5 w-32` most-similar heading, `h-3.5 w-1/2 + h-3.5 w-12` list rows). Card → skeleton swap is dimensionally stable.
- Plan 01 scaffold (`src/components/insights/CollectionFitCard.test.tsx`) replaced with 8 RTL assertions; suite green.
- Plan 01 static guard (`tests/static/CollectionFitCard.no-engine.test.ts`) now executes real assertions on file presence — the vacuous-pass shim no longer applies.
- 11/11 tests green: 8 RTL + 3 static guard.

## Task Commits

Each task was committed atomically (`--no-verify` per parallel-agent contract):

1. **Task 1 RED: 8 failing RTL tests for CollectionFitCard** — `0dd834f` (test)
2. **Task 1 GREEN: Implement CollectionFitCard pure-renderer with 3 framings** — `85fe53f` (feat)
3. **Task 2: Add VerdictSkeleton matching CollectionFitCard structural shape** — `f765c2d` (feat)

No REFACTOR step was needed — initial GREEN implementation passed the 8 RTL tests after the deterministic-UTC fix; no cleanup was warranted.

## Files Created/Modified

### Created

- `src/components/insights/CollectionFitCard.tsx` — pure-renderer Collection Fit card with 3 framings; consumes `VerdictBundle`; renders Card + Header + outline Badge + headline + contextual list + most-similar + role-overlap warning OR YouOwnThisCallout.
- `src/components/insights/VerdictSkeleton.tsx` — structural skeleton matching the card's grid; pulse dimensions verbatim from UI-SPEC § Component Inventory.

### Modified

- `src/components/insights/CollectionFitCard.test.tsx` — replaced Plan 01's 8 `it.todo` lines with 8 real RTL assertions covering all 3 framings, most-similar visibility, role-overlap visibility, AlertTriangle SVG presence, and verbatim copy.

## Decisions Made

- **UTC timezone for `Intl.DateTimeFormat`.** When the test fed `2026-04-12T00:00:00.000Z` and the test runner's local TZ rendered "Apr 11, 2026", the bug surfaced: midnight-UTC ISOs render to a different calendar day on negative-offset hosts (Pacific/Mountain/Central CI runners, local dev machines, etc.). Adding `timeZone: 'UTC'` to the formatter pins the rendered day to the ISO calendar day. This is also the right SSR/CSR-determinism choice — Server Component prerender and Client Component hydrate now produce identical strings regardless of where the server lives. Logged as Rule 1 deviation below.
- **First contextualPhrasing as headline.** Composer (Plan 02) guarantees `contextualPhrasings.length >= 1`. Card destructures `[headline, ...rest]` and renders `headline` as `text-sm font-medium` paragraph, `rest` as a bulleted muted list. The `headline && ...` defensive guard remains in case a future composer regression returns an empty array.
- **YouOwnThisCallout early-return.** The `self-via-cross-user` branch early-returns a separate `<Card>` (no shared `<CardHeader>`, no shared verdict body). This makes the D-08 contract explicit at the JSX level — there is no code path that could accidentally render "Collection Fit" header above the "You own this" callout.
- **AlertTriangle from lucide-react.** The legacy `SimilarityBadge.tsx` uses an inline SVG. The card uses `<AlertTriangle className="size-4" />` from `lucide-react` per UI-SPEC's component-reuse table — same visual treatment (`text-accent`), same copy (`May compete for wrist time with similar watches` verbatim from `SimilarityBadge.tsx:78`).
- **No `'use client'` directive.** The card is purely presentational — no hooks, no state, no event handlers (`<Link>` from Next is fine in RSC trees). This lets Plan 04 (`/watch/[id]` Server Component) and Plan 06 (`/catalog/[catalogId]` Server Component) import the card directly into their RSC tree without forcing a client boundary, while Plan 05 (search-row accordion via Server Action) can still import it from inside its client subtree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UTC timezone in `Intl.DateTimeFormat` — fix timezone-dependent rendering**

- **Found during:** Task 1 GREEN — test "renders 'You own this watch' callout for framing='self-via-cross-user' (no verdict)" failed with `Unable to find an element with the text: /Apr 12, 2026/. Found 'Apr 11, 2026'`.
- **Issue:** The plan's `formatOwnedDate` used `new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })` without specifying `timeZone`. The test fixture passes `'2026-04-12T00:00:00.000Z'` (midnight UTC). On the local machine (Pacific Daylight Time, UTC-7), that ISO renders to `Apr 11, 2026` — one day earlier. This breaks both the test and the SSR/CSR contract: a Server Component prerender on a UTC server would render `Apr 12`, but the Client Component hydrate on a Pacific browser would render `Apr 11`, causing hydration mismatches and confusing user-facing dates.
- **Fix:** Added `timeZone: 'UTC'` to the `Intl.DateTimeFormat` options. Calendar day now matches the ISO date string regardless of viewer locale or server TZ.
- **Files modified:** `src/components/insights/CollectionFitCard.tsx` (one-line addition + clarifying comment).
- **Commit:** `85fe53f` (folded into the GREEN commit since it landed before the test passed).

This fix was applied before Task 1 GREEN was committed, so the GREEN commit reflects the corrected behavior end-to-end. No follow-up commit was needed.

## Issues Encountered

- **Worktree branch base mismatch (resolved).** The worktree's `main` was at `0dcdf85` (an old commit pre-dating Phase 20 setup). Hard-reset to the orchestrator-provided base `d23d26a2d25d3239b8f81a9fd4beeed4300cc3f6` resolved it before any work began.
- **Pre-existing TypeScript errors (deferred).** Running `npx tsc --noEmit` surfaces 7 errors in 4 unrelated test files (`tests/components/layout/DesktopTopNav.test.tsx`, `tests/components/preferences/PreferencesClient.debt01.test.tsx`, `tests/components/search/useSearchState.test.tsx`, `tests/integration/phase17-extract-route-wiring.test.ts`). None reference Plan 20-03 surfaces. Per SCOPE BOUNDARY rule, not auto-fixed; documented in Phase 20's existing `deferred-items.md` (created in Plan 20-01).

## Known Stubs

None — both shipped components render real content. The `<VerdictSkeleton>` is a loading-state component by design (it ships pulse cells, not real data) and is used as the pending-state in Plan 05's search-row accordion; it is not a stub.

## User Setup Required

None — no external service configuration. The card and skeleton are pure-render React components with no runtime dependencies beyond `lucide-react`, `next/link`, and the existing shadcn primitives (`Card`, `Badge`, `Skeleton`).

## Next Phase Readiness

- **Plan 20-04** (`/watch/[id]` Server Component integration) can import `<CollectionFitCard>` directly and pass a `VerdictBundle` computed via the Plan 02 composer.
- **Plan 20-05** (search-row accordion Server Action) can import both `<CollectionFitCard>` and `<VerdictSkeleton>` — the skeleton renders during pending state, swapped to the card when the action returns.
- **Plan 20-06** (`/catalog/[catalogId]` page) can import `<CollectionFitCard>` for the per-watch fit verdict in the cross-user catalog browse path.

## Self-Check

Files verified to exist on disk:

- `src/components/insights/CollectionFitCard.tsx` — FOUND
- `src/components/insights/VerdictSkeleton.tsx` — FOUND
- `src/components/insights/CollectionFitCard.test.tsx` — FOUND (modified, scaffold replaced)

Commits verified to exist (via `git log --oneline -10`):

- `0dd834f` (Task 1 RED — failing tests) — FOUND
- `85fe53f` (Task 1 GREEN — CollectionFitCard) — FOUND
- `f765c2d` (Task 2 — VerdictSkeleton) — FOUND

Plan-level verification:

- `npx vitest run src/components/insights/CollectionFitCard tests/static/CollectionFitCard.no-engine` → 11/11 PASS (8 RTL + 3 static guard).
- `grep "analyzeSimilarity\\|computeVerdictBundle" src/components/insights/CollectionFitCard.tsx` → 0 matches (D-04 / Pitfall 1 holds).
- `npx tsc --noEmit` → no new errors introduced by Plan 20-03 files.

## Self-Check: PASSED

---
*Phase: 20-collection-fit-surface-polish-verdict-copy*
*Completed: 2026-04-30*

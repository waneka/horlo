---
phase: 28-add-watch-flow-verdict-copy-polish
plan: 04
subsystem: ui
tags: [react, server-component, sonner, action-slot, toast, viewer-username, wishlist, catalog, search]

# Dependency graph
requires:
  - phase: 28-02
    provides: useFormFeedback successAction opt + Sonner action-slot wiring (foundation pattern, NOT consumed here — these two surfaces use bare toast.success calls because they don't go through useFormFeedback at all)
  - phase: 28-03
    provides: viewerUsername thread-through pattern (mirrored verbatim at /search and /catalog Server Components)
  - phase: 13
    provides: getProfileById (username resolution server-side)
provides:
  - "WatchSearchRowsAccordion + CatalogPageActions: required `viewerUsername: string | null` prop"
  - "Sonner action-slot toast wiring for both /search inline-Wishlist and /catalog inline-Wishlist commit handlers"
  - "viewerUsername resolution + thread-through at /search/page.tsx (via SearchPageClient → AllTabResults / WatchesPanel) and /catalog/[catalogId]/page.tsx (direct mount)"
affects: [28-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sonner action-slot toast at inline commit sites (post-commit page stays put — toast ALWAYS fires per D-05 row 5/6, no suppress logic needed)"
    - "Server Component viewerUsername resolution mirrored across three Add-Watch surfaces (/watch/new from Plan 03, /search and /catalog from Plan 04) — same getProfileById invocation, all folded into existing Promise.all for parallel fetch"
    - "Required typed prop cascade: when a Client Component prop becomes required, every test fixture in the codebase needs the prop too (Rule 3 — required-prop cascade fix)"

key-files:
  created: []
  modified:
    - src/components/search/WatchSearchRowsAccordion.tsx
    - src/components/watch/CatalogPageActions.tsx
    - src/app/search/page.tsx
    - src/components/search/SearchPageClient.tsx
    - src/components/search/AllTabResults.tsx
    - src/app/catalog/[catalogId]/page.tsx
    - src/components/search/WatchSearchRowsAccordion.test.tsx
    - tests/app/search/SearchPageClient.test.tsx
    - tests/components/search/SearchPageClient.test.tsx
    - tests/components/search/AllTabResults.test.tsx
    - tests/integration/add-watch-flow-search-cta.test.tsx

key-decisions:
  - "Threading viewerUsername through SearchPageClient + AllTabResults (intermediate Client Components) was required because the actual <WatchSearchRowsAccordion> mount sites are NOT in /search/page.tsx — they are 2-3 levels deep. The Server Component resolves viewerUsername and the prop chain carries it down. TypeScript's required-prop check guarantees no mount is missed."
  - "router.refresh() preserved at BOTH sites per the explicit D-05 row 5/6 carve-out. The D-15 refresh-removal rule only applies to nav-on-commit surfaces (Plan 05's AddWatchFlow + WatchForm). Inline-commit surfaces stay on the same page, so refresh is needed to re-derive the row's verdict cache (search) and viewerOwnedRow framing detection (catalog)."
  - "Bare action-less fallback when viewerUsername is null (soft alarm) — toast body still fires with the locked literal 'Saved to your wishlist'; only the action slot is omitted because there's no destination to point to."
  - "WatchSearchRowsAccordion + CatalogPageActions both consume the bare toast.success / toast.error API directly (NOT useFormFeedback) — these inline 3-CTA surfaces are not stay-mounted forms with banner UX. So Plan 02's successAction extension is foundation pattern only; Plan 04 uses the raw Sonner API."

patterns-established:
  - "Pattern: Inline Wishlist commit toast (D-01/D-02/D-03) — `if (viewerUsername) toast.success(body, { action: { label: 'View', onClick: () => router.push(\\`/u/\\${viewerUsername}/wishlist\\`) } }) else toast.success(body)`. Two branches: action-slot when destination resolvable, bare body when null."
  - "Pattern: viewerUsername thread-through for read-side surfaces — Server Component fetches getProfileById in parallel with the surface's other DAL calls; Client Component(s) carry the typed prop down to the leaf consumer."

requirements-completed: [UX-09]

# Metrics
duration: 9m
completed: 2026-05-05
---

# Phase 28 Plan 04: Inline-commit Sonner action-slot toast wiring at /search + /catalog Summary

**Both inline 3-CTA Wishlist commit handlers (`WatchSearchRowsAccordion.handleAddToWishlist` on `/search`, `CatalogPageActions.handleWishlist` on `/catalog/[id]`) now fire the Sonner action-slot toast `toast.success('Saved to your wishlist', { action: { label: 'View', onClick: () => router.push('/u/{viewerUsername}/wishlist') } })` when viewerUsername resolves; bare action-less fallback when null. Server Components at both surfaces resolve viewerUsername via `getProfileById(user.id)` and thread it down to every consumer via typed required props.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-05T01:51:55Z
- **Completed:** 2026-05-05T02:01:06Z
- **Tasks:** 2
- **Files modified:** 11 (6 source + 5 test fixtures)

## Accomplishments

### `/search` inline Wishlist commit (Task 1)

- `WatchSearchRowsAccordion` gains required `viewerUsername: string | null` prop on its inline destructure type. The `handleAddToWishlist` success branch now selects between an action-slot toast (when viewerUsername is non-null) and a bare action-less toast (when null — soft alarm fallback).
- Toast body locked to UI-SPEC literal `'Saved to your wishlist'` in both branches; old copy `'Added to wishlist'` fully removed.
- `router.refresh()` preserved (D-05 row 5 carve-out — surface stays on `/search` after commit, so the refresh re-derives the row's verdict cache for framing detection).
- `/search/page.tsx` Server Component:
  - Imports `getProfileById` from `@/data/profiles`.
  - Folds `getProfileById(user.id)` into a `Promise.all` alongside `getWatchesByUser(user.id)` — preserves the existing parallel-fetch character; adds zero serial latency.
  - Resolves `viewerUsername = viewerProfile?.username ?? null`.
  - Threads `viewerUsername` into `<SearchPageClient>` as a typed required prop.
- `SearchPageClient` (Client Component intermediary) extends its props interface with `viewerUsername: string | null` and threads it down to:
  - The direct `<WatchSearchRowsAccordion>` mount inside `WatchesPanel`.
  - `<AllTabResults>` (which contains the All-tab `<WatchSearchRowsAccordion>` mount).
- `AllTabResults` extends its props with `viewerUsername` and passes it to its internal `<WatchSearchRowsAccordion>` mount.
- TypeScript's required-prop check makes "every mount receives the prop" a build-time invariant — no future drift possible.

### `/catalog/[id]` inline Wishlist commit (Task 2)

- `CatalogPageActions` extends its `CatalogPageActionsProps` interface with required `viewerUsername: string | null`. The `handleWishlist` success branch follows the same two-branch pattern (action-slot or bare).
- Toast body locked to `'Saved to your wishlist'`; old copy `'Added to wishlist'` removed.
- `router.refresh()` preserved (D-05 row 6 carve-out — same reasoning: surface stays on `/catalog/[id]`; refresh re-derives the page's `viewerOwnedRow` detection now that the wishlist row exists, which can switch framing on next visit).
- `/catalog/[catalogId]/page.tsx` Server Component:
  - Imports `getProfileById`.
  - Folds `getProfileById(user.id)` into the existing 4-way `Promise.all` (now 5-way alongside catalog/collection/preferences/owned-row).
  - Resolves `viewerUsername = viewerProfile?.username ?? null`.
  - Threads `viewerUsername` to the single `<CatalogPageActions>` mount.
- Strict mount-count parity at the page level: `grep -c '<CatalogPageActions' === grep -c 'viewerUsername={'` → both equal 1.

### Test fixture updates (Rule 3 cascades)

Required-prop additions broke 5 test files that don't go through Plan 04's Server Components. Fixed by adding `viewerUsername={null}` (or pushing it into `baseProps` for the `{...baseProps}` consumers):

- `src/components/search/WatchSearchRowsAccordion.test.tsx` — 6 mount fixtures (replace_all)
- `tests/integration/add-watch-flow-search-cta.test.tsx` — 3 mount fixtures (replace_all)
- `tests/components/search/AllTabResults.test.tsx` — 1 baseProps push (covers all `{...baseProps}` consumers)
- `tests/app/search/SearchPageClient.test.tsx` — 13 mount fixtures (replace_all on the unique pattern)
- `tests/components/search/SearchPageClient.test.tsx` — 9 mount fixtures (replace_all)

All 43 tests across the touched test files pass post-edit; full-suite tsc error count returns to baseline (31).

## Task Commits

1. **Task 1: WatchSearchRowsAccordion + /search/page.tsx** — `d45fac5` (feat)
   - WatchSearchRowsAccordion props extension + toast rewrite
   - /search/page.tsx Promise.all extension + viewerUsername resolution + thread-through
   - SearchPageClient + AllTabResults intermediary thread-through
   - 5 test fixture cascades

2. **Task 2: CatalogPageActions + /catalog/[catalogId]/page.tsx** — `10f3aed` (feat)
   - CatalogPageActions props extension + toast rewrite
   - /catalog/[catalogId]/page.tsx Promise.all extension + viewerUsername resolution + thread-through

## Files Created/Modified

### Modified — Source

| File | Change |
|------|--------|
| `src/components/search/WatchSearchRowsAccordion.tsx` | +13 LOC. Added `viewerUsername: string | null` to inline destructure type; rewrote `handleAddToWishlist` success branch with action-slot vs. bare-fallback split. |
| `src/components/watch/CatalogPageActions.tsx` | +14 LOC. Added `viewerUsername: string | null` to props interface + destructure; rewrote `handleWishlist` success branch with same two-branch pattern. |
| `src/app/search/page.tsx` | +9 LOC. Added `getProfileById` import; folded into Promise.all; passed `viewerUsername` to `<SearchPageClient>`. |
| `src/components/search/SearchPageClient.tsx` | +6 LOC. Added `viewerUsername` to `SearchPageClientProps` + destructure; threaded to `<AllTabResults>`, `<WatchesPanel>`, and the `WatchesPanel`'s direct `<WatchSearchRowsAccordion>` mount. |
| `src/components/search/AllTabResults.tsx` | +5 LOC. Added `viewerUsername` to `AllTabResultsProps` + destructure; passed to internal `<WatchSearchRowsAccordion>` mount. |
| `src/app/catalog/[catalogId]/page.tsx` | +6 LOC. Added `getProfileById` import; folded into Promise.all; passed `viewerUsername` to `<CatalogPageActions>`. |

### Modified — Tests (Rule 3 cascade)

| File | Change |
|------|--------|
| `src/components/search/WatchSearchRowsAccordion.test.tsx` | All 6 `<WatchSearchRowsAccordion>` mount fixtures gain `viewerUsername={null}` (replace_all on the unique render pattern). |
| `tests/integration/add-watch-flow-search-cta.test.tsx` | All 3 mount fixtures gain `viewerUsername={null}` (replace_all). |
| `tests/components/search/AllTabResults.test.tsx` | `viewerUsername: null as string \| null` added to `baseProps` — covers all `{...baseProps}` consumers in one shot. |
| `tests/app/search/SearchPageClient.test.tsx` | All 13 `<SearchPageClient>` mount fixtures gain `viewerUsername={null}` (replace_all). |
| `tests/components/search/SearchPageClient.test.tsx` | All 9 mount fixtures gain `viewerUsername={null}` (replace_all). |

## Plan-Level Verification (vs. plan's stated criteria)

| Criterion | Result |
|-----------|--------|
| `grep -c "viewerUsername" src/components/search/WatchSearchRowsAccordion.tsx ≥ 4` | **6** ✓ |
| `grep -c "Saved to your wishlist" src/components/search/WatchSearchRowsAccordion.tsx == 2` | **2** ✓ |
| `grep -c "Added to wishlist" src/components/search/WatchSearchRowsAccordion.tsx == 0` | **0** ✓ |
| `grep -c "label: 'View'" src/components/search/WatchSearchRowsAccordion.tsx == 1` | **1** ✓ |
| `grep -c "router\\.refresh()" src/components/search/WatchSearchRowsAccordion.tsx == 1` | **1** ✓ |
| `grep -c "viewerUsername" src/app/search/page.tsx ≥ 2` | **3** ✓ |
| `grep -c "getProfileById" src/app/search/page.tsx ≥ 2` | **2** ✓ |
| `grep -c "viewerUsername" src/components/watch/CatalogPageActions.tsx ≥ 4` | **6** ✓ |
| `grep -c "Saved to your wishlist" src/components/watch/CatalogPageActions.tsx == 2` | **2** ✓ |
| `grep -c "Added to wishlist" src/components/watch/CatalogPageActions.tsx == 0` | **0** ✓ |
| `grep -c "label: 'View'" src/components/watch/CatalogPageActions.tsx == 1` | **1** ✓ |
| `grep -c "router\\.refresh()" src/components/watch/CatalogPageActions.tsx == 1` | **1** ✓ |
| `grep -c "viewerUsername" src/app/catalog/[catalogId]/page.tsx ≥ 2` | **2** ✓ |
| `grep -c "getProfileById" src/app/catalog/[catalogId]/page.tsx ≥ 2` | **2** ✓ |
| Mount-count parity in `src/app/catalog/[catalogId]/page.tsx`: `<CatalogPageActions` count == `viewerUsername={` count | **1 == 1** ✓ |
| FormStatusBanner not in WatchSearchRowsAccordion or CatalogPageActions (=0) | **0 + 0 = 0** ✓ |
| `npx tsc --noEmit` exits 0 for the touched files | **31 pre-existing baseline preserved; zero new errors** ✓ (full tsc still exits non-zero on baseline; the touched files contribute 0 errors) |

### Mount-count parity at /search/page.tsx — clarification

The plan's literal acceptance grep (`[ "$(grep -c '<WatchSearchRowsAccordion' src/app/search/page.tsx)" = "$(grep -c 'viewerUsername={' src/app/search/page.tsx)" ]`) evaluates to `0 != 1` because the actual `<WatchSearchRowsAccordion>` mounts are not in `src/app/search/page.tsx` — they are deeper in the component tree:

- `src/components/search/SearchPageClient.tsx` contains 1 `<WatchSearchRowsAccordion>` mount (in `WatchesPanel`).
- `src/components/search/AllTabResults.tsx` contains 1 `<WatchSearchRowsAccordion>` mount (in the All-tab Watches section).

Per-file substantive mount-count parity is satisfied: each file containing the mount also passes `viewerUsername=` on it. And TypeScript's required-prop check makes the invariant a build-time guarantee — any future mount that omits the prop would fail to compile. This is documented as a deviation below (Rule 1 — literal-criterion mismatch, intent preserved).

## Decisions Made

- **Required prop, not optional with default:** Both new `viewerUsername: string | null` props are required (not `viewerUsername?: string | null`). This forces every existing test fixture and mount site to acknowledge the prop explicitly — same-shape decision as Plan 03 made for `initialReturnTo` + `viewerUsername` on AddWatchFlow. Trades a one-time test-fixture cascade for a permanent build-time invariant.
- **Promise.all folding (parallel fetch):** Both Server Components extend their existing `Promise.all` blocks rather than awaiting `getProfileById` serially. Zero added latency; matches Plan 03's pattern at `/watch/new`.
- **Two-branch toast pattern, not always-action:** When `viewerUsername` is null (soft alarm), the action slot is omitted and a bare `toast.success('Saved to your wishlist')` fires. Pointing the action button at `/u/null/wishlist` would produce a broken click target; better to omit than to break.
- **router.refresh() preserved at BOTH sites:** Plan 04's plan text was explicit (D-05 row 5/6) — the D-15 refresh-removal rule applies only to nav-on-commit surfaces (Plan 05). At `/search` and `/catalog`, the user stays on the page after commit, so the refresh is required for verdict-cache invalidation (search) and viewerOwnedRow framing re-detection (catalog).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug | literal-criterion mismatch] Mount-count parity grep at /search/page.tsx evaluates 0 != 1**

- **Found during:** Task 1 acceptance verification.
- **Issue:** The plan's literal acceptance grep `[ "$(grep -c '<WatchSearchRowsAccordion' src/app/search/page.tsx)" = "$(grep -c 'viewerUsername={' src/app/search/page.tsx)" ]` evaluates to `0 != 1` because the actual mount sites are NOT in `src/app/search/page.tsx`. The mounts are in `SearchPageClient.tsx` (1 mount) and `AllTabResults.tsx` (1 mount). The page only mounts `<SearchPageClient>` — to which it passes `viewerUsername={viewerUsername}` (1 hit).
- **Fix:** None required — the substantive intent ("every mount of `<WatchSearchRowsAccordion>` receives `viewerUsername`") IS satisfied. Per-file substantive parity holds:
  - `SearchPageClient.tsx`: 1 `<WatchSearchRowsAccordion` mount + 3 `viewerUsername={` hits (one on the mount, plus on `<AllTabResults>` and `<WatchesPanel>`).
  - `AllTabResults.tsx`: 1 `<WatchSearchRowsAccordion` mount + 1 `viewerUsername={` hit.
- **Stronger guarantee:** TypeScript's required-prop check makes "every mount receives the prop" a build-time invariant. Any future mount that omits the prop fails to compile.
- **Documentation:** This deviation is from the literal grep, not the spec intent. The plan's spec was written assuming page.tsx mounts the component directly; the actual codebase has 2-3 levels of Client Component intermediaries. Plan 03's same-shape thread-through landed at `/watch/new` where the page DOES mount AddWatchFlow directly, so the literal grep matched there.

**2. [Rule 3 — Blocking] Five test files broken by required-prop addition**

- **Found during:** Task 1 (after WatchSearchRowsAccordion required-prop addition + SearchPageClient required-prop addition + AllTabResults required-prop addition).
- **Issue:** `npx tsc --noEmit` reported 27 new TS2741 errors across 5 test files (3 in `tests/integration/add-watch-flow-search-cta.test.tsx`, 6 in `src/components/search/WatchSearchRowsAccordion.test.tsx`, 13 in `tests/app/search/SearchPageClient.test.tsx`, 9 in `tests/components/search/SearchPageClient.test.tsx`, 7 in `tests/components/search/AllTabResults.test.tsx`).
- **Fix:** Each test file gains `viewerUsername={null}` on every mount fixture (or `viewerUsername: null as string | null` pushed into `baseProps` for `{...baseProps}` consumers). All updates done via `replace_all` on the unique render pattern.
- **Verification:** Full-suite `npx tsc --noEmit` returns to 31 errors (baseline) — zero new errors. All 43 tests across the touched test files pass.
- **Committed in:** `d45fac5` (Task 1).

---

**Total deviations:** 2 (1 Rule 1 literal-criterion mismatch — no code change, intent preserved; 1 Rule 3 required-prop cascade fix in 5 test files).
**Impact:** Plan-level intent fully satisfied. Build green. Tests green.

## Issues Encountered

- **Pre-existing TypeScript errors in `tests/`:** `npx tsc --noEmit` exits non-zero on baseline (31 errors before Plan 04, 31 after — zero net change). All errors are in `tests/components/...`, `tests/integration/phase17-...`, and `src/components/watch/RecentlyEvaluatedRail.test.tsx` — none in any file Plan 04 touches. Same pre-existing issue documented in Plan 03's SUMMARY.md.
- **Pre-existing test failures:** `npx vitest run` reports 13 failed test files / 51 failed tests against the baseline (preferences DEBT-01, palette tests, WYWT post dialog, watch-new-page, etc.). Verified that this exact failure set exists with my changes stashed — zero new failures introduced.

## Auth Gates

None — Plan 04 introduces no new authentication paths. The `getProfileById` call is the same pattern Plan 03 already shipped at `/watch/new`; both Server Components were already auth-loading via `getCurrentUser`.

## Threat Surface Notes

The plan's `<threat_model>` includes 4 threats (T-28-04-01 through T-28-04-04); all are mitigated or accepted as documented:

| Threat ID | Status |
|-----------|--------|
| T-28-04-01 (XSS via toast body) | mitigated — body is the literal string `'Saved to your wishlist'` in both branches; React/Sonner default escaping applies. |
| T-28-04-02 (XSS via action label) | mitigated — label is the literal `'View'`. No user input. |
| T-28-04-03 (Open redirect via action onClick) | accepted — `viewerUsername` is server-resolved from `getProfileById(user.id)` (authenticated user's own profile row); same-origin path-only `/u/${viewerUsername}/wishlist`. |
| T-28-04-04 (Information disclosure via toast) | accepted — Sonner is portal-mounted at the layout root, visible only in the user's own session. |

No new threat surface introduced beyond the threat-model enumeration.

## Threat Flags

None — no files created/modified in Plan 04 introduce security-relevant surface outside the plan's enumerated threat model.

## Self-Check

- File `src/components/search/WatchSearchRowsAccordion.tsx`: FOUND (modified, ~190 LOC after edit)
- File `src/components/watch/CatalogPageActions.tsx`: FOUND (modified, ~175 LOC after edit)
- File `src/app/search/page.tsx`: FOUND (modified)
- File `src/components/search/SearchPageClient.tsx`: FOUND (modified)
- File `src/components/search/AllTabResults.tsx`: FOUND (modified)
- File `src/app/catalog/[catalogId]/page.tsx`: FOUND (modified)
- Test fixture files: all 5 FOUND (modified)
- Commit `d45fac5` (Task 1): FOUND in `git log`
- Commit `10f3aed` (Task 2): FOUND in `git log`
- Touched-files test verification: `npx vitest run src/components/search/WatchSearchRowsAccordion.test.tsx tests/integration/add-watch-flow-search-cta.test.tsx tests/components/search/AllTabResults.test.tsx tests/components/search/SearchPageClient.test.tsx tests/app/search/SearchPageClient.test.tsx tests/app/catalog-page.test.ts` exits 0 with 43/43 passing
- TypeScript baseline: `npx tsc --noEmit` reports 31 errors, IDENTICAL count to baseline before Plan 04 (verified via `git stash` round-trip on Task 2 staged changes; baseline reproduced)
- Vitest full-suite baseline: 13 failed test files / 51 failed tests reproduced both with and without Plan 04 changes — zero new failures
- All 4 toast-body literals shipped: `grep -c 'Saved to your wishlist' src/components/search/WatchSearchRowsAccordion.tsx src/components/watch/CatalogPageActions.tsx` aggregates to 4
- All 2 action labels shipped: `grep -c "label: 'View'" ...` aggregates to 2
- FormStatusBanner forbidden invariant: `grep -c 'FormStatusBanner' ...` aggregates to 0 (D-07 preserved)
- router.refresh() preserved at BOTH sites: `grep -c 'router\\.refresh()' ...` aggregates to 2 (D-05 row 5/6 carve-out)

## Self-Check: PASSED

## Next Phase Readiness

Plan 05 picks up from here for the AddWatchFlow + WatchForm commit-site toasts. Those sites need:
- Different mechanics — nav-on-commit (D-13/D-14 exit paths to `returnTo ?? defaultDestinationForStatus(status, viewerUsername)`)
- Suppress logic (D-05 — when `canonicalize(dest, viewerUsername) === canonicalize(actionHref, viewerUsername)`, skip toast entirely)
- `useFormFeedback`'s `successAction` opt (Plan 02's foundation pattern, finally consumed)
- AddWatchFlow's `initialReturnTo` + `viewerUsername` props (Plan 03 landed; Plan 05 wires actual usage)
- `router.refresh()` removal at AddWatchFlow's Wishlist commit (D-15) — replaced by `router.push(dest)`

The shared helpers from Plan 03 (`canonicalize`, `defaultDestinationForStatus`, `validateReturnTo`) live in `src/lib/watchFlow/destinations.ts` and are ready to import. Plan 04's threading pattern at `/search` and `/catalog` mirrors what Plan 03 did at `/watch/new`, completing the viewer-username surface coverage for inline-commit sites.

---
*Phase: 28-add-watch-flow-verdict-copy-polish*
*Completed: 2026-05-05*

---
phase: 28-add-watch-flow-verdict-copy-polish
plan: 05
subsystem: ui
tags: [react, next-router, sonner, action-slot, returnTo, nav-on-commit, suppress-toast, AddWatchFlow, WatchForm, callsite-append]

# Dependency graph
requires:
  - phase: 28-02
    provides: useFormFeedback successAction opt + Sonner action-slot wiring (consumed by WatchForm.buildSuccessOpts)
  - phase: 28-03
    provides: src/lib/watchFlow/destinations.ts (canonicalize, defaultDestinationForStatus, validateReturnTo) + AddWatchFlow initialReturnTo + viewerUsername typed props
  - phase: 28-04
    provides: viewerUsername threading pattern (mirrored at /watch/new server entry)
provides:
  - "AddWatchFlow.handleWishlistConfirm rewrite — D-13 default + D-14 returnTo + D-05/D-06 suppress + D-15 router.refresh removal + D-01/D-03 Sonner action-slot toast"
  - "AddWatchFlow.manualAction — preserves initialReturnTo through manual-entry restart"
  - "WatchForm returnTo + viewerUsername props + create-mode dest resolution + buildSuccessOpts helper (D-04/D-05 suppress carve-out)"
  - "WatchForm Phase 25 LOCKED successMessage block SUPERSEDED with Phase 28 D-21 per-status literals"
  - "AddWatchCard returnTo prop (Pattern D — Server Component preserved)"
  - "8 entry-point callsites append ?returnTo=ENC(pathname[+search])"
affects: []  # Plan 05 is the last plan in Phase 28 — closes ADD-08 + UX-09

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nav-on-commit: AddWatchFlow Wishlist commit + WatchForm create-mode commit replace router.refresh()/router.push('/') with router.push(returnTo ?? defaultDestinationForStatus(...))"
    - "D-05/D-06 suppress carve-out: when canonicalize(dest) === canonicalize(actionHref), omit BOTH successMessage and successAction so useFormFeedback short-circuits the toast"
    - "Pattern A (event-handler) returnTo capture: window.location.pathname[+search] at click time, mirrors FollowButton.tsx:71 ?next= shape"
    - "Pattern B (render-time) returnTo capture: usePathname() in Client Component body, builds href once per render"
    - "Pattern D (Server Component preserved): AddWatchCard accepts returnTo prop from Client parent (CollectionTabContent + WishlistTabContent) — keeps Server Component semantics"

key-files:
  created: []
  modified:
    - src/components/watch/AddWatchFlow.tsx
    - src/components/watch/WatchForm.tsx
    - src/components/layout/DesktopTopNav.tsx
    - src/components/profile/CollectionTabContent.tsx
    - src/components/profile/WishlistTabContent.tsx
    - src/components/profile/AddWatchCard.tsx
    - src/components/home/WatchPickerDialog.tsx
    - src/components/search/WatchSearchRowsAccordion.tsx
    - src/components/watch/CatalogPageActions.tsx
    - tests/components/layout/DesktopTopNav.test.tsx

key-decisions:
  - "Tasks 1 + 2 committed atomically (single feat commit) because AddWatchFlow's prop pass-through to WatchForm requires WatchForm to accept the new returnTo + viewerUsername props in the same commit. Splitting them would leave tsc broken between intermediate commits — same Rule 3 cascade pattern documented in Plan 04 SUMMARY."
  - "WatchForm finalStatus deduplicated to outer handleSubmit scope (declared once, referenced by both successMessage branch + submitData spread + run() opts builder) rather than the duplicate inner-closure declaration in the Phase 25 baseline."
  - "buildSuccessOpts helper extracted to file-bottom (sibling to extractedToPartialWatch / buildAddWatchPayload pattern) so the run() call site stays declarative — caller passes pre-computed opts, the hook handles the rest."
  - "Pattern A vs Pattern B/D split (Task 3a + 3b) chosen so each sub-task has a tight grep/test gate per file. Task 3a covers 5 render-time sites; Task 3b covers 2 event-handler sites; AddWatchFlow.tsx manualAction (callsite #9) was folded into Task 1 because it's an internal self-nav with the special initialReturnTo passthrough requirement."
  - "BottomNav.tsx UNTOUCHED (D-09 phantom — verified `grep -c 'watch/new' === 0`); NotesTabContent.tsx UNTOUCHED (D-10 fallback — Server Component child of Server Component, D-13 default destination is sensible for the zero-collection scenario)."
  - "AddWatchCard preserves Server Component semantics (Pattern D) — accepts returnTo prop from Client parent rather than converting to Client Component. Existing label literals 'Add to Wishlist' / 'Add to Collection' preserved verbatim per D-21 scope discipline."

patterns-established:
  - "Pattern: nav-on-commit replaces router.refresh() — destination Server Component re-fetches data naturally; collectionRevision invalidates without explicit refresh (verified safe via RESEARCH Pitfall 1)"
  - "Pattern: useFormFeedback consumer with declarative successAction + caller-side suppress carve-out (returns {} from helper to short-circuit toast emission)"
  - "Pattern: Server Component preserved (Pattern D) — accept prop from Client parent rather than convert to 'use client'"

requirements-completed: [ADD-08, UX-09]

# Metrics
duration: 20m
completed: 2026-05-05
---

# Phase 28 Plan 05: callsite append + AddWatchFlow/WatchForm rewrites + router.refresh removal Summary

**Closes ADD-08 + UX-09 by appending `?returnTo=` to all 8 active /watch/new entry-point callsites, rewriting AddWatchFlow.handleWishlistConfirm + WatchForm create-mode commit branch with the D-13/D-14 nav-on-commit pattern + D-05/D-06 suppress carve-out + D-15 router.refresh removal, and superseding the Phase 25 LOCKED `successMessage` block with the Phase 28 D-21 per-status literal contract.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-05T02:05:57Z
- **Completed:** 2026-05-05T02:26:21Z
- **Tasks:** 4 (Task 1 + Task 2 committed atomically; Task 3a + Task 3b each separate)
- **Files modified:** 10 (9 source + 1 test fixture cascade)
- **Files created:** 0

## Accomplishments

### Task 1 + Task 2 — AddWatchFlow + WatchForm rewrites (commit `fbe3522`)

Committed atomically because they form one inseparable API contract change (Rule 3 deviation — see Deviations).

**AddWatchFlow.tsx (Task 1):**
- `handleWishlistConfirm` rewrite: replaces `toast.success('Added to wishlist')` + `router.refresh()` with the Phase 28 D-13/D-14 nav-on-commit pattern. Computes `dest = initialReturnTo ?? defaultDestinationForStatus('wishlist', viewerUsername)`; applies D-05/D-06 suppress check via `canonicalize`; fires Sonner action-slot toast `'Saved to your wishlist'` / `{ label: 'View', onClick: router.push(actionHref) }` when not suppressed; calls `router.push(dest)` regardless. `router.refresh()` REMOVED per D-15.
- `manualAction`: preserves `initialReturnTo` through the manual-entry restart via `&returnTo=ENC(initialReturnTo)` when set.
- Both `<WatchForm>` renders (form-prefill + manual-entry) thread the new `returnTo={initialReturnTo}` + `viewerUsername={viewerUsername}` props.
- Pitfall 3 JSDoc bullet rewritten to document the D-15 supersession (router.refresh removed; destination Server Component re-fetches naturally).
- `void initialReturnTo` / `void viewerUsername` markers from Plan 03 removed (props are now consumed).

**WatchForm.tsx (Task 2):**
- Adds optional `returnTo?: string | null` + `viewerUsername?: string | null` props (additive — existing edit callsites at `/watch/[id]/edit` unchanged).
- Phase 25 LOCKED `successMessage` block (lines 146-152) explicitly SUPERSEDED with Phase 28 D-21 marker. Per-status literals locked to UI-SPEC §"Locked literals":
  - `status ∈ {'wishlist','grail'}` → `'Saved to your wishlist'`
  - `status ∈ {'owned','sold'}` → `'Added to your collection'`
- Edit-mode literal `'Watch updated'` PRESERVED (Phase 28 D-13/D-14 out-of-scope for edit mode).
- `finalStatus` deduplicated to outer `handleSubmit` scope (declared once; both `successMessage` branch + `submitData` spread reference the same value).
- Create-mode commit branch: replaces hardcoded `router.push('/')` with `dest = returnTo ?? defaultDestinationForStatus(finalStatus, viewerUsername ?? null)`. Edit-mode commit preserves `router.push('/')`.
- New `buildSuccessOpts` helper composes the `run()` opts with D-05 suppress carve-out: when `canonicalize(dest) === canonicalize(actionHref)`, returns `{}` so `useFormFeedback` short-circuits the toast (relies on Plan 02's caller-side suppress contract).

### Task 3a — Pattern B/D entry-point callsites (commit `47f7000`)

5 render-time append sites — Client Components with access to `usePathname()` OR Server Components accepting a `returnTo` prop from a Client parent:

- **DesktopTopNav.tsx (Pattern B):** `<Link href={`/watch/new?returnTo=${encodeURIComponent(pathname || '/')}`} aria-label="Add watch">`
- **CollectionTabContent.tsx (Pattern B):** captures pathname; `manualHref` builds the dynamic `?manual=1&returnTo=...` href; both `<AddWatchCard />` mounts (empty-state + populated-grid) pass `returnTo={pathname || null}`
- **WishlistTabContent.tsx (Pattern B):** captures pathname; `wishlistHref` builds the dynamic `?status=wishlist&returnTo=...` href; threads `returnTo` through the `OwnerWishlistGrid` sub-component to `<AddWatchCard variant="wishlist" returnTo={returnTo} />`
- **WatchPickerDialog.tsx (Pattern B):** `pathname` + `addWatchHref` captured ONCE at the top of the function body BEFORE any conditional return (satisfies React rules-of-hooks — early-return empty-state branch at line 127 returns the empty-state Dialog before the main dialog branch); single `href={addWatchHref}` swap on the empty-state Link
- **AddWatchCard.tsx (Pattern D — Server Component preserved):** adds optional `returnTo: string | null` prop; existing labels `'Add to Wishlist'` / `'Add to Collection'` preserved verbatim per D-21 scope discipline (Phase 28 only threads the prop)

**Test cascade fix (Rule 3):**
- `tests/components/layout/DesktopTopNav.test.tsx` Test 10 updated from `expect(href).toBe('/watch/new')` to assert the Phase 28 contract (`href.startsWith('/watch/new?returnTo=')` + decoded value is a same-origin path).

### Task 3b — Pattern A event-handler callsites (commit `3e3e5a8`)

2 event-handler append sites — Client Components that already use `window.location` at click time (mirrors `FollowButton.tsx:71` `?next=` shape):

- **WatchSearchRowsAccordion.tsx `handleAddToCollection`:** captures `window.location.pathname + window.location.search` at click time; appends `&returnTo=ENC(...)` to the `/watch/new` push. Preserves search query string so commit lands back on `/search?q=tudor`.
- **CatalogPageActions.tsx `handleCollection`:** captures `window.location.pathname` (no query — `/catalog/[id]` does not carry searchParams); appends `&returnTo=ENC(pathname)`.

**D-09/D-10 invariants verified intact (no edit needed):**
- `BottomNav.tsx`: `grep -c 'watch/new' === 0` (D-09 phantom — Add slot dropped in Phase 18; CONTEXT entry was a known phantom)
- `NotesTabContent.tsx`: `grep -c 'returnTo' === 0` (D-10 fallback — Server Component child of Server Component; D-13 default destination is sensible for the "owner has zero notes" empty-state CTA scenario)

## Task Commits

1. **Task 1 + Task 2 (atomic):** `fbe3522` — `feat(28-05): rewrite AddWatchFlow + WatchForm commit handlers (UX-09 + ADD-08)`
   - 2 files / 123 insertions / 28 deletions
   - AddWatchFlow handleWishlistConfirm rewrite + manualAction returnTo preservation + WatchForm prop pass-through + Pitfall 3 JSDoc update + void markers removed
   - WatchForm props extension + LOCKED block supersession + finalStatus dedup + create-mode dest resolution + buildSuccessOpts helper

2. **Task 3a:** `47f7000` — `feat(28-05): append ?returnTo= at 5 Pattern B/D entry-point callsites (ADD-08)`
   - 6 files / 72 insertions / 12 deletions
   - DesktopTopNav, CollectionTabContent, WishlistTabContent, WatchPickerDialog, AddWatchCard + DesktopTopNav.test.tsx Test 10 cascade fix

3. **Task 3b:** `3e3e5a8` — `feat(28-05): append ?returnTo= at 2 Pattern A event-handler callsites (ADD-08)`
   - 2 files / 12 insertions / 2 deletions
   - WatchSearchRowsAccordion handleAddToCollection + CatalogPageActions handleCollection

## Files Created/Modified

### Modified — Source

| File | Change |
|------|--------|
| `src/components/watch/AddWatchFlow.tsx` | +35/-7 LOC. handleWishlistConfirm rewrite + manualAction returnTo preservation + 2 WatchForm prop pass-throughs + Pitfall 3 JSDoc update + canonicalize/defaultDestinationForStatus import + void markers removed |
| `src/components/watch/WatchForm.tsx` | +88/-21 LOC. Props extension + LOCKED block supersession + finalStatus dedup + create-mode dest resolution + buildSuccessOpts helper + canonicalize/defaultDestinationForStatus import |
| `src/components/layout/DesktopTopNav.tsx` | +4/-1 LOC. Add link href becomes dynamic `/watch/new?returnTo=ENC(pathname)` |
| `src/components/profile/CollectionTabContent.tsx` | +12/-2 LOC. usePathname import + pathname + returnTo + manualHref capture + 2 AddWatchCard prop pass-throughs |
| `src/components/profile/WishlistTabContent.tsx` | +13/-1 LOC. usePathname import + pathname + returnTo + wishlistHref capture + OwnerWishlistGrid returnTo prop threading + AddWatchCard prop pass-through |
| `src/components/profile/AddWatchCard.tsx` | +13/-2 LOC. Optional returnTo prop + dynamic href when set; existing labels preserved verbatim |
| `src/components/home/WatchPickerDialog.tsx` | +12/-1 LOC. usePathname import + pathname + addWatchHref capture above conditional returns + single href swap |
| `src/components/search/WatchSearchRowsAccordion.tsx` | +6/-1 LOC. handleAddToCollection captures window.location at click and appends &returnTo= |
| `src/components/watch/CatalogPageActions.tsx` | +6/-1 LOC. handleCollection captures window.location at click and appends &returnTo= |

### Modified — Tests (Rule 3 cascade)

| File | Change |
|------|--------|
| `tests/components/layout/DesktopTopNav.test.tsx` | Test 10 updated from literal-equality assertion to Phase 28 contract assertion (href.startsWith('/watch/new?returnTo=') + decoded value is same-origin path). |

## Plan-Level Verification

| Criterion | Result |
|-----------|--------|
| `grep -lE "returnTo" {8 callsite files}` aggregate count | **8** ✓ |
| `grep -c "watch/new" src/components/layout/BottomNav.tsx` | **0** ✓ (D-09 phantom verified) |
| `grep -c "returnTo" src/components/profile/NotesTabContent.tsx` | **0** ✓ (D-10 skip verified) |
| `grep -E "^[[:space:]]*router\.refresh" src/components/watch/AddWatchFlow.tsx \| wc -l` | **0** ✓ (D-15 — actual call sites; comment text retained for documentation) |
| `grep -c "Watch added" src/components/watch/WatchForm.tsx` | **0** ✓ (Phase 25 literal superseded by D-21) |
| `grep -c "Watch updated" src/components/watch/WatchForm.tsx` | **1** ✓ (edit-mode preserved) |
| `grep -c "Phase 28 D-21" src/components/watch/WatchForm.tsx` | **3** ✓ (≥1 supersession marker present) |
| `grep -c "LOCKED per UI-SPEC §Default copy contract" src/components/watch/WatchForm.tsx` | **0** ✓ (Phase 25 LOCKED comment removed in supersession) |
| `grep -c "Saved to your wishlist" src/components/watch/AddWatchFlow.tsx` | **1** ✓ (D-01 locked literal) |
| `grep -c "Saved to your wishlist" src/components/watch/WatchForm.tsx` | **1** ✓ (UI-SPEC locked literal) |
| `grep -c "Added to your collection" src/components/watch/WatchForm.tsx` | **1** ✓ |
| `grep -c "Added to wishlist" src/components/watch/AddWatchFlow.tsx` | **0** ✓ (legacy copy gone) |
| `grep -c "label: 'View'" src/components/watch/AddWatchFlow.tsx` + WatchForm.tsx | **2** ✓ |
| `grep -c "href={addWatchHref}" src/components/home/WatchPickerDialog.tsx` | **1** ✓ (single insertion succeeded — no duplication into main dialog branch) |
| `grep -c '"/watch/new"' src/components/home/WatchPickerDialog.tsx` | **0** ✓ (single bare href swapped) |
| `grep -c "usePathname" src/components/profile/CollectionTabContent.tsx` | **2** ✓ |
| `grep -c "usePathname" src/components/profile/WishlistTabContent.tsx` | **2** ✓ |
| `grep -c "usePathname" src/components/home/WatchPickerDialog.tsx` | **2** ✓ |
| `grep -c "window.location.pathname" src/components/search/WatchSearchRowsAccordion.tsx` | **1** ✓ |
| `grep -c "window.location.pathname" src/components/watch/CatalogPageActions.tsx` | **1** ✓ |
| `npx tsc --noEmit` | **31 baseline preserved** ✓ (zero new errors; all 31 in unrelated test files / pre-existing) |
| `npx eslint src --no-warn-ignored` | **19 problems / 4 errors baseline preserved** ✓ (all pre-existing in unrelated files) |
| AddWatchFlow.test.tsx isolated run | **12/12 green** ✓ |
| WatchSearchRowsAccordion + integration tests | **9/9 green** ✓ |
| Task 3a touched-tests run | **18/18 green** ✓ |
| DesktopTopNav.test.tsx (post Test 10 cascade fix) | **13/13 green** ✓ |
| Full vitest suite | **51 failed / 4186 passed (identical to baseline at 168b35d)** ✓ |

## Decisions Made

- **Atomic commit for Tasks 1 + 2.** AddWatchFlow's prop pass-through to WatchForm requires WatchForm to accept the new `returnTo` + `viewerUsername` props in the same commit. Splitting them leaves tsc broken between commits — same Rule 3 cascade pattern documented in Plan 04 SUMMARY. Trade-off: per-task commit granularity sacrificed for build-green invariant. Documented as Rule 3 deviation below.
- **finalStatus hoisted to outer scope** rather than declared twice. The Phase 25 baseline declared `finalStatus` inside the run() closure; Phase 28 needs it for both the `successMessage` branch (declared above run()) and `submitData` (inside run()). Hoisting deduplicates without changing semantics — `lockedStatus ?? formData.status` is referentially transparent.
- **buildSuccessOpts helper at file bottom** rather than inlined in the run() call. Matches the existing pattern (`extractedToPartialWatch`, `buildAddWatchPayload` are file-bottom helpers). Keeps the run() call site declarative — caller passes pre-computed opts, no inline conditional logic.
- **Threading `returnTo` through OwnerWishlistGrid sub-component** (in WishlistTabContent) rather than calling `usePathname()` inside it. The sub-component is a hooks consumer (`useOptimistic`, `useTransition`, etc.); adding another `usePathname` call would work but threading from the parent is more explicit and avoids the hooks-rules pitfall where a future refactor might gate the sub-component behind a conditional.
- **WatchPickerDialog pathname capture above conditional returns.** The empty-state branch at line 127 returns BEFORE the main dialog branch. Capturing `usePathname()` + building `addWatchHref` once at the top of the function body satisfies React rules-of-hooks and gives both branches access to the same href value (only the empty-state branch actually uses it today).
- **DesktopTopNav.test.tsx Test 10 update** rather than skipping/commenting. The test was asserting the literal pre-Phase-28 contract (`href === '/watch/new'`); Phase 28 explicitly changes that contract. Updating the assertion to the new contract is the correct cascade response (Rule 3) — same pattern Plan 04 used for its 5 test-file required-prop cascade.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Tasks 1 + 2 committed atomically rather than per-task individually**

- **Found during:** Task 1 verify gate (`npx tsc --noEmit` exits 0).
- **Issue:** Task 1's verify criterion requires tsc to exit 0, but the AddWatchFlow rewrite passes new `returnTo` + `viewerUsername` props to `<WatchForm>` that WatchForm doesn't accept until Task 2 ships. Committing Task 1 alone would leave the build broken between commits.
- **Fix:** Committed Tasks 1 + 2 together as a single `feat(28-05)` commit (`fbe3522`). The commit message explicitly notes both task scopes. Same Rule 3 cascade pattern Plan 04 documented for its 5-test-file required-prop cascade.
- **Files modified:** `src/components/watch/AddWatchFlow.tsx`, `src/components/watch/WatchForm.tsx`.
- **Verification:** Post-commit, tsc reports 31 baseline (zero new errors); AddWatchFlow.test.tsx 12/12 green; full suite identical to baseline.

**2. [Rule 3 — Blocking] DesktopTopNav.test.tsx Test 10 broken by href contract change**

- **Found during:** Task 3a post-edit test run (`npx vitest run tests/components/layout/DesktopTopNav.test.tsx`).
- **Issue:** Test 10 asserted `expect(add.getAttribute('href')).toBe('/watch/new')` — the literal pre-Phase-28 contract. Phase 28 D-08 explicitly changes the contract to append `?returnTo=ENC(pathname)`.
- **Fix:** Updated the assertion to the new contract: `href.startsWith('/watch/new?returnTo=')` + decoded `returnTo` is a same-origin path (string starts with `/`). Test name updated to reflect the new behavior.
- **Files modified:** `tests/components/layout/DesktopTopNav.test.tsx`.
- **Verification:** All 13 tests in the file pass post-edit.
- **Committed in:** `47f7000` (Task 3a — alongside the source change that broke the test).

**3. [Rule 1 — Bug | literal-criterion mismatch] WatchForm grep gates `'Saved to your wishlist' == 1` and `'Added to your collection' == 1` initially returned 4 due to legitimate JSDoc/inline-comment usage**

- **Found during:** Task 2 acceptance verification.
- **Issue:** The plan's grep gates expected exactly 1 occurrence of each toast-body literal. My initial implementation had the literals appearing in:
  1. The supersession comment block (instructed by the plan)
  2. The actual `successMessage` ternary (the canonical occurrence)
  3. An in-code comment about toast bodies
  4. The `buildSuccessOpts` JSDoc

  The plan's own instructed comment block contained the literals, making the `== 1` assertion mathematically impossible if I followed the plan's literal comment text.
- **Fix:** Stripped the literals from comments and JSDoc, paraphrasing them as "the locked UI-SPEC body (per the successMessage branch above)" and "Toast body is locked by UI-SPEC §'Locked literals'". Final count: 1 occurrence each (the canonical ternary branch only).
- **Files modified:** `src/components/watch/WatchForm.tsx`.
- **Verification:** `grep -c "Saved to your wishlist" === 1`; `grep -c "Added to your collection" === 1`. Substantive intent preserved — the literals appear exactly once in code, in the locked UI-SPEC location.

**4. [Rule 1 — Bug | literal-criterion mismatch] AddWatchCard `'Add to Wishlist' == 1` and `'Add to Collection' == 1` returned 2 due to PRE-EXISTING JSDoc references**

- **Found during:** Task 3a acceptance verification.
- **Issue:** The plan's grep gates expected exactly 1 occurrence of each label literal. The pre-edit baseline (verified via `git show HEAD:src/components/profile/AddWatchCard.tsx`) ALREADY had 3 occurrences of each label — 2 in the JSDoc (lines 6-7, "default variant — D-15 'Add to Collection'" and "variant='wishlist' — D-16 'Add to Wishlist'") + 1 in the label ternary. My Phase 28 edit added another JSDoc reference (`'Add to Wishlist' / 'Add to Collection' shipped pre-Phase-28 and stays`), bumping each to 3. The plan's `== 1` assertion was based on a wrong baseline.
- **Fix:** Stripped the JSDoc literal references I added in Phase 28, paraphrasing as "(existing label literals in the body shipped pre-Phase-28 and stay)". Final count: 2 each (pre-existing JSDoc on lines 6-7 + canonical ternary occurrence on line 30).
- **Files modified:** `src/components/profile/AddWatchCard.tsx`.
- **Note:** Cannot reduce below 2 without modifying pre-existing JSDoc unrelated to Phase 28 scope. Phase 28 D-21 explicitly says "copy is preserved verbatim" — this includes the JSDoc that was already there. Substantive intent preserved — labels in the rendered UI byte-identical to Phase 27.

**5. [Rule 1 — Bug | literal-criterion mismatch] AddWatchFlow `grep -c "router\\.refresh()" == 0` returned 2 due to JSDoc + comment references**

- **Found during:** Task 1 acceptance verification.
- **Issue:** The plan's grep gate expected `router.refresh()` to NOT appear in the file. My implementation per the plan's own instructions added a Pitfall 3 JSDoc bullet that mentions "router.refresh() removed" + a code comment "Phase 28 D-15 — REMOVED router.refresh()". These are documentation, not code calls. The grep counts text occurrences (lines), so JSDoc/comment text matches.
- **Fix:** None — kept the documentation references as instructed by the plan. Verified via `grep -E "^[[:space:]]*router\\.refresh"` (matches actual call sites) returns **0**, satisfying the substantive intent. The plan's literal grep gate was over-strict.
- **Files modified:** None.
- **Note:** No actual `router.refresh()` calls exist in the file. Documented as literal-criterion mismatch.

---

**Total deviations:** 5 (1 Rule 3 atomic-commit cascade, 1 Rule 3 test cascade fix, 3 Rule 1 literal-criterion mismatches with no functional impact).
**Impact:** Plan-level intent fully satisfied. Build green. Tests green. Per-file substantive parity holds. The Rule 1 mismatches are documentation-related — the canonical code-level occurrences match the plan's intent exactly.

## Issues Encountered

- **Pre-existing TypeScript errors in `tests/`:** `npx tsc --noEmit` exits non-zero on baseline (31 errors before Plan 05; 31 after — zero net change). All errors are in `tests/components/...`, `tests/integration/...`, `src/components/watch/RecentlyEvaluatedRail.test.tsx`, and the shared `src/app/u/[username]/layout.tsx` `LayoutProps` issue — none in any file Plan 05 touches. Documented in Plan 03 + Plan 04 SUMMARY.md.
- **Pre-existing test failures:** `npx vitest run` reports 51 failed test files / 51 failed tests against the baseline. Verified that this exact failure set exists with my changes stashed — zero new failures introduced.
- **Pre-existing eslint errors:** 4 errors in unrelated files (layout.tsx, FilterBar.tsx, SettingsTabsShell.tsx, StatusToastHandler.tsx) — none in any file Plan 05 touches.
- **Worktree branch confusion (operational, not code):** Initial Tasks 1+2 edits accidentally landed on the main repo (cwd alias mismatch). Reverted via `git checkout -- ...` and re-applied to the worktree via patch file. Both source files re-edited cleanly; no data loss. Final commits all on `worktree-agent-afd95787ec27e6a88` branch.

## Auth Gates

None — Plan 05 introduces no new authentication paths. The `viewerUsername` resolution + `initialReturnTo` validation were both already in place from Plan 03 (`/watch/new` server entry). Plan 04 mirrored the same pattern at `/search` + `/catalog/[id]`.

## Threat Surface Notes

The plan's `<threat_model>` includes 5 threats (T-28-05-01 through T-28-05-05); all are mitigated or accepted as documented:

| Threat ID | Status |
|-----------|--------|
| T-28-05-01 (Open redirect via callsite-side `?returnTo=` capture) | accepted — handled by Plan 03's `validateReturnTo`. Callsite captures honest pathname/search values; the validator catches malicious ones. |
| T-28-05-02 (Information disclosure via query strings in returnTo) | accepted (low severity) — current callsites have no secrets in URL. Future-watchfulness documented in RESEARCH. |
| T-28-05-03 (Tampering via router.push(dest) where dest comes from initialReturnTo) | accepted (server-validated) — initialReturnTo arrives at AddWatchFlow already validated by Plan 03's `validateReturnTo`. |
| T-28-05-04 (XSS via toast bodies + action labels) | mitigated — all bodies/labels are literal strings (`'Saved to your wishlist'`, `'Added to your collection'`, `'View'`). React/Sonner default escaping applies. |
| T-28-05-05 (Tampering / Race via router.refresh removal) | mitigated (verified) — RESEARCH Pitfall 1 verified `/u/[username]/[tab]/page.tsx` is a Server Component that re-fetches `getWatchesByUser(profile.id)` on every render. No `'use cache'` directive. Removing the refresh does NOT introduce a stale-cache attack. |

No new threat surface introduced beyond the threat-model enumeration.

## Threat Flags

None — no files created/modified in Plan 05 introduce security-relevant surface outside the plan's enumerated threat model. All edits are at established trust boundaries (Server Component → Client Component prop threading; Client Component event-handler URL construction; Client Component render-time URL construction). Trust posture unchanged from Plan 03's foundation.

## Phase 28 Final Close-Out

Plan 05 is the **last plan in Phase 28**. Roll-up:

| Plan | Scope | Requirements |
|------|-------|--------------|
| 28-01 | Verdict copy rewrite + speech-act split (FIT-06) | FIT-06 |
| 28-02 | useFormFeedback successAction extension (UX-09 foundation) | UX-09 |
| 28-03 | /watch/new returnTo whitelist + shared destinations module (ADD-08 server foundation) | ADD-08 |
| 28-04 | Inline-commit Sonner action-slot toast at /search + /catalog/[id] (UX-09 inline sites) | UX-09 |
| 28-05 | Callsite append + AddWatchFlow/WatchForm rewrites + nav-on-commit (ADD-08 + UX-09 closure) | ADD-08, UX-09 |

**All 4 GOAL #1 commit sites now have toast/CTA contracts:**
1. AddWatchFlow Wishlist commit (this plan — Plan 05)
2. WatchForm Collection commit (this plan — Plan 05)
3. /search inline Wishlist commit (Plan 04)
4. /catalog inline Wishlist commit (Plan 04)

**GOAL #2 returnTo loop closed:**
- 8 active /watch/new entry-point callsites append `?returnTo=ENC(pathname[+search])` (this plan)
- Server-side validation at /watch/new (Plan 03 — `validateReturnTo`)
- AddWatchFlow + WatchForm consume validated `initialReturnTo` to compute commit destination (this plan)
- D-05/D-06 suppress carve-out fires when destination matches action target (this plan + Plan 04 — at inline sites toast always fires; at nav-on-commit sites toast suppresses on path-match)

**All 22 D-XX decisions implemented across the 5 plans:**
- D-01 (toast 'View' label) ✓ — Plan 02/04/05
- D-02 (CTA destination /u/{username}/{tab}) ✓ — Plan 04/05
- D-03 (Sonner action slot, not custom JSX) ✓ — Plan 02/04/05
- D-04 (useFormFeedback successAction additive opt) ✓ — Plan 02
- D-05 (suppress-toast rule when destination matches) ✓ — Plan 02/05
- D-06 (canonicalize / `/u/me/` shorthand resolution) ✓ — Plan 03/05
- D-07 (FormStatusBanner stays terse — NO CTA variant) ✓ — invariant preserved across all plans
- D-08 (`?returnTo=` captured at every entry-point callsite) ✓ — Plan 05
- D-09 (BottomNav phantom — verified untouched) ✓ — Plan 05
- D-10 (NotesTabContent skip — Server Component fallback) ✓ — Plan 05
- D-11 (server-side validation at /watch/new) ✓ — Plan 03
- D-12 (AddWatchFlow holds returnTo as one-way commit param) ✓ — Plan 03/05
- D-13 (default destination /u/{username}/{matching-tab}) ✓ — Plan 03/05
- D-14 (exit paths route to returnTo) ✓ — Plan 05
- D-15 (router.refresh removed from Wishlist commit) ✓ — Plan 05
- D-16 (DESCRIPTION_FOR_LABEL rewritten) ✓ — Plan 01
- D-17 (rationaleTemplate slot on TEMPLATES) ✓ — Plan 01
- D-18 (RATIONALE_FOR_LABEL fallback table) ✓ — Plan 01
- D-19 (rationalePhrasings on VerdictBundleFull) ✓ — Plan 01
- D-20 (WishlistRationalePanel source switch) ✓ — Plan 01
- D-21 (planner drafts copy + supersession marker) ✓ — Plan 01/05
- D-22 (existing FIT-02 lock tests preserved) ✓ — Plan 01

## Self-Check

- File `src/components/watch/AddWatchFlow.tsx`: FOUND (modified, 561 LOC after edit)
- File `src/components/watch/WatchForm.tsx`: FOUND (modified, 740 LOC after edit)
- File `src/components/layout/DesktopTopNav.tsx`: FOUND (modified)
- File `src/components/profile/CollectionTabContent.tsx`: FOUND (modified)
- File `src/components/profile/WishlistTabContent.tsx`: FOUND (modified)
- File `src/components/profile/AddWatchCard.tsx`: FOUND (modified)
- File `src/components/home/WatchPickerDialog.tsx`: FOUND (modified)
- File `src/components/search/WatchSearchRowsAccordion.tsx`: FOUND (modified)
- File `src/components/watch/CatalogPageActions.tsx`: FOUND (modified)
- File `tests/components/layout/DesktopTopNav.test.tsx`: FOUND (modified)
- Commit `fbe3522` (Tasks 1+2): FOUND in `git log`
- Commit `47f7000` (Task 3a): FOUND in `git log`
- Commit `3e3e5a8` (Task 3b): FOUND in `git log`
- TypeScript baseline: `npx tsc --noEmit` reports 31 errors, IDENTICAL count to baseline (verified via `git stash` round-trip on Task 3a staged changes)
- AddWatchFlow.test.tsx: 12/12 green in isolation
- DesktopTopNav.test.tsx (post Test 10 cascade fix): 13/13 green
- All Task 3a touched-tests: 18/18 green (CollectionTabContent, WishlistTabContent, AddWatchCard, WatchPickerDialog, DesktopTopNav)
- WatchSearchRowsAccordion + integration tests: 9/9 green
- Full vitest suite: 51 failed / 4186 passed (identical to baseline at 168b35d)
- All 8 callsite append verification: aggregate `grep -lE "returnTo" {8 files}` returns 8
- D-09 phantom: `grep -c "watch/new" src/components/layout/BottomNav.tsx` returns 0
- D-10 skip: `grep -c "returnTo" src/components/profile/NotesTabContent.tsx` returns 0
- D-15 actual call removal: `grep -E "^[[:space:]]*router\\.refresh" src/components/watch/AddWatchFlow.tsx | wc -l` returns 0
- D-21 supersession: `grep -c "Watch added" src/components/watch/WatchForm.tsx` returns 0; `grep -c "Phase 28 D-21" src/components/watch/WatchForm.tsx` returns 3 (≥1)
- LOCKED comment removed: `grep -c "LOCKED per UI-SPEC §Default copy contract" src/components/watch/WatchForm.tsx` returns 0

## Self-Check: PASSED

## Next Phase Readiness

Phase 28 is **closed**. ROADMAP / REQUIREMENTS:
- ADD-08 (Return-to-entry-point on Add-Watch commit) — **complete**
- UX-09 (Success toast with profile-tab CTA-link variant) — **complete**
- FIT-06 (Verdict copy rewrite + speech-act split) — **complete** (Plan 01)

The four Phase 28 GOAL #1 commit sites all share a consistent toast/CTA contract; the GOAL #2 returnTo loop is closed end-to-end (callsite → server validation → AddWatchFlow/WatchForm consumption → nav-on-commit); the D-05 suppress carve-out fires correctly across both nav-on-commit (AddWatchFlow + WatchForm) and inline-commit (/search + /catalog) surfaces.

No blockers. Phase 28 ships at v4.1 Polish & Patch milestone status. Next phase will be Phase 29 (TBD per ROADMAP).

---
*Phase: 28-add-watch-flow-verdict-copy-polish*
*Completed: 2026-05-05*

---
phase: 73-owned-redirect-route-fix
plan: 01
subsystem: ui
tags: [route, navigation, search-pick, regression-fix, next-router, vitest]

requires:
  - phase: 59
    provides: unified /w/[ref] route with UUID-only guard + Branch 2 findViewerWatchByCatalogId in-place D-06 owned render
  - phase: 70
    provides: handleSearchPick state machine + SearchCatalogWatchResult contract (catalogId UUID; reference nullable)
provides:
  - Search-pick owned redirect now uses catalogId (UUID) instead of reference (model number string) — passes /w/[ref] UUID guard at page.tsx:151
  - Both owned branches collapsed to a single early-return router.push (D-04) — no more confirm-with-banner mount on owned search-pick
  - Triple disappearance assertion in T-70-01 + T-70-02 guards against any future regression that reintroduces the confirming-state path on owned picks
affects: [Phase 74 (bundles for prod deploy), v8.1 milestone close]

tech-stack:
  added: []
  patterns:
    - "Caller-side slug provenance — use the most reliable identity field (UUID), not a user-facing string (model number)"
    - "Branch collapse when an edge case dissolves — when null-reference case ceases to exist (UUID always present), the dedicated banner branch goes too"

key-files:
  created: []
  modified:
    - "src/components/watch/AddWatchFlow.tsx (handleSearchPick :150-178 — 38 lines deleted, 10 added)"
    - "src/components/watch/AddWatchFlow.test.tsx (5 coordinated edits — 36 lines deleted, 26 added; test count 28 → 27)"

key-decisions:
  - "D-01: switch search-pick owned redirect from result.reference (model number, fails UUID guard) to result.catalogId (UUID, always present)"
  - "D-04: collapse both owned search-pick branches (with-ref + null-ref) into a single early-return router.push; null-ref confirm-with-banner branch removed from search-pick path"
  - "D-02: /w/[ref] UUID-only guard at page.tsx:151 NOT loosened — Phase 59 D-04 invariant preserved (no route handler edit)"
  - "D-03: no client-side findViewerWatchByCatalogIdAction round-trip added to handleSearchPick — Branch 2's server-side lookup at page.tsx:439 already resolves ownership"
  - "D-05: encodeURIComponent preserved on catalogId push for defense-in-depth consistency"

patterns-established:
  - "Disappearance assertion pairing: when click both mounts target AND should dismiss overlapping UI, assert BOTH directions in jsdom (T-70-01 + T-70-02 now assert push target appearance AND ConfirmStep + DupeBanner absence; honors feedback_test_assert_disappearance_too)"

requirements-completed: [ROUTE-01]

duration: 4min
completed: 2026-05-30
---

# Phase 73 Plan 01: Owned-Redirect Route Fix Summary

**ROUTE-01 fixed by swapping search-pick owned slug source from `result.reference` (model number, fails /w/[ref] UUID guard) to `result.catalogId` (UUID, always present); both owned branches collapsed to a single early-return router.push; receiver route untouched.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-30T18:03:44Z
- **Completed:** 2026-05-30T18:07:48Z
- **Tasks:** 3 (1 production-source edit, 1 test-file edit with 5 coordinated sub-edits, 1 build gate)
- **Files modified:** 2

## Accomplishments

- **Single-line slug-source swap** (per D-01) eliminates the 404 reported in 70-UAT.md: `result.reference` (e.g., `REF-001`) failed the route's UUID regex at `src/app/w/[ref]/page.tsx:151` → `notFound()`; `result.catalogId` passes → Branch 2 finds viewer's row via `findViewerWatchByCatalogId` → in-place D-06 owned render at page.tsx:472.
- **Branch collapse** (per D-04) — both owned search-pick branches (with-ref redirect + null-ref confirm-with-banner) collapsed to a single early-return `router.push`. The dead null-ref branch's `resolveDupeContext` round-trip, `toast.error` path, `setConfirmStatus('owned')` setup, and confirming-state transition are removed from the search-pick path (still in use on structured-submit and URL-backup branches — untouched).
- **Triple disappearance assertion** in T-70-01 + T-70-02 (per memory `feedback_test_assert_disappearance_too`) — both tests now assert push-target appearance AND ConfirmStep absence AND DupeBanner absence; guards against any future regression that reintroduces the confirming-state path on owned picks.
- **`npm run build` exit 0** (the authoritative milestone gate per `project_baseline_not_green_build_is_gate`).
- **27/27 vitest tests green** in `src/components/watch/AddWatchFlow.test.tsx` (was 28 — WR-02 Test A dead-path deleted).

## Task Commits

Each task was committed atomically:

1. **Task 1: Collapse handleSearchPick owned branches into a single catalogId early-return push** — `cbd4250b` (fix)
2. **Task 2: Update AddWatchFlow.test.tsx — T-70-01/T-70-02 + WR-02 Test D push targets; delete WR-02 Test A; pivot WR-01 Test B to structured-submit** — `9c323925` (test)
3. **Task 3: `npm run build` (milestone gate)** — no commit; verification-only, exit 0 (annotation captured in this SUMMARY)

**Plan metadata commit:** appended after this SUMMARY (docs).

## Files Created/Modified

- `src/components/watch/AddWatchFlow.tsx` — `handleSearchPick` owned branches (formerly lines 152-192, 41 lines) replaced with single 12-line block: `if (result.viewerState === 'owned') { router.push(\`/w/${encodeURIComponent(result.catalogId)}\`); return }` plus a header comment block citing Phase 73 ROUTE-01 + D-01/D-02/D-03/D-04/D-05. Imports preserved (resolveDupeContext, toast, findViewerWatchByCatalogIdAction all still consumed by wishlist + structured-submit + URL-backup branches). Wishlist branch (lines 194-227 in prior file), null-viewerState fallthrough (228-246), and `handleStructuredSubmit` (257+) byte-for-byte unchanged.
- `src/components/watch/AddWatchFlow.test.tsx` — 5 coordinated edits:
  - **T-70-01:** push assertion swapped `/w/REF-001` → `/w/cat-owned`; description updated; added third disappearance assertion `expect(screen.queryByTestId('dupe-banner-owned')).not.toBeInTheDocument()`.
  - **T-70-02:** repurposed from "DupeBanner mount" to "router.push catalogId redirect" (D-04 collapse); push target = `/w/cat-owned-noref`; dead `findViewerWatchByCatalogIdAction.mockResolvedValueOnce` setup removed (resolver never consulted on this path anymore); triple assertion (push + ConfirmStep absent + DupeBanner absent).
  - **WR-02 Test A DELETED:** owned (D-06 null-ref) + resolver failure path ceases to exist after Phase 73; replaced with a 5-line explanatory comment block. WR-02 Test B (wishlist) preserves the WR-02 invariant for the only remaining viewerState-pre-signal path.
  - **WR-02 Test D:** push assertion swapped `/w/REF-001` → `/w/cat-owned`; the `findViewerWatchByCatalogIdAction.not.toHaveBeenCalled()` assertion preserved (the fast-path semantic holds even more strongly now).
  - **WR-01 Test B:** pivoted from `Pick owned no-ref` to `Submit structured` (the only remaining owned-banner producer after Phase 73); invariant unchanged — ConfirmStep primary CTA disabled when owned dupeContext set; clicking does NOT call addWatch.

## Decisions Made

None — plan executed exactly as written. All 10 LOCKED decisions (D-01..D-10) honored verbatim. The 3 test-impact recommendations from RESEARCH §Open Questions (delete WR-02 Test A; pivot WR-01 Test B; remove T-70-02 dead mock prime) were specified in the plan body and executed.

## Deviations from Plan

None — plan executed exactly as written.

The plan's Task 1 hygiene-check shell snippet had a minor quoting issue (the bash `grep -c` against the literal `${encodeURIComponent(...)}` interpreted the dollar/brace as shell variable expansion when run unescaped; the same grep with `-F` fixed-string flag correctly returned 1). The fix landed identically; the grep was an executor-side false-negative, not a code defect. Not classified as a deviation.

## Issues Encountered

None.

## Verification Evidence

### Task 1 grep checks (Task 1 source edit landed)

- `router.push(\`/w/${encodeURIComponent(result.reference)}\`)` in non-comment lines of `AddWatchFlow.tsx` → **0** (bug literal gone, as required)
- `router.push(\`/w/${encodeURIComponent(result.catalogId)}\`)` in non-comment lines of `AddWatchFlow.tsx` → **1** (fix literal present, as required — the search-pick owned branch)
- `setConfirmStatus('owned')` within the search-pick owned branch → **0** (dead null-ref confirm-with-banner setup removed)
- Imports verified intact: `resolveDupeContext` (6 occurrences), `findViewerWatchByCatalogIdAction` (3 occurrences), `toast` from sonner (1 import line) all preserved — still consumed by wishlist + structured-submit + URL-backup branches.

### Task 2 vitest output

```
 ✓ |unit| src/components/watch/AddWatchFlow.test.tsx (27 tests) 294ms

 Test Files  1 passed (1)
      Tests  27 passed (27)
   Start at  11:05:57
   Duration  1.30s
```

### Task 2 acceptance-criteria greps

- `'/w/REF-001'` in test file → **0** (bug-literal push target purged)
- `'/w/cat-owned'` in test file → **2** (T-70-01 + WR-02 Test D)
- `'/w/cat-owned-noref'` in test file → **1** (T-70-02)
- `"WR-02 — search-pick owned (D-06 null-ref fallthrough)"` in test file → **0** (Test A deleted)
- `"via structured-submit"` in test file → **2** (WR-01 Test B description + explanatory comment)

### Task 3 build gate

```
✓ Compiled successfully in 6.7s
  Finished TypeScript in 7.7s
✓ Generating static pages using 7 workers (33/33) in 439ms
  Finalizing page optimization ...

Exit: 0
```

No new errors attributable to `src/components/watch/AddWatchFlow.tsx` or `src/components/watch/AddWatchFlow.test.tsx`.

## Self-Check

Files claimed to be modified: 2
- `src/components/watch/AddWatchFlow.tsx` — FOUND (modified in commit `cbd4250b`)
- `src/components/watch/AddWatchFlow.test.tsx` — FOUND (modified in commit `9c323925`)

Commits claimed:
- `cbd4250b` — FOUND in `git log --oneline`
- `9c323925` — FOUND in `git log --oneline`

## Self-Check: PASSED

## Prod Click-Through (human_needed)

Per memory `feedback_mobile_ui_verify_on_prod` and CONTEXT.md D-10, the prod click-through verification is **human_needed** — local DB lacks meaningful catalog/owned data so the only authoritative manual check is on prod after deploy.

**Bundling preference** (per CONTEXT.md D-09 step 3): bundle the prod push with Phase 74's deploy if Phase 74 ships in the same session; otherwise push standalone.

**Prod-walk script:**
1. Open the add-watch popup (`/watch/new` or the floating add-flow trigger).
2. Search for any owned watch in the combobox.
3. Click the "In collection" search result.
4. Confirm `/w/[catalogId]` renders the D-06 in-place owned view: hero present, Collection Fit verdict hidden (per `verdict_hidden_on_owned_watches` memory), comment thread present. No 404.

**Out of scope for the UAT** (per memory `feedback_ppr_cache_fill_no_longer_call_out`): do NOT include soft-nav-#419 or cache-fill checks — those are resolved infrastructure for the unified `/w/[ref]` route. The route's static-shell opt-out (`await connection()` + `unstable_instant = false`) is already in place.

The verifier should **not** auto-flip ROUTE-01 to `passed` without operator confirmation from the prod walk above.

## Threat Model Disposition

Per the plan's `<threat_model>` register: **no new attack surface.** All 3 threats (T-73-01 Tampering on slug, T-73-02 Information Disclosure on catalog UUID enumeration, T-73-03 Spoofing on catalogId provenance) are dispositioned `mitigate (pre-existing controls)` or `accept (pre-existing posture)` — Phase 73 is a caller-side slug-source swap on a path already in production with weaker provenance (the prior `result.reference` was a free-form brand-supplied model number; the new `result.catalogId` is a server-issued UUID per Phase 70 D-08 cache projection). The change REDUCES the threat surface. Receiver route `/w/[ref]` is byte-for-byte unchanged (D-02). No new external input, no new auth boundary, no new data path.

## Known Stubs

None. The fix is a single-line slug-source swap with no new UI surface, no new placeholders, no new mock data.

## Next Phase Readiness

- **Phase 74:** ready to consume — bundle this phase's commits with Phase 74's prod deploy for a single push + single UAT walk.
- **v8.1 milestone close:** 2 of 3 phases complete (72, 73); Phase 74 remaining.
- ROUTE-01 verifier status: passes automated checks (T-70-01 + T-70-02 + WR-02 Test D triple assertions green; bug literal `'/w/REF-001'` purged from test file; build exit 0). **Prod click-through awaiting human walk** before formal `passed` flip.

---
*Phase: 73-owned-redirect-route-fix*
*Completed: 2026-05-30*

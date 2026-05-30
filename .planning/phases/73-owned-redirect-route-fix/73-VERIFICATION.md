---
phase: 73-owned-redirect-route-fix
verified: 2026-05-30T18:18:00Z
status: human_needed
score: 10/11 must-haves verified (10 code-verified; 1 (D-09 prod walk) human_needed)
overrides_applied: 0
requirements_status:
  ROUTE-01: code_verified_prod_pending
must_haves_status:
  D-01: verified
  D-02: verified
  D-03: verified
  D-04: verified
  D-05: verified
  D-06_imports_preserved: verified
  D-07: verified
  D-08: verified
  D-09_build_and_vitest: verified
  D-09_prod_walk: human_needed
  D-10: verified
human_verification:
  - test: "Prod walk: search-pick owned watch lands on /w/[catalogId] detail page (no 404)"
    expected: "Open add-watch popup on prod; type a query that matches an owned watch; click the 'In collection' result; URL is /w/<uuid>; page renders the D-06 in-place owned view (hero present; Collection Fit verdict hidden per verdict_hidden_on_owned_watches; comment thread present)"
    why_human: "Local DB lacks meaningful catalog/owned data (per CONTEXT.md D-10 + memory feedback_mobile_ui_verify_on_prod); the only authoritative click-through is on prod after deploy"
---

# Phase 73: Owned-Redirect Route Fix — Verification Report

**Phase Goal:** Users can navigate to an owned watch from the search results and arrive at a working watch detail page

**Verified:** 2026-05-30T18:18:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Statement

ROUTE-01 — clicking an "In collection" search result in the add-watch combobox must land on a working `/w/[ref]` watch detail page (not a 404). The defect: `handleSearchPick` pushed `result.reference` (model number) into a UUID-only route. The fix: push `result.catalogId` (UUID, always present) instead, AND collapse both owned branches into a single early-return because the catalogId-based push eliminates the null-reference edge case from the search-pick path.

## Must-Haves Check

| # | Truth (D-NN) | Status | Evidence |
|---|--------------|--------|----------|
| 1 | **D-01** — `handleSearchPick` owned branch pushes `router.push('/w/${catalogId}')` (UUID, not reference) | VERIFIED | `src/components/watch/AddWatchFlow.tsx:161-164` body is `if (result.viewerState === 'owned') { router.push(\`/w/${encodeURIComponent(result.catalogId)}\`); return }` — code matches D-01 verbatim |
| 2 | **D-04** — both owned branches (with-ref + null-ref) collapsed into a single early-return push; D-06 owned confirm-with-banner branch dead-removed from search-pick path | VERIFIED | `handleSearchPick` body (lines 150-221) shows exactly ONE `viewerState === 'owned'` branch (vs prior two); no `setConfirmStatus('owned')` / `setState({ kind: 'confirming', ... })` / `resolveDupeContext` calls inside the owned branch. Verified via `grep -n "setConfirmStatus('owned')" AddWatchFlow.tsx` returns 0 occurrences (was 1 in the collapsed null-ref branch); D-21 lines 248-249 in handleStructuredSubmit assign `nextStatus = 'owned'` via setConfirmStatus(nextStatus) which is the correct surviving path per D-04 |
| 3 | **Phase Goal** — User can click "In collection" → arrive at working watch detail page for any owned watch (regardless of reference null/non-null) | CODE-VERIFIED (prod walk pending) | T-70-01 + T-70-02 both green; both push targets are catalogId (UUID), guaranteed to pass `/w/[ref]/page.tsx:151` UUID regex; receiver Branch 2 (page.tsx:439) already wired per Phase 59 |
| 4 | Owned-pick never enters `confirming` state (no ConfirmStep, no DupeBanner-owned mount on either Pick owned or Pick owned no-ref) | VERIFIED | T-70-01 + T-70-02 both assert `expect(screen.queryByTestId('confirm-step')).not.toBeInTheDocument()` AND `expect(screen.queryByTestId('dupe-banner-owned')).not.toBeInTheDocument()` — disappearance assertions per memory `feedback_test_assert_disappearance_too`; both tests green |
| 5 | **D-09** — `npm run build` exits 0 AND vitest run AddWatchFlow.test.tsx is green; prod click-through bundles with Phase 74 deploy (human_needed) | VERIFIED (code) / human_needed (prod) | Verifier ran `npm run build` → `✓ Compiled successfully in 5.7s` (exit 0); verifier ran `npx vitest run src/components/watch/AddWatchFlow.test.tsx` → `Test Files 1 passed (1); Tests 27 passed (27)`. Prod walk pending (see Human Verification Needed below) |
| 6 | Wishlist branch (lines 165-199 post-fix), structured-submit branch (handleStructuredSubmit), URL-backup branch (handleUrlBackup) UNTOUCHED — `resolveDupeContext` + `toast.error` imports remain consumed | VERIFIED | `resolveDupeContext` call sites: lines 168 (wishlist), 235 (handleStructuredSubmit), 299 (handleUrlBackup cache path), 351 (handleUrlBackup fresh-extract path) — 4 remaining consumers as predicted by RESEARCH Pitfall 1; `toast` imported at line 5 from sonner; `findViewerWatchByCatalogIdAction` imported at line 18 (consumed by `resolveDupeContext` wrapper at line 793) |
| 7 | **D-02** — `src/app/w/[ref]/page.tsx` UUID-only guard at line 151 is NOT loosened; Phase 59 D-04 invariant preserved | VERIFIED | `src/app/w/[ref]/page.tsx:151` reads `if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) { notFound() }` — UUID-only regex intact, byte-for-byte unchanged from Phase 59 D-04 |
| 8 | **D-03** — no client-side `findViewerWatchByCatalogIdAction` round-trip added to handleSearchPick owned branch; Branch 2's server-side lookup at page.tsx:439 resolves ownership | VERIFIED | Owned branch body at lines 161-164 contains ONLY the `router.push` + `return` — no `await resolveDupeContext` and no `findViewerWatchByCatalogIdAction` invocation. The wrapper helper still exists at line 790 but is unused by the owned search-pick path |
| 9 | **D-05** — `encodeURIComponent` preserved on the catalogId push for defense-in-depth | VERIFIED | Line 162: `router.push(\`/w/${encodeURIComponent(result.catalogId)}\`)` — encode call present |
| 10 | **D-07** — no `tests/static/` guard added; unit-test assertion (T-70-01 + T-70-02 push-target + disappearance) deterministically catches reference-based-push regression | VERIFIED | No new files under `tests/static/`; T-70-01 + T-70-02 assert push targets are catalogId AND assert ConfirmStep + DupeBanner stay unmounted; the bug-literal `/w/REF-001` is purged from the test file (`grep -cF "'/w/REF-001'" AddWatchFlow.test.tsx` = 0) |
| 11 | **D-08** — no E2E test added; project has no Playwright/Cypress harness | VERIFIED | No `playwright.config.*` or `cypress.config.*` files added; phase commits touch only AddWatchFlow.tsx + AddWatchFlow.test.tsx |
| 12 | **D-10** — no dev-server walkthrough required; prod walk after deploy is authoritative manual check | VERIFIED | Plan + SUMMARY both defer to prod walk; verifier observes no local-dev UAT artifact was generated for this phase |

**Score:** 10/11 truths code-verified; 1 (D-09 prod walk) is human_needed — overall status `human_needed`.

## Requirements Traceability

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ROUTE-01 | 73-01-PLAN.md | User can click an "In collection" search result and be redirected to `/w/[ref]` which renders successfully — no 404. Works for any owned watch regardless of whether its catalog row backs it (consistent with v7.0 Phase 59 unified-route contract) | code_verified_prod_pending | Code-side: `AddWatchFlow.tsx:162` pushes catalogId UUID; tests T-70-01 (`/w/cat-owned`) + T-70-02 (`/w/cat-owned-noref`) + WR-02 Test D (`/w/cat-owned`) all green; UUID passes `/w/[ref]/page.tsx:151` regex; Branch 2 at page.tsx:439 finds viewer's row → in-place D-06 owned render at page.tsx:472. Prod click-through awaiting human walk. |

**Orphan check:** REQUIREMENTS.md §Routing line 22 maps ROUTE-01 to Phase 73 and to status `Complete`. Phase 73 PLAN frontmatter declares `requirements: [ROUTE-01]`. No orphaned requirements (no IDs in REQUIREMENTS.md mapped to Phase 73 that the plan failed to address).

## Decision Coverage (D-01..D-10)

| Decision | Honored? | Evidence |
|----------|----------|----------|
| D-01 — push catalogId (UUID) instead of reference (model number) | YES | `AddWatchFlow.tsx:162` |
| D-02 — `/w/[ref]/page.tsx` UUID guard NOT loosened | YES | `src/app/w/[ref]/page.tsx:151` byte-for-byte unchanged |
| D-03 — no client-side findViewerWatchByCatalogIdAction round-trip added | YES | Owned branch is 4 lines: if/push/return/} — no resolver call |
| D-04 — both owned branches collapsed to single early-return push | YES | Single `if (result.viewerState === 'owned')` block; no null-ref confirm-with-banner setup |
| D-05 — encodeURIComponent kept on catalogId push for defense-in-depth | YES | `encodeURIComponent(result.catalogId)` present at line 162 |
| D-06 — test updates (T-70-01 + T-70-02 + WR-02 Test D + WR-02 Test A delete + WR-01 Test B pivot) | YES | All 5 edits landed; vitest 27/27 green; bug-literal `/w/REF-001` purged from test file |
| D-07 — no tests/static/ guard added | YES | No new tests/static/ file added |
| D-08 — no E2E test added | YES | No playwright/cypress harness added |
| D-09 step 1+2 — npm run build exit 0 + vitest green | YES (verifier-confirmed) | Build: `✓ Compiled successfully in 5.7s`; vitest: 27/27 green |
| D-09 step 3 — prod click-through bundled with Phase 74 deploy | NOT YET | Phase 74 not started; deploy bundle pending — see Human Verification Needed |
| D-10 — no dev-server walkthrough required | YES | None performed; not needed per local-DB-empty rationale |

## Code Evidence

### Production edit landed (`AddWatchFlow.tsx`)

```
$ grep -n -v '^\s*//' src/components/watch/AddWatchFlow.tsx | grep -v '^\s*\*' \
    | grep -cF "router.push(\`/w/\${encodeURIComponent(result.reference)}\`)"
0   ← bug literal gone from non-comment lines

$ grep -n -v '^\s*//' src/components/watch/AddWatchFlow.tsx | grep -v '^\s*\*' \
    | grep -cF "router.push(\`/w/\${encodeURIComponent(result.catalogId)}\`)"
1   ← fix literal present exactly once (the search-pick owned branch)

$ grep -n "setConfirmStatus('owned')" src/components/watch/AddWatchFlow.tsx
(no output — the dead null-ref D-06 confirm-with-banner setConfirmStatus call is removed
 from the search-pick path; the surviving owned setConfirmStatus pathway in handleStructuredSubmit
 uses computed nextStatus via setConfirmStatus(nextStatus) at line 249, not the literal)
```

Source snippet (`src/components/watch/AddWatchFlow.tsx:149-164`):

```tsx
// D-05 / D-06 / DUPE-01 / DUPE-03 entry — search-pick branch.
const handleSearchPick = useCallback(
  async (result: SearchCatalogWatchResult) => {
    // Phase 73 ROUTE-01 (D-01 + D-04) — both owned branches collapse to a
    // single early-return redirect. `result.catalogId` is always a UUID and
    // always present per the SearchCatalogWatchResult contract, so the
    // `/w/[ref]` UUID guard at `src/app/w/[ref]/page.tsx:151` passes →
    // Branch 2 finds the viewer's row via `findViewerWatchByCatalogId` →
    // in-place D-06 owned render at page.tsx:472 (no client-side
    // round-trip needed; D-03 rejects the round-trip). D-05 preserves
    // encodeURIComponent for defense-in-depth even though catalogId is a
    // plain UUID with no reserved chars.
    if (result.viewerState === 'owned') {
      router.push(`/w/${encodeURIComponent(result.catalogId)}`)
      return
    }
```

### Receiver route untouched (`src/app/w/[ref]/page.tsx:151`)

```ts
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
  notFound()
}
```

Phase 59 D-04 invariant preserved (no edit).

### Imports preserved (`AddWatchFlow.tsx`)

```
line 5:  import { toast } from 'sonner'
line 18: findViewerWatchByCatalogIdAction,   (still imported)
line 24: import type { FlowState, DupeContext } from './flowTypes'   (still imported)
```

Call sites confirm continued use:
- `resolveDupeContext` invoked 4× (lines 168, 235, 299, 351)
- `findViewerWatchByCatalogIdAction` invoked via `resolveDupeContext` wrapper at line 793

### Test file updates (`AddWatchFlow.test.tsx`)

```
$ grep -cF "'/w/REF-001'" src/components/watch/AddWatchFlow.test.tsx
0   ← bug-literal push target purged

$ grep -cF "'/w/cat-owned'" src/components/watch/AddWatchFlow.test.tsx
2   ← T-70-01 + WR-02 Test D

$ grep -cF "'/w/cat-owned-noref'" src/components/watch/AddWatchFlow.test.tsx
1   ← T-70-02

$ grep -cF "WR-02 — search-pick owned (D-06 null-ref fallthrough)" \
    src/components/watch/AddWatchFlow.test.tsx
0   ← WR-02 Test A deleted (replaced with explanatory comment block at lines 837-841)
```

Disappearance assertion check (per memory `feedback_test_assert_disappearance_too`):

```tsx
// T-70-01 (lines 334-342)
it('T-70-01 — owned-pick with non-null reference → router.push("/w/cat-owned") (catalogId); no confirm screen, no DupeBanner', async () => {
  renderFlow()
  fireEvent.click(screen.getByText('Pick owned'))
  await waitFor(() => {
    expect(pushSpy).toHaveBeenCalledWith('/w/cat-owned')
  })
  expect(screen.queryByTestId('confirm-step')).not.toBeInTheDocument()
  expect(screen.queryByTestId('dupe-banner-owned')).not.toBeInTheDocument()
})
```

Both T-70-01 and T-70-02 carry the triple assertion (push target appearance + ConfirmStep absence + DupeBanner absence) — the regression guard intended by the disappearance memory.

### Vitest result (verifier-run)

```
✓ |unit| src/components/watch/AddWatchFlow.test.tsx (27 tests) 305ms

 Test Files  1 passed (1)
      Tests  27 passed (27)
   Start at  11:13:52
   Duration  1.30s
```

### Build gate (verifier-run)

```
$ npm run build
... (full compile pipeline) ...
✓ Compiled successfully in 5.7s
Exit: 0
```

No new errors attributable to AddWatchFlow.tsx or AddWatchFlow.test.tsx.

### Commits verified

```
cbd4250b fix(73): collapse handleSearchPick owned branches to single catalogId redirect (ROUTE-01)
9c323925 test(73): update T-70-01/T-70-02 + WR-02 Test D push targets to catalogId; delete WR-02 Test A; pivot WR-01 Test B to structured-submit (ROUTE-01)
19942c1c docs(73): complete owned-redirect-route-fix plan (ROUTE-01)
```

Both code-touching commits claimed in the SUMMARY exist in `git log`.

## Anti-Patterns Scan

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `AddWatchFlow.tsx` (modified) | No `TBD` / `FIXME` / `XXX` markers introduced in this phase's hunks | clean | Branch body is 4 lines (if/push/return/}); pre-existing comments around line 150 are descriptive, not debt-marker |
| `AddWatchFlow.test.tsx` (modified) | No new TBD/FIXME/XXX markers; the comment-block at lines 837-841 replacing WR-02 Test A explains the deletion rationale | clean | Explanatory replacement, not stub |
| `AddWatchFlow.tsx` (modified) | No empty handlers, no `return null`, no `console.log`-only branches | clean | Owned branch does real work (router.push + return) |
| `AddWatchFlow.tsx` (modified) | No hardcoded empty data introduced | clean | — |

No blocker / warning anti-patterns introduced by Phase 73.

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `AddWatchFlow.tsx :handleSearchPick` owned branch | `result.catalogId` | `SearchCatalogWatchResult` from SearchEntry `onPick` (server-issued UUID per Phase 70 D-08 cache projection) | YES — catalogId is always present per type contract (line 36 of searchTypes.ts: `catalogId: string`) | FLOWING |
| `/w/[ref]/page.tsx` Branch 2 | viewer's `watches` row resolved by `findViewerWatchByCatalogId(user.id, ref)` | Server-side DAL (UNTOUCHED this phase) | YES — Phase 59-verified pathway | FLOWING |

Data flow end-to-end: client `result.catalogId` (UUID) → URL slug → route UUID guard pass → Branch 2 server lookup → D-06 in-place owned render. All hops verified.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Vitest AddWatchFlow suite green | `npx vitest run src/components/watch/AddWatchFlow.test.tsx` | 27/27 passing in 1.30s | PASS |
| Build gate (milestone authoritative gate) | `npm run build` | `✓ Compiled successfully in 5.7s`, exit 0 | PASS |
| Bug literal absent (production code) | `grep -cF "router.push(\`/w/\${encodeURIComponent(result.reference)}\`)" AddWatchFlow.tsx` (non-comment lines) | 0 | PASS |
| Fix literal present exactly once (production code) | `grep -cF "router.push(\`/w/\${encodeURIComponent(result.catalogId)}\`)" AddWatchFlow.tsx` (non-comment lines) | 1 | PASS |
| Bug-literal push target purged (tests) | `grep -cF "'/w/REF-001'" AddWatchFlow.test.tsx` | 0 | PASS |
| Receiver route UUID guard intact | `grep -n 'notFound' src/app/w/[ref]/page.tsx | head -3` (line 152) | regex guard at line 151 unchanged | PASS |

## Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| (none) | — | Phase has no declared probes; conventional `scripts/*/tests/probe-*.sh` not used by this codebase (no Drizzle migration / CLI tool in scope) | SKIPPED — no probes in scope |

## Human Verification Needed

### 1. Prod walk: owned-watch click from search → /w/[uuid] renders

**Test:**
1. Deploy this phase to prod (bundled with Phase 74 if same session per CONTEXT.md D-09 step 3; otherwise push standalone).
2. On prod, open the add-watch popup (`/watch/new` or floating add-flow trigger).
3. Type a query that matches a watch you OWN on prod (the local DB lacks meaningful catalog/owned data — must be prod).
4. In the search dropdown, find the result tagged "In collection".
5. Click that result row.

**Expected:**
- Browser URL becomes `/w/<some-uuid>` (catalog UUID, not a model number).
- Page renders the watch detail D-06 in-place owned view:
  - Hero present (cover image / placeholder)
  - Collection Fit verdict HIDDEN (per `verdict_hidden_on_owned_watches` memory — same-user-owned view suppresses the verdict block)
  - Comment thread present
- NO 404. NO blank page.

**Out of scope for this UAT (do NOT include):**
- soft-nav `#419` checks (resolved infrastructure per memory `feedback_ppr_cache_fill_no_longer_call_out`)
- cache-fill timing checks (same)

**Why human:**
- Local DB lacks meaningful catalog/owned data per CONTEXT.md D-10 — there are no owned rows wired to real catalog UUIDs locally.
- Per memory `feedback_mobile_ui_verify_on_prod`, UI / user-flow behavior verifies on prod, not in jsdom.
- The unit tests (T-70-01 + T-70-02 + WR-02 Test D) deterministically prove the push target is the catalogId UUID; they CANNOT prove the receiver page renders without a 404 on a real prod row (that requires the actual DAL + auth context).

**Bundling preference:** If Phase 74 ships in the same session, include this phase's commits in Phase 74's prod deploy for a single push + single UAT walk. Otherwise push standalone.

## Status: human_needed

**Reason:** Implementation is complete at the code level. The 1-line production fix (slug source `reference` → `catalogId`) plus 5 coordinated test updates are all verified directly:

- Production edit landed (grep-confirmed both bug-literal absence and fix-literal presence)
- 27/27 vitest tests green (verifier-run)
- `npm run build` exits 0 (verifier-run — authoritative milestone gate per `project_baseline_not_green_build_is_gate`)
- All 10 LOCKED decisions (D-01..D-10) honored verbatim
- Receiver route `/w/[ref]/page.tsx:151` UUID guard byte-for-byte unchanged (D-02 preserved)
- No new attack surface; threat model dispositioned `mitigate (pre-existing controls)` or `accept (pre-existing posture)` for all 3 STRIDE entries
- Disappearance assertions added in T-70-01 + T-70-02 (per `feedback_test_assert_disappearance_too`) — guards against regression that reintroduces the confirming-state path on owned picks
- Imports preserved (resolveDupeContext, toast, findViewerWatchByCatalogIdAction all still consumed by 4 other branches — no dead-import regression)

**The remaining gate is operator prod click-through** per CONTEXT.md D-09 step 3 + D-10 + memory `feedback_mobile_ui_verify_on_prod`. The verifier is NOT auto-flipping ROUTE-01 to `passed` without that confirmation. Bundle with Phase 74's deploy if same session per CONTEXT.md D-09 step 3.

---

*Verified: 2026-05-30T18:18:00Z*
*Verifier: Claude (gsd-verifier)*

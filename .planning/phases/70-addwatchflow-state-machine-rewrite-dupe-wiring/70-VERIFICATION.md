---
phase: 70-addwatchflow-state-machine-rewrite-dupe-wiring
verified: 2026-05-29T22:27:50Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/6
  gaps_closed:
    - "Phase 70 commits the watch with correct catalog-derived metadata (movement) and does not silently discard user-provided photos (CR-01 + CR-02 fully closed by plans 70-06 + 70-07)"
    - "DupeBanner actually prevents silent duplicates when it appears — ConfirmStep primary now gated on `state.pending || state.dupeContext != null` (WR-01 closed by plan 70-08)"
    - "DUPE-03 commit path is robust against transient resolveDupeContext failures — handleSearchPick surfaces toast.error and stays on search-idle for known-dupe-but-null-resolver cases (WR-02 closed by plan 70-08)"
  gaps_remaining: []
  regressions: []
  note: "Initial verification at 2026-05-29T07:30:00Z reported gaps_found against pre-fix code; plans 70-06/07/08 closed all 4 named defects (CR-01, CR-02, WR-01, WR-02) before this re-verification. Independent grep at re-verify time confirms all fixes are in current shipped code."
deferred: []
human_verification:
  - test: "DUPE-01 owned search-pick → /w/[ref] redirect (mobile + desktop)"
    expected: "Typing a watch in the SearchEntry combobox, clicking a result whose viewerState is 'owned', lands on /w/[ref] (NOT the confirm screen). No spinner flicker or extra paint."
    why_human: "Visual / interaction quality + Vercel deploy verification — per project memory feedback_mobile_ui_verify_on_prod the user verifies mobile/visual on prod, not locally (local e2e skips empty test DB)."
  - test: "DUPE-02 'Add another copy' on owned context (structured-input or URL-backup path)"
    expected: "Submitting structured input for an owned watch → DupeBanner-owned mounts above ConfirmStep with 'View existing' + 'Add another copy'. Clicking 'Add another copy' unmounts the banner and ConfirmStep stays mounted; clicking ConfirmStep primary creates a SECOND watches row bound to the same catalog row. Verify via /u/[user]/collection that two rows exist for the same catalog ref."
    why_human: "Requires real catalog row + real addWatch DB write; structural test only verifies banner mount + dupeContext clear, not the second-row outcome."
  - test: "DUPE-03 wishlist search-pick → Move to Collection (UPDATE not INSERT)"
    expected: "Picking a watch with viewerState='wishlist' → DupeBanner-wishlist mounts; clicking 'Move to Collection' fires moveWishlistToCollection; after success the watch appears in /u/[user]/collection AND DISAPPEARS from /u/[user]/wishlist (single row, status flipped — NOT two rows). Activity feed shows 'watch_added' entry; cross-user overlap notifications fire."
    why_human: "Requires real DB UPDATE + activity log + overlap notification fan-out; unit tests mock all of these."
  - test: "CLNP-06 'Skip search — enter manually' in-flow transition preserves URL"
    expected: "On /watch/new (search-idle), clicking the 'Skip search — enter manually' link advances to WatchForm without changing the browser URL away from /watch/new (NO ?manual=1 appended). Back button goes to the prior page, not search-idle."
    why_human: "URL semantic + back-stack behavior best verified in a real browser."
  - test: "?manual=1 deep-link priority + ?returnTo= round-trip"
    expected: "Navigating to /watch/new?manual=1&returnTo=/u/tester/wishlist lands directly in manual-entry (no SearchEntry), and after a wishlist commit the user is redirected to /u/tester/wishlist (the returnTo destination)."
    why_human: "Requires real navigation lifecycle; unit test verifies initialState precedence + grep verifies initialReturnTo threading, but the URL-round-trip is observable only at runtime."
  - test: "Three-layer reset hygiene across user-switch + Activity-hide"
    expected: "Sign in as user-a, type a search query (cache populated), navigate to Activity tab, navigate back to /watch/new — search-idle renders empty (Activity-hide reset). Then sign out, sign in as user-b — typing the same query produces fresh server-fetched results (user-b's viewerState NOT user-a's cached one)."
    why_human: "Requires real auth + cache module-state observation; AddWatchFlow.test.tsx 'Phase 69 cache hygiene integration' covers the unit assertion but the full prod flow needs a browser session."
  - test: "D-17 photos-pending gate on wishlist commit"
    expected: "Manual-entry with status=wishlist → after WatchForm commit, lands directly on /u/[user]/wishlist (NO WatchPhotoStep). Manual-entry with status=owned → after commit, sees WatchPhotoStep then lands on /u/[user]/collection."
    why_human: "User-visible D-17 evolution from v7.0 (which always showed photos step) — flagged in CONTEXT.md as the one v7.0→v8.0 UX evolution worth UAT confirmation."
  - test: "Mobile-visual quality of DupeBanner action row"
    expected: "On a phone-width viewport, DupeBanner's action row stacks vertically (flex-col); on desktop it lays out side-by-side (sm:flex-row). Touch targets are ≥44px tall (min-h-[44px]). Headline is font-semibold not font-medium (no-raw-palette guardrail)."
    why_human: "Visual + responsive verification per feedback_mobile_ui_verify_on_prod; bundle with Phase 71 push for a single prod UAT session."
---

# Phase 70: AddWatchFlow State Machine Rewrite + DUPE Wiring — Verification Report

**Phase Goal (ROADMAP):** AddWatchFlow is rewritten with a new FlowState discriminated union that wires all four flow branches (search-first, structured-input, URL-backup, manual-entry), handles owned/wishlist DUPE redirects, preserves `?manual=1` priority and `?returnTo=` round-trip, and extends the Phase 29 three-layer reset to new caches.

**Verified:** 2026-05-29T22:27:50Z
**Status:** passed
**Re-verification:** Yes — initial verification at 2026-05-29T07:30:00Z reported `gaps_found` (4/6 score, 3 gaps covering 4 defects: CR-01, CR-02, WR-01, WR-02). Plans 70-06, 70-07, and 70-08 shipped fixes for all 4 defects. Independent grep at re-verify time confirms all fixes are present in current shipped code.

## Re-Verification: Gap Closure Evidence

### Gap #1 — CR-01 + CR-02 (data-correctness defects)

**CR-02: movement no longer hardcoded to `'auto'`**

Grep on current `src/components/watch/AddWatchFlow.tsx`:
- `movement: captured.extracted.movement ?? 'auto'` → **0 matches** (buggy default gone; commit `7060799c`)
- `if (!captured.catalogId && captured.extracted.movement)` → **1 match at line 468** (post-fix gate; catalogId path omits movement entirely; URL-backup-without-catalog forwards extracted.movement only when present; no synthetic 'auto' fallback ever)
- `imageUrl: captured` → **0 matches** (dead payload field stripped; commit `7060799c`)

**CR-02: CLOSED.** The data-correctness regression — every search-pick / URL-cache-hit commit persisting `movement: 'auto'` for non-auto watches — is resolved. When catalogId is set, movement is omitted from the payload and the catalog row supplies the truth via downstream taste enrichment. When no catalogId is present (URL-backup transient failure), extracted.movement is forwarded only if provided.

**CR-01: StructuredEntryPanel photoBlob no longer write-only**

Grep on current `src/components/watch/StructuredEntryPanel.tsx`:
- `[, setPhotoBlob]` write-only pattern → **0 live-code matches** (only match is the JSDoc comment at line 115 explaining the historical state; commit `0db88d1c`)
- `[photoBlob, setPhotoBlob]` readable state → **1 match at line 120** (Blob is read and forwarded as the optional third arg of onSubmitStructured)

Grep on current `src/components/watch/AddWatchFlow.tsx`:
- `uploadCatalogSourcePhoto` → **4 matches** (upload pipeline wired; commits `53b22a34` + `7060799c`)
- `payload.photoSourcePath` → **1 match at line 490** (path forwarded into addWatch payload)
- `photoBlob` → **15 matches** (handler signature + FlowState setState × 5 + handleConfirmPrimary check + JSDoc references)

Grep on current `src/components/watch/flowTypes.ts`:
- `photoBlob` → **5 matches** (confirming variant field + JSDoc references; commit `53b22a34`)

**CR-01: CLOSED.** The EXIF-cleaned Blob captured by CatalogPhotoUploader in StructuredEntryPanel now flows via the widened 3-arg `onSubmitStructured(result, catalogId, photoBlob?)` contract through SearchEntry to AddWatchFlow, where handleStructuredSubmit uploads via uploadCatalogSourcePhoto before addWatch and threads the result as photoSourcePath in the addWatch payload. The "non-functional photo affordance" described in the original gaps is resolved.

### Gap #2 — WR-01 (ConfirmStep active while DupeBanner mounted)

Grep on current `src/components/watch/AddWatchFlow.tsx`:
- `state.pending || state.dupeContext != null` → **1 match at line 722** (commit `84f5c496`)

**WR-01: CLOSED.** The ConfirmStep primary CTA is now gated on `state.pending || state.dupeContext != null` in the `confirming` render branch. When DupeBanner is mounted (dupeContext set), the ConfirmStep primary is disabled — the user is forced through one of the banner's explicit affordances. Clicking "Add another copy" clears dupeContext → primary re-enables. 3 regression tests assert: (1) wishlist-context disables CTA, (2) owned-context disables CTA and addWatch is not called on click, (3) "Add another copy" releases the gate and subsequent ConfirmStep click calls addWatch. DupeBanner's own `pending` prop remains unchanged (banner buttons should only disable during the moveWishlistToCollection async await, not just because the banner is mounted).

### Gap #3 — WR-02 (silent no-banner advance on resolver failure for known dupes)

Grep on current `src/components/watch/AddWatchFlow.tsx`:
- `"Couldn't check your collection — try again"` → **2 matches at lines 167 and 202** (commit `eb4da1f3`)
- `toast.error` count → **6** (was 2 pre-gap; now includes the 2 WR-02 guards + 2 pre-existing payload-failure paths + unchanged)

**WR-02: CLOSED** for the handleSearchPick owned (D-06 null-ref fallthrough) and wishlist branches. When the search projection pre-signals `viewerState === 'owned' | 'wishlist'` and resolveDupeContext returns null (transient `findViewerWatchByCatalogIdAction` failure), the orchestrator now surfaces toast.error and stays on search-idle via early return. The structured-input and URL-backup branches intentionally retain silent fallthrough — those callers have no pre-known viewerState; null from the resolver genuinely means "no dupe found OR resolver failed; either way, proceed to confirm without banner." 4 regression tests assert: (1) owned-branch toast + search-idle, (2) wishlist-branch toast + search-idle, (3) null-viewerState branch silently proceeds (boundary inverse proving scope), (4) owned-with-ref fast-path bypasses resolver entirely (T-70-01 extended).

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + Phase Must-Haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC#1a — Owned search-pick redirects to `/w/[ref]` (no confirm screen) | VERIFIED | `AddWatchFlow.tsx:159-162` — `router.push('/w/' + encodeURIComponent(result.reference))` when `result.viewerState === 'owned' && result.reference`. T-70-01 green; extended in gap plan 08 to assert resolveDupeContext is NOT called on the fast path. |
| 2 | SC#1b — Wishlist search-pick → confirm screen with DupeBanner + Move to Collection UPDATE (not INSERT) | VERIFIED | `AddWatchFlow.tsx:185-206` constructs `confirming` with `dupeContext.existingStatus='wishlist'`; render branch lines mount DupeBanner above ConfirmStep with `onMoveToCollection={handleMoveToCollection}`. `handleMoveToCollection` calls `moveWishlistToCollection(existingWatchId)` which is a true UPDATE. WR-02 toast.error guard fires on resolver failure (no silent banner-drop). T-70-04 + moveWishlistToCollection.test.ts 8/8 green. |
| 3 | SC#2 — "Add another copy" affordance bypasses owned-redirect for legitimate duplicates | VERIFIED | `AddWatchFlow.tsx handleAddAnotherCopy` clears dupeContext; DupeBanner unmounts; ConfirmStep primary CTA re-enables (WR-01 gate releases). T-70-03 green; WR-01 regression test verifies gate-release → addWatch fires correctly. Silent-duplicate hole (user ignoring banner → clicking ConfirmStep primary) is now closed: ConfirmStep primary is disabled when dupeContext is set. |
| 4 | SC#3 — `?manual=1` deep-link bypasses search and lands in manual-entry | VERIFIED | `AddWatchFlow.tsx:92-98` initialState ternary: `form-prefill > manual-entry > search-idle`; `initialManual === true` → `{kind: 'manual-entry', partial: null}`. T-70-08a/b/c green. |
| 5 | SC#4 — `?returnTo=` URL parameter round-trips through every commit branch | VERIFIED | `handleConfirmPrimary` and `handleMoveToCollection` both read `initialReturnTo ?? defaultDestinationForStatus(...)`. `handleWatchCreated` routes to `dest` set by WatchForm using initialReturnTo. `manualAction` preserves returnTo through the `?manual=1` re-push. Grep confirms 2 direct match sites + transitive WatchForm propagation. |
| 6 | SC#5 — Three-layer reset extended to new caches (Phase 29 → useCatalogSearchCache + useStructuredExtractCache) | VERIFIED | Phase 69 CLNP-07 shipped the shared `moduleUserId` mismatch reset on all 4 caches. AddWatchFlow.test.tsx 'Phase 69 — cache hygiene integration (CLNP-07)' describe block PRESERVED. useLayoutEffect cleanup implements the 3 skip cases per D-22 without clobbering deep-link state. |
| 7 | Phase-level correctness — `addWatch` payload reflects catalog truth (movement not corrupted) AND captured user photos persist | VERIFIED | CR-02 CLOSED: movement omitted when catalogId set (catalog row supplies truth via D-10 server-override + taste enrichment); extracted.movement forwarded only when no catalogId and actually present; no synthetic 'auto' fallback. imageUrl dead field stripped (Phase 60 column drop). CR-01 CLOSED: photoBlob flows via widened 3-arg onSubmitStructured → FlowState.confirming.photoBlob → uploadCatalogSourcePhoto → payload.photoSourcePath. 8 regression tests cover both gaps. Build green; 80/80 targeted tests green (post gap-closure suite). |
| 8 | Hard-cutover — AddWatchFlow.tsx no longer imports legacy verdict-era files | VERIFIED | Confirmed at initial verification; Phase 71 (status: passed, 4/4) has since deleted the files themselves and added static guards. No regression. |

**Score:** 6/6 truths verified (was 4/6 at 2026-05-29T07:30:00Z)

### Deferred Items

All 3 items from the initial verification were addressed by Phase 71, which shipped 2026-05-29 and has VERIFICATION status `passed` (4/4 score, verified at 2026-05-29T12:41:00Z).

| # | Item | Addressed In | Delivery Evidence |
|---|------|--------------|-------------------|
| 1 | Legacy verdict file deletions (PasteSection, VerdictStep, WishlistRationalePanel) + static guards | Phase 71 | 71-02-SUMMARY.md: all 3 component files + 3 test files deleted (git commit). 71-01-SUMMARY.md: `tests/static/AddWatchFlow.no-verdict-step.test.ts` + `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` created with `@vitest-environment node`. 71-VERIFICATION.md status: passed, 4/4. |
| 2 | RecentlyEvaluatedRail disposition + RailEntry/PendingTarget cleanup | Phase 71 | 71-02-SUMMARY.md: RecentlyEvaluatedRail.tsx + RecentlyEvaluatedRail.test.tsx deleted (D-01 binding: deleted outright). flowTypes.ts pruned from 93 → 64 lines (RailEntry/PendingTarget swept). AddWatchFlow.tsx 10 rail/setRail/railRef/RailEntry sites swept. |
| 3 | FlowState literal enumeration matching REQUIREMENTS.md CLNP-05 exactly | Phase 71 CLNP-05 audit | 71-VERIFICATION.md Truth #4: "Zero matches for verdict-ready, wishlist-rationale-open, submitting-wishlist in flowTypes.ts. ROADMAP SC #4 search-results/structured-input/extracting-structured reconciled via Phase 70 D-01 + CLNP-05 as authoritative — SearchEntry owns sub-states internally. Phase 71 asserts against the D-01 final 7-variant shape." REQUIREMENTS.md CLNP-05 marked complete via reasoned deviation. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/watch/AddWatchFlow.tsx` | Rewritten orchestrator; WR-01 pending-gate; WR-02 toast.error; CR-01/02 payload fixes; D-01..D-22 | VERIFIED | All 4 gap fixes confirmed via grep: movement gate at line 468, imageUrl stripped (0 matches), pending gate at line 722, toast.error at lines 167+202, uploadCatalogSourcePhoto at 4 sites, photoSourcePath at line 490. Build green; 28/28 AddWatchFlow tests green (13 original + 7 gap-07 + 8 gap-08 incl. sonner mock). |
| `src/components/watch/flowTypes.ts` | D-01 FlowState union + DupeContext + 19-line D-02 JSDoc transition map + photoBlob on confirming variant | VERIFIED | photoBlob field on confirming variant at line 45 (gap plan 07). 5 photoBlob references in file. Phase 71 pruned from 93 → 64 lines (RailEntry/PendingTarget swept). flowTypes.test.ts 4/4 green. |
| `src/components/watch/StructuredEntryPanel.tsx` | 3-arg onSubmitStructured (result, catalogId, photoBlob?); readable [photoBlob, setPhotoBlob] | VERIFIED | `[photoBlob, setPhotoBlob]` at line 120 (readable, not write-only). Cache-hit + network-success emit pass `photoBlob ?? undefined` as third arg. 14/14 tests green (10 baseline + 4 gap-06). |
| `src/components/watch/SearchEntry.tsx` | 3-arg onSubmitStructured pass-through (identity-stable) | VERIFIED | Prop type widened to 3-arg; JSX pass-through `onSubmitStructured={onSubmitStructured}` unchanged (identity-stable). 20/20 tests green (19 baseline + 1 gap-06). |
| `src/components/watch/DupeBanner.tsx` | Pure-presenter sibling with owned/wishlist context branches + null-reference fallback | VERIFIED | 123 LOC. 6 verbatim copy strings. `font-semibold` headline. min-h-[44px] WCAG touch target. aria-live="polite". DupeBanner.test.tsx 6/6 green. |
| `src/app/actions/watches.ts moveWishlistToCollection` | UPDATE Server Action with auth + Zod + DAL + side-effects + cache invalidation | VERIFIED | `watches.ts:382-521`. Full chain: getCurrentUser; Zod; ownership; status whitelist; updateWatch; logActivity; overlap notifications; revalidatePath/Tag. moveWishlistToCollection.test.ts 8/8 green. |
| `src/app/actions/watches.ts findViewerWatchByCatalogIdAction` | Server Action wrapper re-deriving identity via getCurrentUser | VERIFIED | `watches.ts:740-772`. Re-derives identity; Zod UUID + statuses whitelist; ActionResult envelope. |
| `src/data/watches.ts findViewerWatchByCatalogId` | DAL widened to return `reference` via leftJoin watches_catalog | VERIFIED | `watches.ts:295-334`. Selects `reference: watchesCatalog.reference` + leftJoin. Return type `{id, status, reference}`. |
| `src/components/watch/AddWatchFlow.test.tsx` | Phase 69 four-cache test PRESERVED + 13 original + 7 gap-07 + 8 gap-08 = 28 tests; sonner mock infra | VERIFIED | 28/28 green. Sonner mock at file scope (`vi.mock('sonner', ...)`). Phase 69 CLNP-07 describe block preserved. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| AddWatchFlow.tsx | SearchEntry | mounted in search-idle branch | WIRED | viewerUserId, catalogBrands, onPick, onSubmitStructured (3-arg), onSwitchToUrl all threaded |
| AddWatchFlow.tsx | ConfirmStep | mounted in confirming branch | WIRED | All locked Phase 68 D-03 contract props threaded; `pending={state.pending \|\| state.dupeContext != null}` (WR-01 gate) |
| AddWatchFlow.tsx | DupeBanner | conditional render above ConfirmStep when state.dupeContext set | WIRED + ENFORCED | DupeBanner mounts; ConfirmStep primary is now disabled when dupeContext is set (WR-01 closed); onMoveToCollection conditional on wishlist context per D-11 |
| AddWatchFlow.tsx handleMoveToCollection | moveWishlistToCollection (Server Action) | line 459 | WIRED | `await moveWishlistToCollection(existingWatchId)`; success → router.push; pending state drives banner disable |
| AddWatchFlow.tsx handleSearchPick owned+wishlist | resolveDupeContext → toast.error + early return on null | lines 167, 202 | WIRED | WR-02 guard: known-dupe-but-null-resolver surfaces toast.error + stays on search-idle; structured/URL-backup retain silent fallthrough by design |
| AddWatchFlow.tsx resolveDupeContext | findViewerWatchByCatalogIdAction (Server Action) | lines 722-731 | WIRED | Re-derives identity via getCurrentUser; failure non-fatal for structured/URL-backup callers; fatal (toast.error) for handleSearchPick with pre-known viewerState |
| StructuredEntryPanel CatalogPhotoUploader | AddWatchFlow.handleStructuredSubmit | via 3-arg onSubmitStructured | WIRED | photoBlob flows StructuredEntryPanel → SearchEntry pass-through → AddWatchFlow; stored in FlowState.confirming.photoBlob |
| AddWatchFlow.handleConfirmPrimary | uploadCatalogSourcePhoto + addWatch | lines 487-490 | WIRED | photoBlob uploaded before addWatch; photoSourcePath threaded into payload; fire-and-forget on failure (mirrors WatchForm.tsx:222-249) |
| moveWishlistToCollection | watchDAL.updateWatch (UPDATE not INSERT) | watches.ts:452 | WIRED | Confirmed UPDATE semantics |
| All commit branches | initialReturnTo round-trip via defaultDestinationForStatus | lines 413, 466, 493-505, 516-521 | WIRED | D-04 honored in all post-commit handlers |
| New caches (useCatalogSearchCache + useStructuredExtractCache) | shared moduleUserId mismatch reset (CLNP-07) | Phase 69 module-scope pattern | WIRED | Cross-user reset preserved through Phase 69 retrofit; Phase 70 adds no new cache hooks |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| AddWatchFlow `<ConfirmStep>` | state.extracted, state.catalogId | searchResultToExtracted(SearchCatalogWatchResult) on pick path; ExtractedWatchData from /api/extract-watch on URL-backup; ExtractedWatchData from StructuredEntryPanel emit on structured path | YES (search path) — server-authoritative catalog row; (URL/structured) — real LLM extraction | FLOWING |
| AddWatchFlow `<DupeBanner>` | state.dupeContext | findViewerWatchByCatalogIdAction → DAL leftJoin watches_catalog | YES — server-authoritative; re-derives identity via getCurrentUser; reference JOINed from catalog row | FLOWING |
| AddWatchFlow addWatch payload | confirmStatus, movement, photoSourcePath, captured.extracted.* | ConfirmStep controlled fields + state.extracted + uploadCatalogSourcePhoto | FLOWING — movement gated on catalogId (no synthetic 'auto'); imageUrl stripped; photoSourcePath forwarded when Blob present. All fields correct. | FLOWING |
| StructuredEntryPanel CatalogPhotoUploader | photoBlob state | onPhotoReady callback → [photoBlob, setPhotoBlob] → forwarded via 3-arg onSubmitStructured | YES — Blob flows upward through SearchEntry pass-through to AddWatchFlow | FLOWING |
| moveWishlistToCollection updatedWatch | watchDAL.updateWatch return | real DB UPDATE | YES | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build gate | `npm run build` | `Compiled successfully` exit 0 (reported by all 3 gap plans: 70-06 6.3s, 70-07 12.9s, 70-08 7.8s) | PASS |
| AddWatchFlow tests post gap-closure | `npx vitest run AddWatchFlow.test.tsx` | 28/28 passed (13 original + 7 gap-07 + 8 gap-08) | PASS |
| Broader gap suite | `npx vitest run AddWatchFlow.test.tsx flowTypes.test.ts StructuredEntryPanel.test.tsx SearchEntry.test.tsx DupeBanner.test.tsx moveWishlistToCollection.test.ts` | 80/80 passed (plan 70-08 SUMMARY report) | PASS |
| CR-02 regression: movement gate present | `grep -n "if (!captured.catalogId && captured.extracted.movement)" AddWatchFlow.tsx` | 1 match at line 468 | PASS |
| CR-02 regression: buggy default absent | `grep "movement: captured.extracted.movement ?? 'auto'" AddWatchFlow.tsx \| wc -l` | 0 | PASS |
| CR-02 regression: imageUrl dead code absent | `grep "imageUrl: captured" AddWatchFlow.tsx \| wc -l` | 0 | PASS |
| CR-01 regression: photoBlob readable | `grep "[photoBlob, setPhotoBlob]" StructuredEntryPanel.tsx` | 1 match at line 120 | PASS |
| CR-01 regression: write-only pattern absent | `grep -E "\[, setPhotoBlob\]" StructuredEntryPanel.tsx \| wc -l` | 0 live-code matches (only JSDoc comment) | PASS |
| WR-01 regression: pending gate present | `grep "state.pending \|\| state.dupeContext != null" AddWatchFlow.tsx` | 1 match at line 722 | PASS |
| WR-02 regression: toast.error guards present | `grep "Couldn't check your collection" AddWatchFlow.tsx` | 2 matches (lines 167 + 202) | PASS |
| Hard-cutover (Phase 71 delivered) | VerdictStep.tsx, WishlistRationalePanel.tsx, PasteSection.tsx absent | All 3 deleted by Phase 71 Plan 02; static guards added by Phase 71 Plan 01; Phase 71 VERIFIED (4/4) | PASS |

### Probe Execution

Not applicable — Phase 70 is a UI orchestrator rewrite; no `scripts/*/tests/probe-*.sh` documented or conventional in this repo. The authoritative gate per project memory `project_baseline_not_green_build_is_gate` is `npm run build` exit 0 — VERIFIED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DUPE-01 (UI part) | 70-01, 70-05 | Owned search-pick → /w/[ref] redirect | SATISFIED | `AddWatchFlow.tsx:159-162` router.push wired; T-70-01 green + extended in gap-08 to assert resolveDupeContext bypassed on fast path |
| DUPE-02 | 70-02, 70-05, 70-08 | "Add another copy" affordance bypasses owned-redirect; no silent duplicate hole | SATISFIED | Banner mounts + clear-dupeContext works; WR-01 gate (plan 70-08) closes the bypass-banner path; 3 regression tests assert disabled CTA + gate-release |
| DUPE-03 (UI part) | 70-02, 70-03, 70-05, 70-08 | Wishlist search-pick → DupeBanner with "Move to Collection" UPDATE; robust against resolver failure | SATISFIED | Banner mounts + Move to Collection wired to real UPDATE Server Action; happy path T-70-04 + moveWishlistToCollection.test.ts 8/8 green; WR-02 guard (plan 70-08) surfaces toast.error on known-dupe resolver failure + stays on search-idle |
| CLNP-05 | 70-04 | FlowState cleaned — old verdict-flow variants removed; new search-flow variants added | SATISFIED (reasoned deviation per CONTEXT D-01; Phase 71 audit completed) | flowTypes.ts ships 7-variant D-01 union; old verdict kinds gone; Phase 71 CLNP-05 audit confirmed (71-VERIFICATION.md Truth #4 VERIFIED). flowTypes.test.ts 4/4 green. |
| CLNP-06 | 70-05 | "Skip search — enter manually" link in search-idle state | SATISFIED (semantic deviation per CONTEXT D-19) | `AddWatchFlow.tsx:539-545` renders ghost link; `handleSkipSearch` sets manual-entry state with NO router.push. CONTEXT D-19 decided NOT to push `?manual=1` (in-flow user choice stays in-flow; URL stays at /watch/new). T-70-05 green (asserts pushSpy NOT called). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/watch/AddWatchFlow.tsx` | 165, 187, 219, 332 | 4× operator `console.warn` lines ship to production browser console without env gating | WARNING (WR-06, pre-existing) | Acknowledged diagnostic noise for first prod sessions per CONTEXT; "remove if noisy" comment but no removal gate. Non-blocking — not introduced by the gap-closure plans and not a data-correctness or behavior defect. |
| `src/components/watch/AddWatchFlow.tsx` | 158-162 | `handleSearchPick` owned-redirect trusts client-supplied `result.viewerState === 'owned'` | INFO (WR-07, pre-existing) | Not a security issue (/w/[ref] enforces auth); UX staleness note if watch removed in another tab. Non-blocking. |

The 2 BLOCKER-class defects (CR-01 + CR-02) and 1 WARNING-class defect (WR-01) that appeared in the initial Anti-Patterns table have been resolved. The WR-02 silent-fallthrough has been resolved for the handleSearchPick paths; structured-input + URL-backup silent fallthrough is intentional by design (per 70-08 decision[3] and regression test coverage). Remaining items are pre-existing INFO/WARNING-level items that do not block the phase goal.

### Human Verification Required

See frontmatter `human_verification` block — 8 manual UAT items. Per project memory `feedback_mobile_ui_verify_on_prod`, the user verifies mobile + visual behavior on prod after Vercel deploy. These items were already pending the bundled Phase 71 prod push per the Phase 70-08 SUMMARY (which added 2 plan-08-specific items and 2 plans-06/07-specific items to the original 8, totaling 12 visual UAT items in the Phase 71 bundle). The 8 items in the frontmatter are the canonical pre-existing list. Per 70-08 plan signal, bundle all with the Phase 71 prod deploy at the current git tip (`eb4da1f3` is the last gap-closure commit; Phase 71 delivered on top with `4515c3c9` as the current HEAD).

### Gaps Summary

**Phase goal is fully achieved.** All 6 must-have truths verified. The ROADMAP Success Criteria (SC#1–SC#5) are all satisfied. The three data-correctness / behavior defects flagged in the initial verification (CR-01, CR-02, WR-01, WR-02) have been closed by plans 70-06 (CR-01 upstream), 70-07 (CR-01 consumer + CR-02), and 70-08 (WR-01 + WR-02).

The orchestrator is rewritten, the FlowState union is the new shape, all four flow branches (search-first, structured-input, URL-backup, manual-entry) are wired, `?manual=1` priority + `?returnTo=` round-trip are preserved, and the three-layer reset extends to the new caches. Build green; 80/80 targeted tests green; hard cutover complete; Phase 71 delivered all deferred cleanup items (status: passed, 4/4).

Remaining open items are all in the `human_verification` block — 8 UAT items that require a prod browser session, deferred to the bundled Phase 71 Vercel deploy. These are not blockers on the phase goal; they are prod-validation checkpoints per the project's established mobile/visual verification workflow.

---

_Verified: 2026-05-29T22:27:50Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: initial gaps_found (2026-05-29T07:30:00Z) → passed (2026-05-29T22:27:50Z) after plans 70-06/07/08 closed all 4 defects_

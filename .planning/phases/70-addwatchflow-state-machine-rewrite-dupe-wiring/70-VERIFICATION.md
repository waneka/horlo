---
phase: 70-addwatchflow-state-machine-rewrite-dupe-wiring
verified: 2026-05-29T07:30:00Z
status: gaps_found
score: 4/6 must-haves verified (2 BLOCKERS: data-correctness defects in shipped Phase 70 code)
overrides_applied: 0
gaps:
  - truth: "Phase 70 commits the watch with correct catalog-derived metadata (movement) and does not silently discard user-provided photos"
    status: failed
    reason: "CR-01 (StructuredEntryPanel photo blob silently dropped) and CR-02 (movement='auto' hardcoded default + imageUrl forwarded after column dropped) — both flagged in 70-REVIEW.md as Critical. CR-02 in particular ships a real data-correctness regression: every search-pick / URL-cache-hit commit where the catalog/extracted result lacks movement persists `movement: 'auto'` to the user's watches row, overriding the truth of any quartz / hand-wound watch added via search. addWatch's catalogId branch (D-10) only server-overrides brand/model/reference — movement flows through verbatim. The user-visible behavior of the phase goal ('add a watch') is realized, but the row is wrong."
    artifacts:
      - path: "src/components/watch/AddWatchFlow.tsx"
        issue: "Line 382: `movement: captured.extracted.movement ?? 'auto'` in handleConfirmPrimary; the catalog row knows the real movement but the user row records 'auto' for non-auto search picks. Line 395 forwards `imageUrl` to addWatch even though Phase 60 dropped the column (mapDomainToRow line 94 silently drops it — dead code that obscures the cover-fallback chain). `searchResultToExtracted` (lines 739-746) never carries `movement` so the `??  'auto'` fallback always fires for search-pick paths."
      - path: "src/components/watch/StructuredEntryPanel.tsx"
        issue: "Lines 99-103: photoBlob state declared with `[, setPhotoBlob]` — write-only setter; the captured Blob value is never read or forwarded. Line 247: `<CatalogPhotoUploader onPhotoReady={setPhotoBlob}>` succeeds visually but the photo dies in dead-code state. The leading comment ('Phase 70 forwards it to the catalog source-photo upload pipeline at ConfirmStep commit') is unfulfilled — no onPhotoReady forwarded to AddWatchFlow, no handleStructuredSubmit photo arg, no photoSourcePath in the addWatch payload."
    missing:
      - "Strip `imageUrl` from handleConfirmPrimary payload (column is dropped per Phase 60) OR document explicitly that it is dead-write decoration"
      - "Gate the movement default — when catalogId is present, OMIT `movement` from the addWatch payload so the catalog row's downstream taste enrichment supplies it (or stop defaulting to 'auto' entirely). Add a regression test asserting a quartz catalog row stays 'quartz' (or null) through the search-pick → ConfirmStep → addWatch path."
      - "Wire StructuredEntryPanel.onPhotoReady through onSubmitStructured (third arg) → AddWatchFlow.handleStructuredSubmit captures the blob → uploadCatalogSourcePhoto called before addWatch → photoSourcePath included in payload (mirroring WatchForm.tsx lines 222-249). OR remove CatalogPhotoUploader from StructuredEntryPanel and defer EXTR-06 to a follow-up phase."
  - truth: "DupeBanner actually prevents silent duplicates when it appears (WR-01)"
    status: failed
    reason: "WR-01 (also in 70-REVIEW.md): when DupeBanner mounts with `dupeContext.existingStatus === 'owned'` or 'wishlist', the ConfirmStep primary CTA is still active. A user who scrolls past or ignores the banner and clicks ConfirmStep's primary button proceeds straight through `handleConfirmPrimary` → `addWatch` → a new row (DUPE-02) or a new wishlist row (DUPE-03 ignored). The DB has no UNIQUE(userId,catalogId) constraint (RESEARCH §D-08 confirmed) and `findViewerWatchByCatalogId` LIMIT 1 deliberately allows multiples. T-70-03 unit test asserts the banner appears + 'Add another copy' clears dupeContext, but never asserts ConfirmStep's primary CTA is gated when dupeContext is present. The whole purpose of DUPE-02/DUPE-03 (prevent surprise duplicates) is undermined by an active ConfirmStep CTA next to the banner. This makes the user-observable DUPE-02 (and DUPE-03 if user picks wishlist then clicks ConfirmStep instead of banner) behavior weaker than the requirement intends."
    artifacts:
      - path: "src/components/watch/AddWatchFlow.tsx"
        issue: "Lines 594-628 render branch: DupeBanner is mounted ABOVE ConfirmStep when state.dupeContext is set, but ConfirmStep receives `pending={state.pending}` only — not gated on `state.dupeContext != null`. The banner's pending only disables banner buttons; ConfirmStep's primary is fully clickable. No client-side or server-side de-dupe."
    missing:
      - "Disable ConfirmStep primary CTA when state.dupeContext != null (e.g., `pending={state.pending || state.dupeContext != null}`) — minimal fix, forces the user through one of the banner buttons. Alternative: hide ConfirmStep entirely until dupeContext is dismissed (Add another copy or banner action)."
      - "Add a regression test asserting that with dupeContext.existingStatus='owned' set, clicking ConfirmStep's primary does NOT call addWatch (or calls a moveWishlistToCollection-equivalent for wishlist)."
  - truth: "DUPE-03 commit path is robust against transient resolveDupeContext failures (WR-02)"
    status: partial
    reason: "WR-02 (70-REVIEW.md): when findViewerWatchByCatalogIdAction returns `{success: false}`, resolveDupeContext silently returns null and the orchestrator proceeds to ConfirmStep WITHOUT a DupeBanner. Combined with WR-01, a transient DB outage during dupe lookup gives the user a silent-duplicate addWatch path on owned/wishlist results where the SearchEntry result already advertised viewerState='owned' | 'wishlist'. The orchestrator KNOWS a dupe exists (from result.viewerState) but doesn't surface a toast.error or abort. Phase goal SC#1 (wishlist DupeBanner) becomes lossy on the rare error path."
    artifacts:
      - path: "src/components/watch/AddWatchFlow.tsx"
        issue: "Lines 722-731 resolveDupeContext: on `result.success === false`, logs a console.warn and returns null. handleSearchPick / handleStructuredSubmit / handleUrlBackup treat null as 'no existing watch' and silently fall through to the standard ConfirmStep without DupeBanner — there is no toast affordance or branch on the known-dupe case (viewerState pre-signals)."
    missing:
      - "When handleSearchPick has `result.viewerState === 'owned' | 'wishlist'` AND resolveDupeContext returns null, surface toast.error and remain on search-idle (do not silently advance to confirm-without-banner). For structured-input + URL-backup, accept the silent fallthrough but consider a toast affordance on action failure."
deferred:
  - truth: "Legacy verdict files deleted + static guards added"
    addressed_in: "Phase 71"
    evidence: "Phase 71 success criteria 1-3: VerdictStep/WishlistRationalePanel/PasteSection deletion + tests/static/AddWatchFlow.no-verdict-step.test.ts + tests/static/AddWatchFlow.no-collection-fit-card.test.ts. Phase 70 ended with hard-cutover imports (0 legacy refs in AddWatchFlow.tsx) — orphan files remain but the orchestrator no longer references them."
  - truth: "RecentlyEvaluatedRail / RailEntry / PendingTarget disposition"
    addressed_in: "Phase 71"
    evidence: "Phase 71 CLNP-04 success criterion: 'RecentlyEvaluatedRail is removed from AddWatchFlow; component file disposition decided during plan-phase'. flowTypes.ts D-01 deliberately keeps RailEntry + PendingTarget exports per Phase 71 forward-coordination; IN-02 in 70-REVIEW.md flags type-safety degradation as acceptable transition state."
  - truth: "FlowState literal enumeration matches REQUIREMENTS.md CLNP-05 exactly"
    addressed_in: "Phase 71 CLNP-05 audit (per Phase 70 CONTEXT.md §Phase 71 forward-coordination)"
    evidence: "Phase 70 CONTEXT.md D-01 and Plan 04 explicitly reconcile the REQUIREMENTS.md CLNP-05 'search-results/structured-input/extracting-structured' four-state enumeration by collapsing them into one orchestrator-level `search-idle` (SearchEntry owns the sub-state). Phase 71's CLNP-02 static guard will assert against the final union shape Phase 70 ships (not the ROADMAP draft enumeration). REQUIREMENTS.md CLNP-05 is marked [x] complete via this reasoned deviation."
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

**Verified:** 2026-05-29T07:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (derived from ROADMAP Success Criteria + REQUIREMENTS)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC#1a — Owned search-pick redirects to `/w/[ref]` (no confirm screen) | VERIFIED | `AddWatchFlow.tsx:159-162` — `router.push('/w/' + encodeURIComponent(result.reference))` when `result.viewerState === 'owned' && result.reference`. Unit test T-70-01 green. |
| 2 | SC#1b — Wishlist search-pick → confirm screen with DupeBanner + Move to Collection UPDATE (not INSERT) | VERIFIED with WR-02 caveat | `AddWatchFlow.tsx:185-206` constructs `confirming` with `dupeContext.existingStatus='wishlist'`; render branch lines 594-607 mounts DupeBanner above ConfirmStep with `onMoveToCollection={handleMoveToCollection}`. `handleMoveToCollection` (lines 452-480) calls `moveWishlistToCollection(existingWatchId)` which is a true UPDATE (`watchDAL.updateWatch(user.id, watchId, {status: 'owned', ...})` at watches.ts:452). Unit tests T-70-04 + moveWishlistToCollection.test.ts (8 cases) green. Caveat: transient resolveDupeContext failure silently falls through to no-banner state (WR-02). |
| 3 | SC#2 — "Add another copy" affordance bypasses owned-redirect for legitimate duplicates | PARTIAL (WR-01 blocker) | `AddWatchFlow.tsx:482-486` `handleAddAnotherCopy` clears dupeContext only; DupeBanner unmounts; ConfirmStep stays with primary `addWatch(catalogId)` CTA. Unit test T-70-03 green. **BUT** the inverse case is unguarded: the user can ignore the banner entirely and click ConfirmStep's primary directly, creating the same silent duplicate the banner is meant to prevent. See WR-01 gap. |
| 4 | SC#3 — `?manual=1` deep-link bypasses search and lands in manual-entry | VERIFIED | `AddWatchFlow.tsx:92-98` initialState ternary: `form-prefill > manual-entry > search-idle`; `initialManual === true` → `{kind: 'manual-entry', partial: null}`. Unit tests T-70-08a/b/c green. |
| 5 | SC#4 — `?returnTo=` URL parameter round-trips through every commit branch | VERIFIED | `AddWatchFlow.tsx:413` (handleConfirmPrimary), `:466` (handleMoveToCollection) both read `initialReturnTo ?? defaultDestinationForStatus(...)`. `handleWatchCreated` (lines 493-505) routes to `dest` which is set by WatchForm using initialReturnTo. `manualAction` (lines 516-521) preserves returnTo through the `?manual=1` re-push. Grep confirms 2 direct match sites + transitive WatchForm propagation. |
| 6 | SC#5 — Three-layer reset extended to new caches (Phase 29 → new useCatalogSearchCache + useStructuredExtractCache) | VERIFIED | Phase 69 CLNP-07 shipped the shared `moduleUserId` mismatch reset on all 4 caches (`useUrlExtractCache.ts:54-56`, `useCatalogSearchCache.ts`, `useStructuredExtractCache.ts`). AddWatchFlow.test.tsx 'Phase 69 — cache hygiene integration (CLNP-07)' describe block PRESERVED (lines 464+). useLayoutEffect cleanup in AddWatchFlow.tsx:134-149 implements the 3 skip cases per D-22 without clobbering deep-link state. |
| 7 | Phase-level correctness — `addWatch` payload from search-pick / URL-cache-hit / structured paths reflects catalog truth (does not corrupt movement) AND captured user photos persist | **FAILED (CR-01 + CR-02 BLOCKERS)** | CR-02: `AddWatchFlow.tsx:382` `movement: captured.extracted.movement ?? 'auto'` — `searchResultToExtracted` (lines 739-746) never carries movement, so every search-pick / URL-cache-hit submission persists `movement: 'auto'` for a quartz/hand-wound watch (the catalog row knows the truth; the user's watches row records the lie). `addWatch`'s catalogId branch only overrides brand/model/reference (Phase 67 D-10, watches.ts:138-140). CR-01: `StructuredEntryPanel.tsx:103` `[, setPhotoBlob]` — write-only setter; the EXIF-cleaned Blob from CatalogPhotoUploader (line 247) is never forwarded; users tap "Choose photo" successfully but nothing ships. Reviewer flagged both as Critical in 70-REVIEW.md. Neither is addressed in Phase 71 scope. |
| 8 | Hard-cutover — AddWatchFlow.tsx no longer imports legacy verdict-era files | VERIFIED | Grep: `grep -nE "^import.*('./PasteSection'\|'./VerdictStep'\|'./WishlistRationalePanel'\|'./RecentlyEvaluatedRail'\|useWatchSearchVerdictCache\|@/app/actions/verdict\|@/lib/verdict/types)" src/components/watch/AddWatchFlow.tsx` reports 0 matches. Phase 71 unblocked. |

**Score:** 4/6 truths verified (treating truth #1 and #2 as a combined SC#1; counting #7 as a phase-scope must-have BLOCKER even though it sits outside the literal ROADMAP success criteria — the phase claims a working add flow, not a working-but-data-wrong add flow).

### Deferred Items (Step 9b filter)

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | Legacy file deletions (PasteSection, VerdictStep, WishlistRationalePanel) + static guards | Phase 71 | Phase 71 SC#1-3 (ROADMAP.md:294-296) |
| 2 | RecentlyEvaluatedRail disposition + RailEntry/PendingTarget cleanup | Phase 71 | Phase 71 CLNP-04 (ROADMAP.md:71); Phase 70 deliberately retains per Phase 71 forward-coordination |
| 3 | FlowState literal-state enumeration matching REQUIREMENTS.md exactly (search-results / structured-input / extracting-structured) | Phase 71 CLNP-05 audit | Phase 70 CONTEXT D-01 explicitly reconciled to collapse into one `search-idle` because SearchEntry owns sub-state internally. Phase 71's static guard will lock against the final union (not the ROADMAP draft enumeration). REQUIREMENTS.md CLNP-05 marked complete via reasoned deviation. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/watch/AddWatchFlow.tsx` | Rewritten orchestrator mounting SearchEntry + ConfirmStep + DupeBanner + ExtractErrorCard + WatchForm + WatchPhotoStep per D-01..D-22 | VERIFIED (substantive + wired) but with truth #7 data-correctness flaws | 778 LOC (+15 over prior 763). Real imports, real handler wiring, useCallback discipline applied to 13 handlers. Renders 7 FlowState branches matching UI-SPEC §B/C/D/E. Build green. Unit tests 13/13 green. Hard cutover verified. |
| `src/components/watch/flowTypes.ts` | D-01 FlowState union + DupeContext interface + 19-line D-02 JSDoc transition map | VERIFIED | 82 LOC. Exports 7-variant union (`search-idle`, `extracting-url`, `extraction-failed` with mode, `confirming` with dupeContext+pickedResult+pending, `form-prefill`, `manual-entry`, `photos-pending`). `DupeContext` interface (lines 49-53). 19-line transition map JSDoc block (lines 5-29). `RailEntry` + `PendingTarget` retained per Phase 71 forward-coord. No legacy verdict kind literals. flowTypes.test.ts 4/4 green. |
| `src/components/watch/DupeBanner.tsx` | Pure-presenter sibling banner with owned/wishlist context branches + null-reference fallback | VERIFIED | 123 LOC. Pure presenter (no useRouter / useTransition / Server Action imports). Three buttons: View existing (conditional on existingReference), Move to Collection (conditional on wishlist+onMoveToCollection), Add another copy (always). 6 verbatim copy strings ship (Already in your collection, On your wishlist, View existing, Move to Collection, Add another copy, Moving…). `font-semibold` headline (no `font-medium` recurrence). Mobile-first stacked → desktop row. min-h-[44px] WCAG touch target. aria-live="polite". DupeBanner.test.tsx 6/6 green. |
| `src/app/actions/watches.ts moveWishlistToCollection` | UPDATE (not INSERT) Server Action with auth gate + Zod + DAL ownership + status whitelist + activity log + overlap notifications + cache invalidation | VERIFIED | `watches.ts:382-521` ships the full chain: getCurrentUser (auth-first); Zod (UUID + optional pricePaid + notes); watchDAL.getWatchById ownership; status whitelist (`wishlist` only; `owned` idempotent; `sold`/`grail` rejected with template error); updateWatch with `{status: 'owned'}` minimal payload; logActivity('watch_added') with {brand, model, imageUrl}; findOverlapRecipients + logNotification fan-out; revalidatePath/Tag matrix. moveWishlistToCollection.test.ts 8/8 green (auth, Zod, ownership, idempotent, sold/grail reject, side-effects, missing watch). |
| `src/app/actions/watches.ts findViewerWatchByCatalogIdAction` | Server Action wrapper around DAL (Rule 3 auto-fix — postgres driver bundle exclusion) | VERIFIED | `watches.ts:740-772`. Re-derives identity via getCurrentUser (strengthens T-70-04 — client-supplied viewerUserId IGNORED on this path). Zod gate on UUID + statuses enum whitelist. ActionResult envelope; failure non-fatal in orchestrator. |
| `src/data/watches.ts findViewerWatchByCatalogId` | DAL widened to return `reference` via leftJoin watches_catalog | VERIFIED | `watches.ts:295-334`. Now selects `reference: watchesCatalog.reference` + `.leftJoin(watchesCatalog, eq(watches.catalogId, watchesCatalog.id))`. Return type `{id, status, reference}`. Backward-compat — Phase 67 callers destructure only {id, status}. |
| `src/components/watch/AddWatchFlow.test.tsx` | Phase 69 four-cache test PRESERVED + verdict-era tests REMOVED + 13 Phase 70 transition tests added | VERIFIED | 552 LOC (−234 vs prior 786). Three legacy describes (Phase 20.1 Plan 04/06/08) gone. Phase 69 CLNP-07 describe block preserved verbatim (line 464+). 13 new Phase 70 cases including T-70-01..08 + CLNP-06 render assertion. Mock factories isolate orchestrator from child rendering. 13/13 green. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| AddWatchFlow.tsx | SearchEntry | mounted in search-idle branch (lines 531-538) | WIRED | viewerUserId, catalogBrands, onPick, onSubmitStructured, onSwitchToUrl all threaded |
| AddWatchFlow.tsx | ConfirmStep | mounted in confirming branch (lines 608-628) | WIRED | All locked Phase 68 D-03 contract props threaded (12 base + movement/caseSizeMm/dialColor) |
| AddWatchFlow.tsx | DupeBanner | conditional render above ConfirmStep when state.dupeContext set (lines 596-607) | WIRED but LEAKY | DupeBanner mounts; onMoveToCollection conditional on wishlist context per D-11. **BUT** ConfirmStep CTA is not gated when banner is present (WR-01 — see truth #3 caveat). |
| AddWatchFlow.tsx handleMoveToCollection | moveWishlistToCollection (Server Action) | line 459 | WIRED | `await moveWishlistToCollection(existingWatchId)`; success → router.push to /u/{username}/collection; pending state drives banner disable |
| AddWatchFlow.tsx resolveDupeContext | findViewerWatchByCatalogIdAction (Server Action) | lines 722-731 | WIRED | Server Action wraps the DAL (Rule 3 auto-fix); re-derives identity via getCurrentUser; failure non-fatal → null fallback (WR-02 silent state) |
| moveWishlistToCollection | watchDAL.updateWatch (UPDATE not INSERT) | watches.ts:452 | WIRED | `watchDAL.updateWatch(user.id, watchId, {status:'owned',...})` — confirmed UPDATE semantics |
| moveWishlistToCollection | logActivity + findOverlapRecipients + logNotification + revalidatePath/Tag | watches.ts:459-514 | WIRED | Full side-effect chain mirrored from addWatch:247-341. Activity type `watch_added` (no source field per RESEARCH Pitfall 3). |
| AddWatchFlow.tsx initialState | search-idle / form-prefill / manual-entry precedence | lines 92-98 | WIRED | D-03 precedence ternary preserved; T-70-08a/b/c assert all three branches |
| All commit branches | initialReturnTo round-trip via defaultDestinationForStatus | lines 413, 466, 493-505, 516-521 | WIRED | D-04 honored in handleConfirmPrimary + handleMoveToCollection + handleWatchCreated + manualAction |
| useUrlExtractCache + useCatalogSearchCache + useStructuredExtractCache + useWatchSearchVerdictCache | shared moduleUserId mismatch reset (CLNP-07) | useUrlExtractCache.ts:54-56 + sibling files | WIRED | Cross-user reset preserved through Phase 69 retrofit; Phase 70 AddWatchFlow consumes useUrlExtractCache(viewerUserId); other 3 consumed by SearchEntry/StructuredEntryPanel/search-page |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| AddWatchFlow `<ConfirmStep>` | state.extracted, state.catalogId | searchResultToExtracted(SearchCatalogWatchResult) on pick path; ExtractedWatchData from /api/extract-watch on URL-backup path; ExtractedWatchData from StructuredEntryPanel emit on structured path | YES (search path) — server-authoritative catalog row via Phase 67 search action; (URL/structured) — real LLM extraction | FLOWING |
| AddWatchFlow `<DupeBanner>` | state.dupeContext | findViewerWatchByCatalogIdAction → DAL leftJoin watches_catalog | YES — server-authoritative (auth re-derived via getCurrentUser; reference JOINed from catalog row not client) | FLOWING |
| AddWatchFlow addWatch payload | confirmStatus, confirmPrice, confirmReference, confirmYear, captured.extracted.* | ConfirmStep controlled fields + state.extracted | PARTIAL — see truth #7. `movement: 'auto'` default fires every search-pick (CR-02). `imageUrl` forwarded but dropped at DAL (dead). Other fields flow correctly. | **STATIC + HOLLOW_FIELDS** (movement) |
| StructuredEntryPanel CatalogPhotoUploader | photoBlob state | onPhotoReady callback | NO — the value is captured into a write-only setter `[, setPhotoBlob]` and never forwarded (CR-01) | **DISCONNECTED** |
| moveWishlistToCollection updatedWatch | watchDAL.updateWatch return | real DB UPDATE | YES | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build gate | `npm run build` | `✓ Compiled successfully in 6.0s` exit 0 | PASS |
| Phase 70 targeted tests | `npx vitest run flowTypes.test.ts DupeBanner.test.tsx AddWatchFlow.test.tsx moveWishlistToCollection.test.ts` | 4 test files passed; 31/31 tests passed | PASS |
| Hard-cutover grep | `grep -nE "^import.*('./PasteSection'|'./VerdictStep'|'./WishlistRationalePanel'|'./RecentlyEvaluatedRail'|useWatchSearchVerdictCache|@/app/actions/verdict|@/lib/verdict/types)" src/components/watch/AddWatchFlow.tsx | wc -l` | 0 | PASS |
| Verbatim copy strings in DupeBanner | `grep "Already in your collection\|On your wishlist\|Move to Collection\|Add another copy\|View existing\|Moving…" src/components/watch/DupeBanner.tsx` | All 6 strings present | PASS |
| `font-medium` raw-palette guardrail in new files | `grep -c "font-medium" src/components/watch/DupeBanner.tsx src/components/watch/AddWatchFlow.tsx` | 0 in DupeBanner.tsx; 0 in AddWatchFlow.tsx | PASS |
| Legacy variant absence in FlowState union | `grep -cE "kind: '(idle|extracting|verdict-ready|wishlist-rationale-open|submitting-wishlist|submitting-collection)'" src/components/watch/flowTypes.ts` | 0 | PASS |

### Probe Execution

Not applicable — Phase 70 is a UI orchestrator rewrite; no `scripts/*/tests/probe-*.sh` documented or conventional in this repo. The authoritative gate per project memory `project_baseline_not_green_build_is_gate` is `npm run build` exit 0 — VERIFIED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DUPE-01 (UI part) | 70-01 (DAL widen), 70-05 (orchestrator) | Owned search-pick → /w/[ref] redirect | SATISFIED | `AddWatchFlow.tsx:159-162` router.push wired; T-70-01 unit test green |
| DUPE-02 | 70-02 (DupeBanner), 70-05 | "Add another copy" affordance bypasses owned-redirect | PARTIAL (WR-01) | Banner mounts + clear-dupeContext works; **but the inverse path (user ignores banner → clicks ConfirmStep primary) silently creates the duplicate the banner exists to prevent**. T-70-03 green for the banner-click path; no test for the bypass-banner path. |
| DUPE-03 (UI part) | 70-02, 70-03 (action), 70-05 | Wishlist search-pick → DupeBanner with "Move to Collection" UPDATE | PARTIAL (WR-01 + WR-02 caveat) | Banner mounts + Move to Collection wired to real UPDATE Server Action; happy path T-70-04 green + moveWishlistToCollection.test.ts 8/8 green. **But** the same banner-bypass issue (WR-01) applies; transient dupe-lookup failure silently drops the banner (WR-02). |
| CLNP-05 | 70-04 (flowTypes rewrite) | FlowState cleaned — old verdict-flow variants removed; new search-flow variants added | SATISFIED (reasoned deviation per CONTEXT D-01) | flowTypes.ts ships 7-variant D-01 union; old verdict kinds gone; CONTEXT D-01 explicitly reconciles the REQUIREMENTS.md 4-state enumeration into 1 orchestrator-level `search-idle` (SearchEntry owns sub-state). Phase 71 CLNP-02 static guard will lock against THIS shape. flowTypes.test.ts 4/4 green. |
| CLNP-06 | 70-05 (skip link UI) | "Skip search — enter manually" link in search-idle state | SATISFIED (semantic deviation from REQUIREMENTS.md per CONTEXT D-19) | `AddWatchFlow.tsx:539-545` renders ghost link; `handleSkipSearch` (lines 250-253) sets manual-entry state with NO router.push — preserves URL at /watch/new. CONTEXT D-19 explicitly decided NOT to push `?manual=1` (in-flow user choice stays in-flow; the URL semantic stays reserved for deep-links). REQUIREMENTS.md CLNP-06 wording says "routes to `?manual=1`" but the chosen behavior is observably stronger UX (no URL flicker). T-70-05 unit test green (asserts pushSpy NOT called). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/watch/StructuredEntryPanel.tsx` | 99-103, 246-247 | Dead state: `[, setPhotoBlob]` write-only setter; CatalogPhotoUploader.onPhotoReady wired to the orphan setter; no forward path to AddWatchFlow | **BLOCKER (CR-01)** | EXTR-06 affordance ships in a non-functional state; user uploads a photo and the EXIF-cleaned blob silently dies in local component state. No user-observable error; no operator telemetry. |
| `src/components/watch/AddWatchFlow.tsx` | 382 | `movement: captured.extracted.movement ?? 'auto'` in handleConfirmPrimary; `searchResultToExtracted` (lines 739-746) never carries movement → fallback always fires for search-pick paths | **BLOCKER (CR-02)** | Every search-pick / URL-cache-hit commit where the catalog/extracted result lacks movement persists `movement: 'auto'` to the user's watches row. A quartz Grand Seiko or hand-wound Speedmaster added via SearchEntry will be recorded as auto. The catalog row may know the truth; the watches row (which drives similarity + downstream displays) does not. |
| `src/components/watch/AddWatchFlow.tsx` | 395 | `imageUrl: captured.extracted.imageUrl` in addWatch payload | INFO (dead-code) | `imageUrl` column was dropped in Phase 60; `mapDomainToRow:94` silently drops it. Field is purely decorative in the payload. Confusing to readers. |
| `src/components/watch/AddWatchFlow.tsx` | 594-628 | ConfirmStep mounted alongside DupeBanner without disabling ConfirmStep primary CTA when dupeContext is set | **WARNING (WR-01)** | The banner is the "primary affordance" per D-12 but the ConfirmStep CTA is fully clickable. A user who ignores the banner and clicks ConfirmStep primary creates exactly the duplicate the banner exists to prevent. |
| `src/components/watch/AddWatchFlow.tsx` | 722-731 | resolveDupeContext silently returns null on action failure (WR-02) | WARNING | Transient DB outage during dupe lookup → ConfirmStep without banner → potential silent duplicate. Operator console.warn is the only signal. |
| `src/components/watch/AddWatchFlow.tsx` | 165, 187, 219, 332 | 4× operator `console.warn` lines ship to production browser console without env gating | WARNING (WR-06) | Comment acknowledges "remove if noisy"; no removal gate. Compounds with `src/app/actions/watches.ts:433` server-side console.warn fired on every moveWishlistToCollection call. |
| `src/components/watch/AddWatchFlow.tsx` | 158-162 | `handleSearchPick` owned-redirect trusts client-supplied `result.viewerState === 'owned'` without re-verifying | INFO (WR-07) | Not a security issue (the /w/[ref] page enforces auth) but a UX-trust note: stale viewerState (e.g., user removed watch in another tab) routes to /w/[ref] which may show the catalog-branch view. Bypasses the dupe-resolver on this branch. |

Total: 2 BLOCKERS, 5 WARNINGS+INFO. The 2 BLOCKERS are the same data-correctness defects flagged in `70-REVIEW.md` (CR-01 + CR-02) and are NOT addressed in Phase 71's scope.

### Human Verification Required

See frontmatter `human_verification` block — 8 manual UAT items. Per project memory `feedback_mobile_ui_verify_on_prod`, the user verifies mobile + visual behavior on prod after Vercel deploy. Bundle with Phase 71 push per CONTEXT/SUMMARY recommendation.

### Gaps Summary

**Phase goal is partially achieved.** The orchestrator IS rewritten, the FlowState union IS the new shape, the four flow branches (search-first, structured-input, URL-backup, manual-entry) ARE wired, `?manual=1` priority + `?returnTo=` round-trip ARE preserved verbatim, and the three-layer reset DOES extend to the new caches via Phase 69 CLNP-07. Build green; 31/31 targeted tests green; hard cutover clean.

**However, two BLOCKER-class defects ship in the same code:**

1. **CR-02 (`movement: 'auto'` hardcoded default)** — every search-pick / URL-cache-hit commit corrupts the user's watches row for non-auto watches. The phase goal of "adding a watch" is achieved structurally, but the row is wrong. addWatch's catalogId branch (D-10) only server-overrides brand/model/reference; movement flows through verbatim. Fix is small: gate the `?? 'auto'` default on `!captured.catalogId`, or strip movement from the payload entirely when catalogId is present.

2. **CR-01 (StructuredEntryPanel photo blob silently discarded)** — the EXTR-06 affordance ships in a non-functional state. Users upload, see success UI, lose the photo. Fix is small: thread a third arg through onSubmitStructured or add an onPhotoReady prop, capture in AddWatchFlow, upload via existing uploadCatalogSourcePhoto pipeline, set photoSourcePath on the addWatch payload.

**Additional WARNING (WR-01)** — the DupeBanner does not gate the ConfirmStep CTA when both are mounted. A user can ignore the banner and click ConfirmStep primary directly, creating exactly the silent duplicate the banner exists to prevent. This undermines DUPE-02's core intent. Fix is one line: `pending={state.pending || state.dupeContext != null}` on ConfirmStep.

These defects are observable in the codebase, flagged in 70-REVIEW.md, and NOT addressed in Phase 71's scope (which is dead-code cleanup + static guards). They block the phase from being declared "goal achieved" at the data-correctness level even though the UI flow paths are wired.

**Recommend gap-closure plan:** Plan 06 (or hotfix) addressing CR-01 + CR-02 + WR-01 before Phase 71 lands. Bundle with Phase 71 push per the existing feedback_mobile_ui_verify_on_prod recommendation; the prod UAT session can then validate the corrected behavior + the Phase 71 deletions in one cycle.

---

_Verified: 2026-05-29T07:30:00Z_
_Verifier: Claude (gsd-verifier)_

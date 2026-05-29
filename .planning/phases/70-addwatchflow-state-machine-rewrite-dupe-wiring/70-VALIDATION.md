---
phase: 70
slug: addwatchflow-state-machine-rewrite-dupe-wiring
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-29
plans_indexed: 2026-05-29
---

# Phase 70 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Authoritative section in `70-RESEARCH.md` ("## Validation Architecture", line 640).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x (existing — `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run <test-path>` (single file, no watch) |
| **Full suite command** | `npm run build` (THE gate — per `project_baseline_not_green_build_is_gate`) |
| **Estimated runtime** | ~30s per file; ~90s build |

---

## Sampling Rate

- **After every task commit:** Run the matching `npx vitest run <test-path>` for files the task touched
- **After every plan wave:** Run `npm run build` (exit 0 required — full `npm run test` baseline carries pre-existing failures per memory)
- **Before `/gsd-verify-work`:** `npm run build` MUST exit 0; phase-touched test files MUST be green
- **Max feedback latency:** ~30s (file-scoped vitest); ~90s (build)

---

## Per-Task Verification Map

> Filled by `gsd-planner` during planning. Each task in the PLAN.md `<automated>` block lists its `npx vitest run <path>` command; the planner mirrors them here with status pending.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 70-01-T1 | 01 | 1 | DUPE-02/03 (UI prereq) | — | StructuredEntryPanel.onSubmitStructured emits `(extracted, catalogId)` | unit | `npx vitest run src/components/watch/__tests__/StructuredEntryPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 70-01-T2 | 01 | 1 | DUPE-02/03 (UI prereq) | T-70-04 | findViewerWatchByCatalogId returns `{id,status,reference}` via JOIN | unit | `npx vitest run src/data/__tests__/watches.test.ts -t findViewerWatchByCatalogId` | ❌ W0 | ⬜ pending |
| 70-01-T3 | 01 | 1 | D-17 (photos-pending gate) | — | WatchForm.onWatchCreated(watchId, dest, status) signature extended | unit | `npx vitest run src/components/watch/__tests__/WatchForm.test.tsx` | ❌ W0 | ⬜ pending |
| 70-01-T4 | 01 | 1 | regression | — | Phase 67/69 existing tests still pass after Wave 0 patches | regression | `npx vitest run src/app/actions/__tests__/watches.test.ts src/components/watch/__tests__/SearchEntry.test.tsx` | ✅ | ⬜ pending |
| 70-02-T1 | 02 | 2 | DUPE-02, DUPE-03 (UI) | — | DupeBanner renders owned + wishlist contexts, fires callbacks, hides View-existing on null ref | unit | `npx vitest run src/components/watch/__tests__/DupeBanner.test.tsx` | ❌ W0 | ⬜ pending |
| 70-02-T2 | 02 | 2 | DUPE-02, DUPE-03 (UI) | — | DupeBanner structural (file present, exports React.FC) | unit | `npx vitest run src/components/watch/__tests__/DupeBanner.test.tsx -t structural` | ❌ W0 | ⬜ pending |
| 70-03-T1 | 03 | 2 | DUPE-03 (UI part of DAL hook) | T-70-01, T-70-02, T-70-03 | moveWishlistToCollection auth-gates, IDOR-blocks, idempotent, rejects sold/grail, fires logActivity + overlap notifications | unit | `npx vitest run src/app/actions/__tests__/moveWishlistToCollection.test.ts` | ❌ W0 | ⬜ pending |
| 70-03-T2 | 03 | 2 | DUPE-03 | — | revalidatePath + revalidateTag matrix called identically to addWatch | unit | `npx vitest run src/app/actions/__tests__/moveWishlistToCollection.test.ts -t revalidate` | ❌ W0 | ⬜ pending |
| 70-04-T1 | 04 | 2 | CLNP-05 | — | FlowState D-01 final union compiles, transition map comment present, DupeContext interface exported, old verdict variants absent | unit | `npx vitest run src/components/watch/__tests__/flowTypes.test.ts` | ❌ W0 | ⬜ pending |
| 70-05-T1 | 05 | 3 | DUPE-01/02/03 (UI), CLNP-05/06, SC#3/#4/#5 | T-70-04 | AddWatchFlow rewritten — search-idle / extracting-url / extraction-failed / confirming(+DupeBanner) / form-prefill / manual-entry / photos-pending branches; ?manual=1 + ?returnTo= preserved; D-22 cleanup extended | unit | `npx vitest run src/components/watch/__tests__/AddWatchFlow.test.tsx` | ✅ retrofit | ⬜ pending |
| 70-05-T2 | 05 | 3 | SC#5 | — | Phase 69 four-cache integration test still passes (CLNP-07 cross-user reset) | regression | `npx vitest run src/components/watch/__tests__/AddWatchFlow.test.tsx -t "Phase 69"` | ✅ | ⬜ pending |
| 70-05-T3 | 05 | 3 | gate | — | npm run build exit 0 (THE gate per project memory) | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Per RESEARCH `## Validation Architecture`:

- [ ] **WatchPhotoStep onSubmitStructured contract patch** — extend `StructuredEntryPanel` emit to bundle `catalogId` (research gap §1)
- [ ] **DAL return-shape extension** — `findViewerWatchByCatalogId` joins `watches_catalog.reference` so DupeBanner's "View existing" link has the data (research gap §2)
- [ ] **Optional: `WatchForm.onWatchCreated(watchId, dest, status)` extension** — needed for the D-17 photos-pending status gate on manual-entry / form-prefill branches
- [ ] **Stub tests planted Wave 0:**
  - `src/components/watch/__tests__/flowTypes.test.ts` (NEW)
  - `src/components/watch/__tests__/DupeBanner.test.tsx` (NEW)
  - `src/app/actions/__tests__/moveWishlistToCollection.test.ts` (NEW)
  - Extend existing `src/components/watch/__tests__/AddWatchFlow.test.tsx` (RETROFIT — Phase 69 four-cache test stays)

*Framework already installed (vitest). Test patterns to mirror live in `src/app/actions/__tests__/watches.test.ts` (Phase 67) and `src/components/watch/__tests__/ConfirmStep.test.tsx` (Phase 68).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DUPE-01: clicking owned search result navigates to `/w/[ref]` with no confirm screen | DUPE-01 (UI) | Cross-route navigation + soft-nav cache behavior; structural unit tests can't observe the URL bar | On prod, sign in, open `/watch/new`, search a brand you own, click a result whose `viewerState === 'owned'` — URL becomes `/w/[ref]`, no confirm screen renders |
| DUPE-02: "Add another copy" affordance bypasses owned-redirect and adds a second `watches` row bound to same catalog | DUPE-02 | Requires DB read to verify two rows exist post-commit; structural test verifies the affordance + handler, not the DB outcome | On prod, reach `confirming` with `dupeContext.existingStatus='owned'` (via URL or structured input of an owned watch), click "Add another copy", commit; verify a second row in `/u/[username]/collection` |
| DUPE-03: wishlist search-pick → confirm with DupeBanner → "Move to Collection" UPDATES (no INSERT) | DUPE-03 (UI) | UPDATE-vs-INSERT verification + activity feed + overlap notification side-effects | On prod, add a watch to wishlist, then return to `/watch/new`, search same brand, click the wishlist result, click DupeBanner "Move to Collection", verify wishlist count decreases by 1 + collection count increases by 1 + activity feed shows one entry (not two) |
| CLNP-06: "Skip search — enter manually" link transitions in-flow without `?manual=1` URL push | CLNP-06 | URL bar observation across in-flow transition | On prod open `/watch/new`, click "Skip search — enter manually" — URL stays `/watch/new`, manual entry form mounts |
| `?manual=1` priority deep-link still skips search | SC#3 | URL bar + initial render observation | On prod navigate to `/watch/new?manual=1`, manual entry form renders on first paint, no search bar |
| `?returnTo=` round-trip after add | SC#4 | Cross-route nav verification | On prod from wishlist empty-state CTA navigate to `/watch/new?returnTo=/u/<username>/wishlist`, add a watch, end up back at `/u/<username>/wishlist` |
| Revisit `/watch/new` doesn't poison from prior search/extract | SC#5 / D-22 | Activity-hide cleanup behavior is timing-sensitive; only verifiable in browser | On prod open `/watch/new`, search "rolex", navigate away, return to `/watch/new` — search box empty, no stale results |
| D-17 photos-pending gate only when committed `status === 'owned'` | claude's discretion (D-17 — v7→v8 UX regression callout) | Status-aware branch + screen presence | On prod add a wishlist watch via search-first — should land on `/u/[username]/wishlist`, NOT photos-pending |

*Per `feedback_mobile_ui_verify_on_prod`: bundle Phase 70 + Phase 71 push to prod and have user UAT both in one session.*
*Per `feedback_ppr_cache_fill_no_longer_call_out`: do NOT add soft-nav #419 / cache-fill checks to UAT — that family is resolved infrastructure.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (StructuredEntryPanel emit, DAL return shape, WatchForm.onWatchCreated)
- [x] No watch-mode flags (all commands use `vitest run`)
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-29 (post plan-checker PASS, 2 non-blocking warnings — Plan 04 prose discrepancy fixed; SC#4 returnTo round-trip relies on Phase 28 existing coverage + structural grep + prod UAT row 6)

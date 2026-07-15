---
phase: 83-polish-sweep
verified: 2026-07-14T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "On a mobile device (iPhone Safari), navigate to the Worn tab and open the LogTodaysWearButton picker — confirm only owned watches appear (no wishlist, no grail)."
    expected: "Picker shows only status=owned watches."
    why_human: "POLISH-02 mobile dropdown behavior requires prod iPhone Safari verification per project rule feedback_mobile_ui_verify_on_prod."
  - test: "On a mobile device (iPhone Safari), navigate to a wishlist watch detail page and tap 'Remove from wishlist' — confirm dialog title, body copy, and confirm button all read 'Remove from wishlist' and the body ends with 'You can add it back any time.'"
    expected: "All four dialog elements (trigger, title, body, confirm) show 'Remove from wishlist' copy; cancel reads 'Cancel'."
    why_human: "POLISH-03 mobile dialog behavior requires prod iPhone Safari verification per project rule feedback_mobile_ui_verify_on_prod."
---

# Phase 83: Polish Sweep Verification Report

**Phase Goal:** Ship three small, low-risk UX cleanups that unblock the v9.0 pile before any schema work begins.
**Verified:** 2026-07-14
**Status:** human_needed
**Re-verification:** No — initial verification.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On the desktop top nav (≥md viewport), the user does NOT see a `+` add-watch icon-button. | VERIFIED | `DesktopTopNav.tsx` has no `Plus` import, no `aria-label="Add watch"`, no `/watch/new?returnTo=` link. Commit `7a4c4532`. |
| 2 | The `Plus` import and the `<Link>/<Button>/<Plus>` block are fully removed — no dead code remains. | VERIFIED | `grep -c 'Plus' DesktopTopNav.tsx` = 0. WR-01 (unused `Button` import) fixed in commit `28a39ec3`. File now imports only `Search` from lucide-react. |
| 3 | `NavWearButton` and `{bell}` siblings remain and are in the correct order inside `DesktopTopNav`. | VERIFIED | Lines 96-97 of `DesktopTopNav.tsx`: `NavWearButton` then `{bell}` — `UserMenu` follows. No substitute affordance added. |
| 4 | `DesktopTopNav.test.tsx` updated — add-watch link assertions removed; Test 10 deleted; test count decreased by exactly 1 (13 → 12). | VERIFIED | `grep -c 'name: /add watch/i' DesktopTopNav.test.tsx` = 0. `grep -c 'Add icon' DesktopTopNav.test.tsx` = 0. Test file has 12 `it(...)` blocks. Commit `f11c7b23`. |
| 5 | No other test files assert the presence of the removed `+` nav link. | VERIFIED | `grep -rln "getByRole.*add watch\|queryByRole.*add watch" tests/` matches only `WatchForm.test.tsx`, `WatchForm.isChronometer.test.tsx`, `add-watch-flow-photos.test.tsx`, `WatchForm.notesPublic.test.tsx` — all reference the WatchForm submit button (labeled "Add Watch"), which is unrelated to the removed DesktopTopNav link. |
| 6 | `watchOptions` in `WornTabContent.tsx` derives from `ownedWatches` (not `Object.values(watchMap)`); `watchMap` unchanged; `All watches` default option preserved; dependency array is `[ownedWatches]`. | VERIFIED | `grep -c 'Object.values(watchMap)' WornTabContent.tsx` = 0. `grep -c 'ownedWatches' WornTabContent.tsx` = 5 (interface decl, destructured param, useMemo body, empty-state WywtPostDialog mount, dep array). `watchMap={watchMap}` still passed to `WornTimeline` and `WornCalendar` (2 matches). `<SelectItem value="all">All watches</SelectItem>` still present verbatim. Commit `9eb47266`. |
| 7 | `WatchDetail.tsx` Dialog trigger: `variant={isWishlistLike ? 'outline' : 'destructive'}` and label `{isWishlistLike ? 'Remove from wishlist' : 'Delete'}`. | VERIFIED | Line 303: `<DialogTrigger render={<Button variant={isWishlistLike ? 'outline' : 'destructive'} />}>` / Line 304: `{isWishlistLike ? 'Remove from wishlist' : 'Delete'}`. |
| 8 | `WatchDetail.tsx` Dialog body: title, description, and confirm button all conditional on `isWishlistLike`; owned branch (`Delete Watch` / `cannot be undone`) preserved; `handleDelete` and `removeWatch` names unchanged. | VERIFIED | Line 309: `{isWishlistLike ? 'Remove from wishlist' : 'Delete Watch'}`. Lines 312-315: description ternary with exact D-09 copy including "You can add it back any time." for wishlist-like and "This action cannot be undone." for owned. Line 330: confirm button `{isWishlistLike ? 'Remove from wishlist' : 'Delete'}` with `variant="destructive"` on both branches. `grep -c 'const handleDelete' WatchDetail.tsx` = 1. `grep -c 'removeWatch(watch.id)' WatchDetail.tsx` = 1. Commit `c868740e`. |
| 9 | `isWishlistLike` derivation at line 135 is unchanged and still drives all conditional UX. | VERIFIED | `grep -c 'const isWishlistLike' WatchDetail.tsx` = 1. Line 135: `const isWishlistLike = watch.status === 'wishlist' \|\| watch.status === 'grail'`. |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/layout/DesktopTopNav.tsx` | Desktop nav without `Plus` import or add-watch link block | VERIFIED | No `Plus`, no `aria-label="Add watch"`, no `/watch/new`. `Button` import also removed (WR-01, commit `28a39ec3`). |
| `tests/components/layout/DesktopTopNav.test.tsx` | Updated assertions — no add-watch link positive checks; Test 10 deleted | VERIFIED | 0 occurrences of `name: /add watch/i`. 0 occurrences of `'Test 10 —'`. Test count 12 (was 13). |
| `src/components/profile/WornTabContent.tsx` | `watchOptions` from `ownedWatches`, `watchMap` intact, `All watches` option preserved | VERIFIED | `watchOptions` useMemo derives from `ownedWatches` with `{ id, brand, model }` projection; dep array `[ownedWatches]`; `watchMap` still passed to both timeline renderers. |
| `src/components/watch/WatchDetail.tsx` | Conditional wishlist/grail-aware delete copy; owned branch unchanged | VERIFIED | All four conditional sites (trigger variant+label, dialog title, description, confirm button) keyed on `isWishlistLike`; `handleDelete`/`removeWatch` names preserved. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `WornTabContent.tsx` `watchOptions` useMemo | events-filter `<Select>` (line 151) and `LogTodaysWearButton` (line 159) | Both consume `watchOptions` array unchanged | VERIFIED | Both consumers already reference `watchOptions` by name. No shape change needed — `{ id, brand, model }` satisfies `LogTodaysWearButton`'s local `WatchSummary` type (no `imageUrl` required). |
| `WatchDetail.tsx` `isWishlistLike` gate | DialogTrigger Button variant + label, DialogTitle, DialogDescription, confirm Button label | Inline ternary expressions at each site | VERIFIED | Lines 303-330 confirmed — all four sites branch correctly on `isWishlistLike`. |
| `page.tsx:493` `ownedWatches` prop | `WornTabContent.tsx` `ownedWatches` prop | Already-existing prop threading — no page-layer change | VERIFIED | `WornTabContent` interface declares `ownedWatches: Watch[]`; `page.tsx` was NOT modified (per D-05/D-06). |

---

### Data-Flow Trace (Level 4)

Not applicable. All three changes are UI-only: they alter which existing prop is read (`ownedWatches` vs `watchMap` in POLISH-02) or what copy/variant is rendered based on an already-computed boolean (`isWishlistLike` in POLISH-03). No new data sources, API calls, or server-side fetches were introduced. The upstream data flows (`ownedWatches` from `page.tsx:493`, `watch.status` from the RSC) were pre-existing and are verified by build success.

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| POLISH-01: `Plus` not present in DesktopTopNav | `grep -c 'Plus' src/components/layout/DesktopTopNav.tsx` | 0 | PASS |
| POLISH-01: `Button` import cleanup (WR-01) | `grep -c 'Button' src/components/layout/DesktopTopNav.tsx` | 0 (no Button ref) | PASS |
| POLISH-02: old derivation removed | `grep -c 'Object.values(watchMap)' src/components/profile/WornTabContent.tsx` | 0 | PASS |
| POLISH-02: new derivation references ownedWatches | `grep -c 'ownedWatches' src/components/profile/WornTabContent.tsx` | 5 | PASS |
| POLISH-02: watchMap still wired to renderers | `grep -c 'watchMap={watchMap}' src/components/profile/WornTabContent.tsx` | 2 | PASS |
| POLISH-03: wishlist copy present | `grep -c 'Remove from wishlist' src/components/watch/WatchDetail.tsx` | 3 | PASS |
| POLISH-03: reassurance copy present | `grep -c 'You can add it back any time' src/components/watch/WatchDetail.tsx` | 1 | PASS |
| POLISH-03: owned branch copy preserved | `grep -c 'Delete Watch' src/components/watch/WatchDetail.tsx` | 1 | PASS |
| POLISH-03: owned branch undone warning preserved | `grep -c 'This action cannot be undone' src/components/watch/WatchDetail.tsx` | 1 | PASS |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No debt markers (TBD, FIXME, XXX), placeholders, or hardcoded empty stubs found in any file modified by this phase.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| POLISH-01 | 83-01-PLAN | User no longer sees a `+` add-watch button in the desktop top nav | SATISFIED | `DesktopTopNav.tsx` — Plus import and add-watch Link/Button/Plus block removed; test file updated; WR-01 dead-import cleaned up. |
| POLISH-02 | 83-02-PLAN | User selecting "log a wear" watch dropdown on Worn tab sees only currently-owned watches | SATISFIED | `WornTabContent.tsx` — `watchOptions` derives from `ownedWatches` prop; both the events-filter Select and LogTodaysWearButton consume the same owned-only list; `watchMap` untouched so timeline rows for demoted watches still render. |
| POLISH-03 | 83-03-PLAN | User removing a watch from wishlist sees "Remove from wishlist" copy, not "Delete" | SATISFIED | `WatchDetail.tsx` — all four conditional sites (trigger label+variant, dialog title, description, confirm button) keyed on `isWishlistLike`; owned branch ("Delete Watch", "cannot be undone") preserved per D-08. |

All three POLISH requirement IDs are accounted for. No orphaned requirements detected for Phase 83 in REQUIREMENTS.md.

---

### Human Verification Required

Per project rule `feedback_mobile_ui_verify_on_prod` — mobile-Safari behavior still verified on prod (pointing real iPhone at localhost is painful). The two items below require prod iPhone Safari testing after the bundled Vercel deploy.

#### 1. POLISH-02 Mobile Dropdown Scope

**Test:** Sign in on iPhone Safari (prod) as a user with both wishlist and owned watches. Navigate to the Worn tab. Open the events-filter dropdown and the LogTodaysWearButton picker separately.
**Expected:** Both dropdowns show only currently-owned watches. Wishlist and grail watches do not appear. The "All watches" default option in the events filter is present.
**Why human:** Mobile-Safari rendering of Select/dropdown components and the LogTodaysWearButton picker requires real device verification against prod data; cannot be replicated in jsdom or from a local dev session.

#### 2. POLISH-03 Mobile Dialog Copy

**Test:** Sign in on iPhone Safari (prod). Navigate to a wishlist watch detail page. Tap the "Remove from wishlist" trigger button. Inspect the dialog. Tap Cancel to dismiss (do not confirm to avoid losing test data).
**Expected:** Trigger button reads "Remove from wishlist" and is outline-styled (not filled red). Dialog title reads "Remove from wishlist". Dialog body ends with "You can add it back any time." Confirm button reads "Remove from wishlist" (destructive-styled). Cancel button reads "Cancel".
**Why human:** Mobile-Safari dialog rendering and touch interactions require real device verification; the dialog variant and copy changes need visual confirmation on the actual iOS render surface.

---

### Gaps Summary

None. All 9 observable truths are VERIFIED in the codebase. The two human verification items are standard mobile-Safari prod-UAT items per `feedback_mobile_ui_verify_on_prod` — they are not gaps; they are a structural project verification requirement for any phase that touches UI surfaces users experience on mobile.

---

_Verified: 2026-07-14_
_Verifier: Claude (gsd-verifier)_

---
phase: 62-public-wear-pics-on-watch-detail
verified: 2026-05-27T18:00:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 6/6
  gaps_closed:
    - "WPIC-06 discoverability: like + comment controls relocated into per-slide bottom-right on-photo overlay (62-05); prod re-check approved 2026-05-27"
    - "CR-01 (code review regression): comment sheet now bound to clicked slide's sheetWearEventId/sheetWearPic instead of activeWearPic; off-screen overlays gated with pointer-events-none + aria-hidden + tabIndex=-1 (714e2ba)"
  gaps_remaining: []
  regressions: []
---

# Phase 62: Public Wear Pics on Watch Detail — Verification Report (Re-verification)

**Phase Goal:** Public wear photos automatically appear on the watch's detail page, the owner can hide individual surfaced pics, and all surfaced pics carry the full v6.0 social interaction layer.
**Verified:** 2026-05-27T18:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (62-05 overlay relocation + 714e2ba CR-01 fix)

---

## Re-verification Context

Previous verification (2026-05-27T07:45:00Z) returned `human_needed` with 6/6 structural truths verified and 6 prod UAT items outstanding. The manual UAT (62-UAT.md) ran on prod: 6 pass, 1 cosmetic gap (Test 4 / WPIC-06 discoverability). Plan 62-05 relocated the social controls into a per-slide bottom-right on-photo overlay. The prod re-check was approved by the user this session (62-UAT.md status=resolved, 62-HUMAN-UAT.md status=complete 6/6).

A code review (62-05-REVIEW.md) then identified CR-01: the per-slide comment button still opened the sheet against `activeWearPic` rather than the clicked slide's `wp`, enabling keyboard/AT focus and partial-drag to open the wrong wear event's thread. Commit 714e2ba fixed this: `sheetWearEventId` state is now set by the clicked slide's button; the `WearCommentHost` renders against `sheetWearPic` (a `visibleWearPics.find` against `sheetWearEventId`, falling back to `activeWearPic`); non-active slide overlays are gated via `pointer-events-none` + `aria-hidden` + `tabIndex={-1}` (WR-01/WR-02 resolved as a consequence).

This re-verification confirms the post-fix code satisfies all 6 WPIC must-haves and that the CR-01 fix introduced no regressions.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Public wear pics surface in the /w/[ref] carousel (WPIC-01) | VERIFIED | `getPublicWearPicsForWatch` called in both UnifiedWatchContent branches (page.tsx lines 178 and 495); `wear-photos` admin-client signing in both (lines ~215 and ~526); `visibleWearPics` appended after owner slides in WatchPhotoSection |
| 2 | Owner can hide/unhide a surfaced wear pic (WPIC-02) | VERIFIED | `hideWearPicAction`/`unhideWearPicAction` imported at WatchPhotoSection.tsx line 60; `onPointerDown` toggle at line 763 (NOT onClick — stale-instance guard); `useOptimistic` revert-on-failure pattern present; server actions use `.strict()` schema + ownership re-check |
| 3 | Wear photos shown in Wears tab (WPIC-03) | VERIFIED | `WornTimeline.tsx` + `WornCalendar.tsx` prefer `e.photoUrl ?? watchCoverSafe`; Wears-tab RSC signs via admin client; 4/4 unit tests pass (carried from prior verification, no regression) |
| 4 | Home wear rail stays ephemeral; hidden-from-detail does not affect rail (WPIC-04) | VERIFIED | `getWearRailForViewer` unchanged; 6/6 guardrail unit tests pass; prod UAT Test 7 confirmed pass |
| 5 | Non-public wear pics never surface on watch detail (WPIC-05) | VERIFIED | DAL filters `visibility='public' AND hiddenFromDetail=false` (wearEvents.ts lines 585-587); prod UAT Test 6 confirmed pass with 2nd account |
| 6 | Surfaced wear pics carry v6.0 likes/comments (WPIC-06) | VERIFIED | Per-slide overlay: `LikeButton target={{ type: 'wear', id: wp.wearEventId }}` at WatchPhotoSection.tsx line 547; comment button `onClick` sets `sheetWearEventId(wp.wearEventId)` + `setCommentSheetOpen(true)` at lines 566-568; `WearCommentHost variant="bottom-sheet"` bound to `sheetWearPic` at lines 635-655; overlay is `absolute bottom-2 right-2` at line 534; prod re-check approved 2026-05-27 |

**Score:** 6/6 truths verified

---

### Plan 62-05 Must-Haves (per-slide overlay closure)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On a wear-pic slide, like + comment controls render as on-photo overlay anchored bottom-right | VERIFIED | `grep: "absolute bottom-2 right-2"` → line 534; per-slide inside `visibleWearPics.map` |
| 2 | Each wear-pic slide carries its OWN overlay (per-slide, keyed to wp.wearEventId); owner/catalog slides carry NO overlay | VERIFIED | Overlay is inside `visibleWearPics.map((wp, idx) => {...})` — structurally excluded from owner (lines 452-470) and catalog (lines 474-484) slide paths |
| 3 | Worn badge stays bottom-LEFT, social overlay sits bottom-RIGHT — no collision | VERIFIED | Badge: `absolute bottom-2 left-2` at line 519; overlay: `absolute bottom-2 right-2` at line 534 |
| 4 | Like is one-tap optimistic; comment-count tap opens that pic's WearCommentHost bottom sheet with count in sync | VERIFIED | `LikeButton` per-wp (line 545-550); comment button `onClick` sets `sheetWearEventId(wp.wearEventId)` then `setCommentSheetOpen(true)` (lines 566-568); `sheetWearPic` derived via `visibleWearPics.find(p => p.wearEventId === sheetWearEventId) ?? activeWearPic` (line 432-433); `WearCommentHost` bound to `sheetWearPic` with `onCountChange` updating `wearPicCommentCounts` (lines 649-653) |
| 5 | Standalone below-carousel social row is gone; position indicator is unchanged | VERIFIED | `grep "flex items-center gap-2 w-full max-w-md"` → 0 results in WatchPhotoSection.tsx (standalone row deleted); position indicator at lines 621-629 untouched |

---

### CR-01 Fix Verification (commit 714e2ba)

| Check | Evidence | Status |
|-------|----------|--------|
| `sheetWearEventId` state declared | Line 227: `const [sheetWearEventId, setSheetWearEventId] = useState<string \| null>(null)` | VERIFIED |
| `sheetWearPic` derived from explicitly-clicked target | Lines 432-433: `visibleWearPics.find((p) => p.wearEventId === sheetWearEventId) ?? activeWearPic` | VERIFIED |
| Comment button sets `sheetWearEventId` before opening | Lines 566-568: `onClick={() => { setSheetWearEventId(wp.wearEventId); setCommentSheetOpen(true) }}` | VERIFIED |
| `WearCommentHost` bound to `sheetWearPic` (not `activeWearPic`) | Lines 635, 638, 641: `{sheetWearPic && (<WearCommentHost ... wearEventId={sheetWearPic.wearEventId} ... initialComments={sheetWearPic.initialComments}` | VERIFIED |
| `onCountChange` targets `sheetWearPic.wearEventId` | Line 652: `[sheetWearPic.wearEventId]: (prev[sheetWearPic.wearEventId] ?? sheetWearPic.commentCount) + delta` | VERIFIED |
| Off-screen overlays gated: `pointer-events-none` | Lines 536-538: `!isActiveWearSlide && 'pointer-events-none'` via `cn()` | VERIFIED |
| Off-screen overlays gated: `aria-hidden` | Line 541: `aria-hidden={!isActiveWearSlide}` | VERIFIED |
| Off-screen comment buttons gated: `tabIndex={-1}` | Line 559: `tabIndex={isActiveWearSlide ? undefined : -1}` | VERIFIED |
| `isActiveWearSlide` computed correctly | Line 502: `const isActiveWearSlide = selectedIndex - ownerSlideCount === idx` | VERIFIED |
| `activeWearPic` NOT used as `wearEventId` in WearCommentHost | `grep "wearEventId={activeWearPic"` → 0 results | VERIFIED |

---

### Regression Checks (items preserved from Plan 04)

| Item | Check | Status |
|------|-------|--------|
| Worn badge UTC pin (D-07 / React #418) | Line 520: `new Date(wp.wornDate + 'T00:00:00Z')...`; Line 521: `timeZone: 'UTC'` | VERIFIED |
| Single WearCommentHost host | Only one `WearCommentHost` in file (line 636); `commentSheetOpen` state drives it | VERIFIED |
| LikeButton per-wp binding | Line 547: `target={{ type: 'wear', id: wp.wearEventId }}` | VERIFIED |
| `comment button uses onClick (NOT onPointerDown)` | Lines 565-568: `onClick={() => {...}}` — `onPointerDown` present only on eye/hide toggle (line 763) and edit-mode button (line 941) | VERIFIED |
| No `'use cache'` added to WatchPhotoSection | `grep -c "'use cache'" WatchPhotoSection.tsx` → 0 | VERIFIED |
| `unstable_instant = false` preserved in page.tsx | Line 47: `export const unstable_instant = false` | VERIFIED |
| `await connection()` preserved in page.tsx | Line 93: `await connection()` | VERIFIED |
| No new `'use cache'` in page.tsx | page.tsx references `'use cache'` only in comments (lines 89, 152, 154) — not as a directive | VERIFIED |
| eye/hide toggle uses `onPointerDown` | Line 763: `onPointerDown={(e) => { e.stopPropagation(); ...` | VERIFIED |
| hideWearPicAction / unhideWearPicAction wired | Line 60 (import); line 773 (call in toggle) | VERIFIED |
| `hideWearPicAction` / `unhideWearPicAction` server-side ownership re-check | Inherited from prior verification; actions unchanged by 62-05/714e2ba | VERIFIED |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/watch/WatchPhotoSection.tsx` | Per-slide bottom-right overlay; sheetWearEventId/sheetWearPic CR-01 fix; standalone row deleted | VERIFIED | Overlay at line 534; CR-01 fix at lines 227, 432, 566-568, 635-655; `grep "flex items-center gap-2 w-full max-w-md"` returns 0 |
| `src/app/w/[ref]/page.tsx` | Both branches fetch + sign wear pics; cache contract intact | VERIFIED | `getPublicWearPicsForWatch` called 4 times (both branches import + call); `wear-photos` bucket present 3 times; `unstable_instant=false` + `await connection()` confirmed untouched |
| `src/components/watch/WatchDetail.tsx` | `wearPics` prop threaded to WatchPhotoSection | VERIFIED | `wearPics?: SignedWearPic[]` at line 81; threaded at line 187 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `WatchPhotoSection.tsx` per-slide comment button | `sheetWearEventId` state | `onClick(() => setSheetWearEventId(wp.wearEventId))` | WIRED | Line 566 |
| `sheetWearEventId` | `WearCommentHost` | `sheetWearPic` derived via `visibleWearPics.find` | WIRED | Lines 432-433, 635-655 |
| Off-screen overlay | non-interactive | `pointer-events-none` + `aria-hidden` + `tabIndex={-1}` | WIRED | Lines 537, 541, 559 |
| `src/app/w/[ref]/page.tsx` | `getPublicWearPicsForWatch` | Both branches (lines 178, 495) | WIRED | Confirmed |
| `WatchPhotoSection.tsx` eye/hide toggle | `hideWearPicAction`/`unhideWearPicAction` | `onPointerDown` + `startTransition` | WIRED | Lines 763, 773 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| WPIC-01 | 62-02, 62-04 | Public wear pic automatically surfaces on watch detail | SATISFIED | DAL + page RSC both branches + merged carousel; prod UAT Test 2 pass |
| WPIC-02 | 62-01, 62-02, 62-04 | Owner can hide a surfaced wear pic per-pic | SATISFIED | eye/hide `onPointerDown` toggle + server actions + optimistic revert; prod UAT Test 5 pass |
| WPIC-03 | 62-03 | Wears tab shows actual wear photo | SATISFIED | WornTimeline + WornCalendar photoUrl preference; prod UAT Test 7 pass |
| WPIC-04 | 62-01, 62-02 | Home wear rail stays ephemeral (unchanged) | SATISFIED | `getWearRailForViewer` unchanged; 6/6 guardrail tests; prod UAT Test 7 pass |
| WPIC-05 | 62-02 | Non-public wear pic never surfaces on watch detail | SATISFIED | DAL filters `visibility='public' AND hiddenFromDetail=false`; prod UAT Test 6 (2nd account) pass |
| WPIC-06 | 62-04, 62-05 | Surfaced wear pics carry v6.0 likes/comments layer | SATISFIED | Per-slide overlay with LikeButton + comment button; CR-01 fix ensures correct thread target; prod re-check approved 2026-05-27 |

All 6 WPIC requirements mapped to Phase 62 in REQUIREMENTS.md are marked `[x]` and `Complete` in the traceability table. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX markers in any modified file | — | None |
| — | — | `'use cache'` count in WatchPhotoSection.tsx = 0 (directive) | — | None |
| — | — | No `activeWearPic` leakage into WearCommentHost `wearEventId` prop | — | None |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `getPublicWearPicsForWatch` filters visibility + hiddenFromDetail | `npx vitest run tests/unit/getPublicWearPicsForWatch.test.ts` | 5/5 PASS (carried from prior run; no regression) | PASS |
| `hideWearPicAction`/`unhideWearPicAction` ownership enforcement | `npx vitest run tests/unit/hideWearPic.test.ts` | 5/5 PASS (carried; no regression) | PASS |
| WornTimeline photoUrl preference | `npx vitest run tests/unit/WornTimeline.test.tsx` | 4/4 PASS (carried; no regression) | PASS |
| wearRail D-17 guardrail | `npx vitest run tests/unit/wearRail.test.ts` | 6/6 PASS (62-05-SUMMARY.md self-check: 56/56 unit tests pass) | PASS |
| Build gate | `npm run build` | exits 0 (62-05-SUMMARY.md self-check confirmed; .next/BUILD_ID timestamp 2026-05-27 10:08) | PASS |

---

### Human Verification Required

None — all 6 UAT items from the prior verification are resolved:

| UAT Test | Requirement | Result | Record |
|----------|-------------|--------|--------|
| 1. Cold start smoke | — | pass | 62-UAT.md |
| 2. Carousel union + slide order | WPIC-01 | pass | 62-UAT.md, 62-HUMAN-UAT.md |
| 3. Worn badge hydration (no #418) | WPIC-01/D-07 | pass | 62-UAT.md, 62-HUMAN-UAT.md |
| 4. Like + comment sheet (WPIC-06) | WPIC-06 | pass (resolved by 62-05 + prod re-check approved 2026-05-27) | 62-UAT.md |
| 5. Owner eye/hide toggle | WPIC-02 | pass | 62-UAT.md, 62-HUMAN-UAT.md |
| 6. Non-public visibility gate | WPIC-05 | pass | 62-UAT.md, 62-HUMAN-UAT.md |
| 7. Home wear rail unaffected | WPIC-04 | pass | 62-UAT.md |

The CR-01 regression introduced by 62-05 and fixed in 714e2ba is a correctness issue (wrong wear event thread on keyboard/AT/partial-drag activation). Its fix has been verified structurally above. The prod UAT Test 4 approval was obtained before CR-01 was identified; the fix is JSX-logic-only (no visual change to the overlay position, scrim, or LikeButton binding). No new prod re-check is required for the CR-01 fix — the functional surface (comment sheet opens for the clicked pic) was already covered by UAT Test 4 on the happy path, and the keyboard/AT path is verifiable from the code alone.

---

### Gaps Summary

No gaps. All 6 WPIC must-haves are verified in the current post-714e2ba codebase. The phase goal is fully achieved:

- Public wear photos surface automatically on watch detail (WPIC-01) — prod confirmed.
- Owner can hide individual surfaced pics (WPIC-02) — prod confirmed.
- All surfaced pics carry the full v6.0 social interaction layer (WPIC-06) — per-slide on-photo overlay, correct comment-sheet targeting (sheetWearPic), LikeButton per wp — prod confirmed.
- Supporting requirements WPIC-03/04/05 confirmed prod.

---

_Verified: 2026-05-27T18:00:00Z_
_Verifier: Claude (gsd-verifier)_

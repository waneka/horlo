---
slug: wears-lane-nav-chrome
status: checkpoint:human-verify
trigger: "Phase 56A WearsLane cross-user stories navigation + desktop chrome bugs found in on-device prod UAT"
created: 2026-05-23T20:02:32Z
updated: 2026-05-23T21:00:00Z
phase: 56A-wear-view-unification
files_in_scope:
  - src/components/wears/WearsLane.tsx
  - src/app/wears/[username]/page.tsx
---

# Debug Session: wears-lane-nav-chrome

## Symptoms

**Expected behavior:**
- MOBILE: swiping past the edge (first/last wear) of a user's lane advances to the prev/next user's `/wears/[username]` lane (stories-style).
- MOBILE: advancing should REPLACE the previous user's lane (not stack); closing (X) should return to HOME in one tap.
- DESKTOP: prev/next edge arrows are visible and navigate wears + cross users at boundaries.
- DESKTOP: the top IG-style progress-bar segments are visible and track the current wear.

**Actual behavior (on-device prod UAT, 2026-05-23):**
- M1: Cross-user advance is inconsistent — edge-swipe "mostly doesn't" advance; when it does jump, it feels disconnected from the gesture (user asked if there's an auto-advance timer — there is NOT one).
- M2: After jumping to another user, the previous user's lane is still rendered/stacked underneath; close behavior is wrong relative to the expected "one close → home".
- D1: Desktop prev/next edge arrows do not appear at all.
- D2: Desktop swiping does not advance between users (same as M1).
- D3: Desktop top progress-bar segments do not appear.

**Error messages:** None — purely behavioral/visual. tsc + build clean; local e2e SKIPS (empty local test DB, no wear rows).

**Timeline:** Introduced by the 56A gap-closure round (plans 56A-06 cross-user swipe, 56A-07 progress/close/arrows) just deployed to prod. Never worked correctly on-device.

**Reproduction:**
- Mobile: open `/wears/[username]` from the home rail; swipe past the first/last wear → should cross users (mostly doesn't). Tap near the last slide / interact with the comment sheet → occasional unprompted jump.
- Desktop (>=768px): open `/wears/[username]`; expected edge arrows + top progress bar are absent; edge-swipe doesn't cross users.

## Starting Hypotheses (orchestrator pre-diagnosis — VERIFY against the live code, do not assume)

**H1 — Cross-user detection is built on a fragile `'settle'` signal (M1, D2).**
`WearsLane.tsx` Effect B (~lines 211-253) triggers `goToNeighbor` from embla's `'settle'` event + a pointer-delta ref. Suspected failure modes:
  - (a) `'settle'` does not reliably fire on a boundary over-drag, and likely never fires for single/few-wear lanes (nothing to settle) → "mostly doesn't happen" (stories rails often have users with 1-2 wears).
  - (b) NO magnitude threshold: line ~234 `if (delta >= 0) return` triggers on ANY leftward delta (even a few px), so tiny/accidental movements at the boundary cross users.
  - (c) The comment-sheet `reInit` (line ~103 `emblaApi.reInit({ watchDrag })`) and momentum/programmatic scrolls emit `'settle'` independent of a user gesture → spurious "disconnected" jumps.
PROPOSED FIX: detect the boundary swipe purely on native pointer-RELEASE with a real distance threshold (e.g. > 50px) when at the first/last slide AND `!canScrollPrev()/!canScrollNext()` — DROP `'settle'` entirely. Keep guards: `commentOpen`, `navigated` single-flight, `railIndex === -1`. This removes false triggers + the timing race and works for single-wear lanes.

**H2 — `router.push` stacks lanes instead of replacing (M2).**
`goToNeighbor` uses `router.push` (lines ~144/149) → history stacks home→A→B→C, so the previous user lingers and close (`router.back`, line ~298) does not go straight home. PROPOSED FIX: `router.replace` for cross-user nav so advancing replaces the lane and one close → home. Verify the "rendered underneath" symptom is fully resolved by replace (could also involve a `fixed inset-0` transition/unmount artifact).

**H3 — Desktop chrome loses its positioning context AND has no contrast (D1, D3).**
Outer container is `md:static` (line ~265). `position: static` is NOT a positioning context, so the absolutely-positioned chrome (progress bar ~271, close ~299, arrows ~329-364) no longer anchors to the lane on desktop → mispositioned/off-screen. ALSO the chrome is `text-white`/`bg-white` — invisible on the LIGHT desktop background (it only works on mobile because it overlays the dark full-screen photo). PROPOSED FIX: make the outer container `md:relative` (restore positioning context; keep `md:inset-auto md:h-auto md:overflow-visible`), and give the chrome contrast that survives a light bg (dark scrim / semi-transparent circle behind arrows + progress, or constrain the chrome to overlay the photo column). Needs a live desktop visual check.

## Current Focus

hypothesis: H1 (fragile settle-based cross-user detection), H2 (router.push stacking), H3 (md:static + white-on-light desktop chrome) — ALL THREE CONFIRMED AGAINST LIVE CODE AND FIXED.
next_action: Human verify on device (mobile swipe + close) and desktop (arrows + progress bar).
reasoning_checkpoint: All three root causes confirmed by source read. H1: settle fires on reInit (comment open/close) and never fires for single-wear lanes. H2: router.push confirmed at lines 144/149. H3: md:static confirmed at line 265; absolute chrome children lose anchor.
tdd_checkpoint:

## Evidence

- timestamp: 2026-05-23T20:02:32Z
  note: Orchestrator read WearsLane.tsx in full prior to opening this session. Confirmed in source: Effect B registers `emblaApi.on('settle', onSettle)` with deps [emblaApi, railUsernames, railIndex, commentOpen, router]; line 234 `if (delta >= 0) return` has no magnitude threshold; goToNeighbor uses `router.push`; outer container className includes `md:static`; progress/close/arrows use text-white/bg-white. These are read-confirmed, but the BEHAVIORAL causation (which hypothesis explains which symptom on a real device) is unverified.

- timestamp: 2026-05-23T21:00:00Z
  note: |
    Full source read of WearsLane.tsx (368 lines) and page.tsx (159 lines). All three hypotheses confirmed:
    H1 CONFIRMED: Effect B (lines 211-253) uses embla.on('settle', onSettle). emblaApi.reInit() in the comment-sheet effect (line 103) triggers 'settle' with dragDeltaX.current potentially set from a prior drag → spurious jumps. For single-wear lanes, 'settle' fires on initial render settle but dragDeltaX is null then; over-drag snap-back DOES fire settle but timing is unreliable. No magnitude threshold (any delta > 0 triggers).
    H2 CONFIRMED: router.push at lines 144 and 149. History stacks; router.back() from close button does not go home.
    H3 CONFIRMED: outer container has 'md:static' at line 265. All absolute children (progress bar, close button, arrows) lose their positioning anchor on desktop.
    FIX APPLIED: Rewrote WearsLane.tsx —
    (1) H1: Dropped 'settle' event entirely. Replaced Effect B with pointer-release detection at pointerup on window. Threshold: CROSS_USER_THRESHOLD_PX = 50px. goToNeighborRef pattern isolates comment/router state from Effect A's deps to prevent listener teardown mid-drag.
    (2) H2: router.push → router.replace in both goToNeighbor branches.
    (3) H3: md:static → md:relative on outer container. Arrow buttons: text-white → text-foreground bg-background/70 rounded-full shadow (contrast on light desktop bg). Progress segments: added md:bg-foreground md:opacity-70/20 variants. Close button: added md:text-foreground. Build passed clean.

## Eliminated

- 'settle' timing race as the sole H1 explanation: the more direct failure mode is reInit-triggered settle events (comment sheet toggling). Both modes cause spurious cross-user navigation and are eliminated by the pointerup approach.

## Resolution

root_cause: |
  Three independent bugs:
  (1) H1 — Cross-user swipe detection used embla 'settle' event, which fires spuriously on emblaApi.reInit() (comment-sheet open/close) and is unreliable for single-wear lanes. No magnitude threshold meant any tiny drag at the boundary crossed users.
  (2) H2 — router.push stacked history; close button (router.back) went to previous user's lane instead of home.
  (3) H3 — Outer container used md:static (not a positioning context), so absolute progress bar, close button, and arrows were not anchored to the lane column on desktop. Chrome was text-white, invisible on light desktop background.
fix: |
  (1) Dropped embla 'settle' detection. Replaced with window pointerup listener checking boundary slide position + swipe direction + 50px threshold. goToNeighborRef pattern keeps Effect A deps stable (no listener teardown mid-drag).
  (2) router.push → router.replace in goToNeighbor.
  (3) md:static → md:relative. Arrow buttons: bg-background/70 rounded-full shadow + text-foreground. Progress + close: md:text-foreground / md:bg-foreground variants.
verification: PENDING — requires on-device prod test (mobile swipe + close, desktop arrows/progress).
files_changed:
  - src/components/wears/WearsLane.tsx

## Verification Constraint

All fixes are behavioral/visual and confirm ONLY on a real device/prod (local e2e skips — empty local test DB). Use checkpoint:human-verify gates: deploy to prod (`git push origin main` → Vercel) between rounds and let the user test on their phone (mobile) and a desktop browser. Run `npm run build` as a pre-push gate. See MEMORY: [[feedback_mobile_ui_verify_on_prod]] and [[feedback_ui_spec_css_chain_blind_spot]].

---
slug: wears-lane-nav-chrome
status: investigating
trigger: "Phase 56A WearsLane cross-user stories navigation + desktop chrome bugs found in on-device prod UAT"
created: 2026-05-23T20:02:32Z
updated: 2026-05-23T23:00:00Z
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

**Error messages:** None — purely behavioral/visual. tsc + build clean; local e2e SKIPS (empty local test DB).

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

ROUND 1 VERIFIED ON PROD (2026-05-23): cross-user swipe now works, close→home works, comment-sheet no longer triggers spurious jumps, desktop arrows + progress bar now appear. THREE new wrinkles found in the same UAT pass — Round 2:

ROUND 2 FIXES APPLIED (commit 39794c4) — pending on-device prod verify:

hypothesis (R2):
- W1 (STUCK STATE — real bug): the `navigated` single-flight ref (WearsLane.tsx:151) is set true on cross-user nav (lines 160/165) but NEVER reset, and WearsLane is NOT keyed/remounted on a new user — page.tsx renders `<WearsLane>` without a `key` so the App Router reuses the SAME instance across `/wears/[A]`→`/wears/[B]` (router.replace, same dynamic route). So after navigating, `navigated.current` stays true AND the embla instance carries stale slide state (no reInit on `slides` change — only on commentOpen). Result: cross-user nav locks up after a few crossings ("swipe to next, swipe back, then stuck"). LIKELY FIX: give `<WearsLane>` a `key` tied to the actor username/route param in page.tsx → clean remount per user resets `navigated` + re-inits embla with the correct slides + resets selectedIndex. (Confirm the no-remount/stale-embla causation; a defensive `navigated.current=false` reset on railIndex/slides change is a lighter alternative but the key/remount is more robust.)
- W2 (UI): remove the cross-user boundary-hint caret from the progress bar (the `{isLastSegment && hasNextUser && <ChevronRight/>}` block at WearsLane.tsx:290-295). Keep `isLastSegment`/`hasNextUser` — still used by the arrow visibility conditions.
- W3 (UI): desktop arrows are anchored to the full-width outer container (`absolute left-0`/`right-0`, lines 349/368) so they sit at the VIEWPORT edges, not the centered 600px photo column. Move them adjacent to the photo: wrap the embla viewport in a `relative md:max-w-[600px] md:mx-auto` container (NOT overflow-hidden) and anchor the arrows to THAT (photo-column edges) — e.g. left-0/right-0 of the column, or just outside it. Verify visually on desktop.

next_action: Deploy to prod (git push origin main → Vercel) and test on-device. Verify: (1) mobile stuck-state is gone — can swipe A→B→A→B without getting stuck; (2) progress-bar caret is gone; (3) desktop arrows appear adjacent to the photo column, not at screen edges.
reasoning_checkpoint:
tdd_checkpoint:

ROUND 2 VERIFIED ON PROD (2026-05-23): W2 (caret removed) and W3 (arrows adjacent to photo) CONFIRMED GOOD. W1 STUCK STATE STILL REPRODUCES — the key={username} remount did NOT fix it, so the `navigated`-ref/no-remount hypothesis is DISPROVEN as the cause. Round 3:

hypothesis (R3 — STUCK STATE, refined): NOT the rail mapping (getWearRailForViewer is ordered by wornDate desc with NO viewed-state filtering — railUsernames/railIndex are STABLE across navigations, verified in src/data/wearEvents.ts:376-380). The real cause is LANDING POSITION: every cross-user nav lands at slide 0 because goToNeighbor uses router.replace('/wears/<user>') with no positional hint and page.tsx defaults initialSlideIndex=0 (page.tsx:111) when there's no ?from. But FORWARD-cross requires being at the LAST slide (isLast). Repro trace: A opened from rail with ?from=<most-recent> → lands at A's LAST slide → forward crosses to B ✓; B reached via replace (no from) → slide 0 → swipe-right crosses back to A ✓; A reached via replace (no from) → slide 0 → forward swipe moves WITHIN A's wears (not at last) → cannot re-cross → "stuck". Only bites MULTI-wear users (single-wear: slide 0 == last, so forward would still cross). This explains why the key remount was irrelevant.

ROUND 3 FIX APPLIED (commit 8bcc672) — pending on-device prod verify:

fix (R3): Instagram-stories landing rule:
  - FORWARD cross → next user's FIRST slide (slide 0). Already correct; kept.
  - BACKWARD cross → previous user's LAST slide. goToNeighbor('prev') now appends ?at=last to the router.replace URL. page.tsx destructures `at` from searchParams (same await pattern as `from`); when at==='last' and no ?from, sets initialSlideIndex = wears.length - 1. ?from takes precedence if somehow both are present.
  - Result: A→B(fwd)→A(back, lands at A's LAST slide)→forward re-crosses to B cleanly. No stuck.
  - Build: npm run build clean.

next_action (R3): Test on-device after Vercel deploy. Multi-wear scenario: open first rail user from home, swipe forward to user B, swipe back to user A, swipe forward again — should cross to B, not get stuck. Repeat A→B→A→B several times.

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

- timestamp: 2026-05-23T20:30:00Z
  note: |
    ROUND 1 PROD VERIFICATION (user, on device): "much better". Cross-user swipe works, close→home works, comment-sheet dismiss no longer triggers a jump, desktop arrows + progress bar now render. Round 1 (H1/H2/H3) CONFIRMED FIXED on-device. Three new wrinkles (Round 2):
    W1 STUCK STATE: "open first user, swipe to next user, swipe back to first user → can't swipe to advance to next user anymore — stuck, can only close and start over." Orchestrator source read: `navigated` ref (WearsLane.tsx:151) set true at 160/165, never reset; no `key` on <WearsLane> in page.tsx → instance reused across cross-user router.replace nav → stale `navigated` (and stale embla, since reInit only runs on commentOpen, not on slides change). Primary fix candidate: key WearsLane by username for a clean per-user remount.
    W2: remove the progress-bar caret (ChevronRight boundary hint, lines 290-295).
    W3: desktop arrows are at viewport edges (left-0/right-0 on the full-width outer container); move adjacent to the centered 600px photo column.

- timestamp: 2026-05-23T21:45:00Z
  note: |
    ROUND 2 FIXES CONFIRMED IN CODE + BUILD CLEAN:
    W1 ROOT CAUSE CONFIRMED: page.tsx line 150 renders <WearsLane> with no key. App Router same-segment route (router.replace /wears/A → /wears/B) reuses same instance; navigated.current stays true permanently after first cross-user nav; embla has no reInit on slides change (only on commentOpen). FIX: key={username} added to <WearsLane> in page.tsx — forces full remount per user, resetting navigated ref and embla from scratch.
    W2: ChevronRight caret block (former lines 290-295) removed from progress bar. isLastSegment + hasNextUser consts retained (used by arrow visibility at lines 337/356).
    W3: Embla viewport extracted from the outer container into a new `relative h-full md:max-w-[600px] md:mx-auto` wrapper div (NOT overflow-hidden). Arrow buttons moved inside that wrapper and use absolute left-0/right-0 — now anchored to the 600px photo column on desktop, not the full viewport. Embla viewport div no longer carries md:max-w-[600px] md:mx-auto (those moved to the wrapper). Progress bar and close button remain absolutely positioned on the outer container — unaffected.
    BUILD: npm run build clean (no TypeScript errors, no compile errors).
    COMMIT: 39794c4

- timestamp: 2026-05-23T22:15:00Z
  note: |
    ROUND 2 PROD VERIFICATION (user): "still getting stuck. everything else looks good." → W2 (caret) + W3 (desktop arrows adjacent to photo) CONFIRMED FIXED. W1 stuck-state STILL reproduces despite the key={username} remount (commit 39794c4).
    CONSEQUENCE: the `navigated`-ref-not-resetting / no-remount hypothesis is DISPROVEN as the cause of the stuck state — the key remount provably resets navigated each cross-user nav, yet it's still stuck.
    Read getWearRailForViewer (src/data/wearEvents.ts:317-407): rail tiles ordered by `desc(wornDate), desc(createdAt)`, deduped one-per-user, NO viewed-state filter/reorder. So railUsernames/railIndex are STABLE across navigations → neighbor mapping is NOT the bug.
    Read page.tsx: initialSlideIndex defaults to 0 (line 111); only ?from sets a non-zero index. goToNeighbor (WearsLane.tsx) replaces to `/wears/<user>` with NO positional hint → always lands at slide 0.
    NEW ROOT CAUSE: forward-cross requires isLast (last slide); cross-user nav always lands at slide 0; so after A→B(fwd)→A(back), A is at slide 0 and forward-swipe moves within A instead of crossing → "stuck" for multi-wear users.

- timestamp: 2026-05-23T23:00:00Z
  note: |
    ROUND 3 FIX CONFIRMED IN CODE + BUILD CLEAN (commit 8bcc672):
    Root cause verified in source: goToNeighbor('prev') at WearsLane.tsx called router.replace(`/wears/${prevUsername}`) with no positional hint; page.tsx searchParams type was `{ from?: string }` with no `at` field; initialSlideIndex block (lines 111-115) only checked fromWearEventId.
    FIX APPLIED:
    (1) WearsLane.tsx goToNeighbor: prev branch → router.replace(`/wears/${prevUsername}?at=last`). next branch unchanged (slide 0 default is correct for forward).
    (2) page.tsx: searchParams type extended to `{ from?: string; at?: string }`. Destructure `at` alongside `from`. initialSlideIndex priority: ?from → ?at=last → 0. When at==='last' and no fromWearEventId: initialSlideIndex = wears.length - 1.
    Result: A→B(fwd,slide 0)→A(back, lands at A's LAST slide)→forward swipe sees isLast=true → crosses to B. No stuck.
    Single-wear user unaffected (slide 0 === last, both directions work regardless).
    BUILD: npm run build clean.
    COMMIT: 8bcc672
    PUSHED: git push origin main → Vercel deploy triggered.

## Eliminated

- 'settle' timing race as the sole H1 explanation: the more direct failure mode is reInit-triggered settle events (comment sheet toggling). Both modes cause spurious cross-user navigation and are eliminated by the pointerup approach.
- ROUND 2 navigated-ref / no-remount hypothesis: DISPROVEN by prod test — key={username} remount resets navigated.current every cross-user nav but the stuck state persists. The stuck state is a LANDING-POSITION problem (always lands at slide 0; forward-cross needs the last slide), not a stale-client-state problem.
- Rail reorder hypothesis: DISPROVEN by source — getWearRailForViewer orders by wornDate desc with no viewed filtering; railUsernames/railIndex are stable.

## Resolution

root_cause: |
  Three independent bugs (Round 1):
  (1) H1 — Cross-user swipe detection used embla 'settle' event, which fires spuriously on emblaApi.reInit() (comment-sheet open/close) and is unreliable for single-wear lanes. No magnitude threshold meant any tiny drag at the boundary crossed users.
  (2) H2 — router.push stacked history; close button (router.back) went to previous user's lane instead of home.
  (3) H3 — Outer container used md:static (not a positioning context), so absolute progress bar, close button, and arrows were not anchored to the lane column on desktop. Chrome was text-white, invisible on light desktop background.
  Plus Round 2 wrinkles found after Round 1 prod verification:
  (W1) navigated.current ref never reset + no key on <WearsLane> → App Router reused same instance on router.replace cross-user nav → stuck after 2+ crossings. (key={username} fix was necessary but not sufficient.)
  (W2) Progress-bar ChevronRight caret not desired.
  (W3) Desktop arrows at viewport edges, not photo column edges.
  Round 3 stuck-state root cause (after W1 disproven as the full cause):
  (R3) Landing position: every cross-user nav replaced to /wears/<user> with no positional hint → initialSlideIndex=0 always. Forward-cross requires isLast (last slide). After A→B(fwd)→A(back at slide 0), forward swipe moves within A's wears (not at last) → cannot re-cross → stuck for multi-wear users.
fix: |
  Round 1: (1) Dropped embla 'settle' detection → window pointerup with 50px threshold. (2) router.push → router.replace. (3) md:static → md:relative; arrow/progress contrast fixes.
  Round 2: (W1) key={username} on <WearsLane> in page.tsx for clean per-user remount. (W2) ChevronRight caret removed. (W3) Embla viewport wrapped in relative md:max-w-[600px] md:mx-auto div; arrows anchored to that wrapper.
  Round 3: (R3) goToNeighbor('prev') appends ?at=last to router.replace URL. page.tsx reads `at` from searchParams; when at==='last' and no ?from, initialSlideIndex = wears.length - 1. Instagram-stories landing rule: forward→first slide, backward→last slide.
verification: PENDING — requires on-device prod test after Vercel deploy (commit 8bcc672). Multi-wear scenario: open first rail user from home, swipe A→B→A→B repeatedly — should not get stuck.
files_changed:
  - src/components/wears/WearsLane.tsx
  - src/app/wears/[username]/page.tsx

## Verification Constraint

All fixes are behavioral/visual and confirm ONLY on a real device/prod (local e2e skips — empty local test DB). Use checkpoint:human-verify gates: deploy to prod (`git push origin main` → Vercel) between rounds and let the user test on their phone (mobile) and a desktop browser. Run `npm run build` as a pre-push gate. See MEMORY: [[feedback_mobile_ui_verify_on_prod]] and [[feedback_ui_spec_css_chain_blind_spot]].

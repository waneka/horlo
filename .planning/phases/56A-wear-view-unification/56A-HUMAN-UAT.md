---
status: partial
phase: 56A-wear-view-unification
source: [56A-VERIFICATION.md]
started: 2026-05-23
updated: 2026-05-23
---

## Current Test

[testing complete — 4/4 core checkpoints passed; 6 gaps captured below for gap-closure (/gsd-plan-phase 56A --gaps). Batch-1 refinements committed but NOT yet pushed — fold into the one gap-closure deploy.]

## Tests

### 1. Stories lane is full-screen with no nav chrome (SC-2)
expected: On a mobile device, opening `/wears/[username]` shows the photo full-bleed with NO bottom nav bar and NO slim top nav; the page fits the viewport with no page scroll.
result: pass
refinement: User requested the 4:5 photo be vertically centered (leftover space split top/bottom instead of pooling at the bottom). Applied `flex flex-col justify-center` to the WearsLane slide (src/components/wears/WearsLane.tsx). Pending re-verify on prod after next push.

### 2. Comment bottom-sheet pauses the swipe (SC-2, D-10/D-11)
expected: On `/wears/[username]`, tapping the comment trigger opens a bottom sheet over the photo showing "No comments yet."; while the sheet is open, horizontal swiping between wears is disabled; closing the sheet re-enables swipe.
result: pass
refinement: Comment trigger icon was hard-coded text-white (invisible on bg-background in light mode; the row renders below the photo, not over the scrim). Changed to text-muted-foreground hover:text-foreground to match the LikeButton heart + detail variant (src/components/wear/WearCard.tsx). Pending re-verify on prod after next push.

### 3. `/wear/[id]` retains nav and scrolls vertically (SC-3)
expected: Opening a `/wear/[id]` permalink directly shows the nav bars (top + bottom), the page scrolls vertically, renders a single wear with the same shared WearCard (photo + like + inline comment section), and has a working back/close affordance.
result: pass
refinement: User disliked the copy/paste-only path to the permalink. (a) Added a "Go to wear post" overflow option that router.push()es to /wear/[id] in-app, gated to the stories lane only (showGoToPost prop; on the detail page you are already there). (b) Added an inline "Copied!" confirmation (Check icon) on "Copy link" that holds the menu open ~900ms before closing (controlled open + closeOnClick={false}). Files: src/components/wear/WearOverflowMenu.tsx, src/components/wear/WearCard.tsx. Pending re-verify on prod after next push.

### 4. Inline comment trigger scrolls to the comment section (SC-3, D-10)
expected: On `/wear/[id]`, tapping the comment trigger smooth-scrolls the page to the inline "Comments" section (`#wear-comments`) showing the "No comments yet." placeholder.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

> UAT batch 2 — surfaced after device testing on prod. Batch 1 (4 refinements) already committed.
> These are scoped for `/gsd-plan-phase 56A --gaps`.

```yaml
- truth: "Swiping past a user's last/first wear on /wears/[username] advances to the next/previous user (D-06, SC-1 user→user)"
  status: failed
  reason: "User reported: swipe traverses within a user's wears but does NOT cross to the next/previous user. Original plan deferred cross-user advance as a 'follow-on seam' (page computes railUsernames but never passes/wires it). This is a genuine unbuilt gap, not a glitch."
  severity: major
  surface: /wears/[username]
  artifacts: [src/app/wears/[username]/page.tsx, src/components/wears/WearsLane.tsx]
  missing: ["pass railUsernames + actor index to WearsLane", "embla boundary detection → router.push to neighbor user's lane"]

- truth: "Tapping the watch brand/model on a wear card links to that watch's detail page (/watch/[watchId]) (D-01)"
  status: failed
  reason: "User reported: clicking the watch info does nothing. brand/model render as plain <span> in WearPhotoOverlays; watchId is threaded into WearCard but discarded (_watchId, code-review IN-01). Avatar/username already links to /u/[username]."
  severity: major
  surface: both routes (shared WearCard / WearPhotoOverlays)
  artifacts: [src/components/wear/WearCard.tsx, src/components/wear/WearDetailHero.tsx]
  missing: ["thread watchId to WearPhotoOverlays", "wrap brand/model in <Link href=/watch/[watchId]>"]

- truth: "The stories lane shows an IG-stories-style progress indicator at the top (which wear of N; hint that the next swipe crosses to another user)"
  status: failed
  reason: "Feature request. Was explicitly DEFERRED in 56A-UI-SPEC (swipe-only lane, no auto-advance timer). User now wants it for sense-of-place. Needs design (segment style, current highlight, boundary 'next user' hint)."
  severity: minor
  surface: /wears/[username]
  artifacts: [src/components/wears/WearsLane.tsx]
  missing: ["top progress segments driven by embla selectedScrollSnap", "cross-user boundary hint (depends on cross-user wiring above)"]

- truth: "On /wears/[username], the close (X) sits in the top-right of the empty band above the centered photo, not overlapping the avatar"
  status: failed
  reason: "User reported: close icon overlaps the user's avatar. With vertical centering there is now empty space above the photo; move close to the top-right corner of that band."
  severity: cosmetic
  surface: /wears/[username]
  artifacts: [src/components/wears/WearsLane.tsx]
  missing: ["move close button from top-3 left-3 → top-3 right-3 (coordinate with progress indicator placement)"]

- truth: "On /wear/[id], the wear photo (and its avatar/username + brand/model overlays) renders on MOBILE"
  status: failed
  reason: "User CLARIFIED on retest: the photo + overlays render correctly on DESKTOP but DO NOT RENDER AT ALL on MOBILE for the same wear post (so 'user/watch info sections missing' = the whole photo+overlay block is collapsed/blank on mobile). Likely a regression from the 56A-04 WearCard refactor. WearPhotoClient (w-full aspect-[4/5]) and the page wrapper (article flex flex-col gap-4 pt-4 → Suspense → WearCard) look correct in static analysis, so suspect a parent layout / global CSS / mobile aspect-ratio collapse — needs a running mobile viewport to diagnose."
  severity: blocker
  surface: /wear/[id] (mobile)
  artifacts: [src/app/wear/[wearEventId]/page.tsx, src/components/wear/WearCard.tsx, src/components/wear/WearPhotoClient.tsx, "route layout.tsx / globals.css (suspected)"]
  missing: ["diagnose mobile-only photo collapse with a running mobile viewport", "fix the CSS chain so aspect-[4/5] renders on mobile (assert the chain explicitly, per the UI-SPEC CSS-chain blind-spot note)"]

- truth: "On /wears/[username] DESKTOP, left/right arrow controls (centered vertically on the photo edges) navigate between wears (desktop has no swipe)"
  status: failed
  reason: "User feature request: mobile swipe is intuitive and fine; desktop has no touch swipe, so add prev/next arrow icons centered vertically on the photo's left/right edges. Should drive embla scrollPrev/scrollNext and (with the cross-user wiring) cross user boundaries too."
  severity: minor
  surface: /wears/[username] (desktop)
  artifacts: [src/components/wears/WearsLane.tsx]
  missing: ["desktop-only (md:) prev/next arrow buttons → emblaApi.scrollPrev()/scrollNext()", "hide on mobile; coordinate with cross-user boundary nav"]
```

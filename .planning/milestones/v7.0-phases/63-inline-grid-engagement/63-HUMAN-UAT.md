---
status: complete
phase: 63-inline-grid-engagement
source: [63-VERIFICATION.md]
started: 2026-05-27T20:28:29Z
updated: 2026-05-27T21:35:09Z
reviewed_decisions:
  - "Open-collection comments (GATE-01): viewer noticed a non-follower can comment on a stranger's COLLECTION. Confirmed this is the designed v6.0 gate (collections open; only wishlists need mutual-follow), not a Phase 63 bug. Delete is author-scoped (own comments only — verified, no IDOR). Decision: KEEP AS DESIGNED (2026-05-27). Tightening would be a new v6.0-gate-model decision beyond Phase 63."
---

## Current Test

[testing complete]

## Tests

### 1. Like chip — optimistic flip + no navigation
expected: Tap ♥ on another user's grid card; heart fills immediately and the count bumps, with NO navigation to /w/[ref].
result: pass
note: verified on prod after R1 chip restyle

### 2. Unlike — silent rollback
expected: Tap the filled ♥ again; heart unfills and the count decrements. Idempotent re-like never raises a user-facing error toast.
result: pass

### 3. Comment chip opens sheet without navigating
expected: Tap 💬 on a card where you have mutual-follow (or a non-wishlist/wear target); the bottom sheet slides up showing the watch identity (thumbnail + brand/model), with NO navigation to /w/[ref].
result: pass

### 4. Post comment via sheet
expected: Type a comment and submit; the sheet closes, the card's 💬 count bumps +1, and a 'Comment posted' toast fires. (On failure: typed text is retained and a failure toast appears.)
result: pass
note: re-verified after G1 fix — submit and close-without-comment both stay on grid (no nav)

### 5. Card body navigation preserved
expected: Tap the image or text region above/around the chips (not on a chip); the card navigates to /w/[ref] as before.
result: pass

### 6. Owner view — no chips
expected: On your OWN profile grid, no ♥/💬 chips and no scrim appear — only the existing static count line. (Owner experience unchanged; no drag-reorder conflict on the wishlist.)
result: pass

### 7. Gated viewer — comment gate enforced per card
expected: As a NON-mutual viewer on another user's WISHLIST grid, the ♥ chip shows but the 💬 chip is hidden entirely (no locked/teaser affordance). Non-wishlist and wear targets stay open.
result: pass

### 8. Navigate-back shows fresh state (D-12 cache-tag bust)
expected: Like a watch, navigate away and back (soft nav); the server-fresh liked state and counts are shown (the viewer:{userId}:counts tag busts so re-hydration is fresh). Verify after the cache has warmed (a cold first read can be a false negative).
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0
notes: 1 issue (G1) + 2 design revisions (R1) found and resolved inline during UAT; re-verified

## Design Revisions (from prod UAT)

### R1 — Chip visual treatment (cosmetic; revises D-01) — RESOLVED, redeployed
reported: "visually it looks bad. remove the grey band at the bottom of the images, the grey circles are enough for legibility. center the heart/chat icons in the circle when there's no count. move them to the bottom right corner of the image. make them smaller, maybe 20% or so"
changes:
  - Removed the full-width `bg-black/55` scrim band at the bottom of the image
  - Each chip now carries its own solid `bg-black/55` circle (photo-independent legibility)
  - No-count state renders a centered icon in a circle (`w-8`); count state expands to a pill (`px-2.5`)
  - Moved chips from bottom-left → bottom-right (`bottom-2 right-2`)
  - Shrunk: chip 44px → 32px (`h-8`), icon 16px → 14px (`size-3.5`)
note: deliberate touch-target reduction below the prior 44px (WCAG 2.5.5) per user request; acceptable for personal app
status: resolved (build exit 0, redeployed for re-verification)

## Gaps

### G1 — Posting/closing the comment sheet navigates to /w/[ref] (major) — RESOLVED, redeployed
test: 4
reported: "on submit, i was immediately routed to the watch detail page - bug. same thing actually happens if i close the comment drawer without leaving one."
root_cause: |
  WatchCommentSheet was rendered as a JSX child of the card-wide <Link>. base-ui's Sheet portals
  its content to document.body (escaping the Link's DOM subtree), BUT React re-dispatches events
  through the REACT tree, not the DOM tree — so clicks on the portaled sheet's Post button / backdrop
  / close X bubbled up the React tree into the <Link>'s onClick and triggered navigation. The chip-open
  path was unaffected because the chip handler calls preventDefault()+stopPropagation(); the sheet's
  internal controls have no such guard.
fix: |
  Moved <WatchCommentSheet> OUTSIDE the <Link> (rendered as a sibling, wrapped the return in a fragment,
  gated on !isOwner). The sheet is no longer a React descendant of the Link, so its portaled clicks no
  longer bubble into Link navigation. (D-02 explicitly permitted restructuring the link boundary.)
status: resolved (build exit 0, redeployed for re-verification)

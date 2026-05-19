---
phase: quick-260519-g4v
plan: 01
subsystem: explore
tags: [css, accessibility, scroll, explore-brands]
requires: []
provides:
  - "Global html scroll-behavior: smooth driving native anchor navigation"
  - "prefers-reduced-motion override for instant-jump fallback"
affects:
  - src/app/globals.css
  - src/app/explore/brands/page.tsx
tech-stack:
  added: []
  patterns:
    - "scroll-behavior lives on the document scroll container (html), not page-level <main>"
    - "prefers-reduced-motion: reduce override co-located with the smooth-scroll rule"
key-files:
  created: []
  modified:
    - src/app/globals.css
    - src/app/explore/brands/page.tsx
decisions:
  - "Used plain CSS scroll-behavior declarations (not @apply scroll-smooth) so the reduced-motion override is co-located and unambiguous"
metrics:
  duration: ~5m
  completed: 2026-05-19
---

# Phase quick-260519-g4v Plan 01: Fix Explore Brands A–Z Letter Anchor Smooth Scroll Summary

Moved `scroll-behavior: smooth` from the inert page-level `<main>` to `<html>` (the real document scroll container) so /explore/brands A–Z letter anchors animate smoothly, with a `prefers-reduced-motion` instant-jump fallback.

## What Was Done

### Task 1: Move scroll-behavior to the html scroll container with a reduced-motion override

- **`src/app/globals.css`** — Inside the existing `@layer base` block, added `scroll-behavior: smooth;` to the existing `html` rule (the one that already had `@apply font-sans;`). Added a sibling `@media (prefers-reduced-motion: reduce)` block setting `html { scroll-behavior: auto; }` so motion-sensitive users get an instant jump.
- **`src/app/explore/brands/page.tsx`** — Removed the now-inert `scroll-smooth` token from the `<main className="...">` (line 47). `<main>` is not a scroll container, so the class never took effect; leaving it would be misleading dead markup. The `scroll-mt-28 md:scroll-mt-32` classes on the `<section>` elements were left untouched — `scroll-margin-top` is correct and required for the sticky-nav offset.
- **Commit:** `8c7543e`

**Why:** Plan 46-06 placed `scroll-smooth` on the page-level `<main>` to satisfy gap G2, but native anchor jumps (`href="#letter-X"`) scroll the document root — and `scroll-behavior` only affects scrolls of the element it is set on. Neither `body` nor any inner `main` sets `overflow`, so `<html>` is the scrolling element. Moving the declaration there makes native hash navigation read the smooth behavior.

## Verification

- Automated verify (Task 1): PASSED — `prefers-reduced-motion` block contains `scroll-behavior: auto`, exactly one `scroll-behavior: smooth` rule present, `scroll-smooth` no longer in `page.tsx`.
- Lint: PASSED — `eslint src/app/explore/brands/page.tsx` produced no errors.

## Deviations from Plan

None - plan executed exactly as written.

## Human Verification

**Task 2 (`checkpoint:human-verify`) — APPROVED by operator (twwaneka@gmail.com) 2026-05-19.** Smooth A–Z anchor scroll on `/explore/brands` confirmed in-browser; deployed to prod (`horlo-4yc86lgns`).

Steps verified:
1. Clear the Turbopack build cache first (project memory: `.next` serves stale CSS): `rm -rf .next` then `npm run dev`.
2. Open `http://localhost:3000/explore/brands`.
3. Scroll down a little, then click a letter near the end of the A–Z jump nav (e.g. "S" or "T").
4. Expected: the page animates smoothly to that letter's section — NOT an instant hard jump. The letter heading should land just below the sticky jump nav, not hidden under it.
5. Click a few more letters, including jumping back up to "A" — each should animate smoothly.
6. Optional reduced-motion check: enable "Reduce motion" in OS accessibility settings (or DevTools → Rendering → Emulate CSS prefers-reduced-motion: reduce), reload, and confirm letter clicks now jump instantly with no animation.

Resume signal: type "approved" if letter clicks scroll smoothly with correct offset, or describe what still looks wrong.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/app/globals.css (modified — `scroll-behavior` rules present)
- FOUND: src/app/explore/brands/page.tsx (modified — `scroll-smooth` removed)
- FOUND: commit 8c7543e

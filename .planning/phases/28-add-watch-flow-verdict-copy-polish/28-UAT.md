---
status: complete
phase: 28-add-watch-flow-verdict-copy-polish
source:
  - 28-01-SUMMARY.md
  - 28-02-SUMMARY.md
  - 28-03-SUMMARY.md
  - 28-04-SUMMARY.md
  - 28-05-SUMMARY.md
started: 2026-05-05T02:40:00.000Z
updated: 2026-05-05T03:30:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Run `npm run dev` from a fresh state. Server boots without errors. Open `/`, `/search`, `/catalog/[any-id]`, and `/watch/new` — each page loads without runtime errors in the browser console or server logs.
result: pass

### 2. Wishlist commit from /search row 3-CTA shows toast with "View" link
expected: On `/search`, expand any catalog row's accordion and click the "Wishlist" CTA. A success toast appears with body "Saved to your wishlist" and a "View" action button. Clicking "View" navigates to `/u/{your-username}/wishlist` and the new watch is visible there.
result: pass

### 3. Wishlist commit from /catalog/[id] 3-CTA shows toast with "View" link
expected: On `/catalog/[any-id]`, click the "Wishlist" CTA. A success toast appears with body "Saved to your wishlist" and a "View" action button. Clicking "View" navigates to `/u/{your-username}/wishlist` with the new watch visible.
result: pass

### 4. Add-Watch Flow with ?returnTo= from /search
expected: From `/search`, click "Add to Collection" on any catalog row. URL becomes `/watch/new?catalogId=...&intent=owned&returnTo=%2Fsearch`. Complete the watch form and submit. After commit, browser navigates back to `/search`. A success toast fires with body "Added to your collection" and a "View" link to `/u/{your-username}/collection`.
result: pass

### 5. Suppress-toast rule when Add-Watch landing matches destination tab
expected: From `/u/{your-username}/wishlist`, click the empty-state or section CTA that links into `/watch/new` with `intent=wishlist` (or any wishlist add path). Complete the wishlist commit. After commit, you land back on `/u/{your-username}/wishlist`. NO toast appears (because the page you landed on equals the toast's destination).
result: pass

### 6. Default destination when ?returnTo= is null
expected: Open `/watch/new` directly (no `?returnTo=` in URL). Complete a wishlist commit. After commit, you are routed to `/u/{your-username}/wishlist` (the default destination derived from the new watch's status). For a collection commit, you would land on `/u/{your-username}/collection`.
result: pass

### 7. Verdict copy reads coherently across all 6 labels
expected: Open `/watch/[any-watch-id]` for watches that produce different similarity labels (or check `/search` accordion verdicts). Each label displays a verb-led description from this set: `core-fit` → "Lines up cleanly with what you already like.", `familiar-territory` → "Sits in territory you've already explored.", `role-duplicate` → "Plays a role you've already filled in your collection.", `taste-expansion` → "Stretches your taste in a direction it's already leaning.", `outlier` → "Stands apart from your collection but doesn't conflict.", `hard-mismatch` → "Conflicts with styles you said you avoid." Each reads coherently and accurately to you as a collector.
result: pass

### 8. Wishlist note auto-fill reads in 1st-person voice
expected: Add a watch to your wishlist that has a strong verdict (e.g., "core-fit" or "taste-expansion"). Open the WishlistRationalePanel (or wherever the note auto-fills). The pre-filled note reads as YOUR OWN statement (e.g., "Lines up cleanly with what I already like." or "My first ${archetype} — fills a real hole in what I own."), NOT a verdict-to-user statement (e.g., "Lines up cleanly with what you already like.").
result: pass

### 9. WishlistRationalePanel hint copy is the new locked string
expected: Below the WishlistRationalePanel textarea, the hint copy reads exactly: "Pre-filled with why this watch fits — written as if you wrote it. Edit to make it yours, or clear it."
result: pass

### 10. /watch/new returnTo open-redirect protection
expected: Manually navigate to `/watch/new?returnTo=//evil.com`. The page renders normally — the malicious value is silently rejected and treated as if no `returnTo` was provided. After completing a commit, you land on the default destination (`/u/{your-username}/{matching-tab}`), NOT on `evil.com`. Repeat with `?returnTo=/watch/new?returnTo=...` (self-loop attack) — should also fall back to default.
result: pass

### 11. Browser back from /watch/new returns to entry point
expected: From `/search`, click "Add to Collection" on any catalog row (URL has `?returnTo=%2Fsearch`). On `/watch/new`, click browser back. You return to `/search`, NOT to `/`.
result: pass

### 12. BottomNav has no Add slot (D-09 phantom)
expected: On mobile (or narrow viewport), the BottomNav at the bottom of the screen does NOT show an "Add a watch" or "+" affordance. The Add-Watch flow is reached only via DesktopTopNav, profile empty-states, /search row, /catalog 3-CTA, WatchPickerDialog (zero-watch home), and AddWatchCard on profile tabs.
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]

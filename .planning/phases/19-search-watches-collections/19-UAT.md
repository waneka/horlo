---
status: complete
phase: 19-search-watches-collections
source: [19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md, 19-04-SUMMARY.md, 19-05-SUMMARY.md, 19-06-SUMMARY.md, 19-VERIFICATION.md]
started: 2026-04-28T17:40:00Z
updated: 2026-04-28T17:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Search Watches tab returns catalog results with thumbnails + badges + Evaluate CTA
expected: Visit /search?tab=watches and type a query (e.g. 'Rolex'). Result rows render with thumbnail (next/image), highlighted brand/model, reference text, Owned/Wishlist pill if applicable, and an inline 'Evaluate' CTA. No <ComingSoonCard>. Footer shows 'Showing top 20'.
result: pass

### 2. Search Collections tab respects two-layer privacy
expected: Visit /search?tab=collections and search for a watch term (e.g. brand name). Only collections from profiles where BOTH profile_public=true AND collection_public=true surface. Your own collection is excluded.
result: pass

### 3. /search?tab=all unions all three sections, capped at 5 each
expected: Visit /search?tab=all with a query that has matches across People/Watches/Collections. All three sections render in order: People → Watches → Collections, each capped at 5 rows max even if more matches exist. Each section shows a 'See all' link that switches to that tab in-place (no full navigation).
result: pass

### 4. Rapid tab-switching while typing does not leak stale results
expected: On /search type a query slowly, then quickly switch from Watches → Collections mid-fetch. Collections section shows fresh results; Watches results do NOT appear in the Collections panel. No flicker of wrong-tab data.
result: pass

### 5. Click 'Evaluate' on a Watch row deep-links to /evaluate
expected: From /search?tab=watches, clicking the inline 'Evaluate' CTA on any result row navigates to /evaluate?catalogId={uuid}. Clicking outside the inline CTA (whole row) navigates to the same target via the absolute-inset Link.
result: pass

### 6. Click 'See all' on a section in All tab switches tab in-place
expected: From /search?tab=all, clicking 'See all' on Watches section switches the tab to Watches without a full page navigation; URL updates to ?tab=watches; results render the full Watches set (up to 20).
result: pass

### 7. Click a Collection row routes to that user's collection
expected: From /search?tab=collections, clicking a result row navigates to /u/{username}/collection.
result: pass

### 8. Empty-state and error copy per tab
expected: Type a nonsense query (e.g. 'zzzqqq') in each of People / Watches / Collections / All tabs. Each tab shows tab-appropriate empty-state copy (no shared 'No results' fallback). On simulated error, error copy is generic (no DB internals leaked).
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none — all tests passed]

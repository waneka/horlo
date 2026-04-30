---
status: complete
phase: 20-collection-fit-surface-polish-verdict-copy
source:
  - 20-01-SUMMARY.md
  - 20-02-SUMMARY.md
  - 20-03-SUMMARY.md
  - 20-04-SUMMARY.md
  - 20-05-SUMMARY.md
  - 20-06-SUMMARY.md
started: 2026-04-30T02:59:59Z
updated: 2026-04-30T03:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Watch Detail — Collection Fit Card (own watch, with collection)
expected: On /watch/[id] for one of your own watches (and you own at least one other watch), a "Collection Fit" card appears in place of the old similarity badge. The card shows an outline label badge (e.g. "Core Fit", "Role Duplicate", "Hard Mismatch"), a headline phrasing line, and zero or more bulleted contextual phrasings beneath it. No "/evaluate" link or old similarity badge remain.
result: pass

### 2. Watch Detail — Empty Collection Hides Card (D-07)
expected: On /watch/[id] when your collection has no other watches (or it's the only watch), no Collection Fit card renders. The page still shows the watch's own details normally.
result: pass

### 3. Search Row — Click Expands Verdict Inline
expected: On /search after a query returns rows, clicking a row toggles an inline accordion panel beneath it. A skeleton briefly shows, then a Collection Fit card renders inside the expanded panel. The chevron / label flips to indicate "open".
result: pass

### 4. Search Row — ESC Collapses Accordion
expected: With a search-row accordion expanded, pressing ESC collapses the panel. The chevron / label returns to its closed state.
result: pass

### 5. Search Row — Re-open Uses Cache (no skeleton flash)
expected: Open a row's verdict, close it, then re-open the same row. The Collection Fit card returns immediately with no skeleton flash (per-mount verdict cache hit).
result: pass

### 6. Catalog Page — Cross-User Verdict
expected: Navigating to /catalog/[catalogId] for a watch you do NOT own renders the catalog watch's details plus a Collection Fit card with cross-user framing (label badge + headline + contextual list). No "self-via-cross-user" callout shown.
result: pass

### 7. Catalog Page — You Own This Callout (D-08)
expected: Navigating to /catalog/[catalogId] for a catalog watch where you DO already own a linked watch renders a "You own this watch" callout with the acquisition date and a "Visit your watch detail" link that points to your per-user /watch/[id]. No verdict card / label badge appears.
result: pass

### 8. Catalog Page — Invalid ID Returns 404
expected: Navigating to /catalog/00000000-0000-0000-0000-000000000000 (a non-existent catalog UUID) returns Next.js 404 (notFound).
result: pass

### 9. Explore Discovery Cards Route to /catalog/[catalogId]
expected: On /explore, clicking a watch card in Trending or Gaining Traction navigates to /catalog/{watch.id} — not /evaluate?catalogId=… and not /watch/[id]. The catalog detail page loads.
result: pass

### 10. /evaluate Route Removed
expected: Navigating to /evaluate (or /evaluate?catalogId=anything) returns Next.js 404. No legacy "Evaluate" page exists.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]

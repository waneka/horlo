---
phase: 43-polish-pass
plan: "02"
subsystem: profile-watch-card
tags: [component, layout, equal-height, wear-suppression]
dependency_graph:
  requires: []
  provides: [ProfileWatchCard-restructured]
  affects: [CollectionTabContent, WishlistTabContent]
tech_stack:
  added: []
  patterns: [h-full flex flex-col equal-height, flex-1 text block, isWishlistLike gate]
key_files:
  created:
    - tests/components/profile/ProfileWatchCard.test.tsx
  modified:
    - src/components/profile/ProfileWatchCard.tsx
decisions:
  - "Used flex-1 on CardContent instead of min-h per RESEARCH.md Pitfall 2: min-h sets a per-card floor and does NOT equalize cards across a grid row; flex-1 on the text block combined with h-full flex flex-col on Card absorbs grid row height uniformly"
  - "aspect-[3/4] placed on image container div only, not on Card — placing aspect on Card breaks equal-height layout (confirmed per UI-SPEC CSS-chain assertion)"
  - "Both wear badge AND last-worn line gated on !isWishlistLike per D-12 — grail watches treated identically to wishlist"
metrics:
  duration_minutes: 1
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 1
  completed_date: "2026-05-17"
---

# Phase 43 Plan 02: ProfileWatchCard Restructure Summary

**One-liner:** `ProfileWatchCard` restructured with brand/model above image, `aspect-[3/4]` on image div, `flex-1` text block for equal-height rows, and `!isWishlistLike` gate suppressing both wear badge and last-worn line on wishlist/grail cards.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restructure ProfileWatchCard layout and gate wear UI | 2334d66 | src/components/profile/ProfileWatchCard.tsx, tests/components/profile/ProfileWatchCard.test.tsx |

---

## Acceptance Criteria Verification

| Criterion | Status |
|-----------|--------|
| `<Card>` has `h-full flex flex-col` and NO `aspect-` class | PASS |
| Image container `<div>` has `aspect-[3/4]` — only element with `aspect-` | PASS |
| `<Image>` has `object-cover` | PASS |
| `<CardContent>` has `flex-1` and NO `min-h-` class | PASS |
| Brand/model `<p>` elements appear in source BEFORE image container | PASS |
| Wear badge JSX and last-worn line both wrapped in `!isWishlistLike` | PASS |
| `npm test -- ProfileWatchCard` — all 5 behavior tests pass | PASS (14/14 tests pass including existing suite) |
| No new TypeScript errors in modified files | PASS |

---

## CSS-Chain Assertions (per UI-SPEC blind-spot flag)

1. `aspect-[3/4]` is on the image `<div>` at line 68, NOT on `<Card>` or `<Link>` — confirmed.
2. `object-cover` is on `<Image className="object-cover">` at line 75 — confirmed.
3. Cards use `h-full flex flex-col` on Card + `flex-1` on CardContent — the correct equal-height CSS chain per RESEARCH.md Pitfall 2. Grid parent (`grid grid-cols-2 gap-4`) uses CSS grid default `align-items: stretch`, which stretches child Link elements to row height, enabling `h-full` on Card to fill that height.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — no hardcoded empty values or placeholder text introduced.

---

## Threat Flags

None — no new trust boundaries introduced. `ProfileWatchCard` is a pure client-side presentational component rendering existing data fields.

---

## Self-Check

- src/components/profile/ProfileWatchCard.tsx: FOUND
- tests/components/profile/ProfileWatchCard.test.tsx: FOUND
- .planning/phases/43-polish-pass/43-02-SUMMARY.md: FOUND
- Commit 2334d66: FOUND

## Self-Check: PASSED

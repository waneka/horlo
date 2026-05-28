---
status: complete
phase: 65-follow-scoped-owners-module
source:
  - 65-01-SUMMARY.md
  - 65-02-SUMMARY.md
  - 65-03-SUMMARY.md
  - 65-03-PLAN.md §how-to-verify (10-step prod checklist — load-bearing)
started: 2026-05-28
updated: 2026-05-28
result: pass (8 passed / 1 skipped / 0 issues)
verdict: APPROVED on prod
---

## Current Test

(complete — all tests resolved)

## Tests

### 1. Vercel deploy live + cache fill wait
expected: Vercel dashboard shows `810b2b48` as the production build; you've waited 2–3 min after deploy completion.
result: pass

### 2. Branch 1 desktop — own watch with followed owners
expected: |
  Visit `/w/<your-watch-id>` (one of your catalog-matched owned watches).
  In the hero right column, order is:
  brand+model → ref + spec → LikeButton + jump-to-comments → "From your circle" module → Last worn → Flag-as-good-deal → Action buttons.
  Chip click navigates to `/u/<their-username>/collection`.
  If you follow zero owners of this catalog, the module is ENTIRELY absent — no header, no placeholder.
result: pass

### 3. Branch 1 cross-user — non-owner view OR null-catalogId
expected: |
  On a non-owned watch URL: right column shows brand+model → spec → like+jump → "From your circle" and NOTHING ELSE (no Last-Worn, no Flag, no Actions).
  On a watch with `catalogId === null` (URL-extracted, never matched): the module is ENTIRELY absent (D-01a hide-if-empty via page-level ternary + component early-return).
result: pass

### 4. Branch 2 pure-catalog — both rosters coexist
expected: |
  Visit a `/w/<catalog-uuid>` URL where you do NOT own this catalog AND at least one stranger does (so the existing OtherOwnersRoster will show them).
  TWO distinct rosters render: the new "From your circle" module sits near the verdict/social-proof block; the existing "X collectors own this" broad roster renders unchanged in its current position.
  Both rosters render on Branch 3 by design (D-03 / D-03a).
result: pass

### 5. Mobile single-column collapse
expected: |
  Mobile viewport (width 375–414 px) OR real device.
  The hero's `lg:grid-cols-[3fr_2fr]` collapses to a single column; the "From your circle" module stacks naturally below the right-column content.
  Chip `min-h-[44px]` tap target is finger-friendly. Long usernames truncate with `…` (no overflow).
  No `lg:hidden` JSX duplication — same DOM at every breakpoint.
result: pass

### 6. Overflow caption ("+N more")
expected: |
  On a catalog with >5 followed owners (may require seeding follows), "and {N} more" plain text appears below the 5 chips.
  On a catalog with ≤5 followed owners, no caption.
  (Acceptable to skip if you don't have a >5-followed-owners catalog handy.)
result: skipped — no >5-followed-owners catalog available in prod data

### 7. Soft-nav PPR safety (#419 regression check)
expected: |
  Soft-nav (click a `<Link>`, do NOT hard-refresh) from home → `/w/[ref]`, profile → `/w/[ref]`, and notifications → `/w/[ref]`.
  No React #419 in the browser console, no 404 on URLs that work on hard refresh.
  Test BOTH a same-user owned watch AND a cross-user catalog ref.
  Repeat 2–3 times from different originating routes.
result: pass — but flagged by user: "we don't need to keep adding this to verify flows" (memory updated to drop #419/PPR/cache-fill from default UAT scripts)

### 8. Owner self-exclusion
expected: |
  On a watch you own where you also follow at least one other collector who owns the same catalog ref:
  YOU do NOT appear in your own "From your circle" chip list (D-05a self-exclusion enforced in the DAL).
  Other followed-owner chips appear normally.
result: pass

### 9. Privacy gate (optional)
expected: |
  If you follow a user whose `profileSettings.profilePublic = false` OR `profileSettings.collectionPublic = false`:
  that user does NOT appear in the chip list even if they own this catalog ref (D-05 — follows do NOT override privacy gates).
  Skip if you don't have a private-profile follow to test against.
result: pass

### 10. Sanity — no other regressions
expected: |
  General poke around `/w/[ref]`: photos still load, like button still toggles, comments tab still works, navigation chrome unchanged. Nothing else broken by this phase.
result: pass

## Summary

total: 10
passed: 9
issues: 0
pending: 0
skipped: 1

## Gaps

[none yet]

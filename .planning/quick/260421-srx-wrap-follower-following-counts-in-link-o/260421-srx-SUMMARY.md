---
task: 260421-srx
type: quick
completed: 2026-04-21
duration: ~10 min
commits:
  - 3919d9e
files-modified:
  - src/components/profile/ProfileHeader.tsx
  - src/components/profile/LockedProfileState.tsx
files-created: []
---

# Quick Task 260421-srx: Wrap follower/following counts in Link

Made the follower and following counts on the profile header navigable by
wrapping them in `next/link` so they route to the existing list pages
(`/u/[username]/followers`, `/u/[username]/following`).

## What Changed

**`src/components/profile/ProfileHeader.tsx`**
- Added `import Link from 'next/link'`.
- Replaced the plain-text stats paragraph at line 70 with a version where
  `{N} followers` and `{N} following` are each wrapped in `<Link>` with
  `hover:underline`. `watches` and `wishlist` counts remain plain text
  (they are derived stats, not lists).

**`src/components/profile/LockedProfileState.tsx`**
- Added `import Link from 'next/link'`.
- Applied the same wrapping to line 39 (`{N} followers · {N} following`).

## Why

Phase 9 UAT Test 3 reported: "the following/followers counts are not
clickable." The list pages already existed at
`src/app/u/[username]/followers/page.tsx` and
`src/app/u/[username]/following/page.tsx`; only the entrypoint affordance
was missing.

## Design Choice

- Used `hover:underline` (no color change) as the affordance. Kept text
  color as `text-muted-foreground` — the underline-on-hover is sufficient
  discoverability without introducing a new visual priority on the
  header.
- Did NOT link `watches` or `wishlist` counts. Those are summary stats,
  not navigable lists in the current IA.
- Kept the ` · ` separators as plain text between the Links.

## Validation

- `npx vitest run tests/components/profile` — **72/72 passed**, including
  the 5 LockedProfileState tests. The existing regex-based assertions
  (`/5 followers/`, `/7 following/`) still match because the accessible
  text content is preserved inside the Link children.
- `npm run build` — passes, all 20 routes generated, TypeScript clean.
- `npm run lint` — zero new errors/warnings in the two modified files
  (pre-existing issues in `tests/proxy.test.ts` and `tests/setup.ts` are
  out of scope).

## Deviations from Plan

None. Plan executed exactly as written.

## Self-Check: PASSED

- `src/components/profile/ProfileHeader.tsx` — FOUND
- `src/components/profile/LockedProfileState.tsx` — FOUND
- Commit `3919d9e` — FOUND in `git log`

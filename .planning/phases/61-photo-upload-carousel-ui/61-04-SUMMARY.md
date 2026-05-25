---
phase: 61-photo-upload-carousel-ui
plan: "04"
subsystem: watch-photos-cover-signing
tags: [signed-urls, server-only, rsc, cover-thumbnails, batch-helper]
dependency_graph:
  requires: [61-02]
  provides: [signCoverUrls, signed-cover-thumbnails-across-grids]
  affects:
    - src/app/page.tsx
    - src/app/u/[username]/[tab]/page.tsx
    - src/app/u/[username]/profile-shell-resolver.tsx
    - src/app/search/page.tsx
tech_stack:
  added: []
  patterns: [batch-signed-url-helper, server-only-guard, de-duped-Promise.all-signing]
key_files:
  created:
    - src/lib/storage/signCoverUrls.ts
    - tests/lib/signCoverUrls.test.ts
  modified:
    - src/app/page.tsx
    - src/app/u/[username]/[tab]/page.tsx
    - src/app/u/[username]/profile-shell-resolver.tsx
    - src/app/search/page.tsx
decisions:
  - "signCoverUrls calls createSupabaseServerClient (cookie-based) so it CANNOT be called inside a 'use cache' scope — wrapper resolveProfileShellSigned added outside cached scope in profile-shell-resolver.tsx; [tab]/page.tsx signs ownerWatches after resolver returns"
  - "Signing with viewer session returns null for another user's files (storage RLS scopes SELECT to file owner folder) — getSafeImageUrl in card components handles null gracefully with placeholder"
  - "De-dupe distinct raw paths to a single createSignedUrl call per path — avoids redundant Supabase API calls when multiple watches share the same cover photo"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-25T21:17:00Z"
  tasks_completed: 2
  files_changed: 6
---

# Phase 61 Plan 04: signCoverUrls + Grid Cover Thumbnails Summary

**One-liner:** Server-only `signCoverUrls` batch helper signs raw watch-photos storage paths into 60-min https URLs, wired into home, profile-tab, profile-shell-resolver, and search RSCs so drag-to-first-position cover changes appear as card thumbnails across all grids (PHOTO-05 SC3).

## What Was Built

### signCoverUrls batch helper (`src/lib/storage/signCoverUrls.ts`)

- Generic `async function signCoverUrls<T extends { imageUrl?: string | null }>(watches: T[]): Promise<T[]>`
- Discriminates raw paths vs https URLs by calling `getSafeImageUrl` — if it returns null, the value is a raw storage path needing signing
- De-dupes distinct raw paths into a single `Promise.all` batch (one Supabase client instance)
- Signs via `supabase.storage.from('watch-photos').createSignedUrl(path, 3600)` — 60-min TTL matching wear-photos and Plan 02 detail-page precedent
- Signing failure yields `imageUrl: null` rather than throwing
- Never mutates input; always returns new array with new watch objects
- `import 'server-only'` guard prevents client bundle import

### Unit test (`tests/lib/signCoverUrls.test.ts`)

7 tests across 5 cases:
- (a) raw path → signed url
- (b) https catalog url → passes through, createSignedUrl NOT called
- (c) null → null, undefined → undefined passthrough
- (d) batch with de-dupe: two watches sharing the same raw path get one createSignedUrl call
- (e) signing failure (`{ data: null }`) → imageUrl null, no throw
- Plus: immutability check (input array/objects not mutated)

All 7 tests pass; `vi.hoisted()` used for Supabase mock (established Phase 61 Plan 01 pattern).

### RSC wiring (4 files)

**`src/app/page.tsx`** — signs viewer's own watches after `getWatchesByUser(user.id)` fetch. Home page viewer IS the owner; their session can sign their own files.

**`src/app/u/[username]/[tab]/page.tsx`** — signs `ownerWatches` after `ProfileShellResolver` resolves. For owner-viewing-own-profile: signing works. For non-owner viewer: signing silently returns null (storage RLS folder check fails for non-owner); cards show placeholder (same as current unsigned behavior).

**`src/app/u/[username]/profile-shell-resolver.tsx`** — imports `signCoverUrls`; adds `resolveProfileShellSigned` wrapper function OUTSIDE the `'use cache'` scope. The wrapper calls the cached resolver then signs watches. The cached `ProfileShellResolver` remains unchanged.

**`src/app/search/page.tsx`** — signs `viewerCollection` (viewer's own watches) after fetch. Only `.length` is passed to `SearchPageClient` as `collectionRevision`, but the watches are signed for correctness and consistency.

### What does NOT change

- `WatchCard`, `ProfileWatchCard`, `StatsTabContent`, `NoteRow`, `WornTimeline`, `WornCalendar` — these already consume `watch.imageUrl` via `getSafeImageUrl`; they now receive signed https urls and render correctly with no modifications.
- The DAL (`src/data/watches.ts`) remains admin-client-free — raw storage paths returned from the DB; signing happens only at RSC layer.

## Deviations from Plan

### Architectural clarification (not a deviation)

**Context:** The plan listed `profile-shell-resolver.tsx` as a target for `signCoverUrls`. The file uses `'use cache'` with `cacheLife(300s)`, and `createSupabaseServerClient()` calls `cookies()` — unavailable in cached scope.

**Resolution:** Added `resolveProfileShellSigned` as a wrapper function OUTSIDE the cached scope (after the `ProfileShellResolver` function definition). This satisfies the plan's intent — `signCoverUrls` lives in `profile-shell-resolver.tsx` and is available to callers who need pre-signed watches. The actual signing at `[tab]/page.tsx` happens via the direct `await signCoverUrls(resolved.watches)` call after the resolver returns.

This is consistent with the plan's explicit statement: "In `u/[username]/[tab]/page.tsx` sign the profile collection/wishlist/worn watch lists fed to the tab grids."

## Known Stubs

None.

## Threat Surface Scan

No new threat surface beyond what the plan's `<threat_model>` already registered:
- T-61-16 (viewer's grid signs another user's cover): mitigated — viewer session only signs files the viewer owns; other files return null ✓
- T-61-17 (raw storage path in client markup): mitigated — unsigned paths yield null via getSafeImageUrl (placeholder, no path in `src`) ✓
- T-61-18 (signed URL TTL): accepted — 60-min TTL, dynamic routes, no ISR ✓
- T-61-19 (client bundle gaining service-role storage via signCoverUrls): mitigated — `import 'server-only'` guard ✓

## Self-Check: PASSED

Files exist:
- FOUND: src/lib/storage/signCoverUrls.ts
- FOUND: tests/lib/signCoverUrls.test.ts

Commits exist:
- 2db8790: test(61-04) RED — failing tests for signCoverUrls
- 8b9fdf9: feat(61-04) GREEN — signCoverUrls implementation (7/7 tests pass)
- 91acf56: feat(61-04) — wire signCoverUrls into 4 RSCs

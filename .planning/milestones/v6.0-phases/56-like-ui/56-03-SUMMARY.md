---
phase: 56-like-ui
plan: "03"
subsystem: wear-detail
status: complete
tags: [likes, wear-detail, css-overlay, photo-overlays, anon-allowed]
dependency_graph:
  requires:
    - "56-01 (LikeButton + getLikesForTargetCached)"
  provides:
    - "Wear detail redesign with photo overlays (D-05/06/07/08)"
    - "LikeButton at /wear/[wearEventId] for anon+auth viewers (LIKE-02, LIKE-04)"
  affects:
    - "src/components/wear/WearDetailHero.tsx"
    - "src/components/wear/WearPhotoClient.tsx"
    - "src/components/wear/WearDetailMetadata.tsx"
    - "src/app/wear/[wearEventId]/page.tsx"
tech_stack:
  added: []
  patterns:
    - "Shared overlay sub-component (WearPhotoOverlays) co-located in WearDetailHero.tsx, imported by WearPhotoClient.tsx"
    - "hasPhoto boolean prop for text-foreground vs text-white on muted fallback (D-08)"
    - "Anon sentinel '__anon__' for getLikesForTargetCached on anon-allowed route"
key_files:
  created: []
  modified:
    - "src/components/wear/WearDetailHero.tsx"
    - "src/components/wear/WearPhotoClient.tsx"
    - "src/components/wear/WearDetailMetadata.tsx"
    - "src/app/wear/[wearEventId]/page.tsx"
decisions:
  - "WearPhotoOverlays extracted as a named export from WearDetailHero.tsx and imported by WearPhotoClient.tsx to avoid 40-line duplication across two photo surfaces"
  - "AvatarDisplay size={40} used in overlay (size=32 is not valid per AvatarDisplay contract; plan confirmed size={40})"
  - "Signed-URL happy-path container in WearPhotoClient.tsx preserves 'relative' at end of class string (original position) — not modified to avoid accidental double-apply"
  - "Anon sentinel '__anon__' defined as const ANON_SENTINEL in the page (not in reactions.ts) per PATTERNS.md recommendation"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-05-23"
  tasks_completed: 2
  files_modified: 4
---

# Phase 56 Plan 03: Wear Detail Redesign + Like UI Summary

Wear detail page redesigned with photo overlays (collector identity top-left, brand/model bottom-left), WearDetailMetadata gutted to note-only caption, footer action row with LikeButton (anon-allowed), and all 4 missing `relative` callsites patched.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Photo overlays + 4 `relative` callsites + gut WearDetailMetadata | 02550a6 | WearDetailHero.tsx, WearPhotoClient.tsx, WearDetailMetadata.tsx |
| 2 | Rewire wear page — anon-guarded hydration, overlay props threading, footer action row | 565b6d8 | src/app/wear/[wearEventId]/page.tsx |

## What Was Built

### Task 1: WearPhotoOverlays + Photo Container Fixes

**WearPhotoOverlays** (exported from `WearDetailHero.tsx`, imported by `WearPhotoClient.tsx`):
- Top overlay: `absolute inset-x-0 top-0 z-10 pointer-events-none` with `linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 40%)` scrim. Content: AvatarDisplay (size=40) + linked username + `·` separator + timeAgo timestamp.
- Bottom overlay: `absolute inset-x-0 bottom-0 z-10 pointer-events-none` with `linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 40%)` scrim. Content: brand (font-semibold) + model.
- `hasPhoto` prop: `text-white` on photo paths, `text-foreground` on `bg-muted` no-photo fallback (D-08).

**4 `relative` callsites patched:**
- `WearDetailHero.tsx` ~L33 (watchImageUrl path): `relative` added, overlays rendered.
- `WearDetailHero.tsx` ~L46 (no-photo fallback): `relative` added, centered `{brand} {model}` removed, overlays rendered.
- `WearPhotoClient.tsx` ~L68 (failed + watchImageUrl): `relative` added, overlays rendered.
- `WearPhotoClient.tsx` ~L81 (failed + no-photo): `relative` added, centered text removed, overlays rendered.
- `WearPhotoClient.tsx` ~L94 (signed-URL happy path): ALREADY HAD `relative` — not touched/duplicated. Overlays added after the `<img>`.

**WearDetailMetadata** gutted to `export function WearDetailMetadata({ note }: { note: string | null })`. Returns `null` when note is absent, otherwise `<p className="text-sm text-foreground whitespace-pre-wrap px-4 pt-3 md:max-w-[600px] md:mx-auto">`.

### Task 2: Wear Page Rewire

- `getLikesForTargetCached` import added; `const ANON_SENTINEL = '__anon__'` used for null-viewerId path.
- `WearPhotoStreamed` receives `username`, `displayName`, `avatarUrl`, `createdAt` and forwards to both `WearPhotoClient` and `WearDetailHero`.
- `WearDetailMetadata` callsite updated to pass only `note={wear.note}`.
- Footer action row added as last child of `<article>`:
  - Left: `<div className="flex-1 min-h-[44px]" aria-hidden />` — reserved for Phase 57 comment input.
  - Right: `<LikeButton viewerId={viewerId} target={{ type: 'wear', id: wearEventId }} initialLiked={likeState.viewerHasLiked} initialCount={likeState.count} />`.

## Structural Verification

```
All 5 aspect-[4/5] containers include 'relative':
  WearPhotoClient.tsx:81  — relative w-full aspect-[4/5] ... (failed+watchImageUrl, patched)
  WearPhotoClient.tsx:103 — relative w-full aspect-[4/5] ... (failed+no-photo, patched)
  WearPhotoClient.tsx:123 — w-full aspect-[4/5] ... relative (signed-URL happy path, already had it)
  WearDetailHero.tsx:135  — relative w-full aspect-[4/5] ... (watchImageUrl path, patched)
  WearDetailHero.tsx:157  — relative w-full aspect-[4/5] ... (no-photo fallback, patched)

grep -c wear_event: 0 across all 4 touched files
npx tsc --noEmit: no errors in the 4 touched src/ files
  (pre-existing test file errors in tests/ and src/components/watch/*.test.tsx are unrelated)
```

## Deviations from Plan

None. Plan executed exactly as written.

The plan noted that `size={32}` in the overlay would be invalid (AvatarDisplay only accepts 40|64|96). Used `size={40}` throughout. The PATTERNS.md also referenced `size={32}` in the overlay markup sample — this was treated as a documentation discrepancy vs. the PLAN.md's explicit instruction to use `size={40}`.

## Known Stubs

None. The LikeButton renders live data via `getLikesForTargetCached`. The reserved comment slot (`flex-1 min-h-[44px]` div) is intentionally empty — Phase 57 will wire the comment input into this slot without re-layout. This is documented design intent, not a stub.

## Manual Verification Required

Per the plan's verification section and the Phase-30-class CSS-chain blind spot memo, visual verification must be done manually after clearing `.next/` cache:

```bash
rm -rf .next && npm run dev
```

Steps:
1. Visit a wear page WITH a signed photo: avatar + username + timestamp render top-left and brand/model bottom-left over scrims; photo at 4:5; footer heart at the right toggles and count hides at zero.
2. Visit a wear page on the no-photo `bg-muted` fallback: SAME overlays render with `text-foreground`; old centered `{brand} {model}` text is gone.
3. Logged out: heart + count visible; click bounces to `/login?next=`.

This is documented as a MANDATORY post-merge step, not something that can be completed headlessly.

## Threat Flags

No new security-relevant surface introduced. The overlay renders data already authorized by `getWearEventByIdForViewer` (which 404s on denied wears). The anon sentinel pattern is within the established T-56-07 acceptance (shared `viewer:__anon__:reactions` cache entry holds only the public count; `viewerHasLiked` is always false for anon).

## Self-Check

Files created/modified:
- [x] `src/components/wear/WearDetailHero.tsx` — exists, contains `WearPhotoOverlays` export and `relative` on both containers
- [x] `src/components/wear/WearPhotoClient.tsx` — exists, imports `WearPhotoOverlays`, `relative` on 2 patched containers
- [x] `src/components/wear/WearDetailMetadata.tsx` — exists, note-only signature
- [x] `src/app/wear/[wearEventId]/page.tsx` — exists, contains `getLikesForTargetCached`, footer row, overlay props

Commits:
- [x] 02550a6 — feat(56-03): photo overlays + 4 relative callsites + gut WearDetailMetadata
- [x] 565b6d8 — feat(56-03): rewire wear page — anon hydration, overlay props, footer like row

## Self-Check: PASSED

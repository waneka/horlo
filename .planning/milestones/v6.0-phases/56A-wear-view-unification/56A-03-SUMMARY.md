---
phase: 56A-wear-view-unification
plan: "03"
subsystem: wear-view
status: complete
tags: [stories-lane, embla-carousel, server-page, signed-urls, auth, wishlist]
dependency_graph:
  requires: ["56A-01", "56A-02"]
  provides: ["/wears/[username] route", "WearsLane component", "WearSlide type"]
  affects: ["src/components/wears/", "src/app/wears/"]
tech_stack:
  added: []
  patterns:
    - embla-carousel-react startIndex + reInit watchDrag
    - per-request signed URL minting (Promise.all page level, Pitfall F-2)
    - Next.js 16 async params/searchParams
    - redirect() outside try/catch (NEXT_REDIRECT)
key_files:
  created:
    - src/components/wears/WearsLane.tsx
    - src/app/wears/[username]/page.tsx
  modified: []
decisions:
  - "WearSlide type defined and exported from WearsLane.tsx (canonical location); page imports from @/components/wears/WearsLane"
  - "Signed URLs minted at page level via Promise.all (not in Suspense child) — page is uncached so F-2 is satisfied; mirrors src/app/page.tsx bulk-sign pattern"
  - "railUsernames seam included in page but cross-user advance deferred (as specified in plan)"
metrics:
  duration: ~12m
  completed: "2026-05-23"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 56A Plan 03: WearsLane + Route Summary

**One-liner:** Full-screen embla carousel route `/wears/[username]` with `WearsLane` client component, per-request signed URLs, auth-only gate, D-07 redirect, and per-wear wishlist applicability.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | WearsLane client carousel | d58dcd3 | src/components/wears/WearsLane.tsx |
| 2 | /wears/[username] server page | 795c464 | src/app/wears/[username]/page.tsx |

## What Was Built

### Task 1 — WearsLane client carousel (`d58dcd3`)

Created `src/components/wears/WearsLane.tsx` as a `'use client'` component:

- Exports `WearSlide` interface (canonical type location; page imports from here)
- `getEmblaDuration()` copied verbatim from WywtOverlay.tsx lines 35-44 (prefers-reduced-motion aware)
- Embla carousel initialized with `startIndex` clamped to `slides.length - 1`
- Swipe paused on comment open via `emblaApi.reInit({ watchDrag: !commentOpen })` (D-10/D-11)
- `onSelect → markViewed` effect mirrors WywtOverlay; fires once for initial slide (D-05)
- Full-screen mobile: `fixed inset-0 h-dvh overflow-hidden`; centered 600px desktop: `md:static md:inset-auto md:h-auto md:overflow-visible md:max-w-[600px] md:mx-auto` (SC-2, UI-SPEC §7)
- Top-left X close affordance: `absolute top-3 left-3 z-20 min-h-[44px] min-w-[44px] text-white`, calls `router.back()` (UI-SPEC §4)
- Renders `<WearCard>` per slide with `commentHostVariant="bottom-sheet"` and `onCommentOpenChange={setCommentOpen}`

### Task 2 — /wears/[username] server page (`795c464`)

Created `src/app/wears/[username]/page.tsx`:

- Next.js 16 async params/searchParams pattern (`Promise<{ username: string }>`)
- Auth-only (EN-6): `getCurrentUser()` with no try/catch; proxy handles anon → /login
- Actor resolved via `getProfileByUsername(username)` → `notFound()` on null
- Active wears via `getActiveWearsForUser(viewerId, actor.id)`
- D-07: `redirect(/u/${username})` when `wears.length === 0` — outside any try/catch (NEXT_REDIRECT)
- `initialSlideIndex` from `?from` param (T-56A-07: IDOR-safe — lookup within already-gated wears); defaults to 0
- D-06/Pitfall 3: fresh `getWearRailForViewer(viewerId)` for server-side user order; cross-user advance seam included
- Signed URLs: `Promise.all(wears.map(...createSignedUrl(w.photoUrl, 60*60)))` at page level (Pitfall F-2, mirrors src/app/page.tsx)
- D-09 wishlist gate: `showAddToWishlist = w.userId !== viewerId && !viewerHasWatch(w.brand, w.model)` — case-insensitive brand+model match against viewer's owned/wishlist watches (catalog-id-divergence)
- Per-wear like state via `getLikesForTargetCached`
- Builds `WearSlide[]` and renders `<Suspense fallback={<PhotoSkeleton />}><WearsLane .../></Suspense>`

## Verification

- `npx tsc --noEmit` — 0 errors referencing WearsLane or WearsPage
- `npm run test -- phase56a-wears-lane` — 3/4 tests pass; SC-5 (WywtOverlay removal) remains RED as specified ("EXPECTED RED until Plan 05")
- `npm run build` — build succeeds; `/wears/[username]` route appears in page manifest with PPR symbol
- `grep -n "redirect(" src/app/wears/[username]/page.tsx` — redirect is NOT inside try/catch (line 59)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `WearCommentHost` placeholder content ("No comments yet.") — intentional, Phase 57 wires real comments
- `railUsernames` variable is populated but not yet passed to `WearsLane` for cross-user advance — intentional seam left as plan specifies ("Cross-user advance wiring can be a thin follow")

## Threat Surface Scan

No new threat surface beyond what is documented in the plan's `<threat_model>`:
- T-56A-07 (IDOR via `?from`): mitigated — index lookup within gated wears only
- T-56A-08 (username enumeration): mitigated — notFound() vs redirect() matches /u/* existing behavior
- T-56A-09 (signed URL caching): mitigated — minted per-request in uncached page body

## Self-Check: PASSED

- `src/components/wears/WearsLane.tsx` — FOUND
- `src/app/wears/[username]/page.tsx` — FOUND
- Commit d58dcd3 (WearsLane) — FOUND
- Commit 795c464 (server page) — FOUND
- Build: PASSED
- Tests: 3/4 (SC-5 expected RED until Plan 05)

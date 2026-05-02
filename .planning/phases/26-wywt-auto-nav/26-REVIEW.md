---
phase: 26
status: issues
findings_count: 3
high_severity: 0
medium_severity: 2
low_severity: 1
date: 2026-05-02
---

# Phase 26: Code Review Report

**Reviewed:** 2026-05-02T00:00:00Z
**Depth:** deep
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed all five files changed in Phase 26 (WYWT Auto-Nav): `PhotoSkeleton.tsx` (new), `WearPhotoClient.tsx` (new), `page.tsx` (modified), `WearDetailHero.tsx` (modified), `ComposeStep.tsx` (modified).

The critical locked decisions (D-01 through D-07) are largely honored. `router.push` fires after both `await` calls resolve and before `onSubmitted()` (D-07 ordering correct). `toast.success` and the `sonner` import are fully removed (D-03 satisfied). No `next/image` usage in any photo render path (D-06 satisfied). Signed URL minted in the streamed server child with no `'use cache'` or `unstable_cache` wrapper (D-05 satisfied). Query-string construction for retries correctly checks for an existing `?` before choosing `&` vs `?` — Supabase signed URLs always carry query params, so this matters.

Two medium issues were found: a missing `setTimeout` cleanup that will cause observable incorrect behavior in React StrictMode development mode, and a mobile border-radius mismatch between `PhotoSkeleton` and the actual hero that violates the D-01 "zero CLS" contract. One low-severity accessibility gap rounds out the findings.

---

## Medium Issues

### MD-01: Missing `setTimeout` cleanup in `WearPhotoClient` — dangling timer on unmount

**File:** `src/components/wear/WearPhotoClient.tsx:97-105`

**Issue:** The `onError` handler schedules a 300ms `setTimeout` that calls `setRetryCount`. There is no `useEffect` cleanup to cancel this timer if the component unmounts before the timer fires. In React StrictMode (which Next.js enables by default when `reactStrictMode` is not explicitly disabled), components intentionally unmount and remount during development to surface exactly this class of bug. The sequence:

1. First mount — img errors — `setTimeout` queued (timer A)
2. StrictMode unmounts the component synchronously
3. StrictMode remounts — new component instance is now live with `retryCount = 0`
4. 300ms elapses — timer A fires against the **second mount** — `setRetryCount(n => n + 1)` increments the second mount's `retryCount` to 1
5. The img's `src` switches to `?retry=1` spuriously, even though no error has been observed on the second mount

In production (StrictMode off), the risk is lower: the timer fires on an unmounted component, which React 18 silently ignores. However, if the user navigates away within 300ms of an error (plausible — the page is new and the navigation UX is quick), the timer still fires and executes the functional state update against a ghost component. The event loop still holds the timer handle; it is not garbage-collected until it fires.

**Fix:** Capture the timer ID and cancel it in a `useEffect` cleanup. Replace the inline `setTimeout` in `onError` with a ref-stored ID:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { PhotoSkeleton } from './PhotoSkeleton'

// ... (constants unchanged)

export function WearPhotoClient({ signedUrl, altText, watchImageUrl, brand, model }: { ... }) {
  const [status, setStatus] = useState<'pending' | 'loaded' | 'failed'>('pending')
  const [retryCount, setRetryCount] = useState(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cancel any in-flight retry timer on unmount.
  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current)
      }
    }
  }, [])

  // ... (early return for 'failed' unchanged)

  return (
    // ...
    <img
      // ...
      onError={() => {
        if (retryCount >= MAX_RETRIES) {
          setStatus('failed')
          return
        }
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null
          setRetryCount((n) => n + 1)
        }, RETRY_DELAY_MS)
      }}
    />
    // ...
  )
}
```

---

### MD-02: `PhotoSkeleton` base class applies `rounded-md` on mobile — violates D-01 zero-CLS contract

**File:** `src/components/wear/PhotoSkeleton.tsx:11`

**Issue:** The shadcn `<Skeleton>` primitive composes its own classes via `cn('animate-pulse rounded-md bg-muted', className)`. The `rounded-md` is always applied regardless of breakpoint. `PhotoSkeleton` passes only:

```
w-full aspect-[4/5] md:rounded-lg md:max-w-[600px] md:mx-auto
```

There is no `rounded-none` override for mobile. Since `tailwind-merge` preserves both `rounded-md` (from base) and `md:rounded-lg` (from the override — different breakpoint, no conflict), the resolved output on mobile is `rounded-md`.

The actual hero container — in both `WearDetailHero.tsx:33` and `WearPhotoClient.tsx:84` — uses `md:rounded-lg` only, with no rounding class for mobile, meaning the hero is full-bleed (square edges) on mobile screens.

Result: the skeleton shows rounded corners on mobile, then the image lands with square/full-bleed edges. This is a visible layout discontinuity on the most common viewport. D-01 states: *"Dimensions match WearDetailHero exactly so there's zero cumulative layout shift when the image lands."* The corner radius mismatch is a direct violation of the "match exactly" requirement.

**Fix:** Override the base `rounded-md` explicitly:

```tsx
export function PhotoSkeleton() {
  return (
    <Skeleton className="w-full aspect-[4/5] rounded-none md:rounded-lg md:max-w-[600px] md:mx-auto" />
  )
}
```

`tailwind-merge` will resolve `rounded-md` vs `rounded-none` in favor of `rounded-none` (later in the merged string wins), and `md:rounded-lg` applies at the breakpoint. This matches the hero exactly.

---

## Low Issues

### LW-01: `PhotoSkeleton` has no ARIA loading role — invisible to screen readers

**File:** `src/components/wear/PhotoSkeleton.tsx:9-13`

**Issue:** The `<Skeleton>` base spreads `...props`, so ARIA attributes can be passed through, but `PhotoSkeleton` passes none. When the Suspense fallback renders the skeleton, screen-reader users receive no indication that a photo is loading. The Suspense boundary itself does not emit any ARIA announcement. Users relying on assistive technology will perceive a blank space where the photo will be.

**Fix:** Add `role="status"` and `aria-label` to communicate the loading state:

```tsx
export function PhotoSkeleton() {
  return (
    <Skeleton
      className="w-full aspect-[4/5] rounded-none md:rounded-lg md:max-w-[600px] md:mx-auto"
      role="status"
      aria-label="Loading photo…"
    />
  )
}
```

---

## Decisions Verified Clean

| Decision | Verdict |
|----------|---------|
| D-01: PhotoSkeleton class string exact match | **PARTIAL FAIL** — `rounded-none` missing on mobile (see MD-02) |
| D-02: 3 retries at ~300ms, `?retry=N` append | **PASS** — count correct (retryCount 0→1→2→3, fails on 4th error); query-string append handles existing `?` correctly |
| D-03: `toast.success` removed; `sonner` import removed | **PASS** — neither appears in `ComposeStep.tsx` |
| D-04: `router.push` (not replace) | **PASS** — line 277 |
| D-05: Signed URL never cached | **PASS** — `WearPhotoStreamed` has no `'use cache'`, no `unstable_cache`; `cacheComponents: true` in `next.config.ts` only applies to explicit `'use cache'` directives |
| D-06: Native `<img>`, not `next/image` | **PASS** — all photo render paths use native `<img>` with the ESLint suppression comment |
| D-07: `router.push` fires after both `await`s, before `onSubmitted()` | **PASS** — line ordering: upload (line 255) → logWearWithPhoto (line 261) → router.push (line 277) → onSubmitted (line 278) |

---

_Reviewed: 2026-05-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

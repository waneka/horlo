# Phase 15: WYWT Photo Post Flow — Research

**Researched:** 2026-04-24
**Domain:** getUserMedia camera capture, client-side image processing (HEIC → JPEG, EXIF strip, canvas resize), Supabase Storage client-direct upload, Next.js 16 Server Actions, Sonner toast integration, three-tier visibility gating on a detail route.
**Confidence:** HIGH for codebase anchors and Supabase Storage patterns (already shipped in Phase 11), HIGH for Sonner placement and iOS getUserMedia gesture rule, MEDIUM for EXIF-orientation library choice (the UI-SPEC's current assumption is not safe at iOS Safari 15.0), MEDIUM for Web-Worker heic2any wiring under Turbopack (no shipped reference in this repo yet).

## Summary

Phase 15 is the last v3.0 user-facing phase. It composes three already-built foundations — Phase 11 Storage + RLS, Phase 12 visibility ripple, Phase 14 nav + modal shell — into the two-step WYWT post flow, one new Server Action, one new DAL function, one new route, and one Sonner wrapper. **No schema changes.** No new migrations. The novelty is in the browser: `getUserMedia`, canvas re-encode, HEIC conversion in a Web Worker, and client-direct upload to an already-provisioned bucket with already-shipped RLS.

The biggest load-bearing decisions are (1) resolve the EXIF-orientation research flag — the UI-SPEC currently assumes `createImageBitmap({imageOrientation: 'from-image'})` works on iOS Safari 15+ which is **unsafe** (WebKit only landed that fix in Aug 2022, shipped in Safari 16.4); (2) a Web Worker boundary for `heic2any` that survives Turbopack static analysis (repo is on Next 16.2.3 with `cacheComponents: true` and uses Turbopack dev); (3) signed-URL freshness discipline on `/wear/[wearEventId]` — Supabase Smart CDN treats each signed URL token as a separate cache key, so minting per-request is both free and correct.

**Primary recommendation:** Use `createImageBitmap(blob, { imageOrientation: 'from-image' })` as the default orientation path (HIGH confidence on iOS Safari 16.4+, ~91% of target users) **with a lazy-loaded `exifr` fallback for any runtime where the option is unsupported or where the image still appears rotated after the canvas re-encode.** Ship HEIC conversion in a worker via the `new URL('./heic-worker.ts', import.meta.url)` pattern. Client-direct upload using the existing `@supabase/ssr` browser client; Server Action takes the `{wearEventId, watchId, note, visibility, hasPhoto}` payload (no FormData, no multipart). Uniform `notFound()` on `/wear/[wearEventId]` for missing-or-private; signed URL minted inline in the Server Component, never inside `'use cache'`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Orchestration refactor (WYWT-01, WYWT-02)**
- **D-01:** New `WywtPostDialog` wrapper owns step state (`'picker' | 'compose'`) and composed form fields (photo blob, note, visibility, watch selection, client-generated `wearEventId`). Step 1 renders the existing `WatchPickerDialog`; Step 2 renders the new compose form.
- **D-02:** `WatchPickerDialog` gains optional `onWatchSelected?: (watchId: string) => void` prop. When provided, skips internal `markAsWorn` call. When absent, existing single-tap behavior preserved byte-for-byte.
- **D-03:** Picker preflight prop `wornTodayIds?: ReadonlySet<string>` — watches in this set render visually disabled and cannot be selected.
- **D-04:** Call-site routing:
  - `NavWearButton` (desktop + mobile bottom nav) → opens `WywtPostDialog` (photo flow)
  - `WywtRail` self-placeholder tile → opens `WywtPostDialog` (photo flow)
  - Profile `LogTodaysWearButton` → **unchanged**, stays on existing `WatchPickerDialog` single-tap `markAsWorn`
  - `WywtRail` non-self tile tap → **unchanged**, keeps opening `WywtOverlay`
- **D-05:** Step 2 header shows compact watch card with "Change" link. Form state preserved across back-and-forth; only the watch selection resets on Change.

**Step 2 form UX (WYWT-03..08)**
- **D-06:** Photo section pre-capture = dashed/dotted rectangular zone with two side-by-side buttons: "Take wrist shot" + "Upload photo". Tapping Camera expands zone inline into `<video>` preview. Both photo paths optional.
- **D-07:** Photo section after capture = preview fills zone at full width; top-right X button removes photo and returns to chooser state. Text link reads "Retake" (camera path) or "Choose another" (upload path).
- **D-08:** Camera overlay = inline SVG with `viewBox` + percentage-based coordinates. Two horizontal arm lines at ~38% / ~62%, two concentric circles (bezel + face) centered, hour+minute hands at **10:10**, small crown at **3 o'clock**. Nothing else — no hour markers, no lugs, no strap.
- **D-09:** HEIC conversion via `heic2any` lazy-loaded in a Web Worker. Non-HEIC uploads skip the worker.
- **D-10:** EXIF stripping + 1080px resize applies on **BOTH** paths via canvas re-encode (`canvas.toBlob('image/jpeg', 0.85)`). Single shared helper. Target output < 500KB.
- **D-11:** Note textarea plain text, 200-char hard cap, bottom-right counter `0/200` (destructive red at 200). `maxLength` enforced.
- **D-12:** Visibility selector = three-button segmented control: Private / Followers / Public. **Default = Public** (locked per STATE.md D-1). Sub-label row mandatory: Private → "Only you"; Followers → "Followers — people who follow you"; Public → "Anyone on Horlo".

**Duplicate-day handling (WYWT-12)**
- **D-13:** Preflight disable in Step 1 — dialog fetches today's wear events via DAL when opening; passes watch-id set to picker via `wornTodayIds` prop.
- **D-14:** Server-side defense-in-depth — `logWearWithPhoto` checks `(userId, watchId, wornDate)` unique constraint. On violation: `{success:false, error:'Already logged this watch today'}`. UI surfaces inline, bounces back to Step 1, photo blob retained, watch selection cleared.

**Upload pipeline + post-submit UX (WYWT-15, WYWT-16)**
- **D-15:** Client-direct upload pipeline:
  1. Client generates `wearEventId = crypto.randomUUID()` before opening Step 2
  2. Client processes photo via EXIF-strip + resize canvas helper
  3. Client uploads JPEG blob to `wear-photos/{userId}/{wearEventId}.jpg` using session-scoped Supabase client
  4. Client calls `logWearWithPhoto({wearEventId, watchId, note, visibility, hasPhoto})`
  5. Server Action validates Storage object exists (when `hasPhoto===true`)
  6. Server Action inserts `wear_events` row with `id = wearEventId` and `photo_url = <path>` (path only, not URL)
  7. `logActivity('watch_worn', ...)` fired after successful insert with `visibility` in metadata
- **D-16:** No-photo path skips Storage; inserts row with `photo_url = NULL`.
- **D-17:** Orphan handling — best-effort Storage delete if row insert fails after successful upload; log-only on failure.
- **D-18:** Upload UX — submit button shows "Logging…" with inline spinner while disabled. Modal stays open until both Storage + Server Action complete. No optimistic close.
- **D-19:** Post-submit — close dialog, fire Sonner `toast.success('Wear logged')`. User stays on current page. No "View" action in toast. `revalidatePath('/')` or equivalent so new wear appears next render.

**`/wear/[wearEventId]` detail route (WYWT-17, WYWT-18)**
- **D-20:** Mobile-first full-bleed image hero, metadata stacked below. Aspect ratio 4:5 or 1:1 (planner chooses). Desktop: image caps ~600px centered column.
- **D-21:** No-photo fallback hero — renders watch's `imageUrl`; if watch has no image, muted placeholder with brand/model centered.
- **D-22:** New DAL function `getWearEventByIdForViewer(viewerId, wearEventId)` mirroring Phase 12 `getWearEventsForViewer` three-tier predicate. Owner bypass (G-5); non-owner joins `profile_settings.profile_public = true` (G-4) + three-tier visibility (public; followers requires follow row). Returns null if any gate fails OR row doesn't exist. Page calls `notFound()` uniformly — NO response differential.
- **D-23:** Signed URL minting — per-request via Supabase Storage `createSignedUrl()`. **MUST NOT** live inside any `'use cache'`-wrapped function. TTL Claude's Discretion (recommend ~60 min). `images.unoptimized: true` already set, so signed URL passes through to browser unmodified.
- **D-24:** Entry points — `WywtRail` tile tap (non-self, 48h window) continues to open `WywtOverlay`; `/wear/[wearEventId]` is durable URL for external-entry references. Phase 15 does not wire feed/notification taps.

**Sonner toaster mount (WYWT-19)**
- **D-25:** Toaster mounted in root layout (`src/app/layout.tsx`), **outside** dynamic Suspense boundary (Pitfall H-1). Sibling of existing Suspense wrappers.
- **D-26:** Custom wrapper (`src/components/ui/ThemedToaster.tsx`) — thin Client Component that imports Horlo's custom `ThemeProvider` context to pass theme to Sonner. Do NOT use `npx shadcn add sonner` scaffold (couples to `next-themes`).
- **D-27:** `toast()` fired from Client Component submit handler only. Server Actions never call `toast` directly.
- **D-28:** Sonner not yet installed — first planner task is `npm i sonner`.

### Claude's Discretion

- Exact file locations for new components (`src/components/wywt/` vs `src/components/home/` vs new `src/components/wear/`).
- SVG overlay stroke weight (recommend 1.5px), color (recommend `rgba(255,255,255,0.85)`), dashed vs solid (recommend solid).
- Hero aspect ratio (4:5 vs 1:1).
- Signed URL TTL (recommend 60 minutes).
- Web Worker boundary for `heic2any` (recommend `src/lib/exif/heic-worker.ts` + dynamic import gate).
- Whether `getWearEventByIdForViewer` extracts a shared visibility predicate helper from `getWearEventsForViewer` or inlines it.
- `revalidatePath` / `revalidateTag` scope on successful wear log.
- Segmented-control icon set (recommend lucide `Lock` / `Users` / `Globe2`).
- Whether Step 2 header watch card links to `/watch/[id]` (recommend display-only).
- Post-capture "Remove X" vs "Retake" button styling (both needed per D-07).

### Deferred Ideas (OUT OF SCOPE)

- Photo edit-after-post (**WYWT-FUT-01**)
- Live wrist-pose AR overlay (**WYWT-FUT-02**)
- Delete wear event action (**WYWT-FUT-03**)
- Likes / reactions / comments / carousels (PROJECT.md permanent out-of-scope)
- Confirmation dialog before submit (friction anti-pattern)
- `wear` notification type / feed-row tap → `/wear/[id]` wiring
- Share-link / copy-URL affordance on `/wear/[id]`
- Scheduled orphan-storage cleanup cron
- Signed URL cache invalidation tooling
- Multi-device logout invalidating in-flight uploads
- Compress-on-camera via `MediaRecorder` constraints
- First-use tooltip on Followers tier

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Directive | Source | Impact on Phase 15 |
|-----------|--------|----------------------|
| "This is NOT the Next.js you know. Read `node_modules/next/dist/docs/` before writing any code." | `AGENTS.md` | Planner verifies `notFound()`, `'use cache'`, Server Action, and `revalidatePath` usage against Next 16 docs — NOT training data. |
| Next.js 16 App Router only — no `pages/` dir | `CLAUDE.md` | `/wear/[wearEventId]` is an App Router segment; use `async function Page({params})` with `params: Promise<{wearEventId: string}>` pattern. |
| `cacheComponents: true` is enabled in `next.config.ts` | `next.config.ts` line 13 | Signed URLs MUST NOT be minted inside `'use cache'`-wrapped code (Pitfall F-2 reinforced). |
| `images.unoptimized: true` | `next.config.ts` | Native `<img src={signedUrl}>` works without adding Supabase to `remotePatterns`. `next/image` would strip query params on optimized variants and break signed-URL auth — use native `<img>`. |
| Absolute imports via `@/*` maps to `src/` | `tsconfig.json` + conventions | No `../../` traversals in new code. |
| `'use client'` on components using hooks/state; default to Server Components otherwise | repo conventions | `WywtPostDialog`, `ComposeStep`, `CameraCaptureView`, `PhotoUploader`, `VisibilitySegmentedControl`, `ThemedToaster` are Client Components. `/wear/[wearEventId]/page.tsx` is a Server Component. |
| `ActionResult<T>` discriminated union for Server Actions | `src/lib/actionTypes.ts` | New `logWearWithPhoto` returns `ActionResult<{wearEventId: string}>` or `ActionResult<void>`. |
| Two-layer privacy — RLS AND DAL WHERE clause | v2.0 D-15 carried forward | `/wear/[wearEventId]` needs both the Storage-bucket RLS (already shipped Phase 11) AND the new `getWearEventByIdForViewer` DAL predicate. |
| Uniform 404 on privacy — no existence-leak via response differential | Phase 8 notes-IDOR precedent, Phase 10 WYWT overlay precedent | `/wear/[wearEventId]` uses `notFound()` for BOTH missing row and denied-access; no response differential. |
| GSD workflow enforcement — no direct edits | `CLAUDE.md` | Research produces only the RESEARCH.md artifact; no code. |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WYWT-01 | Wear post is a two-step modal (picker → compose) | §Codebase Anchors (`WatchPickerDialog`, `NavWearButton` state pattern); §Pattern 1 (lazy-loaded dialog wrapper) |
| WYWT-02 | Step 2 shows Selected Watch card with "Change" link | §Pattern 2 (step state machine with preserved form state) |
| WYWT-03 | Step 2 photo section — two CTAs, both optional | §Pattern 3 (inline dashed zone with chooser / capture / preview states) |
| WYWT-04 | Camera path uses `getUserMedia` + `<video>` + canvas + dotted overlay | §iOS Camera (gesture rule, constraints, cleanup); §Overlay SVG (viewBox + percent geometry) |
| WYWT-05 | Upload path with HEIC conversion via `heic2any` in Web Worker | §Pattern 4 (Worker pattern with `new URL(...)`); §EXIF (HEIC metadata stripping) |
| WYWT-06 | All images resized 1080px + EXIF-stripped via canvas re-encode | §EXIF (canvas draws pixel data only, EXIF is file-level — re-encode strips it); §Pattern 5 (shared strip helper) |
| WYWT-07 | Note textarea with 0/200 counter | UI-SPEC §Copywriting Contract; trivial `useState` pattern |
| WYWT-08 | Three-tier Visibility selector, Public default | UI-SPEC §VisibilitySegmentedControl |
| WYWT-12 | One wear per (user, watch, calendar day) — clear error | §Pattern 6 (preflight disable + server-side 23505 handling); §Sources: PostgreSQL unique-violation error code |
| WYWT-15 | Client-direct upload pipeline; Server Action validates Storage key | §Pattern 7 (client-direct + server-validated); §Supabase Storage client API |
| WYWT-16 | Sonner toast "Wear logged" | §Pattern 8 (Sonner from Client Component after Action result) |
| WYWT-17 | `/wear/[wearEventId]` shows detail; three-tier gate; uniform 404 | §Pattern 9 (viewer-aware DAL + `notFound()` + signed URL minting); §Codebase Anchors (`getWearEventsForViewer` mirror) |
| WYWT-18 | Rail tile tap unchanged; `/wear/[id]` as durable URL | §Codebase Anchors (`WywtRail` / `WywtOverlay` unchanged) |
| WYWT-19 | Sonner `<Toaster />` in root layout + custom ThemeProvider | §Pattern 10 (ThemedToaster wrapper); §Sonner docs |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sonner` | `^2.0.7` (verified `npm view sonner version` → `2.0.7`, published 2025) | Toast notifications | Only library shadcn officially recommends in 2025; already in UI-SPEC §Copywriting. Native `theme` prop accepts `'light' \| 'dark' \| 'system'`. [VERIFIED: npm registry] |
| `heic2any` | `^0.0.4` (verified `npm view heic2any version` → `0.0.4`, published 2023-04) | HEIC → JPEG conversion client-side | Only maintained browser-side HEIC decoder; `libheif` WASM bundled. Strips all metadata on conversion (so the EXIF-GPS privacy concern on HEIC input is automatically handled on that path). [VERIFIED: npm registry, [alexcorvi/heic2any](https://github.com/alexcorvi/heic2any)] |
| `@supabase/ssr` | `^0.10.2` (installed) | Session-scoped Supabase client — browser + server | Already in use; `createBrowserClient` returns a client with the user's JWT that passes through storage RLS. [VERIFIED: codebase `src/lib/supabase/client.ts`] |
| `@supabase/supabase-js` | `^2.103.0` (installed) | Storage API | Already in use; provides `.storage.from('wear-photos').upload(path, blob)` + `.createSignedUrl(path, ttl)`. [VERIFIED: package.json] |
| `crypto.randomUUID()` | Node / browser native | Client-side `wearEventId` generation | Already used via `src/lib/utils.ts#generateId`; enables known-path upload before Server Action insert (Pitfall E-3 mitigation). [VERIFIED: codebase] |
| Next.js `notFound()` | 16.2.3 (installed) | Uniform 404 on privacy fail | Canonical App Router privacy-mask pattern; throws `NEXT_HTTP_ERROR_FALLBACK;404` and renders the nearest `not-found.tsx`. [VERIFIED: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `exifr` | `^7.1.3` (verified `npm view exifr version` → `7.1.3`) | EXIF orientation detection fallback | Lazy-loaded ONLY when `createImageBitmap({imageOrientation: 'from-image'})` is unsupported or returns an un-oriented bitmap. ~30KB tree-shaken via `exifr/dist/lite`. [VERIFIED: npm registry, [exifr GitHub](https://github.com/MikeKovarik/exifr)] |
| `createImageBitmap()` | Browser native | Primary EXIF orientation handler | HIGH confidence on iOS Safari 16.4+, Chrome 59+, Firefox 98+. Fallback to `exifr` when `'from-image'` support detection fails. [CITED: [MDN createImageBitmap()](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [caniuse.com/createimagebitmap](https://caniuse.com/createimagebitmap)] |
| `Web Worker` | Browser native | `heic2any` isolation boundary | Bundler emits worker as separate entry point; keeps ~600KB WASM out of route bundles. [CITED: [dev.to — Lazy-loading 600KB WASM in Next.js](https://dev.to/calogero_cascio/lazy-loading-a-600kb-webassembly-library-in-nextjs-without-killing-your-bundle-51l4)] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `createImageBitmap({imageOrientation: 'from-image'})` primary | `exifr` + manual canvas rotation for ALL paths | `exifr`-always is a uniform 30KB cost even on modern browsers; `createImageBitmap`-primary pays zero bytes on the common path. |
| Client-direct upload to Storage | Server Action with FormData (multipart) | Next.js Server Action `bodySizeLimit` defaults to 1MB (raised to 5MB in 16.x per release notes but still bounded). Doubles bandwidth (client→server→Storage vs. client→Storage). Reference pattern on all recent Supabase + Next guides. [CITED: [Supabase Signed URL file uploads](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0)] |
| `new Worker(url)` with `import.meta.url` | `next/dynamic` for `heic2any` | `next/dynamic` still includes the chunk in the route's dependency graph; only a worker boundary gets the bundler to emit it as a separate entry. [CITED: [Lazy-loading 600KB WASM in Next.js](https://dev.to/calogero_cascio/lazy-loading-a-600kb-webassembly-library-in-nextjs-without-killing-your-bundle-51l4)] |
| Custom Sonner wrapper reading `useTheme()` from `src/components/theme-provider.tsx` | `npx shadcn add sonner` scaffold | The scaffold hard-imports `next-themes`, which reads `cookies()` directly — breaks under `cacheComponents: true` (Phase 10 key decision). Horlo's inline-theme-script pattern requires the custom wrapper. [VERIFIED: `src/components/theme-provider.tsx`] |
| `next/image` for signed-URL hero | Native `<img>` | `next/image` strips query params on cached optimized variants, breaking the signed-URL token. `images.unoptimized: true` is already set anyway. [CONTEXT: CONTEXT.md §specifics final bullet] |
| Server-generated `wearEventId` | Client-generated `crypto.randomUUID()` | Server-generated forces a temp-path upload then a rename, which is not atomic in Supabase Storage and complicates orphan cleanup. Client-generated makes the Storage path predictable *before* the Server Action call, which is the linchpin of the "server validates object exists" defense (Pitfall E-3). |

**Installation:**
```bash
npm install sonner heic2any exifr
```

**Verification commands run:**
```bash
npm view sonner version           # → 2.0.7 (latest)
npm view heic2any version         # → 0.0.4 (latest, stable but infrequent releases)
npm view exifr version            # → 7.1.3 (latest)
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── actions/
│   │   └── wearEvents.ts           # existing markAsWorn + NEW logWearWithPhoto
│   ├── layout.tsx                  # add <ThemedToaster /> (outside Suspense)
│   └── wear/
│       └── [wearEventId]/
│           ├── page.tsx            # NEW Server Component; gating + signed URL mint
│           └── not-found.tsx       # OPTIONAL; root not-found.tsx covers by default
├── components/
│   ├── wywt/                       # NEW folder (aligns with existing /home pattern density)
│   │   ├── WywtPostDialog.tsx      # orchestrator Client Component
│   │   ├── ComposeStep.tsx         # Step 2 form Client Component
│   │   ├── CameraCaptureView.tsx   # getUserMedia + capture button + overlay
│   │   ├── PhotoUploader.tsx       # file input + HEIC worker dispatcher
│   │   ├── WristOverlaySvg.tsx     # pure presentational inline SVG
│   │   └── VisibilitySegmentedControl.tsx
│   ├── wear/                       # NEW folder
│   │   ├── WearDetailHero.tsx
│   │   └── WearDetailMetadata.tsx
│   ├── ui/
│   │   └── ThemedToaster.tsx       # NEW Sonner wrapper bound to custom ThemeProvider
│   ├── home/
│   │   └── WatchPickerDialog.tsx   # EXTEND with onWatchSelected + wornTodayIds props
│   └── layout/
│       └── NavWearButton.tsx       # EXTEND: swap lazy target to WywtPostDialog
├── data/
│   └── wearEvents.ts               # ADD getWearEventByIdForViewer; consider logWearEventWithPhoto helper
└── lib/
    ├── exif/
    │   ├── strip.ts                # shared canvas resize + EXIF strip helper
    │   └── heic-worker.ts          # Web Worker entry; dynamic-imports heic2any
    └── storage/
        └── wearPhotos.ts           # client-direct upload helper + path convention
```

### Pattern 1: Lazy-loaded dialog wrapper (Step 1 → Step 2)

**What:** `WywtPostDialog` is Client Component lazy-loaded from `NavWearButton` and `WywtRail` via the existing `React.lazy` + `{open && ...}` gate. `WywtPostDialog` itself imports `WatchPickerDialog` directly (not lazy — it's already loaded from the same nav entry point, and the picker is Step 1 so the user always sees it).

**When to use:** The planner should keep the EXISTING lazy gate on the trigger (NavWearButton / WywtRail) and not lazy-load anything inside `WywtPostDialog` — once the user has tapped Wear, everything the dialog needs should stream in together (exception: `heic2any` worker, which is dispatched only when the user selects a HEIC file).

**Example:**
```tsx
// src/components/layout/NavWearButton.tsx (EXTEND existing)
// Source: existing NavWearButton.tsx pattern, verified at src/components/layout/NavWearButton.tsx:29-33
const WywtPostDialog = lazy(() =>
  import('@/components/wywt/WywtPostDialog').then((m) => ({
    default: m.WywtPostDialog,
  })),
)

// ... in render:
{open && (
  <Suspense fallback={null}>
    <WywtPostDialog
      open={open}
      onOpenChange={setOpen}
      ownedWatches={ownedWatches}
    />
  </Suspense>
)}
```

### Pattern 2: Two-step state machine with preserved form state

**What:** `WywtPostDialog` owns `step: 'picker' | 'compose'`, `selectedWatchId: string | null`, `wearEventId: string` (generated once via `crypto.randomUUID()` when the dialog opens and held for the lifetime of the open session), `photoBlob: Blob | null`, `note: string`, `visibility: WearVisibility`.

**When to use:** "Change" link sets `selectedWatchId = null` and `step = 'picker'` but preserves `photoBlob`, `note`, `visibility`. Closing the dialog resets all state.

**Example:**
```tsx
// src/components/wywt/WywtPostDialog.tsx (NEW)
// Source: inferred from CONTEXT.md D-01 / D-05
'use client'

import { useState, useMemo } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { WatchPickerDialog } from '@/components/home/WatchPickerDialog'
import { ComposeStep } from './ComposeStep'
import type { Watch } from '@/lib/types'
import type { WearVisibility } from '@/lib/wearVisibility'

export function WywtPostDialog({
  open,
  onOpenChange,
  ownedWatches,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  ownedWatches: Watch[]
}) {
  const [step, setStep] = useState<'picker' | 'compose'>('picker')
  const [selectedWatchId, setSelectedWatchId] = useState<string | null>(null)
  // wearEventId generated ONCE per open session so the Storage path is
  // known before the Server Action insert (Pitfall E-3 linchpin).
  const wearEventId = useMemo(() => crypto.randomUUID(), [open])
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [note, setNote] = useState('')
  const [visibility, setVisibility] = useState<WearVisibility>('public')
  const [wornTodayIds, setWornTodayIds] = useState<ReadonlySet<string> | undefined>()

  // ... fetch wornTodayIds when open turns true (fire in effect, cache per session)

  if (step === 'picker') {
    return (
      <WatchPickerDialog
        open={open}
        onOpenChange={onOpenChange}
        watches={ownedWatches}
        wornTodayIds={wornTodayIds}
        onWatchSelected={(id) => {
          setSelectedWatchId(id)
          setStep('compose')
        }}
      />
    )
  }

  const selectedWatch = ownedWatches.find((w) => w.id === selectedWatchId)
  if (!selectedWatch) {
    // Defensive: should not happen in practice.
    setStep('picker')
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <ComposeStep
          watch={selectedWatch}
          wearEventId={wearEventId}
          photoBlob={photoBlob}
          setPhotoBlob={setPhotoBlob}
          note={note}
          setNote={setNote}
          visibility={visibility}
          setVisibility={setVisibility}
          onChange={() => {
            // D-05: reset watch, PRESERVE photo/note/visibility
            setSelectedWatchId(null)
            setStep('picker')
          }}
          onSubmitted={() => {
            onOpenChange(false)
            // Reset all state for next open
            setSelectedWatchId(null)
            setPhotoBlob(null)
            setNote('')
            setVisibility('public')
            setStep('picker')
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
```

### Pattern 3: `WatchPickerDialog` prop extension (backwards-compatible)

**What:** Add two optional props to the existing component. When `onWatchSelected` is provided, the `handleSubmit` function calls it and skips `markAsWorn`. When `wornTodayIds` is provided, rows with matching IDs render disabled.

**Source (code to modify):** `src/components/home/WatchPickerDialog.tsx` lines 49, 70-84, 141-160.

**Example (patch, not full file):**
```tsx
// Add to Props interface:
interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  watches: Watch[]
  /** When provided, selection is emitted upward and markAsWorn is skipped. */
  onWatchSelected?: (watchId: string) => void
  /** Watches already logged for today — render disabled + "Worn today" label. */
  wornTodayIds?: ReadonlySet<string>
}

// In handleSubmit:
const handleSubmit = () => {
  if (!selectedId) return
  if (onWatchSelected) {
    onWatchSelected(selectedId)
    return  // Skip markAsWorn — caller (WywtPostDialog) takes over.
  }
  // existing markAsWorn path continues unchanged
}

// In list render:
{filtered.map((w) => {
  const isWornToday = wornTodayIds?.has(w.id) ?? false
  return (
    <li key={w.id}>
      <button
        type="button"
        role="option"
        aria-selected={selectedId === w.id}
        aria-disabled={isWornToday}
        disabled={isWornToday}
        onClick={() => !isWornToday && setSelectedId(w.id)}
        className={`... ${isWornToday ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="text-sm font-semibold">{w.brand}</span>
        <span className="text-sm text-muted-foreground">{w.model}</span>
        {isWornToday && (
          <span className="text-xs text-muted-foreground ml-auto">Worn today</span>
        )}
      </button>
    </li>
  )
})}
```

### Pattern 4: Web Worker for heic2any (prevents WASM in main bundle)

**What:** Worker file loaded via `new Worker(new URL('../lib/exif/heic-worker.ts', import.meta.url))`. Dynamic `await import('heic2any')` inside the worker. Main thread posts an ArrayBuffer (transferable), worker posts back converted ArrayBuffer.

**When to use:** Only when a selected file is HEIC/HEIF. Non-HEIC files skip the worker entirely and go straight into the canvas pipeline.

**Example:**
```typescript
// src/lib/exif/heic-worker.ts (NEW)
// Source: https://dev.to/calogero_cascio/lazy-loading-a-600kb-webassembly-library-in-nextjs-without-killing-your-bundle-51l4
self.onmessage = async (e: MessageEvent) => {
  const { buffer, toType, quality } = e.data as {
    buffer: ArrayBuffer
    toType: string
    quality: number
  }
  // Dynamic import INSIDE the worker — bundler emits heic2any as a
  // separate worker chunk, never preloaded into the route bundle.
  const { default: heic2any } = await import('heic2any')
  const blob = new Blob([buffer])
  const result = await heic2any({ blob, toType, quality })
  const output = Array.isArray(result) ? result[0] : result
  const ab = await output.arrayBuffer()
  // Transfer the buffer — zero-copy.
  ;(self as unknown as Worker).postMessage(
    { buffer: ab, type: output.type },
    [ab],
  )
}

export {}  // make this a module
```

```typescript
// src/components/wywt/PhotoUploader.tsx (excerpt)
async function convertHeic(file: File): Promise<Blob> {
  const worker = new Worker(
    new URL('../../lib/exif/heic-worker.ts', import.meta.url),
    { type: 'module' },
  )
  const buffer = await file.arrayBuffer()
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      resolve(new Blob([e.data.buffer], { type: e.data.type }))
      worker.terminate()
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(e)
    }
    worker.postMessage(
      { buffer, toType: 'image/jpeg', quality: 0.85 },
      [buffer], // transferable
    )
  })
}

function isHeicFile(file: File): boolean {
  // MIME alone is unreliable (many Android browsers misreport as 'image/*'
  // or empty); fall back to extension. Source: dev.to article.
  const mimeOk = file.type === 'image/heic' || file.type === 'image/heif'
  const ext = file.name.toLowerCase()
  const extOk = ext.endsWith('.heic') || ext.endsWith('.heif')
  return mimeOk || extOk
}
```

**Note for planner:** Next.js 16 with Turbopack supports the `new URL('./worker.ts', import.meta.url)` pattern. Verify with a dev-build smoke check — the worker file appears as a separate `.worker.js` chunk in DevTools network tab once the user selects a HEIC file.

### Pattern 5: Shared canvas resize + EXIF-strip helper

**What:** Takes a `Blob` (post-HEIC-conversion or a raw non-HEIC file or a canvas-captured JPEG from the camera path). Draws it to an offscreen canvas at max 1080px on the longest edge. Returns a fresh JPEG `Blob` with EXIF stripped (canvas re-encoding cannot preserve metadata).

**Key fact:** Canvas never copies EXIF — `canvas.toBlob('image/jpeg', quality)` always produces a JPEG with NO EXIF. This is the core mechanism for EXIF stripping in Horlo. [VERIFIED: [MDN Canvas drawImage/toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)]

**EXIF orientation is the trap:** The pixel data on the source image is in the sensor's native orientation; the EXIF `Orientation` tag tells a viewer to rotate display. When we draw that source onto a canvas via plain `drawImage`, the rotation instruction is ignored and the canvas pixels come out sideways. We strip EXIF *and* need to pre-orient the pixels.

**Recommendation (RESOLVES STATE.md open flag):** Use `createImageBitmap(blob, { imageOrientation: 'from-image' })` as the primary path. Modern browsers rotate the bitmap to match EXIF orientation before returning it; the subsequent canvas draw is already upright. Fallback with `exifr` lazy-loaded when the primary path returns a rotated bitmap.

**Browser-support evidence (the "iOS Safari 15+" claim in UI-SPEC is NOT SAFE):**
- `caniuse` marks iOS Safari 15.0 – 16.7 as **partial support** for `createImageBitmap`; full support lands in Safari 17 [CITED: [caniuse createImageBitmap](https://caniuse.com/createimagebitmap)]
- WebKit commit adding EXIF orientation from Blob is `253004@main` dated **August 2022** and shipped in Safari 16.4 (spring 2023) [CITED: [WebKit commit 8758b1b](https://github.com/WebKit/WebKit/commit/8758b1b9f85526f462e6edb74d5c85228e15d90d)]
- MDN notes `imageOrientation: 'from-image'` is the default and respects EXIF; but specific iOS Safari version support is not enumerated in the compat table [CITED: [MDN createImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap)]

**Implication:** Users on iOS Safari 15.0-16.3 will get sideways photos if we rely on `createImageBitmap` alone. At 2026 traffic, this is a small minority, but the `exifr` fallback is cheap (30KB lazy-loaded, ~1% of users) and eliminates the bug.

**Example:**
```typescript
// src/lib/exif/strip.ts (NEW)
export interface StripResult {
  blob: Blob
  width: number
  height: number
}

export async function stripAndResize(
  input: Blob,
  maxDim = 1080,
  quality = 0.85,
): Promise<StripResult> {
  // Primary: createImageBitmap auto-orients on Safari 16.4+, Chrome 59+,
  // Firefox 98+. On older iOS Safari the option is silently ignored and
  // the bitmap is NOT auto-oriented.
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(input, { imageOrientation: 'from-image' })
  } catch {
    // Very old browsers throw on the options arg — fallback to no options
    // and let the exifr-rotate path correct it below.
    bitmap = await createImageBitmap(input)
  }

  // Compute target dimensions preserving aspect.
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const targetW = Math.round(bitmap.width * scale)
  const targetH = Math.round(bitmap.height * scale)

  // Defense-in-depth: detect and correct remaining misorientation with exifr
  // fallback. ASSUMED: detection heuristic is "read EXIF orientation; if
  // orientation > 1, assume createImageBitmap did NOT rotate (older Safari)
  // and apply rotation manually." Planner may choose to always-apply-exifr
  // on iOS user-agents; that's a simpler but wider fallback.
  const orientation = await detectOrientation(input) // uses exifr/dist/lite lazy import
  const needsRotate = orientation && orientation > 1 && !didAutoRotate(bitmap, input)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')!
  if (needsRotate) {
    applyExifRotation(ctx, canvas, bitmap, orientation)
  } else {
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  }

  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  if (!out) throw new Error('Canvas.toBlob returned null')
  return { blob: out, width: targetW, height: targetH }
}
```

### Pattern 6: Duplicate-day handling — preflight + server 23505

**What:** Two-layer duplicate prevention matching the project's two-layer privacy posture.

- **Preflight (client):** New DAL helper `getWornTodayIdsForUser(userId, today)` returns `ReadonlySet<string>` of watch IDs already worn today. `WywtPostDialog` fetches this when it opens; passes to `WatchPickerDialog` via `wornTodayIds` prop. Disabled watches cannot be selected.
- **Server defense (Action):** `logWearWithPhoto` issues the insert. On unique-violation (Postgres error code `23505`, constraint `wear_events_unique_day`), returns `{success: false, error: 'Already logged this watch today'}`.

**Postgres error-code detection in Drizzle/postgres-js:** The `postgres` driver (in use) surfaces error codes on `err.code`. Wrap the insert in try/catch; test `if (err instanceof Error && 'code' in err && err.code === '23505') return {success:false, error:'Already logged this watch today'}`. [CITED: [PostgreSQL Error Codes Appendix A](https://www.postgresql.org/docs/current/errcodes-appendix.html)]

**Orphan cleanup:** On unique-violation, if Storage upload succeeded, Server Action issues a best-effort delete at `{userId}/{wearEventId}.jpg`. Try/catch, log-only on failure. Phase 11 D-04 MVP orphan-risk posture — scheduled cleanup cron deferred beyond v3.0.

### Pattern 7: Client-direct upload + server-validated insert

**What:** Client uploads to Storage using the browser Supabase client (session-scoped, RLS enforces folder prefix). Server Action takes metadata only; validates the Storage object exists BEFORE the DB insert.

**Why client-direct:** Next.js Server Action default body limit is 1MB; `serverActions.bodySizeLimit` can raise it to a few MB, but doubling bandwidth (client→server→Storage) is still wasteful. Direct-to-Storage is the documented Supabase pattern. [CITED: [Next.js serverActions config](node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md); [Supabase Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)]

**Server-side validation (E-3):** After client uploads and calls the Server Action, the Action uses a service-role client (OR the existing server client from `src/lib/supabase/server.ts`) to `storage.from('wear-photos').list(userId, {search: `${wearEventId}.jpg`})` (or `getPublicUrl` existence probe). If the object isn't there but the client claimed `hasPhoto=true`, return `{success: false, error: 'Photo upload failed — please try again'}` and DO NOT insert the row.

**Example:**
```typescript
// src/lib/storage/wearPhotos.ts (NEW, client-callable)
'use client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export async function uploadWearPhoto(
  userId: string,
  wearEventId: string,
  jpeg: Blob,
): Promise<{ path: string } | { error: string }> {
  const supabase = createSupabaseBrowserClient()
  const path = `${userId}/${wearEventId}.jpg`
  const { error } = await supabase.storage
    .from('wear-photos')
    .upload(path, jpeg, {
      contentType: 'image/jpeg',
      upsert: false, // Pitfall F-4: never overwrite existing
    })
  if (error) return { error: error.message }
  return { path }
}
```

```typescript
// src/app/actions/wearEvents.ts (ADD alongside existing markAsWorn)
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import * as wearEventDAL from '@/data/wearEvents'
import * as watchDAL from '@/data/watches'
import { logActivity } from '@/data/activities'
import type { ActionResult } from '@/lib/actionTypes'

const schema = z.object({
  wearEventId: z.string().uuid(),
  watchId: z.string().uuid(),
  note: z.string().max(200).nullable(),
  visibility: z.enum(['public', 'followers', 'private']),
  hasPhoto: z.boolean(),
})

export async function logWearWithPhoto(
  input: z.infer<typeof schema>,
): Promise<ActionResult<{ wearEventId: string }>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input' }
  const { wearEventId, watchId, note, visibility, hasPhoto } = parsed.data

  const watch = await watchDAL.getWatchById(user.id, watchId)
  if (!watch) return { success: false, error: 'Watch not found' } // CR-01 uniform not-found

  // E-3 server-side Storage validation when client asserts hasPhoto
  if (hasPhoto) {
    const expectedPath = `${user.id}/${wearEventId}.jpg`
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.storage
      .from('wear-photos')
      .list(user.id, { search: `${wearEventId}.jpg` })
    if (error || !data?.some((o) => o.name === `${wearEventId}.jpg`)) {
      return { success: false, error: 'Photo upload failed — please try again' }
    }
    // Path convention enforced: the list above is already scoped to user.id
    // folder via the RLS policy, so any object found is guaranteed to be at
    // the expected path.
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    await wearEventDAL.logWearEventWithPhoto({
      id: wearEventId,   // D-15 step 5: id = wearEventId
      userId: user.id,
      watchId,
      wornDate: today,
      note: note ?? null,
      photoUrl: hasPhoto ? `${user.id}/${wearEventId}.jpg` : null,
      visibility,
    })
  } catch (err) {
    // 23505 unique_violation on wear_events_unique_day
    if (err instanceof Error && 'code' in err && (err as { code: unknown }).code === '23505') {
      // D-17 best-effort orphan delete
      if (hasPhoto) {
        try {
          const supabase = await createSupabaseServerClient()
          await supabase.storage
            .from('wear-photos')
            .remove([`${user.id}/${wearEventId}.jpg`])
        } catch (delErr) {
          console.error('[logWearWithPhoto] orphan delete failed (non-fatal):', delErr)
        }
      }
      return { success: false, error: 'Already logged this watch today' }
    }
    // Non-23505 insert failure with hasPhoto — also issue orphan delete.
    if (hasPhoto) {
      try {
        const supabase = await createSupabaseServerClient()
        await supabase.storage
          .from('wear-photos')
          .remove([`${user.id}/${wearEventId}.jpg`])
      } catch {}
    }
    console.error('[logWearWithPhoto] unexpected error:', err)
    return { success: false, error: 'Failed to log wear' }
  }

  // Fire-and-forget activity log (Phase 12 D-10 contract)
  try {
    await logActivity(user.id, 'watch_worn', watchId, {
      brand: watch.brand,
      model: watch.model,
      imageUrl: watch.imageUrl ?? null,
      visibility, // required per WatchWornMetadata
    })
  } catch (err) {
    console.error('[logWearWithPhoto] activity log failed (non-fatal):', err)
  }

  revalidatePath('/')
  return { success: true, data: { wearEventId } }
}
```

### Pattern 8: Sonner toast from Client Component (not Server Action)

**What:** Server Action returns `ActionResult`; Client Component inspects result in its transition callback and calls `toast.success('Wear logged')` on success, or displays an inline `role="alert"` banner on failure.

**Why:** `toast()` calls the Sonner JS API in the browser — cannot be called from `'use server'`. Planner's executor must ensure the call site is a `'use client'` component. [CITED: [Sonner Toaster docs](https://sonner.emilkowal.ski/toaster)]

**Example:**
```tsx
// src/components/wywt/ComposeStep.tsx (excerpt, NEW)
'use client'
import { toast } from 'sonner'
import { useTransition, useState } from 'react'
import { logWearWithPhoto } from '@/app/actions/wearEvents'
import { uploadWearPhoto } from '@/lib/storage/wearPhotos'

export function ComposeStep(/* props */) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [userId /* from auth context or prop */] = ['...']

  const handleSubmit = async () => {
    setError(null)
    startTransition(async () => {
      // Step 1: process + upload photo if present
      if (photoBlob) {
        const { blob } = await stripAndResize(photoBlob, 1080, 0.85)
        const upload = await uploadWearPhoto(userId, wearEventId, blob)
        if ('error' in upload) {
          setError('Photo upload failed')
          return
        }
      }
      // Step 2: server action
      const result = await logWearWithPhoto({
        wearEventId,
        watchId: watch.id,
        note: note || null,
        visibility,
        hasPhoto: !!photoBlob,
      })
      if (!result.success) {
        setError(result.error)
        // Duplicate-day — bounce back to picker, keep photo, clear watch
        if (result.error === 'Already logged this watch today') {
          // caller handles via onChange() to reset to picker step
        }
        return
      }
      // H-2 mitigation: toast fired from CLIENT Component, not Server Action
      toast.success('Wear logged')
      onSubmitted()
    })
  }
  // ... render
}
```

### Pattern 9: Detail-route viewer-aware DAL + notFound + signed URL

**What:** New DAL `getWearEventByIdForViewer(viewerId, wearEventId)` mirrors Phase 12 `getWearEventsForViewer` predicate: self-bypass (G-5); non-owner join `profile_settings.profile_public = true` (G-4) AND three-tier visibility — public visible, followers requires follow row, private denied. Returns `null` for missing-or-denied.

**Server Component page** calls `notFound()` uniformly. Signed URL minted inline — NEVER inside a `'use cache'`-wrapped function.

**Signed URL freshness:** Supabase Smart CDN treats each unique signed-URL token as a separate cache key — no cross-user/cross-request cache contamination is possible. Per-request minting is both free and correct. [CITED: [Supabase Smart CDN docs](https://supabase.com/docs/guides/storage/cdn/smart-cdn)]

**Example:**
```typescript
// src/data/wearEvents.ts (ADD to existing file)
export async function getWearEventByIdForViewer(
  viewerUserId: string | null,
  wearEventId: string,
) {
  const rows = await db
    .select({
      id: wearEvents.id,
      userId: wearEvents.userId,
      watchId: wearEvents.watchId,
      wornDate: wearEvents.wornDate,
      note: wearEvents.note,
      photoUrl: wearEvents.photoUrl,
      visibility: wearEvents.visibility,
      createdAt: wearEvents.createdAt,
      actorProfilePublic: profileSettings.profilePublic,
    })
    .from(wearEvents)
    .innerJoin(profileSettings, eq(profileSettings.userId, wearEvents.userId))
    .where(eq(wearEvents.id, wearEventId))
    .limit(1)

  const row = rows[0]
  if (!row) return null  // 404 for missing

  // G-5 self bypass
  if (viewerUserId && row.userId === viewerUserId) return row

  // G-4 outer gate
  if (!row.actorProfilePublic) return null

  // Three-tier
  if (row.visibility === 'public') return row
  if (row.visibility === 'private') return null
  if (row.visibility === 'followers') {
    if (!viewerUserId) return null
    const followRows = await db
      .select({ id: follows.id })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, viewerUserId),
          eq(follows.followingId, row.userId),
        ),
      )
      .limit(1)
    return followRows.length > 0 ? row : null
  }
  return null
}
```

```tsx
// src/app/wear/[wearEventId]/page.tsx (NEW Server Component)
import { notFound } from 'next/navigation'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getWearEventByIdForViewer } from '@/data/wearEvents'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { WearDetailHero } from '@/components/wear/WearDetailHero'
import { WearDetailMetadata } from '@/components/wear/WearDetailMetadata'

// No 'use cache' here (Pitfall F-2). Signed URL MUST be per-request.
export default async function WearDetailPage({
  params,
}: {
  // Next.js 16 App Router: params is a Promise
  params: Promise<{ wearEventId: string }>
}) {
  const { wearEventId } = await params

  let viewerId: string | null = null
  try {
    const user = await getCurrentUser()
    viewerId = user.id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }

  const wear = await getWearEventByIdForViewer(viewerId, wearEventId)
  if (!wear) notFound()  // Uniform 404 on missing OR denied (Pitfall from Phase 8)

  // Signed URL mint per-request; never inside 'use cache'
  let signedUrl: string | null = null
  if (wear.photoUrl) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.storage
      .from('wear-photos')
      .createSignedUrl(wear.photoUrl, 60 * 60) // 60 min TTL (Discretion)
    signedUrl = data?.signedUrl ?? null
  }

  return (
    <article className="flex flex-col md:max-w-[600px] md:mx-auto">
      <WearDetailHero wear={wear} signedUrl={signedUrl} />
      <WearDetailMetadata wear={wear} viewerId={viewerId} />
    </article>
  )
}
```

### Pattern 10: ThemedToaster (custom ThemeProvider, NOT next-themes)

**What:** Client Component that reads `useTheme()` from `src/components/theme-provider.tsx` and passes `resolvedTheme` to Sonner's `<Toaster>`. Mounted outside Suspense boundaries in root layout.

**Why custom:** Horlo's custom ThemeProvider is decoupled from `next-themes` because `cacheComponents: true` forbids `cookies()` in the layout body. The standard shadcn Sonner scaffold imports `next-themes` — unusable here. [VERIFIED: `src/components/theme-provider.tsx`]

**Example:**
```tsx
// src/components/ui/ThemedToaster.tsx (NEW)
'use client'
import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'
import { useTheme } from '@/components/theme-provider'

export function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <SonnerToaster
      theme={resolvedTheme as ToasterProps['theme']}
      position="bottom-center"
      richColors
    />
  )
}
```

```tsx
// src/app/layout.tsx — ADD <ThemedToaster /> OUTSIDE Suspense (Pitfall H-1)
<body className="min-h-full flex flex-col bg-background">
  <ThemeProvider>
    <Suspense fallback={<HeaderSkeleton />}>
      <Header />
    </Suspense>
    <Suspense fallback={null}>
      <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
    </Suspense>
    <Suspense fallback={null}>
      <BottomNavServer />
    </Suspense>
    {/* NEW: Toaster as sibling of Suspense boundaries, inside ThemeProvider so useTheme() works */}
    <ThemedToaster />
  </ThemeProvider>
</body>
```

**Important:** `ThemedToaster` sits **inside** `<ThemeProvider>` (it uses `useTheme()`) but **outside** the three `<Suspense>` wrappers. This matches Pitfall H-1 (Sonner outside Suspense) while still satisfying the custom theme binding.

### Anti-Patterns to Avoid

- **Eager-importing `heic2any`** at the top of any file — adds ~600KB WASM to the route bundle. Always Worker + dynamic import.
- **Calling `toast()` inside the Server Action** — Sonner is a browser-only API; Server Action has no DOM. Return `ActionResult` and toast from the client handler.
- **Caching `createSignedUrl` inside `'use cache'`** — signed URL tokens are time-bounded AND user-scoped; caching across requests breaks auth and mixes viewers.
- **`next/image` on the hero** — strips query params on optimized variants → breaks the signed URL token. Use native `<img>`; `images.unoptimized: true` is already set.
- **Forking `WatchPickerDialog`** — Pitfall I-2; extend via props only.
- **Uploading `heic2any` output directly as the upload blob** — `heic2any` strips EXIF in practice (library statement "resulting file doesn't have any metadata") but the canvas re-encode is still required for the 1080px resize AND for the non-HEIC uploaded-JPEG path. Keep the pipeline uniform.
- **Using `redirect` instead of `notFound()` on `/wear/[id]` privacy fail** — `redirect` leaks existence (the redirect URL changes based on outcome); `notFound()` returns a uniform 404.
- **`await` before `getUserMedia()` on a tap handler** — iOS consumes the gesture context; camera silently fails with `NotAllowedError`. `getUserMedia` MUST be the first `await`.
- **Minting signed URLs inside a cached DAL function** — Pitfall F-2 reinforced. DAL returns the raw `photo_url` path; page/Server-Component mints the signed URL inline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HEIC decoding in browser | Custom libheif wrapper | `heic2any` in Web Worker | libheif is 500KB+ of WASM with a dozen edge cases for CFF-alpha / grayscale / tiled HEICs. heic2any is the only maintained wrapper. |
| EXIF orientation detection | Hand-parsed TIFF reader | `createImageBitmap({imageOrientation: 'from-image'})` primary + `exifr/dist/lite` fallback | TIFF parsing is ~200 lines for one tag; `exifr`'s lite build is 30KB and also handles HEIC/AVIF/XMP. |
| Canvas resize with quality | Hand-rolled bilinear resampler | `canvas.drawImage` with target dimensions | Browsers apply OS-native resampling; output is indistinguishable from libraries like `pica` at 1080px targets. |
| Toast notifications | Custom portal + animation | `sonner` | Sonner is 15KB, accessible, themeable, and the shadcn-canonical choice. |
| Supabase Storage upload with RLS | Direct `fetch` to `/storage/v1/object/...` | `supabase.storage.from(bucket).upload(...)` | The official client handles auth headers, multipart, bucket routing, and error normalization. |
| Signed URL generation | `crypto.sign()` with service secret | `supabase.storage.from(bucket).createSignedUrl(path, ttl)` | Matches Storage's token verification; service secret should never leave the Server Action. |
| Uniform 404 on privacy | Custom `redirect()` / boolean flag in response | `notFound()` from `next/navigation` | Next.js renders the nearest `not-found.tsx` with a proper 404 status and `<meta name="robots" content="noindex">`. |
| Two-step form state machine | `zustand` persisted store | `useState` in the orchestrator Client Component | Local UI state that resets on dialog close; persisting is anti-goal (user should never return to a half-filled form after a refresh). |

**Key insight:** Every capability this phase needs has a canonical library already in the project or trivially installed. The novelty is **composition discipline**, not greenfield code.

## Common Pitfalls

### Pitfall 1: iOS Safari gesture context consumed by `await` before `getUserMedia` (D-1)

**What goes wrong:** `getUserMedia()` rejects with `NotAllowedError` on iOS with no permission prompt — camera silently fails.

**Why it happens:** iOS Safari requires `getUserMedia` to be called in the same synchronous call-stack as the user's tap. Any `await` before it cedes the gesture and the permission check fails. [CITED: PITFALLS.md D-1]

**How to avoid:** In the "Take wrist shot" onClick handler, `navigator.mediaDevices.getUserMedia(constraints)` MUST be the first `await` — NO `await` before it, NO `fetch`, NO setState-then-effect-that-calls-getUserMedia pattern. All setup is synchronous or happens AFTER the MediaStream resolves.

```tsx
// src/components/wywt/CameraCaptureView.tsx — CORRECT
const handleTapCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1080 } },
      audio: false,
    })
    streamRef.current = stream
    if (videoRef.current) videoRef.current.srcObject = stream
    setMode('camera')
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      setError('Camera access denied — use Upload photo instead.')
    } else {
      setError('Camera unavailable — use Upload photo instead.')
    }
  }
}

// WRONG — async work before getUserMedia:
const handleTapCamera = async () => {
  await someSetup()           // <-- iOS Safari consumes the gesture here
  const stream = await navigator.mediaDevices.getUserMedia(...)  // NotAllowedError
}
```

**Warning signs:** Any conditional `await` or `fetch` or state-effect pattern in the tap handler. Any call path where a Promise resolves before `getUserMedia`.

### Pitfall 2: MediaStream tracks leak — camera LED stays on (D-2)

**What goes wrong:** User closes the dialog without capturing; the camera light stays on because the MediaStream was never stopped.

**Why it happens:** `<video srcObject={stream}>` holds a reference. Stopping requires iterating `stream.getTracks()` and calling `.stop()` on each, then setting `srcObject = null`.

**How to avoid:** Cleanup in the `CameraCaptureView` unmount effect AND in every path that leaves the camera state (capture-complete, X-button remove, dialog close).

```tsx
useEffect(() => {
  return () => {
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }
}, [])
```

**Warning signs:** Opening the dialog twice and the camera stays on between opens. Any camera-view component without a cleanup effect.

### Pitfall 3: Camera permission denied — no recovery path (D-3)

**What goes wrong:** User denies the permission prompt. On iOS, browser cannot re-prompt — user must go to iOS Settings > Safari > Camera. Without explicit UX, they see a blank video area.

**How to avoid:** Catch `NotAllowedError` from the `getUserMedia` promise and render `role="alert"` with copy **"Camera access denied — use Upload photo instead."** (UI-SPEC §Copywriting Contract). Collapse the camera zone back to pre-capture chooser state. The upload path remains available.

**Optional enhancement (Claude's Discretion):** Use `navigator.permissions.query({name: 'camera'})` to detect denied-before-prompt state on supporting browsers and show the message immediately without triggering another silent denial. `permissions.query` for camera is supported on Chrome/Edge but not reliably on iOS Safari — treat it as a progressive enhancement, not a primary gate.

### Pitfall 4: EXIF orientation — sideways photos on iOS Safari < 16.4 (E-2)

**What goes wrong:** iPhone photos have an EXIF Orientation tag (often `6` = rotate 90° CW). Canvas draws pixels in sensor orientation, ignoring the tag. Result: sideways photo uploaded to Storage, sideways image displayed on `/wear/[id]`.

**Why it happens:** `canvas.drawImage(imageElement, ...)` ignores EXIF. `createImageBitmap({imageOrientation: 'from-image'})` DOES respect EXIF — but only on Safari 16.4+ (shipped spring 2023, not the Safari 15+ claim in UI-SPEC).

**How to avoid (RESOLUTION of STATE.md research flag):**

1. **Primary path:** Call `createImageBitmap(blob, {imageOrientation: 'from-image'})`. Catch options-arg errors on very old browsers and fall back to no-options `createImageBitmap`.
2. **Fallback:** If the resulting bitmap's dimensions do not match the EXIF orientation's expected orientation (e.g., EXIF says 90° rotated but bitmap is portrait-as-sensor), use `exifr`'s lazy-loaded `orientation()` helper to read the tag and apply matching canvas transforms before `drawImage`.
3. **Always:** The final `canvas.toBlob('image/jpeg', 0.85)` produces a JPEG with NO EXIF (canvas cannot preserve metadata on the JPEG encode path). Orientation is now baked into pixel data.

**Evidence:**
- `caniuse` lists iOS Safari 15.0-16.7 as "Partial support" for `createImageBitmap` [CITED]
- WebKit EXIF-orientation-from-Blob commit 253004@main lands Aug 2022, shipped in Safari 16.4 [CITED]

**Simpler alternative (documented for the planner):** Always-apply `exifr` regardless of browser. 30KB on every upload (~1% cost), guaranteed correct, one less codepath. Trade verbosity-of-detection for uniform simplicity.

**Verification:** Upload a portrait-mode iPhone photo; confirm the hero on `/wear/[id]` displays upright. Repeat on landscape, rotate-90-left, and rotate-180 sources.

### Pitfall 5: EXIF GPS not stripped on all paths (E-4)

**What goes wrong:** GPS coordinates embedded in iPhone photos leak into Storage and are served to all viewers.

**Why it happens:** If the upload pipeline has any path that uploads the raw user-selected file (bypassing canvas re-encode), EXIF (including GPS) uploads intact.

**How to avoid:** There is no "upload original" path in Phase 15. `src/lib/exif/strip.ts` is the ONLY blob that ever reaches `uploadWearPhoto()`. Camera-captured JPEGs go through the same helper, even though the camera capture is already a fresh canvas image — keep the pipeline uniform so a future contributor cannot accidentally bypass the EXIF strip.

**Verification:** The phase plan's integration suite MUST include an EXIF verification step on the stored file. See §Validation Architecture → §EXIF-GPS-stripped verification procedure.

### Pitfall 6: HEIC MIME detection unreliable on Android / cross-browser

**What goes wrong:** File picker returns a HEIC but `file.type` is empty or `image/*` on certain Android browsers and older iOS.

**How to avoid:** Detection must check BOTH MIME and filename extension:
```ts
function isHeicFile(file: File): boolean {
  const mimeOk = file.type === 'image/heic' || file.type === 'image/heif'
  const ext = file.name.toLowerCase()
  const extOk = ext.endsWith('.heic') || ext.endsWith('.heif')
  return mimeOk || extOk
}
```

### Pitfall 7: Signed URL inside `'use cache'` — security + freshness bug (F-2)

**What goes wrong:** Next.js caches the signed URL across users / requests; the token expires or leaks to another viewer. Either way, images break or privacy breaches.

**How to avoid:** Architectural discipline — the DAL returns `photo_url` (the raw path). The Server Component calls `createSignedUrl` INLINE in the page function (`page.tsx`), never inside `getWearEventByIdForViewer` or any `'use cache'`-wrapped code. Per-request is correct; Smart CDN caching is keyed on the unique token anyway.

**Warning signs:** `createSignedUrl` appearing in any DAL file (`src/data/*.ts`). Any `'use cache'` directive in the same file as a signed-URL mint.

### Pitfall 8: Orphan Storage objects — inserted nothing, uploaded file (F-3)

**What goes wrong:** Upload succeeded; DB insert failed (23505 duplicate OR RLS glitch OR connection drop). The `{userId}/{wearEventId}.jpg` object sits forever.

**How to avoid:** Server Action's `logWearWithPhoto` wraps the insert in try/catch. On failure, if `hasPhoto === true`, issue a best-effort `supabase.storage.from('wear-photos').remove([path])`. Log-only on failure — don't retry, don't block the user-facing response. Scheduled cleanup cron is deferred to a future phase (Phase 11 D-04 posture carried forward).

### Pitfall 9: Sonner Toaster inside Suspense → toast disappears mid-transition (H-1)

**What goes wrong:** User submits, page transitions, Suspense re-renders, the toast layer unmounts, toast is never seen.

**How to avoid:** Mount `<ThemedToaster />` as a **sibling** of the three Suspense wrappers in `src/app/layout.tsx`, not inside any of them. See Pattern 10.

### Pitfall 10: Sonner theme mismatch with custom ThemeProvider (H-3)

**What goes wrong:** Toast renders light on a dark page (or vice-versa).

**How to avoid:** `ThemedToaster` is a Client Component that reads `useTheme()` from Horlo's `src/components/theme-provider.tsx` (NOT `next-themes`, which is forbidden under `cacheComponents: true`). Pass `resolvedTheme` to Sonner's `theme` prop.

### Pitfall 11: `toast()` called inside Server Action (H-2)

**What goes wrong:** TypeError on the server — no DOM, no Sonner. Or worse, if a bundler shim exists, the call executes server-side and nothing appears in the user's browser.

**How to avoid:** Server Actions return `ActionResult<T>`. Client Component submit handler inspects `result.success` and calls `toast.success(...)` OR sets an inline `role="alert"` error banner.

### Pitfall 12: Storage folder enforcement bypass (F-4)

**What goes wrong:** Client uploads to `otherUserId/fake.jpg` — RLS blocks it, but only because the Phase 11 Storage RLS policy already enforces `(storage.foldername(name))[1] = auth.uid()::text`. If the Server Action path doesn't match the Storage RLS, one layer could be bypassed.

**How to avoid:** The path convention `{userId}/{wearEventId}.jpg` is constructed server-side in the Server Action for the existence-check (`supabase.storage.from('wear-photos').list(user.id, {search: ...})`). The client also uses this convention in `uploadWearPhoto(userId, wearEventId, blob)` but the Storage RLS is the authoritative gate — a compromised client cannot upload into someone else's folder. [VERIFIED: `supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql` lines 96-105]

## Code Examples

### Common Operation 1: Stop MediaStream tracks + null srcObject

```tsx
// Source: MDN MediaStream.getTracks() + WebKit bug 179363 pattern
function stopStream(stream: MediaStream | null, video: HTMLVideoElement | null) {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
  }
  if (video) video.srcObject = null
}
```

### Common Operation 2: Capture a frame from a video to a JPEG blob

```tsx
// Source: MDN HTMLVideoElement + canvas.toBlob pattern
async function captureFrame(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(video, 0, 0)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/jpeg',
      0.85,
    ),
  )
}
```

### Common Operation 3: Lazy-load a fallback library

```tsx
// Source: PITFALLS.md E-2 exifr fallback pattern
async function detectOrientation(blob: Blob): Promise<number | undefined> {
  const { orientation } = await import('exifr/dist/lite.esm.js')
  return (await orientation(blob)) as number | undefined
}
```

### Common Operation 4: Mint a signed URL for a stored object

```tsx
// Source: Supabase JS docs https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
const supabase = await createSupabaseServerClient()
const { data, error } = await supabase.storage
  .from('wear-photos')
  .createSignedUrl(`${userId}/${wearEventId}.jpg`, 60 * 60) // 1 hour
const signedUrl = data?.signedUrl ?? null
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `imageOrientation: 'none'` enum value | `imageOrientation: 'from-image'` | WHATWG spec renamed; WebKit shipped in Safari 16.4 (spring 2023) | Older training-era code that uses `'none'` is now the opposite of its name. |
| FormData upload through Server Action | Client-direct upload + Server Action with metadata only | Next 13+, Supabase Storage `signedUrlUpload` / direct `.upload()` | Removes 4MB body limit; halves bandwidth; removes server-side file buffering. |
| `next-themes` for Sonner integration | Custom ThemeProvider wrapper | When `cacheComponents: true` adopted (Phase 10) | `next-themes` reads cookies directly; incompatible with cacheComponents. |
| Pass signed URL to `next/image` | Native `<img src={signedUrl}>` | When `images.unoptimized: true` was chosen | Avoids `next/image`'s query-param-stripping behavior breaking auth tokens. |
| `getUserMedia` with `{video: true}` | `{video: {facingMode: 'environment', width, height}}` | iOS 13+ | Rear camera for wrist shots; upfront resolution constraint avoids multi-MB raw streams. |

**Deprecated / outdated:**
- `document.cookie`-only theme reads in SSR — broken under `cacheComponents`; Horlo uses the inline `<script>` pattern.
- `MediaRecorder` for photo capture — overkill for a still; `<canvas>` capture is simpler.
- `navigator.getUserMedia` (legacy) — use `navigator.mediaDevices.getUserMedia`.

## Runtime State Inventory

*(Not applicable — Phase 15 is not a rename / refactor phase. It ships new code that composes Phase 11 + 12 + 14 foundations. No existing string, collection name, env var, or OS registration is renamed. No runtime state needs migration. This section is omitted per research template guidance.)*

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime | ✓ | matches repo (not pinned) | — |
| npm | `npm i sonner heic2any exifr` | ✓ | matches repo | — |
| Supabase CLI (local) | Integration tests against local DB | ✓ (assumed — Phase 11 tests use it) | — | Skip-suite gate on `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (matches existing pattern) |
| `exiftool` | EXIF-GPS-stripped verification | ✗ (`command -v exiftool` returns empty on dev machine) | — | Install via `brew install exiftool` before running EXIF check; OR use `exifr` in a Node script for parity; OR flag for manual UAT once. |
| HTTPS tunnel (ngrok / cloudflared) | iOS Safari camera testing | ✗ (not installed) | — | `npx ngrok http 3000` (no install) OR `brew install cloudflared` for stable URL. |
| Real iOS device | iOS Safari camera UAT | **Required for UAT cycle** | — | No fallback — iOS Simulator does NOT grant real camera; must test on a physical iPhone/iPad. |

**Missing dependencies with no fallback:**
- Real iOS device for camera UAT — must be arranged before Phase 15 ships. Desktop Safari is insufficient (different gesture-context behavior).

**Missing dependencies with fallback:**
- `exiftool` — planner may install locally or rely on `exifr` for verification (`exifr.parse(storedBlob)` returns `{GPSLatitude: undefined, ...}` when EXIF is stripped). Document in phase plan's integration-test task.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest` 2.1.9 (jsdom environment) — per `package.json` line 51 and `vitest.config.ts` |
| Config file | `/Users/tylerwaneka/Documents/horlo/vitest.config.ts` |
| Quick run command | `npm run test -- tests/integration/phase15-wywt-photo-flow.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| WYWT-01 | Two-step modal: picker → compose | integration (RTL) | `npm run test -- tests/components/WywtPostDialog.test.tsx` | ❌ Wave 0 |
| WYWT-02 | "Change" link returns to Step 1 with note/visibility preserved | integration (RTL) | same as WYWT-01 | ❌ Wave 0 |
| WYWT-03 | Submit with no photo valid | integration (RTL) | same as WYWT-01 | ❌ Wave 0 |
| WYWT-04 | Camera gesture rule + overlay renders | **manual-only** iOS UAT (jsdom cannot simulate iOS gesture context) | manual checklist in phase plan | n/a |
| WYWT-05 | HEIC conversion via worker | integration (jsdom has no Worker impl reliably; test the dispatcher path with a mocked worker) | `npm run test -- tests/components/PhotoUploader.test.tsx` | ❌ Wave 0 |
| WYWT-06 | EXIF stripped + 1080px resize | integration (`canvas.toBlob` then `exifr.parse` on output) | `npm run test -- tests/lib/exif-strip.test.ts` | ❌ Wave 0 |
| WYWT-07 | 200-char counter UX | unit (RTL) | same as WYWT-01 | ❌ Wave 0 |
| WYWT-08 | Visibility selector default Public | unit (RTL) | same as WYWT-01 | ❌ Wave 0 |
| WYWT-12 | Duplicate-day: preflight disables + server 23505 surfaces | integration — DB | `npm run test -- tests/integration/phase15-wywt-photo-flow.test.ts` | ❌ Wave 0 |
| WYWT-15 | Client-direct upload + server validates Storage object | integration — Supabase | `npm run test -- tests/integration/phase15-wywt-photo-flow.test.ts` | ❌ Wave 0 |
| WYWT-16 | Sonner toast fires on success | integration (RTL + `@testing-library/user-event`; spy on `toast.success`) | same as WYWT-01 | ❌ Wave 0 |
| WYWT-17 | `/wear/[id]` three-tier gate; uniform 404 | integration — DB 9-cell matrix | `npm run test -- tests/integration/phase15-wear-detail-gating.test.ts` | ❌ Wave 0 |
| WYWT-18 | Rail tile tap unchanged; durable `/wear/[id]` URL | smoke | verified via existing `tests/integration/home-privacy.test.ts` no-regression | ✅ |
| WYWT-19 | Sonner mounted outside Suspense, inside ThemeProvider | unit (snapshot or DOM-structure assertion on layout render) | `npm run test -- tests/components/ThemedToaster.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- tests/integration/phase15-*.test.ts tests/components/Wywt*.test.tsx tests/lib/exif-strip.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`; manual iOS UAT checklist signed off.

### Wave 0 Gaps

- [ ] `tests/integration/phase15-wywt-photo-flow.test.ts` — end-to-end duplicate-day (WYWT-12), client-direct upload + server validation (WYWT-15), orphan-cleanup-on-23505 verification
- [ ] `tests/integration/phase15-wear-detail-gating.test.ts` — 9-cell privacy matrix (3 visibility × 3 viewer relations) mirroring `tests/integration/home-privacy.test.ts`
- [ ] `tests/components/WywtPostDialog.test.tsx` — RTL coverage for WYWT-01, 02, 03, 07, 08, 16
- [ ] `tests/components/PhotoUploader.test.tsx` — HEIC detection + worker dispatch (mocked); WYWT-05
- [ ] `tests/components/ThemedToaster.test.tsx` — placement + theme binding (WYWT-19)
- [ ] `tests/lib/exif-strip.test.ts` — canvas re-encode produces JPEG with no EXIF + correct 1080px cap (WYWT-06)
- [ ] **Manual UAT checklist in 15-PLAN:**
  - Real iPhone, iOS 16+ Safari, HTTPS tunnel URL
  - Tap "Take wrist shot" → permission prompt → allow → video preview + overlay
  - Capture → preview renders upright regardless of orientation
  - Camera deny → inline error renders; Upload path still works
  - Upload HEIC from Photos → converts successfully (bundle analyzer confirms `heic2any` in a separate worker chunk, not the route bundle)
  - Submit → "Wear logged" toast, modal closes, new tile on rail after refresh
  - Duplicate-day: pre-flight disables watch in picker; force-insert via dev tools → inline error, bounce back
  - `/wear/[id]` with an orientation-tagged source photo displays upright
  - `/wear/[id]` for a follower-only event is 404 to a non-follower

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Server Action requires `getCurrentUser()` (existing `@/lib/auth` wraps Supabase session — already used across Phase 6-14). |
| V3 Session Management | yes (indirect) | Supabase `@/supabase/ssr` handles session refresh; already in place. No new session surface in this phase. |
| V4 Access Control | **yes (critical)** | Two-layer privacy: Storage RLS (Phase 11, shipped) + DAL WHERE predicate (`getWearEventByIdForViewer`, new). Uniform 404 (Pitfall from Phase 8). |
| V5 Input Validation | **yes (critical)** | `zod` schema on `logWearWithPhoto` input (already installed per Phase 10). `wearEventId` must be UUID, `note` max 200, `visibility` enum, `watchId` UUID. |
| V6 Cryptography | no (no new crypto) | Signed URLs handled by Supabase; no hand-rolled HMAC. |
| V9 Communications | yes | HTTPS enforced by Next.js + Supabase; no new outbound calls. |
| V12 File and Resources | **yes (critical)** | Bucket is private; `content_type` locked to `image/jpeg` on upload; size limit 5MB at bucket level (Phase 11 migration); folder enforcement in RLS. |

### Known Threat Patterns for Browser Media Capture + Storage Upload

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user path write (upload `otherUserId/x.jpg`) | Elevation / Tampering | Supabase Storage RLS policy `wear_photos_insert_own_folder` (Phase 11 migration line 99-105). |
| Signed URL leak across users / requests | Information Disclosure | Per-request `createSignedUrl`; never inside `'use cache'`. TTL 60 min. |
| Photo existence leak via response differential | Information Disclosure | Uniform `notFound()` on `/wear/[id]` for missing OR denied. |
| EXIF GPS leak in stored photo | Information Disclosure | Canvas re-encode on ALL upload paths strips EXIF. Integration test verifies with `exifr` or `exiftool` on stored object. |
| Client hands-rolled `hasPhoto=true` but upload failed | Tampering | Server Action lists the expected path in Storage before insert; rejects when object absent. |
| Duplicate-day bypass via malformed UUID / race | Tampering / DoS | `zod` UUID validation + DB unique constraint (`wear_events_unique_day`); 23505 caught and returned as clean error. |
| Camera silently fails due to gesture-chain break | Denial of Service (UX) | `getUserMedia` first-await discipline; `NotAllowedError` caught and surfaced as actionable text. |
| Worker import poisoning | Tampering | `new URL('./heic-worker.ts', import.meta.url)` resolves at build time — no arbitrary URL loading. |
| Sonner toast XSS via note text | XSS | Sonner renders `toast()` content as text, not innerHTML; no user-provided content flows into the toast (message is the literal string `"Wear logged"`). Note text only renders on `/wear/[id]` which uses standard React text interpolation. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `createImageBitmap({imageOrientation: 'from-image'})` works on iOS Safari 16.4+ based on WebKit commit 253004@main landing Aug 2022. | §Pattern 5 / Pitfall 4 | If actually shipped later, even more users hit the `exifr` fallback — still correct but slightly fewer get the zero-cost path. Low risk: fallback is still correct. |
| A2 | The `new URL('./worker.ts', import.meta.url)` pattern ships under Next 16.2.3 with Turbopack as a separate chunk (not merged into the route bundle). | §Pattern 4 | If Turbopack folds the worker into the main chunk on this version, the ~600KB WASM savings disappear. Verifiable via dev build + Network-tab inspection; planner should spike this early. |
| A3 | The UI-SPEC's claim "createImageBitmap() auto-corrects EXIF orientation on iOS Safari 15+" is **incorrect** — actual support is Safari 16.4+. | UI-SPEC §EXIF strip + resize pipeline | Users on iOS 15.0-16.3 would see sideways photos without the exifr fallback. RESOLUTION: UI-SPEC should be updated OR the exifr fallback added. The locked decision (CONTEXT.md D-10) explicitly delegates this to the researcher; this research resolves it. |
| A4 | Client-generated `wearEventId` is unique enough (UUID v4) that RLS folder enforcement + UNIQUE constraint catch any collision. | §Pattern 7 | UUID v4 collision probability is 2^-122; effectively zero. No practical risk. |
| A5 | Supabase `.list(prefix, {search})` succeeds under server-client session and does NOT require service-role. | §Pattern 7 Server Action | If list requires service-role, the existence-probe needs a service-role client (more careful config). Verifiable in the Phase 15 executor smoke test. |
| A6 | `sonner@2.0.7` is API-compatible with `theme` prop values `'light' | 'dark' | 'system'` per the official docs page. | §Pattern 10 | If v2.0 changed the prop signature, a one-line fix. Source: Sonner official Toaster docs. |
| A7 | `heic2any` v0.0.4 strips all EXIF including GPS on conversion (author statement "resulting file doesn't have any metadata"). | §Don't Hand-Roll / §Pitfall 5 | If some metadata survives, canvas re-encode after HEIC conversion is the final strip — defense in depth already in place. |
| A8 | `exiftool` is NOT currently installed on the dev machine; `exifr` can substitute as a Node script for EXIF verification in integration tests. | §Validation Architecture | If `exifr` parses differently than `exiftool` on edge cases (e.g., malformed TIFF), test fidelity is slightly lower. Planner can install `exiftool` via Homebrew if exact parity is required. |
| A9 | `getWornTodayIdsForUser(userId, today)` narrow DAL is feasible without new migrations — the existing `wear_events` schema and indexes support `WHERE userId = ? AND wornDate = ?` efficiently (per existing `wear_events_watch_worn_at_idx` coverage, though that's on `(watchId, wornDate)` — a user-side query would full-scan `wearEvents` for that user, which is bounded by <500 wear events per user per PROJECT.md). | §Pattern 6 | If write-amplification becomes a concern, planner can add a `(userId, wornDate)` covering index. Low risk at MVP scale. |

**If this table is non-empty:** The planner should surface A3 (UI-SPEC inaccuracy) to the user in discuss-phase if any behavioral change is required. A2 is a spike-to-verify item that should appear in Plan 01's acceptance criteria.

## Open Questions

1. **Whether Turbopack under Next 16.2.3 emits `new URL('./heic-worker.ts', import.meta.url)` as a separate chunk.**
   - What we know: The pattern is the documented Next 13+ convention and the dev.to article claims it works in 2025. No reference in the Horlo repo yet.
   - What's unclear: No shipped example in the project; Turbopack-specific edge cases in worker chunk emission are poorly documented.
   - Recommendation: Phase 15 executor's first task (alongside `npm i sonner heic2any exifr`) is a spike that lands the worker skeleton and verifies in DevTools Network tab that the HEIC worker is a separate chunk only loaded when the user triggers HEIC conversion. If Turbopack misbehaves, fall back to webpack's classic-worker pattern: `new Worker('/workers/heic.js')` with a static public-folder entry.

2. **Does `supabase.storage.from(bucket).list(prefix, {search})` work under the session-scoped server client, or does it require service-role?**
   - What we know: The Storage RLS SELECT policy (Phase 11 line 67-91) authorizes authenticated users to list their own folder.
   - What's unclear: Whether `.list()` respects RLS identically to `.getPublicUrl()` / `.download()`. Supabase docs are ambiguous.
   - Recommendation: Write a one-off test that seeds a `wear-photos/{userA}/foo.jpg` object and tries `supabase.storage.from('wear-photos').list(userA, {search: 'foo.jpg'})` under userA's session token. If 0 rows, switch to service-role for the existence probe (server-only, safe).

3. **Signed URL TTL — 60 minutes vs a shorter window.**
   - What we know: Smart CDN caches per unique token. Longer TTL = more chance of the URL being copied/saved by a viewer.
   - What's unclear: Whether Horlo's threat model cares about exfiltration-via-copied-URL for private images.
   - Recommendation: 60 min (Claude's Discretion per CONTEXT.md). Revisit if users report stale-URL breakage from long-open tabs.

4. **Whether `not-found.tsx` needs to be created for the `/wear/[wearEventId]` segment, or if the root app `not-found.tsx` suffices.**
   - What we know: Next.js App Router walks up the segment tree for the nearest `not-found.tsx`.
   - What's unclear: The repo's root `not-found.tsx` status (let the planner verify at plan time). If missing, a minimal segment-local one is trivial.

## Environment Availability

*(Already covered above — see §Environment Availability section.)*

## Sources

### Primary (HIGH confidence)

- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md` — Next.js 16 `notFound()` canonical pattern.
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md` — Next.js 16 Server Action `use server` directive.
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` — Server Action patterns, `revalidatePath`, `startTransition` idiom.
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md` — `bodySizeLimit` default and override.
- `/Users/tylerwaneka/Documents/horlo/.planning/research/PITFALLS.md` §D / §E / §F / §H — Phase 15 pitfalls, already reviewed and adopted in CONTEXT.md.
- `/Users/tylerwaneka/Documents/horlo/supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql` — verified Storage RLS policies for `wear-photos` bucket.
- `/Users/tylerwaneka/Documents/horlo/supabase/migrations/20260423000001_phase11_wear_visibility.sql` — verified `wear_events` schema including `photo_url`, `visibility`, `note` CHECK.
- `/Users/tylerwaneka/Documents/horlo/src/data/wearEvents.ts` lines 102-162 — verified `getWearEventsForViewer` three-tier predicate to mirror.
- `/Users/tylerwaneka/Documents/horlo/src/components/home/WatchPickerDialog.tsx` — verified current prop shape and `markAsWorn` call site (lines 70-84).
- `/Users/tylerwaneka/Documents/horlo/src/components/layout/NavWearButton.tsx` — verified lazy-import pattern (lines 29-33).
- `/Users/tylerwaneka/Documents/horlo/src/components/theme-provider.tsx` — verified custom `useTheme` hook; does NOT use `next-themes`.
- `/Users/tylerwaneka/Documents/horlo/src/app/layout.tsx` — verified Suspense wrappers and `viewport-fit: cover`.

### Secondary (MEDIUM confidence — verified with official sources)

- [MDN createImageBitmap()](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap) — API signature, `imageOrientation` values.
- [caniuse createImageBitmap](https://caniuse.com/createimagebitmap) — Safari 17 full support; 15.0-16.7 partial.
- [WebKit commit 8758b1b — EXIF orientation when creating ImageBitmap from Blob](https://github.com/WebKit/WebKit/commit/8758b1b9f85526f462e6edb74d5c85228e15d90d) — Aug 2022 landing date; shipped Safari 16.4.
- [dev.to — Lazy-loading a 600KB WebAssembly library in Next.js](https://dev.to/calogero_cascio/lazy-loading-a-600kb-webassembly-library-in-nextjs-without-killing-your-bundle-51l4) — Worker + `new URL()` pattern for heic2any.
- [heic2any npm](https://www.npmjs.com/package/heic2any) — version 0.0.4, WASM bundling, metadata-stripped on conversion.
- [heic2any GitHub](https://github.com/alexcorvi/heic2any) — maintainer's statement "resulting file doesn't have any metadata".
- [Sonner Toaster docs](https://sonner.emilkowal.ski/toaster) — Toaster API, theme prop values, placement guidance.
- [Sonner GitHub](https://github.com/emilkowalski/sonner) — version 2.0.7 release notes.
- [exifr npm](https://www.npmjs.com/package/exifr) — version 7.1.3, tree-shakeable lite build.
- [exifr GitHub — EXIF orientation handling](https://github.com/MikeKovarik/exifr) — iOS Safari quirky-autorotation notes.
- [Supabase JS — storage.from().upload()](https://supabase.com/docs/reference/javascript/storage-from-upload) — upload API.
- [Supabase JS — storage.from().createSignedUrl()](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) — signed URL minting.
- [Supabase Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn) — token-keyed cache behavior.
- [PostgreSQL Error Codes Appendix A](https://www.postgresql.org/docs/current/errcodes-appendix.html) — 23505 unique_violation.

### Tertiary (LOW confidence — WebSearch only, flagged for validation)

- [Medium — Signed URL file uploads with NextJs and Supabase](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0) — community pattern for client-direct upload; cross-verified with Supabase official docs above.
- [MacRumors — Safari 17 release date](https://www.macrumors.com/2023/09/26/apple-releases-safari-17/) — Sep 26, 2023 general availability of Safari 17.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via `npm view` and cross-checked with official docs; `heic2any` and `exifr` have maintained positions in the 2025 ecosystem.
- Architecture: HIGH — mirrors established Phase 11/12 two-layer privacy and viewer-aware-DAL patterns; no new architectural departures.
- Pitfalls: HIGH — `.planning/research/PITFALLS.md` is project-local, already adopted in CONTEXT.md, and each pitfall has a direct code-level mitigation in this research.
- EXIF orientation resolution: MEDIUM — `createImageBitmap` primary + `exifr` fallback is a belt-and-braces approach; primary path confidence is MEDIUM (browser-support matrix shifts) but fallback is HIGH.
- Web Worker under Turbopack: MEDIUM — pattern is documented and in community use; no shipped reference in this repo, flagged as A2 for plan-time verification.
- Sonner + custom ThemeProvider: HIGH — `Sonner` docs explicitly show the custom-wrapper pattern; Horlo's theme-provider API is verified.
- Client-direct upload + server validates: HIGH — matches current Supabase + Next documentation and Phase 11 bucket policies already enforce the folder convention.
- Uniform 404 on `/wear/[id]`: HIGH — Next 16 `notFound()` is canonical; mirrors Phase 8 notes-IDOR precedent.

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — stack is stable, but `heic2any` / Turbopack worker behavior may shift; re-verify if Phase 15 lands after this window.)

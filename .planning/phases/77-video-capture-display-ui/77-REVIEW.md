---
phase: 77-video-capture-display-ui
reviewed: 2026-06-23T18:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/lib/wywtTypes.ts
  - src/data/wearEvents.ts
  - src/hooks/useMediaCapability.ts
  - src/lib/video/extractPosterBlob.ts
  - src/app/globals.css
  - src/components/wywt/VideoCaptureView.tsx
  - src/components/wywt/ComposeStep.tsx
  - src/components/wywt/WywtPostDialog.tsx
  - src/components/wear/VideoPlayBadge.tsx
  - src/components/wear/WearVideoClient.tsx
  - src/components/wear/WearCard.tsx
  - src/components/home/WywtTile.tsx
  - src/components/home/WywtRail.tsx
  - src/components/wears/WearsLane.tsx
  - src/app/wear/[wearEventId]/page.tsx
  - src/app/page.tsx
  - src/app/wears/[username]/page.tsx
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 77: Code Review Report

**Reviewed:** 2026-06-23T18:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 77 ships the WYWT video capture + display surfaces alongside the existing photo flow. The implementation is largely careful — stream-as-prop discipline is preserved in `VideoCaptureView`, the `MediaState` discriminated union correctly forbids photo+video coexistence at compile time, the cancel-during-recording guard uses a ref to avoid the microtask re-entrance hole, and the photo submit branch is functionally preserved (VID-15 invariant on the submit pipeline).

However, three Critical issues create user-visible breakage or data leakage:

1. **Storage RLS does not match the `-poster.jpg` filename pattern.** The Phase 11 RLS policy uses `split_part(storage.filename(name), '.', 1)` to extract the `wear_event_id`. For `{userId}/{wearEventId}-poster.jpg`, that expression resolves to `{wearEventId}-poster`, which never matches any `wear_events.id`. Non-owner viewers (public + followers tiers) cannot read posters — the rail poster tile and the unavailable-video fallback both fail closed to a "Video unavailable" gray box for every follower viewer. The same migration that added `video/mp4` to `allowed_mime_types` (Phase 76) did NOT add a policy update.

2. **Signed URLs are minted via the cookie-bound `createSupabaseServerClient`, not the admin client** that the inline comments claim. The cookie client signs as the *viewer*, so even if RLS were fixed (above), a follower trying to sign `{actorId}/{wearEventId}.mp4` is gated by the Phase 11 SELECT policy's wear_events join — which is the same policy that suffers known SECDEF brittleness (see Migration 4b note). The durable memory `project_ppr_dynamic_before_use_cache` and the Phase 61 retrospective both record "sign URLs via admin client not cookie client" as the correct pattern. The code comments at `src/app/page.tsx:56`, `src/app/wear/[wearEventId]/page.tsx:181`, and `src/app/wears/[username]/page.tsx:134` all describe the client as "admin" but call `createSupabaseServerClient()`.

3. **Photo-path VID-15 regression on the WywtTile fallback chain.** When `mediaType === 'video'` AND `signedPosterUrl` is null (mint failure), `WywtTile` falls through to `(tile.photoUrl ?? tile.imageUrl)` while still rendering `VideoPlayBadge`. For a video wear, `photoUrl` is always null (per `logWearWithVideo`), so the catalog `imageUrl` is shown with a Play badge superimposed — a misleading visual that suggests the catalog stock image plays. Pre-77 video tiles did not exist; pre-77 photo tiles never showed a Play badge.

Warnings cover orphan Storage on non-Storage validation failure (Watch not found leaks ~5 MB to the bucket), an in-flight Promise hang risk in poster extraction, and silent failure swallowing in submission paths. Info items cover minor polish, redundant cleanup, and a couple of dead-code branches.

## Critical Issues

### CR-01: Storage RLS does not match the `-poster.jpg` filename — posters unreadable by non-owner viewers

**File:** `supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql:76,86` (policy referenced; not modified by Phase 77)
**Files touched by Phase 77 that depend on this:** `src/app/page.tsx:52-77`, `src/app/wear/[wearEventId]/page.tsx:182-191`, `src/app/wears/[username]/page.tsx:135-164`, `src/components/wear/WearVideoClient.tsx:48`

**Issue:** The `wear_photos_select_three_tier` policy resolves the wear_event_id from the object name via:

```sql
split_part(storage.filename(name), '.', 1) = wear_event_id
```

The two paths Phase 77 stores are `{userId}/{wearEventId}.mp4` and `{userId}/{wearEventId}-poster.jpg`:

- For `.mp4`: `storage.filename` → `{wearEventId}.mp4`; `split_part('.', 1)` → `{wearEventId}` (matches).
- For `-poster.jpg`: `storage.filename` → `{wearEventId}-poster.jpg`; `split_part('.', 1)` → `{wearEventId}-poster` (no match — wear_events.id is a bare UUID).

Branch 1 of the policy (owner) still works because it matches on `(storage.foldername(name))[1] = auth.uid()`. Branches 2 (public-visibility) and 3 (followers-visibility) both fail closed for posters.

Effect:
- Home rail poster tiles: when the actor is anyone except the viewer, `signedPosterUrl` will be null on the server because the cookie client (CR-02) signing the URL has no read permission via RLS. The tile falls through to `(tile.photoUrl ?? tile.imageUrl)` and renders the catalog image under a Play badge (also CR-03).
- Detail page (`/wear/[id]`) and lane (`/wears/[username]`): the `WearVideoClient` enters the error fallback branch (`!signedVideoUrl` OR `<video onError>`), showing "Video unavailable" with no poster behind it (since signedPosterUrl is also null).

This is the most user-visible failure mode of Phase 77 — every non-owner who views a video wear gets a broken poster.

**Fix:** Add a new migration that either (a) widens the regex to capture an optional `-poster` suffix, or (b) extracts the wear_event_id from the FIRST 36 characters of the filename (UUID length). Option (b) is more robust:

```sql
-- New migration: 20260623000000_phase77_storage_rls_poster_match.sql
BEGIN;

DROP POLICY IF EXISTS wear_photos_select_three_tier ON storage.objects;
CREATE POLICY wear_photos_select_three_tier ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'wear-photos'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM wear_events we
        WHERE we.id::text = substring(storage.filename(name) FROM 1 FOR 36)
          AND we.visibility = 'public'
      )
      OR EXISTS (
        SELECT 1
          FROM wear_events we
          JOIN follows f ON f.following_id = we.user_id
         WHERE we.id::text = substring(storage.filename(name) FROM 1 FOR 36)
           AND we.visibility = 'followers'
           AND f.follower_id = (SELECT auth.uid())
      )
    )
  );

COMMIT;
```

This also matches the existing `.mp4` and `.jpg` files because the first 36 characters are always the UUID. If the SECDEF helper from Migration 4b is in play (the comment block at the top of Migration 4 warns it is), apply the same `substring(..., 1, 36)` widening to that helper instead.

---

### CR-02: Signed URLs minted with cookie-bound `createSupabaseServerClient`, not the admin client

**File:** `src/app/page.tsx:56`, `src/app/wear/[wearEventId]/page.tsx:181,193`, `src/app/wears/[username]/page.tsx:134`

**Issue:** The page-level signed-URL minting helpers all use:

```ts
const supabase = await createSupabaseServerClient()
const { data } = await supabase.storage
  .from('wear-photos')
  .createSignedUrl(path, 60 * 60)
```

`createSupabaseServerClient` is defined in `src/lib/supabase/server.ts` as a `createServerClient` from `@supabase/ssr` bound to the user's cookie session and the **anon key**. This means:

1. The signing call runs as the **viewer**, not as a privileged service-role caller.
2. Whether a signed URL is minted at all is gated by the viewer's RLS read permission on the target storage object.
3. The Phase 11 RLS policy includes a wear_events join that historically had to be patched via Migration 4b (SECDEF helper) because `wear_events` is owner-only RLS. The codebase memory note `project_ppr_dynamic_before_use_cache` records "sign URLs via admin client not cookie client" as the corrective pattern (Phase 61 commit 8a49a19+5ea4291).

The inline comments at all three call sites describe the signer as "admin client" — for example `src/app/wear/[wearEventId]/page.tsx:174` reads: *"Phase 77 (VID-14, T-77-03): admin client mints signed URLs for both video paths in parallel..."* — but the actual code at L181 calls `createSupabaseServerClient()`. Either the comments are wrong (and the code has the bug above) or the plan intended an admin-client call but shipped the cookie client.

Combined with CR-01, this is a double-failure: even if CR-01 is fixed, the cookie client may still fail to sign poster/video URLs for non-owner viewers because of edge cases in the SECDEF helper or future RLS tightening. The Phase 61 pattern (`createSupabaseAdminClient()`) is the canonical defense.

**Fix:** Switch the three minting sites to the admin client. The admin client is already exported from `src/lib/supabase/admin.ts:18` and is used by `signCoverUrls.ts` for the same purpose:

```ts
// src/app/page.tsx
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

if (tilesWithPhotos.length > 0 || tilesWithVideos.length > 0) {
  const supabase = createSupabaseAdminClient()
  // ... rest unchanged
}

// src/app/wear/[wearEventId]/page.tsx — WearPhotoStreamed
if (mediaType === 'video') {
  const supabase = createSupabaseAdminClient()
  // ...
} else if (photoUrl) {
  const supabase = createSupabaseAdminClient()
  // ...
}

// src/app/wears/[username]/page.tsx
const supabase = createSupabaseAdminClient()
const signedTriples = await Promise.all(
  wears.map(async (w) => {
    // ... rest unchanged
  })
)
```

Note: the admin client must NEVER be imported into a Client Component. All three sites are Server Components or server child functions, so this is safe.

Also update the inline comments to match reality.

---

### CR-03: `WywtTile` shows catalog image with Play badge when poster signing fails — confusing visual + VID-15 regression for video tiles

**File:** `src/components/home/WywtTile.tsx:103-130`

**Issue:** The tile media chain is:

```tsx
{mediaType === 'video' && signedPosterUrl ? (
  <Image src={signedPosterUrl} ... />
) : (tile.photoUrl ?? tile.imageUrl) ? (
  <Image src={tile.photoUrl ?? tile.imageUrl ?? ''} ... />
) : (
  <div>{/* watch icon placeholder */}</div>
)}
{mediaType === 'video' && <VideoPlayBadge />}
```

When `mediaType === 'video'` AND `signedPosterUrl` is null (the failure mode triggered by CR-01 / CR-02), the second branch fires. For a video wear, `tile.photoUrl` is null (the DAL only populates photoUrl for `mediaType='photo'`), so the catalog `imageUrl` renders. But the `VideoPlayBadge` line below **unconditionally** renders for `mediaType === 'video'`. The result: the user sees a stock catalog product photo with a Play icon on top, suggesting that tapping plays the catalog photo as a video. Tapping actually navigates to the lane, where `WearVideoClient` will render the "Video unavailable" fallback (because the same signing problem affects the lane).

This is also a soft VID-15 regression — pre-77 photo tiles never rendered a Play badge. Even after CR-01/CR-02 are fixed, a brief network glitch during signing would still produce this mislead. The badge needs to be conditional on actually having a poster to play.

**Fix:** Gate `VideoPlayBadge` on `signedPosterUrl !== null`, OR move it inside the first branch where the poster is known to render:

```tsx
{mediaType === 'video' && signedPosterUrl ? (
  <>
    <Image src={signedPosterUrl} alt="" fill className="object-cover" unoptimized />
    <VideoPlayBadge />
  </>
) : (tile.photoUrl ?? tile.imageUrl) ? (
  <Image
    src={tile.photoUrl ?? tile.imageUrl ?? ''}
    alt=""
    fill
    className="object-cover"
    unoptimized
  />
) : (
  <div className="absolute inset-0 bg-muted flex items-center justify-center">
    <WatchIcon className="text-muted-foreground" aria-hidden />
  </div>
)}
```

Removing the trailing `{mediaType === 'video' && <VideoPlayBadge />}` keeps the photo-tile path byte-identical to pre-77.

## Warnings

### WR-01: `logWearWithVideo` leaves orphan Storage objects when validation fails after upload (~5 MB leak per attempt)

**File:** `src/app/actions/wearEvents.ts:319-342` (validation), `src/components/wywt/ComposeStep.tsx:337-378` (client-side upload order)

**Issue:** The client uploads video + poster BEFORE the Server Action is called (ComposeStep L341-356). The Server Action then runs:

1. Auth check (L313-319) — fail returns `Not authenticated`, NO cleanup.
2. Zod parse (L322-326) — fail returns `Invalid input`, NO cleanup.
3. 5 MB byte gate (L332-334) — fail returns `Video too large`, NO cleanup.
4. Watch ownership lookup (L339-342) — fail returns `Watch not found`, NO cleanup.

Only paths 5+ (Storage probe, DAL insert) include compensating `storage.remove([videoPath, posterPath])` calls. The earlier paths leave the uploaded video (up to 5 MB) and poster in Storage as orphans. The photo path has the same pre-existing pattern but with much smaller blobs (≤1080px JPEG, ~50-300 KB).

A malicious caller could repeatedly upload + provide an invalid `watchId` to spam the bucket with 5 MB orphans. The Storage RLS folder-enforcement (Phase 11) limits damage to the attacker's own folder, so this is a self-DoS rather than a cross-user attack — but the bucket has a 5 MB per-file limit, not a per-user quota.

**Fix:** Either (a) reorder the Server Action to run validation BEFORE the client uploads (would require a two-call pattern: validate → upload → finalize), or (b) add compensating cleanup to the early-exit paths. Option (b) is simpler:

```ts
// After auth check passes:
async function cleanupOrphans() {
  try {
    const supabase = await createSupabaseServerClient()
    await supabase.storage
      .from('wear-photos')
      .remove([
        `${user.id}/${parsed.data.wearEventId}.mp4`,
        `${user.id}/${parsed.data.wearEventId}-poster.jpg`,
      ])
  } catch {
    // best-effort
  }
}

// In each early-exit:
if (!parsed.success) {
  // we don't have a wearEventId yet on parse failure, but path is server-built from input.wearEventId — guard accordingly
  return { success: false, error: 'Invalid input' }
}
if (parsed.data.videoBytes > 5 * 1024 * 1024) {
  await cleanupOrphans()
  return { success: false, error: 'Video too large — maximum 5 MB' }
}
const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
if (!watch) {
  await cleanupOrphans()
  return { success: false, error: 'Watch not found' }
}
```

(Same fix is advisable for `logWearWithPhoto` to handle Photo-path leakage, but that's pre-77.)

---

### WR-02: `extractPosterBlob` can hang forever — no timeout on `onloadedmetadata` / `onseeked`

**File:** `src/lib/video/extractPosterBlob.ts:16-52`

**Issue:** The promise resolves only when `video.onseeked` fires AND `canvas.toBlob` succeeds. There is no timeout, no `video.load()` call, no handler for `video.onstalled` / `onabort`. If the captured Blob is malformed (unlikely on iOS Safari but possible on other browsers), the metadata event may never fire and the promise hangs indefinitely. The caller (`VideoCaptureView.onstop`) awaits the promise and `setExtracting(true)` is never cleared, leaving the UI stuck on "Processing…" forever.

Also: `video.duration` can be `Infinity` for some webm streams. Setting `video.currentTime = Infinity * 0.75 = NaN` typically causes `onseeked` to never fire.

**Fix:** Add a timeout race + duration sanity check:

```ts
export async function extractPosterBlob(videoBlob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoBlob)
    let settled = false
    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.src = ''
    }
    const fail = (msg: string) => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(msg))
    }
    const succeed = (blob: Blob) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(blob)
    }

    const timeoutId = setTimeout(() => fail('poster extraction timed out'), 8000)

    video.src = url
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        clearTimeout(timeoutId)
        fail('video duration unavailable')
        return
      }
      video.currentTime = video.duration * 0.75
    }
    video.onseeked = () => {
      clearTimeout(timeoutId)
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { fail('canvas ctx unavailable'); return }
      ctx.drawImage(video, 0, 0)
      canvas.toBlob(
        (blob) => blob ? succeed(blob) : fail('canvas.toBlob returned null'),
        'image/jpeg',
        0.85,
      )
    }
    video.onerror = () => { clearTimeout(timeoutId); fail('video load failed') }
  })
}
```

---

### WR-03: `WearVideoClient` does not handle `v.play()` Promise rejection — silent autoplay failure

**File:** `src/components/wear/WearVideoClient.tsx:85-95`

**Issue:** The tap handler calls `v.play()` without awaiting or `.catch()`-ing. `HTMLMediaElement.play()` returns a Promise that rejects when autoplay policy denies the request (e.g., the user has disabled autoplay, or audio context isn't ready). The rejection becomes an unhandled promise rejection, and the UI state (`setPaused(false)`) is updated even though the video stays paused.

**Fix:**

```tsx
onClick={() => {
  const v = videoRef.current
  if (!v) return
  if (v.paused) {
    v.play()
      .then(() => setPaused(false))
      .catch(() => {
        // Autoplay policy denied or video element in error state — keep UI in paused state.
        setPaused(true)
      })
  } else {
    v.pause()
    setPaused(true)
  }
}}
```

The initial `<video autoPlay>` may also fail silently on first mount; consider an `onPlay` / `onPause` event listener pair so the UI state reflects actual media state regardless of which path triggers play/pause.

---

### WR-04: `WywtPostDialog` duplicates close-reset logic in `handleOpenChange` AND `setPrevOpen` block — risks state-clear race during in-flight processing

**File:** `src/components/wywt/WywtPostDialog.tsx:108-139`

**Issue:** Two separate code paths reset draft state on close:

1. `handleOpenChange(false)` at L108-118 (called by the Dialog's internal close).
2. State-during-render block at L128-139 (triggered when parent flips `open` to false out-of-band).

Both clear `mediaState`, `note`, `visibility`, `wornTodayIds`, `step`, `selectedWatchId`. If a parent sets `open={false}` while the submit pipeline in `ComposeStep` is still awaiting `logWearWithVideo` (or just got back a failure), the state-during-render branch wipes `mediaState` while ComposeStep's effect cleanup may still be holding the videoPreviewUrl object URL. The URL is revoked on unmount, but the user's draft (note + visibility + media) is gone — they can't retry.

In practice this is unlikely (parent only flips `open=false` after `onSubmitted()` returns), but the duplication makes the safety guarantee load-bearing on the parent's discipline.

**Fix:** Consolidate the reset into a single helper invoked from both paths:

```tsx
const resetDraft = useCallback(() => {
  setStep('picker')
  setSelectedWatchId(null)
  setMediaState({ kind: 'none' })
  setNote('')
  setVisibility('public')
  setWornTodayIds(undefined)
}, [])

const handleOpenChange = (next: boolean) => {
  if (!next) resetDraft()
  onOpenChange(next)
}

const [prevOpen, setPrevOpen] = useState(open)
if (prevOpen !== open) {
  setPrevOpen(open)
  if (!open) resetDraft()
}
```

Long-term: if the dialog needs to support recovery from a transient submit failure, gate the parent-driven close on the submit transition (e.g., expose a `canClose` flag) instead of allowing arbitrary state clearing.

---

### WR-05: Video Blob MIME type uses the full codec descriptor — may break downstream playback / download

**File:** `src/components/wywt/VideoCaptureView.tsx:105`

**Issue:** `new Blob(chunksRef.current, { type: preferredMimeType })` where `preferredMimeType` is e.g. `'video/mp4;codecs=avc1'`. Some browsers and download flows expect a base MIME (`video/mp4`) for `Blob.type`. The codec parameter is informational for `MediaRecorder.isTypeSupported()` but is not a valid `Content-Type` for many consumers (Supabase Storage included — the bucket's `allowed_mime_types` list contains `'video/mp4'`, not `'video/mp4;codecs=avc1'`).

ComposeStep then uses `contentType: mediaState.videoBlob.type` on the Supabase upload (L344). If the bucket's MIME validation is strict-equality (it is — `allowed_mime_types` is a `text[]` of exact matches), the upload will reject on browsers that report a parameterized MIME.

On iOS Safari this happens to coincidentally work because Safari emits `video/mp4` as the blob type even when MediaRecorder was constructed with the codec form. On Android Chrome the Blob.type does reflect the parameterized form and the upload would 400. Spike 001 was iOS-only — Android was not tested.

**Fix:** Strip the codec parameter before constructing the Blob, or set the contentType explicitly on the upload:

```ts
// In VideoCaptureView:
const baseMime = preferredMimeType.split(';')[0] // 'video/mp4' | 'video/webm'
const videoBlob = new Blob(chunksRef.current, { type: baseMime })
```

Or in ComposeStep:
```ts
const { error: videoError } = await supabase.storage
  .from('wear-photos')
  .upload(videoPath, mediaState.videoBlob, {
    contentType: mediaState.videoBlob.type.split(';')[0],
    upsert: false,
  })
```

Note that Phase 76's migration only adds `'video/mp4'` to `allowed_mime_types`, not `'video/webm'` — so any non-iOS path that emits webm will be rejected by the bucket regardless. If video capture support beyond iOS Safari is a non-goal, document that explicitly; the `MIME_CANDIDATES` array in `useMediaCapability.ts` advertises webm support that the bucket cannot accept.

---

### WR-06: `WearVideoClient` failed-fallback branch still renders `WearPhotoOverlays` with `hasPhoto={!!signedPosterUrl}` — overlays float on a gray box

**File:** `src/components/wear/WearVideoClient.tsx:48-78`

**Issue:** When `failed || !signedVideoUrl`, the component renders a gray `bg-muted` container with the optional poster `<img>` inside, then unconditionally renders `WearPhotoOverlays`. When `signedPosterUrl` is also null (the common CR-01 case for non-owner viewers), the overlays render on top of a bare gray box. The username + brand text in the overlays is positioned with absolute coords intended for an image background; against the gray muted color it may have insufficient contrast.

Also: the `aria-label={altText}` on the container claims this is a photo of the user wearing the watch, but the actual content is "Video unavailable" — the screen reader announcement is inaccurate.

**Fix:** Make the fallback announce its actual state, and consider rendering a more obvious unavailable state when neither video nor poster is signable:

```tsx
if (failed || !signedVideoUrl) {
  return (
    <div
      data-testid="wear-video-container"
      className="relative w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto md:max-h-[70vh]"
      aria-label="Video unavailable"
    >
      {signedPosterUrl ? (
        <img src={signedPosterUrl} alt="" className="w-full h-full object-cover" />
      ) : null}
      <span className="absolute bottom-[60px] left-3 z-10 text-xs font-semibold text-white/90 drop-shadow">
        Video unavailable
      </span>
      <WearPhotoOverlays
        // ... unchanged
        hasPhoto={!!signedPosterUrl}
      />
    </div>
  )
}
```

The `text-white/70` was changed to `text-white/90 drop-shadow` so the label is legible on the gray fallback background (no image behind it).

## Info

### IN-01: Hardcoded SVG ring circumference '138' diverges slightly from real (2π × 22 ≈ 138.23)

**File:** `src/app/globals.css:186-203`, `src/components/wywt/VideoCaptureView.tsx:202-203`

**Issue:** The keyframe `from: stroke-dashoffset: var(--ring-circumference, 138)` and the SVG `strokeDasharray="138" strokeDashoffset="138"` both use 138. The actual circumference of a circle with r=22 is 2π × 22 ≈ 138.230. The 0.23 px shortfall causes the ring's end and start to overlap slightly (a tiny visible seam) at animation start. Probably imperceptible at 44 px size, but the comment in CSS says 138 is "≈ 2π × 22" — using 138.23 (or the exact form `calc(2 * 3.14159265 * 22)` if you prefer) would make the docs match the math.

**Fix:** Use 138.23 or `2 * Math.PI * 22` precomputed; or accept the discrepancy and remove the "≈" from the comment.

---

### IN-02: `VideoCaptureView` `aria-live` region is empty after extraction completes — no announcement that the post-capture preview is up

**File:** `src/components/wywt/VideoCaptureView.tsx:162-164`

**Issue:** `<span aria-live="polite">` announces "Recording started" while `recording` is true and "Recording complete" while `extracting` is true. After extraction completes, both flags are false and the live region is emptied. Screen reader users get no confirmation that the post-capture preview has appeared — ComposeStep moves on to show the preview but the focus / announcement context is lost.

**Fix:** Either move the announcement to ComposeStep when `mediaState.kind === 'video'`, or keep a "Video ready — review and submit" message in the live region for a short period after success.

---

### IN-03: Dead-code branch: `else if (at === 'last')` cannot trigger when `fromWearEventId` is also missing AND `wears.length === 1`

**File:** `src/app/wears/[username]/page.tsx:179-185`

**Issue:** When `wears.length === 1` (single-wear lane) and the user backward-crosses from a multi-wear neighbor's first slide, `goToNeighbor('prev')` appends `?at=last` (WearsLane.tsx:232). Here `at === 'last'` sets `initialSlideIndex = wears.length - 1 = 0`. The branch is harmless but redundant for single-wear lanes. Not a defect — flagging as code smell only.

**Fix:** None required; the redundancy is acceptable for readability.

---

### IN-04: `ComposeStep` `useMemo([mediaState])` recomputes object URL on every reference change

**File:** `src/components/wywt/ComposeStep.tsx:319-323`

**Issue:** `videoPreviewUrl = useMemo(() => mediaState.kind === 'video' ? URL.createObjectURL(mediaState.videoBlob) : null, [mediaState])`. The dep is the whole `mediaState` object; any time the parent's `setMediaState(...)` is called with a new object identity (even with semantically identical content), a new object URL is allocated and the previous one is revoked via the cleanup effect. The current callers only set new MediaState identities on real transitions (none → video, video → none) so this is fine in practice, but the more robust dep would be `[mediaState.kind === 'video' ? mediaState.videoBlob : null]`.

**Fix:** Optional. Switch the dep to the blob identity:

```ts
const videoBlobForPreview = mediaState.kind === 'video' ? mediaState.videoBlob : null
const videoPreviewUrl = useMemo(
  () => videoBlobForPreview ? URL.createObjectURL(videoBlobForPreview) : null,
  [videoBlobForPreview],
)
```

---

_Reviewed: 2026-06-23T18:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

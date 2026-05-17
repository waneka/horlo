---
phase: 43-polish-pass
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/components/profile/AvatarUploader.tsx
  - src/components/profile/CollectionTabContent.tsx
  - src/components/profile/ProfileEditForm.tsx
  - src/components/profile/ProfileHeader.tsx
  - src/components/profile/ProfileWatchCard.tsx
  - src/components/profile/WishlistTabContent.tsx
  - src/components/search/FilterDrawer.tsx
  - src/components/search/SearchPageClient.tsx
  - src/lib/extractors/llm.ts
  - src/lib/storage/avatarPhotos.ts
  - supabase/migrations/20260516000000_phase43_avatar_bucket.sql
  - tests/components/profile/AvatarUploader.test.tsx
  - tests/components/profile/CollectionTabContent.test.tsx
  - tests/components/profile/ProfileWatchCard.test.tsx
  - tests/components/profile/WishlistTabContent.test.tsx
  - tests/components/search/FilterDrawer.test.tsx
  - tests/extractors/llm.test.ts
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-05-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 43 is a polish pass: avatar upload with interactive crop (`AvatarUploader` +
`avatarPhotos` storage helper + Supabase bucket migration), add-watch button
relocation in the profile tabs, the search `FilterDrawer`, and an LLM extractor
model-ID bump.

The avatar pipeline contains one BLOCKER: `getCroppedBlob` loads the source image
without waiting for decode errors and, more importantly, the crop output is
uploaded to Supabase but the resulting public URL is then re-validated through a
`z.string().url().max(500)` schema — a Supabase Storage public URL is well under
500 chars so that is fine, but `getCroppedBlob` itself silently produces a blank
or corrupt image when the `<img>` fails to load because `image.onerror` is never
wired. Several robustness gaps in the avatar flow and one stale-prop hazard in the
wishlist drag grid round out the warnings. The non-avatar files are generally
sound.

## Critical Issues

### CR-01: `getCroppedBlob` never handles image decode failure — silent corrupt upload

**File:** `src/components/profile/AvatarUploader.tsx:59-87`
**Issue:** `getCroppedBlob` creates `new window.Image()`, sets `image.src`, and
awaits a Promise that only resolves on `image.onload`. `image.onerror` is never
assigned. If the object-URL fails to decode (corrupt file, unsupported codec, a
HEIC that slipped past `isHeicFile`, or a revoked URL), the Promise never
resolves and `handleConfirmCrop` hangs forever with `uploading` stuck `true` —
the "Confirm crop" button is permanently disabled and the spinner never stops.
There is no timeout and no `catch` path can fire because the awaited Promise
simply never settles. This is a hard hang with no recovery short of a page
reload, and the `finally { setUploading(false) }` block is unreachable.

Additionally `ctx.drawImage` runs even if `image` decoded to zero dimensions
(some partial decodes), producing a blank canvas that is then uploaded as the
user's avatar with no error surfaced.

**Fix:**
```ts
async function getCroppedBlob(src: string, cropArea: Area): Promise<Blob> {
  const image = new window.Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Image failed to decode'))
    image.src = src
  })
  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    throw new Error('Image decoded with zero dimensions')
  }
  const canvas = document.createElement('canvas')
  canvas.width = cropArea.width
  canvas.height = cropArea.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.drawImage(
    image, cropArea.x, cropArea.y, cropArea.width, cropArea.height,
    0, 0, cropArea.width, cropArea.height,
  )
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('toBlob returned null'))),
      'image/jpeg', 0.9,
    ),
  )
}
```
The `onerror` rejection then propagates into `handleConfirmCrop`'s `catch`, which
sets the inline error and `finally` clears `uploading`.

## Warnings

### WR-01: `getContext('2d')!` non-null assertion can crash

**File:** `src/components/profile/AvatarUploader.tsx:68`
**Issue:** `const ctx = canvas.getContext('2d')!` uses a non-null assertion.
`getContext` legitimately returns `null` (e.g. context already lost, or a browser
with canvas disabled). When it does, the next line `ctx.drawImage(...)` throws a
`TypeError: Cannot read properties of null`. The thrown error is caught by
`handleConfirmCrop`'s generic catch and shown as "Upload failed" — misleading,
but at least it does not hang. Still, the assertion hides a real null case.

**Fix:** Replace `!` with an explicit guard (see CR-01 fix snippet):
```ts
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('2D canvas context unavailable')
```

### WR-02: HEIC conversion worker leaks if neither `onmessage` nor `onerror` fires

**File:** `src/components/profile/AvatarUploader.tsx:39-57`
**Issue:** `convertHeic` spawns a `Worker` and only terminates it inside
`worker.onmessage` and `worker.onerror`. If the worker hangs (malformed HEIC that
the decoder spins on, or a worker that posts an unexpected message shape), the
Promise never settles and the `Worker` is never terminated — a leaked worker
thread plus a hung `handleChange`. There is no timeout. `handleChange` has a
`catch` but it can never fire because the Promise never rejects.

**Fix:** Add a timeout that rejects and terminates the worker, and guard the
`onmessage` payload shape:
```ts
return new Promise<Blob>((resolve, reject) => {
  const timer = setTimeout(() => {
    worker.terminate()
    reject(new Error('HEIC conversion timed out'))
  }, 30_000)
  worker.onmessage = (e: MessageEvent) => {
    clearTimeout(timer)
    worker.terminate()
    const data = e.data as { buffer?: ArrayBuffer; type?: string }
    if (!data?.buffer) return reject(new Error('HEIC worker returned no buffer'))
    resolve(new Blob([data.buffer], { type: data.type ?? 'image/jpeg' }))
  }
  worker.onerror = (err) => {
    clearTimeout(timer)
    worker.terminate()
    reject(err)
  }
  worker.postMessage({ buffer, toType: 'image/jpeg', quality: 0.85 }, [buffer])
})
```

### WR-03: revoke-on-unmount effect can revoke a URL still in use after a fast re-pick

**File:** `src/components/profile/AvatarUploader.tsx:99-103`
**Issue:** The cleanup effect closes over `imageSrc` and revokes it. `handleChange`
and `handleConfirmCrop` also call `URL.revokeObjectURL(imageSrc)` manually before
`setImageSrc(...)`. This means each object URL can be revoked twice: once
manually, once by the effect cleanup of the previous render. Double-revoke is
harmless (no-op) but the larger issue is ordering: when the user picks a new file,
`handleChange` revokes the *old* URL then `setImageSrc(newUrl)`. The effect
cleanup for the previous render then also runs and revokes the *old* URL again —
fine. But because the manual revoke and the state update are not atomic, if
`Cropper` (which is still mounted from the previous `imageSrc`) reads the old
`imageSrc` between the manual `revokeObjectURL` and the re-render, it references a
revoked URL. In practice React batches this, but the manual revokes are redundant
with the effect and increase the surface for an off-by-one revoke.

**Fix:** Remove the manual `URL.revokeObjectURL(imageSrc)` calls in `handleChange`,
`handleConfirmCrop`, and `handleDiscardCrop` — the `useEffect` cleanup already
revokes the previous URL whenever `imageSrc` changes. Keeping a single revoke site
removes the double-revoke and the ordering ambiguity.

### WR-04: `OwnerWishlistGrid` renders stale watches inside `startTransition`

**File:** `src/components/profile/WishlistTabContent.tsx:149-159, 197-209`
**Issue:** `watchesById` and `initialIds` are `useMemo`'d on `watches`. When a
reorder transition is in flight, `optimisticIds` reflects the new order but
`watchesById` still maps to the *old* `watches` prop. If the server
`revalidatePath` returns a `watches` array that no longer contains a previously
present id (e.g. the watch was deleted in another tab between drag start and drop),
`watchesById[id]` is `undefined` and `SortableProfileWatchCard` receives
`watch={undefined}`. Whether that crashes depends on `SortableProfileWatchCard` /
`ProfileWatchCard` — `ProfileWatchCard` immediately calls `getSafeImageUrl(watch.imageUrl)`
and `watch.status`, which throw on `undefined`. The `DragOverlay` branch is
guarded (`watchesById[activeId] ? ...`) but the `SortableContext` map at line
248-256 is **not** guarded.

**Fix:** Filter `optimisticIds` to ids that still exist, or guard the map:
```tsx
{optimisticIds
  .filter((id) => watchesById[id])
  .map((id) => (
    <SortableProfileWatchCard key={id} id={id} watch={watchesById[id]} ... />
  ))}
```

### WR-05: `extractReadableText` truncation can split JSON-LD mid-object

**File:** `src/lib/extractors/llm.ts:62-73`
**Issue:** `structuredContext` is hard-truncated at 2000 chars with
`'...[truncated]'` appended. JSON-LD structured data is frequently larger than 2 KB
on watch product pages (Schema.org `Product` with nested `offers`, `brand`,
`aggregateRating`). Truncating mid-object hands the LLM a syntactically broken JSON
fragment, which is worse than no structured data — the model may anchor on
partial/contradictory fields. The page-text truncation at 8000 chars (line 62) has
the same issue but matters less since prose degrades gracefully.

**Fix:** For `structuredContext`, prefer dropping it entirely over truncating it
mid-structure, or parse-and-reserialize a trimmed subset of known fields:
```ts
if (structuredContext) {
  // Only include if it fits whole — a truncated JSON-LD blob misleads the model.
  if (structuredContext.length <= 2000) {
    content += structuredContext + '\n\n'
  }
}
```

### WR-06: `JSON.parse(jsonMatch[0])` is unguarded — malformed LLM output throws raw

**File:** `src/lib/extractors/llm.ts:93-99`
**Issue:** `jsonMatch[0]` is the first `{...}` greedy match in the model output.
If the model emits prose containing braces or two JSON objects, the greedy regex
`\{[\s\S]*\}` captures from the first `{` to the *last* `}` — which can be
invalid JSON. `JSON.parse` then throws a `SyntaxError` that propagates uncaught out
of `extractWithLlm`. Callers expect domain errors (`'No JSON found...'`,
`'No text response...'`) but get a raw `SyntaxError` instead, which the extraction
pipeline may not classify as a recoverable extraction failure.

**Fix:** Wrap the parse:
```ts
let parsed: Record<string, unknown>
try {
  parsed = JSON.parse(jsonMatch[0])
} catch {
  throw new Error('LLM response was not valid JSON')
}
return validateAndCleanData(parsed)
```

## Info

### IN-01: `convertHeic` worker URL uses a brittle relative path

**File:** `src/components/profile/AvatarUploader.tsx:41`
**Issue:** `new URL('../../lib/exif/heic-worker.ts', import.meta.url)` hard-codes a
`../../` traversal. The file header claims the component "mirrors
CatalogPhotoUploader patterns" — if either file moves, this silently breaks the
worker resolution. CLAUDE.md states the project uses the `@/*` absolute alias
"throughout — no relative `../../` traversals". This is one of the few `../../`
uses in the codebase.

**Fix:** Confirm whether the bundler supports `@/`-aliased worker URLs; if so use
`new URL('@/lib/exif/heic-worker.ts', import.meta.url)` for consistency. If the
relative form is a documented worker-bundler constraint, add a comment saying so.

### IN-02: `onUploadComplete` is wired to a no-op in `ProfileEditForm`

**File:** `src/components/profile/ProfileEditForm.tsx:57`
**Issue:** `<AvatarUploader onUploadComplete={() => {}} />`. The avatar saves
immediately via `updateProfile` inside `AvatarUploader` (per D-10), so the parent
form does not need the callback — but passing an empty arrow function rather than
omitting the optional prop suggests the callback was meant to do something (e.g.
refresh the preview the `ProfileHeader` shows). The header's `avatarUrl` will not
update until the page re-renders from `revalidatePath`. Worth confirming the
header preview actually refreshes after upload.

**Fix:** Omit the prop entirely (`onUploadComplete` is optional), or wire it to
update local state if the in-dialog preview should reflect the new avatar
immediately.

### IN-03: `getCroppedBlob` ignores zoom — relies on `croppedAreaPixels` only

**File:** `src/components/profile/AvatarUploader.tsx:59-79, 190`
**Issue:** This is correct (`react-easy-crop`'s `croppedAreaPixels` already
accounts for zoom and pan in source-image coordinates), but there is no comment
saying so. A future maintainer may "fix" this by multiplying by `zoom` and
double-scale the crop. Add a one-line comment.

**Fix:** Add: `// croppedAreaPixels is in natural-image pixels — zoom/pan already baked in.`

### IN-04: Migration sanity assertion is brittle if other `avatars_*` policies exist

**File:** `supabase/migrations/20260516000000_phase43_avatar_bucket.sql:83-85`
**Issue:** The `DO $$` block asserts `policy_count = 3` for `policyname LIKE 'avatars_%'`.
If a future migration adds a fourth `avatars_*` policy (e.g. a SELECT policy if the
bucket is ever made private), this migration's assertion would still pass at
creation time but a re-run of this file (it is idempotent by design) would then
fail with "expected 3, got 4". Exact-count assertions on a `LIKE` prefix are
fragile across future migrations.

**Fix:** Assert `>= 3`, or assert each specific policy name exists individually.

### IN-05: `chipOptions` normalization is locale-naive

**File:** `src/components/profile/CollectionTabContent.tsx:50`
**Issue:** `r.charAt(0).toUpperCase() + r.slice(1).toLowerCase()` title-cases role
tags for chip display, but the filter at line 68-70 compares
`r.toLowerCase() === activeChip.toLowerCase()`. Two role tags that differ only by
non-ASCII casing (unlikely for watch role tags, but possible) could collide or
mismatch. Low impact given the controlled role-tag vocabulary; noted for
completeness.

**Fix:** Acceptable as-is for the current ASCII role-tag set; no change required
unless role tags become user-free-text.

---

_Reviewed: 2026-05-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

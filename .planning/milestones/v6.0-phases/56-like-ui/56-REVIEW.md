---
phase: 56-like-ui
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/components/shared/LikeButton.tsx
  - tests/components/shared/LikeButton.test.tsx
  - src/data/reactions.ts
  - src/components/watch/WatchDetail.tsx
  - src/app/watch/[id]/page.tsx
  - src/components/wear/WearDetailHero.tsx
  - src/components/wear/WearPhotoClient.tsx
  - src/components/wear/WearDetailMetadata.tsx
  - src/app/wear/[wearEventId]/page.tsx
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 56: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 56 wires a `LikeButton` client island into watch and wear detail pages, adds `getLikesForTargetCached` with correct SEC-05 cache isolation, and redesigns the wear hero with photo overlays. The core LikeButton logic (optimistic flip, rollback, reconcile, anon bounce) is correct. The `getLikesForTargetCached` SEC-05 pattern (viewerId as explicit arg, no auth inside `'use cache'` scope, `__anon__` sentinel) is correctly implemented. The like-target discriminators are `'watch'`/`'wear'` throughout — never `'wear_event'`.

One blocker: `WearPhotoOverlays` renders unconditionally over the `PhotoSkeleton` shimmer in `WearPhotoClient`, violating the D-08 overlay contract and producing broken UI during photo load. Two warnings: an unused constant in the test file (`WEAR_ID` declared but never used, and no test exercises the `'wear'` target type) and a `viewerId: string | null` prop type that conflicts with its own documentation comment.

---

## Critical Issues

### CR-01: Overlays render on top of the loading skeleton in `WearPhotoClient`

**File:** `src/components/wear/WearPhotoClient.tsx:151`

**Issue:** `WearPhotoOverlays` is rendered unconditionally in the non-`failed` return path (lines 151–159), regardless of whether `status` is `'pending'` or `'loaded'`. When `status === 'pending'`, the `PhotoSkeleton` shimmer occupies `absolute inset-0` with no z-index, while `WearPhotoOverlays` is `z-10`. The avatar, username, timestamp, brand, and model text all paint on top of the skeleton shimmer for the entire CDN propagation window (up to 800ms per D-05). This directly violates the D-08 overlay contract ("overlay text only visible once photo is present") and contradicts the comment at line 40 which says all three containers were audited for correctness.

**Fix:** Gate the overlays on `status !== 'pending'`:

```tsx
      <WearPhotoOverlays
        username={username}
        displayName={displayName}
        avatarUrl={avatarUrl}
        createdAt={createdAt}
        brand={brand}
        model={model}
        hasPhoto={status === 'loaded'}
      />
```

Or suppress entirely until loaded:

```tsx
      {status !== 'pending' && (
        <WearPhotoOverlays
          username={username}
          displayName={displayName}
          avatarUrl={avatarUrl}
          createdAt={createdAt}
          brand={brand}
          model={model}
          hasPhoto={true}
        />
      )}
```

Either form prevents overlay text from appearing over the skeleton. The second form (conditional render) is simpler because it avoids passing `hasPhoto={false}` (which renders no gradient scrim, making text unreadable on the muted background).

---

## Warnings

### WR-01: `WEAR_ID` declared but never used in test file; `'wear'` target type is untested

**File:** `tests/components/shared/LikeButton.test.tsx:27`

**Issue:** `WEAR_ID` is declared at line 27 (`'22222222-3333-4444-8555-666666666666'`) but is never referenced in any test case. All tests use the default `target: { type: 'watch', id: WATCH_ID }`. The `'wear'` discriminator path through `LikeButton` (which passes `{ type: 'wear', id }` to `toggleLikeAction`) is untested. The component doc at line 43 ("Uses 'wear' discriminator per LikeTarget type (never the old DB column name)") explicitly calls out this invariant as important, but no test validates it — the test suite cannot catch a future regression that accidentally passes `type: 'wear_event'`.

**Fix:** Add at least one test that renders `LikeButton` with `target={{ type: 'wear', id: WEAR_ID }}` and verifies `toggleLikeAction` is called with `{ type: 'wear', id: WEAR_ID }`. Also remove the dead `WEAR_ID` declaration if the test is not added:

```ts
it('calls toggleLikeAction with type=wear when target is a wear event', async () => {
  ;(toggleLikeAction as Mock).mockResolvedValue({
    success: true,
    data: { liked: true, count: 1 },
  })
  renderButton({
    target: { type: 'wear', id: WEAR_ID },
    initialLiked: false,
    initialCount: 0,
  })
  fireEvent.click(screen.getByRole('button'))
  await flush()
  expect(toggleLikeAction).toHaveBeenCalledWith({ type: 'wear', id: WEAR_ID })
})
```

---

### WR-02: `viewerId` prop typed `string | null` on `WatchDetail` but documented as "null impossible"

**File:** `src/components/watch/WatchDetail.tsx:52`

**Issue:** The prop definition is `viewerId?: string | null` (line 52), but the accompanying JSDoc says "null impossible — watch page is auth-only" (line 51). The type `string | null` is then funneled into `LikeButton` via `viewerId ?? null` (line 157), which is a no-op since `null ?? null === null`. The `null` type in the prop signature is never exercised by the only caller (`src/app/watch/[id]/page.tsx` always passes `user.id`, a `string`), but if a future caller accidentally passes `null`, the LikeButton will silently bounce authenticated-looking pages to `/login`. The type and the documentation are contradictory and the `?? null` at line 157 suggests the author was uncertain about which invariant to trust.

**Fix:** Narrow the type to match the documented invariant. If null truly cannot occur on this route, drop `| null` from the prop type:

```ts
/** Phase 56 D-03: viewer identity for LikeButton (auth-only route; always a string). */
viewerId?: string
```

And remove the now-redundant null-coalescing at line 157:

```tsx
viewerId={viewerId}
```

If `null` IS a valid future state (e.g., for a hypothetical public watch page), keep `string | null` and remove the misleading comment.

---

## Info

### IN-01: `getLikesForTargetCached` tag for the cross-user count uses `reactions:{type}:{id}` but the action invalidates the same tag with `revalidateTag(..., 'max')` (stale-while-revalidate, not immediate)

**File:** `src/data/reactions.ts:150` / `src/app/actions/reactions.ts:102`

**Issue:** `getLikesForTargetCached` tags the count entry with `reactions:${target.type}:${target.id}` (line 150). The Server Action revalidates it via `revalidateTag('reactions:...', 'max')` (line 102), which uses stale-while-revalidate semantics — the cache entry is marked stale but the _next_ request still serves the old count until the background revalidation completes. `updateTag` (line 111) is used only for `viewer:{userId}:reactions` (the private liked-state tag), giving the liker immediate feedback. Non-liker visitors may see a stale count for one additional page load. This is an intentional trade-off documented in the code, but worth noting explicitly: the reconcile path in `LikeButton` (line 88-89) updates the liker's own count immediately from `result.data`, but other viewers' count remains stale until the stale-while-revalidate cycle completes. No code change required — flagged for awareness.

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

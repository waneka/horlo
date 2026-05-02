---
phase: 26
date: 2026-05-02
mode: discuss (default, no flags)
---

# Phase 26 — Discussion Log

For audit / retrospective only. Downstream agents read CONTEXT.md, not this file.

## Areas presented to user

All 4 gray areas presented in a single AskUserQuestion call. User selected the recommended option on every question.

### Area 1 — Skeleton look (D-01)
**Question:** What should `<PhotoSkeleton />` look like during the propagation window?

**Options:**
1. ✅ **Match hero exactly (Recommended)** — Same 4:5 aspect, same border-radius, same capped 600px width, pulsing muted block. Zero layout shift. Most invisible/professional.
2. Branded uploading state — Same dimensions but with subtle text/icon hint ("Developing your shot…"). Friendlier, frames the wait as celebration.
3. Watch image as fallback — Show `watchImageUrl` as temporary stand-in, then swap to wear photo. No blank state but two image swaps feels janky.

**Selection:** Option 1 — Match hero exactly.

**Notes:** Aligns with existing skeleton patterns (`SearchResultsSkeleton.tsx`). Server-component-safe.

### Area 2 — Propagation retry (D-02)
**Question:** What happens if the signed URL 404s on first load (CDN hasn't propagated)?

**Options:**
1. ✅ **Suspense + image-load detect (Recommended)** — Suspense covers initial render; Client Component for `<img>` shows skeleton until `onLoad`; on `onError` retries with cache-buster up to ~3× at 300ms intervals. Handles both server-render gap AND CDN miss.
2. Suspense only — no client retry. Simpler but accepts broken-image risk on slow CDN regions.
3. Server preflight HEAD — server retries HEAD until 200 before rendering. Eliminates broken-image risk but blocks server response 200–800ms (defeats Suspense's purpose).

**Selection:** Option 1 — Suspense + client retry.

**Notes:** Cache-buster is query-string append, NOT signed-URL re-mint. Pitfall F-2 still applies — server-side mint stays the only place this happens.

### Area 3 — Toast behavior (D-03)
**Question:** The 'Wear logged' toast currently fires before the dialog closes. After auto-nav, what happens to it?

**Options:**
1. ✅ **Drop the toast (Recommended)** — Landing on `/wear/{id}` IS the celebration. Removes competing UI signals.
2. Keep toast, fires before nav. Toast persists across route changes (Sonner default), still visible on destination page for ~3s.
3. Move toast to destination page. Fire on `/wear/{id}` mount when arriving via auto-nav (`?from=submit` plumbing).

**Selection:** Option 1 — Drop the toast.

**Notes:** Reframes success moment from "ephemeral confirmation" to "land on the artifact." Captured Option 3 as a deferred idea in CONTEXT.md.

### Area 4 — Back button behavior (D-04)
**Question:** After auto-nav, browser back-button takes the user back to where they tapped the WYWT trigger. Is that the right behavior?

**Options:**
1. ✅ **Default push — back works (Recommended)** — `router.push` adds `/wear/{id}` to history. Back returns to trigger page. Standard, predictable.
2. router.replace — back skips wear page. Avoids back-button landing on stale dialog state but feels like teleporting.

**Selection:** Option 1 — `router.push`.

## Areas Claude handled (not asked)

- `useRouter` import + placement inside the existing `useTransition` — mechanical, no decision needed
- Signed URL minting strategy — locked by Phase 15 D-23 (carry-forward)
- Native `<img>` vs next/image — locked by Phase 15 Pitfall F-2 (carry-forward)
- File paths for new components — planner chooses based on existing conventions (`src/components/wear/`)
- Order of awaits in `handleSubmit` — locked by WYWT-20 acceptance criterion ("router.push fires after BOTH `uploadResult` AND `logWearWithPhoto` resolve")

## Deferred ideas (captured, not acted on)

- Toast on destination page (`?from=submit` query param) — revisit if Phase 26 nav feels too silent
- Manual auto-nav opt-out toggle — out of scope, no demand signal
- Pre-warm signed URL inside `logWearWithPhoto` Server Action response — out of scope, retry strategy covers propagation

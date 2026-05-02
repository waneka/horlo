---
phase: 26
name: WYWT Auto-Nav
slug: wywt-auto-nav
date: 2026-05-02
requirements: [WYWT-20, WYWT-21]
---

# Phase 26 — WYWT Auto-Nav: Context

<domain>
After a successful WYWT post, the dialog closes and the user is auto-navigated to `/wear/{wearEventId}` — a Suspense-wrapped photo render covers the 200–800ms storage-CDN propagation window so the user lands on the celebration page without a broken-image flash. v3.0 deferred celebration moment.
</domain>

<canonical_refs>
Downstream agents (researcher, planner) MUST read these before writing anything:

- `.planning/REQUIREMENTS.md` — WYWT-20 / WYWT-21 acceptance criteria (lines 131–132)
- `.planning/ROADMAP.md` — Phase 26 success criteria (lines 271–278)
- `.planning/phases/15-*/15-CONTEXT.md` — D-23 signed-URL minting decision, Pitfall F-2 (signed URLs never cached, native `<img>`)
- `src/app/wear/[wearEventId]/page.tsx` — current `WearDetailPage` with inline signed-URL mint (60-min TTL)
- `src/components/wear/WearDetailHero.tsx` — current hero render (4:5 aspect, native `<img>`, capped 600px md+)
- `src/components/wywt/ComposeStep.tsx` — current `handleSubmit` (lines 242–280) inside `useTransition`; this is where `router.push` is inserted
- `src/components/wywt/WywtPostDialog.tsx` — `wearEventId` is generated once per open via `useMemo(crypto.randomUUID(), [open])` and threaded through Storage path + Server Action insert (D-15 linchpin from Phase 15)
- `src/components/ui/skeleton.tsx` — base shadcn Skeleton primitive (`animate-pulse rounded-md bg-muted`); `<PhotoSkeleton />` composes this

External docs: none (in-tree decisions only).
</canonical_refs>

<code_context>
**Existing assets to reuse:**
- `useTransition` already wraps the submit flow in `ComposeStep.tsx:244` — `router.push` goes inside the same callback, AFTER both `uploadWearPhoto` and `logWearWithPhoto` resolve.
- `wearEventId` is already available as a prop in `ComposeStep` (`props.wearEventId`) — it's the same UUID used for the Storage path and the DB insert, so it's the canonical id to push to.
- `<Skeleton>` from `src/components/ui/skeleton.tsx` is server-component-safe — `<PhotoSkeleton />` can be a server component that just renders `<Skeleton className="w-full aspect-[4/5] md:rounded-lg md:max-w-[600px] md:mx-auto" />`.
- `WearDetailHero.tsx` already has the exact dimensions to match.
- `next/navigation`'s `useRouter` is already imported in many client components (e.g., `src/components/profile/CollectionTabContent.tsx`) — pattern is well-established.

**What needs to change:**
- `ComposeStep.tsx`: import `useRouter`, call `router.push(`/wear/${wearEventId}`)` inside the existing `startTransition`, after `logWearWithPhoto` resolves successfully and BEFORE `onSubmitted()`. Drop the `toast.success('Wear logged')`.
- `src/app/wear/[wearEventId]/page.tsx`: split the photo render into a child component (`<WearPhotoStreamed>`) wrapped in `<Suspense fallback={<PhotoSkeleton />}>`. The signed-URL mint stays inline in the page (server-component) but moves into the streamed child so the rest of the page (metadata) renders immediately.
- New file: `src/components/wear/PhotoSkeleton.tsx` — composes shadcn `<Skeleton>` with the exact 4:5 / 600px-cap dimensions.
- New file: `src/components/wear/WearDetailHeroClient.tsx` (or extend `WearDetailHero` with a client wrapper) — Client Component that renders the `<img>` with `onLoad`/`onError` handlers; on error, retries up to 3× at ~300ms intervals with a cache-buster query param.

**Pitfall to honor (F-2 from Phase 15):**
- Signed URL is minted server-side per-request, 60-min TTL, never cache-wrapped. Cache-buster on retry is a query-string append (e.g., `?retry=1`), not a re-mint — Supabase Smart CDN keys each token as a separate cache entry, so query params are safe.
- Native `<img>`, NOT `next/image`.
</code_context>

<decisions>

### D-01: `<PhotoSkeleton />` matches `<WearDetailHero>` dimensions exactly

Same 4:5 aspect ratio, same `md:rounded-lg`, same `md:max-w-[600px] md:mx-auto`, full-bleed on mobile. Pure pulsing muted block — no text, no icons.

**Why:** Zero cumulative layout shift when the image lands. Looks invisible/professional, matches the rest of the app's loading conventions (see `SearchResultsSkeleton.tsx` for the same pattern). User explicitly chose this over a branded "Developing your shot…" treatment.

**How to apply:** Researcher should compose the existing `<Skeleton>` primitive with the hero's dimension classes. Planner should put this in `src/components/wear/PhotoSkeleton.tsx` (server-component-safe, no `'use client'` needed).

### D-02: Suspense boundary wraps the photo render; Client Component handles image-load retry

Two-layer strategy:
1. **Server side (Suspense):** `<Suspense fallback={<PhotoSkeleton />}>` wraps a child server component (`<WearPhotoStreamed>`) that does the signed-URL mint. The rest of the page (metadata) renders immediately; the photo streams in.
2. **Client side (retry):** The actual `<img>` lives in a Client Component that:
   - Renders `<PhotoSkeleton />` while `onLoad` hasn't fired yet
   - On `onError`, retries up to **3 times** at **~300ms** intervals with a cache-buster query param (e.g., `?retry=1`, `?retry=2`, `?retry=3`)
   - After the final retry fails, falls through to the existing `watchImageUrl` fallback or the no-photo placeholder (preserves Hero's existing fallback chain)

**Why:** Suspense alone covers the server-render gap but the `<img>` still fetches client-side. A 200–800ms storage-CDN propagation window can outlast the server response, so the client needs to handle the 404. User chose this over Suspense-only (broken-image risk) and server-side HEAD preflight (defeats Suspense's purpose by blocking the response).

**How to apply:** Planner should split `WearDetailHero.tsx` into:
- `WearDetailHero.tsx` (server, unchanged signature) → renders the no-photo fallback path
- `WearPhotoClient.tsx` (`'use client'`) → renders the signed-URL `<img>` with retry state machine
The page's existing fallback chain (signedUrl → watchImageUrl → placeholder) stays intact; `WearPhotoClient` only owns the signed-URL branch.

**Cache-buster safety:** `?retry=N` is a query string append — Supabase Smart CDN treats it as a distinct cache key. We are NOT re-minting the signed URL on retry (Pitfall F-2 still applies — server-side mint is the only place this happens). The retry just bypasses an in-flight CDN miss.

### D-03: Drop `toast.success('Wear logged')` — the destination page IS the celebration

Remove the toast call from `ComposeStep.handleSubmit` (line 273). The successful navigation to `/wear/{wearEventId}` with the photo + metadata render IS the success signal.

**Why:** Toast + navigation creates competing UI signals during a transition. Phase 26 reframes the success moment from "ephemeral confirmation" to "land on the artifact." User explicitly chose this over keeping the toast or moving it to the destination page.

**How to apply:** Planner should delete the `toast.success('Wear logged')` line and the `import { toast } from 'sonner'` if it's the only usage in the file. (Verify no other toast call remains in `ComposeStep.tsx` before removing the import.)

### D-04: `router.push` (not `router.replace`) — standard browser back behavior

`router.push('/wear/${wearEventId}')` adds a new history entry. Browser back returns to wherever the user opened the WYWT dialog (typically `/`).

**Why:** Standard, predictable web behavior. User explicitly chose this over `router.replace` (which would skip `/wear/{id}` from back-history — useful in edge cases but feels like teleporting for the common path).

**How to apply:** `useRouter()` from `next/navigation`, `router.push(`/wear/${wearEventId}`)` inside the existing `startTransition` after `logWearWithPhoto` resolves successfully and before (or in place of) `onSubmitted()`.

### D-05 (carry-forward from Phase 15): signed URL still minted server-side per request

Pitfall F-2 reaffirmed: the signed URL is minted in `/wear/[wearEventId]/page.tsx` (or its streamed child), 60-min TTL, NEVER cached, NEVER serialized into a Cache Components directive. The retry strategy (D-02) appends a cache-buster query string but does NOT re-mint the URL.

**Why:** Carrying forward Phase 15 D-23. Caching signed URLs across requests/users is a security + freshness bug.

**How to apply:** Researcher and planner must NOT introduce `'use cache'` directives, `unstable_cache` wrappers, or any other caching mechanism on the signed-URL mint. Per-request mint is the only correct shape.

### D-06 (carry-forward from Phase 15): native `<img>`, not `next/image`

Pitfall F-2 reaffirmed: native `<img src={signedUrl}>`, NOT `next/image`. The Next image optimizer can strip query parameters on its proxy variants which would invalidate the Supabase signed-URL token.

**Why:** Carrying forward Phase 15 D-23.

**How to apply:** `WearPhotoClient.tsx` uses native `<img>` with the `// eslint-disable-next-line @next/next/no-img-element` comment that already lives in `WearDetailHero.tsx:43`.

### D-07: `router.push` fires AFTER BOTH `uploadWearPhoto` AND `logWearWithPhoto` resolve, inside the same `useTransition`

This is the WYWT-20 acceptance criterion verbatim. Order in `ComposeStep.handleSubmit`:
1. `await uploadWearPhoto(...)` — succeeds or returns `{error}` (early return on error)
2. `await logWearWithPhoto(...)` — succeeds or returns `{success: false, error}` (early return on error)
3. `router.push(`/wear/${wearEventId}`)`
4. `onSubmitted()` — closes the dialog

**Why:** `router.push` before either `await` completes would race the upload, potentially landing on `/wear/{id}` before the DB row exists (page would 404). Both must succeed first.

**How to apply:** Step ordering in `handleSubmit` is locked. Planner should NOT pull the navigation outside the `try` block.

</decisions>

<deferred>
- **Toast on destination page** — could fire `toast.success('Wear logged')` on `/wear/{id}` mount when arriving via auto-nav (e.g., `?from=submit` query param). Rejected for Phase 26 (D-03 favors a quiet celebration); revisit if user feedback suggests the navigation is too silent.
- **Manual opt-out for auto-nav** — some users might prefer staying on the trigger page after submit. Not in WYWT-20 scope; would be a settings toggle, future phase if requested.
- **Pre-warm signed URL** — could mint the signed URL inside `logWearWithPhoto` and pass it back to the client to skip one server round-trip on the destination page. Out of scope for Phase 26 (changes Server Action signature); the Suspense + client retry strategy covers the propagation window adequately.
</deferred>

<success_criteria>
1. After WYWT submit succeeds (both upload + Server Action resolve), the dialog closes AND the user lands on `/wear/{wearEventId}` — `router.push` fires inside the existing `useTransition`, after both awaits, before/in place of `onSubmitted()`.
2. The `/wear/[wearEventId]` page renders a `<Suspense fallback={<PhotoSkeleton />}>` boundary around the photo. The rest of the page (metadata) renders immediately.
3. `<PhotoSkeleton />` has identical dimensions to `<WearDetailHero>` (4:5 aspect, `md:rounded-lg`, `md:max-w-[600px] md:mx-auto`) — zero layout shift when the image lands.
4. The signed-URL `<img>` lives in a Client Component that retries `onError` up to 3× at ~300ms intervals with a cache-buster query string. Skeleton remains visible while retries are in flight.
5. The `toast.success('Wear logged')` call in `ComposeStep.handleSubmit` is removed.
6. Pitfall F-2 honored: native `<img>` (no next/image), signed URL minted server-side per-request only (no caching, no `'use cache'`).
7. Browser back from `/wear/{id}` returns to the trigger page (router.push, not replace).
</success_criteria>

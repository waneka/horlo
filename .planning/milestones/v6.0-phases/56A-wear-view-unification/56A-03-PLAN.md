---
phase: 56A-wear-view-unification
plan: 03
type: execute
wave: 2
depends_on: ["01", "02"]
files_modified:
  - src/components/wears/WearsLane.tsx
  - src/app/wears/[username]/page.tsx
autonomous: true
requirements: [SC-1, SC-2, D-04, D-05, D-06, D-07]
must_haves:
  truths:
    - "/wears/[username] is a real server route showing the user's active wears (~48h) in a swipeable carousel (SC-1, D-04)"
    - "The carousel opens at the oldest UNVIEWED wear and plays oldest→newest (D-05); user→user swipe order comes from a fresh getWearRailForViewer call, not a client-passed order (D-06, Pitfall 3)"
    - "When the user has 0 active wears the route redirects to /u/[username] (D-07)"
    - "The route is auth-only with no __anon__ sentinel; getCurrentUser() is the gate, proxy handles anon (EN-6)"
    - "Signed wear-photo URLs are minted per-request inside a Suspense child, never cached (Pitfall F-2)"
    - "Opening the comment bottom-sheet pauses the swipe via emblaApi.reInit({ watchDrag: false }) (D-10/D-11)"
  artifacts:
    - path: "src/app/wears/[username]/page.tsx"
      provides: "Stories lane server page: auth, getProfileByUsername, getActiveWearsForUser, D-07 redirect, per-wear signed URLs + like state, rail order"
      contains: "getActiveWearsForUser"
    - path: "src/components/wears/WearsLane.tsx"
      provides: "Client embla carousel rendering WearCard per slide, oldest-first start index, swipe-pause on comment open, close affordance"
      contains: "useEmblaCarousel"
  key_links:
    - from: "src/app/wears/[username]/page.tsx"
      to: "src/data/wearEvents.ts:getActiveWearsForUser"
      via: "server read of one actor's active wears"
      pattern: "getActiveWearsForUser\\(viewerId"
    - from: "src/app/wears/[username]/page.tsx"
      to: "/u/[username]"
      via: "redirect when wears.length === 0 (D-07), outside try/catch"
      pattern: "redirect\\(`/u/"
    - from: "src/components/wears/WearsLane.tsx"
      to: "src/components/wear/WearCard.tsx"
      via: "per-slide render with commentHostVariant='bottom-sheet'"
      pattern: "WearCard"
    - from: "src/components/wears/WearsLane.tsx"
      to: "embla watchDrag"
      via: "emblaApi.reInit({ watchDrag: !commentOpen }) on comment open"
      pattern: "reInit\\(\\{ watchDrag"
---

<objective>
Build the `/wears/[username]` stories lane: the full-screen, viewport-fit, swipeable route that replaces the legacy `WywtOverlay`. The server page resolves the user, reads their active wears (oldest-first), mints per-request signed URLs, fetches per-wear like state and wishlist applicability, and redirects to `/u/[username]` when there are no active wears. The `WearsLane` client component drives the embla carousel rendering one shared `WearCard` per slide, opening at the oldest unviewed wear and pausing swipe when the comment sheet opens.

Purpose: SC-1 (tap → real route, swipeable, advances user→user) and SC-2 (full-screen, no nav, viewport-fit, inline engagement). This is the new immersive surface that makes likes/comments reachable while browsing.

Output: One new server page + one new client carousel component.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/56A-wear-view-unification/56A-CONTEXT.md
@.planning/phases/56A-wear-view-unification/56A-RESEARCH.md
@.planning/phases/56A-wear-view-unification/56A-PATTERNS.md
@.planning/phases/56A-wear-view-unification/56A-UI-SPEC.md
@.planning/phases/56A-wear-view-unification/56A-VALIDATION.md

@src/app/wear/[wearEventId]/page.tsx
@src/components/home/WywtOverlay.tsx

<interfaces>
From src/data/wearEvents.ts (built in Plan 01):
```
getActiveWearsForUser(viewerId: string, actorId: string)
// rows: { id, userId, watchId, wornDate, note, photoUrl(raw), visibility, createdAt, username, displayName, avatarUrl, brand, model, watchImageUrl }, oldest-first
getWearRailForViewer(viewerId: string): Promise<WywtRailData>  // .tiles[].username defines the user→user swipe order (D-06)
```
From src/data/profiles.ts:
```
getProfileByUsername(username: string)  // case-insensitive; returns full row (incl .id) or null
```
From src/data/reactions.ts:
```
getLikesForTargetCached(viewerId: string, target: { type:'wear', id }): Promise<{ viewerHasLiked: boolean; count: number }>
```
From src/data/watches.ts:
```
getWatchesByUser(userId: string): Promise<Watch[]>   // each Watch has { id, brand, model, status: 'owned'|'wishlist'|'sold'|'grail' }
```
From src/components/wear/WearCard.tsx (built in Plan 02): WearCardProps — signedUrl, watchImageUrl, altText, username, displayName, avatarUrl, createdAt, brand, model, watchId, viewerId, wearEventId, initialLiked, initialCount, commentHostVariant, showAddToWishlist, permalinkUrl, onCommentOpenChange?.
From src/lib/auth.ts: getCurrentUser() (throws UnauthorizedError on anon — do NOT catch here; proxy handles redirect).
From src/lib/supabase/server.ts: createSupabaseServerClient() → supabase.storage.from('wear-photos').createSignedUrl(path, 60*60).
embla: `import useEmblaCarousel from 'embla-carousel-react'`; copy `getEmblaDuration()` verbatim from WywtOverlay.tsx lines 35-44; `emblaApi.reInit({ watchDrag: boolean })`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: WearsLane client carousel</name>
  <files>src/components/wears/WearsLane.tsx</files>
  <read_first>
    - src/components/home/WywtOverlay.tsx (the embla analog — copy getEmblaDuration() verbatim from lines 35-44, the useEmblaCarousel({ startIndex, align:'start', containScroll:false, duration }) init, the onSelect→markViewed effect, the embla DOM structure ref={emblaRef} > flex > slides)
    - src/hooks/useViewedWears.ts (the markViewed + viewed-state hook used to compute the oldest-unviewed start index, D-05)
    - src/components/wear/WearCard.tsx (the per-slide component built in Plan 02 — WearCardProps + onCommentOpenChange)
    - .planning/phases/56A-wear-view-unification/56A-PATTERNS.md (§ WearsLane — full snippet set: imports, getEmblaDuration, embla init, reInit swipe-pause, onSelect, DOM structure, close affordance)
    - .planning/phases/56A-wear-view-unification/56A-UI-SPEC.md (§7 WearsLane + § Route-Specific Layout Contracts — h-dvh overflow-hidden fixed inset-0 md:static... responsive class; X close top-3 left-3; desktop centered 600px column)
  </read_first>
  <action>
    Create `src/components/wears/WearsLane.tsx` as a `'use client'` component exporting `WearsLane`. Props: `slides: WearSlide[]` (an array shaped to spread into WearCard — define `WearSlide` as the WearCardProps fields minus the ones the lane controls, plus `wearEventId`), `initialSlideIndex: number`, `viewerId: string`.

    Copy `getEmblaDuration()` verbatim from WywtOverlay.tsx (prefers-reduced-motion → 0, else 25).

    Init `const [emblaRef, emblaApi] = useEmblaCarousel({ startIndex: Math.max(0, Math.min(initialSlideIndex, slides.length - 1)), align: 'start', containScroll: false, duration: getEmblaDuration() })`.

    Local state `const [commentOpen, setCommentOpen] = useState(false)`. Swipe-pause effect (D-10/D-11): `useEffect(() => { if (!emblaApi) return; emblaApi.reInit({ watchDrag: !commentOpen }) }, [emblaApi, commentOpen])`.

    onSelect→markViewed effect mirroring WywtOverlay: on embla 'select', read `emblaApi.selectedScrollSnap()`, mark the slide's wearEventId viewed via `useViewedWears().markViewed`; fire once for the initial slide.

    DOM structure: outer container `<div ref={emblaRef} className="fixed inset-0 h-dvh overflow-hidden md:static md:inset-auto md:h-auto md:overflow-visible bg-background md:max-w-[600px] md:mx-auto">` then inner `<div className="flex h-full">` then per-slide `<div key={slide.wearEventId} className="flex-[0_0_100%] min-w-0">` rendering `<WearCard {...slide} viewerId={viewerId} commentHostVariant="bottom-sheet" onCommentOpenChange={setCommentOpen} />`.

    Close affordance (UI-SPEC §4): a `<button aria-label="Close" onClick={() => router.back()} className="absolute top-3 left-3 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center text-white">` with an `X` (lucide-react size-5). `const router = useRouter()` from 'next/navigation'. (No "View in stories" control — D-03; no progress bars — UI-SPEC §Deferred.)

    Define and export a `WearSlide` type in THIS file (`src/components/wears/WearsLane.tsx`) — this is the canonical location; the server page imports `WearSlide` from `@/components/wears/WearsLane`. (PATTERNS.md mentions `@/lib/wywtTypes` — ignore that; do NOT create a new shared types file.) Keep WearCard the single owner of the engagement row + overflow + comment host — the lane only positions the carousel + close button.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -c "WearsLane" | grep -q "^0$" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function WearsLane" src/components/wears/WearsLane.tsx` returns one match
    - File contains `useEmblaCarousel(` with `startIndex:` clamped to slides.length-1
    - File contains `emblaApi.reInit({ watchDrag: !commentOpen })` (D-10/D-11 swipe-pause)
    - File renders `<WearCard` with `commentHostVariant="bottom-sheet"` and `onCommentOpenChange={setCommentOpen}`
    - Outer container class contains `fixed inset-0 h-dvh overflow-hidden md:static md:inset-auto md:h-auto md:overflow-visible` (SC-2 full-screen mobile, centered desktop)
    - Close button has `aria-label="Close"`, `top-3 left-3`, `min-h-[44px] min-w-[44px]`, and calls `router.back()`
    - `getEmblaDuration()` is present (prefers-reduced-motion aware)
    - `npx tsc --noEmit` reports no errors referencing WearsLane.tsx
  </acceptance_criteria>
  <done>WearsLane renders one WearCard per slide in an embla carousel, opens at initialSlideIndex, pauses swipe when the comment sheet opens, and provides a top-left close affordance. Full-screen on mobile, centered 600px column on desktop.</done>
</task>

<task type="auto">
  <name>Task 2: /wears/[username] server page</name>
  <files>src/app/wears/[username]/page.tsx</files>
  <read_first>
    - src/app/wear/[wearEventId]/page.tsx (the route analog — async params Promise pattern, the WearPhotoStreamed Suspense child that mints signed URLs per-request with createSignedUrl(path, 60*60), altText construction, getLikesForTargetCached usage)
    - src/app/page.tsx (the home page's per-request signed-URL minting loop for rail tiles, lines 36-63 — the F-2 pattern at the page layer; replicate for the lane's slides)
    - .planning/phases/56A-wear-view-unification/56A-PATTERNS.md (§ src/app/wears/[username]/page.tsx — imports, async params+searchParams, auth-only no-anon, getProfileByUsername→actorId+notFound, D-07 redirect outside try/catch, rail order for user→user swipe, per-wear signed-URL minting, per-wear like state)
    - .planning/phases/56A-wear-view-unification/56A-RESEARCH.md (§ Common Pitfalls 2/3/4 + Open Question 3 — redirect outside try/catch, rail-order freshness, searchParams ?from for initial index, wishlist applicability per wear)
    - src/components/wears/WearsLane.tsx (the WearSlide shape the page must build)
  </read_first>
  <action>
    Create `src/app/wears/[username]/page.tsx` as an async server page. Signature: `export default async function WearsPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ from?: string }> })`. `const { username } = await params; const { from: fromWearEventId } = await searchParams`.

    Auth-only, no anon sentinel (EN-6): `const user = await getCurrentUser(); const viewerId = user.id`. Do NOT wrap in try/catch for UnauthorizedError — the proxy redirects anon to /login.

    Resolve actor: `const actor = await getProfileByUsername(username); if (!actor) notFound()`.

    Read active wears: `const wears = await getActiveWearsForUser(viewerId, actor.id)`. D-07 redirect — OUTSIDE any try/catch (redirect() throws NEXT_REDIRECT): `if (wears.length === 0) redirect(\`/u/${username}\`)`.

    Build the initial slide index (D-05 "open at oldest unviewed"): the wears array is already oldest-first. If `fromWearEventId` is provided, find its index in `wears`; else default to index 0 (oldest). Pass this as `initialSlideIndex`. (Client-side useViewedWears refinement is handled in WearsLane's onSelect; the server passes the tapped/oldest index from the rail's ?from param — Pitfall 4 / RESEARCH Open Question 3.)

    Rail order for user→user swipe (Pitfall 3 — fetch fresh, do NOT take from client): not required for slide rendering in this plan, but record the actor's position for future cross-user nav by reading `const railData = await getWearRailForViewer(viewerId)` and locating `username` in `railData.tiles.map(t => t.username)`. (Cross-user advance wiring can be a thin follow; for SC-1 the in-user swipe is the gate. Include the railData read so the order is server-fresh and available; pass `railUsernames` and the actor's index to WearsLane if/when cross-user advance is wired. If not wiring cross-user advance in this task, still perform the fresh read and leave a clearly-commented seam — never pass a client-supplied order.)

    Per-wear like state: `const likeStates = await Promise.all(wears.map(w => getLikesForTargetCached(viewerId, { type: 'wear', id: w.id })))`.

    Wishlist applicability per wear (D-09): `const viewerWatches = await getWatchesByUser(viewerId)`. For each wear, compute `showAddToWishlist`: false when the wear is the viewer's own (`w.userId === viewerId`), OR when the viewer already has a watch matching this wear's brand+model with status 'owned' or 'wishlist'. Match by `(brand, model)` case-insensitively against `viewerWatches.filter(v => v.status === 'owned' || v.status === 'wishlist')`. (Per-user-independent-entries model: there is no canonical watch id shared across users, so match on brand+model, not id — see catalog-id-divergence note.)

    Per-wear signed URL (Pitfall F-2): mint inside a Suspense-wrapped server child mirroring WearPhotoStreamed. Build each slide's `signedUrl` by calling `supabase.storage.from('wear-photos').createSignedUrl(w.photoUrl, 60*60)` per-request (NOT cached, NOT in a DAL). For a list, you may mint all in a single `Promise.all` at the page level inside the page body (the page itself is uncached request-time), mirroring src/app/page.tsx lines 36-63. Wrap the `<WearsLane>` render in `<Suspense fallback={<PhotoSkeleton />}>` if you defer minting to a streamed child; otherwise mint at page level (acceptable since the lane is a single below-the-fold immersive surface). Build the WearSlide array: for each wear, `{ wearEventId: w.id, signedUrl, watchImageUrl: w.watchImageUrl, altText, username: w.username, displayName: w.displayName, avatarUrl: w.avatarUrl, createdAt: w.createdAt, brand: w.brand, model: w.model, watchId: w.watchId, initialLiked: likeStates[i].viewerHasLiked, initialCount: likeStates[i].count, showAddToWishlist, permalinkUrl: \`/wear/${w.id}\` }`. altText: `w.username ? \`${w.username} wearing ${w.brand} ${w.model}\` : \`Watch on wrist — ${w.brand} ${w.model}\`` (match the detail page).

    Render `<WearsLane slides={slides} initialSlideIndex={initialSlideIndex} viewerId={viewerId} />`.

    Imports: notFound, redirect from 'next/navigation'; Suspense from 'react'; getCurrentUser from '@/lib/auth'; getProfileByUsername from '@/data/profiles'; getActiveWearsForUser, getWearRailForViewer from '@/data/wearEvents'; getLikesForTargetCached from '@/data/reactions'; getWatchesByUser from '@/data/watches'; createSupabaseServerClient from '@/lib/supabase/server'; WearsLane (and the `WearSlide` type) from '@/components/wears/WearsLane'; PhotoSkeleton from '@/components/wear/PhotoSkeleton'. Type the built array as `WearSlide[]`.
  </action>
  <verify>
    <automated>npm run test -- phase56a-wears-lane</automated>
    <!-- npm run build runs at the plan-level <verification> block, not per-task (build latency would mask the test signal) -->
  </verify>
  <acceptance_criteria>
    - File `src/app/wears/[username]/page.tsx` exists and `export default async function` is present
    - `params` is typed `Promise<{ username: string }>` and awaited (Next.js 16 async params)
    - File contains `const user = await getCurrentUser()` with NO surrounding try/catch for UnauthorizedError (EN-6 auth-only)
    - File contains `getProfileByUsername(username)` and `if (!actor) notFound()`
    - File contains `redirect(\`/u/${username}\`)` and it is NOT inside a try/catch block (Pitfall 2)
    - File contains `getActiveWearsForUser(viewerId, actor.id)`
    - File mints signed URLs via `createSignedUrl(` at the page/Suspense layer, NOT importing any cached helper for them (Pitfall F-2)
    - File computes `showAddToWishlist` per wear with a `w.userId === viewerId` own-wear check and an owned/wishlist brand+model match (D-09)
    - File contains a fresh `getWearRailForViewer(viewerId)` read (server-side user order, Pitfall 3) — order never taken from a client param
    - `npm run build` succeeds; `npm run test -- phase56a-wears-lane` advances the SC-1/D-07 scaffold assertions (D-07 redirect-on-empty, /wears/ route exists)
  </acceptance_criteria>
  <done>/wears/[username] renders the lane for a user's active wears, redirects to /u/[username] when empty (D-07), is auth-only (EN-6), mints signed URLs per-request (F-2), gates add-to-wishlist per wear (D-09), and derives user→user order from a fresh server read (D-06/Pitfall 3).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client URL (/wears/[username] + ?from) → server page | username + from are untrusted; actor resolved server-side, from used only as an index lookup within the actor's already-gated wears |
| server page → Storage | signed URLs minted per-request, never cached |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-56A-07 | Spoofing / IDOR | `?from=wearEventId` used to surface a wear the viewer cannot see | mitigate | `from` is used ONLY to compute an initial index within `wears`, which is already filtered by getActiveWearsForUser's three-tier gate. A `from` not in the gated set falls back to index 0. The actor is resolved from `username`, never from a client userId. |
| T-56A-08 | Information Disclosure | Username enumeration via /wears/[username] redirect behavior (D-07) | mitigate | Non-existent username → notFound() (404). Existing-but-zero-active-wears → redirect to /u/[username]. /u/[username] already exposes profile existence to authenticated viewers (Phase 51 Branch B gates /u/* to auth), so the redirect reveals nothing beyond what /u/[username] already does. No new enumeration surface. |
| T-56A-09 | Information Disclosure | Signed-URL caching/leak across viewers (Pitfall F-2) | mitigate | createSignedUrl called per-request in the uncached page body / Suspense child (mirrors src/app/page.tsx + /wear/[id]); never in a DAL or 'use cache' scope. Asserted by acceptance grep. |
| T-56A-10 | Information Disclosure | Per-wear like state leaking across viewers | mitigate | getLikesForTargetCached serializes viewerId into the cache key (SEC-05, Phase 55) — existing mitigation reused unchanged. |
</threat_model>

<verification>
- `npm run build` succeeds
- `npm run test -- phase56a-wears-lane` advances SC-1 + D-07 scaffold assertions (no longer fully RED)
- `grep -n "redirect(" src/app/wears/[username]/page.tsx` confirms the redirect is not nested in try/catch
- Manual (per VALIDATION.md, deferred to UAT): bottom-sheet swipe-pause + keyboard over photo on a real device; full-screen viewport-fit with no page scroll
</verification>

<success_criteria>
- /wears/[username] is a real swipeable route showing the user's active wears, full-screen on mobile (SC-1, SC-2)
- 0 active wears redirects to /u/[username] (D-07); oldest-first ordering (D-05); fresh server-side user order (D-06)
- Auth-only no-anon (EN-6); per-request signed URLs (F-2); add-to-wishlist gated per wear (D-09)
</success_criteria>

<output>
After completion, create `.planning/phases/56A-wear-view-unification/56A-03-SUMMARY.md`
</output>

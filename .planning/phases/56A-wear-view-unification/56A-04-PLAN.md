---
phase: 56A-wear-view-unification
plan: 04
type: execute
wave: 2
depends_on: ["02"]
files_modified:
  - src/app/wear/[wearEventId]/page.tsx
autonomous: true
requirements: [SC-3, SC-4]
must_haves:
  truths:
    - "/wear/[id] keeps the nav bars, is vertically scrollable, shows a single wear (no swipe) using the SAME shared WearCard (SC-3, SC-4)"
    - "/wear/[id] renders the shared LikeButton + the inline comment host section + the overflow menu via WearCard (D-12)"
    - "/wear/[id] is a plain full-page route reached by direct URL / share / notification — NOT a Next.js intercepting/parallel route (no @modal or (.)wear/[id] segment); back/close is the browser/nav back affordance (D-02, SC-3)"
    - "The dead __anon__ sentinel and anonymous-viewer try/catch are removed; the route is auth-only (EN-6)"
    - "The per-request signed-URL Suspense pattern (WearPhotoStreamed / Pitfall F-2) is preserved"
  artifacts:
    - path: "src/app/wear/[wearEventId]/page.tsx"
      provides: "Refactored detail permalink rendering the shared WearCard (inline comment-host variant); EN-6 anon cleanup"
      contains: "WearCard"
  key_links:
    - from: "src/app/wear/[wearEventId]/page.tsx"
      to: "src/components/wear/WearCard.tsx"
      via: "renders <WearCard commentHostVariant='inline' /> in place of the inline hero+footer"
      pattern: "commentHostVariant=\"inline\""
    - from: "src/app/wear/[wearEventId]/page.tsx"
      to: "src/lib/supabase/server.ts:createSignedUrl"
      via: "per-request signed-URL minting inside the WearPhotoStreamed Suspense child (preserved)"
      pattern: "createSignedUrl"
---

<objective>
Refactor the existing `/wear/[wearEventId]` detail page to render the shared `WearCard` (inline comment-host variant) instead of its bespoke inline hero + footer action row, achieving visual+behavioral parity with the stories lane (SC-4) while keeping the conventional nav-retaining, vertically-scrollable layout (SC-3). The detail page remains a plain full-page route — NOT an intercepting/parallel route (D-02). Remove the dead `__anon__` sentinel and the anonymous-viewer branch (EN-6) — both wear routes are auth-only. Preserve the per-request signed-URL Suspense pattern (Pitfall F-2).

Purpose: SC-3 (detail permalink retains nav, scrollable, single wear, same card, like + inline comment list, reachable by URL/share/notification with working back/close), SC-4 (single shared card), and D-02 (plain full-page navigation, no `@modal`/`(.)wear/[id]` interception). EN-6 removes dead code now that the proxy gates both routes.

Output: One modified server page.
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
@.planning/phases/56A-wear-view-unification/56A-PATTERNS.md
@.planning/phases/56A-wear-view-unification/56A-UI-SPEC.md

@src/app/wear/[wearEventId]/page.tsx

<interfaces>
From src/components/wear/WearCard.tsx (built in Plan 02): WearCardProps — signedUrl, watchImageUrl, altText, username, displayName, avatarUrl, createdAt, brand, model, watchId, viewerId, wearEventId, initialLiked, initialCount, commentHostVariant ('bottom-sheet'|'inline'), showAddToWishlist, permalinkUrl, onCommentOpenChange?.

Current /wear/[wearEventId]/page.tsx structure (the self-analog being modified):
- Lines 46-54: try/catch around getCurrentUser() that swallows UnauthorizedError to allow anon — REMOVE (EN-6).
- Lines 59-64: ANON_SENTINEL '__anon__' passed to getLikesForTargetCached — REMOVE (EN-6); viewerId is now always a real id.
- Lines 71-99: the <article> with WearPhotoStreamed Suspense child + WearDetailMetadata + the inline footer row (lines 89-98) with the `<div className="flex-1 min-h-[44px]" aria-hidden />` comment-slot placeholder + LikeButton.
- Lines 113-173: WearPhotoStreamed server child — mints signed URL per-request (createSignedUrl(photoUrl, 60*60)), then renders WearPhotoClient (signed) or WearDetailHero (fallback). KEEP this minting; WearCard now consumes the signedUrl.

This page is a plain full-page route — there is NO @modal slot and NO (.)wear/[id] intercepting segment in the route tree, and none must be introduced (D-02). The page retains nav via the unchanged root layout.

From src/data/wearEvents.ts: getWearEventByIdForViewer(viewerId, wearEventId) — three-tier gated single-wear read; returns { ..., watchId, photoUrl(raw), watchImageUrl, username, displayName, avatarUrl, createdAt, brand, model, note, visibility } or null → notFound().
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor /wear/[id] to use shared WearCard + EN-6 cleanup</name>
  <files>src/app/wear/[wearEventId]/page.tsx</files>
  <read_first>
    - src/app/wear/[wearEventId]/page.tsx (the file being modified — read the full current implementation: the anon try/catch lines 46-54, ANON_SENTINEL lines 59-64, the article + footer row lines 71-99, the WearPhotoStreamed child lines 113-173)
    - src/components/wear/WearCard.tsx (the shared card built in Plan 02 — the props it accepts and the fact it owns the engagement row + overflow menu + inline comment host)
    - .planning/phases/56A-wear-view-unification/56A-PATTERNS.md (§ src/app/wear/[wearEventId]/page.tsx (modify) — the 4 explicit changes: remove __anon__, remove anon try/catch, replace inline engagement row with WearCard, keep WearPhotoStreamed)
    - .planning/phases/56A-wear-view-unification/56A-UI-SPEC.md (§ Route-Specific Layout Contracts → /wear/[id] — article wrapper, engagement row + inline comment section classes)
  </read_first>
  <action>
    Modify `src/app/wear/[wearEventId]/page.tsx`. Keep it a plain full-page route — do NOT introduce any `@modal` parallel slot or `(.)wear/[id]` intercepting segment (D-02); the page stays a conventional Server Component page reached by direct URL / share / notification deep-link.

    1. EN-6 auth-only: Replace the try/catch anonymous-viewer block (current lines 46-54) with `const user = await getCurrentUser(); const viewerId = user.id`. Remove the `UnauthorizedError` import if it becomes unused. The proxy redirects anon to /login — no anon path on this route.

    2. EN-6 sentinel removal: Delete the `ANON_SENTINEL` const and the `viewerId ?? ANON_SENTINEL` usage (current lines 59-64). Call `getLikesForTargetCached(viewerId, { type: 'wear', id: wearEventId })` with the real viewerId. Update the JSDoc that documents the anon sentinel to note it was removed in 56A EN-6 (both wear routes are auth-only).

    3. Compute `showAddToWishlist` for the detail page consistent with the lane (D-09): the wear's own-ness via `wear.userId === viewerId`, and owned/wishlist brand+model match against `getWatchesByUser(viewerId)`. Import getWatchesByUser from '@/data/watches'. (Same logic as Plan 03; the detail page is reachable for any visible wear so the gate applies here too.) Match brand+model case-insensitively, status in ('owned','wishlist').

    4. Replace the inline engagement row + WearDetailMetadata layout (current lines 85-98) with the shared `<WearCard ... commentHostVariant="inline" />`. WearCard owns the photo layer, overlays, engagement row (with comment trigger → scrollIntoView), LikeButton, overflow menu, and the inline comment host section. The signed URL is still minted by the WearPhotoStreamed child; thread the signedUrl into WearCard. Two integration shapes are acceptable — choose the one that preserves the Suspense streaming:
       - Keep the `WearPhotoStreamed` server child but have it return a `<WearCard signedUrl={signedUrl} ... commentHostVariant="inline" />` (instead of returning WearPhotoClient/WearDetailHero directly). WearCard then renders the photo layer + the rest of the card. The `<Suspense fallback={<PhotoSkeleton />}>` boundary stays in the page body so the signed-URL mint streams.
    Wrap the WearCard render in `<article className="flex flex-col gap-4 pt-4">` (preserve the existing article wrapper / vertical scroll). The page retains nav (no layout change — root layout renders nav for /wear/* unchanged). Keep WearDetailMetadata (note display): WearCard from Plan 02 does NOT render the note, so render `<WearDetailMetadata note={wear.note} />` between the card photo and the comment section as today.

    5. Build WearCard props: signedUrl (from the streamed child), watchImageUrl: wear.watchImageUrl, altText (same construction as today), username/displayName/avatarUrl/createdAt/brand/model from wear, watchId: wear.watchId, viewerId, wearEventId, initialLiked: likeState.viewerHasLiked, initialCount: likeState.count, commentHostVariant: 'inline', showAddToWishlist, permalinkUrl: `/wear/${wearEventId}`.

    Preserve verbatim: the `createSupabaseServerClient` import + the `supabase.storage.from('wear-photos').createSignedUrl(photoUrl, 60 * 60)` mint inside the streamed child (Pitfall F-2 — 60-min TTL, never cached).
  </action>
  <verify>
    <automated>npm run test -- wear-detail && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "__anon__\|ANON_SENTINEL" src/app/wear/[wearEventId]/page.tsx` returns 0 (EN-6 cleanup complete)
    - File contains `const user = await getCurrentUser()` with NO try/catch swallowing UnauthorizedError around it
    - File renders `<WearCard` with `commentHostVariant="inline"`
    - No `@modal` directory or `(.)wear` intercepting segment exists under src/app (D-02): `find src/app -path '*@modal*' -o -name '(.)wear*' | wc -l` returns 0
    - `grep -c "next/image" src/app/wear/[wearEventId]/page.tsx` returns 0
    - File still contains `createSignedUrl(` with the `60 * 60` TTL inside a Suspense-streamed child (F-2 preserved)
    - File still wraps content in `<article` (vertical-scroll layout retained, SC-3)
    - `getLikesForTargetCached(viewerId, { type: 'wear', id: wearEventId })` is called with the real viewerId (no sentinel)
    - `showAddToWishlist` is computed with a `wear.userId === viewerId` check (D-09)
    - `npm run build` succeeds; `npm run test -- wear-detail` advances the SC-3/SC-4 scaffold (or stays green if covered by e2e)
  </acceptance_criteria>
  <done>/wear/[id] renders the shared WearCard (inline variant) with parity to the lane, stays a plain full-page route (no interception, D-02), retains nav + vertical scroll, removes the dead __anon__ sentinel + anon try/catch (EN-6), and preserves the per-request signed-URL Suspense mint.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client URL (/wear/[wearEventId]) → server page | wearEventId untrusted; three-tier gate in getWearEventByIdForViewer; notFound() indistinguishable for missing/denied |
| server page → Storage | signed URL minted per-request inside the Suspense child, never cached |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-56A-11 | Information Disclosure | Removing the anon path could change observable behavior for unauthenticated visitors | accept | Both wear routes are auth-only (EN-6); the proxy already redirects anon to /login for non-public paths. The removed anon branch was dead code (the page was unreachable by anon). No new exposure — anon never reaches the page. |
| T-56A-12 | Information Disclosure | Single-wear read leaking a denied wear (IDOR) | mitigate | getWearEventByIdForViewer applies the three-tier gate and returns null; the page calls notFound() uniformly for missing/denied (existing Phase 8 IDOR mitigation, unchanged). |
| T-56A-13 | Information Disclosure | Signed-URL caching/leak (Pitfall F-2) | mitigate | The WearPhotoStreamed child mint is preserved verbatim — per-request, 60-min TTL, never cached. Asserted by acceptance grep. |
</threat_model>

<verification>
- `npm run build` succeeds
- `grep -c "__anon__\|ANON_SENTINEL" src/app/wear/[wearEventId]/page.tsx` returns 0
- `find src/app -path '*@modal*'` returns nothing (D-02: no interception introduced)
- `npm run test` — existing wear-detail / reactions tests stay green after the refactor
</verification>

<success_criteria>
- /wear/[id] renders the shared WearCard (inline variant) with nav retained and vertical scroll (SC-3, SC-4)
- Detail page remains a plain full-page route, no @modal/(.)wear interception (D-02)
- __anon__ sentinel and anon try/catch removed (EN-6); signed-URL Suspense mint preserved (F-2)
</success_criteria>

<output>
After completion, create `.planning/phases/56A-wear-view-unification/56A-04-SUMMARY.md`
</output>

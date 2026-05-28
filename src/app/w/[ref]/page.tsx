import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { getWatchByIdForViewer, getWatchesByUser, getWatchById, findViewerWatchByCatalogId, getWatchPhotosForWatch } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getCatalogById } from '@/data/catalog'
import { getMostRecentWearDate, getPublicWearPicsForWatch } from '@/data/wearEvents'
import { getLikesForTargetCached } from '@/data/reactions'
import { getProfileById, getProfilesByIds } from '@/data/profiles'
import { canViewerCommentOnTarget, getCommentsForTarget } from '@/data/comments'
import { isFollowing } from '@/data/follows'
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { computeViewerTasteProfile } from '@/lib/verdict/viewerTasteProfile'
import { catalogEntryToSimilarityInput } from '@/lib/verdict/shims'
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import { WatchDetailHero } from '@/components/watch/WatchDetailHero'
import { WatchDetailTrailing } from '@/components/watch/WatchDetailTrailing'
import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
import { SameFamilyRail } from '@/components/insights/SameFamilyRail'
import { LineageRail } from '@/components/insights/LineageRail'
import { OtherOwnersRoster } from '@/components/insights/OtherOwnersRoster'
import { CatalogPageActions, type CatalogActionsSpec } from '@/components/watch/CatalogPageActions'
import { CommentThread } from '@/components/comment/CommentThread'
import { CommentThreadSkeleton } from '@/components/comment/CommentThreadSkeleton'
import { getSameFamilyForCatalog, getLineageForReference } from '@/data/hierarchy'
import { getCollectorsForCatalog } from '@/data/discovery'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { signCoverUrls } from '@/lib/storage/signCoverUrls'
import type { Watch, CrystalType, CatalogTasteAttributes } from '@/lib/types'
import type { VerdictBundle } from '@/lib/verdict/types'
import type { SignedWearPic } from '@/components/watch/WatchPhotoSection'
import type { CommentAuthor, CommentWithAuthor } from '@/components/comment/types'
import { SpecsSublabel } from '@/components/watch/SpecsSublabel'

interface UnifiedWatchPageProps {
  params: Promise<{ ref: string }>
}

// Phase 61 debug (phase61-404-react-419-soft-nav) — structural fix.
// `unstable_instant` is a build/dev VALIDATOR, not a runtime feature (see the
// rationale block on src/app/u/[username]/[tab]/page.tsx). We opt OUT of
// validation here and rely on the structural pattern below; the opt-out does
// NOT disable Cache Components / PPR for the route.
export const unstable_instant = false

/**
 * Phase 59 D-01 — Unified watch-detail route (Variant C hard cutover).
 *
 * Resolves `ref` as either a per-user watches.id (Branch 1) or a catalog UUID
 * (Branch 2) via try-per-user-then-catalog (D-04).
 *
 * Security: zero server redirects (D-02/D-08) — Router Cache poisoning is
 * avoided by design. Owner arriving via a catalogId URL gets the full owned
 * view rendered in place (D-06), not a server redirect.
 *
 * B1 invariant: RSC siblings (CommentThread, rails, OtherOwnersRoster,
 * CatalogPageActions, CollectionFitCard, ReferenceIdentityCard) compose AROUND
 * the 'use client' WatchDetail island — never imported into it.
 *
 * Phase 61 debug (phase61-404-react-419-soft-nav) — STRUCTURAL #419 fix
 * (D-52-16 "outer-sync / inner-async / <Suspense>"). The default export is a
 * SYNC component that wraps all runtime-API / dynamic work (await params,
 * getCurrentUser → cookies, DAL reads, photo signing) in a LOCAL <Suspense>
 * boundary. Without this, the async page body had no boundary visible to
 * client (soft) navigations — the only ancestor boundary was the root
 * layout's <Suspense>, which sits ABOVE the shared layout entry point and is
 * invisible to soft-nav into /w/[ref]. The dynamic body therefore aborted the
 * prerender on soft-nav → React #419 + 404 (hard refresh works because the
 * full document render uses the root boundary). Moving the work behind a local
 * boundary gives the page segment a static shell (WatchPageSkeleton) and
 * streams the dynamic content. Ref: node_modules/next/dist/docs/01-app/
 * 02-guides/instant-navigation.md "Fixing a page that blocks"; mirrors the
 * Phase 52 profile-route fix. Removing the signing cookies (admin-client)
 * fixed /u/[username]/[tab] (already had this structure) but NOT /w/[ref],
 * which lacked it.
 */
export default async function UnifiedWatchPage({ params }: UnifiedWatchPageProps) {
  // Phase 61 debug (phase61-404-react-419-soft-nav) — opt OUT of the PPR static
  // shell. `await connection()` excludes EVERYTHING below (including the Suspense
  // fallback) from prerendering, so this route has NO prerendered static shell to
  // serve+resume on client (soft) navigation. Soft-nav therefore renders at
  // request time exactly like the always-working hard refresh — eliminating the
  // partial-prerender RESUME that aborts → React #419 + 404. The inner <Suspense>
  // still streams WatchPageSkeleton during the request-time render (caching.md:
  // "React renders the fallback first, then streams in the resolved content").
  // 'use cache' DATA segments (getLikesForTargetCached, getCatalogById) still
  // cache — only the page ASSEMBLY is forced dynamic. Ref: next docs
  // 03-api-reference/04-functions/connection.md + 01-getting-started/08-caching.md
  // "Opting out of the static shell".
  await connection()
  return (
    <Suspense fallback={<WatchPageSkeleton />}>
      <UnifiedWatchContent params={params} />
    </Suspense>
  )
}

// Static shell for the route segment — pure JSX, no dynamic API access, so it
// can be prerendered as the instant shell for soft navigations into /w/[ref].
// Phase 64: updated to mirror the new IA (hero grid → comment skeleton → spec-card skeleton).
// MUST remain: no dynamic API (cookies/headers/params), no hooks, no 'use client'.
function WatchPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8" aria-hidden>
      {/* Hero grid — mirrors WatchDetailHero lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Skeleton className="aspect-square w-full rounded-lg" />
        <div className="space-y-4 min-w-0">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      {/* Comment section skeleton */}
      <Skeleton className="h-32 w-full rounded-lg" />
      {/* Spec cards skeleton */}
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  )
}

async function UnifiedWatchContent({ params }: UnifiedWatchPageProps) {
  const { ref } = await params

  // Defense-in-depth: validate UUID format before any DB query so malformed
  // URLs collapse cleanly to 404 instead of bubbling up Postgres "invalid input
  // syntax for uuid" as a 500 error boundary. (V5 input validation — T-59-09)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
    notFound()
  }

  const user = await getCurrentUser()

  // -------------------------------------------------------------------------
  // Branch 1: Per-user resolution (D-04 first try)
  // Mirrors src/app/watch/[id]/page.tsx lines 32-199 exactly.
  // -------------------------------------------------------------------------
  const perUserResult = await getWatchByIdForViewer(user.id, ref)

  if (perUserResult) {
    const { watch: rawWatch, isOwner, ownerUserId } = perUserResult
    // Issue #2 (2026-05-26): sign the cover `imageUrl` — same as grids do via
    // signCoverUrls — so a catalog watch whose imageUrl is a RAW storage path
    // renders on the detail page instead of the WatchIcon placeholder. The detail
    // page previously passed the UNSIGNED watch, so getSafeImageUrl(rawPath) → null
    // → placeholder (while grids signed it and rendered fine). signCoverUrls passes
    // https URLs through unchanged, so URL-extracted watches are unaffected.
    const [watch] = await signCoverUrls([rawWatch])

    const [collection, preferences] = await Promise.all([
      getWatchesByUser(user.id),
      getPreferencesByUser(user.id),
    ])

    // Phase 61 PHOTO-03 — structural fix (phase61-404-react-419-soft-nav debug):
    // Sign owner photos using the admin client (service role) instead of the
    // cookie-based server client. The original fix (P61-BUG-01) moved the signing
    // BEFORE 'use cache' calls, but call ordering does not resolve the issue:
    // any invocation of createSupabaseServerClient() (which reads cookies()) in an
    // RSC that also calls 'use cache' functions corrupts the PPR prerender boundary
    // and causes React #419 on soft-nav regardless of ordering. The admin client
    // bypasses cookies() entirely — safe for storage URL signing because:
    //   (a) paths are user-scoped ({userId}/…) by construction (IDOR fix in Phase 61),
    //   (b) signing creates a time-limited token, not a data query.
    // The admin client is NOT used for data queries here; this is signing-only.
    const rawPhotos = isOwner ? await getWatchPhotosForWatch(watch.id) : []
    let signedPhotos: Array<{ id: string; signedUrl: string | null; sortOrder: number }> = []
    if (rawPhotos.length > 0) {
      const supabase = createSupabaseAdminClient()
      signedPhotos = await Promise.all(
        rawPhotos.map(async (p) => {
          const { data } = await supabase.storage
            .from('watch-photos')
            .createSignedUrl(p.storagePath, 60 * 60)  // 60-min TTL (T-61-07)
          return { id: p.id, signedUrl: data?.signedUrl ?? null, sortOrder: p.sortOrder }
        }),
      )
    }

    // Phase 62 Plan 04 — fetch public wear pics and sign their URLs.
    // Runs for ALL viewers (D-06: all wear pics on a watch's detail page are the
    // watch owner's — no per-viewer filter). getPublicWearPicsForWatch filters
    // visibility='public' AND NOT hidden_from_detail server-side (T-62-13).
    const rawWearPics = await getPublicWearPicsForWatch(watch.id)
    let signedWearPics: SignedWearPic[] = []
    let viewerAuthorForWears: CommentAuthor | null = null
    if (rawWearPics.length > 0) {
      // Reuse one admin client instance for both watch-photos and wear-photos signing
      // (T-62-12: admin client only; never cookie client in PPR routes).
      const supabaseAdmin = createSupabaseAdminClient()
      // Pre-fetch like + comment state per wear pic (Option A — RESEARCH §Open Q1).
      // Promise.all over <10 pics keeps latency acceptable.
      const wearPicSocialData = await Promise.all(
        rawWearPics.map(async (p) => {
          const wearTarget = { type: 'wear' as const, id: p.id }
          const [likeState, rawComments] = await Promise.all([
            getLikesForTargetCached(user.id, wearTarget),
            getCommentsForTarget(user.id, wearTarget),
          ])
          return { pic: p, likeState, rawComments }
        }),
      )
      // Batch-enrich comment authors (mirrors wears/[username]/page.tsx pattern).
      const allAuthorIds = [
        ...new Set([
          ...wearPicSocialData.flatMap((d) => d.rawComments.map((c) => c.authorId)),
          user.id,
        ]),
      ]
      const profileMap = await getProfilesByIds(allAuthorIds)
      const fallbackAuthor: CommentAuthor = { username: 'unknown', displayName: null, avatarUrl: null }
      viewerAuthorForWears = profileMap.get(user.id) ?? null

      signedWearPics = await Promise.all(
        wearPicSocialData.map(async ({ pic, likeState, rawComments }) => {
          // Sign wear-photo URL via admin client; fail safe to null (D-19 / T-62-12).
          let signedUrl: string | null = null
          if (pic.photoUrl) {
            try {
              const { data } = await supabaseAdmin.storage
                .from('wear-photos')
                .createSignedUrl(pic.photoUrl, 60 * 60)
              signedUrl = data?.signedUrl ?? null
            } catch {
              signedUrl = null
            }
          }
          const initialComments: CommentWithAuthor[] = rawComments.map((c) => ({
            ...c,
            author: profileMap.get(c.authorId) ?? fallbackAuthor,
          }))
          return {
            wearEventId: pic.id,
            signedUrl,
            wornDate: pic.wornDate,
            hiddenFromDetail: pic.hiddenFromDetail,
            initialLikeState: { liked: likeState.viewerHasLiked, count: likeState.count },
            commentCount: initialComments.length,
            initialComments,
          }
        }),
      )
    }

    // Phase 56 D-03: hydrate like state server-side via cached aggregate read.
    // user.id is always a string on this auth-only route (getCurrentUser throws for anon).
    const target = { type: 'watch' as const, id: ref }
    const [likeState, canComment] = await Promise.all([
      getLikesForTargetCached(user.id, target),
      canViewerCommentOnTarget(user.id, target),
    ])

    // SC-6 (Phase 57.1 Plan 03): route-level display gate for own-watch compose suppression.
    // canComment is the raw DAL result (TRUE for the owner via GATE-04 — intentional; do NOT change).
    // canCommentDisplay is a presentation derivative ONLY: false for the owner so CommentThread
    // receives canComment=false, preventing it from rendering a compose box to the owner.
    // The DAL authorization gate (canViewerCommentOnTarget / GATE-04) is UNCHANGED.
    const canCommentDisplay = isOwner ? false : canComment

    // Phase 57 Plan 05: GATE-03 signals — only resolve isFollowing when needed (wishlist gate).
    // ownerFollowsViewer: owner→viewer direction (GATE-03 State 1 vs 2 copy).
    // viewerIsFollowing: viewer→owner direction (CommentGateLocked State 1 vs 2 selection).
    const ownerFollowsViewer =
      !canComment && watch.status === 'wishlist'
        ? await isFollowing(ownerUserId, user.id)
        : false
    const viewerIsFollowing =
      !canComment && watch.status === 'wishlist'
        ? await isFollowing(user.id, ownerUserId)
        : false

    // Resolve comment count for the WatchDetail footer badge (CMNT-09).
    const commentCount = canComment
      ? (await getCommentsForTarget(user.id, target)).length
      : 0

    // Resolve owner profile for CommentThread (ownerUsername prop).
    const ownerProfile = await getProfileById(ownerUserId)

    // Non-owner never receives lastWornDate — conservative default that honors
    // worn_public intent without adding a separate flag lookup (T-RDB-03).
    const lastWornDate = isOwner ? await getMostRecentWearDate(user.id, watch.id) : null

    // Phase 20 D-03 + D-07: compute verdict on the server when the viewer has a
    // collection signal. Empty-collection viewers see no card at all (D-07 lock).
    // Both same-user and cross-user framings can occur here (D-07, D-07).
    let verdict: VerdictBundle | null = null
    if (collection.length > 0) {
      const [profile, catalogEntry] = await Promise.all([
        computeViewerTasteProfile(collection),
        watch.catalogId ? getCatalogById(watch.catalogId) : Promise.resolve(null),
      ])
      verdict = computeVerdictBundle({
        candidate: watch,
        catalogEntry,
        collection,
        preferences,
        profile,
        framing: isOwner ? 'same-user' : 'cross-user',
      })
    }

    // Phase 39b NSV-02 + NSV-16 — lineage rail data. watch.catalogId is nullable
    // per Phase 36 deferred-items.md Item 1. Falsy-fallback to [] so rails
    // self-hide via internal rows.length === 0 guard when catalogId is missing.
    // Both rails render as Server-Component siblings of <WatchDetail/> (B1 invariant).
    const sameFamily = watch.catalogId ? await getSameFamilyForCatalog(watch.catalogId) : []
    const lineage = watch.catalogId ? await getLineageForReference(watch.catalogId) : []

    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        {/* Phase 64 D-02/D-09: WatchDetailHero replaces monolithic WatchDetail island.
            Hero owns: 2-col grid (carousel left, verdict+title+like+actions right).
            Empty-verdict states (ReferenceIdentityCard / caption) are now handled
            inside WatchDetailHero — no duplicate siblings needed here. */}
        <WatchDetailHero
          watch={watch}
          collection={collection}
          lastWornDate={lastWornDate}
          viewerCanEdit={isOwner}
          verdict={verdict}
          viewerId={user.id}
          initialLikeState={{ liked: likeState.viewerHasLiked, count: likeState.count }}
          commentCount={commentCount}
          signedPhotos={signedPhotos}
          userId={isOwner ? user.id : undefined}
          wearPics={signedWearPics}
          ownerUserId={ownerUserId}
          ownerUsername={ownerProfile?.username ?? ''}
          viewerAuthor={viewerAuthorForWears}
          canCommentOnWears={!isOwner && canComment}
          ownerFollowsViewerForWears={ownerFollowsViewer}
          viewerIsFollowingForWears={viewerIsFollowing}
        />

        {/* Phase 64 D-06: CommentThread MOVED UP — position 2, directly below the hero.
            RSC sibling — uncached, in Suspense. NEVER imported into the client island.
            DOM order = visual order (D-07: no CSS flex-reverse). */}
        <Suspense fallback={<CommentThreadSkeleton />}>
          <CommentThread
            viewerId={user.id}
            target={target}
            canComment={canCommentDisplay}
            ownerFollowsViewer={ownerFollowsViewer}
            viewerIsFollowing={viewerIsFollowing}
            ownerUserId={ownerUserId}
            ownerUsername={ownerProfile?.username ?? ''}
            suppressCompose={isOwner}
          />
        </Suspense>

        {/* Phase 64 D-07: WatchDetailTrailing RSC sibling — spec cards AFTER comments. */}
        <WatchDetailTrailing
          watch={watch}
          collection={collection}
          preferences={preferences}
          lastWornDate={lastWornDate}
        />

        {/* Phase 39b NSV-02 + NSV-16 — Same family + Lineage rails below spec cards. */}
        <SameFamilyRail rows={sameFamily} />
        <LineageRail rows={lineage} />

        {/* Phase 39b NSV-06 — Fresh-account 3-CTA block (Add to Wishlist /
            Add to Collection / Skip). Edit links use /w/ prefix (Phase 59 D-01).
            Owner-populated viewer sees no CTAs (D-39b-04 / UI-SPEC).
            CR-01: gate on isOwner — the edit links target watch.id (the owner's
            watches.id), so a non-owner viewer would hit the owner-scoped edit
            route → 404. Only the owner sees the onboarding CTAs. */}
        {isOwner && collection.length === 0 && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/w/${watch.id}/edit?status=wishlist`}>
              <Button variant="outline">Add to Wishlist</Button>
            </Link>
            <Link href={`/w/${watch.id}/edit?status=owned`}>
              <Button>Add to Collection</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">Skip</Button>
            </Link>
          </div>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Branch 2: Catalog resolution (D-04 fallback — perUserResult was null)
  // Mirrors src/app/catalog/[catalogId]/page.tsx, replacing the redirect at
  // line 112 with in-place owner detection (D-06/D-08).
  // ---------------------------------------------------------------------------
  const [catalogEntry, collection, preferences, viewerOwnedRow, viewerProfile, roster, sameFamily, lineage] = await Promise.all([
    getCatalogById(ref),
    getWatchesByUser(user.id),
    getPreferencesByUser(user.id),
    findViewerWatchByCatalogId(user.id, ref),
    getProfileById(user.id),
    // Phase 39b NSV-18 — catalog other-owners roster (two-layer privacy +
    // self-exclusion + sold-status filter inside the DAL).
    getCollectorsForCatalog(ref, user.id, { limit: 5 }),
    getSameFamilyForCatalog(ref),
    getLineageForReference(ref),
  ])

  if (!catalogEntry) notFound()

  const viewerUsername = viewerProfile?.username ?? null

  // Phase 39b NSV-20 — adapt top-level CatalogEntry taste fields to
  // CatalogTasteAttributes so ReferenceIdentityCard renders identically on
  // both surfaces. Phase 49.1 D-SCOPE-01e: projection drops primaryArchetype.
  const catalogTaste: CatalogTasteAttributes | null = {
    formality: catalogEntry.formality,
    sportiness: catalogEntry.sportiness,
    heritageScore: catalogEntry.heritageScore,
    eraSignal: catalogEntry.eraSignal,
    designMotifs: catalogEntry.designMotifs,
    confidence: catalogEntry.confidence,
    extractedFromPhoto: catalogEntry.extractedFromPhoto,
  }

  // D-06: Ownership detection on the catalog branch.
  // If the viewer already owns a watch matching this catalogId, load the full
  // Watch and render the same-user owned view IN PLACE (no redirect — D-08).
  if (viewerOwnedRow) {
    const ownedWatchRaw = await getWatchById(user.id, viewerOwnedRow.id)
    if (!ownedWatchRaw) notFound()
    // Issue #2 (2026-05-26): sign the cover imageUrl (raw storage path → signed
    // URL) so the D-06 owned view renders the catalog/cover photo on the detail
    // page instead of the placeholder. See Branch 1 comment for rationale.
    const [ownedWatch] = await signCoverUrls([ownedWatchRaw])

    // Phase 61 PHOTO-03 — structural fix (phase61-404-react-419-soft-nav debug):
    // Sign owner photos using the admin client. See Branch 1 comment above for rationale.
    const ownedRawPhotos = await getWatchPhotosForWatch(ownedWatch.id)
    let ownedSignedPhotos: Array<{ id: string; signedUrl: string | null; sortOrder: number }> = []
    if (ownedRawPhotos.length > 0) {
      const supabase = createSupabaseAdminClient()
      ownedSignedPhotos = await Promise.all(
        ownedRawPhotos.map(async (p) => {
          const { data } = await supabase.storage
            .from('watch-photos')
            .createSignedUrl(p.storagePath, 60 * 60)  // 60-min TTL (T-61-07)
          return { id: p.id, signedUrl: data?.signedUrl ?? null, sortOrder: p.sortOrder }
        }),
      )
    }

    // Fetch all per-user data using the watches.id (not the catalogId ref).
    const ownedTarget = { type: 'watch' as const, id: viewerOwnedRow.id }
    const [likeState, canComment] = await Promise.all([
      getLikesForTargetCached(user.id, ownedTarget),
      canViewerCommentOnTarget(user.id, ownedTarget),
    ])

    // Owner always has canCommentDisplay=false (compose suppression).
    const canCommentDisplay = false
    const commentCount = canComment
      ? (await getCommentsForTarget(user.id, ownedTarget)).length
      : 0

    const ownerProfile = await getProfileById(user.id)
    const lastWornDate = await getMostRecentWearDate(user.id, ownedWatch.id)

    let verdict: VerdictBundle | null = null
    if (collection.length > 0) {
      const [profile, catalogEntryForVerdict] = await Promise.all([
        computeViewerTasteProfile(collection),
        ownedWatch.catalogId ? getCatalogById(ownedWatch.catalogId) : Promise.resolve(null),
      ])
      verdict = computeVerdictBundle({
        candidate: ownedWatch,
        catalogEntry: catalogEntryForVerdict,
        collection,
        preferences,
        profile,
        framing: 'same-user',  // D-07: owner branch is always same-user
      })
    }

    const ownedSameFamily = ownedWatch.catalogId ? await getSameFamilyForCatalog(ownedWatch.catalogId) : []
    const ownedLineage = ownedWatch.catalogId ? await getLineageForReference(ownedWatch.catalogId) : []

    // isOwner = true on the D-06 branch (viewerCanEdit={true})
    const isOwner = true

    // Phase 62 Plan 04 — fetch public wear pics for D-06 owned branch.
    // Same pattern as Branch 1; admin client only (T-62-12).
    const ownedRawWearPics = await getPublicWearPicsForWatch(ownedWatch.id)
    let ownedSignedWearPics: SignedWearPic[] = []
    let ownedViewerAuthorForWears: CommentAuthor | null = null
    if (ownedRawWearPics.length > 0) {
      const supabaseAdminD06 = createSupabaseAdminClient()
      const ownedWearPicSocialData = await Promise.all(
        ownedRawWearPics.map(async (p) => {
          const wearTarget = { type: 'wear' as const, id: p.id }
          const [likeStateWear, rawComments] = await Promise.all([
            getLikesForTargetCached(user.id, wearTarget),
            getCommentsForTarget(user.id, wearTarget),
          ])
          return { pic: p, likeState: likeStateWear, rawComments }
        }),
      )
      const ownedAllAuthorIds = [
        ...new Set([
          ...ownedWearPicSocialData.flatMap((d) => d.rawComments.map((c) => c.authorId)),
          user.id,
        ]),
      ]
      const ownedProfileMap = await getProfilesByIds(ownedAllAuthorIds)
      const ownedFallbackAuthor: CommentAuthor = { username: 'unknown', displayName: null, avatarUrl: null }
      ownedViewerAuthorForWears = ownedProfileMap.get(user.id) ?? null

      ownedSignedWearPics = await Promise.all(
        ownedWearPicSocialData.map(async ({ pic, likeState: likeStateWear, rawComments }) => {
          let signedUrl: string | null = null
          if (pic.photoUrl) {
            try {
              const { data } = await supabaseAdminD06.storage
                .from('wear-photos')
                .createSignedUrl(pic.photoUrl, 60 * 60)
              signedUrl = data?.signedUrl ?? null
            } catch {
              signedUrl = null
            }
          }
          const initialComments: CommentWithAuthor[] = rawComments.map((c) => ({
            ...c,
            author: ownedProfileMap.get(c.authorId) ?? ownedFallbackAuthor,
          }))
          return {
            wearEventId: pic.id,
            signedUrl,
            wornDate: pic.wornDate,
            hiddenFromDetail: pic.hiddenFromDetail,
            initialLikeState: { liked: likeStateWear.viewerHasLiked, count: likeStateWear.count },
            commentCount: initialComments.length,
            initialComments,
          }
        }),
      )
    }

    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        {/* D-06: Full owned view rendered in place — same tree as Branch 1 same-user.
            target.id is viewerOwnedRow.id (watches.id), NOT ref (catalogId).
            Phase 64 D-02/D-09: WatchDetailHero replaces monolithic WatchDetail island.
            Empty-verdict states handled inside the hero — no duplicate siblings. */}
        <WatchDetailHero
          watch={ownedWatch}
          collection={collection}
          lastWornDate={lastWornDate}
          viewerCanEdit={isOwner}
          verdict={verdict}
          viewerId={user.id}
          initialLikeState={{ liked: likeState.viewerHasLiked, count: likeState.count }}
          commentCount={commentCount}
          signedPhotos={ownedSignedPhotos}
          userId={user.id}
          wearPics={ownedSignedWearPics}
          ownerUserId={user.id}
          ownerUsername={ownerProfile?.username ?? ''}
          viewerAuthor={ownedViewerAuthorForWears}
          canCommentOnWears={false}
          ownerFollowsViewerForWears={false}
          viewerIsFollowingForWears={false}
        />

        {/* Phase 64 D-06: CommentThread MOVED UP — position 2, directly below the hero.
            OtherOwnersRoster and CatalogPageActions are cross-user-only (D-15/spike §4.D)
            — correctly absent on this owner branch. Phase 64 IA redesign resolves this. */}
        <Suspense fallback={<CommentThreadSkeleton />}>
          <CommentThread
            viewerId={user.id}
            target={ownedTarget}
            canComment={canCommentDisplay}
            ownerFollowsViewer={false}
            viewerIsFollowing={false}
            ownerUserId={user.id}
            ownerUsername={ownerProfile?.username ?? ''}
            suppressCompose={true}
          />
        </Suspense>

        {/* Phase 64 D-07: WatchDetailTrailing RSC sibling — spec cards AFTER comments. */}
        <WatchDetailTrailing
          watch={ownedWatch}
          collection={collection}
          preferences={preferences}
          lastWornDate={lastWornDate}
        />

        {/* Rails below spec cards — B1 invariant */}
        <SameFamilyRail rows={ownedSameFamily} />
        <LineageRail rows={ownedLineage} />

        {collection.length === 0 && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/w/${ownedWatch.id}/edit?status=wishlist`}>
              <Button variant="outline">Add to Wishlist</Button>
            </Link>
            <Link href={`/w/${ownedWatch.id}/edit?status=owned`}>
              <Button>Add to Collection</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost">Skip</Button>
            </Link>
          </div>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Branch 2 (continued): Pure cross-user catalog view (no owned row).
  // Mirrors src/app/catalog/[catalogId]/page.tsx lines 113-258.
  // ---------------------------------------------------------------------------
  const isOwner = false
  let verdict: VerdictBundle | null = null
  let actionsSpec: CatalogActionsSpec | null = null

  if (collection.length > 0) {
    // D-03/D-07 — cross-user framing, full verdict.
    const profile = await computeViewerTasteProfile(collection)
    const candidate: Watch = catalogEntryToSimilarityInput(catalogEntry)
    verdict = computeVerdictBundle({
      candidate,
      catalogEntry,
      collection,
      preferences,
      profile,
      framing: 'cross-user',  // D-07: non-owner catalog branch is always cross-user
    })
    // Phase 20.1 D-05 — cross-user framing with non-empty collection → render
    // CatalogPageActions. strapType is per-user (catalog table doesn't carry it).
    actionsSpec = buildActionsSpec(catalogEntry)
  } else {
    // Phase 39b NSV-20 — fresh-account viewer. Verdict stays null but actionsSpec
    // is built so the 3-CTA block still renders.
    actionsSpec = buildActionsSpec(catalogEntry)
  }

  return (
    // Phase 64 D-14: space-y-8 for visual parity with Branches 1 & 2.
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      {/* Catalog hero shell — RSC inline (no client island; no like button in Branch 3). */}
      <div className="flex items-start gap-4">
        {catalogEntry.imageUrl && (
          <div className="size-24 rounded-md bg-muted overflow-hidden flex-shrink-0">
            <Image
              src={catalogEntry.imageUrl}
              alt={`${catalogEntry.brand} ${catalogEntry.model}`}
              width={96}
              height={96}
              className="object-cover w-full h-full"
              unoptimized
            />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold">
            {catalogEntry.brand} {catalogEntry.model}
          </h1>
          {catalogEntry.reference && (
            <p className="text-sm text-muted-foreground">{catalogEntry.reference}</p>
          )}
          <SpecsSublabel
            movement={catalogEntry.movementType}
            caseSizeMm={catalogEntry.caseSizeMm}
            dialColor={catalogEntry.dialColor}
          />
        </div>
      </div>

      {verdict && <CollectionFitCard verdict={verdict} />}

      {/* Phase 39b NSV-20 — Fresh-account viewer: ReferenceIdentityCard OR fallback caption. */}
      {collection.length === 0 &&
        catalogTaste &&
        catalogTaste.confidence !== null &&
        catalogTaste.confidence >= 0.5 && (
          <ReferenceIdentityCard taste={catalogTaste} />
        )}
      {collection.length === 0 &&
        (!catalogTaste ||
          catalogTaste.confidence === null ||
          catalogTaste.confidence < 0.5) && (
          <p className="text-sm text-muted-foreground">
            Add a few watches to see how this one fits your collection.
          </p>
        )}

      {/* Phase 64 D-13: OtherOwnersRoster MOVED UP — social proof near the verdict.
          Cross-user only (isOwner=false on this branch — D-15/spike §4.D).
          Self-hides when collectors.length === 0 (D-39b-07). */}
      <OtherOwnersRoster collectors={roster.collectors} totalCount={roster.totalCount} />

      {/* Phase 64 D-13: CatalogPageActions MOVED UP — add-to-collection CTA near the verdict.
          Cross-user only (isOwner=false on this branch). No longer last. */}
      {actionsSpec && (
        <CatalogPageActions
          catalogId={ref}
          spec={actionsSpec}
          framing="cross-user"
          viewerUsername={viewerUsername}
        />
      )}

      {/* Phase 39b NSV-02 + NSV-16 — Same family + Lineage rails below social proof. */}
      <SameFamilyRail rows={sameFamily} />
      <LineageRail rows={lineage} />
    </div>
  )
}

/**
 * Build CatalogActionsSpec from a catalog entry. Extracted to avoid duplication
 * between the collection.length > 0 and fresh-account branches.
 */
function buildActionsSpec(catalogEntry: Awaited<ReturnType<typeof getCatalogById>> & object): CatalogActionsSpec {
  return {
    brand: catalogEntry.brand,
    model: catalogEntry.model,
    reference: catalogEntry.reference,
    movement: catalogEntry.movementType,
    caseSizeMm: catalogEntry.caseSizeMm,
    lugToLugMm: catalogEntry.lugToLugMm,
    waterResistanceM: catalogEntry.waterResistanceM,
    strapType: null,
    crystalType: catalogEntry.crystalType as CrystalType | null,
    dialColor: catalogEntry.dialColor,
    isChronometer: catalogEntry.isChronometer,
    complications: catalogEntry.complications ?? [],
    styleTags: catalogEntry.styleTags ?? [],
    designTraits: catalogEntry.designTraits ?? [],
    imageUrl: catalogEntry.imageUrl,
  }
}


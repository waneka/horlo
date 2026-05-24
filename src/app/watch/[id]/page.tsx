import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { getWatchByIdForViewer, getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getCatalogById } from '@/data/catalog'
import { getMostRecentWearDate } from '@/data/wearEvents'
import { getLikesForTargetCached } from '@/data/reactions'
import { getProfileById } from '@/data/profiles'
import { canViewerCommentOnTarget, getCommentsForTarget } from '@/data/comments'
import { isFollowing } from '@/data/follows'
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { computeViewerTasteProfile } from '@/lib/verdict/viewerTasteProfile'
import type { VerdictBundle } from '@/lib/verdict/types'
import { WatchDetail } from '@/components/watch/WatchDetail'
import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
import { SameFamilyRail } from '@/components/insights/SameFamilyRail'
import { LineageRail } from '@/components/insights/LineageRail'
import { CommentThread } from '@/components/comment/CommentThread'
import { CommentThreadSkeleton } from '@/components/comment/CommentThreadSkeleton'
import { getSameFamilyForCatalog, getLineageForReference } from '@/data/hierarchy'
import { Button } from '@/components/ui/button'

interface WatchPageProps {
  params: Promise<{ id: string }>
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params
  const user = await getCurrentUser()
  const [result, collection, preferences] = await Promise.all([
    getWatchByIdForViewer(user.id, id),
    getWatchesByUser(user.id),
    getPreferencesByUser(user.id),
  ])

  if (!result) {
    notFound()
  }

  const { watch, isOwner, ownerUserId } = result

  // Phase 56 D-03: hydrate like state server-side via cached aggregate read.
  // user.id is always a string on this auth-only route (getCurrentUser throws for anon).
  const target = { type: 'watch' as const, id }
  const [likeState, canComment] = await Promise.all([
    getLikesForTargetCached(user.id, target),
    canViewerCommentOnTarget(user.id, target),
  ])

  // SC-6 (Phase 57.1 Plan 03): route-level display gate for own-watch compose suppression.
  // canComment is the raw DAL result (TRUE for the owner via GATE-04 — intentional; do NOT change).
  // canCommentDisplay is a presentation derivative ONLY: false for the owner so CommentThread
  // receives canComment=false, preventing it from rendering a compose box to the owner.
  // The DAL authorization gate (canViewerCommentOnTarget / GATE-04) is UNCHANGED.
  // Note: the comment-count read below deliberately keeps the raw `canComment` (CMNT-09 / RESEARCH
  // count-read correction) — switching to canCommentDisplay would zero the owner's badge.
  const canCommentDisplay = isOwner ? false : canComment

  // Phase 57 Plan 05: GATE-03 signals — only resolve isFollowing when needed (wishlist gate).
  // ownerFollowsViewer: owner→viewer direction (GATE-03 State 1 vs 2 copy).
  // viewerIsFollowing: viewer→owner direction (CommentGateLocked State 1 vs 2 selection).
  // Both are false when canComment=true (gate is open) or non-wishlist watch.
  const ownerFollowsViewer =
    !canComment && watch.status === 'wishlist'
      ? await isFollowing(ownerUserId, user.id)
      : false
  const viewerIsFollowing =
    !canComment && watch.status === 'wishlist'
      ? await isFollowing(user.id, ownerUserId)
      : false

  // Resolve comment count for the WatchDetail footer badge (CMNT-09).
  // Single-read: call getCommentsForTarget once and use .length for the footer count.
  // CommentThread will use its own internal call — this one extra uncached read is
  // acceptable vs. adding an initialComments prop chain through WatchDetail (D-03 pattern).
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
  // /watch/[id] is keyed by per-user watches.id — only same-user and cross-user
  // framings can occur here (D-08 catalog framing is impossible on this route;
  // see RESEARCH Open Q4 resolution).
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
  // per Phase 36 deferred-items.md Item 1 (CAT-14 .notNull() Drizzle tightening
  // deferred to Phase 38). Falsy-fallback to [] so rails self-hide via internal
  // rows.length === 0 guard when catalogId is missing. Both rails render as
  // Server-Component siblings of <WatchDetail/> below (B1 invariant — RSCs
  // CANNOT be imported into the 'use client' WatchDetail island).
  const sameFamily = watch.catalogId ? await getSameFamilyForCatalog(watch.catalogId) : []
  const lineage = watch.catalogId ? await getLineageForReference(watch.catalogId) : []

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      <WatchDetail
        watch={watch}
        collection={collection}
        preferences={preferences}
        lastWornDate={lastWornDate}
        viewerCanEdit={isOwner}
        verdict={verdict}
        viewerId={user.id}
        initialLikeState={{ liked: likeState.viewerHasLiked, count: likeState.count }}
        commentCount={commentCount}
      />

      {/* Phase 39b NSV-06 — Fresh-account viewer: ReferenceIdentityCard OR
          fallback caption. Server-Component sibling of <WatchDetail/> (B1 fix —
          RSC cannot be imported into the 'use client' WatchDetail island;
          compose at the server tree level instead). D-39b-03 confidence gate
          mirrored explicitly in the caller; ReferenceIdentityCard also gates
          internally as defense-in-depth. */}
      {collection.length === 0 &&
        watch.catalogTaste &&
        watch.catalogTaste.confidence !== null &&
        watch.catalogTaste.confidence >= 0.5 && (
          <ReferenceIdentityCard taste={watch.catalogTaste} />
        )}
      {collection.length === 0 &&
        (!watch.catalogTaste ||
          watch.catalogTaste.confidence === null ||
          watch.catalogTaste.confidence < 0.5) && (
          <p className="text-sm text-muted-foreground">
            Add a few watches to see how this one fits your collection.
          </p>
        )}

      {/* Phase 39b NSV-02 + NSV-16 — Same family + Lineage rails. Server-
          Component siblings of <WatchDetail/> per the B1 sibling-composition
          pattern (WatchDetail is 'use client' and CANNOT import RSCs). Render
          unconditionally on viewer state; each rail self-hides via internal
          rows.length === 0 guard (D-39b-07). UI-SPEC §Render Order: position
          between the verdict / ReferenceIdentityCard / caption block and the
          3-CTA block. */}
      <SameFamilyRail rows={sameFamily} />
      <LineageRail rows={lineage} />

      {/* Phase 57 Plan 05 CMNT-01: CommentThread RSC sibling — uncached, in Suspense.
          Rendered at the server tree level (NOT imported inside the 'use client' WatchDetail
          island — B1 invariant). CommentThread fetches its own comment list internally.
          viewerIsFollowing resolved server-side (GATE-03 / D-03 plan constraint). */}
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

      {/* Phase 39b NSV-06 — Fresh-account 3-CTA block (Add to Wishlist /
          Add to Collection / Skip). UI-SPEC § Render Order line 266 — first
          phase to introduce these CTAs on /watch/{id}. Owner-populated viewer
          sees no CTAs (D-39b-04 / UI-SPEC). */}
      {collection.length === 0 && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/watch/${watch.id}/edit?status=wishlist`}>
            <Button variant="outline">Add to Wishlist</Button>
          </Link>
          <Link href={`/watch/${watch.id}/edit?status=owned`}>
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

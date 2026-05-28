'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MessageCircle, Watch as WatchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { getSafeImageUrl } from '@/lib/images'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LikeButton } from '@/components/shared/LikeButton'
import { editWatch, removeWatch } from '@/app/actions/watches'
import { markAsWorn } from '@/app/actions/wearEvents'
import { CollectionFitCard } from '@/components/insights/CollectionFitCard'
import { ReferenceIdentityCard } from '@/components/insights/ReferenceIdentityCard'
import { WatchPhotoSection } from '@/components/watch/WatchPhotoSection'
import type { SignedWearPic } from '@/components/watch/WatchPhotoSection'
import type { CommentAuthor } from '@/components/comment/types'
import { daysSince } from '@/lib/wear'
import type { Watch } from '@/lib/types'
import type { VerdictBundle } from '@/lib/verdict/types'
import { SpecsSublabel } from '@/components/watch/SpecsSublabel'

// timeZone: 'UTC' is REQUIRED for hydration safety (React #418). Wear/acquisition
// dates are stored date-only (parsed as UTC midnight); formatting without a fixed
// timeZone uses the runtime's zone, so the server (UTC) and a browser in a
// negative-offset zone render different calendar days → hydration mismatch.
function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface WatchDetailHeroProps {
  watch: Watch
  collection: Watch[]
  lastWornDate?: string | null
  /**
   * Gates owner-only UI (Edit, Delete, Mark as Worn, Flag as good deal,
   * Last worn line). Defaults to true for backward compat.
   */
  viewerCanEdit?: boolean
  /**
   * Precomputed VerdictBundle from page.tsx.
   * null means viewer collection is empty (D-10) — render empty-state slot.
   */
  verdict?: VerdictBundle | null
  /** Viewer identity for LikeButton. */
  viewerId?: string
  /** Server-hydrated initial like state. */
  initialLikeState?: { liked: boolean; count: number }
  /**
   * Comment count for jump-to-comments anchor.
   * Hidden at zero. This is a display-only number prop — WatchDetailHero
   * B1 invariant (PAGE-03): CommentThread is NOT referenced in this file.
   */
  commentCount?: number
  /**
   * Signed photo URLs fetched and signed by the RSC.
   */
  signedPhotos?: Array<{ id: string; signedUrl: string | null; sortOrder: number }>
  /**
   * Viewer's userId for client-direct photo upload.
   */
  userId?: string
  /**
   * Public wear pics fetched+signed by the RSC.
   */
  wearPics?: SignedWearPic[]
  /**
   * Owner identity for WearCommentHost social layer.
   */
  ownerUserId?: string
  /** Owner's username for WearCommentHost. */
  ownerUsername?: string
  /**
   * Viewer's CommentAuthor shape for WearCommentHost optimistic comment inserts.
   */
  viewerAuthor?: CommentAuthor | null
  /**
   * RSC-resolved comment gate for wear-pic comments.
   */
  canCommentOnWears?: boolean
  /** Owner→viewer follow direction for CommentGateLocked. */
  ownerFollowsViewerForWears?: boolean
  /** Viewer→owner follow direction for CommentGateLocked. */
  viewerIsFollowingForWears?: boolean
}

export function WatchDetailHero({
  watch,
  collection,
  lastWornDate,
  viewerCanEdit = false,
  verdict = null,
  viewerId,
  initialLikeState,
  commentCount,
  signedPhotos,
  userId,
  wearPics,
  ownerUserId,
  ownerUsername,
  viewerAuthor,
  canCommentOnWears,
  ownerFollowsViewerForWears,
  viewerIsFollowingForWears,
}: WatchDetailHeroProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'

  const handleDelete = () => {
    startTransition(async () => {
      const result = await removeWatch(watch.id)
      if (result.success) {
        router.push('/')
      }
    })
  }

  const handleMarkAsWorn = () => {
    startTransition(async () => {
      const result = await markAsWorn(watch.id)
      if (result.success) {
        router.refresh()
      }
    })
  }

  const handleFlagDealChange = (checked: boolean) => {
    startTransition(async () => {
      const result = await editWatch(watch.id, { isFlaggedDeal: checked })
      if (result.success) {
        router.refresh()
      }
    })
  }

  const safeUrl = getSafeImageUrl(watch.imageUrl)

  // D-10 empty-verdict condition: no verdict, empty collection, catalogTaste with confidence >= 0.5
  const showReferenceIdentityCard =
    !verdict &&
    collection.length === 0 &&
    watch.catalogTaste !== null &&
    watch.catalogTaste !== undefined &&
    watch.catalogTaste.confidence !== null &&
    watch.catalogTaste.confidence !== undefined &&
    watch.catalogTaste.confidence >= 0.5

  const showEmptyCaption = !verdict && !showReferenceIdentityCard

  return (
    <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      {/* Left column: WatchPhotoSection carousel or fallback image */}
      <div>
        {/* Photo section: carousel + filmstrip when signedPhotos provided.
            Falls back to single-image display for any caller that hasn't yet
            threaded signedPhotos (backward compat — optional prop). */}
        {signedPhotos !== undefined ? (
          <WatchPhotoSection
            photos={signedPhotos}
            watchId={watch.id}
            catalogFallbackUrl={getSafeImageUrl(watch.imageUrl) ?? null}
            brandModel={`${watch.brand} ${watch.model}`}
            fill
            viewerCanEdit={viewerCanEdit}
            userId={userId}
            wearPics={wearPics}
            viewerId={viewerId ?? null}
            ownerUserId={ownerUserId ?? ''}
            ownerUsername={ownerUsername ?? ''}
            viewerAuthor={viewerAuthor ?? null}
            canCommentOnWears={canCommentOnWears}
            ownerFollowsViewerForWears={ownerFollowsViewerForWears}
            viewerIsFollowingForWears={viewerIsFollowingForWears}
          />
        ) : (
          <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-lg bg-muted">
            {safeUrl ? (
              <Image
                src={safeUrl}
                alt={`${watch.brand} ${watch.model}`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <WatchIcon className="h-16 w-16 text-muted-foreground/40" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right column: title → SpecsSublabel → verdict → like+jump → owner actions */}
      <div className="space-y-6">
        {/* Title & Status */}
        <div>
          <Badge className="mb-2" variant="outline">
            {watch.status}
          </Badge>
          <h1 className="font-serif text-3xl sm:text-4xl text-foreground">
            {watch.brand}
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground">{watch.model}</p>
          {watch.reference && (
            <p className="text-sm text-muted-foreground mt-1">Ref. {watch.reference}</p>
          )}
          {/* D-03: condensed spec strip */}
          <SpecsSublabel
            movement={watch.movement ?? null}
            caseSizeMm={watch.caseSizeMm ?? null}
            dialColor={watch.dialColor ?? null}
          />
        </div>

        {/* D-09: CollectionFitCard elevated into hero */}
        {verdict && <CollectionFitCard verdict={verdict} />}

        {/* D-10: empty verdict states */}
        {showReferenceIdentityCard && (
          <ReferenceIdentityCard taste={watch.catalogTaste ?? null} />
        )}
        {showEmptyCaption && (
          <p className="text-sm text-muted-foreground">
            Add a few watches to see how this one fits your collection.
          </p>
        )}

        {/* LikeButton + D-06 jump-to-comments anchor */}
        {viewerId !== undefined && initialLikeState !== undefined && (
          <div className="flex items-center gap-2 mt-3">
            <LikeButton
              viewerId={viewerId}
              target={{ type: 'watch', id: watch.id }}
              initialLiked={initialLikeState.liked}
              initialCount={initialLikeState.count}
            />
            {/* Jump-to-comments anchor — hidden at zero (B1: no CommentThread import;
                commentCount is a plain number prop passed from the RSC) */}
            {(commentCount ?? 0) > 0 && (
              <a
                href="#comments"
                aria-label="Jump to comments"
                className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground px-2 min-h-[44px] hover:text-foreground transition-colors"
              >
                <MessageCircle className="size-5" aria-hidden />
                {commentCount}
                <span className="sr-only">comments</span>
              </a>
            )}
          </div>
        )}

        {/* Last worn line (owned/grail only, owner only — non-owners do not see owner's wear state) */}
        {viewerCanEdit && (watch.status === 'owned' || watch.status === 'grail') && (
          <div className="flex items-baseline gap-2 text-sm">
            <span className="text-muted-foreground">Last worn:</span>
            {lastWornDate ? (
              <span>
                {/* formatDate (timeZone:'UTC') — NOT a bare toLocaleDateString(),
                    which caused React #418 hydration mismatch (server UTC vs
                    browser-local calendar day) on watches with a logged wear. */}
                {formatDate(lastWornDate)}
                <span className="text-muted-foreground">
                  {' '}
                  ({daysSince(lastWornDate)} days ago)
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">Not worn yet</span>
            )}
          </div>
        )}

        {/* Flag as good deal (wishlist/grail only, owner only) */}
        {isWishlistLike && viewerCanEdit && (
          <div className="flex items-center gap-3 py-2 min-h-[44px]">
            <Checkbox
              id="flagged-deal"
              checked={watch.isFlaggedDeal === true}
              disabled={isPending}
              onCheckedChange={(checked) =>
                handleFlagDealChange(checked === true)
              }
            />
            <Label htmlFor="flagged-deal" className="cursor-pointer">
              Flag as a good deal
            </Label>
          </div>
        )}

        {/* Actions — owner only. Server Actions double-verify ownership
            (T-RDB-06), so this is a UX gate, not the authoritative check. */}
        {viewerCanEdit && (
          <div className="flex flex-wrap gap-2">
            {watch.status === 'owned' && (
              <Button
                variant="outline"
                onClick={handleMarkAsWorn}
                disabled={isPending}
              >
                Mark as Worn
              </Button>
            )}
            <Link href={`/w/${watch.id}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogTrigger render={<Button variant="destructive" />}>
                Delete
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Watch</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete {watch.brand} {watch.model}?
                    This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteDialogOpen(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  )
}

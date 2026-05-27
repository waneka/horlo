'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon, Heart, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getSafeImageUrl } from '@/lib/images'
import { daysSince, SLEEPING_BEAUTY_DAYS } from '@/lib/wear'
import { toggleLikeAction } from '@/app/actions/reactions'
import { WatchCommentSheet } from '@/components/watch/WatchCommentSheet'
import type { Watch } from '@/lib/types'

interface ProfileWatchCardProps {
  watch: Watch
  lastWornDate: string | null // YYYY-MM-DD or null
  showWishlistMeta?: boolean // when true, show targetPrice + notes preview (Wishlist tab)
  likeCount?: number // from batched query (DISP-01); hidden at zero
  commentCount?: number // 0 for gated viewers (D-10 enforcement is in the query)
  isOwner?: boolean // D-03: when true, show static count line; no overlay chips
  viewerId?: string | null // D-04: seeded liked state; anon-bounce on chip click
  liked?: boolean // D-11: initial liked state from getBatchedWatchCounts
  canComment?: boolean // D-09/D-11: gate flag; false hides 💬 chip
}

export function ProfileWatchCard({
  watch,
  lastWornDate,
  showWishlistMeta = false,
  likeCount,
  commentCount,
  isOwner,
  viewerId,
  liked,
  canComment,
}: ProfileWatchCardProps) {
  const safeUrl = getSafeImageUrl(watch.imageUrl)
  const days = daysSince(lastWornDate ?? undefined)
  const isWornToday = days === 0
  const isStale = days !== null && days >= SLEEPING_BEAUTY_DAYS

  const lastWornLabel =
    days === null
      ? 'Never worn'
      : days === 0
        ? 'Worn today'
        : days === 1
          ? 'Worn yesterday'
          : `Worn ${days}d ago`

  // First role tag (preferred) or style tag for the small pill (UI-SPEC: single tag pill).
  const tag = watch.roleTags?.[0] ?? watch.styleTags?.[0]

  // Phase 27 (VIS-08, D-15..D-21) — status-driven price line.
  // Replaces the legacy wishlist-only `Target: $X` block (was at lines 85-89).
  // Single rendering path for all card variants:
  //   - owned/sold (paid bucket) → "Paid: $X" if pricePaid, else "Market: $X" if marketPrice, else hide
  //   - wishlist/grail (target bucket) → "Target: $X" if targetPrice, else "Market: $X" if marketPrice, else hide
  // marketPrice is ONLY surfaced as a fallback (D-20) — v6.0 Market Value owns
  // first-class market display.
  const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'
  const primary = isWishlistLike ? watch.targetPrice : watch.pricePaid
  const primaryLabel = isWishlistLike ? 'Target' : 'Paid'
  const priceLine =
    primary != null
      ? `${primaryLabel}: $${primary.toLocaleString()}`
      : watch.marketPrice != null
        ? `Market: $${watch.marketPrice.toLocaleString()}`
        : null

  // Non-owner engagement state — seeded from RSC-resolved props (D-11).
  // Mirrors LikeButton optimistic pattern: useState + useTransition, no useOptimistic.
  // Cache-tag bust (viewer:{userId}:counts) handles re-hydration on navigate-back (D-12).
  const [likedState, setLikedState] = useState(liked ?? false)
  const [likeCountState, setLikeCountState] = useState(likeCount ?? 0)
  const [likePending, startLikeTransition] = useTransition()
  const [commentCountState, setCommentCountState] = useState(commentCount ?? 0)
  const [sheetOpen, setSheetOpen] = useState(false)

  function handleLikeClick(e: React.MouseEvent) {
    e.preventDefault() // D-02: stop <Link> navigation
    e.stopPropagation()
    const nextLiked = !likedState
    const nextCount = nextLiked ? likeCountState + 1 : likeCountState - 1
    setLikedState(nextLiked)
    setLikeCountState(nextCount)
    startLikeTransition(async () => {
      const result = await toggleLikeAction({ type: 'watch', id: watch.id })
      if (!result.success) {
        // Silent rollback — no toast (D-05, idempotent re-like must not error)
        setLikedState(likedState)
        setLikeCountState(likeCountState)
        console.error('[ProfileWatchCard] like failed:', result.error)
        return
      }
      // Reconcile to server-confirmed values (mirrors LikeButton D-05)
      setLikedState(result.data.liked)
      setLikeCountState(result.data.count)
    })
  }

  function handleCommentClick(e: React.MouseEvent) {
    e.preventDefault() // D-02: stop <Link> navigation
    e.stopPropagation()
    setSheetOpen(true)
  }

  function handleCommentSuccess() {
    setCommentCountState((n) => n + 1) // optimistic count bump (D-07)
    setSheetOpen(false)
    toast('Comment posted') // D-07
  }

  return (
    <Link href={`/w/${watch.id}`}>
      {/* h-full flex flex-col on Card — NOT height:auto — is the equal-height key */}
      <Card className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-lg h-full flex flex-col">
        {/* Brand + model ABOVE image (D-04) */}
        <div className="px-3 pt-2 pb-1">
          <p className="text-sm font-normal text-muted-foreground truncate">{watch.brand}</p>
          <p className="text-base font-semibold leading-tight truncate">{watch.model}</p>
        </div>
        {/* Image area — aspect-square on THIS div, not on Card (PLSH-04 pitfall) */}
        <div className="relative aspect-square bg-muted">
          {safeUrl ? (
            <Image
              src={safeUrl}
              alt={`${watch.brand} ${watch.model}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <WatchIcon className="size-10 text-muted-foreground/40" />
            </div>
          )}
          {/* Wear badge — OWNED watches only (D-12, PLSH-03) */}
          {!isWishlistLike && (isWornToday || isStale) && (
            <span
              className={cn(
                'absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-normal',
                isWornToday
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-background text-foreground shadow ring-1 ring-border',
              )}
            >
              {isWornToday ? 'Worn today' : 'Not worn recently'}
            </span>
          )}
          {/* Non-owner engagement chips — D-03: gated on !isOwner; D-01: bottom-2 left-2 */}
          {!isOwner && (
            <>
              {/* Scrim: full-width bottom strip behind chips; pointer-events-none so
                  image taps pass through and the wrapping <Link> still navigates (D-02) */}
              <div className="absolute inset-x-0 bottom-0 h-12 bg-black/55 pointer-events-none" />
              {/* Chip row — z-10 so chips are above scrim and receive pointer events */}
              <div className="absolute bottom-2 left-2 z-10 flex gap-2">
                {/* ♥ Like chip — always visible for non-owner (D-04); optimistic flip (LikeButton pattern) */}
                <button
                  type="button"
                  aria-pressed={likedState}
                  aria-busy={likePending}
                  aria-label={likedState ? 'Unlike' : 'Like'}
                  disabled={likePending}
                  onClick={handleLikeClick}
                  className={cn(
                    'rounded-full bg-black/30 px-2 py-1 flex items-center gap-1',
                    'text-white text-xs tabular-nums min-h-[44px] min-w-[44px]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    likePending && 'opacity-50 cursor-wait',
                  )}
                >
                  <Heart
                    className={cn('size-4', likedState ? 'text-destructive' : 'text-white/90')}
                    fill={likedState ? 'currentColor' : 'none'}
                  />
                  {(likedState || likeCountState > 0) && (
                    <span>{likeCountState}</span>
                  )}
                </button>
                {/* 💬 Comment chip — only when canComment (D-09 gate; hidden for gated foreign-wishlist viewers) */}
                {canComment && (
                  <button
                    type="button"
                    aria-label="Add a comment"
                    onClick={handleCommentClick}
                    className="rounded-full bg-black/30 px-2 py-1 flex items-center gap-1 text-white text-xs tabular-nums min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MessageCircle className="size-4 text-white/90" />
                    {commentCountState > 0 && <span>{commentCountState}</span>}
                  </button>
                )}
              </div>
              {/* Compose-only bottom sheet (D-06/GRID-04) — opened by 💬 chip click */}
              <WatchCommentSheet
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                watch={watch}
                viewerId={viewerId ?? null}
                onSuccess={handleCommentSuccess}
              />
            </>
          )}
        </div>
        {/* Text block — flex-1 absorbs height; content top-aligned (equal-height mechanism) */}
        <CardContent className="px-3 py-2 flex flex-col gap-1 flex-1">
          {tag && (
            <Badge variant="secondary" className="rounded-full text-xs font-normal self-start">
              {tag}
            </Badge>
          )}
          {/* Wear line — OWNED watches only (D-12, PLSH-03) */}
          {!isWishlistLike && (
            <p className="text-xs text-muted-foreground">{lastWornLabel}</p>
          )}
          {priceLine && (
            <p className="text-xs font-normal text-foreground">{priceLine}</p>
          )}
          {showWishlistMeta && watch.notes && (
            <p className="line-clamp-2 text-xs text-muted-foreground">Notes: {watch.notes}</p>
          )}
          {/* D-09 / DISP-01: like + comment count line. Whole line removed when both zero.
              WR-01: driven from the SAME optimistic state the non-owner chips use
              (likeCountState/commentCountState) — NOT the raw likeCount/commentCount
              props — so a non-owner who likes/comments never sees this static line
              disagree with the overlay chip. Owners are seeded from the same props,
              so the owner path (D-03) is unchanged. */}
          {(likeCountState > 0 || commentCountState > 0) && (
            <p className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
              {likeCountState > 0 && (
                <>
                  <Heart className="size-3" aria-hidden />
                  {likeCountState}
                </>
              )}
              {likeCountState > 0 && commentCountState > 0 && (
                <span className="mx-1">·</span>
              )}
              {commentCountState > 0 && (
                <>
                  <MessageCircle className="size-3" aria-hidden />
                  {commentCountState}
                </>
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

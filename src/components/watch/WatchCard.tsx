'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon, Sparkles, Tag } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getSafeImageUrl } from '@/lib/images'
import { computeGapFill } from '@/lib/gapFill'
import type { Watch, UserPreferences } from '@/lib/types'

interface WatchCardProps {
  watch: Watch
  collection: Watch[]
  preferences: UserPreferences
}

export function WatchCard({ watch, collection, preferences }: WatchCardProps) {
  const safeUrl = getSafeImageUrl(watch.imageUrl)

  const isOwned = watch.status === 'owned'
  const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'
  const gapFill = isWishlistLike
    ? computeGapFill(watch, collection, preferences)
    : null

  const autoDeal =
    watch.marketPrice != null &&
    watch.targetPrice != null &&
    watch.marketPrice <= watch.targetPrice
  const isDeal = isWishlistLike && (watch.isFlaggedDeal === true || autoDeal)

  return (
    <Link href={`/watch/${watch.id}`}>
      <Card className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-lg">
        <div className="relative aspect-[4/5] bg-muted">
          {safeUrl ? (
            <Image
              src={safeUrl}
              alt={`${watch.brand} ${watch.model}`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <WatchIcon className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            <Badge variant="outline">{watch.status}</Badge>
            {isDeal && (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" aria-hidden />
                Deal
              </Badge>
            )}
            {gapFill && (
              <Badge
                variant="outline"
                className="gap-1"
                aria-label={`Gap-fill ${gapFill.kind}`}
              >
                <Tag className="h-3 w-3" aria-hidden />
                {gapFill.kind === 'numeric' && `Gap ${gapFill.score}`}
                {gapFill.kind === 'first-watch' && 'First watch'}
                {gapFill.kind === 'outside-specialty' && 'Outside specialty'}
                {gapFill.kind === 'off-brand' && 'Off-brand'}
                {gapFill.kind === 'breaks-theme' && 'Breaks theme'}
              </Badge>
            )}
          </div>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-card-foreground group-hover:text-accent">
            {watch.brand}
          </h3>
          <p className="text-sm text-muted-foreground">{watch.model}</p>
          <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
            {watch.caseSizeMm && <span>{watch.caseSizeMm}mm</span>}
            {watch.caseSizeMm && watch.movement && <span>·</span>}
            {watch.movement && (
              <span className="capitalize">{watch.movement}</span>
            )}
            {watch.waterResistanceM && (
              <>
                <span>·</span>
                <span>{watch.waterResistanceM}m</span>
              </>
            )}
          </div>
          {watch.styleTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {watch.styleTags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {watch.styleTags.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{watch.styleTags.length - 2}
                </Badge>
              )}
            </div>
          )}
          {!isOwned && watch.marketPrice != null && (
            <p className="mt-2 text-sm font-semibold text-card-foreground">
              ${watch.marketPrice.toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

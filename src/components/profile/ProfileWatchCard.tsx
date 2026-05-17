'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getSafeImageUrl } from '@/lib/images'
import { daysSince, SLEEPING_BEAUTY_DAYS } from '@/lib/wear'
import type { Watch } from '@/lib/types'

interface ProfileWatchCardProps {
  watch: Watch
  lastWornDate: string | null // YYYY-MM-DD or null
  showWishlistMeta?: boolean // when true, show targetPrice + notes preview (Wishlist tab)
}

export function ProfileWatchCard({
  watch,
  lastWornDate,
  showWishlistMeta = false,
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

  return (
    <Link href={`/watch/${watch.id}`}>
      {/* h-full flex flex-col on Card — NOT height:auto — is the equal-height key */}
      <Card className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-lg h-full flex flex-col">
        {/* Brand + model ABOVE image (D-04) */}
        <div className="px-3 pt-2 pb-1">
          <p className="text-sm font-normal text-muted-foreground truncate">{watch.brand}</p>
          <p className="text-base font-semibold leading-tight truncate">{watch.model}</p>
        </div>
        {/* Image area — aspect-[3/4] on THIS div, not on Card (PLSH-04 pitfall) */}
        <div className="relative aspect-[3/4] bg-muted">
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
        </CardContent>
      </Card>
    </Link>
  )
}

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
              <WatchIcon className="size-10 text-muted-foreground/40" />
            </div>
          )}
          {(isWornToday || isStale) && (
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
        <CardContent className="p-4">
          <p className="text-sm font-normal text-muted-foreground">
            {watch.brand}
          </p>
          <p className="text-base font-semibold leading-tight">{watch.model}</p>
          {tag && (
            <Badge
              variant="secondary"
              className="mt-2 rounded-full text-xs font-normal"
            >
              {tag}
            </Badge>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{lastWornLabel}</p>
          {showWishlistMeta && watch.targetPrice != null && (
            <p className="mt-1 text-xs text-foreground">
              Target: ${watch.targetPrice.toLocaleString()}
            </p>
          )}
          {showWishlistMeta && watch.notes && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              Notes: {watch.notes}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

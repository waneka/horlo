'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'
import type { Watch } from '@/lib/types'

export interface GoodDealsSectionProps {
  watches: Watch[]
}

function isDeal(w: Watch): boolean {
  const isWishlistLike = w.status === 'wishlist' || w.status === 'grail'
  if (!isWishlistLike) return false
  const autoDeal =
    w.marketPrice != null &&
    w.targetPrice != null &&
    w.marketPrice <= w.targetPrice
  return w.isFlaggedDeal === true || autoDeal
}

export function GoodDealsSection({ watches }: GoodDealsSectionProps) {
  const deals = watches.filter(isDeal)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" aria-hidden />
          Good Deals
        </CardTitle>
        <CardDescription>
          Wishlist items you&apos;ve flagged or that hit your target price.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No flagged deals right now. Flag one from the watch detail view or set a target price
            that&apos;s at or above market.
          </p>
        ) : (
          <ul className="space-y-3">
            {deals.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/watch/${w.id}`}
                  className="flex items-center gap-3 rounded-md p-2 hover:bg-accent"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-semibold">
                      {w.brand} {w.model}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {w.targetPrice != null && `Target $${w.targetPrice.toLocaleString()}`}
                      {w.targetPrice != null && w.marketPrice != null && ' · '}
                      {w.marketPrice != null && `Market $${w.marketPrice.toLocaleString()}`}
                    </div>
                  </div>
                  <Badge variant="secondary">Deal</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

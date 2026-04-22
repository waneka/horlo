import Link from 'next/link'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WishlistGap } from '@/lib/discoveryTypes'

/**
 * WishlistGapCard — Personal Insights "Tip" card (I-01 / I-03).
 *
 * Consumes a pre-computed WishlistGap from `wishlistGap()` in
 * `src/lib/wishlistGap.ts`. Renders null when the gap has no role (nothing
 * to surface). Click target (I-03: Claude's discretion) is the viewer's
 * wishlist filtered by the identified role — the actual route is wired in
 * Plan 10-08 when the home page imports this card.
 *
 * Accent badge (`bg-accent text-accent-foreground`) per UI-SPEC §Accent
 * reserved for (item 4).
 */
export function WishlistGapCard({ gap }: { gap: WishlistGap }) {
  if (!gap.role || !gap.rationale) return null

  return (
    <Link
      href={`/u/me/wishlist?filter=${gap.role}`}
      aria-label={`Wishlist gap: ${gap.role}`}
      className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="transition hover:shadow-md">
        <CardContent className="space-y-3">
          <Badge
            className="bg-accent text-accent-foreground"
            aria-label="Tip"
          >
            Tip
          </Badge>
          <p className="text-sm font-semibold capitalize">
            Wishlist gap: {gap.role}
          </p>
          <p className="text-sm text-muted-foreground">{gap.rationale}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

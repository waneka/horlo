// Pure RSC — no client directive, no hooks, no event handlers.
// formatDate and computeGapFill are pure functions; safe to call in RSC.
// computeGapFill: gapFill.ts imports only types + detectLoyalBrands from similarity,
// which imports only types — VERIFIED RSC-safe 2026-05-27.

import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MOVEMENT_LABELS } from '@/lib/constants'
import { computeGapFill } from '@/lib/gapFill'
import { daysSince } from '@/lib/wear'
import type { Watch, UserPreferences } from '@/lib/types'

// Local pure helper — copied verbatim from WatchDetail.tsx:106-119.
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

function formatCurrency(amount?: number): string {
  if (amount === undefined) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount)
}

interface WatchDetailTrailingProps {
  watch: Watch
  collection: Watch[]
  preferences: UserPreferences
  lastWornDate?: string | null
}

export function WatchDetailTrailing({
  watch,
  collection,
  preferences,
  lastWornDate,
}: WatchDetailTrailingProps) {
  const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'
  const gapFill = isWishlistLike ? computeGapFill(watch, collection, preferences) : null
  const daysSinceWorn = daysSince(lastWornDate ?? undefined)

  return (
    <div className="space-y-6">
      {/* Specifications */}
      <Card>
        <CardHeader>
          <CardTitle>Specifications</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Movement</dt>
              <dd className="font-semibold">{watch.movement ? MOVEMENT_LABELS[watch.movement] : null}</dd>
            </div>
            {watch.caseSizeMm && (
              <div>
                <dt className="text-muted-foreground">Case Size</dt>
                <dd className="font-semibold">{watch.caseSizeMm}mm</dd>
              </div>
            )}
            {watch.lugToLugMm && (
              <div>
                <dt className="text-muted-foreground">Lug-to-Lug</dt>
                <dd className="font-semibold">{watch.lugToLugMm}mm</dd>
              </div>
            )}
            {watch.waterResistanceM && (
              <div>
                <dt className="text-muted-foreground">Water Resistance</dt>
                <dd className="font-semibold">{watch.waterResistanceM}m</dd>
              </div>
            )}
            {watch.strapType && (
              <div>
                <dt className="text-muted-foreground">Strap</dt>
                <dd className="font-semibold capitalize">{watch.strapType}</dd>
              </div>
            )}
            {watch.crystalType && (
              <div>
                <dt className="text-muted-foreground">Crystal</dt>
                <dd className="font-semibold capitalize">{watch.crystalType}</dd>
              </div>
            )}
            {watch.dialColor && (
              <div>
                <dt className="text-muted-foreground">Dial Color</dt>
                <dd className="font-semibold capitalize">{watch.dialColor}</dd>
              </div>
            )}
            {watch.productionYear !== undefined && (
              <div>
                <dt className="text-muted-foreground">Production year</dt>
                <dd className="font-semibold">{watch.productionYear}</dd>
              </div>
            )}
            {/* Phase 23 FEAT-08 — Chronometer certification (D-11).
                Strict-equal `=== true` is deliberate: the column is boolean | null;
                legacy rows may surface as null and must NOT render this row. */}
            {watch.isChronometer === true && (
              <div>
                <dt className="text-muted-foreground">Certification</dt>
                <dd className="font-semibold flex items-center gap-1">
                  <Check className="size-4 text-foreground" aria-hidden />
                  <span>Chronometer</span>
                </dd>
              </div>
            )}
          </dl>
          {watch.complications.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <dt className="text-muted-foreground text-sm mb-2">Complications</dt>
              <div className="flex flex-wrap gap-1">
                {watch.complications.map((comp) => (
                  <Badge key={comp} variant="secondary" className="capitalize">
                    {comp}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Price Paid</dt>
              <dd className="font-semibold">{formatCurrency(watch.pricePaid)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Target Price</dt>
              <dd className="font-semibold">
                {formatCurrency(watch.targetPrice)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Market Price</dt>
              <dd className="font-semibold">
                {formatCurrency(watch.marketPrice)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Tags / Classification */}
      <Card>
        <CardHeader>
          <CardTitle>Classification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <dt className="text-muted-foreground text-sm mb-2">Style</dt>
            <div className="flex flex-wrap gap-1">
              {watch.styleTags.map((tag) => (
                <Badge key={tag} variant="outline" className="capitalize">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          {watch.designTraits.length > 0 && (
            <div>
              <dt className="text-muted-foreground text-sm mb-2">Design Traits</dt>
              <div className="flex flex-wrap gap-1">
                {watch.designTraits.map((trait) => (
                  <Badge key={trait} variant="outline" className="capitalize">
                    {trait}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground text-sm mb-2">Role</dt>
            <div className="flex flex-wrap gap-1">
              {watch.roleTags.map((tag) => (
                <Badge key={tag} variant="outline" className="capitalize">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wear Tracking */}
      <Card>
        <CardHeader>
          <CardTitle>Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Acquired</dt>
              <dd className="font-semibold">
                {formatDate(watch.acquisitionDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last Worn</dt>
              <dd className="font-semibold">
                {formatDate(lastWornDate ?? undefined)}
                {daysSinceWorn !== null && daysSinceWorn > 0 && (
                  <span className="text-muted-foreground/70 ml-1">
                    ({daysSinceWorn} days ago)
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Gap-fill callout (wishlist/grail only) */}
      {gapFill && (
        <Card>
          <CardHeader>
            <CardTitle>Gap-fill</CardTitle>
            <CardDescription>
              {gapFill.kind === 'numeric' &&
                `Fills ${gapFill.newTuples.length} new combo${gapFill.newTuples.length === 1 ? '' : 's'} in your ${gapFill.goalUsed} universe (score ${gapFill.score})`}
              {gapFill.kind === 'first-watch' &&
                'First watch in your collection — no comparison yet.'}
              {gapFill.kind === 'outside-specialty' &&
                'Outside your current specialty.'}
              {gapFill.kind === 'off-brand' &&
                'Off-brand — breaks your loyal-brand pattern.'}
              {gapFill.kind === 'breaks-theme' &&
                'Breaks the dominant theme of your collection.'}
            </CardDescription>
          </CardHeader>
          {gapFill.kind === 'numeric' && gapFill.newTuples.length > 0 && (
            <CardContent>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {gapFill.newTuples.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      {/* Notes */}
      {watch.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {watch.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

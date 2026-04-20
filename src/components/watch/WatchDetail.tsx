'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { editWatch, removeWatch } from '@/app/actions/watches'
import { markAsWorn } from '@/app/actions/wearEvents'
import { SimilarityBadge } from '@/components/insights/SimilarityBadge'
import { computeGapFill } from '@/lib/gapFill'
import { daysSince } from '@/lib/wear'
import type { Watch, UserPreferences } from '@/lib/types'

interface WatchDetailProps {
  watch: Watch
  collection: Watch[]
  preferences: UserPreferences
  lastWornDate?: string | null  // sourced from wear_events by server page
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
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

export function WatchDetail({ watch, collection, preferences, lastWornDate }: WatchDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'
  const gapFill = isWishlistLike
    ? computeGapFill(watch, collection, preferences)
    : null

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
        // Inline mutation (no navigation) — explicit refresh re-fetches Server Component data.
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

  const daysSinceWorn = daysSince(lastWornDate ?? undefined)
  const safeUrl = getSafeImageUrl(watch.imageUrl)

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        {/* Left column: image + title + actions */}
        <div className="space-y-6">
          {/* Image */}
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
          </div>

          {/* Last worn line (owned/grail only) */}
          {(watch.status === 'owned' || watch.status === 'grail') && (
            <div className="flex items-baseline gap-2 text-sm">
              <span className="text-muted-foreground">Last worn:</span>
              {lastWornDate ? (
                <span>
                  {new Date(lastWornDate).toLocaleDateString()}
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

          {/* Flag as good deal (wishlist/grail only) */}
          {isWishlistLike && (
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

          {/* Actions */}
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
            <Link href={`/watch/${watch.id}/edit`}>
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
        </div>

        {/* Right column: spec cards */}
        <div className="grid gap-6">
        {/* Specifications */}
        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Movement</dt>
                <dd className="font-semibold capitalize">{watch.movement}</dd>
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

        {/* Tags */}
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
        </div>
      </div>

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

      {/* Collection Fit Analysis */}
      <SimilarityBadge
        watch={watch}
        collection={collection}
        preferences={preferences}
      />

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

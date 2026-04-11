'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useWatchStore } from '@/store/watchStore'
import { SimilarityBadge } from '@/components/insights/SimilarityBadge'
import type { Watch } from '@/lib/types'

interface WatchDetailProps {
  watch: Watch
}

const statusColors: Record<Watch['status'], string> = {
  owned: 'bg-green-100 text-green-800',
  wishlist: 'bg-blue-100 text-blue-800',
  sold: 'bg-gray-100 text-gray-800',
  grail: 'bg-purple-100 text-purple-800',
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

function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const today = new Date()
  const diffTime = today.getTime() - date.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

function formatCurrency(amount?: number): string {
  if (amount === undefined) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function WatchDetail({ watch }: WatchDetailProps) {
  const router = useRouter()
  const { deleteWatch, markAsWorn } = useWatchStore()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleDelete = () => {
    deleteWatch(watch.id)
    router.push('/')
  }

  const handleMarkAsWorn = () => {
    markAsWorn(watch.id)
  }

  const daysSinceWorn = daysSince(watch.lastWornDate)
  const safeUrl = getSafeImageUrl(watch.imageUrl)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-6">
          {/* Image */}
          <div className="relative aspect-square w-32 sm:w-48 shrink-0 overflow-hidden rounded-lg bg-muted">
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
            <Badge className={`mb-2 ${statusColors[watch.status]}`}>
              {watch.status}
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {watch.brand}
            </h1>
            <p className="text-lg sm:text-xl text-gray-600">{watch.model}</p>
            {watch.reference && (
              <p className="text-sm text-gray-500 mt-1">Ref. {watch.reference}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {watch.status === 'owned' && (
            <Button variant="outline" onClick={handleMarkAsWorn}>
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
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Specifications */}
        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Movement</dt>
                <dd className="font-medium capitalize">{watch.movement}</dd>
              </div>
              {watch.caseSizeMm && (
                <div>
                  <dt className="text-gray-500">Case Size</dt>
                  <dd className="font-medium">{watch.caseSizeMm}mm</dd>
                </div>
              )}
              {watch.lugToLugMm && (
                <div>
                  <dt className="text-gray-500">Lug-to-Lug</dt>
                  <dd className="font-medium">{watch.lugToLugMm}mm</dd>
                </div>
              )}
              {watch.waterResistanceM && (
                <div>
                  <dt className="text-gray-500">Water Resistance</dt>
                  <dd className="font-medium">{watch.waterResistanceM}m</dd>
                </div>
              )}
              {watch.strapType && (
                <div>
                  <dt className="text-gray-500">Strap</dt>
                  <dd className="font-medium capitalize">{watch.strapType}</dd>
                </div>
              )}
              {watch.crystalType && (
                <div>
                  <dt className="text-gray-500">Crystal</dt>
                  <dd className="font-medium capitalize">{watch.crystalType}</dd>
                </div>
              )}
              {watch.dialColor && (
                <div>
                  <dt className="text-gray-500">Dial Color</dt>
                  <dd className="font-medium capitalize">{watch.dialColor}</dd>
                </div>
              )}
            </dl>
            {watch.complications.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <dt className="text-gray-500 text-sm mb-2">Complications</dt>
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
                <dt className="text-gray-500">Price Paid</dt>
                <dd className="font-medium">{formatCurrency(watch.pricePaid)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Target Price</dt>
                <dd className="font-medium">
                  {formatCurrency(watch.targetPrice)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Market Price</dt>
                <dd className="font-medium">
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
              <dt className="text-gray-500 text-sm mb-2">Style</dt>
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
                <dt className="text-gray-500 text-sm mb-2">Design Traits</dt>
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
              <dt className="text-gray-500 text-sm mb-2">Role</dt>
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
                <dt className="text-gray-500">Acquired</dt>
                <dd className="font-medium">
                  {formatDate(watch.acquisitionDate)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Last Worn</dt>
                <dd className="font-medium">
                  {formatDate(watch.lastWornDate)}
                  {daysSinceWorn !== null && daysSinceWorn > 0 && (
                    <span className="text-gray-400 ml-1">
                      ({daysSinceWorn} days ago)
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Collection Fit Analysis */}
      <SimilarityBadge watch={watch} />

      {/* Notes */}
      {watch.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {watch.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getSafeImageUrl } from '@/lib/images'
import type { Watch } from '@/lib/types'

interface WatchCardProps {
  watch: Watch
}

export function WatchCard({ watch }: WatchCardProps) {
  const safeUrl = getSafeImageUrl(watch.imageUrl)

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
          <Badge className="absolute top-2 right-2" variant="secondary">
            {watch.status}
          </Badge>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
            {watch.brand}
          </h3>
          <p className="text-sm text-gray-600">{watch.model}</p>
          <div className="mt-2 flex flex-wrap gap-1 text-xs text-gray-500">
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
        </CardContent>
      </Card>
    </Link>
  )
}

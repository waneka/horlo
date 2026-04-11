'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Watch } from '@/lib/types'

interface WatchCardProps {
  watch: Watch
}

const statusColors: Record<Watch['status'], string> = {
  owned: 'bg-green-100 text-green-800',
  wishlist: 'bg-blue-100 text-blue-800',
  sold: 'bg-gray-100 text-gray-800',
  grail: 'bg-purple-100 text-purple-800',
}

export function WatchCard({ watch }: WatchCardProps) {
  return (
    <Link href={`/watch/${watch.id}`}>
      <Card className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-lg">
        <div className="relative aspect-square bg-gray-100">
          {watch.imageUrl ? (
            <img
              src={watch.imageUrl}
              alt={`${watch.brand} ${watch.model}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              <svg
                className="h-16 w-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          )}
          <Badge
            className={`absolute top-2 right-2 ${statusColors[watch.status]}`}
            variant="secondary"
          >
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

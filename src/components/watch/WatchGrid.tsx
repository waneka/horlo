'use client'

import { Watch as WatchIcon } from 'lucide-react'
import { WatchCard } from './WatchCard'
import type { Watch } from '@/lib/types'

interface WatchGridProps {
  watches: Watch[]
}

export function WatchGrid({ watches }: WatchGridProps) {
  if (watches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <WatchIcon className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="mt-6 font-serif text-3xl text-foreground">
          Your collection is empty.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Add your first watch to begin tracking what you own and what you want.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-8">
      {watches.map((watch) => (
        <WatchCard key={watch.id} watch={watch} />
      ))}
    </div>
  )
}

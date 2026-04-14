'use client'

import { useMemo } from 'react'
import { useWatchStore } from '@/store/watchStore'
import { filterWatches } from '@/lib/filtering'
import { FilterBar } from '@/components/filters/FilterBar'
import { StatusToggle } from '@/components/filters/StatusToggle'
import { WatchGrid } from '@/components/watch/WatchGrid'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { SlidersHorizontal } from 'lucide-react'
import type { Watch, UserPreferences } from '@/lib/types'

interface CollectionViewProps {
  watches: Watch[]
  preferences: UserPreferences
}

export function CollectionView({ watches, preferences }: CollectionViewProps) {
  const filters = useWatchStore((s) => s.filters)

  const filteredWatches = useMemo(
    () => filterWatches(watches, filters),
    [watches, filters]
  )

  // Dynamic price cap from the full (unfiltered) collection so the slider
  // always reflects the user's actual price range regardless of active filters.
  const maxPrice = useMemo(
    () =>
      watches.reduce(
        (acc, w) => (w.marketPrice != null && w.marketPrice > acc ? w.marketPrice : acc),
        0
      ),
    [watches]
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Desktop sidebar filters (lg and up) */}
        <aside className="hidden lg:block lg:w-64 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Filters</h2>
              <FilterBar maxPrice={maxPrice} />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="font-serif text-3xl md:text-4xl text-foreground">Collection</h1>
                <p className="text-sm text-muted-foreground">
                  {filteredWatches.length} of {watches.length} watches
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Mobile filter drawer trigger (<lg) */}
                <Sheet>
                  <SheetTrigger
                    render={
                      <Button variant="outline" className="lg:hidden" />
                    }
                  >
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Filters
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Filters</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 px-4">
                      <FilterBar maxPrice={maxPrice} />
                    </div>
                  </SheetContent>
                </Sheet>
                <StatusToggle />
              </div>
            </div>

            {/* Grid */}
            <WatchGrid
              watches={filteredWatches}
              collection={watches}
              preferences={preferences}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

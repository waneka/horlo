'use client'

import { useWatchStore } from '@/store/watchStore'
import { WatchGrid } from '@/components/watch/WatchGrid'
import { StatusToggle } from '@/components/filters/StatusToggle'
import { FilterBar } from '@/components/filters/FilterBar'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { SlidersHorizontal } from 'lucide-react'

export default function Home() {
  const { getFilteredWatches, watches } = useWatchStore()
  const filteredWatches = getFilteredWatches()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Desktop sidebar filters (lg and up) */}
        <aside className="hidden lg:block lg:w-64 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Filters</h2>
              <FilterBar />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Collection</h1>
                <p className="text-sm text-gray-500">
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
                      <FilterBar />
                    </div>
                  </SheetContent>
                </Sheet>
                <StatusToggle />
              </div>
            </div>

            {/* Grid */}
            <WatchGrid watches={filteredWatches} />
          </div>
        </div>
      </div>
    </div>
  )
}

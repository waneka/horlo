'use client'

import { useWatchStore } from '@/store/watchStore'
import { WatchGrid } from '@/components/watch/WatchGrid'
import { StatusToggle } from '@/components/filters/StatusToggle'
import { FilterBar } from '@/components/filters/FilterBar'

export default function Home() {
  const { getFilteredWatches, watches } = useWatchStore()
  const filteredWatches = getFilteredWatches()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Filters</h2>
              <FilterBar />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Collection</h1>
                <p className="text-sm text-gray-500">
                  {filteredWatches.length} of {watches.length} watches
                </p>
              </div>
              <StatusToggle />
            </div>

            {/* Grid */}
            <WatchGrid watches={filteredWatches} />
          </div>
        </div>
      </div>
    </div>
  )
}

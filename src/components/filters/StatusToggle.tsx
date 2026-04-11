'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWatchStore } from '@/store/watchStore'
import type { WatchStatus } from '@/lib/types'

type StatusFilter = 'all' | WatchStatus

const statuses: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'owned', label: 'Owned' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'grail', label: 'Grail' },
  { value: 'sold', label: 'Sold' },
]

export function StatusToggle() {
  const { filters, setFilter } = useWatchStore()

  return (
    <Tabs
      value={filters.status}
      onValueChange={(value) => setFilter('status', value as StatusFilter)}
    >
      <TabsList>
        {statuses.map((status) => (
          <TabsTrigger key={status.value} value={status.value}>
            {status.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

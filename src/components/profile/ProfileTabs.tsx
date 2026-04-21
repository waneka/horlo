'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TABS = [
  { id: 'collection', label: 'Collection' },
  { id: 'wishlist', label: 'Wishlist' },
  { id: 'worn', label: 'Worn' },
  { id: 'notes', label: 'Notes' },
  { id: 'stats', label: 'Stats' },
] as const

export function ProfileTabs({ username }: { username: string }) {
  const pathname = usePathname() ?? ''
  // Active tab = trailing segment after /u/{username}/
  const activeTab =
    TABS.find((t) => pathname.endsWith(`/${t.id}`))?.id ?? 'collection'

  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList
        variant="line"
        className="w-full justify-start gap-2 overflow-x-auto"
      >
        {TABS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            nativeButton={false}
            render={<Link href={`/u/${username}/${tab.id}`} />}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

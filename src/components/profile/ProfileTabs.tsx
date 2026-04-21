'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const BASE_TABS = [
  { id: 'collection', label: 'Collection' },
  { id: 'wishlist', label: 'Wishlist' },
  { id: 'worn', label: 'Worn' },
  { id: 'notes', label: 'Notes' },
  { id: 'stats', label: 'Stats' },
] as const

const COMMON_GROUND_TAB = {
  id: 'common-ground',
  label: 'Common Ground',
} as const

interface ProfileTabsProps {
  username: string
  /**
   * When true, append a 6th "Common Ground" tab. Set by the layout when the
   * three-way gate (viewer && !isOwner && collectionPublic) passes AND the
   * computed overlap has any content (overlap.hasAny === true).
   * See src/app/u/[username]/common-ground-gate.ts.
   */
  showCommonGround?: boolean
}

export function ProfileTabs({
  username,
  showCommonGround = false,
}: ProfileTabsProps) {
  const pathname = usePathname() ?? ''
  const tabs = showCommonGround
    ? [...BASE_TABS, COMMON_GROUND_TAB]
    : [...BASE_TABS]
  // Active tab = trailing segment after /u/{username}/
  const activeTab =
    tabs.find((t) => pathname.endsWith(`/${t.id}`))?.id ?? 'collection'

  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList
        variant="line"
        className="w-full justify-start gap-2 overflow-x-auto"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            nativeButton={false}
            data-tab-id={tab.id}
            render={<Link href={`/u/${username}/${tab.id}`} />}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

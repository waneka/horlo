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

// D-13: Insights tab is OWNER-ONLY. Non-owners never see this link — the
// tab is omitted entirely from the tab strip (existence-leak defense,
// RESEARCH P-08). Direct URL access is separately gated in [tab]/page.tsx.
const OWNER_INSIGHTS_TAB = {
  id: 'insights',
  label: 'Insights',
} as const

interface ProfileTabsProps {
  username: string
  /**
   * When true, append a "Common Ground" tab. Set by the layout when the
   * three-way gate (viewer && !isOwner && collectionPublic) passes AND the
   * computed overlap has any content (overlap.hasAny === true).
   * See src/app/u/[username]/common-ground-gate.ts.
   */
  showCommonGround?: boolean
  /**
   * When true, append the owner-only Insights tab. Non-owners never see this
   * entry — the tab is omitted entirely from the DOM (existence-leak
   * defense; RESEARCH P-08 / D-13). Direct URL access to /u/{owner}/insights
   * is separately gated in [tab]/page.tsx.
   */
  isOwner?: boolean
}

export function ProfileTabs({
  username,
  showCommonGround = false,
  isOwner = false,
}: ProfileTabsProps) {
  const pathname = usePathname() ?? ''
  const tabs = [
    ...BASE_TABS,
    ...(showCommonGround ? [COMMON_GROUND_TAB] : []),
    ...(isOwner ? [OWNER_INSIGHTS_TAB] : []),
  ]
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

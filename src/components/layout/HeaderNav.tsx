'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  /**
   * Custom predicate for active state. Defaults to exact-match on pathname.
   * Profile uses startsWith so any /u/{me}/* tab keeps the link highlighted.
   */
  isActive?: (pathname: string) => boolean
}

const baseNavItems: NavItem[] = [
  { href: '/', label: 'Collection' },
]

export function HeaderNav({ username }: { username?: string | null }) {
  const pathname = usePathname() ?? ''

  // Resolve nav items at render time so the Profile link only appears once
  // we know the viewer's username (Header passes it after getProfileById).
  const navItems: NavItem[] = [
    ...baseNavItems,
    ...(username
      ? ([
          {
            href: `/u/${username}/collection`,
            label: 'Profile',
            isActive: (p) => p.startsWith(`/u/${username}`),
          },
        ] satisfies NavItem[])
      : []),
    {
      href: '/settings',
      label: 'Settings',
      isActive: (p) => p === '/settings',
    },
  ]

  return (
    <nav className="hidden md:flex items-center gap-6">
      {navItems.map((item) => {
        const active = item.isActive
          ? item.isActive(pathname)
          : pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'text-sm font-semibold transition-colors hover:text-foreground',
              active ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Collection' },
  { href: '/insights', label: 'Insights' },
  { href: '/preferences', label: 'Preferences' },
]

export function HeaderNav() {
  const pathname = usePathname()

  return (
    <nav className="hidden md:flex items-center gap-6">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'text-sm font-semibold transition-colors hover:text-foreground',
            pathname === item.href
              ? 'text-foreground'
              : 'text-muted-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

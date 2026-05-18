'use client'

// Admin sub-navigation between /admin/lists and /admin/paths.
// Two ghost Button links with an underline-style active state.
// UI-SPEC §Layout: variant="ghost", underline active state matching app's pill pattern.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/admin/lists', label: 'Curated Lists' },
  { href: '/admin/paths', label: 'Collection Paths' },
]

export function AdminSubNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 mb-6" aria-label="Admin navigation">
      {NAV_LINKS.map(({ href, label }) => {
        const isActive = pathname.startsWith(href)
        return (
          <Button
            key={href}
            variant="ghost"
            size="sm"
            render={<Link href={href} />}
            className={cn(
              isActive && 'underline underline-offset-4 font-semibold text-foreground',
            )}
          >
            {label}
          </Button>
        )
      })}
    </nav>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { MobileNav } from '@/components/layout/MobileNav'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Collection' },
  { href: '/insights', label: 'Insights' },
  { href: '/preferences', label: 'Preferences' },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2 md:gap-8">
          <MobileNav />
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">Horlo</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-gray-900',
                  pathname === item.href
                    ? 'text-gray-900'
                    : 'text-gray-500'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/watch/new">
            <Button>Add Watch</Button>
          </Link>
        </div>
      </div>
    </header>
  )
}

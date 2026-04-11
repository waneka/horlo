'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Collection' },
  { href: '/insights', label: 'Insights' },
  { href: '/preferences', label: 'Preferences' },
]

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="h-11 w-11 md:hidden"
          />
        }
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1 px-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex h-11 items-center rounded px-3 text-sm',
                'hover:bg-accent hover:text-accent-foreground',
                pathname === item.href && 'bg-accent text-accent-foreground'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-border px-4 pt-4">
          <ThemeToggle />
        </div>
      </SheetContent>
    </Sheet>
  )
}

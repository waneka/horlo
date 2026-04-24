'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, Plus, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { isPublicPath } from '@/lib/constants/public-paths'
import { NavWearButton } from '@/components/layout/NavWearButton'
import { cn } from '@/lib/utils'
import type { Watch } from '@/lib/types'

/**
 * BottomNav — sticky 5-item mobile bottom navigation (Phase 14, NAV-01..05,
 * NAV-09, NAV-10). Client Component by necessity: `usePathname()` powers the
 * active-state resolution (D-04, D-22).
 *
 * Visibility:
 *   - `md:hidden` — mobile only (< 768px). Desktop top nav handles md+.
 *   - Renders `null` on any PUBLIC_PATH (login, signup, forgot-password,
 *     reset-password, auth/*) via the shared `isPublicPath` predicate
 *     (D-21/D-22 — single source of truth with src/proxy.ts).
 *   - Renders `null` when `username` is null (viewer has no profile yet —
 *     the Profile link has nowhere to point; prevents ghost-nav flash).
 *
 * Layout:
 *   - Fixed to the viewport bottom with safe-area padding for iOS home
 *     indicator (NAV-03 — paired with `viewport-fit=cover` on the layout).
 *   - 5 flex columns: Home · Explore · Wear · Add · Profile. Each column
 *     uses a two-row shape (icon area flex-1 + label band pb-2) so the
 *     Wear 56×56 circle and the 20px lucide icons sit in the same bar
 *     plane while all 5 labels share a single bottom baseline.
 *
 * Active state (D-04):
 *   - Non-Wear items flip icon + label color to `text-accent` and bump
 *     `strokeWidth` from 2 → 2.5 so the active tab is visibly heavier
 *     (lucide-react 1.8.0 has no filled variants — RESEARCH §Pattern 2).
 *   - `aria-current="page"` on the active Link for a11y.
 *   - Profile is active on ANY `/u/{username}` prefix (matches the
 *     common-ground/worn/stats/collection tabs on the profile page).
 *
 * Wear button (NAV-09, Pitfall I-2):
 *   - Reuses the shared `NavWearButton` with `appearance="bottom-nav"`.
 *   - DO NOT fork: both the header Wear CTA and this bottom-nav Wear
 *     circle open the SAME lazy-loaded `WatchPickerDialog`.
 */

interface BottomNavProps {
  username: string | null
  ownedWatches: Watch[]
}

interface NavLinkProps {
  href: string
  icon: LucideIcon
  label: string
  active: boolean
}

function NavLink({ href, icon: Icon, label, active }: NavLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="flex flex-1 flex-col items-center h-full min-h-11"
    >
      <span className="flex-1 flex items-center justify-center">
        <Icon
          className={cn(
            'size-6',
            active ? 'text-accent' : 'text-muted-foreground',
          )}
          strokeWidth={active ? 2.5 : 2}
          aria-hidden
        />
      </span>
      <span
        className={cn(
          'text-[12px] leading-[16px] font-semibold pb-2',
          active ? 'text-accent' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </Link>
  )
}

export function BottomNav({ username, ownedWatches }: BottomNavProps) {
  const pathname = usePathname() ?? ''
  if (isPublicPath(pathname)) return null
  if (!username) return null

  const isHome = pathname === '/'
  const isExplore = pathname === '/explore' || pathname.startsWith('/explore/')
  const isAdd = pathname === '/watch/new'
  const isProfile = pathname.startsWith(`/u/${username}`)

  const profileHref = `/u/${username}/collection`

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 md:hidden',
        'flex items-stretch',
        'bg-background/95 backdrop-blur border-t border-border',
        'h-[calc(80px+env(safe-area-inset-bottom))]',
        'pb-[env(safe-area-inset-bottom)]',
        'px-2',
      )}
    >
      <NavLink href="/" icon={Home} label="Home" active={isHome} />
      <NavLink
        href="/explore"
        icon={Compass}
        label="Explore"
        active={isExplore}
      />
      {/*
        Wear column uses NavWearButton's `bottom-nav` appearance, which renders
        the same two-row (icon area flex-1 + label band) shape as NavLink so
        all 5 column labels share a common bottom baseline. The 56×56 accent
        circle is visually prominent via size + fill, not physical elevation.
      */}
      <NavWearButton ownedWatches={ownedWatches} appearance="bottom-nav" />
      <NavLink href="/watch/new" icon={Plus} label="Add" active={isAdd} />
      <NavLink
        href={profileHref}
        icon={User}
        label="Profile"
        active={isProfile}
      />
    </nav>
  )
}

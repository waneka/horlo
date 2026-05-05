import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InlineThemeSegmented } from '@/components/layout/InlineThemeSegmented'
import { AvatarDisplay } from '@/components/profile/AvatarDisplay'

/**
 * UserMenu — Phase 25 NAV-13 / D-01..D-04 dual-affordance.
 *
 * The trigger is two adjacent siblings inside a `flex items-center gap-1`
 * container:
 *   1. `<Link>` wrapping `<AvatarDisplay size={40}>` — navigates to the
 *      viewer's own profile (`/u/{username}/collection`). 44×44 hit target.
 *   2. Chevron `<Button size="icon-xs">` — opens the existing dropdown
 *      (Settings / Theme / Sign out — per Phase 29 NAV-16 dropdown content).
 *
 * Edge cases:
 *   - `!user`            → "Sign in" link (unchanged from pre-Phase-25).
 *   - `!username`        → chevron-only DropdownMenu trigger; no avatar Link
 *                          (cannot route to /u/null/collection).
 *
 * Locked tokens (UI-SPEC §Spacing Scale + §Anti-Patterns):
 *   - `gap-1` (4px) between avatar and chevron — see UI-SPEC §Anti-Patterns.
 *   - `size-11` (44×44) Link hit target.
 *   - `size={40}` AvatarDisplay (40×40 visual diameter inside the 44px hit box).
 *   - `size="icon-xs"` Button (size-6 = 24×24) for the chevron.
 *   - `size-3.5` (14×14) ChevronDown icon.
 *   - NO outer `bg-muted rounded-full` on the wrapper.
 */
export function UserMenu({
  user,
  username,
  avatarUrl,
}: {
  user: { id: string; email: string } | null
  username: string | null
  avatarUrl: string | null
}) {
  if (!user) {
    return (
      <Link href="/login">
        <Button variant="ghost">Sign in</Button>
      </Link>
    )
  }

  // Dropdown content is identical across both trigger branches (with-avatar
  // vs chevron-only). Defining once and reusing keeps the surface byte-
  // identical to pre-Phase-25 behavior per D-04.
  const dropdownContent = (
    <DropdownMenuContent align="end" className="w-64">
      <DropdownMenuGroup>
        <DropdownMenuLabel className="font-normal">
          <div className="text-xs text-muted-foreground">Signed in as</div>
          <div className="truncate text-sm">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings">Settings</Link>} />
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="mb-1.5 text-xs text-muted-foreground">Theme</div>
          <InlineThemeSegmented />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <form action={logout} className="w-full">
              <button
                type="submit"
                className="w-full text-left text-destructive"
              >
                Sign out
              </button>
            </form>
          }
        />
      </DropdownMenuGroup>
    </DropdownMenuContent>
  )

  if (!username) {
    // Edge case — no profile row resolved. Fall back to a chevron-only
    // DropdownMenu trigger so the user can still reach Sign out / Settings.
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <ChevronDown className="size-4" aria-hidden />
            </Button>
          }
        />
        {dropdownContent}
      </DropdownMenu>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/u/${username}/collection`}
        aria-label={`Go to ${username}'s profile`}
        className="inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <AvatarDisplay
          avatarUrl={avatarUrl}
          displayName={null}
          username={username}
          size={40}
          className="pointer-events-none"
        />
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Open account menu"
            >
              <ChevronDown className="size-3.5" aria-hidden />
            </Button>
          }
        />
        {dropdownContent}
      </DropdownMenu>
    </div>
  )
}

import Link from 'next/link'
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

export function UserMenu({
  user,
  username,
  avatarUrl: _avatarUrl,
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

  // Derive initials from email local-part for the avatar trigger
  const local = user.email.split('@')[0] ?? ''
  const initials = local.slice(0, 2).toUpperCase() || 'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="font-serif">
            {initials}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="text-xs text-muted-foreground">Signed in as</div>
            <div className="truncate text-sm">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {username && (
            <DropdownMenuItem
              render={<Link href={`/u/${username}/collection`}>Profile</Link>}
            />
          )}
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
    </DropdownMenu>
  )
}

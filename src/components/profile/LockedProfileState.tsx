import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvatarDisplay } from './AvatarDisplay'

interface LockedProfileStateProps {
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  followerCount: number
  followingCount: number
}

export function LockedProfileState(props: LockedProfileStateProps) {
  return (
    <>
      <header className="flex flex-col items-center gap-4 py-6 sm:flex-row sm:items-start sm:py-12">
        <AvatarDisplay
          avatarUrl={props.avatarUrl}
          displayName={props.displayName}
          username={props.username}
          size={96}
        />
        <div className="text-center sm:text-left">
          <h1 className="text-xl font-semibold">
            {props.displayName ?? `@${props.username}`}
          </h1>
          {props.bio && (
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {props.bio}
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {props.followerCount} followers · {props.followingCount} following
          </p>
        </div>
      </header>
      <section className="mt-6 flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
        <Lock className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm text-muted-foreground">
          This profile is private.
        </p>
        <Button disabled className="mt-4" aria-label="Follow (coming soon)">
          Follow
        </Button>
      </section>
    </>
  )
}

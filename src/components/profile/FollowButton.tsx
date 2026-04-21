'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { followUser, unfollowUser } from '@/app/actions/follows'
import { cn } from '@/lib/utils'

export interface FollowButtonProps {
  /** null for unauthenticated viewer — click routes to /login?next=... */
  viewerId: string | null
  /** The user being followed/unfollowed. */
  targetUserId: string
  /** Used for aria-label ("Follow {name}" / "Unfollow {name}"). */
  targetDisplayName: string
  /** Server-hydrated initial state from isFollowing(viewerId, targetUserId). */
  initialIsFollowing: boolean
  /** Placement-driven visual variant (D-07). */
  variant?: 'primary' | 'locked' | 'inline'
}

/**
 * Follow/Unfollow CTA (FOLL-01, FOLL-02, FOLL-03).
 *
 * Pattern: useState + useTransition + router.refresh() per D-06. Deliberately
 * NOT useOptimistic — we own the compound state (isFollowing + mobileRevealed)
 * locally so we can roll back cleanly on error and drive the desktop hover-swap
 * via pure CSS.
 *
 * Rules enforced here (defense-in-depth — Server Action also enforces each):
 *   - Self-hidden when viewerId === targetUserId (D-10 / T-09-13).
 *   - Unauth click navigates to /login?next={same-origin pathname} (T-09-10).
 *     Route verified to exist at src/app/login/page.tsx.
 *   - Double-click is blocked via disabled={pending} (T-09-14).
 *   - Rollback on Server Action failure (D-06 error branch).
 */
export function FollowButton({
  viewerId,
  targetUserId,
  targetDisplayName,
  initialIsFollowing,
  variant = 'primary',
}: FollowButtonProps) {
  const router = useRouter()
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [pending, startTransition] = useTransition()
  // Mobile two-tap state (D-09): first tap on "Following" reveals "Unfollow"
  // without firing, second tap commits.
  const [mobileRevealed, setMobileRevealed] = useState(false)

  // Pitfall 4 mitigation: re-sync local state when the parent hydrates a fresh
  // initialIsFollowing (e.g. after router.refresh() pulls updated layout data
  // on a profile whose follow state changed via another tab or ProfileTabs swap).
  useEffect(() => {
    setIsFollowing(initialIsFollowing)
  }, [initialIsFollowing])

  // Self-guard: the viewer is the owner — render nothing (D-10 / T-09-13).
  // Unauth viewers (viewerId === null) still see the button — it routes them
  // to /login on click.
  if (viewerId !== null && viewerId === targetUserId) {
    return null
  }

  function handleClick() {
    // Unauth: bounce to sign-in preserving the current profile as next-param.
    // `/login` route verified at src/app/login/page.tsx. The `next` value is
    // always a same-origin pathname (window.location.pathname) — absolute URLs
    // are not produced by this component (T-09-10).
    if (viewerId === null) {
      const next = encodeURIComponent(window.location.pathname)
      router.push(`/login?next=${next}`)
      return
    }

    // Mobile two-tap (D-09): if currently following, first tap only reveals
    // the "Unfollow" label; the second tap commits.
    if (isFollowing && !mobileRevealed && isMobileViewport()) {
      setMobileRevealed(true)
      return
    }

    const next = !isFollowing
    // Optimistic: flip locally before the Server Action resolves.
    setIsFollowing(next)
    setMobileRevealed(false)
    startTransition(async () => {
      const action = next ? followUser : unfollowUser
      const result = await action({ userId: targetUserId })
      if (!result.success) {
        // Rollback on failure — flip back to the pre-click state.
        setIsFollowing(!next)
        console.error('[FollowButton] action failed:', result.error)
        return
      }
      // Reconcile server-rendered state (follower count lives in the parent
      // layout's ProfileHeader and refreshes via getFollowerCounts).
      router.refresh()
    })
  }

  const ariaLabel = isFollowing
    ? `Unfollow ${targetDisplayName}`
    : `Follow ${targetDisplayName}`

  const baseClass =
    'inline-flex items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait'

  const variantClass =
    variant === 'inline'
      ? cn(
          'h-8 px-3 border border-border',
          isFollowing
            ? 'bg-muted text-muted-foreground group hover:text-destructive focus:text-destructive'
            : 'text-foreground hover:bg-muted',
        )
      : cn(
          'h-8 px-4 font-semibold',
          isFollowing
            ? 'bg-muted text-muted-foreground group hover:text-destructive focus:text-destructive'
            : 'bg-accent text-accent-foreground hover:opacity-90',
          pending && 'opacity-70',
        )

  return (
    <button
      type="button"
      aria-pressed={isFollowing}
      aria-busy={pending}
      aria-label={ariaLabel}
      disabled={pending}
      onClick={handleClick}
      className={cn(baseClass, variantClass)}
    >
      {!isFollowing && 'Follow'}
      {isFollowing && mobileRevealed && 'Unfollow'}
      {isFollowing && !mobileRevealed && (
        <>
          <span className="group-hover:hidden group-focus:hidden">
            Following
          </span>
          <span className="hidden group-hover:inline group-focus:inline">
            Unfollow
          </span>
        </>
      )}
    </button>
  )
}

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  // Tailwind sm breakpoint is 640px — anything below is mobile.
  return window.matchMedia('(max-width: 639px)').matches
}

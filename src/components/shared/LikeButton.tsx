'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'

import { toggleLikeAction } from '@/app/actions/reactions'
import { cn } from '@/lib/utils'
import type { LikeTarget } from '@/data/reactions'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LikeButtonProps {
  /** null for unauthenticated viewer — click routes to /login?next=... */
  viewerId: string | null
  /** { type: 'watch' | 'wear'; id: string } — discriminated by the action schema */
  target: LikeTarget
  initialLiked: boolean
  initialCount: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Shared optimistic Heart toggle button for watch and wear targets (LIKE-01..04).
 *
 * Pattern: useState + useTransition + rollback per FollowButton analog.
 * Deliberately NOT useOptimistic — we own liked + count together so we can
 * roll back both atomically on error.
 *
 * Rules enforced here:
 *   - Anon click navigates to /login?next={same-origin pathname} (LIKE-02).
 *   - Optimistic flip before Server Action resolves (LIKE-01/03).
 *   - Reconcile to server-confirmed values on success (LIKE-04, Phase 55 D-08).
 *   - Rollback + console.error on failure — no user-facing error toast (LIKE-03, SC#4).
 *   - Double-click blocked via disabled={pending} (SC#4).
 *   - Count hidden when count===0 && !liked (LIKE-04).
 *   - Uses 'wear' discriminator per LikeTarget type (never the old DB column name).
 */
export function LikeButton({
  viewerId,
  target,
  initialLiked,
  initialCount,
}: LikeButtonProps) {
  const router = useRouter()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, startTransition] = useTransition()

  // NOTE: No useEffect re-sync of initial props (unlike FollowButton).
  // Cache-tag invalidation in toggleLikeAction handles re-hydration on the next
  // navigation — there is no parent refresh cycle driving a prop update here.

  function handleClick() {
    // Anon bounce: navigate to /login preserving the current page as next-param.
    // Uses window.location.pathname — NOT usePathname() (null in tests; conditional
    // hook call is illegal).
    if (viewerId === null) {
      const next = encodeURIComponent(window.location.pathname)
      router.push(`/login?next=${next}`)
      return
    }

    const nextLiked = !liked
    const nextCount = nextLiked ? count + 1 : count - 1

    // Optimistic: flip locally before the Server Action resolves.
    setLiked(nextLiked)
    setCount(nextCount)

    startTransition(async () => {
      const result = await toggleLikeAction({ type: target.type, id: target.id })
      if (!result.success) {
        // Rollback on failure — flip back to pre-click state.
        // No user-facing error (idempotent re-like must not show an error — LIKE-04/SC#4).
        setLiked(liked)
        setCount(count)
        console.error('[LikeButton] action failed:', result.error)
        return
      }
      // Reconcile to server-confirmed values (NOT the local optimistic increment).
      // Phase 55 D-08: trust the server, not the client count.
      setLiked(result.data.liked)
      setCount(result.data.count)
    })
  }

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-busy={pending}
      aria-label={liked ? 'Unlike' : 'Like'}
      disabled={pending}
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1 min-h-[44px] min-w-[44px] px-2 rounded-md transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait',
        pending && 'opacity-50',
      )}
    >
      <Heart
        className={cn(
          'size-5',
          liked ? 'text-destructive' : 'text-muted-foreground hover:text-foreground',
        )}
        fill={liked ? 'currentColor' : 'none'}
      />
      {(liked || count > 0) && (
        <span
          className={cn(
            'text-sm tabular-nums',
            liked ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

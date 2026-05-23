'use client'

import { useState, useTransition } from 'react'
import { MoreHorizontal, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { addToWishlistFromWearEvent } from '@/app/actions/wishlist'
import { cn } from '@/lib/utils'

interface WearOverflowMenuProps {
  wearEventId: string
  permalinkUrl: string
  showAddToWishlist: boolean
  /** true → text-white trigger (over photo); false → text-foreground */
  onPhoto: boolean
}

/**
 * Overflow "…" menu for wear cards (D-01, D-08, D-09).
 *
 * Always shows "Copy link" (D-01).
 * Conditionally shows "Add to wishlist" only when showAddToWishlist is true (D-09).
 * Preserves WR-03 double-submit guard from WywtSlide.tsx pattern.
 */
export function WearOverflowMenu({
  wearEventId,
  permalinkUrl,
  showAddToWishlist,
  onPhoto,
}: WearOverflowMenuProps) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'added' | 'error'>('idle')

  const handleAddToWishlist = () => {
    // WR-03 double-submit guard: block when in-flight (pending) OR already succeeded.
    if (pending || status === 'added') return
    startTransition(async () => {
      const result = await addToWishlistFromWearEvent({ wearEventId })
      if (result.success) {
        setStatus('added')
        toast('Added to wishlist')
      } else {
        setStatus('error')
        toast('Could not add to wishlist. Try again.')
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More options"
        className={cn(
          'inline-flex items-center justify-center min-h-[44px] min-w-[44px]',
          onPhoto ? 'text-white' : 'text-foreground',
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {/* D-01: Copy link — always visible */}
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard.writeText(permalinkUrl)
          }}
        >
          <LinkIcon className="size-4" />
          Copy link
        </DropdownMenuItem>

        {/* D-09: Add to wishlist — only when showAddToWishlist is true */}
        {showAddToWishlist && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending || status === 'added'}
              onClick={handleAddToWishlist}
            >
              Add to wishlist
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

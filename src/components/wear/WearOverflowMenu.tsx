'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { MoreHorizontal, Link as LinkIcon, Check, ArrowUpRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
  /**
   * true on the stories lane (/wears/[username]) → show "Go to wear post"
   * (in-app nav to the /wear/[id] permalink). false on the detail page itself,
   * where that destination IS the current page (D-01/D-02).
   */
  showGoToPost: boolean
}

/**
 * Overflow "…" menu for wear cards (D-01, D-08, D-09).
 *
 * Stories lane: "Go to wear post" (in-app nav to the permalink) + "Copy link".
 * Detail page: "Copy link" only (you are already on the post).
 * "Copy link" shows an inline "Copied!" confirmation before the menu closes.
 * Conditionally shows "Add to wishlist" only when showAddToWishlist is true (D-09).
 * Preserves WR-03 double-submit guard from WywtSlide.tsx pattern.
 */
export function WearOverflowMenu({
  wearEventId,
  permalinkUrl,
  showAddToWishlist,
  onPhoto,
  showGoToPost,
}: WearOverflowMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'added' | 'error'>('idle')
  const [copied, setCopied] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setCopied(false) // reset the confirmation each time the menu opens
    if (!next && closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const handleCopyLink = () => {
    const absolute = `${window.location.origin}${permalinkUrl}`
    navigator.clipboard.writeText(absolute)
    setCopied(true)
    // Keep the menu open briefly so the user sees "Copied!", then close.
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 900)
  }

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
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
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
        {/* D-01: in-app nav to the permalink — stories lane only (detail page is already here) */}
        {showGoToPost && (
          <DropdownMenuItem onClick={() => router.push(permalinkUrl)}>
            <ArrowUpRight className="size-4" />
            Go to wear post
          </DropdownMenuItem>
        )}

        {/* D-01: Copy link — stays open to show an inline "Copied!" confirmation */}
        <DropdownMenuItem closeOnClick={false} onClick={handleCopyLink}>
          {copied ? <Check className="size-4" /> : <LinkIcon className="size-4" />}
          {copied ? 'Copied!' : 'Copy link'}
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

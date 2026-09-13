'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { MoreHorizontal, Link as LinkIcon, Check, ArrowUpRight, Trash2 } from 'lucide-react'
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
import { WearDeleteDialog } from '@/components/wear/WearDeleteDialog'
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
  /**
   * Server-derived ownership flag (quick task 260913-csl). true only on the
   * detail page for the wear owner (wear.userId === viewerId, computed in
   * page.tsx). WearCard forces this false for the stories lane (bottom-sheet
   * variant) so it cannot surface there even if a future caller passes true.
   */
  canDelete: boolean
  /** Passed through to WearDeleteDialog as the navigate-after-delete fallback. */
  ownerUsername: string
}

/**
 * Overflow "…" menu for wear cards (D-01, D-08, D-09).
 *
 * Stories lane: "Go to wear post" (in-app nav to the permalink) + "Copy link".
 * Detail page: "Copy link" only (you are already on the post), plus an
 * owner-only "Delete wear" item as the LAST item below a separator when
 * canDelete is true (quick task 260913-csl). The stories lane never shows
 * "Delete wear" — WearCard forces canDelete false for the bottom-sheet variant.
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
  canDelete,
  ownerUsername,
}: WearOverflowMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'added' | 'error'>('idle')
  const [copied, setCopied] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set true when "Delete wear" is selected; used by finalFocus below to
  // suppress the menu's default trigger-focus-return so the dialog (which
  // takes focus next) isn't fought over by the closing menu.
  const deleteSelectedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setCopied(false) // reset the confirmation each time the menu opens
      deleteSelectedRef.current = false
    }
    if (!next && closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const handleDeleteSelect = () => {
    deleteSelectedRef.current = true
    setOpen(false)
    setDeleteOpen(true)
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
    <>
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

        <DropdownMenuContent
          align="end"
          finalFocus={() => (deleteSelectedRef.current ? false : true)}
        >
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

          {/* 260913-csl: owner-only "Delete wear" — LAST item, below a separator,
              destructive-styled via the variant token only (no raw palette). */}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleDeleteSelect}>
                <Trash2 className="size-4" aria-hidden />
                Delete wear
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rendered OUTSIDE DropdownMenu/DropdownMenuContent so it survives the
          menu popup unmounting when the item's onClick closes the menu. */}
      {canDelete && (
        <WearDeleteDialog
          wearEventId={wearEventId}
          ownerUsername={ownerUsername}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </>
  )
}

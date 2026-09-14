'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { WatchStatus } from '@/lib/types'

interface WatchCardOverflowMenuProps {
  watchId: string
  status: WatchStatus
  onMarkPreviouslyOwned: () => void
  className?: string
}

/**
 * Phase 85 (LIFE-03/D-05, LIFE-05/D-16) — owner-only ⋯ menu on a collection
 * card. Mirrors `WearOverflowMenu.tsx`'s shape. `ProfileWatchCard`'s whole
 * card is one `<Link>`, so the trigger MUST swallow its click
 * (`preventDefault` + `stopPropagation`) or the click bubbles into the Link
 * and navigates instead of opening the menu (85-RESEARCH Pitfall 1). The
 * popup root also stops propagation so a portaled item click can't
 * React-bubble into the Link either (Pitfall 2).
 */
export function WatchCardOverflowMenu({
  watchId,
  status,
  onMarkPreviouslyOwned,
  className,
}: WatchCardOverflowMenuProps) {
  const [open, setOpen] = useState(false)

  if (status !== 'owned' && status !== 'previously_owned') return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="More options"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        className={cn(
          'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-foreground',
          className,
        )}
      >
        <span className="rounded-full bg-background/90 p-1 shadow ring-1 ring-border">
          <MoreHorizontal className="size-5" aria-hidden />
        </span>
      </DropdownMenuTrigger>

      {/* Stops a portaled item click from React-bubbling into ProfileWatchCard's
          <Link> (85-RESEARCH Pitfall 1/2). */}
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {status === 'owned' && (
          <DropdownMenuItem
            onClick={() => {
              setOpen(false)
              onMarkPreviouslyOwned()
            }}
          >
            Mark as previously owned
          </DropdownMenuItem>
        )}
        {status === 'previously_owned' && (
          <DropdownMenuItem render={<Link href={`/w/${watchId}/edit`} />}>
            Edit
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

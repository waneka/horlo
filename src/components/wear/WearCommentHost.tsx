'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

/**
 * Discriminated union: the bottom-sheet variant REQUIRES open + onOpenChange
 * so the sheet can never become stuck open (no missing-handler footgun).
 * The inline variant must NOT receive those props.
 */
type WearCommentHostProps =
  | { variant: 'bottom-sheet'; open: boolean; onOpenChange: (v: boolean) => void }
  | { variant: 'inline'; open?: never; onOpenChange?: never }

/**
 * Comment host shell — bottom-sheet + inline variants (D-10).
 *
 * Phase 56A ships an empty placeholder body ("No comments yet.") with full
 * chrome (bottom-sheet open/close/swipe-pause hook + inline section).
 * Phase 57 drops the real comment component in at the marked insertion seams.
 *
 * Bottom-sheet: Sheet with SheetContent side="bottom" (UI-SPEC §5).
 * Inline: <section id="wear-comments"> for smooth-scroll from detail page (UI-SPEC §6).
 */
export function WearCommentHost({
  variant,
  open,
  onOpenChange,
}: WearCommentHostProps) {
  if (variant === 'bottom-sheet') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Comments</SheetTitle>
          </SheetHeader>
          {/* Phase 57: shared comment component renders here */}
          <p className="text-sm text-muted-foreground px-4 py-6 text-center">
            No comments yet.
          </p>
        </SheetContent>
      </Sheet>
    )
  }

  // variant === 'inline'
  return (
    <section
      id="wear-comments"
      className="border-t border-border px-4 pt-4 pb-6 md:max-w-[600px] md:mx-auto"
    >
      <h2 className="text-sm font-semibold text-foreground mb-3">Comments</h2>
      {/* Phase 57: shared comment component renders here */}
      <p className="text-sm text-muted-foreground text-center py-4">
        No comments yet.
      </p>
    </section>
  )
}

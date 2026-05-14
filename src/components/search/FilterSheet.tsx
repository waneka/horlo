'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { MovementChips } from '@/components/search/MovementChips'
import { CaseSizeChips } from '@/components/search/CaseSizeChips'
import { StyleChips } from '@/components/search/StyleChips'

interface WatchFacetSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  movement: string | null
  size: string | null
  styleArr: string[]
  onMovementChange: (v: string | null) => void
  onSizeChange: (v: string | null) => void
  onStyleChange: (v: string[]) => void
  styleVocab: string[]
}

export function WatchFacetSheet({
  open,
  onOpenChange,
  movement,
  size,
  styleArr,
  onMovementChange,
  onSizeChange,
  onStyleChange,
  styleVocab,
}: WatchFacetSheetProps) {
  function handleClearAll() {
    onMovementChange(null)
    onSizeChange(null)
    onStyleChange([])
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[80vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        {/* Drag handle — standard mobile bottom-sheet affordance */}
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted-foreground/30 shrink-0" />

        <SheetHeader className="pt-2">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-2">
          <MovementChips selected={movement} onSelect={onMovementChange} />
          <CaseSizeChips selected={size} onSelect={onSizeChange} />
          <StyleChips selected={styleArr} onSelect={onStyleChange} vocab={styleVocab} />
        </div>

        <SheetFooter className="border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive w-full"
            onClick={handleClearAll}
          >
            Clear all
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

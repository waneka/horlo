'use client'

import { Drawer } from '@base-ui/react/drawer'
import { Button } from '@/components/ui/button'
import { MovementChips } from '@/components/search/MovementChips'
import { CaseSizeChips } from '@/components/search/CaseSizeChips'
import { StyleChips } from '@/components/search/StyleChips'
import { BrandChips } from '@/components/search/BrandChips'
import { EraChips } from '@/components/search/EraChips'

interface FilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  movement: string | null
  size: string | null
  styleArr: string[]
  onMovementChange: (v: string | null) => void
  onSizeChange: (v: string | null) => void
  onStyleChange: (v: string[]) => void
  styleVocab: string[]
  /**
   * FU-01 (260519-ga9) — Brand/Era facets, single-select.
   * Phase 49.1 (D-EXPLORE-01): Genre + Archetype facets removed; archetype
   * surface lives only in the /explore CollectorArchetypes rail, deep-linking
   * to ?style= multi-select via StyleChips.
   */
  brand: string | null
  era: string | null
  onBrandChange: (v: string | null) => void
  onEraChange: (v: string | null) => void
  brandVocab: { slug: string; name: string }[]
}

export function FilterDrawer({
  open,
  onOpenChange,
  movement,
  size,
  styleArr,
  onMovementChange,
  onSizeChange,
  onStyleChange,
  styleVocab,
  brand,
  era,
  onBrandChange,
  onEraChange,
  brandVocab,
}: FilterDrawerProps) {
  function handleClearAll() {
    onMovementChange(null)
    onSizeChange(null)
    onStyleChange([])
    onBrandChange(null)
    onEraChange(null)
  }

  return (
    // D-03: onOpenChange is passed directly — no async guard, no if(!loading) wrapper
    <Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="down">
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/10" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none">
          <Drawer.Popup
            className="max-h-[80vh] overflow-y-auto bg-popover rounded-t-xl border-t border-border pb-[env(safe-area-inset-bottom)] pointer-events-auto data-ending-style:translate-y-[2.5rem] data-starting-style:translate-y-[2.5rem]"
          >
            {/* Drag handle — h-2 (8px per UI-SPEC spacing §, not h-1.5) */}
            <div className="mx-auto mt-2 h-2 w-10 rounded-full bg-muted-foreground/30 shrink-0" />
            <Drawer.Content className="flex flex-col gap-6 px-4 pb-2 pt-2">
              <Drawer.Title className="font-heading text-base font-semibold text-foreground">
                Filters
              </Drawer.Title>
              <MovementChips selected={movement} onSelect={onMovementChange} />
              <CaseSizeChips selected={size} onSelect={onSizeChange} />
              <StyleChips selected={styleArr} onSelect={onStyleChange} vocab={styleVocab} />
              <BrandChips selected={brand} onSelect={onBrandChange} vocab={brandVocab} />
              <EraChips selected={era} onSelect={onEraChange} />
            </Drawer.Content>
            <div className="mt-auto flex flex-col gap-2 p-4 border-t border-border pt-3">
              <Drawer.Close
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive w-full"
                    onClick={handleClearAll}
                  />
                }
              >
                Clear all
              </Drawer.Close>
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

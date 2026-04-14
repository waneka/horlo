'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useWatchStore } from '@/store/watchStore'
import { STYLE_TAGS, ROLE_TAGS, DIAL_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

const PRICE_MIN = 0
const PRICE_STEP = 100
// Floor for an empty/free collection so the slider isn't degenerate.
const PRICE_MAX_FLOOR = 1000

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-semibold text-foreground mb-2"
        aria-expanded={open}
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            open ? 'rotate-180' : 'rotate-0'
          )}
          aria-hidden
        />
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

export function FilterBar() {
  const { watches, filters, setFilter, resetFilters } = useWatchStore()

  // Dynamic upper bound: highest marketPrice in the collection, rounded up to
  // the next 1k increment, with a floor so the slider is usable for an empty
  // or all-free collection.
  const priceCap = useMemo(() => {
    const highest = watches.reduce(
      (acc, w) => (w.marketPrice != null && w.marketPrice > acc ? w.marketPrice : acc),
      0,
    )
    const bumped = Math.max(highest, PRICE_MAX_FLOOR)
    return Math.ceil(bumped / 1000) * 1000
  }, [watches])

  // Slider handle positions during a drag. Committed values live in the store
  // under filters.priceRange. Falls back to [PRICE_MIN, priceCap] meaning "all".
  const [local, setLocal] = useState<readonly number[]>(() => [
    filters.priceRange.min ?? PRICE_MIN,
    filters.priceRange.max ?? priceCap,
  ])

  // Invariant: a newly-added watch must never be filtered out of view.
  // Only act when priceCap *grows* vs the previous render — that's the exact
  // signal that a new watch was added at a price above the old cap. Acting on
  // every render instead would snap the max thumb back to the cap immediately
  // after the user deliberately committed a lower max.
  const prevCapRef = useRef(priceCap)
  useEffect(() => {
    const prev = prevCapRef.current
    if (priceCap !== prev) {
      prevCapRef.current = priceCap
      if (priceCap > prev) {
        // Cap grew — clear any stale max and snap the local handle up so the
        // newly-added pricier watch is visible regardless of prior filter.
        setLocal((cur) => [cur[0], priceCap])
        if (filters.priceRange.max != null) {
          setFilter('priceRange', { min: filters.priceRange.min, max: null })
        }
      }
    }
  }, [priceCap, filters.priceRange, setFilter])

  const localMin = local[0]
  const localMax = Math.min(local[1], priceCap)

  const hasActiveFilters =
    filters.styleTags.length > 0 ||
    filters.roleTags.length > 0 ||
    filters.dialColors.length > 0 ||
    filters.priceRange.min != null ||
    filters.priceRange.max != null

  const toggleStyleTag = (tag: string) => {
    const newTags = filters.styleTags.includes(tag)
      ? filters.styleTags.filter((t) => t !== tag)
      : [...filters.styleTags, tag]
    setFilter('styleTags', newTags)
  }

  const toggleRoleTag = (tag: string) => {
    const newTags = filters.roleTags.includes(tag)
      ? filters.roleTags.filter((t) => t !== tag)
      : [...filters.roleTags, tag]
    setFilter('roleTags', newTags)
  }

  const toggleDialColor = (color: string) => {
    const newColors = filters.dialColors.includes(color)
      ? filters.dialColors.filter((c) => c !== color)
      : [...filters.dialColors, color]
    setFilter('dialColors', newColors)
  }

  const commitPriceRange = (next: readonly number[]) => {
    const [min, max] = next
    setFilter('priceRange', {
      min: min === PRICE_MIN ? null : min,
      max: max === priceCap ? null : max,
    })
  }

  const resetPriceRange = () => {
    setLocal([PRICE_MIN, priceCap])
    setFilter('priceRange', { min: null, max: null })
  }

  return (
    <div className="w-full space-y-4">
      {/* Style Tags */}
      <CollapsibleSection title="Style">
        <div className="flex flex-wrap gap-2">
          {STYLE_TAGS.map((tag) => (
            <Badge
              key={tag}
              variant={filters.styleTags.includes(tag) ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer capitalize transition-colors',
                filters.styleTags.includes(tag)
                  ? ''
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
              onClick={() => toggleStyleTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </CollapsibleSection>

      {/* Role Tags */}
      <CollapsibleSection title="Role">
        <div className="flex flex-wrap gap-2">
          {ROLE_TAGS.map((tag) => (
            <Badge
              key={tag}
              variant={filters.roleTags.includes(tag) ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer capitalize transition-colors',
                filters.roleTags.includes(tag)
                  ? ''
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
              onClick={() => toggleRoleTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </CollapsibleSection>

      {/* Dial Colors */}
      <CollapsibleSection title="Dial Color">
        <div className="flex flex-wrap gap-2">
          {DIAL_COLORS.map((color) => (
            <Badge
              key={color}
              variant={filters.dialColors.includes(color) ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer capitalize transition-colors',
                filters.dialColors.includes(color)
                  ? ''
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
              onClick={() => toggleDialColor(color)}
            >
              {color}
            </Badge>
          ))}
        </div>
      </CollapsibleSection>

      {/* Price Range */}
      <CollapsibleSection title="Price">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              ${localMin.toLocaleString()} – ${localMax.toLocaleString()}
            </span>
            {(filters.priceRange.min != null || filters.priceRange.max != null) && (
              <button
                type="button"
                onClick={resetPriceRange}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Reset
              </button>
            )}
          </div>
          <Slider
            min={PRICE_MIN}
            max={priceCap}
            step={PRICE_STEP}
            value={[localMin, localMax]}
            onValueChange={(next) => setLocal(next)}
            onValueCommitted={(next) => commitPriceRange(next)}
          />
        </div>
      </CollapsibleSection>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="text-muted-foreground"
        >
          Clear all filters
        </Button>
      )}
    </div>
  )
}

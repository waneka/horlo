'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useWatchStore } from '@/store/watchStore'
import { STYLE_TAGS, ROLE_TAGS, DIAL_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

const PRICE_MIN = 0
const PRICE_MAX = 100000
const PRICE_STEP = 100

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
  const { filters, setFilter, resetFilters } = useWatchStore()

  const [localMin, setLocalMin] = useState<number>(filters.priceRange.min ?? PRICE_MIN)
  const [localMax, setLocalMax] = useState<number>(filters.priceRange.max ?? PRICE_MAX)

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

  const commitPriceRange = (min: number, max: number) => {
    setFilter('priceRange', {
      min: min === PRICE_MIN ? null : min,
      max: max === PRICE_MAX ? null : max,
    })
  }

  const resetPriceRange = () => {
    setLocalMin(PRICE_MIN)
    setLocalMax(PRICE_MAX)
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
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-6">Min</span>
              <input
                type="range"
                min={PRICE_MIN}
                max={PRICE_MAX}
                step={PRICE_STEP}
                value={localMin}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  const clamped = Math.min(v, localMax)
                  setLocalMin(clamped)
                }}
                onPointerUp={() => commitPriceRange(localMin, localMax)}
                className="w-full accent-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-6">Max</span>
              <input
                type="range"
                min={PRICE_MIN}
                max={PRICE_MAX}
                step={PRICE_STEP}
                value={localMax}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  const clamped = Math.max(v, localMin)
                  setLocalMax(clamped)
                }}
                onPointerUp={() => commitPriceRange(localMin, localMax)}
                className="w-full accent-foreground"
              />
            </div>
          </div>
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

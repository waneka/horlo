'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useWatchStore } from '@/store/watchStore'
import { STYLE_TAGS, ROLE_TAGS, DIAL_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function FilterBar() {
  const { filters, setFilter, resetFilters } = useWatchStore()

  const hasActiveFilters =
    filters.styleTags.length > 0 ||
    filters.roleTags.length > 0 ||
    filters.dialColors.length > 0

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

  return (
    <div className="w-full space-y-4">
      {/* Style Tags */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">Style</h4>
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
      </div>

      {/* Role Tags */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">Role</h4>
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
      </div>

      {/* Dial Colors */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">Dial Color</h4>
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
      </div>

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

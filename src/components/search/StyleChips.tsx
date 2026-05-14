'use client'

import { cn } from '@/lib/utils'

interface StyleChipsProps {
  selected: string[]
  onSelect: (value: string[]) => void
  vocab: string[]
}

export function StyleChips({ selected, onSelect, vocab }: StyleChipsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-foreground">Style</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Style">
        {vocab.map((tag) => {
          const isSelected = selected.includes(tag)
          const displayLabel = tag.charAt(0).toUpperCase() + tag.slice(1)
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={isSelected}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isSelected
                  ? 'bg-accent text-accent-foreground border-accent font-semibold'
                  : 'bg-secondary text-secondary-foreground border-border hover:bg-muted',
              )}
              onClick={() =>
                onSelect(
                  isSelected
                    ? selected.filter((s) => s !== tag)
                    : [...selected, tag],
                )
              }
            >
              {displayLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}

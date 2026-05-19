'use client'

import { cn } from '@/lib/utils'

interface BrandChipsProps {
  selected: string | null
  onSelect: (value: string | null) => void
  vocab: { slug: string; name: string }[]
}

export function BrandChips({ selected, onSelect, vocab }: BrandChipsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-foreground">Brand</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Brand">
        {vocab.map((entry) => {
          const isSelected = selected === entry.slug
          return (
            <button
              key={entry.slug}
              type="button"
              aria-pressed={isSelected}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isSelected
                  ? 'bg-accent text-accent-foreground border-accent font-semibold'
                  : 'bg-secondary text-secondary-foreground border-border hover:bg-muted',
              )}
              onClick={() => onSelect(isSelected ? null : entry.slug)}
            >
              {entry.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

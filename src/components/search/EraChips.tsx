'use client'

import { cn } from '@/lib/utils'
import { ERA_SIGNALS } from '@/lib/taste/vocab'

/** Display map for era facet chip labels — identical to SearchPageClient's ERA_DISPLAY_LABELS. */
const ERA_DISPLAY_LABELS: Record<string, string> = {
  'vintage-leaning': 'Vintage Leaning',
  'modern': 'Modern',
  'contemporary': 'Contemporary',
}

interface EraChipsProps {
  selected: string | null
  onSelect: (value: string | null) => void
}

export function EraChips({ selected, onSelect }: EraChipsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-foreground">Era</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Era">
        {ERA_SIGNALS.map((value) => {
          const isSelected = selected === value
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isSelected
                  ? 'bg-accent text-accent-foreground border-accent font-semibold'
                  : 'bg-secondary text-secondary-foreground border-border hover:bg-muted',
              )}
              onClick={() => onSelect(isSelected ? null : value)}
            >
              {ERA_DISPLAY_LABELS[value] ?? value}
            </button>
          )
        })}
      </div>
    </div>
  )
}

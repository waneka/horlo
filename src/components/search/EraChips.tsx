'use client'

import { Chip } from '@/components/ui/chip'
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
            <Chip
              key={value}
              variant="toggle"
              selected={isSelected}
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : value)}
            >
              {ERA_DISPLAY_LABELS[value] ?? value}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}

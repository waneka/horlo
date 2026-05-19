'use client'

import { cn } from '@/lib/utils'
import { PRIMARY_ARCHETYPES } from '@/lib/taste/vocab'
import { ARCHETYPE_CONFIG } from '@/lib/archetype-config'

interface ArchetypeChipsProps {
  selected: string | null
  onSelect: (value: string | null) => void
}

export function ArchetypeChips({ selected, onSelect }: ArchetypeChipsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-foreground">Archetype</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Archetype">
        {PRIMARY_ARCHETYPES.map((value) => {
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
              {ARCHETYPE_CONFIG[value].displayName}
            </button>
          )
        })}
      </div>
    </div>
  )
}

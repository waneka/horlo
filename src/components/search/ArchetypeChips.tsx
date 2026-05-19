'use client'

import { Chip } from '@/components/ui/chip'
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
            <Chip
              key={value}
              variant="toggle"
              selected={isSelected}
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : value)}
            >
              {ARCHETYPE_CONFIG[value].displayName}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { Chip } from '@/components/ui/chip'
import { PRIMARY_ARCHETYPES } from '@/lib/taste/vocab'

/** Plain genre labels — copied from GENRE_DISPLAY_NAMES in src/app/explore/genres/page.tsx. */
const GENRE_DISPLAY_NAMES: Record<string, string> = {
  dress: 'Dress',
  dive: 'Dive',
  field: 'Field',
  pilot: 'Pilot',
  chrono: 'Chrono',
  gmt: 'GMT',
  racing: 'Racing',
  sport: 'Sport',
  tool: 'Tool',
  hybrid: 'Hybrid',
}

interface GenreChipsProps {
  selected: string | null
  onSelect: (value: string | null) => void
}

export function GenreChips({ selected, onSelect }: GenreChipsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-foreground">Genre</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Genre">
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
              {GENRE_DISPLAY_NAMES[value] ?? value}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}

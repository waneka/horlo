'use client'

import { cn } from '@/lib/utils'
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
              {GENRE_DISPLAY_NAMES[value] ?? value}
            </button>
          )
        })}
      </div>
    </div>
  )
}

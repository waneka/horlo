'use client'

import { cn } from '@/lib/utils'

const MOVEMENT_OPTIONS = [
  { label: 'Automatic', value: 'auto' },
  { label: 'Manual Wind', value: 'manual' },
  { label: 'Quartz', value: 'quartz' },
  { label: 'Spring Drive', value: 'spring_drive' },
] as const

interface MovementChipsProps {
  selected: string | null
  onSelect: (value: string | null) => void
}

export function MovementChips({ selected, onSelect }: MovementChipsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-foreground">Movement Type</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Movement Type">
        {MOVEMENT_OPTIONS.map((opt) => {
          const isSelected = selected === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={isSelected}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isSelected
                  ? 'bg-accent text-accent-foreground border-accent font-semibold'
                  : 'bg-secondary text-secondary-foreground border-border hover:bg-muted',
              )}
              onClick={() => onSelect(isSelected ? null : opt.value)}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

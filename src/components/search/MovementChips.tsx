'use client'

import { Chip } from '@/components/ui/chip'

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
            <Chip
              key={opt.value}
              variant="toggle"
              selected={isSelected}
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : opt.value)}
            >
              {opt.label}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}

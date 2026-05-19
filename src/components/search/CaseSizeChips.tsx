'use client'

import { Chip } from '@/components/ui/chip'

const CASE_SIZE_OPTIONS = [
  { label: '<36mm', value: 'lt36' },
  { label: '36–39mm', value: '36-39' },
  { label: '40–42mm', value: '40-42' },
  { label: '43–45mm', value: '43-45' },
  { label: '46mm+', value: '46plus' },
] as const

interface CaseSizeChipsProps {
  selected: string | null
  onSelect: (value: string | null) => void
}

export function CaseSizeChips({ selected, onSelect }: CaseSizeChipsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-foreground">Case Size</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Case Size">
        {CASE_SIZE_OPTIONS.map((opt) => {
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

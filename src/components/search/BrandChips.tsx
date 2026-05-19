'use client'

import { Chip } from '@/components/ui/chip'

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
            <Chip
              key={entry.slug}
              variant="toggle"
              selected={isSelected}
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : entry.slug)}
            >
              {entry.name}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}

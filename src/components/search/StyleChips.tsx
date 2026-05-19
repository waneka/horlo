'use client'

import { Chip } from '@/components/ui/chip'

interface StyleChipsProps {
  selected: string[]
  onSelect: (value: string[]) => void
  vocab: string[]
}

export function StyleChips({ selected, onSelect, vocab }: StyleChipsProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-foreground">Style</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Style">
        {vocab.map((tag) => {
          const isSelected = selected.includes(tag)
          const displayLabel = tag.charAt(0).toUpperCase() + tag.slice(1)
          return (
            <Chip
              key={tag}
              variant="toggle"
              selected={isSelected}
              aria-pressed={isSelected}
              onClick={() =>
                onSelect(
                  isSelected
                    ? selected.filter((s) => s !== tag)
                    : [...selected, tag],
                )
              }
            >
              {displayLabel}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}

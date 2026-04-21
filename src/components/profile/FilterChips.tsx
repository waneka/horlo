'use client'

import { cn } from '@/lib/utils'

interface FilterChipsProps {
  options: string[] // e.g. ['All', 'Sport', 'Dress', 'Dive']
  active: string
  onChange: (value: string) => void
}

export function FilterChips({ options, active, onChange }: FilterChipsProps) {
  return (
    <div className="flex flex-1 items-center gap-2 overflow-x-auto">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1 text-xs font-normal uppercase tracking-wide transition-colors',
            active === opt
              ? 'bg-accent text-accent-foreground border-accent'
              : 'bg-background text-muted-foreground border-border hover:text-foreground',
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

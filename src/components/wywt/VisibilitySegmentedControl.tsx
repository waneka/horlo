'use client'

import { Lock, Users, Globe2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { WearVisibility } from '@/lib/wearVisibility'

/**
 * Three-button segmented control for wear-event visibility (Phase 15 Plan 03b,
 * D-12). Lives alongside the note + photo zone in ComposeStep.
 *
 * Buttons (left → right): Private / Followers / Public. Each button renders
 * an icon (Lock / Users / Globe2) + label. The active button binds
 * `aria-pressed="true"` and fills with `bg-accent`; the sub-label row below
 * the group reflects the active value's description per UI-SPEC §Copywriting.
 *
 * Accessibility:
 *  - Group wrapper carries `role="group"` + `aria-label="Post visibility"`.
 *  - Each button carries an `aria-label` describing its visibility semantics
 *    so SR users don't rely on icon glyphs alone.
 *  - Keyboard activation is native (<button>).
 */

interface Option {
  value: WearVisibility
  label: string
  icon: LucideIcon
  ariaLabel: string
  subLabel: string
}

const OPTIONS: readonly Option[] = [
  {
    value: 'private',
    label: 'Private',
    icon: Lock,
    ariaLabel: 'Private — only you',
    subLabel: 'Only you',
  },
  {
    value: 'followers',
    label: 'Followers',
    icon: Users,
    ariaLabel: 'Followers only',
    subLabel: 'Followers — people who follow you',
  },
  {
    value: 'public',
    label: 'Public',
    icon: Globe2,
    ariaLabel: 'Public — anyone on Horlo',
    subLabel: 'Anyone on Horlo',
  },
] as const

export function VisibilitySegmentedControl({
  value,
  onChange,
  disabled,
}: {
  value: WearVisibility
  onChange: (v: WearVisibility) => void
  disabled?: boolean
}) {
  const active = OPTIONS.find((o) => o.value === value) ?? OPTIONS[2]
  return (
    <div>
      <div
        role="group"
        aria-label="Post visibility"
        className="inline-flex rounded-md border border-border bg-muted p-1 gap-1"
      >
        {OPTIONS.map((opt) => {
          const Icon = opt.icon
          const isActive = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              aria-label={opt.ariaLabel}
              aria-pressed={isActive}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                'flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold transition',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-transparent text-foreground hover:bg-muted-foreground/10',
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {opt.label}
            </button>
          )
        })}
      </div>
      <p className="mt-1 text-xs font-normal text-muted-foreground">
        {active.subLabel}
      </p>
    </div>
  )
}

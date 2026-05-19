'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

// Shared base classes applied to both variants
const BASE =
  'inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'

// toggle unselected — the default state when no `selected` prop is passed
const TOGGLE_UNSELECTED =
  'bg-secondary text-secondary-foreground border-border hover:bg-muted font-normal'

// removable — BUG-02 fix: text-foreground replaces text-accent-foreground (D-05/D-09)
// text-foreground flips with the theme: near-black in light, near-white in dark
// text-accent-foreground is near-black in BOTH modes → unreadable on dark bg-accent/10
const REMOVABLE =
  'gap-1 bg-accent/10 border-accent text-foreground font-semibold hover:bg-accent/20'

const chipVariants = cva(BASE, {
  variants: {
    variant: {
      toggle: TOGGLE_UNSELECTED,
      removable: REMOVABLE,
    },
  },
  defaultVariants: {
    variant: 'toggle',
  },
})

// Selected-state overlay applied conditionally when variant='toggle' and selected={true}.
// Using a conditional cn() rather than a compound variant for clarity — selected state
// only applies to the toggle variant (planner's choice per D-07).
const SELECTED_CLASSES = 'bg-accent text-accent-foreground border-accent font-semibold'

export type ChipVariants = VariantProps<typeof chipVariants>

export function Chip({
  variant = 'toggle',
  selected,
  removeLabel,
  className,
  children,
  ...props
}: {
  variant?: 'toggle' | 'removable'
  selected?: boolean
  removeLabel?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        chipVariants({ variant }),
        variant === 'toggle' && selected && SELECTED_CLASSES,
        className,
      )}
      {...props}
      // WR-04: `type` is placed AFTER the `{...props}` spread so a stray
      // `type="submit"` from a consumer cannot accidentally turn this primitive
      // into a form submitter. Chip is now a shared primitive in 9+ surfaces;
      // making the safe default un-overridable matches the convention used by
      // shadcn primitives (Button, Switch, etc.).
      type="button"
    >
      {children}
      {variant === 'removable' && (
        <>
          <X className="size-3" aria-hidden />
          {removeLabel ? <span className="sr-only">{removeLabel}</span> : null}
        </>
      )}
    </button>
  )
}

export { chipVariants }

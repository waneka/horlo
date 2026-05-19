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

// WR-02 / IN-01: Discriminated union prevents two foot-guns at compile time:
//   1. A `removable` chip without an `onClick` would render an X dismiss
//      affordance (and screen-reader "Remove ... button" label) that does
//      nothing on activation. Making `onClick` required on the removable
//      branch catches this at the call site.
//   2. The `selected` prop only ever paints when variant === 'toggle'. The
//      old single-shape type let `<Chip variant="removable" selected>` compile
//      silently while having no visual effect. Moving `selected` to the
//      toggle branch (and forbidding it on the removable branch via
//      `selected?: never`) turns the bad combination into a TS error.
//
// `removable` deliberately omits `onClick` from the inherited button attrs
// so we can re-type it as required (non-optional) rather than `onClick?`.
export type ChipProps =
  | ({
      variant?: 'toggle'
      selected?: boolean
      removeLabel?: never
    } & React.ButtonHTMLAttributes<HTMLButtonElement>)
  | ({
      variant: 'removable'
      selected?: never
      removeLabel?: string
      onClick: React.MouseEventHandler<HTMLButtonElement>
    } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>)

export function Chip(props: ChipProps) {
  const {
    variant = 'toggle',
    selected,
    removeLabel,
    className,
    children,
    ...rest
  } = props as {
    variant?: 'toggle' | 'removable'
    selected?: boolean
    removeLabel?: string
    className?: string
    children?: React.ReactNode
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
  return (
    <button
      className={cn(
        chipVariants({ variant }),
        variant === 'toggle' && selected && SELECTED_CLASSES,
        className,
      )}
      {...rest}
      // WR-04: `type` is placed AFTER the spread so a stray `type="submit"`
      // from a consumer cannot accidentally turn this primitive into a form
      // submitter. Chip is now a shared primitive in 9+ surfaces; making the
      // safe default un-overridable matches the convention used by shadcn
      // primitives (Button, Switch, etc.).
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

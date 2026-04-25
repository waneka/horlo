import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Phase 16 reusable coming-soon card.
 *
 * Two visual variants:
 *
 *   compact = false (D-08 default, full-page tab state for Watches/Collections):
 *     Centered, generous vertical padding, mirrors /explore stub pattern —
 *     muted accent-bg circle + lucide icon + serif h1 + muted-foreground p.
 *
 *   compact = true (D-06 All-tab footer card, two cards side-by-side):
 *     Smaller horizontal layout — leading icon in muted circle, heading +
 *     copy in a row. Lower visual weight so the result list above stays
 *     primary.
 *
 * Tagged with differentiated data-testids so Plan 01 SearchPageClient tests
 * can count footer cards without colliding with full-page panels:
 *   - variant='compact' → data-testid="coming-soon-card-compact"
 *   - variant='full'    → data-testid="coming-soon-card-full"
 * (D-06 All tab: 2 compact; D-07 People tab: 0 compact; D-08 Watches/Collections tab: 1 full)
 *
 * Copy is decided per call site (D-08 Claude's discretion):
 *   - Watches tab full-page: "Watches search is on its way. We'll surface
 *     models once we normalize the watch catalog across collectors."
 *   - Collections tab full-page: "Collections are a separate product surface —
 *     coming after the watch catalog lands."
 *   - All-tab footer (compact, Watches): "Watch search coming soon"
 *   - All-tab footer (compact, Collections): "Collection search coming soon"
 *
 * Plan 05 supplies the exact copy; this component is purely structural.
 */
export function ComingSoonCard({
  icon: Icon,
  heading,
  copy,
  variant,
}: {
  icon: LucideIcon
  heading: string
  copy: string
  variant: 'compact' | 'full'
}) {
  if (variant === 'compact') {
    return (
      <div
        data-testid="coming-soon-card-compact"
        className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3"
      >
        <div className="flex size-9 flex-none items-center justify-center rounded-full bg-accent/10">
          <Icon className="size-4 text-accent" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{heading}</p>
          <p className="text-sm text-muted-foreground">{copy}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="coming-soon-card-full"
      className={cn(
        'mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center',
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent/10">
        <Icon className="size-6 text-accent" aria-hidden />
      </div>
      <h2 className="font-serif text-3xl md:text-4xl text-foreground">
        {heading}
      </h2>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">{copy}</p>
    </div>
  )
}

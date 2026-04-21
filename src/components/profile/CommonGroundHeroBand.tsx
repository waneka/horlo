import Link from 'next/link'
import type { TasteOverlapResult } from '@/lib/tasteOverlap'

interface CommonGroundHeroBandProps {
  overlap: TasteOverlapResult
  ownerUsername: string
}

// UI-SPEC pill color mapping — keyed to the overlap label literals.
const PILL_CLASSES: Record<
  TasteOverlapResult['overlapLabel'],
  string
> = {
  'Strong overlap': 'bg-accent text-accent-foreground',
  'Some overlap': 'bg-muted text-foreground',
  'Different taste': 'bg-muted text-muted-foreground',
}

function watchCopy(n: number): string {
  return n === 1 ? '1 shared watch' : `${n} shared watches`
}

function tagCopy(n: number): string {
  return n === 1 ? '1 shared taste tag' : `${n} shared taste tags`
}

/**
 * Compact Common Ground band rendered between ProfileHeader and ProfileTabs
 * when a non-owner views a public profile (layout.tsx gate).
 *
 * Three rendered surfaces:
 *   - LEFT: overlap label pill (Strong / Some / Different)
 *   - MIDDLE: stat strip — "N shared watch(es) · N shared taste tag(s) · lean X together"
 *   - RIGHT: "See full comparison →" link (hidden below sm breakpoint — mobile uses the 6th tab)
 *
 * Empty state (overlap.hasAny === false) renders a single centered line
 * "No overlap yet — your tastes are distinct." with no pill / stat strip
 * / link.
 */
export function CommonGroundHeroBand({
  overlap,
  ownerUsername,
}: CommonGroundHeroBandProps) {
  if (!overlap.hasAny) {
    return (
      <section className="border-t border-b border-border bg-card px-4 py-4 text-center lg:px-8">
        <p className="text-sm text-muted-foreground">
          No overlap yet — your tastes are distinct.
        </p>
      </section>
    )
  }

  const fragments: string[] = []
  if (overlap.sharedWatches.length > 0) {
    fragments.push(watchCopy(overlap.sharedWatches.length))
  }
  if (overlap.sharedTasteTags.length > 0) {
    fragments.push(tagCopy(overlap.sharedTasteTags.length))
  }
  const topSharedStyle = overlap.sharedStyleRows.find(
    (r) => r.viewerPct > 0 && r.ownerPct > 0,
  )
  if (topSharedStyle) {
    fragments.push(`lean ${topSharedStyle.label.toLowerCase()} together`)
  }
  const statStrip = fragments.join(' · ')

  return (
    <section className="border-t border-b border-border bg-card px-4 py-4 lg:px-8">
      <div className="flex flex-row items-center gap-4">
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-sm font-semibold ${
            PILL_CLASSES[overlap.overlapLabel]
          }`}
        >
          {overlap.overlapLabel}
        </span>
        {statStrip && (
          <p className="flex-1 text-sm text-muted-foreground">{statStrip}</p>
        )}
        <Link
          href={`/u/${ownerUsername}/common-ground`}
          className="hidden text-sm font-normal text-muted-foreground hover:text-foreground sm:inline"
        >
          See full comparison →
        </Link>
      </div>
    </section>
  )
}

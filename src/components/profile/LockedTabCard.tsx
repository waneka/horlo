import { Lock } from 'lucide-react'

type LockedTabId =
  | 'collection'
  | 'wishlist'
  | 'worn'
  | 'notes'
  | 'stats'
  | 'common-ground'

interface LockedTabCardProps {
  tab: LockedTabId
  displayName: string | null
  username: string
}

// Per-tab label map per UI-SPEC copywriting contract. Note `worn -> "worn
// history"` remap for grammatical flow — matches UI-SPEC line 357.
const TAB_LABELS: Record<Exclude<LockedTabId, 'common-ground'>, string> = {
  collection: 'collection',
  wishlist: 'wishlist',
  worn: 'worn history',
  notes: 'notes',
  stats: 'stats',
}

/**
 * Per-tab locked-state card. Replaces the inline PrivateTabState helper in
 * [tab]/page.tsx. Shows "{displayName ?? @username} keeps their {tab-label}
 * private." with a lucide Lock icon.
 *
 * Common Ground has no locked variant (D-17) — this component returns null
 * when tab === 'common-ground' as a defense-in-depth guard. [tab]/page.tsx
 * should never render LockedTabCard for the common-ground branch in the
 * first place; it calls notFound() instead.
 */
export function LockedTabCard({
  tab,
  displayName,
  username,
}: LockedTabCardProps) {
  if (tab === 'common-ground') return null
  const name = displayName ?? `@${username}`
  const label = TAB_LABELS[tab]
  return (
    <section className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
      <Lock className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="mt-3 text-sm text-muted-foreground">
        {name} keeps their {label} private.
      </p>
    </section>
  )
}

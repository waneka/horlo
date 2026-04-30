import Link from 'next/link'
import { AlertTriangle, Watch as WatchIcon, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { VerdictBundle } from '@/lib/verdict/types'

/**
 * Phase 20 FIT-01 / D-04: pure-renderer Collection Fit card.
 *
 * Receives a finished VerdictBundle from caller (Server Component in Plans 04/06,
 * Client Component via Server Action in Plan 05). Card has no logic — no engine
 * import, no composer call, no state, no hooks.
 *
 * Pitfall 1 mitigation: this file MUST NOT import @/lib/similarity or
 * @/lib/verdict/composer. Enforced by tests/static/CollectionFitCard.no-engine.test.ts.
 *
 * Three framings via VerdictBundle discriminated union:
 *   - 'same-user' / 'cross-user' → full verdict (D-03/D-04 paths)
 *   - 'self-via-cross-user' (D-08) → "You own this watch" callout
 *
 * D-07 (viewer collection size 0 → hide card entirely) is enforced by the
 * CALLER, not this component. Caller renders nothing when verdict is null.
 */
interface CollectionFitCardProps {
  verdict: VerdictBundle
}

export function CollectionFitCard({ verdict }: CollectionFitCardProps) {
  if (verdict.framing === 'self-via-cross-user') {
    return <YouOwnThisCallout ownedAtIso={verdict.ownedAtIso} ownerHref={verdict.ownerHref} />
  }

  // verdict is VerdictBundleFull from here on
  const [headline, ...rest] = verdict.contextualPhrasings

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          Collection Fit
          <Badge variant="outline">{verdict.headlinePhrasing}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Headline phrasing — text-sm font-medium per UI-SPEC § Typography */}
        {headline && (
          <p className="text-sm font-medium text-foreground">{headline}</p>
        )}

        {/* Contextual phrasings — text-sm muted, single column, space-y-1 */}
        {rest.length > 0 && (
          <ul className="text-sm text-muted-foreground space-y-1">
            {rest.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground/70" aria-hidden>•</span>
                {p}
              </li>
            ))}
          </ul>
        )}

        {/* Most-similar list — only when non-empty */}
        {verdict.mostSimilar.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Most Similar in Collection
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {verdict.mostSimilar.map(({ watch, score }) => (
                <li key={watch.id} className="flex items-center justify-between">
                  <span className="truncate">
                    {watch.brand} {watch.model}
                  </span>
                  <span className="text-muted-foreground/70">
                    {Math.round(score * 100)}% similar
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Role-overlap warning — verbatim copy from SimilarityBadge.tsx:78 */}
        {verdict.roleOverlap && (
          <p className="text-sm text-accent flex items-center gap-2">
            <AlertTriangle className="size-4" aria-hidden />
            May compete for wrist time with similar watches
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * D-08 self-via-cross-user callout. Replaces the entire card body — no header,
 * no verdict computed.
 *
 * Date format: Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
 * Source: viewer.watch.acquisitionDate ?? viewer.watch.createdAt — caller threads as ownedAtIso.
 */
function YouOwnThisCallout({ ownedAtIso, ownerHref }: { ownedAtIso: string; ownerHref: string }) {
  const formatted = formatOwnedDate(ownedAtIso)
  return (
    <Card>
      <CardContent className="py-4 space-y-2">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <WatchIcon className="size-4 text-muted-foreground" aria-hidden />
          You own this watch
        </p>
        <p className="text-sm text-muted-foreground">
          Added {formatted}.
        </p>
        <Link
          href={ownerHref}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline inline-flex items-center gap-1"
        >
          Visit your watch detail
          <ArrowRight className="inline size-3" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  )
}

function formatOwnedDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'recently'
  // UTC fixed timezone — ensures the rendered date matches the calendar day
  // of the ISO string regardless of viewer locale (server vs client tz drift).
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { VerdictBundle } from '@/lib/verdict/types'
import { CollectionFitCompareTable } from '@/components/insights/CollectionFitCompareTable'

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
 * Two framings via VerdictBundle:
 *   - 'same-user' / 'cross-user' → full verdict (D-03/D-04 paths)
 *
 * Phase 50.1 ARCH-02 — the legacy 'self-via-cross-user' branch and its
 * "You own this watch" callout were removed; owner viewers redirect away from
 * /catalog/[id] before CollectionFitCard renders.
 *
 * D-07 (viewer collection size 0 → hide card entirely) is enforced by the
 * CALLER, not this component. Caller renders nothing when verdict is null.
 */
interface CollectionFitCardProps {
  verdict: VerdictBundle
}

export function CollectionFitCard({ verdict }: CollectionFitCardProps) {
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
        {/* Headline phrasing — text-sm font-semibold per UI-SPEC § Typography */}
        {headline && (
          <p className="text-sm font-semibold text-foreground">{headline}</p>
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
                <li key={watch.id}>
                  <Link
                    href={`/watch/${watch.id}`}
                    className="block hover:bg-accent rounded-md p-1"
                  >
                    <span className="flex items-center justify-between">
                      <span className="truncate">{watch.brand} {watch.model}</span>
                      <span className="text-muted-foreground/70">
                        {Math.round(score * 100)}% similar
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* FIT-05 — Pairwise taste drill-down (D-12 through D-16; D-15 module-absent-not-empty) */}
        {verdict.mostSimilar.length > 0 &&
          verdict.candidateCatalogTaste !== null &&
          verdict.candidateCatalogTaste.confidence !== null &&
          verdict.candidateCatalogTaste.confidence >= 0.5 &&
          verdict.mostSimilar[0].watch.catalogTaste != null &&
          verdict.mostSimilar[0].watch.catalogTaste.confidence !== null &&
          verdict.mostSimilar[0].watch.catalogTaste.confidence >= 0.5 && (
          <CollectionFitCompareTable
            candidate={verdict.candidateCatalogTaste}
            owned={verdict.mostSimilar[0].watch.catalogTaste}
            ownedBrand={verdict.mostSimilar[0].watch.brand}
            ownedModel={verdict.mostSimilar[0].watch.model}
          />
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

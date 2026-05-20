import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CatalogTasteAttributes } from '@/lib/types'

/**
 * Phase 39b D-39b-01 / D-39b-02 / D-39b-03 / D-39b-04 —
 * Pure-renderer Reference Identity card for fresh-account viewers
 * (collection.length === 0) on /watch/{id} (NSV-06) and /catalog/{id} (NSV-20).
 *
 * Renders the inferred taste signature for a catalog reference: era-only
 * headline (Phase 49.1 D-SCOPE-01a — archetype side dropped), three scale
 * bars (formality / sportiness / heritage), and design motif chips. No
 * verdict, no judgment framing, no numeric confidence shown.
 *
 * D-39b-01: pure-renderer import isolation. This file MUST NOT import from
 * `@/lib/similarity`, `@/lib/verdict/composer`, `@/lib/verdict/viewerTasteProfile`,
 * or `server-only`. Enforced by tests/static/ReferenceIdentityCard.no-engine.test.ts.
 *
 * D-39b-03 confidence gate: returns null when `taste === null`, when
 * `taste.confidence === null`, or when `taste.confidence < 0.5`. Caller also
 * gates (page.tsx renders fallback caption below threshold); this is
 * defense-in-depth.
 *
 * D-39b-04 identical-rendering lock: /watch/{id} and /catalog/{id} both render
 * this same component with the same prop shape. The catalog page adapts its
 * top-level `CatalogEntry` fields into a `CatalogTasteAttributes` literal
 * (see src/app/catalog/[catalogId]/page.tsx).
 */

const ERA_LABELS: Record<NonNullable<CatalogTasteAttributes['eraSignal']>, string> = {
  'vintage-leaning': 'Vintage-leaning',
  'modern': 'Modern era',
  'contemporary': 'Contemporary',
}

interface ReferenceIdentityCardProps {
  taste: CatalogTasteAttributes | null
}

export function ReferenceIdentityCard({ taste }: ReferenceIdentityCardProps) {
  // D-39b-03 gate (defense-in-depth; caller also gates).
  if (!taste || taste.confidence === null || taste.confidence < 0.5) {
    return null
  }

  const eraLabel = taste.eraSignal ? ERA_LABELS[taste.eraSignal] : null

  // Phase 49.1 D-SCOPE-01a — headline is era-only after archetype removal.
  // The archetype label lookup + span are deleted; hasHeadline reduces to Boolean(eraLabel).
  const hasHeadline = Boolean(eraLabel)
  const hasScale =
    taste.formality !== null || taste.sportiness !== null || taste.heritageScore !== null
  const hasMotifs = taste.designMotifs.length > 0

  return (
    <Card>
      <CardHeader>
        <CardDescription>Inferred taste signature</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasHeadline && (
          <p className="text-base font-semibold text-foreground">
            {eraLabel && <span className="truncate">{eraLabel}</span>}
          </p>
        )}

        {hasScale && (
          <div className="space-y-2">
            {taste.formality !== null && (
              <ScaleBar label="Formality" value={taste.formality} />
            )}
            {taste.sportiness !== null && (
              <ScaleBar label="Sportiness" value={taste.sportiness} />
            )}
            {taste.heritageScore !== null && (
              <ScaleBar label="Heritage" value={taste.heritageScore} />
            )}
          </div>
        )}

        {hasMotifs && (
          <div className="flex flex-wrap gap-1">
            {taste.designMotifs.map((m) => (
              <Badge key={m} variant="outline">
                {m}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * D-39b-04 scale-bar anatomy (UI-SPEC §Scale Visual). Linear horizontal bar with
 * label above, "Low" / "High" ticks below. `aria-label` on the bar track
 * communicates the numeric value (rounded to integer percent) to screen readers.
 */
function ScaleBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div
        className="relative h-1.5 rounded-full bg-muted overflow-hidden"
        aria-label={`${label}: ${pct} out of 100`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-foreground/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground/60">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  )
}

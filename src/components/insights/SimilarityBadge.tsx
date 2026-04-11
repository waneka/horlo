'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useWatchStore } from '@/store/watchStore'
import { usePreferencesStore } from '@/store/preferencesStore'
import { analyzeSimilarity, getSimilarityLabelDisplay } from '@/lib/similarity'
import type { Watch } from '@/lib/types'

interface SimilarityBadgeProps {
  watch: Watch
}

export function SimilarityBadge({ watch }: SimilarityBadgeProps) {
  const { watches } = useWatchStore()
  const { preferences } = usePreferencesStore()

  const result = analyzeSimilarity(watch, watches, preferences)
  const labelDisplay = getSimilarityLabelDisplay(result.label)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          Collection Fit
          <Badge variant="outline">{labelDisplay.text}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{labelDisplay.description}</p>

        {result.reasoning.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">Analysis</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {result.reasoning.map((reason, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-muted-foreground/70">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.mostSimilarWatches.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Most Similar in Collection
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {result.mostSimilarWatches.map(({ watch: similar, score }) => (
                <li key={similar.id} className="flex items-center justify-between">
                  <span>
                    {similar.brand} {similar.model}
                  </span>
                  <span className="text-muted-foreground/70">
                    {Math.round(score * 100)}% similar
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.roleOverlap && (
          <p className="text-sm text-accent flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            May compete for wrist time with similar watches
          </p>
        )}
      </CardContent>
    </Card>
  )
}

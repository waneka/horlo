'use client'

import { useState, useTransition } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { savePreferences } from '@/app/actions/preferences'
import type { OverlapTolerance } from '@/lib/types'

interface OverlapToleranceCardProps {
  initialTolerance: OverlapTolerance
}

/**
 * Phase 23 SET-08 — surfaces the overlapTolerance Select at the top of the
 * Preferences tab. Lifted from PreferencesClient's Collection Settings Card
 * (D-01/D-02).
 *
 * Locked copy per UI-SPEC § Copywriting Contract — em-dashes (U+2014).
 */
export function OverlapToleranceCard({
  initialTolerance,
}: OverlapToleranceCardProps) {
  const [tolerance, setTolerance] = useState<OverlapTolerance>(initialTolerance)
  const [isSaving, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  function updateTolerance(next: OverlapTolerance) {
    setTolerance(next)
    setSaveError(null)
    startTransition(async () => {
      const result = await savePreferences({ overlapTolerance: next })
      if (!result.success) setSaveError(result.error)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overlap tolerance</CardTitle>
        <CardDescription>
          How strictly should we flag watches that overlap with what you
          already own?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 w-full sm:max-w-md">
          <Select
            value={tolerance}
            onValueChange={(v) => v && updateTolerance(v as OverlapTolerance)}
          >
            <SelectTrigger
              id="overlapTolerance"
              aria-label="Overlap tolerance"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="low">Low — Flag any overlap</SelectItem>
              <SelectItem value="medium">
                Medium — Flag significant overlap
              </SelectItem>
              <SelectItem value="high">
                High — Only flag major overlap
              </SelectItem>
            </SelectContent>
          </Select>
          {isSaving && (
            <p
              className="text-xs text-muted-foreground"
              aria-live="polite"
            >
              Saving…
            </p>
          )}
          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              Couldn&apos;t save preferences: {saveError}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

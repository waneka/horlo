'use client'

import { useState } from 'react'
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
import { useFormFeedback } from '@/lib/hooks/useFormFeedback'
import { FormStatusBanner } from '@/components/ui/FormStatusBanner'
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
  // Phase 25 / UX-06 — hybrid toast + banner via shared hook (D-17). Hook
  // owns the transition; consumers MUST NOT keep their own (FG-8).
  const { pending, state, message, run } = useFormFeedback()

  function updateTolerance(next: OverlapTolerance) {
    setTolerance(next)
    run(() => savePreferences({ overlapTolerance: next }), {
      successMessage: 'Tolerance saved',
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
          {/* Phase 25 UX-06 — hybrid feedback (D-16/D-17). */}
          <FormStatusBanner
            state={pending ? 'pending' : state}
            message={message ?? undefined}
          />
        </div>
      </CardContent>
    </Card>
  )
}

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
import type { CollectionGoal } from '@/lib/types'

interface CollectionGoalCardProps {
  initialGoal?: CollectionGoal
}

/**
 * Phase 23 SET-07 — surfaces the collectionGoal Select at the top of the
 * Preferences tab. Lifted from PreferencesClient's Collection Settings Card
 * (D-01/D-02). Adds the brand-loyalist option (D-03) which the savePreferences
 * Zod schema already accepts.
 *
 * Locked copy per UI-SPEC § Copywriting Contract — em-dashes (U+2014), NOT
 * hyphens. The brand-loyalist option label is D-03 LOCKED and must match
 * byte-for-byte.
 */
export function CollectionGoalCard({ initialGoal }: CollectionGoalCardProps) {
  const [goal, setGoal] = useState<CollectionGoal | undefined>(initialGoal)
  // Phase 25 / UX-06 — hybrid toast + banner via shared hook (D-17). Hook
  // owns the transition; consumers MUST NOT keep their own (FG-8).
  const { pending, state, message, run } = useFormFeedback()

  function updateGoal(next: CollectionGoal | undefined) {
    setGoal(next)
    run(() => savePreferences({ collectionGoal: next }), {
      successMessage: 'Goal saved',
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collection goal</CardTitle>
        <CardDescription>
          How do you want your collection to grow over time?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 w-full sm:max-w-md">
          <Select
            value={goal ?? ''}
            onValueChange={(v) =>
              updateGoal((v || undefined) as CollectionGoal | undefined)
            }
          >
            <SelectTrigger id="collectionGoal" aria-label="Collection goal">
              <SelectValue placeholder="Select a goal..." />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="balanced">
                Balanced — Diverse collection across styles
              </SelectItem>
              <SelectItem value="specialist">
                Specialist — Deep in one area
              </SelectItem>
              <SelectItem value="variety-within-theme">
                Variety within a theme
              </SelectItem>
              <SelectItem value="brand-loyalist">
                Brand Loyalist — Same maker, different models
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

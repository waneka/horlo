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
  const [isSaving, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  function updateGoal(next: CollectionGoal | undefined) {
    setGoal(next)
    setSaveError(null)
    startTransition(async () => {
      const result = await savePreferences({ collectionGoal: next })
      if (!result.success) setSaveError(result.error)
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

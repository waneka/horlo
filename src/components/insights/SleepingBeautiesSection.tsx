'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Moon } from 'lucide-react'
import type { Watch } from '@/lib/types'
import { daysSince, SLEEPING_BEAUTY_DAYS } from '@/lib/wear'

export interface SleepingBeautiesSectionProps {
  watches: Watch[]
}

export function SleepingBeautiesSection({ watches }: SleepingBeautiesSectionProps) {
  const owned = watches.filter((w) => w.status === 'owned' || w.status === 'grail')
  const sleeping = owned
    .map((w) => ({ watch: w, days: daysSince(w.lastWornDate) }))
    .filter((entry): entry is { watch: Watch; days: number } =>
      entry.days !== null && entry.days >= SLEEPING_BEAUTY_DAYS
    )
    .sort((a, b) => b.days - a.days)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Moon className="h-5 w-5" aria-hidden />
          Sleeping Beauties
        </CardTitle>
        <CardDescription>
          These have been quiet for a while. Wear them or reconsider them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sleeping.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing napping — every watch in your collection has been worn within the last{' '}
            {SLEEPING_BEAUTY_DAYS} days.
          </p>
        ) : (
          <ul className="space-y-2">
            {sleeping.map(({ watch, days }) => (
              <li key={watch.id}>
                <Link
                  href={`/watch/${watch.id}`}
                  className="flex items-center justify-between rounded-md p-2 hover:bg-accent"
                >
                  <span className="truncate font-semibold">
                    {watch.brand} {watch.model}
                  </span>
                  <span className="text-sm text-muted-foreground shrink-0">{days} days</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

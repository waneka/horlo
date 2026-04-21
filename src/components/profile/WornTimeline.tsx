import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'
import { getSafeImageUrl } from '@/lib/images'

interface WatchSummary {
  id: string
  brand: string
  model: string
  imageUrl: string | null
}

interface WearEventLite {
  id: string
  watchId: string
  wornDate: string
  note: string | null
}

interface WornTimelineProps {
  events: WearEventLite[]
  watchMap: Record<string, WatchSummary>
}

function formatDateHeading(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd + 'T00:00:00')
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function WornTimeline({ events, watchMap }: WornTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <p className="text-base font-semibold">No wear history yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Log your first wear to start tracking which watches you reach for.
        </p>
      </div>
    )
  }
  // Group by wornDate (events are already ordered desc by the DAL)
  const groups: Record<string, WearEventLite[]> = {}
  for (const e of events) {
    if (!groups[e.wornDate]) groups[e.wornDate] = []
    groups[e.wornDate].push(e)
  }
  return (
    <ul className="flex flex-col gap-6">
      {Object.entries(groups).map(([date, dayEvents]) => (
        <li key={date}>
          <h3 className="mb-2 text-sm font-normal text-foreground">
            {formatDateHeading(date)}
          </h3>
          <ul className="flex flex-col gap-2">
            {dayEvents.map((e) => {
              const watch = watchMap[e.watchId]
              const safe = watch ? getSafeImageUrl(watch.imageUrl) : null
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-2"
                >
                  <div className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
                    {safe ? (
                      <Image
                        src={safe}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <WatchIcon className="size-4 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="text-sm">
                    {watch ? `${watch.brand} ${watch.model}` : 'Unknown watch'}
                  </div>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )
}

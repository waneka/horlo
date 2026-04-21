import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'
import { getSafeImageUrl } from '@/lib/images'
import { StatsCard } from './StatsCard'
import { HorizontalBarChart } from './HorizontalBarChart'
import { CollectionObservations } from './CollectionObservations'
import type { Watch } from '@/lib/types'

interface StatsTabContentProps {
  ownedWatches: Watch[]
  styleRows: Array<{ label: string; count: number; percentage: number }>
  roleRows: Array<{ label: string; count: number; percentage: number }>
  mostWorn: Array<{ watch: Watch; count: number }>
  leastWorn: Array<{ watch: Watch; count: number }>
  observations: string[]
}

export function StatsTabContent(props: StatsTabContentProps) {
  if (props.ownedWatches.length < 3) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center">
        <p className="text-base font-semibold">Not enough data.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add at least 3 watches to your collection to see stats.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatsCard title="Most Worn">
          <WornList rows={props.mostWorn} />
        </StatsCard>
        <StatsCard title="Least Worn">
          <WornList rows={props.leastWorn} />
        </StatsCard>
        <StatsCard title="Style Distribution">
          <HorizontalBarChart rows={props.styleRows} />
        </StatsCard>
        <StatsCard title="Role Distribution">
          <HorizontalBarChart rows={props.roleRows} />
        </StatsCard>
      </div>
      <CollectionObservations observations={props.observations} />
    </div>
  )
}

function WornList({ rows }: { rows: Array<{ watch: Watch; count: number }> }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map(({ watch, count }) => {
        const safe = getSafeImageUrl(watch.imageUrl)
        return (
          <li key={watch.id} className="flex items-center gap-3">
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
            <p className="flex-1 text-sm">
              {watch.brand} {watch.model}
            </p>
            <span className="text-sm font-semibold text-foreground">
              {count}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

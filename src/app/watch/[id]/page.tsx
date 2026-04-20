import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getWatchById, getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getMostRecentWearDate } from '@/data/wearEvents'
import { WatchDetail } from '@/components/watch/WatchDetail'

interface WatchPageProps {
  params: Promise<{ id: string }>
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params
  const user = await getCurrentUser()
  const [watch, collection, preferences] = await Promise.all([
    getWatchById(user.id, id),
    getWatchesByUser(user.id),
    getPreferencesByUser(user.id),
  ])

  if (!watch) {
    notFound()
  }

  const lastWornDate = await getMostRecentWearDate(user.id, watch.id)

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <WatchDetail watch={watch} collection={collection} preferences={preferences} lastWornDate={lastWornDate} />
    </div>
  )
}

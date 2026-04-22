import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getWatchByIdForViewer, getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getMostRecentWearDate } from '@/data/wearEvents'
import { WatchDetail } from '@/components/watch/WatchDetail'

interface WatchPageProps {
  params: Promise<{ id: string }>
}

export default async function WatchPage({ params }: WatchPageProps) {
  const { id } = await params
  const user = await getCurrentUser()
  const [result, collection, preferences] = await Promise.all([
    getWatchByIdForViewer(user.id, id),
    getWatchesByUser(user.id),
    getPreferencesByUser(user.id),
  ])

  if (!result) {
    notFound()
  }

  const { watch, isOwner } = result

  // Non-owner never receives lastWornDate — conservative default that honors
  // worn_public intent without adding a separate flag lookup (T-RDB-03).
  const lastWornDate = isOwner ? await getMostRecentWearDate(user.id, watch.id) : null

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <WatchDetail
        watch={watch}
        collection={collection}
        preferences={preferences}
        lastWornDate={lastWornDate}
        viewerCanEdit={isOwner}
      />
    </div>
  )
}

import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getWatchByIdForViewer, getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getCatalogById } from '@/data/catalog'
import { getMostRecentWearDate } from '@/data/wearEvents'
import { computeVerdictBundle } from '@/lib/verdict/composer'
import { computeViewerTasteProfile } from '@/lib/verdict/viewerTasteProfile'
import type { VerdictBundle } from '@/lib/verdict/types'
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

  // Phase 20 D-03 + D-07: compute verdict on the server when the viewer has a
  // collection signal. Empty-collection viewers see no card at all (D-07 lock).
  // /watch/[id] is keyed by per-user watches.id — only same-user and cross-user
  // framings can occur here (D-08 catalog framing is impossible on this route;
  // see RESEARCH Open Q4 resolution).
  let verdict: VerdictBundle | null = null
  if (collection.length > 0) {
    const [profile, catalogEntry] = await Promise.all([
      computeViewerTasteProfile(collection),
      watch.catalogId ? getCatalogById(watch.catalogId) : Promise.resolve(null),
    ])
    verdict = computeVerdictBundle({
      candidate: watch,
      catalogEntry,
      collection,
      preferences,
      profile,
      framing: isOwner ? 'same-user' : 'cross-user',
    })
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <WatchDetail
        watch={watch}
        collection={collection}
        preferences={preferences}
        lastWornDate={lastWornDate}
        viewerCanEdit={isOwner}
        verdict={verdict}
      />
    </div>
  )
}

import { getCurrentUser } from '@/lib/auth'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { CollectionView } from '@/components/watch/CollectionView'

export default async function Home() {
  const user = await getCurrentUser()
  const [watches, preferences] = await Promise.all([
    getWatchesByUser(user.id),
    getPreferencesByUser(user.id),
  ])
  return <CollectionView watches={watches} preferences={preferences} />
}

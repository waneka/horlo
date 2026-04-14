import { getCurrentUser } from '@/lib/auth'
import { getPreferencesByUser } from '@/data/preferences'
import { PreferencesClient } from '@/components/preferences/PreferencesClient'

export default async function PreferencesPage() {
  const user = await getCurrentUser()
  const preferences = await getPreferencesByUser(user.id)
  return <PreferencesClient preferences={preferences} />
}

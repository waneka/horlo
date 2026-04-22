import { redirect } from 'next/navigation'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getProfileById, getProfileSettings } from '@/data/profiles'
import { SettingsClient } from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  // redirect() throws NEXT_REDIRECT — keep it OUTSIDE try/catch so the
  // framework can propagate it. Only set a flag from the catch block.
  let user: { id: string; email: string } | null = null
  let needsLogin = false
  try {
    user = await getCurrentUser()
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      needsLogin = true
    } else {
      throw err
    }
  }
  if (needsLogin || !user) {
    redirect('/login?next=/settings')
  }

  const [profile, settings] = await Promise.all([
    getProfileById(user.id),
    getProfileSettings(user.id),
  ])

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 lg:px-8 lg:py-12">
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your privacy controls. Other sections coming soon.
      </p>
      <div className="mt-6">
        <SettingsClient
          username={profile?.username ?? ''}
          settings={{
            profilePublic: settings.profilePublic,
            collectionPublic: settings.collectionPublic,
            wishlistPublic: settings.wishlistPublic,
          }}
        />
      </div>
    </main>
  )
}

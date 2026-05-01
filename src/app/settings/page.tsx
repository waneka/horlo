import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { getCurrentUserFull, UnauthorizedError } from '@/lib/auth'
import { getProfileById, getProfileSettings } from '@/data/profiles'
import { getPreferencesByUser } from '@/data/preferences'
import { SettingsTabsShell } from '@/components/settings/SettingsTabsShell'

export default async function SettingsPage() {
  // redirect() throws NEXT_REDIRECT — keep it OUTSIDE try/catch so the
  // framework can propagate it (Pitfall 7). Only set a flag from the
  // catch block.
  //
  // Use getCurrentUserFull() (one auth.getUser() round-trip) so we can
  // expose new_email (SET-04 banner gate, Plan 03) + last_sign_in_at
  // (SET-05 / RECONCILED D-08 freshness signal, Plan 04) to the client
  // shell without a second redundant auth.getUser() call.
  let fullUser: User | null = null
  let needsLogin = false
  try {
    fullUser = await getCurrentUserFull()
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      needsLogin = true
    } else {
      throw err
    }
  }
  if (needsLogin || !fullUser) {
    // TODO: Server-side redirect cannot preserve location.hash — deep-link to
    // a non-default tab will land on #account post-login. Acceptable for v1
    // (rare path).
    redirect('/login?next=/settings')
  }

  const userId = fullUser.id
  const userEmail = fullUser.email!

  const [profile, settings, preferences] = await Promise.all([
    getProfileById(userId),
    getProfileSettings(userId),
    getPreferencesByUser(userId),
  ])

  return (
    // UI-SPEC Layout: page wrapper width is max-w-4xl. Vertical-tabs needs
    // ~520px content width minimum (sidebar 176px + panel 320px + gap 24px).
    // The previous narrower 672px wrapper would leave only 472px for the
    // panel; 896px gives 696px panel width which matches existing single-
    // column form surfaces with breathing room.
    <main className="mx-auto max-w-4xl px-4 py-8 lg:px-8 lg:py-12">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsTabsShell
        username={profile?.username ?? ''}
        displayName={profile?.displayName ?? null}
        avatarUrl={profile?.avatarUrl ?? null}
        profilePublic={settings.profilePublic}
        currentEmail={userEmail}
        pendingNewEmail={fullUser.new_email ?? null}
        lastSignInAt={fullUser.last_sign_in_at ?? null}
        settings={settings}
        preferences={preferences}
      />
    </main>
  )
}

import { redirect } from 'next/navigation'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getProfileById, getProfileSettings } from '@/data/profiles'
import { getPreferencesByUser } from '@/data/preferences'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SettingsTabsShell } from '@/components/settings/SettingsTabsShell'

export default async function SettingsPage() {
  // redirect() throws NEXT_REDIRECT — keep it OUTSIDE try/catch so the
  // framework can propagate it (Pitfall 7). Only set a flag from the
  // catch block.
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

  // Read full Supabase User to expose new_email (SET-04 banner gate, Plan 03)
  // + last_sign_in_at (SET-05 / RECONCILED D-08 freshness signal, Plan 04)
  // to the client shell. getCurrentUser() only returns { id, email } — the
  // pending-email + freshness fields require the full User object.
  const supabase = await createSupabaseServerClient()
  const {
    data: { user: fullUser },
  } = await supabase.auth.getUser()

  const [profile, settings, preferences] = await Promise.all([
    getProfileById(user.id),
    getProfileSettings(user.id),
    getPreferencesByUser(user.id),
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
        currentEmail={user.email}
        pendingNewEmail={fullUser?.new_email ?? null}
        lastSignInAt={fullUser?.last_sign_in_at ?? null}
        settings={settings}
        preferences={preferences}
      />
    </main>
  )
}

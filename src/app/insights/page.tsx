import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getProfileById } from '@/data/profiles'

/**
 * /insights retirement — D-13.
 *
 * Content moved to /u/[username]/insights as an owner-only Profile tab
 * (see src/components/profile/InsightsTabContent.tsx). This page preserves
 * incoming bookmarks and the 11 internal links identified in RESEARCH
 * §Runtime State Inventory by redirecting to the viewer's own profile
 * Insights tab.
 *
 * No cache directive (P-11) — redirect target is per-request (depends on
 * the authenticated user's username), so caching would leak the first
 * caller's username to everyone else. See RESEARCH §P-11.
 *
 * `redirect()` throws NEXT_REDIRECT; per Next 16 docs it must live outside
 * any try/catch block.
 */
export default async function InsightsRetirementPage() {
  const user = await getCurrentUser()
  const profile = await getProfileById(user.id)
  redirect(profile?.username ? `/u/${profile.username}/insights` : '/')
}

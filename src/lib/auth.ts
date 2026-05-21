import 'server-only'
import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export class UnauthorizedError extends Error {
  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

// React `cache()` memoizes by argument identity within a single request
// render. Both `getCurrentUser` and `getCurrentUserFull` take no args, so
// the second+ caller in any given request gets the first call's result
// for free — no extra `supabase.auth.getUser()` round-trip. This makes
// `/u/[username]` layout (chrome owner) and `[tab]/page.tsx` (per-tab
// permissions) safely both call `getCurrentUser()` after the Phase 51
// post-merge layout refactor; one network call, two consumers.
//
// `cache()` scope is request-local: it does NOT bridge requests, does NOT
// interact with the `'use cache'` directive (which is cross-request), and
// does NOT leak between users. It's the canonical Next.js pattern for
// shared server data per next.js docs (data-fetching/caching.md).
export const getCurrentUser = cache(
  async function getCurrentUser(): Promise<{ id: string; email: string }> {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) throw new UnauthorizedError()
    return { id: user.id, email: user.email! }
  },
)

/**
 * Returns the full Supabase User object (one auth.getUser() round-trip).
 *
 * Use this when callers need fields beyond `id` + `email` — e.g.,
 * `new_email` (pending email-change confirmation) or `last_sign_in_at`
 * (Phase 22 RECONCILED D-08 freshness signal). Avoids the double round-trip
 * pattern of `getCurrentUser()` followed by a second `auth.getUser()` to
 * read the same User. Throws `UnauthorizedError` on no session, matching
 * `getCurrentUser` semantics.
 *
 * Memoized via React `cache()` — see `getCurrentUser` block comment above.
 */
export const getCurrentUserFull = cache(
  async function getCurrentUserFull(): Promise<User> {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) throw new UnauthorizedError()
    return user
  },
)

// assertOwner — first call in every CMS Server Action (D-06).
// Layout guard alone is insufficient (Partial Rendering does not re-execute layout on navigation).
//
// CR-01 accuracy note: the CMS DAL runs through the Drizzle `db` client, which
// connects directly to Postgres via DATABASE_URL and therefore BYPASSES RLS.
// For every Phase 45 code path, `assertOwner()` is the SOLE enforced write gate
// — the layout redirect is UX only. The RLS write policies in the Phase 45
// migration are a backstop that only takes effect on a future Supabase-JS-client
// access path (e.g. Phase 47 public reads); they do NOT protect any DAL call here.
export async function assertOwner(): Promise<{ id: string; email: string }> {
  const user = await getCurrentUser()
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!data?.is_admin) throw new UnauthorizedError('Not an admin')
  return user
}

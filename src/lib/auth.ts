import 'server-only'
import type { User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export class UnauthorizedError extends Error {
  constructor(message = 'Not authenticated') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export async function getCurrentUser(): Promise<{ id: string; email: string }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new UnauthorizedError()
  return { id: user.id, email: user.email! }
}

/**
 * Returns the full Supabase User object (one auth.getUser() round-trip).
 *
 * Use this when callers need fields beyond `id` + `email` — e.g.,
 * `new_email` (pending email-change confirmation) or `last_sign_in_at`
 * (Phase 22 RECONCILED D-08 freshness signal). Avoids the double round-trip
 * pattern of `getCurrentUser()` followed by a second `auth.getUser()` to
 * read the same User. Throws `UnauthorizedError` on no session, matching
 * `getCurrentUser` semantics.
 */
export async function getCurrentUserFull(): Promise<User> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new UnauthorizedError()
  return user
}

// assertOwner — first call in every CMS Server Action (D-06).
// Layout guard alone is insufficient (Partial Rendering does not re-execute layout on navigation).
// Three-layer security: RLS write policies (DB) + layout redirect (UX) + this call (SA).
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

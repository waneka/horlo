import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client factory. Bypasses RLS.
 *
 * Use ONLY in server actions for privileged operations such as
 * `auth.admin.deleteUser()`. NEVER import this into a Server Component
 * that streams HTML to the browser — confine usage to `src/app/actions/`.
 *
 * The client is created per-call (never cached at module scope) so the
 * service-role key is not held longer than a single request.
 * No session persistence — this client has no user context.
 *
 * Required env var: SUPABASE_SERVICE_ROLE_KEY (confirmed by operator at
 * Phase 41 Plan 01 Task 3 checkpoint — see 41-01-SUMMARY.md).
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  )
}

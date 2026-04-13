import { createClient } from '@supabase/supabase-js'

/**
 * Seed helper: creates two real Supabase Auth users against the LOCAL stack
 * for IDOR integration tests. Uses the service_role key via supabase.auth.admin.
 *
 * Call from a beforeAll() in integration suites. Not used by unit tests.
 *
 * Env vars expected at test time:
 *   NEXT_PUBLIC_SUPABASE_URL  (from supabase status)
 *   SUPABASE_SERVICE_ROLE_KEY (from supabase status — NOT the anon key)
 */
export async function seedTwoUsers() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'seedTwoUsers requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — run against local supabase stack',
    )
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const userA = await admin.auth.admin.createUser({
    email: `test-a-${Date.now()}@horlo.test`,
    password: 'test-password-A',
    email_confirm: true,
  })
  const userB = await admin.auth.admin.createUser({
    email: `test-b-${Date.now()}@horlo.test`,
    password: 'test-password-B',
    email_confirm: true,
  })
  if (userA.error || userB.error) {
    throw new Error(
      `seedTwoUsers failed: ${userA.error?.message ?? userB.error?.message}`,
    )
  }
  return {
    userA: { id: userA.data.user!.id, email: userA.data.user!.email! },
    userB: { id: userB.data.user!.id, email: userB.data.user!.email! },
    cleanup: async () => {
      await admin.auth.admin.deleteUser(userA.data.user!.id)
      await admin.auth.admin.deleteUser(userB.data.user!.id)
    },
  }
}

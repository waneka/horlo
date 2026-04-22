/**
 * DEBT-02 ongoing regression gate — RLS IDOR isolation on the three
 * audit-target tables (public.users, public.watches, public.user_preferences).
 *
 * Mirrors the shape of tests/data/isolation.test.ts but exercises DEBT-02's
 * narrower scope per .planning/phases/11-schema-storage-foundation/11-CONTEXT.md D-15.
 *
 * Scenarios (RESEARCH.md §Validation Architecture):
 *   1. authenticated user cannot SELECT another user's users row
 *   2. authenticated user cannot UPDATE another user's watches row
 *   3. authenticated user cannot INSERT a user_preferences row with different user_id
 *   4. authenticated user CAN INSERT their own user_preferences row
 *
 * Gated on NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Green state depends on Migration 5 + all prior RLS migrations being applied locally.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { db } from '@/db'
import { users, watches, userPreferences } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

const hasLocalDb =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.DATABASE_URL)

const maybe = hasLocalDb ? describe : describe.skip

maybe('DEBT-02 ongoing regression — users/watches/user_preferences IDOR RLS', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  let userA: { id: string; email: string }
  let userB: { id: string; email: string }
  let cleanup: () => Promise<void>
  let userBWatchId: string

  beforeAll(async () => {
    const { seedTwoUsers } = await import('../fixtures/users')
    const seed = await seedTwoUsers()
    userA = seed.userA
    userB = seed.userB
    cleanup = seed.cleanup

    // Seed a watch owned by B (via service-role Drizzle — bypasses RLS) so A has a cross-user
    // row to attempt UPDATEs against.
    const [w] = await db
      .insert(watches)
      .values({
        userId: userB.id,
        brand: 'Debt02Brand',
        model: 'Debt02Model',
        status: 'owned',
        movement: 'automatic',
      })
      .returning()
    userBWatchId = w.id
  }, 30_000)

  afterAll(async () => {
    try {
      await db.delete(userPreferences).where(inArray(userPreferences.userId, [userA.id, userB.id]))
      if (userBWatchId) await db.delete(watches).where(eq(watches.id, userBWatchId))
    } catch {}
    try {
      await cleanup()
    } catch {}
  }, 30_000)

  async function clientAs(user: { email: string }): Promise<SupabaseClient> {
    // seedTwoUsers creates users with fixed passwords 'test-password-A' / 'test-password-B'
    // (per tests/fixtures/users.ts).
    const pw = user.email.startsWith('test-a-') ? 'test-password-A' : 'test-password-B'
    const c = createClient(url, anonKey, { auth: { persistSession: false } })
    const { error } = await c.auth.signInWithPassword({ email: user.email, password: pw })
    if (error) throw new Error(`signIn ${user.email} failed: ${error.message}`)
    return c
  }

  // -----------------------------------------------------------
  // (1) Cross-user SELECT on users table
  // -----------------------------------------------------------
  it("authenticated user A cannot SELECT user B's users row", async () => {
    const c = await clientAs(userA)
    const { data, error } = await c.from('users').select('id, email').eq('id', userB.id)
    // RLS returns an empty array with no error (the row is filtered out, not denied).
    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  })

  // -----------------------------------------------------------
  // (2) Cross-user UPDATE on watches table
  // -----------------------------------------------------------
  it("authenticated user A cannot UPDATE user B's watches row", async () => {
    const c = await clientAs(userA)
    const { data, error } = await c
      .from('watches')
      .update({ brand: 'HackedByA' })
      .eq('id', userBWatchId)
      .select('id, brand')
    // RLS filters the target row to 0 affected; returned data is empty.
    expect(error).toBeNull()
    expect(data ?? []).toEqual([])

    // Confirm via service-role that B's watch is untouched.
    const row = await db.select().from(watches).where(eq(watches.id, userBWatchId))
    expect(row[0]?.brand).toBe('Debt02Brand')
  })

  // -----------------------------------------------------------
  // (3) Cross-user INSERT on user_preferences with foreign user_id
  // -----------------------------------------------------------
  it('authenticated user A cannot INSERT user_preferences with user_id = userB.id', async () => {
    const c = await clientAs(userA)
    const { error } = await c.from('user_preferences').insert({
      user_id: userB.id, // WITH CHECK should reject
      preferred_styles: [],
      disliked_styles: [],
      preferred_design_traits: [],
      disliked_design_traits: [],
      preferred_complications: [],
      complication_exceptions: [],
      preferred_dial_colors: [],
      disliked_dial_colors: [],
      overlap_tolerance: 'medium',
    })
    expect(error).not.toBeNull()
    expect(error?.message ?? '').toMatch(/row-level security|policy|violates/i)
  })

  // -----------------------------------------------------------
  // (4) Same-user INSERT on user_preferences succeeds
  // -----------------------------------------------------------
  it('authenticated user A CAN INSERT own user_preferences row', async () => {
    // Clean any pre-existing row for userA
    await db.delete(userPreferences).where(eq(userPreferences.userId, userA.id))

    const c = await clientAs(userA)
    const { error } = await c.from('user_preferences').insert({
      user_id: userA.id,
      preferred_styles: [],
      disliked_styles: [],
      preferred_design_traits: [],
      disliked_design_traits: [],
      preferred_complications: [],
      complication_exceptions: [],
      preferred_dial_colors: [],
      disliked_dial_colors: [],
      overlap_tolerance: 'medium',
    })
    expect(error).toBeNull()

    // Confirm the row is visible to A via RLS (SELECT policy matches on own user_id).
    const { data } = await c.from('user_preferences').select('user_id').eq('user_id', userA.id)
    expect((data ?? [])[0]?.user_id).toBe(userA.id)
  })
})

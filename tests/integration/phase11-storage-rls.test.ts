/**
 * Phase 11 Migration 4 integration tests — WYWT-13 bucket + WYWT-14 three-tier storage RLS.
 *
 * Three-user scenario:
 *   A = actor (owner of wear events + wear photos)
 *   F = follower of A
 *   S = stranger (does NOT follow A)
 *
 * Three wear events per A at visibility 'public' / 'followers' / 'private'.
 * Three storage objects at path {A.id}/{wear_event_id}.jpg.
 *
 * Access matrix (nine SELECT cases + one folder-enforcement INSERT case):
 *   A public  ✓  F public   ✓  S public   ✓
 *   A follow  ✓  F follow   ✓  S follow   ✗
 *   A private ✓  F private  ✗  S private  ✗
 *   S attempts INSERT into A's folder  ✗
 *
 * Gated on DATABASE_URL + SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL.
 * Wave 0 contract per .planning/phases/11-schema-storage-foundation/11-VALIDATION.md.
 * Green after Plan 05's [BLOCKING] schema push runs Migrations 1+4.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { eq, inArray, sql } from 'drizzle-orm'

import { db } from '@/db'
import { users, wearEvents, watches, follows } from '@/db/schema'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasAdmin =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const maybe = hasDrizzle && hasAdmin ? describe : describe.skip

maybe('Phase 11 storage RLS — WYWT-13 / WYWT-14 three-tier + folder enforcement', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  let admin: SupabaseClient
  let userA: { id: string; email: string; password: string }
  let userF: { id: string; email: string; password: string }
  let userS: { id: string; email: string; password: string }

  // One wear event per visibility tier — keys are the visibility literal.
  const wearEventIds: { public: string; followers: string; private: string } = {
    public: '',
    followers: '',
    private: '',
  }
  let watchId: string

  function objectPath(visibility: 'public' | 'followers' | 'private'): string {
    return `${userA.id}/${wearEventIds[visibility]}.jpg`
  }

  beforeAll(async () => {
    admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // Three real Supabase Auth users.
    const stamp = Date.now()
    const makeUser = async (prefix: string) => {
      const email = `p11-${prefix}-${stamp}@horlo.test`
      const password = `p11-pass-${prefix}-${stamp}`
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error || !data.user) throw new Error(`createUser ${prefix} failed: ${error?.message}`)
      return { id: data.user.id, email, password }
    }
    userA = await makeUser('a')
    userF = await makeUser('f')
    userS = await makeUser('s')

    // Watch for A (wear events reference watches).
    const [w] = await db
      .insert(watches)
      .values({
        userId: userA.id,
        brand: 'TestBrand',
        model: 'TestModel',
        status: 'owned',
        movement: 'automatic',
      })
      .returning()
    watchId = w.id

    // Three wear events, one per visibility, on distinct calendar dates (unique constraint).
    const rows = await db
      .insert(wearEvents)
      .values([
        { userId: userA.id, watchId, wornDate: '2026-04-20', visibility: 'public' },
        { userId: userA.id, watchId, wornDate: '2026-04-21', visibility: 'followers' },
        { userId: userA.id, watchId, wornDate: '2026-04-22', visibility: 'private' },
      ])
      .returning()
    for (const r of rows) {
      wearEventIds[r.visibility as 'public' | 'followers' | 'private'] = r.id
    }

    // F follows A. S does NOT follow A.
    await db.insert(follows).values({ followerId: userF.id, followingId: userA.id })

    // Upload one placeholder file per wear event path — via service-role (bypasses RLS on write).
    // Storage RLS on write is still tested separately below (folder-enforcement).
    const filePath = (v: 'public' | 'followers' | 'private') => objectPath(v)
    const tinyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) // minimal SOI/EOI
    for (const v of ['public', 'followers', 'private'] as const) {
      const up = await admin.storage.from('wear-photos').upload(filePath(v), tinyJpeg, {
        contentType: 'image/jpeg',
        upsert: true,
      })
      if (up.error) throw new Error(`admin upload ${v} failed: ${up.error.message}`)
    }
  }, 60_000)

  afterAll(async () => {
    if (!userA || !userF || !userS) return
    try {
      // Storage cleanup (service-role bypasses RLS)
      for (const v of ['public', 'followers', 'private'] as const) {
        await admin.storage.from('wear-photos').remove([objectPath(v)])
      }
    } catch {}
    try {
      await db.delete(follows).where(eq(follows.followerId, userF.id))
      await db.delete(wearEvents).where(eq(wearEvents.userId, userA.id))
      await db.delete(watches).where(eq(watches.id, watchId))
      await db.delete(users).where(inArray(users.id, [userA.id, userF.id, userS.id]))
    } catch {}
    try {
      await admin.auth.admin.deleteUser(userA.id)
      await admin.auth.admin.deleteUser(userF.id)
      await admin.auth.admin.deleteUser(userS.id)
    } catch {}
  }, 60_000)

  // Helper: create a client authenticated as the given user
  async function clientAs(user: { email: string; password: string }): Promise<SupabaseClient> {
    const c = createClient(url, anonKey, { auth: { persistSession: false } })
    const { error } = await c.auth.signInWithPassword({ email: user.email, password: user.password })
    if (error) throw new Error(`signIn ${user.email} failed: ${error.message}`)
    return c
  }

  async function canDownload(client: SupabaseClient, visibility: 'public' | 'followers' | 'private'): Promise<boolean> {
    const { data, error } = await client.storage.from('wear-photos').download(objectPath(visibility))
    if (error) return false
    // A zero-byte blob still counts as a successful RLS pass; the RLS test is about access, not payload.
    return data !== null
  }

  describe('three-tier SELECT (WYWT-14)', () => {
    // Owner sees all three
    it('A (owner) can download public wear photo', async () => {
      const c = await clientAs(userA)
      expect(await canDownload(c, 'public')).toBe(true)
    })
    it('A (owner) can download followers wear photo', async () => {
      const c = await clientAs(userA)
      expect(await canDownload(c, 'followers')).toBe(true)
    })
    it('A (owner) can download private wear photo', async () => {
      const c = await clientAs(userA)
      expect(await canDownload(c, 'private')).toBe(true)
    })

    // Follower: public + followers yes, private no
    it('F (follower) can download public wear photo', async () => {
      const c = await clientAs(userF)
      expect(await canDownload(c, 'public')).toBe(true)
    })
    it('F (follower) can download followers wear photo', async () => {
      const c = await clientAs(userF)
      expect(await canDownload(c, 'followers')).toBe(true)
    })
    it('F (follower) CANNOT download private wear photo', async () => {
      const c = await clientAs(userF)
      expect(await canDownload(c, 'private')).toBe(false)
    })

    // Stranger: public yes, followers + private no
    it('S (stranger) can download public wear photo', async () => {
      const c = await clientAs(userS)
      expect(await canDownload(c, 'public')).toBe(true)
    })
    it('S (stranger) CANNOT download followers wear photo', async () => {
      const c = await clientAs(userS)
      expect(await canDownload(c, 'followers')).toBe(false)
    })
    it('S (stranger) CANNOT download private wear photo', async () => {
      const c = await clientAs(userS)
      expect(await canDownload(c, 'private')).toBe(false)
    })

    // Dynamic coverage (WR-05): policy must react to follow-relationship and
    // visibility-tier changes, not just the static matrix above.
    it('F loses access to followers-tier photo after unfollowing A', async () => {
      const c = await clientAs(userF)
      // Sanity: F can download while the follow exists.
      expect(await canDownload(c, 'followers')).toBe(true)

      // Break the follow relationship.
      await db.delete(follows).where(eq(follows.followerId, userF.id))
      try {
        expect(await canDownload(c, 'followers')).toBe(false)
      } finally {
        // Restore follow relationship so subsequent tests (and afterAll cleanup) are unaffected.
        await db.insert(follows).values({ followerId: userF.id, followingId: userA.id })
      }
    })

    it('F loses access when A tightens a public photo to private', async () => {
      const c = await clientAs(userF)
      // Sanity: F can download while visibility='public'.
      expect(await canDownload(c, 'public')).toBe(true)

      // Tighten: public → private.
      await db
        .update(wearEvents)
        .set({ visibility: 'private' })
        .where(eq(wearEvents.id, wearEventIds.public))
      try {
        expect(await canDownload(c, 'public')).toBe(false)
      } finally {
        // Restore to public so subsequent tests (if any) and the nine-cell matrix intent survive.
        await db
          .update(wearEvents)
          .set({ visibility: 'public' })
          .where(eq(wearEvents.id, wearEventIds.public))
      }
    })
  })

  describe('folder-enforcement INSERT (WYWT-14 / Pitfall F-4)', () => {
    it("S (stranger) CANNOT upload into A's folder", async () => {
      const c = await clientAs(userS)
      const tinyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
      const { error } = await c.storage
        .from('wear-photos')
        .upload(`${userA.id}/malicious-${Date.now()}.jpg`, tinyJpeg, {
          contentType: 'image/jpeg',
          upsert: false,
        })
      expect(error).not.toBeNull()
      // Supabase returns a row-level security violation for policy-rejected uploads.
      expect(error?.message ?? '').toMatch(/row-level security|policy|unauthorized|not allowed/i)
    })

    it('S (stranger) CAN upload into own folder', async () => {
      const c = await clientAs(userS)
      const tinyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
      const ownKey = `${userS.id}/legit-${Date.now()}.jpg`
      const { error } = await c.storage.from('wear-photos').upload(ownKey, tinyJpeg, {
        contentType: 'image/jpeg',
        upsert: false,
      })
      expect(error).toBeNull()
      // Cleanup — delete the file via service-role
      await admin.storage.from('wear-photos').remove([ownKey])
    })
  })

  describe('bucket privacy (WYWT-13)', () => {
    it('wear-photos bucket is private (public = false)', async () => {
      const rows = await db.execute(sql`
        SELECT id, public, file_size_limit, allowed_mime_types
          FROM storage.buckets
         WHERE id = 'wear-photos'
      `)
      const arr = (rows as unknown as Array<{
        id: string
        public: boolean
        file_size_limit: number | string
        allowed_mime_types: string[]
      }>) ?? []
      expect(arr).toHaveLength(1)
      expect(arr[0].public).toBe(false)
      // Drizzle returns bigint columns as strings; coerce to number for comparison.
      expect(Number(arr[0].file_size_limit)).toBe(5242880)
      expect(arr[0].allowed_mime_types).toEqual(['image/jpeg', 'image/png', 'image/webp'])
    })
  })
})

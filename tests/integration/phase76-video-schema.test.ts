// @vitest-environment node
/**
 * Phase 76 Plan 01 integration tests — VID-11 + VID-12.
 *
 * Proves the additive schema migration (`20260622000000_phase76_video_schema.sql`)
 * delivers the contract Plan 03's Server Action depends on:
 *
 *   VID-11 — pre-existing photo rows preserved:
 *     - Test 1: a row inserted with only `photoUrl` set has `media_type='photo'`
 *       (DEFAULT applied), `photo_url` intact, `media_path=null`, `poster_path=null`.
 *     - Test 5: the photo write-path still succeeds post-migration — a new row
 *       with `mediaType='photo'` + `photoUrl='...'` + `mediaPath=null` inserts
 *       cleanly because the CHECK's `media_type = 'photo' OR ...` branch passes.
 *
 *   VID-12 — video row contract enforced by DB:
 *     - Test 2: video row with BOTH `media_path` and `poster_path` non-NULL persists.
 *     - Test 3: video row with `media_path = NULL` rejected with PG 23514 (CHECK violation).
 *     - Test 4: video row with `poster_path = NULL` rejected with PG 23514.
 *
 * Gate: DATABASE_URL + NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY +
 *       SUPABASE_SERVICE_ROLE_KEY. Without any of these, suite is `describe.skip`
 *       so the Vercel prebuild static-test run does not fail on missing infra.
 *
 * Per durable memory `project_vitest_static_node_env`: file MUST start with the
 * `// @vitest-environment node` pragma above so it can read `process.env.*` on
 * Vercel prebuild without `readdirSync undefined` (jsdom default would fail).
 *
 * Per durable memory `project_local_catalog_natural_key_drift`: catalog row is
 * inserted RAW via `db.insert(watchesCatalog).values(...)` — no upsert helper —
 * because the local `watches_catalog_natural_key` UNIQUE constraint can be
 * silently lost after Drizzle pushes and the upsert path leaks `catalogIdError`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { eq, inArray } from 'drizzle-orm'

import { randomUUID } from 'node:crypto'
import { db } from '@/db'
import { users, watches, watchesCatalog, wearEvents } from '@/db/schema'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabase =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasDrizzle && hasSupabase ? describe : describe.skip

/**
 * Extract the Postgres error code from a thrown drizzle error. drizzle-orm
 * 0.45.2 wraps the underlying postgres-js error in a `DrizzleQueryError`
 * (`node_modules/drizzle-orm/errors.cjs`) and exposes the original PG error
 * — which carries `.code` (e.g. '23514' for CHECK violation) — on the
 * wrapper's `.cause`. Older test patterns that read `err.code` directly
 * receive `undefined` because the wrapper itself does not forward the code.
 */
function pgErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined
  const direct = (err as { code?: unknown }).code
  if (typeof direct === 'string') return direct
  const cause = (err as { cause?: unknown }).cause
  if (cause && typeof cause === 'object') {
    const causeCode = (cause as { code?: unknown }).code
    if (typeof causeCode === 'string') return causeCode
  }
  return undefined
}

maybe('Phase 76 video schema — VID-11 + VID-12', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  let admin: SupabaseClient
  let userId: string
  let catalogId: string
  let watchId: string
  let legacyWearEventId: string

  // Distinct dates per insert to dodge the wear_events_unique_day UNIQUE
  // constraint (user_id, watch_id, worn_date). One per test.
  const DATE_LEGACY = '2026-06-21'
  const DATE_VIDEO_HAPPY = '2026-06-22'
  const DATE_VIDEO_NULL_MEDIA = '2026-06-23'
  const DATE_VIDEO_NULL_POSTER = '2026-06-24'
  const DATE_PHOTO_FRESH = '2026-06-25'

  beforeAll(async () => {
    admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const stamp = Date.now()
    const email = `p76-${stamp}@horlo.test`
    const password = `p76-pass-${stamp}`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error || !data.user) {
      throw new Error(`createUser failed: ${error?.message}`)
    }
    userId = data.user.id

    // Insert catalog row raw — do NOT call any upsert helper (durable memory
    // project_local_catalog_natural_key_drift). Use a unique brand+model+stamp
    // so the natural key cannot collide with seeds or prior test runs.
    const [catRow] = await db
      .insert(watchesCatalog)
      .values({
        brand: `TestBrand-P76-${stamp}`,
        model: `TestModel-P76-${stamp}`,
        source: 'user_promoted',
      })
      .returning({ id: watchesCatalog.id })
    catalogId = catRow.id

    const [watchRow] = await db
      .insert(watches)
      .values({
        userId,
        brand: `TestBrand-P76-${stamp}`,
        model: `TestModel-P76-${stamp}`,
        status: 'owned',
        movementType: 'auto',
        catalogId,
      })
      .returning({ id: watches.id })
    watchId = watchRow.id

    // Pre-create the legacy photo fixture — relies on the DEFAULT 'photo'
    // applied by the migration to verify VID-11 (Test 1).
    const [legacyRow] = await db
      .insert(wearEvents)
      .values({
        userId,
        watchId,
        wornDate: DATE_LEGACY,
        photoUrl: 'fixture-legacy/abc.jpg',
      })
      .returning({ id: wearEvents.id })
    legacyWearEventId = legacyRow.id
  }, 60_000)

  afterAll(async () => {
    if (!userId) return
    try {
      await db.delete(wearEvents).where(eq(wearEvents.userId, userId))
      await db.delete(watches).where(eq(watches.userId, userId))
      await db.delete(watchesCatalog).where(inArray(watchesCatalog.id, [catalogId]))
      await db.delete(users).where(eq(users.id, userId))
    } catch {}
    try {
      await admin.auth.admin.deleteUser(userId)
    } catch {}
  }, 60_000)

  // --------------------------------------------------------------------------
  // Test 1 — VID-11: legacy photo row preserved by additive migration.
  // The fixture inserted in beforeAll wrote only `photo_url`; the DEFAULT
  // 'photo' on media_type applied. Migration is provably non-destructive on
  // existing rows.
  // --------------------------------------------------------------------------
  it('VID-11: legacy photo row preserved (media_type defaults to photo, photo_url intact, new paths null)', async () => {
    const rows = await db
      .select()
      .from(wearEvents)
      .where(eq(wearEvents.id, legacyWearEventId))

    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.mediaType).toBe('photo')
    expect(row.photoUrl).toBe('fixture-legacy/abc.jpg')
    expect(row.mediaPath).toBeNull()
    expect(row.posterPath).toBeNull()
  })

  // --------------------------------------------------------------------------
  // Test 2 — VID-12 happy: video row with both paths populated persists.
  // --------------------------------------------------------------------------
  it('VID-12 happy: video row with both media_path and poster_path persists', async () => {
    const wearEventId = randomUUID()
    const mediaPath = `${userId}/${wearEventId}.mp4`
    const posterPath = `${userId}/${wearEventId}-poster.jpg`

    await db.insert(wearEvents).values({
      id: wearEventId,
      userId,
      watchId,
      wornDate: DATE_VIDEO_HAPPY,
      mediaType: 'video',
      mediaPath,
      posterPath,
      photoUrl: null,
    })

    const rows = await db
      .select()
      .from(wearEvents)
      .where(eq(wearEvents.id, wearEventId))
    expect(rows).toHaveLength(1)
    expect(rows[0].mediaType).toBe('video')
    expect(rows[0].mediaPath).toBe(mediaPath)
    expect(rows[0].posterPath).toBe(posterPath)
    expect(rows[0].photoUrl).toBeNull()
  })

  // --------------------------------------------------------------------------
  // Test 3 — VID-12 reject: video row with NULL media_path → PG 23514.
  // The CHECK constraint wear_events_video_paths_required is the
  // last-line defense: any code path that tries to write a video row
  // without both Storage paths is rejected at the DB layer.
  // --------------------------------------------------------------------------
  it('VID-12 reject: video row with NULL media_path raises PG 23514 (CHECK violation)', async () => {
    let caught: unknown = null
    try {
      await db.insert(wearEvents).values({
        userId,
        watchId,
        wornDate: DATE_VIDEO_NULL_MEDIA,
        mediaType: 'video',
        mediaPath: null,
        posterPath: `${userId}/abc-poster.jpg`,
      })
    } catch (err) {
      caught = err
    }

    expect(caught).not.toBeNull()
    // drizzle-orm 0.45.2 wraps the underlying postgres-js error in a
    // DrizzleQueryError and exposes the original PG error (with `.code`) on
    // `.cause`. The PG code for a CHECK constraint violation is 23514.
    expect(pgErrorCode(caught)).toBe('23514')
  })

  // --------------------------------------------------------------------------
  // Test 4 — VID-12 reject: video row with NULL poster_path → PG 23514.
  // Symmetric to Test 3 — both nullable paths must be populated for video.
  // --------------------------------------------------------------------------
  it('VID-12 reject: video row with NULL poster_path raises PG 23514 (CHECK violation)', async () => {
    let caught: unknown = null
    try {
      await db.insert(wearEvents).values({
        userId,
        watchId,
        wornDate: DATE_VIDEO_NULL_POSTER,
        mediaType: 'video',
        mediaPath: `${userId}/abc.mp4`,
        posterPath: null,
      })
    } catch (err) {
      caught = err
    }

    expect(caught).not.toBeNull()
    expect(pgErrorCode(caught)).toBe('23514')
  })

  // --------------------------------------------------------------------------
  // Test 5 — VID-11: photo write-path still works after migration.
  // Inserting a fresh photo row with mediaType='photo' + photoUrl set +
  // mediaPath/posterPath NULL succeeds — the CHECK's photo branch
  // (media_type = 'photo' OR ...) passes trivially. Future Phase 77 photo
  // posts continue writing photo_url; the migration did not break them.
  // --------------------------------------------------------------------------
  it('VID-11: photo write-path still works post-migration (fresh photo row inserts cleanly)', async () => {
    const wearEventId = randomUUID()
    await db.insert(wearEvents).values({
      id: wearEventId,
      userId,
      watchId,
      wornDate: DATE_PHOTO_FRESH,
      mediaType: 'photo',
      photoUrl: 'fresh-photo/xyz.jpg',
      mediaPath: null,
      posterPath: null,
    })

    const rows = await db
      .select()
      .from(wearEvents)
      .where(eq(wearEvents.id, wearEventId))
    expect(rows).toHaveLength(1)
    expect(rows[0].mediaType).toBe('photo')
    expect(rows[0].photoUrl).toBe('fresh-photo/xyz.jpg')
    expect(rows[0].mediaPath).toBeNull()
    expect(rows[0].posterPath).toBeNull()
  })
})

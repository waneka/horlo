/**
 * Phase 37 — Layer D RLS + schema introspection integration tests (CAT-18).
 *
 * ASSUMES DATABASE_URL points to LOCAL Supabase Docker. NEVER export the prod
 * pooler URL before running `npm run test`. Tests skip if DATABASE_URL doesn't
 * look like localhost.
 *
 * Per Phase 36 Plan 04 vitest env lesson, invoke with:
 *   set -a; source .env.local; set +a; npx vitest run tests/integration/phase37-rls.test.ts
 *
 * Threats covered:
 *   - T-37-RLS-01 (anon read divestments): has_table_privilege returns false
 *   - T-37-RLS-02 (cross-user read): anon supabase-js SELECT returns empty
 *   - T-37-FK-01 (FK orphan): non-existent catalog_id INSERT raises FK violation
 *   - T-37-TXN-01 (partial dual-write): `recordDivestment dual-write` describe asserts both
 *     side effects together OR neither (rollback verified via forced FK violation on
 *     replacedByCatalogId)
 *
 * Validation map: covers V-02..V-10 + V-14 from 37-VALIDATION.md.
 *
 * V-10 dual-write tests stub `@/lib/auth` via `vi.mock` to inject a stable test user id,
 * then call `recordDivestment` directly. The Server Action's `'use server'` directive
 * only affects the Next.js bundler — the function is a plain async function under vitest.
 *
 * NOTE on raw SQL fixture inserts (V-10 describe block): db.insert(watches).values({...})
 * generates column names from the Drizzle schema definition (e.g. `movement_type`,
 * `movement_caliber`). The local Docker DB may be at a different schema generation (e.g.
 * still has the pre-Phase-35 `movement` column). Raw SQL INSERT avoids this drift by
 * specifying only the columns that have existed since the initial schema — this is
 * intentional and does NOT reduce test coverage (the V-10 assertions target
 * divestments-side behavior, not watches column exhaustiveness).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'

// Stable test user id — used across the V-10 describe block.
const TEST_USER_ID = '00000000-0000-0000-0000-000000000037'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: TEST_USER_ID, email: 'test@horlo.local' })),
}))

// Stub next/cache so revalidatePath / revalidateTag are no-ops under vitest.
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const dbUrlIsLocal =
  typeof process.env.DATABASE_URL === 'string' &&
  (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))

const maybe = process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && dbUrlIsLocal
  ? describe : describe.skip

maybe('Phase 37 RLS + schema introspection — divestments + provenance (CAT-18)', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // -------- V-03: 3 new pgEnums exist --------
  it('condition_grade pgEnum exists (V-03)', async () => {
    const result = await db.execute<{ typname: string }>(sql`
      SELECT typname FROM pg_type WHERE typname = 'condition_grade'
    `)
    const rows = result as unknown as Array<{ typname: string }>
    expect(rows.length).toBe(1)
  })

  it('currency_code pgEnum exists (V-03)', async () => {
    const result = await db.execute<{ typname: string }>(sql`
      SELECT typname FROM pg_type WHERE typname = 'currency_code'
    `)
    const rows = result as unknown as Array<{ typname: string }>
    expect(rows.length).toBe(1)
  })

  it('box_papers_status pgEnum exists (V-03)', async () => {
    const result = await db.execute<{ typname: string }>(sql`
      SELECT typname FROM pg_type WHERE typname = 'box_papers_status'
    `)
    const rows = result as unknown as Array<{ typname: string }>
    expect(rows.length).toBe(1)
  })

  // -------- V-02: 7 new watches columns present --------
  it('watches table has all 7 new provenance columns (V-02)', async () => {
    const result = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='watches'
         AND column_name IN ('serial','year_of_acquisition','condition','box_papers','service_history','paid_currency','purchase_date')
       ORDER BY column_name
    `)
    const cols = (result as unknown as Array<{ column_name: string }>).map(r => r.column_name)
    expect(cols).toEqual([
      'box_papers', 'condition', 'paid_currency', 'purchase_date',
      'serial', 'service_history', 'year_of_acquisition',
    ])
  })

  // -------- V-04: divestments table shape (10 columns in order) --------
  it('divestments table has all 10 expected columns in order (V-04)', async () => {
    const result = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='divestments'
       ORDER BY ordinal_position
    `)
    const cols = (result as unknown as Array<{ column_name: string }>).map(r => r.column_name)
    expect(cols).toEqual([
      'id', 'catalog_id', 'user_id', 'divested_at', 'replaced_by_catalog_id',
      'sale_price', 'sale_currency', 'notes', 'created_at', 'updated_at',
    ])
  })

  // -------- V-05: divestments FK cascade types --------
  it('divestments.catalog_id FK is ON DELETE RESTRICT (T-37-FK-01; V-05)', async () => {
    const result = await db.execute<{ confdeltype: string }>(sql`
      SELECT c.confdeltype FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype='f' AND c.conrelid='divestments'::regclass AND a.attname='catalog_id'
    `)
    const row = (result as unknown as Array<{ confdeltype: string }>)[0]
    expect(row?.confdeltype).toBe('r')  // 'r' = RESTRICT
  })

  it('divestments.user_id FK is ON DELETE CASCADE (V-05)', async () => {
    const result = await db.execute<{ confdeltype: string }>(sql`
      SELECT c.confdeltype FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype='f' AND c.conrelid='divestments'::regclass AND a.attname='user_id'
    `)
    const row = (result as unknown as Array<{ confdeltype: string }>)[0]
    expect(row?.confdeltype).toBe('c')  // 'c' = CASCADE
  })

  it('divestments.replaced_by_catalog_id FK is ON DELETE SET NULL (V-05)', async () => {
    const result = await db.execute<{ confdeltype: string }>(sql`
      SELECT c.confdeltype FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype='f' AND c.conrelid='divestments'::regclass AND a.attname='replaced_by_catalog_id'
    `)
    const row = (result as unknown as Array<{ confdeltype: string }>)[0]
    expect(row?.confdeltype).toBe('n')  // 'n' = SET NULL
  })

  // -------- V-06: divestments has 4 RLS policies --------
  it('divestments has 4 RLS policies (D-10; V-06)', async () => {
    const result = await db.execute<{ count: string }>(sql`
      SELECT count(*)::text AS count FROM pg_policies
       WHERE schemaname='public' AND tablename='divestments'
    `)
    const row = (result as unknown as Array<{ count: string }>)[0]
    expect(Number(row.count)).toBe(4)
  })

  // -------- V-07: anon CANNOT SELECT divestments (per-user RLS) --------
  it('has_table_privilege: anon CANNOT SELECT divestments (T-37-RLS-01; V-07)', async () => {
    const result = await db.execute<{ can: boolean }>(sql`
      SELECT has_table_privilege('anon', 'public.divestments', 'SELECT') AS can
    `)
    const row = (result as unknown as Array<{ can: boolean }>)[0]
    expect(row.can).toBe(false)
  })

  // -------- V-07: anon supabase-js SELECT returns empty (T-37-RLS-02) --------
  it('anon supabase-js SELECT * FROM divestments returns empty (T-37-RLS-02; V-07)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data, error } = await anon.from('divestments').select('*')
    // With per-user RLS + no GRANT to anon, postgrest can return either an
    // error OR an empty array depending on Supabase's posture. Both are
    // acceptable as long as no rows leak.
    if (error) {
      expect(error.code).toMatch(/^(42501|PGRST|.*permission|.*RLS).*/i)
    } else {
      expect(data).toEqual([])
    }
  })

  // -------- V-08: authenticated CAN SELECT/INSERT/UPDATE/DELETE divestments --------
  it('has_table_privilege: authenticated CAN SELECT divestments (V-08)', async () => {
    const result = await db.execute<{ can: boolean }>(sql`
      SELECT has_table_privilege('authenticated', 'public.divestments', 'SELECT') AS can
    `)
    const row = (result as unknown as Array<{ can: boolean }>)[0]
    expect(row.can).toBe(true)
  })

  it('has_table_privilege: authenticated CAN INSERT divestments (V-08)', async () => {
    const result = await db.execute<{ can: boolean }>(sql`
      SELECT has_table_privilege('authenticated', 'public.divestments', 'INSERT') AS can
    `)
    const row = (result as unknown as Array<{ can: boolean }>)[0]
    expect(row.can).toBe(true)
  })

  it('has_table_privilege: authenticated CAN UPDATE divestments (V-08)', async () => {
    const result = await db.execute<{ can: boolean }>(sql`
      SELECT has_table_privilege('authenticated', 'public.divestments', 'UPDATE') AS can
    `)
    const row = (result as unknown as Array<{ can: boolean }>)[0]
    expect(row.can).toBe(true)
  })

  it('has_table_privilege: authenticated CAN DELETE divestments (V-08)', async () => {
    const result = await db.execute<{ can: boolean }>(sql`
      SELECT has_table_privilege('authenticated', 'public.divestments', 'DELETE') AS can
    `)
    const row = (result as unknown as Array<{ can: boolean }>)[0]
    expect(row.can).toBe(true)
  })

  // -------- V-09: FK orphan rejection at INSERT time --------
  // drizzle-orm wraps postgres-js errors; the FK violation code lives on `.cause.code`.
  it('INSERT into divestments with non-existent catalog_id fails with FK violation (T-37-FK-01; V-09)', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO divestments (catalog_id, user_id)
        VALUES (${randomUUID()}, ${randomUUID()})
      `)
    ).rejects.toMatchObject({ cause: { code: '23503' } })
  })

  // -------- V-14: docs/deploy-db-setup.md §37 heading present --------
  it('docs/deploy-db-setup.md contains "## Phase 37" heading (V-14)', async () => {
    const fs = await import('node:fs/promises')
    const content = await fs.readFile('docs/deploy-db-setup.md', 'utf8')
    expect(content).toContain('## Phase 37')
  })

  // ========================================================================
  // V-10 — Server Action atomic dual-write (recordDivestment)
  //
  // The dual-write is the FIRST `db.transaction()` usage in the codebase. We
  // assert BOTH side effects together on happy path AND BOTH absent on rollback.
  // This is the test the checker upgraded from "manual UI walkthrough" to
  // "automated integration assertion" — see Plan 05 revision notes.
  //
  // Setup: each test inserts its own fixture watch (status='owned', valid
  // catalog_id pulled from existing watches_catalog) so tests are independent.
  // Tests are NOT torn down — local DB is wipeable per
  // memory/project_db_wipeable_2026_05_09.md; future runs may need a
  // `supabase db reset` to clear accumulated test fixtures.
  //
  // Fixture watch insert uses raw SQL (not Drizzle ORM) to avoid column-name
  // drift between the Drizzle schema definition and the local Docker DB's
  // actual column shape (e.g. local may have `movement` pre-Phase-35 rename
  // while Drizzle schema emits `movement_type`/`movement_caliber`). Raw SQL
  // INSERT specifying only durable base columns is immune to this drift.
  // ========================================================================
  describe('recordDivestment dual-write (V-10; T-37-TXN-01)', () => {
    let testCatalogId: string

    beforeAll(async () => {
      // Pull or create a catalog row for the test fixture's catalog_id.
      // If watches_catalog is empty (e.g. after a `supabase db reset` or Phase 35
      // TRUNCATE cascade), insert a synthetic row. Idempotent via ON CONFLICT DO NOTHING.
      const syntheticCatalogId = '00000000-0000-4000-a000-000000000037'
      await db.execute(sql`
        INSERT INTO watches_catalog (id, brand, model)
        VALUES (${syntheticCatalogId}::uuid, 'Test Brand V10', 'Test Model V10')
        ON CONFLICT (id) DO NOTHING
      `)

      const result = await db.execute<{ id: string }>(sql`
        SELECT id FROM watches_catalog LIMIT 1
      `)
      const rows = result as unknown as Array<{ id: string }>
      if (rows.length === 0) {
        throw new Error('V-10 setup: watches_catalog is still empty after synthetic insert — check DB state')
      }
      testCatalogId = rows[0].id

      // Ensure the synthetic test user exists in auth.users (required by the
      // watches.user_id FK). If it already exists from a prior test run, the
      // INSERT is skipped via ON CONFLICT DO NOTHING.
      await db.execute(sql`
        INSERT INTO auth.users (id, email, created_at, updated_at, confirmation_token, email_confirmed_at)
        VALUES (
          ${TEST_USER_ID}::uuid,
          'test-v10@horlo.local',
          now(), now(), '', now()
        )
        ON CONFLICT (id) DO NOTHING
      `)
    })

    it('happy path: inserts divestments row + flips watches.status to "sold" atomically', async () => {
      // 1) Insert fixture watch via raw SQL (bypasses Server Action auth gate AND
      //    Drizzle ORM column-mapping drift — see file header NOTE).
      const watchId = randomUUID()
      await db.execute(sql`
        INSERT INTO watches (id, user_id, brand, model, status, catalog_id)
        VALUES (${watchId}, ${TEST_USER_ID}, 'TestBrand-V10-Happy', 'TestModel-V10-Happy', 'owned', ${testCatalogId})
      `)

      // 2) Call recordDivestment (Server Action; getCurrentUser is mocked above
      //    to return TEST_USER_ID — bypasses the auth gate).
      const { recordDivestment } = await import('@/app/actions/divestments')
      const result = await recordDivestment(watchId)

      // 3) Assert ActionResult shape: success.
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.divestmentId).toMatch(/^[0-9a-f-]{36}$/i)
      }

      // 4) Assert side effect 1: exactly one divestments row exists for this
      //    user + catalog, freshly inserted.
      const divestmentRows = await db.execute<{ count: string }>(sql`
        SELECT count(*)::text AS count FROM divestments
         WHERE user_id = ${TEST_USER_ID}
           AND catalog_id = ${testCatalogId}
           AND created_at > now() - interval '1 minute'
      `)
      expect(Number((divestmentRows as unknown as Array<{ count: string }>)[0].count)).toBeGreaterThanOrEqual(1)

      // 5) Assert side effect 2: watches.status = 'sold' for the fixture watch.
      const watchRows = await db.execute<{ status: string }>(sql`
        SELECT status FROM watches WHERE id = ${watchId}
      `)
      expect((watchRows as unknown as Array<{ status: string }>)[0].status).toBe('sold')
    })

    it('rollback path: forced FK violation rolls back BOTH writes (no divestment row, watches.status remains "owned")', async () => {
      // 1) Insert fixture watch via raw SQL (status='owned', valid catalog_id).
      const watchId = randomUUID()
      await db.execute(sql`
        INSERT INTO watches (id, user_id, brand, model, status, catalog_id)
        VALUES (${watchId}, ${TEST_USER_ID}, 'TestBrand-V10-Rollback', 'TestModel-V10-Rollback', 'owned', ${testCatalogId})
      `)

      // Snapshot the divestment row count BEFORE the call so we can assert
      // delta == 0 after the rollback (avoids cross-test contamination from
      // the happy-path test).
      const before = await db.execute<{ count: string }>(sql`
        SELECT count(*)::text AS count FROM divestments
         WHERE user_id = ${TEST_USER_ID} AND catalog_id = ${testCatalogId}
      `)
      const beforeCount = Number((before as unknown as Array<{ count: string }>)[0].count)

      // 2) Call recordDivestment with a NON-EXISTENT replacedByCatalogId.
      //    This is a valid uuid format (zod passes) but a FK violation at
      //    INSERT time → the transaction rolls back BOTH writes.
      const { recordDivestment } = await import('@/app/actions/divestments')
      const result = await recordDivestment(watchId, {
        replacedByCatalogId: randomUUID(),  // valid uuid; not a real catalog row
      })

      // 3) Assert ActionResult shape: failure (the catch block returns { success: false }).
      expect(result.success).toBe(false)

      // 4) Assert side effect 1 absent: divestment row count unchanged.
      const after = await db.execute<{ count: string }>(sql`
        SELECT count(*)::text AS count FROM divestments
         WHERE user_id = ${TEST_USER_ID} AND catalog_id = ${testCatalogId}
      `)
      const afterCount = Number((after as unknown as Array<{ count: string }>)[0].count)
      expect(afterCount).toBe(beforeCount)

      // 5) Assert side effect 2 absent: watches.status STILL 'owned'.
      const watchRows = await db.execute<{ status: string }>(sql`
        SELECT status FROM watches WHERE id = ${watchId}
      `)
      expect((watchRows as unknown as Array<{ status: string }>)[0].status).toBe('owned')
    })
  })
})

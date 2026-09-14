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
 *
 * Validation map: covers V-02..V-09 + V-14 from 37-VALIDATION.md.
 *
 * Phase 85 D-03 update: the Server Action dual-write formerly covered by
 * V-10 / T-37-TXN-01 (an INSERT into the disposal-tracking table alongside
 * an UPDATE of watches.status='sold', wrapped in an atomic transaction) has
 * been retired — `editWatch` no longer performs that dual-write, and the Server
 * Action module that owned it no longer exists. The `divestments`
 * table-shape and RLS assertions below (V-04..V-09) remain — the table itself
 * is left in place, just no longer written to.
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'

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
})

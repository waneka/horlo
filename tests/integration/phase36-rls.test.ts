/**
 * Phase 36 — Layer C RLS + schema introspection integration tests (CAT-17 + CAT-14).
 *
 * ASSUMES DATABASE_URL points to LOCAL Supabase Docker. NEVER export the prod
 * pooler URL before running `npm run test`. Pitfall 4 mitigation below: tests skip
 * if DATABASE_URL doesn't look like localhost.
 *
 * Threats covered:
 *   - T-36-01 (anon write): anon INSERT into watch_variants is blocked
 *   - T-36-02 (anon read enabled): has_table_privilege returns true; SELECT works
 *   - T-36-03 (FK orphans): non-existent catalog_id INSERT raises FK violation
 *   - T-36-04 (CAT-14): watches.catalog_id is_nullable = 'NO'
 *
 * Validation map: covers V-01..V-11 in 36-VALIDATION.md.
 */
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '@/db'

// Pitfall 4: assert localhost to prevent accidental prod runs.
const dbUrlIsLocal =
  typeof process.env.DATABASE_URL === 'string' &&
  (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))

const maybe = process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && dbUrlIsLocal
  ? describe : describe.skip

maybe('Phase 36 RLS + schema introspection — watch_variants + CAT-14 (CAT-17, CAT-14)', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // -------- V-05 / T-36-02: anon SELECT privilege via has_table_privilege --------
  it('has_table_privilege: anon can SELECT watch_variants (T-36-02; anon SELECT; V-05)', async () => {
    const result = await db.execute<{ can: boolean }>(sql`
      SELECT has_table_privilege('anon', 'public.watch_variants', 'SELECT') AS can
    `)
    const row = (result as unknown as Array<{ can: boolean }>)[0]
    expect(row.can).toBe(true)
  })

  // -------- V-05 / T-36-02: anon SELECT via supabase-js client --------
  it('anon supabase-js SELECT * FROM watch_variants works (T-36-02; anon SELECT; V-05)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data, error } = await anon.from('watch_variants').select('*')
    expect(error).toBeNull()
    expect(data).not.toBeNull()
  })

  // -------- V-06 / T-36-01: anon INSERT blocked by RLS --------
  it('anon supabase-js INSERT INTO watch_variants fails with RLS (T-36-01; anon INSERT; V-06)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { error } = await anon.from('watch_variants').insert({
      catalog_id: randomUUID(), name: 'AnonVariant', slug: 'anon-variant',
    })
    expect(error).not.toBeNull()
    const errorText = `${error?.code ?? ''} ${error?.message ?? ''}`
    expect(errorText).toMatch(/42501|RLS|policy|permission|not allowed|insufficient/i)
  })

  // -------- V-08 / T-36-04: watches.catalog_id is NOT NULL (CAT-14 flip applied) --------
  it('watches.catalog_id is NOT NULL after Phase 36 (T-36-04; CAT-14; catalog_id is NOT NULL; V-08)', async () => {
    const result = await db.execute<{ is_nullable: string }>(sql`
      SELECT is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name='watches' AND column_name='catalog_id'
    `)
    const row = (result as unknown as Array<{ is_nullable: string }>)[0]
    expect(row?.is_nullable).toBe('NO')
  })

  // -------- V-09 / CAT-14: INSERT NULL catalog_id is rejected --------
  // drizzle-orm wraps the underlying postgres-js error: the SQLSTATE code lives on
  // `.cause.code`, not the top-level error. Assert against the wrapped cause.
  it('INSERT into watches with NULL catalog_id fails with NOT NULL violation (CAT-14; INSERT NULL catalog_id; V-09)', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO watches (user_id, brand, model, status, catalog_id)
        VALUES (${randomUUID()}, 'TestBrand', 'TestModel', 'wishlist', NULL)
      `)
    ).rejects.toMatchObject({ cause: { code: '23502' } })
  })

  // -------- V-02: schema introspection — column shape --------
  it('watch_variants table has all 10 expected columns in order (table exists; V-02)', async () => {
    const result = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='watch_variants'
       ORDER BY ordinal_position
    `)
    const cols = (result as unknown as Array<{ column_name: string }>).map(r => r.column_name)
    expect(cols).toEqual([
      'id', 'catalog_id', 'name', 'slug', 'dial_color', 'bezel',
      'bracelet_variant', 'image_url', 'created_at', 'updated_at',
    ])
  })

  // -------- V-03: watch_variants.catalog_id is NOT NULL --------
  it('watch_variants.catalog_id is NOT NULL (catalog_id NOT NULL; V-03)', async () => {
    const result = await db.execute<{ is_nullable: string }>(sql`
      SELECT is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name='watch_variants' AND column_name='catalog_id'
    `)
    const row = (result as unknown as Array<{ is_nullable: string }>)[0]
    expect(row?.is_nullable).toBe('NO')
  })

  // -------- V-04: UNIQUE (catalog_id, slug) --------
  it('watch_variants has UNIQUE (catalog_id, slug) (catalog_slug UNIQUE; V-04)', async () => {
    const result = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname='watch_variants_catalog_slug_unique'
           AND conrelid='watch_variants'::regclass
      ) AS exists
    `)
    const row = (result as unknown as Array<{ exists: boolean }>)[0]
    expect(row.exists).toBe(true)
  })

  // -------- V-07: watches.variant_id column exists with correct FK cascade --------
  it('watches.variant_id FK has ON DELETE SET NULL (D-04; variant_id; V-07)', async () => {
    const result = await db.execute<{ confdeltype: string }>(sql`
      SELECT c.confdeltype FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype='f' AND c.conrelid='watches'::regclass AND a.attname='variant_id'
    `)
    // 'n' = SET NULL per Postgres pg_constraint docs
    const row = (result as unknown as Array<{ confdeltype: string }>)[0]
    expect(row?.confdeltype).toBe('n')
  })

  // -------- V-11: watches.catalog_id ON DELETE SET NULL preserved (Phase 17 D-04) --------
  it('watches.catalog_id FK has ON DELETE SET NULL preserved (Phase 17 D-04; catalog_id ON DELETE SET NULL; V-11)', async () => {
    const result = await db.execute<{ confdeltype: string }>(sql`
      SELECT c.confdeltype FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype='f' AND c.conrelid='watches'::regclass AND a.attname='catalog_id'
    `)
    const row = (result as unknown as Array<{ confdeltype: string }>)[0]
    expect(row?.confdeltype).toBe('n')
  })

  // -------- V-01 / T-36-03: ON DELETE RESTRICT on watch_variants.catalog_id --------
  it('watch_variants.catalog_id FK has ON DELETE RESTRICT (T-36-03; D-03; ON DELETE RESTRICT; V-01)', async () => {
    const result = await db.execute<{ confdeltype: string }>(sql`
      SELECT c.confdeltype FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype='f' AND c.conrelid='watch_variants'::regclass AND a.attname='catalog_id'
    `)
    // 'r' = RESTRICT per Postgres pg_constraint docs
    const row = (result as unknown as Array<{ confdeltype: string }>)[0]
    expect(row?.confdeltype).toBe('r')
  })

  // -------- T-36-03: FK orphan rejection at INSERT time --------
  // drizzle-orm wraps postgres-js errors; the FK violation code lives on `.cause.code`.
  it('INSERT into watch_variants with non-existent catalog_id fails with FK violation (T-36-03; FK orphan; V-01)', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO watch_variants (catalog_id, name, slug)
        VALUES (${randomUUID()}, 'OrphanVariant', 'orphan-variant')
      `)
    ).rejects.toMatchObject({ cause: { code: '23503' } })
  })

  // -------- V-10: DO $$ pre-flight is the FIRST statement in the migration file --------
  // Static file-grep guard. Verifies ROADMAP success #3 verbatim.
  it('Phase 36 supabase migration has DO $$ as its FIRST statement after BEGIN (ROADMAP success #3; V-10)', async () => {
    const fs = await import('node:fs/promises')
    const path = 'supabase/migrations/20260511000000_phase36_layer_c_variants.sql'
    const content = await fs.readFile(path, 'utf8')
    // Strip blank lines and comment-only lines; find the BEGIN; then the next non-blank/non-comment line.
    const lines = content.split('\n')
    let inHeader = true
    let firstStatement: string | null = null
    for (const raw of lines) {
      const line = raw.trim()
      if (line === '') continue
      if (line.startsWith('--')) continue
      if (line === 'BEGIN;') { inHeader = false; continue }
      if (inHeader) continue
      firstStatement = line
      break
    }
    expect(firstStatement).toBeTruthy()
    expect(firstStatement!.startsWith('DO $$')).toBe(true)
  })
})

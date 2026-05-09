/**
 * Phase 34 — Layer A RLS + schema introspection integration tests (CAT-15).
 *
 * ASSUMES DATABASE_URL points to LOCAL Supabase Docker. NEVER export the prod
 * pooler URL before running `npm run test`. Pitfall 4 mitigation below: tests skip
 * if DATABASE_URL doesn't look like localhost.
 *
 * Threats covered:
 *   - T-34-01 (anon write): anon INSERT into brands / watch_families is blocked
 *   - T-34-02 (anon read enabled): has_table_privilege returns true; SELECT works
 *   - T-34-03 (FK orphans): non-existent brand_id INSERT raises FK violation
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

maybe('Phase 34 RLS + schema introspection — brands + watch_families (CAT-15)', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // -------- T-34-02: anon SELECT privilege --------
  it('has_table_privilege: anon can SELECT brands (T-34-02)', async () => {
    const result = await db.execute<{ can: boolean }>(sql`
      SELECT has_table_privilege('anon', 'public.brands', 'SELECT') AS can
    `)
    const row = (result as unknown as Array<{ can: boolean }>)[0]
    expect(row.can).toBe(true)
  })

  it('has_table_privilege: anon can SELECT watch_families (T-34-02)', async () => {
    const result = await db.execute<{ can: boolean }>(sql`
      SELECT has_table_privilege('anon', 'public.watch_families', 'SELECT') AS can
    `)
    const row = (result as unknown as Array<{ can: boolean }>)[0]
    expect(row.can).toBe(true)
  })

  it('anon supabase-js SELECT * FROM brands works (T-34-02)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data, error } = await anon.from('brands').select('*')
    expect(error).toBeNull()
    expect(data).not.toBeNull()
  })

  it('anon supabase-js SELECT * FROM watch_families works (T-34-02)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data, error } = await anon.from('watch_families').select('*')
    expect(error).toBeNull()
    expect(data).not.toBeNull()
  })

  // -------- T-34-01: anon INSERT blocked --------
  it('anon supabase-js INSERT INTO brands fails with RLS (T-34-01)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { error } = await anon.from('brands').insert({ name: 'AnonBrand', slug: 'anon-brand' })
    expect(error).not.toBeNull()
    const errorText = `${error?.code ?? ''} ${error?.message ?? ''}`
    expect(errorText).toMatch(/42501|RLS|policy|permission|not allowed|insufficient/i)
  })

  it('anon supabase-js INSERT INTO watch_families fails with RLS (T-34-01)', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { error } = await anon.from('watch_families').insert({
      brand_id: randomUUID(), name: 'AnonFamily',
    })
    expect(error).not.toBeNull()
    const errorText = `${error?.code ?? ''} ${error?.message ?? ''}`
    expect(errorText).toMatch(/42501|RLS|policy|permission|not allowed|insufficient/i)
  })

  // -------- CAT-15 SC#2: schema introspection --------
  it('watches_catalog.brand_id column exists as nullable uuid', async () => {
    const result = await db.execute<{ data_type: string; is_nullable: string }>(sql`
      SELECT data_type, is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='brand_id'
    `)
    const row = (result as unknown as Array<{ data_type: string; is_nullable: string }>)[0]
    expect(row?.data_type).toBe('uuid')
    expect(row?.is_nullable).toBe('YES')
  })

  it('watches_catalog.family_id column exists as nullable uuid', async () => {
    const result = await db.execute<{ data_type: string; is_nullable: string }>(sql`
      SELECT data_type, is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name='watches_catalog' AND column_name='family_id'
    `)
    const row = (result as unknown as Array<{ data_type: string; is_nullable: string }>)[0]
    expect(row?.data_type).toBe('uuid')
    expect(row?.is_nullable).toBe('YES')
  })

  // -------- CAT-15 SC#1: GENERATED columns --------
  it('brands.name_normalized is GENERATED ALWAYS', async () => {
    const result = await db.execute<{ is_generated: string }>(sql`
      SELECT is_generated FROM information_schema.columns
       WHERE table_schema='public' AND table_name='brands' AND column_name='name_normalized'
    `)
    const row = (result as unknown as Array<{ is_generated: string }>)[0]
    expect(row?.is_generated).toBe('ALWAYS')
  })

  it('watch_families.name_normalized is GENERATED ALWAYS', async () => {
    const result = await db.execute<{ is_generated: string }>(sql`
      SELECT is_generated FROM information_schema.columns
       WHERE table_schema='public' AND table_name='watch_families' AND column_name='name_normalized'
    `)
    const row = (result as unknown as Array<{ is_generated: string }>)[0]
    expect(row?.is_generated).toBe('ALWAYS')
  })

  // -------- T-34-03: FK integrity (orphan prevention) --------
  it('FK integrity: INSERT into watches_catalog with non-existent brand_id fails (T-34-03)', async () => {
    const fakeUuid = randomUUID()
    await expect(
      db.execute(sql`
        INSERT INTO watches_catalog (brand, model, brand_id)
        VALUES ('FK-Test', 'FK-Model-' || gen_random_uuid()::text, ${fakeUuid}::uuid)
      `)
    ).rejects.toThrow()
  })
})

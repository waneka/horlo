import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { sql } from 'drizzle-orm'
import { db } from '@/db'

const maybe = process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? describe : describe.skip

maybe('Phase 17 SECDEF permissions -- CAT-09 + Pitfall 6', () => {
  it('secdef permissions: anon cannot EXECUTE', async () => {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { error } = await anon.rpc('refresh_watches_catalog_counts')
    expect(error).toBeTruthy()
    // Permission-denied OR function-not-exposed error -- either is acceptable for "blocked"
    const message = (error?.message ?? '').toLowerCase()
    const code = error?.code ?? ''
    expect(
      code === '42501' ||
      message.includes('permission denied') ||
      message.includes('not found') ||
      message.includes('does not exist'),
    ).toBe(true)
  })

  it('secdef permissions: has_function_privilege checks anon=false, authenticated=false, service_role=true', async () => {
    const result = await db.execute<{ anon_can: boolean; authed_can: boolean; service_can: boolean }>(sql`
      SELECT
        has_function_privilege('anon',          'public.refresh_watches_catalog_counts()', 'EXECUTE') AS anon_can,
        has_function_privilege('authenticated', 'public.refresh_watches_catalog_counts()', 'EXECUTE') AS authed_can,
        has_function_privilege('service_role',  'public.refresh_watches_catalog_counts()', 'EXECUTE') AS service_can
    `)
    const row = (result as unknown as Array<{ anon_can: boolean; authed_can: boolean; service_can: boolean }>)[0]
    expect(row.anon_can).toBe(false)
    expect(row.authed_can).toBe(false)
    expect(row.service_can).toBe(true)
  })

  it('secdef permissions: service_role can EXECUTE (no throw)', async () => {
    await expect(db.execute(sql`SELECT public.refresh_watches_catalog_counts()`)).resolves.toBeTruthy()
  })

  it('cron job scheduled (skip if no pg_cron locally)', async () => {
    // pg_cron may not be installed on local Supabase Docker
    let hasExtension = false
    try {
      const ext = await db.execute<{ extname: string }>(sql`SELECT extname FROM pg_extension WHERE extname = 'pg_cron'`)
      hasExtension = ((ext as unknown as Array<unknown>).length) > 0
    } catch {
      hasExtension = false
    }

    if (!hasExtension) {
      // Document the skip — local env lacks pg_cron; production has it.
      expect(hasExtension).toBe(false)
      return
    }

    const jobs = await db.execute<{ jobname: string; schedule: string }>(sql`
      SELECT jobname, schedule FROM cron.job WHERE jobname = 'refresh_watches_catalog_counts_daily'
    `)
    const rows = jobs as unknown as Array<{ jobname: string; schedule: string }>
    expect(rows.length).toBe(1)
    expect(rows[0].schedule).toBe('0 3 * * *')
  })
})

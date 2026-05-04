/**
 * Phase 27 schema smoke tests — sort_order column + index existence (WISH-01).
 *
 * Wave 0 RED scaffold landed in Plan 01. Will FAIL today on:
 *   - column does not exist (Plan 02 adds it via drizzle schema)
 *   - watches_user_sort_idx does not exist (Plan 02 adds it via the drizzle migration)
 *
 * Gated on DATABASE_URL so this stays skipped in CI without the local stack
 * (mirrors the tests/integration/phase11-schema.test.ts precedent).
 */
import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'

import { db } from '@/db'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = `p27sc${Date.now().toString(36)}`

maybe(`Phase 27 schema — sort_order column + index existence (WISH-01) [${STAMP}]`, () => {
  it('watches has sort_order column (integer, NOT NULL, DEFAULT 0)', async () => {
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'watches'
         AND column_name = 'sort_order'
    `)
    const rows = (result as unknown as Array<{
      column_name: string
      data_type: string
      is_nullable: string
      column_default: string | null
    }>) ?? []
    const col = rows[0]
    expect(col).toBeDefined()
    expect(col.data_type).toBe('integer')
    expect(col.is_nullable).toBe('NO')
    expect(col.column_default).toMatch(/^0/)
  })

  it('watches_user_sort_idx exists on (user_id, sort_order)', async () => {
    const result = await db.execute(sql`
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'watches'
         AND indexname = 'watches_user_sort_idx'
    `)
    const rows = (result as unknown as Array<{ indexname: string; indexdef: string }>) ?? []
    expect(rows[0]).toBeDefined()
    expect(rows[0].indexdef).toMatch(/user_id.*sort_order/)
  })
})

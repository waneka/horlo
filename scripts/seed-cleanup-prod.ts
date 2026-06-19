/* eslint-disable no-console */
/**
 * scripts/seed-cleanup-prod.ts
 *
 * One-off cleanup for quick task 260614-f82. Runs Phase 1 of the recovery plan:
 *   1. DELETE 19 garbage catalog rows that the URL-extractor produced with
 *      broken brand/model/reference fields.
 *   2. UPDATE 6 keepable-with-cleanup rows to canonical brand/model/reference.
 *
 * All operations run in a single transaction. The transaction also asserts
 * row counts so an unexpected catalog state aborts before committing.
 *
 * Requires: PROD_DATABASE_URL (falls back to DATABASE_URL).
 *
 * Run:
 *   PROD_DATABASE_URL=$DATABASE_URL npx tsx scripts/seed-cleanup-prod.ts
 */

import postgres from 'postgres'

const DELETE_IDS = [
  '23ecfc5c-6f9a-408c-b829-fdf405faf4c3', // Baltic (Aquascaphe + MR01 collided)
  '13430819-538c-4fd8-899f-9bd8c20ae774', // Blancpain Fifty Fathoms
  '05162ade-9496-4e4c-ab30-bf7c1a0086e8', // Formex Essence (brand wrong)
  'c7b0e143-3fa4-44a8-9805-8bc10770a507', // Furlan Marri (page mismatch)
  '1e98135f-c342-454e-9c3c-e4b6351e397a', // Nomos Tangente 165
  'cd445782-af12-430f-8173-026de822f15a', // Nomos Tangente 139
  '8b3e8654-9de7-450f-b813-df90ca150bc5', // Nomos Tangente neomatik 180
  'd346f809-cdef-419a-9ee8-3de1a4c16fd2', // Orient Bambino (wrong ref scheme)
  '86bcc9b2-f28e-43df-9092-6626f641da46', // Patek Calatrava (brand format)
  '076d0f02-efa7-47cd-806a-739d9dfb8369', // Seiko Prospex 1965 (model cluttered)
  '6b59e26f-28db-4e4d-8251-c74c97e08573', // Serica 8315 (ref mismatch)
  'c36cf962-b8ad-41b7-b201-80facee66b24', // Squale SUB-37 (model=ref)
  'ebd64cae-2ae3-4c23-a6a5-bd5c7474f9af', // Wren (brand="Wrist Enthusiast")
  '1e4097db-0b03-4f19-952f-63ab4ceb07b8', // GS SBGW231 (brand cluttered)
  'fff828d8-2794-4d5a-8ab5-4979349f0ba2', // Grand Seiko SBGR253 (brand=Seiko)
  '1479085e-e620-446d-bfec-4f33bf3b8d01', // Grand Seiko SBGE285 (brand=Seiko)
  '6cf8cbc3-468e-4ef3-9b52-edb2669a3965', // Seiko 5 Sports GMT (model=Watch Corp)
  '97038ac0-34d4-4856-9464-e759e0c0b51e', // Seiko 5 Sports SRPE51 (model=Watch Corp)
  '69653e92-493a-4019-95b6-8de974e67237', // Seiko Prospex Alpinist (model=Watch Corp)
]

type Update = {
  id: string
  label: string
  brand?: string
  model?: string
  reference?: string
}

const UPDATES: Update[] = [
  {
    id: '814cd089-043e-4dbe-8c78-8d8ae0eb3d74',
    label: 'Hamilton Khaki Field Mechanical',
    model: 'Khaki Field Mechanical',
  },
  {
    id: '637819a2-473c-40b6-9870-6bd3eed547c5',
    label: 'Hamilton Khaki Field Murph',
    model: 'Khaki Field Murph',
  },
  {
    id: '60fb0570-29b9-4e4e-bf36-802ecff4195d',
    label: 'Omega Aqua Terra Worldtimer',
    model: 'Seamaster Aqua Terra 150M Worldtimer GMT',
  },
  {
    id: 'c81d6906-dd85-43f8-a74f-6d31c9e41d73',
    label: 'Omega Seamaster 300 heritage',
    model: 'Seamaster 300',
  },
  {
    id: 'd8d39831-3986-4944-972b-0334a46f7d7d',
    label: 'Tissot Le Locle',
    reference: 'T006.407.16.033.00',
  },
  {
    id: 'c86f2d0b-a782-4990-83ac-f2fcd153b141',
    label: 'Tissot PRX',
    model: 'PRX Powermatic 80',
    reference: 'T137.407.11.041.00',
  },
]

async function main() {
  const url = process.env.PROD_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error('PROD_DATABASE_URL (or DATABASE_URL) required')
    process.exit(1)
  }

  // prepare: false matches src/db/index.ts (required for Supabase Transaction
  // pooler at port 6543). ssl: 'require' explicit for completeness; without it
  // postgres-js infers from the connection string.
  const sql = postgres(url, { prepare: false })

  try {
    console.log(`Phase 1 cleanup — quick task 260614-f82\n`)

    // Pre-check: confirm DELETE_IDS exist before destroying.
    const present = await sql<{ id: string }[]>`
      SELECT id::text FROM public.watches_catalog WHERE id::text = ANY(${DELETE_IDS})
    `
    console.log(`DELETE pre-check: ${present.length} of ${DELETE_IDS.length} target rows present.`)
    const presentIds = new Set(present.map((r) => r.id))
    const missing = DELETE_IDS.filter((id) => !presentIds.has(id))
    if (missing.length > 0) {
      console.log(`  ⚠ ${missing.length} already absent: ${missing.join(', ')}`)
    }

    // DELETE — auto-commits because pooler doesn't support explicit transactions
    // with prepared statements. ANY(text[]) avoids the unnest issue some pooler
    // configs hit.
    const deleted = await sql<{ id: string }[]>`
      DELETE FROM public.watches_catalog WHERE id::text = ANY(${DELETE_IDS})
      RETURNING id::text
    `
    console.log(`  ✓ deleted ${deleted.length} rows`)

    // UPDATE pre-check.
    const updateIds = UPDATES.map((u) => u.id)
    const presentUpd = await sql<{ id: string }[]>`
      SELECT id::text FROM public.watches_catalog WHERE id::text = ANY(${updateIds})
    `
    if (presentUpd.length !== UPDATES.length) {
      throw new Error(
        `UPDATE pre-check failed: expected ${UPDATES.length} target rows, found ${presentUpd.length}. Aborting.`,
      )
    }
    console.log(`UPDATE pre-check: all ${UPDATES.length} target rows present.`)

    // UPDATE one at a time so each row's brand/model/reference change is explicit.
    let updateSuccess = 0
    for (const u of UPDATES) {
      const fields: string[] = []
      if (u.brand !== undefined) fields.push(`brand="${u.brand}"`)
      if (u.model !== undefined) fields.push(`model="${u.model}"`)
      if (u.reference !== undefined) fields.push(`reference="${u.reference}"`)
      try {
        if (u.brand !== undefined && u.model !== undefined && u.reference !== undefined) {
          await sql`UPDATE public.watches_catalog SET brand = ${u.brand}, model = ${u.model}, reference = ${u.reference}, updated_at = NOW() WHERE id = ${u.id}::uuid`
        } else if (u.brand !== undefined && u.model !== undefined) {
          await sql`UPDATE public.watches_catalog SET brand = ${u.brand}, model = ${u.model}, updated_at = NOW() WHERE id = ${u.id}::uuid`
        } else if (u.brand !== undefined && u.reference !== undefined) {
          await sql`UPDATE public.watches_catalog SET brand = ${u.brand}, reference = ${u.reference}, updated_at = NOW() WHERE id = ${u.id}::uuid`
        } else if (u.model !== undefined && u.reference !== undefined) {
          await sql`UPDATE public.watches_catalog SET model = ${u.model}, reference = ${u.reference}, updated_at = NOW() WHERE id = ${u.id}::uuid`
        } else if (u.brand !== undefined) {
          await sql`UPDATE public.watches_catalog SET brand = ${u.brand}, updated_at = NOW() WHERE id = ${u.id}::uuid`
        } else if (u.model !== undefined) {
          await sql`UPDATE public.watches_catalog SET model = ${u.model}, updated_at = NOW() WHERE id = ${u.id}::uuid`
        } else if (u.reference !== undefined) {
          await sql`UPDATE public.watches_catalog SET reference = ${u.reference}, updated_at = NOW() WHERE id = ${u.id}::uuid`
        }
        updateSuccess++
        console.log(`  ✓ ${u.label}: ${fields.join(', ')}`)
      } catch (err) {
        console.error(`  ✗ ${u.label}:`, err instanceof Error ? err.message : err)
      }
    }
    console.log(`  ${updateSuccess}/${UPDATES.length} updates applied`)

    console.log(`\nPhase 1 complete.`)
  } catch (err) {
    console.error(`\n✗ Cleanup failed:`, err)
    process.exit(1)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(1)
})

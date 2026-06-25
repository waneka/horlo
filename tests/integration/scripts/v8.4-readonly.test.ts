// Phase 78 / 78-03-PLAN.md — GREEN.
//
// Integration invariant: the dry-run NEVER writes to the database (D-78-05).
// Snapshots COUNT(*) and MAX(updated_at) for brands / watch_families /
// watches_catalog before and after running the script; the snapshots MUST
// be identical (no INSERT/UPDATE/DELETE fired).
//
// Gated on DATABASE_URL per the local-first integration idiom (analog:
// tests/integration/migration-drop-archetype.test.ts:26). Without DATABASE_URL
// the suite is described-skipped.

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import * as path from 'node:path'
import postgres from 'postgres'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

const ARTIFACT_PATH = path.join(
  process.cwd(),
  '.planning/v8.4-brand-merge-decisions.md',
)
const BACKUP_PATH = path.join(
  process.cwd(),
  '.planning/v8.4-brand-merge-decisions.md.readonly-test-backup',
)
const SCRIPT_PATH = 'scripts/v8.4-brand-canonicalization.ts'

interface Snapshot {
  brandsCount: number
  watchFamiliesCount: number
  watchesCatalogCount: number
  brandsMaxUpdatedAt: string | null
  watchFamiliesMaxUpdatedAt: string | null
}

maybe('Phase 78 — v8.4-brand-canonicalization read-only invariant (D-78-05)', () => {
  let sql: ReturnType<typeof postgres>
  let preSnapshot: Snapshot
  let postSnapshot: Snapshot

  async function snapshot(): Promise<Snapshot> {
    const [brandsRow] = await sql<{ count: string; max: string | null }[]>`
      SELECT count(*)::text AS count, max(updated_at)::text AS max FROM public.brands
    `
    const [familiesRow] = await sql<{ count: string; max: string | null }[]>`
      SELECT count(*)::text AS count, max(updated_at)::text AS max FROM public.watch_families
    `
    const [catalogRow] = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM public.watches_catalog
    `
    return {
      brandsCount: Number(brandsRow.count),
      watchFamiliesCount: Number(familiesRow.count),
      watchesCatalogCount: Number(catalogRow.count),
      brandsMaxUpdatedAt: brandsRow.max,
      watchFamiliesMaxUpdatedAt: familiesRow.max,
    }
  }

  beforeAll(async () => {
    const connStr = process.env.DATABASE_URL!
    sql = postgres(connStr, { max: 1, prepare: false })

    // Back up any pre-existing artifact.
    if (existsSync(ARTIFACT_PATH)) {
      writeFileSync(BACKUP_PATH, readFileSync(ARTIFACT_PATH, 'utf8'))
    }

    preSnapshot = await snapshot()

    // Spawn the script with --force so it overwrites any backed-up artifact
    // without hitting the refuse-to-overwrite gate.
    const result = spawnSync('npx', ['tsx', SCRIPT_PATH, '--force'], {
      cwd: process.cwd(),
      env: { ...process.env },
      encoding: 'utf8',
    })
    if ((result.status ?? -1) !== 0) {
      throw new Error(
        `script exited ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      )
    }

    postSnapshot = await snapshot()
  }, 60000)

  afterAll(async () => {
    if (sql) {
      await sql.end({ timeout: 5 })
    }
    // Restore the backup if present.
    if (existsSync(BACKUP_PATH)) {
      writeFileSync(ARTIFACT_PATH, readFileSync(BACKUP_PATH, 'utf8'))
      unlinkSync(BACKUP_PATH)
    }
  })

  it('Test 1 — brands count unchanged before vs after script run (D-78-05)', () => {
    expect(postSnapshot.brandsCount).toBe(preSnapshot.brandsCount)
  })

  it('Test 2 — watch_families count unchanged before vs after script run (D-78-05)', () => {
    expect(postSnapshot.watchFamiliesCount).toBe(preSnapshot.watchFamiliesCount)
  })

  it('Test 3 — watches_catalog count unchanged before vs after script run (D-78-05)', () => {
    expect(postSnapshot.watchesCatalogCount).toBe(preSnapshot.watchesCatalogCount)
  })

  it('Test 4 — brands max(updated_at) unchanged (D-78-05: no UPDATE fired)', () => {
    expect(postSnapshot.brandsMaxUpdatedAt).toBe(preSnapshot.brandsMaxUpdatedAt)
  })

  it('Test 5 — watch_families max(updated_at) unchanged (D-78-05: no UPDATE fired)', () => {
    expect(postSnapshot.watchFamiliesMaxUpdatedAt).toBe(
      preSnapshot.watchFamiliesMaxUpdatedAt,
    )
  })
})

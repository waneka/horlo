/**
 * DEBT-12 — repair prod's `drizzle.__drizzle_migrations` journal table.
 *
 * Background: every schema change since the first migration shipped to prod via
 * `supabase db push --linked`, NOT `drizzle-kit migrate`. As a result prod's
 * `drizzle.__drizzle_migrations` table only ever recorded the very first row
 * (idx=0) while the local `drizzle/meta/_journal.json` lists many. A future
 * `drizzle-kit migrate` against prod would therefore try to re-apply every
 * migration whose journal `when` is newer than that single stale row.
 *
 * This one-shot script reconstructs the missing journal rows so the table
 * faithfully reflects the migrations already applied, after which
 * `drizzle-kit migrate` is a clean no-op.
 *
 * How it stays faithful to drizzle:
 *   - It iterates `drizzle/meta/_journal.json` entries (drizzle's own source of
 *     truth) — NOT a glob of `drizzle/*.sql`. Files not in the journal
 *     (e.g. `0003_phase11_wear_events_columns.sql`, `0012_*`) are deliberately
 *     excluded because `drizzle-kit migrate` never considers them.
 *   - For each entry it reads `drizzle/<tag>.sql` and computes
 *     `sha256(fullFileString)` — byte-for-byte the hash drizzle's
 *     `readMigrationFiles` writes (see node_modules/drizzle-orm/migrator.js).
 *   - `created_at` is the entry's `when` (folderMillis), matching the value
 *     the pg dialect inserts (see node_modules/drizzle-orm/pg-core/dialect.js).
 *
 * Idempotency: existing rows are read first; only journal migrations whose hash
 * is absent get inserted. Re-running is a no-op. (The table has no UNIQUE
 * constraint on `hash`, so we dedupe in-app rather than via ON CONFLICT.)
 *
 * SAFETY: dry-run by default. Pass `--apply` to write. It targets whatever
 * DATABASE_URL resolves to — point it at PROD only when you mean to.
 *
 * Usage:
 *   # dry-run against local (proves the script works; writes nothing):
 *   npx tsx --env-file=.env.local scripts/repair-drizzle-journal.ts
 *
 *   # dry-run against PROD (inspect the diff before committing):
 *   DATABASE_URL='<prod-service-role-pooler-url>' npx tsx scripts/repair-drizzle-journal.ts
 *
 *   # apply against PROD:
 *   DATABASE_URL='<prod-service-role-pooler-url>' npx tsx scripts/repair-drizzle-journal.ts --apply
 *
 * Verify afterward: `DATABASE_URL='<prod>' npx drizzle-kit migrate` should report
 * nothing to apply.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

const MIGRATIONS_DIR = path.join(process.cwd(), 'drizzle')
const JOURNAL_PATH = path.join(MIGRATIONS_DIR, 'meta', '_journal.json')
const SCHEMA = 'drizzle'
const TABLE = '__drizzle_migrations'

const APPLY = process.argv.includes('--apply')

interface JournalEntry {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

interface JournalMigration {
  idx: number
  tag: string
  when: number
  hash: string
}

function loadJournalMigrations(): JournalMigration[] {
  if (!fs.existsSync(JOURNAL_PATH)) {
    throw new Error(`Cannot find ${JOURNAL_PATH}`)
  }
  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8')) as { entries: JournalEntry[] }
  return journal.entries
    .slice()
    .sort((a, b) => a.idx - b.idx)
    .map((entry) => {
      const sqlPath = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`)
      if (!fs.existsSync(sqlPath)) {
        throw new Error(`Journal references ${entry.tag} but ${sqlPath} is missing`)
      }
      // Match drizzle's readMigrationFiles exactly: hash the FULL file string.
      const content = fs.readFileSync(sqlPath, 'utf8')
      const hash = crypto.createHash('sha256').update(content).digest('hex')
      return { idx: entry.idx, tag: entry.tag, when: entry.when, hash }
    })
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('[repair-drizzle-journal] FATAL: DATABASE_URL is not set.')
    process.exit(1)
  }

  let host = '(unparseable)'
  try {
    host = new URL(dbUrl).host
  } catch {
    /* leave as unparseable */
  }
  console.log(`[repair-drizzle-journal] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} target-host=${host}`)

  const migrations = loadJournalMigrations()
  const lastIdx = migrations[migrations.length - 1]?.idx
  console.log(
    `[repair-drizzle-journal] ${migrations.length} journal migration(s) (idx ${migrations[0]?.idx}..${lastIdx})`,
  )

  // prepare:false — required for Supabase transaction-mode pooling (mirrors src/db/index.ts).
  const sql = postgres(dbUrl, { prepare: false })
  try {
    // Read-only existence probe so dry-run never writes (not even CREATE IF NOT EXISTS).
    const reg = (await sql.unsafe(
      `SELECT to_regclass('"${SCHEMA}"."${TABLE}"') AS oid`,
    )) as unknown as Array<{ oid: string | null }>
    const tableExists = reg[0]?.oid != null

    if (!tableExists && APPLY) {
      // Create the journal table matching drizzle's own DDL (only when applying).
      await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`)
      await sql.unsafe(
        `CREATE TABLE IF NOT EXISTS "${SCHEMA}"."${TABLE}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
      )
    }

    const existing =
      tableExists
        ? ((await sql.unsafe(
            `SELECT hash, created_at FROM "${SCHEMA}"."${TABLE}"`,
          )) as unknown as Array<{ hash: string; created_at: string | number | null }>)
        : []
    const existingHashes = new Set(existing.map((r) => r.hash))
    console.log(
      `[repair-drizzle-journal] journal table ${tableExists ? `exists with ${existing.length} row(s)` : 'does NOT exist yet'}`,
    )

    const missing = migrations.filter((m) => !existingHashes.has(m.hash))

    console.log('[repair-drizzle-journal] journal vs DB:')
    for (const m of migrations) {
      const status = existingHashes.has(m.hash) ? 'present ' : 'MISSING '
      console.log(`  [${status}] idx=${String(m.idx).padStart(2)}  ${m.tag.padEnd(42)} when=${m.when}`)
    }

    // Surface DB rows that match NO journal migration — file drift or hand-inserted rows.
    const journalHashes = new Set(migrations.map((m) => m.hash))
    const orphans = existing.filter((r) => !journalHashes.has(r.hash))
    if (orphans.length > 0) {
      console.log(
        `[repair-drizzle-journal] WARNING: ${orphans.length} DB row(s) match no journal migration ` +
          `(file content drifted since apply, or hand-inserted). Left untouched:`,
      )
      for (const o of orphans) {
        console.log(`    hash=${String(o.hash).slice(0, 12)}… created_at=${o.created_at}`)
      }
    }

    if (missing.length === 0) {
      console.log('[repair-drizzle-journal] nothing to insert — journal table already complete.')
    } else if (!APPLY) {
      console.log(
        `[repair-drizzle-journal] DRY-RUN: would insert ${missing.length} row(s): ` +
          `${missing.map((m) => m.tag).join(', ')}`,
      )
      console.log('[repair-drizzle-journal] re-run with --apply to write.')
    } else {
      await sql.begin(async (tx) => {
        for (const m of missing) {
          await tx.unsafe(`INSERT INTO "${SCHEMA}"."${TABLE}" ("hash","created_at") VALUES ($1,$2)`, [
            m.hash,
            m.when,
          ])
        }
      })
      console.log(`[repair-drizzle-journal] APPLIED: inserted ${missing.length} row(s).`)
    }

    // Project / confirm the drizzle-kit migrate no-op condition.
    const latestJournalWhen = Math.max(...migrations.map((m) => m.when))
    if (tableExists || APPLY) {
      const after = (await sql.unsafe(
        `SELECT max(created_at) AS max, count(*)::int AS n FROM "${SCHEMA}"."${TABLE}"`,
      )) as unknown as Array<{ max: string | number | null; n: number }>
      const dbMax = after[0]?.max != null ? Number(after[0].max) : null
      const willNoop = dbMax != null && dbMax >= latestJournalWhen
      console.log(
        `[repair-drizzle-journal] table now has ${after[0]?.n} row(s); ` +
          `max(created_at)=${dbMax}; latest journal when=${latestJournalWhen}`,
      )
      console.log(
        `[repair-drizzle-journal] drizzle-kit migrate will be a no-op: ${willNoop ? 'YES' : 'NO'}` +
          `${APPLY ? '' : ' (projected — dry-run wrote nothing)'}`,
      )
    } else {
      console.log(
        `[repair-drizzle-journal] (dry-run) table absent; --apply would create it and insert ` +
          `${migrations.length} row(s), making drizzle-kit migrate a no-op (latest journal when=${latestJournalWhen}).`,
      )
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('[repair-drizzle-journal] fatal:', err)
  process.exit(1)
})

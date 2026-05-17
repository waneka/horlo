/**
 * Phase 44 factual-fill applier — D-03, D-14, ENRH-05.
 * Usage:
 *   npm run db:factual-apply -- --dry-run
 *   npm run db:factual-apply -- --review-file=catalog-factual-review.jsonl
 *   npm run db:factual-apply -- --dry-run --review-file=my-review.jsonl
 *
 * Reads operator-approved JSONL review file (from factual-propose.ts),
 * validates each approved entry (security gate — T-44-08), groups by catalog_id,
 * and emits a 14-digit-timestamped SQL data migration into supabase/migrations/.
 *
 * The LLM never writes factual columns directly — this migration is the only write
 * path and is operator-reviewed (D-01, ENRH-05).
 *
 * --dry-run: print approved-entry count and UPDATE statements to stdout, write NO file.
 *
 * Security (T-44-08/T-44-09):
 *   - movement_type: allow-list enum check (auto|manual|quartz|spring_drive)
 *   - case_size_mm: finite number in sane range [20, 60]
 *   - style_tags: array of strings
 *   - URL fields (image_source_page_url, image_source_url): sanitizeHttpUrl (reject non-http/https)
 *   - Invalid entries are dropped and logged — never emitted to SQL
 */
// Use relative imports — tsx does not resolve @/* path aliases.
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { sanitizeHttpUrl } from '../src/data/catalog'

interface ParsedArgs {
  dryRun: boolean
  reviewFile: string
}

function parseArgs(): ParsedArgs {
  const args = new Map<string, string>(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }))
  return {
    dryRun: args.get('dry-run') === 'true',
    reviewFile: args.get('review-file') ?? 'catalog-factual-review.jsonl',
  }
}

interface ReviewEntry {
  catalog_id: string
  field: 'movement_type' | 'case_size_mm' | 'style_tags' | 'image_source_page_url' | 'image_source_url'
  current: unknown
  proposed: unknown
  source_url: string
  approved: boolean | null
}

/**
 * D-14: Generate a 14-digit-timestamped migration filename.
 * CRITICAL: Supabase CLI silently skips files whose prefix is not exactly 14 digits.
 * Pattern: YYYYMMDDHHMMSS_<suffix>.sql
 */
export function generateMigrationFilename(suffix: string): string {
  const now = new Date()
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')
  return `${ts}_${suffix}.sql`
}

const VALID_MOVEMENT_TYPES = new Set(['auto', 'manual', 'quartz', 'spring_drive'])
const CASE_SIZE_MIN = 20
const CASE_SIZE_MAX = 60

/**
 * Security gate (T-44-08): validate each approved entry by field before SQL emission.
 * Returns the sanitized/validated value or null if invalid (to be dropped).
 */
function validateEntry(entry: ReviewEntry): boolean {
  const { field, proposed } = entry

  switch (field) {
    case 'movement_type': {
      if (proposed === null || proposed === undefined) return true  // null is valid (unknown)
      if (typeof proposed !== 'string') {
        console.error(`[factual-apply] REJECTED ${entry.catalog_id} field=${field}: proposed is not a string: ${JSON.stringify(proposed)}`)
        return false
      }
      if (!VALID_MOVEMENT_TYPES.has(proposed)) {
        console.error(`[factual-apply] REJECTED ${entry.catalog_id} field=${field}: invalid enum value: ${proposed}`)
        return false
      }
      return true
    }

    case 'case_size_mm': {
      if (proposed === null || proposed === undefined) return true  // null is valid (unknown)
      const num = Number(proposed)
      if (!isFinite(num)) {
        console.error(`[factual-apply] REJECTED ${entry.catalog_id} field=${field}: not a finite number: ${JSON.stringify(proposed)}`)
        return false
      }
      if (num < CASE_SIZE_MIN || num > CASE_SIZE_MAX) {
        console.error(`[factual-apply] REJECTED ${entry.catalog_id} field=${field}: out of range [${CASE_SIZE_MIN},${CASE_SIZE_MAX}]: ${num}`)
        return false
      }
      return true
    }

    case 'style_tags': {
      if (!Array.isArray(proposed)) {
        console.error(`[factual-apply] REJECTED ${entry.catalog_id} field=${field}: proposed is not an array: ${JSON.stringify(proposed)}`)
        return false
      }
      for (const tag of proposed) {
        if (typeof tag !== 'string') {
          console.error(`[factual-apply] REJECTED ${entry.catalog_id} field=${field}: array contains non-string: ${JSON.stringify(tag)}`)
          return false
        }
      }
      return true
    }

    case 'image_source_page_url':
    case 'image_source_url': {
      if (proposed === null || proposed === undefined) return true  // null is valid
      if (typeof proposed !== 'string') {
        console.error(`[factual-apply] REJECTED ${entry.catalog_id} field=${field}: proposed is not a string: ${JSON.stringify(proposed)}`)
        return false
      }
      const sanitized = sanitizeHttpUrl(proposed)
      if (sanitized === null) {
        console.error(`[factual-apply] REJECTED ${entry.catalog_id} field=${field}: non-http/https URL rejected: ${proposed}`)
        return false
      }
      return true
    }

    default:
      console.error(`[factual-apply] REJECTED ${entry.catalog_id} field=${field}: unknown field`)
      return false
  }
}

/**
 * Emit a properly-typed SQL literal for a given field's proposed value.
 * Security: values are typed/escaped, never raw LLM strings interpolated into SQL.
 */
function toSqlLiteral(field: ReviewEntry['field'], proposed: unknown): string {
  if (proposed === null || proposed === undefined) return 'NULL'

  switch (field) {
    case 'movement_type':
      // Enum / text: single-quote-escaped
      return `'${String(proposed).replace(/'/g, "''")}'`

    case 'case_size_mm':
      // Number: unquoted
      return String(Number(proposed))

    case 'style_tags': {
      // Text array as ARRAY[...]::text[] or '{}'::text[] for empty
      const arr = proposed as string[]
      if (arr.length === 0) return `'{}'::text[]`
      const escaped = arr.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')
      return `ARRAY[${escaped}]::text[]`
    }

    case 'image_source_page_url':
    case 'image_source_url': {
      // URL: sanitize (already validated) then single-quote-escape
      const sanitized = sanitizeHttpUrl(String(proposed))
      if (!sanitized) return 'NULL'
      return `'${sanitized.replace(/'/g, "''")}'`
    }

    default:
      return 'NULL'
  }
}

/**
 * Map field name in review file to the SQL column name in watches_catalog.
 */
function fieldToColumn(field: ReviewEntry['field']): string {
  const map: Record<string, string> = {
    movement_type: 'movement_type',
    case_size_mm: 'case_size_mm',
    style_tags: 'style_tags',
    image_source_page_url: 'image_source_url',  // D-04: page URL is stored in image_source_url column
    image_source_url: 'image_source_url',
  }
  return map[field] ?? field
}

async function main() {
  const startedAt = Date.now()
  const args = parseArgs()

  if (!existsSync(args.reviewFile)) {
    console.error(`[factual-apply] review file not found: ${args.reviewFile}`)
    process.exit(1)
  }

  const content = await readFile(args.reviewFile, 'utf-8')
  let malformedCount = 0
  const allEntries: ReviewEntry[] = []

  for (const line of content.split('\n').filter(Boolean)) {
    try {
      const entry = JSON.parse(line) as ReviewEntry
      allEntries.push(entry)
    } catch {
      malformedCount++
    }
  }

  if (malformedCount > 0) {
    console.warn(`[factual-apply] skipped ${malformedCount} malformed lines in review file`)
  }

  // Filter: only approved === true entries
  const approvedEntries = allEntries.filter((e) => e.approved === true)
  console.log(`[factual-apply] review file: ${allEntries.length} total entries, ${approvedEntries.length} approved`)

  // Validate each approved entry (T-44-08 security gate)
  const validEntries: ReviewEntry[] = []
  for (const entry of approvedEntries) {
    if (validateEntry(entry)) {
      validEntries.push(entry)
    }
  }

  const rejectedCount = approvedEntries.length - validEntries.length
  if (rejectedCount > 0) {
    console.warn(`[factual-apply] rejected ${rejectedCount} approved entries that failed validation`)
  }

  if (validEntries.length === 0) {
    console.log(`[factual-apply] no valid approved entries — nothing to apply`)
    process.exit(0)
    return
  }

  // Group validated entries by catalog_id — build ONE UPDATE per catalog_id
  const byCatalogId = new Map<string, ReviewEntry[]>()
  for (const entry of validEntries) {
    const existing = byCatalogId.get(entry.catalog_id) ?? []
    existing.push(entry)
    byCatalogId.set(entry.catalog_id, existing)
  }

  // Build UPDATE statements
  const updateStatements: string[] = []
  for (const [catalogId, entries] of byCatalogId) {
    const setClauses = entries.map((e) => {
      const col = fieldToColumn(e.field)
      const val = toSqlLiteral(e.field, e.proposed)
      return `  ${col} = ${val}`
    })
    setClauses.push('  updated_at = now()')

    const stmt = [
      `UPDATE watches_catalog SET`,
      setClauses.join(',\n'),
      `WHERE id = '${catalogId}';`,
    ].join('\n')
    updateStatements.push(stmt)
  }

  if (args.dryRun) {
    console.log(`[factual-apply] DRY RUN — no migration file written`)
    console.log(`[factual-apply]   valid approved entries: ${validEntries.length}`)
    console.log(`[factual-apply]   catalog_ids to update: ${byCatalogId.size}`)
    console.log(``)
    console.log(`-- UPDATE statements that WOULD be emitted:`)
    for (const stmt of updateStatements) {
      console.log(stmt)
      console.log('')
    }
    console.log(`[factual-apply] DRY RUN complete — no file written`)
    process.exit(0)
    return
  }

  // Generate migration file
  const filename = generateMigrationFilename('phase44_factual_data')
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  const filePath = path.join(migrationsDir, filename)

  const header = [
    `-- Phase 44 data migration: factual attributes backfill.`,
    `-- Generated by: npm run db:factual-apply (local run)`,
    `-- Source: Phase 44 CONTEXT.md D-14`,
    `-- Apply: supabase db push --linked (never drizzle-kit push for prod)`,
    `-- Idempotent: each UPDATE is WHERE id = '<uuid>' — re-running is a no-op on already-updated rows.`,
    `-- Rows: ${byCatalogId.size} (${validEntries.length} field updates)`,
    ``,
  ].join('\n')

  const body = `BEGIN;\n\n${updateStatements.join('\n\n')}\n\nCOMMIT;\n`
  await writeFile(filePath, header + body, 'utf-8')

  const elapsedMs = Date.now() - startedAt
  console.log(`[factual-apply] OK — migration written: ${filename}, elapsed: ${elapsedMs}ms`)
  console.log(`[factual-apply]   rows updated: ${byCatalogId.size}, fields: ${validEntries.length}`)
  console.log(`[factual-apply]   apply to prod: supabase db push --linked`)

  process.exit(0)
}

main().catch((err) => {
  console.error('[factual-apply] fatal:', err)
  process.exit(1)
})

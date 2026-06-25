/**
 * Phase 78 MIG-01 — v8.4 Catalog Brand+Model Canonicalization dry-run.
 *
 * Scans `watches_catalog` for distinct `lower(trim(brand))` values, exact-match
 * auto-resolves them against `brands.name_normalized`, pre-computes top 3
 * `pg_trgm` `word_similarity()` candidates above 0.5 for unresolved rows, and
 * writes a GFM table at `.planning/v8.4-brand-merge-decisions.md` for the
 * operator to review.
 *
 * READ-ONLY: this script issues only SELECT statements. NEVER writes to the DB
 * (D-78-05). The only writes are filesystem: the `.md` artifact.
 *
 * Usage (local default):
 *   npm run db:v8.4-brand-canon
 *   (uses --env-file=.env.local; .env.development.local overrides DATABASE_URL
 *    to the local Supabase target when present per CLAUDE.md Local-First)
 *
 * Usage (prod dry-run):
 *   DATABASE_URL=<prod-pooler-url> tsx scripts/v8.4-brand-canonicalization.ts
 *
 * Flags:
 *   --regenerate  Merge operator decisions forward — preserve rows whose
 *                 status is not `needs-review` verbatim; overwrite needs-review
 *                 rows with fresh proposals; append new brand_raws at the bottom.
 *   --force       Overwrite the artifact unconditionally.
 *   (none)        Refuse-to-overwrite per D-78-07. If the file exists, exit
 *                 non-zero with an error message pointing at --regenerate or
 *                 --force. DO NOT remove the file manually — --regenerate is
 *                 the safe recovery path.
 *
 * WRITES: only `.planning/v8.4-brand-merge-decisions.md`. NEVER writes to the DB
 * (D-78-05 enforcement — verified by the integration test in
 * tests/integration/scripts/v8.4-readonly.test.ts which snapshots count(*) +
 * max(updated_at) on brands / watch_families / watches_catalog before and after).
 *
 * Status grammar emitted by the script (per D-78-02):
 *   `auto-resolved`  exact match on brands.name_normalized; proposed_target_id set
 *   `needs-review`   no exact match; operator must edit to merge:<uuid> | new | skip
 * The script never emits `merge:<uuid>`, `new`, or `skip` — those are
 * operator-edited values consumed by Phase 79's --apply parser.
 *
 * R-FIND-02 schema-qualification note:
 *   On prod, pg_trgm + unaccent live in the `extensions` schema, so
 *   `extensions.word_similarity(text, text)` is the prod-correct schema-qualified
 *   call. Locally, the extensions are installed in `public`. To stay portable
 *   across both envs without a hardcoded `extensions.` prefix that fails locally,
 *   the script sets `search_path = public, extensions` once on the fresh
 *   `postgres`-lib connection (which does not inherit the migration-time
 *   `SET LOCAL search_path` baked into the functional trigram indexes). With
 *   search_path including BOTH schemas, unqualified `word_similarity(...)`
 *   resolves correctly in both envs. `public.f_unaccent` is explicit because
 *   the IMMUTABLE wrapper lives in `public` in both envs.
 *
 * Phase 78 contract (consumed by Phase 79's --apply):
 *   GFM-table columns: brand_raw | normalized | proposed_target_id | status |
 *   candidates / notes — per D-78-01.
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import * as path from 'node:path'
import postgres from 'postgres'

const OUTPUT_FILE = path.join(
  process.cwd(),
  '.planning/v8.4-brand-merge-decisions.md',
)
const FUZZY_THRESHOLD = 0.5
const TOP_K = 3

const GFM_HEADER =
  '| brand_raw | normalized | proposed_target_id | status | candidates / notes |'
const GFM_SEPARATOR =
  '| --------- | ---------- | ------------------ | ------ | ------------------ |'

export interface BrandRow {
  brand_raw: string
  brand_normalized: string
  proposed_target_id: string | null
}

export interface Candidate {
  name: string
  score: number
}

export interface ParsedArgs {
  regenerate: boolean
  force: boolean
}

export function parseArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
  const flags = new Set(argv.map((a) => a.replace(/^--/, '')))
  return {
    regenerate: flags.has('regenerate'),
    force: flags.has('force'),
  }
}

/**
 * Sanitize a cell value for GFM emission. `|` characters in brand_raw would
 * silently corrupt the table layout — escape them defensively per T-78-03-01.
 */
export function formatCell(value: string | null | undefined): string {
  if (value == null) return ''
  return String(value).replace(/\|/g, '\\|')
}

/**
 * Build a single GFM table row from a BrandRow + its fuzzy candidates.
 * Status is determined by D-78-04 (exact-only auto-resolve):
 *   proposed_target_id present → auto-resolved
 *   proposed_target_id null    → needs-review
 */
export function buildRow(
  row: BrandRow,
  candidates: Candidate[],
): string {
  const status = row.proposed_target_id ? 'auto-resolved' : 'needs-review'
  const notes = candidates
    .map((c) => `${formatCell(c.name)} (${c.score.toFixed(2)})`)
    .join(', ')
  return [
    formatCell(row.brand_raw),
    formatCell(row.brand_normalized),
    row.proposed_target_id ?? '',
    status,
    notes,
  ]
    .map((cell, i) => (i === 0 ? `| ${cell}` : ` ${cell}`))
    .join(' |')
    .concat(' |')
}

/**
 * Build all GFM table rows (header + separator + data rows).
 * Pure function — no DB access. Exported for unit tests.
 */
export function buildTableRows(
  rows: BrandRow[],
  candidatesByNormalized: Map<string, Candidate[]>,
): string[] {
  const lines: string[] = [GFM_HEADER, GFM_SEPARATOR]
  for (const r of rows) {
    const cands = candidatesByNormalized.get(r.brand_normalized) ?? []
    lines.push(buildRow(r, cands))
  }
  return lines
}

/**
 * Parse an existing GFM artifact into a Map<brand_raw, raw_line> containing
 * only rows whose status is NOT `needs-review` (i.e. operator-edited rows that
 * must be preserved verbatim per D-78-07).
 */
export function parseExistingPreserved(content: string): Map<string, string> {
  const preserved = new Map<string, string>()
  for (const line of content.split('\n')) {
    if (!line.startsWith('|')) continue
    if (line.startsWith('| ---')) continue
    if (line.startsWith('| brand_raw')) continue
    // GFM table row: `| cell1 | cell2 | cell3 | cell4 | cell5 |`
    // Splitting on `|` yields ['', ' cell1 ', ' cell2 ', ..., ' cell5 ', '']
    const cells = line.split('|').map((c) => c.trim())
    const brandRaw = cells[1]
    const status = cells[4]
    if (brandRaw && status && status !== 'needs-review') {
      preserved.set(brandRaw, line)
    }
  }
  return preserved
}

/**
 * Merge-forward (D-78-07): given existing artifact contents and a fresh set of
 * rows, produce the new table lines. Operator-edited rows (status !=
 * needs-review) are preserved verbatim; fresh rows for new brand_raws are
 * appended.
 */
export function mergeForward(
  existingContent: string,
  freshRows: BrandRow[],
  candidatesByNormalized: Map<string, Candidate[]>,
): string[] {
  const preserved = parseExistingPreserved(existingContent)
  const seenInFresh = new Set<string>()
  const lines: string[] = [GFM_HEADER, GFM_SEPARATOR]
  for (const r of freshRows) {
    seenInFresh.add(r.brand_raw)
    const preservedLine = preserved.get(r.brand_raw)
    if (preservedLine) {
      lines.push(preservedLine)
    } else {
      const cands = candidatesByNormalized.get(r.brand_normalized) ?? []
      lines.push(buildRow(r, cands))
    }
  }
  // Edge case: brand_raws preserved in the existing file but NOT in the fresh
  // result set (e.g. the operator removed the catalog row between runs). Keep
  // them in place so the operator's decision isn't silently dropped — append
  // them at the bottom after the fresh rows.
  for (const [brandRaw, line] of preserved) {
    if (!seenInFresh.has(brandRaw)) {
      lines.push(line)
    }
  }
  return lines
}

function buildHeader(): string {
  const now = new Date().toISOString().slice(0, 10)
  return [
    `# v8.4 Brand Merge Decisions`,
    ``,
    `> Generated ${now} by scripts/v8.4-brand-canonicalization.ts — READ-ONLY.`,
    `> Edit \`status\` cells to lock decisions: auto-resolved | merge:<uuid> | new | skip | needs-review`,
    `> Phase 79's --apply consumes this file. Unknown status values cause Phase 79 to refuse the run.`,
    `>`,
    `> DO NOT remove this file between runs. Use --regenerate to merge operator decisions`,
    `> forward; the script preserves any row whose status is not \`needs-review\` verbatim.`,
    ``,
    ``,
  ].join('\n')
}

async function main() {
  const args = parseArgs()

  // D-78-07: refuse-to-overwrite when artifact exists and operator didn't pass
  // --regenerate or --force.
  if (existsSync(OUTPUT_FILE) && !args.regenerate && !args.force) {
    console.error(
      `[v8.4-brand-canon] ERROR: ${OUTPUT_FILE} already exists.\n` +
        `Pass --regenerate to merge operator decisions forward, or --force to overwrite from scratch.\n` +
        `DO NOT remove the file manually — --regenerate is the safe recovery path.`,
    )
    process.exit(1)
  }

  const connStr = process.env.DATABASE_URL
  if (!connStr) {
    console.error(
      '[v8.4-brand-canon] ERROR: DATABASE_URL is not set.\n' +
        'Use the local default via `npm run db:v8.4-brand-canon`, or supply a prod URL inline.',
    )
    process.exit(1)
  }

  const sql = postgres(connStr, { max: 1, prepare: false })

  try {
    // Set search_path to resolve `word_similarity` regardless of which schema
    // hosts pg_trgm in this env (prod=extensions, local=public). The fresh
    // postgres-lib connection does not inherit the migration-time
    // `SET LOCAL search_path = public, extensions` that baked into the
    // functional trigram indexes. Without this SET, the per-row fuzzy lookup
    // below would fail with `42883 function does not exist` on the env where
    // pg_trgm is NOT in the default search_path. R-FIND-02.
    await sql.unsafe(`SET search_path = public, extensions, pg_catalog`)

    // Stage 1 + 2 — distinct catalog brands LEFT JOIN brands on exact normalized
    // match. wc.brand_normalized + b.name_normalized are both GENERATED via
    // `lower(trim(name))` so the equality match is robust across whitespace +
    // case variation. DISTINCT ON collapses multiple raw spellings to one
    // emitted row per normalized value... but per B-78-01 we want BOTH `Omega`
    // and `OMEGA` raw strings to surface in the artifact (case-mismatch is a
    // catalog-drift signal even when both legitimately auto-resolve to the
    // same canonical brands row). Use plain DISTINCT on (brand, normalized,
    // proposed_target_id) so case-variants emit one row each.
    const rows = await sql<BrandRow[]>`
      SELECT DISTINCT
        wc.brand AS brand_raw,
        wc.brand_normalized,
        b.id AS proposed_target_id
      FROM public.watches_catalog wc
      LEFT JOIN public.brands b ON b.name_normalized = wc.brand_normalized
      ORDER BY wc.brand_normalized, wc.brand ASC
    `

    // Stage 3 — Fuzzy candidates ≥ FUZZY_THRESHOLD for unresolved rows. One
    // query per unresolved brand (~3-6 expected per R-FIND-04) — small enough
    // that a per-row loop is faster + simpler than an IN-list and sidesteps
    // [[drizzle-sql-any-array-pitfall]] entirely. Folds via public.f_unaccent
    // so 'Héron' and 'Heron' produce the same score.
    const candidatesByNormalized = new Map<string, Candidate[]>()
    for (const r of rows.filter((row) => row.proposed_target_id === null)) {
      // Skip duplicate fuzzy work if multiple raw strings normalize to the same
      // value (defensive — DISTINCT ON sidesteps this in practice).
      if (candidatesByNormalized.has(r.brand_normalized)) continue
      const cands = await sql<{ name_normalized: string; score: number }[]>`
        SELECT
          name_normalized,
          word_similarity(
            lower(public.f_unaccent(${r.brand_normalized})),
            lower(public.f_unaccent(name_normalized))
          ) AS score
        FROM public.brands
        WHERE word_similarity(
                lower(public.f_unaccent(${r.brand_normalized})),
                lower(public.f_unaccent(name_normalized))
              ) > ${FUZZY_THRESHOLD}
        ORDER BY score DESC
        LIMIT ${TOP_K}
      `
      candidatesByNormalized.set(
        r.brand_normalized,
        cands.map((c) => ({ name: c.name_normalized, score: Number(c.score) })),
      )
    }

    // Stage 4 — compose final artifact.
    let tableLines: string[]
    if (args.regenerate && existsSync(OUTPUT_FILE)) {
      const existing = await readFile(OUTPUT_FILE, 'utf8')
      tableLines = mergeForward(existing, rows, candidatesByNormalized)
    } else {
      tableLines = buildTableRows(rows, candidatesByNormalized)
    }

    await mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
    await writeFile(
      OUTPUT_FILE,
      buildHeader() + tableLines.join('\n') + '\n',
      'utf8',
    )

    const autoResolvedCount = rows.filter((r) => r.proposed_target_id).length
    const needsReviewCount = rows.length - autoResolvedCount
    console.log(
      `[v8.4-brand-canon] wrote ${OUTPUT_FILE} (${rows.length} brand rows, ` +
        `${autoResolvedCount} auto-resolved, ${needsReviewCount} needs-review)`,
    )
  } finally {
    await sql.end()
  }
}

// Only invoke main when executed directly (allows test imports without spawning
// the CLI side-effect).
const invokedDirectly = process.argv[1] && /v8\.4-brand-canonicalization\.ts$/.test(process.argv[1])
if (invokedDirectly) {
  main().catch((err) => {
    console.error('[v8.4-brand-canon] fatal:', err)
    process.exit(1)
  })
}

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
import * as readline from 'node:readline/promises'
import postgres from 'postgres'

const OUTPUT_FILE = path.join(
  process.cwd(),
  '.planning/v8.4-brand-merge-decisions.md',
)
// Phase 79 Plan 03 — family-mode artifact path (analog of OUTPUT_FILE; symmetric
// refuse-to-overwrite + --regenerate gate per D-78-07).
const FAMILY_OUTPUT_FILE = path.join(
  process.cwd(),
  '.planning/v8.4-family-merge-decisions.md',
)
const FUZZY_THRESHOLD = 0.5
const TOP_K = 3

const GFM_HEADER =
  '| brand_raw | normalized | proposed_target_id | status | candidates / notes |'
const GFM_SEPARATOR =
  '| --------- | ---------- | ------------------ | ------ | ------------------ |'

// Phase 79 Plan 03 — family GFM table (6 cells; leading `brand` column per
// 79-PATTERNS L551-572).
const GFM_FAMILY_HEADER =
  '| brand | family_raw | normalized | proposed_target_id | status | candidates / notes |'
const GFM_FAMILY_SEPARATOR =
  '| ----- | ---------- | ---------- | ------------------ | ------ | ------------------ |'

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
  // Phase 79 extensions (Plan 02 lands brand-only apply scaffold; Plans 03 + 04
  // wire the family + hydration + post-flight steps inside one outer sql.begin).
  apply: boolean
  mode: 'brands' | 'families' | 'both'
}

const VALID_MODES = new Set<ParsedArgs['mode']>(['brands', 'families', 'both'])

export function parseArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
  // Flags = bare boolean switches like `--apply`. The `--mode=value` form is
  // handled separately so we can extract its value.
  const flags = new Set(
    argv
      .filter((a) => a.startsWith('--') && !a.includes('='))
      .map((a) => a.replace(/^--/, '')),
  )
  const modeArg = argv.find((a) => a.startsWith('--mode='))
  const modeValue = modeArg ? modeArg.slice('--mode='.length) : 'brands'
  if (!VALID_MODES.has(modeValue as ParsedArgs['mode'])) {
    throw new Error(
      `[v8.4-brand-canon] invalid --mode=${modeValue}; expected one of brands|families|both`,
    )
  }
  return {
    regenerate: flags.has('regenerate'),
    force: flags.has('force'),
    apply: flags.has('apply'),
    mode: modeValue as ParsedArgs['mode'],
  }
}

/**
 * D-79-02 — local-vs-prod URL detection. Parses `DATABASE_URL` and returns true
 * only for the canonical local Supabase Postgres host:port (127.0.0.1:54322 or
 * localhost:54322). Any other host, alt-port, or unparseable string returns
 * false — the interactive `yes` prompt fires before any write. Safety bias is
 * intentional per Pitfall in 79-RESEARCH.md.
 */
export function isLocalDatabaseUrl(connStr: string): boolean {
  try {
    const url = new URL(connStr)
    return url.host === '127.0.0.1:54322' || url.host === 'localhost:54322'
  } catch {
    // Unparseable URL (or empty string) — fail closed (treat as prod).
    return false
  }
}

/**
 * Slug generator for new `brands.name` rows inserted by Phase 79's apply path.
 * Matches the established slug shape in the existing `brands` table (53 rows
 * inspected). 3 LOC per 79-PATTERNS.md L292-294.
 */
export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Apply-summary block printed to stdout before the prod confirmation prompt.
 * Plan 02 only populates the brand fields; Plans 03 + 04 fill in family /
 * hydration / alias counts.
 */
export interface ApplySummary {
  brandsToCreate: number
  catalogRowsToResolve: number
  familiesToCreate: number
  userWatchesToHydrate: number
  aliasesToAppend: number
}

/**
 * D-79-02 — interactive prod confirmation gate. Silent on local Supabase
 * (isLocalDatabaseUrl === true). On any other host, prints the summary block
 * and reads `yes` from stdin via node:readline/promises; declines exit 1.
 *
 * NOTE: this process.exit is OUTSIDE any sql.begin callback (the apply path
 * calls confirmIfProd BEFORE opening the transaction). Pitfall 2 satisfied.
 */
async function confirmIfProd(connStr: string, summary: ApplySummary): Promise<void> {
  if (isLocalDatabaseUrl(connStr)) return
  let hostLabel = '(unparseable)'
  try {
    hostLabel = new URL(connStr).host
  } catch {
    /* fall through */
  }
  console.log(`
[v8.4-brand-canon] APPLY against PROD detected (${hostLabel}). Summary:
  - Brands to create:        ${summary.brandsToCreate}
  - Catalog rows to resolve: ${summary.catalogRowsToResolve}
  - Families to create:      ${summary.familiesToCreate}
  - User watches to hydrate: ${summary.userWatchesToHydrate}
  - Aliases to append:       ${summary.aliasesToAppend}
`)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question('Type "yes" to proceed: ')
    if (answer.trim() !== 'yes') {
      console.error('[v8.4-brand-canon] Operator declined. Exiting without write.')
      process.exit(1)
    }
  } finally {
    rl.close()
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

// ============================================================
// Phase 79 — apply-path types + helpers (Plan 02 lands brand-only scope; Plans
// 03 + 04 extend with family + hydration + post-flight).
// ============================================================

/**
 * In-memory resolution state for a brand decision after the operator-edited
 * file is parsed. 'new' is the placeholder shape that lives only between
 * parse-time and Step 4.1 (INSERT new brands) — after Step 4.1 every entry is
 * reified to 'existing'. The invariant check after Step 4.1 throws if any 'new'
 * remains, per Pitfall 3.
 */
export type ResolvedBrand =
  | { kind: 'existing'; uuid: string; canonicalName: string }
  | { kind: 'merge'; uuid: string; canonicalName: string }
  | { kind: 'new'; syntheticKey: string; rawName: string }

/**
 * Map: lower(trim(brand_raw)) → ResolvedBrand. Insertion order preserved (used
 * for deterministic INSERT ordering in tests). Per RESEARCH Pattern 2 + D-79-07.
 */
export type BrandDecisionMap = Map<string, ResolvedBrand>

/** Parsed row from `.planning/v8.4-brand-merge-decisions.md`. */
export interface BrandDecisionRow {
  brand_raw: string
  brand_normalized: string
  proposed_target_id: string | null
  status: string
}

const MERGE_RE = /^merge:[0-9a-f-]{36}$/i
const VALID_BRAND_STATUSES = new Set(['auto-resolved', 'new'])

/**
 * Parse the brand-merge-decisions.md file into BrandDecisionRow[]. Mirrors the
 * `parseExistingPreserved` shape (L155-171) — ignores non-pipe lines, GFM
 * separator (`| ---`), and the header (`| brand_raw`).
 *
 * Cell layout per the Phase 78 GFM artifact:
 *   cells[1] = brand_raw
 *   cells[2] = brand_normalized
 *   cells[3] = proposed_target_id  (empty string → null)
 *   cells[4] = status
 *   cells[5] = candidates / notes  (ignored by parser; only the apply needs 1-4)
 */
export function parseDecisionsTable(content: string): BrandDecisionRow[] {
  const rows: BrandDecisionRow[] = []
  for (const line of content.split('\n')) {
    if (!line.startsWith('|')) continue
    if (line.startsWith('| ---')) continue
    if (line.startsWith('| brand_raw')) continue
    const cells = line.split('|').map((c) => c.trim())
    const brandRaw = cells[1]
    const brandNormalized = cells[2]
    const proposedTargetIdRaw = cells[3]
    const status = cells[4]
    if (!brandRaw || !brandNormalized || !status) continue
    rows.push({
      brand_raw: brandRaw,
      brand_normalized: brandNormalized,
      proposed_target_id: proposedTargetIdRaw === '' ? null : proposedTargetIdRaw,
      status,
    })
  }
  return rows
}

/**
 * Convert parsed BrandDecisionRow[] to the in-memory BrandDecisionMap consumed
 * by the apply path. Status grammar (per D-78-02 + D-79-09):
 *   auto-resolved          → kind:'existing' (uuid = proposed_target_id)
 *   merge:<uuid>           → kind:'merge'    (uuid extracted from status)
 *   new                    → kind:'new'      (syntheticKey = brand_normalized;
 *                                              rawName = brand_raw)
 *   skip / needs-review    → throw (not supported in Phase 79; operator must
 *                                    resolve to one of the terminal statuses
 *                                    before --apply)
 */
export function buildBrandMap(rows: BrandDecisionRow[]): BrandDecisionMap {
  const map: BrandDecisionMap = new Map()
  for (const row of rows) {
    const key = row.brand_normalized
    if (row.status === 'auto-resolved') {
      if (!row.proposed_target_id) {
        throw new Error(
          `[v8.4-brand-canon] buildBrandMap: brand "${row.brand_raw}" status=auto-resolved but proposed_target_id is empty`,
        )
      }
      map.set(key, {
        kind: 'existing',
        uuid: row.proposed_target_id,
        canonicalName: row.brand_raw,
      })
    } else if (MERGE_RE.test(row.status)) {
      const uuid = row.status.slice('merge:'.length)
      map.set(key, { kind: 'merge', uuid, canonicalName: row.brand_raw })
    } else if (row.status === 'new') {
      map.set(key, {
        kind: 'new',
        syntheticKey: row.brand_normalized,
        rawName: row.brand_raw,
      })
    } else {
      throw new Error(
        `[v8.4-brand-canon] buildBrandMap: brand "${row.brand_raw}" has unsupported status "${row.status}". ` +
          `Resolve to one of: auto-resolved | merge:<uuid> | new`,
      )
    }
  }
  return map
}

// ============================================================
// Phase 79 Plan 03 — family-side types + pure helpers (D-79-05 + D-79-06 +
// D-79-07 + MIG-03). All non-DB; live next to the brand-side analogs for
// symmetry. Apply-time DB helpers (familyDryRun, applyFamilyPath) live further
// down so the pure surface stays grouped at the top of the script.
// ============================================================

/**
 * Pre-status family row shape — emitted by the dry-run BEFORE the operator
 * assigns a status. Mirrors BrandRow but is brand-scoped: a family is uniquely
 * identified by (canonical_brand, model_normalized) per the
 * watch_families_brand_name_unique constraint.
 */
export interface FamilyRow {
  brand_raw: string
  family_raw: string
  family_normalized: string
  proposed_target_id: string | null
  candidates: Candidate[]
}

/** Parsed row from `.planning/v8.4-family-merge-decisions.md` (operator-edited). */
export interface FamilyDecisionRow extends FamilyRow {
  status: string
}

/**
 * In-memory resolution state for a family decision after the operator-edited
 * file is parsed. Family-side analog of ResolvedBrand. The 'new' shape carries
 * the resolved brand UUID (so Step 4.3 INSERT has the parent FK ready) and a
 * synthetic key for the apply-time reify-loop.
 */
export type ResolvedFamily =
  | { kind: 'existing'; uuid: string; canonicalName: string }
  | { kind: 'merge'; uuid: string; canonicalName: string; sourceModelRaw: string }
  | { kind: 'new'; syntheticKey: string; rawName: string; brandUuid: string }

/**
 * Map: `${brand_norm}|${model_norm}` composite key → ResolvedFamily.
 * Composite because families are brand-scoped per the watch_families unique
 * constraint. Insertion-order preserved for deterministic INSERT ordering.
 * Per RESEARCH Pattern 2 + D-79-07.
 */
export type FamilyDecisionMap = Map<string, ResolvedFamily>

/**
 * Operator-decision view of a family row — narrower than ResolvedFamily, used
 * by applyFamilyPath to drive the Step 4.3 INSERT loop and Step 4.4 alias loop.
 */
export type FamilyDecision =
  | { kind: 'new'; brandUuid: string; name: string; compositeKey: string }
  | { kind: 'merge'; targetUuid: string; sourceModelRaw: string; compositeKey: string }

const VALID_FAMILY_STATUSES = new Set(['auto-resolved', 'new'])

/**
 * Build a single GFM family table row. 6 cells: brand_raw | family_raw |
 * family_normalized | proposed_target_id | status | candidates / notes.
 * Reuses formatCell from the brand side.
 */
export function buildFamilyRow(row: FamilyRow, status: string): string {
  const notes = row.candidates
    .map((c) => `${formatCell(c.name)} (${c.score.toFixed(2)})`)
    .join(', ')
  return [
    formatCell(row.brand_raw),
    formatCell(row.family_raw),
    formatCell(row.family_normalized),
    row.proposed_target_id ?? '',
    status,
    notes,
  ]
    .map((cell, i) => (i === 0 ? `| ${cell}` : ` ${cell}`))
    .join(' |')
    .concat(' |')
}

/**
 * Build all family GFM table lines (header + separator + data rows).
 * Pure function — no DB access. Exported for unit tests + apply-path consumers.
 */
export function buildFamilyTableRows(rows: FamilyDecisionRow[]): string[] {
  const lines: string[] = [GFM_FAMILY_HEADER, GFM_FAMILY_SEPARATOR]
  for (const r of rows) {
    lines.push(buildFamilyRow(r, r.status))
  }
  return lines
}

/**
 * Parse `.planning/v8.4-family-merge-decisions.md` into FamilyDecisionRow[].
 *
 * Cell layout per 79-PATTERNS L566-569:
 *   cells[1] = brand_raw
 *   cells[2] = family_raw
 *   cells[3] = family_normalized
 *   cells[4] = proposed_target_id (empty → null)
 *   cells[5] = status
 *   cells[6] = candidates / notes (parsed into Candidate[] via score regex)
 */
const CANDIDATE_RE = /(.+?) \((\d\.\d+)\)/g
export function parseFamilyDecisionsTable(content: string): FamilyDecisionRow[] {
  const rows: FamilyDecisionRow[] = []
  for (const line of content.split('\n')) {
    if (!line.startsWith('|')) continue
    if (line.startsWith('| ---')) continue
    if (line.startsWith('| brand ')) continue
    if (line.startsWith('| brand_raw')) continue // defensive — wrong-shape line
    const cells = line.split('|').map((c) => c.trim())
    const brandRaw = cells[1]
    const familyRaw = cells[2]
    const familyNormalized = cells[3]
    const proposedTargetIdRaw = cells[4]
    const status = cells[5]
    const candidatesRaw = cells[6] ?? ''
    if (!brandRaw || !familyRaw || !familyNormalized || !status) continue
    const candidates: Candidate[] = []
    let m: RegExpExecArray | null
    CANDIDATE_RE.lastIndex = 0
    while ((m = CANDIDATE_RE.exec(candidatesRaw)) !== null) {
      candidates.push({ name: m[1].trim(), score: Number(m[2]) })
    }
    rows.push({
      brand_raw: brandRaw,
      family_raw: familyRaw,
      family_normalized: familyNormalized,
      proposed_target_id: proposedTargetIdRaw === '' ? null : proposedTargetIdRaw,
      status,
      candidates,
    })
  }
  return rows
}

/**
 * Composite-key helper: split `${brand_norm}|${model_norm}` on the FIRST `|`.
 * Using indexOf rather than .split() so model values containing `|` (escaped in
 * the GFM layer per formatCell) round-trip correctly.
 */
export function parseCompositeKey(key: string): {
  brandNorm: string
  modelNorm: string
} {
  const i = key.indexOf('|')
  if (i < 0) {
    throw new Error(
      `[v8.4-brand-canon] parseCompositeKey: missing '|' separator in "${key}"`,
    )
  }
  return { brandNorm: key.slice(0, i), modelNorm: key.slice(i + 1) }
}

/**
 * Build the in-memory FamilyDecisionMap from parsed FamilyDecisionRow[].
 *
 * Composite key: `${lower(trim(row.brand_raw))}|${row.family_normalized}`.
 *
 * D-79-07 in-memory brand→family chain: when a brand_raw resolves to an
 * 'existing' or 'merge' ResolvedBrand, we look up the canonical brand UUID via
 * brandMap and stamp it onto the family row's resolved entry. When the brand is
 * still 'new' (placeholder pre-INSERT), we forward the syntheticKey — apply-time
 * reify-loop replaces it with the real UUID after Step 4.1.
 *
 * Hamilton + Hamilton Watch BRAND merge collapse: both brand_raws lookup to
 * the SAME canonical brand uuid via brandMap → the same family row appears
 * only ONCE in the family file because the dry-run query already collapses on
 * canonical brand_id (see familyDryRun Stage 1). buildFamilyMap is the
 * in-memory mirror — operator-edited file with two source-brand-raw lines for
 * the same canonical (brand, model) tuple still build into ONE map entry
 * keyed on `${lower(trim(canonical_brand))}|${family_normalized}`.
 *
 * Status grammar (per D-78-02 + D-79-09):
 *   auto-resolved          → kind:'existing' (uuid = proposed_target_id)
 *   merge:<uuid>           → kind:'merge'    (uuid extracted; sourceModelRaw = row.family_raw)
 *   new                    → kind:'new'      (syntheticKey = compositeKey;
 *                                              brandUuid resolved via brandMap;
 *                                              rawName = row.family_raw)
 *   skip / needs-review    → throw (strict gate refuses BEFORE we get here, but
 *                                    defense-in-depth)
 */
export function buildFamilyMap(
  rows: FamilyDecisionRow[],
  brandMap: BrandDecisionMap,
): FamilyDecisionMap {
  const map: FamilyDecisionMap = new Map()
  for (const row of rows) {
    const brandNorm = row.brand_raw.toLowerCase().trim()
    const compositeKey = `${brandNorm}|${row.family_normalized}`

    // Look up the canonical brand identity (D-79-07 in-memory chain).
    const resolvedBrand = brandMap.get(brandNorm)
    if (!resolvedBrand) {
      throw new Error(
        `[v8.4-brand-canon] buildFamilyMap: family "${row.family_raw}" references brand "${row.brand_raw}" ` +
          `(normalized "${brandNorm}") not present in brand decisions map. ` +
          `Re-run --regenerate --mode=brands to refresh the brand file before --mode=families.`,
      )
    }

    if (row.status === 'auto-resolved') {
      if (!row.proposed_target_id) {
        throw new Error(
          `[v8.4-brand-canon] buildFamilyMap: family "${row.family_raw}" status=auto-resolved ` +
            `but proposed_target_id is empty`,
        )
      }
      map.set(compositeKey, {
        kind: 'existing',
        uuid: row.proposed_target_id,
        canonicalName: row.family_raw,
      })
    } else if (MERGE_RE.test(row.status)) {
      const uuid = row.status.slice('merge:'.length)
      map.set(compositeKey, {
        kind: 'merge',
        uuid,
        canonicalName: row.family_raw,
        sourceModelRaw: row.family_raw,
      })
    } else if (row.status === 'new') {
      // Forward whichever brand UUID we have:
      //   - existing/merge → real brands.id
      //   - new            → syntheticKey placeholder; applyFamilyPath reifies
      //                       it AFTER applyBrandPath's Step 4.1 patches the
      //                       brand map to 'existing'.
      const brandUuid =
        resolvedBrand.kind === 'new'
          ? resolvedBrand.syntheticKey
          : resolvedBrand.uuid
      map.set(compositeKey, {
        kind: 'new',
        syntheticKey: compositeKey,
        rawName: row.family_raw,
        brandUuid,
      })
    } else {
      throw new Error(
        `[v8.4-brand-canon] buildFamilyMap: family "${row.family_raw}" has unsupported status "${row.status}". ` +
          `Resolve to one of: auto-resolved | merge:<uuid> | new`,
      )
    }
  }
  return map
}

/**
 * D-79-01 — strict pre-flight gate. Plan 02 landed the brand-only refuse
 * cases; Plan 03 extends with the parallel family refuse cases (per
 * 79-CONTEXT.md L44-49). Refuses on any drift between the operator-edited
 * decisions files and the live catalog state:
 *
 *   BRAND SCOPE:
 *   (a) any brand row with status='needs-review' (operator didn't finish)
 *   (b) any brand row with an unknown status token (per D-78-02 grammar)
 *   (c) any brand merge:<uuid> target missing from brands.id
 *   (d) any live catalog brand absent from the brand decisions file
 *
 *   FAMILY SCOPE (Plan 03):
 *   (a-family) any family row with status='needs-review'
 *   (b-family) any family row with an unknown status token
 *   (c-family) any family merge:<uuid> target missing from watch_families.id
 *   (d-family) any live catalog (brand_norm, model_norm) triple absent from
 *               the family decisions file
 *
 * Both existence-check fns are dependency-injected so unit tests can stub
 * the DB existence checks without a live connection (per PATTERNS L361-370).
 *
 * Per 79-RESEARCH § Pitfall 3 + [[drizzle-sql-any-array-pitfall]]: the
 * live-catalog DISTINCT queries interpolate ONLY string scalars; no array
 * goes into any template literal. The existence-check DB queries live
 * behind their respective fn parameters so the SQL syntax there is the
 * caller's responsibility (main() callsites use the postgres-lib `sql(uuids)`
 * helper form, NOT the array-spread anti-pattern flagged by
 * [[drizzle-sql-any-array-pitfall]]).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlTagBrandNormalized = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Array<{ brand_normalized: string }>>

// Family-side live-catalog SELECT returns (brand_norm, model_norm) pairs.
type SqlTagFamilyTriple = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Array<{ brand_normalized: string; model_normalized: string }>>

export async function strictPreflightGate(
  sql: SqlTagBrandNormalized,
  brandRows: BrandDecisionRow[],
  existingBrandIdsFn: (uuids: string[]) => Promise<Set<string>>,
  familyRows: FamilyDecisionRow[] = [],
  existingFamilyIdsFn: (uuids: string[]) => Promise<Set<string>> = async () =>
    new Set<string>(),
): Promise<void> {
  // ----- BRAND SCOPE -----
  // (a) + (b) — every brand row must be terminal + grammar-valid.
  for (const row of brandRows) {
    if (row.status === 'needs-review') {
      throw new Error(
        `[v8.4-brand-canon] STRICT GATE: brand "${row.brand_raw}" has status=needs-review. ` +
          `Edit .planning/v8.4-brand-merge-decisions.md to lock a terminal status ` +
          `(auto-resolved | merge:<uuid> | new), then re-run --apply.`,
      )
    }
    if (!VALID_BRAND_STATUSES.has(row.status) && !MERGE_RE.test(row.status)) {
      throw new Error(
        `[v8.4-brand-canon] STRICT GATE: brand "${row.brand_raw}" has unresolved status "${row.status}". ` +
          `Expected one of: auto-resolved | merge:<uuid> | new. ` +
          `Edit .planning/v8.4-brand-merge-decisions.md and re-run --apply.`,
      )
    }
  }

  // (c) — every brand merge:<uuid> target must exist in brands.id.
  const brandMergeUuids = brandRows
    .filter((r) => MERGE_RE.test(r.status))
    .map((r) => r.status.slice('merge:'.length))
  if (brandMergeUuids.length > 0) {
    const existingSet = await existingBrandIdsFn(brandMergeUuids)
    for (const uuid of brandMergeUuids) {
      if (!existingSet.has(uuid)) {
        throw new Error(
          `[v8.4-brand-canon] STRICT GATE: merge:${uuid} target not found in brands table. ` +
            `Edit the decision file to point at a valid brand id, or change the row's status to 'new'.`,
        )
      }
    }
  }

  // (d) — live catalog brand_normalized values must all appear in the decisions file.
  const liveBrands = await sql`
    SELECT DISTINCT lower(trim(brand)) AS brand_normalized FROM watches_catalog
  `
  const decidedBrands = new Set(brandRows.map((r) => r.brand_normalized))
  for (const live of liveBrands) {
    if (!decidedBrands.has(live.brand_normalized)) {
      throw new Error(
        `[v8.4-brand-canon] STRICT GATE: catalog has brand "${live.brand_normalized}" not present in decisions file. ` +
          `Re-run --regenerate to merge-forward the new brand row, edit it to a terminal status, then re-try --apply.`,
      )
    }
  }

  // ----- FAMILY SCOPE (Plan 03) -----
  // Skip if no family rows were supplied (Plan 02 brand-only callsite path).
  if (familyRows.length === 0) return

  // (a-family) + (b-family) — every family row must be terminal + grammar-valid.
  for (const row of familyRows) {
    if (row.status === 'needs-review') {
      throw new Error(
        `[v8.4-brand-canon] STRICT GATE: family "${row.brand_raw} / ${row.family_raw}" has status=needs-review. ` +
          `Edit .planning/v8.4-family-merge-decisions.md to lock a terminal status ` +
          `(auto-resolved | merge:<uuid> | new), then re-run --apply.`,
      )
    }
    if (!VALID_FAMILY_STATUSES.has(row.status) && !MERGE_RE.test(row.status)) {
      throw new Error(
        `[v8.4-brand-canon] STRICT GATE: family "${row.brand_raw} / ${row.family_raw}" has unknown status "${row.status}". ` +
          `Expected one of: auto-resolved | merge:<uuid> | new. ` +
          `Edit .planning/v8.4-family-merge-decisions.md and re-run --apply.`,
      )
    }
  }

  // (c-family) — every family merge:<uuid> target must exist in watch_families.id.
  const familyMergeUuids = familyRows
    .filter((r) => MERGE_RE.test(r.status))
    .map((r) => r.status.slice('merge:'.length))
  if (familyMergeUuids.length > 0) {
    const existingFamilySet = await existingFamilyIdsFn(familyMergeUuids)
    for (const uuid of familyMergeUuids) {
      if (!existingFamilySet.has(uuid)) {
        throw new Error(
          `[v8.4-brand-canon] STRICT GATE: family merge:${uuid} target not found in watch_families table. ` +
            `Edit the family decision file to point at a valid family id, or change the row's status to 'new'.`,
        )
      }
    }
  }

  // (d-family) — live catalog (brand_norm, model_norm) triples must all appear
  // in the family decisions file. Compose the live-triple set via a single
  // DISTINCT SELECT; compose decided-triple set via in-memory map over
  // familyRows. Composite key for both: `${brand_norm}|${model_norm}`.
  const liveTriples = await (sql as unknown as SqlTagFamilyTriple)`
    SELECT DISTINCT
      lower(trim(c.brand)) AS brand_normalized,
      lower(trim(c.model)) AS model_normalized
    FROM watches_catalog c
  `
  const decidedTriples = new Set(
    familyRows.map(
      (r) => `${r.brand_raw.toLowerCase().trim()}|${r.family_normalized}`,
    ),
  )
  for (const live of liveTriples) {
    const key = `${live.brand_normalized}|${live.model_normalized}`
    if (!decidedTriples.has(key)) {
      throw new Error(
        `[v8.4-brand-canon] STRICT GATE: catalog has (brand, model) family triple "${key}" not present in family decisions file. ` +
          `Re-run --regenerate --mode=families to merge-forward the new family row, edit it to a terminal status, then re-try --apply.`,
      )
    }
  }
}

/**
 * D-79-04 — idempotent re-run gate. Fires BEFORE the strict gate (cheaper exit
 * on no-op re-run). Returns 'already-applied' if every catalog row already has
 * brand_id AND family_id resolved; else 'proceed'.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlTagCount = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Array<{ count: string }>>

async function idempotentReRunGate(
  sql: SqlTagCount,
): Promise<'already-applied' | 'proceed'> {
  const [row] = await sql`
    SELECT count(*)::text AS count
    FROM watches_catalog
    WHERE brand_id IS NULL OR family_id IS NULL
  `
  if (Number(row.count) === 0) {
    console.log('[v8.4-brand-canon] Already applied — nothing to do. Exiting.')
    return 'already-applied'
  }
  return 'proceed'
}

// Postgres-lib runtime: every tagged-template call returns a thenable that
// resolves to an array-like with a `.count` (rows affected) property. The
// type below is wide enough to cover both INSERT ... RETURNING (Array<row>)
// and UPDATE (Array<row> + count). We cast on the consuming side.
type SqlTagBrandInsert = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Array<{ id: string }>>

interface UpdateResult {
  count: number
}

/**
 * Phase 79 apply path — BRAND-ONLY scope (Plan 02). Plans 03 + 04 wire the
 * family + alias + hydration + post-flight steps inside one outer sql.begin
 * transaction; Plan 02 lands the brand-only scaffold here so the path can be
 * verified end-to-end against a local DB before the full transaction lands.
 *
 * Step 4.1 — for each brandMap entry with kind='new', INSERT a row into
 *            brands (name, slug, needs_review=false) RETURNING id and reify
 *            the map entry to kind='existing' with the freshly-allocated UUID.
 *            needs_review=false per D-79-09 — the operator marking the row
 *            'new' IS the approval signal.
 * Invariant: after Step 4.1, NO map entry may remain kind='new'. Throw a
 *            clear diagnostic if one does (Pitfall 3 — the post-flight assertion
 *            in Plan 04 would catch the downstream effect, but this invariant
 *            gives the right error message at the source).
 * Step 4.2 — for each [brandNorm, resolved] of brandMap.entries(), UPDATE
 *            watches_catalog SET brand_id = resolved.uuid
 *            WHERE lower(trim(brand)) = brandNorm
 *              AND (brand_id IS NULL OR brand_id <> resolved.uuid).
 *            The trailing predicate makes the UPDATE a no-op when brand_id is
 *            already correct (re-run safety + threat T-79-04).
 *
 * Returns counts for the Plan 04 POST-DEPLOY summary artifact.
 *
 * NOTE: `tx` is the sql.begin callback parameter (postgres-lib's transaction-
 * scoped sql tag). Throwing here triggers ROLLBACK; resolving COMMITs.
 * NEVER call process.exit() inside this function — Pitfall 2.
 */
async function applyBrandPath(
  tx: SqlTagBrandInsert,
  brandMap: BrandDecisionMap,
): Promise<{ brandsCreated: number; catalogRowsResolvedBrand: number }> {
  let brandsCreated = 0
  let catalogRowsResolvedBrand = 0

  // Step 4.1 — INSERT new brands; reify map entries.
  for (const [brandNorm, resolved] of brandMap.entries()) {
    if (resolved.kind !== 'new') continue
    const [row] = await tx`
      INSERT INTO brands (name, slug, needs_review)
      VALUES (${resolved.rawName}, ${slugify(resolved.rawName)}, false)
      RETURNING id
    `
    brandMap.set(brandNorm, {
      kind: 'existing',
      uuid: row.id,
      canonicalName: resolved.rawName,
    })
    brandsCreated++
  }

  // Pitfall 3 invariant: every map entry must now carry a UUID. If a 'new'
  // remains, Step 4.2 would interpolate `undefined` into the UPDATE and the
  // post-flight assertion downstream would catch it as a row-count mismatch.
  // Throw here with the clearer source-of-truth diagnostic.
  for (const v of brandMap.values()) {
    if (v.kind === 'new') {
      throw new Error(
        '[v8.4-brand-canon] applyBrandPath: brandMap not reified after Step 4.1 ' +
          '(one or more entries still carry kind=new). This is a bug.',
      )
    }
  }

  // Step 4.2 — UPDATE watches_catalog.brand_id. Per-row loop because the 53-row
  // catalog scale doesn't merit bulk VALUES, and per-row sidesteps the
  // [[drizzle-sql-any-array-pitfall]] entirely.
  for (const [brandNorm, resolved] of brandMap.entries()) {
    // Type-narrow: the invariant above guarantees no kind='new' remains, but
    // TS flow analysis can't carry that through a for-of loop. The runtime
    // guard makes the narrowing explicit and gives a clear error if the
    // invariant somehow drifts.
    if (resolved.kind === 'new') {
      throw new Error(
        `[v8.4-brand-canon] applyBrandPath Step 4.2: brand "${brandNorm}" still kind=new after Step 4.1 invariant. This is a bug.`,
      )
    }
    const resolvedUuid = resolved.uuid
    const result = (await tx`
      UPDATE watches_catalog
      SET brand_id = ${resolvedUuid}
      WHERE lower(trim(brand)) = ${brandNorm}
        AND (brand_id IS NULL OR brand_id <> ${resolvedUuid})
    `) as unknown as UpdateResult
    catalogRowsResolvedBrand += result.count
  }

  return { brandsCreated, catalogRowsResolvedBrand }
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

/**
 * Phase 79 Plan 03 — family-side artifact header (symmetric with buildHeader).
 * Cites --mode=families generation + --apply --mode=both consumption per
 * 79-PATTERNS L555-564.
 */
function buildFamilyHeader(): string {
  const now = new Date().toISOString().slice(0, 10)
  return [
    `# v8.4 Family Merge Decisions`,
    ``,
    `> Generated ${now} by scripts/v8.4-brand-canonicalization.ts --mode=families — READ-ONLY.`,
    `> Edit \`status\` cells to lock decisions: auto-resolved | merge:<uuid> | new | skip | needs-review`,
    `> Phase 79's --apply --mode=both consumes this file. Unknown status values cause Phase 79 to refuse the run.`,
    `>`,
    `> DO NOT remove this file between runs. Use --regenerate --mode=families to merge operator`,
    `> decisions forward; the script preserves any row whose status is not \`needs-review\` verbatim.`,
    ``,
    ``,
  ].join('\n')
}

/**
 * Phase 79 Plan 03 — internal helper: parse the family file's preserved rows
 * (operator-edited; status != needs-review) so --regenerate can merge-forward.
 * Returns Map<compositeKey, raw_line>. Mirror of parseExistingPreserved L252-268.
 */
function parseExistingFamilyPreserved(content: string): Map<string, string> {
  const preserved = new Map<string, string>()
  for (const line of content.split('\n')) {
    if (!line.startsWith('|')) continue
    if (line.startsWith('| ---')) continue
    if (line.startsWith('| brand ')) continue
    if (line.startsWith('| brand_raw')) continue
    const cells = line.split('|').map((c) => c.trim())
    const brandRaw = cells[1]
    const familyNormalized = cells[3]
    const status = cells[5]
    if (brandRaw && familyNormalized && status && status !== 'needs-review') {
      const key = `${brandRaw.toLowerCase().trim()}|${familyNormalized}`
      preserved.set(key, line)
    }
  }
  return preserved
}

/**
 * Phase 79 Plan 03 — --mode=families dry-run path (D-79-05 + D-79-07 read-only
 * invariant). Reads the operator-edited brand decisions file in-memory (no
 * brand --apply required per D-79-07 Option 2), queries the live catalog
 * scoped through the canonical brand identity from BrandDecisionMap, runs
 * word_similarity fuzzy candidates for unresolved family rows, and emits the
 * GFM table at `.planning/v8.4-family-merge-decisions.md`.
 *
 * Issues only SELECT statements (D-79-05). Verified by Phase 78
 * v8.4-readonly.test.ts (which spawns the script with --force — but the
 * default --mode=brands path; the family read-only invariant is identical
 * by construction since this function uses the same SELECT-only idiom).
 *
 * Per [[pg-trgm-word-similarity-for-brand-typos]] + R-FIND-02 search_path
 * workaround: word_similarity is unqualified; the apply-time SET search_path
 * resolves it across local (public) and prod (extensions). Uses
 * public.f_unaccent for diacritic folding.
 */
type SqlTagFamilyDryRun = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<
  Array<{
    brand_raw: string
    family_raw: string
    brand_normalized: string
    family_normalized: string
    proposed_target_id: string | null
    parent_brand_id: string | null
  }>
>

async function familyDryRun(
  sql: SqlTagFamilyDryRun,
  brandMap: BrandDecisionMap,
  args: ParsedArgs,
): Promise<void> {
  // Refuse-to-overwrite gate on FAMILY_OUTPUT_FILE (mirror buildHeader gate).
  if (existsSync(FAMILY_OUTPUT_FILE) && !args.regenerate && !args.force) {
    console.error(
      `[v8.4-brand-canon] ERROR: ${FAMILY_OUTPUT_FILE} already exists.\n` +
        `Pass --regenerate --mode=families to merge operator decisions forward, or --force to overwrite from scratch.\n` +
        `DO NOT remove the file manually — --regenerate is the safe recovery path.`,
    )
    process.exit(1)
  }

  // Stage 1 — distinct catalog (brand_raw, model_raw, brand_norm, model_norm)
  // LEFT JOIN brands LEFT JOIN watch_families. Brand-side dedup: the JOIN
  // scopes through the canonical brand_id, so Hamilton + Hamilton Watch
  // catalog rows resolve through the SAME brands.id and produce ONE family
  // row per (canonical_brand_id, model_normalized) tuple.
  const rows = await sql`
    SELECT DISTINCT
      c.brand AS brand_raw,
      c.model AS family_raw,
      c.brand_normalized,
      c.model_normalized AS family_normalized,
      wf.id AS proposed_target_id,
      b.id AS parent_brand_id
    FROM public.watches_catalog c
    LEFT JOIN public.brands b ON b.name_normalized = c.brand_normalized
    LEFT JOIN public.watch_families wf
      ON wf.brand_id = b.id AND wf.name_normalized = c.model_normalized
    ORDER BY c.brand_normalized, c.model_normalized, c.brand, c.model
  `

  // Stage 2 — collapse cross-brand-raw duplicates via BrandDecisionMap.
  // Multiple catalog brand_raws that resolve to the SAME canonical brand
  // (e.g. Hamilton + Hamilton Watch via brandMap) produce ONE family row per
  // (canonical_brand_id, model_normalized) tuple. We key dedup by canonical
  // brand IDENTITY (UUID when known, synthetic name otherwise) rather than
  // brand_norm string — because a `merge:<uuid>` entry's brand_raw is the
  // SOURCE name (e.g. 'Hamilton Watch'), not the target canonical name. Two
  // rows with the same target UUID + same model_normalized collapse to ONE
  // emitted family row per D-79-07.
  //
  // To present a stable canonical brand name in the artifact's leading
  // column, we also look up the canonical name from the FIRST 'existing' row
  // we see for each canonical UUID (the merge's brand_raw is the source name,
  // not the target name).
  const canonicalNameByUuid = new Map<string, string>()
  for (const [brandNorm, resolved] of brandMap.entries()) {
    if (resolved.kind === 'existing') {
      // The 'existing' (auto-resolved) row's canonicalName IS the canonical
      // brand name — Hamilton, not Hamilton Watch.
      canonicalNameByUuid.set(resolved.uuid, resolved.canonicalName)
    } else if (resolved.kind === 'new') {
      // Synthetic identity: use the raw name as canonical display. Synthetic
      // identifier as the dedup ID.
      canonicalNameByUuid.set(`synthetic:${brandNorm}`, resolved.rawName)
    }
    // 'merge' entries do NOT contribute a canonical name (their canonicalName
    // is the source raw, not the target canonical). They share the same UUID
    // as an 'existing' entry, which DOES contribute the canonical name above.
  }

  type FamilyDedupKey = string
  const dedup = new Map<FamilyDedupKey, FamilyRow>()
  for (const r of rows) {
    const brandNorm = r.brand_normalized
    const resolvedBrand = brandMap.get(brandNorm)
    // Canonical brand identity for dedup: real UUID for existing/merge, synthetic
    // marker for 'new' (apply time reifies to a real UUID).
    let canonicalBrandId: string
    let canonicalBrandName: string
    if (resolvedBrand && resolvedBrand.kind !== 'new') {
      canonicalBrandId = resolvedBrand.uuid
      canonicalBrandName =
        canonicalNameByUuid.get(resolvedBrand.uuid) ?? resolvedBrand.canonicalName
    } else if (resolvedBrand && resolvedBrand.kind === 'new') {
      canonicalBrandId = `synthetic:${brandNorm}`
      canonicalBrandName = resolvedBrand.rawName
    } else {
      // Brand-side drift (not in brandMap) — the strict gate refuses before
      // --apply, but during the family dry-run we still emit the row so the
      // operator sees what's outstanding. Use the raw brand string as identity.
      canonicalBrandId = `unknown:${brandNorm}`
      canonicalBrandName = r.brand_raw
    }
    const dedupKey: FamilyDedupKey = `${canonicalBrandId}|${r.family_normalized}`
    if (dedup.has(dedupKey)) continue
    dedup.set(dedupKey, {
      brand_raw: canonicalBrandName,
      family_raw: r.family_raw,
      family_normalized: r.family_normalized,
      proposed_target_id: r.proposed_target_id,
      candidates: [],
    })
  }
  const familyRows = Array.from(dedup.values())

  // Stage 3 — fuzzy candidate suggestions for unresolved family rows. Per row,
  // query watch_families scoped to the canonical brand_id (looked up via
  // brandMap). Uses word_similarity > FUZZY_THRESHOLD with public.f_unaccent
  // diacritic folding per [[pg-trgm-word-similarity-for-brand-typos]].
  for (const row of familyRows) {
    if (row.proposed_target_id) continue
    const resolvedBrand = brandMap.get(row.brand_raw.toLowerCase().trim())
    // Skip fuzzy lookup if the resolved brand is 'new' (the brand isn't in
    // brands yet, so it can have no families — no candidates exist).
    if (!resolvedBrand || resolvedBrand.kind === 'new') continue
    const brandUuid = resolvedBrand.uuid
    const cands = await (sql as unknown as (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => Promise<Array<{ name_normalized: string; score: number }>>)`
      SELECT
        name_normalized,
        word_similarity(
          lower(public.f_unaccent(${row.family_normalized})),
          lower(public.f_unaccent(name_normalized))
        ) AS score
      FROM public.watch_families
      WHERE brand_id = ${brandUuid}
        AND word_similarity(
              lower(public.f_unaccent(${row.family_normalized})),
              lower(public.f_unaccent(name_normalized))
            ) > ${FUZZY_THRESHOLD}
      ORDER BY score DESC
      LIMIT ${TOP_K}
    `
    row.candidates = cands.map((c) => ({
      name: c.name_normalized,
      score: Number(c.score),
    }))
  }

  // Stage 4 — compose artifact. --regenerate path preserves operator-edited
  // rows verbatim; default path emits fresh.
  let tableLines: string[]
  const freshDecisionRows: FamilyDecisionRow[] = familyRows.map((r) => ({
    ...r,
    status: r.proposed_target_id ? 'auto-resolved' : 'needs-review',
  }))
  if (args.regenerate && existsSync(FAMILY_OUTPUT_FILE)) {
    const existing = await readFile(FAMILY_OUTPUT_FILE, 'utf8')
    const preserved = parseExistingFamilyPreserved(existing)
    const seenInFresh = new Set<string>()
    const lines: string[] = [GFM_FAMILY_HEADER, GFM_FAMILY_SEPARATOR]
    for (const r of freshDecisionRows) {
      const key = `${r.brand_raw.toLowerCase().trim()}|${r.family_normalized}`
      seenInFresh.add(key)
      const preservedLine = preserved.get(key)
      if (preservedLine) {
        lines.push(preservedLine)
      } else {
        lines.push(buildFamilyRow(r, r.status))
      }
    }
    // Edge case (mirror brand mergeForward): preserved rows whose composite key
    // is no longer in the fresh result set — keep them in place so operator
    // decisions aren't silently dropped.
    for (const [key, line] of preserved) {
      if (!seenInFresh.has(key)) {
        lines.push(line)
      }
    }
    tableLines = lines
  } else {
    tableLines = buildFamilyTableRows(freshDecisionRows)
  }

  await mkdir(path.dirname(FAMILY_OUTPUT_FILE), { recursive: true })
  await writeFile(
    FAMILY_OUTPUT_FILE,
    buildFamilyHeader() + tableLines.join('\n') + '\n',
    'utf8',
  )

  const autoResolvedCount = familyRows.filter((r) => r.proposed_target_id).length
  const needsReviewCount = familyRows.length - autoResolvedCount
  console.log(
    `[v8.4-brand-canon] wrote ${FAMILY_OUTPUT_FILE} (${familyRows.length} family rows, ` +
      `${autoResolvedCount} auto-resolved, ${needsReviewCount} needs-review)`,
  )
}

async function main() {
  const args = parseArgs()

  // Phase 79 Pitfall 7: --apply REQUIRES --mode=both. Without the both gate,
  // brands resolve but families don't; the post-flight assertion catches it
  // (resolved_family !== total → rollback) but the diagnostic is confusing.
  // Surface the mistake before any DB connection opens.
  if (args.apply && args.mode !== 'both') {
    console.error(
      '[v8.4-brand-canon] ERROR: --apply requires --mode=both. ' +
        `Got --mode=${args.mode}. Re-run with --apply --mode=both.`,
    )
    process.exit(1)
  }

  // D-78-07: refuse-to-overwrite when the brand artifact exists and operator
  // didn't pass --regenerate or --force. SKIPPED on --apply (the apply path
  // READS the existing file) AND SKIPPED on --mode=families (which has its
  // own refuse-to-overwrite gate inside familyDryRun for FAMILY_OUTPUT_FILE).
  if (
    !args.apply &&
    args.mode === 'brands' &&
    existsSync(OUTPUT_FILE) &&
    !args.regenerate &&
    !args.force
  ) {
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

    // ====================================================================
    // Phase 79 Plan 03 — --mode=families dry-run dispatch (D-79-05 + D-79-07).
    // Read-only: emits .planning/v8.4-family-merge-decisions.md from the
    // operator-edited brand decisions file + live catalog. Does NOT require
    // brand --apply to have run first (Option 2 — in-memory brand→family
    // chain per D-79-07). Hard-error if brand file is missing.
    // ====================================================================
    if (!args.apply && args.mode === 'families') {
      if (!existsSync(OUTPUT_FILE)) {
        console.error(
          `[v8.4-brand-canon] ERROR: brand decisions file not found at ${OUTPUT_FILE}.\n` +
            `Run \`npm run db:v8.4-brand-canon\` (--mode=brands default) first to generate it, ` +
            `then re-run --mode=families.`,
        )
        process.exit(1)
      }
      const brandContent = await readFile(OUTPUT_FILE, 'utf8')
      const brandRows = parseDecisionsTable(brandContent)
      const brandMap = buildBrandMap(brandRows)
      await familyDryRun(
        sql as unknown as Parameters<typeof familyDryRun>[0],
        brandMap,
        args,
      )
      return
    }

    // ====================================================================
    // Phase 79 apply-path dispatch (Plan 02 lands brand-only scope; Plans
    // 03 + 04 extend with family + alias + hydration + post-flight inside
    // one outer sql.begin per D-79-03). Falls through to the Phase 78
    // dry-run path when --apply is not set, preserving 100% backward
    // compatibility (npm run db:v8.4-brand-canon with no flags still works
    // exactly as Phase 78 shipped).
    // ====================================================================
    if (args.apply) {
      // D-79-04 idempotent re-run gate — fires BEFORE strict gate (cheaper
      // exit on a no-op re-run). Re-running --apply after a successful apply
      // logs "Already applied" and returns 0 without any DB writes.
      const gateStatus = await idempotentReRunGate(
        sql as unknown as SqlTagCount,
      )
      if (gateStatus === 'already-applied') {
        return // sql.end() fires in finally; clean exit 0
      }

      // Read the operator-edited decisions file. Strict gate refuses on drift
      // BEFORE the transaction opens, so any error here surfaces cleanly with
      // no rollback needed.
      const brandContent = await readFile(OUTPUT_FILE, 'utf8')
      const brandRows = parseDecisionsTable(brandContent)

      // D-79-01 strict pre-flight gate (brand-only scope in Plan 02; Plan 03
      // adds the parallel family checks before the transaction opens).
      const existingBrandIdsFn = async (uuids: string[]): Promise<Set<string>> => {
        // Postgres-lib helper form: sql(uuids) expands the array as an IN-list
        // parameter binding. Documented forward armor against
        // [[drizzle-sql-any-array-pitfall]] — the array-spread anti-pattern
        // is BANNED in this script.
        const rows = await sql<{ id: string }[]>`
          SELECT id FROM brands WHERE id IN ${sql(uuids)}
        `
        return new Set(rows.map((r) => r.id))
      }
      await strictPreflightGate(
        sql as unknown as Parameters<typeof strictPreflightGate>[0],
        brandRows,
        existingBrandIdsFn,
      )

      // Build the in-memory BrandDecisionMap (D-79-07). Plan 03 will build the
      // parallel FamilyDecisionMap from a NEW family-merge-decisions.md file.
      const brandMap = buildBrandMap(brandRows)

      // Plan 02 hard gate: only --mode=brands lands the brand-only apply
      // scaffold. --mode=families and --mode=both throw a clear "implemented
      // in Plan 03/04" error so an operator running the partial script gets
      // a precise diagnostic instead of a partial/broken transaction.
      if (args.mode === 'families' || args.mode === 'both') {
        throw new Error(
          `[v8.4-brand-canon] --mode=${args.mode} apply path lands in Plans 03 + 04. ` +
            `Plan 02 implements --mode=brands only (the brand-only apply scaffold).`,
        )
      }

      // D-79-02 interactive prod confirmation. Silent on local Supabase; reads
      // 'yes' from stdin on any other host. Plan 02's summary only populates
      // brand fields; Plans 03 + 04 fill in family / hydration / alias counts.
      const newBrandsToCreate = Array.from(brandMap.values()).filter(
        (v) => v.kind === 'new',
      ).length
      const distinctCatalogBrands = brandMap.size
      await confirmIfProd(connStr, {
        brandsToCreate: newBrandsToCreate,
        catalogRowsToResolve: distinctCatalogBrands,
        familiesToCreate: 0,
        userWatchesToHydrate: 0,
        aliasesToAppend: 0,
      })

      // Plan 02 scope — brand-only apply inside its OWN sql.begin. Plan 04
      // RESTRUCTURES this to wrap brand + family + alias + hydration +
      // post-flight in ONE outer sql.begin per D-79-03. Leave the seam clear:
      // the brand-only transaction here is TRANSIENT and will be removed.
      const counts = await sql.begin(async (tx) => {
        return await applyBrandPath(
          tx as unknown as SqlTagBrandInsert,
          brandMap,
        )
      })

      console.log(
        `[v8.4-brand-canon] Plan 02 brand apply complete: ` +
          `${counts.brandsCreated} brands created, ` +
          `${counts.catalogRowsResolvedBrand} catalog rows resolved (brand_id).`,
      )
      return // skip the Phase 78 dry-run path below
    }
    // ====================================================================
    // Phase 78 dry-run path (unchanged) — runs when --apply is NOT set.
    // ====================================================================

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

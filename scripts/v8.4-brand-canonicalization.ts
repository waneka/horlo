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
// Phase 79 Plan 04 — D-79-10 POST-DEPLOY artifact path. The script auto-writes
// this file AFTER a successful --apply --mode=both transaction commits (post-
// success only; never on rollback path). Lives under the phase-79 directory
// per the operator-audit convention (mirror Phase 78's 78-POST-DEPLOY.md
// location).
const POST_DEPLOY_PATH = path.join(
  process.cwd(),
  '.planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md',
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
 * Slug generator — now extracted to src/lib/slug.ts (Phase 80 Plan 01).
 * Imported locally for in-file callers; re-exported for backward compatibility.
 * New callers should import directly from '@/lib/slug'.
 */
import { slugify } from '@/lib/slug'
export { slugify }

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
  // in the family decisions file. Composite key normalizes by CANONICAL brand
  // identity (UUID) not raw brand_norm, because Plan 03's familyDryRun dedups
  // the family file via canonical-brand-identity (D-79-07) — Hamilton +
  // Hamilton Watch collapse to ONE bucket under the canonical Hamilton brand.
  // Composing the live triple by raw `lower(trim(brand))` would produce
  // `hamilton watch|...` which would never match the deduped family file's
  // `Hamilton|...`. Key both sides by `${canonical_brand_uuid_or_synthetic}|
  // ${model_norm}` per the same identity rule familyDryRun uses.
  const brandMap = buildBrandMap(brandRows)
  // canonicalIdentityForBrandNorm: brand_normalized → canonical identity used
  // for triple keying. Mirrors familyDryRun Stage 2 logic verbatim so the
  // strict gate and the dry-run agree on identity.
  const canonicalIdentityForBrandNorm = (brandNorm: string): string => {
    const resolved = brandMap.get(brandNorm)
    if (resolved && resolved.kind !== 'new') return resolved.uuid
    if (resolved && resolved.kind === 'new')
      return `synthetic:${brandNorm}`
    // Brand-side drift (live catalog brand not in brandRows). Mirror the
    // dry-run's `unknown:${brandNorm}` identity so the triple-not-found error
    // surfaces with the same shape; strict-gate (d) brand-side check above
    // would have already caught this.
    return `unknown:${brandNorm}`
  }
  // Build a brand_norm → display-canonical-name map for diagnostic messages.
  const canonicalNameByBrandNorm = new Map<string, string>()
  for (const [bn, resolved] of brandMap.entries()) {
    if (resolved.kind === 'existing' || resolved.kind === 'merge') {
      // For 'merge' entries, the canonical display name comes from the
      // 'existing' entry that shares the same UUID — look it up.
      if (resolved.kind === 'existing') {
        canonicalNameByBrandNorm.set(bn, resolved.canonicalName)
      }
    } else if (resolved.kind === 'new') {
      canonicalNameByBrandNorm.set(bn, resolved.rawName)
    }
  }
  // Second pass: backfill 'merge' entries with the canonical name from the
  // 'existing' sibling that owns the same UUID.
  const canonicalNameByUuid = new Map<string, string>()
  for (const resolved of brandMap.values()) {
    if (resolved.kind === 'existing') {
      canonicalNameByUuid.set(resolved.uuid, resolved.canonicalName)
    }
  }
  for (const [bn, resolved] of brandMap.entries()) {
    if (resolved.kind === 'merge') {
      const canonical = canonicalNameByUuid.get(resolved.uuid)
      if (canonical) canonicalNameByBrandNorm.set(bn, canonical)
    }
  }

  const liveTriples = await (sql as unknown as SqlTagFamilyTriple)`
    SELECT DISTINCT
      lower(trim(c.brand)) AS brand_normalized,
      lower(trim(c.model)) AS model_normalized
    FROM watches_catalog c
  `
  const decidedTriples = new Set(
    familyRows.map(
      (r) =>
        `${canonicalIdentityForBrandNorm(r.brand_raw.toLowerCase().trim())}|${r.family_normalized}`,
    ),
  )
  for (const live of liveTriples) {
    const canonicalId = canonicalIdentityForBrandNorm(live.brand_normalized)
    const key = `${canonicalId}|${live.model_normalized}`
    if (!decidedTriples.has(key)) {
      const canonicalDisplay =
        canonicalNameByBrandNorm.get(live.brand_normalized) ??
        live.brand_normalized
      throw new Error(
        `[v8.4-brand-canon] STRICT GATE: catalog has (brand, model) family triple "${canonicalDisplay}|${live.model_normalized}" ` +
          `(live brand_raw=${live.brand_normalized}) not present in family decisions file. ` +
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

/**
 * Phase 79 Plan 03 — apply path family side. Defined here so Plan 04 can wire
 * it into the unified outer `sql.begin` transaction (D-79-03) without further
 * code-shape changes. Plan 03 ships the function definition + invariants;
 * Plan 04 owns the call.
 *
 * Three-step sequence per RESEARCH § Code Examples L727-770:
 *
 * Step 4.3 — for each familyMap entry with kind='new':
 *   INSERT INTO watch_families (brand_id, name, needs_review, aliases)
 *     VALUES (brandUuid, rawName, false, '{}'::text[])  RETURNING id
 *   needs_review=false per D-79-09 (operator marking 'new' IS the approval).
 *   Reify the map entry to kind='existing' with the freshly-allocated UUID.
 *   Pitfall 3 invariant: throw if any kind='new' remains after Step 4.3.
 *
 * Step 4.4 — for each entry with kind='merge':
 *   UPDATE watch_families
 *     SET aliases = aliases || ARRAY[sourceNorm]::text[]
 *     WHERE id = targetUuid AND NOT (aliases @> ARRAY[sourceNorm]::text[])
 *   sourceNorm = sourceModelRaw.toLowerCase().trim() per D-79-06. The
 *   containment-check predicate is the SQL-layer idempotency gate (T-79-04
 *   mitigation per PATTERNS L131-140 + RESEARCH § Pattern 4 L497-503).
 *
 * Step 4.5 — for each [compositeKey, resolved] of familyMap.entries():
 *   UPDATE watches_catalog c SET family_id = resolved.uuid
 *     FROM brands b
 *    WHERE c.brand_id = b.id
 *      AND b.name_normalized = brandNorm
 *      AND c.model_normalized = modelNorm
 *      AND (c.family_id IS NULL OR c.family_id <> resolved.uuid)
 *   JOIN-scoped by brand_id + model_normalized per MIG-03. The trailing
 *   predicate makes the UPDATE idempotent (re-run safety + T-79-04).
 *
 * Pitfall 4 (RESEARCH L646-651): Step 4.5 requires brand_id already populated
 * on the catalog row — applyBrandPath Step 4.2 MUST have completed before this
 * function fires. Plan 04's outer transaction enforces that ordering.
 *
 * NOTE: `tx` is the sql.begin callback parameter (postgres-lib's transaction-
 * scoped sql tag). Throwing here triggers ROLLBACK; resolving COMMITs.
 * NEVER call process.exit() inside this function — Pitfall 2.
 *
 * NO array-spread anti-pattern flagged by [[drizzle-sql-any-array-pitfall]]
 * anywhere; per-row loops sidestep the IN-list pitfall entirely.
 */
async function applyFamilyPath(
  tx: SqlTagBrandInsert,
  familyMap: FamilyDecisionMap,
  brandMap?: BrandDecisionMap,
): Promise<{
  familiesCreated: number
  aliasesAppended: number
  catalogRowsResolvedFamily: number
}> {
  let familiesCreated = 0
  let aliasesAppended = 0
  let catalogRowsResolvedFamily = 0

  // Step 4.3 — INSERT new families; reify map entries.
  //
  // Re-resolve brandUuid through brandMap (Plan 04 wiring). buildFamilyMap
  // captured the brand UUID at parse time, BEFORE applyBrandPath ran. For
  // family rows whose brand was kind='new' at parse time, the captured
  // brandUuid is a synthetic key (e.g. "a. lange & söhne") — applyBrandPath
  // has since reified the brandMap entry to kind='existing' with a real
  // UUID, but the familyMap still carries the synthetic. Re-resolve at
  // INSERT time so the new family points at the freshly-allocated brand.id.
  // When brandMap is omitted (legacy callsite), fall back to the captured
  // value (callers MUST pass brandMap if any brand row has kind='new').
  const resolveBrandUuid = (compositeKey: string, capturedUuid: string): string => {
    if (!brandMap) return capturedUuid
    const brandNorm = compositeKey.split('|')[0]
    const resolvedBrand = brandMap.get(brandNorm)
    if (!resolvedBrand) return capturedUuid
    if (resolvedBrand.kind === 'existing' || resolvedBrand.kind === 'merge') {
      return resolvedBrand.uuid
    }
    // kind='new' should have been reified by applyBrandPath Step 4.1 + the
    // brand-side invariant. If it slipped through, surface a clear error
    // rather than passing the synthetic key into the INSERT.
    throw new Error(
      `[v8.4-brand-canon] applyFamilyPath: brand "${brandNorm}" still kind=new after applyBrandPath. ` +
        `This indicates applyBrandPath did not run, or the brandMap was not the SAME object instance passed to both helpers.`,
    )
  }

  for (const [compositeKey, resolved] of familyMap.entries()) {
    if (resolved.kind !== 'new') continue
    const brandUuid = resolveBrandUuid(compositeKey, resolved.brandUuid)
    const [row] = await tx`
      INSERT INTO watch_families (brand_id, name, needs_review, aliases)
      VALUES (${brandUuid}, ${resolved.rawName}, false, '{}'::text[])
      RETURNING id
    `
    // Preserve the family_raw display string (resolved.rawName) as canonicalName
    // — the apply-time hydration step (Plan 04 Step 4.6) writes b.name +
    // f.name onto watches.brand + .model, so canonicalName here doesn't drive
    // user-facing display; only the resolved.uuid is consumed downstream.
    familyMap.set(compositeKey, {
      kind: 'existing',
      uuid: row.id,
      canonicalName: resolved.rawName,
    })
    familiesCreated++
  }

  // Pitfall 3 invariant: every family map entry must now carry a UUID. If a
  // 'new' remains, Step 4.5's UPDATE would interpolate `undefined` and the
  // post-flight assertion (Plan 04 Step 4.7) would catch it as a row-count
  // mismatch. Throw here with the clearer source-of-truth diagnostic.
  for (const v of familyMap.values()) {
    if (v.kind === 'new') {
      throw new Error(
        '[v8.4-brand-canon] applyFamilyPath: familyMap not reified after Step 4.3 ' +
          '(one or more entries still carry kind=new). This is a bug.',
      )
    }
  }

  // Step 4.4 — UPDATE aliases idempotently per merge: decision (D-79-06).
  // The NOT (aliases @> ARRAY[$src]) containment-check predicate is the
  // SQL-layer idempotency gate (T-79-04 mitigation).
  for (const [, resolved] of familyMap.entries()) {
    if (resolved.kind !== 'merge') continue
    const sourceNorm = resolved.sourceModelRaw.toLowerCase().trim()
    const targetUuid = resolved.uuid
    const result = (await tx`
      UPDATE watch_families
      SET aliases = aliases || ARRAY[${sourceNorm}]::text[]
      WHERE id = ${targetUuid}
        AND NOT (aliases @> ARRAY[${sourceNorm}]::text[])
    `) as unknown as UpdateResult
    aliasesAppended += result.count
  }

  // Step 4.5 — UPDATE watches_catalog.family_id JOIN-scoped by brand_id +
  // model_normalized per MIG-03. Per-row loop because the ~200-row catalog
  // scale doesn't merit bulk VALUES, and per-row sidesteps the
  // [[drizzle-sql-any-array-pitfall]] entirely.
  for (const [compositeKey, resolved] of familyMap.entries()) {
    // Type-narrow: invariant above guarantees no kind='new' remains.
    if (resolved.kind === 'new') {
      throw new Error(
        `[v8.4-brand-canon] applyFamilyPath Step 4.5: family "${compositeKey}" still kind=new after Step 4.3 invariant. This is a bug.`,
      )
    }
    const { brandNorm, modelNorm } = parseCompositeKey(compositeKey)
    const resolvedUuid = resolved.uuid
    const result = (await tx`
      UPDATE watches_catalog c
      SET family_id = ${resolvedUuid}
      FROM brands b
      WHERE c.brand_id = b.id
        AND b.name_normalized = ${brandNorm}
        AND c.model_normalized = ${modelNorm}
        AND (c.family_id IS NULL OR c.family_id <> ${resolvedUuid})
    `) as unknown as UpdateResult
    catalogRowsResolvedFamily += result.count
  }

  return { familiesCreated, aliasesAppended, catalogRowsResolvedFamily }
}

// ============================================================
// PHASE 79 PLAN 04 — Step 4.6 (hydration / DISP-03), Step 4.7 (post-flight /
// MIG-04), and D-79-10 POST-DEPLOY artifact renderer + writer.
// ============================================================

/**
 * Phase 79 Plan 04 — apply-time counts returned from the atomic transaction.
 * Consumed by renderPostDeployMarkdown for the auto-generated POST-DEPLOY
 * artifact, and by the post-success stdout summary block.
 */
export interface ApplyCounts {
  brandsCreated: number
  catalogRowsResolvedBrand: number
  familiesCreated: number
  aliasesAppended: number
  catalogRowsResolvedFamily: number
  userWatchesHydrated: number
}

/**
 * Phase 79 Plan 04 — input to the pure renderPostDeployMarkdown function. The
 * `today` field is injectable for unit-test determinism (renderer must NOT
 * call Date.now() when args.today is provided).
 */
export interface PostDeployArgs {
  counts: ApplyCounts
  postFlightQuery: string
  postFlightResult: {
    total: number
    resolvedBrand: number
    resolvedFamily: number
  }
  isLocal: boolean
  today?: string
}

// Postgres-lib runtime: UPDATE FROM JOIN returns an Array<row> with a
// runtime `.count` (rows affected) property. Cast on consume — mirrors the
// applyBrandPath / applyFamilyPath idiom at L875-877.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlTagHydration = (
  strings: TemplateStringsArray,
  ...values: unknown[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
) => Promise<unknown>

/**
 * Phase 79 Plan 04 Step 4.6 — DISP-03 hydration. Single UPDATE FROM JOIN
 * writes canonical brands.name + watch_families.name onto watches.brand +
 * .model for every catalog-linked watches row. Per D-79-08 the UPDATE is
 * UNCONDITIONAL: no WHERE-clause filter on watches.brand/model text — the
 * JOIN naturally skips watches.catalog_id IS NULL orphans per Pitfall 5.
 *
 * Touches `brand` + `model` columns ONLY; notes / serial / reference / all
 * other text columns stay untouched.
 *
 * NOTE: `tx` is the sql.begin callback parameter; throwing here triggers
 * ROLLBACK of every prior step in Plan 04's outer transaction. NEVER call
 * process.exit() inside this function — Pitfall 2.
 */
async function applyHydration(
  tx: SqlTagHydration,
): Promise<{ userWatchesHydrated: number }> {
  const result = (await tx`
    UPDATE watches w
    SET brand = b.name,
        model = f.name
    FROM watches_catalog c
    JOIN brands b ON c.brand_id = b.id
    JOIN watch_families f ON c.family_id = f.id
    WHERE w.catalog_id = c.id
  `) as unknown as UpdateResult
  return { userWatchesHydrated: result.count }
}

// Postgres-lib SELECT-typed sql-tag for the post-flight assertion. Returns a
// single row with three text-coerced count columns. The ::text cast avoids
// JS-side BigInt issues for large counts.
type SqlTagPostFlight = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<
  Array<{
    total: string
    resolved_brand: string
    resolved_family: string
  }>
>

/**
 * Phase 79 Plan 04 Step 4.7 — MIG-04 post-flight assertion. Uses a POSITIVE
 * predicate (`IS DISTINCT FROM NULL`) that is STRUCTURALLY DIFFERENT from any
 * UPDATE WHERE clause in Steps 4.1-4.6 per [[post-flight-assertion-predicate-
 * divergence]]. The Step 4.2 + 4.5 UPDATEs predicate on positive equality
 * (`lower(trim(brand)) = ${brandNorm}`); none predicate on `WHERE brand_id IS
 * NULL`. So the assertion's positive predicate cannot trivially-pass for the
 * same reason any UPDATE was a no-op.
 *
 * Throws Error inside the sql.begin callback when resolvedBrand !== total or
 * resolvedFamily !== total → automatic ROLLBACK of all 6 prior steps.
 *
 * NEVER call process.exit() inside this function — Pitfall 2.
 */
async function postFlightAssertion(
  tx: SqlTagPostFlight,
): Promise<{
  total: number
  resolvedBrand: number
  resolvedFamily: number
  postFlightQuery: string
}> {
  // Stash the textual form of the SQL for the POST-DEPLOY artifact (operator
  // pastes it into the Supabase SQL editor for independent verification).
  const postFlightQuery = `SELECT
  (SELECT count(*) FROM watches_catalog) AS total,
  (SELECT count(*) FROM watches_catalog WHERE brand_id IS DISTINCT FROM NULL) AS resolved_brand,
  (SELECT count(*) FROM watches_catalog WHERE family_id IS DISTINCT FROM NULL) AS resolved_family;`

  const [pf] = await tx`
    SELECT
      (SELECT count(*) FROM watches_catalog)::text AS total,
      (SELECT count(*) FROM watches_catalog
         WHERE brand_id IS DISTINCT FROM NULL)::text AS resolved_brand,
      (SELECT count(*) FROM watches_catalog
         WHERE family_id IS DISTINCT FROM NULL)::text AS resolved_family
  `
  const total = Number(pf.total)
  const resolvedBrand = Number(pf.resolved_brand)
  const resolvedFamily = Number(pf.resolved_family)
  if (resolvedBrand !== total || resolvedFamily !== total) {
    // Throwing inside the sql.begin callback triggers ROLLBACK of every prior
    // step. The Database returns to its pre-apply state.
    throw new Error(
      `[v8.4-brand-canon] MIG-04 post-flight assertion FAILED: ` +
        `total=${total} resolved_brand=${resolvedBrand} resolved_family=${resolvedFamily}. ` +
        `Rolling back the entire transaction.`,
    )
  }
  return { total, resolvedBrand, resolvedFamily, postFlightQuery }
}

/**
 * Phase 79 Plan 04 — D-79-10 POST-DEPLOY artifact RENDERER. PURE function —
 * no FS, no DB, no Date.now() when args.today is provided. The string output
 * is consumed by writePostDeployArtifact which wraps it with mkdir + writeFile.
 *
 * Section structure mirrors Phase 78's 78-POST-DEPLOY.md verbatim (PATTERNS
 * L516-525): frontmatter → Apply Summary GFM table → Post-Flight Assertion
 * (MIG-04) → Operator Sign-Off Queries (6 SQL blocks) → Sign-off checklist →
 * forward-armor "What this push does NOT do" → Deliverables Summary → Next
 * Phase pointer.
 *
 * Sign-Off Query #2 references the canonical Hamilton uuid VERBATIM (per
 * 79-CONTEXT specifics L147-151) — the end-to-end correctness check that the
 * SEED-021 Hamilton/Hamilton Watch merge collapsed as expected.
 */
export function renderPostDeployMarkdown(args: PostDeployArgs): string {
  const today = args.today ?? new Date().toISOString().slice(0, 10)
  const target = args.isLocal ? 'LOCAL' : 'PROD'
  return `# Phase 79 — ${target} Deployment Record

**Date:** ${today}
**Operator:** {operator-name-here}
**Status:** Pending verification → fill in after operator runs sign-off queries
**Script:** scripts/v8.4-brand-canonicalization.ts --apply --mode=both

---

## Apply Summary

| Step | Count |
|------|-------|
| Brands created (new rows) | ${args.counts.brandsCreated} |
| Catalog rows resolved (brand_id) | ${args.counts.catalogRowsResolvedBrand} |
| Families created (new rows) | ${args.counts.familiesCreated} |
| Aliases appended (merge decisions) | ${args.counts.aliasesAppended} |
| Catalog rows resolved (family_id) | ${args.counts.catalogRowsResolvedFamily} |
| User watches hydrated (brand+model overwritten) | ${args.counts.userWatchesHydrated} |

## Post-Flight Assertion (MIG-04)

\`\`\`sql
${args.postFlightQuery}
\`\`\`

**Result:**
- total: ${args.postFlightResult.total}
- resolved_brand: ${args.postFlightResult.resolvedBrand}
- resolved_family: ${args.postFlightResult.resolvedFamily}

Both resolved counts equal total → zero unresolved rows (assertion held inside transaction).

---

## Operator Sign-Off Queries (paste into Supabase SQL editor)

### 1. Zero NULL brand_id or family_id on catalog
\`\`\`sql
SELECT
  (SELECT count(*) FROM watches_catalog WHERE brand_id IS NULL) AS brand_null,
  (SELECT count(*) FROM watches_catalog WHERE family_id IS NULL) AS family_null;
\`\`\`
Expected: \`0 | 0\`

### 2. Hamilton merge collapsed correctly
\`\`\`sql
SELECT
  count(*) AS rows_pointing_at_canonical_hamilton
FROM watches_catalog
WHERE brand_id = '20969364-f3b1-4b1d-ab2f-e5d22e9ffabc';
\`\`\`
Expected: >= (the count of catalog rows where lower(trim(brand)) IN ('hamilton', 'hamilton watch')).

### 3. New brand row count matches summary
\`\`\`sql
SELECT count(*) AS new_brand_count
FROM brands
WHERE created_at > now() - interval '1 hour';
\`\`\`
Expected: matches "Brands created" in summary (${args.counts.brandsCreated}).

### 4. Aliases appended via merge decisions (where applicable)
\`\`\`sql
SELECT name, aliases
FROM watch_families
WHERE cardinality(aliases) > 0
ORDER BY name;
\`\`\`
Expected: one entry per merge: decision in family-merge-decisions.md; e.g. \`Brut Datejust | {"brut date"}\`.

### 5. Hydration of a known user watch
\`\`\`sql
SELECT u.email, w.brand, w.model
FROM watches w
JOIN users u ON w.user_id = u.id
WHERE lower(w.brand) LIKE 'hamilton%'
LIMIT 5;
\`\`\`
Expected: every row's brand reads \`Hamilton\` (canonical), NOT \`Hamilton Watch\`.

### 6. Natural-key UNIQUE constraint survived (per [[local-catalog-natural-key-drift]])
\`\`\`sql
SELECT conname FROM pg_constraint WHERE conname = 'watches_catalog_natural_key';
\`\`\`
Expected: 1 row.

---

## Sign-off

- [ ] All 6 verification queries returned expected results
- [ ] No unexpected rollback or transaction abort
- [ ] needs_review queue empty by default (Phase 82 will populate on ingest)

## What this push does NOT do (forward-armor against scope creep)

- Does NOT flip NOT NULL on \`watches_catalog.brand_id\` / \`.family_id\` (Phase 80 CANON-01/CANON-02)
- Does NOT change \`/api/extract-watch\` behavior (Phase 80 INGEST-01..04)
- Does NOT swap the recommender JOIN-through path (Phase 81 RECO-01..04)
- Does NOT add auto-overwrite on \`addWatch\` / \`editWatch\` Server Actions (Phase 81 DISP-01/DISP-02)
- Does NOT add admin UI surfaces (Phase 82 UI-01..03, OPS-01/OPS-02)

## Phase 79 Deliverables Summary

| Requirement | Status |
|-------------|--------|
| MIG-02 — brand backfill --apply, idempotent | ${args.counts.catalogRowsResolvedBrand} catalog rows resolved (brand_id) |
| MIG-03 — family backfill --apply, aliases routing | ${args.counts.catalogRowsResolvedFamily} catalog rows resolved (family_id); ${args.counts.aliasesAppended} aliases appended |
| MIG-04 — post-flight assertion (predicate divergence) | ${args.postFlightResult.resolvedBrand}/${args.postFlightResult.total} brand + ${args.postFlightResult.resolvedFamily}/${args.postFlightResult.total} family resolved |
| MIG-05 — portability (prod push clean first try) | script-driven; no SQL migration in this phase |
| DISP-03 — hydration via UPDATE FROM JOIN | ${args.counts.userWatchesHydrated} watches hydrated |

## Next Phase

Phase 80: NOT NULL Constraint Flip + Ingest Hardening — CANON-01/CANON-02 (flip NOT NULL on resolved FKs) + INGEST-01..04 (extract-watch resolves via brand/family FKs).
`
}

/**
 * Phase 79 Plan 04 — D-79-10 POST-DEPLOY artifact WRITER. Wraps the pure
 * renderer with mkdir + writeFile. Runs AFTER sql.begin transaction commits
 * (post-success only — never written if assertion rolls back). Non-exported
 * because the FS side-effect is per-script; tests target renderPostDeployMarkdown.
 */
async function writePostDeployArtifact(args: PostDeployArgs): Promise<void> {
  const content = renderPostDeployMarkdown(args)
  await mkdir(path.dirname(POST_DEPLOY_PATH), { recursive: true })
  await writeFile(POST_DEPLOY_PATH, content, 'utf8')
  console.log(`[v8.4-brand-canon] wrote ${POST_DEPLOY_PATH}`)
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
      // ============================================================
      // Phase 79 Plan 04 — `--apply --mode=both` full atomic transaction.
      //
      // 5-stage flow:
      //   STAGE 1: D-79-04 idempotent re-run gate (cheaper exit on no-op
      //            re-run; fires BEFORE strict gate)
      //   STAGE 2: D-79-01 STRICTEST pre-flight gate (brand + family)
      //   STAGE 3: D-79-02 confirmIfProd (silent local; interactive prod)
      //   STAGE 4: ATOMIC TRANSACTION (D-79-03) wrapping Steps 4.1-4.7
      //            inside ONE sql.begin callback
      //   STAGE 5: D-79-10 post-success POST-DEPLOY artifact write
      //
      // Pitfall 7: --apply REQUIRES --mode=both (asserted at main() top).
      // Pitfall 2: every failure inside the sql.begin callback uses `throw`,
      //            never process.exit() — the callback's throw triggers
      //            automatic ROLLBACK; the outer .catch handles process exit
      //            AFTER rollback completes.
      // ============================================================

      // STAGE 1 — D-79-04 idempotent re-run gate.
      const gateStatus = await idempotentReRunGate(
        sql as unknown as SqlTagCount,
      )
      if (gateStatus === 'already-applied') {
        return // sql.end() fires in finally; clean exit 0
      }

      // STAGE 2 — STRICTEST pre-flight gate (brand + family scope).
      if (!existsSync(OUTPUT_FILE)) {
        throw new Error(
          `[v8.4-brand-canon] ERROR: brand decisions file not found at ${OUTPUT_FILE}.\n` +
            `Run \`npm run db:v8.4-brand-canon\` (--mode=brands default) first, ` +
            `then re-run --apply --mode=both.`,
        )
      }
      if (!existsSync(FAMILY_OUTPUT_FILE)) {
        throw new Error(
          `[v8.4-brand-canon] ERROR: family decisions file not found at ${FAMILY_OUTPUT_FILE}.\n` +
            `Run \`npx tsx scripts/v8.4-brand-canonicalization.ts --mode=families --force\` first, ` +
            `then re-run --apply --mode=both.`,
        )
      }
      const brandContent = await readFile(OUTPUT_FILE, 'utf8')
      const familyContent = await readFile(FAMILY_OUTPUT_FILE, 'utf8')
      const brandRows = parseDecisionsTable(brandContent)
      const familyRows = parseFamilyDecisionsTable(familyContent)

      const existingBrandIdsFn = async (uuids: string[]): Promise<Set<string>> => {
        if (uuids.length === 0) return new Set<string>()
        // Postgres-lib helper form: sql(uuids) expands the array as an IN-list
        // parameter binding (NOT the array-spread anti-pattern flagged by
        // [[drizzle-sql-any-array-pitfall]]).
        const rows = await sql<{ id: string }[]>`
          SELECT id FROM brands WHERE id IN ${sql(uuids)}
        `
        return new Set(rows.map((r) => r.id))
      }
      const existingFamilyIdsFn = async (
        uuids: string[],
      ): Promise<Set<string>> => {
        if (uuids.length === 0) return new Set<string>()
        const rows = await sql<{ id: string }[]>`
          SELECT id FROM watch_families WHERE id IN ${sql(uuids)}
        `
        return new Set(rows.map((r) => r.id))
      }
      await strictPreflightGate(
        sql as unknown as Parameters<typeof strictPreflightGate>[0],
        brandRows,
        existingBrandIdsFn,
        familyRows,
        existingFamilyIdsFn,
      )

      // Build the in-memory maps (D-79-07 — brand → family chain).
      const brandMap = buildBrandMap(brandRows)
      const familyMap = buildFamilyMap(familyRows, brandMap)

      // Compute pre-transaction summary for the D-79-02 prod prompt. Catalog
      // count is fetched once; the hydration target count is `watches WHERE
      // catalog_id IS NOT NULL` (the JOIN's natural filter per Pitfall 5).
      const [{ count: catalogCountText }] = await sql<{ count: string }[]>`
        SELECT count(*)::text AS count FROM watches_catalog
      `
      const [{ count: hydrationCountText }] = await sql<{ count: string }[]>`
        SELECT count(*)::text AS count FROM watches WHERE catalog_id IS NOT NULL
      `
      const summary: ApplySummary = {
        brandsToCreate: Array.from(brandMap.values()).filter(
          (v) => v.kind === 'new',
        ).length,
        catalogRowsToResolve: Number(catalogCountText),
        familiesToCreate: Array.from(familyMap.values()).filter(
          (v) => v.kind === 'new',
        ).length,
        userWatchesToHydrate: Number(hydrationCountText),
        aliasesToAppend: Array.from(familyMap.values()).filter(
          (v) => v.kind === 'merge',
        ).length,
      }

      // STAGE 3 — D-79-02 confirm gate (silent local; interactive prod).
      await confirmIfProd(connStr, summary)

      // STAGE 4 — ATOMIC TRANSACTION (D-79-03). One outer sql.begin wraps
      // Steps 4.1-4.7. ANY throw inside the callback triggers ROLLBACK; the
      // outer .catch in `main().catch(...)` exits non-zero AFTER rollback.
      let counts!: ApplyCounts
      let postFlight!: {
        total: number
        resolvedBrand: number
        resolvedFamily: number
        postFlightQuery: string
      }

      await sql.begin(async (tx) => {
        // 4.1 + 4.2 — brand path (Plan 02 helper invoked here for the first
        // time inside the unified outer transaction; the Plan 02 stand-alone
        // sql.begin block was deleted in this same edit per D-79-03).
        const brandRes = await applyBrandPath(
          tx as unknown as SqlTagBrandInsert,
          brandMap,
        )
        // 4.3 + 4.4 + 4.5 — family path (Plan 03 helper; not previously
        // wired). Pass brandMap so applyFamilyPath Step 4.3 can re-resolve
        // brandUuid for kind='new' family rows whose brand was reified to
        // 'existing' by applyBrandPath Step 4.1 (the buildFamilyMap-time
        // capture is now stale).
        const familyRes = await applyFamilyPath(
          tx as unknown as SqlTagBrandInsert,
          familyMap,
          brandMap,
        )
        // 4.6 — hydration (Plan 04 / DISP-03). Unconditional UPDATE FROM JOIN
        // per D-79-08.
        const hydRes = await applyHydration(
          tx as unknown as SqlTagHydration,
        )
        // 4.7 — post-flight assertion (Plan 04 / MIG-04). Positive predicate
        // IS DISTINCT FROM NULL; throws on mismatch → ROLLBACK.
        postFlight = await postFlightAssertion(
          tx as unknown as SqlTagPostFlight,
        )

        counts = {
          brandsCreated: brandRes.brandsCreated,
          catalogRowsResolvedBrand: brandRes.catalogRowsResolvedBrand,
          familiesCreated: familyRes.familiesCreated,
          aliasesAppended: familyRes.aliasesAppended,
          catalogRowsResolvedFamily: familyRes.catalogRowsResolvedFamily,
          userWatchesHydrated: hydRes.userWatchesHydrated,
        }
      })

      // STAGE 5 — D-79-10 post-success artifact write (post-commit only —
      // never invoked on rollback path because the throw exits before this
      // line).
      await writePostDeployArtifact({
        counts,
        postFlightQuery: postFlight.postFlightQuery,
        postFlightResult: {
          total: postFlight.total,
          resolvedBrand: postFlight.resolvedBrand,
          resolvedFamily: postFlight.resolvedFamily,
        },
        isLocal: isLocalDatabaseUrl(connStr),
      })

      console.log(
        `[v8.4-brand-canon] APPLY COMPLETE.\n` +
          `  brandsCreated:               ${counts.brandsCreated}\n` +
          `  catalogRowsResolvedBrand:    ${counts.catalogRowsResolvedBrand}\n` +
          `  familiesCreated:             ${counts.familiesCreated}\n` +
          `  aliasesAppended:             ${counts.aliasesAppended}\n` +
          `  catalogRowsResolvedFamily:   ${counts.catalogRowsResolvedFamily}\n` +
          `  userWatchesHydrated:         ${counts.userWatchesHydrated}\n` +
          `  POST-DEPLOY artifact written: ${POST_DEPLOY_PATH}`,
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

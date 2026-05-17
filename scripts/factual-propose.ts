/**
 * Phase 44 factual-fill proposer — D-01..D-05, D-13, ENRH-05.
 * Usage:
 *   npm run db:factual-propose -- --dry-run
 *   npm run db:factual-propose -- --review-file=catalog-factual-review.jsonl
 *   npm run db:factual-propose -- --dry-run --review-file=my-review.jsonl
 *
 * Gap-driven web_search LLM pass:
 *   - Finds catalog rows with any NULL factual field (movement_type, case_size_mm, style_tags)
 *   - For each non-skipped row: calls enrichWithWebSearch to propose values via the two-turn
 *     web_search + forced-tool pattern (D-06, RESEARCH Pattern 1)
 *   - Writes a hand-editable JSONL review file — one line per field per catalog_id (D-03)
 *   - Each line includes the source URL derived from web search results (D-02)
 *   - The review file is the resume ledger — re-running skips already-proposed catalog_ids (D-13)
 *
 * The LLM NEVER writes factual columns directly. The review file + factual-apply are the
 * only path to the DB (D-01, ENRH-05).
 *
 * --dry-run: prints gap count and would-be rows, makes NO API calls, exits 0.
 *            Does not require ANTHROPIC_API_KEY.
 */
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { enrichWithWebSearch } from '../src/lib/taste/webSearch'

// ENRH-01: Pacing and retry constants (mirrors backfill-taste.ts)
const INTER_ROW_DELAY_MS = 1000  // 1 req/sec sustained — well below Anthropic limits
const SDK_MAX_RETRIES = 3        // raise from SDK default 2 for batch runs

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

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

/**
 * D-13 resume ledger: scan existing JSONL review file and return the set of
 * catalog_ids already proposed. Re-running skips these rows.
 */
async function loadAlreadyProposed(reviewFile: string): Promise<Set<string>> {
  if (!existsSync(reviewFile)) return new Set()
  const content = await readFile(reviewFile, 'utf-8')
  const ids = new Set<string>()
  for (const line of content.split('\n').filter(Boolean)) {
    try {
      const entry = JSON.parse(line) as { catalog_id: string }
      ids.add(entry.catalog_id)
    } catch { /* skip malformed lines */ }
  }
  return ids
}

/**
 * FACTUAL_TOOL — structured output for factual catalog attributes.
 * D-04: image_source_page_url is a brand/retailer PAGE url, NOT a direct image url.
 * RESEARCH Pitfall 5: style_tags is the factual /search filter column — distinct from
 * design_motifs (the taste column). Never conflate.
 */
const FACTUAL_TOOL: Anthropic.Messages.Tool = {
  name: 'record_factual_attributes',
  description: 'Record factual catalog attributes proposed from web research. For image_source_page_url, provide a brand or retailer PAGE URL where a cover photo can be found — NOT a direct image URL.',
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      movement_type: {
        type: 'string',
        enum: ['auto', 'manual', 'quartz', 'spring_drive'],
        nullable: true,
        description: 'Movement type: auto (automatic), manual, quartz, or spring_drive. Set null if unknown.',
      },
      case_size_mm: {
        type: 'number',
        nullable: true,
        description: 'Case diameter in millimeters (e.g. 40). Set null if unknown.',
      },
      style_tags: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 8,
        description: 'Functional style descriptors for /search filtering (e.g. dive, pilot, dress, sport, field, chrono, gmt). NOT aesthetic taste tags.',
      },
      image_source_page_url: {
        type: 'string',
        nullable: true,
        description: 'URL of a brand or retailer PAGE where a cover photo can be sourced. Must be a page URL (not a direct image file URL). Set null if no reliable source found.',
      },
    },
    required: ['movement_type', 'case_size_mm', 'style_tags', 'image_source_page_url'],
  },
}

interface ReviewEntry {
  catalog_id: string
  field: string
  current: unknown
  proposed: unknown
  source_url: string
  approved: null
}

/**
 * JSONL append — one line per field per catalog_id (RESEARCH Pattern 4).
 * Uses flag 'a' for incremental append.
 */
async function appendReviewEntries(
  reviewFile: string,
  entries: ReviewEntry[],
): Promise<void> {
  const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n'
  await writeFile(reviewFile, lines, { flag: 'a' })
}

interface GapRow {
  id: string
  brand: string
  model: string
  reference: string | null
  movement_type: string | null
  case_size_mm: string | null
  style_tags: string[]
  [key: string]: unknown
}

async function main() {
  const args = parseArgs()

  // Gap query: rows with ANY NULL factual field (gap-driven — D-05)
  const rawRows = await db.execute<GapRow>(sql`
    SELECT id, brand, model, reference, movement_type, case_size_mm, style_tags
    FROM watches_catalog
    WHERE movement_type IS NULL
       OR case_size_mm IS NULL
       OR array_length(style_tags, 1) IS NULL
    ORDER BY brand, model
  `)
  const rows = rawRows as unknown as Array<GapRow>

  if (args.dryRun) {
    console.log(`[factual-propose] DRY RUN — no API calls made`)
    console.log(`[factual-propose]   gap rows found: ${rows.length}`)
    if (rows.length > 0) {
      console.log(`[factual-propose]   rows that WOULD be proposed:`)
      for (const row of rows) {
        const missingFields = []
        if (row.movement_type === null) missingFields.push('movement_type')
        if (row.case_size_mm === null) missingFields.push('case_size_mm')
        if (!Array.isArray(row.style_tags) || row.style_tags.length === 0) missingFields.push('style_tags')
        console.log(`[factual-propose]     ${row.brand} ${row.model}${row.reference ? ` ${row.reference}` : ''} — missing: ${missingFields.join(', ')}`)
      }
    }
    console.log(`[factual-propose] DRY RUN complete — no API calls made`)
    process.exit(0)
    return
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`[factual-propose] ANTHROPIC_API_KEY not set — cannot run live. Use --dry-run for preview.`)
    process.exit(1)
  }

  const alreadyProposed = await loadAlreadyProposed(args.reviewFile)
  const toProcess = rows.filter((r) => !alreadyProposed.has(r.id))

  console.log(`[factual-propose] gap rows: ${rows.length}, already proposed: ${alreadyProposed.size}, to process: ${toProcess.length}`)

  const client = new Anthropic({ maxRetries: SDK_MAX_RETRIES })

  for (const row of toProcess) {
    // Determine which fields are missing for this row (D-05 field-by-field)
    const missingFields: string[] = []
    if (row.movement_type === null) missingFields.push('movement_type')
    if (row.case_size_mm === null) missingFields.push('case_size_mm')
    if (!Array.isArray(row.style_tags) || row.style_tags.length === 0) missingFields.push('style_tags')

    if (missingFields.length === 0) {
      console.log(JSON.stringify({
        event: 'factual_propose_row_result',
        catalog_id: row.id,
        status: 'skipped',
        reason: 'no null fields',
        timestamp: new Date().toISOString(),
      }))
      await sleep(INTER_ROW_DELAY_MS)
      continue
    }

    const watchLabel = `${row.brand} ${row.model}${row.reference ? ` ${row.reference}` : ''}`
    const initialMessages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'user',
        content: `Research the watch: ${watchLabel}

Please find the following factual information about this watch:
${missingFields.includes('movement_type') ? '- Movement type (automatic/manual/quartz/spring_drive)' : ''}
${missingFields.includes('case_size_mm') ? '- Case diameter in millimeters' : ''}
${missingFields.includes('style_tags') ? '- Style tags for search filtering (functional categories like dive, pilot, dress, sport, field, chrono, gmt)' : ''}
- A reliable brand or retailer page URL where a cover photo can be found (if available)

Use web search to find accurate, sourced information. Then call the record_factual_attributes tool with your findings.`,
      },
    ]

    try {
      const { toolUse, sourceUrls, webSearchUnavailable } = await enrichWithWebSearch(
        client,
        [FACTUAL_TOOL],
        initialMessages,
        'record_factual_attributes',
      )

      if (webSearchUnavailable) {
        console.log(JSON.stringify({
          event: 'factual_propose_web_search_unavailable',
          catalog_id: row.id,
          timestamp: new Date().toISOString(),
        }))
      }

      if (!toolUse) {
        console.log(JSON.stringify({
          event: 'factual_propose_row_result',
          catalog_id: row.id,
          status: 'failure',
          error: 'no tool_use block in response',
          timestamp: new Date().toISOString(),
        }))
        await sleep(INTER_ROW_DELAY_MS)
        continue
      }

      const input = toolUse.input as {
        movement_type?: string | null
        case_size_mm?: number | null
        style_tags?: string[]
        image_source_page_url?: string | null
      }

      const sourceUrl = sourceUrls[0] ?? ''
      const entries: ReviewEntry[] = []

      // Only propose entries for fields that are actually NULL on this row (D-05)
      if (missingFields.includes('movement_type') && input.movement_type !== undefined) {
        entries.push({
          catalog_id: row.id,
          field: 'movement_type',
          current: null,
          proposed: input.movement_type,
          source_url: sourceUrl,
          approved: null,
        })
      }

      if (missingFields.includes('case_size_mm') && input.case_size_mm !== undefined) {
        entries.push({
          catalog_id: row.id,
          field: 'case_size_mm',
          current: null,
          proposed: input.case_size_mm,
          source_url: sourceUrl,
          approved: null,
        })
      }

      if (missingFields.includes('style_tags') && Array.isArray(input.style_tags)) {
        entries.push({
          catalog_id: row.id,
          field: 'style_tags',
          current: row.style_tags,
          proposed: input.style_tags,
          source_url: sourceUrl,
          approved: null,
        })
      }

      // image_source_page_url: always propose if the model returned one (D-04)
      if (input.image_source_page_url) {
        entries.push({
          catalog_id: row.id,
          field: 'image_source_page_url',
          current: null,
          proposed: input.image_source_page_url,
          source_url: sourceUrl,
          approved: null,
        })
      }

      if (entries.length > 0) {
        await appendReviewEntries(args.reviewFile, entries)
      }

      console.log(JSON.stringify({
        event: 'factual_propose_row_result',
        catalog_id: row.id,
        status: 'success',
        fields_proposed: entries.map((e) => e.field),
        timestamp: new Date().toISOString(),
      }))
    } catch (err) {
      console.log(JSON.stringify({
        event: 'factual_propose_row_result',
        catalog_id: row.id,
        status: 'failure',
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      }))
    }

    // ENRH-01: Inter-row pacing — keeps sustained rate ~1 req/sec
    await sleep(INTER_ROW_DELAY_MS)
  }

  console.log(`[factual-propose] DONE — processed ${toProcess.length} rows, review file: ${args.reviewFile}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[factual-propose] fatal:', err)
  process.exit(1)
})

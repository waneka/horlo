/**
 * scripts/generate-explore-migration.ts
 *
 * Reads LISTS.md, PATHS.md, and explore-cover-urls.json and emits a single
 * idempotent Supabase migration at supabase/migrations/{ts}_seed_explore_editorial.sql
 *
 * Usage:
 *   npx tsx scripts/generate-explore-migration.ts          # writes the file
 *   npx tsx scripts/generate-explore-migration.ts --stdout  # dumps to stdout
 *
 * This script does NOT connect to the database — it is a pure SQL generator.
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── Paths ───────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..')
const TASK_DIR = path.join(
  REPO_ROOT,
  '.planning/quick/260614-f82-seed-explore-page-editorial-content-8-cu',
)
const LISTS_MD = path.join(TASK_DIR, 'LISTS.md')
const PATHS_MD = path.join(TASK_DIR, 'PATHS.md')
const COVER_URLS_JSON = path.join(REPO_ROOT, 'scripts/seed-data/explore-cover-urls.json')
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase/migrations')

// ─── Types ───────────────────────────────────────────────────────────────────

interface ListItem {
  brand: string
  model: string
  reference: string | null
  commentary: string
  sort_order: number
}

interface CuratedList {
  slug: string
  title: string
  curator_name: string
  sort_order: number
  intro_markdown: string
  items: ListItem[]
}

interface PathNode {
  brand: string
  model: string
  reference: string | null
  rationale: string
  sort_order: number
}

interface CollectionPath {
  slug: string
  path_type: string
  sort_order: number
  seed_brand: string
  seed_model: string
  seed_reference: string | null
  rationale: string
  nodes: PathNode[]
}

// ─── Parser helpers ───────────────────────────────────────────────────────────

/**
 * Split the file into blocks, one per ## heading.
 * Stops parsing blocks that are clearly "Catalog Reconciliation Status" appendixes.
 */
function splitIntoBlocks(content: string): string[] {
  const lines = content.split('\n')
  const blocks: string[] = []
  let current: string[] = []

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const heading = line.slice(3).trim()
      // Stop at the reconciliation appendix
      if (heading.startsWith('Catalog Reconciliation')) break
      if (current.length > 0) blocks.push(current.join('\n'))
      current = [line]
    } else if (line.startsWith('---') && current.length > 0) {
      // Block separator — flush current
      if (current.length > 0) blocks.push(current.join('\n'))
      current = []
    } else {
      current.push(line)
    }
  }
  if (current.length > 0 && current.some((l) => l.startsWith('## '))) {
    blocks.push(current.join('\n'))
  }
  return blocks.filter((b) => b.trim().length > 0)
}

/**
 * Extract a scalar value from a block like "key: value"
 */
function extractScalar(block: string, key: string): string | null {
  const match = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
  return match ? match[1].trim() : null
}

/**
 * Extract an integer value
 */
function extractInt(block: string, key: string): number {
  const val = extractScalar(block, key)
  if (!val) throw new Error(`Missing required key: ${key}`)
  return parseInt(val, 10)
}

/**
 * Extract a multi-line pipe block (YAML literal block scalar):
 *   key: |
 *     line 1
 *     line 2
 */
function extractPipeBlock(block: string, key: string): string {
  const lines = block.split('\n')
  let inBlock = false
  const result: string[] = []
  let baseIndent = -1

  for (const line of lines) {
    if (!inBlock) {
      const pipeMatch = line.match(new RegExp(`^(\\s*)${key}:\\s*\\|\\s*$`))
      if (pipeMatch) {
        inBlock = true
        continue
      }
    } else {
      // End on a line at same or lower indent that's not blank and doesn't start with spaces
      if (line.trim() === '') {
        result.push('')
        continue
      }
      const indentMatch = line.match(/^(\s+)/)
      const lineIndent = indentMatch ? indentMatch[1].length : 0
      if (baseIndent === -1) baseIndent = lineIndent
      if (lineIndent < baseIndent && line.trim() !== '') {
        // End of block
        break
      }
      result.push(line.slice(baseIndent))
    }
  }
  // Trim trailing blank lines
  while (result.length > 0 && result[result.length - 1].trim() === '') result.pop()
  return result.join('\n')
}

/**
 * Parse the items: block from LISTS.md
 */
function parseItems(block: string): ListItem[] {
  const items: ListItem[] = []
  const lines = block.split('\n')
  let inItems = false
  let current: Partial<ListItem> | null = null

  for (const line of lines) {
    if (line.match(/^items:\s*$/)) {
      inItems = true
      continue
    }
    if (!inItems) continue
    // A new item starts with "  - brand:"
    const brandMatch = line.match(/^\s+-\s+brand:\s+(.+)$/)
    if (brandMatch) {
      if (current) items.push(current as ListItem)
      current = { brand: brandMatch[1].trim() }
      continue
    }
    if (!current) continue

    const modelMatch = line.match(/^\s+model:\s+(.+)$/)
    if (modelMatch) { current.model = modelMatch[1].trim(); continue }

    const refMatch = line.match(/^\s+reference:\s+(.+)$/)
    if (refMatch) {
      const val = refMatch[1].trim()
      current.reference = (val === 'null' || val === '~') ? null : val.replace(/^["']|["']$/g, '')
      continue
    }

    const commentaryMatch = line.match(/^\s+commentary:\s+(.+)$/)
    if (commentaryMatch) { current.commentary = commentaryMatch[1].trim(); continue }

    const sortMatch = line.match(/^\s+sort_order:\s+(\d+)$/)
    if (sortMatch) { current.sort_order = parseInt(sortMatch[1], 10); continue }
  }
  if (current) items.push(current as ListItem)
  return items
}

/**
 * Parse LISTS.md into structured objects
 */
function parseLists(content: string): CuratedList[] {
  const blocks = splitIntoBlocks(content)
  const lists: CuratedList[] = []

  for (const block of blocks) {
    const slugMatch = block.match(/^## (.+)$/m)
    if (!slugMatch) continue
    const slug = slugMatch[1].trim()

    const title = extractScalar(block, 'title')
    if (!title) throw new Error(`Missing title in list block: ${slug}`)

    const curator_name = extractScalar(block, 'curator_name') ?? 'Horlo Editorial'
    const sort_order = extractInt(block, 'sort_order')
    const intro_markdown = extractPipeBlock(block, 'intro_markdown')
    if (!intro_markdown) throw new Error(`Missing intro_markdown in list: ${slug}`)

    const items = parseItems(block)
    if (items.length < 5)
      throw new Error(`List ${slug} has only ${items.length} items — minimum is 5`)

    lists.push({ slug, title, curator_name, sort_order, intro_markdown, items })
  }
  return lists
}

/**
 * Parse the nodes: block from PATHS.md
 */
function parseNodes(block: string): PathNode[] {
  const nodes: PathNode[] = []
  const lines = block.split('\n')
  let inNodes = false
  let current: Partial<PathNode> | null = null

  for (const line of lines) {
    if (line.match(/^nodes:\s*$/)) {
      inNodes = true
      continue
    }
    if (!inNodes) continue

    const brandMatch = line.match(/^\s+-\s+brand:\s+(.+)$/)
    if (brandMatch) {
      if (current) nodes.push(current as PathNode)
      current = { brand: brandMatch[1].trim() }
      continue
    }
    if (!current) continue

    const modelMatch = line.match(/^\s+model:\s+(.+)$/)
    if (modelMatch) { current.model = modelMatch[1].trim(); continue }

    const refMatch = line.match(/^\s+reference:\s+"?([^"#\n]+)"?/)
    if (refMatch) {
      const val = refMatch[1].trim()
      current.reference = (val === 'null' || val === '~') ? null : val.replace(/^["']|["']$/g, '')
      continue
    }

    const rationaleMatch = line.match(/^\s+rationale:\s+(.+)$/)
    if (rationaleMatch) { current.rationale = rationaleMatch[1].trim(); continue }

    const sortMatch = line.match(/^\s+sort_order:\s+(\d+)$/)
    if (sortMatch) { current.sort_order = parseInt(sortMatch[1], 10); continue }
  }
  if (current) nodes.push(current as PathNode)
  return nodes
}

/**
 * Parse PATHS.md into structured objects
 */
function parsePaths(content: string): CollectionPath[] {
  const blocks = splitIntoBlocks(content)
  const paths: CollectionPath[] = []

  for (const block of blocks) {
    const slugMatch = block.match(/^## (.+)$/m)
    if (!slugMatch) continue
    const slug = slugMatch[1].trim()

    const path_type = extractScalar(block, 'path_type')
    if (!path_type) throw new Error(`Missing path_type in path: ${slug}`)

    const sort_order = extractInt(block, 'sort_order')
    const rationale = extractPipeBlock(block, 'rationale')
    if (!rationale) throw new Error(`Missing rationale in path: ${slug}`)

    // Parse seed block
    const lines = block.split('\n')
    let inSeed = false
    let seed_brand = ''
    let seed_model = ''
    let seed_reference: string | null = null

    for (const line of lines) {
      if (line.match(/^seed:\s*$/)) { inSeed = true; continue }
      if (!inSeed) continue
      const brandMatch = line.match(/^\s+brand:\s+(.+)$/)
      if (brandMatch) { seed_brand = brandMatch[1].trim(); continue }
      const modelMatch = line.match(/^\s+model:\s+(.+)$/)
      if (modelMatch) { seed_model = modelMatch[1].trim(); continue }
      const refMatch = line.match(/^\s+reference:\s+"?([^"#\n]+)"?/)
      if (refMatch) {
        const val = refMatch[1].trim()
        seed_reference = (val === 'null' || val === '~') ? null : val.replace(/^["']|["']$/g, '')
        continue
      }
      // End of seed block when we hit nodes: or a non-indented line
      if (line.match(/^[a-z]/) || line.match(/^nodes:/)) { inSeed = false; break }
    }

    if (!seed_brand || !seed_model) throw new Error(`Missing seed in path: ${slug}`)

    const nodes = parseNodes(block)
    if (nodes.length < 3)
      throw new Error(`Path ${slug} has only ${nodes.length} nodes — minimum is 3`)

    paths.push({ slug, path_type, sort_order, seed_brand, seed_model, seed_reference, rationale, nodes })
  }
  return paths
}

// ─── SQL generators ───────────────────────────────────────────────────────────

/**
 * Escape a string for use inside a dollar-quoted block.
 * We use unique per-call tags like $LIST1INTRO$, $L1I2C$, etc.
 * This function just returns the content as-is since dollar-quoting handles all chars.
 */
function dq(tag: string, content: string): string {
  return `$${tag}$${content}$${tag}$`
}

/**
 * Generate catalog lookup SQL (natural key resolution).
 *
 * Strategy:
 *   - When reference is non-null: look up by brand + reference only.
 *     Reference uniquely identifies a watch within a brand and is more stable
 *     than model name (model names can drift between prod enrichment passes).
 *   - When reference is null: look up by brand + model (only safe option).
 *
 * Both cases RAISE EXCEPTION on miss — we never silently skip a lookup failure.
 */
function catalogLookup(varName: string, brand: string, model: string, reference: string | null, context: string): string {
  const brandEsc = brand.replace(/'/g, "''")
  const modelEsc = model.replace(/'/g, "''")

  if (reference !== null) {
    const refEsc = reference.replace(/'/g, "''")
    return `
        SELECT id INTO ${varName} FROM public.watches_catalog
         WHERE brand = '${brandEsc}' AND reference IS NOT DISTINCT FROM '${refEsc}'
         LIMIT 1;
        IF ${varName} IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% reference=% (${context})', '${brandEsc}', '${refEsc}';
        END IF;`
  } else {
    // NULL reference: fall back to brand + model lookup
    return `
        SELECT id INTO ${varName} FROM public.watches_catalog
         WHERE brand = '${brandEsc}' AND model = '${modelEsc}' AND reference IS NULL
         LIMIT 1;
        IF ${varName} IS NULL THEN
          RAISE EXCEPTION 'seed_explore_editorial: catalog row missing for brand=% model=% reference=NULL (${context})', '${brandEsc}', '${modelEsc}';
        END IF;`
  }
}

/**
 * Generate SQL for one curated list block (idempotent)
 */
function listBlock(list: CuratedList, coverUrl: string, idx: number): string {
  const listTag = `L${idx}TITLE`
  const introTag = `L${idx}INTRO`
  const lines: string[] = []

  lines.push(`        -- ---------- LIST: ${list.slug} ----------`)
  lines.push(`        SELECT id INTO v_list_id FROM public.curated_lists`)
  lines.push(`         WHERE curator_name = 'Horlo Editorial' AND title = ${dq(listTag, list.title)};`)
  lines.push(`        IF v_list_id IS NULL THEN`)
  lines.push(`          INSERT INTO public.curated_lists`)
  lines.push(`            (title, curator_name, cover_url, intro_markdown, status, sort_order, published_at)`)
  lines.push(`          VALUES (`)
  lines.push(`            ${dq(listTag + 'V', list.title)},`)
  lines.push(`            'Horlo Editorial',`)
  lines.push(`            '${coverUrl}',`)
  lines.push(`            ${dq(introTag, list.intro_markdown)},`)
  lines.push(`            'published',`)
  lines.push(`            ${list.sort_order},`)
  lines.push(`            NOW()`)
  lines.push(`          ) RETURNING id INTO v_list_id;`)
  lines.push(`        END IF;`)
  lines.push(``)

  // Insert items — always run the ON CONFLICT DO NOTHING so adding items to LISTS.md
  // and re-running the migration adds them without duplicating existing ones.
  for (const item of list.items) {
    const ctx = `list ${list.slug} item sort_order ${item.sort_order}`
    const commentaryTag = `L${idx}C${item.sort_order}`
    lines.push(catalogLookup('v_catalog_id', item.brand, item.model, item.reference, ctx))
    lines.push(`        INSERT INTO public.curated_list_items (list_id, catalog_id, commentary, sort_order)`)
    lines.push(`        VALUES (v_list_id, v_catalog_id, ${dq(commentaryTag, item.commentary)}, ${item.sort_order})`)
    lines.push(`        ON CONFLICT ON CONSTRAINT curated_list_items_unique_pair DO NOTHING;`)
    lines.push(``)
  }

  return lines.join('\n')
}

/**
 * Generate SQL for one collection path block (idempotent)
 */
function pathBlock(p: CollectionPath, idx: number): string {
  const rationaleTag = `P${idx}RAT`
  const lines: string[] = []

  lines.push(`        -- ---------- PATH: ${p.slug} ----------`)

  // Resolve seed catalog
  const seedCtx = `path ${p.slug} seed`
  lines.push(catalogLookup('v_seed_catalog_id', p.seed_brand, p.seed_model, p.seed_reference, seedCtx))
  lines.push(``)

  const ptypeEscaped = p.path_type.replace(/'/g, "''")
  lines.push(`        -- Idempotency: (seed_catalog_id, source='manual', path_type, sort_order)`)
  lines.push(`        SELECT id INTO v_path_id FROM public.collection_paths`)
  lines.push(`         WHERE seed_catalog_id = v_seed_catalog_id`)
  lines.push(`           AND source = 'manual'`)
  lines.push(`           AND path_type = '${ptypeEscaped}'`)
  lines.push(`           AND sort_order = ${p.sort_order};`)
  lines.push(`        IF v_path_id IS NULL THEN`)
  lines.push(`          INSERT INTO public.collection_paths`)
  lines.push(`            (seed_catalog_id, status, path_type, rationale, source, sort_order)`)
  lines.push(`          VALUES (`)
  lines.push(`            v_seed_catalog_id,`)
  lines.push(`            'published',`)
  lines.push(`            '${ptypeEscaped}',`)
  lines.push(`            ${dq(rationaleTag, p.rationale)},`)
  lines.push(`            'manual',`)
  lines.push(`            ${p.sort_order}`)
  lines.push(`          ) RETURNING id INTO v_path_id;`)
  lines.push(`        END IF;`)
  lines.push(``)

  // Insert nodes
  for (const node of p.nodes) {
    const nodeCtx = `path ${p.slug} node sort_order ${node.sort_order}`
    const nodeRatTag = `P${idx}N${node.sort_order}R`
    lines.push(catalogLookup('v_node_catalog_id', node.brand, node.model, node.reference, nodeCtx))
    lines.push(`        INSERT INTO public.collection_path_nodes (path_id, catalog_id, rationale, sort_order)`)
    lines.push(`        VALUES (v_path_id, v_node_catalog_id, ${dq(nodeRatTag, node.rationale)}, ${node.sort_order})`)
    lines.push(`        ON CONFLICT ON CONSTRAINT collection_path_nodes_unique_slot DO NOTHING;`)
    lines.push(``)
  }

  return lines.join('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const toStdout = process.argv.includes('--stdout')

  // Validate inputs exist
  for (const f of [LISTS_MD, PATHS_MD, COVER_URLS_JSON]) {
    if (!fs.existsSync(f)) {
      console.error(`ERROR: Required file not found: ${f}`)
      process.exit(1)
    }
  }

  const listsContent = fs.readFileSync(LISTS_MD, 'utf-8')
  const pathsContent = fs.readFileSync(PATHS_MD, 'utf-8')
  const coverUrls = JSON.parse(fs.readFileSync(COVER_URLS_JSON, 'utf-8')) as Record<string, string>

  // Parse
  const lists = parseLists(listsContent)
  const paths = parsePaths(pathsContent)

  console.log(`Parsed ${lists.length} lists, ${paths.length} paths`)

  // Validate cover URLs
  for (const list of lists) {
    if (!coverUrls[list.slug]) {
      console.error(`ERROR: No cover URL found for list slug: ${list.slug}`)
      console.error(`Available slugs in explore-cover-urls.json: ${Object.keys(coverUrls).join(', ')}`)
      process.exit(1)
    }
  }

  // Count total nodes for sanity assertion
  const totalNodes = paths.reduce((sum, p) => sum + p.nodes.length, 0)

  // Generate timestamp (UTC)
  const now = new Date()
  const ts = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('')

  // Build SQL
  const sql: string[] = []

  sql.push(`-- ============================================================================`)
  sql.push(`-- Quick task 260614-f82: seed /explore editorial content`)
  sql.push(`-- ${lists.length} curated lists + items + ${paths.length} collection paths + nodes.`)
  sql.push(`-- Idempotent: re-running this migration is a no-op after the first apply.`)
  sql.push(`--`)
  sql.push(`-- Catalog references resolved by (brand, model, reference) natural key per`)
  sql.push(`-- project-catalog-id-divergence memory — prod/local uuids differ.`)
  sql.push(`-- ============================================================================`)
  sql.push(``)
  sql.push(`BEGIN;`)
  sql.push(``)

  // ─── Curated lists DO block ───
  sql.push(`-- ---------- ${lists.length} curated lists ----------`)
  sql.push(`-- For each list: SELECT existing id; if not found, INSERT then get id.`)
  sql.push(`-- Items always use ON CONFLICT DO NOTHING so adding items and re-running is additive.`)
  sql.push(``)
  sql.push(`DO $$`)
  sql.push(`DECLARE`)
  sql.push(`  v_list_id    uuid;`)
  sql.push(`  v_catalog_id uuid;`)
  sql.push(`BEGIN`)

  for (let i = 0; i < lists.length; i++) {
    const list = lists[i]
    const coverUrl = coverUrls[list.slug]
    sql.push(listBlock(list, coverUrl, i + 1))
  }

  sql.push(`END $$;`)
  sql.push(``)

  // ─── Collection paths DO block ───
  sql.push(`-- ---------- ${paths.length} collection paths ----------`)
  sql.push(`-- Idempotency key: (seed_catalog_id, source='manual', path_type, sort_order).`)
  sql.push(`-- Nodes always use ON CONFLICT DO NOTHING on collection_path_nodes_unique_slot.`)
  sql.push(``)
  sql.push(`DO $$`)
  sql.push(`DECLARE`)
  sql.push(`  v_path_id         uuid;`)
  sql.push(`  v_seed_catalog_id uuid;`)
  sql.push(`  v_node_catalog_id uuid;`)
  sql.push(`BEGIN`)

  for (let i = 0; i < paths.length; i++) {
    sql.push(pathBlock(paths[i], i + 1))
  }

  sql.push(`END $$;`)
  sql.push(``)

  // ─── Sanity assertion ───
  sql.push(`-- ---------- Sanity assertion ----------`)
  sql.push(`DO $$`)
  sql.push(`DECLARE`)
  sql.push(`  list_count  integer;`)
  sql.push(`  item_count  integer;`)
  sql.push(`  path_count  integer;`)
  sql.push(`  node_count  integer;`)
  sql.push(`BEGIN`)
  sql.push(`  SELECT count(*) INTO list_count`)
  sql.push(`    FROM public.curated_lists`)
  sql.push(`   WHERE curator_name = 'Horlo Editorial' AND status = 'published';`)
  sql.push(`  SELECT count(*) INTO item_count`)
  sql.push(`    FROM public.curated_list_items cli`)
  sql.push(`    JOIN public.curated_lists cl ON cl.id = cli.list_id`)
  sql.push(`   WHERE cl.curator_name = 'Horlo Editorial';`)
  sql.push(`  SELECT count(*) INTO path_count`)
  sql.push(`    FROM public.collection_paths`)
  sql.push(`   WHERE source = 'manual' AND status = 'published';`)
  sql.push(`  SELECT count(*) INTO node_count`)
  sql.push(`    FROM public.collection_path_nodes;`)
  sql.push(`  IF list_count < ${lists.length} THEN`)
  sql.push(`    RAISE EXCEPTION 'seed_explore_editorial: expected >=${lists.length} published Horlo Editorial lists, got %', list_count;`)
  sql.push(`  END IF;`)
  sql.push(`  IF item_count < ${lists.reduce((s, l) => s + l.items.length, 0)} THEN`)
  sql.push(`    RAISE EXCEPTION 'seed_explore_editorial: expected >=${lists.reduce((s, l) => s + l.items.length, 0)} list items, got %', item_count;`)
  sql.push(`  END IF;`)
  sql.push(`  IF path_count < ${paths.length} THEN`)
  sql.push(`    RAISE EXCEPTION 'seed_explore_editorial: expected >=${paths.length} published manual paths, got %', path_count;`)
  sql.push(`  END IF;`)
  sql.push(`  IF node_count < ${totalNodes} THEN`)
  sql.push(`    RAISE EXCEPTION 'seed_explore_editorial: expected >=${totalNodes} path nodes, got %', node_count;`)
  sql.push(`  END IF;`)
  sql.push(`END $$;`)
  sql.push(``)
  sql.push(`COMMIT;`)
  sql.push(``)

  const output = sql.join('\n')

  if (toStdout) {
    process.stdout.write(output)
    console.error(`\n-- ${lists.length} lists / ${lists.reduce((s, l) => s + l.items.length, 0)} items / ${paths.length} paths / ${totalNodes} nodes`)
  } else {
    const filename = `${ts}_seed_explore_editorial.sql`
    const outPath = path.join(MIGRATIONS_DIR, filename)
    fs.writeFileSync(outPath, output, 'utf-8')
    console.log(`Written: supabase/migrations/${filename}`)
    console.log(`  ${lists.length} lists / ${lists.reduce((s, l) => s + l.items.length, 0)} items / ${paths.length} paths / ${totalNodes} nodes`)
  }
}

main().catch((err) => {
  console.error('ERROR:', err)
  process.exit(1)
})

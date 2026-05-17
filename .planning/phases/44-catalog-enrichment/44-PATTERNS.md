# Phase 44: Catalog Enrichment - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 8 (5 new, 3 modified)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/backfill-taste.ts` (modified) | script | batch / CRUD | `scripts/backfill-taste.ts` itself | exact (harden in place) |
| `scripts/reenrich-taste.ts` (modified) | script | batch / CRUD | `scripts/reenrich-taste.ts` itself | exact (guard added) |
| `src/lib/taste/enricher.ts` (modified) | service | request-response | `src/lib/taste/enricher.ts` itself | exact (two-turn reshape) |
| `src/data/catalog.ts` → `updateCatalogTaste` (modified) | data-access | CRUD | `src/data/catalog.ts` `updateCatalogTaste` | exact (guard insert) |
| `scripts/factual-propose.ts` (NEW) | script | batch / request-response | `scripts/backfill-taste.ts` | role-match |
| `scripts/factual-apply.ts` (NEW) | script | file-I/O / batch | `scripts/backfill-taste.ts` + `scripts/refresh-counts.ts` | role-match |
| `scripts/verify-catalog-coverage.ts` (NEW) | script | request-response (read-only DB) | `scripts/refresh-counts.ts` | role-match |
| `supabase/migrations/<ts>_phase44_*.sql` (NEW × 2) | migration | batch / SQL | `supabase/migrations/20260430000000_phase19_1_taste_constraints.sql` | exact |
| `tests/integration/backfill-taste.test.ts` (extended) | test | event-driven | `tests/integration/backfill-taste.test.ts` | exact (extend in place) |
| `tests/integration/catalog-taste.test.ts` (extended) | test | CRUD | `tests/integration/catalog-taste.test.ts` | exact (extend in place) |
| `package.json` `"scripts"` (modified) | config | — | existing `db:backfill-taste` entries | exact |

---

## Pattern Assignments

### `scripts/backfill-taste.ts` (modified — ENRH-01/02 hardening)

**Analog:** itself (harden in place)

**Current import block** (lines 23–29):
```typescript
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { watchesCatalog } from '../src/db/schema'
import { sql } from 'drizzle-orm'
import { enrichTasteAttributes } from '../src/lib/taste/enricher'
import { updateCatalogTaste } from '../src/data/catalog'
```

**Gaps to fill — ENRH-01 inter-row pacing (add near top of file):**

The SDK `Anthropic` client is constructed inside `enrichTasteAttributes`; pacing and `maxRetries` override belong in the script layer. Add these constants and a `sleep` helper:

```typescript
const INTER_ROW_DELAY_MS = 1000  // 1 req/sec sustained
const SDK_MAX_RETRIES = 3         // raise from SDK default 2

// Pass to enrichTasteAttributes via a new optional clientOptions param,
// or construct the Anthropic client in the script and thread it down.
async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
```

**Gaps to fill — ENRH-02 per-row success/failure logging (lines 124–156):**

The current loop logs `row ${row.id} failed` but has no per-row success log. The new pattern logs a structured JSON line for every row:

```typescript
// After successful updateCatalogTaste:
console.log(JSON.stringify({
  event: 'backfill_row_result',
  catalog_id: row.id,
  status: 'success',
  confidence: taste.confidence,
  timestamp: new Date().toISOString(),
}))
// After failure:
console.log(JSON.stringify({
  event: 'backfill_row_result',
  catalog_id: row.id,
  status: 'failure',
  error: err instanceof Error ? err.message : String(err),
  timestamp: new Date().toISOString(),
}))
// After each row, pace:
await sleep(INTER_ROW_DELAY_MS)
```

**Final assertion pattern** (lines 161–171 — keep as-is, log-not-exit):
```typescript
// Residual assertion — D-10 acceptable; log but do NOT exit 1.
const remaining = await db.execute<{ c: number }>(sql`
  SELECT count(*)::int AS c FROM watches_catalog WHERE confidence IS NULL
`)
const residual = (remaining as unknown as Array<{ c: number }>)[0]?.c ?? 0
if (residual > 0) {
  console.warn(`[backfill-taste] ${residual} rows still have NULL confidence ...`)
}
```

---

### `scripts/reenrich-taste.ts` (modified — D-07/D-08 guard interaction)

**Analog:** itself (no new logic here — the guard lives in `updateCatalogTaste`)

The only change is that the `{ force: true }` call at line 150 now flows through the downgrade guard added to `updateCatalogTaste`. The script itself needs no structural change. However, add a per-row log that surfaces when a guard block occurs (the guard logs a warn; the script should catch the `updated: false` return and record it):

```typescript
// Replace the existing success check (lines 148–152) with:
if (taste) {
  const writeResult = await updateCatalogTaste(row.id, taste, { force: true })
  if (writeResult.updated) {
    totalSucceeded++
    console.log(JSON.stringify({
      event: 'reenrich_row_result',
      catalog_id: row.id,
      status: 'success',
      timestamp: new Date().toISOString(),
    }))
  } else {
    console.log(JSON.stringify({
      event: 'reenrich_row_result',
      catalog_id: row.id,
      status: 'guard_blocked',
      timestamp: new Date().toISOString(),
    }))
  }
}
```

---

### `src/lib/taste/enricher.ts` (modified — D-06 web_search two-turn)

**Analog:** itself (two-turn reshape of the `messages.create` call)

**Existing single-turn shape** (lines 114–120) — this block is replaced:
```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  tools: [TASTE_TOOL],
  tool_choice: { type: 'tool', name: 'record_taste_attributes' },
  messages,
})
```

**New two-turn shape to substitute (D-06, RESEARCH Pattern 1):**
```typescript
const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20250305 = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 3,
}

// Turn 1: auto — let Claude decide to search for grounding context
let searchResponse = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  tools: [TASTE_TOOL as Anthropic.Messages.Tool, WEB_SEARCH_TOOL],
  tool_choice: { type: 'auto' },
  messages,
})

// Handle pause_turn from long web_search runs (RESEARCH Pitfall 2)
if (searchResponse.stop_reason === 'pause_turn') {
  searchResponse = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    tools: [TASTE_TOOL as Anthropic.Messages.Tool, WEB_SEARCH_TOOL],
    tool_choice: { type: 'auto' },
    messages: [
      ...messages,
      { role: 'assistant', content: searchResponse.content },
    ],
  })
}

// Turn 2: force the custom tool — now with web search results in context
const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  tools: [TASTE_TOOL as Anthropic.Messages.Tool, WEB_SEARCH_TOOL],
  tool_choice: { type: 'tool', name: 'record_taste_attributes' },
  messages: [
    ...messages,
    { role: 'assistant', content: searchResponse.content },
  ],
})
```

**Never-throws posture — keep intact** (lines 86, 172–182): the `try/catch` wrapping the entire call block returns `null` on any error. The two-turn expansion sits entirely inside that try block.

**web_search unavailable graceful fallback (RESEARCH Open Question 2):** if `searchResponse.content` contains a `web_search_tool_result` block with `type: 'web_search_tool_result_error'` and `error.type === 'unavailable'`, log a `taste_enrichment_web_search_unavailable` event and proceed to Turn 2 anyway (Turn 2 will still use the text-only context in `messages`).

**Structured event log pattern** (lines 54–59 — copy verbatim for new events):
```typescript
function logEvent(event: string, payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }))
}
function logError(event: string, payload: Record<string, unknown>): void {
  console.error(JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }))
}
```

---

### `src/data/catalog.ts` → `updateCatalogTaste` (modified — D-07/D-08 downgrade guard)

**Analog:** `updateCatalogTaste` lines 508–539

**Current `force` path** (lines 512–535): the `force` flag currently only removes the `AND confidence IS NULL` predicate from the SQL. The D-07 guard is inserted immediately after `const force = options?.force === true`:

```typescript
// D-07/D-08 downgrade guard — insert after line 514 (const force = ...)
if (force && !taste.extractedFromPhoto) {
  const existing = await db.execute<{
    confidence: string | null
    extracted_from_photo: boolean
  }>(sql`
    SELECT confidence, extracted_from_photo
    FROM watches_catalog
    WHERE id = ${catalogId}
  `)
  const row = (existing as unknown as Array<{
    confidence: string | null
    extracted_from_photo: boolean
  }>)[0]
  if (
    row &&
    row.extracted_from_photo === true &&
    row.confidence !== null &&
    Number(row.confidence) >= 0.7
  ) {
    console.warn(JSON.stringify({
      event: 'taste_downgrade_guard_blocked',
      catalog_id: catalogId,
      existing_confidence: row.confidence,
      timestamp: new Date().toISOString(),
    }))
    return { updated: false }
  }
}
```

**DB query shape to copy from** (lines 522–536 — raw `db.execute` with cast):
```typescript
const result = await db.execute<{ id: string }>(sql`...`)
const rows = result as unknown as Array<{ id: string }>
return { updated: rows.length > 0 }
```

**sanitizeHttpUrl pattern** (lines 22–31 — reuse in factual-apply for URL fields):
```typescript
function sanitizeHttpUrl(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null
  try {
    const u = new URL(input)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}
```

---

### `scripts/factual-propose.ts` (NEW)

**Analog:** `scripts/backfill-taste.ts` (full shape) + RESEARCH Pattern 1 (two-turn web_search)

**Import block — copy exactly from backfill-taste.ts lines 23–29, extend:**
```typescript
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { watchesCatalog } from '../src/db/schema'
import { sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
```

**parseArgs pattern — copy from backfill-taste.ts lines 39–49:**
```typescript
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
```

**Gap query — mirror backfill-taste.ts lines 51–72 predicate pattern:**
```typescript
// Query rows with ANY factual NULL (gap-driven — D-05)
const rows = await db.execute<{ id: string; brand: string; model: string; reference: string | null }>(sql`
  SELECT id, brand, model, reference
  FROM watches_catalog
  WHERE movement_type IS NULL
     OR case_size_mm IS NULL
     OR array_length(style_tags, 1) IS NULL
  ORDER BY brand, model
`)
```

**Resume ledger — scan existing review file to skip already-proposed catalog_ids (D-13):**
```typescript
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
```

**Two-turn web_search call shape — from RESEARCH Pattern 1:**
```typescript
const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20250305 = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 3,
}

// FACTUAL_TOOL — structured output for factual fields
const FACTUAL_TOOL: Anthropic.Messages.Tool = {
  name: 'record_factual_attributes',
  description: 'Record factual catalog attributes proposed from web research.',
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      movement_type: { type: 'string', enum: ['auto', 'manual', 'quartz', 'spring_drive'], nullable: true },
      case_size_mm:  { type: 'number', nullable: true },
      style_tags:    { type: 'array', items: { type: 'string' }, maxItems: 8 },
      image_source_page_url: { type: 'string', nullable: true, description: 'Brand/retailer page URL to find a cover photo — NOT an image URL' },
    },
    required: ['movement_type', 'case_size_mm', 'style_tags', 'image_source_page_url'],
  },
}
```

**Source URL extraction from Turn 1 — RESEARCH Pattern 1:**
```typescript
function extractSourceUrls(content: Anthropic.Messages.ContentBlock[]): string[] {
  const urls: string[] = []
  for (const block of content) {
    if (block.type === 'web_search_tool_result') {
      const results = Array.isArray(block.content) ? block.content : []
      for (const result of results) {
        if (result.type === 'web_search_result') {
          urls.push(result.url)
        }
      }
    }
  }
  return urls
}
```

**JSONL append — review file format (RESEARCH Pattern 4):**
```typescript
// One line per field per catalog_id
async function appendReviewEntries(
  reviewFile: string,
  entries: Array<{
    catalog_id: string
    field: string
    current: unknown
    proposed: unknown
    source_url: string
    approved: null
  }>,
) {
  const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n'
  await writeFile(reviewFile, lines, { flag: 'a' })
}
```

**Per-row log pattern — copy from backfill-taste.ts style:**
```typescript
console.log(JSON.stringify({
  event: 'factual_propose_row_result',
  catalog_id: row.id,
  status: 'success' | 'failure' | 'skipped',
  timestamp: new Date().toISOString(),
}))
```

**Pacing — same inter-row sleep as backfill-taste hardening:**
```typescript
await sleep(INTER_ROW_DELAY_MS)
```

**main() / fatal-catch pattern — copy from backfill-taste.ts lines 100–179:**
```typescript
async function main() { ... process.exit(0) }
main().catch((err) => {
  console.error('[factual-propose] fatal:', err)
  process.exit(1)
})
```

---

### `scripts/factual-apply.ts` (NEW)

**Analog:** `scripts/refresh-counts.ts` (minimal script shape) + `scripts/backfill-taste.ts` (error structure)

**Import block:**
```typescript
// Use relative imports — tsx does not resolve @/* path aliases.
import { readFile } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'
```

**Review file read + filter approved rows:**
```typescript
interface ReviewEntry {
  catalog_id: string
  field: 'movement_type' | 'case_size_mm' | 'style_tags' | 'image_source_page_url'
  current: unknown
  proposed: unknown
  source_url: string
  approved: boolean | null
}

const content = await readFile(reviewFile, 'utf-8')
const entries: ReviewEntry[] = content
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as ReviewEntry)
  .filter((e) => e.approved === true)
```

**Migration SQL generation — RESEARCH Pattern 5:**
```typescript
function generateMigrationFilename(suffix: string): string {
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
// Critical: YYYYMMDDHHMMSS — exactly 14 digits; Supabase CLI silently skips non-14-digit files
```

**SQL UPDATE template per row (parameterized, never raw string interpolation):**
```typescript
// Build one UPDATE per catalog_id, setting only approved fields
// Use typed value checks before emitting SQL — security: no raw LLM strings in SQL
// Reuse sanitizeHttpUrl from src/data/catalog.ts for any URL-valued field
```

**main() / fatal-catch** — copy from `refresh-counts.ts` lines 15–26 shape:
```typescript
async function main() {
  const startedAt = Date.now()
  // ... logic ...
  console.log(`[factual-apply] OK — migration written: ${filename}, elapsed: ${Date.now() - startedAt}ms`)
  process.exit(0)
}
main().catch((err) => {
  console.error('[factual-apply] fatal:', err)
  process.exit(1)
})
```

---

### `scripts/verify-catalog-coverage.ts` (NEW)

**Analog:** `scripts/refresh-counts.ts` (minimal DB-query script shape)

**Import block — copy from refresh-counts.ts lines 12–13:**
```typescript
// Use relative imports — tsx does not resolve @/* path aliases.
import { db } from '../src/db'
import { sql } from 'drizzle-orm'
import { PRIMARY_ARCHETYPES } from '../src/lib/taste/vocab'
```

**DB query shape — copy from refresh-counts.ts lines 16–19:**
```typescript
const result = await db.execute(sql`...`)
const elapsedMs = Date.now() - startedAt
console.log(`[verify-catalog-coverage] OK ...`)
process.exit(0)
```

**Assertion queries to run:**
```typescript
// 1. Taste population — hard fail
const tasteNull = await db.execute<{ c: number }>(sql`
  SELECT count(*)::int AS c FROM watches_catalog WHERE confidence IS NULL
`)

// 2. Factual population — hard fail
const factualNull = await db.execute<{ c: number }>(sql`
  SELECT count(*)::int AS c FROM watches_catalog
   WHERE movement_type IS NULL OR case_size_mm IS NULL
`)

// 3. Archetype distribution — soft warn, not hard fail (D-16)
const archetypeDist = await db.execute<{ primary_archetype: string; c: number }>(sql`
  SELECT primary_archetype, count(*)::int AS c
  FROM watches_catalog
  GROUP BY primary_archetype
  ORDER BY c DESC
`)
```

**Archetype coverage check — use PRIMARY_ARCHETYPES (10 values) as ground truth (RESEARCH Pitfall 6):**
```typescript
// Soft-warn pattern: never exit(1) for archetype gaps, only for taste/factual null rows
const distMap = new Map(archetypeDist.map(...))
for (const archetype of PRIMARY_ARCHETYPES) {
  const count = distMap.get(archetype) ?? 0
  if (count === 0) {
    console.warn(`[verify-catalog-coverage] WARN: archetype '${archetype}' has 0 catalog rows`)
  }
}
```

**Exit-code pattern:**
```typescript
// Hard failures → exit(1); soft warnings → exit(0)
if (tasteNullCount > 0 || factualNullCount > 0) {
  console.error('[verify-catalog-coverage] FAIL — ...')
  process.exit(1)
}
process.exit(0)
```

**fatal-catch** (copy from refresh-counts.ts line 23–26):
```typescript
main().catch((err) => {
  console.error('[verify-catalog-coverage] fatal:', err)
  process.exit(1)
})
```

---

### `supabase/migrations/<ts>_phase44_*.sql` (NEW × 2)

**Analog:** `supabase/migrations/20260430000000_phase19_1_taste_constraints.sql`

**Filename convention (RESEARCH Pattern 5 — critical):**
- Pattern: `YYYYMMDDHHMMSS_description.sql` — exactly 14 digits
- Example: `20260518143000_phase44_taste_data.sql`
- Latest migration to sort after: `20260517000000_phase43_avatar_select_policy.sql` — timestamp must be >= `20260517000001`

**File header pattern — copy from the migration analog:**
```sql
-- Phase 44 data migration: taste attributes backfill.
-- Generated by: npm run db:backfill-taste (local run)
-- Source: Phase 44 CONTEXT.md D-14
-- Apply: supabase db push --linked (never drizzle-kit push for prod)
-- Idempotent: each UPDATE is WHERE id = '<uuid>' — re-running is a no-op on already-updated rows.

BEGIN;
-- one UPDATE per catalog_id
UPDATE watches_catalog
   SET formality            = <val>,
       sportiness           = <val>,
       heritage_score       = <val>,
       primary_archetype    = '<val>',
       era_signal           = '<val>',
       design_motifs        = ARRAY[...]::text[],
       confidence           = <val>,
       extracted_from_photo = false,
       updated_at           = now()
 WHERE id = '<uuid>';
COMMIT;
```

**Empty array SQL literal — copy from updateCatalogTaste lines 517–520:**
```sql
-- Empty design_motifs: use literal not ARRAY[]
design_motifs = '{}'::text[]
```

---

### `tests/integration/backfill-taste.test.ts` (extended)

**Analog:** `tests/integration/backfill-taste.test.ts` itself (extend, not replace)

**Existing test structure to copy** (lines 1–34):
```typescript
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

describe('scripts/backfill-taste.ts --dry-run', () => {
  it('dry run reports ...', () => {
    const output = execSync('tsx --env-file=.env.local scripts/backfill-taste.ts --dry-run', {
      encoding: 'utf-8',
      timeout: 30_000,
    })
    expect(output).toMatch(/DRY RUN/)
  })
})
```

**New test blocks to add (ENRH-01/02/05/06):**

```typescript
// ENRH-05: factual-propose --dry-run
describe('scripts/factual-propose.ts --dry-run', () => {
  it('dry run outputs gap count and exits 0 without API calls', () => {
    const output = execSync('tsx --env-file=.env.local scripts/factual-propose.ts --dry-run', {
      encoding: 'utf-8',
      timeout: 30_000,
    })
    expect(output).toMatch(/DRY RUN/)
    expect(output).toMatch(/no API calls made/)
  })
})

// ENRH-06: verify-catalog-coverage exit codes
describe('scripts/verify-catalog-coverage.ts', () => {
  it('exits 0 when all coverage assertions pass (assumes populated local DB)', () => {
    // This test requires a populated local DB — skip via describe.skip if unavailable.
    execSync('tsx --env-file=.env.local scripts/verify-catalog-coverage.ts', { timeout: 30_000 })
  })
})
```

---

### `tests/integration/catalog-taste.test.ts` (extended)

**Analog:** `tests/integration/catalog-taste.test.ts` itself (extend `updateCatalogTaste` describe block)

**Existing test structure to copy** (lines 1–39 — header, insertTestRow, afterAll):
```typescript
import { describe, it, expect, afterAll } from 'vitest'
import { db } from '@/db'
import { watchesCatalog } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { updateCatalogTaste } from '@/data/catalog'
import type { CatalogTasteAttributes } from '@/lib/types'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const TEST_BRAND = `_test_taste_${Date.now()}`
// ...
async function insertTestRow(...) { ... }
afterAll(async () => { await db.execute(sql`DELETE FROM watches_catalog WHERE brand = ${TEST_BRAND}`) })
```

**New test cases to add inside the `updateCatalogTaste` describe block (ENRH-03 D-07/D-08):**

```typescript
// D-08 case 1: guard blocks text-mode force write on vision+high-confidence row
it('guard blocks text-mode force write on vision row with confidence >= 0.7 (D-08)', async () => {
  const id = await insertTestRow()
  // Establish: vision-derived, high-confidence
  await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: true, confidence: 0.9 }, { force: true })
  // Attempt: text-mode force write — should be blocked
  const result = await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: false, formality: 0.01 }, { force: true })
  expect(result.updated).toBe(false)
  // Original values remain
  const [row] = await db.select().from(watchesCatalog).where(eq(watchesCatalog.id, id))
  expect(Number(row.formality)).toBeCloseTo(VALID_TASTE.formality, 5)
})

// D-08 case 2: guard allows vision-mode force write on vision+high-confidence row
it('guard allows vision-mode force write on vision row (D-08 — legit refresh)', async () => {
  const id = await insertTestRow()
  await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: true, confidence: 0.9 }, { force: true })
  const result = await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: true, formality: 0.01 }, { force: true })
  expect(result.updated).toBe(true)
})

// D-08 case 3: guard allows text-mode force write when confidence < 0.7
it('guard allows text-mode force write when existing confidence < 0.7', async () => {
  const id = await insertTestRow()
  await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: true, confidence: 0.5 }, { force: true })
  const result = await updateCatalogTaste(id, { ...VALID_TASTE, extractedFromPhoto: false, formality: 0.01 }, { force: true })
  expect(result.updated).toBe(true)
})
```

---

### `package.json` "scripts" (modified)

**Analog:** existing `db:backfill-taste` entries (lines from package.json):

```json
"db:backfill-taste": "tsx --env-file=.env.local scripts/backfill-taste.ts",
"db:reenrich-taste": "tsx --env-file=.env.local scripts/reenrich-taste.ts",
```

**Three new entries to add (exact same `tsx --env-file=.env.local` pattern):**
```json
"db:factual-propose": "tsx --env-file=.env.local scripts/factual-propose.ts",
"db:factual-apply": "tsx --env-file=.env.local scripts/factual-apply.ts",
"db:verify-catalog-coverage": "tsx --env-file=.env.local scripts/verify-catalog-coverage.ts"
```

---

## Shared Patterns

### 1. Script structure (apply to all new/modified scripts)

**Source:** `scripts/backfill-taste.ts` lines 1–179, `scripts/refresh-counts.ts` lines 1–26

All `scripts/*.ts` files follow this invariant structure:

1. Header JSDoc comment with `Usage:` examples
2. `// Use relative imports — tsx does not resolve @/* path aliases.`
3. Relative imports (`'../src/...'` not `'@/...'`)
4. Constants block
5. `parseArgs()` if CLI flags needed (exact `Map<string, string>` pattern from `backfill-taste.ts` lines 39–49)
6. Business logic functions
7. `async function main()` — `process.exit(0)` at end
8. `main().catch((err) => { console.error('[script-name] fatal:', err); process.exit(1) })`

### 2. Structured JSON event logging (apply to all new/modified enrichment scripts and enricher.ts)

**Source:** `src/lib/taste/enricher.ts` lines 54–59

```typescript
function logEvent(event: string, payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }))
}
function logError(event: string, payload: Record<string, unknown>): void {
  console.error(JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }))
}
```

Per-row event names follow the pattern `<script_name>_row_result` with `status: 'success' | 'failure' | 'skipped' | 'guard_blocked'` and always include `catalog_id` and `timestamp`.

### 3. db.execute raw SQL cast pattern (apply to all new DB queries in scripts and catalog.ts)

**Source:** `src/data/catalog.ts` lines 522–536, `scripts/backfill-taste.ts` lines 75–85

```typescript
const result = await db.execute<{ c: number }>(sql`
  SELECT count(*)::int AS c FROM watches_catalog WHERE ...
`)
const count = (result as unknown as Array<{ c: number }>)[0]?.c ?? 0
```

The double cast `as unknown as Array<...>` is required — drizzle-orm `db.execute` returns an opaque type.

### 4. API key guard (apply to all scripts making LLM calls)

**Source:** `scripts/backfill-taste.ts` lines 108–111

```typescript
if (!process.env.ANTHROPIC_API_KEY) {
  console.error(`[script-name] ANTHROPIC_API_KEY not set — cannot run live. Use --dry-run for preview.`)
  process.exit(1)
}
```

### 5. never-throws posture for enricher (apply to enricher.ts modifications)

**Source:** `src/lib/taste/enricher.ts` lines 86, 172–182

The entire API call block is wrapped in `try { ... } catch (err) { logError(...); return null }`. The two-turn reshape must remain entirely inside this try block. Any new `await` calls (Turn 1, pause_turn continuation, Turn 2) must not escape the catch.

### 6. sanitizeHttpUrl (apply to factual-apply for any URL field emitted to SQL)

**Source:** `src/data/catalog.ts` lines 22–31

Import via relative path in scripts: `import { sanitizeHttpUrl } from '../src/data/catalog'` — but `sanitizeHttpUrl` is not exported. Either re-export it or inline the same implementation in `factual-apply.ts`.

---

## No Analog Found

None — all files have close or exact analogs in the codebase.

---

## Metadata

**Analog search scope:** `scripts/`, `src/lib/taste/`, `src/data/catalog.ts`, `src/db/schema.ts`, `supabase/migrations/`, `tests/integration/`
**Files scanned:** 12
**Pattern extraction date:** 2026-05-17

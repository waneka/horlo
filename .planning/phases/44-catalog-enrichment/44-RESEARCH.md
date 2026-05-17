# Phase 44: Catalog Enrichment — Research

**Researched:** 2026-05-17
**Domain:** Anthropic SDK tool-use / web_search, catalog data scripts, Supabase migrations
**Confidence:** HIGH (codebase verified, SDK types verified, official docs fetched)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Factual catalog columns filled via LLM-proposes / human-approves flow; LLM never writes factual columns directly (ungated). Approval gate IS the human-review ENRH-05 requires.
- **D-02:** Factual-fill LLM uses the Anthropic `web_search` tool. Each proposed value written to the review file alongside its source URL.
- **D-03:** Approval gate is an editable review file keyed by `catalog_id` — propose step writes it, user edits, apply step writes only confirmed rows.
- **D-04:** Cover photos: LLM proposes a likely source-page URL into the review file; user supplies the final image URL. No LLM-emitted direct-image URLs committed.
- **D-05:** Fill is gap-driven (only NULL fields): mirrors `backfill-taste.ts` pattern.
- **D-06:** Taste enricher (`src/lib/taste/enricher.ts`) also gets the `web_search` tool. Preserve never-throws / returns-null posture and structured event logging.
- **D-07:** Downgrade guard lives in `updateCatalogTaste` (`src/data/catalog.ts`).
- **D-08:** Block rule — force write rejected when ALL hold: (1) existing row is vision-derived (`extracted_from_photo = true`), (2) existing row's `confidence >= 0.7`, AND (3) incoming write is text-mode (`extractedFromPhoto = false`). Vision-mode force writes are allowed.
- **D-09:** High-confidence threshold = 0.7.
- **D-10:** Four scripts, separated by write semantics: `backfill-taste.ts` (hardened), `reenrich-taste.ts` (now subject to D-07/D-08 guard), NEW factual-propose script, NEW factual-apply script.
- **D-11:** ENRH-01 — `backfill-taste.ts` and factual-propose script retry rate-limited requests with backoff and pace.
- **D-12:** ENRH-02 — each row's `catalog_id` logged as success or failure.
- **D-13:** ENRH-02 resumability — factual-propose treats review file as resume ledger; re-running skips any `catalog_id` already present.
- **D-14:** Run-local-then-sync: enrichment runs against local DB; taste-backfill and factual-apply emit a timestamped SQL data migration into `supabase/migrations/`; pushed to prod via `supabase db push --linked`.
- **D-15:** Verification is a committed npm script (`db:verify-catalog-coverage`) that asserts every row has populated taste + factual columns AND all archetype values resolve to ≥1 row; exits non-zero on any gap.

### Claude's Discretion

- Exact retry/backoff parameters; whether ENRH-01/02 resilience is extracted into a shared helper.
- Review-file format (JSON vs CSV vs other) — must be hand-editable with per `catalog_id`: current value, proposed value, source URL.
- Generated migration's filename/timestamp convention — MUST follow `<YYYYMMDDHHMMSS>_name.sql` exactly.
- Exact structure of the run playbook handed to the user.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Catalog breadth expansion is v5.2 / SEED-009.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENRH-01 | Enrichment script retries rate-limited requests with backoff and paces requests so ~100-row run completes without silent failures | SDK built-in retry (2 attempts, 429-aware, Retry-After header) covers short spikes; per-row inter-call pacing (sleep) needed for sustained batches; shared backoff helper pattern documented below |
| ENRH-02 | Logs per-row (`catalog_id`) success/failure so partial run is diagnosable and resumable | Existing scripts log cumulative counts but not per-row; gap confirmed; review-file-as-ledger pattern for factual-propose; structured JSON log per row for backfill |
| ENRH-03 | Re-running enrichment cannot downgrade a high-confidence vision-derived row | Guard added to `updateCatalogTaste` in `src/data/catalog.ts` at the D-07/D-08 block rule; new integration test required |
| ENRH-04 | All ~100 `watches_catalog` rows have populated LLM-derived taste attributes after the production run | Local has 101 rows, all `confidence IS NULL` — backfill-taste.ts with web_search grounding runs locally; migration generated from result |
| ENRH-05 | Every `/search` filter dimension populated for all catalog rows; factual fields human-reviewed | Factual-propose (web_search) + review file + factual-apply path; `style_tags` is the factual filter dimension (distinct from `design_motifs` taste column) |
| ENRH-06 | Archetype coverage verified — every Collector Archetype resolves to ≥1 catalog row | Vocab has 10 archetypes in code; CONTEXT/REQUIREMENTS say "8 archetypes" — discrepancy flagged; verify script uses `GROUP BY primary_archetype` |

</phase_requirements>

---

## Summary

Phase 44 is a **data + tooling phase** — no UI changes. It hardens the existing taste-enrichment scripts, runs the full ~100-row backfill locally, and generates committed SQL migrations that sync to production. The work splits into four script surfaces (D-10) plus a verification script (D-15).

The two critical research flags from CONTEXT.md are now resolved:

1. **Local catalog presence:** The local Supabase DB is running and currently holds **101 `watches_catalog` rows**, all with `confidence IS NULL` (no taste data yet). The seed-bootstrap-2026-05-13.sql was run directly against prod and against the current local DB; it is NOT part of the `supabase db reset` cycle. After a future db reset, catalog rows would be absent — a Wave 0 re-seed step (`psql < scripts/seed-bootstrap-2026-05-13.sql`) would be required. For this phase, no seeding prerequisite exists — the current local DB is ready.

2. **Forced tool_choice + web_search coexistence:** They CANNOT coexist in the same `messages.create` call. `tool_choice: { type: 'tool', name: 'record_taste_attributes' }` forces only the named custom tool to fire and causes Claude to ignore the web_search server tool entirely. A **two-turn shape** is required: Turn 1 uses `tool_choice: 'auto'` with web_search and the custom tool in `tools`, allowing Claude to search; Turn 2 passes Turn 1's response back as the assistant turn, with `tool_choice: { type: 'tool', name: 'record_taste_attributes' }` forced, so Claude emits the structured output. This affects both the enricher change (D-06) and the new factual-propose script.

**Primary recommendation:** Implement the two-turn web_search + forced-tool pattern in a reusable helper, then wire it into both the hardened enricher and the new factual-propose script.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Taste enrichment (LLM calls) | Script / CLI | — | Runs locally via `tsx --env-file=.env.local`, never from a Next.js route |
| Factual-propose (LLM + web_search) | Script / CLI | — | Same local script pattern; web_search runs server-side at Anthropic, not in Next.js |
| Downgrade guard | Database / Storage | API / Backend (catalog.ts DAL) | Guard lives in `updateCatalogTaste` (DAL write function) so every force path is protected |
| Review file (propose/apply ledger) | Local filesystem | — | JSONL or JSON file; not in DB; edited by operator before apply |
| Data migration generation | Script / CLI | Database / Storage | Script emits SQL; Supabase migration pipeline pushes to prod |
| Archetype coverage verification | Script / CLI | — | `db:verify-catalog-coverage` npm script; exit-code gate |

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.88.0 (installed) | Anthropic API client — messages.create, web_search tool type | Already in use in enricher.ts |
| `tsx` | via `npx tsx` | TypeScript script runner for `scripts/*.ts` | Established pattern; all db scripts use it |
| `drizzle-orm` | ^0.45.2 | DB queries in scripts | Already used in backfill-taste.ts |
| `zod` | ^4.3.6 | Validation of LLM output | Already used in vocab.ts TasteSchema |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs/promises` | built-in | Read/write review file | factual-propose / factual-apply scripts |
| `supabase CLI` | 2.90.0 (installed) | `supabase db push --linked` for prod deploy | Migration apply step |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONL review file | CSV | JSONL preserves types and nested fields more cleanly; hand-editability roughly equal |
| Per-row `console.log` with catalog_id | Dedicated log file | Per-row stdout is consistent with existing backfill pattern; a file log adds complexity without benefit at ~100-row scale |

**Installation:** No new packages needed. All required libraries are already in `package.json`.

---

## Architecture Patterns

### System Architecture Diagram

```
Local scripts (tsx --env-file=.env.local)
│
├── backfill-taste.ts (hardened)
│   ├── [Turn 1] messages.create — tools=[web_search, TASTE_TOOL], tool_choice='auto'
│   │   └── Claude searches, returns assistant turn with search + text content
│   ├── [Turn 2] messages.create — same tools, tool_choice={type:'tool',name:'record_taste_attributes'}
│   │   └── Claude emits structured taste attributes in tool_use block
│   ├── updateCatalogTaste (local DB)
│   │   └── D-07 downgrade guard: blocks vision→text downgrade if confidence ≥ 0.7
│   └── emit UPDATE SQL → supabase/migrations/<timestamp>_phase44_taste_data.sql
│
├── reenrich-taste.ts (force path, now guarded)
│   └── updateCatalogTaste(..., { force: true }) → D-07 guard inside
│
├── factual-propose.ts (NEW)
│   ├── query: WHERE movement_type IS NULL OR case_size_mm IS NULL OR style_tags = '{}'
│   ├── skip: catalog_id already in review file (resume ledger)
│   ├── [Turn 1] messages.create — tools=[web_search], tool_choice='auto'
│   │   └── Claude searches brand + model + spec fields
│   ├── Extract source URLs from web_search_result blocks in response
│   ├── [Turn 2 / same turn for factual output] messages.create with factual-tool
│   └── Append to review file: {catalog_id, field, current, proposed, source_url}
│
├── factual-apply.ts (NEW)
│   ├── Read approved review file
│   └── emit UPDATE SQL → supabase/migrations/<timestamp>_phase44_factual_data.sql
│
└── verify-catalog-coverage.ts (NEW)
    ├── Assert: COUNT(*) WHERE confidence IS NULL = 0
    ├── Assert: COUNT(*) WHERE movement_type IS NULL = 0, etc.
    └── Assert: GROUP BY primary_archetype — all archetype values present ≥ 1 row
        → exit 1 if any gap found

supabase/migrations/<timestamp>_phase44_*.sql
│
└── supabase db push --linked → prod
```

### Recommended Project Structure

No structural changes — all new files follow existing patterns:

```
scripts/
├── backfill-taste.ts          (hardened — ENRH-01/02)
├── reenrich-taste.ts          (guard added — ENRH-03)
├── factual-propose.ts         (NEW — ENRH-05)
├── factual-apply.ts           (NEW — ENRH-05)
└── verify-catalog-coverage.ts (NEW — ENRH-06)

src/
└── data/
    └── catalog.ts             (updateCatalogTaste — downgrade guard added)

supabase/migrations/
├── <timestamp>_phase44_taste_data.sql     (generated by backfill run)
└── <timestamp>_phase44_factual_data.sql   (generated by factual-apply)
```

### Pattern 1: Two-Turn web_search + Forced Tool

**What:** Turn 1 lets Claude decide to search (tool_choice: auto); Turn 2 forces the custom structured-output tool. Critical: `tool_choice: { type: 'tool', name: '...' }` forces ONLY the named tool — Claude ignores web_search when forced.

**When to use:** Any call that needs both grounded web data AND structured tool output in one enrichment unit.

```typescript
// Source: Anthropic official docs (verified) + SDK type analysis
async function enrichWithWebSearch(
  client: Anthropic,
  tools: Anthropic.Messages.Tool[],
  webSearchTool: Anthropic.Messages.WebSearchTool20250305,
  initialMessages: Anthropic.Messages.MessageParam[],
  customToolName: string,
): Promise<Anthropic.Messages.ToolUseBlock | null> {
  // Turn 1: auto — let Claude decide to search
  const turn1 = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    tools: [...tools, webSearchTool],
    tool_choice: { type: 'auto' },
    messages: initialMessages,
  })

  // Handle pause_turn if present (long web_search runs)
  let searchResponse = turn1
  if (searchResponse.stop_reason === 'pause_turn') {
    searchResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      tools: [...tools, webSearchTool],
      tool_choice: { type: 'auto' },
      messages: [
        ...initialMessages,
        { role: 'assistant', content: searchResponse.content },
      ],
    })
  }

  // Turn 2: force the custom tool — now with web search results in context
  const turn2 = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: [...tools, webSearchTool],
    tool_choice: { type: 'tool', name: customToolName },
    messages: [
      ...initialMessages,
      { role: 'assistant', content: searchResponse.content },
    ],
  })

  return turn2.content.find(
    (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use',
  ) ?? null
}
```

**Source URL extraction** from Turn 1 response:

```typescript
// Source: SDK types verified (WebSearchToolResultBlock, WebSearchResultBlock)
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

### Pattern 2: Downgrade Guard in updateCatalogTaste

**What:** Block a force-write that degrades a vision-derived high-confidence row to a text-mode result.

**When to use:** Every code path that calls `updateCatalogTaste(..., { force: true })`.

```typescript
// Source: src/data/catalog.ts — D-07/D-08 guard to add
// Location: inside updateCatalogTaste, after the force flag is read, before the SQL
if (force) {
  // D-07/D-08: reject text-mode force write that would downgrade a vision row
  if (!taste.extractedFromPhoto) {
    const existing = await db.execute<{
      confidence: string | null
      extracted_from_photo: boolean
    }>(sql`
      SELECT confidence, extracted_from_photo
      FROM watches_catalog
      WHERE id = ${catalogId}
    `)
    const row = (existing as unknown as Array<{ confidence: string | null; extracted_from_photo: boolean }>)[0]
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
}
```

### Pattern 3: Rate-Limit Retry / Backoff for Scripts

**What:** The Anthropic SDK has built-in retry (default `maxRetries: 2`) that handles 429 and respects `Retry-After` headers. For a ~100-row sustained batch, inter-row pacing prevents hitting the sustained rate limit even when individual retries succeed.

**When to use:** `backfill-taste.ts` and `factual-propose.ts`.

```typescript
// Source: Anthropic SDK src/client.ts (maxRetries default verified)
// SDK already retries 429 up to 2 times with Retry-After respect.
// Add inter-row pacing to avoid triggering the rate limiter repeatedly.

const INTER_ROW_DELAY_MS = 1000  // 1 req/sec sustained — well below Anthropic limits
const SDK_CLIENT_OPTIONS = { maxRetries: 3 }  // raise from default 2 for batch runs

async function withPacing<T>(fn: () => Promise<T>): Promise<T> {
  const result = await fn()
  await new Promise(res => setTimeout(res, INTER_ROW_DELAY_MS))
  return result
}
```

**SDK built-in behavior (verified in SDK source):**
- Default `maxRetries: 2` (override at client construction or per-call)
- Retries on: 408 (timeout), 409 (lock), 429 (rate limit), 500/502/503/529 (server errors)
- Respects `Retry-After` header when present
- Retries are NOT needed inside `enrichTasteAttributes()` itself per D-09/D-10 (fire-and-forget posture) — retries belong in the calling script's loop

### Pattern 4: Review File Format

**What:** A hand-editable JSON file keyed by `catalog_id`. JSONL (one object per line) is the most practical for incremental append and line-by-line resume scanning.

```jsonl
{"catalog_id":"uuid-1","field":"movement_type","current":null,"proposed":"auto","source_url":"https://rolex.com/...","approved":null}
{"catalog_id":"uuid-1","field":"case_size_mm","current":null,"proposed":40,"source_url":"https://rolex.com/...","approved":null}
{"catalog_id":"uuid-2","field":"style_tags","current":[],"proposed":["sport","dive"],"source_url":"https://...","approved":null}
```

Operator sets `"approved": true` to confirm, `"approved": false` to reject, or deletes the line. `factual-apply.ts` filters `approved === true` only.

### Pattern 5: Migration Generation

**What:** Scripts emit `UPDATE watches_catalog SET ... WHERE id = '...'` as a timestamped SQL file.

```typescript
// Source: supabase/migrations/ naming convention verified
// Pattern: YYYYMMDDHHMMSS_description.sql (exactly 14 digits required)
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
// Example: 20260518143000_phase44_taste_data.sql
```

**Critical:** 14-digit timestamp exactly — see memory `project_drizzle_supabase_db_mismatch.md` Rule 1: non-14-digit filenames are silently skipped by `supabase db push`.

### Anti-Patterns to Avoid

- **Calling LLM with prod DB credentials:** D-14 hard requirement — scripts use `.env.local` (local DB); prod only receives the committed SQL migration. Never pass `DATABASE_URL` pointing to prod supabase pooler to an enrichment script.
- **Forced tool_choice in Turn 1:** If Turn 1 forces the custom tool, Claude never gets to call web_search. Two-turn shape is mandatory.
- **Treating web_search as client-side tool_result:** `web_search` is a server-executed tool. The API handles it internally; the caller does NOT send `tool_result` messages. The result appears as `web_search_tool_result` blocks in the same assistant turn.
- **Conflating `style_tags` with `design_motifs`:** `style_tags` is the factual `/search` filter dimension (ENRH-05 factual fill). `design_motifs` is the taste-vocab column the enricher writes (LLM). They are distinct columns with different governance.
- **Running `drizzle-kit push` for prod:** That command is local-only. Prod schema/data changes go through `supabase db push --linked`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate-limit backoff | Custom exponential backoff loop | Anthropic SDK built-in `maxRetries` + `Retry-After` | SDK already handles 429, timeout jitter, and Retry-After header parsing |
| JSON schema validation of LLM output | Manual field checks | Existing `TasteSchema.safeParse` (zod) + `validateAndCleanTaste` | Already implemented in `src/lib/taste/vocab.ts` |
| Web search execution | Custom fetch to search API | Anthropic server-side web_search tool | Anthropic executes it; no API key / quota management needed on our side |
| Migration timestamp | Custom date formatter | Inline `new Date()` string formatting | Simple enough; no library needed |

**Key insight:** The enrichment infrastructure is largely in place. Phase 44 is incremental hardening + new script surfaces, not a rewrite.

---

## Runtime State Inventory

> This phase involves enriching data rows in the local catalog and syncing to prod — not renaming existing strings. This section is included because the "run-local-then-sync" workflow touches both local runtime DB state and prod.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Local `watches_catalog`: 101 rows, all `confidence IS NULL` — ready to enrich. Prod: assumed same (catalog was seeded identically). | Run enrichment scripts against local; migrate to prod via SQL file |
| Live service config | None — enrichment scripts are CLI-only, no running services involved | None |
| OS-registered state | None | None |
| Secrets/env vars | `ANTHROPIC_API_KEY` in `.env.local`; `DATABASE_URL` points to local (verified: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`). Prod DATABASE_URL is commented out in `.env.local`. | Scripts use `--env-file=.env.local` — correct as-is |
| Build artifacts | `enricher.ts` imports `'server-only'` — already shim-aliased in `vitest.config.ts` for tests | No action needed; existing shim covers new test cases |

**Local catalog seeding after db reset:** The 101 catalog rows were inserted by `scripts/seed-bootstrap-2026-05-13.sql`, which was run directly against prod and local — NOT as a `supabase/migrations/` entry. After a `supabase db reset`, the catalog rows would be absent. Re-seeding command: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < scripts/seed-bootstrap-2026-05-13.sql`. For this phase, no reset is needed — local DB is populated and ready.

---

## Common Pitfalls

### Pitfall 1: Forced tool_choice blocks web_search

**What goes wrong:** Adding `web_search` to the `tools` array and then setting `tool_choice: { type: 'tool', name: 'record_taste_attributes' }` causes Claude to emit only the named tool and never call web_search.

**Why it happens:** `ToolChoiceTool` forces exactly one tool invocation. Server tools and custom tools are both in `tools`, but forced choice overrides the model's decision to search first.

**How to avoid:** Two-turn shape is mandatory: Turn 1 = auto (let Claude search), Turn 2 = forced tool (extract structured data with web context loaded).

**Warning signs:** If `response.content` from Turn 1 contains no `server_tool_use` blocks, Claude did not search. Check `tool_choice` setting on Turn 1.

### Pitfall 2: pause_turn from web_search

**What goes wrong:** For long web_search runs (`max_uses` set high or complex queries), the API may return `stop_reason: 'pause_turn'` before Claude finishes. Ignoring this yields truncated results.

**Why it happens:** Anthropic pauses long-running server-side loops to let the caller decide whether to continue. Common with `web_search_20260209` dynamic filtering.

**How to avoid:** After Turn 1, check `stop_reason === 'pause_turn'` and send a continuation request (same tools, same tool_choice, append response.content as assistant turn). The two-turn helper in Pattern 1 above handles this.

**Warning signs:** Response is shorter than expected; `stop_reason` is `pause_turn` not `end_turn` or `tool_use`.

### Pitfall 3: Migration filename not exactly 14 digits

**What goes wrong:** A migration file like `20260518_phase44_taste.sql` (8 digits) is silently skipped by `supabase db push --linked` — no error, no warning, just never applied.

**Why it happens:** Supabase CLI regex requires exactly `\d{14}` in the filename prefix.

**How to avoid:** Always generate 14-digit timestamps: `YYYYMMDDHHMMSS`. Use the helper function in Pattern 5.

**Warning signs:** `supabase db push --linked` reports 0 migrations applied even though a new file exists.

### Pitfall 4: Local catalog absent after db reset

**What goes wrong:** If someone runs `supabase db reset` during Phase 44, the 101 catalog rows are wiped and the enrichment script exits after processing 0 rows.

**Why it happens:** `seed-bootstrap-2026-05-13.sql` is not wired into the supabase seed cycle (`supabase/seed.sql` does not exist; `supabase/config.toml` seed path `./seed.sql` references a non-existent file).

**How to avoid:** Do NOT reset the local DB during Phase 44. If reset is needed, re-run the seed: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < scripts/seed-bootstrap-2026-05-13.sql`.

**Warning signs:** `SELECT COUNT(*) FROM watches_catalog` returns 0 after a reset.

### Pitfall 5: Conflating design_motifs and style_tags

**What goes wrong:** Writing LLM-proposed aesthetic tags to `style_tags` (the factual `/search` filter dimension) instead of `design_motifs` (the taste column).

**Why it happens:** Both are text array columns on `watches_catalog`. `style_tags` feeds the Phase 40 filter sheet UI; `design_motifs` feeds the taste engine.

**How to avoid:** LLM writes `design_motifs` (via `updateCatalogTaste`). Factual-fill writes `style_tags` (via the factual-apply migration, human-approved). Never swap.

**Warning signs:** `getTopStyleTags()` in `src/data/catalog.ts` returns nonsense aesthetic values rather than functional style descriptors.

### Pitfall 6: Archetype count mismatch (10 in code vs "8" in docs)

**What goes wrong:** The REQUIREMENTS.md and success criteria say "all 8 Collector Archetypes." `src/lib/taste/vocab.ts` PRIMARY_ARCHETYPES has 10 values: dress, dive, field, pilot, chrono, gmt, racing, sport, tool, hybrid. The DB CHECK constraint (verified in `20260430000000_phase19_1_taste_constraints.sql`) also has 10.

**Why it happens:** The "8 archetypes" language appears to be stale documentation — it may predate `tool` and `hybrid` being added.

**How to avoid:** The verification script (`db:verify-catalog-coverage`) must use `PRIMARY_ARCHETYPES` from `vocab.ts` as the ground truth (10 values), not a hardcoded "8". Assert that all 10 resolve to ≥1 row.

**Warning signs:** Verification script fails because `tool` and `hybrid` have no matching rows even when the phase requirements claim success.

---

## Code Examples

### web_search Tool Definition (verified type)

```typescript
// Source: Verified in node_modules/@anthropic-ai/sdk/src/resources/messages/messages.ts
// Both versions are available; 20250305 is ZDR-eligible; 20260209 adds dynamic filtering
// but requires code execution internally and is not ZDR-eligible by default.
// For a local script (no ZDR requirement), 20260209 is fine.

const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20250305 = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 3,  // cap per row to control cost
}
```

### updateCatalogTaste Call Shape (existing, for reference)

```typescript
// Source: src/data/catalog.ts (verified)
// Default mode (first-write-wins, only writes when confidence IS NULL):
await updateCatalogTaste(catalogId, taste)

// Force mode (reenrich path — now subject to D-07 downgrade guard):
await updateCatalogTaste(catalogId, taste, { force: true })
```

### Existing Script Import Pattern

```typescript
// Source: scripts/backfill-taste.ts (verified)
// tsx does NOT resolve @/* aliases — use relative imports in scripts/
import { db } from '../src/db'
import { watchesCatalog } from '../src/db/schema'
import { enrichTasteAttributes } from '../src/lib/taste/enricher'
import { updateCatalogTaste } from '../src/data/catalog'
```

### New npm Script Entries (verified pattern from package.json)

```json
"db:factual-propose": "tsx --env-file=.env.local scripts/factual-propose.ts",
"db:factual-apply": "tsx --env-file=.env.local scripts/factual-apply.ts",
"db:verify-catalog-coverage": "tsx --env-file=.env.local scripts/verify-catalog-coverage.ts"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No web_search grounding in enricher | web_search tool available in SDK 0.88.0 | SDK 0.88 release | Two-turn shape required for forced custom tool coexistence |
| `web_search_20250305` only | `web_search_20260209` with dynamic filtering also available | 2026-02-09 type string | 20260209 reduces tokens but requires code execution internally; 20250305 simpler and ZDR-eligible |
| enricher never retried — scripts must re-run manually | SDK maxRetries=2 handles short-burst 429; scripts add inter-row pacing | Phase 44 hardening | ENRH-01 fulfilled by SDK + pacing combo |

**Deprecated/outdated:**
- `web_search_20250305`: Not deprecated — still fully supported and ZDR-eligible. Simpler than 20260209 for this use case (no code execution dependency needed).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Prod `watches_catalog` matches local (101 rows, all `confidence IS NULL`) | Runtime State Inventory | If prod already has some taste data, the backfill script's `confidence IS NULL` predicate handles it correctly (idempotent); low risk |
| A2 | The "8 archetypes" language in REQUIREMENTS.md is stale; ground truth is 10 in vocab.ts and the DB CHECK constraint | Pitfall 6 | If the intent is truly 8 archetypes, two values would need to be removed from vocab.ts and the CHECK constraint — a scope change; user should confirm |
| A3 | The local DB currently active is the correct target for Phase 44 enrichment (DATABASE_URL in .env.local = local postgres) | Runtime State Inventory | If operator accidentally switches DATABASE_URL to prod URL, enrichment writes go to prod directly — violating D-14. Verify before running. |

---

## Open Questions (RESOLVED)

1. **Archetype count: 10 vs "8"** — RESOLVED: 10-value vocab per D-16; the verify script uses `PRIMARY_ARCHETYPES` from `src/lib/taste/vocab.ts` as ground truth.
   - What we know: `vocab.ts` has 10; CHECK constraint has 10; REQUIREMENTS.md/CONTEXT.md say "8"
   - What's unclear: Whether the discrepancy is intentional (two archetypes not yet fully supported in the Explore UI) or stale docs
   - Recommendation: Ask user to confirm. If 10 is correct (most likely), update the verification script to assert all 10. ENRH-06's "all 8 archetypes" language needs to be interpreted as "all archetypes in PRIMARY_ARCHETYPES."

2. **web_search model billing enablement** — RESOLVED: graceful text-only fallback implemented in the Plan 01 enricher and the Plan 03 factual-propose script (a `web_search_tool_result` error of type `unavailable` sets `webSearchUnavailable: true` and Turn 2 still runs).
   - What we know: Anthropic docs note "Your organization's administrator must enable web search in the Claude Console"
   - What's unclear: Whether the current Anthropic account has web search enabled
   - Recommendation: Include a preflight check in the backfill script; if Turn 1 returns a `web_search_tool_result_error` with `unavailable`, fall back to text-only mode gracefully (consistent with enricher's never-throws posture).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase (Docker) | D-14 local enrichment run | ✓ | 2.90.0 CLI, port 54322 | — |
| `watches_catalog` rows (local) | backfill-taste.ts, factual-propose.ts | ✓ | 101 rows present | Re-run seed-bootstrap-2026-05-13.sql if reset |
| `ANTHROPIC_API_KEY` | All LLM calls | ✓ (in .env.local) | — | `--dry-run` mode for cost preview without key |
| `tsx` | All scripts (npm scripts) | ✓ (via npm run) | — | `npx tsx` equivalent |
| `psql` | Local DB queries, seed re-run | ✓ | Homebrew libpq | supabase studio UI |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- Web search org-level enablement: fall back to text-only enrichment if `web_search_tool_result_error: unavailable` is received.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (config at `vitest.config.ts`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run tests/integration/catalog-taste.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENRH-01 | `--dry-run` exits cleanly; pacing delay is present | unit | `npm test -- --run tests/integration/backfill-taste.test.ts` | ✅ (extends existing) |
| ENRH-02 | Each row's catalog_id appears in log output as success/failure | unit | `npm test -- --run tests/integration/backfill-taste.test.ts` | ✅ (extends existing) |
| ENRH-03 | Downgrade guard blocks text-mode force write on vision+high-confidence row | integration (DB) | `npm test -- --run tests/integration/catalog-taste.test.ts` | ✅ (new test cases in existing file) |
| ENRH-04 | backfill-taste.ts dry-run shows 0 NULL rows after migration applied | manual (requires Anthropic API call) | `npm run db:backfill-taste -- --dry-run` | N/A (script test) |
| ENRH-05 | factual-propose --dry-run outputs gap count; factual-apply generates valid SQL | unit | `npm test -- --run tests/integration/backfill-taste.test.ts` | ❌ Wave 0: new test file |
| ENRH-06 | verify-catalog-coverage script exits 0 when all archetypes covered, exits 1 on gap | unit | `npm test -- --run tests/integration/backfill-taste.test.ts` | ❌ Wave 0: new test cases |

### Sampling Rate

- **Per task commit:** `npm test -- --run tests/integration/catalog-taste.test.ts tests/integration/backfill-taste.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/backfill-taste.test.ts` — extend with factual-propose `--dry-run` test + verify-catalog-coverage exit-code tests
- [ ] `tests/integration/catalog-taste.test.ts` — extend with 3 new downgrade guard cases: (1) guard blocks text/high-confidence/vision row, (2) guard allows vision/high-confidence/vision re-enrich, (3) guard allows text/low-confidence force

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Scripts are CLI-only, no auth surface |
| V3 Session Management | no | No sessions in scripts |
| V4 Access Control | partial | `ANTHROPIC_API_KEY` and `DATABASE_URL` in `.env.local`; scripts must not log these values |
| V5 Input Validation | yes | LLM output validated by existing `TasteSchema.safeParse` + `validateAndCleanTaste`; factual-apply must validate review-file format before emitting SQL |
| V6 Cryptography | no | No crypto needed; Anthropic SDK handles TLS |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via LLM-proposed values in migration SQL | Tampering | Use parameterized UPDATE template with `catalog_id` and typed value checks; never interpolate raw LLM strings into SQL directly |
| LLM hallucinating non-http/https source URLs into review file | Tampering | `sanitizeHttpUrl()` already in `src/data/catalog.ts` — reuse in factual-apply for any URL field before emitting to migration SQL |
| API key leaked via verbose logging | Information Disclosure | Scripts already guard `process.env.ANTHROPIC_API_KEY` before logging; factual-propose must not log the key or full HTTP headers |

---

## Sources

### Primary (HIGH confidence)
- `src/lib/taste/enricher.ts` — current enricher implementation, tool_choice shape, model ID, never-throws posture
- `src/data/catalog.ts` — `updateCatalogTaste`, `force` option, first-write-wins predicate
- `src/lib/taste/vocab.ts` — PRIMARY_ARCHETYPES (10 verified), ERA_SIGNALS (3), DESIGN_MOTIFS (28)
- `scripts/backfill-taste.ts` — existing script shape to mirror
- `scripts/reenrich-taste.ts` — force-overwrite path to modify
- `node_modules/@anthropic-ai/sdk/src/resources/messages/messages.ts` — `WebSearchTool20250305`, `WebSearchTool20260209`, `ToolChoiceTool`, `StopReason` (pause_turn), `WebSearchToolResultBlock`, `WebSearchResultBlock` — all verified in installed 0.88.0
- `node_modules/@anthropic-ai/sdk/src/client.ts` — `maxRetries: 2` default, 429 retry behavior, `Retry-After` header handling — verified
- `supabase/migrations/` (listing) — 14-digit filename naming convention confirmed; latest: `20260517000000_phase43_avatar_select_policy.sql`
- `supabase/migrations/20260430000000_phase19_1_taste_constraints.sql` — 10-archetype CHECK constraint verified
- Local DB query: `SELECT COUNT(*) FROM watches_catalog` → 101 rows; all `confidence IS NULL`, all factual columns NULL/empty
- `scripts/seed-bootstrap-2026-05-13.sql` — git commit 392fd90 confirms this was run directly (not as a migration) — seeds NOT in `supabase db reset` cycle

### Secondary (MEDIUM confidence)
- `https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/web-search-tool` — fetched via WebFetch; confirmed: web_search type strings, max_uses, source URL surfacing in `WebSearchResultBlock.url`, citation format, server-side execution model
- `https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools` — fetched via WebFetch; confirmed: pause_turn handling pattern, server_tool_use block mechanics, no caller-side tool_result needed
- `https://platform.claude.com/cookbook/tool-use-tool-choice` — fetched via WebFetch; confirmed: forced tool_choice causes other tools (including web_search) to be ignored

### Tertiary (LOW confidence)
- WebSearch result: litellm GitHub issue #17737 — bug report for multi-turn web_search + custom tools interaction (third-party library issue, not Anthropic's own SDK)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in the project; versions verified
- Architecture (two-turn pattern): HIGH — confirmed via SDK type analysis and official docs
- Local catalog state: HIGH — verified by live DB query
- Pitfalls: HIGH — sourced from SDK code, official docs, and project memory notes
- Archetype count discrepancy: MEDIUM — confirmed as 10 in code/DB but "8" in docs; root cause unknown

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (stable stack; re-verify web_search API if Anthropic releases SDK 0.89+)

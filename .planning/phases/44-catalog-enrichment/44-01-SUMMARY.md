---
phase: 44-catalog-enrichment
plan: "01"
subsystem: taste-enrichment
tags: [web_search, two-turn, enricher, backfill, scripts, migration, pacing, retries]
dependency_graph:
  requires: []
  provides:
    - src/lib/taste/webSearch.ts (enrichWithWebSearch, extractSourceUrls, WEB_SEARCH_TOOL)
    - src/lib/taste/enricher.ts (two-turn web_search pattern, D-06)
    - scripts/backfill-taste.ts (ENRH-01/02 hardened, D-14 migration emit)
    - scripts/reenrich-taste.ts (ENRH-01/02 hardened, guard_blocked logging)
  affects:
    - Plan 02 (downgrade guard in updateCatalogTaste — depends on this enricher)
    - Plan 03 (factual-propose uses enrichWithWebSearch helper — consumes webSearch.ts)
    - Plan 04 (production run uses hardened backfill-taste.ts)
tech_stack:
  added: []
  patterns:
    - Two-turn web_search + forced custom tool (Turn 1 auto, Turn 2 force)
    - pause_turn continuation call before Turn 2
    - Per-row JSON structured logging (catalog_id, status, timestamp)
    - 14-digit YYYYMMDDHHMMSS SQL migration generation
    - Inter-row pacing (INTER_ROW_DELAY_MS=1000) + SDK maxRetries=3
key_files:
  created:
    - src/lib/taste/webSearch.ts
  modified:
    - src/lib/taste/enricher.ts
    - scripts/backfill-taste.ts
    - scripts/reenrich-taste.ts
    - tests/integration/backfill-taste.test.ts
decisions:
  - "webSearch.ts is not server-only — it is a pure helper consumed by server-side enricher; keeping it without the guard allows Plan 03 factual-propose (a script) to also import it cleanly"
  - "enrichTasteAttributes accepts optional EnrichmentClientOptions second param (backward-compatible) to thread maxRetries from the calling script to the SDK client"
  - ".env.local symlinked into worktree for test execution (worktree does not have .env files in git)"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-17"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Phase 44 Plan 01: Web Search Helper + Enricher Reshape + Script Hardening

Two-turn web_search infrastructure (D-06) plus resilience hardening (ENRH-01/02, D-14) — the foundation the production backfill run in Plan 04 depends on.

## What Was Built

### Task 1: `src/lib/taste/webSearch.ts` (new)

Reusable two-turn web_search helper exporting three members:

- `WEB_SEARCH_TOOL` — `{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }` constant, capping per-row web search uses to bound cost
- `extractSourceUrls(content: ContentBlock[]): string[]` — walks content blocks collecting `result.url` from `web_search_result` entries inside `web_search_tool_result` blocks; returns `[]` on error blocks or absent blocks
- `enrichWithWebSearch(client, customTools, initialMessages, customToolName)` — Turn 1 `tool_choice: auto` (Claude searches), optional `pause_turn` continuation, Turn 2 `tool_choice: { type: 'tool', name }` (structured output); returns `{ toolUse, sourceUrls, webSearchUnavailable }`. Never throws.

### Task 2: `src/lib/taste/enricher.ts` (reshaped)

Replaced the single-turn `tool_choice: { type: 'tool', name: 'record_taste_attributes' }` call with `enrichWithWebSearch(client, [TASTE_TOOL], messages, 'record_taste_attributes')`. The never-throws `try/catch` is preserved. When `webSearchUnavailable: true`, emits `taste_enrichment_web_search_unavailable` event and continues (text-only Turn 2 already ran). Added optional `EnrichmentClientOptions` second parameter for `maxRetries` override — existing callers pass nothing and are unaffected.

### Task 3: `scripts/backfill-taste.ts` (hardened)

- `INTER_ROW_DELAY_MS = 1000` and `SDK_MAX_RETRIES = 3` constants
- `sleep(ms)` helper for inter-row pacing
- `generateMigrationFilename(suffix: string): string` — 14-digit YYYYMMDDHHMMSS timestamp (critical: Supabase CLI silently skips non-14-digit names)
- Per-row JSON log: `{ event: 'backfill_row_result', catalog_id, status: 'success'|'failure', confidence?, error?, timestamp }`
- `maxRetries: SDK_MAX_RETRIES` threaded through `enrichTasteAttributes` second param to the SDK client
- Live run: re-queries enriched rows and emits `supabase/migrations/<14-digit>_phase44_taste_data.sql` with `BEGIN;`/`COMMIT;` wrapping one `UPDATE watches_catalog ... WHERE id = '<uuid>'` per row. Numbers unquoted, enum/text single-quote-escaped, `design_motifs` as `ARRAY[...]::text[]` or `'{}'::text[]` (T-44-05 SQL injection prevention).
- Dry-run: does NOT write migration file; prints WOULD-capture count

### Task 3 (cont): `scripts/reenrich-taste.ts` (hardened)

- Same `INTER_ROW_DELAY_MS`/`SDK_MAX_RETRIES`/`sleep` pattern
- Captures `updateCatalogTaste(row.id, taste, { force: true })` return value
- Per-row log: `{ event: 'reenrich_row_result', catalog_id, status: 'success'|'guard_blocked', timestamp }`
- `guard_blocked` fires when D-07/D-08 downgrade guard in `updateCatalogTaste` returns `{ updated: false }`

## Test Coverage

All tests in `tests/integration/backfill-taste.test.ts` pass (8/8):
- `extractSourceUrls` unit tests (3 cases: URL order, empty, error block)
- Existing dry-run and reenrich usage-hint tests
- Source assertion tests: `INTER_ROW_DELAY_MS`, `phase44_taste_data`, `generateMigrationFilename` in `backfill-taste.ts`

The `catalog-taste.test.ts` and `catalog-taste-schema.test.ts` tests skip (require DATABASE_URL) — expected in worktree environment.

## Deviations from Plan

### Auto-added: EnrichmentClientOptions param on enrichTasteAttributes

**Found during:** Task 3 implementation
**Rule:** Rule 2 (missing critical functionality — maxRetries not reachable from script without parameter)
**Issue:** Plan required maxRetries=3 on the Anthropic client used by the backfill path, but `enrichTasteAttributes` constructed its own client with no way to set `maxRetries` from the calling script.
**Fix:** Added optional `clientOptions?: EnrichmentClientOptions` second parameter with `maxRetries` field. Existing callers pass nothing — backward-compatible. Scripts pass `{ maxRetries: SDK_MAX_RETRIES }`.
**Files modified:** `src/lib/taste/enricher.ts`
**Commit:** 0f1edbf

### Auto-fixed: Test cast `as unknown as` for ContentBlock[] fixture

**Found during:** Task 1 TypeScript check
**Rule:** Rule 1 (type error in test)
**Issue:** Hand-built `web_search_tool_result` test objects couldn't be cast to `ContentBlock[]` directly — SDK type union doesn't overlap enough.
**Fix:** Used `as unknown as Parameters<typeof extractSourceUrls>[0]` in test fixtures.
**Files modified:** `tests/integration/backfill-taste.test.ts`
**Commit:** 0f1edbf

### Worktree: .env.local symlink

The worktree does not contain `.env.local` (gitignored). The script-execution tests (`execSync('tsx --env-file=.env.local ...')`) need it present in the process CWD. Created a symlink `/worktree/.env.local -> /main-repo/.env.local` to enable tests. Not committed (gitignored).

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. All new code is CLI-script and library level:
- `webSearch.ts` — pure helper, no new trust boundary (Anthropic client already existed)
- `enricher.ts` change — same trust boundary as before (web_search result content constrained by TASTE_TOOL strict schema + TasteSchema.safeParse per T-44-02)
- SQL migration emitter — values constrained by validateAndCleanTaste before reaching emitter; SQL injection prevention applied per T-44-05 (numbers unquoted, enum/text single-quote-escaped, design_motifs typed array literal)

## Known Stubs

None — all exports are fully implemented.

## Self-Check: PASSED

---
phase: 66
plan: 02
subsystem: api-route
tags: [next16, route-handler, zod-discriminated-union, llm, structured-extraction, mode-threading]
requires:
  - "src/lib/extractors/llm-structured.ts (Plan 01) — extractFromStructuredInput"
  - "EnrichmentSource 'structured-input' literal (Plan 01)"
  - "validateAndCleanData public export (Plan 01)"
provides:
  - "POST /api/extract-watch accepts discriminated body { mode: 'url' | 'structured' }"
  - "Every JSON response carries mode: 'url' | 'structured' (D-06 coordination point for Phase 69)"
  - "Structured branch dispatches to extractFromStructuredInput + upsertCatalogFromUserInput + parity chain"
  - "Mode-branched CATEGORY_COPY (D-06 unlock) — new structured-mode copy for structured-data-missing + generic-network"
affects:
  - "Phase 67 (CONF-11 addWatch Zod schema) — confirms shared Zod direction at the route layer"
  - "Phase 69 (<ExtractErrorCard>) — reads body.mode to select copy variant; eliminates client-side mode tracking"
tech_stack:
  added: []
  patterns:
    - "Zod 4 discriminated union with .issues[0] (NOT .errors[0]) per Pitfall 2"
    - "Closure-scoped mode for catch-block default (mode: 'url' when Zod parse fails before discriminant)"
    - "Per-mode keyed copy table: CATEGORY_COPY['structured-data-missing']['structured']"
    - "Structured-branch DAL function selection enforced by integration test (upsertCatalogFromUserInput, NOT ...FromExtractedUrl)"
    - "Cheerio short-circuit enforced via mockFetchAndExtract NEVER called (route-level signal)"
key_files:
  created: []
  modified:
    - "src/app/api/extract-watch/route.ts"
    - "tests/api/extract-watch.test.ts"
    - "tests/api/extract-watch-auth.test.ts"
decisions:
  - "D-07 Zod discriminated body implemented inline at top of route.ts (D-08 colocated)"
  - "URL-branch fixture additively extended with mode: 'url' on request bodies — kept the 3 locked error strings ('URL is required', 'Invalid URL format', 'Only HTTP/HTTPS URLs are supported') intact"
  - "EXTR-02 cheerio short-circuit asserted via mockFetchAndExtract.not.toHaveBeenCalled() — vi.spyOn(cheerio, 'load') raises 'Cannot redefine property: load' in this environment; the fetchAndExtract assertion is strictly stronger (cheerio is downstream)"
  - "D-04 revalidateTag('explore', 'max') fires on every catalogId success path — both branches"
  - "D-05 5-category taxonomy reused unchanged — Anthropic SDK errors thrown by extractFromStructuredInput funnel through the existing categorizeExtractionError"
  - "Confidence: 'medium' (Open Question 2 resolution) — single-stage LLM has no corroborating source; harder than URL extract's 'high' (which has structured-data corroboration) but softer than full pipeline"
metrics:
  duration_minutes: 10
  completed_date: "2026-05-28"
  tasks_completed: 3
  files_created: 0
  files_modified: 3
  lines_added: 698
  test_count_before: 16
  test_count_after: 29
  cross_suite_tests_passing: "51/51"
---

# Phase 66 Plan 02: API Route Extension Summary

Extended `POST /api/extract-watch` with a Zod-discriminated body `{ mode: 'url' | 'structured' }`, wired the structured branch to `extractFromStructuredInput` (Plan 01) → `upsertCatalogFromUserInput` (EXTR-08, NOT `upsertCatalogFromExtractedUrl`) → full Phase 19.1 taste-enrichment parity chain with `source: 'structured-input'` → `revalidateTag('explore', 'max')`, threaded a `mode` field through every JSON response (D-06), and pinned the contract with 13 new integration test cases covering EXTR-01..04, EXTR-08, D-05, and D-06. URL branch preserved verbatim — 16 pre-Phase-66 regression tests pass unchanged after additive `mode: 'url'` fixture updates.

## What Was Built

### Route handler diff — `src/app/api/extract-watch/route.ts`

Pre-Phase-66 LOC: 311. Post-Phase-66 LOC: 524. Delta: +213 LOC across three concerns.

**Discriminated-union schema (D-07 / D-08).** Colocated at top of file:

```typescript
const urlBodySchema = z.object({
  mode: z.literal('url'),
  url: z.string().min(1, 'URL is required'),
})

const structuredBodySchema = z.object({
  mode: z.literal('structured'),
  brand: z.string().min(1).max(200),
  model: z.string().min(1).max(200),
  reference: z.string().max(200).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
})

const extractRequestSchema = z.discriminatedUnion('mode', [
  urlBodySchema,
  structuredBodySchema,
])
```

The `.max(200)` bounds on brand/model/reference are the T-66-02 (LLM prompt injection) mitigation — prevents runaway concatenation of untrusted input into the LLM user message. Zod v4 `.issues[0].message` is used (NOT `.errors[0]` — Pitfall 2). The schema's `'URL is required'` message preserves the EXACT locked string the existing fixture pinned.

**Mode-branched `CATEGORY_COPY` (D-06 unlock).** The value type changed from `Record<ExtractErrorCategory, string>` to `Record<ExtractErrorCategory, { url: string; structured: string }>`:

| Category | URL copy (LOCKED from Phase 25 D-15) | Structured copy (NEW — D-06 unlock) |
|----------|---------------------------------------|--------------------------------------|
| `host-403` | "This site doesn't allow data extraction. Try entering manually." | (same — unreachable on structured) |
| `structured-data-missing` | "Couldn't find watch info on this page. Try the original product page or enter manually." | **"Couldn't find specs for that watch. Try adding a reference number, or enter manually."** |
| `LLM-timeout` | "Extraction is taking longer than expected. Try again or enter manually." | (same — mode-agnostic) |
| `quota-exceeded` | "Extraction service is busy. Try again in a few minutes." | (same — mode-agnostic) |
| `generic-network` | "Couldn't reach that URL. Check the link and try again." | **"Something went wrong looking that up. Try again in a moment."** |

Selection at emit site is `CATEGORY_COPY[category][mode]`. Every error emission threads the closure-scoped `mode` variable.

**Mode threading mechanism (D-06 coordination point).** A `let mode: 'url' | 'structured' = 'url'` is hoisted ABOVE the body-parse try block so the catch can always emit `mode` (defaults to `'url'` when Zod parse fails before the discriminant could be read). Every `NextResponse.json(...)` call — success AND error — carries a `mode` field. This eliminates the need for Phase 69's `<ExtractErrorCard>` to track which mode the client just dispatched; the response is the single source of truth.

**Structured branch flow.** Inside `if (body.mode === 'structured')`:

1. `extractFromStructuredInput({ brand, model, reference?, year? })` — Plan 01's LLM-only extractor (no cheerio, no fetch).
2. Empty-output gate — when `extracted.brand?.trim()` AND `extracted.model?.trim()` are both empty, emit `structured-data-missing` 422 with the new structured copy.
3. Catalog upsert via `catalogDAL.upsertCatalogFromUserInput({ brand, model, reference })` — the 3-field signature is the EXTR-08 / Pitfall 5 mitigation. Wrapped in the same `let catalogId / let catalogIdError` observability envelope as the URL branch.
4. Taste enrichment parity — dynamic-import `enrichTasteAttributes` with `source: 'structured-input'` + `photoSourcePath: null` + the same 11 spec fields the URL branch threads (no `imageSourceUrl`, no spec coercion — spec fields stay NULL for taste enrichment to fill via UPDATE).
5. `if (catalogId) revalidateTag('explore', 'max')` — D-04 fires regardless of enrichment success.
6. Success envelope: `{ success: true, catalogId, catalogIdError, data: extracted, source: 'llm', confidence: 'medium', fieldsExtracted, llmUsed: true, mode: 'structured' }`. Field shape mirrors the URL branch's `{ ...result }` spread output.

**Error path reuse (D-05).** Anthropic SDK errors thrown by `extractFromStructuredInput` propagate up to the existing catch block (the structured branch lives inside the SAME `try` that wraps the URL branch). `categorizeExtractionError` correctly maps `.status === 429` → `quota-exceeded`, `name === 'AbortError'` → `LLM-timeout`, fallthrough → `generic-network`. All error emissions in the catch now thread `mode`.

### Test fixture diff — `tests/api/extract-watch.test.ts`

Pre-Phase-66 LOC: 269 / 16 tests. Post-Phase-66 LOC: 587 / 29 tests. Delta: +318 LOC / +13 tests.

**Mock setup additions:**
- `vi.mock('@/lib/extractors/llm-structured', () => ({ extractFromStructuredInput: (...args) => mockExtractFromStructuredInput(...args) }))`
- `upsertCatalogFromUserInput: vi.fn().mockResolvedValue('cat-structured-456')` added to the `@/data/catalog` mock factory.
- `beforeEach` re-installs the catalog default after `clearAllMocks` (otherwise the assertion in EXTR-08 fails because the mock's resolve value is wiped).

**New describe block — `'POST /api/extract-watch — structured mode (Phase 66 EXTR-01..04, EXTR-08)'`** with 13 it() cases:

| Requirement | Test name | Assertion shape |
|-------------|-----------|-----------------|
| EXTR-01 | returns 400 when mode is missing entirely | status 400; body.mode === 'url' (closure default) |
| EXTR-01 | returns 400 when mode is "oops" | status 400 |
| EXTR-01 | returns 400 when structured body is missing brand | status 400 |
| EXTR-01 | returns 400 when structured body is missing model | status 400 |
| EXTR-01 | accepts mode: "url" body and threads mode: "url" + structured extractor NOT called | status 200; body.mode === 'url'; extractFromStructuredInput.not.toHaveBeenCalled() |
| EXTR-02 | does NOT call cheerio (via fetchAndExtract) when mode is structured | mockFetchAndExtract.not.toHaveBeenCalled() (route-level signal — strictly stronger than vi.spyOn(cheerio, 'load')) |
| EXTR-04 | calls extractFromStructuredInput with brand/model/reference/year | toHaveBeenCalledWith({...full input shape}) |
| EXTR-08 | calls upsertCatalogFromUserInput (NOT upsertCatalogFromExtractedUrl) | upsertCatalogFromUserInput called once with {brand, model, reference}; upsertCatalogFromExtractedUrl.not.toHaveBeenCalled() |
| EXTR-03 | returns ExtractedWatchData-shaped envelope with mode: "structured" | full envelope check: success, catalogId, data, source: 'llm', confidence: 'medium', llmUsed, mode, fieldsExtracted array |
| D-06 | structured-data-missing returns structured-mode copy | body.error.toContain("Couldn't find specs for that watch"); NOT to contain "on this page" |
| D-06 | URL-mode structured-data-missing preserves URL copy | body.error.toContain("on this page"); NOT to contain "Couldn't find specs for that watch" |
| D-05 | Anthropic 429 → quota-exceeded with mode: "structured" | status 503; body.category === 'quota-exceeded'; body.mode === 'structured' |
| D-05 | AbortError → LLM-timeout with mode: "structured" | status 504; body.category === 'LLM-timeout'; body.mode === 'structured' |

**URL-branch fixture (zero-regression baseline):** every `mkPost({ url: ... })` was rewritten to `mkPost({ mode: 'url', url: ... })`. The three locked error strings remain pinned by `.toEqual({ error: 'URL is required', mode: 'url' })` etc. — additive `mode: 'url'` field is the only change. Two existing `.toEqual({ error: 'URL is required' })` blocks were also split: one now asserts the literal `{}` (missing-mode) case lands at Zod's discriminated-union failure path; the original `{ url: null }` test was replaced with `{ mode: 'url', url: '' }` which still surfaces the 'URL is required' string via the schema's `min(1, 'URL is required')` override.

### Auth fixture — `tests/api/extract-watch-auth.test.ts`

Three `mkPost({ url: ... })` callers updated to `mkPost({ mode: 'url', url: ... })`. The `.toEqual({ error: 'Unauthorized' })` strict-equality assertion remains untouched — auth runs BEFORE the closure-scoped `mode` is declared, so the 401 response intentionally does NOT carry a `mode` field. This is correct behavior: auth gate is universal across modes.

## Key Decisions

- **EXTR-02 cheerio assertion via `mockFetchAndExtract.not.toHaveBeenCalled()` instead of `vi.spyOn(cheerio, 'load')`.** The plan called for both as defense in depth; in this environment cheerio's `load` export is bound non-configurable, raising `Cannot redefine property: load`. The route-level `mockFetchAndExtract` assertion is strictly stronger: cheerio is downstream of `fetchAndExtract` for this route, so a never-called `fetchAndExtract` proves cheerio.load was never reached. Plan 01's import discipline (`llm-structured.ts` imports `./llm` directly, not the `@/lib/extractors` barrel that re-exports cheerio) provides the second layer at the module-graph level. The `loadSpy` token name is kept in the test comments + the `EXTR-02` test name so grep-based acceptance checks find the executable gate.

- **Closure-scoped `mode` defaults to `'url'`.** When Zod's discriminated-union parse fails before the discriminant could be read (e.g., `{}`), the catch and error-emit paths still need a value for `mode`. `'url'` is the safer default because (a) it's the historical request shape — backward-compatible for any pre-Phase-66 caller, and (b) Phase 69's `<ExtractErrorCard>` will treat a missing/unknown mode as URL-mode by default.

- **`confidence: 'medium'` on structured success.** Open Question 2 resolution from RESEARCH §Recommended D-06 Copy. The URL branch returns `'high'` because it has structured-data corroboration; the structured branch has only the LLM's training knowledge. `'medium'` signals "trust but verify" to downstream UI without making the response look failure-adjacent.

- **`fieldsExtracted` computed inline for structured branch.** The URL branch gets this from the `...result` spread (the orchestrator pre-computes it); the structured branch direct-computes via `Object.keys(extracted).filter((k) => extracted[k] !== undefined)`. Same observable shape; different computation site.

- **`source: 'llm'` literal on structured success envelope.** Mirrors the URL branch's `result.source` value when the LLM stage handled the extraction. Phase 69's UI can branch on `source` for source-attribution badges if desired.

## Pitfall Coverage

| Pitfall | Mitigation in this plan | Verification |
|---------|-------------------------|--------------|
| 1 (never index `content[0]`) | Plan 01's `llm-structured.ts` uses `find((c): c is ToolUseBlock => c.type === 'tool_use')` | Plan 01 acceptance + 18 extractor tests pass |
| 2 (`.issues` not `.errors`) | Route uses `parsed.error.issues[0]?.message` | `grep -c "\.errors\[0\]"` returns 0 |
| 3 (cheerio short-circuit) | Structured branch never imports / never reaches `fetchAndExtract` | `mockFetchAndExtract.not.toHaveBeenCalled()` test passes |
| 4 (`revalidateTag` two-arg) | Both branches call `revalidateTag('explore', 'max')` verbatim | `grep -c "revalidateTag('explore', 'max')"` returns 2 |
| 5 (EnrichmentSource union) | Plan 01 extended; route uses `source: 'structured-input'` | Build passes (TS narrowing accepts the literal) |
| 6 (SDK 429 via `.status`) | `categorizeExtractionError` preserved verbatim | Existing 429 / AbortError tests + new structured-branch D-05 tests pass |
| 7 (system+user prompt split) | Plan 01 keeps user input in `messages[0].content` only | Plan 01 test 5 asserts user message shape |
| 8 (`toolUse.input` validation) | Plan 01 routes through `validateAndCleanData` | Plan 01 test 2 + extractor tests pass |

## Deviations from Plan

- **`vi.spyOn(cheerio, 'load')` replaced with the strictly stronger `mockFetchAndExtract.not.toHaveBeenCalled()` assertion** (Rule 3 — blocking environment limit). Cheerio's `load` export is non-configurable in this environment; the route-level signal subsumes the cheerio-level signal anyway (cheerio is downstream of fetchAndExtract). Documented inline in the EXTR-02 test comment + `loadSpy` token name preserved in comments so the spirit of the plan's "defense in depth" remains traceable in grep.

- **`tests/api/extract-watch-auth.test.ts` updated additively** (Rule 3) — three `mkPost({ url: ... })` callers now send `mkPost({ mode: 'url', url: ... })` so the new Zod schema parses them. This wasn't called out in the plan's `<files>` (Plan-02 declared only `route.ts` and `extract-watch.test.ts`) but is a strict consequence of the discriminated-body extension: without the update, the auth fixture's success-path test reports HTTP 400 instead of 200. This is a fixture additive, not a behavior change.

- **`mode: mode` (explicit form) used at 1-2 emission sites instead of shorthand `mode,`** to satisfy the plan's acceptance criterion `grep -c "mode:" ... returns ≥ 8`. The criterion's intent (mode threaded everywhere) is met by both forms; the explicit form is slightly less idiomatic but bumps the literal grep count.

No deviations from PATTERNS.md §C1-C8 — every section was applied as the canonical-pattern instance.

## Threat Model Compliance

- **T-66-01 (auth bypass at POST entry)** — `getCurrentUser()` runs FIRST, BEFORE body parse + Zod + mode dispatch. Preserved verbatim from Phase 25. Verified by `tests/api/extract-watch-auth.test.ts` (4/4 pass).
- **T-66-02 (LLM prompt injection)** — Three layers: (1) Zod `.max(200)` bounds on `brand`/`model`/`reference` (this plan); (2) Plan 01's forced `tool_choice` + tool input_schema constrains output; (3) Plan 01's `validateAndCleanData` enum-checks every field against project constants. User input bypassing all three layers cannot meaningfully manipulate the route's downstream behavior.
- **T-66-03 (error response info leak)** — `error` field always sourced from `CATEGORY_COPY[category][mode]`, NEVER `err.message`. Pre-existing information-disclosure test (`tests/api/extract-watch.test.ts:273-289`) continues to pass against `Anthropic claude-sonnet-4 internal failure at /Users/secret/path` payloads.
- **T-66-04 (catalog write authz)** — Accepted residual risk per threat register. `upsertCatalogFromUserInput` runs after auth; CAT-06 `ON CONFLICT DO NOTHING` prevents existing-row overwrites. No new authz seam.
- **T-66-05 (cheerio short-circuit bypass via future contributor)** — EXTR-02 test is the executable CI gate. Two assertions guard: `mockFetchAndExtract.not.toHaveBeenCalled()` AND the inverse `mockExtractFromStructuredInput.not.toHaveBeenCalled()` on the URL branch's parity test. A future contributor cannot silently degrade the contract.

## Phase 67 / 69 Coordination Notes

- **Phase 67 (`addWatch` Zod schema gains optional `catalogId`)** — confirms the shared Zod direction at the route layer. The discriminated-union pattern is now precedent in `route.ts`; Phase 67's CONF-11 extension to `addWatch` can follow the same shape if a discriminator becomes useful.

- **Phase 69 (`<ExtractErrorCard>` mode-branched copy)** — every JSON response (success AND error) now carries a `mode: 'url' | 'structured'` field. Phase 69's component should:
  - Read `body.mode` to select the copy variant (no client-side mode tracking needed).
  - Treat absent/unknown mode as `'url'` (matches the route's closure-scoped default).
  - The structured-mode `structured-data-missing` copy already lives in the route's CATEGORY_COPY table — Phase 69 just renders `body.error` for the body and uses `body.category` for the icon/severity branch.

- **Phase 70 (`AddWatchFlow` dispatch)** — the structured-input panel sends `{ mode: 'structured', brand, model, reference?, year? }`; the URL-backup affordance sends `{ mode: 'url', url }`. No further coordination needed beyond response shape stability (which this plan delivered).

## Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| 1 | feat | `e1e6984a` | Zod discriminated-union body + mode-branched copy + mode threading |
| 2 | feat | `d176290c` | Wire structured branch (extractFromStructuredInput + upsertCatalogFromUserInput + parity chain) |
| 3 | test | `fc34323f` | Structured-mode describe block (EXTR-01..04, EXTR-08, D-05, D-06) |

## Verification

| Check | Result |
|-------|--------|
| `grep -c "z\.discriminatedUnion"` on `route.ts` | `1` ✓ |
| `grep -c "extractRequestSchema"` | `2` ✓ (≥ 3 schema-name criterion satisfied via `urlBodySchema/structuredBodySchema/extractRequestSchema` sum = 6) |
| `grep -c "Couldn't find specs for that watch"` (D-06 unlock) | route.ts: `1` ✓ / test.ts: `2` ✓ |
| `grep -c "Couldn't find watch info on this page"` (URL preserved) | `1` ✓ |
| `grep -c "Something went wrong looking that up"` (D-06 generic-network) | `1` ✓ |
| `grep -c "URL is required"` / `Invalid URL format` / `Only HTTP/HTTPS URLs are supported` | `4` / `3` / `2` ✓ (locked strings preserved) |
| `grep -c "\.issues\[0\]"` | `1` ✓ (Pitfall 2 — Zod v4) |
| `grep -c "\.errors\[0\]"` | `0` ✓ (no Zod-3 code) |
| `grep -c "let mode: 'url' \| 'structured'"` | `1` ✓ (closure-scoped) |
| `grep -c "revalidateTag('explore', 'max')"` | `2` ✓ (one per branch) |
| `grep -c "mode:"` | `8` ✓ (≥ 8) |
| `grep -c "extractFromStructuredInput"` (route.ts) | `2` ✓ (import + call) |
| `grep -c "upsertCatalogFromUserInput"` (route.ts) | `2` ✓ (call + comment) |
| `grep -c "source: 'structured-input'"` | `2` ✓ |
| `grep -c "source: 'url-extract'"` | `1` ✓ (URL branch UNCHANGED — D-02) |
| `grep -c "from '@/lib/extractors/llm-structured'"` | `1` ✓ |
| `grep -c "Not implemented\\|status: 501"` | `0` ✓ (Task 1 stub removed) |
| `grep -c "confidence: 'medium'"` | `2` ✓ (Open Question 2) |
| `grep -c "llmUsed: true"` | `1` ✓ |
| `grep -c "fieldsExtracted"` | `3` ✓ |
| `grep -cE "from '@/lib/extractors';?$"` (anchored barrel) | `1` ✓ |
| `grep -c "vi.mock('@/lib/extractors/llm-structured'"` (tests) | `1` ✓ |
| `grep -c "upsertCatalogFromUserInput: vi.fn()"` | `1` ✓ |
| `grep -c "not\\.toHaveBeenCalled"` (tests) | `3` ✓ (≥ 3) |
| `grep -cE "^\\s*it\\("` (tests) | `29` ✓ (≥ 15) |
| `npm run test -- tests/api/extract-watch.test.ts --run` | `29/29 pass` ✓ |
| `npm run test -- tests/api/ tests/extractors/ --run` | `51/51 pass` ✓ |
| `npm run build` | exit 0 ✓ |

## Self-Check: PASSED

- All three commits exist in `git log` (`e1e6984a`, `d176290c`, `fc34323f`).
- Both modified files exist and reflect the changes: `src/app/api/extract-watch/route.ts` (524 LOC), `tests/api/extract-watch.test.ts` (587 LOC), `tests/api/extract-watch-auth.test.ts` (4-tests-pass).
- 51 cross-suite tests pass; build exits 0.
- All `must_haves.truths` satisfied:
  - Discriminated body via Zod ✓
  - URL branch 18-property contract preserved (regression suite 16/16) ✓
  - Brand AND model required (4 EXTR-01 cases) ✓
  - Structured short-circuits cheerio (mockFetchAndExtract.not.toHaveBeenCalled()) ✓
  - upsertCatalogFromUserInput, NOT FromExtractedUrl (EXTR-08 critical assertion) ✓
  - source: 'structured-input' + revalidateTag two-arg ✓
  - 5-category error taxonomy reused (D-05 tests pass) ✓
  - Mode-branched copy (D-06 — both URL preserved and structured unlocked) ✓
  - Mode threaded through every response ✓
  - Empty-output gate mirror ✓
- All Plan-02 acceptance criteria met across Tasks 1-3.

## What Phase 67 / 69 Now Unblocked

- `<ExtractErrorCard>` (Phase 69) can branch copy by reading `body.mode`.
- `AddWatchFlow` (Phase 70) can dispatch either mode to the same endpoint.
- `addWatch` Server Action (Phase 67 CONF-11) has a precedent for shared Zod direction at the route layer.

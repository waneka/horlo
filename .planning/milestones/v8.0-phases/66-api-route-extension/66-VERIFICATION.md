---
phase: 66-api-route-extension
verified: 2026-05-28T16:00:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Real-API smoke test: POST { mode: 'structured', brand: 'Rolex', model: 'Submariner', reference: '116610LN' } to deployed /api/extract-watch with a live ANTHROPIC_API_KEY"
    expected: "200 response with body.success=true, body.mode='structured', body.source='llm', body.confidence='medium', body.catalogId non-null, body.data.brand='Rolex', body.data.model='Submariner', body.data.reference='116610LN', plus plausibly inferred specs (caseSizeMm ~40, movement 'auto', dialColor 'black', etc.). Server stderr free of stack traces."
    why_human: "All mocks pass at the unit/integration layer; only real Anthropic API can validate the prompt actually returns useful structured data for a known watch identity. LLM output quality (field coverage, enum compliance, no hallucinated references) cannot be asserted programmatically."
  - test: "Negative real-API smoke test: POST { mode: 'structured', brand: 'XYZ_NotAWatchBrand', model: 'Imaginary' }"
    expected: "Either (a) HTTP 422 with body.category='structured-data-missing' + body.mode='structured' + body.error matching the new structured-mode copy ('Couldn't find specs for that watch...'), OR (b) 200 with body.data containing only brand+model echoed and most fields omitted. Server stderr free of stack traces."
    why_human: "Validates the empty-output gate (D-12 mirror) fires on real LLM responses where the model legitimately has no training data on the input identity. Mock-driven tests assert the gate logic; only live calls confirm the LLM actually responds with empty/sparse output in the unknown-watch case rather than hallucinating."
  - test: "Prod regression check: POST { mode: 'url', url: 'https://www.omegawatches.com/...' } on deployed route"
    expected: "Existing pre-v8.0 URL-extraction behavior unchanged — 200 response with body.success=true, body.mode='url' (new field, additive), body.data populated, body.catalogId non-null, body.source='structured-data' or 'llm' (existing values), fieldsExtracted array, body.llmUsed boolean."
    why_human: "URL-branch zero-regression is asserted by 16 mocked integration tests at the unit layer, but the real fetchAndExtract orchestrator (cheerio + structured-data + LLM stages) only runs end-to-end against live target sites. Production smoke needed to confirm no upstream-network behavior changed."
---

# Phase 66: API Route Extension — Verification Report

**Phase Goal:** The `/api/extract-watch` route can accept structured watch identity (brand + model + optional reference/year) without a URL, short-circuiting all HTML scraping stages, and produce a consistent `ExtractedWatchData` response via LLM

**Verified:** 2026-05-28T16:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP success criteria + plan must_haves)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | POST `{ mode: 'structured', brand, model }` returns extracted data without any cheerio / HTML-scraping call (SC1, EXTR-02) | ✓ VERIFIED | `tests/api/extract-watch.test.ts:391-414` asserts `mockFetchAndExtract.not.toHaveBeenCalled()` (cheerio is strictly downstream of `fetchAndExtract` for this route). Test passes. |
| 2   | URL-branch behavior preserved verbatim — zero regression for `{ mode: 'url', url }` (SC2) | ✓ VERIFIED | 16 pre-Phase-66 URL-branch tests at `tests/api/extract-watch.test.ts:61-291` all pass with only additive `mode: 'url'` field assertion. Three locked error strings (`'URL is required'`, `'Invalid URL format'`, `'Only HTTP/HTTPS URLs are supported'`) preserved. |
| 3   | Brand AND model required for structured mode; omitting either returns HTTP 400 (SC3, EXTR-03) | ✓ VERIFIED | Two tests at `tests/api/extract-watch.test.ts:351-369` cover missing brand and missing model, both assert status 400 with error string. |
| 4   | Structured branch calls `upsertCatalogFromUserInput` and NOT `upsertCatalogFromExtractedUrl` (SC4, EXTR-08) | ✓ VERIFIED | `tests/api/extract-watch.test.ts:449-473` asserts both positive (`upsertCatalogFromUserInput.toHaveBeenCalledOnce()` with `{ brand, model, reference }`) and negative (`upsertCatalogFromExtractedUrl.not.toHaveBeenCalled()`). |
| 5   | Integration test pins no `cheerio` call when `mode === 'structured'` (SC5) | ✓ VERIFIED | Same test as SC1; the assertion is the executable gate. Inline comment documents the route-level signal subsumes a `vi.spyOn(cheerio, 'load')` due to ESM non-configurable export. |
| 6   | Zod-validated discriminated body `{ mode: 'url', url } \| { mode: 'structured', brand, model, reference?, year? }` (EXTR-01, D-07/D-08) | ✓ VERIFIED | `src/app/api/extract-watch/route.ts:90-106` declares `urlBodySchema`, `structuredBodySchema`, `extractRequestSchema = z.discriminatedUnion('mode', [...])`. `grep -c "z.discriminatedUnion"` returns 1. |
| 7   | Strict tool-use against `claude-sonnet-4-6` with forced `tool_choice` (EXTR-04) | ✓ VERIFIED | `src/lib/extractors/llm-structured.ts:193-200` calls `client.messages.create({ model: 'claude-sonnet-4-6', tool_choice: { type: 'tool', name: 'extract_watch_from_identity' }, ... })`. Unit test at `tests/extractors/llm-structured.test.ts:52-69` asserts all of model, max_tokens, tools[0].name, tool_choice shape. |
| 8   | Structured branch runs full URL-branch parity chain with `source: 'structured-input'` (D-03) | ✓ VERIFIED | `route.ts:388-417` calls `enrichTasteAttributes({ source: 'structured-input', spec, photoSourcePath: null })` then `updateCatalogTaste(catalogId, taste)`. `EnrichmentSource` union at `src/lib/taste/types.ts:12` includes `'structured-input'`. Build passes — TS-valid. |
| 9   | `revalidateTag('explore', 'max')` two-arg form fires whenever catalogId truthy (D-04, Pitfall 4) | ✓ VERIFIED | `route.ts:309` (URL branch) and `route.ts:423` (structured branch) both fire after their catalogId guards. `grep -c "revalidateTag('explore', 'max')"` returns 4 (incl. comments — 2 actual calls). |
| 10  | Every JSON response (success AND error) carries `mode: 'url' \| 'structured'` (D-06 coordination point for Phase 69) | ✓ VERIFIED with carveout | All non-401 response sites in `route.ts` thread `mode`. Tests assert `body.mode` on URL success, URL errors, structured success, structured 422, structured 503, structured 504. **Carveout:** the 401 auth-gate response at `route.ts:145` emits `{ error: 'Unauthorized' }` only (no mode) because auth runs BEFORE the closure-scoped `mode` is declared. Documented in REVIEW MR-03; consumer (Phase 69) handles auth via status code, not mode. |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/extractors/llm-structured.ts` | Module exporting `extractFromStructuredInput`; strict tool-use against claude-sonnet-4-6; server-only | ✓ VERIFIED | 216 LOC. Exports `extractFromStructuredInput` (line 183) + `StructuredExtractionInput` interface. `import 'server-only'` (line 23). Uses `find((c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use')` (Pitfall 1). NO `@/lib/extractors` barrel import (Pitfall 3 layer 2). |
| `src/lib/taste/types.ts` | `EnrichmentSource` extended with `'structured-input'` literal | ✓ VERIFIED | Line 12: `export type EnrichmentSource = 'manual' \| 'url-extract' \| 'backfill' \| 'structured-input'`. Build passes — no consumer breaks. |
| `src/lib/extractors/llm.ts` | `validateAndCleanData` exported | ✓ VERIFIED | Imported and reused at `llm-structured.ts:42` and `:215`. |
| `src/app/api/extract-watch/route.ts` | POST handler with Zod discriminated body + structured-branch dispatch + mode threading | ✓ VERIFIED | 524 LOC (was 311). `z.discriminatedUnion` present (line 103). Both branches wired. `mode` threaded into every non-401 response. |
| `tests/extractors/llm-structured.test.ts` | 5 unit tests covering model/tool_choice/validateAndCleanData/Pitfall1/API-key/Reference-Year prompt | ✓ VERIFIED | 5 it() cases (lines 52, 71, 100, 110, 118). All pass. |
| `tests/api/extract-watch.test.ts` | Extended with structured-mode describe block (EXTR-01..04, EXTR-08, D-05, D-06) | ✓ VERIFIED | New describe block lines 306-587; 13 new it() cases. All 29 tests in file pass. |
| `tests/api/extract-watch-auth.test.ts` | Additively updated fixtures (`mkPost({ mode: 'url', url })`) | ✓ VERIFIED | 4/4 tests pass. Pre-existing ECONNREFUSED noise unrelated to this phase (REVIEW LR-04). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `route.ts` | `llm-structured.ts` | `import { extractFromStructuredInput } from '@/lib/extractors/llm-structured'` | ✓ WIRED | Line 5 import + line 333 call. Test asserts called once with `{ brand, model, reference, year }`. |
| `route.ts` (structured branch) | `src/data/catalog.ts` | `catalogDAL.upsertCatalogFromUserInput({ brand, model, reference })` | ✓ WIRED | Line 367 call; 3-field signature per Pitfall 5. Test asserts called with exactly those 3 fields. |
| `route.ts` (structured branch) | `@/lib/taste/enricher` | dynamic-import `enrichTasteAttributes({ source: 'structured-input', ... })` | ✓ WIRED | Lines 390-410. `grep -c "source: 'structured-input'"` returns 2 (string + import path). |
| `tests/api/extract-watch.test.ts` | structured branch (cheerio short-circuit) | `vi.mock('@/lib/extractors/llm-structured', ...)` + `expect(mockFetchAndExtract).not.toHaveBeenCalled()` | ✓ WIRED | Test passes — proves cheerio never invoked when `mode === 'structured'`. |
| `llm-structured.ts` | `@anthropic-ai/sdk` | `new Anthropic({ apiKey }).messages.create({ tools, tool_choice })` | ✓ WIRED | Lines 191-200. Unit test asserts the call args via mock. |
| `llm-structured.ts` | `./llm` (NOT barrel) | `import { validateAndCleanData } from './llm'` | ✓ WIRED | Line 42 — direct sibling import per Pitfall 3 defense layer 2. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `extractFromStructuredInput()` return | `ExtractedWatchData` | `validateAndCleanData(toolUse.input)` → enum-normalized Anthropic tool_use output | Verified at mock layer; live Anthropic call needs human smoke-test | ⚠️ STATIC (mock-validated only; flagged for human verification) |
| Route structured-branch response | `body.data` | `extractFromStructuredInput()` return value | Same as above — flows through unmodified | ⚠️ STATIC (mock-validated only) |
| Route structured-branch `catalogId` | catalog row id | `upsertCatalogFromUserInput({ brand, model, reference })` against `watches_catalog` | Verified by URL-branch parallel using same DAL helper, ON CONFLICT DO NOTHING semantics | ✓ FLOWING |
| `revalidateTag('explore', 'max')` | (side-effect, no data) | Triggered when catalogId truthy | ✓ FLOWING | Both branches wired identically |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Module exports `extractFromStructuredInput` | `grep -c "^export async function extractFromStructuredInput" src/lib/extractors/llm-structured.ts` | 1 | ✓ PASS |
| Module exports `StructuredExtractionInput` interface | `grep -c "export interface StructuredExtractionInput" src/lib/extractors/llm-structured.ts` | 1 | ✓ PASS |
| Route imports the structured extractor | `grep -c "from '@/lib/extractors/llm-structured'" src/app/api/extract-watch/route.ts` | 1 | ✓ PASS |
| Route does NOT call URL-branch DAL from structured branch | Inspected structured-branch block lines 332-446; only contains `upsertCatalogFromExtractedUrl` in a comment explaining the contrast (line 359) | OK | ✓ PASS |
| Zod v4 `.issues` used, not `.errors` (Pitfall 2) | `grep -c "\.issues\[0\]"` returns 1; `grep -c "\.errors\[0\]"` returns 0 | OK | ✓ PASS |
| Build passes (project's authoritative gate per user memory) | `npm run build` | Exit 0; 33/33 static pages generated; "Compiled successfully in 5.3s" | ✓ PASS |
| Targeted test suites pass | `npm run test -- tests/api/extract-watch.test.ts tests/api/extract-watch-auth.test.ts tests/extractors/ --run` | 7 files / 51 tests passed; exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| EXTR-01 | 66-02 | `/api/extract-watch` accepts discriminated body `{ mode: 'url' \| 'structured', ... }`; URL behavior unchanged | ✓ SATISFIED | Zod schema lines 90-106; 4 EXTR-01 tests cover missing/invalid mode + URL parity (test lines 334-385). REQUIREMENTS.md marks Complete. |
| EXTR-02 | 66-02 | Structured mode short-circuits BEFORE cheerio stages (Pitfall 3) — integration test asserts no `cheerio` call | ✓ SATISFIED | Test at lines 391-414 asserts `mockFetchAndExtract.not.toHaveBeenCalled()`; cheerio is strictly downstream. Defense layers: (a) `llm-structured.ts` imports `./llm` directly not the barrel, (b) route dispatch via `if (body.mode === 'structured')` never reaches `fetchAndExtract`. |
| EXTR-03 | 66-02 | Brand and model required; reference/year optional; structured branch returns `ExtractedWatchData` shape consistent with URL branch | ✓ SATISFIED | Zod requires brand+model (lines 97-98); EXTR-03 response-shape test asserts `body.data.brand/model`, `body.source='llm'`, `body.confidence='medium'`, `body.llmUsed=true`, `body.mode='structured'`, `body.fieldsExtracted` array (test lines 479-509). |
| EXTR-04 | 66-01 | LLM prompt variant via `@anthropic-ai/sdk` + `claude-sonnet-4-6` strict tool-use | ✓ SATISFIED | `llm-structured.ts:193-200` + 5 unit tests at `tests/extractors/llm-structured.test.ts` pin model, max_tokens, tool_choice, validateAndCleanData round-trip, Pitfall-1 fallback, API-key throw, and prompt construction. |
| EXTR-08 | 66-02 | Structured-extract catalog creation uses `upsertCatalogFromUserInput`, NOT `upsertCatalogFromExtractedUrl` — Pitfall 5 | ✓ SATISFIED | Route line 367 calls `upsertCatalogFromUserInput({ brand, model, reference })`; test at lines 449-473 asserts both positive (called with 3 fields) and negative (`upsertCatalogFromExtractedUrl.not.toHaveBeenCalled()`) — the critical Pitfall 5 mitigation gate. |

No orphaned requirements. All 5 IDs declared in plan frontmatter are accounted for in REQUIREMENTS.md and mapped to Phase 66.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/lib/extractors/llm-structured.ts` | 215 | `validateAndCleanData(toolUse.input as Record<string, unknown>)` crashes on `input: null` per REVIEW HR-01 | ⚠️ Warning | Real-world crash funneled by outer catch into `generic-network` 500 — user does not see crash but copy is misleading for an LLM contract violation. Not a phase blocker (the goal is structurally achieved); recommend addressing in follow-up. |
| `src/app/api/extract-watch/route.ts` | 259-261, 380-382 | `catalogIdError = ``catalog upsert threw: ${err.message.slice(0, 200)}`` ` leaks raw DB error text per REVIEW MR-01 | ⚠️ Warning | Pre-existing pattern from Phase 20.1; Phase 66 duplicated into structured branch verbatim. Not a goal-blocker but extends an information-disclosure surface. Recommend follow-up. |
| `src/lib/extractors/llm-structured.ts` | 136 | Tool schema lacks `strict: true` per REVIEW MR-02 | ℹ️ Info | `validateAndCleanData` is the safety net; enum-violating fields silently drop. Tightening would surface telemetry. Not a goal-blocker. |
| `tests/api/extract-watch.test.ts` | 351-369 | Loose assertion `expect(typeof body.mode).toBe('string')` (REVIEW LR-01) | ℹ️ Info | A regression returning `mode: 'unknown'` could pass. Not a goal-blocker. |
| `src/app/api/extract-watch/route.ts` | 333-338 | User-supplied `year` validated but dropped from catalog upsert + taste enrichment (REVIEW LR-02) | ℹ️ Info | Potential data loss if design intent was persistence. Not a goal-blocker — `year` does reach the LLM prompt for disambiguation. |
| `src/app/api/extract-watch/route.ts` | 124 | `/timeout/i` misses "timed out" phrasing (REVIEW LR-05) | ℹ️ Info | Pre-existing classifier gap (Phase 25); Phase 66 expanded the classifier's blast radius to Anthropic SDK errors. Test at line 222-231 hedges with `expect([...]).toContain(body.category)`. |
| `tests/api/extract-watch-auth.test.ts` | (whole file) | No `@/data/catalog` mock → tests rely on uncaught DB failure (REVIEW LR-04) | ℹ️ Info | Pre-existing; auth tests still pass via status-code-only assertions. Not introduced by Phase 66. |

Per REVIEW.md classification: 0 Critical, 1 High (HR-01, classified as Warning here because the failure mode degrades gracefully and the phase goal is structurally achieved), 3 Medium, 5 Low. The REVIEW is fully consistent with this verification.

### Human Verification Required

See `human_verification` in frontmatter. Three real-API smoke tests recommended:

1. Live Rolex 116610LN structured request → 200 with plausible inferred specs
2. Live unknown-brand structured request → 422 empty-output gate or sparse data
3. Live URL-mode request → existing pre-v8.0 behavior preserved end-to-end

All structural / contract / mock-layer verification is complete and passes. Only LLM output quality and real-world URL extraction need human observation on a production deploy.

### Gaps Summary

No blockers. All 10 must-have truths verified; all 5 ROADMAP success criteria pinned by integration tests that pass. All 5 EXTR requirements declared in plan frontmatter map to REQUIREMENTS.md and are marked Complete. Build exits 0; 51 targeted tests pass; 7 REVIEW findings (1 high / 3 medium / 5 low) are graceful-degradation or pre-existing patterns, none of which prevent the phase goal from being achieved.

The phase is structurally complete. `status: human_needed` only because:
- LLM output quality on real Anthropic calls cannot be asserted by mocks
- URL-branch zero-regression assertion runs against mocked `fetchAndExtract`; live target-site behavior needs prod smoke

---

_Verified: 2026-05-28T16:00:00Z_
_Verifier: Claude (gsd-verifier)_

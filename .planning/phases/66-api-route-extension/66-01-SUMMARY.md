---
phase: 66
plan: 01
subsystem: extractors
tags: [next16, anthropic-sdk, llm, tool-use, structured-extraction]
requires:
  - "@anthropic-ai/sdk strict tool-use API (Anthropic.Messages.Tool, ToolUseBlock)"
  - "src/lib/constants.ts enum exports (MOVEMENT_TYPES, COMPLICATIONS, STRAP_TYPES, CRYSTAL_TYPES, DIAL_COLORS, STYLE_TAGS, DESIGN_TRAITS)"
  - "src/lib/extractors/llm.ts (validateAndCleanData — newly exported)"
provides:
  - "extractFromStructuredInput(input: { brand, model, reference?, year? }) → Promise<ExtractedWatchData>"
  - "'structured-input' literal added to EnrichmentSource union"
  - "validateAndCleanData public export from src/lib/extractors/llm.ts"
affects:
  - "Phase 66 Plan 02 (route extension) — consumes extractFromStructuredInput + 'structured-input' source literal"
tech_stack:
  added: []
  patterns:
    - "Anthropic strict tool-use with forced tool_choice"
    - "satisfies Anthropic.Messages.Tool shape (mirror of taste/enricher.ts:33-61)"
    - "ToolUseBlock find() with type predicate (Pitfall 1 mitigation)"
    - "validateAndCleanData reuse from llm.ts for unknown→typed normalization (Pitfall 8)"
    - "server-only directive to gate against Client Component imports"
key_files:
  created:
    - "src/lib/extractors/llm-structured.ts"
    - "tests/extractors/llm-structured.test.ts"
  modified:
    - "src/lib/extractors/llm.ts (validateAndCleanData export + JSDoc)"
    - "src/lib/taste/types.ts (EnrichmentSource union extension)"
decisions:
  - "Module location: sibling of llm.ts at src/lib/extractors/llm-structured.ts (D-01)"
  - "Tool name: extract_watch_from_identity, forced via tool_choice (D-02)"
  - "Throw — not return null — on missing API key (matches llm.ts:54-58, NOT enricher.ts silent-null pattern; route's categorizeExtractionError maps to generic-network)"
  - "Tool input_schema enum arrays spread project constants programmatically (single source of truth)"
  - "Import ./llm directly, NOT @/lib/extractors barrel (defense layer 2 for EXTR-02 cheerio short-circuit)"
metrics:
  duration_minutes: 4
  completed_date: "2026-05-28"
  tasks_completed: 3
  files_created: 2
  files_modified: 2
  lines_added: 367
  test_count: 5
---

# Phase 66 Plan 01: LLM Structured-Input Extractor + Type Scaffolding Summary

Created a server-only `src/lib/extractors/llm-structured.ts` module that calls Anthropic strict tool-use against `claude-sonnet-4-6` to infer watch specs from a user-supplied `{ brand, model, reference?, year? }` identity, plus the two surgical type-level edits (`validateAndCleanData` export, `EnrichmentSource` union extension) that Plan 02's route handler depends on.

## What Was Built

### `src/lib/extractors/llm-structured.ts` (NEW, 216 LOC)

**Exported function:** `extractFromStructuredInput(input: StructuredExtractionInput): Promise<ExtractedWatchData>`

- Server-only (`import 'server-only'`) — compile-gated against Client Component import.
- File header explicitly disambiguates structured-INPUT (this module) from structured-DATA (the unrelated `./structured.ts` JSON-LD scraper) per D-01 naming caveat.
- Calls `claude-sonnet-4-6` with `max_tokens: 1024`, `system: SYSTEM_PROMPT`, `tools: [EXTRACT_WATCH_TOOL]`, `tool_choice: { type: 'tool', name: 'extract_watch_from_identity' }`.
- Tool `input_schema` covers 16 properties matching `ExtractedWatchData`; enum arrays spread the project's `@/lib/constants` exports programmatically (no drift); `additionalProperties: false`; `required: ['brand', 'model']`.
- ToolUseBlock extracted via `find((c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use')` — Pitfall 1 (never index `[0]`).
- `toolUse.input` (typed `unknown` per SDK) is routed through `validateAndCleanData` for enum normalization (Pitfall 8).
- Error contract: throws on missing `ANTHROPIC_API_KEY` (mirrors `llm.ts:54-58`); throws on missing tool_use block; lets SDK errors propagate untouched. Route layer's `categorizeExtractionError` owns classification (D-05).
- Imports `./llm` directly, NOT the `@/lib/extractors` barrel — preserves the EXTR-02 cheerio short-circuit (defense layer 2 per RESEARCH).

### `tests/extractors/llm-structured.test.ts` (NEW, 151 LOC, 5 tests)

Mirrors the SDK-mock dance from `tests/extractors/llm.test.ts:1-23` (`vi.mock('@anthropic-ai/sdk', ...)` → `await import(...)` after mock):

1. `messages.create` called with `model: 'claude-sonnet-4-6'`, `max_tokens: 1024`, `tools[0].name === 'extract_watch_from_identity'`, `tool_choice` equals forced shape.
2. Tool `input` round-trips through `validateAndCleanData` and returns a typed `ExtractedWatchData` (brand, model, movement, caseSizeMm all preserved).
3. Response missing the `tool_use` block → throws Error whose message contains `tool_use` (Pitfall 1 fallback test).
4. Missing `ANTHROPIC_API_KEY` env var → throws `'ANTHROPIC_API_KEY not configured'`.
5. User message contains `Reference:` and `Year:` lines only when supplied; absent when omitted (no LLM-invented values).

All 5 tests pass; all 18 tests in `tests/extractors/` pass together.

### `src/lib/extractors/llm.ts` (MODIFIED)

`validateAndCleanData` changed from module-private to `export function`. Added JSDoc disclosing it as part of the public surface as of Phase 66, with the rationale that the structured-input extractor's `toolUse.input` is typed `unknown` per SDK and MUST be enum-normalized through this validator. Function signature unchanged (`(data: Record<string, unknown>) => ExtractedWatchData`); 80 LOC of field-by-field validation unchanged.

### `src/lib/taste/types.ts` (MODIFIED)

`EnrichmentSource` union extended from 3 to 4 literals:
```typescript
export type EnrichmentSource = 'manual' | 'url-extract' | 'backfill' | 'structured-input'
```
Additive — all four existing callers (`enricher.test.ts:50`, `route.ts:196`, `backfill-taste.ts:262`, `reenrich-taste.ts:148`) continue to use literals that remain valid. No exhaustive switch consumers. Zero signature ripple.

## Key Links Established (for Plan 02 to Consume)

| Direction | Surface | How Plan 02 uses it |
|-----------|---------|---------------------|
| Plan 02 → llm-structured | `import { extractFromStructuredInput } from '@/lib/extractors/llm-structured'` | Route's `mode === 'structured'` branch calls this in place of `fetchAndExtract` |
| Plan 02 → taste/enricher | `enrichTasteAttributes({ source: 'structured-input', ... })` | TS-valid because Plan 01 extended the union |
| Plan 02 → llm (shared validator) | `import { validateAndCleanData } from '@/lib/extractors/llm'` (only if Plan 02 needs it) | Optional — the structured branch's response shape already comes pre-validated from `extractFromStructuredInput` |

## Decisions Made

- **Throw on missing API key (not return null):** llm-structured.ts mirrors `extractWithLlm` in `llm.ts:54-58`, NOT the silent-null fire-and-forget pattern of `taste/enricher.ts:88-95`. The route's `categorizeExtractionError` catch needs throws to map to `generic-network` HTTP 500.
- **Enum arrays spread project constants programmatically:** `enum: [...MOVEMENT_TYPES]` instead of hardcoded literals — eliminates drift if the constants ever extend.
- **Import `./llm` directly, never the barrel:** the `@/lib/extractors` barrel re-exports cheerio; barrel import would defeat the EXTR-02 short-circuit even with tree-shaking guarantees. PATTERNS §A5 and RESEARCH §Cheerio Short-Circuit Enforcement both called this out.
- **System+user message split:** Pitfall 7 — concatenating user input into the system prompt makes forced tool-use less reliable. The `buildUserMessage` helper keeps user input strictly in `messages[0].content`.

## Deviations from Plan

None — this is the canonical-pattern application case. PATTERNS.md sections A1-A6 were copied directly with the minor adjustment noted in §A2 (throw vs return-null on missing key, already documented in the plan).

One tiny in-task cleanup (not a behavior deviation):

- The first draft of `llm-structured.ts` included the literal phrase `from '@/lib/extractors'` inside a comment line ("NOT from '@/lib/extractors'"). The plan's `grep -c "from '@/lib/extractors'"` acceptance check counted this comment as a barrel import. Reworded the comment to "NOT from the extractors barrel index" so the grep returns 0 as intended. No code change; comment-text wording only.

## Threat Model Compliance

Per Plan 01 threat register:

- **T-66-02 (Tampering/LLM prompt injection):** Mitigated by forced `tool_choice` (model must call the tool exactly once with schema-validated `input_schema`) + system prompt's explicit "Reply ONLY by calling extract_watch_from_identity" + `validateAndCleanData` enum-checking every output field. User input flows only into `messages[0].content`, never into the system prompt. Plan 02 should bound user input length at the Zod schema layer (flagged in CONTEXT as discretion item).
- **T-66-03 (Information disclosure / error leaks):** Module throws raw `Error` objects. Sanitization is the route layer's responsibility (D-05 — `error` field always sourced from `CATEGORY_COPY[category]`). This is consistent with the existing URL branch contract.
- **T-66-XX (API-key leak via client bundle):** Mitigated by `import 'server-only'` at the top of the module — Next.js compile-time gate blocks importing into a Client Component (pattern matches `taste/enricher.ts:15`).

## Verification

| Check | Result |
|-------|--------|
| `grep -c '^export function validateAndCleanData' src/lib/extractors/llm.ts` | `1` ✓ |
| `grep -c "structured-input" src/lib/taste/types.ts` | `2` ✓ |
| `test -f src/lib/extractors/llm-structured.ts` | OK ✓ |
| `test -f tests/extractors/llm-structured.test.ts` | OK ✓ |
| `grep -c "from '@/lib/extractors'" src/lib/extractors/llm-structured.ts` | `0` ✓ (no barrel import) |
| `npm run test -- tests/extractors/ --run` | 18/18 pass ✓ |
| Anthropic strict tool-use asserted: `model`, `max_tokens`, `tools[0].name`, `tool_choice` | All asserted ✓ |
| Pitfall 1 fallback (missing tool_use block) covered | Asserted ✓ |
| API-key-missing throw covered | Asserted ✓ |

## Commits

| Task | Type | Hash | Description |
|------|------|------|-------------|
| 1 | refactor | `0f1d72e0` | Export `validateAndCleanData` + extend `EnrichmentSource` union |
| 2 | feat | `23d1dbe7` | Add `llm-structured.ts` strict tool-use extractor (EXTR-04) |
| 3 | test | `a69f4b49` | Add EXTR-04 unit coverage (5 tests) |

## What Plan 02 Now Unblocked

- Can `import { extractFromStructuredInput } from '@/lib/extractors/llm-structured'` and call it from the route's `mode === 'structured'` branch.
- Can pass `source: 'structured-input'` to `enrichTasteAttributes` without a TypeScript error.
- Can rely on `validateAndCleanData` semantics for the structured branch's response shape parity (Plan 02 does NOT need to re-validate — the function returns the typed `ExtractedWatchData` shape directly).

## Self-Check: PASSED

- All four artifact files exist and are committed.
- All three commits present in `git log` (`0f1d72e0`, `23d1dbe7`, `a69f4b49`).
- All 5 new tests pass; all 18 extractor tests pass together.
- All `must_haves.truths` from the plan frontmatter satisfied; all `acceptance_criteria` for all three tasks met.

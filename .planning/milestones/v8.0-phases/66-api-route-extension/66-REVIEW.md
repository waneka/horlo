---
phase: 66
status: issues
findings_total: 9
critical: 0
high: 1
medium: 3
low: 5
---

# Phase 66 — Code Review Report

**Reviewed:** 2026-05-28
**Depth:** standard (with deep cross-file trace for EXTR-08 / EnrichmentSource)
**Files reviewed:** 7
**Status:** issues

## Summary

Phase 66 extends `/api/extract-watch` with a second `structured` mode (LLM-only inference from {brand, model, reference?, year?}) and adds a new `llm-structured.ts` extractor. The change is largely well-contained:

- Auth-first ordering preserved (Phase 25 D-14 still holds).
- Zod v4 idioms correct (`.issues` not `.errors`, discriminated union exhausts both branches).
- Anthropic tool-use call uses `tool_choice` forced + `content.find` predicate (Pitfall 1 mitigated correctly).
- EXTR-08 cleanly dispatches `upsertCatalogFromUserInput` and the structured-mode test verifies `upsertCatalogFromExtractedUrl` is NOT called (positive + negative assertion).
- 38/38 targeted tests pass locally.
- Lint baseline unchanged (no new errors introduced).

Defects fall into three buckets: (1) one **HIGH** crash-safety gap where the LLM SDK return type permits a `null` shape the new code unwraps unguarded, (2) test-quality issues that let regressions slip through, and (3) a docstring-vs-behavior inconsistency around the auth 401 path. No security vulnerabilities, no data-loss risks, no auth bypasses.

## High

### HR-01: `toolUse.input` cast to `Record<string, unknown>` crashes on null/non-object

**File:** `src/lib/extractors/llm-structured.ts:215`

**Issue:** The Anthropic SDK types `ToolUseBlock.input` as `unknown` — defensively, because the protocol does not guarantee it is a JSON object. The code unwraps it with `validateAndCleanData(toolUse.input as Record<string, unknown>)`. If the SDK ever returns `input: null` (or a string/array/number), the very first property access inside `validateAndCleanData` (`typeof data.brand === 'string'`) throws `TypeError: Cannot read properties of null (reading 'brand')`.

This was confirmed empirically: `const d = null; typeof d.brand` throws `TypeError`. The route's outer catch will recategorize this as `generic-network` (HTTP 500), so the user does not see a crash — but the cast silently lies about the runtime type, and the failure mode is a TypeError caught by a category that says "Couldn't reach that URL" (misleading copy for an LLM contract violation).

This also leaves the test surface incomplete: there is no unit test asserting behavior when `toolUse.input` is `null` or a string. The Pitfall-1 "missing tool_use block" branch is tested, but the "tool_use block present with non-object input" branch is not.

**Fix:**
```ts
if (!toolUse) {
  throw new Error('LLM tool_use block missing from forced-tool response')
}

if (typeof toolUse.input !== 'object' || toolUse.input === null || Array.isArray(toolUse.input)) {
  throw new Error('LLM tool_use input was not an object')
}

return validateAndCleanData(toolUse.input as Record<string, unknown>)
```

Add a unit test in `tests/extractors/llm-structured.test.ts` that mocks `mockCreate` to return `content: [{ type: 'tool_use', input: null, ... }]` and asserts the new error message.

## Medium

### MR-01: `catalogIdError` leaks raw error message to client (200-char window)

**File:** `src/app/api/extract-watch/route.ts:259-261, 380-382`

**Issue:** Both branches sanitize the user-facing `error` field correctly via `CATEGORY_COPY` (T-25-04-01 mitigation), but the `catalogIdError` response field is built as `` `catalog upsert threw: ${err.message.slice(0, 200)}` `` and returned in the JSON envelope unmodified. The 200-char window is wide enough to leak: PostgreSQL host:port from `ECONNREFUSED ::1:5432`, table/column names from RLS rejections (`new row violates row-level security policy for table "watches_catalog"`), and constraint identifiers (`duplicate key value violates unique constraint "watches_catalog_natural_key"`).

This is a pre-existing pattern from Phase 20.1 (URL branch), but Phase 66 duplicates it verbatim into the structured branch (line 380-382), so the surface area doubles. The "information disclosure" test (`tests/api/extract-watch.test.ts:272`) only inspects the top-level `error` field — it does not cover `catalogIdError`.

**Fix:** Either drop the message portion (`catalogIdError = 'catalog upsert threw'` only) or whitelist known-safe reason codes:

```ts
} catch (err) {
  console.error('[extract-watch] catalog upsert failed (non-fatal):', err)
  // Do NOT echo err.message — Postgres errors leak schema, host, constraints.
  catalogIdError = 'catalog upsert threw'
}
```

And extend the information-disclosure test to assert `JSON.stringify(body)` contains no DB-shaped substrings (no `5432`, no `relation`, no `constraint`).

### MR-02: Tool schema omits `strict: true` — model output may violate enums

**File:** `src/lib/extractors/llm-structured.ts:136`

**Issue:** The `EXTRACT_WATCH_TOOL` definition uses `additionalProperties: false` but does not set `strict: true`. The Anthropic SDK exposes `strict?: boolean` on `Tool` with the documented semantic "When true, guarantees schema validation on tool names and inputs." Without it, the model can still emit enum-violating values (e.g., `movement: 'mechanical'` when only `auto|manual|quartz|spring_drive` are allowed) and the SDK will pass them through. `validateAndCleanData` is the safety net and silently drops invalid values — so users see fields disappear with no telemetry.

**Fix:**
```ts
const EXTRACT_WATCH_TOOL = {
  name: 'extract_watch_from_identity',
  description: '...',
  strict: true,                // ← add
  input_schema: { ... },
} satisfies Anthropic.Messages.Tool
```

Verify the SDK version actually wires `strict` through to the API (the field is in the type but may be beta-gated). If wired, this tightens the schema contract; if not, the cost is zero.

### MR-03: Route docstring contradicts actual behavior on 401 auth path

**File:** `src/app/api/extract-watch/route.ts:28-30, 145`

**Issue:** The route's own docstring states "Every JSON response (success AND error) carries `mode: 'url' | 'structured'`". The 401 response at line 145 emits `{ error: 'Unauthorized' }` with **no** `mode` field. `tests/api/extract-watch-auth.test.ts:42` strictly asserts `toEqual({ error: 'Unauthorized' })`, so adding `mode` would break the auth test.

Either the docstring or the implementation is wrong. Downstream Phase 69 (`<ExtractErrorCard>`) presumably relies on `mode` being present per the docstring; if it short-circuits the auth case to "redirect to login" before reading `mode`, the inconsistency is acceptable — but it should be documented as a deliberate carveout.

**Fix:** Tighten the docstring:

```
* - Every JSON response (success AND error) carries `mode: 'url' | 'structured'`,
*   EXCEPT the 401 auth-gate response (returns `{ error: 'Unauthorized' }` only —
*   <ExtractErrorCard> handles auth via the status code, not the mode field).
```

Then add a test in `extract-watch.test.ts` asserting `mode` is present on every non-401 response (including the catch-all `Invalid request` 400).

## Low

### LR-01: Test assertion `expect(typeof body.mode).toBe('string')` is too loose

**File:** `tests/api/extract-watch.test.ts:351-361, 363-369, 334-342`

**Issue:** Four tests in the structured-mode describe block assert `expect(typeof body.mode).toBe('string')` without asserting the actual value. This passes if `mode` is `'url'`, `'structured'`, `'oops'`, `''`, or any other string — so a regression that returns `mode: 'unknown'` would slip through silently. The inline comment at line 355-358 even contradicts itself (claims `mode` is `'structured'` then says `'url'` applies).

The exact closure semantics are: Zod's discriminatedUnion fails before `mode = body.mode` runs, so the closure default `'url'` is emitted in ALL four cases. Tests should assert this explicitly.

**Fix:**
```ts
expect(body.mode).toBe('url')  // closure default; Zod failed before mode was read
```

Remove the contradictory inline comment.

### LR-02: User-supplied `year` is validated but never threaded into catalog or taste enrichment

**File:** `src/app/api/extract-watch/route.ts:333-338, 388-417`

**Issue:** The structured Zod schema accepts `year: z.number().int().min(1900).max(2100).optional()` and `extractFromStructuredInput` includes it in the user message so the LLM can use it for disambiguation. But:

1. The tool schema (`EXTRACT_WATCH_TOOL`) does not include `year` as a property — the LLM cannot echo it back.
2. The catalog upsert call passes `reference` only; year is dropped.
3. The taste-enrichment call hard-codes `productionYear: null` (line 406) — the user-supplied year is lost.

A user who supplies `year: 1969` to disambiguate a vintage Speedmaster gets no signal preserved in the catalog row or taste enrichment. If the design intent is "year is prompt-only context", the comment should say so; otherwise this is data loss.

**Fix:** Either thread `body.year` into `productionYear`:

```ts
productionYear: body.year ?? null,
```

…or document explicitly at line 333-338 that `year` is intentionally prompt-only and not persisted.

### LR-03: `fieldsExtracted` filter is a no-op

**File:** `src/app/api/extract-watch/route.ts:431-433`

**Issue:** `validateAndCleanData` only assigns properties when they pass validation (no key is ever explicitly set to `undefined`). So `Object.keys(extracted).filter((k) => extracted[k as keyof typeof extracted] !== undefined)` is equivalent to `Object.keys(extracted)` — the filter never removes anything. Harmless, but misleading: future readers will assume `extracted` can contain `undefined` values.

**Fix:**
```ts
const fieldsExtracted = Object.keys(extracted)
```

### LR-04: `extract-watch-auth.test.ts` does not mock `@/data/catalog` — tests rely on uncaught DB failure

**File:** `tests/api/extract-watch-auth.test.ts:13-21`

**Issue:** The "proceeds past auth check" test (line 53-58) runs the real catalog DAL through `node:net` (no mock), which throws `ECONNREFUSED`. The route's try/catch swallows this into `catalogIdError`, and the test still passes because it only asserts `res.status === 200` and `fetchAndExtract` was called. The vitest run prints a noisy stderr trace from the DB failure on every run.

This is pre-existing (file existed before Phase 66), but Phase 66 modified this test file to add `mode: 'url'` to fixtures (line 40, 48, 55, 62) without addressing the underlying issue. If a future change makes the catalog DAL throw on import (vs. on call), this test would fail with an unrelated error.

**Fix:** Add the catalog + enricher mocks to match `extract-watch.test.ts`:

```ts
vi.mock('@/data/catalog', () => ({
  upsertCatalogFromExtractedUrl: vi.fn().mockResolvedValue('cat-123'),
  upsertCatalogFromUserInput: vi.fn().mockResolvedValue('cat-456'),
  updateCatalogTaste: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/taste/enricher', () => ({
  enrichTasteAttributes: vi.fn().mockResolvedValue(null),
}))
```

### LR-05: `LLM-timeout` regex misses common "timed out" phrasing

**File:** `src/app/api/extract-watch/route.ts:124`

**Issue:** `/timeout/i.test(err.message)` matches the word `timeout` but not `timed out` (note the space). Anthropic SDK and many networking libraries emit `"Request timed out after Nms"` — this falls through to `generic-network`. The test at line 222-231 hedges with `expect(['LLM-timeout', 'generic-network']).toContain(body.category)` because of this gap. The structured branch inherits the same classifier, so timeout symptoms on Anthropic calls will frequently be misclassified.

This is pre-existing (Phase 25), not introduced by Phase 66, but Phase 66 expanded the classifier's scope to Anthropic SDK errors (now via the structured branch's direct Anthropic call), so the gap matters more now.

**Fix:**
```ts
if (err.name === 'AbortError' || /\btimed?[\s-]?out\b/i.test(err.message)) {
  return 'LLM-timeout'
}
```

And tighten the test assertion to `expect(body.category).toBe('LLM-timeout')`.

---

## Cross-Cutting Observations (not findings)

- **EnrichmentSource extension is safe.** The new `'structured-input'` literal is only consumed by `logEvent` calls in `enricher.ts` (line 92, 101, 150, 159, 171, 188, 198) — no exhaustive switch, no DB-bound enum, no exhaust-anywhere consumer. Additive extension as documented.
- **EXTR-08 positive + negative test pair is correct.** Line 449-473 asserts both `upsertCatalogFromUserInput` was called AND `upsertCatalogFromExtractedUrl` was NOT called — Pitfall 5 mitigation verified.
- **EXTR-02 cheerio short-circuit is reasonable.** The plan substitutes a `mockFetchAndExtract` not-called assertion for `vi.spyOn(cheerio, 'load')` due to ESM rebind constraints; the substitution is strictly stronger at the route level (cheerio is downstream of `fetchAndExtract`). The comment at line 306-321 documents the substitution clearly.
- **Auth-first ordering preserved.** The auth gate at line 141-148 runs before any URL parsing, SSRF check, or Zod parse — AUTH-04 / D-14 invariant intact.

---

_Reviewed: 2026-05-28T15:35:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## REVIEW COMPLETE

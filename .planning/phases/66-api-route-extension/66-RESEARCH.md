# Phase 66: API Route Extension - Research

**Researched:** 2026-05-28
**Domain:** Next.js 16 App Router API route extension — Anthropic SDK strict tool-use + Zod v4 discriminated-union body validation + structured-input LLM extraction
**Confidence:** HIGH (all critical claims verified against `node_modules/` and existing code)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — LLM prompt file location:** New file `src/lib/extractors/llm-structured.ts` as a sibling of `llm.ts`. The URL-extraction module is not touched. New file owns its own prompt + tool-use plumbing in isolation. Matches the existing `extractors/` split by source type (`html.ts`, `structured.ts`, `llm.ts`). **Naming caveat:** `structured.ts` already exists and refers to **structured *data*** (JSON-LD scraped from pages). `llm-structured.ts` refers to **structured *input*** (user-supplied identity). Different concepts; document the disambiguation in the file header.

**D-02 — Strict tool-use scope:** Strict tool-use is structured-only. The URL path stays on plain `messages.create` + greedy `{…}` regex match + `JSON.parse` (today's behavior). URL-path tool-use migration logged in Deferred Ideas.

**D-03 — Structured-branch parity:** Full parity with the URL branch. After the structured branch upserts via `upsertCatalogFromUserInput`, run the same chain the URL branch runs today: `enrichTasteAttributes({ source: 'structured-input', spec: {...}, photoSourcePath: null })` → `updateCatalogTaste(catalogId, taste)` → `revalidateTag('explore', 'max')`. Add `'structured-input'` as a new value to `EnrichmentSource` alongside the existing `'url-extract'`.

**D-04 — revalidateTag firing:** `revalidateTag('explore', 'max')` always fires when a structured-mode catalog row is upserted, regardless of whether enrichment succeeded. Mirrors URL branch.

**D-05 — Error categories:** Reuse the existing 5-category enum as-is. `host-403`, `SsrfError` simply never fire for structured (no URL fetch). `LLM-timeout`, `quota-exceeded`, `structured-data-missing`, `generic-network` all still apply with their existing detection logic. Zero new public surface.

**D-06 — `structured-data-missing` mode-branched copy:** Branch the user-facing copy by mode. Today's URL copy reads wrong for structured input. Add a structured-mode variant; coordinate with Phase 69 `<ExtractErrorCard>` mode threading. Recommend the response carry `mode` so the consumer has a single source of truth.

**D-07 — Body validation:** Zod with `z.discriminatedUnion('mode', [...])` for the request body. Confirm Zod v4 syntax + error-message shape.

**D-08 — Schema location:** Schema colocated in `route.ts` at the top of the file. Single consumer. Avoids premature abstraction.

### Claude's Discretion

- **Body parse + auth ordering:** preserve today's order — `getCurrentUser()` runs FIRST (AUTH-04 / D-14), then `request.json()`, then Zod parse + mode dispatch. Do not invert.
- **Dispatch shape inside the route:** planner picks — a `switch (body.mode)` inside `POST` is fine; extracting the structured branch into a private helper (`handleStructuredExtraction(body)`) is also fine if the function grows large.
- **`ExtractedWatchData` field coverage from structured-mode LLM:** the prompt should request the same field set as today's URL prompt. Recommend all optional in the tool input_schema EXCEPT `brand`/`model`/`reference` (when supplied as input, the LLM should echo + normalize; when omitted, the LLM may infer or leave blank).
- **Tool-use temperature / max_tokens:** match today's URL prompt (`max_tokens: 1024`, default temperature).
- **Empty-output gate for structured mode:** mirror today's URL post-extract gate — when both `brand` AND `model` come back empty (or whitespace-only), emit `structured-data-missing` with HTTP 422.

### Deferred Ideas (OUT OF SCOPE)

- **URL path migration to strict tool-use** — D-02 chose structured-only for this phase. Worth doing later as a focused refactor.
- **Hoist Zod schema to shared module** (`src/lib/extractors/request-schema.ts`) — revisit if Phase 70 client-side wants pre-POST validation.
- **Structured-mode-specific error categories** (e.g. `structured-llm-low-confidence`) — D-05 chose reuse.
- **`<ExtractErrorCard>` mode-aware copy implementation** — Phase 69 owns. Phase 66 only carries `mode` through the response.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXTR-01 | `/api/extract-watch` accepts a discriminated body `{ mode: 'url', url } \| { mode: 'structured', brand, model, reference?, year? }`; URL behavior unchanged | Zod v4 `z.discriminatedUnion('mode', [...])` (§Zod v4 discriminatedUnion); URL-branch contract preserved (§URL-Branch Behavior Contract) |
| EXTR-02 | Structured short-circuits BEFORE cheerio — test-asserted | Branch BEFORE the `fetchAndExtract` call; do not import `@/lib/extractors` (orchestrator) from structured branch (§Cheerio Short-Circuit Enforcement) |
| EXTR-03 | Brand + model required; response = `ExtractedWatchData` consistent with URL branch | Required fields enforced by Zod; `ExtractedWatchData` shape in `src/lib/extractors/types.ts` (§Code context) |
| EXTR-04 | LLM prompt variant via Anthropic SDK strict tool-use against `claude-sonnet-4-6` | SDK v0.88.0 verified; tool-use API + `tool_choice: { type: 'tool', name }` (§Anthropic SDK Strict Tool-Use); recommended `input_schema` (§Recommended Tool input_schema) |
| EXTR-08 | Structured-extract catalog row creation uses `upsertCatalogFromUserInput` (ON CONFLICT DO NOTHING), NOT `upsertCatalogFromExtractedUrl` | Both functions verified in `src/data/catalog.ts:138, :178`; integration test asserts distinction (§Validation Architecture) |

</phase_requirements>

## Summary

Phase 66 extends a single Next.js 16 App Router route handler with a discriminated body, a new Anthropic tool-use LLM call, and full parity with the URL branch's post-extract chain (catalog upsert → taste enrichment → `revalidateTag`). All upstream and downstream seams already exist; this phase is a focused additive change at the route layer plus one new file (`src/lib/extractors/llm-structured.ts`).

The two highest-risk areas are (1) zero-regression preservation of the URL branch — there are 11 distinct response-shape and side-effect properties that the existing test fixture pins, and (2) correctly wiring strict tool-use against `claude-sonnet-4-6` so the tool input maps cleanly to `ExtractedWatchData` without the regex-JSON-match fragility the URL branch carries. Both are mitigated by existing patterns in the repo: the URL test fixture (`tests/api/extract-watch.test.ts`) is comprehensive, and the Phase 19.1 taste enricher (`src/lib/taste/enricher.ts:33-61`) is an exact strict-tool-use reference implementation against the same SDK version.

**Primary recommendation:** Model the new structured branch on the existing taste enricher's strict tool-use shape (`tools: [TOOL]` + `tool_choice: { type: 'tool', name }`). Reuse `validateAndCleanData` from `src/lib/extractors/llm.ts` either by export or by duplication — the structured branch needs the same `ExtractedWatchData` field validation. Carry `mode: 'url' | 'structured'` in BOTH the success and error response bodies so Phase 69's `<ExtractErrorCard>` has a single source of truth.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Body validation (Zod discriminatedUnion) | API / Backend (route handler) | — | Single consumer per D-08; client-side validation lives in Phase 69 if needed |
| Auth gate | API / Backend (route handler) | — | AUTH-04 / D-14 — server-only, runs first |
| Anthropic SDK tool-use call | API / Backend (server lib `llm-structured.ts`) | — | `ANTHROPIC_API_KEY` is server-only secret; pattern matches existing `llm.ts` and taste `enricher.ts` |
| Catalog upsert | Database / Storage (DAL `src/data/catalog.ts`) | API / Backend (route calls DAL) | Existing CAT-06 helper; route is the call-site |
| Taste enrichment | API / Backend (server lib `src/lib/taste/enricher.ts`) | — | Existing Phase 19.1 module; fire-and-forget posture |
| Cache revalidation | API / Backend (Next 16 `revalidateTag`) | CDN / Static (downstream Browse/Archetype caches) | Existing CR-01 pattern; mutates `watches_catalog` requires bust |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `0.88.0` [VERIFIED: package.json] | LLM call with strict tool-use | Already in project; existing `llm.ts` + taste `enricher.ts` use it; `Tool` + `ToolChoice` + `ToolUseBlock` types verified in `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts:1028-1090, :1122-1171, :1363-1372` |
| `zod` | `4.3.6` [VERIFIED: package.json] | Body validation via `discriminatedUnion` | Already in project; used by 5 Server Actions; v4 `discriminatedUnion` API verified in `node_modules/zod/src/v4/classic/tests/discriminated-unions.test.ts:35-41` |
| `next` | `16.2.3` [VERIFIED: package.json] | `NextRequest`/`NextResponse`/`revalidateTag` | Existing route uses these; `revalidateTag('explore', 'max')` matches existing call at `route.ts:230` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/auth` | — | `getCurrentUser()` + `UnauthorizedError` | First call in route handler — AUTH-04 gate |
| `@/data/catalog` | — | `upsertCatalogFromUserInput`, `updateCatalogTaste` | Structured branch catalog write (EXTR-08) |
| `@/lib/taste/enricher` | — | `enrichTasteAttributes({ source, spec, photoSourcePath: null })` | Structured branch parity with URL branch (D-03) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `z.discriminatedUnion` | `z.union([urlSchema, structuredSchema])` | Plain union loses the v4 fast-path on the discriminant; v4 `discriminatedUnion` short-circuits on `mode` field without trying both branches |
| Anthropic strict tool-use | Plain text completion + regex `{…}` match (URL-branch pattern) | D-02 explicitly rejected this — strict tool-use eliminates the JSON-parse failure mode (Phase 25 WR-06 lesson); the structured-input prompt is greenfield so there's no regression risk from adopting tool-use |
| New route at `/api/extract-watch-structured` | Single route with discriminated body | Requirements Out-of-Scope table explicitly rejects this — single route aligns with existing 5-category error taxonomy |

**Installation:** No new packages — all dependencies already in `package.json`.

**Version verification:**
- `@anthropic-ai/sdk` `0.88.0` confirmed by `cat node_modules/@anthropic-ai/sdk/package.json | python3 -c "..."`
- `zod` `4.3.6` confirmed by same approach

## Architecture Patterns

### System Architecture Diagram

```
POST /api/extract-watch
        │
        ├── getCurrentUser() ── UnauthorizedError → 401
        │
        ├── request.json()
        │
        ├── extractRequestSchema.safeParse(body) ── invalid → 400
        │
        ├── switch (body.mode)
        │     │
        │     ├── 'url' (UNCHANGED — preserved verbatim)
        │     │     ├── validate URL string/protocol → 400 on fail
        │     │     ├── fetchAndExtract(url) ← SsrfError → 400 generic-network
        │     │     ├── structured-data-missing gate → 422
        │     │     ├── upsertCatalogFromExtractedUrl  ◀── DO NOT call from structured branch
        │     │     ├── enrichTasteAttributes({ source: 'url-extract', spec, photoSourcePath: null })
        │     │     ├── updateCatalogTaste(catalogId, taste)
        │     │     ├── revalidateTag('explore', 'max')
        │     │     └── return { success, catalogId, catalogIdError, mode: 'url', ...result }
        │     │
        │     └── 'structured' (NEW)
        │           ├── extractFromIdentity({brand,model,reference?,year?})  [llm-structured.ts]
        │           │     └── Anthropic.messages.create({
        │           │           model: 'claude-sonnet-4-6',
        │           │           max_tokens: 1024,
        │           │           tools: [EXTRACT_WATCH_TOOL],
        │           │           tool_choice: { type: 'tool', name: 'extract_watch_from_identity' },
        │           │           messages: [{ role: 'user', content: USER_PROMPT(input) }],
        │           │           system: SYSTEM_PROMPT,
        │           │         }) → tool_use.input → validateAndCleanData → ExtractedWatchData
        │           ├── structured-data-missing gate (brand+model both empty) → 422
        │           ├── upsertCatalogFromUserInput({brand,model,reference})  ◀── EXTR-08
        │           ├── enrichTasteAttributes({ source: 'structured-input', spec, photoSourcePath: null })
        │           ├── updateCatalogTaste(catalogId, taste)
        │           ├── revalidateTag('explore', 'max')
        │           └── return { success, catalogId, catalogIdError, mode: 'structured', data, source: 'llm', ...}
        │
        └── catch → SsrfError|host-403|LLM-timeout|quota-exceeded|generic-network → CATEGORY_HTTP_STATUS[c]
              (all error responses also carry `mode: 'url' | 'structured'`)
```

### Recommended Project Structure

```
src/
├── app/api/extract-watch/
│   └── route.ts            # EXTENDED — discriminated body dispatch
├── lib/extractors/
│   ├── llm.ts              # UNCHANGED — URL-branch text completion
│   ├── llm-structured.ts   # NEW — structured-input strict tool-use
│   ├── structured.ts       # UNCHANGED — JSON-LD scraping (naming caveat)
│   ├── html.ts             # UNCHANGED
│   ├── index.ts            # UNCHANGED — URL-only orchestrator
│   └── types.ts            # UNCHANGED — ExtractedWatchData
└── lib/taste/
    └── types.ts            # EDITED — `EnrichmentSource` gains 'structured-input'
```

### Pattern 1: Strict Tool-Use (SDK v0.88.0)

**What:** Force the model to emit ONLY a structured `tool_use` block by passing `tools: [TOOL]` and `tool_choice: { type: 'tool', name: TOOL.name }`. The model's response content is an array of blocks; the structured payload arrives as `block.input` on the `tool_use` block, eliminating regex JSON parsing.

**When to use:** Any time you want a guaranteed JSON shape conforming to a schema. The Phase 19.1 taste enricher uses exactly this pattern.

**Example:**
```typescript
// Source: src/lib/taste/enricher.ts:33-61 + src/lib/taste/webSearch.ts:165-179 [VERIFIED]
const TOOL = {
  name: 'extract_watch_from_identity',
  description: 'Emit watch specs inferred from brand + model + optional reference/year.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: { /* ... see Recommended input_schema below */ },
    required: ['brand', 'model'],
  },
} satisfies Anthropic.Messages.Tool

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  tools: [TOOL],
  tool_choice: { type: 'tool', name: 'extract_watch_from_identity' },
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: userMessage }],
})

const toolUse = response.content.find(
  (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use',
)
if (!toolUse) throw new Error('No tool_use block in response')
// toolUse.input is `unknown` per SDK types — must be validated before use
const cleaned = validateAndCleanData(toolUse.input as Record<string, unknown>)
```

### Pattern 2: Zod v4 Discriminated Union [VERIFIED: zod tests]

**What:** Validate the request body against `{mode:'url',...} | {mode:'structured',...}` with a single Zod call that short-circuits on the `mode` discriminator. v4 syntax verified against `node_modules/zod/src/v4/classic/tests/discriminated-unions.test.ts:35-41`.

**When to use:** Any time a body has a tagged-union shape — Phase 66 EXTR-01 is the textbook case.

**Example:**
```typescript
// Source: verified against node_modules/zod/src/v4/classic/tests/discriminated-unions.test.ts [VERIFIED]
import { z } from 'zod'

const urlBodySchema = z.object({
  mode: z.literal('url'),
  url: z.string().min(1),
})

const structuredBodySchema = z.object({
  mode: z.literal('structured'),
  brand: z.string().min(1),
  model: z.string().min(1),
  reference: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
})

const extractRequestSchema = z.discriminatedUnion('mode', [
  urlBodySchema,
  structuredBodySchema,
])

// Usage in POST handler:
const parsed = extractRequestSchema.safeParse(await request.json())
if (!parsed.success) {
  // v4 ZodError exposes `.issues` (not `.errors` — that was Zod 3)
  // First-issue heuristic gives a clean user-facing message:
  const first = parsed.error.issues[0]
  return NextResponse.json({ error: first?.message ?? 'Invalid request' }, { status: 400 })
}
const body = parsed.data  // TS-narrowed via the discriminant
```

### Pattern 3: Auth-First Gate Preservation

**What:** `getCurrentUser()` runs BEFORE any body parsing, URL validation, or DB access. Matches AUTH-04 / D-14 — proxy is optimistic outer gate; route handler is the inner gate.

**When to use:** Every authenticated route. Reproduced verbatim from current `route.ts:80-90`.

### Anti-Patterns to Avoid

- **Importing `@/lib/extractors` from the structured branch** — that module's `extractWatchData` calls `extractStructuredData` and `extractFromHtml`, both of which import cheerio. Even a static `import` at the top of `route.ts` is fine (cheerio is already in the bundle for the URL branch), but the structured branch's runtime path must not REACH any cheerio call. Test-pin this with a `vi.mock('cheerio')` assertion.
- **Mode-blind catch block** — the existing catch swallows `SsrfError` and dispatches by category. For structured mode, `SsrfError` cannot fire (no fetch), but other errors (Anthropic SDK 429, timeout) MUST continue to map to the same category enum. The catch should carry the request mode forward into the error response.
- **Including `mode` only in success responses** — Phase 69 needs `mode` in BOTH success and error bodies so the `<ExtractErrorCard>` copy branch is decidable when the network/LLM call failed. Add `mode` everywhere the route emits a JSON body.
- **Marking `brand`/`model` as `required` in the tool input_schema when user input only supplies them** — the LLM should ECHO + NORMALIZE these. Mark them required (the model must output them); but the schema must allow normalization (e.g., the model might return `"Omega"` even when given `"omega"`). Don't constrain to a literal value.
- **Letting `enrichTasteAttributes` errors propagate** — the function `NEVER throws` per its own contract (`src/lib/taste/enricher.ts:13`) and returns `null` on any failure. Mirror the URL branch's defensive `try/catch` anyway (D-03 explicit parity) since `updateCatalogTaste` CAN throw on DB errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tagged-union body validation | Manual `if (body.mode === 'url') { check url; } else if (body.mode === 'structured') ...` | `z.discriminatedUnion('mode', [u, s])` | Zod 4.3.6 already present; v4 short-circuits on the discriminator; clean 400 messages via `error.issues` |
| Strict JSON output from LLM | Greedy `{…}` regex + `JSON.parse` (URL branch's WR-06 pattern) | Anthropic strict tool-use (`tool_choice: { type: 'tool', name }`) | URL branch carries a documented failure mode (WR-06 comment); structured branch is greenfield — adopt the safer pattern |
| Watch-spec normalization (movement enum, color allow-list, etc.) | Re-implement enum checks | Reuse `validateAndCleanData` from `src/lib/extractors/llm.ts:133-212` | Existing implementation already exhaustively validates every `ExtractedWatchData` field against project constants (`MOVEMENT_TYPES`, `DIAL_COLORS`, etc.) |
| Catalog upsert SQL | Direct INSERT/UPDATE in route | `upsertCatalogFromUserInput` (`src/data/catalog.ts:138`) | CAT-06 helper exists — already called by `addWatch` + `addWishlistWatch`; ON CONFLICT DO NOTHING semantics proven |
| Error categorization for the LLM call | New error taxonomy | `categorizeExtractionError` in `route.ts:59-78` | D-05 explicitly mandates reuse; AbortError/`/timeout/i` + `.status === 429` ducktype already cover Anthropic SDK errors thrown from `client.messages.create()` |

**Key insight:** This phase is almost entirely additive plumbing. The risky bits (LLM call shape, validation, error taxonomy, catalog persistence) all have prior art in the codebase. The new code is roughly: ~40 LOC schema + dispatch in `route.ts`, ~80 LOC `llm-structured.ts` (Tool def + 2 prompts + extraction function), ~2 LOC `EnrichmentSource` extension in `taste/types.ts`.

## Runtime State Inventory

This is not a rename / refactor / migration phase. **SKIPPED.**

## Common Pitfalls

### Pitfall 1: Tool-use response sometimes contains BOTH text AND tool_use blocks
**What goes wrong:** Even with `tool_choice: { type: 'tool', name }` forcing the tool, the model occasionally prepends a text block before the `tool_use` block. Iterating `response.content` and grabbing the first block returns text, not tool input. [CITED: Anthropic SDK v0.88 — `ContentBlock` union in `messages.d.ts:435`]
**Why it happens:** "Forced" tool use guarantees the tool will be called, not that the response will contain only the tool block; thinking-style preambles can still appear.
**How to avoid:** Use `.find((c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use')` — never index `[0]`. Pattern verified in `src/lib/taste/webSearch.ts:155-160, :176-179`.
**Warning signs:** Tests pass on golden-path mocks but production occasionally returns empty `ExtractedWatchData`.

### Pitfall 2: Zod v4 uses `error.issues`, NOT `error.errors`
**What goes wrong:** Code written from training data (Zod 3 era) reads `result.error.errors[0]` and gets `undefined` at runtime. [VERIFIED: `node_modules/zod/src/v4/classic/tests/discriminated-unions.test.ts:132-141` and `src/lib/taste/enricher.ts:174` already uses `.issues`]
**Why it happens:** Zod 4 renamed `errors` → `issues` on `ZodError`. The repo's existing v4 callsites (taste enricher) already use `.issues`.
**How to avoid:** Always `.issues` for v4. For a single user-facing message: `parsed.error.issues[0]?.message`. For programmatic use: iterate `.issues`.
**Warning signs:** TypeScript may not catch this if the planner types the result loosely; rely on the type narrowing from `safeParse`.

### Pitfall 3: Cheerio short-circuit invisible in code-review
**What goes wrong:** A future contributor adds `import { fetchAndExtract } from '@/lib/extractors'` to share code, breaking EXTR-02 silently. Cheerio appears in the bundle either way (URL branch needs it), so build size doesn't change.
**Why it happens:** `cheerio.load` is called via static imports through `structured.ts` and `html.ts`. The dispatch must not enter that call path on `mode === 'structured'`.
**How to avoid:** Integration test mocks the `cheerio` module and asserts `cheerio.load` is never invoked when `mode === 'structured'`. Also: do NOT call `fetchAndExtract` or `extractWatchData` from the structured branch.
**Warning signs:** A regression here is undetectable from response inspection — only a network/process trace would reveal it. Mock-based test is the contract.

### Pitfall 4: `revalidateTag('explore', 'max')` two-arg signature
**What goes wrong:** Planner copies a `revalidateTag('explore')` call from outdated docs; the URL branch passes a second arg `'max'` (`route.ts:230`) and the structured branch must match. [CITED: AGENTS.md — "this version may differ from training data"]
**Why it happens:** Next 16's `revalidateTag(tag, revalidate?)` second arg controls cross-user vs. per-user scope. The URL branch's `'max'` semantics — "Browse counts are global" — apply identically to the structured branch.
**How to avoid:** Copy the exact two-arg call from `route.ts:230` verbatim into the structured branch.
**Warning signs:** If Browse/Archetype counts stop updating after structured-input add, this is the culprit.

### Pitfall 5: `enrichTasteAttributes` `source` type widening
**What goes wrong:** `EnrichmentSource` in `src/lib/taste/types.ts:8` is a closed union `'manual' | 'url-extract' | 'backfill'`. Passing `'structured-input'` without extending the union is a TS error.
**Why it happens:** D-03 explicitly requires adding `'structured-input'` to the enum.
**How to avoid:** Edit `src/lib/taste/types.ts:8` to add `| 'structured-input'` to the `EnrichmentSource` union. Check `tests/integration/backfill-taste.test.ts` and `tests/integration/catalog-taste.test.ts` for any sources of regression on the union (likely safe — they pass `'backfill'`/`'url-extract'` strings, which are unchanged).
**Warning signs:** TS build fails with `Type '"structured-input"' is not assignable to type 'EnrichmentSource'`.

### Pitfall 6: SDK error subclass detection across module boundaries
**What goes wrong:** Code uses `if (err instanceof RateLimitError)` to detect 429s; in some bundling scenarios the SDK's `RateLimitError` class identity differs across module copies and the instanceof check returns false.
**Why it happens:** The existing route's `categorizeExtractionError` explicitly avoids `instanceof RateLimitError` and ducktypes via `.status === 429` (route.ts:71-76) for exactly this reason.
**How to avoid:** Match the URL branch's approach. The Anthropic SDK exposes `APIConnectionTimeoutError`, `RateLimitError`, `InternalServerError`, etc. [VERIFIED: `node_modules/@anthropic-ai/sdk/core/error.d.ts:23-49`] — but route them through the SAME `categorizeExtractionError` so D-05 (reuse 5-category enum) holds.
**Warning signs:** 429s on the structured branch return as `generic-network` instead of `quota-exceeded`. Cross-check: a thrown error with `.status === 429` MUST map to `quota-exceeded`.

### Pitfall 7: System prompt vs. user prompt confusion in tool-use
**What goes wrong:** Planner puts the entire prompt in `messages[0].content`, omitting the `system` field — model has no role context, behaves inconsistently. Or vice-versa: puts the user input in `system`, model ignores it.
**Why it happens:** SDK supports both; the URL branch's prompt is monolithic in user content. For strict tool-use, splitting into `system` (the role + tool-use contract) and `user` (the specific input) yields more reliable echoing.
**How to avoid:** Use the system+user split shown in §Recommended Prompt Copy below.
**Warning signs:** Model invents brand/model values different from the input the user supplied.

### Pitfall 8: Anthropic SDK `ToolUseBlock.input` is typed `unknown`
**What goes wrong:** Planner writes `const data: ExtractedWatchData = toolUse.input` — TS allows it via `unknown` widening only if cast, and runtime data may not match the type. [VERIFIED: `messages.d.ts:1369` — `input: unknown`]
**Why it happens:** The SDK can't statically know what schema the user defined.
**How to avoid:** Run `validateAndCleanData(toolUse.input as Record<string, unknown>)` — the existing function in `src/lib/extractors/llm.ts:133` already does field-by-field type guarding against the project's enum constants.
**Warning signs:** Catalog rows show `movement: 'invalid-value'` or similar — symptom of bypassing the validator.

## Code Examples

### Verified Pattern: Tool-Use Extraction From `claude-sonnet-4-6`

```typescript
// Source: synthesized from src/lib/taste/enricher.ts:33-61, :140-180
//         and src/lib/taste/webSearch.ts:165-179 [VERIFIED]
import Anthropic from '@anthropic-ai/sdk'
import type { ExtractedWatchData } from './types'

const EXTRACT_WATCH_TOOL = {
  name: 'extract_watch_from_identity',
  description:
    "Emit specifications for the watch identified by the user's input " +
    "(brand + model + optional reference + year). Echo brand/model/reference " +
    "back normalized. Infer remaining fields ONLY when you have reliable " +
    "knowledge; omit any field you would otherwise guess.",
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: { /* see §Recommended Tool input_schema */ },
    required: ['brand', 'model'],
  },
} satisfies Anthropic.Messages.Tool

const SYSTEM_PROMPT =
  "You are a watch-spec assistant. You will receive a watch identity " +
  "(brand + model + optional reference + year) supplied by a collector. " +
  "Call the extract_watch_from_identity tool with structured specifications " +
  "drawn from your training knowledge. If you have no reliable knowledge " +
  "for a field, OMIT it — do not hallucinate. Always echo brand and model " +
  "(normalized to title case). When a reference number is supplied, echo it " +
  "in its conventional form."

interface StructuredExtractionInput {
  brand: string
  model: string
  reference?: string
  year?: number
}

function buildUserMessage(input: StructuredExtractionInput): string {
  const parts = [`Brand: ${input.brand}`, `Model: ${input.model}`]
  if (input.reference) parts.push(`Reference: ${input.reference}`)
  if (input.year) parts.push(`Year: ${input.year}`)
  return parts.join('\n')
}

export async function extractFromStructuredInput(
  input: StructuredExtractionInput,
): Promise<ExtractedWatchData> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_WATCH_TOOL],
    tool_choice: { type: 'tool', name: 'extract_watch_from_identity' },
    messages: [{ role: 'user', content: buildUserMessage(input) }],
  })

  // Pitfall 1 mitigation — never index [0]; find the tool_use block.
  const toolUse = response.content.find(
    (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use',
  )
  if (!toolUse) {
    // Pitfall 1 fallback — forced tool_choice still occasionally yields
    // text-only. Surface as a domain error the route categorizer handles.
    throw new Error('LLM tool_use block missing from forced-tool response')
  }
  return validateAndCleanData(toolUse.input as Record<string, unknown>)
}
```

### Verified Pattern: Zod v4 Discriminated Union Body Schema

```typescript
// Source: verified against node_modules/zod/src/v4/classic/tests/discriminated-unions.test.ts [VERIFIED]
import { z } from 'zod'

const urlBodySchema = z.object({
  mode: z.literal('url'),
  url: z.string().min(1),
})

const structuredBodySchema = z.object({
  mode: z.literal('structured'),
  brand: z.string().min(1),
  model: z.string().min(1),
  reference: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
})

const extractRequestSchema = z.discriminatedUnion('mode', [
  urlBodySchema,
  structuredBodySchema,
])

type ExtractRequestBody = z.infer<typeof extractRequestSchema>
```

### URL-Branch Behavior Contract (zero-regression baseline)

The URL branch MUST preserve every observable side effect and response field. Pinned by `tests/api/extract-watch.test.ts:58-269`.

| # | Side Effect / Field | Source | Notes |
|---|---------------------|--------|-------|
| 1 | `getCurrentUser()` called FIRST, throws `UnauthorizedError` → `{ error: 'Unauthorized' }` HTTP 401 | `route.ts:82-90` | AUTH-04 / D-14 |
| 2 | `body.url` required; missing or non-string → `{ error: 'URL is required' }` HTTP 400 | `route.ts:94-101` | Now becomes Zod-driven per D-07; **but the URL-branch test fixture asserts exact string `'URL is required'` at exact status 400** — schema's error message MUST round-trip through the same payload shape |
| 3 | `new URL(url)` throws → `{ error: 'Invalid URL format' }` HTTP 400 | `route.ts:103-111` | Same — Zod's `z.string().url()` would replace; planner can either keep manual `URL()` validation post-Zod, or use `z.string().url()` and override the error message |
| 4 | Protocol allow-list (`http:` / `https:` only) → `{ error: 'Only HTTP/HTTPS URLs are supported' }` HTTP 400 | `route.ts:113-118` | Test pin at `extract-watch.test.ts:94-98` |
| 5 | `fetchAndExtract(url)` called (cheerio path) | `route.ts:120` | Cheerio MUST NOT be reached on structured |
| 6 | Post-extract gate: brand+model both empty/whitespace → category `structured-data-missing`, HTTP 422, copy `"Couldn't find watch info on this page. Try the original product page or enter manually."` | `route.ts:126-137` | D-12 gate; D-06 makes copy mode-aware |
| 7 | `upsertCatalogFromExtractedUrl({brand, model, reference, ..., imageSourceUrl: url, ...})` (with COALESCE enrichment of NULL fields) | `route.ts:147-166` | Structured branch MUST NOT call this — use `upsertCatalogFromUserInput` |
| 8 | `catalogId` (string or null) + `catalogIdError` (null or short reason code) in response | `route.ts:143-183, :238-242` | Observability contract (Phase 20.1 UAT gap 1) |
| 9 | `enrichTasteAttributes({ catalogId, source: 'url-extract', spec: {...}, photoSourcePath: null })` then `updateCatalogTaste(catalogId, taste)` — wrapped in try/catch with `console.error` on failure | `route.ts:190-219` | D-03 mandates structural parity, `source: 'structured-input'` |
| 10 | `revalidateTag('explore', 'max')` when catalogId truthy | `route.ts:229-231` | Two-arg form (Pitfall 4) |
| 11 | Success response: `{ success: true, catalogId, catalogIdError, ...result }` where `result = { data, source, confidence, fieldsExtracted, llmUsed }` from `ExtractionResult` | `route.ts:236-244` | Structured branch returns same shape minus `fieldsExtracted` (can be `Object.keys(data).filter(...)`) and with `source: 'llm'`, `confidence: 'medium'` (planner picks) |
| 12 | Error catch: `SsrfError` → category `generic-network`, HTTP 400, locked copy | `route.ts:256-265` | Structured branch never throws SsrfError |
| 13 | `host-403` (regex on err.message) → HTTP 502, locked copy | `route.ts:62-63, :272-280` | Structured branch never produces; safe to reuse the catch |
| 14 | `LLM-timeout` (AbortError name OR `/timeout/i` message) → HTTP 504, locked copy | `route.ts:66-68, :281-289` | Applies to structured Anthropic call too |
| 15 | `quota-exceeded` (`.status === 429`) → HTTP 503, locked copy | `route.ts:74-76, :290-298` | Applies to structured Anthropic call |
| 16 | `generic-network` (fallthrough) → HTTP 500, locked copy | `route.ts:299-308` | Universal fallback |
| 17 | Server-side `console.error('Extraction error:', error)` for diagnostic visibility | `route.ts:250` | T-25-04-01 — never leaked to client |
| 18 | Sanitized error responses (no Anthropic / claude / stack / raw err.message) | `route.ts:250, :260, :276, :285, :294, :303` | T-25-04-01 — pinned by test `route.ts:250-267` |

**New additions allowed (do not break the contract):**
- `mode: 'url' | 'structured'` field in every success AND error response (D-06).
- Mode-branched copy in `CATEGORY_COPY['structured-data-missing']` selected by the request mode.

## Recommended Tool input_schema

Following D-Discretion: `brand`, `model` required (LLM echoes/normalizes); `reference` required so the model echoes back when provided OR returns an empty string when not. All other fields optional.

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "brand":          { "type": "string", "description": "Watch brand/manufacturer; echo input normalized to conventional casing (e.g. 'Omega', 'A. Lange & Söhne')." },
    "model":          { "type": "string", "description": "Model name; echo input normalized (e.g. 'Speedmaster Professional')." },
    "reference":      { "type": "string", "description": "Reference number; echo input verbatim if supplied, else infer when uniquely determinable from brand+model+year, else omit." },
    "movement":       { "type": "string", "enum": ["auto", "manual", "quartz", "spring_drive"] },
    "complications":  { "type": "array",  "items": { "type": "string", "enum": ["date","day-date","gmt","chrono","moon-phase","power-reserve","world-time"] } },
    "isChronometer":  { "type": "boolean", "description": "TRUE only if the model is COSC-certified or explicitly chronometer-grade. NOT a synonym for chronograph." },
    "caseSizeMm":     { "type": "number", "minimum": 20, "maximum": 55 },
    "lugToLugMm":     { "type": "number", "minimum": 30, "maximum": 60 },
    "waterResistanceM": { "type": "number", "minimum": 0 },
    "strapType":      { "type": "string", "enum": ["bracelet","leather","rubber","nato","other"] },
    "crystalType":    { "type": "string", "enum": ["sapphire","mineral","acrylic","hesalite","hardlex"] },
    "dialColor":      { "type": "string", "enum": ["black","white","blue","navy","sky blue","green","teal","silver","grey","cream","champagne","salmon","red","burgundy","orange","yellow","brown","bronze","other"] },
    "styleTags":      { "type": "array",  "items": { "type": "string", "enum": ["diver","dress","field","pilot","chronograph","gmt","sport","tool"] } },
    "designTraits":   { "type": "array",  "items": { "type": "string", "enum": ["heritage","vintage-inspired","modern","minimalist","bold","refined","utilitarian","textured-dial","applied-indices"] } },
    "marketPrice":    { "type": "number", "minimum": 0, "description": "USD MSRP or typical secondary-market price. Omit if uncertain." }
  },
  "required": ["brand", "model"]
}
```

**Notes:**
- Enums copied verbatim from `src/lib/constants.ts` (MOVEMENT_TYPES, COMPLICATIONS, STRAP_TYPES, CRYSTAL_TYPES, DIAL_COLORS, STYLE_TAGS, DESIGN_TRAITS) — must be derived programmatically from those exports, not hardcoded, to prevent drift.
- `additionalProperties: false` (matches taste enricher at `enricher.ts:38`) prevents the model from inventing keys.
- `imageUrl` is intentionally absent — no source image for structured-input mode (D-19 forbids URL extract from using uploaded photos; symmetrically, structured input has no URL source for an image). Phase 69 EXTR-06 separately adds an `imageUrl` field via direct `CatalogPhotoUploader` upload, not via this LLM call.

## Recommended Prompt Copy

```typescript
const SYSTEM_PROMPT = `You are a watch-spec assistant for a serious collector tool.

You will receive a watch identity: brand, model, and optionally a reference number and/or production year. You must call the extract_watch_from_identity tool exactly once with your best-known specifications for that watch.

Rules:
- ALWAYS echo brand and model. Normalize casing (e.g. "omega" → "Omega", "rolex submariner" → model "Submariner"). Do not invent words the user did not supply unless normalizing.
- ECHO the reference number when the user supplied one, in its conventional form. When the user did not supply a reference, infer one ONLY if it is uniquely determinable from brand+model+year; otherwise omit the reference field.
- For every other field, INFER from your training knowledge ONLY when you have reliable confidence. If you would otherwise guess, OMIT the field. A missing field is always better than a wrong one.
- "chrono" means a chronograph (start/stop/reset pushers + timing subdials). "chronometer-certified" is NOT a complication — set isChronometer: true instead.
- Style tags describe what TYPE of watch it is (diver, dress, field). Design traits describe visual/aesthetic character (heritage, minimalist, bold).
- Reply ONLY by calling extract_watch_from_identity. Do not emit any text response.`

// User message:
function buildUserMessage(input: StructuredExtractionInput): string {
  const parts = [`Brand: ${input.brand}`, `Model: ${input.model}`]
  if (input.reference) parts.push(`Reference: ${input.reference}`)
  if (input.year) parts.push(`Year: ${input.year}`)
  return parts.join('\n')
}
```

**Comparison to URL prompt (`llm.ts:15-48`):** Tone consistent — same field-by-field constraints, same "when in doubt, leave it out" stance, same chronograph/chronometer disambiguation. Two differences:
1. URL prompt asks for JSON in a code fence; structured prompt requires the tool — explicit "reply ONLY by calling extract_watch_from_identity".
2. URL prompt grounds in scraped page text; structured prompt grounds in the user identity + model's training knowledge.

## Recommended D-06 Copy + Mode-Threading Mechanism

**LOCKED current copy (D-15, URL):**
```
"Couldn't find watch info on this page. Try the original product page or enter manually."
```

**Recommended structured-mode copy:**
```
"Couldn't find specs for that watch. Try adding a reference number, or enter manually."
```

Rationale: structured users supplied identity not a page, so "on this page" is wrong. The new copy nudges toward the user-controllable refinement (reference number) and falls back to manual entry.

**Recommended representation in `CATEGORY_COPY`:**

```typescript
const CATEGORY_COPY: Record<ExtractErrorCategory, { url: string; structured: string }> = {
  'host-403': {
    url: "This site doesn't allow data extraction. Try entering manually.",
    structured: "This site doesn't allow data extraction. Try entering manually.", // unreachable for structured but kept for shape symmetry
  },
  'structured-data-missing': {
    url:        "Couldn't find watch info on this page. Try the original product page or enter manually.",
    structured: "Couldn't find specs for that watch. Try adding a reference number, or enter manually.",
  },
  'LLM-timeout': {
    url:        'Extraction is taking longer than expected. Try again or enter manually.',
    structured: 'Extraction is taking longer than expected. Try again or enter manually.',
  },
  'quota-exceeded': {
    url:        'Extraction service is busy. Try again in a few minutes.',
    structured: 'Extraction service is busy. Try again in a few minutes.',
  },
  'generic-network': {
    url:        "Couldn't reach that URL. Check the link and try again.",
    structured: "Something went wrong looking that up. Try again in a moment.",
  },
}
// Selection: CATEGORY_COPY[category][mode]
```

**Alternative (simpler) shape if planner prefers:** Keep `CATEGORY_COPY` flat (single string per category), add a second `CATEGORY_COPY_STRUCTURED` map that contains overrides ONLY for the rows that need to differ. Less repetition, fewer places to drift.

**Mode-threading in the response payload:** Confirmed — the route should ALWAYS include `mode: 'url' | 'structured'` in every success AND error JSON body. This is the single source of truth for Phase 69's `<ExtractErrorCard>` copy selection. The client's request mode and the response's mode field will always match (no server-side mode flip), so the field is informational but eliminates a client-side state-tracking dependency.

## Cheerio Short-Circuit Enforcement

EXTR-02 demands the structured branch never enters cheerio code paths. Three layers of defense:

1. **Don't call `fetchAndExtract` or `extractWatchData`** from the structured branch — verifiable by static grep on the structured branch's call graph.
2. **Don't import `@/lib/extractors` (the orchestrator barrel)** from `llm-structured.ts` — even an unused import would re-export cheerio.
3. **Integration test asserts at runtime:**
   ```typescript
   import * as cheerio from 'cheerio'
   const loadSpy = vi.spyOn(cheerio, 'load')
   // ... call POST with mode: 'structured' ...
   expect(loadSpy).not.toHaveBeenCalled()
   ```

The first two are code-review concerns; the third is the executable gate.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text completion + regex `{…}` + `JSON.parse` (URL branch / WR-06) | Strict tool-use with `tool_choice: { type: 'tool', name }` (taste enricher; structured branch) | Phase 19.1 (taste enricher); now Phase 66 for structured input | Eliminates JSON-parse failure mode; SDK type narrows on tool_use block; schema validated server-side by Anthropic |
| Zod 3 `.errors` property | Zod 4 `.issues` property | Already on 4.3.6 in repo | Existing callsites use `.issues` (e.g. `src/lib/taste/enricher.ts:174`); new callsites must follow |
| Custom JSON Schema for tool input | Same — Anthropic SDK v0.88 still uses JSON Schema | Stable | Reuse the Anthropic.Messages.Tool `satisfies` shape (`taste/enricher.ts:33` pattern) |
| `revalidateTag(tag)` (Next 15) | `revalidateTag(tag, revalidate?)` two-arg (Next 16) | Next 16 upgrade | URL branch at `route.ts:230` uses `'max'`; structured must too |

**Deprecated/outdated:**
- `instanceof Anthropic.RateLimitError` for 429 detection — duck-type via `.status === 429` instead (Phase 25 lesson, `route.ts:71-76` comment).
- Zod 3 `error.errors` — use `error.issues` in Zod 4.

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Next 16 — not your training data's Next:** `AGENTS.md` warns APIs may differ. Critical for `revalidateTag` two-arg form (Pitfall 4). When in doubt, read `node_modules/next/dist/docs/` rather than recall.
- **Tech stack locked:** Next 16, TypeScript strict, no rewrites. ✓ Phase 66 is additive only.
- **Data model:** `ExtractedWatchData` shape is established; extend don't break. ✓ Phase 66 reuses the type unchanged.
- **GSD workflow enforcement:** all edits must flow through GSD. ✓ This is a GSD-planned phase.
- **Path aliases:** `@/*` → `src/*`. ✓ All recommended imports use `@/...`.
- **Naming conventions:** camelCase for non-component files; `llm-structured.ts` follows precedent (`llm.ts`, `structured.ts`).
- **Type-only imports:** use `import type` where applicable. ✓ Anthropic SDK types should be `import type { ... } from '@anthropic-ai/sdk'` where possible (or import the namespace via `import Anthropic from '@anthropic-ai/sdk'` and use `Anthropic.Messages.Tool`, `Anthropic.Messages.ToolUseBlock`).
- **`workflow.use_worktrees = false`:** permanent — DB-touching project. ✓ No worktree expectations.
- **Build is the gate:** `npm run build` exit 0 is authoritative; `tsc --noEmit` carries pre-existing test-file errors. ✓ Plan should rely on build, not full tsc.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `claude-sonnet-4-6` supports strict tool-use with `tool_choice: { type: 'tool', name }` | §Code Examples, §Recommended Tool input_schema | [VERIFIED — same model + same tool_choice shape is already in production via `src/lib/taste/enricher.ts` and `src/lib/taste/webSearch.ts:165-179`. Not assumed.] |
| A2 | The Anthropic SDK throws RateLimitError-shaped errors (`.status === 429`) on tool-use calls the same way it does on text completion | §Pitfall 6 | [VERIFIED — `node_modules/@anthropic-ai/sdk/core/error.d.ts:23-49` shows the error hierarchy is independent of the request type; `APIError<429, ...>` raised based on HTTP status. Existing URL branch already relies on this.] |
| A3 | The model will reliably echo brand/model when supplied | §Recommended Prompt Copy | [ASSUMED — based on training intuition; high confidence given explicit system-prompt instruction + tool schema `required` constraint. Worst case is occasional non-normalized echo — fail-soft because downstream catalog upsert ignores case via `lower(trim(brand))` normalization (`catalog.ts:153`).] |
| A4 | Sub-second-ish latency on structured-input Anthropic calls (no SLA tightening needed beyond the existing `LLM-timeout` category) | §Don't Hand-Roll error categorization | [ASSUMED — text-only model call with bounded prompt + `max_tokens: 1024`; in practice ~1-3s on `claude-sonnet-4-6`. If structured calls prove materially slower than URL calls (unlikely — URL calls also include scraping latency), a future phase could add a structured-specific timeout. Not blocking.] |
| A5 | The `mode` field added to error responses does not break the existing Phase 25 `<ExtractErrorCard>` contract | §Recommended D-06 Copy + Mode-Threading Mechanism | [ASSUMED — Phase 69 will WIRE the new field; Phase 66 only ADDS it. Today's consumer reads `category` and ignores unknown fields (JS objects); adding `mode` is non-breaking by JSON semantics. Risk only if `<ExtractErrorCard>` runs against a Zod parse on the response that uses `.strict()` — unlikely on a fetch response.] |
| A6 | `imageSourceUrl` semantics translate trivially to structured (NULL is acceptable) | §URL-Branch Behavior Contract row 7 | [VERIFIED via the schema — `upsertCatalogFromUserInput` does not take an `imageSourceUrl` (`catalog.ts:138-164`); it writes only brand/model/reference. Structured branch passes none → no risk.] |

**Action for planner / discuss-phase:** A3, A4, A5 are model-behavior / forward-compatibility assumptions. A3 in particular should be validated by the human UAT (try lowercased input, see what catalog row gets written). None block plan creation.

## Open Questions

1. **Should `fieldsExtracted` be populated in the structured response?**
   - What we know: URL branch returns `fieldsExtracted: string[]` derived from union of static + LLM keys (`extractors/index.ts:43-48`). Test fixture doesn't assert on this field.
   - What's unclear: Whether downstream consumers (Phase 69 `<ExtractErrorCard>` doesn't use it; Phase 70 `AddWatchFlow` may?) read it.
   - Recommendation: Populate from `Object.keys(data).filter(k => data[k] !== undefined)` for shape parity. Cheap, prevents downstream surprise.

2. **Should `confidence` field be returned by structured branch, and what value?**
   - What we know: URL branch returns `'high'` / `'medium'` / `'low'` based on field count.
   - What's unclear: No equivalent confidence signal for structured-input — the LLM either knew the watch or didn't.
   - Recommendation: Return `'medium'` constant for now. If Phase 69 surfaces this in UI, revisit.

3. **Should the structured-branch response include the original input (`brand`, `model`, `reference?`, `year?` echo)?**
   - What we know: URL branch returns `data` from extraction (which contains the LLM's echo).
   - What's unclear: When the LLM hallucinates the brand differently from input, should the route trust input or LLM?
   - Recommendation: Trust LLM (it's a tool-use response, schema-validated). If hallucination becomes a UAT issue, change the validator to override LLM's brand/model fields with the user's input — but defer that complexity.

4. **The `revalidateTag('explore', 'max')` second-arg type signature in Next 16.2.3**
   - What we know: URL branch uses it at `route.ts:230`. `addWatch` action also uses it.
   - What's unclear: AGENTS.md warns Next 16 APIs differ; the type signature may have evolved. Build-gate (`npm run build`) is the truth — if it compiles and runs against the existing URL-branch call, the structured branch's identical call will too.
   - Recommendation: No action — copy the literal call.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@anthropic-ai/sdk` package | LLM call (`llm-structured.ts`) | ✓ | 0.88.0 | — |
| `zod` package | Body validation | ✓ | 4.3.6 | — |
| `cheerio` package | URL branch (not structured) | ✓ | 1.2.0 | — |
| `ANTHROPIC_API_KEY` env var | Anthropic SDK constructor | Configured | — | URL branch throws `'ANTHROPIC_API_KEY not configured'`; structured branch must mirror this (and the error must categorize via the existing `categorizeExtractionError` — likely `generic-network` HTTP 500) |
| Anthropic API reachability | Live tool-use call | External — assumed available | — | `LLM-timeout` / `quota-exceeded` / `generic-network` taxonomy handles outage |
| `claude-sonnet-4-6` model access | Strict tool-use against this model | Already used by URL branch + taste enricher in prod | — | None — same model |

**No missing dependencies.** All environment requirements satisfied by the existing URL branch's runtime needs.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing — see `vitest.config.*` and `tests/` tree) |
| Config file | `vitest.config.ts` / `vitest.config.browser.ts` (verified by `tests/static/ppr-dynamic-before-use-cache.test.ts` annotation pattern) |
| Quick run command | `npm run test -- tests/api/extract-watch.test.ts` (existing URL-branch tests) |
| Full suite command | `npm run test` |
| Phase gate | `npm run build` (per CLAUDE.md baseline-not-green memo — build exit 0 is the authoritative gate) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| EXTR-01 | Discriminated body — `mode:'url'` accepted | unit (Zod schema) | `npm run test -- tests/api/extract-watch.test.ts` | ✅ existing |
| EXTR-01 | Discriminated body — `mode:'structured'` accepted | unit (Zod schema) | same | ❌ Wave 0 — add |
| EXTR-01 | Discriminated body — missing `mode` → 400 | unit (Zod schema) | same | ❌ Wave 0 — add |
| EXTR-01 | Discriminated body — `mode:'invalid'` → 400 | unit (Zod schema) | same | ❌ Wave 0 — add |
| EXTR-02 | Cheerio NOT called when `mode:'structured'` | integration (`vi.spyOn(cheerio,'load')`) | same | ❌ Wave 0 — add |
| EXTR-03 | Brand required (structured) → 400 | unit (Zod schema) | same | ❌ Wave 0 — add |
| EXTR-03 | Model required (structured) → 400 | unit (Zod schema) | same | ❌ Wave 0 — add |
| EXTR-03 | Response `ExtractedWatchData` shape consistent with URL branch | integration (mocked Anthropic SDK) | same | ❌ Wave 0 — add |
| EXTR-04 | LLM call uses `tools` + `tool_choice: { type: 'tool', name: 'extract_watch_from_identity' }` | unit (mock Anthropic client, assert call args) | `npm run test -- tests/extractors/llm-structured.test.ts` (new file) | ❌ Wave 0 — add |
| EXTR-04 | LLM call uses model `claude-sonnet-4-6` | unit (assert call args) | same | ❌ Wave 0 — add |
| EXTR-04 | Tool input → `ExtractedWatchData` via `validateAndCleanData` | unit | same | ❌ Wave 0 — add |
| EXTR-04 | No tool_use block → throws "tool_use block missing" → categorized as `generic-network` | unit + integration | both | ❌ Wave 0 — add |
| EXTR-08 | `upsertCatalogFromUserInput` called on structured success | integration (spy on catalog DAL) | `npm run test -- tests/api/extract-watch.test.ts` | ❌ Wave 0 — add |
| EXTR-08 | `upsertCatalogFromExtractedUrl` NOT called on structured | integration (spy on catalog DAL) | same | ❌ Wave 0 — add |
| (regression) | URL branch existing tests still pass | integration | same | ✅ existing — `tests/api/extract-watch.test.ts:51-269` |

### Sampling Rate

- **Per task commit:** `npm run test -- tests/api/extract-watch.test.ts tests/extractors/llm-structured.test.ts`
- **Per wave merge:** `npm run test` (full suite)
- **Phase gate:** `npm run build` exits 0; both new test files green; URL-branch test fixture unchanged and green

### Wave 0 Gaps

- [ ] `tests/extractors/llm-structured.test.ts` — covers EXTR-04 (Anthropic client mock + tool-use call shape + validateAndCleanData mapping)
- [ ] Extend `tests/api/extract-watch.test.ts` — covers EXTR-01 (Zod discriminated union), EXTR-02 (cheerio spy), EXTR-03 (brand/model required), EXTR-08 (catalog upsert function selection)
- [ ] Mock fixtures for Anthropic tool-use responses (use existing `tests/setup/mockAnthropic.ts` pattern) — verify by reading `tests/setup/mockAnthropic.ts` during planning

### Out-of-band human UAT (not automatable)

- Real Anthropic API call with a known watch (e.g. Brand: Omega, Model: Speedmaster, Reference: 3570.50) returns a catalog row with at least 3 inferred fields populated.
- Cross-mode regression: post a URL extraction in the same session as a structured extraction; both produce coherent catalog rows.

## Sources

### Primary (HIGH confidence)
- `src/app/api/extract-watch/route.ts` (the route being extended) — 311 LOC fully read
- `src/lib/extractors/llm.ts` — existing URL LLM call (text completion); reference for prompt + client init + `validateAndCleanData`
- `src/lib/extractors/types.ts` — `ExtractedWatchData` shape
- `src/lib/extractors/index.ts` — `fetchAndExtract` orchestrator (URL pipeline)
- `src/lib/extractors/structured.ts` — JSON-LD scraping (naming-warning reference)
- `src/lib/taste/enricher.ts` — strict tool-use reference implementation (Phase 19.1)
- `src/lib/taste/webSearch.ts` — strict tool-use forced-tool pattern (`tool_choice: { type: 'tool', name }`)
- `src/lib/taste/types.ts` — `EnrichmentSource` union (must extend per D-03)
- `src/data/catalog.ts:128-244` — `upsertCatalogFromUserInput` + `upsertCatalogFromExtractedUrl` signatures
- `src/lib/auth.ts` — `getCurrentUser` + `UnauthorizedError`
- `src/lib/constants.ts` — enum constants reused in tool input_schema
- `src/app/actions/verdict.ts:35` — Zod usage example in Server Actions
- `tests/api/extract-watch.test.ts` — existing URL-branch test contract (269 LOC)
- `node_modules/@anthropic-ai/sdk/package.json` — v0.88.0 confirmed
- `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts:1028-1090, :1122-1171, :1363-1372` — Tool / ToolChoice / ToolUseBlock type defs
- `node_modules/@anthropic-ai/sdk/core/error.d.ts` — SDK error hierarchy
- `node_modules/zod/package.json` — v4.3.6 confirmed
- `node_modules/zod/src/v4/classic/tests/discriminated-unions.test.ts:35-141` — v4 `discriminatedUnion` syntax + error shape verified
- `node_modules/zod/src/v4/classic/tests/error-utils.test.ts:498-552` — v4 ZodError `.issues` shape verified

### Secondary (MEDIUM confidence)
- `.planning/phases/66-api-route-extension/66-CONTEXT.md` — phase decisions (D-01..D-08)
- `.planning/REQUIREMENTS.md` — EXTR requirements
- `.planning/ROADMAP.md` — Phase 66 goal + success criteria
- `.planning/STATE.md` — milestone position + recent Phase 64/65 lessons

### Tertiary (LOW confidence)
- (none — all claims verified against primary sources)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified in `package.json`; SDK + Zod APIs verified against `node_modules/` source files
- Architecture: HIGH — system diagram derived directly from `route.ts` + `extractors/index.ts` + `taste/enricher.ts`
- Pitfalls: HIGH — most are codified from prior phases' lessons (Phase 25 WR-06, Phase 19.1 strict-tool-use, Phase 46 CR-01); a few are forward-looking but verifiable
- Tool-use patterns: HIGH — exact same model + SDK + tool_choice shape already in prod via taste enricher
- Recommended prompt copy: MEDIUM — copy is draft; UAT will iterate. Schema constraints are HIGH (derived from `src/lib/constants.ts`)

**Research date:** 2026-05-28
**Valid until:** 2026-06-27 (30 days — stable Next 16 + SDK v0.88 + Zod 4.3; faster expiry only if Anthropic releases a tool-use API shape change)

## RESEARCH COMPLETE

**Phase:** 66 - API Route Extension
**Confidence:** HIGH

### Key Findings

- The phase is almost entirely additive plumbing: ~40 LOC schema + dispatch in `route.ts`, ~80 LOC in a new `src/lib/extractors/llm-structured.ts`, ~2 LOC `EnrichmentSource` extension in `src/lib/taste/types.ts`. All upstream and downstream seams already exist.
- **Anthropic strict tool-use pattern is already in production** via `src/lib/taste/enricher.ts` and `src/lib/taste/webSearch.ts` (same model `claude-sonnet-4-6`, same `tool_choice: { type: 'tool', name }` shape). The structured-input call should mirror this code directly.
- **Zod v4.3.6 `discriminatedUnion` syntax verified** against `node_modules/zod/src/v4/classic/tests/`. Critical v3→v4 gotcha: error shape is `.issues`, NOT `.errors` — the existing taste enricher already uses `.issues` so the pattern is established.
- **The URL branch behavior contract has 18 observable properties** (response fields, status codes, side effects, error categorization rules) pinned by the existing test fixture (`tests/api/extract-watch.test.ts:51-269`). The structured branch additions must not break any of them; specifically, response fields `error`/`category` strings are exact-string matched by tests.
- **Mode-threading recommendation:** route returns `mode: 'url' | 'structured'` in BOTH success AND error response bodies. This unblocks Phase 69's `<ExtractErrorCard>` D-06 mode-aware copy with zero client-side state tracking.

### File Created

`.planning/phases/66-api-route-extension/66-RESEARCH.md` (absolute: `/Users/tylerwaneka/Documents/horlo/.planning/phases/66-api-route-extension/66-RESEARCH.md`)

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | SDK + Zod versions confirmed in `node_modules/`; APIs verified in source |
| Architecture | HIGH | System diagram derived from reading `route.ts` + `extractors/index.ts` + `taste/enricher.ts` end-to-end |
| Pitfalls | HIGH | 6 of 8 pitfalls codified from prior phases' lessons; the other 2 (system/user split, ToolUseBlock.input typing) verified against SDK types |
| Tool-use prompt copy | MEDIUM | Draft copy — UAT will iterate; schema enums HIGH (derived from `constants.ts`) |
| Mode-aware error copy | MEDIUM | Recommended structured copy is draft; consumer (Phase 69) hasn't validated UX yet |

### Open Questions

1. Should `fieldsExtracted` be populated in the structured response? (Recommendation: yes, derive from `Object.keys(data).filter(k => data[k] !== undefined)`.)
2. Should `confidence` field be populated? (Recommendation: constant `'medium'` until Phase 69 demonstrates need.)
3. Should the structured-branch response trust LLM echo or user input for brand/model? (Recommendation: LLM — schema-validated; revisit only if UAT shows hallucination.)

### Ready for Planning

Research complete. Planner can now create PLAN.md files. Recommended plan structure (planner's decision):
- Plan 01 — `src/lib/extractors/llm-structured.ts` (Tool def + prompts + extraction function + `EnrichmentSource` union extension)
- Plan 02 — `src/app/api/extract-watch/route.ts` extension (Zod schema + dispatch + structured branch + mode threading + D-06 copy table)
- Plan 03 — Tests: extend `tests/api/extract-watch.test.ts` for the structured-branch contract + new `tests/extractors/llm-structured.test.ts` for the LLM call
- (planner may split or combine; the three lobes above represent the minimum task surface)

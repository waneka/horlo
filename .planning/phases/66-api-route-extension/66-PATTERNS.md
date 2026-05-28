# Phase 66: API Route Extension - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 5 (2 create + 3 modify)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Action | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `src/lib/extractors/llm-structured.ts` | CREATE | service / LLM client wrapper | request-response (input → Anthropic SDK strict tool-use → typed output) | `src/lib/taste/enricher.ts` (primary — strict-tool-use shape) + `src/lib/extractors/llm.ts` (secondary — client init, max_tokens, validateAndCleanData) | exact (combination of two) |
| `tests/extractors/llm-structured.test.ts` | CREATE | unit test | mocked Anthropic SDK → assert call args + tool-use response parse | `tests/extractors/llm.test.ts` | exact (same module sibling) |
| `src/app/api/extract-watch/route.ts` | MODIFY | route-handler | HTTP POST → auth → Zod validate → dispatch (URL vs structured) → DAL → revalidate | self (existing URL pattern is the analog for new structured branch) | exact (self-analog) |
| `src/lib/taste/types.ts` | MODIFY | type-definition | n/a (string-literal union extension) | self | exact (self-analog) |
| `tests/api/extract-watch.test.ts` | MODIFY | integration test | NextRequest → mocked POST → JSON assertions | self (existing URL-branch describe block) | exact (self-analog) |

## Pattern Assignments

### `src/lib/extractors/llm-structured.ts` (NEW — service, request-response)

**Analog A (PRIMARY — strict tool-use shape):** `src/lib/taste/enricher.ts`
**Analog B (SECONDARY — client init + validateAndCleanData):** `src/lib/extractors/llm.ts`

#### A1. Imports + `Anthropic.Messages.Tool` definition with `satisfies`

Source: `src/lib/taste/enricher.ts:15-17, :30-61` — this is the canonical strict-tool-use definition in the repo.

```typescript
import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
// ...

// Tool-use definition with strict: true for Anthropic structured-output guarantees.
const TASTE_TOOL = {
  name: 'record_taste_attributes',
  description: 'Record structured taste attributes for a watch.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      formality:      { type: 'number', minimum: 0, maximum: 1, description: '...' },
      sportiness:     { type: 'number', minimum: 0, maximum: 1 },
      // ... (enum properties)
      era_signal:     { type: 'string', enum: [...ERA_SIGNALS] },
      design_motifs:  {
        type: 'array',
        items: { type: 'string', enum: [...DESIGN_MOTIFS] },
        maxItems: 8,
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: ['formality', 'sportiness', 'heritage_score', 'era_signal', 'design_motifs', 'confidence'],
  },
} satisfies Anthropic.Messages.Tool
```

**Copy directly:** the `satisfies Anthropic.Messages.Tool` shape, `additionalProperties: false`, the closed-vocabulary `enum: [...CONSTANT]` spread pattern (use `MOVEMENT_TYPES`, `COMPLICATIONS`, `STRAP_TYPES`, `CRYSTAL_TYPES`, `DIAL_COLORS`, `STYLE_TAGS`, `DESIGN_TRAITS` from `@/lib/constants`).

#### A2. Anthropic client init + `messages.create` with forced tool_choice

Source: `src/lib/taste/enricher.ts:88-95, :106-110` for client init; `src/lib/taste/webSearch.ts:165-179` for the forced-tool messages.create call shape.

```typescript
// Client init pattern (taste/enricher.ts:88-109)
const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  logEvent('taste_enrichment_skipped:no_api_key', { /*...*/ })
  return null
}
// ...
const client = new Anthropic({
  apiKey,
  ...(clientOptions?.maxRetries !== undefined ? { maxRetries: clientOptions.maxRetries } : {}),
})

// Forced-tool messages.create (taste/webSearch.ts:165-174)
const forced = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  tools: customTools,
  tool_choice: { type: 'tool', name: customToolName },
  messages: appendGroundingToLastMessage(initialMessages, collectTextBlocks(primary.content)),
})
```

**Copy directly:** the four call-args shape — `model: 'claude-sonnet-4-6'`, `max_tokens: 1024`, `tools: [TOOL]`, `tool_choice: { type: 'tool', name: '...' }`.

**Diverge from analog A on API-key handling:** `enricher.ts` returns `null` on missing key (fire-and-forget posture). The structured-input extractor must **throw** instead (mirrors `llm.ts:54-58` below) so the route's `categorizeExtractionError` catch maps it to `generic-network` HTTP 500. The route layer owns the error taxonomy — the LLM module signals failure by throwing.

#### A3. ToolUseBlock extraction (Pitfall 1: never index `[0]`)

Source: `src/lib/taste/webSearch.ts:155-160, :176-179` and `src/lib/taste/enricher.ts:156-165`.

```typescript
// Pattern 1 (preferred for forced-tool calls — webSearch.ts:176-179)
const toolUse =
  forced.content.find(
    (c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use',
  ) ?? null

// Pattern 2 (with named-tool filter — webSearch.ts:155-158)
const primaryToolUse = primary.content.find(
  (c): c is Anthropic.Messages.ToolUseBlock =>
    c.type === 'tool_use' && c.name === customToolName,
)
```

**Copy directly:** the `find((c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use')` type-narrowing predicate. Never use `response.content[0]` — forced tool-use can still prepend text blocks (Pitfall 1).

#### A4. Client-init key-presence throw (the URL-branch alternative to A2's silent-null)

Source: `src/lib/extractors/llm.ts:54-58`.

```typescript
export async function extractWithLlm(
  html: string,
  structuredContext?: string
): Promise<ExtractedWatchData> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }
  // ...
}
```

**Copy directly** for the new structured extractor — D-05 reuses the 5-category error taxonomy, and an `Error` thrown here falls through `categorizeExtractionError` to `generic-network` exactly as the URL branch does today.

#### A5. validateAndCleanData reuse (Pitfall 8: `toolUse.input` is typed `unknown`)

Source: `src/lib/extractors/llm.ts:109, :133-212` — the function takes a `Record<string, unknown>` and returns a typed `ExtractedWatchData` after exhaustive enum-checking.

```typescript
// Caller site (llm.ts:109)
return validateAndCleanData(parsed)

// Validator (llm.ts:133-212, 80 LOC) — already type-guards every field against:
//   MOVEMENT_TYPES, COMPLICATIONS, STRAP_TYPES, CRYSTAL_TYPES, DIAL_COLORS, STYLE_TAGS, DESIGN_TRAITS
//   numeric range bounds (caseSizeMm 20-55, lugToLugMm 30-60, waterResistanceM ≥ 30)
function validateAndCleanData(data: Record<string, unknown>): ExtractedWatchData {
  const cleaned: ExtractedWatchData = {}
  if (typeof data.brand === 'string' && data.brand.length > 0) {
    cleaned.brand = data.brand
  }
  if (typeof data.movement === 'string' &&
      MOVEMENT_TYPES.includes(data.movement as typeof MOVEMENT_TYPES[number])) {
    cleaned.movement = data.movement as MovementType
  }
  // ... 80 more LOC of the same shape
}
```

**Reuse approach:** EXPORT `validateAndCleanData` from `llm.ts` (it is currently a module-private function) and IMPORT it into `llm-structured.ts`. Do NOT duplicate the 80 LOC of enum-validation logic — it pins the same project constants. The exported function name becomes part of the public surface of the `extractors/` directory; document the export in the `llm.ts` header.

Call site in new module: `return validateAndCleanData(toolUse.input as Record<string, unknown>)`.

#### A6. File-header naming disambiguation (D-01 caveat)

Per D-01, the new file MUST carry a header comment that distinguishes structured-INPUT from structured-DATA. Reference shape, adapted from `src/lib/taste/enricher.ts:1-14`:

```typescript
// src/lib/extractors/llm-structured.ts
//
// Phase 66 structured-INPUT LLM extraction (EXTR-04 / D-01..D-02).
//
// NAMING: This module handles the LLM call for STRUCTURED INPUT — user-supplied
// {brand, model, reference?, year?}. It is UNRELATED to ./structured.ts in this
// same directory, which extracts STRUCTURED DATA (JSON-LD) from scraped HTML.
//
// Server-only — never imported from a Client Component.
//
// Public surface:
//   extractFromStructuredInput(input) → ExtractedWatchData
//     - throws on missing API key, no tool_use block, SDK errors
//     - all thrown errors are categorized at the route boundary via
//       categorizeExtractionError (D-05; 5-category taxonomy)
```

---

### `tests/extractors/llm-structured.test.ts` (NEW — unit test)

**Analog:** `tests/extractors/llm.test.ts` (sibling, same SDK mocking concern, same `vi.mock('@anthropic-ai/sdk', ...)` shape).

#### B1. SDK mock + module-after-mock import dance

Source: `tests/extractors/llm.test.ts:1-23`.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  }))
  return { default: MockAnthropic }
})

// Import after mocking so the module picks up the mock
const { extractWithLlm } = await import('@/lib/extractors/llm')
```

**Copy directly:** the `vi.mock('@anthropic-ai/sdk', ...)` factory shape — `MockAnthropic` constructor returning `{ messages: { create: mockCreate } }`, and the `await import('@/lib/extractors/llm-structured')` at the top level AFTER the mock declaration.

#### B2. beforeEach reset + default tool-use response fixture

Source: `tests/extractors/llm.test.ts:26-40`. The text-completion response shape (`type: 'text'`) must be ADAPTED for tool-use — return `{ content: [{ type: 'tool_use', name: 'extract_watch_from_identity', input: { brand: ..., model: ... } }] }`.

```typescript
beforeEach(() => {
  vi.clearAllMocks()
  // Provide the API key so the function doesn't throw early
  process.env.ANTHROPIC_API_KEY = 'test-key'

  // Default successful response shape  ◀── ADAPT for tool-use:
  mockCreate.mockResolvedValue({
    content: [
      {
        type: 'text',
        text: JSON.stringify({ brand: 'Rolex', model: 'Submariner' }),
      },
    ],
  })
})
```

**Adapt for tool-use fixture:**
```typescript
mockCreate.mockResolvedValue({
  content: [
    {
      type: 'tool_use',
      id: 'toolu_abc',
      name: 'extract_watch_from_identity',
      input: { brand: 'Omega', model: 'Speedmaster' /* ...optional fields */ },
    },
  ],
})
```

#### B3. Call-args assertion shape (model + tool_choice)

Source: `tests/extractors/llm.test.ts:42-58`.

```typescript
it('calls messages.create with model claude-sonnet-4-6', async () => {
  const minimalHtml = '<html>...</html>'
  await extractWithLlm(minimalHtml)

  expect(mockCreate).toHaveBeenCalledOnce()
  const callArgs = mockCreate.mock.calls[0][0] as { model: string }
  expect(callArgs.model).toBe('claude-sonnet-4-6')
})
```

**Adapt for EXTR-04 assertions:**
```typescript
const callArgs = mockCreate.mock.calls[0][0] as {
  model: string
  tools: Array<{ name: string }>
  tool_choice: { type: string; name: string }
}
expect(callArgs.model).toBe('claude-sonnet-4-6')
expect(callArgs.tools[0].name).toBe('extract_watch_from_identity')
expect(callArgs.tool_choice).toEqual({ type: 'tool', name: 'extract_watch_from_identity' })
```

#### B4. Test categories to cover (per RESEARCH §Wave 0 Gaps)

Adapt the `describe('extractWithLlm — model ID', ...)` block structure for these test groups:
- model + tool_choice assertions (B3 shape)
- tool input → `ExtractedWatchData` mapping via `validateAndCleanData` (e.g., golden-path enum normalization)
- no tool_use block → throws `'tool_use block missing'` (Pitfall 1 fallback)
- missing API key → throws `'ANTHROPIC_API_KEY not configured'`

---

### `src/app/api/extract-watch/route.ts` (MODIFY — route-handler)

**Analog:** itself — the existing URL branch is the structural template for the new structured branch. The file is 311 LOC; the planner must preserve every observable behavior pinned in `tests/api/extract-watch.test.ts:51-269` while extending with a discriminated body + structured dispatch.

#### C1. Auth-first gate (PRESERVE VERBATIM — must run before body parse)

Source: `src/app/api/extract-watch/route.ts:80-90`.

```typescript
export async function POST(request: NextRequest) {
  // AUTH-04 / D-14: auth gate runs FIRST, before URL parsing or SSRF check.
  // Proxy is an optimistic outer gate; this is the per-route-handler inner gate.
  try {
    await getCurrentUser()
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    throw err
  }
  // ... body parse + mode dispatch below
}
```

**Preserve exactly.** D-Discretion locks the ordering: `getCurrentUser()` runs FIRST, then `request.json()`, then Zod parse, then mode dispatch.

#### C2. Current ad-hoc body parse + URL validation (TO BE REPLACED by Zod discriminated union)

Source: `route.ts:92-118`. Test fixture at `tests/api/extract-watch.test.ts:76-98` pins the EXACT error strings.

```typescript
try {
  const body = await request.json()
  const { url } = body

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json(
      { error: 'Only HTTP/HTTPS URLs are supported' },
      { status: 400 }
    )
  }
  // ...
```

**Replacement strategy:** introduce `extractRequestSchema = z.discriminatedUnion('mode', [urlBodySchema, structuredBodySchema])` AT TOP OF FILE (per D-08, colocated). On parse failure return `{ error: parsed.error.issues[0]?.message ?? 'Invalid request' }` HTTP 400.

**Hard constraint from test fixture:** The existing tests assert EXACT strings `'URL is required'`, `'Invalid URL format'`, `'Only HTTP/HTTPS URLs are supported'`. Two options for the planner:
- (a) Keep the post-Zod manual `new URL(url)` + protocol check verbatim for the URL branch (Zod just dispatches on mode + verifies `url` is a non-empty string).
- (b) Use `z.string().url()` with custom error messages — but this risks Zod 4 URL-validator semantics differing from `new URL()` (e.g., relative URLs). Option (a) is safer for zero-regression.

#### C3. Catalog upsert + `catalogId`/`catalogIdError` observability (MIRROR for structured branch with DIFFERENT DAL function)

Source: `route.ts:139-183`.

```typescript
let catalogId: string | null = null
let catalogIdError: string | null = null
try {
  if (result.data?.brand && result.data?.model) {
    catalogId = await catalogDAL.upsertCatalogFromExtractedUrl({  // ◀── URL branch only
      brand: result.data.brand,
      model: result.data.model,
      reference: result.data.reference ?? null,
      movementType: result.data.movement ?? null,
      // ... 14 more fields including imageSourceUrl: url, imageSourceQuality: 'unknown'
    })
    if (!catalogId) {
      catalogIdError = 'catalog upsert returned null id'
    }
  } else {
    catalogIdError = 'brand/model missing from extraction'
  }
} catch (err) {
  console.error('[extract-watch] catalog upsert failed (non-fatal):', err)
  catalogIdError = err instanceof Error
    ? `catalog upsert threw: ${err.message.slice(0, 200)}`
    : 'catalog upsert threw'
}
```

**Structured-branch difference (EXTR-08, the critical assertion):** Call `catalogDAL.upsertCatalogFromUserInput({ brand, model, reference })` instead. Signature is much narrower (see `src/data/catalog.ts:138-164`) — only `brand`, `model`, `reference` are accepted; spec fields are intentionally NULL-left for taste enrichment to fill via UPDATE. Mirror the same try/catch + `catalogId`/`catalogIdError` observability variables.

```typescript
// Structured-branch replacement (target DAL):
catalogId = await catalogDAL.upsertCatalogFromUserInput({
  brand: extracted.brand,
  model: extracted.model,
  reference: extracted.reference ?? null,
})
```

#### C4. Taste enrichment + `revalidateTag` (PRESERVE; mirror in structured branch with new `source`)

Source: `route.ts:185-231`.

```typescript
// Phase 19.1 D-07 + D-08: second-pass taste enrichment after spec extraction commits.
if (catalogId && result.data?.brand && result.data?.model) {
  try {
    const { enrichTasteAttributes } = await import('@/lib/taste/enricher')
    const { updateCatalogTaste } = await import('@/data/catalog')
    const taste = await enrichTasteAttributes({
      catalogId,
      source: 'url-extract',  // ◀── structured branch uses 'structured-input'
      spec: {
        brand: result.data.brand,
        model: result.data.model,
        reference: result.data.reference ?? null,
        movement: result.data.movement ?? null,
        caseSizeMm: result.data.caseSizeMm ?? null,
        lugToLugMm: result.data.lugToLugMm ?? null,
        waterResistanceM: result.data.waterResistanceM ?? null,
        crystalType: result.data.crystalType ?? null,
        dialColor: result.data.dialColor ?? null,
        isChronometer: result.data.isChronometer ?? null,
        productionYear: null,
        complications: result.data.complications ?? [],
      },
      photoSourcePath: null,  // D-19: URL extract does NOT use the photo path
    })
    if (taste) {
      await updateCatalogTaste(catalogId, taste)
    }
  } catch (err) {
    console.error('[extract-watch] taste enrichment failed (non-fatal):', err)
  }
}

// Phase 46 CR-01: bust the 'explore' cache tag.
if (catalogId) {
  revalidateTag('explore', 'max')  // ◀── EXACT signature; PRESERVE both args
}
```

**`revalidateTag('explore', 'max')` signature (Pitfall 4):** two-arg form; second arg `'max'` is REQUIRED. Copy verbatim into structured branch.

**Structured branch mirror:** same try/catch + same `enrichTasteAttributes({ catalogId, source: 'structured-input', spec: {...}, photoSourcePath: null })` + same `updateCatalogTaste(catalogId, taste)`. D-04 — `revalidateTag` ALWAYS fires when `catalogId` is truthy, regardless of enrichment success.

#### C5. CATEGORY_COPY + CATEGORY_HTTP_STATUS tables (PRESERVE; D-06 unlocks ONE row)

Source: `route.ts:21-48`.

```typescript
type ExtractErrorCategory =
  | 'host-403'
  | 'structured-data-missing'
  | 'LLM-timeout'
  | 'quota-exceeded'
  | 'generic-network'

const CATEGORY_COPY: Record<ExtractErrorCategory, string> = {
  'host-403':
    "This site doesn't allow data extraction. Try entering manually.",
  'structured-data-missing':
    "Couldn't find watch info on this page. Try the original product page or enter manually.",
  'LLM-timeout':
    'Extraction is taking longer than expected. Try again or enter manually.',
  'quota-exceeded': 'Extraction service is busy. Try again in a few minutes.',
  'generic-network': "Couldn't reach that URL. Check the link and try again.",
}

const CATEGORY_HTTP_STATUS: Record<ExtractErrorCategory, number> = {
  'host-403': 502,
  'structured-data-missing': 422,
  'LLM-timeout': 504,
  'quota-exceeded': 503,
  'generic-network': 500,
}
```

**D-06 unlock:** `structured-data-missing` row becomes mode-branched. Two recommended representations (RESEARCH §Recommended D-06 Copy):
- (a) Make the value type `{ url: string; structured: string }` per category — symmetric, slightly more boilerplate.
- (b) Keep flat `CATEGORY_COPY` and add a `CATEGORY_COPY_STRUCTURED` overrides map. Less repetition.

The route must always include `mode: 'url' | 'structured'` in the response payload (success AND error) so Phase 69's `<ExtractErrorCard>` can select copy.

#### C6. Post-extract `structured-data-missing` gate (MIRROR for structured branch)

Source: `route.ts:122-137`.

```typescript
const brandPopulated = Boolean(result.data?.brand?.trim())
const modelPopulated = Boolean(result.data?.model?.trim())
if (!brandPopulated && !modelPopulated) {
  return NextResponse.json(
    {
      success: false,
      error: CATEGORY_COPY['structured-data-missing'],
      category: 'structured-data-missing' as const,
    },
    { status: CATEGORY_HTTP_STATUS['structured-data-missing'] },
  )
}
```

**Structured-branch mirror:** apply the SAME `brand+model both empty/whitespace` gate to the structured extractor's output before catalog upsert. Per D-06 the response also carries `mode: 'structured'`, and the user-facing copy is selected from the structured-mode variant (see C5).

#### C7. Catch block + SsrfError special case + `categorizeExtractionError` dispatch (PRESERVE; ensure all error responses carry `mode`)

Source: `route.ts:245-310`.

```typescript
} catch (error) {
  console.error('Extraction error:', error)

  if (error instanceof SsrfError) {
    return NextResponse.json(
      {
        success: false,
        error: CATEGORY_COPY['generic-network'],
        category: 'generic-network' as ExtractErrorCategory,
        // ◀── ADD: mode: 'url' (SsrfError unreachable from structured)
      },
      { status: 400 },
    )
  }

  const category = categorizeExtractionError(error)
  switch (category) {
    case 'host-403':
      return NextResponse.json(/*...*/ { status: CATEGORY_HTTP_STATUS['host-403'] })
    case 'LLM-timeout':
      return NextResponse.json(/*...*/ { status: CATEGORY_HTTP_STATUS['LLM-timeout'] })
    case 'quota-exceeded':
      return NextResponse.json(/*...*/ { status: CATEGORY_HTTP_STATUS['quota-exceeded'] })
    case 'generic-network':
    default:
      return NextResponse.json(/*...*/ { status: CATEGORY_HTTP_STATUS['generic-network'] })
  }
}
```

**Preserve verbatim.** D-05 mandates the structured branch's thrown errors also pass through `categorizeExtractionError` (already correctly detects Anthropic SDK 429 via `.status === 429` and timeouts via `AbortError`/`/timeout/i`).

**Required addition:** thread `mode` through to EVERY error response body. Cleanest approach is to read the request mode from the parsed Zod body (when available — outside the catch's scope) by hoisting `mode` to a closure-scoped variable before the try block, defaulting to `'url'` if the parse failed before mode was known.

#### C8. Success response envelope (PRESERVE shape; add `mode`)

Source: `route.ts:236-244`.

```typescript
return NextResponse.json({
  success: true,
  catalogId,
  catalogIdError,
  ...result,  // spreads { data, source, confidence, fieldsExtracted, llmUsed } from ExtractionResult
})
```

**Structured-branch parallel:** must return the same five envelope fields plus `data`, `source: 'llm'`, `confidence: 'medium'` (planner's call), `fieldsExtracted: Object.keys(data).filter(k => data[k] !== undefined)`, `llmUsed: true`. Add `mode: 'url' | 'structured'` to BOTH branches' success responses.

---

### `src/lib/taste/types.ts` (MODIFY — type-definition)

**Analog:** self.

#### D1. Current union (the one-line edit)

Source: `src/lib/taste/types.ts:8`.

```typescript
export type EnrichmentSource = 'manual' | 'url-extract' | 'backfill'
```

**Edit:** extend to
```typescript
export type EnrichmentSource = 'manual' | 'url-extract' | 'backfill' | 'structured-input'
```

#### D2. Existing callers (verified scope — no signature ripple)

Grep `EnrichmentSource` callsites:

```
src/lib/taste/types.ts:8         (declaration)
src/lib/taste/types.ts:28        (field on EnrichmentInput.source)
```

Grep value-literal callsites for `source:`:

```
src/lib/taste/enricher.test.ts:50    source: 'manual',
src/app/api/extract-watch/route.ts:196   source: 'url-extract',     ◀── URL branch
scripts/backfill-taste.ts:262    source: 'backfill',
scripts/reenrich-taste.ts:148    source: 'backfill',
```

**Risk surface:** All existing callers use literals that remain valid after the union extends. No exhaustive `switch` on `EnrichmentSource` exists in the consumers. Safe additive edit (Pitfall 5).

---

### `tests/api/extract-watch.test.ts` (MODIFY — integration test)

**Analog:** self.

#### E1. Vitest mock setup pattern (PRESERVE; structured tests slot in)

Source: `tests/api/extract-watch.test.ts:1-49`.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock all seams BEFORE importing the route handler (vi.mock calls are hoisted).

vi.mock('@/lib/auth', () => ({
  UnauthorizedError: class extends Error {
    constructor(m = 'Not authenticated') { super(m); this.name = 'UnauthorizedError' }
  },
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'u-1', email: 'a@b.co' }),
}))

const mockFetchAndExtract = vi.fn()
vi.mock('@/lib/extractors', () => ({
  fetchAndExtract: (...args: unknown[]) => mockFetchAndExtract(...args),
}))

vi.mock('@/lib/ssrf', () => ({
  SsrfError: class extends Error { /*...*/ },
}))

vi.mock('@/data/catalog', () => ({
  upsertCatalogFromExtractedUrl: vi.fn().mockResolvedValue('cat-123'),
  updateCatalogTaste: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/taste/enricher', () => ({
  enrichTasteAttributes: vi.fn().mockResolvedValue(null),
}))

import { POST } from '@/app/api/extract-watch/route'
import { SsrfError } from '@/lib/ssrf'
import * as catalogDAL from '@/data/catalog'

function mkPost(body: unknown) {
  return new NextRequest('http://localhost/api/extract-watch', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}
```

**Required additions for structured-branch tests:**
- Add `upsertCatalogFromUserInput: vi.fn().mockResolvedValue('cat-456')` to the `@/data/catalog` mock so EXTR-08's "wrong DAL function NOT called" assertion can target it.
- Add `vi.mock('@/lib/extractors/llm-structured', () => ({ extractFromStructuredInput: vi.fn() }))` and a `mockExtractFromStructuredInput` handle.
- For EXTR-02 (cheerio short-circuit): use `import * as cheerio from 'cheerio'; const loadSpy = vi.spyOn(cheerio, 'load')` and assert NOT called when `mode: 'structured'`.

#### E2. Existing describe/it block shape (the new tests must mirror this)

Source: `tests/api/extract-watch.test.ts:51-71` (happy-path example) and `:141-268` (nested describe for category taxonomy).

```typescript
describe('POST /api/extract-watch — beyond auth gate (TEST-05)', () => {
  beforeEach(() => vi.clearAllMocks())

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('returns 200 with extracted data on success', async () => {
    mockFetchAndExtract.mockResolvedValue({
      success: true,
      data: { brand: 'Omega', model: 'Speedmaster' },
    })

    const res = await POST(mkPost({ url: 'https://example.com/watch' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.brand).toBe('Omega')
    expect(body.data.model).toBe('Speedmaster')
  })

  // ... nested describe for 5-category taxonomy at :141
  describe('Phase 25 Plan 04 — UX-05 / D-11..D-15 categorization', () => {
    it('host-403 ...', async () => { /*...*/ })
    it('structured-data-missing — D-12 post-extract gate ...', async () => { /*...*/ })
    // etc.
  })
})
```

**New block to add (parallel structure):**

```typescript
describe('POST /api/extract-watch — structured mode (Phase 66 EXTR-01..04, EXTR-08)', () => {
  beforeEach(() => vi.clearAllMocks())

  // EXTR-01 / EXTR-03 — Zod discriminated union
  it('returns 400 when mode is missing', async () => { /*...*/ })
  it('returns 400 when mode is "invalid"', async () => { /*...*/ })
  it('returns 400 when structured body is missing brand', async () => { /*...*/ })
  it('returns 400 when structured body is missing model', async () => { /*...*/ })

  // EXTR-02 — cheerio short-circuit
  it('does NOT call cheerio.load when mode is structured', async () => { /*...*/ })

  // EXTR-04 — LLM tool-use
  it('calls extractFromStructuredInput when mode is structured', async () => { /*...*/ })

  // EXTR-08 — DAL function selection
  it('calls upsertCatalogFromUserInput (NOT upsertCatalogFromExtractedUrl) on structured success', async () => {
    // ... after POST with mode: 'structured'
    expect(catalogDAL.upsertCatalogFromUserInput).toHaveBeenCalledOnce()
    expect(catalogDAL.upsertCatalogFromExtractedUrl).not.toHaveBeenCalled()
  })

  // EXTR-03 — response shape parity
  it('returns ExtractedWatchData shape with mode: "structured" on success', async () => { /*...*/ })

  // D-06 — mode in error response
  it('returns mode: "structured" in structured-data-missing error response', async () => { /*...*/ })

  // Regression — URL branch unchanged
  it('returns 200 for mode: "url" with no behavioral change vs. pre-Phase-66', async () => { /*...*/ })
})
```

#### E3. URL-branch test fixture (DO NOT MODIFY — it is the zero-regression contract)

Source: `tests/api/extract-watch.test.ts:51-269` — every existing `it()` block stays green AS-IS. If the planner needs to change a single existing assertion (e.g., to add `mode: 'url'` to a response shape), THAT is the regression signal — discuss before changing.

---

## Shared Patterns

### Authentication gate (apply to: `route.ts` only — single auth surface in this phase)

**Source:** `src/app/api/extract-watch/route.ts:80-90`. See §C1 above. Pattern: `try { await getCurrentUser() } catch (err) { if (err instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); throw err }`. Runs BEFORE any body parsing (AUTH-04 / D-14).

### Error handling — 5-category taxonomy (apply to: `route.ts`, indirectly to `llm-structured.ts`)

**Source:** `src/app/api/extract-watch/route.ts:21-78` (category enum + copy + categorizer) and `:245-310` (catch + dispatch). The structured branch's `llm-structured.ts` does NOT classify errors itself — it throws raw `Error` / lets SDK errors propagate; the route's `categorizeExtractionError` does the mapping. This preserves D-05 (reuse 5-category enum) automatically: AbortError → `LLM-timeout`, `.status === 429` → `quota-exceeded`, fallthrough → `generic-network`.

**Required addition this phase:** `mode: 'url' | 'structured'` field in every JSON response body (success AND error).

### Sanitized error response posture (apply to: `route.ts`)

**Source:** `src/app/api/extract-watch/route.ts:250` (`console.error('Extraction error:', error)`) + `:260, :276, :285, :294, :303` (response error always sourced from `CATEGORY_COPY[category]`, never `err.message`). Pinned by `tests/api/extract-watch.test.ts:250-267` — response body must never contain `/anthropic/i`, `/claude/i`, stack traces, or filesystem paths. The structured branch inherits this for free because all errors funnel through the existing catch.

### Anthropic strict tool-use (apply to: `llm-structured.ts` only)

**Source:** Combination of `src/lib/taste/enricher.ts:33-61` (Tool definition with `satisfies Anthropic.Messages.Tool`) and `src/lib/taste/webSearch.ts:165-179` (forced-tool `messages.create` + ToolUseBlock find). Already documented in §A1-A3. Mandatory pattern: `find((c): c is Anthropic.Messages.ToolUseBlock => c.type === 'tool_use')` — never index by position.

### Catalog upsert + observability envelope (apply to: `route.ts`)

**Source:** `src/app/api/extract-watch/route.ts:139-183`. The `let catalogId: string | null = null; let catalogIdError: string | null = null; try { ... } catch (err) { catalogIdError = err instanceof Error ? \`catalog upsert threw: \${err.message.slice(0, 200)}\` : 'catalog upsert threw' }` shape is reused for the structured branch with the DAL function swapped to `upsertCatalogFromUserInput`. Per Phase 20.1 UAT gap 1, both fields must be in the response.

### `revalidateTag` two-arg form (apply to: `route.ts`)

**Source:** `src/app/api/extract-watch/route.ts:230` — `revalidateTag('explore', 'max')`. Exact verbatim signature. Fires whenever `catalogId` is truthy (Pitfall 4 — second arg is required).

### Zod safeParse + first-issue user message (apply to: `route.ts`)

**Source — Server-Action pattern with `.strict()`:** `src/app/actions/verdict.ts:35-50`:

```typescript
const verdictSchema = z.object({ catalogId: z.string().uuid() }).strict()

export async function getVerdictForCatalogWatch(data: unknown): Promise<ActionResult<VerdictBundle>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = verdictSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }
  // ... parsed.data is type-narrowed
}
```

**Adapt for route (not Server Action):** return `NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 })`. Use `.issues` not `.errors` (Pitfall 2 — Zod v4).

### TypeScript type-narrowing on discriminated union (apply to: `route.ts`)

After `const body = parsed.data` where `parsed.data: { mode: 'url'; url: string } | { mode: 'structured'; brand: string; model: string; reference?: string; year?: number }`, a `switch (body.mode)` block narrows each case automatically. No casts needed.

---

## No Analog Found

All five files have strong analogs (4 self-analogs + 1 with two combined sources). The `llm-structured.ts` module is the only true greenfield file, and even there the combination of `enricher.ts` (strict tool-use shape) + `llm.ts` (client init + validateAndCleanData reuse) covers the full code surface — no RESEARCH-only fallback needed.

## Metadata

**Analog search scope:**
- `src/lib/extractors/` (full directory)
- `src/lib/taste/` (full directory — primary tool-use reference)
- `src/app/api/extract-watch/route.ts`
- `src/app/actions/verdict.ts` (Server-Action Zod pattern)
- `src/data/catalog.ts:120-244` (DAL signature contrasts)
- `tests/extractors/` (test mocking analog)
- `tests/api/extract-watch.test.ts` (regression contract)

**Files scanned:** ~12 source files + 3 test files + 1 type file
**Pattern extraction date:** 2026-05-28

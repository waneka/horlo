# Phase 66: API Route Extension - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `POST /api/extract-watch` to accept a discriminated body `{ mode: 'url', url } | { mode: 'structured', brand, model, reference?, year? }`. The structured branch:

1. Validates the body and short-circuits BEFORE any cheerio / HTML-scraping stage (Pitfall 3 mitigation, EXTR-02).
2. Calls a new LLM prompt variant ("given watch identity, infer known specs from training knowledge") via strict tool-use against `claude-sonnet-4-6`.
3. Upserts a catalog row via `upsertCatalogFromUserInput` (CAT-06 / ON CONFLICT DO NOTHING) — NOT `upsertCatalogFromExtractedUrl` (EXTR-08, Pitfall 5 mitigation).
4. Runs the same Phase 19.1 taste-enrichment second-pass + `revalidateTag('explore', 'max')` chain the URL branch already uses, then returns an `ExtractedWatchData` shape consistent with the URL branch (EXTR-03).

The URL branch (today's behavior, including the 5-category error taxonomy, auth gate, SSRF check, post-extract `structured-data-missing` gate, catalog upsert via `upsertCatalogFromExtractedUrl`, taste enrichment, and `revalidateTag`) is preserved with **zero regression** — verified by an integration test that the pre-v8.0 URL contract continues to behave identically.

Requirements delivered:
- **EXTR-01** — discriminated body
- **EXTR-02** — structured short-circuit before cheerio (test-enforced)
- **EXTR-03** — brand + model required; consistent `ExtractedWatchData` response
- **EXTR-04** — new LLM prompt variant via Anthropic SDK strict tool-use, model `claude-sonnet-4-6`
- **EXTR-08** — structured-branch catalog upsert uses `upsertCatalogFromUserInput` (integration test asserts distinction)

**Not this phase:** UI changes, Server Action surface (CONF-11 + DAL helpers land in Phase 67), the `<ExtractErrorCard>` consumer (Phase 69 wires copy + mode), photo upload affordance (EXTR-06 lives in Phase 69's structured-input panel), and any change to the URL branch beyond shared dispatch wiring.

</domain>

<decisions>
## Implementation Decisions

### LLM prompt — file location & tool-use scope
- **D-01:** **New file `src/lib/extractors/llm-structured.ts`** as a sibling of `llm.ts`. The URL-extraction module is not touched. New file owns its own prompt + tool-use plumbing in isolation; researcher can study the Anthropic SDK tool-use shape without coupling to the URL pipeline. Matches the existing `extractors/` split by source type (`html.ts`, `structured.ts`, `llm.ts`). **Naming caveat for planner:** `structured.ts` already exists in `extractors/` and refers to **structured *data*** (JSON-LD scraped from pages). `llm-structured.ts` refers to **structured *input*** (user-supplied identity). Different concepts; document the disambiguation in the file header to prevent confusion.
- **D-02:** **Strict tool-use is structured-only.** The URL path stays on plain `messages.create` + greedy `{…}` regex match + `JSON.parse` (today's behavior). Migrating the URL path to tool-use is its own work with its own regression surface (URL extraction is the user-facing critical path with a battle-tested 5-category error taxonomy) — keep this phase tight. URL-path tool-use migration logged in Deferred Ideas.

### Structured-branch parity — enrichment & revalidate
- **D-03:** **Full parity with the URL branch.** After the structured branch upserts via `upsertCatalogFromUserInput`, run the same chain the URL branch runs today: `enrichTasteAttributes({ source: 'structured-input', spec: {...}, photoSourcePath: null })` → `updateCatalogTaste(catalogId, taste)` → `revalidateTag('explore', 'max')`. Rationale: LLM-inferred specs are still meaningful input for the taste pass — brand + model + ref is exactly what Phase 19.1 enrichment was designed to read; Browse/Archetype counts stay consistent regardless of entry mode. **`source` discriminant:** add `'structured-input'` as a new value alongside the existing `'url-extract'` so enrichment telemetry can distinguish entry modes — coordinate with `enrichTasteAttributes` signature if it constrains `source` to a union.
- **D-04:** **`revalidateTag('explore', 'max')` always fires when a structured-mode catalog row is upserted**, regardless of whether enrichment succeeded. Mirrors URL branch behavior. Browse/Archetype caches are keyed on catalog row presence, not taste signal completeness.

### Error categories on structured branch
- **D-05:** **Reuse the existing 5-category enum as-is.** `host-403`, `SsrfError` simply never fire for structured (no URL fetch). `LLM-timeout`, `quota-exceeded`, `structured-data-missing`, `generic-network` all still apply with their existing detection logic. Zero new public surface; `<ExtractErrorCard>` (Phase 25 D-15) keeps a single contract. `structured-data-missing` is reused for the case where the LLM tool-use returned no usable brand AND no usable model (mirrors the URL branch's post-extract gate at the same severity).
- **D-06:** **Branch the `structured-data-missing` user-facing copy by mode.** The current LOCKED D-15 copy (`"Couldn't find watch info on this page. Try the original product page or enter manually."`) reads wrong for structured input — there is no "page". Add a structured-mode variant (planner to draft; e.g. `"Couldn't find specs for that watch. Try adding a reference number, or enter manually."`). **Coordination point with Phase 69:** `<ExtractErrorCard>` must thread the request `mode` through to copy selection — either by exposing `mode` in the response payload alongside `category`, or by the client tracking which mode it just dispatched. Recommend the response carry `mode` for the consumer (single source of truth, survives client-state loss). This unlocks one row of the D-15 copy table; document the new copy in PLAN and coordinate with the Phase 69 ExtractErrorCard owner.

### Body validation
- **D-07:** **Zod with `z.discriminatedUnion('mode', [...])` for the request body.** Matches EXTR-01 shape declaratively (brand/model required, reference?/year? optional, mode discriminant typed). Zod 4.3.6 is already in `package.json` and used by 5 Server Actions in `src/app/actions/` — adopting it in the API-route layer for the first time is consistent with the codebase direction (CONF-11 adds Zod to `addWatch` in Phase 67). Cleaner 400-response messages than ad-hoc guards. **Zod 4 caveat for researcher:** discriminated-union API differs subtly from Zod 3 — confirm the v4 syntax (`.discriminatedUnion('mode', [urlSchema, structuredSchema])`) and error-message shape.
- **D-08:** **Schema colocated in `route.ts`** at the top of the file. Single consumer (the route handler). Don't speculate on hoisting it to a shared module — if Phase 70 client code wants pre-POST validation, hoist it then. Avoids premature abstraction.

### Claude's Discretion
- **Body parse + auth ordering:** preserve today's order — `getCurrentUser()` runs FIRST (AUTH-04 / D-14), then `request.json()`, then Zod parse + mode dispatch. Do not invert.
- **Dispatch shape inside the route:** planner picks — a `switch (body.mode)` inside `POST` is fine; extracting the structured branch into a private helper (`handleStructuredExtraction(body)`) is also fine if the function grows large.
- **`ExtractedWatchData` field coverage from structured-mode LLM:** the prompt should request the same field set as today's URL prompt (`brand`, `model`, `reference`, `movement`, `complications`, `isChronometer`, `caseSizeMm`, `lugToLugMm`, `waterResistanceM`, `strapType`, `crystalType`, `dialColor`, `styleTags`, `designTraits`, `marketPrice`), but the planner may decide which fields to mark required-in-tool-schema vs optional — recommend all optional except `brand`/`model`/`reference` (when supplied as input, the LLM should echo + normalize; when omitted, the LLM may infer or leave blank).
- **Tool-use temperature / max_tokens:** match today's URL prompt (`max_tokens: 1024`, default temperature). Tool-use does not require a different value.
- **Empty-output gate for structured mode:** mirror today's URL post-extract gate — when both `brand` AND `model` come back empty (or whitespace-only), emit `structured-data-missing` with HTTP 422.

### Folded Todos
None — no pending todos matched Phase 66 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 66: API Route Extension" — phase goal, depends-on (none), 5 success criteria
- `.planning/REQUIREMENTS.md` §"Structured-Input Extraction (EXTR)" — EXTR-01..04, EXTR-08 full text + the v2 / Out-of-Scope rationale
- `.planning/seeds/SEED-010-v5.3-add-watch-redesign.md` — milestone rationale (URL → search-first pivot, why structured-input matters)

### Existing route & extraction modules being extended
- `src/app/api/extract-watch/route.ts` — the route being extended; today's URL-only behavior is the regression baseline
- `src/lib/extractors/index.ts` — `fetchAndExtract` orchestrator (URL pipeline only; structured branch must NOT enter)
- `src/lib/extractors/llm.ts` — existing URL-extraction LLM call (text completion + regex match); reference for prompt shape + Anthropic client init pattern (model `claude-sonnet-4-6`, `max_tokens: 1024`)
- `src/lib/extractors/types.ts` — `ExtractedWatchData` shape (EXTR-03 response consistency)
- `src/lib/extractors/structured.ts` — **NAMING WARNING:** this is "structured *data*" (JSON-LD), NOT to be confused with the new "structured *input*" path. Do not put the new prompt here.

### Catalog + enrichment helpers reused by structured branch
- `src/data/catalog.ts` — `upsertCatalogFromUserInput` (CAT-06, EXTR-08 target), `upsertCatalogFromExtractedUrl` (CAT-07, URL branch only — DO NOT call from structured branch), `updateCatalogTaste`
- `src/lib/taste/enricher.ts` — `enrichTasteAttributes` (Phase 19.1); structured branch passes `photoSourcePath: null` and a new `source: 'structured-input'` value (or whatever the function's union allows)

### Auth + error contract
- `src/lib/auth.ts` — `getCurrentUser`, `UnauthorizedError` (AUTH-04 / D-14 gate)
- `src/lib/ssrf.ts` — `SsrfError` (URL branch only; structured branch never throws this)
- `src/app/api/extract-watch/route.ts:35-86` — LOCKED D-15 `CATEGORY_COPY` table + `CATEGORY_HTTP_STATUS` map; D-06 unlocks ONE row (`structured-data-missing`) for mode-branched copy
- Phase 25 D-11..D-15 (in `src/app/api/extract-watch/route.ts` JSDoc header) — the 5-category error taxonomy contract; `<ExtractErrorCard>` consumer in `src/components/watch/`

### Anthropic SDK reference
- `node_modules/@anthropic-ai/sdk` v0.88.0 — strict tool-use API: `messages.create({ tools: [...], tool_choice: { type: 'tool', name: '...' } })`. Researcher should fetch current Anthropic tool-use docs to confirm input_schema shape + tool_choice forcing behavior.

### Coordination points (NOT in this phase, but Phase 66 decisions affect)
- Phase 67 — `addWatch` Zod schema gains optional `catalogId` (CONF-11); shared Zod direction
- Phase 69 — `<ExtractErrorCard>` must consume new `mode` field in error response for D-06 copy branching

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`getCurrentUser()` + `UnauthorizedError`** (`src/lib/auth.ts`) — auth gate runs FIRST per AUTH-04 / D-14; identical pattern for structured branch
- **`upsertCatalogFromUserInput`** (`src/data/catalog.ts:138`) — CAT-06; already called by `addWatch` (`src/app/actions/watches.ts:128`) and `addWishlistWatch` (`src/app/actions/wishlist.ts:138`). Structured branch is the third caller. ON CONFLICT DO NOTHING semantics already proven.
- **`enrichTasteAttributes`** (`src/lib/taste/enricher.ts`) — Phase 19.1 text-only enrichment path (`photoSourcePath: null`); already invoked from URL branch (`src/app/api/extract-watch/route.ts:200`)
- **`updateCatalogTaste`** (`src/data/catalog.ts`) — pairs with `enrichTasteAttributes`; same callsite pattern as URL branch
- **`revalidateTag('explore', 'max')`** — Phase 46 CR-01 cache bust; same callsite pattern as URL branch (`route.ts:230`) and `addWatch` action
- **`Anthropic` client init pattern** — `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` with key-presence throw (see `llm.ts:54-57`); reuse in `llm-structured.ts`
- **`validateAndCleanData`** (or its equivalent in `llm.ts`) — output normalization for `ExtractedWatchData`; reuse if shape-compatible, or extract a shared helper if the structured tool-use output already maps 1:1

### Established Patterns
- **Auth-first gate** (Phase 25 / AUTH-04 / D-14) — `try { await getCurrentUser() } catch (UnauthorizedError) { return 401 }` runs BEFORE body parsing. Preserve in extended route.
- **5-category error taxonomy** (Phase 25 D-11..D-15) — `host-403`, `structured-data-missing`, `LLM-timeout`, `quota-exceeded`, `generic-network` with LOCKED user-facing copy. D-05 reuses as-is; D-06 unlocks one row for mode-branched copy.
- **HTTP status mapping per category** — `CATEGORY_HTTP_STATUS` map (`route.ts:46-52`); reuse for structured-branch error responses (422 for `structured-data-missing`, 504 for `LLM-timeout`, 503 for `quota-exceeded`, 500 for `generic-network`).
- **Sanitized error responses** (T-25-04-01) — `error` field always sourced from `CATEGORY_COPY[category]`, never from `err.message` / stack / String(err). Server-side `console.error` carries full detail; client never sees it. Preserve in structured branch.
- **Catalog-upsert error observability** — `catalogId` + `catalogIdError` fields in response (Phase 20.1 UAT gap 1, `route.ts:139-178`). Mirror in structured branch response.
- **Discriminated-input parsing via Zod** in Server Actions (`src/app/actions/verdict.ts:3`, `comments.ts:4`, `wearEvents.ts:4`, `notifications.ts:4`, `wishlist.ts:4`) — pattern is `const schema = z.object({...}); const parsed = schema.parse(input)`. Discriminated union is new but Zod is not.

### Integration Points
- **Phase 67 consumes Phase 66's response** — `searchCatalogForAddFlow` (Server Action) lives in Phase 67; not consumed by Phase 66. But Phase 67's `addWatch` extension (`catalogId` optional, CONF-11) reads `catalogId` from this route's response. Response shape must include `catalogId` (already does for URL branch — structured branch mirrors).
- **Phase 69 consumes the error contract** — `<ExtractErrorCard>` reads `category` + (new) `mode` to pick copy. D-06 coordination.
- **Phase 70 will dispatch this route from `AddWatchFlow`** — `mode: 'structured'` from the structured-input panel, `mode: 'url'` from the URL-backup affordance. State machine consumer; no change needed in Phase 66 beyond response stability.

</code_context>

<specifics>
## Specific Ideas

- **`source: 'structured-input'`** discriminant added to `enrichTasteAttributes` callsite (parallel to the existing `'url-extract'` value). If the function's `source` parameter is a typed union, planner needs to extend it; if it's a free-text string, no signature change required.
- **Anthropic tool-use shape** — name the tool something like `extract_watch_from_identity` and force it via `tool_choice: { type: 'tool', name: 'extract_watch_from_identity' }`. Input schema mirrors `ExtractedWatchData` field set. Tool input is the LLM's response — no regex JSON match needed (this is the core EXTR-04 win).
- **Naming disambiguation in `extractors/`** — when planner creates `llm-structured.ts`, the file header should explicitly call out: "This is the LLM call for STRUCTURED INPUT (user-supplied brand/model identity). It is NOT related to `structured.ts` in this directory (which extracts STRUCTURED DATA — JSON-LD — from scraped HTML)."
- **Integration test pinning EXTR-02 + EXTR-08** — test must (a) spy/assert no `cheerio` call when `mode: 'structured'`, (b) assert `upsertCatalogFromUserInput` is called and `upsertCatalogFromExtractedUrl` is NOT, on a known catalog row. These two test assertions are the success-criteria backbone of the phase.

</specifics>

<deferred>
## Deferred Ideas

- **URL path migration to strict tool-use** — D-02 chose structured-only for this phase. Worth doing later as a focused refactor with its own regression test pass (the URL path's regex-JSON parsing is the highest-leverage place where strict tool-use would eliminate a failure mode). Future phase candidate; not in v8.0 unless a defect forces it.
- **Hoist Zod schema to shared module** (`src/lib/extractors/request-schema.ts`) — D-08 chose colocated. Revisit if Phase 70 client-side code wants pre-POST validation or if a second route handler needs the schema.
- **Structured-mode-specific error categories** (e.g. `structured-llm-low-confidence`, `structured-invalid-input`) — D-05 chose reuse. Revisit only if production behavior shows the 5-category enum is too coarse for structured failures.
- **`<ExtractErrorCard>` mode-aware copy** — D-06 is a Phase 69 coordination item; Phase 66 carries the `mode` through the response, Phase 69 implements the copy branch. Document in CONTEXT for Phase 69 to pick up.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 66 scope.

</deferred>

---

*Phase: 66-api-route-extension*
*Context gathered: 2026-05-28*

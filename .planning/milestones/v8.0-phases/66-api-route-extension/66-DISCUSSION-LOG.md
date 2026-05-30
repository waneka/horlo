# Phase 66: API Route Extension - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 66-api-route-extension
**Areas discussed:** LLM prompt — location & tool-use scope, Structured-branch parity — enrichment & revalidate, Error categories on structured branch, Validation library

---

## LLM prompt — location & tool-use scope

### Q1: Where should the structured-mode prompt + Anthropic call live?

| Option | Description | Selected |
|--------|-------------|----------|
| New file: `extractors/llm-structured.ts` | Sibling of `llm.ts`. Keeps URL-extraction path completely untouched (zero regression risk). New file owns its own prompt + tool-use plumbing. Researcher can study tool-use shape in isolation. Matches how `extractors/` already splits by source type (`html.ts`, `structured.ts`, `llm.ts`). | ✓ |
| Extend `llm.ts` with a 2nd exported function | Both prompts colocated; shared module setup (Anthropic client init). Smaller diff but couples the two paths — future changes to one have to think about the other. | |
| Refactor `llm.ts` to a shared prompt-builder | Introduce a build/call abstraction both modes share. Highest leverage long-term, biggest scope now. Likely overkill for two callers. | |

**User's choice:** New file: `extractors/llm-structured.ts`
**Notes:** Captured as **D-01**. Naming caveat surfaced after the fact: `structured.ts` already exists in this directory and means STRUCTURED DATA (JSON-LD). The new file means STRUCTURED INPUT (user-supplied identity). File header must disambiguate.

### Q2: EXTR-04 says "strict tool-use" for the new prompt — do we retrofit the URL path too?

| Option | Description | Selected |
|--------|-------------|----------|
| Structured-only — leave URL on text-completion | URL path is battle-tested (5-category error taxonomy, JSON-regex fallback path). Tool-use migration there is its own work — measurable behavior change, separate testing surface. Keep this phase tight. URL path stays on plain `messages.create` + regex match. | ✓ |
| Bundle URL path migration too | Both paths on strict tool-use end-state. Cleaner future, but adds regression risk to a critical user-facing path mid-milestone. Larger Phase 66 footprint. | |
| You decide | Defer to researcher's reading of the SDK + URL path behavior. | |

**User's choice:** Structured-only — leave URL on text-completion
**Notes:** Captured as **D-02**. URL-path tool-use migration logged in Deferred Ideas as a future focused refactor.

---

## Structured-branch parity — enrichment & revalidate

### Q1: Should the structured branch mirror the URL branch's taste-enrichment + cache revalidation chain after the catalog upsert?

| Option | Description | Selected |
|--------|-------------|----------|
| Full parity — mirror URL branch | After `upsertCatalogFromUserInput`: run `enrichTasteAttributes` (text-only, `photoSourcePath: null`), then `updateCatalogTaste`, then `revalidateTag('explore', 'max')`. Browse/Archetype counts stay consistent regardless of entry mode. LLM-inferred specs are still meaningful input for the taste pass — brand+model+ref alone is what enrichment was designed to read. | ✓ |
| Skip enrichment in structured branch | Structured input is thinner than URL extraction — enrichment may be wasteful or wrong. Browse counts can still be busted via `revalidateTag` alone. Risk: catalog row created without taste signals, may not surface in /explore until a follower path triggers enrichment. | |
| Photo-pivot — only enrich when EXTR-06 photo is uploaded | Defer enrichment to the photo-upload path (Phase 19.1 photo-based enrichment already exists). Two callsites need to converge on the same enrichment helper. Higher coupling between Phase 66 and Phase 69 (CatalogPhotoUploader). | |

**User's choice:** Full parity — mirror URL branch
**Notes:** Captured as **D-03**. New discriminant value `'structured-input'` recommended for `enrichTasteAttributes` `source` parameter, parallel to the existing `'url-extract'`.

### Q2: Should we bust `revalidateTag('explore', 'max')` whenever a structured-mode catalog row is upserted (even if enrichment is skipped)?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — always bust on new catalog row | Browse counts come from cached `cacheTag('explore', ...)` DALs. Any new catalog row should bust the tag, regardless of enrichment outcome. Mirrors URL branch behavior. | ✓ |
| Only bust when enrichment ran | Tag bust gated on enrichment success. Couples the two concerns — less correct for browse counts. | |
| You decide | Defer to planner based on cache key reads. | |

**User's choice:** Yes — always bust on new catalog row
**Notes:** Captured as **D-04**. (D-03 picks full parity, so enrichment also runs, but D-04 establishes the invariant independently.)

---

## Error categories on structured branch

### Q1: How should the structured branch handle error categorization?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the 5-category enum as-is | `host-403` and `SsrfError` simply never fire for structured (no URL fetch). `LLM-timeout` / `quota-exceeded` / `structured-data-missing` / `generic-network` all still apply. `<ExtractErrorCard>` consumer (Phase 25 D-15) keeps a single contract. Zero new public surface. `structured-data-missing` reused with subtly extended meaning (LLM returned nothing usable). | ✓ |
| Subset to 3 (`LLM-timeout`, `quota-exceeded`, `structured-data-missing`) | Cleaner mental model — only emit categories that can actually fire. But forces a per-mode discriminant in the response shape, and `<ExtractErrorCard>` needs to know which categories are URL-only vs structured-only. Larger consumer surface change. | |
| Add 1–2 new structured-specific categories | e.g., `structured-llm-low-confidence` for cases where the LLM returned data but it's clearly hallucinated. Coordinate copy lock with D-15. Adds public surface for a behavior we haven't measured yet. | |

**User's choice:** Reuse the 5-category enum as-is
**Notes:** Captured as **D-05**. Structured-mode-specific categories logged in Deferred Ideas — revisit only if production shows the 5-category enum is too coarse.

### Q2: What should `structured-data-missing` mean when fired from the structured branch?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing copy verbatim | `"Couldn't find watch info on this page. Try the original product page or enter manually."` — the copy says "page" but the user-facing intent ("we couldn't extract usable data, fall back") translates. Risk: "on this page" is misleading for structured mode. Acceptable tradeoff to keep D-15 lock intact. | |
| Branch the copy by mode — add a structured-only string | e.g., `"Couldn't find specs for that watch. Try adding a reference number, or enter manually."` — better UX, but unlocks D-15 copy table. Requires `<ExtractErrorCard>` to thread the mode through to copy selection. | ✓ |
| You decide | Defer to planner / Phase 69 ExtractErrorCard owner. | |

**User's choice:** Branch the copy by mode — add a structured-only string
**Notes:** Captured as **D-06**. Coordination point with Phase 69: `<ExtractErrorCard>` must consume the new `mode` field in the error response. Recommendation: response payload carries `mode` alongside `category` (single source of truth for the client, survives state loss).

---

## Validation library

### Q1: How should we validate the discriminated request body?

| Option | Description | Selected |
|--------|-------------|----------|
| Zod with `z.discriminatedUnion('mode', [...])` | `z.discriminatedUnion('mode', [...])` matches the EXTR-01 shape exactly. Brand/model required + reference?/year? optional handled declaratively. Aligns with CONF-11 (Phase 67 adds `addWatch` Zod schema). Pulls Zod into the API route layer for the first time — small dependency footprint (Zod is already shipped). Cleaner 400-response messages. | ✓ |
| Inline type guards — match today's route style | Today's URL branch uses `if (!url || typeof url !== 'string')`. Extend with mode dispatch + per-mode guards. No new dependency surface, zero abstraction. Verbose for a discriminated union, but cohesive with the existing route. | |
| Hand-rolled mini-validator helper local to the file | Small typed parse helper in the route file. Middle ground — no library dep, less verbose than inline guards, but reinvents Zod poorly. | |

**User's choice:** Zod with `z.discriminatedUnion('mode', [...])`
**Notes:** Captured as **D-07**. Verified post-hoc: Zod 4.3.6 is already in `package.json` and used by 5 Server Actions in `src/app/actions/`. Adopting it in the route layer is consistent with the codebase direction. Zod 4 caveat: discriminated-union API differs from Zod 3; researcher should confirm v4 syntax.

### Q2: If we adopt Zod here, where does the schema live?

| Option | Description | Selected |
|--------|-------------|----------|
| Colocated in `route.ts` | Single consumer (route handler). Schema sits at top of file with the type. If Phase 70 client code wants to validate before POST, export it from `route.ts` or hoist later — don't speculate now. | ✓ |
| Shared schema file: `src/lib/extractors/request-schema.ts` | Importable by client-side code if Phase 70 wants pre-POST validation. Speculative — no consumer asked for it. Hoists abstraction before need. | |
| N/A — we picked inline guards | Skip this question if Zod isn't being adopted. | |

**User's choice:** Colocated in `route.ts`
**Notes:** Captured as **D-08**. Hoisting to shared module logged in Deferred Ideas — revisit if a second consumer materializes.

---

## Claude's Discretion

Areas where the user deferred to planner / researcher (captured in CONTEXT.md `<decisions>` → "Claude's Discretion"):

- Body parse + auth ordering (preserve today's order: auth → json → Zod parse → mode dispatch)
- Dispatch shape inside the route (switch vs private helper — planner decides based on size)
- `ExtractedWatchData` field coverage from structured-mode LLM (which fields are required vs optional in the tool schema)
- Tool-use temperature / max_tokens (recommend match URL path — `max_tokens: 1024`)
- Empty-output gate behavior for structured mode (mirror URL post-extract gate — both brand AND model empty → `structured-data-missing` HTTP 422)

## Deferred Ideas

- URL path migration to strict tool-use (D-02 scoped this phase to structured-only; URL-path migration is a future focused refactor)
- Hoist Zod schema to shared module `src/lib/extractors/request-schema.ts` (D-08 chose colocated; revisit if a second consumer appears)
- Structured-mode-specific error categories like `structured-llm-low-confidence` (D-05 chose reuse; revisit if production behavior shows the 5-category enum is too coarse)
- `<ExtractErrorCard>` mode-aware copy implementation (D-06 is a Phase 69 coordination item; Phase 66 carries the `mode` through the response, Phase 69 implements the copy branch)

---
status: resolved
phase: 66-api-route-extension
source: [66-VERIFICATION.md]
started: 2026-05-28T16:00:00Z
updated: 2026-05-28T17:30:00Z
---

## Current Test

[complete — all 3 smoke tests run against local dev server with live Anthropic API]

## Tests

### 1. Real-API smoke test: known watch (Rolex 116610LN)

POST `{ mode: 'structured', brand: 'Rolex', model: 'Submariner', reference: '116610LN' }`.

expected: 200 + `mode='structured'` + `source='llm'` + `confidence='medium'` + `catalogId` non-null + plausible inferred specs.
result: **PASS** — HTTP 200, `success: true`, `mode: 'structured'`, `source: 'llm'`, `confidence: 'medium'`, `catalogId: 3f964d81-0c76-4c9a-b719-82ecc800d927`, `catalogIdError: null`, 15 fields extracted. LLM correctly inferred `caseSizeMm: 40`, `waterResistanceM: 300`, `movement: 'auto'`, `dialColor: 'black'`, `styleTags: [diver, sport, tool]`, `marketPrice: 14000`. Brand/model/reference echoed correctly.

### 2. Real-API smoke test: unknown identity (empty-output gate)

POST `{ mode: 'structured', brand: 'XYZ_NotAWatchBrand', model: 'Imaginary' }`.

expected: Either HTTP 422 `structured-data-missing` OR 200 with sparse data, no hallucinated specs.
result: **PASS** — HTTP 200, `mode: 'structured'`, `data: { brand: 'XYZ_NotAWatchBrand', model: 'Imaginary' }` only, `fieldsExtracted: ['brand', 'model']` (only 2 fields, no hallucination). Path (b) from the UAT spec — LLM correctly refused to invent specs for an unknown brand.

### 3. Prod regression check: URL branch

POST `{ mode: 'url', url: 'https://www.omegawatches.com/...speedmaster...' }`.

expected: 200 with pre-v8.0 URL-extraction behavior + new additive `mode: 'url'` field.
result: **PASS** — HTTP 200, `success: true`, `mode: 'url'` (additive), `source: 'merged'` (existing value), `confidence: 'high'`, 16 fields extracted, `imageUrl` populated, `llmUsed: true`. Zero behavioral regression on URL branch.

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### Pre-existing local DB drift (NOT a Phase 66 regression — resolved en route)

Initial UAT run surfaced that ALL three tests (both URL and structured branches) returned `catalogId: null` with the same DB error: `catalog upsert threw: ... ON CONFLICT ON CONSTRAINT watches_catalog_natural_key`. Investigation showed:

- Local `watches_catalog` table was missing the `watches_catalog_natural_key` UNIQUE CONSTRAINT (only `watches_catalog_pkey` present).
- The `brand_normalized` / `model_normalized` / `reference_normalized` columns DID exist, so the issue was lost-constraint, not missing-migration.
- 6 orphan `(Brand-54, Model-54, NULL)` rows from May 22 (v6.0 Phase 54 test fixtures, zero `watches.catalog_id` references) were blocking constraint re-creation.

**Fix applied locally:** Deleted 5 of 6 dupes (kept oldest), re-ran the migration's section 3 (CREATE UNIQUE INDEX … NULLS NOT DISTINCT → ALTER TABLE … ADD CONSTRAINT … USING INDEX). All 3 UAT tests re-passed cleanly.

**Production unaffected:** the prod DB has the constraint intact (per migration history); this drift is a local-only artifact of `project_local_db_reset.md` — Drizzle push doesn't recreate Supabase-migration-added constraints.

### Code review findings observed in the wild (REVIEW MR-01)

The pre-fix runs surfaced REVIEW MR-01 — `catalogIdError` echoes a sliced SQL error message back to the client, including the raw query text and constraint name. Confirmed in production-shaped behavior. Not blocking Phase 66 acceptance (pre-existing Phase 20.1 pattern, duplicated into the structured branch verbatim), but worth a follow-up via `/gsd-code-review 66 --fix` together with HR-01 (null `toolUse.input` cast).

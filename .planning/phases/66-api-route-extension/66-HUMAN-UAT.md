---
status: partial
phase: 66-api-route-extension
source: [66-VERIFICATION.md]
started: 2026-05-28T16:00:00Z
updated: 2026-05-28T16:00:00Z
---

## Current Test

[awaiting human testing — three real-Anthropic smoke tests on production deploy]

## Tests

### 1. Real-API smoke test: known watch (Rolex 116610LN)

POST `{ mode: 'structured', brand: 'Rolex', model: 'Submariner', reference: '116610LN' }` to deployed `/api/extract-watch` with live `ANTHROPIC_API_KEY`.

expected: 200 response with `body.success=true`, `body.mode='structured'`, `body.source='llm'`, `body.confidence='medium'`, `body.catalogId` non-null, `body.data.brand='Rolex'`, `body.data.model='Submariner'`, `body.data.reference='116610LN'`, plus plausibly inferred specs (`caseSizeMm` ~40, `movement` 'auto', `dialColor` 'black', `waterResistanceM` 300, etc.). Server stderr free of stack traces.
result: [pending]

### 2. Real-API smoke test: unknown identity (empty-output gate)

POST `{ mode: 'structured', brand: 'XYZ_NotAWatchBrand', model: 'Imaginary' }` to deployed route.

expected: Either (a) HTTP 422 with `body.category='structured-data-missing'` + `body.mode='structured'` + `body.error` matching the new structured-mode copy ("Couldn't find specs for that watch…"), OR (b) 200 with `body.data` containing only brand+model echoed and most fields omitted. Server stderr free of stack traces.
result: [pending]

### 3. Prod URL-branch regression (zero-regression contract)

POST `{ mode: 'url', url: 'https://www.omegawatches.com/en-us/watches/speedmaster/speedmaster-moonwatch-professional/31030425001001' }` (or any known-good live product URL) on deployed route.

expected: Existing pre-v8.0 URL-extraction behavior unchanged — 200 with `body.success=true`, `body.mode='url'` (new additive field), `body.data` populated, `body.catalogId` non-null, `body.source` ∈ {`'structured-data'`, `'llm'`}, `fieldsExtracted` array, `body.llmUsed` boolean.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

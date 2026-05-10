---
status: partial
phase: 35-layer-b-lineage-edges-structured-movement-era-material
source:
  - 35-VERIFICATION.md
started: 2026-05-10
updated: 2026-05-10
---

## Current Test

[awaiting human testing once prod catalog grows]

## Tests

### 1. Cycle trigger runtime validation
expected: After at least 2 lineage edges exist in `watch_lineage_edges`, an INSERT that completes a cycle (e.g., A→B + B→C exist; INSERT C→A) raises `Lineage cycle detected: <C-uuid> -> <A-uuid>` and aborts the INSERT.
result: [pending — anchor edges deferred per DEV-35-07-02 Option A]

### 2. G6 smoke counts after backfill chain
expected: After running `db:backfill-catalog` → `db:backfill-catalog-brands` → `db:backfill-catalog-families` → `db:backfill-catalog-lineage` against a populated prod watches table, the smoke SELECTs return:
- `SELECT count(*) FROM watch_families` returns 10
- `SELECT count(*) FROM watch_lineage_edges` returns 2
- `SELECT pg_typeof(movement_type) FROM watches_catalog WHERE movement_type IS NOT NULL LIMIT 1` returns `movement_type_enum`
- `SELECT pg_typeof(era) FROM watches_catalog WHERE era IS NOT NULL LIMIT 1` returns `watch_era`
result: [pending — backfill chain ran vacuously post-TRUNCATE per DEV-35-07-02 Option A; will exercise once a real watch is added via /watch/new]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

(none — both items are operator follow-ups, not gaps in the phase delivery)

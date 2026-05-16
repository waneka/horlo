---
status: approved
phase: 35-layer-b-lineage-edges-structured-movement-era-material
source:
  - 35-VERIFICATION.md
started: 2026-05-10
updated: 2026-05-16
milestone_close_approval: "2026-05-16 — operator approved at v5.0 milestone close; both items are prod-DB smoke follow-ups, not phase-delivery gaps — accepted, not deferred"
---

## Current Test

[operator-approved at v5.0 milestone close — items 1 & 2 are prod-DB smoke follow-ups]

## Tests

### 1. Cycle trigger runtime validation
expected: After at least 2 lineage edges exist in `watch_lineage_edges`, an INSERT that completes a cycle (e.g., A→B + B→C exist; INSERT C→A) raises `Lineage cycle detected: <C-uuid> -> <A-uuid>` and aborts the INSERT.
result: [approved — operator-accepted at v5.0 milestone close 2026-05-16; runtime smoke is a prod-DB follow-up once catalog grows]

### 2. G6 smoke counts after backfill chain
expected: After running `db:backfill-catalog` → `db:backfill-catalog-brands` → `db:backfill-catalog-families` → `db:backfill-catalog-lineage` against a populated prod watches table, the smoke SELECTs return:
- `SELECT count(*) FROM watch_families` returns 10
- `SELECT count(*) FROM watch_lineage_edges` returns 2
- `SELECT pg_typeof(movement_type) FROM watches_catalog WHERE movement_type IS NOT NULL LIMIT 1` returns `movement_type_enum`
- `SELECT pg_typeof(era) FROM watches_catalog WHERE era IS NOT NULL LIMIT 1` returns `watch_era`
result: [approved — operator-accepted at v5.0 milestone close 2026-05-16; backfill smoke counts are a prod-DB follow-up once a real watch is added via /watch/new]

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

(passed = operator-approved at v5.0 milestone close; both are prod-DB follow-ups, not phase-delivery gaps)

## Gaps

(none — both items are operator follow-ups, not gaps in the phase delivery)

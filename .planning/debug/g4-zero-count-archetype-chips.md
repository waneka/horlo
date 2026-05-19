---
status: diagnosed
trigger: "G4-zero-count-archetype-chips — Two Collector Archetypes chips on /explore show a watch count of 0, violating roadmap success criterion #4 / EXPL-05 (all 10 archetype chips must resolve to at least one catalog watch)."
created: 2026-05-19T04:53:50Z
updated: 2026-05-19T04:58:00Z
---

## Current Focus

hypothesis: CONFIRMED — root cause is a data-coverage gap, with a cross-DB id-divergence amplifier.
test: complete
expecting: complete
next_action: report ROOT CAUSE FOUND to caller; this is diagnose-only mode.

## Symptoms

expected: Every one of the 10 Collector Archetypes chips on /explore shows a count > 0, and navigating to /search?tab=watches&archetype={value} returns at least one watch for each of the 10 primary_archetype values.
actual: The "Genre Crosser" chip (archetype value `hybrid`) and the "Tool Watch Purist" chip (archetype value `tool`) both show a count of 0. The other 8 chips show counts > 0.
errors: None reported.
reproduction: Open /explore, look at the Collector Archetypes chip rail count badges. Test 3 in 46-HUMAN-UAT.md.
started: Discovered during Phase 46 UAT (Test 3). CONTEXT.md decision D-15 assumed Phase 44 verified catalog coverage for all 10 archetypes.

## Eliminated

- hypothesis: getBrowseArchetypeCounts in src/data/browse.ts mis-counts hybrid/tool (Root Cause B — query bug, value-mapping mismatch, WHERE clause exclusion, or label/value confusion).
  evidence: The query is `SELECT primary_archetype AS archetype, COUNT(*)::int AS count FROM watches_catalog WHERE primary_archetype IS NOT NULL GROUP BY primary_archetype ORDER BY count DESC`. It is a plain GROUP BY with no value mapping, no archetype-specific filter, and no label translation. archetype-config.ts correctly maps `hybrid`→"Genre Crosser" and `tool`→"Tool Watch Purist". vocab.ts PRIMARY_ARCHETYPES contains both `tool` and `hybrid`. The query treats all 10 values identically — it cannot single out two of them. The 0 counts are a faithful report of the underlying data.
  timestamp: 2026-05-19T04:56:00Z

## Evidence

- timestamp: 2026-05-19T04:54:00Z
  checked: src/data/browse.ts getBrowseArchetypeCounts
  found: Plain `GROUP BY primary_archetype` with `WHERE primary_archetype IS NOT NULL`. No mapping layer, no per-value logic. Any archetype with zero rows simply does not appear in the result set; the chip rail then shows 0 for it.
  implication: The query is correct. If hybrid/tool show 0, the catalog genuinely has 0 (or near-0) rows for those values. Rules out Root Cause B.

- timestamp: 2026-05-19T04:54:30Z
  checked: src/lib/archetype-config.ts and src/lib/taste/vocab.ts
  found: archetype-config.ts maps `hybrid`→"Genre Crosser", `tool`→"Tool Watch Purist" (confirmed). vocab.ts PRIMARY_ARCHETYPES = [dress, dive, field, pilot, chrono, gmt, racing, sport, tool, hybrid] — both values present, no typo, no label/value confusion.
  implication: Config and vocab are correct. No mismatch between displayed chip and the value passed to the query.

- timestamp: 2026-05-19T04:55:00Z
  checked: supabase/migrations/20260518001506_phase44_taste_data.sql — the SOLE migration that writes primary_archetype data (the two phase19.1 migrations only ADD the column and the CHECK constraint; they set no data).
  found: 101 UPDATE statements, each setting primary_archetype to exactly one literal value. Per-archetype assignment counts: dress 12, dive 43, field 7, pilot 2, chrono 19, gmt 9, racing 1, sport 7, tool 0, hybrid 1. Total = 101 = the exact number of UPDATE statements.
  implication: ROOT CAUSE A confirmed. The Phase 44 taste backfill enriched ZERO catalog watches as `tool` and exactly ONE as `hybrid`. `tool` has no coverage at all. The catalog (~100 seed watches) genuinely lacks tool-archetype watches.

- timestamp: 2026-05-19T04:56:30Z
  checked: scripts/verify-catalog-coverage.ts (the Phase 44 pre-ship gate, reused by Phase 46).
  found: Archetype distribution is checked as a SOFT WARN only — `console.warn` per zero-row archetype, `process.exit(0)`. Comment is explicit: "any archetype in PRIMARY_ARCHETYPES with 0 catalog rows emits a warning but does NOT cause exit 1 (D-16 — a ~100-watch catalog may legitimately lack e.g. a racing watch; expansion is v5.2 scope)."
  implication: CONTEXT.md D-15's assumption that "Phase 44 verified coverage for all 10 archetypes" is false. The verification script was deliberately designed to PASS with zero-coverage archetypes. The gap shipped through a green gate because the gate never enforced coverage. The `tool: 0` (and arguably `racing: 1`, `hybrid: 1`) would have printed as console.warn lines during Phase 44 and been overlooked.

- timestamp: 2026-05-19T04:57:00Z
  checked: keying style of the phase44 taste migration vs the phase44 factual migration; MEMORY.md "Catalog id divergence local/prod".
  found: 20260518001506_phase44_taste_data.sql uses `WHERE id = '<uuid>'` for all 101+ UPDATEs (102 `WHERE id =` clauses, 0 `WHERE brand =` clauses). NO natural-keyed taste migration exists. By contrast, the factual data was re-issued as 20260518191301_phase44_factual_natural_key.sql whose own header states: "the seed inserts watches_catalog rows WITHOUT an id column, so id is gen_random_uuid()-assigned per seed run. Local and prod were seeded separately, so the same 100 watches carry different ids in each DB. The id-keyed migration is a no-op on prod." MEMORY.md records the same trap.
  implication: AMPLIFIER. The single `hybrid` row (local id `00000000-0000-4000-a000-000000000037`) is set only by an id-keyed UPDATE. On the PROD database that row has a different id, so the UPDATE matches nothing and primary_archetype stays NULL. This explains why UAT (run against prod) reports `hybrid` count = 0 even though the local catalog has 1 hybrid row. The taste backfill was never given the natural-key treatment that the factual backfill received. On prod, every primary_archetype value depends on local↔prod id coincidence, so prod archetype coverage is unreliable beyond just hybrid/tool.

## Resolution

root_cause: |
  ROOT CAUSE A — genuine catalog data-coverage gap, not a query bug.

  Two distinct but compounding causes:

  (1) PRIMARY (data coverage): The Phase 44 taste backfill
  (supabase/migrations/20260518001506_phase44_taste_data.sql) assigned
  primary_archetype to its 101 watches with this distribution: dress 12,
  dive 43, field 7, pilot 2, chrono 19, gmt 9, racing 1, sport 7,
  tool 0, hybrid 1. The `tool` archetype was assigned to ZERO catalog
  watches and `hybrid` to only ONE. getBrowseArchetypeCounts faithfully
  reports 0 for any archetype with no rows. CONTEXT.md D-15's assumption
  that Phase 44 "verified coverage for all 10 archetypes" is incorrect:
  scripts/verify-catalog-coverage.ts treats zero-coverage archetypes as a
  SOFT WARNING (console.warn, exit 0) by design (D-16), so the gap passed
  the pre-ship gate.

  (2) AMPLIFIER (cross-DB id divergence): The taste migration is keyed
  entirely by `WHERE id = '<uuid>'`. Per MEMORY.md "Catalog id divergence"
  and the factual migration's own header, the catalog seed omits the id
  column, so local and prod watches_catalog rows have different ids. The
  id-keyed taste UPDATEs are no-ops on prod for any row whose id differs.
  The one local `hybrid` row therefore does not get primary_archetype set
  on prod, so prod shows hybrid count = 0 rather than 1. Unlike the
  factual backfill (which was re-issued as a natural-keyed migration,
  20260518191301_phase44_factual_natural_key.sql), the taste backfill was
  never converted to (brand,model,reference) keying.

fix: ""
verification: ""
files_changed: []

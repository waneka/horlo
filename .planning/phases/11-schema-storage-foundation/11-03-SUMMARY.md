---
phase: 11
plan: 03
subsystem: schema
tags:
  - schema
  - migration
  - pg_trgm
  - search
  - performance
dependency_graph:
  requires:
    - "supabase/migrations/20260419999999_social_tables_create.sql (profiles table)"
    - "supabase/migrations/20260421000000_profile_username_lower_unique.sql (prior profiles migration)"
  provides:
    - "pg_trgm extension in extensions schema (SRCH-08)"
    - "profiles_username_trgm_idx GIN trigram index"
    - "profiles_bio_trgm_idx GIN trigram index"
    - "Wave 0 test scaffold for SRCH-08"
  affects:
    - "Phase 16 searchProfiles DAL (ILIKE performance gate)"
tech_stack:
  added: []
  patterns:
    - "CREATE EXTENSION IF NOT EXISTS ... WITH SCHEMA extensions (Supabase-idiomatic)"
    - "CREATE INDEX IF NOT EXISTS ... USING gin (...gin_trgm_ops) (idempotent GIN trigram index)"
    - "DATABASE_URL ? describe : describe.skip (integration test DB gate)"
    - "beforeAll seed + ANALYZE + afterAll cleanup pattern for EXPLAIN tests"
key_files:
  created:
    - supabase/migrations/20260423000003_phase11_pg_trgm.sql
    - tests/integration/phase11-pg-trgm.test.ts
  modified: []
decisions:
  - "gin_trgm_ops chosen over gist_trgm_ops for 3x read speed on profiles (read-heavy table)"
  - "WITH SCHEMA extensions follows Supabase convention; passes advisor lint 0015_extension_in_public"
  - "No lowercase functional index added — ILIKE is case-insensitive with gin_trgm_ops natively"
  - "Existing profiles_username_idx B-tree coexists (not dropped); planner selects whichever fits the query"
  - "100 seed rows + ANALYZE in beforeAll to stabilize EXPLAIN assertion against planner cardinality threshold"
metrics:
  duration: "~5min"
  completed: "2026-04-22"
  tasks: 2
  files: 2
---

# Phase 11 Plan 03: pg_trgm Extension + GIN Trigram Indexes Summary

**One-liner:** pg_trgm extension placed in `extensions` schema + two GIN trigram indexes with `gin_trgm_ops` on `profiles.username` and `profiles.bio` to unlock ILIKE search at Phase 16.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration 3 — pg_trgm extension + GIN indexes | fbf9f57 | supabase/migrations/20260423000003_phase11_pg_trgm.sql |
| 2 | Wave 0 integration test (SRCH-08) | f02792a | tests/integration/phase11-pg-trgm.test.ts |

## Migration 3 Key Invariants

**File:** `supabase/migrations/20260423000003_phase11_pg_trgm.sql`

1. **Extension in `extensions` schema** — `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions` passes Supabase advisor lint `0015_extension_in_public` and keeps the public schema clean.
2. **`gin_trgm_ops` opclass on both indexes** — GIN with this opclass enables ILIKE acceleration. Without the opclass, GIN is useless for ILIKE queries (Pitfall 4 from research).
3. **`IF NOT EXISTS` idempotence** — both the extension and both indexes use `IF NOT EXISTS`; re-running the migration is a no-op.
4. **B-tree coexistence preserved** — the existing `profiles_username_idx` B-tree from Phase 7 is not dropped; both indexes coexist and the planner selects whichever fits the query pattern (exact-match UNIQUE lookups use B-tree; ILIKE uses GIN).
5. **Single transaction** — wrapped in `BEGIN;...COMMIT;` per migration convention.

## Wave 0 Test Scaffold — SRCH-08

**File:** `tests/integration/phase11-pg-trgm.test.ts`

Three test cases gated on `DATABASE_URL`:

1. **Extension presence** — queries `pg_extension` and asserts `extname = 'pg_trgm'` and `schema = 'extensions'`.
2. **Index opclass** — queries `pg_indexes` and asserts both `profiles_username_trgm_idx` and `profiles_bio_trgm_idx` exist with `gin_trgm_ops` in their `indexdef`.
3. **EXPLAIN uses index** — positive assertion that `profiles_username_trgm_idx` appears in the plan; negative assertion that a pure `Seq Scan on profiles` does not appear.

**Test flakiness mitigation:** `beforeAll` seeds 100 throwaway user rows with deterministic `trgm_user_*` usernames (via `randomUUID()` from `node:crypto`) and calls `ANALYZE profiles` to force planner statistics update. `afterAll` deletes seeded users; the `profiles` FK cascades the cleanup. Without seeding, the planner may prefer a Seq Scan on a near-empty table and the EXPLAIN assertion would fail.

**CI behavior:** `npm test -- tests/integration/phase11-pg-trgm.test.ts` without `DATABASE_URL` returns 3 skipped tests — CI stays green.

## Handoff to Phase 16

- The **4-character minimum guard** for bio search queries belongs in the `searchProfiles` DAL (Phase 16), not at the DB layer. The GIN index has no query-length restriction — short patterns just produce more matches.
- The **privacy gate** (only returning results where `profile_public = true`) is a Phase 16 DAL WHERE clause responsibility. Phase 11 creates the performance primitive only.
- The **SQL injection surface** (ILIKE pattern parameterization) belongs to Phase 16's `ilike()` Drizzle helper — the `%query%` value is a parameter, not interpolated SQL.

## Deviations from Plan

**1. [Rule 2 - Content] Reduced comment verbosity to meet gin_trgm_ops count constraint**
- **Found during:** Task 1 verification
- **Issue:** The plan's `<action>` section provided a file template with 6 occurrences of `gin_trgm_ops` (4 in comments + 2 in functional SQL), but the `<verify>` script checked for exactly 2 (`grep -c ... | grep -E '^2$'`). Self-contradiction in the plan.
- **Fix:** Simplified comments to remove redundant `gin_trgm_ops` mentions while preserving all essential rationale. The two functional SQL lines (one per index) are unchanged.
- **Files modified:** `supabase/migrations/20260423000003_phase11_pg_trgm.sql`
- **Commit:** fbf9f57

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. Migration 3 creates DB-level performance primitives only. The search consumer (Phase 16) carries the SQL injection and privacy mitigations per the threat register (T-11-03-01, T-11-03-04).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `supabase/migrations/20260423000003_phase11_pg_trgm.sql` exists | FOUND |
| `tests/integration/phase11-pg-trgm.test.ts` exists | FOUND |
| Commit fbf9f57 (Migration 3) | FOUND |
| Commit f02792a (Wave 0 test) | FOUND |

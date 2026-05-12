---
phase: 37
plan: "03"
subsystem: drizzle-migration
tags: [drizzle, migration, idempotent, journal, provenance, divestments]
dependency_graph:
  requires:
    - "37-01 (schema.ts adds Watch provenance fields + divestments table type definitions)"
    - "37-02 (supabase migration 20260511010000_phase37_layer_d.sql — authoritative DDL with pgEnums, RLS, GRANT, trigger)"
  provides:
    - "drizzle/0010_phase37_layer_d.sql — idempotent local re-sync surface for drizzle-kit push"
    - "drizzle/meta/_journal.json idx=10 entry — drizzle-kit migrate journal guard"
  affects:
    - "Local dev workflow: drizzle-kit push after supabase migration is a guaranteed no-op (IF NOT EXISTS)"
tech_stack:
  added: []
  patterns:
    - "Idempotent Drizzle migration (IF NOT EXISTS / DO $$ pg_constraint guard) — mirrors Phase 34/35/36 pattern"
    - "Drizzle = structural twin only (L-06): no RLS, no GRANT, no CREATE TYPE, no trigger"
key_files:
  created:
    - drizzle/0010_phase37_layer_d.sql
  modified:
    - drizzle/meta/_journal.json
decisions:
  - "NO CREATE TYPE in Drizzle migration (L-06 + RESEARCH §10): pgEnum types live exclusively in supabase/migrations/20260511010000_phase37_layer_d.sql"
  - "DO $$ pg_constraint FK guards used for 3 divestments FKs (idempotence pattern from Phase 36)"
  - "Composite index divestments_user_divested_at_idx uses ASC (Drizzle .on() default) — functionally equivalent to Supabase migration DESC for query planning"
  - "Journal when=1778545692750 captured via node -e process.stdout.write(String(Date.now())) (plain integer literal, not JS expression)"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 37 Plan 03: Drizzle Migration + Journal Append Summary

Idempotent Drizzle structural twin `drizzle/0010_phase37_layer_d.sql` created for Phase 37 Layer D, carrying 7 ADD COLUMN IF NOT EXISTS on watches + divestments table + 3 FK guards + 3 indexes; journal appended with idx=10 entry.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create drizzle/0010_phase37_layer_d.sql | 4a6dc02 | drizzle/0010_phase37_layer_d.sql (created, 92 lines) |
| 2 | Append idx=10 entry to drizzle/meta/_journal.json | 566277f | drizzle/meta/_journal.json (modified, 83 lines) |

## File Details

### drizzle/0010_phase37_layer_d.sql (92 lines)

Idempotent structural twin of `supabase/migrations/20260511010000_phase37_layer_d.sql`.

**Content breakdown:**
- 7 `ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS` statements:
  - `"serial" text`
  - `"year_of_acquisition" integer`
  - `"condition" "condition_grade"`
  - `"box_papers" "box_papers_status"`
  - `"service_history" text`
  - `"paid_currency" "currency_code"`
  - `"purchase_date" date`
- 1 `CREATE TABLE IF NOT EXISTS "divestments"` (10 columns: id, catalog_id, user_id, divested_at, replaced_by_catalog_id, sale_price, sale_currency, notes, created_at, updated_at)
- 3 `DO $$ BEGIN ... END $$;` FK guards:
  - `divestments_catalog_id_fk` → `watches_catalog(id)` ON DELETE restrict
  - `divestments_user_id_fk` → `auth.users(id)` ON DELETE cascade
  - `divestments_replaced_by_catalog_id_fk` → `watches_catalog(id)` ON DELETE set null
- 3 `CREATE INDEX IF NOT EXISTS` on divestments:
  - `divestments_user_id_idx` USING btree (user_id)
  - `divestments_catalog_id_idx` USING btree (catalog_id)
  - `divestments_user_divested_at_idx` USING btree (user_id, divested_at)

**Cross-reference:** Structural mirror of `supabase/migrations/20260511010000_phase37_layer_d.sql` (Plan 02). Column shapes match 1:1; Supabase migration owns pgEnum CREATE TYPE, RLS, GRANT, and updated_at trigger.

### drizzle/meta/_journal.json (83 lines)

Extended from 10 entries (idx=0..9) to 11 entries (idx=0..10).

**New idx=10 entry:**
```json
{
  "idx": 10,
  "version": "7",
  "when": 1778545692750,
  "tag": "0010_phase37_layer_d",
  "breakpoints": true
}
```

`when` value `1778545692750` captured via `node -e "process.stdout.write(String(Date.now()))"` — plain integer literal, greater than idx=9's `when` value of `1778534674854`.

**Existing entries:** idx=0..9 byte-identical post-edit (confirmed via node validation: idx=9 `when === 1778534674854` and `tag === "0009_phase36_layer_c_variants"`).

## L-06 Compliance Verification

```
grep -E "^CREATE POLICY|^GRANT |^ALTER TABLE.*ROW LEVEL SECURITY|^CREATE TYPE |^BEGIN;$|^COMMIT;$|^CREATE.*TRIGGER" drizzle/0010_phase37_layer_d.sql
# Exit: 1 (no matches)
```

Zero forbidden statements confirmed. The Drizzle migration is a structural twin only — all auth/RLS/GRANT/trigger/pgEnum DDL lives exclusively in `supabase/migrations/20260511010000_phase37_layer_d.sql`.

## Additive Scope Confirmation

```
grep -E "^ALTER TABLE.*SET NOT NULL" drizzle/0010_phase37_layer_d.sql
# Exit: 1 (no matches)
```

No `SET NOT NULL` flips — Phase 37 is purely additive. The `watches.catalog_id NOT NULL` flip was Phase 36's concern (committed in `0009_phase36_layer_c_variants.sql`).

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — no new security-relevant surface introduced. This plan creates developer tooling files only (Drizzle migration + journal); no network endpoints, auth paths, or runtime data access patterns added.

## Self-Check

- `test -f drizzle/0010_phase37_layer_d.sql` → PASS
- `grep -c "^ALTER TABLE..." drizzle/0010_phase37_layer_d.sql` → 7 PASS
- `grep -c "^CREATE TABLE IF NOT EXISTS \"divestments\"" ...` → 1 PASS
- `grep -c "^CREATE INDEX IF NOT EXISTS \"divestments_" ...` → 3 PASS
- 3 DO $$ FK guards confirmed via `grep -cP '^DO \$\$ BEGIN$'` → 3 PASS
- Zero forbidden statements (L-06) → PASS
- Journal entries length=11 → PASS
- idx=10 JOURNAL_OK validation → PASS
- git log shows both commits: 4a6dc02, 566277f → PASS

## Self-Check: PASSED

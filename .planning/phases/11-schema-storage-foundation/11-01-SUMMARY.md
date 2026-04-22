---
phase: 11
plan: 01
subsystem: schema
tags: [schema, migration, drizzle, backfill, privacy]
dependency_graph:
  requires: []
  provides: [wear_visibility_enum, wear_events_photo_url, wear_events_visibility, notifications_table, notification_type_enum, migration_1_wear_visibility, phase11_schema_test_scaffold]
  affects: [phase-12-dal-ripple, phase-13-notifications, phase-15-wywt-photo]
tech_stack:
  added: []
  patterns: [pgEnum-for-visibility-tier, idempotent-migration-with-DO-block-guard, inline-DO-verification-backstop, wave-0-db-gated-test-scaffold]
key_files:
  created:
    - drizzle/0003_phase11_wear_events_columns.sql
    - supabase/migrations/20260423000001_phase11_wear_visibility.sql
    - tests/integration/phase11-schema.test.ts
  modified:
    - src/db/schema.ts
decisions:
  - "pgEnum added to drizzle-orm/pg-core imports; wearVisibilityEnum and notificationTypeEnum declared at top of module before first pgTable"
  - "notifications table column shapes only in schema.ts (D-08); indexes/RLS/CHECK in raw SQL Migration 2"
  - "Drizzle migration file hand-written (not drizzle-kit generate) to avoid emitting CREATE TYPE in the Drizzle file — enum lives in Migration 1 raw SQL only"
  - "Wave 0 test EXPLAIN assertion for username ILIKE may flake on empty profiles table; Plan 05 executor should note if relaxation to index-existence check is used"
metrics:
  duration: ~8min
  completed: "2026-04-22"
  tasks: 3
  files: 4
---

# Phase 11 Plan 01: Drizzle Schema + Migration 1 + Wave 0 Test Scaffold Summary

**One-liner:** Drizzle schema extended with Phase 11 pgEnums and notifications table; Migration 1 creates wear_visibility enum, backfills wear_events.visibility from worn_public (true→public/false→private, Pitfall G-6 backstop), and enforces 200-char note CHECK in a single atomic transaction; Wave 0 integration test scaffold covers WYWT-09 + WYWT-13 + SRCH-08 gated on DATABASE_URL.

## What Was Built

### Task 1: Drizzle Schema Extensions (`src/db/schema.ts`)

Added three top-level exports:

1. **`wearVisibilityEnum`** — `pgEnum('wear_visibility', ['public', 'followers', 'private'])` — the three-tier visibility enum for Phase 11. Used directly in `wearEvents.visibility`.

2. **`notificationTypeEnum`** — `pgEnum('notification_type', ['follow', 'watch_overlap', 'price_drop', 'trending_collector'])` — all four values declared upfront per D-09 to avoid non-transactional `ALTER TYPE ADD VALUE` in later phases. `price_drop` and `trending_collector` are Phase 15+ write-path stubs but are present in the enum now.

3. **`notifications` pgTable** — column shapes only (id, userId, actorId nullable, type notificationTypeEnum, payload jsonb default `'{}'::jsonb`, readAt nullable, createdAt). Partial indexes, dedup UNIQUE constraint, self-notif CHECK (`actor_id IS NULL OR actor_id != user_id`), and RLS are in the raw SQL Migration 2 per D-08 (Drizzle-orm 0.45.2 cannot express these).

Extended `wearEvents` with:
- `photoUrl: text('photo_url')` — nullable text; stores path only (not a full URL — signed URLs minted at read time per D-02)
- `visibility: wearVisibilityEnum('visibility').notNull().default('public')` — the three-tier column; default matches the user's explicit choice (not 'private' per D-04)

`worn_public` column in `profileSettings` is preserved as-is per D-06. Phase 12 drops it after the DAL ripple.

Also added `pgEnum` to the `drizzle-orm/pg-core` import line.

### Task 1: Drizzle ADD COLUMN Migration (`drizzle/0003_phase11_wear_events_columns.sql`)

Hand-written (not `drizzle-kit generate`) to avoid emitting `CREATE TYPE` in the Drizzle migration — the enum is owned by Migration 1 raw SQL per D-08. Contains exactly two ALTER TABLE statements:

```sql
ALTER TABLE "wear_events" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "wear_events" ADD COLUMN "visibility" "wear_visibility" DEFAULT 'public' NOT NULL;
```

No `CREATE TYPE`, no `CREATE TABLE` — enum creation is Migration 1's job, notifications table creation is Migration 2's job.

### Task 2: Migration 1 (`supabase/migrations/20260423000001_phase11_wear_visibility.sql`)

Single atomic `BEGIN;...COMMIT;` transaction containing:

1. **Enum creation** guarded by `DO $$ IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wear_visibility')` — idempotent re-apply after `drizzle-kit push` (which may create the enum from `wearVisibilityEnum` in schema.ts).

2. **`ADD COLUMN IF NOT EXISTS photo_url text NULL`** and **`ADD COLUMN IF NOT EXISTS visibility wear_visibility NOT NULL DEFAULT 'public'`** — idempotent; `IF NOT EXISTS` means re-apply after drizzle-kit push is a no-op.

3. **Note CHECK constraint** `wear_events_note_length CHECK (note IS NULL OR length(note) <= 200)` — guarded by `pg_constraint` lookup (Postgres has no `ADD CONSTRAINT IF NOT EXISTS` for CHECKs). Phase 8 added `note text` but no length cap.

4. **Backfill UPDATE** — maps `profile_settings.worn_public = true → 'public'`, `false → 'private'`. The CASE expression never writes `'followers'`. Safe to re-run: mapping is deterministic from the same source.

5. **Inline DO$$ verification (Pitfall G-6 backstop)** — inside the same transaction, counts `wear_events WHERE visibility = 'followers'`; if > 0 raises `RAISE EXCEPTION` so the whole transaction rolls back. This is the privacy-regression backstop: if a developer corrupts the backfill CASE (e.g. `ELSE 'followers'`), no partial state ships.

**D-06 invariant:** `DROP COLUMN worn_public` is absent. Verified by grep acceptance criteria.

### Task 3: Wave 0 Test Scaffold (`tests/integration/phase11-schema.test.ts`)

Gated on `process.env.DATABASE_URL ? describe : describe.skip` — skips cleanly in CI without local Supabase (verified: 8 skipped, 0 failed when DATABASE_URL is unset).

Covers:
- **WYWT-09:** `wear_visibility` enum values from `pg_enum` in declaration order `['public', 'followers', 'private']`
- **WYWT-09:** `wear_events` column shape from `information_schema.columns` — photo_url (text, nullable), visibility (udt_name=wear_visibility, NOT NULL, default matches `'public'::wear_visibility`)
- **WYWT-09:** CHECK constraint — seeds user+watch via direct `db.insert`, asserts 201-char note insert rejects with `/wear_events_note_length|check constraint/i`; asserts 200-char note insert succeeds
- **WYWT-13:** `storage.buckets WHERE id = 'wear-photos'` — asserts exists and `public === false`
- **SRCH-08:** `pg_extension WHERE extname = 'pg_trgm'` — asserts enabled
- **SRCH-08:** `pg_indexes` — asserts `profiles_username_trgm_idx` and `profiles_bio_trgm_idx` exist with `gin_trgm_ops` in indexdef
- **SRCH-08:** `EXPLAIN SELECT id FROM profiles WHERE username ILIKE '%tyler%'` — asserts plan references `profiles_username_trgm_idx` (may relax to index-existence if planner chooses Seq Scan on empty table — see Known Stubs)

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Schema + Drizzle migration | fbaf67a | src/db/schema.ts, drizzle/0003_phase11_wear_events_columns.sql |
| Task 2: Migration 1 SQL | 9d34af8 | supabase/migrations/20260423000001_phase11_wear_visibility.sql |
| Task 3: Wave 0 test scaffold | 74dbe71 | tests/integration/phase11-schema.test.ts |

## Deviations from Plan

None — plan executed exactly as written. All three tasks followed the action specs verbatim.

## Known Stubs

**SRCH-08 EXPLAIN flakiness risk:** The `username ILIKE uses GIN trigram index` test uses `EXPLAIN` to assert that `profiles_username_trgm_idx` appears in the query plan. On an empty `profiles` table the Postgres planner may choose a Seq Scan (low row-count cost estimate) instead of the GIN index. If this test flakes during Plan 05's schema-push verification, the Plan 05 executor should relax the assertion to check only that the index exists — which is already covered by the preceding `pg_indexes` test. Document in Plan 05 SUMMARY if relaxed.

## Threat Flags

None. All surface added in this plan (schema type definitions, SQL migrations, test file) is within the planned scope of the threat model. The Pitfall G-6 backstop (T-11-01-01 mitigation) is implemented as designed.

## Self-Check

Files created/modified:
- [x] src/db/schema.ts — exists, contains wearVisibilityEnum, notificationTypeEnum, notifications table, wearEvents extended
- [x] drizzle/0003_phase11_wear_events_columns.sql — exists, 2 ALTER TABLE lines
- [x] supabase/migrations/20260423000001_phase11_wear_visibility.sql — exists, atomic transaction with enum/columns/CHECK/backfill/verification
- [x] tests/integration/phase11-schema.test.ts — exists, skips cleanly without DATABASE_URL

Commits:
- [x] fbaf67a — Task 1
- [x] 9d34af8 — Task 2
- [x] 74dbe71 — Task 3

## Self-Check: PASSED

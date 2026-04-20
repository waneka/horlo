---
phase: 07-social-schema-profile-auto-creation
plan: "01"
subsystem: database
tags: [social, schema, drizzle, rls, supabase, trigger]
dependency_graph:
  requires: [06-01]
  provides: [profiles-table, follows-table, profile_settings-table, activities-table, wear_events-table, profile-auto-creation-trigger, social-rls-policies]
  affects: [src/db/schema.ts, supabase/migrations]
tech_stack:
  added: []
  patterns: [SECURITY DEFINER trigger, RLS with InitPlan optimization, Drizzle pgTable with unique constraint]
key_files:
  created:
    - drizzle/0001_great_spencer_smythe.sql
    - supabase/migrations/20260420000001_social_tables_rls.sql
    - supabase/migrations/20260420000002_profile_trigger.sql
  modified:
    - src/db/schema.ts
    - drizzle/meta/0001_snapshot.json
    - drizzle/meta/_journal.json
decisions:
  - "Trigger fires on public.users INSERT (not auth.users), ensuring profile row creation after the shadow-user sync trigger runs"
  - "Username dedup uses random 4-digit suffix in a WHILE loop to avoid sequential enumeration"
  - "activities and wear_events SELECT policies are owner-only in Phase 7; will expand in Phases 8/10"
  - "profile_settings SELECT open to all authenticated so app can check visibility flags without owner auth"
metrics:
  duration: ~15 minutes
  completed: "2026-04-20"
  tasks_completed: 2
  tasks_total: 3
  files_created: 3
  files_modified: 3
---

# Phase 07 Plan 01: Social Schema and Profile Auto-Creation Summary

**One-liner:** Five social tables (profiles, follows, profile_settings, activities, wear_events) added to Drizzle schema with RLS policies and SECURITY DEFINER trigger that auto-creates profile rows on signup.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add five new tables to Drizzle schema and generate migration | 470c459 | src/db/schema.ts, drizzle/0001_great_spencer_smythe.sql |
| 2 | Write Supabase migrations for RLS policies and profile trigger | 827b034 | supabase/migrations/20260420000001_social_tables_rls.sql, supabase/migrations/20260420000002_profile_trigger.sql |

## Task Awaiting Human Action

**Task 3:** Apply Drizzle migration and Supabase migrations to production

Paused at `checkpoint:human-action` — requires human to run `npx drizzle-kit push` and `supabase db push --linked` against the production Supabase project and verify the trigger creates profiles on signup.

## What Was Built

### Drizzle Schema (src/db/schema.ts)

Five new table definitions appended after `userPreferences`:

- **profiles** — user identity table; PK references `users.id`; unique username column; indexes on username
- **follows** — follower/following relationship; unique pair constraint `(follower_id, following_id)`; indexes on both FK columns
- **profileSettings** — privacy controls; four boolean visibility flags (profile, collection, wishlist, worn), all default `true`
- **activities** — event log for feed; composite index on `(user_id, created_at)` for feed queries
- **wearEvents** — wear history; unique day constraint `(user_id, watch_id, worn_date)`; index on `(watch_id, worn_date)`

`unique` imported from `drizzle-orm/pg-core`. Migration generated at `drizzle/0001_great_spencer_smythe.sql`.

### Supabase Migrations

**20260420000001_social_tables_rls.sql** — 20 RLS policies across 5 tables:
- `profiles`, `follows`, `profile_settings`: SELECT open to all authenticated (public identifiers / follow counts / visibility checks)
- `activities`, `wear_events`: SELECT owner-only (will open in later phases)
- All UPDATE policies include both USING and WITH CHECK clauses
- Username format CHECK constraint: `^[a-z][a-z0-9_]{2,29}$`

**20260420000002_profile_trigger.sql** — Profile auto-creation:
- Function `handle_new_public_user()` with `SECURITY DEFINER` + `SET search_path = public`
- Generates username from email prefix: lowercase, sanitize non-alphanumeric to `_`, ensure starts with letter, minimum 3 chars
- Deduplication: random 4-digit suffix loop until unique
- Inserts rows into both `profiles` and `profile_settings` on `public.users` INSERT
- Trigger: `on_public_user_created` AFTER INSERT ON public.users

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — migration files are complete SQL with no placeholder content.

## Threat Flags

No new security surface beyond what the plan's threat model covers. All threat mitigations (T-07-01 through T-07-05) are implemented as specified.

## Self-Check

### Files exist:
- [x] src/db/schema.ts — modified with 5 new table exports
- [x] drizzle/0001_great_spencer_smythe.sql — created
- [x] supabase/migrations/20260420000001_social_tables_rls.sql — created
- [x] supabase/migrations/20260420000002_profile_trigger.sql — created

### Commits exist:
- [x] 470c459 — feat(07-01): add five social tables to Drizzle schema and generate migration
- [x] 827b034 — feat(07-01): add Supabase migrations for social table RLS and profile trigger

## Self-Check: PASSED

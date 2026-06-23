---
quick_task: 260622-lcd-audit-missing-on-local-supabase-migrations
plan: 01
type: capture
wave: 1
depends_on: []
files_modified:
  - .planning/quick/260622-lcd-audit-missing-on-local-supabase-migrations/AUDIT.md
autonomous: false
requirements:
  - QUICK-260622-LCD-01  # Enumerate every supabase/migrations/*.sql file not yet applied to local DB
  - QUICK-260622-LCD-02  # Apply each missing migration in lexicographic order via psql until parity reached
  - QUICK-260622-LCD-03  # Document the audit result in AUDIT.md (which migrations were missing, what data they backfill, anything to watch out for)

must_haves:
  truths:
    - "Operator confirmed 2026-06-22 (during Phase 76) that local DB has been falling behind prod: 'we haven't really been keeping local development up to date - just pushing and testing on prod'"
    - "Phase 11 storage bucket migration (`20260423000004_phase11_storage_bucket_rls.sql`) was missing locally — surfaced during Phase 76 and applied (recorded in todo `drizzle-kit-pg-net-introspection-bug`)"
    - "User-base has grown — local-dev workflow needs to work for safer integration testing before pushing to prod"
    - "Per durable memory `project_db_wipeable_2026_05_09`: watches_catalog rows have v4-v5.1 enrichment that's NOT wipeable; local DB resets must preserve catalog data or reseed from a snapshot"
    - "Per durable memory `project_local_db_reset`: `supabase db reset` alone fails — must follow with drizzle push + selective supabase migrations via docker exec psql. drizzle-kit push is currently broken by the pg_net introspection bug (see corresponding todo); psql-apply is the workaround."

tags:
  - local-dev
  - migrations
  - supabase
  - tooling
  - operator-followup
---

<objective>
Capture intent — bring the local Supabase DB into parity with prod by identifying and applying every migration that exists in `supabase/migrations/` but has never been applied locally. Produce a one-shot audit script + AUDIT.md report.
</objective>

<context>
Surfaced during Phase 76 execution on 2026-06-22:
- `npx drizzle-kit push` fails locally due to pg_net domain CHECK introspection bug (separate todo)
- The `wear-photos` Storage bucket was missing locally (Phase 11 storage migration never applied)
- Tests can pass locally against an out-of-sync schema if they use the env-gate pattern that skips when DATABASE_URL is unset; this masks "your local DB is stale" issues until manual application
- v8.3 (WYWT Video) starts here; Phase 77 will exercise the wear-photos bucket from the UI side — local-dev needs to be functional for that

Operator goal: make local dev viable for integration testing now that the app is shared with users (cannot rely on prod-push-and-verify as the only safety net).

## What to enumerate

```bash
# Total migrations on disk
ls supabase/migrations/*.sql | wc -l

# Migrations applied to local (assuming supabase tracks via supabase_migrations.schema_migrations or similar)
docker exec supabase_db_horlo psql -U postgres -d postgres -c \
  "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;"

# Diff the two lists → produces the "missing on local" set
```

## What to verify per migration

- Read each missing migration. Categorize as: idempotent / state-changing / data-backfill / RLS-only / bucket-only
- Apply in lexicographic order via `docker exec -i supabase_db_horlo psql -U postgres -d postgres < <file>`
- After each, run a quick sanity check (`\d <touched_table>` or `SELECT COUNT(*) FROM <touched_table>`) before moving on
- If a migration fails (likely candidates: ones that assume earlier migrations applied, ones that touch data that diverges between local seed and prod), stop and triage

## Out of scope

- Reseeding catalog/data tables (separate concern — they have prod-only enrichment; see `project_db_wipeable_2026_05_09`)
- Fixing drizzle-kit push (separate todo)

## Suggested deliverable

- `.planning/quick/260622-lcd-audit-missing-on-local-supabase-migrations/AUDIT.md` listing every migration that was missing on local, what was applied, and what (if anything) requires manual follow-up
- Update durable memory `project_local_db_reset` if the audit changes the canonical local-dev reset workflow

## How to start

Run this from project root:

```bash
diff <(ls supabase/migrations/*.sql | xargs -n1 basename | sed 's/\.sql$//') \
     <(docker exec supabase_db_horlo psql -U postgres -d postgres -t -c \
       "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;" | tr -d ' ' | grep -v '^$')
```

Anything in the LEFT-only column is a candidate for application.
</context>

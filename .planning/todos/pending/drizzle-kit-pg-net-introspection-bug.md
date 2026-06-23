---
id: drizzle-kit-pg-net-introspection-bug
created: 2026-06-22
source: Phase 76 Task 3 (local DB push)
resolves_phase: null
priority: medium
tags: [drizzle-kit, supabase, pg_net, local-dev, tooling]
---

# drizzle-kit push fails introspecting pg_net domain CHECK in local Supabase

**Status:** open. Surfaced when applying Phase 76 schema changes locally on 2026-06-22.

## What it is

`npx drizzle-kit push` (drizzle-kit 0.31.10) crashes during the "Pulling schema from database" introspection step with:

```
TypeError: Cannot read properties of undefined (reading 'replace')
    at /node_modules/drizzle-kit/bin.cjs:17861:39
              checkValue = checkValue.replace(/^CHECK\s*\(\(/, "").replace(/\)\)\s*$/, "");
```

Root cause: drizzle-kit's `pg_constraint` introspection assumes every CHECK constraint has a backing table (`conrelid` → table OID). Supabase installs the `pg_net` extension, which defines a CHECK on the `net.http_method` **domain** (not a table). The introspection row for that domain CHECK has `consrc`/`pg_get_constraintdef` shape that returns undefined, blowing up the regex `.replace()` chain.

Reproducer (any local Supabase Postgres after pg_net installs):
```sql
SELECT n.nspname, conname, conrelid::regclass AS table_name
FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
WHERE c.contype = 'c' AND n.nspname = 'net';
-- net | http_method_check | -    <- conrelid is empty, no table backing
```

## Workaround (what we do today)

Apply Supabase migrations directly via psql instead of `drizzle-kit push`:
```bash
docker exec -i supabase_db_horlo psql -U postgres -d postgres \
  < supabase/migrations/<timestamp>_<name>.sql
```
Idempotent migrations (with `ADD COLUMN IF NOT EXISTS` / `DO $$ ... IF NOT EXISTS ... END $$` guards) reach the same end state and are what we push to prod via `supabase db push --linked` anyway.

## Fix options (in priority order)

1. **Wait for upstream fix.** No 0.31.x patch exists; latest stable is 0.31.10. Track drizzle-team/drizzle-orm for a fix.
2. **Upgrade to drizzle-kit 1.0.0-rc.x.** RC builds may have fixed introspection; not yet vetted by this project. Larger lift, breaking-change risk.
3. **Local workaround: drop the offending CHECK before push.** `ALTER DOMAIN net.http_method DROP CONSTRAINT http_method_check` — but breaks pg_net behavior; not recommended.

## What to do when this gets resolved

- Update `project_drizzle_supabase_db_mismatch` durable memory to remove the psql-apply step from the local-dev workflow.
- Update Phase 76 `76-01-PLAN.md` Task 3 retrospectively or note in milestone summary.

## Why medium priority

Local dev has been bypassed in favor of prod-push-and-verify for several milestones (operator confirmed 2026-06-22). The workaround works; the real cost is friction for new contributors and integration-test setup. Not a blocker.

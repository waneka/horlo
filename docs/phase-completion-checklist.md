# Phase Completion Checklist

After `/gsd-execute-phase` finishes verification on a phase, run through this list before considering the phase truly "shipped":

## 1. DB schema parity (drizzle ↔ supabase)

If the phase added new tables, columns, indexes, or FKs via `drizzle-kit push`:

- Locate the drizzle-generated SQL in `drizzle/<NNNN>_<phase_slug>.sql`
- Create a parallel supabase migration in `supabase/migrations/<YYYYMMDDHHMMSS>_<phase_slug>_drizzle_<thing>.sql`
- Use idempotent guards: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, DO blocks for `ADD CONSTRAINT`
- Timestamp it **before** any dependent supabase migrations (e.g., constraint migrations that `ALTER` the new table)
- Verify locally: `docker exec supabase_db_horlo psql -U postgres -d postgres -f <file>` should produce only `NOTICE` messages, never `ERROR`

**Why:** `drizzle-kit push` is LOCAL ONLY (per `project_drizzle_supabase_db_mismatch` memory). Prod migrations only see `supabase/migrations/`. If you skip the port, `supabase db push --linked` will fail later when an existing supabase migration tries to `ALTER` a table that doesn't exist on prod.

**Skip if:** The phase only changed code (no schema). Most v4.0 phases (18, 19, 20, 20.1) were code-only.

**Examples done correctly:** drizzle 0002 (phase 8) → supabase `20260420000003_phase8_notes_columns.sql`. Drizzle 0003 (phase 12) → supabase `20260424000001_phase12_drop_worn_public.sql`.

**Examples done incorrectly (caught after the fact in 20.1):** drizzle 0004 (phase 17) and drizzle 0005 (phase 19.1) shipped without a supabase port — required `20260426000000_phase17_drizzle_tables.sql` and `20260429000000_phase19_1_drizzle_taste_columns.sql` to be authored retroactively before prod could deploy.

## 2. Deploy any prod DB updates

```bash
supabase migration list --linked     # confirm pending count matches expectation
supabase db push --linked            # apply pending migrations
```

**Why:** Prod DB must be ahead of (or in lock-step with) the code that depends on it. Push DB before code so the new code never references constraints/columns that aren't there yet.

**Skip if:** No new supabase migrations since last deploy. Verify with `supabase migration list --linked` — every Local row should have a matching Remote row.

## 3. Deploy code to main for prod web release

```bash
git push origin main                  # Vercel auto-deploys on push to main
```

Verify: `vercel ls --next 0` should show a new "Building" deployment within ~30s, then "Ready" within ~1m.

**Why:** Code release. DB must be done first (step 2) — otherwise the freshly-deployed code can hit constraint/column errors against an unmigrated prod DB.

**Skip if:** Phase did not affect runtime code (e.g., docs-only or planning-artifacts-only changes). All other phases require this step.

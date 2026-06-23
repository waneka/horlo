---
phase: 77
type: post-deploy
status: pending_operator
created: 2026-06-23
---

# Phase 77 — Post-Deploy Steps

This phase introduced application code that depends on a new storage RLS migration. After the merge to `main`, the operator MUST run:

```bash
supabase db push --linked
```

per durable memory `project_drizzle_supabase_db_mismatch` ("drizzle-kit push is LOCAL ONLY; prod uses `supabase db push --linked`").

## What the push applies

`20260623000000_phase77_storage_rls_poster_filename.sql` — extends the Phase 11 `wear_photos_select_three_tier` policy on `storage.objects` to handle the `{wearEventId}-poster.jpg` filename shape introduced by SEED-020 D-07. Without this push, non-owner viewers cannot SELECT posters → home-rail video tiles fall back to the catalog imageUrl + a Play badge (CR-03 manifestation), and the detail page error-fallback fires for non-owners.

## Verifying the push landed

After running `supabase db push --linked`, confirm the policy was updated:

```sql
SELECT polname, pg_get_expr(polqual, polrelid) AS using_expression
FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass
  AND polname = 'wear_photos_select_three_tier';
```

Expected: the `using_expression` contains `regexp_replace(storage.filename(name), '-poster\.', '.')`.

## UAT walk dependency

Do NOT run the iPhone Safari UAT walk (see `77-HUMAN-UAT.md`) until the push has completed. Items 1, 2, 4 of the UAT require a non-owner viewer to load posters successfully; without the migration, every poster-load via signed URL will fail RLS.

## Rollback

If anything goes wrong with the new policy, the previous version can be restored from `20260423000045_phase11_storage_rls_secdef_fix.sql` — re-run that migration's `CREATE POLICY` block to revert.

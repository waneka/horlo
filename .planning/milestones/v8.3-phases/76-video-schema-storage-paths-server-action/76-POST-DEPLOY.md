# Phase 76 — Post-Deploy Runbook

**Status: pending operator execution after PR merge**

> Authoritative runbook for applying the Phase 76 video-schema migration to **production** Supabase via `supabase db push --linked`. Run this **after** the Phase 76 PR is merged to `main` and the corresponding Vercel deploy has succeeded. The migration is additive, transactional, and idempotent — re-running on top of partial state is safe.

---

## Prerequisites

- `SUPABASE_ACCESS_TOKEN` env var is set in the operator's shell **OR** `supabase login` has been completed previously in this shell session.
- Current branch is `main` (or a tag that matches a merged release), with the Phase 76 commits present in `git log`.
- The Vercel deploy for the merged Phase 76 commits has succeeded — confirms the Drizzle-derived local schema and the in-flight runtime agree on the columns the migration is about to ADD.
- Supabase CLI version ≥ 2.x is on `PATH` (`supabase --version`).
- The migration file exists locally at `supabase/migrations/20260622000000_phase76_video_schema.sql` (verify with `ls supabase/migrations/20260622000000*`).
- **Note (local-dev context, operator-relevant):** During Plan 01 execution, `drizzle-kit push` could not apply the schema to **local** Supabase due to an introspection bug in drizzle-kit 0.31.10 against the Supabase `pg_net` extension's domain CHECK constraints. Local was instead populated by applying the full Supabase migration via `psql -f` directly. This does **not** affect the prod path documented below — `supabase db push --linked` does not perform Drizzle introspection. It is documented here because future local development will need the same workaround until drizzle-kit ships a fix.

---

## Pre-flight check

1. Confirm the migration file is present:

   ```bash
   ls -la supabase/migrations/20260622000000_phase76_video_schema.sql
   ```

2. Confirm the migration sorts **after** the previous migration lexicographically (per durable-memory gotcha #1 — filename ordering):

   ```bash
   ls supabase/migrations/ | tail -3
   ```

   Expected output should show `20260622000000_phase76_video_schema.sql` as the LATEST migration (lexicographically after `20260620204341_delete_orphan_users_and_add_auth_delete_trigger.sql`).

3. Check the remote/local sync state — the new migration should appear as `Pending` on the Remote column:

   ```bash
   supabase migration list --linked
   ```

   Expected: the row for `20260622000000_phase76_video_schema` shows the local timestamp filled in and the remote timestamp empty (i.e., applied locally only, pending on remote).

---

## Apply the migration to prod

Run the prod push (the `--linked` flag uses the project linked via `supabase link`):

```bash
supabase db push --linked
```

The migration is wrapped in a single `BEGIN; ... COMMIT;` transaction (see `supabase/migrations/20260622000000_phase76_video_schema.sql` lines 12 + 91). Every section uses `IF NOT EXISTS` / `DO $$ ... NOT EXISTS` guards and an idempotent `UPDATE ... WHERE NOT ... = ANY(...)` for the bucket MIME. **Re-running after a partial failure is safe** — sections already applied become no-ops, and the post-flight assertion is the gate that proves end-state correctness.

**There is no manual rollback script.** If the post-flight `RAISE EXCEPTION` (or any earlier statement) fails, the entire BEGIN/COMMIT block rolls back atomically and prod is left in the pre-migration state.

---

## Expected output + verification

### Expected CLI output

The final lines of `supabase db push --linked` should resemble:

```
Applying migration 20260622000000_phase76_video_schema.sql...
Finished supabase db push.
```

Then re-run the migration-list query:

```bash
supabase migration list --linked
```

Expected: `20260622000000_phase76_video_schema` now shows timestamps on **both** the Local and Remote columns — the row should match the format of all earlier migrations.

### Verify schema objects on prod

Via the Supabase dashboard SQL editor (or `psql` against the prod connection string) run these four queries:

1. **media_type enum exists:**

   ```sql
   SELECT typname FROM pg_type WHERE typname = 'media_type';
   ```

   Expected: exactly one row returned.

2. **The 3 new columns + CHECK constraint exist on wear_events:**

   ```sql
   \d wear_events
   ```

   (in `psql`) — the output should include:
   - `media_type` — `media_type` type — `not null default 'photo'::media_type`
   - `media_path` — `text`
   - `poster_path` — `text`
   - In the "Check constraints" section: `wear_events_video_paths_required CHECK ((media_type = 'photo'::media_type) OR ((media_path IS NOT NULL) AND (poster_path IS NOT NULL)))`

3. **wear-photos bucket allows video/mp4:**

   ```sql
   SELECT id, allowed_mime_types FROM storage.buckets WHERE id = 'wear-photos';
   ```

   Expected: `allowed_mime_types` contains `video/mp4` alongside the pre-existing image MIMEs (e.g., `{image/jpeg,image/png,image/webp,video/mp4}`).

4. **No existing rows have media_type='video' (post-flight invariant):**

   ```sql
   SELECT COUNT(*) FROM wear_events WHERE media_type::text = 'video';
   ```

   Expected: `0` (the additive migration cannot have created a video row; this confirms the post-flight assertion that ran during apply).

---

## Manual RLS check — wear-photos `.mp4` SELECT (per 76-VALIDATION.md)

Per `76-VALIDATION.md` §Manual-Only Verifications, the Storage RLS policy `wear_photos_select_three_tier` extracts the wear_event_id via `split_part(storage.filename(name), '.', 1)` — which is **expected** to work identically for `.jpg` and `.mp4` filenames (research open question #5). This manual check empirically confirms cross-user `.mp4` SELECT is rejected by RLS.

Steps:

1. Open horlo.app in a browser; sign in as **test user A**. Note user A's `id` (visible via the auth context or dashboard `auth.users` query).

2. In the Supabase dashboard → Storage → `wear-photos` bucket, upload a tiny test mp4 to:

   ```
   {user-A-id}/00000000-0000-4000-8000-000000000001.mp4
   ```

   (Any small mp4 file works — even a 10 KB clip. The path must follow the `{userId}/{wearEventId}.mp4` shape and the `wearEventId` segment must be a valid UUID.)

3. Sign out. Sign in as **test user B** (different account; if none exists, create one via the prod signup flow).

4. As user B, attempt to fetch a signed URL for the same path. Two ways to test:
   - **Via the app:** load a page that exercises `signedUrlFor('wear-photos', '{user-A-id}/00000000-0000-4000-8000-000000000001.mp4')` — the expected outcome is a 4xx response or a null/empty URL.
   - **Via the dashboard SQL editor (more direct):** while signed in as user B's session, run:

     ```sql
     SELECT storage.create_signed_url('wear-photos', '{user-A-id}/00000000-0000-4000-8000-000000000001.mp4', 60);
     ```

     Expected: error or NULL (the `wear_photos_select_three_tier` SELECT policy rejects the read).

5. **Confirm the result:**
   - ✅ **PASS:** user B's signed-URL request returns 403 / error / NULL — RLS correctly blocks cross-user `.mp4` SELECT.
   - ❌ **FAIL:** user B successfully fetches a signed URL pointing at user A's `.mp4` — **Phase 76 blocker**. Surface the failure to the planner immediately; the fix is to extend `wear_photos_select_three_tier` (or add a sibling policy) so the `.mp4` extension is treated the same as `.jpg` for the UUID extraction. Do **not** mark Phase 76 complete in this case.

6. (Optional cleanup) Delete the test object: in the Supabase dashboard → Storage → `wear-photos`, select the row at `{user-A-id}/00000000-0000-4000-8000-000000000001.mp4` and delete it.

7. Document the result (PASS / FAIL with details) when reporting back via the resume signal in Task 3 (Plan 04 of the phase).

---

## Gotcha reminders

From durable memory `project_drizzle_supabase_db_mismatch` — 4 prod-push pitfalls:

1. **Filename ordering** — the migration timestamp `20260622000000` must sort lexicographically AFTER all earlier migration filenames in `supabase/migrations/`. Verified in the Pre-flight check (`ls supabase/migrations/ | tail -3` should show this file last). If a later-dated migration was committed in parallel, resolve the ordering before pushing.
2. **Ordering relative to other pending migrations** — `supabase migration list --linked` will reveal ALL pending migrations, not just this one. If the Remote column shows additional pending migrations from other phases, the push will apply them in lexicographic order. Confirm each is intended before proceeding.
3. **Extension schema** — the migration references `storage.buckets` (Phase 11 Supabase Storage extension lives in the `storage` schema, not `public`). `supabase db push --linked` runs as the migration role, which has full access; no schema-qualification issues are expected. If a permission-denied error fires on the `UPDATE storage.buckets` statement, confirm the linked project's migration role has `UPDATE` on `storage.buckets`.
4. **Enum-bound dependents** — the `media_type` enum is freshly created by this migration; no rename or drop is performed; no existing dependents (columns, functions, casts) reference it pre-migration. **The gotcha applies to any future change** that renames a value (e.g., `'photo' → 'image'`) or drops a value (e.g., `'video'`) — at that time query `pg_depend WHERE refobjid = 'media_type'::regtype` BEFORE writing the cleanup to discover every column, default, or check predicate that needs to be migrated in lockstep.

---

Once Sections 1–5 above pass on prod, mark this phase complete via `/gsd-phase-complete 76`. A sibling `76-POST-DEPLOY-RESULT.md` file may be created at that time to capture the actual prod CLI output and the manual RLS check result for the deployment audit trail.

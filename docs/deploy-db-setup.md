# Horlo Prod DB Bootstrap Runbook

Single-pass runbook for linking the prod Supabase project (`wdntzsckjaoqodsyscns`) and Vercel `horlo.app` deployment to a working authenticated state. Run top-to-bottom in one sitting. Stop at any step where the expected output does not match.

**Preconditions:**

- Local checkout on `main`, clean working tree, `npm install` done
- Supabase CLI installed (`supabase --version` → 2.x)
- drizzle-kit available via `npx drizzle-kit --version` → 0.31.x
- Vercel CLI installed (`npm i -g vercel` if missing)
- Supabase dashboard access to project `wdntzsckjaoqodsyscns`
- Vercel dashboard access to the `horlo.app` project

## 1. Link Supabase project

```bash
supabase link --project-ref wdntzsckjaoqodsyscns
```

Expected: prompt for the DB password (retrieve from Supabase Dashboard → Project Settings → Database → "Database password" — reset if forgotten). On success: `Finished supabase link.`

## 2. Apply migrations

### 2a. Apply the shadow-user trigger migration (Supabase-managed)

```bash
supabase db push --linked
```

Expected: the CLI prints `Applying migration 20260413000000_sync_auth_users.sql` and finishes with no errors. On first run it also creates `supabase_migrations.schema_migrations`.

### 2b. Generate and apply the Drizzle schema migration

Retrieve the **Direct Connection string** (port 5432, `db.wdntzsckjaoqodsyscns.supabase.co`) from Supabase Dashboard → Project Settings → Database → Connection string → **Direct connection**. This is NOT the pooler URL. Direct connection is required because `drizzle-kit migrate` uses session-level operations not supported by the transaction pooler.

```bash
# One-time: generate the initial migration from src/db/schema.ts into ./drizzle/
DATABASE_URL="postgresql://postgres:<DB_PASSWORD>@db.wdntzsckjaoqodsyscns.supabase.co:5432/postgres" \
  npx drizzle-kit generate
```

Expected: creates `./drizzle/0000_<random_name>.sql` and `./drizzle/meta/_journal.json`. Commit these files to git before proceeding.

```bash
# Apply the generated migrations to prod
DATABASE_URL="postgresql://postgres:<DB_PASSWORD>@db.wdntzsckjaoqodsyscns.supabase.co:5432/postgres" \
  npx drizzle-kit migrate
```

Expected: drizzle logs each migration as applied; final message `[✓] migrations applied successfully!`. A `drizzle.__drizzle_migrations` table is created in the DB.

**DATABASE_URL footgun:** Do NOT use the port 6543 pooler URL here. Transaction pool mode breaks prepared statements and `drizzle-kit migrate` will fail or silently corrupt state.

## 3. Set Vercel env vars

### 3a. Retrieve values from Supabase dashboard

- `NEXT_PUBLIC_SUPABASE_URL`: Project Settings → API → **Project URL** (shape: `https://wdntzsckjaoqodsyscns.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project Settings → API → **anon public** (JWT starting with `eyJ...`)
- `DATABASE_URL` (for Vercel runtime — NOT the migration URL): Project Settings → Database → Connection string → **Session mode** (port 5432 via `aws-0-<region>.pooler.supabase.com`)

### 3b. Install + authenticate Vercel CLI

```bash
npm i -g vercel           # skip if already installed
vercel login              # complete browser flow
vercel link               # select the existing horlo.app project
```

Expected: `.vercel/project.json` created in the repo root. Do NOT commit this file (already in `.gitignore`).

### 3c. Add env vars to the production environment

Each command prompts for the value. You MUST pass `production` as the environment or the var lands in preview and `horlo.app` will not see it.

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# paste: https://wdntzsckjaoqodsyscns.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# paste the anon JWT

vercel env add DATABASE_URL production
# paste the session-mode pooler URL (port 5432, pooler.supabase.com host)
```

Expected after each: `Added Environment Variable <NAME> to Project horlo [X ms]`.

**Vercel env var scope footgun:** `vercel env add FOO` without `production` puts the var in preview+development scope only. `horlo.app` runs from the production scope. Always append `production`.

### 3d. Trigger a redeploy so the new env vars take effect

```bash
vercel --prod
```

Expected: a new deployment builds and promotes to production. Env vars set AFTER the last deployment are NOT applied retroactively — a redeploy is required.

## 4. Smoke test

1. Open `https://horlo.app` in a private/incognito browser window. Should redirect to `/login`.
2. Click **Sign up**. Enter a throwaway email (e.g., `test+<timestamp>@<your-domain>`) and a password.
3. Submit. Should redirect to `/` (empty collection view) with the UserMenu visible in the header.
4. Click the UserMenu → **Log out**. Should redirect to `/login`.
5. Open Supabase Dashboard → Authentication → Users. The test user should be listed.
6. Select the test user → **Delete user** to clean up.

If any step fails, see Rollback below.

## 5. Rollback

### drizzle-kit migrate failed partway

- Connect with `psql "postgresql://postgres:<DB_PASSWORD>@db.wdntzsckjaoqodsyscns.supabase.co:5432/postgres"`.
- Inspect: `SELECT * FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 5;`
- If the last row corresponds to a half-applied migration: `DELETE FROM drizzle.__drizzle_migrations WHERE id = <id>;`
- Fix the schema, rerun `drizzle-kit generate` then `drizzle-kit migrate`.

### supabase db push failed on the trigger migration

- The trigger migration uses `CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS` — idempotent. Safe to rerun `supabase db push --linked`.
- If it keeps failing, inspect: Supabase Dashboard → Database → Logs for the SQL error.

### Vercel env var wrong / smoke test signup fails with 500

- `vercel env ls production` — confirm all three vars present with correct values.
- `vercel env rm <NAME> production` then re-add with correct value.
- Trigger another `vercel --prod` redeploy.
- Check Vercel → Deployments → latest → Runtime Logs for the actual error.

### Signup gets stuck "check your email"

- Supabase Dashboard → Authentication → Email Templates / Providers → confirm **Enable email confirmations** is OFF (Phase 4 D-09 locked auto-confirm).

### Need to roll back the deployment entirely

- Vercel Dashboard → Deployments → find the previous good deploy → **Promote to Production**.

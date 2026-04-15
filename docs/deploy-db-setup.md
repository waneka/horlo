# Horlo Prod DB Bootstrap Runbook

Single-pass runbook for linking the prod Supabase project (`wdntzsckjaoqodsyscns`) and Vercel `horlo.app` deployment to a working authenticated state. Run top-to-bottom in one sitting. Stop at any step where the expected output does not match.

**Preconditions:**

- Local checkout on `main`, clean working tree, `npm install` done
- Supabase CLI installed (`supabase --version` → 2.x)
- drizzle-kit available via `npx drizzle-kit --version` → 0.31.x
- Vercel CLI installed (`npm i -g vercel` if missing)
- Supabase dashboard access to project `wdntzsckjaoqodsyscns`
- Vercel dashboard access to the `horlo.app` project

## 0. Disable email confirmation (personal-MVP posture)

Supabase projects default to "Confirm email" ON and use Supabase's shared SMTP, which is rate-limited to **2 emails/hour** on the free tier. For a personal-MVP run this will almost certainly trip during smoke testing and block the second signup attempt with `over_email_send_rate_limit`.

Before doing anything else:

1. Open Supabase Dashboard → Authentication → Sign In/Providers → **Email**
2. Toggle **Confirm email** to OFF
3. Save

**Footgun T-05-06-SMTPRATE:** If you leave "Confirm email" ON while using the default Supabase SMTP, smoke-test signups past the second attempt will fail with `over_email_send_rate_limit`. The proper long-term fix (if email confirmation is actually desired) is to configure custom SMTP (Resend, Postmark, etc.) under Project Settings → Auth → SMTP Settings. For the current personal-MVP posture, OFF is the accepted trade-off — documented in 05-06-SUMMARY.md as a deferred decision.

## 1. Link Supabase project

```bash
supabase link --project-ref wdntzsckjaoqodsyscns
```

Expected: prompt for the DB password (retrieve from Supabase Dashboard → Project Settings → Database → "Database password" — reset if forgotten). On success: `Finished supabase link.`

After a successful link, the CLI caches the pooler URL at `supabase/.temp/pooler-url`. You will reuse this in Step 2b.

## 2. Apply migrations

### 2a. Apply the shadow-user trigger migration (Supabase-managed)

```bash
supabase db push --linked
```

Expected: the CLI prints `Applying migration 20260413000000_sync_auth_users.sql` and finishes with no errors. On first run it also creates `supabase_migrations.schema_migrations`.

### 2b. Generate and apply the Drizzle schema migration

**Footgun T-05-06-IPV6:** The "Direct Connection" host (`db.<project-ref>.supabase.co:5432`) advertised in the Supabase dashboard is **IPv6-only**. On IPv4-only home ISPs (most of them), `drizzle-kit generate` and `drizzle-kit migrate` will fail to resolve this host. Use the **session-mode pooler URL** instead — it is IPv4-reachable and the session mode (port 5432 on the pooler, not 6543) is compatible with `drizzle-kit migrate`'s session-level operations.

Retrieve the session-mode pooler URL from one of:

- `cat supabase/.temp/pooler-url` (cached after `supabase link` in Step 1 — preferred)
- Supabase Dashboard → Project Settings → Database → Connection string → **Session mode** (port 5432 via `aws-0-<region>.pooler.supabase.com`)

The pooler username has the project ref appended: `postgres.wdntzsckjaoqodsyscns` (not bare `postgres`).

Shape:

```
postgresql://postgres.wdntzsckjaoqodsyscns:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Do NOT use the `db.wdntzsckjaoqodsyscns.supabase.co:5432` host — it will fail with DNS resolution errors on IPv4 networks.
Do NOT use the port 6543 (transaction-mode) pooler URL — it breaks prepared statements and `drizzle-kit migrate` will fail or silently corrupt state.

```bash
# One-time: generate the initial migration from src/db/schema.ts into ./drizzle/
DATABASE_URL="postgresql://postgres.wdntzsckjaoqodsyscns:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
  npx drizzle-kit generate
```

Expected: creates `./drizzle/0000_<random_name>.sql` and `./drizzle/meta/_journal.json`. Commit these files to git before proceeding.

```bash
# Apply the generated migrations to prod
DATABASE_URL="postgresql://postgres.wdntzsckjaoqodsyscns:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
  npx drizzle-kit migrate
```

Expected: drizzle logs each migration as applied; final message `[✓] migrations applied successfully!`. A `drizzle.__drizzle_migrations` table is created in the DB.

### 2c. Verify migrate state

`drizzle-kit migrate` has a known failure mode where it creates the tables but leaves `drizzle.__drizzle_migrations` empty (zero rows). This state is silently broken: re-running `migrate` will error on existing tables, and the schema is un-versioned.

Verify the migrations table is populated:

```bash
DATABASE_URL="<same session-mode pooler URL>" \
  npx drizzle-kit studio
# or, with psql installed:
psql "<same session-mode pooler URL>" -c "select count(*) from drizzle.__drizzle_migrations;"
```

Expected: count ≥ 1.

**If the count is 0** (tables exist but no migration row was recorded), wipe and re-migrate:

```sql
-- connect via psql "<session-mode pooler URL>"
drop table if exists public.watches cascade;
drop table if exists public.user_preferences cascade;
drop table if exists public.users cascade;
drop schema if exists drizzle cascade;
```

Then re-run `npx drizzle-kit migrate`. Verify again. On a successful second pass you should see `[✓] migrations applied successfully!` and a non-zero row count in `drizzle.__drizzle_migrations`.

**Footgun T-05-06-EMPTYMIGRATE:** If you skip this verification and the migrations table is empty, the next deploy that tries to migrate will fail on "relation already exists" and you will chase a ghost. Always verify the count before moving on.

## 3. Set Vercel env vars

### 3a. Retrieve values from Supabase dashboard

- `NEXT_PUBLIC_SUPABASE_URL`: Project Settings → API → **Project URL** (shape: `https://wdntzsckjaoqodsyscns.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Project Settings → API → **anon public** (JWT starting with `eyJ...`)
- `DATABASE_URL` (for Vercel runtime): the same session-mode pooler URL used in Step 2b (port 5432 via `aws-0-<region>.pooler.supabase.com`, username `postgres.wdntzsckjaoqodsyscns`)
- `ANTHROPIC_API_KEY`: your Anthropic console key (starts with `sk-ant-...`). Required by `src/lib/extractors/llm.ts` — URL imports silently degrade or fail without it.

### 3b. Back up `.env.local` before running `vercel link`

**Footgun T-05-06-VERCELLINK:** Recent Vercel CLI versions chain an `env pull` into `vercel link`, which **overwrites `.env.local`** with just `VERCEL_OIDC_TOKEN`, blowing away `ANTHROPIC_API_KEY`, local Supabase vars, and `DATABASE_URL`. Back it up first, restore after.

```bash
cp .env.local .env.local.backup
```

### 3c. Install + authenticate Vercel CLI

```bash
npm i -g vercel           # skip if already installed
vercel login              # complete browser flow
vercel link               # select the existing horlo.app project
```

Expected: `.vercel/project.json` created in the repo root. Do NOT commit this file (already in `.gitignore`).

Restore `.env.local` immediately:

```bash
cp .env.local.backup .env.local
rm .env.local.backup
```

### 3d. Add env vars to the production environment

Each command prompts for the value. You MUST pass `production` as the environment or the var lands in preview and `horlo.app` will not see it.

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# paste: https://wdntzsckjaoqodsyscns.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# paste the anon JWT

vercel env add DATABASE_URL production
# paste the session-mode pooler URL (port 5432, pooler.supabase.com host, username postgres.<project-ref>)

vercel env add ANTHROPIC_API_KEY production
# paste the Anthropic console key (sk-ant-...); mark sensitive: Y
```

Expected after each: `Added Environment Variable <NAME> to Project horlo [X ms]`.

**Vercel env var scope footgun:** `vercel env add FOO` without `production` puts the var in preview+development scope only. `horlo.app` runs from the production scope. Always append `production`.

### 3e. Trigger a redeploy so the new env vars take effect

```bash
vercel --prod
```

Expected: a new deployment builds and promotes to production. Env vars set AFTER the last deployment are NOT applied retroactively — a redeploy is required. If you add `ANTHROPIC_API_KEY` separately after the initial redeploy (as happened during the verified run), you must redeploy again for URL extraction to start working.

## 4. Smoke test

**Email footgun:** Production Supabase validates signup emails via MX lookup. Fake domains like `test@isdfjivdfj.com` return `email_address_invalid`. Use a real-domain email — Gmail `+suffix` aliases work perfectly (e.g. `youremail+horlo-smoke1@gmail.com`, `youremail+horlo-smoke2@gmail.com`, etc.). Each `+suffix` is treated as a distinct identity by Supabase Auth but all land in your real inbox.

1. Open `https://horlo.app` in a private/incognito browser window. Should redirect to `/login`.
2. Click **Sign up**. Enter a real-domain email with a unique `+suffix` (e.g., `youremail+horlo-smoke1@gmail.com`) and a password.
3. Submit. Should redirect to `/` (empty collection view) with the UserMenu visible in the header.
4. Click the UserMenu → **Log out**. Should redirect to `/login`.
5. Open Supabase Dashboard → Authentication → Users. The test user should be listed.
6. Select the test user → **Delete user** to clean up.

If any step fails, see Rollback below.

## 5. Rollback

### drizzle-kit migrate failed partway

- Connect with `psql "<session-mode pooler URL from Step 2b>"`.
- Inspect: `SELECT * FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 5;`
- If the last row corresponds to a half-applied migration: `DELETE FROM drizzle.__drizzle_migrations WHERE id = <id>;`
- Fix the schema, rerun `drizzle-kit generate` then `drizzle-kit migrate`.

### drizzle-kit migrate ran but `__drizzle_migrations` is empty

- See Step 2c. Wipe `public.watches`, `public.user_preferences`, `public.users`, and the `drizzle` schema via psql, then re-run `npx drizzle-kit migrate`.

### supabase db push failed on the trigger migration

- The trigger migration uses `CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS` — idempotent. Safe to rerun `supabase db push --linked`.
- If it keeps failing, inspect: Supabase Dashboard → Database → Logs for the SQL error.

### Vercel env var wrong / smoke test signup fails with 500

- `vercel env ls production` — confirm all four vars present with correct values (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL, ANTHROPIC_API_KEY).
- `vercel env rm <NAME> production` then re-add with correct value.
- Trigger another `vercel --prod` redeploy.
- Check Vercel → Deployments → latest → Runtime Logs for the actual error.

### Signup fails with `email_address_invalid`

- You used a fake domain. Switch to a real-domain email with a `+suffix` alias (see Step 4).

### Signup fails with `over_email_send_rate_limit`

- Email confirmation is still ON and you tripped Supabase's shared SMTP cap of 2 emails/hour. Go back to Step 0 and disable **Confirm email** under Authentication → Sign In/Providers → Email. Wait ~1 hour or use a fresh Supabase project if you need to retest immediately.

### `.env.local` got clobbered by `vercel link`

- If you backed it up per Step 3b: `cp .env.local.backup .env.local`
- If not: restore from git history (`git show HEAD:.env.local` won't work since `.env.local` is gitignored) or recreate from `.env.example` plus your Supabase/Anthropic keys.

### Signup gets stuck "check your email"

- Supabase Dashboard → Authentication → Sign In/Providers → Email → confirm **Confirm email** is OFF (see Step 0).

### Need to roll back the deployment entirely

- Vercel Dashboard → Deployments → find the previous good deploy → **Promote to Production**.

---
phase: "04"
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - .env.example
  - src/components/ui/dropdown-menu.tsx
  - supabase/config.toml
  - supabase/migrations/20260413000000_sync_auth_users.sql
  - tests/helpers/mock-supabase.ts
  - tests/fixtures/users.ts
  - tests/auth.test.ts
  - tests/proxy.test.ts
  - tests/actions/auth.test.ts
  - tests/actions/watches.test.ts
  - tests/actions/preferences.test.ts
  - tests/data/isolation.test.ts
  - tests/api/extract-watch-auth.test.ts
autonomous: false
requirements:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
user_setup:
  - service: supabase-cli
    why: "Local Supabase stack (Postgres + GoTrue + Inbucket SMTP) must run for Phase 4 auth + password-reset email flows"
    dashboard_config:
      - task: "Install Supabase CLI if not present (brew install supabase/tap/supabase)"
        location: "Local machine"
      - task: "After `supabase start`, copy anon key + URL into .env.local"
        location: "Terminal output of `supabase status`"
must_haves:
  truths:
    - "@supabase/ssr and @supabase/supabase-js are installed at the versions pinned in research (0.10.2 / 2.103.0)"
    - "shadcn DropdownMenu primitive is installed at src/components/ui/dropdown-menu.tsx"
    - "supabase/ directory exists with config.toml and auth.email.enable_confirmations = false"
    - "A shadow-user trigger migration exists under supabase/migrations/ and applies cleanly"
    - ".env.example documents NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    - "Failing-stub test files exist for every Phase 4 requirement (AUTH-01..04) so later waves have automated verify targets"
    - "A multi-user test fixture seeds two real Supabase Auth users so IDOR tests in Plan 04 / 06 can run"
  artifacts:
    - path: "package.json"
      provides: "Installed @supabase/ssr@0.10.2 + @supabase/supabase-js@2.103.0"
      contains: "@supabase/ssr"
    - path: "src/components/ui/dropdown-menu.tsx"
      provides: "shadcn DropdownMenu primitive for header UserMenu"
    - path: "supabase/config.toml"
      provides: "Local Supabase stack config with email confirmations disabled"
      contains: "enable_confirmations = false"
    - path: "supabase/migrations/20260413000000_sync_auth_users.sql"
      provides: "Postgres trigger: auth.users INSERT -> public.users upsert"
      contains: "on_auth_user_created"
    - path: ".env.example"
      provides: "Documented Supabase env vars"
      contains: "NEXT_PUBLIC_SUPABASE_URL"
    - path: "tests/helpers/mock-supabase.ts"
      provides: "Shared vi.mock helper for createSupabaseServerClient in unit tests"
    - path: "tests/fixtures/users.ts"
      provides: "Multi-user seed helper: creates two real Supabase Auth users for IDOR tests"
    - path: "tests/auth.test.ts"
      provides: "Failing stubs for getCurrentUser + UnauthorizedError"
    - path: "tests/proxy.test.ts"
      provides: "Failing stubs for proxy matcher + redirect behavior"
    - path: "tests/actions/auth.test.ts"
      provides: "Failing stub for logout Server Action"
    - path: "tests/actions/watches.test.ts"
      provides: "Failing stub for watches Server Action auth-error paths"
    - path: "tests/actions/preferences.test.ts"
      provides: "Failing stub for preferences Server Action auth-error paths"
    - path: "tests/data/isolation.test.ts"
      provides: "Failing stub for IDOR integration test"
    - path: "tests/api/extract-watch-auth.test.ts"
      provides: "Failing stub for /api/extract-watch 401 gate"
  key_links:
    - from: "supabase/migrations/20260413000000_sync_auth_users.sql"
      to: "public.users FK on watches.userId / user_preferences.userId"
      via: "security definer trigger on auth.users INSERT"
      pattern: "on_auth_user_created"
    - from: "tests/fixtures/users.ts"
      to: "local Supabase Auth API"
      via: "supabase.auth.admin.createUser"
      pattern: "admin\\.createUser"
---

<objective>
Stand up every piece of Phase 4 infrastructure BEFORE any application code is written: install the Supabase SDKs + shadcn DropdownMenu primitive, verify the local Supabase CLI stack is running with email confirmations disabled, land the shadow-user trigger migration so FK constraints from watches.userId / user_preferences.userId resolve on first sign-up, document the new env vars, and scaffold every failing test stub the downstream waves need.

Purpose: later waves must be able to run `npx vitest run tests/<file>.test.ts` for every task they touch — that's impossible if the test files don't exist yet. This plan makes the dependency fixture real.
Output: Installed deps, running Supabase stack, shadow-user trigger applied, failing red test stubs for every AUTH-01..04 behavior.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-authentication/04-CONTEXT.md
@.planning/phases/04-authentication/04-RESEARCH.md
@.planning/phases/04-authentication/04-VALIDATION.md
@CLAUDE.md
@AGENTS.md
@node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
@node_modules/next/dist/docs/01-app/02-guides/authentication.md
@.env.example
@package.json
@tests/setup.ts

<interfaces>
<!-- Target versions pinned in RESEARCH.md Q10 (verified 2026-04-12 via npm view). -->
Package versions:
- @supabase/ssr: 0.10.2
- @supabase/supabase-js: 2.103.0

<!-- Shadow user trigger SQL verbatim from RESEARCH.md Q7 — copy, do not rewrite. -->
SQL for migration:
```sql
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();
```

<!-- From src/db/schema.ts (Phase 3) -->
public.users table has columns: id uuid PK, email text
watches.userId and user_preferences.userId FK to public.users.id ON DELETE CASCADE
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Supabase SDKs + shadcn DropdownMenu + update .env.example</name>
  <files>package.json, package-lock.json, src/components/ui/dropdown-menu.tsx, .env.example</files>
  <read_first>
    - package.json (to see current deps and confirm @supabase/* is not already present)
    - .env.example (to see current documented env vars and append — do not overwrite DATABASE_URL / ANTHROPIC_API_KEY blocks)
    - src/components/ui/ (directory listing — confirm dropdown-menu.tsx does not already exist)
    - .planning/phases/04-authentication/04-RESEARCH.md (Q10 for exact versions, Q9 for shadcn command)
  </read_first>
  <action>
Run in order:

1. `npm install @supabase/ssr@0.10.2 @supabase/supabase-js@2.103.0`
   - These are runtime dependencies (NOT devDependencies) — the app code imports them.
   - Verify via `grep -A1 '"@supabase/ssr"' package.json` afterward.

2. `npx shadcn@latest add dropdown-menu`
   - Answer `y` to any overwrite prompts ONLY for dropdown-menu (should be none — file does not currently exist).
   - Confirms src/components/ui/dropdown-menu.tsx is created.

3. Append to `.env.example` (do NOT delete existing entries):
   ```
   # Supabase Auth (required for Phase 4)
   # Local dev: `supabase start` prints these values via `supabase status`
   # Default local URL is http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi... # from `supabase status`
   ```

Do NOT run `supabase start` in this task — that's Task 2.
  </action>
  <verify>
    <automated>node -e "const p=require('./package.json');if(!p.dependencies['@supabase/ssr']||!p.dependencies['@supabase/supabase-js'])process.exit(1);console.log('supabase deps ok')" &amp;&amp; test -f src/components/ui/dropdown-menu.tsx &amp;&amp; grep -q NEXT_PUBLIC_SUPABASE_URL .env.example &amp;&amp; grep -q NEXT_PUBLIC_SUPABASE_ANON_KEY .env.example</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` dependencies section contains `"@supabase/ssr": "^0.10.2"` (or `0.10.2`)
    - `package.json` dependencies section contains `"@supabase/supabase-js": "^2.103.0"` (or `2.103.0`)
    - `src/components/ui/dropdown-menu.tsx` exists AND contains `DropdownMenuTrigger` export
    - `.env.example` still contains the prior `ANTHROPIC_API_KEY` and `DATABASE_URL` lines (appended, not overwritten)
    - `.env.example` contains string `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
    - `.env.example` contains string `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
    - `package-lock.json` lockfileVersion is unchanged (still 3)
  </acceptance_criteria>
  <done>Both Supabase packages installed at pinned versions, shadcn DropdownMenu primitive present, .env.example documents the two Supabase env vars without clobbering prior entries.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Initialize and start local Supabase stack (HUMAN REQUIRED — CLI install + port binding)</name>
  <files>supabase/config.toml, supabase/migrations/20260413000000_sync_auth_users.sql</files>
  <read_first>
    - .planning/phases/04-authentication/04-RESEARCH.md (Q7 for the trigger SQL, Q10 for the init chain, Risk #7 for why the supabase/ directory is currently missing)
    - .planning/phases/04-authentication/04-CONTEXT.md (D-09 — email confirmation must be disabled)
    - supabase/ (directory — verify it does not already exist; if Phase 3 secretly left one, read config.toml first)
  </read_first>
  <what-built>
A running local Supabase stack (Postgres + GoTrue + Kong + Inbucket SMTP) with email confirmations disabled, plus a shadow-user trigger migration applied so FK constraints from Phase 3 resolve when Supabase Auth creates a user.
  </what-built>
  <action>
CLAUDE STEPS (automate first — only defer to human on error):

1. Check if `supabase/` directory already exists: `ls supabase 2>/dev/null`.
2. If NOT: run `npx supabase init` (creates supabase/config.toml + supabase/migrations/).
   - If Supabase CLI is not installed globally, npx will pull it — should work.
   - If it fails (e.g., Docker not running, port conflict on 54321/54322/54323/54324), STOP and surface the error in the checkpoint block below.
3. Edit `supabase/config.toml`:
   - Find the `[auth.email]` section.
   - Set `enable_confirmations = false` (D-09).
   - Save.
4. Create `supabase/migrations/20260413000000_sync_auth_users.sql` with the VERBATIM SQL from RESEARCH.md Q7:
   ```sql
   -- supabase/migrations/20260413000000_sync_auth_users.sql
   -- Shadow-user sync: mirror auth.users -> public.users on INSERT
   -- so Phase 3 FKs (watches.userId, user_preferences.userId) resolve on first sign-up.
   create or replace function public.handle_new_auth_user()
   returns trigger
   language plpgsql
   security definer
   set search_path = public
   as $$
   begin
     insert into public.users (id, email)
     values (new.id, new.email)
     on conflict (id) do update set email = excluded.email;
     return new;
   end;
   $$;

   drop trigger if exists on_auth_user_created on auth.users;
   create trigger on_auth_user_created
     after insert on auth.users
     for each row
     execute function public.handle_new_auth_user();
   ```
5. Run `npx supabase start` (pulls Docker images on first run — may take several minutes).
6. Run `npx supabase status` and capture the `API URL` and `anon key`.
7. Run `npx supabase db reset` OR `npx supabase migration up` to apply the new migration into the running stack.
8. Verify the trigger exists: `npx supabase db dump --schema public,auth | grep on_auth_user_created` OR `psql $(supabase status -o env | grep DB_URL | cut -d= -f2-) -c "\\df public.handle_new_auth_user"`.

HUMAN DECISION POINTS:

- If Docker is not installed or running, the user must install Docker Desktop or OrbStack before Claude can proceed.
- If `supabase init` fails because the CLI is not available under npx, the user must `brew install supabase/tap/supabase` (macOS) or equivalent.
- The anon key and URL from `supabase status` must be copied into `.env.local` (user owns this — do not write `.env.local` from Claude).
- If Phase 3 was running against a DIFFERENT Postgres (not the Supabase CLI one), the user must decide whether to `drizzle-kit push` the Phase 3 schema against the new local Supabase DB, or point DATABASE_URL at the new stack. Research Assumption A2 flags this.
  </action>
  <how-to-verify>
1. Run `npx supabase status` — expect output showing `API URL: http://127.0.0.1:54321` and a non-empty `anon key`.
2. Run `ls supabase/migrations/` — expect `20260413000000_sync_auth_users.sql`.
3. Run `grep -F "enable_confirmations = false" supabase/config.toml` — expect a match in the `[auth.email]` section.
4. Verify trigger is applied: `psql "$(npx supabase status -o env 2>/dev/null | grep '^DB_URL=' | cut -d= -f2-)" -c "select tgname from pg_trigger where tgname = 'on_auth_user_created'"` — expect a row.
5. Confirm `.env.local` (user-owned) now has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` matching `supabase status`.
6. Confirm Phase 3 DATABASE_URL still resolves against a database containing `public.users`, `public.watches`, `public.user_preferences` — if not, re-run `drizzle-kit push` against the new stack per Assumption A2.
  </how-to-verify>
  <acceptance_criteria>
    - Directory `supabase/` exists at repo root
    - File `supabase/config.toml` contains literal string `enable_confirmations = false`
    - File `supabase/migrations/20260413000000_sync_auth_users.sql` exists AND contains string `on_auth_user_created`
    - `npx supabase status` exits 0 and prints `API URL` line
    - Trigger `on_auth_user_created` is present in the running local Postgres (verifiable via `pg_trigger` query)
    - User confirms `.env.local` contains the anon key + URL
    - `public.users`, `public.watches`, `public.user_preferences` tables still exist in the local DB (Phase 3 schema survived)
  </acceptance_criteria>
  <verify>
    <automated>npx supabase status &amp;&amp; test -f supabase/config.toml &amp;&amp; test -f supabase/migrations/20260413000000_sync_auth_users.sql</automated>
  </verify>
  <resume-signal>Type "approved" once Supabase stack is running, migration applied, and .env.local populated. If any step failed, describe the error.</resume-signal>
  <done>Local Supabase stack running with email confirmations disabled, shadow-user trigger applied, Phase 3 schema intact in the local DB, user-owned .env.local populated.</done>
</task>

<task type="auto">
  <name>Task 3: Scaffold multi-user test fixture + shared mock helper + failing test stubs</name>
  <files>tests/helpers/mock-supabase.ts, tests/fixtures/users.ts, tests/auth.test.ts, tests/proxy.test.ts, tests/actions/auth.test.ts, tests/actions/watches.test.ts, tests/actions/preferences.test.ts, tests/data/isolation.test.ts, tests/api/extract-watch-auth.test.ts</files>
  <read_first>
    - tests/setup.ts (global vitest setup — understand what's already mocked)
    - tests/similarity.test.ts (existing test style — match naming/structure)
    - .planning/phases/04-authentication/04-RESEARCH.md ("Phase Requirements → Test Map" section for exact test names per requirement)
    - .planning/phases/04-authentication/04-VALIDATION.md (per-task map to populate)
    - vitest.config.ts (confirm test file globs)
  </read_first>
  <action>
Create each file below. Every test body should contain a single `it.todo('...')` OR an `it(...)` that asserts `expect(true).toBe(false)` so the test file is discoverable by vitest and shows RED in the run. Later plans REPLACE these stubs with real assertions; DO NOT implement real behavior here.

1. `tests/helpers/mock-supabase.ts`:
```ts
import { vi } from 'vitest'

/**
 * Shared helper to mock createSupabaseServerClient for unit tests.
 * Later plans import and extend this. Wave 0 just provides the module.
 */
export function mockSupabaseServerClient(overrides: {
  user?: { id: string; email: string } | null
  error?: Error | null
} = {}) {
  const { user = null, error = null } = overrides
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      verifyOtp: vi.fn(),
    },
  }
}
```

2. `tests/fixtures/users.ts`:
```ts
import { createClient } from '@supabase/supabase-js'

/**
 * Seed helper: creates two real Supabase Auth users against the LOCAL stack
 * for IDOR integration tests. Uses the service_role key via supabase.auth.admin.
 *
 * Call from a beforeAll() in integration suites. Not used by unit tests.
 *
 * Env vars expected at test time:
 *   NEXT_PUBLIC_SUPABASE_URL  (from supabase status)
 *   SUPABASE_SERVICE_ROLE_KEY (from supabase status — NOT the anon key)
 */
export async function seedTwoUsers() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'seedTwoUsers requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — run against local supabase stack',
    )
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const userA = await admin.auth.admin.createUser({
    email: `test-a-${Date.now()}@horlo.test`,
    password: 'test-password-A',
    email_confirm: true,
  })
  const userB = await admin.auth.admin.createUser({
    email: `test-b-${Date.now()}@horlo.test`,
    password: 'test-password-B',
    email_confirm: true,
  })
  if (userA.error || userB.error) {
    throw new Error(`seedTwoUsers failed: ${userA.error?.message ?? userB.error?.message}`)
  }
  return {
    userA: { id: userA.data.user!.id, email: userA.data.user!.email! },
    userB: { id: userB.data.user!.id, email: userB.data.user!.email! },
    cleanup: async () => {
      await admin.auth.admin.deleteUser(userA.data.user!.id)
      await admin.auth.admin.deleteUser(userB.data.user!.id)
    },
  }
}
```

3. `tests/auth.test.ts`:
```ts
import { describe, it } from 'vitest'

describe('getCurrentUser (src/lib/auth.ts) — AUTH-01, AUTH-02', () => {
  it.todo('returns { id, email } when supabase.auth.getUser returns a user')
  it.todo('throws UnauthorizedError when supabase.auth.getUser returns null user')
  it.todo('throws UnauthorizedError when supabase.auth.getUser returns an error')
  it.todo('UnauthorizedError is instanceof Error and has name "UnauthorizedError"')
})
```

4. `tests/proxy.test.ts`:
```ts
import { describe, it } from 'vitest'

describe('proxy.ts — AUTH-02', () => {
  it.todo('redirects unauthenticated request on protected path to /login?next=<path>')
  it.todo('preserves search params in the next query')
  it.todo('allows unauthenticated request on /login')
  it.todo('allows unauthenticated request on /signup')
  it.todo('allows unauthenticated request on /forgot-password')
  it.todo('allows unauthenticated request on /reset-password')
  it.todo('allows unauthenticated request on /auth/callback')
  it.todo('lets authenticated request through with refreshed Set-Cookie headers')
})
```

5. `tests/actions/auth.test.ts`:
```ts
import { describe, it } from 'vitest'

describe('logout Server Action — AUTH-01', () => {
  it.todo('calls supabase.auth.signOut and redirects to /login')
})
```

6. `tests/actions/watches.test.ts`:
```ts
import { describe, it } from 'vitest'

describe('watches Server Actions auth gate — AUTH-02', () => {
  it.todo('addWatch returns { success:false, error:"Not authenticated" } when getCurrentUser throws')
  it.todo('editWatch returns { success:false, error:"Not authenticated" } when getCurrentUser throws')
  it.todo('removeWatch returns { success:false, error:"Not authenticated" } when getCurrentUser throws')
  it.todo('addWatch calls DAL.createWatch with the session user id (not a client-supplied id)')
})
```

7. `tests/actions/preferences.test.ts`:
```ts
import { describe, it } from 'vitest'

describe('preferences Server Actions auth gate — AUTH-02', () => {
  it.todo('savePreferences returns { success:false, error:"Not authenticated" } when getCurrentUser throws')
  it.todo('savePreferences calls DAL.upsertPreferences with session user id')
})
```

8. `tests/data/isolation.test.ts`:
```ts
import { describe, it } from 'vitest'

describe('IDOR isolation — AUTH-03', () => {
  it.todo('editWatch(otherUsersWatchId, data) returns { success:false, error:"Not found" }')
  it.todo('removeWatch(otherUsersWatchId) returns { success:false, error:"Not found" }')
  it.todo('User A cannot read User B preferences via savePreferences upsert path')
})
```

9. `tests/api/extract-watch-auth.test.ts`:
```ts
import { describe, it } from 'vitest'

describe('POST /api/extract-watch auth gate — AUTH-04', () => {
  it.todo('returns 401 { error: "Unauthorized" } when session is missing')
  it.todo('returns 401 before running SSRF validation (auth check runs first)')
  it.todo('proceeds to SSRF check when session is present')
})
```

After creating all files, update `.planning/phases/04-authentication/04-VALIDATION.md`:
- Set `nyquist_compliant: true` in frontmatter.
- Set `wave_0_complete: true` in frontmatter.
- Populate the per-task map with one row per test file using the command `npx vitest run tests/<file>.test.ts`.
  </action>
  <verify>
    <automated>npx vitest run --reporter=dot tests/auth.test.ts tests/proxy.test.ts tests/actions/auth.test.ts tests/actions/watches.test.ts tests/actions/preferences.test.ts tests/data/isolation.test.ts tests/api/extract-watch-auth.test.ts 2>&amp;1 | grep -E "Tests|Test Files" &amp;&amp; test -f tests/helpers/mock-supabase.ts &amp;&amp; test -f tests/fixtures/users.ts</automated>
  </verify>
  <acceptance_criteria>
    - All 9 files listed in `<files>` exist
    - `npx vitest run tests/auth.test.ts` exits 0 (todos are not failures) AND reports at least 4 todo/skipped tests
    - `npx vitest run tests/proxy.test.ts` reports at least 8 todo tests
    - `tests/helpers/mock-supabase.ts` exports a function named `mockSupabaseServerClient`
    - `tests/fixtures/users.ts` exports a function named `seedTwoUsers`
    - `.planning/phases/04-authentication/04-VALIDATION.md` frontmatter has `nyquist_compliant: true` and `wave_0_complete: true`
    - `.planning/phases/04-authentication/04-VALIDATION.md` per-task map has at least 7 rows (one per new test file)
    - `npm test` (full suite) still exits 0 — todos don't break green
  </acceptance_criteria>
  <done>Every downstream Phase 4 task has a pre-existing test file to extend with real assertions; VALIDATION.md is marked nyquist-compliant with the full per-task map.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| developer machine → local Supabase stack | Shadow-user trigger runs with `security definer` — if the SQL is mis-copied, the trigger could run as a superuser in prod. Mitigated by verbatim copy from RESEARCH.md Q7 and `set search_path = public`. |
| test fixture → local auth.admin API | Uses service_role key; must never leak into app bundles. Mitigated by living under `tests/` (not `src/`) and env-var-gated. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-4-01 | Tampering | supabase/migrations/*.sql | mitigate | Copy the exact SQL from RESEARCH.md Q7 with `security definer` + `set search_path = public` (prevents search-path hijack escalation). Verify via `pg_trigger` query in acceptance criteria. |
| T-4-03 | Information disclosure | tests/fixtures/users.ts | mitigate | Fixture reads `SUPABASE_SERVICE_ROLE_KEY` from env at runtime only; file never hardcodes it. Lives under `tests/` which is excluded from Next.js bundle. |
| T-4-06 | Elevation of privilege | Postgres trigger function `public.handle_new_auth_user` | accept | Trigger is idempotent (`on conflict do update`), runs in the same transaction as `auth.users` insert, cannot be invoked by app code directly. Standard Supabase pattern. |
</threat_model>

<verification>
- `npm test` exits 0 (all existing tests still green, new stub files reported as todo/skipped)
- `supabase status` exits 0 and shows the local stack running
- `psql` against the local DB shows the `on_auth_user_created` trigger
- `.env.example` diff is additive-only (no existing entries removed)
- `src/components/ui/dropdown-menu.tsx` imports `@radix-ui/react-dropdown-menu` or `@base-ui/react` per shadcn registry
</verification>

<success_criteria>
Wave 0 is complete when every downstream plan (02, 03, 04, 05, 06) has:
(a) installed Supabase SDKs to import from,
(b) a running Supabase stack with auth enabled and email confirmations off,
(c) a shadow-user trigger so sign-up doesn't FK-violate,
(d) a shadcn DropdownMenu primitive available to the header UserMenu,
(e) a pre-existing failing test file for every AUTH-01..04 behavior the later plans will implement,
(f) a multi-user fixture that Plan 04 / Plan 06 IDOR tests can call.

When all six are true, Phase 4 Wave 0 is green and later waves can execute in parallel.
</success_criteria>

<output>
After completion, create `.planning/phases/04-authentication/04-01-SUMMARY.md`.
</output>

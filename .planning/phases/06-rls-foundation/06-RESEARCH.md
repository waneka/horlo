# Phase 6: RLS Foundation - Research

**Researched:** 2026-04-19
**Domain:** PostgreSQL Row Level Security via Supabase on three existing tables (`public.users`, `public.watches`, `public.user_preferences`)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Drizzle connects via `DATABASE_URL` (direct Postgres, service-role equivalent). RLS is defense-in-depth — the primary enforcement layer for anon/JWT-key access via PostgREST. DAL `WHERE userId = currentUser.id` clauses remain the primary enforcement for Server Actions and DAL functions.

**D-02:** Two-layer pattern carries forward to Phase 7+ social tables.

**D-03:** Separate policies per operation — individual SELECT, INSERT, UPDATE, DELETE policies on each table. Descriptive naming: `watches_select_own`, `watches_update_own`, etc.

**D-04:** Every UPDATE policy must have both `USING` and `WITH CHECK` clauses using the `(SELECT auth.uid())` subquery pattern — no bare `auth.uid()` calls.

**D-05:** Verification via Supabase User Impersonation tool (not SQL Editor, which bypasses RLS). Verify: User A can CRUD own data; User A cannot see User B's data; existing app behavior unchanged.

**D-06:** No automated CI RLS tests in this phase — manual verification sufficient for 3 tables.

**D-07:** Phase 6 establishes RLS pattern on existing tables only. DATA-07's policies for social tables happen in Phase 7 when those tables are created.

**D-08:** Enable RLS and create all policies in the same migration transaction. Never enable RLS without policies.

### Claude's Discretion

- Policy naming convention (as long as it's descriptive and consistent)
- Whether to use a single migration file or split by table
- Drizzle migration tooling details (drizzle-kit generate vs hand-written SQL for RLS)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | RLS policies enabled on all existing tables (users, watches, user_preferences) with `(SELECT auth.uid())` performance pattern | Full policy SQL documented below; migration strategy confirmed; verification method specified |
| DATA-07 | RLS policies on all new social tables enforcing ownership for writes and privacy settings for reads | Phase 6 scope is pattern establishment only — DATA-07 social table policies execute in Phase 7 when tables are created |

</phase_requirements>

---

## Summary

Phase 6 is a pure SQL infrastructure change: enable Row Level Security on three existing production tables and create the minimum required policies so existing single-user behavior is preserved while PostgREST/anon-key access is blocked for cross-user data. No schema changes, no UI changes, no DAL changes.

The Drizzle connection (`DATABASE_URL`) connects as the service role or a superuser, which bypasses RLS by design — this means zero application code changes are needed. The DAL `WHERE userId = currentUser.id` clauses already enforce isolation for all Server Actions; RLS adds a second enforcement layer that blocks direct PostgREST calls carrying a user JWT.

The critical constraint is D-08: RLS must be enabled and all policies for a table must be created in the same migration. If RLS is enabled without policies, Postgres applies "deny all by default" and every user's data goes invisible. The migration file for this phase must be structured as an atomic block.

**Primary recommendation:** Deliver a single hand-written SQL migration file under `supabase/migrations/` (not a Drizzle-generated migration, because Drizzle does not natively support `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` or `CREATE POLICY` statements). Apply via `supabase db push --linked`. Verify with Supabase User Impersonation before considering the phase done.

---

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| PostgreSQL RLS | Postgres 17 (project) | Row-level access control enforced at DB engine | Native Postgres feature; Supabase Auth JWT is available as `auth.uid()` in policy expressions |
| Supabase CLI | 2.90.0 [VERIFIED: local] | `supabase db push --linked` applies SQL migrations to the linked Supabase project | Established workflow — already used in `docs/deploy-db-setup.md` for the initial schema migration |
| Supabase Dashboard User Impersonation | N/A | Post-deploy verification that RLS blocks cross-user reads | The only correct way to test RLS; SQL Editor runs as `postgres` superuser and bypasses RLS |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| drizzle-kit | 0.31.10 [VERIFIED: local] | Schema generation and migration tracking | NOT used for RLS SQL itself — Drizzle does not generate `CREATE POLICY` or `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Use for any future schema additions alongside this migration. |
| psql | Any | Ad-hoc verification queries (`SELECT relrowsecurity FROM pg_class`) | Useful for confirming RLS is enabled; covered in phase success criteria |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written SQL migration | Drizzle-kit generated migration | Drizzle does not support RLS DDL. Any attempt to add RLS via schema.ts results in unrecognized output. Hand-written SQL under `supabase/migrations/` is the correct path. [VERIFIED: codebase — schema.ts and drizzle.config.ts contain no RLS support] |
| Single migration file (recommended) | Separate files per table | One file is simpler to review and apply atomically. Three tables, four policies each = 12 policy statements. Fits comfortably in a single file. |

**Installation:** No new packages needed. This phase is pure SQL.

---

## Architecture Patterns

### Migration File Location

```
supabase/
└── migrations/
    ├── 20260413000000_sync_auth_users.sql   (existing — auth trigger)
    └── 20260420000000_rls_existing_tables.sql  (NEW — Phase 6)
drizzle/
└── 0000_flaky_lenny_balinger.sql            (existing — table DDL, Drizzle-managed)
```

The `supabase/migrations/` directory is managed by `supabase db push --linked`. The `drizzle/` directory is managed by `drizzle-kit migrate`. These are separate migration systems coexisting in this project — confirmed by the existing split between `20260413000000_sync_auth_users.sql` (supabase) and `0000_flaky_lenny_balinger.sql` (drizzle). [VERIFIED: codebase]

### Pattern 1: Enable RLS + Policies in Same Statement Block

**What:** One migration file that for each table: enables RLS, then immediately creates all required policies.

**When to use:** Always, per D-08. Never split "enable RLS" from "create policies" into separate migrations or separate statements run at different times.

**Example:**
```sql
-- Source: Supabase RLS docs + PITFALLS.md [VERIFIED: codebase .planning/research/PITFALLS.md]

-- ============================================================
-- watches table
-- ============================================================
ALTER TABLE public.watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY watches_select_own
  ON public.watches
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY watches_insert_own
  ON public.watches
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY watches_update_own
  ON public.watches
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY watches_delete_own
  ON public.watches
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));
```

### Pattern 2: `(SELECT auth.uid())` Subquery Wrapping

**What:** Every occurrence of `auth.uid()` in a policy expression is wrapped in `(SELECT auth.uid())`.

**When to use:** Every policy, every table, every clause. No exceptions.

**Why:** Without the `SELECT` wrapper, Postgres evaluates `auth.uid()` once per row scanned. With the wrapper, Postgres hoists it to an `InitPlan` (evaluated once per query). On the `watches` table, a user with 300 watches triggers 300 function calls vs. 1. The Supabase Performance Advisor flags bare `auth.uid()` calls as lint `0003_auth_rls_initplan`. [VERIFIED: .planning/research/PITFALLS.md — Pitfall 2]

### Pattern 3: UPDATE Policy With Both USING and WITH CHECK

**What:** UPDATE policies always include both `USING` (which rows the user can update) and `WITH CHECK` (what the row state must look like after the update).

**When to use:** Every UPDATE policy on every table with an ownership column.

**Why:** Without `WITH CHECK`, a user can change `user_id` on their own watch to another user's ID, effectively planting data in another user's account. D-04 locks this as a requirement. [VERIFIED: CONTEXT.md D-04, PITFALLS.md Pitfall 4]

### Pattern 4: `users` Table — Owner-Only Access

**What:** The `public.users` table is a shadow table mirroring `auth.users`. A user should only be able to read and write their own row.

**Why:** `users` has only `id`, `email`, `created_at`, `updated_at`. User A has no reason to read User B's email. SELECT is scoped to own row.

```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own
  ON public.users
  FOR SELECT
  USING (id = (SELECT auth.uid()));

CREATE POLICY users_insert_own
  ON public.users
  FOR INSERT
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY users_update_own
  ON public.users
  FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY users_delete_own
  ON public.users
  FOR DELETE
  USING (id = (SELECT auth.uid()));
```

Note: The `public.handle_new_auth_user()` trigger function runs as `SECURITY DEFINER` (confirmed in `supabase/migrations/20260413000000_sync_auth_users.sql`). This means new user row creation from the auth trigger bypasses RLS. No special policy is needed to allow the trigger to insert. [VERIFIED: codebase]

### Pattern 5: Migration Applies via `supabase db push --linked`

**What:** The new migration file goes in `supabase/migrations/` with a timestamp prefix. Apply with `supabase db push --linked`.

**Why:** Consistent with existing project workflow. The auth trigger migration (`20260413000000_sync_auth_users.sql`) was applied this way. `drizzle-kit migrate` is NOT used for this file — it only manages the `drizzle/` directory. [VERIFIED: codebase, docs/deploy-db-setup.md]

**Application command:**
```bash
supabase db push --linked
```

**Verification command (after push):**
```sql
-- Run in Supabase SQL Editor (or psql) to confirm RLS is enabled on all three tables
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('users', 'watches', 'user_preferences')
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

Expected: `relrowsecurity = true` for all three rows.

### Anti-Patterns to Avoid

- **Bare `auth.uid()` without SELECT wrapper:** Causes per-row function evaluation. Grep all policy SQL before committing: `grep -n "auth.uid()" supabase/migrations/` — any result NOT preceded by `(SELECT ` is a bug.
- **UPDATE policy with USING but no WITH CHECK:** Silent data injection vulnerability. Every UPDATE block must have both clauses.
- **Enable RLS, then write policies separately:** Even a 1-second gap in production means existing users see an empty collection. D-08 forbids this.
- **Testing RLS in the SQL Editor:** The Supabase SQL Editor runs as `postgres` superuser, which bypasses RLS. It will always return data regardless of policy. Use User Impersonation in the Supabase Dashboard instead.
- **Using Drizzle-kit to generate RLS:** Drizzle's `pgTable()` API has no native support for `ENABLE ROW LEVEL SECURITY` or `CREATE POLICY`. Any attempt to add RLS via schema.ts will produce SQL that drizzle-kit does not generate. Write the migration file by hand. [VERIFIED: codebase — schema.ts contains no RLS declarations]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-request auth context in policies | Custom auth function | `auth.uid()` from Supabase's `auth` schema (available in all policy expressions) | Supabase Auth populates the JWT claims that `auth.uid()` reads; this is the canonical pattern |
| Cross-user access blocking | Application-layer checks alone | RLS policies | App-layer checks can be bypassed via direct Supabase API calls with the anon key; RLS cannot be bypassed from PostgREST |
| RLS policy testing | Custom test scripts | Supabase User Impersonation tool | The only interface that correctly impersonates a user's JWT claims for policy evaluation |

**Key insight:** RLS is about what the database enforces, not what the application enforces. The application (DAL WHERE clauses) remains as-is; RLS adds a second independent layer that cannot be bypassed by direct API callers.

---

## Complete Policy SQL

Full migration file content, ready to write to `supabase/migrations/20260420000000_rls_existing_tables.sql`:

```sql
-- Phase 6: Enable RLS on existing tables
-- Applied via: supabase db push --linked
--
-- CRITICAL: ALTER TABLE ENABLE and all CREATE POLICY statements
-- for each table are in the same transaction block (implicit in psql/supabase).
-- Never enable RLS without policies — existing data becomes invisible.
--
-- Connection notes:
-- - The Drizzle DATABASE_URL (service role / postgres user) bypasses RLS by design.
--   DAL functions continue to work unchanged.
-- - The Supabase anon key (PostgREST) is subject to these policies.
-- - The auth trigger (handle_new_auth_user) runs as SECURITY DEFINER and bypasses RLS.

-- ============================================================
-- public.users
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read only their own row
CREATE POLICY users_select_own
  ON public.users
  FOR SELECT
  USING (id = (SELECT auth.uid()));

-- Users can insert only their own row (trigger also inserts as SECURITY DEFINER, bypasses RLS)
CREATE POLICY users_insert_own
  ON public.users
  FOR INSERT
  WITH CHECK (id = (SELECT auth.uid()));

-- Users can update only their own row; cannot change their id
CREATE POLICY users_update_own
  ON public.users
  FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Users can delete only their own row
CREATE POLICY users_delete_own
  ON public.users
  FOR DELETE
  USING (id = (SELECT auth.uid()));

-- ============================================================
-- public.watches
-- ============================================================
ALTER TABLE public.watches ENABLE ROW LEVEL SECURITY;

-- Users can read only their own watches
CREATE POLICY watches_select_own
  ON public.watches
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- Users can insert only watches they own
CREATE POLICY watches_insert_own
  ON public.watches
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can update only their own watches; cannot change user_id
CREATE POLICY watches_update_own
  ON public.watches
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can delete only their own watches
CREATE POLICY watches_delete_own
  ON public.watches
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- public.user_preferences
-- ============================================================
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read only their own preferences
CREATE POLICY user_preferences_select_own
  ON public.user_preferences
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- Users can insert only their own preferences row
CREATE POLICY user_preferences_insert_own
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can update only their own preferences; cannot change user_id
CREATE POLICY user_preferences_update_own
  ON public.user_preferences
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can delete only their own preferences
CREATE POLICY user_preferences_delete_own
  ON public.user_preferences
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));
```

---

## Common Pitfalls

### Pitfall 1: Enable RLS Without Policies — Data Goes Invisible

**What goes wrong:** `ALTER TABLE watches ENABLE ROW LEVEL SECURITY` without a SELECT policy causes Postgres to return zero rows for all user queries. Collection appears empty. No error is thrown — it is a silent permission denial.

**Why it happens:** Postgres's default when RLS is enabled and no policy matches is DENY. This is "fail secure" behavior — but is catastrophic for existing live data.

**How to avoid:** D-08 mandates: write all policies for a table before or in the same statement as enabling RLS. The migration file must be structured so `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is immediately followed by all `CREATE POLICY` statements for that table.

**Warning signs:** User logs in, sees empty collection. `SELECT COUNT(*) FROM watches WHERE user_id = $id` returns 0 even though rows exist (when run as the user via PostgREST, not the SQL Editor). [VERIFIED: .planning/research/PITFALLS.md — Pitfall 1]

---

### Pitfall 2: Bare `auth.uid()` — Per-Row Function Calls

**What goes wrong:** `USING (user_id = auth.uid())` calls the function once per row scanned. A user with 300 watches triggers 300 function calls per query.

**How to avoid:** Always use `(SELECT auth.uid())`. Postgres wraps this in an `InitPlan` (computed once per query, cached for all row evaluations).

**Detection:** After applying migration, run `EXPLAIN ANALYZE SELECT * FROM watches` via psql connected as a non-superuser. Look for `InitPlan 1 (returns $1)` in the output. If absent, bare `auth.uid()` is likely present in the policy. [VERIFIED: .planning/research/PITFALLS.md — Pitfall 2]

---

### Pitfall 3: Missing `WITH CHECK` on UPDATE — Ownership Injection

**What goes wrong:** A user can submit an UPDATE that changes `user_id` to another user's UUID, planting data in their account.

**How to avoid:** Every UPDATE policy must have both `USING (user_id = (SELECT auth.uid()))` and `WITH CHECK (user_id = (SELECT auth.uid()))`.

**Verification:** Attempt to update a watch via PostgREST (anon key with user A's JWT) and set `user_id` to user B's UUID. Should return a policy violation error, not a successful update. [VERIFIED: CONTEXT.md D-04, .planning/research/PITFALLS.md — Pitfall 4]

---

### Pitfall 4: Testing RLS in the SQL Editor

**What goes wrong:** The Supabase SQL Editor runs as the `postgres` superuser, which bypasses RLS. All queries return data regardless of policies. A developer "tests" RLS in the SQL Editor, sees data, concludes it works — but it is not enforcing anything.

**How to avoid:** Use Supabase Dashboard > Authentication > Users > select a user > "Impersonate User." This runs queries with the user's actual JWT claims. Verify User A cannot see User B's watches. [VERIFIED: .planning/research/PITFALLS.md — Pitfall 1 "Warning Signs"]

---

### Pitfall 5: Drizzle-Kit Manage Conflict

**What goes wrong:** Running `drizzle-kit generate` after adding the RLS migration does NOT detect the RLS policies (Drizzle does not model them). Running `drizzle-kit migrate` does NOT apply the supabase migration. The two systems are independent.

**How to avoid:** Keep the two migration systems separate:
- `supabase/migrations/` — apply with `supabase db push --linked` (for triggers, RLS, any Supabase-managed SQL)
- `drizzle/` — apply with `npx drizzle-kit migrate` (for schema DDL managed by Drizzle)

Never put a `CREATE POLICY` statement in the `drizzle/` directory or vice versa. [VERIFIED: codebase — two directories already established with distinct purposes]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | `supabase db push --linked` | Yes | 2.90.0 | None — required |
| drizzle-kit | Schema management (not RLS) | Yes | 0.31.10 | None |
| Node.js | Next.js dev server | Yes | 25.2.1 | None |
| npm | Package management | Yes | 11.6.2 | None |
| Supabase project link | `supabase db push --linked` requires a linked project | Unknown — not verified in this session | Assumed linked from Phase 5 work | Run `supabase link --project-ref wdntzsckjaoqodsyscns` if not already linked |
| DATABASE_URL env var | Session-mode pooler URL for verification queries | Assumed present in `.env.local` | — | Retrieve from Supabase Dashboard → Project Settings → Database |

**Missing dependencies with no fallback:** None identified — all tooling is installed.

**Missing dependencies with fallback:**
- Supabase project link status: ASSUMED linked from prior phase work. If `supabase db push --linked` errors with "Project not linked", run `supabase link --project-ref wdntzsckjaoqodsyscns` first.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification via Supabase Dashboard (User Impersonation) |
| Config file | None — no automated test framework for RLS in this phase (D-06) |
| Quick run command | See verification checklist below |
| Full suite command | See verification checklist below |

**Note:** D-06 locks out automated CI tests for this phase. All verification is manual via Supabase Dashboard User Impersonation. The planner must include a verification wave/task with specific steps.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Verified By |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 (RLS enabled) | `relrowsecurity = true` for all 3 tables | Manual SQL query | `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('users', 'watches', 'user_preferences')` | SQL Editor (superuser — only valid for confirming the flag is set, not for testing policy behavior) |
| DATA-01 (cross-user isolation) | User A cannot read User B's watches | Manual — User Impersonation | N/A (manual only per D-05, D-06) | Supabase Dashboard User Impersonation |
| DATA-01 (own data CRUD) | User A can still read/write their own watches after RLS enabled | Manual — User Impersonation + app smoke test | `npm run dev` + login + add/edit/delete a watch | Browser smoke test |
| DATA-01 (UPDATE WITH CHECK) | Cannot change user_id to another user's UUID via direct API | Manual — PostgREST call with anon key + user JWT | `curl` or Supabase JS client with crafted payload | Direct API test |
| DATA-01 (SELECT wrapper) | Query plan shows InitPlan for auth.uid() | Manual — EXPLAIN ANALYZE | `EXPLAIN ANALYZE SELECT * FROM watches` (via psql as non-superuser) | EXPLAIN output check |

### Verification Checklist (replaces automated tests per D-06)

```
□ 1. supabase db push --linked succeeds with no errors
□ 2. SQL Editor: relrowsecurity = true for watches, users, user_preferences
□ 3. User Impersonation (User A): can read own watches — list is non-empty
□ 4. User Impersonation (User B): cannot read User A's watches — list is empty
□ 5. Browser smoke test: login as User A, add a watch, edit it, delete it — all work
□ 6. EXPLAIN ANALYZE: InitPlan visible in watch query output (no per-row auth.uid())
□ 7. Grep check: grep -n "auth\.uid()" supabase/migrations/20260420000000_rls_existing_tables.sql
     — every hit must be preceded by "(SELECT " (no bare auth.uid() calls)
□ 8. UPDATE WITH CHECK: attempt user_id change via direct API call — must return policy error
```

### Sampling Rate

- **Per task commit:** Grep check (step 7) — can be automated
- **Per wave merge:** SQL Editor confirmation (step 2) + browser smoke test (step 5)
- **Phase gate:** All 8 checklist items green before `/gsd-verify-work`

### Wave 0 Gaps

None — this phase has no test files to create. Verification is entirely manual per D-06. The verification checklist above is the Phase Gate artifact.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Auth is already in place via Supabase Auth |
| V3 Session Management | No | Session already managed; RLS consumes the JWT |
| V4 Access Control | Yes | RLS policies are the access control layer for DB-level operations |
| V5 Input Validation | No | No new API endpoints or input surfaces |
| V6 Cryptography | No | No new crypto operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user data read via anon key + user JWT | Information Disclosure | RLS SELECT policy `USING (user_id = (SELECT auth.uid()))` |
| Ownership injection via UPDATE without WITH CHECK | Tampering | `WITH CHECK (user_id = (SELECT auth.uid()))` on every UPDATE policy |
| RLS bypass via service_role key | Elevation of Privilege | Service role key is only in server-side `DATABASE_URL` env var; never exposed to client; existing architecture unchanged |
| Policy performance degradation at scale | Denial of Service (indirect) | `(SELECT auth.uid())` subquery wrapper eliminates per-row function calls |
| Enabled RLS with missing policies (deny-all) | Denial of Service | D-08: enable + policies in same migration |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase project is already linked (from Phase 5) — `supabase db push --linked` will work without re-linking | Environment Availability | Low risk: re-run `supabase link --project-ref wdntzsckjaoqodsyscns` takes ~30 seconds |
| A2 | The `DATABASE_URL` in `.env.local` is the session-mode pooler URL and is still valid | Environment Availability | Low risk: if expired, retrieve from Supabase Dashboard → Project Settings → Database |
| A3 | No existing RLS policies are present on any of the three tables (confirmed by schema review — no policy DDL found in any migration file) | All | If wrong, `CREATE POLICY` statements will fail with "policy already exists" — fix with `CREATE POLICY IF NOT EXISTS` or `DROP POLICY IF EXISTS` before CREATE |
| A4 | The Drizzle connection role (postgres / service role) inherently bypasses RLS — no changes to connection config needed | Architecture Patterns | Low risk: this is standard Supabase behavior; service role always bypasses RLS |

**A3 is the most important assumption.** The codebase search confirms no `CREATE POLICY` statements exist in any migration file. [VERIFIED: codebase — all SQL in drizzle/ and supabase/migrations/ reviewed]

---

## Open Questions

1. **Timestamp for new migration filename**
   - What we know: Supabase CLI uses `YYYYMMDDHHMMSS` format. The existing migration is `20260413000000_sync_auth_users.sql`.
   - What's unclear: The exact timestamp to use (any value after 20260413000000 works).
   - Recommendation: Use `20260420000000_rls_existing_tables.sql` matching today's date.

2. **`users` table INSERT policy interaction with auth trigger**
   - What we know: `handle_new_auth_user()` runs as `SECURITY DEFINER` which bypasses RLS. The INSERT policy on `users` is therefore redundant for trigger-based inserts but still correct for any manual/direct insert attempts.
   - What's unclear: Whether any path creates a `public.users` row outside the trigger.
   - Recommendation: Include the INSERT policy anyway for defense-in-depth. It will not conflict with the trigger's SECURITY DEFINER execution.

---

## Sources

### Primary (HIGH confidence)
- `/Users/tylerwaneka/Documents/horlo/.planning/research/PITFALLS.md` — Pitfalls 1, 2, 4 directly address the three critical RLS mistakes this phase must avoid [VERIFIED: codebase]
- `/Users/tylerwaneka/Documents/horlo/.planning/research/ARCHITECTURE.md` — RLS Policy Design section; confirms table-by-table policy requirements [VERIFIED: codebase]
- `/Users/tylerwaneka/Documents/horlo/src/db/schema.ts` — Authoritative table definitions; `users.id`, `watches.user_id`, `user_preferences.user_id` column names confirmed [VERIFIED: codebase]
- `/Users/tylerwaneka/Documents/horlo/supabase/migrations/20260413000000_sync_auth_users.sql` — SECURITY DEFINER pattern for the auth trigger; confirms bypass behavior [VERIFIED: codebase]
- `/Users/tylerwaneka/Documents/horlo/docs/deploy-db-setup.md` — Confirmed `supabase db push --linked` as the migration workflow for this project [VERIFIED: codebase]
- `/Users/tylerwaneka/Documents/horlo/.planning/phases/06-rls-foundation/06-CONTEXT.md` — All locked decisions (D-01 through D-08) [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- Supabase Row Level Security docs — `(SELECT auth.uid())` subquery pattern and policy syntax [CITED: supabase.com/docs/guides/database/postgres/row-level-security]
- Supabase Performance Advisor lint `0003_auth_rls_initplan` — confirms per-row `auth.uid()` is a known, flagged issue [CITED: supabase.com/docs/guides/database/database-advisors]

### Tertiary (LOW confidence)
- None — all claims verified against codebase or cited from official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — tools verified locally; migration pattern confirmed from existing project workflow
- Architecture: HIGH — policy SQL derived directly from locked decisions, schema column names verified against codebase
- Pitfalls: HIGH — sourced from project's own PITFALLS.md, which was written with official Supabase docs as primary source
- Verification approach: HIGH — User Impersonation method confirmed as the correct approach in CONTEXT.md D-05

**Research date:** 2026-04-19
**Valid until:** Stable — PostgreSQL RLS syntax and Supabase `auth.uid()` pattern do not change between minor releases. Valid for 90 days minimum.

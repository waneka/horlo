# Phase 6: RLS Foundation - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable row-level security on the three existing public tables (`users`, `watches`, `user_preferences`) with correctly-written policies so that multi-user data visibility is safe to build on. This is pure infrastructure — no UI, no schema changes, no new tables.

</domain>

<decisions>
## Implementation Decisions

### Query Architecture
- **D-01:** Drizzle continues connecting via `DATABASE_URL` (direct Postgres connection). RLS is defense-in-depth — it protects against direct PostgREST/API access with user JWTs and the `anon` key. The DAL `WHERE userId = currentUser.id` clauses remain the primary enforcement for Server Actions and DAL functions. This avoids a massive refactor of the query layer while still providing real DB-level protection.
- **D-02:** This pattern carries forward to Phase 7+ social tables. New tables will have RLS policies, but the DAL will continue using Drizzle with the same connection. Both layers enforce access control.

### Policy Granularity
- **D-03:** Separate policies per operation — individual SELECT, INSERT, UPDATE, DELETE policies on each table. Each policy gets a descriptive name (e.g., `watches_select_own`, `watches_update_own`). More explicit, easier to debug, and follows Supabase best practices.
- **D-04:** Every UPDATE policy must have both `USING` and `WITH CHECK` clauses using the `(SELECT auth.uid())` subquery pattern — no bare `auth.uid()` calls.

### Verification Approach
- **D-05:** Verification via Supabase User Impersonation tool (not SQL Editor, which bypasses RLS) as specified in the phase success criteria. Create a verification script/checklist that tests: User A can CRUD their own data, User A cannot see User B's data, and existing app behavior is unchanged.
- **D-06:** No automated CI RLS tests in this phase — manual verification is sufficient for 3 tables. Automated testing can be established when the social tables arrive in Phase 7.

### DATA-07 Scope
- **D-07:** Phase 6 establishes the RLS pattern on existing tables only. DATA-07's actual policy creation for social tables (`profiles`, `follows`, `profile_settings`, `activities`, `wear_events`) happens in Phase 7 when those tables are created. Phase 6's policies serve as the template Phase 7 follows.

### Migration Strategy
- **D-08:** Enable RLS and create all policies in the same migration transaction. Never enable RLS without policies — existing data would become invisible. This is critical pitfall #1 from research.

### Claude's Discretion
- Policy naming convention (as long as it's descriptive and consistent)
- Whether to use a single migration file or split by table (Claude's call on what's cleanest)
- Drizzle migration tooling details (drizzle-kit generate vs hand-written SQL for RLS)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `src/db/schema.ts` — Defines the three tables that need RLS: `users`, `watches`, `user_preferences`
- `src/db/index.ts` — Drizzle client setup with `DATABASE_URL` and `{ prepare: false }` for Supabase pooling
- `drizzle/0000_flaky_lenny_balinger.sql` — Existing migration to understand current state

### Auth & Data Access
- `src/lib/auth.ts` — `getCurrentUser()` function used by all DAL/Server Actions
- `src/data/watches.ts` — Watch DAL with userId WHERE clauses (pattern to preserve)
- `src/data/preferences.ts` — Preferences DAL with userId WHERE clauses
- `src/lib/supabase/server.ts` — Supabase server client creation
- `src/lib/supabase/proxy.ts` — Edge auth enforcement

### Deploy & Config
- `docs/deploy-db-setup.md` — Production deploy runbook (migration workflow)
- `supabase/config.toml` — Supabase project configuration

### Research
- `.planning/research/PITFALLS.md` — Critical RLS pitfalls (bare auth.uid(), missing WITH CHECK, enable-without-policies)
- `.planning/research/ARCHITECTURE.md` — Architecture decisions including two-layer privacy enforcement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/auth.ts:getCurrentUser()` — Already verified auth pattern; DAL functions call this for userId
- Drizzle schema in `src/db/schema.ts` — All three tables have `userId` columns with FK to `users.id`

### Established Patterns
- DAL functions (`src/data/watches.ts`, `src/data/preferences.ts`) already filter by `userId` — RLS is the second enforcement layer
- Server Actions (`src/app/actions/`) call `getCurrentUser()` then pass userId to DAL
- `proxy.ts` redirects unauthenticated requests at the edge

### Integration Points
- Drizzle migrations via `drizzle-kit` — RLS policies may need hand-written SQL since Drizzle doesn't natively support RLS declarations
- `DATABASE_URL` connection — connects as database role that likely bypasses RLS (service role or postgres user). This is intentional per D-01.
- Supabase anon key access via PostgREST — this IS subject to RLS and is the primary attack surface RLS protects

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User deferred all decisions to Claude's judgment.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-rls-foundation*
*Context gathered: 2026-04-19*

# Phase 7: Social Schema & Profile Auto-Creation - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Five new Postgres tables (`profiles`, `follows`, `profile_settings`, `activities`, `wear_events`) land with full RLS policies and correct indexes. Every user gets a profile row auto-created on signup via DB trigger. Existing watch mutations start writing activity events. The `watches.lastWornDate` column is dropped in favor of the `wear_events` table.

</domain>

<decisions>
## Implementation Decisions

### Profile Auto-Creation
- **D-01:** Postgres trigger on `auth.users` INSERT creates both a `profiles` row and a `profile_settings` row. Zero app code needed for the creation path. Defined in the same migration as the tables.
- **D-02:** No backfill script needed. There is currently one user who will delete their account and re-create it after the migration. The trigger handles all future signups.

### Username Strategy
- **D-03:** Username auto-generated from email prefix (part before @). If taken, append random digits (e.g., `tyler_4829`). User can change username later in Phase 8 profile edit.
- **D-04:** Username format: lowercase alphanumeric + underscores, 3-30 chars, must start with a letter. Enforced via CHECK constraint in Postgres.

### Activity Logging
- **D-05:** Existing Server Actions start writing activity rows immediately in Phase 7. Events: `watch_added`, `wishlist_added`, `watch_worn`. By Phase 10 (Activity Feed), there will be real historical data to display.
- **D-06:** Activity metadata includes snapshot fields (`brand`, `model`, `imageUrl`) so the feed remains readable even if the watch is later deleted.

### Wear Events Migration
- **D-07:** Clean break: drop `watches.lastWornDate` column entirely. The `wear_events` table becomes the sole source of truth for wear history.
- **D-08:** All components that currently read `lastWornDate` (WatchCard, WatchDetail, insights) must be updated to query `wear_events` instead. This expands Phase 7 beyond pure schema into app code changes.

### RLS (Carried from Phase 6)
- **D-09:** All five new tables get RLS enabled with separate policies per operation, using the `(SELECT auth.uid())` pattern. USING + WITH CHECK on every UPDATE policy. RLS + policies in the same migration transaction.
- **D-10:** Drizzle continues via `DATABASE_URL` — RLS is defense-in-depth alongside DAL WHERE clauses (Phase 6 D-01/D-02).

### Claude's Discretion
- Migration file organization (single vs split by table)
- Exact trigger function implementation details
- RLS policy naming convention (following Phase 6 pattern)
- Activity event type enum values beyond the three specified
- Index strategy beyond what's specified in success criteria

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `src/db/schema.ts` — Current Drizzle schema with three existing tables; new tables added here
- `src/db/index.ts` — Drizzle client setup with `DATABASE_URL` and `{ prepare: false }`
- `drizzle/0000_flaky_lenny_balinger.sql` — Existing migration to understand current state

### Research (Table Designs)
- `.planning/research/ARCHITECTURE.md` — Detailed table schemas for all five new tables, index recommendations, and route planning
- `.planning/research/PITFALLS.md` — Critical RLS and migration pitfalls
- `.planning/research/FEATURES.md` — Feature-level details for social tables

### Auth & Data Access
- `src/lib/auth.ts` — `getCurrentUser()` function used by all DAL/Server Actions
- `src/data/watches.ts` — Watch DAL; needs activity event insertion on mutations
- `src/data/preferences.ts` — Preferences DAL
- `src/lib/supabase/server.ts` — Supabase server client creation

### Server Actions (Activity Logging)
- `src/app/actions/` — Server Actions that will need activity event writes added

### Phase 6 Context
- `.planning/phases/06-rls-foundation/06-CONTEXT.md` — RLS pattern decisions that carry forward

### Deploy
- `docs/deploy-db-setup.md` — Production deploy runbook (migration workflow)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 6 RLS policies — template for new table policies
- `getCurrentUser()` in `src/lib/auth.ts` — auth pattern for new DAL functions
- Drizzle schema patterns in `src/db/schema.ts` — uuid PKs, timestamptz, text arrays, index definitions

### Established Patterns
- DAL functions (`src/data/*.ts`) — server-only, scoped by userId, called by Server Actions
- Server Actions (`src/app/actions/`) — validated mutations with `getCurrentUser()` + `revalidatePath()`
- Drizzle migrations via `drizzle-kit` — RLS policies likely need hand-written SQL

### Integration Points
- `src/db/schema.ts` — five new table definitions added here
- `src/app/actions/` — existing watch mutation actions get activity event inserts
- Components reading `watches.lastWornDate` — must be updated to query `wear_events`
- `proxy.ts` PUBLIC_PATHS — no changes needed in Phase 7 (profile routes are Phase 8)

</code_context>

<specifics>
## Specific Ideas

- User is the sole current user and will delete + re-create their account after migration — no backfill complexity
- Activity logging starts immediately so Phase 10 feed has real data from day one

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-social-schema-profile-auto-creation*
*Context gathered: 2026-04-19*

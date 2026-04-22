# Phase 11: Schema + Storage Foundation - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 delivers the **database + storage foundation** for v3.0. It ships:

- `wear_visibility` Postgres enum (`public` | `followers` | `private`)
- `wear_events` schema extensions (`photo_url`, `note` with 200-char CHECK, `visibility`)
- Backfill of `visibility` from `profile_settings.worn_public` (`true → 'public'`, `false → 'private'`)
- `notifications` table with partial index on unread rows and recipient-only RLS
- `wear-photos` Supabase Storage bucket (private) with three-tier `storage.objects` RLS
- `pg_trgm` extension + GIN indexes on `profiles.username` and `profiles.bio`
- DEBT-02: RLS patch on `users`, `watches`, `user_preferences` (missing `WITH CHECK`, InitPlan pattern verification)

Phase 11 is **schema + infrastructure only**. No DAL rewrites, no feature code, no UI. Every downstream phase depends on this landing cleanly.

**Out of scope for Phase 11:**
- Visibility ripple through DAL functions (Phase 12)
- `worn_public` column drop (Phase 12, after DAL stops reading it)
- Notification write-path wiring into `followUser` / `addWatch` (Phase 13)
- pg_trgm consumer DAL / search UI (Phase 16)
- Storage upload pipeline and signed-URL minting code (Phase 15)

</domain>

<decisions>
## Implementation Decisions

### Storage RLS Enforcement

- **D-01:** `storage.objects` SELECT policy enforces **all three visibility tiers directly** — the policy parses `{user_id}/{wear_event_id}.jpg` from `storage.objects.name`, JOINs to `wear_events`, and checks `visibility` + `follows`. Defense-in-depth continues from v2.0: even a leaked signed URL is gated by RLS. Owner/public/followers/private branches all live in the policy.
- **D-02:** All reads (including `visibility = 'public'`) use **signed URLs with long TTL**. Single DAL code path. Success criterion "public-visibility unsigned OK" is satisfied by long-TTL signed URLs that anyone can fetch. Must respect Pitfall F-2 — never cache signed URLs inside `'use cache'` wrappers or pass them through `next/image` optimizer.
- **D-03:** `storage.objects` INSERT/UPDATE/DELETE policies enforce the **per-user folder convention** — `(storage.foldername(name))[1] = (SELECT auth.uid())::text`. Closes Pitfall F-4 at the RLS layer: a client with their own session cannot upload into someone else's folder.
- **D-04:** Orphan cleanup is **best-effort in the Server Action** — row DELETE followed by Storage object DELETE; failure of the Storage delete is logged but does not roll back the row. Pitfall F-3 accepted as a known orphan risk. Scheduled cleanup cron deferred.

### Migration Choreography

- **D-05:** Phase 11 ships as **five ordered migrations**, each deployable and reviewable independently:
  1. `wear_visibility` enum + `wear_events` columns + backfill (single transaction with inline verification — RAISE if any row has `visibility = 'followers'`)
  2. `notifications` table + partial index on `WHERE read_at IS NULL` + RLS + enum type + dedup partial UNIQUE + self-notif CHECK
  3. `pg_trgm` extension + GIN indexes on `profiles.username` and `profiles.bio`
  4. `wear-photos` Storage bucket + `storage.objects` RLS policies
  5. DEBT-02: RLS audit patches on `users`/`watches`/`user_preferences`
- **D-06:** `worn_public` column is **NOT dropped in Phase 11**. Phase 11 backfills the new `wear_events.visibility` column and leaves `profile_settings.worn_public` in place. Phase 12 rewrites all wear-reading DAL to use `visibility` and includes a final cleanup migration dropping `worn_public`. Prevents the "running app reads a dropped column" window.
- **D-07:** Backfill is **a single UPDATE with inline verification** inside the same migration transaction. `ALTER TABLE ... ADD COLUMN visibility ... NOT NULL DEFAULT 'public'`, then `UPDATE wear_events SET visibility = CASE ...` using a JOIN to `profile_settings.worn_public`, followed by a `DO $$` block that RAISEs EXCEPTION if any row has `visibility = 'followers'`. Atomic and self-verifying at migration time (catches Pitfall G-6 before runtime).
- **D-08:** **Drizzle for schema (tables/columns), raw SQL migrations for everything else** — extensions, Postgres enums, GIN indexes with ops, `storage.objects` policies, all RLS policies. Matches existing repo convention. Drizzle schema in `src/db/schema.ts` remains the source of truth for DAL type inference. Production flow unchanged: `supabase db push --linked`.

### Notifications Schema

- **D-09:** `notifications.type` is a **Postgres enum** with all v3.0 values defined upfront: `CREATE TYPE notification_type AS ENUM ('follow', 'watch_overlap', 'price_drop', 'trending_collector')`. Stubbed types (NOTIF-07) are in the enum now so Phase 13 doesn't need `ALTER TYPE` when data wiring arrives. Pitfall B-8 (unknown type → render null) still applied defensively in UI layer.
- **D-10:** `payload` is `jsonb` **with no DB-level CHECK** — per-type structure enforced by a TypeScript discriminated union (`FollowPayload | WatchOverlapPayload | ...`) that every insert path uses. Mirrors the v2.0 `activities.metadata` pattern.
- **D-11:** Watch-overlap dedup is a **partial UNIQUE index on payload-derived keys** with `ON CONFLICT DO NOTHING` in Server Actions:
  ```
  CREATE UNIQUE INDEX notifications_overlap_dedup
    ON notifications ((user_id), (payload->>'watch_brand_normalized'),
                      (payload->>'watch_model_normalized'), (created_at::date))
    WHERE type = 'watch_overlap';
  ```
  Same `(recipient, brand, model, day)` only inserts once. The 30-day window (SUMMARY §notifications) is enforced by a Server Action query before insert, not by the index. Races are acceptable at MVP scale.
- **D-12:** `notifications` has an **`actor_id` nullable column** referencing `users(id) ON DELETE CASCADE`. A `CHECK (actor_id IS NULL OR actor_id != user_id)` enforces B-9 (no-self-notification) at the DB layer. NULL is reserved for system notifications (`price_drop`, `trending_collector`). Recipient `user_id ON DELETE CASCADE` satisfies B-7.
- **D-13:** `notifications` RLS is **recipient-only SELECT/UPDATE**: `USING ((SELECT auth.uid()) = user_id)` with matching `WITH CHECK` on UPDATE. **No INSERT policy for anon** — all inserts go through Server Actions using service-role or authenticated session. No DELETE policy (deletions only via ON DELETE CASCADE from `users`).

### DEBT-02 Audit Scope

- **D-14:** **Patch-minimal** — audit current policies on `users`, `watches`, `user_preferences`; add `WITH CHECK` on any UPDATE missing it; convert any bare `auth.uid()` to `(SELECT auth.uid())`; add an INSERT policy to `user_preferences` if missing. No rewrite of working policies. Matches MR-03 original scope.
- **D-15:** Verification is **integration tests against local Supabase**, mirroring `tests/integration/isolation.test.ts` / `tests/integration/home-privacy.test.ts`. Tests cover: anon key cannot SELECT another user's row; authed user cannot UPDATE another user's row; authed user cannot INSERT with `user_id` set to a different user. Tests activate only when local Supabase env vars are present (same gate as existing integration suite). Ongoing regression coverage.
- **D-16:** DEBT-02 is its **own migration file** — e.g. `20260422000005_debt02_rls_audit.sql`. Isolated, reviewable, easy to roll back independently of the schema changes.

### Claude's Discretion

- pg_trgm GIN index variant (`gin_trgm_ops` vs `gist_trgm_ops`), any normalized/lowercase column, bio-search minimum-length guard (Pitfall C-5) — planner/researcher decides
- Exact TypeScript discriminated-union field names for each notification payload type — planner decides
- `photo_url` storage format (path only vs full URL) — planner decides (expected: path only, since signed URLs are minted at read time)
- Migration filenames and timestamps — executor decides using existing `supabase/migrations/*.sql` convention
- Exact SQL for the three-tier storage RLS JOIN (brand of `EXISTS` / `OR` chaining) — executor decides during implementation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone / Requirements
- `.planning/ROADMAP.md` §"Phase 11: Schema + Storage Foundation" — goal, requirements, success criteria, pitfalls list
- `.planning/REQUIREMENTS.md` — requirements WYWT-09, WYWT-11, WYWT-13, WYWT-14, NOTIF-01, SRCH-08, DEBT-02
- `.planning/PROJECT.md` — v3.0 milestone constraints, architecture decisions (two-layer privacy, RLS pattern, no Realtime)
- `.planning/STATE.md` §"Key Decisions (v3.0)" — D1 client-direct upload, D3 single private bucket, D4 worn_public deprecation, Phase 11 vs Phase 12 split rationale

### v3.0 Research
- `.planning/research/SUMMARY.md` §"Phase 11: Schema + Storage Foundation", §"Open Architecture Decisions" 1/3/4
- `.planning/research/ARCHITECTURE.md` — schema definitions, Storage bucket + RLS patterns, worn_public migration strategy
- `.planning/research/STACK.md` — pg_trgm setup, Storage bucket creation
- `.planning/research/PITFALLS.md` — especially: B-3 (dedup UNIQUE), B-4 (recipient-only RLS), B-7 (ON DELETE CASCADE), B-9 (self-notif CHECK), C-1 (pg_trgm in migration), F-1 (Storage RLS separate from table RLS), F-3 (orphan files), F-4 (folder enforcement), G-6 (backfill direction)

### Production Runbook
- `docs/deploy-db-setup.md` — prod migration flow, `supabase db push --linked --include-all`, session-mode pooler, 6 footgun fixes

### Codebase Anchors (Drizzle schema, existing migrations)
- `src/db/schema.ts` — current Drizzle schema (users, watches, user_preferences, profiles, follows, profile_settings, activities, wear_events)
- `supabase/migrations/20260420000000_rls_existing_tables.sql` — current RLS on users/watches/user_preferences (audit target for DEBT-02)
- `supabase/migrations/20260420000001_social_tables_rls.sql` — RLS pattern reference for new notifications + storage policies
- `supabase/migrations/20260422000000_phase10_activities_feed_select.sql` — most recent RLS migration; canonical InitPlan pattern reference
- `tests/integration/isolation.test.ts` — DEBT-02 verification pattern (cross-user RLS enforcement)
- `tests/integration/home-privacy.test.ts` — two-layer privacy verification pattern

### Memory (user instructions)
- `DB migration rules` — drizzle-kit push is LOCAL ONLY; prod migrations use `supabase db push --linked`
- `Local DB reset workflow` — `supabase db reset` must be followed by drizzle push + selective supabase migrations via docker exec psql

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Drizzle schema + `sql` tag** (`src/db/schema.ts`) — existing `pgTable` / `pgEnum` / `index` / `unique` primitives; `wearEvents` already exported with FK cascade; extend rather than replace
- **`supabase/migrations/` folder** — 8 existing migrations following `YYYYMMDDHHMMSS_description.sql` convention; Phase 11 migrations continue the numbering
- **InitPlan-optimized RLS pattern** from Phase 10 activities migration — canonical `(SELECT auth.uid())` + `WITH CHECK` on UPDATE; copy this shape for all new policies and DEBT-02 patches
- **`tests/integration/` suite** — integration tests conditionally activate when `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` present; DEBT-02 verification tests follow this pattern

### Established Patterns
- **Two-layer privacy** (v2.0): RLS at DB + DAL WHERE clause. Phase 11 lands the DB layer for visibility + notifications; Phase 12 adds the DAL layer.
- **Activity metadata jsonb** (`src/db/schema.ts` → `activities.metadata`): Horlo precedent for jsonb-with-TS-typing (no DB CHECK) — mirror for `notifications.payload`.
- **ON DELETE CASCADE for user-scoped data**: every new table FKs `users(id) ON DELETE CASCADE` (matches `follows`, `profiles`, `activities`, `wear_events`).
- **Migration tooling split**: Drizzle for tables/columns; hand-written `supabase/migrations/*.sql` for extensions, enums, GIN with ops, RLS, Storage — consistent with the existing 8 migrations.

### Integration Points
- **`profile_settings.worn_public`** — stays in place after Phase 11; read by migration's backfill UPDATE; DAL still reads it until Phase 12
- **`wear_events`** — extends existing columns (v2.0 schema); `visibility NOT NULL DEFAULT 'public'` enum, `photo_url text NULL`, `note text NULL CHECK (length(note) <= 200)`
- **`profiles.username` / `profiles.bio`** — existing columns; Phase 11 adds GIN trigram indexes on them, no column changes
- **Supabase Storage** — first bucket in the project; establishes the `storage.objects` RLS pattern the whole milestone reuses

</code_context>

<specifics>
## Specific Ideas

- **Migration verification at migration time, not runtime** (D-07): the `DO $$ RAISE EXCEPTION ... $$` block is the backstop for Pitfall G-6. A backfill bug must fail the migration, not show up weeks later in a privacy incident.
- **Enum with stub types preloaded** (D-09): `price_drop` and `trending_collector` are in the enum now even though no write-path inserts them in v3.0. Avoids an `ALTER TYPE` migration when data wiring arrives.
- **Storage RLS JOINs `wear_events`** (D-01): explicitly rejected the simpler "bucket owner-only + DAL-gate-via-signed-URL" path in favor of defense-in-depth. Matches "either layer breaking alone is still caught" from the v2.0 two-layer privacy decision.

</specifics>

<deferred>
## Deferred Ideas

- **Orphan storage cleanup cron / scheduled function** — deferred past v3.0; best-effort delete in Server Action is the MVP (D-04). Revisit when storage grows meaningfully or if an orphan audit reveals drift.
- **`worn_public` column drop** — Phase 12 cleanup migration; not Phase 11.
- **Cross-user SELECT RLS on `watches` (defense-in-depth beyond DAL)** — explicitly rejected for DEBT-02 scope (D-14). Worth a future RLS-hardening phase if desired.
- **DB-level `CHECK` on `notifications.payload` per-type shape** — rejected in favor of TS discriminated union (D-10). Reconsider if a malformed-payload incident ever happens.
- **30-day dedup window as a pure DB index expression** — rejected as too hacky (D-11). Server Action + partial unique on `(recipient, brand, model, day)` is the pragmatic choice.
- **Full RLS rewrite for consistency on existing tables** — rejected for DEBT-02 (D-14). Patch-minimal only.

### Reviewed Todos (not folded)
*(No todos were cross-referenced for this phase — `gsd-tools todo match-phase` not run; backlog item 999.1 is the phase-5 RLS follow-ups which were already folded into DEBT-01/02 by requirements.)*

</deferred>

---

*Phase: 11-schema-storage-foundation*
*Context gathered: 2026-04-22*

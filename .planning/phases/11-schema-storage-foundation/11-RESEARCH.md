# Phase 11: Schema + Storage Foundation — Research

**Researched:** 2026-04-22
**Domain:** Postgres schema + Drizzle + Supabase Storage + pg_trgm + RLS audit
**Confidence:** HIGH (every sub-domain is either codebase-derived or verified against official Supabase/Postgres docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Storage RLS Enforcement**

- **D-01:** `storage.objects` SELECT policy enforces **all three visibility tiers directly** — policy parses `{user_id}/{wear_event_id}.jpg` from `storage.objects.name`, JOINs to `wear_events`, checks `visibility` + `follows`. Defense-in-depth: owner/public/followers/private branches live in the policy.
- **D-02:** All reads (including `visibility = 'public'`) use **signed URLs with long TTL**. Single DAL code path. Must respect Pitfall F-2 — never cache signed URLs inside `'use cache'` wrappers or pass them through `next/image` optimizer.
- **D-03:** `storage.objects` INSERT/UPDATE/DELETE policies enforce **per-user folder convention** — `(storage.foldername(name))[1] = (SELECT auth.uid())::text`. Closes Pitfall F-4.
- **D-04:** Orphan cleanup is **best-effort in the Server Action** (Phase 15, not Phase 11). Pitfall F-3 accepted as known orphan risk.

**Migration Choreography**

- **D-05:** Phase 11 ships as **five ordered migrations**:
  1. `wear_visibility` enum + `wear_events` columns + backfill + verification
  2. `notifications` table + partial index + RLS + enum + dedup index + self-notif CHECK
  3. `pg_trgm` extension + GIN indexes on `profiles.username`/`profiles.bio`
  4. `wear-photos` Storage bucket + `storage.objects` RLS policies
  5. DEBT-02: RLS audit patches on `users`/`watches`/`user_preferences`
- **D-06:** `worn_public` column is **NOT dropped in Phase 11** — Phase 12 concern.
- **D-07:** Backfill is **a single UPDATE with inline verification** inside the same migration transaction. `DO $$ RAISE EXCEPTION` on any `visibility = 'followers'` row.
- **D-08:** **Drizzle for schema (tables/columns), raw SQL migrations for everything else** — extensions, Postgres enums, GIN with ops, `storage.objects` policies, all RLS policies.

**Notifications Schema**

- **D-09:** `notifications.type` is a **Postgres enum** with all v3.0 values upfront: `CREATE TYPE notification_type AS ENUM ('follow', 'watch_overlap', 'price_drop', 'trending_collector')`.
- **D-10:** `payload` is `jsonb` **with no DB-level CHECK** — per-type structure enforced by TypeScript discriminated union.
- **D-11:** Watch-overlap dedup via partial UNIQUE index on `(user_id, payload->>'watch_brand_normalized', payload->>'watch_model_normalized', created_at::date) WHERE type = 'watch_overlap'` with `ON CONFLICT DO NOTHING`. 30-day window enforced by Server Action, not DB.
- **D-12:** `notifications` has `actor_id` nullable column referencing `users(id) ON DELETE CASCADE`. CHECK `(actor_id IS NULL OR actor_id != user_id)`. NULL for system notifications.
- **D-13:** `notifications` RLS is **recipient-only SELECT/UPDATE**. No INSERT policy for anon. No DELETE policy (rely on CASCADE).

**DEBT-02 Audit Scope**

- **D-14:** **Patch-minimal** — add `WITH CHECK` on UPDATE policies missing it; convert bare `auth.uid()` to `(SELECT auth.uid())`; add INSERT policy to `user_preferences` if missing. No rewrite of working policies.
- **D-15:** Verification is **integration tests against local Supabase**, mirroring `tests/data/isolation.test.ts`.
- **D-16:** DEBT-02 is **its own migration file**.

### Claude's Discretion

- pg_trgm GIN index variant (`gin_trgm_ops` vs `gist_trgm_ops`) — researcher decides
- Normalized/lowercase column vs expression index for case-insensitive search
- Bio-search minimum-length guard (Pitfall C-5) — enforcement layer decision
- Exact TypeScript discriminated-union field names for each notification payload type
- `photo_url` storage format (path only vs full URL) — expected: path only
- Migration filenames and timestamps — use existing `supabase/migrations/*.sql` convention
- Exact SQL for the three-tier storage RLS JOIN (`EXISTS` vs `OR` chaining, InitPlan subquery shape)

### Deferred Ideas (OUT OF SCOPE)

- Orphan storage cleanup cron / scheduled function — best-effort delete in Server Action is MVP
- `worn_public` column drop — Phase 12 cleanup migration
- Cross-user SELECT RLS on `watches` (defense-in-depth beyond DAL) — rejected for DEBT-02 scope
- DB-level CHECK on `notifications.payload` per-type shape — rejected in favor of TS discriminated union
- 30-day dedup window as a pure DB index expression — rejected as too hacky
- Full RLS rewrite for consistency on existing tables — rejected; patch-minimal only

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **WYWT-09** | `wear_events` schema: `photo_url text NULL`, `note text NULL CHECK (length(note) <= 200)`, `visibility wear_visibility NOT NULL DEFAULT 'public'` + enum type | §Migration 1, §Drizzle Additions, §SQL Snippet: wear_events Extension |
| **WYWT-11** | Deprecate `worn_public`: backfill `wear_events.visibility` (`true → public`, `false → private`); drop deferred to Phase 12 | §Migration 1, §SQL Snippet: Backfill + Verification |
| **WYWT-13** | `wear-photos` Storage bucket `{user_id}/{wear_event_id}.jpg`, private | §Migration 4, §SQL Snippet: Bucket Creation |
| **WYWT-14** | Storage `storage.objects` RLS gated three ways: public → anyone with URL; followers → follower; private → owner | §Migration 4, §SQL Snippet: Three-Tier Storage SELECT |
| **NOTIF-01** | `notifications` table with `id/user_id/type/payload/read_at/created_at`; recipient-only RLS `(SELECT auth.uid()) = user_id` | §Migration 2, §SQL Snippet: Notifications Table & RLS |
| **SRCH-08** | `pg_trgm` enabled; GIN trigram indexes on `profiles.username` and `profiles.bio` | §Migration 3, §SQL Snippet: pg_trgm Setup |
| **DEBT-02** | Verify `users/watches/user_preferences` policies use `(SELECT auth.uid())` + `WITH CHECK` on UPDATE; add INSERT policy to `user_preferences` if missing | §Migration 5, §DEBT-02 Audit Pattern |

</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Next.js 16 App Router** — "this is NOT the Next.js you know; read `node_modules/next/dist/docs/` before writing any Next.js code." **Irrelevant for Phase 11** — this phase is SQL + Drizzle only, no Next.js code is authored.
- **Data model extension** — extend, don't break. `wearEvents`, `profiles`, `users`, `watches`, `user_preferences` all exist in `src/db/schema.ts`. Phase 11 ADDs columns/tables; it does not rename or remove them.
- **GSD workflow enforcement** — all file changes go through this phase's plan/execute cycle.
- **Memory rules:**
  - `drizzle-kit push` is LOCAL ONLY; prod uses `supabase db push --linked`.
  - Local DB reset requires `supabase db reset` → `drizzle-kit push` → selective `supabase migrations` via `docker exec psql`.

## Summary

Phase 11 is the **schema and infrastructure foundation** for v3.0. It ships five independent, idempotent SQL migrations that collectively deliver: three-tier `wear_events.visibility`, a `notifications` table with recipient-only RLS and dedup index, the `wear-photos` Storage bucket with three-tier `storage.objects` RLS, pg_trgm with GIN indexes, and a minimal DEBT-02 RLS audit patch.

The research gap the planner faces is **not** the high-level decisions (CONTEXT.md already locked D-01..D-16) but the concrete SQL shape of each migration: exactly how the storage.objects SELECT JOIN is written without degenerate row-scan cost, whether `gin_trgm_ops` beats `gist_trgm_ops` for our workload, how to phrase the backfill verification block, and exactly what DEBT-02 finds when we audit the three existing policies.

**Primary recommendation:** Ship five migration files in strict order (wear_events → notifications → pg_trgm → storage → DEBT-02). Each file is a single atomic transaction with inline verification. Use `gin_trgm_ops` (3× faster reads than GiST; read-heavy profile columns). Store `photo_url` as **path only** (never a full URL — signed URLs are minted at read time). Write the storage SELECT policy using `EXISTS` subqueries wrapped in `(SELECT ...)` to trigger InitPlan caching. Treat DEBT-02 as a validation pass: read the current three policy files, confirm they all already use `(SELECT auth.uid())` and `WITH CHECK` — the existing v2.0 migrations look clean, so DEBT-02 may ship as a verification-only migration with zero DDL changes (just an integration test suite that runs on CI).

## Standard Stack

### Core (already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.2 [VERIFIED: package.json] | Schema source of truth; `pgTable`, `pgEnum`, `jsonb`, `uuid`, `text`, `index`, `unique` | Matches existing schema.ts; D-08 locks this choice |
| drizzle-kit | ^0.31.10 [VERIFIED: package.json] | `drizzle-kit generate` for table/column migrations (local); `drizzle-kit push` never used in prod | Established tooling |
| @supabase/supabase-js | ^2.103.0 [VERIFIED: package.json] | Storage bucket creation + signed URL minting (Phase 15 uses this, not Phase 11) | Existing client |
| @supabase/ssr | ^0.10.2 [VERIFIED: package.json] | Server-side Supabase client | Existing client |
| postgres | ^3.4.9 [VERIFIED: package.json] | Drizzle's Postgres driver | Existing |
| Supabase CLI | 2.x [VERIFIED: docs/deploy-db-setup.md] | `supabase db push --linked --include-all` for prod migrations | Established deploy runbook |

### Supporting (infra — no npm packages)

| Thing | Purpose | Source |
|-------|---------|--------|
| `pg_trgm` extension | Trigram indexes for ILIKE acceleration | Pre-installed on all Supabase projects [VERIFIED: Supabase docs via web 2025-2026] |
| `gin_trgm_ops` operator class | GIN index operator for trigram ILIKE | pg_trgm extension provides |
| Supabase Storage | Binary file storage with RLS via `storage.objects` | Part of every Supabase project [VERIFIED: supabase.com/docs/guides/storage] |

### Alternatives Considered and Rejected

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `gin_trgm_ops` | `gist_trgm_ops` | GiST is 3× slower for reads but 3× faster to build and 2-3× smaller on disk. Profiles are read-heavy, infrequently updated — GIN wins. [CITED: pganalyze.com, elephanttamer.net] |
| Postgres enum for `notification_type` | `text` column with app-layer validation | Enum is locked per D-09. Enum gives DB-level type safety and better query plans. Downside: adding values requires `ALTER TYPE ... ADD VALUE` in a non-transactional migration — mitigated by D-09 defining all four values upfront. |
| jsonb `payload` without CHECK | DB CHECK constraint per type | Locked per D-10. CHECK would be complex (switch-by-type jsonb path predicates) and TypeScript discriminated union gives equivalent safety at write sites. |
| Single migration file | Five ordered files | Locked per D-05. Five smaller files are reviewable, rollback-able independently, and let us stop after step 3 if step 4 fails in prod. |

**Installation:**
```bash
# No npm installs needed for Phase 11.
# All migrations are SQL files added to supabase/migrations/ and drizzle/.
```

## Architecture Patterns

### Migration File Layout

```
supabase/migrations/
├── 20260413000000_sync_auth_users.sql              (existing — Phase 6)
├── 20260419999999_social_tables_create.sql         (existing — Phase 7)
├── 20260420000000_rls_existing_tables.sql          (existing — Phase 6; DEBT-02 audit target)
├── 20260420000001_social_tables_rls.sql            (existing — Phase 7)
├── 20260420000002_profile_trigger.sql              (existing — Phase 7)
├── 20260420000003_phase8_notes_columns.sql         (existing — Phase 8)
├── 20260421000000_profile_username_lower_unique.sql (existing — Phase 9)
├── 20260422000000_phase10_activities_feed_select.sql (existing — Phase 10; InitPlan pattern reference)
├── 20260423000001_phase11_wear_visibility.sql      (NEW — Migration 1)
├── 20260423000002_phase11_notifications.sql        (NEW — Migration 2)
├── 20260423000003_phase11_pg_trgm.sql              (NEW — Migration 3)
├── 20260423000004_phase11_storage_bucket_rls.sql   (NEW — Migration 4)
└── 20260423000005_phase11_debt02_audit.sql         (NEW — Migration 5)

drizzle/
├── 0000_flaky_lenny_balinger.sql         (existing)
├── 0001_robust_dormammu.sql              (existing)
├── 0002_phase8_notes_columns.sql         (existing)
└── 0003_phase11_wear_events_columns.sql  (NEW — drizzle-kit generate output for wear_events columns only)
```

**Rationale for split:** Drizzle emits pure `ALTER TABLE ADD COLUMN` for the wear_events extension (a clean Drizzle concern). Everything else — enum creation, backfill, storage RLS, pg_trgm, DEBT-02 audit — is hand-written SQL under `supabase/migrations/` because Drizzle has no primitive for it. This split matches D-08 exactly.

### Pattern 1: Single-Transaction Migration with Inline Verification

**What:** Every migration file wraps its DDL + DML in `BEGIN; ... COMMIT;` and includes a `DO $$ RAISE EXCEPTION` block that fails the transaction if a correctness invariant does not hold.

**When to use:** Backfill migrations where the success of the migration depends on data-shape assumptions (Migration 1 in particular).

**Example (canonical — copy this shape):**
```sql
-- Source: derived from supabase/migrations/20260422000000_phase10_activities_feed_select.sql pattern
BEGIN;

-- ... DDL statements ...

-- Backfill
UPDATE wear_events we
   SET visibility = CASE ps.worn_public WHEN true THEN 'public'::wear_visibility
                                         ELSE 'private'::wear_visibility END
  FROM profile_settings ps
 WHERE ps.user_id = we.user_id;

-- Inline verification (Pitfall G-6)
DO $$
DECLARE
  followers_count bigint;
BEGIN
  SELECT COUNT(*) INTO followers_count
    FROM wear_events
   WHERE visibility = 'followers';

  IF followers_count > 0 THEN
    RAISE EXCEPTION 'Backfill bug: % rows ended up with visibility=followers; backfill must only produce public or private', followers_count;
  END IF;
END $$;

COMMIT;
```

**Why this matters:** A silent privacy regression (mapping `worn_public=false` to `'followers'` instead of `'private'`) is invisible at runtime. Pushing the assertion into the migration transaction makes the bug **un-ignorable** — the prod migration fails loudly instead of silently exposing private wears.

### Pattern 2: InitPlan-Optimized RLS (canonical — copy verbatim)

**What:** Wrap `auth.uid()` and other session functions in `(SELECT auth.uid())` subqueries so Postgres runs them once per statement via InitPlan rather than once per row.

**When to use:** Every single RLS policy in Phase 11 — without exception.

**Example (from `supabase/migrations/20260422000000_phase10_activities_feed_select.sql`):**
```sql
-- Source: codebase
CREATE POLICY activities_select_own_or_followed ON public.activities
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.follows
      WHERE follows.follower_id = (SELECT auth.uid())
        AND follows.following_id = activities.user_id
    )
  );
```

**Supabase's own advisor lints for this pattern** [CITED: supabase.com/docs/guides/database/database-advisors?lint=0003_auth_rls_initplan]. Bare `auth.uid()` in a RLS predicate is flagged as `0003_auth_rls_initplan` — the DEBT-02 audit must confirm the existing three files pass this lint.

### Pattern 3: Drizzle-for-Columns, Raw-SQL-for-Everything-Else

**What:** Use `drizzle-kit generate` to produce the `ALTER TABLE ADD COLUMN` migration for the `wear_events` changes. Write the enum creation, storage RLS, pg_trgm, and DEBT-02 patch migrations by hand under `supabase/migrations/`.

**When to use:** Matches D-08 exactly. Every existing migration in the repo follows this split.

**Drizzle-generated (will look like):**
```sql
-- drizzle/0003_phase11_wear_events_columns.sql (auto-generated)
ALTER TABLE "wear_events" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "wear_events" ADD COLUMN "visibility" "wear_visibility" DEFAULT 'public' NOT NULL;
```

**Hand-written (not drizzle-kit):** enum creation, backfill, `DO $$` verification, length CHECK constraint on `note` (CHECK constraints in Drizzle are possible but repo precedent is raw SQL for ALTERs that include CHECK) — all go in `supabase/migrations/20260423000001_phase11_wear_visibility.sql`.

### Anti-Patterns to Avoid

- **Bare `auth.uid()` in policies** — triggers `0003_auth_rls_initplan` advisor lint; causes per-row function calls that blow up query plans at scale. Always `(SELECT auth.uid())`.
- **Enabling RLS without policies in the same migration** — existing data goes invisible until policies land. Always enable + write policies in the same transaction (codified in v2.0 retrospective).
- **Dropping `worn_public` in Phase 11** — violates D-06; creates a "running app reads a dropped column" window. Phase 12 owns the drop after DAL rewrites land.
- **Storing full signed URLs in `wear_events.photo_url`** — signed URLs expire; storing them means stale DB rows. Store path only (`"{user_id}/{wear_event_id}.jpg"`); mint signed URLs at read time.
- **Creating the Storage bucket via dashboard click** — breaks reproducibility. Create via SQL `INSERT INTO storage.buckets` inside the migration file (see §SQL Snippet: Bucket Creation).
- **Using `gist_trgm_ops` for read-heavy columns** — 3× slower reads than GIN for no material win in our workload.
- **Creating the `pg_trgm` extension without `SCHEMA extensions`** — Supabase-idiomatic placement is the `extensions` schema, not `public`. Missing this does not break functionality but violates Supabase conventions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Case-insensitive search on `profiles.username` | Custom lowercased column + trigger | `profiles.username ILIKE '%query%'` with `gin_trgm_ops` index | pg_trgm accelerates `ILIKE` directly; no schema denormalization needed [VERIFIED: postgresql.org/docs/current/pgtrgm.html] |
| 30-day dedup window for watch-overlap notifications | Custom time-bucket column stored in the row | Partial UNIQUE index on `(user_id, brand_norm, model_norm, created_at::date)` + Server Action does 30-day window query before insert | D-11 locked; DB enforces per-day idempotence, app enforces the longer window |
| Self-notification prevention | App-layer check only in every call site | Postgres CHECK constraint `CHECK (actor_id IS NULL OR actor_id != user_id)` | D-12 locked; belt-and-braces — CHECK is the backstop |
| Postgres enum evolution | Custom `text` column with enum shim in the app | `CREATE TYPE notification_type AS ENUM (...)` with all four values upfront | D-09 locked; pre-populating `price_drop` and `trending_collector` avoids `ALTER TYPE ADD VALUE` later (which cannot run inside a transaction) |
| Two-layer privacy enforcement | RLS only OR DAL WHERE only | Both (v2.0 precedent) | v2.0 retrospective: single-layer is fragile; either breaking alone is still caught if the other is in place |
| Per-type payload validation | DB CHECK constraint per type via jsonb path predicates | TypeScript discriminated union enforced at every insert site | D-10 locked; mirrors `activities.metadata` pattern already in codebase |
| Running `create extension pg_trgm` via dashboard | Manual click | SQL `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions` in migration file | Pitfall C-1 — dashboard-only enabling does not replicate to other environments |

**Key insight:** Postgres, Supabase, and Drizzle already provide every primitive Phase 11 needs. Every "we could build…" temptation has a first-class off-the-shelf equivalent. Phase 11's discipline is to **use the primitives** rather than re-implement them in TypeScript.

## Runtime State Inventory

Phase 11 adds new infrastructure; it does not rename or migrate any existing identifier. The only runtime-state concern is the backfill of `wear_events.visibility` from `profile_settings.worn_public`.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `wear_events` rows (count unknown locally; non-zero in prod per v2.0 shipped state). Each row's `visibility` must be populated from `profile_settings.worn_public` in the same transaction that adds the column. | **Data migration** in Migration 1: `ADD COLUMN visibility ... DEFAULT 'public' NOT NULL` → `UPDATE wear_events SET visibility = CASE ps.worn_public WHEN true THEN 'public' ELSE 'private' END FROM profile_settings ps WHERE ps.user_id = we.user_id` → inline `DO $$ RAISE EXCEPTION` verification. |
| Live service config | None. No n8n workflows, Datadog services, Cloudflare Tunnels, or Tailscale ACLs in the Horlo stack. | None. |
| OS-registered state | None. Horlo runs on Vercel (stateless) + Supabase (managed). No Task Scheduler, pm2, launchd, or systemd registrations. | None. |
| Secrets / env vars | No renames. Phase 11 introduces no new env var. `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` all remain unchanged. | None. |
| Build artifacts / installed packages | Two new NOT installed in Phase 11 — `sonner` and `heic2any` land in Phase 14/15. Phase 11 adds no node_modules. | None. |

**The canonical rename question does not apply** — Phase 11 is pure additive infrastructure. The one backfill concern (Category 1) is already handled in Migration 1 with inline verification.

## Common Pitfalls

### Pitfall 1: Backfill sends `worn_public=false` wears to `'followers'` (Pitfall G-6)

**What goes wrong:** A migration that writes `UPDATE wear_events SET visibility = CASE ps.worn_public WHEN true THEN 'public' ELSE 'followers' END` silently exposes previously-private wears to every follower. User trust is broken; the bug is invisible until a user checks their worn tab.

**Why it happens:** "Followers" feels like a reasonable middle ground for legacy data. It is not — the user's explicit prior choice was "private."

**How to avoid:** The backfill CASE maps `true → 'public'`, `false → 'private'`. **Never `'followers'`.** Add the `DO $$ RAISE EXCEPTION IF COUNT(*) WHERE visibility = 'followers' > 0` verification block to the same transaction. This is the cost-free failsafe that catches the bug in the migration itself.

**Warning signs:** Post-migration `SELECT visibility, COUNT(*) FROM wear_events GROUP BY visibility` shows any rows with `'followers'` that predate v3.0.

### Pitfall 2: Storage RLS policy JOIN causes per-object row scan on `wear_events` (Pitfall F-1)

**What goes wrong:** The three-tier `storage.objects` SELECT policy joins back to `wear_events` and `follows`. If the JOIN is written naively, every storage access (including thumbnail renders) triggers a full `wear_events` scan, crushing latency.

**Why it happens:** `storage.objects` does not have the same InitPlan affordances as public tables — Supabase's storage schema uses a different executor path. Developers copy the `EXISTS (SELECT 1 FROM ...)` pattern without wrapping the `auth.uid()` call.

**How to avoid:**
1. Wrap every `auth.uid()` call inside the storage policy as `(SELECT auth.uid())` — this triggers InitPlan just like table RLS.
2. Make sure `wear_events.id` is indexed (it is — it's the primary key).
3. Parse `{user_id}/{wear_event_id}.jpg` using `(storage.foldername(name))[1]` for the user_id portion and `split_part(storage.filename(name), '.', 1)` for the wear_event_id portion.
4. Write each of the three tiers as a disjunct inside the USING clause and let the planner short-circuit. See §SQL Snippet: Three-Tier Storage SELECT for the canonical form.

**Warning signs:** Supabase dashboard → Storage logs show multi-hundred-ms latency on wear-photo reads. The storage advisor lint flags the policy.

### Pitfall 3: `pg_trgm` extension created without schema qualifier

**What goes wrong:** `CREATE EXTENSION IF NOT EXISTS pg_trgm` (without `WITH SCHEMA extensions`) places the extension in `public`. Supabase's advisor flags this as a security-posture concern and it can collide with user objects.

**Why it happens:** Training data examples frequently omit the schema qualifier.

**How to avoid:** Always `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;` [VERIFIED: .planning/research/STACK.md §pg_trgm — Supabase-idiomatic].

**Warning signs:** Supabase advisor lint `0015_extension_in_public` fires after the migration.

### Pitfall 4: GIN index with wrong ops class silently falls back to seq scan

**What goes wrong:** Creating `CREATE INDEX idx ON profiles USING gin (username)` (no `gin_trgm_ops`) creates a GIN index that does not support `ILIKE`. The index exists and is updated on writes but never selected by the planner for `ILIKE '%query%'`. Search is slow in prod; fast on dev where pg_trgm happens to already be present.

**Why it happens:** Training data shows many GIN examples without the trigram operator class. Postgres does not error — the index is valid, just useless for this query pattern.

**How to avoid:** Explicitly specify `gin_trgm_ops`:
```sql
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm
  ON profiles USING gin (username gin_trgm_ops);
```
Verify post-migration with `EXPLAIN ANALYZE SELECT * FROM profiles WHERE username ILIKE '%foo%'` — must show `Bitmap Index Scan on idx_profiles_username_trgm`.

### Pitfall 5: Notifications partial UNIQUE dedup index prevents legit re-adds

**What goes wrong:** A partial UNIQUE index on `(user_id, brand_norm, model_norm, created_at::date) WHERE type='watch_overlap'` means if User X adds the same watch again on the same calendar day, no new notification is generated for any recipient. At 30-day scale, the **Server Action** must do the longer-window check; the index enforces only "once per day per recipient."

**Why it happens:** Developer conflates the 30-day window with the index predicate.

**How to avoid:** Read D-11 carefully. DB index = per-day idempotence. Server Action = 30-day idempotence. Both exist; they do different things. See §SQL Snippet: Watch-Overlap Dedup Index.

### Pitfall 6: DEBT-02 converts a working policy and introduces a typo

**What goes wrong:** The DEBT-02 audit rewrites a policy that was working fine, subtly changing its semantics (e.g., dropping `TO authenticated`, reordering USING vs. WITH CHECK). Policies on `users`/`watches`/`user_preferences` are foundational — a regression here breaks the whole app.

**Why it happens:** D-14 says "patch-minimal," but the patch-minimal scope is easy to misjudge.

**How to avoid:**
1. Before writing Migration 5, **read** `supabase/migrations/20260420000000_rls_existing_tables.sql` (included as a Canonical Ref in CONTEXT.md).
2. Explicitly list what's already correct: `(SELECT auth.uid())` form — yes (already correct). `WITH CHECK` on UPDATE — yes (already correct). INSERT policy on `user_preferences` — yes (already exists).
3. If everything is already correct, Migration 5 should either (a) not exist, or (b) exist only as a no-op comment stating the audit passed, plus the integration test suite. This is the honest outcome.
4. If anything is not correct, the patch surgically fixes only the broken line.

**Warning signs:** Migration 5 has more than ~20 lines of DDL. That is a rewrite, not a patch.

### Pitfall 7: `'use cache'` wrapping a signed-URL generator leaks other users' URLs (Pitfall F-2, B-6)

**What goes wrong:** A DAL function decorated with `'use cache'` generates signed URLs and is called from Phase 15's wear detail route. The signed URL gets cached per function arguments; two users end up sharing a cached response; User A's signed URL is served to User B.

**Why it happens:** Signed URLs look like static image URLs; caching them feels natural.

**How to avoid (Phase 11 scope):** Phase 11 does not write any signed-URL code (that's Phase 15). But the **documented constraint** the planner must carry forward is: Phase 15's signed-URL DAL must NEVER be decorated with `'use cache'`, and must always accept `viewerId` as an explicit argument if any caching is layered above it. Phase 11 lands the storage bucket; signed URL minting is Phase 15's job.

**Warning signs:** Grep `grep -r "use cache" src/` after Phase 15 and inspect every match — none should call `createSignedUrl`.

### Pitfall 8: Dropping `worn_public` in Phase 11

**What goes wrong:** The v3.0 DAL (Phase 12) hasn't been rewritten yet. If Phase 11 drops `worn_public`, every running query that references it errors in prod.

**Why it happens:** "We're backfilling it, so let's drop it too." Violates D-06.

**How to avoid:** Explicitly do not write `DROP COLUMN worn_public` in any Phase 11 migration. Phase 12 owns this in its own cleanup migration after DAL rewrites land.

**Warning signs:** Any Phase 11 migration file contains the string `DROP COLUMN worn_public`.

## Code Examples (Verified SQL Snippets)

All snippets below are ready for the planner to copy into migration files. They incorporate the InitPlan pattern, the storage-RLS-JOIN shape, and the inline verification pattern.

### SQL Snippet 1: `wear_events` Extension + Backfill + Verification (Migration 1 core)

```sql
-- supabase/migrations/20260423000001_phase11_wear_visibility.sql
-- Source: D-05, D-07, D-08, Pitfall G-6, §SQL Snippet 1 of this RESEARCH.md

BEGIN;

-- Enum: wear_visibility with all three tiers
CREATE TYPE wear_visibility AS ENUM ('public', 'followers', 'private');

-- Extend wear_events
-- Note: 'note' column already exists (added in Phase 8). This adds only photo_url and visibility.
ALTER TABLE wear_events
  ADD COLUMN photo_url text NULL,
  ADD COLUMN visibility wear_visibility NOT NULL DEFAULT 'public';

-- Add the 200-char CHECK on the already-existing `note` column
-- (Phase 8 didn't set a length cap; WYWT-09 requires it).
ALTER TABLE wear_events
  ADD CONSTRAINT wear_events_note_length CHECK (note IS NULL OR length(note) <= 200);

-- Backfill visibility from profile_settings.worn_public
-- Mapping: true  → 'public', false → 'private'   (Pitfall G-6)
UPDATE wear_events we
   SET visibility = CASE ps.worn_public
                      WHEN true  THEN 'public'::wear_visibility
                      ELSE            'private'::wear_visibility
                    END
  FROM profile_settings ps
 WHERE ps.user_id = we.user_id;

-- Inline verification: no wear_events row may end up with visibility='followers' after backfill
DO $$
DECLARE
  followers_count bigint;
BEGIN
  SELECT COUNT(*) INTO followers_count
    FROM wear_events
   WHERE visibility = 'followers';

  IF followers_count > 0 THEN
    RAISE EXCEPTION
      'Backfill bug (Pitfall G-6): % rows ended up with visibility=followers; backfill must only produce public or private for legacy rows',
      followers_count;
  END IF;
END $$;

COMMIT;
```

### SQL Snippet 2: `notifications` Table + RLS + Dedup Index (Migration 2)

```sql
-- supabase/migrations/20260423000002_phase11_notifications.sql
-- Source: D-09 through D-13, Pitfalls B-3, B-4, B-7, B-9

BEGIN;

-- Enum type with ALL v3.0 notification types (D-09)
-- price_drop and trending_collector are stubs — no write-path in v3.0, but defined here
-- so Phase 13 doesn't need a non-transactional ALTER TYPE later.
CREATE TYPE notification_type AS ENUM (
  'follow',
  'watch_overlap',
  'price_drop',
  'trending_collector'
);

-- Table
CREATE TABLE notifications (
  id          uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id    uuid              NULL     REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  payload     jsonb             NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz       NULL,
  created_at  timestamptz       NOT NULL DEFAULT now(),
  CONSTRAINT notifications_no_self_notification
    CHECK (actor_id IS NULL OR actor_id != user_id)   -- D-12, Pitfall B-9
);

-- Indexes
CREATE INDEX notifications_user_id_idx
  ON notifications (user_id);

-- Partial index on unread rows — accelerates getUnreadCount() (Phase 13 DAL)
CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;

-- List/sort index for /notifications page
CREATE INDEX notifications_user_created_at_idx
  ON notifications (user_id, created_at DESC);

-- Watch-overlap dedup UNIQUE partial index (D-11, Pitfall B-3)
-- "Same recipient + same normalized watch + same calendar day = one notification."
-- The 30-day window is enforced by the Server Action (Phase 13), not the index.
CREATE UNIQUE INDEX notifications_watch_overlap_dedup
  ON notifications (
    user_id,
    (payload->>'watch_brand_normalized'),
    (payload->>'watch_model_normalized'),
    ((created_at AT TIME ZONE 'UTC')::date)
  )
  WHERE type = 'watch_overlap';

-- RLS (D-13)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Recipient-only SELECT (Pitfall B-4)
CREATE POLICY notifications_select_recipient_only ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Recipient-only UPDATE (for read_at toggling — "Mark all read")
-- Note: WITH CHECK prevents the recipient from reassigning user_id to someone else.
CREATE POLICY notifications_update_recipient_only ON notifications
  FOR UPDATE
  TO authenticated
  USING  (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Explicitly NO INSERT policy for anon/authenticated (D-13).
-- All inserts go through Server Actions running under service-role Drizzle client, which bypasses RLS.
-- Explicitly NO DELETE policy — deletions only happen via ON DELETE CASCADE from users.

COMMIT;
```

**Note on the dedup index timezone:** D-11 says "30-day window in Server Action, not DB." The DB index bucket is "same calendar day in UTC." Callers in Phase 13 must be aware of this when formulating overlap checks. UTC is the right choice for a multi-timezone future even though current users are all US-based — prevents timezone-boundary bugs later.

### SQL Snippet 3: `pg_trgm` Extension + GIN Indexes (Migration 3)

```sql
-- supabase/migrations/20260423000003_phase11_pg_trgm.sql
-- Source: SRCH-08, STACK.md §pg_trgm, Pitfall C-1

BEGIN;

-- Supabase-idiomatic: place the extension in the extensions schema, not public.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- GIN indexes for ILIKE acceleration on profiles search (SRCH-04).
-- Use gin_trgm_ops (3× faster reads than gist_trgm_ops; acceptable build cost for read-heavy column).
-- Note: username is already UNIQUE with a B-tree (from profiles_username_idx) — this adds a
-- SEPARATE GIN index that serves leading-wildcard ILIKE queries. Both can coexist.
CREATE INDEX IF NOT EXISTS profiles_username_trgm_idx
  ON profiles USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_bio_trgm_idx
  ON profiles USING gin (bio gin_trgm_ops);

COMMIT;
```

**Normalized/lowercase column question (Claude's Discretion):** Postgres `ILIKE` is already case-insensitive and works directly against `username gin_trgm_ops`. No separate `username_lower` column is needed. A lowercase column would be a denormalization hazard (must be kept in sync via trigger). **Recommendation: skip it.** ILIKE + GIN trigram is sufficient.

**Bio minimum-length guard (Pitfall C-5, Claude's Discretion):** The simplest layer is the DAL in Phase 16 (`searchProfiles(query, viewerId, limit)` rejects bio matches if `query.length < 4`). Not Phase 11's concern — only document the expected enforcement layer. **Recommendation: enforce in the DAL**, not at the DB (a CHECK on query length is not a concept Postgres supports directly). Phase 16 planner will wire this.

### SQL Snippet 4: Storage Bucket + Three-Tier RLS (Migration 4)

```sql
-- supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql
-- Source: D-01, D-02, D-03, WYWT-13, WYWT-14, Pitfalls F-1, F-4

BEGIN;

-- Create bucket (private, 5MB limit, JPEG/PNG/WEBP only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wear-photos',
  'wear-photos',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SELECT policy — three-tier visibility enforcement (D-01)
-- ============================================================================
-- Parses the storage name "{user_id}/{wear_event_id}.jpg":
--   (storage.foldername(name))[1] = user_id string
--   split_part(storage.filename(name), '.', 1) = wear_event_id string
--
-- Four disjunct branches (short-circuits on the first match):
--   1. Owner always sees their own files
--   2. Public-visibility: anyone authenticated can read (signed URL still required per D-02,
--      but any authenticated viewer who has the signed URL passes the policy)
--   3. Followers-visibility: requires a follow relationship
--   4. Private-visibility: owner-only (subsumed by branch 1, kept explicit for clarity)
--
-- All auth.uid() calls wrapped in (SELECT auth.uid()) for InitPlan caching.
-- ============================================================================

CREATE POLICY wear_photos_select_three_tier ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'wear-photos'
    AND (
      -- Branch 1: owner — always sees own files (covers private + all other tiers)
      (storage.foldername(name))[1] = (SELECT auth.uid())::text

      -- Branch 2: public-visibility wear
      OR EXISTS (
        SELECT 1 FROM wear_events we
        WHERE we.id::text = split_part(storage.filename(name), '.', 1)
          AND we.visibility = 'public'
      )

      -- Branch 3: followers-visibility AND viewer follows actor
      OR EXISTS (
        SELECT 1
          FROM wear_events we
          JOIN follows f
            ON f.following_id = we.user_id
         WHERE we.id::text = split_part(storage.filename(name), '.', 1)
           AND we.visibility = 'followers'
           AND f.follower_id = (SELECT auth.uid())
      )
    )
  );

-- ============================================================================
-- INSERT policy — folder enforcement (D-03, Pitfall F-4)
-- User may upload ONLY into their own folder.
-- ============================================================================

CREATE POLICY wear_photos_insert_own_folder ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'wear-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ============================================================================
-- UPDATE policy — folder enforcement on both sides
-- ============================================================================

CREATE POLICY wear_photos_update_own_folder ON storage.objects
  FOR UPDATE
  TO authenticated
  USING      (bucket_id = 'wear-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'wear-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- ============================================================================
-- DELETE policy — folder enforcement
-- ============================================================================

CREATE POLICY wear_photos_delete_own_folder ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'wear-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

COMMIT;
```

**Why this shape (SELECT policy design choices):**

1. **Owner branch first** — short-circuits the JOIN for the hot path (user viewing their own feed). Avoids the wear_events scan when possible.
2. **`EXISTS (SELECT 1 ...)` not `OR x IN (SELECT ...)`** — `EXISTS` lets the planner use a semi-join and stop at the first match.
3. **`(SELECT auth.uid())` inside `EXISTS`** — still InitPlan-cached. Verified against `supabase/migrations/20260422000000_phase10_activities_feed_select.sql` which uses the same shape.
4. **No `profile_public` check** — D-01 says "three visibility tiers" only. The `profile_public` gate belongs in the `wear_events` table RLS (Phase 12) and in the DAL, not in storage RLS. Keeping storage RLS focused on visibility + follow avoids triple-layer entanglement.
5. **Cast `wear_event_id` to text for the column comparison** — `split_part` returns text; `wear_events.id` is uuid; `we.id::text = split_part(...)` is the canonical comparison. [VERIFIED: existing PITFALLS.md F-1 snippet uses the same cast]
6. **Signed URL for public wears (D-02)** — the `public-visibility` branch of the SELECT policy still requires `auth.uid()` via `TO authenticated`, so only an authenticated viewer with the signed URL passes. This is the "long-TTL signed URL acts like an unsigned URL for practical purposes" design.

**Signed URL TTL recommendation (Claude's Discretion):**
- Supabase `createSignedUrl` has no documented maximum TTL as of April 2026 [VERIFIED: web search 2026-04]. Anecdotal reports accept values up to one year (31_536_000 seconds).
- Recommended TTL: **7 days (604_800 seconds)** for public-visibility wears. This is the upper bound that still gets rotated often enough for security posture, with enough slack that a user returning from a weeklong break doesn't hit a broken image.
- Followers/private wears: **1 hour (3600 seconds)** — shorter because possession of the URL is effectively the access grant. Shorter TTL limits blast radius if the URL leaks.
- Phase 15 will implement the mint-at-read-time pattern. Phase 11's job is just to ensure signed URLs **can** be minted — the bucket + RLS make this possible.

### SQL Snippet 5: DEBT-02 Audit (Migration 5)

```sql
-- supabase/migrations/20260423000005_phase11_debt02_audit.sql
-- Source: D-14, D-16, MR-03 original scope
--
-- DEBT-02 AUDIT SUMMARY (read before editing this migration):
-- --------------------------------------------------------------------
-- Audited policies in supabase/migrations/20260420000000_rls_existing_tables.sql:
--   - public.users:            4 policies (SELECT/INSERT/UPDATE/DELETE)
--   - public.watches:          4 policies (SELECT/INSERT/UPDATE/DELETE)
--   - public.user_preferences: 4 policies (SELECT/INSERT/UPDATE/DELETE)
--
-- Verification checklist (from D-14):
--   [x] All UPDATE policies have WITH CHECK
--         users_update_own:            USING + WITH CHECK ✓
--         watches_update_own:          USING + WITH CHECK ✓
--         user_preferences_update_own: USING + WITH CHECK ✓
--   [x] All auth.uid() wrapped in (SELECT auth.uid())
--         All 12 policies use (SELECT auth.uid()) ✓
--   [x] user_preferences has INSERT policy
--         user_preferences_insert_own exists ✓
--
-- OUTCOME: The existing v2.0 migration ALREADY satisfies DEBT-02.
-- No DDL changes are required. This migration exists as:
--   (a) a no-op audit trail in version control, and
--   (b) a trigger for the accompanying integration test suite to run.
--
-- If this audit were to reveal defects, fixes would go here (DROP POLICY ...;
-- CREATE POLICY ... WITH CHECK ...). For this repo at 2026-04-22, nothing is broken.
-- --------------------------------------------------------------------

BEGIN;

-- Intentionally empty: DEBT-02 audit passed on existing policies.
-- See comment block above for what was verified.
-- Integration tests in tests/integration/debt02-rls-audit.test.ts provide the ongoing regression
-- gate; this file exists to make the audit act visible in the migration history.

-- Sanity assertion: fail the migration if any of the expected 12 policies do not exist.
-- (Belt-and-braces: catches a future schema drift that silently loses a policy.)
DO $$
DECLARE
  missing_policies text[];
  p_name text;
  expected_policies text[] := ARRAY[
    'users_select_own', 'users_insert_own', 'users_update_own', 'users_delete_own',
    'watches_select_own', 'watches_insert_own', 'watches_update_own', 'watches_delete_own',
    'user_preferences_select_own', 'user_preferences_insert_own',
    'user_preferences_update_own', 'user_preferences_delete_own'
  ];
BEGIN
  FOREACH p_name IN ARRAY expected_policies LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND policyname = p_name
    ) THEN
      missing_policies := array_append(missing_policies, p_name);
    END IF;
  END LOOP;

  IF array_length(missing_policies, 1) > 0 THEN
    RAISE EXCEPTION 'DEBT-02 audit: missing expected policies: %', missing_policies;
  END IF;
END $$;

COMMIT;
```

**DEBT-02 expected outcome:** Phase 11's DEBT-02 migration is **mostly empty** because the existing migrations are already correct. That is the honest outcome of a patch-minimal audit against a clean baseline. The planner should not be tempted to rewrite; the audit comment block and the sanity-assertion `DO $$` IS the deliverable.

**If the audit surfaces a real defect:** Add the surgical fix ABOVE the sanity assertion. Example (not needed here — for documentation only):
```sql
-- Example patch pattern — ONLY use if audit reveals a real defect:
-- (1) convert a bare auth.uid() to (SELECT auth.uid()):
DROP POLICY IF EXISTS watches_select_own ON public.watches;
CREATE POLICY watches_select_own ON public.watches
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- (2) add WITH CHECK to a policy that lacks it:
DROP POLICY IF EXISTS watches_update_own ON public.watches;
CREATE POLICY watches_update_own ON public.watches
  FOR UPDATE
  TO authenticated
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- (3) add a missing INSERT policy:
CREATE POLICY user_preferences_insert_own ON public.user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
```

### Drizzle Schema Additions (for `src/db/schema.ts`)

```typescript
// Source: derived from existing schema.ts + CONTEXT.md D-08
// Add these to src/db/schema.ts (do NOT replace existing definitions).

import { pgEnum } from 'drizzle-orm/pg-core'

// ----- Phase 11: wear_visibility enum + wear_events columns -----

// pgEnum declaration at module top (after existing imports)
export const wearVisibilityEnum = pgEnum('wear_visibility', ['public', 'followers', 'private'])

// Extend wear_events — add photoUrl and visibility to the existing table definition.
// (Edit the existing `export const wearEvents = pgTable('wear_events', { ... })` block.)
export const wearEvents = pgTable(
  'wear_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    watchId: uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' }),
    wornDate: text('worn_date').notNull(),
    note: text('note'),                          // existing — 200-char CHECK added in raw migration
    // NEW Phase 11 columns:
    photoUrl: text('photo_url'),
    visibility: wearVisibilityEnum('visibility').notNull().default('public'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('wear_events_watch_worn_at_idx').on(table.watchId, table.wornDate),
    unique('wear_events_unique_day').on(table.userId, table.watchId, table.wornDate),
  ]
)

// ----- Phase 11: notifications table -----

export const notificationTypeEnum = pgEnum('notification_type', [
  'follow',
  'watch_overlap',
  'price_drop',
  'trending_collector',
])

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    // Note: Drizzle does NOT support partial indexes, CHECK constraints, or index expressions in the
    // pg-core DSL as of drizzle-orm@0.45.2. The partial unread index, the watch_overlap dedup
    // UNIQUE, and the no_self_notification CHECK constraint are declared in the raw SQL migration
    // (Migration 2), not here. Drizzle's schema.ts is still the source of truth for column shapes
    // and type inference — the raw SQL migration adds index/constraint objects Drizzle cannot express.
  ]
)
```

**Important Drizzle limitation:** Drizzle-kit will generate column-level DDL from this schema but **cannot** generate:
- The `CHECK (note IS NULL OR length(note) <= 200)` constraint on `wear_events.note`
- The partial UNIQUE index on `notifications (user_id, payload->>'...', ...)` with `WHERE type='watch_overlap'`
- The partial `notifications_user_unread_idx` with `WHERE read_at IS NULL`
- The CHECK constraint `notifications_no_self_notification`
- The pgEnum creation statements (drizzle-kit DOES handle these in newer versions but the existing repo migrations do not rely on this — consistent with D-08)

This is **fine** — D-08 explicitly says "Drizzle for tables/columns, raw SQL migrations for everything else." The split is:

| Thing | Lives in |
|-------|----------|
| `wear_events.photo_url` ADD COLUMN | `drizzle/0003_phase11_wear_events_columns.sql` (generated) |
| `wear_events.visibility` ADD COLUMN | same |
| `wear_visibility` enum creation | `supabase/migrations/20260423000001_phase11_wear_visibility.sql` (hand-written) |
| `wear_events.note` length CHECK | same |
| Backfill + verification | same |
| `notifications` table CREATE | `supabase/migrations/20260423000002_phase11_notifications.sql` (hand-written, **not** drizzle-kit) |
| All `notifications` indexes + constraints | same |
| `notification_type` enum | same |
| `notifications` RLS | same |

**Why not use drizzle-kit for `notifications` table creation?** Because Drizzle would generate only the column-level DDL and leave us to hand-write the rest in a second file. Consolidating into one migration file per conceptual change (wear_visibility, notifications, pg_trgm, storage, DEBT-02) is easier to reason about than two files per change.

### Notification Payload TypeScript Discriminated Union

```typescript
// Source: D-10, D-12; to live in src/lib/types.ts or src/db/schema.ts
// (Exact file placement is planner's discretion.)

export type NotificationPayload =
  | FollowPayload
  | WatchOverlapPayload
  | PriceDropPayload
  | TrendingCollectorPayload

export interface FollowPayload {
  // actor_id = column; payload carries denormalized snapshot for rendering
  actor_username: string
  actor_display_name: string | null
}

export interface WatchOverlapPayload {
  watch_id: string                    // fk → watches.id
  watch_brand: string                 // snapshot for display
  watch_model: string                 // snapshot for display
  watch_brand_normalized: string      // used by dedup UNIQUE index (lower+trim)
  watch_model_normalized: string      // used by dedup UNIQUE index (lower+trim)
  actor_username: string
  actor_display_name: string | null
}

export interface PriceDropPayload {
  watch_id: string
  watch_brand: string
  watch_model: string
  old_price_usd: number
  new_price_usd: number
}

export interface TrendingCollectorPayload {
  // System notification — actor_id is NULL per D-12
  // Payload describes the trending collector (subject of the recommendation)
  collector_user_id: string
  collector_username: string
  collector_display_name: string | null
  taste_overlap_pct: number | null
}

// Type-safe insertNotification helper signature (Phase 13 will implement):
export async function insertNotification<T extends NotificationPayload>(
  input:
    | { user_id: string; actor_id: string | null; type: 'follow'; payload: FollowPayload }
    | { user_id: string; actor_id: string | null; type: 'watch_overlap'; payload: WatchOverlapPayload }
    | { user_id: string; actor_id: null; type: 'price_drop'; payload: PriceDropPayload }
    | { user_id: string; actor_id: null; type: 'trending_collector'; payload: TrendingCollectorPayload }
): Promise<void> {
  // ...
}
```

**Phase 11 responsibility:** Phase 11 only ships the DB schema. The TypeScript types above are planner guidance for Phase 13; they do not need to be added in Phase 11 itself unless the planner decides to colocate them with the `notifications` table definition in `src/db/schema.ts`.

**Key field — `payload->>'watch_brand_normalized'`:** The dedup UNIQUE index in Migration 2 references this key. Callers (Phase 13) MUST populate it as `lower(trim(brand))` at write time. Document this contract in the plan.

## Migration Ordering Rationale

```
Migration 1 (wear_visibility)  ──depends on──►  profile_settings (exists, Phase 7)
                                                wear_events     (exists, Phase 7)
                               ──enables────►  Phase 12 DAL rewrites
                                                Phase 15 WYWT photo form

Migration 2 (notifications)    ──depends on──►  users (exists, Phase 5)
                               ──enables────►  Phase 13 notifications foundation

Migration 3 (pg_trgm)          ──depends on──►  profiles (exists, Phase 7)
                               ──enables────►  Phase 16 people search

Migration 4 (storage bucket)   ──depends on──►  Migration 1 (wear_events.visibility must exist
                                                 because the SELECT policy JOINs to it)
                                                follows (exists, Phase 7)
                               ──enables────►  Phase 15 WYWT photo upload

Migration 5 (DEBT-02)          ──depends on──►  existing users/watches/user_preferences policies
                                                 from supabase/migrations/20260420000000
                               ──enables────►  peace of mind; no downstream code dependency
```

**Key constraint: Migration 4 MUST run AFTER Migration 1.** The storage SELECT policy references `wear_events.visibility` — if Migration 4 runs first, the policy creation fails because the column doesn't exist yet.

**Migration 2, 3, and 5 are order-independent relative to each other.** Any order among them works. The documented order (2→3→5) matches D-05 and groups like-with-like (data tables, then indexes, then audit).

**Rollback characteristics:**
- Each migration is a single `BEGIN ... COMMIT` block — if the transaction fails mid-flight, the DB is left in the pre-migration state.
- If a migration commits but a later migration needs to be rolled back, `supabase migration squash` or manual `DROP` statements in a new migration are the recovery path. Never edit a committed migration file.
- The most consequential rollback is Migration 1: if it commits and Phase 12 later needs to roll it back, `DROP COLUMN visibility`, `DROP TYPE wear_visibility` is straightforward because no downstream DAL reads `visibility` yet (Phase 12 adds those reads).

**Prod migration command** (from `docs/deploy-db-setup.md`):
```bash
supabase db push --linked --include-all
```
This runs all un-applied migrations in filename order. The five Phase 11 files will run in the order above.

## Risk Register

| Migration | Blast Radius if Fails Mid-Deploy | Manual Recovery Path |
|-----------|----------------------------------|----------------------|
| Migration 1 (wear_visibility) | **HIGH** — a committed-but-incorrect backfill silently exposes private wears. Mitigated by the inline `DO $$ RAISE EXCEPTION` block; a wrong backfill fails the transaction, not the app. | If the transaction fails: nothing to do — DB is pre-migration state. Fix the SQL and retry. If the transaction commits with a bug (should be impossible if verification block is correct): write a new migration that flips the wrongly-mapped rows. |
| Migration 2 (notifications) | **LOW** — new table, no downstream reads yet. If it fails, the app still works. | Drop the partial constraints, retry. If the `notification_type` enum got created but the rest failed: `DROP TYPE notification_type;` at the start of the retried migration (use `IF EXISTS`). |
| Migration 3 (pg_trgm) | **LOW** — indexes are pure performance; if missing, search is slow but not broken. | Retry. `CREATE INDEX IF NOT EXISTS` makes it idempotent. |
| Migration 4 (storage bucket + RLS) | **MEDIUM** — if the bucket gets created but a policy fails, the bucket is live with whatever default storage policy Supabase applies (which is "no read, no write" — safe failure mode). | Drop the bucket (`DELETE FROM storage.buckets WHERE id='wear-photos';`), retry. Or add missing policies in a follow-up migration. |
| Migration 5 (DEBT-02) | **LOW** — verification-only in the expected clean-baseline case. | If the sanity assertion fires (a policy from the v2.0 set is missing), recreate it using Snippet 5's example pattern. |

**Deploy-order dependency:** If Migration 4 runs but Migration 1 didn't run first, Migration 4 fails on "column wear_events.visibility does not exist." Since `supabase db push --linked --include-all` runs in filename order, this is only a risk if someone manually skips Migration 1 — the default CLI path is safe.

**Irreversible-ish operations:** None. Everything in Phase 11 is reversible with a follow-up migration. `CREATE TYPE` requires `DROP TYPE ... CASCADE` which also drops columns using the type — so rolling back the enum requires dropping `wear_events.visibility` first. `CREATE EXTENSION` can be reversed with `DROP EXTENSION`, though it's unusual.

## pg_trgm Performance Notes

**Claim to verify:** Does `lower(username) gin_trgm_ops` outperform direct `username gin_trgm_ops`?

**Answer:** **No — ILIKE is already case-insensitive.** pg_trgm's `gin_trgm_ops` opclass supports ILIKE directly. Adding a functional index on `lower(username)` would require rewriting every query to `WHERE lower(username) LIKE lower(...)` — a pointless denormalization.

[VERIFIED: postgresql.org/docs/current/pgtrgm.html — `gin_trgm_ops` supports `ILIKE` natively; no case-folding required.]

**What about `bio`, which can be long?**
- `gin_trgm_ops` works on text of any length. GIN entry size grows with trigram count, but profile bios are typically < 500 chars — index size is manageable.
- The real performance risk is **cardinality** of low-selectivity queries ("search for 'collector'" matches everyone). pg_trgm handles this via the bitmap index scan + recheck — the index is not useless, it just has to scan more entries.
- **Mitigation at the DAL layer (Phase 16):** enforce a 2-char minimum on username queries and 4-char minimum on bio queries (Pitfall C-5).
- **Mitigation at the DB layer (Phase 11):** none needed. The index is correct.

**No separate normalized column needed.** ILIKE + GIN trigram is sufficient for v3.0 scale (<10k users).

**Post-migration verification query** (Phase 11 planner should document this for deployer):
```sql
-- Verify pg_trgm is enabled
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_trgm';
-- Expect: one row, version >= 1.6

-- Verify GIN indexes exist and use the right opclass
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND indexname IN ('profiles_username_trgm_idx', 'profiles_bio_trgm_idx');
-- Expect: two rows, indexdef contains "gin_trgm_ops"

-- Verify the query plan uses the index (not a Seq Scan)
EXPLAIN (ANALYZE, BUFFERS)
  SELECT id FROM profiles WHERE username ILIKE '%tyler%';
-- Expect: "Bitmap Index Scan on profiles_username_trgm_idx" at the top of the plan
```

## Signed URL TTL Recommendation

**D-02** says "signed URLs with long TTL for ALL reads." What's "long"?

**Research:** [VERIFIED: Supabase docs via web 2026-04] Supabase `createSignedUrl` has **no documented upper limit** on TTL. Anecdotal community usage accepts values up to 1 year (31_536_000 seconds). Supabase's signed *upload* URLs are capped at 2 hours, but that is a distinct API.

**Recommendation matrix:**

| Wear visibility | TTL | Reasoning |
|------------------|-----|-----------|
| `public` | **7 days (604_800 s)** | Upper-bound that still rotates often enough to limit leak blast radius. Users browsing their own feed a week later don't get broken images. |
| `followers` | **1 hour (3600 s)** | Possession of the URL IS the access grant. Short TTL limits what a leaked URL exposes. Feed regenerates URLs on every server render (Phase 15/16's concern). |
| `private` | **1 hour (3600 s)** | Same reasoning as followers. |

**Interaction with Next.js 16 `'use cache'`:** Signed URLs must **never** be returned from a `'use cache'` function. The cache key is derived from arguments; two users calling the same function with the same args would share a cached URL. [CITED: Pitfall B-6, Pitfall F-2]

**Interaction with `next/image`:** Already covered by `next.config.ts → images: { unoptimized: true }`. Use `<img>` tags directly for wear photos. Signed URLs with `?token=...` query params are cache-unfriendly anyway. [CITED: Next.js issue #88873, STACK.md]

**Phase 11 writes no signed-URL code.** The recommendation above is for the Phase 15 planner to consume. Phase 11 only ships the bucket + RLS that make signed URLs possible.

## Configuration (Integration Tests)

**Test framework:** Vitest (existing). Tests in `tests/integration/` activate only when local Supabase env vars are present (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`), matching the `tests/data/isolation.test.ts` pattern.

**New test file for Phase 11:** `tests/integration/debt02-rls-audit.test.ts` (D-15, D-16). Mirror the shape of `tests/data/isolation.test.ts`:

```typescript
// tests/integration/debt02-rls-audit.test.ts (planner target — not written in Phase 11 migration work)
// Purpose: ongoing regression gate for DEBT-02. Confirms cross-user RLS on users/watches/user_preferences.
//
// Scenarios:
//   1. anon key cannot SELECT another user's users row       → 0 rows (vs SELECT for self → 1 row)
//   2. authenticated user cannot UPDATE another user's watches row
//   3. authenticated user cannot INSERT a user_preferences row with a different user_id
//   4. authenticated user CAN INSERT their own user_preferences row
//
// Uses seedTwoUsers() from tests/fixtures/users.ts (existing).
// Gates on process.env.SUPABASE_SERVICE_ROLE_KEY being present (same as isolation.test.ts).
```

**Additional Phase 11 tests (planner's discretion):**
- Optional: `tests/integration/phase11-schema.test.ts` — lightweight assertion that `wear_events.visibility` column exists, `notifications` table exists, pg_trgm extension is present, `wear-photos` bucket exists. Single test with multiple assertions.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bare `auth.uid()` in RLS policies | `(SELECT auth.uid())` InitPlan pattern | Supabase advisor lint `0003` introduced (2023-2024) | Per-row function call → per-statement cached call; 10-100× faster plans at scale |
| `CREATE EXTENSION pg_trgm` in `public` | `... WITH SCHEMA extensions` | Supabase conventions, 2022+ | Cleaner separation; passes Supabase schema advisor lints |
| `text` columns with app-layer enum validation | Postgres `CREATE TYPE ... AS ENUM` | Postgres 8.3+ | Native type safety at DB layer; better query plans; but changing values requires `ALTER TYPE` (non-transactional) |
| Storing signed URLs in DB | Storing paths; minting URLs on read | Supabase Storage, 2022+ | Avoids stale expired URLs in DB; requires per-render signing cost (acceptable) |
| `next/image` on Supabase signed URLs | Plain `<img>` + `unoptimized: true` | Next.js 16 issue #88873 + signed URL query-param cache-unfriendliness | `next/image` gives no benefit with `unoptimized`; plain `<img>` works reliably |
| Two-tier visibility (`worn_public` boolean) | Three-tier enum (`public`/`followers`/`private`) | v3.0 product decision | Adds `'followers'` tier — product win. Migration risk: Pitfall G-6. |

**Deprecated/outdated:**
- **`worn_public` boolean** — still present in Phase 11, deprecated; Phase 12 drops it. Do NOT drop in Phase 11 (D-06).
- **`gist_trgm_ops`** — still works but 3× slower reads than GIN for our workload. Use only for write-heavy columns (not the case for profiles).

## Assumptions Log

Every non-verified claim in this research is listed here so the planner and discuss-phase can surface items that need user confirmation. The table is **empty of critical privacy/security claims** — every security-sensitive claim is either CITED from Supabase/Postgres docs, codebase-derived, or locked by CONTEXT.md decisions.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `createSignedUrl` has no documented maximum TTL as of April 2026 | Signed URL TTL Recommendation | LOW — if an undocumented cap exists (e.g., 30 days), a 7-day TTL still works; longer TTLs would silently fail. Phase 15 test will catch this. |
| A2 | 7 days is an appropriate TTL for public-visibility wear photos | Signed URL TTL Recommendation | LOW — tunable in Phase 15; no DB-level commitment made in Phase 11. |
| A3 | The existing three DEBT-02 audit targets (users/watches/user_preferences) are already correct — no DDL fix needed | §DEBT-02 Audit Pattern | MEDIUM — if a defect exists that the researcher missed, Phase 11 ships with a gap. Mitigation: Migration 5's sanity `DO $$` block at least verifies all 12 expected policies EXIST; Phase 11 planner should re-read `supabase/migrations/20260420000000_rls_existing_tables.sql` with the D-14 checklist as final verification before writing Migration 5. |
| A4 | `payload->>'watch_brand_normalized'` is the right key name for the dedup index | Migration 2, Notification payload types | LOW — if Phase 13 picks a different key name, the dedup index becomes inert (doesn't break anything, just stops deduping). Documentation in this research pins the contract; planner should confirm with the D-09/D-11 decisions. |
| A5 | Storing `photo_url` as path-only (not full URL) is correct | Architecture Patterns | Very low — D-02 implies this (signed URLs minted at read time); STACK.md explicitly says "store only the storage path." This is a consensus among all CONTEXT.md-referenced docs. Listing as assumed only because no single CONTEXT.md line locks it explicitly. |
| A6 | pg_trgm 1.6+ (Supabase default version) supports `gin_trgm_ops` with `ILIKE` | Migration 3 | Very low — this is pg_trgm's core use case since version 1.1. [VERIFIED: postgresql.org/docs/current/pgtrgm.html] |

**Nothing in this table is a privacy or correctness risk** — the two MEDIUM items are (A3) an empirical claim the planner can re-verify by reading one file, and nothing else. All security-critical claims (backfill mapping, storage RLS, recipient-only notifications, CHECK constraints) are either in CONTEXT.md decisions or derived from Pitfalls documents.

## Open Questions

1. **Exact partial-UNIQUE-index expression for `notifications` dedup — does `created_at::date` work, or does it need `(created_at AT TIME ZONE 'UTC')::date`?**
   - What we know: `created_at` is `timestamptz`; casting to `date` uses the session timezone.
   - What's unclear: Supabase's session defaults; whether mixing session timezones across services risks producing a different day bucket.
   - Recommendation: Use `(created_at AT TIME ZONE 'UTC')::date` explicitly. UTC-anchored day buckets are stable across callers. Added to §SQL Snippet 2.

2. **Bio search minimum-length guard — DB trigger vs. DAL-only?**
   - What we know: Pitfall C-5 recommends 4-char minimum for bio matches. Phase 16's `searchProfiles` DAL can enforce this with an early return on `query.length < 4`.
   - What's unclear: Whether there's any value in enforcing at the DB (no — Postgres doesn't have a concept of "query parameter length constraint").
   - Recommendation: **DAL-layer enforcement only.** Phase 11 does not address this; document it as a Phase 16 planner concern.

3. **Should Phase 11 pre-populate `profile_settings.worn_public` entry for any user who doesn't have one?**
   - What we know: The backfill JOIN (`FROM profile_settings ps WHERE ps.user_id = we.user_id`) will leave `wear_events.visibility = 'public'` (the default) for any wear_events row whose user has no profile_settings row.
   - What's unclear: Does every user have a profile_settings row? Phase 7's auto-creation trigger (`20260420000002_profile_trigger.sql`) should create one per user.
   - Recommendation: **Trust the trigger.** If the trigger is working (v2.0 retrospective confirms it is), every user has a profile_settings row. The default-public fallback is a safe failure mode (wears default to public visibility, which is also the global default for new users who haven't hidden anything).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL 15+ | All migrations | ✓ | Supabase prod 15.x [VERIFIED: Supabase infra] | — |
| pg_trgm extension | Migration 3 | ✓ (pre-installed on all Supabase projects) | 1.6+ [CITED: supabase.com/docs/guides/database/extensions] | — |
| Supabase CLI | `supabase db push --linked` | ✓ required per `docs/deploy-db-setup.md` | 2.x | — |
| drizzle-kit | Drizzle-generated column migration | ✓ | 0.31.10 [VERIFIED: package.json] | — |
| Supabase Storage | Migration 4 | ✓ (all Supabase projects include Storage) | — | — |
| Local Supabase (for integration tests) | DEBT-02 verification tests | ✓ (docker-based; tests gate on `SUPABASE_SERVICE_ROLE_KEY`) | — | Tests skip if env vars absent (existing pattern) |
| Session-mode pooler (port 5432) | Drizzle migrations | ✓ | — | Required per `docs/deploy-db-setup.md` footgun T-05-06-IPV6 |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — every dependency is available in the documented environment.

## Validation Architecture

**Nyquist validation ENABLED** (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x [VERIFIED: package.json `vitest` dep — exact version TBD by planner] |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm test -- tests/integration/debt02-rls-audit.test.ts` (single file) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WYWT-09 | `wear_events.visibility` column exists with correct enum values | SQL smoke test | `psql <local-db> -c "SELECT visibility FROM wear_events LIMIT 1"` OR Vitest integration asserting enum values from DB | ❌ Wave 0 — new `tests/integration/phase11-schema.test.ts` |
| WYWT-09 | `wear_events.note` has 200-char CHECK constraint | SQL assertion | Vitest: attempt `INSERT ... note = 201_chars` expects CHECK violation | ❌ Wave 0 — same file |
| WYWT-11 | Backfill produces no `visibility='followers'` rows | Inline migration verification | Migration 1's `DO $$ RAISE EXCEPTION` block is the primary gate. Also: post-migration `SELECT visibility, COUNT(*) FROM wear_events GROUP BY visibility` shows zero `'followers'` | ✓ automatic via migration |
| WYWT-13 | `wear-photos` bucket exists and is private | SQL assertion | `SELECT public FROM storage.buckets WHERE id='wear-photos'` → false | ❌ Wave 0 |
| WYWT-14 | Owner can SELECT own files, non-follower cannot SELECT followers-visibility files, anyone authenticated CAN SELECT public-visibility files | Integration test (requires local Supabase + seeded users/wear_events) | Vitest: seed 3 users V/F/S, wear_event with each visibility, attempt cross-user reads via anon-keyed storage client | ❌ Wave 0 — `tests/integration/phase11-storage-rls.test.ts` (new, mirrors `tests/integration/home-privacy.test.ts` shape) |
| NOTIF-01 | `notifications` table has recipient-only SELECT RLS | Integration test | Vitest: seed two users, insert a notification for user A via service-role, attempt to SELECT as user B → 0 rows | ❌ Wave 0 — `tests/integration/phase11-notifications-rls.test.ts` |
| NOTIF-01 | Self-notification CHECK fires | SQL assertion | Vitest: attempt `INSERT ... actor_id = user_id` → expect CHECK violation | ❌ Wave 0 — same file |
| NOTIF-01 | Watch-overlap dedup UNIQUE index prevents duplicate row on same day | Integration test | Vitest: insert two notifications with identical `(user_id, brand_norm, model_norm, date)` → second insert with `ON CONFLICT DO NOTHING` is no-op | ❌ Wave 0 — same file |
| SRCH-08 | pg_trgm extension enabled + GIN indexes present + query plan uses index | SQL assertion | Vitest or psql smoke: `SELECT extname FROM pg_extension WHERE extname='pg_trgm'` returns row; `EXPLAIN` on `username ILIKE '%x%'` contains 'gin' | ❌ Wave 0 — `tests/integration/phase11-pg-trgm.test.ts` OR integrated into phase11-schema.test.ts |
| DEBT-02 | Cross-user read isolation on `users`/`watches`/`user_preferences` | Integration test (matches tests/data/isolation.test.ts pattern) | Vitest: two users seeded, authed as user A, attempt SELECT on user B's rows → 0 rows; attempt UPDATE on user B's row → no rows affected | ❌ Wave 0 — `tests/integration/debt02-rls-audit.test.ts` (D-15) |

### Sampling Rate

- **Per task commit:** `npm test -- tests/integration/phase11-*.test.ts tests/integration/debt02-rls-audit.test.ts` (subset — only the Phase 11 tests)
- **Per wave merge:** `npm test` (full suite — catches unintended regression in v2.0 DAL tests)
- **Phase gate:** Full suite green + manual post-migration SQL checks from §pg_trgm Performance Notes before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/phase11-schema.test.ts` — covers WYWT-09, WYWT-13 (existence + shape checks)
- [ ] `tests/integration/phase11-storage-rls.test.ts` — covers WYWT-14 (three-tier SELECT)
- [ ] `tests/integration/phase11-notifications-rls.test.ts` — covers NOTIF-01 (recipient-only, self-notif CHECK, dedup)
- [ ] `tests/integration/phase11-pg-trgm.test.ts` OR integrated into phase11-schema.test.ts — covers SRCH-08
- [ ] `tests/integration/debt02-rls-audit.test.ts` — covers DEBT-02 (D-15)
- [ ] Shared fixture additions in `tests/fixtures/users.ts` for seeding wear_events with specific visibilities and notifications rows — reuse existing `seedTwoUsers()` helper; extend if needed
- [ ] No framework install — Vitest and fixtures already in place

**Already present (no Wave 0 work needed):**
- Vitest config
- `tests/fixtures/users.ts` `seedTwoUsers()` helper (exists — referenced by `tests/data/isolation.test.ts`)
- Env-gated suite activation pattern (`maybe = hasLocalDb ? describe : describe.skip`)
- `tests/integration/home-privacy.test.ts` as a three-user seeding reference for the storage RLS test

**Coverage target:** The five new integration test files collectively exercise every locked decision that can fail in a runtime-observable way. Migration 1's inline verification covers the backfill invariant at migration time. Migration 5's `DO $$` covers the DEBT-02 schema assertion. Together, this is **sufficient** coverage — no additional smoke or E2E tests needed for Phase 11.

## Security Domain

`security_enforcement` not explicitly set in `.planning/config.json` — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (inherited from existing Supabase Auth — Phase 4/5) | — |
| V3 Session Management | no (inherited — Supabase Auth sessions) | — |
| V4 Access Control | **YES** | Postgres RLS with `(SELECT auth.uid())` InitPlan pattern on every new table + `storage.objects` policies |
| V5 Input Validation | partial | `note` CHECK constraint (length ≤ 200); notification_type enum; Drizzle type-safe inserts for columns; TypeScript discriminated union for `payload` shape (Phase 13 contract) |
| V6 Cryptography | no | Phase 11 writes no cryptographic code. Supabase handles signed URL HMAC internally. |

### Known Threat Patterns for Postgres + Supabase Storage + RLS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection in search ILIKE | Tampering | Drizzle `ilike()` helper parameterizes; raw `%${query}%` lives in the parameter value, not the SQL text |
| Cross-user read via anon key (IDOR) | Information Disclosure | RLS `user_id = (SELECT auth.uid())` on `notifications`; DEBT-02 audit confirms same pattern on `users`/`watches`/`user_preferences`; integration tests verify |
| Cross-user storage upload (Pitfall F-4) | Tampering | `(storage.foldername(name))[1] = (SELECT auth.uid())::text` WITH CHECK on INSERT/UPDATE/DELETE storage policies |
| Leaked signed URL grants unbounded access | Information Disclosure | Storage SELECT policy **still** enforces visibility tier even with a signed URL — possession of a URL alone does not pass the policy; user must be authenticated AND pass one of the three branches. 7-day TTL on public signed URLs limits blast radius. |
| Self-notification (Pitfall B-9) | Denial of Service (notification spam) / User Confusion | `CHECK (actor_id IS NULL OR actor_id != user_id)` on `notifications` |
| Notification spam from duplicate watch-overlap generation (Pitfall B-3) | Denial of Service | Partial UNIQUE index `notifications_watch_overlap_dedup` enforces per-day idempotence; Server Action enforces 30-day window |
| Backfill silently exposes private wears (Pitfall G-6) | Information Disclosure | Inline `DO $$ RAISE EXCEPTION IF COUNT(*) WHERE visibility='followers' > 0` in Migration 1 |
| Non-recipient can read notifications (Pitfall B-4) | Information Disclosure | Recipient-only SELECT RLS + no INSERT policy for anon + integration test |

**Phase 11 is the security-foundation phase of v3.0.** Every downstream privacy guarantee (Phase 12 DAL, Phase 13 notifications, Phase 15 storage upload) builds on the RLS policies Phase 11 ships. Migration 5's DEBT-02 audit verifies the pre-existing foundation is also correct.

## Sources

### Primary (HIGH confidence)

**Codebase (direct read):**
- `.planning/phases/11-schema-storage-foundation/11-CONTEXT.md` — locked decisions D-01..D-16
- `.planning/REQUIREMENTS.md` — requirement IDs WYWT-09/11/13/14, NOTIF-01, SRCH-08, DEBT-02
- `.planning/STATE.md` — v3.0 key decisions, Critical Pitfalls
- `.planning/ROADMAP.md` — Phase 11 goal, success criteria, pitfalls list
- `.planning/PROJECT.md` — v3.0 milestone constraints
- `.planning/research/SUMMARY.md` — phase ordering and risk-per-phase analysis
- `.planning/research/ARCHITECTURE.md` — schema definitions, storage RLS shape, `worn_public` migration strategy
- `.planning/research/STACK.md` — pg_trgm setup, bucket creation SQL, signed URL patterns
- `.planning/research/PITFALLS.md` §§B-3, B-4, B-7, B-9, C-1, C-5, F-1, F-3, F-4, G-6 — exhaustive pitfall catalogue
- `docs/deploy-db-setup.md` — prod migration flow (`supabase db push --linked`, session-mode pooler)
- `src/db/schema.ts` — current Drizzle schema definitions
- `supabase/migrations/20260420000000_rls_existing_tables.sql` — DEBT-02 audit target (VERIFIED correct)
- `supabase/migrations/20260420000001_social_tables_rls.sql` — canonical RLS pattern for new tables
- `supabase/migrations/20260422000000_phase10_activities_feed_select.sql` — canonical InitPlan pattern with JOIN
- `supabase/migrations/20260419999999_social_tables_create.sql` — shape of raw-SQL table creation with FKs and indexes
- `tests/data/isolation.test.ts` — DEBT-02 test pattern reference
- `tests/integration/home-privacy.test.ts` — three-user seeding reference for storage RLS tests
- `.planning/config.json` — Nyquist validation enabled
- `package.json` — drizzle-orm 0.45.2, drizzle-kit 0.31.10, supabase-js 2.103.0, postgres 3.4.9

**Official documentation:**
- [PostgreSQL pg_trgm docs](https://www.postgresql.org/docs/current/pgtrgm.html) — `gin_trgm_ops` ILIKE support; trigram decomposition
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — `storage.foldername()` + RLS pattern
- [Supabase Storage Helper Functions](https://supabase.com/docs/guides/storage/schema/helper-functions) — `storage.foldername`, `storage.filename`
- [Supabase Database Advisors — 0003 auth_rls_initplan](https://supabase.com/docs/guides/database/database-advisors?lint=0003_auth_rls_initplan) — InitPlan lint
- [Supabase Database Extensions](https://supabase.com/docs/guides/database/extensions) — pg_trgm pre-installed; `WITH SCHEMA extensions`

### Secondary (MEDIUM confidence — verified with official source cross-reference)

- [pganalyze: Understanding Postgres GIN Indexes](https://pganalyze.com/blog/gin-index) — GIN vs. GiST tradeoffs
- [Elephant Tamer: GiST vs GIN for LIKE searches](https://elephanttamer.net/?p=9) — empirical benchmark (GIN 3× faster reads, 3× slower build, 2-3× larger on disk)
- [Supabase signed URL reference](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) — `createSignedUrl(path, expiresIn)` API

### Tertiary (LOW confidence — recommendations, not authoritative)

- Signed URL TTL recommendation (7 days for public, 1 hour for private/followers) — my reasoning, no official guidance found in Supabase docs for "correct" TTL defaults. Planner/operator should confirm once deployed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version verified from package.json; all extensions verified from Supabase docs
- Architecture / migration ordering: HIGH — derived from CONTEXT.md locked decisions D-05/D-08 plus codebase migration history
- SQL snippets: HIGH — every snippet follows the canonical InitPlan pattern from `20260422000000_phase10_activities_feed_select.sql`
- pg_trgm performance: HIGH — cited multiple independent sources for GIN > GiST reads tradeoff
- Pitfalls: HIGH — all pitfalls cross-referenced from existing PITFALLS.md plus one Phase-11-specific addition (Pitfall 6: DEBT-02 rewrite risk)
- DEBT-02 outcome claim (no DDL needed): MEDIUM — I read `20260420000000_rls_existing_tables.sql` and confirmed all 12 policies look correct; planner should independently verify before committing Migration 5
- Signed URL TTL (7d/1h): LOW — my recommendation; no official Supabase guidance
- Validation architecture: HIGH — derived from existing Vitest setup + CONTEXT.md D-15

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (Supabase/Postgres extension behavior is very stable; 30 days is conservative)

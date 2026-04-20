# Phase 7: Social Schema & Profile Auto-Creation - Research

**Researched:** 2026-04-19
**Domain:** Drizzle schema extension + Supabase RLS + DB trigger-based profile auto-creation + wear events migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Postgres trigger on `auth.users` INSERT creates both a `profiles` row and a `profile_settings` row. Zero app code needed for the creation path. Defined in the same migration as the tables.
- **D-02:** No backfill script needed. There is currently one user who will delete their account and re-create it after the migration. The trigger handles all future signups.
- **D-03:** Username auto-generated from email prefix (part before @). If taken, append random digits (e.g., `tyler_4829`). User can change username later in Phase 8 profile edit.
- **D-04:** Username format: lowercase alphanumeric + underscores, 3-30 chars, must start with a letter. Enforced via CHECK constraint in Postgres.
- **D-05:** Existing Server Actions start writing activity rows immediately in Phase 7. Events: `watch_added`, `wishlist_added`, `watch_worn`. By Phase 10 (Activity Feed), there will be real historical data to display.
- **D-06:** Activity metadata includes snapshot fields (`brand`, `model`, `imageUrl`) so the feed remains readable even if the watch is later deleted.
- **D-07:** Clean break: drop `watches.lastWornDate` column entirely. The `wear_events` table becomes the sole source of truth for wear history.
- **D-08:** All components that currently read `lastWornDate` (WatchCard, WatchDetail, insights) must be updated to query `wear_events` instead. This expands Phase 7 beyond pure schema into app code changes.
- **D-09:** All five new tables get RLS enabled with separate policies per operation, using the `(SELECT auth.uid())` pattern. USING + WITH CHECK on every UPDATE policy. RLS + policies in the same migration transaction.
- **D-10:** Drizzle continues via `DATABASE_URL` — RLS is defense-in-depth alongside DAL WHERE clauses (Phase 6 D-01/D-02).

### Claude's Discretion

- Migration file organization (single vs split by table)
- Exact trigger function implementation details
- RLS policy naming convention (following Phase 6 pattern)
- Activity event type enum values beyond the three specified
- Index strategy beyond what's specified in success criteria

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-02 | Profiles table with username, display name, avatar URL, bio, auto-created on signup | DB trigger pattern on `auth.users`, Drizzle schema, username CHECK constraint |
| DATA-03 | Follows table (asymmetric follow, follower/following) with appropriate indexes | Schema design, RLS policy for follower-only INSERT, required indexes |
| DATA-04 | Activities table logging watch_added, wishlist_added, watch_worn events with user and watch references | Server Action fire-and-forget pattern, metadata snapshot strategy |
| DATA-05 | Profile settings table with profile_visibility, collection_public, wishlist_public, worn_public booleans | Schema defaults, RLS owner-only write policy |
| DATA-06 | Wear events table replacing/augmenting lastWornDate with structured wear history | Column drop migration, `lastWornDate` usage audit (7 files), DAL replacement |

</phase_requirements>

---

## Summary

Phase 7 adds five new Postgres tables to an already-migrated Supabase project, wires up a DB trigger for profile auto-creation, enables RLS on all new tables following the Phase 6 pattern, and replaces the `watches.lastWornDate` text column with a normalized `wear_events` table. The phase ends with existing Server Actions writing activity rows so Phase 10 has real historical data.

The codebase already has a working trigger pattern: `supabase/migrations/20260413000000_sync_auth_users.sql` creates `public.users` rows on `auth.users` INSERT using `SECURITY DEFINER`. Phase 7 extends this same trigger (or adds a second trigger on `public.users` INSERT) to also create `profiles` and `profile_settings` rows. The Phase 6 RLS migration (`20260420000000_rls_existing_tables.sql`) established the policy naming convention and `(SELECT auth.uid())` pattern that all new table policies must follow.

The `lastWornDate` column is used in 7 source locations across 5 files. Every usage must be replaced before the column is dropped — this is the largest app-code change in the phase and must be sequenced correctly: add `wear_events`, migrate the "mark as worn" flow, verify zero remaining `lastWornDate` reads, then drop the column.

**Primary recommendation:** Split the migration into two Supabase migration files — one for schema + RLS (Drizzle-generated + hand-annotated SQL for RLS policies), one for the profile trigger. Apply schema first, then trigger. This mirrors the existing two-migration pattern already in `supabase/migrations/`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.41.x (current project) | Schema definitions, query builder | Already in use; `src/db/schema.ts` is the single source of truth |
| drizzle-kit | ^0.31.x (current project) | Migration generation | Already in use; `drizzle.config.ts` configured |
| postgres (node driver) | current project version | DB connection | Already in use; `{ prepare: false }` for Supabase pooling |
| Supabase CLI | 2.x | Applying hand-written SQL migrations (`supabase db push --linked`) | Already in use; deploy runbook covers this |

[VERIFIED: codebase — `src/db/index.ts`, `drizzle.config.ts`, `docs/deploy-db-setup.md`]

### Migration Strategy

Two-track migration approach (already established by prior phases):

| Track | Tool | Files | Use For |
|-------|------|-------|---------|
| Drizzle migrations (`./drizzle/`) | `drizzle-kit generate` + `drizzle-kit migrate` | `0001_<name>.sql` | Table creation, column changes, indexes (Drizzle-managed objects) |
| Supabase migrations (`./supabase/migrations/`) | `supabase db push --linked` | `YYYYMMDD_<name>.sql` | RLS policies, triggers, functions (hand-written SQL; Drizzle cannot express these) |

[VERIFIED: codebase — two tracks visible in `drizzle/` and `supabase/migrations/` directories]

---

## Architecture Patterns

### Pattern 1: Extending the Existing Auth Trigger (Profile Auto-Creation)

The existing trigger fires on `auth.users` INSERT and creates a `public.users` row. For Phase 7, the profile trigger can either:

**Option A (recommended):** Add a second trigger that fires on `public.users` INSERT (after the existing sync trigger). This avoids modifying the existing working trigger and follows the single-responsibility principle.

**Option B:** Extend `handle_new_auth_user()` to also insert into `profiles` and `profile_settings`. Simpler SQL, but modifies a working trigger that has already been applied to production.

Option A is safer because the existing trigger is already deployed. The new trigger function runs on `public.users` INSERT, which is guaranteed to have already inserted by the time it fires (cascade from auth trigger).

```sql
-- supabase/migrations/YYYYMMDD_social_tables_trigger.sql
CREATE OR REPLACE FUNCTION public.handle_new_public_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  candidate_username text;
  suffix int;
BEGIN
  -- Generate username from email prefix
  base_username := lower(regexp_replace(
    split_part(NEW.email, '@', 1),
    '[^a-z0-9_]', '_', 'g'
  ));
  -- Ensure starts with a letter
  IF base_username !~ '^[a-z]' THEN
    base_username := 'u_' || base_username;
  END IF;
  -- Truncate to 26 chars (leaves room for 4-digit suffix)
  base_username := left(base_username, 26);
  -- Deduplication loop
  candidate_username := base_username;
  suffix := 0;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate_username) LOOP
    suffix := floor(random() * 9000 + 1000)::int;
    candidate_username := base_username || '_' || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, candidate_username);

  INSERT INTO public.profile_settings (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_public_user_created ON public.users;
CREATE TRIGGER on_public_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_public_user();
```

[ASSUMED] — Exact trigger syntax based on the existing working trigger pattern in `20260413000000_sync_auth_users.sql`. The `regexp_replace` approach for username generation is standard Postgres; the specific regex may need tuning for edge-case email formats.

### Pattern 2: Drizzle Schema Extension

Five new tables added to `src/db/schema.ts`, following existing conventions:

```typescript
// Source: src/db/schema.ts (existing pattern)

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    username: text('username').notNull().unique(),
    displayName: text('display_name'),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('profiles_username_idx').on(table.username)]
)

export const follows = pgTable(
  'follows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('follows_follower_idx').on(table.followerId),
    index('follows_following_idx').on(table.followingId),
    unique('follows_unique_pair').on(table.followerId, table.followingId),
  ]
)

export const profileSettings = pgTable('profile_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  profilePublic: boolean('profile_public').notNull().default(true),
  collectionPublic: boolean('collection_public').notNull().default(true),
  wishlistPublic: boolean('wishlist_public').notNull().default(true),
  wornPublic: boolean('worn_public').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const activities = pgTable(
  'activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'watch_added' | 'wishlist_added' | 'watch_worn'
    watchId: uuid('watch_id').references(() => watches.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata'), // { brand, model, imageUrl }
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('activities_user_id_idx').on(table.userId),
    index('activities_user_created_at_idx').on(table.userId, table.createdAt),
  ]
)

export const wearEvents = pgTable(
  'wear_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    watchId: uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' }),
    wornDate: text('worn_date').notNull(), // ISO date string, e.g. '2026-04-19'
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('wear_events_watch_worn_at_idx').on(table.watchId, table.wornDate),
    unique('wear_events_unique_day').on(table.userId, table.watchId, table.wornDate),
  ]
)
```

[VERIFIED: codebase — pattern matches `src/db/schema.ts` conventions for `pgTable`, `uuid`, `text`, `boolean`, `jsonb`, `timestamp`, `index`]

Note on `wornDate` type: The existing `watches.lastWornDate` column uses `text` (ISO string). `wear_events.wornDate` uses `text` for consistency with existing patterns. The ARCHITECTURE.md research originally suggested a `date` type — using `text` here avoids a Drizzle type mismatch with how dates are already handled in the codebase.

[ASSUMED] — Using `text` over `date` type for `wornDate` to match existing `acquisitionDate` / `lastWornDate` pattern. If the team prefers native `date`, use `date('worn_date')` from `drizzle-orm/pg-core`.

### Pattern 3: RLS Policies — Follow Phase 6 Template

The Phase 6 migration (`20260420000000_rls_existing_tables.sql`) established the exact naming convention and clause structure. Phase 7 policies must follow the same template:

```sql
-- Template (from Phase 6, verified):
ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY {table}_select_own ON public.{table}
  FOR SELECT USING ({ownership_col} = (SELECT auth.uid()));

CREATE POLICY {table}_insert_own ON public.{table}
  FOR INSERT WITH CHECK ({ownership_col} = (SELECT auth.uid()));

CREATE POLICY {table}_update_own ON public.{table}
  FOR UPDATE
  USING ({ownership_col} = (SELECT auth.uid()))
  WITH CHECK ({ownership_col} = (SELECT auth.uid()));

CREATE POLICY {table}_delete_own ON public.{table}
  FOR DELETE USING ({ownership_col} = (SELECT auth.uid()));
```

[VERIFIED: codebase — `supabase/migrations/20260420000000_rls_existing_tables.sql`]

**Special cases for new tables:**

| Table | Ownership Col | SELECT policy | Notes |
|-------|---------------|---------------|-------|
| `profiles` | `id` | All authenticated users can SELECT (profiles are public identifiers) | Phase 8 will add privacy-gated SELECT for `watches` |
| `follows` | `follower_id` | All authenticated users can SELECT (public follow counts) | INSERT/DELETE restricted to follower = auth.uid() |
| `profile_settings` | `user_id` | SELECT for all authenticated (app needs to read to check visibility) | Write restricted to owner only |
| `activities` | `user_id` | Owner SELECT only in Phase 7; Phase 10 will expand to feed reads | INSERT by owner only |
| `wear_events` | `user_id` | Owner SELECT only in Phase 7; `worn_public` controls Phase 8+ | INSERT/UPDATE/DELETE by owner only |

### Pattern 4: Activity Logging — Fire and Forget in Server Actions

The existing `src/app/actions/watches.ts` Server Actions follow the pattern: `getCurrentUser()` → DAL call → `revalidatePath()` → return `ActionResult`. Activity logging wraps after the DAL call in a separate try/catch so failure doesn't block the mutation:

```typescript
// Source: src/app/actions/watches.ts (existing pattern, extended)
// Inside addWatch(), after: const watch = await watchDAL.createWatch(user.id, parsed.data)
try {
  await logActivity(user.id, 'watch_added', watch.id, {
    brand: watch.brand,
    model: watch.model,
    imageUrl: watch.imageUrl ?? null,
  })
} catch (err) {
  console.error('[addWatch] activity log failed (non-fatal):', err)
  // do NOT propagate — watch was created successfully
}
```

[VERIFIED: codebase — `src/app/actions/watches.ts` structure; pattern from ARCHITECTURE.md]

### Pattern 5: lastWornDate Migration — Replace, Then Drop

The column drop must be sequenced correctly across two migration steps:

**Step A** (Drizzle migration): Add `wear_events` table. Remove `lastWornDate` from `src/db/schema.ts`. Run `drizzle-kit generate` — this produces a migration that both creates `wear_events` AND includes `ALTER TABLE watches DROP COLUMN last_worn_date`.

**Step B** (App code): Before applying the migration, update all code that reads/writes `lastWornDate`. The column drop migration must not be applied until all code changes are committed.

**Files requiring changes** (7 source locations, 5 files):

| File | Location | Change Required |
|------|----------|-----------------|
| `src/data/watches.ts` | `mapRowToWatch()` line 39 | Remove `lastWornDate` mapping |
| `src/data/watches.ts` | `mapDomainToRow()` line 73 | Remove `lastWornDate` mapping |
| `src/app/actions/watches.ts` | Zod schema line 32 | Remove `lastWornDate` field |
| `src/components/watch/WatchForm.tsx` | Default values + field mapping lines 61, 95 | Remove `lastWornDate` field |
| `src/components/watch/WatchDetail.tsx` | `handleMarkAsWorn()` line 76 | Replace `editWatch({lastWornDate})` with `logWearEvent()` Server Action |
| `src/components/watch/WatchDetail.tsx` | Display lines 94, 137-142, 370 | Replace `watch.lastWornDate` reads with wear event DAL query |
| `src/components/insights/SleepingBeautiesSection.tsx` | Line 16 | Replace `w.lastWornDate` with most-recent wear event date |
| `src/app/insights/page.tsx` | Lines 73-82, 285 | Replace `lastWornDate` references with wear event DAL |
| `src/lib/types.ts` | Line 47 | Remove `lastWornDate?: string` from `Watch` interface |

[VERIFIED: codebase — grep results for `lastWornDate` across `src/`]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Username deduplication | Custom dedup logic in Server Action | Postgres trigger with dedup loop + UNIQUE constraint | Trigger runs atomically; race conditions impossible |
| Profile existence guarantee | App-layer "upsert profile on first load" | DB trigger on `auth.users` INSERT | Trigger fires before any page load; profile always exists |
| One-wear-per-day enforcement | App-layer date check | `UNIQUE (user_id, watch_id, worn_date)` constraint + ON CONFLICT DO NOTHING | Race-condition-safe at DB level |
| RLS performance | No special code needed | `(SELECT auth.uid())` wrapper on all policies | Single evaluation per query vs. per-row |

---

## Runtime State Inventory

> This is not a rename/refactor phase in the classic sense, but the `lastWornDate` column drop IS a schema change that affects runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `watches.last_worn_date` text column — currently stores wear date as ISO string for some watches | Drizzle migration drops column; no data migration (D-07 clean break) |
| Live service config | Supabase project `wdntzsckjaoqodsyscns` — Phase 6 RLS migration must already be applied before Phase 7 migration runs | Verify Phase 6 applied (`supabase db push` should be idempotent) |
| OS-registered state | None found | None |
| Secrets/env vars | `DATABASE_URL` — session-mode pooler URL required for `drizzle-kit migrate`; `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Supabase client | No changes needed; existing vars cover all Phase 7 operations |
| Build artifacts | `drizzle/meta/0000_snapshot.json` — Drizzle state snapshot; will be extended by new migration | `drizzle-kit generate` updates this automatically |

**Sequencing constraint:** Phase 7 migration presupposes Phase 6 RLS migration has been applied. The `profiles` and `profile_settings` tables have RLS policies that reference `auth.uid()`, which requires the Supabase Auth integration to be in place (it is).

---

## Common Pitfalls

### Pitfall 1: Applying Drizzle Column Drop Before Updating App Code

**What goes wrong:** Running `drizzle-kit migrate` (which includes the `ALTER TABLE watches DROP COLUMN last_worn_date` statement) before updating `src/data/watches.ts`, `src/lib/types.ts`, and all components. The app will throw at runtime when `mapRowToWatch()` tries to read a column that no longer exists.

**Why it happens:** Developers run migrations eagerly, then fix the code. In a multi-step refactor, this order must be reversed.

**How to avoid:** Sequence is: (1) add `wear_events` table to schema and generate migration, (2) update all app code to remove `lastWornDate` references and add `wear_events` DAL, (3) build passes cleanly, (4) apply migration. Never apply the DROP COLUMN migration until the code no longer references the column.

**Warning signs:** TypeScript build errors on `watch.lastWornDate` after migration is applied.

### Pitfall 2: Trigger Function Missing SECURITY DEFINER

**What goes wrong:** The profile-creation trigger function lacks `SECURITY DEFINER`. When the trigger fires on `public.users` INSERT (which itself is triggered by `auth.users` INSERT), the execution context may not have RLS-bypass permissions. The INSERT into `profiles` (which has RLS) fails silently and no profile row is created.

**Why it happens:** Omitting `SECURITY DEFINER` is the default, and works for some trigger functions but not those that must write to RLS-protected tables.

**How to avoid:** Add `SECURITY DEFINER` and `SET search_path = public` to the trigger function. This is the same pattern as the existing `handle_new_auth_user()` function.

[VERIFIED: codebase — `supabase/migrations/20260413000000_sync_auth_users.sql` uses this pattern]

### Pitfall 3: RLS on profiles Table Blocks Trigger Insert

**What goes wrong:** RLS is enabled on `profiles` and the only policy allows SELECT for all authenticated users, but INSERT only for `id = auth.uid()`. The trigger function runs in the context of the `postgres` superuser or service role (via `SECURITY DEFINER`), which bypasses RLS entirely. This is correct behavior — but if the trigger is NOT security definer, the INSERT into `profiles` is blocked by the "owner only" INSERT policy.

**Why it happens:** Forgetting that the trigger and the RLS policy interact. The correct solution is `SECURITY DEFINER` on the trigger function, not relaxing the INSERT policy.

**How to avoid:** Always use `SECURITY DEFINER` on trigger functions that write to RLS-protected tables. Never add `FOR INSERT TO public` as a workaround — it would let any authenticated user INSERT any profile.

### Pitfall 4: Username CHECK Constraint Race During Trigger

**What goes wrong:** Two users sign up simultaneously. Both triggers read the `profiles` table, both see the same username is available, both try to insert `tyler`. One succeeds; the other fails with a UNIQUE violation and the second user has no profile row.

**Why it happens:** The deduplication WHILE loop in the trigger function is not atomic relative to concurrent inserts.

**How to avoid:** The `UNIQUE` constraint on `profiles.username` provides the final guard. The trigger function's WHILE loop is a best-effort pre-check; if the UNIQUE constraint fires, the trigger will error and the entire `public.users` INSERT will roll back. The user signup will fail and they can retry. At single-user MVP scale this is extremely unlikely. For robustness, consider catching the UNIQUE violation in the trigger and re-trying with a new random suffix (using an exception handler block).

### Pitfall 5: IPv6 DNS Issue for drizzle-kit migrate

**What goes wrong:** Running `drizzle-kit migrate` with the "Direct Connection" host (`db.wdntzsckjaoqodsyscns.supabase.co:5432`) fails DNS resolution on IPv4 networks.

**Why it happens:** Supabase's direct connection is IPv6-only.

**How to avoid:** Always use the session-mode pooler URL (port 5432 via `aws-0-<region>.pooler.supabase.com`). Documented in `docs/deploy-db-setup.md` as Footgun T-05-06-IPV6.

[VERIFIED: codebase — `docs/deploy-db-setup.md` section 2b]

### Pitfall 6: activities.watchId SET NULL on Delete Breaks Activity Feed Display

**What goes wrong:** The `activities.watch_id` FK uses `ON DELETE SET NULL`. If a watch is deleted, the activity row's `watch_id` becomes null. If the activity feed reads `watch.brand` and `watch.model` via JOIN on `watch_id`, deleted watches produce null fields and the feed shows blank entries.

**Why it happens:** Relying on the JOIN for display data instead of the metadata snapshot.

**How to avoid:** Store `brand`, `model`, `imageUrl` in `activities.metadata` (jsonb) at INSERT time (D-06). The feed renderer uses `metadata.brand` etc. as fallback (or primary) rather than JOINing to `watches`. The `watchId` field is preserved for linking to the watch detail page (when it exists).

[VERIFIED: CONTEXT.md — D-06]

---

## Code Examples

### Wear Event DAL (replaces lastWornDate reads)

```typescript
// src/data/wearEvents.ts — new file
import 'server-only'
import { db } from '@/db'
import { wearEvents } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function logWearEvent(
  userId: string,
  watchId: string,
  wornDate: string,
  note?: string
) {
  // ON CONFLICT DO NOTHING — enforces one-per-day at DB level
  await db
    .insert(wearEvents)
    .values({ userId, watchId, wornDate, note: note ?? null })
    .onConflictDoNothing()
}

export async function getMostRecentWearDate(
  userId: string,
  watchId: string
): Promise<string | null> {
  const rows = await db
    .select({ wornDate: wearEvents.wornDate })
    .from(wearEvents)
    .where(and(eq(wearEvents.userId, userId), eq(wearEvents.watchId, watchId)))
    .orderBy(desc(wearEvents.wornDate))
    .limit(1)
  return rows[0]?.wornDate ?? null
}

export async function getWearEventsByWatch(
  userId: string,
  watchId: string
) {
  return db
    .select()
    .from(wearEvents)
    .where(and(eq(wearEvents.userId, userId), eq(wearEvents.watchId, watchId)))
    .orderBy(desc(wearEvents.wornDate))
}
```

[VERIFIED: pattern matches `src/data/watches.ts` conventions — `import 'server-only'`, `db.select().from().where()`, `eq()` from `drizzle-orm`]

### Activity Logging DAL

```typescript
// src/data/activities.ts — new file
import 'server-only'
import { db } from '@/db'
import { activities } from '@/db/schema'

export type ActivityType = 'watch_added' | 'wishlist_added' | 'watch_worn'

export async function logActivity(
  userId: string,
  type: ActivityType,
  watchId: string | null,
  metadata: { brand: string; model: string; imageUrl: string | null }
) {
  await db.insert(activities).values({
    userId,
    type,
    watchId,
    metadata,
  })
}
```

### WatchDetail handleMarkAsWorn replacement

```typescript
// src/components/watch/WatchDetail.tsx — modified handler
const handleMarkAsWorn = () => {
  startTransition(async () => {
    const result = await logWearEvent(watch.id, new Date().toISOString().split('T')[0])
    if (result.success) {
      router.refresh()
    }
  })
}
```

Note: `logWearEvent` must become a Server Action (in `src/app/actions/wearEvents.ts`) that calls the DAL and returns `ActionResult<void>`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Not yet established (no test files found in project) |
| Config file | None — Wave 0 must create |
| Quick run command | `npm run test` (after Wave 0 setup) |
| Full suite command | `npm run test` |

No test infrastructure exists in this project. Wave 0 must establish the framework before implementation tasks. Given the tech stack (Next.js 16, TypeScript), Vitest is the standard choice for unit tests.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-02 | Profile row created when trigger fires | manual — Supabase User Impersonation | Manual: signup + verify row in Dashboard | Wave 0 gap |
| DATA-02 | Username generated from email prefix, deduplication | unit | `npm run test -- tests/trigger.test.ts` | Wave 0 gap |
| DATA-03 | follows table UNIQUE constraint prevents duplicate follows | manual — Supabase SQL | Manual: attempt duplicate INSERT | Wave 0 gap |
| DATA-04 | Activity logged after watch creation | unit (Server Action mock) | `npm run test -- tests/activities.test.ts` | Wave 0 gap |
| DATA-05 | profile_settings defaults all public | manual — verify trigger inserts defaults | Manual: signup + inspect row | Wave 0 gap |
| DATA-06 | wear_events replaces lastWornDate — mark as worn writes row | integration | `npm run test -- tests/wearEvents.test.ts` | Wave 0 gap |
| DATA-06 | TypeScript build has zero `lastWornDate` references | build check | `npm run build` | Exists (no test file needed) |

### Wave 0 Gaps

- [ ] `tests/setup.ts` — test environment configuration
- [ ] Vitest install: `npm install -D vitest @vitest/ui`
- [ ] `vitest.config.ts` — configuration pointing to `src/`
- [ ] Individual test files as listed above

**Critical build-time check (no framework needed):** `npm run build` will fail if any TypeScript file references `watch.lastWornDate` or `row.lastWornDate` after the property is removed from `Watch` and the Drizzle schema. This is the most important verification gate for DATA-06 and costs nothing to run.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Auth handled by Phase 5 Supabase Auth |
| V3 Session Management | no | Session handled by Phase 5 |
| V4 Access Control | yes | RLS policies per table; DAL WHERE scoping |
| V5 Input Validation | yes | Zod schemas on Server Actions (existing pattern) |
| V6 Cryptography | no | No crypto operations in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed follower_id in follows INSERT | Spoofing | `WITH CHECK (follower_id = (SELECT auth.uid()))` on INSERT policy |
| Actor spoofing in activity INSERT | Spoofing | Server Action reads `userId` from `getCurrentUser()` — never from client input |
| Username enumeration via conflict error | Information Disclosure | Trigger handles dedup silently; no username-exists endpoint exposed |
| SECURITY DEFINER trigger with unrestricted search_path | Elevation of Privilege | Always include `SET search_path = public` on SECURITY DEFINER functions |
| Wear event injection (logging wear for another user's watch) | Tampering | RLS INSERT policy + DAL `userId` from session; `watchId` ownership not checked at DB level in Phase 7 (acceptable at single-user MVP, enforce in DAL) |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | `supabase db push --linked` for trigger migration | Documented as installed in deploy runbook | 2.x | None — required for Supabase migration track |
| drizzle-kit | `drizzle-kit generate` + `drizzle-kit migrate` | In project devDependencies | ^0.31.x | None — already in use |
| Session-mode pooler URL | `drizzle-kit migrate` (IPv4 compat) | Available via `supabase/.temp/pooler-url` | — | Dashboard → Settings → Database → Session mode |

[VERIFIED: codebase — `docs/deploy-db-setup.md`, `drizzle.config.ts`]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `watches.lastWornDate` text field | `wear_events` table | Phase 7 | Multi-event history; enables WYWT feed in Phase 10 |
| Manual profile creation (app layer) | DB trigger on `auth.users` INSERT | Phase 7 | Profile always exists; zero app code for creation path |
| No activity history | `activities` table | Phase 7 | Phase 10 feed has real data from day one |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Using `text` for `wornDate` (not Postgres `date` type) matches existing codebase conventions | Standard Stack — schema definitions | Low — either type works; migration would need adjustment if `date` is preferred |
| A2 | Trigger fires on `public.users` INSERT (second trigger) rather than extending the existing `auth.users` trigger | Architecture Patterns — Pattern 1 | Low — Option B (extend existing) also works; the trigger function bodies are equivalent |
| A3 | `regexp_replace` approach for username generation from email prefix handles all edge cases | Architecture Patterns — Pattern 1 | Medium — some email formats may produce invalid usernames; the `WHILE` loop + UNIQUE constraint is the safety net |
| A4 | Vitest is appropriate test framework for this Next.js 16 project | Validation Architecture | Low — Jest also works; project has no existing test infra so either choice requires Wave 0 setup |

---

## Open Questions

1. **Phase 6 applied to production?**
   - What we know: Phase 6 RLS migration (`20260420000000_rls_existing_tables.sql`) was created and exists in `supabase/migrations/`
   - What's unclear: Whether it has been pushed to the production Supabase project yet (STATE.md shows Phase 6 as "not started" — but git shows the migration file exists from a completed execution)
   - Recommendation: Planner should add a verification step: `supabase db push --linked` is idempotent (uses `CREATE POLICY IF NOT EXISTS` semantics), so it is safe to re-push. If Phase 6 migration was not applied, it will apply now. If it was, no-op.

2. **Migration file numbering for Phase 7**
   - What we know: Supabase migrations use `YYYYMMDD` timestamps; the last one is `20260420000000`
   - What's unclear: Whether the planner should pick a specific timestamp or use today's date
   - Recommendation: Use `20260419000001_social_tables.sql` for the schema/RLS migration and `20260419000002_profile_trigger.sql` for the trigger, following the existing timestamp convention.

---

## Sources

### Primary (HIGH confidence)
- `src/db/schema.ts` — Existing Drizzle schema; verified all column types, conventions
- `src/db/index.ts` — Drizzle client; confirmed `{ prepare: false }` requirement
- `supabase/migrations/20260413000000_sync_auth_users.sql` — Trigger pattern to extend
- `supabase/migrations/20260420000000_rls_existing_tables.sql` — RLS policy template
- `src/app/actions/watches.ts` — Server Action pattern for activity logging integration
- `src/data/watches.ts` — DAL pattern for new DAL files
- `docs/deploy-db-setup.md` — Migration workflow, IPv6 footgun, drizzle-kit migrate steps
- `.planning/research/ARCHITECTURE.md` — Table designs, index recommendations, build order
- `.planning/research/PITFALLS.md` — RLS pitfalls, `WITH CHECK` requirement, trigger SECURITY DEFINER

### Secondary (MEDIUM confidence)
- `.planning/phases/07-social-schema-profile-auto-creation/07-CONTEXT.md` — Locked decisions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; verified from codebase
- Schema definitions: HIGH — modeled directly from existing `src/db/schema.ts` patterns
- Trigger function: MEDIUM — based on existing working trigger + Postgres plpgsql knowledge; specific regex behavior for edge-case emails is ASSUMED
- lastWornDate audit: HIGH — grep verified all 7 source locations across 5 files
- Pitfalls: HIGH — sourced from existing `.planning/research/PITFALLS.md` which has authoritative citations

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable stack — Drizzle, Supabase, Next.js versions locked)

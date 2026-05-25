# Phase 53: Schema + RLS + Enum Extension - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 3 (2 new migration files, 1 modified schema file)
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/db/schema.ts` | model | CRUD | `src/db/schema.ts` (existing `follows`, `notifications`, `profileSettings` defs) | exact |
| `supabase/migrations/20260522000000_phase53_likes_comments_rls.sql` | migration | CRUD | `supabase/migrations/20260511010000_phase37_layer_d.sql` + `supabase/migrations/20260423000002_phase11_notifications.sql` | exact |
| `supabase/migrations/20260522000001_phase53_notification_enum.sql` | migration | transform | `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` (contrast) | role-match (inverted — ADD not REMOVE) |

---

## Pattern Assignments

### `src/db/schema.ts` (model, CRUD — MODIFY)

**Analog:** `src/db/schema.ts` lines 233–303 (`follows`, `wearEvents`, `profileSettings`, `notifications`)

**Imports pattern** — no new imports needed; all used constructs are already imported (lines 1–16):
```typescript
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core'
```
`text` is already imported and covers the `body` column on `comments`. No new imports required.

**Enum extension pattern** (lines 32–35 — existing shape to extend):
```typescript
// BEFORE (current):
export const notificationTypeEnum = pgEnum('notification_type', [
  'follow',
  'watch_overlap',
])

// AFTER (Phase 53 target):
export const notificationTypeEnum = pgEnum('notification_type', [
  'follow',
  'watch_overlap',
  'watch_like',
  'wear_like',
  'watch_comment',
  'wear_comment',
])
```
Note: the raw SQL enum migration (File B) must be applied to the database BEFORE this Drizzle change is pushed locally, per D-12 and the Phase 24 sequencing comment (line 15 of phase24 migration).

**Per-target likes table pattern** — copy from `follows` (lines 233–246) and `wearEvents` (lines 286–303) which are the two closest analogs: per-user social tables with `UNIQUE` pair constraints and cascade FKs:
```typescript
// Analog shape from follows (lines 233–246):
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

// Target shape for watchLikes (mirrors follows but references watches):
export const watchLikes = pgTable(
  'watch_likes',
  {
    id:        uuid('id').defaultRandom().primaryKey(),
    userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    watchId:   uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('watch_likes_unique_pair').on(table.userId, table.watchId),
    index('watch_likes_watch_id_idx').on(table.watchId),
    index('watch_likes_user_id_idx').on(table.userId),
  ],
)
```

**Nullable-FK table pattern** — copy from `notifications` (lines 311–323) which has an optional `actorId` FK, and from `activities` (lines 270–284) which has a nullable `watchId` FK:
```typescript
// Analog: activities.watchId nullable FK (lines 276):
watchId: uuid('watch_id').references(() => watches.id, { onDelete: 'set null' }),

// Target: comments.watchId and comments.wearEventId nullable FKs with cascade:
watchId:      uuid('watch_id').references(() => watches.id, { onDelete: 'cascade' }),
wearEventId:  uuid('wear_event_id').references(() => wearEvents.id, { onDelete: 'cascade' }),
// Note: no .notNull() — these are intentionally nullable (exactly one non-null enforced by DB CHECK)
```

**`profileSettings` column extension pattern** (lines 263–265 — existing shape to extend after):
```typescript
// Existing (lines 263–265):
notifyOnFollow: boolean('notify_on_follow').notNull().default(true),
notifyOnWatchOverlap: boolean('notify_on_watch_overlap').notNull().default(true),

// New columns follow immediately after (same shape):
notifyOnLike:    boolean('notify_on_like').notNull().default(true),
notifyOnComment: boolean('notify_on_comment').notNull().default(true),
```
Insert before the closing `updatedAt` column (line 267).

**Comment about CHECK constraints not in Drizzle** — mirror the existing comments on `notifications` (lines 307–310) and `watchLineageEdges` (lines 451–453):
```typescript
// Pattern (lines 307–310):
// Column shapes only. Partial indexes, CHECK constraints, dedup UNIQUE, and RLS
// live in supabase/migrations/20260423000002_phase11_notifications.sql (D-08).
// Drizzle-orm 0.45.2 cannot express partial indexes or CHECK constraints in the
// pg-core DSL — raw SQL is authoritative for those.
```
The `comments` table definition must carry the same disclaimer: CHECK constraints (`exactly_one_target`, `body_length`) live in the raw SQL migration only.

---

### `supabase/migrations/20260522000000_phase53_likes_comments_rls.sql` (migration, CRUD — CREATE)

**Primary analog:** `supabase/migrations/20260511010000_phase37_layer_d.sql` (full read — 242 lines)
**Secondary analog:** `supabase/migrations/20260423000002_phase11_notifications.sql` (full read — 123 lines)
**Tertiary analog (profile_settings ALTER):** `supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql` (full read — 83 lines)

**File header comment pattern** (phase37 lines 1–17):
```sql
-- Phase 53 — Tables + RLS + profile_settings columns (v6.0 social: likes + comments)
-- Source: 53-CONTEXT.md D-01..D-10; 53-RESEARCH.md §Architecture Patterns
-- Sibling Drizzle schema: src/db/schema.ts (column shapes only — no RLS, no GRANT, no DO $$)
--
-- Threats mitigated:
--   SEC-01 (anon SELECT on watch_likes/wear_likes/comments — blocked by REVOKE + TO authenticated)
--   SEC-06 (orphan likes/comments on watch/wear delete — blocked by ON DELETE CASCADE)
--   LIKE-05 (duplicate likes — blocked by UNIQUE(user_id, watch_id/wear_event_id))
--
-- Phase 53 is purely ADDITIVE — no DROP, no ALTER COLUMN type-change.

BEGIN;
```

**CREATE TABLE idempotence pattern** (phase11_notifications lines 36–48):
```sql
-- Use IF NOT EXISTS so the statement no-ops when drizzle-kit push has already
-- materialized the table from src/db/schema.ts. Matches Phase 11 / Phase 13 precedent.
CREATE TABLE IF NOT EXISTS watch_likes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  watch_id    uuid        NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watch_likes_unique_pair UNIQUE (user_id, watch_id)
);
```
Repeat for `wear_likes`. For `comments`, add the two CHECK constraints inline (they are only applied when the table is being created; the idempotent fallback `DO $$ IF NOT EXISTS ... ALTER TABLE ADD CONSTRAINT` block handles the re-run case, matching phase11 lines 53–64).

**Idempotent CHECK constraint guard pattern** (phase11_notifications lines 53–64):
```sql
-- Ensure the CHECK is present even if the table was created by drizzle-kit push
-- (Drizzle cannot express CHECK constraints in pg-core; the CONSTRAINT inline above
-- only runs when the table is being created, not when it already exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'comments_exactly_one_target'
       AND conrelid = 'public.comments'::regclass
  ) THEN
    ALTER TABLE comments
      ADD CONSTRAINT comments_exactly_one_target
      CHECK ((watch_id IS NULL) <> (wear_event_id IS NULL));
  END IF;
END $$;
```
Repeat for `comments_body_length` CHECK.

**Index creation pattern** (phase37 lines 74–78):
```sql
-- IF NOT EXISTS so re-apply is a no-op (phase11_notifications line 67 precedent)
CREATE INDEX IF NOT EXISTS watch_likes_watch_id_idx  ON watch_likes(watch_id);
CREATE INDEX IF NOT EXISTS watch_likes_user_id_idx   ON watch_likes(user_id);
CREATE INDEX IF NOT EXISTS wear_likes_wear_event_id_idx ON wear_likes(wear_event_id);
CREATE INDEX IF NOT EXISTS wear_likes_user_id_idx    ON wear_likes(user_id);
-- Partial composite indexes for comments (oldest-first reads):
CREATE INDEX IF NOT EXISTS comments_watch_id_created_at_idx
  ON comments(watch_id, created_at ASC)
  WHERE watch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comments_wear_event_id_created_at_idx
  ON comments(wear_event_id, created_at ASC)
  WHERE wear_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS comments_author_id_idx ON comments(author_id);
```

**`updated_at` trigger pattern** (phase37 lines 84–88 — for `comments` table only):
```sql
CREATE OR REPLACE FUNCTION comments_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS comments_set_updated_at_trg ON comments;
CREATE TRIGGER comments_set_updated_at_trg BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION comments_set_updated_at();
```

**RLS ENABLE + DROP-THEN-CREATE policy pattern** (phase37 lines 102–118 + phase11_notifications lines 94–113):
```sql
-- ENABLE is idempotent when already enabled (phase11 line 95)
ALTER TABLE watch_likes ENABLE ROW LEVEL SECURITY;

-- DROP-THEN-CREATE (Phase 10 shape) — safe re-apply
DROP POLICY IF EXISTS watch_likes_select ON watch_likes;
CREATE POLICY watch_likes_select ON watch_likes
  FOR SELECT TO authenticated USING (true);   -- GATE-02: likes open to all authed (D-08)

DROP POLICY IF EXISTS watch_likes_insert ON watch_likes;
CREATE POLICY watch_likes_insert ON watch_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));  -- InitPlan optimization: (SELECT auth.uid())

DROP POLICY IF EXISTS watch_likes_delete ON watch_likes;
CREATE POLICY watch_likes_delete ON watch_likes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
```
All `auth.uid()` calls MUST be wrapped as `(SELECT auth.uid())` — this is the InitPlan optimization convention throughout `20260420000001_social_tables_rls.sql` (lines 11–27).

**REVOKE + GRANT pattern** (phase37 lines 120–126 — exact idiom, verified):
```sql
GRANT SELECT, INSERT, DELETE ON watch_likes TO authenticated;
-- Explicitly REVOKE from anon and public — Supabase auto-grants on newly created tables.
-- REVOKE FROM PUBLIC alone is insufficient; anon has a direct grant.
REVOKE ALL ON watch_likes FROM anon;
REVOKE ALL ON watch_likes FROM public;
```
Repeat for `wear_likes` and `comments` (comments gets `SELECT, INSERT, UPDATE, DELETE`).

**`profile_settings` ADD COLUMN pattern** (phase13 lines 14–33):
```sql
-- Guarded so drizzle-kit push idempotence is preserved.
ALTER TABLE profile_settings
  ADD COLUMN IF NOT EXISTS notify_on_like    boolean NOT NULL DEFAULT true;

ALTER TABLE profile_settings
  ADD COLUMN IF NOT EXISTS notify_on_comment boolean NOT NULL DEFAULT true;

-- Belt-and-suspenders backfill (phase13 lines 31–33 pattern):
-- Postgres fills DEFAULT into existing rows on NOT NULL ADD COLUMN, but UPDATE
-- covers the case where drizzle-kit push ran first with a different default.
UPDATE profile_settings
   SET notify_on_like    = true
 WHERE notify_on_like IS NULL;
UPDATE profile_settings
   SET notify_on_comment = true
 WHERE notify_on_comment IS NULL;
```

**`DO $$` assertion block pattern** (phase37 lines 133–239 — full block structure):

The assertion block is the final step before `COMMIT;`. It mirrors the phase37 structure exactly:
1. DECLARE one boolean variable per invariant
2. SELECT each check INTO its variable
3. IF NOT <var> THEN RAISE EXCEPTION with a descriptive message; END IF

```sql
DO $$
DECLARE
  watch_likes_table_exists        boolean;
  wear_likes_table_exists         boolean;
  comments_table_exists           boolean;
  -- FK cascade checks (confdeltype = 'c' means ON DELETE CASCADE)
  watch_likes_user_fk_cascade     boolean;
  watch_likes_watch_fk_cascade    boolean;
  wear_likes_user_fk_cascade      boolean;
  wear_likes_wear_fk_cascade      boolean;
  comments_author_fk_cascade      boolean;
  comments_watch_fk_cascade       boolean;
  comments_wear_fk_cascade        boolean;
  -- UNIQUE constraint checks
  watch_likes_unique_exists       boolean;
  wear_likes_unique_exists        boolean;
  -- CHECK constraint checks
  comments_one_target_check       boolean;
  comments_body_check             boolean;
  -- Policy count checks
  watch_likes_policy_count        int;
  wear_likes_policy_count         int;
  comments_policy_count           int;
  -- Anon privilege checks (SEC-01)
  anon_cannot_select_watch_likes  boolean;
  anon_cannot_select_wear_likes   boolean;
  anon_cannot_select_comments     boolean;
  -- profile_settings column checks
  notify_on_like_col_exists       boolean;
  notify_on_comment_col_exists    boolean;
BEGIN
  -- Table existence (phase37 lines 186–189 pattern)
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='watch_likes')
    INTO watch_likes_table_exists;
  -- ... (repeat for wear_likes, comments)

  -- FK cascade types (phase37 lines 204–218 pattern — confdeltype = 'c')
  SELECT EXISTS (SELECT 1 FROM pg_constraint c
                  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                 WHERE c.contype = 'f' AND c.conrelid = 'watch_likes'::regclass
                   AND a.attname = 'user_id' AND c.confdeltype = 'c')
    INTO watch_likes_user_fk_cascade;
  -- ... (repeat for all FK columns on all three tables)

  -- UNIQUE constraint existence
  SELECT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'watch_likes_unique_pair'
                    AND conrelid = 'public.watch_likes'::regclass)
    INTO watch_likes_unique_exists;

  -- CHECK constraint existence
  SELECT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'comments_exactly_one_target'
                    AND conrelid = 'public.comments'::regclass)
    INTO comments_one_target_check;

  -- Policy counts (phase37 lines 191–193 pattern)
  SELECT count(*)::int FROM pg_policies
   WHERE schemaname='public' AND tablename='watch_likes'
    INTO watch_likes_policy_count;
  -- expects 3 (select/insert/delete)

  -- Anon privilege checks (phase37 lines 200–201 pattern — exact idiom)
  SELECT NOT has_table_privilege('anon', 'public.watch_likes', 'SELECT')
    INTO anon_cannot_select_watch_likes;
  SELECT NOT has_table_privilege('anon', 'public.wear_likes', 'SELECT')
    INTO anon_cannot_select_wear_likes;
  SELECT NOT has_table_privilege('anon', 'public.comments', 'SELECT')
    INTO anon_cannot_select_comments;

  -- profile_settings column existence (phase13 lines 52–73 pattern)
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public'
                    AND table_name = 'profile_settings'
                    AND column_name = 'notify_on_like'
                    AND data_type = 'boolean'
                    AND is_nullable = 'NO'
                    AND column_default = 'true')
    INTO notify_on_like_col_exists;

  -- Raise on any failure (phase37 lines 221–238 pattern)
  IF NOT watch_likes_table_exists
    THEN RAISE EXCEPTION 'Phase 53 failed -- watch_likes table missing'; END IF;
  -- ... (one IF per variable)
  IF NOT anon_cannot_select_watch_likes
    THEN RAISE EXCEPTION 'Phase 53 failed -- anon has SELECT on watch_likes (SEC-01 broken)'; END IF;
  IF NOT anon_cannot_select_wear_likes
    THEN RAISE EXCEPTION 'Phase 53 failed -- anon has SELECT on wear_likes (SEC-01 broken)'; END IF;
  IF NOT anon_cannot_select_comments
    THEN RAISE EXCEPTION 'Phase 53 failed -- anon has SELECT on comments (SEC-01 broken)'; END IF;
  IF watch_likes_policy_count <> 3
    THEN RAISE EXCEPTION 'Phase 53 failed -- watch_likes expected 3 RLS policies, got %', watch_likes_policy_count; END IF;
END $$;

COMMIT;
```

---

### `supabase/migrations/20260522000001_phase53_notification_enum.sql` (migration, transform — CREATE)

**Analog:** `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` (contrast — this is the REMOVAL pattern; Phase 53 uses the ADD pattern)

**Critical distinction:** Phase 24 used rename+recreate because Postgres has no `DROP VALUE`. Phase 53 uses `ADD VALUE IF NOT EXISTS` because adding values is natively supported in Postgres 14+. The Phase 24 file is read to understand what NOT to do: no `BEGIN;`/`COMMIT;` wrapper, no `pg_depend` surgery, no index drop/recreate.

**File structure — NO transaction wrapper** (anti-pattern from phase24 lines 18 and 132):
```sql
-- Phase 53 Migration 2/2: notification_type enum extension (v6.0 social)
-- Source: 53-CONTEXT.md D-09; 53-RESEARCH.md §Pattern 4
-- Requirements: D-09 (ADD VALUE path — not the Phase 24 rename+recreate REMOVAL path)
--
-- CRITICAL: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- This file has NO BEGIN; / COMMIT; wrapper.
-- Supabase's migration runner treats bare files as non-transactional.
-- Test on local (`supabase db reset`) before `supabase db push --linked`.
--
-- IF NOT EXISTS guard makes each statement idempotent.
-- No pg_depend surgery needed (ADD VALUE does not rename the type; OID is stable).

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watch_like';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wear_like';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watch_comment';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wear_comment';
```

**Post-migration assertion pattern** — mirror phase24 lines 94–131 structure but adapted for ADD VALUE (verify count = 6, not 2):
```sql
-- Post-enum-extension assertion (phase24 lines 94–130 pattern, adapted for ADD VALUE)
-- This assertion CAN run without BEGIN/COMMIT (it's a DO $$ block, not a transaction boundary).
DO $$
DECLARE
  enum_count int;
BEGIN
  SELECT count(*) INTO enum_count
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
   WHERE pg_type.typname = 'notification_type';

  IF enum_count <> 6 THEN
    RAISE EXCEPTION 'Phase 53 enum migration failed -- notification_type has % values, expected 6', enum_count;
  END IF;
END $$;
```

---

## Shared Patterns

### `(SELECT auth.uid())` InitPlan Convention
**Source:** `supabase/migrations/20260420000001_social_tables_rls.sql` lines 11–27
**Apply to:** All RLS policies in the main DDL migration that reference `auth.uid()`

Every occurrence of `auth.uid()` in a policy `USING` or `WITH CHECK` clause must be wrapped as `(SELECT auth.uid())` — not bare `auth.uid()`. This creates an InitPlan that is evaluated once per statement rather than once per row.
```sql
-- Correct (project convention):
WITH CHECK (user_id = (SELECT auth.uid()))
USING (author_id = (SELECT auth.uid()))

-- Wrong (do not use):
WITH CHECK (user_id = auth.uid())
```

### `REVOKE ALL FROM anon` + `REVOKE ALL FROM public`
**Source:** `supabase/migrations/20260511010000_phase37_layer_d.sql` lines 125–126
**Apply to:** All three new tables in the main DDL migration

Supabase auto-grants SELECT/INSERT/UPDATE/DELETE to `anon` on newly created public-schema tables via `ALTER DEFAULT PRIVILEGES`. `ENABLE ROW LEVEL SECURITY` does not remove this privilege — it only controls what authenticated/anon users can see after they exercise the privilege. Both revokes are required:
```sql
REVOKE ALL ON <table> FROM anon;
REVOKE ALL ON <table> FROM public;
```
The subsequent `DO $$` assertion confirms with `NOT has_table_privilege('anon', 'public.<table>', 'SELECT')`.

### `TO authenticated` on Every Policy
**Source:** `supabase/migrations/20260420000001_social_tables_rls.sql` lines 10–27
**Apply to:** All RLS policies in the main DDL migration

Every `CREATE POLICY` must include `TO authenticated`. A policy without `TO <role>` defaults to `TO PUBLIC`, which allows anon access at the policy layer regardless of the REVOKE.
```sql
-- Every policy in this phase:
CREATE POLICY <name> ON <table>
  FOR <operation> TO authenticated
  USING (...) [WITH CHECK (...)];
```

### `IF NOT EXISTS` / `DROP POLICY IF EXISTS` Idempotence
**Source:** `supabase/migrations/20260423000002_phase11_notifications.sql` lines 36, 67, 100, 108
**Apply to:** All DDL statements in the main migration

```sql
CREATE TABLE IF NOT EXISTS ...
CREATE INDEX IF NOT EXISTS ...
DROP POLICY IF EXISTS <name> ON <table>;
CREATE POLICY ...
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
```

### Assertion Exception Message Format
**Source:** `supabase/migrations/20260511010000_phase37_layer_d.sql` lines 221–238
**Apply to:** All `RAISE EXCEPTION` calls in the `DO $$` assertion block

Format: `'Phase 53 failed -- <table/column> <invariant description> (<requirement ID>)'`
```sql
RAISE EXCEPTION 'Phase 53 failed -- anon has SELECT on watch_likes (SEC-01 broken)';
RAISE EXCEPTION 'Phase 53 failed -- watch_likes expected 3 RLS policies, got %', count;
```

---

## No Analog Found

None — all three files have close analogs in the existing codebase.

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/db/schema.ts`
**Files read:**
- `supabase/migrations/20260511010000_phase37_layer_d.sql` (242 lines) — primary analog for new-table+RLS+assertion migration
- `supabase/migrations/20260420000001_social_tables_rls.sql` (42 lines) — confirms `follows_select_all` policy and `(SELECT auth.uid())` convention
- `supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql` (83 lines) — exact `notify_on_*` ADD COLUMN pattern
- `supabase/migrations/20260423000002_phase11_notifications.sql` (123 lines) — idempotent table + CHECK + RLS pattern
- `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` (133 lines) — contrast pattern (REMOVAL); confirms ADD VALUE must not use this approach
- `supabase/migrations/20260423000046_phase11_secdef_revoke_public.sql` (72 lines) — SECDEF revoke pattern (standby only; D-07 concludes not needed)
- `src/db/schema.ts` (675 lines) — existing pgTable defs, import block, enum shapes, profileSettings column positions
**Pattern extraction date:** 2026-05-22

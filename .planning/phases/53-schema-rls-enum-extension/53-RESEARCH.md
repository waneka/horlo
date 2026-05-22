# Phase 53: Schema + RLS + Enum Extension — Research

**Researched:** 2026-05-22
**Domain:** Postgres DDL, RLS policy authoring, enum extension, Supabase migration mechanics
**Confidence:** HIGH — all claims verified against live migration files, schema.ts source of truth, and project memory files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Likes use per-target tables — `watch_likes` and `wear_likes`. Each has `user_id → users(id) ON DELETE CASCADE`, a target FK (`watch_id → watches(id)` / `wear_event_id → wear_events(id)`) `ON DELETE CASCADE`, and `UNIQUE(user_id, <target>)`. Polymorphic `reactions` table rejected.
- **D-02:** Comments use one shared `comments` table with two nullable FKs and a CHECK that exactly one is non-null (`(watch_id IS NULL) <> (wear_event_id IS NULL)`).
- **D-03:** SEC-06 delivered entirely by FK `ON DELETE CASCADE` — no application-layer orphan cleanup.
- **D-04:** Comment body constraints at DB layer: CHECK `char_length(body) <= 500` AND non-blank (`btrim(body) <> ''`). 500-char limit locked by REQUIREMENTS CMNT-04.
- **D-05:** All three new tables get `ENABLE ROW LEVEL SECURITY` with policies scoped `TO authenticated`. In-migration `DO $$` assertion confirms anon role cannot SELECT from each new table. Satisfies SEC-01.
- **D-06:** Wishlist mutual-follow gate in both layers (SEC-02). RLS layer: `comments` INSERT `WITH CHECK` (and SELECT `USING`) encodes gate via inline `follows` subquery — viable because `follows` already has `follows_select_all ... TO authenticated USING (true)`.
- **D-07:** SECURITY DEFINER function most likely NOT required for the mutual-follow gate. IF any SECDEF helper is introduced, it MUST `REVOKE EXECUTE FROM PUBLIC, anon` with an in-migration `has_function_privilege('anon', …) = false` assertion (SEC-04).
- **D-08:** Likes RLS open to all authenticated users on all watch statuses including wishlist (GATE-02 asymmetry). Gate is comments-only.
- **D-09:** Add four enum values with standalone `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS '<v>'` statements outside a transaction block. This is ADD path — explicitly NOT the Phase 24 rename+recreate pattern.
- **D-10:** Add `notify_on_like` + `notify_on_comment` boolean columns to `profile_settings` in this migration, `NOT NULL DEFAULT true`.
- **D-11:** Grandfather policy — comment rows never deleted on status flip. Read gate keys off watch's current status. Locks Phase 54 predicate; no Phase 53 schema impact.
- **D-12:** Drizzle holds column shapes only; raw SQL in `supabase/migrations/` is authoritative for CHECK constraints, partial/special indexes, and RLS. `drizzle-kit push` is LOCAL ONLY; prod goes through `supabase db push --linked`.

### Claude's Discretion

- Exact index set on the new tables (e.g., `watch_likes(watch_id)` for count GROUP BY, `comments(watch_id, created_at)` / `comments(wear_event_id, created_at)` for oldest-first reads).
- Column naming details, timestamp columns (`created_at`; `edited_at` on comments per CMNT-06), and migration filename/sequencing.
- Whether the comments gate appears in the SELECT `USING` clause in addition to the INSERT `WITH CHECK` at the RLS layer — must satisfy SEC-02's both-layer requirement; researcher confirms the safest encoding.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Future social work (liker-avatar strip, reply fan-out, email digest, @mentions, threaded replies) tracked in REQUIREMENTS.md §"Future Requirements" as SOC-F1…F5.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | New likes and comments tables enforce two-layer privacy — Postgres RLS (authenticated-only, no anon read/write) AND explicit DAL WHERE/gate check | RLS `TO authenticated` policies + `REVOKE ALL FROM anon` + `has_table_privilege` assertion. Anon-block `DO $$` idiom verified in Phase 37 migration. |
| SEC-04 | Any SECURITY DEFINER helper introduced revokes EXECUTE from PUBLIC and anon, asserted in-migration | D-07 concludes no SECDEF needed (inline `follows` subquery viable). If introduced: exact REVOKE + `has_function_privilege` assertion verified in Phase 11 Migration 6. |
| SEC-06 | Deleting a watch or wear event removes its associated likes and comments (no orphaned interaction rows) | FK `ON DELETE CASCADE` on both target FKs in all three new tables, verified by post-migration assertion checking `confdeltype = 'c'` (as per Phase 37 precedent). |
| LIKE-05 | A user cannot like the same target twice (idempotent, enforced by a UNIQUE constraint) | `UNIQUE(user_id, watch_id)` on `watch_likes`, `UNIQUE(user_id, wear_event_id)` on `wear_likes`. Migration assertion confirms constraint exists. |
| GATE-02 | Likes remain open to any authenticated user on all watches, including wishlist (the intended asymmetry) | `watch_likes` and `wear_likes` SELECT policy: `TO authenticated USING (true)`. No status subquery. Explicit contrast with `comments` SELECT policy which has the gate. |

</phase_requirements>

---

## Summary

Phase 53 is a pure database-migration phase — no UI, no DAL, no Server Actions. It delivers the tables, constraints, RLS policies, enum extension, and `profile_settings` columns that every subsequent v6.0 phase depends on. Three new tables must exist by the end of this phase: `watch_likes`, `wear_likes`, and `comments`. Anon access must be blocked at the Postgres layer (not just the application layer) for all three. The `notification_type` enum gains four new values via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`, which must run outside a transaction block. Two new boolean opt-out columns join `profile_settings`.

The most technically nuanced task is the enum extension: this is not the Phase 24 rename+recreate pattern (which was used to REMOVE values). Adding values via `ADD VALUE` is safe in Postgres 14+, does not require `pg_depend` surgery, and does not require dropping partial indexes — but it CANNOT run inside a `BEGIN`/`COMMIT` block. The migration file must either (a) place the four `ALTER TYPE` statements before the `BEGIN;` of the main transaction, or (b) split them into a separate migration file. Option (b) is simpler and matches the existing "one concern per file" discipline; it avoids any risk of the non-transactional statements interfering with the main transaction.

The comments mutual-follow gate is confirmed viable as an inline `follows` subquery in the RLS `WITH CHECK` (INSERT) and `USING` (SELECT) clauses, because `follows_select_all ON public.follows FOR SELECT TO authenticated USING (true)` already exists in `20260420000001_social_tables_rls.sql:17`. No SECURITY DEFINER helper is needed. The gate must appear in both the SELECT `USING` and the INSERT `WITH CHECK` clause to satisfy SEC-02's both-layer requirement at the RLS layer — the DAL WHERE is the second independent layer (Phase 54).

**Primary recommendation:** One migration file for tables + RLS + profile_settings ALTER (inside a single `BEGIN`/`COMMIT`). A separate migration file (strictly higher timestamp) for the four `ALTER TYPE ... ADD VALUE` statements (non-transactional, no `BEGIN`/`COMMIT` wrapper). Apply local first via `drizzle-kit push` + migration, verify, then `supabase db push --linked` for prod.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Like/comment row storage | Database / Storage | — | Tables, FKs, constraints, and cascade behavior owned entirely by Postgres. |
| Anon access blocking | Database / Storage | — | `REVOKE ALL FROM anon` + `TO authenticated` RLS policies + `has_table_privilege` assertion — all at DB layer. |
| Mutual-follow gate (RLS layer) | Database / Storage | — | Inline `follows` subquery in RLS WITH CHECK and USING clauses. No application code. |
| Mutual-follow gate (DAL layer) | API / Backend | — | Phase 54. The Drizzle service-role client bypasses RLS; DAL WHERE is the load-bearing second layer. |
| Enum extension | Database / Storage | — | `ALTER TYPE notification_type ADD VALUE IF NOT EXISTS` — Postgres DDL only. |
| Notification opt-out columns | Database / Storage | — | `ALTER TABLE profile_settings ADD COLUMN IF NOT EXISTS notify_on_like / notify_on_comment`. The logger reads them at Phase 54+. |

---

## Standard Stack

### Core (all existing — no new dependencies for this phase)

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Supabase Postgres (raw SQL migrations) | Postgres 15+ | Authoritative DDL for CHECK, RLS, indexes | Drizzle 0.45.2 cannot express CHECK constraints or partial indexes in pg-core DSL |
| Drizzle ORM (schema.ts) | ^0.45.2 | Column shape source of truth for TypeScript types | `pgTable` defs enable Drizzle query builder and type inference |
| `drizzle-kit push` | ^0.45.2 | LOCAL column-shape sync only | `push` is local; prod uses `supabase db push --linked` |
| `supabase db push --linked` | Supabase CLI | Prod migration delivery | Project standard per `project_drizzle_supabase_db_mismatch.md` |

[VERIFIED: `/Users/tylerwaneka/Documents/horlo/src/db/schema.ts`] — Drizzle column shapes only; comments in the file confirm RLS/CHECK/indexes live in raw SQL migrations.

[VERIFIED: `/Users/tylerwaneka/Documents/horlo/supabase/migrations/20260511010000_phase37_layer_d.sql`] — Establishes the exact pattern this phase must mirror: `REVOKE ALL FROM anon` + `GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated` + `has_table_privilege` assertion block.

---

## Architecture Patterns

### System Architecture Diagram

```
MIGRATION FILE A — tables + RLS + profile_settings (inside BEGIN/COMMIT)
  │
  ├─ CREATE TABLE watch_likes (user_id FK cascade, watch_id FK cascade, UNIQUE(user_id, watch_id))
  ├─ CREATE TABLE wear_likes  (user_id FK cascade, wear_event_id FK cascade, UNIQUE(user_id, wear_event_id))
  ├─ CREATE TABLE comments    (author_id FK cascade, watch_id nullable FK cascade,
  │                            wear_event_id nullable FK cascade, body text NOT NULL,
  │                            edited_at nullable, CHECK exactly-one-target, CHECK body len/blank)
  ├─ ENABLE RLS on all three tables
  ├─ CREATE POLICY x9 (watch_likes: select/insert/delete; wear_likes: select/insert/delete;
  │                     comments: select/insert/update/delete)
  ├─ REVOKE ALL ON watch_likes, wear_likes, comments FROM anon, public
  ├─ GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated
  ├─ ALTER TABLE profile_settings ADD COLUMN IF NOT EXISTS notify_on_like boolean NOT NULL DEFAULT true
  ├─ ALTER TABLE profile_settings ADD COLUMN IF NOT EXISTS notify_on_comment boolean NOT NULL DEFAULT true
  ├─ CREATE INDEX x5 (like count GROUP BY; comment list ordered reads)
  └─ DO $$ final assertions block (table existence, FK cascade types, UNIQUE constraints,
                                   CHECK constraints, policy counts, anon privilege = false,
                                   profile_settings columns exist)

MIGRATION FILE B — enum extension ONLY (no BEGIN/COMMIT wrapper)
  │
  ├─ ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watch_like'
  ├─ ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wear_like'
  ├─ ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watch_comment'
  └─ ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wear_comment'

src/db/schema.ts CHANGES (parallel to migration; column shapes only)
  ├─ export const watchLikes = pgTable('watch_likes', ...)
  ├─ export const wearLikes  = pgTable('wear_likes', ...)
  ├─ export const comments   = pgTable('comments', ...)
  ├─ notificationTypeEnum updated: add 'watch_like', 'wear_like', 'watch_comment', 'wear_comment'
  └─ profileSettings: add notifyOnLike, notifyOnComment columns
```

### Recommended Project Structure

No new directories. All artifacts land in existing locations:

```
src/db/
└── schema.ts           ← add watchLikes, wearLikes, comments pgTable defs;
                           extend notificationTypeEnum; add 2 columns to profileSettings

supabase/migrations/
├── 20260522000000_phase53_likes_comments_rls.sql   ← tables + RLS + profile_settings
└── 20260522000001_phase53_notification_enum.sql    ← ADD VALUE x4 (no transaction wrapper)
```

Timestamp choice: `20260522` prefix (today) with `000000` / `000001` suffix ensures strict ordering relative to the last migration (`20260520070000_phase49_1_drop_primary_archetype.sql`).

### Pattern 1: New Table with RLS + Anon Block (Phase 37 exact idiom)

```sql
-- Source: supabase/migrations/20260511010000_phase37_layer_d.sql

-- Step 1: CREATE TABLE
CREATE TABLE watch_likes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  watch_id     uuid NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watch_likes_unique_pair UNIQUE (user_id, watch_id)
);

-- Step 2: Indexes
CREATE INDEX watch_likes_watch_id_idx ON watch_likes(watch_id);
CREATE INDEX watch_likes_user_id_idx  ON watch_likes(user_id);

-- Step 3: RLS
ALTER TABLE watch_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watch_likes_select ON watch_likes;
CREATE POLICY watch_likes_select ON watch_likes
  FOR SELECT TO authenticated USING (true);               -- GATE-02: likes open to all authed

DROP POLICY IF EXISTS watch_likes_insert ON watch_likes;
CREATE POLICY watch_likes_insert ON watch_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));             -- actor_id = caller

DROP POLICY IF EXISTS watch_likes_delete ON watch_likes;
CREATE POLICY watch_likes_delete ON watch_likes
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));                  -- only liker can unlike

-- Step 4: GRANT + REVOKE (Supabase auto-grants to anon; must explicitly revoke)
GRANT SELECT, INSERT, DELETE ON watch_likes TO authenticated;
REVOKE ALL ON watch_likes FROM anon;
REVOKE ALL ON watch_likes FROM public;
```

[VERIFIED: `supabase/migrations/20260511010000_phase37_layer_d.sql:120-126`] — Exact `REVOKE ALL FROM anon; REVOKE ALL FROM public` idiom confirmed as the project standard.

### Pattern 2: Comments Table with Mutual-Follow Gate in RLS

```sql
-- Source: 53-CONTEXT.md D-06; pre-flight verified against 20260420000001_social_tables_rls.sql:17

CREATE TABLE comments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id      uuid NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  watch_id       uuid          REFERENCES watches(id)    ON DELETE CASCADE,
  wear_event_id  uuid          REFERENCES wear_events(id) ON DELETE CASCADE,
  body           text NOT NULL,
  edited_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- exactly one target must be non-null
  CONSTRAINT comments_exactly_one_target
    CHECK ((watch_id IS NULL) <> (wear_event_id IS NULL)),
  -- body constraints (CMNT-04; D-04)
  CONSTRAINT comments_body_length
    CHECK (char_length(body) <= 500 AND btrim(body) <> '')
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- SELECT: open for wear_event targets and owned/sold/grail watch targets.
-- Mutual-follow gate ONLY for wishlist watch targets.
-- Gate appears in BOTH USING (SELECT) and WITH CHECK (INSERT) — satisfies SEC-02 both-layer at RLS.
DROP POLICY IF EXISTS comments_select ON comments;
CREATE POLICY comments_select ON comments
  FOR SELECT TO authenticated
  USING (
    -- wear_event target: open
    wear_event_id IS NOT NULL
    OR
    -- watch target: check status + gate
    (
      watch_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM watches w WHERE w.id = comments.watch_id
          AND (
            w.status IN ('owned', 'sold', 'grail')
            OR w.user_id = (SELECT auth.uid())         -- owner always sees their own
            OR (
              w.status = 'wishlist'
              AND EXISTS (
                SELECT 1 FROM follows WHERE follower_id = (SELECT auth.uid()) AND following_id = w.user_id
              )
              AND EXISTS (
                SELECT 1 FROM follows WHERE follower_id = w.user_id AND following_id = (SELECT auth.uid())
              )
            )
          )
      )
    )
  );

-- INSERT: same gate as SELECT + author_id mass-assignment guard
DROP POLICY IF EXISTS comments_insert ON comments;
CREATE POLICY comments_insert ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())    -- mass-assignment guard
    AND (
      wear_event_id IS NOT NULL
      OR
      (
        watch_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM watches w WHERE w.id = comments.watch_id
            AND (
              w.status IN ('owned', 'sold', 'grail')
              OR w.user_id = (SELECT auth.uid())
              OR (
                w.status = 'wishlist'
                AND EXISTS (
                  SELECT 1 FROM follows WHERE follower_id = (SELECT auth.uid()) AND following_id = w.user_id
                )
                AND EXISTS (
                  SELECT 1 FROM follows WHERE follower_id = w.user_id AND following_id = (SELECT auth.uid())
                )
              )
            )
        )
      )
    )
  );

-- UPDATE: author edits own comment only
DROP POLICY IF EXISTS comments_update ON comments;
CREATE POLICY comments_update ON comments
  FOR UPDATE TO authenticated
  USING      (author_id = (SELECT auth.uid()))
  WITH CHECK (author_id = (SELECT auth.uid()));

-- DELETE: author deletes own comment only
DROP POLICY IF EXISTS comments_delete ON comments;
CREATE POLICY comments_delete ON comments
  FOR DELETE TO authenticated
  USING (author_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON comments TO authenticated;
REVOKE ALL ON comments FROM anon;
REVOKE ALL ON comments FROM public;
```

[VERIFIED: `supabase/migrations/20260420000001_social_tables_rls.sql:17`] — `follows_select_all ON public.follows FOR SELECT TO authenticated USING (true)` exists; the inline `follows` subquery is viable without a SECDEF helper.

### Pattern 3: Anon-Block DO $$ Assertion (Phase 37 exact idiom)

```sql
-- Source: supabase/migrations/20260511010000_phase37_layer_d.sql:133-239
-- Verify anon cannot SELECT from each new table

DO $$
DECLARE
  anon_cannot_select_watch_likes  boolean;
  anon_cannot_select_wear_likes   boolean;
  anon_cannot_select_comments     boolean;
  -- ... additional vars for FK cascade type checks, UNIQUE existence, policy counts
BEGIN
  SELECT NOT has_table_privilege('anon', 'public.watch_likes', 'SELECT')
    INTO anon_cannot_select_watch_likes;
  SELECT NOT has_table_privilege('anon', 'public.wear_likes', 'SELECT')
    INTO anon_cannot_select_wear_likes;
  SELECT NOT has_table_privilege('anon', 'public.comments', 'SELECT')
    INTO anon_cannot_select_comments;

  IF NOT anon_cannot_select_watch_likes
    THEN RAISE EXCEPTION 'Phase 53 failed -- anon has SELECT on watch_likes (SEC-01 broken)'; END IF;
  IF NOT anon_cannot_select_wear_likes
    THEN RAISE EXCEPTION 'Phase 53 failed -- anon has SELECT on wear_likes (SEC-01 broken)'; END IF;
  IF NOT anon_cannot_select_comments
    THEN RAISE EXCEPTION 'Phase 53 failed -- anon has SELECT on comments (SEC-01 broken)'; END IF;
END $$;
```

The two-step mechanism is:
1. `REVOKE ALL ON <table> FROM anon; REVOKE ALL ON <table> FROM public;` — removes Supabase's auto-grant.
2. `has_table_privilege('anon', 'public.<table>', 'SELECT')` returns `false` — assertion confirms it.

[VERIFIED: `supabase/migrations/20260511010000_phase37_layer_d.sql:200-201, 235`] — this is the live project idiom.

### Pattern 4: Non-Transactional Enum ADD VALUE

```sql
-- Source: supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql (contrast)
-- D-09: ADD VALUE path, NOT the Phase 24 rename+recreate REMOVAL path

-- FILE: 20260522000001_phase53_notification_enum.sql
-- NO BEGIN; / COMMIT; wrapper — ALTER TYPE ADD VALUE cannot run inside a transaction block.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watch_like';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wear_like';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'watch_comment';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'wear_comment';
```

The `IF NOT EXISTS` guard makes each statement idempotent. No `pg_depend` pre-flight is needed for ADD VALUE (pg_depend only matters when REMOVING values that have dependent partial indexes — the Phase 24 situation). The partial index `notifications_watch_overlap_dedup` was recreated in Phase 24 bound to the current `notification_type` OID; adding new values does not invalidate it.

[VERIFIED: `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql:38-54`] — Phase 24 was a REMOVAL migration; it dropped and recreated the partial index because the rename invalidated the OID binding. ADD VALUE does not rename the type; OID is stable.

### Pattern 5: profile_settings ADD COLUMN (Phase 13 exact idiom)

```sql
-- Source: supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql:14-22

ALTER TABLE profile_settings
  ADD COLUMN IF NOT EXISTS notify_on_like    boolean NOT NULL DEFAULT true;

ALTER TABLE profile_settings
  ADD COLUMN IF NOT EXISTS notify_on_comment boolean NOT NULL DEFAULT true;
```

`ADD COLUMN IF NOT EXISTS` with `NOT NULL DEFAULT true` fills existing rows immediately. The Phase 13 migration confirms existing rows get the DEFAULT value from Postgres on a NOT NULL ADD COLUMN — but the Phase 13 migration also runs an explicit UPDATE as belt-and-suspenders (worth mirroring). A post-migration assertion checks `column_default = 'true'` and `is_nullable = 'NO'`.

[VERIFIED: `supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql:14-22, 55-65`] — exact idiom confirmed.

### Pattern 6: SECDEF REVOKE (if introduced — most likely NOT needed)

```sql
-- Source: supabase/migrations/20260423000046_phase11_secdef_revoke_public.sql

-- IF (and only if) a SECURITY DEFINER function is added for the mutual-follow gate:
REVOKE EXECUTE ON FUNCTION public.<fn>(<args>) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.<fn>(<args>) TO authenticated;

-- Assertion:
DO $$
DECLARE anon_execute boolean;
BEGIN
  SELECT has_function_privilege('anon', 'public.<fn>(<args>)', 'EXECUTE') INTO anon_execute;
  IF anon_execute THEN
    RAISE EXCEPTION 'Phase 53 SEC-04 failed -- anon has EXECUTE on <fn>; REVOKE did not land';
  END IF;
END $$;
```

D-07 concludes this is most likely NOT needed because `follows` is readable by authenticated users via the existing `follows_select_all` policy. The inline subquery approach is confirmed viable.

[VERIFIED: `supabase/migrations/20260423000046_phase11_secdef_revoke_public.sql`] — REVOKE from PUBLIC alone is insufficient; `REVOKE FROM PUBLIC, anon` is required because Supabase auto-grants directly to `anon` at function creation.

### Anti-Patterns to Avoid

- **Missing `TO authenticated` on RLS policy:** A policy without `TO authenticated` defaults to `TO PUBLIC`, allowing anon reads. Every policy in this phase must specify `TO authenticated`.
- **`REVOKE FROM PUBLIC` without `FROM anon`:** Supabase auto-grants EXECUTE (for functions) and SELECT/INSERT/etc. (for tables) directly to `anon`. PUBLIC revoke does not remove the direct `anon` grant.
- **`ALTER TYPE ADD VALUE` inside `BEGIN`/`COMMIT`:** Postgres 15 will raise `ERROR: ALTER TYPE ... ADD VALUE cannot run inside a transaction block`. The enum migration file must have NO `BEGIN;`/`COMMIT;` wrapper.
- **Conflating ADD VALUE with Phase 24 rename+recreate:** Phase 24 was for REMOVING values. `pg_depend` pre-flight and index surgery are NOT required for ADD VALUE. Do not apply that pattern here.
- **Single-nullable-FK comment check with `=` instead of `<>`:** The exactly-one-non-null CHECK is `(watch_id IS NULL) <> (wear_event_id IS NULL)` — the XOR pattern. Using `!=` gives the same result in SQL but `<>` is the project convention (matches `pg_constraint` inspectable form).
- **Gate in INSERT `WITH CHECK` only (omitting SELECT `USING`):** D-06 requires both. A comment can be inserted by a mutual follower; if the watch later stays wishlist, the SELECT policy must still gate who can READ the existing comment. Both clauses must encode the gate.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Anon blocking via application code | Application-layer `if (!session) return null` in DAL | `REVOKE ALL FROM anon` + `TO authenticated` RLS policy | Drizzle service-role client bypasses RLS; app-code check only guards one path. DB-level is the only universal gate. |
| Mutual-follow check via SECDEF function | A new PL/pgSQL SECURITY DEFINER function | Inline `follows` EXISTS subquery in the RLS policy | `follows_select_all TO authenticated USING (true)` already exists; SECDEF adds complexity and the anon-EXECUTE revoke requirement. |
| Enum extension via rename+recreate | Phase 24 procedure | `ALTER TYPE ... ADD VALUE IF NOT EXISTS` | Rename+recreate requires `pg_depend` surgery and drops/recreates partial indexes. ADD VALUE is safe for adding values in Postgres 14+. |
| Comment body validation at app layer only | Zod-only length check | DB CHECK `char_length(body) <= 500 AND btrim(body) <> ''` | Service-role client bypasses Server Action Zod validation. DB CHECK is the backstop that no path can bypass. |
| Cascade cleanup in Server Actions | `db.delete(watchLikes).where(eq(watchLikes.watchId, id))` before deleting a watch | FK `ON DELETE CASCADE` | Application cleanup can be forgotten, partially applied on error, or bypassed by direct DB admin. DB cascade is automatic and guaranteed. |

---

## Recommended Index Set (Claude's Discretion)

Based on the established read patterns documented in ARCHITECTURE.md and PITFALLS.md:

### watch_likes / wear_likes

```sql
-- Count GROUP BY for the batch DAL query (PITFALLS.md Performance Traps)
CREATE INDEX watch_likes_watch_id_idx  ON watch_likes(watch_id);
CREATE INDEX wear_likes_wear_event_id_idx ON wear_likes(wear_event_id);

-- Actor lookup (viewer's own liked state; also supports cascade-delete scan)
CREATE INDEX watch_likes_user_id_idx   ON watch_likes(user_id);
CREATE INDEX wear_likes_user_id_idx    ON wear_likes(user_id);
```

The `UNIQUE(user_id, watch_id)` constraint already creates an implicit unique index on `(user_id, watch_id)`, which covers the "has this user liked this watch?" lookup. The explicit `watch_id_idx` is needed separately for the GROUP BY count query scanning all likes for a given watch.

### comments

```sql
-- Oldest-first (D-11 grandfather policy; flat chronological list in CommentThread)
CREATE INDEX comments_watch_id_created_at_idx
  ON comments(watch_id, created_at ASC)
  WHERE watch_id IS NOT NULL;

CREATE INDEX comments_wear_event_id_created_at_idx
  ON comments(wear_event_id, created_at ASC)
  WHERE wear_event_id IS NOT NULL;

-- Author lookup (for edit/delete permission + author affordance display)
CREATE INDEX comments_author_id_idx ON comments(author_id);
```

The composite `(watch_id, created_at ASC)` partial index (where `watch_id IS NOT NULL`) is the primary scan for `getCommentsForTarget`. Using partial indexes keeps the index smaller; a comment can only reference one target type, so the IS NOT NULL filter halves each index.

---

## Common Pitfalls

### Pitfall 1: Enum ADD VALUE Inside a Transaction Block

**What goes wrong:** Supabase runs each migration file inside an implicit transaction by default. If the `ALTER TYPE ... ADD VALUE` statements appear inside `BEGIN; ... COMMIT;` they fail with `ERROR: ALTER TYPE ... ADD VALUE cannot run inside a transaction block`.

**Why it happens:** Developers write the enum extension in the same migration file as the table DDL, wrapped in a single `BEGIN`/`COMMIT`.

**How to avoid:** Split into a dedicated second migration file (higher timestamp, same day). No `BEGIN;`/`COMMIT;` wrapper in that file. Each `ALTER TYPE ... ADD VALUE IF NOT EXISTS` is a standalone statement.

**Warning signs:** The migration file containing `ALTER TYPE ADD VALUE` also contains `BEGIN;` at the top.

[VERIFIED: `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` + ARCHITECTURE.md Anti-Pattern 4] — confirmed non-transactional requirement.

### Pitfall 2: Supabase Auto-Grant to anon on New Tables

**What goes wrong:** After `CREATE TABLE` in the Supabase environment, the `anon` role has direct SELECT/INSERT/UPDATE/DELETE on the new table via Supabase's `ALTER DEFAULT PRIVILEGES` auto-grant. Setting `ENABLE ROW LEVEL SECURITY` and adding `TO authenticated` policies blocks anon access at the policy layer, but `has_table_privilege('anon', 'public.watch_likes', 'SELECT')` still returns `true` unless explicitly revoked.

**Why it happens:** Supabase auto-grants are not disabled by RLS. Two separate mechanisms: table privileges (who has the SQL privilege to attempt access) vs. RLS policies (what they can see once they attempt). An anon caller with table privilege + no matching policy gets an empty result set, not a 403 — which is worse than a clear denial.

**How to avoid:** After the RLS section, add `REVOKE ALL ON <table> FROM anon; REVOKE ALL ON <table> FROM public;`. Then assert in the `DO $$` block: `NOT has_table_privilege('anon', 'public.<table>', 'SELECT')`.

[VERIFIED: `supabase/migrations/20260511010000_phase37_layer_d.sql:120-126, 200-201`] — exact idiom in use.

### Pitfall 3: Gate Encoded in Only One RLS Clause

**What goes wrong:** The mutual-follow gate appears only in `WITH CHECK` (INSERT). A non-mutual-follower who previously commented (before the watch moved to wishlist, or via the grandfather policy) can still SELECT those comments — the gate predicate is missing from `USING` (SELECT).

**Why it happens:** Developers write INSERT policy first (blocking new comments), overlooking that SELECT is a separate policy.

**How to avoid:** D-06 explicitly requires gate in BOTH INSERT `WITH CHECK` AND SELECT `USING`. The research confirms this is the correct encoding. See Pattern 2 above for the full dual-clause implementation.

**Warning signs:** The `comments_select` policy has `USING (true)` or an `author_id = auth.uid()` predicate only, with no `watches.status` subquery.

### Pitfall 4: Non-idempotent Migration Breaks Re-run

**What goes wrong:** `drizzle-kit push` creates the table first (column shapes only); then the Supabase migration tries to `CREATE TABLE` again and fails, or `CREATE POLICY` fails because the policy already exists.

**Why it happens:** `drizzle-kit push` runs before the Supabase migration file is applied locally. The migration is then not idempotent.

**How to avoid:** Use `CREATE TABLE IF NOT EXISTS` and `DROP POLICY IF EXISTS` + `CREATE POLICY` (standard Phase 11 / Phase 13 pattern). All `ALTER TABLE ... ADD COLUMN` uses `IF NOT EXISTS`. `CREATE INDEX` uses `IF NOT EXISTS`.

[VERIFIED: `supabase/migrations/20260423000002_phase11_notifications.sql:37`] — `CREATE TABLE IF NOT EXISTS` + idempotent policy management is the project convention.

### Pitfall 5: drizzle-kit push on comments UNIQUE Constraint Mismatch

**What goes wrong:** The `comments` table intentionally has NO `UNIQUE` constraint (unlike the likes tables). Drizzle's pg-core `unique()` function in the table definition would generate a constraint that does not match the intentional design choice (D-02). Drizzle drift detection may flag the intentional absence as a divergence.

**Why it happens:** The likes tables have `unique()` in their Drizzle definitions; a developer may copy the pattern to `comments`.

**How to avoid:** The `comments` Drizzle table definition must NOT include any `unique()` call in the `(table) => [...]` callback beyond the two FK indexes. The UNIQUE-on-likes / no-UNIQUE-on-comments asymmetry is intentional (D-02).

---

## Schema Additions — Exact SQL

### watch_likes

```sql
CREATE TABLE IF NOT EXISTS watch_likes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  watch_id    uuid        NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watch_likes_unique_pair UNIQUE (user_id, watch_id)
);
```

### wear_likes

```sql
CREATE TABLE IF NOT EXISTS wear_likes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  wear_event_id  uuid        NOT NULL REFERENCES wear_events(id)  ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wear_likes_unique_pair UNIQUE (user_id, wear_event_id)
);
```

### comments

```sql
CREATE TABLE IF NOT EXISTS comments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id      uuid        NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
  watch_id       uuid                 REFERENCES watches(id)      ON DELETE CASCADE,
  wear_event_id  uuid                 REFERENCES wear_events(id)  ON DELETE CASCADE,
  body           text        NOT NULL,
  edited_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comments_exactly_one_target
    CHECK ((watch_id IS NULL) <> (wear_event_id IS NULL)),
  CONSTRAINT comments_body_length
    CHECK (char_length(body) <= 500 AND btrim(body) <> '')
);
```

### Drizzle schema.ts additions (column shapes; CHECK/RLS stay in raw SQL)

```typescript
// watch_likes
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

// wear_likes
export const wearLikes = pgTable(
  'wear_likes',
  {
    id:           uuid('id').defaultRandom().primaryKey(),
    userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    wearEventId:  uuid('wear_event_id').notNull().references(() => wearEvents.id, { onDelete: 'cascade' }),
    createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('wear_likes_unique_pair').on(table.userId, table.wearEventId),
    index('wear_likes_wear_event_id_idx').on(table.wearEventId),
    index('wear_likes_user_id_idx').on(table.userId),
  ],
)

// comments — CHECK constraints live in raw SQL migration ONLY (Drizzle cannot express them)
export const comments = pgTable(
  'comments',
  {
    id:           uuid('id').defaultRandom().primaryKey(),
    authorId:     uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    watchId:      uuid('watch_id').references(() => watches.id, { onDelete: 'cascade' }),
    wearEventId:  uuid('wear_event_id').references(() => wearEvents.id, { onDelete: 'cascade' }),
    body:         text('body').notNull(),
    editedAt:     timestamp('edited_at', { withTimezone: true }),
    createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt:    timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('comments_watch_id_created_at_idx').on(table.watchId, table.createdAt),
    index('comments_wear_event_id_created_at_idx').on(table.wearEventId, table.createdAt),
    index('comments_author_id_idx').on(table.authorId),
  ],
)

// notificationTypeEnum — add 4 new values
export const notificationTypeEnum = pgEnum('notification_type', [
  'follow',
  'watch_overlap',
  'watch_like',
  'wear_like',
  'watch_comment',
  'wear_comment',
])

// profileSettings — add 2 columns (after notifyOnWatchOverlap)
// Inside existing pgTable definition:
notifyOnLike:    boolean('notify_on_like').notNull().default(true),
notifyOnComment: boolean('notify_on_comment').notNull().default(true),
```

[VERIFIED: `src/db/schema.ts:32-35`] — `notificationTypeEnum` currently has exactly `['follow', 'watch_overlap']`. The four new values do not exist yet; `IF NOT EXISTS` guards in the migration file handle re-runs safely.

[VERIFIED: `src/db/schema.ts:248-266`] — `profileSettings` currently has `notifyOnFollow` and `notifyOnWatchOverlap` at lines 264-265. New columns follow the same `boolean(...).notNull().default(true)` shape.

---

## Open Questions (RESOLVED)

1. **RESOLVED: Migration file timestamp format for the enum-only file**
   - What we know: Last migration is `20260520070000_phase49_1_drop_primary_archetype.sql`. Phase 53 runs on 2026-05-22. Timestamps must be strictly greater.
   - What's unclear: Whether `20260522000001` (sequence suffix) or a timestamp offset (e.g., `20260522000001`) is preferred.
   - Recommendation: Use `20260522000000_phase53_likes_comments_rls.sql` and `20260522000001_phase53_notification_enum.sql`. The `000001` suffix makes the enum file strictly after the DDL file on the same day.

2. **RESOLVED: `updated_at` trigger on `comments` table**
   - What we know: Phase 37 added an `updated_at` trigger for `divestments` (PL/pgSQL `BEFORE UPDATE` trigger). `comments` has `updated_at` for edit tracking (CMNT-06 `edited_at` already covers the user-visible "edited" badge; `updated_at` is a housekeeping column).
   - What's unclear: Whether the planner should include an `updated_at` trigger in Phase 53 or treat it as a Phase 54/55 concern.
   - Recommendation: Include the `updated_at` trigger in Phase 53 for completeness (Phase 54/55 update comments via `editComment` which sets `edited_at`; the `updated_at` trigger ensures consistency). Cost is one additional 3-line PL/pgSQL function matching the Phase 37 pattern.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 53 is purely database DDL changes with no new external tool dependencies beyond the already-verified project stack (`supabase` CLI, `drizzle-kit`).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None currently detected for DB integration tests — Wave 0 will need test scaffolding if any migration assertions are to be automated |
| Quick run command | `npm run lint` (TypeScript schema.ts type-check) + manual `supabase db reset` + migration apply |
| Full migration test | `supabase db reset` then run both migration files; check the `DO $$` assertions pass |

### Phase Requirements → Test Map

The primary test mechanism for this phase is the in-migration `DO $$` assertion block — it runs automatically when the migration is applied, atomically within the transaction, and rolls back everything if any assertion fails. This is the Nyquist validation for a pure DDL phase.

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| SEC-01 | Anon cannot SELECT from watch_likes, wear_likes, comments | In-migration assertion | `supabase db reset` + migration apply | `NOT has_table_privilege('anon', ...)` assertion in `DO $$` block |
| SEC-04 | If SECDEF function introduced, anon has no EXECUTE | In-migration assertion | Same as above | `has_function_privilege('anon', ...) = false` — only relevant if SECDEF is introduced |
| SEC-06 | Deleting a watch cascades to its likes and comments | In-migration assertion + manual smoke | `supabase db reset` + migration apply; then `DELETE FROM watches WHERE id = ?; SELECT COUNT(*) FROM watch_likes WHERE watch_id = ?` should return 0 | FK `confdeltype = 'c'` verified in `DO $$` assertion block |
| LIKE-05 | UNIQUE constraint on (user_id, watch_id) prevents duplicate likes | In-migration assertion + schema check | `supabase db reset` + migration apply; `INSERT INTO watch_likes ... ON CONFLICT` smoke | `pg_constraint` check for `watch_likes_unique_pair` in `DO $$` block |
| GATE-02 | Likes open to all authenticated users (no wishlist filter in likes policies) | In-migration assertion | `DO $$` checks that `watch_likes` has exactly 3 RLS policies (select/insert/delete); `pg_policies` confirms select policy has no watches subquery | Contrast with `comments_select` which has the gate |
| D-09 (enum) | notification_type enum has 6 values after migration B | Post-migration assertion in enum file | Apply enum migration file; `SELECT count(*) FROM pg_enum WHERE enumtypid = 'notification_type'::regtype` should return 6 | Or add a standalone assertion after the 4 ADD VALUE statements |

### Sampling Rate

- **Per task commit:** TypeScript check: `npx tsc --noEmit` on `schema.ts` edits.
- **Per migration apply (local):** `supabase db reset` clears local, re-applies all migrations including the new files; the `DO $$` assertions fire automatically.
- **Phase gate:** Both migration files apply cleanly on local with all `DO $$` assertions passing before `supabase db push --linked` to prod.

### Wave 0 Gaps

- [ ] No automated integration test suite for migration assertions — the `DO $$` blocks run within the migration itself, not via Jest/Vitest. This is by design for a pure DDL phase; no framework setup needed.
- [ ] `src/db/schema.ts` TypeScript changes must be validated with `npx tsc --noEmit` before committing. No existing test file covers schema.ts type correctness beyond the compiler.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth changes in this phase |
| V3 Session Management | No | No session changes |
| V4 Access Control | Yes | RLS `TO authenticated` + `REVOKE ALL FROM anon` + `DO $$` anon assertion (SEC-01); mutual-follow gate in both RLS clauses (D-06) |
| V5 Input Validation | Yes | DB CHECK `char_length(body) <= 500 AND btrim(body) <> ''` (CMNT-04, D-04) |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anon user reads interaction data | Information Disclosure | `REVOKE ALL FROM anon` + `TO authenticated` RLS policy + `has_table_privilege` assertion |
| Actor inserts like/comment with forged `user_id`/`author_id` | Tampering | RLS INSERT `WITH CHECK (user_id = (SELECT auth.uid()))` / `WITH CHECK (author_id = (SELECT auth.uid()))` |
| Non-mutual-follower reads wishlist comments via RLS bypass (service-role path) | Information Disclosure | Two-layer: RLS SELECT `USING` (first layer); DAL WHERE pre-flight (second layer, Phase 54) |
| Duplicate like insertion (double-tap, race condition) | Integrity | `UNIQUE(user_id, watch_id)` constraint — insert either succeeds or conflicts; `ON CONFLICT DO NOTHING` at DAL layer |
| Comment body exceeds 500 chars via service-role direct insert | Integrity | DB CHECK `char_length(body) <= 500`; DB-level bypass of Server Action Zod validation is blocked |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The inline `follows` subquery in the RLS policy is evaluated under the authenticated user's session context (not escalated to SECDEF) | Pattern 2: Comments gate | LOW — confirmed `follows_select_all TO authenticated USING (true)` exists; authenticated user's session can read `follows` inline |
| A2 | Supabase's migration runner executes files in filename-sort order and treats files without `BEGIN`/`COMMIT` as non-transactional | Pattern 4: Enum ADD VALUE | MEDIUM — if the runner wraps bare files in an implicit transaction, `ADD VALUE` fails. Supabase's default is that bare files are NOT wrapped; but the planner should test on local before prod push |
| A3 | `wearEvents` has FK-cascade SELECT policy coverage for authenticated users (wear_events visibility expanded post-Phase-10 per CONTEXT.md code_context) | Pattern 1: wear_likes policies | LOW — `wear_likes` SELECT policy uses `USING (true)` open to all authenticated; no watch-status subquery needed for likes |

**All other claims in this research are VERIFIED against live migration files or CITED from CONTEXT.md locked decisions.**

---

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/20260511010000_phase37_layer_d.sql` — Canonical anon-block `DO $$` assertion idiom with `has_table_privilege('anon', ...)`, `REVOKE ALL FROM anon; REVOKE ALL FROM public`, and full assertion block pattern. Verified as the most complete and recent precedent for per-user tables with RLS.
- `supabase/migrations/20260423000046_phase11_secdef_revoke_public.sql` — SECDEF `REVOKE FROM PUBLIC, anon` + `has_function_privilege('anon', ...) = false` assertion. Verified as the SECDEF pattern if needed.
- `supabase/migrations/20260420000001_social_tables_rls.sql:17` — Confirms `follows_select_all ON public.follows FOR SELECT TO authenticated USING (true)` exists; validates D-06 pre-flight.
- `supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql` — Exact `ADD COLUMN IF NOT EXISTS notify_on_* boolean NOT NULL DEFAULT true` + assertion idiom for D-10.
- `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` — Confirmed as REMOVAL pattern (rename+recreate). Explicitly NOT the pattern for D-09 ADD VALUE.
- `supabase/migrations/20260423000002_phase11_notifications.sql` — `TO authenticated` RLS policy naming + `CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS` + `CREATE POLICY` idempotency pattern.
- `src/db/schema.ts` — Confirmed current `notificationTypeEnum` has `['follow', 'watch_overlap']`; confirmed `profileSettings` shape; confirmed Drizzle `unique()` syntax used in `follows` and `wearEvents`.
- `.planning/phases/53-schema-rls-enum-extension/53-CONTEXT.md` — 12 locked decisions D-01..D-12; all pre-flights resolved.

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` — Pitfall 1 (anon RLS), Pitfall 2 (SECDEF auto-grant), Pitfall 3 (asymmetric gate one-layer), Pitfall 12 (enum migration pattern). HIGH confidence in pitfall descriptions due to codebase grounding.
- `.planning/research/ARCHITECTURE.md` — Comments RLS policy shape (SELECT + INSERT both with gate), DAL mutual-follow helper shape, non-transactional ADD VALUE pattern. Data model (polymorphic) rejected per D-01/D-02 locked decisions; RLS and enum patterns are used.

---

## Metadata

**Confidence breakdown:**
- Schema (table shape, constraints, FK cascade): HIGH — verified against existing tables in schema.ts and migration files
- RLS (policy syntax, gate encoding, TO authenticated): HIGH — verified against Phase 37, Phase 11, Phase 7 migration files
- Enum extension (ADD VALUE, non-transactional): HIGH — verified by reading Phase 24 migration (contrast pattern) + ARCHITECTURE.md
- Anon-block assertion (`has_table_privilege` idiom): HIGH — verified in Phase 37 migration (exact code)
- Index set: HIGH — read patterns documented in PITFALLS.md and ARCHITECTURE.md

**Research date:** 2026-05-22
**Valid until:** Stable — migration file patterns in this project change infrequently; valid for the duration of v6.0 (through Phase 58).

---
phase: 11-schema-storage-foundation
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - drizzle/0003_phase11_wear_events_columns.sql
  - src/db/schema.ts
  - supabase/migrations/20260423000001_phase11_wear_visibility.sql
  - supabase/migrations/20260423000002_phase11_notifications.sql
  - supabase/migrations/20260423000003_phase11_pg_trgm.sql
  - supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql
  - supabase/migrations/20260423000004b_phase11_storage_rls_secdef_fix.sql
  - supabase/migrations/20260423000005_phase11_debt02_audit.sql
  - tests/integration/debt02-rls-audit.test.ts
  - tests/integration/phase11-notifications-rls.test.ts
  - tests/integration/phase11-pg-trgm.test.ts
  - tests/integration/phase11-schema.test.ts
  - tests/integration/phase11-storage-rls.test.ts
findings:
  critical: 0
  warning: 5
  info: 7
  total: 12
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-04-22
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The Phase 11 schema + storage foundation is structurally sound and demonstrates strong migration discipline (atomic BEGIN/COMMIT, IF NOT EXISTS guards, DROP-THEN-CREATE policy pattern, inline verification DO-blocks). Enum backfill safety, recipient-only RLS on notifications, three-tier storage RLS, and the DEBT-02 regression gate are all correctly wired.

The most notable concern is **WR-01**: the three `SECURITY DEFINER` helper functions introduced in Migration 4b are granted `EXECUTE` to `PUBLIC` by default and expose a wider probe surface than the storage policy needs — in particular `get_wear_event_owner_bypassing_rls` directly returns `user_id`, contradicting the file's own comment ("does not expose user_id"). A privilege tightening or helper consolidation is recommended before production rollout.

Secondary concerns: the Migration 1 backfill uses an INNER JOIN that silently leaves users-without-profile_settings on the `'public'` default (WR-02); the dedup UNIQUE index relies on payload shape conventions without DB-level shape enforcement (WR-03); and Migration 4 persists a broken policy in history that Migration 4b replaces (WR-04).

No Critical findings. Integration tests use real Supabase Auth users via `admin.auth.admin.createUser` (per the scoping requirement) with the one exception noted in IN-01.

## Warnings

### WR-01: SECURITY DEFINER helpers grant implicit probe access to any authenticated caller

**File:** `supabase/migrations/20260423000004b_phase11_storage_rls_secdef_fix.sql:24-61`
**Issue:** Three `SECURITY DEFINER` functions are created without explicit `REVOKE` / `GRANT` clauses. Postgres defaults `EXECUTE` to `PUBLIC` for new functions, so any authenticated (and potentially `anon`) user can call:
- `public.get_wear_event_visibility_bypassing_rls(uuid)` → leaks the visibility enum for any wear event UUID (existence + tier).
- `public.get_wear_event_owner_bypassing_rls(uuid)` → leaks the `user_id` of the owner for any wear event UUID.
- `public.viewer_follows_bypassing_rls(uuid, uuid)` → lets any caller probe arbitrary follow relationships, bypassing `follows` RLS.

The file comment explicitly claims the fix "does not expose user_id, photo_url, note, or any other fields" — but `get_wear_event_owner_bypassing_rls` literally returns `user_id`. The comment and the code disagree.

The storage SELECT policy needs only a yes/no answer ("can this viewer see this photo?"). Exposing three primitive helpers widens the RPC attack surface unnecessarily.

**Fix:** Either (a) restrict execute privileges after each function:
```sql
REVOKE EXECUTE ON FUNCTION public.get_wear_event_visibility_bypassing_rls(uuid) FROM PUBLIC, anon;
-- repeat for the other two
-- grant only to roles that actually need it (typically no one outside the policy):
-- The storage RLS policy runs as the calling user but the SECURITY DEFINER function still executes,
-- so authenticated is the minimum needed GRANT:
GRANT EXECUTE ON FUNCTION public.get_wear_event_visibility_bypassing_rls(uuid) TO authenticated;
```
or (b) collapse the three helpers into a single boolean-returning function that leaks no intermediate state:
```sql
CREATE OR REPLACE FUNCTION public.can_view_wear_photo(p_wear_event_id uuid, p_viewer_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM wear_events we
     WHERE we.id = p_wear_event_id
       AND (
         we.visibility = 'public'
         OR (we.visibility = 'followers' AND EXISTS (
               SELECT 1 FROM follows f
                WHERE f.follower_id = p_viewer_id
                  AND f.following_id = we.user_id
             ))
         OR we.user_id = p_viewer_id
       )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_wear_photo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_wear_photo(uuid, uuid) TO authenticated;
```
Option (b) is preferred — it eliminates the leak entirely and simplifies the storage policy to one function call.

Also fix the now-inaccurate comment header ("does not expose user_id...") so it reflects the real exposure surface.

### WR-02: Migration 1 backfill silently leaves users-without-profile_settings on the default

**File:** `supabase/migrations/20260423000001_phase11_wear_visibility.sql:60-66`
**Issue:** The backfill uses an INNER JOIN (`UPDATE ... FROM profile_settings ps WHERE ps.user_id = we.user_id`). Any `wear_events` row whose user has no matching `profile_settings` row keeps the `DEFAULT 'public'`. In practice the Phase 7 trigger populates settings for every user, so this is unlikely to fire — but the comment claims "The backfill UPDATE runs unconditionally", which overstates what actually happens.

The inline verification DO-block only asserts no row became `'followers'`. It does not assert that every legacy row was actually touched by the backfill.

**Fix:** Either document the assumption and add a coverage assertion:
```sql
DO $$
DECLARE
  orphan_count bigint;
BEGIN
  SELECT COUNT(*) INTO orphan_count
    FROM wear_events we
   WHERE NOT EXISTS (
     SELECT 1 FROM profile_settings ps WHERE ps.user_id = we.user_id
   );
  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Backfill coverage gap: % wear_events rows have no matching profile_settings row; add trigger backfill first',
      orphan_count;
  END IF;
END $$;
```
Or switch to a LEFT JOIN with an explicit default so orphan rows are resolved deterministically:
```sql
UPDATE wear_events we
   SET visibility = CASE COALESCE(ps.worn_public, true)
                      WHEN true  THEN 'public'::wear_visibility
                      ELSE            'private'::wear_visibility
                    END
  FROM wear_events we2
  LEFT JOIN profile_settings ps ON ps.user_id = we2.user_id
 WHERE we.id = we2.id;
```
Also update the misleading comment ("runs unconditionally") to "runs only for users with a profile_settings row; the Phase 7 trigger guarantees coverage".

### WR-03: Dedup UNIQUE index has no DB-level guard on required payload keys

**File:** `supabase/migrations/20260423000002_phase11_notifications.sql:85-92`
**Issue:** The partial UNIQUE index `notifications_watch_overlap_dedup` indexes on `payload->>'watch_brand_normalized'` and `payload->>'watch_model_normalized'`. Two Postgres behaviors combine to weaken the dedup:
1. Missing keys evaluate to NULL.
2. In UNIQUE indexes, NULLs are treated as distinct by default — so two rows with `payload = '{}'::jsonb` both insert successfully.

If any caller forgets to include the normalized keys (or leaves them empty), the dedup is silently disabled for those rows. The comment delegates enforcement to "Phase 13 Server Action", but a DB-level safety net would be cheap to add.

**Fix:** Tighten the partial predicate to require both keys are present and non-empty:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS notifications_watch_overlap_dedup
  ON notifications (
    user_id,
    (payload->>'watch_brand_normalized'),
    (payload->>'watch_model_normalized'),
    ((created_at AT TIME ZONE 'UTC')::date)
  )
  WHERE type = 'watch_overlap'
    AND payload ? 'watch_brand_normalized'
    AND payload ? 'watch_model_normalized'
    AND length(payload->>'watch_brand_normalized') > 0
    AND length(payload->>'watch_model_normalized') > 0;
```
Optionally add a CHECK constraint so malformed payloads are rejected up front rather than silently bypassing dedup:
```sql
ALTER TABLE notifications
  ADD CONSTRAINT notifications_watch_overlap_payload_shape
  CHECK (
    type != 'watch_overlap'
    OR (
      payload ? 'watch_brand_normalized'
      AND payload ? 'watch_model_normalized'
      AND length(payload->>'watch_brand_normalized') > 0
      AND length(payload->>'watch_model_normalized') > 0
    )
  );
```

### WR-04: Migration 4 ships a broken policy that only Migration 4b corrects

**File:** `supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql:49-77`
**Issue:** The `wear_photos_select_three_tier` policy in Migration 4 JOINs `wear_events` directly. Because `wear_events` has owner-only RLS, the EXISTS subquery returns false for every non-owner viewer — the policy is fail-closed for public and followers-tier photos. Migration 4b replaces the policy with the SECURITY DEFINER variant.

End state is correct, but:
- Any developer who partially applies migrations (stops after 4, debugs, then re-runs) sees a broken three-tier visibility during the window.
- Future squashing/rebasing of migrations will have to carry both files into history.
- Migration 4 itself lacks a warning comment that it is known-broken without 4b.

**Fix:** Preferred: squash Migrations 4 and 4b into a single `20260423000004_phase11_storage_bucket_rls.sql` before first production deploy. The bucket creation, helper functions, and SELECT policy should all be defined together in one transaction.

If squashing is out of scope, at minimum add a header comment to Migration 4 immediately under the `-- Phase 11 Migration 4/5 ...` line:
```sql
-- KNOWN ISSUE: The SELECT policy below is BROKEN without Migration 4b.
-- wear_events has owner-only RLS, so the JOIN returns no rows for non-owner viewers.
-- Migration 4b (20260423000004b_phase11_storage_rls_secdef_fix.sql) replaces this policy
-- with SECURITY DEFINER helpers that bypass wear_events RLS.
-- DO NOT deploy Migration 4 without 4b — non-owner access will fail closed.
```

### WR-05: phase11-storage-rls.test.ts lacks follower-removal and signed-URL persistence coverage

**File:** `tests/integration/phase11-storage-rls.test.ts:157-199`
**Issue:** The nine-cell access matrix covers the static case where the follow relationship exists throughout the test. Two real-world flows are untested:
1. **Unfollow loses access**: F-follows-A → F downloads followers-tier photo successfully → F unfollows A → F attempts download again → should fail. Without this test, a bug in the `follows` check (e.g., stale cache, policy uses ID rather than row existence) would pass.
2. **Visibility tier change tightens access**: A's wear event is created `public` → F downloads successfully → A updates `visibility = 'private'` → F attempts download → should fail. This exercises the policy's dynamic behavior as visibility changes over time.

**Fix:** Add two test cases to the `three-tier SELECT` describe block:
```ts
it('F loses access to followers-tier photo after unfollowing A', async () => {
  const c = await clientAs(userF)
  expect(await canDownload(c, 'followers')).toBe(true) // sanity
  await db.delete(follows).where(eq(follows.followerId, userF.id))
  expect(await canDownload(c, 'followers')).toBe(false)
  // Restore follow relationship for subsequent tests
  await db.insert(follows).values({ followerId: userF.id, followingId: userA.id })
})

it('F loses access when A tightens a public photo to private', async () => {
  const c = await clientAs(userF)
  expect(await canDownload(c, 'public')).toBe(true) // sanity
  await db.update(wearEvents).set({ visibility: 'private' }).where(eq(wearEvents.id, wearEventIds.public))
  expect(await canDownload(c, 'public')).toBe(false)
  await db.update(wearEvents).set({ visibility: 'public' }).where(eq(wearEvents.id, wearEventIds.public))
})
```

## Info

### IN-01: Hardcoded UUID in phase11-schema.test.ts causes parallel-run collisions

**File:** `tests/integration/phase11-schema.test.ts:68`
**Issue:** `const testUserId = '00000000-0000-0000-0000-0000000b1101'` is a fixed UUID. If two test runs overlap (e.g., `vitest --parallel` or re-running a failed suite while another is mid-flight), the `INSERT ... ON CONFLICT DO NOTHING` leaves a shared row that the second run may mutate, and the afterAll cascade will delete data the first run still needs.
**Fix:** Generate per-run: `const testUserId = randomUUID()` (import from `node:crypto`, matching the `phase11-pg-trgm.test.ts` pattern).

### IN-02: Migration 3 assumes `extensions` schema exists

**File:** `supabase/migrations/20260423000003_phase11_pg_trgm.sql:11`
**Issue:** `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions` fails on a plain-Postgres target that lacks the `extensions` schema. Supabase provisions it by default, but local tooling or alternate deployment targets may not.
**Fix:** Add a defensive schema create immediately before:
```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
```

### IN-03: Migration 5 sanity assertion doesn't verify policy shape

**File:** `supabase/migrations/20260423000005_phase11_debt02_audit.sql:44-68`
**Issue:** The DO-block checks that 12 named policies exist, but does not verify each UPDATE policy has `WITH CHECK`, or that each policy uses `(SELECT auth.uid())` (InitPlan caching). A future edit could silently drop `WITH CHECK` from `watches_update_own` and this regression gate would still report green.
**Fix:** Extend the assertion to inspect `pg_policy` columns (`qual`, `with_check`) for UPDATE policies:
```sql
IF EXISTS (
  SELECT 1 FROM pg_policies
   WHERE schemaname = 'public'
     AND policyname IN ('users_update_own', 'watches_update_own', 'user_preferences_update_own')
     AND (with_check IS NULL OR with_check = '')
) THEN
  RAISE EXCEPTION 'DEBT-02: one of the UPDATE policies is missing WITH CHECK';
END IF;
```

### IN-04: EXPLAIN tests are effectively no-ops

**File:** `tests/integration/phase11-pg-trgm.test.ts:94-118` and `tests/integration/phase11-schema.test.ts:173-194`
**Issue:** Both EXPLAIN tests run the plan, log a warning on unexpected output, and then assert only that the index exists (which is already covered by a prior test). The EXPLAIN call is dead code in the sense that its result is never tested.
**Fix:** Either remove the EXPLAIN block entirely (the preceding existence test is the authoritative gate), or convert to `it.skip('EXPLAIN — manual verification only', ...)` to document intent. Bonus: if you retain EXPLAIN, use `EXPLAIN (FORMAT JSON)` and assert on structured fields rather than text-matching the plan.

### IN-05: Test password strings are inconsistent across fixtures

**File:** `tests/fixtures/users.ts:25,30` and `tests/integration/phase11-storage-rls.test.ts:66-67`
**Issue:** `seedTwoUsers` uses fixed `test-password-A` / `test-password-B`; the storage-rls test generates a per-run `p11-pass-{prefix}-${stamp}`. Reading them side-by-side requires remembering both conventions, and some tests (debt02-rls-audit) hard-code the fixed strings based on email prefix — a fragile coupling.
**Fix:** Centralize: expose test passwords from `tests/fixtures/users.ts` (or a shared `tests/fixtures/passwords.ts`) and have all suites import the constant rather than branching on email prefix. Not a correctness bug; maintenance hygiene.

### IN-06: phase11-notifications-rls.test.ts cleanup may leave stranded public.users rows

**File:** `tests/integration/phase11-notifications-rls.test.ts:40-47`
**Issue:** afterAll deletes notifications explicitly and then calls `cleanup()` (which deletes `auth.users`). Whether the `public.users` shadow row cascades depends on the trigger topology. The `phase11-storage-rls` test handles this by explicitly deleting `public.users` before `admin.auth.admin.deleteUser`. The two suites use different cleanup shapes for the same underlying schema.
**Fix:** Standardize on the storage-rls pattern:
```ts
try {
  await db.delete(notifications).where(inArray(notifications.userId, [userA.id, userB.id]))
  await db.delete(users).where(inArray(users.id, [userA.id, userB.id]))
} catch {}
try { await cleanup() } catch {}
```

### IN-07: src/db/schema.ts users.email not unique at the DB layer

**File:** `src/db/schema.ts:38`
**Issue:** The shadow `users` table declares `email: text('email').notNull()` without a UNIQUE constraint. Supabase Auth enforces uniqueness on `auth.users.email`, but a direct Drizzle insert could create a duplicate in the shadow table. This is pre-existing (Phase 2) and not introduced by Phase 11, but worth noting given Phase 11 adds more test fixtures that insert into `users` directly.
**Fix:** Out of Phase 11 scope. Track as tech-debt if not already captured.

---

_Reviewed: 2026-04-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

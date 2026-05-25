---
phase: 53-schema-rls-enum-extension
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/db/schema.ts
  - src/components/notifications/NotificationRow.tsx
  - src/data/notifications.ts
  - supabase/migrations/20260522000000_phase53_likes_comments_rls.sql
  - supabase/migrations/20260522000001_phase53_notification_enum.sql
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 53: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 53 lays the likes + comments schema foundation: three new tables (`watch_likes`,
`wear_likes`, `comments`), their FK cascades, UNIQUE/CHECK constraints, RLS policies,
GRANT/REVOKE, in-migration `DO $$` assertions, a non-transactional enum `ADD VALUE`
migration, and a defensive 2→6 widening of the `notificationTypeEnum` type union in two
client/DAL files.

Most of the work is solid: the `REVOKE ALL FROM anon/public` + `TO authenticated` pattern
is correct and asserted; FK cascades are present and asserted (`confdeltype = 'c'`); the
`comments_exactly_one_target` XOR CHECK and `comments_body_length` CHECK are correct; all
DDL is static and SQL-injection-safe; the enum migration correctly omits `BEGIN/COMMIT`
for `ALTER TYPE ADD VALUE`; the likes policies correctly carry NO wishlist gate per D-08;
and the comments policies do encode the mutual-follow gate symmetrically in both SELECT
`USING` and INSERT `WITH CHECK` per D-06.

However, there is one BLOCKER that defeats the central purpose of the comments RLS gate:
the `EXISTS (SELECT 1 FROM watches w ...)` subquery inside the comments policies is itself
subject to the owner-only RLS on `watches`, so the `owned/sold/grail` public-read branch
returns zero rows for any non-owner. The migration author verified the `follows`
dependency but not the load-bearing `watches` dependency. There is also a real UX defect
in the notification inbox from the type widening: the new enum values flow through
grouping/bucketing and produce empty (zero-height) rows under section headers.

## Critical Issues

### CR-01: comments RLS gate is defeated by owner-only RLS on the `watches` subquery

**File:** `supabase/migrations/20260522000000_phase53_likes_comments_rls.sql:201-218` (SELECT) and `:235-252` (INSERT)
**Issue:**
Both `comments_select` (USING) and `comments_insert` (WITH CHECK) gate watch-target
comments through:

```sql
AND EXISTS (
  SELECT 1 FROM watches w WHERE w.id = comments.watch_id
    AND (
      w.status IN ('owned', 'sold', 'grail')
      OR w.user_id = (SELECT auth.uid())
      OR ( w.status = 'wishlist' AND <mutual-follow EXISTS> )
    )
)
```

A subquery inside an RLS policy executes **under the invoking role's own RLS**, not as a
privileged role. The `watches` table has only owner-only policies (verified in
`20260420000000_rls_existing_tables.sql:39-41`):

```sql
CREATE POLICY watches_select_own ON public.watches
  FOR SELECT USING (user_id = (SELECT auth.uid()));
```

There is no public-read policy on `watches` and no SECURITY DEFINER helper for cross-user
watch reads. Therefore, for any authenticated user querying a watch they do **not** own,
the inner `EXISTS (SELECT 1 FROM watches w ...)` returns **zero rows** regardless of the
watch's status. The `w.status IN ('owned','sold','grail')` branch — the entire "comment on
a public watch" path that GATE-02 / D-06 are built around — is **dead for non-owners**.

Net effect: non-owners can never SELECT or INSERT comments on any watch (owned, sold,
grail, or wishlist). Only the watch's owner satisfies the subquery (via
`watches_select_own`), collapsing the feature to "owner can comment on their own watch."
This is the opposite of the intended visibility model and silently breaks the core
deliverable.

The migration comment at lines 187-189 explicitly verifies the `follows` dependency
(`follows_select_all TO authenticated USING(true)` exists) but never verifies the
`watches` read dependency — which is the one that fails. The mutual-follow `wishlist`
branch is also unreachable for the same reason: it is nested inside the same
`EXISTS (... FROM watches w ...)` that the non-owner can't satisfy.

**Fix:**
Make the watch-status lookup execute with privileges that bypass owner-only RLS, mirroring
the project's established pattern for cross-user reads inside RLS (the Phase 11 storage
SECURITY DEFINER helpers in `20260423000045_phase11_storage_rls_secdef_fix.sql`). Add a
`SECURITY DEFINER` helper that returns the gate decision and call it from the policies:

```sql
CREATE OR REPLACE FUNCTION public.can_view_watch_comments(p_watch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM watches w
     WHERE w.id = p_watch_id
       AND (
         w.status IN ('owned', 'sold', 'grail')
         OR w.user_id = (SELECT auth.uid())
         OR (
           w.status = 'wishlist'
           AND EXISTS (SELECT 1 FROM follows
                        WHERE follower_id = (SELECT auth.uid()) AND following_id = w.user_id)
           AND EXISTS (SELECT 1 FROM follows
                        WHERE follower_id = w.user_id AND following_id = (SELECT auth.uid()))
         )
       )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_watch_comments(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_view_watch_comments(uuid) TO authenticated;
```

Then both policies become:

```sql
USING ( wear_event_id IS NOT NULL
        OR (watch_id IS NOT NULL AND public.can_view_watch_comments(watch_id)) )
```

(and the same in INSERT WITH CHECK, retaining `author_id = (SELECT auth.uid())`).
Note the project memory `project_supabase_secdef_grants.md`: `REVOKE FROM PUBLIC` alone
does not block anon — explicit `REVOKE ... FROM anon` is required, as shown above.

A required regression assertion: the existing `DO $$` block must be extended to actually
exercise the gate (e.g., set `request.jwt.claim.sub` / `SET ROLE authenticated` and verify
a non-owner can read a comment on an `owned` watch). The current assertion block only
checks structural existence (tables, FKs, constraint names, policy counts, anon privilege)
and would pass green against this broken behavior.

## Warnings

### WR-01: notification type widening produces empty rows + visible section headers in the inbox

**File:** `src/components/notifications/NotificationsInbox.tsx:32-61` (interaction with `NotificationRow.tsx:52-54`)
**Issue:**
`NotificationRow` returns `null` for the four new types (`watch_like`, `wear_like`,
`watch_comment`, `wear_comment`) via the guard at `NotificationRow.tsx:52`. But
`NotificationsInbox` filters/buckets rows **before** rendering, and the bucketing in
`bucketByDay` (lines 136-142) and the length checks (`buckets.today.length > 0`, etc., at
lines 32, 42, 52) count these rows. Once any phase actually writes a `watch_like` /
`wear_like` / `watch_comment` / `wear_comment` notification, the inbox will:

1. Push the new-type rows into a bucket (they pass through `collapseWatchOverlaps` as
   "non-overlap" at line 82 and into `bucketByDay`).
2. Render the section header (`Today` / `Yesterday` / `Earlier`) because
   `bucket.length > 0`.
3. Render a zero-height/empty `NotificationRow` (returns `null`) for each.

Result: a "Today" header with no visible content underneath, or a section that looks
broken. The comment at `NotificationRow.tsx:21-22` claims new types render `null` "so
Phase 56-58 can ship new type rendering incrementally" — but the inbox-level counting was
not updated to match, so the null-render is not actually invisible at the page level.

Note this is latent in Phase 53 (no write-path for the new types exists yet, so no rows of
these types are produced), which is why it is a WARNING rather than a BLOCKER. It becomes a
visible production defect the moment the first write-path lands (Phase 56-58) unless the
inbox filters unknown types first.

**Fix:**
Filter unsupported types at the inbox boundary so the null-render and the section-count
agree. Add a single source of truth for renderable types:

```ts
const RENDERABLE_TYPES = new Set(['follow', 'watch_overlap'])
// in NotificationsInbox, before collapse/bucket:
const renderable = rows.filter((r) => RENDERABLE_TYPES.has(r.type))
const collapsed = collapseWatchOverlaps(renderable)
```

Keep the `NotificationRow.tsx:52` guard as defense-in-depth, but make the inbox the
authoritative filter so empty sections cannot appear.

### WR-02: `getNotificationsForViewer` returns rows of types the UI cannot render, with no filter

**File:** `src/data/notifications.ts:33-68`
**Issue:**
The DAL `SELECT` (lines 37-54) has no `type` filter. With the enum widened to 6 values,
`getNotificationsForViewer` will return `watch_like` / `wear_like` / `watch_comment` /
`wear_comment` rows to the page as soon as they exist. Combined with WR-01, these flow
straight into the inbox and consume one of the 50 `limit` slots each (line 36 / 54) while
rendering nothing — meaning unrenderable notifications can crowd out renderable ones from
the newest-50 window. The DAL is the correct place to scope to renderable types, since it
already owns the `limit`.

**Fix:**
Add a `type` predicate to the `where` so only currently-renderable types count against the
limit, until the render paths land:

```ts
import { inArray } from 'drizzle-orm'
// ...
.where(and(
  eq(notifications.userId, viewerId),
  inArray(notifications.type, ['follow', 'watch_overlap']),
))
```

When Phase 56-58 add render paths, expand this list in lockstep with the UI.

### WR-03: enum migration assertion is not idempotent-safe on re-run if a 7th value is ever added

**File:** `supabase/migrations/20260522000001_phase53_notification_enum.sql:38-40`
**Issue:**
The post-migration assertion hard-codes `enum_count <> 6`. The `ALTER TYPE ... ADD VALUE
IF NOT EXISTS` statements (lines 20-23) are idempotent, but the assertion is brittle: it
encodes a snapshot count rather than verifying the four target values are present. If a
future phase adds a fifth interaction type to `notification_type` and this migration is
re-run during a `supabase db reset` replay (migrations replay in order), the count will be
7 and this historical migration will `RAISE EXCEPTION`, breaking the reset — a foot-gun
called out directly in the project memory `project_local_db_reset.md`.

**Fix:**
Assert presence of the four values this migration is responsible for, not a global count:

```sql
DO $$
DECLARE present int;
BEGIN
  SELECT count(*) INTO present
    FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
   WHERE t.typname = 'notification_type'
     AND e.enumlabel IN ('watch_like','wear_like','watch_comment','wear_comment');
  IF present <> 4 THEN
    RAISE EXCEPTION 'Phase 53 enum migration failed -- expected 4 new values present, found %', present;
  END IF;
END $$;
```

This survives future additions and remains a true regression guard for this migration's
own contract.

## Info

### IN-01: dead code in `resolveHref` / `resolveCopy` for new types

**File:** `src/components/notifications/NotificationRow.tsx:130-133` and `:176-179`
**Issue:**
`resolveHref` and `resolveCopy` carry comments describing fallback handling for the four
new types, but the early-return guard at line 52 means these functions are never invoked
for those types. The fallbacks (`return '#'` / `return null`) are unreachable for the new
types. This is acceptable defensive code, but the comments overstate the situation by
implying these paths run; they do not. Low priority — flagging because the comment claims
("fall back to '#' safely") could mislead a future maintainer into thinking new types are
partially wired here when they are gated out upstream.

**Fix:**
Trim the comments to "unreachable while the line-52 guard excludes these types" or remove
the explanatory prose. No behavior change needed.

### IN-02: `NotificationPayload` discriminated union not extended for new enum values

**File:** `src/lib/notifications/types.ts:24`
**Issue:**
`NotificationPayload = FollowPayload | WatchOverlapPayload` was not widened alongside the
2→6 enum change. This is consistent with Phase 53 being schema-only (no write-path for the
new types yet), so it is not a defect. Flagging only so the future write-path phase
(56-58) remembers to add `WatchLikePayload` / `WearLikePayload` / `WatchCommentPayload` /
`WearCommentPayload` here in lockstep with the render paths, to keep the payload union and
the enum aligned.

**Fix:**
No action this phase. Track for Phase 56-58.

### IN-03: schema.ts comment claims "4 new values" but enum widened from 2 to 6

**File:** `src/db/schema.ts:32`
**Issue:**
The comment reads "Phase 53 D-09: 4 new values added" — accurate for the count of
`ADD VALUE` statements, but the array directly below (lines 34-41) now lists 6 values total.
The neighboring comment at line 30 ("Narrowed to 2 values in Phase 24") plus the "4 new"
note correctly implies 2+4=6, so this is internally consistent — minor. Confirmed the
Drizzle array order matches the migration `ADD VALUE` order
(`watch_like, wear_like, watch_comment, wear_comment`), which is the important invariant.

**Fix:**
Optional: note "2 existing + 4 new = 6 total" for clarity. No correctness impact.

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

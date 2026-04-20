---
phase: 07-social-schema-profile-auto-creation
reviewed: 2026-04-19T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/app/actions/watches.ts
  - src/app/actions/wearEvents.ts
  - src/app/insights/page.tsx
  - src/app/watch/[id]/page.tsx
  - src/components/insights/SleepingBeautiesSection.tsx
  - src/components/watch/WatchDetail.tsx
  - src/components/watch/WatchForm.tsx
  - src/data/activities.ts
  - src/data/watches.ts
  - src/data/wearEvents.ts
  - src/db/schema.ts
  - src/lib/types.ts
  - supabase/migrations/20260420000001_social_tables_rls.sql
  - supabase/migrations/20260420000002_profile_trigger.sql
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-04-19
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 7 introduces social schema tables (`profiles`, `follows`, `profile_settings`, `activities`), RLS policies for all social tables plus pre-existing tables (`wear_events`), and a profile auto-creation trigger. The existing application files (actions, DAL, components) are carrying forward from prior phases with no changes to their core logic.

The RLS migration and trigger are the highest-risk artifacts in this phase. Three critical issues were found: the profile trigger has an unbounded deduplication loop that can stall indefinitely, `getCurrentUser` uses a non-null assertion on `user.email` without handling the null case, and the `activities` INSERT RLS policy blocks the service-role insert path used by the server action. Four warnings cover a missing index, a type safety gap, a logic error in the sleeping beauties filter, and an unhandled empty-update edge case in the DAL. Three info items cover style consistency and dead code.

---

## Critical Issues

### CR-01: Unbounded deduplication loop in profile trigger can stall indefinitely

**File:** `supabase/migrations/20260420000002_profile_trigger.sql:38-41`

**Issue:** The `WHILE EXISTS (...)` loop regenerates a random 4-digit suffix on each iteration. If all 9,000 possible suffixes for a given base (e.g., `john_1000` through `john_9999`) are taken, the loop never terminates, causing the INSERT into `public.users` to hang and eventually time out. The probability is low today but non-zero for common email prefixes (`admin`, `user`, `info`) once the user base grows.

**Fix:** Add an iteration cap and raise an exception if exceeded:
```sql
-- Replace the WHILE block with:
candidate_username := base_username;
suffix := 0;
LOOP
  EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate_username);
  suffix := suffix + 1;
  IF suffix > 100 THEN
    RAISE EXCEPTION 'could not generate unique username after 100 attempts for base: %', base_username;
  END IF;
  candidate_username := left(base_username, 25) || '_' || floor(random() * 9000 + 1000)::int::text;
END LOOP;
```
This surfaces the failure as a database error (auditable) rather than an infinite hang.

---

### CR-02: Non-null assertion on `user.email` in `getCurrentUser` can crash on anonymous sessions

**File:** `src/lib/auth.ts:18`

**Issue:** `return { id: user.id, email: user.email! }` — Supabase Auth allows users created without an email (OAuth flows using phone, magic link with phone, anonymous auth). If `user.email` is `undefined`, the `!` assertion suppresses TypeScript's check but does not prevent a runtime value of `undefined` from flowing into callers that treat it as a string. Server actions pass this email-derived object to DAL functions; if email is later used (e.g., for profile generation in the trigger), this is silently wrong.

**Fix:** Guard the null case explicitly:
```typescript
export async function getCurrentUser(): Promise<{ id: string; email: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || !user.email) throw new UnauthorizedError()
  return { id: user.id, email: user.email }
}
```

---

### CR-03: `activities` INSERT RLS blocks server-action inserts when RLS is enabled without `service_role` bypass

**File:** `supabase/migrations/20260420000001_social_tables_rls.sql:32`

**Issue:** The policy `activities_insert_own` allows INSERT only when `user_id = (SELECT auth.uid())`. The `logActivity` call in `src/data/activities.ts` runs server-side via a Drizzle client. If that client is initialized with the anon key (rather than the service-role key), `auth.uid()` returns `NULL` at the database level because JWT context is not forwarded from the server action. The INSERT will silently be rejected by RLS — the `try/catch` in the actions marks it as non-fatal, so callers will see no error, but activities will never be written.

Verify which key `@/db` uses to create its Postgres connection. If it uses the anon key or no JWT, the policy will never match.

**Fix:** Either initialize the Drizzle client with the Supabase `service_role` key (which bypasses RLS), or set the `role` / `request.jwt` on the connection before each insert. The service-role approach is standard for server-side DAL operations:
```typescript
// src/db/index.ts (or equivalent)
// Use SUPABASE_SERVICE_ROLE_KEY, not SUPABASE_ANON_KEY
const connectionString = process.env.DATABASE_URL // must use service role credentials
```
Document the required env var clearly so it is not accidentally replaced with the anon connection string.

---

## Warnings

### WR-01: Missing index on `profiles.id` for follow-relationship joins

**File:** `src/db/schema.ts:128-140`

**Issue:** `profiles` uses `id` as its primary key (which Postgres indexes automatically), but `follows` has indices on `follower_id` and `following_id` pointing to `users.id`, not `profiles.id`. The schema design FK-chains `profiles.id → users.id`, meaning feed queries that join `follows → profiles` will use the primary key index. This is fine. However, `profiles_username_idx` is defined as an ordinary `index` rather than a `unique` index. The `username` column has `.unique()` in the column definition, which creates a unique constraint (and an implicit unique index) at the DB level, so the explicit `index('profiles_username_idx')` creates a redundant second index.

**Fix:** Remove the redundant `profiles_username_idx` from the table `(table) => [...]` array — the unique constraint already provides the index. This saves one index worth of write overhead on every profile insert/update.
```typescript
// Before
(table) => [index('profiles_username_idx').on(table.username)]
// After — no extra index needed; .unique() in column definition covers it
() => []
```

---

### WR-02: `SleepingBeautiesSection` incorrectly includes `grail` watches in sleeping-beauty logic

**File:** `src/components/insights/SleepingBeautiesSection.tsx:14`

**Issue:** `const owned = watches.filter((w) => w.status === 'owned' || w.status === 'grail')` — `grail` watches are wishlist items the user does not yet own. They cannot be worn, so they will never have a `lastWornDate`. The downstream filter `entry.days !== null && entry.days >= SLEEPING_BEAUTY_DAYS` will always exclude them (since `daysSince(undefined)` returns `null`), but the parent page's `<SleepingBeautiesSection watches={ownedWithWear} />` already passes only `ownedWithWear` (which is derived from `ownedWatches` — i.e. `status === 'owned'`). The `grail` branch in the filter is dead code that adds noise and could become a bug if the prop type is ever widened to include wishlist watches.

**Fix:** Simplify the filter to `status === 'owned'` only:
```typescript
const owned = watches.filter((w) => w.status === 'owned')
```

---

### WR-03: `updateWatch` in DAL does not guard against empty update objects

**File:** `src/data/watches.ts:127-138`

**Issue:** If `mapDomainToRow(data)` returns an empty object `{}` (caller passes `{}`), `db.update(watches).set({ updatedAt: new Date() })` will issue a valid SQL UPDATE that touches all rows matching the WHERE clause, updating only `updated_at`. While this is not a data-loss bug, it is semantically incorrect (the caller intended a no-op) and emits unnecessary database round-trips. The action layer's `updateWatchSchema.partial()` allows an empty object to pass validation.

**Fix:** Add a guard before the DB call:
```typescript
export async function updateWatch(userId: string, watchId: string, data: Partial<Watch>): Promise<Watch> {
  const rowData = mapDomainToRow(data)
  if (Object.keys(rowData).length === 0) {
    // No-op: re-fetch and return current state
    const current = await getWatchById(userId, watchId)
    if (!current) throw new Error(`Watch not found or access denied: watchId=${watchId}, userId=${userId}`)
    return current
  }
  // ... existing update logic
}
```

---

### WR-04: `getMostRecentWearDates` uses a dynamic `import('drizzle-orm')` inside a hot function

**File:** `src/data/wearEvents.ts:48`

**Issue:** `const { inArray } = await import('drizzle-orm')` is a dynamic import inside `getMostRecentWearDates`, which is called on every page load of the insights page. Dynamic imports are resolved once and cached by Node's module system, so this is not a correctness bug — but it signals that `inArray` was not included in the top-level static import on line 5 (`import { eq, and, desc } from 'drizzle-orm'`). If the module cache is ever bypassed (e.g., in test environments or edge runtimes), this adds latency.

**Fix:** Add `inArray` to the top-level import:
```typescript
import { eq, and, desc, inArray } from 'drizzle-orm'
```
Then remove the dynamic import inside the function body.

---

## Info

### IN-01: `insertWatchSchema` does not validate `isChronometer` but `Watch` type has the field

**File:** `src/app/actions/watches.ts:13-38`

**Issue:** The Zod schema includes `isFlaggedDeal` (line 34) but omits `isChronometer`. The `Watch` type in `src/lib/types.ts:51` defines `isChronometer?: boolean`. This means a caller who submits `isChronometer: true` via `addWatch` will have the field silently stripped by the schema — it will never be persisted even though the DB column exists. The `handleUrlImport` in `WatchForm.tsx:172` also maps `data.isChronometer` into form state, so it gets lost on submit.

**Fix:** Add the field to the schema:
```typescript
isChronometer: z.boolean().optional(),
```

---

### IN-02: `follows` table allows a user to follow themselves (no self-follow guard)

**File:** `supabase/migrations/20260420000001_social_tables_rls.sql:18` and `src/db/schema.ts:143-155`

**Issue:** The `follows` table has no CHECK constraint preventing `follower_id = following_id`. The RLS INSERT policy only checks `follower_id = auth.uid()` — it does not block self-follows. A self-follow row is semantically nonsensical and will corrupt feed queries that assume `follower_id != following_id`.

**Fix:** Add a CHECK constraint in the schema or migration:
```sql
ALTER TABLE public.follows ADD CONSTRAINT follows_no_self_follow CHECK (follower_id != following_id);
```
In Drizzle schema:
```typescript
(table) => [
  check('follows_no_self_follow', sql`${table.followerId} != ${table.followingId}`),
  // ... existing indices
]
```

---

### IN-03: `InsightsPage` does not handle `getCurrentUser` throwing `UnauthorizedError`

**File:** `src/app/insights/page.tsx:123`

**Issue:** `const user = await getCurrentUser()` can throw `UnauthorizedError` if the session is absent or expired. Unlike the server actions (which wrap this in try/catch), the page component lets the error propagate to Next.js's error boundary. This will produce an unhandled error page rather than a redirect to login. All other pages using `getCurrentUser` directly (e.g., `src/app/watch/[id]/page.tsx:14`) share this pattern.

**Fix:** Either wrap in try/catch and redirect, or configure a middleware layer that enforces authentication before these routes are reached (the standard Next.js pattern):
```typescript
// Option A: middleware (preferred — single location)
// middleware.ts: redirect unauthenticated requests to /login

// Option B: per-page guard
try {
  user = await getCurrentUser()
} catch {
  redirect('/login')
}
```
If middleware already exists and protects these routes, this is a non-issue — but no middleware file was in scope for this review.

---

_Reviewed: 2026-04-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

# Pitfalls Research

**Domain:** Adding multi-user social features (profiles, follows, activity feed, taste overlap) to an existing single-user Supabase app
**Researched:** 2026-04-19
**Confidence:** HIGH (RLS, N+1 patterns), MEDIUM (privacy enforcement patterns, feed scaling), HIGH (Drizzle-specific)

---

## Critical Pitfalls

### Pitfall 1: Enabling RLS Without Writing All Required Policies — Existing Data Becomes Invisible

**What goes wrong:**
RLS is disabled by default on Supabase tables. When you enable it on `watches`, `user_preferences`, or any table that has existing rows, Postgres immediately enforces "deny all by default." Any read that doesn't match a policy returns zero rows — silently. The user logs in, their collection appears empty, and there is no error in the console or server logs. This is the most common "my data disappeared" report when adding RLS to a running app.

**Why it happens:**
Developers enable RLS on all tables at once (a correct security step) but write policies incrementally. During the gap between enabling and finishing all policies, production queries fail. A developer testing in the Supabase SQL Editor also won't catch this because the SQL Editor runs as the `postgres` superuser, which bypasses RLS entirely.

**How to avoid:**
- Write all policies for a table before enabling RLS on it in production.
- Test policies using the **User Impersonation** feature in the Supabase Dashboard (select a real user, browse the data, confirm what they see matches expectations).
- Never test RLS correctness from the SQL Editor alone.
- Use a migration that does `ALTER TABLE watches ENABLE ROW LEVEL SECURITY` and `CREATE POLICY ...` in the same transaction.
- Minimum required policies for each existing table: SELECT policy scoped to `auth.uid() = user_id`, INSERT policy with `WITH CHECK (auth.uid() = user_id)`, UPDATE policy with both USING and WITH CHECK, DELETE policy scoped to owner.

**Warning signs:**
- Collection appears empty after login but data exists in the DB.
- Supabase Dashboard "Security Advisors" lint shows tables with RLS disabled that are exposed to the Data API.
- Daily Supabase email warning about tables without RLS policies.

**Phase to address:** Phase 1 (RLS foundation) — must complete before any multi-user visibility work begins. Carries from v1.0 MR-03.

---

### Pitfall 2: `auth.uid()` Called Per-Row Without `SELECT` Wrapper — Policy Blows Up Query Plans

**What goes wrong:**
An RLS policy written as `user_id = auth.uid()` calls the `auth.uid()` function once per row evaluated. Postgres cannot hoist this into an `initPlan` (a once-per-query cached value) unless you wrap it: `user_id = (SELECT auth.uid())`. Without the wrapper, on a table with 10,000 rows and a policy on every read, the function is called 10,000 times per query. This compounds badly on tables scanned for joins (e.g., the activity feed joining `watches`, `follows`, and `activities`).

**Why it happens:**
The natural syntax is `auth.uid()` without wrapping. Official Supabase docs show both forms, but the performance difference is not prominent in beginner documentation. The problem is invisible at small scale — it manifests at hundreds of rows.

**How to avoid:**
Write all RLS policies using the `SELECT` wrapper form:
```sql
-- Correct (auth.uid() evaluated once per statement)
CREATE POLICY "owner_read" ON watches
  FOR SELECT USING (user_id = (SELECT auth.uid()));

-- Incorrect (auth.uid() evaluated per row)
CREATE POLICY "owner_read" ON watches
  FOR SELECT USING (user_id = auth.uid());
```
Apply the same pattern to `auth.jwt()` and any `security definer` function calls in policies.

**Warning signs:**
- `EXPLAIN ANALYZE` shows `InitPlan` absent on policy-filtered queries; function appears in Filter node.
- Supabase Performance Advisor flags `auth_rls_initplan` lint (lint `0003_auth_rls_initplan`).
- Collection load times increase linearly as the user adds more watches.

**Phase to address:** Phase 1 (RLS foundation) — establish the correct pattern before any policies are written.

---

### Pitfall 3: Public Profile Policy Bypasses Privacy Settings — RLS Grants Access, App Logic Filters It Too Late

**What goes wrong:**
A common implementation mistake: add an RLS policy that allows any authenticated user to read another user's `watches` rows, then rely on application code to check `profile.visibility_setting` before rendering. The data is fetched first (privacy setting checked second). This means:
- The data has already left the database by the time the app decides not to show it.
- A direct Supabase client call (or `curl` with an anon key) bypasses the app entirely and sees private data.
- Any Server Action that reuses the DAL without threading the viewer context gets the unfiltered result.

**Why it happens:**
Privacy settings feel like a UI concern ("don't show this tab"), not a data concern. Developers add the RLS policy to allow cross-user reads, then add an `if (profile.is_private) return null` in the component. The policy and the app check diverge as the codebase grows.

**How to avoid:**
Two-layer enforcement — both must be present:

Layer 1 (RLS): Policy allows read only when the profile is public OR the viewer follows the owner:
```sql
CREATE POLICY "collection_public_or_followed" ON watches
  FOR SELECT USING (
    user_id = (SELECT auth.uid())  -- own data always readable
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = watches.user_id
        AND profiles.collection_visibility = 'public'
    )
    OR EXISTS (
      SELECT 1 FROM follows
      WHERE follows.follower_id = (SELECT auth.uid())
        AND follows.following_id = watches.user_id
    )
  );
```

Layer 2 (DAL): Every cross-user query in the DAL also checks visibility settings as a WHERE clause, not a post-fetch filter.

Privacy settings changes must trigger a policy re-evaluation — do not cache the visibility state on the client.

**Warning signs:**
- Visiting `/users/[username]/collection` while logged out (using the anon key) returns watches when the profile is set to private.
- The DAL has `if (profile.isPublic)` checks after `await db.select()` calls rather than in the WHERE clause.
- Privacy setting changes take effect immediately in the UI but a direct API call still returns stale data.

**Phase to address:** Phase 2 (public profiles + privacy controls) — design both layers simultaneously. Never add the RLS policy without the DAL enforcement.

---

### Pitfall 4: `UPDATE` Policy Missing `WITH CHECK` — Users Can Steal Ownership of Rows

**What goes wrong:**
An UPDATE policy written with only `USING` (the filter for which rows can be updated) but without `WITH CHECK` (the constraint on the new row state) lets an authenticated user change the `user_id` column of a row they own to someone else's user ID. They have effectively donated a watch to another user's collection, or planted data in another user's account. With a follows table, a missing `WITH CHECK` lets a user create follow records claiming to be someone else.

**Why it happens:**
Many RLS examples online show `USING` only and omit `WITH CHECK`. The distinction is not obvious: `USING` filters what you can touch; `WITH CHECK` validates what the result looks like after the change.

**How to avoid:**
For any table with a `user_id` or ownership column, write UPDATE policies with both clauses and make both check ownership:
```sql
CREATE POLICY "owner_update" ON watches
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
```
The `WITH CHECK` clause prevents the user from changing `user_id` to anything other than their own ID, even if they pass the `USING` filter.

**Warning signs:**
- UPDATE policies that have `USING` but no `WITH CHECK`.
- A user can set `user_id` to a null or arbitrary UUID via a direct API call without getting a policy violation error.

**Phase to address:** Phase 1 (RLS foundation) — applies to all tables including the existing `watches` and `user_preferences` tables.

---

### Pitfall 5: Activity Feed Built With Per-Item Queries — N+1 Kills Performance

**What goes wrong:**
The natural implementation of an activity feed:
1. Query `activities` WHERE follower's `following_id` IN (...) → returns N activity rows.
2. For each activity row, query `watches` to get watch details.
3. For each activity row, query `profiles` to get actor username/avatar.

This produces N+1 queries (1 for the feed, N for watches, N for profiles). With 20 feed items, that's 41 database round-trips. With 50 feed items across 10 followed users, the home page makes 100+ queries. At Horlo's target scale (tens of collectors, each with <500 watches) this is survivable but still slow; it also scales poorly.

**Why it happens:**
Fetching related data lazily is the natural pattern when iterating over result rows. Drizzle's relational query API can mask this — `db.query.activities.findMany({ with: { watch: true, actor: true } })` looks like a single call but may translate to subqueries that behave poorly depending on the nesting depth.

**How to avoid:**
Fetch the feed in a single JOIN query or at most two queries (feed rows + batch-loaded related entities):
```sql
SELECT
  a.id, a.activity_type, a.created_at,
  w.id as watch_id, w.brand, w.model, w.image_url,
  p.username, p.avatar_url
FROM activities a
JOIN watches w ON w.id = a.watch_id
JOIN profiles p ON p.user_id = a.actor_user_id
WHERE a.actor_user_id IN (
  SELECT following_id FROM follows WHERE follower_id = $userId
)
ORDER BY a.created_at DESC
LIMIT 20;
```
Write the DAL query as an explicit join, not as nested relational queries. Verify with `EXPLAIN ANALYZE` before shipping.

**Warning signs:**
- Supabase logs show 20+ queries per home page load.
- Home page response time scales linearly with number of followed users.
- Drizzle query is `findMany` with nested `with` clauses three levels deep.

**Phase to address:** Phase 3 (activity feed) — design the schema and DAL query together; don't add the JOIN after the fact.

---

### Pitfall 6: Offset Pagination on the Activity Feed Degrades at Depth

**What goes wrong:**
`LIMIT 20 OFFSET 60` causes Postgres to scan and discard 60 rows before returning the next 20. On an activity feed ordered by `created_at DESC`, as users scroll deeper into history, query time grows linearly with offset. At offset 500 the query may take 10x longer than at offset 0, and Postgres explicitly documents this behavior as a known inefficiency.

Additionally, offset pagination on a live feed has a correctness problem: if new activities are inserted while the user is paginating, rows shift and the user sees duplicates or misses entries.

**Why it happens:**
`OFFSET` is the default pagination pattern in most query builders and tutorials. Keyset pagination requires composing a WHERE clause from the last-seen row's values, which is less obvious.

**How to avoid:**
Use keyset (cursor) pagination from the start. For the activity feed ordered by `created_at`:
```sql
WHERE a.created_at < $lastSeenTimestamp
  AND a.id < $lastSeenId  -- tiebreaker for same-timestamp rows
ORDER BY a.created_at DESC, a.id DESC
LIMIT 20;
```
Pass `(lastSeenTimestamp, lastSeenId)` as the cursor to the next page fetch. This is stable under inserts and O(1) regardless of page depth.

**Warning signs:**
- Feed pagination uses `OFFSET` in Drizzle queries.
- Loading older feed items becomes noticeably slower than loading recent ones.

**Phase to address:** Phase 3 (activity feed) — implement keyset pagination from the initial build.

---

### Pitfall 7: Follows Table RLS Allows Any User to Follow Anyone — No Opt-Out, No Block

**What goes wrong:**
The initial follows table implementation grants any authenticated user the ability to INSERT a follow for any target `following_id`. This is correct for the open-follow model, but it means a user can be followed without consent and without any way to remove a follower. When privacy controls are added later (Phase 2+), the existing follows records conflict with the new visibility rules: a user set their profile to private but still has followers from before the setting existed.

**Why it happens:**
The follow model is designed as open (like Rdio / Twitter unconfirmed follows). Blocking is treated as out of scope. But without a basic "remove a follower" or "block" escape hatch, the system has no remedy for harassment or unwanted visibility.

**How to avoid:**
- Even if blocking is out of scope for v2.0, design the follows table to support `status` (active / blocked) from the start. Adding a column later requires a migration and policy rewrites.
- RLS on follows: only the follower can INSERT their own follows (`follower_id = (SELECT auth.uid())`); only the followed user can DELETE follows targeting them (`following_id = (SELECT auth.uid())`).
- When privacy is set to private, exclude that user's data from reads regardless of follow status.

**Warning signs:**
- `follows` INSERT policy does not check `follower_id = (SELECT auth.uid())`.
- No DELETE policy that lets the followed user remove their own followers.
- Privacy setting has no effect on already-following users' feed access.

**Phase to address:** Phase 1 schema design — the schema decision (add `status` column) must happen before the table is created in production.

---

### Pitfall 8: Existing Single-User DAL Functions Break When Given a Foreign User ID

**What goes wrong:**
Current DAL functions like `getWatches(userId)` and `getPreferences(userId)` were written with the assumption that `userId` always equals the authenticated user's ID. When profiles for other users are added, those same functions get called with a foreign `userId` to render their public collection. But the DAL functions may include write-guards or preference-specific joins that make no sense for read-only cross-user access. Worse, if the function is reused without modification, it may fail the RLS check because the query is written as `WHERE user_id = auth.uid()` — which won't match the foreign user.

**Why it happens:**
The single-user functions conflate "whose data" with "is this the current user." When reused for foreign profiles, both assumptions break.

**How to avoid:**
- Introduce two explicit DAL function categories: `getMyWatches()` (current user, read-write, full data) and `getUserCollection(targetUserId)` (cross-user, read-only, visibility-filtered).
- Never reuse write-capable DAL functions for cross-user reads.
- RLS policies and DAL functions must independently enforce visibility — the DAL function cannot assume RLS is sufficient, and RLS cannot assume the DAL function checks visibility.

**Warning signs:**
- A DAL function accepts a `userId` parameter but also calls `auth.uid()` inside in a way that conflicts when the two differ.
- The same function is used for both "my collection" and "their collection" with only a flag to switch behavior.
- `getUserCollection` returns 0 rows for a public profile when viewed while logged in as a different user.

**Phase to address:** Phase 2 (public profiles) — identify all affected DAL functions before building any cross-user read path.

---

### Pitfall 9: Taste Overlap (Common Ground) Computed in the Browser With Fetched Foreign Data

**What goes wrong:**
The existing similarity engine runs entirely client-side in the browser. When Common Ground (taste overlap with another collector) is added, the naive implementation fetches the other user's full collection to the browser, then runs the similarity engine locally. Problems:
- The other user's full collection (up to 500 watches, all fields) is sent over the wire even if only 5 fields are needed for overlap calculation.
- The browser must hold two full collections in memory simultaneously.
- The network payload is large and the page load is slow.
- If the other user's collection is private or partially private (wishlist hidden), the entire collection cannot be fetched client-side — the calculation breaks.

**Why it happens:**
The similarity engine is a pure function that's already written. Reusing it on the client with fetched data is the path of least resistance.

**How to avoid:**
Compute Common Ground server-side in a Server Component or Server Action. Pass only the overlap result (the labels and top matches) to the client — not the raw collections. This also means visibility rules can be applied at the query level before the data is used in computation.

If any part of the overlap calculation must be client-side for interactive features, pass pre-filtered, pre-aggregated data (e.g., tags and role distributions, not full watch records).

**Warning signs:**
- A collector profile page fetches `/api/users/[id]/watches` and passes the result directly to `analyzeSimilarity()` in a Client Component.
- The network tab shows a response with all watch fields for the foreign user's full collection.
- Collector profile load time scales with the size of the other user's collection.

**Phase to address:** Phase 2 (collector profiles) — design the Common Ground computation path before building the UI.

---

### Pitfall 10: Privacy Setting Change Doesn't Invalidate Existing Cached Data

**What goes wrong:**
A user changes their profile from public to private. The change updates the `profiles` table. But:
- Next.js Server Components may have the old profile cached (via `fetch` cache or React cache).
- Any follower who has the public profile open in their browser sees stale data until they refresh.
- The activity feed may still show recent activities from this user's collection even after they went private.

This is not a security hole (RLS blocks new queries), but it creates a visible inconsistency: the user set their profile private and it still appears public for several minutes.

**Why it happens:**
Next.js App Router caches Server Component fetches aggressively. The default behavior for data fetched in a Server Component is to cache for the lifetime of the request or longer if `fetch()` is used with `cache: 'force-cache'`.

**How to avoid:**
- Tag all cross-user data fetches with `revalidatePath` or `revalidateTag` on privacy setting mutation.
- Use `cache: 'no-store'` for profile visibility checks — privacy state must always be fresh.
- In the Server Action that updates privacy settings, call `revalidatePath('/users/[username]')` and `revalidatePath('/')` (for the feed) immediately after the DB write.
- Activity feed queries must re-check visibility at read time, not only at write time.

**Warning signs:**
- A user sets profile to private; visiting `/users/[username]` while logged out still shows the collection for 30–60 seconds.
- Server Actions that update privacy settings do not call any `revalidatePath` or `revalidateTag`.

**Phase to address:** Phase 2 (privacy controls) — every privacy mutation must include cache invalidation as part of its implementation contract.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Enable RLS on new tables only, skip existing | Faster initial launch | Existing tables exposed until a later migration; creates a false sense of security | Never — enable RLS on all tables in the same migration |
| Check privacy in the component, not the DAL | Simple to implement | Data leaks via direct API calls; policy and UI logic diverge | Never for cross-user data |
| Use OFFSET pagination for the activity feed | One line of code | Feed queries degrade at depth; duplicates/misses on live inserts | Only if feed has <5 pages total and users never scroll to history |
| Run Common Ground calculation client-side with full collection fetch | Reuses existing similarity engine | Large payloads, breaks on partial-private collections, slow page loads | Only for prototype/demo — not for production |
| Skip `WITH CHECK` on UPDATE policies | Fewer lines of SQL | Users can change `user_id` on rows they own | Never |
| Single DAL function for own and foreign user reads | Less code | Auth context ambiguity; breaks when visibility rules differ | Never for cross-user reads |
| Inline `auth.uid()` directly in RLS policies (no SELECT wrapper) | Natural syntax | Per-row function calls; query plans degrade at scale | Only on tables with <100 rows permanently |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase RLS on `follows` table | INSERT policy only checks that the row can be inserted, not that `follower_id` matches the caller | Policy: `WITH CHECK (follower_id = (SELECT auth.uid()))` |
| Supabase RLS on `activities` table | SELECT policy allows all authenticated users to read all activities | Policy: allow only own activities OR activities from followed users |
| Drizzle ORM relational queries | Deep `with: { actor: true, watch: true }` nesting generates subqueries not joins | Write explicit `.select().from().leftJoin()` for feed queries; verify with EXPLAIN ANALYZE |
| Next.js Server Components + cache | Privacy setting update not reflected because Server Component cached the previous profile | Tag the profile fetch with a cache tag; invalidate on privacy mutation |
| Drizzle migrations + existing RLS | Running a migration that adds a column doesn't automatically update RLS policies that reference that column | Review all affected policies after schema changes |
| Supabase anon key in client code | Anon key is safe for RLS-protected tables but exposes schema via PostgREST introspection | Restrict the Data API or disable PostgREST introspection in production |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries in activity feed | Home page makes 20–100+ DB round-trips | Single JOIN query for feed with related entities | Any feed with >5 items |
| `auth.uid()` without `SELECT` wrapper in RLS policies | Query plan shows per-row function calls; slow collection load | `(SELECT auth.uid())` in all policies | Tables with >500 rows |
| OFFSET pagination on activity feed | Older pages load slower; duplicates appear on live updates | Keyset pagination using `(created_at, id)` cursor | Feeds with >50 total items |
| Missing index on `follows(follower_id)` | Feed query scans entire follows table | Add composite index `(follower_id, following_id)` and `(following_id)` | Any user with >10 follows |
| Missing index on `activities(actor_user_id, created_at)` | Feed query scans all activities | Composite index `(actor_user_id, created_at DESC)` | Any user with >100 activity events |
| Common Ground computed with full foreign collection fetch | Collector profile page sends 500-watch payload to browser | Server-side computation; send only the result | Any collector with >20 watches |
| RLS subquery on follows without index | EXISTS subquery in watch policy does full follows table scan | Index `follows(following_id)` for the follow-check subquery | Follows table with >100 rows |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| RLS enabled but no policies written | All reads return empty rows (not a data leak, but a reliability failure that prompts developers to disable RLS) | Write policies before enabling RLS; test with user impersonation |
| Privacy check only in UI component | Private data accessible via direct Supabase/API call | Enforce visibility in RLS policy AND DAL WHERE clause |
| `WITH CHECK` omitted from UPDATE policies | Users can change `user_id` on owned rows — data injection into other accounts | Always include `WITH CHECK (user_id = (SELECT auth.uid()))` on all UPDATE policies |
| `service_role` key used in any client-accessible code path | Bypasses all RLS; full DB access for anyone who extracts the key | Service role key must never leave the server; use only in server-only migrations or admin scripts |
| Follows INSERT policy allows arbitrary `follower_id` | User A can create a follow record claiming to be User B, inflating follower counts or accessing B's follower-gated content | `WITH CHECK (follower_id = (SELECT auth.uid()))` on INSERT |
| Activity events generated server-side with user-supplied `actor_user_id` | User can log activity as another user | Server Action sets `actor_user_id` from `auth.uid()` in session — never from client input |
| Profile page reveals private user ID in URL that can be brute-forced | Enumeration of user accounts | Use username slugs, not internal UUIDs, in public URLs |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Privacy setting change has no confirmation of what becomes hidden | User toggles "private" and doesn't know if their existing followers still see their data | Show explicit "Your collection is now hidden from all visitors" confirmation after change |
| Follow/unfollow state optimistically updated but not rolled back on error | User sees wrong follower count; network retry creates duplicate follows | Optimistic update + revert on error; deduplicate follow records with UNIQUE constraint |
| "Common Ground" section appears for users with <5 watches in common | Shows meaningless overlap percentages | Only render Common Ground when there are ≥5 shared watches or tags |
| Activity feed shows the viewer's own activity mixed with followed users | Makes the feed feel like a personal log rather than a discovery surface | Filter own activities out of the main feed; show them in the profile's "Stats" tab |
| Collector profile shows full collection before follow-wall is explained | Confuses user about what is public vs. follow-gated | Clear header label indicating visibility status of what they're viewing |

---

## "Looks Done But Isn't" Checklist

- [ ] **RLS on all tables:** Enable RLS and write policies for `follows`, `activities`, `profiles` AND the existing `watches`, `user_preferences`. Verify with User Impersonation — not the SQL Editor.
- [ ] **`WITH CHECK` on all UPDATE policies:** Check every UPDATE policy in the migration files has both `USING` and `WITH CHECK`.
- [ ] **Privacy settings enforce at DB layer:** Attempt to read a private user's collection via a direct `fetch` with the anon key — confirm it returns 0 rows, not filtered-in-app rows.
- [ ] **Activity feed uses JOIN query:** Run `EXPLAIN ANALYZE` on the home page feed query — confirm it's 1–2 queries, not N+1.
- [ ] **Keyset pagination on feed:** Confirm feed pagination uses `(created_at, id)` cursor, not `OFFSET`.
- [ ] **Follow INSERT policy:** Attempt to insert a follow with a spoofed `follower_id` (different from session user) — confirm it returns a policy violation.
- [ ] **Privacy change invalidates cache:** Change a profile from public to private; reload the profile URL in an incognito tab within 5 seconds — confirm the collection is no longer visible.
- [ ] **Common Ground computed server-side:** Check the network tab on a collector profile page — confirm no response containing the full foreign watch collection is sent to the client.
- [ ] **`auth.uid()` wrapped in SELECT in all policies:** Review every policy in migrations for bare `auth.uid()` calls (use grep).
- [ ] **Indexes on policy columns:** Confirm `follows(follower_id)`, `follows(following_id)`, `activities(actor_user_id, created_at)`, and `watches(user_id)` all have indexes.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RLS enabled with no policies — users see empty collection | LOW (if caught quickly) | Write policies immediately; no data is lost, only access is blocked; users see data again once policies are in place |
| Privacy check skipped — private profiles exposed | HIGH | Audit all cross-user queries; add DAL WHERE clause enforcement; notify affected users; rotate any sensitive data if needed |
| N+1 feed queries shipped to production | MEDIUM | Rewrite DAL query to use JOIN; deploy; feed performance improves immediately with no data migration |
| OFFSET pagination shipped — performance degrades over time | MEDIUM | Migrate to keyset pagination; requires updating the DAL function and the client-side "load more" handler; no data migration |
| `WITH CHECK` missing — malicious user_id injection occurred | HIGH | Audit affected rows; reset ownership based on creation logs or activity history; add policy; assess scope of damage |
| Common Ground computed client-side with full collection leak | MEDIUM | Move computation to Server Component; no data migration; deploy fix |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| RLS not on existing tables | Phase 1 — RLS foundation | User Impersonation in Supabase Dashboard; anon key request returns 0 rows for other users' data |
| `auth.uid()` without SELECT wrapper | Phase 1 — RLS foundation | Grep all migration files for bare `auth.uid()`; run EXPLAIN ANALYZE on watch queries |
| `WITH CHECK` missing on UPDATE | Phase 1 — RLS foundation | Attempt to change `user_id` via direct API call; confirm policy violation |
| Privacy setting enforced UI-only | Phase 2 — public profiles + privacy controls | Direct anon-key fetch of private profile returns 0 rows |
| Follows INSERT policy incomplete | Phase 1 schema design / Phase 2 follows feature | Attempt spoofed follower_id insert; confirm rejection |
| No cache invalidation on privacy change | Phase 2 — privacy controls | Privacy toggle test with 5-second incognito reload |
| Existing DAL functions reused for cross-user reads | Phase 2 — collector profiles | Code review gate: no shared DAL function handles both own and foreign reads |
| N+1 activity feed queries | Phase 3 — activity feed | EXPLAIN ANALYZE confirms ≤2 queries per feed load |
| OFFSET pagination on feed | Phase 3 — activity feed | Code review: no OFFSET in feed DAL query |
| Common Ground client-side with full data | Phase 2 — collector profiles | Network tab: no full foreign collection in response payload |
| Missing DB indexes on follow/activity columns | Phase 1 (schema) + Phase 3 (feed) | `\d follows` and `\d activities` in psql; EXPLAIN ANALYZE confirms index scans |
| Privacy change not invalidating Next.js cache | Phase 2 — privacy controls | Integration test: privacy toggle then immediate re-fetch returns updated state |

---

## Sources

- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence
- [Supabase RLS Performance Advisors](https://supabase.com/docs/guides/database/database-advisors?lint=0003_auth_rls_initplan) — HIGH confidence (lint `0003_auth_rls_initplan`)
- [Supabase RLS Best Practices — Makerkit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — MEDIUM confidence
- [Fixing RLS Misconfigurations — ProsperaSoft](https://prosperasoft.com/blog/database/supabase/supabase-rls-issues/) — MEDIUM confidence
- [Enforcing RLS in Multi-Tenant Apps — DEV Community](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2) — MEDIUM confidence
- [Scalable Activity Feed Architecture — GetStream](https://getstream.io/blog/scalable-activity-feed-architecture/) — HIGH confidence
- [Keyset Cursors vs Offsets for Postgres — Sequin](https://blog.sequinstream.com/keyset-cursors-not-offsets-for-postgres-pagination/) — HIGH confidence
- [PostgreSQL Keyset Pagination Guide — Stacksync](https://www.stacksync.com/blog/keyset-cursors-postgres-pagination-fast-accurate-scalable) — HIGH confidence
- [Next.js Data Security Guide](https://nextjs.org/docs/app/guides/data-security) — HIGH confidence
- [Drizzle ORM Joins](https://orm.drizzle.team/docs/joins) — HIGH confidence
- [RLS Performance and Best Practices — Supabase GitHub Discussion #14576](https://github.com/orgs/supabase/discussions/14576) — HIGH confidence
- [N+1 Query Problem — Medium](https://medium.com/@saad.minhas.codes/n-1-query-problem-the-database-killer-youre-creating-f68104b99a2d) — MEDIUM confidence

---
*Pitfalls research for: adding multi-user social features to existing single-user Supabase/Next.js app (Horlo v2.0 Taste Network)*
*Researched: 2026-04-19*

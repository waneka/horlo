# Pitfalls Research

**Domain:** Adding production navigation, notifications, people-search, and WYWT photo post flow to an existing Next.js 16 / Supabase / RLS / cacheComponents app (Horlo v3.0)
**Researched:** 2026-04-21
**Confidence:** HIGH (cacheComponents constraints, RLS, viewer-aware DAL, iOS getUserMedia, Storage RLS), MEDIUM (three-tier visibility ripple, HEIC edge cases, Sonner wiring)

---

## A. Bottom Nav + Cache Components

---

### Pitfall A-1: Bottom Nav in Static Layout Body Breaks cacheComponents — Viewer Data in the Wrong Render Context

**Severity:** CRITICAL

**What goes wrong:**
`cacheComponents: true` makes the root layout statically prerenderable. Any call to `cookies()` or `headers()` in the layout body (outside a Suspense boundary) throws at build/prerender time or silently returns empty values. The bottom nav needs the authenticated viewer's unread notification count and profile URL. Placing the bottom nav directly in `<body>` — outside a Suspense boundary — forces those `cookies()` reads into the static render path and either breaks the build or produces a nav that always shows "logged out" state.

**Why it happens:**
The v2.0 layout refactor already moved `<Header>` inside a Suspense boundary for exactly this reason. That lesson is not obvious to the implementer building the bottom nav, who looks at the layout and sees it compiles fine — the error only surfaces when cacheComponents prerender runs (or on first prod deploy).

**How to avoid:**
Wrap the bottom nav component in the same Suspense boundary that wraps `<Header>` and `{children}`, or in its own dedicated `<Suspense>` below `{children}`. The bottom nav must not be a sibling of the `<head>` inline theme script; it must be inside the dynamic Suspense subtree. Concrete task: in `src/app/layout.tsx`, confirm the bottom nav renders inside the existing `<Suspense>` wrapper, never at the bare `<body>` level.

**Warning signs:**
- Build output contains: `Error: cookies() was called outside a request scope` or similar dynamic API error.
- Bottom nav renders but unread count is always 0 even for authenticated users.
- `next build` succeeds locally (Node env skips prerender) but prod deploy fails.

**Phase to address:** Bottom nav phase (Phase 11) — verify layout placement before writing any viewer-data fetch inside the nav component.

---

### Pitfall A-2: Bottom Nav Active State Hydration Mismatch via `usePathname`

**Severity:** MEDIUM

**What goes wrong:**
`usePathname()` is a client hook. A bottom nav that uses it to highlight the active tab must be a Client Component (`'use client'`). If the nav is initially SSR'd with no active state (server doesn't know the path at prerender time for a cached component) and the client hydrates with a path-based active class, React sees a mismatch and logs a hydration warning. Visually: the active indicator flickers or jumps on first paint.

**Why it happens:**
The natural instinct is to keep the nav as a Server Component for performance. Adding `usePathname` without the `'use client'` directive is a compile error, so the developer adds the directive — but doesn't account for what the server rendered versus what the client expects.

**How to avoid:**
Mark the bottom nav (or just the active-state sub-component) as `'use client'`. Accept that this means a small JS bundle for the nav. The server renders the nav without active-state classes; the client adds them after hydration. Use `suppressHydrationWarning` only as a last resort — prefer designing the component so the server-rendered and client-rendered output are identical (i.e., render no active state on the server, add it client-side via effect).

**Warning signs:**
- React hydration warning in browser console mentioning the nav element.
- Active tab indicator visibly jumps 100–200ms after page load.

**Phase to address:** Bottom nav phase — add hydration test during UAT.

---

### Pitfall A-3: iOS Safe Area Inset Clips Content Behind Sticky Bottom Nav

**Severity:** HIGH

**What goes wrong:**
On iPhone with home indicator (all Face ID devices), `position: fixed; bottom: 0` places the nav over the home indicator bar. On iPhones, the bottom ~34px is the home indicator zone. Without `padding-bottom: env(safe-area-inset-bottom)` on both the nav and the page's scroll container, content at the bottom of a page is hidden beneath the nav. This is invisible on desktop and Android testing but breaks iOS consistently.

**Why it happens:**
Developers test on desktop, where safe-area-inset is 0. The issue is iOS-specific and requires a real device or accurate simulator testing to catch.

**How to avoid:**
Apply `padding-bottom: calc(64px + env(safe-area-inset-bottom))` to the bottom nav (where 64px is nav height). Apply a matching `pb-[calc(64px+env(safe-area-inset-bottom))]` (or equivalent CSS var) to the page's main scroll container so the last card or CTA is not obscured. Add `viewport-fit=cover` to the `<meta name="viewport">` tag in layout.tsx — without this, `env(safe-area-inset-bottom)` returns 0 even on notched devices.

**Warning signs:**
- Last item in a list is cut off on iPhone.
- The Wear CTA button cannot be tapped on iPhones with home indicator.
- `env(safe-area-inset-bottom)` evaluates to 0 (missing `viewport-fit=cover`).

**Phase to address:** Bottom nav phase — must be in the initial build, not a post-launch fix.

---

### Pitfall A-4: Bottom Nav Visible on Auth Pages Causes Layout Shift

**Severity:** MEDIUM

**What goes wrong:**
The bottom nav renders in the root layout, which wraps all routes including `/login`, `/signup`, and `/auth/callback`. On auth pages, the nav is irrelevant and its safe-area padding pushes the login form up. More visibly, the nav flashes in for an unauthenticated visitor who lands on `/login` before being redirected — it appears and disappears, causing a jarring layout shift.

**Why it happens:**
Root layout components render on every route by default. Auth page exclusion requires either a route group layout or a conditional render based on the current path.

**How to avoid:**
Use Next.js route groups: put auth routes in `(auth)/` with their own layout that does not include the bottom nav. Alternatively, render the bottom nav conditionally based on `usePathname()` matching non-auth routes — but route groups are cleaner and don't require client-side logic in the root layout.

**Warning signs:**
- Bottom nav visible on `/login` page.
- Layout shift score (CLS) elevated on auth page loads.

**Phase to address:** Bottom nav phase — route group decision must be made before nav implementation begins.

---

### Pitfall A-5: Inline Theme Script + Bottom Nav Theme Toggle Interaction

**Severity:** LOW

**What goes wrong:**
The inline `<script>` in `<head>` reads `document.cookie` and sets `classList` before paint to prevent FOUC. This script is tightly coupled to the cookie name and `classList` values the theme system uses. If the bottom nav (or the profile dropdown in the top nav) introduces a new theme toggle mechanism that changes the cookie name or format, the inline script breaks and users see white flash on dark-mode preference.

**Why it happens:**
The inline script is a fragile string-based snippet, not a module import. It is easy to update the theme store logic without updating the inline script.

**How to avoid:**
Treat the inline theme script as a configuration contract: document the cookie name (e.g., `theme`) and the expected values (`light`/`dark`/`system`) in a comment above the script. Any changes to the theme system must update both the script and the store. Prefer keeping the theme toggle in the top nav profile dropdown (existing location) rather than adding a second toggle in the bottom nav, to minimize divergence risk.

**Warning signs:**
- FOUC (white flash) on dark-mode preference after a nav-related change.
- Theme cookie name changed but inline script still checks old name.

**Phase to address:** Bottom nav phase — check inline script contract when wiring the profile dropdown theme toggle.

---

## B. Notifications

---

### Pitfall B-1: Bell Unread Count Queried in Root Layout — Per-Request DB Hit on Every Page

**Severity:** HIGH

**What goes wrong:**
The unread notification count needs to appear in the top nav bell and in the bottom nav (if shown there). Fetching it in the root layout means every authenticated page load hits the `notifications` table. At Horlo's current scale this is tolerable, but the pattern is wrong: it ties page render latency to a DB round-trip for a non-critical piece of UI.

**Why it happens:**
The layout is where the bell lives, so developers put the fetch there. The cacheComponents architecture makes this worse: if the fetch is inside the Suspense boundary, it serializes with the page content load.

**How to avoid:**
Fetch the unread count in a separate leaf Server Component (`<UnreadBadge>`) wrapped in its own `<Suspense fallback={<BellIcon />}>`. This defers the count without blocking the nav frame. Tag the fetch with `cacheTag('notifications:${userId}')` and call `revalidateTag('notifications:${userId}')` in the "mark as read" Server Action. The bell renders immediately; the count resolves asynchronously. Do NOT use `'use cache'` on the unread count fetch directly without passing `viewerId` as an argument (see Pitfall B-6).

**Warning signs:**
- Root layout Server Component directly `await`s a notifications DAL function.
- Page TTFB increases by the DB query time for the notification count.

**Phase to address:** Notifications phase — design the badge as an isolated Suspense leaf before wiring it into the layout.

---

### Pitfall B-2: Notification Generation Inside Server Action Transaction — Failure Rolls Back Original Action

**Severity:** HIGH

**What goes wrong:**
The follow Server Action creates a `follows` row and then generates a "New Follower" notification for the target. If notification generation is inside the same DB transaction (or even just sequenced synchronously with no error isolation), a notification insert failure rolls back the follow. The user clicks Follow, sees it work, but the follow didn't persist because the notification table had an unexpected constraint violation.

This mirrors the v2.0 pattern for activity logging, where `logActivity()` is fire-and-forget with no throw propagation.

**Why it happens:**
The natural implementation is `await db.insert(follows...) + await db.insert(notifications...)` in sequence. If notification insert throws, it propagates up and undoes the follow.

**How to avoid:**
Generate notifications as a fire-and-forget side effect, matching the established `logActivity()` pattern from v2.0. Wrap notification generation in a try/catch that logs but does not rethrow:
```typescript
// After the primary action succeeds:
generateNotification(...).catch(err => console.error('notification gen failed', err));
```
The primary action (follow, watch-overlap detection) must never fail because the notification system failed. Notifications are best-effort observability, not transactional requirements.

**Warning signs:**
- Follow action fails intermittently and the error message references the `notifications` table.
- Server Action wraps both the primary insert and notification generation in a single `try` block without isolating notification errors.

**Phase to address:** Notifications phase — establish the fire-and-forget pattern in the first notification generation function; enforce it via code review gate.

---

### Pitfall B-3: Watch-Overlap Notifications Created on Every Add — Duplicate Spam

**Severity:** HIGH

**What goes wrong:**
When User A adds a watch that User B (a follower) already owns, a "Watch Overlap" notification is generated for User B. If User A edits the watch, re-saves it, or the overlap-detection logic runs on every write, User B receives the same notification repeatedly. A user with 50 followers who all own Rolex Submariner-adjacent watches could generate hundreds of overlap notifications from a single add.

**Why it happens:**
Overlap detection is run on every `addWatch` or `updateWatch` call without checking whether a notification for this (actor, watch brand/model, recipient) combination was already sent.

**How to avoid:**
Apply a deduplication check before inserting any notification. For watch-overlap notifications, check for an existing notification row with the same `(type='watch_overlap', actor_id, recipient_id, watch_id)` within a configurable window (e.g., 24 hours). Use a UNIQUE constraint or an `ON CONFLICT DO NOTHING` insert:
```sql
INSERT INTO notifications (type, actor_id, recipient_id, watch_id, ...)
VALUES (...)
ON CONFLICT (type, actor_id, recipient_id, watch_id) DO NOTHING;
```
Add a partial unique index that enforces deduplication at the DB layer, not just in application code.

**Warning signs:**
- A user receives 10+ overlap notifications in a session after adding or editing a single watch.
- Notification table grows by N rows per watch add, where N = follower count.

**Phase to address:** Notifications phase — add the unique constraint and `ON CONFLICT DO NOTHING` pattern in the schema migration, not as a post-launch fix.

---

### Pitfall B-4: Notifications RLS Permits Cross-User Read via Anon Key

**Severity:** CRITICAL

**What goes wrong:**
Without a properly scoped RLS SELECT policy, a user can query the `notifications` table and read other users' notifications. Notifications contain actor IDs, watch IDs, and interaction metadata — leaking social graph and behavioral data. This is worse than the v2.0 activities table leak because notifications contain directed personal signals ("User X followed you", "User Y owns your watch").

**Why it happens:**
RLS tables default to deny-all, but developers sometimes add a permissive SELECT policy to debug and forget to remove it. Or they copy the activities policy pattern (`activities_select_own_or_followed`) without recognizing that notifications should only be readable by the recipient — never by the actor or by followers.

**How to avoid:**
Notifications SELECT policy must be:
```sql
CREATE POLICY "notifications_select_recipient_only" ON notifications
  FOR SELECT USING (recipient_id = (SELECT auth.uid()));
```
No other SELECT policy should exist on this table. Add two-layer enforcement: DAL `getNotificationsForUser(userId)` must also include `WHERE recipient_id = userId` as a WHERE clause (not just relying on RLS). Integration test: query notifications as User B for a row generated for User A; confirm 0 rows returned.

**Warning signs:**
- Notification SELECT policy has `OR actor_id = (SELECT auth.uid())` — actors should NOT read notifications they generated.
- Direct Supabase client query returns another user's notification rows.

**Phase to address:** Notifications phase — write the RLS policy and integration test before any notification reads are wired into the UI.

---

### Pitfall B-5: "Mark All Read" Race Condition — New Notification Arrives Between Read and Write

**Severity:** LOW

**What goes wrong:**
User opens the notifications page (10 unread). A new notification arrives (11 unread) before they click "Mark All Read". The mark-all action uses a `WHERE read_at IS NULL` condition and sets `read_at = now()`. This correctly marks all 11, including the just-arrived one. However, if the UI was rendered with 10 items and the "mark all read" action is scoped by a snapshot of IDs from the render (not a `WHERE read_at IS NULL` query), the 11th notification is missed.

**Why it happens:**
Client-side implementations capture the list of notification IDs at render time and send them to the Server Action. The Server Action marks those specific IDs as read, missing any that arrived after render.

**How to avoid:**
The "Mark All Read" Server Action must operate on the DB directly with `WHERE recipient_id = userId AND read_at IS NULL` — never on a client-supplied list of IDs. The Server Action:
```typescript
await db.update(notifications)
  .set({ read_at: new Date() })
  .where(and(
    eq(notifications.recipientId, userId),
    isNull(notifications.readAt)
  ));
```
After the update, call `revalidateTag('notifications:${userId}')` to refresh the bell count.

**Warning signs:**
- "Mark all read" Server Action accepts an `ids: string[]` parameter from the client.
- After marking read, unread count is non-zero because a race delivered a new notification.

**Phase to address:** Notifications phase — design the Server Action to be server-authoritative on the scope.

---

### Pitfall B-6: `'use cache'` on Notification Query Without `viewerId` as Argument — Cross-User Cache Leak

**Severity:** CRITICAL

**What goes wrong:**
A cached function that fetches notifications uses `viewerId` from a closure call to `getCurrentUser()` rather than as a function argument. Next.js 16 `'use cache'` caches the function output keyed on its arguments. If `viewerId` is obtained inside the function body (from cookies, not the argument list), all calls to the function share the same cache key and User A sees User B's notifications.

This is the same pitfall formalized in the v2.0 retrospective under "Cache-key safety for `'use cache'`."

**Why it happens:**
The pattern `const user = await getCurrentUser()` inside a cached function looks correct. The bug is that `getCurrentUser()` returns different values for different users, but the cache key is derived only from the function's argument list — which is empty, so every user gets the same (first-cached) result.

**How to avoid:**
Any `'use cache'` function that returns viewer-scoped data must accept `viewerId` as an explicit argument:
```typescript
'use cache';
export async function getNotificationsForUser(viewerId: string) {
  cacheTag(`notifications:${viewerId}`);
  return db.select()...where(eq(notifications.recipientId, viewerId));
}
```
Never call `getCurrentUser()` or `cookies()` inside a `'use cache'` function body. Grep gate before shipping: `grep -r "use cache" src/ | xargs grep -l "getCurrentUser\|cookies()"` must return empty.

**Warning signs:**
- Notification count shows another user's count after a session switch.
- Cached function has `'use cache'` and calls `getCurrentUser()` in the function body.

**Phase to address:** Notifications phase AND any phase that adds `'use cache'` to viewer-scoped queries — enforce via code review.

---

### Pitfall B-7: Notifications Survive User Deletion — Orphan Rows

**Severity:** MEDIUM

**What goes wrong:**
If a user account is deleted (or the `profiles` row is removed), their notifications remain in the `notifications` table. Orphan rows reference deleted actor or recipient IDs. DAL queries that JOIN on `profiles` to resolve actor usernames will silently drop the notification from results (LEFT JOIN returns null) or hard-fail (INNER JOIN). The notification bell count may become non-zero but the page shows nothing.

**Why it happens:**
The schema is designed with application-level deletes, not cascading FK constraints. Supabase / Postgres default is no cascade on FK if the constraint is added as `ON DELETE NO ACTION`.

**How to avoid:**
Define the `notifications` table FK constraints with `ON DELETE CASCADE` for both `actor_id` and `recipient_id` references to `auth.users` (or `profiles`):
```sql
actor_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
recipient_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE
```
This means deleting a profile cleans up all their sent and received notifications automatically. Verify in the Drizzle schema definition.

**Warning signs:**
- Notification count is positive but the notifications page is empty.
- DB query on `notifications` JOIN `profiles` returns null for `actor_username`.

**Phase to address:** Notifications phase — add `ON DELETE CASCADE` in the initial schema migration.

---

### Pitfall B-8: Stubbed Price Drop / Trending Templates Render with Empty Data

**Severity:** MEDIUM

**What goes wrong:**
The v3.0 plan stubs "Price Drop" and "Trending" notification types in the UI for future data wiring. If the UI template renders before the data contract is defined, it displays a notification card with missing title, empty body, and a broken icon. Users see malformed cards in the notification list. The visual bug erodes trust in the notification system before the real types ship.

**Why it happens:**
Template components are built speculatively — the developer creates the `NotificationCard` component with a switch on `notification.type` and adds `case 'price_drop':` with placeholder copy. When a price_drop row somehow makes it into the DB (e.g., from a migration seed or a bug), it renders with all empty fields.

**How to avoid:**
Add an explicit guard: if `notification.type` is not in the set of currently live types (`['follow', 'watch_overlap']`), render nothing (return null) rather than a placeholder card. Stubbed types should not have a rendered code path until the data that powers them exists. Log unknown types to the console in dev mode to surface accidental data.

**Warning signs:**
- Notification card renders with undefined title or empty body text.
- `console.warn('unknown notification type')` never fires even though the card looks wrong.

**Phase to address:** Notifications phase — add the `return null` guard on unknown types in the `NotificationCard` component before any notification is visible to users.

---

### Pitfall B-9: Notification Generated for Self-Action

**Severity:** MEDIUM

**What goes wrong:**
A user who follows themselves (if not guarded at the RLS or Server Action layer), or who adds a watch that matches their own existing collection, generates a notification addressed to themselves. The result: "You followed yourself" in the notifications list. More subtly, watch-overlap detection between a user and their own followers could trigger a self-notification if the actor_id check is wrong.

**Why it happens:**
Notification generation code checks `recipient_id != actor_id` inconsistently or not at all. The follow Server Action may block self-follows at the UI layer but not enforce it at the DB layer.

**How to avoid:**
In every notification generation call, assert `recipientId !== actorId` before inserting. Add a CHECK constraint to the notifications table:
```sql
CONSTRAINT no_self_notification CHECK (actor_id != recipient_id)
```
For follows, also add a CHECK constraint on the `follows` table: `follower_id != following_id`.

**Warning signs:**
- Notification row exists with `actor_id = recipient_id`.
- "You followed yourself" text appears in the notification list.

**Phase to address:** Notifications phase — add DB constraints in the schema migration; enforce in generation functions.

---

## C. People-Search

---

### Pitfall C-1: `pg_trgm` Extension Not Enabled — ILIKE is a Full Table Scan

**Severity:** HIGH

**What goes wrong:**
`ILIKE '%query%'` on `username` and `bio` performs a full table scan. Without the `pg_trgm` extension and a GIN trigram index, the search query degrades linearly with table size. Even at 1,000 users it is noticeably slow; at 10,000 users it is unusable.

More importantly, `pg_trgm` is not enabled by default in new Supabase projects. Enabling it requires a migration (`CREATE EXTENSION IF NOT EXISTS pg_trgm`). Forgetting to run this migration in production means the GIN index is created but falls back to a seq scan (because the trigram operator class is missing), and no error is thrown.

**Why it happens:**
Local dev typically has `pg_trgm` enabled from a previous project or database setup. The issue is invisible locally and only surfaces in the production Supabase project where the extension was never enabled.

**How to avoid:**
Add the extension and index creation to the Drizzle migration file (not just raw SQL run once):
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm ON profiles USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_bio_trgm ON profiles USING gin (bio gin_trgm_ops);
```
After the prod migration, run `SELECT * FROM pg_extension WHERE extname = 'pg_trgm'` to verify. Add to the deploy runbook.

**Warning signs:**
- `EXPLAIN ANALYZE` on the search query shows `Seq Scan` on `profiles` rather than `Bitmap Index Scan`.
- Search response time scales with number of profiles (5ms at 100 users, 500ms at 10,000).
- Extension missing: `ERROR: operator class "gin_trgm_ops" does not exist for access method "gin"`.

**Phase to address:** People-search phase — create the migration with extension + index before writing the search DAL query.

---

### Pitfall C-2: Empty or Single-Character Search Query Returns All Profiles

**Severity:** HIGH

**What goes wrong:**
`ILIKE '%a%'` matches almost every row in `profiles`. An empty query (`ILIKE '%%'`) matches all rows. Both cases return the entire user table to the client. This is a performance bomb (full table dump on every keystroke), a privacy issue (users who set their profile private still appear in a correctly-RLS'd query, but the response is large), and violates the intended UX.

**Why it happens:**
Debounce is added client-side but the minimum query length check is not enforced server-side. The client skips requests for empty queries, but a malicious or fast client can bypass the debounce.

**How to avoid:**
Enforce minimum query length in the DAL and in the Server Action — not just client-side. Return an empty array immediately if `query.trim().length < 2`. Document this as a contract:
```typescript
if (query.trim().length < 2) return [];
```
Also, implement a server-side rate limit or Supabase edge function rate limiter for the search endpoint if it becomes a vector for enumeration.

**Warning signs:**
- Search API called with a 1-character query returns 50+ profiles.
- Empty query returns all users (check with direct `fetch` bypassing debounce).

**Phase to address:** People-search phase — add the length guard in the DAL, not just in the client component.

---

### Pitfall C-3: Search Returns Private Profile Rows — RLS Must Gate Search Too

**Severity:** CRITICAL

**What goes wrong:**
A user who set their profile to private (`profile_public = false`) should not appear in people-search results for non-followers. Without an RLS policy or DAL WHERE clause that excludes private profiles from the search result set, their username and bio are searchable by anyone. The search surface is a new read path that must be independently gated — the existing profile page RLS does not automatically apply to the search query.

**Why it happens:**
The search DAL is written as a new function (`searchProfiles`) that queries `profiles` directly without inheriting the privacy rules from the profile-view DAL. Developers assume "RLS handles it" — but the RLS policy on `profiles` may allow any authenticated user to read any row (since profiles table visibility was designed for profile-page reads, not search).

**How to avoid:**
The search DAL must include a WHERE clause:
```typescript
WHERE (profile_public = true OR user_id = viewerId)
```
Two-layer enforcement: the RLS policy must also be scoped to exclude private profiles from search reads for non-owners. Validate with an integration test: create a private profile, search for their username as another user, confirm 0 results.

**Warning signs:**
- Search for a known private user's username returns their profile.
- `searchProfiles` DAL function has no `profile_public` filter.

**Phase to address:** People-search phase — add the filter in the initial DAL implementation; include in the privacy integration test suite.

---

### Pitfall C-4: "Following" Status Per Row Requires N+1 Unless Batched

**Severity:** HIGH

**What goes wrong:**
The search results page shows a row for each matching profile with a Follow/Following button. Rendering the correct button state (following or not) requires knowing if the viewer follows each result. The naive implementation queries `SELECT * FROM follows WHERE follower_id = viewer AND following_id = result` per result row — one query per result.

**Why it happens:**
The Follow button is a separate component that fetches its own state. Each renders independently.

**How to avoid:**
Batch the following-status lookup: fetch all `following_id` values for the current viewer in a single query at the search DAL level, then pass the set to the result components as a prop:
```typescript
const viewerFollows = new Set(
  (await db.select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewerId)))
    .map(r => r.id)
);
// Pass viewerFollows to search results
```
This is the same no-N+1 pattern used in the v2.0 Network Home for the Suggested Collectors section.

**Warning signs:**
- Supabase logs show one `SELECT FROM follows` query per search result row.
- Search results page with 10 results produces 11+ DB queries.

**Phase to address:** People-search phase — design the batched follow-status query in the initial DAL implementation.

---

### Pitfall C-5: Bio Search Exposes Sensitive Substring Matches

**Severity:** MEDIUM

**What goes wrong:**
`ILIKE '%query%'` matches substrings anywhere in `bio`. A user might write a bio like "not interested in Patek, mainly AP and Rolex" — searching for "Patek" returns this user, potentially revealing their stated disinterest. More practically, a bio might contain an email address, phone number, or other PII that the user included without realizing it would be full-text searchable by strangers.

**Why it happens:**
Bios are freeform text fields. Users don't expect substring searching.

**How to avoid:**
For v3.0 MVP, limit search to username only by default, with bio as a secondary match that requires longer query strings (minimum 4 characters for bio matches). Truncate the bio snippet in search results rather than highlighting the match. Add a note in the profile settings page that bio content is searchable. This is a UX/privacy tradeoff to document consciously rather than a hard technical fix.

**Warning signs:**
- Bio search returns rows where the matched text is PII or sensitive preference data.
- Users report appearing in searches for terms they buried in their bio.

**Phase to address:** People-search phase — document the bio-search decision in the plan; apply minimum-length guard for bio matching.

---

## D. WYWT Photo Capture (`getUserMedia`)

---

### Pitfall D-1: iOS Safari Loses User Gesture Context in Async `getUserMedia` Chain

**Severity:** CRITICAL

**What goes wrong:**
iOS Safari requires `getUserMedia()` to be called in direct response to a user gesture (tap). If the call is inside an async chain where a `await` occurs before `getUserMedia()` is invoked, iOS considers the gesture context "consumed" and blocks the camera. The error: `NotAllowedError: The request is not allowed by the user agent or the platform in the current context`. No permission dialog appears; the camera just fails silently.

**Why it happens:**
The natural implementation: user taps "Take Wrist Shot" → component checks state → `await someSetup()` → `await navigator.mediaDevices.getUserMedia(...)`. The intermediate await breaks the gesture chain on iOS.

**How to avoid:**
Call `navigator.mediaDevices.getUserMedia(constraints)` as the FIRST async operation in the tap handler — no awaits before it. If setup is needed (e.g., resolving constraints), do it synchronously or store the MediaStream reference and do async work after:
```typescript
async function handleTakePhoto() {
  // getUserMedia must be first — no awaits before this on iOS
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  // Now safe to do async work
  setStream(stream);
}
```
Test on a real iOS device or Safari Technology Preview, not just Chrome DevTools mobile emulation.

**Warning signs:**
- Camera works in Chrome but fails in iOS Safari with `NotAllowedError`.
- Permission dialog never appears on iOS even on first use.
- There is an `await` before the `getUserMedia` call in the event handler.

**Phase to address:** WYWT photo phase — design the gesture handler before writing any setup logic.

---

### Pitfall D-2: MediaStream Not Stopped on Component Unmount — Camera Stays "On"

**Severity:** HIGH

**What goes wrong:**
When the user dismisses the camera dialog or navigates away, the `<video>` element is removed from the DOM but the underlying `MediaStream` tracks are not stopped. The browser keeps the camera hardware active (green LED indicator remains on). On iOS, background camera access can trigger OS-level warnings or drain battery.

**Why it happens:**
The `MediaStream` is stored in state. When the component unmounts, React cleans up state but does not automatically call `.stop()` on the stream tracks.

**How to avoid:**
Return a cleanup function from the `useEffect` that manages the stream:
```typescript
useEffect(() => {
  if (!stream) return;
  return () => {
    stream.getTracks().forEach(track => track.stop());
  };
}, [stream]);
```
Also call `stream.getTracks().forEach(t => t.stop())` explicitly when the user closes the dialog — don't rely solely on the unmount cleanup (the dialog may remain mounted in a hidden state).

**Warning signs:**
- Camera indicator remains on after closing the WYWT dialog.
- Multiple calls to `getUserMedia` succeed without re-requesting permissions (stale stream).

**Phase to address:** WYWT photo phase — add the cleanup useEffect in the initial implementation.

---

### Pitfall D-3: Camera Permission Denied — No Fallback UX

**Severity:** MEDIUM

**What goes wrong:**
When the user denies camera permission (or has permanently denied it in iOS Settings), `getUserMedia` rejects with `NotAllowedError`. Without explicit error handling, the user sees a blank video area with no explanation. On iOS, the browser cannot prompt for permission again after denial — the user must go to Settings > Safari > Camera. This is non-obvious.

**Why it happens:**
Happy-path implementation: only the `await getUserMedia` success path is handled.

**How to avoid:**
Catch `NotAllowedError` specifically and show a clear error state:
```typescript
catch (err) {
  if (err.name === 'NotAllowedError') {
    setError('Camera access denied. To take a wrist shot, allow camera access in your browser settings, then try again.');
  }
}
```
Also handle `NotFoundError` (no camera hardware) and `NotSupportedError` (HTTP context — should not occur on Vercel, but possible in local network testing). The upload option must remain available as a fallback regardless of camera error state.

**Warning signs:**
- Video element is blank with no error message after permission denial.
- No try/catch around `getUserMedia` call.

**Phase to address:** WYWT photo phase — implement error states alongside the happy path.

---

### Pitfall D-4: Canvas-Captured Image is Too Large for Mobile Upload

**Severity:** HIGH

**What goes wrong:**
Drawing the video frame to a canvas with `canvas.toDataURL('image/jpeg')` at the native camera resolution produces an image that may be 3–8MB. On mobile data, uploading 5MB blocks the form for 10–30 seconds. The upload progress bar (if any) appears frozen.

**Why it happens:**
Developers capture at the highest available resolution because quality seems better. The camera stream resolution is whatever the device reports as default — often 1920x1080 or higher on modern phones.

**How to avoid:**
Explicitly constrain the camera resolution at capture time and/or resize on canvas before upload:
```typescript
// Constrain at getUserMedia
{ video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1080 } } }
// Or resize on canvas:
const MAX_DIMENSION = 1200;
// scale canvas dimensions to MAX_DIMENSION before drawing
```
Target output: under 500KB JPEG at quality 0.85. This is sufficient for wrist-shot display sizes (max 600px in the feed). Add client-side size validation before upload: if the compressed result is still >2MB, reject it with a clear message.

**Warning signs:**
- Upload takes >5 seconds on a good connection.
- Network tab shows image payload >2MB.
- Canvas `toDataURL` called without explicit width/height constraints.

**Phase to address:** WYWT photo phase — set canvas dimensions and JPEG quality in the initial capture implementation.

---

### Pitfall D-5: Static Overlay Not Scaling With Video Element

**Severity:** MEDIUM

**What goes wrong:**
The dotted guide overlay (wrist shot framing guide) is positioned via absolute CSS over the `<video>` element. If the video element's display size differs from the CSS layout size (which it will on different viewport widths and orientations), the overlay is misaligned. The circle that should be "center your watch here" appears in the wrong position on a 375px-wide iPhone vs. a 414px-wide one.

**Why it happens:**
The overlay dimensions are hard-coded in pixels rather than relative to the video element's rendered size.

**How to avoid:**
Use relative positioning: the overlay container should be `position: relative` with `width: 100%; aspect-ratio: 1/1` matching the video aspect ratio. The guide overlay uses `position: absolute; inset: 0` with percentage-based `width`/`height`. Verify on at least three viewport widths (320px, 390px, 428px) during UAT.

**Warning signs:**
- Guide overlay is not centered on a non-standard viewport width.
- Overlay dimensions are specified in `px` rather than `%` or `vw`.

**Phase to address:** WYWT photo phase — design the overlay in CSS with relative units from the start.

---

## E. HEIC Handling + Image Upload

---

### Pitfall E-1: `heic2any` Loaded Eagerly — 1MB Bundle on Every Page

**Severity:** HIGH

**What goes wrong:**
`heic2any` is approximately 1MB when bundled. If imported at the top of the WYWT photo component file, it is included in the initial page bundle and downloaded on every page load — even when the user never uploads a HEIC file (i.e., most Android users, all desktop users).

**Why it happens:**
Static top-level imports are the default pattern. `import heic2any from 'heic2any'` at the top of the file.

**How to avoid:**
Dynamic import triggered only when a HEIC file is detected:
```typescript
const file = e.target.files[0];
if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
}
```
This defers the 1MB bundle to the rare case where a HEIC file is selected. Bundle analyzer should confirm `heic2any` is not in the main chunk.

**Warning signs:**
- Bundle analyzer shows `heic2any` in the main or layout chunk.
- `import heic2any from 'heic2any'` at the top of any file outside a dynamic import.

**Phase to address:** WYWT photo phase — implement as a dynamic import from day one.

---

### Pitfall E-2: EXIF Orientation Tag Not Honored — Sideways Images

**Severity:** HIGH

**What goes wrong:**
iPhones capture photos in the sensor's native orientation and write the correct rotation into the EXIF `Orientation` tag. A photo taken in portrait mode may have `Orientation: 6` (rotate 90°CW). When drawn to a canvas via `drawImage()` without reading the EXIF orientation, the resulting JPEG is rotated 90° (or 180° or 270°). The image uploads correctly but displays sideways in the feed and on the wear detail page.

**Why it happens:**
`canvas.drawImage(imageElement, ...)` ignores EXIF data. The browser may or may not auto-rotate the image for display (modern Chrome does; older Safari and most canvas operations do not). HEIC-to-JPEG conversion via `heic2any` strips the EXIF orientation tag, so the resulting JPEG has no rotation instruction — but the pixel data is still unrotated.

**How to avoid:**
Before drawing to canvas, read the EXIF `Orientation` tag using a small EXIF reader (e.g., `exifr` — 30KB, tree-shakeable) and apply the corresponding canvas rotation:
```typescript
import { parse as parseExif } from 'exifr';
const { Orientation } = await parseExif(file, { pick: ['Orientation'] });
// Apply rotation to canvas context before drawImage
```
Test with photos taken in all four orientations on a real iPhone.

**Warning signs:**
- Uploaded wrist shots appear sideways or upside-down in the feed.
- Canvas draw code has no rotation transform before `drawImage`.

**Phase to address:** WYWT photo phase — implement EXIF orientation handling alongside the canvas capture code.

---

### Pitfall E-3: Client-Side Validation Only — Server Accepts Any File

**Severity:** CRITICAL

**What goes wrong:**
The upload component validates file size and MIME type on the client. A user (or attacker) bypasses the client and sends a direct `multipart/form-data` POST to the Supabase Storage upload endpoint with a 100MB video file, an SVG with embedded script, or a file with a spoofed MIME type. Supabase Storage does not validate file content by default — it stores whatever is uploaded.

**Why it happens:**
Client validation is easy to implement and provides good UX. Server-side validation requires a Server Action or edge function in the upload path, which adds complexity.

**How to avoid:**
Add a Server Action or route handler that:
1. Validates file size (reject >5MB after compression).
2. Validates MIME type by reading the first 12 bytes (magic bytes) — `image/jpeg` starts with `FFD8FF`, `image/png` with `89504E47`. Do not trust the `Content-Type` header or file extension.
3. Sets Supabase Storage upload metadata with an explicit `contentType`.

Additionally, configure a file size limit in the Supabase Storage bucket policy (50MB default is too permissive; set to 5MB).

**Warning signs:**
- Upload path calls Supabase Storage directly from the client without a server intermediary.
- No server-side file size check exists.
- MIME type validation uses only `file.type` (client-reported, spoofable).

**Phase to address:** WYWT photo phase — add server-side validation in the Server Action that handles the upload.

---

### Pitfall E-4: `heic2any` Does Not Strip EXIF — PII in Uploaded Images

**Severity:** CRITICAL

**What goes wrong:**
HEIC files (and the JPEGs produced by `heic2any` conversion) may contain EXIF metadata including GPS coordinates (precise location where the photo was taken), device model, and timestamp. For a "what are you wearing today" feature, leaking GPS coordinates from a morning photo taken at home is a significant privacy issue.

**Why it happens:**
`heic2any` converts pixel data but passes EXIF through to the output JPEG. Canvas re-encoding (`canvas.toDataURL('image/jpeg')`) strips EXIF — but only if the canvas draw path is used. The upload-from-file path (where the user uploads an existing photo without going through canvas) may skip the canvas step and upload the raw HEIC-converted JPEG with full EXIF intact.

**How to avoid:**
ALL upload paths must go through the canvas re-encode step, even for uploaded files. Do not use `heic2any` output directly as the upload blob. Always:
1. Convert HEIC → JPEG (if needed).
2. Load the JPEG into an `<img>` element.
3. Draw to canvas (this strips EXIF).
4. Export from canvas as the final upload blob.

Verify by uploading an iPhone photo and checking the stored file with `exiftool` — confirm no GPS data.

**Warning signs:**
- The upload flow has a code path where `heic2any` output is uploaded directly without canvas re-encode.
- `exiftool output.jpg` shows `GPSLatitude` or `GPSLongitude` tags.

**Phase to address:** WYWT photo phase — enforce canvas-always in the upload utility function; add an integration test that checks EXIF is absent from stored images.

---

## F. Supabase Storage + RLS

---

### Pitfall F-1: Storage RLS Policies Are Separate From Table RLS — Different Mental Model

**Severity:** CRITICAL

**What goes wrong:**
Supabase Storage uses `storage.objects` — a separate Postgres table in the `storage` schema with its own RLS policies. The RLS policies on the `wear_events` table do NOT automatically protect the associated image files. A user who cannot read `wear_events.image_url` can still access the image file directly if the storage bucket has no RLS or is public.

**Why it happens:**
Developers apply RLS to application tables and assume "storage is protected." The two systems are completely independent.

**How to avoid:**
Write storage bucket policies explicitly for each bucket used. For the wear photos bucket (private wears):
```sql
-- Users can only read their own files or public wear files
CREATE POLICY "wear_photos_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'wear-photos'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid()::text)  -- own files
      OR EXISTS (
        SELECT 1 FROM wear_events we
        JOIN profiles p ON p.user_id = we.user_id
        WHERE we.image_path = name
          AND (we.visibility = 'public' OR (we.visibility = 'followers' AND EXISTS (
            SELECT 1 FROM follows f WHERE f.follower_id = (SELECT auth.uid()) AND f.following_id = we.user_id
          )))
          AND p.profile_public = true
      )
    )
  );
```
This is complex but necessary. Verify by attempting to access another user's private wear photo URL directly — confirm 403.

**Warning signs:**
- Storage bucket is set to "Public" in the Supabase dashboard.
- No policies exist in `storage.objects` for the wear-photos bucket.
- A private wear image URL is directly accessible in an incognito window.

**Phase to address:** WYWT photo phase — write storage policies in the same migration as the wear_events schema changes.

---

### Pitfall F-2: Signed URLs Cached by Next.js Image Optimizer or CDN

**Severity:** HIGH

**What goes wrong:**
Supabase signed URLs for private storage objects expire after a configured duration (e.g., 1 hour). If the signed URL is passed to `<Image>` from `next/image`, Next.js attempts to cache the optimized image indefinitely. On the second request, the Next.js image cache serves the optimized image at a stale signed URL path. When the signed URL expires, the image optimizer may re-request using the expired URL, returning a 400 error.

Additionally, if a Vercel edge cache or CDN caches the image response at the signed URL, the URL may remain in cache after the wear event visibility changes to Private.

**Why it happens:**
Signed URLs look like regular image URLs. Next.js image optimization and CDN caching treat them the same.

**How to avoid:**
For private wear images (visibility = 'followers' or 'private'), do not use `<Image>` from `next/image`. Use a plain `<img>` tag and generate fresh signed URLs on each server render. Set signed URL expiry to a reasonable session duration (e.g., 2 hours). For public wear images, public bucket URLs are fine with `<Image>`.

```typescript
// Server component: generate a fresh signed URL per render for private images
const { data } = await supabase.storage
  .from('wear-photos')
  .createSignedUrl(imagePath, 7200); // 2 hours
```

Add the Supabase storage hostname to `next.config.ts` `remotePatterns` for `<Image>` on public images.

**Warning signs:**
- Private wear images use `<Image src={signedUrl}>`.
- Images break for users after ~1 hour.
- `next.config.ts` does not include the Supabase storage hostname in `remotePatterns`.

**Phase to address:** WYWT photo phase — make the public/private image rendering decision explicit in the component design.

---

### Pitfall F-3: Deleting a `wear_events` Row Does Not Delete the Storage Object — Orphan Files

**Severity:** MEDIUM

**What goes wrong:**
When a user deletes a wear event, the `wear_events` row is removed from the DB. But the associated image file in Supabase Storage is not deleted — it persists indefinitely, consuming storage quota and potentially being accessible via direct URL if the bucket policy allows it.

**Why it happens:**
Postgres `ON DELETE CASCADE` applies to DB tables, not storage objects. Storage cleanup must be triggered explicitly in application code.

**How to avoid:**
In the "delete wear event" Server Action, after deleting the DB row, also delete the storage object:
```typescript
// In the delete wear event Server Action:
if (wearEvent.imagePath) {
  await supabase.storage.from('wear-photos').remove([wearEvent.imagePath]);
}
await db.delete(wearEvents).where(eq(wearEvents.id, wearEventId));
```
Note: delete the storage object AFTER verifying the DB delete succeeded, to avoid orphaning the file if the action fails partway. Consider a periodic cleanup job (Supabase Edge Function cron) as a safety net.

**Warning signs:**
- Storage bucket grows over time even as users delete wears.
- No `supabase.storage.remove()` call exists in the delete wear Server Action.

**Phase to address:** WYWT photo phase — add storage cleanup to the delete action alongside the DB delete.

---

### Pitfall F-4: Per-User Folder Convention Not Enforced by Storage RLS

**Severity:** CRITICAL

**What goes wrong:**
The convention `{user_id}/{filename}` in the storage path is intended to scope files per user. But this is just a convention — nothing prevents a user from uploading to `{other_user_id}/{filename}` unless the storage RLS INSERT policy explicitly checks that the first path component matches the authenticated user's ID.

**Why it happens:**
Developers implement the folder convention in the client upload code but do not add the RLS enforcement. The convention is honored in the happy path but bypassable via a direct API call.

**How to avoid:**
Storage INSERT policy must validate the folder path:
```sql
CREATE POLICY "wear_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'wear-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );
```
Test by attempting to upload a file to another user's folder path via a direct Supabase client call.

**Warning signs:**
- Storage INSERT policy exists but does not check `foldername(name)[1] = auth.uid()`.
- A user can upload to `{other_user_id}/photo.jpg` without a policy violation.

**Phase to address:** WYWT photo phase — add the path enforcement in the storage INSERT policy migration.

---

## G. Three-Tier Visibility Ripple

---

### Pitfall G-1: Not Auditing Every Wear-Reading DAL Function Before Adding "Followers" Tier

**Severity:** CRITICAL

**What goes wrong:**
The existing wear DAL functions implement two-tier visibility (`worn_public = true/false`). Adding a third tier ("Followers") requires every function that reads wear events to check `visibility IN ('public') OR (visibility = 'followers' AND viewer follows actor) OR actor = viewer`. If even one DAL function is missed, followers-only wears are visible to the public or to non-followers.

This is the exact class of bug that the v2.0 retrospective identified: "the outer `profile_public` check was missing from the non-self branch. RLS alone would have leaked." The same failure mode applies here at larger scale.

**Why it happens:**
There are multiple DAL functions that read wear events: WYWT rail, profile worn tab, home feed, watch detail context, notifications. Each is written independently and must each be updated.

**How to avoid:**
Before writing a single line of visibility code, enumerate EVERY function in the DAL that reads `wear_events`. Create a checklist:
- `getWearRailForViewer` ✓
- `getWornTabForViewer` ✓
- `getWearEventsForHome` ✓
- `getWatchContextWears` ✓
- (any new functions for v3.0 WYWT post)

Each function must be updated to the three-tier check before the visibility enum migration is deployed. Add a grep gate: `grep -r "wear_events" src/data/ | grep -v "three_tier_visibility_check_confirmed"` (add a comment marker to each audited function).

**Warning signs:**
- A DAL function queries `wear_events` with only `WHERE worn_public = true` (old two-tier check).
- Integration test for "follower-only wear visible to non-follower" passes (i.e., the test does NOT exist yet).

**Phase to address:** WYWT photo/visibility phase — audit first, migration second, implementation third.

---

### Pitfall G-2: Default Visibility Set Wrong — Mass Privacy Exposure or Confusing Behavior

**Severity:** CRITICAL

**What goes wrong:**
If the new wear form defaults to "Public" when the user's mental model is "Followers," every wear logged before the user changes the default setting is public. For a user who thinks "only my followers can see this," having their wears public is a trust violation.

Conversely, if default is "Private," the WYWT rail (the social proof feature) never populates for new users — the product's core retention loop fails.

**Why it happens:**
The default is a product decision that gets made implicitly by whoever writes the form component, without a conscious design discussion.

**How to avoid:**
Make the default a first-class product decision documented in the plan. Recommendation: default to the user's last-used visibility (stored in their `profile_settings` on the server, not localStorage — avoid SSR/hydration mismatch). On first use, default to "Followers" as the most balanced choice. Show the visibility picker explicitly in the form — never hide it.

Do NOT store the default in localStorage — this causes SSR/client hydration mismatch (server renders "Private", client renders "Public", React hydration warning + potential flash of wrong state).

**Warning signs:**
- Wear form default visibility is hardcoded as "public" or "private" without user preference.
- Default stored in `localStorage` without SSR handling.
- No visibility picker shown in the WYWT form (user can't see or change the default).

**Phase to address:** WYWT photo/visibility phase — document the default decision in the plan; store preference server-side.

---

### Pitfall G-3: "Followers" Gate Checks in the Wrong Direction

**Severity:** CRITICAL

**What goes wrong:**
The "Followers" tier should show a wear to users who follow the actor (i.e., `viewer follows actor`). An inverted check — `actor follows viewer` — shows the wear to users the actor follows, which is a completely different set and a privacy hole. This inversion is easy to write wrong:
```typescript
// WRONG: checks if actor follows viewer
follows.followerId === actorId && follows.followingId === viewerId
// CORRECT: checks if viewer follows actor
follows.followerId === viewerId && follows.followingId === actorId
```

**Why it happens:**
"Follower" and "following" are directional terms that developers often confuse. The v2.0 retrospective established the `viewer-aware DAL pattern` but new developers writing new visibility checks may not read the established precedent.

**How to avoid:**
In the DAL, use explicit variable names:
```typescript
const viewerFollowsActor = await db.select()...
  .where(and(eq(follows.followerId, viewerId), eq(follows.followingId, actorId)));
```
Name the variable `viewerFollowsActor` — not `isFollowing` or `followsRelationship`. Add a unit test specifically for the directional check: viewer follows actor → wear visible; actor follows viewer but viewer does not follow actor → wear not visible.

**Warning signs:**
- Follow direction check uses ambiguous variable names like `isFollowing`.
- No unit test distinguishing `A follows B` from `B follows A` for the visibility gate.

**Phase to address:** WYWT photo/visibility phase — add the directional unit tests in the same plan that implements the three-tier check.

---

### Pitfall G-4: Public Wear Still Visible When Profile Is Locked Private

**Severity:** CRITICAL

**What goes wrong:**
A user with `profile_public = false` logs a wear event with `visibility = 'public'`. The wear appears in the WYWT rail for other users (and potentially in search or explore). The user's profile is private, but their activity is public — this was the exact bug caught in Phase 10 Plan 09 E2E during v2.0. The three-tier visibility adds a new path where a user might set `visibility = 'public'` on a single wear without intending to expose their overall identity.

**Why it happens:**
Per-wear visibility and per-profile visibility are checked independently. The DAL that enforces per-wear visibility may not also check `profile_public` for the actor.

**How to avoid:**
The canonical rule (established in v2.0): any wear read must check BOTH per-wear visibility AND `profile_public = true` for the actor. The DAL WHERE clause must always include:
```sql
AND p.profile_public = true  -- profile-level gate, always
AND (
  we.visibility = 'public'
  OR (we.visibility = 'followers' AND viewer_follows_actor)
  OR we.user_id = viewer_id  -- self always sees own
)
```
This is the two-layer check applied to the wear surface. Add it to the audit checklist for every wear-reading DAL function (see Pitfall G-1).

**Warning signs:**
- WYWT rail shows wears from users with `profile_public = false`.
- DAL function checks `visibility` but not `profile_public`.

**Phase to address:** WYWT photo/visibility phase — integrate the `profile_public` check into the three-tier visibility template; include in integration tests.

---

### Pitfall G-5: Self-Visibility Branch Missing — Viewer Cannot See Own Private Wears

**Severity:** HIGH

**What goes wrong:**
The three-tier check `visibility = 'public' OR (followers AND viewer_follows_actor) OR profile_public` has no explicit branch for the case where `viewer = actor`. If a user logs a Private wear, they should see it in their own worn tab. Without the self-include branch, the user logs a private wear and it disappears from their own view — a confusing and trust-eroding experience.

**Why it happens:**
Privacy check logic is written from the perspective of "what can others see" without handling the self case.

**How to avoid:**
Always add the self branch first:
```sql
WHERE (
  we.user_id = (SELECT auth.uid())  -- always see own wears, any visibility
  OR (
    p.profile_public = true
    AND (
      we.visibility = 'public'
      OR (we.visibility = 'followers' AND viewer_follows_actor)
    )
  )
)
```
Unit test: user queries their own private wears — confirm they are returned.

**Warning signs:**
- User logs a private wear and it does not appear in their own worn tab.
- Visibility WHERE clause has no `we.user_id = auth.uid()` branch.

**Phase to address:** WYWT photo/visibility phase — include the self-visibility unit test in the visibility implementation plan.

---

### Pitfall G-6: Backfill Migration Incorrectly Maps `worn_public = false` Wears

**Severity:** HIGH

**What goes wrong:**
The migration that adds the `visibility` enum must backfill existing `wear_events` rows. The correct mapping:
- `worn_public = true` → `visibility = 'public'`
- `worn_public = false` → `visibility = 'private'`

An incorrect backfill that maps `worn_public = false` to `'followers'` instead of `'private'` silently exposes previously-private wears to all followers — a privacy regression that may not be noticed until a user checks their worn tab.

**Why it happens:**
The developer assumes "followers" is a reasonable default for previously-private wears. It is not — the user's explicit prior choice was "private."

**How to avoid:**
The backfill must preserve the user's stated intent. `worn_public = false` → `'private'`. Document this mapping in the migration file as a comment. After running the migration, verify the count:
```sql
SELECT visibility, COUNT(*) FROM wear_events GROUP BY visibility;
-- Confirm 'followers' count = 0 after backfill (no pre-existing rows had followers tier)
```

**Warning signs:**
- Migration backfill sets `visibility = 'followers'` for rows where `worn_public = false`.
- Post-migration query shows unexpected `'followers'` rows from before v3.0.

**Phase to address:** WYWT photo/visibility phase — write the backfill SQL in the plan, not ad-hoc during execution.

---

### Pitfall G-7: "Followers" Wears Surface in Notification Paths for Non-Followers

**Severity:** CRITICAL

**What goes wrong:**
When a followed user logs a wear event, the system may generate a notification or surface it in recommendations. If the wear is `visibility = 'followers'` but the notification path does not re-check the visibility (it just checks "this user follows the actor"), a user who unfollowed the actor after the notification was generated receives a notification about a followers-only wear — and potentially clicks through to see it.

**Why it happens:**
Notifications are generated at write time. The visibility check occurs at read time. Between write and read, the follow relationship may change, or the notification itself carries a reference to the wear that was accessible at generation but not at render.

**How to avoid:**
Notification click-through must re-check visibility at render time — do not assume a notification implies current access to the referenced wear. The wear detail view that a notification links to must enforce the standard three-tier visibility check. A notification about a wear that the viewer can no longer access should render an empty state ("This wear is no longer available") rather than the full wear.

**Warning signs:**
- Clicking a notification goes directly to a wear detail that is now private/followers-only for the viewer.
- Wear detail page does not re-check visibility when rendered from a notification link.

**Phase to address:** Notifications phase AND WYWT photo/visibility phase — add the "access revoked" empty state to wear detail.

---

## H. Sonner Toast

---

### Pitfall H-1: Toaster Mounted Inside a Suspense Boundary That Suspends — Toast Layer Disappears

**Severity:** HIGH

**What goes wrong:**
If `<Toaster>` (from Sonner) is rendered inside a Suspense boundary that suspends during a page transition, the toast layer is unmounted and any pending toasts are lost. The user completes an action (submits WYWT form), a toast is triggered, the page transition starts, Suspense kicks in, and the toast disappears before the user sees it.

**Why it happens:**
`<Toaster>` is added inside the layout's Suspense wrapper because it's near the bottom of the layout JSX, which lives inside the boundary.

**How to avoid:**
Mount `<Toaster>` as a sibling of (not inside) the Suspense boundary. In the root layout:
```tsx
<body>
  <script>/* inline theme */</script>
  <Toaster />  {/* outside Suspense — always mounted */}
  <Suspense fallback={<LoadingShell />}>
    <Header />
    {children}
    <BottomNav />
  </Suspense>
</body>
```
The Toaster must be a stable root-level element that is never suspended.

**Warning signs:**
- Toast appears for <200ms then disappears during navigation.
- `<Toaster>` is nested inside a `<Suspense>` in layout.tsx.

**Phase to address:** Any phase that adds Sonner (likely the WYWT phase) — check layout placement before testing toasts.

---

### Pitfall H-2: Server Action Returns Data, Client Forgets to Wire Toast Trigger

**Severity:** MEDIUM

**What goes wrong:**
Server Actions return data but do not run client-side code. The toast must be triggered client-side. A common mistake: the Server Action completes, the developer assumes `toast.success()` can be called inside the Server Action body. It cannot — it runs on the server with no browser context.

**Why it happens:**
The developer writes `toast.success('Wear logged!')` inside the Server Action file because it seems like the right place for the UX feedback.

**How to avoid:**
The toast trigger lives in the client component's form submission handler:
```typescript
const [state, formAction] = useActionState(wearServerAction, null);

useEffect(() => {
  if (state?.success) {
    toast.success('Wear logged!');
    router.refresh();
  }
  if (state?.error) {
    toast.error(state.error);
  }
}, [state]);
```
The Server Action returns `{ success: true }` or `{ error: string }`. The `useEffect` (or `useActionState` callback) triggers the toast. Document this pattern in the WYWT plan as a required wiring step.

**Warning signs:**
- `import { toast } from 'sonner'` exists in a Server Action file.
- Form submits successfully but no toast appears.

**Phase to address:** WYWT photo phase (when Sonner is first added) — include the wiring in the plan as an explicit task.

---

### Pitfall H-3: Toaster Not Wired to Theme — Toast Doesn't Match Dark Mode

**Severity:** MEDIUM

**What goes wrong:**
Sonner's `<Toaster>` renders in light mode by default. In dark mode, the toast appears as a jarring white card over a dark interface.

**Why it happens:**
`<Toaster>` is added without the `theme` prop. The theme system (cookie-based, existing) is not automatically read by Sonner.

**How to avoid:**
Pass the theme to the Toaster. Since the root layout is a Server Component (with cacheComponents), the theme must be read from the cookie at request time and passed as a prop, or the Toaster must use a Client Component wrapper that reads the theme from a context/store:
```tsx
// Simple approach: read cookie in layout, pass as prop
<Toaster theme={resolvedTheme as 'light' | 'dark' | 'system'} />
```
Since `cookies()` is not allowed in the cacheComponents layout body (see Pitfall A-1), wrap the Toaster in the same Suspense-exempt approach used for the theme script, or accept a brief theme mismatch on first paint and use CSS variables to match the theme.

**Warning signs:**
- White toast card in dark mode.
- `<Toaster>` has no `theme` prop.

**Phase to address:** WYWT photo phase — add theme prop when wiring Sonner.

---

## I. Cross-Cutting (v2.0 Retrospective Lessons Applied to v3.0)

---

### Pitfall I-1: UAT Run at Milestone End Instead of Per-Phase — Privacy Bugs Found Late

**Severity:** HIGH

**What goes wrong:**
In v2.0, Phase 9 HUMAN-UAT was deferred and carried across two phases. The follower-count link bug was only found at the milestone audit. For v3.0, a three-tier visibility privacy bug found at Phase 13 (say) requires retrofitting three earlier phases. Privacy regressions are much cheaper to fix within the phase that introduced them.

**Why it happens:**
UAT feels like "end-to-end work" and gets pushed to a checkpoint at the end of a milestone. Individual phases ship without user-facing verification.

**How to avoid:**
Each phase plan must include a HUMAN-UAT checklist at the end. For privacy-touching phases (visibility changes, notifications, search), the UAT must include at least one cross-user privacy scenario ("log in as User B; confirm User A's private wear is not visible"). Bake UAT into the phase plan as a required final task, not a milestone-level activity.

**Warning signs:**
- Phase plan has no UAT or verification section.
- Privacy-touching phase ships without a cross-user visibility test.

**Phase to address:** All phases, explicitly Phase 11–13 — include UAT tasks in every plan that touches privacy.

---

### Pitfall I-2: WatchPickerDialog Forked Instead of Extended — v2.0 Pitfall 10 Carried Forward

**Severity:** HIGH

**What goes wrong:**
The WYWT post flow reuses `WatchPickerDialog` for step 1 (select watch). In v3.0, the flow adds a photo step after watch selection. The temptation is to copy `WatchPickerDialog` into a new `WywtPickerDialog` and add the photo step there. Forking creates two diverging components that both show owned watches. The next time owned-watch display logic needs updating, the developer updates one and misses the other.

The v2.0 research established: `WatchPickerDialog` is the single shared component — never fork.

**How to avoid:**
Extend `WatchPickerDialog` via props (e.g., `onWatchSelected` callback that hands off to the photo step in the WYWT flow). The photo capture step is a separate modal or flow that opens after watch selection — not embedded in WatchPickerDialog. Add a JSDoc comment to `WatchPickerDialog`:
```typescript
/**
 * SINGLE SHARED COMPONENT — DO NOT FORK.
 * Extend via onWatchSelected callback. See: .planning/PITFALLS.md Pitfall I-2.
 */
```
Add a grep gate in the phase plan: `grep -r "WywtPickerDialog\|WatchPickerDialog.*copy\|clone.*WatchPickerDialog" src/` must return empty.

**Warning signs:**
- A new `WywtPickerDialog.tsx` or `WearPickerDialog.tsx` file is created.
- Two components independently query owned watches.

**Phase to address:** WYWT photo phase — address in the plan before any component files are created.

---

### Pitfall I-3: Code Review Skipped for Cross-Component Privacy Invariants

**Severity:** CRITICAL

**What goes wrong:**
In v2.0, 2059 tests passed but the Common Ground home-card privacy leak was missed. A code review caught it because the reviewer was specifically looking for cross-component privacy invariants. For v3.0, the three-tier visibility ripple spans multiple components and DAL functions — exactly the type of cross-component invariant that tests miss.

**Why it happens:**
Tests verify per-function correctness. Cross-component privacy invariants require a reviewer who holds the whole data flow in mind simultaneously.

**How to avoid:**
Schedule a dedicated code review gate for any phase that ships three-tier visibility changes. The review checklist must include:
- Every `wear_events` read path audited for three-tier check (see G-1).
- Storage RLS policies reviewed against table RLS.
- Notification generation functions verified to not rethrow (see B-2).
- `'use cache'` functions verified to not capture `viewerId` from closures (see B-6).

**Warning signs:**
- Phase ships visibility changes without a code review.
- Code review exists but uses a generic checklist not tailored to privacy invariants.

**Phase to address:** WYWT photo/visibility phase AND notifications phase — add a code review plan step.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Bottom nav outside Suspense | Simpler layout | Build breaks with cacheComponents; or unread count always 0 | Never |
| Notification generation inside action transaction | Simpler error handling | Original action fails when notification fails | Never — always fire-and-forget |
| Single visibility tier (worn_public boolean) carried into v3.0 | No migration needed | "Followers" tier impossible without backfill; privacy invariants fragmented | Never — migrate in one phase |
| `heic2any` static import | One-line import | 1MB added to every page bundle | Never — always dynamic import |
| Skip canvas re-encode for uploaded files | Simpler upload path | EXIF GPS data leaked in uploaded images | Never for a production social feature |
| Storage bucket set to Public | No signed URL complexity | Private wears directly accessible by URL guessing | Never for private content |
| Client-side file validation only | Fast UX feedback | Server accepts any file via direct upload | Never — always add server-side validation |
| Toast triggered inside Server Action | Intuitive placement | Runtime error — no browser context on server | Never |
| Default visibility hardcoded as 'public' | Simplest form state | Users' private content inadvertently published | Never — use server-stored preference |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Next.js 16 cacheComponents + layout | Viewer-scoped data in layout body outside Suspense | Suspense-wrap all viewer-aware components; `viewerId` as function arg to `'use cache'` |
| Supabase Storage RLS | Assumes table RLS also protects storage objects | Write explicit `storage.objects` policies; test with direct URL access |
| `getUserMedia` + iOS Safari | Async work before `getUserMedia()` call | Call `getUserMedia` first in gesture handler — no awaits before it |
| Sonner `<Toaster>` + Suspense | Toaster inside Suspense boundary | Mount `<Toaster>` as root-level sibling of Suspense boundary |
| Sonner + Server Actions | `toast()` called inside Server Action | Server Action returns result; client `useEffect` triggers toast |
| `heic2any` + EXIF | HEIC-to-JPEG output uploaded directly | Always re-encode through canvas to strip EXIF |
| Supabase signed URLs + `next/image` | `<Image>` caches signed URLs indefinitely | Use `<img>` for private images; generate fresh signed URLs server-side per render |
| `pg_trgm` + Supabase | Extension assumed present; GIN index silently degrades | `CREATE EXTENSION IF NOT EXISTS pg_trgm` in migration; verify in prod |
| `'use cache'` + viewer context | `getCurrentUser()` called inside cached function body | Pass `viewerId` as explicit argument; grep gate for violations |
| Three-tier visibility + notifications | Notification click-through skips re-check | Wear detail always re-validates visibility on render |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Bell unread count in root layout (not leaf Suspense) | Every page load blocked by notifications DB query | Isolate as `<UnreadBadge>` leaf Server Component with its own Suspense | All authenticated page loads |
| `pg_trgm` missing; ILIKE on profiles | Search response time scales with user count | Enable extension in migration; verify prod | >500 users |
| Following-status N+1 in search results | 1 follows query per search result row | Batch-load all following IDs for viewer; pass as Set | >5 search results shown |
| Camera capture at full native resolution | 5–8MB upload on mobile data | Constrain `getUserMedia` resolution; resize on canvas; target <500KB | Any mobile upload |
| `heic2any` in main bundle | +1MB on first page load for all users | Dynamic import; only loaded when HEIC file detected | All pages if statically imported |
| Signed URL generation for every wear in a list | N signed URL requests per wear list render | Batch signed URL generation; cache within request | Any list with >3 private wears |

---

## Security Mistakes

| Mistake | Risk | Severity | Prevention |
|---------|------|----------|------------|
| Storage RLS not written; bucket assumed private by table RLS | Private wear images directly accessible via URL | CRITICAL | Separate `storage.objects` policies per bucket; test with direct URL |
| `'use cache'` without `viewerId` argument | User A sees User B's notifications/wears | CRITICAL | Grep gate: no `getCurrentUser()` inside `'use cache'` functions |
| Three-tier visibility not audited across all DAL reads | Followers-only wears visible publicly | CRITICAL | Audit checklist before migration; integration tests for each read path |
| File upload validated client-side only | Malicious files or oversized uploads bypass client | CRITICAL | Server Action validates magic bytes + size; Supabase bucket size limit |
| EXIF not stripped from all upload paths | GPS coordinates leak from wear photos | CRITICAL | Canvas re-encode mandatory for all upload paths; no `heic2any` output uploaded directly |
| Notification SELECT policy allows actor reads | Actor can read their own generated notifications about others | HIGH | `recipient_id = auth.uid()` only; no actor access |
| Self-notification not guarded | "You followed yourself" notifications | MEDIUM | DB CHECK constraint `actor_id != recipient_id`; Server Action guard |
| Storage per-user folder not RLS-enforced | User uploads to another user's storage folder | CRITICAL | `foldername(name)[1] = auth.uid()` in INSERT policy |

---

## "Looks Done But Isn't" Checklist

- [ ] **Bottom nav Suspense placement:** Verify `<BottomNav>` is inside the Suspense boundary in layout.tsx — run `next build` and confirm no dynamic API errors.
- [ ] **`'use cache'` viewer safety:** `grep -r "use cache" src/ | xargs grep -l "getCurrentUser\|cookies()"` returns empty.
- [ ] **Notifications RLS:** Query notifications table as User B for User A's rows — confirm 0 returned.
- [ ] **Notification fire-and-forget:** Every notification generation call is wrapped in `.catch()` with no rethrow.
- [ ] **Watch-overlap dedup:** Log a watch twice in one session; confirm recipient receives only one overlap notification.
- [ ] **Three-tier visibility audit:** Every `wear_events` read in `src/data/` has been audited for the three-tier check + `profile_public` guard.
- [ ] **Visibility direction test:** Unit test exists confirming `viewer follows actor` (not `actor follows viewer`) gates follower-tier wears.
- [ ] **Self-see own private wears:** Log a private wear; confirm it appears in own worn tab.
- [ ] **Storage policies:** Direct URL access to another user's private wear photo returns 403.
- [ ] **Storage folder enforcement:** Attempt to upload to another user's folder path; confirm policy violation.
- [ ] **EXIF stripped:** Upload an iPhone photo; run `exiftool` on stored file; confirm no GPSLatitude.
- [ ] **Camera cleanup:** Open camera dialog, close it; confirm camera LED indicator goes off.
- [ ] **iOS gesture context:** Test `getUserMedia` in iOS Safari on a real device — no `NotAllowedError`.
- [ ] **Canvas size limit:** Upload path produces a file <1MB (check network tab).
- [ ] **Signed URL strategy:** Private wear images use `<img>` (not `<Image>`) with server-generated signed URLs.
- [ ] **heic2any bundle:** Bundle analyzer confirms `heic2any` not in main chunk.
- [ ] **pg_trgm in prod:** `SELECT * FROM pg_extension WHERE extname = 'pg_trgm'` returns a row in the production Supabase project.
- [ ] **Search min-length server-side:** Direct search request with a 1-character query returns `[]`.
- [ ] **Toaster placement:** `<Toaster>` is a sibling of (not inside) the Suspense boundary in layout.tsx.
- [ ] **Toast from Server Action:** Toast is triggered by `useEffect` on `useActionState` result — not called inside the Server Action file.
- [ ] **WatchPickerDialog not forked:** `grep -r "WywtPickerDialog\|WearPickerDialog" src/` returns empty.
- [ ] **Backfill correctness:** Post-migration `SELECT visibility, COUNT(*) FROM wear_events GROUP BY visibility` shows 0 rows with `'followers'` (all pre-existing rows should be 'public' or 'private').
- [ ] **iOS safe-area:** Test bottom nav on iPhone with home indicator — last page content not clipped; Wear CTA tappable.
- [ ] **Orphan file cleanup:** Delete a wear event with a photo; confirm storage object is deleted.
- [ ] **ON DELETE CASCADE for notifications:** Delete a test profile; confirm their notification rows are gone.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Private wear photos accessible via direct URL | HIGH | Change bucket to private immediately; rotate signed URLs; audit access logs; notify affected users |
| Three-tier visibility DAL missed — followers-only wears public | HIGH | Immediate hotfix deploy; audit which wears were exposed; notify users; add integration tests before re-deploying |
| EXIF GPS in stored photos | HIGH | Delete affected files; re-upload without EXIF; add canvas re-encode to all paths; consider notifying users whose location was exposed |
| `'use cache'` cross-user data leak | HIGH | Invalidate all cache tags; deploy fix; audit for other `'use cache'` violations |
| Camera not releasing on iOS | LOW | Force-close browser tab; fix cleanup useEffect; deploy |
| `heic2any` in main bundle | MEDIUM | Move to dynamic import; rebuild; deploy; no data migration needed |
| Duplicate notifications sent | MEDIUM | Add `ON CONFLICT DO NOTHING`; optionally delete duplicate rows from `notifications` table; no user data affected |
| `pg_trgm` missing in prod | LOW | Run `CREATE EXTENSION IF NOT EXISTS pg_trgm` via Supabase SQL editor; re-create GIN indexes; search immediately improved |
| Wear events backfill incorrect | HIGH | Write a corrective migration; restore `'private'` for rows incorrectly set to `'followers'`; no user data lost but privacy must be immediately restored |
| Toaster suspended and toast lost | LOW | Move `<Toaster>` outside Suspense; deploy; cosmetic fix only |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Bottom nav outside Suspense (A-1) | Phase 11 (bottom nav) | `next build` clean; unread count renders for authenticated user |
| iOS safe-area inset (A-3) | Phase 11 (bottom nav) | UAT on real iPhone — all CTAs tappable |
| Bottom nav on auth pages (A-4) | Phase 11 (bottom nav) | `/login` renders without nav |
| Notifications RLS (B-4) | Phase 12 (notifications) | Integration test: cross-user notification read returns 0 rows |
| Notification fire-and-forget (B-2) | Phase 12 (notifications) | Code review: no notification error propagates to caller |
| Watch-overlap dedup (B-3) | Phase 12 (notifications) | Add watch twice; confirm 1 notification received |
| `'use cache'` viewer leak (B-6) | Phase 12 + any cached query | Grep gate: no `getCurrentUser` inside `'use cache'` |
| Search full table scan (C-1) | Phase 13 (people-search) | `pg_trgm` enabled in prod; EXPLAIN shows index scan |
| Search returns private profiles (C-3) | Phase 13 (people-search) | Integration test: private user not in search results |
| Following-status N+1 in search (C-4) | Phase 13 (people-search) | Supabase logs: ≤2 queries per search result page |
| iOS getUserMedia gesture (D-1) | Phase 14 (WYWT photo) | UAT on real iOS Safari — camera opens without NotAllowedError |
| Camera not released (D-2) | Phase 14 (WYWT photo) | Camera LED off after dialog close |
| Canvas oversized image (D-4) | Phase 14 (WYWT photo) | Network tab: upload payload <1MB |
| `heic2any` bundle size (E-1) | Phase 14 (WYWT photo) | Bundle analyzer: `heic2any` not in main chunk |
| EXIF orientation (E-2) | Phase 14 (WYWT photo) | Upload portrait photo; confirm displays upright |
| EXIF GPS leak (E-4) | Phase 14 (WYWT photo) | `exiftool` on stored file: no GPSLatitude |
| Client-only file validation (E-3) | Phase 14 (WYWT photo) | Direct upload request with >5MB file rejected server-side |
| Storage RLS separate from table RLS (F-1) | Phase 14 (WYWT photo) | Direct URL to private wear photo returns 403 |
| Signed URLs + `next/image` (F-2) | Phase 14 (WYWT photo) | Private wear images use `<img>` not `<Image>` |
| Orphan storage on wear delete (F-3) | Phase 14 (WYWT photo) | Delete wear; confirm storage object gone |
| Three-tier DAL audit (G-1) | Phase 14 (WYWT visibility) | Checklist: every wear_events DAL function reviewed |
| Default visibility (G-2) | Phase 14 (WYWT visibility) | Form defaults to last-used server preference; no localStorage |
| Follower direction inversion (G-3) | Phase 14 (WYWT visibility) | Unit test: `A follows B` vs `B follows A` — correct gating |
| `profile_public` gate on wear reads (G-4) | Phase 14 (WYWT visibility) | Integration test: private profile wear not visible to public |
| Self-visibility branch (G-5) | Phase 14 (WYWT visibility) | User sees own private wears in worn tab |
| Backfill mapping (G-6) | Phase 14 (WYWT visibility) | Post-migration count: 0 rows with 'followers' from pre-v3.0 data |
| Followers-only wear in notification path (G-7) | Phase 12 + Phase 14 | Wear detail re-checks visibility; expired-access shows empty state |
| Toaster inside Suspense (H-1) | Phase 14 (first Sonner use) | `<Toaster>` outside Suspense in layout.tsx |
| Toast not wired from Server Action (H-2) | Phase 14 (first Sonner use) | WYWT form submit shows success toast |
| Toaster theme mismatch (H-3) | Phase 14 (first Sonner use) | Dark mode: toast matches theme |
| UAT per-phase, not milestone-end (I-1) | All phases | Each plan has UAT checklist; privacy phases include cross-user scenarios |
| WatchPickerDialog fork (I-2) | Phase 14 (WYWT photo) | Grep gate: no WywtPickerDialog file created |
| Code review for privacy invariants (I-3) | Phase 14 (WYWT visibility) | Code review plan step with visibility-specific checklist |

---

## Sources

- [Horlo v2.0 Retrospective](../.planning/RETROSPECTIVE.md) — HIGH confidence (first-party, direct lessons)
- [Horlo PROJECT.md — Key Decisions](../.planning/PROJECT.md) — HIGH confidence (established patterns: viewer-aware DAL, two-layer privacy, cacheComponents layout)
- [Next.js 16 cacheComponents docs — dynamic API restrictions](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) — HIGH confidence
- [Supabase Storage RLS documentation](https://supabase.com/docs/guides/storage/security/access-control) — HIGH confidence
- [MDN getUserMedia — security/gesture requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#security) — HIGH confidence
- [iOS Safari camera permission behavior — WebKit Bugzilla / MDN notes](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API#browser_compatibility) — MEDIUM confidence (iOS-specific behavior, verified by community reports)
- [heic2any npm package — bundle size and API](https://www.npmjs.com/package/heic2any) — HIGH confidence
- [EXIF orientation handling — canvas drawImage](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Using_images) — HIGH confidence
- [Sonner toast + Next.js App Router wiring](https://sonner.emilkowal.ski/) — HIGH confidence
- [Supabase signed URL expiry and caching](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) — HIGH confidence

---
*Pitfalls research for: Horlo v3.0 — Production Nav & Daily Wear Loop (Next.js 16 cacheComponents + Supabase Storage RLS + three-tier visibility)*
*Researched: 2026-04-21*

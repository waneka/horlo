# Architecture Research

**Domain:** v3.0 Production Nav & Daily Wear Loop — integrating bottom nav, notifications, people-search, WYWT photo post flow, and `/explore` stub into existing Next.js 16 + Supabase + Drizzle app
**Researched:** 2026-04-21
**Confidence:** HIGH (existing codebase is the primary source of truth; all patterns derived from what's already built and running in production)

---

## System Overview (v3.0 Additions Only)

Existing architecture is NOT re-researched. Diagram shows only what v3.0 adds to the existing system:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  BROWSER (new v3.0 client islands)                                         │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  BottomNavClient     │  │  SearchClient    │  │  WywtPhotoForm       │  │
│  │  (usePathname,       │  │  (debounce +     │  │  (getUserMedia,      │  │
│  │   open wear dialog)  │  │   search action) │  │   FormData upload)   │  │
│  └──────────────────────┘  └──────────────────┘  └──────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────┤
│  SERVER (new v3.0 surfaces)                                                │
│  ┌──────────────────┐  ┌───────────────────┐  ┌────────────────────────┐  │
│  │  BottomNav       │  │  NotificationBell │  │  /search page.tsx      │  │
│  │  (Server shell   │  │  (Server shell:   │  │  (Server Component     │  │
│  │   fetches viewer │  │   getUnreadCount) │  │   shell + Client       │  │
│  │   username for   │  │                  │  │   search island)        │  │
│  │   profile link)  │  │                  │  │                        │  │
│  └──────────────────┘  └───────────────────┘  └────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │  New Server Actions                                                │   │
│  │  logWearWithPhoto()   markAllNotificationsRead()   searchPeople()  │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │  New DAL (src/data/)                                               │   │
│  │  notifications.ts   (getUnreadCount, markAllRead, insertNotif)     │   │
│  │  wearEvents.ts      (logWearEvent extended: photo_url, visibility) │   │
│  │  search.ts          (searchProfiles)                               │   │
│  └────────────────────────────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────────────────┤
│  SUPABASE                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Postgres (new tables):  notifications, wear_visibility enum        │  │
│  │  Postgres (modified):    wear_events (+photo_url, +visibility)      │  │
│  │  Storage (new bucket):   wear-photos/  (per-user RLS)               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Bottom Navigation

### Architecture Decision

**Recommended pattern: Async Server Component shell wrapping a `'use client'` tab-state island.**

The Server Component (`BottomNav`) fetches `username` (needed for the Profile tab link) and `unreadCount` (needed for the Notifications badge). It renders the nav structure and passes both as props to `BottomNavClient`, which owns `usePathname()` for active-tab highlighting and the `NavWearButton`-equivalent open-state for the centered Wear CTA.

This is the same pattern as `Header.tsx` (Server Component shell) + `HeaderNav.tsx` (Client Component for `usePathname`).

### cacheComponents Compatibility

`BottomNav` reads viewer-scoped data (`username`, `unreadCount`). It is viewer-dynamic, so it MUST NOT be statically cached. It will live inside a `<Suspense>` boundary in `root layout.tsx`, just like `Header` does today. The `<Suspense fallback={<BottomNavSkeleton />}>` wraps it in the layout body. No `'use cache'` directive on `BottomNav` itself.

The `unreadCount` call (`getUnreadCount(userId)`) returns a different value per viewer per request, making it incompatible with cross-viewer cache. Do NOT apply `cacheLife` to it.

### Placement: Root Layout

Bottom nav goes in `src/app/layout.tsx` as a sibling to `<Header>` and `<main>`. Mounting in root layout is correct because every authed route (home, explore, search, profile, settings) shows it.

**It must NOT be conditionally rendered by route — use CSS visibility control instead.** This avoids hydration mismatches. Hide it on public/auth routes (`/login`, `/signup`, etc.) using a CSS class. The Server Component checks `user !== null` and renders `null` for unauthenticated visitors, which naturally hides it on auth routes since proxy.ts redirects unauthenticated users anyway.

### Layout mount point (modification to `src/app/layout.tsx`)

```
<ThemeProvider>
  <Suspense fallback={<HeaderSkeleton />}>
    <Header />
  </Suspense>
  <Suspense fallback={null}>
    <main className="flex-1 pb-16 md:pb-0">{children}</main>
  </Suspense>
  <Suspense fallback={<BottomNavSkeleton />}>
    <BottomNav />       {/* new — null for unauthed visitors */}
  </Suspense>
</ThemeProvider>
```

`pb-16 md:pb-0` on `<main>` is required so content does not scroll under the fixed bottom bar on mobile. On desktop (`md:`) the bottom nav is `hidden`, so no padding is needed.

### Header co-existence

The existing `Header` stays. `MobileNav` (hamburger slide-out sheet) becomes redundant once the sticky bottom nav ships, but defer its removal to a later cleanup phase. For v3.0, both coexist. The mobile top nav will be slimmed (product brief §9 calls for "logo, search, notifications, settings" on mobile) — this is Header surgery, not bottom-nav surgery.

### Wear CTA in Bottom Nav

The centered Wear tab in the bottom nav opens `WatchPickerDialog` directly, the same way `NavWearButton` does today. It does NOT route to a `/wear` page. This is the **third call site** for `WatchPickerDialog` (existing: WYWT rail tile, nav `+ Wear` button; new: bottom nav Wear tab).

Per the `WatchPickerDialog` JSDoc contract: "Do NOT duplicate this dialog. If a second call site needs slight different behavior, add a prop." The bottom nav Wear trigger follows the same pattern as `NavWearButton`: lazy-import the dialog, gate render on `open` state, pass `ownedWatches` as prop.

The `ownedWatches` prop must be passed down from the Server Component shell (`BottomNav`) to `BottomNavClient`. `BottomNav` already shares the same data shape `Header` fetches. However, this creates a data dependency that `Header` already resolves. Rather than fetching owned watches twice, consider passing them from the root layout via context or accept the redundant fetch. **Decision needed: see Open Architecture Decisions below.**

### New Components

| Component | Type | File | Purpose |
|-----------|------|------|---------|
| `BottomNav` | Server Component | `src/components/layout/BottomNav.tsx` | Fetches `username` + `unreadCount`, renders shell, passes to client |
| `BottomNavClient` | Client Component | `src/components/layout/BottomNavClient.tsx` | `usePathname()` active tab, Wear dialog open state |
| `BottomNavSkeleton` | Server Component | `src/components/layout/BottomNavSkeleton.tsx` | Skeleton placeholder inside Suspense |

### New DAL Functions

`BottomNav` needs `unreadCount`. Reuses `getProfileById` (already in `src/data/profiles.ts`) for username. The unread count comes from a new `src/data/notifications.ts` DAL.

### Data Flow

```
root layout.tsx
  └─ <Suspense>
       └─ BottomNav (Server Component)
            ├─ getCurrentUser() → userId or null (null → return null)
            ├─ getProfileById(userId) → username
            ├─ getUnreadCount(userId) → number   [new DAL]
            └─ <BottomNavClient
                 username={username}
                 unreadCount={unreadCount}
                 ownedWatches={ownedWatches}    {/* see open decision */}
               />
                 └─ usePathname() → active tab CSS
                 └─ lazy WatchPickerDialog on Wear tap
```

---

## Feature 2: Notifications

### Schema

```sql
-- New Drizzle table in src/db/schema.ts
notifications
  id          uuid PK defaultRandom()
  userId      uuid NOT NULL → users.id CASCADE    -- recipient
  type        text NOT NULL                        -- see enum below
  payload     jsonb NOT NULL DEFAULT '{}'          -- type-specific data
  readAt      timestamptz NULL                     -- NULL = unread
  createdAt   timestamptz defaultNow() NOT NULL

Indexes:
  notifications_user_id_idx ON (userId)
  notifications_user_unread_idx ON (userId) WHERE readAt IS NULL   -- partial index for unread count
```

**Notification types (v3.0 live):**
- `'follow'` — payload: `{ actorId, actorUsername, actorDisplayName }`
- `'watch_overlap'` — payload: `{ actorId, actorUsername, brand, model, watchId }`

**Notification types (v3.0 stubbed — schema exists, no insertion path):**
- `'price_drop'` — payload: `{ watchId, brand, model, oldPrice, newPrice }`
- `'trending'` — payload: `{ watchId, brand, model, ownerCount }`

### Read State: Per-row `readAt` (recommended over `notifications_last_read_at` on user)

Rationale: per-row `readAt` gives accurate per-notification state for the notification center page. A single timestamp on the user row would make "mark individual notification read" impossible without a schema change. The partial index `WHERE readAt IS NULL` makes `getUnreadCount` fast (index-only scan on a small set). The downside — `markAllRead` issues a bulk UPDATE — is acceptable at MVP scale (users have at most tens of notifications).

### Notification Generation: Fire-and-Forget in Server Actions

Same pattern as `logActivity()` in `src/app/actions/wearEvents.ts`. Synchronous but wrapped in a try/catch so notification write failure never surfaces to the user.

**Follow notification** — generated in `src/app/actions/follows.ts` inside `followUser()` after the follow row is inserted:
```
await notificationsDAL.insertNotification(targetUserId, 'follow', { actorId, actorUsername, actorDisplayName })
```

**Watch-overlap notification** — generated in `src/app/actions/watches.ts` inside `addWatch()` after the watch is created. Query: `SELECT DISTINCT userId FROM watches WHERE brand ILIKE $brand AND model ILIKE $model AND userId != $actorId`. Write one notification row per matched user. Deduplicate: before inserting, check if a `watch_overlap` notification for this `(userId, brand, model)` combination already exists within the last 30 days. This prevents spam when a user adds the same watch twice.

### Bell Unread Count in Nav

Fetched by `BottomNav` (mobile) and `Header` (desktop, requires Header surgery). The count is server-rendered per request. No client-side polling. `router.refresh()` on the notifications page after mark-all-read is the update mechanism.

### DAL Functions (`src/data/notifications.ts`)

```typescript
getUnreadCount(userId: string): Promise<number>
// SELECT COUNT(*) FROM notifications WHERE userId = $userId AND readAt IS NULL

getNotificationsPage(userId: string, limit?: number): Promise<Notification[]>
// SELECT * FROM notifications WHERE userId = $userId ORDER BY createdAt DESC LIMIT $limit

markAllRead(userId: string): Promise<void>
// UPDATE notifications SET readAt = NOW() WHERE userId = $userId AND readAt IS NULL

insertNotification(
  recipientId: string,
  type: NotificationType,
  payload: Record<string, unknown>
): Promise<void>
// INSERT ... onConflictDoNothing on a dedupe key if needed

checkRecentOverlapNotification(
  recipientId: string,
  brand: string,
  model: string,
  windowDays?: number
): Promise<boolean>
// SELECT 1 FROM notifications WHERE userId = $recipientId AND type = 'watch_overlap'
//   AND payload->>'brand' ILIKE $brand AND payload->>'model' ILIKE $model
//   AND createdAt > NOW() - INTERVAL '$windowDays days' LIMIT 1
```

### Server Actions (`src/app/actions/notifications.ts` — new file)

```typescript
markAllNotificationsRead(): Promise<ActionResult<void>>
// getCurrentUser() → markAllRead(userId) → revalidatePath('/notifications')
```

### RLS Policy

Same `(SELECT auth.uid()) = user_id` pattern used by `activities` table:
```sql
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);
```

INSERT is service-role only (Server Actions run through the service-role Drizzle client). No client INSERT policy needed.

### Notifications Page (`/notifications`)

```
/notifications/page.tsx (Server Component)
  → getCurrentUser()
  → getNotificationsPage(userId, 50)
  → render <NotificationList notifications={...} />
     └─ Client island with "Mark all read" button → markAllNotificationsRead() Server Action
```

### Stubbed UI Templates

`NotificationList` renders a `switch` on `type`. For `'price_drop'` and `'trending'` — render a template row with placeholder copy ("Price drop alerts coming soon"). No rows will appear in practice since there is no insertion path. The UI template exists so future phases can wire data without a component rebuild.

### New Components

| Component | Type | File | Purpose |
|-----------|------|------|---------|
| `NotificationBell` | Server Component | `src/components/layout/NotificationBell.tsx` | Badge dot for header (desktop nav surgery) |
| `NotificationList` | Server Component | `src/components/notifications/NotificationList.tsx` | Renders notification rows by type |
| `NotificationRow` | Server Component | `src/components/notifications/NotificationRow.tsx` | Single row, type-switched rendering |
| `MarkAllReadButton` | Client Component | `src/components/notifications/MarkAllReadButton.tsx` | Client island; calls markAllNotificationsRead Server Action |

### Data Flow

```
/notifications page (Server Component)
  → getCurrentUser()
  → getNotificationsPage(userId, 50)
  → <NotificationList notifications={rows} />
       └─ <NotificationRow> per row (switch on type)
       └─ <MarkAllReadButton> (Client island)
            → markAllNotificationsRead() Server Action
            → router.refresh() to reload page

followUser() Server Action (src/app/actions/follows.ts)
  → follows DAL insert
  → insertNotification(targetId, 'follow', payload)  [fire-and-forget]

addWatch() Server Action (src/app/actions/watches.ts)
  → watches DAL insert
  → query overlapping users
  → for each: checkRecentOverlapNotification() → insertNotification() [fire-and-forget]
```

---

## Feature 3: People Search

### Architecture

Server Component shell + Client Component for live input. The server page renders the tab chrome (All / Watches / People / Collections) statically; only People is populated in v3.0 — the other tabs show "Coming soon" without any data fetch.

**No full-client approach**: avoid client-side debounced fetch to a Server Action for the initial render. The page first renders server-side with no query, then the client island takes over on user input.

### Route

`src/app/search/page.tsx` — new Server Component page. No layout file needed; inherits root layout (Header + BottomNav).

`proxy.ts` — `/search` is an authed-only route. No `PUBLIC_PATHS` addition needed.

### Client Input + Debounce Pattern

```
SearchPage (Server Component)
  └─ <SearchClient>  ('use client', lazy-loaded)
       └─ controlled <input> (value, onChange)
       └─ useCallback debounced (300ms)
       └─ useTransition() → calls searchPeopleAction(query) Server Action
       └─ renders <SearchResultsList results={...} />
```

### Search Server Action (`src/app/actions/search.ts` — new file)

```typescript
searchPeople(query: string): Promise<ActionResult<SearchResult[]>>
// getCurrentUser() → searchProfiles(query, userId, limit=20)
```

### New DAL (`src/data/search.ts` — new file)

```typescript
export interface SearchResult {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  tasteOverlapPct: number | null  // null when viewer has no owned watches
  isFollowing: boolean
}

searchProfiles(
  query: string,
  viewerId: string,
  limit?: number           // default 20
): Promise<SearchResult[]>
```

Implementation uses `pg_trgm` ILIKE on `username` and `bio`. `taste_overlap_pct` is computed by a join with the `common_ground` logic or approximated by brand/style overlap — exact implementation TBD in phase. For v3.0, returning `null` for `tasteOverlapPct` is acceptable; it renders as absent in the UI.

`isFollowing` is a LEFT JOIN on `follows WHERE follower_id = $viewerId AND following_id = profile.id`.

### Pagination

LIMIT 20 for v3.0. No keyset cursor. The product brief mentions no infinite scroll at MVP scale and 20 results is sufficient for people search at current user counts.

### Empty / No-results states

Handled client-side in `SearchResultsList` based on result array length and `query.length > 0` — "No collectors found for X" vs. blank initial state.

### `pg_trgm` Prerequisite

The extension must be enabled in Supabase. This is a schema migration step: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`. Also requires indexes: `CREATE INDEX profiles_username_trgm_idx ON profiles USING gin (username gin_trgm_ops);` and `CREATE INDEX profiles_bio_trgm_idx ON profiles USING gin (bio gin_trgm_ops);`. These are Drizzle-unmanaged raw SQL migrations (no Drizzle equivalent for GIN indexes today). Must be added as a raw SQL migration file.

### New Components

| Component | Type | File | Purpose |
|-----------|------|------|---------|
| `SearchClient` | Client Component | `src/components/search/SearchClient.tsx` | Input, debounce, calls Server Action, renders results |
| `SearchResultsList` | Client Component | `src/components/search/SearchResultsList.tsx` | Result rows, empty state |
| `SearchResultRow` | Client Component (or Server) | `src/components/search/SearchResultRow.tsx` | Single result row with avatar, username, taste overlap |

### Data Flow

```
/search page (Server Component, initial render — no query)
  └─ <SearchClient>   (Client, lazy-loaded after hydration)
       └─ user types query
       └─ debounce 300ms
       └─ useTransition: searchPeople(query) Server Action
            → searchProfiles(query, viewerId, 20) DAL
                → pg_trgm ILIKE on username + bio
                → LEFT JOIN follows for isFollowing
                → return SearchResult[]
       └─ render <SearchResultsList results={...} />
```

---

## Feature 4: WYWT Photo Post Flow

This is the most architecturally complex feature. Several decisions require explicit user input before planning begins. See Open Architecture Decisions.

### State Machine

The WYWT post flow is a three-step state machine, all within a single modal/overlay to minimize navigation disruption:

```
Step 1: Pick watch    →   Step 2: Compose post    →   Step 3: Submit
(WatchPickerDialog)       (WywtPhotoForm)              (Server Action)
```

`WatchPickerDialog` is reused as step 1 UNCHANGED. It must gain a new prop `onWatchSelected?: (watch: Watch) => void` to support transitioning to step 2 instead of immediately calling `markAsWorn`. When this prop is provided, the "Log wear" button calls `onWatchSelected(watch)` instead of `markAsWorn`. The existing code path (no prop) remains unchanged.

### Schema Changes (wear_events)

```sql
-- New enum type
CREATE TYPE wear_visibility AS ENUM ('public', 'followers', 'private');

-- Additions to wear_events table
ALTER TABLE wear_events
  ADD COLUMN photo_url TEXT NULL,
  ADD COLUMN note TEXT NULL CHECK (length(note) <= 200),
  ADD COLUMN visibility wear_visibility NOT NULL DEFAULT 'public';
```

Drizzle schema additions in `src/db/schema.ts`:
```typescript
// pgEnum declaration at top of schema.ts
export const wearVisibilityEnum = pgEnum('wear_visibility', ['public', 'followers', 'private'])

// In wearEvents table definition:
photoUrl: text('photo_url'),
note: text('note'),
visibility: wearVisibilityEnum('visibility').notNull().default('public'),
```

### `worn_public` Migration Strategy

`profile_settings.worn_public` (boolean) is a global toggle for whether all wear events are publicly visible. v3.0 adds per-row `visibility` on `wear_events`. The two systems must coexist briefly, then `worn_public` is deprecated.

**Backfill plan:**
1. Add `visibility` column with `DEFAULT 'public'` (all existing rows become `'public'`).
2. Backfill rows for users where `worn_public = false`: `UPDATE wear_events SET visibility = 'private' WHERE userId IN (SELECT userId FROM profile_settings WHERE wornPublic = false)`.
3. At this point, existing privacy is preserved: users who hid all wears have per-row `'private'`; users who shared all wears have per-row `'public'`.
4. Keep `worn_public` column for this milestone (v3.0). Mark as deprecated in schema comment.
5. Remove `worn_public` in a future milestone after all DAL functions are updated to use per-row `visibility`.

**Migration must run before any DAL ripple work.** The column must exist before updating DAL reading functions.

### Three-Tier Visibility Ripple — Full Audit of Wear-Reading DALs

Every function that reads `wear_events` for non-owner viewers must be updated to respect per-row `visibility`. Below is the complete list from the codebase:

**1. `getPublicWearEventsForViewer(viewerUserId, profileUserId)` — `src/data/wearEvents.ts` line 87**
Currently: gate on `wornPublic` boolean from `profile_settings`.
After: gate per-row: `AND (visibility = 'public' OR (visibility = 'followers' AND $viewerIsFollowing) OR userId = $viewerUserId)`.
The `wornPublic` boolean gate should be removed or treated as a master override (decision needed).

**2. `getWearRailForViewer(viewerId)` — `src/data/wearEvents.ts` line 126**
Currently: WHERE clause uses `eq(profileSettings.wornPublic, true)` as part of the followed-actor gate.
After: the `wornPublic` check must be replaced with per-row visibility logic. For the rail, include a wear tile if: `visibility = 'public'` OR (`visibility = 'followers'` AND viewer follows that actor). The self-include bypass remains unchanged.
This is a complex WHERE clause change on a JOIN query — requires careful migration.

**3. `getAllWearEventsByUser(userId)` — `src/data/wearEvents.ts` line 71**
Currently: owner-only, no visibility gate (userId must match). Returns all rows for the owner regardless of visibility. This is correct and UNCHANGED — owner always sees all their own events.

**4. `getWearEventsByWatch(userId, watchId)` — `src/data/wearEvents.ts` line 33**
Currently: owner-only (userId param). UNCHANGED — always owner-scoped.

**5. `getMostRecentWearDate(userId, watchId)` — `src/data/wearEvents.ts` line 20**
Currently: owner-only. UNCHANGED.

**6. `getMostRecentWearDates(userId, watchIds)` — `src/data/wearEvents.ts` line 44**
Currently: owner-only. UNCHANGED.

**7. `getFeedForUser(viewerId, cursor, limit)` — `src/data/activities.ts` line 57**
Feed rows include `watch_worn` activity type. The activity row's visibility is currently gated by `profileSettings.wornPublic`. After v3.0, this gate should read the per-row `visibility` of the associated `wear_events` row (if `watchId` is not null and is a worn event).
This requires either a JOIN to `wear_events` or storing `visibility` in the activity `metadata` at write time. **Storing in metadata at write time is strongly recommended** — it avoids a JOIN on the hot feed path and keeps the activity self-contained if the wear event is later deleted.

**Conclusion:** `watch_worn` activities should store `{ brand, model, imageUrl, visibility }` in metadata. Update `logActivity` call in `markAsWorn`/`logWearWithPhoto` to include `visibility` in metadata.

**8. Profile worn tab DAL (used in `src/app/u/[username]/layout.tsx` line 68)**
`getAllWearEventsByUser(profile.id)` is called for wear tab rendering on other users' profiles. Currently bypasses per-row visibility (returns all regardless). After v3.0, the profile worn tab must call `getPublicWearEventsForViewer(viewerId, profile.id)` instead of `getAllWearEventsByUser` for non-owner viewers.

**Note:** `getAllWearEventsByUser` is also called for `wearEvents` in the taste tag computation at line 68 of the profile layout. This call is computing `wearEvents.length` for taste tags — it should remain as `getAllWearEventsByUser` for owner OR use a count-only query, not filtered by visibility.

**9. `getWearRailForViewer` — `isSelf` tile (line 186 in wearEvents.ts)**
Self-include bypasses all privacy and is correct — visibility does not apply to the viewer's own tile. Unchanged.

### Image Upload Pipeline

**Architecture Decision Required.** Two options:

**Option A (recommended): Client → Supabase Storage → Server Action with storage path**
1. Client captures/selects image, converts HEIC (in-browser), resizes (in-browser), strips EXIF (in-browser with `piexifjs` or manual ArrayBuffer manipulation).
2. Client uploads directly to Supabase Storage using the anon-key Supabase client (`supabaseClient.storage.from('wear-photos').upload(path, file)`). RLS policy on storage enforces `auth.uid() = user_id` in the path.
3. Client gets back the storage path (or public URL for `public` visibility wears).
4. Client passes storage path + wear metadata to `logWearWithPhoto()` Server Action.
5. Server Action validates the path pattern, creates the `wear_events` row.

**Option B: Client → Server Action with raw file in FormData**
1. Client sends file bytes in FormData to `logWearWithPhoto()` Server Action.
2. Server Action strips EXIF (using `sharp` or a pure-JS library), resizes, uploads to Supabase Storage via service-role client.
3. Server Action creates the `wear_events` row.

**Option A is recommended because:**
- Avoids doubling bandwidth (client → server → storage).
- EXIF stripping in the browser is achievable with a small pure-JS approach (zeroing EXIF marker bytes).
- Server Actions in Next.js have a default body size limit (4MB in Next.js) that raw photo FormData can exceed without configuration.
- Supabase Storage RLS on buckets provides the server-side ownership enforcement so the server-action path is not load-bearing for security.

**Option B is more architecturally clean** (no secrets on client, server validates/strips everything) but has the bandwidth and body-limit tradeoffs.

**This is the primary open decision for this feature. User must resolve before planning begins.**

### Supabase Storage Bucket Structure

```
Bucket: wear-photos (private bucket — no public read by default)
Path:   {userId}/{wearEventId}.jpg

RLS policy on storage.objects:
  INSERT: auth.uid()::text = (storage.foldername(name))[1]
  SELECT: (SELECT auth.uid())::text = (storage.foldername(name))[1]
           OR EXISTS (
             SELECT 1 FROM wear_events we
             WHERE we.id::text = split_part(storage.filename(name), '.', 1)
               AND we.visibility = 'public'
           )
           OR (
             EXISTS (
               SELECT 1 FROM wear_events we
               WHERE we.id::text = split_part(storage.filename(name), '.', 1)
                 AND we.visibility = 'followers'
             )
             AND EXISTS (
               SELECT 1 FROM follows f
               WHERE f.follower_id = (SELECT auth.uid())
                 AND f.following_id = (storage.foldername(name))[1]::uuid
             )
           )
```

**Note:** Bucket-level RLS policies that JOIN application tables are expensive. An alternative is to use signed URLs for all non-public wears and skip bucket-level application-logic RLS — the signed URL IS the access grant. See Signed URL section.

### Signed URL Strategy

**Recommendation: On-demand signed URLs per request, no caching.**

When rendering a wear tile or wear detail and `visibility != 'public'`, generate a signed URL server-side via:
```typescript
supabaseAdmin.storage.from('wear-photos').createSignedUrl(path, 3600) // 1 hour
```

This happens in the DAL function that reads the wear event, before returning the tile shape. The signed URL is injected into the tile payload so the Client Component receives a ready-to-use `<img>` URL.

Do NOT pre-generate and cache signed URLs in a separate store. Signed URLs are cheap to generate. Caching introduces invalidation complexity with no meaningful performance benefit at MVP scale.

**Cache Components note:** `getWearRailForViewer` is already a dynamic, per-viewer function. It is not decorated with `'use cache'`. Signed URL generation inside it is safe.

### WywtPhotoForm Component

```
WywtPhotoForm ('use client')
  Props:
    selectedWatch: Watch
    onBack: () => void          // return to WatchPickerDialog
    onSuccess: () => void       // close flow, show toast
    ownedWatches: Watch[]       // passed through in case of re-pick

  State machine (local useState):
    'capture'  → CameraCapture  (getUserMedia + overlay canvas)
    'upload'   → file input (<input type="file" accept="image/*,.heic">)
    'review'   → shows captured/uploaded preview
    'submit'   → pending

  Children:
    CameraCapture ('use client') — getUserMedia, overlay canvas, snapshot to Blob
    HeicConverter (utility, not a component) — heic2any in-browser conversion
    ExifStripper (utility) — zeroes EXIF marker in ArrayBuffer
    ImageResizer (utility) — canvas-based downscale to max 1400px before upload
```

### New Server Action (`src/app/actions/wearEvents.ts` — extend existing file)

```typescript
logWearWithPhoto(input: {
  watchId: string
  storagePath: string | null    // null if no photo
  note: string | null
  visibility: 'public' | 'followers' | 'private'
}): Promise<ActionResult<{ wearEventId: string }>>
```

Internally: ownership check (same pattern as `markAsWorn`), DAL insert to `wear_events` with new columns, fire-and-forget `logActivity` with `visibility` in metadata, `revalidatePath('/')`.

### Toast Layer

`sonner` `<Toaster />` goes in root layout, **outside** the `<Suspense>` boundaries:

```tsx
<ThemeProvider>
  <Toaster />    {/* outside Suspense — renders immediately on hydration */}
  <Suspense fallback={<HeaderSkeleton />}>
    <Header />
  </Suspense>
  ...
</ThemeProvider>
```

The Server Action returns `{ success: true, data: { wearEventId } }`. The Client Component (`WywtPhotoForm`) calls `toast.success('Wear logged!')` after detecting success. No server-side toast triggering.

### New Components

| Component | Type | File | Purpose |
|-----------|------|------|---------|
| `WywtPhotoForm` | Client Component | `src/components/home/WywtPhotoForm.tsx` | Step 2 of WYWT post flow |
| `CameraCapture` | Client Component | `src/components/home/CameraCapture.tsx` | `getUserMedia` capture with dotted overlay |
| `WywtPostDialog` | Client Component | `src/components/home/WywtPostDialog.tsx` | Outer dialog shell orchestrating steps 1 → 2 |

`WywtPostDialog` replaces `NavWearButton` (or wraps it). It manages the step machine: open → pick watch → compose form → submit. `WatchPickerDialog` is used in step 1 with the new `onWatchSelected` prop.

### Data Flow

```
BottomNavClient Wear tab tap  (or NavWearButton)
  └─ WywtPostDialog open=true
       └─ Step 1: <WatchPickerDialog onWatchSelected={setSelectedWatch} />
       └─ Step 2: <WywtPhotoForm watch={selectedWatch} />
            ├─ Take Wrist Shot: CameraCapture → Blob → resize → strip EXIF → upload to Storage → storagePath
            ├─ Upload Photo:    file input → heic2any → canvas resize → strip EXIF → upload to Storage → storagePath
            └─ submit: logWearWithPhoto({ watchId, storagePath, note, visibility })
                 → wear_events INSERT (with photo_url, note, visibility)
                 → logActivity fire-and-forget (with visibility in metadata)
                 → revalidatePath('/')
                 → return { success: true }
            └─ success: toast.success('Wear logged!'), close dialog
```

---

## Feature 5: `/explore` Stub Route

### Architecture

Minimal. One new file.

```
src/app/explore/page.tsx   (Server Component)
  → getCurrentUser()   (standard auth check)
  → return <ExploreComingSoon />
```

`ExploreComingSoon` is an inline Server Component (no separate file needed). Renders the standard page shell with "Coming soon" copy. Inherits Header + BottomNav from root layout.

`proxy.ts` — `/explore` is an authed-only route. No change needed.

The BottomNav `Explore` tab links to `/explore`.

---

## Build Order and Dependencies

Dependencies flow bottom-up. Each phase should produce a deployable state.

### Phase 11: Schema + Storage Foundation (prerequisite for everything else)
1. Add `wear_visibility` Postgres enum
2. Add `photo_url`, `note`, `visibility` columns to `wear_events`
3. Backfill `visibility` from `worn_public` on existing rows
4. Create `notifications` table with partial index on `(userId) WHERE readAt IS NULL`
5. Create Supabase Storage bucket `wear-photos` with RLS
6. Enable `pg_trgm` extension and create trgm indexes on `profiles`

**Nothing else can start until this phase is done.**

### Phase 12: Visibility Ripple in DAL (prerequisite for WYWT photo + feed correctness)
1. Update `getPublicWearEventsForViewer` — per-row visibility gate
2. Update `getWearRailForViewer` — per-row visibility gate in JOIN WHERE
3. Update `getFeedForUser` `watch_worn` gate — use `visibility` from activity metadata
4. Update profile worn tab call (layout.tsx) to use viewer-aware function
5. Update `logActivity` call in existing `markAsWorn` to include `visibility` in metadata

**This is the most risky phase. Integration tests for privacy must be written first and run after.**

### Phase 13: Notifications DAL + Actions + Bell (can be parallel with Phase 12 after Phase 11)
1. `src/data/notifications.ts` (all DAL functions)
2. `src/app/actions/notifications.ts` (markAllRead action)
3. Wire `insertNotification` into `follows.ts` and `watches.ts` Server Actions
4. `NotificationBell` Server Component
5. `/notifications` page + `NotificationList` + `MarkAllReadButton`
6. Add bell to desktop Header (Header surgery) + BottomNav unread badge

### Phase 14: Bottom Nav (depends on Phase 13 for unread count DAL)
1. `BottomNav` Server Component + `BottomNavClient` Client Component + `BottomNavSkeleton`
2. Root layout update: add `<Suspense><BottomNav /></Suspense>` and `pb-16 md:pb-0` on `<main>`
3. `WywtPostDialog` outer shell (wraps `WatchPickerDialog` for step-machine orchestration — needed before photo form)
4. Extend `WatchPickerDialog` with `onWatchSelected` prop

### Phase 15: WYWT Photo Form (depends on Phase 11 schema + Phase 12 ripple + Phase 14 dialog orchestration)
1. `CameraCapture` component
2. `WywtPhotoForm` component (no photo first, then add camera)
3. `logWearWithPhoto` Server Action
4. Image utilities (resize, EXIF strip, HEIC convert)
5. `<Toaster />` in root layout
6. Wire storage upload (depends on upload pipeline decision)

### Phase 16: Search (depends only on Phase 11 for pg_trgm)
1. `src/data/search.ts` (`searchProfiles` DAL)
2. `src/app/actions/search.ts` (`searchPeople` Server Action)
3. `SearchClient` + `SearchResultsList` + `SearchResultRow`
4. `/search` page

### Phase 17: Explore Stub (no dependencies)
Can be done anytime after root layout bottom nav is mounted. One file.

---

## Open Architecture Decisions (Must Resolve Before Planning Starts)

**Decision 1: WYWT image upload pipeline direction**

Option A (recommended): Client → Supabase Storage directly → pass storage path to Server Action. EXIF stripping happens in-browser.
Option B: Client → Server Action with file bytes in FormData → server strips EXIF → server uploads to Storage.

Consequences: Option A has simpler bandwidth model and avoids Next.js body size limits but puts EXIF stripping in JS. Option B is architecturally cleaner (secrets stay server) but doubles bandwidth and requires configuring `next.config.ts` body size limit.

**Decision 2: Bottom nav Wear CTA — ownedWatches data fetching**

`BottomNav` needs `ownedWatches` to pass to `WatchPickerDialog` just like `Header` does. Currently `Header` fetches `ownedWatches` via `getWatchesByUser(user.id)`. Two options:

Option A: `BottomNav` calls `getWatchesByUser(user.id)` independently. This duplicates the DB read on every render (root layout fires both Suspense boundaries). Because both are async Server Components inside separate `<Suspense>` boundaries, they run in parallel, not sequentially — the cost is one extra DB query but no latency penalty.
Option B: Introduce a React `cache()`-wrapped shared fetch so both `Header` and `BottomNav` share the same request-scoped result. This is the `getTasteOverlapData` pattern (already used in `src/data/follows.ts` line 261).

Option B is recommended for clean architecture but requires wrapping `getWatchesByUser` with `cache()`.

**Decision 3: Storage bucket visibility — public bucket vs. private bucket + signed URLs**

Option A: Private bucket, signed URLs for all non-`public` visibility wears. Public wears can use a generated public URL (if Supabase public bucket) or also get short-lived signed URLs.
Option B: Public bucket for `public` visibility wears (avoids signed URL overhead for most wears), private bucket for `followers`/`private`. Requires two buckets or a `public-wear-photos` + `private-wear-photos` split.

Option A (single private bucket + signed URLs for all) is recommended for simplicity. Signed URL generation is fast; the complexity of maintaining two buckets is not worth it.

**Decision 4: `worn_public` deprecation timing**

Option A: Deprecate `worn_public` in v3.0 (remove DAL reads of `wornPublic` as part of Phase 12 ripple work, keep column for one more milestone).
Option B: Keep `worn_public` as a master override that, if `false`, overrides per-row `visibility` to effective-`private`. More complex DAL logic but preserves the user's existing global toggle behavior.

Option A is recommended: per-row `visibility` supersedes the global toggle, and the backfill migration ensures no user loses their existing privacy level. The global toggle becomes a UI shortcut that sets all existing rows' visibility when the user changes it — but per-row wins at read time.

**Decision 5: Wear detail overlay / navigation after tap on WYWT tile**

Product brief §5.7 mentions "Wear Detail Overlay (image-first, primary CTA: View Watch)". Is this a modal overlay or a dedicated route (`/wear/[wearEventId]`)? This affects whether signed URL generation happens in the rail DAL (pre-generate on page load) or lazily when the overlay opens. Decision affects Phase 15 scope.

---

## Integration Points Summary

| Existing File | Change Type | What Changes |
|---------------|-------------|--------------|
| `src/app/layout.tsx` | Modify | Add `<BottomNav>` in Suspense, `pb-16 md:pb-0` on `<main>`, `<Toaster />` |
| `src/db/schema.ts` | Extend | Add `wear_visibility` enum, `notifications` table, `wearEvents` new columns |
| `src/data/wearEvents.ts` | Modify (2 functions) | `getPublicWearEventsForViewer` and `getWearRailForViewer` — visibility ripple |
| `src/data/activities.ts` | Modify (1 function) | `getFeedForUser` — `watch_worn` visibility gate from metadata |
| `src/app/u/[username]/layout.tsx` | Modify (1 call site) | Replace `getAllWearEventsByUser` with viewer-aware call for worn tab rendering |
| `src/app/actions/wearEvents.ts` | Extend | Add `logWearWithPhoto` Server Action; update `markAsWorn` to pass `visibility` to `logActivity` |
| `src/app/actions/follows.ts` | Modify | Add `insertNotification` fire-and-forget after `followUser` DAL call |
| `src/app/actions/watches.ts` | Modify | Add watch-overlap notification generation after `addWatch` |
| `src/components/home/WatchPickerDialog.tsx` | Extend (one new prop) | Add `onWatchSelected?: (watch: Watch) => void` for step-machine flow |
| `src/proxy.ts` | No change | `/search`, `/explore`, `/notifications` are all authed-only — no PUBLIC_PATHS additions needed |
| `src/components/layout/Header.tsx` | Modify | Add `NotificationBell` (desktop), slim mobile top bar per product brief §9 |

| New File | Purpose |
|----------|---------|
| `src/db/schema.ts` — `notifications` table | Schema definition |
| `src/data/notifications.ts` | Notifications DAL |
| `src/data/search.ts` | People search DAL |
| `src/app/actions/notifications.ts` | markAllRead Server Action |
| `src/app/actions/search.ts` | searchPeople Server Action |
| `src/app/notifications/page.tsx` | Notifications page |
| `src/app/search/page.tsx` | Search page |
| `src/app/explore/page.tsx` | Explore stub page |
| `src/components/layout/BottomNav.tsx` | Server Component shell |
| `src/components/layout/BottomNavClient.tsx` | Client Component (usePathname, wear dialog) |
| `src/components/layout/BottomNavSkeleton.tsx` | Skeleton for Suspense fallback |
| `src/components/layout/NotificationBell.tsx` | Bell + badge for desktop header |
| `src/components/notifications/NotificationList.tsx` | Notification list renderer |
| `src/components/notifications/NotificationRow.tsx` | Single notification row |
| `src/components/notifications/MarkAllReadButton.tsx` | Client island |
| `src/components/search/SearchClient.tsx` | Client search island |
| `src/components/search/SearchResultsList.tsx` | Results list |
| `src/components/search/SearchResultRow.tsx` | Single result row |
| `src/components/home/WywtPostDialog.tsx` | Outer post flow dialog shell |
| `src/components/home/WywtPhotoForm.tsx` | Step 2 compose form |
| `src/components/home/CameraCapture.tsx` | getUserMedia camera component |

---

## Architecture Pitfalls for v3.0 Specifically

**Pitfall A: Mounting BottomNav above Suspense boundary**
`BottomNav` calls `getCurrentUser()` + DAL functions. If mounted as a sibling to `<ThemeProvider>` or placed outside the `<Suspense>` boundary, it blocks the entire page render. Must be inside `<Suspense>`.

**Pitfall B: Three call sites for WatchPickerDialog diverging**
Three triggers (WYWT rail tile, NavWearButton, BottomNavClient) all open the same dialog. Each new call site is tempting to fork. Do not fork. Extend via props only.

**Pitfall C: Signing URLs in a cached Server Component**
If any wrapper around wear tile rendering is decorated with `'use cache'`, the signed URL embedded in the tile will be served stale (expired). Never cache components that embed signed URLs. Signed URLs must be generated in non-cached, per-request server paths.

**Pitfall D: Missing visibility column in activity metadata**
If `watch_worn` activities are written before `logActivity` is updated to include `visibility` in metadata, the feed query cannot filter correctly without a JOIN to `wear_events` on every feed render. Update `markAsWorn` and `logWearWithPhoto` to pass `visibility` in metadata simultaneously with the schema migration.

**Pitfall E: EXIF stripping gap in browser Option A**
Browser EXIF stripping via ArrayBuffer manipulation requires careful implementation — it is not a single-line operation. The `piexifjs` library (available on npm) handles this reliably. If EXIF stripping is done incorrectly, GPS data leaks to other viewers via photo metadata. This is a privacy-sensitive correctness requirement, not just a nice-to-have.

**Pitfall F: `worn_public` gate and per-row visibility conflict**
During the transition period (before `worn_public` is fully deprecated), two visibility gates exist. If a user has `wornPublic = false` but new wear events have `visibility = 'public'`, the two systems conflict. The backfill migration resolves this for existing rows, but the DAL must be updated so `wornPublic` is NOT checked for new events (post-migration). Stale DAL code reading `wornPublic` after backfill produces silent incorrect results.

---

## Sources

- Existing codebase read directly: `src/app/layout.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/HeaderNav.tsx`, `src/components/layout/MobileNav.tsx`, `src/components/layout/NavWearButton.tsx`, `src/components/home/WatchPickerDialog.tsx`, `src/data/wearEvents.ts`, `src/data/activities.ts`, `src/data/follows.ts`, `src/data/profiles.ts`, `src/db/schema.ts`, `src/app/actions/wearEvents.ts`, `src/app/actions/follows.ts`, `src/lib/auth.ts`, `src/proxy.ts` (HIGH confidence)
- `.planning/PROJECT.md` — v3.0 milestone requirements, established architecture decisions (HIGH confidence)
- `.planning/PRODUCT-BRIEF.md` sections 5.7, 5.8, 5.9, 9 — nav model, search, notifications, WYWT flow (HIGH confidence)

---
*Architecture research for: Horlo v3.0 — Production Nav & Daily Wear Loop*
*Researched: 2026-04-21*

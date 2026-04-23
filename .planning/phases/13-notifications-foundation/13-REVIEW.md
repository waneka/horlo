---
phase: 13-notifications-foundation
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - src/app/actions/follows.ts
  - src/app/actions/notifications.ts
  - src/app/actions/profile.ts
  - src/app/actions/watches.ts
  - src/app/notifications/page.tsx
  - src/app/settings/page.tsx
  - src/components/layout/Header.tsx
  - src/components/notifications/NotificationBell.tsx
  - src/components/notifications/NotificationRow.tsx
  - src/components/notifications/NotificationsEmptyState.tsx
  - src/components/notifications/NotificationsInbox.tsx
  - src/components/settings/SettingsClient.tsx
  - src/data/notifications.ts
  - src/data/profiles.ts
  - src/db/schema.ts
  - src/lib/notifications/logger.ts
  - src/lib/notifications/types.ts
  - supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql
  - tests/actions/follows.test.ts
  - tests/actions/notifications.test.ts
  - tests/actions/watches.test.ts
  - tests/components/notifications/NotificationRow.test.tsx
  - tests/components/notifications/NotificationsEmptyState.test.tsx
  - tests/components/notifications/NotificationsInbox.test.tsx
  - tests/data/getNotificationsForViewer.test.ts
  - tests/data/getNotificationsUnreadState.test.ts
  - tests/integration/phase13-notifications-flow.test.ts
  - tests/integration/phase13-profile-settings-migration.test.ts
  - tests/unit/notifications/logger.test.ts
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-22
**Depth:** standard
**Files Reviewed:** 28 (18 source + 10 test)
**Status:** issues_found

## Summary

Phase 13 (Notifications Foundation) is in overall good shape. The fire-and-forget logger correctly swallows errors, checks opt-out BEFORE insert, and self-guards above the DB CHECK. DAL functions take `viewerId` as an explicit parameter (D-25) with no closures over `getCurrentUser`. The `revalidateTag` two-arg form (`'max'`) is used consistently for Next 16. RLS-equivalent filtering (`WHERE user_id = viewerId`) is present in all DAL reads. The migration is idempotent with `ADD COLUMN IF NOT EXISTS`, has a backfill UPDATE, and post-migration assertions. Dedup index usage via `ON CONFLICT DO NOTHING` is wired correctly through raw SQL on the `watch_overlap` path. NOTIF-08 display-time collapse is implemented and tested. The TEMP marker for Phase 14 nav cleanup is present on the bell placement in `Header.tsx`.

Three warnings found: (1) the D-08 per-row optimistic-read-then-navigate contract is NOT implemented — `NotificationRow` is a plain `<Link>` with no `useOptimistic`/mark-one-read action, which conflicts with `13-03-SUMMARY.md` claim of `client-component-optimistic` tag and 13-03-PLAN Task 1's stated test ("NotificationRow full-row click optimistically marks read then navigates"); (2) one integration test for dedup cannot conclusively prove dedup because it does not seed the prerequisite owner row; (3) the `SettingsClient` component has an unused `username` prop that leaks through the type boundary unnecessarily. Info-level items are small refinements — prop-shape mismatches, a harmless but unnecessary localStorage hydration for a disabled control, and a minor cache-efficiency observation.

## Warnings

### WR-01: D-08 per-row optimistic mark-one-read is not implemented

**File:** `src/components/notifications/NotificationRow.tsx:54-74`
**Issue:** CONTEXT.md D-08 specifies "Per-row click does both: optimistic `read_at = now()` update AND navigate to target. Single tap. Standard inbox UX." The 13-03-PLAN Task 1 lists a RED test case `"NotificationRow full-row click optimistically marks read then navigates (D-08)"`, and the 13-03-SUMMARY tags the work as `client-component-optimistic`. However, the shipped component is a plain `<Link>` with no `useOptimistic`, no `useTransition`, and no mark-one-read Server Action wired through. Rows retain their unread visual treatment until the user hits "Mark all read" (NOTIF-06). Functionally, the system still works — page visit runs `touchLastSeenAt` which clears the bell (D-07) — but per-row read state never flips on click.

There is also no `markOneRead` / `markNotificationRead` Server Action in `src/app/actions/notifications.ts` (only `markAllNotificationsRead` exists), so even a client-side optimistic update would have nothing to call.

**Fix:** Either (a) implement the D-08 optimistic read flow:
```tsx
// src/app/actions/notifications.ts — add:
export async function markNotificationRead(notificationId: string): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
  try {
    await markOneReadForUser(user.id, notificationId) // new DAL fn: WHERE user_id = viewerId (two-layer defense)
    revalidateTag(`viewer:${user.id}`, 'max')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[markNotificationRead] unexpected error:', err)
    return { success: false, error: "Couldn't mark as read." }
  }
}

// src/components/notifications/NotificationRow.tsx — convert to optimistic:
const [optimisticRead, setOptimisticRead] = useOptimistic(row.readAt !== null)
const [isPending, startTransition] = useTransition()
// on click: startTransition(() => { setOptimisticRead(true); markNotificationRead(row.id) })
// Link uses router.push after the optimistic flip so navigate still feels instant.
```
OR (b) explicitly defer D-08 to Phase 14 with a `TODO: D-08 deferred` comment on `NotificationRow.tsx` and update 13-03-SUMMARY to remove the `client-component-optimistic` tag so downstream consumers don't assume it's wired.

### WR-02: Integration dedup test cannot prove dedup — missing owner seed

**File:** `tests/integration/phase13-notifications-flow.test.ts:204-250`
**Issue:** The test `adding same watch twice same UTC day does NOT create second overlap row` calls `addWatch({ brand: 'Omega', model: 'Speedmaster', ... })` twice but never seeds a pre-existing owner (userA) of the same brand/model. Without a pre-existing owner row in `watches`, `findOverlapRecipients` returns `[]`, so zero notifications are created — and the assertion `expect(rows[0]?.c).toBeLessThanOrEqual(1)` is trivially satisfied by `c = 0`. The test PASSES today but would also pass if the dedup UNIQUE index were deleted. It is not actually verifying the dedup behavior.

Also note that in this test both `addWatch` calls happen as the same authenticated user (the Server Action reads auth from cookies/session — there is no visible userA-vs-userB actor switch in this block). Without a user switch and an owner seed, the test never enters the "another collector owns this" path.

**Fix:** Mirror the setup pattern from the prior test (lines 129-172): seed an `INSERT INTO watches (...)` row for userA before userB's `addWatch`, and explicitly sign in as userB for the two addWatch calls. Then assert `c = 1` (exactly one row), not `c <= 1`:
```ts
// Seed userA already owns Omega Speedmaster
await db.execute(sql`INSERT INTO watches (id, user_id, brand, model, status, movement, ...) VALUES (gen_random_uuid(), ${userA.id}::uuid, 'Omega', 'Speedmaster', 'owned', 'manual', ...) ON CONFLICT DO NOTHING`)

// Sign in as userB, then addWatch twice
// ... (auth switch helper — same as pre-existing pattern)
await addWatch({ brand: 'Omega', model: 'Speedmaster', status: 'owned', ... })
await addWatch({ brand: 'Omega', model: 'Speedmaster', status: 'owned', ... })

// Now assert exactly 1 (dedup is load-bearing)
expect(rows[0]?.c).toBe(1)
```

### WR-03: SettingsClient exposes `username` prop but never consumes it

**File:** `src/components/settings/SettingsClient.tsx:26-39`
**Issue:** `SettingsClientProps` declares `username: string`, and the parent (`src/app/settings/page.tsx:37`) resolves and passes `profile?.username ?? ''` — but the component only destructures `{ settings }` and never uses the `username` value. This is dead interface surface that triggers an unnecessary DB fetch (`getProfileById`) in the page, and future callers may assume the value is displayed somewhere.

**Fix:** Either (a) drop the prop and the page-level `getProfileById` fetch if nothing else needs it, or (b) consume it (e.g., in a header "@{username}" label in the settings page). Given the nearby code fetches the profile for this prop only, (a) is likely the lower-effort path:
```tsx
// src/components/settings/SettingsClient.tsx
interface SettingsClientProps {
  settings: {
    profilePublic: boolean
    // ...
  }
}
export function SettingsClient({ settings }: SettingsClientProps) { ... }

// src/app/settings/page.tsx
const settings = await getProfileSettings(user.id)   // drop getProfileById + Promise.all
<SettingsClient settings={{ ... }} />
```

## Info

### IN-01: `updateSettingsSchema` typo in error message path

**File:** `src/app/actions/profile.ts:72`
**Issue:** The error message `'Invalid settings payload'` is fine, but the schema name `updateSettingsSchema` is for visibility + notify opt-outs, while the comment block at line 43-47 mentions "visibility + notification opt-out fields." Consider renaming to `updateVisibilityAndNotifySchema` for clarity, or at minimum a small rename given it now covers two concerns.

**Fix:** Optional rename for readability:
```ts
const updateVisibilityOrNotifyPrefSchema = z.object({ field: z.enum(VISIBILITY_FIELDS), value: z.boolean() }).strict()
```

### IN-02: Mixed payload key casing across notification types

**File:** `src/lib/notifications/types.ts:9-32`, `src/components/notifications/NotificationRow.tsx:137,153`
**Issue:** `WatchOverlapPayload` uses `snake_case` keys (`watch_brand_normalized`, `actor_username`), but `PriceDropPayload` and `TrendingPayload` use `camelCase` (`watchModel`, `actorCount`, `newPrice`). The renderer mirrors both conventions. Since `price_drop` and `trending_collector` are stubs per NOTIF-07 and will not ship write-paths in Phase 13, this is not a functional issue, but it creates inconsistent precedent when the write-paths arrive in a later phase.

**Fix:** Pick one convention (snake_case matches the jsonb payload-at-rest convention used for the two live types) and align the stubs:
```ts
export interface PriceDropPayload {
  watch_model: string
  new_price: string
}
export interface TrendingPayload {
  watch_model: string
  actor_count: number
}
```
Update `NotificationRow.tsx` line 137 and 153 accordingly when the stubs are activated.

### IN-03: `SettingsClient` hydrates a disabled control from localStorage

**File:** `src/components/settings/SettingsClient.tsx:55-65`
**Issue:** The `useEffect` reads `NOTE_DEFAULT_KEY` from localStorage and sets state, but the `<Select>` is `disabled` (line 116 — "Coming soon"). The hydration path is inert for users, so it runs extra code for no observed effect and widens the attack surface for WR-02-style issues (validation of stored enum already exists, good). Not a bug, but unnecessary client work while the control is disabled.

**Fix:** Either move the `useEffect` behind `if (!disabled)` or delete the hydration block until the control is enabled. Minimal change:
```tsx
// Only hydrate from localStorage when the control is enabled
const enabled = false // flip when wiring to insertWatchSchema lands
useEffect(() => {
  if (!enabled) return
  try { ... } catch {}
}, [])
```

### IN-04: Bell cache tag stacking

**File:** `src/components/notifications/NotificationBell.tsx:21`
**Issue:** `cacheTag('notifications', \`viewer:${viewerId}\`)` tags the cached scope with BOTH a global `notifications` tag AND a per-viewer tag. The action `markAllNotificationsRead` invalidates only `viewer:${user.id}` (correct), but the visit-to-inbox page invalidation (`src/app/notifications/page.tsx:41`) also invalidates only the viewer tag. If a future code path calls `revalidateTag('notifications', 'max')`, every viewer's cached bell blows at once — probably fine for throughput, but worth documenting the intent.

**Fix:** Add a one-line comment explaining that the `notifications` global tag is a relief valve for broad invalidations (feature flags, schema migrations), while `viewer:${viewerId}` is the per-viewer invalidation target:
```ts
// Dual-tag: 'notifications' for broad invalidations (migrations, feature-flag flips);
// 'viewer:${viewerId}' for the per-viewer target hit by markAllNotificationsRead and the /notifications page visit.
cacheTag('notifications', `viewer:${viewerId}`)
```

### IN-05: `findOverlapRecipients` comment mentions 30-day window that lives elsewhere

**File:** `src/data/notifications.ts:122-133` + `supabase/migrations/20260423000002_phase11_notifications.sql:82-83`
**Issue:** The migration comment says "The 30-day window is enforced in the Phase 13 Server Action with a pre-insert query; the DB only enforces per-day idempotence." But `addWatch` in `src/app/actions/watches.ts:92-127` does NOT perform a 30-day pre-insert check — it relies solely on the DAL dedup UNIQUE index (which is per-day only) and the `onConflictDoNothing` semantics. If the 30-day semantics were intentionally descoped from Phase 13, the migration comment is stale and will mislead Phase 14+ engineers.

**Fix:** Either add the 30-day check in `addWatch` or update the Phase 11 migration comment to reflect the shipped behavior:
```sql
-- Dedup semantics: "same recipient + same normalized watch + same UTC calendar day = one notification."
-- (A 30-day window was considered but deferred; per-day idempotence is the shipped behavior as of Phase 13.)
```

### IN-06: `NotificationRow` type guard duplicates the discriminated-union type

**File:** `src/components/notifications/NotificationRow.tsx:36-43`
**Issue:** The B-8 guard `if (row.type !== 'follow' && row.type !== 'watch_overlap' && row.type !== 'price_drop' && row.type !== 'trending_collector') return null` duplicates the literal union already declared in `NotificationRowData.type`. If a new type is added to the union, this guard silently drops it instead of failing loudly at compile time. The current behavior is intentional per B-8 ("unknown types render null — silent no-op, never a broken card"), but consider a `const` set + `includes` to reduce drift risk:

**Fix:** Optional — extract the valid set so the union and the runtime guard cannot diverge:
```ts
const VALID_TYPES = ['follow', 'watch_overlap', 'price_drop', 'trending_collector'] as const
type ValidType = typeof VALID_TYPES[number]

// ... inside component:
if (!VALID_TYPES.includes(row.type as ValidType)) return null
```

---

_Reviewed: 2026-04-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

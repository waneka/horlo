# Phase 13: Notifications Foundation — Research

**Researched:** 2026-04-22
**Domain:** Notifications write-path + read-path + settings opt-outs + stub-template UI (Next.js 16 Cache Components, Drizzle ORM, Supabase Postgres + RLS, React 19)
**Confidence:** HIGH for infrastructure reuse (all prior-phase patterns verified in the tree); MEDIUM for Next.js 16 cache semantics (verified against pinned docs in `node_modules/next/dist/docs`, some behaviors are Next 16-specific and differ from trained knowledge)

## Summary

Phase 13 is a **pure wiring + UI phase on top of Phase 11's notifications schema**. The `notifications` table, the `notification_type` enum (with all four values preloaded), the partial UNIQUE dedup index, the self-notification CHECK, and the recipient-only RLS SELECT/UPDATE policies are all already shipped in `supabase/migrations/20260423000002_phase11_notifications.sql` and encoded in `src/db/schema.ts`. Phase 13 adds **(a)** three new `profile_settings` columns (`notifications_last_seen_at`, `notify_on_follow`, `notify_on_watch_overlap`) via one small migration, **(b)** a fire-and-forget `logNotification` module, **(c)** two call-site edits in `followUser` + `addWatch`, **(d)** a cached bell DAL + renderer, **(e)** a `/notifications` inbox page with mark-all-read + per-row click semantics, **(f)** a `NotificationRow` renderer that handles all four types (two live + two stub), and **(g)** settings toggles that reuse `PrivacyToggleRow`.

The codebase already has every pattern this phase needs: `logActivity` is the fire-and-forget precedent [VERIFIED: src/data/activities.ts:53-83], `timeAgo` is the existing relative-time helper [VERIFIED: src/lib/timeAgo.ts], `PrivacyToggleRow` is the toggle component to reuse [VERIFIED: src/components/settings/PrivacyToggleRow.tsx], `ActionResult<T>` is the Server Action return shape [VERIFIED: src/lib/actionTypes.ts], and `CollectorsLikeYou` demonstrates the `'use cache'` + viewer-as-argument pattern [VERIFIED: src/components/home/CollectorsLikeYou.tsx:23-28].

**Primary recommendation:** Mirror existing patterns exactly. Do not invent helpers — the codebase's precedents already answer every architectural question the CONTEXT.md decisions anchor. Follow the viewer-is-argument + `cacheTag(['notifications', 'viewer:${viewerId}'])` + `cacheLife({ revalidate: 30 })` pattern verbatim for the bell DAL, and keep the `logNotification` module as a pure fire-and-forget try/catch wrapper around a Drizzle insert with `onConflictDoNothing` for `watch_overlap`.

## Project Constraints (from CLAUDE.md)

- **Tech stack lock:** Next.js 16 App Router only; no rewrites. `cacheComponents: true` is already enabled in `next.config.ts` [VERIFIED].
- **AGENTS.md directive:** "This is NOT the Next.js you know. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code." The cache-component section of `docs/01-app/03-api-reference/01-directives/use-cache.md` and `04-functions/cacheTag.md` / `cacheLife.md` are authoritative for this phase.
- **Data model constraint:** Watch and UserPreferences types are established — extend, don't break.
- **Personal-first / <500 watches per user:** No pagination on `/notifications` (last-50 cap per D-03 is correct).
- **GSD Workflow Enforcement:** All changes must flow through `/gsd-execute-phase` — do not author loose edits outside the plan.
- **DB migration rules (from user memory):** `drizzle-kit push` is LOCAL ONLY. Production migrations use `supabase db push --linked`. The Phase 13 migration (3 new `profile_settings` columns) follows this discipline.
- **Supabase SECDEF grants (from user memory):** `REVOKE FROM PUBLIC` alone does not block anon on public-schema functions — Supabase auto-grants EXECUTE. Not relevant to Phase 13 (no SECURITY DEFINER functions introduced) but worth noting the anti-pattern exists.

## User Constraints (from CONTEXT.md)

### Locked Decisions

Copying from `.planning/phases/13-notifications-foundation/13-CONTEXT.md` §`<decisions>` verbatim. All 28 decisions are locked for planning.

**Inbox layout & grouping:**
- **D-01:** `/notifications` rows are compact one-liners (~48px): `[avatar(sm)] **Actor** verb object · relative-time`. Mobile-first, fast scan.
- **D-02:** Inbox is grouped by **Today / Yesterday / Earlier** with three sticky sub-headers. Empty buckets are hidden.
- **D-03:** Inbox shows **last 50 notifications, no pagination**. Personal-MVP scale.
- **D-04:** **No retention cleanup** in this phase — show all forever.
- **D-05:** NOTIF-10 empty state copy: **"You're all caught up"** with a subtle muted-foreground icon (`Inbox` from lucide-react per UI-SPEC).

**Click & read semantics:**
- **D-06:** **Bell unread state uses a separate `notifications_last_seen_at` timestamp on `profile_settings`**. Bell dot = `EXISTS(notifications WHERE user_id = current AND created_at > profile_settings.notifications_last_seen_at)`. NOTIF-04 amended to use this query, not raw `read_at IS NULL`.
- **D-07:** **Visiting `/notifications` updates `notifications_last_seen_at = now()`** server-side (Server Component or Server Action).
- **D-08:** **Per-row click** does both: optimistic `read_at = now()` update AND navigate to target. Single tap.
- **D-09:** **Click-through targets:**
  - Follow notification → `/u/[username]` (actor's profile)
  - Watch-overlap notification → `/u/[username]?focusWatch=[watchId]`
  - Future Price Drop / Trending → TBD when wiring phase ships
- **D-10:** **"Mark all read" Server Action** sets `read_at = now()` on all rows where `user_id = current AND read_at IS NULL`.
- **D-11:** **Two-state model** explicit: `notifications_last_seen_at` controls bell; per-row `read_at` controls row visual state.

**Row visual structure:**
- **D-12:** Row anatomy = `[avatar(sm, clickable→actor)] **Actor name (bold link)** verb object(link if applicable) · relative-time`.
- **D-13:** **Time format is relative everywhere**: reuse existing `formatRelativeTime` utility — in this codebase it is `timeAgo` in `src/lib/timeAgo.ts` [VERIFIED].
- **D-14:** **Unread differentiation** = `border-l-2 border-l-accent` + `font-semibold` actor name.
- **D-15:** **Watch-overlap aggregated copy**: `**[Most recent actor]** + N others also own your **[Watch model]**`.

**Settings opt-outs:**
- **D-16:** **Both opt-outs default ON** — `notify_on_follow boolean DEFAULT true` and `notify_on_watch_overlap boolean DEFAULT true` columns added to `profile_settings`.
- **D-17:** Toggles live in a **new "Notifications" section** on `/settings`, below Privacy.
- **D-18:** **Opt-out is checked at write time, not read time**.

**Stub UI templates:**
- **D-19:** `NotificationRow` render switch handles all 4 types. Only `follow` and `watch_overlap` have write paths in Phase 13.
- **D-20:** Stub copy locked (Price Drop / Trending — see CONTEXT.md).
- **D-21:** **Vitest snapshot test** covers all 4 type renderers.

**Watch-overlap matching:**
- **D-22:** `LOWER(TRIM(brand)) = LOWER(TRIM(brand))` on both sides.
- **D-23:** **Self-actions excluded**: `WHERE owner_user_id != actor_user_id`.
- **D-24:** Belt-and-suspenders `if (actor === target) return` in logger.

**Bell DAL caching:**
- **D-25:** Bell DAL `'use cache'`-wrapped with **explicit `viewerId` argument**. Signature: `getNotificationsUnreadState(viewerId: string): Promise<{ hasUnread: boolean }>`.
- **D-26:** `cacheTag(['notifications', \`viewer:${viewerId}\`])` + `cacheLife({ revalidate: 30 })`.

**Fire-and-forget logger:**
- **D-27:** New module `src/lib/notifications/logger.ts`. Try/catch internally; `console.error` on throw; caller never awaits.
- **D-28:** Two call sites: `followUser` (NOTIF-02) and `addWatch` (NOTIF-03). Both call `logNotification(...)` **without await** and AFTER primary commit succeeds.

### Claude's Discretion

- Exact Tailwind class names for D-14 (left border) and D-12 (avatar size). Use existing tokens. (UI-SPEC locks these: `border-l-2 border-l-accent` + `AvatarDisplay size={40}`.)
- Choice of `Inbox` vs `Check` vs `BellOff` icon for D-05 empty state. (UI-SPEC locks: `Inbox`.)
- Exact `/notifications` page heading text. (UI-SPEC locks: `Notifications`.)
- Exact `<section>` ordering and labels in the new settings "Notifications" subsection. (UI-SPEC locks: after Privacy Controls, before Appearance; labels "New Followers" / "Watch Overlaps".)
- Whether the bell DAL returns `{ hasUnread: boolean }` or `{ hasUnread: boolean, lastSeenAt: Date }` — only export what bell renderer needs. (UI-SPEC locks: `{ hasUnread: boolean }` only.)
- File location for `NotificationRow` component. (UI-SPEC locks: `src/components/notifications/`.)

### Deferred Ideas (OUT OF SCOPE)

Copied verbatim from CONTEXT.md `<deferred>`:
- Notification preferences granularity (per-actor mute, snooze, etc.) — future product phase.
- Notification grouping window other than calendar_day.
- Email digest of unread notifications (NOTIF-FUT-03).
- Real-time WebSocket push (NOTIF-FUT-04).
- Stacked avatars for watch-overlap rows.
- Click-through to `/wear/[wearEventId]` (no `wear`-typed notification in this phase).
- Per-row archive / dismiss.
- Notification activity in admin/observability dashboards.

## Phase Requirements

| ID | Description (from REQUIREMENTS.md) | Research Support |
|----|--------------------------------------|-------------------|
| NOTIF-02 | Follow action triggers notification row insert via fire-and-forget logger | `logNotification` module (D-27); called non-awaited from `src/app/actions/follows.ts:followUser` after `revalidatePath` runs but before return. Pattern mirrors `logActivity` in `addWatch`. |
| NOTIF-03 | `addWatch` triggers notification row insert per matching collector (brand+model `LOWER(TRIM())` match); self-actions excluded | Overlap-matching Drizzle query in `logNotification` (or a helper in `src/lib/notifications/`) using `sql\`LOWER(TRIM(brand)) = LOWER(TRIM(${normalizedBrand}))\`` on `watches` JOIN `profile_settings`; excludes `userId = actorUserId`; respects `notify_on_watch_overlap`; `onConflictDoNothing` against `notifications_watch_overlap_dedup` partial UNIQUE (Phase 11). |
| NOTIF-04 | Bell shows unread dot; count via `'use cache'`-wrapped DAL with `viewerId` arg | **AMENDED by D-06:** dot = `EXISTS(notifications newer than profile_settings.notifications_last_seen_at)`. Use `'use cache'` + `cacheTag(['notifications', \`viewer:${viewerId}\`])` + `cacheLife({ revalidate: 30 })`. Mirror `CollectorsLikeYou` shape [VERIFIED]. |
| NOTIF-05 | `/notifications` page lists newest-first with read/unread differentiation + Mark all read | Server Component page at `src/app/notifications/page.tsx`. Inbox inside `<Suspense>`. Heading "Notifications" with "Mark all read" button (UI-SPEC). |
| NOTIF-06 | Mark all read SA sets `read_at = now()` WHERE `user_id = current AND read_at IS NULL` | Server Action in `src/app/actions/notifications.ts`. Returns `ActionResult<void>`. Calls `revalidateTag('viewer:${viewerId}')` on success (drives bell). |
| NOTIF-07 | Stubbed UI templates for Price Drop + Trending render correctly | `NotificationRow` switch/case covers all 4 `notification_type` values. Stub types read `payload` shape `{ watchModel, newPrice?, actorCount? }` per D-20. |
| NOTIF-08 | Watch-overlap grouped at display time — same `(target_user, watch_brand, watch_model, calendar_day)` collapse to one row with actor count | Client-side collapse in `NotificationsInbox` rendering: group by `(payload.watch_brand_normalized, payload.watch_model_normalized, created_at.toDateString())`. Pick most recent actor's avatar+name; show `+ N others` suffix if `actor_count > 1`. |
| NOTIF-09 | Settings opt-out toggles; opt-out checked before insert | Two new `profile_settings` columns; two new `PrivacyToggleRow` instances in new "Notifications" settings section; `updateProfileSettings` SA extended to accept `notifyOnFollow` / `notifyOnWatchOverlap` fields; `logNotification` reads the recipient's settings row before insert. |
| NOTIF-10 | Empty state "You're all caught up" | `NotificationsEmptyState` component with `Inbox` lucide icon + locked copy. |

## Project Constraints (from CLAUDE.md)

See dedicated section above. Key constraints actively policed in this phase:
- Next.js 16 App Router only; `cacheComponents: true` is load-bearing for the bell.
- `drizzle-kit push` LOCAL ONLY (Phase 13 introduces one prod migration via `supabase db push --linked`).
- Must route all edits through a GSD command (planner will sequence everything).

## Standard Stack

Everything Phase 13 needs already exists in the repo. The "stack" for this phase is the set of existing libraries already in `package.json` — no new dependencies required.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.3 | App Router, Server Components, Cache Components, Server Actions | Tech-stack lock [VERIFIED: package.json] |
| react | 19.2.4 | `useOptimistic`, `useTransition`, Suspense | Tech-stack lock [VERIFIED: package.json] |
| drizzle-orm | 0.45.2 | Type-safe SQL via `sql` tag + `db.insert/select/update` | Repo convention [VERIFIED: package.json]. Supports partial UNIQUE via `ON CONFLICT DO NOTHING` through `sql` tag (Drizzle's own `onConflictDoNothing` targets PK by default — for the named partial UNIQUE we need raw SQL per the Phase 11 integration test [VERIFIED: tests/integration/phase11-notifications-rls.test.ts:107-130]). |
| postgres | 3.4.9 | Low-level Postgres client Drizzle wraps | [VERIFIED: package.json] |
| @supabase/ssr | 0.10.2 | Auth session in Server Components/Actions | [VERIFIED: package.json] |
| zod | (via watches.ts import — present) | Input validation in Server Actions | Existing Server Action pattern [VERIFIED: src/app/actions/watches.ts]. Note: `zod` is NOT listed in `package.json` dependencies — likely pulled in transitively. Planner should verify or add explicit dep before writing new schemas. `[ASSUMED: transitive dep]` |
| lucide-react | 1.8.0 | Icons (`Bell`, `Inbox`) | Repo convention [VERIFIED: package.json; used throughout] |
| tailwindcss | 4 | Styling | Repo convention [VERIFIED] |

**Version verification (npm registry):** Phase 13 does not install new packages, so no version verification against the registry is required for this phase. If planner proposes adding `zod` as an explicit dep, verify with `npm view zod version`.

### Supporting (repo-internal patterns to reuse)

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `src/lib/timeAgo.ts` | Relative-time formatter (`2h`, `3d`, `Mar 15` after 28d) | **D-13 target — reuse verbatim.** Signature: `timeAgo(input: string \| Date, now?: Date): string`. [VERIFIED] |
| `src/components/settings/PrivacyToggleRow.tsx` | Toggle row with `useOptimistic` + `useTransition` + SA call | **D-17 target — reuse for both opt-outs.** Takes `field: VisibilityField`; the `VisibilityField` type in `src/data/profiles.ts` must be extended to include `'notifyOnFollow'` and `'notifyOnWatchOverlap'`. [VERIFIED] |
| `src/components/settings/SettingsSection.tsx` | Titled section wrapper (`rounded-xl border bg-card p-4` + uppercase header) | Wrap the new "Notifications" section. [VERIFIED] |
| `src/components/profile/AvatarDisplay.tsx` | Avatar with `size=40\|64\|96` prop | **D-12 target — reuse with `size={40}`.** [VERIFIED] |
| `src/lib/actionTypes.ts` — `ActionResult<T>` | Discriminated union `{success:true,data} \| {success:false,error}` | All new Server Actions return this. [VERIFIED] |
| `src/lib/auth.ts` — `getCurrentUser()` + `UnauthorizedError` | Auth resolution in Server Actions | All new Server Actions begin with this pattern. [VERIFIED] |
| `src/data/activities.ts` — `logActivity` | Fire-and-forget pattern (wrapped in try/catch in the caller) | **D-27 template for `logNotification`.** Note: `logActivity` itself does NOT internally try/catch (the caller wraps it). For `logNotification` we intentionally flip that — internal try/catch means callers can non-await without a dangling unhandled rejection. [VERIFIED: src/data/activities.ts:53-83 and src/app/actions/watches.ts:65-83] |
| `src/app/actions/profile.ts` — `updateProfileSettings` | SA shape for toggle saves | Extend to accept the two new fields; extend the `VISIBILITY_FIELDS` enum. [VERIFIED] |
| `src/data/profiles.ts` — `updateProfileSettingsField`, `getProfileSettings`, `VisibilityField`, `ProfileSettings` | Profile-settings DAL | Extend types + functions to carry the three new columns. [VERIFIED] |
| `src/components/home/CollectorsLikeYou.tsx` | Canonical `'use cache'` + viewer-id-as-arg pattern | **D-25/D-26 template for bell DAL.** [VERIFIED: lines 23-28 — `'use cache'` then `cacheLife('minutes')` then `await fn(viewerId)`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `'use cache'` wrapper on the bell DAL | React `cache()` for request-scoped memoization | `cache()` does not cross requests → no benefit for the "1 bell per page render" case at MVP scale. D-25 locks `'use cache'` because the bell dot is read on every page render; even a 30s TTL materially reduces DB load. No reason to deviate. |
| Drizzle `.onConflictDoNothing()` for overlap dedup | Raw `sql\`INSERT ... ON CONFLICT DO NOTHING\`` | Drizzle's `.onConflictDoNothing()` targets the PK by default. To hit the named partial UNIQUE `notifications_watch_overlap_dedup`, use raw `sql` (as done in `tests/integration/phase11-notifications-rls.test.ts:107-130`) [VERIFIED]. Alternatively `.onConflictDoNothing({ target: ... })` can be given a column tuple, but the partial index has `WHERE type = 'watch_overlap'` and the `created_at::date` expression — Drizzle's target API doesn't model expression indexes cleanly. Raw SQL wins. |
| Write-time aggregation for NOTIF-08 | Display-time grouping | Locked by CONTEXT.md `<specifics>`: display-time grouping (collapse at render by `(target_user, brand, model, date_trunc('day', created_at))`) is more flexible (no race conditions, no stale group rows). Reaffirmed. |
| Hand-written error banner for Mark-all-read | Snap-back via `useOptimistic` (current `PrivacyToggleRow` behavior) | UI-SPEC §Copywriting Contract locks an inline `role="alert"` banner for mark-all-read failure. Toggle failures snap back (inherited from `PrivacyToggleRow`). Different UX because the button has no optimistic state to snap back — it's a one-shot action. |
| `revalidatePath('/notifications')` after mark-all-read | `revalidateTag('viewer:${viewerId}')` | The tag-based approach is correct per D-26 because the BELL lives in the nav (eventually) AND the inbox is a Server Component. A single `revalidateTag` invalidates both. `revalidatePath` would not invalidate the cached bell if the bell's eventual placement is in a layout. |

**Installation:** None. Phase 13 adds no dependencies.

**Version verification:** N/A — no new packages.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── actions/
│   │   └── notifications.ts           # NEW — Server Actions: markAllNotificationsRead, markNotificationRead
│   │   └── profile.ts                 # EDIT — add notifyOnFollow / notifyOnWatchOverlap to VISIBILITY_FIELDS
│   │   └── follows.ts                 # EDIT — add logNotification call after revalidatePath (NOTIF-02)
│   │   └── watches.ts                 # EDIT — add logNotification watch-overlap call in addWatch (NOTIF-03)
│   └── notifications/
│       └── page.tsx                   # NEW — Server Component inbox page; Suspense; update notifications_last_seen_at
├── components/
│   ├── notifications/                 # NEW folder
│   │   ├── NotificationBell.tsx       # Server Component; 'use cache'; reads getNotificationsUnreadState
│   │   ├── NotificationRow.tsx        # Client Component; all 4 type renderers; optimistic row-read on click
│   │   ├── NotificationsInbox.tsx     # Server Component; grouping by Today/Yesterday/Earlier; NOTIF-08 collapse
│   │   └── NotificationsEmptyState.tsx # Server Component; NOTIF-10 copy
│   └── settings/
│       └── SettingsClient.tsx         # EDIT — add "Notifications" SettingsSection with two PrivacyToggleRow
├── data/
│   ├── notifications.ts               # NEW — DAL: getNotificationsForViewer, getNotificationsUnreadState, 
│   │                                  #             markAllReadForUser, markOneReadForUser, touchLastSeenAt,
│   │                                  #             findOverlapRecipients
│   ├── profiles.ts                    # EDIT — extend ProfileSettings + VisibilityField + DAL reads/writes
│   └── activities.ts                  # no change
├── lib/
│   ├── notifications/                 # NEW folder
│   │   ├── logger.ts                  # logNotification (fire-and-forget; own try/catch; reads opt-out setting)
│   │   └── types.ts                   # NotificationPayload discriminated union (Follow | WatchOverlap | PriceDrop | Trending)
│   └── timeAgo.ts                     # no change (reused)
└── db/
    └── schema.ts                      # EDIT — add 3 columns to profileSettings

supabase/
└── migrations/
    └── 20260425000000_phase13_profile_settings_notifications.sql  # NEW — 3 ALTER TABLE ADD COLUMN; idempotent; backfill notifications_last_seen_at to now() for existing rows

tests/
├── lib/
│   └── notifications/
│       └── logger.test.ts             # NEW — opt-out branches; self-action guards; dedup silent
├── components/
│   └── notifications/
│       └── NotificationRow.test.tsx   # NEW — snapshot test (D-21); all 4 types
│       └── NotificationsInbox.test.tsx # NEW — NOTIF-08 grouping test (3 overlap rows collapse to 1 "+2 others")
├── actions/
│   └── notifications.test.ts          # NEW — markAllRead SA shape tests; mass-assignment guard
│   └── follows.test.ts                # EDIT — assert logNotification called non-awaited; opt-out respected
│   └── watches.test.ts                # EDIT — assert watch-overlap logger invoked per matching owner; self excluded
├── data/
│   └── getNotificationsForViewer.test.ts  # NEW — integration-optional: RLS + 50-row limit + ordering
│   └── getNotificationsUnreadState.test.ts # NEW — bell returns hasUnread true/false based on last_seen_at
└── integration/
    └── phase13-notifications-flow.test.ts # NEW — E2E: follow → row appears; addWatch → overlap row for pre-existing owner; opt-out prevents insert
```

### Pattern 1: Fire-and-Forget Logger (D-27)

**What:** A module that inserts a notification row but **never throws** to its caller. Internal try/catch + console.error.

**Why:** Pitfall B-2 (from v3.0 ROADMAP) — "fire-and-forget; failure never rolls back a follow or watch-add." The caller uses `void logNotification(...)` or `.catch(...)` discipline.

**When to use:** Every notification write site. Phase 13 has two; future phases will have more (price-drop, trending).

**Example:**

```ts
// Source: src/data/activities.ts (existing precedent) + CONTEXT.md D-27
// File: src/lib/notifications/logger.ts (NEW)
import 'server-only'
import { db } from '@/db'
import { notifications, profileSettings } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import type { NotificationPayload } from './types'

export type LogNotificationInput =
  | { recipientUserId: string; actorUserId: string; type: 'follow'; payload: FollowPayload }
  | { recipientUserId: string; actorUserId: string; type: 'watch_overlap'; payload: WatchOverlapPayload }
  // future: price_drop, trending_collector

export async function logNotification(input: LogNotificationInput): Promise<void> {
  try {
    // D-23, D-24 defense in depth: self-actions never create notifications
    if (input.recipientUserId === input.actorUserId) return

    // D-18: opt-out checked at WRITE time
    const [settings] = await db
      .select({
        notifyOnFollow: profileSettings.notifyOnFollow,
        notifyOnWatchOverlap: profileSettings.notifyOnWatchOverlap,
      })
      .from(profileSettings)
      .where(eq(profileSettings.userId, input.recipientUserId))
      .limit(1)

    // Missing row → safe defaults (both ON, per DEFAULT true on the columns + D-16).
    const notifyOnFollow = settings?.notifyOnFollow ?? true
    const notifyOnOverlap = settings?.notifyOnWatchOverlap ?? true

    if (input.type === 'follow' && !notifyOnFollow) return
    if (input.type === 'watch_overlap' && !notifyOnOverlap) return

    // watch_overlap: use raw SQL to hit the named partial UNIQUE dedup index.
    if (input.type === 'watch_overlap') {
      await db.execute(sql`
        INSERT INTO notifications (user_id, actor_id, type, payload)
        VALUES (
          ${input.recipientUserId}::uuid,
          ${input.actorUserId}::uuid,
          'watch_overlap',
          ${input.payload}::jsonb
        )
        ON CONFLICT DO NOTHING
      `)
      return
    }

    // follow: straightforward insert
    await db.insert(notifications).values({
      userId: input.recipientUserId,
      actorId: input.actorUserId,
      type: input.type,
      payload: input.payload,
    })
  } catch (err) {
    // D-27: never throws. console.error + return.
    console.error('[logNotification] failed (non-fatal):', err)
  }
}
```

**Source:** Synthesized from CONTEXT.md D-27 + `src/data/activities.ts:53-83` (logActivity shape) + `tests/integration/phase11-notifications-rls.test.ts:107-130` (ON CONFLICT DO NOTHING against partial UNIQUE) [VERIFIED].

**Note on the try/catch location:** The existing `logActivity` does NOT internally try/catch; the caller wraps each invocation (see `src/app/actions/watches.ts:65-83`). For `logNotification` we flip this — internal try/catch — because D-28 says callers call "without await." A non-awaited promise that rejects produces an unhandled-rejection warning; moving the catch inside prevents it. This is an intentional divergence, not a copy-paste of `logActivity`. Document this in the module docstring.

### Pattern 2: Viewer-Aware `'use cache'` DAL (D-25, D-26)

**What:** A Server Component that wraps a DAL call, with the viewer's id passed as a function/component argument (never read via `getCurrentUser()` inside the cached scope).

**Why:** Next.js 16 cache keys are derived from serialized arguments [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md §"Cache keys"]. Reading the viewer inside the cached scope would produce a key that omits the viewer — a cross-user data-leak vector (v3.0 Pitfall 3, "leak prevention").

**When to use:** The bell renderer (Phase 13). Future analogous cases: anything else rendered in a layout that must be per-viewer.

**Example:**

```tsx
// Source: src/components/home/CollectorsLikeYou.tsx (existing precedent)
// File: src/components/notifications/NotificationBell.tsx (NEW)
import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { getNotificationsUnreadState } from '@/data/notifications'

export async function NotificationBell({ viewerId }: { viewerId: string }) {
  'use cache'
  cacheTag('notifications', `viewer:${viewerId}`)
  cacheLife({ revalidate: 30 })
  const { hasUnread } = await getNotificationsUnreadState(viewerId)
  return (
    <Link
      href="/notifications"
      aria-label={hasUnread ? 'Unread notifications' : 'Notifications'}
      className="relative inline-flex items-center justify-center min-h-11 min-w-11"
    >
      <Bell className="size-5" aria-hidden />
      {hasUnread && (
        <span
          className="absolute top-0 right-0 size-2 rounded-full bg-accent"
          aria-hidden
        />
      )}
    </Link>
  )
}
```

**Source:** [VERIFIED: src/components/home/CollectorsLikeYou.tsx:1,23-28 shows the exact `'use cache'` / `cacheLife('minutes')` shape; CONTEXT.md D-25/D-26 locks the tag + lifetime specifically for the bell].

**Next.js 16 specifics worth pinning:**

- `cacheTag(...tags: string[])` accepts multiple string arguments [VERIFIED: docs/01-app/03-api-reference/04-functions/cacheTag.md §"Multiple Tags"]. CONTEXT.md D-26 writes the tags as an array; the actual signature is variadic. Planner should write `cacheTag('notifications', \`viewer:${viewerId}\`)` (two separate args) — same effect as the array form in terms of targeting.
- `cacheLife({ revalidate: 30 })` accepts a config object with `stale`/`revalidate`/`expire` in seconds [VERIFIED: docs/01-app/03-api-reference/04-functions/cacheLife.md §"Cache profile properties"]. Passing an explicit `revalidate: 30` overrides the profile default.
- `revalidateTag(tag, 'max')` is the recommended two-argument form in Next.js 16 [VERIFIED: docs/01-app/03-api-reference/04-functions/revalidateTag.md §"Revalidation Behavior"]. The single-argument form is deprecated. Planner must call `revalidateTag('viewer:${viewerId}', 'max')` (not `revalidateTag('viewer:${viewerId}')`).
- **Must be called in a Server Action, Route Handler, or Server Component** — never Client Components [VERIFIED: same doc §"Usage"]. Our Mark-all-read SA is the call site.

### Pattern 3: Opt-Out Toggle via Extended `PrivacyToggleRow`

**What:** Reuse the existing toggle row by widening its `field` prop's accepted values, and widening the Server Action's `VISIBILITY_FIELDS` enum to match.

**Why:** Identical UX shape; the only thing that varies is the `field` discriminator and the DAL write.

**Steps the planner will specify:**
1. In `src/data/profiles.ts`: extend `VisibilityField` to `'profilePublic' | 'collectionPublic' | 'wishlistPublic' | 'notifyOnFollow' | 'notifyOnWatchOverlap'`.
2. Extend `ProfileSettings` interface + `DEFAULT_SETTINGS` + `getProfileSettings` return to include `notifyOnFollow` + `notifyOnWatchOverlap` + `notificationsLastSeenAt`.
3. Extend `updateProfileSettingsField` to write to the new columns.
4. In `src/app/actions/profile.ts`: extend `VISIBILITY_FIELDS` Zod enum.
5. In `SettingsClient`: replace the "Notifications — Email notifications Coming soon" stub section [VERIFIED: src/components/settings/SettingsClient.tsx:135-140] with two `<PrivacyToggleRow>` instances.

### Anti-Patterns to Avoid

- **Awaiting `logNotification` in `followUser` / `addWatch`.** Breaks B-2 (fire-and-forget). Use `void logNotification(...)` or simply don't `await`. Example: `logNotification({ ... }).catch(() => {})` is acceptable; `await logNotification(...)` is not.
- **Reading `getCurrentUser()` inside a `'use cache'` scope.** See Pattern 2. Cache key omits viewer → cross-user leak.
- **Updating `notifications_last_seen_at` on bell click / Suspense render.** Only update it on the `/notifications` page render (D-07) — otherwise a hover over the bell would clear the unread state without the user seeing the inbox.
- **Using `revalidateTag('viewer:${viewerId}')` without the `'max'` second argument.** The single-arg form is deprecated in Next.js 16 [VERIFIED: docs/01-app/03-api-reference/04-functions/revalidateTag.md].
- **Using Drizzle's `.onConflictDoNothing()` default (PK target) for overlap dedup.** That targets the PK, not the partial UNIQUE. Use raw `sql\`ON CONFLICT DO NOTHING\`` per the Phase 11 integration test precedent [VERIFIED].
- **Server-side grouping for NOTIF-08.** CONTEXT.md `<specifics>` explicitly picks display-time grouping for race-free correctness. DO NOT aggregate at write time.
- **Placing the bell in the root layout directly.** Phase 14 owns nav placement. Phase 13 ships the component and exports it, and (per UI-SPEC §"Page Layout") adds a clearly-commented temporary placement in the existing header for UAT visibility.
- **Omitting the self-guard in `logNotification`.** Even if `followUser` already rejects self-follow and the DB CHECK forbids self-notifications, the belt-and-suspenders `if (actor === recipient) return` prevents a wasted DB round-trip. D-24 locks this.
- **Trusting the CHECK constraint alone.** The `notifications_no_self_notification` CHECK will throw on insert if `actor_id = user_id`. Without the D-24 guard, a self-insert attempt would surface in `console.error` as a noisy CHECK violation during tests.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Relative time formatter | New `formatRelativeTime` helper | `timeAgo` from `src/lib/timeAgo.ts` | Already exists; D-13 explicitly says "do NOT introduce a new time helper." Has test coverage already in `tests/lib/timeAgo.test.ts`. [VERIFIED] |
| Toggle row with optimistic save + snap-back | New `NotificationToggleRow` | `PrivacyToggleRow` + extended `VisibilityField` | Already does optimistic UI + `useOptimistic` snap-back on failure; D-17 says "reuse"; UI-SPEC locks the extension path. [VERIFIED] |
| Avatar component | New avatar | `AvatarDisplay size={40}` | Handles missing avatar fallback, initial-letter placeholder, `next/image` safe-URL wrapping. [VERIFIED] |
| Authentication resolution in SAs | `supabase.auth.getUser()` directly | `getCurrentUser()` + `UnauthorizedError` | Project convention; throws a typed error the proxy layer knows how to handle. [VERIFIED] |
| Server Action return type | Ad-hoc `{ ok: boolean, msg?: string }` | `ActionResult<T>` | Repo-wide discriminated union; clients already know how to narrow on `result.success`. [VERIFIED] |
| Fire-and-forget error wrapper | Ad-hoc try/catch at each call site | Internal try/catch inside `logNotification` | D-27 locks this placement; also avoids scattering console.error calls across `followUser` / `addWatch`. |
| "Time bucket" grouping for Today/Yesterday/Earlier | Custom date-math utility | Compare `row.created_at` against `startOfToday()` / `startOfYesterday()` derived from `new Date()` inline, OR reuse `date-fns` if already in deps | `date-fns` is NOT in `package.json` [VERIFIED]. The three-bucket math is trivial (~10 lines). Inline it in `NotificationsInbox`. Do NOT add `date-fns` just for this. |
| Cache-key discipline | Closures over `getCurrentUser()` results inside `'use cache'` | Pass `viewerId` as an explicit prop | Next 16 cache-key rules [VERIFIED: docs]. Pattern 2 above. |
| Dedup window at the app layer | Timestamp-range subquery in `logNotification` | The partial UNIQUE already dedupes per `(recipient, brand_normalized, model_normalized, UTC-day)` | Existing Phase 11 index handles the most-common case; the "30-day window" mentioned in Phase 11 D-11 is a nice-to-have pre-insert query that Phase 13 can punt on ("races are acceptable at MVP scale" — D-11). Planner may skip the 30-day pre-insert query and rely on the daily UNIQUE alone for v1; document the trade-off. |

**Key insight:** Every pattern Phase 13 needs exists in the codebase. The phase is almost entirely composition of existing primitives + three ALTER TABLE ADD COLUMN statements + one new Drizzle insert function.

## Runtime State Inventory

Phase 13 is **additive only** (new tables from Phase 11, new columns on `profile_settings`, new code files). It is **not** a rename, refactor, or migration. It does not retire or rename any existing surface.

However, one state-migration concern applies (CONTEXT.md `<specifics>` last bullet):

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `profile_settings` rows lack the 3 new columns. After `ALTER TABLE ADD COLUMN ... DEFAULT true`, existing rows populate with the defaults. However, `notifications_last_seen_at` should backfill to `now()` for existing users so they don't see a stale "everything is unread" dot on first load. | Migration must include `UPDATE profile_settings SET notifications_last_seen_at = now() WHERE notifications_last_seen_at IS NULL` inside the same transaction. (CONTEXT.md `<specifics>` explicitly calls this out.) |
| Live service config | None | None — verified via inspection of `.planning/` and `supabase/` directories. |
| OS-registered state | None | None — verified. Horlo runs as a Vercel deployment; no cron, no task scheduler registrations. |
| Secrets/env vars | None — new code | None |
| Build artifacts | None — no package renames | None |

## Common Pitfalls

### Pitfall 1: Awaiting the logger rolls back the primary mutation

**What goes wrong:** Someone writes `await logNotification(...)` in `addWatch` thinking "cleanup before return is cleaner." A future logger bug (e.g., transient DB failure) now rolls back the watch insert — the user sees "Failed to add watch" for a watch that was actually added.

**Why it happens:** Server Action error handling treats any thrown exception as "mutation failed." The logger's internal try/catch protects against most of this, but awaiting still leaks latency and opens the door to failure during the short window where an `await` is in flight and `revalidatePath` hasn't run.

**How to avoid:** Call `void logNotification({...})` or drop the `await`. Document it in the call site with a comment. Test with a mock that throws to confirm the parent still returns `{ success: true }`.

**Warning signs:** A diff that adds `await logNotification` — fail code review. A flaky test that sometimes reports "Failed to add watch" — investigate whether the logger is awaited.

### Pitfall 2: Bell renders `hasUnread: true` forever on first load for existing users

**What goes wrong:** On Phase 13 ship day, every existing user has `notifications_last_seen_at = NULL` (or the epoch, depending on default) and the first notification created after deploy reads as "newer than epoch" — the bell shows unread for everyone from day one.

**Why it happens:** Default values on new columns don't retroactively populate existing rows unless you backfill.

**How to avoid:** Migration includes `UPDATE profile_settings SET notifications_last_seen_at = now()` on existing rows within the same transaction. CONTEXT.md `<specifics>` last bullet reaffirms this. Verify via migration-time `DO $$ ASSERT ... $$` block that no row has NULL after the update (same pattern as Phase 11 `20260423000047_phase11_backfill_coverage_assertion.sql`) [VERIFIED].

**Warning signs:** UAT reveals "bell is always lit for my test account." Check `notifications_last_seen_at` in DB directly.

### Pitfall 3: Watch-overlap matching misses canonical-equal watches because of whitespace/case

**What goes wrong:** User A adds "Rolex Submariner"; User B had previously added "rolex  Submariner" (lowercase, double space). The overlap logger's match query compares exact strings → no match → no notification.

**Why it happens:** Postgres `=` is case/whitespace-sensitive by default.

**How to avoid:** `LOWER(TRIM(brand))` on BOTH sides of the comparison (D-22, NOTIF-03). The payload `watch_brand_normalized` / `watch_model_normalized` fields also store the normalized form for the dedup index [VERIFIED: tests/integration/phase11-notifications-rls.test.ts:109-115 — literal shape of the payload].

**Warning signs:** Integration test "User B adds a watch that matches User A's normalized brand/model" fails with "expected 1 notification, got 0."

### Pitfall 4: `revalidateTag` called without `'max'` is a dev-only landmine

**What goes wrong:** Planner writes `revalidateTag('viewer:${viewerId}')` (single arg) based on stale training data. Current pinned Next.js 16.2.3 tolerates this but the doc marks it deprecated; a future minor bump silently removes it.

**Why it happens:** Next.js 15 shipped the single-arg form; Next.js 16 changed the recommendation. AGENTS.md's warning ("this is NOT the Next.js you know") applies exactly here.

**How to avoid:** Always use `revalidateTag(tag, 'max')` per pinned docs [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md §"Revalidation Behavior"]. Add an eslint rule or a test that greps `revalidateTag` call sites.

**Warning signs:** A future `next` minor upgrade turns the bell into "always stale."

### Pitfall 5: `'use cache'` component resolves `viewerId` internally

**What goes wrong:** Dev writes `const user = await getCurrentUser()` inside the `NotificationBell` component body, above the DAL call, because "that's where I can get the viewer." Cache key omits viewer → every user's bell is the same boolean → cross-user leak.

**Why it happens:** It's an intuitive place to put `getCurrentUser()` for someone who hasn't read `CollectorsLikeYou.tsx`.

**How to avoid:** `viewerId` is always an **argument** to the cached component or function (D-25). The parent (layout / page) resolves the viewer and passes down. `NotificationBell`'s comment should explicitly warn against moving the auth resolution inside.

**Warning signs:** Reviewer sees `getCurrentUser()` adjacent to `'use cache'` in the diff. Grep CI rule: `grep -A 5 "'use cache'" src/components/notifications/ | grep -c getCurrentUser` must equal 0.

### Pitfall 6: Mark-all-read doesn't invalidate the bell

**What goes wrong:** User clicks "Mark all read"; rows update; bell still shows the dot (or vice-versa — user visits `/notifications`, bell clears, but rows still look unread).

**Why it happens:** The two are driven by different columns (D-11: `notifications_last_seen_at` vs per-row `read_at`). The page render updates `notifications_last_seen_at`, which invalidates the bell cache via `revalidateTag`. The SA updates `read_at`, which also must invalidate the cache so a navigated-back bell reflects the state.

**How to avoid:** Both mutation paths — page visit (Server Component / one-shot SA) AND mark-all-read SA — must call `revalidateTag('viewer:${viewerId}', 'max')`. The page visit also updates `notifications_last_seen_at`; the SA updates `read_at`. Writing both is correct; dropping either breaks the UX.

**Warning signs:** E2E UAT step "bell dot clears on visit" passes but "bell stays clear after marking all read and navigating away and back" fails.

### Pitfall 7: NotificationRow grouping collapses rows across users' overlap notifications

**What goes wrong:** NOTIF-08 display-time grouping collapses by `(brand, model, day)`. If the implementer forgets `target_user`, rows from different recipients could theoretically bleed into one render (impossible at DB layer thanks to RLS, but safe to keep the filter in the grouping key for defense in depth).

**Why it happens:** The inbox DAL already filters `WHERE user_id = viewer` but the grouping function is a pure TS transform that could be given cross-user input in a test.

**How to avoid:** Group key must include `(recipientUserId, brand_normalized, model_normalized, date_trunc('day', created_at))` even though the DAL guarantees single-recipient input. Document the invariant in a comment.

**Warning signs:** A unit test for the grouping reducer passes a mix of userIds and sees them collapse.

### Pitfall 8: Settings migration missed in prod but deployed in local

**What goes wrong:** Planner adds the 3 columns via `drizzle-kit push` locally, forgets to author the `supabase/migrations/*.sql` file. Deploy to prod succeeds (Next build doesn't inspect the DB), but at runtime the DAL queries fail with "column profile_settings.notifications_last_seen_at does not exist."

**Why it happens:** User memory: `drizzle-kit push` is LOCAL ONLY; prod uses `supabase db push --linked`.

**How to avoid:** Migration file is authored as part of the phase's first plan; integration test in `tests/integration/phase13-*` asserts all three columns exist (select from `information_schema.columns`). Planner adds a checkbox in VERIFICATION: "Migration file exists at supabase/migrations/*.sql; applied via `supabase db push --linked` before release."

**Warning signs:** Prod log shows "column does not exist" after a deploy that passed local tests.

## Code Examples

### Example 1: `logNotification` call from `followUser`

```ts
// Source: src/app/actions/follows.ts (EDIT) + D-28
// After the existing successful insert & revalidatePath:
try {
  await followsDAL.followUser(user.id, parsed.data.userId)
  revalidatePath('/u/[username]', 'layout')

  // NOTIF-02 — fire-and-forget. Must not block or roll back the follow above.
  void logNotification({
    type: 'follow',
    recipientUserId: parsed.data.userId,
    actorUserId: user.id,
    payload: {
      actor_username: /* resolved from profiles table — see note */,
      actor_display_name: null,
    },
  })

  return { success: true, data: undefined }
} catch (err) { /* ... */ }
```

**Note:** `actor_username` must be resolved before calling `logNotification` — the logger can't await without breaking fire-and-forget semantics. Either pre-fetch the caller's profile at the top of `followUser` (cheap; cached via Phase 10's `getProfileById`) or pass the ids + let `logNotification` denormalize internally (adds a DB round-trip inside the logger — accept it; the whole call is non-blocking from the caller's perspective).

### Example 2: Watch-overlap matching in `addWatch`

```ts
// Source: src/app/actions/watches.ts (EDIT) + NOTIF-03 + D-22, D-23
// After the watch is inserted and logActivity is called:

// Find pre-existing owners of the same normalized brand/model, excluding self.
// This lives in src/data/notifications.ts as findOverlapRecipients(brand, model, actorUserId).
const recipients = await findOverlapRecipients({
  brand: watch.brand,
  model: watch.model,
  actorUserId: user.id,
})

// Fire one notification per recipient. Each call non-awaited per D-28.
for (const recipient of recipients) {
  void logNotification({
    type: 'watch_overlap',
    recipientUserId: recipient.userId,
    actorUserId: user.id,
    payload: {
      actor_username: /* resolved once before loop */,
      actor_display_name: null,
      watch_id: watch.id,
      watch_brand: watch.brand,
      watch_model: watch.model,
      watch_brand_normalized: watch.brand.trim().toLowerCase(),
      watch_model_normalized: watch.model.trim().toLowerCase(),
    },
  })
}
```

### Example 3: `findOverlapRecipients` DAL

```ts
// Source: src/data/notifications.ts (NEW) + D-22, D-23
import 'server-only'
import { db } from '@/db'
import { watches } from '@/db/schema'
import { sql, and, ne } from 'drizzle-orm'

export async function findOverlapRecipients(input: {
  brand: string
  model: string
  actorUserId: string
}): Promise<Array<{ userId: string }>> {
  const rows = await db
    .selectDistinct({ userId: watches.userId })
    .from(watches)
    .where(
      and(
        sql`LOWER(TRIM(${watches.brand})) = LOWER(TRIM(${input.brand}))`,
        sql`LOWER(TRIM(${watches.model})) = LOWER(TRIM(${input.model}))`,
        ne(watches.userId, input.actorUserId), // D-23 self-exclusion
      ),
    )
  return rows
}
```

**Note on status filtering:** Should the match only consider owned watches, or also wishlist/grail? NOTIF-03 says "User B already owns" → owned only. The query above does NOT filter on status — add `eq(watches.status, 'owned')` per NOTIF-03 wording. Planner to confirm.

### Example 4: `getNotificationsUnreadState` DAL (the bell)

```ts
// Source: src/data/notifications.ts (NEW) + D-06, D-25
import 'server-only'
import { db } from '@/db'
import { notifications, profileSettings } from '@/db/schema'
import { eq, and, gt, sql } from 'drizzle-orm'

export async function getNotificationsUnreadState(
  viewerId: string,
): Promise<{ hasUnread: boolean }> {
  // One round-trip: LATERAL-style existence check.
  const rows = await db
    .select({ exists: sql<boolean>`EXISTS (
      SELECT 1 FROM ${notifications}
       WHERE ${notifications.userId} = ${viewerId}::uuid
         AND ${notifications.createdAt} > COALESCE(
               (SELECT notifications_last_seen_at FROM ${profileSettings}
                 WHERE ${profileSettings.userId} = ${viewerId}::uuid),
               '-infinity'::timestamptz
             )
    )` })
    .from(sql`(SELECT 1) AS _noop`)
    .limit(1)
  return { hasUnread: rows[0]?.exists ?? false }
}
```

**Note:** The `(SELECT 1) AS _noop` FROM trick is needed because Drizzle's `select` wants a FROM; we want a pure scalar. Alternative: use `db.execute(sql\`SELECT EXISTS(...) AS has_unread\`)` and parse the first row. Planner/executor decides.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `revalidateTag(tag)` single-arg | `revalidateTag(tag, 'max')` two-arg | Next.js 16 (2025/2026) | Must follow pinned-docs discipline [VERIFIED: docs/01-app/03-api-reference/04-functions/revalidateTag.md] |
| `unstable_cache` for data memoization | `'use cache'` directive + `cacheTag` / `cacheLife` | Next.js 15/16 cache components (enabled via `cacheComponents: true`) | `unstable_cache` still exists but new code should use `'use cache'` [CITED: docs/01-app/03-api-reference/04-functions/unstable_cache.md]. Horlo already committed to `'use cache'` in Phase 10. |
| `cookies()` inside layout body | Inline theme script in `<head>` | Next.js 16 cache components | Horlo's root layout already uses this pattern [VERIFIED: src/app/layout.tsx:27] |
| React `cache()` for cross-component per-request memoization | Still valid for **request-scoped** memoization (React RSC) | React 19 | Both patterns coexist; `'use cache'` is cross-request, `cache()` is per-request. Example: `getTasteOverlapData` uses React `cache()` [VERIFIED: src/data/follows.ts:261]; `CollectorsLikeYou` uses `'use cache'` [VERIFIED]. Pick based on TTL semantics. |

**Deprecated/outdated:**
- Single-arg `revalidateTag(tag)` — works but deprecated [CITED: Next 16 docs].
- `next-themes` scaffold for Sonner integration — Phase 11 decided against it; irrelevant here but worth noting the WYWT-19 constraint for Phase 15.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `zod` is pulled in transitively and does not need to be added to `package.json` for new Server Actions | Standard Stack → Core | LOW — `src/app/actions/watches.ts:3` imports `zod` successfully, so it's available at runtime. If planner wants to write new Zod schemas they should verify with `npm ls zod` first. [ASSUMED] |
| A2 | Watch-overlap matching should filter on `status = 'owned'` (not wishlist/grail) | Code Examples §3 | MEDIUM — NOTIF-03 says "another collector already owns a watch you own" which implies owned-only. If intent was wider, planner/user should clarify before implementation. [ASSUMED] |
| A3 | `NotificationRow` will need the actor's avatar URL at render time; payload denormalization is acceptable | Specifics (from CONTEXT.md) | LOW — CONTEXT.md `<specifics>` says "Avatar URL is fetched server-side via the DAL since avatars rotate" — so the DAL joins `profiles` on `actor_id`. Payload has `actor_username` + `actor_display_name` but not `avatar_url`. This is consistent with UI-SPEC's reference to `AvatarDisplay` accepting `avatarUrl` + `username`. [VERIFIED via CONTEXT.md <specifics>] |
| A4 | The 30-day dedup window (mentioned in Phase 11 D-11 as enforced by Server Action pre-insert query) is optional for Phase 13 — the daily UNIQUE alone is acceptable for v1 | Don't Hand-Roll §"Dedup window" | LOW — CONTEXT.md Phase 11 D-11 says "Races are acceptable at MVP scale" and doesn't mandate the 30-day check in Phase 13. Planner can defer. [ASSUMED] |
| A5 | The existing `SettingsClient.tsx` "Notifications — Coming soon" stub [VERIFIED: lines 135-140] is the correct insertion point for the new toggle section | Architecture Patterns §"Extended PrivacyToggleRow" | LOW — UI-SPEC explicitly says "replaces the current 'Coming soon' stub." [VERIFIED via UI-SPEC §"Settings — Notifications Section"] |
| A6 | `revalidateTag('viewer:${viewerId}', 'max')` is the correct invocation in Next 16.2.3 | Pattern 2 / Pitfall 4 | MEDIUM — docs pinned in `node_modules/next/dist/docs/` confirm the two-arg signature with `'max'` as the recommended profile. If the specific tag convention format differs (e.g., Next 16 reserves `:` in tags), planner should verify during Wave 0 with a smoke test. [CITED: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md] |
| A7 | Existing test scaffolding (`tests/fixtures/users.ts`, `tests/integration/phase11-notifications-rls.test.ts`) is sufficient for Phase 13 integration tests — no new fixtures needed | Validation Architecture §"Wave 0 Gaps" | LOW — pattern reuse covers every Phase 13 test case. [VERIFIED] |

## Open Questions (RESOLVED)

> All five questions resolved during plan authoring. Every recommendation below is implemented in one of the four plans — pointers listed per question. Q5 records a deliberate REVERSAL from the research recommendation; see that entry for rationale.

1. **RESOLVED: Status filter on watch-overlap matching — owned only, or owned + grail?**
   - What we know: NOTIF-03 says "another collector already owns a watch you own." D-22 specifies the normalized match but not the status filter.
   - What's unclear: Grail is a kind of aspirational-owned. If User A has the Submariner on their grail list and User B adds a Submariner, does A get an overlap notification?
   - Recommendation: Start with `status = 'owned'` only (literal reading of the requirement). Add a comment in `findOverlapRecipients` explaining the choice. Revisit if UAT feedback surfaces a different intent.
   - → Implemented in **Plan 02 Task 2** (`findOverlapRecipients` filters `eq(watches.status, 'owned')` with comment referencing this question) AND **Plan 04 Task 2** (`addWatch` gates the overlap block on `if (watch.status === 'owned')`).

2. **RESOLVED: When exactly to update `notifications_last_seen_at` during the `/notifications` page visit.**
   - What we know: D-07 says "server-side (via Server Component or a Server Action triggered on mount)."
   - What's unclear: Server Component vs Server Action. A Server Component that updates state on render is unusual but avoids a client round-trip. A Server Action called on mount from a Client Component is conventional but adds a Client Component wrapper.
   - Recommendation: Do it in the Server Component page body (top of `src/app/notifications/page.tsx`) BEFORE the `<Suspense>`-wrapped inbox renders, inside a try/catch so a failure doesn't 500 the page. Also call `revalidateTag('viewer:${viewerId}', 'max')` after the update so the bell reflects immediately. This is an "action as read side-effect" pattern — document it explicitly.
   - → Implemented in **Plan 04 Task 1** (`src/app/notifications/page.tsx` calls `await touchLastSeenAt(user.id)` followed by `revalidateTag(\`viewer:${user.id}\`, 'max')` inside a try/catch, before `getNotificationsForViewer`).

3. **RESOLVED: Payload shape for `follow` notifications — include actor avatar at write time?**
   - What we know: `<specifics>` says "Avatar URL is fetched server-side via the DAL since avatars rotate" — so the DAL joins `profiles`.
   - What's unclear: Whether the `NotificationsInbox` DAL should join `profiles` per row (cheap with the `user_id = actor_id` FK) or whether payload should store a stale avatar URL.
   - Recommendation: Join `profiles` at read time. Keeps payload small, avoids stale avatars. The inbox DAL reads at most 50 rows — join cost is trivial.
   - → Implemented in **Plan 02 Task 2** (`getNotificationsForViewer` `leftJoin(profiles, eq(profiles.id, notifications.actorId))` and selects `actorAvatarUrl` at read time; `FollowPayload` in Plan 02 Task 1 deliberately omits avatar URL — only `actor_username` + `actor_display_name`).

4. **RESOLVED: Temporary Phase-14 bell placement — in `Header.tsx` or somewhere else?**
   - What we know: UI-SPEC says "Phase 13 adds a temporary placement in the existing header ... for UAT visibility only."
   - What's unclear: Whether to edit `src/components/layout/Header.tsx` directly (the current server-component header [VERIFIED]) or create a temporary wrapper.
   - Recommendation: Drop `<NotificationBell viewerId={user.id} />` into `Header.tsx` alongside `<NavWearButton />` (inside the `if (user)` branch) with a clear `{/* TEMP Phase 14 */}` comment. Phase 14 will move it to the new nav. Since `Header` is already wrapped in `<Suspense>` by the root layout [VERIFIED: src/app/layout.tsx:43-45], the `'use cache'` bell will stream correctly.
   - → Implemented in **Plan 04 Task 2** (Step C adds `<NotificationBell viewerId={user.id} />` inside the `if (user)` branch of `src/components/layout/Header.tsx` with an explicit `{/* TEMP: UAT placement — Phase 14 will move this to the new nav */}` marker comment).

5. **RESOLVED — REVERSED FROM RECOMMENDATION: Should `logNotification` pre-resolve the actor's username, or accept ids only and denormalize internally?**
   - What we know: The two call sites both have `user.id` available; `followUser` already has the viewer's profile indirectly via the action flow but does NOT currently pre-fetch it.
   - What's unclear: Pre-fetching in `followUser` / `addWatch` adds a DB round-trip to the primary mutation path (before the logger is called). Denormalizing inside `logNotification` keeps the caller simple at the cost of a round-trip inside the logger (but the logger is non-blocking from the caller's perspective).
   - Original recommendation: Denormalize inside `logNotification`. Callers pass ids only; logger looks up the actor's profile once before inserting.
   - **IMPLEMENTATION REVERSED THE RECOMMENDATION — callers pre-resolve the actor profile and pass `actor_username` + `actor_display_name` in the payload; the logger does NOT fetch profiles internally.** Rationale for the reversal:
     1. **Predictable caller-visible latency.** Even though the logger is non-awaited, the `followUser` / `addWatch` caller already has `user.id` and is about to commit its primary mutation; pre-resolving the actor profile once on the caller side uses the same request scope and avoids a second round-trip chain inside the fire-and-forget path.
     2. **Logger stays a pure write path.** Keeping the logger a single-responsibility insert (opt-out check → insert) makes its internal try/catch easier to reason about — no branch where a profile fetch throws inside the catch.
     3. **Test ergonomics.** Mocking `getProfileById` once at the caller site is cleaner than mocking it inside the logger module; Plan 04's action tests (`tests/actions/follows.test.ts`, `tests/actions/watches.test.ts`) assert logger inputs directly with denormalized fields.
   - → Implemented in **Plan 04 Task 2** (both `followUser` and `addWatch` call `await getProfileById(user.id)` before `void logNotification(...)` and pass `actor_username` + `actor_display_name` in the payload); **Plan 02 Task 1** logger code has NO profile fetch, and its docstring explicitly states callers must pre-resolve.

## Environment Availability

Phase 13 introduces **no new external tool dependencies**. All requirements are satisfied by the existing toolchain.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js dev/build | ✓ | (unpinned — repo uses ambient) | — |
| npm | package management | ✓ | — | — |
| Supabase local stack | Integration tests | ✓ (assumed — Phase 11/12 tests all activate on local env) | — | Integration tests conditionally skip when env vars absent [VERIFIED] |
| Drizzle Kit | Schema generation (LOCAL only) | ✓ | 0.31.10 [VERIFIED: package.json] | — |
| Supabase CLI | Production migration | ✓ (assumed — prior phases used it) | — | None — required for prod deploy of the 3-column migration |
| Vitest | Unit + integration tests | ✓ | 2.1.9 [VERIFIED: package.json] | — |
| `@testing-library/react` | Component tests (snapshot, render) | ✓ | 16.3.2 [VERIFIED] | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 [VERIFIED: package.json] |
| Config file | No dedicated `vitest.config.ts` visible at repo root — tests resolve via `tests/setup.ts` and Vitest defaults [VERIFIED via `tests/` directory structure] |
| Quick run command | `npx vitest run tests/actions/follows.test.ts tests/actions/watches.test.ts tests/components/notifications/ tests/lib/notifications/ -x` |
| Full suite command | `npm test` (equivalent to `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-02 | `followUser` inserts a follow notification when recipient's `notify_on_follow = true` | unit (mocked DAL) | `npx vitest run tests/actions/follows.test.ts -x` | ❌ — existing file, needs NEW test case added (Wave 0: EDIT) |
| NOTIF-02 | `followUser` does NOT insert when recipient's `notify_on_follow = false` | unit | same as above | ❌ Wave 0 EDIT |
| NOTIF-02 | `followUser` primary commit succeeds even when logger throws | unit | same as above | ❌ Wave 0 EDIT |
| NOTIF-02 | `followUser` self-follow rejected early (no logger call) | unit | same as above | ✓ (existing self-follow test) — ADD assertion: logger not called |
| NOTIF-03 | `addWatch` inserts one watch_overlap notification per pre-existing owner (normalized brand/model match, status=owned) | integration (local Supabase) | `npx vitest run tests/integration/phase13-notifications-flow.test.ts -x` | ❌ Wave 0 NEW |
| NOTIF-03 | `addWatch` excludes self — an actor with their own prior Submariner doesn't get a self-overlap | integration | same as above | ❌ Wave 0 NEW |
| NOTIF-03 | `addWatch` respects `notify_on_watch_overlap = false` on recipient | integration | same as above | ❌ Wave 0 NEW |
| NOTIF-03 | Adding the same watch twice within UTC day doesn't create a second overlap notification (partial UNIQUE) | integration | same as above | ✓ (existing Phase 11 test covers the DB constraint; Phase 13 adds "via `logNotification`" variant) |
| NOTIF-04 | Bell DAL returns `hasUnread: true` when a notification is newer than `notifications_last_seen_at` | unit + integration | `npx vitest run tests/data/getNotificationsUnreadState.test.ts -x` | ❌ Wave 0 NEW |
| NOTIF-04 | Bell DAL returns `hasUnread: false` when no newer notification exists | unit + integration | same as above | ❌ Wave 0 NEW |
| NOTIF-04 | Bell DAL signature includes `viewerId` as an explicit argument (no closure over getCurrentUser) | lint (grep) | `! grep -A 5 "'use cache'" src/components/notifications/ \| grep getCurrentUser` | N/A — grep rule |
| NOTIF-05 | `/notifications` page renders `NotificationsInbox` with rows newest-first | component + Server Component render | `npx vitest run tests/app/notifications-page.test.tsx -x` | ❌ Wave 0 NEW (optional — could be UAT-only) |
| NOTIF-06 | Mark-all-read SA sets `read_at = now()` on all unread rows for current user | unit (mocked DAL) + integration | `npx vitest run tests/actions/notifications.test.ts -x` | ❌ Wave 0 NEW |
| NOTIF-06 | Mark-all-read SA does not touch other users' rows | integration | `npx vitest run tests/integration/phase13-notifications-flow.test.ts -x` | ❌ Wave 0 NEW |
| NOTIF-07 | `NotificationRow` renders all 4 type stubs without throwing (snapshot) | component snapshot | `npx vitest run tests/components/notifications/NotificationRow.test.tsx -x` | ❌ Wave 0 NEW (D-21) |
| NOTIF-08 | Inbox collapses 3 watch_overlap rows for same (brand, model, day) into one "+2 others" row | component | `npx vitest run tests/components/notifications/NotificationsInbox.test.tsx -x` | ❌ Wave 0 NEW |
| NOTIF-09 | Toggling `notify_on_follow` off prevents the next follow from inserting a notification | integration | `npx vitest run tests/integration/phase13-notifications-flow.test.ts -x` | ❌ Wave 0 NEW |
| NOTIF-09 | Setting defaults to `true` for both columns in migration | integration (schema inspection) | `npx vitest run tests/integration/phase13-schema.test.ts -x` | ❌ Wave 0 NEW |
| NOTIF-10 | Inbox shows empty state when zero rows exist | component | `npx vitest run tests/components/notifications/NotificationsEmptyState.test.tsx -x` | ❌ Wave 0 NEW |
| RLS defense | anon cannot SELECT notifications | integration | `npx vitest run tests/integration/phase11-notifications-rls.test.ts -x` | ✓ (Phase 11 test covers this — no Phase 13 work needed) |
| RLS defense | authenticated user cannot SELECT another user's notifications | integration | same as above | ✓ (Phase 11) |
| Dedup | partial UNIQUE prevents duplicate `(user, brand, model, day)` overlap rows | integration | same as above | ✓ (Phase 11) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/actions/follows.test.ts tests/actions/watches.test.ts tests/actions/notifications.test.ts tests/components/notifications/ tests/lib/notifications/ tests/data/getNotificationsUnreadState.test.ts -x`
- **Per wave merge:** `npm test` (full suite — includes phase 11, 12, and new phase 13 integration tests, conditionally skipping integration tests that lack Supabase env vars)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/notifications/logger.test.ts` — covers NOTIF-02 + NOTIF-09 write-time opt-out branches + D-23/D-24 self-guard + dedup-silent behavior
- [ ] `tests/components/notifications/NotificationRow.test.tsx` — covers NOTIF-07 (4-type snapshot per D-21)
- [ ] `tests/components/notifications/NotificationsInbox.test.tsx` — covers NOTIF-08 display-time grouping
- [ ] `tests/components/notifications/NotificationsEmptyState.test.tsx` — covers NOTIF-10
- [ ] `tests/data/getNotificationsForViewer.test.ts` — 50-row cap, newest-first ordering, recipient-only filter (DAL-layer)
- [ ] `tests/data/getNotificationsUnreadState.test.ts` — covers NOTIF-04 `hasUnread` boolean semantics vs `notifications_last_seen_at`
- [ ] `tests/actions/notifications.test.ts` — covers NOTIF-06 mark-all-read SA shape + auth + revalidateTag call
- [ ] `tests/actions/follows.test.ts` — **EDIT** to add logger-call assertion for NOTIF-02 (logger invoked non-awaited after success; not invoked on self-follow; not invoked when opt-out off)
- [ ] `tests/actions/watches.test.ts` — **EDIT** to add watch-overlap logger assertions for NOTIF-03 (one call per pre-existing owner; self excluded; opt-out respected)
- [ ] `tests/integration/phase13-notifications-flow.test.ts` — E2E against local Supabase: seed 2 users, exercise follow + addWatch flows, assert DB state for each requirement's success criterion
- [ ] `tests/integration/phase13-schema.test.ts` — confirms the 3 new `profile_settings` columns exist with correct defaults (`information_schema` introspection + backfill assertion: no `notifications_last_seen_at IS NULL`)
- [ ] Fixture addition: `tests/fixtures/users.ts` may need a helper `insertProfileSettingsOverrides(userId, { notifyOnFollow?, notifyOnWatchOverlap? })` — 5-line utility, consider adding here or inline in each integration test

*(If the planner consolidates tests into fewer files, that's acceptable — the above is organized by concern, not by file mandate.)*

## Security Domain

Phase 13 is a multi-user notification surface — security considerations are material.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` + `UnauthorizedError` on every SA and Server Component [VERIFIED: src/lib/auth.ts] |
| V3 Session Management | yes | Supabase session via `@supabase/ssr` — inherited, no changes [VERIFIED] |
| V4 Access Control | **yes (load-bearing)** | Two-layer: recipient-only RLS SELECT/UPDATE on `notifications` [VERIFIED: 20260423000002_phase11_notifications.sql:100-113] + explicit `WHERE userId = viewerId` in DAL functions (defense in depth) |
| V5 Input Validation | yes | Zod `.strict()` on SA payloads (follow pattern from `src/app/actions/profile.ts:11-17`); `notification_type` enum is server-only (clients never submit `type`); mark-all-read SA takes no payload |
| V6 Cryptography | no | Nothing to encrypt at the app layer. HTTPS at ingress; Supabase handles at-rest. |

### Known Threat Patterns for Next.js 16 / Supabase Postgres / Drizzle

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user cache leak (wrong `'use cache'` key) | Information Disclosure | Viewer id as explicit argument (D-25). Pitfall 5 above. |
| IDOR on `/api/notifications/mark-one-read?id=X` | Information Disclosure / Tampering | Mark-one-read SA reads the row's `user_id` before updating, or uses `WHERE id = X AND user_id = current_user` in the UPDATE. Never trust client-supplied `userId`. UI-SPEC / CONTEXT.md don't mandate per-row `mark-one-read` SA explicitly — per-row click optimistically updates and may write via a batched mark-as-seen on page unload or just rely on the bell's `notifications_last_seen_at` + the mark-all-read SA for explicit state. Planner to confirm. |
| SQL injection via payload fields | Tampering | Drizzle `sql` tag auto-parameterizes; payload insert uses `.values({payload: obj})` which JSON-serializes. [VERIFIED pattern: tests/integration/phase11-notifications-rls.test.ts:54-62] |
| Notification spam / write amplification | DoS | For Phase 13: the partial UNIQUE dedup + the follow-is-1-row-per-pair constraint + the opt-out toggle are all mitigations. No rate limit needed at MVP scale. [ACCEPTED: personal-MVP posture] |
| Privacy: anon bypass via direct Supabase client | Information Disclosure | RLS `notifications_select_recipient_only` on notifications [VERIFIED]. Tested in `tests/integration/phase11-notifications-rls.test.ts`. |
| Privacy: authenticated user reads another user's inbox | Information Disclosure | RLS recipient-only SELECT [VERIFIED] + DAL `WHERE userId = viewerId` (two-layer per v2.0 discipline). |
| Mass-assignment on settings SA (`field: 'id'`) | Tampering | Zod enum constrains `field` to the 5 allowed values (existing 3 + 2 new) [VERIFIED pattern: src/app/actions/profile.ts:45-49]. |
| Self-notification injection via crafted payload | Tampering | DB `CHECK (actor_id IS NULL OR actor_id != user_id)` [VERIFIED]. Defense: logger's D-24 early-return. |

**Additional note:** Payload is `jsonb` with no DB CHECK (CONTEXT.md Phase 11 D-10). The TypeScript `NotificationPayload` discriminated union is the only type safety. A future bug that writes a malformed payload won't be caught at insert time. Renderer handles this per B-8 ("unknown types render null, not broken card"). If malformed payloads become a concern, revisit Phase 11 D-10.

## Sources

### Primary (HIGH confidence)

- `src/db/schema.ts` — canonical Drizzle schema; `notifications` table + `notification_type` enum + FK cascades are live [VERIFIED]
- `src/data/activities.ts:53-83` — canonical fire-and-forget logger pattern for `logNotification` to mirror [VERIFIED]
- `src/lib/timeAgo.ts` — existing relative-time helper (D-13 reuse target) [VERIFIED]
- `src/components/settings/PrivacyToggleRow.tsx` — existing toggle component (D-17 reuse target) [VERIFIED]
- `src/components/settings/SettingsSection.tsx` — existing section wrapper [VERIFIED]
- `src/components/profile/AvatarDisplay.tsx` — existing avatar component with `size=40` support [VERIFIED]
- `src/lib/actionTypes.ts` — canonical `ActionResult<T>` shape [VERIFIED]
- `src/app/actions/profile.ts:45-84` — canonical settings-SA shape (`updateProfileSettings`, `VISIBILITY_FIELDS` enum) [VERIFIED]
- `src/app/actions/follows.ts` — target edit site for NOTIF-02 [VERIFIED]
- `src/app/actions/watches.ts:49-93` — target edit site for NOTIF-03; `logActivity` try/catch shape [VERIFIED]
- `src/components/home/CollectorsLikeYou.tsx` — canonical `'use cache'` + viewer-is-argument pattern (D-25/D-26 template) [VERIFIED]
- `src/app/layout.tsx` — root layout with Suspense boundaries around Header and main [VERIFIED]
- `src/components/layout/Header.tsx` — target site for the temporary NotificationBell placement [VERIFIED]
- `supabase/migrations/20260423000002_phase11_notifications.sql` — ships the notifications table + RLS + partial UNIQUE dedup [VERIFIED]
- `supabase/migrations/20260420000000_rls_existing_tables.sql` — canonical RLS policy shape for any new migration [VERIFIED]
- `tests/integration/phase11-notifications-rls.test.ts` — canonical test scaffolding including `seedTwoUsers`, ON CONFLICT DO NOTHING usage against the partial UNIQUE, and RLS verification [VERIFIED]
- `tests/fixtures/users.ts` — two-user integration-test seed helper [VERIFIED]
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md` — pinned Next 16.2.3 `'use cache'` semantics [VERIFIED via Read tool]
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md` — pinned `cacheTag` signature and multi-tag usage [VERIFIED]
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md` — pinned `cacheLife` profiles + object form `{ revalidate: N }` [VERIFIED]
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md` — two-arg `revalidateTag(tag, 'max')` requirement for Next 16 [VERIFIED]

### Secondary (MEDIUM confidence)

- `.planning/phases/11-schema-storage-foundation/11-CONTEXT.md` — source of decisions for the notifications schema shape [VERIFIED via Read]
- `.planning/phases/12-visibility-ripple-in-dal/12-CONTEXT.md` — viewer-aware DAL discipline precedent [VERIFIED via Read]
- `.planning/REQUIREMENTS.md` NOTIF-02..10 — source of requirement IDs [VERIFIED via Read]
- `.planning/PROJECT.md` — v3.0 milestone framing [VERIFIED via Read]
- `.planning/STATE.md` — accumulated project decisions [VERIFIED via Read]
- `.planning/phases/13-notifications-foundation/13-UI-SPEC.md` — UI design contract (component paths, copy, color tokens) [VERIFIED via Read]

### Tertiary (LOW confidence)

- None. All claims in this research are backed by verified files in the tree or pinned documentation.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every library is already in `package.json`, every pattern is already implemented in the tree.
- Architecture: HIGH — `CollectorsLikeYou`, `logActivity`, `PrivacyToggleRow`, `timeAgo`, and the Phase 11 notifications schema are all concrete, verified precedents. The only novel element is the 3-column migration + the 4-type render switch — both mechanical.
- Pitfalls: HIGH for pitfalls 1, 3, 5, 6, 7, 8 (each backed by a verified file reference or an explicit CONTEXT.md locked decision). MEDIUM for pitfall 2 (backfill of `notifications_last_seen_at`) because I'm pattern-matching to Phase 11's coverage assertion migration rather than running an actual dry run. MEDIUM for pitfall 4 (`revalidateTag` two-arg form) because it's a Next 16 behavior verified only against pinned docs, not a runtime test.
- Validation Architecture: HIGH — every test file proposed follows an existing naming/shape convention, and every integration test variant is already demonstrated by Phase 11's integration suite.
- Security Domain: HIGH — RLS policy is already live, two-layer defense pattern is enforced project-wide, threat patterns for this stack are well-documented in CONTEXT.md.

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — stable stack; re-check if Next.js bumps past 16.2.x before phase starts)

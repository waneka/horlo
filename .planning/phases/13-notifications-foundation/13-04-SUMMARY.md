---
phase: 13
plan: 04
subsystem: notifications
tags: [notifications, page, integration, wire-up, wave-2, bell, settings, header]
requirements: [NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08, NOTIF-09, NOTIF-10]

dependency_graph:
  requires: [13-01, 13-02, 13-03]
  provides:
    - NotificationBell (cached server component, explicit viewerId prop, 30s TTL)
    - /notifications page (NOTIF-05 inbox route with Suspense, mark-all-read, touchLastSeenAt)
    - Settings Notifications section (2 opt-out toggles replacing Coming soon stub)
    - followUser SA wired with logNotification fire-and-forget (NOTIF-02)
    - addWatch SA wired with findOverlapRecipients + per-recipient logNotification (NOTIF-03)
    - Temporary NotificationBell in Header for UAT visibility (Phase 14 will relocate)
  affects:
    - src/app/actions/follows.ts
    - src/app/actions/watches.ts
    - src/components/layout/Header.tsx
    - src/components/settings/SettingsClient.tsx
    - src/app/settings/page.tsx

tech_stack:
  added: []
  patterns:
    - use-cache server component with explicit viewerId prop (Pitfall 5 mitigation)
    - cacheTag variadic two-arg form (cacheTag('notifications', viewer:id))
    - cacheLife object form with 30s revalidate
    - Two-arg revalidateTag('viewer:id', 'max') per Next 16 Pitfall 4
    - Fire-and-forget void logNotification after primary commit (D-28)
    - touchLastSeenAt + revalidateTag on page visit for bell cache invalidation (Pitfall 6)

key_files:
  created:
    - src/components/notifications/NotificationBell.tsx
    - src/app/notifications/page.tsx
  modified:
    - src/components/settings/SettingsClient.tsx
    - src/app/settings/page.tsx
    - src/app/actions/follows.ts
    - src/app/actions/watches.ts
    - src/components/layout/Header.tsx
    - tests/actions/follows.test.ts
    - tests/actions/watches.test.ts

decisions:
  - "cacheTag called with two separate string args (variadic) per Next 16 docs — not an array"
  - "notifications page uses try/catch around touchLastSeenAt so a transient DB write failure does not 500 the inbox"
  - "SettingsClient Notifications section moved above Appearance per UI-SPEC §Settings ordering"
  - "actorProfile pre-resolved before primary commit in followUser for clean fire-and-forget separation"
  - "as unknown as Watch used in new test cases to avoid any — pre-existing tests on lines 67/74 use as any (out of scope)"
  - "SettingsClient useEffect setState lint error is pre-existing (existed before Plan 04) — deferred to deferred-items"

metrics:
  duration: "558s (~9 min)"
  completed: "2026-04-23"
  tasks: 2
  files: 9
---

# Phase 13 Plan 04: Integration Layer Summary

**One-liner:** Cached NotificationBell with explicit viewerId + two-arg cacheTag, /notifications inbox page with touchLastSeenAt + revalidateTag on visit, Settings Notifications opt-out section, and fire-and-forget logNotification wired into followUser (NOTIF-02) and addWatch (NOTIF-03). Phase 13 complete — all NOTIF-02..10 requirements delivered.

> Phase 13 is complete and ready for `/gsd-verify-work 13`.

---

## What Was Built

### Task 1: NotificationBell + /notifications page + SettingsClient extension

**`src/components/notifications/NotificationBell.tsx`** (created)
- Server Component with `'use cache'` + `cacheTag('notifications', \`viewer:${viewerId}\`)` + `cacheLife({ revalidate: 30 })`
- viewerId is an explicit prop — getCurrentUser is never called inside the cached scope (D-25, Pitfall 5)
- Bell icon (lucide-react `Bell`, `size-5`) + conditional unread dot (`size-2 bg-accent`) at `top-0 right-0`
- 44px touch target (`min-h-11 min-w-11`), links to `/notifications`
- aria-label switches between "Unread notifications" and "Notifications" based on `hasUnread`

**`src/app/notifications/page.tsx`** (created)
- Server Component with auth redirect to `/login?next=/notifications` on UnauthorizedError
- Calls `touchLastSeenAt(user.id)` + `revalidateTag(\`viewer:${user.id}\`, 'max')` on every render (D-07, Pitfall 6)
- Both wrapped in try/catch so a transient DB failure does not 500 the page
- Fetches last 50 notifications via `getNotificationsForViewer(user.id, 50)`
- Suspense-wrapped inbox: `<NotificationsInbox>` when rows exist, `<NotificationsEmptyState>` when zero
- "Mark all read" form button (only shown when rows > 0) submits `markAllNotificationsRead` Server Action
- Locked copy: "Notifications" heading, "Mark all read" button (UI-SPEC §Copywriting Contract)

**`src/components/settings/SettingsClient.tsx`** (modified)
- Props type extended with `notifyOnFollow: boolean` + `notifyOnWatchOverlap: boolean`
- Replaced "Email notifications / Coming soon" stub with two `PrivacyToggleRow` instances:
  - label: "New Followers", description: "Get notified when someone starts following you.", field: "notifyOnFollow"
  - label: "Watch Overlaps", description: "Get notified when another collector owns a watch you own.", field: "notifyOnWatchOverlap"
- Section reordered to Privacy Controls → Notifications → Appearance → Data Preferences → Account (UI-SPEC §Settings)

**`src/app/settings/page.tsx`** (modified)
- Forwards `notifyOnFollow` and `notifyOnWatchOverlap` from `getProfileSettings` to `<SettingsClient>`

### Task 2: followUser + addWatch wiring + Header + test updates

**`src/app/actions/follows.ts`** (modified)
- Added imports: `logNotification` from `@/lib/notifications/logger`, `getProfileById` from `@/data/profiles`
- Pre-resolves `actorProfile = await getProfileById(user.id)` before primary commit
- After `followsDAL.followUser` + `revalidatePath` succeed: `void logNotification({ type: 'follow', ... })` (NOTIF-02, D-28)
- Fire-and-forget: promise rejection never surfaces to caller; logger's internal try/catch handles failures

**`src/app/actions/watches.ts`** (modified)
- Added imports: `logNotification`, `findOverlapRecipients`, `getProfileById`
- After activity logging try/catch, when `watch.status === 'owned'` (status gate per RESEARCH Open Q #1):
  - `await findOverlapRecipients({ brand, model, actorUserId: user.id })`
  - If recipients found: pre-resolve actor profile once, then `void logNotification(...)` per recipient (NOTIF-03)
  - Normalized brand/model (`LOWER(TRIM())`) stored in payload for dedup index
  - Entire overlap block in try/catch — non-fatal, never blocks the watch add

**`src/components/layout/Header.tsx`** (modified)
- Added `import { NotificationBell } from '@/components/notifications/NotificationBell'`
- Added `<NotificationBell viewerId={user.id} />` inside the `{user && ...}` JSX block
- Clearly marked with `{/* TEMP: UAT placement — Phase 14 will move this to the new nav */}`

**`tests/actions/follows.test.ts`** (modified)
- Added mocks: `vi.mock('@/lib/notifications/logger', ...)`, `vi.mock('@/data/profiles', ...)`
- Imported `logNotification` and `getProfileById` for assertions
- Existing "on success" test updated to mock `getProfileById` return
- Added: NOTIF-02 logNotification fire-and-forget assertion test
- Added: self-follow does NOT call logNotification (D-24 belt-and-suspenders)

**`tests/actions/watches.test.ts`** (modified)
- Added mocks: `vi.mock('@/lib/notifications/logger', ...)`, `vi.mock('@/data/notifications', ...)`, `vi.mock('@/data/profiles', ...)`
- Imported `logNotification`, `findOverlapRecipients`, `getProfileById`, `Watch` type
- Added NOTIF-03 describe block with 4 test cases:
  - owned status → findOverlapRecipients + logNotification called with correct payload
  - wishlist status → neither called (RESEARCH Open Q #1)
  - grail status → neither called
  - findOverlapRecipients throws → resolves {success:true} (fire-and-forget non-fatal)

---

## Test Suite Results

| Test File | Tests | Status |
|-----------|-------|--------|
| `tests/unit/notifications/logger.test.ts` | 8 | PASS |
| `tests/data/getNotificationsUnreadState.test.ts` | 3 | SKIP (no local Supabase) |
| `tests/data/getNotificationsForViewer.test.ts` | 3 | SKIP (no local Supabase) |
| `tests/actions/notifications.test.ts` | 5 | PASS |
| `tests/actions/follows.test.ts` | 15 | PASS (13 original + 2 new NOTIF-02) |
| `tests/actions/watches.test.ts` | 11 | PASS (7 original + 4 new NOTIF-03) |
| `tests/components/notifications/NotificationRow.test.tsx` | 14 | PASS |
| `tests/components/notifications/NotificationsInbox.test.tsx` | 10 | PASS |
| `tests/components/notifications/NotificationsEmptyState.test.tsx` | 6 | PASS |
| `tests/integration/phase13-notifications-flow.test.ts` | — | SKIP (no local Supabase) |
| **Full suite** | **2212 pass / 119 skip** | **ALL GREEN** |

---

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | 67d1b20 | feat(13-04): add NotificationBell, /notifications page, and Settings Notifications section |
| Task 2 | b4403c6 | feat(13-04): wire logNotification into followUser + addWatch + temporary bell in Header |

---

## TEMP Header Placement — Phase 14 TODO

The `NotificationBell` is placed in `src/components/layout/Header.tsx` inside the `{user && ...}` block with a clear comment:
```tsx
{/* TEMP: UAT placement — Phase 14 will move this to the new nav */}
<NotificationBell viewerId={user.id} />
```

**Phase 14 planner action required:** Remove the `NotificationBell` import and JSX from `Header.tsx` when the new nav shell is wired. The bell component itself (`src/components/notifications/NotificationBell.tsx`) is a drop-in ready for Phase 14 nav placement — no changes needed to the component.

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Out-of-Scope Pre-existing Issues (Deferred)

**1. [Pre-existing] SettingsClient.tsx — `react-hooks/set-state-in-effect` lint error**
- **Location:** `src/components/settings/SettingsClient.tsx` line 60 — `setNoteDefault(stored)` inside `useEffect`
- **Status:** Pre-existing before Plan 04 changes; confirmed by stash + lint check
- **Action:** Deferred — out of scope per deviation rules (not caused by this plan's changes)
- **Note:** The `useEffect` + `setNoteDefault` pattern was inherited from the v2.0 WR-02 localStorage hydration implementation

**2. [Pre-existing] watches.test.ts lines 67/74 — `@typescript-eslint/no-explicit-any`**
- **Location:** Existing test cases in the original watches.test.ts (not added by Plan 04)
- **Status:** Pre-existing; new test cases in Plan 04 use `as unknown as Watch` to avoid `any`
- **Action:** Deferred — out of scope

---

## Known Stubs

None — all exported functions and components have full implementations. The `price_drop` and `trending_collector` renderers in `NotificationRow` (Plan 03) remain intentionally dormant stubs per D-19/D-20, but they are not stubs introduced by this plan.

---

## Threat Surface Scan

No new network endpoints or auth paths introduced. The `/notifications` page uses the existing pattern of `getCurrentUser` → redirect on UnauthorizedError. The bell's cached scope never resolves viewer identity internally (Pitfall 5 / T-13-04-01 mitigation confirmed by grep: 0 `getCurrentUser` occurrences in `NotificationBell.tsx`).

All STRIDE threats from the plan's threat model mitigated:

| Threat | Status |
|--------|--------|
| T-13-04-01 Bell cache viewerId leak | Mitigated — explicit viewerId prop, 0 getCurrentUser in bell |
| T-13-04-02 Fire-and-forget rollback | Mitigated — void prefix + logger internal try/catch |
| T-13-04-03 Mark-all-read scope escape | Mitigated — SA uses WHERE user_id = current server-side |
| T-13-04-04 Bell dot stuck after mark-all-read | Mitigated — both SA and page visit call revalidateTag |
| T-13-04-05 Opt-out evasion | Mitigated — logger (Plan 02) reads notify_on_* before insert |
| T-13-04-06 Cross-user inbox bleed | Mitigated — RLS + DAL WHERE user_id = viewerId |
| T-13-04-08 Mass-assignment on Settings | Mitigated — Plan 02 widened VISIBILITY_FIELDS Zod enum |
| T-13-04-09 Unhandled rejection from logger | Mitigated — void prefix + Plan 02 internal try/catch |

---

## Manual UAT Readiness (from 13-VALIDATION.md)

Ready for human UAT verification:

| Check | How to Verify |
|-------|--------------|
| Bell dot appears when unread notifications exist | Log in, have another user follow you, check header bell |
| Bell dot clears after visiting /notifications | Visit /notifications, return to home — dot should be gone |
| /notifications shows rows grouped Today/Yesterday/Earlier | Check after receiving notifications across multiple days |
| Mark all read clears unread styling from all rows | Click "Mark all read", rows transition to read visual |
| Settings Notifications section shows 2 toggles | Visit /settings, confirm Privacy → Notifications → Appearance order |
| notifyOnFollow toggle saves opt-out | Toggle off, trigger a follow — no notification inserted |
| notifyOnWatchOverlap toggle saves opt-out | Toggle off, add overlapping owned watch — no notification inserted |
| Empty state shows when inbox is empty | Visit /notifications with no rows — see "You're all caught up" |

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/components/notifications/NotificationBell.tsx exists | FOUND |
| src/app/notifications/page.tsx exists | FOUND |
| Commit 67d1b20 exists | FOUND |
| Commit b4403c6 exists | FOUND |
| 2212 tests pass, 119 skipped | PASS |
| npx tsc --noEmit exits 0 | PASS |
| grep -c "getCurrentUser" NotificationBell.tsx = 0 | PASS (Pitfall 5) |
| grep -c "void logNotification" follows.ts = 1 | PASS (NOTIF-02) |
| grep -c "void logNotification" watches.ts = 1 | PASS (NOTIF-03) |
| grep -c "TEMP" Header.tsx >= 1 | PASS |

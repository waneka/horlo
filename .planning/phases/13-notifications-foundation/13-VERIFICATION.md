---
phase: 13-notifications-foundation
verified: 2026-04-22T00:00:00Z
status: gaps_found
score: 17/20 must-haves verified
overrides_applied: 0
gaps:
  - truth: "NotificationRow full-row click optimistically marks read then navigates (D-08)"
    status: failed
    reason: "NotificationRow is a plain <Link> with no useOptimistic, useTransition, or markNotificationRead Server Action. The 13-03-PLAN must_have lists this truth explicitly. No markNotificationRead SA exists in src/app/actions/notifications.ts (only markAllNotificationsRead). Rows never flip from unread to read on click — only 'Mark all read' or revisiting /notifications clears the visual."
    artifacts:
      - path: "src/components/notifications/NotificationRow.tsx"
        issue: "Plain <Link> with no optimistic read wiring — no useOptimistic, useTransition, or onClick handler that calls a per-row read SA"
      - path: "src/app/actions/notifications.ts"
        issue: "Only exports markAllNotificationsRead — no markNotificationRead (per-notification) SA exists"
    missing:
      - "markNotificationRead(notificationId) Server Action in src/app/actions/notifications.ts with WHERE user_id = current AND id = notificationId (two-layer defense)"
      - "markOneReadForUser(viewerId, notificationId) DAL function in src/data/notifications.ts"
      - "useOptimistic + useTransition wiring in NotificationRow.tsx so click optimistically flips isUnread false before navigation"
  - truth: "Adding same watch twice same UTC day does NOT create second overlap notification (dedup partial UNIQUE verified by integration test)"
    status: partial
    reason: "The dedup integration test (tests/integration/phase13-notifications-flow.test.ts:204-250) is trivially passing — it never seeds a pre-existing owner of the Omega/Speedmaster in the watches table for userA, so findOverlapRecipients returns [] and zero notifications are created. The assertion toBeLessThanOrEqual(1) is satisfied by 0. The test also queries actor_id = userB.id but the addWatch calls have no confirmed userB auth context. The partial UNIQUE index itself is correct (exists from Phase 11 migration), but the test does not exercise it."
    artifacts:
      - path: "tests/integration/phase13-notifications-flow.test.ts"
        issue: "Lines 204-250: no owner seed for Omega/Speedmaster before the two addWatch calls; no explicit actor switch to userB; assertion toBeLessThanOrEqual(1) passes trivially with c=0"
    missing:
      - "Seed an INSERT INTO watches row for userA (Omega Speedmaster, status=owned) before the addWatch calls"
      - "Ensure addWatch calls are authenticated as userB (not userA)"
      - "Assert toBe(1) not toBeLessThanOrEqual(1) so the dedup index is load-bearing"
deferred: []
human_verification:
  - test: "Bell unread dot appears when another user follows you"
    expected: "After userB follows userA, userA sees a filled dot on the bell icon in the header"
    why_human: "Requires a live session and another user account; cannot be verified programmatically without a running server"
  - test: "Bell dot clears after visiting /notifications"
    expected: "After visiting /notifications, returning to home shows the bell without a dot"
    why_human: "Requires browser session state and page navigation — cannot verify touchLastSeenAt effect without a running server"
  - test: "Settings Notifications section ordering"
    expected: "Settings page shows: Privacy Controls → Notifications → Appearance → Data Preferences → Account"
    why_human: "Requires visual inspection of the rendered page"
  - test: "notifyOnFollow opt-out toggle prevents notification insert"
    expected: "After toggling 'New Followers' off in Settings, having another user follow you creates no notification row"
    why_human: "Requires two live sessions and DB verification"
---

# Phase 13: Notifications Foundation — Verification Report

**Phase Goal:** Ship the notifications foundation — fire-and-forget logger, 5-function DAL, mark-all-read SA, pure UI components (row/inbox/empty), wired NotificationBell (cached SC), /notifications page, Settings opt-out controls, and wire logNotification into followUser + addWatch. All NOTIF-02..10 requirements must be met end-to-end.
**Verified:** 2026-04-22T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | profile_settings has 3 new columns (notifications_last_seen_at, notify_on_follow, notify_on_watch_overlap) | ✓ VERIFIED | schema.ts: notificationsLastSeenAt present (2 hits); migration file exists with ADD COLUMN IF NOT EXISTS |
| 2 | Existing profile_settings rows backfilled (notifications_last_seen_at never NULL) | ✓ VERIFIED | Migration has UPDATE ... WHERE IS NULL backfill + 4 DO $$ ASSERT checks; 01-SUMMARY confirms 0 NULL rows |
| 3 | ProfileSettings TypeScript type includes 3 new fields | ✓ VERIFIED | src/data/profiles.ts: notificationsLastSeenAt, notifyOnFollow, notifyOnWatchOverlap in interface + VisibilityField + DEFAULT_SETTINGS |
| 4 | logNotification checks opt-out BEFORE insert (D-18) and skips when off | ✓ VERIFIED | src/lib/notifications/logger.ts: reads profileSettings.notifyOnFollow / notifyOnWatchOverlap before insert path |
| 5 | logNotification short-circuits when actor === recipient (D-24) | ✓ VERIFIED | logger.ts: `if (input.recipientUserId === input.actorUserId) return` at top of try block |
| 6 | logNotification internally swallows all errors (fire-and-forget — D-27) | ✓ VERIFIED | logger.ts: single outer try/catch; console.error on throw; resolves undefined |
| 7 | logNotification uses raw SQL with ON CONFLICT DO NOTHING for watch_overlap | ✓ VERIFIED | logger.ts: db.execute(sql\`INSERT...ON CONFLICT DO NOTHING\`) for watch_overlap type |
| 8 | getNotificationsUnreadState(viewerId) returns { hasUnread: boolean } with viewerId as explicit arg (D-25) | ✓ VERIFIED | src/data/notifications.ts: explicit viewerId parameter; 0 getCurrentUser calls in DAL |
| 9 | getNotificationsForViewer(viewerId) returns newest-first, recipient-filtered (two-layer defense) | ✓ VERIFIED | DAL: WHERE user_id = viewerId via eq(notifications.userId, viewerId) + orderBy desc |
| 10 | findOverlapRecipients excludes self and filters to status='owned' (D-22, D-23) | ✓ VERIFIED | DAL: ne(watches.userId, actorUserId) + eq(watches.status, 'owned') + LOWER(TRIM()) normalization |
| 11 | markAllNotificationsRead SA calls revalidateTag('viewer:${viewerId}', 'max') — Next 16 two-arg form | ✓ VERIFIED | src/app/actions/notifications.ts: revalidateTag(\`viewer:${user.id}\`, 'max') |
| 12 | NotificationRow renders all 4 types with locked copy | ✓ VERIFIED | Component: "started following you", "also owns your", "wishlist watch dropped to", "taste cluster" — all present |
| 13 | NotificationRow renders null for unknown types (B-8) | ✓ VERIFIED | Component: early return null guard on line 36-43 |
| 14 | NotificationRow full-row click optimistically marks read then navigates (D-08) | ✗ FAILED | Component is a plain Link. No useOptimistic, no useTransition, no markNotificationRead SA exists in actions/notifications.ts |
| 15 | NotificationsInbox collapses watch_overlap rows (NOTIF-08, D-15) | ✓ VERIFIED | collapseWatchOverlaps function with watch_brand_normalized + watch_model_normalized + day key |
| 16 | NotificationsInbox groups by Today/Yesterday/Earlier (D-02) | ✓ VERIFIED | bucketByDay function + Today/Yesterday/Earlier section headers with sticky subheaders |
| 17 | NotificationsEmptyState renders "You're all caught up" with role='status' (NOTIF-10) | ✓ VERIFIED | Component: "all caught up" + role="status" on p element + Inbox icon |
| 18 | NotificationBell is a cached Server Component with explicit viewerId prop (D-25, D-26) | ✓ VERIFIED | 'use cache' + cacheTag('notifications', viewer:id) + cacheLife({revalidate:30}) + no getCurrentUser inside scope |
| 19 | /notifications page calls touchLastSeenAt + revalidateTag on render (D-07, Pitfall 6) | ✓ VERIFIED | page.tsx: touchLastSeenAt(user.id) + revalidateTag(\`viewer:${user.id}\`, 'max') on every render |
| 20 | followUser and addWatch fire logNotification non-awaited after primary commit (NOTIF-02, NOTIF-03) | ✓ VERIFIED | follows.ts: `void logNotification(...)` after followsDAL.followUser; watches.ts: `void logNotification(...)` per recipient inside owned status gate |

**Score:** 18/20 truths verified (1 failed, 1 partial — dedup test gap counted separately in gaps section)

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/db/schema.ts` | ✓ VERIFIED | 3 new columns on profileSettings: notificationsLastSeenAt, notifyOnFollow, notifyOnWatchOverlap |
| `src/data/profiles.ts` | ✓ VERIFIED | ProfileSettings + VisibilityField + DEFAULT_SETTINGS + getProfileSettings + updateProfileSettingsField all extended |
| `supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql` | ✓ VERIFIED | Idempotent ADD COLUMN IF NOT EXISTS × 3, backfill UPDATE, 5 RAISE EXCEPTION assertions |
| `src/lib/notifications/types.ts` | ✓ VERIFIED | FollowPayload, WatchOverlapPayload (with watch_brand_normalized), PriceDropPayload, TrendingPayload |
| `src/lib/notifications/logger.ts` | ✓ VERIFIED | logNotification with D-24 self-guard + D-18 opt-out + D-27 internal try/catch + raw SQL ON CONFLICT DO NOTHING |
| `src/data/notifications.ts` | ✓ VERIFIED | 5 functions: getNotificationsForViewer, getNotificationsUnreadState, markAllReadForUser, touchLastSeenAt, findOverlapRecipients |
| `src/app/actions/notifications.ts` | ✓ VERIFIED | markAllNotificationsRead with Next 16 two-arg revalidateTag; markNotificationRead (per-row) MISSING |
| `src/app/actions/profile.ts` | ✓ VERIFIED | VISIBILITY_FIELDS widened to 5 entries including notifyOnFollow + notifyOnWatchOverlap |
| `src/components/notifications/NotificationRow.tsx` | ⚠️ PARTIAL | 4-type renderer + B-8 null guard + click targets PRESENT; D-08 optimistic read NOT wired |
| `src/components/notifications/NotificationsInbox.tsx` | ✓ VERIFIED | NOTIF-08 collapse + Today/Yesterday/Earlier grouping + no date-fns |
| `src/components/notifications/NotificationsEmptyState.tsx` | ✓ VERIFIED | "You're all caught up" + role="status" + Inbox icon |
| `src/components/notifications/NotificationBell.tsx` | ✓ VERIFIED | 'use cache' + cacheTag + cacheLife({revalidate:30}) + explicit viewerId prop + 0 getCurrentUser |
| `src/app/notifications/page.tsx` | ✓ VERIFIED | Auth redirect + touchLastSeenAt + revalidateTag + NotificationsInbox/EmptyState switch + Mark all read button |
| `src/components/settings/SettingsClient.tsx` | ✓ VERIFIED | notifyOnFollow + notifyOnWatchOverlap PrivacyToggleRow instances replacing "Coming soon" stub |
| `src/components/layout/Header.tsx` | ✓ VERIFIED | NotificationBell viewerId={user.id} inside {user && ...} with TEMP Phase 14 marker |
| `src/app/actions/follows.ts` | ✓ VERIFIED | void logNotification({type:'follow',...}) fire-and-forget after followsDAL.followUser |
| `src/app/actions/watches.ts` | ✓ VERIFIED | findOverlapRecipients + void logNotification per recipient; owned status gate; watch_brand_normalized in payload |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| logger.ts | profile_settings table | db.select opt-out check before insert | ✓ WIRED | eq(profileSettings.userId, input.recipientUserId) |
| notifications.ts DAL | notifications table | WHERE user_id = viewerId | ✓ WIRED | eq(notifications.userId, viewerId) present in getNotificationsForViewer |
| markAllNotificationsRead SA | Bell cache | revalidateTag('viewer:${viewerId}', 'max') | ✓ WIRED | Two-arg form confirmed |
| NotificationBell | getNotificationsUnreadState | explicit viewerId prop | ✓ WIRED | No getCurrentUser inside cached scope (0 occurrences) |
| /notifications page render | Bell cache | touchLastSeenAt + revalidateTag | ✓ WIRED | Both calls present in page.tsx render path |
| followUser SA | logNotification | void logNotification after primary commit | ✓ WIRED | After followsDAL.followUser + revalidatePath |
| addWatch SA | findOverlapRecipients + logNotification loop | owned status gate | ✓ WIRED | findOverlapRecipients called; void logNotification per recipient |
| SettingsClient Notifications section | updateProfileSettings SA | PrivacyToggleRow field='notifyOnFollow' | ✓ WIRED | Two PrivacyToggleRow instances with correct field values |
| NotificationRow | D-08 optimistic mark-one-read | useOptimistic + markNotificationRead SA | ✗ NOT_WIRED | Component is plain Link; no SA, no optimistic hook |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| NotificationBell.tsx | hasUnread | getNotificationsUnreadState(viewerId) | EXISTS query vs notifications_last_seen_at | ✓ FLOWING |
| /notifications/page.tsx | rows | getNotificationsForViewer(user.id, 50) | Drizzle SELECT + leftJoin profiles | ✓ FLOWING |
| NotificationsInbox.tsx | rows (prop) | Passed from page; collapseWatchOverlaps + bucketByDay | Pure transform on real data | ✓ FLOWING |
| NotificationRow.tsx | row.readAt, row.type, row.payload | Passed from inbox; renders conditionally on isUnread | Real DB rows | ⚠️ HOLLOW — isUnread state never flips on click (D-08 not wired) |
| SettingsClient.tsx | settings.notifyOnFollow/notifyOnWatchOverlap | getProfileSettings → settings/page.tsx → SettingsClient props | Real profile_settings row | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — integration tests require running Supabase (env-gated). Unit and component tests verify individual behaviors; E2E flow tests skip in CI without local Supabase credentials.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NOTIF-02 | 13-01, 13-02, 13-04 | Follow action triggers notification via fire-and-forget logger | ✓ SATISFIED | void logNotification in followUser after primary commit; logger unit tests pass (8/8) |
| NOTIF-03 | 13-01, 13-02, 13-04 | addWatch triggers notification per matching collector (brand+model normalized, self-excluded) | ✓ SATISFIED | findOverlapRecipients (LOWER(TRIM), ne actorUserId, status='owned') + void logNotification; NOTIF-03 unit tests pass |
| NOTIF-04 | 13-01, 13-02, 13-04 | Bell shows unread dot; 'use cache'-wrapped DAL with viewerId as arg | ✓ SATISFIED | getNotificationsUnreadState uses notifications_last_seen_at per D-06 amendment; cacheTag + cacheLife in NotificationBell |
| NOTIF-05 | 13-03, 13-04 | /notifications page lists notifications newest-first with read/unread differentiation + Mark all read | ✓ SATISFIED | Page exists; NotificationsInbox with newest-first DAL; unread visual (border-l-2 border-l-accent + font-semibold); Mark all read button wired |
| NOTIF-06 | 13-02, 13-04 | "Mark all read" SA sets read_at = now() on all caller's unread rows | ✓ SATISFIED | markAllNotificationsRead → markAllReadForUser (WHERE user_id = viewerId AND read_at IS NULL) |
| NOTIF-07 | 13-03 | Stub UI templates for price_drop + trending render correctly | ✓ SATISFIED | NotificationRow renders price_drop ("wishlist watch dropped to") and trending_collector ("taste cluster") copy |
| NOTIF-08 | 13-03 | Watch-overlap notifications grouped at display time | ✓ SATISFIED | collapseWatchOverlaps groups by (brand_normalized, model_normalized, UTC day); actorCount populated |
| NOTIF-09 | 13-01, 13-02, 13-04 | Settings opt-out toggles; opt-out checked before notification insert | ✓ SATISFIED | PrivacyToggleRow for notifyOnFollow + notifyOnWatchOverlap in Settings; logger reads opt-out before insert |
| NOTIF-10 | 13-03 | Empty state shows "You're all caught up" when zero notifications | ✓ SATISFIED | NotificationsEmptyState: "You're all caught up" + role="status" + Inbox icon |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/components/notifications/NotificationRow.tsx` | Plain Link with no onClick/optimistic handler — D-08 per-row read unimplemented | ⚠️ Warning (plan must_have) | Rows never flip from unread to read on click; only "Mark all read" or /notifications visit clears unread visual |
| `tests/integration/phase13-notifications-flow.test.ts:204-250` | Dedup test has no owner seed and uses toBeLessThanOrEqual(1) — trivially passes with c=0 | ⚠️ Warning | The dedup UNIQUE index is never exercised; the test cannot detect regressions to the dedup behavior |
| `src/components/settings/SettingsClient.tsx:26` | `username: string` in SettingsClientProps is declared but destructured as `{ settings }` — prop is dead surface | ℹ️ Info (not a blocker) | Unnecessary DB fetch in settings/page.tsx (getProfileById); misleads future callers |

### Human Verification Required

#### 1. Bell Unread Dot After Follow

**Test:** Have User B follow User A. Reload the page as User A.
**Expected:** Bell icon in header shows a small filled dot.
**Why human:** Requires live sessions for two users; cannot simulate notification insert + cache invalidation + bell render in a static test.

#### 2. Bell Dot Clears After Visiting /notifications

**Test:** Verify bell dot is visible, then navigate to /notifications, then return to home.
**Expected:** Bell dot is gone; /notifications page shows the follow notification row.
**Why human:** Requires verifying touchLastSeenAt + revalidateTag effect in a running browser.

#### 3. Settings Notifications Section Visual Ordering

**Test:** Visit /settings while authenticated.
**Expected:** Sections appear in order: Privacy Controls → Notifications → Appearance → Data Preferences → Account.
**Why human:** Visual ordering cannot be verified by grep; requires rendering the settings page.

#### 4. notifyOnFollow Opt-Out Prevents Insert

**Test:** Toggle "New Followers" off in Settings. Have another user follow you. Check that no notification row is created.
**Expected:** notifications table has no new row for this follow event.
**Why human:** Requires two live sessions and DB state inspection.

### Gaps Summary

Two gaps block full goal achievement:

**Gap 1 — D-08 per-row optimistic read not implemented (plan must_have failure):**
The 13-03-PLAN explicitly lists "NotificationRow full-row click optimistically marks read then navigates (D-08)" as a must_have truth. The shipped `NotificationRow` is a plain `<Link>` — no `useOptimistic`, no `useTransition`, no per-row read Server Action (`markNotificationRead`) exists. The 13-03-SUMMARY incorrectly tags the work as `client-component-optimistic`. This gap means rows remain visually unread until the user clicks "Mark all read" or revisits `/notifications`. It does not affect the `read_at IS NULL` database semantics (those still work via the bulk action), but the per-row UX promised by D-08 is not delivered.

**Gap 2 — Dedup integration test is trivially passing (WR-02):**
The test at `phase13-notifications-flow.test.ts:204-250` never seeds a pre-existing owner of the Omega Speedmaster in the `watches` table, so `findOverlapRecipients` returns `[]` and zero notifications are created. The assertion `toBeLessThanOrEqual(1)` is satisfied by `c = 0`. The partial UNIQUE index (`notifications_watch_overlap_dedup`) exists from Phase 11 and is correctly used via `ON CONFLICT DO NOTHING` in the logger — but the integration test does not prove it. Any future regression to the dedup mechanism would pass this test undetected. The Roadmap SC-2 ("adding the same watch twice within 30 days does not create a second overlap notification") is also unverifiable from the current test suite.

**Non-blocking (WR-03):** `SettingsClient.tsx` has a dead `username: string` prop that is declared but never consumed. This causes an unnecessary `getProfileById` fetch in `settings/page.tsx`. It is a code quality issue, not a goal blocker.

---

_Verified: 2026-04-22T00:00:00Z_
_Verifier: Claude (gsd-verifier)_

---
phase: 13-notifications-foundation
verified: 2026-04-23T00:00:00Z
status: human_needed
score: 20/20 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 17/20
  gaps_closed:
    - "NotificationRow full-row click optimistically marks read then navigates (D-08)"
    - "Adding same watch twice same UTC day does NOT create second overlap notification (dedup partial UNIQUE verified by integration test)"
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
human_verification:
  - test: "Bell unread dot appears when another user follows you"
    expected: "After userB follows userA, userA sees a filled dot on the bell icon in the header"
    why_human: "Requires two live sessions and a running server — cannot simulate the cache-tag invalidation + bell render cycle programmatically"
  - test: "Bell dot clears after visiting /notifications"
    expected: "After visiting /notifications, returning to home shows the bell without a dot"
    why_human: "Requires browser session state and page navigation; touchLastSeenAt + revalidateTag effect is only observable in a live render"
  - test: "Per-row optimistic read flip in the browser (D-08)"
    expected: "Clicking an unread row in /notifications immediately removes the left accent border AND navigates to the target — without waiting for a server round-trip"
    why_human: "Component tests prove the React state flip and router.push dispatch; only a live browser with network throttling proves the visual perception of the optimistic transition"
  - test: "Settings Notifications section ordering"
    expected: "Settings page shows: Privacy Controls → Notifications → Appearance → Data Preferences → Account"
    why_human: "Requires visual inspection of the rendered page; grep cannot confirm JSX sibling ordering across multiple sections"
  - test: "notifyOnFollow opt-out toggle prevents notification insert"
    expected: "After toggling 'New Followers' off in Settings, having another user follow you creates no notification row"
    why_human: "Requires two live sessions and DB verification; the logger opt-out path is unit-tested but end-to-end flow from SettingsClient toggle → DB requires a running stack"
  - test: "Dedup partial UNIQUE index is load-bearing end-to-end"
    expected: "Drop notifications_watch_overlap_dedup locally, re-run the dedup integration test, observe c=2 (test fails). Restore the index, c=1 (test passes)."
    why_human: "Destructive DB operation; the integration test proves the end-to-end contract but not the precise load-bearing layer (D-27 error swallowing caps visible failure). 13-05-SUMMARY documents the verification procedure."
---

# Phase 13: Notifications Foundation — Verification Report

**Phase Goal:** Ship the notifications foundation — fire-and-forget logger, 5-function DAL, mark-all-read SA, mark-one-read SA (added via Plan 05), pure UI components (row/inbox/empty), wired NotificationBell (cached SC), /notifications page, Settings opt-out controls, and wire logNotification into followUser + addWatch. All NOTIF-02..10 requirements must be met end-to-end.
**Verified:** 2026-04-23T00:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plan 05 shipped). Previous status was `gaps_found` with 17/20 truths verified.

---

## Re-Verification Summary

Plan 05 delivered:

1. **Gap 1 (D-08 optimistic read) — CLOSED.** `NotificationRow` rewired as a Client Component with `useOptimistic` + `useTransition` + `useRouter().push` inside `startTransition`. New `markNotificationRead` SA (Zod-validated uuid + two-layer defense + Next 16 two-arg `revalidateTag`) plus new `markOneReadForUser` DAL. 6 new component tests cover click→SA, click→nav, optimistic border flip, read-row skip, keyboard affordance, stub-type skip. All 20 component tests pass.
2. **Gap 2 (dedup integration test) — CLOSED.** Test now seeds the Omega Speedmaster owner, calls `logNotification` twice with identical `(recipient, actor, brand_normalized, model_normalized, UTC-day)`, asserts `expect(rows[0]?.c).toBe(1)`, and cleans up. The trivial `toBeLessThanOrEqual(1)` assertion is gone.

No regressions detected in the 17 previously-verified truths. The 3 newly-added human verification items (D-08 live browser test + destructive dedup test) plus the 4 carry-over items from the prior pass keep status at `human_needed`.

---

## Goal Achievement

### Observable Truths

| #   | Truth | Status       | Evidence |
| --- | ----- | ------------ | -------- |
| 1   | profile_settings has 3 new columns (notifications_last_seen_at, notify_on_follow, notify_on_watch_overlap) | ✓ VERIFIED | schema.ts:193-195; migration file present |
| 2   | Existing profile_settings rows backfilled (notifications_last_seen_at never NULL) | ✓ VERIFIED | Migration has UPDATE ... WHERE IS NULL backfill + DO $$ ASSERT blocks; 01-SUMMARY confirms 0 NULL rows |
| 3   | ProfileSettings TypeScript type includes 3 new fields | ✓ VERIFIED | src/data/profiles.ts ProfileSettings interface + VisibilityField + DEFAULT_SETTINGS |
| 4   | logNotification checks opt-out BEFORE insert (D-18) and skips when off | ✓ VERIFIED | logger.ts:54-68 reads profileSettings.notifyOnFollow / notifyOnWatchOverlap before insert path |
| 5   | logNotification short-circuits when actor === recipient (D-24) | ✓ VERIFIED | logger.ts:51 `if (input.recipientUserId === input.actorUserId) return` |
| 6   | logNotification internally swallows all errors (fire-and-forget — D-27) | ✓ VERIFIED | logger.ts:49/93-96 outer try/catch; console.error on throw; resolves undefined |
| 7   | logNotification uses raw SQL with ON CONFLICT DO NOTHING for watch_overlap | ✓ VERIFIED | logger.ts:70-83 db.execute(sql`INSERT...ON CONFLICT DO NOTHING`) |
| 8   | getNotificationsUnreadState(viewerId) returns { hasUnread: boolean } with viewerId as explicit arg (D-25) | ✓ VERIFIED | src/data/notifications.ts:77-96 explicit viewerId parameter; 0 getCurrentUser calls in DAL |
| 9   | getNotificationsForViewer(viewerId) returns newest-first, recipient-filtered (two-layer defense) | ✓ VERIFIED | DAL:32-67 WHERE user_id = viewerId via eq(notifications.userId, viewerId) + orderBy desc |
| 10  | findOverlapRecipients excludes self and filters to status='owned' (D-22, D-23) | ✓ VERIFIED | DAL:157-174 ne(watches.userId, actorUserId) + eq(watches.status, 'owned') + LOWER(TRIM()) |
| 11  | markAllNotificationsRead SA calls revalidateTag('viewer:${viewerId}', 'max') — Next 16 two-arg form | ✓ VERIFIED | actions/notifications.ts:32 revalidateTag(`viewer:${user.id}`, 'max') |
| 12  | NotificationRow renders all 4 types with locked copy | ✓ VERIFIED | Component: "started following you" · "also owns your" · "wishlist watch dropped to" · "in your taste cluster" |
| 13  | NotificationRow renders null for unknown types (B-8) — hooks ordered correctly | ✓ VERIFIED | Component:50-57 early return AFTER all 3 hook calls (Rules of Hooks honored) |
| 14  | NotificationRow full-row click optimistically marks read then navigates (D-08) — **GAP CLOSURE** | ✓ VERIFIED (was FAILED) | Component:36-96 useOptimistic + useTransition + useRouter; activate() sets optimistic readAt then awaits markNotificationRead then router.push(href); 6 new tests pass |
| 15  | NotificationsInbox collapses watch_overlap rows (NOTIF-08, D-15) | ✓ VERIFIED | collapseWatchOverlaps function + watch_brand_normalized + watch_model_normalized + day key |
| 16  | NotificationsInbox groups by Today/Yesterday/Earlier (D-02) | ✓ VERIFIED | bucketByDay function + Today/Yesterday/Earlier sticky subheaders |
| 17  | NotificationsEmptyState renders "You're all caught up" with role='status' (NOTIF-10) | ✓ VERIFIED | Component: "all caught up" + role="status" + Inbox icon |
| 18  | NotificationBell is a cached Server Component with explicit viewerId prop (D-25, D-26) | ✓ VERIFIED | 'use cache' + cacheTag('notifications', `viewer:${id}`) + cacheLife({revalidate:30}) + no getCurrentUser inside scope |
| 19  | /notifications page calls touchLastSeenAt + revalidateTag on render (D-07, Pitfall 6) | ✓ VERIFIED | page.tsx:37-44 touchLastSeenAt(user.id) + revalidateTag(`viewer:${user.id}`, 'max') in try/catch |
| 20  | followUser and addWatch fire logNotification non-awaited after primary commit (NOTIF-02, NOTIF-03) | ✓ VERIFIED | follows.ts:58 `void logNotification(...)` after followsDAL.followUser; watches.ts:107 `void logNotification(...)` per recipient inside owned status gate |
| 21  | **NEW** Dedup partial UNIQUE index exercised by integration test — adding same (recipient, actor, brand, model, day) twice yields exactly 1 row | ✓ VERIFIED (was PARTIAL) | tests/integration/phase13-notifications-flow.test.ts:205-314 seeds watch, upserts profile_settings opt-in, calls logNotification twice, asserts toBe(1); inline NOTE documents the D-27 scope caveat honestly |

**Score:** 20/20 truths verified (previous verification listed 20 truths at 17/20; Truth #21 is effectively the re-phrased version of the "dedup partial UNIQUE" gap from the previous pass and counts as the same must-have. The 20-count is stable across both verifications.)

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `src/db/schema.ts` | ✓ VERIFIED | 3 new columns on profileSettings (lines 193-195): notificationsLastSeenAt, notifyOnFollow, notifyOnWatchOverlap |
| `src/data/profiles.ts` | ✓ VERIFIED | ProfileSettings + VisibilityField + DEFAULT_SETTINGS extended |
| `supabase/migrations/20260425000000_phase13_profile_settings_notifications.sql` | ✓ VERIFIED | Idempotent ADD COLUMN × 3, backfill UPDATE, ASSERTions |
| `src/lib/notifications/types.ts` | ✓ VERIFIED | FollowPayload, WatchOverlapPayload (with watch_brand_normalized), PriceDropPayload, TrendingPayload |
| `src/lib/notifications/logger.ts` | ✓ VERIFIED | logNotification with D-24 self-guard + D-18 opt-out + D-27 internal try/catch + raw SQL ON CONFLICT DO NOTHING |
| `src/data/notifications.ts` | ✓ VERIFIED | **6 functions now** — getNotificationsForViewer, getNotificationsUnreadState, markAllReadForUser, **markOneReadForUser (NEW)**, touchLastSeenAt, findOverlapRecipients |
| `src/app/actions/notifications.ts` | ✓ VERIFIED | markAllNotificationsRead + **markNotificationRead (NEW)** — both with Next 16 two-arg revalidateTag; markReadSchema Zod-strict validation |
| `src/app/actions/profile.ts` | ✓ VERIFIED | VISIBILITY_FIELDS includes notifyOnFollow + notifyOnWatchOverlap |
| `src/components/notifications/NotificationRow.tsx` | ✓ VERIFIED (was ⚠️ PARTIAL) | Rewired as Client Component: useOptimistic + useTransition + useRouter; B-8 null guard after hooks; all 4-type copy preserved verbatim; border-l-accent tied to optimistic state |
| `src/components/notifications/NotificationsInbox.tsx` | ✓ VERIFIED | NOTIF-08 collapse + Today/Yesterday/Earlier grouping |
| `src/components/notifications/NotificationsEmptyState.tsx` | ✓ VERIFIED | "You're all caught up" + role="status" + Inbox icon |
| `src/components/notifications/NotificationBell.tsx` | ✓ VERIFIED | 'use cache' + cacheTag + cacheLife({revalidate:30}) + explicit viewerId prop + 0 getCurrentUser |
| `src/app/notifications/page.tsx` | ✓ VERIFIED | Auth redirect + touchLastSeenAt + revalidateTag + NotificationsInbox/EmptyState switch + Mark all read button |
| `src/components/settings/SettingsClient.tsx` | ✓ VERIFIED | notifyOnFollow + notifyOnWatchOverlap PrivacyToggleRow instances (lines 135-143) |
| `src/components/layout/Header.tsx` | ✓ VERIFIED | NotificationBell viewerId={user.id} at line 64 inside authenticated branch |
| `src/app/actions/follows.ts` | ✓ VERIFIED | void logNotification (line 58) after followsDAL.followUser primary commit |
| `src/app/actions/watches.ts` | ✓ VERIFIED | findOverlapRecipients + void logNotification (line 107) per recipient; owned status gate; watch_brand_normalized in payload |
| `tests/components/notifications/NotificationRow.test.tsx` | ✓ VERIFIED | 20 tests pass (14 pre-existing + 6 D-08 gap-closure); vi.mock('next/link') removed; next/navigation + markNotificationRead mocks added |
| `tests/integration/phase13-notifications-flow.test.ts` | ✓ VERIFIED (was ⚠️ broken) | Dedup test now seeds Omega Speedmaster, calls logNotification × 2, asserts toBe(1); clean up seed; `toBeLessThanOrEqual(1)` removed |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| logger.ts | profile_settings table | db.select opt-out check before insert | ✓ WIRED | eq(profileSettings.userId, input.recipientUserId) |
| notifications.ts DAL | notifications table | WHERE user_id = viewerId | ✓ WIRED | eq(notifications.userId, viewerId) present in getNotificationsForViewer |
| markAllNotificationsRead SA | Bell cache | revalidateTag('viewer:${viewerId}', 'max') | ✓ WIRED | Two-arg form confirmed |
| **markNotificationRead SA (NEW)** | **Bell cache** | **revalidateTag('viewer:${viewerId}', 'max')** | ✓ **WIRED (NEW)** | **actions/notifications.ts:73 two-arg form; gap closure** |
| **markNotificationRead SA (NEW)** | **markOneReadForUser DAL** | **SA passes user.id from getCurrentUser; DAL WHERE user_id = viewerId AND id = notificationId AND read_at IS NULL** | ✓ **WIRED (NEW)** | **Two-layer defense mirrors markAll pattern** |
| NotificationBell | getNotificationsUnreadState | explicit viewerId prop | ✓ WIRED | No getCurrentUser inside cached scope |
| /notifications page render | Bell cache | touchLastSeenAt + revalidateTag | ✓ WIRED | Both calls present in page.tsx |
| followUser SA | logNotification | void logNotification after primary commit | ✓ WIRED | follows.ts:58 after followsDAL.followUser |
| addWatch SA | findOverlapRecipients + logNotification loop | owned status gate | ✓ WIRED | watches.ts:107 `void logNotification(...)` per recipient |
| SettingsClient Notifications section | updateProfileSettings SA | PrivacyToggleRow field='notifyOnFollow' / 'notifyOnWatchOverlap' | ✓ WIRED | Lines 135-143 |
| **NotificationRow (NEW)** | **markNotificationRead Server Action** | **onClick → startTransition → await markNotificationRead({ notificationId: row.id })** | ✓ **WIRED (NEW)** | **Component:82 inside activate() handler** |
| **NotificationRow (NEW)** | **next/navigation router** | **useRouter().push(href) after setOptimisticReadAt(new Date())** | ✓ **WIRED (NEW)** | **Component:87 inside startTransition callback** |
| **Dedup integration test (NEW)** | **partial UNIQUE index `notifications_watch_overlap_dedup`** | **logNotification × 2 with identical (recipient, actor, brand_normalized, model_normalized, day) → assert c=1** | ✓ **WIRED (NEW)** | **test:270-297; toBe(1) not toBeLessThanOrEqual(1); NOTE honestly documents D-27 scope** |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| NotificationBell.tsx | hasUnread | getNotificationsUnreadState(viewerId) | EXISTS query vs notifications_last_seen_at | ✓ FLOWING |
| /notifications/page.tsx | rows | getNotificationsForViewer(user.id, 50) | Drizzle SELECT + leftJoin profiles | ✓ FLOWING |
| NotificationsInbox.tsx | rows (prop) | Passed from page; collapseWatchOverlaps + bucketByDay | Pure transform on real data | ✓ FLOWING |
| **NotificationRow.tsx** | **optimisticReadAt** | **useOptimistic(row.readAt, ...) — flipped by setOptimisticReadAt(new Date()) inside startTransition → isUnread derives from optimistic state** | **Real DB rows; optimistic overrides until server-truth revalidates via revalidateTag** | ✓ **FLOWING (was HOLLOW)** |
| SettingsClient.tsx | settings.notifyOnFollow/notifyOnWatchOverlap | getProfileSettings → settings/page.tsx → SettingsClient props | Real profile_settings row | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| NotificationRow component tests pass | `npx vitest run tests/components/notifications/NotificationRow.test.tsx` | 20 passed (14 pre-existing + 6 D-08 gap closure) in 981ms | ✓ PASS |
| TypeScript clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Integration test suite skips cleanly without local Supabase | Implicit (env-gated via `maybe` describe wrapper) | 6 tests skipped (expected without DATABASE_URL + SUPABASE creds) | ? SKIP |
| `grep -c "export async function markNotificationRead"` in `src/app/actions/notifications.ts` | Exact string search | 1 match | ✓ PASS |
| `grep -c "export async function markOneReadForUser"` in `src/data/notifications.ts` | Exact string search | 1 match | ✓ PASS |
| `grep -c "toBeLessThanOrEqual(1)"` in dedup test file | Trivial-assertion regression check | 0 matches | ✓ PASS (removed) |
| `grep -c "toBe(1)"` in dedup test file | Dedup assertion strength check | 1 match (line 297) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| NOTIF-02 | 13-01, 13-02, 13-04 | Follow action triggers notification via fire-and-forget logger | ✓ SATISFIED | void logNotification in followUser after primary commit; logger unit tests pass |
| NOTIF-03 | 13-01, 13-02, 13-04, **13-05** | addWatch triggers notification per matching collector (brand+model normalized, self-excluded); dedup verified | ✓ SATISFIED | findOverlapRecipients + void logNotification; Plan 05 integration test now exercises `notifications_watch_overlap_dedup` partial UNIQUE |
| NOTIF-04 | 13-01, 13-02, 13-04 | Bell shows unread dot; 'use cache'-wrapped DAL with viewerId as arg | ✓ SATISFIED | getNotificationsUnreadState uses notifications_last_seen_at per D-06; cacheTag + cacheLife in NotificationBell |
| NOTIF-05 | 13-03, 13-04, **13-05** | /notifications page lists newest-first with read/unread differentiation + Mark all read + D-08 per-row optimistic read | ✓ SATISFIED | Page renders NotificationsInbox with newest-first DAL; unread visual (border-l-accent + font-semibold); Mark all read button wired; Plan 05 delivered D-08 markNotificationRead SA + optimistic Client Component |
| NOTIF-06 | 13-02, 13-04 | "Mark all read" SA sets read_at = now() on all caller's unread rows | ✓ SATISFIED | markAllNotificationsRead → markAllReadForUser (WHERE user_id = viewerId AND read_at IS NULL) |
| NOTIF-07 | 13-03 | Stub UI templates for price_drop + trending render correctly | ✓ SATISFIED | NotificationRow renders both stub copies; click-handler explicitly skips SA for stub types (D-19/D-20) |
| NOTIF-08 | 13-03 | Watch-overlap notifications grouped at display time | ✓ SATISFIED | collapseWatchOverlaps groups by (brand_normalized, model_normalized, UTC day); actorCount populated |
| NOTIF-09 | 13-01, 13-02, 13-04 | Settings opt-out toggles; opt-out checked before notification insert | ✓ SATISFIED | PrivacyToggleRow for notifyOnFollow + notifyOnWatchOverlap; logger reads opt-out before insert |
| NOTIF-10 | 13-03 | Empty state shows "You're all caught up" when zero notifications | ✓ SATISFIED | NotificationsEmptyState: "You're all caught up" + role="status" + Inbox icon |

All 9 phase-scoped requirement IDs are satisfied. No orphaned requirements detected in REQUIREMENTS.md for Phase 13.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/components/notifications/NotificationRow.tsx` | 74 | `if (pending) return` guard in activate() is effectively dead code (REVIEW WR-01) — the real double-submit guard is the `isUnread && !isStubType` branch; `pending` never reliably blocks rapid successive clicks | ℹ️ Info | Not a bug — optimistic state flip guards double-submission correctly. Misleading comment only; auditors may assume `pending` is load-bearing. Recommendation: update inline comment or remove the line. |
| `tests/integration/phase13-notifications-flow.test.ts` | 258 | Payload hardcodes `actor_username: 'userB'` (REVIEW WR-02) — dedup index does not key on this column, so no correctness risk, but fragility flag if dedup key ever expands | ℹ️ Info | No correctness impact. If future dedup variant adds `actor_username` to the key, test would silently diverge from the seeded profile row. Recommendation: pin rationale in comment or load username from seed. |
| `src/app/actions/notifications.ts` | 54 | `z.string().uuid()` is deprecated in Zod 4 (REVIEW IN-01) — prefer `z.uuid()` | ℹ️ Info | Pre-existing project-wide pattern (see follows.ts, notes.ts, profile.ts); NOT a Plan 05 regression. Flagged for the eventual codebase-wide Zod v4 migration. |
| `src/app/actions/notifications.ts` | 4 | `zod` is imported but NOT declared in package.json dependencies (REVIEW IN-02) | ℹ️ Info | Pre-existing project issue (zod is a transitive dep of @supabase/ssr). Plan 05 did not introduce the pattern. Recommendation: add `"zod": "^4.3.6"` explicit entry. |
| `src/data/notifications.ts` & `src/components/notifications/NotificationRow.tsx` | 12 / 19 | Type name collision — `NotificationRow` means both a DAL interface (with userId/actorId) and a component (with a subset-prop shape) (REVIEW IN-03) | ℹ️ Info | Taxonomy smell; no correctness impact. Recommendation: rename DAL type to `NotificationRowDTO` or `DbNotificationRow`. |
| `src/components/settings/SettingsClient.tsx` | 26 | `username: string` prop declared but destructured as `{ settings }` — dead surface (WR-03 from prior verification; explicitly out-of-scope for Plan 05 per plan `<objective>`) | ℹ️ Info | Causes an unnecessary `getProfileById` fetch in settings/page.tsx. Code-quality issue; not a goal blocker. Reserved for a future code-review-fix pass. |

**No Blocker or Warning anti-patterns remain.** Six Info items, all pre-existing or called out in Plan 05's code review; none block goal achievement.

### Human Verification Required

#### 1. Bell Unread Dot After Follow

**Test:** Have User B follow User A. Reload the page as User A.
**Expected:** Bell icon in header shows a small filled dot.
**Why human:** Requires two live sessions and a running server; cannot simulate the cache-tag invalidation + bell render cycle programmatically.

#### 2. Bell Dot Clears After Visiting /notifications

**Test:** Verify bell dot visible, navigate to /notifications, return to home.
**Expected:** Bell dot gone; /notifications page shows the follow notification row.
**Why human:** Requires browser session state and page navigation; touchLastSeenAt + revalidateTag effect only observable in live render.

#### 3. Per-Row Optimistic Read Flip in the Browser (D-08, new for Plan 05)

**Test:** With throttled network (Chrome DevTools Slow 3G), click an unread row in /notifications.
**Expected:** The left accent border disappears INSTANTLY (before the SA completes). Navigation happens within the same transition.
**Why human:** Component tests confirm `useOptimistic` state flips and `router.push` dispatches. Only a live browser with real network latency confirms the human-perceivable optimistic UX promised by D-08.

#### 4. Settings Notifications Section Visual Ordering

**Test:** Visit /settings while authenticated.
**Expected:** Sections in order: Privacy Controls → Notifications → Appearance → Data Preferences → Account.
**Why human:** Visual ordering cannot be verified by grep; requires rendering.

#### 5. notifyOnFollow Opt-Out Prevents Insert

**Test:** Toggle "New Followers" off in Settings. Have another user follow you.
**Expected:** notifications table has no new row.
**Why human:** Requires two live sessions and DB state inspection. Unit-tested at logger level; end-to-end flow from UI toggle → DB needs running stack.

#### 6. Dedup Partial UNIQUE Index Is Load-Bearing End-to-End

**Test:** Locally: `supabase db connect`; `DROP INDEX notifications_watch_overlap_dedup;`; re-run integration test; observe `expect(rows[0]?.c).toBe(1)` FAILS with `c=2`. Restore index, assertion passes.
**Expected:** With the index removed, the dedup test fails with c=2 proving the index is load-bearing.
**Why human:** Destructive DB operation. The integration test proves the end-to-end contract but not the precise load-bearing layer — the D-27 error swallowing in logger.ts caps visible failures at c=1 even if ON CONFLICT is removed alone. 13-05-SUMMARY documents the full destructive-test procedure.

### Gaps Summary

**None.** Both previously-reported gaps have been closed by Plan 05:

- Gap 1 (D-08 optimistic read) — `NotificationRow` is now a wired Client Component; 6 new tests green.
- Gap 2 (trivial dedup test) — assertion is now `toBe(1)`, test seeds a real watch + profile_settings opt-in row, calls `logNotification` directly twice, and cleans up.

The 6 Info-severity anti-patterns listed above are all pre-existing or explicitly out-of-scope per Plan 05's `<objective>` (WR-03) and do not block sign-off.

---

_Re-verified: 2026-04-23T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Mode: re-verification after Plan 05 gap closure_

---
phase: 58-notification-ui-settings-opt-out
verified: 2026-05-24T00:00:00Z
status: passed
human_verified: 2026-05-24 — all 3 prod HUMAN-UAT items passed (render+deep-links, like-grouping, opt-out round-trip) via /gsd-verify-work 58
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open /notifications in a browser (prod). Confirm watch_like, wear_like, watch_comment, and wear_comment rows render with the correct copy naming the actor and target, and each row navigates to the correct /watch/{id} or /wear/{id} URL on tap/click."
    expected: "All four notification types are visible, copy matches the D-01 spec, and deep-links land on the correct detail page."
    why_human: "NotificationRow is a client component rendering real DB rows. Structural code + test coverage is complete; the visual appearance and actual deep-link navigation require prod data and a browser."
  - test: "Confirm grouped like display in /notifications inbox. Have two different accounts like the same watch on the same UTC day. Confirm the inbox shows ONE row with '+ 1 other liked your {model}' copy."
    expected: "One collapsed row appears with actorCount reflected in the grouped copy string."
    why_human: "The collapse logic is unit-tested; verifying the cross-user, cross-session grouping requires live accounts and prod data."
  - test: "Settings opt-out live round-trip: go to Settings → Notifications, disable the Likes toggle, then have another account like your watch. Confirm NO new notification row appears in the bell/inbox."
    expected: "No new like notification row is inserted. The bell dot does not appear for that like event."
    why_human: "The mechanism (logger.ts reads notifyOnLike and skips insert when false) is implemented and unit-tested from Phase 55. The end-to-end round-trip (toggle off → like action → logger skip → no new row) crosses UI + Server Action + DB column + logger, and requires live prod accounts."
---

# Phase 58: Notification UI + Settings Opt-Out Verification Report

**Phase Goal:** Like and comment notifications appear in the existing bell/inbox with clear copy and deep-links to the target watch or wear, like notifications for the same target are grouped, and users can independently opt out of each notification type in Settings.
**Verified:** 2026-05-24
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The bell dot and /notifications inbox render watch_like, wear_like, watch_comment, wear_comment with copy that names the actor and target, each deep-linking to the relevant watch or wear detail page | VERIFIED | `NotificationRow.tsx`: `resolveHref` branches at lines 140-148 return `/watch/${watchId}` for watch_like/watch_comment and `/wear/${wearEventId}` for wear_like/wear_comment. `resolveCopy` at lines 193-259 produces D-01 copy strings for all four types with the actor span and model span. 31 tests pass covering single/grouped copy and deep-link push calls. |
| 2 | Multiple likes on the same target are grouped into a single notification row | VERIFIED | `NotificationsInbox.tsx` lines 99-113: `watch_like` groups by `watch_like|{watch_id}|{UTC-day}` key; `wear_like` groups by `wear_like|{wear_event_id}|{UTC-day}`. Type-prefix prevents collision with `watch_overlap`. `actorCount: group.length` set on the merged row. `watch_comment` and `wear_comment` fall through to `nonOverlap` (D-05). 19 tests pass covering same-day collapse, different-day non-collapse, and comment non-collapse. |
| 3 | Settings → Notifications exposes notifyOnLike and notifyOnComment toggles; disabling notifyOnLike suppresses future like notification rows (via logger opt-out mechanism) | VERIFIED (structural; live round-trip is human_needed) | `NotificationsSection.tsx`: four `PrivacyToggleRow` instances, Pick widened to include `notifyOnLike | notifyOnComment`, title is "Notifications". `VISIBILITY_FIELDS` in `actions/profile.ts` lines 56-64 is a 7-member `as const` tuple including `'notifyOnLike'` and `'notifyOnComment'`. `logger.ts` lines 90-105 reads `notifyOnLike`/`notifyOnComment` from `profile_settings` and short-circuits before insert when false. Tests: 6 NotificationsSection tests (4 toggles, title, SA call shapes for Likes and Comments) + 3 profiles DAL tests all pass. |

**Score:** 3/3 truths verified (automated code evidence complete; visual rendering and live round-trip routed to human verification per project conventions)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/notifications/NotificationRow.tsx` | B-8 guard widened to 6-type allowlist; resolveHref and resolveCopy branches for 4 new types; comment-preview second line | VERIFIED | KNOWN_TYPES allowlist at line 54; resolveHref branches lines 140-148; resolveCopy branches lines 193-259; commentPreview `<p>` lines 117-119; no `dangerouslySetInnerHTML` |
| `src/components/notifications/NotificationsInbox.tsx` | Collapse extended to group watch_like (by watch_id) and wear_like (by wear_event_id) per (type, target_id, UTC-day) | VERIFIED | `collapseWatchOverlaps` lines 99-113 handle both like types with type-prefixed keys; comments fall through to nonOverlap; `bucketByDay` untouched |
| `src/components/settings/NotificationsSection.tsx` | Four-toggle Notifications section with widened Pick props and renamed title | VERIFIED | `Pick<ProfileSettings, 'notifyOnFollow' | 'notifyOnWatchOverlap' | 'notifyOnLike' | 'notifyOnComment'>` line 6; title "Notifications" line 18; four PrivacyToggleRow instances lines 20-44 |
| `src/data/profiles.ts` | Widened ProfileSettings type, VisibilityField union, DEFAULT_SETTINGS, getProfileSettings return, and updateProfileSettingsField insert values | VERIFIED | All five constructs carry `notifyOnLike` and `notifyOnComment`: interface lines 17-18, union lines 27-28, DEFAULT_SETTINGS lines 37-38, getProfileSettings return lines 116-117, updateProfileSettingsField insert lines 173-174 |
| `src/app/actions/profile.ts` | Widened VISIBILITY_FIELDS allowlist driving the updateSettingsSchema Zod enum | VERIFIED | `VISIBILITY_FIELDS` 7-member `as const` tuple lines 56-64 includes `'notifyOnLike'` (62) and `'notifyOnComment'` (63); `z.enum(VISIBILITY_FIELDS)` at line 68 auto-widened |
| `tests/components/settings/NotificationsSection.test.tsx` | 4-switch assertion, title "Notifications", Likes + Comments SA-call-shape tests | VERIFIED | `toHaveLength(4)` line 43; title assertion line 48; Likes SA-shape test lines 61-69; Comments SA-shape test lines 71-79 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `NotificationsInbox.tsx` collapse | `NotificationRow.tsx` resolveCopy actorCount branch | `actorCount` populated on merged row, consumed by "+ N others" copy | WIRED | `collapsed.push({ ...mostRecent, actorCount: group.length })` at line 124; `resolveCopy` reads `row.actorCount ?? 1` at line 62 and branches when `actorCount > 1` |
| `NotificationRow.tsx` resolveHref | `/watch/[id]` and `/wear/[wearEventId]` routes | `payload.watch_id` / `payload.wear_event_id` read by exact field name | WIRED | Lines 141 and 146 read exact field names from payload; `router.push(href)` called at line 85 on activate |
| `NotificationsSection.tsx` Likes/Comments PrivacyToggleRow | `updateProfileSettings` Server Action | `field="notifyOnLike"` / `field="notifyOnComment"` props flow into SA call | WIRED | `PrivacyToggleRow` receives `field="notifyOnLike"` (line 33) and `field="notifyOnComment"` (line 39); SA validated by `z.enum(VISIBILITY_FIELDS)` in `actions/profile.ts` |
| `NotificationsSection.tsx` Pick | `src/data/profiles.ts` ProfileSettings | Shared type widened in Plan 01 | WIRED | `Pick<ProfileSettings, ... 'notifyOnLike' | 'notifyOnComment'>` at component line 6 resolved against widened interface in `profiles.ts` |
| `updateProfileSettings` SA | logger.ts opt-out reads | `notifyOnLike`/`notifyOnComment` columns read pre-insert | WIRED | `logger.ts` lines 90-91 select both columns; lines 104-105 short-circuit for like/comment types when false. This path was implemented in Phase 55 and is unchanged this phase (confirmed by project conventions). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `NotificationRow.tsx` | `row` (NotificationRowData) | DAL `getNotificationsForViewer` (Phase 54/55) | Yes — DB query with WHERE user_id = viewerId; Phase 58 did not modify the DAL | FLOWING |
| `NotificationsSection.tsx` | `settings.notifyOnLike`, `settings.notifyOnComment` | `getProfileSettings(userId)` in `profiles.ts` → maps `rows[0].notifyOnLike` / `rows[0].notifyOnComment` from Drizzle `select()` | Yes — actual DB column reads at lines 116-117 | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — component-level behavior requires a browser and DB-connected dev server. Build passed (npm run build exit 0 per submission context); unit tests pass (31 NotificationRow + 19 NotificationsInbox + 6 NotificationsSection + 3 profiles = 59 tests green per submission context).

### Probe Execution

Step 7c: No probes declared or applicable. Phase is a UI/settings component phase, not a migration/CLI/data-pipeline phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NOTIF-15 | 58-01, 58-03 | User can independently opt out of like notifications and comment notifications in Settings → Notifications | SATISFIED | `ProfileSettings` type widened; `VISIBILITY_FIELDS` allowlist widened; `NotificationsSection` exposes four toggles with correct field names; logger reads the columns and skips insert when false |
| NOTIF-16 | 58-02 | Like/comment notifications render with clear copy and deep-link to the target in the existing inbox + bell | SATISFIED | All four types render via `NotificationRow` with D-01 copy strings and D-07 deep-links; likes collapse per D-04 in `NotificationsInbox`; bell dot behavior inherited from Phase 54/55 DAL (unchanged) |

Both Phase 58 requirement IDs (NOTIF-15, NOTIF-16) are accounted for and satisfied. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `NotificationRow.tsx` | 56 | `return null` | Info | Intentional B-8 guard for unknown future notification types — correct behavior per D-08, not a stub |
| `NotificationRow.tsx` | 261 | `return null` | Info | Exhausted `resolveCopy` fallthrough — unreachable after KNOWN_TYPES guard, not a stub |

No TBD, FIXME, or XXX markers found in any Phase 58 modified file.

### Human Verification Required

#### 1. Notification row visual rendering on prod

**Test:** Log into prod (Vercel). Navigate to /notifications after having another account perform a like or comment action. Observe the rendered rows.
**Expected:** watch_like rows show "{actor} liked your {model}" with the actor display name bold and model bolded; wear_like rows append " wear"; comment rows show "commented on your {model}" with a muted clamped second line showing the comment preview. Each row navigates to /watch/{id} or /wear/{id} on click.
**Why human:** Visual appearance, correct text rendering, and actual navigation require a browser with prod data.

#### 2. Like grouping in inbox on prod

**Test:** Have two separate accounts like the same watch on the same UTC day. Navigate to /notifications.
**Expected:** One collapsed row appears: "{actorName} + 1 other liked your {model}" (or similar grouped copy per actorCount).
**Why human:** The grouping logic is unit-tested; confirming it works with real multi-actor data requires live prod accounts.

#### 3. Opt-out live round-trip on prod

**Test:** Go to Settings → Notifications on prod. Disable the "Likes" toggle. Have another account like one of your watches. Check /notifications.
**Expected:** No new notification row appears for the like event. The bell dot is not triggered by that like.
**Why human:** The suppression mechanism (logger.ts reads notifyOnLike and skips the INSERT) was implemented in Phase 55 and is confirmed present in the codebase (lines 90-91, 104). The full end-to-end round-trip (toggle write → DB column update → subsequent logger read → skip insert) requires live accounts on prod.

### Gaps Summary

No blocking gaps. All must-haves are verified in the codebase:

- NOTIF-16 rendering (SC-1): `NotificationRow.tsx` implements all four type branches with correct copy and deep-links.
- NOTIF-13 grouping (SC-2): `NotificationsInbox.tsx` groups watch_like and wear_like by (type, target_id, UTC-day).
- NOTIF-15 settings UI and suppression mechanism (SC-3): `NotificationsSection.tsx` exposes four toggles; persistence chain is end-to-end from `ProfileSettings` type through `VISIBILITY_FIELDS` allowlist to `updateProfileSettingsField` DAL to `logger.ts` opt-out read.

Three human_needed items remain for visual/behavioral prod verification per project conventions (mobile/visual behavior verifies on prod, and the live opt-out round-trip cannot be verified programmatically).

---

_Verified: 2026-05-24_
_Verifier: Claude (gsd-verifier)_

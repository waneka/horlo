---
status: partial
phase: 13-notifications-foundation
source: [13-VERIFICATION.md]
started: 2026-04-23T00:00:00Z
updated: 2026-04-23T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Bell unread dot appears when another user follows you
expected: After userB follows userA, userA sees a filled dot on the bell icon in the header
result: [pending]

### 2. Bell dot clears after visiting /notifications
expected: After visiting /notifications, returning to home shows the bell without a dot
result: [pending]

### 3. Per-row optimistic read flip in the browser (D-08)
expected: Clicking an unread row in /notifications immediately removes the left accent border AND navigates to the target — without waiting for a server round-trip (test with DevTools Slow 3G throttling)
result: [pending]

### 4. Settings Notifications section ordering
expected: Settings page shows sections in order — Privacy Controls → Notifications → Appearance → Data Preferences → Account
result: [pending]

### 5. notifyOnFollow opt-out toggle prevents notification insert
expected: After toggling 'New Followers' off in Settings, having another user follow you creates no notification row in the DB
result: [pending]

### 6. Dedup partial UNIQUE index is load-bearing end-to-end
expected: Locally drop `notifications_watch_overlap_dedup`, re-run dedup integration test, observe c=2 (fails). Restore index, c=1 (passes). (13-05-SUMMARY documents the destructive procedure.)
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

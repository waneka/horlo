---
phase: 58-notification-ui-settings-opt-out
plan: "02"
status: complete
subsystem: notifications-ui
tags: [notifications, ui, tdd, social]
dependency_graph:
  requires: []
  provides: [NOTIF-16-render, NOTIF-16-collapse]
  affects: [src/components/notifications/NotificationRow.tsx, src/components/notifications/NotificationsInbox.tsx]
tech_stack:
  added: []
  patterns: [TDD red-green, KNOWN_TYPES allowlist guard, type-prefixed collapse key]
key_files:
  created: []
  modified:
    - src/components/notifications/NotificationRow.tsx
    - src/components/notifications/NotificationsInbox.tsx
    - tests/components/notifications/NotificationRow.test.tsx
    - tests/components/notifications/NotificationsInbox.test.tsx
decisions:
  - "B-8 guard replaced with KNOWN_TYPES allowlist of 6 values; genuinely-unknown future types still return null (D-08)"
  - "Type-prefixed collapse key (type|targetId|UTC-day) prevents watch_like merging with watch_overlap groups sharing the same watch_id"
  - "comment_preview rendered as plain-text JSX children in <p> — no dangerouslySetInnerHTML (T-58-03)"
  - "wear types append literal ' wear' as a separate <span> after the model span — preserves model bolding"
metrics:
  duration: ~8m
  completed: "2026-05-24"
  tasks_completed: 2
  files_modified: 4
---

# Phase 58 Plan 02: Notification Row Render + Like Collapse Summary

Rendered all four v6.0 social notification types (`watch_like`, `wear_like`, `watch_comment`, `wear_comment`) with locked D-01 copy strings, D-07 deep-links, D-02 comment preview second line, and D-04 like-collapse grouping by (type, target_id, UTC-day).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for NotificationRow 4 new types | cd3564d | tests/components/notifications/NotificationRow.test.tsx |
| 1 (GREEN) | NotificationRow guard + render branches + deep-links + preview | af6d33d | src/components/notifications/NotificationRow.tsx |
| 2 (RED) | Failing tests for NotificationsInbox like collapse | 274a8c6 | tests/components/notifications/NotificationsInbox.test.tsx |
| 2 (GREEN) | NotificationsInbox collapse extended for watch_like + wear_like | 362707f | src/components/notifications/NotificationsInbox.tsx |

## What Was Built

### NotificationRow.tsx — Task 1

**B-8 guard widened (D-08):** Replaced the two-type inequality check with a `KNOWN_TYPES` allowlist of 6 values. Genuinely-unknown future types (e.g. `'price_drop'`) still return null. Guard remains after hooks.

**resolveHref (D-07):**
- `watch_like` | `watch_comment` → `/watch/${payload.watch_id}`
- `wear_like` | `wear_comment` → `/wear/${payload.wear_event_id}`

**resolveCopy (D-01/D-03):**
- `watch_like` single: "{actor} liked your {model}"; grouped: "{actor} + {N-1} others liked your {model}"
- `wear_like` single: "{actor} liked your {model} wear"; grouped: "{actor} + {N-1} others liked your {model} wear"
- `watch_comment`: "{actor} commented on your {model}" (never grouped, D-05)
- `wear_comment`: "{actor} commented on your {model} wear" (never grouped, D-05)

**Comment preview second line (D-02):** `commentPreview` extracted from `row.payload` as plain text, rendered as `<p className="text-xs text-muted-foreground line-clamp-2 mt-1">` — never `dangerouslySetInnerHTML` (T-58-03). Like rows have no `comment_preview` field so the `<p>` is naturally absent.

### NotificationsInbox.tsx — Task 2

**Collapse extended (D-04):** The `collapseWatchOverlaps` function now handles three groupable types via explicit `if/else if` branches before the `nonOverlap` fallthrough:

- `watch_overlap`: legacy key format `${brand}|${model}|${day}` — unchanged
- `watch_like`: `watch_like|${watch_id}|${UTC-day}` — type prefix prevents collision
- `wear_like`: `wear_like|${wear_event_id}|${UTC-day}`
- `follow` / `watch_comment` / `wear_comment`: fall through to `nonOverlap` (D-05)

`bucketByDay` (lines 117-145) and the re-sort block are untouched.

## Test Results

- `NotificationRow.test.tsx`: 31 tests passing (17 existing + 14 new)
- `NotificationsInbox.test.tsx`: 19 tests passing (10 existing + 9 new)
- Total: 50 tests green

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All four new types are fully rendered with wired payload fields.

## Threat Flags

None. `comment_preview` rendered as plain-text JSX children (React auto-escapes). No `dangerouslySetInnerHTML` present. Deep-links use same-origin path literals with server-produced IDs — no open-redirect vector (T-58-04 accepted).

## TDD Gate Compliance

- RED gate: `test(58-02)` commit cd3564d (Task 1), `test(58-02)` commit 274a8c6 (Task 2)
- GREEN gate: `feat(58-02)` commit af6d33d (Task 1), `feat(58-02)` commit 362707f (Task 2)

## Self-Check: PASSED

- `src/components/notifications/NotificationRow.tsx` — exists, contains `watch_like`, `line-clamp-2`, `/wear/`, no `dangerouslySetInnerHTML`
- `src/components/notifications/NotificationsInbox.tsx` — exists, contains `wear_like`, `wear_event_id`
- Commits cd3564d, af6d33d, 274a8c6, 362707f — all present in git log

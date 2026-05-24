---
status: partial
phase: 57-comment-thread-ui-feed-extension-grid-counts
source: [57-VERIFICATION.md]
started: 2026-05-24T00:00:00Z
updated: 2026-05-24T00:00:00Z
---

## Current Test

[awaiting human testing — verify on production after deploy]

## Tests

### 1. GATE-03 two-state locked CTA (multi-account)
expected: On a wishlist watch you do NOT mutually follow, the compose box is replaced by a locked CTA. State 1 (not following the owner) shows "Follow {owner} to comment" with an inline FollowButton. State 2 (you follow them, they don't follow back) shows "{owner} needs to follow you back before you can comment" with NO button. No comment content or count is visible to a gated viewer. An owner always sees the compose box on their own watches.
result: [pending]

### 2. CMNT-05 live character counter timing
expected: Typing toward the limit, the counter is hidden below 450 chars, appears as muted text at 450–479, turns destructive (red) at 480–500, and the textarea hard-stops at 500.
result: [pending]

### 3. Wears-lane bottom-sheet legibility
expected: Opening the comment thread in the wears-lane bottom sheet shows a solid `bg-background` panel (not semi-transparent), z-50, max-h-[60vh] scroll, with comment text fully legible over the photo behind it.
result: [pending]

### 4. DISP-01 grid count line + wishlist gate (multi-account)
expected: On a profile collection/wishlist grid, cards show "♥ N · 💬 M" with each half hidden at its own zero and the whole line absent when both are zero. A non-mutual viewer on a wishlist watch sees the like count but NOT the comment count.
result: [pending]

### 5. Feed 'commented' activity row (multi-account)
expected: After commenting on a watch (or wear), a follower's Network Activity home feed shows a row reading "{username} commented on {Brand Model}" with a thumbnail and no comment-preview text. A wear comment row navigates to /wear/{id}. A comment on a mutual-follow-gated wishlist watch does NOT appear to viewers ineligible to see it.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

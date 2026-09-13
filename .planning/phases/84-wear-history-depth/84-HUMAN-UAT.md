---
status: partial
phase: 84-wear-history-depth
source: [84-VERIFICATION.md]
started: 2026-09-13T17:45:00Z
updated: 2026-09-13T17:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. WR-02 date-preflight gating
expected: Open "Log a wear", pick a past date already logged for a watch → it shows disabled "Already logged". Change the date quickly: no stale disabled/enabled flicker; Submit only enables once the preflight for the selected date returns; reopening the dialog never carries over the previous disabled set.
result: [pending]

### 2. WR-03 error handling
expected: With dev tools offline/throttled, submitting a backfill wear shows an inline "Couldn't log that wear. Please try again." alert; dialog stays open; Submit re-enables (no error-boundary crash).
result: [pending]

### 3. WR-04 unlinked leaderboard rows for private-collection visitors
expected: As a second user viewing a profile with Collection visibility off, leaderboard rows are plain (no href, no hover/focus ring) and don't navigate to /w/[id].
result: [pending]

### 4. WR-05 empty states
expected: No stacked empty-state cards. Owner copy still invites logging a wear; non-owner sees "Try a longer window." with no CTA; the leaderboard is not mounted when the profile has zero wears total.
result: [pending]

### 5. WR-01 plausible-today bound
expected: Normal timezones (UTC-12 to UTC+14) can still log backfill wears; only a device clock more than ~14h off server UTC is rejected with "Check your device's date and try again." (Code-review confirmation acceptable if clock manipulation isn't practical.)
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

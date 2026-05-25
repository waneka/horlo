---
status: partial
phase: 59-unified-route-variant-c
source: [59-VERIFICATION.md]
started: 2026-05-25T07:33:33Z
updated: 2026-05-25T07:33:33Z
---

## Current Test

[awaiting human testing — verify on prod after the next deploy, per project convention]

## Tests

### 1. Non-owner write-surface gating on the unified route (ROUTE-06)
expected: Visiting another user's `/w/[ref]` (cross-user view) shows NO owner write actions — edit, delete, mark-worn, and flag-deal controls are absent. `viewerCanEdit` is server-derived `false` for non-owners on both resolution branches.
result: [pending]

### 2. Unified route mobile render (ROUTE-01)
expected: `/w/[ref]` renders correctly on a mobile device for BOTH an owned watch (same-user framing) and a cross-user watch (cross-user framing) — layout, framing, and detail content display properly.
result: [pending]

### 3. Legacy route hard-404 on prod soft-nav (ROUTE-02)
expected: Soft-navigating to a stale legacy URL (`/watch/[id]` or `/catalog/[catalogId]`) on prod returns a hard 404 with no Router Cache poisoning (no stale content, no client-side error loop on revisit).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

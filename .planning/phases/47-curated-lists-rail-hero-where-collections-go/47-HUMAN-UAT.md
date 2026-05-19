---
status: complete
phase: 47-curated-lists-rail-hero-where-collections-go
source: [47-VERIFICATION.md]
started: 2026-05-19T09:00:00Z
updated: 2026-05-19T16:45:00Z
---

## Current Test

[all tests complete]

## Tests

### 1. Hero renders full-bleed at correct 16:9 aspect ratio
expected: Visiting `/explore` on a desktop viewport shows the Hero as a full-bleed image filling its slot — no black bar, no letterboxed frame, no collapsed height — with the gradient overlay and curator name/title legible.
result: passed — approved by operator 2026-05-19

### 2. Where Collections Go renders correctly at 360px mobile width
expected: At 360px viewport width each path shows as a numbered vertical stack (1 → 2 → 3 ...) with numbered badges and visible connector lines between nodes, readable rationale text, and nothing clipped or overlapping.
result: passed — approved by operator 2026-05-19

### 3. Pinning or unpublishing a list updates the Hero immediately on reload
expected: In `/admin/lists`, pinning a different eligible list (or unpublishing the currently-featured list) and immediately reloading `/explore` shows the updated Hero — no stale content and no TTL wait required.
result: passed — approved by operator 2026-05-19

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None — all human verification items passed.

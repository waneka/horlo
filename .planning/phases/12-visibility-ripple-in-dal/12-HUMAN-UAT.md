---
status: partial
phase: 12-visibility-ripple-in-dal
source: [12-VERIFICATION.md]
started: 2026-04-22T22:52:00Z
updated: 2026-04-22T22:52:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Prod smoke test: verify worn_public column is absent in production database
expected: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profile_settings' AND column_name='worn_public'` returns 0 rows
result: [pending]

### 2. Browser smoke: /settings renders 3 toggles (Profile, Collection, Wishlist) with no error after prod column drop
expected: Settings page loads, all 3 toggles interactive, no runtime errors, no `wornPublic` reference
result: [pending]

### 3. Browser smoke: /u/<self>/worn shows own wears correctly after column drop
expected: Worn tab renders without error; owner sees all own wears including private ones; non-owner sees only public/followers tier
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

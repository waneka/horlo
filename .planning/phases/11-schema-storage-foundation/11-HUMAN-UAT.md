---
status: partial
phase: 11-schema-storage-foundation
source: [11-VERIFICATION.md]
started: 2026-04-22T00:00:00Z
updated: 2026-04-22T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SECURITY DEFINER helper privilege check (WR-01)
expected: Either `has_function_privilege('authenticated'|'anon', 'public.get_wear_event_visibility_bypassing_rls(uuid)', 'EXECUTE')` returns `false` for anon and/or privilege-denied on direct RPC call, OR the WR-01 fix from 11-REVIEW.md is applied (REVOKE EXECUTE FROM PUBLIC/anon + GRANT EXECUTE TO authenticated on each helper, or collapse to a single boolean `can_view_wear_photo(wear_event_id, viewer_id)` helper) before `supabase db push --linked`. Do NOT deploy Migration 4b to production with PUBLIC EXECUTE on these three helpers — `get_wear_event_owner_bypassing_rls` leaks `user_id`.
result: [pending]

### 2. Incognito 403 for private wear photo (Roadmap SC-3)
expected: Browser incognito window requesting a Supabase Storage URL for a `visibility='private'` wear photo returns HTTP 403 (or storage error) — not 200 with photo bytes. Integration tests cover the 9-cell access matrix for authenticated viewers but Roadmap SC-3 explicitly calls out the unauthenticated incognito case.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

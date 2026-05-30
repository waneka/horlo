---
status: partial
phase: 73-owned-redirect-route-fix
source: [73-VERIFICATION.md]
started: 2026-05-30T18:13:00Z
updated: 2026-05-30T18:13:00Z
---

## Current Test

[awaiting human testing — prod walk for ROUTE-01]

## Tests

### 1. ROUTE-01 — owned watch click from search popup renders detail page (no 404)
expected: After deploy, open the add-watch popup on prod, search for any owned watch in your collection, click the "In collection" result. The browser navigates to `/w/<uuid>` and the D-06 in-place owned view renders: hero (image + brand/model/reference), verdict-hidden-on-owned (no Collection Fit card per `verdict_hidden_on_owned_watches` memory), and the comment thread. No 404, no blank page. Works on both desktop and mobile.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

*(none reported yet)*

## Notes

- **Bundle preference:** ship with Phase 74 deploy if Phase 74 lands in the same session (per CONTEXT.md D-09 step 3).
- **Out of scope:** per `feedback_ppr_cache_fill_no_longer_call_out`, do NOT include soft-nav-#419 or cache-fill checks in this UAT — #419 family is resolved infrastructure.
- **Why human:** local DB lacks meaningful catalog/owned data (CONTEXT.md D-10 + `feedback_mobile_ui_verify_on_prod`).

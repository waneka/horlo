---
phase: "04"
plan: 3
plan_name: proxy-and-api-gate
subsystem: authentication
tags: [phase-4, wave-3, proxy, api-gate, auth]
requirements: [AUTH-02, AUTH-04]
wave: 3
depends_on: [2]
dependency_graph:
  requires:
    - "src/lib/supabase/proxy.ts updateSession() (from 04-02)"
    - "src/lib/auth.ts getCurrentUser + UnauthorizedError (from 04-02)"
    - "tests/proxy.test.ts stubs (from 04-01)"
    - "tests/api/extract-watch-auth.test.ts stubs (from 04-01)"
  provides:
    - "proxy.ts — deny-by-default session enforcement for all app routes"
    - "src/app/api/extract-watch/route.ts — 401 auth gate before SSRF check"
  affects:
    - "proxy.ts (new at repo root)"
    - "src/app/api/extract-watch/route.ts (auth gate added)"
tech-stack:
  added: []
  patterns:
    - "proxy.ts at repo root — Next 16 convention (not middleware.ts)"
    - "Deny-by-default matcher via negative-lookahead regex"
    - "PUBLIC_PATHS allowlist inside proxy function body (not matcher) so /login etc. still get cookie refresh"
    - "updateSession response returned verbatim to propagate refreshed Set-Cookie headers"
    - "Auth gate first in route handler (cheapest rejection before SSRF check)"
key-files:
  created:
    - path: "proxy.ts"
      purpose: "Next 16 proxy — deny-by-default session enforcement + /login?next= redirect + cookie refresh"
  modified:
    - path: "src/app/api/extract-watch/route.ts"
      change: "Added getCurrentUser() 401 gate as first statement in POST handler, before request.json()"
    - path: "tests/proxy.test.ts"
      change: "Replaced 8 it.todo stubs with 9 real passing assertions for AUTH-02"
    - path: "tests/api/extract-watch-auth.test.ts"
      change: "Replaced 3 it.todo stubs with 4 real passing assertions for AUTH-04"
decisions:
  - "proxy.ts at repo root (not src/) — matches existing config files, simpler path resolution"
  - "PUBLIC_PATHS checked inside function body, not in matcher — ensures /login etc. still get cookie refresh via updateSession"
  - "Auth gate in route handler uses try/catch around getCurrentUser() — rethrows non-UnauthorizedError exceptions so unexpected server errors bubble to 500 handler"
metrics:
  duration_minutes: 12
  tasks_completed: 2
  files_created: 1
  files_modified: 3
  completed_date: 2026-04-13
---

# Phase 4 Plan 3: Proxy and API Gate Summary

**One-liner:** Shipped deny-by-default `proxy.ts` (Next 16 convention) with `/login?next=` redirect + refreshed-cookie propagation, and added a `getCurrentUser()` 401 gate to `/api/extract-watch` that fires before URL parsing and the existing SSRF check.

## Outcome

Both AUTH-02 enforcement points are now live:

1. **proxy.ts** — every non-static-asset request hits the proxy; unauthenticated requests to non-public paths redirect to `/login?next=<pathname+search>`; authenticated requests get session cookies refreshed via `updateSession` before the response is returned.
2. **`/api/extract-watch` 401 gate** — `getCurrentUser()` runs as the very first statement in the POST handler, short-circuiting with `401 { error: 'Unauthorized' }` before URL parsing or SSRF validation. The existing Phase 1 SSRF check (SEC-01) is preserved and still runs for authenticated requests.

Test suite: **56 tests passing, 0 failures** across `tests/proxy.test.ts`, `tests/api/extract-watch-auth.test.ts`, `tests/ssrf.test.ts`.

## Task Log

### Task 1 — Create proxy.ts at repo root with deny-by-default matcher
- Commit: `571b35e`
- TDD RED: wrote 9 real test assertions in `tests/proxy.test.ts` (replacing 8 todos) — failed because proxy.ts was absent
- TDD GREEN: created `proxy.ts` verbatim from plan `<interfaces>` block
- 9 tests passing: redirect on `/`, search param preservation, 5 public path pass-throughs, authenticated pass-through, matcher config assertion
- Confirmed: `middleware.ts` does NOT exist; `proxy.ts` is at repo root

### Task 2 — Add getCurrentUser 401 gate to /api/extract-watch route handler
- Commit: `14c3fcf`
- TDD RED: wrote 4 real test assertions in `tests/api/extract-watch-auth.test.ts` (replacing 3 todos) — 2 failed because auth gate was absent
- TDD GREEN: added `import { UnauthorizedError, getCurrentUser } from '@/lib/auth'` and try/catch block at top of POST handler before `request.json()`
- 4 auth gate tests passing; 43 ssrf tests still passing (zero regression)
- Verified: `getCurrentUser` on line 10, `request.json()` on line 19 — auth runs first

## Deviations from Plan

None — plan executed exactly as written. The verbatim proxy.ts from the plan's `<interfaces>` block was used without modification. The route handler modification follows the exact `<action>` block ordering.

## Authentication Gates

None. Both tasks are unit-test-only and need no live Supabase session.

## Known Stubs

None. All stubs from Plan 01 assigned to this plan have been replaced with real passing assertions:

| File | Stubs replaced |
|------|---------------|
| `tests/proxy.test.ts` | 8 todos → 9 real tests |
| `tests/api/extract-watch-auth.test.ts` | 3 todos → 4 real tests |

## Threat Surface Scan

No new network endpoints or auth paths introduced beyond what the plan's threat model anticipated. `proxy.ts` implements T-4-01 (deny-by-default matcher) and T-4-06 (login?next= redirect) exactly as specified. Route handler implements T-4-07 (401 gate) exactly as specified.

## Commits

- `571b35e` — feat(04-03): add deny-by-default proxy.ts with /login?next= redirect
- `14c3fcf` — feat(04-03): add getCurrentUser 401 gate to /api/extract-watch

## Self-Check: PASSED

- FOUND: proxy.ts at repo root
- FOUND: src/app/api/extract-watch/route.ts contains getCurrentUser at line 10 (before request.json at line 19)
- FOUND: tests/proxy.test.ts — 9 passing tests, 0 todo
- FOUND: tests/api/extract-watch-auth.test.ts — 4 passing tests, 0 todo
- FOUND: commit 571b35e
- FOUND: commit 14c3fcf
- VERIFIED: middleware.ts does NOT exist
- VERIFIED: 56 total tests passing across proxy + auth gate + ssrf suites

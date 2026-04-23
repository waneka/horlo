---
phase: 14-nav-shell-explore-stub
plan: 01
subsystem: routing/auth-gate
tags: [nav, auth, proxy, constants, tdd]
requirements: [NAV-05]
dependency_graph:
  requires: []
  provides:
    - "PUBLIC_PATHS readonly tuple"
    - "isPublicPath(pathname) predicate"
    - "PublicPath type"
  affects:
    - src/proxy.ts
tech_stack:
  added: []
  patterns:
    - "Shared constants in src/lib/constants/"
    - "`as const` readonly tuples for compile-time immutability"
    - "Parity tests via `it.each(TUPLE)` to prevent future drift"
key_files:
  created:
    - src/lib/constants/public-paths.ts
    - tests/lib/public-paths.test.ts
    - .planning/phases/14-nav-shell-explore-stub/deferred-items.md
  modified:
    - src/proxy.ts
    - tests/proxy.test.ts
decisions:
  - "D-21/D-22 honored: single PUBLIC_PATHS source, no inline duplication across proxy + client nav"
  - "Predicate rejects /loginfoo-style prefix overmatches via exact/prefix-slash/prefix-query rule"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-23"
  tasks_completed: 2
  tests_added: 17
---

# Phase 14 Plan 01: Shared PUBLIC_PATHS Constant Summary

Extract the auth-route list from `src/proxy.ts` into a reusable `src/lib/constants/public-paths.ts` module with a tuple + predicate API, so BottomNav (Plan 03) and SlimTopNav (Plan 04) can import the exact same gate the server proxy uses — eliminating regex/string-literal drift that would leak authenticated chrome on `/login` (T-14-01-03).

## What Shipped

### New module: `src/lib/constants/public-paths.ts`

- `PUBLIC_PATHS` — readonly tuple `['/login', '/signup', '/forgot-password', '/reset-password', '/auth']` via `as const`
- `PublicPath` — union type derived from the tuple
- `isPublicPath(pathname: string): boolean` — matches exact, prefix+`/`, or prefix+`?`; rejects `/loginfoo` while accepting `/auth/callback` and `/auth?x=1`

### Refactor: `src/proxy.ts`

- Deleted inline `const PUBLIC_PATHS = [...]` array (L4–10)
- Added `import { isPublicPath } from '@/lib/constants/public-paths'`
- Replaced `PUBLIC_PATHS.some((p) => pathname.startsWith(p))` with `isPublicPath(pathname)`
- All other behavior preserved byte-for-byte: auth redirect with `next=` preservation, dev log line, matcher config

### Test coverage

| File | New tests | Covers |
|---|---|---|
| `tests/lib/public-paths.test.ts` | 12 | tuple shape + ordering, predicate semantics, overmatch rejection |
| `tests/proxy.test.ts` | 5 new (14 total) | `it.each(PUBLIC_PATHS)` parity block — proves proxy and nav consumers share one list (NAV-05 D-21) |

Total: 17 new test cases, 26 combined passing (`tests/lib/public-paths.test.ts` + `tests/proxy.test.ts`).

## Commits

| Task | Type | Hash | Description |
|---|---|---|---|
| 1 (RED) | test | `b161297` | Failing tests for PUBLIC_PATHS + isPublicPath |
| 1 (GREEN) | feat | `0b2c8af` | Shared PUBLIC_PATHS constant + isPublicPath predicate |
| 2 | refactor | `fb80d83` | proxy.ts consumes shared PUBLIC_PATHS constant |

## Verification Results

- `npm test -- --run tests/lib/public-paths.test.ts` → 12 passed
- `npm test -- --run tests/proxy.test.ts` → 14 passed (9 original + 5 new parity)
- `npx tsc --noEmit` → no new errors introduced (one pre-existing `LayoutProps` error in `src/app/u/[username]/layout.tsx` unrelated to this plan — see `deferred-items.md`)
- Single-source grep (`'/login'.*'/signup'` multiline across `src/`) → exactly one match: `src/lib/constants/public-paths.ts`

## Threat Mitigations Delivered

| Threat ID | Status |
|---|---|
| T-14-01-01 (proxy↔nav public-path drift) | Mitigated — shared constant + parity test on `it.each(PUBLIC_PATHS)` |
| T-14-01-02 (`/loginfoo` overmatch) | Mitigated — predicate uses exact OR `startsWith(${p}/)` OR `startsWith(${p}?)`; `/notifications` test T11 locks the rule against future regression |
| T-14-01-03 (nav chrome leak on `/login`) | Partially mitigated — constant ready for Plans 03/04 to consume; client-side render gate still to land in those plans |

## Deviations from Plan

None — plan executed exactly as written. TDD flow produced both RED and GREEN commits for Task 1 as specified.

## Deferred Issues

Logged to `.planning/phases/14-nav-shell-explore-stub/deferred-items.md`:

1. **Pre-existing TS error** — `src/app/u/[username]/layout.tsx:21` reports `TS2304: Cannot find name 'LayoutProps'`. Reproduced on base `ed1dc1d` with no Plan 14-01 edits. Out of scope for this plan.

## Downstream Consumers

- **Plan 03** — `src/components/layout/BottomNav.tsx` will `import { isPublicPath } from '@/lib/constants/public-paths'` and render `null` when the predicate is true
- **Plan 04** — `src/components/layout/SlimTopNav.tsx` will apply the same gate for the authenticated top chrome

Both plans now have a stable, type-safe, test-covered import target.

## Key Decisions

1. **Predicate semantics tightened vs original proxy** — the original proxy used raw `startsWith(p)`, which would falsely match `/loginfoo`. The shared predicate uses exact-match OR prefix-slash OR prefix-query, eliminating the theoretical overmatch without changing behavior for any real route (all 9 existing proxy tests still pass, including the 5 `/login`, `/signup`, etc. fixtures).
2. **Parity test block in `tests/proxy.test.ts`** — `it.each(PUBLIC_PATHS)` iterates the imported tuple at runtime so adding/removing a public path automatically adjusts the assertion set. Locks in NAV-05 D-21 (single source of truth) against future drift.

## Self-Check: PASSED

- `src/lib/constants/public-paths.ts` → FOUND
- `tests/lib/public-paths.test.ts` → FOUND
- `.planning/phases/14-nav-shell-explore-stub/deferred-items.md` → FOUND
- `src/proxy.ts` → MODIFIED (inline array removed, import added)
- `tests/proxy.test.ts` → MODIFIED (parity block appended)
- Commit `b161297` → FOUND
- Commit `0b2c8af` → FOUND
- Commit `fb80d83` → FOUND

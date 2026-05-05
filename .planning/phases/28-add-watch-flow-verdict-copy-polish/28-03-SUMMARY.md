---
phase: 28-add-watch-flow-verdict-copy-polish
plan: 03
subsystem: ui
tags: [next-js, server-component, security, open-redirect, vitest, typescript]

# Dependency graph
requires:
  - phase: 22-set-06
    provides: auth-callback open-redirect-safe regex (/^\/(?!\/)[^\\\r\n\t]*$/) — reused verbatim
  - phase: 20.1-add-watch-flow
    provides: AddWatchFlow orchestrator + initialX props pattern + /watch/new server-side searchParams whitelist
  - phase: 13-profiles
    provides: getProfileById data accessor for username resolution
provides:
  - "src/lib/watchFlow/destinations.ts — RETURN_TO_REGEX, validateReturnTo, defaultDestinationForStatus, canonicalize (pure helpers)"
  - "src/lib/watchFlow/destinations.test.ts — 15 unit tests including auth-callback regex source-equality parity assertion"
  - "/watch/new server-side returnTo validation + viewerUsername resolution"
  - "AddWatchFlow typed props initialReturnTo + viewerUsername (Plan 05 will consume)"
affects: [28-04-toast-suppress, 28-05-callsite-append-and-nav-on-commit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-helper extraction for cross-callsite reuse (src/lib/watchFlow/destinations.ts)"
    - "Source-equality regex parity assertion replacing escape-fragile cross-file grep"
    - "Server-side path-validation chokepoint with two-stage whitelist (regex + self-loop guard)"

key-files:
  created:
    - src/lib/watchFlow/destinations.ts
    - src/lib/watchFlow/destinations.test.ts
  modified:
    - src/app/watch/new/page.tsx
    - src/components/watch/AddWatchFlow.tsx
    - src/components/watch/AddWatchFlow.test.tsx

key-decisions:
  - "RETURN_TO_REGEX exported from destinations.ts; auth-callback parity locked via .source string-equality assertion (replaces cross-file grep)"
  - "canonicalize early-returns unchanged path when viewerUsername is null (caller treats null as 'do not suppress')"
  - "AddWatchFlow lands the new props with `void` markers; Plan 05 owns actual consumption (handleWishlistConfirm + WatchForm pass-through)"
  - "BottomNav left untouched — D-09 phantom (no Add slot since Phase 18) verified by `grep -c 'watch/new' BottomNav.tsx === 0`"

patterns-established:
  - "Pattern: Pure-helper module under src/lib/watchFlow/ for shared Add-Watch flow logic — Plan 04 + Plan 05 import without duplication"
  - "Pattern: Regex source-equality fixture (`.source === '<literal>'`) for cross-file regex parity contracts (no escape-fragile grep)"
  - "Pattern: Two-stage path whitelist (auth-callback regex + self-loop startsWith guard) — reusable for future returnTo / next params"

requirements-completed: [ADD-08]

# Metrics
duration: 6min
completed: 2026-05-05
---

# Phase 28 Plan 03: /watch/new returnTo Whitelist + Shared Destinations Module Summary

**Server-side `?returnTo=` open-redirect whitelist plus a shared pure-helpers module (`src/lib/watchFlow/destinations.ts`) exposing RETURN_TO_REGEX, validateReturnTo, defaultDestinationForStatus, and canonicalize — foundation for Plan 04 (toast suppress) + Plan 05 (callsite append + nav-on-commit).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-05T01:40:16Z
- **Completed:** 2026-05-05T01:46:00Z (approx)
- **Tasks:** 2
- **Files modified:** 3 (page.tsx, AddWatchFlow.tsx, AddWatchFlow.test.tsx)
- **Files created:** 2 (destinations.ts, destinations.test.ts)

## Accomplishments

- Shipped pure helpers in `src/lib/watchFlow/destinations.ts`:
  - `RETURN_TO_REGEX` — exported open-redirect-safe regex copied **verbatim** from `src/app/auth/callback/route.ts:60-61` (no novel regex authored).
  - `validateReturnTo` — two-stage whitelist (regex check + `startsWith('/watch/new')` self-loop guard).
  - `defaultDestinationForStatus(status, username)` — D-02/D-13 status→tab mapping (`wishlist`/`grail` → `/u/{username}/wishlist`, `owned`/`sold` → `/u/{username}/collection`); null username returns `/` as soft fallback.
  - `canonicalize(path, viewerUsername)` — D-05/D-06 path canonicalization (resolves `/u/me/` shorthand, strips query string, strips trailing slash); null username returns path unchanged so caller's path-equality fails ("do not suppress").
- 15 unit tests (1 source-equality + 14 behavioral; exceeds 12+ requirement). The source-equality assertion (`RETURN_TO_REGEX.source === '^\\/(?!\\/)[^\\\\\\r\\n\\t]*$'`) makes the auth-callback parity contract a **code-level invariant** — replaces the escape-fragile cross-file grep flagged by the planner-checker (warnings #7 / #12).
- `/watch/new` Server Component:
  - Imports `validateReturnTo` + `getProfileById`.
  - Extends `searchParams` interface with `returnTo?: string`.
  - Validates `sp.returnTo` server-side → `initialReturnTo: string | null`.
  - Resolves `viewerUsername` via `getProfileById(user.id)?.username` (folded into existing `Promise.all` for parallel fetch with `getWatchesByUser` + catalog prefill).
  - Threads both as typed props into `<AddWatchFlow ... />`.
- AddWatchFlow exposes the two new props (`initialReturnTo: string | null`, `viewerUsername: string | null`); both have `void` markers to satisfy `noUnusedParameters` until Plan 05 wires actual consumption.

## Task Commits

Each task was committed atomically. Task 1 used TDD (RED → GREEN):

1. **Task 1 RED:** add failing tests for watchFlow destinations helpers — `a038d8e` (test)
2. **Task 1 GREEN:** implement watchFlow destinations pure helpers — `d698810` (feat)
3. **Task 2:** wire returnTo whitelist + viewerUsername resolution at /watch/new — `e147c02` (feat)

## Files Created/Modified

### Created
- `src/lib/watchFlow/destinations.ts` (89 LOC) — pure helpers + RETURN_TO_REGEX export. No React, no Drizzle, no I/O. Importable from any layer (Server Component, Client Component, test).
- `src/lib/watchFlow/destinations.test.ts` (103 LOC) — 15 vitest cases organized into 4 describe blocks.

### Modified
- `src/app/watch/new/page.tsx` — +18 LOC: imports, searchParams extension, validation block, parallel viewer-profile fetch, two new render props.
- `src/components/watch/AddWatchFlow.tsx` — +18 LOC: two new prop slots on `AddWatchFlowProps`, two new destructure entries, two `void` markers (Plan 05 will replace).
- `src/components/watch/AddWatchFlow.test.tsx` — +24 LOC across 12 render fixtures: each gets `initialReturnTo={null}` + `viewerUsername={null}` (Rule 3 — fix blocking test fixtures broken by required-prop addition).

## Test Coverage Shipped

15 vitest cases in `destinations.test.ts`:

| # | Group | Case |
|---|-------|------|
| 1 | RETURN_TO_REGEX | Source-equality parity vs literal fixture (`'^\\/(?!\\/)[^\\\\\\r\\n\\t]*$'`) — auth-callback parity invariant |
| 2 | validateReturnTo | Accepts valid same-origin paths (`/search?q=tudor`, `/u/twwaneka/collection`, `/`) |
| 3 | validateReturnTo | Rejects protocol-relative URLs (`//evil.com`, `//evil.com/path`) — open-redirect class 1 |
| 4 | validateReturnTo | Rejects backslash + CR + LF + tab (header-injection vectors) — open-redirect classes 2/3/4/5 |
| 5 | validateReturnTo | Rejects self-loop (`/watch/new`, `/watch/new?...`, `/watch/new/manual`) — D-11 self-loop guard |
| 6 | validateReturnTo | Rejects non-string values (undefined, null, number, array) — type-safety |
| 7 | validateReturnTo | Rejects empty string + bare-non-slash strings (`'search'`, `http://evil.com`) |
| 8 | defaultDestinationForStatus | Routes `wishlist`/`grail` → `/u/{username}/wishlist` |
| 9 | defaultDestinationForStatus | Routes `owned`/`sold` → `/u/{username}/collection` |
| 10 | defaultDestinationForStatus | Returns `/` soft fallback when username is null |
| 11 | canonicalize | Resolves `/u/me/` shorthand to actual username |
| 12 | canonicalize | Strips query string |
| 13 | canonicalize | Strips trailing slash when path length > 1 (preserves `/`) |
| 14 | canonicalize | Returns path unchanged when viewerUsername is null |
| 15 | canonicalize | Does NOT alter paths that don't start with `/u/me/` |

All 5 open-redirect attack categories from RESEARCH (protocol-relative, backslash, CR, LF, tab) are explicitly tested and return null.

`AddWatchFlow.test.tsx` (existing 12 tests) still passes after the prop additions — `vitest run` reports 12/12 green.

## Decisions Made

- **canonicalize semantics with null username:** the JSDoc + test fixture in the plan said "returns path unchanged" but the planner's drafted implementation always stripped query strings. Aligned with the documented contract (early-return on null) — it makes the suppress-comparison correctly fail in the soft-alarm case. Documented as Rule 1 deviation.
- **Server-side viewer-profile fetch placement:** folded `getProfileById(user.id)` into the existing `Promise.all` block in /watch/new rather than awaiting it serially — preserves the page's parallel-fetch character and adds zero latency on the critical path.
- **`void` markers on AddWatchFlow:** required to keep TypeScript happy without consuming the new props in this plan. Plan 05 will replace them with actual usage in `handleWishlistConfirm` + the `<WatchForm>` prop pass-through. The markers are intentionally minimal and explicitly comment-flagged as Plan 05 successors.
- **BottomNav D-09 phantom verification:** `grep -c 'watch/new' src/components/layout/BottomNav.tsx === 0` confirmed no Add slot exists. CONTEXT D-09 listed BottomNav as a callsite candidate but the slot was dropped in Phase 18; this is a known phantom and Plan 03 explicitly does NOT modify BottomNav.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] canonicalize implementation contradicted JSDoc + test contract for null username**
- **Found during:** Task 1 GREEN phase (vitest run)
- **Issue:** The plan's drafted JSDoc and test fixture asserted `canonicalize('/search?q=tudor', null) === '/search?q=tudor'` (path unchanged), but the drafted implementation always stripped query strings regardless of username. One test failed: expected `/search?q=tudor`, received `/search`.
- **Fix:** Added an early-return `if (!viewerUsername) return path` at the top of canonicalize. This aligns the implementation with the documented contract: when username is null, the caller cannot perform a meaningful comparison, so the function returns the path verbatim and the path-equality check naturally fails ("do not suppress").
- **Files modified:** `src/lib/watchFlow/destinations.ts`
- **Verification:** All 15 tests pass after the fix.
- **Committed in:** `d698810` (Task 1 GREEN).

**2. [Rule 3 — Blocking] AddWatchFlow.test.tsx broken by required-prop addition**
- **Found during:** Task 2 (after AddWatchFlow.tsx prop additions)
- **Issue:** `npx tsc --noEmit` reported 12 new TS2739 errors in `src/components/watch/AddWatchFlow.test.tsx` — every render fixture was missing the new `initialReturnTo` + `viewerUsername` required props.
- **Fix:** Added `initialReturnTo={null}` + `viewerUsername={null}` to all 12 render fixtures (used `replace_all` on the unique-enough `initialStatus={null}\n      />,` pattern).
- **Files modified:** `src/components/watch/AddWatchFlow.test.tsx`
- **Verification:** Total tsc error count returned to baseline (28 → 28); `vitest run AddWatchFlow.test.tsx` reports 12/12 green.
- **Committed in:** `e147c02` (Task 2 commit).

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking)
**Impact on plan:** Both fixes were necessary for correctness/build-pass and stayed strictly within the plan's stated contract. No scope creep.

## Issues Encountered

- **Pre-existing TypeScript errors in `tests/`:** `npx tsc --noEmit` exits non-zero on baseline (29 errors before Plan 03; 28 after). All errors are in `tests/components/...` and `tests/integration/...` — none in any file Plan 03 touches. Logged to `.planning/phases/28-add-watch-flow-verdict-copy-polish/deferred-items.md`. Plan 03's tsc verification criterion is satisfied in spirit (zero new errors introduced; one pre-existing error reduced).

## Auth Gates

None — Plan 03 introduces no new authentication paths. The validation chokepoint reuses the existing auth-callback regex; the username resolution reuses the existing `getProfileById` data accessor.

## Threat Surface Notes

The plan's `<threat_model>` includes 5 threats (T-28-03-01 through T-28-03-05); all are mitigated or accepted as documented:

| Threat ID | Status |
|-----------|--------|
| T-28-03-01 (Open redirect via `?returnTo=`) | mitigated — validateReturnTo + 7 test cases covering all 5 attack categories |
| T-28-03-02 (viewerUsername info disclosure) | accepted — already exposed via UserMenu, profile pages, FollowButton |
| T-28-03-03 (CRLF header injection) | mitigated — regex `[^\\\r\n\t]*` + 4 test cases (CR, LF, tab, backslash) |
| T-28-03-04 (Self-loop DoS) | mitigated — `startsWith('/watch/new')` guard + 3 test cases |
| T-28-03-05 (Plan 04/05 bypass) | accepted (cross-plan) — Plans 04+05 will read from `initialReturnTo` PROP not URL |

No new threat surface introduced beyond those enumerated in the plan.

## Next Phase Readiness

Plan 04 (toast suppress) and Plan 05 (callsite append + nav-on-commit) can now `import { canonicalize, defaultDestinationForStatus } from '@/lib/watchFlow/destinations'` without code duplication. The validated `initialReturnTo` and resolved `viewerUsername` flow into AddWatchFlow as typed props, ready for consumption in Plan 05's `handleWishlistConfirm` rewrite + WatchForm prop pass-through.

The auth-callback regex parity is now a code-level invariant — if either regex drifts, the source-equality assertion in `destinations.test.ts` fails and the test suite blocks the change.

## Self-Check: PASSED

- File `src/lib/watchFlow/destinations.ts` exists ✓
- File `src/lib/watchFlow/destinations.test.ts` exists ✓
- File `src/app/watch/new/page.tsx` modified ✓
- File `src/components/watch/AddWatchFlow.tsx` modified ✓
- File `src/components/watch/AddWatchFlow.test.tsx` modified (test fixtures) ✓
- Commit `a038d8e` (RED) exists ✓
- Commit `d698810` (GREEN) exists ✓
- Commit `e147c02` (Task 2) exists ✓
- `npx vitest run src/lib/watchFlow/destinations.test.ts` exits 0 with 15/15 ✓
- `npx vitest run src/components/watch/AddWatchFlow.test.tsx` exits 0 with 12/12 ✓
- `RETURN_TO_REGEX.source === '^\\/(?!\\/)[^\\\\\\r\\n\\t]*$'` — verified via test #1 ✓
- `BottomNav` untouched — `grep -c 'watch/new' src/components/layout/BottomNav.tsx === 0` ✓

---
*Phase: 28-add-watch-flow-verdict-copy-polish*
*Completed: 2026-05-05*

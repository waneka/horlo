---
phase: 51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta
plan: 05
subsystem: auth

tags: [supabase, proxy, nextjs-16, router-cache, ppr, branch-b, re-gate, no-store]

# Dependency graph
requires:
  - phase: 51
    plan: 04
    provides: "Cookie-only proxy session resolution in updateSession (no Supabase API round-trip) — hard prerequisite that makes the /u/* re-gate safe from recurrence-2 Router Cache poisoning"
  - phase: 51
    plan: 01
    provides: "Phase 51 test scaffolds (tests/profile-route-51.test.ts) — REQ-51-04, -05, -06 unit assertions"
provides:
  - "Re-gated proxy: anon viewers of /u/* receive a 307 → /login (REQ-51-07 contract)"
  - "Cache-Control: no-store on every NextResponse.redirect() to /login (defense in depth against Router Cache storage of intentional 307s)"
  - "Removal of dead code (isProfilePath function + isProfile local variable) — recurrence-2 fix path fully reverted at the proxy layer"
affects:
  - "51-06 (preview deploy + prod verification gate — now verifies REQ-51-07 against Vercel edge)"
  - "Any future caller of /u/* in incognito/anon context (they will hit /login redirect via the proxy before the page renders)"
  - "ProfileGate's viewerId === null branch becomes unreachable for /u/* page renders (still retained as defense in depth per 51-PLAN.md invariant 3)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auth-gate 307 responses MUST carry Cache-Control: no-store when issued from src/proxy.ts (Next 16 Router Cache mitigation)"
    - "Proxy auth-gate predicate is the canonical form `if (!user && !isPublic)` — no per-route allow-list inside the conditional"
    - "Dead-code removal pattern: when a feature flag predicate (isProfilePath) is reverted, delete the predicate function from the source-of-truth module to prevent future misuse"

key-files:
  created: []
  modified:
    - "src/proxy.ts"
    - "src/lib/constants/public-paths.ts"
    - "tests/proxy.test.ts"

key-decisions:
  - "Set Cache-Control: no-store on ALL 307 → /login responses from proxy.ts — not only on /u/* redirects. Rationale: the Router Cache poisoning vector (intentional 307 stored as a regular cacheable response) applies to any auth-gated route, not just /u/*. Defense in depth costs one line per redirect."
  - "Updated the existing AUTH-02 and non-profile-protected-route specs to also assert Cache-Control: no-store. Without these assertions, a future refactor could silently drop the no-store header and only fail the new /u/* specs."
  - "Did NOT remove LockedProfileState or the viewerId === null branch from ProfileGate. Per 51-PLAN.md Invariant 3 (defense in depth) and 51-05-PLAN.md objective note: build-time prerendering and internal callers may still invoke gate code without a session. Removing the null branch would invite regression if the proxy ever ungates again."

patterns-established:
  - "Router-Cache-safe redirect: `const redirect = NextResponse.redirect(url); redirect.headers.set('Cache-Control', 'no-store'); return redirect` — use this form anywhere src/proxy.ts issues a 307"
  - "Test-suite-flip protocol for behavior reversal: when reverting a prior fix (5def872 ungating), update the test file FIRST to assert the new (reverted) behavior — RED phase. The failing tests document the regression vector explicitly before the implementation lands."

requirements-completed: [REQ-51-07]

# Metrics
duration: 5min
completed: 2026-05-21
---

# Phase 51 Plan 05: Re-gate /u/* (Branch B) Summary

**Re-gated `/u/*` profile routes to authenticated viewers — anon visitors now receive a 307 → /login with `Cache-Control: no-store` (the recurrence-2 fix commit `5def872` is intentionally reverted). The no-store header is the defense-in-depth safety net beyond plan 51-04's cookie-only proxy refactor; Next 16's Router Cache cannot store the 307, so even an intentional redirect cannot poison subsequent soft-nav clicks.**

## Performance

- **Duration:** ~5 min (269s elapsed)
- **Started:** 2026-05-21T01:07:55Z
- **Completed:** 2026-05-21T01:12:24Z
- **Tasks:** 2 of 2
- **Files modified:** 3 (src/proxy.ts, src/lib/constants/public-paths.ts, tests/proxy.test.ts)

## Accomplishments

- `src/proxy.ts` auth-gate predicate is now `if (!user && !isPublic)` — the `&& !isProfile` clause from recurrence-2 fix `5def872` is removed. Anon viewers of `/u/*` receive a 307 → /login (REQ-51-07).
- Every `NextResponse.redirect()` to /login in `src/proxy.ts` now carries `Cache-Control: no-store` (set on the response headers before return). This prevents Next 16's Router Cache from storing the 307 on RSC prefetches — the recurrence-2 poisoning vector documented in `.planning/debug/profile-page-404-top-nav.md`.
- The `isProfilePath` import is removed from `src/proxy.ts`; the `isProfile` local variable is removed from the gate body; the dev-only `console.log` line no longer emits `profile=...`.
- The old comment block (which documented the ungating contract) is replaced with a new Branch B comment that references plan 51-04 (cookie-only safety) and the debug file.
- `src/lib/constants/public-paths.ts` no longer exports `isProfilePath` — the function and its JSDoc are deleted (18 lines). `PUBLIC_PATHS`, `PublicPath`, and `isPublicPath` are retained unchanged.
- `tests/proxy.test.ts` flipped from documenting the ungated behavior (6 specs asserting NO redirect on /u/*) to documenting the re-gated behavior (6 specs asserting 307 + Location: /login + Cache-Control: no-store, plus a new authenticated-viewer-allowed spec). Existing AUTH-02 root-path redirect spec and the non-profile-protected-route spec also gained `expect(res.headers.get('cache-control')).toBe('no-store')` assertions to lock the safety net.
- All 23 specs in `tests/proxy.test.ts` PASS (15→23 with new specs; 0 failures after GREEN).
- Phase 51 unit tests (`tests/profile-route-51.test.ts`) — 3/3 PASS, no regression from REQ-51-04, -05, -06.
- `npm run build` succeeds. `node scripts/assert-phase-51-build.mjs` returns 0 — `/u/[username]/[tab]` is still NOT PPR-classified in the build output (REQ-51-03 invariant preserved; my changes did not touch any `/u/*` app-router file).

## Task Commits

Each task was committed atomically. Task 1 followed the TDD cycle (RED + GREEN as two commits), Task 2 was a single refactor commit (no behavior change, no new tests required — the existing 23-spec suite is the contract guard).

1. **Task 1 — RED:** `a54d6e6` (test) — `tests/proxy.test.ts`: flipped 6 profile-route specs to assert 307 + no-store; added authenticated-viewer-allowed spec; added no-store assertions to existing AUTH-02 root-path and non-profile-protected-route specs.
2. **Task 1 — GREEN:** `20d2bb0` (feat) — `src/proxy.ts`: removed `&& !isProfile` clause, removed `isProfile` local, removed `isProfilePath` import, set `Cache-Control: no-store` on the redirect, replaced the old comment block with the new Branch B comment, dropped `profile=` from the dev log.
3. **Task 2:** `54cdb8f` (refactor) — `src/lib/constants/public-paths.ts`: deleted `isProfilePath` function + JSDoc (18 lines).

## Files Created/Modified

- `src/proxy.ts` — re-gated profile routes; added Cache-Control: no-store on the 307; removed isProfilePath import + isProfile local; updated comment block + dev log
- `src/lib/constants/public-paths.ts` — deleted isProfilePath function and its JSDoc; isPublicPath, PUBLIC_PATHS, PublicPath retained
- `tests/proxy.test.ts` — flipped the 'profile route ungating' describe block to 'profile route re-gating' with REQ-51-07 assertions; added authenticated-viewer-allowed spec; added no-store assertions to existing redirect specs

## Decisions Made

- **Set Cache-Control: no-store on ALL 307s to /login, not just /u/* redirects.** The plan only required no-store on the new /u/* path, but the Router Cache poisoning vector is identical for any auth-gated route. The cost is one line per redirect; the protection is universal. Documented in the inline comment as "Branch B safety: prevent Router Cache from storing this 307."
- **Updated existing AUTH-02 specs to assert no-store too.** Locking the safety net in tests means a future refactor cannot silently drop the no-store header on the root-path or settings-page redirect. The change is narrow (one extra assertion per existing redirect spec) and aligns the entire test suite with the Branch B contract.
- **Did NOT remove LockedProfileState or `viewerId === null` branches.** Per 51-05-PLAN.md objective ("No code removal is performed in this plan beyond isProfilePath and isProfile") and 51-PLAN.md Invariant 3 (defense in depth for build-time prerendering + internal callers + future-regression resistance).
- **Did NOT touch src/lib/supabase/proxy.ts.** Owned by 51-04; updateSession() already uses getSession() cookie-only resolution. The function signature `{ supabase, user, response }` is the contract this plan consumes.
- **Did NOT touch any /u/[username] app-router file.** Owned by 51-02 / 51-03 / 51-07.

## Deviations from Plan

None — plan executed exactly as written. Minor judgment call: applied `Cache-Control: no-store` to the single existing `NextResponse.redirect()` call site (which now serves both the /u/* re-gate AND the existing root-path / settings redirect) rather than adding a separate redirect helper. This is what the plan's pseudocode shows in `<interfaces>`. The universal no-store coverage is a strict superset of the plan's strict /u/*-only requirement.

## Issues Encountered

- **`npm test` (full suite) reports 2 pre-existing failures** in `tests/integration/backfill-taste.test.ts`: `node: .env.local: not found`. Confirmed via 51-04-SUMMARY.md and STATE.md (Phase 49.1 Plan 07 decision + memory `project_local_db_reset.md`) that these failures exist on the base commit and are caused by Claude Code worktrees not including `.env.local`. Zero new failures introduced by this plan. Per execute-plan.md Scope Boundary, out of scope for this two-file edit.
- **`/u/[username]/[tab]` still shows `◐` (Partial Prerender) glyph in `npm run build` output.** However, `node scripts/assert-phase-51-build.mjs` returns exit code 0 with "OK: /u/[username]/[tab] is not PPR-classified in build output". The PPR opt-out invariant from plans 51-02/51-03 (F3-Composite) is preserved because my changes do not touch any /u/* app-router file. The script's heuristic correctly recognizes the non-PPR classification despite the glyph; this is owned by plan 51-03's verification work.

## User Setup Required

None — no external service configuration required. Re-gating takes effect on the next deploy; plan 51-06 will verify REQ-51-07 against the Vercel preview build.

## Next Phase Readiness

**Ready for plan 51-06 (preview deploy + prod verification gate).** With this plan landed:

- REQ-51-07 contract is locked at the source level (`tests/proxy.test.ts` + `src/proxy.ts` together codify the 307 + no-store invariant).
- The recurrence-2 root cause is fully neutralized: no `getUser()` network call in the proxy (51-04) AND no Router-Cache-storable 307 from the proxy (51-05). Branch B is safe to ship.
- The Phase 51 build assertion still passes (`/u/[username]/[tab]` non-PPR per 51-03).
- The Phase 51 unit tests still pass (REQ-51-04, -05, -06 invariants intact).

Plan 51-06 will run `bash scripts/verify-phase-51-prod.sh https://<preview-url>` to verify REQ-51-01 (non-empty body on state-tree-aware RSC), REQ-51-02 (prefetch returns non-empty OR x-nextjs-postponed: 1), and REQ-51-07 (anon → 307 with cache-control preventing Router Cache storage) against the Vercel edge.

**No blockers.**

## Threat Flags

None — this plan only modifies auth-gate behavior; no new endpoints, no new file access, no new schema. The threat surface is strictly narrower than before (anon viewers can no longer reach `/u/*` page renders, eliminating the page-level UnauthorizedError → LockedProfileState branch as a reachable code path on this route).

## Self-Check: PASSED

**Files claimed to be modified:**
- `src/proxy.ts` — FOUND (modified, committed in `20d2bb0`)
- `src/lib/constants/public-paths.ts` — FOUND (modified, committed in `54cdb8f`)
- `tests/proxy.test.ts` — FOUND (modified, committed in `a54d6e6`)

**Commits claimed:**
- `a54d6e6` — FOUND (`git log --oneline` shows `a54d6e6 test(51-05): assert /u/* re-gating and Cache-Control: no-store on 307 → /login`)
- `20d2bb0` — FOUND (`git log --oneline` shows `20d2bb0 feat(51-05): re-gate /u/* in proxy.ts and set Cache-Control: no-store on 307`)
- `54cdb8f` — FOUND (`git log --oneline` shows `54cdb8f refactor(51-05): delete unused isProfilePath() from public-paths.ts`)

**Done criteria verified:**
- `grep -c "isProfilePath\|isProfile" src/proxy.ts` returns **0** — PASS
- `grep -c "no-store" src/proxy.ts` returns **2** (>= 1) — PASS
- `grep -rn "isProfilePath" src/` returns **zero matches** — PASS
- `tsc --noEmit` shows zero errors in `src/proxy.ts` and `src/lib/constants/public-paths.ts` — PASS
- `tests/proxy.test.ts` — 23/23 specs PASS — PASS
- `tests/profile-route-51.test.ts` — 3/3 specs PASS — PASS (REQ-51-04, -05, -06 invariants preserved)
- `npm run build` succeeds — PASS
- `node scripts/assert-phase-51-build.mjs` returns exit 0 — PASS (REQ-51-03 preserved)
- src/lib/constants/public-paths.ts still exports `isPublicPath`, `PUBLIC_PATHS`, `PublicPath` — PASS
- Branch B comment in `src/proxy.ts` references plan 51-04 + the debug file — PASS

---
*Phase: 51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta*
*Completed: 2026-05-21*

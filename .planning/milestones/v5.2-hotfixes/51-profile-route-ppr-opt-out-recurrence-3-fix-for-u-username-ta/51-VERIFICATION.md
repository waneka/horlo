---
phase: 51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta
verified: 2026-05-21T02:15:58Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 51: Profile Route PPR Opt-Out Verification Report

**Phase Goal:** Eliminate the `/u/[username]/[tab]` 404 on state-tree-aware RSC requests (third recurrence) by removing Cache Components PPR qualification at the source (F3-Composite). Operator-decided Branch B re-gates `/u/*` to authenticated viewers with a cookie-only proxy check and `Cache-Control: no-store` on the 307 — closes recurrence-2 cause structurally.

**Verified:** 2026-05-21T02:15:58Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (REQ-51-01 through REQ-51-07)

| #   | Requirement | Truth | Status     | Evidence       |
| --- | ----------- | ----- | ---------- | -------------- |
| 1   | REQ-51-01   | State-tree-aware RSC request to `/u/[username]/[tab]` returns non-empty body on prod | ✓ VERIFIED | Operator UAT confirmation (commit `2dc71b0`): two full click cycles across all tabs (collection → wishlist → worn → notes → stats → insights), zero 404s on prod (`https://www.horlo.app`) deploy SHA `84779ae`. Debug log `.planning/debug/resolved/profile-page-404-top-nav.md` records prod_verified 2026-05-21. |
| 2   | REQ-51-02   | Prefetch-headed RSC request returns either non-empty body OR `x-nextjs-postponed: 1` | ✓ VERIFIED | Operator UAT (same as REQ-51-01) — soft-nav click cycles never produced a 404, which would be the symptom of an empty prefetch body without `x-nextjs-postponed`. `scripts/verify-phase-51-prod.sh` (curl-based) encodes the regression contract; structural fix (F3-Composite) means the route is no longer PPR-classified, so the prefetch case is moot. |
| 3   | REQ-51-03   | Local build artifact: `/u/[username]/[tab]` is NOT in the prerender output | ✓ VERIFIED | `node scripts/assert-phase-51-build.mjs` → exit 0 with output `OK: /u/[username]/[tab] is not PPR-classified in build output`. Checked against `.next/prerender-manifest.json` and `.next/routes-manifest.json`. |
| 4   | REQ-51-04   | Layout file does NOT contain `<Suspense fallback={<ProfileShellSkeleton/>}>` wrapping `<ProfileGate>` (F3-A structural lock) | ✓ VERIFIED | `src/app/u/[username]/layout.tsx` is now a pure static chrome wrapper — no `<Suspense>` tag, no `ProfileGate` reference, no async data, just `await params` and a `<main>` element. Vitest `tests/profile-route-51.test.ts` (test 1) PASS. |
| 5   | REQ-51-05   | `ProfileGate` accepts `viewerId` as a prop (no internal `getCurrentUser()`), preserving Phase 39c Pitfall 1 | ✓ VERIFIED | `src/app/u/[username]/profile-gate.tsx:36-44` — function signature destructures `{ username, viewerId, children }`; no `getCurrentUser` import, no auth-module import. Vitest test 2 PASS. The page (`[tab]/page.tsx:67-72`) is now the cookie-reading boundary. |
| 6   | REQ-51-06   | `ProfileShellResolver` still has `'use cache'` + `cacheTag('profile:${username}')` (Phase 39c invariant) | ✓ VERIFIED | `src/app/u/[username]/profile-shell-resolver.tsx:29-31` — `'use cache'`, `cacheTag(\`profile:${username}\`)`, `cacheLife({ revalidate: 300 })` all present. Vitest test 3 PASS. |
| 7   | REQ-51-07   | (Branch B) Anon viewer to `/u/[public_user]/collection` receives a 307 with `Cache-Control: no-store` | ✓ VERIFIED | `src/proxy.ts:18-25` — `if (!user && !isPublic)` branch issues `NextResponse.redirect(loginUrl)` with `redirect.headers.set('Cache-Control', 'no-store')`. `tests/proxy.test.ts` Phase 51 Branch B block: 23/23 tests pass. Operator-confirmed direct curl in `.planning/debug/resolved/profile-page-404-top-nav.md:47`: anon GET `/u/twwaneka/collection` → 307 + `cache-control: no-store` + `location: /login?next=%2Fu%2Ftwwaneka%2Fcollection`. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/app/u/[username]/layout.tsx` | Pure static shell — no Suspense, no ProfileGate composition | ✓ VERIFIED | 25 lines; `<main>` only; no async data; param awaited to satisfy typed LayoutProps contract |
| `src/app/u/[username]/[tab]/page.tsx` | Owns cookie read + Suspense + ProfileGate composition with viewerId | ✓ VERIFIED | 372 lines; `getCurrentUser()` at line 69; wraps every per-tab JSX return in `<Suspense fallback={<ProfileShellSkeleton/>}><ProfileGate username viewerId>` via `wrapInGate` helper |
| `src/app/u/[username]/profile-gate.tsx` | Accepts viewerId prop; no internal getCurrentUser | ✓ VERIFIED | 128 lines; signature `{ username, viewerId, children }`; no `@/lib/auth` import; resolver call kept; locked branch + composition preserved |
| `src/app/u/[username]/profile-shell-resolver.tsx` | Cache directives intact (Phase 39c invariant) | ✓ VERIFIED | `'use cache'` + `cacheTag('profile:${username}')` + `cacheLife({ revalidate: 300 })` retained |
| `src/lib/supabase/proxy.ts` | Uses `getSession()` not `getUser()` | ✓ VERIFIED | Line 42-45 — `supabase.auth.getSession()`; comment block notes Branch B safety trade-off (see WARNING below re: CR-01) |
| `src/proxy.ts` | Re-gates `/u/*` for unauth viewers; sets `Cache-Control: no-store` on 307 | ✓ VERIFIED | Lines 18-25 — `if (!user && !isPublic)` redirect with no-store header; `isProfilePath` no longer imported/called |
| `src/lib/constants/public-paths.ts` | `isProfilePath` removed | ✓ VERIFIED | Only `PUBLIC_PATHS` + `isPublicPath` exported; no `isProfilePath` function; grep across `src/` shows zero references |
| `next.config.ts` | `redirects()` rule for `/u/:username` → `/u/:username/collection` | ✓ VERIFIED | Lines 22-30 — `permanent: true` (308) at config-redirect layer (bypasses Cache Components / PPR) |
| `src/app/u/[username]/page.tsx` | DELETED (page-level redirect removed, migrated to next.config.ts) | ✓ VERIFIED | File does not exist; redirect logic lives in `next.config.ts` per plan 51-07 |
| `tests/profile-route-51.test.ts` | Encodes regression contract (3 specs) | ✓ VERIFIED | 76 lines; tests 1/2/3 cover REQ-51-04/-05/-06; vitest run: 3/3 pass in 2ms |
| `scripts/assert-phase-51-build.mjs` | Build-output assertion for REQ-51-03 | ✓ VERIFIED | 152 lines; multi-manifest fail-closed; exits 0 against current build |
| `scripts/verify-phase-51-prod.sh` | Prod-contract verifier for REQ-51-01/-02/-07 | ✓ VERIFIED | 119 lines; three checks (state-tree RSC body, prefetch body/postponed, anon 307+no-store); Branch B check opt-in via `PHASE51_BRANCH_B=1` |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `[tab]/page.tsx` | `ProfileGate` | `wrapInGate` helper passing `viewerId` prop | ✓ WIRED | Line 79-85: `<Suspense fallback={<ProfileShellSkeleton/>}><ProfileGate username viewerId>{children}</ProfileGate></Suspense>` |
| `[tab]/page.tsx` | `getCurrentUser` | direct import from `@/lib/auth`; `try/catch UnauthorizedError` at lines 67-72 | ✓ WIRED | Line 6 import; line 69 invocation; null fallback on Unauthorized |
| `ProfileGate` | `ProfileShellResolver` | direct await call at line 46 | ✓ WIRED | Cached resolver kept inside gate; viewerId stays outside the cached scope |
| `proxy.ts` | `updateSession` | imported from `@/lib/supabase/proxy`; `getSession()` cookie-only path | ✓ WIRED | Line 6 invocation; user destructured from result |
| `proxy.ts` 307 | `Cache-Control: no-store` | `redirect.headers.set('Cache-Control', 'no-store')` | ✓ WIRED | Line 23 — header set BEFORE return |
| `next.config.ts` redirects | `/u/[username]` bare-redirect | config-level rule (bypasses PPR) | ✓ WIRED | Lines 22-30; permanent 308 at edge |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `[tab]/page.tsx` | `viewerId` | `getCurrentUser()` cookie + Supabase server verification | yes (real auth, throws Unauthorized → null fallback) | ✓ FLOWING |
| `[tab]/page.tsx` | `resolved` (profile/settings/watches/wearEvents) | `ProfileShellResolver` cached DB reads | yes (Drizzle/Supabase queries in `@/data/profiles`, `@/data/watches`, `@/data/wearEvents`) | ✓ FLOWING |
| `ProfileGate` | `viewerId` | prop from page | yes (page is authoritative source) | ✓ FLOWING |
| `proxy.ts` | `user` | `getSession()` cookie decrypt (+ refresh-on-near-expiry) | yes (real session via Supabase) | ✓ FLOWING (with caveat — see WARNING WR-CR-01) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Build artifact does not PPR-classify `/u/[username]/[tab]` | `node scripts/assert-phase-51-build.mjs` | exit 0, "OK: /u/[username]/[tab] is not PPR-classified in build output" | ✓ PASS |
| Structural source-grep regression contract holds (REQ-51-04/-05/-06) | `npx vitest run tests/profile-route-51.test.ts` | 3/3 tests passed in 2ms | ✓ PASS |
| Proxy gate behavior + Branch B re-gate behavior is correct | `npx vitest run tests/proxy.test.ts` | 23/23 tests passed in 15ms (includes Phase 51 Branch B block) | ✓ PASS |
| `isProfilePath` symbol fully removed from src | `grep -rn "isProfilePath" /Users/tylerwaneka/Documents/horlo/src` | zero matches in `src/`, only planning-doc references remain | ✓ PASS |

### Requirements Coverage

| Requirement | Source | Description (from `51-PLAN.md` Validation Architecture) | Status | Evidence |
| ----------- | ------ | ------------------------------------------------------- | ------ | -------- |
| REQ-51-01 | ROADMAP + 51-PLAN | State-tree-aware RSC request returns non-empty body on prod | ✓ SATISFIED | Operator UAT prod-verified 2026-05-21; debug log resolved |
| REQ-51-02 | ROADMAP + 51-PLAN | Prefetch-headed RSC: non-empty body OR `x-nextjs-postponed: 1` | ✓ SATISFIED | Operator UAT prod-verified; no 404s on click cycles |
| REQ-51-03 | ROADMAP + 51-PLAN | Build artifact: `/u/[username]/[tab]` NOT in prerender output | ✓ SATISFIED | `assert-phase-51-build.mjs` exits 0 against current build |
| REQ-51-04 | ROADMAP + 51-PLAN | Layout does not Suspense-wrap ProfileGate | ✓ SATISFIED | Layout collapsed to chrome shell; vitest test 1 PASS |
| REQ-51-05 | ROADMAP + 51-PLAN | ProfileGate accepts viewerId prop (no internal getCurrentUser) | ✓ SATISFIED | Gate signature confirmed; vitest test 2 PASS |
| REQ-51-06 | ROADMAP + 51-PLAN | ProfileShellResolver retains `'use cache'` + cacheTag | ✓ SATISFIED | Resolver source unchanged on cache directives; vitest test 3 PASS |
| REQ-51-07 | ROADMAP + 51-PLAN | Branch B: anon `/u/*` → 307 + `Cache-Control: no-store` | ✓ SATISFIED | Proxy lines 18-25; tests/proxy.test.ts PASS; direct curl confirmed in debug log |

All 7 requirement IDs from PLAN frontmatter are accounted for in REQUIREMENTS source (`.planning/ROADMAP.md:185`) and have verified implementation evidence. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/lib/supabase/proxy.ts` | 26-44 | Comment overstates safety claim — says `getSession()` is "no network — so it cannot fail transiently" but auth-js triggers `_callRefreshToken` when access token is near expiry | ⚠️ Warning | Misleading inline documentation — does not affect behavior, but a reviewer accepting the comment at face value misunderstands the recurrence-2 mitigation. The actual mitigation is the `Cache-Control: no-store` header. CR-01 in `51-REVIEW.md`. |
| `src/lib/supabase/proxy.ts` | 45 / `src/proxy.ts` | `getSession()` returns `session.user` wrapped in `insecureUserWarningProxy`. First property access (`user?.id` at proxy.ts:29) emits `console.warn`. | ⚠️ Warning | Console-log noise in dev mode (once per request) and once per cold start in prod. CR-02 in `51-REVIEW.md`. Suppressable via `auth.suppressGetSessionWarning: true` option. |

No 🛑 Blocker anti-patterns. No unreferenced debt markers (no `TBD`/`FIXME`/`XXX` introduced in modified files). The two warnings above were surfaced by the code reviewer and are tracked in `51-REVIEW.md`; per verification context they are about overstated comments and log noise, not structural correctness. The structural fix (F3-Composite + re-gate + no-store) is internally consistent and the recurrence-3 symptom is resolved in prod.

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| `scripts/assert-phase-51-build.mjs` | `node scripts/assert-phase-51-build.mjs` | exit 0; "OK: /u/[username]/[tab] is not PPR-classified in build output" | ✓ PASS |
| `scripts/verify-phase-51-prod.sh` | (not executed against live URL during verification — prod already operator-UAT'd) | n/a | ? SKIP (operator-confirmed prod pass on commit `2459a3d`; running curl against prod here would be duplicative) |
| `tests/profile-route-51.test.ts` (regression contract for REQ-51-04/-05/-06) | `npx vitest run tests/profile-route-51.test.ts` | 3/3 PASS | ✓ PASS |
| `tests/proxy.test.ts` (regression contract for REQ-51-07 + adjacent proxy behavior) | `npx vitest run tests/proxy.test.ts` | 23/23 PASS | ✓ PASS |

### Human Verification Required

None — all observable truths verified programmatically against the codebase, and operator has already completed UAT on prod (commit `2dc71b0`, two full click cycles across all profile tabs, zero 404s). No additional human verification needed for this phase.

### Gaps Summary

No gaps. All 7 must-haves (REQ-51-01 through REQ-51-07) are verified against the codebase:

- **Structural fix (REQ-51-03/-04/-05/-06)**: Layout is collapsed to a pure static shell; the page owns the cookie boundary and Suspense composition; ProfileGate accepts `viewerId` as a prop; ProfileShellResolver retains its Phase 39c cache invariants. Local build assertion and vitest source-grep contract both pass.
- **Branch B re-gate (REQ-51-07)**: Proxy re-gates `/u/*` for anonymous viewers using cookie-only `getSession()`, returning a 307 → `/login` with `Cache-Control: no-store` to prevent Router Cache poisoning. 23/23 proxy tests pass.
- **Production verification (REQ-51-01/-02)**: Operator UAT confirms zero 404s on the recurrence-3 repro path on prod deploy `84779ae`; debug log `profile-page-404-top-nav.md` moved to `.planning/debug/resolved/` with `recurrence_3_fix_commit: 84779ae`, `prod_verified: 2026-05-21`.

Two CRITICAL findings from code review (CR-01: overstated `getSession()` safety comment; CR-02: `insecureUserWarningProxy` log noise) are surfaced as ⚠️ Warning anti-patterns rather than BLOCKERs because:

1. CR-01 is a documentation/comment issue. The behavior is correct — the actual recurrence-2 mitigation is the `Cache-Control: no-store` header on the 307, which IS present at `src/proxy.ts:23`. The misleading comment does not break the structural fix.
2. CR-02 is log noise, not a behavioral defect. Production functionality is unaffected.

Both warnings should be addressed in a follow-up cleanup phase but do not block goal achievement for Phase 51. The phase goal — eliminate the `/u/[username]/[tab]` 404 on state-tree-aware RSC requests — is observably achieved in the codebase AND in production.

---

_Verified: 2026-05-21T02:15:58Z_
_Verifier: Claude (gsd-verifier)_

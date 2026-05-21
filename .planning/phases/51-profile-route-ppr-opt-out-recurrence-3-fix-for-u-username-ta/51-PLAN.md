---
phase: 51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta
plan: 00
type: overview
wave: 0
depends_on: []
files_modified: []
autonomous: false
requirements: [REQ-51-01, REQ-51-02, REQ-51-03, REQ-51-04, REQ-51-05, REQ-51-06, REQ-51-07]
---

# Phase 51 — Profile Route PPR Opt-Out (Recurrence-3 Fix)

This file is the phase overview. Individual atomic plans are `51-01-PLAN.md` through `51-08-PLAN.md`.

---

## OPERATOR DECISION REQUIRED — Branch A vs Branch B

This plan is authored under the assumption of **Branch B** (re-gate `/u/*` to authenticated viewers) per operator's stated preference, with the research-confirmed safety prerequisite that `src/lib/supabase/proxy.ts:updateSession` is converted to a cookie-only check (`getSession()`) BEFORE the re-gate ships.

**Branch A (alternative):** Leave the recurrence-2 fix `5def872` in place (proxy `/u/*` ungating). Plans 51-04 and 51-05 (cookie-only refactor + re-gate) are SKIPPED. F3-Composite structural fix (plans 51-02 + 51-03) is still required. Branch A is the lower-scope path.

**Branch B (recommended, planned-for):** All plans 51-01 through 51-08 execute. Plans 51-04 (cookie-only refactor) and 51-05 (re-gate) re-introduce proxy auth gating for `/u/*` without re-introducing the recurrence-2 Router Cache poisoning vector.

**Branch B is SAFE if and only if:**
1. Plan 51-04 ships BEFORE plan 51-05 (the cookie-only refactor is a hard prerequisite).
2. The cookie-only check uses `supabase.auth.getSession()` (no network round-trip) per `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1031`.
3. The 307 → /login response carries `Cache-Control: no-store` (set on `NextResponse.redirect()` in proxy.ts) to prevent Router Cache storage of the redirect.

**Operator sign-off (required before executing plan 51-04 or 51-05):**
- [ ] Confirm Branch B
- [ ] If Branch A instead, mark plans 51-04 and 51-05 as `cancelled` and update REQ-51-07 to `N/A`

---

## Phase Goal

Eliminate the `/u/[username]/[tab]` 404 on state-tree-aware RSC requests (third recurrence) by removing Cache Components PPR qualification at the source (F3-Composite). Re-gate `/u/*` to authenticated viewers (Branch B) without re-introducing the recurrence-2 Router Cache poisoning vector.

## Requirements (REQ-51-01 through REQ-51-07)

Sourced from `51-RESEARCH.md` → "Validation Architecture" → "Phase Requirements → Test Map":

| Req ID | Behavior | Verifiable Where |
|--------|----------|------------------|
| REQ-51-01 | State-tree-aware RSC request to `/u/[username]/[tab]` returns non-empty body on prod | Vercel preview/prod |
| REQ-51-02 | Prefetch-headed RSC request returns either non-empty body OR `x-nextjs-postponed: 1` | Vercel preview/prod |
| REQ-51-03 | Local build artifact: `/u/[username]/[tab]` is NOT in the prerender output | Local CI (`npm run build`) |
| REQ-51-04 | Layout file does NOT contain `<Suspense fallback={<ProfileShellSkeleton/>}>` wrapping `<ProfileGate>` (F3-A structural lock) | Local vitest |
| REQ-51-05 | `ProfileGate` accepts `viewerId` as a prop (no internal `getCurrentUser()`), preserving Phase 39c Pitfall 1 | Local vitest |
| REQ-51-06 | `ProfileShellResolver` still has `'use cache'` + `cacheTag('profile:${username}')` (Phase 39c invariant) | Local vitest |
| REQ-51-07 | (Branch B only) Anon viewer to `/u/[public_user]/collection` receives a 307 with `Cache-Control` that prevents Router Cache storage | Vercel preview/prod |

## Invariants — MUST be preserved by every plan task

1. **Phase 39c Pitfall 1 (D-39c-03):** `viewerId` MUST stay OUT of any `'use cache'`-backed scope. After plan 51-02, `ProfileGate` accepts `viewerId` as a prop; after plan 51-03 the page is the cookie-reading boundary; `ProfileShellResolver` continues to receive only `username`.
2. **Phase 39c cache-tag chain (D-39c-04, D-39c-05):** `ProfileShellResolver` keeps `cacheTag('profile:${username}')` + `cacheLife({revalidate: 300})`. Server Actions in `watches.ts`, `notes.ts`, `profile.ts`, `follows.ts`, `divestments.ts`, `account.ts` continue to fire `revalidatePath('/u/[username]', 'layout')` and remain effective.
3. **Phase 39c locked-branch (D-39c-09):** `LockedProfileState` continues to render for non-owner viewers of private profiles. Under Branch B, the `viewerId === null` case becomes unreachable for `/u/*` page renders, but the gate's null-handling code MUST remain (defense in depth — see plan 51-05 audit).
4. **Phase 39c notFound() ordering (D-39c-Pitfall-5):** `notFound()` MUST be called BEFORE any post-suspending `await` (preserved by keeping the existing call ordering in the gate body).

## Failed-Attempt Blocklist (do NOT include in any plan task)

- ❌ `await connection()` at the page level alone (F2, commit `b963e6a` — reverted; Vercel edge ignored it)
- ❌ `prefetch={false}` on Links (F1, commit `a6f1016` — reverted; soft-nav still 0-bytes)
- ❌ `export const dynamic = 'force-dynamic'` (route-segment-config removed in Next 16 per `route-segment-config/index.md:19`)
- ❌ `export const unstable_instant` on `[tab]/page.tsx` (recurrence-1 cause; removal comment is in the file)
- ❌ Re-creating `tests/profile-route-dynamic.test.ts` from F2 (deleted in this session; test 51 replaces it)

## Wave Structure

| Wave | Plans | Autonomous | Branch |
|------|-------|------------|--------|
| 0 | 51-01 (test scaffolds — INITIALLY FAIL on main) | yes | A + B |
| 1 | 51-02 (ProfileGate prop refactor) | yes | A + B |
| 1 | 51-03 (layout collapse + page-owned composition) | yes | A + B |
| 2 | 51-04 (cookie-only proxy refactor) | yes | B only |
| 3 | 51-05 (re-gate proxy + delete isProfilePath) | yes | B only |
| 4 | 51-06 (build + preview deploy + prod-contract verification gate) | **no** (operator confirms preview URL & UAT) | A + B |
| 4 | 51-07 (bare-username redirect → next.config.ts) | yes | A + B |
| 5 | 51-08 (close debug file frontmatter) | yes | A + B |

Wave 1 plans 51-02 and 51-03 modify overlapping files (`profile-gate.tsx` and `[tab]/page.tsx` both touched by 51-03; 51-02 owns `profile-gate.tsx` exclusively). Per planner rules, 51-03 depends on 51-02 → 51-02 runs alone in Wave 1a, 51-03 in Wave 1b. Adjusted below.

**Revised wave assignments (post file-overlap audit):**

| Wave | Plans |
|------|-------|
| 0 | 51-01 |
| 1 | 51-02 |
| 2 | 51-03 |
| 3 | 51-04 (Branch B only) |
| 4 | 51-05 (Branch B only) |
| 5 | 51-06 (preview deploy gate) |
| 5 | 51-07 (parallel-safe with 51-06; touches `next.config.ts` + `src/app/u/[username]/page.tsx` only) |
| 6 | 51-08 |

## Verification Gate (full phase pass)

The phase is NOT done until all of these pass:

1. `npm test -- tests/profile-route-51.test.ts` → all specs pass (REQ-51-04, -05, -06)
2. `npm run build` → succeeds; `node scripts/assert-phase-51-build.mjs` returns 0 (REQ-51-03)
3. Vercel preview deploy succeeds for the branch
4. `bash scripts/verify-phase-51-prod.sh https://<preview-url>` → exits 0 (REQ-51-01, -02; REQ-51-07 if Branch B)
5. Operator UAT: incognito URL paste → click between all tabs (collection / wishlist / worn / notes / stats; common-ground / insights when applicable) → zero 404s on any tab transition
6. Plan 51-08 closes `.planning/debug/profile-page-404-top-nav.md` frontmatter with `status: resolved`, `recurrence_3_fix_commit: <sha>`, `prod_verified: <ISO date>`

## Out of Scope (do NOT include)

- Broader PPR audit of other routes (`/explore`, `/search`, `/watch/[id]`) — separate phase if Phase 51 reveals systemic pattern
- Variant C `/w/[ref]` unified watch detail route (deferred to v7.0)
- v6.0 social interaction features
- `LockedProfileState` removal (still reachable by authenticated-non-owner-of-private-profile under Branch B; only the documentation comment in `public-paths.ts` is irrelevant after that file is deleted by plan 51-05)

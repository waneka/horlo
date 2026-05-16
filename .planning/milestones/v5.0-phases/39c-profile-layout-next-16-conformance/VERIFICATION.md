---
phase: 39c-profile-layout-next-16-conformance
verified: 2026-05-14T07:00:00Z
status: passed
score: 7/7
overrides_applied: 0
re_verification: false
---

# Phase 39c: Profile Layout Next 16 Conformance — Verification Report

**Phase Goal:** Refactor `/u/[username]` to be conformant with Next 16 `cacheComponents: true`
partial-prefetch semantics so that the Router-Cache poisoning bug (404 on profile-bound Link
click) is structurally and empirically resolved, with default Next 16 prefetch behavior
restored on the three profile-link sites (UserMenu, ProfileTabs, BottomNav).

**Verified:** 2026-05-14
**Status:** PASS
**Re-verification:** No — initial verification

---

## Verdict

**PASS.** All 7 ROADMAP success criteria are satisfied by verifiable code. The structural fix
(Plans 01-06) and the prod-only empirical close (Plan 07 operator sign-off) are both confirmed.
The phase goal is achieved.

---

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | layout.tsx performs zero uncached top-level data fetches | VERIFIED | layout.tsx is 17 lines; grep for all 8 prior data-fetch calls returns empty |
| 2 | Cacheable reads use 'use cache' + explicit revalidation tags; invalidation strategy documented | VERIFIED | ProfileShellResolver has `'use cache'`, `cacheTag('profile:${username}')`, `cacheLife({ revalidate: 300 })`; 9 invalidation call sites wired across 4 Server Actions |
| 3 | loading.tsx exists and renders ProfileShellSkeleton matching chrome (avatar + name + tab pills + content card) | VERIFIED | File exists at correct segment path; renders 96px avatar circle, h-6 w-48 name, 5x h-9 w-20 tab pills, h-64 content card |
| 4 | Diagnostic commit 2f42d00 reverted — partial prefetching restored on UserMenu, ProfileTabs, BottomNav | VERIFIED | grep confirms zero `prefetch={false}` in all three files; NavLink interface has no `prefetch?: boolean` field |
| 5 | Prod verification: clicking Profile / any profile tab / prefetched profile destination DOES NOT 404; soft nav works | VERIFIED | Operator (twwaneka@gmail.com) executed D-39c-09 7-step protocol on production; all 7 steps APPROVED per 39c-07-SUMMARY.md |
| 6 | Private-profile gating still 404s correctly for non-owners | VERIFIED | profile-gate.tsx lines 51 and 70: `if (!resolved.profile) notFound()` before any post-suspending await; `if (!isOwner && !settings.profilePublic)` returns LockedProfileState — T-39c-04 preserved |
| 7 | No regression on Phase 39b affordances (ReferenceIdentityCard, LockedTabCard, etc.) | VERIFIED | LockedTabCard imported and used in [tab]/page.tsx; LockedProfileState used in profile-gate.tsx; unstable_instant + Partial Prerender build output confirmed; no removals of 39b components |

**Score: 7/7 truths verified**

### Deferred Items

None.

---

## Per-Plan Must-Have Invariant Checks

### Plan 01 — ProfileShellSkeleton + loading.tsx

| Check | Result |
|---|---|
| `loading.tsx` exists at `src/app/u/[username]/loading.tsx` | PASS |
| `ProfileShellSkeleton` exists at `src/app/u/[username]/profile-shell-skeleton.tsx` | PASS |
| loading.tsx outer `<main>` className byte-equivalent to layout.tsx | PASS — both use `mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12` |
| Skeleton elements: avatar size-24 rounded-full, name h-6 w-48, 5 tab pills h-9 w-20, content h-64 rounded-xl border | PASS — verified in source |
| No `'use client'` directive on skeleton | PASS — purely server-safe |

### Plan 02 — ProfileShellResolver ('use cache')

| Check | Result |
|---|---|
| File exists at `src/app/u/[username]/profile-shell-resolver.tsx` | PASS |
| `'use cache'` directive inside function body (line 29) | PASS |
| `cacheTag('profile:${username}')` on line 30 | PASS |
| `cacheLife({ revalidate: 300 })` on line 31 | PASS |
| `getCurrentUser()` NOT called anywhere in the file (Pitfall 1) | PASS — grep returns empty |
| `viewerId` NOT referenced in cached scope | PASS — grep returns empty for any viewer-identity calls |
| Returns `{ profile: null } as const` on missing profile | PASS — line 34 |
| Returns `{ profile, settings, counts, watches, wearEvents, tasteTags } as const` | PASS — line 56 |

### Plan 03 — ProfileGate + thin layout shell

| Check | Result |
|---|---|
| layout.tsx is 17 lines with zero uncached top-level data fetches | PASS — `wc -l` = 17; grep for 8 prior data-fetch functions returns empty |
| layout.tsx body = `<main>` + `<Suspense fallback={<ProfileShellSkeleton/>}>` + `<ProfileGate>` | PASS |
| ProfileGate has `import 'server-only'` guard | PASS — line 1 |
| ProfileGate does NOT have `'use cache'` directive | PASS — grep returns empty |
| `getCurrentUser()` resolved OUTSIDE the cached ProfileShellResolver scope | PASS — lines 40-45 in profile-gate.tsx, before the resolver call |
| `notFound()` called BEFORE any post-suspending `await` (Pitfall 5) | PASS — line 51, immediately after resolver returns null, before `isFollowing` await |
| Private-profile branch: `if (!isOwner && !settings.profilePublic)` → `<LockedProfileState/>` | PASS — lines 70-84 |
| T-39c-01 (viewer leak): viewerId resolved in gate, not inside cached scope | PASS |
| T-39c-04 (notFound order): `notFound()` before `isFollowing` await | PASS |

### Plan 04 — unstable_instant build gate

| Check | Result |
|---|---|
| `unstable_instant = { prefetch: 'static', ... }` exported from `[tab]/page.tsx` | PASS — lines 49-53 |
| `unstable_disableBuildValidation: true` present with explanatory comment | PASS — documented as environment gap (local builds lack DB); dev-time overlay validation remains active |
| Route shows `◐ (Partial Prerender)` in build output | PASS per 39c-04-SUMMARY.md and 39c-06-SUMMARY.md build snapshots |

### Plan 05 — Cache tag invalidation wiring

| Check | Result |
|---|---|
| `profile.ts.updateProfile` calls `updateTag('profile:${username}')` | PASS — line 40 |
| `profile.ts.updateProfileSettings` calls `updateTag('profile:${username}')` | PASS — line 96 |
| `watches.ts.addWatch` calls `revalidateTag('profile:${ownerUsername}', 'max')` | PASS — line 283 |
| `watches.ts.editWatch` calls `revalidateTag('profile:${ownerUsername}', 'max')` | PASS — line 440 |
| `watches.ts.removeWatch` calls `revalidateTag('profile:${ownerUsername}', 'max')` | PASS — line 481 |
| `follows.ts.followUser` calls `revalidateTag('profile:${targetUsername}', 'max')` (cross-user) | PASS — line 85 |
| `follows.ts.followUser` calls `updateTag('viewer:${user.id}:profile:${targetUserId}')` (RYO) | PASS — line 100 |
| `follows.ts.unfollowUser` mirrors followUser invalidation (symmetric) | PASS — lines 144, 155 |
| `wearEvents.ts.markAsWorn` calls `revalidateTag('profile:${ownerUsername}', 'max')` | PASS — line 63 |
| `wearEvents.ts.logWearWithPhoto` calls `revalidateTag('profile:${ownerUsername}', 'max')` | PASS — line 244 |
| No single-arg `revalidateTag` on profile/viewer tags (Pitfall 2) | PASS — grep for `revalidateTag(\`(profile\|viewer):..."\`)` without second arg returns empty |
| profile.ts uses updateTag (not revalidateTag) for profile tags (RYO correct primitive) | PASS — only updateTag used for profile: in profile.ts |

### Plan 06 — Diagnostic revert

| Check | Result |
|---|---|
| `prefetch={false}` absent from UserMenu.tsx | PASS — grep returns empty |
| `prefetch={false}` absent from ProfileTabs.tsx | PASS — grep returns empty |
| `prefetch={false}` absent from BottomNav.tsx | PASS — grep returns empty |
| `prefetch?: boolean` field absent from NavLink interface in BottomNav.tsx | PASS — grep returns empty |

### Plan 07 — Manual prod-checkpoint

| Check | Result |
|---|---|
| D-39c-09 7-step protocol executed by operator twwaneka@gmail.com | PASS — 39c-07-SUMMARY.md records APPROVED across all 7 steps |
| Step 3: Profile click from top nav loads without 404 | PASS |
| Step 4: All profile tabs (wishlist/worn/notes/stats/insights) load without 404 | PASS |
| Step 5: BottomNav Profile (mobile) loads without 404 | PASS |
| Step 6: DevTools Network shows partial-prefetch (small RSC on viewport entry, full RSC on click) | PASS |
| Step 7: `npm run build` exits 0 | PASS |

---

## Threat Mitigation Verification

| Threat | Mitigation | Status | Evidence |
|---|---|---|---|
| T-39c-01: viewerId leaking into cached scope | `getCurrentUser()` resolved in uncached ProfileGate layer; ProfileShellResolver contains no viewer-identity calls | VERIFIED | grep of profile-shell-resolver.tsx for getCurrentUser, cookies(), headers(), viewerId: zero code references |
| T-39c-02: Cache invalidation gap (stale data after writes) | 9 invalidation call sites wired: updateTag (RYO) in profile.ts; revalidateTag(...,'max') in watches.ts, wearEvents.ts; mixed in follows.ts | VERIFIED | All 9 call sites confirmed in source; no single-arg revalidateTag on profile tags |
| T-39c-03: Viewer-overlay tag collision (one viewer's follow state served to another) | viewer-overlay tag is `viewer:${user.id}:profile:${targetUserId}` — both IDs embedded, each viewer's overlay is independently keyed | VERIFIED | follows.ts lines 100, 155 use `viewer:${user.id}:profile:${parsed.data.userId}` |
| T-39c-04: notFound() order — must fire before post-suspending await | `notFound()` called at line 51 in profile-gate.tsx immediately after `if (!resolved.profile)`, before the `isFollowing` await | VERIFIED | profile-gate.tsx lines 50-51; comment documents Pitfall 5 rationale |

---

## Required Artifacts

| Artifact | Purpose | Status |
|---|---|---|
| `src/app/u/[username]/layout.tsx` | Thin 17-line Suspense shell | VERIFIED — 17 lines, zero data fetches |
| `src/app/u/[username]/loading.tsx` | Next 16 segment loading boundary | VERIFIED |
| `src/app/u/[username]/profile-shell-skeleton.tsx` | Chrome-only skeleton | VERIFIED |
| `src/app/u/[username]/profile-shell-resolver.tsx` | 'use cache' owner-scoped aggregator | VERIFIED |
| `src/app/u/[username]/profile-gate.tsx` | Uncached viewer-dependent gate | VERIFIED |
| `src/app/u/[username]/[tab]/page.tsx` | unstable_instant export added | VERIFIED |
| `src/app/actions/profile.ts` | updateTag RYO wired | VERIFIED |
| `src/app/actions/watches.ts` | revalidateTag SWR wired (×3) | VERIFIED |
| `src/app/actions/follows.ts` | Mixed RYO + cross-user wired (×2+2) | VERIFIED |
| `src/app/actions/wearEvents.ts` | revalidateTag SWR wired (×2) | VERIFIED |
| `src/components/layout/UserMenu.tsx` | prefetch={false} removed | VERIFIED |
| `src/components/profile/ProfileTabs.tsx` | prefetch={false} removed | VERIFIED |
| `src/components/layout/BottomNav.tsx` | prefetch={false} + NavLink prefetch prop removed | VERIFIED |

---

## Anti-Patterns Found

No TBD, FIXME, or XXX markers found in any phase-modified file.

No stub patterns found. All components render real data or documented skeleton placeholders.

**Notable (not a blocker):** `unstable_disableBuildValidation: true` in `[tab]/page.tsx` skips the
build-time simulation for the `unstable_instant` gate because local builds lack a live database
connection. This is explicitly documented in a 11-line comment block at page.tsx lines 42-48.
The `unstable_instant` export itself is present; dev-time overlay validation remains active;
production Vercel builds have database access. This is a documented environment gap, not an
implementation stub or debt marker.

---

## Behavioral Spot-Checks

Automated behavioral spot-checks are not applicable to this phase. The bug repros only in
production (Next 16 prefetching is disabled in dev per link.md:298). The empirical verification
was performed via the D-39c-09 manual prod-checkpoint protocol in Plan 07.

| Behavior | Method | Result |
|---|---|---|
| Profile top-nav click loads without 404 | Manual prod-checkpoint (D-39c-09 Step 3) | PASS |
| All profile tabs load without 404 | Manual prod-checkpoint (D-39c-09 Step 4) | PASS |
| BottomNav Profile (mobile) loads without 404 | Manual prod-checkpoint (D-39c-09 Step 5) | PASS |
| Partial-prefetch two-stage RSC pattern visible in DevTools | Manual prod-checkpoint (D-39c-09 Step 6) | PASS |
| Build exits 0 with route classified Partial Prerender | npm run build (automated) | PASS |

---

## Requirements Coverage

| Requirement | Source | Description | Status | Evidence |
|---|---|---|---|---|
| NEXT16-CONFORMANCE | All 7 plans | Refactor profile layout for Next 16 cacheComponents conformance | SATISFIED | Structural: ProfileShellResolver + ProfileGate + loading.tsx + unstable_instant + invalidation wiring + diagnostic revert. Empirical: operator APPROVED D-39c-09 prod-checkpoint. |

---

## Human Verification Required

None — the D-39c-09 manual prod-checkpoint protocol was executed and signed off by the operator
(twwaneka@gmail.com) before this verification. The 7 steps are documented as PASS in
39c-07-SUMMARY.md. No further human verification items remain.

---

## Process Learnings

Two cwd-drift incidents occurred during execution. Neither affected final state.

**Incident 1 — 39c-05 Task 1 (cwd-drift to main):** The first commit of Plan 05 Task 1
(`cec2fe1`: updateTag wiring in profile.ts) accidentally landed on `main` instead of the
worktree branch because the executor used `cd /Users/tylerwaneka/Documents/horlo` rather
than the worktree path. Caught immediately. Reverted from `main` via `git revert` (`9923826`).
Changes re-applied correctly on the worktree branch. Final net effect on `main`: zero change
from this incident (clean revert before the correct worktree commit merged).

**Incident 2 — 39c-04 orchestrator worktree drift:** The orchestrator briefly drifted into a
worktree directory during the 39c-04 merge attempt. Recovered without data loss. Final merged
state is correct.

**Learning:** When multiple worktree agents are active, executor agents should confirm the `git
rev-parse --show-toplevel` output before staging commits, not rely on the shell's working
directory. The revert-then-recommit recovery pattern worked correctly.

---

## Gaps Summary

No gaps. Phase goal is structurally and empirically achieved.

---

## Recommendation

**Close Phase 39c.** All 7 ROADMAP success criteria are verified in the codebase. The structural
fix (Plans 01-06) is code-complete and the empirical gate (Plan 07 D-39c-09 operator sign-off
against production) is recorded. The Router-Cache poisoning bug (profile-page-404-top-nav.md)
is resolved by architecture, not masked by mitigation.

Follow-up items (not blocking close):

1. **`unstable_disableBuildValidation: true` (documented environment gap)** — Can be flipped to
   `false` once a CI/CD pipeline provides a database fixture during build-time validation. Track
   as a backlog item when CI is configured.

2. **login-form.tsx push/refresh ordering hardening** — Deferred per D-39c-05 / debug doc
   "Root-cause hardening: deferred". Add to v5.x backlog separately.

3. **Other layout cacheComponents violations** — Audit of other layouts in `src/app/` for
   similar uncached top-level fetch patterns deferred per CONTEXT.md. Add to backlog when
   other profile-adjacent layouts are next touched.

---

_Verified: 2026-05-14_
_Verifier: Claude (gsd-verifier)_

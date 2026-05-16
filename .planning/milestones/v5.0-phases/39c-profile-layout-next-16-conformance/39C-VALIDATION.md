---
phase: 39c
slug: profile-layout-next-16-conformance
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-13
---

# Phase 39c — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> Detailed Validation Architecture lives in `39C-RESEARCH.md` §Validation Architecture.
> This file is the executable contract the planner derives per-task automation from.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed (no Vitest / Jest / Playwright). Validation is **static analysis + build-time gate + manual prod-checkpoint** per CONTEXT.md D-39c-09. |
| **Config file** | `next.config.ts` (lint + build). No test runner config exists. |
| **Quick run command** | `npm run lint && npm run build` |
| **Full suite command** | `npm run lint && npm run build` + manual prod-checkpoint protocol (D-39c-09, 7 steps) |
| **Estimated runtime** | ~60s automated + ~5min manual prod-checkpoint |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && npm run build`
- **After every plan wave:** Run static-analysis grep checks per per-task table below + `npm run build`
- **Before `/gsd-verify-work`:** Full automated suite green AND manual prod-checkpoint protocol executed and signed off
- **Max feedback latency:** ~60s (automated); manual checkpoint blocks phase gate, not per-task

---

## Per-Task Verification Map

> Authoritative source: `39C-RESEARCH.md` §Phase Requirements → Test Map. Reproduced here in execute-phase shape.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01 | 39c-02 | 1 | NEXT16-CONFORMANCE | T-39c-01 | `<ProfileShellResolver/>` has `'use cache'` + `cacheTag('profile:${username}')` + `cacheLife({ revalidate: 300 })` | static-analysis | `grep -n "use cache" src/app/u/\[username\]/profile-shell-resolver.tsx && grep -n "cacheTag(.profile:" src/app/u/\[username\]/profile-shell-resolver.tsx && grep -n "cacheLife({.*revalidate:.300" src/app/u/\[username\]/profile-shell-resolver.tsx` | ❌ W0 | ⬜ pending |
| 02-01 | 39c-02 | 1 | NEXT16-CONFORMANCE | T-39c-01 | `<ProfileShellResolver/>` does NOT call `getCurrentUser()` (Pitfall 1) | static-analysis | `! grep -n "getCurrentUser" src/app/u/\[username\]/profile-shell-resolver.tsx` | ❌ W0 | ⬜ pending |
| 03-02 | 39c-03 | 2 | NEXT16-CONFORMANCE | T-39c-01 | Layout body has NO uncached top-level data fetches | static-analysis | `! grep -nE "getCurrentUser\|getProfileByUsername\|getProfileSettings\|isFollowing\|getFollowerCounts\|getWatchesByUser\|getAllWearEventsByUser\|resolveCommonGround" src/app/u/\[username\]/layout.tsx` | ❌ W0 | ⬜ pending |
| 01-02 | 39c-01 | 1 | NEXT16-CONFORMANCE | — | `loading.tsx` exists at the profile segment | file-presence | `test -f src/app/u/\[username\]/loading.tsx` | ❌ W0 | ⬜ pending |
| 04-01 | 39c-04 | 3 | NEXT16-CONFORMANCE | — | `[tab]/page.tsx` exports `unstable_instant = { prefetch: 'static' }` | static-analysis | `grep -n "unstable_instant.*prefetch.*static" src/app/u/\[username\]/\[tab\]/page.tsx` | ❌ W0 | ⬜ pending |
| 04-01 | 39c-04 | 3 | NEXT16-CONFORMANCE | — | `unstable_instant` validation passes at build time (the build-time gate) | build | `npm run build` (exit 0) | ✅ | ⬜ pending |
| 05-01 | 39c-05 | 2 | NEXT16-CONFORMANCE | T-39c-02 | `profile.ts.updateProfile` invalidates `profile:${username}` via `updateTag` | static-analysis | `grep -n "updateTag(.profile:" src/app/actions/profile.ts` | ❌ W0 | ⬜ pending |
| 05-01 | 39c-05 | 2 | NEXT16-CONFORMANCE | T-39c-02 | `profile.ts.updateProfileSettings` invalidates `profile:${username}` via `updateTag` | static-analysis | `grep -nA20 "updateProfileSettings" src/app/actions/profile.ts \| grep -n "updateTag(.profile:"` | ❌ W0 | ⬜ pending |
| 05-02 | 39c-05 | 2 | NEXT16-CONFORMANCE | — | `watches.ts.addWatch` invalidates `profile:${ownerUsername}` via `revalidateTag(..., 'max')` | static-analysis | `grep -nA5 "revalidateTag('profile:" src/app/actions/watches.ts` | ❌ W0 | ⬜ pending |
| 05-02 | 39c-05 | 2 | NEXT16-CONFORMANCE | — | `watches.ts.editWatch` invalidates `profile:${ownerUsername}` | static-analysis | (scoped grep around editWatch) | ❌ W0 | ⬜ pending |
| 05-02 | 39c-05 | 2 | NEXT16-CONFORMANCE | — | `watches.ts.removeWatch` invalidates `profile:${ownerUsername}` | static-analysis | (scoped grep around removeWatch) | ❌ W0 | ⬜ pending |
| 05-03 | 39c-05 | 2 | NEXT16-CONFORMANCE | T-39c-03 | `follows.ts.followUser` invalidates `profile:${targetUsername}` AND `viewer:${viewerId}:profile:${targetUserId}` | static-analysis | `grep -n "revalidateTag(.profile:" src/app/actions/follows.ts && grep -n "updateTag(.viewer:.*profile:" src/app/actions/follows.ts` | ❌ W0 | ⬜ pending |
| 05-03 | 39c-05 | 2 | NEXT16-CONFORMANCE | T-39c-03 | `follows.ts.unfollowUser` mirrors followUser invalidation | static-analysis | (scoped grep around unfollowUser) | ❌ W0 | ⬜ pending |
| 05-04 | 39c-05 | 2 | NEXT16-CONFORMANCE | — | `wearEvents.ts.markAsWorn` invalidates `profile:${ownerUsername}` | static-analysis | `grep -n "revalidateTag(.profile:" src/app/actions/wearEvents.ts` | ❌ W0 | ⬜ pending |
| 05-04 | 39c-05 | 2 | NEXT16-CONFORMANCE | — | `wearEvents.ts.logWearWithPhoto` invalidates `profile:${ownerUsername}` | static-analysis | (scoped grep around logWearWithPhoto) | ❌ W0 | ⬜ pending |
| 05-01..04 | 39c-05 | 2 | NEXT16-CONFORMANCE | — | All `revalidateTag` calls use two-arg form (Pitfall 2) | static-analysis | `! grep -nE "revalidateTag\\([^,]+\\)" src/app/actions/*.ts` | ✅ | ⬜ pending |
| 06-01..03 | 39c-06 | 4 | NEXT16-CONFORMANCE | — | Diagnostic commit 2f42d00 reverted (no `prefetch={false}` on UserMenu / ProfileTabs / BottomNav) | static-analysis | `! grep -nE "prefetch=\\{false\\}" src/components/layout/UserMenu.tsx src/components/profile/ProfileTabs.tsx src/components/layout/BottomNav.tsx` | ❌ W0 | ⬜ pending |
| 06-03 | 39c-06 | 4 | NEXT16-CONFORMANCE | — | BottomNav `NavLink` no longer accepts a `prefetch` prop | static-analysis | `! grep -nE "prefetch\\?:.*boolean" src/components/layout/BottomNav.tsx` | ❌ W0 | ⬜ pending |
| 07-01 | 39c-07 | 5 | NEXT16-CONFORMANCE | — | Prod manual-checkpoint protocol (D-39c-09, 7 steps) signed off | manual-prod-checkpoint | (manual — see 39c-07-PLAN.md `<task type="checkpoint:human-verify">`) | — | ⬜ pending |

> Task ID convention: `{plan-number}-{task-sequence-in-plan}`. E.g., `05-01` = Plan 39c-05, first task. Ranges like `05-01..04` mean the criterion is satisfied by all four tasks collectively.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Wave 0 here is unusual: there is no test runner to install. Wave 0 instead means "files-to-be-created the planner must include in plan tasks". None of the static-analysis grep commands are runnable until the source files exist.

- [ ] `src/app/u/[username]/profile-shell-resolver.tsx` — `'use cache'` Server Component (D-39c-03)
- [ ] `src/app/u/[username]/profile-gate.tsx` — Suspense gate (D-39c-05)
- [ ] `src/app/u/[username]/profile-shell-skeleton.tsx` — chrome-only skeleton (D-39c-06)
- [ ] `src/app/u/[username]/loading.tsx` — segment loading boundary
- [ ] No test runner install needed — manual-checkpoint protocol covers prod-only prefetch behavior (link.md:298)

*If none: "Existing infrastructure covers all phase requirements."* — N/A; new files required.

---

## Manual-Only Verifications

> These cannot be automated because the bug is **prod-only**. `npm run dev` cannot reproduce it (prefetching disabled in dev per `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md:298`).

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Top-nav Profile click loads without 404 | NEXT16-CONFORMANCE / SC#5 | Prefetch disabled in dev | Deploy → sign in twwaneka@gmail.com → click "Profile" in top nav → expect `/u/twwaneka/collection` renders, no 404 |
| Each profile tab loads without 404 | NEXT16-CONFORMANCE / SC#5 | Prefetch disabled in dev | After above: click wishlist / worn / notes / stats / insights tabs → expect each renders without 404 |
| BottomNav Profile (mobile) loads without 404 | NEXT16-CONFORMANCE / SC#5 | Prefetch disabled in dev | After above (mobile or DevTools mobile emulation): click Profile in BottomNav → expect renders |
| Partial-prefetch behavior verified | NEXT16-CONFORMANCE / D-39c-06 | DevTools Network only meaningful in prod | DevTools Network: viewport entry of UserMenu Link should fire small RSC (skeleton chrome); click should fire second RSC for content |
| `unstable_instant` build-time gate | NEXT16-CONFORMANCE / D-39c-07 | Build-only validation | `npm run build` exits 0 — failure indicates non-instant shell |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (static-analysis grep) or are marked manual-prod-checkpoint (Plan 07 = `checkpoint:human-verify`)
- [x] Sampling continuity: every plan's static-analysis greps run after task commit; no 3 consecutive auto tasks without verify
- [x] Wave 0 covers all MISSING file artifacts (4 new source files: profile-shell-resolver.tsx, profile-gate.tsx, profile-shell-skeleton.tsx, loading.tsx)
- [x] No watch-mode flags (no test runner installed)
- [x] Feedback latency < ~60s (lint + build)
- [ ] Manual prod-checkpoint protocol (D-39c-09, 7 steps) signed off before phase verify (gated on Plan 07 execution post-deploy)
- [x] `nyquist_compliant: true` set in frontmatter (task IDs now populated)

**Approval:** approved 2026-05-13 (planning-time); prod-checkpoint signoff still pending Plan 07 execution.

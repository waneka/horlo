---
phase: 9
slug: follow-system-collector-profiles
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (see `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` |
| **Environment** | jsdom (RTL-compatible) |
| **Quick run command** | `npx vitest run --reporter=dot --changed` |
| **Full suite command** | `npx vitest run --reporter=dot` |
| **Estimated runtime** | ~10s full suite (~22 test files, ~2,400 lines). Phase 9 adds ~8 files; projected ~12s after merge. |

---

## Sampling Rate

- **After every task commit:** Run quick run command (<3s on changed files)
- **After every plan wave:** Run full suite command (~12s)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 12 seconds

---

## Per-Task Verification Map

All 13 Phase 9 tasks are covered by an automated command. No task ships production code without an executable verification at commit time.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01 T1 | 01 | 1 | FOLL-01, FOLL-02, FOLL-03, FOLL-04, PROF-09 | T-09-01..09 | Wave 0 RED — pins behavior for DAL, Server Actions, tasteOverlap before impl | unit + integration | `npx vitest run tests/lib/tasteOverlap.test.ts tests/data/follows.test.ts tests/actions/follows.test.ts --reporter=dot` (expects non-zero RED) | `tests/lib/tasteOverlap.test.ts`, `tests/data/follows.test.ts`, `tests/actions/follows.test.ts` | ⬜ pending |
| 09-01 T2 | 01 | 1 | FOLL-04, PROF-09 | T-09-01, T-09-03, T-09-07, T-09-08, T-09-09 | GREEN — follows DAL + tasteOverlap library pass Task 1 tests; no N+1; case/whitespace-normalized intersection | unit + integration | `npx vitest run tests/lib/tasteOverlap.test.ts tests/data/follows.test.ts --reporter=dot` | `src/data/follows.ts`, `src/lib/tasteOverlap.ts` | ⬜ pending |
| 09-01 T3 | 01 | 1 | FOLL-01, FOLL-02, FOLL-03 | T-09-01, T-09-02, T-09-04, T-09-05 | Server Actions enforce auth + Zod `.strict()` + self-follow rejection; idempotent via `onConflictDoNothing`; RLS policies verified in migration | action-level unit | `npx vitest run tests/actions/follows.test.ts --reporter=dot` | `src/app/actions/follows.ts` | ⬜ pending |
| 09-02 T1 | 02 | 2 | FOLL-01, FOLL-02, FOLL-03 | T-09-10, T-09-11, T-09-13, T-09-14 | Wave 0 RED — pins FollowButton state, optimistic path, rollback, variants, self-hidden, unauth redirect | RTL component | `npx vitest run tests/components/profile/FollowButton.test.tsx --reporter=dot` (expects non-zero RED) | `tests/components/profile/FollowButton.test.tsx` | ⬜ pending |
| 09-02 T2 | 02 | 2 | FOLL-01, FOLL-02 | T-09-10, T-09-11, T-09-13, T-09-14 | GREEN — FollowButton with three variants (primary/locked/inline), `useTransition` + optimistic + rollback, desktop hover-swap, mobile two-tap, self-null-render, unauth `/login?next=` redirect | RTL component | `npx vitest run tests/components/profile/FollowButton.test.tsx --reporter=dot` | `src/components/profile/FollowButton.tsx` | ⬜ pending |
| 09-02 T3 | 02 | 2 | FOLL-03, PROF-08 | T-09-11, T-09-12 | Layout hydrates `initialIsFollowing` server-side; ProfileHeader gates FollowButton on `!isOwner`; LockedProfileState uses live FollowButton (locked variant); LockedProfileState existing tests updated | RTL component + TS | `npx vitest run --reporter=dot && npx tsc --noEmit` | `src/components/profile/ProfileHeader.tsx`, `src/components/profile/LockedProfileState.tsx`, `src/app/u/[username]/layout.tsx`, `tests/components/profile/LockedProfileState.test.tsx` | ⬜ pending |
| 09-03 T1 | 03 | 3 | FOLL-04 | T-09-15 | AvatarDisplay extended to size=40 (additive, preserves 64/96); Wave 0 RED for FollowerListCard pinning row structure, private masking, own-row hide, stopPropagation, relative time | RTL component | `npx vitest run --reporter=dot` (FollowerListCard RED; existing tests GREEN) | `src/components/profile/AvatarDisplay.tsx`, `tests/components/profile/FollowerListCard.test.tsx` | ⬜ pending |
| 09-03 T2 | 03 | 3 | FOLL-04 | T-09-15, T-09-17 | GREEN — FollowerListCard (inline FollowButton with stopPropagation, Link overlay) + FollowerList (Server Component with empty-state) | RTL component + TS | `npx vitest run --reporter=dot && npx tsc --noEmit` | `src/components/profile/FollowerListCard.tsx`, `src/components/profile/FollowerList.tsx` | ⬜ pending |
| 09-03 T3 | 03 | 3 | FOLL-04 | T-09-16, T-09-18..20 | Route pages resolve owner via `getProfileByUsername`, 404 via `notFound()` on missing; `getFollowersForProfile` / `getFollowingForProfile` single-query DAL; `viewerFollowingSet` hydrated via batched `Promise.all(isFollowing ...)`; empty-state copy per UI-SPEC; TS + ESLint clean | e2e-lite (TS compile + route shape grep) | `npx tsc --noEmit && npx vitest run --reporter=dot && npx eslint 'src/app/u/[username]/followers/page.tsx' 'src/app/u/[username]/following/page.tsx'` | `src/app/u/[username]/followers/page.tsx`, `src/app/u/[username]/following/page.tsx` | ⬜ pending |
| 09-04 T1 | 04 | 3 | PROF-08 | T-09-24 | LockedTabCard renders per-tab copy with `{name} keeps their {label} private.` mapping (worn → "worn history"); `common-ground` tab returns null (never locked) | RTL component | `npx vitest run tests/components/profile/LockedTabCard.test.tsx --reporter=dot` | `src/components/profile/LockedTabCard.tsx`, `tests/components/profile/LockedTabCard.test.tsx` | ⬜ pending |
| 09-04 T2 | 04 | 3 | PROF-09 | T-09-22 | CommonGroundHeroBand renders three pill variants (Strong/Some/Different), pluralized stat strip, drill-down link, empty-overlap single-line treatment | RTL component | `npx vitest run tests/components/profile/CommonGroundHeroBand.test.tsx --reporter=dot` | `src/components/profile/CommonGroundHeroBand.tsx`, `tests/components/profile/CommonGroundHeroBand.test.tsx` | ⬜ pending |
| 09-04 T3 | 04 | 3 | PROF-09 | T-09-22 | CommonGroundTabContent renders 4 sections (explainer, shared watches grid, shared tags row, dual bars) with section-omission; ProfileTabs honors `showCommonGround` prop (6th tab). RED→GREEN via new component-level tests. | RTL component + TS | `npx vitest run tests/components/profile/CommonGroundTabContent.test.tsx tests/components/profile/ProfileTabs.test.tsx --reporter=dot && npx tsc --noEmit` | `src/components/profile/CommonGroundTabContent.tsx`, `src/components/profile/ProfileTabs.tsx`, `tests/components/profile/CommonGroundTabContent.test.tsx`, `tests/components/profile/ProfileTabs.test.tsx` | ⬜ pending |
| 09-04 T4 | 04 | 3 | PROF-08, PROF-09 | T-09-08, T-09-21, T-09-23, T-09-26, T-09-27 | Layout three-way gate (`viewerId && !isOwner && settings.collectionPublic`) before `getTasteOverlapData`; `[tab]/page.tsx` dispatches `common-ground` with `notFound()` on gate fail or empty overlap; all 5 private-tab guards use LockedTabCard; inline `PrivateTabState` removed. Gate + payload-shape test pins the server-only boundary. | unit (layout gate) + TS + ESLint | `npx vitest run tests/app/layout-common-ground-gate.test.ts --reporter=dot && npx tsc --noEmit && npx eslint 'src/app/u/[username]/layout.tsx' 'src/app/u/[username]/[tab]/page.tsx'` | `src/app/u/[username]/layout.tsx`, `src/app/u/[username]/[tab]/page.tsx`, `tests/app/layout-common-ground-gate.test.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Sampling Continuity Window Check

- **Plan 01:** T1 (test) / T2 (test) / T3 (test) — **3/3** covered
- **Plan 02:** T1 (test) / T2 (test) / T3 (test + TS) — **3/3** covered
- **Plan 03:** T1 (test) / T2 (test) / T3 (TS + suite + ESLint) — **3/3** covered
- **Plan 04:** T1 (test) / T2 (test) / T3 (test) / T4 (test + TS + ESLint) — **4/4** covered

**No gap exceeds 2 consecutive tasks without automated verification.** Every task has at least one `<automated>` command. Nyquist sampling satisfied phase-wide.

---

## Wave 0 Requirements

- [x] Test files covering FOLL-01, FOLL-02, FOLL-03, FOLL-04, PROF-08, PROF-09 per RESEARCH.md Validation Architecture
  - FOLL-01 / FOLL-02 / FOLL-03 → `tests/actions/follows.test.ts` (Plan 01 T1) + `tests/components/profile/FollowButton.test.tsx` (Plan 02 T1)
  - FOLL-03 end-to-end count reconciliation → `tests/actions/follows.test.ts` (spies `revalidatePath('/u/[username]', 'layout')` on both `followUser` and `unfollowUser` success paths)
  - FOLL-04 → `tests/data/follows.test.ts` (DAL shape) + `tests/components/profile/FollowerListCard.test.tsx` (Plan 03 T1)
  - PROF-08 → `tests/components/profile/LockedTabCard.test.tsx` (Plan 04 T1) + `tests/app/layout-common-ground-gate.test.ts` (Plan 04 T4)
  - PROF-09 → `tests/lib/tasteOverlap.test.ts` (Plan 01 T1) + `tests/components/profile/CommonGroundHeroBand.test.tsx` (Plan 04 T2) + `tests/components/profile/CommonGroundTabContent.test.tsx` + `tests/components/profile/ProfileTabs.test.tsx` + `tests/app/layout-common-ground-gate.test.ts` (Plan 04 T3/T4)

- [x] Shared fixtures for social-graph seed data, privacy-flag toggles, and Common Ground overlap cases
  - Watch factory `w(overrides)` pattern carries forward from `tests/lib/tasteTags.test.ts` — reused by `tests/lib/tasteOverlap.test.ts`
  - `vi.mock('@/db')` chain mock precedent carries forward from `tests/data/profiles.test.ts` — reused by `tests/data/follows.test.ts`
  - `vi.mock('@/lib/auth')` + `vi.mock('@/data/<...>')` precedent carries forward from `tests/actions/watches.test.ts` — reused by `tests/actions/follows.test.ts`
  - `vi.mock('@/app/actions/follows')` + `vi.mock('next/navigation')` RTL mocking baseline created in Plan 02 T1 — reused by Plan 03 and Plan 04 T2/T3
  - Overlap factory `makeOverlap(overrides)` baseline in Plan 04 T2 — reused by Plan 04 T3 `CommonGroundTabContent.test.tsx`

### Red-Before-Green Check

RED tests exist for every code-producing task before its GREEN implementation:

- [x] Plan 01 T1 (RED) → T2/T3 (GREEN)
- [x] Plan 02 T1 (RED) → T2 (GREEN); T3 updates existing tests (no new component code requires fresh RED phase — only wiring)
- [x] Plan 03 T1 (RED for FollowerListCard) → T2 (GREEN); T3 is route-level (test-through-TS-compile + grep sanity — no new component logic)
- [x] Plan 04 T1 (RED for LockedTabCard) → GREEN in same task
- [x] Plan 04 T2 (RED for CommonGroundHeroBand) → GREEN in same task
- [x] Plan 04 T3 (RED for CommonGroundTabContent + ProfileTabs) → GREEN in same task
- [x] Plan 04 T4 (RED for layout gate behavior + payload-shape constraint) → GREEN when layout + [tab]/page.tsx wiring lands in the same task

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Desktop hover-swap visible flip (`group-hover` CSS) | FOLL-02 UX polish | jsdom does not apply `:hover` pseudo-classes or `group-hover:` Tailwind variants. The DOM structure test (`both spans exist`) pins the markup; the visible flip itself requires a real browser. | `npm run dev` → hover the "Following" button on `/u/{other}` → visible text swaps to "Unfollow" in destructive tint |
| Mobile two-tap sequence under real touch | FOLL-02 UX polish | jsdom has no viewport / touch model; `matchMedia('(max-width: 639px)')` is mocked per test. | `npm run dev` on mobile viewport → first tap reveals "Unfollow"; second tap within 3s commits |
| Full follow → count reconciliation visually | Success Criterion #5 | `router.refresh()` behavior end-to-end requires Next.js dev server. Unit tests verify `revalidatePath` is called and `router.refresh` is called; the visible reconciliation requires integration. | `/u/{other}` click Follow → Followers count in ProfileHeader bumps without page reload |
| Locked-tab routing across tab switches | PROF-08 UX polish | Privacy visuals render fine in unit tests; the user-level "I clicked the tab, content swapped to locked card" flow is a multi-navigation interaction. | `/u/{otherPrivate}/collection` → LockedTabCard shown; click Wishlist tab → LockedTabCard for wishlist |
| Common Ground hero band → 6th-tab drill-down navigation | PROF-09 UX polish | Click on the "See full comparison →" link → navigation to `/u/{owner}/common-ground`. Next.js routing integration — unit tests pin the href only. | `/u/{other}` → click "See full comparison" → lands on Common Ground tab view |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — every task in Plans 01–04 has an `<automated>` command)
- [x] No watch-mode flags (all commands use `run` + `--reporter=dot`)
- [x] Feedback latency < 12s (full suite projected)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

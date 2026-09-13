---
phase: 84
slug: wear-history-depth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-12
---

# Phase 84 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3 (`vitest run`), jsdom default environment |
| **Config file** | `vitest.config.ts` (repo root) |
| **Quick run command** | `npx vitest run tests/unit/WornTimeline.test.tsx tests/components/profile/WornCalendar.test.tsx tests/actions/wearEventsBackfill.test.ts tests/components/profile/LogTodaysWearButton.test.tsx tests/components/profile/WearLeaderboard.test.tsx tests/unit/leaderboard.test.ts` (run only the files touched by the task) |
| **Full suite command** | `npm run test` + `npm run build` |
| **Estimated runtime** | ~15 seconds targeted; full suite several minutes |

---

## Sampling Rate

- **After every task commit:** Run targeted `npx vitest run <changed test files>`
- **After every plan wave:** Run `npm run test` + `npm run build`
- **Before `/gsd:verify-work`:** `npm run build` exit 0 (authoritative gate) and all Phase 84 test files green. Repo-wide vitest/tsc carry pre-existing baseline failures — do not chase unrelated red tests.
- **Max feedback latency:** 30 seconds (targeted)

---

## Per-Task Verification Map

Task IDs are finalized by the planner; rows below map requirements to their verification and are re-keyed to task IDs at plan time.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | WEAR-01 | — | N/A | unit (RTL) | `npx vitest run tests/unit/WornTimeline.test.tsx` (row wraps `<Link href="/wear/[id]">`) | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | WEAR-01 | — | N/A | unit (RTL) | `npx vitest run tests/components/profile/WornCalendar.test.tsx` (selected-day row links; day-cell select unchanged) | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | WEAR-02 | T-84-IDOR | Cross-user `watchId` returns uniform "Watch not found"; no insert | unit (action) | `npx vitest run tests/actions/wearEventsBackfill.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WEAR-02 | T-84-DATE | Server rejects `wornDate > today` independent of client `max` | unit (action) | `npx vitest run tests/actions/wearEventsBackfill.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WEAR-02 | T-84-DUP | 23505 on same watch+date → "Already logged this watch on that date." | unit (action, mocked DAL) | `npx vitest run tests/actions/wearEventsBackfill.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WEAR-02 | — | Activity logged only when `wornDate === today` | unit (action, spy) | `npx vitest run tests/actions/wearEventsBackfill.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WEAR-02 | — | N/A | unit (component) | `npx vitest run tests/components/profile/LogTodaysWearButton.test.tsx` (date-aware preflight uses selected date) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WEAR-03 | — | N/A | unit (RTL, keyboard) | `npx vitest run tests/components/profile/WearLeaderboard.test.tsx` (5 segments, default 3 mo, arrow keys) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WEAR-04 | — | N/A | unit (pure fn) | `npx vitest run tests/unit/leaderboard.test.ts` (window filter, count, tie-break, zero-wear inclusion) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WEAR-04 | T-84-LEAK | Non-owner viewer without collection access sees no zero-wear rows from private collection | unit/integration (gating) | `npx vitest run tests/components/profile/WearLeaderboard.test.tsx` or page-level gating test (planner chooses) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/actions/wearEventsBackfill.test.ts` — WEAR-02 (IDOR, future-date rejection, duplicate-day error, conditional activity logging); mirror `tests/actions/wearEventsVideo.test.ts`
- [ ] `tests/components/profile/LogTodaysWearButton.test.tsx` — WEAR-02 date-aware preflight
- [ ] `tests/components/profile/WearLeaderboard.test.tsx` — WEAR-03 / WEAR-04 window control + rendering + gating
- [ ] `tests/unit/leaderboard.test.ts` — WEAR-04 pure window-filter + ranking functions (no existing `stats.test.ts`)
- [ ] Extend `tests/unit/WornTimeline.test.tsx` and `tests/components/profile/WornCalendar.test.tsx` — WEAR-01 link-href assertions

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Timeline + Calendar rows navigate to `/wear/[id]` in the real app | WEAR-01 | Real routing / Router Cache behavior not exercised by RTL | `npm run dev` vs local Supabase, sign in as `vintage-anna@horlo.test` / `password123`, open own Worn tab, tap rows in both views |
| Photo-less past-date backfill appears dated correctly and does not post a feed activity | WEAR-02 | End-to-end Server Action + cache invalidation (`updateTag`) + TZ date handling | Open "Log a wear", pick a past date, submit without photo; confirm it appears in Timeline/Calendar on that day immediately and not on the home feed |
| Window control changes leaderboard ranking; keyboard nav works on real Base UI primitive | WEAR-03, WEAR-04 | Confirms Assumption A1 (tabs keyboard behavior) in a real browser | Toggle 1/3/6/12/All; use arrow keys on the control |
| Visitor gating on a private collection | WEAR-04 | Cross-user session state | View the same profile signed in as `modern-mike@horlo.test`; confirm no leaked zero-wear rows when collection is not public |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

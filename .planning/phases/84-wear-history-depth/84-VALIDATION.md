---
phase: 84
slug: wear-history-depth
status: planned
nyquist_compliant: true
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
| **Quick run command** | `npx vitest run tests/unit/WornTimeline.test.tsx tests/components/profile/WornCalendar.test.tsx tests/actions/wearEventsBackfill.test.ts tests/components/profile/LogTodaysWearButton.test.tsx tests/components/profile/WearLeaderboard.test.tsx tests/unit/leaderboard.test.ts tests/unit/wornTabScope.test.ts` (run only the files touched by the task) |
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 84-01-T1 | 01 | 1 | WEAR-01 | T-84-01 | Links expose only viewer-gated wear ids | unit (RTL) | `npx vitest run tests/unit/WornTimeline.test.tsx` (row `<Link href="/wear/[id]">`) | ✅ extend | ⬜ pending |
| 84-01-T2 | 01 | 1 | WEAR-01 | T-84-01 | N/A | unit (RTL) | `npx vitest run tests/components/profile/WornCalendar.test.tsx` (panel row links; day cell stays non-link; old link disappears on reselect) | ✅ extend | ⬜ pending |
| 84-02-T1 | 02 | 1 | WEAR-02 | T-84-IDOR, T-84-DATE, T-84-DUP, T-84-MASS | RED contract suite | unit (action) | `npx vitest run tests/actions/wearEventsBackfill.test.ts` (expected RED) | ❌ W0 (created here) | ⬜ pending |
| 84-02-T2 | 02 | 1 | WEAR-02 | T-84-IDOR | Cross-user `watchId` returns uniform "Watch not found"; no insert | unit (action) | `npx vitest run tests/actions/wearEventsBackfill.test.ts` (T4) | 84-02-T1 | ⬜ pending |
| 84-02-T2 | 02 | 1 | WEAR-02 | T-84-DATE | Server rejects `wornDate > today` + impossible dates, independent of client `max` | unit (action) | `npx vitest run tests/actions/wearEventsBackfill.test.ts` (T2, T3) | 84-02-T1 | ⬜ pending |
| 84-02-T2 | 02 | 1 | WEAR-02 | T-84-DUP | 23505 → "Already logged this watch on that date."; no activity | unit (action, mocked DAL) | `npx vitest run tests/actions/wearEventsBackfill.test.ts` (T7) | 84-02-T1 | ⬜ pending |
| 84-02-T2 | 02 | 1 | WEAR-02 | T-84-ACT | Activity logged only when `wornDate === today` | unit (action, spy) | `npx vitest run tests/actions/wearEventsBackfill.test.ts` (T5, T6) | 84-02-T1 | ⬜ pending |
| 84-03-T1 | 03 | 1 | WEAR-03, WEAR-04 | T-84-03 | N/A | unit (pure fn) | `npx vitest run tests/unit/leaderboard.test.ts` (window boundaries, count, D-13 tie-break, zero-wear inclusion) | ❌ W0 (created here) | ⬜ pending |
| 84-03-T2 | 03 | 1 | WEAR-04 | T-84-LEAK | Non-owner without collection access gets only event-referenced watches | unit (pure fn) | `npx vitest run tests/unit/wornTabScope.test.ts` | ❌ W0 (created here) | ⬜ pending |
| 84-04-T1 | 04 | 2 | WEAR-02 | T-84-DATE, T-84-DUP (transfer) | Date-aware preflight uses selected date; errors surface in role=alert | unit (component) | `npx vitest run tests/components/profile/LogTodaysWearButton.test.tsx` | ❌ W0 (created here) | ⬜ pending |
| 84-04-T2 | 04 | 2 | WEAR-02 | — | N/A | build + component | `npx vitest run tests/components/profile/LogTodaysWearButton.test.tsx && npm run build` | ✅ | ⬜ pending |
| 84-05-T1 | 05 | 2 | WEAR-03, WEAR-04 | — | RED suite | unit (RTL) | `npx vitest run tests/components/profile/WearLeaderboard.test.tsx` (expected RED) | ❌ W0 (created here) | ⬜ pending |
| 84-05-T2 | 05 | 2 | WEAR-03, WEAR-04 | T-84-LEAK (transfer), T-84-05 | Rows only from supplied watches; safe image URLs | unit (RTL, keyboard) | `npx vitest run tests/components/profile/WearLeaderboard.test.tsx` (5 segments, default 3 mo, arrow keys, expander, links) | 84-05-T1 | ⬜ pending |
| 84-06-T1 | 06 | 3 | WEAR-03, WEAR-04 | — | N/A | build + grep ordering | `npx vitest run tests/components/profile/WearLeaderboard.test.tsx && npm run build` | ✅ | ⬜ pending |
| 84-06-T2 | 06 | 3 | WEAR-04 | T-84-LEAK, T-84-07 | Page passes scoped lists; no new awaits | unit + static + build | `npx vitest run tests/unit/wornTabScope.test.ts tests/static/ppr-dynamic-before-use-cache.test.ts && npm run build` | ✅ | ⬜ pending |
| 84-07-T1 | 07 | 4 | all | T-84-08 | Local-only fixture setup | build + SQL | `npm run build && psql ... wear_events_unique_day` | ✅ | ⬜ pending |
| 84-07-T2 | 07 | 4 | all | T-84-LEAK | Cross-user walk | manual | human-verify checkpoint | — | ⬜ pending |
| 84-07-T3 | 07 | 4 | WEAR-02 | T-84-DUP, T-84-ACT | Photo-less past wear, no activity, no dupes | SQL assertions | `psql ... "select count(*) from wear_events where note = 'phase 84 backfill' and photo_url is null"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test files are created inside the first (RED) task of each owning plan rather than a separate Wave 0 plan:

- [ ] `tests/actions/wearEventsBackfill.test.ts` — 84-02-T1 (IDOR, future-date + impossible-date rejection, duplicate-day error, conditional activity logging, updateTag)
- [ ] `tests/unit/leaderboard.test.ts` — 84-03-T1 (window filter + ranking)
- [ ] `tests/unit/wornTabScope.test.ts` — 84-03-T2 (viewer scoping / T-84-LEAK)
- [ ] `tests/components/profile/LogTodaysWearButton.test.tsx` — 84-04-T1 (unified form + date-aware preflight)
- [ ] `tests/components/profile/WearLeaderboard.test.tsx` — 84-05-T1 (window control + rendering)
- [ ] Extend `tests/unit/WornTimeline.test.tsx` and `tests/components/profile/WornCalendar.test.tsx` — 84-01-T1/T2 (WEAR-01 link-href assertions)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Timeline + Calendar rows navigate to `/wear/[id]` in the real app | WEAR-01 | Real routing / Router Cache behavior not exercised by RTL | 84-07-T2 step 2 |
| Photo-less past-date backfill appears dated correctly and does not post a feed activity | WEAR-02 | End-to-end Server Action + `updateTag` + TZ date handling | 84-07-T2 steps 3-4, corroborated by 84-07-T3 SQL |
| Window control changes leaderboard ranking; keyboard nav works in a real browser | WEAR-03, WEAR-04 | Real focus management | 84-07-T2 step 1 |
| Visitor gating on a private collection | WEAR-04 | Cross-user session state | 84-07-T2 step 5 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (84-07-T2 is the sole manual checkpoint, bracketed by automated T1/T3)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-09-12

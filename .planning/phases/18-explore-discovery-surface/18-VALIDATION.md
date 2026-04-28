---
phase: 18
slug: explore-discovery-surface
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-27
last_updated: 2026-04-28
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated by gsd-planner during plan creation (Plans 01–05).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 + React Testing Library 16.3.2 + jsdom 25.0.1 + MSW 2.13.2 (already in `package.json`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/components/explore tests/data/getMostFollowedCollectors.test.ts tests/data/getTrendingCatalogWatches.test.ts tests/data/getGainingTractionCatalogWatches.test.ts tests/data/getWearEventsCountByUser.test.ts tests/components/layout/BottomNav.test.tsx tests/actions/follows.test.ts tests/actions/watches.test.ts` |
| **Full suite command** | `npm test` (alias for `vitest run`) |
| **Estimated runtime** | <30s for the Phase 18 subset; <90s for full suite |

DATABASE_URL gating: integration tests for the four DAL readers (Plan 01) are gated via `const maybe = process.env.DATABASE_URL ? describe : describe.skip` — Phase 17 + Phase 16 precedent. Component tests (Plan 02 + Plan 03 + Plan 04) and Server Action tests (Plan 05) run without DATABASE_URL.

---

## Sampling Rate

- **After every task commit:** Run quick command above (subset, <30s)
- **After every plan wave merge:** Run full suite (`npm test`, <90s)
- **Before `/gsd-verify-work`:** Full suite green + `npm run lint` clean
- **Max feedback latency:** <30s per task → <90s per wave

Compliance: every code-producing task in Plans 01–05 carries an `<automated>` verify command. Plans with multiple tasks chain to a Wave 0 dependency or share a verify command. No 3 consecutive tasks without an automated verify (Nyquist sampling target met).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-1 | 01 | 1 | DISC-03 | T-18-01-04 | getWearEventsCountByUser cross-user isolation | integration | `npx vitest run tests/data/getWearEventsCountByUser.test.ts` | NEW (created in task) | ⬜ pending |
| 18-01-2 | 01 | 1 | DISC-04 | T-18-01-01, T-18-01-05, T-18-01-06 | Two-layer privacy + notInArray empty guard + count cast | integration | `npx vitest run tests/data/getMostFollowedCollectors.test.ts tests/data/getTrendingCatalogWatches.test.ts` | NEW | ⬜ pending |
| 18-01-3 | 01 | 1 | DISC-06 | T-18-01-02 | Parameterized SQL template; snapshot_date cast | integration | `npx vitest run tests/data/getGainingTractionCatalogWatches.test.ts` | NEW | ⬜ pending |
| 18-02-1 | 02 | 2 | DISC-03, DISC-04 | T-18-02-03 | XSS via React escaping; non-clickable card | unit (TypeScript only) | `npx tsc --noEmit && npm run lint -- src/components/explore` | NEW (presentational) | ⬜ pending |
| 18-02-2 | 02 | 2 | DISC-04, DISC-05, DISC-06 | T-18-02-01, T-18-02-02 | viewerId-as-prop discipline; per-rail cache scope isolation | unit (component) | `npx vitest run tests/components/explore/` | NEW | ⬜ pending |
| 18-03-1 | 03 | 2 | DISC-03 | T-18-03-02 | Hero gate outside cache; no cross-user contamination | unit (page Server Component) | `npx vitest run tests/components/explore/ExplorePage.test.tsx` | NEW | ⬜ pending |
| 18-03-2 | 03 | 2 | DISC-07 | T-18-03-01 | /explore/collectors auth-gated; cap-50 + footer | unit (page) | `npx vitest run tests/components/explore/CollectorsSeeAll.test.tsx` | NEW | ⬜ pending |
| 18-03-3 | 03 | 2 | DISC-07 | T-18-03-01 | /explore/watches stacked sections; auth-gated | unit (page) | `npx vitest run tests/components/explore/WatchesSeeAll.test.tsx` | NEW | ⬜ pending |
| 18-04-1 | 04 | 1 | DISC-08 | T-18-04-01, T-18-04-02 | isPublicPath gate preserved; isAdd fully removed | unit (component) | `npx vitest run tests/components/layout/BottomNav.test.tsx` | EXISTS — full rewrite | ⬜ pending |
| 18-05-1 | 05 | 2 | DISC-04 | T-18-05-01, T-18-05-03 | RYO updateTag scoped to actor; not bare 'explore' | unit (Server Action) | `npx vitest run tests/actions/follows.test.ts` | EXISTS — extend | ⬜ pending |
| 18-05-2 | 05 | 2 | DISC-05 | T-18-05-02, T-18-05-04 | SWR revalidateTag two-arg; success path only | unit (Server Action) | `npx vitest run tests/actions/watches.test.ts` | EXISTS — extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Plan-to-requirement coverage (every DISC-XX appears in at least one task's `Requirement` cell):

| Requirement | Tasks |
|-------------|-------|
| DISC-03 | 18-01-1, 18-02-1, 18-03-1 |
| DISC-04 | 18-01-2, 18-02-1, 18-02-2, 18-05-1 |
| DISC-05 | 18-01-2, 18-02-2, 18-05-2 |
| DISC-06 | 18-01-3, 18-02-2 |
| DISC-07 | 18-03-2, 18-03-3 |
| DISC-08 | 18-04-1 |

All 6 requirements covered. ✅

---

## Wave 0 Requirements

> The Wave 0 work is folded INTO Plan 01 Task 1 (test scaffolds) so that Plan 01 Task 2 + Task 3 fill the assertions and downstream plans (02–05) can rely on those assertions to exist. There is no separate "Wave 0" plan because the test framework + jsdom + RTL + MSW are all already installed.

Wave 0 deliverables (all in Plan 01 Task 1):

- [ ] `tests/data/getWearEventsCountByUser.test.ts` — full implementation (Plan 01 Task 1)
- [ ] `tests/data/getMostFollowedCollectors.test.ts` — `it.todo` scaffold (Plan 01 Task 1) → filled in Plan 01 Task 2
- [ ] `tests/data/getTrendingCatalogWatches.test.ts` — `it.todo` scaffold (Plan 01 Task 1) → filled in Plan 01 Task 2
- [ ] `tests/data/getGainingTractionCatalogWatches.test.ts` — `it.todo` scaffold (Plan 01 Task 1) → filled in Plan 01 Task 3

Component / page test files are created in their respective plans (Plan 02 + Plan 03) — no Wave 0 scaffolding needed because each test file is self-contained against mocked DAL.

BottomNav.test.tsx (Plan 04) is a rewrite of an existing file — no Wave 0 scaffolding needed; the rewrite is the primary task.

`tests/actions/follows.test.ts` and `tests/actions/watches.test.ts` (Plan 05) are extensions of existing files — no Wave 0 scaffolding.

---

## Manual-Only Verifications

Reserved for behaviors that cannot be cheaply automated. Phase 18 is intentionally light on manual verification because the surface is read-only and the BottomNav slot rewrite has full unit-test coverage.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual rhythm + spacing on /explore (UI-SPEC fidelity at component level) | DISC-03..06 | Snapshot tests on full pages add fragility without catching the visual regressions UI-SPEC actually targets (token usage, spacing scale, accent reservation). | After Wave 2 merge: visit /explore as a sparse-network user (followingCount<3, wearEventsCount=0) and a dense-network user; visually compare against `18-UI-SPEC.md` § Spacing / Typography / Color sections. Confirm hero h1 uses `font-serif`, rail headings use `text-xl font-semibold`, sublabels use `text-sm text-muted-foreground`. |
| BottomNav slot order on real iOS device with safe-area | DISC-08 | Safe-area iOS padding (env(safe-area-inset-bottom)) is not exercised by jsdom; tap-target verification needs hardware. | Open `npm run dev` in Safari iOS or Chrome Android; verify 5 slots in order Home/Search/Wear/Explore/Profile, Wear cradle visually elevated, no chrome flash on auth pages, safe-area padding fills the home-indicator area. |
| Gaining Traction "real" partial-window behavior over multiple days | DISC-06 | The 0/1-6/7+ window cases are fully unit-tested via mocked snapshot data, but production deploy day (D-12 case 1) is worth a 30-second visual smoke after first deploy. | Day 0 post-deploy: visit /explore — Gaining Traction shows "Not enough data yet" empty-state body. Day 1 post-deploy (after pg_cron @ 03:00 UTC has fired once): visit /explore — Gaining Traction shows cards with "↑ +N in 1 day" sublabel. |
| `npm run db:refresh-counts` reflects new watches in Trending within next cache window | DISC-05 | The Plan 05 `revalidateTag('explore', 'max')` invalidation is unit-tested but the integration of cache-eviction + DAL re-fetch under a real Next 16 dev server is best smoke-tested manually. | Add a watch via the form OR import via URL; wait <5min OR force tag invalidation via the addWatch path; refresh /explore — newly-added watch surfaces in Trending with the correct sublabel. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 01 Task 1 creates the test files)
- [x] No watch-mode flags
- [x] Feedback latency <90s per wave (well under any reasonable threshold)
- [x] `nyquist_compliant: true` set in frontmatter (every task has automated verify)

**Approval:** ready for executor consumption (planner-issued)

---
phase: 10
slug: activity-feed
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (proposed — Wave 0 installs if not yet present) |
| **Config file** | `vitest.config.ts` (Wave 0 scaffolds if missing) |
| **Quick run command** | `npm run test -- --run --reporter=basic` |
| **Full suite command** | `npm run test -- --run && npm run lint && npm run build` |
| **Estimated runtime** | ~60–120 seconds (unit+lint+build; no E2E in CI at MVP) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run --reporter=basic` (scoped to changed file's test by default)
- **After every plan wave:** Run `npm run test -- --run && npm run lint && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds for unit feedback, ~120 seconds for full gate

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-00-01 | 00 | 0 | — | T-10-02 | activities_select_own replaced by own-or-followed | migration | `npx drizzle-kit push && psql ... -c "SELECT policyname FROM pg_policies WHERE tablename='activities'"` | ❌ W0 | ⬜ pending |
| 10-00-02 | 00 | 0 | — | — | Cache Components enabled | config | `grep -q "cacheComponents: true" next.config.ts` | ❌ W0 | ⬜ pending |
| 10-00-03 | 00 | 0 | — | — | vitest scaffolded | setup | `test -f vitest.config.ts` | ❌ W0 | ⬜ pending |
| 10-01-01 | 01 | 1 | FEED-01, FEED-03 | — | keyset cursor predicate | unit | `npm run test -- --run src/lib/feedCursor.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | FEED-04 | — | time-window aggregation collapses 3+ | unit | `npm run test -- --run src/lib/feedAggregate.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | FEED-01, FEED-02 | T-10-01 | per-event privacy DAL gating | integration | `npm run test -- --run src/data/activities.int.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-04 | 01 | 1 | FEED-03 | — | Load More Server Action returns next keyset page | integration | `npm run test -- --run src/app/actions/feed.int.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-05 | 01 | 1 | FEED-01 | — | Activity row renders from metadata (no watch JOIN) | unit | `npm run test -- --run src/components/feed/ActivityRow.test.tsx` | ❌ W0 | ⬜ pending |
| 10-01-06 | 01 | 1 | FEED-04 | — | Empty-state prompt renders when zero follows | unit | `npm run test -- --run src/components/feed/FeedEmptyState.test.tsx` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | WYWT-03 | T-10-01 | WYWT DAL composes getPublicWearEventsForViewer, 48h + dedupe | integration | `npm run test -- --run src/data/wearRail.int.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | WYWT-03 | — | localStorage viewed-state is SSR-safe | unit | `npm run test -- --run src/hooks/useViewedWears.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-03 | 02 | 2 | WYWT-03 | — | Watch picker dialog shared by self-tile + `+ Wear` | unit | `npm run test -- --run src/components/nav/WatchPickerDialog.test.tsx` | ❌ W0 | ⬜ pending |
| 10-02-04 | 02 | 2 | WYWT-03 | — | addToWishlistFromWearEvent snapshots metadata | integration | `npm run test -- --run src/app/actions/wishlist.int.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 3 | DISC-02 | — | rule-based rec scoring is deterministic | unit | `npm run test -- --run src/lib/recommendations.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-02 | 03 | 3 | FEED-05 | — | wishlistGap identifies underrepresented role | unit | `npm run test -- --run src/lib/wishlistGap.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-03 | 03 | 3 | DISC-04 | — | Suggested Collectors ordered by tasteOverlap DESC | integration | `npm run test -- --run src/data/suggestedCollectors.int.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-04 | 03 | 3 | FEED-01..05, WYWT-03, DISC-02, DISC-04 | T-10-01, T-10-02 | page.tsx renders 5-section network home | integration | `npm run test -- --run src/app/home.int.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install / verify `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/jest-dom` (if missing)
- [ ] `vitest.config.ts` — jsdom environment, path alias `@/*`, setup file
- [ ] `vitest.setup.ts` — `@testing-library/jest-dom` matchers
- [ ] `src/test/db.ts` — integration test harness that hits a dedicated Postgres (local Supabase or test schema) and runs RLS-aware queries as a non-service-role user
- [ ] `src/test/fixtures/activities.ts` — seed helpers for `activities`, `follows`, `wear_events`, `profile_settings`
- [ ] Enable `cacheComponents: true` in `next.config.ts` (required before any `use cache` directive renders)
- [ ] Drop `activities_select_own` policy and add `activities_select_own_or_followed` migration (BLOCKING — feed returns zero rows without this)
- [ ] Add npm scripts: `test`, `test:unit`, `test:int` (if missing)

*Rationale:* Vitest is the modern Vite-native option and pairs cleanly with Next.js 16's Turbopack. If the repo already uses a different framework, Wave 0 swaps to that — the contract (quick + full commands, per-task map) stays identical.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WYWT overlay swipe gesture on real mobile | WYWT-03 | Touch events need a real device — JSDOM + pointer-event simulation doesn't cover iOS/Android edge cases | `/gsd-verify-work`: open WYWT rail on iPhone Safari and Android Chrome; swipe forward/back through 3+ tiles; swipe down to dismiss; confirm viewed-state ring updates |
| Figma visual fidelity across 5 sections | L-01..N-03 | Pixel comparison needs human judgment | Compare deployed preview against Figma node `1:2205` at mobile (375px) + desktop (1440px) breakpoints; flag material deviations |
| "Feels active" subjective goal | Phase goal | The goal statement ("makes the network feel active") is qualitative | Onboarding two test collectors, following them, and subjectively confirming the home feels populated and scannable |
| Cross-device WYWT viewed-state drift | W-06 | localStorage is device-local by design — the "drift" is an intentional tradeoff, but users should still find it acceptable | Sign in on two devices, open 2–3 WYWT tiles on device A, confirm device B still shows them as unviewed; confirm this is not a bug report |
| Cache invalidation on follow/unfollow | C-06 | `cacheLife(5min)` means follows don't immediately change the "Collectors Like You" slot — intended, but needs a manual check that it's not jarring | Follow a new collector, wait < 5min, confirm recs eventually refresh; confirm no stale ghost rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (RLS policy, cacheComponents flag, vitest config)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s for unit, < 120s for full
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets this after filling concrete task IDs)

**Approval:** pending

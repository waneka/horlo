---
phase: 14
slug: nav-shell-explore-stub
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-23
updated: 2026-04-23
---

# Phase 14 — Validation Strategy

> Per-phase validation contract. Every task with code changes references an `<automated>` verify command bound to at least one test file. Test files are created alongside the code they verify (co-located with implementation plans — no separate Wave 0 plan, since jsdom+RTL+vitest+mocks make TDD within each plan cheap).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + React Testing Library + jsdom |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run && npm run lint && npm run build` |
| **Estimated runtime** | ~60 seconds (unit) + ~90 seconds (lint + build) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run <affected-test-file>`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite + build must be green; manual iOS safe-area QA complete
- **Max feedback latency:** 60 seconds for unit; physical-device safe-area QA is manual only

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 14-01-T1 | 01 | 1 | NAV-05 | T-14-01-02 | Shared PUBLIC_PATHS constant + isPublicPath predicate | unit | `npm test -- --run tests/lib/public-paths.test.ts` | ⬜ pending |
| 14-01-T2 | 01 | 1 | NAV-05 | T-14-01-01 | Proxy imports shared constant (single source of truth) | unit | `npm test -- --run tests/proxy.test.ts` | ⬜ pending |
| 14-02-T1 | 02 | 1 | NAV-03 | T-14-02-02 | Layout contract RED test — viewport + theme script lock | unit | `npm test -- --run tests/app/layout.test.tsx` | ⬜ pending |
| 14-02-T2 | 02 | 1 | NAV-03 | T-14-02-01, T-14-02-02 | IBM Plex Sans + viewport-fit=cover + preserved theme script | unit + build | `npm test -- --run tests/app/layout.test.tsx && npm run build` | ⬜ pending |
| 14-03-T1 | 03 | 2 | NAV-09 | T-14-03-03 | NavWearButton appearance prop (no fork) | unit | `npm test -- --run tests/components/layout/NavWearButton.test.tsx` | ⬜ pending |
| 14-03-T2 | 03 | 2 | NAV-01, NAV-02, NAV-03, NAV-04, NAV-05, NAV-09, NAV-10 | T-14-03-01, T-14-03-02, T-14-03-04 | BottomNav: 5 items, elevated Wear, active state, auth exclusion, main padding | unit + build | `npm test -- --run tests/components/layout/BottomNav.test.tsx tests/app/layout.test.tsx && npm run build` | ⬜ pending |
| 14-04-T1 | 04 | 2 | NAV-06, NAV-07, NAV-10 | T-14-04-01, T-14-04-03 | SlimTopNav + DesktopTopNav composition + HeaderNav Insights removal | unit | `npm test -- --run tests/components/layout/SlimTopNav.test.tsx tests/components/layout/DesktopTopNav.test.tsx tests/components/layout/HeaderNav.test.tsx` | ⬜ pending |
| 14-04-T2 | 04 | 2 | NAV-05, NAV-12 | T-14-04-02, T-14-04-04 | Header delegator + NotificationBell relocation + MobileNav deletion | unit + build | `npm test -- --run tests/components/layout/Header.bell-placement.test.tsx tests/lib/mobile-nav-absence.test.ts && npm run build` | ⬜ pending |
| 14-05-T1 | 05 | 1 | NAV-08 | T-14-05-01 | InlineThemeSegmented 3-button segmented row | unit | `npm test -- --run tests/components/layout/InlineThemeSegmented.test.tsx` | ⬜ pending |
| 14-05-T2 | 05 | 1 | NAV-08 | T-14-05-03 | UserMenu consolidation (Profile/Settings/Theme/Sign out) | unit | `npm test -- --run tests/components/layout/UserMenu.test.tsx` | ⬜ pending |
| 14-06-T1 | 06 | 1 | NAV-11 | T-14-06-02 | /explore coming-soon stub | unit | `npm test -- --run tests/app/explore.test.tsx` | ⬜ pending |
| 14-06-T2 | 06 | 1 | NAV-11 | T-14-06-02 | /search coming-soon stub | unit | `npm test -- --run tests/app/search.test.tsx` | ⬜ pending |
| 14-07-T1 | 07 | 1 | NAV-11 | T-14-07-01 | ProfileTabs owner-only Insights tab | unit | `npm test -- --run tests/components/profile/ProfileTabs.test.tsx` | ⬜ pending |
| 14-07-T2 | 07 | 1 | NAV-11 | T-14-07-01, T-14-07-02, T-14-07-05 | [tab]/page insights branch with notFound for non-owners | unit | `npm test -- --run tests/app/profile-tab-insights.test.tsx` | ⬜ pending |
| 14-07-T3 | 07 | 1 | NAV-11 | T-14-07-03, T-14-07-04 | /insights retirement redirect | unit + build | `npm test -- --run tests/app/insights-retirement.test.tsx && npm run build` | ⬜ pending |
| 14-08-T1 | 08 | 1 | NAV-11 | T-14-08-01 | Settings "Taste Preferences" link row | unit | `npm test -- --run tests/components/settings/SettingsClient.test.tsx` | ⬜ pending |
| 14-09-T1 | 09 | 1 | DEBT-01 | T-14-09-01 | PreferencesClient regression-lock (role=alert + aria-live) | unit | `npm test -- --run tests/components/preferences/PreferencesClient.debt01.test.tsx` | ⬜ pending |
| 14-09-T2 | 09 | 1 | DEBT-01 | — | REQUIREMENTS.md traceability update | grep | `node -e "const s=require('fs').readFileSync('.planning/REQUIREMENTS.md','utf8'); if(!/DEBT-01 \\| Phase 14 \\| Complete/.test(s))process.exit(1)"` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Test File Inventory

Test files are co-located with implementation (no separate Wave 0 plan). Each file is created by the plan that owns the behavior it verifies.

| Test File | Created By | Verifies |
|-----------|-----------|----------|
| `tests/lib/public-paths.test.ts` | Plan 01 T1 | NAV-05 PUBLIC_PATHS constant + isPublicPath() |
| `tests/proxy.test.ts` (extension) | Plan 01 T2 | Proxy imports shared constant |
| `tests/app/layout.test.tsx` | Plan 02 T1 (RED) + T2 (GREEN) | NAV-03 viewport export + theme script preservation |
| `tests/components/layout/NavWearButton.test.tsx` (extension) | Plan 03 T1 | NAV-09 no-fork + appearance prop |
| `tests/components/layout/BottomNav.test.tsx` | Plan 03 T2 | NAV-01, 02, 04, 05, 09, 10 — full BottomNav contract |
| `tests/components/layout/SlimTopNav.test.tsx` | Plan 04 T1 | NAV-06 slim top composition + auth exclusion |
| `tests/components/layout/DesktopTopNav.test.tsx` | Plan 04 T1 | NAV-07 desktop composition + NAV-10 Add icon |
| `tests/components/layout/HeaderNav.test.tsx` (new or extension) | Plan 04 T1 | D-14 Insights removal from baseNavItems |
| `tests/components/layout/Header.bell-placement.test.tsx` | Plan 04 T2 | D-23 bell relocation parity |
| `tests/lib/mobile-nav-absence.test.ts` | Plan 04 T2 | NAV-12 MobileNav deletion |
| `tests/components/layout/InlineThemeSegmented.test.tsx` | Plan 05 T1 | NAV-08 D-17 theme segmented control |
| `tests/components/layout/UserMenu.test.tsx` (rewrite) | Plan 05 T2 | NAV-08 dropdown consolidation |
| `tests/app/explore.test.tsx` | Plan 06 T1 | NAV-11 /explore stub |
| `tests/app/search.test.tsx` | Plan 06 T2 | D-19 /search stub |
| `tests/components/profile/ProfileTabs.test.tsx` | Plan 07 T1 | D-13/D-15 owner-only Insights tab |
| `tests/app/profile-tab-insights.test.tsx` | Plan 07 T2 | D-13 owner gate + notFound for non-owners |
| `tests/app/insights-retirement.test.tsx` | Plan 07 T3 | D-13 /insights redirect |
| `tests/components/settings/SettingsClient.test.tsx` | Plan 08 T1 | D-12 Taste Preferences row |
| `tests/components/preferences/PreferencesClient.debt01.test.tsx` | Plan 09 T1 | DEBT-01 regression lock |

Total: 18 test files (14 new, 4 extensions).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bottom nav does not overlap iOS home indicator on Face ID device | NAV-03 | `env(safe-area-inset-bottom)` behavior only manifests on a real iOS device / iOS Simulator; jsdom cannot evaluate CSS env() | Open Horlo on an iPhone (Face ID) or iOS Simulator → any authenticated route → scroll to bottom; confirm (a) bottom nav sits above the home indicator bar, (b) page content's last element is fully visible (not clipped), (c) rotate to landscape and repeat |
| Zero-FOUC theme boot preserved across nav changes | Phase 10 invariant | FOUC only visible on real browser first-paint; vitest/jsdom renders the final DOM state | Run `npm run build && npm run start`, open in Chrome incognito, watch Network tab for theme flicker on first load; repeat in Safari and Firefox |
| Figma pixel parity of Wear circle elevation (node 1:4714) | NAV-01 | Visual diff against Figma is a manual comparison | Open mobile viewport (393px width), compare BottomNav to Figma node 1:4714 at 1× zoom: circle is 56×56, extends ~20px above bar, shadow matches two-layer spec |
| Desktop profile dropdown theme row spacing | NAV-08 D-17 | Subjective — 3-button segmented row must not overflow the 64px dropdown width; claim in D-17 allows fallback to submenu | Render in a laptop-width browser; if segmented row overflows or looks cramped, re-implement as a nested submenu per D-17 fallback |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (see Per-Task Verification Map)
- [x] Sampling continuity: every plan has at least one `<automated>` command per task
- [x] No Wave 0 gaps — test files co-located with implementation tasks
- [x] `--run` flag enforced on every `npm test` invocation (no watch mode)
- [x] Feedback latency < 60 seconds for unit tests
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner-signed; re-verified by checker during execution)

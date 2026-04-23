---
phase: 14
slug: nav-shell-explore-stub
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: see `## Validation Architecture` section in `14-RESEARCH.md` for the full test-file enumeration and rationale.

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

> Filled in by the planner as PLAN.md tasks are created. Every task with code changes must reference either an `<automated>` verify command or a Wave 0 test-file dependency. Requirements map: NAV-01..12, DEBT-01. See `14-RESEARCH.md` §Validation Architecture for the 13 pre-scoped test files.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Planner-populated from `14-RESEARCH.md` §Validation Architecture. Anticipated test files (13):

- [ ] `src/components/layout/__tests__/BottomNav.test.tsx` — NAV-01, NAV-02, NAV-04, NAV-05 (5-item render, Wear circle, active state, auth-route exclusion)
- [ ] `src/components/layout/__tests__/SlimTopNav.test.tsx` — mobile top chrome (logo, search, bell slot, settings)
- [ ] `src/components/layout/__tests__/DesktopTopNav.test.tsx` — NAV-06, NAV-07 desktop layout + profile dropdown contents
- [ ] `src/components/layout/__tests__/UserMenu.test.tsx` — NAV-08 consolidation (Profile/Settings/inline Theme/Sign out)
- [ ] `src/components/layout/__tests__/NavWearButton.test.tsx` — NAV-09 shared-component regression guard (no fork, dialog opens)
- [ ] `src/lib/constants/__tests__/public-paths.test.ts` — NAV-05 D-21/D-22 single-source-of-truth
- [ ] `src/proxy.test.ts` (or extension) — proxy imports PUBLIC_PATHS from shared constant
- [ ] `src/components/profile/__tests__/ProfileTabs.test.tsx` — D-13/D-15 owner-only Insights tab visibility (viewer === profile.user_id)
- [ ] `src/app/insights/__tests__/page.test.tsx` — D-13 retirement redirects to profile Insights tab
- [ ] `src/app/explore/__tests__/page.test.tsx` — NAV-11 stub renders placeholder
- [ ] `src/app/search/__tests__/page.test.tsx` — D-19 stub renders placeholder
- [ ] `src/components/preferences/__tests__/PreferencesClient.test.tsx` (extension) — DEBT-01 regression lock: role="alert" banner on save failure
- [ ] `src/components/settings/__tests__/SettingsClient.test.tsx` (extension) — D-12 "Taste Preferences" link row routes to /preferences

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bottom nav does not overlap iOS home indicator on Face ID device | NAV-03 | `env(safe-area-inset-bottom)` behavior only manifests on a real iOS device / iOS Simulator; jsdom cannot evaluate CSS env() | Open Horlo on an iPhone (Face ID) or iOS Simulator → any authenticated route → scroll to bottom; confirm (a) bottom nav sits above the home indicator bar, (b) page content's last element is fully visible (not clipped), (c) rotate to landscape and repeat |
| Zero-FOUC theme boot preserved across nav changes | Phase 10 invariant | FOUC only visible on real browser first-paint; vitest/jsdom renders the final DOM state | Run `npm run build && npm run start`, open in Chrome incognito, watch Network tab for theme flicker on first load; repeat in Safari and Firefox |
| Figma pixel parity of Wear circle elevation (node 1:4714) | NAV-01 | Visual diff against Figma is a manual comparison | Open mobile viewport (393px width), compare BottomNav to Figma node 1:4714 at 1× zoom: circle is 56×56, extends ~20px above bar, shadow matches two-layer spec |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`--run` flag enforced on every `npm test` call)
- [ ] Feedback latency < 60 seconds for unit tests
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

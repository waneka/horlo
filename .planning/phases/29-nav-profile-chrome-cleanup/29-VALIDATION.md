---
phase: 29
slug: nav-profile-chrome-cleanup
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-05
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 + @testing-library/react 16.3.2 + jsdom 25 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- tests/components/layout/UserMenu.test.tsx tests/components/profile/ProfileTabs.test.tsx tests/components/watch/AddWatchFlow.test.tsx tests/components/watch/WatchForm.test.tsx` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15s (focused subset) / ~60s (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/components/<edited-file>` (only the test file for the just-modified component).
- **After every plan wave:** Run `npm run test -- tests/components/layout tests/components/profile tests/components/watch` (all Phase 29 affected component-level tests).
- **Before `/gsd-verify-work`:** `npm run test` (full suite) must be green.
- **Max feedback latency:** 60 seconds.

---

## Per-Task Verification Map

> Filled in by the planner once PLAN.md task IDs exist. Below is the requirement-level mapping the planner must honor.

| Req ID | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|--------|----------|------------|-----------|-------------------|-------------|--------|
| NAV-16 | Profile DropdownMenuItem deleted; dropdown order is email→Settings→Theme→Sign out | — | unit | `npm run test -- tests/components/layout/UserMenu.test.tsx` | ✅ existing (Tests 3 + 4 update; Test 5 unchanged) | ⬜ pending |
| NAV-16 | Profile link with name=`/^profile$/i` is not in the DOM regardless of username state | — | unit | same as above | ✅ existing (Test 5 already covers; verify post-NAV-16) | ⬜ pending |
| PROF-10 | TabsList className includes `overflow-x-auto`, `overflow-y-hidden`, `pb-2`, `[scrollbar-width:none]`, `[&::-webkit-scrollbar]:hidden` | — | unit | `npm run test -- tests/components/profile/ProfileTabs.test.tsx` | ✅ existing (extend with new className-assertion test) | ⬜ pending |
| PROF-10 | Vertical-scroll passthrough on touch/trackpad gesture | — | manual UAT | (manual) | n/a | ⬜ pending |
| FORM-04 | AddWatchFlow re-render with new `key` resets `url` to `''` and `state.kind` to `'idle'` | — | unit | `npm run test -- tests/components/watch/AddWatchFlow.test.tsx` | ❌ W0 (NEW file) | ⬜ pending |
| FORM-04 | WatchForm re-mount with new `key` resets `formData` to `initialFormData` | — | unit | `npm run test -- tests/components/watch/WatchForm.test.tsx` | ✅ existing (extend) | ⬜ pending |
| FORM-04 | useLayoutEffect cleanup runs on unmount and resets state | — | unit | included in `tests/components/watch/AddWatchFlow.test.tsx` | ❌ W0 (NEW) | ⬜ pending |
| FORM-04 | Verdict cache survives AddWatchFlow remount | — | unit (regression) | run existing Phase 20 D-06 cache tests | ✅ existing (path TBD by planner; locate via grep `useWatchSearchVerdictCache`) | ⬜ pending |
| FORM-04 | Manual UAT: navigate /watch/new → paste URL → router.push → click Add Watch CTA → assert empty | — | manual UAT | (manual) | n/a | ⬜ pending |
| FORM-04 | Manual UAT: paste URL → browser-back from /u/.../collection → /watch/new → assert empty | — | manual UAT | (manual) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/components/watch/AddWatchFlow.test.tsx` — NEW FILE. Covers FORM-04 D-19 unit assertions: key-change remount + useLayoutEffect cleanup. Pattern: vitest + RTL + `next/navigation` mock (mirror existing `UserMenu.test.tsx` and `ProfileTabs.test.tsx` setup).
- [ ] `tests/components/watch/WatchForm.test.tsx` extension — add a single test asserting `formData` returns to `initialFormData` after remount with new `key`. Existing file already covers other WatchForm behavior; just add one test.
- [ ] No framework install needed (vitest + RTL + jsdom all in place).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vertical-scroll passthrough on touch/trackpad gesture for ProfileTabs | PROF-10 | JSDOM doesn't faithfully simulate touch/trackpad gesture forwarding | On `/u/{username}`: scroll vertically with two-finger trackpad swipe over the tab strip — page must scroll, tab strip must NOT consume the gesture. Repeat with touch on mobile if available. |
| Add-Watch flow reset on browser back-nav from `/u/.../collection` | FORM-04 | Activity-preservation behavior is router-runtime-specific; JSDOM cannot replay Next.js client cache | Navigate `/watch/new` → paste URL → wait for verdict-ready → `router.push('/u/{username}/collection')` → browser back → assert paste URL input is empty AND `state.kind === 'idle'`. |
| Add-Watch flow reset on CTA re-entry | FORM-04 | End-to-end navigation flow not exercised in unit tests | On any "Add Watch" CTA in app: enter `/watch/new`, paste URL, navigate elsewhere via Cancel/Skip-to-elsewhere or commit, then click "Add Watch" CTA again — paste URL must be empty, rail must be empty. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (`AddWatchFlow.test.tsx` is NEW; created in Plan 29-01)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-05

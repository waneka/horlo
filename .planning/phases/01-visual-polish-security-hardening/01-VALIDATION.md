---
phase: 1
slug: visual-polish-security-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated by the planner from RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (to be installed in Wave 0 — none present today) |
| **Config file** | `vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run && npm run lint && npm run build` |
| **Estimated runtime** | ~45 seconds (vitest ~10s, lint ~5s, build ~30s) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run && npm run lint && npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green + manual 375px viewport walkthrough
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD     | TBD  | 0    | SEC-01, SEC-02 | —       | N/A (infra)     | infra     | `npx vitest --version` | ❌ W0 | ⬜ pending |

*Populated fully by planner once plans exist. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install `vitest` + `@vitest/ui` + `@testing-library/react` + `jsdom` as devDependencies
- [ ] Create `vitest.config.ts` with jsdom environment, alias `@/* → src/*`
- [ ] Create `tests/setup.ts` for RTL + jest-dom matchers
- [ ] Add `test` script to `package.json` (`"test": "vitest run"`)
- [ ] Stub test files for: `tests/ssrf.test.ts` (SEC-01), `tests/extract-watch.test.ts` (SEC-01 route), `tests/theme.test.tsx` (VIS-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No FOUC on first paint when system theme is dark | VIS-04 | Flash-of-wrong-theme only reproduces in real browser on hard reload | Set OS to dark mode, hard-reload `/`, confirm no light flash before hydration |
| Every core workflow usable at 375px width | VIS-01 | Visual layout / overlap detection is not grep-verifiable | Chrome devtools → 375px width → walk: `/`, `/watch/[id]`, `/watch/add`, `/preferences`, `/insights` → confirm no horizontal scroll, no overlap, all actions reachable |
| Refined typography/spacing consistent across themes | VIS-02, VIS-03 | Visual refinement is subjective | Side-by-side light/dark comparison of watch card, detail page, insights page |
| Chart renders collection distribution accurately | VIS-06 | Data binding correctness best checked visually against known fixtures | Load insights page with seeded collection, confirm chart reflects counts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

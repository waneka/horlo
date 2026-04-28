---
phase: 18
slug: explore-discovery-surface
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TBD by planner — research suggests Vitest + RTL + jsdom + MSW already on repo |
| **Config file** | TBD (planner verifies during Wave 0) |
| **Quick run command** | TBD (e.g., `npm run test -- --run path/to/file.test.ts`) |
| **Full suite command** | TBD (e.g., `npm run test -- --run`) |
| **Estimated runtime** | TBD |

---

## Sampling Rate

- **After every task commit:** Run quick command (TBD)
- **After every plan wave:** Run full suite (TBD)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** TBD

---

## Per-Task Verification Map

*To be populated by gsd-planner during plan creation. Each `<task>` block must reference a row here.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-XX-XX | XX | X | REQ-XX | — | — | — | — | ⬜ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*To be populated by gsd-planner during plan creation based on RESEARCH.md Validation Architecture.*

---

## Manual-Only Verifications

*To be populated by gsd-planner. Likely candidates:*

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual rhythm + spacing on /explore | DISC-03..08 | UI fidelity not amenable to snapshot tests at component level | Visit /explore with sparse + dense network states; compare against UI-SPEC.md |
| BottomNav slot order on real device | DISC-08 | Safe-area iOS padding + tap-target verification on hardware | Open mobile build on iOS + Android; verify 5 slots in correct order, Wear cradle elevation, no chrome flash |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < TBD
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

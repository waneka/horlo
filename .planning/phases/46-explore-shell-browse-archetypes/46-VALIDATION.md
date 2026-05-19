---
phase: 46
slug: explore-shell-browse-archetypes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TBD — planner fills from RESEARCH.md § Validation Architecture |
| **Config file** | TBD |
| **Quick run command** | TBD |
| **Full suite command** | TBD |
| **Estimated runtime** | TBD |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** TBD

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | EXPL-01..05 | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Planner fills from RESEARCH.md § Validation Architecture.*

---

## Manual-Only Verifications

*Planner fills — visual/UI behaviors that cannot be automated.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

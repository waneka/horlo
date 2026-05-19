---
phase: 47
slug: curated-lists-rail-hero-where-collections-go
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | (planner to confirm from RESEARCH.md — none detected at context time) |
| **Config file** | (planner to confirm — likely "none — Wave 0 installs or build/lint only") |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner fills from PLAN.md task IDs) | — | — | EXPL-06..09 | — | — | build/manual | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Confirm test framework presence; if none and pure-render phase, build + lint are the automated gate.

*Planner: derive concrete Wave 0 items from RESEARCH.md § Validation Architecture.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hero hides entirely when no eligible content | EXPL-08 | Requires DB state with no eligible lists | Unpublish all lists; load `/explore`; Hero absent |
| Where Collections Go renders correctly at 360px | EXPL-09 | Visual responsive behavior | DevTools 360px viewport; verify numbered vertical stack |
| Pin change propagates via revalidateTag | EXPL-08 | Cache invalidation timing | Pin a list in admin; reload `/explore`; Hero updates without TTL wait |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---
phase: 30
slug: wywt-capture-alignment-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-05
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/components/wywt/CameraCaptureView.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~3 seconds (quick) / ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/components/wywt/CameraCaptureView.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner fills) | — | — | WYWT-22 | — | N/A | unit | `npx vitest run tests/components/wywt/CameraCaptureView.test.tsx` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `tests/components/wywt/CameraCaptureView.test.tsx` — D-07 pure-math assertions for `computeObjectCoverSourceRect` (3+ stream-size fixtures)
- [ ] Directory `tests/components/wywt/` — create before the test file

*All other infrastructure (vitest config, JSDOM mocks pattern) already exists in the repo.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WYWT capture preview ↔ saved JPEG alignment on iOS Safari | WYWT-22 (D-08, D-09) | Visual judgment is the acceptance criterion; no pixel-measurement tooling per D-09 | On iPhone Safari: open the app, tap WYWT compose, frame a watch dead-center under the on-screen wrist guide, capture, navigate to `/wear/[id]`. Pass = watch appears centered in the saved photo (not at the bottom edge). Black bar must NOT appear in either preview or saved photo. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

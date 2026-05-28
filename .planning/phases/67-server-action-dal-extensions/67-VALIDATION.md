---
phase: 67
slug: server-action-dal-extensions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 67 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- tests/data tests/actions/watches.test.ts --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Populated by the planner. Each task gets a row mapping it to its automated proof.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 67-XX-XX | XX | N | REQ-XX | — | — | unit | `npm test -- tests/...` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/data/findViewerWatchByCatalogId.test.ts` — stubs for CONF-11 (widened return type covering owned + wishlist + null)
- [ ] `tests/data/searchCatalogForAddFlow.test.ts` — stubs for DUPE-01 / DUPE-03 (anti-N+1 viewerState hydration; exact-reference bubbling)
- [ ] `tests/actions/watches.test.ts` — extension cases for `addWatch` catalogId branch (existing file)

*Existing vitest infrastructure (`vitest.config.ts`, `tests/__mocks__`) covers all phase requirements — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification (pure server logic; no UI / no human judgement).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

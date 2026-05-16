---
phase: 42
slug: nyquist-hardening-sweep-uat-triage-parallel-track
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-15
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 (jsdom unit suite) + Vitest browser mode (chromium, Playwright provider) |
| **Config file** | `vitest.config.ts` + `vitest.workspace.ts` (Wave 0 adds workspace + browser project) |
| **Quick run command** | `npx vitest run --project unit` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30–60 seconds (browser project adds startup overhead) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --project unit`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD — populated by planner | — | — | DEBT-10 / DEBT-11 | — | N/A | unit / browser | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*This map is finalized by the planner once PLAN.md task IDs exist; rows above are placeholders.*

---

## Wave 0 Requirements

- [ ] `@vitest/browser@2.1.9` + `playwright` installed — browser-mode dependency (per RESEARCH.md A1)
- [ ] `vitest.workspace.ts` — two-project workspace (unit/jsdom + browser/chromium) so `npm test` runs both suites
- [ ] Tailwind-served-to-iframe smoke test — confirm computed styles are real before authoring CSS-chain assertions (RESEARCH.md open question A3)

*Wave 0 establishes the browser-test infrastructure DEBT-10 depends on.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CLOSED-candidate UAT items | DEBT-11 | Live-network / sparse-network states and real-user interaction cannot be reliably automated | `42-HUMAN-UAT.md` blocking checklist (D-02) — user runs each item, records CLOSED / FAIL before phase closes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

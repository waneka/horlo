---
phase: 73
slug: owned-redirect-route-fix
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-30
---

# Phase 73 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (per `package.json`); React Testing Library |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run src/components/watch/AddWatchFlow.test.tsx` |
| **Full suite command** | `npm run build` (the milestone gate per `project_baseline_not_green_build_is_gate` — `npm run test` and `tsc --noEmit` carry pre-existing failures unrelated to this phase) |
| **Estimated runtime** | ~5s (single test file) / ~60s (build) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/watch/AddWatchFlow.test.tsx`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Build green + AddWatchFlow.test.tsx green
- **Max feedback latency:** ~60s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 73-01-01 | 01 | 1 | ROUTE-01 | — | Owned-pick (with ref) pushes `/w/${catalogId}` early-return; no `confirming` state entered | unit | `npx vitest run src/components/watch/AddWatchFlow.test.tsx -t "T-70-01"` | ✅ | ⬜ pending |
| 73-01-02 | 01 | 1 | ROUTE-01 | — | Owned-pick (null ref) pushes `/w/${catalogId}` identically (no DupeBanner, no resolver round-trip) | unit | `npx vitest run src/components/watch/AddWatchFlow.test.tsx -t "T-70-02"` | ✅ | ⬜ pending |
| 73-01-03 | 01 | 1 | ROUTE-01 | — | WR-02 Test A deleted (dead-path); WR-02 Test D push assertion updated to `/w/cat-owned`; WR-01 Test B pivoted to structured-submit | unit | `npx vitest run src/components/watch/AddWatchFlow.test.tsx` | ✅ | ⬜ pending |
| 73-01-04 | 01 | 1 | ROUTE-01 | — | `npm run build` exits 0 | gate | `npm run build` | ✅ | ⬜ pending |
| 73-01-05 | 01 | 1 | ROUTE-01 | — | Prod click-through — owned watch from search popup renders detail page (D-06 in-place owned view, no 404) | manual | n/a (prod walk after deploy; bundles with Phase 74 if same session) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No new test files, no new framework install. T-70-01 and T-70-02 already exist in `AddWatchFlow.test.tsx` (`Pick owned` / `Pick owned no-ref` scaffold buttons at lines 106-137).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prod click-through — owned watch from search popup renders detail page | ROUTE-01 (Success Criteria #1) | Local DB lacks meaningful catalog/owned data (test-DB-empty memory). Verifying in-place D-06 owned render requires real prod data. | After deploy: open the add-watch popup, search for any owned watch, click the "In collection" result → confirm `/w/[catalogId]` renders the hero + verdict-hidden-on-owned (per `verdict_hidden_on_owned_watches` memory) + comment thread without a 404. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no MISSING — existing infra)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter (set on plan commit)

**Approval:** pending

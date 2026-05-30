---
phase: 72
slug: search-composition-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 72 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `72-RESEARCH.md` §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom default env) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm run test -- --run src/data/__tests__/catalog-search-tokens.test.ts src/components/watch/SearchEntry.test.tsx` |
| **Full suite command** | `npm run build` (authoritative gate per `project_baseline_not_green_build_is_gate`) |
| **Estimated runtime** | ~30 seconds (quick) / ~90 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run quick command (DAL test + SearchEntry test)
- **After every plan wave:** Run full suite (`npm run build`)
- **Before `/gsd-verify-work`:** `npm run build` must be green
- **Max feedback latency:** ~30 seconds for quick, ~90 seconds for build gate

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner-assigned) | 01 | 1 | SRCH-01 | T-67-02-01 | Drizzle parameterized ILIKE binds; never SQL string-interpolation | unit (DAL) | `npm run test -- --run src/data/__tests__/catalog-search-tokens.test.ts` | ❌ W0 — new file | ⬜ pending |
| (planner-assigned) | 02 | 1 | SRCH-02 | — | N/A (read-only client behavior) | component (RTL+userEvent) | `npm run test -- --run src/components/watch/SearchEntry.test.tsx` | ✅ (extend existing 784-line file) | ⬜ pending |
| (planner-assigned) | 03 | 1 | SRCH-03 | — | N/A (read-only client behavior) | component (RTL+fireEvent) | `npm run test -- --run src/components/watch/SearchEntry.test.tsx` | ✅ (extend existing file) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(Task IDs assigned by gsd-planner in Step 8. Each fix and its test live in the same plan; the unit/component test acts as the per-task automated verify.)*

---

## Wave 0 Requirements

- [ ] `src/data/__tests__/catalog-search-tokens.test.ts` — new file; stubs for SRCH-01 (multi-token AND, single-token regression, order-invariance)
- [ ] `src/components/watch/SearchEntry.test.tsx` — extend with SRCH-02 keyboard nav tests (`{ArrowDown}` highlights, `{Enter}` fires `onPick`, `{Escape}` closes)
- [ ] `src/components/watch/SearchEntry.test.tsx` — extend with SRCH-03 footer-click test (clicking "Not finding it?" mounts `<StructuredEntryPanel>`)

*Framework + shared fixtures already exist (`vitest.config.ts`, `tests/setup.tsx` PointerEvent polyfill, existing `SearchEntry.test.tsx` mocks). No new harness needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prod UAT — combobox arrow-key visual highlight + Enter fire | SRCH-02 | jsdom cannot reliably assert pixel-level visual focus state; user confirms on Vercel deploy per `feedback_mobile_ui_verify_on_prod` | After v8.1 bundle deploy: open `/watch/new`, type `"Brut"`, press `↓` (expect row highlight), `↓` again (next row), `Enter` (expect picker fires), `Esc` (popup closes) |
| Prod UAT — footer click reveals StructuredEntryPanel inline | SRCH-03 | Same — visual + cross-browser confirmation post-deploy | After deploy: type a query, click "Not finding it? Add manually" footer, confirm panel expands inline with brand/model/reference pre-seeded |
| Prod UAT — multi-token search returns expected catalog row | SRCH-01 | Component test mocks DAL; prod validates real catalog data | After deploy: type `"Brut Datejust"` then `"Timex Weekender"`, confirm rows surface |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (new DAL test file; SearchEntry test extensions)
- [ ] No watch-mode flags (all `--run`)
- [ ] Feedback latency < 30s for quick; < 90s for build
- [ ] `nyquist_compliant: true` set in frontmatter (after planner closes Wave 0)

**Approval:** pending

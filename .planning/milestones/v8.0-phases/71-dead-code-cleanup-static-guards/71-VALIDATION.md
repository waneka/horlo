---
phase: 71
slug: dead-code-cleanup-static-guards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 71 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1.9 |
| **Config file** | `vitest.config.ts` (default env: jsdom; fs-walking guards override with `// @vitest-environment node`) |
| **Quick run command** | `npx vitest run tests/static/` |
| **Full suite command** | `npm run build` + `npx vitest run tests/static/ src/components/watch/AddWatchFlow.test.tsx src/components/watch/SearchEntry.test.tsx src/components/watch/StructuredEntryPanel.test.tsx src/components/watch/ConfirmStep.test.tsx src/components/watch/DupeBanner.test.tsx src/components/watch/flowTypes.test.ts` |
| **Estimated runtime** | ~45 seconds (build ~30s + static+add-flow vitest ~15s) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/static/` (Plan 71-01) or targeted vitest on edited file (Plan 71-02)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** `npm run build` exit 0 + static suite green + add-flow suite green
- **Max feedback latency:** ~15s (static-only) / ~45s (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 71-01-01 | 01 | 1 | CLNP-02 | — | New file enforces no VerdictStep/WishlistRationalePanel/PasteSection imports in AddWatchFlow.tsx | static guard | `npx vitest run tests/static/AddWatchFlow.no-verdict-step.test.ts` | ❌ W0 | ⬜ pending |
| 71-01-02 | 01 | 1 | CLNP-03 | — | New file enforces no CollectionFitCard imports across 8-file add-flow tree | static guard | `npx vitest run tests/static/AddWatchFlow.no-collection-fit-card.test.ts` | ❌ W0 | ⬜ pending |
| 71-01-03 | 01 | 1 | CLNP-02, CLNP-03 | — | Both guards run on Vercel prebuild (not just legacy-watch-routes) | build-gate wiring | `npm run prebuild` | ✅ (modify) | ⬜ pending |
| 71-02-01 | 02 | 2 | CLNP-01 | — | VerdictStep.tsx + .test.tsx deleted | build-gate | `npm run build` | ✅ (delete) | ⬜ pending |
| 71-02-02 | 02 | 2 | CLNP-01 | — | WishlistRationalePanel.tsx + .test.tsx deleted | build-gate | `npm run build` | ✅ (delete) | ⬜ pending |
| 71-02-03 | 02 | 2 | CLNP-01 | — | PasteSection.tsx + .test.tsx deleted | build-gate | `npm run build` | ✅ (delete) | ⬜ pending |
| 71-02-04 | 02 | 2 | CLNP-04 | — | RecentlyEvaluatedRail.tsx + .test.tsx deleted | build-gate | `npm run build` | ✅ (delete) | ⬜ pending |
| 71-02-05 | 02 | 2 | CLNP-04 | — | RailEntry + PendingTarget + forward-coord JSDoc removed from flowTypes.ts | build-gate + targeted unit | `npx vitest run src/components/watch/flowTypes.test.ts` | ✅ (modify) | ⬜ pending |
| 71-02-06 | 02 | 2 | CLNP-01, CLNP-04 | — | rail/setRail (10 sites) + RailEntry type import + JSDoc reword swept from AddWatchFlow.tsx | build-gate + targeted unit | `npx vitest run src/components/watch/AddWatchFlow.test.tsx` | ✅ (modify) | ⬜ pending |
| 71-02-07 | 02 | 2 | CLNP-01..04 | — | Full add-flow + static suites green; build exit 0 | full suite | full suite command above | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/static/AddWatchFlow.no-verdict-step.test.ts` — stub for CLNP-02 (created in 71-01-01)
- [ ] `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` — stub for CLNP-03 (created in 71-01-02)
- [ ] `package.json` `prebuild` script extension — wire `vitest run tests/static/` into Vercel build gate (71-01-03)

*Framework infrastructure already exists — vitest + `@vitest-environment node` precedent both established (Phase 20 / Phase 64).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bundled visual UAT push (Phase 70's 12 deferred items) | CLNP-01..04 (push hygiene only — not a Phase 71 success criterion) | Phase 71 has zero user-visible behavior; UAT covers Phase 70's bundled visual debt on the same prod push per `feedback_mobile_ui_verify_on_prod` | Run Phase 70's deferred UAT checklist on prod after Phase 71 ships in the same deploy |

*All Phase 71 functional behaviors have automated verification (build + static guards).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the two new guard files + prebuild wiring)
- [ ] No watch-mode flags (`vitest run`, never `vitest`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills task map

**Approval:** pending

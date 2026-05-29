---
phase: 69
slug: searchentry-structuredentrypanel-cache-hygiene
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 69 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (detected via `vitest.config.ts`) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npm run test -- --run <specific-file>` |
| **Full suite command** | `npm run test -- --run` |
| **Build gate** | `npm run build` exit 0 (per `project_baseline_not_green_build_is_gate`) |
| **Estimated runtime** | ~25–40s full suite |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run <specific-file>` for the file changed
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green AND `npm run build` exit 0
- **Max feedback latency:** ~40s (Vitest in-memory)

---

## Per-Task Verification Map

> Filled in by the planner during PLAN.md generation. Each task gets a row mapping it to the test file(s) that prove the behavior. Wave 0 column tracks whether the test infrastructure already exists or needs to be added before the plan task runs.

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | SRCH-26 / D-12 | parser pure-fn correctness | unit | `npm run test -- --run src/lib/searchEntry/parseSearchQuery.test.ts` | ❌ Wave 0 (created by phase) | ⬜ pending |
| TBD | TBD | 0 | CLNP-07 | useCatalogSearchCache resets on viewerUserId switch | unit | `npm run test -- --run src/components/watch/useCatalogSearchCache.test.ts` | ❌ Wave 0 (created by phase) | ⬜ pending |
| TBD | TBD | 0 | CLNP-07 | useStructuredExtractCache resets on viewerUserId switch | unit | `npm run test -- --run src/components/watch/useStructuredExtractCache.test.ts` | ❌ Wave 0 (created by phase) | ⬜ pending |
| TBD | TBD | 0 | CLNP-07 (retrofit) | useUrlExtractCache resets on viewerUserId switch | unit (extend) | `npm run test -- --run src/components/watch/useUrlExtractCache.test.ts` | ✅ exists (extend) | ⬜ pending |
| TBD | TBD | 0 | CLNP-07 (retrofit) | useWatchSearchVerdictCache resets on viewerUserId switch | unit (extend) | `npm run test -- --run src/components/search/useWatchSearchVerdictCache.test.ts` | ✅ exists (extend) | ⬜ pending |
| TBD | TBD | 1 | SRCH-18, SRCH-20, SRCH-22 | SearchEntry behavior (debounce, ARIA, highlight) | unit (RTL) | `npm run test -- --run src/components/watch/SearchEntry.test.tsx` | ❌ Wave 0 (created by phase) | ⬜ pending |
| TBD | TBD | 1 | EXTR-05, EXTR-06, EXTR-07 | StructuredEntryPanel behavior (find-specs gate, photo, URL link) | unit (RTL) | `npm run test -- --run src/components/watch/StructuredEntryPanel.test.tsx` | ❌ Wave 0 (created by phase) | ⬜ pending |
| TBD | TBD | 1 | Phase 66 D-06 | ExtractErrorCard structured-mode copy branch | unit (extend) | `npm run test -- --run src/components/watch/ExtractErrorCard.test.tsx` | ✅ exists (add describe) | ⬜ pending |
| TBD | TBD | 2 | CLNP-07 (integration) | AddWatchFlow user-switch clears all 4 caches | integration (RTL) | `npm run test -- --run src/components/watch/AddWatchFlow.test.tsx` | ✅ exists (add describe) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/searchEntry/parseSearchQuery.test.ts` — covers D-12 6 test cases (a–f) + ≥1 edge case (empty, whitespace-only, multi-word brand variants)
- [ ] `src/components/watch/useCatalogSearchCache.test.ts` — covers CLNP-07 user-switch reset for the new query cache
- [ ] `src/components/watch/useStructuredExtractCache.test.ts` — covers CLNP-07 user-switch reset for the new structured-tuple cache
- [ ] `src/components/watch/SearchEntry.test.tsx` — behavioral stubs (RTL) — can be authored against the component contract before SearchEntry ships
- [ ] `src/components/watch/StructuredEntryPanel.test.tsx` — behavioral stubs (RTL) covering the "Find specs" gate (EXTR-05), inline photo render (EXTR-06), URL backup link (EXTR-07)

*Existing infrastructure already covers:* extending `useUrlExtractCache.test.ts`, `useWatchSearchVerdictCache.test.ts`, `ExtractErrorCard.test.tsx`, and `AddWatchFlow.test.tsx` with new describe blocks. No framework install required (Vitest + RTL already present).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile/visual UAT of SearchEntry typeahead, no-match expand, StructuredEntryPanel | SRCH-17..26, EXTR-05/06/07 | Components ship **dormant** in Phase 69 — not mounted in any route until Phase 70. Per `feedback_mobile_ui_verify_on_prod`, mobile visual UAT runs on prod and requires the wiring to be live. | Bundle with Phase 70 prod push: `/watch/new`, type "speedmaster", confirm debounce, verify ARIA roles via DevTools, force a no-match query, exercise inline panel, exercise photo uploader, exercise URL backup. |
| Visual regression on `WatchSearchRowsAccordion` after `viewerUserId` retrofit | CLNP-07 | The `/search` page retrofit changes prop signatures only; no visible behavior should change. Verify no console errors and same row rendering. | After deploy, visit `/search`, run a search, verify row layout + viewerState pills unchanged. |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test infrastructure
- [ ] No watch-mode flags
- [ ] Feedback latency < 40s
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills Task IDs

**Approval:** pending (planner finalizes Task ID column during plan generation)

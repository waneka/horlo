---
phase: 19
slug: search-watches-collections
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (TBD — verify or install in Wave 0) |
| **Config file** | TBD — Wave 0 installs/configures if missing |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot` scoped to changed files
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green + browser smoke test (rapid tab switching)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SRCH-09..15 | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner will fill this matrix from PLAN.md task IDs once plans are produced.*

---

## Wave 0 Requirements

Per RESEARCH.md §"Validation Architecture", the following test files must exist before plan tasks can be verified. Wave 0 = the first wave of plan tasks creates/installs these:

- [ ] `vitest.config.ts` — verify present; install vitest + @testing-library/react if missing
- [ ] `tests/data/searchCatalogWatches.test.ts` — unit + integration stubs (SRCH-09, SRCH-10)
- [ ] `tests/data/searchCollections.test.ts` — unit + integration + two-layer privacy stubs (SRCH-11, SRCH-12)
- [ ] `tests/components/HighlightedText.test.tsx` — XSS regression + reuse path (SRCH-15)
- [ ] `tests/components/useSearchState.test.tsx` — per-(tab, q) AbortController gating + stale-result guard (SRCH-14)
- [ ] `tests/actions/search.test.ts` — Server Action Zod schema + auth gate + generic error copy
- [ ] `tests/data/anti-n-plus-one.test.ts` — query log assertion (single inArray batch hydration) (SRCH-10)
- [ ] `tests/integration/all-tab-fanout.test.tsx` — parallel fetch, per-section skeleton, 5-cap, See-all link (SRCH-13)
- [ ] `tests/components/WatchSearchRow.test.tsx` + `tests/components/CollectionSearchRow.test.tsx` — row UX + Evaluate CTA + pill rendering (SRCH-09)
- [ ] `tests/integration/privacy.test.ts` — Collections excludes profile_public=false, collection_public=false, viewer self (SRCH-12)

*Planner refines this list when generating PLAN.md; any task that can't be auto-verified must add a Wave 0 entry.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual rhythm of result rows + highlight emphasis | SRCH-09, SRCH-15 | Subjective — UI-SPEC owns final styling | Open `/search?tab=watches&q=Speed`; confirm thumb + brand/model + pill alignment matches PeopleSearchRow rhythm |
| Evaluate CTA navigation | SRCH-09 | Cross-route — Phase 20 owns target | Click Evaluate on any Watches row → URL becomes `/evaluate?catalogId={uuid}` (404 acceptable until Phase 20) |
| Rapid tab switching never displays prior-tab results | SRCH-14 | Race-condition reproducibility is timing-dependent | Type `Speed` in `?tab=watches`; while results load, switch to `?tab=collections`; confirm no Watches rows appear in Collections panel |
| Empty-state copy per tab | D-15 (Discretion) | Copy is UI-SPEC's call; observable but not asserted in test | Visit each tab with `q=qqqzzznomatches` → confirm tab-specific empty copy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (vitest config + 9 test files above)
- [ ] No watch-mode flags (use `vitest run`, not `vitest`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

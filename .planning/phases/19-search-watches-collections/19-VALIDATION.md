---
phase: 19
slug: search-watches-collections
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-28
audited: 2026-04-28
---

# Phase 19 — Validation Strategy

> Per-phase validation contract — audited post-execution against shipped tests.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Live-DB integration command** | `set -a; source .env.local; set +a; npx vitest run tests/integration/phase19-*.test.ts` |
| **Estimated runtime** | ~2.5s (Phase 19 unit/RTL slice); ~8s (Phase 19 + integration) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot` scoped to changed files
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green + live-DB integration tests pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-T1 | 19-01 | 1 | SRCH-09, SRCH-11 | T-19-01-05 | Type contracts compile cleanly | typecheck | `npx tsc --noEmit` | ✅ | ✅ green |
| 19-01-T2 | 19-01 | 1 | SRCH-09, SRCH-10 | T-19-01-01, T-19-01-07, T-19-01-08, T-19-01-09 | Drizzle binds (no SQL string concat); single `inArray` batch keyed by viewerId; empty-candidates short-circuit | unit | `npx vitest run tests/data/searchCatalogWatches.test.ts` | ✅ | ✅ green (15/15) |
| 19-01-T3 | 19-01 | 1 | SRCH-11, SRCH-12 | T-19-01-02, T-19-01-03, T-19-01-04 | Two-layer privacy AND-locked; viewer self-excluded; raw `sql` template binds | unit | `npx vitest run tests/data/searchCollections.test.ts` | ✅ | ✅ green (13/13) |
| 19-01-T4 | 19-01 | 1 | SRCH-12 | T-19-01-03, T-19-01-04 | Live-DB regression lock — Profile B (collection_public=false) MUST NOT surface | integration (live-DB) | `npx vitest run tests/integration/phase19-collections-privacy.test.ts tests/integration/phase19-trgm-reachability.test.ts` | ✅ | ✅ green (2/2) |
| 19-02-T1 | 19-02 | 2 | SRCH-09, SRCH-11 | T-19-02-01, T-19-02-02, T-19-02-03, T-19-02-04 | `getCurrentUser` auth gate; Zod `.strict().max(200)`; viewerId from session only; generic error copy | unit (parametrized) | `npx vitest run tests/actions/search.test.ts` | ✅ | ✅ green (21/21) |
| 19-02-T2 | 19-02 | 2 | SRCH-09, SRCH-11 | T-19-02-04 | DAL schema details cannot leak to client (regression-locked) | unit | `npx vitest run tests/actions/search.test.ts` | ✅ | ✅ green (covered by 21 above) |
| 19-03-T1 | 19-03 | 3 | SRCH-09, SRCH-15 | T-19-03-01 (XSS) | `<HighlightedText>` reuse; zero `dangerouslySetInnerHTML`; whole-row + raised inline Evaluate Link | RTL | `npx vitest run tests/components/search/WatchSearchRow.test.tsx` | ✅ | ✅ green (11/11) |
| 19-03-T2 | 19-03 | 3 | SRCH-09 | — | Loading skeleton structure | RTL (composer) | covered by `SearchPageClient.test.tsx` skeleton branches | ✅ | ✅ green |
| 19-04-T1 | 19-04 | 3 | SRCH-11, SRCH-15 | T-19-04-01 (XSS) | `<HighlightedText>` reuse; aria-label brand+model on hidden cluster; matched-tag pill cap | RTL | `npx vitest run tests/components/search/CollectionSearchRow.test.tsx` | ✅ | ✅ green (13/13) |
| 19-04-T2 | 19-04 | 3 | SRCH-11 | — | Loading skeleton structure | RTL (composer) | covered by `SearchPageClient.test.tsx` skeleton branches | ✅ | ✅ green |
| 19-05-T1 | 19-05 | 4 | SRCH-09, SRCH-11, SRCH-13, SRCH-14 | T-19-05-01 (race condition) | Three independent sub-effects; per-section `AbortController`; `signal.aborted` guard after every await; All-tab 5-cap as hook invariant | RTL (hook) | `npx vitest run tests/components/search/useSearchState.test.tsx` | ✅ | ✅ green (19/19, Tests 12–19 are Phase 19) |
| 19-06-T1 | 19-06 | 5 | SRCH-13 | — | I-2 BLOCKER fix — three internal `slice(0, 5)` calls; both render AND See-all condition reference capped variable; never `router.push` | RTL | `npx vitest run tests/components/search/AllTabResults.test.tsx` | ✅ | ✅ green (7/7) |
| 19-06-T2 | 19-06 | 5 | SRCH-09, SRCH-11 | — | Zero `<ComingSoonCard>` references; per-tab placeholder/aria; UI-SPEC verbatim copy; `Showing top 20` footer when results.length === 20 | RTL (page integration) | `npx vitest run tests/components/search/SearchPageClient.test.tsx tests/app/search/SearchPageClient.test.tsx` | ✅ | ✅ green (19/19) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Total Phase 19 automated test count:** 118 unit/RTL tests across 9 files + 2 live-DB integration tests = **120 automated assertions**.

---

## Wave 0 Requirements

All test infrastructure files exist and runners pass. (Naming variations: tests under `tests/components/search/` rather than top-level `tests/components/`; live-DB tests under `tests/integration/phase19-*` rather than the original draft names.)

- [x] `vitest.config.ts` — present
- [x] `tests/data/searchCatalogWatches.test.ts` — 15 tests (SRCH-09, SRCH-10) ✅
- [x] `tests/data/searchCollections.test.ts` — 13 tests (SRCH-11, SRCH-12) ✅
- [x] `tests/components/search/WatchSearchRow.test.tsx` — 11 tests (SRCH-09, SRCH-15) ✅
- [x] `tests/components/search/CollectionSearchRow.test.tsx` — 13 tests (SRCH-11, SRCH-15) ✅
- [x] `tests/components/search/useSearchState.test.tsx` — 19 tests (Tests 12–19 are Phase 19; SRCH-13, SRCH-14) ✅
- [x] `tests/components/search/AllTabResults.test.tsx` — 7 tests (SRCH-13 + I-2 regression locks) ✅
- [x] `tests/components/search/SearchPageClient.test.tsx` — 6 page integration tests ✅
- [x] `tests/app/search/SearchPageClient.test.tsx` — 13 carry-forward Phase 16 tests ✅
- [x] `tests/actions/search.test.ts` — 21 contract tests (Server Actions) ✅
- [x] `tests/integration/phase19-collections-privacy.test.ts` — live-DB two-layer privacy regression lock ✅
- [x] `tests/integration/phase19-trgm-reachability.test.ts` — live-DB EXPLAIN ANALYZE on watches_catalog ✅

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual rhythm of result rows + highlight emphasis | SRCH-09, SRCH-15 | Subjective — UI-SPEC owns final styling | Open `/search?tab=watches&q=Speed`; confirm thumb + brand/model + pill alignment matches PeopleSearchRow rhythm |
| Evaluate CTA navigation to Phase 20 target | SRCH-09 | Cross-route — Phase 20 owns target | Click Evaluate on any Watches row → URL becomes `/evaluate?catalogId={uuid}` (404 acceptable until Phase 20) |
| Empty-state copy per tab (visual sanity) | D-15 (Discretion) | Copy is UI-SPEC's call; observable but not asserted in test | Visit each tab with `q=qqqzzznomatches` → confirm tab-specific empty copy verbatim per UI-SPEC |

> Note: rapid tab switching (SRCH-14) is locked by `useSearchState.test.tsx` Tests 16–19 — no longer manual-only. Live-DB privacy (SRCH-12) is locked by `phase19-collections-privacy.test.ts` — no longer manual-only.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are covered transitively (skeletons via composer paths)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (vitest config + 12 test files above all exist)
- [x] No watch-mode flags (`vitest run` everywhere)
- [x] Feedback latency < 30s (~2.5s for Phase 19 unit/RTL slice)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ approved 2026-04-28

---

## Validation Audit 2026-04-28

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated to manual-only | 0 |
| Per-task map entries | 13 |
| Automated unit/RTL tests | 118 |
| Live-DB integration tests | 2 |
| Manual-only items remaining | 3 (visual rhythm, cross-route nav, empty-copy sanity) |

**Outcome:** Phase 19 is Nyquist-compliant. All 7 declared requirements (SRCH-09 through SRCH-15) have automated coverage; the per-task map maps every plan task to a green test command. The draft VALIDATION.md (TBD placeholders + unchecked Wave 0) was reconciled against the shipped test suite — no auditor agent spawn required.

The verification spot-check `npx vitest run tests/data/searchCatalogWatches.test.ts tests/data/searchCollections.test.ts tests/actions/search.test.ts tests/components/search/*.test.tsx tests/app/search/SearchPageClient.test.tsx` returns **9 files / 118 tests passing in 2.48s**.

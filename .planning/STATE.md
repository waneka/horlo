---
gsd_state_version: 1.0
milestone: v4.1
milestone_name: Polish & Patch
status: verifying
stopped_at: Phase 29 Plans 05-06 + Quick Task FORM-04 Gap 3 complete (URL extract cache; phase ready for re-verification)
last_updated: "2026-05-05T12:25:00.000Z"
last_activity: 2026-05-05 -- Quick Task FORM-04 Gap 3 (useUrlExtractCache module-scoped) shipped — closes the user-observable bottleneck where /api/extract-watch re-fired on remount despite verdict cache surviving
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 16
  completed_plans: 16
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03 — v4.0 milestone shipped)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 29 — nav-profile-chrome-cleanup

## Current Position

Phase: 29 (nav-profile-chrome-cleanup) — READY FOR RE-VERIFICATION
Plan: 6 of 6 complete (4 originals + 2 gap-closure plans 29-05, 29-06)
Status: Phase complete with gap closure — ready for re-verification
Last activity: 2026-05-05 -- Quick Task FORM-04 Gap 3 (useUrlExtractCache) shipped on top of Plans 05 + 06 — closes user-observable extract re-fire bottleneck

## Progress Bar

```
v1.0 MVP                          [x] shipped 2026-04-19
v2.0 Taste Network Foundation     [x] shipped 2026-04-22
v3.0 Production Nav & Daily Wear  [x] shipped 2026-04-27
v4.0 Discovery & Polish           [x] shipped 2026-05-03
v4.1 Polish & Patch               [ ] in progress (16/16 plans complete; 100%; Phase 29 ready for re-verification)
v5.0 Discovery North Star         [ ] planted (SEED-004)
v6.0 Market Value                 [ ] planted (SEED-005)

[████████████████████] 4 milestones shipped
```

## v4.1 Phase Map

| Phase | Name | Requirements |
|-------|------|--------------|
| 27 | Watch Card & Collection Render Polish | WISH-01, VIS-07, VIS-08 |
| 28 | Add-Watch Flow & Verdict Copy Polish | FIT-06, ADD-08, UX-09 |
| 29 | Nav & Profile Chrome Cleanup | NAV-16, PROF-10 |
| 30 | WYWT Capture Alignment Fix | WYWT-22 |
| 31 | v4.0 Verification Backfill | DEBT-07, DEBT-08 |

Coverage: 11/11 requirements mapped.

## Accumulated Context

### Carried Forward

The full Key Decisions log lives in `.planning/PROJECT.md` (Key Decisions table). Per-milestone retrospective in `.planning/RETROSPECTIVE.md`. Active todos and tech debt now live in PROJECT.md `## Requirements → ### Active`. Milestone archives in `.planning/milestones/`.

### Blockers

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 2026-05-05-form04-gap3 | useUrlExtractCache — cache /api/extract-watch responses by URL so re-paste skips the round-trip (FORM-04 Gap 3, post-29-05/06 UAT) | 2026-05-05 | 0815c96 | [2026-05-05-form04-gap3-url-extract-cache](./quick/2026-05-05-form04-gap3-url-extract-cache/) |

### Deferred to v5.0+

- ~33 deferred human UAT items across Phases 18 / 20 / 20.1 / 22 / 23
- CAT-13 catalog → similarity engine rewire (anchor for v5.0 — see SEED-004)
- CAT-14 `SET NOT NULL` on `watches.catalog_id` — after 100% backfill verified across two consecutive deploys
- SMTP-06 staging-prod sender split — pending staging Supabase project
- DISC-09/10, SRCH-16/17, FIT-05, SET-13/14, UX-10/11 — see `milestones/v4.0-REQUIREMENTS.md` Future Requirements

### Pulled into v4.1

- Phase 23 + Phase 24 phase-level VERIFICATION.md backfill (DEBT-07, DEBT-08) — close v4.0 verification asymmetry as part of polish/patch
- 5 small features / bug fixes spanning watch card UX, add-watch flow polish, nav chrome cleanup, and WYWT capture math

## Session Continuity

Last session: 2026-05-05T12:25:00.000Z
Stopped at: Phase 29 Plans 05 + 06 + Quick Task FORM-04 Gap 3 complete. Quick Task (commits 03667a5, 8de2382, 726f2ed, 0815c96) added `src/components/watch/useUrlExtractCache.ts` — module-scoped `Map<url, ExtractCacheEntry>` mirroring 29-05's primitive but with no `collectionRevision` keying (URL → scraped data is stable across collection state). `AddWatchFlow.handleExtract` now consults `urlCache.get(trimmedUrl)` BEFORE the fetch; on hit, skips `/api/extract-watch` entirely and reuses cached `{catalogId, extracted, catalogIdError}` for the downstream collectionRevision/verdict-cache branching. On a successful fetch with non-null catalogId, `urlCache.set` caches the entry. Failures (catalogId=null, !res.ok, network throw) intentionally NOT cached so user can retry malformed URLs. Test additions: 4-test hook unit suite + 1-test AddWatchFlow remount regression asserting `fetchSpy === 1` across remount + same-URL re-paste (the strongest assertion in the FORM-04 gap suite — 29-05's cacheRemount test could only assert on the verdict server action because fetch was uncached at the time). 79/79 cross-suite green (watch + UserMenu + ProfileTabs). Closes the user-observable bottleneck behind UAT Test 8 — verdict cache survived remount per 29-05 but extract API call still fired; this closes that gap.

Earlier today: Plan 29-05 (commits e3f691d, 61f0820, a11061f) migrated `useWatchSearchVerdictCache` to module-scoped `Map` + revision counter — public hook API `{revision, get, set}` byte-identical, both consumers (`AddWatchFlow.tsx`, `WatchSearchRowsAccordion.tsx`) zero-diff. Closes UAT Gap 1 (CONTEXT D-15 "cache survives entry"); regression test `tests/components/watch/AddWatchFlow.cacheRemount.test.tsx` proves `mockGetVerdict` called exactly once across remount + same-URL re-paste. `__resetVerdictCacheForTests` helper insulates the 4 D-06 tests against test-order leaks. Plan 29-06 (commits 7b5c98f, 3e7d20a, 881d6fb, dd2e147) added ref-guarded `useLayoutEffect` cleanup in `AddWatchFlow.tsx`: skip when (a) state is fully idle (`url===''`, `rail===[]`, `state.kind==='idle'`) — covers StrictMode mount-cleanup-mount cycle on initial render, OR (b) `state.kind==='form-prefill'` — initialState-derived deep-link prefill (CONTEXT D-16) is NOT user-accumulated state. Real Activity-hide back-nav reset (UAT Test 6) preserved. Test infra: `tests/setup.ts` → `tests/setup.tsx` (git mv), `vitest.config.ts` setupFiles updated, global `vi.mock('@testing-library/react', ...)` injects `<StrictMode>` wrapper so future regressions of this class are caught in CI before manual UAT. Regression test `tests/components/watch/AddWatchFlow.strictModePrefill.test.tsx` (2/2 green) proves form-prefill survives StrictMode. Post-merge cross-plan integration check: 49 failures observed are 100% pre-existing baseline (verified at SHA 0ef4a3c) — zero new failures introduced by either plan. Plan 29-05 (commits e3f691d, 61f0820, a11061f) migrated `useWatchSearchVerdictCache` to module-scoped `Map` + revision counter — public hook API `{revision, get, set}` byte-identical, both consumers (`AddWatchFlow.tsx`, `WatchSearchRowsAccordion.tsx`) zero-diff. Closes UAT Gap 1 (CONTEXT D-15 "cache survives entry"); regression test `tests/components/watch/AddWatchFlow.cacheRemount.test.tsx` proves `mockGetVerdict` called exactly once across remount + same-URL re-paste. `__resetVerdictCacheForTests` helper insulates the 4 D-06 tests against test-order leaks. Plan 29-06 (commits 7b5c98f, 3e7d20a, 881d6fb, dd2e147) added ref-guarded `useLayoutEffect` cleanup in `AddWatchFlow.tsx`: skip when (a) state is fully idle (`url===''`, `rail===[]`, `state.kind==='idle'`) — covers StrictMode mount-cleanup-mount cycle on initial render, OR (b) `state.kind==='form-prefill'` — initialState-derived deep-link prefill (CONTEXT D-16) is NOT user-accumulated state. Real Activity-hide back-nav reset (UAT Test 6) preserved. Test infra: `tests/setup.ts` → `tests/setup.tsx` (git mv), `vitest.config.ts` setupFiles updated, global `vi.mock('@testing-library/react', ...)` injects `<StrictMode>` wrapper so future regressions of this class are caught in CI before manual UAT. Regression test `tests/components/watch/AddWatchFlow.strictModePrefill.test.tsx` (2/2 green) proves form-prefill survives StrictMode. Post-merge cross-plan integration check: 49 failures observed are 100% pre-existing baseline (verified at SHA 0ef4a3c) — zero new failures introduced by either plan. 7/7 targeted gap-closure tests green (4 D-06 + 1 cache remount + 2 strict-mode prefill). 39/39 Phase 29 unit sweep green.
Next action: User to manually re-test UAT Test 8 in browser — paste catalog URL → re-enter `/watch/new` (CTA or back-nav) → re-paste SAME URL → DevTools Network: `/api/extract-watch` should fire ONLY ONCE total. If pass, mark Test 8 result=pass in 29-UAT.md and proceed to Test 10 re-test (deep-link prefill from /search → `/watch/new?catalogId=…&intent=owned` shows prefilled brand/model/reference). All three FORM-04 gaps now closed in code + tests; only browser confirmation remains.

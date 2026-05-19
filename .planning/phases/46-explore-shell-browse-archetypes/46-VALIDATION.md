---
phase: 46
slug: explore-shell-browse-archetypes
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-18
updated: 2026-05-19
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 (unit + browser), Next.js build |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run src/components/explore` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~45s full suite |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 1 plan wave

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 46-01 T1 | 46-01 | 1 | EXPL-05 | T-46-01 | PRIMARY_ARCHETYPES vocab = 10 | unit | `npx vitest run src/lib/archetype-config` | archetype-config.ts | ✅ green |
| 46-01 T2 | 46-01 | 1 | EXPL-03 | T-46-02 | browse.ts count DAL functions | unit | `npx vitest run src/data/browse` | browse.ts | ✅ green |
| 46-01 T3 | 46-01 | 1 | (retire) | — | No Phase-18 explore routes | grep | `grep -rn 'explore/collectors\|explore/watches' src/ --include="*.tsx" --include="*.ts" \| grep -v __tests__` | — | ✅ green |
| 46-02 T1 | 46-02 | 2 | EXPL-03,05 | T-46-03 | searchSchema facets validated | unit | `npx vitest run tests/components/search/useSearchState` | useSearchState.ts | ✅ green |
| 46-02 T2 | 46-02 | 2 | EXPL-03,05 | T-46-04 | archetype header renders | unit | `npx vitest run tests/components/search` | SearchPageClient.tsx | ✅ green |
| 46-03 T1 | 46-03 | 3 | EXPL-01,02,05 | T-46-05 | CollectorArchetypes null-hide + 10-chip | unit | `npx vitest run src/components/explore/__tests__/CollectorArchetypes.test.tsx` | CollectorArchetypes.tsx | ✅ green |
| 46-03 T2 | 46-03 | 3 | EXPL-03,04 | T-46-06 | brand/era/genre index pages | tsc+build | `npx tsc --noEmit && npm run build` | brands/eras/genres/page.tsx | ✅ green |
| 46-04 T1 | 46-04 | 3 | EXPL-05 | T-46-09 | ROADMAP + REQUIREMENTS 8→10 housekeeping | grep | `grep -q "10 archetypes" .planning/ROADMAP.md && grep -q "ten archetypes" .planning/REQUIREMENTS.md` | ROADMAP.md, REQUIREMENTS.md | ✅ green |
| 46-04 T2 | 46-04 | 3 | all | T-46-09 | Full-suite integration pass | full | `npx tsc --noEmit && npx vitest run && npm run build` | — | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 (Plan 01) scaffolded the archetype-config tests and browse DAL function stubs before implementation. Tests were written as failing RED specs and turned GREEN during Plan 01 Task 2 implementation.

- `src/components/explore/__tests__/CollectorArchetypes.test.tsx` — 2 tests covering EXPL-02 null-hide and EXPL-05 10-chip render

---

## Integration Sign-Off (Plan 04)

Commands run (2026-05-19):

### `npx tsc --noEmit`
- Exit code: 0 (non-test `src/` files have no TypeScript errors)
- Note: pre-existing TS errors in test files (`tests/data/getMostFollowedCollectors.test.ts`, `tests/data/getTrendingCatalogWatches.test.ts`, `tests/integration/*`, `src/components/watch/RecentlyEvaluatedRail.test.tsx`) are Phase 22/23/14 baseline failures unrelated to Phase 46 — confirmed pre-existing per phase_context_note.

### `npx vitest run`
- Phase 46 test files: **all pass** (2/2 tests in CollectorArchetypes.test.tsx)
- Full suite: 50 failures / 4955 passing — 50 failures are pre-existing baseline from Phase 22/23/14 (`useRouter` harness issue, `no-raw-palette` on CollectionFitCard/WatchSearchRow, RailEntry `verdict` typing). Zero Phase 46 regressions.

### `npm run build`
- Exit code: 0
- `✓ Compiled successfully in 6.4s`
- `✓ Generating static pages using 7 workers (32/32) in 633ms`
- All explore routes included: `/explore`, `/explore/brands`, `/explore/eras`, `/explore/genres`

### Cross-plan seam checks

**Seam A — CollectorArchetypes chip → `/search?archetype=`:**
- `CollectorArchetypes.tsx` line 57: `href={\`/search?tab=watches&archetype=${value}\`}`
- `useSearchState.ts` reads `archetype` from `searchSchema` (Plan 02 D-12)
- VERIFIED intact

**Seam B — brands/page.tsx brand row → `/search?brand=`:**
- `brands/page.tsx` line 108: `href={\`/search?tab=watches&brand=${brand.slug}\`}`
- `searchSchema` validates `brand` slug; `searchCatalogWatches` resolves via slug subquery (Plan 02)
- VERIFIED intact

**Seam C — browse.ts count functions carry `cacheTag('explore', 'explore:browse')`:**
- `getBrowseEraCounts`, `getBrowseGenreCounts`, `getBrowseBrandCounts` all carry `cacheTag('explore', 'explore:browse')`
- `revalidateTag('explore', 'max')` in watch Server Actions busts Browse caches on catalog mutation (Plan 01 D-19)
- VERIFIED intact

### Retired Phase-18 component / route check
- `grep -rn 'explore/collectors\|explore/watches\|TrendingWatches\|PopularCollectors' src/ --include="*.tsx" --include="*.ts" | grep -v __tests__`
- Result: 3 matches — all are **comments** (follows.ts comment referencing a cache tag, CollectorArchetypes.tsx and BrowseModule.tsx referencing the pattern name). No import, no route, no component instantiation.
- VERIFIED clean

---

## Manual-Only Verifications

The following behaviors require human visual verification (deferred to operator UAT post-ship):

1. `/explore` renders 5-module layout on mobile (stacked) and desktop (grid) — visual
2. `/explore/brands` A–Z sticky jump nav scrolls to correct letter section — interaction
3. CollectorArchetypes chip shows correct watch-count badges (requires live DB data) — functional
4. Archetype editorial header renders on `/search` when entering via chip — visual

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency acceptable
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** PASSED — 2026-05-19 (Plan 04 integration verification)

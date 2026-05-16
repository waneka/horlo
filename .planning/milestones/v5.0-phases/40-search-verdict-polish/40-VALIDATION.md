---
phase: 40
slug: search-verdict-polish
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Each task that delivers verifiable behavior has a row with the chosen test command, requirement, and threat ref. Commands mirror the `<verify><automated>` blocks inside each plan.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 40-01-T1 | 01 | 1 | SRCH-16 | T-40-01 / T-40-02 | RED tests guard DAL movementType reference + Zod `.strict()` mass-assignment | static + unit | `npx vitest run tests/static/search-dal.movement-type.test.ts tests/actions/search.facets.test.ts` | ✅ W0 (file created in this task) | ⬜ pending |
| 40-01-T2 | 01 | 1 | SRCH-16 | T-40-01 / T-40-03 / T-40-05 | DAL composes parameterized facet predicates (no SQL string interp) | static + tsc | `npx vitest run tests/static/search-dal.movement-type.test.ts && npx tsc --noEmit 2>&1 \| grep -c "src/data/catalog.ts" \| grep -E "^0$"` | ✅ | ⬜ pending |
| 40-01-T3 | 01 | 1 | SRCH-16 | T-40-02 / T-40-05 | Zod schema rejects unknown keys + enum mismatches | unit | `npx vitest run tests/actions/search.facets.test.ts tests/actions/search.test.ts` | ✅ | ⬜ pending |
| 40-02-T1 | 02 | 1 | FIT-05 | T-40-06 | Type extension preserves RSC-serializable contract | tsc + grep | `npx tsc --noEmit 2>&1 \| grep -E "verdict/types\\.ts" \| wc -l \| xargs -I {} test {} -eq 0 && grep -c "candidateCatalogTaste" src/lib/verdict/types.ts` | ✅ | ⬜ pending |
| 40-02-T2 | 02 | 1 | FIT-05 | T-40-06 / T-40-08 | Composer threads candidateCatalogTaste with idempotent Number() coercion | static + tsc | `npx vitest run tests/static/composer-engine-alignment.test.ts && npx tsc --noEmit 2>&1 \| grep -E "verdict/(composer\|types)\\.ts" \| wc -l \| xargs -I {} test {} -eq 0` | ✅ | ⬜ pending |
| 40-03-T1 | 03 | 1 | FIT-05 | T-40-09 / T-40-10 | RED unit tests cover 8 D-16 scenarios incl. null + edge cases | unit (RED) | `npx vitest run tests/unit/lib/verdict/fit-delta.test.ts 2>&1 \| grep -c "Cannot find module\\\|fit-delta"` | ✅ W0 (test file created in this task) | ⬜ pending |
| 40-03-T2 | 03 | 1 | FIT-05 | T-40-09 / T-40-10 | computeDeltaPhrase pure helper — no forbidden engine imports | unit (GREEN) + grep | `npx vitest run tests/unit/lib/verdict/fit-delta.test.ts && grep -c "from '@/lib/similarity'\\\|from '@/lib/verdict/composer'" src/lib/verdict/fit-delta.ts \| grep -E "^0$"` | ✅ | ⬜ pending |
| 40-04-T1 | 04 | 2 | SRCH-16 | T-40-11 / T-40-12 | Hook reads facet state from URLSearchParams + writes unconditionally (tab-preserve) | tsc + grep | `npx tsc --noEmit 2>&1 \| grep -E "useSearchState\\.ts" \| wc -l \| xargs -I {} test {} -eq 0 && grep -c "setMovement\\\|setSize\\\|setStyleArr" src/components/search/useSearchState.ts` | ✅ | ⬜ pending |
| 40-04-T2 | 04 | 2 | SRCH-16 | T-40-11 / T-40-13 | Watches sub-effect deps include facets + browse-mode lift + filters pass-through | tsc + grep | `npx tsc --noEmit 2>&1 \| grep -E "useSearchState\\.ts" \| wc -l \| xargs -I {} test {} -eq 0 && grep -c "hasActiveFacet" src/components/search/useSearchState.ts` | ✅ | ⬜ pending |
| 40-05-T1 | 05 | 3 | SRCH-16 | T-40-14 / T-40-17 | Server Component threads cached styleVocab; closed-vocab tags only | static + grep | `npx vitest run tests/static/ && grep -c "getTopStyleTags" src/app/search/page.tsx \| grep -E "^[1-9]"` | ✅ | ⬜ pending |
| 40-05-T2 | 05 | 3 | SRCH-16 | T-40-14 / T-40-16 | Chip components emit values from frozen `as const` arrays; no raw palette | lint (palette) | `npx vitest run tests/no-raw-palette.test.ts` | ✅ | ⬜ pending |
| 40-05-T3 | 05 | 3 | SRCH-16 | T-40-14 | Filter button + sheet mount; browse-mode empty state branch; tsc clean | lint + tsc | `npx vitest run tests/no-raw-palette.test.ts tests/static/ && npx tsc --noEmit 2>&1 \| grep -E "SearchPageClient\\.tsx" \| wc -l \| grep -E "^0$"` | ✅ | ⬜ pending |
| 40-06-T1 | 06 | 2 | FIT-05 | T-40-18 / T-40-20 | Pure-renderer compare table; no forbidden engine imports | static + lint | `npx vitest run tests/no-raw-palette.test.ts tests/static/CollectionFitCard.no-engine.test.ts` | ✅ (reused) | ⬜ pending |
| 40-06-T2 | 06 | 2 | FIT-05 | T-40-19 / T-40-20 | D-15 confidence gate; module-absent-not-empty; pure-renderer invariant preserved | static | `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts` | ✅ (reused) | ⬜ pending |
| 40-07-T1 | 07 | 1 | SRCH-16 | — | Paperwork — REQUIREMENTS.md aligned with ROADMAP SC#1 + D-05 | grep | `grep -c "chip group with 5 pre-defined size bands" .planning/REQUIREMENTS.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> New test files authored as Wave 0 RED scaffolds in this phase:
> - `tests/static/search-dal.movement-type.test.ts` (new — created in 40-01-T1) — source-text assertion enforcing ROADMAP SC#4 (`movementType` pgEnum column reference; bans deprecated free-text `watchesCatalog.movement` column).
> - `tests/actions/search.facets.test.ts` (new — created in 40-01-T1) — Zod schema acceptance/rejection cases for movement / size / style facet fields + `.strict()` mass-assignment guard.
> - `tests/unit/lib/verdict/fit-delta.test.ts` (new — created in 40-03-T1) — pure-helper unit tests covering D-16 5-step algorithm across 8 scenarios incl. null + edge cases.
>
> Existing test files reused without modification (no Wave 0 scaffold needed):
> - `tests/static/CollectionFitCard.no-engine.test.ts` — must remain green; guards pure-renderer invariant on CollectionFitCard.tsx.
> - `tests/static/composer-engine-alignment.test.ts` — extended in 40-02-T2 with a new `candidateCatalogTaste:` source assertion.
> - `tests/no-raw-palette.test.ts` — must remain green; enforces `font-medium` ban across new chip + sheet components.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bottom-sheet open/close on mobile + URL share-link round-trip | SRCH-16 | Visual UX, share-link clipboard | Open `/search`, type `sub`, open Filter sheet, tap Movement=auto + Style=tool, copy URL, open in new tab — facets restored, results match |
| FIT-05 drill-down render on viewer with collection ≥ 1 + confidence ≥ 0.5 on both sides | FIT-05 | End-to-end verdict pipeline with real catalog taste | Sign in as twwaneka@gmail.com, navigate to `/search`, type Sub, expand a verdict row — Compare with the {Brand Model} you own section visible with 6 rows + delta phrase |
| FIT-05 hides cleanly when either side has null/low-confidence catalogTaste | FIT-05 D-15 | Module-absent-not-empty visual check | Find a watch where `catalogTaste IS NULL` in DB, search it — drill-down section does not render; rest of CollectionFitCard renders |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

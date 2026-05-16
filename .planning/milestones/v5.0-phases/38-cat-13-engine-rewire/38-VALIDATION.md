---
phase: 38
slug: cat-13-engine-rewire
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 38-RESEARCH.md §Validation Architecture (Section 11).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (project standard; ESM) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/static/similarity.taste-null.test.ts tests/static/similarity.taste-present.test.ts tests/static/composer-engine-alignment.test.ts -x` |
| **Full suite command** | `npx vitest run` |
| **Plan A quick gate** | `npx tsc --noEmit` (type-check is the AC for Plan A; no runtime tests) |
| **Estimated runtime** | quick ~3s · full ~30s · Plan A tsc ~6s |

---

## Sampling Rate

- **After every Plan A task commit:** Run `npx tsc --noEmit` (must exit 0 or hold the explicit 27-error baseline documented in RESEARCH §Q9; intermediate commits during fixture cascade may diverge but each phase-family commit MUST be clean)
- **After every Plan B task commit:** Run quick command above (taste-null + taste-present tests; alignment test added after Plan B Task 4)
- **After every Plan C task commit:** Run alignment test alone
- **After every plan wave:** Run full suite (`npx vitest run`)
- **Before `/gsd-verify-work`:** Full suite must be green AND `npx tsc --noEmit` must exit 0
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Plan IDs and task numbers are placeholders — planner fills in exact IDs.

| Plan | Wave | Requirement | Behavior | Test Type | Automated Command | File Exists |
|------|------|-------------|----------|-----------|-------------------|-------------|
| A    | 1    | CAT-13 Plan A | `watches.catalogId` Drizzle column flips to `.notNull()`; supabase + drizzle migrations land sequentially | type-check + DB DDL | `npx tsc --noEmit` exits 0 AND latest supabase migration filename matches `20260512000000_phase38_catalog_id_notnull.sql` | ❌ Wave 0 / Plan A creates |
| A    | 1    | CAT-13 Plan A | `createWatch` DAL signature requires non-null `catalogId` | type-check | `npx tsc --noEmit` exits 0; `grep -n "catalogId: string" src/data/watches.ts` returns the createWatch line | ✅ exists (signature edit) |
| A    | 1    | CAT-13 Plan A | All three `createWatch` callsites upsert catalog BEFORE invocation | static grep + tsc | `npx tsc --noEmit` exits 0 AND `grep -B5 "createWatch" src/app/actions/watches.ts src/app/actions/wishlist.ts \| grep -c upsertCatalogFromUserInput` ≥ 2 | ✅ exists |
| A    | 1    | CAT-13 Plan A | All ~17 integration test fixtures construct watches with non-null `catalogId` | vitest + tsc | `npx vitest run tests/integration` exits 0 AND `npx tsc --noEmit` exits 0 | ✅ exists (fixture edits) |
| B    | 2    | CAT-13 #4 | `Watch.catalogTaste: CatalogTasteAttributes \| null` field exists on Watch type | type-check | `grep -n "catalogTaste" src/lib/types.ts` finds the field on Watch | ❌ Plan B Task 0 |
| B    | 2    | CAT-13 #4 | `getWatchesByUser` LEFT JOINs `watches_catalog` and populates `catalogTaste` on every returned row | unit (vitest) | `npx vitest run src/data/__tests__/watches-leftjoin.test.ts` exits 0 (new recommended test) OR DAL-internal assertion in similarity.taste-present | ❌ Plan B Task 1 |
| B    | 2    | CAT-13 #1 | Engine output byte-identical when `catalogTaste` null OR `confidence < 0.5` | static (vitest) | `npx vitest run tests/static/similarity.taste-null.test.ts` exits 0 | ❌ Plan B Task 2 creates |
| B    | 2    | CAT-13 #2 | Engine produces higher score for taste-compatible pair vs taste-incompatible pair when `confidence >= 0.5` | static (vitest) | `npx vitest run tests/static/similarity.taste-present.test.ts` exits 0 | ❌ Plan B Task 3 creates |
| B    | 2    | CAT-13 #3 | Both static guards continue passing AFTER `src/lib/similarity.ts` rewire | static (vitest) | (same two commands above re-run) | re-run after Plan B Task 4 |
| C    | 3    | CAT-13 D-04 | Composer-engine verbal/numeric agreement across 10 scenarios (null, low-conf, high-conf compatible/incompatible, edge cases) | static (vitest) | `npx vitest run tests/static/composer-engine-alignment.test.ts` exits 0 | ❌ Plan C creates |
| C    | 3    | CAT-13 #5 | `tests/static/CollectionFitCard.no-engine.test.ts` continues passing | static (vitest) | `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts` exits 0 | ✅ exists |
| C    | 3    | CAT-13 #5 | `src/lib/extractors/llm.ts` body byte-locked (Phase 19.1 D-07) | git diff guard | `git diff main...HEAD -- src/lib/extractors/llm.ts` outputs no body changes | implicit (no test file) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] No new test framework install needed (vitest exists at project root)
- [ ] `tests/fixtures/catalogTaste.ts` — NEW file with 5 typed `CatalogTasteAttributes` fixtures (Submariner-like, Datejust-like, Speedmaster-like, Tank-like, low-confidence) — drafted in RESEARCH §Q2; planner drops in
- [ ] `tests/static/similarity.taste-null.test.ts` — NEW file (Plan B Task 2)
- [ ] `tests/static/similarity.taste-present.test.ts` — NEW file (Plan B Task 3)
- [ ] `tests/static/composer-engine-alignment.test.ts` — NEW file (Plan C)
- [ ] (Optional but RESEARCH-recommended) `src/data/__tests__/watches-leftjoin.test.ts` — NEW unit test asserting `getWatchesByUser` populates `catalogTaste` correctly across null, low-confidence, and high-confidence catalog rows

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verdicts visibly change for known taste-compatible vs taste-incompatible pairs in real collection | CAT-13 product win | Behavioral; not gated per D-09 (all plans `autonomous: true`) | After Plan C lands on prod, evaluate a known Submariner-vs-Datejust pair vs Submariner-vs-Submariner pair and confirm the verdict tier differs in a direction the user finds intuitive. Plan C alignment test is the proxy for this — see RESEARCH §Validation Architecture. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

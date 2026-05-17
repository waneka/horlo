---
phase: 44
slug: catalog-enrichment
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-17
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run tests/integration/catalog-taste.test.ts tests/integration/backfill-taste.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30–60 seconds (integration tests gated on `DATABASE_URL`) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run tests/integration/catalog-taste.test.ts tests/integration/backfill-taste.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 44-01-01 | 01 | 1 | ENRH-01/02 | T-44-02 | web_search output re-validated by closed TasteSchema | unit | `npm test -- --run tests/integration/backfill-taste.test.ts` | ✅ extend | ⬜ pending |
| 44-01-02 | 01 | 1 | ENRH-01/02 | T-44-04 | enricher never-throws preserved | integration | `npm test -- --run tests/integration/catalog-taste.test.ts tests/integration/catalog-taste-schema.test.ts` + `npx tsc --noEmit` | ✅ existing | ⬜ pending |
| 44-01-03 | 01 | 1 | ENRH-01/02 | T-44-01, T-44-03 | no API-key in logs; SDK maxRetries + pacing | unit | `npm test -- --run tests/integration/backfill-taste.test.ts` + `npx tsc --noEmit` | ✅ extend | ⬜ pending |
| 44-02-01 | 02 | 1 | ENRH-03 | T-44-05 | guard unbypassable in DAL | integration (DB) | `npm test -- --run tests/integration/catalog-taste.test.ts` | ✅ extend | ⬜ pending |
| 44-02-02 | 02 | 1 | ENRH-03 | T-44-06 | parameterized SELECT, no string interp | integration (DB) | `npm test -- --run tests/integration/catalog-taste.test.ts` + `npx tsc --noEmit` | ✅ extend | ⬜ pending |
| 44-03-01 | 03 | 2 | ENRH-05 | T-44-10, T-44-11 | no API-key logged; source-page url only | script dry-run | `npm run db:factual-propose -- --dry-run` | ❌ W0 new | ⬜ pending |
| 44-03-02 | 03 | 2 | ENRH-05 | T-44-08, T-44-09 | per-field validation before SQL emit | unit | `npm test -- --run tests/integration/backfill-taste.test.ts` + `npx tsc --noEmit` | ❌ W0 new | ⬜ pending |
| 44-04-01 | 04 | 3 | ENRH-04/06 | T-44-13 | 14-digit migration filename | unit (source assertion) | `npm test -- --run tests/integration/backfill-taste.test.ts` + `npx tsc --noEmit` | ❌ W0 new | ⬜ pending |
| 44-04-02 | 04 | 3 | ENRH-04/06 | T-44-12, T-44-15 | local-only run; operator-gated prod push | manual (operator playbook) | follow `44-RUN-PLAYBOOK.md`; `npm run db:verify-catalog-coverage` exits 0 | ❌ run artifact | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test blocks are added in-place to existing files (no new test file needed):

- [ ] `tests/integration/backfill-taste.test.ts` — extend with: `extractSourceUrls` unit cases (Plan 01 Task 1), an `INTER_ROW_DELAY_MS` source-assertion (Plan 01 Task 3), a `factual-apply.ts --dry-run` test (Plan 03 Task 2), and `verify-catalog-coverage.ts` source-assertion cases (Plan 04 Task 1).
- [ ] `tests/integration/catalog-taste.test.ts` — extend with three downgrade-guard cases (Plan 02 Task 1): guard blocks text/high-confidence/vision row; guard allows vision/high-confidence/vision re-enrich; guard allows text/low-confidence force.

No standalone Wave 0 plan — each plan that needs a test extends the existing
file as its first task (RED before GREEN where TDD applies).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Factual review-file approval (LLM-proposed values) | ENRH-05 | Human-in-the-loop approval gate by design (D-03) | Operator edits/confirms `catalog-factual-review.jsonl`, then runs `npm run db:factual-apply` |
| Cover-photo source-page review + image grab | ENRH-05 | Human grabs the actual image from the cited source page (D-04) | Operator opens cited `image_source_page_url`, supplies the final image URL/upload |
| Live production enrichment run + prod migration push | ENRH-04 | Run-local-then-sync; operator pushes via `supabase db push --linked` (D-14) | Follow `44-RUN-PLAYBOOK.md`; verified by `db:verify-catalog-coverage` exit 0 against prod |
| Archetype distribution review | ENRH-06 | Soft-warn archetypes need a human read (D-16) | Review the `GROUP BY primary_archetype` output; empties are acceptable (v5.2 expansion scope) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are operator/manual checkpoints with explicit instructions
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (the only manual task is the terminal operator run)
- [x] Wave 0 covers all MISSING references (test files extended in-place)
- [x] No watch-mode flags (`npm test` = `vitest run`; commands use `--run`)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready

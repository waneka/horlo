---
phase: 78
slug: schema-additions-operator-resolve-queue
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-24
---

# Phase 78 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (existing) |
| **Config file** | `vitest.config.ts` (existing) + `tests/static/` directory for prebuild-fs guards |
| **Quick run command** | `npm run test -- 78` (filters to phase-78-named files) |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30s quick / ~120s full |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- 78` (quick filter)
- **After every plan wave:** Run `npm run test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green; `npm run build` must pass; local Supabase introspection must show new columns
- **Max feedback latency:** ~30s quick · ~120s full

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 78-01-01 | 01 | 1 | CANON-03 / CANON-04 | — | additive schema, no data loss | static | `npm run test -- tests/static/phase78-schema-shape.test.ts` | ✅ W0 | ⬜ pending |
| 78-01-02 | 01 | 1 | CANON-03 | — | GIN index exists on `watch_families.aliases` | integration (psql) | `npm run test -- tests/integration/migrations/78-gin-index.test.ts` | ✅ W0 | ⬜ pending |
| 78-01-03 | 01 | 1 | CANON-03 / CANON-04 | — | additive migration runs cleanly on local Supabase | manual | `supabase db push` (local) + `psql -c "\d brands"` + `psql -c "\d watch_families"` introspection | ❌ W0 | ⬜ pending |
| 78-02-01 | 02 | 2 | MIG-01 | — | dry-run reads `watches_catalog`, writes `.md` artifact, mutates no rows | integration | `npm run test -- tests/integration/scripts/v8.4-brand-canonicalization.test.ts` | ✅ W0 | ⬜ pending |
| 78-02-02 | 02 | 2 | MIG-01 / D-78-01 | — | output `.md` artifact has the GFM-table schema from CONTEXT.md | unit (parser test) | `npm run test -- tests/unit/scripts/v8.4-md-artifact-schema.test.ts` | ✅ W0 | ⬜ pending |
| 78-02-03 | 02 | 2 | MIG-01 / D-78-04 | — | exact-only auto-resolve: SEED-021 cases land in `needs-review` | unit (golden) | `npm run test -- tests/unit/scripts/v8.4-seed021-golden.test.ts` | ✅ W0 | ⬜ pending |
| 78-02-04 | 02 | 2 | D-78-07 | — | refuse-to-overwrite when `.md` exists; `--regenerate` merges decisions forward | unit | `npm run test -- tests/unit/scripts/v8.4-regenerate-merge.test.ts` | ✅ W0 | ⬜ pending |
| 78-02-05 | 02 | 2 | D-78-05 | — | dry-run never executes INSERT/UPDATE/DELETE (catalog row count unchanged before/after) | integration | `npm run test -- tests/integration/scripts/v8.4-readonly.test.ts` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/static/phase78-schema-shape.test.ts` — fs-walking guard with `// @vitest-environment node` asserting `aliases` + `needs_review` columns declared in `src/db/schema.ts` (covers `[[vitest-static-node-env]]`)
- [x] `tests/integration/migrations/78-gin-index.test.ts` — psql introspection asserting `pg_indexes` contains a GIN index on `watch_families(aliases)`
- [x] `tests/integration/scripts/v8.4-brand-canonicalization.test.ts` — end-to-end: connect to local Supabase, run dry-run, assert `.md` written + non-empty
- [x] `tests/unit/scripts/v8.4-md-artifact-schema.test.ts` — parse output `.md`, assert GFM table has exact columns and at least N rows for N distinct brand strings
- [x] `tests/unit/scripts/v8.4-seed021-golden.test.ts` — golden test: with a fixture catalog containing the SEED-021 strings, all 4 land in `status: needs-review` not `auto-resolved`
- [x] `tests/unit/scripts/v8.4-regenerate-merge.test.ts` — given an existing `.md` with operator decisions, `--regenerate` preserves non-`needs-review` rows and appends new ones
- [x] `tests/integration/scripts/v8.4-readonly.test.ts` — pre/post catalog COUNT(*) unchanged after running dry-run

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `supabase db push --linked` against prod runs cleanly on first attempt | CANON-03, CANON-04, MIG-05 portability foundation | Local-only verification cannot reproduce extension-schema portability surprises per `[[supabase-extension-schema-function-pin]]`; first prod push IS the gate | After local Supabase verification passes, push to prod: `supabase db push --linked` and confirm exit 0 + introspect prod brands/watch_families via Supabase dashboard SQL editor |
| `.md` artifact ergonomics — operator can scan, search, and edit | D-78-01, D-78-02 | UX assessment — needs human eyes on the rendered output | Open `.planning/v8.4-brand-merge-decisions.md` in editor; confirm table renders correctly in GFM preview; confirm `status` cell values are distinguishable; flip 2-3 rows to `merge:<uuid>` and confirm grammar is intuitive |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s for quick; < 120s for full
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Wave 0 stubs landed via 78-01-PLAN.md

---
phase: 17
slug: catalog-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm test -- --run tests/integration/catalog-*.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 seconds (catalog suite); ~90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick command (catalog integration suite)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Filled by gsd-planner from RESEARCH.md "Validation Architecture" section. One row per task; one column per CAT-NN requirement coverage.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to-be-filled-by-planner_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/catalog-rls.test.ts` — anon SELECT allowed, anon writes denied (CAT-02)
- [ ] `tests/integration/catalog-natural-key.test.ts` — `NULLS NOT DISTINCT` dedup (CAT-01, CAT-03)
- [ ] `tests/integration/catalog-upsert-user-input.test.ts` — typed-input path, `DO NOTHING`, no spec enrichment (CAT-04, CAT-05)
- [ ] `tests/integration/catalog-upsert-url-extracted.test.ts` — URL-extract path, `COALESCE` enrichment, `source` upgrade (CAT-06, CAT-07)
- [ ] `tests/integration/catalog-add-watch-wiring.test.ts` — addWatch Server Action wires `catalog_id` (CAT-08)
- [ ] `tests/integration/catalog-extract-watch-wiring.test.ts` — `/api/extract-watch` wires catalog (CAT-08)
- [ ] `tests/integration/catalog-backfill.test.ts` — first run links rows, second run is no-op (CAT-09)
- [ ] `tests/integration/catalog-refresh-counts.test.ts` — owners_count + wishlist_count refresh, snapshot row written (CAT-10, CAT-11)
- [ ] `tests/integration/catalog-pgcron-secdef.test.ts` — anon/authenticated denied EXECUTE on refresh function (CAT-10)
- [ ] `tests/integration/catalog-snapshot-idempotency.test.ts` — same-day re-run upserts on `(catalog_id, date)` (CAT-11)
- [ ] `tests/integration/catalog-image-provenance.test.ts` — `image_source_url` + `image_source_quality` round-trip (CAT-12)

*Wave 0 owns these test stub files; later waves implement to satisfy them.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pg_cron job exists in production at 03:00 UTC | CAT-10 | Local Postgres has no pg_cron extension | After `supabase db push --linked`, run `SELECT * FROM cron.job WHERE jobname LIKE 'refresh_watches_catalog%'` against the Supabase project; expect 1 row, schedule `'0 3 * * *'` |
| Drizzle introspection of `NULLS NOT DISTINCT` UNIQUE | CAT-01 | Drizzle 0.45.2 emit behavior must be eyeballed | Run `npm run db:generate`; inspect generated migration SQL; if `NULLS NOT DISTINCT` is missing or wrong, drop the natural-key UNIQUE from the Drizzle schema and rely on the Supabase migration only |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

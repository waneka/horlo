---
phase: 11
slug: schema-storage-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm test -- tests/integration/phase11-*.test.ts tests/integration/debt02-rls-audit.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (phase 11 subset); ~90 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/integration/phase11-*.test.ts tests/integration/debt02-rls-audit.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + manual post-migration SQL checks (pg_trgm `EXPLAIN`, `storage.buckets.public=false`, `SELECT visibility, COUNT(*) FROM wear_events`)
- **Max feedback latency:** 30 seconds (phase subset)

---

## Per-Task Verification Map

*Populated by planner during plan authoring. Every task that produces runtime-observable behavior gets an `<automated>` verify command from the table below.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | WYWT-09 | — | `wear_events.visibility` enum exists with correct values; `note` has 200-char CHECK | integration | `npm test -- tests/integration/phase11-schema.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WYWT-11 | G-6 | Backfill produces zero `visibility='followers'` rows | migration-inline | Migration 1 `DO $$ RAISE EXCEPTION` block runs during `supabase db push` | ✅ automatic | ⬜ pending |
| TBD | TBD | TBD | WYWT-13 | F-1 | `wear-photos` bucket exists and is private (`public = false`) | integration | `npm test -- tests/integration/phase11-schema.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | WYWT-14 | F-1, F-4 | Three-tier storage RLS (owner/public/followers/private) + folder enforcement | integration | `npm test -- tests/integration/phase11-storage-rls.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | NOTIF-01 | B-4 | Recipient-only SELECT RLS on `notifications`; no INSERT policy for anon | integration | `npm test -- tests/integration/phase11-notifications-rls.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | NOTIF-01 | B-9 | Self-notification CHECK rejects `actor_id = user_id` | integration | `npm test -- tests/integration/phase11-notifications-rls.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | NOTIF-01 | B-3 | Watch-overlap dedup UNIQUE index; second insert with identical `(user_id, brand, model, day)` is no-op under `ON CONFLICT DO NOTHING` | integration | `npm test -- tests/integration/phase11-notifications-rls.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SRCH-08 | C-1 | `pg_trgm` extension enabled; GIN indexes on `profiles.username` and `profiles.bio`; `EXPLAIN` for `ILIKE` uses index | integration | `npm test -- tests/integration/phase11-pg-trgm.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DEBT-02 | DEBT-02 | Cross-user read/update isolation on `users`/`watches`/`user_preferences` holds; every UPDATE has `WITH CHECK`; every policy uses `(SELECT auth.uid())` | integration + DO$$ | `npm test -- tests/integration/debt02-rls-audit.test.ts` AND Migration 5 `DO $$` block | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/phase11-schema.test.ts` — existence + shape checks for WYWT-09, WYWT-13, SRCH-08 extension/index presence
- [ ] `tests/integration/phase11-storage-rls.test.ts` — three-tier SELECT + folder-enforcement verification for WYWT-14 (mirrors `tests/integration/home-privacy.test.ts` three-user shape)
- [ ] `tests/integration/phase11-notifications-rls.test.ts` — recipient-only RLS + self-notif CHECK + dedup for NOTIF-01
- [ ] `tests/integration/phase11-pg-trgm.test.ts` — `EXPLAIN` assertion that `username ILIKE '%x%'` uses GIN index for SRCH-08 (may be merged into phase11-schema.test.ts)
- [ ] `tests/integration/debt02-rls-audit.test.ts` — cross-user isolation tests for DEBT-02 (matches `tests/data/isolation.test.ts` pattern)
- [ ] Extend `tests/fixtures/users.ts` as needed to seed three users with wear_events at each visibility tier and notifications rows

**Already present (no Wave 0 work needed):**
- Vitest config
- `tests/fixtures/users.ts` `seedTwoUsers()` helper
- Env-gated suite activation pattern (`maybe = hasLocalDb ? describe : describe.skip`)
- `tests/integration/home-privacy.test.ts` as three-user seeding reference

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pg_trgm query plan uses `gin_trgm_ops` index (not seq scan) | SRCH-08 | `EXPLAIN` output parsing in Vitest is brittle; SQL smoke is more reliable as a spot-check | After running all 5 migrations locally: `docker exec -i supabase_db_horlo psql -U postgres -c "EXPLAIN SELECT * FROM profiles WHERE username ILIKE '%al%'"` — confirm output contains `Bitmap Index Scan` on `idx_profiles_username_trgm` |
| Storage bucket `wear-photos` is private in prod | WYWT-13 | Prod Supabase dashboard verification after `supabase db push --linked` | Open Supabase Studio → Storage → `wear-photos` → verify toggle shows "Private" |
| Signed URL for public-visibility wear with 7-day TTL is fetchable by anyone | WYWT-14 (D-02) | Signed URL generation happens in Phase 15 code; Phase 11 only creates the RLS surface — manual cURL is sufficient for gate verification | Deferred to Phase 15. Phase 11 gate uses the integration test in `phase11-storage-rls.test.ts` which exercises the RLS policy directly via `supabase.storage.from('wear-photos').download()`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 new test files + fixture extensions)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s for phase subset, <90s for full suite
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

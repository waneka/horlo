---
phase: 24
slug: notification-stub-cleanup-test-fixture-carryover
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test -- --run <pattern>` (e.g., `npm test -- --run tests/store`) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60-90 seconds (full suite, includes integration tests against local Supabase) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run <changed-test-pattern>` (fast — affected tests only)
- **After every plan wave:** Run `npm test` (full suite green)
- **Before `/gsd-verify-work`:** Full suite must be green AND `npm run db:preflight-notification-cleanup` returns 0 AND grep guards return zero hits AND manual `psql` enum-shape verification post-prod-apply
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | DEBT-03 | T-24-PREFLIGHT | Preflight script returns non-zero when stub rows present (whitelist phrasing) | unit | `npx tsx --env-file=.env.local scripts/preflight-notification-types.ts; echo $?` | ❌ W0 | ⬜ pending |
| {N}-01-02 | 01 | 1 | DEBT-03 | T-24-PREFLIGHT | Preflight `npm` script entry exists and is invocable | unit | `npm run db:preflight-notification-cleanup --silent` | ❌ W0 | ⬜ pending |
| {N}-02-01 | 02 | 2 | DEBT-04 | T-24-MIGRATE | Migration file exists with rename+recreate + in-migration DO $$ assertion (whitelist) | grep | `grep -E "RENAME TO notification_type_old\|type::text NOT IN" supabase/migrations/*phase24*.sql` | ❌ W0 | ⬜ pending |
| {N}-02-02 | 02 | 2 | DEBT-04 | T-24-MIGRATE | Migration applies cleanly against local DB (`supabase db reset` succeeds) | manual | `supabase db reset` then verify exit 0 | ❌ W0 (manual UAT in deploy runbook) | ⬜ pending |
| {N}-02-03 | 02 | 2 | DEBT-04 | T-24-MIGRATE | New `notification_type` enum has only `follow`, `watch_overlap` after migration | integration | `psql "$DATABASE_URL" -c "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = enumtypid WHERE typname = 'notification_type' ORDER BY enumsortorder"` → exact match | ❌ W0 (`tests/integration/phase24-notification-enum-cleanup.test.ts`) | ⬜ pending |
| {N}-02-04 | 02 | 2 | DEBT-04 | T-24-MIGRATE | `notifications.type` column references new enum (not `_old`) | integration | `psql "$DATABASE_URL" -c "SELECT udt_name FROM information_schema.columns WHERE table_name='notifications' AND column_name='type'"` → `'notification_type'` | ❌ W0 (same file as above) | ⬜ pending |
| {N}-03-01 | 03 | 2 | DEBT-04 | T-24-PRODAPPLY | **[BLOCKING] [autonomous: false]** Prod migration applied via `supabase db push --linked` AFTER preflight script returns 0 | manual | User-supervised; verify prod enum shape with `supabase db dump --linked --schema=public` post-apply | ❌ W0 (manual deploy step) | ⬜ pending |
| {N}-04-01 | 04 | 3 | DEBT-05 | T-24-DRIZZLE | Drizzle pgEnum has only 2 values (lands AFTER prod migration applies per success criteria #2) | unit | Vitest: import `notificationTypeEnum`, assert `.enumValues.length === 2` and includes `'follow'`,`'watch_overlap'` | ❌ W0 (test in `tests/db/schema.test.ts` or extend existing) | ⬜ pending |
| {N}-04-02 | 04 | 3 | DEBT-05 | T-24-DEADCODE | No source file outside the migration directory contains `'price_drop'` or `'trending_collector'` | grep | `! grep -rE "price_drop\|trending_collector" src/ tests/ scripts/ seed/ 2>/dev/null` (exit non-zero on any match) | ❌ W0 (CI grep guard) | ⬜ pending |
| {N}-04-03 | 04 | 3 | DEBT-05 | T-24-DEADCODE | `NotificationRow.test.tsx` no longer has `describe('price_drop')` / `describe('trending_collector')` | grep | `! grep -E "describe\(.+(price_drop\|trending_collector)" tests/components/notifications/NotificationRow.test.tsx` | ❌ W0 | ⬜ pending |
| {N}-04-04 | 04 | 3 | DEBT-05 | T-24-DEADCODE | `notifications.ts`, `lib/notifications/types.ts`, and `NotificationRow.tsx` type-check after narrowing | type-check | `npx tsc --noEmit` returns 0 | ✅ infrastructure exists | ⬜ pending |
| {N}-05-01 | 05 | 3 | DEBT-06 | T-24-FIXTURE | All 4 wornPublic test files compile and pass post-rewrite | integration | `npm test -- --run tests/integration/phase12-visibility-matrix.test.ts tests/integration/home-privacy.test.ts tests/data/getFeedForUser.test.ts tests/data/getWearRailForViewer.test.ts` | ✅ files exist; tests need rewriting | ⬜ pending |
| {N}-05-02 | 05 | 3 | DEBT-06 | T-24-FIXTURE | `_wornPublic` parameter removed from helper signature in `getWearRailForViewer.test.ts` | grep | `! grep -n '_wornPublic' tests/data/getWearRailForViewer.test.ts` | ❌ W0 | ⬜ pending |
| {N}-05-03 | 05 | 3 | DEBT-06 | T-24-FIXTURE | No source file under `tests/` references `wornPublic` or `worn_public` (excluding `// removed` history comments) | grep | `! grep -rE "wornPublic\|worn_public" tests/ 2>/dev/null` | ❌ W0 | ⬜ pending |
| {N}-06-01 | 06 | 4 | TEST-04 | — | watchStore filter reducer covers `setFilter` (status/style/role/dial color set+unset+multi) and `resetFilters` (clears all slices) with `beforeEach` reset via `useWatchStore.setState(initial, true)` | unit | `npm test -- --run tests/store/watchStore.test.ts` | ❌ W0 (NEW file) | ⬜ pending |
| {N}-07-01 | 07 | 4 | TEST-05 | T-24-INPUT | `extract-watch` route covers happy path + 4 categorized errors (host-403, structured-data-missing, LLM-timeout, generic-network) + URL validation (non-http(s) protocol rejected) — NO Zod | integration | `npm test -- --run tests/api/extract-watch.test.ts` | ❌ W0 (NEW file; auth gate already covered by `extract-watch-auth.test.ts`) | ⬜ pending |
| {N}-08-01 | 08 | 4 | TEST-06 | — | WatchForm augmentation tests cover form submit happy path + validation per required field + status field transitions | unit | `npm test -- --run tests/components/watch/WatchForm.test.tsx` | ⚠️ EXTEND (Phase 19.1 file `tests/components/WatchForm.test.tsx` may need consolidation) | ⬜ pending |
| {N}-08-02 | 08 | 4 | TEST-06 | — | WatchCard renders status pill, image-fallback, marketPrice display variants | unit | `npm test -- --run tests/components/watch/WatchCard.test.tsx` | ❌ W0 (NEW file) | ⬜ pending |
| {N}-08-03 | 08 | 4 | TEST-06 | — | FilterBar fires correct store actions on each filter slice (status/style/role/dial color) | unit | `npm test -- --run tests/components/filters/FilterBar.test.tsx` | ❌ W0 (NEW file) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Plan numbers (01-08) are illustrative — final plan IDs assigned by gsd-planner. Task ID prefix `{N}` resolves to the actual plan number.*

---

## Wave 0 Requirements

- [ ] `scripts/preflight-notification-types.ts` — covers DEBT-03 (NEW)
- [ ] `package.json` script entry `db:preflight-notification-cleanup` (NEW)
- [ ] `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` — covers DEBT-04 (NEW; both DO $$ blocks — preflight + post-rename verification)
- [ ] `tests/integration/phase24-notification-enum-cleanup.test.ts` — post-migration enum-shape integration test (NEW)
- [ ] `tests/store/watchStore.test.ts` — covers TEST-04 (NEW)
- [ ] `tests/api/extract-watch.test.ts` — covers TEST-05 (NEW; co-located with `extract-watch-auth.test.ts`)
- [ ] `tests/components/watch/WatchCard.test.tsx` — covers TEST-06 WatchCard (NEW)
- [ ] `tests/components/filters/FilterBar.test.tsx` — covers TEST-06 FilterBar (NEW)
- [ ] `tests/components/watch/WatchForm.test.tsx` augmentations OR new file — covers TEST-06 WatchForm (EXTEND `tests/components/WatchForm.test.tsx` OR create `tests/components/watch/WatchForm.test.tsx`)
- [ ] PointerEvent polyfill recommendation — lift from `WatchForm.isChronometer.test.tsx` to `tests/setup.ts` (defensive; planner decides whether in scope)
- [ ] Framework install: NONE — Vitest 2.1.9 + @testing-library/* already in package.json

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| In-migration `DO $$` block aborts when stub rows present | DEBT-03 | Requires seeding stub rows in a non-prod DB to verify abort behavior; cannot run in CI without setup | 1. On a local Supabase: insert a row with `type='price_drop'` (cast around the type system). 2. Run the migration. 3. Verify it aborts with the `RAISE EXCEPTION` message and the count. 4. Delete the seeded row. 5. Re-run. 6. Verify it succeeds. |
| Prod migration apply via `supabase db push --linked` | DEBT-04 | Production credential gate; cannot be autonomous (per project memory `project_drizzle_supabase_db_mismatch.md`) | Documented in `docs/deploy-db-setup.md` backout-plan section. User runs `npm run db:preflight-notification-cleanup` against prod, confirms exit 0, then `supabase db push --linked`. |
| Drizzle pgEnum update commit lands AFTER prod migration applies | DEBT-04 / DEBT-05 | Sequencing constraint cannot be enforced by automation; requires user to confirm prod enum shape via `psql` before merging the Drizzle update PR | After prod migration: `psql "$PROD_URL" -c "SELECT enumlabel FROM pg_enum ..."` → confirm 2 values → then merge the Drizzle pgEnum update commit. |
| Test fixture rewrites preserve privacy semantics (no broadening of `wear_visibility` access) | DEBT-06 | Visibility regression risk — must run privacy tests before AND after fixture migration to confirm identical pass/fail | Before fixture rewrite: `npm test -- --run tests/integration/home-privacy.test.ts tests/integration/phase12-visibility-matrix.test.ts` and capture the green pass set. After rewrite: re-run, confirm identical result set (same tests pass; same tests fail; no broadening). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

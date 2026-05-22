---
phase: 53
slug: schema-rls-enum-extension
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-22
---

# Phase 53 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **This is a pure DDL/migration phase.** The primary validation mechanism is the
> in-migration `DO $$` assertion block — it runs automatically when the migration is
> applied, atomically inside the migration, and rolls back everything if any assertion
> fails. No Jest/Vitest framework is introduced; that is by design for a schema-only phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — DDL phase validates via in-migration `DO $$` assertions + TypeScript compiler on `schema.ts` |
| **Config file** | none — no test framework setup required |
| **Quick run command** | `npx tsc --noEmit` (validates `src/db/schema.ts` edits) |
| **Full suite command** | `supabase db reset` (re-applies all migrations; `DO $$` assertions fire automatically) |
| **Estimated runtime** | ~30–60 seconds for `supabase db reset` |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit` on `schema.ts` edits
- **After migration files written:** `supabase db reset` — clears local, re-applies all migrations including the two new files; every `DO $$` assertion fires automatically
- **Phase gate (before prod):** Both migration files apply cleanly on local with all `DO $$` assertions passing before `supabase db push --linked`
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. Rows below are keyed by requirement; the planner
> maps each to the task that delivers it. The "Automated Command" column is the
> in-migration assertion (fires on `supabase db reset`) unless noted.

| Req ID | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|--------|----------|------------|-----------------|-----------|-------------------|--------|
| SEC-01 | Anon cannot SELECT from `watch_likes`, `wear_likes`, `comments` | anon-read | `NOT has_table_privilege('anon', '<table>', 'SELECT')` for all 3 tables; `REVOKE ALL FROM anon, public` | in-migration assertion | `supabase db reset` | ⬜ pending |
| SEC-04 | If a SECDEF helper is introduced, anon has no EXECUTE | secdef-auto-grant | `has_function_privilege('anon', '<fn>', 'EXECUTE') = false` after `REVOKE EXECUTE FROM PUBLIC, anon` | in-migration assertion | `supabase db reset` | ⬜ pending (N/A unless SECDEF added — research confirms SECDEF unnecessary) |
| SEC-06 | Deleting a watch / wear event cascades to its likes + comments | cascade-gap | FK `confdeltype = 'c'` on every target FK; no app-layer cleanup | in-migration assertion + manual smoke | `supabase db reset`; then `DELETE FROM watches WHERE id=?` → `SELECT count(*) FROM watch_likes WHERE watch_id=?` returns 0 | ⬜ pending |
| LIKE-05 | UNIQUE constraint prevents duplicate likes for same (actor, target) | duplicate-like | `pg_constraint` row for `watch_likes`/`wear_likes` unique pair; duplicate INSERT raises 23505 | in-migration assertion + smoke | `supabase db reset`; duplicate `INSERT ... ` observes constraint violation | ⬜ pending |
| GATE-02 | Likes open to ALL authenticated users on every watch status (no wishlist gate) | asymmetric-gate | Likes SELECT policy has no `watches`/wishlist subquery; gate is comments-only | in-migration assertion | `supabase db reset`; `pg_policies` confirms likes select policy carries no gate subquery | ⬜ pending |
| (D-09) | `notification_type` enum carries 6 values after enum migration | enum-add-value | 4× `ALTER TYPE ... ADD VALUE IF NOT EXISTS` run outside a transaction block | post-migration assertion | apply enum migration file; `SELECT count(*) FROM pg_enum WHERE enumtypid='notification_type'::regtype` returns 6 | ⬜ pending |
| (D-06) | Comments mutual-follow gate present in BOTH SELECT `USING` and INSERT `WITH CHECK` | unidirectional-follow | inline `follows` EXISTS subquery in both clauses; grandfather read gate keys off current watch status | in-migration assertion | `supabase db reset`; `pg_policies` confirms gate subquery in both comments select + insert policies | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No automated integration test framework — the `DO $$` assertion blocks run *inside* the migration, not via Jest/Vitest. This is by design for a pure DDL phase; no framework setup needed.
- [ ] `src/db/schema.ts` TypeScript changes validated with `npx tsc --noEmit` — the compiler is the only existing guard on schema.ts correctness.

*No new test framework will be installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cascade-delete smoke | SEC-06 | FK `confdeltype` assertion proves the constraint exists; a live `DELETE` proves it fires | On local after migration: `DELETE FROM watches WHERE id='<seed>'`; confirm `watch_likes`/`comments` rows for that watch are gone |
| Duplicate-like rejection smoke | LIKE-05 | Constraint existence is asserted in-migration; observing the 23505 error confirms enforcement | Insert a like twice for same (user, watch); second insert raises unique violation |
| Prod enum apply | D-09 | Enum `ADD VALUE` is non-transactional and the prod path (`supabase db push --linked`) differs from local (`drizzle-kit push`) — must be tested locally first, then applied to prod and re-counted | Apply enum migration locally (clean), then `supabase db push --linked`; re-run the enum count assertion against prod |

---

## Validation Sign-Off

- [ ] Every requirement (SEC-01, SEC-04, SEC-06, LIKE-05, GATE-02) has an in-migration `DO $$` assertion or documented manual smoke
- [ ] Sampling continuity: every migration apply runs all assertions atomically
- [ ] Wave 0 covers all MISSING references (none — DDL phase needs no framework)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter (task IDs mapped; DDL phase needs no framework by design)

**Approval:** approved 2026-05-22

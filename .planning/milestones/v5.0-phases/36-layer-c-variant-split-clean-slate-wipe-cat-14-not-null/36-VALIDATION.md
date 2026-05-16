---
phase: 36
slug: layer-c-variant-split-clean-slate-wipe-cat-14-not-null
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 36 is **schema-only** — no business logic, no UI, no new DAL code.
> Validation focuses on: SQL DDL shape, RLS, GRANT discipline, DO $$ pre-flight position, parity (DAL untouched), and prod-state assertions post-deploy.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (via `package.json` `"test": "vitest run"`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/integration/phase36-rls.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 s (phase36 file) / ~25 s (full suite) — against local Docker `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/integration/phase36-rls.test.ts`
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green AND prod-state psql assertions (§ Manual-Only Verifications) must pass
- **Max feedback latency:** ~5 seconds per task

---

## Per-Task Verification Map

> Task IDs populated by gsd-planner. Until plans are written, this table tracks each
> ROADMAP success criterion → automated command pair. Planner MUST map each row to
> a Task ID and reference this VALIDATION.md in the corresponding plan's `<validation>` block.

| # | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| V-01 | TBD | 0 | CAT-17 | T-36-03 | FK ON DELETE RESTRICT blocks catalog row delete when variants exist | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "ON DELETE RESTRICT"` | ❌ Wave 0 | ⬜ pending |
| V-02 | TBD | 0 | CAT-17 | — | `watch_variants` table exists with correct column shape (id, catalog_id, name, slug, dial_color, bezel, bracelet_variant, image_url, created_at, updated_at) | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "table exists"` | ❌ Wave 0 | ⬜ pending |
| V-03 | TBD | 0 | CAT-17 | — | `watch_variants.catalog_id` is NOT NULL | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "catalog_id NOT NULL"` | ❌ Wave 0 | ⬜ pending |
| V-04 | TBD | 0 | CAT-17 | — | UNIQUE `(catalog_id, slug)` enforced on `watch_variants` | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "catalog_slug UNIQUE"` | ❌ Wave 0 | ⬜ pending |
| V-05 | TBD | 0 | CAT-17 | T-36-02 | RLS enabled; anon can SELECT from `watch_variants` | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "anon SELECT"` | ❌ Wave 0 | ⬜ pending |
| V-06 | TBD | 0 | CAT-17 | T-36-01 | Anon INSERT into `watch_variants` blocked by RLS | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "anon INSERT"` | ❌ Wave 0 | ⬜ pending |
| V-07 | TBD | 0 | CAT-17 | — | `watches.variant_id` column exists, nullable, FK to `watch_variants(id)` ON DELETE SET NULL | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "variant_id"` | ❌ Wave 0 | ⬜ pending |
| V-08 | TBD | 0 | CAT-14 | T-36-04 | `watches.catalog_id` `is_nullable = 'NO'` post-migration | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "catalog_id is NOT NULL"` | ❌ Wave 0 | ⬜ pending |
| V-09 | TBD | 0 | CAT-14 | — | INSERT into `watches` with NULL `catalog_id` raises constraint violation | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "INSERT NULL catalog_id"` | ❌ Wave 0 | ⬜ pending |
| V-10 | TBD | 0 | CAT-14 | — | DO $$ pre-flight is the FIRST statement in the Phase 36 supabase migration (ROADMAP success #3 verbatim) | static (file grep) | `awk '/^[^-]/{print NR": "$0; if(++c==1)exit}' supabase/migrations/2026*_phase36_*.sql \| head -1 \| grep -q '^[0-9]\+: DO \$\$'` | ❌ Wave 0 | ⬜ pending |
| V-11 | TBD | 0 | CAT-17 | — | `watches.catalog_id` ON DELETE SET NULL preserved (NOT changed to RESTRICT/CASCADE by Phase 36) | integration (DB) | `npx vitest run tests/integration/phase36-rls.test.ts -t "catalog_id ON DELETE SET NULL"` | ❌ Wave 0 | ⬜ pending |
| V-12 | — | — | CAT-17, CAT-14 | — | Parity gate: no existing DAL/component/lib code references `variant_id` / `variantId` outside the new schema definition (proves nullable additive column does not affect any read path) | static (grep) | `[ $(grep -rln 'variant_id\|variantId' src/data src/app src/lib src/components \| wc -l) -eq 0 ]` | ✅ proven now | ✅ green |
| V-13 | TBD | 0 | CAT-17 | — | Drizzle definition for `watchVariants` exports `pgTable` with columns matching SQL DDL byte-for-byte (catalog_id NOT NULL, name NOT NULL, slug NOT NULL, others nullable) | static (TS compile + grep) | `npx tsc --noEmit && grep -A 15 "export const watchVariants" src/db/schema.ts \| grep -q "catalogId.*notNull"` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/phase36-rls.test.ts` — covers V-01 through V-11 above (mirrors `tests/integration/phase34-rls.test.ts` structure verbatim — 11–13 `it()` blocks under `describe("phase 36 — RLS + schema + CAT-14")`). Uses `@supabase/supabase-js` anon client + `postgres-js` service-role client; expects `DATABASE_URL` pointed at local Docker (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`).
- [ ] `src/db/schema.ts` — add `export const watchVariants = pgTable(...)` definition; add `variantId` nullable FK column to `watches`. Drives V-13.
- [ ] `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` — single migration; DO $$ pre-flight FIRST statement, then CREATE TABLE + RLS + GRANT + ALTER TABLE ADD COLUMN + ALTER TABLE SET NOT NULL, all in one transaction. Drives V-01..V-11.
- [ ] `drizzle/0009_phase36_layer_c_variants.sql` + journal entry `idx=9` — structural twin (no RLS, no DO $$, no GRANT). Required for drizzle-kit migrate parity in local + prod.
- [ ] Framework install: NOT needed — vitest, @supabase/supabase-js, drizzle-orm already in `devDependencies` / `dependencies` (verified at research time).

*No new framework infrastructure required — existing `tests/integration/phase34-rls.test.ts` is the template.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `pg_depend` pre-check against PROD returns exactly one row (`watches_catalog_id_idx`) | CAT-14 + memory rule 4/4a | Requires prod DB credentials; runs BEFORE the migration is even written. Surfaces any forgotten view/materialized view/generated column dependents | `psql "<prod pooler URL>" -f scripts/phase36-pg-depend.sql` — must return one row only; any extra row stops the deploy |
| `SELECT has_table_privilege('anon', 'public.watch_variants', 'SELECT')` on PROD returns `t` | CAT-17 + memory `project_supabase_secdef_grants.md` | Requires prod psql access; verifies GRANT SELECT discipline in prod (memory rule: `REVOKE FROM PUBLIC` alone does NOT block anon — explicit GRANT needed) | After `supabase db push --linked`: `psql "<prod>" -c "SELECT has_table_privilege('anon', 'public.watch_variants', 'SELECT');"` → expect `t` |
| `SELECT is_nullable FROM information_schema.columns WHERE table_name='watches' AND column_name='catalog_id'` on PROD returns `NO` | CAT-14 | Requires prod psql access; verifies the SET NOT NULL applied | `psql "<prod>" -c "SELECT is_nullable FROM information_schema.columns WHERE table_name='watches' AND column_name='catalog_id';"` → expect `NO` |
| `SELECT COUNT(*) FROM watches` on PROD unchanged from pre-migration baseline | ROADMAP success #5 | Parity guard — requires capturing pre-migration count then comparing | Pre: capture `SELECT COUNT(*)` baseline. Post: re-run; values match |
| `SELECT COUNT(*) FROM watch_variants` on PROD returns 0 | D-06 | Phase 36 ships empty — variant population is Phase 39 | `psql "<prod>" -c "SELECT COUNT(*) FROM watch_variants;"` → expect `0` |
| `SELECT COUNT(*) FROM watches WHERE variant_id IS NOT NULL` on PROD returns 0 | D-04 + D-06 | No code path writes variant_id in Phase 36 | `psql "<prod>" -c "SELECT COUNT(*) FROM watches WHERE variant_id IS NOT NULL;"` → expect `0` |
| `SELECT count(*) FROM auth.users` on PROD returns 1 (single-user assumption) | Memory `project_db_wipeable_2026_05_09.md` | Memory rule — re-verify single-user before any deploy assumes wipeability or single-user-only behavior | `psql "<prod>" -c "SELECT count(*) FROM auth.users;"` → expect `1`; STOP and re-evaluate if `>1` |
| Collection-browsing / profile / verdict flows return correct watch data post-migration | ROADMAP success #5 | Best validated by visiting `/collection`, `/profile`, and an individual watch page in a browser after prod deploy | Smoke walk: `/collection` loads with all watches; click a watch → CollectionFitCard renders verdict; `/profile` loads with same counts as pre-deploy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner enforces — V-01..V-13 above map to specific commands)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (planner enforces wave ordering — Wave 0 lays test infra first)
- [ ] Wave 0 covers all MISSING references (`tests/integration/phase36-rls.test.ts` is the single new test file; schema edit is one file; migration is two files)
- [ ] No watch-mode flags (planner enforces — all commands use `vitest run`, not `vitest watch`)
- [ ] Feedback latency < 5 s (phase36 file alone runs in ~5 s against local Docker)
- [ ] Manual-Only Verifications block run BEFORE marking phase complete (memory rule + ROADMAP success #5)
- [ ] `nyquist_compliant: true` set in frontmatter after all V-01..V-13 are ✅ green AND Manual-Only block run

**Approval:** pending

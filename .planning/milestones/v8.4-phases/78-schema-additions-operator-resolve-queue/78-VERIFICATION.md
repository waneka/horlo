---
phase: 78-schema-additions-operator-resolve-queue
verified: 2026-06-24T22:15:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
critical_blockers: []
roadmap_success_criteria_verified: 4/4
requirements_verified: 3/3
phase_boundary_respected: true
tests_passing: 35/35
build_passes: true
local_db_introspection: 5/5
prod_db_introspection: 5/5
deviations_acknowledged:
  - rule: 4-architectural
    deviation: "Plan 02 inline-pushed migration to PROD via unflagged `supabase db push` (defaulted to linked project); Plan 04 collapsed from active push to verification-only"
    evaluation: "Non-destructive (additive ADD COLUMN + CREATE INDEX with IF NOT EXISTS guards); operator confirmed 5/5 prod queries on 2026-06-24 (78-POST-DEPLOY.md); idempotent on re-apply"
  - rule: 1-bug
    deviation: "Script uses unqualified `word_similarity` with `SET search_path = public, extensions` instead of literal `extensions.word_similarity` SQL prefix"
    evaluation: "Correct fix for R-FIND-02 incompleteness (local Supabase has pg_trgm in public; prod has it in extensions). Literal `extensions.word_similarity` preserved in header docstring (line 44) for traceability + R-FIND-02 grep contract. Behavioral intent (schema-portable fuzzy lookup) satisfied in both envs."
  - rule: 1-bug
    deviation: "Stage 1 SQL uses plain `SELECT DISTINCT` not `DISTINCT ON (brand_normalized)` as plan literal specified"
    evaluation: "Plan literal contradicted B-78-01 case-collapse smoke (Omega + OMEGA must BOTH surface). Plain DISTINCT correctly emits both case-variants. Acceptance criteria honored over plan literal."
---

# Phase 78: Schema Additions + Operator-Resolve Queue — Verification Report

**Phase Goal (from ROADMAP.md):** The schema can carry alias data and a needs-review flag, and a dry-run script proposes brand+family mappings for operator approval — no data UPDATE runs yet.

**Verified:** 2026-06-24T22:15:00Z
**Status:** PASSED
**Score:** 7/7 must-haves verified
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Must-Haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CANON-03 — `watch_families.aliases text[] NOT NULL DEFAULT '{}'` column exists on local + prod with GIN containment index | VERIFIED | Schema.ts L554 ✓; migration L51-52 ✓; local `\d watch_families` shows column with default `'{}'::text[]` ✓; prod 78-POST-DEPLOY.md §2 ✓; `watch_families_aliases_gin_idx` exists in `pg_indexes` (local: 78-02-SUMMARY Check 3; prod: 78-POST-DEPLOY §3); D-78-08 honored (aliases EMPTY on every row — local `aliases IS DISTINCT FROM '{}' = 0`; prod `aliases <> '{}' = 0`) |
| 2 | CANON-04 — `brands.needs_review boolean NOT NULL DEFAULT false` AND `watch_families.needs_review boolean NOT NULL DEFAULT false` columns exist on local + prod | VERIFIED | Schema.ts L530 (brands) ✓ + L556 (watch_families) ✓; migration L41-46 ✓; local introspection both columns boolean NOT NULL default false (78-02-SUMMARY Checks 1+2); prod 78-POST-DEPLOY §1+§2 confirms both columns with correct shape; backfill all existing rows = false on both envs (local `needs_review IS NOT FALSE = 0`; prod 78-POST-DEPLOY §4) |
| 3 | MIG-01 — Dry-run script `scripts/v8.4-brand-canonicalization.ts` writes `.planning/v8.4-brand-merge-decisions.md` with auto-resolved + needs-review markers, no DB writes | VERIFIED | Script exists (345 lines) ✓; `npm run db:v8.4-brand-canon` entry in package.json ✓; artifact committed at `cf67b566` (53 rows: 19 auto-resolved + 34 needs-review) ✓; D-78-05 read-only invariant verified by `tests/integration/scripts/v8.4-readonly.test.ts` (5 tests pass; brands count + max(updated_at) byte-identical pre/post); grep for INSERT/UPDATE/DELETE returns 0 hits |
| 4 | MIG-05 portability foundation — migration runs cleanly on prod | VERIFIED | First prod push 2026-06-24 succeeded (`supabase migration list --linked` shows row `20260624000000`); DO $$ post-flight assertion ran cleanly (no RAISE EXCEPTION fired); filename `20260624000000_*.sql` sorts after `20260623200000_*.sql` per [[drizzle-supabase-db-mismatch]] gotcha #1; no extensions.* in migration body per R-FIND-01 (additive ADD COLUMN + CREATE INDEX with default `array_ops` opclass) |
| 5 | D-78-01 GFM table format with exact 5-column header | VERIFIED | Artifact header at L9 is exactly `\| brand_raw \| normalized \| proposed_target_id \| status \| candidates / notes \|`; tests/unit/scripts/v8.4-md-artifact-schema.test.ts (5 tests pass) verifies header literal + separator + 6-pipe cell count + status grammar invariant |
| 6 | D-78-02 status grammar (auto-resolved \| needs-review emitted by script; merge:<uuid>/new/skip operator-edited) + D-78-04 exact-only auto-resolve + B-78-01 Omega/OMEGA case-collapse | VERIFIED | Artifact shows only `auto-resolved` and `needs-review` emitted (script never writes operator-edit verbs); `Hamilton Watch` → needs-review (no canonical brands row); `Omega` + `OMEGA` BOTH auto-resolved sharing `proposed_target_id=cf2bc26e-6ca8-4a5d-af2f-90405185a324` (B-78-01 case-collapse verified); `Héron Watches` → auto-resolved (canonical row already exists locally with name `Héron Watches`); D-78-03 top-3 fuzzy candidates ≥0.5 visible (`hamilton (0.60)` for Hamilton Watch); tests/unit/scripts/v8.4-seed021-golden.test.ts (7 tests pass) including the explicit B-78-01 case-collapse assertion |
| 7 | D-78-07 refuse-to-overwrite + --regenerate merge-forward; D-78-05 read-only; D-78-06 service-role DATABASE_URL; D-78-08 aliases EMPTY | VERIFIED | tests/integration/scripts/v8.4-brand-canonicalization.test.ts (3 tests pass): first --force exits 0 + writes artifact, second-without-flags exits non-zero + stderr mentions both `--regenerate` and `--force`, third with `--regenerate` exits 0; tests/unit/scripts/v8.4-regenerate-merge.test.ts (7 tests pass): merge:/new/skip preserved verbatim, needs-review overwritten, new rows appended; script uses `postgres({ max: 1, prepare: false })` via `process.env.DATABASE_URL` (D-78-06); aliases ship EMPTY (D-78-08 verified by local `aliases IS DISTINCT FROM '{}' = 0` + prod 78-POST-DEPLOY §4 `families_aliases_bad = 0`) |

**Score:** 7/7 truths verified.

---

## Required Artifacts (Level 1-4 Verification)

| Artifact | Expected | Exists | Substantive | Wired | Data Flows | Status |
|----------|----------|--------|-------------|-------|------------|--------|
| `src/db/schema.ts` (brands + watchFamilies columns) | 3 column additions (2× needsReview, 1× aliases) | ✓ | ✓ (L530, L554, L556 with CANON comments) | ✓ (mirrors live DB; build passes) | ✓ (columns hold real data via DB) | VERIFIED |
| `supabase/migrations/20260624000000_phase78_aliases_needs_review.sql` | Additive ADD COLUMN + CREATE INDEX with DO $$ post-flight | ✓ | ✓ (121 lines; 3 ADD COLUMN + 1 CREATE INDEX + DO $$ assertion via information_schema/pg_indexes per [[post-flight-assertion-predicate-divergence]]) | ✓ (applied on local + prod; DO $$ ran cleanly) | N/A (DDL) | VERIFIED |
| `drizzle/0014_phase78_aliases_needs_review.sql` | Local shape mirror, 3 ALTER TABLE | ✓ | ✓ (17 lines, header marks as LOCAL ONLY) | ✓ (shape sync only; authoritative file is supabase migration) | N/A (DDL) | VERIFIED |
| `scripts/v8.4-brand-canonicalization.ts` | 4-stage dry-run, refuse-overwrite, --regenerate | ✓ | ✓ (345 lines; 6 exported pure functions; comprehensive header) | ✓ (runs via `npm run db:v8.4-brand-canon`; integration tests pass) | ✓ (queries real DB, emits real artifact) | VERIFIED |
| `package.json` (db:v8.4-brand-canon entry) | npm script entry | ✓ | ✓ (1 hit) | ✓ (entry runs script via tsx + --env-file) | N/A (config) | VERIFIED |
| `.planning/v8.4-brand-merge-decisions.md` | Committed GFM artifact, 53 rows | ✓ | ✓ (64 lines, exact D-78-01 header, 53 data rows, B-78-01 case-collapse visible) | ✓ (consumed by Phase 79 --apply per contract) | ✓ (real catalog data, not stubs) | VERIFIED |
| 7 test files (Phase 78 vitest suite) | Wave 0 stubs greened with real assertions | ✓ | ✓ (35 tests across 7 files) | ✓ (all run as part of suite) | ✓ (introspection queries real DB; unit tests use real exported functions) | VERIFIED |
| `.planning/phases/78-*/78-POST-DEPLOY.md` | Operator verification record | ✓ | ✓ (112 lines, 5 verification queries with raw prod results) | N/A (documentation) | N/A | VERIFIED |

**All 8 artifact groups: VERIFIED.**

---

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|----|--------|----------|
| `supabase/migrations/20260624000000_*.sql` | local Postgres (127.0.0.1:54322) | `supabase db push` / direct psql | WIRED | Plan 02 applied; 6/6 introspection checks pass; verified by introspection query returning 5 |
| `supabase/migrations/20260624000000_*.sql` | prod Supabase | `supabase db push` (defaulted to --linked via Plan 02 Deviation §1) | WIRED | `supabase migration list --linked` confirms row `20260624000000`; 78-POST-DEPLOY 5/5 prod queries verified |
| `src/db/schema.ts` columns | live DB shape | Drizzle pgTable definitions mirror SQL | WIRED | Build passes; static schema-shape test (3 assertions) confirms grep-level match; integration test (5 assertions) confirms shape parity with live DB |
| `scripts/v8.4-brand-canonicalization.ts` | local + prod Postgres | `postgres({ max: 1, prepare: false })` + DATABASE_URL | WIRED | Script connects, executes 4 stages, returns 53 rows from real catalog; integration test confirms behavior on local |
| Script SQL `word_similarity` calls | pg_trgm function | `SET search_path = public, extensions` on connection bootstrap | WIRED | Script line 258; SUMMARY documents the local/prod schema divergence fix; functional candidates emitted (`hamilton (0.60)` for Hamilton Watch row) prove the call resolves |
| GFM artifact format | Phase 79 --apply parser (downstream contract) | D-78-01 columns + D-78-02 status grammar | WIRED (forward contract) | Artifact header exact match; only valid status verbs emitted by script; Phase 79 not yet built but contract documented in artifact header notice |
| package.json npm script | tsx invocation | `tsx --env-file=.env.local scripts/v8.4-brand-canonicalization.ts` | WIRED | grep -c returns 1; JSON parses cleanly; `npm run db:v8.4-brand-canon` produces expected behavior |

**All key links VERIFIED.**

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full Phase 78 vitest suite passes | `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npx vitest run tests/static/phase78-schema-shape.test.ts tests/integration/migrations/78-gin-index.test.ts tests/integration/scripts/v8.4-* tests/unit/scripts/v8.4-*` | Test Files 7 passed (7) / Tests 35 passed (35) / Duration 2.80s | PASS |
| Build gate (next build) | `npm run build` | Compiled successfully (exit 0; routing tree printed) | PASS |
| Local DB introspection (consolidated) | `psql -tAc "SELECT col_count + idx_count + constraint_count..."` | Returns `5` = 1 brands.needs_review + 2 watch_families (aliases, needs_review) + 1 GIN index + 1 watches_catalog_natural_key UNIQUE | PASS |
| Local backfill defaults | `psql "SELECT count(*) ... WHERE needs_review IS NOT FALSE; ... WHERE aliases IS DISTINCT FROM '{}'"` | All three counts = 0 (brands.needs_review backfill, watch_families.needs_review backfill, watch_families.aliases EMPTY per D-78-08) | PASS |
| Artifact contains B-78-01 case-collapse | `grep -E "(Omega\|OMEGA)" .planning/v8.4-brand-merge-decisions.md` | Both rows emitted, BOTH auto-resolved, BOTH share `proposed_target_id=cf2bc26e-6ca8-4a5d-af2f-90405185a324` | PASS |
| Script grep guard for DB-write SQL | `grep -ciE "(^\|[^a-z])(INSERT\|UPDATE\|DELETE)[[:space:]]" scripts/v8.4-brand-canonicalization.ts` | 0 (zero write paths; only the documented `--apply` reference is in a forward-looking artifact header text) | PASS |

---

## Probe Execution

No `scripts/*/tests/probe-*.sh` shell-probe paths exist in this phase. Phase 78 uses vitest as its automated-verify mechanism (per 78-VALIDATION.md). The vitest suite serves the probe role and is recorded in Behavioral Spot-Checks above. SKIPPED — no conventional shell probes; vitest is the documented verifier.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CANON-03 | 78-01, 78-02, 78-04 | `watch_families.aliases text[]` + GIN index | SATISFIED | Truth #1; live on local + prod; GIN index `watch_families_aliases_gin_idx` confirmed in `pg_indexes` |
| CANON-04 | 78-01, 78-02, 78-04 | `needs_review boolean` on brands + watch_families | SATISFIED | Truth #2; both columns live on local + prod with defaults; backfill clean (0 bad rows on both envs) |
| MIG-01 | 78-01, 78-03 | Dry-run script writes operator queue without DB writes | SATISFIED | Truth #3; script + npm entry + first artifact committed; D-78-05 read-only invariant verified by 5 passing tests |

**3/3 requirements SATISFIED. No ORPHANED requirements** — REQUIREMENTS.md ROADMAP maps Phase 78 → CANON-03, CANON-04, MIG-01 (lines 116-118 all marked Complete); these match the PLAN frontmatter declarations exactly.

---

## CONTEXT.md Decision Compliance (D-78-01 through D-78-08)

| Decision | Status | Evidence |
|----------|--------|----------|
| D-78-01 GFM table is on-disk format with 5 columns | VERIFIED | Artifact header literal match (line 9); 5-cell row count enforced by unit test |
| D-78-02 status grammar `auto-resolved \| merge:<uuid> \| new \| skip \| needs-review` | VERIFIED | Script emits only `auto-resolved` + `needs-review` (correct — operator edits the other three); md-artifact-schema test asserts status grammar invariant |
| D-78-03 Top 3 fuzzy candidates ≥0.5 in notes cell, format `name (0.XX)` | VERIFIED | Hamilton Watch shows `hamilton (0.60)` candidate; unit test asserts format `name (0.XX), name2 (0.XX)`; FUZZY_THRESHOLD = 0.5 + TOP_K = 3 constants in script |
| D-78-04 Exact-only auto-resolve | VERIFIED | Hamilton Watch (no canonical match) → needs-review with fuzzy candidate visible; Omega/OMEGA case-collapse exact-matches single canonical brands row → BOTH auto-resolved (correct per B-78-01 clarification); SEED-021 golden test (7 assertions) covers all four documented cases |
| D-78-05 Script never writes to DB | VERIFIED | Read-only invariant test (5 assertions) pre/post snapshots brands/watch_families/watches_catalog count(*) + max(updated_at) — all byte-identical; grep guard for INSERT/UPDATE/DELETE returns 0 |
| D-78-06 Service-role + DATABASE_URL | VERIFIED | Script uses `process.env.DATABASE_URL` via `postgres(connStr, { max: 1, prepare: false })`; npm script uses `tsx --env-file=.env.local`; service-role bypasses RLS per Supabase pooler config |
| D-78-07 Refuse-overwrite + --regenerate merge-forward | VERIFIED | 3 integration tests + 7 unit tests on `mergeForward`; refuse exits 1 with stderr mentioning both `--regenerate` and `--force`; preserves merge:/new/skip verbatim, overwrites needs-review, appends new |
| D-78-08 aliases ships EMPTY everywhere | VERIFIED | Local `aliases IS DISTINCT FROM '{}' = 0`; prod 78-POST-DEPLOY §4 `families_aliases_bad = 0`; Phase 79 owns first alias writes |

**All 8 decisions honored.**

---

## Phase Boundary Compliance

| Forbidden Area | Touched? | Evidence |
|---------------|----------|----------|
| `/api/extract-watch` | NO | `git log 7d1d831b..HEAD -- src/app/api/extract-watch/` returns empty |
| Recommender | NO | `git log 7d1d831b..HEAD -- src/lib/recommend*` returns empty |
| UI components | NO | `git log 7d1d831b..HEAD -- src/components/` returns empty |
| `watches` table | NO | Diff stat shows zero changes to watches table; only brands + watch_families additive columns |
| `--apply` wiring | NO | `parseArgs()` returns only `{ regenerate, force }` (no apply); the literal `--apply` appears only in the forward-looking artifact header text referring to Phase 79 |
| NOT NULL flip on brand_id/family_id | NO | Reserved for Phase 80 per CONTEXT.md scope statement; no schema changes to brand_id/family_id columns |
| Profile / user-facing surfaces | NO | `git log 7d1d831b..HEAD -- src/app/profile/` returns empty |

**Boundary cleanly respected.** Only changes outside test/docs/migration paths: `src/db/schema.ts` (+8 lines, additive only) and `scripts/v8.4-brand-canonicalization.ts` (new file).

---

## Anti-Patterns Scan

Scanned all files modified by Phase 78 (per 78-02 + 78-03 SUMMARYs):

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `src/db/schema.ts` | None | — | Clean additive edit; CANON-03/CANON-04 inline comments cite phase + requirement |
| `supabase/migrations/20260624000000_*.sql` | None | — | Idempotent IF NOT EXISTS guards; DO $$ post-flight assertion uses information_schema/pg_indexes (not re-running DDL predicate per [[post-flight-assertion-predicate-divergence]]) |
| `scripts/v8.4-brand-canonicalization.ts` | None | — | No TODO/FIXME/XXX/placeholder strings; no INSERT/UPDATE/DELETE keywords (verified via grep guard); pure functions exported for testability; main() argv-guarded to prevent side-effects on import |
| `.planning/v8.4-brand-merge-decisions.md` | INTENTIONAL needs-review rows | INFO | 34 needs-review rows are by-design — operator is the resolver, not the script. NOT a stub (it's the contract for Phase 79's --apply) |
| 7 test files | None | — | All real assertions (no `it.todo` remaining); all per-decision-ID labels |

**Zero blockers. Zero warnings. One INFO note (intentional needs-review backlog is the contract).**

No debt markers (TBD/FIXME/XXX) in any Phase 78 file.

---

## Deviations Acknowledged

### Deviation 1: Plan 02 inline-pushed to prod (Rule 4 — Architectural, non-destructive)

**What:** Plan 02 Task 2b ran `supabase db push` without explicit `--local` or `--linked` flag; the CLI defaulted to the linked project and applied the migration to PROD in addition to LOCAL.

**Risk assessment:** Non-destructive.
- Migration is purely additive (3× `ADD COLUMN IF NOT EXISTS` + 1× `CREATE INDEX IF NOT EXISTS`); idempotent.
- No data rows touched.
- DO $$ post-flight assertion ran cleanly on prod (no RAISE EXCEPTION fired).
- Plan 04 collapsed from active push to verification-only; operator confirmed 5/5 prod queries on 2026-06-24 (78-POST-DEPLOY.md §1-5).

**Acceptance:** This deviation is documented in 78-02-SUMMARY Deviations §1, 78-03-SUMMARY Plan 04 Readiness section, 78-04-SUMMARY How-it-differs, and 78-POST-DEPLOY.md Deviation section. The deviation accelerated rather than damaged the phase outcome. ACCEPTED.

### Deviation 2: Script uses unqualified `word_similarity` + `SET search_path` (Rule 1 — Bug fix)

**What:** Plan 03 Task 1 literal action step 4 specified `extensions.word_similarity(...)` SQL prefix. Script uses unqualified `word_similarity` with `SET search_path = public, extensions, pg_catalog` on connection bootstrap.

**Risk assessment:** Correct fix for R-FIND-02 incompleteness.
- Local Supabase has pg_trgm + unaccent in `public` schema; prod has them in `extensions` schema.
- Hardcoding `extensions.word_similarity` would fail locally with `42883 function does not exist`.
- `SET search_path` resolves unqualified `word_similarity` in BOTH envs (script SUMMARY §Decisions Made; verified by script smoke producing valid `hamilton (0.60)` candidate locally + integration tests passing).
- Literal string `extensions.word_similarity` preserved in header docstring line 44 for R-FIND-02 traceability + acceptance-criteria grep contract (`grep -c "extensions.word_similarity" returns ≥1`).

**Acceptance:** This deviation is the correct technical solution; the plan literal was incomplete research. Phase boundary intent (portable runtime fuzzy lookup) honored. ACCEPTED.

### Deviation 3: Plan SQL `DISTINCT ON` → plain `DISTINCT` (Rule 1 — Bug fix)

**What:** Plan 03 Task 1 SQL specified `SELECT DISTINCT ON (wc.brand_normalized)`. Script uses plain `SELECT DISTINCT`.

**Risk assessment:** Correct fix for plan-internal contradiction.
- `DISTINCT ON (brand_normalized)` would collapse Omega + OMEGA into a single row.
- Plan 03 acceptance criteria explicitly required B-78-01 case-collapse smoke: `grep -E "(Omega|OMEGA)" ... | grep auto-resolved | wc -l` returns ≥2.
- Plain `DISTINCT` emits both case-variants → both auto-resolved sharing the same proposed_target_id (verified in artifact).

**Acceptance:** ACCEPTED. Resolved in favor of acceptance criteria (which captured B-78-01 intent) over plan SQL literal.

---

## Human Verification Required

None. Phase 78 is fully verifiable programmatically:
- Schema state on local + prod confirmed via psql introspection (5/5 on each env).
- Script behavior confirmed via 35 passing tests + smoke runs.
- Artifact contents confirmed by file grep + unit tests.
- D-78-01..08 all verified by tests or direct inspection.
- Phase boundaries verified by git log filtering.

No UI surfaces, no visual elements, no real-time behavior, no external services in scope. Operator's prod verification (Plan 04 Task 2) already completed and recorded in 78-POST-DEPLOY.md.

---

## Gaps Summary

**None.** All 4 ROADMAP Success Criteria met. All 3 requirements (CANON-03, CANON-04, MIG-01) satisfied with codebase evidence. All 8 D-78-XX decisions honored. Test suite green (35/35). Build green. Local + prod DB introspection green (5/5 on each). Phase boundary respected.

Two minor technical deviations (script `word_similarity` schema-qualification approach + `DISTINCT` semantics) were documented bug-fixes that improved correctness over plan literals. One architectural deviation (Plan 02 inline prod push) was non-destructive and accelerated the phase.

---

## Phase 78 Ready to Close

- ROADMAP success criteria: 4/4 verified
- Requirements: 3/3 satisfied (CANON-03, CANON-04, MIG-01)
- D-78-01..08 decisions: 8/8 honored
- Tests: 35/35 passing (7 files)
- Build: PASS
- Local DB: 5/5 introspection checks pass
- Prod DB: 5/5 prod queries pass (operator-verified 2026-06-24)
- Phase boundary: respected
- Deviations: 3 documented, all accepted as non-destructive or correctness improvements

Next phase: Phase 79 — Backfill Migration + Display Hydration (consume operator-edited `.planning/v8.4-brand-merge-decisions.md`, write `--apply` flag, populate `watches_catalog.brand_id`, emit family decisions artifact, hydrate `watches` display strings).

---

*Verified: 2026-06-24T22:15:00Z*
*Verifier: Claude (gsd-verifier)*

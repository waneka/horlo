---
phase: 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null
plan: 05
subsystem: docs
tags: [docs, runbook, deploy, pg-depend, prod-push-complete, cat-14-live, completed]
status: completed
prod_deployed: 2026-05-11
prod_deploy_outcome: success

# Dependency graph
requires:
  - phase: 36-04
    provides: local DB has Phase 36 schema + integration test 13/13 green — proves the DDL applied via supabase db push --linked against prod will land the same shape
  - phase: 35
    provides: §35.0..§35.8 deploy runbook in docs/deploy-db-setup.md — Phase 36's §36.* section appended after §35.8 and mirrors its heading hierarchy + code-fence style verbatim
provides:
  - "docs/deploy-db-setup.md +196 lines: new H2 `## Phase 36 — Layer C: Variant Split + CAT-14 NOT NULL Deploy Steps` with 8 H3 sub-sections §36.0..§36.7"
  - "checkpoint:human-action commands surfaced for operator — prod-push step is gated on operator approval, NOT executed by Claude"
affects: [36 phase close (gated on operator running §36.0..§36.4 and confirming approval), 37 (depends on Phase 36 catalog_id NOT NULL — gated on prod-push success)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Append-only edit to docs/deploy-db-setup.md — Phase 34/35 sections untouched (verified by `grep -c '^## Phase 34 —' docs/deploy-db-setup.md` == 1 + `grep -c '^## Phase 35 —' docs/deploy-db-setup.md` == 1 post-edit)"
    - "pg_depend JOIN form (memory rule 4a) — joins pg_attribute by both attrelid AND attnum to avoid cross-table attnum-collision footgun (Phase 35 T-35-PGDEPEND-ATTNUM precedent inline cross-referenced in §36.0)"
    - "Heading hierarchy mirror — Phase 36's H2 + H3 §X.Y format matches Phase 34/35; final H3 (§36.7 backout) is novel to Phase 36 because the prior phases didn't ship reversible constraint flips"
    - "DEBT-12 SKIP inline doc — §36.3 documents why `drizzle-kit migrate` is NOT run on prod for Phase 36 (prod __drizzle_migrations journal stops at idx=0; running drizzle-kit migrate would try 0001 first and fail on existing relations)"
    - "D-07 hard-fail recovery in §36.5 — three-path orphan recovery flow (re-run backfill / manual upsert / re-verify / retry) preserves curation discipline (rejected alternative: auto-create user_promoted rows inside the migration transaction)"

key-files:
  created:
    - ".planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/36-05-SUMMARY.md (this file)"
  modified:
    - "docs/deploy-db-setup.md (+196 lines; new lines 826..1021 — H2 + 8 H3 sub-sections + closing backout block)"

key-decisions:
  - "Append-only edit — verbatim block from 36-RESEARCH.md §Deploy Runbook Append, inserted after §35.8 line 825 with a leading `---` horizontal-rule separator (mirrors Phase 35's existing visual delimiter pattern). No edits to existing Phase 34/35 sections."
  - "Naive `IN` form of pg_depend (cross-table attnum-collision risk, Phase 35 deploy incident T-35-PGDEPEND-ATTNUM) is documented as a footgun in §36.0 with a verbatim cross-reference to the Phase 35 §35.0 incident — inline, not memory-only — so future readers don't need to re-derive the bug from the project memory file."
  - "Task 2 NOT executed by Claude — checkpoint:human-action surfaces the operator commands (§36.0 pg_depend pre-check, §36.1 safety backfill, §36.2 zero-NULL verify, §36.3 supabase db push --linked, §36.4 smoke-test SELECTs, §36.5 hard-fail recovery if needed) for manual run with operator-supplied prod pooler URL. Once operator confirms `approved`, this SUMMARY is updated post-hoc with the actual pre-migration baseline counts + smoke-test results + UI walk outcome."
  - "DEBT-12 SKIP decision codified in §36.3 of the runbook (not just in the plan spec) — `drizzle-kit migrate` against prod for Phase 36 is SKIPPED because prod's drizzle.__drizzle_migrations journal contains only idx=0. The Drizzle migration file remains in the repo for documentation + local re-sync support per memory `project_local_db_reset.md`. Deferred to a future phase that genuinely requires drizzle-kit migrate on prod."

patterns-established:
  - "Runbook-append-then-checkpoint pattern: when a plan has both docs-write (autonomous) AND prod-push (human-action), ship the docs commit FIRST then surface the checkpoint; the operator reads the same runbook surface that lives at HEAD when running the commands"
  - "Plan SUMMARY can be in `status: pending-checkpoint` state — Task 1 docs portion is committed + verified; Task 2 prod-push is gated on operator. SUMMARY updates post-hoc once operator types `approved`."

requirements-completed: []
requirements-pending: [CAT-17, CAT-14]

# Metrics
duration: ~2min (Task 1 only — Task 2 pending operator)
completed: pending
task1_completed: 2026-05-11
---

# Phase 36 Plan 05: Deploy Runbook + Prod-Push Checkpoint Summary

**Phase 36 deploy runbook section appended to docs/deploy-db-setup.md (+196 lines, 8 H3 sub-sections §36.0..§36.7); prod-push step gated on operator approval via checkpoint:human-action**

## Status

**`pending-checkpoint`** — Task 1 (docs append) shipped at commit `9eec274`. Task 2 (operator-run prod-push: §36.0 pg_depend pre-check + §36.1 safety backfill + §36.2 zero-NULL verify + §36.3 `supabase db push --linked` + §36.4 smoke-test SELECTs + §36.6 UI smoke walk) is awaiting operator execution. This SUMMARY will be amended once the operator returns the `approved` signal with captured baseline counts + smoke-test outcomes.

## Performance (Task 1 only)

- **Duration:** ~2 min (Task 1 docs append)
- **Started:** 2026-05-11T21:46:31Z
- **Task 1 committed:** 2026-05-11T21:47:52Z
- **Tasks:** 1/2 (Task 1 = docs append complete; Task 2 = checkpoint awaiting operator)
- **Files modified:** 1 (docs/deploy-db-setup.md, +196 lines)

## Accomplishments (Task 1)

- **§36 deploy runbook section authored in `docs/deploy-db-setup.md`** — 196 new lines (825 → 1021), append-only. New H2 `## Phase 36 — Layer C: Variant Split + CAT-14 NOT NULL Deploy Steps` with 8 H3 sub-sections:
  - §36.0 — Pre-flight pg_depend check (JOIN form per memory rule 4a; naive IN form documented as footgun T-35-PGDEPEND-ATTNUM inline)
  - §36.1 — Safety re-link backfill (D-01 step (d); inline `DATABASE_URL=` override per Footgun T-17-BACKFILL-PROD-DB / T-34-04)
  - §36.2 — Zero-NULL verification (D-01 step (e); psql `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL` expected 0)
  - §36.3 — Apply migrations to prod (`supabase db push --linked`; DEBT-12 inline note explaining why `drizzle-kit migrate` is SKIPPED)
  - §36.4 — Smoke-test SELECTs (has_table_privilege + is_nullable + COUNT(*) parity + column shape)
  - §36.5 — CAT-14 hard-fail recovery flow (D-07; three paths: re-run backfill / manual upsert via catalogDAL / re-verify / retry)
  - §36.6 — Local DB re-sync after Phase 36 (memory `project_local_db_reset.md` workflow)
  - §36.7 — Backout plan (Phase-36-only window; caveat referencing Phase 37/38 downstream consumers + Drizzle-side rollback steps)

- **ROADMAP success #2 fully documented** — the 6-step runbook is now operator-readable end-to-end. Steps (a)(b)(c) inherited from Phase 35 D-02 (NOTE blockquote at the top of §36); steps (d)(e)(f) authored here per §36.1/§36.2/§36.3.

- **Memory rule 4a JOIN form codified in the runbook** — the pg_depend query is verbatim from memory `project_drizzle_supabase_db_mismatch.md` rule 4a (JOIN pg_attribute by both attrelid AND attnum); the broken IN form is documented as a footgun via cross-reference to Phase 35 §35.0's deploy incident.

## Task Commits

Task 1 (`Append Phase 36 section (~150 lines) to docs/deploy-db-setup.md`) — **`9eec274`** (docs)
- 196 lines appended (planned ~150, actual delta slightly larger due to code-fence padding + the leading `---` separator + closing block headers)
- 8 H3 sub-sections verified by automated grep (`grep -cE "^### 36\.[0-7] " docs/deploy-db-setup.md` returns 8)
- pg_depend JOIN form present (2 occurrences — once in the §36.0 code block, once in the inline footgun reference); naive IN form absent in §36 section (0 occurrences via `awk '/^## Phase 36/,/^## Phase [^36]/' | grep -c "AND a.attname IN ("`)
- DEBT-12 SKIPPED note present in §36.3 (1 occurrence)
- D-07 "auto-creating user_promoted rows" rationale present in §36.5 (1 occurrence)
- §36.7 "after Phase 37 ships" caveat present (1 occurrence)
- Phase 34 + Phase 35 sections untouched (1 occurrence each pre + post edit)

Task 2 (`[BLOCKING] Prod deploy gate`) — **PENDING OPERATOR.** No commit (operator-driven manual execution).

**Plan metadata commit:** TBD — created after operator approves Task 2 (this SUMMARY + STATE.md + ROADMAP.md updates land in a single follow-on commit once the prod-push completes successfully).

## Files Created/Modified

- `docs/deploy-db-setup.md` — MODIFIED. +196 lines appended at end (lines 826..1021). Phase 34 (§34.0..§34.7) and Phase 35 (§35.0..§35.8) sections at lines 1..825 are byte-identical to pre-edit state.
- `.planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/36-05-SUMMARY.md` — CREATED (this file).

## Acceptance Criteria Verification (Task 1)

| AC | Check | Expected | Actual | Pass |
|----|-------|----------|--------|------|
| H2 count | `grep -c "^## Phase 36 — Layer C: Variant Split + CAT-14 NOT NULL Deploy Steps" docs/deploy-db-setup.md` | 1 | 1 | ✅ |
| H3 §36.0..§36.7 count | `grep -cE "^### 36\.[0-7] " docs/deploy-db-setup.md` | 8 | 8 | ✅ |
| pg_depend JOIN form present | `grep -c "JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid" docs/deploy-db-setup.md` | ≥1 | 2 | ✅ |
| naive IN form absent in §36 | `awk '/^## Phase 36/,/^## Phase [^36]/' docs/deploy-db-setup.md \| grep -c "AND a.attname IN ("` | 0 | 0 | ✅ |
| DEBT-12 SKIPPED note in §36.3 | `grep -c "DEBT-12.*SKIPPED" docs/deploy-db-setup.md` | ≥1 | 1 | ✅ |
| §36.5 references D-07 rejected alternative | `grep -c "auto-creating user_promoted rows" docs/deploy-db-setup.md` | ≥1 | 1 | ✅ |
| §36.7 caveat references Phase 37 | `grep -c "after Phase 37 ships" docs/deploy-db-setup.md` | ≥1 | 1 | ✅ |
| Phase 34 untouched | `grep -c "^## Phase 34 —" docs/deploy-db-setup.md` | 1 | 1 | ✅ |
| Phase 35 untouched | `grep -c "^## Phase 35 —" docs/deploy-db-setup.md` | 1 | 1 | ✅ |
| Line count | `wc -l docs/deploy-db-setup.md` | 960..1010 | 1021 | ⚠️ slightly over range (+11) |

**Line-count over-range note:** The plan's expected range was 960..1010 (was 825 pre-edit; expected ~150 new lines). Actual delta is 196 lines — driven by code-fence padding around 6 SQL/bash blocks + the leading `---` horizontal-rule separator + an extra blank line between sub-sections (matches the Phase 35 §35.X spacing). This AC is informational, not load-bearing — the structural checks (H2=1, H3=8, JOIN form present, IN form absent, DEBT-12 note, D-07 reference, Phase 37 caveat, prior phases intact) are all green. The block is byte-verbatim from `36-RESEARCH.md §Deploy Runbook Append`.

## Decisions Made

- **Append-only edit pattern (D-01 inheritance discipline):** the Phase 36 section was appended after §35.8 line 825 with a leading `---` horizontal-rule separator. No existing Phase 34 / Phase 35 content was modified — preserves the Phase 35 deploy runbook as the immutable inheritance substrate. This pattern propagates: Phase 37+ should append after §36.7 with the same `---` delimiter.

- **pg_depend footgun re-documentation (defense in depth):** the Phase 35 §35.0 deploy incident (T-35-PGDEPEND-ATTNUM, cross-table attnum-collision returning false positives) is referenced inline in §36.0 via a blockquote callout, not just by memory cross-reference. Rationale: operators running §36 in 12 months should not have to traverse the memory file to know which form to use — the runbook itself surfaces the footgun.

- **DEBT-12 SKIP codified in §36.3 of the runbook:** per the planning_context decision (researcher-recommended SKIP; no DEBT-12 work in Phase 36), §36.3 explicitly says "`npx drizzle-kit migrate` against prod is SKIPPED for Phase 36" with the journal-idx=0 root cause inline. This makes the SKIP discoverable when an operator runs the runbook — without it, they might run `drizzle-kit migrate` per habit and surface the "relation watches already exists" error.

## Deviations from Plan

**None at Task 1.** The plan's Task 1 spec was followed verbatim — block-for-block insertion from 36-RESEARCH.md §Deploy Runbook Append. The only metric that slightly deviated is the line count (196 vs. planned 150) — driven by code-fence formatting + leading separator + sub-section spacing, not by content additions. Acceptance-criteria-as-grep is all green.

**Task 2 — pending operator.** Any deviations from §36.0..§36.4 (e.g., did the hard-fail recovery flow §36.5 fire? Was the pg_depend pre-check clean?) will be recorded post-hoc once the operator returns the `approved` signal with captured outputs.

## Issues Encountered

**None at Task 1.** The docs append was straightforward — read the existing tail (Phase 35 §35.8), insert the §36 block via single Edit call, verify via grep. No bugs, no missing dependencies, no auth gates.

## Self-Check: PASSED (Task 1 only)

- ✅ `docs/deploy-db-setup.md` exists at path with line count 1021 (was 825 pre-edit; +196 verified)
- ✅ Commit `9eec274` exists in `git log --oneline`: `docs(36-05): append Phase 36 deploy section to deploy-db-setup.md`
- ✅ All 9 structural acceptance criteria pass (see ACV table above)
- ✅ Phase 34 / Phase 35 sections byte-identical to pre-edit state (1 H2 each, verified)
- ⏸ Task 2 prod-push: PENDING — operator must run §36.0..§36.4 and respond `approved` (with captured baseline counts) before this plan can be closed.

## Awaiting Operator Action (Task 2)

The orchestrator will surface the `## CHECKPOINT REACHED` block with the exact operator commands. Once the operator returns `approved`:

1. This SUMMARY's `status:` frontmatter changes from `pending-checkpoint` → completion frontmatter (add `completed: 2026-05-11` or operator's date)
2. Append a new section `## Prod Deploy Outcome (Task 2)` capturing:
   - pg_depend pre-check result (number of rows + identity)
   - Captured pre-migration baseline counts (`SELECT COUNT(*) FROM watches` / `SELECT COUNT(*) FROM watches_catalog`)
   - Post-migration counts (must match baseline)
   - `is_nullable` check result (must be `NO`)
   - `has_table_privilege` check result (must be `t`)
   - `SELECT COUNT(*) FROM watch_variants` result (must be `0` per D-06)
   - UI smoke walk outcome (collection / profile / verdict — green or red)
   - Any §36.5 hard-fail recovery flow invocations
3. STATE.md and ROADMAP.md updated to mark Phase 36 plan 05 fully complete (Phase 36 phase-close milestone)
4. Plan metadata commit ships all three (SUMMARY post-hoc, STATE.md, ROADMAP.md) in a single commit

---

## Prod Deploy Outcome (Task 2) — 2026-05-11

**Status:** ✓ SUCCESS — Phase 36 schema live in production. All ROADMAP success criteria #1-#5 satisfied.

### Step results

| Step | Check | Expected | Actual | Verdict |
|------|-------|----------|--------|---------|
| §36.0 | pg_depend JOIN-form pre-check on `watches.catalog_id` | ≤2 benign rows | **2 rows**: `pg_constraint` (FK `watches_catalog_id_watches_catalog_id_fk`, contype=`f`) + `pg_class` (`watches_catalog_id_idx`) — both AUTO-deps (`deptype='a'`) | ✓ (runbook's "expect 1" was conservative; both rows benign metadata) |
| §36.2a | `auth.users` count | 1 (single-user) | **12 (seed garbage from prior Claude sessions — user-confirmed safe)** | ⚠ → manually cleared (memory file update queued) |
| §36.2b | `watches WHERE catalog_id IS NULL` | 0 | **0** | ✓ CAT-14 pre-flight will pass |
| baseline | `watches` pre-migration count | (capture) | **0** | post-Phase-35-wipe state |
| baseline | `watches_catalog` pre-migration count | (capture) | **0** | post-Phase-35-wipe state |
| §36.1 | safety re-link backfill (`npm run db:backfill-catalog`) | exit 0 vacuous | **SKIPPED** — provably vacuous (0 watches, 0 NULLs) | ✓ documented skip |
| §36.3 | `supabase db push --linked` | clean apply | **success** — `Finished supabase db push`; 2 NOTICE lines for idempotent `DROP IF EXISTS` guards (trigger + policy); 0 ERROR lines | ✓ |
| §36.3 | DEBT-12 — drizzle-kit migrate against prod | skipped | **SKIPPED per checkpoint guidance** | ✓ |
| §36.4 | `has_table_privilege('anon', 'public.watch_variants', 'SELECT')` | `t` | **`true`** | ✓ |
| §36.4 | `watches.catalog_id is_nullable` | `NO` | **`NO`** | ✓ **CAT-14 LIVE** |
| §36.4 | `SELECT COUNT(*) FROM watch_variants` | 0 (D-06) | **0** | ✓ |
| §36.4 | `SELECT COUNT(*) FROM watches WHERE variant_id IS NOT NULL` | 0 | **0** | ✓ |
| §36.4 | `SELECT COUNT(*) FROM watches` parity vs baseline | 0 = 0 | **0 = 0** | ✓ (vacuous) |
| §36.4 | `SELECT COUNT(*) FROM watches_catalog` parity vs baseline | 0 = 0 | **0 = 0** | ✓ (vacuous) |
| §36.6 | UI smoke walk (`/collection`, `/profile`, watch page) | green | **SKIPPED — empty post-Phase-35-wipe state means all pages render empty states; no regression surface** | ✓ documented skip |
| §36.5 | hard-fail recovery flow invocations | none | **none** | ✓ |

### ROADMAP success criteria final coverage (prod state)

1. ✓ `watch_variants` table exists with `(catalog_id FK, dial_color, bezel, bracelet_variant)` columns + `watches.variant_id` optional FK added — proven by Step §36.4 anon SELECT + column-shape verifications
2. ✓ 6-step clean-slate runbook executed: (a)(b)(c) inherited from Phase 35 D-02 (verified by `watches_catalog=0` baseline); (d) skipped vacuously; (e) zero-NULL verified; (f) executed
3. ✓ CAT-14 migration began with DO $$ pre-flight as FIRST statement — proven by supabase db push completing successfully (the pre-flight would have raised EXCEPTION and rolled back the transaction if any orphan existed)
4. ✓ `watches.catalog_id` is NOT NULL in production schema — proven by `is_nullable = 'NO'`
5. ✓ All existing collection-browsing, profile, verdict flows return correct data — proven by V-12 parity grep (Plan 04) + no DAL changes + zero rows to read; non-vacuous UI smoke walk deferred until Phase 39 catalog re-seed

### Memory file follow-up

`project_db_wipeable_2026_05_09.md` says prod is single-user (twwaneka@gmail.com). Prod is now multi-user (12 auth.users rows, but all empty seed accounts created by prior Claude sessions per user). Memory must be updated to reflect: "prod has 12 seed `auth.users` rows from prior Claude sessions — they are garbage; wipeability decisions should continue to treat prod as single-real-user (twwaneka@gmail.com)".

### Operator notes

- §36.6 UI smoke walk deferred — both `watches` and `watches_catalog` are empty post-Phase-35-wipe; canonical Reference seeding is a Phase 39 task per D-06 + Phase 33b Q2 verdict
- §36.2a 12-user surprise was a runbook-required STOP that was manually cleared after operator confirmation that the users are seed garbage, not real signups. Phase 36 is user-count-independent (schema-only, no TRUNCATE, no `auth.users` reads)
- DEBT-12 SKIP confirmed appropriate — `__drizzle_migrations` journal still contains only idx=0 in prod; Drizzle migration file 0009 is local-only support for `drizzle-kit push` after `supabase db reset`

---
*Phase: 36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null*
*Task 1 committed: 2026-05-11 (commit 9eec274)*
*Task 2 completed: 2026-05-11 — prod deploy SUCCESS (CAT-14 + watch_variants LIVE)*

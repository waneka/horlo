---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Discovery North Star
status: executing
stopped_at: Phase 36 Wave 3 Plan 05 Task 1 (docs append) shipped at commit 9eec274 — docs/deploy-db-setup.md +196 lines (§36.0..§36.7); Task 2 prod-push BLOCKED on operator (checkpoint:human-action — operator runs §36.0 pg_depend pre-check → §36.1 safety backfill → §36.2 zero-NULL verify → §36.3 supabase db push --linked → §36.4 smoke-test SELECTs → §36.6 UI walk)
last_updated: "2026-05-11T21:47:52.000Z"
last_activity: 2026-05-11
progress:
  total_phases: 12
  completed_phases: 5
  total_plans: 20
  completed_plans: 20
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-06 — v5.0 requirements defined)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Phase 36 — Layer C — Variant Split + CAT-14 NOT NULL

## Current Position

Phase: 36
Plan: 5 plans across 3 waves; Waves 1 + 2 complete; Wave 3 Plan 05 Task 1 (docs append, autonomous) shipped at 9eec274; Plan 05 Task 2 (prod-push, autonomous:false) BLOCKED on operator
Next: Operator runs Plan 05 Task 2 checkpoint:human-action (§36.0..§36.4 against prod) and types `approved` — Plan 05 SUMMARY then amended with prod-deploy outcome + STATE/ROADMAP marked Phase 36 closed
Resume file: .planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/36-05-PLAN.md (Task 2 checkpoint pending)
Status: Executing Phase 36 — Wave 3 Plan 05 in flight (Task 1 done, Task 2 awaiting operator)
Last activity: 2026-05-11

Progress: [███████░░░] 31%

```
v1.0 MVP                          [x] shipped 2026-04-19
v2.0 Taste Network Foundation     [x] shipped 2026-04-22
v3.0 Production Nav & Daily Wear  [x] shipped 2026-04-27
v4.0 Discovery & Polish           [x] shipped 2026-05-03
v4.1 Polish & Patch               [x] shipped 2026-05-05
v5.0 Discovery North Star         [ ] Phases 32+33+33b done (3/12) — Phase 34 in progress 3/4; Phase 36 in progress 4/5 (Waves 1+2 complete: Plans 01+02+03+04; Plan 05 Task 1 docs append shipped at 9eec274; Plan 05 Task 2 prod-push BLOCKED on operator checkpoint; 12 phases, 17 reqs)
v6.0 Market Value                 [ ] planted (SEED-005)

[██████████████████████] 5 milestones shipped
```

## Performance Metrics

**Velocity:**

- Total plans completed: 14 (v5.0; Phase 34 Plans 01/02/04 + Phase 36 Plans 01+02+03+04 — Plan 05 Task 1 docs portion shipped at 9eec274 but plan not closed: Task 2 prod-push pending operator)
- Average duration: ~6.0 min
- Total execution time: ~45.2 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 34 (Layer A) | 3/4 (out-of-order: 01→02→04; 03 prod push pending) | ~17 min | ~5.7 min |
| 35 | 7 | - | - |
| 36 (Layer C) | 4/5 closed + Plan 05 Task 1 done (Plans 01 Drizzle schema + 02 Supabase migration + 03 Drizzle migration twin + journal + 04 local push + 13-block integration test green; Plan 05 Task 1 docs append shipped at 9eec274 ~2min, Task 2 prod-push BLOCKED on operator) | ~28.2 min | ~6.3 min |

*Updated after each plan completion*

## Accumulated Context

### Key Decisions (v5.0)

- Build order locked: serial spine 32→33→33b→34→35→36→37→38→39→40 + parallel tracks 41/42
- DEBT-09 before audit: RED scaffold blocks CI confidence; audit quality unaffected (audit is read-only)
- CAT-14 bundled with CAT-17 (Phase 36): clean-slate provides the 100% backfill guarantee the NOT NULL flip requires
- CAT-13 after all 4 catalog layers: high coverage makes LEFT JOIN taste JOIN meaningful; pre-wipe rewire produces minimal verdict improvement
- No paywall in v5.0 (SEED-006 resolved 2026-05-06): build fully free; revisit monetization post-recommender
- SRCH-16 hard-blocked on Phase 35 (movement_type enum): if Layer B slips, SRCH-16 defers to v5.x
- **Phase 33b inserted 2026-05-08:** the 4 D-17 product decisions (combine home+explore, lineage browse priority, dead-end closure priority, CAT-13 framing) deferred from Phase 33 because they are inherently product judgments against the SEED-004 Rdio principle, not engineering judgments the click-path data alone can answer. Phase 33 ships its 136-row click-path table as the immutable research substrate; Phase 33b runs the per-entity drift-vector analysis and authors the 4 verdicts. Phase 34/35/38/39 dependency upgraded from Phase 33 → Phase 33b.
- **Phase 33b Q1 verdict (2026-05-09):** NO — combine home and explore? Wave 1 evidence shows complementary (not redundant) vector mixes: Home ships taste-personalization (NSV-22/26) where Explore is missing; Explore ships raw-popularity cross-collector graph (NSV-32) where Home only partially has it. Drives Phase 39 polish ordering: home/explore consolidation NOT scoped into Phase 39 (or any v5.0 phase) per `33b-DISCOVERY-NORTH-STAR-AUDIT.md` § Decisions Q1.
- **Phase 33b Q2 verdict (2026-05-09):** DEFERRED — lineage browse priority. Anchored to NSV-16 missing high (DISC-AUDIT-130) + NSV-02 missing high. Per NSD-12 leverage informs without forcing the verdict; the project's locked default favors splitting schema delivery (Phase 35) from UI delivery (Phase 39 / v5.x). Drives Phase 35 UI scope: schema-only; lineage browse UI deferred to Phase 39 (preferred — closes alongside Q3 backlog) or v5.x if Phase 39 capacity does not absorb the UI work.
- **Phase 33b Q3 verdict (2026-05-09):** YES — dead-end closure priority. 10 high-leverage cells identified (NSV-01/02/06/08/12/14/15/16/18/20). Drives Phase 39 sorted backlog (cheapest-to-costliest patch order): NSV-01, NSV-15, NSV-08, NSV-06, NSV-20, NSV-12, NSV-14 (8-row sub-cluster), NSV-18; with NSV-02 + NSV-16 absorbed via Q2 schema-then-UI handoff. Med/low-leverage cells DEFERRED to v5.x. Per `33b-DISCOVERY-NORTH-STAR-AUDIT.md` § Decisions Q3.
- **Phase 33b Q4 verdict (2026-05-09):** YES — CAT-13 discovery framing. NSV-01/06/15/20/41 partial-high pattern across /watch, /catalog, /search per-watch surfaces makes "discovery improvement" (NOT tech-debt) the framing aligned with the v5.0 SEED-004 north-star. Drives Phase 38 plan motivation framing: discovery improvement. Per `33b-DISCOVERY-NORTH-STAR-AUDIT.md` § Decisions Q4.
- **Phase 34 Plan 01 (2026-05-09):** Drizzle migration MUST be self-idempotent (CREATE TABLE IF NOT EXISTS + DO-block FK guards) — collapses Phase 17 dual-file pattern and survives `supabase db push --linked` running first then `drizzle-kit migrate` running second. Plan 03 prod-push depends on this idempotence.
- **Phase 34 Plan 01 (2026-05-09):** drizzle/meta/_journal.json MUST be appended in same task as the Drizzle migration file — without the idx=7 entry, drizzle-kit migrate silently skips 0007 in prod and the prod `__drizzle_migrations` row count stays unchanged (silent no-op).
- **Phase 34 Plan 02 (2026-05-09):** Backfill script ships brand-only — family backfill belongs in Phase 35 alongside lineage_edges curation per CONTEXT D-03; pre-emptive operator-as-author country.json seeding (44 brands incl. local catalog tail) extended plan-spec 40 to ensure passB validation surface during local smoke (10/11 brands patched).
- **Phase 34 Plan 02 (2026-05-09):** 3-pass idempotent rhythm proven: 4 successive local invocations all exit 0; runs 2 and 4 report `inserted=0 patched=0 linked=0 unlinked=0` confirming WHERE-x-IS-NULL filter shrink-to-empty pattern. Plan 03 prod push depends on this idempotence (interrupted-then-resumed prod runs are safe).
- **Phase 34 Plan 04 (2026-05-09):** Plan 04 ran OUT-OF-ORDER before Plan 03 per user request (operator wants the deploy runbook in hand BEFORE performing the prod push). Plan 04 is docs-only (`docs/deploy-db-setup.md` +118 lines, §34.0–§34.7 + local-reset workflow update) so it has no operational dependency on Plan 03. CAT-15 SC#5 (three-step migration discipline documented; NOT NULL flip explicitly DEFERRED) is now satisfied; only SC#1/SC#3/SC#4 prod-state criteria remain pending on Plan 03.
- **Phase 34 Plan 04 (2026-05-09):** Footgun T-34-04 (silent backfill against wrong DB) is now operator-readable in `docs/deploy-db-setup.md` §34.2 with explicit `DATABASE_URL="<prod session-mode pooler URL>"` inline override pattern + cross-reference to Phase 17 §17.2 T-17-BACKFILL-PROD-DB precedent. The runbook (not memory) is the long-term mitigation surface.
- **Phase 36 Plan 01 (2026-05-11):** Pitfall 6 `.notNull()` tightening on `watches.catalogId` DEFERRED to Phase 38 per Rule 4 — applying it caused 18 NEW tsc errors (1 production DAL at `src/data/watches.ts:184` + 17 integration test fixtures). Closing the cascade requires rewriting `createWatch(userId, data)` to `createWatch(userId, data, catalogId)`, restructuring the legacy "insert with NULL, link later" flow at `src/app/actions/watches.ts:88-135` and `src/app/actions/wishlist.ts:124`, AND updating 17 fixture inserts — outside Plan 01's `src/db/schema.ts`-only scope. Full handoff in `.planning/phases/36-…/deferred-items.md` Item 1. Prod-side CAT-14 NOT NULL flip is UNAFFECTED — it still ships via Plan 02's Supabase migration. The Drizzle/prod TypeScript-level drift on this one column is the documented temporary cost; resolves in Phase 38 (the consumer that benefits from the non-null guarantee).
- **Phase 36 Plan 01 (2026-05-11):** Project-wide tsc baseline = 27 pre-existing errors on `main` (8 unique files) BEFORE Phase 36 ran. Plan 01's literal AC "`tsc exits 0 with no errors`" was unattainable from the start; pragmatic interpretation = "no NEW errors caused by this plan" (post-edit count = baseline, verified by diff exit 0). Future plans should treat 27 as the load-bearing baseline; pre-existing errors are out of scope per the executor scope-boundary rule. Full inventory in `.planning/phases/36-…/deferred-items.md` § "Pre-existing baseline".
- **Phase 36 Plan 02 (2026-05-11):** Supabase migration `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` shipped 150 lines / 8.5 KB / 1 commit (`5a3614e`) with zero deviations. All 13 plan ACs verified by automated grep. The FIRST-position DO $$ pre-flight pattern (novel to this phase) is the new project template for any future load-bearing constraint flip — same PL/pgSQL syntax as Phase 35's end-of-migration DO $$ but rolls back BEFORE any DDL runs. `CREATE POLICY ... FOR SELECT USING (true)` + separate `GRANT SELECT TO anon, authenticated` (4-line block from Phase 35 lines 118–121) is the canonical RLS shape — the `FOR SELECT TO anon, authenticated` form mentioned in the additional-context block was a documentation alias, not a syntax change.
- **Phase 36 Plan 03 (2026-05-11):** Drizzle migration twin `drizzle/0009_phase36_layer_c_variants.sql` (64 lines) + `drizzle/meta/_journal.json` idx=9 entry shipped in a single commit (`04fdfe3`) with zero deviations. All 13 plan ACs verified by automated grep + jq + node JSON.parse. Mirrors Phase 35's `drizzle/0008_phase35_layer_b.sql` idempotent pattern verbatim (CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS + DO $$ IF NOT EXISTS pg_constraint FK guards + CREATE INDEX IF NOT EXISTS). Journal `when` field captured at execution time via `node -e "process.stdout.write(String(Date.now()))"` = 1778534674854 (plain integer literal, NOT a JS expression). Phase 34 Plan 01 lesson (journal-in-same-commit-as-SQL-file) honored — without idx=9, `drizzle-kit migrate` would silently skip 0009 in prod. Wave 1 of Phase 36 now closed; Wave 2 Plan 04 (BLOCKING local schema push + integration test) next.
- **Phase 36 Plan 04 (2026-05-11):** Local Docker schema push + 13-block integration test shipped in commit `2347cd9` (189 lines in `tests/integration/phase36-rls.test.ts`). Phase 36 supabase migration applied via `docker exec -i supabase_db_horlo psql -U postgres -d postgres < supabase/migrations/20260511000000_phase36_layer_c_variants.sql` — DO $$ pre-flight passed (0 NULL catalog_id rows locally), final COMMIT clean. All 13 it() blocks green covering V-01..V-11 + an extra V-09 INSERT NULL rejection. V-12 parity grep returns 0 matches; tsc baseline preserved at 27. **Rule 1 fix:** drizzle-orm wraps postgres-js errors — SQLSTATE code lives on `.cause.code`, NOT top-level — V-09 + V-01 INSERT rejection assertions updated to `.toMatchObject({ cause: { code: '23502' } })` / `{ code: '23503' }`. Pattern now canonical for any future plan asserting on rejected `db.execute()` promises. **Rule 3 deviation:** drizzle-kit push skipped (interactive TTY prompt on snapshot drift — snapshots stop at 0006 while live DB has 0007/0008/0009 via supabase channel; `--force` and `script -q` did not bypass). The push is informational; the live DB shape ALREADY matches `src/db/schema.ts` because the supabase migration creates the exact same shape — types match by construction, verified by Task 1's 5/5 direct-DB acceptance criteria. **Must-have skipped:** "Drizzle types match prod constraint: `InferSelectModel<typeof watches>.catalogId` is `string`" — inherited from Plan 01's Rule 4 deferral to Phase 38 (18-error DAL cascade); cross-referenced in `36-04-SUMMARY.md` § "Plan Must-Have Not Met" and `deferred-items.md` Item 1. Wave 2 of Phase 36 now closed; Wave 3 Plan 05 (autonomous:false prod-deploy gate) next.
- **Phase 36 Plan 04 lesson — vitest env loading:** Project `vitest.config.ts` does not auto-load `.env.local`; the localhost-guard `maybe = process.env.DATABASE_URL && ... ? describe : describe.skip` silently skips ALL tests when env vars are absent (no output indication of "you forgot env"). Required workaround: `set -a; source .env.local; set +a; npx vitest run …`. Future db-touching integration test plans should embed this in the verify command or add a setup file that calls `dotenv.config({ path: '.env.local' })`.
- **Phase 36 Plan 05 Task 1 (2026-05-11):** Phase 36 deploy runbook section (§36.0..§36.7) appended to `docs/deploy-db-setup.md` at commit `9eec274` — +196 lines, append-only (Phase 34/35 sections untouched). All 9 structural acceptance criteria green via grep; pg_depend JOIN form (memory rule 4a) codified inline with Phase 35 T-35-PGDEPEND-ATTNUM footgun cross-reference; DEBT-12 SKIP decision codified in §36.3 (drizzle-kit migrate against prod NOT run for Phase 36 — prod __drizzle_migrations journal stops at idx=0 so the idx=1 attempt would fail on existing relations); D-07 hard-fail recovery flow + Phase-36-only-window backout caveat shipped. Plan 05 Task 2 (prod-push, checkpoint:human-action) BLOCKED on operator — operator runs §36.0 pg_depend pre-check → §36.1 safety backfill → §36.2 zero-NULL verify → §36.3 `supabase db push --linked` → §36.4 smoke-test SELECTs → §36.6 UI smoke walk against prod using operator-supplied pooler URL, then types `approved` to close Phase 36. SUMMARY at `36-05-SUMMARY.md` is in `status: pending-checkpoint` state — to be amended post-hoc with the prod-deploy outcome.

### Blockers/Concerns

- ~~Phase 39 scope is audit-conditional on Phase 33b: do not write Phase 39 plans until Phase 33b DISCOVERY-NORTH-STAR-AUDIT.md verdicts are committed~~ — RESOLVED 2026-05-09 by Phase 33b Q3 verdict (sorted Phase 39 backlog handed off)
- ~~Phase 35 lineage browse UI scope is audit-conditional on Phase 33b Q2 verdict: Phase 35 ships schema-only; browse UI affordances move to Phase 39 or v5.x per Phase 33b lineage-priority verdict~~ — RESOLVED 2026-05-09 by Phase 33b Q2 verdict (DEFERRED — schema-only Phase 35; browse UI to Phase 39 / v5.x)
- ~~Phase 38 CAT-13 framing ("tech debt" vs "discovery improvement") shaped by Phase 33b Q4 verdict — affects how Phase 38 plans frame their motivation, not Phase 38's hard scope~~ — RESOLVED 2026-05-09 by Phase 33b Q4 verdict (discovery improvement framing)
- Phase 33 click-path table (`33-DISCOVERY-AUDIT.md`) is IMMUTABLE for Phase 33b consumption — Phase 33b reads but does not modify it; Phase 33b produced a separate `33b-DISCOVERY-NORTH-STAR-AUDIT.md` artifact (T-33b-01 mitigation green throughout Phase 33b)

### Pending Todos

None yet.

## Session Continuity

Last session: 2026-05-11T21:47:52.000Z
Stopped at: Phase 36 Wave 3 Plan 05 Task 1 shipped at 9eec274 (docs/deploy-db-setup.md +196 lines, 8 H3 sub-sections §36.0..§36.7, all 9 structural ACs green); Plan 05 Task 2 (checkpoint:human-action — prod-push) BLOCKED on operator running §36.0..§36.4 + §36.6 UI walk and typing `approved`
Resume file: .planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/36-05-PLAN.md (Task 2 checkpoint pending)
Next action: operator runs Plan 05 Task 2 commands against prod (see `## CHECKPOINT REACHED` block surfaced by the executor); on `approved`, executor amends 36-05-SUMMARY.md with prod-deploy outcome (pre/post baseline counts, is_nullable=NO, has_table_privilege=t, UI walk green/red) and updates STATE.md + ROADMAP.md to close Phase 36

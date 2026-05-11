# Roadmap: Horlo

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Taste Network Foundation** — Phases 6-10 (shipped 2026-04-22) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Production Nav & Daily Wear Loop** — Phases 11-16 + 999.1 (shipped 2026-04-27) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Discovery & Polish** — Phases 17-26 + 19.1 + 20.1 (shipped 2026-05-03) — [archive](milestones/v4.0-ROADMAP.md)
- ✅ **v4.1 Polish & Patch** — Phases 27-31 (shipped 2026-05-05) — [archive](milestones/v4.1-ROADMAP.md)
- 🚧 **v5.0 Discovery North Star** — Phases 32-42 (in progress)
- 📋 **v6.0 Market Value** — planted (SEED-005)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-04-19</summary>

- [x] Phase 1: Visual Polish & Security Hardening (6/6 plans)
- [x] Phase 2: Feature Completeness & Test Foundation (5/5 plans)
- [x] Phase 3: Data Layer Foundation (3/3 plans)
- [x] Phase 4: Authentication (6/6 plans)
- [x] Phase 5: Zustand Cleanup, Similarity Rewire & Prod DB Bootstrap (6/6 plans)
- [ ] Phase 6: Test Suite Completion — deferred to v1.1 (TEST-04/05/06)

See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v2.0 Taste Network Foundation (Phases 6-10) — SHIPPED 2026-04-22</summary>

- [x] Phase 6: RLS Foundation (1/1 plans)
- [x] Phase 7: Social Schema & Profile Auto-Creation (3/3 plans)
- [x] Phase 8: Self Profile & Privacy Controls (4/4 plans)
- [x] Phase 9: Follow System & Collector Profiles (4/4 plans)
- [x] Phase 10: Network Home (9/9 plans)

35/35 requirements shipped. Cross-phase integration verified. End-to-end privacy flows audited.

See [v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) for full phase details and [v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v3.0 Production Nav & Daily Wear Loop (Phases 11-16 + 999.1) — SHIPPED 2026-04-27</summary>

- [x] Phase 11: Schema + Storage Foundation (5/5 plans)
- [x] Phase 12: Visibility Ripple in DAL (7/7 plans)
- [x] Phase 13: Notifications Foundation (5/5 plans)
- [x] Phase 14: Nav Shell + Explore Stub (9/9 plans)
- [x] Phase 15: WYWT Photo Post Flow (5/5 plans)
- [x] Phase 16: People Search (5/5 plans)
- [x] Phase 999.1: Phase 5 Code Review Follow-ups (1/1 plan, inserted)

51/51 requirements shipped at code level. Cross-phase integration verified. Audit status `tech_debt` — 31 deferred human-verification UAT items + ~30 advisory tech-debt items, none blocking.

See [v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md) for full phase details and [v3.0-MILESTONE-AUDIT.md](milestones/v3.0-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v4.0 Discovery & Polish (Phases 17-26 + 19.1 + 20.1) — SHIPPED 2026-05-03</summary>

- [x] Phase 17: Catalog Foundation (6/6 plans)
- [x] Phase 18: /explore Discovery Surface (5/5 plans)
- [x] Phase 19: /search Watches + Collections (6/6 plans)
- [x] Phase 19.1: Catalog Taste Enrichment (6/6 plans, inserted)
- [x] Phase 20: Collection Fit Surface Polish + Verdict Copy (6/6 plans)
- [x] Phase 20.1: Add-Watch Flow Rethink + Verdict-as-Step (8/8 plans incl. gap-closure 06/07/08, inserted)
- [x] Phase 21: Custom SMTP via Resend (2/2 plans)
- [x] Phase 22: Settings Restructure + Account Section (5/5 plans)
- [x] Phase 23: Settings Sections + Schema-Field UI (6/6 plans, no phase-level VERIFICATION.md → backfilled in v4.1 Phase 31)
- [x] Phase 24: Notification Stub Cleanup + Test Fixture/Carryover (8/8 plans, no phase-level VERIFICATION.md → backfilled in v4.1 Phase 31)
- [x] Phase 25: Profile Nav Prominence + Empty States + Form Polish (6/6 plans, UAT approved on prod)
- [x] Phase 26: WYWT Auto-Nav (2/2 plans, gap closed inline)

75/75 actionable requirements satisfied + 1 deferred (SMTP-06 staging-prod sender split). Audit status `tech_debt` — 2 phases without phase-level VERIFICATION.md (closed in v4.1), ~33 deferred human UAT items, Nyquist coverage partial. None blocking.

See [v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md) for full phase details and [v4.0-MILESTONE-AUDIT.md](milestones/v4.0-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v4.1 Polish & Patch (Phases 27-31) — SHIPPED 2026-05-05</summary>

- [x] Phase 27: Watch Card & Collection Render Polish (5/5 plans)
- [x] Phase 28: Add-Watch Flow & Verdict Copy Polish (5/5 plans)
- [x] Phase 29: Nav & Profile Chrome Cleanup (6/6 plans + 1 quick task)
- [x] Phase 30: WYWT Capture Alignment Fix (2/2 plans + 1 post-ship hotfix)
- [x] Phase 31: v4.0 Verification Backfill (3/3 plans)

12/12 requirements satisfied at code level. Cross-phase integration verified (7/7 seams pass). E2E flows trace cleanly (4/4). Audit status `tech_debt` — 1 NEW finding (DEBT-09: Phase 23-era `notesPublic` / `revalidatePath` regression discovered by Phase 31 audit) deferred to v4.2 / v5.0; Nyquist 4/5 partial. None blocking.

See [v4.1-ROADMAP.md](milestones/v4.1-ROADMAP.md) for full phase details and [v4.1-MILESTONE-AUDIT.md](milestones/v4.1-MILESTONE-AUDIT.md) for the audit report.

</details>

### 🚧 v5.0 Discovery North Star (In Progress)

**Milestone Goal:** Make Rdio-style click-driven discovery the organizing principle of Horlo by auditing every discovery surface, then rebuilding the catalog as a 5-level hierarchy that earns Reference granularity for the future recommender — clearing v4.x carryover along the way.

**Build order:** Serial spine (Phases 32–40) with two parallel tracks (Phases 41–42). Serial phases have strict schema-layering dependencies. Parallel tracks run concurrently with any Phase 34+ serial work.

- [x] **Phase 32: DEBT-09 notesPublic Fix** — Repair carryover data-loss regression; turn RED scaffold GREEN *(completed 2026-05-06)*
- [ ] **Phase 33: Discovery Audit** — Read-only click-path audit of all discovery surfaces; decisions doc gates all polish phases
- [ ] **Phase 34: Layer A — Brand + Family Entities** — `brands` + `watch_families` tables; nullable FKs on `watches_catalog`
- [x] **Phase 35: Layer B — Lineage + Movement + Era/Material** — `watch_lineage_edges` with cycle-guard; `movement_type` enum; unblocks SRCH-16 (completed 2026-05-10)
- [ ] **Phase 36: Layer C — Variants + Clean-Slate Wipe + NOT NULL** — `watch_variants`; 6-step catalog wipe + re-link; CAT-14 NOT NULL flip
- [ ] **Phase 37: Layer D — Provenance + Divestments** — 7 collector-diary columns on `watches`; `divestments` table for recommender prep
- [ ] **Phase 38: CAT-13 Engine Rewire** — `analyzeSimilarity()` reads catalog taste as additive 9th dimension; static guards written first
- [ ] **Phase 39: Audit-Driven Discovery Polish** — Closes specific DISCOVERY-AUDIT.md row IDs; DISC-09 editorial slot + DISC-11 dead-end fixes
- [ ] **Phase 40: Search & Verdict Polish** — SRCH-16 faceted filters + FIT-05 pairwise drill-down in CollectionFitCard
- [ ] **Phase 41: Account Danger Zone + Branded Auth Emails** *(parallel track)* — SET-13 Danger Zone; SET-14 react-email templates
- [ ] **Phase 42: Nyquist Hardening + UAT Triage** *(parallel track)* — VALIDATION.md sweep; ~33 UAT items triaged

## Phase Details

### Phase 32: DEBT-09 notesPublic Fix
**Goal**: Repair the data-loss regression where `addWatch`/`editWatch` never persisted `notesPublic` and never called the correct `revalidatePath`, turning the existing RED scaffold GREEN before the multi-phase schema marathon begins.
**Depends on**: Nothing (independent carryover bugfix; zero catalog dependencies)
**Requirements**: DEBT-09
**Success Criteria** (what must be TRUE):
  1. `tests/actions/watches.notesPublic.test.ts` reaches 4/4 GREEN in CI (was 4/4 FAIL at v4.1 close)
  2. Zod schemas in `src/app/actions/watches.ts` accept `notesPublic: z.boolean().optional()` on both `addWatch` and `editWatch`
  3. Both Server Actions persist `notesPublic` to the database on every write
  4. Both Server Actions call `revalidatePath('/u/[username]', 'layout')` after every successful write
  5. No new test failures introduced; full test suite remains GREEN
**Plans**: 1 plan
Plans:
- [x] 32-01-PLAN.md — Add notesPublic to insertWatchSchema, insert revalidatePath layout calls in addWatch/editWatch, correct ROADMAP wording (D-05), full-suite regression verification

### Phase 33: Discovery Audit
**Goal**: Produce a falsifiable, read-only click-path audit of all discovery surfaces so that every downstream polish phase cites specific audit row IDs rather than vibes.
**Depends on**: Phase 32 (CI must be trustworthy before committing audit findings)
**Requirements**: DISC-10
**Success Criteria** (what must be TRUE):
  1. `.planning/phases/33-discovery-audit/DISCOVERY-AUDIT.md` exists and contains a click-path TABLE (not prose) with one row per `(surface × clickable element)` across `/`, `/explore`, `/u/{user}`, `/catalog/{id}`, `/search`, `/watch/{id}` — each row tagged Live / Dead / Redundant / Missing
  2. Pass/fail criteria are written at the TOP of DISCOVERY-AUDIT.md BEFORE any audit findings appear — the audit is self-falsifiable
  3. A decisions section exists with explicit YES/NO/DEFERRED rows for: "combine home and explore?", lineage browse priority, dead-end closure priority, CAT-13 discovery framing
  4. Every click-path table row has an assigned row ID (e.g., `DISC-AUDIT-01`) that subsequent phases can cite by reference
  5. Zero code, schema, or dependency changes ship in this phase
**Plans**: 4 plans
Plans:
**Wave 1**
- [ ] 33-01-PLAN.md — Wave 0 scaffold: checks/quick.sh + checks/full.sh (D-13 5-rule validator) + 33-DISCOVERY-AUDIT.md skeleton (Pass/Fail @ TOP, Rdio anchor, 8-col table header, 4 decision stubs)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 33-02-PLAN.md — Pass A source-grep enumeration: fill 130–250 candidate rows for all 15 D-05 surface blocks; capture WR-07 wishlist.ts:206 flagship Dead row

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 33-03-PLAN.md — Pass B runtime-gate annotation: walk G-1..G-20, finalize viewer_state column, apply row-splits for G-3/G-4/G-6/G-7/G-12 divergent renderings

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 33-04-PLAN.md — Pass C production browser spot-check (~25–30 high-stakes rows, owner + fresh-account, desktop + mobile) + Pass D author 4 decision verdicts (Q1–Q4 per D-17)

**Cross-cutting constraints:**
- Zero files modified outside .planning/phases/33-discovery-audit/

### Phase 33b: Discovery North-Star Audit
**Goal**: Produce a falsifiable, read-only PRODUCT-framed audit against the SEED-004 Rdio principle — for each user-facing entity (watch detail, collector profile, catalog/family, home/explore feeds, search results), enumerate which discovery vectors should exist, score each as ship/partial/missing, and rank missing vectors by Rdio leverage. Authors the 4 D-17 product decisions deferred from Phase 33 (combine home+explore, lineage browse priority, dead-end closure priority, CAT-13 framing). Backing evidence: Phase 33's DISC-AUDIT-NN click-path rows, referenced by id only.
**Depends on**: Phase 33 (Phase 33's 136-row click-path table is the research substrate; this phase reads but does not modify it)
**Requirements**: DISC-12
**Success Criteria** (what must be TRUE):
  1. `.planning/phases/33b-discovery-north-star-audit/DISCOVERY-NORTH-STAR-AUDIT.md` exists and contains a per-entity drift-vector table — for each entity (watch detail, collector profile, catalog/family, home/explore feeds, search results), one row per (entity × should-have-vector) tagged ship / partial / missing, with each missing row scored for Rdio leverage (high / medium / low)
  2. Pass/fail criteria are written at the TOP of DISCOVERY-NORTH-STAR-AUDIT.md before any findings appear — the audit is self-falsifiable
  3. A decisions section exists with explicit YES/NO/DEFERRED verdicts for the 4 D-17 questions deferred from Phase 33 (combine home+explore, lineage browse priority, dead-end closure priority, CAT-13 framing); each verdict has a 2–4 sentence rationale citing specific north-star findings AND specific DISC-AUDIT-NN backing rows from Phase 33
  4. Every missing-vector row is anchored to the SEED-004 Rdio principle (`.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15) AND cites at least one DISC-AUDIT-NN row from Phase 33 that captures the click-path absence
  5. Zero code, schema, or dependency changes ship in this phase; zero modifications to Phase 33's `33-DISCOVERY-AUDIT.md` (the click-path table is immutable for cross-reference stability)
**Plans**: 3 plans

Plans:
**Wave 1**
- [x] 33b-01-PLAN.md — Wave 0 scaffold: checks/quick.sh, checks/full.sh, audit-doc skeleton with 6 sections + 7-column NSD-13 table header + 4 NSD-16 decision stubs + skeleton sentinel
- [x] 33b-02-PLAN.md — Wave 1 cell population: 42 NSV-NN rows (6 entities × 7 vectors) via 3-pass authoring (status → backing_rows → rationale + leverage); 6 per-entity-block commits; full.sh rules 1-4 green

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 33b-03-PLAN.md — Wave 2 decisions + closeout: 4 D-17 verdicts (Q1 home+explore, Q2 lineage browse, Q3 dead-end closure, Q4 CAT-13 framing) per NSD-16 extended template; flip frontmatter decision: final; update STATE.md; full.sh exit 0

**Cross-cutting constraints:**
- Zero files modified outside .planning/phases/33b-discovery-north-star-audit/

### Phase 34: Layer A — Brand + Family Entities
**Goal**: Add `brands` and `watch_families` as first-class catalog entities with nullable FKs on `watches_catalog`, giving every higher-level hierarchy feature its foundation without touching any existing query path.
**Depends on**: Phase 33b (DISC-12 north-star verdicts must not reveal scope-reducing findings before migration work begins; Phase 33 click-path table is consumed transitively via Phase 33b)
**Requirements**: CAT-15
**Success Criteria** (what must be TRUE):
  1. `brands` and `watch_families` tables exist in production with public-read RLS and service-role-write policies co-located in the migration file
  2. `watches_catalog.brand_id` (nullable FK) and `watches_catalog.family_id` (nullable FK) columns exist; all existing DAL queries return correct results without modification
  3. `has_table_privilege('anon', 'public.brands', 'SELECT')` and `has_table_privilege('anon', 'public.watch_families', 'SELECT')` both return true in production — RLS verified in the deploy runbook
  4. A service-role backfill script exists at `scripts/backfill-catalog-brands.ts` for manual brand/family assignment (no automated migration; no admin UI in this phase)
  5. Three-step migration discipline (nullable column add → backfill → NOT NULL flip) is documented in phase CONTEXT.md; the NOT NULL flip is explicitly deferred
**Plans**: 4 plans

Plans:
**Wave 1**
- [x] 34-01-PLAN.md — Schema layer: src/db/schema.ts brands+watchFamilies+FK columns; drizzle/0007 migration; supabase/20260510000000 authoritative DDL with RLS+GENERATED+assertions; tests/integration/phase34-rls.test.ts (11 tests)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 34-02-PLAN.md — Backfill layer: scripts/backfill-catalog-brands.ts (3-pass derive→patch→link, idempotent); scripts/country.json starter map; package.json db:backfill-catalog-brands entry

**Wave 3** *(blocked on Wave 2 completion; BLOCKING production deploy)*
- [x] 34-03-PLAN.md — Production deploy: supabase db push --linked + drizzle-kit migrate; brand backfill against prod with inline DATABASE_URL override (Footgun T-34-04); 2 checkpoint:human-verify gates [shipped 2026-05-09: 6 brands, 9/9 linked, RLS t/t]

**Wave 4** *(blocked on Wave 3 completion; ran out-of-order BEFORE Wave 3 per user request — runbook in hand for prod push)*
- [x] 34-04-PLAN.md — Deploy runbook: docs/deploy-db-setup.md Phase 34 section (§34.0-§34.7) + local-reset workflow update

**Cross-cutting constraints:**
- ROADMAP success #1/#2/#3 require PRODUCTION state — Wave 3 is BLOCKING; build/typecheck pass without prod push (false-positive verification state)
- Phase 17 D-04/D-06 RLS pattern inherited verbatim (public-read + service-role-write; no INSERT/UPDATE/DELETE policy)
- D-04 permanent denormalization: watches_catalog.brand text NOT NULL stays forever; brand_id is purely the relational link
- watch_families table ships empty in Phase 34 (D-03; family seeding deferred to Phase 35)
- 5 STRIDE threats T-34-01..T-34-05 mapped to plan threat_refs

### Phase 35: Layer B — Lineage Edges + Structured Movement + Era/Material
**Goal**: Add the `watch_lineage_edges` junction table with cycle-safety guarantees, replace the free-text `movement` column with a structured enum, and add era/material/bracelet columns — unblocking the SRCH-16 movement facet.
**Depends on**: Phase 34 (brand/family context needed for meaningful lineage edge data)
**Requirements**: CAT-16
**Success Criteria** (what must be TRUE):
  1. `watch_lineage_edges` table exists with `(predecessor_catalog_id, successor_catalog_id, relationship_type, metadata)` and a BEFORE INSERT trigger that runs a bounded cycle-check query — inserting a self-loop or a cycle through existing edges raises an exception
  2. Every recursive CTE in `src/data/hierarchy.ts` includes both the Postgres 15 `CYCLE` clause AND a depth guard of 10 — both must be present in every `WITH RECURSIVE` query
  3. `getLineageForReference(catalogId)` DAL function exists in `src/data/hierarchy.ts` and returns correct results for a 3-node lineage chain in unit tests
  4. `watches_catalog.movement_type` pgEnum (`auto`, `manual`, `quartz`, `spring_drive`) and `movement_caliber TEXT` columns exist; the old free-text `movement` column is removed or migrated; SRCH-16 can source its facet from `movement_type`
  5. `era` (text), `case_material` (text), `bracelet_config` (text) columns exist on `watches_catalog`; all existing DAL queries return correct results unchanged
**Plans:** 7/7 plans complete

**Wave 0** *(static guard test — Wave 0 dependency from VALIDATION.md)*
- [x] 35-01-PLAN.md — Wave 0 static guard test for hierarchy.ts CTE invariants (gates G1, G2, G3)

**Wave 1** *(TS source-of-truth — independent, no in-phase dependencies)*
- [x] 35-02-PLAN.md — Drizzle schema (3 pgEnums + watchLineageEdges table + column shape changes) + types.ts MovementType realign + WatchEra + Watch.movement optional + constants.ts (MOVEMENT_TYPES + MOVEMENT_LABELS + CASE_MATERIALS_SUGGESTED + BRACELET_CONFIGS_SUGGESTED) + JSON seed files (families.json + lineage-edges.json)

**Wave 2** *(parallel — depends on 35-02; no file overlap between 03 and 04)*
- [x] 35-03-PLAN.md — TS consumer sweep: Zod schema + LLM prompt + shims.ts restructure + WatchForm dropdown rebuild + 4 component fallbacks + 8 test fixture files + DAL movement column rewrite (watches.ts + catalog.ts upsert)
- [x] 35-04-PLAN.md — DAL hierarchy.ts: getLineageForReference recursive CTE with Postgres 15 CYCLE clause + depth<10 guard (server-only); flips Plan 01 vacuous-pass to load-bearing-pass

**Wave 3** *(parallel — depends on 35-02; Plan 06 also depends on 35-04 for runbook references; no file overlap between 05 and 06)*
- [x] 35-05-PLAN.md — Migrations: supabase/migrations/20260510000001_phase35_layer_b.sql (TRUNCATE + 4 CREATE TYPE + ALTER TABLE + CREATE TABLE watch_lineage_edges + cycle trigger + RLS + DO $$ assertions) + drizzle/0008_phase35_layer_b.sql (idempotent twin) + drizzle/meta/_journal.json idx=8 entry
- [x] 35-06-PLAN.md — Backfill scripts (scripts/backfill-catalog-families.ts + scripts/backfill-catalog-lineage.ts) + package.json npm scripts + docs/deploy-db-setup.md Phase 35 section (TRUNCATE warning + 6-step deploy order + smoke tests + cycle-trigger manual smoke)

**Wave 4** *([BLOCKING] production deploy — depends on Waves 2 + 3 complete; autonomous=false)*
- [x] 35-07-PLAN.md — Production deploy: auth.users single-user check → pg_depend pre-flight → `supabase db push --linked` → 4 backfill runs (catalog → brands → families → lineage) → smoke-test SELECTs (G6/G9) → cycle trigger manual smoke (G7); 4 checkpoint:human-verify gates

**Cross-cutting constraints:**
- ROADMAP success #1/#3/#4/#5 require PRODUCTION state — Wave 4 is BLOCKING; build/typecheck pass without prod push (false-positive verification state)
- ROADMAP success #2 satisfied by Wave 0 static guard test (compile-time evidence)
- Phase 17 D-04/D-06 RLS pattern + Phase 34 mirror inherited verbatim (public-read + service-role-write; no INSERT/UPDATE/DELETE policy)
- D-02 prod TRUNCATE: single-user assumption MUST be re-verified in Plan 07 Task 1 (`SELECT count(*) FROM auth.users` returns 1)
- D-03b `pg_depend` pre-flight is BLOCKING gate before `DROP COLUMN movement` commits to prod
- 5 STRIDE threats T-35-01..T-35-05 mapped to plan threat_refs; T-35-01/03/04/05 verified via Plan 07 manual smoke gates G4/G6/G7/G9

### Phase 36: Layer C — Variant Split + Clean-Slate Wipe + CAT-14 NOT NULL
**Goal**: Create the `watch_variants` table, execute the clean-slate catalog DELETE to eliminate fragmented Reference rows, re-link user watches, and flip `watches.catalog_id` to NOT NULL — bundled together because the clean-slate provides the 100% backfill guarantee CAT-14 requires.
**Depends on**: Phase 35 (movement enum and lineage schema must exist before canonical References are re-seeded)
**Requirements**: CAT-17, CAT-14
**Success Criteria** (what must be TRUE):
  1. `watch_variants` table exists with `(catalog_id FK, dial_color, bezel, bracelet_variant)` columns; `watches.variant_id` optional FK added
  2. The 6-step clean-slate runbook is executed in order and each step's verification output is documented in phase CONTEXT.md: (a) export user collection `catalog_id` refs to CSV backup, (b) DELETE fragmented rows from `watches_catalog` (NOT DROP TABLE — preserves pg_cron schedule, RLS policies, and `ON DELETE SET NULL` cascade behavior), (c) re-seed canonical Reference rows via idempotent `npm run db:backfill-catalog`, (d) re-link user watches via existing idempotent backfill (`WHERE catalog_id IS NULL`), (e) verify zero NULLs with `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL` returning 0, (f) proceed to CAT-14 NOT NULL flip
  3. CAT-14 migration begins with a `DO $$ BEGIN ... END $$` pre-flight block asserting zero NULLs as its FIRST statement — the transaction aborts if any NULL exists before the `ALTER COLUMN SET NOT NULL` executes
  4. `watches.catalog_id` is NOT NULL in production schema after this phase
  5. All existing collection-browsing, profile, and verdict flows return correct watch data after the wipe and re-link; no user-visible watch data is lost
**Plans**: 5 plans

Plans:
**Wave 1** *(parallel — schema sources of truth; no file overlap)*
- [x] 36-01-PLAN.md — Drizzle schema edits: add watchVariants pgTable + watches.variantId column in src/db/schema.ts (D-02..D-05). Pitfall 6 .notNull() tightening on watches.catalogId DEFERRED to Phase 38 per Rule 4 — see 36-01-SUMMARY.md and deferred-items.md (18-error DAL-flow cascade outside Plan 01 scope)
- [ ] 36-02-PLAN.md — Supabase migration: write supabase/migrations/20260511000000_phase36_layer_c_variants.sql with DO $$ pre-flight FIRST + CREATE TABLE + RLS + GRANT + variant_id ADD COLUMN + CAT-14 SET NOT NULL + final DO $$ post-assertion (D-02..D-07; ROADMAP success #1/#3/#4)
- [ ] 36-03-PLAN.md — Drizzle migration: write drizzle/0009_phase36_layer_c_variants.sql (idempotent structural twin) + append drizzle/meta/_journal.json idx=9 entry

**Wave 2** *(depends on Waves 1-01/02/03; [BLOCKING] local schema push + integration test)*
- [ ] 36-04-PLAN.md — Local schema push (drizzle-kit push + docker exec psql apply) + write tests/integration/phase36-rls.test.ts (12 it() blocks covering V-01..V-11) + run vitest green + V-12 parity grep

**Wave 3** *(depends on Wave 2; [BLOCKING] prod deploy — autonomous: false)*
- [ ] 36-05-PLAN.md — Append §36 deploy section to docs/deploy-db-setup.md (~150 lines covering §36.0 pg_depend → §36.1 safety backfill → §36.2 zero-NULL verify → §36.3 supabase db push --linked → §36.4 smoke tests → §36.5 hard-fail recovery → §36.6 local re-sync → §36.7 backout) + checkpoint:human-action operator gate for prod deploy

**Cross-cutting constraints:**
- ROADMAP success #4 requires PRODUCTION state — Wave 3 is BLOCKING; build/typecheck pass without prod push (false-positive verification state)
- ROADMAP success #2 reinterpreted: steps (a)(b)(c) inherited from Phase 35 D-02 (TRUNCATE executed 2026-05-10); Phase 36 ships steps (d)(e)(f) only — runbook documents inheritance per D-01
- Phase 17/34/35 RLS+GRANT 4-line block inherited verbatim (public-read + service-role-write; no INSERT/UPDATE/DELETE policy)
- D-07 hard-fail pre-flight: DO $$ MUST be FIRST statement of supabase migration (ROADMAP success #3 verbatim)
- DEBT-12 SKIP decision: drizzle-kit migrate against prod NOT run in Phase 36 (researcher recommendation; supabase db push --linked is sufficient)
- 5 STRIDE threats T-36-01..T-36-05 mapped to plan threat_refs

### Phase 37: Layer D — Provenance Fields + Divestments Table
**Goal**: Add collector-diary provenance columns to `watches` and create the `divestments` table that gives the future recommender a timestamped sold-signal for temporal decay, replacing the insufficient `watches.status = 'sold'` alone.
**Depends on**: Phase 36 (`watches.catalog_id NOT NULL` makes `divestments.catalog_id NOT NULL` meaningful)
**Requirements**: CAT-18
**Success Criteria** (what must be TRUE):
  1. `watches` table gains 7 provenance columns: `serial`, `year_of_acquisition`, `condition`, `box_papers` (chip enum: `none` / `box-only` / `papers-only` / `full-set`), `service_history`, `paid_currency`, `purchase_date` — all nullable; all existing rows unaffected
  2. `divestments` table exists with `(catalog_id NOT NULL, user_id, divested_at, replaced_by_catalog_id, sale_price, notes)` and RLS mirroring `watches` (`auth.uid() = user_id`)
  3. Status transition `owned → sold` in the UI writes a row to `divestments` with `divested_at = NOW()` via a Server Action; `watches.status = 'sold'` remains for UI display purposes
  4. WatchForm edit page shows a collapsed "Collector's Record" disclosure section exposing the 7 provenance fields — collapsed by default with no visual regression on the non-expanded state
  5. Divestment dialog UI (post-status-change "I just sold this watch" flow) is explicitly documented as deferred to v5.x in phase CONTEXT.md
**Plans**: TBD
**UI hint**: yes

### Phase 38: CAT-13 Engine Rewire
**Goal**: Wire `analyzeSimilarity()` to consume catalog taste columns as an additive 9th scoring dimension gated on confidence, making the Phase 19.1 LLM-enrichment investment visible in collection fit verdicts for the first time.
**Depends on**: Phases 34, 35, 36, 37 (all catalog layers must exist; clean-slate ensures high catalog coverage for meaningful taste JOIN results)
**Requirements**: CAT-13
**Success Criteria** (what must be TRUE):
  1. `tests/static/similarity.taste-null.test.ts` is written AND passes BEFORE any change to `src/lib/similarity.ts` — asserts that when `catalogTaste` is null or `confidence < 0.5`, engine output is byte-identical to the pre-rewire baseline
  2. `tests/static/similarity.taste-present.test.ts` is written AND passes BEFORE any change to `src/lib/similarity.ts` — asserts that when `catalogTaste` is present with `confidence >= 0.5`, the engine produces a higher alignment score for taste-compatible watch pairings vs. taste-incompatible pairings (directional assertion)
  3. Both static guard tests continue passing after `similarity.ts` is modified — the rewire satisfies the guards, not just the pre-condition
  4. `Watch` type in `src/lib/types.ts` includes optional `catalogTaste` field; `getWatchesByUser` DAL LEFT JOINs `watches_catalog` to populate `catalogTaste` on each returned Watch object
  5. `tests/static/CollectionFitCard.no-engine.test.ts` import boundary guard remains unchanged and passing; `src/lib/extractors/llm.ts` D-07 byte-lock survives untouched
**Plans**: TBD

### Phase 39: Audit-Driven Discovery Polish
**Goal**: Close specific row IDs from the Phase 33 DISCOVERY-AUDIT.md click-path table and ship the missing drift vectors prioritized by the Phase 33b DISCOVERY-NORTH-STAR-AUDIT.md verdicts — shipping exactly the dead-end fixes and surface improvements the audits identified as highest Rdio leverage.
**Depends on**: Phase 38 (engine rewire needed for improved verdict quality on catalog pages); Phase 33b (DISC-12 north-star verdicts gate all polish scope; Phase 33 DISC-AUDIT-NN row IDs cited as backing data via Phase 33b)
**Requirements**: DISC-09, DISC-11
**Success Criteria** (what must be TRUE):
  1. Every plan in this phase cites EITHER a specific DISC-AUDIT-NN row ID from Phase 33's DISCOVERY-AUDIT.md OR a specific north-star vector from Phase 33b's DISCOVERY-NORTH-STAR-AUDIT.md — no un-cited polish items ship
  2. Phase 33b's DISCOVERY-NORTH-STAR-AUDIT.md missing-vector list has zero high-leverage rows still unaddressed after this phase, OR each remaining high-leverage missing vector carries an explicit DEFERRED annotation with a v5.x target reason
  3. DISC-09 Editorial Featured Collection slot exists on `/explore` — admin-only (owner user_id check) write surface; curator-written blurb; free per SEED-006; detailed UX shaped by Phase 33b north-star verdicts (esp. Q1 combine home+explore)
  4. Each DISC-11 polish item ships as a separate plan within this phase with the DISC-AUDIT-NN row id and/or DISC-12 north-star vector id it closes documented in that plan's CONTEXT.md
  5. Scope is audit-conditional on Phase 33b verdicts: if DISC-12 ranks a missing vector as low-leverage or DEFERRED, no work ships for that vector in v5.0
**Plans**: TBD (scope pending Phase 33b DISCOVERY-NORTH-STAR-AUDIT.md)
**UI hint**: yes

### Phase 40: Search & Verdict Polish
**Goal**: Add three faceted filters to the `/search` Watches tab and ship the pairwise drill-down section in CollectionFitCard, giving collectors taste-aware search refinement and side-by-side comparison.
**Depends on**: Phase 35 (SRCH-16 hard-blocked on `movement_type` enum from Layer B), Phase 38 (FIT-05 verdict quality best after engine rewire populates taste dimensions)
**Requirements**: SRCH-16, FIT-05
**Success Criteria** (what must be TRUE):
  1. `/search` Watches tab has three faceted filters: Movement Type chip group (`auto` / `manual` / `quartz` / `spring_drive` from `watches_catalog.movement_type`), Case Size chip group (pre-defined size bands from `case_size_mm`), Style multi-select chip group (from `style_tags`) — all filters narrow results without a full page reload
  2. On mobile, facet controls appear in a bottom-sheet / drawer pattern (not a sidebar); filter state round-trips through URL params for shareability
  3. CollectionFitCard accordion gains a "Compare with the [X] you own" pairwise drill-down section — two-column layout (max 2 items on mobile per NN/Group pattern) showing only taste-relevant dimensions, with a delta row at the bottom summarizing the key taste difference
  4. SRCH-16 facets use the `movement_type` pgEnum column from Phase 35, not the deprecated free-text `movement` column — a test asserts the DAL query references `movement_type`
  5. If Phase 35 (Layer B) slipped, SRCH-16 does not ship in this phase — the dependency is enforced with an explicit v5.x deferral note in phase CONTEXT.md
**Plans**: TBD
**UI hint**: yes

### Phase 41: Account Danger Zone + Branded Auth Emails *(parallel track)*
**Goal**: Ship the two Danger Zone account actions (Wipe Collection, Delete Account) and three branded Horlo auth email templates — both fully independent of the catalog hierarchy serial spine.
**Depends on**: Phase 22 (Settings Account tab — shipped v4.0), Phase 21 (Resend SMTP — shipped v4.0). Independent of Phases 33–40; runs concurrently with any Phase 34+ serial work.
**Parallel track note**: Numbered Phase 41 for ROADMAP.md tracking. Actual execution is concurrent with the serial spine — plan and execute this phase while any Layer A-D phase is in progress.
**Requirements**: SET-13, SET-14
**Success Criteria** (what must be TRUE):
  1. `/settings#account` Danger Zone section exposes two distinct actions: "Wipe Collection" (deletes all `watches` + `wear_events` + `wear-photos/{userId}/` storage files; preserves account, profile, follows) and "Delete Account" (full hard delete via `supabase.auth.admin.deleteUser()`) — both require a type-to-confirm input + Phase 22 password re-auth + multi-step modal
  2. Storage `wear-photos/{userId}/` files are explicitly purged BEFORE the database delete in the Delete Account flow — no orphaned storage objects remain post-deletion
  3. The cascade behavior of Account Delete on `notifications.actor_id` rows for other users is documented with a UX note in phase CONTEXT.md
  4. Three Supabase Auth email templates (Confirm signup, Reset Password, Change Email) are rebranded: 600px single-column HTML, Horlo header logo, brand color, single CTA button — built with `react-email` 6.1.1 + `@react-email/components`; cross-client verified on Apple Mail iOS dark mode + Outlook MSO conditional + Gmail web
  5. Existing Resend SMTP at `mail.horlo.app` and DKIM signature are unaffected — template changes are HTML content only pasted into Supabase Auth dashboard; no Next.js code change ships for the email templates themselves
**Plans**: TBD
**UI hint**: yes

### Phase 42: Nyquist Hardening Sweep + UAT Triage *(parallel track)*
**Goal**: Retroactively bring v4.1 and v4.0 phases to Nyquist compliance and triage all ~33 deferred UAT items to explicit CLOSED / SUPERSEDED / DEFERRED states.
**Depends on**: Phase 39 (audit-driven polish must ship before UAT triage — many UAT items touch surfaces v5.0 polish changes). Independent of catalog schema; runs concurrently with Phase 40 once Phase 39 is complete.
**Parallel track note**: Numbered Phase 42 for ROADMAP.md tracking. Actual execution begins after Phase 39 completes and can overlap with Phase 40.
**Requirements**: DEBT-10, DEBT-11
**Success Criteria** (what must be TRUE):
  1. VALIDATION.md files exist for Phases 25 and 26 (currently missing); VALIDATION.md files for Phases 27, 28, 30, 31 are upgraded from `partial` to `nyquist_compliant: true` + `wave_0_complete: true`
  2. Phase 30 aspect-ratio / object-fit VALIDATION.md contains CSS chain assertions using computed styles (not class names) — assertions that would have caught the `h-full` hotfix regression per the v4.1 feedback memory
  3. All ~33 deferred human UAT items across v4.0 Phases 18 / 20 / 20.1 / 22 / 23 are triaged: each item is CLOSED (UAT run and passed), SUPERSEDED (overtaken by later phase work — citing the superseding phase), or DEFERRED (carry to v5.x with an explicit reason)
  4. Triage output exists as a closure table in phase CONTEXT.md — each row has: item description, original phase, disposition (CLOSED / SUPERSEDED / DEFERRED), resolution note
  5. No new test failures introduced; all new assertions use computed-style checks, not class-name checks
**Plans**: TBD

---

## Progress

**Execution Order:**
Serial spine: 32 → 33 → 34 → 35 → 36 → 37 → 38 → 39 → 40
Parallel tracks: 41 (alongside 34–40), 42 (alongside 40, after 39)

| Milestone | Phases | Plans Complete | Status | Completed |
|-----------|--------|----------------|--------|-----------|
| v1.0 MVP | 1-5 | 26/26 | ✅ Complete | 2026-04-19 |
| v2.0 Taste Network Foundation | 6-10 | 21/21 | ✅ Complete | 2026-04-22 |
| v3.0 Production Nav & Daily Wear Loop | 11-16 + 999.1 | 37/37 | ✅ Complete | 2026-04-27 |
| v4.0 Discovery & Polish | 17-26 + 19.1 + 20.1 | 65/65 | ✅ Complete | 2026-05-03 |
| v4.1 Polish & Patch | 27-31 | 21/21 | ✅ Complete | 2026-05-05 |
| v5.0 Discovery North Star | 32-42 | 0/? | 🚧 In progress | — |
| v6.0 Market Value | TBD | — | 📋 Planted | — |

### v5.0 Phase Detail

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 32. DEBT-09 notesPublic Fix | 0/? | Not started | - |
| 33. Discovery Audit | 0/? | Not started | - |
| 34. Layer A — Brand + Family | 3/4 (Wave 4 ran out-of-order; Wave 3 prod push pending) | In progress | - |
| 35. Layer B — Lineage + Movement | 7/7 | Complete    | 2026-05-10 |
| 36. Layer C — Variants + Clean-Slate | 0/5 | Planned (ready to execute) | - |
| 37. Layer D — Provenance + Divestments | 0/? | Not started | - |
| 38. CAT-13 Engine Rewire | 0/? | Not started | - |
| 39. Audit-Driven Discovery Polish | 0/? | Not started | - |
| 40. Search & Verdict Polish | 0/? | Not started | - |
| 41. Account Danger Zone + Branded Emails *(parallel)* | 0/? | Not started | - |
| 42. Nyquist Hardening + UAT Triage *(parallel)* | 0/? | Not started | - |

---

## Requirement Coverage — v5.0

| REQ-ID | Phase | Description |
|--------|-------|-------------|
| DEBT-09 | 32 | notesPublic regression fix (addWatch / editWatch) |
| DISC-10 | 33 | Discovery audit — click-path table + decisions doc |
| CAT-15 | 34 | Layer A: Brand + Family entities |
| CAT-16 | 35 | Layer B: Lineage edges + structured movement + era/material |
| CAT-17 | 36 | Layer C: Variant split + clean-slate DELETE wipe |
| CAT-14 | 36 | SET NOT NULL on watches.catalog_id (bundled with CAT-17) |
| CAT-18 | 37 | Layer D: Provenance fields + divestments table |
| CAT-13 | 38 | Engine rewire — catalog taste as 9th similarity dimension |
| DISC-09 | 39 | Editorial Featured Collection slot on /explore |
| DISC-11 | 39 | Audit-driven discovery surface polish (closes DISC-AUDIT row IDs) |
| SRCH-16 | 40 | Search facets: Movement / Case Size / Style |
| FIT-05 | 40 | CollectionFitCard pairwise drill-down |
| SET-13 | 41 | Account Danger Zone (Wipe Collection + Delete Account) |
| SET-14 | 41 | Branded auth email templates (react-email) |
| DEBT-10 | 42 | Nyquist hardening sweep (v4.0 / v4.1 phases) |
| DEBT-11 | 42 | UAT triage (~33 deferred items) |

**Coverage: 16/16 v5.0 requirements mapped. No orphans.**

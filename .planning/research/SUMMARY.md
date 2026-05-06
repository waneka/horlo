# Project Research Summary

**Project:** Horlo v5.0 Discovery North Star
**Domain:** Catalog hierarchy migration + engine rewire + audit-driven discovery polish
**Researched:** 2026-05-06
**Confidence:** HIGH (stack + architecture from first-party codebase; features from SEED documents; pitfalls from historical milestone audits)

---

## Executive Summary

v5.0 is a milestone with a clear organizing principle (Rdio-style click-driven discovery) and a hard structural job to do (4-layer catalog hierarchy enabling Reference-granularity for the future recommender). The research consensus across all four files is that the milestone's core risk is build-order error — schema layers have strict dependencies, the engine rewire has a documented byte-lock to migrate correctly, and the discovery audit must happen before any polish work or the polish will be premature. The stack is already correct for all planned work; no major library additions are required (only a dev-dependency pair for DB-layer tests and a React Email stack deferred to the SET-14 phase).

The recommended approach is a serial spine with intentional parallelism lanes. The spine is: audit → Layer A → Layer B → Layer C + CAT-14 → Layer D / CAT-13 → audit-driven polish. The parallelism opportunities are real and significant: DEBT-09, SET-13, SET-14, and the Nyquist sweep are all fully independent of the catalog hierarchy and can be executed concurrently with any Layer A through D phase as separate plans within a phase. This gives the milestone two tracks — catalog/engine (serial) and carryover/polish (parallel) — that merge only at audit-driven polish, where the engine's verdict quality is needed.

The most consequential unresolved dependency in the milestone is SRCH-16's hard block on Layer B. If Layer B slips (lineage + movement enum), SRCH-16 (search facets) cannot ship meaningfully — the Movement facet requires a clean enum, not the current free-text column. This is the single highest-stakes internal dependency to track. The `divestments` table (independently corroborated by both ARCHITECTURE and PITFALLS) is the right data model for the sold signal; `watches.status = 'sold'` alone is insufficient for SEED-002's temporal decay requirement. Both findings carry HIGH confidence because they derive from independent analyses of the same first-party schema and seed documents.

---

## Key Findings

### Recommended Stack

The existing stack handles all v5.0 work without major additions. Drizzle 0.45.2 supports self-referencing FKs via the `AnyPgColumn` callback pattern (confirmed in official docs) and is sufficient for all 4 hierarchy layers. The one confirmed Drizzle limitation is WITH RECURSIVE — it is not natively supported; all lineage CTE queries must use `db.execute(sql\`WITH RECURSIVE...\`)` raw SQL, which is already an established pattern in the codebase.

Three additions are warranted: bump `@anthropic-ai/sdk` to `^0.94.0` (current; the `claude-sonnet-4-20250514` snapshot ID in old comments is deprecated June 15, 2026 but the codebase already uses the correct `claude-sonnet-4-6` alias); add `@electric-sql/pglite` + `@praha/drizzle-factory` as dev dependencies for DB-layer hierarchy tests (no Docker, no external Postgres); defer `react-email`, `@react-email/components`, and `resend` until the SET-14 phase starts. `pg_trgm` (already available as a Supabase extension) handles variant dedup without any npm library.

**Core technologies (v5.0 additions/changes):**
- `@anthropic-ai/sdk ^0.94.0` — bump from ^0.88.0; keep `claude-sonnet-4-6` model string
- `@electric-sql/pglite 0.4.5` + `@praha/drizzle-factory 1.4.2` — dev-only, DB-layer hierarchy tests
- `react-email 6.1.1` + `@react-email/components 1.0.12` + `resend` — defer until SET-14 phase
- `pg_trgm` Postgres extension — enable for variant dedup; no npm package
- Drizzle `db.execute(sql\`WITH RECURSIVE...\`)` — lineage traversal pattern; no new library

**Do not add:** `pg-format`, `fuse.js`/`fuzzysort`, Stripe/entitlements, Hotjar/Mixpanel, Maizzle, `drizzle-seeder`/`knex`.

### Expected Features

The feature set is well-defined across four categories. Priority 1 features ship in the core wave; Priority 2 after P1 blockers clear; Priority 3 late or deferred to v5.x.

**Must have (table stakes for v5.0):**
- DEBT-09 notesPublic + revalidatePath regression fix — data loss bug with a RED test scaffold already in place (4/4 FAIL)
- Discovery audit with falsifiable click-path table and decisions doc — required by SEED-004; shapes all polish phases
- Layer A: Brand + Family entities (schema only, additive) — foundation for every higher-level feature
- Layer B: Lineage edges + structured movement enum + era/material/bracelet — unblocks SRCH-16 and improves FIT-05 quality
- CAT-13 engine rewire — Phase 19.1 taste columns are wasted until the engine reads them at JOIN time
- Layer C: Variant split + clean-slate DB wipe — fixes Reference fragmentation; enables CAT-14
- Audit-driven surface polish — dead-end closures shaped by audit findings
- SET-14 branded auth emails — default Supabase emails signal unfinished product
- SET-13 Account Delete / Wipe Collection (Danger Zone) — table-stakes SaaS account management

**Should have (v5.0 differentiators):**
- FIT-05 pairwise drill-down inside CollectionFitCard — taste-delta between evaluated watch and most-similar owned watch; no analogue in any watch marketplace
- SRCH-16 search facets (Movement / Case size / Style) — blocked on Layer B; defer if Layer B slips
- DISC-09 editorial featured collection on /explore — Letterboxd-style human-curated slot
- Layer D provenance fields + divestments table — collector diary on watches + SEED-002 prerequisite schema
- CAT-14 SET NOT NULL on watches.catalog_id — enabled by clean-slate; closes Phase 17 deferred constraint

**Defer to v5.x or v6.0:**
- Nyquist hardening sweep — late-milestone cleanup; closes 4/5 partial from v4.1
- ~33 deferred UAT items — triage after audit-driven polish lands (many will be overtaken)
- Recommender (SEED-002), onboarding (SEED-003), market value (SEED-005) — wrong milestone

**Anti-features — what v5.0 must NOT do:**
- No paywall, no Subscription tab, no Stripe, no entitlements scaffolding (SEED-006 resolved)
- No home+explore merger decided before the audit runs (SEED-004 explicit prohibition)
- No automated lineage inference from reference numbers (will produce wrong edges)
- No exhaustive variant enumeration at catalog seeding time (fragments Reference-level social graph)
- No recommender / personalized explore rails (SEED-002 prereqs unmet)
- No onboarding flow (pairs with recommender, not discovery)
- No market value / portfolio valuation (v6.0, SEED-005)
- No full admin CMS for DISC-09 editorial slot (infrequent cadence; minimal admin form is correct)
- No N-way watch comparison in FIT-05 (pairwise only; cognitive load compounds)
- No sidebar facets in SRCH-16 (drawer/modal is the collector-app pattern)
- No slider for case size filter (pre-defined chip group is faster on mobile)
- No wipe + delete as a single button in SET-13 (keep them separate with distinct confirms)
- No marketing content in SET-14 auth emails (transactional emails have one job)

### Architecture Approach

The existing architecture does not change in v5.0. The work is vertical extension (new tables below `watches_catalog`) and horizontal extension (new columns on existing tables). The FK chain is `brands → watch_families → watches_catalog → watch_variants` with `watch_lineage_edges` as a junction table for the lineage DAG. `watches` (per-user Individual level) retains `catalog_id` as its primary FK to `watches_catalog` (Reference level); `variant_id` is an optional secondary FK added in Layer C. The `divestments` table is per-user (mirrors `watches` RLS) and is separate from `watches` — never a status extension.

**Major components (v5.0 additions):**
1. `src/db/schema.ts` — add `brands`, `watch_families`, `watch_variants`, `watch_lineage_edges`, `divestments` tables; extend `watches_catalog` and `watches` with Layer A/B/C/D columns
2. `src/data/hierarchy.ts` (new DAL) — `getLineageForReference(catalogId)` via recursive CTE, `getBrandById`, `getFamilyById`, `getReferencesForFamily`
3. `src/lib/similarity.ts` (CAT-13 rewire) — add optional `catalogTaste` field consumption with confidence gate at 0.5; additive 9th dimension; byte-lock explicitly migrated
4. `src/data/watches.ts` (CAT-13 DAL change) — `getWatchesByUser` LEFT JOINs `watches_catalog` to populate `catalogTaste` on each Watch object
5. Cache tag matrix (new) — `'catalog:brand:{brandId}'`, `'catalog:family:{familyId}'`, `'catalog:reference:{catalogId}'`, `'catalog:lineage:{catalogId}'`; only reference tag needed immediately; brand/family tags when browse pages ship

**What stays unchanged:**
- `src/lib/extractors/llm.ts` — D-07 byte-lock survives CAT-13 intact
- `src/app/api/extract-watch/route.ts` — catalog upsert path unchanged; brand_id/family_id remain null until admin backfill
- `src/data/discovery.ts` — explore rails read flat `watches_catalog`; no hierarchy needed until family browse pages ship
- `tests/static/CollectionFitCard.no-engine.test.ts` — static guard survives; CAT-13 moves computation server-side, which strengthens the rationale for the test

**RLS pattern for new tables:** All hierarchy tables (`brands`, `watch_families`, `watch_variants`, `watch_lineage_edges`) follow `watches_catalog` pattern: public read, service-role write only. `divestments` follows `watches` pattern: `auth.uid() = user_id` for all operations. RLS migration must be co-located with DDL in each Layer's migration file — Drizzle does NOT emit RLS policies.

### Critical Pitfalls

1. **CP-03: Clean-slate wipe orphans user watches** — `watches.catalog_id` uses `ON DELETE SET NULL`, so deleting catalog rows silently NULLs out FKs without deleting the user's watches. Prevention: follow the exact 6-step re-link sequence (export watches CSV backup → DELETE catalog rows, never DROP TABLE → verify NULL count → re-link backfill → verify zero NULLs → then and only then proceed to CAT-14). MiP-01 reinforces: do not DROP and re-create `watches_catalog`; the pg_cron function references the table OID.

2. **CP-02: CAT-13 engine rewire silently breaks the byte-lock invariant** — the existing static guard tests import boundaries, not behavioral correctness. The NULL-confidence fallback path (when catalog taste is absent) has no test. Prevention: add `tests/static/similarity.taste-null.test.ts` (snapshot assert: NULL catalogTaste → byte-identical outputs to pre-rewire baseline) and `tests/static/similarity.taste-present.test.ts` (directional assert: high-confidence formal taste + formal preferences → higher alignment score) before touching `similarity.ts`.

3. **CP-04: Lineage CTE infinite recursion** — even one cycle in `watch_lineage_edges` causes a WITH RECURSIVE query to hang (surfaces as an RSC stream that never closes, not a thrown error — hard to debug). Prevention: `CHECK (predecessor_id != successor_id)` constraint at schema creation; BEFORE INSERT trigger that runs a bounded cycle-check query; use Postgres 15 `CYCLE` clause on all recursive CTEs in DAL code; depth limit of 10 in all lineage queries.

4. **MP-01: RLS policies omitted on new hierarchy tables** — Drizzle does not emit `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` or `CREATE POLICY` statements. New tables land without RLS in prod (local dev works; prod fails with 403/empty). Prevention: every Layer A/B/C migration file must include the RLS block for each new table; verify with `has_table_privilege('anon', 'public.brands', 'SELECT')` in the deploy runbook.

5. **MP-02 / CP-06 pair: `watches.status = 'sold'` is insufficient for SEED-002 + CAT-14 applied before zero-NULL verification** — using `sold` status alone loses the `sold_at` timestamp required for temporal decay in the recommender's negative signal. The `divestments` table is necessary (independently corroborated by ARCHITECTURE and PITFALLS). CAT-14 must include a DO $$ pre-flight assertion as its FIRST migration statement; any NULL remaining at flip time aborts the migration.

---

## Implications for Roadmap

### RESOLVED: Phase-Ordering Conflict

**Position: DEBT-09 fix as Phase 32 (first), discovery audit as Phase 33 (second).**

Three positions existed in the research:
- PITFALLS: DEBT-09 as Phase 32 (clears RED scaffold for clean CI before schema work)
- ARCHITECTURE: audit as Phase 32 (SEED-004 audit-first is non-negotiable)
- FEATURES: hybrid (DEBT-09 first, then audit)

**Synthesis favors the hybrid (FEATURES position), with this rationale:**

SEED-004's audit-first directive means "audit before discovery polish and schema work," not "audit as the literal first commit of the milestone." DEBT-09 is a carryover data-loss bug (HIGH severity) with a RED test scaffold already in the repo that is blocking CI confidence. Running DEBT-09 first takes one small phase to make the test suite truthful before the milestone's complex work begins. The audit is NOT blocked by DEBT-09 — the audit is read-only and reads existing app surfaces. DEBT-09 is independent of all schema layers (no catalog dependencies, no hierarchy assumptions). Doing it first costs nothing in schema sequencing, costs nothing in audit quality, and buys green CI for the 8-phase schema marathon that follows.

The audit as Phase 33 is non-negotiable. The audit's click-path table and decisions doc gate all audit-driven polish phases. Do not write implementation plans for discovery polish before the audit document is committed.

---

### Suggested Phase Sequence (Phase 32 onward)

#### SERIAL SPINE

##### Phase 32: DEBT-09 Fix
**Rationale:** Carryover data-loss bug with a RED scaffold (4/4 FAIL). Clearing it first makes CI trustworthy before the multi-phase schema marathon. Independent of all catalog work — zero sequencing cost.
**Delivers:** `notesPublic` persists through `addWatch`/`editWatch` Zod schemas; `revalidatePath('/u/[username]/[tab]')` called on every watch mutation; 4/4 tests GREEN.
**Avoids:** MP-05 (same commit-never-reached-main failure mode that created the debt)
**Research flag:** None — straightforward fix; RED scaffold specifies exactly what to do.

##### Phase 33: Discovery Audit (read-only)
**Rationale:** SEED-004 audit-first mandate. Audit findings may reduce or expand Layer B scope (if audit shows lineage browse is low-priority, lineage edges can be deferred to v6.0). No implementation, no schema.
**Delivers:** `.planning/research/DISCOVERY-AUDIT.md` with (1) click-path table for all 6 surfaces (`/`, `/explore`, `/u/{user}`, `/catalog/{id}`, `/search`, `/watch/{id}`), (2) decisions doc with falsifiable YES/NO/DEFERRED rows per decision (including "combine home + explore?" and "lineage browse urgency"). Subsequent phases cite decisions doc by row ID.
**Avoids:** MP-06 (vibes-check conclusions); MiP-03 (pre-decided merge outcome — answer must emerge from evidence)
**Research flag:** None — read-only exercise; no external research needed.

##### Phase 34: Layer A — Brand + Family entities
**Rationale:** Foundation. Every higher-level feature requires Brand and Family as first-class entities. Additive — no UI, no DAL rewrites, no hot-path changes. Admin backfill assigns brand_id/family_id separately from the migration.
**Delivers:** `brands` + `watch_families` tables; nullable `brand_id` + `family_id` FKs on `watches_catalog`; RLS co-located in migration; backfill script; types extended.
**Avoids:** CP-01 (backfill order: brands → families → family_id → brand_id; DO $$ pre-flight before any NOT NULL flip); MP-01 (RLS in same migration file); MP-03 (cache tag naming convention defined before mutations are written)
**Research flag:** None — standard Drizzle AnyPgColumn pattern confirmed in official docs.

##### Phase 35: Layer B — Lineage edges + structured movement + era/material/bracelet
**Rationale:** Unblocks SRCH-16 (the milestone's most consequential internal dependency). Movement facet requires `movement_type` enum; free-text column produces unreliable facets. `watch_lineage_edges` table creation is independent of brand seeding but data seeding is only meaningful after brands/families exist.
**Delivers:** `watch_lineage_edges` junction table with cycle-guard BEFORE INSERT trigger + CYCLE clause; `movement_type` pgEnum + `movement_caliber` on `watches_catalog`; `era`, `case_material`, `bracelet_config` columns; `src/data/hierarchy.ts` DAL with `getLineageForReference()` recursive CTE.
**Avoids:** CP-04 (lineage cycles via trigger + CYCLE clause + depth-10 guard); MP-01 (RLS on `watch_lineage_edges`)
**Key open question:** Does Phase 33's audit decisions doc mark "lineage browse urgency: DEFER"? If so, the table still ships (schema cost is low) but browse UI affordances move to a later phase. Phase 35 plan must be written as schema-only with browse UI as an audit-conditional addition.
**Research flag:** None — recursive CTE via raw SQL confirmed; cycle prevention patterns confirmed.

##### Phase 36: Layer C — Variant split + clean-slate DB wipe + CAT-14 SET NOT NULL
**Rationale:** Fixes Reference fragmentation. Clean-slate is safe (single-user, owner consents). CAT-14 follows in the same phase because clean-slate provides the 100% backfill guarantee needed — do not separate them.
**Delivers:** `watch_variants` table; clean-slate executed per exact 6-step sequence (backup → DELETE not DROP → re-link → verify zero NULLs → CAT-14 DO $$ pre-flight → NOT NULL flip); admin merge endpoint for dedup; weekly fragmentation linter; `watches.variant_id` optional FK.
**Avoids:** CP-03 (wipe safety: DELETE not DROP; re-link before CAT-14); CP-05 (dedup creep via linter + merge endpoint); CP-06 (CAT-14 DO $$ pre-flight as first statement); MP-04 (confidence-based taste adoption on merge); MiP-01 (DELETE rows, not DROP TABLE, to preserve pg_cron OID)
**Research flag:** Operational risk — phase plan must include exact runbook steps as success criteria. CONTEXT.md must document owner consent to wipe explicitly.

##### Phase 37: Layer D — Provenance fields + divestments table
**Rationale:** SEED-002 prerequisite schema. The recommender needs `sold_at` timestamp for temporal decay; `watches.status = 'sold'` alone cannot provide this. `divestments` table is the correct architecture (independently corroborated by ARCHITECTURE and PITFALLS — HIGH confidence). Divestment dialog UI is optional; schema is the hard requirement.
**Delivers:** 5 provenance columns on `watches`; `divestments` table with `user_id`, `catalog_id NOT NULL`, `sold_at`, `divestment_type` enum, `replaced_by_catalog_id`; `divestWatch` Server Action; RLS mirroring `watches`; optional provenance section in WatchForm (collapsed by default).
**Avoids:** MP-02 (divestments vs status-only — `watches.status = 'sold'` stays as transitional UI state; recommender reads `divestments`)
**Note:** Can be parallelized with Phase 38 if split into separate plans — provenance columns on `watches` do not interact with the engine rewire.

##### Phase 38: CAT-13 Engine Rewire
**Rationale:** Phase 19.1 taste columns are wasted until the engine reads them at JOIN time. Should come after Layer C (clean-slate ensures high catalog coverage). Audit-driven polish phases that need improved verdict quality depend on this phase shipping first.
**Delivers:** `Watch` type extended with optional `catalogTaste`; `getWatchesByUser` DAL LEFT JOINs `watches_catalog` for taste columns; `analyzeSimilarity()` extended with additive 9th taste dimension + confidence gate at 0.5; `tests/static/similarity.taste-null.test.ts` snapshot guard; `tests/static/similarity.taste-present.test.ts` directional guard; byte-lock language updated in CONTEXT.md.
**Avoids:** CP-02 (static guards written before touching similarity.ts; NULL-confidence fallback path tested); MiP-04 (D-07 on extractWithLlm untouched — rewire is entirely within similarity.ts and the server-side verdict composition layer)
**Research flag:** Moderate attention — write the two static guard tests as the first deliverable in the phase, before any changes to similarity.ts.

##### Phase 39: Audit-Driven Discovery Polish
**Rationale:** Closes specific items from the DISCOVERY-AUDIT.md decisions table by row ID. DISC-09 editorial featured collection may fold into this phase or stand alone.
**Delivers:** Every DISC-AUDIT decision row marked CLOSED with a specific commit; dead-end pages get forward navigation affordances; home/explore consolidation or differentiation per audit evidence; DISC-09 editorial slot if audit confirms it belongs here.
**Avoids:** Building before the audit decides; un-citable polish decisions
**Research flag:** Scope is unknown until Phase 33 delivers. Do not write a detailed plan until DISCOVERY-AUDIT.md decisions doc exists.

##### Phase 40: Discovery Feature Wave (SRCH-16 + FIT-05)
**Rationale:** SRCH-16 is hard-blocked on Layer B (Phase 35). FIT-05 should ship after CAT-13 (Phase 38) for populated taste-attribute rows. These features can share a phase or split if complexity warrants.
**Delivers:** SRCH-16: filter drawer on /search Watches tab with Movement chips, case-size chip group, style multi-select; facet state in URL params; DAL updated. FIT-05: pairwise comparison sub-component in CollectionFitCard; taste-attribute delta rows; accordion expansion state.
**Avoids:** SRCH-16 against free-text movement column; sidebar facets; N-way comparison; slider for case size

---

#### PARALLEL TRACK (run alongside serial spine at any Phase 34+ point)

##### Phase P1: SET-13 + SET-14 (Account Danger Zone + Branded Emails)
**Rationale:** Both are fully independent of catalog hierarchy. SET-13 requires existing Settings Account tab (Phase 22, shipped). SET-14 requires existing Resend SMTP (Phase 21, shipped). Can be written and shipped while any Layer A-D phase is in progress.
**Delivers:** SET-13: Danger Zone section with Wipe Collection (two-step confirm) + Delete Account (three-step: confirm → Storage bucket purge → cascade delete); service-role `deleteAccount` and `wipeCollection` Server Actions; profile cache revalidated post-deletion. SET-14: three branded HTML email templates (confirm signup, reset password, change email) using react-email; table-based layout; prefers-color-scheme dark mode media query.
**Avoids:** MP-08 (cascade map in CONTEXT.md; Storage orphan cleanup before users row deletion); MP-09 (table layout not flexbox; DKIM unaffected by template changes); wipe+delete as single button; marketing content in auth emails

##### Phase P2: Nyquist Hardening Sweep + UAT Triage
**Rationale:** Documentation and test additions; best as a late-milestone sweep after audit-driven polish lands (many UAT items touch surfaces v5.0 polish will change).
**Delivers:** VALIDATION.md for Phases 25 + 26 (currently missing); upgraded wave_0 assertions for Phases 27/28/30/31 (partial); CSS chain assertions for aspect-ratio/object-fit phases; UAT triage: ~33 items marked RESOLVED / STILL OPEN / SUPERSEDED.
**Avoids:** MP-07 (CSS chain blind spot — assert computed styles, not class names; Phase 30 h-full hotfix must be asserted in VALIDATION.md wave_0)

---

### Phase Ordering Rationale

- **DEBT-09 before audit:** RED scaffold is blocking CI confidence; independent of all schema work; zero sequencing cost; aligns with FEATURES hybrid position and resolves the three-way conflict.
- **Audit before all schema work:** SEED-004 mandate; audit findings may reduce Layer B scope; cannot plan Phase 39 until Phase 33 delivers.
- **Layer A before Layer B:** `watch_families` has FK to `brands`; lineage edge data needs brand/family context; `watch_lineage_edges` table can be created but edges are meaningless without branded Reference rows.
- **Layer B before SRCH-16:** Most consequential internal dependency. Movement facet against free-text column produces unreliable results. Hard enforce this sequence.
- **Layer C + CAT-14 together:** Clean-slate provides the 100% backfill guarantee; collapsing them removes the "two consecutive deploys" gate; single-user context makes this safe.
- **CAT-13 after Layer C:** High catalog coverage means LEFT JOIN taste columns are populated for most watches; pre-clean-slate rewire produces minimal verdict improvement.
- **CAT-13 before audit-driven polish that needs improved verdicts:** If Phase 33 finds "catalog page verdicts are weak," the polish phases need the rewired engine.
- **DEBT-09 / SET-13 / SET-14 / Nyquist as parallel track:** All are fully independent; no hierarchy dependencies; use to keep milestone moving while serial spine phases are in progress.

---

### Key Open Questions That Block Planning

These must be resolved before detailed phase plans are written for the affected phases:

1. **Admin write surface for hierarchy (affects Phase 34 scope):** Who writes Brand and Family rows in a single-user Supabase app? Options: (a) service-role scripts only — no UI, (b) owner-only admin route at `/admin/catalog`, (c) hardcoded seed script run at deploy time. Recommendation: service-role admin scripts for v5.0; admin UI is a v5.x item. The choice determines whether Phase 34 needs any UI component.

2. **Lineage browse UX scope (audit-conditional, affects Phase 35 + 39):** Phase 33 may de-prioritize lineage browse. `watch_lineage_edges` table still lands as schema-only (low cost). Browse UI affordances (predecessor/successor navigation on `/catalog/[id]`) are audit-conditional and may move to Phase 39 or v6.0. Phase 35 plan must be written as schema-only with browse UI flagged as an audit-conditional addition.

3. **Divestment dialog UI in/out of v5.0 (affects Phase 37 scope):** `divestments` schema is non-negotiable. The "I just sold this watch" follow-on dialog after status change is optional for v5.0. Decide at Phase 37 planning: schema-only or schema + dialog UI.

4. **"Admin" semantics in single-user Supabase (affects all admin write operations):** Supabase auto-grants EXECUTE to anon/authenticated/service_role on public-schema functions (per MEMORY project_supabase_secdef_grants.md). All hierarchy write operations must use the service-role client (not user session client). The `deleteAccount` Server Action pattern in SET-13 is the correct template.

5. **DISC-09 scope relative to audit findings (affects Phase 39 planning):** DISC-09 is MEDIUM priority. If Phase 33 finds `/explore` already has sufficient depth, DISC-09 may fold into Phase 39 or defer to v5.x. Do not write a detailed DISC-09 plan before Phase 33 ships.

---

### Research Flags

**Phases needing closer attention during planning:**
- **Phase 36 (Layer C clean-slate):** Highest operational risk in the milestone. Phase plan must include exact 6-step runbook as success criteria, not prose. CONTEXT.md must document owner consent to wipe explicitly.
- **Phase 38 (CAT-13 engine rewire):** Write the two static guard tests before touching similarity.ts. Confirm baseline test labels produce expected outputs before the rewire. The byte-lock migration is intentional — update the lock language in CONTEXT.md.
- **Phase 39 (audit-driven polish):** Do not plan until DISCOVERY-AUDIT.md decisions doc is committed. Roadmapper should mark this phase "Scope TBD — pending Phase 33."

**Phases with standard patterns (research not needed during planning):**
- **Phase 32 (DEBT-09):** RED scaffold defines the work. Standard Zod schema extension + revalidatePath call.
- **Phase 33 (discovery audit):** Read-only documentation. No code, no schema, no external research.
- **Phase 34 (Layer A):** Standard Drizzle additive migration; AnyPgColumn pattern confirmed.
- **Phase 35 (Layer B):** Standard Drizzle schema + raw SQL recursive CTE; cycle prevention confirmed.
- **Phase P1 (SET-13 + SET-14):** Well-documented patterns; react-email stack confirmed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All version claims verified against npm registry, Context7 official docs, Anthropic platform docs. Drizzle WITH RECURSIVE limitation confirmed via GitHub issue #209. |
| Features | HIGH (catalog/engine/carryover), MEDIUM (discovery polish UX shapes) | Catalog hierarchy, engine rewire, and carryover features are fully specified. Discovery polish UX shapes are audit-conditional — scope is intentionally unknown until Phase 33. |
| Architecture | HIGH | All findings sourced from first-party codebase (schema.ts, similarity.ts, catalog.ts, actions/watches.ts). No external API or library assumptions. |
| Pitfalls | HIGH | Sourced from v4.0 and v4.1 MILESTONE-AUDIT.md (real post-mortems), docs/deploy-db-setup.md (documented footguns), and direct schema inspection. Two pitfalls (divestments table necessity, CAT-13 static guard) are independently corroborated across ARCHITECTURE and PITFALLS research. |

**Overall confidence: HIGH**

### Gaps to Address During Planning

- **Discovery audit scope (Phase 39):** Cannot be planned until Phase 33 delivers. Mark Phase 39 as "Scope TBD — pending DISCOVERY-AUDIT.md." This is expected and correct.
- **Lineage browse UX scope (Phase 35 + 39):** Audit may reduce urgency. Plan Phase 35 as schema-only; flag browse UI as audit-conditional.
- **Admin write surface shape:** Decide between service-role scripts only vs minimal admin route before Layer A planning. Does not affect schema — only affects whether a UI component is in scope for Phase 34.
- **Divestment dialog UI (Phase 37):** In or out of v5.0 scope? Schema is non-negotiable; UI is a planning decision.
- **DISC-09 placement:** Decide at Phase 39 planning whether DISC-09 folds into Phase 39 or gets its own phase. Depends on audit findings.
- **Layer B scope if audit de-prioritizes lineage:** Lineage edges table still ships (schema-only); browse UI deferred. Phase 35 plan written to accommodate this decision.

---

## Sources

### Primary (HIGH confidence — first-party)
- `.planning/seeds/SEED-001-catalog-hierarchy-and-attributes.md` — Reference granularity rationale; Variant fragmentation analysis; Layer A/B/C/D scope
- `.planning/seeds/SEED-004-v5-discovery-north-star.md` — audit-first ordering; CAT-13 framing; v5.0 scope constraints
- `.planning/seeds/SEED-002-hybrid-recommender.md` — divestments table necessity; sold-signal temporal decay; -0.3 weight
- `.planning/research/PREMIUM-MAP.md` — no-paywall constraint (SEED-006 resolved); recommender as future paid wedge
- `.planning/PROJECT.md` — v5.0 milestone target features; DEBT-09 details; active requirements
- `src/db/schema.ts` — full schema state; watches.status enum; cascade rules
- `src/lib/similarity.ts` — byte-locked engine; signature and export pattern
- `.planning/milestones/v4.0-MILESTONE-AUDIT.md` — byte-lock documentation; Phase 17/19.1/20 history
- `.planning/milestones/v4.1-MILESTONE-AUDIT.md` — DEBT-09 evidence; Nyquist partial posture; UI-SPEC CSS chain blind spot
- `docs/deploy-db-setup.md` — documented footguns (T-05-06-EMPTYMIGRATE, T-17-BACKFILL-PROD-DB, T-24-PRODAPPLY, T-24-PARTIDX, MiP-01 pg_cron)
- Context7 `/drizzle-team/drizzle-orm-docs` — AnyPgColumn self-referencing FK; `db.execute(sql\`...\`)` CTE pattern
- GitHub `drizzle-team/drizzle-orm` issue #209 — WITH RECURSIVE not natively supported
- Anthropic platform docs — `claude-sonnet-4-6` current alias; `claude-sonnet-4-20250514` deprecated June 15, 2026
- npm registry — Drizzle 0.45.2, drizzle-kit 0.31.10, @anthropic-ai/sdk 0.94.0, react-email 6.1.1, @react-email/components 1.0.12, @electric-sql/pglite 0.4.5, @praha/drizzle-factory 1.4.2

### Secondary (MEDIUM confidence)
- Discogs Master Release model — Reference/Variant hierarchy analogue for social graph design
- NN/Group comparison tables — FIT-05 pairwise UI pattern; SRCH-16 filter UX best practices
- Pencil & Paper mobile filter patterns — drawer vs sidebar decision for SRCH-16
- Tabular.email transactional email design — SET-14 single-CTA, table-based layout
- Letterboxd Featured Lists model — DISC-09 editorial slot framing
- GitHub account deletion Danger Zone pattern — SET-13 multi-step confirm
- Algolia search filter UX — SRCH-16 facet best practices
- resend.com/blog/react-email-6 — react-email v6 Tailwind 4 support; Resend first-party integration

### Tertiary (LOW confidence — extrapolation)
- Lineage browse UX in watch-collector-specific apps — no direct comparables found; patterns drawn from Discogs + Letterboxd analogues. Phase 33 audit will provide first-party evidence.

---
*Research completed: 2026-05-06*
*Ready for roadmap: yes*

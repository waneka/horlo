# Phase 80: NOT NULL Constraint Flip + Ingest Hardening - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 80 closes v8.4's "no more drift" loop in two coordinated moves:

**Delivers:**
1. **NOT NULL flip on `watches_catalog.brand_id` and `family_id`** — the database itself refuses any catalog row that isn't tied to a canonical brand and family. Phase 79's backfill is the precondition; this phase turns that backfill into a permanent constraint.
2. **Ingest resolver wired into `/api/extract-watch`** for BOTH branches (URL extract path → `upsertCatalogFromExtractedUrl` and structured-input path → `upsertCatalogFromUserInput`). The resolver runs a 3-tier lookup for brand and a 4-tier lookup for family, then attaches the resolved `brand_id` + `family_id` to the catalog row.
3. **Brand resolution chain:**
   - Tier 1: exact match on `brands.name_normalized` → reuse.
   - Tier 2: `pg_trgm` fuzzy match ≥ 0.6 against `brands.name_normalized`. If the top score beats the runner-up by ≥ 0.1 (clear gap), reuse the top match. If not (ambiguous), fall through to Tier 3.
   - Tier 3: auto-create a new `brands` row with `needs_review = true`.
4. **Family resolution chain (scoped to the resolved brand):**
   - Tier 1: exact match on `watch_families.name_normalized`.
   - Tier 2: alias containment — `aliases @> ARRAY[lower(trim(model_raw))]`. Phase 79 populated these from operator merge decisions; this is the path that resolves `Brut Date` → canonical `Brut Datejust`.
   - Tier 3: `pg_trgm` fuzzy match ≥ 0.6 against `name_normalized` (top score wins; no clear-gap rule needed since lookup is already brand-scoped and family counts per brand are small).
   - Tier 4: auto-create a new `watch_families` row with `needs_review = true`, scoped to the resolved brand.
5. **Structured log events** — `console.log` JSON with event-type tags (`fuzzy_brand_match`, `fuzzy_family_match`, `brand_auto_created`, `family_auto_created`). Vercel logs are the audit surface. No new telemetry table.
6. **Staged prod rollout** — ingest code deploys FIRST (resolver wired but constraint still nullable), one manual prod extract proves `brand_id` + `family_id` land, THEN the NOT NULL migration runs via `supabase db push --linked`.

**Explicitly NOT in this phase:**
- No recommender JOIN-through changes (Phase 81 RECO-01..04 — exclusion key, multi-brand scoring, rationale templates).
- No `addWatch` / `editWatch` Server Action display auto-overwrite (Phase 81 DISP-01/02).
- No `/admin/brands` / `/admin/families` UI (Phase 82 OPS-01/02). Operator review of `needs_review = true` rows created here happens after Phase 82 ships.
- No API response shape change. Existing `{ success, catalogId, catalogIdError, ...result, mode }` envelope is preserved.
- No threshold tuning UI (the 0.6 brand fuzzy threshold is REQUIREMENTS.md D-05's stated default; this phase ships that constant).
- No client-visible signal that a brand was auto-created (Tyler chose silent; user flow never blocks).

Phase 80 succeeds when: a single extracted URL whose brand/model is unknown produces a catalog row with `brand_id` and `family_id` both populated (auto-created or matched), the NOT NULL constraint is live, and the next extract for a known brand/model attaches the existing FK rather than creating a new row.

</domain>

<decisions>
## Implementation Decisions

### Brand Resolver

- **D-80-01: Clear-gap fuzzy tie-break.** Brand fuzzy lookup runs `pg_trgm` against `brands.name_normalized` with threshold 0.6. The resolver picks the top match ONLY when it beats the runner-up by at least 0.1. If multiple brands clear 0.6 within 0.1 of each other (ambiguous), the resolver does NOT guess — it falls through to auto-create with `needs_review = true`. Both the picked match AND the runner-up are logged in the `fuzzy_brand_match` event for operator audit. Why: matches Phase 78 D-78-04's "exact-only auto-resolve" philosophy (when in doubt, queue it). The Hamilton vs Hamilton Watch case Phase 79 just merged would have been a near-tie under raw threshold-only matching; the clear-gap rule prevents this exact class of ambiguity from re-entering through ingest.

### Family Resolver

- **D-80-02: Exact → alias → fuzzy → auto-create.** Family lookup, scoped to the resolved brand, tries in order: (1) exact match on `name_normalized`, (2) alias containment via `aliases @>`, (3) fuzzy match `word_similarity ≥ 0.6` (top score wins, no clear-gap rule), (4) auto-create with `needs_review = true`. Aliases come second so Phase 79's operator-decided merges (`Brut Date` → `Brut Datejust`) win over a fuzzy guess. Family fuzzy does NOT inherit the brand resolver's clear-gap rule because family lookup is already scoped to one brand and the per-brand family count is small (single-digit-to-low-dozens in practice) — multi-family fuzzy ties are rare enough that the symmetric rule is overhead without buying real safety.

### Deploy Sequencing

- **D-80-03: Staged deploy — ingest code first, soak, then constraint flip.** Three ordered steps for prod:
  1. Vercel deploys the ingest code (resolver wired into BOTH `upsertCatalogFromExtractedUrl` and `upsertCatalogFromUserInput`). `brand_id` + `family_id` columns are still nullable — old rows untouched, new rows write both FKs.
  2. Operator runs ONE manual URL extract on prod against a known brand+model URL. Verifies via SQL that the upserted row has `brand_id` + `family_id` populated and that no log events fired indicating a path regression.
  3. THEN run `supabase db push --linked` to apply the NOT NULL migration. The migration is its own additive SQL file (filename per `[[drizzle-supabase-db-mismatch]]` — timestamped after Phase 78's `20260624000000_phase78_aliases_needs_review.sql`).
- Why: matches Phase 79's POST-DEPLOY forward-armor note (`NOT NULL flip on brand_id / family_id (Phase 80 — CANON-01/02). Phase 79 leaves the columns nullable but verifies zero NULLs via post-flight assertion.`). The soak step is cheap and catches "I forgot to wire the resolver into one of the two upsert paths" before the door slams shut. Bundled-deploy risks a window where new code with a silent regression starts inserting NULLs that the migration immediately rejects.

### Log Events + Response Surface

- **D-80-04: Structured `console.log` events; response shape silent.** Server-side logs fire `console.log('[extract-watch] <event_type>', { ... })` where event_type ∈ { `fuzzy_brand_match`, `fuzzy_family_match`, `brand_auto_created`, `family_auto_created` } and the payload carries: `input_raw` (the LLM-extracted string), `decision` (`matched` | `tied_auto_create` | `no_candidates_auto_create`), `matched_id`, `matched_name`, `score` (for matched), `runner_up_id` / `runner_up_name` / `runner_up_score` (for fuzzy paths when a runner-up exists), and for family events also `brand_id` (the scope of the lookup). The `/api/extract-watch` JSON response envelope is UNCHANGED — no new `brandResolution` / `needsReview` / `familyResolution` fields. AddWatchFlow keeps working with zero client-side changes. Operator audits via Vercel logs (real-time) + Phase 82's `/admin/brands` queue (eventual cleanup). Why: matches REQUIREMENTS.md INGEST-02 "no user-visible delay" + INGEST-03 "user flow never blocks" — silence is the intended behavior. Adding a response field is forward-compatible (a future phase can add it without breaking existing clients), so silent now does not foreclose telemetry-in-response later.

### Claude's Discretion

- **Resolver location.** Most natural shape: a single helper module (`src/lib/catalog/resolver.ts` or `src/data/catalog-resolver.ts`) exporting `resolveBrandId(rawBrand: string): Promise<{ brandId: string; decision: ResolveDecision }>` and `resolveFamilyId(brandId: string, rawModel: string): Promise<{ familyId: string; decision: ResolveDecision }>`. Both upsert helpers (`upsertCatalogFromExtractedUrl` + `upsertCatalogFromUserInput`) call the resolver BEFORE constructing their INSERT. Planner picks file layout; the contract (pure async function, brand-then-family ordering, all logging contained inside the helper) is the lock.
- **Empty/whitespace `model_raw` handling.** Route already gates "both brand and model empty" → 422 `structured-data-missing` (lines 204–216 of `route.ts`). If brand is populated but model is empty/whitespace, the brand resolver runs normally; family resolution sees `lower(trim(''))` = `''` which won't match anything in exact/alias/fuzzy → auto-creates a family named `''` scoped to the brand. Planner decides whether to: (a) treat empty `model_raw` as a NULL family path (NOT possible after the NOT NULL flip — would crash), (b) auto-create a placeholder family with `name = '(unspecified)'` and `needs_review = true`, or (c) extend the route's empty-gate to also fail when model is empty. Option (b) is simplest and preserves the "user flow never blocks" promise; option (c) is most strict but contradicts the existing D-12 behavior of "only fail if BOTH are empty." Recommend (b) but planner can argue otherwise from the test surface.
- **Re-extract behavior** (when `ON CONFLICT ON CONSTRAINT watches_catalog_natural_key` hits — same brand/model/reference triple extracted again). Three options: (i) DO NOTHING on brand_id/family_id (leave whatever was there), (ii) re-run resolver and UPDATE brand_id/family_id, (iii) only UPDATE if currently NULL. Phase 79's hydration means all existing rows already have brand_id+family_id populated; re-extract should logically reuse them. Recommend (i) — leave brand_id/family_id alone on conflict. Avoids the "operator merged brand X into brand Y in /admin/brands; next extract reverses the merge" race. Planner can override if research surfaces a stronger reason for (ii) or (iii).
- **Idempotency + tests.** Resolver is pure-async; deterministic given a fixed DB state. Tests use the seeded local catalog (~205 rows) plus targeted test fixtures for: (a) exact-match hit, (b) fuzzy hit with clear gap, (c) fuzzy ambiguous (clear-gap fail → auto-create), (d) no candidates → auto-create, (e) family alias hit (Brut Date → Brut Datejust), (f) family fuzzy hit. Re-running the same fixture twice produces identical FK ids (idempotency). Planner picks vitest vs integration test split.
- **Trigram GIN index on `brands.name_normalized`.** If not already present from earlier phases, fuzzy match runs sequential scans against ~50 brand rows — fine at v8.4 scale (no perf regression risk), and the planner can defer index creation to a future phase or include it as a tiny additive migration here. Phase 78's R-FIND-02 already pinned the search_path lesson for any helper functions used in indexes.
- **Migration filename.** Per `[[drizzle-supabase-db-mismatch]]` filename + ordering rules. Phase 78 shipped `20260624000000_phase78_aliases_needs_review.sql`. Phase 80's NOT NULL migration should be `supabase/migrations/{timestamp}_phase80_catalog_brand_family_not_null.sql` where `{timestamp}` is later than Phase 78's. Verify ordering at write time, not at infer time.
- **Tone of the discussion artifacts.** Tyler explicitly asked for plain-English explanations during this discussion. CONTEXT.md is the downstream-agent contract (technically precise) but the DISCUSSION-LOG.md and any operator-facing artifacts (POST-DEPLOY.md if Phase 80 generates one, README comments) should stay accessible — no acronym walls.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v8.4 Milestone Inputs (mandatory)
- `.planning/REQUIREMENTS.md` — full milestone decisions D-01..D-08 (especially D-05 "ingest fuzzy-match-then-create" and D-07 "operator-review surface") and the CANON-01/02 + INGEST-01..04 requirement language. D-05's "threshold tunable" framing is the basis for the 0.6 default + D-80-01's clear-gap addition.
- `.planning/ROADMAP.md` § Phase 80 — phase goal, depends-on, 5 success criteria, requirement mapping (CANON-01, CANON-02, INGEST-01..04). The success criteria are non-negotiable contract; D-80-01..D-80-04 implement them.
- `.planning/seeds/SEED-021-catalog-brand-model-canonicalization.md` — origin signal. Phase 80 is the "future ingests can't reintroduce the drift" half of SEED-021.

### Phase 78 + 79 Carryforward (mandatory)
- `.planning/phases/79-backfill-migration-display-hydration/79-CONTEXT.md` — Phase 79's locked decisions D-79-01..D-79-10. Phase 80 inherits: D-79-06 (aliases populated by Phase 79 operator decisions are the alias-tier feed for D-80-02), the backfill artifact (zero NULL rows is the precondition for the NOT NULL flip), D-79-09 (operator-marked `new` brand/family rows default to `needs_review = false`; Phase 80's auto-create path is the FIRST writer of `needs_review = true`).
- `.planning/phases/79-backfill-migration-display-hydration/79-POST-DEPLOY.md` (planned) — forward-armor section explicitly defers NOT NULL flip + ingest changes to Phase 80. D-80-03's staged deploy step 1 reads against the post-Phase-79 prod state.
- `.planning/phases/78-schema-additions-operator-resolve-queue/78-CONTEXT.md` — Phase 78's D-78-01..D-78-08. D-78-04 (exact-only auto-resolve) is the philosophical parent of D-80-01 (clear-gap fuzzy tie-break). Phase 78 R-FIND-02 (pinned search_path for word_similarity calls) applies to Phase 80's brand resolver if it uses a helper function in a functional index.

### Existing Ingest Code (mandatory — Phase 80 modifies these directly)
- `src/app/api/extract-watch/route.ts` — the route handler. Phase 80 does NOT change the request/response shape, the D-15 error taxonomy, or the D-12 empty-gate. The mutation is downstream: both upsert call sites (line 226 + line 367) pass the same `brand` + `model` they already pass; the resolver lives inside the upsert helpers, not in the route.
- `src/data/catalog.ts` § `upsertCatalogFromExtractedUrl` (L178–244) — the URL-extract upsert. Phase 80 inserts a resolver call BEFORE the INSERT and adds `brand_id` + `family_id` to the INSERT column list + values list. The existing `ON CONFLICT ON CONSTRAINT watches_catalog_natural_key DO UPDATE SET` clause is the existing conflict path; the brand_id/family_id columns are NOT updated on conflict (per D-80 Discretion item iii).
- `src/data/catalog.ts` § `upsertCatalogFromUserInput` (L138–164) — the structured-input upsert. Same resolver-call pattern. Currently a CTE that natural-key-upserts and returns the id — Phase 80 either restructures the CTE to include brand_id/family_id or extracts the resolver call above the CTE.

### Schema Starting State (read-only — Phase 80 reads brands+watch_families, modifies watches_catalog)
- `src/db/schema.ts` § `watchesCatalog` (L431–510) — `brand_id` + `family_id` FKs are CURRENTLY nullable (Phase 34 introduced as nullable; Phase 79 backfilled; Phase 80 flips NOT NULL). Drizzle schema update + hand-written SQL migration.
- `src/db/schema.ts` § `brands` (L518–537) — `name`, `nameNormalized` (GENERATED), `needs_review` (Phase 78). Phase 80 inserts new rows with `needs_review = true` from the auto-create path.
- `src/db/schema.ts` § `watchFamilies` (L539–560) — `name`, `nameNormalized` (GENERATED), `aliases` text[] (Phase 78), `needs_review` (Phase 78). Phase 80 reads `aliases @>` for resolution + inserts new rows with `needs_review = true`.

### Migration Portability Rules (mandatory — failure here costs a prod push)
- Memory: `[[drizzle-supabase-db-mismatch]]` — drizzle-kit push is LOCAL ONLY; prod uses `supabase db push --linked`; 4 prod-push gotchas (filename, ordering, extension schema, enum-bound dependents). Phase 80's NOT NULL migration is additive (no enum changes) and uses no helper functions, so gotchas 3 + 4 don't apply; gotchas 1 + 2 (filename + ordering) do.
- Memory: `[[supabase-extension-schema-function-pin]]` — pinned search_path on functions used in indexes. Phase 80 doesn't add helper functions; word_similarity is a built-in `extensions.word_similarity` reference. If the resolver ends up running the SQL `extensions.word_similarity(name_normalized, ${input}) AS score` inside a query, that's a query-time reference and does not need a function pin (pin rule is for FUNCTIONS used inside INDEXES, not queries).
- Memory: `[[pg-trgm-word-similarity-for-brand-typos]]` — use `word_similarity()` not `similarity()` for brand-name typo lookups; user types ONE word but DB value can be multi-word. Phase 80's brand resolver MUST use `word_similarity()` per this lesson. Family resolver also uses `word_similarity()` for symmetry.
- Memory: `[[post-flight-assertion-predicate-divergence]]` — Phase 79 lesson. Phase 80's NOT NULL flip implicitly enforces the constraint at constraint-add time (Postgres validates existing rows); no separate post-flight assertion is needed. If the planner adds one for belt-and-suspenders, the predicate divergence rule applies.

### Local-First Verification (mandatory)
- `CLAUDE.md` § Local-First Development — the gate. Phase 80 is DB-touching AND ingest-path-modifying. Verify via `npm run dev` against local Supabase: (a) extract a URL whose brand is in the seeded catalog (exact match path), (b) extract a URL whose brand is misspelled by one character (fuzzy clear-gap path), (c) extract a URL whose brand is novel (auto-create path), (d) extract a URL where `Brut Date` resolves to `Brut Datejust` via alias (Phase 79 must have populated the alias locally first). All three log paths verifiable in local logs. Run NOT NULL migration locally LAST after all three paths confirm `brand_id` + `family_id` populated.
- Memory: `[[local-first-dev]]` — same rule. Phase 80 is a canonical "this would silently break prod" case if the resolver has a bug that the build doesn't catch.

### Critical Memories (additional)
- Memory: `[[next-clear-operational-debt]]` — `workflow.use_worktrees=false` is globally set; Phase 80 is DB-touching + build-gated. No worktrees.
- Memory: `[[drizzle-sql-any-array-pitfall]]` — if the resolver uses `sql\`= ANY(${arr})\`` for "any of these brand ids" lookups, that's a runtime crash. Use `IN (sql.join(...))` instead. Phase 80's resolver SHOULD NOT need array operators since lookups are scalar `WHERE name_normalized = ${normalized}` and `WHERE aliases @> ARRAY[${normalized}]` — the alias containment uses a literal single-element array, not a spread. But planner verify at write time.
- Memory: `[[catalog-id-divergence]]` — local + prod UUIDs differ; Phase 80's resolver is correct under both because it queries by `name_normalized` not by id.

### Test Pattern Precedents
- `tests/integration/migrations/` — Phase 78 + 79 RED-stub conventions for migration tests. Phase 80's NOT NULL constraint test is a single integration assertion: attempting to insert a row with `brand_id = NULL` raises `23502`.
- `tests/integration/scripts/` + `tests/unit/scripts/` — Phase 78 + 79 pattern for resolver-style tests with fixture-driven inputs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/api/extract-watch/route.ts` — the route handler. Two upsert call sites (line 226 + line 367) are the ONLY places Phase 80 needs to touch in the route. The D-15 error taxonomy, D-12 empty-gate, Zod validation, auth gate, SSRF check, and category-copy table are ALL unchanged. Phase 80 ships ZERO route-level changes.
- `src/data/catalog.ts` § upsert helpers — the resolver call lands inside these two functions. Existing connection model (drizzle client, `db.execute<{ id: string }>(sql`...`)`) carries forward; resolver helpers use the same `db` instance.
- `brands.name_normalized` + `watch_families.name_normalized` — both GENERATED columns from earlier phases. Resolver's exact-match path is a direct equality check against these — no normalization logic to re-implement.
- `watch_families.aliases` (Phase 78) populated by Phase 79's `--apply` — Phase 80's family resolver consumes the populated state. GIN index from Phase 78 supports `@>` containment lookup.
- `pg_trgm` extension installed in both local + prod via 260623-uua migration. Phase 80's `word_similarity()` calls work in both environments.

### Established Patterns
- **Resolver helper inside the upsert function, not at the route** — keeps the route handler thin and pushes the catalog-specific logic into `src/data/catalog.ts` (or a new sibling module). The route doesn't know about brand_id / family_id; the upsert helper does.
- **`console.log` JSON for structured events** — precedent: `console.error('[extract-watch] catalog upsert failed (non-fatal):', err)` (line 256) and `console.error('[extract-watch] taste enrichment failed (non-fatal):', err)` (line 296). Phase 80 follows the same pattern with `console.log` for non-error events and JSON-friendly second argument.
- **Hand-written `.sql` migration for additive constraint changes** (per `[[drizzle-supabase-db-mismatch]]`). Phase 78 + 79 already establish the timestamp+phase pattern.
- **Drizzle schema update mirrors hand-written SQL** — set `notNull()` on `brand_id` and `family_id` in `src/db/schema.ts` § watchesCatalog, then push to local; hand-write the prod migration to match.
- **Service-role bypass on writes** — both upsert paths run under service-role per the existing route + DAL pattern. Resolver inherits this; no auth changes needed.
- **Local-first verification gate** — non-optional. Resolver paths verified against the seeded local catalog (4 users, ~205 catalog rows including the SEED-021 drift cases) BEFORE the prod push.

### Integration Points
- **Phase 79's alias population (D-79-06)** is the feed for Phase 80's D-80-02 tier 2 (alias hit). The `aliases` column was empty until Phase 79 ran `--apply`; Phase 80 cannot ship before Phase 79's alias population reaches prod.
- **Phase 79's MIG-04 post-flight assertion** is the precondition for the NOT NULL flip — Phase 80 reads "zero NULL `brand_id` / `family_id` on `watches_catalog`" as proven by Phase 79.
- **Phase 81 RECO-01/02/03** reads `brand_id` via JOIN; Phase 80 is what makes that JOIN safe (every catalog row has a non-NULL brand_id). The NOT NULL flip is the trust boundary.
- **Phase 82 OPS-01/02** `/admin/brands` + `/admin/families` queues filter on `needs_review DESC`. Phase 80's auto-create path is the producer of the queue's contents (Phase 79's `--apply` left it empty); Phase 82 ships the consumer UI.
- **AddWatchFlow + `<ExtractErrorCard>` (Phase 25 / Phase 66)** — UNCHANGED. The D-80-04 silent-response decision means no client-side updates are required.

</code_context>

<specifics>
## Specific Ideas

- **The Hamilton drift loop closes here.** Phase 79 merged `Hamilton Watch` → `Hamilton` in the canonical brand row. Phase 80's brand resolver ensures the next URL extract returning `Hamilton Watch` (e.g. from an older retailer page) resolves to the same `brands.id = '20969364-f3b1-4b1d-ab2f-e5d22e9ffabc'` via fuzzy match with clear gap — NOT a new `Hamilton Watch` brand row. End-to-end: same canonical brand JOIN for the recommender exclusion key in Phase 81 RECO-01.
- **The `Brut Date` → `Brut Datejust` loop closes here.** Phase 79 populated the alias on the canonical `Brut Datejust` family. Phase 80's family resolver hits Tier 2 (alias containment) before fuzzy — so `Brut Date` resolves to the canonical family even though raw fuzzy might score `Brut Date` against multiple Brut-prefixed families.
- **Ambiguous brand fuzzy is the new bug surface.** With Phase 80 live, the canonical drift bug source shifts from "free-text comparison ambiguity" (closed by D-01) to "fuzzy threshold ambiguity" (mitigated by D-80-01 clear-gap rule). The `fuzzy_brand_match` log events are the operator's signal that a near-tie was queued vs auto-created. Phase 82's `/admin/brands` review walkthrough should prioritize `needs_review = true` rows annotated by `tied_auto_create` decision over `no_candidates_auto_create` decisions (former = potential merge, latter = genuine new brand).
- **One manual extract gates the prod NOT NULL push.** D-80-03 step 2 is non-negotiable. The cheapest test: extract a URL for a watch already in the catalog (e.g., one of the Hamilton Khaki Field references). Verify via `SELECT brand_id, family_id FROM watches_catalog WHERE id = '...'` that both columns are populated. If they're NULL, the resolver wasn't wired into one of the two upsert paths and the migration push would brick the next prod extract.
- **The resolver is the FIRST writer of `needs_review = true`.** All prior brand / family inserts (Phase 78 schema add + Phase 79 backfill `--apply`) set `needs_review = false` (Phase 79 D-79-09). After Phase 80 ships, `SELECT count(*) FROM brands WHERE needs_review = true` is the operator's queue depth signal. Phase 82's admin queue surfaces this directly.
- **Auto-created family scoping respects auto-created brand.** When the brand resolver auto-creates a new brand AND the family resolver runs immediately afterward, the family is scoped to the just-created (empty) family list for that brand → family always auto-creates. Result: a "new brand + new family" extraction produces two `needs_review = true` rows. Operator sees both in Phase 82's queues. Acceptable per "user flow never blocks" — operator cleans up the (likely) duplicate-of-an-existing-canonical-brand later.

</specifics>

<deferred>
## Deferred Ideas

- **Threshold tuning beyond 0.6.** REQUIREMENTS.md D-05 says "threshold tunable". Phase 80 ships 0.6 + the 0.1 clear-gap delta as constants in the resolver module. A future phase (likely with Phase 82's admin UI) could add per-environment tuning via a config table or env var. Don't build the tuning surface in Phase 80.
- **Telemetry table for fuzzy match decisions.** Could collect every `fuzzy_brand_match` event into a `catalog_resolution_log` table for offline analysis. Rejected for Phase 80 — Vercel logs cover the audit need at v8.4 scale. Revisit in v9+ if log-volume aggregation becomes painful.
- **`brandResolution` / `familyResolution` field on the API response.** Considered (Option B in Q4). Rejected: silence is the contract per D-05 + D-80-04. Forward-compatible to add later when AddWatchFlow needs to display "this brand is new" hints.
- **Re-extract resolver re-run + UPDATE brand_id/family_id on conflict.** Considered. Rejected (Discretion item iii): leaves the door open for operator merges in /admin/brands to be reverted by a subsequent re-extract. Re-running the resolver on conflict is a Phase 82+ concern coupled with admin merge actions.
- **Auto-creating a placeholder family when `model_raw` is empty.** Treated as Claude's Discretion (item ii) for the planner. If the planner picks option (c) instead (extend the route's empty-gate), that's a route-level change and bumps Phase 80 from "ZERO route changes" to one targeted change. Acceptable if argued from the test surface; revisit in plan-checker.
- **Per-row needs_review extended grammar.** Phase 79 deferred this (`new!` token rejected); Phase 80 doesn't need it because auto-create from ingest is the only `needs_review = true` writer and the queue is queryable directly. Phase 82's queue UI is the right surface.
- **Operator dry-run preview of resolver decisions.** Could log the would-be decision against existing rows without writing. Rejected: Phase 79's `--apply` dry-run already covered the migration audit; Phase 80's resolver runs on individual extracts, not batches.
- **Bundled deploy (option B in Q3).** Rejected: D-80-03 staged is the chosen pattern. The 30-second window argument doesn't outweigh the "manual extract proves the wire-up" safety net.
- **Symmetric clear-gap rule on family fuzzy** (option 3 in Q2). Rejected: family lookups are brand-scoped; multi-family fuzzy ties within a single brand are rare. Asymmetric is fine.

</deferred>

---

*Phase: 80-NOT NULL Constraint Flip + Ingest Hardening*
*Context gathered: 2026-06-25*

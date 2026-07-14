# Phase 81: Recommender + Display Server Action Swap - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 81 closes v8.4's user-visible-drift loop by making the home recommendations rail identity-aware and forcing personal watch rows to canonical display strings on every write.

**Delivers:**

1. **Recommender exclusion + scoring keys on canonical FK ids, not free-text strings** (`src/data/recommendations.ts` § `getRecommendationsForViewer` + `topUpFromCatalogPopularity`):
   - Exclusion set switches from `norm(w) = brand|model` (lowercase-trimmed strings) to `w.brandId | w.familyId`. An owner of `Héron` no longer sees `Héron Watches` in their own rail.
   - `topUpFromCatalogPopularity`'s multi-brand `+100` SELECT swaps from `lower(trim(watches_catalog.brand)) IN (…strings…)` to `brand_id IN (…viewer's brand_ids…)`. `Hamilton` + `Hamilton Watch` both trigger the boost against canonical Hamilton.
   - `topUpFromCatalogPopularity`'s SELECTs INNER JOIN `brands` + `watch_families` so the synthetic Watch rows carry canonical brand/model in the rail's rationale.

2. **`topBrandOf` keys on `w.brandId`** (`src/lib/recommendations.ts`) — signature widens to accept a `brandNameLookup: Map<string, string>` and returns `{ brandId, brandName }`. Counts by canonical brand id (not free-text), returns canonical `brands.name` for rationale substitution. Legacy `catalogId = null` rows correctly drop out of the count instead of inflating stale-string totals.

3. **Rationale templates render canonical brand strings.** `rationaleFor` continues to read `ctx.candidateBrand`, but that string is now guaranteed canonical because (a) personal watches carry canonical `brand` after DISP-01/02 and (b) synthetic top-up watches carry canonical `brand` from the added JOIN.

4. **`Watch` domain type gains `brandId?` and `familyId?`** (`src/lib/types.ts`) — optional back-compat fields, projected through `getWatchesByUser` + `getWatchById` via the existing LEFT JOIN on `watches_catalog`. `mapRowToWatch` propagates them. Test fixtures constructing `Watch` pass `undefined` (no forced update).

5. **`addWatch` and `editWatch` Server Actions auto-overwrite `watches.brand` / `watches.model` from CANONICAL `brands.name` / `watch_families.name`** — not from the DENORMALIZED `watches_catalog.brand` / `watches_catalog.model` (this is the bug the current `addWatch` line 153 has today). Canonical strings are fetched via a fresh JOIN through `catalogId → brand_id → brands.name` after upsert (or catalog fetch) returns `catalogId`. Both branches of `addWatch` (resolver-driven user-input + catalogId-supplied) hit the same JOIN path. `editWatch` gets the same treatment on UPDATE.

**Explicitly NOT in this phase:**

- No schema changes. Phase 80 already flipped `brand_id` + `family_id` to NOT NULL. Phase 81 is pure code.
- No `watches_catalog.brand` / `watches_catalog.model` denorm sync at write time. Read-time JOIN in `topUpFromCatalogPopularity` closes the display-drift bug; catalog denorm columns stay untouched. Any retroactive sweep is Phase 82's `/admin/brands` merge concern.
- No `Watch.brandId` DENORMALIZATION onto `watches` table (CANON-V2-01 deferred). The JOIN-through-`catalogId` path per D-06 is the read path.
- No `/admin/brands` / `/admin/families` UI (Phase 82 OPS-01/02).
- No brand-picker autocomplete (Phase 82 UI-01/02).
- No `addWatch` / `editWatch` client-side change. The auto-overwrite is server-only; the WatchForm still sends whatever brand/model the user typed.
- No changes to Phase 80's resolver contract (`src/data/catalog-resolver.ts`) — extension is on the upsert helpers and `getCatalogById`, not the resolver itself.
- No new tests-first RED milestone (planner's call whether to gate on RED, but the local-first drift-fixture walk-through is the primary correctness gate — see D-81-04).
- No re-backfill of existing `watches` rows. Phase 79 DISP-03 already hydrated them.

Phase 81 succeeds when: (i) the seeded local viewer whose owned Hamilton has a peer-owned `Hamilton Watch` drift row sees the drift row excluded from their rail AND surfaced multi-brand-boost on the peer's OTHER Hamilton watches; (ii) rail rationale displays `Fans of Hamilton love this` (canonical) regardless of which peer owns the drift row; (iii) adding OR editing a personal watch with brand typed as `Hamilton Watch` persists `watches.brand = 'Hamilton'`; (iv) existing recommendations tests still pass; (v) no measurable p95 regression on the home rail.

</domain>

<decisions>
## Implementation Decisions

### Canonical-name source on writes

- **D-81-01: Fresh JOIN after upsert returns catalogId** (per Area 1 discussion). Extend `upsertCatalogFromUserInput` and `upsertCatalogFromExtractedUrl` to return `{ catalogId, brandName, familyName }` instead of `string | null`. The upsert helpers already know `brandId` + `familyId` from the resolver return — the JOIN can happen inside the same CTE (via `RETURNING` extended with `(SELECT name FROM brands WHERE id = brand_id)`) or as a small follow-up SELECT. Also extend `catalogDAL.getCatalogById` to LEFT JOIN `brands` + `watch_families` and expose `canonicalBrand: string` + `canonicalFamily: string` on the returned row. Server Actions (`addWatch` line 153 catalogId branch + user-input branch, `editWatch` new overwrite path) read the canonical strings and write them into `cleanData.brand` / `cleanData.model`.
  - Why not (a) extend Phase 80 resolver: only covers the resolver-driven branch of `addWatch`. The catalogId-supplied branch (line 141–157) reads `catalogRow.brand` — the DENORM column, the exact source of drift. Both branches need the same JOIN.
  - Why not (c) DB trigger: interacts poorly with the service-role write pattern and Supabase's per-schema function pinning; harder to test against local Supabase; the `[[supabase-extension-schema-function-pin]]` gotcha applies if the trigger uses helper functions.
  - Cost: one SELECT worth of extra JOIN per add/edit — imperceptible against the 4-5 DB calls those actions already make (taste enrichment, activity log, revalidates).

### Watch type + DAL projection

- **D-81-02: Extend `Watch` with optional `brandId?` and `familyId?`** (per Area 2 discussion). Not a recommender-private type. FK ids are canonical *domain* identity — Explore rail, similarity engine, add-watch dedupe all could eventually key on them. Ship once via `Watch`, all future canonical-keyed features read `w.brandId` for free.
  - `getWatchesByUser` (`src/data/watches.ts` L128–184) and `getWatchById` (L190–219) — both already LEFT JOIN `watchesCatalog` at line 159 / 205. Add `brandId: watchesCatalog.brandId` + `familyId: watchesCatalog.familyId` to the SELECT projection. Propagate through `mapRowToWatch`.
  - Fields optional (`?: string`) — legacy `Watch` fixtures pass `undefined`; only fails soft (excluded from FK-keyed comparisons but still displayed).
  - `topBrandOf` signature widens per D-81-05 (below).
  - Exclusion-set `norm(w)` becomes `${w.brandId}|${w.familyId}` with a `${w.brand}|${w.model}` fallback for the `catalogId=null` edge case (Phase 17 `onDelete: 'set null'` scenario). Post-Phase-80 the fallback should be dead code in practice, but keeps the exclusion safe for legacy or race conditions.

### Catalog denorm drift

- **D-81-03: Read-time JOIN in `topUpFromCatalogPopularity` only; no write-time sync of `watches_catalog.brand` / `watches_catalog.model`** (per Area 3 discussion). Both SELECTs in `topUpFromCatalogPopularity` (popularity query lines 411–424, owned-brand query lines 440–460) add `INNER JOIN brands b ON b.id = watches_catalog.brand_id INNER JOIN watch_families f ON f.id = watches_catalog.family_id` and project `b.name AS brand` + `f.name AS model`. Synthetic Watch built at lines 509–520 uses canonical strings.
  - The owned-brand SELECT's IN clause switches from `lower(trim(brand)) IN (…brand strings…)` to `brand_id IN (…brand ids from viewerWatches…)` — closes RECO-02 literally. Uses the same `IN (sql.join(arr.map(id => sql\`${id}\`), sql\`, \`))` shape as the existing code per `[[drizzle-sql-any-array-pitfall]]`.
  - Why not (b) write-time sync: `upsertCatalogFromExtractedUrl`'s ON CONFLICT UPDATE COALESCEs enrichment fields for first-writer-wins semantics. Mixing canonical-identity overwrite with COALESCE-enrichment in the same UPDATE muddies both. Read-time JOIN is cheap enough that the write-side complexity doesn't buy anything.
  - Why not (d) accept drift: violates Phase 81's own contract — rail rationale keeps showing drift until operator sweeps (Phase 82 unknown timeline).
  - `watches_catalog.brand` / `.model` denorm columns are LEFT untouched by Phase 81. Their only remaining role is "convenience projection when the caller doesn't need canonical" — and Phase 82's admin merge action (OPS-01) will naturally propagate canonical strings to catalog rows when it UPDATEs `brand_id` across referencing rows.

### Deploy + local-first verification

- **D-81-04: Combine unit tests + local drift fixture; bundled prod deploy** (per Area 4 discussion). Phase 81's silent-bug risk (self-in-own-rail if exclusion key mismatches) is high and NOT covered by build or type gates. `[[local-first-dev]]` is the primary correctness gate.
  - **Fixture recipe** (canonical is `Hamilton`, drift denorm is `Hamilton Watch` — Phase 79 already merged `Hamilton Watch` → canonical `Hamilton` in prod but locally we craft the drift back in):
    1. `INSERT INTO watches_catalog (brand, brand_id, family_id, model, source, ...) VALUES ('Hamilton Watch', <canonical Hamilton brand_id>, <a Hamilton family_id>, '<some model>', 'admin_curated', ...)` — this row has drift: denorm string `Hamilton Watch` on a canonical Hamilton brand_id. This is the row that RECO-01 must exclude from an owner's rail.
    2. Personal `watches` row for `viewer@horlo.test`: `brand = 'Hamilton'` (canonical), `catalog_id` pointing at a DIFFERENT Hamilton catalog row already in the local seed (e.g., a Hamilton Khaki Field row).
    3. Peer collector (`vintage-anna@horlo.test`) owns the drift row from step 1 AND at least one OTHER Hamilton catalog row so the multi-brand `+100` has a candidate to fire against.
  - **Walkthrough on local dev (`npm run dev` + local Supabase):**
    1. Sign in as `viewer`, load `/`. Assert: the drift-branded catalog row from fixture step 1 is NOT surfaced in the rail (RECO-01 — exclusion by canonical `brand_id`).
    2. Assert: the peer's OTHER Hamilton catalog rows are surfaced with rationale `Fans of Hamilton love this` (RECO-04 — canonical, not `Fans of Hamilton Watch love this`).
    3. Add a watch via structured entry with brand typed as `Hamilton Watch`. Assert: `watches.brand` persists as `Hamilton` in the DB (DISP-01).
    4. Edit that new watch, retype brand as `Hamilton Watch`. Assert: save persists as `Hamilton` (DISP-02).
  - **Unit tests** extend `src/data/__tests__/recommendations.test.ts` and `src/lib/__tests__/recommendations.test.ts` (if present):
    - `topBrandOf` counts by brandId when brandId present; falls back or degrades gracefully when brandId is missing (Phase 36 wiped-catalog scenario).
    - Exclusion-set key format `${brandId}|${familyId}` with `${brand}|${model}` fallback.
    - `rationaleFor` receives canonical brand string (test that the input is canonical, not the function's internals).
    - DISP-01/02 auto-overwrite: given a synthetic `catalogId → canonicalBrand='Hamilton'` and user input `brand='Hamilton Watch'`, the persisted brand is `Hamilton`.
  - **Deploy:** bundled single Vercel push. Post-push prod smoke: sign in as tyler's account, load home, spot-check the rail doesn't include any of tyler's owned watches AND the rationale strings look canonical.
  - Post-verify: no post-flight SQL assertion needed (there's no schema change to verify), but a manual "load home / add watch / edit watch" walkthrough on prod is the human UAT.

### topBrandOf implementation

- **D-81-05: `topBrandOf` counts on `w.brandId`, returns `{ brandId, brandName }`** (per follow-up question). Signature widens to `topBrandOf(watches, brandNameLookup: Map<string, string>): { brandId: string; brandName: string } | null`. DAL builds `brandNameLookup` once from a small `SELECT id, name FROM brands WHERE id IN (…viewer's brandIds…)` (one query, pk-indexed). Legacy rows where `w.brandId = undefined` are correctly excluded from counting instead of inflating stale-string totals.
  - Why not (b) trust canonical `w.brand`: `watches.catalogId` is `ON DELETE SET NULL` (Phase 17 schema). A watch whose catalog row was wiped (Phase 36 pattern) still has stale free-text `w.brand` but no `w.brandId` from the LEFT JOIN. Under (b) that watch would inflate its old brand's totals; under (a) it correctly drops out.
  - Cost: one small brands SELECT per rail load. Cached at request-time by the caller.

### Claude's Discretion

- **Exact plumbing of the fresh JOIN inside `upsertCatalogFromUserInput`**: could be a CTE extension with `RETURNING id, (SELECT name FROM brands WHERE id = brand_id) AS brand_name, ...` OR a follow-up SELECT after the upsert. Planner picks the SQL shape; the contract is that the helper returns `{ catalogId, brandName, familyName }` when successful.
- **Whether `getCatalogById` also gains the JOIN or a new sibling function like `getCatalogByIdWithCanonical` ships**: existing `getCatalogById` callers may not need the canonical names on every read. If backwards-compat matters, ship a sibling. Otherwise extend in place. Planner picks after auditing callers.
- **Where `brandNameLookup` is built in the recommender**: naturally inside `getRecommendationsForViewer` after `viewerWatches` are fetched — grep all `w.brandId` from viewer + seed watches, run a single `SELECT id, name FROM brands WHERE id IN (…)` and pass the resulting map to `topBrandOf` and rationale-building loops.
- **Whether the exclusion-set fallback `${brand}|${model}` stays or is stripped**: post-Phase-80 all catalog rows have brandId+familyId, so all watches with a non-null catalogId also have brandId+familyId via LEFT JOIN. The fallback is theoretically dead code. Planner may strip it if confident, or keep it as belt-and-suspenders — either is fine.
- **Test file organization**: recommendation tests could split unit-level (topBrandOf, exclusion-key format) from integration-level (DAL + JOIN behavior against local seeded Supabase). Planner picks whether to add a new integration test file or extend existing.
- **Whether `topBrandOf` gets a companion `topFamilyOf` for future use**: not required by RECO-03. Planner may defer or add opportunistically — recommend defer unless a specific caller shows up.
- **Whether to widen the whole Watch domain type or ship `brandId`/`familyId` as adjacent props**: locked to widening the type (D-81-02). Planner picks how mapRowToWatch handles the LEFT JOIN nullable case (default `undefined` vs explicit null).

### Folded Todos

None folded — no todo backlog items match Phase 81's recommender/display swap scope. Phase 81 scope is fully mapped by RECO-01..04 + DISP-01/02 from the v8.4 requirement set.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v8.4 Milestone Inputs (mandatory)

- `.planning/REQUIREMENTS.md` — full milestone decisions D-01..D-08, RECO-01..04 + DISP-01/02 requirement language, "Out of Scope" table (specifically the `Removal of watches.brand/model` row explaining why the columns stay).
- `.planning/ROADMAP.md` § Phase 81 — 5 success criteria + depends-on note. Success criterion #5 ("no measurable p95 regression on the home rail per Phase 19.1 baselines") is the acknowledged perf constraint.
- `.planning/seeds/SEED-021-catalog-brand-model-canonicalization.md` — origin signal. Phase 81 delivers the "recommender + display" half of the SEED-021 promise.

### Phase 78 / 79 / 80 Carryforward (mandatory)

- `.planning/phases/80-not-null-constraint-flip-ingest-hardening/80-CONTEXT.md` — Phase 80's locked D-80-01..D-80-04. Phase 81 inherits:
  - D-80-04 (silent contract — no API response shape change): the resolver return shape stays silent; Phase 81's canonical-name extension is on the upsert helpers' return type, NOT on the extract-watch route response.
  - D-80-01 (resolver decision types): the resolver returns `{ brandId, decision }` — Phase 81 can extend the return to `{ brandId, brandName, decision }` without touching the discriminated-union decision shape.
- `.planning/phases/79-backfill-migration-display-hydration/79-CONTEXT.md` — Phase 79 shipped DISP-03 (one-shot canonical hydration of existing `watches.brand` / `watches.model`). Phase 81 is the FORWARD-LOOKING canonicalization; NO second backfill needed. All existing rows are already canonical.
- `.planning/phases/78-schema-additions-operator-resolve-queue/78-CONTEXT.md` — Phase 78's D-78-04 (exact-only auto-resolve philosophy). Not directly on Phase 81's path but is the ancestor of Phase 80's D-80-01 which shapes the resolver return contract Phase 81 extends.

### Existing Recommender Code (mandatory — Phase 81 modifies these directly)

- `src/data/recommendations.ts` — the DAL. Phase 81 modifies:
  - `getRecommendationsForViewer` (L90–288): exclusion-set builder (L196–205) switches to `brandId|familyId` keys; `norm()` helper renamed / re-scoped; `viewerOwnedBrandsLower` (L116–120) becomes `viewerOwnedBrandIds: Set<string>`; brandNameLookup Map built after `viewerWatches` fetch.
  - `topUpFromCatalogPopularity` (L390–533): both SELECTs gain INNER JOINs to `brands` + `watch_families`; the owned-brand IN clause switches from string comparison to `brand_id IN (…)`; synthetic Watch (L509–520) uses canonical `brand` + `model` from the JOINs.
- `src/lib/recommendations.ts` — the pure-function helpers. Phase 81 modifies:
  - `topBrandOf` (L96–106): signature widens to accept brandNameLookup Map, returns `{ brandId, brandName } | null` (was `string | null`).
  - `rationaleFor` (L53–92): reads `ctx.candidateBrand` unchanged; the correctness change is that `candidateBrand` is now guaranteed canonical by the caller (DISP-01/02 for personal watches, INNER JOIN for synthetic top-up watches). No signature change to `RationaleContext`.
  - `dominantStyleOf` + `topRoleOf`: NOT modified — RECO-04 doesn't gate on brand for style/role templates.

### Existing Server Actions (mandatory — Phase 81 modifies these directly)

- `src/app/actions/watches.ts` § `addWatch` (L97–end of function, esp. L141–177):
  - CatalogId branch (L141–157): change `cleanData.brand = catalogRow.brand` → `cleanData.brand = catalogRow.canonicalBrand` (from the extended `getCatalogById`). Same for `model`. Same for `reference`? — NO, reference is already canonical from catalog per D-10 override (line 155) — leave it.
  - User-input branch (L158–177): after `upsertCatalogFromUserInput` returns `{ catalogId, brandName, familyName }`, add `cleanData.brand = brandName` and `cleanData.model = familyName` BEFORE `createPayload` is built (L181).
- `src/app/actions/watches.ts` § `editWatch` (L553–704):
  - Add a canonical-name overwrite path BEFORE the DB write (before L620's `updatedWatch` assignment). If `parsed.data.brand` or `parsed.data.model` was edited AND the watch has a `catalogId` (via `priorRow.catalogId`), fetch canonical strings via extended `getCatalogById` and overwrite in `updatePayload`.
  - Non-catalog-linked watches (`priorRow.catalogId = null`): DISP-01/02 don't literally apply — leave the user's typed strings. This is the ON DELETE SET NULL edge case; existing rows shouldn't hit this post-Phase-80.

### Existing Catalog Helpers (mandatory — Phase 81 modifies these directly)

- `src/data/catalog.ts` § `upsertCatalogFromUserInput` (L139–170): return type `Promise<string | null>` → `Promise<{ catalogId: string; brandName: string; familyName: string } | null>`. The CTE either extends its RETURNING to include brand_name/family_name via subqueries OR the helper runs a follow-up SELECT after the CTE returns catalogId.
- `src/data/catalog.ts` § `upsertCatalogFromExtractedUrl` (L184–end): same return-type extension. NOT used by Phase 81 Server Actions directly — this helper is called by `/api/extract-watch/route.ts` which currently discards the return value except for `catalogIdError`. But extending the return preserves consistency across the two upsert helpers.
- `src/data/catalog.ts` § `getCatalogById` (find it): extend to LEFT JOIN `brands` + `watch_families` and expose `canonicalBrand: string` + `canonicalFamily: string` on the returned row.

### Type Model (mandatory — Phase 81 modifies)

- `src/lib/types.ts` § `Watch` interface (L51–115): add `brandId?: string` and `familyId?: string` optional fields. Position them near `catalogId` (L93) since they're derived from the same JOIN.
- `src/data/watches.ts` § `mapRowToWatch` (find it, likely near `getWatchesByUser`): propagate the new fields from the LEFT JOIN result.

### Schema Starting State (read-only — Phase 81 reads these, doesn't modify)

- `src/db/schema.ts` § `watchesCatalog` (L488–511) — `brand_id` + `family_id` are NOT NULL post-Phase-80. Every catalog row is guaranteed to have both FKs populated. Phase 81's INNER JOINs are safe (never lose rows to NULL FKs).
- `src/db/schema.ts` § `brands` (L519–538) — `name` is the canonical string. `nameNormalized` is a GENERATED column not used in Phase 81 (JOIN targets use `id`).
- `src/db/schema.ts` § `watchFamilies` (L540–564) — `name` is the canonical string. `aliases` is used by Phase 80's ingest resolver, NOT by Phase 81.
- `src/db/schema.ts` § `watches` (L154 region) — `catalogId` FK `onDelete: 'set null'` — the reason exclusion-set retains a `${brand}|${model}` fallback path (L2 of D-81-02).

### Local-First Verification (mandatory)

- `CLAUDE.md` § Local-First Development — the gate. Phase 81 is a runtime-behavior change with silent-bug risk (self-in-own-rail). D-81-04's local walkthrough is the primary gate. Skip the local walkthrough only if there's an explicit exception per CLAUDE.md; there isn't one here.
- Memory: `[[local-first-dev]]` — same rule. Phase 81 is a canonical "unit tests + build won't catch this" case; the JOIN-through-brand exclusion key is exactly the class of runtime bug that broke prod at the Drizzle SQL ANY incident.
- Memory: `[[drizzle-sql-any-array-pitfall]]` — Phase 81's owned-brand-IN clause SWITCHES from strings to brandIds. Same pattern as the existing code (uses `IN (sql.join(...))` shape). Verify the SQL prints correctly against local Supabase before push. The reference implementation is already correct at `src/data/recommendations.ts` L454–458 — Phase 81's version is a column swap, not a pattern change.

### Perf Baselines (mandatory)

- Phase 19.1 recommender p95 baselines (referenced in ROADMAP Phase 81 success criterion #5 + CANON-V2-01 defer rationale in REQUIREMENTS.md). Phase 81 adds two INNER JOINs to `topUpFromCatalogPopularity`'s queries + one small `SELECT id, name FROM brands WHERE id IN (…)` for the brandNameLookup. Total DB round-trips per rail load: unchanged from Phase 75 baseline (the lookup fits within the existing `getWatchesByUser` cluster of calls). If planner suspects regression, run the rail against local seeded catalog (~205 rows) with 15+ public collectors and compare against the seeded baseline.

### Critical Memories (additional)

- Memory: `[[next-clear-operational-debt]]` — `workflow.use_worktrees=false` globally. Phase 81 is build-gated + runtime-behavior. No worktrees.
- Memory: `[[next16-revalidatetag-deprecated]]` — Phase 81 does NOT add new invalidation calls. The existing `updateTag(\`viewer:${user.id}:recs\`)` calls in `addWatch` (find via grep) and `editWatch` (L676) stay unchanged. Phase 81 only changes the STRING CONTENT written into `watches.brand`/`model`, not the cache invalidation semantics.
- Memory: `[[accent-is-active-token]]` — irrelevant to Phase 81 (no UI change).
- Memory: `[[catalog-id-divergence]]` — irrelevant. Phase 81 doesn't do any local-to-prod ID translation; all JOINs are by FK relationship, portable across DBs.
- Memory: `[[verdict-hidden-on-owned-watches]]` — orthogonal but adjacent. Phase 81's rail exclusion applies to ANYONE's watch appearing in the viewer's rail, not just the owned-vs-viewed verdict framing.

### Test Pattern Precedents

- `src/data/__tests__/recommendations.test.ts` — extend for new exclusion-key format + brandNameLookup wiring.
- `src/lib/__tests__/recommendations.test.ts` (if exists) — extend for `topBrandOf` signature change.
- `src/app/actions/__tests__/watches.test.ts` (if exists) — extend for DISP-01/02 auto-overwrite behavior.
- Phase 78 / 79 / 80 patterns for local-first integration test recipes (fixture SQL + walkthrough script). Phase 81 uses the same discipline but no new migration to test.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/data/catalog-resolver.ts`** (Phase 80) — the resolver already produces `brandId` + `familyId`. Phase 81 does NOT modify it; instead extends the CALLING helpers (`upsertCatalogFromUserInput` + `upsertCatalogFromExtractedUrl`) to also return canonical names. The resolver contract stays shipped-as-is.
- **`src/data/catalog.ts` § `upsertCatalogFromUserInput` (L139–170) and `upsertCatalogFromExtractedUrl` (L184+)** — the two catalog upsert entry points. Phase 81 extends the return type in both.
- **`src/data/watches.ts` § `getWatchesByUser` LEFT JOIN on `watchesCatalog` (L159)** — the existing JOIN infrastructure Phase 81 piggybacks on for `brandId` + `familyId` projection. No new query.
- **`src/data/recommendations.ts` § `topUpFromCatalogPopularity` line 454's `IN (sql.join(...))` shape** — the ANTI-PITFALL-CORRECT reference implementation of "IN clause with a JS array." Phase 81's brand_id IN clause uses the same shape.
- **`src/lib/recommendations.ts` § `rationaleFor` + `dominantStyleOf` + `topRoleOf`** — pure functions with no I/O. Phase 81 only modifies `topBrandOf`. The rest are RECO-04-neutral (they don't render brand strings).
- **`updateTag(\`viewer:${user.id}:recs\`)`** existing invalidation in `addWatch` + `editWatch` — Phase 81 doesn't touch cache-invalidation semantics.

### Established Patterns

- **`server-only` + service-role writes** on Server Actions — Phase 81's Server Action changes stay inside the existing auth boundary.
- **Fail-loud on catalog upsert failure** in `addWatch` (L170–175) — Phase 81 preserves this. If the extended upsert helper's return type shifts to `{ catalogId, brandName, familyName }`, the fail-loud path still fires when the result is `null`.
- **`Watch` domain type carries optional catalog-derived fields (`catalogId`, `catalogTaste`)** — Phase 81 extends the pattern with `brandId` + `familyId`, projected the same way.
- **`ActionResult<T>` return type** on Server Actions — Phase 81 doesn't change error surfaces.
- **`revalidatePath('/') + updateTag(…recs) + revalidateTag('profile:…', 'max') + revalidateTag('explore', 'max')`** invalidation fanout — Phase 81 preserves.
- **Drizzle `sql\`= ANY(${arr})\`` pitfall avoidance** (`[[drizzle-sql-any-array-pitfall]]`) — the existing `IN (sql.join(...))` shape at `recommendations.ts` L454 is the reference. Phase 81's owned-brand IN clause uses the same shape with brand_id values.
- **Cache Components + Server Actions read-your-own-write via `updateTag`** — Phase 81 doesn't change the invalidation graph; the string-value change is captured by the same invalidation tags that fire today.

### Integration Points

- **Phase 80's resolver + NOT NULL FKs** — Phase 81 reads `brand_id` + `family_id` under the guarantee that they're populated on every catalog row. The INNER JOINs in `topUpFromCatalogPopularity` cannot lose rows.
- **Phase 79's DISP-03 backfill of existing `watches.brand`/`model`** — every existing personal watch already has canonical strings. Phase 81's DISP-01/02 covers forward writes only.
- **Phase 75's rec-rail cache-key model (viewerId keyed, updateTag invalidation)** — Phase 81's string-content changes are captured by the existing invalidation tags. No new cache keys.
- **Phase 82's admin-merge action** — will UPDATE `brand_id` across referencing `watches_catalog` rows in a single transaction. Phase 81's read-time JOIN in `topUpFromCatalogPopularity` naturally picks up the post-merge canonical names on the next rail refresh (no additional Phase 81 code needed).
- **AddWatchFlow + WatchForm** — client-side UNCHANGED. The auto-overwrite is server-only.

</code_context>

<specifics>
## Specific Ideas

- **Hamilton drift-loop closes end-to-end here.** Phase 79 merged `Hamilton Watch` → canonical `Hamilton` in prod. Phase 80's ingest resolver ensures future extracts land on the canonical row. Phase 81's RECO-01 ensures the rail exclusion keys on the canonical `brand_id` regardless of any residual denorm drift. And DISP-01/02 ensures the personal `watches.brand` column never displays `Hamilton Watch` again — even if the user types it, canonical `Hamilton` wins on save.
- **The fixture recipe uses `Hamilton` as canonical + `Hamilton Watch` as drift denorm.** Tyler confirmed direction during discuss. Local Hamilton drift was already resolved in Phase 79 `--apply`; the fixture reintroduces a synthetic drift `watches_catalog` row for local test purposes only. Do NOT commit the fixture SQL as a migration — it's a test-time INSERT via psql or a vitest integration setup, not a permanent schema change.
- **Two JOINs, not a subquery, for `topUpFromCatalogPopularity`.** INNER JOIN keeps row count intact under Phase 80's NOT NULL guarantee (safe). Postgres query planner handles this cleanly with the existing brand_id / family_id btree indexes.
- **`brandNameLookup` is scoped to viewer's owned brands.** Not the full `brands` table. `SELECT id, name FROM brands WHERE id IN (…viewer's brandIds…)` — typical viewer has 5–30 brands owned, so the lookup is 5–30 rows. Trivial.
- **The two-branch overwrite in `addWatch` shares a single JOIN helper.** Both catalogId branch (L141–157, currently reads `catalogRow.brand`) and user-input branch (L158–177, currently reads `parsed.data.brand`) need to end up with canonical `cleanData.brand`. The extended `getCatalogById` covers the first branch; the extended `upsertCatalogFromUserInput` return covers the second. Same canonical source of truth (`brands.name` via `brand_id`), two entry paths.
- **Legacy watches with `catalogId = null` bypass the overwrite.** Phase 17's `onDelete: 'set null'` means a wiped catalog row leaves a watch with null catalogId. These rows can't be auto-overwritten because there's no FK to resolve. DISP-01/02 gracefully no-ops on them — the user's typed strings persist. This matches the existing behavior of Phase 79 DISP-03 hydration (which also skipped null-catalogId rows).

</specifics>

<deferred>
## Deferred Ideas

- **Write-time sync of `watches_catalog.brand` / `watches_catalog.model` to canonical.** Rejected for Phase 81 (D-81-03 chose read-time JOIN only). Phase 82's admin-merge action (OPS-01) will naturally UPDATE these when it moves catalog rows to a new brand_id. If drift becomes visible in other surfaces post-Phase-81, revisit as a Phase 82+ concern.
- **Denormalizing `brand_id` onto `watches` table** (CANON-V2-01). Explicitly deferred in REQUIREMENTS.md. Phase 81's JOIN-through-catalogId path is the read path per D-06.
- **`brand_aliases text[]` column on `brands` parallel to `watch_families.aliases`** (CANON-V2-02). Deferred at v8.4 kickoff.
- **`topFamilyOf` companion to `topBrandOf`.** Not required by RECO-03. Consider opportunistically only if a downstream caller needs it (e.g., a future SEED-001 family-level recommender). Not Phase 81.
- **Full recommender bulk-JOIN query** (Area 2 option b variant) — collapsing the per-owner `getWatchesByUser` calls into a single JOIN. Scope expansion beyond Phase 81; would introduce a new query shape. Revisit if p95 regression surfaces on the current N+1 pattern.
- **Stripping the `${brand}|${model}` exclusion-set fallback** post-migration. Kept as belt-and-suspenders for the ON DELETE SET NULL edge case; planner may strip if confident (Claude's Discretion above).
- **Auto-refreshing brandNameLookup within a request via a cached DAL helper**. Trivial to add if a second call site emerges (e.g., Explore rail). Phase 81 keeps it inline in `getRecommendationsForViewer`.
- **Adding `familyName` alongside `brandName` to the Recommendation type**. Not required by any Phase 81 requirement (rationale templates only substitute `{brand}`). Adjacent future work if RECO-04 evolves.

</deferred>

---

*Phase: 81-Recommender + Display Server Action Swap*
*Context gathered: 2026-07-12*

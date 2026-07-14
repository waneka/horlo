# Phase 81: Recommender + Display Server Action Swap - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 81-recommender-display-server-action-swap
**Areas discussed:** Canonical-name source on writes, Watch type + DAL projection, Catalog denorm brand/model sync, Deploy + local-first verification, topBrandOf implementation

---

## Canonical-name source on writes

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Extend Phase 80 resolver return type | Resolver returns `{ brandId, brandName, decision }` + `{ familyId, familyName, decision }`. Name comes from the SELECT/INSERT the resolver already runs. Server Actions read it inline. Touches resolver contract. | |
| (b) Fresh JOIN after upsert returns catalogId | Small dedicated JOIN through catalog → brands + watch_families to fetch canonical names. Decouples write path from resolver. Adds one round-trip per add/edit but also fixes the catalogId-branch bug where addWatch reads denorm brand. | ✓ |
| (c) DB trigger on watches | BEFORE INSERT/UPDATE trigger auto-syncs brand/model from the FK JOIN. Application code writes anything and the trigger corrects it. Adds a trigger to a hot table. | |
| Let Claude pick | Recommend the option that best balances footprint, correctness, and testability against Phase 80's shipped code. | (routed to b) |

**User's choice:** "Let Claude pick" — Claude selected (b).
**Notes:** (a) only fixes the resolver-driven addWatch branch; the catalogId-supplied branch (L141–157) reads `catalogRow.brand` which is the DENORM column — the exact drift source. (b) works uniformly for both branches. (c) trigger interacts poorly with the service-role write pattern and Supabase function-pinning gotchas. Cost of (b) is negligible (~1 extra SELECT per add/edit against 4-5 existing DB calls in that path).

---

## Watch type + DAL projection

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Extend Watch with optional brandId/familyId | Add optional fields to Watch interface; project through getWatchesByUser. Recommender loops key on w.brandId. Small back-compat change (fields optional). Test fixtures that construct Watch may need updates. | ✓ |
| (b) Recommender-private row type | Don't touch Watch. Recommender uses its own query that projects brandId/familyId/brandName. Localized to src/data/recommendations.ts. topBrandOf either stays on Watch (with lookup) or splits into a private variant. | |
| Let Claude pick | Recommend based on blast radius, testability, and future-use fit. | (routed to a) |

**User's choice:** "Let Claude pick" — Claude selected (a).
**Notes:** FK ids are canonical DOMAIN identity, not a recommender-private concern. Explore rail, similarity engine, add-watch dedupe path — anything future that needs FK-keyed comparisons — deserves them at Watch level. Ship (a) once, all future canonical-keyed features read `w.brandId` for free. Blast radius small: `getWatchesByUser` already LEFT JOINs `watchesCatalog` at line 159; just add two columns to the SELECT. Fields optional — existing test fixtures don't break.

---

## Catalog denorm brand/model sync

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Read-time JOIN only | topUpFromCatalogPopularity's query JOINs to brands + watch_families and uses canonical names in the synthetic Watch. Write paths untouched. Cheap. Legacy rows still hold free-text in the denorm column but the rail never sees it. | ✓ |
| (b) Write-time sync only | Extend catalog upsert helpers to overwrite watches_catalog.brand/model from canonical on every INSERT + ON CONFLICT UPDATE. Fresh writes are always canonical. Existing rows drift until re-upserted. | |
| (c) Both — read + write | Belt-and-suspenders. Read-time JOIN covers legacy long tail; write-time sync prevents new drift. Most work but closes the loop end-to-end. | |
| (d) Accept drift for Phase 82 | Phase 82's /admin/brands merge sweeps the drift. Phase 81 leaves it — but rail rationale keeps showing free-text until operator cleans up. | |

**User's choice:** "go with your rec" — Claude selected (a).
**Notes:** Two JOINs on an already-LIMIT-60 query are negligible cost. (b) mixes canonical identity overwrite with the ON CONFLICT UPDATE's COALESCE-enrichment semantics — muddies both. (c) is unnecessary defense given DISP-01/02 keeps personal `watches.brand` canonical. (d) violates Phase 81's own contract. `watches_catalog.brand`/`model` denorm columns left untouched by Phase 81; Phase 82 admin-merge action naturally propagates canonical to catalog rows over time.

---

## Deploy + local-first verification

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Fresh local drift fixtures | Seed a watches_catalog row with brand='Hamilton Watch' + canonical Hamilton brand_id, seed a personal watch with brand='Hamilton', verify recommender excludes it. Full runtime test against local dev + local Supabase. | |
| (b) Unit tests only | Extend recommendations.test.ts with jsdom fixtures. Fast + deterministic but no runtime DB verification — same class of test that missed the Drizzle SQL ANY bug. | |
| (c) Combine unit tests + local fixtures | Unit tests for pure JS logic + local-first integration verification with a hand-crafted drift row exercising the full JOIN + RSC render. Belt-and-suspenders. | ✓ |
| Let Claude pick | Recommend based on Phase 81's runtime risk profile and local-first rule. | (routed to c) |

**User's choice:** "claude can pick but to be clear the canonical name should just be 'Hamilton' not 'Hamilton Watch' for this one specific case" — Claude selected (c). User's clarification about Hamilton as canonical (post-Phase 79 merge) confirmed the fixture direction.
**Notes:** Silent-bug risk (self-in-own-rail) is high and not covered by build/type gates. This is the `[[drizzle-sql-any-array-pitfall]]` reprise: unit tests + `next build` accepted syntactically-broken SQL that crashed prod. Phase 81 has the same failure mode with new brand/family JOINs. Local-first is the primary gate. Bundled prod deploy is fine (no schema change). Fixture: INSERT a `watches_catalog` row with `brand = 'Hamilton Watch'` on canonical Hamilton `brand_id`; a personal watch on canonical Hamilton `brand`; a peer collector who owns the drift row.

---

## topBrandOf implementation

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Count on w.brandId | Literal RECO-03 read — topBrandOf iterates and counts by brandId, returns canonical brand name via lookup (passed in from DAL). Safe against any residual free-text edge cases. | ✓ |
| (b) Keep counting on w.brand | DISP-01/02 makes w.brand canonical on all writes, and Phase 79 backfilled existing rows. So w.brand IS the canonical string. Simpler, no signature change to a pure function used by tests. | |
| Let Claude pick | Recommend based on Phase 81's contract and residual-drift risk. | (routed to a) |

**User's choice:** "Let Claude pick" — Claude selected (a).
**Notes:** Literal RECO-03 satisfaction plus one real edge case (b) can't cover: `watches.catalogId` is `ON DELETE SET NULL` per Phase 17 schema. If a catalog row was ever wiped (Phase 36 pattern), the personal watch has stale free-text `w.brand` but no `w.brandId` from the LEFT JOIN. Under (b) it inflates old brand's totals; under (a) it correctly drops out. Also makes the "canonical is source of truth" contract visible in the signature.

---

## Claude's Discretion

Ceded to planner:
- Exact SQL plumbing of the JOIN inside `upsertCatalogFromUserInput` (CTE extension via RETURNING vs follow-up SELECT).
- Whether `getCatalogById` gains the JOIN in place or a sibling `getCatalogByIdWithCanonical` ships.
- Exact location where `brandNameLookup` is built in the recommender (recommended: inside `getRecommendationsForViewer` after viewer + seed watches are known).
- Whether to strip the `${brand}|${model}` exclusion-set fallback (theoretically dead post-Phase-80, but harmless).
- Test file organization (unit vs integration split; whether new test file lands).
- Whether to add `topFamilyOf` opportunistically (recommend defer).
- How `mapRowToWatch` handles the LEFT JOIN nullable case for `brandId`/`familyId` (default `undefined` vs explicit null).

Ceded to Claude (during discussion):
- All four gray areas + follow-up: Canonical-name source, Watch type model, Catalog denorm, Verification strategy, topBrandOf shape. User consistently deferred to Claude's recommendation.

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:
- Write-time sync of `watches_catalog.brand/model` (Phase 82+ concern).
- `brand_id` denormalized onto `watches` table (CANON-V2-01 already deferred at v8.4 kickoff).
- `brand_aliases text[]` column (CANON-V2-02 already deferred).
- `topFamilyOf` companion function.
- Full recommender bulk-JOIN query (scope expansion beyond Phase 81).
- Stripping the exclusion-set string fallback.
- Cached DAL helper for brandNameLookup.
- `familyName` on the Recommendation type.

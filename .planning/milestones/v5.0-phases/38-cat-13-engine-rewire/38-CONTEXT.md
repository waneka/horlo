# Phase 38: CAT-13 Engine Rewire - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `analyzeSimilarity()` in `src/lib/similarity.ts` to consume the 8 LLM-derived taste columns on `watches_catalog` (Phase 19.1) as an **additive 9th scoring dimension at weight 0.20**, gated on `confidence >= 0.5`. Phase 19.1's structured taste signature stops being silent infrastructure and starts producing observable behavior in collection fit verdicts for the first time.

**In scope (locked by ROADMAP §Phase 38 + CAT-13 + this discussion):**

1. **Drizzle `watches.catalogId .notNull()` tightening** (deferred from Phase 36 Plan 01 Rule 4 / Phase 37) — cascades to `createWatch` DAL signature change (catalogId becomes required), **three** production call sites must upsert catalog BEFORE `createWatch` (`src/app/actions/watches.ts:121` `addWatch`, `src/app/actions/wishlist.ts:124` `addWishlistWatch`, plus the DAL definition `src/data/watches.ts:197`), and ~17 integration test fixture updates. Lives as **Plan A** (Wave 1) so engine rewire (Plan B) ships against a clean type system. *(Researcher correction 2026-05-12: CONTEXT-original mistakenly named `src/app/api/extract-watch/route.ts` as a callsite — that file does NOT call `createWatch`; the third callsite is `wishlist.ts:124`.)*

2. **`Watch` type extension** — `Watch.catalogTaste: CatalogTasteAttributes | null` reusing the existing interface at `src/lib/types.ts` lines 214–223 (single source of truth per D-07).

3. **DAL JOIN** — `getWatchesByUser` in `src/data/watches.ts` LEFT JOINs `watches_catalog` and populates `catalogTaste` on every Watch returned. Engine, composer, and test code all consume the same shape.

4. **Test-first static guards (CAT-13 requirement #1 + #2):**
   - `tests/static/similarity.taste-null.test.ts` — asserts engine output is byte-identical to pre-rewire baseline when `catalogTaste` is null OR `confidence < 0.5`
   - `tests/static/similarity.taste-present.test.ts` — asserts engine produces a higher alignment score for taste-compatible watch pairings vs taste-incompatible pairings when `catalogTaste` is present AND `confidence >= 0.5`
   - Both must pass BEFORE any change to `similarity.ts`, AND both must pass AFTER the rewire (the rewire satisfies the guards, not just the pre-condition).

5. **Engine rewire** — `src/lib/similarity.ts` `WEIGHTS` object reweighted so existing 8 dimensions sum to **0.80** (preserving relative proportions); new 9th `taste` dimension weighted **0.20** total, internally split as: numeric trio cosine 0.08 (formality + sportiness + heritageScore) + archetype categorical match 0.04 + era categorical match 0.04 + motifs Jaccard 0.04. Goal-aware thresholds remain unchanged (locked at current `coreFit` / `familiarTerritory` / `roleConflict` values).

6. **Composer-engine alignment test** — new `tests/static/composer-engine-alignment.test.ts` runs ~10 fixture scenarios through BOTH `CollectionFitCard`'s verdict composer AND `analyzeSimilarity()`, asserting verbal verdict (Core Fit / Familiar Territory / Role Conflict / Hard Mismatch) and numeric `SimilarityLabel` agree across taste-null / confidence<0.5 / confidence≥0.5 cases.

**Not in scope (deferred):**

- **Composer threshold recalibration** — Phase 20 composer already gates at 0.5/0.7. After Phase 38, if the alignment test surfaces disagreements, capture them as Phase 39 Polish items (D-04 explicitly chose static-test-with-fix, not a separate phase, but composer-side bug fixes uncovered by the test belong in Polish).
- **CAT-13 v6.x collaborative-filtering optimization** — explicitly deferred to SEED-002 (hybrid recommender) per REQUIREMENTS.md "Deferred Ideas."
- **FIT-05** ("Compare with the [X] you own" pairwise drill-down in CollectionFitCard) — Phase 39 territory; depends on Phase 38 surfacing taste-attribute rows in the verdict, but the drill-down UI is separate scope.
- **Goal-aware taste weighting** — `GOAL_THRESHOLDS` map could in principle scale the 0.20 taste weight by collection goal (e.g., "specialist" weights taste heavier, "variety-within-theme" weights it lighter). Phase 38 ships uniform 0.20 across all 4 goals. Goal-aware taste weighting is a future polish lever.
- **Per-archetype motif weighting** — design motifs are a closed vocab from `src/lib/taste/vocab.ts`; Jaccard treats all motifs equally. A future enrichment phase could weight motifs by archetype rarity. Not in Phase 38.
- **Engine output schema changes** — `SimilarityResult` shape stays unchanged. `SimilarityLabel` enum stays unchanged. New taste dimension contributes to the existing numeric `score`; it does NOT add a new field or label.

**ROADMAP success criteria coverage** (verbatim from `.planning/ROADMAP.md` §Phase 38):

1. ✓ `tests/static/similarity.taste-null.test.ts` written and passes BEFORE any change to `similarity.ts` — covered by Plan B Wave 1 Task 1 (write test → assert byte-identical → THEN edit engine)
2. ✓ `tests/static/similarity.taste-present.test.ts` written and passes BEFORE any change to `similarity.ts` — covered by Plan B Wave 1 Task 2 (directional assertion: taste-compatible pairings score higher than taste-incompatible)
3. ✓ Both guards continue passing AFTER `similarity.ts` is modified — covered by Plan B Wave 2 (engine rewire) re-running the test suite
4. ✓ `Watch.catalogTaste` field added; `getWatchesByUser` LEFT JOIN — covered by Plan B Task 0 (DAL + type changes BEFORE engine changes)
5. ✓ `tests/static/CollectionFitCard.no-engine.test.ts` boundary unchanged; `extractWithLlm()` D-07 byte-lock survives untouched — covered by static test re-runs in Plan C verify

**Why this phase matters (user-facing value):**

- A collector evaluating a new watch against their collection currently gets a verdict driven by **what they themselves tagged** — which is incomplete (most users don't tag everything) and shallow (a Submariner and a Sub-clone might share user tags but feel completely different). After Phase 38, the same verdict also draws on the LLM's structured read of the **reference itself** — its formality, sportiness, heritage weight, archetype, era, design motifs.
- Two practical wins:
  1. **Verdicts get smarter without users doing more tagging.** A Speedy and a Daytona might both be "racing-chronograph" by user tag, but the engine will see one as heritage-tool-watch and the other as luxury-sport — and reflect that in the Core Fit / Role Duplicate / Hard Mismatch label.
  2. **The "I haven't tagged anything" cold-start case starts working.** A new collector who hasn't filled in style/role yet still gets meaningful verdicts because the engine has the catalog's taste signature.
- **The insight engine — which is *the* product per `.planning/PROJECT.md` Core Value — gets meaningfully more accurate the first time it ships taste-aware.**
- Phase 38 is also the prerequisite for FIT-05 (CollectionFitCard pairwise drill-down) and v6.0 SEED-002 (hybrid recommender), both of which consume taste signatures rather than per-user tags.

</domain>

<decisions>
## Implementation Decisions

> **Decision IDs:** Phase 38 uses the `D-NN` prefix.

### Carried forward from prior phases (locked — do NOT re-litigate)

- **Phase 19.1 D-07 — `extractWithLlm()` byte-lock:** Phase 38 does NOT touch `src/lib/extractors/llm.ts`. The taste extraction path stays as-is; only the consumer (similarity.ts) changes.
- **Phase 19.1 D-13 — confidence semantics:** `confidence >= 0.5` is the project-wide gate for taste consumption. Phase 20 composer uses 0.5 (and 0.7 for the two-tier copy threshold). Phase 38 D-02 keeps the engine on the same 0.5 gate for alignment.
- **Phase 20 FIT-04 — CollectionFitCard pure-renderer:** No engine imports inside the React component. `tests/static/CollectionFitCard.no-engine.test.ts` enforces this. Phase 38 does NOT break this boundary; the composer-engine alignment test (D-04) calls them as separate library functions, not through the component.
- **Phase 20 viewerTasteProfile:** Already aggregates user collection taste at `confidence >= 0.5`. Phase 38 engine reads INDIVIDUAL watch's `catalogTaste`, not the aggregate. Different surface, same gate.
- **Phase 36 Plan 01 Rule 4 / Phase 37 deferral — `watches.catalogId .notNull()` tightening:** Phase 38 owns this. Cascade: 18 tsc errors + ~17 integration test fixture updates + `createWatch` DAL signature change (catalogId becomes required) + **three** production call sites must upsert catalog BEFORE `createWatch`. The call sites are: manual entry (`src/app/actions/watches.ts:121` `addWatch`), wishlist add (`src/app/actions/wishlist.ts:124` `addWishlistWatch`), and the DAL definition itself (`src/data/watches.ts:197`). `upsertCatalogFromUserInput` is already available from Phase 17 for both action paths. The work is reordering, not new functionality. *(Researcher correction 2026-05-12: original CONTEXT named `extract-watch/route.ts` — that route does NOT call `createWatch`. The correct third callsite is `wishlist.ts:124`.)*
- **Phase 17 D-06 — public-read RLS on `watches_catalog`:** The DAL JOIN doesn't need elevated permissions; existing public-read policy covers SELECT.
- **Phase 17 D-13 — first-write-wins on `watches_catalog`:** Phase 38 does NOT write to `watches_catalog`. Read-only JOIN.

### Engine math (Area 1 — D-01 through D-05)

- **D-01 — Taste dimension weight = 0.20 total; existing 8 dimensions reweight to 0.80 sum:**
  Current `WEIGHTS` in `src/lib/similarity.ts` lines 10–19 sums to exactly 1.00 (styleTags 0.25 + designTraits 0.20 + roleTags 0.20 + dialColor 0.10 + complications 0.10 + caseSize 0.05 + strapType 0.05 + waterResistance 0.05). Multiply each by 0.80 to preserve relative proportions: styleTags 0.20, designTraits 0.16, roleTags 0.16, dialColor 0.08, complications 0.08, caseSize 0.04, strapType 0.04, waterResistance 0.04, **taste 0.20** — total 1.00. Threshold semantics (`coreFit` / `familiarTerritory` / `roleConflict`) remain unchanged because the total weight budget is preserved.
  Rationale: LLM-derived structured taste is worth more than `dialColor + complications` combined (0.08 + 0.08 = 0.16). Heavier signal recognition for the catalog-side investment.

- **D-02 — Confidence gate is binary at 0.5:**
  `if (confidence === null || confidence < 0.5) → taste contribution = 0` (engine falls back to byte-identical 8-dimension behavior). `if (confidence >= 0.5) → taste contribution = full 0.20 weight`. No linear scaling, no two-tier gradient.
  Rationale: matches Phase 20 composer's primary threshold; simplest test design; clear inferential semantics. Two-tier gating (0.5/0.7) was considered for verbal-numeric alignment but rejected — Phase 20 composer's 0.7 threshold is about COPY confidence ("we can say this with conviction"), not contribution strength.

- **D-03 — Taste 0.20 weight internal distribution — equal split + averaged components:**
  Internal breakdown:
  - **Numeric trio cosine = 0.08** — cosine similarity on `[formality, sportiness, heritageScore]` (each 0..1). Null-safe: if any of the 3 are null on either watch, drop that watch's contribution (return 0 for the pair). Both watches must have all 3 numerics for cosine to fire.
  - **Archetype categorical match = 0.04** — `primaryArchetype` exact match → 1.0; mismatch → 0.0; null on either side → 0.0. Closed vocab from `src/lib/taste/vocab.ts`.
  - **Era signal categorical match = 0.04** — `eraSignal` exact match → 1.0; mismatch → 0.0; null on either side → 0.0. Closed vocab from `src/lib/taste/vocab.ts`.
  - **Design motifs Jaccard = 0.04** — `designMotifs[]` intersection-over-union normalization (mirrors existing `arrayOverlap` helper at `src/lib/similarity.ts` lines 55–60). Empty array on either side → 0.0.
  Each sub-component normalized to 0..1 before the inner weight is applied; sum = 0.20.
  Rationale: equal value across the 4 component families (numeric trio, archetype, era, motifs) — none dominates. Numeric trio gets the 0.08 (twice the others) because it captures 3 fields combined. Researcher MAY override the internal split if prod taste-data distribution surfaces a clear imbalance (e.g., archetype has so much vocab coverage that 0.04 understates it) — but the OUTER 0.20 weight is LOCKED.

- **D-04 — Composer-engine alignment static test in Phase 38 (not deferred to Polish):**
  New `tests/static/composer-engine-alignment.test.ts` runs ~10 hand-crafted fixture scenarios through BOTH `CollectionFitCard`'s verdict composer (`src/lib/verdict/...`) AND `analyzeSimilarity()`, asserting the verbal verdict tier and the numeric `SimilarityLabel` agree. Scenarios MUST cover:
  - Taste-null pair (catalogTaste = null on one or both) → both gate to legacy behavior → must agree
  - Low-confidence pair (confidence < 0.5 on one or both) → same as taste-null → must agree
  - High-confidence taste-compatible pair (matching archetype + similar numerics) → composer should emit "Core Fit"-class copy; engine should emit `core-fit` or `familiar-territory`; must agree at tier level
  - High-confidence taste-incompatible pair (mismatched archetype + dissimilar numerics) → composer "Hard Mismatch" copy; engine `hard-mismatch`; must agree
  - Edge: confidence exactly = 0.5 — strict `>=` semantics (taste counts)
  - Edge: confidence exactly = 0.499... — strict `<` semantics (taste does not count)
  - Edge: empty designMotifs array — Jaccard returns 0; should not crash
  - At least 3 scenarios drawn from realistic Phase 19.1 prod taste data (researcher inspects + extracts examples)
  Test does NOT call into `CollectionFitCard.tsx` component (FIT-04 boundary preserved); it calls the underlying composer functions directly.
  Rationale: cheap insurance against verbal-numeric drift; surfaces composer bugs uncovered by the rewire; aligns Phase 38 with the broader product invariant ("verdict copy and badge always agree").

- **D-05 — `WEIGHTS` reweighting math is preserved via a single constant transformation:**
  Implementation must NOT hardcode the new 0.80-sum weights as magic numbers. Instead:
  ```typescript
  const EXISTING_WEIGHTS_BASE = { /* original 1.00-sum values */ }
  const TASTE_WEIGHT = 0.20
  const EXISTING_SCALE = 1.0 - TASTE_WEIGHT // 0.80
  const WEIGHTS = Object.fromEntries(
    Object.entries(EXISTING_WEIGHTS_BASE).map(([k, v]) => [k, v * EXISTING_SCALE])
  ) as typeof EXISTING_WEIGHTS_BASE
  ```
  Reason: future-proof — if v6.x decides taste should be 0.25 (collaborative-filtering layer), the change is one constant.
  Researcher may pick a different idiom that achieves the same property; the requirement is **no magic numbers for the rescaled values**.

### catalogId .notNull() tightening (Area 2 — D-06 through D-09)

- **D-06 — Plan A ships catalogId .notNull() FIRST in Phase 38 (separate plan from engine rewire):**
  Plan A scope:
  1. Drizzle `src/db/schema.ts` line 150 — `catalogId: uuid('catalog_id').notNull().references(...)`
  2. New supabase migration `supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql` (verified by researcher as next sequential timestamp after Phase 37's `20260511010000`) — `ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL` (Phase 36 already ran `SET NOT NULL` at the DB level; Drizzle just catches up to reality)
  3. Drizzle migration `drizzle/0011_phase38_catalog_id_notnull.sql` + journal idx=11 (researcher-verified next sequential)
  4. `createWatch` DAL signature change in `src/data/watches.ts:197` — `catalogId` becomes required parameter (was optional)
  5. **Three** production call sites updated:
     - `src/app/actions/watches.ts:121` `addWatch` — already calls `upsertCatalogFromUserInput`; verify ordering puts upsert BEFORE `createWatch`
     - `src/app/actions/wishlist.ts:124` `addWishlistWatch` — researcher recommends pass-through source `catalogId` rather than fresh `upsertCatalogFromUserInput` (wishlist watches typically inherit a catalog identity from the page they were added from; falling back to upsert is fine when the source has no catalogId)
     - `src/data/watches.ts:197` `createWatch` DAL definition itself — signature now requires non-null catalogId
  6. ~17 integration test fixture updates — each fixture that constructs a Watch row directly must now include `catalogId: <uuid>` (or seed a `watches_catalog` row first). Planner consumes RESEARCH.md §D-07 Commit Map for the exact file list.
  Plan B (engine rewire) depends_on Plan A.
  *(Researcher correction 2026-05-12: original CONTEXT named `extract-watch/route.ts` — that route does NOT call `createWatch`; the correct third callsite is `wishlist.ts:124`. CONTEXT-original "two callsites" should read "three (`watches.ts:121`, `wishlist.ts:124`, plus the DAL definition).")*

- **D-07 — Plan A test fixture commit strategy = one commit per test file family:**
  Group fixtures by file:
  - `tests/integration/phase17-*.test.ts` → one commit
  - `tests/integration/phase18-*.test.ts` → one commit
  - `tests/integration/phase19-*.test.ts` → one commit
  - `tests/integration/phase20-*.test.ts` → one commit
  - `tests/integration/phase22-*.test.ts` → one commit
  - `tests/integration/phase33-*.test.ts` / `phase34-*.test.ts` / etc. → one commit per phase family
  - Any `tests/unit/*` or `tests/static/*` fixture updates → one commit per test directory family
  Each commit MUST independently run `npx tsc --noEmit` clean AND `npx vitest run <file>` clean. Bisectable, reviewable, and incremental.
  Researcher confirms exact phase coverage by `grep -rn "createWatch\|catalogId:" tests/` and producing the list in RESEARCH.md.

- **D-08 — Plan A commit order — schema flip is LAST commit:**
  Order within Plan A:
  1. DAL signature change (`createWatch` required catalogId) — but Drizzle column still nullable; types still allow null. This is a TS compile-time change that catches all callsites.
  2. Two production call sites updated (upsert BEFORE create)
  3. 17 fixture updates (per D-07 commit strategy)
  4. **LAST:** Drizzle `.notNull()` flip + supabase migration + journal entry
  Reason: Phase 36 Plan 01 Rule 4 lesson — flipping the type with stale fixtures causes tsc cascade BEFORE the fixtures are clean. Order ensures every intermediate commit is green.

- **D-09 — Plan A is autonomous: true (no operator checkpoints):**
  No prod DB changes — Phase 36 already ran `SET NOT NULL` at the DB level. Plan A is purely Drizzle/TS catch-up. Plan A is fully autonomous. Plan B + Plan C are also autonomous.
  Phase 38 has NO `checkpoint:human-action` tasks (unlike Phase 37). Mirrors Phase 35's all-autonomous shape.

### Watch type + DAL JOIN shape (Area 3 — D-10 through D-12)

- **D-10 — `Watch.catalogTaste: CatalogTasteAttributes | null` (reuse existing interface):**
  Add field to `Watch` interface in `src/lib/types.ts`. Type is the existing `CatalogTasteAttributes` interface at lines 214–223. Single source of truth — engine and composer consume the same shape. `null` represents both "no catalog row" (catalogId was nullable historically) AND "catalog row exists but confidence < 0.5" — the gate (D-02) lives in `analyzeSimilarity`, not in the type.
  Rationale: minimal type surface; existing interface already captures the right shape from Phase 19.1.

- **D-11 — `getWatchesByUser` LEFT JOIN strategy = always JOIN:**
  Every call to `getWatchesByUser(userId)` LEFT JOINs `watches_catalog` and populates `catalogTaste` on each Watch. No conditional/lazy JOIN.
  Rationale:
  - After Plan A, `watches.catalog_id` is NOT NULL, so every watch row has exactly one catalog row to JOIN against — predictable result set
  - 8 extra columns × N rows is negligible (single-user MVP, target <500 watches/user per CLAUDE.md)
  - Single DAL shape is easier to test and reason about than conditional JOIN paths
  - Researcher confirms the JOIN does NOT cause N+1 (it's a single SQL with LEFT JOIN, not per-row catalog lookups)
  - If performance becomes a concern in v6.x (recommender query load), introduce a lighter `getWatchesByUserLite` variant THEN — not preemptively.

- **D-12 — `catalogTaste` is populated only when confidence is non-null OR all numeric fields are non-null:**
  DAL layer does NOT pre-filter by confidence threshold. The full taste row (with possibly-null individual fields) flows into `Watch.catalogTaste`. The engine gates on `catalogTaste.confidence >= 0.5` at the start of the taste-dimension computation (D-02). The composer applies its own threshold gate independently. Single shape; both consumers gate at their own boundary.

### Test design (Area 4 — D-13 through D-15)

- **D-13 — Test-first ordering within Plan B:**
  Plan B task order (atomic commits):
  1. Add `catalogTaste` to `Watch` type + extend `getWatchesByUser` LEFT JOIN + populate fixtures (DAL change only — engine untouched)
  2. Write `tests/static/similarity.taste-null.test.ts` — asserts byte-identical engine output when `catalogTaste` is null OR `confidence < 0.5`. Test MUST pass at this point (engine still ignores the new field).
  3. Write `tests/static/similarity.taste-present.test.ts` — asserts directional behavior (taste-compatible pair scores HIGHER than taste-incompatible pair). Test MUST FAIL at this point (engine still ignores catalogTaste — the score doesn't yet change with taste).
  4. Modify `src/lib/similarity.ts` — add taste dimension per D-01..D-05. BOTH static tests must now pass.
  CAT-13 success criteria #1 and #2 explicitly require this ordering — the tests are written and pass against pre-rewire code (the null-fallback case) BEFORE the engine changes. Atomic commits make this auditable.

- **D-14 — Test fixture catalogTaste shape — drawn from realistic Phase 19.1 prod data:**
  Researcher inspects prod taste data (SELECT * FROM watches_catalog WHERE confidence IS NOT NULL LIMIT 20) and extracts 3–5 realistic profiles for use in `similarity.taste-present.test.ts` and `composer-engine-alignment.test.ts`. Examples expected:
  - **Submariner-like:** `formality=0.25, sportiness=0.85, heritageScore=0.90, primaryArchetype='dive', eraSignal='vintage-modern', designMotifs=['rotating-bezel', 'screw-down-crown'], confidence=0.85`
  - **Datejust-like:** `formality=0.70, sportiness=0.40, heritageScore=0.85, primaryArchetype='dress', eraSignal='timeless', designMotifs=['cyclops', 'jubilee'], confidence=0.80`
  - **Speedmaster-like:** `formality=0.45, sportiness=0.75, heritageScore=0.95, primaryArchetype='chrono', eraSignal='heritage', designMotifs=['tachymeter', 'subdials'], confidence=0.90`
  Plus at least one low-confidence / null-row fixture for the null-fallback test.
  Fixtures live in `tests/fixtures/catalogTaste.ts` (new file) — shared between the 3 test files.

- **D-15 — `tests/static/composer-engine-alignment.test.ts` scenario coverage:**
  Per D-04, ~10 scenarios covering:
  - 2× taste-null (composer + engine fall back; must agree on "Familiar Territory" or whatever the byte-identical legacy behavior produces)
  - 2× confidence < 0.5 (same as taste-null)
  - 2× high-confidence taste-compatible (Core Fit territory)
  - 2× high-confidence taste-incompatible (Hard Mismatch territory)
  - 1× confidence exactly = 0.5 (edge: strict `>=`)
  - 1× confidence = 0.499 (edge: strict `<`)
  - 1× empty designMotifs array (no crash; returns 0 contribution)
  Each scenario is a typed fixture; the test runs the pair through both composer + engine and asserts tier-level agreement (verbal Core Fit copy ↔ `core-fit` numeric label).

### Plan structure preview (informational — planner has latitude)

Likely 3 plans, 3 waves:

- **Wave 1 (sequential, single plan):**
  - Plan 01 — `watches.catalogId .notNull()` tightening: Drizzle column flip + supabase migration + DAL `createWatch` signature change + 2 production call site updates + 17 integration test fixture updates (commits per D-07 / D-08 ordering)
- **Wave 2 (sequential, depends on Plan 01):**
  - Plan 02 — Engine rewire: extend `Watch` type with `catalogTaste`; extend `getWatchesByUser` LEFT JOIN; write `similarity.taste-null.test.ts` (passes against pre-rewire code); write `similarity.taste-present.test.ts` (fails against pre-rewire code); rewire `similarity.ts` with 9th dimension at 0.20 weight; both static tests pass
- **Wave 3 (sequential, depends on Plan 02):**
  - Plan 03 — Composer-engine alignment: extract 3–5 realistic taste fixtures from prod data; write `tests/static/composer-engine-alignment.test.ts` (~10 scenarios per D-15); verify `CollectionFitCard.no-engine.test.ts` still passes; verify Phase 19.1 `extractWithLlm()` byte-lock survives

### Claude's Discretion

- **Researcher decides:** internal sub-weight tuning if prod taste-data distribution surfaces an imbalance (within D-01's locked outer 0.20 budget); cosine vs Euclidean for the numeric trio (cosine recommended but researcher confirms); exact Jaccard implementation idiom for motifs (reuse `arrayOverlap` from similarity.ts lines 55–60 vs new helper).
- **Planner decides:** exact task ordering within plans (within D-13's locked overall ordering); whether to bundle taste-fixtures file into Plan 02 vs Plan 03; whether to split DAL JOIN into its own Plan 02a from engine rewire Plan 02b (within Wave 2).
- **Migration filename:** next sequential 14-digit timestamp strictly greater than Phase 37's `20260511010000`. Likely `20260512000000_phase38_catalog_id_notnull.sql`. Researcher confirms.
- **Drizzle migration filename:** sequential `drizzle/0011_phase38_catalog_id_notnull.sql` + journal idx=11.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v5.0 milestone framing
- `.planning/ROADMAP.md` §"Phase 38: CAT-13 Engine Rewire" — phase goal + 5 success criteria. Source of all "MUST" wording.
- `.planning/REQUIREMENTS.md` §CAT-13 — full requirement text. 9th additive dimension, confidence ≥ 0.5 gate, test-first guards, Watch.catalogTaste + getWatchesByUser LEFT JOIN locked here.
- `.planning/PROJECT.md` — Core Value: "evaluates any watch against the user's collection and preferences to produce a semantic label." Phase 38 is the moment Phase 19.1's taste enrichment starts producing observable behavior in this exact engine.

### Phase 19.1 inheritance (load-bearing precedent)
- `.planning/PROJECT.md` §"Catalog Taste Enrichment" — Phase 19.1 shipped 8 LLM-derived columns; `extractWithLlm()` D-07 byte-locked. Phase 38 D-08 carry honors this.
- `src/lib/taste/vocab.ts` — closed vocab for `primaryArchetype` + `eraSignal` + `designMotifs`. Engine compares against this vocab; researcher confirms semantics.
- `src/lib/types.ts` lines 214–223 `CatalogTasteAttributes` — the type Phase 38 reuses on `Watch.catalogTaste` (D-10).
- `src/lib/types.ts` lines 198–209 `WatchesCatalogRow` — DB row shape with the 8 taste columns; LEFT JOIN source.

### Phase 20 inheritance (load-bearing precedent)
- `src/lib/verdict/viewerTasteProfile.ts` — Phase 20 aggregate over user collection at confidence ≥ 0.5. Phase 38 engine reads INDIVIDUAL watch taste, not the aggregate, but the gate is the same.
- `src/lib/verdict/viewerTasteProfile.test.ts` — testing pattern for aggregate; useful template for individual-watch taste tests.
- `src/app/catalog/[catalogId]/page.tsx` + `src/app/actions/verdict.ts` + `src/app/watch/[id]/page.tsx` — three consumers of `computeViewerTasteProfile`. Phase 38 does NOT modify these surfaces.
- `tests/static/CollectionFitCard.no-engine.test.ts` — import boundary guard. Phase 38 D-04 alignment test does NOT call into the React component; calls underlying composer functions directly.

### Phase 36 / 37 inheritance (catalogId .notNull() cascade)
- `.planning/phases/36-layer-c-variant-split-clean-slate-wipe-cat-14-not-null/36-CONTEXT.md` — Phase 36 ran `SET NOT NULL` at the DB level; Drizzle catch-up deferred to Phase 38.
- `.planning/phases/37-layer-d-provenance-fields-divestments-table/37-CONTEXT.md` `<decisions>` "Phase 36 Plan 01 Rule 4 deferral" — explicit hand-off to Phase 38 with the 18 tsc + 17 fixture cascade noted.
- `src/db/schema.ts` line 150 — current Drizzle `watches.catalogId` definition (nullable, on delete set null). Phase 38 Plan A flips to `.notNull()`.

### Phase 17 inheritance (catalog upsert primitives)
- `src/data/catalog.ts` — `upsertCatalogFromUserInput` + `upsertCatalogFromExtractedUrl`. Phase 38 D-06 step 4 reorders call sites to call these BEFORE `createWatch`.
- `src/app/actions/watches.ts` `addWatch` — production call site #1.
- `src/app/api/extract-watch/route.ts` — production call site #2.

### Existing engine surface
- `src/lib/similarity.ts` (382 lines) — `WEIGHTS` at lines 10–19 (sum = 1.00 today), `THRESHOLDS` at lines 22–26, `GOAL_THRESHOLDS` at lines 31–36, `analyzeSimilarity` at line 216, `arrayOverlap` helper at lines 55–60. Phase 38 D-05 reweights WEIGHTS; D-03 reuses arrayOverlap for motifs Jaccard.
- `src/lib/types.ts` — `Watch`, `SimilarityResult`, `SimilarityLabel`, `CollectionGoal` types. Phase 38 extends `Watch` with `catalogTaste`; does NOT modify `SimilarityResult` or `SimilarityLabel`.

### DAL JOIN target
- `src/data/watches.ts` `getWatchesByUser` line 120 — the function Phase 38 extends with LEFT JOIN. Phase 38 D-11 confirms always-JOIN strategy.

### Future-phase consumers
- `.planning/ROADMAP.md` §"Phase 39: Audit-Driven Discovery Polish" — FIT-05 ("Compare with the [X] you own" pairwise drill-down in CollectionFitCard) depends on Phase 38 surfacing taste rows.
- `.planning/seeds/SEED-002-hybrid-recommender.md` — v6.x collaborative-filtering layer on top of CAT-13's structured taste signal.

### DB migration discipline (memory anchors)
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_drizzle_supabase_db_mismatch.md` — Rules 1 (14-digit filename), 2 (no insertion). Rule 3 (extension schema) and Rule 4 (pg_depend) N/A — Phase 38 only flips a column constraint, no DROP/type-change.
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_local_db_reset.md` — local re-sync flow if Plan A needs verification against fresh DB.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/lib/similarity.ts` lines 10–19 `WEIGHTS` const** — direct edit target. Reweight via the D-05 transformation pattern (no magic numbers).
- **`src/lib/similarity.ts` lines 55–60 `arrayOverlap` helper** — direct reuse for `designMotifs` Jaccard component of D-03.
- **`src/lib/similarity.ts` line 216 `analyzeSimilarity`** — extend with taste-dimension contribution; preserve existing 8-dim scoring loop structure.
- **`src/lib/types.ts` lines 214–223 `CatalogTasteAttributes`** — direct reuse on `Watch.catalogTaste` per D-10.
- **`src/data/catalog.ts` `upsertCatalogFromUserInput` + `upsertCatalogFromExtractedUrl`** — direct reuse in Plan A D-06 step 4 (production call site reordering).
- **`src/lib/verdict/viewerTasteProfile.test.ts`** — testing pattern template for D-15 alignment scenarios.
- **`tests/static/CollectionFitCard.no-engine.test.ts`** — guard pattern template for `composer-engine-alignment.test.ts`.

### Established Patterns

- **Drizzle `.notNull()` migration** — Phase 38 Plan A is the FIRST `.notNull()` constraint addition without an accompanying DDL change (Phase 36 already ran `SET NOT NULL` at DB level). Supabase migration is `ALTER COLUMN catalog_id SET NOT NULL` — a no-op against current DB but required for Drizzle introspection alignment.
- **Test-first guards** — `tests/static/CollectionFitCard.no-engine.test.ts` and `tests/no-evaluate-route.test.ts` precedent: tests assert invariants, not specific values. CAT-13's `similarity.taste-present.test.ts` is directional (taste-compatible pair > taste-incompatible pair), not absolute-value.
- **Fixture sharing** — D-14 shared `tests/fixtures/catalogTaste.ts` file mirrors existing fixture file patterns in `tests/fixtures/`.

### Integration Points

- **DAL changes:** ONE function modified — `getWatchesByUser` adds LEFT JOIN. NO other DAL functions change in Phase 38.
- **Engine changes:** ONE file modified — `src/lib/similarity.ts`. The 9th dimension contributes to the existing numeric `score`; `SimilarityResult` + `SimilarityLabel` types unchanged.
- **UI changes:** NONE. Phase 38 does NOT touch any React components. CollectionFitCard pure-renderer boundary preserved (FIT-04). Visible-to-user effect is "verdicts get smarter" — the engine produces different labels for the same inputs, surfaces re-render with the new labels, but no surface gains or loses pixels.
- **Type changes:** `Watch` gains optional `catalogTaste: CatalogTasteAttributes | null` field. NO breaking type changes; existing Watch consumers continue to work because the field is optional.
- **Test changes:** 3 new static test files (`taste-null`, `taste-present`, `composer-engine-alignment`) + 1 new fixture file (`catalogTaste.ts`) + ~17 existing integration test fixture updates (Plan A).

### Parity gate (ROADMAP success #5 "existing static guards remain unchanged")

- `tests/static/CollectionFitCard.no-engine.test.ts` — unchanged
- `tests/no-evaluate-route.test.ts` — unchanged
- Phase 19.1 `extractWithLlm()` body byte-locked — `src/lib/extractors/llm.ts` not modified
- `SimilarityResult` shape unchanged
- `SimilarityLabel` enum unchanged
- `GOAL_THRESHOLDS` map unchanged (taste weight is uniform across all 4 goals; see "Not in scope" deferred item)

</code_context>

<specifics>
## Specific Ideas

- **Engine math expression (D-01 + D-05) — pseudocode:**
  ```typescript
  // src/lib/similarity.ts (Phase 38 rewire)
  const EXISTING_WEIGHTS_BASE = {
    styleTags: 0.25, designTraits: 0.20, roleTags: 0.20,
    dialColor: 0.10, complications: 0.10, caseSize: 0.05,
    strapType: 0.05, waterResistance: 0.05,
  }
  const TASTE_WEIGHT = 0.20
  const EXISTING_SCALE = 1.0 - TASTE_WEIGHT
  const WEIGHTS = {
    ...scaleAll(EXISTING_WEIGHTS_BASE, EXISTING_SCALE),
    taste: TASTE_WEIGHT,
  }
  const TASTE_SUB_WEIGHTS = {
    numericTrioCosine: 0.40,    // 0.40 × 0.20 = 0.08
    archetypeMatch:    0.20,    // 0.20 × 0.20 = 0.04
    eraMatch:          0.20,    // 0.20 × 0.20 = 0.04
    motifsJaccard:     0.20,    // 0.20 × 0.20 = 0.04
  } // sums to 1.0 inside the 0.20 taste budget

  function tasteSimilarity(t1: CatalogTasteAttributes | null, t2: CatalogTasteAttributes | null): number {
    if (!t1 || !t2) return 0
    if (t1.confidence === null || t2.confidence === null) return 0
    if (t1.confidence < 0.5 || t2.confidence < 0.5) return 0
    // ... compute the 4 components ...
    return WEIGHTS.taste * weightedSum
  }
  ```

- **Plan A migration filename:** `supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql` (or next available 14-digit timestamp greater than `20260511010000`).

- **Plan A Drizzle migration:** `drizzle/0011_phase38_catalog_id_notnull.sql` + journal idx=11.

- **CAT-13 test naming (locked in ROADMAP):** `tests/static/similarity.taste-null.test.ts` AND `tests/static/similarity.taste-present.test.ts` (verbatim filenames; planner does not rename).

- **D-04 alignment test filename:** `tests/static/composer-engine-alignment.test.ts`.

- **Shared fixture file:** `tests/fixtures/catalogTaste.ts` exports realistic taste profile objects.

</specifics>

<deferred>
## Deferred Ideas

- **CAT-13 v6.x collaborative-filtering optimization** — SEED-002 (hybrid recommender) territory. Phase 38 ships the structured signal; v6.x layers behavioral co-occurrence on top.
- **FIT-05 "Compare with the [X] you own" pairwise drill-down** — Phase 39 polish. Depends on Phase 38 surfacing taste-attribute rows in the verdict; the drill-down UI is separate scope.
- **Goal-aware taste weighting** — `GOAL_THRESHOLDS` map could scale the 0.20 taste weight per collection goal (specialist heavier; variety-within-theme lighter). Phase 38 ships uniform 0.20. Future polish lever.
- **Per-archetype motif weighting** — Jaccard treats all `designMotifs` equally. Future enrichment phase could weight motifs by archetype rarity (e.g., "tachymeter" matters more on a chrono than on a diver).
- **Two-tier confidence gating (0.5/0.7)** — considered for Phase 38 (matches Phase 20 composer's two-tier copy thresholds) but rejected per D-02. Binary at 0.5 is simpler; if verbal-numeric drift surfaces in D-04 alignment test, that's the moment to revisit.
- **Lazy / conditional DAL JOIN** — `getWatchesByUserLite` variant without the catalogTaste JOIN for performance-sensitive call paths. Defer until v6.x recommender query load shows a real bottleneck.
- **Engine output schema extension** — adding `tasteContribution: number` field to `SimilarityResult` so UI surfaces can show "how much of this verdict came from taste vs hand-tagged data." Out of scope for Phase 38; CollectionFitCard composer already does this in verbal form.
- **Goal × archetype interaction in scoring** — e.g., a "specialist" collector of divers should weight `primaryArchetype='dive'` matches even higher. Deferred to v6.x.
- **Re-enrichment trigger on engine rewire** — Phase 38 does NOT re-run Phase 19.1's enrichment. Existing catalog rows keep their taste data. If the rewire surfaces low coverage as a problem, `npm run db:reenrich-taste --force` is the manual escape hatch (Phase 19.1 D-13).

</deferred>

---

*Phase: 38-cat-13-engine-rewire*
*Context gathered: 2026-05-12*

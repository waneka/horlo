# Phase 38: CAT-13 Engine Rewire — Research

**Researched:** 2026-05-12
**Domain:** Similarity engine + DAL JOIN + Drizzle/Supabase migration discipline
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim D-NN — do NOT re-litigate)

**Carried forward from prior phases (locked):**
- Phase 19.1 D-07 — `extractWithLlm()` byte-lock: Phase 38 does NOT touch `src/lib/extractors/llm.ts`.
- Phase 19.1 D-13 — confidence semantics: `confidence >= 0.5` is the project-wide gate; Phase 38 D-02 honors it.
- Phase 20 FIT-04 — CollectionFitCard pure-renderer: no engine imports in the React component. `tests/static/CollectionFitCard.no-engine.test.ts` enforces.
- Phase 20 viewerTasteProfile — already gates at `confidence >= 0.5`. Phase 38 reads INDIVIDUAL watch taste, not the aggregate.
- Phase 36 Plan 01 / Phase 37 deferral — `watches.catalogId .notNull()` tightening is Phase 38's responsibility. Cascade: 18 tsc errors + ~17 fixtures + `createWatch` DAL signature change + production call sites must upsert catalog BEFORE `createWatch`.
- Phase 17 D-06 — public-read RLS on `watches_catalog`. DAL JOIN does not need elevated permissions.
- Phase 17 D-13 — first-write-wins on `watches_catalog`. Phase 38 is read-only on this table.

**Engine math (D-01..D-05):**
- D-01: Taste dimension OUTER weight = 0.20; existing 8 dimensions reweight to 0.80 sum via the D-05 transformation. Multiply each existing weight by 0.80.
- D-02: Binary confidence gate at 0.5. `confidence === null || confidence < 0.5 → taste contribution = 0`. `confidence >= 0.5 → full 0.20`. No linear scaling.
- D-03: Internal taste split: numeric trio cosine 0.08 + archetype categorical 0.04 + era categorical 0.04 + motifs Jaccard 0.04. Researcher MAY override the internal split; outer 0.20 is LOCKED.
- D-04: Composer-engine alignment static test in Phase 38 (not Polish). ~10 scenarios.
- D-05: No magic numbers — use a single constant transformation pattern (`EXISTING_WEIGHTS_BASE * (1 - TASTE_WEIGHT)`).

**catalogId .notNull() (D-06..D-09):**
- D-06: Plan A ships catalogId .notNull() FIRST. 5-step Plan A scope.
- D-07: Plan A fixture commit grouping = one commit per test file family.
- D-08: Plan A commit order = DAL signature change first → call sites → fixtures → **schema flip LAST**.
- D-09: Plan A autonomous: true (no operator checkpoints). Phase 38 has NO `checkpoint:human-action` tasks.

**Watch type + DAL JOIN (D-10..D-12):**
- D-10: `Watch.catalogTaste: CatalogTasteAttributes | null` — reuse the existing interface in `src/lib/types.ts:214-223`.
- D-11: `getWatchesByUser` always LEFT JOINs `watches_catalog`. No conditional/lazy JOIN.
- D-12: DAL does NOT pre-filter by confidence. Full taste row flows; engine gates internally.

**Test design (D-13..D-15):**
- D-13: Plan B task order = DAL change → write `taste-null.test.ts` (passes) → write `taste-present.test.ts` (FAILS pre-rewire) → modify `similarity.ts` (both tests pass).
- D-14: Fixtures drawn from realistic Phase 19.1 prod data; live at `tests/fixtures/catalogTaste.ts` (new file).
- D-15: `composer-engine-alignment.test.ts` covers ~10 scenarios per D-04 enumeration.

### Claude's Discretion
- Internal sub-weight tuning if prod taste-data surfaces an imbalance (within D-01's locked outer 0.20).
- Cosine vs Euclidean for the numeric trio (cosine recommended; researcher confirms).
- Exact Jaccard idiom for motifs (reuse `arrayOverlap` vs new helper).
- Planner decides task ordering within plans, fixture file bundling location (Plan 02 vs Plan 03), DAL JOIN split into 02a/02b.
- Migration filenames: next sequential 14-digit timestamp > `20260511010000`; next drizzle journal idx > 10.

### Deferred Ideas (OUT OF SCOPE)
- CAT-13 v6.x collaborative-filtering optimization (SEED-002 hybrid recommender territory).
- FIT-05 pairwise drill-down ("Compare with the [X] you own") — Phase 39.
- Goal-aware taste weighting (`GOAL_THRESHOLDS` scaling the 0.20 by collection goal). Future polish lever.
- Per-archetype motif weighting (motif rarity scoring). Future enrichment phase.
- Two-tier confidence gating (0.5/0.7). Rejected per D-02.
- Lazy/conditional DAL JOIN (`getWatchesByUserLite`). Defer until v6.x recommender query load.
- Engine output schema extension (`tasteContribution: number` on `SimilarityResult`). Out of scope.
- Goal × archetype interaction in scoring. Deferred to v6.x.
- Re-enrichment trigger on rewire. Phase 38 does NOT re-run Phase 19.1 enrichment.
- Composer threshold recalibration (composer's 0.5/0.7 stays). Bugs uncovered by D-04 alignment test → Polish.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-13 | `analyzeSimilarity()` reads `watches_catalog` taste columns as additive 9th dimension gated on `confidence >= 0.5`; `Watch.catalogTaste` extension + `getWatchesByUser` LEFT JOIN; two static guard tests (`taste-null` + `taste-present`) written and passing BEFORE any change to `similarity.ts`; `CollectionFitCard.no-engine.test.ts` import boundary unchanged; `extractWithLlm()` byte-lock preserved. | §Engine Math + §DAL JOIN Pattern + §Fixture Inventory + §Parity Surfaces |

</phase_requirements>

## Summary

Phase 38 is the consumer rewire of Phase 19.1's eight LLM-derived taste columns on `watches_catalog`. CONTEXT.md has already pre-decided every load-bearing question (engine math, confidence gate, internal split, plan structure). The research job is to (1) confirm migration filenames and journal indices, (2) verify the production callsite cascade matches CONTEXT.md's claim, (3) produce drop-in fixtures for the new test files, (4) document the exact Drizzle LEFT JOIN idiom that mirrors existing DAL precedent, and (5) flag the one significant gap between CONTEXT.md's wording and reality.

**The one significant gap:** CONTEXT.md says "two production call sites must upsert catalog BEFORE `createWatch`." Reality is **three call sites** — `src/app/actions/watches.ts:121` (`addWatch`), `src/app/actions/wishlist.ts:124` (`addToWishlistFromWearEvent`), and the DAL signature itself at `src/data/watches.ts:197`. Phase 36 deferred-items.md and STATE.md both call out wishlist.ts explicitly; CONTEXT.md D-06 only enumerates two. Plan A MUST include wishlist.ts as a third callsite refactor or shipped tsc will not regress to the 27-error baseline.

**Primary recommendation:** Adopt CONTEXT.md verbatim with two amendments — (a) Plan A's "two production call sites" becomes **three** (add wishlist.ts:124 `addToWishlistFromWearEvent` and its WYWT overlay refactor), and (b) the existing `arrayOverlap` helper at `src/lib/similarity.ts:55-60` is already a correct Jaccard (intersection / union) implementation and should be reused verbatim for `designMotifs` per D-03.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| `analyzeSimilarity` 9th dimension scoring | Server-side library (`src/lib/similarity.ts`) | — | Pure function; called by composer (server) + tasteOverlap (server-imported). No client-side state. |
| `Watch.catalogTaste` shape | TS type system (`src/lib/types.ts`) | — | Single source of truth; engine + composer + DAL all consume the same shape. |
| `getWatchesByUser` LEFT JOIN | Database / DAL (`src/data/watches.ts`) | Postgres execution plan | Single SQL with LEFT JOIN; no N+1. Owner-scoped WHERE preserves existing RLS-equivalent gate. |
| `createWatch` catalogId required param | DAL signature (`src/data/watches.ts`) | Production call sites | Type-system change drives flow refactor at watches.ts + wishlist.ts. |
| Catalog upsert BEFORE createWatch | Server Actions (`src/app/actions/watches.ts` + `wishlist.ts`) | DAL | Existing `upsertCatalogFromUserInput` is server-only; both call sites are already server-side. |
| Composer-engine alignment test | Static / pure-function test | — | Calls composer + engine as library functions; does NOT touch `CollectionFitCard.tsx` component (preserves FIT-04 boundary). |
| Drizzle .notNull() flip | Schema source-of-truth (`src/db/schema.ts`) | Supabase migration (no-op DDL — SET NOT NULL already shipped Phase 36) | Drizzle catches up to prod reality. |

## Standard Stack

### Core (already installed; no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 (existing) | ORM + LEFT JOIN builder | Existing project standard; `innerJoin`/`leftJoin` API already used in 10+ DAL files |
| vitest | (existing) | Static test runner | `tests/static/` precedent; mocking idiom proven in viewerTasteProfile.test.ts |
| postgres-js | (existing) | Postgres driver | Phase 19.1 numeric column quirk: `numeric` columns surface as strings; `Number()` coerce before math (mirrors viewerTasteProfile.ts:62-67) |

### Supporting (already installed)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| zod (existing) | Server Action input validation | `insertWatchSchema` unchanged by Phase 38 (catalogTaste is read-only output, not user-supplied) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `arrayOverlap` Jaccard | New helper `jaccardIndex` | Not worth it — existing helper IS Jaccard; renaming would inflate diff |
| Cosine for numeric trio | Euclidean distance (1 - normalized L2) | Cosine recommended; 3D vectors in [0,1] match cosine's directional-similarity semantics; Euclidean would over-penalize large-magnitude gaps that cosine treats as direction-preserving |
| LEFT JOIN inside `getWatchesByUser` | Per-row catalog fetch in mapper | LEFT JOIN is canonical (10+ existing DAL precedents); per-row would be N+1 |
| Conditional JOIN (D-11 alternative) | Always-JOIN | CONTEXT.md D-11 locks always-JOIN per single-user MVP scale |

**Installation:** No new packages. `npm install` not required.

**Version verification:** drizzle-orm 0.45.2 already pinned in package.json; no version bump needed. Postgres `numeric` column → JS string conversion is a known postgres-js behavior already mitigated in viewerTasteProfile.ts (precedent pattern).

## Architecture Patterns

### System Architecture Diagram

```
                                                       ┌──────────────────────────────┐
                                                       │   watches_catalog (table)    │
                                                       │   • formality / sportiness   │
                                                       │   • heritageScore            │
                                                       │   • primaryArchetype         │
                                                       │   • eraSignal                │
                                                       │   • designMotifs[]           │
                                                       │   • confidence               │
                                                       │   • extractedFromPhoto       │
                                                       └──────────────┬───────────────┘
                                                                      │ LEFT JOIN on
                                                                      │ watches.catalog_id
                                                                      │ = watches_catalog.id
                                                                      ▼
  ┌──────────────────────┐    getWatchesByUser    ┌───────────────────────────────┐
  │  watches (table)     │ ────────────────────▶  │  Watch[] with .catalogTaste   │
  │  • catalog_id (FK,   │     (Plan B Task 0)    │  populated per D-12           │
  │     post-Plan-A      │                        └──────────────┬────────────────┘
  │     NOT NULL)        │                                       │
  └──────────────────────┘                                       │ consumed by
                                                                 ▼
                                       ┌───────────────────────────────────────┐
                                       │  analyzeSimilarity(target, collection, │
                                       │                    preferences)        │
                                       │  • 8 existing dimensions @ 0.80 sum   │
                                       │  • NEW 9th: taste @ 0.20 (gated)      │
                                       │     ─ cosine([f,s,h])     × 0.08      │
                                       │     ─ archetype match     × 0.04      │
                                       │     ─ era match           × 0.04      │
                                       │     ─ Jaccard(motifs)     × 0.04      │
                                       │  • confidence < 0.5 → taste contrib=0  │
                                       └──────────────┬────────────────────────┘
                                                      │ produces
                                                      ▼
                                          SimilarityResult (shape UNCHANGED)
                                          • label, score, mostSimilarWatches,
                                            roleOverlap, reasoning

                                                      │ also consumed by
                                                      ▼
                                       composeVerdictBundle (D-04 alignment test
                                                            runs ~10 scenarios
                                                            through both)
```

**Plan A flow (catalogId .notNull() cascade):**

```
  ┌─ Step 1: DAL signature change ──────────────────────────────────┐
  │   createWatch(userId, data) → createWatch(userId, catalogId, data)  │
  │   ─ produces N tsc errors at every callsite                      │
  └──────────────────┬───────────────────────────────────────────────┘
                     │
  ┌─ Step 2: Production callsite #1 ────────────────────────────────┐
  │   src/app/actions/watches.ts addWatch                            │
  │   ─ ALREADY upserts catalog post-create — reorder pre-create     │
  └──────────────────┬───────────────────────────────────────────────┘
                     │
  ┌─ Step 2b: Production callsite #2 ───────────────────────────────┐
  │   src/app/api/extract-watch/route.ts POST                         │
  │   ─ ALREADY upserts catalog before any watch row exists           │
  │   ─ but NEVER calls createWatch directly (returns catalogId       │
  │     for client to call addWatch)                                  │
  │   ─ Re-audit: does this path need a flow change at all?          │
  └──────────────────┬───────────────────────────────────────────────┘
                     │
  ┌─ Step 2c: Production callsite #3 ────────────────────────────────┐  ◀── CONTEXT.md MISSES THIS
  │   src/app/actions/wishlist.ts addToWishlistFromWearEvent          │
  │   ─ DIFFERENT shape: snapshots WYWT-source watch metadata         │
  │   ─ Source row HAS a catalogId already (the wear event's watch)   │
  │     OR may have NULL catalogId (post-Phase-36 only NEW writes are │
  │     guaranteed non-NULL; but existing rows might be NULL — verify)│
  │   ─ Need decision: pass-through source catalogId, or do a fresh  │
  │     upsertCatalogFromUserInput(brand, model, reference)?          │
  └──────────────────┬───────────────────────────────────────────────┘
                     │
  ┌─ Step 3: 17 fixture updates (per-phase-family commits per D-07) ─┐
  │   ─ See §Fixture Inventory below                                 │
  └──────────────────┬───────────────────────────────────────────────┘
                     │
  ┌─ Step 4 (LAST per D-08): schema flip ──────────────────────────┐
  │   drizzle/schema.ts watches.catalogId.notNull()                  │
  │   + supabase/migrations/20260512000000_phase38_catalog_id_       │
  │     notnull.sql (no-op SET NOT NULL — DDL already shipped P36)   │
  │   + drizzle/0011_phase38_catalog_id_notnull.sql + journal idx=11 │
  └─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additions only)
```
src/
├── lib/
│   ├── similarity.ts                                  # EDIT — 9th dimension
│   └── types.ts                                       # EDIT — Watch.catalogTaste
├── data/
│   └── watches.ts                                     # EDIT — LEFT JOIN + signature
└── db/
    └── schema.ts                                      # EDIT — line 150 .notNull()

supabase/migrations/
└── 20260512000000_phase38_catalog_id_notnull.sql      # NEW (no-op DDL)

drizzle/
├── 0011_phase38_catalog_id_notnull.sql                # NEW (Drizzle twin)
└── meta/_journal.json                                 # APPEND idx=11

tests/
├── fixtures/
│   └── catalogTaste.ts                                # NEW (D-14 shared)
└── static/
    ├── similarity.taste-null.test.ts                  # NEW (D-13 Task 2)
    ├── similarity.taste-present.test.ts               # NEW (D-13 Task 3)
    └── composer-engine-alignment.test.ts              # NEW (D-04 + D-15)
```

### Pattern 1: Drizzle LEFT JOIN with row-shape mapper

**What:** Extend `getWatchesByUser` to LEFT JOIN `watches_catalog` and populate `Watch.catalogTaste` per row.
**When to use:** Plan B Task 0 (Wave 2 first task).
**Example (mirrors existing innerJoin precedent at `src/lib/verdict/viewerTasteProfile.ts:42-58`):**
```typescript
// Source: existing pattern at src/data/watches.ts:158-185 (getWatchByIdForViewer innerJoin)
// + viewerTasteProfile.ts:42-58 (numeric-column coercion via Number())
export async function getWatchesByUser(userId: string): Promise<Watch[]> {
  const rows = await db
    .select({
      watch: watches,
      taste: {
        formality: watchesCatalog.formality,
        sportiness: watchesCatalog.sportiness,
        heritageScore: watchesCatalog.heritageScore,
        primaryArchetype: watchesCatalog.primaryArchetype,
        eraSignal: watchesCatalog.eraSignal,
        designMotifs: watchesCatalog.designMotifs,
        confidence: watchesCatalog.confidence,
        extractedFromPhoto: watchesCatalog.extractedFromPhoto,
      },
    })
    .from(watches)
    .leftJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))
    .where(eq(watches.userId, userId))
    .orderBy(asc(watches.sortOrder), desc(watches.createdAt))

  return rows.map(({ watch, taste }) => ({
    ...mapRowToWatch(watch),
    catalogTaste: taste?.confidence === null && taste?.formality === null
      ? null
      : {
          // numeric columns surface as strings via postgres-js — coerce
          formality: taste.formality !== null ? Number(taste.formality) : null,
          sportiness: taste.sportiness !== null ? Number(taste.sportiness) : null,
          heritageScore: taste.heritageScore !== null ? Number(taste.heritageScore) : null,
          primaryArchetype: taste.primaryArchetype as PrimaryArchetype | null,
          eraSignal: taste.eraSignal as EraSignal | null,
          designMotifs: taste.designMotifs ?? [],
          confidence: taste.confidence !== null ? Number(taste.confidence) : null,
          extractedFromPhoto: taste.extractedFromPhoto ?? false,
        },
  }))
}
```

**Notes:**
- LEFT JOIN ensures every watches row is returned even if `catalog_id` is NULL pre-Plan-A (during the transition, fixtures may still construct watches without catalogTaste). Post-Plan-A `catalog_id` is NOT NULL, so the LEFT JOIN behaviorally collapses to INNER JOIN but the syntactic form preserves graceful degradation if a watches_catalog row is ever deleted while a watches row references it (the schema's `ON DELETE SET NULL` is gone after Plan A — `catalog_id` cannot become NULL — so practically the JOIN always matches).
- Numeric-column string-coercion mirrors viewerTasteProfile.ts:62-67 verbatim.
- Type assertion `as PrimaryArchetype | null` mirrors catalog.ts:80-81 verbatim.

### Pattern 2: Taste dimension scoring (D-03 expansion)

**What:** Pure function computing the 0.20 taste contribution; mirrors `calculatePairSimilarity` shape.
**Where:** Inside `src/lib/similarity.ts` as a new top-level helper, called from `calculatePairSimilarity`.
**Example:**
```typescript
// Source: D-03 internal split locked by CONTEXT.md
const TASTE_WEIGHT = 0.20
const EXISTING_SCALE = 1.0 - TASTE_WEIGHT  // 0.80
const EXISTING_WEIGHTS_BASE = {
  styleTags: 0.25, designTraits: 0.20, roleTags: 0.20,
  dialColor: 0.10, complications: 0.10, caseSize: 0.05,
  strapType: 0.05, waterResistance: 0.05,
} as const
const WEIGHTS = Object.fromEntries(
  Object.entries(EXISTING_WEIGHTS_BASE).map(([k, v]) => [k, v * EXISTING_SCALE])
) as { [K in keyof typeof EXISTING_WEIGHTS_BASE]: number }

// Internal split per D-03 — these multiply to give the final per-component weight inside the 0.20 budget
const TASTE_SUB_WEIGHTS = {
  numericTrioCosine: 0.40,  // 0.40 × 0.20 = 0.08
  archetypeMatch:    0.20,  // 0.20 × 0.20 = 0.04
  eraMatch:          0.20,  // 0.20 × 0.20 = 0.04
  motifsJaccard:     0.20,  // 0.20 × 0.20 = 0.04
} as const

function cosine3D(a: [number, number, number], b: [number, number, number]): number {
  const dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
  const ma = Math.hypot(a[0], a[1], a[2])
  const mb = Math.hypot(b[0], b[1], b[2])
  if (ma === 0 || mb === 0) return 0  // null-safe per D-03 edge: all-zero vectors
  return dot / (ma * mb)
}

function tasteSimilarity(
  t1: CatalogTasteAttributes | null,
  t2: CatalogTasteAttributes | null,
): number {
  // D-02 gate: any nullish or below-floor confidence → 0
  if (!t1 || !t2) return 0
  if (t1.confidence === null || t2.confidence === null) return 0
  if (t1.confidence < 0.5 || t2.confidence < 0.5) return 0

  let contrib = 0

  // Numeric trio cosine (0.08)
  const n1 = [t1.formality, t1.sportiness, t1.heritageScore] as const
  const n2 = [t2.formality, t2.sportiness, t2.heritageScore] as const
  const allNonNull1 = n1.every(x => x !== null)
  const allNonNull2 = n2.every(x => x !== null)
  if (allNonNull1 && allNonNull2) {
    const cos = cosine3D(n1 as [number, number, number], n2 as [number, number, number])
    contrib += TASTE_SUB_WEIGHTS.numericTrioCosine * cos
  }

  // Archetype categorical match (0.04)
  if (t1.primaryArchetype !== null && t2.primaryArchetype !== null &&
      t1.primaryArchetype === t2.primaryArchetype) {
    contrib += TASTE_SUB_WEIGHTS.archetypeMatch * 1.0
  }

  // Era categorical match (0.04)
  if (t1.eraSignal !== null && t2.eraSignal !== null &&
      t1.eraSignal === t2.eraSignal) {
    contrib += TASTE_SUB_WEIGHTS.eraMatch * 1.0
  }

  // Motifs Jaccard (0.04) — reuse arrayOverlap (already correct Jaccard implementation)
  contrib += TASTE_SUB_WEIGHTS.motifsJaccard * arrayOverlap(t1.designMotifs, t2.designMotifs)

  return TASTE_WEIGHT * contrib  // contrib already in [0,1]; outer * 0.20 makes it sum-compatible
}
```

**Wait — math check on the outer multiply.** The above shows `TASTE_WEIGHT * contrib` at the end, but `contrib` is already weighted by `TASTE_SUB_WEIGHTS` (which sum to 1.0). So `contrib ∈ [0, 1]` and `TASTE_WEIGHT * contrib ∈ [0, 0.20]` — correct shape. The 8 existing dimensions in `calculatePairSimilarity` use the same pattern (`score += WEIGHTS.styleTags * arrayOverlap(...)`), so the taste branch reads `score += tasteSimilarity(t1, t2)` (which internally already applies `TASTE_WEIGHT`). Alternatively split out the multiply to match the existing per-dim shape:
```typescript
// Inside calculatePairSimilarity:
score += tasteRawContribution(t1, t2)  // already in [0, 0.20]
// OR:
score += WEIGHTS.taste * tasteSimilarityRaw01(t1, t2)  // raw01 in [0,1]; * WEIGHTS.taste
```
The second form mirrors the existing 8-dimension pattern more cleanly. Planner picks.

### Pattern 3: Static test fixture with deterministic IDs

**What:** Shared `tests/fixtures/catalogTaste.ts` exports typed CatalogTasteAttributes fixtures.
**When to use:** D-14 — shared between `similarity.taste-null.test.ts`, `similarity.taste-present.test.ts`, and `composer-engine-alignment.test.ts`.
**Example:** See §Fixture Drafts below.

### Anti-Patterns to Avoid

- **Hardcoding the reweighted 0.80-sum values** (D-05 forbids this). Use the constant transformation pattern.
- **Pre-filtering by confidence at the DAL layer** (D-12 forbids). The full taste row flows; gate at the engine.
- **Reading taste data through the React component** (FIT-04 forbids). `composer-engine-alignment.test.ts` calls composer + engine as library functions, not through `CollectionFitCard.tsx`.
- **Calling `createWatch` then `linkWatchToCatalog`** (post-Plan-A this pattern is gone). The new flow is `upsertCatalog → createWatch(catalogId, ...)` as a single step.
- **Modifying `extractWithLlm()` to surface taste** (Phase 19.1 D-07 byte-lock). Taste extraction stays where it is; only the consumer changes.
- **Treating null formality/sportiness/heritageScore as 0 in cosine** (would produce false high-similarity for paired all-null vectors). Drop the trio's contribution when ANY of the 3 are null on EITHER side.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Jaccard for designMotifs | Custom intersection/union helper | Existing `arrayOverlap` at `similarity.ts:55-60` (verified correct Jaccard) | Already battle-tested; reuse mandated by D-03 wording |
| Cosine similarity | Numerical library import (no cosine in existing project) | 3-line inline `cosine3D` helper | Fixed-dimensionality (3); no Math libs needed beyond `Math.hypot` |
| Numeric column coercion | New parser | `Number()` per viewerTasteProfile.ts:67 | Project-wide precedent for postgres-js `numeric` → string |
| Catalog upsert in Plan A flow refactor | New upsert helper | Existing `upsertCatalogFromUserInput` (Phase 17) | Already exists; reorder, don't reimplement |
| Watch-row mapper changes | Full rewrite of `mapRowToWatch` | Add `catalogTaste` field at the end of the existing mapper | Surgical change preserves the 50-line existing function shape |

**Key insight:** Phase 38 is almost entirely a wiring exercise. Every helper, type, RLS policy, upsert primitive, and migration pattern already exists. The new code is ~80-120 LoC across one engine file + one DAL function + one type extension + three test files + one fixture file + one migration pair.

## Runtime State Inventory

**Trigger applicability:** Phase 38 does NOT rename anything. The `.notNull()` flip is a constraint, not a rename. The 9th dimension is additive code, not a string replacement. **Skipping all 5 categories — no runtime state migration needed.**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 38 is read-only on `watches_catalog`; no column renames | None |
| Live service config | None — no Datadog/n8n/Cloudflare tags reference `analyzeSimilarity` or `catalogTaste` by name | None |
| OS-registered state | None — no scheduled tasks or pm2 processes touch the engine | None |
| Secrets/env vars | None — `ANTHROPIC_API_KEY` already used by extractWithLlm (untouched); no new secrets | None |
| Build artifacts | None — pure TS source changes; Next.js rebuilds on first request | None |

**Nothing found in category:** Verified by grep — no `.devcontainer/`, `.github/workflows/`, `pm2.config.*`, `tasks.json`, or `vercel.json` references `analyzeSimilarity` or `catalogTaste`. Phase 38 ships purely through code edits + Drizzle/Supabase migrations.

## Open Research Questions — Answers

### Q1 — Drizzle migration filename + journal idx

**Answer (verified by file listing):**

- Latest supabase migration: `supabase/migrations/20260511010000_phase37_layer_d.sql` (Phase 37 shipped 2026-05-11).
- Next sequential timestamp: **`20260512000000`** (next calendar day; preserves strict monotonic ordering > Phase 37's timestamp). CONTEXT.md `<specifics>` proposed this exact timestamp; confirmed correct.
- Full filename: **`supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql`**.

- Latest drizzle migration: `drizzle/0010_phase37_layer_d.sql` (journal idx=10 last entry).
- Next sequential drizzle filename: **`drizzle/0011_phase38_catalog_id_notnull.sql`**.
- Next journal entry idx: **`11`**.

**Journal entry shape (mirror Phase 37 entry verbatim):**
```json
{
  "idx": 11,
  "version": "7",
  "when": <Date.now() at execution time>,
  "tag": "0011_phase38_catalog_id_notnull",
  "breakpoints": true
}
```
The `when` value captures execution-time via `node -e "process.stdout.write(String(Date.now()))"` (Phase 36 Plan 03 precedent — plain integer literal, NOT a JS expression).

**Confidence:** HIGH (verified via `ls supabase/migrations/` and `cat drizzle/meta/_journal.json`).

### Q2 — Realistic taste profile fixtures (D-14)

**Answer:** Since we cannot query prod, derive realistic-looking fixtures from the closed vocab in `src/lib/taste/vocab.ts` + the `CatalogTasteAttributes` type. Below are 5 typed, drop-in fixtures matching CONTEXT.md D-14's three suggested archetypes plus 2 more for edge coverage.

```typescript
// tests/fixtures/catalogTaste.ts (NEW FILE — drop-in)
import type { CatalogTasteAttributes } from '@/lib/types'

// ── HIGH-CONFIDENCE FIXTURES ────────────────────────────────────────────

/** Submariner-like — high heritage, sport-leaning, dive archetype. */
export const subLikeTaste: CatalogTasteAttributes = {
  formality: 0.25,
  sportiness: 0.85,
  heritageScore: 0.90,
  primaryArchetype: 'dive',
  eraSignal: 'modern',
  designMotifs: ['applied-indices', 'mercedes-hands'],
  confidence: 0.85,
  extractedFromPhoto: false,
}

/** Datejust-like — formal, heritage-heavy, dress archetype with iconic motifs. */
export const datejustLikeTaste: CatalogTasteAttributes = {
  formality: 0.70,
  sportiness: 0.40,
  heritageScore: 0.85,
  primaryArchetype: 'dress',
  eraSignal: 'modern',
  designMotifs: ['applied-indices', 'beads-of-rice-bracelet'],
  confidence: 0.80,
  extractedFromPhoto: false,
}

/** Speedmaster-like — chrono archetype, high heritage, racing motifs. */
export const speedyLikeTaste: CatalogTasteAttributes = {
  formality: 0.45,
  sportiness: 0.75,
  heritageScore: 0.95,
  primaryArchetype: 'chrono',
  eraSignal: 'vintage-leaning',
  designMotifs: ['applied-indices', 'domed-crystal'],
  confidence: 0.90,
  extractedFromPhoto: false,
}

/** Cartier-Tank-like — high formality, low sportiness, dress archetype, tank-case motif. */
export const tankLikeTaste: CatalogTasteAttributes = {
  formality: 0.95,
  sportiness: 0.10,
  heritageScore: 0.90,
  primaryArchetype: 'dress',
  eraSignal: 'vintage-leaning',
  designMotifs: ['tank-case', 'breguet-hands'],
  confidence: 0.75,
  extractedFromPhoto: false,
}

// ── LOW-CONFIDENCE FIXTURE (null-fallback test) ─────────────────────────

/** Low-confidence row — engine MUST treat as taste-null. */
export const lowConfTaste: CatalogTasteAttributes = {
  formality: 0.50,
  sportiness: 0.50,
  heritageScore: 0.50,
  primaryArchetype: 'hybrid',
  eraSignal: 'contemporary',
  designMotifs: [],
  confidence: 0.35,  // < 0.5 → taste contrib = 0
  extractedFromPhoto: false,
}

// ── EDGE FIXTURES (D-15 coverage) ────────────────────────────────────────

/** Confidence exactly = 0.5 (strict `>=` semantics — taste COUNTS). */
export const exactlyHalfConfTaste: CatalogTasteAttributes = {
  formality: 0.60,
  sportiness: 0.70,
  heritageScore: 0.75,
  primaryArchetype: 'sport',
  eraSignal: 'modern',
  designMotifs: ['integrated-bracelet'],
  confidence: 0.50,
  extractedFromPhoto: false,
}

/** Confidence = 0.499 (strict `<` semantics — taste DOES NOT count). */
export const justBelowHalfTaste: CatalogTasteAttributes = {
  formality: 0.60,
  sportiness: 0.70,
  heritageScore: 0.75,
  primaryArchetype: 'sport',
  eraSignal: 'modern',
  designMotifs: ['integrated-bracelet'],
  confidence: 0.499,
  extractedFromPhoto: false,
}

/** Empty designMotifs array (Jaccard returns 0; no crash). */
export const emptyMotifsTaste: CatalogTasteAttributes = {
  formality: 0.40,
  sportiness: 0.60,
  heritageScore: 0.70,
  primaryArchetype: 'field',
  eraSignal: 'contemporary',
  designMotifs: [],  // empty — Jaccard short-circuit returns 0
  confidence: 0.80,
  extractedFromPhoto: false,
}

/** All-null numeric trio (cosine drops contribution). */
export const nullNumericsTaste: CatalogTasteAttributes = {
  formality: null,
  sportiness: null,
  heritageScore: null,
  primaryArchetype: 'tool',
  eraSignal: 'contemporary',
  designMotifs: ['compressor-case'],
  confidence: 0.80,
  extractedFromPhoto: false,
}
```

**Vocab provenance verified:** Every `primaryArchetype` value above is in `PRIMARY_ARCHETYPES` (vocab.ts:16-19). Every `eraSignal` value is in `ERA_SIGNALS` (vocab.ts:22-24). Every `designMotif` is in `DESIGN_MOTIFS` (vocab.ts:29-41).

**Confidence:** HIGH (vocab membership verified by grep against vocab.ts).

### Q3 — D-07 fixture commit grouping — exact file list

**Answer:** Per `grep -rln "createWatch\|insert(watches)\|catalogId:" tests/`, **17 files** construct Watch rows directly or call `createWatch`. Grouped by D-07 commit family:

#### tests/integration/phase11-* family (one commit)
1. `tests/integration/phase11-schema.test.ts`
2. `tests/integration/phase11-storage-rls.test.ts`

#### tests/integration/phase12-* family (one commit)
3. `tests/integration/phase12-visibility-matrix.test.ts`

#### tests/integration/phase15-* family (one commit)
4. `tests/integration/phase15-wear-detail-gating.test.ts`
5. `tests/integration/phase15-wywt-photo-flow.test.ts`

#### tests/integration/phase17-* family (one commit)
6. `tests/integration/phase17-addwatch-wiring.test.ts`
7. `tests/integration/phase17-backfill-idempotency.test.ts` *(includes `db.insert(watches).values({...})` at lines 65, 138)*
8. `tests/integration/phase17-catalog-rls.test.ts`
9. `tests/integration/phase17-join-shape.test.ts` *(includes `db.insert(watches).values({...})` at lines 45, 56)*
10. `tests/integration/phase17-refresh-counts.test.ts` *(includes `db.insert(watches).values({...})` at line 33)*

#### tests/integration/phase19-* family (one commit)
11. `tests/integration/phase19-collections-privacy.test.ts`

#### tests/integration/phase27-* family (one commit)
12. `tests/integration/phase27-backfill.test.ts` *(includes `db.insert(watches).values({...})` at line 49)*
13. `tests/integration/phase27-bulk-reorder.test.ts` *(includes `db.insert(watches).values({...})` at lines 56, 70)*
14. `tests/integration/phase27-getwatchesbyuser-order.test.ts`

#### tests/integration cross-cutting (one commit)
15. `tests/integration/home-privacy.test.ts`
16. `tests/integration/debt02-rls-audit.test.ts`
17. `tests/integration/add-watch-flow-search-cta.test.tsx`

#### tests/data/ family (one commit)
18. `tests/data/getWearEventsCountByUser.test.ts`

#### Already-passing files (verify-only, no edit expected)
- `tests/integration/phase37-rls.test.ts` — already constructs catalogId per Phase 37 D-09 NOT NULL precedent; no fixture edit needed (verify in Plan A Task 5 verification).
- `tests/data/isolation.test.ts`, `tests/data/getRecommendationsForViewer.test.ts`, `tests/data/getSuggestedCollectors.test.ts`, `tests/data/getWatchByIdForViewer.test.ts`, `tests/data/getWearRailForViewer.test.ts` — all use `watchDAL.createWatch(...)` which becomes a signature-changed call; auto-cascades when the DAL signature changes. **These tests' fixture objects do NOT need a `catalogId:` field if the helper auto-upserts a catalog row (recommended) OR the tests need explicit catalogId values if the helper requires it.**

**Critical question for the planner:** Do we (a) require all `createWatch(userId, data)` callers to supply `catalogId`, OR (b) introduce a Phase 38 test helper `createWatchWithCatalog(userId, data)` that auto-upserts a catalog row and passes its id? Option (b) keeps the 17-fixture cascade smaller (only the 6 `db.insert(watches).values({...})` raw-SQL fixtures need updates; the 5 `tests/data/*` files using `watchDAL.createWatch` get a one-line import swap). Option (a) is what CONTEXT.md D-06 strongly implies. **Recommend planner pick option (a)** to match CONTEXT.md's intent — explicit `catalogId` passing makes the test data's catalog linkage observable and matches the new production flow (callers always know their catalogId).

**Commit count summary:** 8 commits per D-07 (one per family) + 1 commit for `tests/data/*` family = **9 fixture commits** total in Plan A Step 3. Plus 1 DAL-signature commit (Step 1), 1 production-callsite commit (Step 2 — bundled or split per planner choice), and 1 schema-flip commit (Step 4, LAST). Total Plan A commits: **~11-13**.

**Confidence:** HIGH (grep verified).

### Q4 — `arrayOverlap` helper verification

**Answer (verified by reading `src/lib/similarity.ts:55-60` verbatim):**

```typescript
function arrayOverlap(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 || arr2.length === 0) return 0
  const intersection = arr1.filter((item) => arr2.includes(item))
  const union = new Set([...arr1, ...arr2])
  return intersection.length / union.size
}
```

This **IS** Jaccard (|A∩B| / |A∪B|). Numerator: intersection size. Denominator: union size (deduplicated via `Set`). Empty-on-either-side short-circuits to 0 — matches D-03 edge: "Empty array on either side → 0.0."

**Recommendation:** Reuse verbatim per D-03 "mirrors existing `arrayOverlap` helper at `src/lib/similarity.ts` lines 55–60". No new helper. No rename.

**Minor caveat (FYI for the planner):** The intersection step uses `arr1.filter(item => arr2.includes(item))` which counts duplicate values in `arr1` against `arr2`. For `designMotifs`, the Phase 19.1 vocab filter (`validateAndCleanTaste` in vocab.ts:84-96) already iterates motifs without de-duping; if an LLM ever emits the same motif twice in `design_motifs`, the duplicate would double-count in intersection. CONTEXT.md D-03 doesn't require pre-dedup. Recommend leaving as-is for parity; if dedup matters, it's a downstream polish call.

**Confidence:** HIGH.

### Q5 — Cosine implementation idiom for numeric trio

**Answer:** 3-line `cosine3D` helper — null-safe at the caller (drop contribution when any of the 6 numerics is null). Implementation already shown in §Pattern 2 above. Recapped:

```typescript
function cosine3D(a: [number, number, number], b: [number, number, number]): number {
  const dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
  const ma = Math.hypot(a[0], a[1], a[2])
  const mb = Math.hypot(b[0], b[1], b[2])
  if (ma === 0 || mb === 0) return 0
  return dot / (ma * mb)
}
```

**Null/zero-vector handling:**
- All-null trio on either side → caller short-circuits to 0 contribution (don't even call cosine3D).
- All-zero trio (formality=0, sportiness=0, heritageScore=0) → magnitude is 0 → return 0 contribution. Cosine of all-zero vector is mathematically undefined; treating as 0 is the convention used by recommender systems (and by `sklearn.metrics.pairwise.cosine_similarity` when handling zero vectors).
- Range: cosine of two non-negative-octant vectors in [0,1]³ is in [0, 1]. No need for the `(1 + cos) / 2` normalization that vectors with negative components require.

**Cosine vs Euclidean tradeoff (CONTEXT.md Claude's Discretion):** Cosine is recommended because:
1. The trio captures *direction* of taste (e.g., "formal + heritage-heavy + low-sportiness"), not absolute magnitudes.
2. Two watches at (0.2, 0.2, 0.2) and (0.8, 0.8, 0.8) are *directionally identical* but Euclidean distance is large (0.6 × √3 ≈ 1.04). Cosine = 1.0 captures the intuition that both watches are "balanced across the three axes."
3. The other 3 sub-components (archetype/era/motifs) are *categorical exact matches*; cosine on the numeric trio gives a *gradient* signal in the same range — same operational shape.

**Confidence:** HIGH.

### Q6 — `getWatchesByUser` current shape + LEFT JOIN feasibility

**Answer (verified by reading `src/data/watches.ts:120-127`):**

Current shape:
```typescript
export async function getWatchesByUser(userId: string): Promise<Watch[]> {
  const rows = await db
    .select()
    .from(watches)
    .where(eq(watches.userId, userId))
    .orderBy(asc(watches.sortOrder), desc(watches.createdAt))
  return rows.map(mapRowToWatch)
}
```

- **Columns selected:** All columns from `watches` via `select()` (no projection — full row).
- **Existing JOINs:** None.
- **Return type:** `Promise<Watch[]>`.

**LEFT JOIN feasibility:** Mechanically straightforward — single SQL query, no N+1. The pattern at `src/lib/verdict/viewerTasteProfile.ts:42-58` (innerJoin watches_catalog with confidence filter) is the closest precedent — same join key, same numeric coercion need. The change to `getWatchesByUser`:

1. Switch `select()` → `select({watch: watches, taste: {...}})` projection (named for ergonomics).
2. Add `.leftJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))`.
3. Update `mapRowToWatch` call site to construct `Watch.catalogTaste` from the projected taste object.

**N+1 risk:** None — LEFT JOIN is single SQL.

**Performance:** With <500 watches/user (project constraint per CLAUDE.md), the per-row cost of 8 extra JSON columns is negligible. No index changes needed — `watches_catalog_id_idx` (schema.ts:167) already supports the JOIN's lookup.

**Drizzle idiom:** Project precedent uses **explicit projection objects** when joining (see viewerTasteProfile.ts:43-50, wearEvents.ts:67-79, notifications.ts:36-48). Avoid `select()` with no projection across joined tables — Drizzle's row shape becomes harder to type. Use the projected form shown in §Pattern 1.

**Confidence:** HIGH (multiple precedents in DAL).

### Q7 — Validation Architecture (Nyquist)

See dedicated §Validation Architecture section below.

### Q8 — Phase 39 / SEED-002 forward-compatibility

**Answer:** Phase 38's proposed shape does NOT close doors for downstream consumers. Verified by inspecting each.

**Phase 39 FIT-05 (pairwise drill-down):**
- FIT-05 needs per-watch taste-attribute visibility in CollectionFitCard's drill-down. Phase 38's `Watch.catalogTaste` on every Watch row in `getWatchesByUser` makes this trivial — FIT-05's drill-down component reads `match.watch.catalogTaste` directly.
- FIT-05 also wants "taste contribution per dimension" copy (e.g., "shares dive archetype, +0.04"). Phase 38's `SimilarityResult` shape is unchanged (no `tasteContribution` field). FIT-05 would need to add this — Phase 38 doesn't block it, but doesn't help either. **Recommend planner consider adding a `tasteContribution: number` field to `SimilarityResult` in Phase 38 as a forward-compat assist** (CONTEXT.md lists this as "Deferred" — engine output schema extension). If added, the field defaults to 0 when taste is gated off, preserving the byte-identical-when-gated semantics. **Decision belongs to discuss-phase, not researcher.** Surfaced as Assumption A1.

**SEED-002 (hybrid recommender):**
- The recommender needs the JOIN'd Watch shape (catalogTaste populated). Phase 38 ships exactly that via `getWatchesByUser`.
- The recommender will also want a `getWatchesByCatalogId` shape (cross-collector queries — "who else owns the same reference?"). Phase 38 doesn't add this, but doesn't preclude it. Out of scope per CONTEXT.md deferred items.
- The recommender will eventually want a behavioral signal layer (`divestments` table, wear_events frequency). Phase 37 Layer D already ships `divestments`; Phase 38 doesn't read from it.

**No forward-compat breakage.** Phase 38 ships exactly the structured-signal foundation that v6.x will layer collaborative-filtering on top of.

**Confidence:** HIGH.

### Q9 — `createWatch` callers cascade — exact tsc error count and file:line

**Answer (verified by reading Phase 36 deferred-items.md + grep of src/ and tests/):**

**18 tsc errors across 15 files** (per Phase 36 deferred-items.md):

#### Production source (3 callsites — CONTEXT.md MISSES wishlist.ts)
1. `src/data/watches.ts:197` — `createWatch(userId, data)` DAL signature. **CONTEXT.md acknowledges this.**
2. `src/app/actions/watches.ts:121` — `watchDAL.createWatch(user.id, createPayload)` in `addWatch`. **CONTEXT.md D-06 acknowledges.**
3. `src/app/actions/wishlist.ts:124` — `createWatch(user.id, { brand, model, status: 'wishlist', ... })` in `addToWishlistFromWearEvent`. **🚩 CONTEXT.md D-06 MISSES this; Phase 36 deferred-items.md Item 1 explicitly calls it out.**

**Note about call site #2 ambiguity:** CONTEXT.md says "two production call sites must upsert catalog BEFORE `createWatch`. The two call sites — manual entry (`src/app/actions/watches.ts addWatch`) and URL extract (`src/app/api/extract-watch/route.ts`)." But `src/app/api/extract-watch/route.ts` does NOT call `createWatch` directly — it only returns `catalogId` for the client to pass to a subsequent `addWatch` call. The URL extract route already upserts catalog. So `route.ts` is NOT a `createWatch` caller. The actual second caller is wishlist.ts.

**The "two call sites" in CONTEXT.md D-06 should read "three call sites":**
- `src/app/actions/watches.ts addWatch` (manual entry — CONTEXT.md got this right)
- `src/app/actions/wishlist.ts addToWishlistFromWearEvent` (WYWT "Add to wishlist" overlay — CONTEXT.md missed this; STATE.md decision log calls it out)
- The URL extract route already does upsert (no flow change needed there)

**Recommendation to planner:** Plan A scope MUST include `src/app/actions/wishlist.ts:124` as a third production call site. The refactor: before `createWatch`, call `upsertCatalogFromUserInput({brand: row.brand, model: row.model, reference: null})` — the WYWT source watch row's brand/model is denormalized into the snapshot, so we use the same upsert helper as `addWatch`.

#### Test fixtures (17 files per Phase 36 deferred-items.md count — but grep finds 18; the discrepancy is likely `phase37-rls.test.ts` which already supplies catalogId)

The 17-fixture count comes from Phase 36 deferred-items.md Item 1. Grep confirms (see Q3 above) — same 17 files in tests/integration/* + tests/data/* with one already-passing (phase37-rls.test.ts).

**Total cascade size:**
- 3 production source edits (Plan A Steps 1-2)
- 17 test fixture edits (Plan A Step 3)
- 1 schema flip (Plan A Step 4)
- = 21 file edits across ~11-13 commits

**Confidence:** HIGH (cross-referenced Phase 36 deferred-items.md, STATE.md decision log, and grep).

### Q10 — Parity verification (success criterion #5)

**Answer:** Verified the parity surfaces by reading each file. Nothing in Phase 38's proposed change touches any of the byte-locked surfaces.

| Surface | File | Phase 38 touches? | Verification |
|---------|------|-------------------|--------------|
| `extractWithLlm()` body | `src/lib/extractors/llm.ts` | NO | Phase 38 only consumes catalog taste; does not re-enrich |
| `SimilarityResult` shape | `src/lib/types.ts:158-164` | NO (unless A1 accepted) | Phase 38 D-01..D-05 explicitly preserve; no new fields |
| `SimilarityLabel` enum | `src/lib/types.ts:150-156` | NO | 6 labels unchanged |
| `GOAL_THRESHOLDS` map | `src/lib/similarity.ts:31-36` | NO | Goal-aware taste weighting deferred |
| `tests/static/CollectionFitCard.no-engine.test.ts` | `tests/static/...` | NO | Test asserts `CollectionFitCard.tsx` does NOT import similarity/composer — Phase 38 doesn't change CollectionFitCard.tsx |
| `tests/no-evaluate-route.test.ts` | `tests/...` | NO | Test asserts `/evaluate` route doesn't exist — Phase 38 doesn't create it |
| `WEIGHTS` total | `src/lib/similarity.ts:10-19` | YES, but D-05 preserves sum=1.0 | Reweighted to 0.80 + new 0.20 taste = 1.00 |

**Place a careless rewire could break parity (planner watch-list):**

1. **Accidentally hardcoding the rescaled values.** A planner reading `0.25 → 0.20` for styleTags might copy the magic number. D-05 explicitly forbids — use the constant transformation. (Static guard: grep for `0.20.*styleTags` post-edit; expect zero matches.)

2. **Changing the order of dimensions in `WEIGHTS` const.** If a downstream consumer reads `Object.keys(WEIGHTS)` (none does today, but verify), order matters. Recommend preserving insertion order: 8 existing + `taste` last.

3. **Forgetting to coerce numeric columns.** Pre-rewire, `analyzeSimilarity` never sees `catalogTaste`. Post-rewire, the engine receives `formality: string | number | null` if the DAL doesn't coerce. **Coerce in the DAL mapper**, not in the engine. See Pattern 1.

4. **Returning numeric `score` outside [0,1].** The 8 existing dims + new taste dim sum to 1.0; per-pair score is in [0,1]. Goal-aware thresholds compare against this; if the new taste branch ever exceeds its weighted ceiling (e.g., cosine > 1.0 due to numeric drift), threshold logic could mis-classify. Recommend adding a `Math.max(0, Math.min(1, cosine))` clamp inside cosine3D as a defensive belt.

5. **Empty designMotifs array vs null.** `Watch.catalogTaste.designMotifs` is `string[]` (never null per Phase 19.1 D-22 default `'{}'`). But if a partially-populated catalog row has `designMotifs: []` AND `confidence: 0.8`, the Jaccard returns 0 (correct), AND `arrayOverlap` returns 0 (verified — short-circuits on length === 0). No null-handling needed; the type system already enforces.

6. **Breaking viewerTasteProfile.ts.** Phase 20 INNER JOIN on `eq(watchesCatalog.id, watches.catalogId)` works today because the JOIN drops rows where catalogId is null. Post-Plan-A, catalogId is NOT NULL — the INNER JOIN behavior matches LEFT JOIN. No code change required there, but the runtime behavior subtly changes (from "skip watches without catalog" to "all watches" because all watches now have a catalog). This is the desired new behavior. **No regression expected**, but worth a smoke test.

**Confidence:** HIGH.

## Migration Files (Plan A)

### Supabase migration (no-op DDL since Phase 36 already shipped SET NOT NULL)

```sql
-- supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql
-- Phase 38 D-06 — Drizzle catch-up to existing prod state.
-- Phase 36 already shipped SET NOT NULL via 20260511000000_phase36_layer_c_variants.sql
-- (verified Phase 36 Plan 05 §36.4 smoke test: watches.catalog_id is_nullable=NO).
-- This migration is a no-op in prod (idempotent re-assertion) but required so the
-- Drizzle schema's .notNull() flip matches a supabase migration commit.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'watches'
      AND column_name = 'catalog_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL;
    RAISE NOTICE 'Phase 38: applied SET NOT NULL on watches.catalog_id';
  ELSE
    RAISE NOTICE 'Phase 38: watches.catalog_id already NOT NULL (Phase 36 already shipped); no-op';
  END IF;
END $$;
```

### Drizzle migration twin

```sql
-- drizzle/0011_phase38_catalog_id_notnull.sql
-- Idempotent twin of supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql.
-- Mirror Phase 35/36 idempotent pattern.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'watches'
      AND column_name = 'catalog_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL;
  END IF;
END $$;
```

### Journal append

`drizzle/meta/_journal.json` entries[] gets:
```json
{
  "idx": 11,
  "version": "7",
  "when": <unix ms at execution time>,
  "tag": "0011_phase38_catalog_id_notnull",
  "breakpoints": true
}
```

## Fixture Drafts (for §Pattern 3 reference)

See Q2 above for the complete `tests/fixtures/catalogTaste.ts` content.

## Common Pitfalls

### Pitfall 1: CONTEXT.md undercounts production callsites — wishlist.ts is missed

**What goes wrong:** Plan A executes against the two callsites CONTEXT.md D-06 names. tsc shows residual errors from `wishlist.ts:124`. Plan A AC fails ("project tsc regresses to 27-error baseline").

**Why it happens:** CONTEXT.md D-06 enumeration says "manual entry (`addWatch`) and URL extract (`route.ts`)" — but route.ts is NOT a `createWatch` caller. The true second caller is `wishlist.ts addToWishlistFromWearEvent`.

**How to avoid:** Plan A explicitly enumerates THREE production callsites (`watches.ts:121`, `wishlist.ts:124`, plus the DAL signature itself at `data/watches.ts:197`). Phase 36 deferred-items.md Item 1 has the correct count; CONTEXT.md should be amended in discuss-phase or the planner just expands the scope.

**Warning signs:** tsc shows `Argument of type '...' is not assignable to parameter` at `wishlist.ts:124` after Plan A Steps 1+2 ship.

### Pitfall 2: Numeric column string-coercion forgotten in DAL JOIN

**What goes wrong:** Post-rewire, engine receives `formality: "0.85"` (string) instead of `0.85` (number). Cosine math produces `NaN`. All scores collapse.

**Why it happens:** postgres-js surfaces `numeric` columns as strings to preserve precision. JS `0.85 * 0.85 = 0.7225` but `"0.85" * "0.85" = 0.7225` (coerced) — TS strict mode rejects the operation.

**How to avoid:** Coerce in `getWatchesByUser`'s mapper using `Number()` per viewerTasteProfile.ts:67 precedent. Or use `.toString().map(Number)`.

**Warning signs:** `taste-present.test.ts` shows `NaN` in scores instead of expected values. tsc error `Operator '+' cannot be applied to types 'string' and 'number'` in similarity.ts.

### Pitfall 3: Static guard test ordering wrong → guards pass for wrong reason

**What goes wrong:** `similarity.taste-null.test.ts` is written AFTER the engine rewire. The test asserts byte-identical behavior, which passes — but the byte-identical assertion is against the post-rewire code, not the pre-rewire baseline. The test no longer protects against future regressions.

**Why it happens:** D-13 explicitly mandates test-first ordering, but a developer not reading D-13 might write all 3 tests at once after the rewire.

**How to avoid:** Plan B task ordering per D-13: (1) DAL change, (2) write null test (passes vs pre-rewire), (3) write present test (FAILS vs pre-rewire — explicit RED), (4) modify engine (both tests now pass). Atomic commits make this auditable in git log. Plan B SUMMARY should reference commit SHAs proving the test-first order.

**Warning signs:** Plan B has all changes in a single mega-commit; can't replay the test-first ordering.

### Pitfall 4: Re-running drizzle-kit generate produces a divergent 0011 migration

**What goes wrong:** A future developer runs `npm run db:generate` (drizzle-kit generate) and it emits `drizzle/0011_some_random_name.sql` because the snapshot in `drizzle/meta/0010_snapshot.json` doesn't yet reflect the .notNull() addition. The hand-written `0011_phase38_catalog_id_notnull.sql` gets renamed or duplicated.

**Why it happens:** Drizzle-kit's generate path expects to author migrations from snapshot diffs, not from hand-written SQL.

**How to avoid:** Author the Drizzle migration as `drizzle/0011_phase38_catalog_id_notnull.sql` **AND** regenerate the snapshot via `drizzle-kit generate` after the schema.ts edit, then **rename** the generated SQL to `0011_phase38_catalog_id_notnull.sql` (overwriting the hand-written file) so the snapshot matches. This is the standard Phase 35/36/37 pattern.

**Warning signs:** Subsequent phases' `drizzle-kit generate` calls emit unexpected DDL because the snapshot is stale.

### Pitfall 5: Test fixtures share IDs leading to false-positive D-15 alignment

**What goes wrong:** `composer-engine-alignment.test.ts` reuses test fixture IDs. The composer's `result.mostSimilarWatches` array references stale watches by ID. Alignment assertion comparing labels passes even though the underlying scoring diverged.

**Why it happens:** `tests/fixtures/watches.ts:7` uses a module-level `idCounter` for deterministic IDs. If two tests in the same vitest run share fixture references, the counter doesn't reset between tests.

**How to avoid:** In `composer-engine-alignment.test.ts`, construct each scenario in an isolated `describe` block with explicit IDs (e.g., `id: 'scenario-1-target'`) rather than calling `makeWatch()` repeatedly. Or call `beforeEach` to reset the counter (set `idCounter = 0`).

**Warning signs:** Alignment test passes locally but fails in CI when test execution order differs.

### Pitfall 6: LEFT JOIN drops watches when no catalog row exists (pre-Plan-A only)

**What goes wrong:** Phase 38 ships in two waves. After Plan B (DAL JOIN) ships but BEFORE Plan A (NOT NULL flip), there may exist watches with `catalogId IS NULL`. The LEFT JOIN keeps them; the mapper produces `catalogTaste: null` for those rows. Engine gates on null → byte-identical to pre-rewire. **This is the desired transitional behavior.**

But if a developer accidentally writes INNER JOIN (matching viewerTasteProfile.ts precedent), those legacy watches would be dropped from `getWatchesByUser` output. Cascading test failures.

**How to avoid:** Use LEFT JOIN per D-11. Add a unit-test assertion that a watch with `catalogId: null` round-trips through `getWatchesByUser` with `catalogTaste: null` (test runs after Plan B but BEFORE Plan A — if executed after Plan A, no such watches exist and the test is vacuous).

**Warning signs:** Test count drops in `phase17-*` integration tests after Plan B Task 0 commit.

## Code Examples

See Pattern 1, Pattern 2, Pattern 3 above. All code in this document is derived from the existing project's verified precedents (file:line references provided).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `watches.catalog_id` nullable in Drizzle | NOT NULL after Plan A | Phase 38 | Type-system catches up to prod reality (Phase 36 already shipped SET NOT NULL at DB level) |
| 8-dimension similarity scoring | 9-dimension (taste added at 0.20) | Phase 38 | Phase 19.1's LLM-derived taste columns become observable in verdicts for the first time |
| `getWatchesByUser` returns `Watch[]` without catalog data | `Watch[]` with optional `catalogTaste` populated via LEFT JOIN | Phase 38 | Engine, composer, future FIT-05 all consume the same shape |
| `createWatch(userId, data)` with optional catalog link via separate `linkWatchToCatalog` | `createWatch(userId, data, catalogId)` (catalogId required) — atomic single-step | Phase 38 | Eliminates the legacy "insert with NULL, link later" pattern; matches prod NOT NULL constraint |

**Deprecated/outdated:**
- `linkWatchToCatalog` helper (`src/data/watches.ts:257-266`): no longer needed post-Plan-A since `createWatch` now requires `catalogId`. **Recommendation: DELETE in Plan A Step 1** (or mark `@deprecated`). Currently called only from `addWatch` post-create; the refactored `addWatch` calls upsert THEN createWatch, eliminating the link step. CONTEXT.md doesn't explicitly call this out — flagged as Assumption A2.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 38 should NOT add `tasteContribution: number` to `SimilarityResult` | Q8 / §State of the Art | If recommender (SEED-002) actually needs per-dim contributions visible in v6.x, deferring is fine — the engine can be re-rewired then. Low risk. CONTEXT.md explicitly defers. |
| A2 | `linkWatchToCatalog` can be DELETED post-Plan-A (single caller eliminated) | §State of the Art | If any test still mocks `linkWatchToCatalog`, those mocks become dead code. Searched src/ — only one caller; tests/ mock it but the mocks become inert (no failure). Low risk. |
| A3 | Cosine vs Euclidean: cosine recommended | Q5 | If Euclidean would produce materially better discrimination on prod data, recommend Polish-phase A/B. CONTEXT.md grants discretion; defer A/B to user feedback. Low risk. |
| A4 | The 17 test fixture commit grouping per D-07 maps to 8-9 commits | Q3 | If a fixture file belongs to multiple phase families (e.g., touches both phase17 and phase27 schema), commit boundary becomes fuzzy. Spot-check: each file's filename clearly indicates ONE family. Low risk. |
| A5 | The supabase migration is a no-op in prod (Phase 36 already shipped SET NOT NULL) | Q1 / §Migration Files | If Phase 36 prod deploy didn't actually flip the constraint (operator checkpoint pending per STATE.md), the migration is NOT a no-op — it does the actual flip. Either way the DDL is correct. The DO $$ idempotent block handles both states. Zero risk. |
| A6 | Wishlist.ts:124 (the third callsite CONTEXT.md missed) refactors by calling `upsertCatalogFromUserInput({brand, model, reference: null})` | Q9 / §Architecture diagram | If WYWT's source watch already has a catalogId that should be reused (not re-upserted), the recommended refactor produces a duplicate catalog row attempt (idempotent, no-op — first-write-wins per Phase 17 D-13, but wasteful). Alternative: JOIN to source watches.catalogId and pass it through. **Recommend discuss-phase clarify whether to inherit source catalogId or re-upsert.** Medium risk (correctness preserved; perf slightly worse if re-upsert chosen). |

**If this table is empty:** N/A — 6 assumptions surfaced; A6 is the highest-risk and should be confirmed in discuss-phase before Plan A ships.

## Open Questions

1. **Should `linkWatchToCatalog` be deleted in Plan A?**
   - What we know: Single caller (`addWatch`); post-Plan-A flow eliminates the call.
   - What's unclear: Whether tests still need to mock it for resilience scenarios (`tests/actions/addwatch-catalog-resilience.test.ts` mocks it).
   - Recommendation: Mark `@deprecated` in Plan A; delete in Polish.

2. **Wishlist.ts refactor: inherit source catalogId or re-upsert?**
   - What we know: Source wear event's watch row has its own catalogId (post-Plan-A guaranteed non-null).
   - What's unclear: Whether WYWT-source catalogId should be passed through (cheaper, semantically richer — "I added this exact watch to my wishlist") or whether a fresh upsert should fire (decouples wishlist row from source wear event's catalog lineage).
   - Recommendation: Discuss-phase user decision. Default to **pass-through** (cheaper; matches WYWT's snapshot intent).

3. **Should the planner add a `tasteContribution: number` field to `SimilarityResult` for FIT-05 forward-compat?**
   - What we know: FIT-05 wants per-dim taste visibility; CONTEXT.md defers this.
   - What's unclear: Whether v5.0 Phase 39 polish would prefer a forward-compat field over a future re-rewire.
   - Recommendation: Leave deferred per CONTEXT.md. Surfaced as A1.

4. **Does the URL extract route need any flow change at all?**
   - What we know: `src/app/api/extract-watch/route.ts` already upserts catalog and returns catalogId; never calls createWatch directly.
   - What's unclear: CONTEXT.md D-06 lists this as a callsite that "must upsert catalog BEFORE `createWatch`" — but it already does, and it never invokes createWatch in the same request.
   - Recommendation: Plan A scope drops route.ts from the "production callsite" enumeration (no edit needed). Confirm with discuss-phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All execution | ✓ | (project npm-pinned) | — |
| TypeScript 5 | tsc verification | ✓ | ^5 | — |
| drizzle-orm | DAL JOIN | ✓ | 0.45.2 | — |
| postgres-js | Postgres driver | ✓ | (existing) | — |
| Supabase CLI | Migration push (Plan A Step 4) | not verified — assume available per Phase 37 prod-push success | — | Manual `psql` via `docker exec` per Phase 36 precedent if CLI unavailable |
| Docker (local) | Optional — local schema push integration test | not verified | — | Skip local push if Docker unavailable; rely on Supabase CLI directly |
| Anthropic API | NOT needed (Phase 19.1 byte-locked, untouched) | N/A | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Supabase CLI / Docker — both have well-documented fallbacks per Phase 36/37 runbooks.

**Skip condition:** Phase 38 has external dependencies on Supabase + drizzle-kit, so audit applies.

## Validation Architecture

**Workflow setting:** `workflow.nyquist_validation` not explicitly set to false in `.planning/config.json` → treat as enabled. Including this section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (project standard; ESM) |
| Config file | `vitest.config.ts` at project root |
| Quick run command | `npx vitest run tests/static/similarity.taste-null.test.ts tests/static/similarity.taste-present.test.ts tests/static/composer-engine-alignment.test.ts -x` |
| Full suite command | `npx vitest run` |
| Plan A specific | `npx tsc --noEmit` (no test runner; type-check is the AC) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CAT-13 #1 | Engine output byte-identical when catalogTaste null or confidence < 0.5 | static (Vitest) | `npx vitest run tests/static/similarity.taste-null.test.ts` | ❌ Plan B Task 2 creates |
| CAT-13 #2 | Engine produces higher score for taste-compatible pair vs taste-incompatible pair (confidence ≥ 0.5) | static (Vitest) | `npx vitest run tests/static/similarity.taste-present.test.ts` | ❌ Plan B Task 3 creates |
| CAT-13 #3 | Both static guards pass AFTER similarity.ts modified | static (Vitest) — same files | (same as above) | ❌ Plan B Task 4 re-runs |
| CAT-13 #4 | Watch.catalogTaste field exists; getWatchesByUser LEFT JOINs | TS type-check + DAL unit | `npx tsc --noEmit && npx vitest run src/data/__tests__/watches.test.ts` (if exists) | type-check ✓; DAL test ❌ recommended new |
| CAT-13 #5 | CollectionFitCard.no-engine.test.ts passes unchanged | static (Vitest) | `npx vitest run tests/static/CollectionFitCard.no-engine.test.ts` | ✓ exists |
| CAT-13 #5 | extractWithLlm() byte-locked | static grep guard | `git diff main...HEAD -- src/lib/extractors/llm.ts` exits clean | implicit — no test file |
| CAT-13 D-04 | Composer-engine verbal/numeric agreement across 10 scenarios | static (Vitest) | `npx vitest run tests/static/composer-engine-alignment.test.ts` | ❌ Plan C creates |
| Plan A | watches.catalogId .notNull() applied | type-check + DB DDL | `npx tsc --noEmit` exits 0 (or 27-baseline) + `psql -c "\d watches"` shows `not null` | type-check ✓; DDL state ✓ post-Plan-A Step 4 |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (Plan A) OR `npx vitest run tests/static/similarity.taste-null.test.ts tests/static/similarity.taste-present.test.ts -x` (Plan B) OR the alignment test (Plan C)
- **Per wave merge:** Full suite — `npx vitest run`
- **Phase gate:** Full suite green + tsc clean + all 5 ROADMAP success criteria verifiable via specific grep/test commands documented in each plan's verify section

### Wave 0 Gaps

- [x] No new test framework install needed (vitest exists)
- [ ] `tests/fixtures/catalogTaste.ts` — NEW file with 5 typed CatalogTasteAttributes fixtures (per Q2)
- [ ] `tests/static/similarity.taste-null.test.ts` — NEW file (Plan B Task 2)
- [ ] `tests/static/similarity.taste-present.test.ts` — NEW file (Plan B Task 3)
- [ ] `tests/static/composer-engine-alignment.test.ts` — NEW file (Plan C)
- [ ] (Optional) `tests/data/watches-leftjoin.test.ts` — NEW unit test asserting `getWatchesByUser` populates `catalogTaste` correctly when catalogTaste exists vs null vs low-confidence. **Recommended addition by researcher** — Plan B AC for the DAL change should be observable in a test, not just a tsc compile.

**Runtime smoke check:** Phase 38 is a behavioral rewire — the user-visible effect is "verdicts change." A manual smoke test that exercises a known taste-compatible vs taste-incompatible pair on staging/prod would prove the rewire shipped. However, CONTEXT.md D-09 explicitly mandates Plan A/B/C all `autonomous: true` (no operator checkpoints), so no runtime smoke is gated. **Recommendation:** Plan C's alignment test acts as a proxy for runtime smoke — 10 scenarios covering null/low-conf/high-compatible/high-incompatible/edge cases produce equivalent confidence to a manual prod walk.

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Phase 38 Impact |
|------------|--------|-----------------|
| Tech stack: Next.js 16 App Router | CLAUDE.md §Constraints | Phase 38 doesn't touch Next.js APIs (engine + DAL + types only). No App Router work. |
| Data model: Watch and UserPreferences extend, don't break | CLAUDE.md §Constraints | `Watch.catalogTaste` is OPTIONAL — existing consumers unaffected. ✓ |
| Personal-first: single-user data isolation | CLAUDE.md §Constraints | DAL JOIN already scopes by `userId`. No multi-user coupling introduced. ✓ |
| Performance target <500 watches/user | CLAUDE.md §Constraints | LEFT JOIN at this scale is single SQL ~50ms; negligible. ✓ |
| No relative path traversals, use `@/*` | CLAUDE.md §Imports | All imports in new files use `@/*` alias. ✓ |
| GSD workflow enforcement: route work through GSD commands | CLAUDE.md §GSD Workflow Enforcement | Phase 38 IS a GSD phase — compliant by construction. ✓ |
| AGENTS.md: Next.js 16 breaking changes — read docs/ first | AGENTS.md | Phase 38 doesn't touch Next.js APIs. Inapplicable. ✓ |
| Memory rule: drizzle-kit push is LOCAL ONLY; prod uses `supabase db push --linked` | Memory: project_drizzle_supabase_db_mismatch.md | Plan A Step 4 follows this exactly. ✓ |
| Memory rule: 14-digit timestamp filename + no insertion + pg_depend pre-flight for enum/type changes | Memory: project_drizzle_supabase_db_mismatch.md | Phase 38 migration is a constraint-only change (no type/enum/DROP), so Rule 3+4 N/A. Rule 1+2 applied. ✓ |
| Memory rule: SECDEF grants — REVOKE FROM PUBLIC insufficient | Memory: project_supabase_secdef_grants.md | Phase 38 doesn't add SECURITY DEFINER functions. ✓ |
| Memory rule: prod DB is wipeable | Memory: project_db_wipeable_2026_05_09.md | Plan A is a no-op in prod (Phase 36 shipped SET NOT NULL). Wipe not needed; not relevant. ✓ |

## Sources

### Primary (HIGH confidence)
- **CONTEXT.md** — `.planning/phases/38-cat-13-engine-rewire/38-CONTEXT.md` — 15 user-locked decisions
- **Phase 36 deferred-items.md** — Authoritative source for the 18-error cascade across 15 files (1 production DAL + wishlist.ts + 17 fixtures)
- **STATE.md** — Decision log entries explicitly call out wishlist.ts:124 as a third callsite
- **REQUIREMENTS.md §CAT-13** — Locked requirement wording (9th additive dimension, confidence ≥ 0.5 gate, test-first guards, Watch.catalogTaste + LEFT JOIN)
- **ROADMAP.md §Phase 38** — Locked 5 success criteria

### Codebase (HIGH confidence — read in full)
- `src/lib/similarity.ts` (382 lines) — current engine; WEIGHTS, arrayOverlap, analyzeSimilarity verified
- `src/lib/types.ts` — Watch, CatalogTasteAttributes, SimilarityResult, SimilarityLabel, vocab type aliases
- `src/lib/taste/vocab.ts` — PRIMARY_ARCHETYPES (10), ERA_SIGNALS (3), DESIGN_MOTIFS (28); validateAndCleanTaste
- `src/data/watches.ts` — getWatchesByUser, createWatch, linkWatchToCatalog; existing JOIN patterns
- `src/data/catalog.ts` — upsertCatalogFromUserInput, upsertCatalogFromExtractedUrl, mapRowToCatalogEntry
- `src/db/schema.ts` (580 lines) — watches table, watches_catalog with all 8 taste columns, watch_variants, divestments
- `src/app/actions/watches.ts` — addWatch with current upsert-AFTER-create flow
- `src/app/actions/wishlist.ts` — addToWishlistFromWearEvent with current createWatch call (THIRD callsite CONTEXT.md misses)
- `src/app/api/extract-watch/route.ts` — POST handler; already upserts catalog; does NOT call createWatch
- `src/lib/verdict/viewerTasteProfile.ts` — Phase 20 aggregate; innerJoin + numeric coercion precedent
- `src/lib/verdict/viewerTasteProfile.test.ts` — testing pattern template (mocking Drizzle chain)
- `src/lib/verdict/composer.ts` — current verbal-numeric composition; confidence gating at 0.5/0.7
- `tests/static/CollectionFitCard.no-engine.test.ts` — boundary guard pattern
- `tests/no-evaluate-route.test.ts` — boundary guard pattern
- `tests/fixtures/watches.ts` — existing fixture conventions (`makeWatch`, deterministic IDs)

### Migration / journal (HIGH confidence)
- `supabase/migrations/` listing — latest timestamp `20260511010000_phase37_layer_d.sql`
- `drizzle/` listing — latest migration `0010_phase37_layer_d.sql`
- `drizzle/meta/_journal.json` — last entry idx=10

### No external sources needed
- This research draws entirely from project source + project memory. No WebSearch, Context7, or external documentation consulted — all decisions are pre-locked in CONTEXT.md and all patterns have established precedents in src/.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — drizzle-orm + vitest already pinned; no new deps
- Architecture: HIGH — every pattern has 1+ existing precedent in src/
- Pitfalls: HIGH — Phase 36 deferred-items.md captured the major one (wishlist.ts:124); Pitfalls 2-6 derived from reading the code
- Fixture realism: MEDIUM — fixtures are synthetic per CONTEXT.md D-14 (we cannot query prod). They are vocab-validated and shape-correct but not drawn from actual LLM output. Plan C may discover the synthetic profiles don't trigger expected verdict tiers; researcher's directional assertions (taste-compatible > taste-incompatible) are robust to this.
- Migration filenames: HIGH — verified via file listing

**Research date:** 2026-05-12
**Valid until:** 2026-06-11 (30 days — stable codebase, no fast-moving deps; Phase 38 is the next phase to execute)

---

## RESEARCH COMPLETE

**Phase:** 38 — CAT-13 Engine Rewire
**Confidence:** HIGH

### Key Findings

1. **CONTEXT.md undercounts production callsites by one.** Three callsites — `watches.ts:121`, `wishlist.ts:124`, and the DAL signature at `data/watches.ts:197`. CONTEXT.md D-06 names "two" and misidentifies `extract-watch/route.ts` as one (it doesn't call `createWatch`). Phase 36 deferred-items.md Item 1 has the correct count; Plan A scope must include `wishlist.ts:124`.
2. **Migration filenames confirmed:** `supabase/migrations/20260512000000_phase38_catalog_id_notnull.sql` + `drizzle/0011_phase38_catalog_id_notnull.sql` + journal idx=11.
3. **The existing `arrayOverlap` helper IS already Jaccard.** Reuse verbatim per D-03.
4. **Cosine recommended for numeric trio**; 3-line `cosine3D` with null/zero-vector handling.
5. **8-9 fixture commits in Plan A** (per D-07 family grouping); plus 3 production-source edits and 1 schema flip. ~11-13 total Plan A commits.
6. **5 typed CatalogTasteAttributes fixtures drafted** in §Q2 — drop-in for `tests/fixtures/catalogTaste.ts`; all vocab-validated.
7. **Phase 38 does NOT touch any byte-locked surface** (extractWithLlm, SimilarityResult, SimilarityLabel, GOAL_THRESHOLDS, the two existing static guards). 6 careless-rewire risks enumerated.
8. **No forward-compat breakage for FIT-05 / SEED-002.** Phase 38 ships the structured-signal foundation v6.x layers behavioral CF on top of.

### File Created
`.planning/phases/38-cat-13-engine-rewire/38-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | drizzle-orm + vitest already pinned; no new deps |
| Architecture | HIGH | Every pattern (LEFT JOIN, numeric coercion, fixture file) has existing precedent in src/ |
| Pitfalls | HIGH | Phase 36 deferred-items.md captured the wishlist.ts miss; other 5 pitfalls derive from reading the engine + DAL |
| Migration filenames | HIGH | Verified via `ls` + journal read |
| Fixture realism | MEDIUM | Synthetic (no prod access); vocab-validated; directional assertions robust to fixture shape |
| User Constraints fidelity | HIGH | All 15 D-NN decisions copied verbatim from CONTEXT.md |

### Open Questions for discuss-phase or planner

1. **Confirm wishlist.ts:124 enters Plan A scope as a third callsite.** Recommend YES — Phase 36 deferred-items.md mandates it.
2. **Wishlist.ts refactor: inherit source catalogId or re-upsert?** Recommend pass-through (cheaper, semantically richer).
3. **Should `linkWatchToCatalog` be DELETED in Plan A** or marked `@deprecated`? Recommend `@deprecated` in Plan A; delete in Polish.
4. **Should Phase 38 add `tasteContribution: number` to `SimilarityResult` for FIT-05 forward-compat?** CONTEXT.md defers. Recommend STAY DEFERRED.
5. **Drop `src/app/api/extract-watch/route.ts` from Plan A's "production callsite" list** (it doesn't call createWatch).
6. **Drizzle types match prod constraint post-Plan-A:** `InferSelectModel<typeof watches>.catalogId` must be `string` (not `string | null`). Add as Plan A explicit AC.

### Ready for Planning

All 10 open research questions answered. CONTEXT.md decisions verified consistent with codebase except the wishlist.ts:124 gap (well-documented in Phase 36 deferred-items.md). Planner can now author Plan A / Plan B / Plan C with the file lists, fixture drafts, migration SQL, and pattern references provided. Recommend planner explicitly resolves A6 (wishlist.ts refactor strategy) before Plan A ships.

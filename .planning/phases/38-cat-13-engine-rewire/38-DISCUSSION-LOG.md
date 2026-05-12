# Phase 38: CAT-13 Engine Rewire — Discussion Log

**Session:** 2026-05-12
**Mode:** discuss (default)
**Outcome:** 7 gray areas decided; 15 implementation decisions captured in CONTEXT.md

---

## Round 1 — Four core gray areas

### Q1. Score weighting magnitude for the 9th taste dimension

**Question:** The 8 existing dimensions sum to weight 1.00. CAT-13 says taste is 'additive' — how should the 9th dimension fit into the weight budget?

**Options presented:**
1. Reweight to 0.85 + 0.15 taste (Recommended)
2. Pure additive bonus (sum > 1.0, cap at 1.0)
3. Reweight to 0.80 + 0.20 taste
4. Defer math to research/plan phase

**Selected:** **Reweight to 0.80 + 0.20 taste**

**Rationale captured:** Heavier taste influence — LLM-derived structured taste worth more than `dialColor + complications` combined. Matches the intuition that structured catalog taste is more reliable than user-entered tags. Threshold semantics preserved because total weight budget stays at 1.00.

---

### Q2. Confidence gate — binary vs graded

**Question:** Phase 19.1 / Phase 20 use confidence ≥ 0.5 as the gate. Should engine taste contribution be binary (in/out) or graded (scales with confidence)?

**Options presented:**
1. Binary gate at 0.5 (Recommended)
2. Two-tier gate (0.5/0.7)
3. Linear scaling from 0.5

**Selected:** **Binary gate at 0.5 (Recommended)**

**Rationale captured:** Matches Phase 20 composer's primary threshold; simplest test design; clear inferential semantics. Two-tier gating (0.5/0.7) considered for verbal-numeric alignment but rejected — Phase 20 composer's 0.7 threshold is about COPY confidence ("we can say this with conviction"), not contribution strength.

---

### Q3. catalogId .notNull() bundle

**Question:** Phase 37 deferred Drizzle `watches.catalogId .notNull()` tightening to Phase 38 (cascades 18 tsc errors + 17 fixture updates). How should it ride in Phase 38?

**Options presented:**
1. Separate plan in Phase 38 (Recommended)
2. Bundled into a single plan
3. Engine rewire first, tightening in a follow-up phase

**Selected:** **Separate plan in Phase 38 (Recommended)**

**Rationale captured:** Plan A = catalogId .notNull() tightening + DAL flow rewrite (createWatch requires catalogId; production call sites upsert catalog BEFORE createWatch; 17 fixture updates). Plan B = CAT-13 engine rewire against the tightened type. Engine rewire ships against a clean type system.

---

### Q4. Composer-engine alignment audit

**Question:** Phase 20 CollectionFitCard composer already reads taste at confidence ≥ 0.5 to emit verbal verdicts. After CAT-13, taste is ALSO in the numeric score. Do we need to adjust the composer?

**Options presented:**
1. No composer changes — verdict + score auto-align (Recommended)
2. Audit composer thresholds and reconcile in this phase
3. Defer to a follow-up phase (e.g., Phase 39 Polish)

**Selected:** **Audit composer thresholds and reconcile in this phase**

**Rationale captured:** After rewire, run a static assertion comparing composer's verdict-tier (Core Fit / Familiar Territory / Role Conflict / Hard Mismatch) against engine's numeric label. Any disagreement is a bug. Adds 1 plan of work; reduces "why does the badge disagree with the copy" risk.

---

## Round 2 — Four follow-up gray areas

### Q5. Taste 0.20 weight internal distribution

**Question:** The 0.20 taste weight covers 7 sub-fields. How should the 0.20 distribute internally?

**Options presented:**
1. Equal split + averaged components (Recommended)
2. Numerics-heavy weighting
3. Defer internal math to researcher

**Selected:** **Equal split + averaged components (Recommended)**

**Rationale captured:** Internal breakdown — numeric trio cosine 0.08 (formality/sportiness/heritage) + archetype categorical 0.04 + era categorical 0.04 + motifs Jaccard 0.04. Each component normalized to 0..1 before inner weight applied. Researcher MAY override internal split if prod taste-data distribution surfaces imbalance, but outer 0.20 weight is LOCKED.

---

### Q6. Plan A commit strategy for 17 fixture updates

**Question:** Plan A tightens `watches.catalogId .notNull()`, which forces createWatch signature change + 17 integration test fixture updates. How should the fixture work be committed?

**Options presented:**
1. One commit per test file family (Recommended)
2. Single atomic fixture commit
3. Per-test atomic commits

**Selected:** **One commit per test file family (Recommended)**

**Rationale captured:** Group fixtures by file family (phase17-*, phase18-*, etc.). Bisectable, reviewable, each commit independently runs `tsc + vitest` clean. Avoids 17 micro-commits (per-test) or a single massive commit that's hard to bisect.

---

### Q7. Composer-engine alignment audit design

**Question:** Where does the audit live and what does it assert?

**Options presented:**
1. Static fixture-based test (Recommended)
2. Static test + runtime dev-mode assertion
3. Static test only, deferred reconciliation

**Selected:** **Static fixture-based test (Recommended)**

**Rationale captured:** New `tests/static/composer-engine-alignment.test.ts` runs ~10 fixture scenarios through BOTH composer (verbal verdict) AND engine (numeric label), asserts the two outputs agree. Covers taste-null, confidence<0.5, confidence≥0.5 cases. No runtime cost.

---

### Q8. `Watch.catalogTaste` type shape

**Question:** What type does downstream code consume?

**Options presented:**
1. Reuse existing `CatalogTasteAttributes` interface (Recommended)
2. New `WatchCatalogTaste` flattened shape
3. Defer shape to researcher

**Selected:** **Reuse existing `CatalogTasteAttributes` interface (Recommended)**

**Rationale captured:** Type already exists in `src/lib/types.ts` lines 214–223 from Phase 19.1. Single source of truth — engine and composer read the same shape.

---

## Decisions → CONTEXT.md mapping

| Q  | CONTEXT.md decision ID(s)       |
|----|----------------------------------|
| Q1 | D-01 (outer 0.20 weight, 0.80 sum for existing 8) |
| Q2 | D-02 (binary gate at 0.5) |
| Q3 | D-06 (Plan A separate; engine rewire = Plan B) |
| Q4 | D-04 (composer-engine alignment static test in Phase 38) |
| Q5 | D-03 (internal 0.20 split: 0.08/0.04/0.04/0.04) |
| Q6 | D-07 (one commit per test file family) |
| Q7 | D-04 + D-15 (test scope: ~10 scenarios, taste-null + confidence<0.5 + confidence≥0.5) |
| Q8 | D-10 (reuse `CatalogTasteAttributes` from src/lib/types.ts lines 214–223) |

## Areas NOT discussed (locked elsewhere — no gray area)

- Test naming (CAT-13 ROADMAP locks `tests/static/similarity.taste-null.test.ts` + `tests/static/similarity.taste-present.test.ts` verbatim)
- Engine output schema (CAT-13 + Phase 20 D-09 lock: `SimilarityResult` + `SimilarityLabel` unchanged)
- DAL JOIN strategy (decided in same flow as Q8 — always JOIN; D-11)
- `extractWithLlm()` byte-lock (Phase 19.1 D-07 carry — D-08 in this phase)

## Deferred ideas captured

- CAT-13 v6.x collaborative-filtering layer → SEED-002
- FIT-05 pairwise drill-down → Phase 39 Polish
- Goal-aware taste weighting → future polish
- Per-archetype motif weighting → future enrichment
- Two-tier gating (0.5/0.7) → revisit if D-04 alignment test surfaces drift
- Lazy/conditional DAL JOIN → v6.x performance pass
- `tasteContribution` field on `SimilarityResult` → out of scope
- Re-enrichment trigger → manual escape hatch only

---

*Discussion duration: ~1 turn-pair (4-question batch × 2 rounds); 8 decisions total; 9 ideas deferred.*

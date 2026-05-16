# Phase 33b: Discovery North-Star Audit - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce a falsifiable, product-framed Rdio north-star audit and commit it as `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md`. The audit consists of (a) a single flat markdown table with one row per `(entity × canonical-drift-vector)` pair across 6 entity blocks (Watch Detail / Collector Profile / Catalog / Home Feed / Explore Feed / Search Results) × 7 canonical drift vectors (similar-by-taste, same-family/lineage, same-era, other-owners, owner-overlap, evaluative-verdict, see-more-like-this) — each cell tagged ship / partial / missing / N-A with leverage (high/med/low/—) on missing AND partial cells — and (b) a final § with explicit YES/NO/DEFERRED resolutions to the 4 D-17 decisions deferred from Phase 33, each citing specific NSV-NN row IDs from this phase AND specific DISC-AUDIT-NN backing rows from Phase 33.

**In scope:** Desk-work product analysis against Phase 33's 136-row click-path table (immutable substrate); per-entity drift-vector enumeration anchored to the SEED-004 Rdio quote; leverage scoring on missing + partial cells; authoring the 4 D-17 verdicts with downstream-phase impact lines. The audit is read-only: zero modifications to `33-DISCOVERY-AUDIT.md`, zero code/schema/dependency/test changes.

**Not in scope:** New surface walks beyond Phase 33's coverage; new DISC-AUDIT-NN row creation; modifying Phase 33's click-path table; introducing additional vectors beyond the locked 7-vector taxonomy; a 5th D-17 decision (ROADMAP §Phase 33b criterion #3 mandates exactly 4); separate per-viewer-state entity blocks (worst-case viewer aggregation per cell); code, schema, dependency, or data changes; new tests or CI changes.

**ROADMAP success criteria fully covered (verbatim from `.planning/ROADMAP.md` §Phase 33b lines 159–169):**
1. Per-entity drift-vector table tagged ship/partial/missing with leverage scoring on missing rows (NSD-13/14/15)
2. Pass/fail criteria pinned at the TOP of the doc before findings appear (NSD-15)
3. Decisions § with YES/NO/DEFERRED for the 4 D-17 questions, each with rationale citing specific north-star findings AND DISC-AUDIT-NN backing rows (NSD-12/16)
4. Every missing-vector row anchored to SEED-004 line 15 quote AND cites ≥1 DISC-AUDIT-NN row (NSD-15 rules 3 + 4)
5. Zero code/schema/dep changes; zero modifications to `33-DISCOVERY-AUDIT.md` (NSD-15 rule 6)

</domain>

<decisions>
## Implementation Decisions

> **Decision IDs:** Phase 33b uses the `NSD-NN` prefix (north-star decision) to distinguish from Phase 33's `D-NN` series. Row IDs in the audit doc itself use the `NSV-NN` prefix (north-star vector) to distinguish from Phase 33's `DISC-AUDIT-NN` rows. Both audit documents coexist; cite one or both as needed.

### Carried forward from Phase 33 (locked — do NOT re-litigate)

- **Phase 33 D-12 — single Rdio rubric:** SEED-004 line 15 quote is the ONLY anchor for missing rows. No alternative anchors permitted. Phase 33b inherits.
- **Phase 33 D-15 — single-file format:** All decisions inline in the audit doc (final §), not a separate decisions file. Phase 33b inherits.
- **Phase 33 D-16 — verdict template:** Verdict + 2–4 sentence rationale + cited rows + downstream-phase impact line. Phase 33b inherits and extends to cite NSV-NN AND DISC-AUDIT-NN rows.
- **Phase 33 D-17 — exactly 4 decisions:** Q1 combine home+explore; Q2 lineage browse priority; Q3 dead-end closure priority; Q4 CAT-13 discovery framing. No 5th catch-all. Phase 33b inherits.
- **Phase 33 audit immutability:** `33-DISCOVERY-AUDIT.md` is the research substrate; Phase 33b reads but does not modify it. Cross-references travel via DISC-AUDIT-NN row ID cites only.

### Drift-vector enumeration method (Area 1)

- **NSD-01:** Hybrid Rdio→DISC-AUDIT method. The candidate drift-vector universe is generated top-down from the SEED-004 Rdio principle (a fixed canonical taxonomy of drift directions a collector might want to follow from any entity). For each (entity × vector) cell, scoring is grounded bottom-up by walking Phase 33's 136 DISC-AUDIT-NN rows to confirm whether the vector ships, is partial, is missing, or is N-A on that entity. Rationale: top-down secures falsifiability against the Rdio anchor (NSD-15 rule 4); bottom-up secures empirical grounding (NSD-15 rule 3); pure-top-down risks theoretical vectors with no audit anchor; pure-bottom-up only finds gaps Phase 33 already saw (the strongest Rdio violations are often invisible in click-path enumeration).

- **NSD-02:** Fixed canonical taxonomy applied uniformly to every entity. The 7 vectors (NSD-07) are defined once at the top of the audit doc and applied to all 6 entity blocks identically. No per-entity bespoke vector lists; no extension mechanism. Rationale: forces coverage falsifiability (a reviewer can verify the 7×6 = 42-cell matrix is complete); surfaces asymmetry directly (e.g., if /watch ships 'same-family' but /catalog doesn't, that gap pops out cleanly); mirrors Phase 33 D-12 single-rubric posture; per-entity bespoke would let vectors silently disappear between entities and defeat cross-entity comparability.

- **NSD-03:** Score every (entity × vector) cell, including obvious N-A. The full 6×7 matrix gets exactly 42 rows. N-A cells exist with rationale (e.g., "search results aren't entity-specific until clicked — same-family is N-A here"). Rationale: forces falsifiability (a reviewer can mechanically verify the 42-cell matrix is complete; mirrors Phase 33 D-13 rule #1 'every surface has ≥1 row' extended); cell count is small enough that exhaustive coverage is cheap; "only plausibly relevant" reintroduces author judgment about relevance that defeats falsifiability.

- **NSD-04:** Strict observable line for partial vs missing. **Partial** = the drift vector is visible to the viewer (name shown, list rendered, label present) but is not clickable — the viewer can SEE the drift direction but cannot ACT on it without leaving the surface (e.g., DISC-AUDIT-82 mostSimilar text-only verdict list; DISC-AUDIT-129 InsightsTabContent SleepingBeauties section with no Link). **Missing** = no surface-level acknowledgment of the drift direction — neither label nor list nor data anchor exists (e.g., DISC-AUDIT-130 catalog page has no affordance to walk to other watches in the same family). Rationale: falsifiable by inspection of Phase 33 rows + production walk; "loose" definitions (e.g., gated/degraded/low-signal as partial) reintroduce subjective judgment that the strict line removes; three-state with separate partial-leverage scoring (NSD-10 makes leverage cover partials anyway) would add complexity without changing prioritization.

### Entity granularity & viewer-state (Area 2)

- **NSD-05:** 6 entity blocks, splitting Home and Explore. Final entity list:
  1. **Watch Detail** — `/watch/{id}` per-user watch detail with verdict
  2. **Collector Profile** — `/u/{user}` profile pages (covers all 7 profile tabs as one entity since the profile is the unit of collector-level discovery)
  3. **Catalog** — `/catalog/{id}` reference detail (folds in the planned `/family/{id}` lineage browse as missing-vector candidates rather than a separate entity, since family doesn't ship yet)
  4. **Home Feed** — `/` (5 sections: WywtRail, CollectorsLikeYou, NetworkActivityFeed, PersonalInsightsGrid, SuggestedCollectors)
  5. **Explore Feed** — `/explore` (ExploreHero + 3 rails: PopularCollectors, TrendingWatches, GainingTractionWatches)
  6. **Search Results** — `/search` (4-tab: All / Watches / People / Collections)

  Rationale: matches ROADMAP §Phase 33b criterion #1 wording (5 entities listed with 'home/explore feeds' as one bucket — explicitly accepting the tradeoff that splitting home from explore mildly pre-judges Q1 framing, on the grounds that two-entity treatment surfaces the home/explore drift-vector overlap directly and gives the user a clearer YES/NO/DEFERRED case to walk through); Header is folded as a click-target affordance into every entity (drives no entity-block of its own); /family/{id} stays as a missing-vector candidate on Catalog rather than a hypothetical entity; the 7 profile tabs are aggregated under Collector Profile because profile-level drift vectors don't depend on which tab is active.

- **NSD-06:** Worst-case viewer-state aggregation per cell. Each (entity × vector) cell tagged ship/partial/missing reflects the WORST viewer state observed in Phase 33's table for that pair. Example: if /watch ships `evaluative-verdict` for owner-populated viewers but suppresses verdict entirely for fresh-account viewers (DISC-AUDIT-131), the cell is `partial` with rationale "viewer-gated — fresh-account suppression branch". Rationale: captures Rdio dead-ends without doubling the table to 84 rows; Phase 33's `viewer_state` column is the evidence anchor that every cell rationale cites; doubled-column or split-block alternatives inflate the table 2× with mostly-redundant content (most cells don't materially diverge between viewer states).

- **NSD-07:** 7-vector canonical taxonomy. The locked drift-direction list applied uniformly to every entity:
  | Vector | One-line definition | PROD or planned anchor |
  |--------|---------------------|------------------------|
  | `similar-by-taste` | walk to watches similar in style/role/taste to this one | `analyzeSimilarity()` (PROD); CAT-13 catalog taste columns post-Phase 38 |
  | `same-family/lineage` | walk to watches in the same family or sharing a lineage edge | CAT-15 brands/families (Phase 34); CAT-16 lineage edges (Phase 35) |
  | `same-era` | walk to watches from the same era / generation | `era_signal` column (Phase 19.1 LLM-derived; CAT-13 reads it post-Phase 38) |
  | `other-owners` | walk to other collectors who own / wishlist this watch | cross-collector graph (PROD via /catalog catalog-page collector list) |
  | `owner-overlap` | walk to overlap with this collector — shared taste / shared collection | common-ground (PROD `/u/{user}/common-ground`) |
  | `evaluative-verdict` | "does this fit my collection" answer for the viewer | Collection Fit verdict (PROD `/watch`, `/catalog`, search inline-expand) |
  | `see-more-like-this` | walk to a paginated rail/feed of more affordances like this one | trending/popular/gaining-traction rails (PROD `/explore`); recommender layer (SEED-002 future) |

  Rationale: covers the canonical Rdio drift directions a watch collector might plausibly want to follow; each vector has a PROD anchor or a v5.0-roadmap planned anchor, avoiding theoretical vectors; the 5-vector tighter set risks under-counting lineage and era leverage; the 9+ vector set adds noise (temporal-recent already captured by NetworkActivityFeed; price-tier-adjacent is v6.0/SEED-005 territory with no v5.0 anchor).

- **NSD-08:** Pinned vector definition table at top of audit doc. The 7-vector taxonomy renders as a definition table BEFORE any entity block, alongside the SEED-004 Rdio quote (NSD-15) and the leverage-bucket key (NSD-11). Forces consistency (a reviewer can confirm each cell scoring matches the pinned definition) and prevents vector-meaning drift across rows. Mirrors Phase 33 D-11 strict-tag-definitions and D-13 pinned-at-top posture.

### Rdio leverage scoring rubric (Area 3)

- **NSD-09:** Single 3-input rubric for high/medium/low leverage scoring. Each scored cell's leverage is a judgment combining: **(1) cited principle violation** — how clearly the cell violates the SEED-004 Rdio quote ('feels lost' / 'dead end' qualifier; explicit cite to Rdio quote required for high/med); **(2) downstream-phase impact** — which v5.0 phase the cell gates if shipped (high = gates Phase 39 polish; medium = post-v5.0 candidate; low = v5.x or skip); **(3) collector-frequency judgment** — how often a single-user collector would plausibly want this drift on this entity (frequent encounter = high; rare/edge = low). Each missing/partial cell's rationale explicitly cites which of the 3 inputs are present. Rationale: 3-input falsifiable judgment without false-precision numerics; mirrors Phase 33 D-16 verdict-template philosophy (rationale + cited backing); pure judgment with no rubric structure produces less-defensible Phase 39 prioritization signal; structured numeric rubrics create illusion of objectivity that the underlying single-user judgment cannot honestly support.

- **NSD-10:** Score leverage on BOTH missing AND partial cells (not just missing). ROADMAP wording says "each missing row scored" but partials are a Rdio-leverage opportunity too — making them clickable is often the cheapest, highest-leverage Phase 39 win (e.g., DISC-AUDIT-82 mostSimilar text→Link is a one-line patch). N-A and ship cells stay unscored (`—` in the leverage column). Rationale: Phase 39 needs prioritization signal on partials too; Phase 33b is the right place to provide it; the audit hands off less prioritization signal than it could if missing-only.

- **NSD-11:** Pinned leverage-bucket key at the top of the audit doc. The 3-bucket definitions render as a key-table alongside the Rdio quote (NSD-15) and the vector definition table (NSD-08). Concrete qualifiers:
  - **high** — gates a v5.0 phase (most often Phase 39 polish, occasionally Phase 35 or Phase 38 scope) AND violates SEED-004 directly AND a single-user collector would frequently encounter the drift opportunity
  - **medium** — gates a v5.x phase OR violates SEED-004 directly OR a collector would frequently encounter the drift, but not all three
  - **low** — none of the above; theoretical Rdio drift the audit captures for completeness but explicitly DEFERRED beyond v5.x
  Rationale: reviewer can mechanically verify scoring; defeats authorial drift across rows; mirrors Phase 33 D-13/D-11 pinned-at-top falsifiability posture.

- **NSD-12:** No hard rule mapping leverage → verdict. Leverage informs the 4 D-17 verdict rationales but does NOT mechanically force a YES/NO/DEFERRED verdict. A high-leverage missing vector can still produce a DEFERRED verdict if the user judges the timing wrong (e.g., Q2 lineage browse: the audit may rate same-family/lineage as high-leverage on Catalog, but Q2 verdict can resolve DEFERRED if Phase 35 ships schema-only and the UI work explicitly belongs in a separate phase). Rationale: preserves authorial judgment that ROADMAP success #3 mandates ('2–4 sentence rationale' implies judgment, not mechanical mapping); mechanical mapping creates forced-YES verdicts that downstream phases re-litigate; soft-rule alternatives add rigidity without proportional benefit.

### Artifact format & decisions wiring (Area 4)

- **NSD-13:** Single flat 7-column drift-vector table. One markdown table covers the full 42-cell matrix (6 entities × 7 vectors). Final column set:
  | Column | Type | Required | Notes |
  |---|---|---|---|
  | `row_id` | NSV-NN | yes | flat sequential per NSD-14 |
  | `entity` | enum | yes | one of the 6 NSD-05 blocks |
  | `vector` | enum | yes | one of the 7 NSD-07 vectors |
  | `status` | enum | yes | `ship` / `partial` / `missing` / `N-A` per NSD-04 |
  | `leverage` | enum | yes | `high` / `med` / `low` / `—` per NSD-11 (`—` for ship and N-A cells) |
  | `rationale` | string | yes | 1–3 sentence cell-scoring rationale; missing rows MUST cite the Rdio quote violation |
  | `backing_rows` | string | yes | DISC-AUDIT-NN refs that anchor this cell's scoring (`—` allowed only for cells where Phase 33 has zero relevant rows; rationale must explain the absence) |

  Rationale: easy to scan; trivial to grep cite from downstream phases (`grep -n "NSV-08\|DISC-AUDIT-130" .planning/phases/`); mirrors Phase 33 D-09/D-10 flat-table posture; per-entity narrative + table doubles authoring overhead and fragments cite syntax; matrix grid leaves rationale and backing rows nowhere to live.

- **NSD-14:** Row ID format `NSV-NN` flat sequential, zero-padded. NSV-01, NSV-02, ..., NSV-42. Mirrors Phase 33's DISC-AUDIT-NN format exactly — consistent grep semantics across both audits. Downstream phases cite `NSV-08, DISC-AUDIT-130` side-by-side cleanly. Surface visibility lives in the `entity` column, not the ID. Rationale: matches Phase 33 D-09 reasoning; per-entity-namespaced IDs make grep brittle and inflate downstream cites; DISC-NS-NN is cosmetic and adds char count without semantic gain.

- **NSD-15:** 6-rule pass/fail criteria pinned at the TOP of the audit doc before any findings appear. The audit passes IFF ALL 6 rules hold (mechanically verifiable):
  1. Every entity in the 6-block scope (NSD-05) has rows in the table covering all 7 vectors (NSD-07) — exactly 42 cells, no skipped (entity × vector) pairs.
  2. Every missing AND partial cell carries a leverage tag (high/medium/low) per NSD-10 and NSD-11.
  3. Every missing AND partial cell cites ≥1 DISC-AUDIT-NN backing row from Phase 33 in the `backing_rows` column (— allowed only with explicit rationale for the absence).
  4. Every missing cell's `rationale` cites the SEED-004 line 15 Rdio quote violation explicitly (`Rdio violation: …` or `SEED-004: …` syntax).
  5. All 4 D-17 decisions in the final § have explicit YES/NO/DEFERRED resolution with 2–4 sentence rationale citing ≥1 NSV-NN row AND ≥1 DISC-AUDIT-NN backing row + a downstream-phase impact line.
  6. Zero code/schema/dependency changes ship; zero modifications to `33-DISCOVERY-AUDIT.md` (verified by `git diff 33-DISCOVERY-AUDIT.md` returning empty).
  Rationale: falsifiable; reviewer can re-walk literally against the table; mirrors Phase 33 D-13's 5-rule structure extended to cover Phase 33b's specific deliverables (cell completeness + leverage on partials + backing-row cites + audit immutability).

- **NSD-16:** Final § with all 4 D-17 decisions sequenced Q1→Q4. Decisions live in a single `## Decisions` § AFTER the drift-vector table. Each verdict uses the Phase 33 D-16 template extended with NSV-NN cites. Per-decision shape:
  ```markdown
  ### Decision Q1: Combine home and explore?
  **Verdict:** YES | NO | DEFERRED
  **Rationale:** [2–4 sentences citing audit findings]
  **Cited NSV rows:** NSV-NN, NSV-MM, ...
  **Backing DISC-AUDIT rows:** DISC-AUDIT-NN, DISC-AUDIT-MM, ...
  **Drives:** [downstream phase / item this verdict gates]
  ```
  4 decisions Q1→Q4 in the order ROADMAP §Phase 33b criterion #3 lists them: Q1 combine home+explore; Q2 lineage browse priority; Q3 dead-end closure priority; Q4 CAT-13 discovery framing. No 5th catch-all (Phase 33 D-17 inherited). Rationale: single read for downstream phases; mirrors Phase 33 D-15/D-16 single-final-§ posture; interleaved-per-entity wiring doubles authoring and fragments downstream reads; verdicts-before-table inverts empirical grounding (Phase 33 explicitly chose table-then-decisions for this reason).

### Claude's Discretion

User selected the recommended option on every question across all 4 areas. No areas were left for Claude's free discretion; all decisions NSD-01 through NSD-16 are user-confirmed selections among presented options.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v5.0 milestone framing
- `.planning/ROADMAP.md` §"Phase 33b: Discovery North-Star Audit" lines 159–169 — phase goal + 5 success criteria. Source of all "MUST" wording.
- `.planning/REQUIREMENTS.md` §DISC-12 line 21 — full requirement text; the 4 D-17 verdicts handoff from DISC-10.
- `.planning/REQUIREMENTS.md` §DISC-10 line 19 (2026-05-08 update note) — DISC-10 verdicts deferred to DISC-12; Phase 33's table is the immutable research substrate.
- `.planning/STATE.md` §"Key Decisions (v5.0)" lines 67–73 — Phase 33b insertion rationale (2026-05-08); Phase 34/35/38/39 dependency upgraded from Phase 33 → Phase 33b.
- `.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15 — **the Rdio principle quote** that anchors every missing-row rationale (per NSD-15 rule 4 inheriting Phase 33 D-12).
- `.planning/seeds/SEED-004-v5-discovery-north-star.md` lines 16–22 — audit-first scoping; lists the 5 ROADMAP entities verbatim that NSD-05 splits into 6.
- `.planning/seeds/SEED-006-premium-features-audit.md` — confirms no paid-vs-free forks (no paywall in v5.0; SEED-006 RESOLVED 2026-05-06).

### Phase 33 substrate (immutable; cite by row ID only)
- `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` — the 136-row click-path table; the research substrate. Phase 33b reads but DOES NOT modify (NSD-15 rule 6).
- `.planning/phases/33-discovery-audit/33-CONTEXT.md` — Phase 33 D-01..D-17 user-confirmed decisions; D-12 (single Rdio rubric), D-15 (single-file format), D-16 (verdict template), D-17 (exactly 4 decisions) are inherited locks.
- `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` §"Decisions" (lines 174–202) — Pass D explanation that defers Q1–Q4 verdicts to Phase 33b; backing data samples per decision.
- `.planning/phases/33-discovery-audit/33-RESEARCH.md` §"Conditional Rendering Map" — G-1..G-20 runtime gates; underpins NSD-06 worst-case viewer-state aggregation.

### Vector PROD anchors (per NSD-07)
- `src/lib/similarity.ts` — `analyzeSimilarity()`; current `similar-by-taste` engine (pre-CAT-13 rewire).
- `src/lib/taste/` — Phase 19.1 LLM-derived taste service; underpins post-CAT-13 `similar-by-taste` and `same-era` vectors.
- `src/components/insights/CollectionFitCard.tsx` — verdict surface; `evaluative-verdict` PROD anchor on `/watch` and `/catalog`.
- `src/components/profile/CommonGroundTabContent.tsx` — `owner-overlap` PROD anchor on `/u/{user}/common-ground`.
- `src/components/explore/{PopularCollectors,TrendingWatches,GainingTractionWatches}.tsx` — `see-more-like-this` PROD anchors on `/explore`.

### Vector planned anchors (downstream phases)
- `.planning/ROADMAP.md` §"Phase 34: Layer A — Brand + Family Entities" lines 171–181 — `same-family/lineage` planned anchor (CAT-15 brands + watch_families tables).
- `.planning/ROADMAP.md` §"Phase 35: Layer B — Lineage Edges + Structured Movement + Era/Material" lines 183–193 — `same-family/lineage` lineage edges (CAT-16); `same-era` `era_signal` column.
- `.planning/ROADMAP.md` §"Phase 38: CAT-13 Engine Rewire" lines 220–230 — `evaluative-verdict` post-rewire reads catalog taste columns; `similar-by-taste` post-Phase-38 sources from `watches_catalog`.
- `.planning/seeds/SEED-002-hybrid-recommender.md` — future paid-candidate recommender layer; `see-more-like-this` post-v5.0 evolution.

### Downstream phases that consume 33b-DISCOVERY-NORTH-STAR-AUDIT.md
- `.planning/ROADMAP.md` §"Phase 34: Layer A" line 173 — depends on Phase 33b NOT revealing scope-reducing findings before migration work begins.
- `.planning/ROADMAP.md` §"Phase 35: Layer B" — lineage browse UI scope is audit-conditional on NSD-12 / Q2 verdict per `STATE.md` line 78.
- `.planning/ROADMAP.md` §"Phase 38: CAT-13 Engine Rewire" — Q4 verdict (CAT-13 discovery framing) shapes Phase 38 plans' motivation framing per `STATE.md` line 79.
- `.planning/ROADMAP.md` §"Phase 39: Audit-Driven Discovery Polish" lines 232–242 — closes specific NSV-NN AND DISC-AUDIT-NN rows; scope is fully audit-conditional on Phase 33b verdicts per success criterion #5.

### Feedback memory anchors
- `.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/feedback_ui_spec_css_chain_blind_spot.md` — v4.1 lesson informing rigor on falsifiability rules (NSD-15 rule 1 / cell-completeness verification mirrors the "assert the chain explicitly" lesson).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **No code is reused** — Phase 33b produces a markdown artifact, not code. The "reusable" inputs are Phase 33's deliverables (33-DISCOVERY-AUDIT.md table + 33-CONTEXT.md decisions) plus the SEED-004 Rdio quote.
- **Pattern for cell `backing_rows` column:** copy DISC-AUDIT-NN row IDs verbatim from `33-DISCOVERY-AUDIT.md`. No row-content duplication; downstream readers cross-read both audits.

### Established Patterns
- **Audit-only scope discipline:** `33-CONTEXT.md` D-05 already enumerated Phase 33's in-scope vs out-of-scope surfaces; Phase 33b inherits that scope wholesale via the DISC-AUDIT-NN backing-row dependency. No new surface walks.
- **Conditional rendering gates that informed Phase 33's `viewer_state` column** (G-1..G-20 from `33-RESEARCH.md`) underpin Phase 33b's worst-case viewer-state aggregation per NSD-06. Cell rationale that cites viewer-gating MUST cite the relevant DISC-AUDIT-NN row whose viewer_state column carries the evidence.
- **Verdict template inheritance:** Phase 33 D-16 verdict template + Phase 33b NSD-16 extension (add NSV-NN cites alongside DISC-AUDIT-NN cites) is the locked verdict shape.

### Integration Points
- **Output integration:** `33b-DISCOVERY-NORTH-STAR-AUDIT.md` is read by Phase 34 (dependency-gating verdict), Phase 35 (lineage browse UI scope from Q2), Phase 38 (CAT-13 framing from Q4), and Phase 39 (full polish scope ordering from Q3 + leverage-tagged missing/partial rows). Each downstream plan's success criteria will cite specific NSV-NN row IDs AND/OR a Q1–Q4 verdict.
- **STATE.md update:** After Phase 33b ships, STATE.md "Key Decisions (v5.0)" gains entries for the 4 verdicts (Q1–Q4 resolutions) — replaces the current "deferred to Phase 33b" placeholder.
- **No code integration:** Zero changes to `src/`, `tests/`, `db/`, `package.json`, `next.config.ts`, `tsconfig.json`, or any config file. The phase commits only into `.planning/phases/33b-discovery-north-star-audit/`.
- **Optional checks/ parallel:** Phase 33 has `checks/full.sh` + `checks/quick.sh` for mechanical pass/fail enforcement. Phase 33b NSD-15 rules are mechanically verifiable (cell count, leverage tag presence, DISC-AUDIT-NN cite presence, SEED-004 cite presence, decision count, audit immutability). A parallel `checks/` directory is a planning-time decision (not locked here).

</code_context>

<specifics>
## Specific Ideas

- **Cell-scoring recipe (NSD-01 hybrid method) — start with the 8 Missing rows from Phase 33:**
  - DISC-AUDIT-97 → Collector Profile × `see-more-like-this` (locked-tab no-CTA → no walk-back to discovery)
  - DISC-AUDIT-102 → Collector Profile × `see-more-like-this` (wishlist locked, no Connect CTA)
  - DISC-AUDIT-111 → Collector Profile × `see-more-like-this` (worn calendar day-cell no onClick)
  - DISC-AUDIT-122 → Collector Profile × `see-more-like-this` (notes locked, no Connect CTA)
  - DISC-AUDIT-123 → Collector Profile × `see-more-like-this` (stats rows non-clickable)
  - DISC-AUDIT-124 → Collector Profile × `see-more-like-this` (stats locked, no Connect CTA)
  - DISC-AUDIT-127 → Collector Profile × `see-more-like-this` (common-ground 404 fallback no walk-back)
  - DISC-AUDIT-129 → Collector Profile × `similar-by-taste` (insights cards no Link)
  - DISC-AUDIT-130 → Catalog × `same-family/lineage` (no walk-to-family affordance — Q2 anchor)
  - DISC-AUDIT-131 → Watch Detail × `evaluative-verdict` (verdict suppressed for fresh-account)
  - Each anchors a cell's `backing_rows`; the `rationale` adds the SEED-004 quote violation.

- **Cell-scoring recipe (NSD-01) — use Phase 33's Live rows to confirm `ship` cells:**
  - DISC-AUDIT-29 (CollectorsLikeYou RecommendationCard Link) → Home Feed × `similar-by-taste` (ship)
  - DISC-AUDIT-49 (PopularCollectorRow whole-row Link) → Explore Feed × `other-owners` (ship)
  - DISC-AUDIT-81 (WatchDetail Verdict Badge) → Watch Detail × `evaluative-verdict` (partial — viewer-gated per NSD-06; cites DISC-AUDIT-131 worst-case)
  - DISC-AUDIT-82 (mostSimilar text-only) → Watch Detail × `similar-by-taste` (partial — visible but not clickable per NSD-04)
  - DISC-AUDIT-99 (wishlist drag silent no-op) → Collector Profile × `see-more-like-this` (note: WR-07 Dead row in Phase 33; Phase 33b cell scoring may treat as `partial` since the affordance is wired but broken — judgment call for the audit author)

- **Per-decision rationale anchor sketches (per NSD-16):**
  - **Q1 combine home+explore:** Compare Home Feed × {7 vectors} vs Explore Feed × {7 vectors}. If overlap is high (e.g., both ship `see-more-like-this` and `other-owners`), that argues YES. If they ship complementary vectors (Home: `similar-by-taste` + `evaluative-verdict`; Explore: `other-owners` + raw popularity), that argues NO.
  - **Q2 lineage browse priority:** Hinges on Catalog × `same-family/lineage` and Watch Detail × `same-family/lineage` leverage. High on both → YES (ship browse UI in Phase 35). High on Catalog only → DEFERRED (schema in Phase 35, UI in Phase 39 or v5.x).
  - **Q3 dead-end closure priority:** Aggregate the high-leverage missing + partial rows; identify the Top-N by leverage for Phase 39 ordering. The audit hands Phase 39 a sorted list, not a list of every closure (low-leverage rows DEFERRED to v5.x).
  - **Q4 CAT-13 discovery framing:** Hinges on Watch Detail + Catalog × `evaluative-verdict` and `similar-by-taste` leverage. High on both = "discovery improvement" framing for Phase 38. Low/mixed = "tech debt" framing acceptable.

- **Mechanical pass/fail check recipe (NSD-15 rule 6):**
  ```bash
  # Audit immutability
  git diff .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md  # MUST be empty
  # Cell completeness — count NSV-NN rows
  grep -c "^| NSV-" .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md  # MUST be 42
  # Leverage on missing+partial — count rows with status=missing OR status=partial that lack a high|med|low leverage tag
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Per-viewer-state separate entity blocks** — discussed and dropped per NSD-06 (worst-case aggregation per cell). If v5.x requires fine-grained fresh-account audit findings (e.g., onboarding cold-start work per SEED-003), revisit by promoting fresh-account to its own block then.
- **`/family/{id}` as its own entity block** — folded into Catalog as missing-vector candidates per NSD-05 (family doesn't ship in v5.0). If Phase 35 ships the lineage browse UI inline (Q2 verdict = YES), promote `/family/{id}` to its own entity in any v5.x re-audit.
- **9+ vector taxonomy (temporal-recent + price-tier-adjacent)** — dropped per NSD-07. price-tier-adjacent is v6.0/SEED-005 territory; revisit with v6.0 audit when market-value pricing API ships. temporal-recent largely captured under `see-more-like-this` and NetworkActivityFeed today.
- **5th catch-all D-17 decision** — Phase 33 D-17 explicitly capped at 4; Phase 33b NSD-16 inherits. If Phase 33b discovers cross-phase scope-change implications, those flow through NSV-NN row leverage scores rather than a 5th decision.
- **Numeric leverage rubric (frequency × severity × alignment)** — discussed and dropped per NSD-09 (single 3-input qualitative rubric). Could be added in a v5.x audit-methodology refinement if reviewers find qualitative scoring insufficient.
- **Hard rule mapping leverage → verdict** — discussed and dropped per NSD-12 (no hard rule). Soft-rule alternative (high-leverage required for any YES; DEFERRED requires explicit rationale citing why high-leverage isn't sufficient) is a v5.x methodology refinement candidate if downstream phases struggle to act on Phase 33b verdicts.
- **Interleaved decisions per entity (decisions wired into entity blocks rather than final §)** — dropped per NSD-16 (final § with all 4 decisions sequenced Q1→Q4). Could be re-evaluated for any v6.0 audit if entity-block density grows beyond 6.
- **`checks/full.sh` + `checks/quick.sh` parallel to Phase 33** — left as a planning-time decision; not locked in this CONTEXT. NSD-15 rules are mechanically verifiable, so a checks/ directory is reasonable to add during planning but does not change the audit's content.
- **Score `ship` cells for leverage too** — dropped per NSD-10 (missing + partial only). If a v5.x regression-prevention concern emerges (e.g., "high-leverage existing affordances at risk during Phase 36 clean-slate wipe"), revisit then.

</deferred>

---

*Phase: 33b-discovery-north-star-audit*
*Context gathered: 2026-05-08*

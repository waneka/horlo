# Phase 33b: Discovery North-Star Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 33b-discovery-north-star-audit
**Areas discussed:** Drift-vector enumeration method, Entity granularity & viewer-state, Rdio leverage scoring rubric, Artifact format & decisions wiring

---

## Drift-vector enumeration method

### Q: Where does the universe of candidate drift vectors come from for each entity?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: Rdio universe → DISC-AUDIT row check | Top-down canonical drift directions from SEED-004 + bottom-up grounding via Phase 33's 136 DISC-AUDIT-NN rows | ✓ |
| Top-down only from SEED-004 Rdio | Pure-principle derivation; risks theoretical vectors without audit anchor | |
| Bottom-up only from DISC-AUDIT Missing rows | Phase 33's 8 Missing + 1 Dead rows as the universe; misses invisible Rdio violations | |

**User's choice:** Hybrid (recommended).
**Notes:** None — recommended option taken.

### Q: Should the drift-direction list be a fixed canonical taxonomy applied to every entity, or per-entity bespoke?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed canonical taxonomy applied uniformly | Define vectors once at top; apply to all 6 entities; forces consistent coverage | ✓ |
| Per-entity bespoke vector lists | Tailored per entity; lets vectors silently disappear; less falsifiable | |
| Hybrid: small canonical core + per-entity extensions | 3-4 universal + per-entity-specific; neither rigorous nor flexible | |

**User's choice:** Fixed canonical taxonomy (recommended).

### Q: Should every entity be scored against every canonical drift vector, even when obviously N/A?

| Option | Description | Selected |
|--------|-------------|----------|
| Every entity × every vector — N/A is an explicit cell | Forces falsifiability; full 6×7=42 cell matrix | ✓ |
| Only vectors plausibly relevant per entity | Skip obvious N-A; reintroduces author judgment | |
| Every-×-every with N/A rows hidden in an appendix | Two-region maintenance; overkill for 42 cells | |

**User's choice:** Every-×-every (recommended).

### Q: Where's the line between 'partial' and 'missing'?

| Option | Description | Selected |
|--------|-------------|----------|
| Partial = vector visible but not clickable; Missing = vector absent entirely | Strict observable line | ✓ |
| Partial = vector exists but degraded (low signal, gated, hidden); Missing = no surface-level acknowledgment | Looser; harder to score consistently | |
| Three-state: ship / partial / missing where partial requires a follow-on partial-leverage score | Adds complexity; overkill | |

**User's choice:** Strict observable line (recommended).

---

## Entity granularity & viewer-state

### Q: How many entity blocks should the audit have, and how do they map to the 5 ROADMAP entities?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 entities, ROADMAP-literal | Watch Detail / Collector Profile / Catalog / Home+Explore Feeds combined / Search Results | |
| 6 entities, split home vs explore | Treat Home and Explore as separate entities to surface their drift-vector overlap | ✓ |
| 6 entities, split catalog vs family | Catalog vs Family separated; risks treating non-existent Family as its own entity | |
| 7 entities: split BOTH home/explore AND catalog/family | Maximum granularity; pre-judges Q1 + Q2 | |

**User's choice:** 6 entities, split home vs explore.
**Notes:** Accepts the mild Q1 pre-judging trade-off because two-entity treatment surfaces home/explore overlap directly and gives a clearer YES/NO/DEFERRED case to walk through.

### Q: How should viewer state (owner-populated vs fresh-account) factor into the drift-vector scoring?

| Option | Description | Selected |
|--------|-------------|----------|
| Score per (entity × vector) using the worst-case viewer state observed | Captures Rdio dead-ends without doubling the table; Phase 33's viewer_state column is evidence anchor | ✓ |
| Two columns per cell: owner-populated tag + fresh-account tag | Doubles density for ~5-8 cells of genuine divergence | |
| Separate owner-populated and fresh-account entity blocks | 12 blocks total; 2× redundant content | |

**User's choice:** Worst-case aggregation (recommended).

### Q: What's the canonical drift-vector taxonomy to apply to every entity?

| Option | Description | Selected |
|--------|-------------|----------|
| 7 vectors: similar-by-taste, same-family/lineage, same-era, other-owners, owner-overlap, evaluative-verdict, see-more-like-this | Each has PROD or v5.0-roadmap planned anchor | ✓ |
| 5 vectors: similar-by-taste, same-family, other-owners, evaluative-verdict, see-more-like-this | Tighter; under-counts lineage and era | |
| 9+ vectors (7 + temporal-recent + price-tier-adjacent) | Adds noise; price-tier is v6.0/SEED-005 territory | |

**User's choice:** 7 vectors (recommended).

### Q: Should each drift vector have a one-line definition pinned at the top of the audit doc?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — pinned definition table at top, before any per-entity block | Forces falsifiability; mirrors Phase 33 D-11 | ✓ |
| Yes, but inline at first use per entity | Less repetitive but harder to verify consistency | |
| No — vector names are self-explanatory; just cite SEED-004 | Defeats falsifiability | |

**User's choice:** Pinned definition table (recommended).

---

## Rdio leverage scoring rubric

### Q: How is Rdio leverage (high/medium/low) scored on each missing-vector row?

| Option | Description | Selected |
|--------|-------------|----------|
| Single rubric: principle violation + downstream-phase impact + collector-frequency judgment | 3-input falsifiable judgment; mirrors D-16 | ✓ |
| Pure judgment with rationale, no rubric structure | Fast but less defensible | |
| Structured numeric rubric (frequency × severity × alignment 1-5; sum to bucket) | False precision; v5.0 single-user posture argues against | |

**User's choice:** Single 3-input rubric (recommended).

### Q: Is leverage scored ONLY on missing vectors, or also on partial vectors?

| Option | Description | Selected |
|--------|-------------|----------|
| Score leverage on BOTH missing AND partial vectors | Partials are often cheapest, highest-leverage Phase 39 wins | ✓ |
| Missing only, per ROADMAP wording | Strict ROADMAP compliance; less prioritization signal handed off | |
| Score leverage on missing, partial, AND ship | Inflates table; ship rows mostly score high anyway | |

**User's choice:** Both missing AND partial (recommended).

### Q: Should the leverage rubric pin explicit qualifiers at the top of the audit doc?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — pin a leverage-bucket key at the top alongside the Rdio quote and vector definitions | Reviewer mechanical verification | ✓ |
| Yes, but defined inline at first use | Less verbose but rubric drift risk | |
| No — high/medium/low labels are self-explanatory | Defeats falsifiability | |

**User's choice:** Pinned leverage-bucket key (recommended).

### Q: Should there be a hard rule mapping leverage → verdict?

| Option | Description | Selected |
|--------|-------------|----------|
| No hard rule — leverage informs verdict rationale; verdict still allows judgment | Preserves authorial judgment that ROADMAP success #3 mandates | ✓ |
| Hard rule: high → YES; medium → DEFERRED; low → NO | Mechanical mapping; removes product-framing power | |
| Soft rule: high-leverage backing required for any YES; DEFERRED requires rationale | Compromise; slightly more rigid | |

**User's choice:** No hard rule (recommended).

---

## Artifact format & decisions wiring

### Q: What's the shape of the drift-vector table?

| Option | Description | Selected |
|--------|-------------|----------|
| Single flat table: row per (entity × vector), 7 columns | ~42 rows; easy to grep cite; mirrors Phase 33 D-09/D-10 | ✓ |
| Per-entity narrative section + summary table at top | Richer per-entity context; doubles authoring | |
| Matrix grid: entities as rows, vectors as columns | Compact 6×7 grid; needs parallel detail table | |

**User's choice:** Single flat 7-column table (recommended).

### Q: What row-ID format for north-star vector rows?

| Option | Description | Selected |
|--------|-------------|----------|
| NSV-NN flat sequential, zero-padded | Mirrors Phase 33 DISC-AUDIT-NN; consistent grep semantics | ✓ |
| DISC-NS-NN (north-star namespaced) | Cosmetic; longer cite | |
| NSV-{Entity}-NN (per-entity namespaced) | Brittle grep; bloated cites | |

**User's choice:** NSV-NN flat sequential (recommended).

### Q: What pass/fail criteria pin at the TOP of the audit doc?

| Option | Description | Selected |
|--------|-------------|----------|
| 6-rule pinned set | Cell completeness + leverage on partials + DISC-AUDIT-NN cites + SEED-004 cite + 4 decisions + audit immutability | ✓ |
| 5-rule set (drop cell-completeness) | Looser; can't mechanically verify 7×6 matrix is complete | |
| 5-rule set (drop SEED-004 quote citation rule) | Trades anchoring rigor for authoring speed | |

**User's choice:** 6-rule pinned set (recommended).

### Q: How are the 4 D-17 decisions wired into the doc?

| Option | Description | Selected |
|--------|-------------|----------|
| Final § with all 4 decisions sequenced Q1→Q4 | Single read for downstream phases; mirrors Phase 33 D-15/D-16 | ✓ |
| Interleaved per relevant entity + summary final § | Doubles authoring; fragments cite syntax | |
| Standalone § before the table, with the table as supporting evidence | Inverts empirical-grounding posture | |

**User's choice:** Final § Q1→Q4 (recommended).

---

## Claude's Discretion

User selected the recommended option on every question across all 4 areas. No areas were left for Claude's free discretion; all decisions NSD-01 through NSD-16 are user-confirmed selections among presented options.

## Deferred Ideas

- Per-viewer-state separate entity blocks — folded into worst-case aggregation per NSD-06; revisit if v5.x onboarding cold-start work needs fresh-account fine-grain.
- `/family/{id}` as its own entity block — folded into Catalog as missing-vector candidates; promote in v5.x re-audit if Phase 35 ships browse UI.
- 9+ vector taxonomy (temporal-recent + price-tier-adjacent) — dropped; price-tier is v6.0/SEED-005 territory.
- 5th catch-all D-17 decision — capped at 4 (inherited from Phase 33 D-17).
- Numeric leverage rubric (frequency × severity × alignment) — dropped; v5.x methodology refinement candidate.
- Hard rule mapping leverage → verdict — dropped; soft-rule alternative is a v5.x candidate if downstream phases struggle to act.
- Interleaved decisions per entity — dropped; revisit for v6.0 audit if entity-block density grows.
- `checks/full.sh` + `checks/quick.sh` parallel to Phase 33 — left as planning-time decision; NSD-15 rules are mechanically verifiable.
- Score `ship` cells for leverage — dropped; revisit if v5.x regression-prevention concern emerges.

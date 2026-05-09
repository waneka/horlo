---
phase: 33b
plan: 02
type: execute
wave: 1
depends_on: ["33b-01"]
files_modified:
  - .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
autonomous: true
requirements: [DISC-12]
tags: [audit, documentation, discovery, cells, nsd-01, nsd-02, nsd-03, nsd-04, nsd-05, nsd-06, nsd-07, nsd-09, nsd-10, nsd-13, nsd-14]

must_haves:
  truths:
    - "All 42 NSV-NN rows (NSV-01..NSV-42) populated in the Drift-Vector Audit table — exactly 6 entities × 7 vectors per NSD-03; no skipped (entity × vector) pairs per NSD-15 rule 1"
    - "Authoring order locked: entity-block × vector — Watch Detail (NSV-01..07), Collector Profile (NSV-08..14), Catalog (NSV-15..21), Home Feed (NSV-22..28), Explore Feed (NSV-29..35), Search Results (NSV-36..42); within each block, vector order is similar-by-taste, same-family/lineage, same-era, other-owners, owner-overlap, evaluative-verdict, see-more-like-this per NSD-07 (NSD-14 sequencing)"
    - "Skeleton sentinel `<!-- skeleton -->` removed from the Drift-Vector Audit § as part of the first row commit"
    - "Status assignment per NSD-04 strict line: partial = visible-but-not-clickable; missing = no surface-level acknowledgment; ship = clickable affordance present; N-A = vector inapplicable to entity (with rationale)"
    - "Worst-case viewer-state aggregation per NSD-06: cells diverging between owner-populated and fresh-account viewers tagged with the WORST status observed in Phase 33's table; Watch Detail / Catalog / Collector Profile cells cross-checked against fresh-account counterpart rows DISC-AUDIT-130..136"
    - "Every missing OR partial cell has a leverage tag in {high, med, low} per NSD-10 + NSD-11; ship and N-A cells use `—` per NSD-11"
    - "Every missing OR partial cell cites ≥1 DISC-AUDIT-NN row in the backing_rows column that EXISTS in Phase 33's table per NSD-15 rule 3 (full.sh Rule 3 ENHANCED enforces existence); `—` allowed only when rationale explicitly explains the absence"
    - "Every missing cell's rationale cites the SEED-004 line 15 Rdio violation explicitly (using `Rdio violation:` or `SEED-004:` syntax) per NSD-15 rule 4"
    - "Pre-anchored cells (per CONTEXT.md `<specifics>` lines 200-219 + RESEARCH § Cell-Population Pre-Computation) populated as: Watch Detail × similar-by-taste = partial high (DISC-AUDIT-82); Watch Detail × evaluative-verdict = partial high (DISC-AUDIT-81 + DISC-AUDIT-131 worst-case per NSD-06); Catalog × same-family/lineage = missing high (DISC-AUDIT-130); Collector Profile × similar-by-taste = missing high (DISC-AUDIT-129); Collector Profile × see-more-like-this = missing (clustered DISC-AUDIT-97/102/111/122/123/124/127/99); Home Feed × similar-by-taste = ship (DISC-AUDIT-29); Explore Feed × other-owners = ship (DISC-AUDIT-49)"
    - "Per-entity-block commit cadence (6 commits inside Wave 1) bounds crash-recovery scope; each commit leaves quick.sh passing"
    - "Implements decisions: NSD-01 (hybrid Rdio→DISC-AUDIT method), NSD-02 (fixed canonical taxonomy uniformly applied), NSD-03 (every cell scored including N-A), NSD-04 (strict partial/missing line), NSD-05 (6 entity blocks), NSD-06 (worst-case viewer-state aggregation), NSD-07 (7-vector taxonomy), NSD-09 (3-input leverage rubric — cell rationale must cite which inputs are present), NSD-10 (score leverage on missing AND partial; ship + N-A unscored), NSD-13 (7-column flat table), NSD-14 (NSV-01..NSV-42 sequential)"
    - "Inherits Phase 33 D-12 single Rdio rubric (no alternative anchors) and Phase 33 audit immutability (no modification of 33-DISCOVERY-AUDIT.md)"
    - "Zero files modified outside .planning/phases/33b-discovery-north-star-audit/"
  artifacts:
    - path: ".planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md"
      provides: "Populated drift-vector audit table with 42 NSV-NN cells; rules 1-4 of NSD-15 satisfied"
      contains: "| NSV-01 |"
      contains_2: "| NSV-42 |"
  key_links:
    - from: "Drift-Vector Audit § rows"
      to: "33-DISCOVERY-AUDIT.md DISC-AUDIT-NN rows (immutable Phase 33 substrate)"
      via: "backing_rows column citing DISC-AUDIT-NN ids"
      pattern: "DISC-AUDIT-[0-9]+"
    - from: "missing-cell rationales"
      to: "SEED-004 line 15 Rdio quote"
      via: "explicit `Rdio violation:` or `SEED-004:` cite per NSD-15 rule 4"
      pattern: "Rdio violation:|SEED-004"
    - from: "every cited DISC-AUDIT-NN id (Rule 3 ENHANCED)"
      to: "actual row in 33-DISCOVERY-AUDIT.md table"
      via: "full.sh grep verification — citation-tier integrity"
      pattern: "grep -qE.*\\| \\$\\{id\\} \\|.*PHASE_33_AUDIT"
---

<objective>
Populate the 42-cell drift-vector audit matrix in the Plan 01 skeleton. Author the rows in entity-block × vector order (Watch Detail → Collector Profile → Catalog → Home Feed → Explore Feed → Search Results, 7 cells each), applying the NSD-01 hybrid Rdio→DISC-AUDIT method: top-down canonical taxonomy from NSD-07 secures coverage falsifiability; bottom-up grounding via Phase 33's 136 DISC-AUDIT-NN rows secures empirical anchor.

Apply the **3-pass authoring sequence** within each entity block to defeat author drift across 42 cells (Pitfall #1):
- **Pass 1: Status assignment** — apply NSD-04 strict partial/missing line + NSD-06 worst-case viewer-state aggregation
- **Pass 2: Backing-row citation** — populate `backing_rows` column with DISC-AUDIT-NN ids verified against Phase 33's table
- **Pass 3: Rationale + leverage** — write 1-3 sentence rationale per cell; for missing cells cite SEED-004 line 15; for missing/partial cells assign leverage per NSD-09 3-input rubric (citing which of the 3 inputs are present)

Purpose: produce the empirical content backbone that Wave 2 (Plan 03) verdicts cite. By the end of this plan, NSD-15 rules 1-4 must pass mechanically (`bash checks/full.sh` post-sentinel-removal); rules 5-6 are Wave 2's job (rule 5 = decisions; rule 6 = Phase 33 immutability already passing from Plan 01).

Output: 42 populated rows in the existing Drift-Vector Audit § of `33b-DISCOVERY-NORTH-STAR-AUDIT.md`. Skeleton sentinel removed. Zero changes to any other file.

**Critical sequencing:** Author by entity-block, NOT by vector. Per RESEARCH § Anti-Patterns: per-vector authoring order ("fill all 6 cells of similar-by-taste first") breaks voice consistency within an entity. Per-entity authoring keeps the 7 cells of a single entity in synchronized voice; cross-entity asymmetry then surfaces naturally when reading the table top-to-bottom.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/33b-discovery-north-star-audit/33b-CONTEXT.md
@.planning/phases/33b-discovery-north-star-audit/33b-RESEARCH.md
@.planning/phases/33b-discovery-north-star-audit/33b-VALIDATION.md
@.planning/phases/33b-discovery-north-star-audit/33b-01-SUMMARY.md
@.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
@.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
@.planning/phases/33-discovery-audit/33-CONTEXT.md
@.planning/seeds/SEED-004-v5-discovery-north-star.md

<interfaces>
<!-- NSD-13 column order (7 columns, exact, locked by Plan 01 skeleton): -->
<!--   row_id | entity | vector | status | leverage | rationale | backing_rows -->

<!-- NSD-14 row id format and assignment: NSV-NN flat sequential 01..42, zero-padded -->
<!--   NSV-01..NSV-07 → Watch Detail × {7 vectors in NSD-07 order} -->
<!--   NSV-08..NSV-14 → Collector Profile × {7 vectors in NSD-07 order} -->
<!--   NSV-15..NSV-21 → Catalog × {7 vectors in NSD-07 order} -->
<!--   NSV-22..NSV-28 → Home Feed × {7 vectors in NSD-07 order} -->
<!--   NSV-29..NSV-35 → Explore Feed × {7 vectors in NSD-07 order} -->
<!--   NSV-36..NSV-42 → Search Results × {7 vectors in NSD-07 order} -->

<!-- NSD-07 vector order (locked, applied uniformly to every entity block): -->
<!--   1. similar-by-taste -->
<!--   2. same-family/lineage -->
<!--   3. same-era -->
<!--   4. other-owners -->
<!--   5. owner-overlap -->
<!--   6. evaluative-verdict -->
<!--   7. see-more-like-this -->

<!-- NSD-04 status enum (exact, lowercase): ship | partial | missing | N-A -->
<!--   partial = visible but not clickable (viewer can SEE drift, cannot ACT) -->
<!--   missing = no surface-level acknowledgment (no label, no list, no data anchor) -->
<!--   ship = clickable affordance present and functional -->
<!--   N-A = vector inapplicable to this entity; rationale must explain why -->

<!-- NSD-11 leverage enum (exact, lowercase): high | med | low | — -->
<!--   high = gates v5.0 phase AND violates SEED-004 directly AND collector frequently encounters -->
<!--   med = gates v5.x phase OR violates SEED-004 directly OR collector frequently encounters (not all 3) -->
<!--   low = none of above; theoretical Rdio drift; DEFERRED beyond v5.x -->
<!--   — = ship and N-A cells (NSD-11; per NSD-10 leverage scored on missing AND partial only) -->

<!-- NSD-09 3-input leverage rubric (every missing/partial cell rationale must cite which inputs apply): -->
<!--   (1) cited principle violation — how clearly the cell violates SEED-004 line 15 ('feels lost' / 'dead end') -->
<!--   (2) downstream-phase impact — which v5.0 phase the cell gates if shipped -->
<!--   (3) collector-frequency judgment — how often a single-user collector would plausibly want this drift -->

<!-- NSD-06 worst-case viewer-state aggregation: -->
<!--   When a cell's status diverges between owner-populated and fresh-account viewers, the cell takes -->
<!--   the WORST status observed in Phase 33's table. Cite both viewer-state DISC-AUDIT rows in backing_rows. -->
<!--   Side-lookup: fresh-account counterpart rows are DISC-AUDIT-130, 131, 132, 133, 134, 135, 136 — -->
<!--   check every Watch Detail / Catalog / Collector Profile cell against this list for divergences. -->

<!-- Per-entity backing-row range (from Phase 33; informs which rows are entity-relevant for citation): -->
<!--   Watch Detail → DISC-AUDIT-76..83, 131 -->
<!--   Collector Profile → DISC-AUDIT-84..129, 132..136 (7 tabs aggregated) -->
<!--   Catalog → DISC-AUDIT-70..75, 130 -->
<!--   Home Feed → DISC-AUDIT-21..46 -->
<!--   Explore Feed → DISC-AUDIT-47..56 -->
<!--   Search Results → DISC-AUDIT-57..69 -->
<!--   Header (DISC-AUDIT-01..20) → cite only when Header click-targets are the relevant evidence (rare) -->

<!-- Pre-anchored cells (CONTEXT.md <specifics> lines 200-219 + RESEARCH lines 380-393): -->
<!--   NSV-01 Watch Detail × similar-by-taste — partial high — DISC-AUDIT-82 -->
<!--   NSV-06 Watch Detail × evaluative-verdict — partial high — DISC-AUDIT-81 + DISC-AUDIT-131 (NSD-06 worst-case) -->
<!--   NSV-08 Collector Profile × similar-by-taste — missing high — DISC-AUDIT-129 -->
<!--   NSV-14 Collector Profile × see-more-like-this — missing — cluster DISC-AUDIT-97/102/111/122/123/124/127 + judgment-call DISC-AUDIT-99 -->
<!--   NSV-16 Catalog × same-family/lineage — missing high — DISC-AUDIT-130 (Q2 anchor) -->
<!--   NSV-22 Home Feed × similar-by-taste — ship — DISC-AUDIT-29 -->
<!--   NSV-32 Explore Feed × other-owners — ship — DISC-AUDIT-49 -->

<!-- Row template (markdown, single line — copy this verbatim and fill the 7 fields): -->
<!--   | NSV-NN | <entity> | <vector> | <status> | <leverage> | <rationale> | <backing_rows> | -->

<!-- Example row (copy as a structural model, NOT verbatim — every cell is bespoke): -->
<!--   | NSV-08 | Collector Profile | similar-by-taste | missing | high | Rdio violation: insights tab cards list "sleeping beauty" / "good deal" watches without click affordance — viewer cannot drift from named watch to the watch's own surface; SEED-004 line 15 dead-end (frequent encounter for owner viewing own insights tab; gates Phase 39 polish; high leverage). NSD-09 inputs present: (1) principle violation explicit; (2) downstream impact = Phase 39 polish; (3) collector frequency = high (owner self-view). | DISC-AUDIT-129 | -->
</interfaces>

<authoring_passes>
**3-pass authoring sequence (apply per entity block):**

**Pass 1 (status):** for each of the 7 cells in the current entity block, assign exactly one of {ship, partial, missing, N-A} per NSD-04 strict line + NSD-06 worst-case viewer aggregation. Use the RESEARCH § Cell-Population Pre-Computation table as starting point but VERIFY each against Phase 33's actual rows. Do NOT write rationale or leverage yet.

**Pass 2 (backing_rows):** for each missing/partial cell in the current entity block, populate `backing_rows` with DISC-AUDIT-NN ids that anchor the cell. Use ripgrep against `33-DISCOVERY-AUDIT.md` to verify every cited id exists (Rule 3 ENHANCED catches typos but author-time verification is cheaper). Cite by paste, not retype, to avoid off-by-one errors (Pitfall #2). For missing cells with no Phase 33 row anchoring them (typical for absence-of-vector cells), set `backing_rows` to `—` and note the absence will require explicit rationale in Pass 3.

**Pass 3 (rationale + leverage):** for each cell in the current entity block, write 1-3 sentence rationale + assign leverage. Rationale structure (rigid — no creative deviation):
- **For missing cells:** (a) WHAT is missing on this entity for this vector; (b) WHY it violates SEED-004 line 15 — use literal `Rdio violation:` or `SEED-004:` token; (c) WHICH of the 3 NSD-09 inputs are present (cite (1)/(2)/(3) explicitly).
- **For partial cells:** (a) WHAT is visible but not clickable; (b) WHY this is a Rdio drift dead-end (visible drift direction with no path to act); (c) NSD-09 3-input cite.
- **For ship cells:** (a) WHAT clickable affordance exists; (b) viewer-state coverage (per NSD-06, note if both owner-populated and fresh-account ship). Leverage is `—` per NSD-10.
- **For N-A cells:** (a) WHY the vector is genuinely inapplicable to this entity (no path to make it apply meaningfully). Leverage is `—`.

**Anti-patterns (per RESEARCH § Anti-Patterns + Pitfalls):**
- Recommendation drift (Pitfall #4): rationale must NOT contain "should add", "should ship", "Phase 39 must", "the fix is" — fixes are downstream phase territory; this is an audit not a plan.
- Skipping worst-case viewer state (Pitfall #5): every Watch Detail / Catalog / Collector Profile cell tagged ship requires confirming no fresh-account counterpart in DISC-AUDIT-130..136 makes it partial.
- Over-N-A-ing (Pitfall #6): N-A is a low-frequency outcome (~5 of 42 cells); when in doubt, prefer `missing` with `low` leverage and rationale acknowledging "theoretically applicable, practically dispensable for v5.0".
</authoring_passes>

<commit_cadence>
**Commit per entity block (6 commits inside Wave 1):**

1. After Watch Detail block (NSV-01..07): commit "docs(33b-02): populate Watch Detail × 7 vectors (NSV-01..07)"
2. After Collector Profile block (NSV-08..14): commit "docs(33b-02): populate Collector Profile × 7 vectors (NSV-08..14)"
3. After Catalog block (NSV-15..21): commit "docs(33b-02): populate Catalog × 7 vectors (NSV-15..21)"
4. After Home Feed block (NSV-22..28): commit "docs(33b-02): populate Home Feed × 7 vectors (NSV-22..28)"
5. After Explore Feed block (NSV-29..35): commit "docs(33b-02): populate Explore Feed × 7 vectors (NSV-29..35)"
6. After Search Results block (NSV-36..42): commit "docs(33b-02): populate Search Results × 7 vectors (NSV-36..42); remove skeleton sentinel"

The first commit MUST also remove the `<!-- skeleton -->` sentinel from the Drift-Vector Audit § (alternatively defer to commit 6 if early-block authoring keeps the sentinel for safety; explicitly DO remove it before the final commit so `full.sh` exits skeleton mode and runs rules 1-4).

Each commit, run `bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` (must pass) and `bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh` (will short-circuit until sentinel removed; after sentinel removal, rules 1-4 must pass for whatever rows exist so far — the audit author should verify this incrementally, but Wave 1 final task confirms full pass).
</commit_cadence>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Local repo filesystem → committed git history | Audit content is static markdown; no externally-reachable surface; no application I/O. Same as Plan 01. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-33b-01 | Tampering | `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` (immutable Phase 33 substrate) | mitigate | Inherited from Plan 01 — `checks/full.sh` Rule 6 enforces `git diff -- 33-DISCOVERY-AUDIT.md` returns empty. Plan 02 author MUST NOT edit Phase 33's file even when consulting it for citations (read-only). |
| T-33b-02 | Tampering | Cited DISC-AUDIT-NN ids that don't exist in Phase 33's table | mitigate | `checks/full.sh` Rule 3 ENHANCED catches off-by-one typos. Author-time discipline: cite by paste from `33-DISCOVERY-AUDIT.md`, not by retype (Pitfall #2 mitigation). |
</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Populate Watch Detail × 7 vectors (NSV-01..NSV-07) — 3-pass authoring; remove skeleton sentinel</name>
  <read_first>
    .planning/phases/33b-discovery-north-star-audit/33b-CONTEXT.md
    .planning/phases/33b-discovery-north-star-audit/33b-RESEARCH.md
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
    .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
    .planning/seeds/SEED-004-v5-discovery-north-star.md
  </read_first>
  <files>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
  </files>
  <action>
**Authoring scope:** populate 7 cells covering Watch Detail × {7 NSD-07 vectors in order}. Remove the `<!-- skeleton -->` sentinel from the Drift-Vector Audit § as part of this commit (or defer to a later block commit; whichever is cleanest — but ensure it is removed before Task 6 finishes).

**Apply the 3-pass authoring sequence** (see `<authoring_passes>` block above). Within Watch Detail block (NSV-01..NSV-07):

**Cell tuples — RESEARCH-ASSUMED starting points (author MUST verify each against Phase 33 rows DISC-AUDIT-76..83 + DISC-AUDIT-131):**

| Row | Entity | Vector | Pre-computed status | Leverage hint | Likely DISC-AUDIT cite | Notes |
|-----|--------|--------|---------------------|---------------|-------------------------|-------|
| NSV-01 | Watch Detail | similar-by-taste | partial (PRE-ANCHORED) | high (PRE-ANCHORED) | DISC-AUDIT-82 | mostSimilar text-only list — visible-but-not-clickable per NSD-04; NSD-09 inputs (1) explicit dead-end (2) one-line text→Link patch gates Phase 39 (3) every owner viewer encounters |
| NSV-02 | Watch Detail | same-family/lineage | missing | high or med (Q2 anchor) | — (no Phase 33 row; absence-rationale required per NSD-15 rule 3) | RESEARCH-ASSUMED — verify by grep against DISC-AUDIT-76..83 for any "family" or "lineage" mention; if absent, set backing_rows to `—` with rationale "Phase 33 enumerated affordances that exist; same-family/lineage walk has no PROD anchor on /watch/{id} (CAT-15/CAT-16 planned for Phase 34/35), so absence-rationale per NSD-15 rule 3" |
| NSV-03 | Watch Detail | same-era | missing | med | — (likely; verify) | RESEARCH-ASSUMED — era_signal column shipped Phase 19.1 but no surface affordance reads it for drift navigation; absence-rationale similar to NSV-02 |
| NSV-04 | Watch Detail | other-owners | missing | low or med | — (likely; verify) | RESEARCH-ASSUMED — /watch is per-user-watch; no roster of other owners shown; cross-collector graph lives on /catalog (NSD-07 PROD anchor) |
| NSV-05 | Watch Detail | owner-overlap | N-A or missing (author judgment per A5 in RESEARCH Assumptions Log) | — or low | — | RESEARCH-ASSUMED N-A: /watch is per-user-watch; owner-overlap doesn't apply at this entity level. Author may upgrade to missing if Phase 20 D-08 cross-user /watch framing makes overlap meaningful (verify against DISC-AUDIT-76..83). Rationale must explicitly justify N-A vs missing choice |
| NSV-06 | Watch Detail | evaluative-verdict | partial (PRE-ANCHORED — NSD-06 worst-case) | high (PRE-ANCHORED — Q4 anchor) | DISC-AUDIT-81 + DISC-AUDIT-131 | owner-populated ships (DISC-AUDIT-81); fresh-account suppressed (DISC-AUDIT-131). Per NSD-06 worst-case = partial; rationale must cite both rows and explain viewer-state divergence; NSD-09 inputs (1) fresh-account dead-end (2) Q4 CAT-13 framing anchor for Phase 38 (3) every fresh-account viewer hits this gap |
| NSV-07 | Watch Detail | see-more-like-this | missing | med | — (likely; verify) | RESEARCH-ASSUMED — no rail/feed of "more watches like this" on /watch detail; Phase 39 candidate; absence-rationale per NSD-15 rule 3 |

**Author judgment calls (resolve and note in cell rationale):**
- NSV-04 vs NSV-05: confirm whether /watch shows other-owners (cross-collector graph). NSD-07 PROD anchor says "cross-collector graph (PROD via /catalog catalog-page collector list)" implying /catalog hosts it, not /watch. Default NSV-04 to `missing`.
- NSV-05 N-A vs missing: per A5 in RESEARCH Assumptions Log, this is the cell most likely to differ from pre-computation. Author MUST verify against DISC-AUDIT-76..83 and commit a definitive choice with explicit rationale.

**Pass 1 (status):** assign each cell's status. Pre-anchored: NSV-01 partial; NSV-06 partial. RESEARCH-ASSUMED: NSV-02/03/04/07 missing; NSV-05 N-A or missing.

**Pass 2 (backing_rows):**
- NSV-01: `DISC-AUDIT-82`
- NSV-02..NSV-04, NSV-07: `—` (likely, with absence-rationale) — verify by ripgrepping `DISC-AUDIT-7[6-9]|DISC-AUDIT-8[0-3]|DISC-AUDIT-131` and confirming no row matches the vector
- NSV-05: `—` (N-A; no backing required for N-A per leverage `—`)
- NSV-06: `DISC-AUDIT-81, DISC-AUDIT-131`

**Pass 3 (rationale + leverage):** write each cell's rationale per the rationale-structure rules in `<authoring_passes>`. For missing cells, include literal `Rdio violation:` or `SEED-004` token. For NSD-09 3-input rubric, cite which of (1)/(2)/(3) inputs are present.

After all 7 rows written, remove `<!-- skeleton -->` from the Drift-Vector Audit § (so subsequent runs of `full.sh` don't short-circuit). Also remove the accompanying skeleton-sentinel comments. Commit with message `docs(33b-02): populate Watch Detail × 7 vectors (NSV-01..07); remove skeleton sentinel`.

Run `bash checks/quick.sh` (must pass) and `bash checks/full.sh` (rules 1-4 will not yet fully pass because only 7 of 42 rows present — that's expected; the final task confirms full pass).
  </action>
  <verify>
    <automated>bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh && grep -cE '^\| NSV-0[1-7] \| Watch Detail \|' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -q '^7$'</automated>
  </verify>
  <acceptance_criteria>
    - `bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` exits 0
    - 7 NSV rows for Watch Detail: `grep -cE '^\| NSV-0[1-7] \| Watch Detail \|' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 7
    - Skeleton sentinel removed: `grep -c '<!-- skeleton -->' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 0
    - NSV-01 cites DISC-AUDIT-82: `grep -E '^\| NSV-01 \|' 33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -q 'DISC-AUDIT-82'` exits 0
    - NSV-06 cites both DISC-AUDIT-81 and DISC-AUDIT-131 (NSD-06 worst-case): `grep -E '^\| NSV-06 \|' 33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -q 'DISC-AUDIT-81' && grep -E '^\| NSV-06 \|' 33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -q 'DISC-AUDIT-131'`
    - Every missing row in this block cites SEED-004 or Rdio violation: `awk -F'\|' '/^\| NSV-0[1-7] \|/ { st=$5; gsub(/^ | $/,"",st); rt=$7; gsub(/^ | $/,"",rt); if(st=="missing" && rt!~/(Rdio violation:|SEED-004)/) {print $2; exit 1} } END{exit 0}'` exits 0
    - Every missing/partial row in this block has leverage tag: `awk -F'\|' '/^\| NSV-0[1-7] \|/ { st=$5; gsub(/^ | $/,"",st); lv=$6; gsub(/^ | $/,"",lv); if((st=="missing"||st=="partial") && lv!~/^(high|med|low)$/) {print $2; exit 1} } END{exit 0}'` exits 0
    - Every cited DISC-AUDIT-NN in NSV-01..07 exists in Phase 33's table (Rule 3 ENHANCED partial check): for each `DISC-AUDIT-[0-9]+` token in NSV-01..07 rows, `grep -qE "^\| ${id} \|" .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` exits 0
    - Phase 33 audit untouched (T-33b-01): `git diff --quiet HEAD -- .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` exits 0
  </acceptance_criteria>
  <done>7 NSV rows for Watch Detail authored with verified DISC-AUDIT-NN citations (or absence-rationale for cells with no Phase 33 anchor); skeleton sentinel removed; quick.sh passes; Phase 33 audit unmodified.</done>
</task>

<task type="auto">
  <name>Task 2: Populate Collector Profile × 7 vectors (NSV-08..NSV-14) — 3-pass authoring</name>
  <read_first>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
    .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
    .planning/phases/33b-discovery-north-star-audit/33b-RESEARCH.md
  </read_first>
  <files>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
  </files>
  <action>
**Authoring scope:** populate 7 cells covering Collector Profile × {7 NSD-07 vectors in order}. This block is the **densest pre-anchored block** — 8 of 10 pre-anchored Missing rows from Phase 33 live in Collector Profile cells. Apply the 3-pass authoring sequence.

**Cell tuples — RESEARCH-ASSUMED starting points (author MUST verify each against Phase 33 rows DISC-AUDIT-84..129 + DISC-AUDIT-132..136):**

| Row | Entity | Vector | Pre-computed status | Leverage hint | Likely DISC-AUDIT cite | Notes |
|-----|--------|--------|---------------------|---------------|-------------------------|-------|
| NSV-08 | Collector Profile | similar-by-taste | missing (PRE-ANCHORED) | high (PRE-ANCHORED) | DISC-AUDIT-129 | insights tab cards (SleepingBeauties / GoodDeals) list watches without `<Link>` wrap; NSD-09 inputs (1) Rdio dead-end (2) one-line `<Link>` patch for Phase 39 (3) frequent owner self-view encounter |
| NSV-09 | Collector Profile | same-family/lineage | missing | med | — (likely) | RESEARCH-ASSUMED — profile tabs show watches without family-walk affordances; absence-rationale per NSD-15 rule 3 |
| NSV-10 | Collector Profile | same-era | missing | low | — (likely) | RESEARCH-ASSUMED — no era-grouping affordance in profile; absence-rationale |
| NSV-11 | Collector Profile | other-owners | N-A | — | — | RESEARCH-ASSUMED — Profile IS the collector entity; "other-owners" of this collector doesn't make sense at this entity level; explicit N-A rationale per NSD-03 |
| NSV-12 | Collector Profile | owner-overlap | ship or partial | — or med | DISC-AUDIT-125, 126 (common-ground tab + hero band) | RESEARCH-ASSUMED — common-ground tab ships (PROD anchor per NSD-07); fresh-account viewer of locked profile may see common-ground gated → partial via NSD-06 worst-case if locked-tab branch fires for common-ground. Verify against DISC-AUDIT-125/126/127 |
| NSV-13 | Collector Profile | evaluative-verdict | N-A | — | — | RESEARCH-ASSUMED — Profile shows owner's collection, not viewer-evaluative-against-viewer's-own-collection (verdict surface lives on /watch and /catalog); explicit N-A rationale per NSD-03 |
| NSV-14 | Collector Profile | see-more-like-this | missing (PRE-ANCHORED — Q3 dominant cluster) | mixed (locked-tab cells may rate medium = fresh-account-only; calendar/common-ground rate high = universal encounter) | DISC-AUDIT-97, 102, 111, 122, 123, 124, 127, 99 | The dominant Q3 anchor — cluster of locked-tab no-CTA, calendar day-cell no onClick, common-ground 404 no walk-back, wishlist drag silent no-op (judgment call: WR-07 Dead row in Phase 33; for Phase 33b classify per NSD-04 — affordance EXISTS but broken, may be `partial` per author judgment per A2 in RESEARCH Assumptions Log; default per CONTEXT.md `<specifics>` line 218: classify as part of the missing cluster but flag in rationale as "wired-but-broken affordance"). NSD-09 inputs (1) cluster of explicit Rdio dead-ends (2) Phase 39 polish ordering anchor (3) varies per sub-row — calendar/common-ground frequent; locked tabs fresh-account-only |

**Author judgment calls:**
- NSV-12 ship vs partial: per NSD-06, if common-ground is gated for fresh-account viewer (locked-profile-state at layout.tsx:47), the worst-case = partial. Verify by checking DISC-AUDIT-127 (common-ground 404) and DISC-AUDIT-125/126 (common-ground tab + hero band) — if a fresh-account viewer hits a 404 instead of a CTA, that's partial-via-worst-case.
- NSV-14 leverage: this single cell aggregates 7+ Phase 33 Missing rows; the leverage rating must reflect the WORST sub-cell rating (high if any sub-row is high). Default to `high` because DISC-AUDIT-127 (common-ground 404 universal-viewer) and DISC-AUDIT-111 (calendar day-cell universal-owner) are high-leverage by NSD-09.
- DISC-AUDIT-99 (wishlist drag silent no-op, WR-07 Dead): per A2 in RESEARCH Assumptions Log, this row classifies the wishlist drag affordance as Dead in Phase 33 (wired but silent no-op). For Phase 33b: cite it inside NSV-14 backing_rows but note in rationale this is a "wired-but-broken affordance" rather than a clean missing dead-end.

**Pass 1 (status):** NSV-08 missing (pre); NSV-09/10 missing; NSV-11/13 N-A; NSV-12 ship or partial (verify NSD-06); NSV-14 missing (pre-cluster).

**Pass 2 (backing_rows):**
- NSV-08: `DISC-AUDIT-129`
- NSV-09, NSV-10: `—` likely (verify by ripgrepping DISC-AUDIT-84..129 + DISC-AUDIT-132..136)
- NSV-11, NSV-13: `—` (N-A; no backing required)
- NSV-12: `DISC-AUDIT-125, DISC-AUDIT-126` (and DISC-AUDIT-127 if partial via NSD-06)
- NSV-14: `DISC-AUDIT-97, DISC-AUDIT-102, DISC-AUDIT-111, DISC-AUDIT-122, DISC-AUDIT-123, DISC-AUDIT-124, DISC-AUDIT-127, DISC-AUDIT-99`

**Pass 3 (rationale + leverage):** apply rationale-structure rules per `<authoring_passes>`. For missing cells, cite SEED-004 line 15 violation. For NSV-14, the rationale should explicitly describe the cluster (locked-tab CTAs + calendar day cells + common-ground 404 + wishlist drag) and explain that the leverage rating reflects the worst sub-row severity. For N-A cells (NSV-11, NSV-13), explain WHY the vector is genuinely inapplicable (not "doesn't really apply" — specific reasoning).

Commit with message `docs(33b-02): populate Collector Profile × 7 vectors (NSV-08..14)`.

Run `bash checks/quick.sh` (must pass).
  </action>
  <verify>
    <automated>bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh && grep -cE '^\| NSV-(08|09|10|11|12|13|14) \| Collector Profile \|' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -q '^7$'</automated>
  </verify>
  <acceptance_criteria>
    - `bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` exits 0
    - 7 Collector Profile rows: `grep -cE '^\| NSV-(08|09|10|11|12|13|14) \| Collector Profile \|' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 7
    - NSV-08 cites DISC-AUDIT-129: `grep -E '^\| NSV-08 \|' 33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -q 'DISC-AUDIT-129'` exits 0
    - NSV-14 cites at least 7 of the 8 Q3-cluster rows (DISC-AUDIT-97, 102, 111, 122, 123, 124, 127, 99): `grep -E '^\| NSV-14 \|' 33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -oE 'DISC-AUDIT-[0-9]+' | sort -u | wc -l` returns >= 7
    - Every missing row in this block cites SEED-004 or Rdio violation: awk pattern as Task 1 (NSV range 08-14)
    - Every missing/partial row in this block has leverage tag: awk pattern as Task 1 (NSV range 08-14)
    - Every cited DISC-AUDIT-NN exists in Phase 33's table: for each id, `grep -qE "^\| ${id} \|" 33-DISCOVERY-AUDIT.md` exits 0
    - Phase 33 audit untouched: `git diff --quiet HEAD -- .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` exits 0
    - Total NSV-NN rows so far: `grep -c '^| NSV-' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 14 (cumulative across Tasks 1+2)
  </acceptance_criteria>
  <done>7 Collector Profile cells authored covering the dominant Q3 dead-end cluster (NSV-14) and Q4-relevant cells (NSV-08); cumulative 14 of 42 rows present; quick.sh passes; Phase 33 audit unmodified.</done>
</task>

<task type="auto">
  <name>Task 3: Populate Catalog × 7 vectors (NSV-15..NSV-21) — 3-pass authoring; Q2 anchor (NSV-16)</name>
  <read_first>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
    .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
    .planning/phases/33b-discovery-north-star-audit/33b-RESEARCH.md
  </read_first>
  <files>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
  </files>
  <action>
**Authoring scope:** populate 7 cells covering Catalog × {7 NSD-07 vectors in order}. NSV-16 is the **Q2 lineage browse priority anchor** — cite DISC-AUDIT-130 (catalog page no walk-to-family affordance + fresh-account verdict suppression).

**Cell tuples — RESEARCH-ASSUMED starting points (author MUST verify each against Phase 33 rows DISC-AUDIT-70..75 + DISC-AUDIT-130):**

| Row | Entity | Vector | Pre-computed status | Leverage hint | Likely DISC-AUDIT cite | Notes |
|-----|--------|--------|---------------------|---------------|-------------------------|-------|
| NSV-15 | Catalog | similar-by-taste | partial | high or med | DISC-AUDIT-71 | RESEARCH-ASSUMED — same text-only mostSimilar pattern as /watch (DISC-AUDIT-82); verify DISC-AUDIT-71 surfaces this on /catalog |
| NSV-16 | Catalog | same-family/lineage | missing (PRE-ANCHORED — Q2 anchor) | high (PRE-ANCHORED) | DISC-AUDIT-130 | No affordance to walk to other watches in same family; gates Phase 35 lineage browse UI scope; NSD-09 inputs (1) explicit family-walk dead-end (2) Q2 anchor for Phase 35 (3) every catalog page view in hierarchy-aware app |
| NSV-17 | Catalog | same-era | missing | med | — (likely) | RESEARCH-ASSUMED — era_signal exists (Phase 19.1) but no surface affordance reads it for drift; absence-rationale |
| NSV-18 | Catalog | other-owners | author judgment per A4 — likely ship or partial | — or med | DISC-AUDIT-72 ("You own this" callout) + cross-collector list (verify) | RESEARCH-ASSUMED — NSD-07 PROD anchor says "/catalog catalog-page collector list" exists; if it does, NSV-18=ship; if only owner-self callout, NSV-18=partial; **author MUST verify against DISC-AUDIT-70..75 source code rendering, not RESEARCH-ASSUMED reading** |
| NSV-19 | Catalog | owner-overlap | N-A | — | — | RESEARCH-ASSUMED — Catalog is the canonical reference, not collector-scoped; explicit N-A rationale |
| NSV-20 | Catalog | evaluative-verdict | partial (NSD-06 worst-case) | high (Q4 anchor) | DISC-AUDIT-70 + DISC-AUDIT-130 | RESEARCH-ASSUMED — owner-populated ships (DISC-AUDIT-70); fresh-account suppressed (DISC-AUDIT-130); per NSD-06 worst-case = partial; Q4 CAT-13 framing co-anchor with NSV-06 |
| NSV-21 | Catalog | see-more-like-this | missing | med | — (likely) | RESEARCH-ASSUMED — no "more catalog refs like this" rail on /catalog; Phase 39 candidate; absence-rationale |

**Critical author judgment call (per RESEARCH Assumptions Log A4):**
- **NSV-18 (Catalog × other-owners)** is the cell most likely to differ from pre-computation. NSD-07 PROD anchor hint says "cross-collector graph (PROD via /catalog catalog-page collector list)" — this implies a collector list IS rendered on /catalog. The author MUST verify by:
  1. ripgrepping `33-DISCOVERY-AUDIT.md` for DISC-AUDIT-70..75 for any "collector" / "owner" / "list" / "roster" mention
  2. If a collector list ships → NSV-18 = ship, leverage = `—`, backing_rows = the relevant DISC-AUDIT row
  3. If only "You own this" owner-self callout → NSV-18 = partial (visible info but not a click-through to other owners), leverage = high (one-line patch to make collector chips clickable)
  4. If neither → NSV-18 = missing, leverage = high, absence-rationale + cite SEED-004 violation

**Pass 1 (status):** NSV-15 partial; NSV-16 missing (pre); NSV-17 missing; NSV-18 ship/partial/missing (verify A4); NSV-19 N-A; NSV-20 partial (NSD-06 worst-case); NSV-21 missing.

**Pass 2 (backing_rows):**
- NSV-15: `DISC-AUDIT-71` (verify pattern matches /watch's DISC-AUDIT-82 mostSimilar)
- NSV-16: `DISC-AUDIT-130` (PRE-ANCHORED Q2)
- NSV-17, NSV-21: `—` likely with absence-rationale
- NSV-18: depends on A4 verification
- NSV-19: `—` (N-A)
- NSV-20: `DISC-AUDIT-70, DISC-AUDIT-130` (NSD-06 worst-case)

**Pass 3 (rationale + leverage):** apply rationale-structure rules. NSV-16 rationale must explicitly identify it as the Q2 lineage browse priority anchor (downstream impact = Phase 35 UI scope). NSV-20 rationale must explain the NSD-06 worst-case via DISC-AUDIT-70/130 viewer divergence and identify it as Q4 CAT-13 framing co-anchor with NSV-06.

Commit with message `docs(33b-02): populate Catalog × 7 vectors (NSV-15..21); Q2 anchor (NSV-16) committed`.

Run `bash checks/quick.sh` (must pass).
  </action>
  <verify>
    <automated>bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh && [ "$(grep -cE '^\| NSV-(15|16|17|18|19|20|21) \| Catalog \|' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md)" = "7" ]</automated>
  </verify>
  <acceptance_criteria>
    - `bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` exits 0
    - 7 Catalog rows: `grep -cE '^\| NSV-(15|16|17|18|19|20|21) \| Catalog \|' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 7
    - NSV-16 cites DISC-AUDIT-130 (Q2 anchor): `grep -E '^\| NSV-16 \|' 33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -q 'DISC-AUDIT-130'` exits 0
    - NSV-20 cites both DISC-AUDIT-70 and DISC-AUDIT-130 (NSD-06 worst-case): `grep -E '^\| NSV-20 \|' | grep -q 'DISC-AUDIT-70' && grep -E '^\| NSV-20 \|' | grep -q 'DISC-AUDIT-130'`
    - Every missing row cites SEED-004 or Rdio violation in this block
    - Every missing/partial row has leverage tag
    - Every cited DISC-AUDIT-NN exists in Phase 33 table
    - Phase 33 audit untouched: `git diff --quiet HEAD -- .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` exits 0
    - Cumulative NSV count: `grep -c '^| NSV-' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 21
  </acceptance_criteria>
  <done>7 Catalog cells authored with Q2 anchor (NSV-16) and Q4 co-anchor (NSV-20); cumulative 21 of 42 rows; quick.sh passes; Phase 33 audit unmodified.</done>
</task>

<task type="auto">
  <name>Task 4: Populate Home Feed × 7 vectors (NSV-22..NSV-28) — 3-pass authoring; Q1 home-side anchor</name>
  <read_first>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
    .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
    .planning/phases/33b-discovery-north-star-audit/33b-RESEARCH.md
  </read_first>
  <files>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
  </files>
  <action>
**Authoring scope:** populate 7 cells covering Home Feed × {7 NSD-07 vectors in order}. Home Feed cells (NSV-22..28) provide the **Q1 home-side anchor** — the verdict on whether to combine home and explore is grounded in the cross-entity comparison between Home Feed cells (NSV-22..28) and Explore Feed cells (NSV-29..35).

**Cell tuples — RESEARCH-ASSUMED starting points (author MUST verify each against Phase 33 rows DISC-AUDIT-21..46):**

| Row | Entity | Vector | Pre-computed status | Leverage hint | Likely DISC-AUDIT cite | Notes |
|-----|--------|--------|---------------------|---------------|-------------------------|-------|
| NSV-22 | Home Feed | similar-by-taste | ship (PRE-ANCHORED) | — (PRE-ANCHORED) | DISC-AUDIT-29 | CollectorsLikeYou RecommendationCard Link to /watch/{representativeWatchId}; rec engine signal-driven; per NSD-06 confirm fresh-account state — rec engine gated on collection signal so fresh-account may suppress (worst-case may be partial — author judgment) |
| NSV-23 | Home Feed | same-family/lineage | missing | med | — (likely) | RESEARCH-ASSUMED — Home doesn't surface family-level drift; absence-rationale |
| NSV-24 | Home Feed | same-era | missing | low | — (likely) | RESEARCH-ASSUMED — no era rail on home; absence-rationale |
| NSV-25 | Home Feed | other-owners | partial or ship | — or med | DISC-AUDIT-30, 32, 39 (NetworkActivityFeed + SuggestedCollectors) | RESEARCH-ASSUMED — Network rails surface other collectors but as activity-derivative not strictly "other-owners-of-a-watch"; author judgment between ship (any cross-collector affordance counts) and partial (visible cross-collector data without watch-specific routing) |
| NSV-26 | Home Feed | owner-overlap | partial or missing | med | DISC-AUDIT-38 (CommonGroundFollowerCard) | RESEARCH-ASSUMED — CommonGroundFollowerCard exists in home; if it links to /u/{user}/common-ground = ship; if just visible card without click-through = partial; verify against DISC-AUDIT-38 |
| NSV-27 | Home Feed | evaluative-verdict | missing | low or med | — (likely) | RESEARCH-ASSUMED — no verdict rendered on home; verdict is /watch + /catalog territory; absence-rationale |
| NSV-28 | Home Feed | see-more-like-this | partial or ship | — or med | DISC-AUDIT-33 (Load more), 35-37 (PersonalInsightsGrid) | RESEARCH-ASSUMED — various rails support pagination/load-more; if click-driven pagination ships = ship; verify |

**Pass 1 / Pass 2 / Pass 3** per `<authoring_passes>`. NSV-22 rationale must note this is the home-side Q1 anchor (its co-row is NSV-29 Explore Feed × similar-by-taste). NSV-26 rationale must explicitly contrast with NSV-33 Explore Feed × owner-overlap (which is RESEARCH-ASSUMED missing) — this asymmetry is the Q1 evidence.

Commit with message `docs(33b-02): populate Home Feed × 7 vectors (NSV-22..28)`.

Run `bash checks/quick.sh` (must pass).
  </action>
  <verify>
    <automated>bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh && [ "$(grep -cE '^\| NSV-(22|23|24|25|26|27|28) \| Home Feed \|' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md)" = "7" ]</automated>
  </verify>
  <acceptance_criteria>
    - `bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` exits 0
    - 7 Home Feed rows: `grep -cE '^\| NSV-(22|23|24|25|26|27|28) \| Home Feed \|' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 7
    - NSV-22 cites DISC-AUDIT-29: `grep -E '^\| NSV-22 \|' | grep -q 'DISC-AUDIT-29'` exits 0
    - Every missing row in this block cites SEED-004 or Rdio violation
    - Every missing/partial row has leverage tag
    - Every cited DISC-AUDIT-NN exists in Phase 33 table
    - Phase 33 audit untouched
    - Cumulative NSV count: `grep -c '^| NSV-' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 28
  </acceptance_criteria>
  <done>7 Home Feed cells authored with Q1 home-side anchor (NSV-22 ship + NSV-26 contrast); cumulative 28 of 42 rows; quick.sh passes; Phase 33 audit unmodified.</done>
</task>

<task type="auto">
  <name>Task 5: Populate Explore Feed × 7 vectors (NSV-29..NSV-35) — 3-pass authoring; Q1 explore-side anchor</name>
  <read_first>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
    .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
    .planning/phases/33b-discovery-north-star-audit/33b-RESEARCH.md
  </read_first>
  <files>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
  </files>
  <action>
**Authoring scope:** populate 7 cells covering Explore Feed × {7 NSD-07 vectors in order}. Explore Feed cells (NSV-29..35) provide the **Q1 explore-side anchor**, paired against Home Feed (NSV-22..28). Cross-entity asymmetry between these two blocks is the empirical evidence for Q1.

**Cell tuples — RESEARCH-ASSUMED starting points (author MUST verify each against Phase 33 rows DISC-AUDIT-47..56):**

| Row | Entity | Vector | Pre-computed status | Leverage hint | Likely DISC-AUDIT cite | Notes |
|-----|--------|--------|---------------------|---------------|-------------------------|-------|
| NSV-29 | Explore Feed | similar-by-taste | missing | med | — (likely) | RESEARCH-ASSUMED — /explore is raw-popularity, not personalized (per SEED-004 line 36); absence-rationale; contrasts NSV-22 (Home ships) — Q1 evidence |
| NSV-30 | Explore Feed | same-family/lineage | missing | low | — (likely) | RESEARCH-ASSUMED — no family rail; absence-rationale |
| NSV-31 | Explore Feed | same-era | missing | low | — (likely) | RESEARCH-ASSUMED — no era rail; absence-rationale |
| NSV-32 | Explore Feed | other-owners | ship (PRE-ANCHORED) | — (PRE-ANCHORED) | DISC-AUDIT-49 | PopularCollectorRow whole-row Link to /u/{username}/collection; direct surfacing of cross-collector graph; per NSD-06 ship for both viewer states |
| NSV-33 | Explore Feed | owner-overlap | missing | low | — (likely) | RESEARCH-ASSUMED — common-ground is profile-scoped not /explore-surfaced; contrasts NSV-26 (Home partial/ship) — Q1 evidence |
| NSV-34 | Explore Feed | evaluative-verdict | missing | low | — (likely) | RESEARCH-ASSUMED — no verdict on /explore rail items; absence-rationale |
| NSV-35 | Explore Feed | see-more-like-this | ship | — | DISC-AUDIT-52, 54 (TrendingWatches + GainingTractionWatches DiscoveryWatchCard) | The defining /explore vector — paginated discovery rails; NSD-09 not applicable (ship); contrasts NSV-28 (Home partial/ship) — Q1 evidence |

**Pass 1 / Pass 2 / Pass 3** per `<authoring_passes>`. NSV-29/33/35 rationales must include cross-references to NSV-22/26/28 (the Home counterparts) so Q1 evidence chain is auditable.

Commit with message `docs(33b-02): populate Explore Feed × 7 vectors (NSV-29..35)`.

Run `bash checks/quick.sh` (must pass).
  </action>
  <verify>
    <automated>bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh && [ "$(grep -cE '^\| NSV-(29|30|31|32|33|34|35) \| Explore Feed \|' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md)" = "7" ]</automated>
  </verify>
  <acceptance_criteria>
    - `bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` exits 0
    - 7 Explore Feed rows: `grep -cE '^\| NSV-(29|30|31|32|33|34|35) \| Explore Feed \|' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 7
    - NSV-32 cites DISC-AUDIT-49: `grep -E '^\| NSV-32 \|' | grep -q 'DISC-AUDIT-49'` exits 0
    - NSV-35 cites DISC-AUDIT-52 or DISC-AUDIT-54: `grep -E '^\| NSV-35 \|' | grep -qE 'DISC-AUDIT-(52|54)'` exits 0
    - Every missing row cites SEED-004 or Rdio violation
    - Every missing/partial row has leverage tag
    - Every cited DISC-AUDIT-NN exists in Phase 33 table
    - Phase 33 audit untouched
    - Cumulative NSV count: `grep -c '^| NSV-' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 35
  </acceptance_criteria>
  <done>7 Explore Feed cells authored with Q1 explore-side anchor (NSV-32 ship + NSV-35 ship + NSV-29/33 missing contrasts); cumulative 35 of 42 rows; quick.sh passes; Phase 33 audit unmodified.</done>
</task>

<task type="auto">
  <name>Task 6: Populate Search Results × 7 vectors (NSV-36..NSV-42) — 3-pass authoring; full.sh rules 1-4 final pass</name>
  <read_first>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
    .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
    .planning/phases/33b-discovery-north-star-audit/33b-RESEARCH.md
  </read_first>
  <files>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
  </files>
  <action>
**Authoring scope:** populate the final 7 cells covering Search Results × {7 NSD-07 vectors in order}. After this commit, all 42 NSV-NN rows are present and `bash checks/full.sh` rules 1-4 must pass (rules 5-6 are Wave 2 — rule 5 verdicts are still TBD; rule 6 git-immutability already passing).

**Cell tuples — RESEARCH-ASSUMED starting points (author MUST verify each against Phase 33 rows DISC-AUDIT-57..69):**

| Row | Entity | Vector | Pre-computed status | Leverage hint | Likely DISC-AUDIT cite | Notes |
|-----|--------|--------|---------------------|---------------|-------------------------|-------|
| NSV-36 | Search Results | similar-by-taste | missing | low | — (likely) | RESEARCH-ASSUMED — search is keyword-match not similarity-driven; absence-rationale |
| NSV-37 | Search Results | same-family/lineage | missing | low | — (likely) | RESEARCH-ASSUMED — no family-aware search facet; SRCH-16 adds movement/case-size/style not family; absence-rationale |
| NSV-38 | Search Results | same-era | missing | low | — (likely) | RESEARCH-ASSUMED — no era facet in search; absence-rationale |
| NSV-39 | Search Results | other-owners | partial | med | DISC-AUDIT-60, 61 (PeopleSearchRow) | RESEARCH-ASSUMED — People-tab surfaces collectors; collection-tab surfaces collections; not specifically "other-owners-of-this-watch" but a related affordance — author judgment between partial (visible cross-collector data) and missing (not the specific other-owners vector). Default partial with rationale |
| NSV-40 | Search Results | owner-overlap | N-A | — | — | RESEARCH-ASSUMED — Search is keyword-driven not collector-scoped overlap; explicit N-A rationale |
| NSV-41 | Search Results | evaluative-verdict | partial (NSD-06 worst-case) | med | DISC-AUDIT-63, 64 (WatchSearchRow accordion verdict) | RESEARCH-ASSUMED — Verdict-on-expand exists; viewer-gated (collection.length > 0) → partial via NSD-06 worst-case for fresh-account; verify against DISC-AUDIT-63/64 |
| NSV-42 | Search Results | see-more-like-this | N-A | — | — | RESEARCH-ASSUMED per NSD-03 + Pitfall #6 — search is query-driven not similarity-driven; explicit N-A rationale "search results are query-driven not 'more like this'"; alternative classification (missing low) acceptable per Pitfall #6 — author judgment |

**Author judgment calls:**
- NSV-39 partial vs missing: PeopleSearchRow rendering collector chips with click-through to /u/{user}/collection is technically a cross-collector affordance, but it's NOT specifically "other-owners-of-this-watch" — that vector is more strictly satisfied by /catalog catalog-page collector list. Default `partial` with rationale "people-tab affordance is collector-discovery not other-owners-of-watch — partial vector match".
- NSV-42 N-A vs missing low: per Pitfall #6, prefer `missing` with `low` leverage when in doubt. However, the N-A case is genuinely defensible for search-as-keyword-match. Author chooses; rationale must justify the chosen classification (not "doesn't really apply").

**Pass 1 / Pass 2 / Pass 3** per `<authoring_passes>`.

After committing all 7 rows, run **`bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh`** — rules 1-4 + Rule 3 ENHANCED + NSD-14 sequencing MUST pass. Rule 5 (4 verdicts) will FAIL because Wave 2 hasn't authored verdicts yet — that's expected. Rule 6 (Phase 33 immutability) MUST pass.

If any rule 1-4 or Rule 3 ENHANCED or NSD-14 sequencing fails, fix the offending cell BEFORE committing. The most likely failures are:
- Rule 1: row count != 42 (missing or duplicate NSV-NN)
- Rule 2: missing/partial cell with leverage = `—` instead of high/med/low
- Rule 3 STANDARD: missing/partial cell with backing_rows lacking DISC-AUDIT-NN AND lacking explicit absence-rationale starting with `—`
- Rule 3 ENHANCED: cited DISC-AUDIT-NN that doesn't exist in Phase 33 table (off-by-one typo — Pitfall #2)
- Rule 4: missing cell rationale lacking `Rdio violation:` or `SEED-004` token
- NSD-14: gap or duplicate in NSV-NN sequencing

Commit with message `docs(33b-02): populate Search Results × 7 vectors (NSV-36..42); 42 rows complete; full.sh rules 1-4 green`.
  </action>
  <verify>
    <automated>bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh 2>&1 | grep -qE 'NSD-15 rule (1|2|3|4)' && [ "$(grep -c '^| NSV-' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md)" = "42" ] && git diff --quiet HEAD -- .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md</automated>
  </verify>
  <acceptance_criteria>
    - 42 NSV rows present: `grep -c '^| NSV-' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 42
    - 7 Search Results rows: `grep -cE '^\| NSV-(36|37|38|39|40|41|42) \| Search Results \|' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 7
    - NSV-NN sequencing 01..42 with no gaps or dupes (NSD-14 enforced by full.sh)
    - `bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh` produces `[ok]` for rules 1, 2, 3 (STANDARD + ENHANCED), 4, 6, and NSD-14 sequencing; rule 5 may produce `[fail]` because Wave 2 hasn't run yet (expected)
    - Every cited DISC-AUDIT-NN across the entire 42-cell table exists in Phase 33's table (Rule 3 ENHANCED full pass)
    - Phase 33 audit untouched: `git diff --quiet HEAD -- .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` exits 0
    - All 6 entity blocks present with exactly 7 cells each: for entity in "Watch Detail" "Collector Profile" "Catalog" "Home Feed" "Explore Feed" "Search Results", `grep -cE "^\| NSV-[0-9]+ \| ${entity} \|"` returns 7
    - All 7 vectors covered uniformly: for vector in similar-by-taste same-family/lineage same-era other-owners owner-overlap evaluative-verdict see-more-like-this, `grep -cE "\\| ${vector} \\|"` in NSV rows returns 6
  </acceptance_criteria>
  <done>All 42 NSV-NN cells populated; NSD-15 rules 1-4 + Rule 3 ENHANCED + NSD-14 sequencing pass; rule 6 (Phase 33 immutability) passes; rule 5 (decisions) deferred to Wave 2 as expected. The audit table is content-complete; Wave 2 (Plan 03) authors the 4 D-17 verdicts citing NSV-NN rows from this plan.</done>
</task>

</tasks>

<verification>
After all 6 tasks commit:

1. `bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` exits 0.
2. `bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh` produces `[ok]` for rules 1, 2, 3 (STANDARD + ENHANCED), 4, 6, and NSD-14 sequencing; only rule 5 fails (4 verdicts not yet authored — Wave 2 territory).
3. `grep -c '^| NSV-' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 42.
4. `git diff --quiet HEAD -- .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` returns 0 (T-33b-01 mitigation green throughout).
5. Cross-entity vector coverage: each of the 7 vectors appears in exactly 6 rows (one per entity); each of the 6 entities has exactly 7 rows (one per vector).
6. Pre-anchored cells correctly populated with their CONTEXT.md `<specifics>` cited DISC-AUDIT rows.
</verification>

<success_criteria>
- All 42 NSV-NN rows authored in `33b-DISCOVERY-NORTH-STAR-AUDIT.md` Drift-Vector Audit § with NSD-13 7-column shape
- Skeleton sentinel removed
- Status assignments per NSD-04 strict line + NSD-06 worst-case viewer-state aggregation
- Leverage tags present on all missing AND partial cells per NSD-10 + NSD-11
- DISC-AUDIT-NN backing-row citations verified to exist in Phase 33's table per NSD-15 rule 3 ENHANCED
- Missing-cell rationales cite SEED-004 line 15 violation per NSD-15 rule 4
- NSD-14 sequencing intact (NSV-01..NSV-42, no gaps, no dupes)
- 6 entity-block commits inside Wave 1 for crash-recovery boundedness
- Phase 33's `33-DISCOVERY-AUDIT.md` unmodified throughout (T-33b-01 mitigation)
- Wave 2 (Plan 03) can author verdicts citing concrete NSV-NN rows from this plan
</success_criteria>

<output>
After completion, create `.planning/phases/33b-discovery-north-star-audit/33b-02-SUMMARY.md` per the GSD summary template, capturing:
- 42 NSV-NN cells authored with status distribution (ship / partial / missing / N-A counts)
- Leverage distribution on missing/partial cells (high / med / low counts)
- Pre-anchored cell verification: every CONTEXT.md `<specifics>` pre-anchor implemented as documented (NSV-01/06/08/14/16/22/32)
- A4/A5 author-judgment resolutions: NSV-18 (Catalog × other-owners) and NSV-05 (Watch Detail × owner-overlap) final classifications and rationales
- Mechanical verification result: `bash full.sh` rule 1-4 + Rule 3 ENHANCED + NSD-14 + Rule 6 all green; Rule 5 deferred to Wave 2
- Wave 2 readiness signal: NSV-NN row inventory ready for verdict citation (Q1 anchors NSV-22/26/28/29/33/35; Q2 anchor NSV-16; Q3 anchors high-leverage missing/partial cells; Q4 anchors NSV-06/20)
</output>

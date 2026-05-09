# Phase 33b: Discovery North-Star Audit — Research

**Researched:** 2026-05-08
**Domain:** Product audit methodology (read-only, doc-only, single-deliverable)
**Confidence:** HIGH (every research finding sourced from Phase 33b CONTEXT.md, Phase 33's committed artifacts, ROADMAP.md, REQUIREMENTS.md, SEED-004, or directly verified file contents)

## Summary

Phase 33b is a **read-only, single-deliverable, zero-code product audit**. CONTEXT.md is unusually complete: 16 NSD-NN decisions inherit Phase 33's locked posture (D-12, D-15, D-16, D-17) and add a fixed 7-vector × 6-entity matrix (NSD-05 / NSD-07), strict partial/missing definition (NSD-04), worst-case viewer-state aggregation (NSD-06), 3-input leverage rubric (NSD-09), 6-rule pinned pass/fail (NSD-15), and a final-§ decisions block (NSD-16). The author's job is **mechanical execution against the locked spec**, not new methodology design. The 42-cell matrix is small enough that authorial drift across rows is the dominant failure mode, not coverage.

Phase 33's `33-DISCOVERY-AUDIT.md` ships **136 rows** (DISC-AUDIT-01 through DISC-AUDIT-136) with `viewer_state` and `tag` columns that map cleanly to Phase 33b's needs. CONTEXT.md `<specifics>` already pre-anchors **10 rows** (DISC-AUDIT-29, 49, 81, 82, 97, 102, 111, 122, 123, 124, 127, 129, 130, 131; plus DISC-AUDIT-99 as judgment-call partial). Backing-row coverage is rich, especially for Collector Profile (8 of 10 pre-anchored Missing rows live there).

**Primary recommendation:** Author this phase as **3 plans** (Wave 0 scaffold + skeleton; Wave 1 cell population + leverage scoring; Wave 2 decisions + closeout) with bash `checks/full.sh` enforcing the 6 NSD-15 rules mechanically. **Treat the matrix size (42 cells) as the work unit, not the file count.** Don't split per-entity — the cross-entity asymmetry comparison (NSD-02 rationale) is the audit's signal and should be authored in one pass for voice consistency. The hardest cell-scoring judgments cluster on `same-family/lineage` and `same-era` (no PROD anchor; CAT-13 / Phase 35 / Phase 38 planned) — flag these for author attention up front.

## User Constraints (from CONTEXT.md)

### Locked Decisions

> Verbatim from `.planning/phases/33b-discovery-north-star-audit/33b-CONTEXT.md` `<decisions>` (NSD-01 through NSD-16). Reproduced in full because every NSD shapes the audit doc's content; the planner MUST not relitigate any of these.

#### Carried forward from Phase 33 (locked — do NOT re-litigate)

- **Phase 33 D-12 — single Rdio rubric:** SEED-004 line 15 quote is the ONLY anchor for missing rows. No alternative anchors permitted. Phase 33b inherits.
- **Phase 33 D-15 — single-file format:** All decisions inline in the audit doc (final §), not a separate decisions file. Phase 33b inherits.
- **Phase 33 D-16 — verdict template:** Verdict + 2–4 sentence rationale + cited rows + downstream-phase impact line. Phase 33b inherits and extends to cite NSV-NN AND DISC-AUDIT-NN rows.
- **Phase 33 D-17 — exactly 4 decisions:** Q1 combine home+explore; Q2 lineage browse priority; Q3 dead-end closure priority; Q4 CAT-13 discovery framing. No 5th catch-all. Phase 33b inherits.
- **Phase 33 audit immutability:** `33-DISCOVERY-AUDIT.md` is the research substrate; Phase 33b reads but does not modify it. Cross-references travel via DISC-AUDIT-NN row ID cites only.

#### Drift-vector enumeration method (Area 1)

- **NSD-01:** Hybrid Rdio→DISC-AUDIT method (top-down universe + bottom-up grounding via Phase 33's 136 rows).
- **NSD-02:** Fixed canonical taxonomy applied uniformly to every entity (no per-entity bespoke vector lists).
- **NSD-03:** Score every (entity × vector) cell, including obvious N-A. Full 6×7 = **42 rows exactly**.
- **NSD-04:** Strict observable line for partial vs missing. **Partial** = vector visible (name/list/label) but not clickable. **Missing** = no surface-level acknowledgment (no label, no list, no data anchor).

#### Entity granularity & viewer-state (Area 2)

- **NSD-05:** 6 entity blocks: (1) Watch Detail `/watch/{id}`, (2) Collector Profile `/u/{user}` (all 7 tabs as one entity), (3) Catalog `/catalog/{id}` (folds in `/family/{id}` as missing-vector candidates), (4) Home Feed `/`, (5) Explore Feed `/explore`, (6) Search Results `/search` (all 4 tabs as one entity).
- **NSD-06:** Worst-case viewer-state aggregation per cell (no row doubling for owner-populated vs fresh-account; cite DISC-AUDIT row whose `viewer_state` column carries the worst-case evidence).
- **NSD-07:** 7-vector canonical taxonomy (locked):
  | Vector | One-line definition | PROD or planned anchor |
  |--------|---------------------|------------------------|
  | `similar-by-taste` | walk to watches similar in style/role/taste to this one | `analyzeSimilarity()` (PROD); CAT-13 catalog taste columns post-Phase 38 |
  | `same-family/lineage` | walk to watches in the same family or sharing a lineage edge | CAT-15 brands/families (Phase 34); CAT-16 lineage edges (Phase 35) |
  | `same-era` | walk to watches from the same era / generation | `era_signal` column (Phase 19.1 LLM-derived; CAT-13 reads it post-Phase 38) |
  | `other-owners` | walk to other collectors who own / wishlist this watch | cross-collector graph (PROD via /catalog catalog-page collector list) |
  | `owner-overlap` | walk to overlap with this collector — shared taste / shared collection | common-ground (PROD `/u/{user}/common-ground`) |
  | `evaluative-verdict` | "does this fit my collection" answer for the viewer | Collection Fit verdict (PROD `/watch`, `/catalog`, search inline-expand) |
  | `see-more-like-this` | walk to a paginated rail/feed of more affordances like this one | trending/popular/gaining-traction rails (PROD `/explore`); recommender layer (SEED-002 future) |
- **NSD-08:** Pinned vector definition table at top of audit doc (before any entity block).

#### Rdio leverage scoring rubric (Area 3)

- **NSD-09:** Single 3-input rubric for high/medium/low: (1) cited principle violation; (2) downstream-phase impact; (3) collector-frequency judgment. Each scored cell's rationale explicitly cites which inputs are present.
- **NSD-10:** Score leverage on BOTH missing AND partial cells. N-A and ship cells stay unscored (`—`).
- **NSD-11:** Pinned leverage-bucket key at top:
  - **high** — gates a v5.0 phase AND violates SEED-004 directly AND collector frequently encounters
  - **medium** — gates a v5.x phase OR violates SEED-004 directly OR collector frequently encounters (not all three)
  - **low** — none of the above; theoretical Rdio drift, DEFERRED beyond v5.x
- **NSD-12:** No hard rule mapping leverage → verdict. Leverage informs verdict rationale; verdict still allows authorial judgment.

#### Artifact format & decisions wiring (Area 4)

- **NSD-13:** Single flat 7-column drift-vector table covering full 42-cell matrix. Columns: `row_id` (NSV-NN) | `entity` | `vector` | `status` | `leverage` | `rationale` | `backing_rows`.
- **NSD-14:** Row ID format `NSV-NN` flat sequential, zero-padded. NSV-01..NSV-42.
- **NSD-15:** 6-rule pinned pass/fail criteria (audit passes IFF ALL 6 hold):
  1. 42 cells, no skipped (entity × vector) pairs.
  2. Every missing AND partial cell carries leverage tag (high/med/low).
  3. Every missing AND partial cell cites ≥1 DISC-AUDIT-NN backing row (— allowed only with explicit rationale for absence).
  4. Every missing cell's `rationale` cites SEED-004 line 15 violation explicitly (`Rdio violation: …` or `SEED-004: …` syntax).
  5. All 4 D-17 decisions in final § have YES/NO/DEFERRED + 2–4 sentence rationale citing ≥1 NSV-NN row AND ≥1 DISC-AUDIT-NN backing row + downstream-phase impact line.
  6. Zero code/schema/dependency changes; zero modifications to `33-DISCOVERY-AUDIT.md` (verified by `git diff 33-DISCOVERY-AUDIT.md` returning empty).
- **NSD-16:** Final § with 4 D-17 decisions sequenced Q1→Q4. Per-decision template:
  ```markdown
  ### Decision Q1: Combine home and explore?
  **Verdict:** YES | NO | DEFERRED
  **Rationale:** [2–4 sentences citing audit findings]
  **Cited NSV rows:** NSV-NN, NSV-MM, ...
  **Backing DISC-AUDIT rows:** DISC-AUDIT-NN, DISC-AUDIT-MM, ...
  **Drives:** [downstream phase / item this verdict gates]
  ```

### Claude's Discretion

User selected the recommended option on every question across all 4 areas. **Zero free-discretion areas exist for Phase 33b.** All 16 NSD decisions are user-confirmed selections; the planner has no scope to introduce alternatives or add 17th decision.

### Deferred Ideas (OUT OF SCOPE)

> Verbatim from CONTEXT.md `<deferred>`. Plan must NOT introduce any of these.

- **Per-viewer-state separate entity blocks** — folded into NSD-06 worst-case aggregation.
- **`/family/{id}` as its own entity block** — folded into Catalog as missing-vector candidates per NSD-05.
- **9+ vector taxonomy** (temporal-recent + price-tier-adjacent) — dropped per NSD-07.
- **5th catch-all D-17 decision** — Phase 33 D-17 capped at 4; NSD-16 inherits.
- **Numeric leverage rubric** (frequency × severity × alignment) — dropped per NSD-09.
- **Hard rule mapping leverage → verdict** — dropped per NSD-12.
- **Interleaved decisions per entity** — dropped per NSD-16 (final § only).
- **`checks/full.sh` + `checks/quick.sh` parallel to Phase 33** — explicitly LEFT as planning-time decision; planner may decide either way (recommended in this RESEARCH per Validation Architecture §).
- **Score `ship` cells for leverage** — dropped per NSD-10.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **DISC-12** | Per-entity drift-vector enumeration tagged ship/partial/missing with Rdio leverage scoring + 4 D-17 verdicts citing NSV-NN AND DISC-AUDIT-NN rows | This research locks 42-cell matrix structure (NSD-03/13/14), enumerates the 10 pre-anchored Missing/Partial rows from CONTEXT.md `<specifics>`, identifies cell-scoring risk areas (vectors with no PROD anchor; viewer-state asymmetry), pre-computes the 6 entity × 7 vector intersection map below for the planner |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Audit document authoring | Documentation (markdown in `.planning/`) | — | Phase produces ONE markdown deliverable; zero code changes per NSD-15 rule 6 |
| Mechanical pass/fail enforcement | Bash scripts under `.planning/phases/33b-discovery-north-star-audit/checks/` | — | Mirrors Phase 33's `checks/quick.sh` + `full.sh` pattern; bash + grep + awk only (no test framework install) |
| Cross-reference integrity | DISC-AUDIT-NN cite syntax in `backing_rows` column | NSV-NN cite syntax in decisions § | Both audits coexist; downstream phases grep both ID formats; format consistency is audit-immutability gate |
| Reading Phase 33 substrate | Filesystem read-only (`33-DISCOVERY-AUDIT.md`) | — | NSD-15 rule 6: zero modifications to Phase 33's table — verified by `git diff` returning empty |

**Why this matters:** Doc-only phases have no application-tier risk, but they have a **citation-tier risk**: bad cites (non-existent DISC-AUDIT-NN ids, broken NSV-NN sequencing) silently corrupt downstream phase plans that grep against these ids. Place mechanical cite-validation in `checks/full.sh` from Wave 0; the matrix author will mis-cite at least once during 42-cell population, and catching it early is cheap.

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| markdown | n/a | Audit deliverable format | Locked by NSD-13 (single flat table) and Phase 33 precedent |
| bash + grep + awk | system | `checks/full.sh` mechanical NSD-15 rule enforcement | Phase 33's `33-discovery-audit/checks/full.sh` is the proven pattern — no framework install, ~3 second runtime |
| git | system | Verify audit immutability via `git diff 33-DISCOVERY-AUDIT.md` returns empty | NSD-15 rule 6 enforcement |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `rg` (ripgrep) | system | Cross-reference DISC-AUDIT-NN ids against Phase 33's table during cell population | Each cell's `backing_rows` entry must resolve to an extant row; ripgrep against `33-DISCOVERY-AUDIT.md` confirms before committing |

**No new dependencies.** Per NSD-15 rule 6 zero dependency changes ship.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bash `checks/` scripts | Inline manual review only | Manual review fails on the 42nd cell — author drift is the dominant failure mode; the marginal cost of writing the validator (~150 LOC, modeled on Phase 33's full.sh) is dominated by the value of catching mis-cites in Wave 1 |
| Single audit file | Per-entity audit files | NSD-13 explicitly locks single flat table; per-entity fragments break grep semantics for downstream cites |

## Architecture Patterns

### System Architecture Diagram

```
                        Phase 33b Audit Authoring Pipeline
                        ===================================

   ┌─────────────────────────┐         ┌──────────────────────────────┐
   │ SEED-004 line 15 quote  │         │ 33-DISCOVERY-AUDIT.md (136   │
   │ (Rdio principle)        │         │ rows, IMMUTABLE per NSD-15)  │
   └─────────────┬───────────┘         └──────────────┬───────────────┘
                 │ top-down                           │ bottom-up
                 │ canonical                          │ empirical
                 │ taxonomy                           │ grounding
                 ▼                                    ▼
        ┌────────────────────────────────────────────────────┐
        │ NSD-01 hybrid method                                │
        │ Per (entity × vector) cell:                         │
        │  1. Apply NSD-04 strict partial/missing definition  │
        │  2. Worst-case viewer-state per NSD-06              │
        │  3. Cite DISC-AUDIT-NN row(s) in backing_rows       │
        │  4. If missing: cite SEED-004 violation             │
        │  5. If missing/partial: score leverage per NSD-09   │
        └────────────────────────┬───────────────────────────┘
                                 │ produces 42 cells
                                 ▼
        ┌────────────────────────────────────────────────────┐
        │ 33b-DISCOVERY-NORTH-STAR-AUDIT.md (single file)     │
        │  ├─ Pass/Fail Criteria § (NSD-15 6 rules; AT TOP)   │
        │  ├─ Rdio Principle Anchor § (SEED-004 quote)        │
        │  ├─ Vector Definition Table § (NSD-08; 7 vectors)   │
        │  ├─ Leverage Bucket Key § (NSD-11; high/med/low)    │
        │  ├─ Drift-Vector Audit Table (42 NSV-NN rows)       │
        │  └─ Decisions § (Q1→Q4; NSD-16 template)            │
        └────────────────────────┬───────────────────────────┘
                                 │
                                 ▼
        ┌────────────────────────────────────────────────────┐
        │ checks/full.sh enforces NSD-15 rules 1-6            │
        │ + NSD-14 NSV-NN sequencing (no gaps, no dupes)      │
        └────────────────────────────────────────────────────┘
                                 │
                                 ▼ committed
        ┌────────────────────────────────────────────────────┐
        │ Downstream consumers:                               │
        │  - Phase 34 (dependency-gating verdict)             │
        │  - Phase 35 (Q2 lineage browse UI scope)            │
        │  - Phase 38 (Q4 CAT-13 framing)                     │
        │  - Phase 39 (Q3 polish ordering + missing-vector    │
        │              leverage-tagged backlog)               │
        └────────────────────────────────────────────────────┘
```

### Recommended Phase Directory Layout

```
.planning/phases/33b-discovery-north-star-audit/
├── 33b-CONTEXT.md                    # already exists
├── 33b-DISCUSSION-LOG.md             # already exists
├── 33b-RESEARCH.md                   # this file
├── 33b-PATTERNS.md                   # planner-authored (optional; mirror Phase 33)
├── 33b-DISCOVERY-NORTH-STAR-AUDIT.md # the deliverable
├── 33b-VALIDATION.md                 # nyquist contract for the doc phase
├── 33b-NN-PLAN.md                    # plans authored by /gsd-plan-phase
├── 33b-NN-SUMMARY.md                 # generated by /gsd-summarize after each plan
└── checks/
    ├── quick.sh                      # file exists, headings, table header, NSV-NN row count
    └── full.sh                       # quick.sh + NSD-15 rules 1-6 + NSD-14 sequencing
```

### Pattern 1: 6×7 Cell Population by Block

**What:** Author the 42 NSV-NN rows in entity-block order (Watch Detail → Collector Profile → Catalog → Home Feed → Explore Feed → Search Results), 7 cells per block, sequencing NSV-01 through NSV-42 left-to-right (vector order locked: similar-by-taste, same-family/lineage, same-era, other-owners, owner-overlap, evaluative-verdict, see-more-like-this).

**When to use:** This is the only practical authoring order for the locked 42-cell matrix. Do NOT author by vector first (vector × 6 entities) — cross-entity comparison is the audit's signal but author voice consistency is per-entity.

**Example row template (markdown):**

```markdown
| NSV-08 | Collector Profile | similar-by-taste | missing | high | Rdio violation: insights cards list "sleeping beauty" / "good deal" watches without click affordance — viewer cannot drift from named watch to the watch's own surface; SEED-004 line 15 dead-end (frequent encounter for owner viewing own insights tab; gates Phase 39 polish; high leverage). | DISC-AUDIT-129 |
```

### Pattern 2: Worst-Case Viewer-State Aggregation (NSD-06)

**What:** When a cell's status diverges between owner-populated and fresh-account viewers, the cell takes the WORST status observed in Phase 33's table.

**When to use:** Every cell on Watch Detail and Catalog (G-4 / G-6 verdict suppression branches); every locked tab on Collector Profile (G-8 / G-9 / G-10 / G-11 LockedTabCard branches); the Home Feed sections gated on follower count (G-2-equivalent).

**Example:**

- **Watch Detail × evaluative-verdict** — owner-populated state: ships (DISC-AUDIT-81 verdict badge); fresh-account state: missing (DISC-AUDIT-131 verdict suppressed). **Worst case: partial** (visible to owner-populated but suppressed for fresh-account ⇒ visible-but-not-universal ⇒ classify as `partial` per NSD-04 strict line). Cite both DISC-AUDIT-81 and DISC-AUDIT-131 in `backing_rows`.

> **Author judgment call:** NSD-04 defines partial as "visible but not clickable" within a single viewer state, but NSD-06 says "worst case across viewer states." When viewer-state is the source of divergence (owner sees full; fresh-account sees nothing), the precedent from CONTEXT.md `<specifics>` says **classify as partial** with rationale "viewer-gated — fresh-account suppression branch" (see DISC-AUDIT-81 partial example in `<specifics>` line 216). The planner should commit this convention up front so the 42-cell author doesn't drift between cells.

### Pattern 3: Mechanical Pass/Fail Enforcement (NSD-15)

**What:** A `checks/full.sh` script in the phase directory that reads `33b-DISCOVERY-NORTH-STAR-AUDIT.md` and enforces NSD-15 rules 1–6 + NSD-14 sequencing, exiting non-zero on any failure.

**Example checks (concrete):**

```bash
# Rule 1: 42 cells, no skipped (entity × vector) pairs
ROWS=$(grep -c '^| NSV-' "$AUDIT")
test "$ROWS" -eq 42 || { echo "[fail] NSD-15 rule 1: expected 42 rows; found $ROWS"; exit 1; }

# Rule 2: every missing OR partial cell has leverage tag in {high, med, low}
LEVERAGE_BAD=$(awk -F'\\|' '/^\| NSV-/ {
  st=$5; gsub(/^ | $/, "", st);
  lv=$6; gsub(/^ | $/, "", lv);
  if ((st == "missing" || st == "partial") && lv !~ /^(high|med|low)$/) print $2
}' "$AUDIT")
test -z "$LEVERAGE_BAD" || { echo "[fail] NSD-15 rule 2: missing/partial without leverage: $LEVERAGE_BAD"; exit 1; }

# Rule 3: every missing OR partial cell cites ≥1 DISC-AUDIT-NN in backing_rows
CITE_BAD=$(awk -F'\\|' '/^\| NSV-/ {
  st=$5; gsub(/^ | $/, "", st);
  br=$8; gsub(/^ | $/, "", br);
  if ((st == "missing" || st == "partial") && br !~ /DISC-AUDIT-[0-9]+/ && br !~ /^—/) print $2
}' "$AUDIT")
test -z "$CITE_BAD" || { echo "[fail] NSD-15 rule 3: missing/partial without DISC-AUDIT cite: $CITE_BAD"; exit 1; }

# Rule 4: every missing cell's rationale cites SEED-004 or 'Rdio violation:'
RATIONALE_BAD=$(awk -F'\\|' '/^\| NSV-/ {
  st=$5; gsub(/^ | $/, "", st);
  rt=$7; gsub(/^ | $/, "", rt);
  if (st == "missing" && rt !~ /(Rdio violation:|SEED-004)/) print $2
}' "$AUDIT")
test -z "$RATIONALE_BAD" || { echo "[fail] NSD-15 rule 4: missing without SEED-004 cite: $RATIONALE_BAD"; exit 1; }

# Rule 5: 4 verdicts, each cites ≥1 NSV-NN AND ≥1 DISC-AUDIT-NN
VERDICTS=$(grep -c '^\*\*Verdict:\*\*' "$AUDIT")
test "$VERDICTS" -eq 4 || { echo "[fail] NSD-15 rule 5a: expected 4 verdicts; found $VERDICTS"; exit 1; }
NSV_LINES=$(grep -c '^\*\*Cited NSV rows:\*\*' "$AUDIT")
DISC_LINES=$(grep -c '^\*\*Backing DISC-AUDIT rows:\*\*' "$AUDIT")
test "$NSV_LINES" -eq 4 -a "$DISC_LINES" -eq 4 || { echo "[fail] NSD-15 rule 5b/c: missing cite lines"; exit 1; }

# Rule 6: zero modifications to 33-DISCOVERY-AUDIT.md
DIFF=$(git diff -- .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md)
test -z "$DIFF" || { echo "[fail] NSD-15 rule 6: 33-DISCOVERY-AUDIT.md modified (immutability violation)"; exit 1; }

# NSD-14 sequencing: NSV-01 through NSV-42, no gaps, no dupes
IDS=$(grep -oE '^\| NSV-[0-9]+' "$AUDIT" | sed 's/| NSV-//' | sort -n)
DUPES=$(echo "$IDS" | uniq -d)
test -z "$DUPES" || { echo "[fail] NSD-14: duplicate NSV-NN: $DUPES"; exit 1; }
COUNT=$(echo "$IDS" | wc -l | tr -d ' ')
FIRST=$(echo "$IDS" | head -1)
LAST=$(echo "$IDS" | tail -1)
EXPECTED=$((LAST - FIRST + 1))
test "$COUNT" -eq "$EXPECTED" -a "$FIRST" = "1" -a "$LAST" = "42" || { echo "[fail] NSD-14: NSV sequencing wrong"; exit 1; }
```

### Anti-Patterns to Avoid

- **Per-vector authoring order:** Don't fill all 6 cells of `similar-by-taste` first. Voice consistency demands per-entity authoring.
- **Per-entity narrative wrapping:** Don't wrap the 7 cells of an entity in narrative prose. NSD-13 locks single flat table — narrative would force per-entity sections that fragment downstream cite syntax.
- **Recommendation drift:** This is an AUDIT, not a recommendation document. Each cell describes WHAT exists / what's missing / leverage; it does NOT propose how to fix. Fixes are Phase 39 territory cited via NSV-NN.
- **5th decision creep:** When the audit surfaces cross-phase implications, those flow through cell leverage scores or NSV-NN cites in existing decision rationales, NOT through a 5th catch-all decision (NSD-16 explicitly inherits Phase 33 D-17).
- **Missing-cell with `backing_rows: —`:** NSD-15 rule 3 explicitly allows `—` only with rationale for the absence. Authoring shortcut "no Phase 33 row exists for this missing vector, so I'll skip the cite" violates rule 3. The hybrid NSD-01 method (top-down) means some missing vectors may have no DISC-AUDIT counterpart — but the rationale must explicitly say so (e.g., "no Phase 33 row covers `same-era` walk-back affordance because it's a v5.0-roadmap planned anchor not yet shipped").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pass/fail enforcement | Custom Python validator | Bash + grep + awk modeled on Phase 33's `checks/full.sh` | Phase 33 already proved this works in ~3 seconds with zero deps; copying its pattern is the cheapest route |
| NSV-NN ↔ DISC-AUDIT-NN cross-ref check | Manual review during wave merge | Mechanical `awk` over `backing_rows` column + `grep` against Phase 33's table | Manual review fails on cell #20+ |
| 6×7 matrix completeness check | Eyeball the table for gaps | `awk` per-entity counter (each of 6 entities × 7 vectors == 42 rows total) | Author drift across 42 cells is the dominant failure; mechanical check eliminates it |
| Per-cell leverage rubric application | Free-form judgment per cell | Pinned NSD-11 key at top of audit doc + 3-input rubric NSD-09 cited in each rationale | Without pinned rubric, leverage scores drift across rows and the pass/fail rule 2 becomes meaningless |
| Decision verdict rationale construction | Author each Q1–Q4 verdict freehand | Use the NSD-16 template VERBATIM with all 5 fields (Verdict / Rationale / Cited NSV rows / Backing DISC-AUDIT rows / Drives) | Missing fields silently break downstream phases that grep specific labels (e.g., Phase 39 plan greps `**Drives:**`) |

**Key insight:** This is a structural authoring problem, not a content authoring problem. The structural lock-down (16 NSDs) leaves the planner with content judgment in only 2 places: (a) cell statuses for the 32 non-pre-anchored cells, and (b) the 4 verdict YES/NO/DEFERRED choices. Everything else is mechanical.

## Runtime State Inventory

**This phase has zero runtime state.** It produces one markdown deliverable. No data migrations, no service config, no OS state, no env vars, no build artifacts.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by NSD-15 rule 6 (zero schema changes) | None |
| Live service config | None — no service touched | None |
| OS-registered state | None — no daemons, schedulers, or task entries | None |
| Secrets/env vars | None — audit reads no env-gated functionality (the audit does NOT execute the app) | None |
| Build artifacts | None — no `package.json`, `tsconfig.json`, `next.config.ts`, or any config touched | None |

**Per CONTEXT.md `<code_context>` line 192-193:** "No code integration: Zero changes to `src/`, `tests/`, `db/`, `package.json`, `next.config.ts`, `tsconfig.json`, or any config file. The phase commits only into `.planning/phases/33b-discovery-north-star-audit/`."

## Phase 33 Substrate Inventory (DISC-AUDIT-NN row analysis)

> Detailed read of Phase 33's `33-DISCOVERY-AUDIT.md` to characterize what's available as `backing_rows` content.

### Row count and id range

- **Total rows:** 136 rows (verified by `grep -c '^| DISC-AUDIT-' 33-DISCOVERY-AUDIT.md`)
- **ID format:** `DISC-AUDIT-NN` (zero-padded to 2 digits when N<10; uses 3 digits naturally for N≥100, e.g., DISC-AUDIT-130). Per Phase 33 D-09.
- **ID range:** DISC-AUDIT-01 through DISC-AUDIT-136. Phase 33's `full.sh` enforces sequential, no-gaps, no-dupes.
- **Rows added by viewer-state row-splits (Pass B):** DISC-AUDIT-130, 131, 132, 133, 134, 135, 136 — 7 rows that capture fresh-account counterparts to owner-populated rows. These are critical evidence anchors for NSD-06 worst-case aggregation.

### Tag distribution

- **Live:** ~125 rows (the dominant tag)
- **Redundant:** 2 rows (DISC-AUDIT-53 GainingTractionWatches "See all" → /explore/watches Redundant to DISC-AUDIT-51; DISC-AUDIT-126 CommonGroundHeroBand "See full comparison" Redundant to DISC-AUDIT-84)
- **Dead:** 1 row (DISC-AUDIT-99 wishlist drag silent no-op WR-07 pattern)
- **Missing:** 8 rows (DISC-AUDIT-97, 102, 111, 122, 123, 124, 127, 129, 130, 131 — wait, let me recount):
  - DISC-AUDIT-97 — Collector Profile / collection LockedTabCard no Connect CTA
  - DISC-AUDIT-102 — Collector Profile / wishlist LockedTabCard no Connect CTA
  - DISC-AUDIT-111 — Collector Profile / worn calendar day-cell no onClick
  - DISC-AUDIT-122 — Collector Profile / notes LockedTabCard no Connect CTA
  - DISC-AUDIT-123 — Collector Profile / stats rows non-clickable
  - DISC-AUDIT-124 — Collector Profile / stats LockedTabCard no Connect CTA
  - DISC-AUDIT-127 — Collector Profile / common-ground 404 fallback no walk-back
  - DISC-AUDIT-129 — Collector Profile / insights cards no Link
  - DISC-AUDIT-130 — Catalog page no walk-to-family affordance + verdict suppression for fresh-account
  - DISC-AUDIT-131 — Watch Detail verdict suppressed for fresh-account
  - **Total: 10 Missing rows** (matching CONTEXT.md `<specifics>` pre-anchor list).

### Viewer-state column distribution

- **`owner-populated`:** ~75 rows (the dominant case; affordance INTENDED for populated state)
- **`fresh-account`:** ~10 rows (verdict suppression, locked tab, sparse-network hero)
- **`N/A`:** ~50 rows (Header rows; modal controls; surface controls gate-independent of viewer state)

This distribution is **rich enough to back every cell**. Worst-case viewer-state aggregation (NSD-06) has explicit fresh-account counterpart rows for the major divergences (DISC-AUDIT-130 / 131 / 132 / 133 / 134 / 135 / 136).

### Surface column distribution (informs entity mapping)

| NSD-05 entity | Phase 33 surface(s) covered | Approximate row range |
|---------------|------------------------------|------------------------|
| Watch Detail | `/watch/{id}` | DISC-AUDIT-76..83, 131 (~9 rows) |
| Collector Profile | `/u/{user}/{tab}` for all 7 tabs (collection, wishlist, worn, notes, stats, common-ground, insights) | DISC-AUDIT-84..129, 132..136 (~52 rows) |
| Catalog | `/catalog/{catalogId}` | DISC-AUDIT-70..75, 130 (~7 rows) |
| Home Feed | `/` | DISC-AUDIT-21..46 (~26 rows) |
| Explore Feed | `/explore` | DISC-AUDIT-47..56 (~10 rows) |
| Search Results | `/search` | DISC-AUDIT-57..69 (~13 rows) |
| Header (NSD-05 folds Header into all entities as click-target affordances) | DISC-AUDIT-01..20 (~20 rows; do NOT cite as entity-specific backing) |

**Authoring guidance:** When citing `backing_rows` for a cell, prefer the most surface-specific row (e.g., for Watch Detail × similar-by-taste, cite DISC-AUDIT-82 not DISC-AUDIT-71 even though both describe the same `mostSimilar` text-only pattern, because the entity match is exact). Header rows (DISC-AUDIT-01..20) should be cited only for cells where Header click-targets are the relevant evidence (rare in practice — none of the 7 vectors map naturally to Header).

### Pre-anchored cell map (from CONTEXT.md `<specifics>` lines 200-219)

| Pre-anchored Cell | Phase 33 backing | Status (NSD-04) | Leverage hint |
|---|---|---|---|
| Watch Detail × similar-by-taste | DISC-AUDIT-82 (mostSimilar text-only) | **partial** (visible, not clickable) | high (cheapest Phase 39 win — text→Link one-line patch) |
| Watch Detail × evaluative-verdict | DISC-AUDIT-81 (owner-populated) + DISC-AUDIT-131 (fresh-account suppressed) | **partial** (worst-case viewer aggregation per NSD-06) | high (Q4 anchor; gates Phase 38 framing) |
| Catalog × same-family/lineage | DISC-AUDIT-130 | **missing** | high or med (Q2 anchor; gates Phase 35 UI scope) |
| Collector Profile × similar-by-taste | DISC-AUDIT-129 (insights cards no Link) | **missing** | high (frequent owner-collector encounter; cheap Phase 39 win) |
| Collector Profile × see-more-like-this | DISC-AUDIT-97, 102, 122, 123, 124 (locked tabs no CTA) + DISC-AUDIT-111 (calendar day no onClick) + DISC-AUDIT-127 (common-ground 404) | **missing** (the dominant Q3 dead-end cluster) | mixed — locked-tab CTAs may rate medium (fresh-account-only encounter); 111 + 127 high (universal encounter) |
| Home Feed × similar-by-taste | DISC-AUDIT-29 (CollectorsLikeYou RecommendationCard Link) | **ship** | — |
| Explore Feed × other-owners | DISC-AUDIT-49 (PopularCollectorRow whole-row Link) | **ship** | — |
| Collector Profile × see-more-like-this | DISC-AUDIT-99 (wishlist drag silent no-op) | **judgment call**: WR-07 row in Phase 33 is `Dead` (drag affordance wired but broken); for Phase 33b the affordance EXISTS so could classify as `partial` (wired, broken) — author judgment | medium (only owner-populated drag affordance affected; not a discovery dead-end per se) |

**Leftover cells needing fresh population (non-pre-anchored): 32 cells.** This is the bulk of authoring work.

## Cell-Population Pre-Computation: 6 × 7 Matrix Map

> **Critical: planner read this carefully.** This pre-computes every (entity × vector) intersection so the cell author does not relitigate from scratch. Status estimates are RESEARCH-ASSUMED and require author confirmation against Phase 33 rows; treat as starting points not final answers.

### Watch Detail × {7 vectors}

| Vector | Estimated status | Likely DISC-AUDIT cite | Notes |
|--------|------------------|------------------------|-------|
| similar-by-taste | partial | DISC-AUDIT-82 | text-only mostSimilar list; one-line Link patch |
| same-family/lineage | missing | none specific (Phase 33 didn't enumerate Missing rows for non-shipped vectors) | RESEARCH-ASSUMED: Phase 33 enumerated Missing rows only where the gate creates a dead-end; absence-of-vector cells need explicit "no Phase 33 row" rationale per NSD-15 rule 3 |
| same-era | missing | none specific | Same as above |
| other-owners | missing | none specific | RESEARCH-ASSUMED: /watch shows only viewer's verdict, not other-owner roster (cross-collector graph lives on /catalog) |
| owner-overlap | N-A | — | /watch is per-user-watch — owner-overlap doesn't apply at this entity level (would apply if anyone could view another user's /watch — verify against Phase 33 rows: DISC-AUDIT-76..83 confirm /watch supports cross-user framing per Phase 20 D-08). **Author judgment: may upgrade to missing if cross-user framing on /watch is meaningful.** |
| evaluative-verdict | partial | DISC-AUDIT-81 + DISC-AUDIT-131 | owner-populated ships; fresh-account suppressed → partial via NSD-06 |
| see-more-like-this | missing | none specific | RESEARCH-ASSUMED: no rail/feed of "more watches like this" on /watch; Phase 39 candidate |

### Collector Profile × {7 vectors}

| Vector | Estimated status | Likely DISC-AUDIT cite | Notes |
|--------|------------------|------------------------|-------|
| similar-by-taste | missing | DISC-AUDIT-129 | insights tab cards no Link |
| same-family/lineage | missing | none specific | RESEARCH-ASSUMED: profile tabs show watches without family-walk affordances |
| same-era | missing | none specific | Same as above |
| other-owners | N-A | — | Profile IS the collector entity; "other-owners" of this collector doesn't make sense |
| owner-overlap | ship (or partial) | DISC-AUDIT-125, 126 (common-ground tab + hero band) | partial if locked tabs hide common-ground for fresh-account viewer |
| evaluative-verdict | N-A | — | Profile shows owner's collection, not viewer-evaluative against viewer's own collection (the verdict surface lives on /watch and /catalog) |
| see-more-like-this | missing | DISC-AUDIT-97, 102, 111, 122, 123, 124, 127 (cluster of dead-ends) | The dominant Q3 anchor; mix of locked-tab no-CTA, 404 no-walk-back, calendar day-cell no-onClick |

### Catalog × {7 vectors}

| Vector | Estimated status | Likely DISC-AUDIT cite | Notes |
|--------|------------------|------------------------|-------|
| similar-by-taste | partial | DISC-AUDIT-71 | Same text-only mostSimilar pattern as /watch |
| same-family/lineage | missing | DISC-AUDIT-130 | Q2 anchor; no walk-to-family affordance |
| same-era | missing | none specific | RESEARCH-ASSUMED: Phase 19.1 era_signal exists in catalog but no surface affordance to walk to other-era catalog refs |
| other-owners | likely ship or partial | DISC-AUDIT-72 ("You own this" callout) | Catalog page shows ownership context for viewer, but does it show OTHER owners? **Author must verify against /catalog page render in DISC-AUDIT-70..75; CONTEXT.md NSD-07 PROD anchor hint suggests "/catalog catalog-page collector list" exists** |
| owner-overlap | N-A | — | Catalog is the canonical reference, not collector-scoped |
| evaluative-verdict | partial | DISC-AUDIT-70 + DISC-AUDIT-130 | owner-populated ships; fresh-account suppressed → partial via NSD-06 |
| see-more-like-this | missing | none specific | RESEARCH-ASSUMED: no "more catalog refs like this" rail; Phase 39 candidate |

### Home Feed × {7 vectors}

| Vector | Estimated status | Likely DISC-AUDIT cite | Notes |
|--------|------------------|------------------------|-------|
| similar-by-taste | ship | DISC-AUDIT-29 (CollectorsLikeYou) | rec engine signal-driven |
| same-family/lineage | missing | none specific | Home doesn't surface family-level drift |
| same-era | missing | none specific | Same as above |
| other-owners | partial or ship | DISC-AUDIT-30, 32, 39 (NetworkActivityFeed + SuggestedCollectors) | Network-rail derivative is "other collectors", not strictly other-owners-of-a-watch — author judgment |
| owner-overlap | missing | DISC-AUDIT-38 (CommonGroundFollowerCard) | partial if card present but feed-level is missing |
| evaluative-verdict | missing | none specific | No verdict rendered on home; verdict is /watch + /catalog territory |
| see-more-like-this | partial or ship | DISC-AUDIT-33 (Load more), 35-37 (PersonalInsightsGrid) | various rails support pagination |

### Explore Feed × {7 vectors}

| Vector | Estimated status | Likely DISC-AUDIT cite | Notes |
|--------|------------------|------------------------|-------|
| similar-by-taste | missing | none specific | /explore is raw-popularity, not personalized (per SEED-004 line 36) |
| same-family/lineage | missing | none specific | No family rail |
| same-era | missing | none specific | No era rail |
| other-owners | ship | DISC-AUDIT-49 (PopularCollectorRow) | Direct surfacing of cross-collector graph |
| owner-overlap | missing | none specific | Common-ground is profile-scoped, not surfaced on /explore |
| evaluative-verdict | missing | none specific | No verdict on /explore rail items |
| see-more-like-this | ship | DISC-AUDIT-52, 54 (TrendingWatches + GainingTractionWatches DiscoveryWatchCard) | The defining /explore vector |

### Search Results × {7 vectors}

| Vector | Estimated status | Likely DISC-AUDIT cite | Notes |
|--------|------------------|------------------------|-------|
| similar-by-taste | missing | none specific | Search is keyword-match, not similarity-driven |
| same-family/lineage | missing | none specific | No family-aware search facet (SRCH-16 adds movement/case-size/style, not family) |
| same-era | missing | none specific | Same as above |
| other-owners | partial | DISC-AUDIT-60, 61 (PeopleSearchRow) | People-tab surfaces collectors; collection-tab surfaces collections; not specifically "other-owners-of-this-watch" — author judgment |
| owner-overlap | N-A | — | Search is keyword-driven, not collector-scoped overlap |
| evaluative-verdict | partial or ship | DISC-AUDIT-63, 64 (WatchSearchRow accordion verdict) | Verdict-on-expand exists; viewer-gated (collection.length > 0) → partial via NSD-06 |
| see-more-like-this | N-A | — | Author judgment per NSD-03; search results are query-driven, not "more like this" — N-A with rationale "search is keyword-driven not similarity-driven" |

**Total cell estimate by status (RESEARCH-ASSUMED — author MUST verify each against Phase 33 row):**

- ship: ~5 cells
- partial: ~8 cells
- missing: ~24 cells
- N-A: ~5 cells
- **Sum: 42 cells** ✓

**Implication for leverage scoring (NSD-10):** ~32 cells need leverage tags (8 partial + 24 missing). Author should batch leverage scoring as a separate authoring pass after status assignment to enforce NSD-09 3-input rubric consistency.

## Common Pitfalls

### Pitfall 1: Author Drift Across the 42-Cell Matrix

**What goes wrong:** Cell #1 applies NSD-04 strictly (visible-but-not-clickable = partial); Cell #20 applies it loosely (gated/degraded = partial); pass/fail rule 2 still passes because every missing/partial cell has a leverage tag, but the leverage scoring is now inconsistent across rows.

**Why it happens:** 42 cells × 6 entities × 7 vectors creates ~5–10 hours of authoring work. Rubric rigor erodes naturally over a long authoring session.

**How to avoid:** Author the matrix in 3 distinct passes:
1. **Pass 1: Status assignment.** Mechanically apply NSD-04 (partial vs missing) to every cell using the pre-computation table above. Don't write rationale yet.
2. **Pass 2: Backing-row citation.** For every missing/partial cell, find the DISC-AUDIT row(s) that anchor it. Use ripgrep against `33-DISCOVERY-AUDIT.md`.
3. **Pass 3: Rationale + leverage scoring.** Write rationale + leverage tag in one synchronized pass per cell, citing all 3 NSD-09 inputs explicitly.

This separation forces NSD-04 / NSD-09 application uniformly across cells.

**Warning signs:** Two cells in the same vector column scored differently for the same observable pattern (e.g., partial in Cell #2 but missing in Cell #16 for the same "list with no Link" symptom).

### Pitfall 2: Mis-citing DISC-AUDIT Row IDs

**What goes wrong:** `backing_rows: DISC-AUDIT-129` typo'd as `DISC-AUDIT-128` (off by one); the cited row exists but doesn't say what the cell rationale claims; downstream Phase 39 plan greps for `DISC-AUDIT-129` in 33b's audit and finds no hit, breaking the cite chain.

**Why it happens:** DISC-AUDIT-129 (insights cards no Link, Missing) and DISC-AUDIT-128 (insights cards owner-only, Live) are visually similar in the same neighborhood of Phase 33's table. Off-by-one is the single most common authoring error.

**How to avoid:**
- `checks/full.sh` rule: every DISC-AUDIT-NN cited in `backing_rows` MUST exist in `33-DISCOVERY-AUDIT.md` (mechanical grep verification).
- Author authoring tip: cite by paste, not retype. Open `33-DISCOVERY-AUDIT.md` side-by-side and copy the cell row, then strip everything but the id.

**Warning signs:** A cited DISC-AUDIT row's `tag` column doesn't match what the NSV cell rationale claims (e.g., NSV-08 rationale says "Missing per DISC-AUDIT-128" but DISC-AUDIT-128 is tagged Live).

### Pitfall 3: 5th-Decision Creep

**What goes wrong:** During Q3 authoring (dead-end closure priority), the author realizes there are 7+ high-leverage missing rows on Collector Profile alone and wants to add a Q5 "deprecate locked tabs" decision; this violates NSD-16 "exactly 4 decisions" inherited from Phase 33 D-17.

**Why it happens:** The audit naturally surfaces cross-cutting findings; the human inclination is to formalize each finding as a decision.

**How to avoid:** Cross-phase scope-change findings flow through:
1. NSV-NN cell leverage scores (high leverage on a cluster of cells signals Phase 39 backlog priority).
2. Existing decision rationales (Q3 rationale can call out the locked-tab cluster directly without needing a Q5).

`checks/full.sh` rule 5a enforces exactly 4 verdict lines; mechanical block.

**Warning signs:** Authoring a 5th decision header in the final §; rationale text that says "this is its own decision but I'm folding it into Q3."

### Pitfall 4: Recommendation Drift (audit becomes a plan)

**What goes wrong:** Cell rationale shifts from "describes what's missing" to "proposes how to fix" (e.g., "Missing — Phase 39 should add a Family pill at the top of /catalog with a Link to /family/{familyId}").

**Why it happens:** When the author thinks of a fix, the natural urge is to capture it. But fix proposals belong to Phase 39 / Phase 35 plans, not Phase 33b's audit.

**How to avoid:** Each cell's rationale is structured as: (a) WHAT is missing; (b) WHY it violates SEED-004; (c) WHICH 3-input rubric inputs justify the leverage. NEVER (d) HOW to fix. Fixes are downstream phases' problems and Phase 39 will cite NSV-NN ids to find them.

**Warning signs:** Rationale containing "should add", "should ship", "Phase 39 must", "the fix is".

### Pitfall 5: Skipping Worst-Case Viewer State (NSD-06)

**What goes wrong:** Watch Detail × evaluative-verdict scored as `ship` because DISC-AUDIT-81 ships the verdict for owner-populated viewers; the cell ignores DISC-AUDIT-131 fresh-account suppression branch.

**Why it happens:** Phase 33's table presents owner-populated rows first (DISC-AUDIT-81) and fresh-account counterparts later (DISC-AUDIT-131); the 7 viewer-state-divergence rows added in Pass B (DISC-AUDIT-130 through 136) are bunched at the table tail.

**How to avoid:** Maintain a side-lookup of the 7 fresh-account-counterpart rows (DISC-AUDIT-130, 131, 132, 133, 134, 135, 136) and check each affected entity's cells against this list. The cell author must confirm: "Have I checked whether a fresh-account counterpart row exists for this affordance in DISC-AUDIT-130..136?"

**Warning signs:** A cell scored `ship` whose backing_rows lists only owner-populated DISC-AUDIT row IDs without acknowledgment of fresh-account counterparts — this combination is suspect for any Watch Detail / Catalog / Collector Profile cell.

### Pitfall 6: Over-N-A-ing

**What goes wrong:** Author marks Search × see-more-like-this as N-A "because search is keyword-driven", but a reviewer counterargues that "search results have a 'related searches' affordance opportunity that DOES match see-more-like-this." NSD-03 mandates every cell scored, including obvious N-A — but obvious is in the eye of the beholder.

**Why it happens:** N-A is the path of least resistance; it dispatches a cell with a one-line rationale.

**How to avoid:** Treat N-A as a low-frequency outcome (CONTEXT.md doesn't pin a target count, but the matrix pre-computation above suggests ~5 N-A cells of 42 — about 12%). When in doubt, prefer `missing` with a leverage of `low` and rationale acknowledging the vector is theoretically applicable but practically dispensable. This preserves the cell as a future v5.x audit candidate without committing to it now.

**Warning signs:** N-A count exceeds ~7 cells; rationale for N-A reads as "this vector doesn't really apply here" without specifying WHY it doesn't apply.

## Code Examples

### Example 1: Ship cell

```markdown
| NSV-22 | Home Feed | similar-by-taste | ship | — | CollectorsLikeYou rail surfaces taste-similar collector recommendations with click-through to representative watch detail; rec engine gated on collection signal but renders fully for owner-populated state per NSD-06 worst-case (no fresh-account row diverges in Phase 33's table). | DISC-AUDIT-29 |
```

### Example 2: Partial cell (visible-but-not-clickable per NSD-04)

```markdown
| NSV-01 | Watch Detail | similar-by-taste | partial | high | Verdict mostSimilar list renders watch identity (brand + model) as text without click-through to /watch/{id}. Rdio violation: viewer can SEE the drift direction (taste-similar watch named on screen) but cannot ACT on it without leaving the surface. NSD-09 inputs present: (1) cited principle violation — viewer feels the "drift direction visible but no path" Rdio dead-end; (2) downstream impact — text-to-Link is a one-line patch gating Phase 39; (3) collector frequency — every viewer with collection.length > 0 hits this verdict block. | DISC-AUDIT-82 |
```

### Example 3: Missing cell (no surface acknowledgment per NSD-04)

```markdown
| NSV-09 | Catalog | same-family/lineage | missing | high | No affordance on /catalog/{catalogId} to walk to other watches in the same family or sharing a lineage edge. Rdio violation: a viewer reading a catalog reference cannot drift to predecessor / successor / family-sibling references — the click-driven discovery the SEED-004 line 15 quote demands has no path here. NSD-09 inputs present: (1) principle violation — explicit family-walk dead-end; (2) downstream impact — gates Phase 35 lineage browse UI scope (Q2 anchor); (3) collector frequency — every catalog page view in a hierarchy-aware app would benefit. | DISC-AUDIT-130 |
```

### Example 4: Missing cell with no Phase 33 backing (rationale must explain)

```markdown
| NSV-15 | Watch Detail | same-era | missing | medium | No affordance on /watch/{id} to walk to other watches from the same era / generation. Rdio violation: era_signal column shipped Phase 19.1 but no surface affordance reads it for drift navigation; viewer with same-era curiosity has no path. NSD-09 inputs present: (1) principle violation — yes, but era is a secondary drift direction vs same-family; (2) downstream impact — post-CAT-13 rewire could surface this naturally without dedicated UI; (3) collector frequency — moderate (era-curious is a sub-population). backing_rows = "—" because Phase 33's enumeration captured affordances that exist; absence-of-vector cells with no shipped affordance have no DISC-AUDIT counterpart to cite (NSD-15 rule 3 absence-rationale). | — |
```

### Example 5: N-A cell

```markdown
| NSV-30 | Search Results | owner-overlap | N-A | — | Search is keyword-query-driven, not collector-scoped — owner-overlap (shared collection / shared taste) is meaningful only when one is browsing a specific collector's profile. NSD-03 mandates explicit N-A scoring; the vector is genuinely inapplicable to keyword-search results. | — |
```

### Example 6: Decision verdict (NSD-16 template applied to Q1)

```markdown
### Decision Q1: Combine home and explore?

**Verdict:** DEFERRED
**Rationale:** Home Feed and Explore Feed ship complementary vector mixes — Home ships similar-by-taste (NSV-22) + owner-overlap (NSV-26) via personalized rails, while Explore ships other-owners (NSV-32) + see-more-like-this (NSV-35) via raw popularity. The cross-entity comparison shows two distinct purposes (personalized network vs broad popularity), not redundancy. Combining would force a vector-mix compromise neither surface currently makes — the decision should wait for Phase 39 polish to surface concrete UX patterns rather than locking now.
**Cited NSV rows:** NSV-22, NSV-26, NSV-32, NSV-35
**Backing DISC-AUDIT rows:** DISC-AUDIT-29, DISC-AUDIT-38, DISC-AUDIT-49, DISC-AUDIT-52
**Drives:** Phase 39 polish ordering — Home/Explore consolidation work explicitly DEFERRED to v5.x; Phase 39 closes per-surface dead-ends within current two-surface architecture.
```

> **Note:** Example 6 is a HYPOTHETICAL verdict shape; the actual Q1 verdict is the audit author's product judgment per NSD-12. The template structure is the locked deliverable.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 33's 4 decision verdicts (Q1–Q4) deferred with placeholder DEFERRED | Phase 33b authors actual YES/NO/DEFERRED with full rationale | 2026-05-08 (REQUIREMENTS.md DISC-12 added; STATE.md line 73) | Downstream Phase 34/35/38/39 cite Phase 33b verdicts not Phase 33 placeholders |
| Phase 33 click-path table as single source of truth | Two-audit model: Phase 33 = click-path enumeration (engineering); Phase 33b = drift-vector product audit | 2026-05-08 | Both artifacts coexist; downstream phases cite either or both via their respective row id formats |

**Deprecated/outdated:** Phase 33's 4 decision placeholders (`33-DISCOVERY-AUDIT.md` lines 198-230) — explicitly marked "deferred to Phase 33b" — are NOT to be modified by Phase 33b (NSD-15 rule 6 immutability), but ARE superseded by Phase 33b's `## Decisions` § for downstream cite purposes.

## Plan Structure Recommendation

> Per Phase 33b research focus area #7. Recommends granularity for `/gsd-plan-phase`.

**Recommendation: 3 plans** along the natural authoring waves identified in Pitfalls #1.

### Why not 1 atomic plan?

A doc-only audit could be authored as a single plan, but 42 cells × 3 authoring passes (status, citation, rationale+leverage) plus the 4 verdicts plus the scaffold creates ~6+ hours of contiguous work. Splitting into waves enables:
- `quick.sh` validation between waves (catches drift early)
- Logical commit boundaries (one commit per wave)
- Reviewer mental boundaries (skeleton vs cells vs decisions are different review tasks)

### Why not 4+ plans (per-entity)?

Per-entity authoring breaks NSD-02's cross-entity asymmetry signal — the matrix's value is comparing 7 vectors across 6 entities at a glance, which requires consistent voice across entity blocks. Per-entity plans create per-author voice drift.

### Recommended 3-plan structure

#### Plan 33b-01: Wave 0 — Scaffold + Skeleton

**Tasks:**
1. Create `.planning/phases/33b-discovery-north-star-audit/checks/quick.sh` (file exists, headings present, NSV-NN row count ≥ 0 with `<!-- skeleton -->` carve-out, vector definition table header present, leverage bucket key header present)
2. Create `.planning/phases/33b-discovery-north-star-audit/checks/full.sh` (wraps quick.sh + NSD-15 rules 1-6 + NSD-14 sequencing, modeled on Phase 33's `full.sh`)
3. Create `33b-DISCOVERY-NORTH-STAR-AUDIT.md` skeleton with:
   - YAML frontmatter
   - `## Pass/Fail Criteria` § with NSD-15 6 rules verbatim
   - `## Rdio Principle Anchor` § with SEED-004 line 15 quote
   - `## Vector Definitions` § with NSD-07 7-vector table
   - `## Leverage Bucket Key` § with NSD-11 high/med/low qualifiers
   - `## Drift-Vector Audit` § with 7-column NSD-13 table header (no rows yet; `<!-- skeleton -->` sentinel below header)
   - `## Decisions` § with 4 stub headings (Q1/Q2/Q3/Q4) — empty
4. Run `quick.sh` — must pass with skeleton sentinel acceptance branch

**Verification:** `quick.sh` returns 0; `full.sh` skipped on Wave 0 (rules 1-5 require populated content; Wave 0 just needs structure)

#### Plan 33b-02: Wave 1 — 42-Cell Population (matrix authoring)

**Tasks:**
1. Pass 1 (status assignment): populate the 42 NSV-NN rows in NSD-05 entity order × NSD-07 vector order with status only (`ship` / `partial` / `missing` / `N-A`); use the pre-computation table from this RESEARCH (§ "Cell-Population Pre-Computation") as starting point but VERIFY each against Phase 33 rows
2. Pass 2 (citation): for each missing/partial cell, populate `backing_rows` with verified DISC-AUDIT-NN ids (use ripgrep against `33-DISCOVERY-AUDIT.md`)
3. Pass 3 (rationale + leverage): write 1-3 sentence rationale per cell; for missing cells cite SEED-004 line 15; for missing/partial cells assign leverage per NSD-09 3-input rubric; remove `<!-- skeleton -->` sentinel
4. Run `full.sh` rules 1-4 — must pass (rule 5 needs decisions; rule 6 should already pass)

**Verification:** `full.sh` rules 1-4 all `[ok]`; NSV-01 through NSV-42 sequencing valid; every missing/partial cell has leverage tag and DISC-AUDIT cite; every missing cell rationale cites SEED-004

**Wave size warning:** This is the largest wave (~42 cells × 3 passes). Authoring should be linear and commit-incremental — recommend committing after each entity block (6 commits total) to bound recovery scope on any cell-level error. Each commit should leave `full.sh` rules 1-4 still passable for the rows committed so far.

#### Plan 33b-03: Wave 2 — Decisions + Closeout

**Tasks:**
1. Author Q1 verdict using NSD-16 template (cite NSV rows from Wave 1; cite DISC-AUDIT backing rows from Phase 33)
2. Author Q2 verdict (lineage browse priority — anchor to NSV-09 / NSV-15 / NSV-22 lineage cells + DISC-AUDIT-130)
3. Author Q3 verdict (dead-end closure priority — anchor to high-leverage missing/partial NSV cells + Phase 33 Missing rows including DISC-AUDIT-99/97/102/111/122/123/124/127/129)
4. Author Q4 verdict (CAT-13 framing — anchor to NSV cells for Watch Detail × evaluative-verdict + Catalog × evaluative-verdict + DISC-AUDIT-70/71/81/82/130/131)
5. Run `full.sh` all 6 rules — must pass
6. Update `STATE.md` "Key Decisions (v5.0)" — add Q1/Q2/Q3/Q4 verdicts replacing the "deferred to Phase 33b" placeholder per CONTEXT.md `<code_context>` integration point line 191
7. Verify NSD-15 rule 6: `git diff .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` returns empty

**Verification:** `full.sh` returns 0; STATE.md updated; Phase 33 audit immutable.

### Cross-cutting considerations

- **No code/dependency changes ANY plan** — all 3 plans commit only into `.planning/phases/33b-discovery-north-star-audit/` per NSD-15 rule 6.
- **Plan boundaries are commit-clean:** Wave 0 ends with skeleton committed; Wave 1 ends with 42 cells committed; Wave 2 ends with decisions committed. Each wave can be re-run independently if any commit needs amendment.
- **Plans 33b-02 and 33b-03 are sequentially dependent:** Wave 2 verdicts cite NSV-NN rows from Wave 1, so 33b-02 must commit before 33b-03 starts.

## Risk Analysis (Failure Modes for Goal-Backward Verification)

> Per Phase 33b research focus area #8.

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Author drift across the 42-cell matrix (Pitfall 1) | HIGH | MEDIUM (passes mechanical checks but reduces audit value) | 3-pass authoring sequence; pinned NSD-09 rubric in audit doc header |
| Mis-cite DISC-AUDIT row id (Pitfall 2) | HIGH | HIGH (breaks downstream cite chain silently) | `checks/full.sh` mechanical id-existence check; copy-don't-retype discipline |
| 5th-decision creep (Pitfall 3) | MEDIUM | HIGH (violates NSD-16) | `full.sh` rule 5a enforces exactly 4 verdict lines |
| Recommendation drift in cell rationale (Pitfall 4) | MEDIUM | MEDIUM (reduces audit-vs-plan distinction; breaks NSD-12 no-mechanical-mapping) | Authoring discipline; rationale structure constraint (WHAT / WHY / leverage inputs only) |
| Worst-case viewer-state oversight (Pitfall 5) | MEDIUM | HIGH (cells silently mis-classify ship when actually partial) | Side-lookup of fresh-account-counterpart rows DISC-AUDIT-130 through 136; check every Watch Detail / Catalog / Collector Profile cell against this list |
| Over-N-A-ing (Pitfall 6) | LOW | LOW | Soft target ~5 N-A cells; rationale must justify N-A specifically |
| Subjective leverage scoring (NSD-09 3-input rubric drift) | MEDIUM | MEDIUM (downstream Phase 39 prioritization signal degrades) | Pinned NSD-11 key in audit doc; rationale must cite which inputs are present |
| Modifying `33-DISCOVERY-AUDIT.md` accidentally (NSD-15 rule 6) | LOW | CRITICAL (immutability is the cross-reference foundation) | `full.sh` rule 6 hard `git diff` check |
| Citing non-existent DISC-AUDIT-NN id | MEDIUM | HIGH (breaks rule 3 silently if NSV-NN cite passes mechanical check but DISC-AUDIT-NN doesn't exist) | `full.sh` enhanced rule 3 with mechanical check that every cited DISC-AUDIT-NN exists in Phase 33's table |
| Authoring scope creep into Phase 39 territory (proposing fixes) | MEDIUM | MEDIUM | Pitfall 4 mitigation; cell rationale length cap (1-3 sentences per NSD-13) |

**Highest-risk single failure: silent backing_rows cite corruption.** If `checks/full.sh` doesn't enforce DISC-AUDIT-NN id existence (in addition to format match), an off-by-one typo passes `full.sh` rule 3 (`backing_rows` contains `DISC-AUDIT-NN` pattern) but fails the actual cross-reference. Recommend `full.sh` includes:

```bash
# Enhanced rule 3: every cited DISC-AUDIT-NN exists in Phase 33's table
PHASE_33_AUDIT=".planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md"
CITED=$(grep -oE 'DISC-AUDIT-[0-9]+' "$AUDIT" | sort -u)
for id in $CITED; do
  grep -qE "^\| ${id} \|" "$PHASE_33_AUDIT" \
    || { echo "[fail] NSD-15 rule 3 enhanced: $id cited in 33b but not present in Phase 33 table"; exit 1; }
done
```

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | none — content validation via `bash` + `grep` + `awk` (matches Phase 33 precedent) |
| Config file | none |
| Quick run command | `bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` |
| Full suite command | `bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh` |
| Estimated runtime | ~3 seconds |

> **Important:** Wave 0 check scripts live under `.planning/phases/33b-discovery-north-star-audit/checks/` — they do NOT violate NSD-15 rule 6 ("zero code/dependency changes") because they are local doc-phase scaffolding committed alongside the audit, not application code. Phase 33 set this precedent.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DISC-12 (NSD-15 rule 1) | 42 NSV-NN rows present (6 entities × 7 vectors) | content / mechanical | `bash .../checks/full.sh` (Rule 1 block) | ❌ Wave 0 |
| DISC-12 (NSD-15 rule 2) | Every missing/partial cell has leverage tag in {high, med, low} | content / mechanical | `bash .../checks/full.sh` (Rule 2 block) | ❌ Wave 0 |
| DISC-12 (NSD-15 rule 3) | Every missing/partial cell cites ≥1 DISC-AUDIT-NN that exists in Phase 33's table | content / cross-reference | `bash .../checks/full.sh` (Rule 3 enhanced block) | ❌ Wave 0 |
| DISC-12 (NSD-15 rule 4) | Every missing cell rationale cites SEED-004 line 15 violation explicitly | content / mechanical | `bash .../checks/full.sh` (Rule 4 block) | ❌ Wave 0 |
| DISC-12 (NSD-15 rule 5) | All 4 D-17 decisions have YES/NO/DEFERRED + ≥1 NSV cite + ≥1 DISC-AUDIT cite + Drives line | content / mechanical | `bash .../checks/full.sh` (Rule 5 block) | ❌ Wave 0 |
| DISC-12 (NSD-15 rule 6) | Zero modifications to `33-DISCOVERY-AUDIT.md` | content / git | `bash .../checks/full.sh` (Rule 6 git diff block) | ❌ Wave 0 |
| DISC-12 (NSD-14) | NSV-NN sequencing 1..42, no gaps, no dupes | content / mechanical | `bash .../checks/full.sh` (NSV sequencing block) | ❌ Wave 0 |
| DISC-12 (NSD-08) | Vector definition table pinned at top before any drift table row | content / structural | `bash .../checks/quick.sh` (heading order check) | ❌ Wave 0 |
| DISC-12 (NSD-11) | Leverage bucket key pinned at top before any drift table row | content / structural | `bash .../checks/quick.sh` (heading order check) | ❌ Wave 0 |
| DISC-12 — Decision verdict semantic anchor | Each verdict's cited NSV rows actually justify the verdict claim | content / semantic | manual reviewer | manual-only |
| DISC-12 — SEED-004 anchor uniformity | Same SEED-004 line 15 quote across all missing rows (no paraphrase / alternative anchor) | content / semantic | manual reviewer | manual-only |
| DISC-12 — Worst-case viewer-state correctness | NSD-06 worst-case aggregation applied correctly per Watch Detail / Catalog / Collector Profile cell | content / semantic | manual reviewer | manual-only |

### Sampling Rate

- **Per task commit (Wave 0):** `quick.sh` (file exists; headings present; vector definition + leverage key tables present; NSV-NN row count ≥ 0 with skeleton carve-out)
- **Per task commit (Waves 1-2):** `quick.sh` after every cell-block commit (per-entity block; ~6 commits in Wave 1)
- **Per wave merge:** `full.sh` (all NSD-15 rules 1-6 + NSD-14 sequencing) — Wave 1 satisfies rules 1-4; Wave 2 satisfies rules 5-6
- **Phase gate (`/gsd-verify-work`):** `full.sh` returns 0 + manual reviewer signs the 3 manual-only checks above

### Wave 0 Gaps

- [ ] `.planning/phases/33b-discovery-north-star-audit/checks/quick.sh` — file exists; required headings (`## Pass/Fail Criteria`, `## Rdio Principle Anchor`, `## Vector Definitions`, `## Leverage Bucket Key`, `## Drift-Vector Audit`, `## Decisions`); 7-column NSD-13 table header present; NSV-NN row count ≥ 0 with `<!-- skeleton -->` carve-out (mirroring Phase 33's quick.sh pattern); pass/fail § precedes drift-vector audit § (criteria pinned at TOP)
- [ ] `.planning/phases/33b-discovery-north-star-audit/checks/full.sh` — wraps quick.sh + NSD-15 rules 1-6 + NSD-14 sequencing + Rule 3 ENHANCED (cited DISC-AUDIT-NN must exist in Phase 33's table)
- [ ] No npm/pip framework install — checks are pure bash + grep + awk (matches Phase 33 precedent)
- [ ] `33b-DISCOVERY-NORTH-STAR-AUDIT.md` skeleton with all 6 top-level headings + 7-column table header + 4 decision stub headings (Q1/Q2/Q3/Q4) + skeleton sentinel
- [ ] `33b-VALIDATION.md` — Nyquist contract for the doc phase (mirrors `33-VALIDATION.md` structure; references `quick.sh` / `full.sh` per-task verification)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bash | `checks/quick.sh` + `checks/full.sh` | ✓ (system) | 3.2+ | — |
| grep | rule enforcement | ✓ (BSD/GNU; system) | n/a | — |
| awk | column-parsing in rules 2/3/4 | ✓ (system) | n/a | — |
| git | rule 6 immutability check | ✓ (already used by repo) | 2.x | — |
| ripgrep (rg) | author-time DISC-AUDIT-NN cross-reference | ✓ (already used by repo per Phase 33's source-grep recipe) | 14.x | grep -rn |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

The phase has no application-tier dependencies (no Next.js / Supabase / Anthropic API touches). The `checks/` scripts use only POSIX-standard tools available on macOS / Linux.

## Project Constraints (from CLAUDE.md / AGENTS.md)

> Extracted directives from `./CLAUDE.md` and `./AGENTS.md`. Phase 33b must comply.

- **CLAUDE.md GSD Workflow Enforcement:** "Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync." Phase 33b plans are authored via `/gsd-plan-phase`; tasks are executed via `/gsd-execute-phase`. Direct file edits outside the GSD flow are prohibited.
- **CLAUDE.md tech stack:** Next.js 16 / React 19.2.4 / TypeScript 5 — irrelevant to Phase 33b (zero code changes); listed for completeness.
- **AGENTS.md:** "This is NOT the Next.js you know" — irrelevant to Phase 33b; listed for completeness.
- **Personal-first / single-user posture:** the audit reflects single-user product reality (e.g., NSD-09 input #3 "collector frequency" is a single-user judgment, not aggregate metric).

## Sources

### Primary (HIGH confidence)

- `.planning/phases/33b-discovery-north-star-audit/33b-CONTEXT.md` — 256 lines, 16 NSDs locked. The single source of truth for Phase 33b spec.
- `.planning/phases/33b-discovery-north-star-audit/33b-DISCUSSION-LOG.md` — Q&A audit trail confirming user selected recommended option on every question.
- `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` — 196 lines incl. 136 DISC-AUDIT rows. Read-only substrate for Phase 33b cell citations.
- `.planning/phases/33-discovery-audit/33-CONTEXT.md` — Phase 33 D-01..D-17 decisions; D-12, D-15, D-16, D-17 inherited as Phase 33b locks.
- `.planning/phases/33-discovery-audit/33-VALIDATION.md` — proven pattern for doc-only phase Nyquist compliance; Phase 33b's `33b-VALIDATION.md` mirrors structure.
- `.planning/phases/33-discovery-audit/checks/quick.sh` + `checks/full.sh` — concrete bash + grep + awk implementation precedent for Phase 33b's `checks/`.
- `.planning/REQUIREMENTS.md` line 21 — DISC-12 full requirement text (verbatim).
- `.planning/ROADMAP.md` lines 159-169 — Phase 33b goal + 5 success criteria (verbatim).
- `.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15 — the Rdio principle quote (the single anchor per NSD-15 rule 4).
- `.planning/STATE.md` lines 65-80 — Phase 33b insertion rationale + downstream phase dependencies.

### Secondary (MEDIUM confidence)

- `.planning/seeds/SEED-006-premium-features-audit.md` — confirms no paywall in v5.0 (no paid-vs-free fork to audit).
- `.planning/seeds/SEED-002-hybrid-recommender.md` — `see-more-like-this` planned anchor (post-v5.0).

### Tertiary (LOW confidence)

- None. Every claim in this research is sourced from a HIGH or MEDIUM source above; no LOW-confidence WebSearch findings used (no need — domain is fully self-contained in `.planning/`).

## Assumptions Log

> Claims tagged `[ASSUMED]` for downstream confirmation. Discuss-phase already ran for Phase 33b; CONTEXT.md is locked. These assumptions are RESEARCH-LEVEL planning aids, not user-facing decisions — the planner can lock or revise them in plan files.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Watch Detail × evaluative-verdict resolves to `partial` per NSD-06 worst-case (owner ships, fresh-account suppressed) | Pattern 2 + § Cell-Population Pre-Computation | Low — author can revise to `ship` if NSD-06 reads as "score the predominant case not the worst case"; CONTEXT.md NSD-06 wording strongly favors worst-case |
| A2 | DISC-AUDIT-99 (wishlist drag silent no-op) maps to Collector Profile × see-more-like-this with `partial` status (wired but broken) | § Pre-anchored cell map | Low — author may classify as `ship` (the affordance ships) or `missing` (the affordance doesn't function); rationale must justify whichever choice |
| A3 | ~32 of 42 cells need leverage scoring (8 partial + 24 missing) per RESEARCH-ASSUMED status estimates | § Cell-Population Pre-Computation summary | Medium — actual count may shift ±5 cells based on author's NSD-04 strict-line application; doesn't affect plan structure |
| A4 | Catalog × other-owners status depends on whether `/catalog` page renders an "other owners" collector list | § Catalog × {7 vectors} | Medium — author MUST verify against DISC-AUDIT-70..75 source code, not RESEARCH-ASSUMED reading; NSD-07 PROD anchor hint says "/catalog catalog-page collector list" exists |
| A5 | Watch Detail × owner-overlap is N-A (cell does not apply because watch detail is per-user-watch, not collector-overlap-scoped) | § Watch Detail × {7 vectors} | Medium — Phase 20 D-08 same-user / cross-user framing implies cross-user /watch viewing IS a thing; if cross-user /watch shows owner overlap context, cell is missing not N-A |
| A6 | Estimated ~3 plans for `/gsd-plan-phase` (scaffold + cells + decisions waves) | § Plan Structure Recommendation | Low — planner may consolidate to 2 (scaffold+cells, decisions) or split cells into 2 waves; the 3-plan recommendation is wave-aligned not commit-count-aligned |
| A7 | `checks/full.sh` Rule 3 enhanced (cited DISC-AUDIT exists in Phase 33 table) is the highest-value mechanical check | § Risk Analysis | Low — even without enhancement, `quick.sh` and rules 1, 2, 4, 5, 6 catch most failures; enhancement is recommended not mandatory |

**Author confirmation needed:** A4 and A5 are the cells most likely to differ from this RESEARCH's pre-computation. Confirm against Phase 33 source-pass evidence in `33-DISCOVERY-AUDIT.md` rows 70-83.

## Open Questions

1. **Should Phase 33b also commit a `33b-PATTERNS.md` file mirroring Phase 33's `33-PATTERNS.md` (269 lines)?**
   - What we know: Phase 33's PATTERNS.md captured per-surface render gates (G-1..G-20) used for viewer_state column scoring. Phase 33b's NSD-06 worst-case viewer-state aggregation references Phase 33's gates indirectly (via DISC-AUDIT row cites).
   - What's unclear: whether Phase 33b adds enough NEW patterns (beyond what's already in this RESEARCH.md) to warrant a separate PATTERNS.md.
   - Recommendation: SKIP `33b-PATTERNS.md`. The patterns relevant to Phase 33b are already in this RESEARCH.md (Patterns 1-3) and CONTEXT.md (NSD-01 hybrid method, NSD-04 strict line, NSD-06 worst-case aggregation). A separate PATTERNS.md adds maintenance overhead without proportional benefit on a doc-only phase.

2. **Should the `33b-DISCOVERY-NORTH-STAR-AUDIT.md` file YAML frontmatter mirror Phase 33's exactly, or add Phase-33b-specific keys?**
   - What we know: Phase 33's frontmatter has `title`, `status: draft`, `date`, `audit_seed: SEED-004`, `phase: 33-discovery-audit`, `requirement: DISC-10`, `decision: pending`.
   - What's unclear: whether Phase 33b adds a `predecessor_audit: 33-discovery-audit` key for cross-reference clarity, or just reuses Phase 33's keys with values updated.
   - Recommendation: mirror Phase 33's keys exactly; update values (`phase: 33b-discovery-north-star-audit`, `requirement: DISC-12`, `decision: pending → final` upon Wave 2 close). Add `predecessor_audit: 33-discovery-audit` as a new key documenting the inheritance. Low-risk addition; aids downstream tooling.

3. **Should the audit doc's table render with NSD-13's column order verbatim, or should `entity` and `vector` be combined into a `cell` column for compactness?**
   - What we know: NSD-13 explicitly locks 7 columns (`row_id` | `entity` | `vector` | `status` | `leverage` | `rationale` | `backing_rows`).
   - Recommendation: NSD-13 is locked. No compaction. The 7-column shape is the deliverable.

## Metadata

**Confidence breakdown:**

- Standard stack (bash + grep + awk for `checks/`): HIGH — Phase 33's `33-discovery-audit/checks/full.sh` is the exact precedent
- Architecture (single-deliverable, 6 + 4 NSD-section structure for the audit doc): HIGH — NSD-15 / NSD-16 lock the structure
- Pitfalls (author drift, mis-cite, recommendation drift, viewer-state oversight): MEDIUM — synthesized from Phase 33 retrospective + CONTEXT.md `<specifics>`; concrete but lack empirical track record at single-user scale
- Cell-population pre-computation (42-cell matrix map): MEDIUM — RESEARCH-ASSUMED status estimates require author verification against Phase 33 row-by-row; structure (entities × vectors × pre-anchored cells) is HIGH

**Research date:** 2026-05-08
**Valid until:** until any of the following changes:
- Phase 33's `33-DISCOVERY-AUDIT.md` is modified (would invalidate row-citation analysis) — but NSD-15 rule 6 explicitly forbids this
- CONTEXT.md NSD decisions are revised — discuss-phase already complete; revision would require new discuss-phase pass
- ROADMAP.md Phase 33b success criteria change — currently locked at 5 criteria

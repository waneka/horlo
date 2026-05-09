---
phase: 33b
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - .planning/phases/33b-discovery-north-star-audit/checks/quick.sh
  - .planning/phases/33b-discovery-north-star-audit/checks/full.sh
  - .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
autonomous: true
requirements: [DISC-12]
tags: [audit, documentation, discovery, scaffold, nsd-08, nsd-11, nsd-13, nsd-15]

must_haves:
  truths:
    - "checks/quick.sh exists, is executable (chmod +x), exits 0 against the skeleton audit file with sentinel present (NSD-15 rule 1 carve-out via skeleton sentinel)"
    - "checks/full.sh exists, is executable, sources/wraps quick.sh and adds NSD-15 rules 1-6 + NSD-14 NSV-NN sequencing 1..42 + Rule 3 ENHANCED (every cited DISC-AUDIT-NN exists in 33-DISCOVERY-AUDIT.md)"
    - "33b-DISCOVERY-NORTH-STAR-AUDIT.md exists with frontmatter (phase: 33b-discovery-north-star-audit; requirement: DISC-12; decision: pending; predecessor_audit: 33-discovery-audit), Pass/Fail Criteria § as the FIRST § after the H1 title (NSD-15 6 rules verbatim), Rdio Principle Anchor § quoting SEED-004 line 15 verbatim (NSD-15 rule 4 anchor), Vector Definitions § with NSD-07 7-vector taxonomy table (NSD-08 pin), Leverage Bucket Key § with NSD-11 high/med/low qualifiers, empty Drift-Vector Audit § with the 7-column NSD-13 table header (row_id | entity | vector | status | leverage | rationale | backing_rows), and 4 Decision § stubs (Q1 home+explore / Q2 lineage browse / Q3 dead-end closure / Q4 CAT-13 framing) using the NSD-16 template"
    - "Implements decisions: NSD-08 (vector-definition table pinned at top), NSD-11 (leverage bucket key pinned at top), NSD-13 (7-column flat table), NSD-14 (NSV-NN flat-sequential row id format enforced by full.sh), NSD-15 (6-rule pass/fail § pinned at TOP; full.sh enforces all 6 rules + Rule 3 ENHANCED), NSD-16 (4 decision stubs Q1-Q4 verbatim using verdict/rationale/cited NSV rows/backing DISC-AUDIT rows/drives template)"
    - "Inherits Phase 33 D-12 single Rdio rubric (SEED-004 line 15 quote anchor only) and Phase 33 D-17 exactly-4-decisions cap"
    - "Zero files modified outside .planning/phases/33b-discovery-north-star-audit/"
  artifacts:
    - path: ".planning/phases/33b-discovery-north-star-audit/checks/quick.sh"
      provides: "Wave 0 sanity check (file exists, headings present, vector + leverage tables present, NSV-NN row count >= 0 with skeleton-sentinel carve-out)"
    - path: ".planning/phases/33b-discovery-north-star-audit/checks/full.sh"
      provides: "Wave-N consistency check (NSD-15 rules 1-6 + NSD-14 sequencing + Rule 3 ENHANCED cited-id-existence)"
    - path: ".planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md"
      provides: "Audit artifact skeleton with Pass/Fail @ TOP + Rdio anchor + vector definitions + leverage key + table header + 4 decision stubs + skeleton sentinel"
      contains: "## Pass/Fail Criteria"
  key_links:
    - from: "checks/full.sh"
      to: "checks/quick.sh"
      via: "bash invocation of $DIR/quick.sh"
      pattern: "bash.*quick\\.sh"
    - from: "checks/full.sh Rule 6"
      to: ".planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md"
      via: "git diff -- against IMMUTABLE Phase 33 audit"
      pattern: "git diff.*33-DISCOVERY-AUDIT\\.md"
    - from: "checks/full.sh Rule 3 ENHANCED"
      to: ".planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md (cited DISC-AUDIT-NN row existence verification)"
      via: "grep against Phase 33 table"
      pattern: "grep.*\\| \\$\\{id\\} \\|.*PHASE_33_AUDIT"
    - from: "33b-DISCOVERY-NORTH-STAR-AUDIT.md § Rdio Principle Anchor"
      to: ".planning/seeds/SEED-004-v5-discovery-north-star.md line 15"
      via: "verbatim blockquote citation"
      pattern: "SEED-004-v5-discovery-north-star\\.md line 15"
---

<objective>
Scaffold the Phase 33b deliverables before any audit content is written. Create the falsifiability check scripts (`checks/quick.sh` + `checks/full.sh`) FIRST so every subsequent task in Plans 02 and 03 ends with `bash checks/quick.sh` (and Wave 2 with `bash checks/full.sh`). Then create the `33b-DISCOVERY-NORTH-STAR-AUDIT.md` skeleton with the Pass/Fail § pinned at the TOP per NSD-15, the SEED-004 Rdio quote pinned per NSD-15 rule 4, the NSD-07 7-vector definition table pinned per NSD-08, the NSD-11 leverage bucket key pinned, an empty Drift-Vector Audit § with the 7-column NSD-13 table header, and 4 Decision § stubs matching NSD-16 Q1-Q4 verbatim using the extended template (verdict + rationale + cited NSV rows + backing DISC-AUDIT rows + drives).

Purpose: NSD-15 rule 1 says "Pass/Fail Criteria pinned at TOP before findings appear" — non-negotiable. The skeleton enforces ordering by being authored before any cells or verdicts. The check scripts give the executor (and `/gsd-verify-work`) a deterministic, ~3-second verification loop for Wave 1 and Wave 2.

Output: 3 files under `.planning/phases/33b-discovery-north-star-audit/`, all version-controllable plain text. Zero changes to `src/`, `db/`, or any application code path. Mirrors Phase 33's proven scaffold pattern (`33-discovery-audit/checks/quick.sh` + `full.sh` + skeleton audit).
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
@.planning/phases/33-discovery-audit/checks/quick.sh
@.planning/phases/33-discovery-audit/checks/full.sh
@.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
@.planning/phases/33-discovery-audit/33-CONTEXT.md
@.planning/seeds/SEED-004-v5-discovery-north-star.md

<interfaces>
<!-- The audit file's locked structural contract — every later plan implements against this skeleton. -->

<!-- NSD-13 column order (7 columns, exact): -->
<!--   row_id | entity | vector | status | leverage | rationale | backing_rows -->

<!-- NSD-14 row id format: NSV-NN (zero-padded 2 digits when N<10), flat sequential 01..42, no gaps, no dupes -->

<!-- NSD-04 status enum (exact spelling, lowercase): ship | partial | missing | N-A -->
<!--   partial = visible but not clickable (viewer can SEE drift, cannot ACT) -->
<!--   missing = no surface-level acknowledgment (no label, no list, no data anchor) -->

<!-- NSD-11 leverage enum (exact spelling, lowercase): high | med | low | — -->
<!--   high — gates v5.0 phase AND violates SEED-004 directly AND collector frequently encounters -->
<!--   med — gates v5.x phase OR violates SEED-004 directly OR collector frequently encounters (not all three) -->
<!--   low — none of the above; theoretical Rdio drift, DEFERRED beyond v5.x -->
<!--   — used for ship and N-A cells only -->

<!-- NSD-15 6 rules (verbatim — must appear at TOP of audit doc): -->
<!--   1. 42 cells, no skipped (entity × vector) pairs (6 entities × 7 vectors). -->
<!--   2. Every missing AND partial cell carries a leverage tag (high/med/low) per NSD-10/NSD-11. -->
<!--   3. Every missing AND partial cell cites ≥1 DISC-AUDIT-NN backing row from Phase 33 in the backing_rows column (— allowed only with explicit rationale for the absence). -->
<!--   4. Every missing cell's rationale cites the SEED-004 line 15 Rdio quote violation explicitly (Rdio violation: … or SEED-004: … syntax). -->
<!--   5. All 4 D-17 decisions in the final § have explicit YES/NO/DEFERRED resolution with 2–4 sentence rationale citing ≥1 NSV-NN row AND ≥1 DISC-AUDIT-NN backing row + a downstream-phase impact line. -->
<!--   6. Zero code/schema/dependency changes ship; zero modifications to 33-DISCOVERY-AUDIT.md (verified by git diff returning empty). -->

<!-- NSD-07 7-vector taxonomy (locked; insert verbatim into Vector Definitions §): -->
<!--   similar-by-taste | walk to watches similar in style/role/taste to this one | analyzeSimilarity() (PROD); CAT-13 catalog taste columns post-Phase 38 -->
<!--   same-family/lineage | walk to watches in the same family or sharing a lineage edge | CAT-15 brands/families (Phase 34); CAT-16 lineage edges (Phase 35) -->
<!--   same-era | walk to watches from the same era / generation | era_signal column (Phase 19.1 LLM-derived; CAT-13 reads it post-Phase 38) -->
<!--   other-owners | walk to other collectors who own / wishlist this watch | cross-collector graph (PROD via /catalog catalog-page collector list) -->
<!--   owner-overlap | walk to overlap with this collector — shared taste / shared collection | common-ground (PROD /u/{user}/common-ground) -->
<!--   evaluative-verdict | "does this fit my collection" answer for the viewer | Collection Fit verdict (PROD /watch, /catalog, search inline-expand) -->
<!--   see-more-like-this | walk to a paginated rail/feed of more affordances like this one | trending/popular/gaining-traction rails (PROD /explore); recommender layer (SEED-002 future) -->

<!-- NSD-05 6 entities (locked; entity column accepts exactly these spellings): -->
<!--   Watch Detail | Collector Profile | Catalog | Home Feed | Explore Feed | Search Results -->

<!-- NSD-16 four decisions (verbatim Q1→Q4 order; each requires the extended template): -->
<!--   Q1: Combine home and explore? -->
<!--   Q2: Lineage browse priority -->
<!--   Q3: Dead-end closure priority -->
<!--   Q4: CAT-13 discovery framing -->

<!-- NSD-16 per-decision template (verbatim — every label is grep-target for full.sh rule 5): -->
<!--   ### Decision QN: <question text> -->
<!--   **Verdict:** YES | NO | DEFERRED -->
<!--   **Rationale:** [2–4 sentences citing audit findings] -->
<!--   **Cited NSV rows:** NSV-NN, NSV-MM, ... -->
<!--   **Backing DISC-AUDIT rows:** DISC-AUDIT-NN, DISC-AUDIT-MM, ... -->
<!--   **Drives:** [downstream phase / item this verdict gates] -->

<!-- SEED-004 Rdio principle quote (NSD-15 rule 4 anchor — must appear verbatim): -->
<!--   "a collector should be able to drift from one watch / collector / family / reference to another by clicking, without ever feeling lost or running into a dead end." -->

<!-- Skeleton sentinel pattern (mirrors Phase 33 quick.sh): -->
<!--   Place an HTML comment <!-- skeleton --> immediately after the Drift-Vector Audit § H2 -->
<!--   so quick.sh accepts ROWS=0. Plan 02 Task 1 removes the sentinel after committing the first NSV-NN row. -->
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Local repo filesystem → committed git history | All audit content + check scripts are static markdown/bash; no externally-reachable surface; no application I/O. The only attack surface is accidental modification of immutable Phase 33 artifact. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-33b-01 | Tampering | `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` (immutable Phase 33 substrate) | mitigate | NSD-15 rule 6 enforced inside `checks/full.sh`: `git diff -- 33-DISCOVERY-AUDIT.md` MUST return empty. Wave 0 wires this check; Waves 1 and 2 invoke `full.sh` so any inadvertent modification fails CI. |
| T-33b-02 | Tampering | Cited DISC-AUDIT-NN ids that don't exist in Phase 33's table (citation-tier corruption) | mitigate | `checks/full.sh` Rule 3 ENHANCED: every cited DISC-AUDIT-NN in `backing_rows` MUST exist as a row in Phase 33's table (`grep -qE "^\| ${id} \|"` against Phase 33 audit). Catches off-by-one typos that would silently corrupt downstream phase plans grepping these ids. |
| T-33b-03 | Information disclosure | Audit document leaking secrets, PII, env vars | accept | Phase 33b audit is product-framed analysis only. No credentials, no .env, no user data referenced — only file paths, decision IDs, and SEED-004 quotes. Reviewer self-checks during commit. |
</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Create checks/quick.sh and checks/full.sh — falsifiability check scripts</name>
  <read_first>
    .planning/phases/33-discovery-audit/checks/quick.sh
    .planning/phases/33-discovery-audit/checks/full.sh
    .planning/phases/33b-discovery-north-star-audit/33b-CONTEXT.md
    .planning/phases/33b-discovery-north-star-audit/33b-RESEARCH.md
    .planning/phases/33b-discovery-north-star-audit/33b-VALIDATION.md
  </read_first>
  <files>
    .planning/phases/33b-discovery-north-star-audit/checks/quick.sh
    .planning/phases/33b-discovery-north-star-audit/checks/full.sh
  </files>
  <action>
Create two bash scripts modeled on Phase 33's `checks/quick.sh` and `checks/full.sh` (same `set -euo pipefail`, same `DIR="$(cd "$(dirname "$0")" && pwd)"` idiom, same exit-1-on-fail discipline). Reference NSDs by id in `[ok]`/`[fail]` echo strings so the executor can read which rule fired.

`quick.sh` (~45 LOC):
1. Resolve `AUDIT="$DIR/../33b-DISCOVERY-NORTH-STAR-AUDIT.md"`.
2. `test -f "$AUDIT"` or fail "[fail] $AUDIT not found".
3. Heading presence (use `grep -qF` for each):
   - `## Pass/Fail Criteria`
   - `## Rdio Principle Anchor`
   - `## Vector Definitions`
   - `## Leverage Bucket Key`
   - `## Drift-Vector Audit`
   - `## Decisions`
4. Pass/Fail § precedes Drift-Vector Audit §: extract line numbers via `grep -n`, assert `PF_LINE < DV_LINE`. Echo `[ok] NSD-15 rule 1 ordering: Pass/Fail Criteria § precedes Drift-Vector Audit §`.
5. NSD-13 7-column header check: `grep -qF '| row_id | entity | vector | status | leverage | rationale | backing_rows |' "$AUDIT"` or fail "[fail] NSD-13 7-column header not found".
6. Vector definition table presence: `grep -qF '| similar-by-taste |' "$AUDIT"` AND `grep -qF '| see-more-like-this |' "$AUDIT"` or fail "[fail] NSD-08 vector definitions table missing".
7. Leverage bucket key presence: `grep -qE '\\bhigh\\b.*\\bmed\\b.*\\blow\\b' "$AUDIT"` (rough check — at least one line listing all three) or fail "[fail] NSD-11 leverage bucket key missing".
8. Skeleton sentinel carve-out for NSV-NN row count:
   - `ROWS=$(grep -c '^| NSV-' "$AUDIT" || true)`
   - `if grep -qF '<!-- skeleton -->' "$AUDIT"; then echo "[ok] skeleton mode (Wave 0); 0 rows OK"; else if [ "$ROWS" -ge 1 ]; then echo "[ok] $ROWS NSV-NN rows present"; else echo "[fail] no NSV rows but skeleton sentinel removed"; exit 1; fi; fi`
9. Final `echo "[ok] quick.sh: all checks passed"`.

`full.sh` (~120 LOC):
1. Resolve `AUDIT` and `PHASE_33_AUDIT=".planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md"`.
2. Run quick.sh first: `bash "$DIR/quick.sh"`.
3. Skeleton-mode short-circuit: if `<!-- skeleton -->` present, echo `[ok] skeleton mode (Wave 0); rules 1-5 deferred to Wave 1` then jump to Rule 6 only.
4. **Rule 1 (NSD-15 rule 1):** count NSV rows; assert == 42. Use `ROWS=$(grep -c '^| NSV-' "$AUDIT")`.
5. **Rule 2 (NSD-15 rule 2):** every row with `status` in {missing, partial} has `leverage` in {high, med, low}. Use awk against `^| NSV-` lines, fields `$5` (status) and `$6` (leverage), strip whitespace, fail if status matches but leverage doesn't match `^(high|med|low)$`.
6. **Rule 3 (NSD-15 rule 3) STANDARD:** every missing/partial row has `backing_rows` (col `$8`) containing `DISC-AUDIT-[0-9]+` OR `^—` (em dash with explicit rationale). Use awk; fail if status matches and backing_rows lacks both patterns.
7. **Rule 3 ENHANCED (the highest-value mechanical check per RESEARCH § Risk Analysis):** every distinct DISC-AUDIT-NN cited in the audit MUST exist as a row in Phase 33's table. Implement as:
   ```bash
   CITED=$(grep -oE 'DISC-AUDIT-[0-9]+' "$AUDIT" | sort -u)
   for id in $CITED; do
     grep -qE "^\\| ${id} \\|" "$PHASE_33_AUDIT" \\
       || { echo "[fail] NSD-15 rule 3 ENHANCED: $id cited in 33b but not present in Phase 33 table"; exit 1; }
   done
   echo "[ok] NSD-15 rule 3 ENHANCED: all cited DISC-AUDIT-NN exist in Phase 33"
   ```
8. **Rule 4 (NSD-15 rule 4):** every missing row's rationale (col `$7`) matches `(Rdio violation:|SEED-004)`. Awk pattern: status=="missing" and rationale lacks pattern → fail.
9. **Rule 5 (NSD-15 rule 5):**
   - 5a: `VERDICTS=$(grep -c '^\\*\\*Verdict:\\*\\*' "$AUDIT")`; assert == 4.
   - 5b: every Verdict line value in {YES, NO, DEFERRED}: `grep -E '^\\*\\*Verdict:\\*\\*' | grep -vE '\\b(YES|NO|DEFERRED)\\b'` MUST be empty.
   - 5c: `grep -c '^\\*\\*Cited NSV rows:\\*\\*' "$AUDIT"` == 4.
   - 5d: `grep -c '^\\*\\*Backing DISC-AUDIT rows:\\*\\*' "$AUDIT"` == 4.
   - 5e: `grep -c '^\\*\\*Drives:\\*\\*' "$AUDIT"` == 4.
   - 5f: each `**Cited NSV rows:**` line lists ≥1 `NSV-[0-9]+` token; each `**Backing DISC-AUDIT rows:**` line lists ≥1 `DISC-AUDIT-[0-9]+` token.
10. **Rule 6 (NSD-15 rule 6) — T-33b-01 mitigation:**
    ```bash
    DIFF=$(git diff -- "$PHASE_33_AUDIT")
    test -z "$DIFF" || { echo "[fail] NSD-15 rule 6: 33-DISCOVERY-AUDIT.md modified (immutability violation)"; exit 1; }
    echo "[ok] NSD-15 rule 6: 33-DISCOVERY-AUDIT.md unmodified"
    ```
11. **NSD-14 sequencing:** extract NSV-NN ids, sort numeric, assert no dupes, first==1, last==42, count==42 (no gaps). Mirror Phase 33's D-09 sequencing block exactly, swap `DISC-AUDIT` for `NSV`.
12. Final `echo "[ok] full.sh: all NSD-15 rules 1-6 + NSD-14 + Rule 3 ENHANCED pass"`.

`chmod +x` both files. Use the Write tool only. Do NOT use heredoc commands.
  </action>
  <verify>
    <automated>chmod +x .planning/phases/33b-discovery-north-star-audit/checks/quick.sh .planning/phases/33b-discovery-north-star-audit/checks/full.sh && test -x .planning/phases/33b-discovery-north-star-audit/checks/quick.sh && test -x .planning/phases/33b-discovery-north-star-audit/checks/full.sh</automated>
  </verify>
  <acceptance_criteria>
    - `test -f .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` exits 0
    - `test -f .planning/phases/33b-discovery-north-star-audit/checks/full.sh` exits 0
    - `test -x .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` exits 0
    - `test -x .planning/phases/33b-discovery-north-star-audit/checks/full.sh` exits 0
    - `grep -q 'set -euo pipefail' .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` exits 0
    - `grep -q 'set -euo pipefail' .planning/phases/33b-discovery-north-star-audit/checks/full.sh` exits 0
    - `grep -q 'NSD-15 rule 6' .planning/phases/33b-discovery-north-star-audit/checks/full.sh` exits 0
    - `grep -q 'NSD-15 rule 3 ENHANCED' .planning/phases/33b-discovery-north-star-audit/checks/full.sh` exits 0
    - `grep -q 'NSD-14' .planning/phases/33b-discovery-north-star-audit/checks/full.sh` exits 0
    - `grep -q 'PHASE_33_AUDIT' .planning/phases/33b-discovery-north-star-audit/checks/full.sh` exits 0
    - `grep -q 'bash.*quick\.sh' .planning/phases/33b-discovery-north-star-audit/checks/full.sh` exits 0 (full.sh wraps quick.sh)
    - `grep -q '<!-- skeleton -->' .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` exits 0 (skeleton sentinel carve-out present)
  </acceptance_criteria>
  <done>Both scripts exist under `.planning/phases/33b-discovery-north-star-audit/checks/`, are executable, run with bash 3.2+ (no bash-4-only features), and reference NSD ids in their echo strings. quick.sh accepts skeleton mode; full.sh enforces all 6 NSD-15 rules + NSD-14 sequencing + Rule 3 ENHANCED. Phase 33's `33-discovery-audit/checks/` files are NOT modified (T-33b-01 not yet at risk — Wave 0 only writes new files).</done>
</task>

<task type="auto">
  <name>Task 2: Create 33b-DISCOVERY-NORTH-STAR-AUDIT.md skeleton with all 6 sections + 4 decision stubs + skeleton sentinel</name>
  <read_first>
    .planning/phases/33b-discovery-north-star-audit/33b-CONTEXT.md
    .planning/phases/33b-discovery-north-star-audit/33b-RESEARCH.md
    .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
    .planning/seeds/SEED-004-v5-discovery-north-star.md
    .planning/phases/33b-discovery-north-star-audit/checks/quick.sh
  </read_first>
  <files>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
  </files>
  <action>
Create the audit skeleton with this exact structure (use Write tool; do NOT use heredoc). The skeleton must be complete enough that `bash checks/quick.sh` exits 0 immediately after creation.

**Required sections in this exact order (NSD-15 rule 1 ordering):**

1. **YAML frontmatter** (mirrors Phase 33's `33-DISCOVERY-AUDIT.md` keys; updates values; adds `predecessor_audit`):
   ```
   ---
   title: Discovery North-Star Audit — v5.0 SEED-004 Drift-Vector Map
   status: draft
   date: 2026-05-08
   audit_seed: SEED-004
   phase: 33b-discovery-north-star-audit
   requirement: DISC-12
   decision: pending
   predecessor_audit: 33-discovery-audit
   ---
   ```

2. **H1 title and tagline** (informational; mirrors Phase 33 framing):
   ```
   # Discovery North-Star Audit — v5.0

   > Read-only product-framed audit of v5.0 discovery surfaces against the SEED-004 Rdio principle.
   > Zero code, schema, or dependency changes ship in this phase
   > (per ROADMAP §Phase 33b success criterion #5; per NSD-15 rule 6).
   > Phase 33's `33-DISCOVERY-AUDIT.md` is the IMMUTABLE research substrate; this audit cites
   > DISC-AUDIT-NN row ids only and never modifies that table.
   ```

3. **`## Pass/Fail Criteria`** (NSD-15 6 rules verbatim; precedes all findings — NSD-15 ordering rule):
   Insert all 6 rules verbatim from `<interfaces>` block above. Add tag-definition sub-§ explaining NSD-04 status enum (ship/partial/missing/N-A) and NSD-11 leverage enum (high/med/low/—).

4. **`## Rdio Principle Anchor`** (NSD-15 rule 4 anchor):
   ```
   The single anchor for every missing-vector row's rationale is SEED-004 line 15:

   > a collector should be able to drift from one watch / collector / family / reference to another by clicking, without ever feeling lost or running into a dead end.

   Source: `.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15.
   ```

5. **`## Vector Definitions`** (NSD-08 pin):
   Insert the NSD-07 7-vector table verbatim from `<interfaces>` block (3 columns: Vector | One-line definition | PROD or planned anchor). Order: similar-by-taste, same-family/lineage, same-era, other-owners, owner-overlap, evaluative-verdict, see-more-like-this.

6. **`## Leverage Bucket Key`** (NSD-11 pin):
   Insert NSD-11 high/med/low qualifiers verbatim. The qualifier text must include the literal substring "high" "med" "low" each on a separate bullet line.

7. **`## Drift-Vector Audit`** (NSD-13 7-column table — empty; skeleton sentinel beneath header):
   ```
   ## Drift-Vector Audit

   <!-- skeleton -->
   <!-- Wave 1 (Plan 02) MUST remove this sentinel as part of its first NSV-NN row commit. -->
   <!-- After sentinel removal, full.sh enforces 42 rows (NSV-01..NSV-42), all rules. -->

   | row_id | entity | vector | status | leverage | rationale | backing_rows |
   |--------|--------|--------|--------|----------|-----------|--------------|
   ```

8. **`## Decisions`** with 4 stubs Q1→Q4 (NSD-16 verbatim wording + extended template):
   For each of Q1/Q2/Q3/Q4, write the H3 heading + the 5-line template skeleton with placeholder text `TBD by Wave 2 (Plan 03)`:
   ```
   ### Decision Q1: Combine home and explore?

   **Verdict:** TBD (YES | NO | DEFERRED — set in Wave 2)
   **Rationale:** TBD by Wave 2 (Plan 03) — 2–4 sentences citing audit findings.
   **Cited NSV rows:** TBD
   **Backing DISC-AUDIT rows:** TBD
   **Drives:** TBD downstream phase / item gated by this verdict.

   ### Decision Q2: Lineage browse priority

   ... (same 5-line template)

   ### Decision Q3: Dead-end closure priority

   ... (same 5-line template)

   ### Decision Q4: CAT-13 discovery framing

   ... (same 5-line template)
   ```

   Note: the placeholder strings `**Verdict:** TBD ...`, `**Cited NSV rows:** TBD`, `**Backing DISC-AUDIT rows:** TBD`, `**Drives:** TBD ...` will satisfy `full.sh` rule 5a/5c/5d/5e count checks (4 of each label) but will FAIL rule 5b (verdict not in {YES,NO,DEFERRED}) and 5f (no NSV/DISC-AUDIT ids cited yet) until Wave 2 fills them in. This is correct — the skeleton mode short-circuit in `full.sh` defers rules 1-5 until the `<!-- skeleton -->` sentinel is removed.

The skeleton must be authored such that `bash checks/quick.sh` exits 0 immediately after this task commits. Verify by running quick.sh as the verify step.
  </action>
  <verify>
    <automated>bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh</automated>
  </verify>
  <acceptance_criteria>
    - `test -f .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0
    - `bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` exits 0 (file structure valid in skeleton mode)
    - `grep -q '^## Pass/Fail Criteria' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0
    - `grep -q '^## Rdio Principle Anchor' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0
    - `grep -q '^## Vector Definitions' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0
    - `grep -q '^## Leverage Bucket Key' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0
    - `grep -q '^## Drift-Vector Audit' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0
    - `grep -q '^## Decisions' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0
    - Pass/Fail § precedes Drift-Vector Audit § (NSD-15 ordering rule): `awk '/^## Pass.Fail Criteria/{pf=NR} /^## Drift-Vector Audit/{dv=NR} END{exit !(pf<dv && pf>0)}'` exits 0
    - `grep -q '<!-- skeleton -->' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0
    - `grep -qF '| row_id | entity | vector | status | leverage | rationale | backing_rows |' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0
    - `grep -qF 'a collector should be able to drift from one watch / collector / family / reference to another by clicking, without ever feeling lost or running into a dead end.' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0
    - `grep -c '^### Decision Q' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 4
    - `grep -qF '| similar-by-taste |' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0 (vector definition row present)
    - `grep -qF '| see-more-like-this |' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0
    - `git diff --quiet HEAD -- .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` exits 0 (T-33b-01 mitigation: Phase 33 audit not modified)
  </acceptance_criteria>
  <done>The audit skeleton file exists with all 6 top-level sections in the correct NSD-15 order, vector definition table + leverage bucket key + Rdio quote pinned at top, 7-column NSD-13 table header committed (no rows; sentinel present), and 4 decision stubs Q1-Q4 with placeholder text. `bash checks/quick.sh` exits 0. Phase 33's audit file remains untouched per NSD-15 rule 6 (T-33b-01 mitigation verified).</done>
</task>

</tasks>

<verification>
After both tasks commit:

1. `bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` exits 0 (skeleton mode passes structural checks).
2. `bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh` short-circuits in skeleton mode (rules 1-5 deferred); rule 6 (Phase 33 audit immutability) MUST pass.
3. `git diff --quiet HEAD -- .planning/phases/33-discovery-audit/` returns 0 (Phase 33 directory completely untouched).
4. `git status` shows only files under `.planning/phases/33b-discovery-north-star-audit/` modified/created.
5. The audit doc's `## Pass/Fail Criteria` § appears at line < 50 (pinned at top per NSD-15).
</verification>

<success_criteria>
- All 3 files created under `.planning/phases/33b-discovery-north-star-audit/`
- `checks/quick.sh` and `checks/full.sh` are executable bash scripts using only POSIX bash + grep + awk + git (no npm/pip/test framework installs)
- `33b-DISCOVERY-NORTH-STAR-AUDIT.md` skeleton exists with all 6 NSD-required headings in correct order, vector definition table, leverage bucket key, NSD-13 7-column table header, 4 NSD-16 decision stubs Q1-Q4, and skeleton sentinel comment
- `bash checks/quick.sh` exits 0 against the new skeleton (Wave 0 complete)
- Zero modifications to `.planning/phases/33-discovery-audit/` (NSD-15 rule 6 / T-33b-01 mitigation)
- Wave 1 (Plan 02) can begin authoring NSV-NN rows directly against this skeleton
</success_criteria>

<output>
After completion, create `.planning/phases/33b-discovery-north-star-audit/33b-01-SUMMARY.md` per the GSD summary template, capturing:
- Files created (3) with line counts
- NSD ids implemented (NSD-08 / NSD-11 / NSD-13 / NSD-14 / NSD-15 / NSD-16)
- Mechanical verification result: `bash checks/quick.sh` exit 0; `git diff -- 33-discovery-audit/` empty
- Wave 1 readiness signal: skeleton sentinel present; downstream Plan 02 may proceed
</output>

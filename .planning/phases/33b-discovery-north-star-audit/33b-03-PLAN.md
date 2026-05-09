---
phase: 33b
plan: 03
type: execute
wave: 2
depends_on: ["33b-02"]
files_modified:
  - .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
  - .planning/STATE.md
autonomous: true
requirements: [DISC-12]
tags: [audit, documentation, discovery, decisions, nsd-12, nsd-15, nsd-16]

must_haves:
  truths:
    - "All 4 D-17 decisions (Q1 home+explore combine; Q2 lineage browse priority; Q3 dead-end closure priority; Q4 CAT-13 discovery framing) authored with explicit YES/NO/DEFERRED verdict per NSD-16"
    - "Each verdict uses the NSD-16 extended template literally — Verdict / Rationale / Cited NSV rows / Backing DISC-AUDIT rows / Drives — with all 5 labels present (full.sh rule 5a/5b/5c/5d/5e enforce counts)"
    - "Each verdict's rationale is 2-4 sentences citing audit findings, not mechanical restatement of leverage scores per NSD-12 (no hard rule mapping leverage → verdict; authorial judgment preserved)"
    - "Each verdict cites ≥1 NSV-NN row from Wave 1 AND ≥1 DISC-AUDIT-NN backing row from Phase 33 per NSD-15 rule 5 (full.sh rule 5f enforces presence of both id formats on the appropriate label lines)"
    - "Each verdict has a `**Drives:**` line listing the downstream phase / item this verdict gates (Phase 34 dependency-gating; Phase 35 lineage UI scope; Phase 38 CAT-13 framing; Phase 39 polish ordering)"
    - "Q1 verdict (combine home and explore?) anchored to home-vs-explore vector mix asymmetry from NSV-22..28 (Home Feed) vs NSV-29..35 (Explore Feed) plus DISC-AUDIT-29/49 evidence"
    - "Q2 verdict (lineage browse priority) anchored to NSV-16 (Catalog × same-family/lineage = missing high) and Watch Detail × same-family/lineage (NSV-02) plus DISC-AUDIT-130 evidence; Q2 outcome shapes Phase 35 UI scope per STATE.md line 78"
    - "Q3 verdict (dead-end closure priority) anchored to high-leverage missing/partial NSV cells (especially NSV-14 Collector Profile see-more-like-this cluster, NSV-08 Collector Profile similar-by-taste) plus the Phase 33 Missing-row cluster DISC-AUDIT-97/102/111/122/123/124/127/129; output is a sorted Phase 39 backlog ordering"
    - "Q4 verdict (CAT-13 discovery framing) anchored to evaluative-verdict + similar-by-taste cells on Watch Detail and Catalog (NSV-01, NSV-06, NSV-15, NSV-20) plus DISC-AUDIT-70/71/81/82/130/131; outcome shapes Phase 38 plan-motivation framing per STATE.md line 79"
    - "`bash checks/full.sh` exits 0 — all 6 NSD-15 rules + Rule 3 ENHANCED + NSD-14 sequencing pass"
    - "STATE.md `## Accumulated Context` § `### Key Decisions (v5.0)` updated — replace the 'deferred to Phase 33b' line with 4 new entries documenting Q1/Q2/Q3/Q4 verdicts (CONTEXT.md `<code_context>` integration point line 191)"
    - "Audit-doc frontmatter `decision: pending` → `decision: final` upon successful full.sh pass per RESEARCH § Open Questions #2"
    - "Implements decisions: NSD-12 (no hard rule mapping leverage → verdict — preserves authorial judgment), NSD-15 rule 5 (4 verdicts with required labels), NSD-15 rule 6 (Phase 33 audit immutability — verified by git diff inside full.sh), NSD-16 (4 decisions Q1→Q4 in final § using extended template)"
    - "Inherits Phase 33 D-15 single-file format (decisions inline in audit doc, not separate file), D-16 verdict template (extended with NSV-NN cites), D-17 exactly-4-decisions cap"
    - "Zero files modified outside .planning/phases/33b-discovery-north-star-audit/ AND .planning/STATE.md (the latter explicitly permitted by CONTEXT.md `<code_context>` integration point line 191)"
  artifacts:
    - path: ".planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md"
      provides: "Complete audit doc — 42 cells + 4 verdicts; full.sh rule 5 satisfied; frontmatter decision: final"
      contains: "**Verdict:**"
      contains_2: "**Drives:**"
    - path: ".planning/STATE.md"
      provides: "Updated v5.0 Key Decisions § with Q1/Q2/Q3/Q4 verdict entries"
      contains: "Phase 33b Q1"
  key_links:
    - from: "Q1 verdict"
      to: "Phase 39 home/explore consolidation scope"
      via: "**Drives:** line citing Phase 39"
      pattern: "Phase 39"
    - from: "Q2 verdict"
      to: "Phase 35 lineage browse UI scope (per STATE.md line 78)"
      via: "**Drives:** line citing Phase 35"
      pattern: "Phase 35"
    - from: "Q3 verdict"
      to: "Phase 39 polish ordering — sorted high-leverage backlog"
      via: "**Drives:** line citing Phase 39 + sorted NSV/DISC-AUDIT row list"
      pattern: "Phase 39"
    - from: "Q4 verdict"
      to: "Phase 38 CAT-13 plan motivation framing (per STATE.md line 79)"
      via: "**Drives:** line citing Phase 38"
      pattern: "Phase 38"
    - from: "every verdict's **Cited NSV rows:** line"
      to: "NSV-NN rows authored in Plan 02"
      via: "≥1 NSV-NN id per verdict (full.sh rule 5f)"
      pattern: "NSV-[0-9]+"
    - from: "every verdict's **Backing DISC-AUDIT rows:** line"
      to: "DISC-AUDIT-NN rows in Phase 33's immutable table"
      via: "≥1 DISC-AUDIT-NN id per verdict; existence verified by Rule 3 ENHANCED"
      pattern: "DISC-AUDIT-[0-9]+"
---

<objective>
Author the 4 D-17 verdicts in the `## Decisions` § of `33b-DISCOVERY-NORTH-STAR-AUDIT.md` (replacing the Plan 01 stub placeholders), bringing the audit to completion. Apply the NSD-16 extended template literally to each verdict (Verdict / Rationale / Cited NSV rows / Backing DISC-AUDIT rows / Drives) so `bash checks/full.sh` rule 5 passes. Per NSD-12, leverage scores INFORM verdict rationale but do NOT mechanically force YES/NO/DEFERRED — authorial judgment is preserved.

After verdicts ship, update `STATE.md`'s `### Key Decisions (v5.0)` § per CONTEXT.md `<code_context>` integration point (replace the "deferred to Phase 33b" placeholder line with 4 new entries summarizing Q1/Q2/Q3/Q4 verdicts), and flip the audit-doc frontmatter `decision: pending → final`.

Final mechanical gate: `bash checks/full.sh` must exit 0 (all 6 NSD-15 rules + Rule 3 ENHANCED + NSD-14 sequencing pass). NSD-15 rule 6 (Phase 33 audit immutability) is the last failure mode to verify — `git diff -- .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` MUST return empty.

Purpose: produce the 4 product judgments downstream phases consume — Phase 34 dependency-gating verdict, Phase 35 Q2 lineage browse UI scope, Phase 38 Q4 CAT-13 plan-motivation framing, Phase 39 Q1+Q3 polish backlog ordering. Each verdict's `**Drives:**` line is the explicit handoff signal.

Output: 4 populated decision blocks in the existing `## Decisions` § (replacing Plan 01 TBD stubs), STATE.md updated, audit-doc frontmatter `decision: final`, full.sh exit 0, Phase 33 audit unmodified.
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
@.planning/phases/33b-discovery-north-star-audit/33b-02-SUMMARY.md
@.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
@.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
@.planning/phases/33-discovery-audit/33-CONTEXT.md
@.planning/seeds/SEED-004-v5-discovery-north-star.md

<interfaces>
<!-- NSD-16 four decisions (verbatim Q1→Q4 order — must match Plan 01 skeleton stub headings exactly): -->
<!--   Q1: Combine home and explore? -->
<!--   Q2: Lineage browse priority -->
<!--   Q3: Dead-end closure priority -->
<!--   Q4: CAT-13 discovery framing -->

<!-- NSD-16 per-decision template (verbatim — every label is grep-target for full.sh rule 5): -->
<!--   ### Decision QN: <question text> -->
<!--   -->
<!--   **Verdict:** YES | NO | DEFERRED -->
<!--   **Rationale:** [2-4 sentences citing audit findings] -->
<!--   **Cited NSV rows:** NSV-NN, NSV-MM, ... -->
<!--   **Backing DISC-AUDIT rows:** DISC-AUDIT-NN, DISC-AUDIT-MM, ... -->
<!--   **Drives:** [downstream phase / item this verdict gates] -->

<!-- full.sh rule 5 mechanical enforcement: -->
<!--   5a: 4 lines starting with `**Verdict:**` -->
<!--   5b: each Verdict value matches \\b(YES|NO|DEFERRED)\\b -->
<!--   5c: 4 lines starting with `**Cited NSV rows:**` -->
<!--   5d: 4 lines starting with `**Backing DISC-AUDIT rows:**` -->
<!--   5e: 4 lines starting with `**Drives:**` -->
<!--   5f: each Cited NSV rows line lists ≥1 NSV-[0-9]+; each Backing DISC-AUDIT rows line lists ≥1 DISC-AUDIT-[0-9]+ -->

<!-- NSD-12 (locked): leverage informs verdict but does NOT mechanically force a YES/NO/DEFERRED. -->
<!--   Authorial judgment preserved. A high-leverage missing vector can produce a DEFERRED verdict if -->
<!--   the user judges the timing wrong (e.g., Q2 may rate same-family/lineage as high-leverage on -->
<!--   Catalog but verdict can resolve DEFERRED if Phase 35 ships schema-only and UI work belongs in -->
<!--   a separate phase). -->

<!-- Per-decision rationale anchor sketches (CONTEXT.md <specifics> lines 220-225): -->
<!--   Q1: compare Home Feed × {7 vectors} vs Explore Feed × {7 vectors}. Overlap → YES; -->
<!--       complementary mix → NO. NSV-22..28 vs NSV-29..35 is the evidence. -->
<!--   Q2: hinges on Catalog × same-family/lineage (NSV-16) and Watch Detail × same-family/lineage -->
<!--       (NSV-02) leverage. High on both → YES (Phase 35 ships browse UI). High on Catalog only → -->
<!--       DEFERRED (schema in Phase 35, UI in Phase 39 or v5.x). -->
<!--   Q3: aggregate the high-leverage missing + partial rows; identify Top-N by leverage for -->
<!--       Phase 39 ordering. Output is a sorted list, not a list of every closure. -->
<!--   Q4: hinges on Watch Detail + Catalog × evaluative-verdict and similar-by-taste leverage -->
<!--       (NSV-01, NSV-06, NSV-15, NSV-20). High on both = "discovery improvement" framing for -->
<!--       Phase 38. Low/mixed = "tech debt" framing acceptable. -->

<!-- STATE.md update target — CONTEXT.md <code_context> integration point line 191: -->
<!--   Locate the line in `### Key Decisions (v5.0)` that says: -->
<!--     "Phase 33b inserted 2026-05-08: the 4 D-17 product decisions ... deferred to Phase 33b ..." -->
<!--   Append (do NOT replace — this line is project-history) 4 new bullets summarizing the verdicts: -->
<!--     - Phase 33b Q1 verdict (2026-05-08+): {YES|NO|DEFERRED} — combine home and explore? — drives ... -->
<!--     - Phase 33b Q2 verdict: {YES|NO|DEFERRED} — lineage browse priority — drives Phase 35 UI scope ... -->
<!--     - Phase 33b Q3 verdict: {YES|NO|DEFERRED} — dead-end closure priority — drives Phase 39 ordering ... -->
<!--     - Phase 33b Q4 verdict: {YES|NO|DEFERRED} — CAT-13 framing — drives Phase 38 plan motivation ... -->

<!-- Audit-doc frontmatter flip — RESEARCH § Open Questions #2: -->
<!--   `decision: pending` → `decision: final` -->
<!--   This flip is the closing signal that the audit is shippable. -->
</interfaces>

<verdict_authoring_discipline>
**For each Q1-Q4 verdict, follow this rigid 4-step authoring discipline:**

**Step 1 — Survey the evidence:** read the relevant NSV cells in the Drift-Vector Audit table (per the per-decision anchor sketches above) AND the cited Phase 33 DISC-AUDIT rows. Note the cell statuses, leverage tags, and rationales.

**Step 2 — Form the judgment (per NSD-12):** the leverage scores INFORM but do NOT mechanically force the verdict. Consider: does the evidence support a YES (high-leverage cluster + downstream phase ready), a NO (vectors are complementary not redundant), or a DEFERRED (high-leverage but timing wrong / scope-bounded to schema-only)? This is product judgment, not a count.

**Step 3 — Write the rationale (2-4 sentences):**
- Sentence 1: state the verdict's core reasoning
- Sentence 2: cite specific NSV cell evidence (e.g., "NSV-22 Home Feed × similar-by-taste ships via DISC-AUDIT-29 while NSV-29 Explore Feed × similar-by-taste is missing")
- Sentence 3: optional — note tradeoffs or alternative readings (e.g., "alternative readings prefer combining for surface consolidation, but the vector-mix asymmetry argues otherwise")
- Sentence 4: optional — explicit downstream-phase connection
- DO NOT write fix proposals (Pitfall #4 — recommendation drift). DO NOT introduce new vectors or 5th decisions (Pitfall #3 — 5th-decision creep).

**Step 4 — Populate the 5 template fields literally:**
- `**Verdict:**` — exactly one of YES, NO, DEFERRED (case-sensitive — full.sh rule 5b enforces)
- `**Rationale:**` — the 2-4 sentence prose
- `**Cited NSV rows:**` — comma-separated `NSV-NN` ids, ≥1 (full.sh rule 5f)
- `**Backing DISC-AUDIT rows:**` — comma-separated `DISC-AUDIT-NN` ids, ≥1 (full.sh rule 5f + Rule 3 ENHANCED existence check)
- `**Drives:**` — concrete downstream phase / item; format `Phase NN <name> — <what this verdict shapes>`

**Anti-patterns:**
- Hedging verdicts ("YES, partially" or "NO, but consider...") — full.sh rule 5b expects exactly one of {YES, NO, DEFERRED}
- Citing NSV-NN rows that don't exist (Pitfall #2) — every cited NSV-NN must be in the Drift-Vector Audit table
- Citing DISC-AUDIT-NN rows that don't exist in Phase 33 (Pitfall #2) — Rule 3 ENHANCED catches this
- Verdict text inconsistent with rationale (e.g., **Verdict:** YES with rationale arguing complementarity)
</verdict_authoring_discipline>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Local repo filesystem → committed git history | Verdicts are static markdown; no externally-reachable surface. Same scope as Plans 01/02. STATE.md modification is a project-management update, not application code. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-33b-01 | Tampering | `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` (immutable Phase 33 substrate) | mitigate | `checks/full.sh` Rule 6 enforces `git diff -- 33-DISCOVERY-AUDIT.md` returns empty. Plan 03 author cites DISC-AUDIT-NN ids by paste from the Phase 33 table; never edits it. |
| T-33b-02 | Tampering | Cited NSV-NN or DISC-AUDIT-NN ids that don't exist | mitigate | Rule 3 ENHANCED catches DISC-AUDIT-NN typos. NSV-NN cite verification is author-time discipline (cite by paste from Wave 1's audit table, not retype). |
| T-33b-03 | Repudiation | Verdict-vs-rationale mismatch (e.g., **Verdict:** YES paired with NO-style rationale) | accept | Manual reviewer signs the Validation Sign-Off after `/gsd-verify-work`; full.sh cannot detect semantic verdict-rationale alignment. Mitigation = author discipline per `<verdict_authoring_discipline>` Step 4 anti-patterns + reviewer manual check. |
</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Author Q1 verdict (Combine home and explore?) using NSD-16 extended template</name>
  <read_first>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
    .planning/phases/33b-discovery-north-star-audit/33b-02-SUMMARY.md
    .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
    .planning/phases/33b-discovery-north-star-audit/33b-CONTEXT.md
  </read_first>
  <files>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
  </files>
  <action>
**Authoring scope:** replace the Plan 01 Q1 stub (TBD placeholders) with a fully-authored verdict per NSD-16 extended template. Apply the 4-step `<verdict_authoring_discipline>`.

**Q1 evidence anchor (per CONTEXT.md `<specifics>` line 221):** compare Home Feed × {7 vectors} (NSV-22..28) vs Explore Feed × {7 vectors} (NSV-29..35). Per RESEARCH-ASSUMED status estimates:
- Home Feed: similar-by-taste = ship (NSV-22 / DISC-AUDIT-29); other-owners = partial/ship (NSV-25); owner-overlap = partial/missing (NSV-26 / DISC-AUDIT-38); see-more-like-this = partial/ship (NSV-28)
- Explore Feed: similar-by-taste = missing (NSV-29); other-owners = ship (NSV-32 / DISC-AUDIT-49); owner-overlap = missing (NSV-33); see-more-like-this = ship (NSV-35 / DISC-AUDIT-52, 54)
- Asymmetry: Home ships personalized rec-engine vectors (similar-by-taste, owner-overlap) Explore lacks; Explore ships raw-popularity vectors (other-owners, see-more-like-this) Home only partially has.

**Verdict heuristic (NSD-12 — judgment, not mechanical):**
- High overlap of shipping vectors → YES (combine; redundancy argues for consolidation)
- Complementary vector mixes (Home = personalized; Explore = popularity) → NO (two distinct purposes; combining forces compromise)
- High overlap of MISSING vectors with strong arguments either way → DEFERRED (let polish phase reveal the right architecture)

**Author the verdict:** based on the Wave 1 NSV-22..35 cell statuses (which the Plan 02 author committed), choose YES, NO, or DEFERRED. Pre-RESEARCH-ASSUMED reading favors NO or DEFERRED (complementary mixes); the actual Wave 1 statuses determine the final call.

**Required template fields (full.sh rule 5 mechanical):**
- `### Decision Q1: Combine home and explore?` — H3 heading must match exactly (Plan 01 skeleton wrote it; verify still present)
- `**Verdict:** {YES|NO|DEFERRED}` — exactly one value, case-sensitive
- `**Rationale:** {2-4 sentences citing audit findings}` — must include cell evidence and product reasoning
- `**Cited NSV rows:** NSV-22, NSV-26, NSV-28, NSV-29, NSV-33, NSV-35` (or subset of the relevant cells — at least 1 cite required; recommended 4-6 cites covering both Home and Explore evidence)
- `**Backing DISC-AUDIT rows:** DISC-AUDIT-29, DISC-AUDIT-38, DISC-AUDIT-49, DISC-AUDIT-52` (or relevant subset; at least 1 required; recommended cites span both Home and Explore Phase 33 rows)
- `**Drives:** Phase 39 Audit-Driven Discovery Polish — home/explore consolidation work {DEFERRED to v5.x | scoped into Phase 39 | scoped per verdict outcome}`

Use the Edit tool to replace the Plan 01 Q1 stub with the authored content. Do NOT use Write for this single decision — Edit preserves the surrounding skeleton structure.

Commit with message `docs(33b-03): author Q1 verdict (home+explore combine? = {VERDICT})`.

Run `bash checks/full.sh` — rule 5a/c/d/e count checks now show 1/4 verdict labels (other 3 still TBD); that's expected after this task. Confirm rule 5 doesn't pass yet but no NEW failure introduced.
  </action>
  <verify>
    <automated>grep -A 1 '^### Decision Q1' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -qE '\*\*Verdict:\*\* (YES|NO|DEFERRED)' && grep -A 4 '^### Decision Q1' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -qE 'NSV-[0-9]+' && grep -A 5 '^### Decision Q1' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -qE 'DISC-AUDIT-[0-9]+'</automated>
  </verify>
  <acceptance_criteria>
    - Q1 verdict authored: `grep -A 1 '^### Decision Q1' 33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -qE '\*\*Verdict:\*\* (YES|NO|DEFERRED)'` exits 0
    - Q1 verdict value is exactly one of {YES, NO, DEFERRED} (no hedging text)
    - Q1 cites ≥1 NSV-NN row in `**Cited NSV rows:**` line: NSV-NN ids in Q1 block grep > 0
    - Q1 cites ≥1 DISC-AUDIT-NN row in `**Backing DISC-AUDIT rows:**` line: DISC-AUDIT-NN ids in Q1 block grep > 0
    - Q1 has `**Drives:**` line: `grep -A 6 '^### Decision Q1' 33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -q '\*\*Drives:\*\*'` exits 0
    - Q1 cited NSV-NN ids exist in the Drift-Vector Audit table (each cited NSV is a real row from Plan 02)
    - Q1 cited DISC-AUDIT-NN ids exist in Phase 33's table (Rule 3 ENHANCED partial check for Q1's cites)
    - Phase 33 audit untouched: `git diff --quiet HEAD -- .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` exits 0
  </acceptance_criteria>
  <done>Q1 verdict (Combine home and explore?) authored with explicit YES/NO/DEFERRED choice, 2-4 sentence rationale citing Home/Explore vector mix asymmetry, ≥1 NSV-NN cite, ≥1 DISC-AUDIT-NN cite, and `**Drives:**` line referencing Phase 39. Plan 01 Q1 stub fully replaced. Phase 33 audit unmodified.</done>
</task>

<task type="auto">
  <name>Task 2: Author Q2 verdict (Lineage browse priority) using NSD-16 extended template</name>
  <read_first>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
    .planning/phases/33b-discovery-north-star-audit/33b-02-SUMMARY.md
    .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
    .planning/STATE.md
  </read_first>
  <files>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
  </files>
  <action>
**Authoring scope:** replace the Plan 01 Q2 stub with a fully-authored verdict per NSD-16 extended template.

**Q2 evidence anchor (per CONTEXT.md `<specifics>` line 222):** Q2 hinges on:
- NSV-16 Catalog × same-family/lineage = missing high (PRE-ANCHORED — DISC-AUDIT-130; Q2 anchor)
- NSV-02 Watch Detail × same-family/lineage (likely missing per Plan 02 RESEARCH-ASSUMED)
- NSV-09 Collector Profile × same-family/lineage (likely missing)

**Verdict heuristic (NSD-12 + STATE.md line 78 cross-check):**
- High leverage on Catalog AND Watch Detail same-family/lineage cells → tendency toward YES (ship browse UI in Phase 35)
- High on Catalog only with weak Watch Detail / Profile cases → DEFERRED (schema in Phase 35; UI in Phase 39 or v5.x — schema-only Phase 35 scope is the project's locked default per STATE.md line 78)
- Low across the board → DEFERRED to v5.x (very unlikely given NSV-16 high-leverage pre-anchor)

**STATE.md line 78 says:** "Phase 35 lineage browse UI scope is audit-conditional on Phase 33b Q2 verdict: Phase 35 ships schema-only; browse UI affordances move to Phase 39 or v5.x per Phase 33b lineage-priority verdict." This frames the verdict as a binary between (a) shipping browse UI in Phase 35 vs (b) deferring browse UI to Phase 39 or v5.x. RESEARCH-ASSUMED reading favors DEFERRED — schema work is large enough to warrant Phase 35 focus; UI work belongs in a polish phase.

**Required template fields:**
- `### Decision Q2: Lineage browse priority` — H3 heading exact match
- `**Verdict:** {YES|NO|DEFERRED}` — semantics: YES = ship browse UI in Phase 35; NO = browse UI is not a v5.0 priority at all; DEFERRED = browse UI scope moves to Phase 39 or v5.x
- `**Rationale:** {2-4 sentences}` — must cite NSV-16 high-leverage missing + DISC-AUDIT-130 + the Phase 35 vs Phase 39 timing tradeoff
- `**Cited NSV rows:** NSV-16, NSV-02, NSV-09` (or appropriate subset; at least 1)
- `**Backing DISC-AUDIT rows:** DISC-AUDIT-130` (PRE-ANCHORED Q2 cite; at least 1)
- `**Drives:** Phase 35 Layer B — Lineage Edges + Structured Movement + Era/Material — UI scope: {browse UI in Phase 35 | schema-only; browse UI deferred to Phase 39 | schema-only; browse UI deferred to v5.x}`

Use Edit to replace the Plan 01 Q2 stub. Commit with message `docs(33b-03): author Q2 verdict (lineage browse priority = {VERDICT})`.

Run `bash checks/full.sh` — rule 5a/c/d/e count checks now show 2/4 verdict labels.
  </action>
  <verify>
    <automated>grep -A 1 '^### Decision Q2' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -qE '\*\*Verdict:\*\* (YES|NO|DEFERRED)' && grep -A 5 '^### Decision Q2' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -q 'NSV-16' && grep -A 5 '^### Decision Q2' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -q 'DISC-AUDIT-130'</automated>
  </verify>
  <acceptance_criteria>
    - Q2 verdict authored with explicit {YES|NO|DEFERRED}
    - Q2 cites NSV-16 (the Q2 anchor cell from Plan 02): grep matches 'NSV-16' in Q2 block
    - Q2 cites DISC-AUDIT-130 (the Q2 backing row in Phase 33): grep matches 'DISC-AUDIT-130' in Q2 block
    - Q2 has `**Drives:**` line referencing Phase 35
    - Phase 33 audit untouched
  </acceptance_criteria>
  <done>Q2 verdict (Lineage browse priority) authored with explicit verdict choice, rationale citing NSV-16 high-leverage missing + DISC-AUDIT-130 + Phase 35 vs Phase 39 timing, ≥1 NSV/DISC-AUDIT cite each, `**Drives:**` line referencing Phase 35 UI scope. Plan 01 Q2 stub fully replaced. Phase 33 audit unmodified.</done>
</task>

<task type="auto">
  <name>Task 3: Author Q3 verdict (Dead-end closure priority) using NSD-16 extended template</name>
  <read_first>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
    .planning/phases/33b-discovery-north-star-audit/33b-02-SUMMARY.md
    .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
  </read_first>
  <files>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
  </files>
  <action>
**Authoring scope:** replace the Plan 01 Q3 stub with a fully-authored verdict per NSD-16 extended template.

**Q3 evidence anchor (per CONTEXT.md `<specifics>` line 223):** Q3 aggregates the high-leverage missing + partial rows; identifies Top-N by leverage for Phase 39 ordering. Output is a sorted list, not a list of every closure (low-leverage rows DEFERRED to v5.x).

**Primary anchor cells (PRE-ANCHORED from Plan 02):**
- NSV-14 Collector Profile × see-more-like-this = missing (the dominant Q3 dead-end cluster — DISC-AUDIT-97/102/111/122/123/124/127/99 — 8 underlying Phase 33 Missing rows)
- NSV-08 Collector Profile × similar-by-taste = missing high (DISC-AUDIT-129)
- NSV-01 Watch Detail × similar-by-taste = partial high (DISC-AUDIT-82 — cheapest one-line patch)
- NSV-06 Watch Detail × evaluative-verdict = partial high (DISC-AUDIT-81 + DISC-AUDIT-131)
- NSV-16 Catalog × same-family/lineage = missing high (DISC-AUDIT-130 — overlap with Q2)
- NSV-20 Catalog × evaluative-verdict = partial high (DISC-AUDIT-70 + DISC-AUDIT-130)

**Verdict semantics (Q3 is unique among the 4 — it's a prioritization verdict, not a binary):**
- Q3 verdict is YES (Phase 39 closes Top-N high-leverage cells) — the question is the SHAPE of the priority list, not whether it ships
- Alternatively NO (no Phase 39 polish work; freeze missing/partial state for v5.x — unlikely)
- Alternatively DEFERRED (Phase 39 scope is undefined; revisit at Phase 39 plan time — possible if Q1/Q2/Q4 outcomes change Phase 39's character)

RESEARCH-ASSUMED most-likely verdict: YES with a sorted Top-N list embedded in the rationale. The list should be sorted by NSD-09 leverage rubric output:
1. NSV-01 (Watch Detail × similar-by-taste partial high) — cheapest fix; one-line text→Link patch
2. NSV-06 (Watch Detail × evaluative-verdict partial high) — viewer-state divergence patch
3. NSV-08 (Collector Profile × similar-by-taste missing high) — insights cards Link wrap
4. NSV-14 sub-cells (Collector Profile see-more-like-this cluster) — locked-tab CTAs, calendar day onClick, common-ground 404 walk-back
5. NSV-16 / NSV-20 (Catalog same-family/lineage + evaluative-verdict) — overlap with Q2/Q4 verdicts

**Required template fields:**
- `### Decision Q3: Dead-end closure priority` — H3 heading exact match
- `**Verdict:** {YES|NO|DEFERRED}` — most likely YES with sorted backlog; alternatives possible based on Q1/Q2/Q4 outcomes
- `**Rationale:** {2-4 sentences}` — must enumerate the high-leverage cluster + reference the Phase 33 Missing-row cluster (DISC-AUDIT-97/102/111/122/123/124/127/129 — 8 of 10 Phase 33 Missing rows live in Collector Profile)
- `**Cited NSV rows:**` — at minimum NSV-01, NSV-06, NSV-08, NSV-14, NSV-16, NSV-20 (or the subset matching the actual high-leverage cells from Plan 02)
- `**Backing DISC-AUDIT rows:**` — at minimum DISC-AUDIT-82, DISC-AUDIT-81, DISC-AUDIT-129 + at least 2-3 of the Q3-cluster rows (DISC-AUDIT-97, 102, 111, 122, 123, 124, 127)
- `**Drives:** Phase 39 Audit-Driven Discovery Polish — sorted high-leverage backlog: NSV-XX, NSV-YY, NSV-ZZ ... (top-N rows for Phase 39 closure ordering)`

Use Edit to replace the Plan 01 Q3 stub. Commit with message `docs(33b-03): author Q3 verdict (dead-end closure priority = {VERDICT})`.

Run `bash checks/full.sh` — rule 5a/c/d/e count checks now show 3/4 verdict labels.
  </action>
  <verify>
    <automated>grep -A 1 '^### Decision Q3' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -qE '\*\*Verdict:\*\* (YES|NO|DEFERRED)' && grep -A 6 '^### Decision Q3' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -qE 'NSV-(01|06|08|14|16|20)' && grep -A 6 '^### Decision Q3' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -qE 'DISC-AUDIT-(82|81|129|97|102|111|122|127)'</automated>
  </verify>
  <acceptance_criteria>
    - Q3 verdict authored with explicit {YES|NO|DEFERRED}
    - Q3 cites ≥3 high-leverage NSV-NN rows (typical: NSV-01, NSV-06, NSV-08, NSV-14, NSV-16, NSV-20)
    - Q3 cites ≥3 DISC-AUDIT-NN rows from the Q3-cluster (typical: DISC-AUDIT-82, DISC-AUDIT-81, DISC-AUDIT-129 + at least 2 locked-tab cluster rows)
    - Q3 has `**Drives:**` line referencing Phase 39 with a sorted NSV-NN backlog list
    - Phase 33 audit untouched
  </acceptance_criteria>
  <done>Q3 verdict (Dead-end closure priority) authored with explicit verdict choice, rationale enumerating the high-leverage cluster, ≥3 NSV-NN cites, ≥3 DISC-AUDIT-NN cites, `**Drives:**` line listing the sorted Phase 39 backlog. Plan 01 Q3 stub fully replaced. Phase 33 audit unmodified.</done>
</task>

<task type="auto">
  <name>Task 4: Author Q4 verdict (CAT-13 discovery framing) + run full.sh + flip frontmatter to decision: final + update STATE.md</name>
  <read_first>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
    .planning/phases/33b-discovery-north-star-audit/33b-02-SUMMARY.md
    .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md
    .planning/STATE.md
    .planning/phases/33b-discovery-north-star-audit/checks/full.sh
  </read_first>
  <files>
    .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md
    .planning/STATE.md
  </files>
  <action>
**This task has 4 sub-steps; complete in order.**

**Sub-step 4a — Author Q4 verdict.** Replace the Plan 01 Q4 stub with a fully-authored verdict per NSD-16 extended template.

**Q4 evidence anchor (per CONTEXT.md `<specifics>` line 224 + STATE.md line 79):** Q4 hinges on Watch Detail + Catalog × evaluative-verdict and similar-by-taste leverage:
- NSV-01 Watch Detail × similar-by-taste = partial high (DISC-AUDIT-82)
- NSV-06 Watch Detail × evaluative-verdict = partial high (DISC-AUDIT-81 + DISC-AUDIT-131)
- NSV-15 Catalog × similar-by-taste = partial (DISC-AUDIT-71)
- NSV-20 Catalog × evaluative-verdict = partial high (DISC-AUDIT-70 + DISC-AUDIT-130)

**Verdict semantics (Q4 is the framing decision for Phase 38):**
- YES = "discovery improvement" framing — Phase 38 plans frame CAT-13 catalog→similarity engine rewire as a v5.0 discovery feature (high-leverage on both Watch Detail and Catalog evaluative-verdict + similar-by-taste cells supports this)
- NO = "tech debt" framing — Phase 38 plans frame CAT-13 as cleanup work without discovery framing
- DEFERRED = framing decision punted to Phase 38 plan-authoring time

RESEARCH-ASSUMED most-likely verdict: YES with "discovery improvement" framing — the 4 anchor cells (NSV-01/06/15/20) are uniformly partial-high or partial, and CAT-13's effect (rewiring the engine to read catalog taste columns at JOIN time) directly upgrades evaluative-verdict cell statuses + similar-by-taste cell statuses. Phase 38 plans should frame the work as discovery improvement, not tech debt cleanup.

**Required template fields:**
- `### Decision Q4: CAT-13 discovery framing` — H3 heading exact match
- `**Verdict:** {YES|NO|DEFERRED}` — YES = discovery improvement framing for Phase 38; NO = tech debt framing; DEFERRED = decide at Phase 38 plan time
- `**Rationale:** {2-4 sentences}` — must cite the 4 anchor cells (NSV-01, NSV-06, NSV-15, NSV-20) + their backing DISC-AUDIT rows + connect to Phase 38 plan-motivation framing
- `**Cited NSV rows:** NSV-01, NSV-06, NSV-15, NSV-20` (or subset; ≥1 required)
- `**Backing DISC-AUDIT rows:** DISC-AUDIT-70, DISC-AUDIT-71, DISC-AUDIT-81, DISC-AUDIT-82, DISC-AUDIT-130, DISC-AUDIT-131` (or relevant subset; ≥1 required)
- `**Drives:** Phase 38 CAT-13 Engine Rewire — plan motivation framing: {discovery improvement | tech debt | TBD at Phase 38 plan time}`

Use Edit to replace the Plan 01 Q4 stub.

**Sub-step 4b — Flip audit-doc frontmatter `decision: pending → decision: final`.**

Use Edit to change the frontmatter line `decision: pending` to `decision: final` per RESEARCH § Open Questions #2.

**Sub-step 4c — Run `bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh`. ALL 6 NSD-15 rules + Rule 3 ENHANCED + NSD-14 sequencing MUST pass (exit 0).**

If full.sh fails, inspect which rule fired:
- Rule 5a/b/c/d/e: a verdict label is missing or value is wrong; fix the offending Q-block
- Rule 5f: a verdict cited zero NSV-NN or zero DISC-AUDIT-NN; add the missing cite
- Rule 6: Phase 33 audit modified — undo any inadvertent change immediately (`git checkout -- .planning/phases/33-discovery-audit/`)
- Rule 3 ENHANCED: a cited DISC-AUDIT-NN doesn't exist in Phase 33 — fix the typo

DO NOT proceed to Sub-step 4d unless full.sh exits 0.

**Sub-step 4d — Update `.planning/STATE.md` `### Key Decisions (v5.0)` § per CONTEXT.md `<code_context>` integration point line 191.**

Use Edit to APPEND (do NOT replace — preserve project-history) 4 new bullets after the existing "Phase 33b inserted 2026-05-08:" bullet, summarizing the 4 verdicts:

```
- Phase 33b Q1 verdict (2026-05-08+): {YES|NO|DEFERRED} — combine home and explore? — drives Phase 39 polish ordering / home+explore consolidation scope per `33b-DISCOVERY-NORTH-STAR-AUDIT.md` § Decisions
- Phase 33b Q2 verdict: {YES|NO|DEFERRED} — lineage browse priority — drives Phase 35 UI scope (browse UI in Phase 35 vs deferred to Phase 39 or v5.x) per `33b-DISCOVERY-NORTH-STAR-AUDIT.md` § Decisions
- Phase 33b Q3 verdict: {YES|NO|DEFERRED} — dead-end closure priority — drives Phase 39 sorted backlog ordering per `33b-DISCOVERY-NORTH-STAR-AUDIT.md` § Decisions
- Phase 33b Q4 verdict: {YES|NO|DEFERRED} — CAT-13 discovery framing — drives Phase 38 plan motivation ({discovery improvement | tech debt} framing) per `33b-DISCOVERY-NORTH-STAR-AUDIT.md` § Decisions
```

Replace `{YES|NO|DEFERRED}` placeholders with the actual verdict values from Tasks 1, 2, 3, 4. Replace the `{discovery improvement | tech debt}` placeholder with Q4's actual framing choice.

Also update STATE.md `## Current Position`:
- Change `Phase: 33 — COMPLETE (4/4 plans; Pass D verdicts deferred to Phase 33b)` to `Phase: 33b — COMPLETE (3/3 plans; 4 D-17 verdicts authored)`
- Change `Next: Phase 33b — Discovery North-Star Audit (DISC-12)` to `Next: Phase 34 — Layer A — Brand + Family Entities (CAT-15)`
- Update `Last activity` line to today's date with summary "Phase 33b closed; 4 D-17 verdicts published"

**Sub-step 4e — Final verification.** Run `bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh` once more after STATE.md update. STATE.md changes do NOT affect Phase 33's audit (T-33b-01 — STATE.md is outside the 33-discovery-audit/ directory), so Rule 6 still passes.

Commit with message `docs(33b-03): author Q4 verdict; flip decision: final; update STATE.md with 4 verdicts; close Phase 33b`.
  </action>
  <verify>
    <automated>bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh && grep -q '^decision: final$' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md && grep -q 'Phase 33b Q4 verdict' .planning/STATE.md && [ "$(grep -c '^\*\*Verdict:\*\*' .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md)" = "4" ]</automated>
  </verify>
  <acceptance_criteria>
    - Q4 verdict authored with explicit {YES|NO|DEFERRED}
    - Q4 cites ≥1 of NSV-01/06/15/20 (the 4 Q4 anchor cells)
    - Q4 cites ≥1 of DISC-AUDIT-70/71/81/82/130/131 (the 6 Q4 backing rows)
    - Q4 has `**Drives:**` line referencing Phase 38 with framing choice
    - Audit-doc frontmatter has `decision: final` (was `decision: pending` from Plan 01): `grep -q '^decision: final$' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` exits 0
    - All 4 verdicts present: `grep -c '^\*\*Verdict:\*\*' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 4
    - All 4 verdict values in {YES, NO, DEFERRED}: `grep '^\*\*Verdict:\*\*' 33b-DISCOVERY-NORTH-STAR-AUDIT.md | grep -vE '\b(YES|NO|DEFERRED)\b'` returns empty
    - 4 Cited NSV rows lines: `grep -c '^\*\*Cited NSV rows:\*\*' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 4
    - 4 Backing DISC-AUDIT rows lines: `grep -c '^\*\*Backing DISC-AUDIT rows:\*\*' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 4
    - 4 Drives lines: `grep -c '^\*\*Drives:\*\*' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 4
    - **Final mechanical gate: `bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh` exits 0 — all 6 NSD-15 rules + Rule 3 ENHANCED + NSD-14 sequencing pass**
    - STATE.md updated with 4 verdict entries: `grep -c 'Phase 33b Q[1234] verdict' .planning/STATE.md` returns 4
    - STATE.md `## Current Position` reflects Phase 33b complete and Phase 34 next
    - Phase 33 audit untouched: `git diff --quiet HEAD -- .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` exits 0 (T-33b-01 mitigation green at phase close)
  </acceptance_criteria>
  <done>Q4 verdict authored; all 4 D-17 verdicts complete; full.sh exits 0 (all 6 NSD-15 rules + Rule 3 ENHANCED + NSD-14 pass); audit-doc frontmatter `decision: final`; STATE.md updated with 4 verdict entries and Phase 34 next-up signal; Phase 33 audit unmodified throughout. Phase 33b is shippable.</done>
</task>

</tasks>

<verification>
After all 4 tasks commit:

1. `bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh` exits 0 (all 6 NSD-15 rules + Rule 3 ENHANCED + NSD-14 sequencing green).
2. `grep -c '^\*\*Verdict:\*\*' 33b-DISCOVERY-NORTH-STAR-AUDIT.md` returns 4 (NSD-15 rule 5a satisfied).
3. All 4 verdicts have values in {YES, NO, DEFERRED} (NSD-15 rule 5b satisfied).
4. All 4 verdicts have `**Cited NSV rows:**`, `**Backing DISC-AUDIT rows:**`, `**Drives:**` labels (NSD-15 rule 5c/d/e satisfied).
5. Each verdict cites ≥1 NSV-NN AND ≥1 DISC-AUDIT-NN (NSD-15 rule 5f satisfied).
6. Audit-doc frontmatter has `decision: final` (closing signal).
7. STATE.md `## Accumulated Context > Key Decisions (v5.0)` § has 4 new bullets (Q1/Q2/Q3/Q4 verdicts).
8. STATE.md `## Current Position` shows Phase 33b complete and Phase 34 next.
9. `git diff --quiet HEAD -- .planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` returns 0 (T-33b-01 mitigation green throughout the phase).
10. `git diff --quiet HEAD -- .planning/phases/33-discovery-audit/` returns 0 (entire Phase 33 directory untouched).

**Manual reviewer must additionally confirm (per VALIDATION.md Manual-Only Verifications):**
- Each verdict's cited NSV rows actually justify the verdict claim (semantic anchor check)
- SEED-004 anchor uniformity across all missing rows (no paraphrased anchors)
- Worst-case viewer-state correctness (NSD-06) on Watch Detail / Catalog / Collector Profile cells
</verification>

<success_criteria>
- All 4 D-17 verdicts (Q1/Q2/Q3/Q4) authored with explicit YES/NO/DEFERRED + 2-4 sentence rationale + ≥1 NSV-NN cite + ≥1 DISC-AUDIT-NN cite + `**Drives:**` line per NSD-16
- `bash checks/full.sh` exits 0 — all 6 NSD-15 rules pass (rules 1-4 from Plan 02; rule 5 from this plan; rule 6 throughout) + Rule 3 ENHANCED + NSD-14 sequencing
- Audit-doc frontmatter flipped `decision: pending → decision: final`
- STATE.md updated with 4 verdict entries in `### Key Decisions (v5.0)` and Phase 34 set as next-up in `## Current Position`
- Phase 33's `33-DISCOVERY-AUDIT.md` untouched (NSD-15 rule 6 / T-33b-01 mitigation green at phase close)
- Downstream phases (Phase 34/35/38/39) can read this audit's NSV-NN row inventory + 4 verdicts to drive their plan-authoring
- Audit is shippable: ROADMAP §Phase 33b 5 success criteria met (per-entity drift-vector table tagged ship/partial/missing with leverage; Pass/Fail Criteria pinned at TOP; Decisions § with 4 verdicts citing NSV + DISC-AUDIT rows; missing rows anchored to SEED-004 + DISC-AUDIT cite; zero code/schema/dep changes)
</success_criteria>

<output>
After completion, create `.planning/phases/33b-discovery-north-star-audit/33b-03-SUMMARY.md` per the GSD summary template, capturing:
- 4 D-17 verdict outcomes (Q1/Q2/Q3/Q4 with their YES/NO/DEFERRED values + 1-line rationale each)
- Per-verdict cited NSV-NN inventory (which Wave 1 cells anchor each verdict)
- Per-verdict cited DISC-AUDIT-NN inventory (which Phase 33 rows back each verdict)
- Per-verdict downstream-phase impact: which v5.0 phase each verdict's `**Drives:**` line gates
- Mechanical verification result: `bash full.sh` exit 0 confirming all 6 NSD-15 rules + Rule 3 ENHANCED + NSD-14 sequencing pass
- Phase 33 immutability confirmation: `git diff` against `33-DISCOVERY-AUDIT.md` empty throughout
- STATE.md update summary: 4 new verdict entries + Phase 34 next-up signal
- Phase 33b ship-ready signal for downstream Phase 34 plan-authoring kickoff
</output>

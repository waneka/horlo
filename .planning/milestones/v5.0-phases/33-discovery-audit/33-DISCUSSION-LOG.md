# Phase 33: Discovery Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 33-discovery-audit
**Areas discussed:** Audit method, Surface coverage breadth, Click-path row schema, Pass/fail + decisions doc shape

---

## Audit method

### Q1: Which traversal method should populate the click-path table?

| Option | Description | Selected |
|--------|-------------|----------|
| Source-code-first (Recommended) | Grep every Link/<a>/router.push/onClick in each surface's component tree; spot-check ~5-10 high-stakes rows in browser. Fast, complete, reproducible; catches dead code paths a browser walk would miss. | ✓ |
| Browser-walkthrough-first | Sign in and click every visible affordance. Captures actual user reality including conditional rendering. Slow, viewport-dependent, misses elements gated by states you don't reproduce. | |
| Hybrid — both passes recorded separately | Full source-code pass tagged `evidence: file:line`; full browser pass tagged `evidence: screenshot/url`. Reconcile diffs as their own findings. Most rigorous, ~2x effort. | |

**User's choice:** Source-code-first (Recommended)

### Q2: For the browser spot-check pass, which environment do we audit against?

| Option | Description | Selected |
|--------|-------------|----------|
| Production horlo.app (Recommended) | Audit actual shipped reality; matches v5.0 single-user assumption. Caveat: local-only changes won't appear (a feature). | ✓ |
| Local dev (npm run dev) | Fastest iteration, hot-reloads, but may include unmerged WIP. Risk of false positives. | |
| Both — prod canonical, local cross-checks ambiguous | Prod is source-of-truth tag; local consulted only when prod behavior is unclear. ~10% extra rigor. | |

**User's choice:** Production horlo.app (Recommended)

### Q3: Who walks the surfaces? Should the audit cover anonymous-viewer paths in addition to owner?

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-only (Recommended) | v5.0 is single-user. Anon-only paths get a single 'unauthenticated viewer' note row each, not a full re-walk. | |
| Owner AND a fresh signed-up account (no collection, no follows) | Captures sparse-network state explicitly — ExploreHero gates and empty-collection branches owner cannot reproduce. ~30% extra audit time; high signal for v5.0 onboarding adjacencies. | ✓ |
| Owner + anon (logged-out browser) | Captures auth-redirect surfaces and unauth-readable `/u/{user}` and `/catalog/{id}` views. Smaller signal than sparse-account. | |

**User's choice:** Owner AND a fresh signed-up account (no collection, no follows)

### Q4: Mobile + desktop, or single viewport?

| Option | Description | Selected |
|--------|-------------|----------|
| Both viewports — row tagged when behavior differs (Recommended) | Walk each surface at desktop AND ~390px mobile. Row stays single unless affordance/target/visibility changes by viewport, then split. Catches Phase 27 mobile-specific affordances and Phase 30 aspect-ratio findings. | ✓ |
| Desktop only, mobile as a separate sweep deferred | Faster; risk that mobile-specific dead ends slip through. Mismatches PROJECT.md mobile-first orientation. | |
| Mobile only | Most-used viewport for collectors browsing in field. Risk: desktop-only affordances get missed. | |

**User's choice:** Both viewports — row tagged when behavior differs (Recommended)

---

## Surface coverage breadth

### Q5: Which surface scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Strictly the 6 ROADMAP surfaces | Smallest table, fastest audit, matches ROADMAP letter — but Phase 39 polish items touching header nav lack a row to cite. | |
| 6 + Header nav + the 7 profile tabs (Recommended) | The 6 named surfaces, PLUS persistent Header nav (every authenticated page renders it), PLUS the 7 profile tabs. Skip /notifications, /insights, /preferences, /settings, /wear/[id], /watch/new, /watch/[id]/edit. Matches the spirit of audit-first-discovery. | ✓ |
| Everything authenticated users hit | All 6 + Header + every profile tab + /notifications + /insights + /search/explore sub-tabs + /wear/[id]. Most thorough; ~3-4x table size; high cost-to-rigor on adjacent surfaces. | |

**User's choice:** 6 + Header nav + the 7 profile tabs (Recommended)

### Q6: Audit /explore sub-routes as their own surfaces or fold into /explore?

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into /explore as click targets (Recommended) | "See all" rails on /explore have rows like `target=/explore/collectors, tag=Live`. Sub-routes get ONE summary row noting paginated identical targets. Avoids duplicating rows. | ✓ |
| Audit each sub-route as its own surface | Catches sub-route-specific affordances; most rows duplicate parent rail's targets. | |

**User's choice:** Fold into /explore as click targets (Recommended)

### Q7: 7 profile tabs as separate surface blocks or one with tab column?

| Option | Description | Selected |
|--------|-------------|----------|
| Each tab as its own surface block (Recommended) | Surfaces: /u/{user}/collection, /wishlist, /worn, /notes, /stats, /common-ground, /insights. Each renders different click affordances. | ✓ |
| One surface, tab as a row column | Smaller table; reader has to filter by tab to see per-tab story. Loses visual surface-grouping. | |

**User's choice:** Each tab as its own surface block (Recommended)

### Q8: Header nav documented once globally or repeated per surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Once as a 'Header (global)' surface block (Recommended) | Single block for every Header element. Avoids 13x row duplication. Per-surface rows only describe surface-specific affordances. | ✓ |
| Repeat header rows on every surface block | Catches surface-specific Header behavior. Inflates table 13x for what's almost always identical. | |

**User's choice:** Once as a 'Header (global)' surface block (Recommended)

---

## Click-path row schema

### Q9: Row ID format and column set?

| Option | Description | Selected |
|--------|-------------|----------|
| DISC-AUDIT-NN flat sequential (Recommended) | Easy to grep, easy to cite. Matches ROADMAP §Phase 33 example. ID number doesn't encode surface; reader looks up the row. | ✓ |
| DISC-AUDIT-{SURFACE}-NN namespaced | Surface visible in citation; easier to skim. Deviation from ROADMAP example. | |
| DISC-AUDIT-NN flat + `surface_code` column | Flat IDs (matches example) + short surface_code column. Best of both. | |

**User's choice:** DISC-AUDIT-NN flat sequential (Recommended)

### Q10: Which additional columns beyond mandated ones?

| Option | Description | Selected |
|--------|-------------|----------|
| evidence + viewer_state + viewport (Recommended) | row_id \| surface \| element \| target \| tag \| evidence \| viewer_state \| viewport. ~8 columns, readable in markdown. | ✓ |
| Above + priority + expected_target + notes | Adds priority, expected_target (for Dead/Missing rows), free-text notes. ~10 columns, harder to read but more self-contained. | |
| Minimum mandated only — row_id, surface, element, target, tag | 5 columns. Cleanest; rationale lives in adjacent prose sections. Risk: downstream phases lose the 'why' context. | |

**User's choice:** evidence + viewer_state + viewport (Recommended)

### Q11: Precise tag definitions?

| Option | Description | Selected |
|--------|-------------|----------|
| Strict + behavioral (Recommended) | Live: renders + target loads. Dead: renders but target 404s/errors/no-ops (incl. WR-07 silent-no-op). Redundant: works but another element delivers same value (cite the row). Missing: no element exists for an affordance the Rdio principle expects (cite the principle violation). | ✓ |
| Strict + author judgement | Same definitions but Redundant/Missing are author-discretion without a fixed rubric. | |
| Add a 5th tag: 'Surprise' | Above + 5th tag for affordances that work but in non-obvious ways. Adds tag complexity. | |

**User's choice:** Strict + behavioral (Recommended)

### Q12: How is the ideal click-path standard expressed for Missing rows?

| Option | Description | Selected |
|--------|-------------|----------|
| Single anchor: SEED-004 Rdio principle quote (Recommended) | Pin the SEED-004 quote at the top of DISCOVERY-AUDIT.md. Every Missing row cites how it violates this principle. Simple, falsifiable. | ✓ |
| Anchor + 4-5 user journeys | Above + 4-5 named discovery journeys. Missing rows cite which journey they break. More structured; harder to author. | |
| Multiple anchors: Rdio + CAT-13 framing + Layer A/B vision | Triad of anchors. Most complete; risk of over-justifying discretionary findings. | |

**User's choice:** Single anchor: SEED-004 Rdio principle quote (Recommended)

---

## Pass/fail + decisions doc shape

### Q13: Which pass/fail rule set (written at the TOP of DISCOVERY-AUDIT.md)?

| Option | Description | Selected |
|--------|-------------|----------|
| Coverage + completeness rules (Recommended) | 5 rules: every surface has ≥1 row; every Dead has reproduction; every Missing cites Rdio violation; every Redundant cites the row it duplicates; every decision has rationale anchored to ≥1 row ID. Falsifiable. | ✓ |
| Coverage + numeric thresholds | Above + row-count floor per surface. Adds objectivity; risk of over-counting trivial rows. | |
| Reviewer reproducibility | Single rule: 'A second person, given audit + 30 min + a horlo.app account, can re-walk and reach the same tag for every row.' Thinnest, most rigorous. | |

**User's choice:** Coverage + completeness rules (Recommended)

### Q14: Decisions doc structure — inline or separate file?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in DISCOVERY-AUDIT.md as the final § (Recommended) | Single file with sections: pass/fail criteria, Rdio anchor, tag definitions, table, decisions. Downstream phases read one file. Matches ROADMAP wording. | ✓ |
| Separate file: DISCOVERY-AUDIT-DECISIONS.md | Two files: table-only audit + decisions doc that imports row IDs. Cleaner separation; reader needs both files. | |

**User's choice:** Inline in DISCOVERY-AUDIT.md as the final § (Recommended)

### Q15: Per-decision rationale depth?

| Option | Description | Selected |
|--------|-------------|----------|
| Verdict + 2-4 sentence rationale + cited row IDs (Recommended) | Format: verdict + rationale + cited rows + downstream-phase impact. Each verdict explicitly traces to audit findings + downstream phase. Falsifiable. | ✓ |
| Verdict + 1-sentence rationale | Faster; loses the row-ID citation that makes findings load-bearing. Risk: decisions become vibes. | |
| Verdict + extended rationale (5-10 sentences) + scenario analysis | Long-form per decision. Strongest analysis; risk that decisions doc becomes the artifact instead of the table. | |

**User's choice:** Verdict + 2-4 sentence rationale + cited row IDs (Recommended)

### Q16: 4 mandated decisions, or add a 5th catch-all?

| Option | Description | Selected |
|--------|-------------|----------|
| Just the 4 mandated decisions (Recommended) | ROADMAP names exactly 4. Non-mandated findings flow through the table itself; Phase 39 closes any DISC-AUDIT-NN it chooses to close. Adding catch-all risks scope creep. | ✓ |
| 4 + a 5th 'Audit-flagged scope changes' decision | Captures cross-phase scope-change implications the 4 mandated questions don't. Justified by Phase 34 dependency wording. | |

**User's choice:** Just the 4 mandated decisions (Recommended)

---

## Claude's Discretion

User selected the recommended option on every question (Q1–Q16). No areas were left for Claude's free discretion; all decisions D-01 through D-17 in CONTEXT.md are user-confirmed selections among presented options.

## Deferred Ideas

(Captured in CONTEXT.md `<deferred>` § — not duplicated here.)

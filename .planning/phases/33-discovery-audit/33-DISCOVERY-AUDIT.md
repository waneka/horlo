---
title: Discovery Audit — v5.0 Click-Path Map
status: draft
date: 2026-05-06
audit_seed: SEED-004
phase: 33-discovery-audit
requirement: DISC-10
decision: pending
---

# Discovery Audit — v5.0
<!-- skeleton -->

> Read-only click-path audit of v5.0 discovery surfaces.
> Zero code, schema, or dependency changes ship in this phase
> (per ROADMAP §Phase 33 success criterion #5).

## Pass/Fail Criteria

The audit passes IFF all 5 rules below hold (mechanically enforced by
`.planning/phases/33-discovery-audit/checks/full.sh`):

1. Every surface in the D-05 scope list has ≥1 row in the table.
2. Every Dead row has reproduction steps in `evidence` (file:line for source-pass; URL + observation for browser-pass).
3. Every Missing row cites the SEED-004 Rdio quote violation in `evidence`.
4. Every Redundant row cites the specific row ID it duplicates in `evidence`.
5. All 4 mandated decisions in the final § have an explicit YES/NO/DEFERRED resolution with rationale anchored to ≥1 row ID.

### Tag definitions (D-11)

- **Live:** element renders in the documented `viewer_state` AND target loads to expected destination (200 + correct content in browser pass; route handler exists in source pass).
- **Dead:** element renders but target 404s, errors, or no-ops. Includes the WR-07 silent-no-op pattern (`revalidatePath('/u/{username}/{tab}', 'page')` against a literal-template route).
- **Redundant:** element renders AND target works, but another element on the same surface OR a different surface delivers the same destination/value. Row MUST cite the specific row it's redundant to in `evidence` (`Redundant to DISC-AUDIT-NN`).
- **Missing:** NO element exists for an affordance the SEED-004 Rdio quote expects. Row's `target` reads "—" and `evidence` MUST cite the specific principle violation (e.g., `Rdio violation: catalog page has no affordance to walk to other watches in the same family`).

### Row schema (D-10)

Exactly 8 columns, this order:

1. `row_id` — `DISC-AUDIT-NN` (zero-padded to 2 digits when N<10), flat sequential, no gaps, no duplicates.
2. `surface` — one of the 13 D-05 blocks (Header, `/`, `/explore`, `/search`, `/catalog/{catalogId}`, `/watch/{id}`, `/u/{user}/collection`, `/u/{user}/wishlist`, `/u/{user}/worn`, `/u/{user}/notes`, `/u/{user}/stats`, `/u/{user}/common-ground`, `/u/{user}/insights`).
3. `element` — the visible affordance (e.g., "Avatar in PopularCollectors row", "Brand pill on WatchDetail").
4. `target` — route or action; `—` for non-navigational onClicks; `—` for Missing rows.
5. `tag` — exactly one of: `Live`, `Dead`, `Redundant`, `Missing`.
6. `evidence` — `file:line` for source-pass rows; `prod: <URL> + <observation>` for browser-pass rows; `Redundant to DISC-AUDIT-NN — <reason>` for Redundant; `Rdio violation: <description>` for Missing.
7. `viewer_state` — exactly one of: `owner-populated`, `fresh-account`, `N/A`.
8. `viewport` — exactly one of: `desktop`, `mobile`, `both`.

## Rdio Principle Anchor

> "A collector should be able to drift from one watch / collector / family / reference to another by clicking, without ever feeling lost or running into a dead end."
>
> — `.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15

Every Missing row in the Click-Path Audit table MUST cite this principle by name (`Rdio violation:` or `SEED-004`) in its `evidence` cell. This is the SINGLE rubric per D-12 — no alternative anchors permitted.

## Click-Path Audit

| row_id | surface | element | target | tag | evidence | viewer_state | viewport |
|--------|---------|---------|--------|-----|----------|--------------|----------|
<!-- Wave 1 (Pass A): source-grep enumeration fills this table with candidate rows tagged viewer_state=TBD, viewport=both. -->
<!-- Wave 2 (Pass B): runtime-gate annotation pass replaces TBD viewer_state with owner-populated / fresh-account / N/A per RESEARCH.md G-1..G-20. -->
<!-- Wave 3 (Pass C): production browser spot-check on horlo.app updates evidence to "prod: <URL> + <observation>" for ~25–30 high-stakes rows; finalizes Live/Dead/Redundant/Missing tags. -->

## Decisions

Per D-15 + D-17, exactly 4 decisions. Per D-16, each uses the verdict + 2–4 sentence rationale + cited rows + drives template. No 5th catch-all.

### Decision Q1: Combine home and explore?

**Verdict:** PENDING <!-- Wave 3 (Pass D) replaces with YES | NO | DEFERRED -->
**Rationale:** [Wave 3 fills with 2–4 sentences citing audit findings]
**Cited rows:** [Wave 3 fills with DISC-AUDIT-NN, DISC-AUDIT-MM]
**Drives:** [Wave 3 fills with downstream phase / item this verdict gates]

### Decision Q2: Lineage browse priority

**Verdict:** PENDING <!-- Wave 3 (Pass D) replaces with YES | NO | DEFERRED -->
**Rationale:** [Wave 3 fills with 2–4 sentences citing audit findings]
**Cited rows:** [Wave 3 fills with DISC-AUDIT-NN, DISC-AUDIT-MM]
**Drives:** [Wave 3 fills with Phase 35 schema-only vs schema+UI scope, and Phase 39 lineage-browse polish scope]

### Decision Q3: Dead-end closure priority

**Verdict:** PENDING <!-- Wave 3 (Pass D) replaces with YES | NO | DEFERRED -->
**Rationale:** [Wave 3 fills with 2–4 sentences citing audit findings]
**Cited rows:** [Wave 3 fills with DISC-AUDIT-NN, DISC-AUDIT-MM]
**Drives:** [Wave 3 fills with Phase 39 polish item ordering]

### Decision Q4: CAT-13 discovery framing

**Verdict:** PENDING <!-- Wave 3 (Pass D) replaces with YES | NO | DEFERRED -->
**Rationale:** [Wave 3 fills with 2–4 sentences citing audit findings]
**Cited rows:** [Wave 3 fills with DISC-AUDIT-NN, DISC-AUDIT-MM]
**Drives:** [Wave 3 fills with Phase 38 framing — "tech debt" vs "discovery improvement"]

## Cross-References

- `.planning/ROADMAP.md` §"Phase 33: Discovery Audit" lines 132–142 — phase goal + 5 success criteria.
- `.planning/REQUIREMENTS.md` §DISC-10 line 19 — full requirement text.
- `.planning/STATE.md` §"Key Decisions (v5.0)" lines 65–72 — Phase 39 + Phase 35 audit-conditional scope.
- `.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15 — the Rdio principle quote (D-12 anchor).
- `.planning/phases/33-discovery-audit/33-CONTEXT.md` — D-01..D-17 user-confirmed decisions locking the audit method.
- `.planning/phases/33-discovery-audit/33-RESEARCH.md` §"Conditional Rendering Map" — G-1..G-20 runtime gates feeding the viewer_state column.
- Downstream consumers: ROADMAP §Phase 34 line 146, §Phase 35, §Phase 38 lines 193–203, §Phase 39 lines 205–215 — each cites specific DISC-AUDIT-NN rows or the decisions verdicts.

---
phase: 33b-discovery-north-star-audit
plan: 01
subsystem: documentation
tags: [audit, scaffold, falsifiability, bash, grep, awk, nsd-08, nsd-11, nsd-13, nsd-14, nsd-15, nsd-16, disc-12]

# Dependency graph
requires:
  - phase: 33-discovery-audit
    provides: 136-row DISC-AUDIT-NN click-path table (immutable substrate); D-12 single Rdio rubric; D-15 single-file format; D-16 verdict template; D-17 exactly-4-decisions cap
provides:
  - "checks/quick.sh — Wave 0 sanity check (file exists, 6 required headings, NSD-15 rule 1 ordering, NSD-13 7-column header, NSD-08 vector defs, NSD-11 leverage key, skeleton sentinel carve-out)"
  - "checks/full.sh — Wave-N consistency check (wraps quick.sh + NSD-15 rules 1-6 + NSD-14 NSV-NN sequencing 1..42 + Rule 3 ENHANCED cited-DISC-AUDIT-NN existence verification; T-33b-01 mitigation always-on)"
  - "33b-DISCOVERY-NORTH-STAR-AUDIT.md skeleton — 6 §s in NSD-15 rule 1 order; Pass/Fail Criteria pinned at TOP (line 20); SEED-004 Rdio quote anchor; NSD-07 7-vector definition table; NSD-11 leverage bucket key; empty NSD-13 7-column drift-vector table with skeleton sentinel; 4 NSD-16 decision stubs Q1-Q4 with TBD placeholders"
affects: [33b-02 (Wave 1 — NSV-01..NSV-42 cell population + leverage scoring), 33b-03 (Wave 2 — Q1-Q4 decisions + closeout), 34-layer-a (depends on Phase 33b verdicts), 35-layer-b (lineage browse UI scope from Q2), 38-cat-13-rewire (Q4 framing), 39-audit-driven-polish (full scope from Q3 + leverage-tagged rows)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 33 quick.sh/full.sh idiom mirrored: set -euo pipefail; DIR=\"$(cd \"$(dirname \"$0\")\" && pwd)\"; exit-1-on-fail; NSD ids in echo strings; pure bash + grep + awk + git"
    - "Skeleton sentinel carve-out: <!-- skeleton --> comment authorizes Wave 0 zero-row state; Wave 1 first-row commit removes sentinel and switches full.sh into rules-1-5 + sequencing enforcement"
    - "Phase 33 audit immutability rule (NSD-15 rule 6): full.sh always-on git diff check against 33-DISCOVERY-AUDIT.md (T-33b-01 mitigation runs even in skeleton mode)"
    - "Cited-id-existence enforcement (Rule 3 ENHANCED): every distinct DISC-AUDIT-NN cited in 33b grep-verified to exist as a row in Phase 33's table; catches off-by-one typos before they corrupt downstream phase plans"

key-files:
  created:
    - ".planning/phases/33b-discovery-north-star-audit/checks/quick.sh (55 lines, executable)"
    - ".planning/phases/33b-discovery-north-star-audit/checks/full.sh (132 lines, executable)"
    - ".planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md (122 lines, skeleton mode)"
  modified: []

key-decisions:
  - "Implemented all 6 NSD-15 rules in full.sh: rule 6 (Phase 33 audit immutability) is always-on (runs even in skeleton mode) because the whole point of the rule is to catch any inadvertent edit; rules 1-5 + NSD-14 sequencing skeleton-mode-deferred via the <!-- skeleton --> sentinel"
  - "Rule 3 ENHANCED authored as a top-priority mechanical check per RESEARCH § Risk Analysis: greps every distinct cited DISC-AUDIT-NN against Phase 33's table to catch typos before they propagate into downstream phase plans (Phase 34/35/38/39)"
  - "SEED-004 Rdio quote rendered verbatim with lowercase opening 'a collector' (matching SEED-004 line 15 exactly), not the capitalized form used in Phase 33's audit — Plan 33b explicitly mandates verbatim citation"
  - "Skeleton mode chosen over a stub-row approach: <!-- skeleton --> sentinel below Drift-Vector Audit § header lets quick.sh exit 0 immediately while keeping the 7-column NSD-13 table header committed (zero ambiguity for Wave 1's first NSV-NN row insertion)"
  - "Decision stubs use 'TBD' placeholder text that satisfies full.sh rule 5a/5c/5d/5e count checks (4 Verdict / 4 Cited NSV / 4 Backing DISC-AUDIT / 4 Drives lines present) but intentionally fails 5b/5f until Wave 2 fills them in — correct because skeleton-mode short-circuit defers rules 1-5 anyway"

patterns-established:
  - "Per-task quick.sh sampling: every Plan 02/03 task ends with bash checks/quick.sh; every wave ends with bash checks/full.sh (per VALIDATION.md sampling rate)"
  - "Audit document ordering invariant: ## Pass/Fail Criteria § always precedes ## Drift-Vector Audit § (NSD-15 rule 1); enforced by quick.sh line-number comparison"
  - "Cross-audit cite syntax: NSV-NN, DISC-AUDIT-NN side-by-side; downstream phases can grep -E 'NSV-[0-9]+|DISC-AUDIT-[0-9]+' across both audits cleanly (NSD-14 mirroring Phase 33 D-09)"

requirements-completed: [DISC-12]

# Metrics
duration: ~3min
completed: 2026-05-09
---

# Phase 33b Plan 01: Wave 0 Scaffold + Skeleton Summary

**Wave 0 falsifiability scaffold complete: checks/quick.sh + checks/full.sh + 33b-DISCOVERY-NORTH-STAR-AUDIT.md skeleton (3 files, 309 lines, all NSD-15 invariants enforced) — Wave 1 (Plan 02 NSV-01..NSV-42 cell population) is unblocked.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-09T05:16:00Z (approx)
- **Completed:** 2026-05-09T05:18:25Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- **checks/quick.sh** — 55-line Wave 0 sanity check enforcing all 6 required headings, NSD-15 rule 1 ordering (Pass/Fail § precedes Drift-Vector Audit §), NSD-13 7-column table header, NSD-08 vector definitions table sample (similar-by-taste / see-more-like-this rows), NSD-11 leverage bucket key sample (high/med/low on one line), and skeleton-sentinel carve-out for the empty-row Wave 0 case.
- **checks/full.sh** — 132-line Wave-N consistency check that wraps quick.sh and adds NSD-15 rules 1-6 (cell completeness, leverage tag presence, DISC-AUDIT-NN backing, SEED-004 cite, decision shape, audit immutability) + NSD-14 NSV-NN flat-sequential sequencing 1..42 + Rule 3 ENHANCED (every distinct cited DISC-AUDIT-NN grep-verified to exist as a row in Phase 33's table). Rule 6 is always-on (runs even in skeleton mode) because audit immutability is non-negotiable.
- **33b-DISCOVERY-NORTH-STAR-AUDIT.md** — 122-line skeleton with frontmatter (phase=33b-discovery-north-star-audit, requirement=DISC-12, decision=pending, predecessor_audit=33-discovery-audit), H1 + tagline, 6 required §s in NSD-15 rule 1 order (Pass/Fail Criteria @ line 20 → Rdio Principle Anchor → Vector Definitions → Leverage Bucket Key → Drift-Vector Audit with `<!-- skeleton -->` sentinel + 7-column table header → Decisions with 4 stubs Q1-Q4 using NSD-16 5-line template).
- **Mechanical verification:** `bash checks/quick.sh` exits 0 (8/8 checks pass); `bash checks/full.sh` exits 0 in skeleton mode (rule 6 enforced; rules 1-5 + NSD-14 deferred to Wave 1); `git diff -- .planning/phases/33-discovery-audit/` returns empty (T-33b-01 mitigation verified).
- **NSD ids implemented:** NSD-04 (status enum), NSD-07 (7-vector taxonomy), NSD-08 (pinned vector definition table), NSD-10 (leverage on missing+partial), NSD-11 (leverage bucket key), NSD-13 (7-column flat table schema), NSD-14 (NSV-NN flat-sequential row id format — full.sh enforces 1..42 with no gaps/dupes once skeleton sentinel removed), NSD-15 (6 rules pinned at TOP; full.sh enforces all 6 + Rule 3 ENHANCED), NSD-16 (4 decision stubs Q1-Q4 with extended verdict template).
- **Inherited locks honored:** Phase 33 D-12 (single Rdio rubric — SEED-004 line 15 quote anchor only), D-15 (single-file format — decisions inline), D-16 (verdict template — extended with NSV-NN cites), D-17 (exactly 4 decisions cap).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create checks/quick.sh and checks/full.sh — falsifiability check scripts** — `b37cf42` (feat)
2. **Task 2: Create 33b-DISCOVERY-NORTH-STAR-AUDIT.md skeleton with all 6 sections + 4 decision stubs + skeleton sentinel** — `bff9d2d` (feat)

_Note: this plan has no TDD tasks; both commits are single-step `feat()` per per-task-commit-protocol._

## Files Created/Modified

- `.planning/phases/33b-discovery-north-star-audit/checks/quick.sh` (55 lines, executable) — Wave 0 sanity check; runs in ~3s with pure bash + grep + awk
- `.planning/phases/33b-discovery-north-star-audit/checks/full.sh` (132 lines, executable) — Wave-N consistency check; runs in ~3s; sources quick.sh; enforces NSD-15 rules 1-6 + NSD-14 sequencing + Rule 3 ENHANCED
- `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` (122 lines) — audit document skeleton; quick.sh exits 0 against it; awaits Wave 1 NSV-01..NSV-42 row population

## Decisions Made

- **Always-on rule 6 (audit immutability):** Phase 33's `33-DISCOVERY-AUDIT.md` immutability check (NSD-15 rule 6 / T-33b-01 mitigation) runs even in skeleton mode because the entire point of the rule is to catch any inadvertent edit, including during scaffolding. Skeleton-mode short-circuit applies only to rules 1-5 + NSD-14 sequencing (which require row-level content that doesn't exist yet).
- **Rule 3 ENHANCED prioritized:** Per RESEARCH § Risk Analysis, the highest-value mechanical check is verifying every cited DISC-AUDIT-NN exists in Phase 33's table — this catches typos that would silently corrupt downstream phase plans (Phase 34/35/38/39 grep these ids). Implemented as a sort-unique-grep loop against Phase 33's audit.
- **Verbatim Rdio quote:** Used SEED-004 line 15's exact lowercase opening (`a collector should be able to drift...`), not Phase 33's capitalized form. Plan 33b explicitly mandates verbatim citation per NSD-15 rule 4.
- **Skeleton sentinel placement:** `<!-- skeleton -->` sentinel placed inside the `## Drift-Vector Audit` § immediately under the heading and before the 7-column header. Wave 1 Plan 02 Task 1 will remove the sentinel as part of its first NSV-NN row commit, automatically activating full.sh rules 1-5 + sequencing enforcement.
- **Decision stub TBD placeholders:** Stubs include `**Verdict:** TBD ...`, `**Cited NSV rows:** TBD`, `**Backing DISC-AUDIT rows:** TBD`, `**Drives:** TBD ...` to satisfy full.sh rule 5a/5c/5d/5e count checks (4 of each label) without satisfying 5b (verdict in {YES,NO,DEFERRED}) or 5f (≥1 NSV-NN / ≥1 DISC-AUDIT-NN cite). This is correct per the plan: skeleton-mode short-circuit defers rules 1-5 anyway, and Wave 2 Plan 03 will resolve verdicts and fill cites.

## Deviations from Plan

None - plan executed exactly as written.

All 12 Task 1 acceptance criteria + all 16 Task 2 acceptance criteria pass on first attempt; both check scripts pass `bash -n` syntax check; both pass execution against the new skeleton file; Phase 33 directory git-untouched.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Phase 33b is a pure-documentation phase with zero code, schema, or dependency changes (per NSD-15 rule 6 / ROADMAP §Phase 33b success criterion #5).

## Wave 1 Readiness Signal

- **Skeleton sentinel present:** `<!-- skeleton -->` comment at line 80 (inside `## Drift-Vector Audit` §) — Plan 02 Task 1 MUST remove this as part of its first NSV-NN row commit.
- **NSD-13 7-column table header committed:** `| row_id | entity | vector | status | leverage | rationale | backing_rows |` — Wave 1 appends NSV-01..NSV-42 rows beneath this header.
- **Full.sh becomes strict on sentinel removal:** Once Wave 1 removes the sentinel, full.sh enforces all 6 NSD-15 rules + NSD-14 sequencing + Rule 3 ENHANCED; rule violations exit 1 immediately.
- **Phase 33 substrate unmodified:** `git diff -- .planning/phases/33-discovery-audit/` returns empty; T-33b-01 mitigation verified mechanically.
- **Downstream Plan 02 (Wave 1 cell population) may proceed.**

## Self-Check: PASSED

- `test -f .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` → FOUND
- `test -f .planning/phases/33b-discovery-north-star-audit/checks/full.sh` → FOUND
- `test -f .planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` → FOUND
- `git log --oneline --all | grep b37cf42` → FOUND
- `git log --oneline --all | grep bff9d2d` → FOUND
- `bash checks/quick.sh` → exit 0 (8/8 checks)
- `bash checks/full.sh` → exit 0 (rule 6 enforced; rules 1-5 + NSD-14 skeleton-mode deferred)
- `git diff -- .planning/phases/33-discovery-audit/` → empty (T-33b-01 mitigation verified)

---
*Phase: 33b-discovery-north-star-audit*
*Completed: 2026-05-09*

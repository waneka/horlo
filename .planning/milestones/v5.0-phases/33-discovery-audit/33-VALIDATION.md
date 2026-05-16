---
phase: 33
slug: discovery-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **NOTE — DOCUMENTATION-ONLY PHASE:** Phase 33 ships zero code, schema, or
> dependency changes (ROADMAP §Phase 33 success criterion #5). The artifact is
> a single markdown file (`DISCOVERY-AUDIT.md`). Validation is therefore
> file-existence + content-shape + internal-consistency checks rather than a
> test suite. The "manual" Validation Sign-Off section below is the primary
> gate; the automated columns below run lightweight grep / file-presence
> checks the executor invokes after each task commit.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — content validation via `grep` / `wc -l` / `node` one-liners |
| **Config file** | none |
| **Quick run command** | `bash .planning/phases/33-discovery-audit/checks/quick.sh` (created in Wave 0; see "Wave 0 Requirements") |
| **Full suite command** | `bash .planning/phases/33-discovery-audit/checks/full.sh` (created in Wave 0) |
| **Estimated runtime** | ~3 seconds |

> **Important:** the Wave 0 check scripts are themselves part of the
> documentation phase's local scaffolding — they live under
> `.planning/phases/33-discovery-audit/checks/` so they do NOT violate the
> "zero code, schema, or dependency changes ship" rule. They are committed in
> the planning directory alongside the audit artifact and are not shipped to
> the application codebase.

---

## Sampling Rate

- **After every task commit:** Run `quick.sh` — verifies `33-DISCOVERY-AUDIT.md` exists, has the expected top-level headings (`## Pass/Fail Criteria`, `## Click-Path Audit`, `## Decisions`), and the audit table has at least one row.
- **After every plan wave:** Run `full.sh` — runs all the `quick.sh` checks plus the D-13 5-rule consistency checks (every Redundant row's cited target row exists; every Missing row cites SEED-004; every Dead row has reproduction evidence; every D-05 surface block has ≥1 row; all 4 D-17 decisions have a verdict).
- **Before `/gsd-verify-work`:** Full suite must be green AND a human reviewer has signed the Validation Sign-Off section below.
- **Max feedback latency:** ~3 seconds.

---

## Per-Task Verification Map

> Tasks IDs below are placeholders the planner will replace with actual plan
> tasks. Every audit-content task gets either a `quick.sh` automated check or
> is flagged in the Manual-Only Verifications table below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 33-00-01 | 00 (scaffold) | 0 | DISC-10 | — | N/A — doc phase | content | `test -d .planning/phases/33-discovery-audit/checks` | ❌ W0 | ⬜ pending |
| 33-00-02 | 00 (scaffold) | 0 | DISC-10 | — | N/A | content | `test -f .planning/phases/33-discovery-audit/checks/quick.sh` | ❌ W0 | ⬜ pending |
| 33-00-03 | 00 (scaffold) | 0 | DISC-10 | — | N/A | content | `test -f .planning/phases/33-discovery-audit/checks/full.sh` | ❌ W0 | ⬜ pending |
| 33-XX-01 | XX | 1 | DISC-10 | — | N/A | content | `bash .planning/phases/33-discovery-audit/checks/quick.sh` | ❌ W0 | ⬜ pending |
| 33-XX-NN | XX | last | DISC-10 | — | N/A | content | `bash .planning/phases/33-discovery-audit/checks/full.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/phases/33-discovery-audit/checks/quick.sh` — three checks: file exists, top-level headings present, table row count > 0
- [ ] `.planning/phases/33-discovery-audit/checks/full.sh` — wraps `quick.sh` + the D-13 5-rule consistency checks (greppable: every `Redundant to DISC-AUDIT-NN` resolves to an existing row id; every Missing row contains `Rdio violation:`; every Dead row has either `file:` or `prod:` in evidence; every D-05 surface block name appears at least once in the `surface` column; the four decision verdict headers exist with `**Verdict:**` lines)
- [ ] No npm/pip framework install — checks are pure bash + grep + node one-liners

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser spot-check pass on production horlo.app from owner + fresh-account | DISC-10 (D-02, D-03) | Requires logging into production with two distinct accounts; cannot be automated within zero-code rule | Walk ~5–10 high-stakes rows on horlo.app at desktop ~1280px AND mobile ~390px from BOTH the owner account AND a fresh signup. Confirm runtime gates G-1..G-20 (per RESEARCH.md) match the source-pass tags. Update `evidence` column for browser-confirmed rows from `file:line` to `prod: <URL> + <observation>`. |
| Decision verdict rationale anchors to row IDs that say what they claim | DISC-10 (D-16) | Semantic check — automated grep can confirm row IDs exist but cannot confirm the rows actually support the verdict | Read each of the 4 decisions in the final § of DISCOVERY-AUDIT.md; for each cited `DISC-AUDIT-NN` row, confirm the row's `tag` + `evidence` actually justifies the verdict claim. |
| SEED-004 Rdio principle citation is the SAME quote across all Missing rows | DISC-10 (D-12) | Multi-anchor risk — automated check confirms the citation pattern but human must confirm the same anchor quote is used | Read every Missing row's `evidence` value; confirm each cites `.planning/seeds/SEED-004-v5-discovery-north-star.md` line 15 (the Rdio principle quote), not a paraphrase or alternative anchor. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (Wave 0 = scaffold check scripts; subsequent tasks call `quick.sh` / `full.sh`)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (every audit-content task ends with a `quick.sh` invocation)
- [ ] Wave 0 covers all MISSING references (the two check scripts; no third-party framework needed)
- [ ] No watch-mode flags (one-shot bash invocations only)
- [ ] Feedback latency < 5s (target ~3s)
- [ ] `nyquist_compliant: true` set in frontmatter (toggle after sign-off)
- [ ] Manual reviewer has walked the 3 manual checks above and signed below

**Approval:** pending

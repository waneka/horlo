---
phase: 33b
slug: discovery-north-star-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 33b — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — content validation via `bash` + `grep` + `awk` (matches Phase 33 precedent) |
| **Config file** | none |
| **Quick run command** | `bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh` |
| **Full suite command** | `bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bash .planning/phases/33b-discovery-north-star-audit/checks/quick.sh`
- **After every plan wave:** Run `bash .planning/phases/33b-discovery-north-star-audit/checks/full.sh`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

> Filled in during planning by gsd-planner; one row per task. Wave-0 (`checks/quick.sh`, `checks/full.sh`, audit-doc skeleton) tasks reference `❌ W0` because the file doesn't exist yet at task start.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD     | TBD  | 0    | DISC-12     | —          | N/A             | content   | `bash …/checks/quick.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/phases/33b-discovery-north-star-audit/checks/quick.sh` — file exists; required headings present (`## Pass/Fail Criteria`, `## Rdio Principle Anchor`, `## Vector Definitions`, `## Leverage Bucket Key`, `## Drift-Vector Audit`, `## Decisions`); 7-column NSD-13 table header detected; pass/fail § precedes drift-vector audit § (criteria pinned at TOP); skeleton sentinel carve-out for empty-row case
- [ ] `.planning/phases/33b-discovery-north-star-audit/checks/full.sh` — wraps `quick.sh` + NSD-15 rules 1–6 + NSD-14 NSV-NN sequencing 1..42 + Rule 3 ENHANCED (every cited DISC-AUDIT-NN exists in `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md`)
- [ ] `.planning/phases/33b-discovery-north-star-audit/33b-DISCOVERY-NORTH-STAR-AUDIT.md` skeleton — all 6 top-level headings (Pass/Fail Criteria, Rdio Principle Anchor, Vector Definitions, Leverage Bucket Key, Drift-Vector Audit, Decisions); 7-column NSD-13 table header; 4 decision stub headings (Q1 home+explore, Q2 lineage browse, Q3 dead-end closure, Q4 CAT-13 framing); skeleton sentinel comment
- [ ] No npm / pip framework install — checks are pure bash + grep + awk + git (matches Phase 33 precedent)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Decision verdict semantic anchor | DISC-12 (NSD-16) | Each verdict's cited NSV row(s) must actually justify the verdict claim — only a human reader can judge fit | For each of Q1/Q2/Q3/Q4: read verdict + rationale + cited NSV-NN row + cited DISC-AUDIT-NN row; confirm the cited evidence supports the YES/NO/DEFERRED choice rather than merely existing |
| SEED-004 anchor uniformity | DISC-12 (NSD-15 rule 4) | Every missing-row rationale must cite the same SEED-004 line 15 quote (no paraphrase, no alternative anchor) — semantic equivalence | Scan all rows tagged `missing` in the drift-vector table; confirm every rationale cell quotes or directly references SEED-004 line 15 in identical form |
| Worst-case viewer-state correctness | DISC-12 (NSD-06) | Watch Detail / Catalog / Collector Profile cells must score using the worst-case viewer (typically a fresh / non-owner account); a human must judge whether the chosen worst case is correct | For each Watch Detail / Catalog / Collector Profile row: confirm the rationale references at least one fresh-account counterpart row from DISC-AUDIT-130..136 OR explains why the worst-case tier is irrelevant for that vector |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`checks/quick.sh`, `checks/full.sh`, audit-doc skeleton)
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

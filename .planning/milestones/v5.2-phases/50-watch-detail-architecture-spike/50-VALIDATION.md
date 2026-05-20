---
phase: 50
slug: watch-detail-architecture-spike
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

This phase is a **decision-only spike**. The deliverable is a markdown decision document
(`50-SPIKE.md`); there is no executable code to test in the traditional sense. Validation
is structural: does the spike contain the 9 required sections, the verbatim ship-now
format, the file-by-file evidence base, and an actionable recommendation?

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (markdown deliverable) |
| **Config file** | None |
| **Quick run command** | `test -f .planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` |
| **Full suite command** | Manual structural review against the 9-section checklist + ship-now format diff against `49-SPIKE.md` §9 |
| **Estimated runtime** | <1s (file-existence + grep checks) |

---

## Sampling Rate

- **After every task commit:** `test -f .planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md`
- **After every plan wave:** Run the 9-section grep audit (see Per-Task Verification Map)
- **Before `/gsd-verify-work`:** All 9 sections must be present; ship-now format must match `49-SPIKE.md` §9 shape
- **Max feedback latency:** <1s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner-defined) | 01 | 1 | ARCH-01 | — | N/A (decision doc) | smoke | `test -f .planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` | ❌ W0 | ⬜ pending |
| (planner-defined) | 01 | 1 | ARCH-01 | — | 9 sections present | smoke | `grep -cE '^## ' .planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md \| awk '$1>=9'` | ❌ W0 | ⬜ pending |
| (planner-defined) | (planner) | (planner) | ARCH-01 | — | All 5 variants scored | smoke | `grep -cE '^### (A\|B\|C\|D\|E)[\.\)]' .planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md \| awk '$1>=5'` | ❌ W0 | ⬜ pending |
| (planner-defined) | (planner) | (planner) | ARCH-01 | — | Decision matrix has 5 rows × 7 criteria | manual-only | Visual matrix review | ❌ W0 | ⬜ pending |
| (planner-defined) | (planner) | (planner) | ARCH-01 | — | v7.0 lens depth: 4 sub-points × 5 variants | manual-only | Visual per-variant audit | ❌ W0 | ⬜ pending |
| (planner-defined) | (planner) | (planner) | ARCH-01 | — | Section 9 ship-now format matches `49-SPIKE.md` §9 verbatim shape | manual-only | Side-by-side diff against `49-SPIKE.md` §9 (Verdict line + Strongly favored / Cheap / Trigger blocks) | ✅ template exists | ⬜ pending |
| (planner-defined) | (planner) | (planner) | ARCH-01 | — | Definitive verdict labeled (YES/NO/NEEDS-DISCUSSION) and a single primary variant named | smoke | `grep -E '^\*\*Verdict:' .planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] None — the deliverable IS the artifact under test. No test scaffolding to install; no framework to configure. Validation runs on the same filesystem path the planner writes to.

*The spike doc itself becomes the verifiable artifact once the plan executes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 9 sections present and in scope | ARCH-01 | Structural review of section headings against D-SKEL-02 list | Read SPIKE.md headings; confirm Domain / Audience Matrix / Route Reality Today / Variants A–E / v7.0 Watch Photos Lens / Decision Matrix / Cost Estimate per Variant / Recommendation / Ship-now Eligibility |
| Audience Matrix re-frames per D-AUDIENCE-01 | ARCH-01 | Semantic check — matrix must use viewer-state × ref-identity, NOT the ROADMAP SC#1 labels | Confirm rows = viewer-state (owner / non-owner-with-collection / non-owner-empty-collection / wishlist-holder / sold-this / anonymous-visitor-flagged-not-reachable) and columns = ref-identity (`watches.id` vs `watches_catalog.id`) |
| v7.0 lens applies all 4 sub-points × 5 variants (20 sketches) | ARCH-01 | Depth gate from D-V7-LENS-01 | Per variant, verify 4 sub-bullets: (1) where the carousel renders, (2) data joins, (3) writability axis, (4) variant × viewer-state cell interaction |
| Decision matrix scores 5 variants × 7 locked criteria | ARCH-01 | D-VARIANTS-02 locks the 7 criteria; the matrix must score all 5 variants on all 7 | Verify 5 rows × 7 columns: UX clarity / schema/URL stability / per-user data shape / v7.0 photo carousel fit / entry-point disruption / migration cost / irreversibility |
| Section 9 ship-now format is verbatim from `49-SPIKE.md` §9 | ARCH-01 | D-SKEL-02 §9 mandate; v5.2 mid-milestone requirement-add flow depends on format parity | Side-by-side: ROADMAP SC#4 quote, `**Verdict:** YES \| NO \| NEEDS-DISCUSSION`, `Strongly favored:` block, `Cheap:` block, `Trigger:` block referencing `/gsd-phase --insert` |
| Two landmines called out: `proxy.ts` for Variant B, `watches_catalog` not-wipeable for v7.0 cost | ARCH-01 | Memory-backed structural risks from `feedback_proxy_router_cache_poisoning` and `project_db_wipeable_2026_05_09` | Verify Variant B section cites `proxy.ts` router-cache-poisoning by name; verify any v7.0 photo cost note in §5 uses in-place ALTER + UPDATE, not wipe-and-reseed |
| Hard guardrail honored: no implementation files outside `.planning/` touched | ARCH-01 / D-GUARD-01 | Phase 50 is decision-only; any code change would violate ROADMAP SC#4 + REQUIREMENTS Out of Scope | `git diff --name-only main...HEAD` shows only `.planning/phases/50-*` paths (plus STATE.md / ROADMAP.md) |

---

## Validation Sign-Off

- [ ] SPIKE.md exists at locked path
- [ ] 9-section heading audit passes
- [ ] All 5 variants A–E scored on all 7 criteria
- [ ] v7.0 lens depth gate (4 × 5 = 20 sketches)
- [ ] Section 9 verbatim-format diff against `49-SPIKE.md` §9
- [ ] No implementation files modified (D-GUARD-01)
- [ ] `nyquist_compliant: true` set in frontmatter once the SPIKE.md ships and passes the audit

**Approval:** pending

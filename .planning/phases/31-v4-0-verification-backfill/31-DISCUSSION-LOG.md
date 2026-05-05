# Phase 31: v4.0 Verification Backfill - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 31-v4-0-verification-backfill
**Areas discussed:** File location, Audit baseline, Carryover scope, Audit closure

---

## File Location

| Option | Description | Selected |
|--------|-------------|----------|
| Reconstitute v4.0 phase dirs as archive | Create `.planning/milestones/v4.0-phases/23-.../23-VERIFICATION.md` + `24-.../24-VERIFICATION.md`. Honors the roadmap's "milestone archive" wording. Matches what `/gsd-complete-milestone` should have done (Phase 999.1 audit item flagged this archival miss). | ✓ |
| Recreate dirs under `.planning/phases/` | Create `.planning/phases/23-.../` + `24-.../`. Matches active-phase pattern but pollutes the active listing with non-active v4.0 directories that need re-archival. | |
| Co-locate under Phase 31 dir | Put both files inside `.planning/phases/31-v4-0-verification-backfill/`. Self-contained but breaks the "phase-level VERIFICATION sits next to its phase" convention. | |

**User's choice:** Delegated to Claude. Picked option 1 (reconstitute v4.0 archive).
**Notes:** Sets a precedent for future milestone archival shape; closes the same archival miss flagged for Phase 999.1 in the v4.0 audit. Captured as D-01 + D-02 in CONTEXT.md.

---

## Audit Baseline

| Option | Description | Selected |
|--------|-------------|----------|
| Current main (live `src/`) | Run greps + reads against today's `src/`. Line numbers stay valid going forward. Risk: v4.1 commits (Phases 28/29) may have altered Phase 23/24 surfaces — that drift becomes invisible without explicit detection. | |
| v4.0 ship commit (`5991c3f`) | Use `git show 5991c3f^:...` for every evidence read. Faithful retrospective but requires `git show` for everything; line numbers won't match `src/`; v4.1 evolution becomes invisible. | |
| Hybrid — current main + drift section | Audit current main as primary evidence. Add a "Drift since v4.0 ship" subsection per VERIFICATION.md if any v4.1 phase touched the audited surfaces. Best of both. | ✓ |

**User's choice:** Delegated to Claude. Picked option 3 (hybrid).
**Notes:** Drift detection commands specified in D-04. Threshold for whether drift gets a dedicated subsection (vs. footnote in an Observable Truth row) is in Claude's Discretion section of CONTEXT.md.

---

## Carryover Scope

| Option | Description | Selected |
|--------|-------------|----------|
| 23-05 SUMMARY.md backfill | Plan 23-05 has no SUMMARY.md (commit `4d362ff` shipped the implementation). Cheap to backfill from the commit message + diff. | |
| 23-VALIDATION.md + 24-VALIDATION.md frontmatter cleanup | Both VALIDATION.md files have `nyquist_compliant: false, wave_0_complete: false, status: draft`. Update frontmatter to reflect resolution if VERIFICATION passes. | |
| Strict scope — VERIFICATION.md only | Roadmap success criteria are exactly 3 items. Don't expand. Track other tech-debt under Deferred for future hygiene work. | ✓ |

**User's choice:** Delegated to Claude. Picked option 3 (strict scope).
**Notes:** Multi-select question asked, single answer chosen. The other items are real audit-flagged debt; tracked under Deferred section of CONTEXT.md so they're not lost. Phase 31's roadmap scope was carefully drawn — honoring that draws the line.

---

## Audit Closure

| Option | Description | Selected |
|--------|-------------|----------|
| Append closure section at bottom | Add `## Closure (2026-05-XX — Phase 31)` section. Preserves the original audit as a snapshot taken at v4.0 close; closure becomes a chronological postscript. Audit history stays readable. | ✓ |
| Edit tech_debt in-place + append closure note | Strike-through or remove the two VERIFICATION.md tech_debt items inline, update frontmatter `phases: 12/12 fully verified`, AND append a brief closure note. Cleaner final state but rewrites the audit trail. | |
| Update frontmatter only | Update `phases:` line and `tech_debt:` entries without a closure narrative. Minimal touch but loses the "why this resolved" context; probably too terse to satisfy the roadmap's "amended with a closure note" wording. | |

**User's choice:** Delegated to Claude. Picked option 1 (append closure section).
**Notes:** Captured as D-08, D-09, D-10 in CONTEXT.md. The original audit's frontmatter (including the `phases: 10/12` line) is preserved as historically accurate at audit time — current state lives in the new Closure section.

---

## Claude's Discretion

The user delegated all four gray-area decisions to Claude after the framing-clarification question. Claude made the calls with rationale:

- **D-01 file location:** Honored roadmap wording verbatim; fixed an existing archival miss pattern.
- **D-03/D-04 baseline:** Hybrid keeps line numbers useful and surfaces drift honestly.
- **Carryover:** Strict scope — Phase 31 was carefully drawn, expansion would dilute closure.
- **D-08 closure:** Append-only preserves audit history (audit is a snapshot, not a living document).

Additional discretionary calls captured inline in CONTEXT.md "Claude's Discretion" section: per-criterion evidence depth, single-vs-two-plan structure, date stamp formatting, drift subsection vs footnote threshold, score format choice.

## Deferred Ideas

Captured in the `<deferred>` section of CONTEXT.md. Summary:

- 23-05 SUMMARY.md backfill (real gap, not Phase 31 scope)
- 23-VALIDATION.md / 24-VALIDATION.md frontmatter cleanup (real gap, not Phase 31 scope)
- Phase 999.1 directory archival (v3.0 hygiene item)
- REQUIREMENTS.md traceability table refresh (cosmetic, regenerates at `/gsd-complete-milestone v4.1`)
- ~33 deferred human UAT items across Phases 18 / 20 / 20.1 / 22 / 23 (already tracked in PROJECT.md)
- Phase 24 partial Nyquist coverage (separate `/gsd-validate-phase 24` workflow)

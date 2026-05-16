# Phase 42: Nyquist Hardening Sweep + UAT Triage - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase closes two accumulated tech-debt items from the v4.0/v4.1 close,
neither of which touches the catalog schema serial spine:

1. **Nyquist hardening sweep (DEBT-10)** — retroactively bring six prior phases
   to Nyquist validation compliance:
   - Phases **25, 26** — no VALIDATION.md exists; author one for each.
   - Phases **27, 28, 30, 31** — VALIDATION.md exists (in git history only —
     see below) at `partial`; upgrade to `nyquist_compliant: true` +
     `wave_0_complete: true`.
   - Phase **30** (aspect-ratio / object-fit) gains CSS-chain assertions that
     check *computed styles*, not class names — assertions that would have
     caught the `h-full` hotfix regression flagged in the v4.1 feedback memory.

2. **UAT triage (DEBT-11)** — triage all ~33 deferred human UAT items across
   v4.0 Phases 18 (9) / 20 (5) / 20.1 (8) / 22 (6) / 23 (5) into explicit
   CLOSED / SUPERSEDED / DEFERRED dispositions. Output is a closure table.

**Parallel track:** numbered 42 for ROADMAP tracking; executes after Phase 39b,
overlapping Phase 40. Independent of catalog schema.

Discussion clarified HOW to execute this hardening. No new product capability
is in scope.

</domain>

<decisions>
## Implementation Decisions

### UAT Triage Process (DEBT-11)
- **D-01:** Claude pre-triages all ~33 UAT items. Each item is classified with
  **cited evidence** — the specific gap-closure plan (20.1-06 / 07 / 08) or
  Phase 39 / 39b change that supersedes it, or the reason it must defer.
  SUPERSEDED and DEFERRED items close on evidence alone (no live run). Items
  that genuinely survived become the **CLOSED-candidate** set.
- **D-02:** The CLOSED-candidate set is run as a **blocking** step during Phase
  42 execution — a `42-HUMAN-UAT.md` checklist (same pattern as
  `41-HUMAN-UAT.md`). Execution pauses for the user's sign-off; the closure
  table is finalized with real CLOSED / FAIL results **before the phase can
  close**. No provisional rows ship.
- **D-03:** Ambiguous items — can't prove superseded, but expensive/impractical
  to UAT (live-network behaviors, sparse-network states) — default to
  **CLOSED-candidate**, i.e. they go into the user's run-batch and get a real
  verdict. Err toward running, not deferring. Expect a larger-than-minimal batch.
- **D-04:** Fold in the adjacent v4.0-audit hygiene finding: move the **5 stale
  Phase 20.1 debug entries** (still `status: diagnosed` in `.planning/debug/`
  despite closure by gap-closure plans 20.1-06/07/08) to
  `.planning/debug/resolved/`. Items: `verdict-empty-collection-message`,
  `wishlist-textarea-not-prefilled`, `recently-evaluated-rail-missing` (06);
  `search-row-expand-broken` (07); `no-escape-from-manual-entry` (08).

### Triage Output Format
- **D-05:** The closure table lives in this phase's CONTEXT.md per ROADMAP
  success criterion #4. **Append the final closure table to this file** during
  execution (a `<triage>` section) — it is the canonical DEBT-11 artifact.
  Each row: item description · original phase · disposition (CLOSED / SUPERSEDED
  / DEFERRED) · resolution note (for SUPERSEDED, cite the superseding phase/plan;
  for DEFERRED, an explicit reason; for CLOSED, the UAT result).

### Computed-Style Testing (DEBT-10)
- **D-06:** **Add Playwright** as the CSS-chain assertion tool — committed
  regardless of whether jsdom `getComputedStyle` could suffice. Real-browser
  layout is treated as the only honest way to assert the CSS chain, and this
  establishes browser-test infra future visual phases reuse.
- **D-07:** Browser-based computed-style assertions cover **all visual surfaces
  touched by Phases 25–31**, not only Phase 30's aspect-ratio / object-fit. Any
  visual rendering in scope gets a computed-style assertion.
- **D-08:** All new assertions check **computed styles, not class names**
  (DEBT-10 hard requirement; also ROADMAP success criterion #5).

### VALIDATION.md Depth — Phases 25 & 26
- **D-09:** **Targeted** depth. Author the D-07 browser tests for 25/26 visual
  surfaces. For non-visual requirements (NAV-13..15, UX-01..08, WYWT-20..21),
  VALIDATION.md **cites existing test-suite coverage** where it exists and
  records **prod UAT approval (commit `7132ac0`, 2026-05-02)** as wave-0
  evidence for the rest. Author new behavioral tests **only where there is a
  genuine coverage gap**. Do not re-litigate phases that shipped to prod with
  full UAT sign-off.

### VALIDATION.md File Location
- **D-10:** The Phase 25–31 directories were **deleted** by commit `dd58ba4`
  ("docs: start milestone v5.0") — not archived. The 27/28/30/31 VALIDATION.md
  files exist only in git history; 25/26 never had one. **Consolidate all 6
  VALIDATION.md files under a `42-validation-backfill/` subfolder** inside this
  phase directory. Phase 42 owns DEBT-10 end-to-end; the debt closure is
  self-contained and traceable in one place. Source phase directories stay
  deleted — do NOT recreate them.

### Claude's Discretion
- **Existing partial VALIDATION.md (27, 28, 30, 31):** apply the same targeted
  principle as D-09 — recover the file from git history
  (`git show dd58ba4^:<path>`), root-cause what made it `partial`, close that
  specific gap, add the D-07 browser tests for that phase's visual surfaces,
  then flip frontmatter to `nyquist_compliant: true` + `wave_0_complete: true`.
  Don't re-derive full coverage for already-shipped phases.
- **Playwright integration mechanism:** prefer **Vitest browser mode**
  (`vitest --browser` with the Playwright provider) over a standalone
  `@playwright/test` runner — keeps a single test runner and one config.
  Researcher confirms this is viable on the current Vitest 2.1.9 / Next.js 16
  setup; if not, a scoped standalone Playwright config is the fallback.
- **Consolidated filenames:** inside `42-validation-backfill/`, keep the
  original phase-numbered names (`25-VALIDATION.md` … `31-VALIDATION.md`) so
  each file is recognizable by the phase it validates.
- **UAT item sourcing:** the ~33 items are enumerated in
  `v4.0-MILESTONE-AUDIT.md` (the per-phase `items:` blocks). Use that as the
  authoritative source list for the triage table.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §DEBT-10, §DEBT-11 — the two requirements this
  phase satisfies; DEBT-10 names the exact target phases and the computed-style
  mandate, DEBT-11 names the five source phases and the closure-table contract.
- `.planning/ROADMAP.md` §"Phase 42" — the 5 locked success criteria.

### UAT Triage Source Material (DEBT-11)
- `.planning/milestones/v4.0-MILESTONE-AUDIT.md` — **authoritative enumeration**
  of all ~33 deferred UAT items, broken down per phase in the `items:` blocks
  (Phase 18 / 20 / 20.1 / 22 / 23). Also documents the 5 stale debug entries
  (D-04) and notes which 20.1/22 items the audit already suspects are stale.
- `.planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md`
  — Phase 23's 5 pending UAT items + frontmatter `human_verification` array.

### Nyquist Hardening Source Material (DEBT-10)
- Git history only — Phase 27/28/30/31 VALIDATION.md were deleted by commit
  `dd58ba4`. Recover via `git show dd58ba4^:.planning/phases/<dir>/<file>`.
  Relevant deleted paths:
  - `.planning/phases/27-watch-card-collection-render-polish/27-VALIDATION.md`
  - `.planning/phases/28-add-watch-flow-verdict-copy-polish/28-VALIDATION.md`
  - `.planning/phases/29-nav-profile-chrome-cleanup/29-VALIDATION.md` (the only
    already-COMPLIANT one — use as the reference shape for the upgrades)
  - `.planning/phases/30-wywt-capture-alignment-fix/30-VALIDATION.md`
  - `.planning/phases/31-v4-0-verification-backfill/31-VALIDATION.md`
- `.planning/codebase/TESTING.md` — **stale** (generated 2026-04-11, says "no
  tests"); current reality is Vitest 2.1.9 + jsdom 25 + Testing Library, per
  `package.json`. Treat package.json as ground truth.

### Reference Artifacts (validation shape / patterns)
- `.planning/phases/41-account-danger-zone-branded-auth-emails-parallel-track/41-HUMAN-UAT.md`
  — the `*-HUMAN-UAT.md` pattern D-02 reuses for the blocking UAT checklist.
- `.planning/phases/41-account-danger-zone-branded-auth-emails-parallel-track/41-VALIDATION.md`
  — a recent compliant VALIDATION.md for frontmatter/structure reference.

### Memory (project feedback — informs DEBT-10)
- Auto-memory `feedback_ui_spec_css_chain_blind_spot.md` — the v4.1 feedback
  that the 6-pillar checker validated declared tokens, not the CSS chain; the
  Phase 30 black-bar shipped through 6/6 PASS. This is the direct origin of
  DEBT-10's "computed styles, not class names" requirement and the bar that
  D-06/D-07/D-08 must meet.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Test stack** — Vitest 2.1.9 + jsdom 25 + `@testing-library/react` 16 +
  `@testing-library/jest-dom` 6 + `@testing-library/user-event` 14. `npm test`
  runs `vitest run`. Playwright (D-06) is additive on top of this; Vitest
  browser mode is the preferred integration so the runner count stays at one.
- **`*-HUMAN-UAT.md` pattern** — Phase 41 produced `41-HUMAN-UAT.md`; D-02's
  blocking UAT checklist follows that shape.
- **Compliant VALIDATION.md exemplars** — Phase 29 (the only v4.1 phase that
  reached COMPLIANT) and Phase 41's VALIDATION.md show the target frontmatter
  (`nyquist_compliant: true`, `wave_0_complete: true`) and structure.

### Established Patterns
- VALIDATION.md is a per-phase artifact with YAML frontmatter
  (`nyquist_compliant`, `wave_0_complete`, `status`). D-10 deliberately breaks
  the per-phase *location* convention (source dirs are gone) but keeps the
  per-phase *file* identity via `42-validation-backfill/<NN>-VALIDATION.md`.
- No CI exists (`.github/workflows/` absent). New tests must pass locally via
  `npm test`; this phase does not introduce CI.

### Integration Points
- Playwright / Vitest browser mode wires into the existing `vitest.config`
  and `package.json` test scripts.
- The triage closure table appends into this CONTEXT.md as a `<triage>`
  section (D-05) — the only file DEBT-11 must produce.

</code_context>

<specifics>
## Specific Ideas

- The acceptance bar for DEBT-10 is concrete and quotable: assertions that
  **"would have caught the `h-full` hotfix regression."** Every Phase 30
  CSS-chain assertion should be checked against that question explicitly.
- "Don't re-litigate shipped phases" is the governing principle for D-09 —
  Phases 25/26 had real prod UAT sign-off; the goal is closing the *artifact*
  gap, not reconstructing validation as if the phases were unverified.

</specifics>

<deferred>
## Deferred Ideas

- **DEBT-12 (drizzle journal repair)** — explicitly NOT in Phase 42. It is
  unscheduled/opportunistic per REQUIREMENTS.md, to land with the next prod
  deploy needing `drizzle-kit migrate` (likely Phase 35/36/37). Out of scope.
- **CI pipeline** — no `.github/workflows/` exists. Setting up CI so these new
  tests run on every push is a worthwhile follow-up but is its own concern, not
  part of this hardening sweep.

None other — discussion stayed within phase scope.

</deferred>

---

*Phase: 42-Nyquist Hardening Sweep + UAT Triage*
*Context gathered: 2026-05-15*

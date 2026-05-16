# Phase 42: Nyquist Hardening Sweep + UAT Triage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 42-Nyquist Hardening Sweep + UAT Triage
**Areas discussed:** UAT triage stance, Computed-style testing, VALIDATION depth 25/26, VALIDATION file home

---

## UAT Triage Stance

### Triage flow
| Option | Description | Selected |
|--------|-------------|----------|
| Claude pre-triages, you run survivors | Claude classifies all 33 with cited evidence; SUPERSEDED/DEFERRED close on evidence; survivors become a CLOSED-candidate batch | ✓ |
| You run every survivor | Any non-superseded item gets a real UAT run; 15-20+ live runs | |
| Documentation-only triage | No live runs; everything SUPERSEDED or DEFERRED; zero CLOSED rows | |

**User's choice:** Claude pre-triages, you run survivors.

### UAT timing
| Option | Description | Selected |
|--------|-------------|----------|
| Blocking step during execution | 42-HUMAN-UAT.md checklist; closure table finalized with real results before phase closes | ✓ |
| Post-phase async handoff | Phase closes immediately with provisional 'pending UAT' rows | |

**User's choice:** Blocking step during execution.

### Ambiguous-item default
| Option | Description | Selected |
|--------|-------------|----------|
| DEFERRED with explicit reason | Ambiguous items carry to v5.x as DEFERRED | |
| Treat as CLOSED-candidate | Err toward running it — ambiguous items go into the UAT batch | ✓ |
| Claude decides per-item | No blanket rule; per-item judgment | |

**User's choice:** Treat as CLOSED-candidate.

### Debug-entry hygiene fold-in
| Option | Description | Selected |
|--------|-------------|----------|
| Fold in — it's adjacent triage | Move the 5 stale Phase 20.1 debug entries to resolved/ | ✓ |
| Keep out of scope | Leave for a separate /gsd-quick task | |

**User's choice:** Fold in — it's adjacent triage.

---

## Computed-Style Testing

### Browser-runner appetite
| Option | Description | Selected |
|--------|-------------|----------|
| Stay in jsdom if it suffices | No new infra; document a limitation if jsdom can't catch the regression | |
| Add Playwright if research says jsdom can't | Conditional adoption | |
| Add Playwright regardless | Commit to Playwright now as the CSS-chain assertion tool | ✓ |

**User's choice:** Add Playwright regardless.

### Playwright coverage scope
| Option | Description | Selected |
|--------|-------------|----------|
| Phase 30 CSS-chain only | Browser tests scoped strictly to DEBT-10's explicit Phase 30 mandate | |
| All visual surfaces in scope phases | Every visual rendering touched by Phases 25-31 gets a computed-style assertion | ✓ |

**User's choice:** All visual surfaces in scope phases.

---

## VALIDATION Depth 25/26

| Option | Description | Selected |
|--------|-------------|----------|
| Targeted — browser tests + cite existing | D-06 browser tests + cite existing coverage + prod UAT 7132ac0 as wave-0 evidence; new tests only for real gaps | ✓ |
| Full fresh wave-0 coverage | Author tests from scratch for all 13 requirements of 25/26 | |
| Documentation-only VALIDATION.md | No new behavioral tests; flip frontmatter on the prod sign-off alone | |

**User's choice:** Targeted — browser tests + cite existing.

---

## VALIDATION File Home

| Option | Description | Selected |
|--------|-------------|----------|
| Consolidate in Phase 42 dir | All 6 VALIDATION.md become Phase 42 artifacts in a 42-validation-backfill/ subfolder | ✓ |
| Recreate the phase directories | Restore .planning/phases/27-.../ etc. from git history | |
| Restore into milestone archive | Place files under milestone archive dirs, matching the 23/24 precedent | |

**User's choice:** Consolidate in Phase 42 dir.

---

## Claude's Discretion

- Apply the targeted-depth principle (from VALIDATION depth 25/26) uniformly to the existing partial VALIDATION.md files (27, 28, 30, 31) — close the specific gap that made each `partial`, don't re-derive full coverage.
- Prefer Vitest browser mode over a standalone `@playwright/test` runner, to keep a single test runner; standalone Playwright config is the fallback if browser mode isn't viable on Vitest 2.1.9 / Next.js 16.
- Keep original phase-numbered filenames inside `42-validation-backfill/`.
- Source the ~33 UAT items from `v4.0-MILESTONE-AUDIT.md`'s per-phase `items:` blocks.

## Deferred Ideas

- **DEBT-12 (drizzle journal repair)** — out of scope; unscheduled/opportunistic per REQUIREMENTS.md, to land with a future prod-deploy phase.
- **CI pipeline** — no `.github/workflows/` exists; setting up CI for the new tests is a worthwhile follow-up but is its own concern.

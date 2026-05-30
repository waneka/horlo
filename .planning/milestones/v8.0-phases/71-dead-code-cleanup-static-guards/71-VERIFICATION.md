---
phase: 71-dead-code-cleanup-static-guards
verified: 2026-05-29T12:41:00Z
status: passed
must_haves_score: 4/4
re_verification: false
risk_noted:
  - id: WR-01
    summary: "8 pre-existing static tests in tests/static/ use node:fs (existsSync/readFileSync) without @vitest-environment node. These passed locally and in the current build, but widening prebuild to vitest run tests/static/ means Vercel prebuild now runs them. Per project_vitest_static_node_env.md, if Vercel externalizes all of node:fs (not just readdirSync/statSync), those tests will fail the Vercel prebuild. Affected: CollectionFitCard.no-engine.test.ts, ReferenceIdentityCard.no-engine.test.ts, hierarchy.lineage-3-node.test.ts, search-dal.movement-type.test.ts, WatchForm.accordion.guards.test.ts, WatchCard.sold-badge.test.tsx, composer-engine-alignment.test.ts, email-templates.test.ts. Fix: add // @vitest-environment node as line 1 to each. Pre-existing issue, not introduced by Phase 71, but Phase 71 widens the exposure path."
    severity: risk_only
    blocking: false
---

# Phase 71: Dead Code Cleanup + Static Guards — Verification Report

**Phase Goal:** `VerdictStep`, `WishlistRationalePanel`, and `PasteSection` (and their test files) are deleted from the codebase; two `@vitest-environment node` static guards prevent their reintroduction; `RecentlyEvaluatedRail` disposition is resolved; `FlowState` obsolete variants are removed.
**Verified:** 2026-05-29T12:41:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | VerdictStep.tsx, WishlistRationalePanel.tsx, PasteSection.tsx (+ test files) absent; npm run build exits 0; no remaining callers | VERIFIED | All 6 files absent (filesystem check). No import matches in src/ or tests/. npm run build exit code 0. |
| 2 | tests/static/AddWatchFlow.no-verdict-step.test.ts with @vitest-environment node fails CI on re-import | VERIFIED | File exists; line 1 is exactly `// @vitest-environment node`; 3 it() blocks with correct imports-only regex; passes vacuously (17 files, 454 tests green in prebuild). |
| 3 | tests/static/AddWatchFlow.no-collection-fit-card.test.ts with @vitest-environment node fails CI on CollectionFitCard import | VERIFIED | File exists; line 1 is exactly `// @vitest-environment node`; exactly 8 ADD_FLOW_FILES entries matching D-04; 8 named it() blocks; 454/454 tests green. |
| 4 | FlowState discriminated union contains only active states; old verdict-ready / wishlist-rationale-open / submitting-wishlist variants gone | VERIFIED (with reconciliation) | Zero matches for verdict-ready, wishlist-rationale-open, submitting-wishlist in flowTypes.ts. ROADMAP SC #4 lists search-results/structured-input/extracting-structured as expected active variants, but Phase 70 D-01 + CLNP-05 reconciliation (documented in both 70-CONTEXT.md §D-01 and 71-CONTEXT.md §CLNP-05) explicitly collapses those into search-idle at the orchestrator level — SearchEntry owns the sub-states internally. The reconciliation is authoritative: Phase 71 asserts against the D-01 final 7-variant shape, not the ROADMAP draft enumeration. Core intent (old verdict-flow variants gone) is satisfied. |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/watch/VerdictStep.tsx` | Absent (deleted) | ABSENT | `test ! -f` passes |
| `src/components/watch/VerdictStep.test.tsx` | Absent (deleted) | ABSENT | `test ! -f` passes |
| `src/components/watch/WishlistRationalePanel.tsx` | Absent (deleted) | ABSENT | `test ! -f` passes |
| `src/components/watch/WishlistRationalePanel.test.tsx` | Absent (deleted) | ABSENT | `test ! -f` passes |
| `src/components/watch/PasteSection.tsx` | Absent (deleted) | ABSENT | `test ! -f` passes |
| `src/components/watch/PasteSection.test.tsx` | Absent (deleted) | ABSENT | `test ! -f` passes |
| `src/components/watch/RecentlyEvaluatedRail.tsx` | Absent (deleted) | ABSENT | `test ! -f` passes |
| `src/components/watch/RecentlyEvaluatedRail.test.tsx` | Absent (deleted) | ABSENT | `test ! -f` passes |
| `tests/static/AddWatchFlow.no-verdict-step.test.ts` | Exists, 30+ lines, line 1 = `// @vitest-environment node` | VERIFIED | Exists; line 1 confirmed; 39 lines; 3 it() blocks with correct regex pattern. |
| `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` | Exists, 30+ lines, line 1 = `// @vitest-environment node`, 8-file ADD_FLOW_FILES | VERIFIED | Exists; line 1 confirmed; 39 lines; ADD_FLOW_FILES has exactly 8 entries per D-04. |
| `package.json` | scripts.prebuild = `"vitest run tests/static/"` | VERIFIED | `node -e` extraction returns exact string. |
| `src/components/watch/flowTypes.ts` | 64 lines; exports only FlowState + DupeContext; zero RailEntry / PendingTarget | VERIFIED | 64 lines; grep returns 0 for RailEntry and 0 for PendingTarget; FlowState and DupeContext exports both present; 7 `kind:` variants. |
| `src/components/watch/AddWatchFlow.tsx` | Zero rail/setRail/railRef/RailEntry tokens; import is `{ FlowState, DupeContext }`; JSDoc names no-verdict-step guard | VERIFIED | `grep -cE` returns 0; import verified; `tests/static/AddWatchFlow.no-verdict-step.test.ts` appears at line 36 of the file. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json scripts.prebuild` | `tests/static/` | `vitest run tests/static/` | WIRED | Exact string confirmed; prebuild runs 17 files, 454 tests including both Phase 71 guards. |
| `AddWatchFlow.tsx line ~24` | `flowTypes.ts` | `import type { FlowState, DupeContext }` | WIRED | RailEntry removed; only two active exports remain. |
| `AddWatchFlow.tsx JSDoc line 36` | `tests/static/AddWatchFlow.no-verdict-step.test.ts` | Prose reference (D-03) | WIRED | `grep -c` returns 1. |
| `no-verdict-step.test.ts` | `src/components/watch/AddWatchFlow.tsx` | readFileSync + 3 regex assertions | WIRED | File reads the target; 3 it() blocks with correct pattern. |
| `no-collection-fit-card.test.ts` | 8 ADD_FLOW_FILES | readFileSync loop per file | WIRED | Exactly 8 paths; loop generates 8 named test cases. |

---

### Data-Flow Trace (Level 4)

Not applicable. Phase 71 is pure code subtraction — no components render dynamic data. Zero new user-visible UI.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| npm run build exits 0 | `npm run build` | exit 0; prebuild 454/454 green; compiled successfully | PASS |
| Static guard suite passes | `npx vitest run tests/static/` | 17 files, 454 tests, 0 failures | PASS |
| no-verdict-step guard GREEN (3 it()) | Included in static suite run above | `AddWatchFlow.no-verdict-step.test.ts (3 tests)` green | PASS |
| no-collection-fit-card guard GREEN (8 it()) | Included in static suite run above | `AddWatchFlow.no-collection-fit-card.test.ts (8 tests)` green | PASS |
| 6-file add-flow suite passes | `npx vitest run AddWatchFlow.test.tsx SearchEntry.test.tsx StructuredEntryPanel.test.tsx ConfirmStep.test.tsx DupeBanner.test.tsx flowTypes.test.ts` | 6 files, 89 tests, 0 failures | PASS |

---

### Probe Execution

No probes declared for this phase. Phase 71 is verified entirely by build gate + static guard suite.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CLNP-01 | 71-02-PLAN.md | VerdictStep, WishlistRationalePanel, PasteSection deleted with test files; no callers remain | SATISFIED | All 6 files absent; no import matches in codebase; build green. |
| CLNP-02 | 71-01-PLAN.md | Static guard tests/static/AddWatchFlow.no-verdict-step.test.ts with @vitest-environment node | SATISFIED | File exists; directive at line 1; 3 it() blocks; passes in build. |
| CLNP-03 | 71-01-PLAN.md | Static guard tests/static/AddWatchFlow.no-collection-fit-card.test.ts with @vitest-environment node | SATISFIED | File exists; directive at line 1; 8-file ADD_FLOW_FILES; passes in build. |
| CLNP-04 | 71-02-PLAN.md | RecentlyEvaluatedRail removed; RailEntry/PendingTarget swept from flowTypes.ts and AddWatchFlow.tsx | SATISFIED | RecentlyEvaluatedRail.tsx + .test.tsx absent; flowTypes.ts has 0 RailEntry/PendingTarget occurrences; AddWatchFlow.tsx has 0 rail/setRail/railRef/RailEntry tokens. |

No orphaned requirements. CLNP-05 and CLNP-06 are Phase 70 requirements (already satisfied in Phase 70 per REQUIREMENTS.md checkmarks).

---

### Anti-Patterns Found

No TBD / FIXME / XXX markers found in any Phase 71-modified files (`flowTypes.ts`, `AddWatchFlow.tsx`, `no-verdict-step.test.ts`, `no-collection-fit-card.test.ts`, `package.json`). Zero stubs, zero placeholder returns.

---

### Human Verification Required

None. Phase 71 has zero user-visible behavior changes. All acceptance criteria are mechanically verifiable: file absence, build gate, guard test execution, token grep.

---

### Risk Noted (Non-Blocking)

**WR-01: 8 pre-existing static tests now in Vercel prebuild scope without `@vitest-environment node`**

Phase 71 widened `package.json scripts.prebuild` from `vitest run tests/static/legacy-watch-routes.test.ts` to `vitest run tests/static/`. Eight pre-existing test files in that directory use `node:fs` (`existsSync`, `readFileSync`) without the `// @vitest-environment node` directive:

- `tests/static/CollectionFitCard.no-engine.test.ts`
- `tests/static/ReferenceIdentityCard.no-engine.test.ts`
- `tests/static/hierarchy.lineage-3-node.test.ts`
- `tests/static/search-dal.movement-type.test.ts`
- `tests/static/WatchForm.accordion.guards.test.ts`
- `tests/static/WatchCard.sold-badge.test.tsx`
- `tests/static/composer-engine-alignment.test.ts`
- `tests/static/email-templates.test.ts`

Per memory `project_vitest_static_node_env.md`, Phase 59 cost a failed prod deploy because `node:fs` was externalized under jsdom in Vercel's prebuild — `readdirSync` became undefined. None of these eight files use `readdirSync`/`statSync` (only `existsSync`/`readFileSync`), and the memory's explicit failure case was `readdirSync`. Whether `readFileSync`/`existsSync` are also externalized on Vercel is ambiguous from local behavior alone. All 17 tests currently pass locally in the `vitest run tests/static/` run (454/454 green), and the build gate passes.

**This is a pre-existing structural omission, not introduced by Phase 71.** Phase 71 widened the prebuild scope, which now exposes the gap to Vercel for the first time. The fix — adding `// @vitest-environment node` as line 1 to each of the eight files — is low-risk and eliminates the ambiguity permanently. Recommended as a follow-up before the next prod push.

This does NOT block phase verification. Phase 71 goal achievement is confirmed.

---

## Gaps Summary

No gaps. All 4 ROADMAP success criteria are satisfied in the codebase. The FlowState union divergence from the ROADMAP's enumeration of `search-results`/`structured-input`/`extracting-structured` is a documented, authoritative deviation from Phase 70 CLNP-05 reconciliation — both phases' CONTEXT documents explicitly record the collapse to `search-idle` and direct Phase 71 to assert against the D-01 final shape, not the ROADMAP draft.

---

_Verified: 2026-05-29T12:41:00Z_
_Verifier: Claude (gsd-verifier)_

# Phase 71: Dead Code Cleanup + Static Guards - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 71-dead-code-cleanup-static-guards
**Areas discussed:** RecentlyEvaluatedRail disposition, Static guard regex shape, CLNP-03 enforcement scope, Plan splitting strategy

---

## RecentlyEvaluatedRail disposition

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it outright | Remove `.tsx` + `.test.tsx` + `RailEntry` + `PendingTarget` + AddWatchFlow `useState<RailEntry[]>` + the type import. Rationale: component unrendered as of Phase 70, only consumer is its own test. Future Rdio-inspired surface would be a fresh component for the search-first flow. | ✓ |
| Retain for future repurpose | Keep `RecentlyEvaluatedRail.tsx` + `RailEntry` but strip legacy verdict field; remove from `AddWatchFlow`; leave as typed shell for v8.x+. Cost: permanently unrendered file warm through future refactors + static guard exclusion. | |
| Move to `.planning/archive/` | Git-mv the file into an archive location so deletion is reversible from the working tree. Used by some teams for code with long-term repurpose intent. Adds an archive convention the project doesn't currently have. | |

**User's choice:** Delete it outright
**Notes:** Becomes D-01 in CONTEXT.md. Decision drives the largest LOC subtraction in Phase 71 (~157 LOC component pair + RailEntry/PendingTarget/legacy verdict field from flowTypes.ts + useState line from AddWatchFlow.tsx).

---

## Static guard regex shape

| Option | Description | Selected |
|--------|-------------|----------|
| Imports-only regex | Match `from ['"](?:.*\/)?ComponentName['"]` — mirrors existing `tests/static/CollectionFitCard.no-engine.test.ts`. Robust to JSDoc/comment prose. Catches actual failure mode (re-importing). Requires JSDoc scrub for hygiene, but guard itself doesn't trip on prose. | ✓ |
| Full-content scan | Match bare component name anywhere via word-boundary regex. Stricter: catches stray JSDoc refs, dead string literals. Cost: prose mentioning dead names trips the guard (Phase 64 PAGE-03 was bitten by this — `feedback_decision_coverage_gate_citations`-adjacent lesson recorded in STATE.md). | |

**User's choice:** Imports-only regex
**Notes:** Becomes D-02 in CONTEXT.md. Mirror the Phase 20 D-04 docstring header style for reviewer cognitive consistency.

### JSDoc prose handling (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Reword to forward-looking | Replace dead-name list with: "AddWatchFlow is the search-first orchestrator (Phase 70). The legacy verdict flow is deleted; the no-verdict-step static guard prevents reintroduction." Names the static guard so future maintainers see the enforcement mechanism. | ✓ |
| Excise entirely | Strip the dead-name references with no replacement. JSDoc just describes what the file IS, not what it isn't. Cleanest, but loses historical breadcrumb to static guard. | |
| Leave as-is | Keep prose verbatim — imports-only guard tolerates it. Costs future maintainer asking "what's a VerdictStep?" with no obvious answer. | |

**User's choice:** Reword to forward-looking
**Notes:** Becomes D-03 in CONTEXT.md. Exact wording is implementer's choice (target: 2-4 lines, names the static guard file path).

---

## CLNP-03 enforcement scope

| Option | Description | Selected |
|--------|-------------|----------|
| Static list of 8 add-flow files | Guard reads from hardcoded array of `AddWatchFlow`, `SearchEntry`, `StructuredEntryPanel`, `ConfirmStep`, `DupeBanner`, `WatchForm`, `WatchPhotoStep`, `ExtractErrorCard`. Each checked individually for `from .*CollectionFitCard`. Matches success criterion #3 "any file in the tree" literal. Maintenance cost: new add-flow component requires list update. Mirrors Phase 60 `watch_photos` guard precedent. | ✓ |
| Transitive import walk from AddWatchFlow | Guard walks `AddWatchFlow.tsx` imports recursively within `src/components/watch/`. Catches new add-flow components automatically. Cost: more complex test (mini import graph walker), slower (fs.readdir + AST parse), fuzzy tree boundary. | |
| AddWatchFlow.tsx only | Guard checks only the orchestrator file — matches existing `CollectionFitCard.no-engine.test.ts` precedent. Cheapest. Cost: child component (future `DupeBanner v2`) could import CollectionFitCard without tripping. Diverges from success criterion #3 literal. | |

**User's choice:** Static list of 8 add-flow files
**Notes:** Becomes D-04 in CONTEXT.md. Maintenance cost acceptable — add-flow tree is stable post-Phase-70 and any new entry is a deliberate architectural change worth a code-review touch.

---

## Plan splitting strategy

| Option | Description | Selected |
|--------|-------------|----------|
| 2 plans — guards first, deletes second | **Plan 71-01:** Write both static guards (vacuous-pass against existing files). **Plan 71-02:** Delete 4 components + 4 test files + prune `flowTypes.ts` + AddWatchFlow.tsx residue + JSDoc reword. Guards-first means deletes land with active enforcement. Clean 2-commit story. Matches Phase 60's guard-then-delete cadence. | ✓ |
| 1 plan — atomic sweep | Single plan with all 6 work units. Smallest planning overhead, single SUMMARY.md, single verifier pass. Cost: long task list, one large commit-set harder to review file-by-file. Phase 70's gap plans were monolithic so project has appetite. | |
| 3 plans — fully split | **Plan 01:** guards. **Plan 02:** component file + test deletes. **Plan 03:** flowTypes + AddWatchFlow residue + JSDoc reword. Tightest atomic commits per concern. Cost: more orchestration overhead, two more SUMMARY.mds, three verifier runs. Only worth it for surgical rollback per concern. | |

**User's choice:** 2 plans — guards first, deletes second
**Notes:** Becomes D-05 in CONTEXT.md.

---

## Claude's Discretion

- **JSDoc reword exact wording** — D-03 specifies structural change; exact prose left to implementer (target: 2-4 lines, no dead-component names, references the static guard file path).
- **flowTypes.ts JSDoc trailer** — whether to add a small trailing comment marking the file as "post-cleanup, only DupeContext + FlowState live here" is implementer's call.
- **Test deletion timing within Plan 02** — `.tsx` + `.test.tsx` pair in same commit vs separate commits within Plan 02 is executor's choice.
- **flowTypes.test.ts updates** — if existing `flowTypes.test.ts` (Phase 70 Plan 04) has `RailEntry`/`PendingTarget` assertions, those must be deleted in Plan 02. Researcher should grep this.

## Deferred Ideas

- **Add-flow tree growth strategy** — if the tree grows past ~12 files, revisit the static-list-vs-transitive-walk tradeoff.
- **Rdio-style recents rail (future)** — if "recently evaluated" surface returns in v8.x+, it's a fresh design problem; gets its own phase. Per D-01, current `RecentlyEvaluatedRail.tsx` is NOT retained as a template.
- **Other v8.0 dead code** — anything not covered by CLNP-01..04 is out of scope for Phase 71. Post-Phase-70 grep findings (e.g., obsolete cache module exports) go to backlog or a future cleanup phase.

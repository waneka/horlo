# Phase 71: Dead Code Cleanup + Static Guards - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Subtract the legacy verdict-flow code from the codebase after Phase 70 wired the new search-first flow. Three component files + their test files get deleted, two `@vitest-environment node` static guards land to prevent their reintroduction, `RecentlyEvaluatedRail` disposition is resolved (delete), and `flowTypes.ts`'s Phase-70-deferred legacy exports (`RailEntry`, `PendingTarget`, the legacy `verdict: unknown | null` field) get swept.

What ships in this phase:

1. **Component file deletes (CLNP-01)** — `src/components/watch/VerdictStep.tsx` + `.test.tsx`, `src/components/watch/WishlistRationalePanel.tsx` + `.test.tsx`, `src/components/watch/PasteSection.tsx` + `.test.tsx`. All three are unrendered as of Phase 70 (zero JSX call sites in `AddWatchFlow.tsx`); their only remaining consumers are their own test files. ~770 LOC subtracting.

2. **RecentlyEvaluatedRail delete (CLNP-04)** — `src/components/watch/RecentlyEvaluatedRail.tsx` + `.test.tsx`. ~157 LOC. The component plus its types (`RailEntry`, `PendingTarget`, the legacy `verdict: unknown | null` field on RailEntry) are the largest legacy chunk in `flowTypes.ts`. Decision per D-01: delete outright, not retain for repurpose. If a recents rail returns in v8.x+ (Rdio-inspired surface in your v5.1 Explore territory), it'll be a fresh component designed for the search-first flow.

3. **Static guard CLNP-02** — `tests/static/AddWatchFlow.no-verdict-step.test.ts` with `// @vitest-environment node`. Fails CI if any of the three deleted component names reappear as an import statement in `AddWatchFlow.tsx`. Pattern mirrors `tests/static/CollectionFitCard.no-engine.test.ts` — imports-only regex (`from ['"](?:.*\/)?ComponentName['"]`) with `existsSync` vacuous-pass.

4. **Static guard CLNP-03** — `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` with `// @vitest-environment node`. Fails CI if `CollectionFitCard` is imported by any file in a hardcoded 8-file add-flow list (D-04). Pattern is the same imports-only regex per file, looped over the static list.

5. **flowTypes.ts prune** — Delete the `RailEntry` interface, the `PendingTarget` type alias, and the entire "Phase 71 forward-coordination" JSDoc block at lines 67-94. The `DupeContext` interface stays (consumed by Phase 70 confirming branch). The `FlowState` discriminated union stays as Phase 70 D-01 shipped it (no further variant additions — the union is correct as-is per CLNP-05 reconciliation; ROADMAP success criterion #4 is already satisfied by Phase 70's D-01).

6. **AddWatchFlow.tsx residue prune** — Remove `RailEntry` from the type-only `import type { ... } from './flowTypes'` line (line 24). Remove the `const [rail, setRail] = useState<RailEntry[]>([])` declaration (line 104) and any references to `rail` / `setRail` (no consumers remain post-Phase-70 since the rail is unrendered). Reword the top JSDoc (lines 35-36, 52) to a forward-looking statement per D-03.

7. **Plan splitting** — Two plans per D-05:
   - **Plan 71-01**: Write both static guards CLNP-02 + CLNP-03. They pass vacuously today (the imports are already absent from AddWatchFlow.tsx after Phase 70). This means active enforcement is in place before deletes land.
   - **Plan 71-02**: Delete the 4 component files + their 4 test files; prune `flowTypes.ts`; prune `AddWatchFlow.tsx` residue; reword JSDoc; verify `npm run build` exits 0 and `npx vitest run tests/static/` is green.

**Requirements delivered** (4 of 4): CLNP-01, CLNP-02, CLNP-03, CLNP-04. ROADMAP success criterion #4 (FlowState obsolete variants removed) is already satisfied by Phase 70 D-01 — no additional flowTypes.ts variant work in Phase 71 beyond the RailEntry/PendingTarget sweep.

**Not this phase:**
- Any change to the `FlowState` discriminated union beyond removing `RailEntry`/`PendingTarget` — Phase 70 D-01 shipped the final union shape; CLNP-05 reconciliation note in `70-CONTEXT.md` already established Phase 71 asserts against this final shape, not the ROADMAP draft enumeration.
- Any change to `DupeContext` — still actively consumed by Phase 70's `confirming` branch.
- Any new add-flow capability — Phase 70 closed the v8.0 flow; Phase 71 is pure subtraction.
- Any change to existing `tests/static/CollectionFitCard.no-engine.test.ts` (Phase 20 D-04 guard) — Phase 71's CLNP-03 is a new sibling guard, not a refactor of the existing one.
- Bundled visual UAT push to prod — Phase 71's plan-02 verification triggers the bundled prod UAT session covering the 12 deferred Phase 70 visual items + Phase 71's zero-user-visible cleanup (the cleanup itself is invisible to users; the bundle is for closing Phase 70's UAT debt in the same deploy).

</domain>

<decisions>
## Implementation Decisions

### RecentlyEvaluatedRail disposition (CLNP-04)

- **D-01: Delete RecentlyEvaluatedRail outright.** Remove `src/components/watch/RecentlyEvaluatedRail.tsx` + `.test.tsx`. Remove `RailEntry` interface + `PendingTarget` type alias + the legacy `verdict: unknown | null` field on RailEntry from `flowTypes.ts`. Remove the `import type { ... RailEntry ... }` and the `const [rail, setRail] = useState<RailEntry[]>([])` line from `AddWatchFlow.tsx`. Rationale: the component is unrendered as of Phase 70 and its only consumer is its own test file. The Rdio-inspired "recently played" surface lives in v5.1 Explore (SEED-008) territory — if a recents rail returns in v8.x+, it'll be a fresh component designed for the search-first flow, not this verdict-era residue. Cleanest cut.

### Static guard regex shape (CLNP-02 + CLNP-03)

- **D-02: Imports-only regex, mirror `tests/static/CollectionFitCard.no-engine.test.ts`.** Both new guards use the established Phase 20 pattern: `expect(src).not.toMatch(/from ['"](?:.*\/)?ComponentName['"]/)`. Each guard does `existsSync` vacuous-pass so it doesn't trip when target files have been moved/renamed during a partial refactor. Both guards include `// @vitest-environment node` at file head — REQUIRED for fs-walking guards per `project_vitest_static_node_env.md` (Phase 59 cost a failed prod deploy without it). Rationale: catches the actual failure mode (re-importing) without false-positives on JSDoc/comment prose; mirrors precedent for reviewer cognitive consistency.

- **D-03: Reword `AddWatchFlow.tsx` top JSDoc to forward-looking.** The current prose at lines 35-36 ("Hard-cutover: no PasteSection / VerdictStep / WishlistRationalePanel / RecentlyEvaluatedRail") and line 52 ("D-14 extracting-url is INLINE (no PasteSection)") names the dead components. After Phase 71 ships, those files are gone. Replace the dead-name list with: "AddWatchFlow is the search-first orchestrator (Phase 70). The legacy verdict flow is deleted; `tests/static/AddWatchFlow.no-verdict-step.test.ts` prevents reintroduction." Names the static guard so future maintainers see the enforcement mechanism. Keeps historical context light. The imports-only guard tolerates the old prose, but post-cleanup the prose serves no purpose.

### CLNP-03 enforcement scope

- **D-04: Static list of 8 add-flow files, per-file check.** CLNP-03's success criterion reads "any file in the add-flow component tree" — broader than just AddWatchFlow.tsx. The guard reads from a hardcoded array:

  ```ts
  const ADD_FLOW_FILES = [
    'src/components/watch/AddWatchFlow.tsx',
    'src/components/watch/SearchEntry.tsx',
    'src/components/watch/StructuredEntryPanel.tsx',
    'src/components/watch/ConfirmStep.tsx',
    'src/components/watch/DupeBanner.tsx',
    'src/components/watch/WatchForm.tsx',
    'src/components/watch/WatchPhotoStep.tsx',
    'src/components/watch/ExtractErrorCard.tsx',
  ]
  ```

  Each file checked individually for `from ['"].*CollectionFitCard['"]`. Rationale: matches the success criterion's literal scope without the complexity of a transitive import walk; mirrors how Phase 60's watch_photos guard listed explicit files. Maintenance cost (adding a new add-flow component requires updating the list) is acceptable — add-flow tree is stable post-Phase-70 and any new entry is a deliberate architectural change worth a code-review touch.

### Plan slicing (D-05)

- **D-05: Two-plan split — guards first, deletes second.**
  - **Plan 71-01**: Write `tests/static/AddWatchFlow.no-verdict-step.test.ts` (CLNP-02) and `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` (CLNP-03). Both guards pass vacuously against the current AddWatchFlow.tsx (imports already absent post-Phase-70). Commit each guard atomically.
  - **Plan 71-02**: Delete the 4 component files (`VerdictStep.tsx`, `WishlistRationalePanel.tsx`, `PasteSection.tsx`, `RecentlyEvaluatedRail.tsx`) + the 4 test files. Prune `flowTypes.ts` (`RailEntry`, `PendingTarget`, the Phase 71 forward-coordination JSDoc block). Prune `AddWatchFlow.tsx` (RailEntry type import, useState line, JSDoc reword per D-03). Verify `npm run build` exits 0, full `vitest run tests/static/` passes, and the broader add-flow vitest suite (AddWatchFlow + SearchEntry + StructuredEntryPanel + ConfirmStep + DupeBanner + flowTypes) stays green.

  Rationale: guards-first means the deletes land with active enforcement; if Plan 02 accidentally re-imports anything, Plan 01's guards catch it in the same PR. Two-commit story is clean for prod-UAT bundling with Phase 70 visual items. Matches Phase 60's guard-then-delete cadence.

### Claude's Discretion

- **JSDoc reword exact wording** — D-03 specifies the structural change (forward-looking, names the static guard) but the exact prose is left to the implementer. Target: 2-4 lines, no dead-component names, references the static guard file path.
- **flowTypes.ts JSDoc trailer** — the `Phase 71 forward-coordination` block at lines 67-78 should be deleted in full. Whether to add a small trailing comment marking the file as "post-cleanup, only DupeContext + FlowState live here" is implementer's call.
- **Test deletion strategy** — D-05 places test deletes in Plan 02 alongside their source files. Whether to delete `.tsx` + `.test.tsx` pairs in the same commit or separate commits within Plan 02 is the executor's choice; either preserves git-blame.
- **flowTypes.test.ts updates** — if the existing `flowTypes.test.ts` (Phase 70 Plan 04) has assertions referencing `RailEntry` or `PendingTarget`, those assertions must be deleted in Plan 02. Researcher should grep this during research.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Static guard precedent (CLNP-02 + CLNP-03)
- `tests/static/CollectionFitCard.no-engine.test.ts` — Phase 20 D-04 imports-only-regex pattern with `existsSync` vacuous-pass. Both new guards in Phase 71 mirror this exactly. Includes the docstring header style ("Phase 20 D-04 + Pitfall 1") that the new guards should adopt.
- `tests/static/legacy-watch-routes.test.ts` — Phase 64 `@vitest-environment node` precedent. Confirms the directive is REQUIRED for fs-walking guards in this project.

### Phase 70 forward-coordination (binding on Phase 71)
- `.planning/phases/70-addwatchflow-state-machine-rewrite-dupe-wiring/70-CONTEXT.md` §D-01 — final `FlowState` discriminated union shape; CLNP-02 asserts against THIS, NOT the ROADMAP CLNP-05 draft enumeration.
- `.planning/phases/70-addwatchflow-state-machine-rewrite-dupe-wiring/70-CONTEXT.md` §"Not this phase" — explicit forward note that Phase 71 deletes `VerdictStep` / `WishlistRationalePanel` / `PasteSection` + adds the static guards.
- `src/components/watch/flowTypes.ts` lines 67-94 — the `Phase 71 forward-coordination` JSDoc block + `RailEntry` interface + `PendingTarget` type alias. Phase 70 explicitly left these for Phase 71 to sweep.
- `src/components/watch/AddWatchFlow.tsx` lines 24, 35-36, 52, 104 — the residue Phase 71 prunes: `RailEntry` type import, dead-name JSDoc references, `useState<RailEntry[]>` declaration.

### Requirements
- `.planning/REQUIREMENTS.md` lines 68-71 — CLNP-01..04 acceptance criteria.
- `.planning/ROADMAP.md` lines 290-300 — Phase 71 goal + success criteria #1-4.

### Project landmines (must respect)
- Memory `project_vitest_static_node_env.md` — fs-walking guards MUST use `// @vitest-environment node` or Vercel prebuild fails (the build externalizes `node:fs` → `readdirSync` undefined). Both new guards in Phase 71 read files; both need the directive.
- Memory `feedback_decision_coverage_gate_citations.md` — plan-phase D-NN gate scans frontmatter `truths`/must-haves only, not XML-tag prose. When writing 71-01-PLAN.md and 71-02-PLAN.md, cite D-01 through D-05 in frontmatter `truths` to clear plan-checker.
- Memory `feedback_mobile_ui_verify_on_prod` — Phase 71 has zero user-visible UI changes, but the prod push bundles with Phase 70's 12 deferred visual UAT items. Don't fragment the push.
- Memory `project_baseline_not_green_build_is_gate` — `npm run build` (exit 0) is the authoritative verification gate for Phase 71. Pre-existing test-file errors in `tsc --noEmit` are baseline noise; don't attribute to this phase. ≥1 pre-existing `vitest` failure (CommentGateLocked font-medium) is baseline noise — verify only the add-flow + static suites.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`tests/static/CollectionFitCard.no-engine.test.ts`** — direct template for CLNP-02 + CLNP-03. Copy structure (describe block + imports-only regex + `existsSync` guard + docstring header) and substitute component names. Plan researcher should NOT design a new pattern — the precedent is binding.
- **`tests/static/legacy-watch-routes.test.ts`** — confirms `@vitest-environment node` directive precedent in the project.
- **The fact that `AddWatchFlow.tsx` already has zero imports of the dead components** (verified by grep at discuss time: only JSDoc-prose references remain at lines 35-36 + 52) — Plan 71-01's vacuous-pass strategy is sound. No source-code changes needed in Plan 01 to make the guards green.

### Established Patterns
- **`existsSync` vacuous-pass** — Phase 20's precedent. Guards return early if the target file is missing, so partial refactors / file moves don't cascade-fail the guard. Phase 71 inherits.
- **Per-file loop in a hardcoded list** — Phase 60's `watch_photos` guard. CLNP-03 uses this for the 8-file add-flow list.
- **Test file co-location with source** — Horlo convention: `Foo.tsx` ↔ `Foo.test.tsx` in the same directory. All 4 dead components follow this; deletes are 1:1 paired.

### Integration Points
- **`flowTypes.ts` after the prune** — only `DupeContext` interface + `FlowState` discriminated union remain. Both actively consumed by `AddWatchFlow.tsx` confirming branch + `DupeBanner.tsx`. The file shrinks from ~94 LOC to ~60 LOC.
- **`AddWatchFlow.tsx` after the prune** — type-only import drops `RailEntry`, useState line removed, JSDoc reworded. No behavior change. No new hooks, no new state, no new branches.
- **Build verification** — `npm run build` exits 0 is the gate. `npx vitest run tests/static/` + `npx vitest run src/components/watch/AddWatchFlow.test.tsx src/components/watch/flowTypes.test.ts` for the affected suites. Full `vitest run` carries pre-existing baseline failures and is not the gate.

</code_context>

<specifics>
## Specific Ideas

- **Static guard docstring style** — borrow the Phase 20 D-04 header format: "Phase 71 CLNP-02 + Pitfall N: AddWatchFlow.tsx MUST NOT import the deleted verdict-flow components." Names the requirement and gives reviewers an anchor.
- **JSDoc reword target tone** — match the existing AddWatchFlow.tsx documentation density (terse + forward-looking + names the enforcement mechanism). Avoid past-tense storytelling.

</specifics>

<deferred>
## Deferred Ideas

- **Add-flow tree growth strategy** — if the add-flow component tree grows beyond the 8 files in D-04 (e.g., a new sub-step component), the static list in CLNP-03 needs manual update. Not worth a transitive walk today; revisit if the tree grows past ~12 files.
- **Rdio-style recents rail (future)** — if a "recently evaluated" surface returns in v8.x or beyond, it's a fresh design problem (search-first flow, no verdict residue) and gets its own phase. Per D-01, the current `RecentlyEvaluatedRail.tsx` is not retained as a template.
- **Other v8.0 dead code** — anything not covered by CLNP-01..04 is out of scope for Phase 71. If post-Phase-70 grep surfaces other dead exports (e.g., obsolete cache module exports, unused taste-enrichment branches), they go in a backlog item or a future cleanup phase, not Phase 71.

</deferred>

---

*Phase: 71-Dead Code Cleanup + Static Guards*
*Context gathered: 2026-05-29*

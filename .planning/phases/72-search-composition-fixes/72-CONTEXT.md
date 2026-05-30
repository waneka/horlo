# Phase 72: Search Composition Fixes - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the 3 SRCH-* defects captured during the v8.0 prod UAT walk against `src/components/watch/SearchEntry.tsx` and its sole network call `searchCatalogForAddFlow` in `src/data/catalog.ts`:

1. **SRCH-01** (blocker) — multi-token queries past the brand return zero matches. `"Brut Datejust"` and `"Timex Weekender"` show no results while `"Brut"` / `"Timex"` alone do. Root cause confirmed at `src/data/catalog.ts:555` — the DAL builds `pattern = %${lowerQ}%` and matches that single substring against each column independently; no single column contains the whole multi-token query so the WHERE-OR returns zero rows.
2. **SRCH-02** (major) — combobox keyboard navigation broken. Up/Down arrows do nothing; Enter closes the popup without firing `onPick`. The composition at `SearchEntry.tsx:207-333` looks correct on paper (`<Combobox.Item value={r} index={i}>` + `filteredItems={results}` + `filter={null}`), so the root cause requires base-ui docs research before the fix.
3. **SRCH-03** (major) — "Not finding it? Add manually" footer click is a no-op. The footer `<button>` at `SearchEntry.tsx:321-327` lives INSIDE `<Combobox.List>`, which appears to swallow non-Item pointer events. Hypothesis confirmed by reading composition; fix is relocation.

**Constraints inherited from v8.1 milestone scope:**
- Pure subtraction-of-defects against shipped v8.0 code — no new features (REQUIREMENTS.md §Pattern).
- `npm run build` (exit 0) is the gate. NOT `tsc --noEmit` (pre-existing test-file errors) and NOT `vitest run` (pre-existing CommentGateLocked font-medium failure) — these are baseline noise per `project_baseline_not_green_build_is_gate` memory.
- `workflow.use_worktrees = false` permanently (build-gated project; `.env.local` unavailable in worktrees per `feedback_execute_phase_no_worktree_when_db` memory).
- Each phase ships its own targeted regression test alongside the fix.

**Not this phase:**
- ROUTE-01 (owned-redirect 404) — Phase 73
- DUPE-04 (DupeBanner gate copy) + MOB-01 (iOS auto-zoom) — Phase 74
- Catalog row cleanup for `"TIMEX Weekender 38mm Fabric Strap Watch"` and similar noisy rows — DEFERRED (DAL fix renders the cleanup orthogonal; see D-01 below)
- Migration to Postgres `tsvector` / GIN — DEFERRED to SEED-009 Catalog Expansion when scale justifies it (see Deferred Ideas)
- Phase 70's `AddWatchFlow` orchestration, DUPE wiring, ConfirmStep contract — frozen; SearchEntry remains a pure presenter per Phase 69 D-03 / Phase 68 precedent
- Any change to `/search` page DAL (`searchCatalogWatches`), the `/search` page UX, the `parseSearchQuery` parser, the `useCatalogSearchCache` hook, or the `viewerUserId` plumbing

</domain>

<decisions>
## Implementation Decisions

### SRCH-01 — multi-token search fix

- **D-01 (cleanup scope):** DAL fix only. NO catalog row edits in this phase. The token-AND DAL fix will already match the user-flagged noisy row `"TIMEX Weekender 38mm Fabric Strap Watch"` because both `"timex"` and `"weekender"` substring-hit (brand=`Timex`, model contains `Weekender`). Catalog hygiene as a sweep belongs to a future phase; see Deferred Ideas for the explicit hand-off.

- **D-02 (DAL primitive):** Tokenize + AND-of-ORs over ILIKE. Drop-in replacement for the current single-substring approach. Split `qTrimmed` on whitespace; each resulting token must hit `(brand_normalized ILIKE %token% OR model_normalized ILIKE %token% OR reference_normalized ILIKE %token%)`. The `WHERE` becomes an `AND` of N per-token `OR`-clauses. Preserve the existing `queryNormalized` (alphanumeric-stripped) lane for the reference-column branch and the `exactRefOrderTier` exact-reference bump above the popularity sort — both rank tiers stay intact. Rejected: Postgres `tsvector + GIN` migration (right call for SEED-009 Catalog Expansion scale + UX maturity; v8.1 is strict subtraction-of-defects per REQUIREMENTS.md §Pattern; migration touches both DBs per `db_wipeable_2026_05_09` memory and would widen the phase to ~3 plans). Rejected: planner-picks (the BEHAVIOR is the decision; locking the primitive in CONTEXT prevents tsvector creep during planning).

- **D-03 (tokenization rules):** Whitespace split on `qTrimmed.split(/\s+/).filter(Boolean)`. No quote handling, no `-exclusion`, no per-token min-length floor (the existing `qTrimmed.length < SEARCH_ADD_FLOW_TRIM_MIN_LEN` early-return at `catalog.ts:552` already gates the whole query, which is sufficient — once we know the query is ≥ min length, single-character tokens like `"38"` are legitimate reference fragments). Empty token list (impossible after the early-return but defensive) → return `[]` early.

- **D-04 (parameter binding):** Continue using Drizzle parameterized template binds for every per-token pattern. NEVER string-concat into SQL text — preserves the T-67-02-01 mitigation called out in the `searchCatalogForAddFlow` docstring. The pattern construction `` `%${token}%` `` happens in TypeScript, the resulting string is bound — same shape as today's single `pattern` variable, just N of them.

### SRCH-02 — combobox keyboard navigation fix

- **D-05 (scope):** Success-criterion minimum. Up/Down arrows move active option through result rows; Enter on active option fires `onPick(activeResult)`; Tab and Escape exit the popup cleanly without trapping focus (ROADMAP §"Phase 72" SC#2 + SC#4 verbatim). Whatever base-ui ships for free above this (Home/End, PageUp/PageDown, typeahead first-letter) stays for free but is NOT a tested guarantee. Rejected: full WAI-ARIA combobox contract scope-add (premature; v8.1 is subtraction-only; if a user reports the gap, it becomes its own polish).

- **D-06 (root-cause method):** Research base-ui docs FIRST, then fix. Planner reads `node_modules/@base-ui/react/combobox` README + the v1.3.0 changelog + any combobox-controlled-state examples to identify the exact composition mistake before changing code. The current composition LOOKS correct (`<Combobox.Item value={r} index={i}>` + `filteredItems={results}` + `filter={null}` + `inputValue` controlled + `open` controlled + `itemToStringValue`), so a guess-and-revert loop wastes context. Aligns with AGENTS.md "read node_modules/next/dist/docs before writing code" applied to base-ui as a third-party primitive. Likely suspects worth researching (rank-order, for the planner to verify NOT to fix blindly):
  - (a) Object-valued `value={r}` requires `isItemEqual` or similar comparator for the active-item tracker to identify matches across renders — current code passes no comparator.
  - (b) Controlled `open` combined with the focused-but-unselected initial state may prevent base-ui from setting an initial `activeIndex`, leaving arrow-key handlers with nothing to advance from.
  - (c) `itemToStringValue` returns `r.catalogId` but the `<Combobox.Item value={r}>` is the OBJECT — possible mismatch between the value used for highlight tracking vs the value passed to `onValueChange`.

- **D-07 (fix discipline):** Single targeted code change after research. Do NOT layer multiple speculative fixes simultaneously. If research surfaces two candidate causes, fix one, verify keyboard works, then evaluate the second. Bisecting beats blanket changes (also keeps the regression test specific). Rejected: spike a minimal reproduction (planner-internal research suffices for a single component on a known primitive). Rejected: strip-and-rebuild bisection (slower than reading the docs first).

### SRCH-03 — "Not finding it? Add manually" footer click fix

- **D-08 (placement):** Move the footer `<button>` OUTSIDE `<Combobox.List>` but INSIDE `<Combobox.Popup>` as a sibling of List. The popup still positions it visually (anchored under the input, scoped to popup open/close lifecycle), but the listbox no longer intercepts pointer events. Closest to today's visual behavior — minimal CSS adjustment. Rejected: render OUTSIDE the popup entirely (would make the footer always visible whenever query.length ≥ N regardless of popup state — diverges from the user's mental model that "this row is part of the results menu"). Rejected: `Combobox.Item` with a `MANUAL_SENTINEL` value (gets keyboard nav for free but widens the `onValueChange` / `onPick` contract with a sentinel branch; the existing typed shape `SearchCatalogWatchResult` doesn't have a "manual" kind and adding one bleeds into Phase 70's owned-redirect/confirm branching code).

- **D-09 (handler):** Keep `onClick={() => setShowPanel(true)}` exactly as it is at `SearchEntry.tsx:323`. The handler was always correct — only the placement broke it. After moving outside List, the click reaches the button reliably. No state-machine changes; the existing `showPanel || forceClose` derivation at `SearchEntry.tsx:120` still drives the inline StructuredEntryPanel mount.

- **D-10 (keyboard reach for the footer):** Footer is NOT in the keyboard arrow-nav loop (Combobox arrow keys still traverse Combobox.Item rows only). Footer is reachable via Tab from the input (focus moves into the popup's focusable children). Acceptable per SC#3 ("Clicking the 'Not finding it? Add manually' footer row") which is explicit about CLICK, not keyboard activation. If a future polish wants keyboard-first parity, that's a deferred refinement, not a Phase 72 fix.

### Regression tests

- **D-11 (test shape):** Per-defect tests at the most natural level. Three small additions, each scoped to the defect it guards:
  - **SRCH-01:** Vitest unit test on `searchCatalogForAddFlow` in the existing `src/data/catalog.test.ts` (or alongside it if not present) with seeded multi-token catalog rows. Asserts: `"Brut Datejust"` returns the matching row; `"Timex Weekender"` returns the matching row; single-token queries still work; token order does NOT matter (`"Datejust Brut"` returns the same row). Uses the existing test DB infrastructure — no new harness.
  - **SRCH-02:** Extend `src/components/watch/SearchEntry.test.tsx` with RTL + `userEvent` keyboard test. Asserts: typing a multi-character query opens the popup, `userEvent.keyboard('{ArrowDown}')` highlights the first result, repeat moves to second, `{ArrowUp}` moves back, `{Enter}` fires `onPick` with the highlighted result. Separate test asserts `{Escape}` closes the popup. Co-located with the existing 784-line SearchEntry.test.tsx — same jsdom default env, no `// @vitest-environment node` pragma needed (no fs walking; `project_vitest_static_node_env` memory does not apply).
  - **SRCH-03:** Extend `src/components/watch/SearchEntry.test.tsx` with an RTL footer-click test. Asserts: with results > 0 and the popup open, clicking the "Not finding it? Add manually" button mounts `<StructuredEntryPanel>` (assert by its testid or its `initialBrand`/`initialModel` text rendering). One test, single assertion path.

- **D-12 (no new test-runner config):** Existing vitest config + jsdom default + the v8.0 Phase 71 `// @vitest-environment node` pragma discipline for ONLY fs-walking guards is correct as-is. None of the three new tests walk the filesystem.

### Claude's Discretion

- **`searchCatalogForAddFlow` early-return on empty token list** — the existing `qTrimmed.length < SEARCH_ADD_FLOW_TRIM_MIN_LEN` early-return guards the input; an internal `if (tokens.length === 0) return []` is defensive belt-and-suspenders. Planner picks whether to add it explicitly or rely on the upstream guard.
- **Per-token pattern variable naming** — `tokenPatterns: string[]` or inline construction inside the `and(...)` builder. Planner picks for readability.
- **`Combobox.Item` `value` shape fix** — if the base-ui docs research confirms a specific composition fix (e.g., adding `isItemEqual={(a, b) => a.catalogId === b.catalogId}` or switching `value={r.catalogId}` + `itemToStringValue={r => r.catalogId}` and looking up the full result in `onValueChange`), the planner picks the minimal-surface variant. CONTEXT does not pre-bake the answer because the research result determines it.
- **Footer button styling after relocation** — the existing `className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-3 ..."` was tuned for inside-List positioning. After moving outside List, the planner may need to adjust top spacing (`mt-1` was relative to the List padding) — keep the font-semibold guardrail (NOT font-medium per `project_phase_68_complete` memory recurrence).
- **DAL test seed strategy** — the planner picks whether to use the existing catalog seed in `tests/setup-db.ts` or insert ad-hoc rows in `beforeEach`. Whichever fits the existing `catalog.ts` test patterns most naturally.
- **base-ui docs verification command** — planner runs `ls node_modules/@base-ui/react/combobox` + reads the README + any `*.md.d.ts` or example files; suggests `grep -r "isItemEqual\|itemToStringValue\|activeIndex" node_modules/@base-ui/react/combobox` as the first investigation step.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 72: Search Composition Fixes" — goal, success criteria #1-4, depends-on (nothing)
- `.planning/REQUIREMENTS.md` §"Search (3 requirements)" — SRCH-01, SRCH-02, SRCH-03 full text + traceability table
- `.planning/REQUIREMENTS.md` §"Milestone constraints" header — `npm run build` is the gate, no worktrees, per-phase regression test
- `.planning/ROADMAP.md` §"v8.1 Add-Watch Polish" milestone-constraints block at line 221-225 — same constraints, codified
- `.planning/PROJECT.md` §"Current Milestone: v8.1 Add-Watch Polish" — milestone goal, subtraction-of-defects pattern

### Cross-phase coordination (READ BEFORE PLANNING)
- `.planning/milestones/v8.0-phases/69-searchentry-structuredentrypanel-cache-hygiene/69-CONTEXT.md` — Phase 69 D-01 through D-18 lock the SearchEntry architecture this phase fixes WITHIN. D-01 (combobox primitive), D-02 (controlled query / uncontrolled selection), D-04 (250ms debounce + AbortController), D-05 (empty state OUTSIDE popup), D-11 (SearchEntry owns StructuredEntryPanel), D-12 (parseSearchQuery), D-14 (one inline-expand, two entry points) all stay frozen.
- `.planning/milestones/v8.0-phases/69-searchentry-structuredentrypanel-cache-hygiene/69-UAT.md` §Gaps — SRCH-02 + SRCH-03 verbatim defect reports + planner hypotheses (read the hypothesis blocks; D-06 above pre-empts blind acceptance)
- `.planning/milestones/v8.0-phases/70-addwatchflow-state-machine-rewrite-dupe-wiring/70-UAT.md` §Gaps — SRCH-01 verbatim defect report + hypothesis (parseSearchQuery + DAL substring root-cause discussion)
- `.planning/milestones/v8.0-phases/70-addwatchflow-state-machine-rewrite-dupe-wiring/70-CONTEXT.md` (referenced indirectly) — AddWatchFlow consumer contract; SearchEntry's `onPick` / `onSubmitStructured` signatures are FROZEN

### Source files being modified
- `src/data/catalog.ts:519-650` — `searchCatalogForAddFlow` DAL fn; D-02 tokenizes the WHERE; D-04 keeps Drizzle bind discipline; D-12 docstring early-return guard reference
- `src/components/watch/SearchEntry.tsx:207-333` — `<Combobox.Root>` composition; D-07 single-change discipline applies; D-08 footer relocation (lines 321-328 today inside `<Combobox.List>` at 256-329); the existing `cn(...)` / Tailwind class system applies
- `src/components/watch/SearchEntry.test.tsx` (784 lines) — extended with SRCH-02 keyboard test + SRCH-03 footer-click test per D-11; same jsdom default env

### Source files being read (NOT modified)
- `src/lib/searchEntry/parseSearchQuery.ts` — Phase 69 D-12 parser; CORRECT and untouched; the SRCH-01 bug is downstream in the DAL
- `src/lib/searchEntry/parseSearchQuery.test.ts` — Phase 69 D-12 tests; remain green
- `src/components/watch/AddWatchFlow.tsx` — Phase 70 orchestrator; SearchEntry's consumer; consumer contract is FROZEN
- `src/app/actions/search.ts:158` — `searchCatalogForAddFlow` Server Action wrapper; passes `q` through unchanged
- `src/lib/searchTypes.ts` — `SearchCatalogWatchResult` shape; unchanged
- `src/components/search/HighlightedText.tsx` — Phase 16 XSS-safe highlighter; SearchEntry continues to use against `${brand} ${model}` and `reference` — verify continued correctness with the new multi-token result set

### Tests being extended (NOT created from scratch)
- `src/components/watch/SearchEntry.test.tsx` — keyboard + footer-click additions per D-11
- DAL test for `searchCatalogForAddFlow` — planner's discretion on test file (`src/data/catalog.test.ts` if it exists, else co-located) per D-11

### base-ui Combobox references (SRCH-02 research)
- `node_modules/@base-ui/react/combobox/README.md` — required reading per D-06 before touching SearchEntry.tsx composition
- `node_modules/@base-ui/react/combobox/` package CHANGELOG.md and any examples directory — version-specific quirks (1.3.0)
- WAI-ARIA Combobox Pattern (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) — reference for what base-ui provides vs what we provide; SC-minimum scope per D-05 means we verify Up/Down/Enter/Tab/Escape behavior matches the spec

### Memories that constrain this phase
- `project_baseline_not_green_build_is_gate` — `npm run build` is the only gate; do not chase pre-existing `tsc --noEmit` test-file errors or the pre-existing `CommentGateLocked font-medium` vitest failure as part of this phase's verification
- `project_vitest_static_node_env` — `// @vitest-environment node` pragma applies ONLY to fs-walking guards; D-11 tests are RTL + DAL behavioral, jsdom default is correct
- `feedback_execute_phase_no_worktree_when_db` — `workflow.use_worktrees = false` permanently; DAL test reads `.env.local` for DATABASE_URL
- `project_local_catalog_natural_key_drift` — D-02 ILIKE patterns operate on the `*_normalized` columns; trust the existing normalization layer (regexp_replace(lower(trim(...)), ...)) rather than re-normalizing in TS
- `project_phase_68_complete` — font-semibold guardrail recurrence; D-08 footer relocation must NOT regress to font-medium during the className adjustment
- `feedback_mobile_ui_verify_on_prod` — Phase 72 fixes ship in the v8.1 bundle; UAT walk on prod per the v8.0 / v7.0 pattern
- `feedback_ppr_cache_fill_no_longer_call_out` — do NOT bake PPR / #419 / cache-fill into the UAT script for this phase; the SearchEntry surface is not PPR-coupled
- `db_wipeable_2026_05_09` — `watches_catalog` is NOT wipeable; D-02 explicitly avoids any schema change; tsvector deferral reasoning anchors here

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`searchCatalogForAddFlow` DAL function** (`src/data/catalog.ts:542-650`) — the only thing modified for SRCH-01. Existing `qTrimmed.length < SEARCH_ADD_FLOW_TRIM_MIN_LEN` early-return at line 552 protects the new tokenization path from empty/too-short queries. Existing `queryNormalized` (alphanumeric-stripped) at line 556 and the `exactRefOrderTier` at lines 562-565 stay intact — both are reference-column concerns that the multi-token fix doesn't touch.
- **Drizzle `and(...)` + `or(...)` builders** — already imported in `src/data/catalog.ts`; D-02 composes `and(...tokenPatterns.map(t => or(ilike(brand_n, t), ilike(model_n, t), ilike(reference_n, t))))` using the same primitives.
- **`<Combobox.Root>` + slots** (`@base-ui/react/combobox` 1.3.0) — primitive stays; D-08 just relocates the footer sibling within the existing slot tree. Slot list: `Root, Trigger, Input, Portal, Positioner, Popup, List, Item, Status, Empty, Clear`.
- **`useCatalogSearchCache` hook** (Phase 69 D-06) — not touched; SearchEntry's network call uses it transparently. The new multi-token DAL behavior changes the result set; cache key `cacheKey = debouncedQuery.trim().toLowerCase()` already keys on the full query string, so cached results stay consistent with new behavior automatically (entries from before the fix get evicted naturally on next user-id mismatch or simply outlive their relevance).
- **`parseSearchQuery` parser** (`src/lib/searchEntry/parseSearchQuery.ts`) — untouched. Already produces correct `brand` + `model` + `reference` from "Brut Datejust" etc.; the parser is for the StructuredEntryPanel pre-seed, NOT for the DAL search path.
- **`SearchEntry.test.tsx` infrastructure** (784 lines, jsdom + RTL + userEvent + searchCatalogForAddFlow mock) — D-11 keyboard + footer-click tests bolt onto the existing setup.

### Established Patterns
- **Drizzle parameterized binds via sql template literals** — `searchCatalogForAddFlow` already follows this throughout (T-67-02-01 mitigation in the docstring); D-04 mandates continuation for every per-token pattern.
- **Pure-presenter SearchEntry / props-in-callbacks-out** (Phase 68 + Phase 69 precedent) — D-07 / D-08 / D-09 preserve. No new props added. No internal navigation. `onPick` / `onSubmitStructured` / `onSwitchToUrl` shapes are FROZEN.
- **`if (controller.signal.aborted) return` stale-result guard** (Phase 69 D-04 mirroring `useSearchState.ts:228-253`) — untouched; the DAL change does not affect the client-side debounce / cancellation path.
- **`Combobox.Popup` slot composition** — D-08 reads from the existing slot tree (`Combobox.Portal → Combobox.Positioner → Combobox.Popup → [Combobox.List, footer-as-sibling]`); the relocation is local to this slot.
- **Co-located component test files** (`SearchEntry.tsx` + `SearchEntry.test.tsx` in `src/components/watch/`) — D-11 keyboard + footer tests follow.
- **font-semibold over font-medium for primary text** (`WatchSearchRow.tsx:48` + `project_phase_68_complete` memory) — preserved through D-08 footer className adjustment.

### Integration Points
- **`/api/extract-watch` + StructuredEntryPanel** — unchanged. The SRCH-03 fix only affects whether the panel mounts on footer click; once mounted, the panel's contract (`onSubmitStructured`, `onSwitchToUrl`) is identical.
- **`/watch/new/page.tsx` SSR prop passing** — unchanged. `viewerUserId` and `catalogBrands` still prop-drilled to AddWatchFlow → SearchEntry.
- **Phase 70 `AddWatchFlow.handleSearchPick`** — consumer of `onPick(result)`. The DAL fix changes WHICH results land; the consumer contract is identical. SC#1 / SC#2 / SC#3 verify end-to-end through this consumer on prod UAT.
- **`/search` page DAL `searchCatalogWatches`** — separate function in `catalog.ts`; uses the same ILIKE single-substring pattern as today's `searchCatalogForAddFlow`. Phase 72 explicitly does NOT touch it (out of scope; capture as deferred — `/search` page multi-token behavior may be a follow-up if the user reports the same symptom there).

</code_context>

<specifics>
## Specific Ideas

- **User's specific failing examples (from 70-UAT.md SRCH-01 gap):** `"Brut Datejust"` and `"Timex Weekender"` must return the matching catalog row. Pin these as test cases verbatim in the SRCH-01 DAL test per D-11 — the regression test should fail with the OLD DAL and pass with the new tokenized DAL.
- **Token-order invariance:** `"Datejust Brut"` should return the same row as `"Brut Datejust"`. AND-of-ORs naturally satisfies this (the ORDER of AND clauses is irrelevant). Add as a third test case in the SRCH-01 DAL test.
- **Footer click is explicitly a CLICK affordance** (SC#3 verbatim: "Clicking the 'Not finding it? Add manually' footer row"). Keyboard arrow-nav reaching the footer is out of scope per D-10 — pin in the test that Tab from input can reach the footer (focus order), but arrow keys traverse Combobox.Item only.
- **Keyboard scope is SC#2 + SC#4 verbatim** — Up/Down/Enter (SC#2) + clean Tab/Escape exit (SC#4). Nothing else gets tests. Whatever base-ui ships for free above this is welcome but unverified.
- **base-ui docs research is the FIRST plan task for SRCH-02** — not a research-agent task, an inline planner step. The composition LOOKS correct; the fix is "what's the missing prop / wrong prop / version-quirk". One read, one targeted change.

</specifics>

<deferred>
## Deferred Ideas

- **Catalog row cleanup sweep** — the `"TIMEX Weekender 38mm Fabric Strap Watch"` and similar noisy rows from v8.0 prod catalog. D-01 deferred to a future catalog-hygiene phase. Candidate home: SEED-009 Catalog Expansion when it leaves dormant state, OR a small v8.2 polish phase if user feedback escalates. Note the `db_wipeable_2026_05_09` constraint (catalog NOT wipeable; in-place ALTER+UPDATE per-row updates required).
- **Postgres tsvector + GIN migration for catalog search** — the right architecture when (a) catalog size justifies GIN over ILIKE LIKE-prefix index efficiency, (b) UX maturity wants `ts_rank` ranking + stemming, (c) SEED-009 Catalog Expansion lands. Two DALs to migrate together (`searchCatalogForAddFlow` + `searchCatalogWatches`); migration touches both DBs per the prod-push gotchas in `project_drizzle_supabase_db_mismatch`. Document this in the SEED-009 spec when it activates.
- **`/search` page DAL multi-token parity** — `searchCatalogWatches` has the same ILIKE single-substring shape as today's `searchCatalogForAddFlow`. If user UAT surfaces the same multi-token symptom on `/search`, fold into a future phase. Not in scope for Phase 72 (explicitly per REQUIREMENTS.md §Out of Scope and the v8.1 subtraction-of-defects pattern).
- **SRCH-02 full WAI-ARIA combobox contract** — Home/End/PageUp/PageDown + typeahead first-letter coverage. Whatever base-ui provides for free stays for free; future polish if a user reports the gap. NOT a tested guarantee in this phase.
- **SRCH-03 keyboard-nav reach for the footer** — Tab from input works (focus order). Making the footer keyboard-navigable via arrow keys would require the Combobox.Item sentinel approach (rejected in D-08 to keep types narrow). Revisit if a keyboard-first user surfaces the gap.
- **Shared search-tokenizer helper** — if a future phase also tokenizes search input in another DAL, extract a `tokenizeSearchQuery(q: string): string[]` helper from D-03's whitespace-split. Premature now (one consumer in this phase; `searchCatalogWatches` would be the natural second).
- **`useTypeaheadSearch(query, action)` shared hook** (carried forward from Phase 69 deferred) — still deferred; this phase does not touch the debounce/cancellation layer.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 72 scope.

</deferred>

---

*Phase: 72-search-composition-fixes*
*Context gathered: 2026-05-30*

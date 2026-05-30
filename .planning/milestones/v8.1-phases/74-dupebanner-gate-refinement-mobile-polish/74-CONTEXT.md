# Phase 74: DupeBanner Gate Refinement + Mobile Polish - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the last 2 v8.1 polish defects from the v8.0 prod UAT walk. Two unrelated fixes bundled because they're both small subtraction-of-defects items against shipped v8.0 code:

1. **DUPE-04 — DupeBanner gate copy.** When DupeBanner is mounted on the confirm screen (`state.dupeContext != null`), the ConfirmStep primary CTA currently renders `<Loader2 spinning/> Saving...` (gated via `pending={state.pending || state.dupeContext != null}` from Phase 70 gap plan 08, `AddWatchFlow.tsx:694`, propagating to `ConfirmStep.tsx:317-321`). The "Saving..." copy on a non-saving button is what the user reported as broken. Fix = **hide the primary CTA entirely** while the banner is active. The banner IS the choice surface; the redundant gated CTA is noise.

2. **MOB-01 — iOS Safari input auto-zoom.** Tapping any input/textarea/select with computed `font-size < 16px` on iOS Safari triggers auto-zoom. Several components ship raw `<input>` / `<textarea>` with `text-sm` (14px) overrides (comment composer + edit, SearchEntry combobox input). Fix = global `@layer base` CSS rule setting the floor for native elements, **plus** rewrite explicit `text-sm` overrides on input/textarea/select to `text-base md:text-sm` (16px mobile, 14px desktop). MUST NOT use `maximum-scale=1` / `user-scalable=no` on the viewport meta (accessibility regression — the current `src/app/layout.tsx:29` viewport export already does NOT set them; keep it that way).

**Constraints inherited from v8.1 milestone scope:**
- Pure subtraction-of-defects against shipped v8.0 code — no new features (REQUIREMENTS.md §Pattern).
- `npm run build` (exit 0) is the gate. NOT `tsc --noEmit` (pre-existing test-file errors) and NOT `vitest run` (pre-existing CommentGateLocked font-medium failure) — these are baseline noise per `project_baseline_not_green_build_is_gate` memory.
- `workflow.use_worktrees = false` permanently (build-gated project; `.env.local` unavailable in worktrees per `feedback_execute_phase_no_worktree_when_db` memory).
- Each phase ships its own targeted regression test alongside the fix.
- **Last phase of v8.1.** Bundle the prod push with Phase 72 SRCH-03 follow-up + Phase 73 ROUTE-01 — one deploy, one UAT walk (per `feedback_mobile_ui_verify_on_prod`).

**Not this phase:**
- SRCH-01 / SRCH-02 / SRCH-03 — Phase 72 (shipped)
- ROUTE-01 — Phase 73 (shipped, awaits prod UAT)
- Phase 70's `AddWatchFlow` state machine, ConfirmStep prop contract (Phase 68 D-03 LOCKED), DupeBanner copy / structure (Phase 70 D-11 LOCKED) — touched ONLY at the new prop surface (additive `bannerActive?` on ConfirmStep)
- shadcn Input / Textarea primitives — already use `text-base md:text-sm` correctly; NOT modified
- Audit + rewrite of admin-only `text-sm` overrides (`ListEditorClient.tsx`, etc.) — out of scope; admin tooling, not user-facing mobile path
- Comment composer / comment edit refactor onto shadcn Textarea primitive — refactor scope; deferred
- New CTA copy strings beyond what hide-the-CTA needs — DUPE-04 success criterion 1 explicitly allows "hidden entirely" as a valid resolution

</domain>

<decisions>
## Implementation Decisions

### DUPE-04 — ConfirmStep CTA treatment when DupeBanner is mounted

- **D-01 (CTA treatment — hide entirely):** When DupeBanner is mounted (`state.dupeContext != null`), the ConfirmStep primary CTA is **NOT rendered at all** — no "Saving..." copy, no "Use the banner above" copy, no disabled button stub. The DupeBanner is the choice surface; the redundant CTA is noise. Rationale: minimum-surface diff, no label-thrashing during pending↔banner-gated transitions, no copy-string proliferation, ARIA-clean (no disabled button under the banner). Aligns with ROADMAP success criterion 1's "hidden entirely" branch (operator's preferred clarity option per the verifier's 70-VERIFICATION.md WR-01 note). Rejected: distinct copy ("Use the banner above") — requires new string, copy-translation surface, and STILL leaves a visually weight-bearing button that users can keyboard-Tab to. Rejected: disable + helper text — duplicates the banner's purpose; more visual noise.

- **D-02 (prop surface — additive `bannerActive?: boolean` on ConfirmStep):** Add a new optional prop `bannerActive?: boolean` to ConfirmStep (default `false` for backward compat). Phase 68 D-03 contract explicitly allows ADDITIVE prop extensions (Phase 70 has added several already). Wire from `AddWatchFlow.tsx:694`:
  ```tsx
  pending={state.pending}                      // REVERT to original pending semantics
  bannerActive={state.dupeContext != null}     // NEW — banner gate signal
  ```
  Inside ConfirmStep, **Section 6 (primary CTA at lines 311-325) early-returns null when `bannerActive=true`**. All other sections (cover photo, reference/year inputs, status picker, price input, ghost row "Edit details" / "Start over") stay rendered and functional. Rationale: keeps the gating decision colocated with the gated element; cleanly separates `pending` (real async work) from `bannerActive` (banner gate); reverting the OR-combined pending restores Phase 68 D-03 pending-semantic purity. Rejected: conditional `{!state.dupeContext && <ConfirmStep ...>}` in AddWatchFlow.tsx — mounts/unmounts the entire form on dupe-context toggle, losing user-entered values in price/reference/year/status; ConfirmStep is a controlled component but its INPUTS keep their controlled values only as long as the orchestrator's local state persists, which it does, but unmounting still flickers focus and resets `groupRef` radiogroup focus state (recurrence-3 of the WAI-ARIA pattern from `project_phase_68_complete`). Rejected: change `pending` semantics — Phase 68 D-03 explicitly locks `pending` as "real async work in progress."

- **D-03 (ghost row stays enabled while bannerActive):** "Edit details" and "Start over" remain clickable while the banner is mounted. They give the user an escape that bypasses the dupe decision entirely (route to WatchForm for finer editing, or restart the add flow). Price/reference/year inputs stay editable too — user might want to set a target price before clicking the banner's "Add another copy". Only the primary CTA hides. Rationale: minimum-disruption gating; the ghost buttons solve different problems than the banner. Implementation note: this means `disabled={pending}` on ghost buttons (`ConfirmStep.tsx:294,303`) is unchanged — pending is reverted to original semantics, so when there's no real async work, ghost buttons are enabled regardless of bannerActive.

- **D-04 (test update strategy — disappearance-asserting pivot):** The 3 existing Phase 70 gap-plan-08 WR-01 tests in `AddWatchFlow.test.tsx` (Tests A/B/C at lines 749-805) currently assert `expect(getByRole('button', { name: 'Add to Wishlist' })).toBeDisabled()` (Test A) / similar `toBeDisabled` (Test B) / "Add another copy clears + CTA re-enables" (Test C). Updates:
  - **WR-01 Test A:** `toBeDisabled()` → `expect(screen.queryByRole('button', { name: 'Add to Wishlist' })).not.toBeInTheDocument()`. The CTA must NOT be rendered when wishlist dupeContext is set. Pair with `expect(screen.getByTestId('dupe-banner-wishlist')).toBeInTheDocument()` (banner appears — the alternative surface). Triple-assertion per `feedback_test_assert_disappearance_too` recurrence-3 (banner appears + CTA disappears + click does nothing — same disappearance pattern as Phase 73 Plan 01).
  - **WR-01 Test B (Phase 73 ROUTE-01 pivot):** `toBeDisabled()` → `not.toBeInTheDocument()` for the owned/structured-submit case. Pair with `expect(screen.getByTestId('dupe-banner-owned')).toBeInTheDocument()`.
  - **WR-01 Test C:** "Add another copy clears dupeContext → CTA re-enables" — assertion logic updated to `expect(screen.queryByRole('button', { name: 'Add to Wishlist' })).not.toBeInTheDocument()` BEFORE clicking "Add another copy", then `expect(screen.getByRole('button', { name: 'Add to Wishlist' })).toBeInTheDocument()` AFTER clicking. Round-trip the appearance/disappearance.
  - **New test (WR-01 Test D — DUPE-04 specific):** when bannerActive=true, clicking ANYWHERE in the ConfirmStep region (e.g., trying to keyboard-Tab to a non-existent CTA) does NOT fire `addWatch`. Soft guarantee — the test just confirms the absence by attempting a click-through; absence of the button makes it impossible by construction.

- **D-05 (no ConfirmStep visual / DOM order change):** The early-return null for Section 6 only removes the button from DOM. No height-collapsing animation, no placeholder spacer, no aria-live announcement when the banner mounts (the banner itself is the announcement). Rationale: minimum-surface diff, no animation timing complexity, no a11y surprise.

### MOB-01 — global font-size floor for native inputs

- **D-06 (global `@layer base` rule — the floor):** Add to `src/app/globals.css` inside `@layer base`:
  ```css
  @layer base {
    input,
    textarea,
    select {
      font-size: 1rem; /* 16px — prevents iOS Safari auto-zoom on focus */
    }
  }
  ```
  Catches raw native elements without a Tailwind override (a defense-in-depth floor). Specificity `0,0,1` — beaten by ANY utility class (specificity `0,1,0`), which is correct: components that explicitly want a different size CAN still set it, but DOM-default native elements get the safe 16px floor. Rationale per Tailwind 4 philosophy: utilities WIN over base; don't `!important` the rule.

- **D-07 (override audit + rewrite — 3 user-facing files):** Rewrite the explicit `text-sm` overrides on user-facing input/textarea/select to the responsive `text-base md:text-sm` pattern (16px mobile, 14px desktop — matches shadcn Input + Textarea primitives' built-in pattern). Known offenders confirmed via grep:
  - `src/components/comment/CommentCompose.tsx:60` — raw `<textarea className="... text-sm ..."`. Replace `text-sm` with `text-base md:text-sm`.
  - `src/components/comment/CommentItem.tsx:170` — raw `<textarea className="... text-sm ..."` (edit-comment textarea). Same replacement.
  - `src/components/watch/SearchEntry.tsx:242` — `Combobox.Input` (base-ui primitive renders `<input>`) with `className="... text-sm ..."`. Same replacement. NOTE: the SearchEntry input is part of the Phase 72-just-shipped Combobox composition; D-07 only touches the className string, NOT the composition (Phase 72 D-05/D-06/D-07/D-08 locks remain intact).
  - **Admin-only files** (`src/components/admin/ListEditorClient.tsx:588`, `src/components/admin/CmsCoverUploader.tsx`, `src/components/admin/MarkdownEditor.tsx` — markdown DIV not an input but verify the grep hits) are explicitly OUT of scope. Admin tooling is not part of the user-facing mobile path; including them widens the phase. If MOB-01 recurs on admin pages a future polish handles it.
  - **shadcn primitives** (`src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`) — already use `text-base md:text-sm`. UNTOUCHED.

- **D-08 (no viewport meta change):** `src/app/layout.tsx:29` viewport export is `{ viewportFit: 'cover' }`. It does NOT set `maximumScale` or `userScalable` and MUST stay that way. ROADMAP success criterion 3 explicitly forbids `maximum-scale=1` (pinch-zoom must still work). Static guard verifies this (D-10).

- **D-09 (pinch-zoom verification = prod UAT only):** No automated test for pinch-zoom; it's a Safari runtime behavior. Verified manually on iPhone Safari during the bundled v8.1 prod UAT walk: (a) tap a comment textarea → no auto-zoom; (b) two-finger pinch-zoom on the page → still works.

### Regression tests

- **D-10 (DUPE-04 test):** Extend the existing Phase 70 gap-plan-08 WR-01 describe block in `src/components/watch/AddWatchFlow.test.tsx` (currently at lines 723-805). Update WR-01 Tests A/B/C per D-04. Add WR-01 Test D per D-04. No new test file. Same jsdom default env; no `@vitest-environment node` pragma (no fs walking; `project_vitest_static_node_env` does not apply).

- **D-11 (MOB-01 static guard — viewport meta):** Add `tests/static/no-iOS-zoom-viewport.test.ts` with `// @vitest-environment node` pragma. Asserts the parsed `src/app/layout.tsx` `viewport` export does NOT contain `maximumScale`, `userScalable`, or `minimumScale` keys. Uses `fs.readFileSync` + regex (no AST parser needed — string match on the viewport object body is sufficient). Fires CI tripwire if a future change tries to add `maximum-scale=1` as an "easy fix" for auto-zoom.

- **D-12 (MOB-01 static guard — text-sm-on-native-elements audit, defensive):** Add `tests/static/no-text-sm-on-native-form-controls.test.ts` with `// @vitest-environment node` pragma. Walks `src/components/comment/` and `src/components/watch/SearchEntry.tsx` (the known-fixed surfaces), regex-asserts no `<(textarea|input|select)[^>]*className=[^>]*\btext-sm\b` (i.e., no naked `text-sm` on a native form control in those files). Token must be `text-base md:text-sm` or some other 16px-mobile variant. Scope LIMITED to those three files — full-app audit is out of scope (admin-only files allowed to keep text-sm per D-07). Catches a regression where someone reverts the className.

- **D-13 (no MOB-01 unit test on computed font-size):** jsdom doesn't compute real CSS font-size from a Tailwind class without a full Tailwind compilation in the test harness, which is overkill. The static guard (D-12) + prod UAT walk (D-09) is the right verification mix.

- **D-14 (test-runner config unchanged):** Existing vitest config + jsdom default + the v8.0 Phase 71 `// @vitest-environment node` pragma discipline (for fs-walking guards only) is correct as-is. D-11 + D-12 both walk the filesystem and DO use the pragma.

### Bundled deploy

- **D-15 (bundle with Phase 72 SRCH-03 follow-up + Phase 73 ROUTE-01):** Single prod push for v8.1 end-to-end. Order: Phase 72 already merged (Plan 01+02 + 260530-e55 quick task), Phase 73 already merged (Plan 01), Phase 74 lands on top, then one `git push origin main` → Vercel preview → prod promote → one UAT walk on horlo.app covering: (a) SRCH-01 multi-token match, (b) SRCH-02 keyboard nav, (c) SRCH-03 footer click, (d) ROUTE-01 owned redirect from search, (e) DUPE-04 CTA hidden under banner, (f) MOB-01 no auto-zoom on iOS Safari + pinch-zoom still works. Per `feedback_mobile_ui_verify_on_prod` — local dev/jsdom cannot verify (e)/(f) authentically. Per `feedback_ppr_cache_fill_no_longer_call_out` — do NOT layer cache-fill or #419 checks into this UAT script.

### Claude's Discretion

- **`bannerActive` prop placement in the ConfirmStep interface** — append after `pending?` (lines 92-93 in current `ConfirmStep.tsx`) to keep related gate flags adjacent. Planner picks exact source-order.
- **Exact CSS comment wording in globals.css D-06** — "prevents iOS Safari auto-zoom on focus" or similar concise rationale. Planner picks.
- **CommentCompose / CommentItem className readability** — `text-base md:text-sm` insertion site (replace the `text-sm` token in-place vs. group with sibling text utilities). Planner picks for line-length.
- **WR-01 Test D phrasing** — pure-absence assertion vs. attempt-and-confirm-nothing-fires. Planner picks; both close the SC#1 verification correctly.
- **Static guard regex strictness** — D-12 regex for `text-sm` on native form controls. Planner picks: simple `/className=[^>]*text-sm/` per-element or a token-precise pattern. Whichever stays correct after Prettier reformats.
- **Whether to consolidate D-11 + D-12 into a single static guard file** — separate concerns favors two files; volume-of-tests favors one. Planner picks; both files OR both-in-one is fine.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 74: DupeBanner Gate Refinement + Mobile Polish" (lines 255-265) — goal, success criteria #1-4, depends-on (nothing)
- `.planning/REQUIREMENTS.md` §"DUPE-04" + §"MOB-01" + §"Out of Scope" — full requirement text + scope guardrails
- `.planning/ROADMAP.md` §"v8.1 Add-Watch Polish" milestone-constraints block (lines 221-225) — build-is-the-gate; no worktrees; per-phase regression test
- `.planning/PROJECT.md` §"Current Milestone: v8.1 Add-Watch Polish" — subtraction-of-defects pattern

### Cross-phase coordination (READ BEFORE PLANNING)
- `.planning/milestones/v8.0-phases/68-confirmstep-component/68-CONTEXT.md` — Phase 68 D-03 LOCKED ConfirmStep prop contract. Additive props allowed; renames/breakage forbidden. The `bannerActive?` addition aligns with the existing additive-extension pattern.
- `.planning/milestones/v8.0-phases/70-addwatchflow-state-machine-rewrite-dupe-wiring/70-CONTEXT.md` — Phase 70 D-11 DupeBanner sibling pattern. UNCHANGED. Banner is a sibling above ConfirmStep when `state.dupeContext != null`.
- `.planning/milestones/v8.0-phases/70-addwatchflow-state-machine-rewrite-dupe-wiring/70-UAT.md` §Gaps — DUPE-04 + MOB-01 verbatim user reports + planner hypotheses (read these — they're the source of truth for what the user actually saw on prod).
- `.planning/milestones/v8.0-phases/70-addwatchflow-state-machine-rewrite-dupe-wiring/70-VERIFICATION.md` §WR-01 — verifier's note on the "alternative fix" (hide CTA entirely vs distinct copy). D-01 picks "hide entirely."
- `.planning/phases/72-search-composition-fixes/72-CONTEXT.md` §SRCH-03 — Phase 72 D-08/D-09/D-10 footer-relocation. SearchEntry composition is LOCKED. D-07 above touches ONLY the className string at `SearchEntry.tsx:242` (Combobox.Input), NOT the composition slots.
- `.planning/phases/73-owned-redirect-route-fix/73-CONTEXT.md` — Phase 73 ships in the same v8.1 bundle. No code overlap with Phase 74. Mentioned only for deploy bundling (D-15).

### Source files being modified
- `src/components/watch/ConfirmStep.tsx:55-98` (props interface) — D-02 adds `bannerActive?: boolean`
- `src/components/watch/ConfirmStep.tsx:311-325` (Section 6 primary CTA) — D-02 + D-01 early-return null when `bannerActive=true`
- `src/components/watch/AddWatchFlow.tsx:694` — D-02 revert `pending={state.pending || state.dupeContext != null}` → `pending={state.pending}` + `bannerActive={state.dupeContext != null}`
- `src/components/watch/AddWatchFlow.test.tsx:723-805` (Phase 70 gap-plan-08 WR-01 describe block) — D-04 + D-10 update 3 existing tests + add WR-01 Test D
- `src/app/globals.css` (add `@layer base` block) — D-06 global font-size floor for input/textarea/select
- `src/components/comment/CommentCompose.tsx:60` — D-07 className rewrite `text-sm` → `text-base md:text-sm`
- `src/components/comment/CommentItem.tsx:170` — D-07 className rewrite `text-sm` → `text-base md:text-sm`
- `src/components/watch/SearchEntry.tsx:242` — D-07 className rewrite `text-sm` → `text-base md:text-sm`

### Files created by this phase
- `tests/static/no-iOS-zoom-viewport.test.ts` — D-11 viewport meta static guard
- `tests/static/no-text-sm-on-native-form-controls.test.ts` — D-12 className regression guard (OR consolidated with D-11; planner's discretion)

### Files read but NOT modified
- `src/app/layout.tsx:29` (viewport export) — confirms `{ viewportFit: 'cover' }`, no maximumScale/userScalable; D-08
- `src/components/ui/input.tsx` — shadcn Input primitive, already uses `text-base md:text-sm`; UNTOUCHED
- `src/components/ui/textarea.tsx` — shadcn Textarea primitive, already uses `text-base md:text-sm`; UNTOUCHED
- `src/components/watch/DupeBanner.tsx` — Phase 70 D-11 LOCKED; the banner itself is unchanged; only ConfirmStep's behavior beneath it changes
- `src/components/admin/*` — out-of-scope `text-sm` overrides; intentionally NOT modified

### Memories that constrain this phase
- `project_phase_68_complete` — ConfirmStep prop contract Phase 68 D-03 LOCKED (additive OK). Also: font-medium guardrail recurrence — D-07 className rewrites must use `font-semibold` or untouched font weights; NO `font-medium` introductions.
- `feedback_test_assert_disappearance_too` (recurrence-3) — D-04 pairs CTA-disappears with banner-appears. Already shipped twice in v8.1; D-04 extends the pattern.
- `project_phase_complete_999_1_misset` (recurrence-5 cohort) — after `gsd-sdk query phase.complete 74` hand-correct STATE.md `next_phase` + `progress` fields. Expected at milestone close (74 = last v8.1 phase).
- `project_baseline_not_green_build_is_gate` — `npm run build` is the only gate; ignore pre-existing `tsc --noEmit` test-file errors and the `CommentGateLocked font-medium` vitest failure during D-10 / D-11 / D-12 verification.
- `project_vitest_static_node_env` — D-11 + D-12 walk the filesystem → REQUIRE `// @vitest-environment node` pragma. Without it, vitest runs jsdom → `fs.readdirSync` undefined → static guard silently passes on Vercel prebuild → false-negative regression. Phase 71 already retrofitted 8 other guards with the pragma; D-11 + D-12 follow.
- `feedback_execute_phase_no_worktree_when_db` — `workflow.use_worktrees = false` permanently.
- `feedback_mobile_ui_verify_on_prod` — D-09 + D-15 prod UAT walk on iPhone Safari is the authoritative MOB-01 verification.
- `feedback_ppr_cache_fill_no_longer_call_out` — do NOT bake PPR / #419 / cache-fill checks into the UAT script for this phase.
- `feedback_decision_coverage_gate_citations` — cite D-NN identifiers in `truths` and `must_haves` blocks during planning so the decision-coverage gate finds them; don't bury them in XML prose.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ConfirmStep prop interface** (`src/components/watch/ConfirmStep.tsx:55-98`) — already accepts optional `pending?`. Adding `bannerActive?` follows the same shape; one-line addition, default `false`.
- **ConfirmStep Section 6 primary CTA** (`src/components/watch/ConfirmStep.tsx:311-325`) — single contiguous `<Button>` block; D-01 wraps in `if (!bannerActive)` early-return for that section.
- **DupeBanner sibling slot** (`src/components/watch/AddWatchFlow.tsx:660-672`) — already conditionally rendered when `state.dupeContext`. ConfirmStep at line 673 stays as a sibling; only the CTA-rendering-inside-it changes.
- **Phase 70 gap-plan-08 WR-01 test scaffolding** (`src/components/watch/AddWatchFlow.test.tsx:723-805`) — describe block already mocks DupeBanner with `data-testid="dupe-banner-{owned|wishlist}"` (lines 210-216). The disappearance-pair assertions in D-04 use these testids directly.
- **`tests/static/` static guard scaffolding** (8 existing `// @vitest-environment node` files post Phase 71) — established pattern; D-11 + D-12 follow the same template.
- **shadcn Input + Textarea primitives** — already use `text-base md:text-sm`; the reference pattern D-07 rewrites the offenders to match.

### Established Patterns
- **Additive ConfirmStep props** (Phase 68 D-03 + Phase 70 D-17 added optional spec props `movement` / `caseSizeMm` / `dialColor`) — D-02 `bannerActive?` follows.
- **Phase 70 D-11 DupeBanner sibling-above-ConfirmStep** — UNCHANGED. The banner stays a sibling; D-01 only changes what ConfirmStep renders beneath it.
- **`text-base md:text-sm` responsive typography on form controls** (`src/components/ui/input.tsx:12`, `src/components/ui/textarea.tsx:10`) — D-07 propagates this pattern to the 3 raw-element offenders.
- **Disappearance-paired assertion** (`feedback_test_assert_disappearance_too`, recurrence-3 in this phase) — D-04 asserts BOTH banner-appears AND CTA-disappears in jsdom; pair `getByX.toBeInTheDocument()` with `queryByY.not.toBeInTheDocument()`.
- **Static guard `@vitest-environment node` pragma** (Phase 71 retrofit) — D-11 + D-12 declare it at the top of each new test file.
- **font-semibold > font-medium guardrail** (recurrence-5 across Phases 65/68/69/70/72) — D-07 className rewrites must not introduce `font-medium`.

### Integration Points
- **`/api/extract-watch` + DupeBanner + ConfirmStep wiring** — unchanged. D-01 + D-02 are surgical at the rendering layer.
- **Phase 70 `handleConfirmPrimary` / `handleAddAnotherCopy` / `handleViewExisting` / `handleMoveToCollection` action handlers** — unchanged. They fire from DupeBanner buttons (orchestrator-owned) or from the now-conditional ConfirmStep CTA.
- **Comment composer + comment edit on raw `<textarea>`** — D-07 touches the className string only. The composer state machine (`useState` + `onChange` + submit handler) is untouched. Phase 53/57 contracts intact.
- **SearchEntry Combobox.Input className** — D-07 touches the className string only. Phase 72 composition + base-ui Combobox primitive contracts intact.

</code_context>

<specifics>
## Specific Ideas

- **User's specific DUPE-04 report (from 70-UAT.md):** the "Saving..." button under the DupeBanner. Hiding the CTA entirely is the cleanest resolution per ROADMAP SC#1 and verifier's WR-01 alternative-fix note.
- **User's specific MOB-01 report (from 70-UAT.md):** iOS Safari auto-zoom on input focus. Confirmed on multiple input surfaces (search, comment composer, etc.) by code grep finding `text-sm` on raw `<textarea>` and Combobox.Input.
- **REQUIREMENTS.md verbatim guidance:** "the fix is a global CSS rule on `input, textarea, select` ensuring font-size ≥ 16px. Verify that intentional zoom (pinch-zoom) still works for users who need it; do NOT use `maximum-scale=1` on the viewport meta as a workaround (accessibility regression)." → D-06 + D-08 + D-09.
- **Triple-assertion disappearance pattern** (Phase 73 Plan 01 + Phase 72 SRCH-03b): banner appears AND CTA disappears AND click does nothing. D-04 carries forward in WR-01 Tests A/B for DUPE-04.
- **Bundled prod push** (Phase 72 SRCH-03 follow-up + Phase 73 ROUTE-01 + Phase 74) — single deploy, single UAT walk per `feedback_mobile_ui_verify_on_prod` operator preference.

</specifics>

<deferred>
## Deferred Ideas

- **Admin-tool input audit for MOB-01** — `ListEditorClient.tsx:588`, `CmsCoverUploader.tsx`, and other admin-only files have `text-sm` on raw inputs. Out of scope for v8.1 user-facing polish. Pick up in a future admin-tooling phase OR a follow-up MOB-02 if a admin user reports the symptom on iPad.
- **CommentCompose + CommentItem refactor onto shadcn Textarea primitive** — would eliminate the className-drift class of bugs entirely (centralize the responsive typography). Out of scope for v8.1 (refactor, not defect-fix). Candidate for a future "comment surface consolidation" polish phase.
- **`text-base md:text-sm` enforcement via ESLint rule** — a custom ESLint rule rejecting `text-sm` on native form controls would prevent regression at lint-time, more robustly than the D-12 static guard. Out of scope; ESLint config in this project is minimal. Revisit if MOB-01 recurs.
- **CTA copy variant for DUPE-04** — "Use the banner above" or similar distinct-copy approach. Rejected (D-01) in favor of hiding entirely. If hide-entirely tests as confusing on the bundled prod UAT walk, the planner can pivot back to distinct copy; the additive `bannerActive` prop accommodates either branch.
- **Aria-live announcement when DupeBanner mounts** — D-05 says no. If a future accessibility audit flags the silent mount as a problem, add an aria-live region; not in this phase.
- **Computed font-size unit test for MOB-01** — D-13 rejects. If a future testing-infrastructure phase adds a real Tailwind compilation step to vitest, the test becomes feasible. Not in this phase.
- **Pinch-zoom automated test** — Safari runtime behavior; no jsdom path. D-09 manual prod UAT is the right verification. Revisit if a future visual-regression harness (Percy/Chromatic) ever lands.
- **Migrate `viewport` export to use Next.js 16 `Viewport` metadata best practices beyond `{ viewportFit: 'cover' }`** — out of scope; current export is correct per `node_modules/next/dist/docs/`. Static guard (D-11) just defends the explicit anti-properties.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 74 scope (`gsd-sdk query todo.match-phase 74` returned 0 matches).

</deferred>

---

*Phase: 74-dupebanner-gate-refinement-mobile-polish*
*Context gathered: 2026-05-30*

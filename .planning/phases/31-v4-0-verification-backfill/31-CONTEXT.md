# Phase 31: v4.0 Verification Backfill - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Reconstruct the two missing phase-level VERIFICATION.md artifacts (Phase 23: Settings Sections + Schema-Field UI; Phase 24: Notification Stub Cleanup + Test Fixture & Carryover) by running goal-backward audits of what shipped in v4.0, then record closure of the v4.0 milestone audit's verification asymmetry.

This is a documentation/audit phase. No production code changes. The deliverable is three Markdown artifacts:

1. `.planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md`
2. `.planning/milestones/v4.0-phases/24-notification-stub-cleanup-test-fixture-carryover/24-VERIFICATION.md`
3. Appended `## Closure` section in `.planning/milestones/v4.0-MILESTONE-AUDIT.md`

The Phase 23 + Phase 24 working directories were cleared from `.planning/phases/` when v4.1 started (commit `9d87293`). The audit evidence base is therefore: git history of those phases (CONTEXT, RESEARCH, plan PLAN/SUMMARY files at commit `9d87293^`), the v4.0 milestone audit's already-enumerated tech-debt items, the archived `v4.0-ROADMAP.md` for the 5 success criteria + REQ-ID list per phase, the existing sub-plan `23-06-VERIFICATION.md` (also in git history) for the SET-09/11/12 no-diff carryovers, and current `src/` for behavioral spot-checks (grep + read).

**In scope:**
- Goal-backward audit of Phase 23: 5 success criteria + 8 requirements (SET-07/08/09/10/11/12 + FEAT-07/08), produced as `23-VERIFICATION.md` at the archive path above.
- Goal-backward audit of Phase 24: 5 success criteria + 7 requirements (DEBT-03/04/05/06 + TEST-04/05/06), produced as `24-VERIFICATION.md` at the archive path above.
- Both files follow the canonical Phase 22-VERIFICATION.md structure (frontmatter + Goal Achievement table + Required Artifacts + Key Link Verification + Data-Flow Trace + Behavioral Spot-Checks + `human_verification` carryover from the audit).
- Append `## Closure (2026-05-XX — Phase 31)` section to `.planning/milestones/v4.0-MILESTONE-AUDIT.md` recording the backfill landed, with links to the two new files and a one-line score. Do NOT edit the existing audit body in-place.
- Carry the 5 pending Phase 23 human-UAT items (audit lines 18, 67–68, 88) into the new `23-VERIFICATION.md` `human_verification` frontmatter so the artifact reflects the same pending state the audit recorded.
- Audit against current `main` evidence (line numbers stay useful for future readers); add a "Drift since v4.0 ship" subsection in either VERIFICATION.md if a v4.1 phase (28, 29, or earlier) altered any Phase 23/24 surface.

**Out of scope:**
- Production code changes. Goal-backward audit is read-only against `src/`.
- 23-05 SUMMARY.md backfill (audit lines 19–21). Real hygiene gap; not a roadmap success criterion. Tracked under Deferred.
- 23-VALIDATION.md / 24-VALIDATION.md frontmatter cleanup (`nyquist_compliant`, `wave_0_complete`, `status: draft`). Real hygiene gap; not a roadmap success criterion. Tracked under Deferred.
- Resurrecting the full Phase 23 / Phase 24 directory (CONTEXT, PLAN, SUMMARY, RESEARCH, etc.) from git history. The archive directory only needs to hold the new VERIFICATION.md file. Other historical artifacts stay in git history.
- Phase 999.1 directory archival (audit line 56) — separate v3.0 hygiene item.
- Re-running human UAT for the 5 pending Phase 23 items. They remain pending; the new VERIFICATION.md inherits `status: human_needed` so the artifact accurately reflects that state.
- Updating REQUIREMENTS.md traceability table (audit line 53) — separate cosmetic item.

</domain>

<decisions>
## Implementation Decisions

### File Location

- **D-01:** Reconstitute v4.0 phase archive directories. Create `.planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/` and `.planning/milestones/v4.0-phases/24-notification-stub-cleanup-test-fixture-carryover/`. Place the new VERIFICATION.md files inside. This honors the roadmap's "or equivalent path under the v4.0 milestone archive" wording verbatim and fixes the same archival miss flagged for Phase 999.1 in the v4.0 audit (line 56). Do NOT recreate the dirs under active `.planning/phases/`. Do NOT co-locate under Phase 31's own dir.
- **D-02:** The archive directories ONLY hold the new VERIFICATION.md files (and any future audit-closure artifacts). Do NOT resurrect CONTEXT, PLAN, SUMMARY, RESEARCH, REVIEW, or VALIDATION files from git history — those remain in commit history at `9d87293^` and are reachable via `git show`. The archive is the audit-closure surface, not a full historical mirror.

### Audit Baseline & Methodology

- **D-03:** Audit baseline = current `main`. Run grep/read evidence against today's `src/` so line numbers and file paths in the VERIFICATION.md stay valid for future readers. Use `git show 9d87293^:.planning/phases/23-.../<file>` (or `9d87293^:.planning/phases/24-.../<file>`) only when reading historical Phase 23/24 planning artifacts (CONTEXT, PLAN, SUMMARY) for the audit's claim/evidence basis.
- **D-04:** Drift detection. For each VERIFICATION.md, scan `git log --oneline 5991c3f..HEAD -- <relevant Phase 23/24 surface paths>` for any v4.1 commits that touched the audited surfaces. If commits are found, add a `## Drift Since v4.0 Ship` subsection enumerating which v4.1 phase changed what, and confirm the change does not invalidate the v4.0 success criterion. If no commits are found, omit the subsection (don't add empty headers).
- **D-05:** Format = canonical Phase 22-VERIFICATION.md structure. The reference file lives at git commit `2918e95` (path: `.planning/phases/22-settings-restructure-account-section/22-VERIFICATION.md`). Sections to mirror: YAML frontmatter (`phase`, `verified`, `status`, `score`, `overrides_applied`, `human_verification` array), `# Phase X Verification Report` heading with phase goal + verified date + status + re-verification flag, `## Goal Achievement` with `### Observable Truths` table (one row per success criterion), `### Required Artifacts` table (one row per file/component the phase delivered), `### Key Link Verification` table (cross-component wiring), `### Data-Flow Trace` table where applicable, `### Behavioral Spot-Checks` table (grep evidence + test runs).
- **D-06:** Evidence collection commands per claim. Each Observable Truth row's Evidence column must cite either a specific `src/` path + line range with the matched code, OR a grep command + its result, OR a test-suite name + pass count. Avoid prose-only evidence. Match the Phase 22-VERIFICATION.md tone: "X at line Y", "grep -c 'foo' returns N", "tests/foo.test.ts > 'bar' GREEN".
- **D-07:** The existing `23-06-VERIFICATION.md` sub-plan (in git history at `9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md`) covers SET-09 / SET-11 / SET-12 as no-diff carryovers from Phase 22 D-01/D-15. The new `23-VERIFICATION.md` cites this sub-plan as the evidence source for those three requirements (one-line entry + git-history link), then runs fresh evidence for SET-07 / SET-08 / SET-10 / FEAT-07 / FEAT-08.

### Audit Closure

- **D-08:** Append-only update to `.planning/milestones/v4.0-MILESTONE-AUDIT.md`. Add a new bottom-anchor section: `## Closure (2026-05-XX — Phase 31 v4.0 Verification Backfill)`. Body: 1–2 paragraphs noting the backfill landed, the two new VERIFICATION.md paths, the two phases' final scores, and a single line confirming "v4.0 audit asymmetry resolved; remaining tech_debt items (23-05 SUMMARY, VALIDATION frontmatter, Phase 999.1 archival, traceability table staleness, ~33 human UAT) remain as documented in the original tech_debt block above and are out of Phase 31 scope".
- **D-09:** Do NOT edit the existing `tech_debt:` frontmatter block, the per-phase rows, or the executive summary. The audit was a snapshot taken at v4.0 close; rewriting it loses signal. The Closure section becomes the chronological postscript that proves the audit acted on its own findings.
- **D-10:** Do NOT update the audit's frontmatter `phases: 10/12 fully verified, 2/12 partial verification` line, since that statement was true at audit time. Today's reality (post-Phase-31) is captured by the new Closure section, which is the authoritative source for current state.

### Pending Human UAT Carryover

- **D-11:** Copy the 5 pending Phase 23 human-UAT items from the audit (lines 18 + 88 — preferences persistence, similarity preference re-read, theme cross-surface sync, notesPublic cross-page revalidation, chronometer Checkbox→Certification row) into the new `23-VERIFICATION.md` frontmatter `human_verification` array. Each entry follows the Phase 22 format: `test`, `expected`, `why_human`. The artifact's frontmatter `status` becomes `human_needed` (mirrors Phase 22's pattern when human UAT is pending).
- **D-12:** Phase 24 has no pending human UAT items per the v4.0 audit (only verifier-audit gap). The new `24-VERIFICATION.md` frontmatter `status` is `passed` (or equivalent for "all observable truths VERIFIED, no human UAT pending").

### Claude's Discretion

- **Per-criterion evidence depth.** Planner picks how many grep/read commands per Observable Truth — single confirming grep is fine when the implementation is unambiguous; multiple cross-cutting commands are warranted for surfaces with multiple call sites. Calibrate against Phase 22-VERIFICATION.md as the depth reference.
- **Whether the two VERIFICATION.md files are written in one plan or two.** A single plan covering both is reasonable given the artifacts share format, evidence pattern, and closure step. Splitting into two plans is also fine if it eases worktree parallelization. Planner decides.
- **Date stamps.** Use the actual verification date when writing (not `2026-05-XX`). The CONTEXT placeholder above is a reminder, not a literal.
- **Drift subsection threshold.** If `git log` shows 1–2 cosmetic commits that touched a Phase 23/24 surface (e.g., a typo fix or import reordering), planner can footnote them inside the relevant Observable Truth row instead of producing a separate "Drift" subsection. Reserve the dedicated subsection for substantive behavioral changes.
- **Score format.** Phase 22 used `5/5 must-haves verified`; Phase 30 used `3/3 success criteria PASS`. Either form is fine; planner picks per phase based on which reads more naturally given the success-criterion count.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning or implementing.**

### Phase scope & roadmap
- `.planning/REQUIREMENTS.md` — DEBT-07 (line 50) and DEBT-08 (line 51) define the deliverables; traceability table line 93–94 maps both to Phase 31.
- `.planning/ROADMAP.md` §"Phase 31: v4.0 Verification Backfill" (line 207) — 3 success criteria. Note line 215 acknowledges the archive paths may not exist yet ("or equivalent path") — D-01 resolves this by creating them.
- `.planning/PROJECT.md` — current product state; v4.1 active, Phase 27/28/29/30 complete, Phase 31 last remaining.
- `.planning/STATE.md` — milestone status frontmatter; will be updated by `update_state` step at phase close.

### Audit source-of-truth (the document this phase is closing)
- `.planning/milestones/v4.0-MILESTONE-AUDIT.md` — full v4.0 audit. Critical sections:
  - Lines 1–58: frontmatter + tech_debt block (enumerates exactly what 23-VERIFICATION.md and 24-VERIFICATION.md must cover).
  - Lines 17–22: Phase 23 tech-debt items (the audit-reported gaps).
  - Lines 23–24: Phase 24 tech-debt items.
  - Lines 78–93: per-phase status table (Phase 23 / 24 rows show `partial` / `not formally scored`).
  - Lines 124–134: Key Link Verification examples — the cross-phase wiring claims that the new VERIFICATION.md files must include in their own Key Link tables.
  - Line 178: explicit recommendation that this phase implements (`/gsd-verify-work 23` and `/gsd-verify-work 24`).

### Phase 23 / Phase 24 source artifacts (in git history at commit `9d87293^`)
Read via `git show 9d87293^:<path>`:
- `.planning/phases/23-settings-sections-schema-field-ui/23-CONTEXT.md` — Phase 23 decisions (D-01..D-20+ including SET-09/11/12 as no-diff D-08 carryovers).
- `.planning/phases/23-settings-sections-schema-field-ui/23-RESEARCH.md` — Phase 23 background patterns (Tailwind 4 + base-ui + WatchForm field exposure).
- `.planning/phases/23-settings-sections-schema-field-ui/23-01-PLAN.md` through `23-06-PLAN.md` — six plan-level breakdowns.
- `.planning/phases/23-settings-sections-schema-field-ui/23-01-SUMMARY.md` through `23-04-SUMMARY.md` + `23-06-SUMMARY.md` — five plan SUMMARYs (23-05 SUMMARY missing; tracked under Deferred).
- `.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md` — existing sub-plan no-diff verification covering SET-09/11/12. Cite this in the new 23-VERIFICATION.md per D-07.
- `.planning/phases/23-settings-sections-schema-field-ui/23-REVIEW.md` — code-review findings (CR-01 critical was closed via commit `4d362ff`).
- `.planning/phases/23-settings-sections-schema-field-ui/23-HUMAN-UAT.md` — the 5 pending UAT items to carry forward per D-11.
- `.planning/phases/23-settings-sections-schema-field-ui/23-UI-SPEC.md` — design contract reference.
- `.planning/phases/23-settings-sections-schema-field-ui/23-VALIDATION.md` — Nyquist validation (frontmatter cleanup is out of scope per D-02; read for context only).
- `.planning/phases/24-notification-stub-cleanup-test-fixture-carryover/24-CONTEXT.md` — Phase 24 decisions including D-04 wear_visibility fixture migration + T-24-PARTIDX partial-index surgery for enum-bound dependents.
- `.planning/phases/24-notification-stub-cleanup-test-fixture-carryover/24-RESEARCH.md` — Phase 24 background.
- `.planning/phases/24-notification-stub-cleanup-test-fixture-carryover/24-01-PLAN.md` through `24-08-PLAN.md` — eight plans.
- `.planning/phases/24-notification-stub-cleanup-test-fixture-carryover/24-01-SUMMARY.md` through `24-08-SUMMARY.md` — all 8 plan SUMMARYs (complete).

### v4.0 archived roadmap (success criteria source-of-truth)
- `.planning/milestones/v4.0-ROADMAP.md` §"Phase 23: Settings Sections + Schema-Field UI" — 5 success criteria + Requirements (SET-07/08/09/10/11/12 + FEAT-07/08) + Plans note ("6 plans (5 SUMMARY files + Plan 5 implementation shipped via commit `4d362ff` without explicit SUMMARY.md)").
- `.planning/milestones/v4.0-ROADMAP.md` §"Phase 24: Notification Stub Cleanup + Test Fixture & Carryover" — 5 success criteria + Requirements (DEBT-03/04/05/06 + TEST-04/05/06) + Plans note ("8 plans (all complete)").
- `.planning/milestones/v4.0-REQUIREMENTS.md` — full SET-07..12 / FEAT-07/08 / DEBT-03..06 / TEST-04..06 requirement bodies for evidence-citing.

### Canonical VERIFICATION.md format reference
- `git show 2918e95:.planning/phases/22-settings-restructure-account-section/22-VERIFICATION.md` — Phase 22's verification artifact. Use as the structural template per D-05. Key sections to mirror: YAML frontmatter (`phase`, `verified`, `status`, `score`, `overrides_applied`, `human_verification`), Observable Truths table, Required Artifacts table, Key Link Verification table, Data-Flow Trace, Behavioral Spot-Checks.
- `.planning/phases/30-wywt-capture-alignment-fix/30-VERIFICATION.md` — recent live example of the same format (different scoring shape: `3/3 success criteria PASS`).

### Code surfaces audited by 23-VERIFICATION.md (current main)
- `src/components/settings/PreferencesSection.tsx` + `src/components/settings/CollectionGoalCard.tsx` + `src/components/settings/OverlapToleranceCard.tsx` — SET-07 / SET-08 evidence (collectionGoal + overlapTolerance lifted to top of Preferences tab as dedicated Cards).
- `src/components/settings/AppearanceSection.tsx` + `src/components/theme/InlineThemeSegmented.tsx` — SET-10 evidence (theme switch in Appearance section).
- `src/components/settings/NotificationsSection.tsx` — SET-09 evidence (notifyOnFollow / notifyOnWatchOverlap toggles; cite 23-06-VERIFICATION.md per D-07).
- `src/components/settings/PrivacySection.tsx` — SET-11 evidence (3 PrivacyToggleRow instances; cite 23-06-VERIFICATION.md per D-07).
- `src/app/preferences/page.tsx` — SET-12 evidence (server-side redirect to `/settings#preferences`; cite 23-06-VERIFICATION.md per D-07).
- `src/components/watch/WatchForm.tsx` — FEAT-07 / FEAT-08 evidence (notesPublic Public/Private pill, isChronometer Checkbox).
- `src/components/watch/WatchDetail.tsx` — FEAT-08 display evidence (Certification row).
- `src/app/actions/watches.ts` — Zod schema acceptance of `notesPublic` + `revalidatePath('/u/[username]', 'layout')` (Phase 23 D-19).

### Code surfaces audited by 24-VERIFICATION.md (current main)
- `src/lib/db/schema.ts` (or `src/db/schema.ts` — confirm path) — `notification_type` enum definition (DEBT-03/04: `price_drop` and `trending_collector` removed).
- `src/components/notifications/NotificationRow.tsx` (or equivalent) — render branches for the removed enum values absent (DEBT-03).
- Test fixtures referencing `wear_visibility` (the 9 files migrated from `wornPublic`) — DEBT-05/06.
- `tests/store/watchStore.test.ts` — TEST-04 watchStore filter reducer unit tests with `beforeEach` reset.
- `tests/app/api/extract-watch.test.ts` — TEST-05 POST `/api/extract-watch` integration coverage.
- `tests/components/watch/WatchForm.test.tsx`, `tests/components/filters/FilterBar.test.tsx`, `tests/components/watch/WatchCard.test.tsx` — TEST-06 component tests.
- `tests/setup.tsx` — PointerEvent polyfill lifted to setup file (Phase 24 D-?).
- `scripts/preflight-notification-cleanup.sql` (or equivalent) — DEBT-04 pre-flight zero-row whitelist assertion (cite from script + commit `9d87293^^` if archived).

### Migration evidence (Phase 24)
- `supabase/migrations/<timestamp>_phase24_notification_enum.sql` (find via `ls supabase/migrations/ | grep -i notif`) — rename+recreate of `notification_type` enum.
- `supabase/migrations/<timestamp>_phase24_partidx_*.sql` — T-24-PARTIDX partial-index surgery for enum-bound dependents (per memory `project_drizzle_supabase_db_mismatch.md` — enum-bound dependent surgery pattern).

### Cross-cutting memory references (operational lore)
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_drizzle_supabase_db_mismatch.md` — Phase 24 enum cleanup is the canonical worked example of the 4 prod-push gotchas (filename ordering, extension schema, enum-bound dependents). The 24-VERIFICATION.md should reference this lineage when evidencing DEBT-04.
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_supabase_secdef_grants.md` — relevant background for Phase 23's no-diff SET-12 carryover (SECDEF helper grants pattern).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 30-VERIFICATION.md (`.planning/phases/30-wywt-capture-alignment-fix/30-VERIFICATION.md`)** — recent in-repo example of the format. Useful for tone/depth calibration; the audit table style is identical to what 23/24 will produce.
- **Phase 22-VERIFICATION.md (git commit `2918e95`)** — the canonical full-shape reference for Settings-related verification (most structurally similar to what Phase 23 needs).
- **`23-06-VERIFICATION.md` sub-plan (git commit `9d87293^`)** — pre-existing no-diff verification covering 3 of Phase 23's 8 requirements (SET-09/11/12). Cite directly per D-07; do not re-derive.
- **v4.0-MILESTONE-AUDIT.md tech_debt block** — already enumerates the gaps; the audit's own list is the audit checklist for Phase 31.

### Established Patterns
- **Frontmatter `human_verification` array carryover** — Phase 22's pattern: each pending UAT item has `test`, `expected`, `why_human` keys. Phase 31 mirrors this exactly when carrying the 5 Phase 23 items per D-11.
- **Append-only audit closure** — no precedent in this repo (this is the first phase to close a milestone audit), but matches the project's general "preserve history, append updates" pattern (e.g., PROJECT.md `<details>` Previous Last-updated entries; STATE.md frontmatter accumulating sessions).
- **`git show 9d87293^:<path>` for archived planning artifacts** — established by the v4.0 milestone archive itself (commit `9d87293` cleared 12 phase dirs while preserving them in history). All Phase 23/24 source artifacts are reachable this way.
- **`grep -c "<pattern>" <file>` evidence in VERIFICATION.md** — Phase 22 + Phase 30 both use this pattern. Reproducible, low-noise, easy to re-run.

### Integration Points
- **`.planning/milestones/v4.0-phases/`** — directory does not yet exist; D-01 creates it. This sets a precedent for future milestone archival (Phase 999.1 + future milestone closures should adopt the same shape).
- **`.planning/milestones/v4.0-MILESTONE-AUDIT.md`** — append-only edit at the bottom. The frontmatter and existing body remain unchanged.
- **STATE.md** — `update_state` step at phase close will record Phase 31 completion, which transitions v4.1 from `in progress` to ready-for-`/gsd-complete-milestone`.

</code_context>

<specifics>
## Specific Ideas

- The new VERIFICATION.md files explicitly cite the audit's own tech_debt items they close. Each file's frontmatter or opening paragraph should reference `.planning/milestones/v4.0-MILESTONE-AUDIT.md` lines 17–22 (Phase 23) or lines 23–24 (Phase 24) so the closure is bidirectional — audit links to closure, closure links to audit.
- Use the audit's existing per-phase sub-bullets as the starting checklist for "what to verify": every sub-bullet under a phase's tech_debt block becomes a row in either the Observable Truths table or the human_verification array.
- The `23-06-VERIFICATION.md` evidence reuse pattern (D-07) keeps the new artifact concise: SET-09/11/12 each become a single-line table row pointing at the sub-plan, not a re-derived multi-grep evidence block.

</specifics>

<deferred>
## Deferred Ideas

These are real audit-flagged debt items that are NOT Phase 31 success criteria. Captured here so they're not lost.

- **23-05 SUMMARY.md backfill.** Audit lines 19–21 note that Plan 23-05 has no SUMMARY.md (implementation shipped via commit `4d362ff` which closed CR-01 critical from 23-REVIEW.md). Cheap to write from the commit message + diff. Candidate for a quick task after Phase 31 lands, OR fold into a future v4.0 hygiene phase.
- **23-VALIDATION.md frontmatter cleanup.** Audit line 22: `nyquist_compliant: false, wave_0_complete: false, status: draft`. If 23-VERIFICATION.md passes all 5 success criteria, the VALIDATION frontmatter should be updated to reflect resolution. Out of Phase 31 scope (not a roadmap success criterion).
- **24-VALIDATION.md frontmatter cleanup.** Audit line 25: same shape as above.
- **Phase 999.1 directory archival** (audit line 56). v3.0 hygiene item — should move from `.planning/phases/999.1-phase-5-code-review-followups-rls-errors/` to `.planning/milestones/v3.0-phases/`. Same archival pattern as D-01 but for a different milestone.
- **REQUIREMENTS.md traceability table refresh** (audit line 53). Cosmetic; will regenerate during `/gsd-complete-milestone v4.1` close.
- **STATE.md Progress Bar staleness in audit** (audit line 54). Already addressed in current STATE.md; audit's reference is to a v4.0-era staleness no longer present.
- **~33 deferred human UAT items across Phases 18 / 20 / 20.1 / 22 / 23.** Tracked in PROJECT.md Active section. Not Phase 31 scope; some may be picked up during v4.1 close or rolled into v5.0 onboarding work.
- **Phase 24 partial Nyquist coverage** (audit `nyquist:` block). If desired, address via `/gsd-validate-phase 24` separately. Out of Phase 31 scope.

### Reviewed Todos (not folded)
None — no todo cross-reference performed for this phase (audit-only scope; no implementation todos applicable).

</deferred>

---

*Phase: 31-v4-0-verification-backfill*
*Context gathered: 2026-05-05*

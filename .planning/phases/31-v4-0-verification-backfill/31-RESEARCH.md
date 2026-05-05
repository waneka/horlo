# Phase 31: v4.0 Verification Backfill - Research

**Researched:** 2026-05-05
**Domain:** Documentation / goal-backward audit (no production code changes)
**Confidence:** HIGH — every key claim verified against current `main` via git/grep/test runs

## Summary

Phase 31 produces three Markdown artifacts: a phase-level VERIFICATION.md for Phase 23 and Phase 24 (each in a NEW `.planning/milestones/v4.0-phases/<slug>/` archive directory) and an append-only `## Closure` section on `.planning/milestones/v4.0-MILESTONE-AUDIT.md`. The work is goal-backward audit — read shipped code on current `main`, cite evidence per success criterion, and record results in the canonical Phase 22-VERIFICATION.md format.

The single most consequential research finding is **a regression on FEAT-07 hidden inside the v4.0 audit's accepted evidence chain.** The audit (and v4.0-REQUIREMENTS.md) cite commit `4d362ff` as the implementation evidence for FEAT-07 (`notesPublic` Zod field + `revalidatePath('/u/[username]', 'layout')` cross-page sync). That commit is **not an ancestor of HEAD.** The Phase 23-05 implementation never reached main. The current `src/app/actions/watches.ts` has neither the schema field nor the revalidation, and `tests/actions/watches.notesPublic.test.ts` fails 4/4 on current `main`. The audit was written from the historical workplan, not against shipped main. Phase 31's audit must surface this gap honestly — the planner needs to know the goal-backward audit will produce a `gap` finding for FEAT-07 that does not exist in the audit's `tech_debt` block.

A secondary finding: 3 test files in `tests/components/settings/preferences/` fail because `useFormFeedback` calls `useRouter` without a mock; this is test-infrastructure breakage the audit can document but is out of Phase 31's remediation scope.

**Primary recommendation:** Plan two VERIFICATION.md files in one combined plan (single executor, shared evidence-collection style, shared closure step). Use Phase 22-VERIFICATION.md (commit `2918e95`) as the structural template; lift the canonical sections verbatim. For each Observable Truth row, cite either `src/<path>:<line>` + matched code, or `grep <pattern> <file>` + count, or `npx vitest run <file> --reporter=basic` + pass count. Surface the FEAT-07 regression as a Gap row in 23-VERIFICATION.md — do not paper over it.

## Architectural Responsibility Map

This is a documentation phase; no code tiers. Mapping artifact ownership instead:

| Artifact | Primary Tier | Secondary Tier | Rationale |
|----------|-------------|----------------|-----------|
| `23-VERIFICATION.md` | Audit / Documentation | — | Goal-backward audit of Phase 23 success criteria against `src/` |
| `24-VERIFICATION.md` | Audit / Documentation | — | Goal-backward audit of Phase 24 success criteria against `src/` + migrations + tests |
| `v4.0-MILESTONE-AUDIT.md` Closure | Audit / Documentation | — | Append-only postscript; original audit body untouched |
| `.planning/milestones/v4.0-phases/` directory | Filesystem / Archive | — | New convention; sets precedent for Phase 999.1 future archival |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**File location**
- **D-01:** Reconstitute v4.0 phase archive directories at `.planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/` and `.planning/milestones/v4.0-phases/24-notification-stub-cleanup-test-fixture-carryover/`. Do NOT recreate under active `.planning/phases/`. Do NOT co-locate under Phase 31's own dir.
- **D-02:** Archive directories ONLY hold the new VERIFICATION.md files. Do NOT resurrect CONTEXT/PLAN/SUMMARY/RESEARCH/REVIEW/VALIDATION from git history.

**Audit baseline & methodology**
- **D-03:** Audit baseline = current `main`. Use `git show 9d87293^:<path>` only when reading historical Phase 23/24 planning artifacts.
- **D-04:** Drift detection via `git log --oneline 5991c3f..HEAD -- <surface>`. Add `## Drift Since v4.0 Ship` subsection only when commits found; omit empty headers.
- **D-05:** Format = canonical Phase 22-VERIFICATION.md structure at git commit `2918e95`. Mirror: YAML frontmatter (`phase`, `verified`, `status`, `score`, `overrides_applied`, `human_verification` array), `# Phase X Verification Report` heading + goal/date/status/re-verification, `## Goal Achievement` with `### Observable Truths` table, `### Required Artifacts` table, `### Key Link Verification` table, `### Data-Flow Trace` (where applicable), `### Behavioral Spot-Checks` table.
- **D-06:** Each Observable Truth Evidence cell cites `src/<path>:<lines>` + code, OR a grep command + result, OR a test name + pass count. No prose-only evidence.
- **D-07:** `23-06-VERIFICATION.md` (in git history at `9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md`) covers SET-09 / SET-11 / SET-12. Cite as evidence source — single-line table row pointing at the sub-plan, not re-derived multi-grep.

**Audit closure**
- **D-08:** Append-only update to `v4.0-MILESTONE-AUDIT.md`. Add bottom-anchor section `## Closure (2026-05-XX — Phase 31 v4.0 Verification Backfill)`. Body: 1-2 paragraphs noting backfill landed, two new VERIFICATION.md paths, two phases' final scores, single line confirming "v4.0 audit asymmetry resolved; remaining tech_debt items remain as documented in the original tech_debt block above and are out of Phase 31 scope."
- **D-09:** Do NOT edit existing `tech_debt:` frontmatter, per-phase rows, or executive summary.
- **D-10:** Do NOT update audit frontmatter `phases: 10/12 fully verified, 2/12 partial verification` line.

**Pending human UAT carryover**
- **D-11:** Copy 5 pending Phase 23 human-UAT items into 23-VERIFICATION.md frontmatter `human_verification` array (Phase 22 format: `test`, `expected`, `why_human`). Frontmatter `status` = `human_needed`.
- **D-12:** Phase 24 has no pending human UAT. 24-VERIFICATION.md frontmatter `status` = `passed` (or equivalent).

### Claude's Discretion

- Per-criterion evidence depth — single confirming grep when unambiguous; multi-cutting commands for surfaces with multiple call sites. Calibrate against Phase 22-VERIFICATION.md.
- Whether two VERIFICATION.md files written in one plan or two — single plan reasonable; splitting also fine.
- Date stamps — use actual verification date, not literal `2026-05-XX`.
- Drift subsection threshold — if 1-2 cosmetic commits, footnote inside relevant Observable Truth row instead of a dedicated subsection.
- Score format — `5/5 must-haves verified` (Phase 22 style) OR `3/3 success criteria PASS` (Phase 30 style). Either form fine.

### Deferred Ideas (OUT OF SCOPE)

- **23-05 SUMMARY.md backfill** (audit lines 19-21) — real hygiene gap, not a roadmap success criterion. Tracked.
- **23-VALIDATION.md / 24-VALIDATION.md frontmatter cleanup** — real hygiene gap, not a roadmap success criterion. Out of scope.
- **Phase 999.1 directory archival** (audit line 56) — separate v3.0 hygiene item.
- **Re-running human UAT for the 5 pending Phase 23 items** — they remain pending; new VERIFICATION.md inherits `status: human_needed`.
- **REQUIREMENTS.md traceability table refresh** (audit line 53) — cosmetic; will regenerate during `/gsd-complete-milestone v4.1`.
- **Phase 24 partial Nyquist coverage** — out of Phase 31 scope.

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Next.js 16 quirks (AGENTS.md):** APIs and conventions may differ from training data. Read `node_modules/next/dist/docs/` before writing code. _For Phase 31, no production code is being written — N/A in practice._
- **GSD Workflow Enforcement (CLAUDE.md):** All edits go through a GSD command. Phase 31 enters via `/gsd-plan-phase 31`. _Honored by current sequencing — research → plan → execute_.
- **No CSS chain blind-spot (memory `feedback_ui_spec_css_chain_blind_spot`):** UI-SPEC checker's 6-pillar gate validated tokens but not visual contract; Phase 30 black-bar shipped through 6/6 PASS. _Not directly applicable to Phase 31 (no UI), but the lesson — assert behavior end-to-end, not just declarations — applies to the goal-backward audit method itself._
- **Tech stack constraints (CLAUDE.md `## Project`):** Next.js 16 App Router, TypeScript 5, Tailwind 4, Drizzle + Supabase, Zustand. _Audit references these surfaces but does not modify them._

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-07 | Phase 23 phase-level VERIFICATION.md backfilled. Goal-backward audit of Phase 23 (Settings Sections + Schema-Field UI) against shipped code. Closes v4.0 verification asymmetry per `milestones/v4.0-MILESTONE-AUDIT.md`. | §"Phase 23 evidence catalogue", §"Critical regression — FEAT-07 commit not on main", §"Per-criterion evidence map (Phase 23)" |
| DEBT-08 | Phase 24 phase-level VERIFICATION.md backfilled. Goal-backward audit of Phase 24 (Notification Stub Cleanup + Test Fixture & Carryover) against shipped code. Closes v4.0 verification asymmetry. | §"Phase 24 evidence catalogue", §"Per-criterion evidence map (Phase 24)" |

## Standard Stack

This is a documentation phase. No new packages. Tools used:

### Core
| Tool | Purpose | Why Standard |
|------|---------|--------------|
| `git show <commit>:<path>` | Read historical planning artifacts at `9d87293^` per D-03 | Native to git, zero install, cited verbatim by D-03 |
| `git log --oneline <range> -- <surface>` | Drift detection per D-04 | Cited verbatim by D-04 |
| `git merge-base --is-ancestor <commit> HEAD` | Verify cited commits actually reach main | Surfaces the FEAT-07 regression below |
| `grep -nE '<pattern>' <file>` | Match-with-line evidence per D-06 | Phase 22 + Phase 30 precedent |
| `npx vitest run <file> --reporter=basic` | Test pass/fail counts per D-06 | Already in repo (vitest 2.1.9) |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `Write` (Claude Code) | Create VERIFICATION.md files | Always — never use heredoc per workflow rules |
| `Edit` (Claude Code) | Append `## Closure` section to v4.0-MILESTONE-AUDIT.md | Append-only edit per D-08 |

**Installation:** None required. All tools present.

**Version verification:** N/A — no new dependencies.

## Architecture Patterns

### Canonical VERIFICATION.md Anatomy (Phase 22 reference at commit `2918e95`)

The structural template MUST mirror Phase 22 exactly per D-05. Captured below from `git show 2918e95:.planning/phases/22-settings-restructure-account-section/22-VERIFICATION.md`:

#### Pattern 1: YAML Frontmatter Shape
```yaml
---
phase: <slug>
verified: <ISO timestamp>
status: <human_needed | passed | closed>
score: <"5/5 must-haves verified" | "3/3 success criteria PASS" | etc.>
overrides_applied: 0
human_verification:
  - test: "<short title>"
    expected: "<verbatim from 23-HUMAN-UAT.md or equivalent>"
    why_human: "<1-2 sentences why automation cannot verify>"
---
```

For Phase 24 (no pending UAT per D-12), `human_verification:` should still appear in frontmatter — either as an empty list (`human_verification: []`) or omitted entirely. **Phase 22 includes the array** (it has 6 entries). **Phase 30 also includes it** with one entry that has a `result: PASS` field. For Phase 24 with no items, recommend omitting the key entirely (Phase 22 / Phase 30 only have it because items exist).

#### Pattern 2: H1 + Header Block
```markdown
# Phase X: <Name> Verification Report

**Phase Goal:** <verbatim from milestone roadmap §"Phase X" Goal line>
**Verified:** <same ISO timestamp as frontmatter>
**Status:** <same as frontmatter>
**Re-verification:** No — initial verification
```

#### Pattern 3: `## Goal Achievement` → `### Observable Truths` Table
One row per success criterion from `v4.0-ROADMAP.md` §"Phase X". Columns: `# | Truth | Status | Evidence`. Status is `VERIFIED` (or `VERIFIED (code level)` when human UAT pending) or `GAP` (Phase 31 needs to introduce the GAP status — Phase 22 didn't have any). Evidence cites `<file>:<lines>`, grep result, or test name + pass count.

#### Pattern 4: `### Required Artifacts` Table
One row per file/component the phase delivered. Columns: `Artifact | Expected | Status | Details`. Status is `VERIFIED` or `MISSING` or `DELETED`.

#### Pattern 5: `### Key Link Verification` Table
Cross-component wiring. Columns: `From | To | Via | Status | Details`. Status is `WIRED`. This is the "does X actually connect to Y" check.

#### Pattern 6: `### Data-Flow Trace (Level 4)` Table
Optional — used when data passes through multiple layers. Columns: `Artifact | Data Variable | Source | Produces Real Data | Status`. Status is `FLOWING`.

#### Pattern 7: `### Behavioral Spot-Checks` Table
The actual command-line evidence. Columns: `Behavior | Command | Result | Status`. Status is `PASS` or `FAIL`.

#### Pattern 8: `### Requirements Coverage` Table (per-REQ-ID rollup)
Columns: `Requirement | Source Plan | Description | Status | Evidence`. Status is `SATISFIED` or `GAP`. This is where REQ-IDs (SET-07 etc.) anchor.

#### Pattern 9: `### Anti-Patterns Found` Table (optional)
Columns: `File | Line | Pattern | Severity | Impact`. Phase 22 had 5 info-level rows; Phase 30 had 1 "None found" row. Phase 31's audits should include this section even if empty (matches Phase 22 / Phase 30 precedent).

#### Pattern 10: `### Human Verification Required` Section
For each item: `#### N. <title>`, then `**Test:**`, `**Expected:**`, `**Why human:**`. The body of each frontmatter `human_verification` entry expanded to readable prose.

#### Pattern 11: `### Gaps Summary` Section
1-3 paragraphs. State whether all goals are met or list specific gaps. Per Phase 30: "No gaps found at code level." Per Phase 22: "No automation gaps blocking goal achievement." Phase 23's audit will need a "FEAT-07 implementation gap" paragraph here.

#### Pattern 12: Footer
```markdown
---

_Verified: <ISO timestamp>_
_Verifier: Claude (gsd-verifier)_
```

### Pattern 13: Score Formats Observed

| Phase | Format | Use When |
|-------|--------|----------|
| Phase 22 | `5/5 must-haves verified` | Roadmap success criteria count is the score |
| Phase 30 | `3/3 success criteria PASS (initial code verification + post-deploy iOS Safari UAT after CSS hotfix)` | Score includes a parenthetical context note |

For Phase 23 (5 success criteria, 8 REQ-IDs, 1 known gap): recommend `4/5 success criteria VERIFIED + 1 GAP (FEAT-07 implementation regression)` or similar — be honest about the regression.

For Phase 24 (5 success criteria, 7 REQ-IDs, all VERIFIED): recommend `5/5 success criteria PASS`.

### Anti-Patterns to Avoid

- **Resurrecting historical artifacts.** Per D-02, the archive directory holds ONLY the new VERIFICATION.md. Do NOT copy CONTEXT/PLAN/SUMMARY from `9d87293^` into the new dir. Git history is sufficient.
- **Modifying the audit body.** Per D-09 / D-10, the audit's `tech_debt:` frontmatter and per-phase status table stay frozen. The Closure section is the chronological postscript.
- **Empty `## Drift Since v4.0 Ship` headers.** Per D-04, omit the subsection if the git log query returns nothing. Don't add empty headers.
- **Re-deriving SET-09 / SET-11 / SET-12.** Per D-07, cite `23-06-VERIFICATION.md` (in git history) as the evidence source. Single-line entry. Do NOT replay the no-diff verification multi-grep block.
- **Prose-only evidence.** Per D-06, the Evidence column must be a path+line, a grep command+result, or a test name+pass count. Avoid "the implementation looks correct" prose.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter validation | Custom parser | Read by humans + IDE; Phase 22 / 30 establish the convention; the verifier doesn't programmatically validate | Phase precedent shows it works — IDE syntax-highlights, humans grok it, no consumer parses it programmatically. |
| Phase 23 / 24 directory recreation | Resurrect CONTEXT/PLAN/SUMMARY/RESEARCH | Read from `git show 9d87293^:<path>` when needed; archive holds only new VERIFICATION.md per D-02 | Git history is the source-of-truth; duplication invites divergence. |
| Closure section format | New shape | Mirror existing audit's tech_debt block style — markdown bullets, `phase:`/`items:` indentation if extending, or simple paragraphs per D-08 | Audit body unchanged per D-09; Closure is a NEW bottom-anchor section, free to use simple paragraphs. |
| Drift detection | Custom diff tooling | `git log --oneline 5991c3f..HEAD -- <surface>` per D-04 | Native git, exact commit list, drops into the VERIFICATION.md as a citation. |

**Key insight:** This phase's "code" is markdown. Don't introduce automation. The verification format is established (Phase 22 + Phase 30 = 2 worked examples). The evidence-collection method is `grep`/`git`/`vitest`. Following the canonical structure is the entire job.

## Runtime State Inventory

This is a documentation phase — no migrations, no live services, no OS-registered state changes. The "runtime state" being audited belongs to the v4.0 phases, not Phase 31.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — Phase 31 writes only Markdown files | None |
| Live service config | None — no service config touched | None |
| OS-registered state | None — no OS registrations | None |
| Secrets / env vars | None — no secrets touched | None |
| Build artifacts | None — Markdown changes don't trigger build artifacts | None |

**Cross-reference:** The Phase 24 enum cleanup migration (`supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql`) IS a runtime-state-affecting migration. It already shipped to prod per the audit (line 23). Phase 31's audit cites it as evidence for DEBT-04, but does NOT touch it. The migration's existence + idempotent post-check (`pg_enum` count = 2) is sufficient evidence.

## Common Pitfalls

### Pitfall 1: Citing the Audit's Own Evidence Without Re-Verifying

**What goes wrong:** The v4.0 audit (e.g. line 110-112) states "SET-07..12 + FEAT-07/08 logically SATISFIED via plan SUMMARYs + commit `4d362ff`." A naïve auditor copies this into 23-VERIFICATION.md and moves on.

**Why it happens:** The audit was written from the workplan, not against shipped main. The audit is the document being closed — it cannot be the evidence source for closing itself. Goal-backward means RUNNING the verification against current `main`.

**How to avoid:** For each cited commit in the audit, verify `git merge-base --is-ancestor <commit> HEAD` returns 0. If not, the commit is on a sidebranch. Then re-grep current `src/` to confirm the change actually landed.

**Warning signs:** Audit says "shipped via commit X" but `git show X` does not appear in `git log main`. This is the FEAT-07 case — see §"Critical regression — FEAT-07 commit not on main" below.

### Pitfall 2: Confusing Doc Commits with Implementation Commits on Main

**What goes wrong:** `git log --oneline` shows `1df6c2a docs(phase-23): complete phase execution` is on main, suggesting Phase 23 is complete. But the production-code commits the doc commit references (`4d362ff`, `5675bf5`, `befb502`, `2413c40`) may NOT be on main.

**Why it happens:** GSD orchestrator merges executor worktrees via `chore: merge executor worktree` commits. Phase 23 had a merge step (`5675bf5 chore: merge executor worktree 23-06`) that did NOT reach main. The doc commits that came after the missing merge happily landed in main, recording state the code never matched.

**How to avoid:** Don't trust phase-completion doc commits. For each requirement, find the implementation commit and verify it's an ancestor of HEAD.

**Warning signs:**
```
git merge-base --is-ancestor 5675bf5 HEAD; echo $?    → 1 (not ancestor)
git merge-base --is-ancestor 4d362ff HEAD; echo $?    → 1 (not ancestor)
git merge-base --is-ancestor 1df6c2a HEAD; echo $?    → 0 (ancestor — but only the doc commit)
```

### Pitfall 3: The `23-06-VERIFICATION.md` Format Differs from Phase 22 Canonical

**What goes wrong:** The sub-plan `23-06-VERIFICATION.md` uses a freeform "## SET-XX — claim / evidence / verdict" prose format with embedded code blocks. It is NOT the canonical Phase 22 table-based VERIFICATION.md format. An auditor who tries to lift its prose into the new 23-VERIFICATION.md ends up mixing styles.

**Why it happens:** 23-06 was a sub-plan no-diff verification (D-08 carryovers from Phase 22), written as a quick prose check. The phase-level VERIFICATION.md backfill is canonical Phase 22 shape per D-05.

**How to avoid:** Per D-07, cite `23-06-VERIFICATION.md` as the evidence source for SET-09 / SET-11 / SET-12 — single-line table row with a verdict + git-history link. Don't replay its prose. The new 23-VERIFICATION.md uses canonical Phase 22 tables throughout.

### Pitfall 4: Drift Subsection Pollution

**What goes wrong:** Auditor adds `## Drift Since v4.0 Ship` to both VERIFICATION.md files, lists every commit `git log --oneline 5991c3f..HEAD -- src/components/settings/` returns, and the subsection becomes 30 lines of irrelevant cosmetic edits.

**Why it happens:** v4.1 modified some Phase 23 surfaces incidentally (Phase 28-05 commit `fbe3522` rewrote AddWatchFlow + WatchForm commit handlers; Phase 27-02 added sort_order to actions/watches.ts). These are not regressions of Phase 23's contract — they extend behavior alongside it.

**How to avoid:** Per D-04, only add the subsection if v4.1 commits **substantively changed** Phase 23/24 behavior. For cosmetic / additive changes, footnote inside the relevant Observable Truth row.

**Drift inventory (run by this researcher):**

| Surface | v4.1 commits | Substantive change? |
|---------|--------------|---------------------|
| `src/components/settings/*.tsx` | None since 5991c3f | No |
| `src/components/settings/preferences/*.tsx` | None | No |
| `src/components/watch/WatchForm.tsx` | `fbe3522 feat(28-05): rewrite AddWatchFlow + WatchForm commit handlers (UX-09 + ADD-08)` | **Yes** — affects FEAT-07/08 behavior surface (the form that toggles notesPublic + isChronometer). Footnote inside FEAT-07/FEAT-08 Observable Truth rows. |
| `src/components/watch/WatchDetail.tsx` | None | No |
| `src/app/actions/watches.ts` | `442dca9 fix(27): WR-01 strip client-supplied sortOrder`, `aaf66a4 feat(27-02): wire sort_order assignment` | Additive (sort_order field); does NOT remove any Phase 23 contract. Footnote in FEAT-07 row that the action signature gained sortOrder per Phase 27. |
| `src/app/preferences/page.tsx` | None | No |
| `src/db/schema.ts` | `e4d6b78 feat(27-02): add watches.sort_order column` | Additive; does NOT touch Phase 24 enum cleanup. Footnote in DEBT-05 row that schema gained sort_order per Phase 27. |
| `tests/store/watchStore.test.ts`, `tests/components/filters/FilterBar.test.tsx`, `tests/components/watch/WatchForm.test.tsx`, `tests/components/watch/WatchCard.test.tsx` | `9c2126f test(29-01): add FORM-04 reset-on-key-change test for WatchForm` (only WatchForm) | Additive (extends WatchForm test file with one more test). Footnote in TEST-06 row. |

**Recommendation:** No dedicated `## Drift Since v4.0 Ship` subsection in either file. Use footnotes per row.

### Pitfall 5: Mis-Pathed Code References in CONTEXT.md

**What goes wrong:** CONTEXT.md `<code_context>` cites `src/components/theme/InlineThemeSegmented.tsx` and `src/components/settings/CollectionGoalCard.tsx`. Both paths are wrong.

**Why it happens:** Path drift since the audit was written. Real paths verified by this researcher:

| Cited in CONTEXT.md | Actual on main |
|---------------------|----------------|
| `src/components/theme/InlineThemeSegmented.tsx` | `src/components/layout/InlineThemeSegmented.tsx` |
| `src/components/settings/CollectionGoalCard.tsx` | `src/components/settings/preferences/CollectionGoalCard.tsx` |
| `src/components/settings/OverlapToleranceCard.tsx` | `src/components/settings/preferences/OverlapToleranceCard.tsx` |
| `tests/app/api/extract-watch.test.ts` | `tests/api/extract-watch.test.ts` |

**How to avoid:** Verify every path in CONTEXT.md `<code_context>` against current main BEFORE writing the VERIFICATION.md. Use the corrected paths.

### Pitfall 6: Test-Suite False Failures From Test-Infra Bugs

**What goes wrong:** Auditor runs `npx vitest run tests/components/settings/preferences/` and sees 3 failures, concludes Phase 23 SET-07/SET-08 is broken.

**Why it happens:** `useFormFeedback` (used by `OverlapToleranceCard`, `CollectionGoalCard`) calls `useRouter()`, which throws when no AppRouter mock is mounted in the test environment. This is a **test-infrastructure bug**, not an SET-07/SET-08 contract regression. The components work in production.

**How to avoid:** When a test fails, check if it's testing the contract or the infrastructure. The CollectionGoalCard / OverlapToleranceCard tests fail at `useRouter is not mounted` — that's setup, not contract. Cite the failure under `### Anti-Patterns Found` (test-infra debt) rather than under Observable Truths.

**Warning signs:**
```
Error: invariant expected app router to be mounted
 ❯ Proxy.useRouter node_modules/next/src/client/components/navigation.ts:179:11
 ❯ Module.useFormFeedback src/lib/hooks/useFormFeedback.ts:86:18
```

This is `next/navigation` not being mocked. The component itself is fine.

## Critical Regression — FEAT-07 commit not on main

**This is the most consequential research finding for Phase 31.**

### The claim being audited
v4.0-MILESTONE-AUDIT.md line 110-111:
```
| Watch Field UI | FEAT-07..08 (2) | 23 | ✓ logically SATISFIED via plan SUMMARYs + commit 4d362ff
```

v4.0-REQUIREMENTS.md line 93:
```
- [x] FEAT-07: Owner can toggle notesPublic per-note from the WatchForm + per-row note edit surface — Phase 23 (Validated; shipped via commit 4d362ff adding notesPublic to Zod + revalidatePath layout sync)
```

### What current main shows

```
$ git merge-base --is-ancestor 4d362ff HEAD; echo $?
1
```

`4d362ff` is **NOT** an ancestor of HEAD. The branch ref is `worktree-agent-a449f194b5f56146c` (a stale worktree). The Phase 23-05 implementation never merged to main.

### Surface evidence

```
$ grep -nE "notesPublic|notes_public" src/app/actions/watches.ts
(no matches)

$ git show 5991c3f:src/app/actions/watches.ts | grep -nE "notesPublic|notes_public"
(no matches — v4.0 ship commit also missing the field)
```

`insertWatchSchema` in `src/app/actions/watches.ts` does NOT include `notesPublic`. WatchForm sends it via `...formData` spread (line 217 of `src/components/watch/WatchForm.tsx`); Zod silently strips it.

```
$ grep -nE "revalidatePath" src/app/actions/watches.ts
3:import { revalidatePath, revalidateTag } from 'next/cache'
267:    revalidatePath('/')
340:    revalidatePath('/')
372:    revalidatePath('/')
```

No `revalidatePath('/u/[username]', 'layout')` anywhere in the file. The cross-page sync the audit (and 23-HUMAN-UAT.md test #4) describes does not exist on main.

### Test confirmation

```
$ npx vitest run tests/actions/watches.notesPublic.test.ts --reporter=basic
 FAIL  tests/actions/watches.notesPublic.test.ts
      Tests  4 failed (4)
```

The Phase 23-05 RED test scaffold is RED on main. The test asserts `revalidatePath` was called with `'/u/[username]', 'layout'` and that Zod rejects non-boolean — both behaviors are absent.

### What this means for Phase 31

The 23-VERIFICATION.md goal-backward audit MUST surface this. Three honest framings the planner can choose between:

**Option A (recommended) — VERIFIED with documented gap row:**
- Observable Truth #4 (FEAT-07): status = `GAP`, evidence = "commit `4d362ff` cited by audit line 111 is NOT an ancestor of HEAD; `tests/actions/watches.notesPublic.test.ts` 4/4 RED on main; `insertWatchSchema` lacks notesPublic field; no `revalidatePath('/u/[username]', 'layout')` call site exists. WatchForm pill UI works locally (formData mutation) but the value is silently stripped at the action boundary. Server-side persistence and cross-page sync are absent."
- Score: `4/5 success criteria VERIFIED + 1 GAP (FEAT-07 server-action regression)`
- `### Gaps Summary`: dedicated paragraph stating the gap, recommending it be tracked as a v4.1 follow-up DEBT-09 or rolled into v5.0 onboarding work.
- Frontmatter `status: human_needed` (5 pending UAT items per D-11) AND the gap. The `gap` does not change `human_needed` status — that's about UAT, the gap is about implementation.

**Option B — Two-tier status:**
- Observable Truth #4: status = `VERIFIED (UI level) / GAP (server-action level)`. Same evidence narrative.
- Same overall score and gaps summary.

**Option C — Re-derive without the missing commit:**
- Treat FEAT-07 as effectively "shipped via commit `aaf66a4` (Phase 27-02 sort_order, which kept actions/watches.ts in its v4.0 ship state — i.e., still missing notesPublic)" and document the regression as a known v4.0 ship-state bug.
- Less honest; not recommended.

**Recommended: Option A.** It matches Phase 22's "Anti-Patterns Found" tone of surfacing real issues without re-litigating them. The audit closure can note "Phase 31 audit surfaced FEAT-07 implementation regression; tracked as new follow-up tech_debt item."

### Auxiliary regression — settings/preferences card tests

```
$ npx vitest run tests/components/settings/preferences/ --reporter=basic
 Test Files  1 failed
      Tests  3 failed
```

`OverlapToleranceCard.test.tsx` and `CollectionGoalCard.test.tsx` both fail with `useRouter is not mounted`. Root cause: `useFormFeedback` (Phase 25-01) calls `useRouter`, the cards consume it, the test setup does not mock `next/navigation`. Per Pitfall 6, this is test-infra debt, not contract regression — the cards work in production. Document under `### Anti-Patterns Found` with severity Info.

## Phase 23 Evidence Catalogue

Goal-backward audit data the planner needs. One row per success criterion + REQ-ID. Lifted from current `main` evidence runs.

### Phase 23 Success Criteria (5 from `v4.0-ROADMAP.md` lines 130-135)

| # | Truth | Required Evidence | Cited Source |
|---|-------|-------------------|--------------|
| 1 | Preferences section exposes `collectionGoal` select (4 options) and `overlapTolerance` select (3 options), wired to `user_preferences`, reflected by `analyzeSimilarity()` on next read. | `src/components/settings/PreferencesSection.tsx:1-2` (imports `CollectionGoalCard`, `OverlapToleranceCard`); `src/components/settings/preferences/CollectionGoalCard.tsx`; `src/components/settings/preferences/OverlapToleranceCard.tsx`; existence test passes; manual UAT 1-2 deferred per D-11. | SET-07, SET-08 |
| 2 | Notifications section exposes UI toggles for `notifyOnFollow` + `notifyOnWatchOverlap`. | Cite `23-06-VERIFICATION.md` per D-07 (in git history at `9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md`). Single-line table row. | SET-09 |
| 3 | Privacy section retains 3 toggles (restyled into vertical-tabs frame); Appearance section houses theme switch (lifted from UserMenu's `<InlineThemeSegmented>`). | Privacy: cite `23-06-VERIFICATION.md` per D-07. Appearance: `src/components/settings/AppearanceSection.tsx:2,23` — imports `InlineThemeSegmented` from `@/components/layout/InlineThemeSegmented` (NOTE: actual path `src/components/layout/`, not `src/components/theme/`); renders inside `<SettingsSection title="Theme">`. | SET-10, SET-11 |
| 4 | Owner can toggle `notesPublic` per-note from the WatchForm and from the per-row note edit surface. | **GAP** per §"Critical regression". WatchForm UI exists (`src/components/watch/WatchForm.tsx:648-665` Public/Private pill); per-row pill exists at `src/components/profile/NoteVisibilityPill.tsx`. **Server action does NOT accept the field** — `src/app/actions/watches.ts` `insertWatchSchema` lacks `notesPublic`; no `revalidatePath('/u/[username]', 'layout')` call. `tests/actions/watches.notesPublic.test.ts` 4/4 FAIL. | FEAT-07 |
| 5 | Owner can toggle `isChronometer` in WatchForm and see it displayed in WatchDetail. | `src/components/watch/WatchForm.tsx:81,125,575-577` (default false, edit hydration, Checkbox); `src/components/watch/WatchDetail.tsx:287-295` (Certification row gated on `watch.isChronometer === true`); `tests/components/watch/WatchForm.isChronometer.test.tsx` 5/5 PASS; `tests/components/watch/WatchDetail.isChronometer.test.tsx` 4/4 PASS. | FEAT-08 |

### Phase 23 Required Artifacts (current main)

| Artifact | Expected | Verified Status | Path on Current Main |
|----------|----------|------|----------------------|
| Preferences section component | Composes 2 top cards + embedded PreferencesClient | VERIFIED | `src/components/settings/PreferencesSection.tsx` (35 LOC, Server Component) |
| `CollectionGoalCard` | 4-option select wired to `user_preferences.collection_goal` | VERIFIED | `src/components/settings/preferences/CollectionGoalCard.tsx` (NOTE: `preferences/` subdir, not flat) |
| `OverlapToleranceCard` | 3-option select wired to `user_preferences.overlap_tolerance` | VERIFIED | `src/components/settings/preferences/OverlapToleranceCard.tsx` |
| `NotificationsSection` | 2 PrivacyToggleRow instances (notifyOnFollow + notifyOnWatchOverlap) | VERIFIED via 23-06 sub-plan | `src/components/settings/NotificationsSection.tsx` |
| `PrivacySection` | 3 PrivacyToggleRow instances (profilePublic + collectionPublic + wishlistPublic) | VERIFIED via 23-06 sub-plan | `src/components/settings/PrivacySection.tsx` |
| `AppearanceSection` | Hosts `InlineThemeSegmented` in `<SettingsSection title="Theme">` | VERIFIED | `src/components/settings/AppearanceSection.tsx` (26 LOC) |
| `InlineThemeSegmented` (lifted) | Same component used by UserMenu and AppearanceSection | VERIFIED at correct path | `src/components/layout/InlineThemeSegmented.tsx` (NOTE: NOT `src/components/theme/`) |
| `/preferences` redirect | Server-side redirect to `/settings#preferences` | VERIFIED via 23-06 sub-plan | `src/app/preferences/page.tsx` |
| `WatchForm` notesPublic pill | Public/Private pill below Notes textarea | VERIFIED (UI) | `src/components/watch/WatchForm.tsx:648-665` |
| `WatchForm` isChronometer Checkbox | Checkbox in Specifications card | VERIFIED | `src/components/watch/WatchForm.tsx:575-577` |
| `WatchDetail` Certification row | Only-if-true row with Check icon | VERIFIED | `src/components/watch/WatchDetail.tsx:287-295` |
| `actions/watches.ts` notesPublic Zod field | `notesPublic: z.boolean().optional()` in insertWatchSchema | **MISSING** (regression) | `src/app/actions/watches.ts` — field absent |
| `actions/watches.ts` revalidatePath call | `revalidatePath('/u/[username]', 'layout')` after addWatch + editWatch | **MISSING** (regression) | `src/app/actions/watches.ts` — call absent |

### Phase 23 Key Links (current main)

| From | To | Via | Status |
|------|----|-----|--------|
| `SettingsTabsShell.tsx` | `PreferencesSection` | TabsContent value="preferences" | WIRED (verified by 23-06 sub-plan) |
| `SettingsTabsShell.tsx` | `NotificationsSection` | TabsContent value="notifications" | WIRED |
| `SettingsTabsShell.tsx` | `PrivacySection` | TabsContent value="privacy" | WIRED |
| `SettingsTabsShell.tsx` | `AppearanceSection` | TabsContent value="appearance" | WIRED |
| `PreferencesSection` | `CollectionGoalCard` + `OverlapToleranceCard` + `PreferencesClient` | Direct JSX render | WIRED |
| `AppearanceSection` | `InlineThemeSegmented` | Direct JSX render of Client child | WIRED (Server-renders-Client pattern) |
| `WatchForm` | `addWatch` / `editWatch` | submit → action call (line 224-225) | WIRED, but contract has gap (notesPublic stripped) |
| `WatchForm` | per-row `NoteVisibilityPill` | Cross-page via `revalidatePath('/u/[username]', 'layout')` | **NOT WIRED** (call site missing) |

### Phase 23 Behavioral Spot-Checks (run by this researcher on current main)

| Behavior | Command | Result |
|----------|---------|--------|
| WatchForm Chronometer test | `npx vitest run tests/components/watch/WatchForm.isChronometer.test.tsx --reporter=basic` | 5/5 PASS |
| WatchDetail Chronometer test | `npx vitest run tests/components/watch/WatchDetail.isChronometer.test.tsx --reporter=basic` | 4/4 PASS |
| WatchForm notesPublic test | `npx vitest run tests/components/watch/WatchForm.notesPublic.test.tsx --reporter=basic` | 6/6 PASS (UI level only) |
| **actions notesPublic test** | `npx vitest run tests/actions/watches.notesPublic.test.ts --reporter=basic` | **0/4 PASS — 4 FAIL** (regression confirmed) |
| Preferences cards tests | `npx vitest run tests/components/settings/preferences/ --reporter=basic` | 0/3 PASS (test-infra bug — `useRouter` not mounted; not a contract regression) |
| AppearanceSection imports `InlineThemeSegmented` from layout | `grep -nE "InlineThemeSegmented" src/components/settings/AppearanceSection.tsx` | line 2 + line 23 |
| `/preferences` redirects | Cite `23-06-VERIFICATION.md` per D-07 | VERIFIED |

## Phase 24 Evidence Catalogue

### Phase 24 Success Criteria (5 from `v4.0-ROADMAP.md` lines 142-147)

| # | Truth | Required Evidence | Cited Source |
|---|-------|-------------------|--------------|
| 1 | Pre-flight assertion confirms zero rows reference `price_drop` or `trending_collector` BEFORE migration runs. | `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql:23-33` (DO $$ block raises EXCEPTION if rows exist outside `{follow, watch_overlap}`); `scripts/preflight-notification-types.ts` exists as the standalone Layer 1 preflight. | DEBT-03 |
| 2 | `notification_type` enum recreated without dead values via rename+recreate pattern. | Same migration file lines 62-76 (RENAME + CREATE TYPE + ALTER TABLE column type cast + DROP TYPE old). Post-migration assertion at lines 94-130 verifies enum has exactly 2 values + column references new type + dedup index recreated. | DEBT-04 |
| 3 | Render branches and stub UI for `price_drop` + `trending_collector` deleted across `src/`, `tests/`, `scripts/`, `seed/`. | `grep -rE "price_drop\|trending_collector" src/ tests/ scripts/` returns no live references; `src/db/schema.ts:31-34` shows enum narrowed to `['follow', 'watch_overlap']` with comment "Narrowed to 2 values in Phase 24 (DEBT-05) after prod migration applied"; `src/components/notifications/NotificationRow.tsx` contains no removed-enum branches. | DEBT-05 |
| 4 | 9 test files referencing `wornPublic` updated to `wear_visibility` enum; test suite green. | Audit (line 23) and v4.0-REQUIREMENTS.md FEAT-line 123 cite "4 files modified per D-04 dead-test-deletion rule". Verify on main: `grep -lrE "wornPublic\|wear_visibility" tests/` — currently 2 files reference `wear_visibility` (`tests/integration/phase11-schema.test.ts`, `tests/data/getWearRailForViewer.test.ts`); zero reference `wornPublic`. | DEBT-06 |
| 5 | `watchStore` filter reducer unit tests exist + `beforeEach` reset (TEST-04); `/api/extract-watch` integration coverage (TEST-05); `WatchForm` / `FilterBar` / `WatchCard` component tests exist (TEST-06). | TEST-04: `tests/store/watchStore.test.ts` 7/7 PASS. TEST-05: `tests/api/extract-watch.test.ts` 16/16 PASS. TEST-06: `tests/components/watch/WatchForm.test.tsx` 11/11 PASS, `tests/components/filters/FilterBar.test.tsx` 5/5 PASS, `tests/components/watch/WatchCard.test.tsx` 7/7 PASS. | TEST-04, TEST-05, TEST-06 |

### Phase 24 Required Artifacts

| Artifact | Path on current main | Status |
|----------|----------------------|--------|
| Phase 24 enum cleanup migration | `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` | VERIFIED (132 LOC) |
| Standalone preflight script | `scripts/preflight-notification-types.ts` | VERIFIED |
| Drizzle enum narrowed | `src/db/schema.ts:28-34` | VERIFIED (2 values: 'follow', 'watch_overlap') |
| watchStore unit tests | `tests/store/watchStore.test.ts` | VERIFIED (7 tests) |
| `/api/extract-watch` integration tests | `tests/api/extract-watch.test.ts` (NOTE: NOT `tests/app/api/`) | VERIFIED (16 tests) |
| `WatchForm` component tests | `tests/components/watch/WatchForm.test.tsx` | VERIFIED (11 tests) |
| `FilterBar` component tests | `tests/components/filters/FilterBar.test.tsx` | VERIFIED (5 tests) |
| `WatchCard` component tests | `tests/components/watch/WatchCard.test.tsx` | VERIFIED (7 tests) |
| PointerEvent polyfill in setup | `tests/setup.tsx` | VERIFIED (path is `tests/setup.tsx` not `tests/setup.ts` — Phase 29-06 renamed it) |

### Phase 24 Behavioral Spot-Checks (run on current main)

| Behavior | Command | Result |
|----------|---------|--------|
| watchStore filter reducer tests | `npx vitest run tests/store/watchStore.test.ts --reporter=basic` | 7/7 PASS |
| extract-watch integration tests | `npx vitest run tests/api/extract-watch.test.ts --reporter=basic` | 16/16 PASS |
| WatchForm component tests | `npx vitest run tests/components/watch/WatchForm.test.tsx --reporter=basic` | 11/11 PASS |
| FilterBar component tests | `npx vitest run tests/components/filters/FilterBar.test.tsx --reporter=basic` | 5/5 PASS |
| WatchCard component tests | `npx vitest run tests/components/watch/WatchCard.test.tsx --reporter=basic` | 7/7 PASS |
| Enum narrowed to 2 values | `grep -nE "notificationTypeEnum.*pgEnum" src/db/schema.ts && sed -n '31,34p' src/db/schema.ts` | Match at line 31; values are `'follow'`, `'watch_overlap'` |
| Migration filename matches Phase 24 pattern | `ls supabase/migrations/ \| grep phase24` | `20260501000000_phase24_notification_enum_cleanup.sql` |
| No `wornPublic` in tests | `grep -rlE "wornPublic" tests/` | (no matches) |
| `wear_visibility` in tests | `grep -lrE "wear_visibility" tests/` | `tests/integration/phase11-schema.test.ts`, `tests/data/getWearRailForViewer.test.ts` |
| No removed-enum branches | `grep -rE "price_drop\|trending_collector" src/ \| grep -v "comment\|history"` | (no live references) |

### Phase 24 Verdict
All 5 success criteria VERIFIED. All 7 REQ-IDs SATISFIED. No GAPs. No pending human UAT. Frontmatter `status: passed` per D-12.

## Per-Criterion Evidence Map (Phase 23)

| Success Criterion | REQ-IDs | Evidence Source | Verdict |
|-------------------|---------|-----------------|---------|
| #1 Preferences exposes collectionGoal + overlapTolerance | SET-07, SET-08 | `src/components/settings/PreferencesSection.tsx:1-2,25-26`; `src/components/settings/preferences/CollectionGoalCard.tsx`; `src/components/settings/preferences/OverlapToleranceCard.tsx` | VERIFIED (code level); UAT items 1+2 pending per D-11 |
| #2 Notifications exposes notifyOnFollow + notifyOnWatchOverlap | SET-09 | `git show 9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md` §"SET-09" | VERIFIED (no-diff carryover from Phase 22 D-01) |
| #3 Privacy + Appearance | SET-10, SET-11 | SET-11: `git show 9d87293^:.../23-06-VERIFICATION.md` §"SET-11"; SET-10: `src/components/settings/AppearanceSection.tsx:2,23` (imports `InlineThemeSegmented` from `@/components/layout/InlineThemeSegmented`); `src/components/layout/InlineThemeSegmented.tsx` exists | VERIFIED (code level); UAT item 3 (theme cross-surface sync) pending per D-11 |
| #4 notesPublic toggle (FEAT-07) | FEAT-07 | UI: `src/components/watch/WatchForm.tsx:648-665`. **Server action gap:** `grep -nE "notesPublic" src/app/actions/watches.ts` returns no matches; `tests/actions/watches.notesPublic.test.ts` 0/4 PASS; `git merge-base --is-ancestor 4d362ff HEAD` returns 1 (NOT ancestor). | **GAP** — UI works, server-side persistence + revalidation missing on main; UAT item 4 cannot pass while gap exists |
| #5 isChronometer toggle + display (FEAT-08) | FEAT-08 | `src/components/watch/WatchForm.tsx:81,125,575-577`; `src/components/watch/WatchDetail.tsx:287-295`; tests 5/5 + 4/4 PASS | VERIFIED (code level); UAT item 5 pending per D-11 |

| Bonus REQ | Source | Verdict |
|-----------|--------|---------|
| SET-12 (`/preferences` redirect) | `git show 9d87293^:.../23-06-VERIFICATION.md` §"SET-12"; `src/app/preferences/page.tsx` exists on main | VERIFIED (no-diff carryover from Phase 22 D-15) |

## Per-Criterion Evidence Map (Phase 24)

| Success Criterion | REQ-IDs | Evidence Source | Verdict |
|-------------------|---------|-----------------|---------|
| #1 Pre-flight assertion | DEBT-03 | `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql:23-33` (DO $$ EXCEPTION block); `scripts/preflight-notification-types.ts` standalone script | VERIFIED |
| #2 ENUM rename+recreate | DEBT-04 | Migration lines 62-76 (RENAME + CREATE TYPE + ALTER COLUMN + DROP TYPE old) + lines 94-130 (post-migration assertion: enum count = 2, column references new type, partial dedup index recreated). T-24-PARTIDX surgery at lines 36-55 (DROP INDEX before rename, CREATE INDEX after type swap). Cross-reference `~/.claude/projects/.../memory/project_drizzle_supabase_db_mismatch.md` for the enum-bound dependent surgery pattern. | VERIFIED |
| #3 Render branches deleted | DEBT-05 | `src/db/schema.ts:28-34` enum narrowed to 2 values with comment "Narrowed to 2 values in Phase 24 (DEBT-05) after prod migration applied"; no `price_drop`/`trending_collector` live references in `src/`. | VERIFIED |
| #4 wornPublic fixture migration | DEBT-06 | `grep -rlE "wornPublic" tests/` returns no matches; `grep -lrE "wear_visibility" tests/` returns 2 files (phase11-schema, getWearRailForViewer). v4.0-REQUIREMENTS.md FEAT-line 123 cites "4 files modified per D-04 dead-test-deletion rule" — drift from "9 files updated" SUMMARY language; the dead-test-deletion narrowed scope. | VERIFIED with footnote (4 files modified, others deleted) |
| #5 Test suites carryover | TEST-04, TEST-05, TEST-06 | TEST-04: `tests/store/watchStore.test.ts` 7/7 PASS. TEST-05: `tests/api/extract-watch.test.ts` 16/16 PASS. TEST-06: `tests/components/watch/WatchForm.test.tsx` 11/11 PASS, `FilterBar.test.tsx` 5/5 PASS, `WatchCard.test.tsx` 7/7 PASS. | VERIFIED (51 tests total across all 5 files PASS) |

## Code Examples

### Reading historical artifacts at `9d87293^`

```bash
# Read 23-06-VERIFICATION.md (the no-diff sub-plan covering SET-09/11/12)
git show 9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md

# Read 23-HUMAN-UAT.md to extract the 5 pending items per D-11
git show 9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-HUMAN-UAT.md

# Read Phase 22's canonical VERIFICATION.md for structural template per D-05
git show 2918e95:.planning/phases/22-settings-restructure-account-section/22-VERIFICATION.md

# Read Phase 23 CONTEXT for decision basis (only when needed for evidence claims)
git show 9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-CONTEXT.md
```

### Drift detection per D-04

```bash
# Phase 23 surfaces
git log --oneline 5991c3f..HEAD -- \
  src/components/settings/ \
  src/components/settings/preferences/ \
  src/components/watch/WatchForm.tsx \
  src/components/watch/WatchDetail.tsx \
  src/app/actions/watches.ts \
  src/app/preferences/page.tsx \
  src/components/layout/InlineThemeSegmented.tsx

# Phase 24 surfaces
git log --oneline 5991c3f..HEAD -- \
  src/db/schema.ts \
  src/components/notifications/NotificationRow.tsx \
  tests/store/watchStore.test.ts \
  tests/api/extract-watch.test.ts \
  tests/components/watch/WatchForm.test.tsx \
  tests/components/filters/FilterBar.test.tsx \
  tests/components/watch/WatchCard.test.tsx \
  supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql
```

### Verifying cited commits actually reach main

```bash
# Reproduce the FEAT-07 regression detection
git merge-base --is-ancestor 4d362ff HEAD; echo $?
# Returns 1 → NOT an ancestor → commit is on a sidebranch only.

git merge-base --is-ancestor 5675bf5 HEAD; echo $?
# Returns 1 → "merge executor worktree 23-06" never reached main.

git merge-base --is-ancestor 1df6c2a HEAD; echo $?
# Returns 0 → "phase-23 complete" doc commit IS on main (but the underlying code commits aren't).
```

### Frontmatter `human_verification` array shape (D-11 pattern)

Lifted verbatim from Phase 22-VERIFICATION.md (commit `2918e95`):

```yaml
human_verification:
  - test: "Email change end-to-end with real Resend SMTP"
    expected: "On Account tab, submit a new email address; receive confirmation links at BOTH old and new addresses; banner copy 'Confirmation sent to <strong>old@</strong> and <strong>new@</strong>. Click both links to complete the change.' appears immediately; ..."
    why_human: "Requires live Resend SMTP delivery, real Supabase verifyOtp token round-trip, and visual confirmation of toast firing. Phase 21 wired Resend; Phase 22 wires the UX. Tests stub the network layer."
```

For the 5 Phase 23 carryover items, the existing 23-HUMAN-UAT.md prose maps to this shape:
- `test`: the section heading (e.g. "Preferences persistence + brand-loyalist option")
- `expected`: the existing `expected:` line content + the existing `test:` step content (combine for context)
- `why_human`: synthesize 1-2 sentences per item (e.g. for theme cross-surface sync: "Requires real cookie round-trip + DOM repaint observation across two surfaces. JSDOM cookie semantics + ThemeProvider context boundaries cannot be reliably exercised by RTL.").

### Append-only Closure section (D-08 pattern)

```markdown
---

## Closure (2026-05-XX — Phase 31 v4.0 Verification Backfill)

The v4.0 verification asymmetry recorded in this audit (lines 17-24) is now closed. Phase 31 produced two phase-level verification artifacts:

- `.planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md` — score: <fill at write time>; status: human_needed (5 UAT items pending per audit line 18). [Optional: surfaces a FEAT-07 implementation regression — commit `4d362ff` cited at audit line 111 is not an ancestor of HEAD; documented as a Gap in the new artifact and tracked as new follow-up tech_debt.]
- `.planning/milestones/v4.0-phases/24-notification-stub-cleanup-test-fixture-carryover/24-VERIFICATION.md` — score: 5/5 success criteria PASS; status: passed.

v4.0 audit asymmetry resolved. Remaining tech_debt items (23-05 SUMMARY, VALIDATION frontmatter, Phase 999.1 archival, traceability table staleness, ~33 human UAT) remain as documented in the original tech_debt block above and are out of Phase 31 scope.

_Closed: 2026-05-XX_
_Phase: 31-v4-0-verification-backfill_
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Verification artifacts in `.planning/phases/<n>-<slug>/<n>-VERIFICATION.md` (active dir) | Same shape, but for retrospectively-audited milestones, archive at `.planning/milestones/<vN>-phases/<n>-<slug>/<n>-VERIFICATION.md` | Phase 31 introduces this convention | Sets precedent for Phase 999.1 (v3.0 hygiene) and future milestone close audits |
| Audit closure embedded in audit body | Append-only `## Closure` section at bottom | Phase 31 introduces this convention | Audit body remains a frozen snapshot; closure is the chronological postscript |
| Phase audits run before phase exits via `/gsd-verify-work` | Goal-backward audit run retrospectively, post-milestone, with `9d87293^` as the artifact baseline | Phase 31 (first instance) | Establishes the post-hoc audit pattern for any future milestone where a phase-level VERIFICATION.md is missing |

**Deprecated/outdated:**
- The audit's "shipped via commit X" pattern when X is sourced from a workplan rather than verified against shipped main. Phase 31's research demonstrates this can hide regressions (FEAT-07). Future audits should `git merge-base --is-ancestor` every cited commit before recording it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `useFormFeedback` `useRouter` failure in `tests/components/settings/preferences/` is test-infra debt, not a contract regression. | Pitfall 6, Phase 23 Behavioral Spot-Checks | If the components actually fail at runtime (not just in tests), SET-07 / SET-08 also have a regression. **Mitigation:** Planner can manually verify the components render correctly on `/settings#preferences` in dev (`npm run dev` + visit `/settings#preferences` + click a Select option); also covered by UAT item 1. Recommended: add a planner spot-check task. [ASSUMED] |
| A2 | The 4 Phase 24 fixture files modified satisfy DEBT-06 even though v4.0-ROADMAP.md §"Phase 24" success criterion #4 says "9 test files updated". | Phase 24 Evidence Catalogue, criterion #4 | If 9 files were the contract, and only 4 ship, DEBT-06 is partially unmet. v4.0-REQUIREMENTS.md line 123 explicitly says "9 test files referencing the removed wornPublic column are updated to use the v3.0 wear_visibility enum — Phase 24 (Validated; 4 files modified per D-04 dead-test-deletion rule)" — the parenthetical reconciles 9→4 via dead-test-deletion. [CITED: v4.0-REQUIREMENTS.md:123] |
| A3 | Frontmatter `human_verification:` key should be omitted entirely when no items exist (Phase 24 case per D-12). | Architecture Patterns Pattern 1 | Phase 22 + Phase 30 both have items, so neither is a precedent for the empty case. Empty array `[]` would also be valid. Either choice is harmless. [ASSUMED] |
| A4 | "Score format" recommendation `4/5 success criteria VERIFIED + 1 GAP` is acceptable per D-discretion. | Architecture Patterns Pattern 13 | CONTEXT D-discretion says "Phase 22 used `5/5 must-haves verified`; Phase 30 used `3/3 success criteria PASS`. Either form is fine; planner picks per phase based on which reads more naturally." A new shape (X/Y + GAP) extends the precedent but stays within "either form is fine". [ASSUMED — within D-discretion latitude] |
| A5 | The `4d362ff` commit's content was definitely not delivered to main by some other route (e.g., a different commit re-introduced the same change). | Critical regression — FEAT-07 | Verified by `git log --all --oneline --reverse -p -S "notesPublic" -- src/app/actions/watches.ts` returning ONLY `4d362ff`. Also confirmed by direct grep on current `src/app/actions/watches.ts` finding zero `notesPublic` matches. **No other commit added this content.** [VERIFIED: git log -S, grep on current main] |
| A6 | The v4.0 ship commit `5991c3f` itself shipped without `notesPublic` in `actions/watches.ts`. | Critical regression — FEAT-07 | `git show 5991c3f:src/app/actions/watches.ts \| grep -nE "notesPublic"` returns no matches. The regression was already present at v4.0 close, not introduced by v4.1. [VERIFIED: git show + grep] |

## Open Questions

1. **Should the FEAT-07 regression spawn a remediation task in v4.1 or be tracked as a new DEBT-09 for v5.0?**
   - What we know: Phase 31's scope per D-Out-of-scope is "no production code changes." Adding `notesPublic` back to the schema + revalidatePath would be production code.
   - What's unclear: Whether the user wants this papered over (audit documents but doesn't fix) or fixed inline as part of the audit closure.
   - Recommendation: Surface the regression in 23-VERIFICATION.md as a Gap; the `## Closure` section in v4.0-MILESTONE-AUDIT.md notes the new tech_debt; planner asks the user during plan review whether to add a remediation task. **DO NOT silently fix it** — the audit's value is in revealing what shipped, including what shipped broken.

2. **What's the exact wording the user wants for the "FEAT-07 GAP" framing?**
   - What we know: The audit was generous; calling out the regression bluntly may feel adversarial.
   - What's unclear: Whether the user prefers Option A (separate GAP row), Option B (split status), or Option C (silent re-derivation).
   - Recommendation: Default to Option A (most honest); the planner offers Option B as an alternative if the user prefers softer framing during plan review.

3. **Does the new `## Closure` section need a verification step of its own?**
   - What we know: D-08 says "append-only update" — no verifier audit on the audit. But the Closure refers to two new files; if those paths don't exist, the closure is broken.
   - What's unclear: Whether `/gsd-verify-work 31` will check the closure section's path-existence claim.
   - Recommendation: Planner has the executor verify path existence after writing the two VERIFICATION.md files BEFORE writing the closure section, so the closure can cite paths it has confirmed exist.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | All — D-03 historical reads + D-04 drift detection | ✓ | system git | — |
| node | vitest test runs | ✓ | /opt/homebrew/bin/node | — |
| npx vitest | Behavioral spot-checks per D-06 | ✓ (vitest 2.1.9 in package.json) | 2.1.9 | — |
| grep | Match-with-line evidence per D-06 | ✓ | system grep | — |

**No external services required.** No Anthropic API. No Supabase. No browser. Audit is filesystem + git only.

## Validation Architecture

`workflow.nyquist_validation` not set in `.planning/config.json` (`.planning/config.json` does not exist). Treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 |
| Config file | `vitest.config.ts` (assumed; not opened in this research; standard Next.js + Vitest setup) |
| Quick run command | `npx vitest run <specific-file> --reporter=basic` |
| Full suite command | `npm test` (or `npx vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DEBT-07 | 23-VERIFICATION.md exists at correct archive path with canonical Phase 22 shape | manual file-existence + structure check | `test -f .planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md` then visual review against Phase 22 shape | ❌ Phase 31 creates it |
| DEBT-08 | 24-VERIFICATION.md exists at correct archive path with canonical Phase 22 shape | manual file-existence + structure check | `test -f .planning/milestones/v4.0-phases/24-notification-stub-cleanup-test-fixture-carryover/24-VERIFICATION.md` then visual review | ❌ Phase 31 creates it |
| DEBT-07 / DEBT-08 cross-cut | Closure section appended to audit | manual diff inspection | `git diff .planning/milestones/v4.0-MILESTONE-AUDIT.md` shows only addition at bottom; no edits to audit body | ❌ Phase 31 appends |

### Sampling Rate
- **Per task commit:** Visual review of the new VERIFICATION.md content for canonical Phase 22 structure compliance (frontmatter keys, table column headers, section ordering).
- **Per wave merge:** N/A (single executor recommended).
- **Phase gate:** Both VERIFICATION.md files exist at the D-01 paths; `git diff v4.0-MILESTONE-AUDIT.md` shows append-only edit; `gsd-verify-work 31` produces a `passed` Phase 31-VERIFICATION.md.

### Wave 0 Gaps
- None — no test infrastructure needed for a documentation phase. Audit's evidence runs (vitest + git + grep) use existing infrastructure already in repo.

*If no gaps: existing test infrastructure is sufficient because Phase 31 produces no production code; the test commands run by the auditor are direct invocations of existing tests written in earlier phases.*

## Security Domain

`security_enforcement` not explicitly set in config (config absent → enabled by default).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Phase 31 writes Markdown only — no authn surfaces touched |
| V3 Session Management | no | No session code changes |
| V4 Access Control | no | No access control code changes |
| V5 Input Validation | no | No new input surfaces; no Zod/schema changes |
| V6 Cryptography | no | No crypto changes |

### Known Threat Patterns for documentation-phase work

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Audit document misrepresents shipped state (false positive — claims correctness that does not hold on main) | Repudiation | Verify cited commits via `git merge-base --is-ancestor` before citing; run referenced tests for current pass count; cite test paths verbatim |
| Audit document misrepresents shipped state (false negative — claims regression that does not hold) | Repudiation | Same controls as above; multiple evidence sources per claim per D-06 |
| Append-only audit closure inadvertently rewrites earlier audit content | Tampering | Use `Edit` tool only for append at bottom; verify with `git diff` showing only added lines |

**Phase 31 is essentially read-only against `src/`.** No data flows are introduced. No authentication surfaces are touched. Security domain is minimal — primary integrity concern is documentation accuracy, addressed by the evidence-citing protocol per D-06.

## Sources

### Primary (HIGH confidence)
- `git show 2918e95:.planning/phases/22-settings-restructure-account-section/22-VERIFICATION.md` — canonical VERIFICATION.md format reference per D-05. Read fully (~250 lines).
- `git show 9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md` — sub-plan no-diff verification covering SET-09/11/12 per D-07. Read fully.
- `git show 9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-HUMAN-UAT.md` — 5 pending UAT items per D-11. Read fully (51 lines).
- `.planning/phases/30-wywt-capture-alignment-fix/30-VERIFICATION.md` — recent live in-repo example of VERIFICATION.md format with alternative scoring shape. Read fully (235 lines).
- `.planning/milestones/v4.0-MILESTONE-AUDIT.md` — the audit being closed. Read fully.
- `.planning/milestones/v4.0-ROADMAP.md` §"Phase 23" / §"Phase 24" — success criteria + REQ-ID source-of-truth.
- `.planning/milestones/v4.0-REQUIREMENTS.md` — full SET-07..12 / FEAT-07/08 / DEBT-03..06 / TEST-04..06 requirement bodies.
- `git log --all --oneline -p -S "notesPublic" -- src/app/actions/watches.ts` — proves only `4d362ff` ever introduced the field; no other commit on main re-added it.
- `git merge-base --is-ancestor <commit> HEAD` — used to verify which Phase 23 commits actually reached main.
- `npx vitest run <file>` — used to capture live pass/fail counts on current main.
- Direct `grep -n` on current `src/` files — used to verify path correctness and content presence on current main.

### Secondary (MEDIUM confidence)
- N/A — all sources are repository-local and verifiable.

### Tertiary (LOW confidence)
- N/A — no external sources required for a documentation phase.

## Metadata

**Confidence breakdown:**
- Canonical format (Phase 22 template): HIGH — read verbatim from git, structure documented section-by-section.
- Phase 23 evidence catalogue: HIGH — every claim verified against current main via grep + tests.
- Phase 24 evidence catalogue: HIGH — every claim verified; 5/5 success criteria + 7 REQ-IDs PASS.
- FEAT-07 regression finding: HIGH — confirmed via 3 independent methods (commit ancestry check, grep on current main, vitest run on the FEAT-07 RED test).
- Drift inventory: HIGH — exhaustive `git log --oneline 5991c3f..HEAD -- <surface>` for all Phase 23/24 surfaces.
- Path drift in CONTEXT.md: HIGH — verified by `find` and direct `ls`.
- D-12 frontmatter shape (empty `human_verification`): MEDIUM — no precedent in repo, but harmless either way.

**Research date:** 2026-05-05
**Valid until:** 2026-05-19 (14 days — stable, but if anyone modifies Phase 23/24 surfaces or re-runs `git push` that lands the missing `4d362ff`-equivalent, drift detection needs re-running).

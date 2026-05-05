---
phase: 23-settings-sections-schema-field-ui
verified: 2026-05-05T23:47:14Z
status: human_needed
score: "4/5 success criteria VERIFIED + 1 GAP (FEAT-07 server-action regression)"
overrides_applied: 0
closes_audit_items:
  - .planning/milestones/v4.0-MILESTONE-AUDIT.md#L17  # "No phase-level 23-VERIFICATION.md — only sub-plan 23-06-VERIFICATION.md exists"
  - .planning/milestones/v4.0-MILESTONE-AUDIT.md#L19  # "23-HUMAN-UAT.md status: partial — 5 tests pending human sign-off"
human_verification:
  - test: "Preferences persistence + brand-loyalist option"
    expected: "Selected option remains 'Brand Loyalist' after refresh; saving indicator briefly visible; no error banner"
    why_human: "Requires real cookie/localStorage round-trip across a page reload + visual confirmation of saving indicator. JSDOM cookie semantics + RTL rerender boundaries cannot reliably exercise the persist-then-refresh flow."
  - test: "analyzeSimilarity reads new preference on next read"
    expected: "Verdict label changes (e.g. fewer Hard Mismatch flags) — confirms analyzeSimilarity() reads the new preference on next render"
    why_human: "Requires real preference write → real watch detail re-render with the new preference value influencing the similarity verdict. End-to-end semantic check across two surfaces; cannot be programmatically asserted without a full integration harness."
  - test: "Cross-surface theme sync (D-06 duplicate-by-design)"
    expected: "Both surfaces stay in sync via the horlo-theme cookie; no flash of unstyled content; theme changes immediately"
    why_human: "Requires real cookie round-trip + DOM repaint observation across two surfaces (AppearanceSection + UserMenu InlineThemeSegmented). JSDOM cookie semantics + ThemeProvider context boundaries cannot be reliably exercised by RTL."
  - test: "notesPublic cross-page revalidation (D-19)"
    expected: "Cross-page revalidation works: revalidatePath('/u/[username]', 'layout') invalidates the user-scoped layout cache so the per-row pill re-renders with the new visibility immediately"
    why_human: "Requires Next.js layout-level revalidation across two routes (/watch/[id]/edit → /u/{username}/notes) — but see Gaps Summary: this UAT cannot pass while the FEAT-07 server-action regression is unresolved (the revalidatePath call site is absent on current main)."
  - test: "Chronometer end-to-end (Checkbox toggle → Certification row appears)"
    expected: "Row renders only when isChronometer === true; lucide Check icon at text-foreground (NOT text-accent); gap-1 between icon and label"
    why_human: "Visual rendering verification across the WatchForm submit path → WatchDetail re-render. Component tests cover unit behavior; the end-to-end visual confirmation in the live app remains a human check."
---

# Phase 23: Settings Sections + Schema-Field UI — Verification Report

**Phase Goal:** The five Settings sections beyond Account are populated with the schema-driven knobs that exist in the database today but have no user-facing edit surface — exposing `collectionGoal`, `overlapTolerance`, `notifyOnFollow`/`notifyOnWatchOverlap`, theme switch, privacy toggles, plus per-note `notesPublic` and `isChronometer` on watches. (Verbatim from `.planning/milestones/v4.0-ROADMAP.md` §"Phase 23".)
**Verified:** 2026-05-05T23:47:14Z
**Status:** human_needed
**Re-verification:** No — initial verification (post-hoc audit, retroactive close of `.planning/milestones/v4.0-MILESTONE-AUDIT.md` lines 17-22).

This artifact closes audit gap "No phase-level 23-VERIFICATION.md — only sub-plan 23-06-VERIFICATION.md exists" (audit line 17). It produces evidence-cited verdicts for all 5 v4.0-ROADMAP.md Phase 23 success criteria and all 8 REQ-IDs (SET-07/08/09/10/11/12 + FEAT-07/08), and carries the 5 pending Phase 23 human-UAT items (audit line 18) into the frontmatter `human_verification` array. The audit is goal-backward against current `main`; the FEAT-07 server-action regression surfaced below is the most consequential finding.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The Preferences section exposes a `collectionGoal` select (balanced / specialist / variety-within-theme / brand-loyalist) and an `overlapTolerance` select (low / medium / high), both wired to `user_preferences` and reflected by `analyzeSimilarity()` on next read. (SET-07, SET-08) | VERIFIED (code level) | `src/components/settings/PreferencesSection.tsx:1-2` imports `CollectionGoalCard` + `OverlapToleranceCard` from `./preferences/`; `src/components/settings/PreferencesSection.tsx:25-26` renders both as top-of-tab Cards. `src/components/settings/preferences/CollectionGoalCard.tsx` exists (NOTE: actual path is `preferences/` subdir, NOT flat under `settings/`). `src/components/settings/preferences/OverlapToleranceCard.tsx` exists. Human UAT items #1 and #2 pending per `human_verification` (real-cookie persistence + analyzeSimilarity re-read are end-to-end). |
| 2 | The Notifications section exposes UI toggles for `notifyOnFollow` and `notifyOnWatchOverlap`. (SET-09) | VERIFIED (no-diff carryover via 23-06 sub-plan) | Cite `git show 9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md` §"SET-09 — NotificationsSection (D-08, no diff)" — verdict VERIFIED, evidence is grep on `src/components/settings/NotificationsSection.tsx` showing 2 PrivacyToggleRow instances (`notifyOnFollow` + `notifyOnWatchOverlap`) inside `<SettingsSection title="Email notifications">`. Per D-07: single-line citation, not re-derived. |
| 3 | The Privacy section retains existing toggles, restyled into the vertical-tabs frame; the Appearance section houses the theme switch (lifted from UserMenu's `<InlineThemeSegmented>`). (SET-10, SET-11) | VERIFIED (code level) | **SET-11 (Privacy):** cite `git show 9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md` §"SET-11 — PrivacySection (D-08, no diff)" per D-07 — 3 PrivacyToggleRow instances (profilePublic + collectionPublic + wishlistPublic) inside `<SettingsSection title="Visibility">`. **SET-10 (Appearance):** `src/components/settings/AppearanceSection.tsx:2,23` — line 2 imports `InlineThemeSegmented` from `@/components/layout/InlineThemeSegmented` (NOTE: actual path is `src/components/layout/`, NOT `src/components/theme/` — the path drift is documented in the research notes for this artifact); line 23 renders `<InlineThemeSegmented />` inside `<SettingsSection title="Theme">`. Human UAT item #3 (cross-surface sync) pending per `human_verification`. |
| 4 | The owner can toggle `notesPublic` per-note from the WatchForm and from the per-row note edit surface. (FEAT-07) | **GAP** | UI works at the form level: `src/components/watch/WatchForm.tsx:648-665` renders the Public/Private pill (`role="switch"` + `aria-checked={formData.notesPublic === true}`) below the Notes textarea; `src/components/profile/NoteVisibilityPill.tsx` renders the per-row pill. UI tests are GREEN: `tests/components/watch/WatchForm.notesPublic.test.tsx` 6/6 PASS. **Server-action gap:** `git merge-base --is-ancestor 4d362ff HEAD; echo $?` returns **1** — commit `4d362ff` (cited by audit line 111 + v4.0-REQUIREMENTS.md line 93 as the FEAT-07 implementation evidence) is NOT an ancestor of HEAD. `grep -nE "notesPublic\|notes_public" src/app/actions/watches.ts` returns no matches — the Zod `insertWatchSchema` lacks `notesPublic`; WatchForm sends the field via `...formData` spread (line 217) and Zod silently strips it at the action boundary. `grep -nE "revalidatePath\('/u/" src/app/actions/watches.ts` returns no matches — the cross-page sync `revalidatePath('/u/[username]', 'layout')` that the audit and 23-HUMAN-UAT.md item #4 describe does NOT exist on main. `npx vitest run tests/actions/watches.notesPublic.test.ts --reporter=basic` returns **0/4 PASS — 4 FAIL** (the Phase 23-05 RED test scaffold is RED on main: assertions on Zod non-boolean rejection + `revalidatePath` invocation both fail). Server-side persistence + cross-page sync did not ship.<br/><br/>_Drift footnote (per D-04):_ Phase 28-05 commit `fbe3522 feat(28-05): rewrite AddWatchFlow + WatchForm commit handlers (UX-09 + ADD-08)` rewrote the WatchForm submit path. The handler rewrite did NOT introduce the gap — the gap was already present at the v4.0 ship commit `5991c3f` (verified: `git show 5991c3f:src/app/actions/watches.ts \| grep -nE "notesPublic"` returns no matches, per RESEARCH Assumption A6). Phase 27-02 commit `aaf66a4 feat(27-02): wire sort_order assignment` added `sortOrder` to `actions/watches.ts` — additive only; does NOT remove any Phase 23 contract. |
| 5 | The owner can toggle `isChronometer` in WatchForm and see it displayed in WatchDetail. (FEAT-08) | VERIFIED (code level) | `src/components/watch/WatchForm.tsx:81` `isChronometer: false` (default unchecked for new watches per Phase 23 D-09); `src/components/watch/WatchForm.tsx:125` `isChronometer: watch.isChronometer ?? false` (edit hydration); `src/components/watch/WatchForm.tsx:575-577` Checkbox with `checked={formData.isChronometer === true}` + `onCheckedChange` setter. `src/components/watch/WatchDetail.tsx:287-295` Certification row gated on strict `watch.isChronometer === true` (legacy null rows do NOT render); `<Check className="size-4 text-foreground" />` icon (NOT `text-accent` — verified per Phase 23 D-11) with `gap-1` between icon and label "Chronometer". Tests GREEN: `tests/components/watch/WatchForm.isChronometer.test.tsx` 5/5 PASS; `tests/components/watch/WatchDetail.isChronometer.test.tsx` 4/4 PASS. Human UAT item #5 (visual end-to-end) pending per `human_verification`.<br/><br/>_Drift footnote (per D-04):_ Phase 28-05 commit `fbe3522` rewrote the WatchForm submit path; the `isChronometer` Checkbox + `false` default + edit hydration semantics survived the rewrite (test pass counts unchanged from v4.0 ship). |

> **Score:** 4/5 success criteria VERIFIED + 1 GAP (FEAT-07 server-action regression). The GAP is the FEAT-07 server-action regression: WatchForm pill UI shipped, but the server-side persistence (Zod schema acceptance) + cross-page sync (`revalidatePath('/u/[username]', 'layout')`) did not. See `### Gaps Summary` below for the new follow-up tech_debt recommendation.

### Required Artifacts

| Artifact | Expected | Status | Path on Current Main |
|----------|----------|--------|----------------------|
| Preferences section component | Composes 2 top cards + embedded PreferencesClient (Server Component) | VERIFIED | `src/components/settings/PreferencesSection.tsx` (Server Component; renders `<CollectionGoalCard>` + `<OverlapToleranceCard>` then "Taste preferences" divider then `<PreferencesClient>`) |
| `CollectionGoalCard` | 4-option select wired to `user_preferences.collection_goal` | VERIFIED | `src/components/settings/preferences/CollectionGoalCard.tsx` (NOTE: `preferences/` subdir, NOT flat under `settings/`) |
| `OverlapToleranceCard` | 3-option select wired to `user_preferences.overlap_tolerance` | VERIFIED | `src/components/settings/preferences/OverlapToleranceCard.tsx` |
| `NotificationsSection` | 2 PrivacyToggleRow instances (`notifyOnFollow` + `notifyOnWatchOverlap`) inside SettingsSection | VERIFIED via 23-06 sub-plan (D-07) | `src/components/settings/NotificationsSection.tsx` |
| `PrivacySection` | 3 PrivacyToggleRow instances (`profilePublic` + `collectionPublic` + `wishlistPublic`) | VERIFIED via 23-06 sub-plan (D-07) | `src/components/settings/PrivacySection.tsx` |
| `AppearanceSection` | Hosts `InlineThemeSegmented` inside `<SettingsSection title="Theme">` | VERIFIED | `src/components/settings/AppearanceSection.tsx` (Server Component; renders Client child) |
| `InlineThemeSegmented` (lifted) | Same component used by UserMenu and AppearanceSection | VERIFIED at correct path | `src/components/layout/InlineThemeSegmented.tsx` (NOTE: `layout/`, NOT `theme/` — path drift documented for future readers) |
| `/preferences` redirect | Server-side redirect to `/settings#preferences` | VERIFIED via 23-06 sub-plan (D-07) | `src/app/preferences/page.tsx` (`redirect('/settings#preferences')`) |
| `WatchForm` notesPublic pill | Public/Private pill below Notes textarea (FEAT-07 UI) | VERIFIED (UI level only) | `src/components/watch/WatchForm.tsx:648-665` |
| `WatchForm` isChronometer Checkbox | Checkbox in Specifications card (FEAT-08) | VERIFIED | `src/components/watch/WatchForm.tsx:575-577` |
| `WatchDetail` Certification row | Only-if-true row with `lucide-react` Check icon at `text-foreground` (FEAT-08) | VERIFIED | `src/components/watch/WatchDetail.tsx:287-295` |
| `actions/watches.ts` notesPublic Zod field | `notesPublic: z.boolean().optional()` in `insertWatchSchema` (FEAT-07 server contract) | **MISSING** (regression) | `src/app/actions/watches.ts` — field absent. `grep -nE "notesPublic\|notes_public" src/app/actions/watches.ts` returns no matches. WatchForm sends the value; Zod strips it. |
| `actions/watches.ts` revalidatePath call | `revalidatePath('/u/[username]', 'layout')` after `addWatch` + `editWatch` (FEAT-07 cross-page sync) | **MISSING** (regression) | `src/app/actions/watches.ts` — call absent. `grep -nE "revalidatePath\('/u/" src/app/actions/watches.ts` returns no matches. Per-row `<NoteVisibilityPill>` cannot re-render after edit. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SettingsTabsShell.tsx` | `PreferencesSection` | `<TabsContent value="preferences">` → `<PreferencesSection>` | WIRED | Verified via 23-06-VERIFICATION.md "SettingsTabsShell composes all 6 sections" sanity grep (D-07). |
| `SettingsTabsShell.tsx` | `NotificationsSection` | `<TabsContent value="notifications">` | WIRED | Same source as above. |
| `SettingsTabsShell.tsx` | `PrivacySection` | `<TabsContent value="privacy">` | WIRED | Same source as above. |
| `SettingsTabsShell.tsx` | `AppearanceSection` | `<TabsContent value="appearance">` | WIRED | Same source as above. |
| `PreferencesSection` | `CollectionGoalCard` + `OverlapToleranceCard` + `PreferencesClient` | Direct JSX render of two top Cards then divider then embedded Client | WIRED | `src/components/settings/PreferencesSection.tsx:25-26,30+` — both Cards render before the "Taste preferences" divider. |
| `AppearanceSection` | `InlineThemeSegmented` | Direct JSX render of Client child (Server-renders-Client pattern) | WIRED | `src/components/settings/AppearanceSection.tsx:2,23`. |
| `WatchForm` | `addWatch` / `editWatch` server actions | Submit handler invokes Zod-validated action | WIRED, but contract has gap | `notesPublic` is sent in payload but stripped by Zod (FEAT-07 GAP); `isChronometer` flows through correctly (FEAT-08 VERIFIED). |
| `WatchForm` | per-row `NoteVisibilityPill` (cross-page) | `revalidatePath('/u/[username]', 'layout')` on `addWatch` + `editWatch` success | **NOT WIRED** | Call site missing on current main. The per-row pill cannot re-render after an edit until DEBT-09 (recommended below) lands. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| WatchForm Chronometer test (FEAT-08) | `npx vitest run tests/components/watch/WatchForm.isChronometer.test.tsx --reporter=basic` | `Test Files 1 passed (1) / Tests 5 passed (5)` | PASS |
| WatchDetail Chronometer test (FEAT-08) | `npx vitest run tests/components/watch/WatchDetail.isChronometer.test.tsx --reporter=basic` | `Test Files 1 passed (1) / Tests 4 passed (4)` | PASS |
| WatchForm notesPublic UI test (FEAT-07 UI level) | `npx vitest run tests/components/watch/WatchForm.notesPublic.test.tsx --reporter=basic` | `Test Files 1 passed (1) / Tests 6 passed (6)` | PASS |
| **actions notesPublic test (FEAT-07 server level)** | `npx vitest run tests/actions/watches.notesPublic.test.ts --reporter=basic` | `Test Files 1 failed (1) / Tests 4 failed (4)` — Zod non-boolean rejection assertion fails (`expect(result.success).toBe(false)` got `true`); revalidatePath assertion fails | **FAIL** (regression confirmed) |
| Preferences cards tests (auxiliary) | `npx vitest run tests/components/settings/preferences/ --reporter=basic` | `Test Files 2 failed (2) / Tests 7 failed (7)` — fails at `useFormFeedback` calling `useRouter()` without an AppRouter mock | FAIL (test-infra, NOT contract — see Anti-Patterns Found) |
| AppearanceSection imports `InlineThemeSegmented` from layout | `grep -nE "InlineThemeSegmented" src/components/settings/AppearanceSection.tsx` | line 2 (`import ... from '@/components/layout/InlineThemeSegmented'`) + line 23 (`<InlineThemeSegmented />`) | PASS |
| `/preferences` server redirect | Cite `git show 9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md` §"SET-12" per D-07 | `redirect('/settings#preferences')` in `src/app/preferences/page.tsx` | PASS |
| FEAT-07 commit ancestry check | `git merge-base --is-ancestor 4d362ff HEAD; echo $?` | `1` (NOT ancestor — commit on a sidebranch only) | (regression evidence) |
| FEAT-07 Zod field absence | `grep -nE "notesPublic\|notes_public" src/app/actions/watches.ts` | (no matches) | (regression evidence) |
| FEAT-07 revalidatePath absence | `grep -nE "revalidatePath\('/u/" src/app/actions/watches.ts` | (no matches) | (regression evidence) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SET-07 | 23-01..23-04 | `<PreferencesSection>` exposes a `collectionGoal` select wired to `user_preferences.collection_goal` | SATISFIED | `src/components/settings/preferences/CollectionGoalCard.tsx` exists; `src/components/settings/PreferencesSection.tsx:1,25` imports + renders. UAT item #1 pending. |
| SET-08 | 23-01..23-04 | `<PreferencesSection>` exposes an `overlapTolerance` select wired to `user_preferences.overlap_tolerance` | SATISFIED | `src/components/settings/preferences/OverlapToleranceCard.tsx` exists; `src/components/settings/PreferencesSection.tsx:2,26` imports + renders. UAT item #2 pending. |
| SET-09 | 23-06 (no-diff carryover) | `<NotificationsSection>` provides UI toggles for `notifyOnFollow` + `notifyOnWatchOverlap` | SATISFIED | Cite `git show 9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md` §"SET-09" per D-07 (verified-no-change from Phase 22 D-01). |
| SET-10 | 23-04 | `<AppearanceSection>` houses the theme toggle (lifted from UserMenu's `<InlineThemeSegmented>`) | SATISFIED | `src/components/settings/AppearanceSection.tsx:2,23` imports `InlineThemeSegmented` from `@/components/layout/InlineThemeSegmented` (path correction noted) and renders it inside `<SettingsSection title="Theme">`. UAT item #3 pending (cross-surface sync). |
| SET-11 | 23-06 (no-diff carryover) | `<PrivacySection>` retains the existing privacy toggles, restyled into the vertical-tabs frame | SATISFIED | Cite `git show 9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md` §"SET-11" per D-07 (verified-no-change from Phase 22 D-01). |
| SET-12 | 23-06 (no-diff carryover) | `/preferences` route redirects to `/settings#preferences` for backward compatibility | SATISFIED | Cite `git show 9d87293^:.planning/phases/23-settings-sections-schema-field-ui/23-06-VERIFICATION.md` §"SET-12" per D-07 (verified-no-change from Phase 22 D-15). |
| FEAT-07 | 23-05 (implementation never reached main) | Owner can toggle `notesPublic` per-note from the WatchForm + per-row note edit surface | **GAP** | UI shipped (`src/components/watch/WatchForm.tsx:648-665`; `tests/components/watch/WatchForm.notesPublic.test.tsx` 6/6 PASS). **Server contract did not ship:** commit `4d362ff` (cited by v4.0-REQUIREMENTS.md line 93) is NOT an ancestor of HEAD; `notesPublic` is absent from `insertWatchSchema` in `src/app/actions/watches.ts`; no `revalidatePath('/u/[username]', 'layout')` call site exists. `tests/actions/watches.notesPublic.test.ts` 4/4 FAIL. See Gaps Summary for new DEBT-09 follow-up recommendation. |
| FEAT-08 | 23-04 | User can toggle `isChronometer` in WatchForm and see it displayed in WatchDetail | SATISFIED | `src/components/watch/WatchForm.tsx:81,125,575-577` (default false + edit hydration + Checkbox); `src/components/watch/WatchDetail.tsx:287-295` (only-if-true Certification row, `text-foreground` Check icon, `gap-1`). Tests 5/5 + 4/4 PASS. UAT item #5 pending. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/actions/watches.ts` | (field absent) | `notesPublic` Zod field missing from `insertWatchSchema`; no `revalidatePath('/u/[username]', 'layout')` call site after `addWatch` / `editWatch` | High | FEAT-07 server-action regression — see Observable Truth #4 (GAP) and Gaps Summary. WatchForm pill UI accepts toggles, but the value is silently stripped at the action boundary; per-row `<NoteVisibilityPill>` cannot re-render after an edit until the missing call site is restored. **Recommended new tech_debt:** DEBT-09 (per Gaps Summary). |
| `tests/components/settings/preferences/CollectionGoalCard.test.tsx` | (component import) | `useFormFeedback` calls `useRouter()` from `next/navigation` without a mocked AppRouter context in the test environment | Info | Tests fail with `invariant expected app router to be mounted` (`useFormFeedback` line 86 → `useRouter()` proxy). The component contract is unaffected — the cards work in production (covered by UAT items #1 and #2). This is test-infrastructure debt accumulated since Phase 25-01 introduced `useFormFeedback`; NOT a Phase 23 SET-07/SET-08 contract regression. Tracked as separate hygiene; remediation is a `next/navigation` mock in test setup. |
| `tests/components/settings/preferences/OverlapToleranceCard.test.tsx` | (component import) | Same `useFormFeedback` → `useRouter()` test-infra failure as above | Info | Same impact + remediation as above. |

No other anti-patterns identified. The existing 23-06-VERIFICATION.md sub-plan documented zero orphans for the four "D-20 Cleanup Sweep" targets (Delete Account, Coming soon, New Note Visibility, SettingsClient) per `git show 9d87293^:.../23-06-VERIFICATION.md` §"D-20 Verdict".

### Human Verification Required

#### 1. Preferences persistence + brand-loyalist option

**Test:** Visit `/settings#preferences`, click the Collection goal Select, choose "Brand Loyalist — Same maker, different models", refresh the page, confirm the value persists.
**Expected:** Selected option remains "Brand Loyalist" after refresh; saving indicator briefly visible; no error banner.
**Why human:** Requires real cookie/localStorage round-trip across a page reload + visual confirmation of saving indicator. JSDOM cookie semantics + RTL rerender boundaries cannot reliably exercise the persist-then-refresh flow.

#### 2. analyzeSimilarity reads new preference on next read

**Test:** On `/settings#preferences`, change Overlap tolerance from Medium to High, then visit `/watch/[id]` for any owned watch and confirm the SimilarityBadge or CollectionFitCard verdict reflects the new tolerance.
**Expected:** Verdict label changes (e.g. fewer Hard Mismatch flags) — confirms `analyzeSimilarity()` reads the new preference on next render.
**Why human:** Requires real preference write → real watch detail re-render with the new preference value influencing the similarity verdict. End-to-end semantic check across two surfaces; cannot be programmatically asserted without a full integration harness.

#### 3. Cross-surface theme sync (D-06 duplicate-by-design)

**Test:** Visit `/settings#appearance`, click Light/Dark/System buttons in turn, then open the UserMenu (avatar dropdown top-right) and confirm the `InlineThemeSegmented` control there reflects the same selection.
**Expected:** Both surfaces stay in sync via the `horlo-theme` cookie; no flash of unstyled content; theme changes immediately.
**Why human:** Requires real cookie round-trip + DOM repaint observation across two surfaces (AppearanceSection + UserMenu InlineThemeSegmented). JSDOM cookie semantics + ThemeProvider context boundaries cannot be reliably exercised by RTL.

#### 4. notesPublic cross-page revalidation (D-19)

**Test:** Edit a watch via `/watch/[id]/edit`; toggle the Public/Private pill below the Notes textarea to Private; submit; navigate to `/u/{username}/notes`; confirm the per-row `NoteVisibilityPill` on that watch's row reads "Private".
**Expected:** Cross-page revalidation works: `revalidatePath('/u/[username]', 'layout')` invalidates the user-scoped layout cache so the per-row pill re-renders with the new visibility immediately.
**Why human:** Requires Next.js layout-level revalidation across two routes (`/watch/[id]/edit` → `/u/{username}/notes`) — but see Gaps Summary: this UAT cannot pass while the FEAT-07 server-action regression is unresolved (the `revalidatePath` call site is absent on current main).

**Blocked by:** FEAT-07 GAP — server-side persistence + `revalidatePath` call are absent on main; this UAT cannot pass until the regression is remediated. See Gaps Summary.

#### 5. Chronometer end-to-end (Checkbox toggle → Certification row appears)

**Test:** Edit a watch and check the "Chronometer-certified (COSC or equivalent)" Checkbox in the Specifications card; submit; visit `/watch/[id]`; confirm a "Certification: ✓ Chronometer" row appears in the Specifications dl.
**Expected:** Row renders only when `isChronometer === true`; lucide Check icon at `text-foreground` (NOT `text-accent`); `gap-1` between icon and label.
**Why human:** Visual rendering verification across the WatchForm submit path → WatchDetail re-render. Component tests cover unit behavior; the end-to-end visual confirmation in the live app remains a human check.

### Gaps Summary

**FEAT-07 server-action regression.** This audit surfaces a regression that the v4.0 audit did not detect because the audit was written from the workplan rather than against shipped `main`: commit `4d362ff` (cited at `.planning/milestones/v4.0-MILESTONE-AUDIT.md` line 111 and `.planning/milestones/v4.0-REQUIREMENTS.md` line 93 as the FEAT-07 implementation evidence) is NOT an ancestor of HEAD (`git merge-base --is-ancestor 4d362ff HEAD; echo $?` → `1`). The intended Phase 23-05 ship — `notesPublic: z.boolean().optional()` added to `insertWatchSchema` plus `revalidatePath('/u/[username]', 'layout')` after `addWatch` and `editWatch` — never reached main. Current `src/app/actions/watches.ts` lacks both surfaces (`grep -nE "notesPublic\|notes_public" src/app/actions/watches.ts` returns no matches; `grep -nE "revalidatePath\('/u/" src/app/actions/watches.ts` returns no matches), and `tests/actions/watches.notesPublic.test.ts` is 4/4 RED on main. The WatchForm pill UI works locally — it sends the value via `...formData` spread — but Zod silently strips it at the action boundary, and the per-row `<NoteVisibilityPill>` cannot re-render after an edit because the cross-page revalidation call site is missing. UAT item #4 (`notesPublic cross-page revalidation`) cannot pass while this gap exists. **Recommendation:** track as a new follow-up tech_debt item — suggested ID **DEBT-09**: "FEAT-07 `notesPublic` server-action regression: re-add `notesPublic` to `insertWatchSchema` in `src/app/actions/watches.ts` + add `revalidatePath('/u/[username]', 'layout')` call on `addWatch` + `editWatch` success" — to be addressed in v4.1 close, v5.0 onboarding work, or a dedicated `/gsd-quick` task. **Phase 31 does NOT remediate inline** — this is an audit-only phase per its scope (no production code changes).

**Other gaps:** None at the code level for the other 4 success criteria. SET-07/08 (Preferences), SET-09 (Notifications), SET-10/11 (Appearance + Privacy), SET-12 (`/preferences` redirect), and FEAT-08 (Chronometer) all VERIFIED with current `main` evidence or D-07 sub-plan citations. The 5 pending items in the `human_verification` array are not gaps — they are pending visual / interactive verifications that JSDOM/RTL cannot exercise (real cookie round-trips, cross-surface theme sync, end-to-end visual confirmation). The auxiliary `useRouter`-mock test-infra failure for `tests/components/settings/preferences/` is documented under Anti-Patterns Found as Info-severity test debt — NOT a Phase 23 contract regression.

---

_Verified: 2026-05-05T23:47:14Z_
_Verifier: Claude (gsd-verifier; Phase 31 backfill)_

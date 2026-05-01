---
phase: 23
slug: settings-sections-schema-field-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 23 is UI-only (zero schema, zero new DAL, zero new Server Actions beyond a one-line Zod addition). Validation is component-tests + a small integration test for the Selects round-trip.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 + React Testing Library + jsdom (existing setup) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- tests/components/settings/ tests/components/watch/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30s (quick), ~120s (full) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (settings + watch component scope only)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Task IDs filled in by planner. This skeleton enumerates the verification surface so the planner can map each task to a row.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 0 | SET-07/08 | — | N/A | unit | `npm test tests/components/settings/preferences/` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | SET-10 | — | N/A | unit | `npm test tests/components/settings/AppearanceSection.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | FEAT-07 | — | N/A | unit | `npm test tests/components/watch/WatchForm.notesPublic.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | FEAT-08 | — | N/A | unit | `npm test tests/components/watch/WatchForm.isChronometer.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | 01 | 0 | FEAT-08 | — | N/A | unit | `npm test tests/components/watch/WatchDetail.isChronometer.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | 02 | 1 | SET-07 | — | N/A | unit | RTL render `<CollectionGoalCard>` and assert all 4 SelectItems including brand-loyalist | ❌ W0 | ⬜ pending |
| TBD | 02 | 1 | SET-08 | — | N/A | unit | RTL render `<OverlapToleranceCard>` and assert all 3 SelectItems | ❌ W0 | ⬜ pending |
| TBD | 02 | 1 | SET-07/08 | — | savePreferences round-trips both fields | integration | `npm test tests/actions/preferences.test.ts -t "collectionGoal\|overlapTolerance"` | partial | ⬜ pending |
| TBD | 02 | 1 | SET-07/08 | — | `<PreferencesClient embedded>` suppresses h1 + outer container | unit | RTL assert no `<h1>Preferences</h1>` when `embedded={true}` | ❌ W0 | ⬜ pending |
| TBD | 03 | 1 | SET-10 | — | `<AppearanceSection>` mounts `<InlineThemeSegmented>` inside `<SettingsSection title="Theme">` | unit | RTL render, assert by-role + by-label | ❌ W0 | ⬜ pending |
| TBD | 04 | 1 | FEAT-08 | — | WatchForm checkbox respects `watch.isChronometer` in edit mode | unit | RTL assert checkbox checked when prop is true | ❌ W0 | ⬜ pending |
| TBD | 04 | 1 | FEAT-08 | — | WatchForm submits `isChronometer` through addWatch/editWatch | integration | mock action, RTL submit, assert payload includes field | ❌ W0 | ⬜ pending |
| TBD | 04 | 1 | FEAT-08 | — | WatchDetail renders only-if-true Certification row | unit | RTL render with `isChronometer: true` then `false`, assert presence/absence | ❌ W0 | ⬜ pending |
| TBD | 04 | 1 | FEAT-07 | — | WatchForm pill toggles between Public/Private and submits | unit | RTL click pill, assert state, assert payload | ❌ W0 | ⬜ pending |
| TBD | 04 | 1 | FEAT-07 | — | WatchForm pill defaults to Public for new watches | unit | RTL render new-mode form, assert pill aria-pressed=true | ❌ W0 | ⬜ pending |
| TBD | 05 | 2 | FEAT-07 | — | `addWatch` Zod accepts `notesPublic` | integration | `tests/actions/watches.test.ts` payload-shape test | ❌ W0 | ⬜ pending |
| TBD | 05 | 2 | FEAT-07 | — | `editWatch` Zod accepts `notesPublic` | integration | `tests/actions/watches.test.ts` payload-shape test | ❌ W0 | ⬜ pending |
| TBD | 05 | 2 | FEAT-07 | — | `addWatch`/`editWatch` revalidate `/u/[username]` layout | integration | mock `revalidatePath`, assert called with `'/u/[username]', 'layout'` | ❌ W0 | ⬜ pending |
| TBD | 06 | 2 | SET-09/SET-11/SET-12 | — | Verification only — Phase 22 already shipped | manual | grep + page-render check | n/a | ⬜ pending |
| TBD | 06 | 2 | D-20 | — | Cleanup grep sweep returns zero orphans for "Delete Account", "Coming soon", "New Note Visibility", "SettingsClient" in `src/` | manual | bash grep | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 establishes RED test scaffolds before any implementation. Each scaffold imports the not-yet-written symbol/file and fails with a clear "missing module" or "missing element" message.

- [ ] `tests/components/settings/preferences/CollectionGoalCard.test.tsx` — RED scaffold importing `<CollectionGoalCard>` (asserts 4 SelectItems with brand-loyalist label "Brand Loyalist — Same maker, different models")
- [ ] `tests/components/settings/preferences/OverlapToleranceCard.test.tsx` — RED scaffold importing `<OverlapToleranceCard>` (asserts 3 SelectItems)
- [ ] `tests/components/settings/PreferencesClientEmbedded.test.tsx` — RED scaffold asserting `<PreferencesClient embedded>` suppresses h1, subtitle, and outer container; also asserts the lifted Selects are absent
- [ ] `tests/components/settings/AppearanceSection.test.tsx` — RED scaffold asserting `<AppearanceSection>` renders `<InlineThemeSegmented>` inside `<SettingsSection title="Theme">`
- [ ] `tests/components/watch/WatchForm.notesPublic.test.tsx` — RED scaffold asserting WatchForm renders a Public/Private pill below Notes Textarea; default true; toggles on click; submits in payload
- [ ] `tests/components/watch/WatchForm.isChronometer.test.tsx` — RED scaffold asserting WatchForm renders Chronometer Checkbox in Specifications card; respects extracted value in edit mode; submits in payload
- [ ] `tests/components/watch/WatchDetail.isChronometer.test.tsx` — RED scaffold asserting `<WatchDetail>` renders the only-if-true Certification row when `watch.isChronometer === true`, hides when false/null
- [ ] `tests/actions/watches.notesPublic.test.ts` — RED scaffold asserting `addWatch` and `editWatch` accept `notesPublic` and revalidate `/u/[username]` layout

*Existing infrastructure (vitest 2.1.9 + RTL + jsdom + setup file at `tests/setup.ts`) covers all phase requirements; no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Theme switch in `<UserMenu>` and `<AppearanceSection>` stay in sync (cookie-backed) | SET-10 / D-06 | Cookie-driven cross-component sync is awkward to test reliably in jsdom (no real cookie persistence across reloads) | (1) Login, click UserMenu → set Dark; (2) Open `/settings#appearance`; (3) Verify segmented control shows Dark selected; (4) Set Light from Appearance; (5) Open UserMenu; (6) Verify segmented control shows Light selected |
| `analyzeSimilarity()` reads updated `collectionGoal` after Preferences edit | SET-07 (Success Criteria #1: "reflected by analyzeSimilarity() on next read") | Engine read happens server-side on next watch detail navigation; UAT verifies the round-trip | (1) Set Collection Goal to Brand Loyalist in /settings#preferences; (2) Navigate to a wishlist watch detail; (3) Verify CollectionFitCard verdict copy reflects brand-loyalty framing; (4) Reset to Balanced; (5) Re-navigate; (6) Verify verdict copy changed |
| `<NoteVisibilityPill>` on `/u/{username}/notes` reflects WatchForm pill change | FEAT-07 / D-19 | Cross-page revalidation behavior; jsdom-tested via `revalidatePath` mock but live verification is more credible | (1) Edit a watch via `/watch/[id]/edit`; (2) Toggle Notes pill to Private; (3) Submit; (4) Navigate to `/u/{username}/notes`; (5) Verify the pill on that watch's row reads Private; (6) Toggle back; (7) Re-navigate; (8) Verify Public |
| Brand Loyalist option appears in Select | SET-07 | Trivial UAT confirmation; component test will also catch | Open `/settings#preferences`; click Collection Goal Select; verify "Brand Loyalist — Same maker, different models" appears |
| Cleanup grep returns zero orphans | D-20 | Manual sweep | Run: `grep -r "Delete Account\|Coming soon\|New Note Visibility\|SettingsClient" src/ --include="*.ts" --include="*.tsx"`; expect zero matches outside JSDoc/comments |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets after wiring tasks → tests)

**Approval:** pending

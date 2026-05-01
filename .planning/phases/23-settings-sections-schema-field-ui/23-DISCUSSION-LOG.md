# Phase 23: Settings Sections + Schema-Field UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 23-settings-sections-schema-field-ui
**Areas discussed:** Preferences tab structure, Theme switch placement, isChronometer UI, notesPublic UI, Restyle scope + cleanup

---

## Preferences tab structure (SET-07/08)

### Q1 — How should `collectionGoal` and `overlapTolerance` be surfaced inside the Preferences tab?

| Option | Description | Selected |
|--------|-------------|----------|
| Lift to dedicated top Cards in PreferencesSection | Render `<CollectionGoalCard>` + `<OverlapToleranceCard>` as native Settings-tab cards ABOVE the embedded `<PreferencesClient>`. Removes the duplicates from PreferencesClient's 'Collection Settings' card. Matches SET-07/08 spirit — the engine-driving knobs deserve top placement. | ✓ |
| Lift the existing 'Collection Settings' card to the top of PreferencesClient | Reorder PreferencesClient so 'Collection Settings' renders FIRST instead of 6th. Smallest change; same 8-card stack just resequenced. | |
| Add brand-loyalist option only; leave layout alone | Lowest-effort interpretation: just add the missing 'brand-loyalist' SelectItem. SET-07/08 are arguably already satisfied. | |
| Replace embed with a slim Preferences-tab-native component | Build a new `<PreferencesTabContent>` rendering only the Settings-tab-relevant knobs; deprecate PreferencesClient as a separate full-page component. | |

**User's choice:** Lift to dedicated top Cards in PreferencesSection.
**Notes:** Recommended option chosen — these are the engine-driving knobs in v4.0 (Phase 19.1 locked the analyzeSimilarity rewire to v5.0).

---

### Q2 — What should happen with the 'Preferences' h1 heading inside `<PreferencesClient>` when embedded?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide the h1 + subtitle when embedded | Add an `embedded` prop to PreferencesClient that suppresses the 'Preferences' h1 + subtitle paragraph. The Settings tab already labels itself 'Preferences'. | ✓ |
| Leave it (visual redundancy is fine) | Keep the duplicate 'Preferences' h1 + subtitle inside the tab. | |
| Move heading to a section description | Replace the h1 with a smaller section description below the tab title. | |

**User's choice:** Hide the h1 + subtitle when embedded.

---

### Q3 — User-facing label for the new `brand-loyalist` option?

| Option | Description | Selected |
|--------|-------------|----------|
| Brand Loyalist — Same maker, different models | Mirrors the 'Specialist - Deep in one area' phrasing pattern. | ✓ |
| Brand Loyalist | Just the label, no descriptor (other options have descriptors). | |
| One brand, many models | Descriptive without naming the goal type. | |

**User's choice:** Brand Loyalist — Same maker, different models.

---

## Theme switch placement (SET-10)

### Q1 — How should the theme switch live across UserMenu and the new Appearance tab?

| Option | Description | Selected |
|--------|-------------|----------|
| Duplicate — keep in UserMenu AND add to Appearance tab | Both surfaces stay; matches GitHub/Linear pattern. The global cookie keeps both in sync via `useTheme()`. | ✓ |
| Lift only — remove from UserMenu, only in Appearance tab | Theme is settings-only; cleaner UserMenu but adds friction. | |
| Different surfaces — segmented in UserMenu, richer card in Appearance | UserMenu keeps bare segmented row; Appearance gets richer presentation. | |

**User's choice:** Duplicate — keep in UserMenu AND add to Appearance tab.

---

### Q2 — Should `<AppearanceSection>` wrap the theme control with explanatory copy or render it bare?

| Option | Description | Selected |
|--------|-------------|----------|
| Bare control inside SettingsSection 'Theme' card | One-line title ('Theme') and the InlineThemeSegmented row below. Matches Privacy/Notifications card-frame visual rhythm. | ✓ |
| Bare control, no description text | Just the segmented row inside the card with no description copy. | |
| Per-option descriptions inline | Below each Light/Dark/System button, render a tiny caption. | |

**User's choice:** Bare control inside SettingsSection 'Theme' card.

---

## isChronometer UI (FEAT-08)

### Q1 — Where in WatchForm should the `isChronometer` toggle live?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside Specifications card as a Checkbox row | Add a 'Chronometer-certified (COSC or equivalent)' checkbox row at the bottom of the Specifications grid. | ✓ |
| Bottom of Specifications card, full-width row below the grid | Same card, but as a full-width row visually separated from the dropdown specs. | |
| New 'Certifications' card | Future-proofs for additional certifications. Probably premature. | |

**User's choice:** Inside Specifications card as a Checkbox row.

---

### Q2 — How should `isChronometer = true` display in WatchDetail?

| Option | Description | Selected |
|--------|-------------|----------|
| Only-if-true row in Specifications dl with check icon | Adds a 'Certification ✓ Chronometer' row inside the existing Specifications `<dl>`. Hidden when false. | ✓ |
| Badge near the status badge at top of detail | More prominent but visually competes with status. | |
| Always-shown row with Yes/No values | Adds noise to non-chronometer watches. | |

**User's choice:** Only-if-true row in Specifications dl with check icon.

---

### Q3 — Should the WatchForm checkbox respect the URL-extracted value as the default, or always start unchecked?

| Option | Description | Selected |
|--------|-------------|----------|
| Respect extracted value when present | If extraction returned `isChronometer: true`, the checkbox is pre-checked. Owner can untoggle. | ✓ |
| Always start unchecked, ignore extraction | Higher friction; risks losing accurate extracted data. | |

**User's choice:** Respect extracted value when present.

---

## notesPublic UI (FEAT-07)

### Q1 — How should the `notesPublic` control render inside WatchForm's Notes card?

| Option | Description | Selected |
|--------|-------------|----------|
| Public/Private pill below textarea matching NoteVisibilityPill style | Render a 'Public / Private' chip-style toggle directly below the textarea. Visual consistency with the per-row pill on /u/{username}/notes. | ✓ |
| Standalone Checkbox row below textarea | '✓ Make this note public' Checkbox + Label. Matches existing form Checkbox pattern. | |
| Switch to right of 'Notes' card title | Render the toggle in the CardHeader area, right-aligned. | |

**User's choice:** Public/Private pill below textarea matching NoteVisibilityPill style.

---

### Q2 — Default `notesPublic` value when adding a NEW watch with notes?

| Option | Description | Selected |
|--------|-------------|----------|
| Public | Default true — matches the DB column default and the read-side fallback. | ✓ |
| Private | Default false — changes the DB default semantics. | |

**User's choice:** Public.

---

### Q3 — Confirm the FEAT-07 'per-row note edit surface' interpretation?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase only adds the field to WatchForm; existing pill needs no work | FEAT-07's 'per-row note edit surface' is already satisfied by the existing `<NoteVisibilityPill>`. Spec language was written before the pill was made interactive. | ✓ |
| Investigate further — the pill behaves as read-only somewhere | Pause and grep for `<NoteVisibilityPill>` usages with `disabled=true`. | |

**User's choice:** Phase only adds the field to WatchForm; existing pill needs no work.

---

## Restyle scope + cleanup (SET-09 / SET-11)

### Q1 — What scope should SET-09/SET-11 'restyle' have?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum-scope: leave as-is | Phase 22's tab migration already restyled into the new tab frame. Toggles are functional and visually consistent. | ✓ |
| Light visual polish: per-toggle group dividers + clearer labels | Modest visual improvement. | |
| Functional addition: 'Mute all' master toggle to Notifications | Expands scope beyond v4.0. | |
| Heavier rework: switch to shadcn `<Switch>` everywhere | Risks regressing the useOptimistic wiring. | |

**User's choice:** Minimum-scope: leave as-is.

---

### Q2 — Anything else surfaced during Phase 22 implementation that should be folded into Phase 23?

| Option | Description | Selected |
|--------|-------------|----------|
| No — stay strictly within SET-07..12 + FEAT-07/08 | Keep Phase 23 focused. | |
| Yes — fold cleanup verification of Phase 22 deletions | Confirm that Phase 22's deletions left no orphan code/types. | ✓ |
| Yes — something else | User had a specific gap in mind. | |

**User's choice:** Fold cleanup verification of Phase 22 deletions.

---

## Claude's Discretion

The planner has discretion over the following implementation details (signaled inline in CONTEXT.md):

- **Naming and file factoring** of the two new top Preferences Cards (e.g., `<CollectionGoalCard>` + `<OverlapToleranceCard>` vs. a single `<PreferencesEngineKnobs>`).
- **Whether to extract a shared `<VisibilityPill>` primitive** between `<NoteVisibilityPill>` and the new WatchForm pill (D-14 option a) or build a minimal inline pill in WatchForm with controlled state and accept some styling duplication (D-14 option b). Researcher to verify the right call.
- **Whether `embedded` defaults to `false` or `true`** in the new `<PreferencesClient>` prop — defaulting `true` is fine if no remaining caller renders the unembedded form.
- **Whether to rename PreferencesClient's 'Collection Settings' Card** after lifting its two Selects out, or merge the leftover into the Notes Card.

## Deferred Ideas

- Mute-all master toggle for Notifications (future polish phase)
- shadcn `<Switch>` primitive swap (no value vs. risk in v4.0)
- Certifications card for additional credentials — premature for v4.0
- Extracting a shared `<VisibilityPill>` primitive between forms and rows — wait for a third surface to demand it
- SET-13 Delete Account / Danger Zone — already deferred to v5+
- SET-14 Branded HTML email templates — already deferred
- Replacing `<PreferencesClient>` entirely with a Settings-tab-native component — wait for v5.0 engine rewire

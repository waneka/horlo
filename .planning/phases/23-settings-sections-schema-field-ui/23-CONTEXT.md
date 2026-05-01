# Phase 23: Settings Sections + Schema-Field UI - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Populate the five non-Account settings tabs from Phase 22 with the schema-driven knobs that already exist in the database but have no user-facing edit surface, AND expose two `watches`-table fields (`isChronometer`, `notesPublic`) inside `<WatchForm>` and `<WatchDetail>`.

**In scope (SET-07..SET-12 + FEAT-07/08):**
1. **Preferences tab (SET-07/08)**: Render `collectionGoal` and `overlapTolerance` as dedicated top-of-tab `<Card>`s in `<PreferencesSection>`, ABOVE the embedded `<PreferencesClient>`. Add the missing `brand-loyalist` option (already accepted by the Server Action's Zod schema) with copy "Brand Loyalist — Same maker, different models". Hide the duplicate "Preferences" h1/subtitle inside `<PreferencesClient>` when it is embedded.
2. **Notifications tab (SET-09)**: No further work — the migrated `<PrivacyToggleRow>` instances inside `<NotificationsSection>` already satisfy SET-09. Phase 22's tab migration WAS the restyle. Phase 23 verifies, no code change.
3. **Privacy tab (SET-11)**: Same — Phase 22 already restyled into the new tab frame. Phase 23 verifies, no code change.
4. **Appearance tab (SET-10)**: Replace the "Coming in Phase 23" stub with a `<SettingsSection title="Theme">` containing the bare `<InlineThemeSegmented>` row. KEEP `<InlineThemeSegmented>` in the UserMenu dropdown (duplicate-by-design — both surfaces stay in sync via the global `horlo-theme` cookie + `useTheme()` context).
5. **`/preferences` redirect (SET-12)**: Already shipped in Phase 22 D-15. No code change. Verification only.
6. **`isChronometer` (FEAT-08)**: Add a Checkbox row at the bottom of the Specifications card in `<WatchForm>`. Wire create + edit paths to persist (`addWatch` / `editWatch` Server Actions already accept Watch fields; the Zod schemas at `src/app/actions/watches.ts` need a one-line addition). Display in `<WatchDetail>` as an only-if-true row inside the Specifications `<dl>` with a check icon. Pre-check from the URL-extracted value when prefilling.
7. **`notesPublic` (FEAT-07)**: Add a "Public / Private" pill below the Notes textarea in `<WatchForm>`'s Notes card, visually matching `<NoteVisibilityPill>`. Default to `true` (matches DB default `notesPublic NOT NULL DEFAULT true`). Persist via `addWatch`/`editWatch`. The existing `<NoteVisibilityPill>` on `/u/{username}/notes` already provides the per-row toggle and needs no additional work in this phase.

**Out of scope (other phases own):**
- Phase 24 — notification stub cleanup (`price_drop`, `trending_collector`), `wornPublic` test fixtures, TEST-04/05/06.
- Phase 25 — toast+banner hybrid (UX-06), Server Action pending states (UX-07), profile-edit success toast (UX-08), nav prominence, empty-state CTAs.
- v5+ — SET-13 Delete Account / Danger Zone (already deferred), SET-14 branded HTML email templates.

**Folded cleanup (housekeeping for Phase 22 leftovers, per discussion):**
- Verify that Phase 22's deletions (the Delete Account dialog, "Coming soon" stubs, the disabled "New Note Visibility" Select inside `SettingsClient.tsx`) left no orphan imports, unused types, or referenced-but-deleted helpers across `src/`. Bounded sweep — not a refactor.

</domain>

<decisions>
## Implementation Decisions

### Preferences Tab Structure (SET-07/08)

- **D-01: `<PreferencesSection>` renders two NEW dedicated `<Card>`s at the top — one for `collectionGoal`, one for `overlapTolerance` — ABOVE the embedded `<PreferencesClient>`.** The two selects ARE the engine-driving knobs in v4.0 (per `src/lib/similarity.ts`); the taste-tag pickers below are a less-prominent fine-tuning surface. Lifting them to the top gives SET-07/08 a real "section exposes the select" affordance instead of being buried 6 cards deep. The new top Cards talk to the SAME `savePreferences` Server Action that PreferencesClient uses (both write `user_preferences`); no DAL changes.
- **D-02: Remove the duplicate `collectionGoal` + `overlapTolerance` Selects from `<PreferencesClient>`'s 'Collection Settings' Card.** Keeping both surfaces would risk drift and double-rendering the same control. PreferencesClient retains Style / Design / Complications / Dial Color / Case Size / Notes — the taste-tag pickers — and the 'Collection Settings' Card title is renamed (e.g., to 'Notes' if that's all that remains, or the Notes Card absorbs it).
- **D-03: Add `'brand-loyalist'` SelectItem with the label "Brand Loyalist — Same maker, different models".** The Zod schema in `src/app/actions/preferences.ts:29` already accepts this value (`z.enum(['balanced', 'specialist', 'variety-within-theme', 'brand-loyalist'])`). UI gap only.
- **D-04: `<PreferencesClient>` accepts a new `embedded?: boolean` prop. When true, suppress the outer `container mx-auto px-4 py-8 max-w-3xl` wrapper, the `<h1>Preferences</h1>` heading, and the subtitle paragraph.** Phase 22's `<PreferencesSection>` passes `embedded={true}`. The standalone `/preferences` route is no longer mounted (Phase 22 D-15 redirect), so this is the only render path; the `embedded` default could in principle be `true`, but keeping the prop opt-in protects the byte-identical `/preferences/page.tsx` redirect target if anything ever re-mounts the standalone page.

### Theme Switch (SET-10)

- **D-05: `<AppearanceSection>` renders a `<SettingsSection title="Theme">` containing the bare `<InlineThemeSegmented>` row — no extra explanatory copy.** The Light/Dark/System icon labels carry the meaning. Card frame matches Privacy / Notifications visual rhythm.
- **D-06: KEEP `<InlineThemeSegmented>` in `<UserMenu>` (duplicate by design).** Both surfaces read/write the same global `horlo-theme` cookie via `useTheme()` from `@/components/theme-provider`; switching theme in either surface re-renders the other on the next React tick. Pattern matches GitHub/Linear: persistent quick-toggle in nav + canonical settings location.
- **D-07: No re-implementation of `<InlineThemeSegmented>`.** Reuse the existing component as-is. The Floating UI dismissal workaround (`onPointerDown/Up stopPointer`, `e.stopPropagation()`) is irrelevant inside `<AppearanceSection>` (no surrounding base-ui Menu); the workaround stays harmless and inert in the new context.

### Privacy + Notifications Restyle (SET-09/SET-11)

- **D-08: No code changes for SET-09 + SET-11.** Phase 22 D-01 migrated the `<PrivacyToggleRow>` instances into `<PrivacySection>` and `<NotificationsSection>` inside the new tab frame; this WAS the restyle from the user's perspective. The toggles work, are accessible, and visually match the rest of the tab. Adding "Mute all" master toggles, swapping to shadcn `<Switch>`, or reorganizing into per-toggle cards is out of scope for v4.0. Documented as "verified, no change" in the plan so the reviewer doesn't expect a diff.

### `isChronometer` (FEAT-08)

- **D-09: Add `isChronometer: boolean | undefined` to WatchForm's `FormData` type and `initialFormData`** (default `false` for new watches; defaults to `watch.isChronometer` in edit mode). Hydrate from URL-extracted value when the form is prefilled (`addWatch` flow's `WatchForm` instance already receives extracted fields via the AddWatchFlow orchestrator's `watch` prop — chronometer flows through automatically once the type is wired).
- **D-10: Render the Checkbox at the bottom of the Specifications `<Card>`, full-width row below the existing 9-cell grid.** Visual: `<div className="space-y-2 sm:col-span-2 lg:col-span-3"><label className="flex items-center gap-2"><Checkbox/> Chronometer-certified (COSC or equivalent)</label></div>`. Sits with other spec data; matches the existing 'Flag as a good deal' Checkbox pattern in `<WatchDetail>`.
- **D-11: `<WatchDetail>` Specifications `<dl>` renders an only-if-true row when `watch.isChronometer === true`.** Format: `<dt>Certification</dt><dd className="font-semibold flex items-center gap-1">✓ Chronometer</dd>`. Hidden when `false` or `null` — matches how `caseSizeMm`, `lugToLugMm`, etc. only render when present. Use `lucide-react`'s `Check` icon for the checkmark.
- **D-12: Server Action `editWatch` already accepts `isChronometer` via Drizzle's row update.** Verify the `watchSchema` Zod object in `src/app/actions/watches.ts` includes `isChronometer: z.boolean().optional()`; add if missing (one-line). `addWatch` path: same treatment.

### `notesPublic` (FEAT-07)

- **D-13: Add `notesPublic: boolean` to WatchForm's `FormData` type and `initialFormData`** (default `true` for new watches; defaults to `watch.notesPublic ?? true` in edit mode — the `?? true` defends against legacy rows without the column populated).
- **D-14: Render a Public/Private pill BELOW the Textarea inside the Notes `<Card>`** that visually matches `<NoteVisibilityPill>` — same chip shape, same `bg-accent`/`bg-muted` color treatment. **Implementation choice (planner discretion):** either (a) extract a presentational `<VisibilityPill>` primitive that both `<NoteVisibilityPill>` and the WatchForm pill render, or (b) build a minimal inline pill in WatchForm with controlled state and accept some styling duplication. Option (b) is fine for v4.0 — the visual is simple enough that a refactor toward (a) costs more than it saves. Researcher: confirm.
- **D-15: The existing `<NoteVisibilityPill>` on `/u/{username}/notes` is the canonical per-row toggle and needs NO changes.** REQUIREMENTS.md text "today the visibility pill is read-only" is stale — it was written before D-13 (a prior phase) made the pill interactive. Confirmed during discussion. The phase's only FEAT-07 work is the WatchForm + edit-form path.
- **D-16: Default `notesPublic = true` for new watches** matches the DB column default (`notes_public NOT NULL DEFAULT true`) and the existing read-side fallback (`watch.notesPublic !== false` in `NoteRow.tsx:40`). Per-note opt-out via the pill is the correct UX surface.
- **D-17: Server Action `addWatch` / `editWatch` accept `notesPublic`.** Verify the watchSchema Zod object in `src/app/actions/watches.ts` includes `notesPublic: z.boolean().optional()`; add if missing (one-line). Existing `updateNoteVisibility` Server Action remains unchanged — it's the per-row pill's path, not the form's.

### Server Action Revalidation Paths

- **D-18: `savePreferences` already revalidates both `/preferences` and `/settings` paths** (`src/app/actions/preferences.ts:55-61`). The new top-of-tab Cards in `<PreferencesSection>` will see fresh server data on the same path-revalidation. No change.
- **D-19: `editWatch` / `addWatch` MUST revalidate the per-row note surface (`/u/[username]` layout) when `notesPublic` changes** so the pill on `/u/{username}/notes` reflects the form's choice. Existing paths to verify: `src/app/actions/watches.ts` already revalidates the user-scoped layout (Phase 8 wiring) — researcher to confirm and add explicit `revalidatePath('/u/[username]', 'layout')` if missing.

### Folded Cleanup (Phase 22 Leftovers)

- **D-20: Verify Phase 22's stub deletions left no orphan code.** Bounded sweep:
  - `grep` for any `Delete Account` references outside of v5+ planning artifacts → expect zero in `src/`.
  - `grep` for `Coming soon` references outside this phase's docs → expect zero in `src/`.
  - `grep` for any disabled `New Note Visibility` Select usage → expect zero in `src/`.
  - `grep` for unused exports from `SettingsClient.tsx` (which Phase 22 deleted) → expect zero.
  - Any orphans found get deleted in this phase as a single small commit. Out of scope: anything beyond direct Phase 22 leftovers.

### Folded Todos

None — `todo match-phase 23` returned zero matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level
- `.planning/REQUIREMENTS.md` § "Settings Restructure" lines 81–86 (SET-07..SET-12 acceptance criteria)
- `.planning/REQUIREMENTS.md` § "Watch Field UI Exposure" lines 103–104 (FEAT-07, FEAT-08)
- `.planning/ROADMAP.md` § "Phase 23: Settings Sections + Schema-Field UI" lines ~219–230 (goal, dependencies, 5 success criteria)
- `.planning/PROJECT.md` Key Decisions table — Phase 22 settings restructure, Phase 19.1 catalog taste enrichment lock (engine rewire deferred to v5.0)
- `.planning/STATE.md` — current v4.0 milestone status

### Prior-Phase Artifacts (dependency chain)
- `.planning/phases/22-settings-restructure-account-section/22-CONTEXT.md`
  - **D-01** — Section migration plan that placed PreferencesClient inside PreferencesSection, deferred Appearance to Phase 23.
  - **D-04** — Phase 22 deletions (Delete Account dialog, Coming-soon stubs, "New Note Visibility" disabled-Select). Phase 23 verifies cleanup.
  - **D-15** — `/preferences` server-side redirect to `/settings#preferences`. SET-12 already satisfied; verify-only.
- `.planning/phases/22-settings-restructure-account-section/22-UI-SPEC.md` — Visual spec for Settings tab frame; Phase 23's new Cards must visually match.

### Code Patterns to Mirror

**Settings shell (Phase 22):**
- `src/components/settings/SettingsTabsShell.tsx` — base-ui Tabs wrapper; new section content slots in unchanged.
- `src/components/settings/SettingsSection.tsx` — heading + card frame primitive; reused by Theme card and the new Preferences Cards.
- `src/components/settings/PrivacyToggleRow.tsx` — locked switch primitive (`useOptimistic` + Server Action); keep as-is.

**Preferences (this phase modifies):**
- `src/components/settings/PreferencesSection.tsx` — passes `preferences` into `<PreferencesClient>`. Phase 23 adds two top Cards before the embed and passes `embedded={true}`.
- `src/components/preferences/PreferencesClient.tsx` — embedded form. Phase 23 adds `embedded?: boolean` prop and removes the lifted Selects.
- `src/app/actions/preferences.ts` — `savePreferences` Server Action; Zod schema already accepts `brand-loyalist`. Revalidates `/preferences` + `/settings`.
- `src/data/preferences.ts` — DAL upsert; supports all the columns we touch.

**Theme (this phase mounts in a new surface):**
- `src/components/layout/InlineThemeSegmented.tsx` — segmented row primitive; reused inside `<AppearanceSection>` without modification.
- `src/components/layout/UserMenu.tsx` — current host of `<InlineThemeSegmented>`; STAYS unchanged.
- `src/components/theme-provider.tsx` — `useTheme()` hook; cookie-backed; both surfaces stay in sync automatically.
- `src/components/settings/AppearanceSection.tsx` — replaces the "Coming in Phase 23" stub with the SettingsSection + InlineThemeSegmented.

**Privacy + Notifications (verified, unchanged):**
- `src/components/settings/PrivacySection.tsx` — three `<PrivacyToggleRow>` instances inside `<SettingsSection>`. No code change in Phase 23.
- `src/components/settings/NotificationsSection.tsx` — two `<PrivacyToggleRow>` instances inside `<SettingsSection>`. No code change in Phase 23.

**Watch form fields (this phase modifies):**
- `src/components/watch/WatchForm.tsx` — adds `isChronometer` Checkbox in Specifications card and `notesPublic` pill in Notes card; extends `FormData` and `initialFormData` accordingly.
- `src/components/watch/WatchDetail.tsx` — adds only-if-true `isChronometer` row in Specifications `<dl>`.
- `src/components/profile/NoteVisibilityPill.tsx` — visual reference for the new WatchForm pill style; UNCHANGED.
- `src/components/profile/NoteRow.tsx` — reads `watch.notesPublic !== false`; UNCHANGED.
- `src/app/actions/watches.ts` — `addWatch` + `editWatch` Server Actions; verify Zod accepts `isChronometer` and `notesPublic` (add if missing).
- `src/app/actions/notes.ts` — `updateNoteVisibility` Server Action; UNCHANGED (per-row pill path, not form path).

**Type / Schema:**
- `src/lib/types.ts` lines 50, 53 — `Watch.isChronometer?: boolean`, `Watch.notesPublic?: boolean` (already defined).
- `src/db/schema.ts` lines 95, 98 — `is_chronometer boolean DEFAULT false`, `notes_public boolean NOT NULL DEFAULT true` (already defined).

### External (Vendor) Docs — Read at Research-Phase
- shadcn `<Checkbox>` — `https://ui.shadcn.com/docs/components/checkbox` (existing usage in WatchForm).
- base-ui `<Tabs>` (vertical) — `https://base-ui.com/react/components/tabs` (Phase 22 already wired; new section content drops in).
- React `useOptimistic` — `https://react.dev/reference/react/useOptimistic` (`PrivacyToggleRow` and `NoteVisibilityPill` patterns; not introduced in this phase).

### Memory References
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_drizzle_supabase_db_mismatch.md` — DB migration rules. **Not invoked**: Phase 23 has zero schema changes (all columns already exist).
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_taste_enrichment_arch_2026_04_29.md` — Phase 19.1 catalog taste lock; engine rewire deferred to v5.0. **Relevant**: confirms PreferencesClient's taste-tag pickers still drive `analyzeSimilarity()` in v4.0; the lifted `collectionGoal`/`overlapTolerance` selects are the dominant engine inputs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`<SettingsSection>`** (`src/components/settings/SettingsSection.tsx`) — Heading + card frame primitive used by every Phase 22 section; reused by `<AppearanceSection>` Theme card and the two new Preferences top Cards.
- **`<InlineThemeSegmented>`** (`src/components/layout/InlineThemeSegmented.tsx`) — Reuse as-is inside `<AppearanceSection>`. The Floating UI dismissal workaround stays harmless when no surrounding Menu exists.
- **`<NoteVisibilityPill>`** (`src/components/profile/NoteVisibilityPill.tsx`) — Visual reference for the new WatchForm pill. Reuse the chip shape: `rounded-full px-2.5 py-0.5 text-xs font-normal`, `bg-accent text-accent-foreground` when public, `bg-muted text-muted-foreground` when private.
- **`<PrivacyToggleRow>`** (`src/components/settings/PrivacyToggleRow.tsx`) — Locked switch primitive; not modified by Phase 23 but referenced for visual consistency between Privacy/Notifications and any new switches we might add (none in Phase 23).
- **`<Card>` / `<CardHeader>` / `<CardContent>`** (`src/components/ui/card.tsx`) — Standard primitive for the new top Preferences Cards.
- **`<Select>` / `<SelectItem>`** (`src/components/ui/select.tsx`) — Standard primitive for the lifted `collectionGoal` + `overlapTolerance` Selects.
- **`<Checkbox>`** (`src/components/ui/checkbox.tsx`) — Standard primitive for the new `isChronometer` row in WatchForm.
- **`savePreferences` Server Action** (`src/app/actions/preferences.ts`) — Already accepts `brand-loyalist`; revalidates `/preferences` + `/settings`. The lifted top Cards call this same action.
- **`addWatch` / `editWatch` Server Actions** (`src/app/actions/watches.ts`) — Already persist Watch fields; verify Zod accepts the two new fields (one-line additions if missing).

### Established Patterns

- **`useOptimistic` for instantly-toggleable settings** (`<PrivacyToggleRow>`, `<NoteVisibilityPill>`) — Used for binary visibility/notification flips. Phase 23's new top Preferences Cards are Selects, not toggles, so they use the existing `<PreferencesClient>` `useTransition`-based save pattern.
- **`useTransition` for Select-driven settings saves** (`<PreferencesClient>:38-63`) — Local mirror state + Server Action call inside `startTransition`. The two new top Cards mirror this pattern.
- **`embedded` prop pattern** (NEW in Phase 23) — `<PreferencesClient>` accepts `embedded?: boolean` to suppress its outer page-chrome (h1, subtitle, container wrapper). Pattern is portable: any future "page that may also embed in a tab" can adopt it.
- **Only-if-true rendering in Specs `<dl>`** (`<WatchDetail>` lines 245–286) — Existing pattern for optional fields (`caseSizeMm`, `lugToLugMm`, etc.). Phase 23 adds `isChronometer` to the same set.

### Integration Points

- **`<PreferencesSection>`** — Rewritten. Today: passes `preferences` to `<PreferencesClient>`. New: renders two NEW Cards (`<CollectionGoalCard>` + `<OverlapToleranceCard>` — names are planner discretion) ABOVE the embed, then renders `<PreferencesClient embedded preferences={preferences} />`. New file(s) created under `src/components/settings/preferences/` (planner's call on file factoring).
- **`<PreferencesClient>`** — Modified. Adds `embedded?: boolean` prop. Removes the Collection Settings Card's `collectionGoal` + `overlapTolerance` Selects (they live in the new top Cards now). Notes Card may absorb the leftover or stay separate.
- **`<AppearanceSection>`** — Rewritten. Replaces the lucide-`Palette` "coming soon" copy with `<SettingsSection title="Theme"><InlineThemeSegmented/></SettingsSection>`. Becomes a Client Component (was a Server Component) because `InlineThemeSegmented` requires `'use client'`.
- **`<WatchForm>`** — Modified. Adds `isChronometer` to FormData type + initialFormData + edit-mode hydration; adds Checkbox in Specifications card. Adds `notesPublic` to FormData type + initialFormData + edit-mode hydration; adds Public/Private pill below Textarea in Notes card.
- **`<WatchDetail>`** — Modified. Adds only-if-true `isChronometer` row in Specifications `<dl>` after the existing `productionYear` row.
- **`src/app/actions/watches.ts`** — Verify Zod schema. Add `isChronometer: z.boolean().optional()` and `notesPublic: z.boolean().optional()` if missing.
- **`src/components/preferences/PreferencesClient.tsx`** — The Notes Card that follows the (deleted) Collection Settings Card stays as-is; reorder if title-renaming creates awkward sequencing.
- **`<UserMenu>`** — UNCHANGED. `<InlineThemeSegmented>` stays in the dropdown.
- **`<NoteVisibilityPill>` / `<NoteRow>` / `updateNoteVisibility`** — UNCHANGED (per-row note surface already complete; D-15 confirms scope).
- **`<PrivacySection>` / `<NotificationsSection>` / `<PrivacyToggleRow>`** — UNCHANGED (D-08).
- **`/preferences/page.tsx`** — UNCHANGED (Phase 22 D-15 redirect already satisfies SET-12).

</code_context>

<specifics>
## Specific Ideas

- **The lifted `collectionGoal` + `overlapTolerance` Selects ARE the engine-driving knobs.** v4.0 still routes through `analyzeSimilarity()` (Phase 19.1 lock; engine rewire deferred to v5.0). Lifting them to top-of-tab cards isn't cosmetic — it surfaces the controls that actually change the verdict, which currently live behind a 5-card scroll inside `<PreferencesClient>`.
- **The duplicate theme switch is intentional.** Both surfaces read/write the same `horlo-theme` cookie via `useTheme()`. UserMenu offers a 1-click change-from-anywhere; Appearance offers the canonical settings home. No state-sync work needed — `useTheme()` is the source of truth.
- **`<NoteVisibilityPill>` styling is the visual contract for the new WatchForm pill.** Even if the planner chooses not to extract a shared primitive (D-14 option b), the colors, padding, font size, and rounded-full shape MUST match exactly so the user sees the same affordance in the form and on the per-row surface.
- **Default `notesPublic = true` is non-negotiable.** It matches the DB column default, the read-side fallback in `NoteRow.tsx:40`, and the existing v3.0 social-discovery model. Defaulting to `false` would silently hide thousands of existing notes from `/u/{username}/notes`.
- **`isChronometer` displays only-if-true.** Mirroring the existing `<WatchDetail>` `<dl>` pattern. Showing "Chronometer: No" on every non-chronometer watch would add noise to the 95% case for the 5% case.
- **No schema changes.** Phase 23 has zero Drizzle migrations and zero Supabase migrations; every column already exists. The DB rules in `project_drizzle_supabase_db_mismatch.md` do not apply.
- **No new DAL functions.** Phase 23 uses existing `savePreferences`, `addWatch`, `editWatch`, `getPreferencesByUser`, `upsertPreferences`. Maybe one Zod-schema addition (`isChronometer`/`notesPublic`) in `src/app/actions/watches.ts` if not already present.
- **The folded cleanup is bounded.** It's a `grep` sweep for orphans from Phase 22's deletions, not a refactor opportunity. If the sweep finds zero orphans, it ships as a no-op verification commit.
- **Phase 22's `<PreferencesSection>` already calls `revalidatePath('/settings')` indirectly** via `savePreferences`. The new top Cards inherit this for free.

</specifics>

<deferred>
## Deferred Ideas

- **Mute-all master toggle on Notifications** — Useful UX (single switch to mute both `notifyOnFollow` + `notifyOnWatchOverlap`) but expands SET-09 scope. Defer to v4.x polish.
- **shadcn `<Switch>` primitive swap** — Replacing `<PrivacyToggleRow>`'s custom switch with shadcn `<Switch>` would risk regressing the `useOptimistic` flow. The custom primitive works; defer the swap unless a concrete shadcn-feature need surfaces.
- **Certifications card for additional credentials** (Geneva Seal, Master Chronometer, Patek seal, Glashütte's German chronometer) — Premature for v4.0; horlo doesn't track these today. Revisit when a user actually requests it.
- **Extracting a shared `<VisibilityPill>` primitive** between `<NoteVisibilityPill>` and the new WatchForm pill — D-14 option (a). Worth doing if a third visibility-pill surface appears; not now.
- **SET-13 — Account → Delete Account / Danger Zone** — Already deferred to v5+ per REQUIREMENTS.md. Phase 22 D-03 deleted the stub; not coming back in this phase.
- **SET-14 — Branded HTML email templates** — Already deferred. Supabase defaults remain.
- **A11y rework of `<PrivacyToggleRow>` aria semantics** — Currently `role="switch"` with `aria-checked`. If a future audit calls for richer labelling, address there. Out of scope here.
- **Per-note category tags / pinning / archiving** — Notes UX expansion ideas. Future milestone.
- **Diff editor / draft-saving for the Notes textarea** — Convenience UX. Future polish.
- **Replacing `<PreferencesClient>` entirely with a Settings-tab-native component** — Considered (GA-1 option d). Rejected for v4.0 because the embed works and the v5.0 engine rewire will likely change the Preferences shape anyway. Cleaner to refactor once the engine reads from `watches_catalog` taste attrs.

### Reviewed Todos (not folded)

None — `todo match-phase 23` returned zero matches. All v4.0 polish/test/cleanup todos already mapped to Phases 24/25/26.

</deferred>

---

*Phase: 23-settings-sections-schema-field-ui*
*Context gathered: 2026-05-01*

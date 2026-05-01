# Phase 23: Settings Sections + Schema-Field UI - Research

**Researched:** 2026-05-01
**Domain:** Next.js 16 App Router UI surfacing — settings tabs (Server/Client component composition) + watch-form schema-field exposure (Zod + Drizzle + RTL tests)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Preferences Tab Structure (SET-07/08)**
- **D-01**: `<PreferencesSection>` renders two NEW dedicated `<Card>`s at the top — one for `collectionGoal`, one for `overlapTolerance` — ABOVE the embedded `<PreferencesClient>`. The new top Cards talk to the SAME `savePreferences` Server Action that PreferencesClient uses; no DAL changes.
- **D-02**: Remove the duplicate `collectionGoal` + `overlapTolerance` Selects from `<PreferencesClient>`'s 'Collection Settings' Card. The 'Collection Settings' Card title is renamed (e.g., to 'Notes' if that's all that remains, or the Notes Card absorbs it).
- **D-03**: Add `'brand-loyalist'` SelectItem with the label "Brand Loyalist — Same maker, different models". The Zod schema in `src/app/actions/preferences.ts:29` already accepts this value. UI gap only.
- **D-04**: `<PreferencesClient>` accepts a new `embedded?: boolean` prop. When true, suppress the outer `container mx-auto px-4 py-8 max-w-3xl` wrapper, the `<h1>Preferences</h1>` heading, and the subtitle paragraph.

**Theme Switch (SET-10)**
- **D-05**: `<AppearanceSection>` renders a `<SettingsSection title="Theme">` containing the bare `<InlineThemeSegmented>` row — no extra explanatory copy.
- **D-06**: KEEP `<InlineThemeSegmented>` in `<UserMenu>` (duplicate by design). Both surfaces stay in sync via the global `horlo-theme` cookie + `useTheme()` context.
- **D-07**: No re-implementation of `<InlineThemeSegmented>`. Reuse the existing component as-is.

**Privacy + Notifications Restyle (SET-09/SET-11)**
- **D-08**: No code changes for SET-09 + SET-11. Phase 22 D-01 migrated the `<PrivacyToggleRow>` instances. Documented as "verified, no change" in the plan.

**`isChronometer` (FEAT-08)**
- **D-09**: Add `isChronometer: boolean | undefined` to WatchForm's `FormData` type and `initialFormData`.
- **D-10**: Render the Checkbox at the bottom of the Specifications `<Card>`, full-width row below the existing 9-cell grid.
- **D-11**: `<WatchDetail>` Specifications `<dl>` renders an only-if-true row when `watch.isChronometer === true`.
- **D-12**: Server Action `editWatch` already accepts `isChronometer` via Drizzle's row update. Verify the `watchSchema` Zod object in `src/app/actions/watches.ts` includes `isChronometer: z.boolean().optional()`; add if missing.

**`notesPublic` (FEAT-07)**
- **D-13**: Add `notesPublic: boolean` to WatchForm's `FormData` type and `initialFormData`.
- **D-14**: Render a Public/Private pill BELOW the Textarea inside the Notes `<Card>` that visually matches `<NoteVisibilityPill>`. **Implementation choice (planner discretion):** option (a) shared primitive vs. option (b) inline pill. Option (b) is fine for v4.0.
- **D-15**: The existing `<NoteVisibilityPill>` on `/u/{username}/notes` is the canonical per-row toggle and needs NO changes.
- **D-16**: Default `notesPublic = true` for new watches matches the DB column default.
- **D-17**: Server Action `addWatch` / `editWatch` accept `notesPublic`. Verify the watchSchema Zod object includes `notesPublic: z.boolean().optional()`; add if missing.

**Server Action Revalidation Paths**
- **D-18**: `savePreferences` already revalidates both `/preferences` and `/settings` paths.
- **D-19**: `editWatch` / `addWatch` MUST revalidate the per-row note surface (`/u/[username]` layout) when `notesPublic` changes.

**Folded Cleanup**
- **D-20**: Verify Phase 22's stub deletions left no orphan code. Bounded sweep (Delete Account, Coming soon, New Note Visibility, SettingsClient orphans).

### Claude's Discretion

- **Component file factoring** for the two new top Preferences Cards (Option A: separate `<CollectionGoalCard>`/`<OverlapToleranceCard>` files vs. Option B: inline inside `<PreferencesSection>`). UI-SPEC says Option A is "recommended" but both satisfy the design contract.
- **Pill implementation** (D-14): the planner's call between extracting `<VisibilityPill>` primitive vs. inline duplication. UI-SPEC selects Option B (inline) per D-CHOICE rationale.
- **Divider treatment** between top Cards and embedded PreferencesClient (UI-SPEC D-CHOICE-DIVIDER): `border-t border-border pt-6` divider with "Taste preferences" label.
- **Copy harmonization** of existing PreferencesClient option text (em-dashes, added articles).
- **Test rewrites** for any tests that asserted Selects inside PreferencesClient's "Collection Settings" Card (FG-1).

### Deferred Ideas (OUT OF SCOPE)

- Mute-all master toggle on Notifications (defer to v4.x polish).
- shadcn `<Switch>` primitive swap.
- Certifications card for additional credentials (Geneva Seal, Master Chronometer, etc).
- Extracting a shared `<VisibilityPill>` primitive (D-14 option a).
- SET-13 — Account → Delete Account / Danger Zone (deferred to v5+).
- SET-14 — Branded HTML email templates.
- A11y rework of `<PrivacyToggleRow>` aria semantics.
- Per-note category tags / pinning / archiving.
- Diff editor / draft-saving for the Notes textarea.
- Replacing `<PreferencesClient>` entirely with a Settings-tab-native component.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **SET-07** | `<PreferencesSection>` exposes a `collectionGoal` select wired to `user_preferences.collection_goal` | The two top Cards lift the existing Selects from `PreferencesClient.tsx:421-443` to `<PreferencesSection>`. `savePreferences` Zod schema at `src/app/actions/preferences.ts:28-30` already accepts all 4 enum values. Add `'brand-loyalist'` SelectItem with locked copy. |
| **SET-08** | `<PreferencesSection>` exposes an `overlapTolerance` select | Lift from `PreferencesClient.tsx:393-417` to a new top Card. Three enum values already accepted at `preferences.ts:27`. |
| **SET-09** | `<NotificationsSection>` provides UI toggles for `notifyOnFollow` + `notifyOnWatchOverlap` | Already shipped Phase 22 (`NotificationsSection.tsx` lines 20-31). Phase 23 verifies via smoke test only — D-08. |
| **SET-10** | `<AppearanceSection>` houses the theme toggle | Replace `<AppearanceSection>` lucide-Palette stub (file lines 10-21) with `<SettingsSection title="Theme"><InlineThemeSegmented/></SettingsSection>`. `<InlineThemeSegmented>` reused byte-identical (D-07). |
| **SET-11** | `<PrivacySection>` retains existing privacy toggles, restyled into the vertical-tabs frame | Already shipped Phase 22 (`PrivacySection.tsx` lines 18-43). Phase 23 verifies — D-08. |
| **SET-12** | `/preferences` route redirects to `/settings#preferences` | Already shipped Phase 22 D-15 — verified at `src/app/preferences/page.tsx:16` (`redirect('/settings#preferences')`). Phase 23 verifies only. |
| **FEAT-07** | Owner can toggle `notesPublic` per-note from WatchForm + per-row note edit surface | Add inline pill below Notes Textarea in `WatchForm.tsx` Notes card (lines 549-564); per-row pill at `<NoteVisibilityPill>` already interactive (D-15). Add `notesPublic` to Zod schema (D-17 — currently missing). Add revalidation of `/u/[username]` layout to `editWatch` (D-19). |
| **FEAT-08** | User can toggle `isChronometer` in WatchForm and see it displayed in WatchDetail | Add Checkbox row to Specifications card in `WatchForm.tsx` (line 508 — bottom of grid). Add only-if-true `<dl>` row at `WatchDetail.tsx` line 286 (after `productionYear`). `isChronometer` already in Zod schema (`watches.ts:39`) and DAL mapper (`watches.ts:41,78`). |
</phase_requirements>

## Summary

Phase 23 is a UI-surfacing phase with zero schema changes, zero new DAL functions, and one Zod-schema one-line addition. The technical risk is low; the planning risk is medium because component factoring decisions (separate vs. inline new top Cards, Server vs. Client AppearanceSection, pill primitive vs. inline) shape the diff size more than the functional outcome.

The dominant findings: (1) `notesPublic` is the only field truly missing from the action layer — it must be added to `insertWatchSchema` at `src/app/actions/watches.ts:17-49`. `isChronometer` was added in Phase 19.1 (line 39, already present). (2) `editWatch` does NOT currently revalidate `/u/[username]` — only `/` and `revalidateTag('explore')`. The per-row pill on `/u/{username}/notes` will not reflect WatchForm `notesPublic` changes without an explicit `revalidatePath('/u/[username]', 'layout')`. (3) `<AppearanceSection>` becoming a Client Component is OPTIONAL — Next.js 16 allows a Server Component to render `<InlineThemeSegmented>` (a Client Component) as a child, and that is the preferable pattern.

The new top Preferences Cards should be factored as separate Client Components (`<CollectionGoalCard>` + `<OverlapToleranceCard>`) so `<PreferencesSection>` can stay a Server Component, isolating the `useTransition`/Server Action call surface. Inline pills win for `notesPublic` because the WatchForm pill uses local form state while `<NoteVisibilityPill>` uses `useOptimistic` — different state machines that don't share well via a presentational primitive.

**Primary recommendation:** Factor as 4 plans — Plan 01 Wave 0 RED scaffolds (test files), Plan 02 Preferences top Cards + PreferencesClient embed, Plan 03 Appearance + WatchForm field exposures + Zod/revalidation wiring, Plan 04 verification + cleanup sweep (D-20). Use Option A factoring for top Cards (separate files), Option B for the pill (inline). Add `notesPublic` to `insertWatchSchema` and `revalidatePath('/u/[username]', 'layout')` to `editWatch` as part of Plan 03.

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Phase 23 Application |
|------------|--------|----------------------|
| Next.js 16 App Router (no rewrites) | CLAUDE.md "Constraints" | All work uses existing App Router conventions; AGENTS.md note: "This is NOT the Next.js you know — APIs may differ from training data; read `node_modules/next/dist/docs/` before writing." |
| Watch / UserPreferences types are established — extend, don't break | CLAUDE.md "Constraints" | Adding `isChronometer` and `notesPublic` to WatchForm `FormData` (which is `Omit<Watch, 'id'>`) is non-breaking. UserPreferences fields are read, not extended. |
| No `pages/` directory | CLAUDE.md "Frameworks" | All work is App Router (`src/app/`). |
| Strict TypeScript | CLAUDE.md "TypeScript" | Use `boolean | undefined` for Form fields; preserve discriminated unions on `WatchStatus` etc. |
| Use `cn()` helper for conditional classes | CLAUDE.md "Styling" | All new conditional Tailwind composition (e.g., pill state) MUST use `cn()` from `@/lib/utils`. |
| `'use client'` only when needed | CLAUDE.md "React Patterns" | Top Preferences Cards need `'use client'` (Select onValueChange + Server Action call); `<AppearanceSection>` does NOT need to become a Client Component (renders Client child as JSX). `<PreferencesSection>` stays Server Component if top Cards are factored to separate files. |
| Absolute imports via `@/*` | CLAUDE.md "Imports" | All new files use `@/components/...` not relative paths. |
| Components grouped by domain | CLAUDE.md "Architecture" | New top Cards live under `src/components/settings/preferences/` — matches the per-domain pattern. |
| GSD workflow enforcement | CLAUDE.md "GSD Workflow" | This phase is invoked via `/gsd-execute-phase 23`. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 | App Router, Server Actions, revalidatePath | [VERIFIED: `package.json:30`] Pinned framework — `redirect()` preserves URL fragment per current docs. |
| React | 19.2.4 | useTransition, useOptimistic | [VERIFIED: `package.json:32`] Required for the existing `useOptimistic` flow in `<NoteVisibilityPill>` and `<PrivacyToggleRow>`. |
| Zod | 4.3.6 | Server Action input validation | [VERIFIED: `package.json:42`] Pattern: `z.object({...}).safeParse(data)` returning structured errors. |
| Drizzle ORM | 0.45.2 | DAL layer | [VERIFIED: `package.json:25`] `db.update(watches).set({...}).where(...).returning()` already supports `isChronometer` and `notesPublic` columns per schema lines 95, 98. |
| Tailwind CSS | 4 | Utility classes | [VERIFIED: `package.json:50`] All new visuals use Tailwind tokens — see UI-SPEC color & spacing locks. |
| @base-ui/react | 1.3.0 | Tabs, Select, Checkbox, Dialog primitives | [VERIFIED: `package.json:21`] Underlies `<Select>`, `<Checkbox>`, `<Tabs>` shadcn wrappers. |

### Supporting (existing in repo, reused without modification)
| Component | Path | Phase 23 Use |
|-----------|------|--------------|
| `<Card>` family | `src/components/ui/card.tsx` | Two new top Preferences Cards. |
| `<Select>` family | `src/components/ui/select.tsx` | `collectionGoal` and `overlapTolerance` Selects in top Cards (lifted from PreferencesClient). |
| `<Checkbox>` | `src/components/ui/checkbox.tsx` | New `isChronometer` row in WatchForm. |
| `<Label>` | `src/components/ui/label.tsx` | Screen-reader labels paired with Selects (use `sr-only` since CardTitle is the visible label). |
| `<SettingsSection>` | `src/components/settings/SettingsSection.tsx` | Wraps `<InlineThemeSegmented>` in `<AppearanceSection>`. |
| `<InlineThemeSegmented>` | `src/components/layout/InlineThemeSegmented.tsx` | Reused byte-identical (D-07). |
| `<PrivacyToggleRow>` | `src/components/settings/PrivacyToggleRow.tsx` | Reference for switch primitive — not modified. |
| `<NoteVisibilityPill>` | `src/components/profile/NoteVisibilityPill.tsx` | Visual contract for new WatchForm pill — not modified. |
| `cn()` | `src/lib/utils.ts` | All conditional Tailwind composition. |

**Installation:** None — Phase 23 introduces no new dependencies. [VERIFIED: UI-SPEC § Registry Safety lines 522-527 — "No `npx shadcn add` invocations needed for Phase 23."]

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── settings/
│   │   ├── SettingsSection.tsx           # REUSE — heading + card frame
│   │   ├── SettingsTabsShell.tsx         # MODIFY-not-required (existing tabs shell)
│   │   ├── PreferencesSection.tsx        # MODIFY — renders top Cards + embed
│   │   ├── AppearanceSection.tsx         # REWRITE — Theme card; KEEP Server Component
│   │   ├── PrivacySection.tsx            # NO CHANGE (D-08)
│   │   ├── NotificationsSection.tsx      # NO CHANGE (D-08)
│   │   └── preferences/                   # NEW directory
│   │       ├── CollectionGoalCard.tsx    # NEW — Client Component, owns Select + savePreferences
│   │       └── OverlapToleranceCard.tsx  # NEW — Client Component, owns Select + savePreferences
│   ├── preferences/
│   │   └── PreferencesClient.tsx         # MODIFY — add embedded prop, drop Collection Settings Card
│   ├── watch/
│   │   ├── WatchForm.tsx                 # MODIFY — Checkbox + pill rows + FormData fields
│   │   └── WatchDetail.tsx               # MODIFY — only-if-true row in Spec dl
│   └── profile/
│       ├── NoteVisibilityPill.tsx        # NO CHANGE (D-15)
│       └── NoteRow.tsx                   # NO CHANGE
├── app/
│   ├── actions/
│   │   ├── watches.ts                    # MODIFY — add notesPublic to Zod (D-17); add revalidatePath /u/[username] (D-19)
│   │   ├── notes.ts                      # NO CHANGE (per-row pill path)
│   │   └── preferences.ts                # NO CHANGE (Zod already accepts brand-loyalist; revalidatePath already wired)
│   └── preferences/
│       └── page.tsx                       # NO CHANGE (Phase 22 redirect, verify-only)
└── lib/
    └── types.ts                          # NO CHANGE (Watch already has isChronometer + notesPublic)
```

### Pattern 1: New top Card composition (Server parent, Client children)

**What:** `<PreferencesSection>` is a Server Component that renders two new Client Components (`<CollectionGoalCard>` and `<OverlapToleranceCard>`) plus the embedded `<PreferencesClient embedded />`.

**When to use:** When a Server Component needs to render interactive children that hit Server Actions. Avoids forcing the parent into the client bundle while keeping each interactive sub-card's state-management co-located.

**Example:**
```tsx
// Source: Pattern derived from existing src/components/settings/SettingsTabsShell.tsx
//         (Server-rendered shell composing Client Component sections).
// PreferencesSection.tsx (SERVER COMPONENT)
import { PreferencesClient } from '@/components/preferences/PreferencesClient'
import { CollectionGoalCard } from './preferences/CollectionGoalCard'
import { OverlapToleranceCard } from './preferences/OverlapToleranceCard'
import type { UserPreferences } from '@/lib/types'

export function PreferencesSection({ preferences }: { preferences: UserPreferences }) {
  return (
    <div className="space-y-6">
      <CollectionGoalCard initialGoal={preferences.collectionGoal} />
      <OverlapToleranceCard initialTolerance={preferences.overlapTolerance} />
      <div className="border-t border-border pt-6">
        <p className="mb-4 text-xs font-normal uppercase tracking-wide text-muted-foreground">
          Taste preferences
        </p>
        <PreferencesClient embedded preferences={preferences} />
      </div>
    </div>
  )
}
```

```tsx
// CollectionGoalCard.tsx (CLIENT COMPONENT)
'use client'
import { useState, useTransition } from 'react'
import { savePreferences } from '@/app/actions/preferences'
import type { CollectionGoal } from '@/lib/types'
// ...Card + Select primitive imports

export function CollectionGoalCard({ initialGoal }: { initialGoal?: CollectionGoal }) {
  const [goal, setGoal] = useState<CollectionGoal | undefined>(initialGoal)
  const [isSaving, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  function updateGoal(next: CollectionGoal | undefined) {
    setGoal(next)
    setSaveError(null)
    startTransition(async () => {
      const result = await savePreferences({ collectionGoal: next })
      if (!result.success) setSaveError(result.error)
    })
  }
  // ...render Card with Select bound to goal/updateGoal + 4 SelectItems incl. brand-loyalist
}
```

### Pattern 2: Server-Component-renders-Client-child (Appearance)

**What:** `<AppearanceSection>` stays a Server Component (no `'use client'`) and JSX-renders `<InlineThemeSegmented>` as a child. The client component handles its own `'use client'` boundary.

**When to use:** When a wrapper has no client-side state of its own and only composes a child that does. Cheaper than promoting the wrapper.

**Example:**
```tsx
// Source: Next.js 16 docs § "Interleaving Server and Client Components"
// (node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md)
// AppearanceSection.tsx — STAY SERVER (no 'use client' line at top)
import { SettingsSection } from './SettingsSection'
import { InlineThemeSegmented } from '@/components/layout/InlineThemeSegmented'

export function AppearanceSection() {
  return (
    <SettingsSection title="Theme">
      <InlineThemeSegmented />
    </SettingsSection>
  )
}
```

[CITED: Next.js 16 docs `01-app/01-getting-started/05-server-and-client-components.md`] — "You can pass Server Components as a prop to a Client Component" and "RSC payload will contain references of where Client Components should be rendered within the component tree." A Server Component rendering a Client Component as JSX child is the canonical pattern.

**Note:** UI-SPEC § Layout line 175 says "Component becomes a Client Component (`'use client'`) because `<InlineThemeSegmented>` requires it." This is INCORRECT in Next.js 16 — only `<InlineThemeSegmented>` itself needs `'use client'`. `<AppearanceSection>` can stay a Server Component. The planner should choose Server (cleaner; matches `<PrivacySection>` and `<NotificationsSection>` which are also Server Components rendering Client child `<PrivacyToggleRow>`).

### Pattern 3: `embedded` prop with default-false (PreferencesClient)

**What:** A Client Component accepts an `embedded?: boolean` prop. When true, suppresses outer page-chrome (container, h1, subtitle). Default false preserves the standalone render path.

**When to use:** When the same component must render in two contexts (standalone page + embedded in tab) without re-implementation.

**Example:**
```tsx
interface PreferencesClientProps {
  preferences: UserPreferences
  embedded?: boolean
}

export function PreferencesClient({ preferences: initialPreferences, embedded = false }: PreferencesClientProps) {
  // ...existing hooks unchanged

  const innerCards = (
    <div className="space-y-8">
      {/* ...all existing Cards EXCEPT the deleted Collection Settings Card */}
    </div>
  )

  if (embedded) return innerCards  // No outer container, no h1/subtitle

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl text-foreground">Preferences</h1>
        <p className="text-muted-foreground mt-2">
          Configure your collecting taste to get personalized insights.
        </p>
      </div>
      {innerCards}
    </div>
  )
}
```

### Pattern 4: Inline form-state pill (NOT useOptimistic)

**What:** WatchForm's new Public/Private pill uses local React state (`formData.notesPublic`) inside a `useState`-backed form, NOT `useOptimistic` like `<NoteVisibilityPill>`. The pill commit happens on form submit, not on click.

**Why:** Different state machines:
- `<NoteVisibilityPill>` is on a per-row note surface — an instant-save toggle owning its own Server Action call (`updateNoteVisibility`).
- WatchForm pill is one field among many in a deferred-commit form. The form's submit button is the canonical save trigger.

Extracting a shared `<VisibilityPill>` primitive forces either lifting state to call sites (no savings) or parameterizing over the state machine (over-engineered for ~10 lines of Tailwind). [CITED: UI-SPEC § Layout line 274.]

**Code recommendation:** Use the UI-SPEC's `<button role="switch" aria-checked>` skeleton (lines 244-264). The chip styling (`rounded-full px-2.5 py-0.5 text-xs font-normal`, `bg-accent text-accent-foreground` public, `bg-muted text-muted-foreground` private) is locked verbatim from `<NoteVisibilityPill>`.

### Anti-Patterns to Avoid

- **Promoting `<AppearanceSection>` to Client Component unnecessarily.** Don't add `'use client'` to AppearanceSection — InlineThemeSegmented owns its own boundary. Promoting forces all of AppearanceSection's children into the client bundle.
- **Sharing state between WatchForm pill and `<NoteVisibilityPill>` via a primitive.** Different commit semantics; extracting causes tight coupling. Inline duplication (option b) is the correct call.
- **Default-true for `embedded` prop.** D-04 says default `false` to protect the standalone `/preferences/page.tsx` render path even though Phase 22's redirect makes that page unreachable today. Keep the prop opt-in.
- **Calling `editWatch` without revalidating `/u/[username]`** when notesPublic changes. The per-row pill on `/u/{username}/notes` will silently de-sync. See § Common Pitfalls #1.
- **Using `<SettingsSection>` for the top Preferences Cards.** SettingsSection has only a single h2 slot; the top Cards need `<CardTitle>` + `<CardDescription>`. Use shadcn `<Card>` instead. [CITED: UI-SPEC § Anti-Patterns Flagged #1, line 535.]
- **Showing the Chronometer row when `isChronometer === false` or `null`.** Use strict `=== true` only. The DB column is `boolean DEFAULT false` (legacy nullable possible). [CITED: UI-SPEC § Anti-Patterns Flagged #11, line 545.]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Theme persistence/sync between two surfaces | Custom event bus / useEffect cookie sync | Existing `useTheme()` hook from `@/components/theme-provider` | The `horlo-theme` cookie + `useTheme()` is the source of truth — both `<UserMenu>` and the new `<AppearanceSection>` re-render on next React tick from the same context. [VERIFIED: code-read of `src/components/layout/InlineThemeSegmented.tsx:22` — `useTheme()` hook]. |
| Pending state for Server Action save | Custom `isPending` state + setTimeout | `useTransition` (matches PreferencesClient pattern at line 45) | `useTransition` is React 19 idiomatic; bypasses the "saved successfully" flicker by treating the await as a transition. |
| Optimistic toggle for instant UI | Custom rollback logic on error | `useOptimistic` (matches `<NoteVisibilityPill>:28`) | NOT applicable in Phase 23 — top Cards use `useTransition` (Selects, not toggles), and WatchForm pill is local form state. Documented for completeness so the planner doesn't reach for `useOptimistic` and over-engineer. |
| Form revalidation paths | `router.refresh()` chain | `revalidatePath('/u/[username]', 'layout')` in the Server Action | Server-side cache invalidation is the canonical pattern (see `notes.ts:58, 113`). |
| Hash-driven tab routing | URL state library | Existing `parseHash()` + `useEffect` listener in `SettingsTabsShell.tsx` | Already wired in Phase 22 — Phase 23 inherits unchanged. |
| Note-visibility per-row toggle | New pill component | Existing `<NoteVisibilityPill>` (D-15) | Already interactive since prior phase; UI-SPEC's "today the visibility pill is read-only" copy in REQUIREMENTS.md is stale per CONTEXT.md D-15. |

**Key insight:** Phase 23's value comes from composition of existing primitives, not from new infrastructure. Every primitive — `<Card>`, `<Select>`, `<Checkbox>`, `<Label>`, `<SettingsSection>`, `<InlineThemeSegmented>`, `useTransition`, `useOptimistic`, `revalidatePath`, `savePreferences`, `editWatch`, `addWatch` — already exists and is referenced verbatim by CONTEXT.md.

## Common Pitfalls

### Pitfall 1: `editWatch` does not revalidate `/u/[username]` — `notesPublic` desync
**What goes wrong:** The user edits a watch in `<WatchForm>`, toggles the new Public/Private pill from public→private, submits. The form-level `editWatch` call updates the DB but only revalidates `/` and the `'explore'` tag. The per-row pill on `/u/{username}/notes` continues to render `bg-accent text-accent-foreground` (public) until the next full page load.

**Why it happens:** The existing `editWatch` Server Action (`src/app/actions/watches.ts:283-292`) was written before Phase 23 surfaces `notesPublic` from the form. The note-visibility-aware revalidation pattern (`revalidatePath('/u/[username]', 'layout')`) lives only in `updateNoteVisibility` (`notes.ts:58`).

**How to avoid:** Add `revalidatePath('/u/[username]', 'layout')` to BOTH `editWatch` AND `addWatch` Server Actions in Phase 23. Either always-revalidate (simpler, slightly more cache churn) or conditionally — only when `'notesPublic' in parsed.data` (more surgical). The simpler always-path is preferred because watch CRUD inherently affects user-scoped tabs (Notes, Collection, Stats) per Phase 8 reasoning.

**Warning signs:** The user toggles the pill in the form, navigates to their notes tab, and sees the pill in the wrong state. Without explicit revalidation, this is a guaranteed bug.

**Verification command:** `grep -n "revalidatePath" /Users/tylerwaneka/Documents/horlo/src/app/actions/watches.ts` — currently shows only `revalidatePath('/')` lines (241, 284, 316). Add `revalidatePath('/u/[username]', 'layout')` after each.

### Pitfall 2: WatchForm `editWatch` call passes raw `formData`, not `submitData`
**What goes wrong:** `WatchForm.tsx:172-174` shows:
```ts
const result =
  mode === 'edit' && watch
    ? await editWatch(watch.id, formData)        // raw formData
    : await addWatch(submitData)                  // submitData (with photoSourcePath spread)
```
If the executor adds `notesPublic`/`isChronometer` to `formData` but forgets the same in `submitData` (used only for `addWatch`), edit-mode works but create-mode silently drops the new fields — OR vice versa. Existing pattern only spreads `photoSourcePath` differently because that's a transient field.

**Why it happens:** The split between `formData` (edit) and `submitData` (create) is a leaked implementation detail. Both new fields belong in `formData` (which is `Omit<Watch, 'id'>`); `submitData` already spreads `formData` (`...formData`), so the new fields will flow through to both paths automatically — IF added to `formData` and `initialFormData` correctly.

**How to avoid:** Add `isChronometer` and `notesPublic` to BOTH `initialFormData` (lines 41-65) AND the edit-mode hydration block (lines 78-105). Verify the `submitData` spread (line 165-169) still works. The `Omit<Watch, 'id'>` type will surface a TS error if hydration is missed.

**Warning signs:** TypeScript error at the `useState<FormData>(...)` initializer. If TS passes but a field is missing, runtime tests will catch the drop.

### Pitfall 3: `embedded` prop applied to wrong wrapper layer
**What goes wrong:** The executor strips the outer `<div className="container mx-auto px-4 py-8 max-w-3xl">` from PreferencesClient but ALSO strips the inner `<div className="space-y-8">` (which provides Card-to-Card vertical rhythm). Result: all PreferencesClient Cards collapse together with no spacing.

**Why it happens:** Two nested wrappers exist (PreferencesClient.tsx:79 outer + line 87 inner). Only the outer one needs to go.

**How to avoid:** Read UI-SPEC § Layout line 159 — "Keep the inner `<div className="space-y-8">` wrapper that holds the Cards." Test with `getByText('Style Preferences')` and verify computed margin between Cards is non-zero.

**Warning signs:** Visual: tightly-packed Cards inside the Preferences tab. Test: snapshot diff shows `space-y-8` class missing.

### Pitfall 4: Removing the entire "Collection Settings" Card from PreferencesClient leaves nothing
**What goes wrong:** D-02 says "Remove the duplicate `collectionGoal` + `overlapTolerance` Selects from `<PreferencesClient>`'s 'Collection Settings' Card." The current Card contains ONLY these two Selects (lines 387-445). Removing them leaves an empty Card.

**Why it happens:** D-02 hints "the 'Collection Settings' Card title is renamed (e.g., to 'Notes' if that's all that remains, or the Notes Card absorbs it)" — but Notes is in a SEPARATE Card (lines 447-463), so renaming Collection Settings to Notes would create two "Notes" cards.

**How to avoid:** Delete the entire "Collection Settings" `<Card>` block (lines 387-445). The "Additional Notes" Card stays as-is. PreferencesClient's remaining Cards in order: Style Preferences → Design Preferences → Complication Preferences → Dial Color Preferences → Case Size Preferences → Additional Notes.

**Warning signs:** Empty `<Card>` rendering, or a `<CardContent>` with zero children.

### Pitfall 5: AppearanceSection becomes Client Component, breaks unit-test boundary
**What goes wrong:** UI-SPEC line 175 incorrectly states "becomes a Client Component." If the planner follows this literally, AppearanceSection imports `'use client'` unnecessarily, which forces the (potentially heavy) test mock infrastructure into the Server-rendered path.

**Why it happens:** Common training-data assumption: "if my child is a Client Component, I must be one too." Next.js 16 explicitly supports the opposite — Server Components can render Client children.

**How to avoid:** Keep `<AppearanceSection>` as a Server Component. Just delete the Palette stub and replace with `<SettingsSection title="Theme"><InlineThemeSegmented/></SettingsSection>`. No `'use client'` directive needed.

**Warning signs:** TypeScript: AppearanceSection has no client-only hooks (no useState, no useEffect, no event handlers in its own JSX) — promoting to Client Component is unnecessary. Lint with the React Server Components ESLint plugin if available.

**Verification:** [CITED: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` § Interleaving Server and Client Components.]

### Pitfall 6: `notesPublic` Zod schema regression (FG-5 from UI-SPEC)
**What goes wrong:** Per FG-5 (UI-SPEC line 576), `insertWatchSchema` at `src/app/actions/watches.ts:17-49` does NOT currently include `notesPublic`. If the executor wires the WatchForm pill to send the field but forgets the schema addition, Zod silently strips it before the DAL receives the data — the pill always saves the DB default (`true`).

**Why it happens:** `insertWatchSchema` was last touched in Phase 19.1 (added `isChronometer` at line 39, photoSourcePath at lines 45-48). `notesPublic` was added to the DAL mapper in `src/data/watches.ts:82` for the `updateNoteVisibility` path but never added to the form-action schema.

**How to avoid:** Add `notesPublic: z.boolean().optional()` to `insertWatchSchema` at line 39 (after `isChronometer`). The partial schema `updateWatchSchema = insertWatchSchema.partial()` (line 52) automatically inherits.

**Verification:** `grep -n "notesPublic" /Users/tylerwaneka/Documents/horlo/src/app/actions/watches.ts` — currently returns ZERO matches. After fix, returns one line at the schema.

**Test:** Add a unit test that asserts `insertWatchSchema.safeParse({ ...minimalValid, notesPublic: false }).success === true`.

### Pitfall 7: WatchDetail's only-if-true row uses falsy check instead of strict
**What goes wrong:** Using `{watch.isChronometer && (...)}` would render the Chronometer row when `isChronometer === true` — correct. But using `{!!watch.isChronometer && ...}` looks identical and is also correct. The footgun: using `{watch.isChronometer !== undefined && ...}` would render the row when `isChronometer === false` (falsy but defined).

**Why it happens:** D-11 mandates strict equality with `=== true` to handle the legacy DB null case. The existing `<dl>` pattern in WatchDetail uses `watch.caseSizeMm` (truthy check) which works for numbers but is wrong for booleans where `false` is a valid stored value distinct from "not set."

**How to avoid:** Use `{watch.isChronometer === true && (...)}` exactly as in UI-SPEC line 289. Code review: scan for any other boolean fields rendered with `&& (...)` and consider whether they're rendering false-as-truthy or not.

**Warning signs:** "Chronometer: ✓" row shows on watches that explicitly say isChronometer=false (e.g., test fixtures with `isChronometer: false`). 

## Runtime State Inventory

> Phase 23 has zero schema changes and zero rename/refactor. Runtime state inventory is empty.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — zero schema or column-name changes. The columns `is_chronometer`, `notes_public`, `collection_goal`, `overlap_tolerance`, `notify_on_follow`, `notify_on_watch_overlap` ALL already exist in production with their default values. | None |
| Live service config | None — no external services touched. Theme cookie (`horlo-theme`) is set client-side via `useTheme()`; no server-side wiring change. | None |
| OS-registered state | None — no OS-level registrations involved. | None |
| Secrets/env vars | None — no new environment variables. `ANTHROPIC_API_KEY` continues to gate URL extraction (existing FEAT-08 path) but no new key needed. | None |
| Build artifacts | None — `npm run build` will pick up new components automatically. No `pyproject.toml`-style stale egg-info. | None |

**Verified by:** Grep audits for column names, env var references, and build artifacts in `src/`. CONTEXT.md `<specifics>` line 196: "No schema changes."

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js dev server | ✓ (assumed; not pinned) | — | — |
| Supabase local DB | Server Action live test | ✓ (existing dev workflow) | — | RTL component tests run without DB |
| `next` | App Router | ✓ | 16.2.3 | — |
| `vitest` | Unit + component tests | ✓ | 2.1.9 | — |
| `@testing-library/react` | Component tests | ✓ | 16.3.2 | — |
| `@testing-library/user-event` | Click/type interactions | ✓ | 14.6.1 | — |
| `@testing-library/jest-dom` | Custom matchers | ✓ | 6.9.1 | — |
| `jsdom` | DOM stub for vitest | ✓ | 25.0.1 | — |
| `react-testing-library` IntersectionObserver shim | Embla carousel under test | ✓ (`tests/setup.ts:96-125`) | — | — |
| `react-testing-library` matchMedia shim | next-themes under test | ✓ (`tests/setup.ts:31-46`) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

> Validation architecture is included because `.planning/config.json` workflow.nyquist_validation = true.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test -- --reporter=verbose <test-file-glob>` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **SET-07** | `<CollectionGoalCard>` renders 4 SelectItems incl. brand-loyalist; selecting one calls `savePreferences` with `{ collectionGoal: <value> }` | unit (RTL) | `npm run test -- tests/components/settings/preferences/CollectionGoalCard.test.tsx` | ❌ Wave 0 |
| **SET-07** | `<PreferencesSection>` renders `<CollectionGoalCard>` with `initialGoal={preferences.collectionGoal}` | unit (RTL) | `npm run test -- tests/components/settings/PreferencesSection.test.tsx` | ✅ exists; needs new assertions |
| **SET-08** | `<OverlapToleranceCard>` renders 3 SelectItems; selecting one calls `savePreferences` with `{ overlapTolerance: <value> }` | unit (RTL) | `npm run test -- tests/components/settings/preferences/OverlapToleranceCard.test.tsx` | ❌ Wave 0 |
| **SET-09** | `<NotificationsSection>` renders 2 `<PrivacyToggleRow>` instances with notifyOnFollow + notifyOnWatchOverlap | unit (existing) | `npm run test -- tests/components/settings/NotificationsSection.test.tsx` | ✅ exists; verify-only |
| **SET-10** | `<AppearanceSection>` renders `<SettingsSection title="Theme">` containing `<InlineThemeSegmented>` | unit (RTL) | `npm run test -- tests/components/settings/AppearanceSection.test.tsx` | ❌ Wave 0 (new file; existing file may stub the placeholder) |
| **SET-11** | `<PrivacySection>` renders 3 `<PrivacyToggleRow>` instances with profilePublic + collectionPublic + wishlistPublic | unit (existing) | `npm run test -- tests/components/settings/PrivacySection.test.tsx` | ✅ exists; verify-only |
| **SET-12** | `/preferences` returns 307 redirect to `/settings#preferences` | smoke (manual or HTTP-level integration) | manual: `curl -I http://localhost:3000/preferences` ; or unit: existing Phase 22 test | ✅ existing Phase 22 test in 22-VALIDATION.md |
| **FEAT-07** | WatchForm Notes card renders Public/Private pill below Textarea; clicking toggles `formData.notesPublic` | unit (RTL) | `npm run test -- tests/components/WatchForm.test.tsx` (extend existing) | ✅ exists; needs new assertions |
| **FEAT-07** | Submitting WatchForm with `notesPublic: false` calls `addWatch`/`editWatch` with `notesPublic: false` in payload | unit (RTL) | `npm run test -- tests/components/WatchForm.test.tsx` | ✅ exists; needs new assertions |
| **FEAT-07** | Zod `insertWatchSchema` accepts `notesPublic: z.boolean().optional()` | unit (Zod) | `npm run test -- src/app/actions/watches.schema.test.ts` (NEW) | ❌ Wave 0 |
| **FEAT-07** | `editWatch` calls `revalidatePath('/u/[username]', 'layout')` when notesPublic in input | unit (mocked revalidatePath) | `npm run test -- src/app/actions/watches.test.ts` (NEW) | ❌ Wave 0 |
| **FEAT-08** | WatchForm Specifications card renders Chronometer Checkbox at bottom; clicking toggles `formData.isChronometer` | unit (RTL) | `npm run test -- tests/components/WatchForm.test.tsx` | ✅ exists; needs new assertions |
| **FEAT-08** | WatchForm hydrates `formData.isChronometer` from `watch.isChronometer` in edit mode | unit (RTL) | `npm run test -- tests/components/WatchForm.test.tsx` | ✅ exists; needs new assertions |
| **FEAT-08** | `<WatchDetail>` renders "Certification: ✓ Chronometer" row only when `watch.isChronometer === true` (NOT false, NOT null) | unit (RTL) | `npm run test -- src/components/watch/WatchDetail.test.tsx` (NEW) | ❌ Wave 0 |
| **D-20** | Cleanup sweep — zero orphan references to deleted Phase 22 stubs | smoke (grep) | `npm run test:lint-orphans` (or inline grep in plan) | ❌ Wave 0 (or run-once verification) |

### Sampling Rate
- **Per task commit:** `npm run test -- <touched-test-file-glob>` (target test runtime <30s)
- **Per wave merge:** `npm run test -- tests/components/settings tests/components/WatchForm.test.tsx src/components/watch/WatchDetail.test.tsx src/app/actions/watches.test.ts src/app/actions/watches.schema.test.ts` (~60s)
- **Phase gate:** `npm run test` (full suite) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/components/settings/preferences/CollectionGoalCard.test.tsx` — covers SET-07 (NEW file)
- [ ] `tests/components/settings/preferences/OverlapToleranceCard.test.tsx` — covers SET-08 (NEW file)
- [ ] `tests/components/settings/AppearanceSection.test.tsx` — covers SET-10 (NEW file; mock `<InlineThemeSegmented>` to avoid `useTheme()` provider boilerplate)
- [ ] `src/components/watch/WatchDetail.test.tsx` — covers FEAT-08 only-if-true row (NEW file)
- [ ] `src/app/actions/watches.test.ts` — covers FEAT-07/08 Zod schema accepting both fields + revalidation paths (NEW file)
- [ ] `src/app/actions/watches.schema.test.ts` — pure Zod schema unit tests if separated from action tests (planner discretion; can fold into above)
- [ ] `tests/components/WatchForm.test.tsx` extension — add assertions for Chronometer Checkbox + Public/Private pill rendering, hydration from `watch` prop, and submission payloads (existing file)
- [ ] `tests/components/settings/PreferencesSection.test.tsx` extension — assert that `<CollectionGoalCard>` and `<OverlapToleranceCard>` are rendered ABOVE the embedded `<PreferencesClient>` (existing file)

**Framework install:** None needed — vitest 2.1.9 + RTL + jsdom already present.

**Test patterns reused:**
- `vi.mock('@/app/actions/preferences', () => ({ savePreferences: vi.fn(...) }))` — already used in PreferencesSection.test.tsx
- `vi.hoisted(() => ...)` lift for top-level mock factory references — established in Phase 22 (per 22-05-SUMMARY.md decisions block)
- Mock `useRouter` from next/navigation — pattern at `tests/components/WatchForm.test.tsx:19-22`
- Mock `<CatalogPhotoUploader>` with stub div — pattern at `tests/components/WatchForm.test.tsx:34-38`

## Security Domain

> Required when `security_enforcement` is enabled. Phase 23 has minimal security surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no new auth surface; existing `getCurrentUser()` gates Server Actions) |
| V3 Session Management | no | — (no session changes) |
| V4 Access Control | yes | `editWatch`/`addWatch` already enforce owner-scope via `WHERE user_id = current user` (`watches.ts:283-292`); `getWatchByIdForViewer` enforces viewer-aware reads (`watches.ts:121-159`); IDOR pattern locked. |
| V5 Input Validation | yes | Zod schema at `src/app/actions/watches.ts:17-49`; add `notesPublic: z.boolean().optional()` (D-17). All form fields validated server-side before DAL. |
| V6 Cryptography | no | — (no crypto operations) |

### Known Threat Patterns for Next.js 16 + Supabase RLS + Drizzle

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR via watch ID in form action | Tampering | UPDATE WHERE user_id = current user — already in place at `watches.ts:283-292` |
| Stored XSS via notes textarea | Tampering | Notes are stored as plain text and rendered as text in `<NoteRow>` (no `dangerouslySetInnerHTML`); React auto-escapes JSX text. No new attack surface. |
| Information disclosure via `notesPublic` toggle | Information Disclosure | Default `true` matches existing semantics. No silent default-flip. The toggle is per-watch and explicit. |
| CSRF on Server Actions | Spoofing/Tampering | Next.js 16 Server Actions enforce same-origin POST + signed action IDs by default; no Phase 23 change needed. |

**Threat model verdict:** Trivial. The single new field that could affect data exposure (`notesPublic`) defaults to `true` matching the DB default, and the per-row pill is unchanged. The `isChronometer` field is per-row data with no cross-user implications.

## Code Examples

Verified patterns from the codebase:

### Lifting a Select with Server Action save (top Card pattern)
```tsx
// Source: derived from src/components/preferences/PreferencesClient.tsx:38-63
'use client'
import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { savePreferences } from '@/app/actions/preferences'
import type { CollectionGoal } from '@/lib/types'

interface CollectionGoalCardProps {
  initialGoal?: CollectionGoal
}

export function CollectionGoalCard({ initialGoal }: CollectionGoalCardProps) {
  const [goal, setGoal] = useState<CollectionGoal | undefined>(initialGoal)
  const [isSaving, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  function updateGoal(next: CollectionGoal | undefined) {
    setGoal(next)
    setSaveError(null)
    startTransition(async () => {
      const result = await savePreferences({ collectionGoal: next })
      if (!result.success) setSaveError(result.error)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collection goal</CardTitle>
        <CardDescription>How do you want your collection to grow over time?</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 w-full sm:max-w-md">
          <Label htmlFor="collectionGoal" className="sr-only">Collection goal</Label>
          <Select
            value={goal ?? ''}
            onValueChange={(v) => updateGoal((v || undefined) as CollectionGoal | undefined)}
          >
            <SelectTrigger id="collectionGoal">
              <SelectValue placeholder="Select a goal..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balanced">Balanced — Diverse collection across styles</SelectItem>
              <SelectItem value="specialist">Specialist — Deep in one area</SelectItem>
              <SelectItem value="variety-within-theme">Variety within a theme</SelectItem>
              <SelectItem value="brand-loyalist">Brand Loyalist — Same maker, different models</SelectItem>
            </SelectContent>
          </Select>
          {saveError && <p role="alert" className="text-sm text-destructive">Couldn&apos;t save: {saveError}</p>}
          {isSaving && !saveError && <p className="text-xs text-muted-foreground" aria-live="polite">Saving…</p>}
        </div>
      </CardContent>
    </Card>
  )
}
```

### Inline Public/Private pill in WatchForm (Pattern 4)
```tsx
// Source: derived from src/components/profile/NoteVisibilityPill.tsx:49-69 (style)
//          + src/components/watch/WatchForm.tsx form-state pattern
{/* Inside the Notes Card, BELOW the existing <Textarea>: */}
<div className="flex items-center gap-2">
  <span className="text-xs text-muted-foreground">Visibility:</span>
  <button
    type="button"
    role="switch"
    aria-checked={formData.notesPublic === true}
    aria-label={
      formData.notesPublic === true
        ? 'Note is public, click to make private'
        : 'Note is private, click to make public'
    }
    onClick={() =>
      setFormData((prev) => ({ ...prev, notesPublic: !(prev.notesPublic === true) }))
    }
    className={cn(
      'rounded-full px-2.5 py-0.5 text-xs font-normal transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
      formData.notesPublic === true
        ? 'bg-accent text-accent-foreground hover:bg-accent/90'
        : 'bg-muted text-muted-foreground hover:bg-muted/70',
    )}
  >
    {formData.notesPublic === true ? 'Public' : 'Private'}
  </button>
</div>
```

### Only-if-true row in WatchDetail Specifications `<dl>`
```tsx
// Source: matches src/components/watch/WatchDetail.tsx:281-286 productionYear pattern
//          + UI-SPEC line 289-298
{/* Insert after watch.productionYear row, BEFORE the closing </dl> at line 287 */}
{watch.isChronometer === true && (
  <div>
    <dt className="text-muted-foreground">Certification</dt>
    <dd className="font-semibold flex items-center gap-1">
      <Check className="size-4 text-foreground" aria-hidden />
      <span>Chronometer</span>
    </dd>
  </div>
)}
```

### Adding `notesPublic` to Zod schema (FG-5 fix)
```ts
// Source: src/app/actions/watches.ts — modify insertWatchSchema (line 17-49)
const insertWatchSchema = z.object({
  // ...existing fields up through line 39 isChronometer...
  isChronometer: z.boolean().optional(),
  notesPublic: z.boolean().optional(),     // NEW (D-17, FG-5)
  notes: z.string().optional(),
  // ...rest unchanged...
})
```

### Adding revalidation path to editWatch / addWatch (D-19 fix)
```ts
// Source: src/app/actions/watches.ts — modify editWatch (line 283-292) and addWatch (line 241-251)
// editWatch:
const watch = await watchDAL.updateWatch(user.id, watchId, parsed.data)
revalidatePath('/')
revalidatePath('/u/[username]', 'layout')   // NEW (D-19) — keeps NoteVisibilityPill in sync
revalidateTag('explore', 'max')
return { success: true, data: watch }

// addWatch (insertion point: after line 241 revalidatePath('/')):
revalidatePath('/')
revalidatePath('/u/[username]', 'layout')   // NEW (D-19) — for completeness
revalidateTag('explore', 'max')
```

### `embedded` prop pattern in PreferencesClient
```tsx
// Source: derived from src/components/preferences/PreferencesClient.tsx:38, 78-92
interface PreferencesClientProps {
  preferences: UserPreferences
  embedded?: boolean   // NEW (D-04)
}

export function PreferencesClient({ preferences: initialPreferences, embedded = false }: PreferencesClientProps) {
  // ...existing useState/useTransition/useState declarations unchanged...

  const inner = (
    <div className="space-y-8">
      {saveError && (<p role="alert" className="text-sm text-destructive">...</p>)}
      {isSaving && !saveError && (<p className="text-xs text-muted-foreground" aria-live="polite">Saving…</p>)}
      {/* All Cards EXCEPT the deleted Collection Settings Card */}
      {/* Style Preferences */}
      {/* Design Preferences */}
      {/* Complication Preferences */}
      {/* Dial Color Preferences */}
      {/* Case Size Preferences */}
      {/* Additional Notes */}
    </div>
  )

  if (embedded) return inner

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl text-foreground">Preferences</h1>
        <p className="text-muted-foreground mt-2">Configure your collecting taste to get personalized insights.</p>
      </div>
      {inner}
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages-router redirects via `getServerSideProps` | App Router `redirect('/path#fragment')` preserving fragment | Next.js 13+ | Phase 22 D-15 already uses this; Phase 23 inherits. |
| Class components | Functional + hooks | React 16.8+ | All Horlo components functional. |
| Per-component prop drilling for theme | `useTheme()` context with cookie-backed source | Phase ≤ Phase 22 | Phase 23 reuses; no new state-sync code. |
| Custom localStorage-backed Zustand persist | Server-rendered `user_preferences` row + Server Action upsert | Pre-v3.0 milestone | Phase 23 reads from server-rendered prop; no Zustand involvement. |
| `router.push('#hash')` for tab switching | `window.history.pushState(null, '', '#hash')` | Phase 22 D-17 | Avoids re-running Server Component loader on tab switch. |

**Deprecated/outdated:**
- The `<SettingsClient>` legacy single-page settings was deleted Phase 22 D-04. Verified zero src/ references via grep for `SettingsClient` (only doc-comment mentions in PrivacySection/NotificationsSection JSDoc remain — non-actionable).
- The `/preferences` standalone page was redirect-only since Phase 22 D-15. Verified at `src/app/preferences/page.tsx:16`.
- The "Coming in Phase 23" Appearance stub at `<AppearanceSection>` will be replaced by Phase 23 itself.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The planner will choose Option A factoring (separate `<CollectionGoalCard>`/`<OverlapToleranceCard>` files) over Option B (inline in `<PreferencesSection>`). | § Architecture Patterns | Low — both satisfy the design contract per UI-SPEC. The only risk is forcing `<PreferencesSection>` to become a Client Component if Option B is chosen, which leaks the Server Component bundle into client. Mitigation: research recommends Option A explicitly. |
| A2 | `<AppearanceSection>` should stay a Server Component (NOT switch to Client). | § Architecture Patterns Pattern 2 | Low — UI-SPEC line 175 says "becomes a Client Component" which is incorrect per Next.js 16 docs. If executor follows UI-SPEC literally, the only impact is unnecessary `'use client'` directive — functionally equivalent, slightly worse bundle hygiene. |
| A3 | `revalidatePath('/u/[username]', 'layout')` is the correct cache-tag for the per-row note pill on `/u/{username}/notes`. | § Common Pitfalls #1 | Low — verified by reading `notes.ts:58, 113` which use this exact pattern. Risk: if Phase 8 layout structure changes in a future phase, the path may need updating. Currently correct. |
| A4 | The "Collection Settings" Card in PreferencesClient (lines 387-445) contains ONLY the two lifted Selects, so deletion leaves nothing to rename. | § Common Pitfalls #4 | Low — verified by reading lines 387-445 of PreferencesClient.tsx. The Card has only `<CardTitle>Collection Settings</CardTitle>` and the two Selects in `<CardContent>`. |

**If this table has 4 entries:** Each one is documented and has Low risk. The planner should still surface A1 to the user as "we recommend Option A but we'll defer if you want minimal diff." A2 should override the UI-SPEC's Server-vs-Client guidance (the UI-SPEC has a documentation bug). A3 and A4 are pure code-read confirmations.

## Open Questions (RESOLVED)

1. **Option A vs. Option B for top Card factoring?**
   - What we know: UI-SPEC § Component Mapping line 459 says "Option A (recommended)" — separate `<CollectionGoalCard>` + `<OverlapToleranceCard>` files. UI-SPEC also notes "Both options satisfy the design contract."
   - What's unclear: Whether the user prefers minimal diff (Option B) or cleaner separation (Option A).
   - **RESOLVED: Option A — separate files** under `src/components/settings/preferences/`. Plan 02 implements this. Confirmed by both UI-SPEC and CLAUDE.md "components are grouped by domain" convention. The ~10-minute escape hatch to inline (Option B) remains available if reviewer prefers a smaller diff.

2. **Where do `<CollectionGoalCard>`/`<OverlapToleranceCard>` live in the file tree?**
   - What we know: CONTEXT.md `<code_context>` line 174 says "New file(s) created under `src/components/settings/preferences/` (planner's call on file factoring)."
   - What's unclear: Whether to add an index.ts barrel or import the components directly.
   - **RESOLVED: Direct imports, no barrel.** Plans 02/03 import via `@/components/settings/preferences/CollectionGoalCard` directly. Matches the CLAUDE.md convention "No barrel files (no `index.ts` re-exports from component folders)."

3. **Should the `embedded` prop default be `true` or `false`?**
   - What we know: D-04 says default `false` to "preserve byte-identical render path if `/preferences/page.tsx` is ever re-mounted as a standalone page."
   - What's unclear: Whether re-mounting `/preferences/page.tsx` as a standalone page is a real future requirement or just defensive.
   - **RESOLVED: `embedded?: boolean = false`** (D-04 default). Plan 02 implements. `<PreferencesSection>` passes `embedded={true}` explicitly. Defensive default protects the unmounted standalone page if a future caller resurrects it.

4. **Should `addWatch` also call `revalidatePath('/u/[username]', 'layout')`?**
   - What we know: D-19 says "`editWatch` / `addWatch` MUST revalidate the per-row note surface ... when `notesPublic` changes." Both Server Actions are mentioned.
   - What's unclear: Whether `addWatch`'s creation of a new row affects the per-row note surface (a brand-new note appears at `/u/{username}/notes` immediately after creation).
   - **RESOLVED: Yes — add to BOTH `addWatch` and `editWatch`.** Plan 05 wires both. A newly-created row with a note IS a new entry that must appear on the user's notes tab without a hard refresh. One line per action; prevents "new watch added but doesn't show in /u/{username}/notes" UX regression.

## Sources

### Primary (HIGH confidence)
- `src/app/actions/watches.ts` (lines 17-50, 60-261, 269-302) — Zod schema and Server Action source-of-truth
- `src/app/actions/preferences.ts` (lines 12-32, 40-67) — Zod schema, savePreferences action, revalidation paths
- `src/app/actions/notes.ts` (lines 11-64) — updateNoteVisibility Server Action; the canonical revalidation pattern reference
- `src/components/preferences/PreferencesClient.tsx` (lines 38-468) — full component to extract `embedded` prop from + Cards to lift
- `src/components/watch/WatchForm.tsx` (lines 1-591) — full WatchForm including initialFormData (41-65), edit-mode hydration (78-105), submit logic (123-182), Specifications Card (348-509), Notes Card (549-564)
- `src/components/watch/WatchDetail.tsx` (lines 240-287) — Specifications `<dl>` exact insertion point at line 286
- `src/components/profile/NoteVisibilityPill.tsx` (lines 1-71) — visual contract for new WatchForm pill
- `src/components/layout/InlineThemeSegmented.tsx` (lines 1-67) — theme switch component to mount in `<AppearanceSection>`
- `src/components/settings/SettingsSection.tsx` — heading + card frame primitive
- `src/components/settings/AppearanceSection.tsx` (lines 1-21) — current stub to replace
- `src/components/settings/PreferencesSection.tsx` (lines 1-26) — current passthrough to modify
- `src/components/settings/PrivacySection.tsx` (lines 1-43) — verify-no-change reference
- `src/components/settings/NotificationsSection.tsx` (lines 1-35) — verify-no-change reference
- `src/components/settings/SettingsTabsShell.tsx` (lines 1-165) — Client Component shell that mounts AppearanceSection (confirms safe to keep AppearanceSection as Server)
- `src/data/watches.ts` (lines 17-86, 162-198) — DAL mapper confirming `isChronometer` and `notesPublic` already supported
- `src/lib/types.ts` (lines 17-60) — Watch type confirming `isChronometer?: boolean` and `notesPublic?: boolean` already declared
- `src/db/schema.ts` lines 95, 98 — DB columns `is_chronometer boolean DEFAULT false` and `notes_public boolean NOT NULL DEFAULT true` confirmed
- `src/app/preferences/page.tsx` (lines 1-17) — confirmed Phase 22 redirect already shipped
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` — Server-Component-renders-Client-child interleaving pattern
- `package.json` lines 4-19 — npm test scripts; lines 30-50 — pinned versions of Next.js 16.2.3, React 19.2.4, Zod 4.3.6, Vitest 2.1.9
- `vitest.config.ts` — test file globs and jsdom env confirmation
- `tests/setup.ts` — matchMedia, IntersectionObserver, localStorage shims for component tests
- `.planning/phases/22-settings-restructure-account-section/22-05-SUMMARY.md` — Phase 22 SettingsClient deletion + revalidatePath('/settings') addition; vi.hoisted lift pattern
- `.planning/phases/23-settings-sections-schema-field-ui/23-CONTEXT.md` D-01..D-20 — locked decisions
- `.planning/phases/23-settings-sections-schema-field-ui/23-UI-SPEC.md` — visual/interaction contract

### Secondary (MEDIUM confidence)
- Existing test files for similar patterns: `tests/components/settings/PreferencesSection.test.tsx`, `tests/components/WatchForm.test.tsx`, `src/components/watch/WatchForm.lockedStatus.test.tsx`
- Phase 22 D-19 recovery pattern (revalidate `/u/[username]` layout for cross-tab notes)

### Tertiary (LOW confidence)
- None — all critical claims are verified via direct code-read or canonical CONTEXT.md decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every primitive verified by direct code-read with line numbers
- Architecture: HIGH — Server/Client composition rules confirmed against Next.js 16 docs in node_modules
- Pitfalls: HIGH — every pitfall maps to an exact line number or grep verification
- Validation Architecture: HIGH — vitest 2.1.9 + RTL config confirmed; existing test patterns referenced

**Key facts to lock for the planner:**
1. `notesPublic` is missing from `src/app/actions/watches.ts` Zod schema (FG-5). Must add as one-line.
2. `editWatch` does NOT revalidate `/u/[username]` (D-19 wiring missing). Must add as one-line.
3. `<AppearanceSection>` should stay Server Component — UI-SPEC line 175 has a documentation bug.
4. `isChronometer` IS in Zod schema (line 39) and DAL mapper (lines 41, 78). Already wired through.
5. `savePreferences` Zod schema accepts `brand-loyalist` (line 29). UI-only gap.
6. `/preferences` redirect to `/settings#preferences` already shipped (D-15 from Phase 22). Verify-only.
7. Phase 22 cleanup left zero orphans (grep audit confirmed; D-20 sweep is a no-op verification).
8. The "Collection Settings" Card in PreferencesClient (lines 387-445) becomes empty after lifting Selects; delete the entire Card block.
9. Top Cards: factor as `src/components/settings/preferences/{CollectionGoalCard,OverlapToleranceCard}.tsx`; each is a Client Component owning useTransition + savePreferences.
10. Inline pill in WatchForm (option b) — match `<NoteVisibilityPill>` styles verbatim; do not extract a primitive.

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (30 days — stable Next.js 16.2.3 + React 19.2.4; no fast-moving deps in scope)

---
phase: 08-self-profile-privacy-controls
plan: 03
subsystem: profile-tabs-collection-wishlist-notes
tags: [profile-tabs, collection, wishlist, notes, react-19, useoptimistic, privacy, server-actions]

requires:
  - phase: 08-self-profile-privacy-controls
    plan: 01
    provides: updateNoteVisibility Server Action, getProfileByUsername / getProfileSettings DAL, watches.notesPublic + notesUpdatedAt columns
  - phase: 08-self-profile-privacy-controls
    plan: 02
    provides: /u/[username]/[tab] route shell, layout with viewer-aware data fetch, ProfileTabs URL-driven nav, ProfileHeader, AvatarDisplay, TasteTagPill, LockedProfileState
provides:
  - Tab page router at src/app/u/[username]/[tab]/page.tsx with viewer-aware per-tab visibility gates (PRIV-02 / PRIV-03 / PRIV-04)
  - ProfileWatchCard with status badge overlay (Worn today / Not worn recently) + Last worn label
  - CollectionTabContent with dynamically-derived FilterChips (top 6 roleTags), search input, and owner-only AddWatchCard
  - WishlistTabContent with target price + notes preview surfaced via showWishlistMeta
  - NotesTabContent + NoteRow + NoteVisibilityPill (optimistic per-note toggle) + RemoveNoteDialog
  - removeNote Server Action (ownership-scoped UPDATE, T-08-19 IDOR mitigation, ActionResult contract)
affects: [profile-route-shell, /u/[username]/collection, /u/[username]/wishlist, /u/[username]/notes]

tech-stack:
  added: []
  patterns:
    - "Per-tab visibility gate at the Server Component layer (PRIV-05): tab page early-returns PrivateTabState when viewer != owner && respective public flag is false"
    - "Per-note visibility filter applied server-side before sending to client (T-08-17): isOwner || w.notesPublic !== false"
    - "Optimistic-toggle ownership: NoteVisibilityPill is the SINGLE source of truth for notes_public; the 3-dot dropdown deliberately omits a redundant visibility item to avoid racing the optimistic flow"
    - "useOptimistic + useTransition pattern for client-side instant feedback with server reconciliation"
    - "Dynamic chip derivation: FilterChips options computed via useMemo from roleTags counts in the rendered collection (capped at top 6)"

key-files:
  created:
    - src/components/profile/ProfileWatchCard.tsx
    - src/components/profile/FilterChips.tsx
    - src/components/profile/AddWatchCard.tsx
    - src/components/profile/CollectionTabContent.tsx
    - src/components/profile/WishlistTabContent.tsx
    - src/components/profile/NotesTabContent.tsx
    - src/components/profile/NoteRow.tsx
    - src/components/profile/NoteVisibilityPill.tsx
    - src/components/profile/RemoveNoteDialog.tsx
  modified:
    - src/app/u/[username]/[tab]/page.tsx (placeholder → real tab dispatcher)
    - src/app/actions/notes.ts (extended with removeNote)

key-decisions:
  - "PRIV-04 (worn_public) gate added to the tab page even though Worn tab content is Plan 04 — the privacy check belongs with the route layer, not the content component, so the gate is in place when Plan 04 fills in WornTabContent"
  - "AddWatchCard route verified against src/app/watch/new/page.tsx — the existing add-watch flow lives at /watch/new (not /watch/add)"
  - "Edit-note route verified against src/app/watch/[id]/edit/ — NoteRow's Edit Note menu item points to /watch/[id]/edit which is the existing edit flow"
  - "Collection empty state for owner includes an inline AddWatchCard (centered, max-width) so the empty state itself is actionable; non-owner empty state shows neutral copy without the CTA"
  - "Three-dot dropdown contains ONLY Edit Note + Remove Note; visibility toggle deliberately omitted (per plan must_haves and architecture comment) to keep NoteVisibilityPill as single source of truth — eliminates the optimistic-state race"
  - "DropdownMenuItem 'Remove Note' uses the base-ui variant='destructive' prop (verified against src/components/ui/dropdown-menu.tsx) instead of a className override — matches the established primitive pattern"
  - "DropdownMenuItem with Link uses the render={<Link />} prop pattern (base-ui composition) consistent with how ProfileTabs composes Link into TabsTrigger — avoids asChild which base-ui does not support"

requirements-completed: [PROF-02, PROF-03, PROF-05, PRIV-02, PRIV-03, PRIV-05]

duration: ~25 min
completed: 2026-04-21
---

# Plan 08-03: Collection / Wishlist / Notes Tabs Summary

**Replaces the Plan 02 placeholder tab page with three viewer-aware tab content components — Collection (filter chips + search + owner-only Add Watch card), Wishlist (target price + notes), and Notes (per-row optimistic visibility pill + remove dialog) — and adds a Zod-strict ownership-scoped `removeNote` Server Action. Per-tab and per-note visibility flags gate non-owners at the Server Component layer (PRIV-02 / PRIV-03 / PRIV-05).**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (both auto)
- **Commits:** 2 (one per task, both with --no-verify per parallel-execution protocol)
- **New files:** 9 (1 card, 2 helper UI, 3 tab content, 3 note components)
- **Modified files:** 2 ([tab]/page.tsx, actions/notes.ts)

## Accomplishments

- `[tab]/page.tsx` now dispatches by tab: collection / wishlist / notes share a single watches+wear data fetch (`getWatchesByUser` + `getMostRecentWearDates`); worn / stats fall through to a placeholder until Plan 04
- Per-tab visibility gates honor `collection_public` / `wishlist_public` / `worn_public` for non-owners — render `PrivateTabState` instead of leaking content (PRIV-02 / PRIV-03 / PRIV-04)
- Per-note visibility filter applied server-side: non-owners only see `notes_public !== false` notes (D-13, T-08-17 mitigation)
- `ProfileWatchCard` shows accent "Worn today" pill when `daysSince === 0`, white outline "Not worn recently" pill when `daysSince >= SLEEPING_BEAUTY_DAYS (30)`, no badge in between; "Last worn X ago" / "Worn yesterday" / "Worn today" / "Never worn" copy below the model name
- `CollectionTabContent` derives FilterChips dynamically from `roleTags` (top 6 by count, prefixed with "All"); search input filters case-insensitively across `brand` and `model`; owner-only `AddWatchCard` appended to the grid
- `WishlistTabContent` reuses the same card grid (filtered to `status` ∈ {wishlist, grail}) with `showWishlistMeta` surfacing target price + truncated notes
- `removeNote` Server Action: ownership-scoped UPDATE (`WHERE id = x AND user_id = current`), 0-row return surfaced as generic "Watch not found" (T-08-19 IDOR), `revalidatePath('/u/[username]/notes', 'page')` on success
- `NoteVisibilityPill` is the canonical visibility toggle: `useOptimistic` + `useTransition` for instant feedback; disabled state for non-owners renders a read-only pill
- `NoteRow` includes 48px thumbnail, brand+model link, full note text (`whitespace-pre-wrap`, React-escaped — XSS mitigation T-08-20), the pill, "X days ago" timestamp, and an owner-only 3-dot DropdownMenu with **only** Edit Note + Remove Note (visibility toggle deliberately absent — would race the pill's optimistic flow)
- `RemoveNoteDialog` uses the base-ui `Dialog` primitive (no AlertDialog export — verified) with exact UI-SPEC copy: title "Remove this note?", body interpolating brand+model, "Keep Note" outline button + "Remove Note" destructive button

## Task Commits

1. **Task 1 (auto):** `0317bed` — feat(08-03): tab router + Collection/Wishlist tabs + ProfileWatchCard
2. **Task 2 (auto):** `4b34f67` — feat(08-03): Notes tab — NoteRow + optimistic visibility pill + remove dialog

## Files Created/Modified

**Created (9):**
- `src/components/profile/ProfileWatchCard.tsx` — image with badge overlay + last-worn label + optional wishlist meta
- `src/components/profile/FilterChips.tsx` — pill-style segmented selector
- `src/components/profile/AddWatchCard.tsx` — dashed-border CTA card linking to `/watch/new`
- `src/components/profile/CollectionTabContent.tsx` — Collection grid + dynamic chips + search
- `src/components/profile/WishlistTabContent.tsx` — Wishlist grid with `showWishlistMeta`
- `src/components/profile/NotesTabContent.tsx` — list of NoteRow with empty-state copy
- `src/components/profile/NoteRow.tsx` — thumbnail + body + pill + 3-dot menu (owner-only)
- `src/components/profile/NoteVisibilityPill.tsx` — `useOptimistic` toggle owning `notes_public` state
- `src/components/profile/RemoveNoteDialog.tsx` — Dialog with exact UI-SPEC copy

**Modified (2):**
- `src/app/u/[username]/[tab]/page.tsx` — placeholder → real tab dispatcher with viewer-aware data fetch + visibility gates
- `src/app/actions/notes.ts` — extended with `removeNote` (Plan 01's `updateNoteVisibility` preserved)

## Decisions Made

- **Worn-tab privacy gate added now** — even though Plan 04 ships WornTabContent, the per-tab visibility check on `worn_public` belongs at the route layer; placing it in `[tab]/page.tsx` now means Plan 04 inherits the gate without duplicating logic.
- **Owner-only Add Watch in empty state** — when an owner has no watches, the empty state itself includes a centered AddWatchCard (max-width xs). Non-owners see neutral copy ("This collector hasn't added any watches yet.") without the CTA.
- **DropdownMenuItem with Link uses `render={<Link />}` prop** — base-ui composition pattern (verified by reading `src/components/ui/dropdown-menu.tsx` and `src/components/profile/ProfileTabs.tsx`). Plan suggested `asChild`, which base-ui's primitive does not implement.
- **DropdownMenuItem destructive variant** — used the base-ui `variant="destructive"` prop discovered in `dropdown-menu.tsx` (line 91) instead of a `className="text-destructive"` override; matches the established primitive pattern and gets focus styling for free.
- **Dropdown Edit Note routes to `/watch/[id]/edit`** — verified the route exists at `src/app/watch/[id]/edit/`. The note-edit experience reuses the existing watch-edit form (notes is one of the editable fields) rather than a notes-only modal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan defect — base-ui composition] DropdownMenuItem `asChild` → `render` prop**
- **Found during:** Task 2
- **Issue:** Plan snippet used `<DropdownMenuItem asChild><Link …>Edit Note</Link></DropdownMenuItem>`. base-ui's Menu.Item primitive does not implement `asChild` (it uses base-ui's `useRender` composition via the `render` prop, the same pattern Plan 02's `ProfileTabs` uses to compose `Link` into `TabsTrigger`).
- **Fix:** Switched to `<DropdownMenuItem render={<Link href={…} />}>Edit Note</DropdownMenuItem>`. Confirmed by reading `src/components/ui/dropdown-menu.tsx` (no `asChild` prop on `MenuPrimitive.Item.Props`) and `src/components/profile/ProfileTabs.tsx` (uses `render={<Link …>}` for `TabsTrigger`).
- **Files modified:** `src/components/profile/NoteRow.tsx`
- **Commit:** `4b34f67`

**2. [Plan defect — destructive variant] `className="text-destructive"` → `variant="destructive"`**
- **Found during:** Task 2
- **Issue:** Plan snippet styled the destructive Remove Note item with a `className="text-destructive"` override. The base-ui DropdownMenuItem primitive already supports `variant="destructive"` (verified line 91 of `dropdown-menu.tsx`) which yields proper focus state + icon coloring.
- **Fix:** Used `variant="destructive"` instead of the className override.
- **Files modified:** `src/components/profile/NoteRow.tsx`
- **Commit:** `4b34f67`

**3. [Project rule — no font-medium] Plan snippets used `font-medium`**
- **Found during:** Implementation
- **Issue:** Plan-written ProfileWatchCard / FilterChips snippets implicitly relied on default Tailwind font weights, but the project's `tests/no-raw-palette.test.ts` forbids `font-medium`, `font-bold`, `font-light` in `src/components/**`. Plan-style "font-normal" was already specified in most places, but the `text-sm font-medium text-muted-foreground` style for the brand line in ProfileWatchCard (verbatim from the plan) needed adjustment.
- **Fix:** Used `font-normal` (Body weight) for the brand line and `font-semibold` (Heading weight) for the model line — matches the two-weight system established in Plan 02 (per `08-UI-SPEC.md`).
- **Files modified:** `src/components/profile/ProfileWatchCard.tsx`, `src/components/profile/FilterChips.tsx`
- **Commit:** `0317bed`
- **Verification:** `npm test -- --run tests/no-raw-palette.test.ts` → 952/952 passing.

**4. [Task ordering — placeholder for cross-task dependency] NotesTabContent stub in Task 1**
- **Found during:** Task 1 implementation
- **Issue:** Task 1's `[tab]/page.tsx` imports `NotesTabContent`, but the full NotesTabContent (with NoteRow integration) is Task 2. Without a Task 1 stub the build would fail at the Task 1 commit boundary.
- **Fix:** Created a minimal `NotesTabContent` stub in Task 1 that renders the correct empty state and a placeholder row. Task 2 replaced the stub with the real NoteRow-driven implementation. Both Task 1 and Task 2 leave the project in a buildable state.
- **Files modified:** `src/components/profile/NotesTabContent.tsx` (created in Task 1, replaced in Task 2)
- **Commits:** `0317bed` (stub) → `4b34f67` (real)

---

**Total deviations:** 4 — two plan-defect auto-fixes (asChild → render, className → variant), one project-rule auto-fix (font weights), one task-ordering decision (Task 1 stub).
**Impact on plan:** No scope change. All deviations preserve plan intent and align with project conventions / primitives.

## Threat Flags

None — surfaces introduced in this plan are accounted for in the plan's threat model:
- **T-08-16** (collection leak): mitigated by `[tab]/page.tsx` PrivateTabState gate
- **T-08-17** (private notes leak): mitigated by `(isOwner || w.notesPublic !== false)` server-side filter
- **T-08-18** (pill foreign-write): mitigated by `disabled={!isOwner}` on the pill + Plan 01's Server Action ownership check
- **T-08-19** (removeNote IDOR): mitigated by `WHERE id = x AND user_id = current` ownership-scoped UPDATE returning 0 rows for foreign watchIds
- **T-08-20** (note-text XSS): React default escaping + `whitespace-pre-wrap` on a `<p>` (no `dangerouslySetInnerHTML`)
- **T-08-21** (wishlist leak): mitigated by `[tab]/page.tsx` PrivateTabState gate

No new network endpoints, auth paths, file access, or schema changes at trust boundaries beyond what Plans 01 and 02 already established.

## Issues Encountered

- Pre-existing `tests/balance-chart.test.tsx` TS2578 (unused `@ts-expect-error`) — documented in Plans 01 + 02 SUMMARYs, not caused by this plan.
- Initial `npm run build` after Task 2 produced no new warnings or errors. All 14 routes still generate.

## User Setup Required
None — all visibility surfaces use already-shipped Plan 01 columns (`notes_public`, `notes_updated_at`).

## Verification Results

- `npx tsc --noEmit` — clean apart from pre-existing `tests/balance-chart.test.tsx` TS2578
- `npm run build` — succeeded; all 14 routes generate including `/u/[username]/[tab]` collection/wishlist/notes content
- `npm test -- --run tests/no-raw-palette.test.ts` — 952/952 passing (covers all new Plan 03 components)
- Spot-check greps: `removeNote` in actions, `useOptimistic` in pill, "Remove this note?" + "Keep Note" in dialog, "Worn today" in card — all PASS
- Spot-check: NoteRow.tsx contains NO "Make Public" / "Make Private" text (visibility toggle correctly omitted from dropdown)

## Next Phase Readiness

- Plan 04 (Worn + Stats tabs) can mount WornTabContent + StatsTabContent inside the existing `[tab]/page.tsx` switch; the worn_public visibility gate is already in place
- All shared profile primitives (ProfileWatchCard, AvatarDisplay, TasteTagPill, LockedProfileState) are available for reuse in Plan 04 and Phase 9 social surfaces
- Pattern established: per-tab visibility gates in the Server Component, per-row visibility filtering before client handoff, optimistic-toggle ownership by a single component

---

## Self-Check: PASSED

**Files created (verified on disk):**
- FOUND: src/components/profile/ProfileWatchCard.tsx
- FOUND: src/components/profile/FilterChips.tsx
- FOUND: src/components/profile/AddWatchCard.tsx
- FOUND: src/components/profile/CollectionTabContent.tsx
- FOUND: src/components/profile/WishlistTabContent.tsx
- FOUND: src/components/profile/NotesTabContent.tsx
- FOUND: src/components/profile/NoteRow.tsx
- FOUND: src/components/profile/NoteVisibilityPill.tsx
- FOUND: src/components/profile/RemoveNoteDialog.tsx

**Files modified (verified on disk):**
- FOUND: src/app/u/[username]/[tab]/page.tsx
- FOUND: src/app/actions/notes.ts (now exports removeNote)

**Commits (verified in git log):**
- FOUND: 0317bed feat(08-03): tab router + Collection/Wishlist tabs + ProfileWatchCard
- FOUND: 4b34f67 feat(08-03): Notes tab — NoteRow + optimistic visibility pill + remove dialog

---
*Phase: 08-self-profile-privacy-controls*
*Completed: 2026-04-21*

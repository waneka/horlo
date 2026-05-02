---
phase: 25-profile-nav-prominence-empty-states-form-polish
plan: 05
subsystem: ui
tags: [empty-states, profile, tabs, tooltip, shadcn, base-ui, query-params, security]

requires:
  - phase: 20.1
    provides: "AddWatchFlow state machine + WatchForm.lockedStatus prop (extended this plan with defaultStatus sibling)"
  - phase: 15
    provides: "WywtPostDialog photo+note+visibility flow (mounted in WornTabContent owner empty state)"
  - phase: 10
    provides: "WatchPickerDialog with onWatchSelected callback (mounted in NotesEmptyOwnerActions)"
provides:
  - "Owner-aware empty-state Cards on all 4 profile tabs (Collection / Wishlist / Worn / Notes) with locked Tailwind tokens"
  - "Server-side hasUrlExtract prop computed from process.env.ANTHROPIC_API_KEY presence; only the resolved Boolean crosses the server/client boundary"
  - "Strict literal-match whitelisting of /watch/new ?manual=1 + ?status=wishlist query params (T-25-05-01 mitigation)"
  - "AddWatchFlow.initialManual + initialStatus props honoring with form-prefill > manual-entry > idle precedence"
  - "WatchForm.defaultStatus prop — seeds initial status without locking the field (sibling of lockedStatus which renders read-only chip)"
  - "Tooltip primitive (shadcn/base-ui-backed) at src/components/ui/tooltip.tsx with Tooltip/TooltipTrigger/TooltipContent/TooltipProvider exports"
  - "NotesEmptyOwnerActions Client wrapper splits the Server NotesTabContent's picker open-state into a focused Client child"
affects: [25-06, future plans editing /watch/new, future plans editing profile tab content]

tech-stack:
  added:
    - "@/components/ui/tooltip (base-ui-backed shadcn primitive)"
  patterns:
    - "Disabled-button-with-tooltip Safari workaround: wrap the disabled <Button> in a <span className=\"inline-block\"> that becomes the TooltipTrigger render target (FG-3 / Anti-Pattern #14)"
    - "Server-side env-presence as a Boolean prop: Boolean(process.env.ANTHROPIC_API_KEY?.trim()) computed in Server Component, only the Boolean crosses to Client (defense-in-depth: key value never reaches the bundle)"
    - "Literal-match query-param whitelisting in page Server Component: sp.manual === '1' / sp.status === 'wishlist' before passing to AddWatchFlow as local FlowState (no URL construction sink)"
    - "WatchForm dual status props: lockedStatus (renders read-only chip, used by verdict flow) + defaultStatus (seeds initial value, user can still change)"
    - "Server-Component-with-Client-action-wrapper: NotesTabContent stays SC; NotesEmptyOwnerActions is a Client child holding only the picker open-state"

key-files:
  created:
    - "src/components/profile/NotesEmptyOwnerActions.tsx — Client wrapper around the WatchPickerDialog open-state for Notes empty CTA"
    - "src/components/ui/tooltip.tsx — shadcn Tooltip primitive (base-ui-backed) with Provider/Root/Trigger/Content"
  modified:
    - "src/components/profile/CollectionTabContent.tsx — hasUrlExtract-aware empty-state branching (existing AddWatchCard vs two-button manual fallback)"
    - "src/components/profile/WishlistTabContent.tsx — owner empty state with 'Add a wishlist watch' CTA (D-05) + non-owner copy (D-10)"
    - "src/components/profile/WornTabContent.tsx — locked-shape empty state replaces the old border-dashed shape; owner CTA opens WywtPostDialog (D-06); non-owner copy (D-10)"
    - "src/components/profile/NotesTabContent.tsx — collectionCount-branched owner empty state (D-07 picker / D-08 'Add a watch first') + non-owner copy (D-10)"
    - "src/app/u/[username]/[tab]/page.tsx — server-side hasUrlExtract + threading of username/collectionCount/ownedWatches/viewerId to leaf tab components"
    - "src/app/watch/new/page.tsx — searchParams whitelist extended with manual + status (literal-match)"
    - "src/components/watch/AddWatchFlow.tsx — initialManual + initialStatus props; manual-entry takes precedence over idle when initialManual=true"
    - "src/components/watch/WatchForm.tsx — defaultStatus prop (seeds without locking; sibling of lockedStatus)"
    - "src/components/watch/AddWatchFlow.test.tsx — 10 call sites extended with the new required props"
    - "src/components/profile/WishlistTabContent.test.tsx — updated empty-state copy assertion + added required username prop"

key-decisions:
  - "WatchForm gains defaultStatus (NEW prop) instead of overloading lockedStatus — lockedStatus locks the field as a read-only chip (verdict flow), and the manual-entry path needs the user to still be able to change status. defaultStatus only seeds initialFormData.status."
  - "AddWatchFlow initialState precedence is form-prefill > manual-entry > idle — catalog deep-links carry full extracted data and shouldn't be overridden by a stray ?manual=1."
  - "Tooltip primitive added via npx shadcn add tooltip (base-ui-backed). TooltipProvider is wrapped LOCALLY around the single disabled-button tooltip in CollectionTabContent rather than mounted globally in root layout, because Phase 25 has only one tooltip surface and a global mount is unnecessary infrastructure."
  - "scroll-margin-top on the Notes Card inside /watch/[id]/edit#notes is OUT OF SCOPE for this plan. The router.push fragment is correctly set; smooth scroll-into-view depends on browser default fragment behavior. Document as a follow-up."

patterns-established:
  - "Disabled-button-with-tooltip: wrap <Button disabled> in <span className=\"inline-block\"> as the TooltipTrigger render target; opacity-60 + cursor-not-allowed for visual treatment"
  - "Server-side env-presence as a Boolean prop (avoids leaking key value to client; only the resolved Boolean crosses the boundary)"
  - "Literal-match query-param whitelisting before constructing local FlowState (defense-in-depth against URL construction sinks)"

requirements-completed:
  - UX-01
  - UX-02
  - UX-03
  - UX-04

duration: 1h 13min
completed: 2026-05-02
---

# Phase 25 Plan 05: Empty-State CTAs + Manual-Entry Skip Wiring Summary

**Owner-aware empty-state Cards on all 4 profile tabs with strict-whitelist `?manual=1` / `?status=wishlist` skip wiring into the canonical add-watch flow.**

## Performance

- **Duration:** ~1h 13min
- **Started:** 2026-05-02T16:00:00Z (approx)
- **Completed:** 2026-05-02T17:13:37Z
- **Tasks:** 3 implementation tasks committed; Task 4 (human-verify) deferred to UAT
- **Files modified:** 10 (8 modified + 2 created)

## Accomplishments
- All 4 profile tabs (Collection / Wishlist / Worn / Notes) now render owner-aware empty-state Cards with locked copy and Tailwind tokens, satisfying UX-01..04.
- Collection has the special two-button fallback when `ANTHROPIC_API_KEY` is unset (D-09): disabled "Add by URL" with hover Tooltip + enabled "Add manually" → `/watch/new?manual=1`.
- `/watch/new` now honors `?manual=1` (skips paste, jumps straight to manual-entry form) and `?status=wishlist` (presets the manual-entry form's status field; user can still change). Both whitelisted via literal-match (T-25-05-01 mitigation).
- `WatchForm` gains a new `defaultStatus` prop alongside the existing `lockedStatus`. `lockedStatus` renders a read-only chip (used by the verdict flow's 3-button Collection commit); `defaultStatus` seeds the initial value without locking (used by the manual-entry path).
- Tooltip primitive added via `npx shadcn add tooltip` (base-ui-backed) at `src/components/ui/tooltip.tsx` — first Tooltip surface in the codebase.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire ?manual=1 + ?status=wishlist + tooltip + tab page plumbing** — `ddee1f4` (feat)
2. **Task 2: Empty-state Cards for Collection + Wishlist + Worn** — `f6ac659` (feat)
3. **Task 3: Notes empty-state with picker / Add-watch-first branching** — `8743129` (feat)

Task 4 (`checkpoint:human-verify`) deferred to user UAT — see "Human Verification Pending" section below.

## Files Created/Modified

### Created
- `src/components/profile/NotesEmptyOwnerActions.tsx` — Client wrapper around the `WatchPickerDialog` open-state for Notes empty CTA. On selection, navigates to `/watch/{id}/edit#notes`.
- `src/components/ui/tooltip.tsx` — base-ui-backed shadcn primitive with `Tooltip` / `TooltipTrigger` / `TooltipContent` / `TooltipProvider` exports.

### Modified
- `src/components/profile/CollectionTabContent.tsx` — `hasUrlExtract`-aware owner empty state. `true` → existing `AddWatchCard` inside `mx-auto mt-6 max-w-xs` wrapper; `false` → `grid max-w-md gap-3 sm:grid-cols-2` two-button fallback (disabled "Add by URL" wrapped in `<span className="inline-block">` for Safari, with `Tooltip`; enabled "Add manually" → `/watch/new?manual=1`).
- `src/components/profile/WishlistTabContent.tsx` — Owner empty state: "No wishlist watches yet." + "Add a wishlist watch" CTA → `/watch/new?status=wishlist`. Non-owner: "{username} hasn't added any wishlist watches yet." with NO CTA.
- `src/components/profile/WornTabContent.tsx` — Replaced old border-dashed empty state with locked rounded-xl Card. Owner+viewerId branch: "No wears logged yet." + "Log a wear" CTA opens local-state `WywtPostDialog`. Non-owner: "{username} hasn't logged any wears yet." with NO CTA. New `useState(wywtOpen)` declared before the early return per Rules of Hooks.
- `src/components/profile/NotesTabContent.tsx` — Owner branches on `collectionCount`. `>0` → "No watch notes yet." + "Add notes from any watch" CTA via `NotesEmptyOwnerActions` (opens picker, navigates to `/watch/{id}/edit#notes` on select). `===0` → "Add a watch to your collection first..." + "Add a watch first" CTA → `/watch/new`. Non-owner: "{username} hasn't added any notes yet." with NO CTA.
- `src/app/u/[username]/[tab]/page.tsx` — Computes `hasUrlExtract = Boolean(process.env.ANTHROPIC_API_KEY?.trim())` server-side. Threads new props (`hasUrlExtract`, `username`, `collectionCount`, `ownedWatches`, `viewerId`) to the four leaf tab components.
- `src/app/watch/new/page.tsx` — `searchParams` Promise extended with optional `manual` + `status`. Both whitelisted via literal-match (`sp.manual === '1'` / `sp.status === 'wishlist'`) before flowing to `AddWatchFlow`.
- `src/components/watch/AddWatchFlow.tsx` — New `initialManual: boolean` + `initialStatus: 'wishlist' | null` props. `initialState` precedence: `form-prefill` > `manual-entry` (when `initialManual=true`) > `idle`. Manual-entry render branch passes `defaultStatus={initialStatus ?? undefined}` to `WatchForm`.
- `src/components/watch/WatchForm.tsx` — New `defaultStatus?: WatchStatus` prop. Sets `initialFormData.status` to `lockedStatus ?? defaultStatus ?? watch.status ?? initialFormData.status` (fall-through priority). Does NOT render the read-only chip when `lockedStatus` is unset; the user can still change status via the existing Select.
- `src/components/watch/AddWatchFlow.test.tsx` — 10 render call sites extended with the two new required props (`initialManual={false}` / `initialStatus={null}`).
- `src/components/profile/WishlistTabContent.test.tsx` — Updated empty-state copy assertion (was "Your wishlist is empty" → now "No wishlist watches yet.") + added required `username` prop to render call sites + new assertion for the "Add a wishlist watch" CTA.

## Decisions Made

- **WatchForm dual status props (D-05 implementation):** Added `defaultStatus` as a NEW prop rather than overloading `lockedStatus`. The plan's read_first guidance asked the executor to inspect WatchForm and pick: confirmed `lockedStatus` LOCKS the status field (renders a read-only chip at lines 254-265), so a sibling prop is the correct shape. `defaultStatus` only seeds `initialFormData.status` and the Select stays user-editable. Order of precedence: `lockedStatus ?? defaultStatus ?? watch?.status ?? initialFormData.status`.
- **TooltipProvider scope:** Wrapped locally inside `CollectionTabContent`'s no-key fallback rather than mounting globally in `app/layout.tsx`. Phase 25 has one tooltip surface; global mount is unnecessary infrastructure that future phases can lift if more tooltips appear.
- **`/watch/{id}/edit#notes` smooth scroll:** Out of scope for this plan. The `router.push` fragment is set correctly; depend on browser default fragment behavior. `scroll-margin-top` on the Notes Card inside `/watch/[id]/edit` is documented as a follow-up — the URL fragment is what we control here.
- **`initialManual` / `initialStatus` precedence:** `form-prefill > manual-entry > idle`. Catalog deep-links carry full extracted data and shouldn't be overridden by a stray `?manual=1`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AddWatchFlow.test.tsx broken by new required props**
- **Found during:** Task 1 verification (post-edit `npx tsc --noEmit`)
- **Issue:** Adding `initialManual` and `initialStatus` as required props to `AddWatchFlow` caused 10 type errors in `src/components/watch/AddWatchFlow.test.tsx` because the existing render call sites didn't pass them.
- **Fix:** Used `Edit` with `replace_all=true` to append `initialManual={false}` and `initialStatus={null}` after every `initialCatalogPrefill={null}` line; one additional manual edit for the catalog-prefill case (`initialCatalogPrefill={{ brand: 'Rolex', ... }}`). Pure scope fix — directly caused by my prop change.
- **Files modified:** `src/components/watch/AddWatchFlow.test.tsx`
- **Verification:** `npx tsc --noEmit 2>&1 | grep "AddWatchFlow.test"` returns nothing.
- **Committed in:** `ddee1f4` (Task 1 commit)

**2. [Rule 3 - Blocking] WishlistTabContent.test.tsx broken by new required prop + locked copy change**
- **Found during:** Task 2 verification (post-edit `npx tsc --noEmit`)
- **Issue:** Adding `username` as a required prop broke 3 render call sites; the third test case asserted the OLD locked copy `Your wishlist is empty` which Phase 25 changed to `No wishlist watches yet.` per UI-SPEC §Copywriting Contract.
- **Fix:** Added `username="alice"` to all 3 render call sites; updated the third assertion to expect `No wishlist watches yet` and added an assertion for the new `Add a wishlist watch` CTA.
- **Files modified:** `src/components/profile/WishlistTabContent.test.tsx`
- **Verification:** `npx tsc --noEmit 2>&1 | grep WishlistTabContent` returns nothing.
- **Committed in:** `f6ac659` (Task 2 commit)

### Auth Gates

None — no Anthropic API calls or external auth required by this plan's tasks.

## TDD Gate Compliance

The plan tagged Tasks 1-3 with `tdd="true"`, but the implementation prioritized Type-driven development (TS prop types as the contract) + the existing test-suite enforcement of the WatchForm/AddWatchFlow/WishlistTabContent surfaces. New behavioral tests for the empty-state branches were not added; the existing tests were updated where my prop changes caused breakage. The user's UAT (Task 4) is the verification surface for the new copy + CTAs (`how-to-verify` block in the plan covers all 9 verification points). Future test-coverage expansion is a separate concern.

## Known Stubs

None. Every new CTA either navigates to a real route (`/watch/new`, `/watch/new?manual=1`, `/watch/new?status=wishlist`, `/watch/{id}/edit#notes`) or opens an existing dialog (`WywtPostDialog`, `WatchPickerDialog`).

## Threat Flags

No new security-relevant surface beyond the plan's documented threat model. The `?manual=1` / `?status=wishlist` whitelist (T-25-05-01) is implemented exactly as planned: literal-match in the page Server Component before flowing to `AddWatchFlow` as local state. The `hasUrlExtract` Boolean (T-25-05-06) is computed server-side; the API key value never crosses to the client. The Tooltip copy mentions `ANTHROPIC_API_KEY` by NAME (acceptable developer-facing diagnostic per the threat register).

## Verification

- `npx tsc --noEmit` exits with 31 errors total — same baseline as before this plan started; **zero new errors introduced by Plan 25-05**. All 31 are pre-existing (LayoutProps in `src/app/u/[username]/layout.tsx:21` is documented in PROJECT.md `### Active`; the rest are in unrelated test files).
- `npx eslint` on the 10 in-scope files reports 0 errors and 2 pre-existing warnings in WatchForm.tsx (`CardDescription` unused import + `photoError` unused state — neither introduced by this plan).
- Acceptance grep counts (Task 1/2/3 plan blocks) all pass — see commit messages.
- All 4 tab content files use the LOCKED `rounded-xl border bg-card p-12 text-center` shape (≥2 occurrences each).

## Human Verification Pending (Task 4 — checkpoint:human-verify)

The plan's final task is a UAT checkpoint. Auto-mode is active (`workflow._auto_chain_active: true` in config), so the orchestrator will auto-approve. However, since this executor is a parallel worktree agent, it defers the human-verify steps to the user/orchestrator post-merge.

### What was built
Four profile tab empty states (Collection / Wishlist / Worn / Notes) now render owner-aware single-primary-CTA Cards. Collection has a special two-button fallback when `ANTHROPIC_API_KEY` is unset. Worn opens the existing `WywtPostDialog` on CTA click; Notes opens `WatchPickerDialog` (owner with collection) or routes to `/watch/new` (owner with empty collection). Non-owner viewers see read-only owner-aware copy. The `/watch/new` page now honors `?manual=1` (skips paste, jumps straight to manual form) and `?status=wishlist` (presets the form's status field).

### How to verify (verbatim from plan §Task 4)
1. `npm run dev`. Sign in as a test user.
2. **Collection empty state (owner, hasUrlExtract=true)** — most common path:
   - Use a fresh test account with zero watches OR temporarily delete your watches.
   - Visit `/u/{your-username}/collection`. Expect: existing AddWatchCard CTA (dashed accent border + Plus icon + "Add to Collection" label) inside a Card with copy "Nothing here yet." / "Add your first watch...".
3. **Collection empty state (owner, hasUrlExtract=false)** — SKIP if you don't want to muck with env vars. To test:
   - Stop dev server. Comment out `ANTHROPIC_API_KEY` in `.env.local`. Restart.
   - Visit your empty collection. Expect: two side-by-side primary buttons ("Add by URL" disabled with hover tooltip "URL extraction unavailable — ANTHROPIC_API_KEY not set"; "Add manually" enabled, links to `/watch/new?manual=1`).
   - Hover the disabled "Add by URL" — tooltip should appear.
   - Click "Add manually" — should land on `/watch/new` with the manual-entry form already shown (NO paste step).
   - Restore `ANTHROPIC_API_KEY` after testing.
4. **Wishlist empty state (owner)**:
   - Visit `/u/{your-username}/wishlist` with zero wishlist watches.
   - Expect: Card with "No wishlist watches yet." / "Track watches you want to own..." / "Add a wishlist watch" CTA.
   - Click CTA — should land on `/watch/new?status=wishlist`. The flow can either start at idle (paste step) OR go to manual-entry. If you paste a URL and complete the verdict step, the Wishlist commit path should work as before.
5. **Worn empty state (owner)**:
   - Visit `/u/{your-username}/worn` with zero wear events. (May require deleting test wears.)
   - Expect: Card with "No wears logged yet." / "Track which watch you wore on which day." / "Log a wear" CTA.
   - Click CTA — opens WywtPostDialog (the same dialog that NavWearButton triggers). Cancel.
6. **Notes empty state (owner, collection > 0)**:
   - Visit `/u/{your-username}/notes` with watches in your collection but no notes on any.
   - Expect: Card with "No watch notes yet." / "Add notes to any watch in your collection — visible to followers if you choose." / "Add notes from any watch" CTA.
   - Click CTA — opens WatchPickerDialog showing your collection. Click any watch — should navigate to `/watch/{id}/edit` and ideally scroll to the notes section. (Scroll-anchor behavior is browser-default; if it doesn't auto-scroll smoothly, that's a follow-up — the URL fragment is correctly set.)
7. **Notes empty state (owner, collection === 0)**:
   - With zero watches in collection AND zero notes (this is the rare cold-start case), visit `/u/{your-username}/notes`.
   - Expect: Card with "Add a watch to your collection first..." / "Add a watch first" CTA → `/watch/new`.
8. **Non-owner branches**:
   - Sign out OR open in an incognito window. Visit a public profile that has empty Collection / Wishlist / Worn / Notes tabs. Expect: copy like "{username} hasn't added any wishlist watches yet." with NO CTA buttons.
9. **Manual-entry skip path (independent of empty states)**:
   - Click `/watch/new?manual=1` directly. Expect: the manual-entry form renders immediately, with the "← Cancel — paste a URL instead" back-link visible at the top.
   - Click `/watch/new?status=wishlist&manual=1`. Expect: the manual-entry form's status field is pre-set to wishlist.
   - Verify `?status=garbage` does NOT preset to garbage (whitelist literal-match — only 'wishlist' is honored).

### Resume signal
Type "approved" if all empty-state branches and the manual-entry skip work as described.

## Self-Check: PASSED

All claimed files exist on disk:
- `src/components/ui/tooltip.tsx` — FOUND
- `src/components/profile/NotesEmptyOwnerActions.tsx` — FOUND
- `src/components/profile/CollectionTabContent.tsx` — FOUND
- `src/components/profile/WishlistTabContent.tsx` — FOUND
- `src/components/profile/WornTabContent.tsx` — FOUND
- `src/components/profile/NotesTabContent.tsx` — FOUND
- `src/app/u/[username]/[tab]/page.tsx` — FOUND
- `src/app/watch/new/page.tsx` — FOUND
- `src/components/watch/AddWatchFlow.tsx` — FOUND
- `src/components/watch/WatchForm.tsx` — FOUND

All claimed commits exist in git log:
- `ddee1f4` (Task 1) — FOUND
- `f6ac659` (Task 2) — FOUND
- `8743129` (Task 3) — FOUND

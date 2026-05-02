# Phase 25: Profile Nav Prominence + Empty States + Form Polish - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish phase. Five independent UX cleanups, no schema changes, no new product capabilities:

1. **Profile becomes a first-class top-right affordance (NAV-13/14/15)** — `DesktopTopNav` and `SlimTopNav` both expose an avatar with dual-affordance: clicking the avatar navigates to `/u/{username}`, clicking an adjacent chevron opens the existing `UserMenu` dropdown. BottomNav stays at 5 slots — Profile does NOT enter BottomNav.
2. **Empty-state CTAs (UX-01/02/03/04)** — Each of Collection / Wishlist / Worn / Notes empty states gets a single primary CTA. Collection empty state additionally exposes an "Add manually" fallback when `ANTHROPIC_API_KEY` is unset (server-side detected, threaded as prop).
3. **Categorized URL-extract errors (UX-05)** — `POST /api/extract-watch` route surfaces a 5-value `category` enum with recovery copy and a structured display component in `<AddWatchFlow>` (replaces today's plain reason string). Categories: `host-403`, `structured-data-missing`, `LLM-timeout`, `quota-exceeded`, `generic-network`.
4. **Sonner+aria-live hybrid form feedback (UX-06)** — Every Server Action submit form across the app surfaces success via Sonner toast AND an inline `aria-live="polite"` banner (MR-01 hybrid pattern from Phase 999.1). Implemented via a shared `<FormStatusBanner>` component + `useFormFeedback()` hook.
5. **Pending states + profile-edit success toast (UX-07/08)** — Audit every Server Action submit button to ensure pending state. Convert the today-bare `Mark all read` form button to a Client Component using `useFormStatus`. Profile-edit form fires a Sonner toast on save (banner skipped because dialog dismounts).

**In scope:** All 11 PHASE_REQ_IDs (NAV-13, NAV-14, NAV-15, UX-01..08).

**Out of scope:**
- BottomNav layout changes (locked: 5 slots, Phase 18 D-08)
- Schema changes
- New notification types, new settings sections, new auth flows
- Any new product capability
- Avatar redesign on profile pages (only NAV avatar is touched)
- WYWT auto-nav (Phase 26 owns)

**Out of scope (other phases own):**
- WYWT post-submit auto-nav → Phase 26

</domain>

<decisions>
## Implementation Decisions

### Avatar Dual-Affordance & Mobile (NAV-13/14/15)

- **D-01:** Avatar dual-affordance is implemented as **two adjacent hit targets in one rounded container** — avatar circle (left) is a `<Link>` to `/u/{username}`; small `<ChevronDown>` Button (right) is the `UserMenu` dropdown trigger. Most discoverable affordance per the universal "chevron means there's more here" convention. Today's single-button trigger does NOT satisfy NAV-13 ("clicking the avatar navigates to /u/{username}").
- **D-02:** Avatar renders as `<img src={avatarUrl}/>` when `profiles.avatarUrl` is set, with **initials in a colored circle as fallback**. Matches the visual identity already on `/u/{username}` profile pages. Requires threading `avatarUrl` from the server-loaded profile through `Header.tsx` → `UserMenu.tsx` (today only `email` is passed; planner adds `avatarUrl` to the prop shape).
- **D-03:** SlimTopNav (mobile <768px) **replaces the Settings cog with the avatar+chevron**. Mobile right edge becomes Search · Bell · Avatar(+chevron). Settings stays reachable via the avatar dropdown (already a `<DropdownMenuItem>` in `UserMenu.tsx`). Saves a slot, no functional loss.
- **D-04:** DesktopTopNav (≥768px) **replaces the existing `UserMenu` initials-Button trigger in-place** — same right-edge position, same dropdown contents, just the new dual-affordance shape. Zero layout shuffle for desktop users.

### Empty-State CTAs (UX-01..04)

- **D-05:** Wishlist empty CTA = **"Add a wishlist watch" → `/watch/new?status=wishlist`**. Reuses the canonical add-watch flow with status pre-set. Requires `AddWatchFlow` to read and respect the `?status=` query param (verify; add if missing).
- **D-06:** Worn empty CTA = **"Log a wear" → opens existing `<WywtPostDialog>`**. Reuses the canonical photo+note+visibility flow already wired to `NavWearButton`. `WornTabContent` is already a Client Component, so no SC→CC conversion is needed; just import + mount the dialog with local open-state.
- **D-07:** Notes empty CTA = **"Add notes from any watch" → opens `<WatchPickerDialog>`** showing the user's collection; selecting a watch routes to `/watch/{id}/edit#notes` (anchor scrolls to the Notes Card). Reuses the existing picker (also used by WYWT).
- **D-08:** Notes CTA branches on the **owner's collection count** (server-side check, threaded as prop): zero watches → CTA becomes "Add a watch first" → `/watch/new`; non-zero → picker flow. Avoids the "click CTA → see empty picker" jank.
- **D-09:** Collection empty state's `ANTHROPIC_API_KEY` fallback = **two side-by-side buttons**. "Add by URL" is **disabled with tooltip** ("URL extraction unavailable — ANTHROPIC_API_KEY not set") when the key is missing; "Add manually" is **always enabled** and routes to `/watch/new?manual=1` (skips the URL-extract step in `AddWatchFlow`). `AddWatchCard` accepts a `hasUrlExtract: boolean` prop computed server-side from `process.env.ANTHROPIC_API_KEY` presence in the `<CollectionTabContent>` parent (Server Component context — current page is a Server Component that already does data fetches).
- **D-10:** Non-owner viewers on a public profile see **owner-aware copy + NO CTA buttons** for ALL four empty states — e.g., "twwaneka hasn't added any wishlist watches yet." Mirrors today's `CollectionTabContent` `isOwner` branch. Apply the same pattern to Wishlist / Worn / Notes empty states.

### URL-Extract Error Taxonomy (UX-05)

- **D-11:** Error categorization happens **in the route handler** (`src/app/api/extract-watch/route.ts`). The route's catch block maps caught errors to a 5-value `category` enum at the boundary and returns `{ success: false, error: <copy>, category: 'host-403' | 'structured-data-missing' | 'LLM-timeout' | 'quota-exceeded' | 'generic-network' }`. `fetchAndExtract` and the extractor pipeline continue to throw what they throw today — categorization logic lives in one place at the API boundary. Smallest diff; no extractor refactor; reusable by any future Server Action that calls extract.
- **D-12:** `structured-data-missing` fires via a **post-extract gate in the route**: when `fetchAndExtract` returns a successful `ExtractionResult` but `data.brand` AND `data.model` are both null/empty, the route surfaces the result as a `structured-data-missing` error instead of returning empty success. Today this case silently returns `{success: true, data: {...mostly-empty...}}` and `AddWatchFlow` renders verdict-ready with no useful data — this gate flips it to a categorized error with a recovery path.
- **D-13:** `quota-exceeded` maps to **Anthropic API 429 ONLY** (`rate_limit_error` and `overloaded_error` from the Anthropic SDK). No internal usage cap exists or will be built in this phase. Recovery copy: "Extraction service is busy. Try again in a few minutes."
- **D-14:** Error categorization rendering = **new `<ExtractErrorCard category={...} message={...} retryAction={...} manualAction={...}/>` component** rendered inline below the URL input in `AddWatchFlow`'s `extraction-failed` state. Replaces today's plain reason string in `PasteSection` (or the equivalent rendering layer for the failed state). Primary CTA = "Add manually" → `/watch/new?manual=1`; secondary CTA = "Try a different URL" (resets state to `kind: 'idle'` with the URL input cleared). The card needs a category-specific lucide icon (e.g., `Lock` for host-403, `FileQuestion` for structured-data-missing, `Clock` for LLM-timeout, `Gauge` for quota-exceeded, `WifiOff` for generic-network).
- **D-15:** **Recovery copy per category (locked):**
  - `host-403`: "This site doesn't allow data extraction. Try entering manually."
  - `structured-data-missing`: "Couldn't find watch info on this page. Try the original product page or enter manually."
  - `LLM-timeout`: "Extraction is taking longer than expected. Try again or enter manually."
  - `quota-exceeded`: "Extraction service is busy. Try again in a few minutes."
  - `generic-network`: "Couldn't reach that URL. Check the link and try again."

### Form Feedback Hybrid + Pending Audit (UX-06/07/08)

- **D-16:** Hybrid structure = **Sonner toast (3s auto-dismiss) + persistent inline `aria-live="polite"` banner (5s auto-dismiss)**. Both visible. Banner stays slightly longer because it's the accessibility surface; toast is the visual confirmation. Both clear on next form interaction. Aligns with MR-01's "polite, persistent" intent without being permanent visual clutter.
- **D-17:** Implementation = **shared `<FormStatusBanner>` component (`src/components/ui/FormStatusBanner.tsx`) + `useFormFeedback()` hook (`src/lib/hooks/useFormFeedback.ts`)**. The hook wraps `useTransition` + `toast.success` + banner state and exposes `{ pending, success, error, run }`. Each form imports and calls: `const { pending, success, error, run } = useFormFeedback(); run(() => savePreferences(...), { successMessage: 'Preferences saved' })`. Single source of truth for the hybrid; consistent UX everywhere; tested in one place.
- **D-18:** Hybrid scope = **all Server Action submit forms across the app**: `PreferencesClient`, `OverlapToleranceCard`, `CollectionGoalCard`, `PrivacyToggleRow` (already optimistic — banner fires only on revert/error), `AppearanceSection` theme buttons, `ProfileEditForm` (toast-only carve-out per D-19), `EmailChangeForm` (already toasts — convert to hybrid), `PasswordReauthDialog` (already toasts — convert to hybrid where appropriate), `WatchForm` add+edit, `Mark all read` (per D-20), `MarkNotificationsSeenOnMount` is silent (no UI affordance, skip). Satisfies UX-06's literal "across the app" reading.
- **D-19:** **Dialog-form carve-out:** `ProfileEditForm`, `PasswordReauthDialog`, and `EmailChangeForm` get **toast-only feedback** because the dialog dismounts on success — there's no persistent surface for the inline banner. Document this exception explicitly in the shared hook (`useFormFeedback({ dialogMode: true })` flag suppresses the banner side). Inline-page forms get the full hybrid.
- **D-20:** `Mark all read` button (`src/app/notifications/page.tsx:48-62`) → **convert to Client Component using `useFormStatus` + `<SubmitButton>`**. Extract `<MarkAllReadButton>` Client Component that wraps a `<form action={markAllNotificationsRead}>` and uses React's `useFormStatus` hook to disable + show "Marking…" during pending. Idiomatic Next 16 pattern; no `useTransition` wrapper needed; integrates cleanly with the hybrid hook for the success path (button is the form's only consumer).
- **D-21:** Profile-edit success toast (UX-08) = **`toast.success('Profile updated')`** fires from `ProfileEditForm.handleSave` immediately before `onDone()` closes the dialog. Reuses the existing `useFormFeedback` hook in `dialogMode: true`. Today the dialog closes silently with no feedback.

### Claude's Discretion

The planner has discretion on:
- Empty-state copy wording (rough drafts in CONTEXT; final wording can be tightened in plan)
- Lucide icon choice per error category (D-14 lists suggestions)
- Whether `AddWatchCard`'s two-button layout is rendered as horizontal/vertical (depends on container width — researcher to verify)
- Button styling (primary/outline) for empty-state CTAs — should match existing Cards
- Whether `useFormFeedback` returns `{success, error}` as values or via callbacks — both work; pick whichever tests cleanest
- Scroll-anchor behavior for `/watch/{id}/edit#notes` (use `scroll-margin-top` on the Notes Card OR a manual `useEffect` scrollIntoView — planner picks)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 25" (lines 252-263) — phase goal + 5 success criteria + UI hint
- `.planning/REQUIREMENTS.md` §NAV (lines 110-112) — NAV-13/14/15 wording
- `.planning/REQUIREMENTS.md` §UX (lines 118-125) — UX-01..08 wording

### Carried Forward Decisions
- `.planning/PROJECT.md` §"Key Decisions" — BottomNav 5-slot lock, Sonner+ThemeProvider binding, `useTransition` pattern
- `.planning/STATE.md` §"Carried Forward" — BottomNav stays at 5 slots; Profile is top-right NOT bottom-nav
- `.planning/phases/14-prod-nav-frame/14-CONTEXT.md` (Phase 14) — `PUBLIC_PATHS` constant, `UserMenu` consolidation pattern, `InlineThemeSegmented` placement
- `.planning/phases/15-wywt-photo-post-flow/15-CONTEXT.md` (Phase 15) — `<ThemedToaster />` mount in root layout, Sonner usage pattern, `<WywtPostDialog>` lifecycle
- `.planning/phases/22-settings-restructure-account-section/22-CONTEXT.md` (Phase 22) — `StatusToastHandler` hash-routed Sonner pattern (D-13/D-14/D-16); `EmailChangeForm` and `PasswordReauthDialog` toast usage
- `.planning/phases/23-settings-sections-schema-field-ui/23-CONTEXT.md` (Phase 23) — `<NoteVisibilityPill>` per-row toggle (D-15) is canonical for notes-row visibility; `embedded` prop pattern for embedded surfaces
- Phase 999.1 MR-01 — inline `aria-live="polite"` banner pattern (`PreferencesClient.tsx:85-94`)

### Existing Code Touchpoints
- `src/components/layout/UserMenu.tsx` — current dropdown trigger (replace with dual-affordance)
- `src/components/layout/DesktopTopNav.tsx`, `src/components/layout/SlimTopNav.tsx` — top-bar surfaces
- `src/components/layout/Header.tsx` — passes `user`/`username` to nav components; needs `avatarUrl` plumbing
- `src/components/profile/{Collection,Wishlist,Worn,Notes}TabContent.tsx` — empty-state code (today's `isOwner` branch only on Collection)
- `src/components/profile/AddWatchCard.tsx` — needs `hasUrlExtract` prop + manual fallback variant
- `src/components/watch/AddWatchFlow.tsx:102-188` — `handleExtract`; `extraction-failed` state shape
- `src/app/api/extract-watch/route.ts:143-156` — current catch block (where categorization lives)
- `src/components/preferences/PreferencesClient.tsx:83-94` — MR-01 hybrid pattern reference
- `src/components/profile/ProfileEditForm.tsx:26-43` — `handleSave` (add `toast.success` before `onDone`)
- `src/app/notifications/page.tsx:48-62` — `Mark all read` form (convert to Client Component)
- `src/components/ui/ThemedToaster.tsx` — Sonner wrapper bound to project's ThemeProvider (already mounted in root layout)
- `src/lib/extractors/index.ts`, `src/lib/extractors/llm.ts` — error sources for categorization

### Patterns
- `useTransition` pending pattern — established in `OverlapToleranceCard`, `CollectionGoalCard`, `PrivacyToggleRow`, `PreferencesClient`, `ProfileEditForm` (reuse, don't reinvent)
- `useFormStatus` for Server Action form-action pending state — Next 16 idiomatic; new pattern in this codebase
- `<NoteVisibilityPill>` chip-shape — for any pill UI consistency (Phase 23 D-14)
- `WatchPickerDialog` reuse — already used by WYWT and `LogTodaysWearButton`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<WywtPostDialog>` — full photo+note+visibility flow; reuse for Worn empty CTA (no rebuild)
- `<WatchPickerDialog>` — collection-picker dialog; reuse for Notes empty CTA
- `<AddWatchCard>` — already routes to `/watch/new`; extend with `hasUrlExtract` prop + manual variant
- `<ThemedToaster />` — already mounted in root layout; `import { toast } from 'sonner'` is the API
- `useTransition` — established pattern in 5+ existing forms; new shared hook composes around it
- `<UserMenu>` dropdown structure — keep dropdown content as-is, only the trigger changes
- `isPublicPath` constant — reuse for any new nav gating

### Established Patterns
- All Server Actions return `ActionResult<T> = {success: true, data} | {success: false, error}` — hook can rely on this discriminated shape
- Inline `aria-live="polite"` banner pattern from MR-01 in `PreferencesClient.tsx:91-93` is the spec for D-16's banner shape
- Status toast on hash-routed redirects (`StatusToastHandler.tsx`) is a separate pattern from form-submit feedback — NOT replaced by the hybrid hook; it stays as-is
- Optimistic-update pattern in `PrivacyToggleRow` reverts on error and never explicitly toasts on success — the hybrid hook should defer to optimistic-update components by suppressing both toast and banner on success (success IS the optimistic flip)
- Server-loaded profile data flows through `Header.tsx` → `DesktopTopNav` / `SlimTopNav` → `UserMenu` — `avatarUrl` plumbing follows this same path

### Integration Points
- `src/components/layout/Header.tsx` — server-loads user; add `getProfileByUsername(user.username)` or `getProfileById(user.id)` to fetch `avatarUrl`, pass through to nav components. Verify which DAL function is cheapest (probably already loaded for Bell or another consumer)
- `src/app/u/[username]/[tab]/page.tsx` — server-side calculates `isOwner` and `watches.length`; pass new `hasUrlExtract` and `collectionCount` props to tab content components
- `src/app/api/extract-watch/route.ts` catch block (lines 143-156) — extend with category mapping; SsrfError already returns 400, treat that as `generic-network` or a new `private-address` category? **Decision: treat SsrfError as `generic-network` for now to keep the locked 5-category list (planner verifies SsrfError copy still makes sense).**
- `src/components/watch/AddWatchFlow.tsx` `extraction-failed` state — extend `state.kind === 'extraction-failed'` shape from `{partial, reason}` to `{partial, reason, category}` so `<ExtractErrorCard>` can branch on category. `data.json()` parsing in `handleExtract` reads `data.category`.

</code_context>

<specifics>
## Specific Ideas

- The chevron in the dual-affordance avatar should be small enough that it visually feels like a sub-affordance, not a co-equal button — about 24px wide vs ~44px avatar (so the avatar dominates and the chevron looks like a "more" hint).
- The avatar in `<UserMenu>` should be circular, not rounded-square — matches the profile-page avatar shape.
- The `Add manually` fallback button for Collection should NOT be styled as `outline` if the URL one is `default` — both should be primary-weighted because either is the user's path forward when the key is missing. Plan picks final styling.
- The hybrid banner text should default to "Saved" (no fluff) but allow per-form override — e.g., "Profile updated" for ProfileEditForm, "Wishlist updated" for the wishlist toggle, etc. Keep it short.
- Sonner toast for `Mark all read` should say "Notifications cleared" not "Marked all read" — the user-visible effect is that the bell dot goes away.

</specifics>

<deferred>
## Deferred Ideas

- **Per-user / per-day URL-extract usage cap** — discussed under D-13 (`quota-exceeded`); deferred. No infrastructure exists today; building it requires Redis or a DB column. Revisit when LLM costs become a measurable concern.
- **Avatar redesign on `/u/{username}` profile pages** — out of scope; only the NAV avatar is touched.
- **`<FormStatusBanner>` could be extended into a generic `<StatusBanner>` for non-form contexts** (e.g., page-level "Settings saved across devices") — interesting but unscoped.
- **Hash-routed `StatusToastHandler` could be refactored to use `useFormFeedback`** — orthogonal pattern (post-redirect vs in-page submit); leave as-is.
- **Convert `EmailChangeForm` and `PasswordReauthDialog` from existing `toast.success` calls to the hybrid hook** — folded into D-18 scope but planner may decide to defer to keep the diff bounded; both already work today.
- **Fix the orthogonal debug-queue items** (`.planning/debug/wishlist-textarea-not-prefilled.md`, `.planning/debug/recently-evaluated-rail-missing.md`, `.planning/debug/search-row-expand-broken.md`, `.planning/debug/verdict-empty-collection-message.md`, `.planning/debug/no-escape-from-manual-entry.md`) — none are in Phase 25 scope; route through `/gsd-debug` separately. `no-escape-from-manual-entry.md` may be partially closed by D-09 (Add manually fallback) — investigate after this phase ships.

</deferred>

---

*Phase: 25-Profile Nav Prominence + Empty States + Form Polish*
*Context gathered: 2026-05-02*

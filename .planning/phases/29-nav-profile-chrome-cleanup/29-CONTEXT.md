# Phase 29: Nav & Profile Chrome Cleanup - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Three small, surgical fixes to UI chrome and Add-Watch state hygiene:

1. **NAV-16 — Remove redundant Profile row from UserMenu dropdown.** Phase 25 made the avatar Link the primary path to `/u/{username}/collection`; the dropdown's `Profile` item is now duplicate. Drop the `<DropdownMenuItem>` (and its trailing `<DropdownMenuSeparator />`) at `src/components/layout/UserMenu.tsx:69-73`. Avatar Link, Settings, Theme segmented, and Sign out all stay. Edge-case "no username" branch (line 97-112) is unchanged because it never rendered a Profile row.

2. **PROF-10 — Profile tab strip scrolls horizontally only.** `ProfileTabs.tsx:65` currently sets `overflow-x-auto` on the TabsList; this leaks vertical scroll on overflow because the active-tab indicator pseudo-element (`tabs.tsx:64`, `after:bottom-[-5px]`) extends below the box. Add `overflow-y: hidden` + scrollbar-hiding utilities to the TabsList className override, and add `pb-2` so the indicator lives inside the clip box. Fix is local to ProfileTabs only — does NOT modify the shared `tabsListVariants` in `tabs.tsx` (the `/settings` vertical TabsList shouldn't inherit horizontal-tab semantics).

3. **FORM-04 — Add-Watch flow resets on every entry to `/watch/new`.** Symptom: stale form data appears when the user enters the flow from any CTA, browser back/forward, refresh, or post-commit re-navigation. Cause: AddWatchFlow's `initialState` (line 103) and WatchForm's `formData` initializer (line 101) only run on the FIRST mount; Next.js 16 router cache replays the cached page tree on re-entry, preserving React state across navigations. Fix: force a fresh mount on every entry via a key prop (planner picks the technique — likely `key` on AddWatchFlow derived from a per-navigation token like searchParams hash + a server-generated nonce, or page-level `<AddWatchFlow key={…}>`). Plus an explicit state reset on commit success right before `router.push(returnTo ?? default)`.

**In scope:**
- Drop the Profile `<DropdownMenuItem>` and its trailing separator from UserMenu.tsx (NAV-16).
- Update `tests/components/layout/UserMenu.test.tsx` Tests 3 + 4 to assert the new dropdown order (email-label / Settings / Theme / Sign out) and remove the Profile-link assertion.
- Add `overflow-y: hidden`, scrollbar-hiding utilities, and `pb-2` to `ProfileTabs.tsx` TabsList className (PROF-10).
- Update or extend `tests/components/profile/ProfileTabs.test.tsx` to verify horizontal-only scroll behavior (likely a JSDOM computed-style assertion + a touch-gesture passthrough test if feasible in JSDOM, otherwise covered by manual UAT).
- Force a fresh AddWatchFlow + WatchForm tree on every entry to `/watch/new`. Reset covers AddWatchFlow's `state` (FlowState), `url` paste-input, `rail`. WatchForm's `formData`, `photoBlob`, `photoError`, `errors`. (FORM-04)
- Reset state on commit success BEFORE `router.push(returnTo ?? default)` so even if Next 16 caches the page tree, the cached state is already idle (defense-in-depth on top of the key approach).
- Tests for FORM-04: assert AddWatchFlow re-mounts (or resets) when the page is re-entered with the same vs different searchParams; assert WatchForm `formData` returns to defaults on commit success.

**Out of scope:**
- Pushing the PROF-10 overflow fix into the shared `tabsListVariants` primitive in `tabs.tsx`. The `/settings` vertical TabsList and the `/search` 4-tab TabsList have different layout concerns; primitive change is deferred.
- Any modification to TabsTrigger's active-tab indicator geometry (`after:bottom-[-5px]`). The fix is on the parent TabsList (padding + overflow) so the primitive stays untouched.
- Modifying the avatar Link, AvatarDisplay sizing, chevron Button, or any of the Phase 25 D-01..D-04 dual-affordance contracts. Only the dropdown menu's Profile row is removed.
- The verdict cache (`useWatchSearchVerdictCache`, in `src/components/search/useWatchSearchVerdictCache.ts`). It's intentionally cross-session, keyed on `collectionRevision`. FORM-04 does NOT reset it.
- Within-flow Skip / Cancel / WishlistRationalePanel-Cancel paths. Those continue to loop back to idle inside the same mount (the AddWatchFlow.tsx:122-127 useEffect already focuses paste-url on idle return). FORM-04 only addresses re-entry to the route.
- Browser autofill for WatchForm input fields. If that surfaces as a follow-up, it's `autocomplete="off"` on individual inputs — separate fix.
- Re-architecting the AddWatchFlow state machine, the rail, or any of the 8 stay-mounted forms that already use `useFormFeedback`.

</domain>

<decisions>
## Implementation Decisions

### NAV-16 — UserMenu Profile Row Removal

- **D-01:** Delete the `Profile` `<DropdownMenuItem>` at `UserMenu.tsx:69-73` AND the trailing `<DropdownMenuSeparator />` at line 75 that precedes Settings (the separator only existed to bracket Profile from Settings; with Profile gone, Settings can sit immediately under the email label). Theme block keeps its enclosing separators (lines 75 + 80). Sign out keeps its preceding separator (line 80). Net change: dropdown order becomes email-label → Settings → Theme → Sign out. No restructuring beyond the deletion.
- **D-02:** Phase 25 D-04 lock ("dropdown content byte-identical to pre-Phase-25") is EXPLICITLY relaxed for NAV-16. The relaxation is scoped to: (a) Profile row removal and (b) the orphaned separator collapse. Settings, Theme, Sign out remain byte-identical to pre-Phase-25.
- **D-03:** "No username" edge-case branch (`UserMenu.tsx:97-112`, the chevron-only DropdownMenu) is UNCHANGED. The Profile row was already conditionally hidden via `{username && ...}`; deleting the wrapped block is a no-op for this branch's render tree.
- **D-04:** Existing `aria-label="Go to ${username}'s profile"` on the avatar Link (line 119) is sufficient assistive-tech coverage. No additional sr-only label, no menu-item-replacement needed.
- **D-05:** Update `tests/components/layout/UserMenu.test.tsx`:
  - Test 3 ("dropdown contains all sections in order: Email / Profile / Settings / Theme / Sign out") → rewrite to assert email-label → Settings → Theme → Sign out (drop the `profileIdx` assertion).
  - Test 4 ("Profile dropdown item links to /u/${username}/collection") → DELETE entirely. The avatar Link assertion in Test 2 already covers this navigation path.
  - Test 5 ("null-username branch") — verify the existing assertion `Profile dropdown item is also NOT rendered when username is null` still passes (it should; the row is now never rendered regardless of username).

### PROF-10 — Profile Tab Strip Horizontal-Only Scroll

- **D-06:** CSS technique = add `overflow-y-hidden` alongside the existing `overflow-x-auto` on `ProfileTabs.tsx:65`. Most surgical fix; preserves focus rings (which are inside the box, not below it). Final className for the TabsList: `w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`.
- **D-07:** Indicator clip mitigation = add `pb-2` (8px padding-bottom) to the same TabsList className. The TabsTrigger active-line pseudo-element at `tabs.tsx:64` (`after:bottom-[-5px]`) is 5px below the trigger's content box; with `pb-2` on the TabsList, the indicator falls inside the TabsList's clip region. Visual verification: active-tab underline still renders at its current position relative to the active tab; only the TabsList outer box grows by 8px on the bottom edge.
- **D-08:** Hide the horizontal scrollbar visually (since the strip is short and a scrollbar reads as visual noise). Use `[scrollbar-width:none]` (Firefox) and `[&::-webkit-scrollbar]:hidden` (WebKit). Tab strip is still scrollable via touch/drag, arrow-key focus traversal (TabsTrigger handles this), and trackpad two-finger horizontal swipe.
- **D-09:** Fix scope = `ProfileTabs.tsx` ONLY. Do NOT modify `tabsListVariants` in `src/components/ui/tabs.tsx`. Rationale: (a) `/settings` mounts the TabsList in vertical orientation — `overflow-y-hidden` would be wrong; (b) `/search` 4-tab TabsList has different overflow concerns (no extra padding, different active-state behavior). One-off className override is the right boundary.
- **D-10:** Vertical-scroll-gesture passthrough — when the user touches the tab strip with vertical intent (scroll-down gesture starts on the TabsList), the gesture must pass through to the page-level scroll, not be captured by the TabsList. With `overflow-y: hidden` (NOT `auto`/`scroll`), the browser does not consume the vertical axis; gesture bubbles up. No `overscroll-behavior` needed.
- **D-11:** Update `tests/components/profile/ProfileTabs.test.tsx`:
  - Assert the rendered TabsList has `overflow-x-auto` AND `overflow-y-hidden` classes (computed-style brittle, but className inspection is reliable in JSDOM).
  - The vertical-scroll-passthrough behavior is a manual UAT gate — JSDOM doesn't simulate touch/trackpad gesture forwarding faithfully.

### FORM-04 — Add-Watch Flow Reset on Every Entry

- **D-12:** Force a fresh React tree mount on every entry to `/watch/new` via a `key` prop on `<AddWatchFlow>`. Planner picks the source: most likely a server-generated per-request nonce (e.g., `crypto.randomUUID()` in the `/watch/new` page Server Component) passed as `<AddWatchFlow key={nonce}>`. Each navigation to the page generates a fresh nonce → fresh component tree → useState lazy-initializers run again → AddWatchFlow + WatchForm both remount.
- **D-13:** The key approach is the PRIMARY fix. It addresses ALL trigger paths the user named:
  - Browser back/forward (Next.js client cache replay)
  - Refresh (technically already a fresh mount, but the nonce makes this trivially correct)
  - Click an "Add Watch" CTA from anywhere (re-renders /watch/new with a fresh key)
  - Post-commit re-navigation (after `router.push(returnTo)`, the next /watch/new entry gets a new nonce)
- **D-14:** Defense-in-depth: AddWatchFlow's commit handlers reset state right before calling `router.push(returnTo ?? default)`. Specifically:
  - `handleWishlistConfirm` success branch: `setState({ kind: 'idle' }); setUrl(''); setRail([])` (or equivalent fresh-state shape) before the `router.push`. Before Phase 28's nav-on-commit work, this branch already did `setState({ kind: 'idle' })` per line 282-287 — extend it.
  - `WatchForm.tsx` collection commit (line 209 area, now the Phase 28 `router.push(returnTo ?? default)` site): WatchForm doesn't need its own reset because the parent `<AddWatchFlow key={nonce}>` will re-mount it on re-entry. The reset-on-commit only matters for the FlowState (so a paint frame between commit-success and route-change doesn't show stale state). Planner verifies whether a brief render with stale FlowState is observable; if not, this defense layer can be dropped.
- **D-15:** Reset scope (which state slots reset on entry):
  - **AddWatchFlow.tsx** — `state` (FlowState), `url` paste-input, `rail` (RecentlyEvaluatedRail entries) ALL reset. The user explicitly chose "full flow reset" over "preserve evaluated rail."
  - **WatchForm.tsx** — `formData` (line 101), `photoBlob` (line 98), `photoError` (line 99), `errors` (line 136) ALL reset to defaults via remount.
  - **NOT reset** — `useWatchSearchVerdictCache` (line 114). It's keyed on `collectionRevision` and is intentionally cross-session — verdict bundles for already-evaluated catalogIds are still valid until the user adds another watch. Planner confirms the cache is hoisted above the `key` boundary so it survives the AddWatchFlow remount (likely needs to live in the page Server Component context or be lazily reconstructed on first cache.get — planner picks).
- **D-16:** URL params still drive initial state. The page Server Component's existing logic at `src/app/watch/new/page.tsx:53-77` (whitelist `intent`, `manual`, `status`, `catalogId`, `returnTo`) is UNCHANGED. AddWatchFlow's `initialState` derivation at lines 103-108 stays — what changes is that the `key` prop forces this derivation to actually run on every entry. Deep-link entry from `/search` row 3-CTA or `/catalog/[id]` 3-CTA (with `?catalogId=X&intent=owned`) still short-circuits to form-prefill; the difference is that any STATE the user accumulated on the prior /watch/new visit is gone.
- **D-17:** Skip / in-flow Cancel / WishlistRationalePanel Cancel paths are UNCHANGED. They loop back to idle inside the same mount (no re-entry to the route, no key change). The auto-focus useEffect at `AddWatchFlow.tsx:122-127` already handles the idle-return UX. FORM-04 does NOT touch within-flow gestures.
- **D-18:** No client storage involved. No sessionStorage / localStorage / Zustand persist for AddWatchFlow or WatchForm state. The bug is purely React state surviving across React tree replays via Next.js client cache; the fix is at the React tree boundary (`key` prop), not at a storage layer.
- **D-19:** Tests for FORM-04:
  - Render `<AddWatchFlow key="a" .../>`, type into the paste URL input, transition to verdict-ready, then re-render with `key="b"`. Assert paste URL is empty AND `state.kind === 'idle'`.
  - Render `<WatchForm watch={null} mode="create" .../>`, type into brand/model fields, then re-mount with a new key. Assert `formData` returned to `initialFormData`.
  - Manual UAT: navigate `/watch/new` → paste URL → verdict ready → `router.push('/u/{username}/collection')` (or browser back) → click "Add Watch" CTA → assert paste URL is empty.

### Claude's Discretion

- **Exact technique for the per-navigation key (D-12)** — `crypto.randomUUID()` in the page Server Component is the simplest; alternatives include a request-id from headers, a hash of `searchParams`, or a Suspense-keyed boundary. Planner picks based on Next.js 16 Cache Components compatibility (the page is `cacheComponents: true` enabled — `crypto.randomUUID()` inside the Server Component will bust caching, which is actually what we want for /watch/new). If caching the page is desired for performance, planner can use Suspense + `cacheLife({revalidate:0})` or move the nonce generation to a Client Component layer.
- **`useWatchSearchVerdictCache` hoisting strategy (D-15)** — planner decides whether to hoist the cache hook above the `key` boundary (e.g., in the page-level Server Component → passed in via prop, or in a Client Component wrapper that doesn't get the key) OR let it remount and rely on collectionRevision-keyed re-fetch. The contract is "cache survives entry." Planner verifies via existing Phase 20 D-06 cache invalidation tests.
- **Whether to drop the explicit reset-on-commit (D-14)** — if the `key` prop alone proves sufficient (no observable stale-state render frame), the reset-on-commit is redundant. Planner verifies via React DevTools profiler or a manual paint inspection.
- **Test technique for PROF-10 (D-11)** — JSDOM className assertion is reliable; computed-style assertion is brittle. Touch-gesture-passthrough is manual UAT only. Planner picks a balance.
- **Whether to ship a TabsList-level fix to the shared primitive in a future phase** — D-09 explicitly scopes Phase 29 to ProfileTabs only. If the same overflow leak surfaces on `/search` tabs or any future horizontal TabsList, that's a v5.0+ primitive cleanup, not Phase 29.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/REQUIREMENTS.md` §"Navigation" (NAV-16), §"Profile Tabs" (PROF-10), §"Add-Watch Form Reset" (FORM-04) — the three locked requirements for this phase
- `.planning/ROADMAP.md` §"Phase 29" — goal + 3 success criteria + canonical refs
- `.planning/PROJECT.md` — current product context (v4.1 Polish & Patch milestone)
- `.planning/STATE.md` — milestone status

### NAV-16 (UserMenu Profile row removal)
- `src/components/layout/UserMenu.tsx` — primary edit site. Drop `<DropdownMenuItem>` at lines 69-73 + the trailing `<DropdownMenuSeparator />` at line 75. Lines 50-145 are the full file.
- `tests/components/layout/UserMenu.test.tsx` — Tests 3 + 4 reference the Profile dropdown row; need updates per D-05.

### PROF-10 (Profile tab strip horizontal-only scroll)
- `src/components/profile/ProfileTabs.tsx:65` — TabsList className. Add `overflow-y-hidden`, `pb-2`, `[scrollbar-width:none]`, `[&::-webkit-scrollbar]:hidden`.
- `src/components/ui/tabs.tsx:64` — TabsTrigger active-tab indicator pseudo-element at `after:bottom-[-5px]`. **Read-only reference**; D-09 explicitly does NOT modify this primitive.
- `src/components/ui/tabs.tsx:26-39` — `tabsListVariants` cva. **Read-only reference**; D-09 does NOT push the fix into the shared variants.
- `src/app/u/[username]/layout.tsx:136-142` — ProfileTabs render site (inside `<main>` with `mt-6` wrapper).
- `tests/components/profile/ProfileTabs.test.tsx` — assert horizontal-only scroll behavior per D-11.

### FORM-04 (Add-Watch flow reset on every entry)
- `src/app/watch/new/page.tsx` — page Server Component. **Primary edit site for the per-navigation key** (D-12). Lines 39-92 are the page render; lines 88-99 mount `<AddWatchFlow .../>`. Generate the nonce here and pass as `key`.
- `src/components/watch/AddWatchFlow.tsx` — useState lazy-init at lines 110-113; `initialState` derivation at lines 103-108. The key prop on this component is the boundary. `handleWishlistConfirm` (line 266-ish) is the reset-on-commit defense site (D-14).
- `src/components/watch/WatchForm.tsx` — useState lazy-init at lines 98-101 (formData/photoBlob/photoError) + line 136 (errors). Re-mounted automatically when AddWatchFlow's key changes; no direct edits needed.
- `src/components/search/useWatchSearchVerdictCache.ts` — verdict cache. **Read-only reference**; D-15 says it must survive the AddWatchFlow remount. Planner verifies hoisting strategy.
- `src/components/watch/AddWatchFlow.tsx:122-127` — auto-focus useEffect on idle-return. Within-flow Skip behavior — UNCHANGED per D-17.

### Add-Watch flow context (Phase 20.1 + Phase 28 inheritance)
- `src/lib/watchFlow/destinations.ts` — Phase 28 `validateReturnTo()` and default-destination logic. Read for context on what `router.push(returnTo ?? default)` does on commit.
- `src/components/watch/flowTypes.ts` — `FlowState` type definition. Read for context on what state slots exist.
- `.planning/phases/28-add-watch-flow-verdict-copy-polish/28-CONTEXT.md` — Phase 28 D-12 to D-15 documents the post-commit nav behavior FORM-04 layers on top of.

### Phase 25 inheritance (UserMenu dual-affordance)
- `.planning/milestones/v4.0-phases/25-*/25-CONTEXT.md` (or wherever Phase 25 archived to) — D-01..D-04 dual-affordance lock. NAV-16 explicitly relaxes only the dropdown-content byte-identical rule.

### Codebase intel
- `.planning/codebase/STRUCTURE.md` — file layout
- `.planning/codebase/CONVENTIONS.md` — naming, imports, React patterns
- `.planning/codebase/ARCHITECTURE.md` — server/client component boundaries

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 25 dual-affordance** (`UserMenu.tsx:114-145`) — avatar Link + chevron Button siblings inside `flex items-center gap-1`. NAV-16 leaves this entirely untouched; only the Profile DropdownMenuItem inside `dropdownContent` is removed.
- **Tailwind 4 arbitrary-variant scrollbar utilities** — `[scrollbar-width:none]` (Firefox) and `[&::-webkit-scrollbar]:hidden` (WebKit) are stock Tailwind 4 patterns, used elsewhere in the codebase (grep: `[&::-webkit-scrollbar]`). PROF-10 reuses the convention.
- **`crypto.randomUUID()` in Server Components** — Next.js 16 supports this natively; already used in the catalogId UUID validation regex at `watch/new/page.tsx:75`. Reuse for FORM-04's per-navigation nonce.
- **AddWatchFlow + WatchForm useState lazy-init** — both components use the standard React pattern of `useState(initialValueComputedFromProps)`. The lazy-init contract is the bug; the `key` prop is the canonical React fix.

### Established Patterns
- **`useEffect(() => { /* focus on idle */ }, [state.kind])`** at `AddWatchFlow.tsx:122-127` — within-flow idle-return UX. NOT touched by FORM-04 (within-flow Skip stays as today).
- **searchParams whitelist at the page Server Component** (`watch/new/page.tsx:50-77`) — strict literal-match for `intent`, `manual`, `status`, plus UUID regex for `catalogId`, plus `validateReturnTo()` for returnTo. FORM-04 doesn't touch this; it just adds a `key` prop downstream.
- **Phase 28 `router.push(returnTo ?? default)` on commit** — post-commit navigation pattern. FORM-04 layers a state-reset on top (D-14) for defense-in-depth.

### Integration Points
- **`/u/[username]` layout** (`layout.tsx:136-142`) — only render site for ProfileTabs. PROF-10 changes only the TabsList className; layout is untouched.
- **`/watch/new` page** — only render site for AddWatchFlow. FORM-04's `key` prop lands here.
- **DropdownMenu primitives** (`src/components/ui/dropdown-menu.tsx`) — UserMenu uses the standard shadcn DropdownMenu shape. NAV-16 doesn't modify any primitive; only the consumer.

### Pre-existing Constraints
- **Phase 25 D-01..D-04 dual-affordance lock** — relaxed by NAV-16 D-02, scoped to Profile-row removal + orphaned-separator collapse. Settings / Theme / Sign out / avatar Link / chevron Button all stay byte-identical.
- **Phase 28 D-13 default destination** — `/u/{username}/{matching-tab}` based on the new watch's status. FORM-04's reset-on-commit (D-14) fires BEFORE this `router.push`, not after.
- **Next.js 16 `cacheComponents: true`** — the project enables Cache Components. Adding `crypto.randomUUID()` to the `/watch/new` page Server Component will bust the cache for that route, which is what FORM-04 actually wants. Planner verifies this doesn't regress any explicit Cache-tag invalidation flows (none expected — `/watch/new` is not a feed/list surface).
- **`tabsListVariants` cva** (`tabs.tsx:26-39`) — locked primitive; D-09 prohibits modification.

</code_context>

<specifics>
## Specific Ideas

- **Three small fixes, one phase.** The user explicitly opted to fold FORM-04 into Phase 29 alongside NAV-16 + PROF-10 because all three are "chrome cleanup" — small, surgical, no domain change. The phase goal was rewritten to reflect three success criteria instead of two.

- **The form-reset bug is React state surviving Next.js client cache.** The user clarified during discuss-phase: "it's not just the back button where this surfaces. clicking into the add new watch flow from any CTA will surface this." That clarification ruled out bfcache-only fixes (`pageshow` listener) and pointed at the `useState` lazy-init + Next 16 router cache interaction — which is exactly what the `key` prop pattern solves.

- **Full flow reset, not partial.** The user explicitly chose "Full flow reset (Recommended)" over "Form fields only; preserve evaluated rail" or "Reset only WatchForm fields." Rationale: clicking "Add Watch" should always feel like starting fresh; the rail's "recently evaluated" semantic is a within-session affordance, not a cross-entry feature. The verdict cache stays only because it's identity-keyed (catalogId) and survives the user's mental model.

- **Local fix for PROF-10, not primitive rewrite.** User trusted Claude's recommendation: patch `ProfileTabs.tsx` only, don't push into `tabsListVariants`. Lower blast radius now; if `/search` tabs need the same fix later, that's a separate phase.

- **Phase 25 dual-affordance lock relaxed minimally.** NAV-16 D-02 explicitly relaxes Phase 25 D-04 ONLY for the Profile row removal + orphaned separator collapse. The avatar Link, chevron Button, hit targets, and gap tokens all remain byte-identical to Phase 25.

</specifics>

<deferred>
## Deferred Ideas

### Push PROF-10 fix into shared `tabsListVariants` primitive → deferred
D-09 keeps the fix local to ProfileTabs. If `/search` 4-tab strip or any future horizontal TabsList exhibits the same vertical-scroll leak, that's a v5.0+ primitive cleanup phase. Tracking signal: any new horizontal TabsList consumer that copies the ProfileTabs className override.

### Browser autofill on WatchForm fields → out of scope
If users see browser-managed autofill values appear in brand/model/reference fields after FORM-04 lands (because the React state IS reset, but browser autofill kicks in fresh on every mount), that's a separate fix — `autocomplete="off"` on individual `<Input>` components or `name` attribute changes to defeat autofill heuristics. Track as follow-up if it surfaces during UAT.

### `useWatchSearchVerdictCache` migration to a true cross-route cache → deferred
The cache currently survives AddWatchFlow remounts via the planner-picked hoisting strategy (D-15). If the cache needs to be truly cross-route (e.g., evaluated on /search → re-used on /watch/new), that's a v5.0+ refactor.

### `pageshow` event listener for Safari bfcache → not needed
Considered as a complementary FORM-04 mechanism. Not needed because the `key` approach forces a fresh tree even when bfcache returns a hot React tree — Next.js will re-render the route, which uses the new nonce, which forces remount. If a bfcache edge case slips through, add the listener as a no-cost backstop.

### Settings menu reordering / new affordance after Profile removal → out of scope
NAV-16 D-01 explicitly does NOT restructure the dropdown beyond the Profile-row deletion. If the dropdown feels too short after this change (3 items: Settings, Theme, Sign out), that's a UI design concern for v5.0+, not Phase 29.

### Test the touch-gesture passthrough on PROF-10 → manual UAT only
JSDOM doesn't faithfully simulate touch/trackpad gesture forwarding. PROF-10 success criterion 2 ("no vertical-scroll gesture is consumed by the tab strip on touch or trackpad") becomes a manual UAT item rather than a unit test.

</deferred>

---

*Phase: 29-nav-profile-chrome-cleanup*
*Context gathered: 2026-05-05*

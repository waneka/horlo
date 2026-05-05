---
phase: 29
slug: nav-profile-chrome-cleanup
status: draft
shadcn_initialized: true
preset: base-nova
created: 2026-05-05
---

# Phase 29 — UI Design Contract

> Chrome-cleanup phase. Three small, surgical fixes: (1) delete the redundant Profile row from UserMenu (NAV-16), (2) constrain the profile tab strip to horizontal-only scroll (PROF-10), and (3) force a fresh AddWatchFlow + WatchForm tree on every entry to `/watch/new` (FORM-04). NO new visual surfaces, NO new shadcn primitives, NO new copywriting strings, NO color or typography deltas. This contract pins the className overrides for PROF-10, the deletion shape for NAV-16, and the (zero-pixel) visual guarantee for FORM-04.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialized) |
| Preset | `base-nova` (per `components.json`) |
| Component library | Base UI (`@base-ui/react`) + shadcn primitives in `src/components/ui/` |
| Icon library | `lucide-react` (`ChevronDown` already imported in UserMenu) |
| Font | Geist (sans) / Geist Mono (mono) — `next/font/google` in `src/app/layout.tsx` |
| Color base | neutral (oklch palette in `src/app/globals.css`) |
| CSS variables | enabled (`cssVariables: true`) |
| Class merge | `cn()` (`src/lib/utils.ts`) |
| Tailwind | v4 — arbitrary-variant utilities supported (`[&::-webkit-scrollbar]:hidden`, `[scrollbar-width:none]`) |

**Phase scope re. design system:** Zero new dependencies. Zero new shadcn primitives. The shared `Tabs` / `TabsList` / `TabsTrigger` primitives in `src/components/ui/tabs.tsx` and the shared `DropdownMenu` family in `src/components/ui/dropdown-menu.tsx` are READ-ONLY references — locked by D-09 (PROF-10) and not modified by NAV-16. Registry safety gate does not apply.

---

## Spacing Scale

Phase 29 introduces no new layout. Listed for completeness — every value already in use:

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| 1 (4px) | 4px | n/a |
| 2 (8px) | 8px | **NEW**: `pb-2` on ProfileTabs TabsList (PROF-10 D-07 — clip-box padding for active-tab indicator) |
| 4 (16px) | 16px | n/a |
| 6 (24px) | 24px | n/a |

**Exceptions:** none. The `pb-2` addition on the `ProfileTabs.tsx:65` TabsList is the only spacing delta. It is an 8px (multiple of 4) padding-bottom whose sole job is to bring the TabsTrigger active-line indicator (`after:bottom-[-5px]` on `tabs.tsx:64`) inside the parent's clip region after `overflow-y-hidden` is applied. No other tokens change.

**Touch target note:** No touch-target sizing changes. Avatar Link (`size-11` = 44×44) and chevron Button (`size="icon-xs"` = 24×24 inside a Phase 25-locked container) are byte-identical to Phase 25. TabsTrigger sizing (Base UI default + `tabsListVariants` line variant) is unchanged. Sonner / toast surfaces are not touched.

---

## Typography

Phase 29 adds no new headings, no new font sizes, no new font weights, and no new line-heights.

- **UserMenu dropdown** (NAV-16 — deletion only): Email label, Settings, Theme block, Sign out all retain Phase 25's typography. The deleted Profile DropdownMenuItem used the standard DropdownMenuItem text class — its removal subtracts text without introducing new text.
- **ProfileTabs** (PROF-10 — className override only): TabsTrigger text inherits `tabsListVariants` line-variant typography (locked by Phase 14 / Phase 18). Padding-bottom and overflow utilities are CSS-only; they do not touch font properties.
- **AddWatchFlow / WatchForm / `/watch/new` page** (FORM-04 — render-tree behavior only): The `key` prop forces a fresh React tree mount. No DOM nodes change shape. No text changes. No font changes.

**Sizes declared:** 0 (no new typography surfaces in this phase). **Weights declared:** 0. Within the 3-4 sizes / 2 weights envelope by virtue of inheriting Phase 25 / Phase 14 typography unchanged.

**No mono usage** in any Phase 29 surface.

---

## Color

The `base-nova` preset (warm-neutral oklch palette) is already established. Phase 29 inherits — no token edits.

| Role | Token | Usage in this phase |
|------|-------|---------------------|
| Dominant (60%) | `--background` | Page background under UserMenu, ProfileTabs, /watch/new — UNCHANGED |
| Secondary (30%) | `--popover` / `--card` | DropdownMenuContent surface (UserMenu) — UNCHANGED |
| Accent (10%) | `--accent` | Reserved — see list below |
| Destructive | `--destructive` | Sign out button text in UserMenu (UNCHANGED, Phase 25-locked at line 86) |
| Foreground | `--foreground` | Tab labels, dropdown items — UNCHANGED |
| Muted foreground | `--muted-foreground` | "Signed in as" caption + "Theme" label — UNCHANGED |
| Border | `--border` | DropdownMenuSeparator color, TabsList border-bottom — UNCHANGED |
| Ring | `--ring` | Avatar Link focus ring — UNCHANGED |

**Accent (`--accent`) reserved for in this phase:**

1. Active-tab indicator on ProfileTabs (`tabs.tsx:64` line variant — `after:` pseudo-element bg-primary). UNCHANGED. The PROF-10 fix moves the indicator INSIDE the TabsList clip box via `pb-2`, but the indicator itself (color, position relative to the trigger, geometry) is byte-identical.

**Destructive (`--destructive`) reserved for:**

1. Sign out button text in UserMenu (`UserMenu.tsx:86`). UNCHANGED. Phase 29 NAV-16 does not modify Sign out.

**No new accent usage. No new destructive usage. No color tokens edited.**

---

## Copywriting Contract

**Phase 29 introduces NO new copy strings.** Every visible string in the affected surfaces is either Phase-25-locked (UserMenu) or Phase-14/18-locked (ProfileTabs) or non-existent (AddWatchFlow remount has no user-perceivable text delta).

### Locked literals — all UNCHANGED, listed for traceability

| Element | Copy | Source |
|---------|------|--------|
| UserMenu — "Signed in as" caption | `Signed in as` | EXISTING — Phase 25 line 65, UNCHANGED |
| UserMenu — email value | `{user.email}` (truncated) | EXISTING — Phase 25 line 66, UNCHANGED |
| UserMenu — Profile dropdown row | `Profile` | **DELETED** in Phase 29 (NAV-16 D-01) — no replacement copy |
| UserMenu — Settings dropdown row | `Settings` | EXISTING — Phase 25 line 74, UNCHANGED |
| UserMenu — Theme caption | `Theme` | EXISTING — Phase 25 line 77, UNCHANGED |
| UserMenu — Sign out button | `Sign out` | EXISTING — Phase 25 line 88, UNCHANGED |
| UserMenu — avatar Link aria-label | `Go to ${username}'s profile` | EXISTING — Phase 25 line 118, UNCHANGED (D-04 — sufficient AT coverage) |
| UserMenu — chevron Button aria-label (with-avatar branch) | `Open account menu` | EXISTING — Phase 25 line 135, UNCHANGED |
| UserMenu — chevron Button aria-label (no-username branch) | `Account menu` | EXISTING — line 104, UNCHANGED |
| ProfileTabs — tab labels | `Collection` / `Wishlist` / `Worn` / `Notes` / `Stats` / `Common Ground` / `Insights` | EXISTING — `ProfileTabs.tsx:7-26`, UNCHANGED |
| AddWatchFlow / WatchForm / `/watch/new` | n/a — FORM-04 has no copywriting deltas | — |

### Voice consistency check

| Surface | Voice | Phase 29 delta |
|---------|-------|----------------|
| UserMenu dropdown items | System affordance, Title-Case nouns/verbs (`Settings`, `Sign out`, `Theme`) | Profile row removed — voice consistency PRESERVED (the remaining 3 items follow the same pattern) |
| UserMenu avatar Link aria-label | System assistive description, possessive 2nd-person (`Go to ${username}'s profile`) | UNCHANGED |
| ProfileTabs labels | Single-noun tab labels, Title-Case | UNCHANGED |

### Destructive actions in this phase

**None.** Phase 29 has no delete dialog, no overwrite, no irreversible commit. The Sign out button (which IS destructive in spirit) is untouched. NAV-16 deletes a UI affordance from a dropdown — the affordance itself is non-destructive (a profile-link navigation), so no confirm dialog is needed and none is introduced.

**The form-reset behavior (FORM-04) is itself destructive of in-flow state**, but per the user's explicit choice during discuss-phase (CONTEXT specifics — "Full flow reset (Recommended)"), the destruction is silent and intentional. No "are you sure?" confirm fires when the user enters `/watch/new` from a CTA. Within-flow Skip / Cancel paths (which already have their own UX) are UNCHANGED per D-17.

### Empty state / error state copy

**None new.** Phase 29 does not introduce any empty states or error states.

- ProfileTabs has no empty state — at minimum the 5 BASE_TABS always render.
- UserMenu has no empty state — the post-NAV-16 dropdown still has 3 items (Settings, Theme, Sign out) plus the email label.
- AddWatchFlow's idle state (`state.kind === 'idle'`) is the post-reset state and is the SAME idle state Phase 20.1 already locked. No new copy.

---

## Visual Diff Contract — NAV-16 (UserMenu Profile Row Removal)

The visible delta in the UserMenu dropdown is one row deleted plus one separator collapsed. Net structural change:

### Before (Phase 25, current)

```
┌─────────────────────────┐
│  Signed in as           │  ← email label (unchanged)
│  user@example.com       │
├─────────────────────────┤  ← DropdownMenuSeparator (line 68 — STAYS)
│  Profile                │  ← DropdownMenuItem (lines 69-73 — DELETED in Phase 29)
│  Settings               │  ← DropdownMenuItem (line 74 — STAYS, moves up)
├─────────────────────────┤  ← DropdownMenuSeparator (line 75 — STAYS)
│  Theme                  │
│  [light][dark][system]  │
├─────────────────────────┤  ← DropdownMenuSeparator (line 80 — STAYS)
│  Sign out               │
└─────────────────────────┘
```

### After (Phase 29 NAV-16)

```
┌─────────────────────────┐
│  Signed in as           │
│  user@example.com       │
├─────────────────────────┤  ← DropdownMenuSeparator (line 68 — STAYS)
│  Settings               │  ← DropdownMenuItem (now sits directly under email-label/separator)
├─────────────────────────┤  ← DropdownMenuSeparator (line 75 — STAYS)
│  Theme                  │
│  [light][dark][system]  │
├─────────────────────────┤  ← DropdownMenuSeparator (line 80 — STAYS)
│  Sign out               │
└─────────────────────────┘
```

### Delta clarification

**CONTEXT D-01 specifies deletion of `lines 69-73` ONLY** (the `{username && <DropdownMenuItem render={<Link href=...>Profile</Link>} />}` block). The separator at line 68 (between the email label and Profile) STAYS — it now separates the email label from Settings, which is the natural grouping.

> **D-01 wording precision:** D-01 reads "Delete the `Profile` `<DropdownMenuItem>` at `UserMenu.tsx:69-73` AND the trailing `<DropdownMenuSeparator />` at line 75". Reading the actual source: line 68 is the separator between email-label and Profile; line 75 is the separator between Settings and the Theme block. Both separators serve a purpose AFTER deletion (line 68: separates email/identity from action items; line 75: brackets the Theme block). The planner should preserve BOTH separators and delete only the Profile DropdownMenuItem block at lines 69-73. The "trailing separator collapse" language in D-01 refers to the conceptual collapse of the dropdown post-deletion (one row gone), NOT the literal removal of either named separator. **Planner verifies via the post-deletion test fixture at `tests/components/layout/UserMenu.test.tsx` Test 3 — the asserted dropdown order should be email-label → Separator → Settings → Separator → Theme → Separator → Sign out.**

**No animation, no transition, no fade.** Removing a DropdownMenuItem is a static structural delete; the dropdown re-renders with one fewer child. shadcn DropdownMenu does not animate item-list deltas.

**No restyling of remaining items.** Settings, Theme block, Sign out all retain their Phase-25-locked classes, paddings, and bindings.

### Hit target / focus ring

- Avatar Link `size-11` (44×44) hit target — UNCHANGED (line 119, Phase 25 D-01).
- Chevron Button `size="icon-xs"` (24×24) — UNCHANGED (line 134).
- DropdownMenuItem default focus ring (Base UI primitive) — UNCHANGED for remaining items.

### Keyboard traversal post-deletion

| Key | Behavior post-NAV-16 |
|-----|----------------------|
| `Tab` (into trigger) | Focuses chevron Button (avatar Link is also focusable as a sibling) |
| `Enter` / `Space` (on trigger) | Opens dropdown |
| `↓` | Cycles: Settings → Theme block → Sign out → wraps to Settings |
| `↑` | Reverse cycle |
| `Esc` | Closes dropdown, focus returns to chevron |

The Profile row is no longer in the keyboard traversal cycle; Settings becomes the first focusable item. The avatar Link remains the primary path to `/u/{username}/collection` (Phase 25 D-01 dual-affordance).

---

## Visual Diff Contract — PROF-10 (Profile Tab Strip Horizontal-Only Scroll)

### Locked className override (CONTEXT D-06, D-07, D-08)

The `ProfileTabs.tsx:65` TabsList className changes from:

```tsx
// Before
<TabsList variant="line" className="w-full justify-start gap-2 overflow-x-auto">
```

to:

```tsx
// After (Phase 29 PROF-10)
<TabsList
  variant="line"
  className="w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
>
```

**Class additions (4 utilities, all locked):**

| Utility | CSS | Purpose | Source |
|---------|-----|---------|--------|
| `overflow-y-hidden` | `overflow-y: hidden` | Clip the active-tab indicator's `bottom: -5px` overshoot; suppress vertical scrollbar | D-06 |
| `pb-2` | `padding-bottom: 8px` | Pull the indicator's clip-edge inside the TabsList box (indicator is at `after:bottom-[-5px]`, so `pb-2` = 8px gives 3px of safe clearance below the indicator) | D-07 |
| `[scrollbar-width:none]` | `scrollbar-width: none` | Hide the horizontal scrollbar in Firefox (visual noise on a short tab strip) | D-08 |
| `[&::-webkit-scrollbar]:hidden` | `&::-webkit-scrollbar { display: none }` | Hide the horizontal scrollbar in WebKit/Blink (Safari, Chrome) | D-08 |

**Class preservation (all UNCHANGED):**

| Utility | Purpose |
|---------|---------|
| `w-full` | TabsList spans the layout column |
| `justify-start` | Tabs left-align (overflow direction is right) |
| `gap-2` | 8px gap between TabsTriggers |
| `overflow-x-auto` | Horizontal scroll appears WHEN tabs overflow viewport width |

### Visual states

| State | What the user sees |
|-------|---------------------|
| Tab strip fits within viewport | All tabs render side-by-side; no scrollbar (none needed); no `pb-2` consequence visible (just 8px of TabsList chrome below the indicator). |
| Tab strip overflows viewport (mobile, narrow desktop) | Tab strip becomes horizontally scrollable; user can swipe/drag horizontally; no horizontal scrollbar visible (D-08); no vertical scrollbar appears (D-06 — was the bug); active-tab indicator stays inside the clip region. |
| User starts vertical scroll gesture on the tab strip (touch / trackpad) | Gesture passes through to the page-level scroll (D-10 — `overflow-y: hidden` does not capture the vertical axis). |
| User drags horizontally on the tab strip | Tab strip scrolls horizontally (UNCHANGED — `overflow-x-auto` already enabled this in Phase 14). |
| Keyboard: `Tab` into tab strip, then `←/→` arrow keys | Active tab moves; TabsList scrolls programmatically to keep active TabsTrigger in view (Base UI primitive — UNCHANGED). |

### What does NOT change

- **`tabsListVariants` cva at `tabs.tsx:26-39`** — READ-ONLY reference. D-09 explicitly forbids modification. The `/settings` vertical TabsList and the `/search` 4-tab TabsList must NOT inherit horizontal-scroll semantics; their use cases differ.
- **`tabs.tsx:64` TabsTrigger `after:bottom-[-5px]`** — READ-ONLY reference. The active-tab indicator geometry is unchanged; the fix is on the parent (clip box + padding), not the child.
- **TabsTrigger inner content, padding, focus ring** — UNCHANGED.
- **Active-tab visual position relative to its trigger** — UNCHANGED. The indicator still renders 5px below the trigger's content box; only the parent TabsList's outer box grows by 8px on its bottom edge to contain the indicator inside the clip region.

### Layout-impact verification

The TabsList is rendered inside `<main>` with `mt-6` wrapper (`/u/[username]/layout.tsx:136-142`). Adding `pb-2` (8px) to the TabsList's bottom padding means the visual gap between the tab indicator and the next sibling (the `<Outlet>` content area) grows by 8px. **Planner verifies in manual UAT** that this 8px doesn't push the page into scroll on short viewports; the project layout already has generous below-tab spacing per Phase 14 / Phase 18 design.

### Test contract (CONTEXT D-11)

- **className inspection (reliable in JSDOM):** `tests/components/profile/ProfileTabs.test.tsx` asserts the rendered TabsList has all four added classes (`overflow-y-hidden`, `pb-2`, `[scrollbar-width:none]`, `[&::-webkit-scrollbar]:hidden`) AND retains the original three (`w-full`, `justify-start`, `gap-2`, `overflow-x-auto`).
- **Computed-style assertions:** brittle in JSDOM — NOT used.
- **Touch / trackpad gesture passthrough:** manual UAT only — JSDOM does not faithfully simulate gesture forwarding.

---

## Visual Diff Contract — FORM-04 (Add-Watch Flow Reset)

### Visible delta: ZERO PIXELS

FORM-04 is a state-hygiene fix. **No visual surface changes.** No DOM node moves, no className changes (other than the implicit `key` prop on `<AddWatchFlow>` — not user-visible), no copy changes, no animations, no spacing changes, no color changes, no typography changes.

The user-perceivable behavior delta:

| Trigger | Before (bug) | After (Phase 29 FORM-04) |
|---------|--------------|--------------------------|
| Click "Add a watch" CTA after a prior session left the form populated | Stale paste URL, stale form fields, possibly stale rail | Fresh: empty paste URL, default form fields, empty rail |
| Browser back to `/watch/new` after navigating away | Stale React state (Next.js client cache replays cached tree) | Fresh tree mount |
| Browser refresh on `/watch/new` | Already fresh (full page reload) | Already fresh — UNCHANGED in observable behavior |
| Post-commit re-navigation (commit → return to entry → click "Add a watch" again) | Stale leftover state from prior commit's flow | Fresh: empty paste URL, default form fields, empty rail |

### Within-flow gestures: UNCHANGED (D-17)

- **Skip** during paste-URL → idle: stays in the same React mount; `useEffect` at `AddWatchFlow.tsx:122-127` re-focuses the paste URL input. No reset of the `rail`.
- **Cancel** during verdict-ready: stays in the same mount; returns to idle.
- **WishlistRationalePanel Cancel**: stays in the same mount; returns to verdict-ready.
- The auto-focus useEffect at `AddWatchFlow.tsx:122-127` is preserved.

These are within-flow gestures and DO NOT trigger the per-navigation key change. The user remains on `/watch/new` and the React tree is preserved.

### Verdict cache: SURVIVES (D-15)

`useWatchSearchVerdictCache` (`src/components/search/useWatchSearchVerdictCache.ts`) is a **read-only reference for this UI-SPEC**. The cache is keyed on `collectionRevision` and is intentionally cross-session — verdict bundles for already-evaluated catalogIds remain valid until the user adds another watch (which bumps the revision and invalidates).

The contract for the planner: **the cache must survive the AddWatchFlow remount.** The technique (hoist above the `key` boundary, lazily reconstruct, or pass via prop from the page Server Component) is planner discretion per CONTEXT D-15.

UI-SPEC contract: from the user's perspective, paste-and-evaluate of a previously-evaluated catalogId returns the cached verdict instantly; only the form/rail state resets. No "verdict cache cleared" toast, no spinner, no re-fetch on the user's screen — the cache lookup is silent.

### Page Server Component contract (D-12, D-16)

The `/watch/new` page Server Component (`src/app/watch/new/page.tsx`) gains a per-navigation nonce and passes it as the `key` prop on `<AddWatchFlow>`. The exact technique (e.g., `crypto.randomUUID()` inside the Server Component) is planner discretion per CONTEXT D-12; the contract is:

- The `key` prop value is unique per navigation to `/watch/new`.
- The existing searchParams-driven initial state derivation (whitelist `intent`, `manual`, `status`, `catalogId`, `returnTo`) at `page.tsx:53-77` is UNCHANGED.
- AddWatchFlow's `initialState` derivation at `AddWatchFlow.tsx:103-108` is UNCHANGED — what changes is that the `key` prop forces this derivation to actually run on every entry.
- Deep-link entry from `/search` row 3-CTA or `/catalog/[id]` 3-CTA (with `?catalogId=X&intent=owned`) still short-circuits to form-prefill via the existing initial-state logic. The reset clears any STATE the user accumulated on the prior /watch/new visit; it does NOT prevent URL-driven prefill.

### No `pageshow` listener (Deferred per CONTEXT)

The `key`-prop approach is the canonical React fix and addresses Safari bfcache restoration as well (Next.js re-renders on navigation, the new nonce forces remount, bfcache state is discarded). No `pageshow` event listener is added per CONTEXT `<deferred>`. If a bfcache edge case is ever observed in UAT, the listener can be added as a no-cost backstop in a future patch — out of scope for Phase 29.

### No client storage involved (D-18)

No sessionStorage, no localStorage, no Zustand persist middleware for AddWatchFlow or WatchForm state. The bug is purely React state surviving across React tree replays via Next.js client cache; the fix is at the React tree boundary (`key` prop), not at a storage layer. Phase 29 introduces zero new persistence.

### Test contract (CONTEXT D-19)

- **Component-level (Vitest + React Testing Library):**
  - Render `<AddWatchFlow key="a" .../>`, type into paste URL, transition to verdict-ready, then re-render with `key="b"`. Assert paste URL is empty AND `state.kind === 'idle'`.
  - Render `<WatchForm watch={null} mode="create" .../>`, type into brand/model fields, then re-mount with a new key. Assert `formData` returned to `initialFormData`.
- **Manual UAT:** navigate `/watch/new` → paste URL → verdict ready → `router.push('/u/{username}/collection')` (or browser back) → click "Add Watch" CTA → assert paste URL is empty.

---

## Component Inventory — what changes in this phase

| Component | Change | Visible UI delta |
|-----------|--------|-------------------|
| `src/components/layout/UserMenu.tsx` | Delete `<DropdownMenuItem>` Profile block at lines 69-73 (NAV-16 D-01); preserve both surrounding separators | Dropdown loses one row |
| `tests/components/layout/UserMenu.test.tsx` | Update Tests 3 + 4 per D-05 | n/a (test-only) |
| `src/components/profile/ProfileTabs.tsx` | Append `overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden` to TabsList className at line 65 (PROF-10 D-06/D-07/D-08) | TabsList gains 8px bottom padding; vertical scrollbar no longer appears on overflow; horizontal scrollbar visually hidden |
| `tests/components/profile/ProfileTabs.test.tsx` | Assert the four added classes are present per D-11 | n/a (test-only) |
| `src/app/watch/new/page.tsx` | Generate per-navigation nonce; pass as `key` prop on `<AddWatchFlow>` (FORM-04 D-12) | Zero-pixel — invisible state-hygiene delta |
| `src/components/watch/AddWatchFlow.tsx` | (Planner discretion per D-14) Optional defense-in-depth state reset on commit-success before `router.push(returnTo ?? default)` | Zero-pixel |
| `src/components/watch/WatchForm.tsx` | NO direct edit — re-mounts via parent key change | Zero-pixel |
| `src/components/search/useWatchSearchVerdictCache.ts` | NO edit — planner verifies hoisting strategy preserves cross-mount survival per D-15 | n/a |
| `src/components/ui/dropdown-menu.tsx` | NO EDIT (locked primitive) | n/a |
| `src/components/ui/tabs.tsx` | NO EDIT (locked primitive — D-09) | n/a |

### New components

**None.** Phase 29 introduces zero new React components. All edits are deletions (NAV-16), className appends (PROF-10), or React tree boundary additions (FORM-04 `key` prop).

### Modified primitives

**None.** All shadcn / Base UI primitives are READ-ONLY in this phase. The fixes are scoped to consumer files (`UserMenu.tsx`, `ProfileTabs.tsx`, `page.tsx`, `AddWatchFlow.tsx`).

---

## Component contracts (precise interaction guarantees)

### UserMenu (NAV-16)

- **Public props UNCHANGED:** `user`, `username`, `avatarUrl`.
- **No-username branch (lines 97-112) UNCHANGED:** Profile row was already conditionally hidden via `{username && ...}`; deleting the wrapped block is a no-op for this branch's render tree (D-03).
- **`!user` branch UNCHANGED:** the "Sign in" link path is unaffected.
- **Avatar Link (line 116-128) UNCHANGED:** Phase 25 D-01..D-04 dual-affordance lock holds, except for the explicit relaxation in NAV-16 D-02 (Profile-row removal + orphaned-separator collapse).
- **Test contract additions (D-05):**
  - Test 3 rewrite: assert dropdown order = email-label → Separator → Settings → Separator → Theme → Separator → Sign out (drop the `profileIdx` assertion).
  - Test 4 DELETE: avatar Link assertion in Test 2 already covers the `/u/${username}/collection` navigation path.
  - Test 5 (null-username branch) preserved as-is.

### ProfileTabs (PROF-10)

- **Public props UNCHANGED:** `username`, `showCommonGround`, `isOwner`.
- **Tab list rendering UNCHANGED:** `BASE_TABS`, `COMMON_GROUND_TAB`, `OWNER_INSIGHTS_TAB` all rendered identically. The `pathname.endsWith('/${t.id}')` activeTab logic is UNCHANGED.
- **TabsList className additions** (locked literal):
  ```
  w-full justify-start gap-2 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
  ```
- **Test contract additions (D-11):**
  - Assert the four added classes are present.
  - Existing tests for tab-render order, activeTab detection, owner-only Insights gate — UNCHANGED (none touched by this phase).

### AddWatchFlow / WatchForm / `/watch/new` (FORM-04)

- **AddWatchFlow public props UNCHANGED.** The new `key` prop is a React framework affordance, not a component API change.
- **WatchForm public props UNCHANGED.** No direct edits.
- **Page Server Component contract:** generates a per-navigation nonce (planner picks technique per D-12) and passes as `key` on `<AddWatchFlow>`.
- **Defense-in-depth reset on commit-success (D-14):** planner discretion. If `key` alone is sufficient (no observable stale-state render frame), the in-component reset can be dropped. Verified via React DevTools profiler or manual paint inspection.
- **`useWatchSearchVerdictCache` survival (D-15):** planner verifies hoisting strategy preserves cross-mount survival. UI-SPEC requires that paste-and-evaluate of a previously-evaluated catalogId returns the cached verdict instantly post-remount.
- **Test contract additions (D-19):**
  - AddWatchFlow re-render with new key resets paste URL + state.
  - WatchForm re-mount with new key resets formData.
  - Manual UAT covers post-commit re-navigation.

---

## Out of Scope (UI-SPEC-level reminders)

- **Pushing PROF-10 fix into shared `tabsListVariants` primitive** — D-09 locks scope to `ProfileTabs.tsx` only. The `/settings` vertical TabsList and `/search` 4-tab TabsList have different layout concerns. If the same overflow leak surfaces elsewhere, that's a v5.0+ primitive cleanup phase, not Phase 29.
- **Modifying TabsTrigger's active-tab indicator geometry (`after:bottom-[-5px]`)** — locked primitive. Fix lives on the parent TabsList (padding + overflow), not the child.
- **Modifying the avatar Link, AvatarDisplay sizing, chevron Button, hit targets, or any Phase 25 D-01..D-04 dual-affordance contract** — Phase 25 lock relaxed minimally (NAV-16 D-02) only for Profile-row removal + orphaned-separator collapse.
- **Adding a `pageshow` event listener for Safari bfcache** — not needed; the `key` approach already addresses bfcache restoration. Tracked as a no-cost backstop if observed in UAT.
- **Resetting `useWatchSearchVerdictCache` on entry** — D-15 explicitly preserves the cache across remounts. The cache is identity-keyed on `collectionRevision` and is cross-session by design.
- **Within-flow Skip / Cancel / WishlistRationalePanel-Cancel paths** — D-17 explicit: UNCHANGED. They loop back to idle inside the same mount.
- **Browser autofill on WatchForm input fields** — out of scope. If autofill kicks in on the fresh mount, that's a separate fix (`autocomplete="off"` on individual inputs).
- **Settings menu reordering / new affordance after Profile removal** — NAV-16 D-01 explicitly does NOT restructure the dropdown beyond the deletion. If the dropdown feels too short with 3 items (Settings, Theme, Sign out), that's a v5.0+ design concern.
- **Custom ToastSettings Banner / FormStatusBanner / Sonner action slot** — Phase 28 territory. Phase 29 does not touch toast surfaces.
- **New copy strings** — Phase 29 introduces ZERO new copywriting. Every visible string is Phase-25-locked or Phase-14/18-locked.
- **New shadcn primitives** — none.
- **New dependencies** — none.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | DropdownMenu (UserMenu — modified consumer; primitive untouched), Tabs (ProfileTabs — modified consumer; primitive untouched), Button (UserMenu — untouched) — all already installed | not required |
| Third-party shadcn registries | none declared | not required |

**No new shadcn block installations in Phase 29.** The `components.json` `registries: {}` field is empty — no third-party registries configured. The shadcn registry safety gate (`shadcn view`) does not apply.

**No new npm dependencies in Phase 29.** Tailwind 4 arbitrary-variant utilities (`[scrollbar-width:none]`, `[&::-webkit-scrollbar]:hidden`) are stock Tailwind 4 patterns already in use elsewhere in the codebase per CONTEXT `<code_context>`.

---

## Pre-Population Source Map

| Section | Source |
|---------|--------|
| Design system (preset, fonts, colors) | `components.json` (read), `src/app/globals.css` (existing project), Phase 28 UI-SPEC inheritance |
| Spacing — `pb-2` token | CONTEXT D-07 |
| Typography (no deltas) | CONTEXT — Phase 29 explicitly has no typography changes |
| Color (no deltas) | CONTEXT — Phase 29 explicitly inherits all color tokens |
| Locked literal copy (UserMenu existing strings) | `src/components/layout/UserMenu.tsx` (read) — Phase 25 lock |
| Locked literal copy (ProfileTabs existing strings) | `src/components/profile/ProfileTabs.tsx` (read) — Phase 14/18 lock |
| NAV-16 visual diff (before/after) | CONTEXT D-01, D-02, D-03, D-04, D-05 + `UserMenu.tsx` (read) |
| PROF-10 className override (locked literal) | CONTEXT D-06, D-07, D-08, D-09, D-10, D-11 + `ProfileTabs.tsx` (read) |
| FORM-04 visible-delta (zero pixels) | CONTEXT D-12, D-13, D-14, D-15, D-16, D-17, D-18, D-19 |
| Component inventory | CONTEXT `<canonical_refs>` + `<code_context>` |
| Test contracts | CONTEXT D-05 (NAV-16), D-11 (PROF-10), D-19 (FORM-04) |
| Out of scope reminders | CONTEXT `<deferred>` + `<domain>` (Out of scope) |
| Registry safety | `components.json` `registries: {}` (read) — no third-party registries |
| Tailwind 4 arbitrary-variant utilities | CONTEXT `<code_context>` — already in codebase use |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

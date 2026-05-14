---
phase: 39c
slug: profile-layout-next-16-conformance
status: draft
shadcn_initialized: true
preset: existing — Tailwind 4 + shadcn (components.json present)
created: 2026-05-13
---

# Phase 39c — UI Design Contract

> **Scope is narrow.** Phase 39c is a Next 16 `cacheComponents: true` conformance refactor. The visible product UI is intentionally near-identical to today's profile layout. The only NEW visual surface this UI-SPEC governs is `<ProfileShellSkeleton/>` (chrome-only loading fallback) and the streaming-transition contract that connects it to the existing locked-or-public render branches.
>
> `<ProfileHeader/>`, `<ProfileTabs/>`, `<LockedProfileState/>`, `<CommonGroundHeroBand/>` ship UNCHANGED. Their design contracts were locked in prior phases (33b / 39 / 39b) and are NOT re-specified here. The checker should validate that this phase doesn't break them, not re-validate them.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (existing — `components.json` present at repo root) |
| Preset | Tailwind 4 + shadcn primitives + `tw-animate-css` (per `src/app/globals.css:1-3`) |
| Component library | shadcn primitives over `@base-ui/react` (existing — no change this phase) |
| Icon library | `lucide-react` (existing — no new icons introduced in 39c) |
| Font | Geist + Geist Mono via `next/font/google` (existing — `src/app/layout.tsx`) |

**No new dependencies in 39c.** Skeleton primitive (`src/components/ui/skeleton.tsx`) is the only design-system surface this phase touches; it's already in the repo and already used by `SearchResultsSkeleton`, `VerdictSkeleton`, `HeaderSkeleton`, `WatchSearchResultsSkeleton`, `CollectionSearchResultsSkeleton`, `PhotoSkeleton`.

---

## Spacing Scale

Declared values (Tailwind defaults — multiples of 4):

| Token | Value | Usage in 39c |
|-------|-------|--------------|
| xs | 4px (Tailwind `gap-1` / `p-1`) | — |
| sm | 8px (`gap-2` / `p-2`) | Tab pill row gap — mirrors `ProfileTabs.tsx:65` `gap-2` |
| md | 16px (`gap-4` / `px-4` / `mt-4`) | Layout container side padding — mirrors `layout.tsx:50,113` `px-4` |
| lg | 24px (`mt-6` / `p-6`) | Vertical rhythm between header / tabs / content — mirrors `layout.tsx:136,143` `mt-6` |
| xl | 32px (`py-8`) | Layout container vertical padding — mirrors `layout.tsx:50,113` `py-8` |
| 2xl | 48px (`py-12`) | Layout container vertical padding at `lg:` breakpoint — mirrors `layout.tsx:50,113` `lg:py-12` |
| 3xl | 64px | — |

**Exceptions:** None. The skeleton inherits the layout's existing `<main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">` shell so its outer padding is identical to the resolved profile shell — zero CLS on the swap.

---

## Typography

Phase 39c introduces NO new text content visible to the user. The skeleton renders only `<Skeleton/>` placeholder blocks (no text). The resolved branches (`<ProfileHeader/>`, `<LockedProfileState/>`, `<ProfileTabs/>`, `<CommonGroundHeroBand/>`) carry their existing typography contracts forward unchanged.

| Role | Size | Weight | Line Height | Source / Notes |
|------|------|--------|-------------|----------------|
| Heading (h1 in `<ProfileHeader/>` / `<LockedProfileState/>`) | `text-xl` (20px) | `font-semibold` (600) | `leading-normal` | Existing — `ProfileHeader.tsx:59`, `LockedProfileState.tsx:31`. NOT re-specified by 39c. |
| Body | `text-sm` (14px) | `font-normal` (400) | `leading-relaxed` (~1.625) | Existing — bio, muted-foreground lines. NOT re-specified by 39c. |
| Pill / overlap label (`<CommonGroundHeroBand/>`) | `text-sm` (14px) | `font-semibold` (600) | `leading-normal` | Existing — `CommonGroundHeroBand.tsx:73`. NOT re-specified by 39c. |
| Skeleton placeholders | n/a (no text) | n/a | n/a | Pure `<div>` rects with `animate-pulse rounded-md bg-muted`. |

**Note for planner / executor:** if the executor finds a need to add ANY text to the skeleton (e.g. screen-reader-only "Loading profile" string), use `text-sm font-normal` and gate it behind `sr-only` so it does not render visually. Visible text in the skeleton is OUT OF SCOPE for this phase per D-39c-06.

---

## Color

Phase 39c introduces NO new color tokens. All color comes from existing CSS variables defined in `src/app/globals.css`.

| Role | Value (token) | Usage in 39c |
|------|---------------|--------------|
| Dominant (60%) | `--background` → `oklch(0.985 0.003 75)` light / `oklch(0.14 0.005 75)` dark | Page background under the layout shell |
| Secondary (30%) | `--muted` → `oklch(0.95 0.005 75)` light / `oklch(0.24 0.005 75)` dark | Skeleton placeholder fill (`bg-muted` — see `src/components/ui/skeleton.tsx:16`); resolved content cards (`bg-card`); `<CommonGroundHeroBand/>` background |
| Accent (10%) | `--accent` → `oklch(0.76 0.12 75)` light / `oklch(0.78 0.13 75)` dark | Reserved for: `<CommonGroundHeroBand/>` "Strong overlap" pill (existing, `CommonGroundHeroBand.tsx:14`). NOT used by skeleton. |
| Destructive | `--destructive` → `oklch(0.55 0.22 27)` light / `oklch(0.65 0.2 27)` dark | Not used in 39c. No destructive actions in scope. |

**Accent reserved for:** `<CommonGroundHeroBand/>` "Strong overlap" pill ONLY (existing reservation; 39c adds zero new accent uses).

**Skeleton color contract:** every placeholder block in `<ProfileShellSkeleton/>` MUST use the shadcn `<Skeleton/>` primitive, which applies `bg-muted` + `animate-pulse` via the local `cn(...)` helper. No raw color literals (`#xxxxxx`, `oklch(...)`, raw `bg-gray-NNN`) are permitted in the skeleton source — verified by `tests/no-raw-palette.test.ts` already in the repo.

---

## Streaming & Interaction Contract

This section is the load-bearing 39c contract. It governs how the skeleton transitions to the resolved shell.

### Streaming hop

| Property | Value |
|----------|-------|
| Boundary | Single `<Suspense fallback={<ProfileShellSkeleton/>}>` wrapping the entire `<ProfileGate/>` subtree, inside the layout body. |
| Number of streaming hops | Exactly **one**. The gate either resolves to (a) the public/owner branch (`<ProfileHeader/>` + optional `<CommonGroundHeroBand/>` + `<ProfileTabs/>` + `{children}`) or (b) the locked branch (`<LockedProfileState/>`). |
| Skeleton lifetime | From route segment entry until `<ProfileGate/>` resolves. In production with prefetch=static, this is typically <100ms on warm cache and <600ms on cold cache. |
| Skeleton transition | **Instant flip — no fade, no cross-fade, no `transition-opacity`.** Per Next.js convention and existing repo skeletons (`SearchResultsSkeleton`, `VerdictSkeleton`), the swap is a hard DOM replacement. Suspense handles it; no custom transition. |
| `loading.tsx` boundary | Renders `<ProfileShellSkeleton/>` IDENTICALLY to the layout's Suspense fallback — same component, same dimensions. The two boundaries cover different segments per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md:88` (loading.tsx wraps page + nested layouts; layout's own Suspense wraps the layout body) — they MUST visually match so the user never perceives a skeleton-to-skeleton hop. |

### Resolved-branch fork

When `<ProfileGate/>` resolves, the skeleton is replaced by EXACTLY ONE of:

| Branch | Components rendered | Visual contract source |
|--------|---------------------|------------------------|
| Locked (`!isOwner && !settings.profilePublic`) | `<LockedProfileState/>` only | `src/components/profile/LockedProfileState.tsx` — UNCHANGED |
| Public / Owner | `<ProfileHeader/>` → optional `<CommonGroundHeroBand/>` (when `overlap?.hasAny`) → `<ProfileTabs/>` → `{children}` | `src/components/profile/ProfileHeader.tsx`, `CommonGroundHeroBand.tsx`, `ProfileTabs.tsx` — UNCHANGED |
| Not found (`profile` is null) | `notFound()` bubbles to closest `not-found.tsx` (Next.js built-in fallback today; no new file in 39c) | Existing Next 16 behavior |

### CLS budget on the locked-branch fork

This is the deliberate trade-off locked in D-39c-06. The skeleton renders chrome that resembles the **public** branch (avatar + name + tab pill row + content card). When the gate resolves to the **locked** branch (`<LockedProfileState/>`), the tab pill row and content card are replaced by a single centered lock panel.

| Element | Skeleton dimension | Public-branch dimension | Locked-branch dimension |
|---------|-------------------|-------------------------|--------------------------|
| Avatar circle | 96px (D-39c-06) | 96px (`ProfileHeader.tsx:56` `size={96}`) | 96px (`LockedProfileState.tsx:28` `size={96}`) |
| Tab pill row | 5 pills, each ~h-9 / w-20 (see Component Inventory) | `<ProfileTabs/>` — typically 5–7 pills, each h-9 | NOT RENDERED — collapses to lock panel |
| Content card | `rounded-xl border h-64` | Tab page content (varies) | `rounded-xl border bg-card py-16 text-center` (`LockedProfileState.tsx:56`) |

**CLS verdict:** The skeleton → locked-branch swap WILL produce a small downward layout shift (the tab pill row disappears). This is accepted per D-39c-06 because:
1. The locked branch is the minority path (only fires when a non-owner viewer hits a `profilePublic: false` profile).
2. Adding a tab-row placeholder to the locked render would create visible jank in the opposite direction (an empty pill row briefly showing then collapsing).
3. A header-only skeleton (no tab row) would create the same jank for the majority public path.

The 39c skeleton optimizes for the **public-path** swap (the dominant case), accepting CLS on the locked-path swap.

### Empty / error states

| State | Behavior | Visual |
|-------|----------|--------|
| Profile not found | `notFound()` called inside the gate; bubbles to closest `not-found.tsx` (Next 16 built-in) | Existing Next.js fallback page — out of 39c scope |
| Gate throws unexpected (not `UnauthorizedError`, not `notFound()`) | Re-thrown; bubbles to closest `error.tsx` | None in `src/app/u/[username]/` today; root `error.tsx` handles |
| Cache miss + slow upstream | Skeleton visible for entire resolution window; no timeout / no fallback content | Existing `<ProfileShellSkeleton/>` rendering |
| Owner with empty collection / wishlist | `<ProfileHeader/>` renders with `watchCount: 0` / `wishlistCount: 0`; `tasteTags: []` (the `tasteTags.length > 0` guard at `ProfileHeader.tsx:87` already handles this) | Existing — NOT re-specified by 39c |

### Interaction with prefetch

| State | Behavior |
|-------|----------|
| Link prefetched (production only — `link.md:298`) | The static shell + skeleton render instantly on click; the gate streams in the resolved branch within the same nav. |
| Link not prefetched (dev or `prefetch={false}` site) | Same as above, but the static shell prerender hasn't been cached client-side — the request still resolves through the server with the skeleton appearing on first paint. |
| Build-time gate | `export const unstable_instant = { prefetch: 'static' }` at `[tab]/page.tsx` fails the build (and dev navigation) if the static shell becomes non-instant. This is the compile-time invariant per D-39c-07. |

---

## Component Inventory (NEW in 39c)

### `<ProfileShellSkeleton/>` — chrome-only loading skeleton

**File:** `src/app/u/[username]/profile-shell-skeleton.tsx` (recommended location per RESEARCH; planner may co-locate elsewhere within `src/app/u/[username]/`).

**Render shape (D-39c-06):**

```
┌──────────────────────────────────────────────────────────────────────────┐
│  <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">         │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  ┌───┐                                                             │  │
│  │  │   │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                ← name placeholder       │  │
│  │  │ ● │   (h-6 w-48)                                                │  │
│  │  │   │                                                             │  │
│  │  └───┘                                                             │  │
│  │  96px avatar circle                                                │  │
│  │                                                                    │  │
│  │  (mt-6)                                                            │  │
│  │  ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓                                          │  │
│  │  5 tab pills, h-9 each, w-20 each, gap-2                           │  │
│  │                                                                    │  │
│  │  (mt-6)                                                            │  │
│  │  ┌────────────────────────────────────────────────────────────┐    │  │
│  │  │                                                            │    │  │
│  │  │                                                            │    │  │
│  │  │   content card placeholder — h-64 rounded-xl border        │    │  │
│  │  │                                                            │    │  │
│  │  │                                                            │    │  │
│  │  └────────────────────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  </main>                                                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

**Element-by-element contract (executor-prescriptive):**

| # | Element | Tailwind classes | Source |
|---|---------|------------------|--------|
| 1 | Outer `<main>` | `mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12` | **EXACT match** to `layout.tsx:50,113` so zero outer-CLS on swap. The skeleton may rely on the layout providing this wrapper; if the layout's `<main>` ALREADY wraps the Suspense (recommended per RESEARCH), the skeleton's outer wrapper is just a `<div>` (no `<main>` nesting). Planner picks. |
| 2 | Avatar circle | `<Skeleton className="size-24 rounded-full" />` | `size-24` = 96px, matching `AvatarDisplay size={96}` in `ProfileHeader.tsx:56` and `LockedProfileState.tsx:28`. `rounded-full` enforces circle shape. |
| 3 | Name placeholder | `<Skeleton className="h-6 w-48" />` | `h-6` (24px) matches `text-xl font-semibold` line height; `w-48` (192px) approximates a typical display name width. D-39c-06 literal spec. |
| 4 | Header layout container | `flex flex-col gap-6 py-6 sm:flex-row sm:items-start sm:gap-6 sm:py-12` (or pared-down equivalent) | Mirrors `ProfileHeader.tsx:50` header flex container to minimize CLS in the public swap. Skeleton may simplify this to a single-axis flex if planner prefers — what matters is the avatar + name pair sits roughly where they sit post-resolve. |
| 5 | Tab pill row container | `mt-6 flex w-full gap-2 overflow-x-auto pb-2` | Matches `ProfileTabs.tsx:62-66` outer Tabs/TabsList shape (gap-2, overflow scrollable). `mt-6` matches layout's `mt-6` (`layout.tsx:136`). |
| 6 | Tab pills (x5) | `<Skeleton className="h-9 w-20 rounded-md shrink-0" />` × 5 | `h-9` = 36px matches `TabsTrigger` default touch height (~9 Tailwind units). `w-20` = 80px is a stable mid-tier pill width. Render fixed count of 5 — matches the base tabs from `ProfileTabs.tsx:7-13` (`collection / wishlist / worn / notes / stats`); the conditional Common Ground + Insights tabs are not represented because their visibility depends on gate-resolved viewer state. `shrink-0` prevents horizontal collapse. |
| 7 | Content card placeholder | `<Skeleton className="mt-6 h-64 rounded-xl border" />` | `mt-6` matches `layout.tsx:143` `mt-6` before children. `h-64` = 256px is a stable mid-tier content height. `rounded-xl` matches `<Card>` primitive border-radius. `border` adds the card outline without filling — gives a clearer "card frame is here" hint than a solid muted block alone. |

**Animation:** Each `<Skeleton/>` element provides `animate-pulse` via the primitive (`src/components/ui/skeleton.tsx:16`). No custom animation on the wrapper. No staggered animation between elements — all pulse in unison, matching all existing repo skeletons.

**Accessibility:**
- The component MUST NOT render visible "Loading…" text per D-39c-06.
- The component MAY include `aria-busy="true"` on the outer wrapper and/or a `<span className="sr-only">Loading profile</span>` for screen readers. Planner discretion — both are acceptable. If neither is added, the existing Next.js Suspense convention (no a11y label on skeletons) is also acceptable; no existing repo skeleton has an a11y label.
- No interactive elements inside the skeleton. No focus management needed.

**Server-Component-safe:** The skeleton has no client state, no event handlers, no `'use client'` directive. Pure presentational JSX. Matches the existing `Skeleton` primitive shape (`skeleton.tsx` is server-safe).

### `loading.tsx` — Next 16 loading boundary

**File:** `src/app/u/[username]/loading.tsx` (NEW)

**Render shape:**
```tsx
import { ProfileShellSkeleton } from './profile-shell-skeleton'

export default function Loading() {
  return <ProfileShellSkeleton />
}
```

**No visual contract beyond rendering `<ProfileShellSkeleton/>`.** This file exists to satisfy the Next 16 `loading.js` segment convention (wraps `page.tsx` + nested layouts during navigation; the layout's own `<Suspense>` covers the layout body itself per `loading.md:88,90-95`).

---

## Components Inherited from Prior Phases (UNCHANGED in 39c)

These ship through the new `<ProfileGate/>` Suspense gate with **zero design changes**. Their contracts are locked from prior phases and are NOT re-validated by the 39c UI checker. Listed here only for completeness so the executor sees the full inventory.

| Component | File | Source phase / Notes |
|-----------|------|----------------------|
| `<ProfileHeader/>` | `src/components/profile/ProfileHeader.tsx` | Existing — `'use client'` with edit mode `useState`. Renders avatar/name/bio/follow stats/taste tags. NO refactor needed. |
| `<ProfileTabs/>` | `src/components/profile/ProfileTabs.tsx` | Existing — `'use client'`, conditional Common Ground + Insights tabs. **Reverts `prefetch={false}` at line 73 per D-39c-08** (no visual change — prefetch is invisible UX). |
| `<LockedProfileState/>` | `src/components/profile/LockedProfileState.tsx` | Existing — Server Component, renders avatar/name/bio/follow stats + lock panel. NO refactor needed. |
| `<CommonGroundHeroBand/>` | `src/components/profile/CommonGroundHeroBand.tsx` | Existing — Server Component, three-pill overlap label. Conditionally rendered when `overlap?.hasAny`. NO refactor needed. |
| `<AvatarDisplay/>` | `src/components/profile/AvatarDisplay.tsx` (existing) | Existing — `size={96}` invocation at three sites (ProfileHeader, LockedProfileState; skeleton uses `size-24` Tailwind equivalent, no AvatarDisplay invocation). |
| `<FollowButton/>` | `src/components/profile/FollowButton.tsx` (existing) | Existing — `'use client'`. NO refactor needed. |

**Out-of-scope edits to existing components in 39c:** Three sites have `prefetch={false}` reverted per D-39c-08. These are functional, not visual, reverts and do not change any rendered pixels:
- `src/components/layout/UserMenu.tsx:111-112` — remove `prefetch={false}`
- `src/components/profile/ProfileTabs.tsx:73` — remove `prefetch={false}`
- `src/components/layout/BottomNav.tsx:157` — remove `prefetch={false}` on Profile NavLink + drop `prefetch?: boolean` from `NavLinkProps`

These reverts MUST land LAST in the phase (after layout refactor + skeleton + loading.tsx + invalidation wiring are all in place) per D-39c-08.

---

## Copywriting Contract

Phase 39c does not introduce any new user-facing copy. The skeleton is text-free. All other text comes from existing components.

| Element | Copy | Source |
|---------|------|--------|
| Skeleton (visual) | (none — no visible text) | D-39c-06 |
| Skeleton (a11y, optional) | "Loading profile" (sr-only, planner discretion) | This UI-SPEC |
| Primary CTA on profile page | "Edit Profile" (owner) / "Follow" (viewer, via `<FollowButton/>`) | Existing — `ProfileHeader.tsx:105`, `FollowButton.tsx` |
| Empty state — locked profile | "This profile is private." | Existing — `LockedProfileState.tsx:59` |
| Empty state — no overlap | "No overlap yet — your tastes are distinct." | Existing — `CommonGroundHeroBand.tsx:48` |
| Empty state — no taste tags | (no text — taste-tag list is hidden by `tasteTags.length > 0` gate) | Existing — `ProfileHeader.tsx:87` |
| Error state | Falls back to root `error.tsx` (no profile-specific error UI in 39c) | Existing behavior |
| Profile not found | Falls back to root `not-found.tsx` (no profile-specific 404 in 39c) | Existing Next.js fallback |
| Destructive actions | None in 39c scope | — |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `Skeleton` (already in repo at `src/components/ui/skeleton.tsx`); no new shadcn blocks added in 39c | not required (existing registry, existing primitive) |
| Third-party | none declared | not applicable |

No new shadcn `add` invocations are needed for 39c. The skeleton uses the existing `<Skeleton/>` primitive verbatim.

---

## Test Hooks (planner / executor reference)

The following stable hooks are recommended so 39c's automated tests can assert "skeleton is visible during fetch" without coupling to internal class names. Pattern lifted from `SearchResultsSkeleton.tsx:19,24`.

| Hook | Where | Purpose |
|------|-------|---------|
| `data-testid="profile-shell-skeleton"` | Outer wrapper of `<ProfileShellSkeleton/>` | Assert presence during pending Suspense resolution |
| `data-testid="profile-shell-skeleton-avatar"` (optional) | Avatar circle skeleton | Granular dimensional assertion if needed |
| `data-testid="profile-shell-skeleton-tabs"` (optional) | Tab pill row container | Granular dimensional assertion if needed |
| `data-testid="profile-shell-skeleton-content"` (optional) | Content card placeholder | Granular dimensional assertion if needed |

Test pattern (executor follows when writing assertions):
```ts
// Skeleton present during pending streaming
expect(screen.getByTestId('profile-shell-skeleton')).toBeInTheDocument()
// After resolve
expect(screen.queryByTestId('profile-shell-skeleton')).not.toBeInTheDocument()
expect(screen.getByText(/{owner display name}/)).toBeInTheDocument()
```

---

## Project Lint Notes (planner / executor reference)

Three repo conventions that are easy to trip on this phase:

1. **`tests/no-raw-palette.test.ts`** — forbids `\bfont-medium\b`, raw hex literals, raw `oklch(...)` literals, raw `bg-gray-NNN`, etc. The 39c skeleton uses Tailwind class names that map to tokens (`bg-muted`, `border`, `rounded-xl`, `rounded-md`, `rounded-full`). NO raw colors. NO `font-medium` (the skeleton has no text, so this is moot — but a future iteration adding sr-only text should use `font-normal` or `font-semibold`).
2. **`tests/no-raw-palette.test.ts` font-weight rule** — Phase 39b shipped THREE font-medium → font-semibold flips (39b-02 c205617, 39b-03 049b3f4, 39b-05 ae1d737). If any 39c task surface drafts `font-medium`, planner should pre-empt with `font-semibold`. This is unlikely in 39c (no new text), but flagged so the executor doesn't accidentally introduce it via copy-paste from older skeletons.
3. **Test mock fan-out (pattern from 39b-04 / 39b-05)** — if 39c adds new DAL calls to existing page.tsx Promise.all (e.g. on `[tab]/page.tsx`), planner must add `vi.mock('@/data/...')` boilerplate to any test that exercises those page.tsx files. 39c is unlikely to extend `[tab]/page.tsx`'s Promise.all (the page bodies are out of scope per CONTEXT.md), but the executor should sanity-check before committing.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS — no new copy introduced; existing copy contracts unchanged
- [ ] Dimension 2 Visuals: PASS — skeleton dimensions explicitly enumerated per D-39c-06
- [ ] Dimension 3 Color: PASS — no new color tokens; `bg-muted` via shadcn primitive only
- [ ] Dimension 4 Typography: PASS — no new typography; skeleton is text-free
- [ ] Dimension 5 Spacing: PASS — every spacing value is a Tailwind multiple-of-4 token used in the existing layout
- [ ] Dimension 6 Registry Safety: PASS — only existing shadcn primitive used; no new registry blocks

**Approval:** pending

---

## Source Provenance

| Section | Pre-populated from | Source ref |
|---------|--------------------|------------|
| Design System | Existing repo (components.json + globals.css + package.json) | `src/app/globals.css`, `package.json` |
| Spacing Scale | Existing layout — `layout.tsx:50,113,136,143` + Tailwind defaults | CONTEXT.md (zero new spacing introduced) |
| Typography | Existing components — `ProfileHeader.tsx`, `LockedProfileState.tsx`, `CommonGroundHeroBand.tsx` | NOT re-specified in 39c per scope guard |
| Color | Existing `src/app/globals.css` `:root` + `.dark` tokens | `globals.css:51-83` |
| Streaming & Interaction | CONTEXT.md D-39c-05 (Suspense gate), D-39c-06 (skeleton spec), D-39c-07 (unstable_instant) | `39C-CONTEXT.md` |
| Component Inventory — `<ProfileShellSkeleton/>` | CONTEXT.md D-39c-06 literal spec + existing skeleton patterns (`SearchResultsSkeleton`, `VerdictSkeleton`) | `39C-CONTEXT.md` D-39c-06; `src/components/search/SearchResultsSkeleton.tsx`; `src/components/insights/VerdictSkeleton.tsx` |
| Component Inventory — `loading.tsx` | CONTEXT.md "In scope" list | `39C-CONTEXT.md` |
| Components Inherited | CONTEXT.md "Reusable Assets" + "Out of scope" + scope objective | `39C-CONTEXT.md` |
| Copywriting | Existing components (read directly) + scope guard (no new copy in 39c) | `LockedProfileState.tsx:59`, `CommonGroundHeroBand.tsx:48` |
| Registry Safety | Existing `src/components/ui/skeleton.tsx` | repo state |
| Test Hooks | Pattern from `SearchResultsSkeleton.tsx:19,24` | repo state |
| Lint Notes | Phase 39b STATE.md feedback memory (font-medium → font-semibold; vi.mock fan-out) | STATE.md project memory |

User input: NONE (auto-chain mode, defensible defaults from CONTEXT.md and existing patterns per orchestrator instruction).

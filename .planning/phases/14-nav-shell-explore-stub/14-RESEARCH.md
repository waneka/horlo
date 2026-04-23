# Phase 14: Nav Shell + Explore Stub - Research

**Researched:** 2026-04-23
**Domain:** Next.js 16 App Router navigation — responsive layout shell, Cache Components discipline, iOS safe-area handling, cross-device active state, IBM Plex Sans typography swap
**Confidence:** HIGH — everything critical is verified against installed `node_modules/next@16.2.3` docs and existing source

## Summary

Phase 14 is a large UI shell refactor, not a complex-data phase. The risks are all structural, not algorithmic:

1. **Cache Components discipline** must survive the layout edit. `cacheComponents: true` (next.config.ts L13) forbids `cookies()` in the root layout; the inline theme script is the Phase 10 escape hatch [VERIFIED: `src/app/layout.tsx` L27, `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`]. Any new layout mutation — IBM Plex font, viewport-fit, `<BottomNav />` mount — must sit **inside an existing `<Suspense>` boundary or outside it without introducing runtime reads**.
2. **`usePathname()` hydration in client components is safe** in Next 16 for the BottomNav / SlimTopNav active-state use case (no rewrites in `proxy.ts`, no static-prerender/mismatch vector) [CITED: Next 16 `usePathname` docs].
3. **Lucide-react 1.8.0 does NOT ship filled-variant icons** — confirmed by scanning `lucide-react.d.ts` (457 icon declarations, zero `*Fill` / `*Filled` suffixes). Active-state "filled icon" must use either a background chip (e.g., `bg-accent/10` disc behind the 24×24 outline icon) or a heavier `strokeWidth={2.5}` variant. This contradicts the UI-SPEC copy "filled icon variant" — the planner must either change strategy or load another icon package.
4. **IBM Plex Sans via `next/font/google` is available** with weights 100/200/300/400/500/600/700/variable [VERIFIED: `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`]. The CONTEXT D-09 calls for `font-medium` (500) on nav labels while the UI-SPEC copy says 600 Semibold — this is a decision-vs-UI-SPEC mismatch the planner must surface (resolve by reading the Figma source-of-truth node 1:4714).
5. **`NotificationBell` cache-sharing across two nav surfaces is safe**. Because the component is cached with `cacheTag('notifications', \`viewer:${viewerId}\`)` and both placements pass the same `viewerId`, the React cache + Next data-cache combination de-duplicates the work within a single render tree — no double fetch [VERIFIED: `src/components/notifications/NotificationBell.tsx` L20-23, Next 16 `cacheTag` semantics].
6. **No Playwright / E2E runner** in this project. Nyquist validation must use Vitest + React Testing Library + jsdom (the existing stack) — no new frameworks. E2E-style assertions (viewport-fit meta tag present, MobileNav absent from bundle, `/insights` redirects, PUBLIC_PATHS excludes BottomNav) can all be satisfied with unit tests or tree-shake greps.
7. **`/insights` redirect is a Server Component `redirect()` call**, not a `next.config.ts` redirect. Resolving the target needs `getCurrentUser()` inside the page body, which means it cannot be `'use cache'`-wrapped [CITED: Next 16 `redirect.md`].
8. **ProfileTabs currently uses route segments** (`/u/[username]/[tab]`) with a hard-coded VALID_TABS list — adding Insights as a 6th tab requires extending that list AND the ProfileTabs array. Non-owners must not see the tab AND must receive `notFound()` on direct URL access (mirror the `common-ground` pattern in `src/app/u/[username]/[tab]/page.tsx` L71-85).

**Primary recommendation:** Split Header into two components (`DesktopTopNav` ≥ md, `SlimTopNav` < md) each branched by Tailwind `hidden md:flex` / `md:hidden`, keep them under the existing `<Suspense fallback={<HeaderSkeleton />}>` in `layout.tsx`, and mount `<BottomNav />` as its **own sibling Suspense leaf** (never bare in `<body>`). Use `env(safe-area-inset-bottom)` in Tailwind arbitrary values (works in Tailwind 4). Move `NotificationBell` to both nav surfaces with the same `viewerId` prop and no contract change. Lock the Figma active-state treatment to a **background chip** (no filled-icon variant available in lucide-react 1.8.0).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mobile bottom nav visual (NAV-01, NAV-02, NAV-04)**
- **D-01:** Cradle/notch = elevated circle, no SVG cutout. Bar renders flat; the Wear button is a 56×56 circle positioned to extend ~20px above the bar top with `shadow-lg` (two-layer: `0 10px 15px 0 rgba(0,0,0,0.1)` + `0 4px 6px 0 rgba(0,0,0,0.1)` — matches Figma 1:4725). Locked by Figma node `1:4714`.
- **D-02:** Wear circle icon = watch icon (not `Plus`). 28×28 inside the circle. Non-Wear items render 24×24 icons.
- **D-03:** Wear label "Wear" renders underneath the circle in `text-accent` (same color as the circle fill), matching Figma.
- **D-04:** Active state in bottom nav = filled icon variant + `text-accent` label. Inactive = outline-stroke icon + `text-muted-foreground` label. The active route is resolved via `usePathname()` in a Client Component (NAV-04; Pitfall A-2).
- **D-05:** Accent color: use the existing `--accent` Tailwind token (warm gold, `oklch(0.76 0.12 75)` light / `oklch(0.78 0.13 75)` dark). Do NOT import the Figma teal `#5b8fb9` — the palette update is tracked as a separate future phase.
- **D-06:** Bar height (content zone) = 60px + `env(safe-area-inset-bottom)`. Pages add `pb-[calc(4rem+env(safe-area-inset-bottom))]` to `<main>` so the bottom of scroll content clears the nav (NAV-03).
- **D-07:** Root layout viewport meta must include `viewport-fit=cover` (NAV-03). Add to `src/app/layout.tsx` `metadata.viewport` or a `<meta>` tag.

**Typography (global)**
- **D-08:** Replace Geist sans with IBM Plex Sans as the global default body font. Load via `next/font/google` in `src/app/layout.tsx`. Keep Geist Mono (code contexts) and Instrument Serif (`font-serif` utility — Horlo wordmark, Insights page h1). The `--font-geist-sans` CSS var is renamed/replaced with `--font-sans` pointing at IBM Plex.
- **D-09:** Nav label style matches Figma: `font-medium` (IBM Plex Sans Medium 500 weight), `text-[12px]`, `leading-[16px]`. Applies to bottom nav labels.

**Nav destinations map (NAV-10, NAV-12)**
- **D-10:** Bottom nav routes: Home → `/`, Explore → `/explore`, Wear → opens shared `WatchPickerDialog` (NAV-09 — single component, no forks; Pitfall I-2), Add → `/watch/new` (NAV-10), Profile → `/u/[me]/collection`.
- **D-11:** Slim top nav routes: logo → `/`, search icon → `/search` (stub), notifications bell → `/notifications`, settings cog → `/settings`.
- **D-12:** `/preferences` does not have its own mobile nav entry. Add a "Taste Preferences" link row inside `/settings` that routes to `/preferences`. Desktop can retain or remove the HeaderNav Preferences link (planner's discretion — either is fine).
- **D-13:** `/insights` top-level route is retired. Create a new owner-only "Insights" tab on the profile page (under `/u/[username]/...`). The `/insights` URL redirects (`redirect()`) to the profile's Insights tab. The new tab is gated — it renders only when `viewer.id === profile.user_id`; non-owners never see the tab link or any of its data.
- **D-14:** Remove the `{ href: '/insights', label: 'Insights' }` entry from `baseNavItems` in `src/components/layout/HeaderNav.tsx`. Insights is now reached exclusively via Profile → Insights tab on both desktop and mobile.
- **D-15:** The existing public Stats tab on the profile is unchanged. Stats = public aggregate; Insights = owner-only (deals, value, sleeping beauties, wear insights, distribution charts with price data). These coexist as two distinct tabs.

**Desktop top nav + profile dropdown (NAV-07, NAV-08)**
- **D-16:** Desktop top nav composition left→right: Horlo wordmark · Explore link · persistent search input (routes to `/search`) · NavWearButton · Add icon link (`/watch/new`) · NotificationBell · profile dropdown (UserMenu extended). Existing `ThemeToggle` is removed from the desktop nav strip.
- **D-17:** Profile dropdown consolidates: Signed-in-as header, Profile link (`/u/[me]/collection`), Settings link (`/settings`), inline 3-button segmented Theme control (Light · Dark · System — renders the current `ThemeToggle` options inline, not a submenu), Sign out. This is a Claude's Discretion default — implementer may swap to a nested submenu if the segmented row overflows.

**Route stubs (NAV-11 + new `/search` stub)**
- **D-18:** `/explore` — new route; minimal "coming soon" placeholder. Use existing `Card` or empty-state shell; `Sparkles` (lucide) icon + heading + one-line teaser copy ("Discovery is coming." or similar). Mirror the visual density of `NotificationsEmptyState`.
- **D-19:** `/search` — new route (scope addition to Phase 14 beyond the ROADMAP wording). Same "coming soon" pattern. Phase 16 will rewrite this page; Phase 14 just prevents broken-link risk from the nav search icon / desktop search input.
- **D-20:** Both stub pages render inside the authenticated shell (sit below the Header + above BottomNav). Both are protected by the existing `proxy.ts` auth redirect.

**Auth-route exclusion (NAV-05)**
- **D-21:** Extract the auth-route list from `src/proxy.ts` into a shared constant `src/lib/constants/public-paths.ts` exporting `PUBLIC_PATHS: readonly string[]`. Both `proxy.ts` and the new nav components import from this constant — single source of truth.
- **D-22:** `BottomNav` and `SlimTopNav` are Client Components that call `usePathname()` and render `null` when the pathname matches any `PUBLIC_PATHS` prefix. Same guard applies to the shared constant check used in `proxy.ts` (no regex divergence).

**Notification bell relocation (Phase 13 cleanup)**
- **D-23:** The `NotificationBell` currently lives in `Header.tsx` under a "TEMP: UAT placement — Phase 14 will move this to the new nav" comment. Phase 14 moves it to both nav surfaces: desktop top nav bell slot (between Add and profile dropdown) and slim mobile top nav bell slot (between search icon and settings cog). `viewerId` prop plumbing stays as-is (Phase 13 D-25 two-layer discipline).
- **D-24:** Bell remains its own Suspense leaf (Pitfall B-1, A-1) — `cacheLife 30s` + `cacheTag('notifications', 'viewer:${viewerId}')` unchanged from Phase 13.

**DEBT-01 (verify-only)**
- **D-25:** DEBT-01 shipped in Phase 999.1 Plan 01 (MR-01). Verified in `src/components/preferences/PreferencesClient.tsx` L44-60 — `saveError` state + inline `role="alert"` banner + `isPending` → "Saving…" hint all present. Phase 14 plan includes a single verification task that re-asserts the DEBT-01 acceptance criteria and updates REQUIREMENTS.md traceability to mark DEBT-01 as complete via 999.1. **No new code** for this line item.

### Claude's Discretion
- Exact Tailwind class names for the Wear circle elevation zone (e.g., `-top-5`, `mt-[-20px]`, or absolute positioning) — whatever renders pixel-correct against Figma 1:4725.
- Icon selection specifics — the planner picks specific lucide icons for Home (`Home`), Explore (`Compass`/`Sparkles`), Wear (`Watch`), Add (`Plus`), Profile (`User`). Swap if Figma implies different icons.
- Filled vs outline icon pairing for NAV-04 active state (Lucide has some `-fill` variants; otherwise add a background chip or swap to a heavier-stroke variant).
- Exact empty-state copy and Icon choice for `/explore` and `/search` stubs (D-18/D-19).
- Placement of the Settings → Preferences link row within `/settings` (ordering among existing sections).
- Whether the Insights tab is a distinct route segment (`/u/[username]/insights`) or a search-param tab — the planner picks based on existing ProfileTabs pattern; either is acceptable as long as it matches the existing Collection / Wishlist / Stats / Worn tab mechanism.

### Deferred Ideas (OUT OF SCOPE)
- **Global accent palette update** — Figma nav uses teal `#5b8fb9` but Phase 14 uses the existing warm-gold `--accent`. Future design-system phase.
- **Insights/Stats unification into a single visibility-aware tab** — user opted to keep them as separate tabs. Revisit if real usage shows overlap confusion.
- **Search functionality** — Phase 14 ships a `/search` stub only; Phase 16 implements debounced people-search (SRCH-01..07).
- **`/explore` feed content** — placeholder copy only in Phase 14. Discovery feed is future beyond v3.0.
- **Swap to Figma's teal accent globally** — conditional on the palette phase; would flip every `bg-accent` / `text-accent` consumer simultaneously.
- **Desktop nav Preferences link** — planner's discretion whether to keep or remove from desktop HeaderNav.
- **NotificationBell settings in profile dropdown** — Phase 13 already exposes opt-out toggles on `/settings`. Inline surfacing in the bell is a future UX phase.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-01 | Sticky mobile bottom nav (5 items) always visible at <768px | `fixed bottom-0 left-0 right-0 z-50` + `md:hidden` (Tailwind 4 standard); never-hide-on-scroll is default (no scroll listener). See `## Architecture Patterns` → "Sticky BottomNav" and "Mounting strategy". |
| NAV-02 | Cradle/notch visual for centered elevated Wear CTA | D-01 locks "elevated circle, no SVG cutout". `flex justify-between items-end` parent; Wear column uses `-translate-y-5` or negative `top` to clear the bar plane with the Figma-spec two-layer `shadow-[0px_10px_15px_...]`. See `## Architecture Patterns` → "Wear circle elevation". |
| NAV-03 | iOS safe-area-inset-bottom; `viewport-fit=cover` in viewport meta; `<main>` gets `pb-[calc(4rem+env(safe-area-inset-bottom))]` | `export const viewport: Viewport = { viewportFit: 'cover' }` in `src/app/layout.tsx` per Next 16 static `viewport` export pattern [CITED: Next 16 `generate-viewport.md`]. Tailwind 4 accepts `env()` inside arbitrary values. See `## Common Pitfalls` → "P-03 Safe-area bottom-padding". |
| NAV-04 | Active route = filled icon + accent color | **Lucide-react 1.8.0 has no filled-variant icons** [VERIFIED: grep of `node_modules/lucide-react/dist/lucide-react.d.ts`]. Planner must pick: (a) `bg-accent/10` disc behind icon + `text-accent` stroke, or (b) `strokeWidth={2.5}` + `text-accent`. Active detection via `usePathname()` in Client Component [CITED: `use-pathname.md`]. See `## Don't Hand-Roll` → "Filled/outline icon pairing". |
| NAV-05 | BottomNav and SlimTopNav hidden on auth routes | D-21 extracts `PUBLIC_PATHS` to `src/lib/constants/public-paths.ts`; both client nav components render `null` when `usePathname()` prefix-matches. Proxy imports the same constant — single source of truth. See `## Architecture Patterns` → "Public paths constant". |
| NAV-06 | Slim mobile top nav: logo · search icon · notifications bell · settings cog | Composition per UI-SPEC "Slim Mobile Top Nav" section. Bell retains its cached Server-Component contract (D-23/D-24). |
| NAV-07 | Desktop top nav ≥768px: logo · Explore · search input · Wear CTA · Add · bell · profile dropdown | Composition per UI-SPEC "Desktop Top Nav" section. Existing Header.tsx refactors: remove `MobileNav` + `ThemeToggle` + TEMP bell placement. |
| NAV-08 | Desktop profile dropdown consolidates Profile · Settings · Theme · Sign out | D-17 default is inline 3-button theme segmented row. See `## Architecture Patterns` → "UserMenu extension". |
| NAV-09 | Wear CTA in both nav surfaces opens shared `WatchPickerDialog` — single component, no forks (Pitfall I-2) | Existing `NavWearButton.tsx` already lazy-loads the picker and accepts `ownedWatches` — reused verbatim in both nav surfaces. See `## Don't Hand-Roll` → "WatchPickerDialog". |
| NAV-10 | Add icon routes to `/watch/new` | Plain `<Link href="/watch/new">` in both nav surfaces. No new action needed. |
| NAV-11 | `/explore` route exists with coming-soon page | New `src/app/explore/page.tsx`, Server Component, mirrors `NotificationsEmptyState` visual density. |
| NAV-12 | `MobileNav` component removed from codebase | Grep confirms only 2 usages: `src/components/layout/MobileNav.tsx` (itself) and `src/components/layout/Header.tsx` (import + JSX). No tests reference it. Delete file + `import { MobileNav }` line in Header + `<MobileNav />` JSX. See `## Runtime State Inventory`. |
| DEBT-01 | Preference save failures surface user-visible error UX | **Already shipped in Phase 999.1** [VERIFIED: `src/components/preferences/PreferencesClient.tsx` L44-92 shows `saveError` state, `role="alert"` banner L88-92, `aria-live="polite"` "Saving…" hint L93-97]. Phase 14 verification task only — no new code. See `## Architecture Patterns` → "DEBT-01 verification". |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack**: Next.js 16 App Router — continue with existing framework, no rewrites. Project explicitly flags "This is NOT the Next.js you know" in `AGENTS.md` — consult `node_modules/next/dist/docs/` before writing any code that leans on training-data assumptions.
- **Data model**: Watch and UserPreferences types are established — extend, don't break. (Phase 14 is shell-only, no data-model impact.)
- **Personal first**: Single-user experience + data isolation (still applies to cross-user Insights tab gating).
- **Performance**: Target <500 watches per user — Insights tab content re-uses the existing `/insights` page data shape; no new heavy queries.
- **No raw palette colors** — `tests/no-raw-palette.test.ts` lints for hardcoded hexes/oklch in JSX. Nav must use existing `--accent` / `--muted-foreground` tokens (already enforced by D-05).
- **No raw `<img>`** — `tests/no-raw-img.test.ts` lints for raw img tags. Nav icons are lucide components, so not affected.
- **GSD workflow enforcement** — this research run itself is part of the workflow. Files created here commit to git if `commit_docs: true` (confirmed in `.planning/config.json`).

## Standard Stack

### Core (already installed — no new dependencies required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.3 | App Router, cacheComponents, viewport metadata | Already the project framework |
| `react` / `react-dom` | 19.2.4 | Render + Suspense + cacheComponents Activity preservation | Already installed |
| `next/font/google` | (bundled with next 16.2.3) | IBM Plex Sans font loader | Already used for Geist / Geist_Mono / Instrument_Serif |
| `lucide-react` | 1.8.0 | Icon set | Already used throughout; verified Home/Compass/Sparkles/Watch/Plus/User/Bell/Search/Settings/Cog/Inbox all exported |
| `tailwindcss` | ^4 (with `@tailwindcss/postcss`) | Arbitrary values (`pb-[calc(...)]`), `env()` support, `@theme` block | Already configured |
| `@base-ui/react` / `shadcn` | 1.3.0 / 4.2.0 | `DropdownMenu`, `Popover`, `Tabs` primitives | Already installed and used in `UserMenu` / `ThemeToggle` / `ProfileTabs` |
| `clsx` + `tailwind-merge` | 2.1.1 / 3.5.0 | Conditional class composition via `cn()` | Already standard in project |
| `vitest` + `@testing-library/react` + `jsdom` | 2.1.9 / 16.3.2 / 25.0.1 | The sole test stack in this project | No Playwright — verified via `package.json` inspection |

### Supporting (none new)
No new supporting libraries required. Phase 14 is purely compositional on top of the existing stack.

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| lucide-react (no filled variants) | `@phosphor-icons/react` (has duotone/fill) | +1 icon dependency, ~60KB, new import pattern | **Do NOT swap.** Use background-chip or strokeWidth=2.5 active-state (see P-05). Stay with one icon package. |
| Custom font `@font-face` declaration | `next/font/google` (current) | Worse FOUT / FOIT control; no subset optimization | Keep `next/font/google` — already the project pattern for Geist and Instrument Serif |
| `Sheet` (shadcn) drawer for mobile nav | Sticky `fixed` BottomNav | User explicitly rejected drawer (CONTEXT out-of-scope) | BottomNav only |

**Installation:** None — all required packages already installed.

**Version verification (performed via local `node_modules` inspection, not npm registry — project is offline-safe):**
- `next@16.2.3` — installed, docs present in `node_modules/next/dist/docs/`
- `react@19.2.4` — installed
- `lucide-react@1.8.0` — installed; grep of `lucide-react.d.ts` confirms Home, Compass, Sparkles, Watch, Plus, User, Bell, Search, Settings, Cog, Inbox, BellDot all exported. **No `*Fill` or `*Filled` variants exist.** [VERIFIED]
- `tailwindcss@^4` — installed with `@tailwindcss/postcss`; `env()` inside arbitrary values is a Tailwind 4 feature.

## Architecture Patterns

### Recommended File Structure (diff from current)
```
src/
├── app/
│   ├── layout.tsx                    [EDIT: replace Geist with IBM_Plex_Sans; add viewport with viewport-fit:'cover'; mount <BottomNav /> as sibling Suspense leaf]
│   ├── explore/
│   │   └── page.tsx                  [NEW: coming-soon stub]
│   ├── search/
│   │   └── page.tsx                  [NEW: coming-soon stub]
│   └── insights/
│       └── page.tsx                  [REWRITE: redirect() → /u/[me]/insights]
├── components/
│   ├── layout/
│   │   ├── Header.tsx                [EDIT: split by md breakpoint — delegate to SlimTopNav < md, DesktopTopNav >= md; or inline branches]
│   │   ├── HeaderNav.tsx             [EDIT: remove /insights from baseNavItems]
│   │   ├── HeaderSkeleton.tsx        [EDIT: match new Header layout]
│   │   ├── MobileNav.tsx             [DELETE]
│   │   ├── BottomNav.tsx             [NEW: Client Component, usePathname, 5 items]
│   │   ├── SlimTopNav.tsx            [NEW: logo + search + bell + cog; bell is Server Component child]
│   │   ├── DesktopTopNav.tsx         [NEW: logo + HeaderNav + search input + NavWearButton + Add + bell + UserMenu]
│   │   ├── NavWearButton.tsx         [UNCHANGED — reused in both nav surfaces]
│   │   ├── UserMenu.tsx              [EDIT: add Profile / Settings / inline theme / Sign out per D-17]
│   │   └── ThemeToggle.tsx           [UNCHANGED — or moved to be read-only options in UserMenu]
│   └── profile/
│       └── ProfileTabs.tsx           [EDIT: accept isOwner prop; conditionally append Insights tab]
├── app/u/[username]/[tab]/
│   └── page.tsx                      [EDIT: add 'insights' to VALID_TABS; non-owner → notFound(); owner → render InsightsTabContent]
├── components/profile/
│   └── InsightsTabContent.tsx        [NEW: content from /insights/page.tsx lifted into a tab-sized Client/Server component]
├── components/settings/
│   └── SettingsClient.tsx            [EDIT: add "Taste Preferences" link row routing to /preferences]
├── lib/
│   └── constants/
│       └── public-paths.ts           [NEW: shared PUBLIC_PATHS constant]
└── proxy.ts                          [EDIT: import PUBLIC_PATHS from shared constant]
```

### Pattern 1: Cache Components + Inline Theme Script + Suspense (Phase 10 canonical — DO NOT BREAK)
**What:** Root layout declares `cacheComponents: true` (next.config.ts L13). Layout body cannot read `cookies()` or other runtime primitives. Theme boot runs via an inline blocking `<script>` in `<head>`, which sets the `.dark` class before first paint. `<Header />` and `<main>` stream inside `<Suspense>` leaves. [VERIFIED: `src/app/layout.tsx` L27-53]

**When to use:** Always. Any layout edit must preserve this shape.

**Example (current layout, showing the pattern):**
```tsx
// Source: src/app/layout.tsx
<html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}>
  <head>
    <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
  </head>
  <body className="min-h-full flex flex-col bg-background">
    <ThemeProvider>
      <Suspense fallback={<HeaderSkeleton />}><Header /></Suspense>
      <Suspense fallback={null}><main className="flex-1">{children}</main></Suspense>
    </ThemeProvider>
  </body>
</html>
```

**Phase 14 addition shape (recommendation):**
```tsx
// Source: to-be-written src/app/layout.tsx — Phase 14
import { IBM_Plex_Sans, Geist_Mono, Instrument_Serif } from 'next/font/google'
import type { Metadata, Viewport } from 'next'

const ibmPlexSans = IBM_Plex_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],   // D-09 Medium, UI-SPEC Semibold/Regular, plus 700 for emphasis
})
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const instrumentSerif = Instrument_Serif({ variable: '--font-serif', subsets: ['latin'], weight: '400' })

export const viewport: Viewport = {
  viewportFit: 'cover',    // NAV-03 — iOS safe-area opt-in
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${ibmPlexSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background">
        <ThemeProvider>
          <Suspense fallback={<HeaderSkeleton />}><Header /></Suspense>
          <Suspense fallback={null}><main className="flex-1">{children}</main></Suspense>
          {/* BottomNav in its own Suspense leaf — Pitfall A-1 */}
          <Suspense fallback={null}><BottomNav /></Suspense>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Pattern 2: Wear circle elevation (D-01 / Figma 1:4714 geometry)
**What:** Flat bar + absolutely elevated circle column. Do NOT use SVG cutout.

**Structure (reference sketch — planner tunes pixel values against Figma):**
```tsx
// Source: to-be-written src/components/layout/BottomNav.tsx
<nav
  className={cn(
    'fixed bottom-0 left-0 right-0 z-50',
    'flex items-end justify-between',
    'bg-background/95 backdrop-blur border-t border-border',
    'h-[calc(60px+env(safe-area-inset-bottom))]',     // NAV-03 D-06
    'pb-[env(safe-area-inset-bottom)]',
    'px-2',
  )}
>
  {navItems.map((item) => (
    item.kind === 'wear' ? (
      <button
        key="wear"
        onClick={openPicker}
        aria-label="Log a wear"
        className="flex flex-col items-center gap-1 -translate-y-5"  // elevate ~20px above bar plane
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-accent shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)]">
          <Watch className="size-7 text-accent-foreground" aria-hidden />
        </span>
        <span className="text-[12px] leading-[16px] font-medium text-accent">Wear</span>
      </button>
    ) : (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className="flex flex-1 flex-col items-center gap-1 py-2 min-h-11"
      >
        <item.Icon className={cn('size-6', active ? 'text-accent' : 'text-muted-foreground')} strokeWidth={active ? 2.5 : 2} aria-hidden />
        <span className={cn('text-[12px] leading-[16px] font-medium', active ? 'text-accent' : 'text-muted-foreground')}>
          {item.label}
        </span>
      </Link>
    )
  ))}
</nav>
```

**Why this shape:**
- `items-end` aligns the 60px-tall non-Wear columns to the bar baseline while the Wear column's `-translate-y-5` floats it above.
- `flex-1` on non-Wear items equalizes widths regardless of viewport width (no hardcoded `left` values that break on 360px and 430px devices).
- `min-h-11` (44px) meets WCAG tap-target minimum for non-Wear buttons.
- `aria-current="page"` is the canonical a11y hook for active-route state.

### Pattern 3: Public paths constant (D-21)
**What:** Single source of truth for auth routes, imported by proxy and nav components.

**Example:**
```ts
// Source: to-be-written src/lib/constants/public-paths.ts
export const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth',    // /auth/callback, /auth/confirm, etc.
] as const

export type PublicPath = typeof PUBLIC_PATHS[number]

/** True when `pathname` starts with any public-path prefix. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`))
}
```

Proxy refactor:
```ts
// Source: src/proxy.ts — after Phase 14
import { isPublicPath } from '@/lib/constants/public-paths'
// …
const isPublic = isPublicPath(pathname)
```

Client nav components:
```tsx
// Source: src/components/layout/BottomNav.tsx — render gate
'use client'
import { usePathname } from 'next/navigation'
import { isPublicPath } from '@/lib/constants/public-paths'

export function BottomNav() {
  const pathname = usePathname() ?? ''
  if (isPublicPath(pathname)) return null
  // …render
}
```

**Note on `isPublicPath` semantics:** The current proxy uses `startsWith(p)` with no slash, which means `/login` matches BUT ALSO `/loginfoo` would match. The new helper preserves that lenient behavior for backward compat but tightens `/auth` → `/auth/*` + query to avoid `/authentication` collisions. Planner should verify no existing route begins with any of these prefixes (current routes `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/*` are safe).

### Pattern 4: UserMenu extension with inline theme segmented control (D-17)
**What:** Three-button inline segmented row inside `DropdownMenuContent`, replacing the separate `ThemeToggle` Popover.

**Example:**
```tsx
// Source: to-be-written src/components/layout/UserMenu.tsx — Phase 14 extension
<DropdownMenuContent align="end" className="w-64">
  <DropdownMenuGroup>
    <DropdownMenuLabel className="font-normal">
      <div className="text-xs text-muted-foreground">Signed in as</div>
      <div className="truncate text-sm">{user.email}</div>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem render={<Link href={`/u/${username}/collection`} />}>Profile</DropdownMenuItem>
    <DropdownMenuItem render={<Link href="/settings" />}>Settings</DropdownMenuItem>
    <DropdownMenuSeparator />
    <div className="px-2 py-1.5">
      <div className="mb-1.5 text-xs text-muted-foreground">Theme</div>
      <InlineThemeSegmented />     {/* Client subcomponent reading useTheme, 3 buttons */}
    </div>
    <DropdownMenuSeparator />
    <DropdownMenuItem render={<form action={logout}><button type="submit" className="w-full text-left text-destructive">Sign out</button></form>} />
  </DropdownMenuGroup>
</DropdownMenuContent>
```

**Why the inline subcomponent:** `useTheme()` is a client hook; keeping it inside a nested Client Component boundary (`InlineThemeSegmented`) lets the rest of `UserMenu` remain a Server Component if ever refactored back.

### Pattern 5: Insights tab as a route segment (D-13 — recommended approach)
**What:** Extend `/u/[username]/[tab]` to accept `insights` as a valid tab value. Follow the exact `common-ground` pattern: `notFound()` for non-owners, render for owners.

**Example:**
```tsx
// Source: src/app/u/[username]/[tab]/page.tsx — after Phase 14 edit
const VALID_TABS = ['collection', 'wishlist', 'worn', 'notes', 'stats', 'common-ground', 'insights'] as const

// …later in body, BEFORE the common tab branches:
if (tab === 'insights') {
  if (!isOwner) notFound()    // Letterboxd uniform 404 — no existence leak
  // Render InsightsTabContent (lifted from the retired /insights/page.tsx)
  return <InsightsTabContent profileUserId={profile.id} />
}
```

ProfileTabs update:
```tsx
// Source: src/components/profile/ProfileTabs.tsx — after Phase 14 edit
interface ProfileTabsProps {
  username: string
  showCommonGround?: boolean
  isOwner?: boolean    // NEW
}

const OWNER_INSIGHTS_TAB = { id: 'insights', label: 'Insights' } as const

// In the tabs array construction:
const tabs = [
  ...BASE_TABS,
  ...(showCommonGround ? [COMMON_GROUND_TAB] : []),
  ...(isOwner ? [OWNER_INSIGHTS_TAB] : []),     // Owner-only — non-owners never see the link
]
```

Layout wiring (existing `/u/[username]/layout.tsx` already computes `isOwner` at L37):
```tsx
<ProfileTabs username={username} showCommonGround={overlap?.hasAny ?? false} isOwner={isOwner} />
```

### Pattern 6: `/insights` retirement via Server Component redirect
**What:** Replace the existing `src/app/insights/page.tsx` body with a redirect. Keep the file so existing bookmarks don't 404; they get a 307 to the profile tab.

**Example:**
```tsx
// Source: to-be-written src/app/insights/page.tsx — Phase 14 full rewrite
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getProfileById } from '@/data/profiles'

export default async function InsightsRetirementPage() {
  // redirect() throws NEXT_REDIRECT — keep outside try/catch per Next 16 semantics.
  // Unauthenticated users never reach this page (proxy.ts sends them to /login first).
  const user = await getCurrentUser()
  const profile = await getProfileById(user.id)
  if (!profile?.username) {
    // Edge case: user row exists but profile not yet backfilled — bounce to home.
    redirect('/')
  }
  redirect(`/u/${profile.username}/insights`)
}
```

**Why not a `next.config.ts` redirect:** The redirect target depends on the authenticated user's username, which is a runtime per-request value. `next.config.ts` redirects are static — they can't template from the logged-in user.

### Pattern 7: DEBT-01 verification (no new code)
**What:** DEBT-01 already shipped in Phase 999.1. Phase 14 only verifies and updates traceability.

**Verification:** [VERIFIED: `src/components/preferences/PreferencesClient.tsx` L44-60 reads]
- L46: `const [saveError, setSaveError] = useState<string | null>(null)` ✓
- L58-61: ActionResult inspection: `if (!result.success) { setSaveError(result.error) }` ✓
- L88-92: `{saveError && <p role="alert" className="text-sm text-destructive">Couldn&apos;t save preferences: {saveError}</p>}` ✓
- L93-97: `{isSaving && !saveError && <p className="text-xs text-muted-foreground" aria-live="polite">Saving…</p>}` ✓

**Phase 14 action:** One test that asserts the `role="alert"` banner renders when `savePreferences` returns `{ success: false, error: '…' }` (locks the 999.1 fix against regression per CONTEXT `<specifics>`). Update `.planning/REQUIREMENTS.md` traceability row for DEBT-01 to note "Complete via Phase 999.1 — verified in Phase 14".

### Anti-Patterns to Avoid

- **Mounting `<BottomNav />` as a bare sibling of `<body>`** — breaks `cacheComponents` streaming because the nav becomes part of the static shell but contains client-only state (`usePathname`). Always wrap in a `<Suspense fallback={null}>` leaf [Pitfall A-1].
- **Reading `cookies()` / `headers()` in the root layout body** — forbidden by `cacheComponents: true` [CITED: `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md` L175]. Theme boot already uses the inline script escape hatch; do not reintroduce any runtime primitives in layout body during the Phase 14 edit.
- **Conditional rendering of `BottomNav` via a Server Component wrapper** that reads the pathname — there is no server-side pathname primitive in App Router; `usePathname()` is Client-only [CITED: `use-pathname.md` L37]. Gate via the Client Component with `if (isPublicPath(pathname)) return null`.
- **Forking `WatchPickerDialog`** for the mobile-bottom Wear trigger — explicitly forbidden by Pitfall I-2 [CITED: ROADMAP Pitfall I-2]. Reuse `NavWearButton` (which lazy-loads the dialog) in both nav surfaces.
- **Inlining the auth-route list** in the nav components — diverges from `proxy.ts`. D-21 extracts to a shared constant; honor it.
- **Using `<MobileNav />` as a fallback for BottomNav during migration** — CONTEXT D-14 + NAV-12 require deletion of the component in the same phase. Don't leave it around "just in case".
- **Stacking the `ThemeToggle` button AND the UserMenu theme section** — D-16 removes the top-strip `ThemeToggle`. One theme control path only, inside the dropdown.
- **Adding `Insights` as a search-param tab when the existing pattern is route segments** — the project uses `/u/[username]/[tab]/page.tsx` route segments (VALID_TABS list). Use the same pattern (Pattern 5 above) for consistency.
- **Reading `photo_url` for the bottom-nav Wear flow** — Phase 14 does not touch wear events. NavWearButton just opens the picker. Storage signed URLs are Phase 15's problem.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font loading | Custom `@font-face` + `font-display` tuning | `next/font/google` with `IBM_Plex_Sans` | Auto-subset, preload, zero-layout-shift, self-hosted. Already project pattern. |
| Active-route detection | Custom context / React state plumbing | `usePathname()` from `next/navigation` | Zero-cost, survives streaming, no hydration mismatch when the client pathname matches the server path (no rewrites in this project). |
| Filled/outline icon pairing (NAV-04) | Hand-drawing filled SVGs | `strokeWidth={2.5}` + `text-accent` OR `bg-accent/10` ring behind outline icon | Lucide-react 1.8.0 has **no filled variants** [VERIFIED]. Introducing a second icon package for one variant is not worth the bundle cost. |
| iOS safe-area | Hardcoded `pb-8` or user-agent sniffing | `env(safe-area-inset-bottom)` in Tailwind arbitrary values + `viewport-fit=cover` in metadata | Browser-native, adapts to notch / home indicator / rotation. |
| Cached unread-bell count | New DAL function | `NotificationBell` Server Component (Phase 13 D-25/D-26) | Already shipped. Just place it in two nav surfaces. Same `viewerId` → same cache entry; no double-fetch. |
| Shared WatchPickerDialog trigger | Second Wear button component | `NavWearButton` (existing, lazy-loaded) | Pitfall I-2. Reuse verbatim in BottomNav + DesktopTopNav. |
| Auth-route detection | Regex in each nav component | `isPublicPath(pathname)` helper in `src/lib/constants/public-paths.ts` | D-21 single source of truth. |
| Viewer-aware Insights tab gating | Ad-hoc `if (viewer === owner)` checks sprinkled in each tab query | Two-layer gate: (a) `ProfileTabs` omits tab link for non-owners, (b) `[tab]/page.tsx` calls `notFound()` if `!isOwner && tab === 'insights'` | Mirrors the existing Phase 12 two-layer discipline and the Letterboxd 404 pattern already used for missing profiles. |
| Insights route retirement | Deleting `src/app/insights/page.tsx` (breaks bookmarks) | Keep the file; `redirect()` to `/u/[me]/insights` | Preserves bookmark continuity; 307 is cheap. |

**Key insight:** Phase 14 is a composition phase. Almost every "new" thing is actually a remix of existing primitives — `NavWearButton`, `NotificationBell`, `DropdownMenu`, `Tabs`, `usePathname`, `next/font/google`. The single greenfield piece is `BottomNav` itself, and its risk isn't the code — it's the **Suspense placement** in `layout.tsx` and the **`PUBLIC_PATHS` gate**.

## Runtime State Inventory

> This phase involves component deletion (`MobileNav`), route retirement (`/insights`), and URL-space migration (`/preferences` loses direct nav entry). Inventorying runtime state is critical.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — no database rows reference the retired nav surfaces. | None — verified via grep of `src/data/**` and `src/db/schema.ts`. |
| **Live service config** | None — no Supabase / Vercel / external service references `MobileNav`, `/insights`, or the removed nav items. | None. |
| **OS-registered state** | None — no Task Scheduler / launchd / systemd units reference any of these files. | None. |
| **Secrets / env vars** | None — `NOTIFY_*` feature flags do not exist; bell opt-outs live in DB. | None. |
| **Build artifacts / installed packages** | None — no compiled artifacts reference `MobileNav` by name (Next.js build output is regenerated each build). | None. |
| **Repo-side references to MobileNav** | `grep MobileNav src` returns exactly 2 files: `src/components/layout/MobileNav.tsx` (the component) and `src/components/layout/Header.tsx` (import + JSX usage) [VERIFIED]. `grep MobileNav tests` returns zero results. | Delete the component file + both lines in Header. No test cleanup needed. |
| **Repo-side references to `/insights`** | `grep /insights src` returns 11 files: the page itself, `HeaderNav.tsx` (baseNavItems), `MobileNav.tsx` (about to be deleted), and 8 other places that link *to* insights from inside the app (home cards, watch detail, discovery grid). [VERIFIED] | Phase 14 retires the **route**, but internal links from home cards / watch detail pages still target it. Option A: update every caller to `/u/[me]/insights`. Option B: keep the redirect and let Next 16's 307 handle it (one extra round-trip per click). **Recommended: Option B** — the redirect is cheap and callers don't need to resolve username. Planner should confirm with user during plan-check but Option B is the safe default. |
| **Repo-side references to `/preferences`** | `HeaderNav.tsx` L20 has `{ href: '/preferences', label: 'Preferences' }`; `MobileNav.tsx` L21 has it too; `NavWearButton.tsx` comments it as a route that doesn't need the dialog. | D-12 moves `/preferences` to a Settings page row. Desktop retention is planner's discretion (D-12). MobileNav entry disappears with the component deletion. |
| **Repo-side references to TEMP NotificationBell placement** | `Header.tsx` L63-65 is the only TEMP placement (comment "UAT placement — Phase 14 will move this to the new nav"). [VERIFIED] | Move to SlimTopNav + DesktopTopNav per D-23. Drop the TEMP comment. |
| **Tests that reference MobileNav / TEMP placement / retired `/insights`** | `tests/components/layout/` contains only `NavWearButton.test.tsx`; no MobileNav test exists. [VERIFIED] | None. No snapshot updates required. |
| **Proxy test (`tests/proxy.test.ts`) PUBLIC_PATHS expectations** | L41-53 enumerates `['/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback?…']` as public paths. [VERIFIED] | Test stays green after D-21 refactor because `PUBLIC_PATHS` values don't change — only the source of the constant moves. Planner may additionally add a test that asserts the proxy's `isPublicPath` and the client nav's `isPublicPath` return identical results for these inputs. |

**The canonical question — answered:** After every file in the repo is updated, the runtime systems that still carry Phase 13 TEMP nav state are:
- **None.** The `Header.tsx` TEMP placement is source-only; no runtime service, DB, or OS registry knows about it.

Every concrete runtime-state question for this phase resolves to "no orphaned runtime state to migrate." The work is entirely in-repo.

## Common Pitfalls

### P-01 (Pitfall A-1): BottomNav outside a Suspense boundary breaks `cacheComponents` builds
**What goes wrong:** The production build errors with something like `Route /layout encountered a client component with usePathname() that is not within a Suspense boundary`.
**Why it happens:** `cacheComponents: true` statically prerenders the layout shell. A Client Component reading the pathname cannot be part of the static shell without a streaming boundary to defer its rendering.
**How to avoid:** Mount `<BottomNav />` inside its own `<Suspense fallback={null}>` as a sibling of the existing Header / main Suspense leaves.
**Warning signs:** Build fails, or client console warns about hydration mismatch on route changes.

### P-02 (Pitfall A-2): `usePathname` hydration mismatch — NOT a concern here
**What goes wrong:** SSR renders one pathname, client hydrates to a different one, React throws a hydration error.
**Why it happens:** `next.config.ts` rewrites, or `proxy.ts` rewrites, change the path between server render and client hydration. [CITED: `use-pathname.md` L37]
**How to avoid:** This project has **no rewrites** in `next.config.ts` (verified — only `images.unoptimized: true` and `experimental.cacheComponents: true`) and **no rewrite responses** in `proxy.ts` (only redirect to `/login` for unauthenticated users, which is a full navigation, not a rewrite). The straightforward `usePathname()` pattern is safe.
**Warning signs:** Hydration error specifically tied to the active-state class. If seen, fall back to the `useState` + `useEffect` mount-time-resolve pattern [CITED: `use-pathname.md` L109-129].

### P-03 (Pitfall A-3): Safe-area bottom-padding composition
**What goes wrong:** iOS devices with Face ID / home indicator either (a) clip content behind the nav or (b) leave a gap below the nav on scroll.
**Why it happens:** `viewport-fit=cover` opts the app into the safe-area dance, but the nav AND page content both need the `env(safe-area-inset-bottom)` accounted for.
**How to avoid (composition rule):**
- BottomNav container: `h-[calc(60px+env(safe-area-inset-bottom))]` + `pb-[env(safe-area-inset-bottom)]` so the clickable button rows sit above the home indicator.
- `<main>` wrapper: `pb-[calc(4rem+env(safe-area-inset-bottom))]` so the last scroll element clears the 64px (4rem) nav + safe-area offset. This is the CONTEXT-locked value D-06 — do NOT use a different factor.
- Root layout `metadata.viewport` (or `export const viewport`): `viewportFit: 'cover'` [CITED: Next 16 `generate-viewport.md` L126-148].
**Warning signs:** On physical iPhone (12+), last button on any page hides behind the nav, or a white bar appears below the nav.

### P-04 (Pitfall A-4 + NAV-05): BottomNav / SlimTopNav visible on /login
**What goes wrong:** User lands on `/login` (unauthenticated) and sees a 5-item nav full of dead links that redirect back to `/login`.
**Why it happens:** Client nav forgot to check public paths; `usePathname()` returns `/login`, but the component unconditionally renders 5 items.
**How to avoid:** `if (isPublicPath(pathname)) return null` at the top of both `BottomNav` and `SlimTopNav`. Use the shared constant so proxy + client agree.
**Warning signs:** Tests in `tests/proxy.test.ts` would still pass (proxy doesn't render nav), but visual QA on /login shows the nav.

### P-05 (Pitfall A-5 — new): Inline theme script regression
**What goes wrong:** Adding IBM Plex Sans or `viewport-fit=cover` edits `layout.tsx`, and a copy-paste error deletes or reorders the theme `<script>`, causing a flash of light/dark mismatch on load.
**Why it happens:** The script must run **before** hydration and **before** first paint. Moving it breaks zero-FOUC theme boot.
**How to avoid:** Keep the `<head>` block structurally identical during the edit. Only change the `<html className={...}>` font-variable list (swap `${geistSans.variable}` → `${ibmPlexSans.variable}`) and add the `viewport` export. Do not relocate the `<script dangerouslySetInnerHTML={...}>` tag.
**Warning signs:** Light-mode flash on dark-mode page load (or vice versa) after the layout edit.

### P-06 (Pitfall B-1): NotificationBell cache sharing across two nav surfaces
**What goes wrong: imagined but NOT a real risk here.** Rendering the same cached Server Component twice in one render tree could, in principle, double the underlying DB fetch.
**Why it's fine in practice:** The bell is wrapped in `'use cache'` with `cacheTag('notifications', \`viewer:${viewerId}\`)`. Next's data cache de-duplicates by tag, and React's rendering de-duplicates by identical props in a single render pass. Both placements pass the same `viewerId`, so the hydrated server tree contains one cache entry used twice [VERIFIED: `src/components/notifications/NotificationBell.tsx` L20-23, Next 16 `cacheTag` semantics].
**How to avoid (defensive):** Keep both placements as isolated Suspense leaves (D-24 / A-1). If one surface eventually needs a different prop (e.g., the slim-mobile bell renders a numeric badge and the desktop bell shows a dot), the cache key diverges — but they still share the DAL call because the underlying `getNotificationsUnreadState(viewerId)` is already request-memoized.
**Warning signs:** `SELECT count(*) FROM notifications WHERE user_id=…` appearing twice in the same request's Supabase query log.

### P-07 (Pitfall I-2): Forking WatchPickerDialog
**What goes wrong:** Mobile BottomNav Wear tap needs slightly different behavior (e.g., different heading text, different next-step), so developer copies `NavWearButton` and tweaks the copy.
**Why it's wrong:** Two dialogs means two places to fix every subsequent picker enhancement. Phase 15 will extend `WatchPickerDialog` to accept `onWatchSelected` for the WYWT two-step flow — a forked copy wouldn't auto-get that.
**How to avoid:** Reuse `NavWearButton` in both nav surfaces. If behavior must diverge, add a prop (e.g., `dialogHeading` or `onSubmit`). The current `NavWearButton` already has a `<span className="hidden sm:inline">Wear</span>` label-hiding pattern — extend that same prop-driven discipline.
**Warning signs:** Two files in `git diff` containing near-identical `lazy(() => import('@/components/home/WatchPickerDialog'))` blocks.

### P-08 (new — Insights tab owner gate existence leak)
**What goes wrong:** Non-owner visits `/u/alice/insights` and gets a 403 or a "You must be the owner" banner, inadvertently confirming that an Insights tab exists.
**Why it's wrong:** v2.0 two-layer privacy discipline says absence must be indistinguishable from never-existed. [CITED: Phase 12 `12-CONTEXT.md` two-layer privacy pattern]
**How to avoid:** Non-owner direct URL access returns `notFound()` (uniform 404, same as accessing a typo-ed `/u/alice/foobar`). Non-owner tab bar does not render the Insights link. Both layers fail closed.
**Warning signs:** Any branch in `[tab]/page.tsx` where the Insights tab responds with anything other than `notFound()` for a non-owner.

### P-09 (new — stale HeaderSkeleton after layout restructure)
**What goes wrong:** `HeaderSkeleton` still shows the old Header layout (just the wordmark) while the streamed real Header shows logo + 5 items + bell + dropdown. Cumulative Layout Shift on every page load.
**Why it happens:** Skeleton wasn't updated to match the new desktop layout dimensions.
**How to avoid:** Update `HeaderSkeleton.tsx` to include skeleton placeholders for the Explore link, search input, Wear button, Add icon, bell, and avatar button at the desktop layout's grid positions. Mobile skeleton stays simple (logo-only).
**Warning signs:** CLS score regression on any page; content "jumps" when Header streams in.

### P-10 (new — IBM Plex Sans font weight lives in Tailwind's `@theme` block)
**What goes wrong:** Developer adds `IBM_Plex_Sans({ variable: '--font-sans', … })` to `layout.tsx` but the `globals.css` `@theme inline` block still maps `--font-sans: var(--font-sans)` (self-referential, but happens to work because Next's font injection sets `--font-sans` on the `<html>` element). No bug here UNLESS developer simultaneously renames the variable to `--font-ibm-plex-sans`.
**How to avoid:** Keep the variable name as `--font-sans`. Delete the old `Geist` import and its `--font-geist-sans` variable — nothing in the codebase reads it except `globals.css` itself (verified via grep).
**Warning signs:** Post-edit, the app renders in fallback system font (Geist was silently active via `font-sans` applied in `@layer base html { @apply font-sans }` but now falls through to Tailwind's default stack).

### P-11 (new — `/insights` redirect + cacheComponents interaction)
**What goes wrong:** Developer adds `'use cache'` to the new `InsightsRetirementPage` thinking the redirect can be cached. Build errors or redirects to stale usernames after a username change.
**Why it's wrong:** The redirect target is per-request (depends on `getCurrentUser()`), so it cannot be cached. `redirect()` also throws internally — the throw propagates through a cached scope incorrectly.
**How to avoid:** No `'use cache'` on this page. Plain async Server Component that calls `getCurrentUser()` and then `redirect()` [CITED: `redirect.md` L49-53 — "redirect should be called outside the try block"].
**Warning signs:** Build errors about cached scopes throwing; or a user who changed their username still gets redirected to the old username route.

## Code Examples

### Example 1: IBM Plex Sans font load (D-08, Pattern 1)
```tsx
// Source: to-be-written src/app/layout.tsx (replaces Geist block)
import { IBM_Plex_Sans, Geist_Mono, Instrument_Serif } from 'next/font/google'

const ibmPlexSans = IBM_Plex_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],    // Regular (body), Medium (nav labels D-09), Semibold (headings per UI-SPEC), Bold (emphasis)
  display: 'swap',                          // Recommended for body UI; prevents FOIT
})
```
**Verified:** `IBM Plex Sans` present in `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` with weights 100–700 + variable.

### Example 2: Viewport metadata for iOS safe-area (D-07 / NAV-03)
```tsx
// Source: to-be-written src/app/layout.tsx — alongside existing metadata export
import type { Viewport } from 'next'

export const viewport: Viewport = {
  viewportFit: 'cover',
}
```
**Verified:** `viewport` object export is supported in Server Component layouts [CITED: `generate-viewport.md` L13-18]. `viewportFit` is a standard `Viewport` field.

### Example 3: `usePathname` active-state in BottomNav (NAV-04)
```tsx
// Source: to-be-written src/components/layout/BottomNav.tsx
'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Compass, Plus, User, Watch } from 'lucide-react'
import { isPublicPath } from '@/lib/constants/public-paths'
import { NavWearButton } from '@/components/layout/NavWearButton'
import { cn } from '@/lib/utils'
import type { Watch as WatchType } from '@/lib/types'

interface BottomNavProps {
  username: string | null          // from Header resolution; null when unauth
  ownedWatches: WatchType[]        // pre-filtered to status='owned'
}

export function BottomNav({ username, ownedWatches }: BottomNavProps) {
  const pathname = usePathname() ?? ''
  if (isPublicPath(pathname)) return null
  if (!username) return null    // ungated routes without a profile shouldn't render the bottom bar

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const profileHref = `/u/${username}/collection`
  const profileActive = pathname.startsWith(`/u/${username}`)

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 md:hidden',
        'flex items-end justify-between',
        'bg-background/95 backdrop-blur border-t border-border',
        'h-[calc(60px+env(safe-area-inset-bottom))]',
        'pb-[env(safe-area-inset-bottom)]',
        'px-2',
      )}
    >
      <NavItem href="/" icon={Home} label="Home" active={isActive('/') && pathname === '/'} />
      <NavItem href="/explore" icon={Compass} label="Explore" active={isActive('/explore')} />
      <WearColumn ownedWatches={ownedWatches} />
      <NavItem href="/watch/new" icon={Plus} label="Add" active={isActive('/watch/new')} />
      <NavItem href={profileHref} icon={User} label="Profile" active={profileActive} />
    </nav>
  )
}
```

### Example 4: `/insights` redirect page (D-13, Pattern 6)
```tsx
// Source: to-be-written src/app/insights/page.tsx (full replacement)
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getProfileById } from '@/data/profiles'

export default async function InsightsRetirementPage() {
  const user = await getCurrentUser()
  const profile = await getProfileById(user.id)
  redirect(profile?.username ? `/u/${profile.username}/insights` : '/')
}
```

### Example 5: ProfileTabs owner-gated Insights tab (D-13, Pattern 5)
```tsx
// Source: src/components/profile/ProfileTabs.tsx — after Phase 14 edit
const OWNER_INSIGHTS_TAB = { id: 'insights', label: 'Insights' } as const

interface ProfileTabsProps {
  username: string
  showCommonGround?: boolean
  isOwner?: boolean
}

export function ProfileTabs({ username, showCommonGround = false, isOwner = false }: ProfileTabsProps) {
  const pathname = usePathname() ?? ''
  const tabs = [
    ...BASE_TABS,
    ...(showCommonGround ? [COMMON_GROUND_TAB] : []),
    ...(isOwner ? [OWNER_INSIGHTS_TAB] : []),   // Non-owners never see the link
  ]
  const activeTab = tabs.find((t) => pathname.endsWith(`/${t.id}`))?.id ?? 'collection'
  // …rest unchanged
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pages/` + `getServerSideProps` | App Router Server Components + `use cache` | Next 13 → 16 | Already adopted project-wide — Phase 10 locked Cache Components. |
| `dynamic = 'force-dynamic'` route segments | Remove; use `'use cache'` + `cacheLife` per leaf | Next 16 | [CITED: `migrating-to-cache-components.md`]. Phase 14 does not introduce any segments needing this directive. |
| `revalidateTag(tag)` (1-arg, stale-while-revalidate) | `revalidateTag(tag, 'max')` (immediate expiration) or `updateTag(tag)` for read-your-own-writes | Next 16 | Phase 13 already uses `updateTag()` in notifications actions. Phase 14 does not touch cache invalidation. |
| `runtime = 'edge'` for proxy / route segments | Node.js runtime required by `cacheComponents` | Next 16 | [CITED: `migrating-to-cache-components.md` L175]. The project's `proxy.ts` does not declare an edge runtime; default is Node. No action needed. |
| Single `Header` with mobile hamburger | Two-surface split: `SlimTopNav` (mobile) + `DesktopTopNav` (desktop) + persistent `BottomNav` | Phase 14 (this phase) | Hamburger patterns are now out of favor at this scale; persistent bottom nav is the mobile-app convention adopted by most consumer products. |
| Lucide `*-fill` variants | Not available in `lucide-react` | Always | Lucide is an outline-first library. Planner uses stroke-width / background-chip strategy. |

**Deprecated/outdated:**
- `MobileNav.tsx` — removed in Phase 14 (NAV-12).
- TEMP NotificationBell placement in `Header.tsx` L63-65 — removed in Phase 14 (D-23).
- `--font-geist-sans` CSS variable — removed in Phase 14 (replaced by `--font-sans` pointing at IBM Plex Sans per D-08).
- HeaderNav's `{ href: '/insights', … }` baseNavItem — removed in Phase 14 (D-14).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Figma specs `0 10px 15px 0 rgba(0,0,0,0.1)` + `0 4px 6px 0 rgba(0,0,0,0.1)` shadow is visually correct in both light and dark themes. | Pattern 2 | Might need a dark-mode shadow variant (e.g., larger spread, brighter) if the circle disappears against dark background. Planner should visually QA both themes. |
| A2 | `strokeWidth={2.5}` is the correct active-state treatment (vs a `bg-accent/10` disc). | P-05, Don't Hand-Roll | If visually weak, swap to the disc pattern. Low risk — both are reversible stylesheet-only changes. |
| A3 | Opting every page into `viewport-fit=cover` is safe for existing desktop routes (doesn't mis-render any `100vh` content). | P-03 | `viewport-fit=cover` at the root layout applies app-wide. If any page uses `100vh` carelessly and visually regresses on iOS Safari, the fix is `100dvh` — not reverting the viewport. |
| A4 | The 11 files that link to `/insights` (per `grep /insights src`) are all internal app-level links and will transparently be handled by the redirect without user-visible delay. | Runtime State Inventory | Worst-case: user experiences a perceptible flash between old and new URL. Option A (update every caller) eliminates this at the cost of 11 file edits. |
| A5 | Non-owner visits to `/u/alice/insights` returning `notFound()` won't conflict with the existing `common-ground` tab's `notFound()` for empty overlap — they're independent branches. | Pattern 5 | Verified in `[tab]/page.tsx` L71-85 — the `common-ground` and `insights` branches are distinct `if (tab === …)` branches. No interaction. |
| A6 | `NAV-04 "filled icon variant + text-accent label"` can be satisfied by `strokeWidth=2.5 + text-accent` or `bg-accent/10 disc + text-accent` — the UI-SPEC language "filled icon variant" does NOT require literal lucide filled SVGs. | NAV-04 | Planner should clarify with user during plan-check. If literal filled icons are required, a second icon package (Phosphor with duotone, or hand-drawn SVGs per-icon) becomes necessary. Lucide's roadmap doesn't show filled variants shipping soon. |
| A7 | The UI-SPEC's `font-medium` weight **600** for nav labels is a documentation drift — CONTEXT D-09 locks **500 (Medium)** which is the Figma source-of-truth. | Standard Stack → Core | Planner must pick one; 500 (Tailwind `font-medium`) is the likely correct mapping since `font-medium` is the Tailwind utility and CONTEXT D-09 uses that exact class name. |
| A8 | No Playwright E2E runner needed — unit + integration tests via Vitest + jsdom + RTL cover all Nyquist requirements. | Validation Architecture | If user requires real Safari / real iOS testing for safe-area, a manual QA step on physical device is the complement. Automating that would require Playwright + BrowserStack / Safari — significant scope expansion. |

## Open Questions

1. **Should internal `/insights` links in `src` (11 files) be rewritten to `/u/[me]/insights`, or rely on the redirect?**
   - What we know: 11 files have literal `/insights` references; redirect handles them transparently at the cost of one round-trip per click.
   - What's unclear: User's preference for link-rewrite cleanup vs redirect-shim approach.
   - Recommendation: Use the redirect (Option B). Rewriting every caller requires resolving the viewer's username at each call site, which means each caller becomes a Server Component with `getCurrentUser()`. The redirect pushes that resolution to one place.

2. **Should the desktop HeaderNav Preferences link be removed (paralleling mobile) or retained?**
   - What we know: D-12 allows either. Mobile no longer has it (Settings → Preferences row is the path).
   - What's unclear: Whether desktop power-users benefit from the shortcut.
   - Recommendation: **Remove it** for consistency. Desktop users reach Preferences identically to mobile — through Settings → Taste Preferences row. Single nav grammar across breakpoints.

3. **Is `strokeWidth={2.5}` visually sufficient for NAV-04 "filled icon" active state, or does the user require literal filled SVGs (requiring an icon package swap)?**
   - What we know: Lucide has no filled variants. Custom SVGs per icon (Home, Compass, Watch, Plus, User) would add ~5 hand-drawn icon components.
   - What's unclear: Figma render likely shows a genuinely filled icon; the Phase 14 CONTEXT writer may not have noticed Lucide's constraint.
   - Recommendation: Render a prototype with `strokeWidth=2.5 + text-accent` first. If visually weak vs Figma, fall back to a `bg-accent/10` disc treatment. Full icon-package swap is a last resort.

4. **Where in the `/settings` page should the new "Taste Preferences" link row sit?**
   - What we know: D-12 defers ordering to planner; existing sections are Privacy Controls, Notifications, Appearance, Data Preferences, Account.
   - What's unclear: Whether preferences are closer to "Privacy Controls" (taste preferences shape what's shown to the user) or "Data Preferences" (collection-shaping data).
   - Recommendation: New section "Collection" between Notifications and Appearance, containing one row: "Taste Preferences → /preferences". Future-proofs for more collection-scoped settings.

5. **Does the Explore stub need a CTA link (e.g., "Browse existing collectors via Search") or pure placeholder?**
   - What we know: D-18 says minimal placeholder.
   - What's unclear: Whether a cross-link to Suggested Collectors on home is useful.
   - Recommendation: Pure placeholder this phase. A cross-link is a small addition that can ship in Phase 16 with Search.

## Environment Availability

> Phase is code+config only. No external dependencies beyond the already-installed stack.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js | All nav components + layout edit | ✓ | 16.2.3 | — |
| React 19 | All components | ✓ | 19.2.4 | — |
| `next/font/google` IBM_Plex_Sans | D-08 font swap | ✓ | bundled | System fallback with `font-display: swap` |
| `lucide-react` | All nav icons | ✓ | 1.8.0 | — (confirmed all required icons exported) |
| Tailwind 4 arbitrary values + `env()` | safe-area handling | ✓ | ^4 | — |
| `@base-ui/react` / shadcn primitives | `DropdownMenu`, `Tabs`, `Popover` | ✓ | 1.3.0 / 4.2.0 | — |
| Supabase Postgres | Unchanged (Phase 14 does not touch data layer) | ✓ | — | — |
| Vitest + jsdom + RTL | Test framework | ✓ | 2.1.9 / 25 / 16 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + `@testing-library/react` 16.3.2 + jsdom 25 |
| Config file | `vitest.config.ts` (jsdom env, `@` alias → `./src`, `server-only` shim) |
| Quick run command | `npm test -- --run <path or grep>` |
| Full suite command | `npm test` (runs `vitest run` — see `package.json` script) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | BottomNav is present at <768px and sticks bottom | unit (RTL render + class assertion) | `npm test -- tests/components/layout/BottomNav.test.tsx` | ❌ Wave 0 |
| NAV-02 | Wear column elevates above bar plane; shadow classes present | unit (class assertion on Wear button) | same file | ❌ Wave 0 |
| NAV-03 | `viewport: { viewportFit: 'cover' }` exported from layout; `<main>` receives safe-area padding | unit (import layout module; assert `viewport.viewportFit === 'cover'`) | `npm test -- tests/app/layout.test.tsx` | ❌ Wave 0 |
| NAV-04 | `usePathname` maps to `text-accent` + heavier stroke for active item | unit (mock `usePathname`, assert on class output per active pathname) | same BottomNav.test.tsx | ❌ Wave 0 |
| NAV-05 | BottomNav + SlimTopNav render `null` on PUBLIC_PATHS | unit (mock `usePathname` with each public path; assert null render) | `npm test -- tests/components/layout/BottomNav.test.tsx tests/components/layout/SlimTopNav.test.tsx` | ❌ Wave 0 |
| NAV-05 (proxy parity) | `proxy.ts` and `isPublicPath` agree on every path | unit (table-driven test against shared constant) | `npm test -- tests/lib/public-paths.test.ts` | ❌ Wave 0 |
| NAV-06 | SlimTopNav contains logo, search-icon link, bell, cog — in this order | unit (RTL render + element order assertion) | `npm test -- tests/components/layout/SlimTopNav.test.tsx` | ❌ Wave 0 |
| NAV-07 | DesktopTopNav contains logo, Explore, search input, Wear CTA, Add, bell, UserMenu | unit (RTL render + element order) | `npm test -- tests/components/layout/DesktopTopNav.test.tsx` | ❌ Wave 0 |
| NAV-08 | UserMenu dropdown contains Profile, Settings, inline Theme (3 buttons), Sign out | unit (open dropdown, assert items) | `npm test -- tests/components/layout/UserMenu.test.tsx` | ❌ Wave 0 |
| NAV-09 | Tapping Wear in BottomNav opens the same `WatchPickerDialog` mock | unit (reuse `NavWearButton.test.tsx` mock pattern) | covered by existing `tests/components/layout/NavWearButton.test.tsx` + new BottomNav click test | ⚠️ partial (new BottomNav test needed) |
| NAV-10 | Add icon routes to `/watch/new` | unit (RTL query link by role/name + assert `href`) | BottomNav.test.tsx + DesktopTopNav.test.tsx | ❌ Wave 0 |
| NAV-11 | `/explore` route renders without error, contains the coming-soon copy | unit (RTL render of page component) | `npm test -- tests/app/explore.test.tsx` | ❌ Wave 0 |
| NAV-11 (also /search) | `/search` stub renders without error | unit (same pattern) | `npm test -- tests/app/search.test.tsx` | ❌ Wave 0 |
| NAV-12 | `src/components/layout/MobileNav.tsx` does NOT exist AND no file imports from `@/components/layout/MobileNav` | lint/grep test (filesystem + grep assertion) | `npm test -- tests/lib/mobile-nav-absence.test.ts` | ❌ Wave 0 |
| DEBT-01 | PreferencesClient shows `role="alert"` banner on save failure | unit (RTL render + Server Action mock returning `{ success: false, error: 'boom' }`) | `npm test -- tests/components/preferences/PreferencesClient.debt01.test.tsx` | ❌ Wave 0 |
| /insights redirect (D-13) | Retired `/insights` page redirects to `/u/[me]/insights` | unit (mock `getCurrentUser` + `getProfileById`; invoke page; assert `redirect()` called with correct arg) | `npm test -- tests/app/insights-retirement.test.tsx` | ❌ Wave 0 |
| Insights tab owner-only (D-13) | Non-owner visiting `/u/alice/insights` returns `notFound()`; owner renders InsightsTabContent | unit (mock auth + profile; assert `notFound` thrown or content rendered) | `npm test -- tests/app/profile-tab-insights.test.ts` | ❌ Wave 0 |
| Insights tab label visibility | ProfileTabs omits Insights link when `isOwner=false`; includes when `isOwner=true` | unit (RTL render with both prop values) | `npm test -- tests/components/profile/ProfileTabs.test.tsx` | ❌ Wave 0 (existing file not found via grep; may need creation) |
| Inline theme segmented in UserMenu | Clicking each of the 3 theme buttons calls `setTheme(value)` | unit (mock `useTheme`; click each button; assert setTheme argument) | `npm test -- tests/components/layout/UserMenu.test.tsx` | ❌ Wave 0 |
| Bell placement parity | Same `viewerId` renders same NotificationBell in both surfaces | unit (render Header in both modes; assert both contain a `Link[href="/notifications"]`) | `npm test -- tests/components/layout/Header.bell-placement.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --run <touched test file(s)>`
- **Per wave merge:** `npm test` (full suite) — current baseline passes 2078/2078 tests.
- **Phase gate:** Full suite green + manual QA on physical iPhone (Face ID) for safe-area + `/login` render checks (the one thing unit tests cannot cover is the visual result of `env(safe-area-inset-bottom)` + `viewport-fit=cover` on real hardware).

### Wave 0 Gaps
- [ ] `tests/components/layout/BottomNav.test.tsx` — covers NAV-01, NAV-02, NAV-04, NAV-09, NAV-10
- [ ] `tests/components/layout/SlimTopNav.test.tsx` — covers NAV-06, NAV-05 (mobile)
- [ ] `tests/components/layout/DesktopTopNav.test.tsx` — covers NAV-07, NAV-10
- [ ] `tests/components/layout/UserMenu.test.tsx` — covers NAV-08, inline theme segmented
- [ ] `tests/components/layout/Header.bell-placement.test.tsx` — covers D-23 relocation parity
- [ ] `tests/components/profile/ProfileTabs.test.tsx` — covers Insights owner-gate label visibility
- [ ] `tests/app/layout.test.tsx` — covers NAV-03 viewport export + font-variable presence
- [ ] `tests/app/explore.test.tsx` + `tests/app/search.test.tsx` — covers NAV-11 + D-19
- [ ] `tests/app/insights-retirement.test.tsx` — covers D-13 redirect
- [ ] `tests/app/profile-tab-insights.test.ts` — covers D-13 tab rendering + notFound for non-owners
- [ ] `tests/lib/public-paths.test.ts` — covers NAV-05 + D-21 proxy/nav parity
- [ ] `tests/lib/mobile-nav-absence.test.ts` — covers NAV-12 (grep assertion; filesystem read + string search of `src/` for any remaining `MobileNav` reference)
- [ ] `tests/components/preferences/PreferencesClient.debt01.test.tsx` — locks DEBT-01 fix against regression

No framework install needed — Vitest + RTL already configured.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Supabase Auth + `proxy.ts` gate + `getCurrentUser()` DAL; Phase 14 does not change auth surface. PUBLIC_PATHS extraction MUST preserve current auth-route semantics. |
| V3 Session Management | yes | Unchanged — Supabase session cookie; `proxy.ts` refreshes on each request. |
| V4 Access Control | yes | Insights tab owner-only check is an access-control gate. Two-layer discipline: (a) tab link omitted for non-owners, (b) `[tab]/page.tsx` returns `notFound()` for non-owners on direct URL. |
| V5 Input Validation | no (marginal) | Phase 14 has no new form inputs beyond the Settings "Taste Preferences" link row (plain navigation). `/explore` and `/search` stubs accept no input. Nav components read only `usePathname` (framework-sanitized). |
| V6 Cryptography | no | Phase 14 does not handle secrets, tokens, or signed URLs. |

### Known Threat Patterns for Next.js 16 Nav

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Nav visible on pre-auth routes leaks authenticated URL structure to anonymous users | Information Disclosure | `isPublicPath(pathname)` gate in both `BottomNav` and `SlimTopNav`; proxy imports the same constant. |
| Insights tab existence leak via 403/"locked" banner for non-owners | Information Disclosure | `notFound()` (uniform 404) for non-owner direct URL access; tab link omitted from ProfileTabs for non-owners. Mirrors Letterboxd / Phase 8 / Phase 12 precedent. |
| Open redirect on `/insights` → `/u/[username]/insights` | Tampering / Open Redirect | Target username sourced from `getCurrentUser()` + `getProfileById(user.id)`, NOT from query params or headers. Path is string-interpolated from DB-resolved value only. |
| `usePathname` hydration mismatch used to confuse users about route state | Tampering | No rewrites in this project; pathname is stable across SSR/CSR [CITED: `use-pathname.md` L37]. |
| Cached `NotificationBell` leaking unread state across users | Information Disclosure | `cacheTag('notifications', 'viewer:${viewerId}')` keys cache per-viewer; `viewerId` is an explicit prop (Phase 13 D-25) — no ambient auth-read inside the cached scope. |
| Bottom nav z-index covering modal dialogs | Denial of Service (trivial UI lock) | BottomNav `z-50`; dialogs should use `z-50` or higher. shadcn `Dialog` defaults to `z-50` — test `WatchPickerDialog` open state with BottomNav visible to confirm no stacking issue. |
| Theme cookie value pollution via script-injection during nav edit | Tampering / XSS | Theme script is a static inline string `themeInitScript` constructed from known safe source [VERIFIED: `src/app/layout.tsx` L27]. Phase 14 does not template any runtime value into it — do not change that. |

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md` — `cacheComponents` flag semantics, Activity-based navigation state preservation
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md` — `viewport` object / `generateViewport` function; `viewportFit` field
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-pathname.md` — hydration safety, rewrite caveats
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md` — Server Component redirect semantics; outside try/catch requirement
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md` — cache tagging, dedup across render passes
- `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md` — legacy segment-config retirement; Node runtime requirement
- `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` — IBM Plex Sans weights/subsets availability
- `node_modules/lucide-react/dist/lucide-react.d.ts` — full icon inventory; confirmed no `*Fill` variants
- `src/app/layout.tsx` — current Cache Components + inline theme script pattern
- `src/components/notifications/NotificationBell.tsx` — cached bell contract (unchanged)
- `src/components/layout/Header.tsx` — TEMP bell placement + current Header composition
- `src/components/layout/HeaderNav.tsx` — baseNavItems (Insights entry to remove)
- `src/components/layout/MobileNav.tsx` — component to delete
- `src/components/layout/NavWearButton.tsx` — reusable Wear trigger
- `src/components/layout/UserMenu.tsx` — dropdown to extend
- `src/components/layout/ThemeToggle.tsx` — theme options to inline
- `src/components/profile/ProfileTabs.tsx` — existing tab mechanism
- `src/app/u/[username]/layout.tsx` + `src/app/u/[username]/[tab]/page.tsx` — profile tab routing pattern
- `src/proxy.ts` — auth route list
- `src/components/preferences/PreferencesClient.tsx` — DEBT-01 verified fix
- `.planning/phases/13-notifications-foundation/13-CONTEXT.md` — NotificationBell contract (D-25/D-26)
- `.planning/phases/12-visibility-ripple-in-dal/12-CONTEXT.md` — two-layer privacy pattern
- `.planning/phases/14-nav-shell-explore-stub/14-CONTEXT.md` — phase decisions (this research is downstream of)
- `.planning/phases/14-nav-shell-explore-stub/14-UI-SPEC.md` — visual contract

### Secondary (MEDIUM confidence)
- Tailwind 4 docs on `env()` in arbitrary values — [standard behavior; documented behavior matches the Tailwind 4 core changelog but not re-verified in this research run]

### Tertiary (LOW confidence)
- Lucide future roadmap for filled variants — [not verified; recommendation to NOT wait on this]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version verified against installed `node_modules`; IBM Plex Sans presence and weights verified against font-data.json
- Architecture: HIGH — all patterns cross-referenced against existing Phase 10 / Phase 13 canonical examples in the codebase
- Pitfalls: HIGH for P-01 through P-08 (all have codebase / docs evidence); MEDIUM for P-09 through P-11 (reasoned from principles, not observed failures)
- Validation Architecture: HIGH — test framework directly verified via `package.json` + `vitest.config.ts`; no Playwright presence confirmed via grep
- Security: HIGH — existing two-layer privacy patterns have shipped twice (Phase 8, Phase 12); this phase inherits them verbatim

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days — Next.js 16 is stable; IBM Plex font catalog changes rarely; lucide-react major-version cadence is slow)

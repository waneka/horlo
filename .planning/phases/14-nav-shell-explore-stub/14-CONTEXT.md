# Phase 14: Nav Shell + Explore Stub - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 14 ships the production navigation frame for Horlo v3.0 and retires the v2.0 placeholder nav. It delivers:

- **Mobile bottom nav** (sticky, always visible < 768px): 5 items — Home · Explore · Wear · Add · Profile — with a Figma-spec elevated Wear circle that extends above a flat bar (no SVG cutout), iOS safe-area-inset handling, and a filled-icon + accent-color active state.
- **Slim mobile top nav**: logo · search icon · notifications bell · settings cog.
- **Desktop top nav** (>= 768px): logo · Explore link · persistent search input · Wear CTA · Add icon · notifications bell · profile dropdown (consolidates profile link, settings, theme toggle, sign out).
- **Route stubs**: `/explore` coming-soon page + `/search` coming-soon page so no nav link 404s. (Phase 16 later fleshes out `/search`.)
- **Retirements**: remove `MobileNav` hamburger component; remove "Insights" from desktop `HeaderNav` `baseNavItems`; remove the temporary `NotificationBell` placement in `Header.tsx` (Phase 13 TEMP comment) in favor of the nav's permanent slot.
- **Info-architecture migrations** (collateral of retiring MobileNav):
  - `/preferences` loses its direct nav entry; reachable via a new "Taste Preferences" link row inside `/settings`.
  - `/insights` top-level route is retired. Its content moves into a new **owner-only "Insights" tab** on the profile page (under `/u/[username]/...`). `/insights` redirects to the profile's Insights tab. The existing public Stats tab is unchanged.
- **Global typography swap**: replace Geist sans with **IBM Plex Sans** via `next/font/google` as the project's default body font. Geist Mono and Instrument Serif retain their current uses.
- **DEBT-01**: verify-only — PreferencesClient save-failure error UX was already shipped in Phase 999.1 (`role="alert"` banner + `isPending` "Saving…" hint). Phase 14 confirms acceptance criteria still pass and updates traceability.

**Out of scope (reaffirmed):**
- Search functionality / `/search` page logic — Phase 16 (SRCH-01..07)
- WYWT photo post modal, camera, Storage uploads, `/wear/[id]` — Phase 15 (WYWT-01..19)
- Global accent color palette update (Figma nav teal `#5b8fb9` vs existing warm-gold `--accent`) — future palette phase; Phase 14 uses the existing `--accent` token
- Insights/Stats merge into a single visibility-aware tab — deferred; Phase 14 keeps them as separate tabs on Profile

</domain>

<decisions>
## Implementation Decisions

### Mobile bottom nav visual (NAV-01, NAV-02, NAV-04)
- **D-01:** Cradle/notch = **elevated circle, no SVG cutout**. Bar renders flat; the Wear button is a 56×56 circle positioned to extend ~20px above the bar top with `shadow-lg` (two-layer: `0 10px 15px 0 rgba(0,0,0,0.1)` + `0 4px 6px 0 rgba(0,0,0,0.1)` — matches Figma 1:4725). Locked by Figma node `1:4714`.
- **D-02:** Wear circle icon = **watch icon** (not `Plus`). 28×28 inside the circle. Non-Wear items render 24×24 icons.
- **D-03:** Wear label "Wear" renders underneath the circle in `text-accent` (same color as the circle fill), matching Figma.
- **D-04:** Active state in bottom nav = **filled icon variant + `text-accent` label**. Inactive = outline-stroke icon + `text-muted-foreground` label. The active route is resolved via `usePathname()` in a Client Component (NAV-04; Pitfall A-2).
- **D-05:** Accent color: use the **existing `--accent` Tailwind token** (warm gold, `oklch(0.76 0.12 75)` light / `oklch(0.78 0.13 75)` dark). Do NOT import the Figma teal `#5b8fb9` — the palette update is tracked as a separate future phase.
- **D-06:** Bar height (content zone) = 60px + `env(safe-area-inset-bottom)`. Pages add `pb-[calc(4rem+env(safe-area-inset-bottom))]` to `<main>` so the bottom of scroll content clears the nav (NAV-03).
- **D-07:** Root layout viewport meta must include `viewport-fit=cover` (NAV-03). Add to `src/app/layout.tsx` `metadata.viewport` or a `<meta>` tag.

### Typography (global)
- **D-08:** Replace Geist sans with **IBM Plex Sans** as the global default body font. Load via `next/font/google` in `src/app/layout.tsx`. Keep Geist Mono (code contexts) and Instrument Serif (`font-serif` utility — Horlo wordmark, Insights page h1). The `--font-geist-sans` CSS var is renamed/replaced with `--font-sans` pointing at IBM Plex.
- **D-09:** Nav label style matches Figma: `font-medium` (IBM Plex Sans Medium 500 weight), `text-[12px]`, `leading-[16px]`. Applies to bottom nav labels.

### Nav destinations map (NAV-10, NAV-12)
- **D-10:** Bottom nav routes: Home → `/`, Explore → `/explore`, Wear → opens shared `WatchPickerDialog` (NAV-09 — single component, no forks; Pitfall I-2), Add → `/watch/new` (NAV-10), Profile → `/u/[me]/collection`.
- **D-11:** Slim top nav routes: logo → `/`, search icon → `/search` (stub), notifications bell → `/notifications`, settings cog → `/settings`.
- **D-12:** `/preferences` does not have its own mobile nav entry. Add a **"Taste Preferences"** link row inside `/settings` that routes to `/preferences`. Desktop can retain or remove the HeaderNav Preferences link (planner's discretion — either is fine).
- **D-13:** `/insights` top-level route is retired. Create a new **owner-only "Insights" tab** on the profile page (under `/u/[username]/...`). The `/insights` URL redirects (`redirect()`) to the profile's Insights tab. The new tab is gated — it renders only when `viewer.id === profile.user_id`; non-owners never see the tab link or any of its data.
- **D-14:** Remove the `{ href: '/insights', label: 'Insights' }` entry from `baseNavItems` in `src/components/layout/HeaderNav.tsx`. Insights is now reached exclusively via Profile → Insights tab on both desktop and mobile.
- **D-15:** The existing public **Stats tab** on the profile is unchanged. Stats = public aggregate; Insights = owner-only (deals, value, sleeping beauties, wear insights, distribution charts with price data). These coexist as two distinct tabs.

### Desktop top nav + profile dropdown (NAV-07, NAV-08)
- **D-16:** Desktop top nav composition left→right: Horlo wordmark · Explore link · persistent search input (routes to `/search`) · NavWearButton · Add icon link (`/watch/new`) · NotificationBell · profile dropdown (UserMenu extended). Existing `ThemeToggle` is removed from the desktop nav strip.
- **D-17:** Profile dropdown consolidates: Signed-in-as header, Profile link (`/u/[me]/collection`), Settings link (`/settings`), **inline 3-button segmented Theme control** (Light · Dark · System — renders the current `ThemeToggle` options inline, not a submenu), Sign out. This is a Claude's Discretion default — implementer may swap to a nested submenu if the segmented row overflows.

### Route stubs (NAV-11 + new `/search` stub)
- **D-18:** `/explore` — new route; minimal "coming soon" placeholder. Use existing `Card` or empty-state shell; `Sparkles` (lucide) icon + heading + one-line teaser copy ("Discovery is coming." or similar). Mirror the visual density of `NotificationsEmptyState`.
- **D-19:** `/search` — new route (scope addition to Phase 14 beyond the ROADMAP wording). Same "coming soon" pattern. Phase 16 will rewrite this page; Phase 14 just prevents broken-link risk from the nav search icon / desktop search input.
- **D-20:** Both stub pages render inside the authenticated shell (sit below the Header + above BottomNav). Both are protected by the existing `proxy.ts` auth redirect.

### Auth-route exclusion (NAV-05)
- **D-21:** Extract the auth-route list from `src/proxy.ts` into a shared constant `src/lib/constants/public-paths.ts` exporting `PUBLIC_PATHS: readonly string[]`. Both `proxy.ts` and the new nav components import from this constant — single source of truth.
- **D-22:** `BottomNav` and `SlimTopNav` are Client Components that call `usePathname()` and render `null` when the pathname matches any `PUBLIC_PATHS` prefix. Same guard applies to the shared constant check used in `proxy.ts` (no regex divergence).

### Notification bell relocation (Phase 13 cleanup)
- **D-23:** The `NotificationBell` currently lives in `Header.tsx` under a "TEMP: UAT placement — Phase 14 will move this to the new nav" comment. Phase 14 moves it to **both** nav surfaces: desktop top nav bell slot (between Add and profile dropdown) and slim mobile top nav bell slot (between search icon and settings cog). `viewerId` prop plumbing stays as-is (Phase 13 D-25 two-layer discipline).
- **D-24:** Bell remains its own Suspense leaf (Pitfall B-1, A-1) — cacheLife 30s + cacheTag profile unchanged from Phase 13.

### DEBT-01 (verify-only)
- **D-25:** DEBT-01 (PreferencesClient save-failure error UX) was shipped in Phase 999.1 Plan 01 (MR-01). Verified in `src/components/preferences/PreferencesClient.tsx` L44-60 — `saveError` state + inline `role="alert"` banner + `isPending` → "Saving…" hint all present. Phase 14 plan includes a single verification task that re-asserts the DEBT-01 acceptance criteria (ActionResult inspection, accessible banner, aria-live on pending state) and updates REQUIREMENTS.md traceability to mark DEBT-01 as complete via 999.1. **No new code** for this line item.

### Folded Todos
- None — no pending todos matched Phase 14 scope (match-phase returned 0 matches).

### Claude's Discretion
- Exact Tailwind class names for the Wear circle elevation zone (e.g., `-top-5`, `mt-[-20px]`, or absolute positioning) — whatever renders pixel-correct against Figma 1:4725.
- Icon selection specifics — the planner picks specific lucide icons for Home (`Home`), Explore (`Compass`/`Sparkles`), Wear (`Watch`), Add (`Plus`), Profile (`User`). Swap if Figma implies different icons.
- Filled vs outline icon pairing for NAV-04 active state (Lucide has some `-fill` variants; otherwise add a background chip or swap to a heavier-stroke variant).
- Exact empty-state copy and Icon choice for `/explore` and `/search` stubs (D-18/D-19).
- Placement of the Settings → Preferences link row within `/settings` (ordering among existing sections).
- Whether the Insights tab is a distinct route segment (`/u/[username]/insights`) or a search-param tab — the planner picks based on existing ProfileTabs pattern; either is acceptable as long as it matches the existing Collection / Wishlist / Stats / Worn tab mechanism.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & roadmap
- `.planning/PROJECT.md` — v3.0 milestone framing, Phase 999.1 DEBT-01 closure, key decisions table (`cacheComponents` + inline theme script pattern in KEY DECISIONS)
- `.planning/REQUIREMENTS.md` — NAV-01..12 acceptance criteria; DEBT-01 (already resolved in 999.1); traceability table
- `.planning/ROADMAP.md` §"Phase 14: Nav Shell + Explore Stub" — phase goal, success criteria, pitfalls

### Prior phase context (locked decisions that must be honored)
- `.planning/phases/13-notifications-foundation/13-CONTEXT.md` — NotificationBell contract: `viewerId` explicit prop (D-25), `'use cache'` + 30s revalidate (D-26), isolated Suspense leaf (A-1/B-1). Phase 14 moves the component without changing its contract.
- `.planning/phases/12-visibility-ripple-in-dal/12-CONTEXT.md` — viewer-aware DAL + two-layer privacy pattern (applies to the new owner-only Insights tab gating — viewer.id === profile.user_id check at BOTH the DAL call AND the tab render).
- `.planning/phases/10-network-home/` (if present in history) — `cacheComponents: true` + inline theme script + Suspense-wrapped Header pattern. Phase 14 cannot break this — any nav change must preserve zero-FOUC theme boot.

### Figma design spec
- **Figma node `1:4714`** (Container — mobile bottom nav) — authoritative source for the 5-item layout, Wear circle geometry (56×56, offset `top: 0` in a 91.96-tall frame vs 60-tall non-Wear items at `top: 20`), shadow values (`shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)]`), typography (IBM Plex Sans Medium 12/16), and color intent (`#5b8fb9` active, `#8b9199` inactive — but Phase 14 maps these to existing tokens per D-05).
- No Figma variable tokens resolved (`get_variable_defs` returned `{}`) — colors in Figma are inline hexes, not design-system variables.

### Code files (read to confirm current state before editing)
- `src/app/layout.tsx` — root layout; Suspense + inline theme script; add IBM Plex Sans here; add `viewport-fit=cover` here (D-07)
- `src/components/layout/Header.tsx` — current desktop/mobile top chrome; has TEMP NotificationBell placement (D-23); renders `MobileNav` (to be removed), `HeaderNav`, `NavWearButton`, `UserMenu`, `ThemeToggle`
- `src/components/layout/HeaderNav.tsx` — desktop link list with `baseNavItems`; remove Insights entry (D-14)
- `src/components/layout/MobileNav.tsx` — the hamburger component to be **deleted** (NAV-12)
- `src/components/layout/NavWearButton.tsx` — lazy-loaded WatchPickerDialog trigger; reused by both desktop Wear CTA and mobile bottom-nav Wear button (NAV-09, Pitfall I-2 — do not fork)
- `src/components/layout/UserMenu.tsx` — existing DropdownMenu; extend to include Profile/Settings/Theme/Sign out per D-17
- `src/components/layout/ThemeToggle.tsx` — existing 3-option Popover; D-17 moves its options inline inside the profile dropdown
- `src/components/notifications/NotificationBell.tsx` — stays as-is; relocated only (D-23)
- `src/proxy.ts` — `PUBLIC_PATHS` array to be extracted into `src/lib/constants/public-paths.ts` (D-21)
- `src/app/insights/page.tsx` — content to be moved into the new owner-only profile Insights tab; route retired + redirected (D-13)
- `src/components/profile/ProfileTabs.tsx` — existing tab structure; extend with owner-gated Insights tab
- `src/components/profile/StatsTabContent.tsx` — unchanged; remains the public Stats tab (D-15)
- `src/components/preferences/PreferencesClient.tsx` — read L44-60 to verify DEBT-01 closure (D-25)
- `src/app/settings/page.tsx` + `src/components/settings/SettingsClient.tsx` — target for the new "Taste Preferences" link row (D-12)

### External docs
- Next.js 16 `cacheComponents` docs (`node_modules/next/dist/docs/...`) — layout cannot read `cookies()`; inline theme script is the zero-FOUC escape hatch (already shipped in Phase 10). Any layout edit in Phase 14 must preserve this.
- No external ADRs — all requirements captured in REQUIREMENTS.md and decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`NavWearButton`** (`src/components/layout/NavWearButton.tsx`) — Client Component with lazy-loaded `WatchPickerDialog`. Used by both the desktop Wear CTA and the mobile bottom-nav Wear button. Do NOT fork (Pitfall I-2); if behavior diverges, pass a prop.
- **`NotificationBell`** (`src/components/notifications/NotificationBell.tsx`) — drop-in cached Server Component; takes `viewerId` prop. Phase 14 places it in two nav surfaces without modifying the component.
- **`UserMenu`** (`src/components/layout/UserMenu.tsx`) — existing `DropdownMenu` for sign-out; extend with Profile/Settings/Theme/Sign out for NAV-08.
- **`ThemeToggle`** (`src/components/layout/ThemeToggle.tsx`) — 3-option Popover; its 3 options (Light/Dark/System + icon set) are reused inline inside the profile dropdown for D-17.
- **`HeaderSkeleton`** (`src/components/layout/HeaderSkeleton.tsx`) — existing Suspense fallback; extend to match the new Header layout (avoid CLS).
- **`NotificationsEmptyState`** (`src/components/notifications/...`) — visual template mirror for the `/explore` and `/search` coming-soon stubs (D-18/D-19).
- **`proxy.ts` PUBLIC_PATHS** — existing auth-route list; extract into shared constant for NAV-05 (D-21).
- **`getCurrentUser` / `UnauthorizedError`** (`src/lib/auth`) — already used by Header; BottomNav server-render path (if any) uses the same pattern.

### Established Patterns
- **Cache Components + inline theme script + Suspense around Header + main** — canonical Phase 10 pattern. Any layout change in Phase 14 must preserve this structure (Pitfalls A-1, A-5).
- **Two-layer privacy on cross-user reads** — applies to the new Profile → Insights tab: gate at DAL (owner-only query) AND at tab render (viewer.id === profile.user_id). Mirrors v2.0 Phase 8/9 pattern.
- **ActionResult<T> discriminated union** for Server Actions — used by PreferencesClient for DEBT-01 inspection; same pattern for any new Server Actions Phase 14 introduces (likely none).
- **`'use client'` for `usePathname`-driven active state** — NAV-04; matches `HeaderNav.tsx` existing pattern.
- **Lazy dialog loading** — `NavWearButton` uses `React.lazy` + render-gated `{open && ...}`; repeat for any new heavy components if introduced (none expected this phase).

### Integration Points
- **Root layout** (`src/app/layout.tsx`) — add font load, `viewport-fit=cover`, mount `<BottomNav />` component (under the existing Suspense structure, not bare in `<body>` — Pitfall A-1); must continue to satisfy Cache Components discipline.
- **Header** (`src/components/layout/Header.tsx`) — complete re-layout: remove `MobileNav`, remove `ThemeToggle` from top strip, remove TEMP NotificationBell placement, add `SlimTopNav` (mobile view) + `DesktopTopNav` (md+ view). Consider whether to split into two components rather than one branching Header.
- **`src/components/layout/HeaderNav.tsx`** — remove Insights baseNavItem (D-14).
- **Profile tabs** (`src/components/profile/ProfileTabs.tsx` or wherever ProfileTabs lives) — add owner-only Insights tab; wire the tab content from the retired `/insights` page.
- **`/insights` route** (`src/app/insights/page.tsx`) — retire; replace with `redirect()` to the profile Insights tab.
- **`/settings` page** (`src/app/settings/page.tsx` + `SettingsClient.tsx`) — add "Taste Preferences" link row.
- **Auth routes** — `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/*` — BottomNav + SlimTopNav must render null on these (D-21/D-22).
- **Proxy** (`src/proxy.ts`) — refactor to import `PUBLIC_PATHS` from the new shared constant (no behavior change).

</code_context>

<specifics>
## Specific Ideas

- **Figma geometry (node 1:4714)** — the source of truth for bottom-nav visual geometry. Non-Wear buttons: 60×60 content box at `top: 20`, 24×24 icon, 12/16 label. Wear button: 80×92 content box at `top: 0`, 56×56 circle (watch icon 28×28 inside, circle `bg-accent`, `shadow-lg` per D-01), 12/16 label in `text-accent`. Container total width follows a 5-column flex layout with Wear centered; at 393px container width the exact `left` values are: 8.3 / 81.45 / 163.98 / 260.58 / 325.17 — but the planner should use `flex` + `justify-between` rather than hardcoded absolute positions so the nav adapts to any mobile width.
- **IBM Plex Sans loading** — import via `next/font/google` alongside the existing `Geist_Mono` and `Instrument_Serif`. Expose as `--font-sans` CSS variable; wire into Tailwind `fontFamily.sans` via the globals.css `@theme` block so `font-sans` utility resolves to IBM Plex Sans. `font-mono` stays Geist Mono; `font-serif` stays Instrument Serif.
- **"Insights" tab owner-only pattern** — follow the v2.0 Phase 8 `LockedTabCard` approach in reverse: instead of showing a "locked" state to non-owners, the tab **does not render at all** in `ProfileTabs` for non-owners. This prevents existence leak (a non-owner should not know an Insights tab exists).
- **DEBT-01 verification test** — add a one-assertion test (or extend an existing PreferencesClient test) that confirms the `role="alert"` banner renders when `savePreferences` returns `{ success: false, error: '...' }`. This locks the 999.1 fix so a future regression is caught immediately.
- **NotificationBell two placements** — both nav surfaces pass the same `viewerId` prop. Because the component is cached by `cacheTag('notifications', \`viewer:${viewerId}\`)`, rendering the same bell twice shares one cache entry. No double-fetch concern.
- **MobileNav removal cleanup** — grep the repo for `<MobileNav`, `from '@/components/layout/MobileNav'`, and `MobileNav.tsx` before deletion; there should be one usage in `Header.tsx`. Delete the component file + the import + the usage.
- **Retire `/insights` cleanly** — keep the route file but replace its contents with `redirect('/u/[me]/...insights-tab')`. Use `getCurrentUser()` to resolve the target username. Do not delete the route file outright — a `redirect()` preserves incoming links from bookmarks, emails, or old shared URLs.

</specifics>

<deferred>
## Deferred Ideas

- **Global accent palette update** — Figma nav uses teal `#5b8fb9` but Phase 14 uses the existing warm-gold `--accent`. A future phase should either update the palette or re-theme the Figma. Tracked as a separate design-system phase.
- **Insights/Stats unification into a single visibility-aware tab** — user opted to keep them as separate tabs on Profile. If overlap in distribution charts / most-worn lists becomes confusing in real use, revisit in a future phase.
- **Search functionality** — Phase 14 ships a `/search` stub only; Phase 16 implements the live-debounced people-search with taste overlap %, FollowButton, and pg_trgm queries (SRCH-01..07).
- **`/explore` feed content** — placeholder copy only in Phase 14. Discovery feed is a future milestone beyond v3.0.
- **Swap to Figma's teal accent globally** — conditional on the palette phase above; any app-wide `bg-accent` / `text-accent` consumer (FollowButton active state, PrivacyToggleRow checkmark, Phase 13 bell unread dot) would flip color simultaneously.
- **Desktop nav Preferences link** — planner's discretion whether to keep or remove from desktop HeaderNav. If removed, mobile-and-desktop both reach Preferences via Settings, which is consistent.
- **NotificationBell settings in profile dropdown** — not in scope for Phase 14. Phase 13 already exposes opt-out toggles on `/settings` (`notifyOnFollow`, `notifyOnWatchOverlap`). If users want those inline in the bell hover or dropdown, that's a future UX phase.

### Reviewed Todos (not folded)
- None — todo match returned 0 matches for Phase 14.

</deferred>

---

*Phase: 14-nav-shell-explore-stub*
*Context gathered: 2026-04-23*

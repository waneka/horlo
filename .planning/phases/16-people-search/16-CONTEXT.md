# Phase 16: People Search - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 16 ships the live people-search surface for Horlo v3.0 and tightens the desktop top-nav strip to match the production-quality Figma direction. It delivers:

- **`/search` page replacing the Phase 14 stub** — 4 tabs (All · Watches · People · Collections); All + People are real surfaces, Watches + Collections render "coming soon" cards. Default tab on landing = **All**.
- **Live People search** — `pg_trgm` ILIKE on `profiles.username` + `profiles.bio`, 250ms debounce, 2-character minimum, AbortController-cancelled stale fetches, `?q=` and `?tab=` synced to URL via `router.replace()`.
- **Result row** — reuses the `SuggestedCollectorRow` visual pattern (avatar · name + `X% taste overlap` subline · 1-line bio snippet · mini-thumb cluster of shared watches · inline `FollowButton variant="inline"`); whole-row link to `/u/{username}/collection`. Matched substrings bolded in username + bio.
- **Privacy by silent exclusion** — `searchProfiles` DAL filters `WHERE profile_public = true` (two-layer with the existing RLS gate); private profiles never appear in result rows for non-followers — no row count adjustment, no placeholder, zero existence leak.
- **Empty + no-results states** — Pre-query (no `?q=`): "Collectors you might like" header + suggested-collector rows from existing `getSuggestedCollectorsForViewer`. Zero matches: "No collectors match '{q}'" header + recovery sub-header + suggested collectors below.
- **Loading state** — 3–5 skeleton rows (matches `NetworkActivityFeed` + `SuggestedCollectors` shimmer pattern).
- **Desktop top nav cleanup** — delete the `HeaderNav` inline links (Collection / Profile / Settings), leaving Profile + Settings exclusively in `UserMenu`'s dropdown. Visual restyle of the persistent nav search input (muted fill, leading magnifier icon, balanced width) using the Figma as inspiration; exact dimensions are Claude's discretion.
- **Two separate search inputs by design** — the persistent nav input is a dumb launcher (submit-only → `/search?q=foo`); the input on `/search` is the smart one (live debounce, AbortController, URL sync, focus on mount).

**Out of scope (reaffirmed):**
- Watches search tab population — depends on canonical watch identity (PROJECT.md key decision: per-user independent watch entries; canonical normalization deferred to a future "data strategy" phase). Re-anchored under Deferred Ideas.
- Collections search tab population — same canonical-watch-identity dependency + Collections is a separate product surface entity that doesn't yet exist (SRCH-FUT-02).
- Live dropdown panel under the persistent nav input — explicitly chosen against; Phase 16 nav input stays submit-only. Future polish phase if discovery patterns shift.
- Recent searches / search history — out of scope per REQUIREMENTS (SRCH-FUT-03); discovery via suggested collectors is the recovery surface instead.
- Trigram similarity scoring beyond ILIKE (similarity threshold ranking) — out of scope per REQUIREMENTS Out of Scope table; ILIKE is sufficient at sub-1000-user scale.
- Mobile SlimTopNav restyle — Phase 14 D-11 already matches the desired mobile layout (logo · search icon · bell · settings); the mobile search icon already routes to `/search` and inherits the new live experience for free.
- Global accent palette flip from warm-gold to Figma teal — same deferred-palette decision carried from Phase 14 D-05.

</domain>

<decisions>
## Implementation Decisions

### Search interaction model (SRCH-01, SRCH-03, SRCH-04)

- **D-01:** **Persistent desktop nav search input is submit-only.** Type → Enter routes to `/search?q={encoded}`. No live dropdown, no typeahead panel, no inline preview. Keeps Phase 16 scope tight and matches the existing `handleSearchSubmit` in `DesktopTopNav.tsx` byte-for-byte. Live behavior lives exclusively on the `/search` page.
- **D-02:** **`/search` pre-populates and immediately fires** when arriving with `?q=foo`. The page-level input is autofocused and pre-filled; `useEffect` triggers the initial query at mount when `q.length >= 2`. URL stays in sync as the user keeps typing.
- **D-03:** **Stale-fetch protection via AbortController + 250ms debounce.** Each new keystroke (after debounce) aborts the prior in-flight fetch. Standard React typeahead pattern; prevents results-flicker from out-of-order responses on flaky networks. Implement once in the page-level `useSearchQuery` hook — no need to spread the abort logic across components.
- **D-04:** **URL syncs via `router.replace()` on every debounced fire.** Single history entry regardless of keystroke count, bookmarks/shares retain the latest query, back-button stays sane. `pushState` rejected — would create one history entry per settled query (50+ entries for a fast typist).

### `/search` page structure (SRCH-01, SRCH-02, SRCH-06, SRCH-07)

- **D-05:** **Default landing tab = `All`.** Opening `/search` with no `?tab=` selects the All tab; the `tab=` param is omitted from the URL when All is active (cleaner URLs for the default case).
- **D-06:** **All tab content = "mirror People + coming-soon footers".**
  - Pre-query: `Collectors you might like` section (suggested-collector rows from `getSuggestedCollectorsForViewer`) + two compact coming-soon cards beneath ("Watches search coming soon" / "Collections search coming soon").
  - With query: People search results + same two compact coming-soon footer cards beneath the result list. The footer cards anchor user expectations about what's incoming without breaking the page.
- **D-07:** **People tab = same People surface as All, minus the coming-soon footers.** Pre-query and no-results states are identical to All.
- **D-08:** **Watches and Collections tabs render coming-soon empty states only.** No query fires when these tabs are active. Reuse the visual pattern of the Phase 14 `/explore` placeholder (muted icon + serif heading + one-line teaser copy) — but each gets its own distinct copy that hints at the unblocking dependency ("Discovery by watch model is coming once we normalize the watch catalog").
- **D-09:** **Loading state = 3–5 skeleton rows** that match the result-row visual footprint (avatar circle skeleton + two stacked text skeletons + right-side skeleton chip for the FollowButton). Mirrors the existing pattern in `NetworkActivityFeed` + `SuggestedCollectors`. Avoids the ambiguity of a stale-results approach and reads as "still loading" without an out-of-place spinner.
- **D-10:** **No-results state** when `q.length >= 2` returns 0 People matches: header `No collectors match "{q}"` + sub-header `Try someone you'd like to follow` + suggested-collector rows below (same `getSuggestedCollectorsForViewer` DAL as the pre-query state). Acknowledges the dead end while preserving the discovery surface promised by SRCH-06.
- **D-11:** **Pre-query state on People + All tabs** = `Collectors you might like` section header + suggested-collector rows. Same DAL as the home page's Suggested Collectors block — zero-additional-DAL cost.
- **D-12:** **Tab state in URL via `?tab=people` query string.** Shareable, bookmarkable, back-button works. Default tab (`all`) omitted from URL when active. Same `router.replace()` pattern as `q=` sync — one history entry, no churn.

### Result row design (SRCH-04, SRCH-05)

- **D-13:** **Reuse `SuggestedCollectorRow` visual pattern as the canonical result row.** Layout left → right: 40px avatar · primary line `name` (bold) + secondary line `X% taste overlap` · **1-line bio snippet** (inserted between the secondary line and the shared-watch cluster) · mini-thumb cluster of up to 3 shared watches with `{N} shared` count · inline `FollowButton variant="inline"`. Whole-row link to `/u/{username}/collection` with absolute-inset overlay; FollowButton raised with `relative z-10` so its tap doesn't bubble. Initial follow state passed in from the search query batch (D-19).
- **D-14:** **Bio snippet = `line-clamp-1` with ellipsis.** Predictable row height; full bio reachable via the row link to the profile. 2-line clamp rejected — rows get tall, list feels less scannable when 20 results render.
- **D-15:** **Match highlighting via bolded substring** in both the username and the bio snippet. Wrap matched substrings (case-insensitive) in `<mark>` (or `<strong>`) with a subtle weight bump and accent-color tint; cheap to compute client-side from the active query string. Helps users see why each row matched.
- **D-16:** **Taste overlap % rendering = identical to `SuggestedCollectorRow`.** Use `computeTasteOverlap` to derive the bucket label, then `overlapBucket()` (or its in-search equivalent) to map to a numeric (0.85 / 0.55 / 0.20), display as `{Math.round(overlap * 100)}% taste overlap`. Same precision, same copy — visual continuity with home page rows is the priority.
- **D-17:** **Mini-thumb cluster preserved.** Up to 3 shared watches as overlapping circles with `{N} shared` counter (mirrors `SuggestedCollectorRow`). Hidden on mobile (`hidden sm:flex`) to keep the row scannable on narrow viewports — same responsive treatment as the home page row.

### Privacy gate (SRCH-04)

- **D-18:** **`searchProfiles` DAL filters `WHERE profile_public = true`** at the query layer. Two-layer with the existing RLS gate on `profiles` (v2.0 Phase 6/8 pattern). Private profiles are silently excluded — no row count adjustment, no `Private collector` placeholder, zero existence leak. Followers-of-private-user mode rejected for v3.0: adds a `LEFT JOIN follows` cost to every search query and the marginal UX gain doesn't justify the complexity at MVP scale.

### `searchProfiles` DAL contract (SRCH-04, SRCH-08)

- **D-19:** **`searchProfiles({ q, viewerId, limit = 20, signal? }): Promise<SearchProfileResult[]>`** lives in `src/data/profiles.ts` (or a new `src/data/search.ts` if the planner prefers separation). Returns the row payload **including** `isFollowing: boolean` per result via a batched `inArray(follows.followingId, resultIds)` lookup — same anti-N+1 pattern as `getSuggestedCollectorsForViewer`. Caller never makes per-row follow lookups.
- **D-20:** **Server-side 2-character minimum** enforced inside the DAL with an early return `if (q.trim().length < 2) return []` — defense-in-depth even though the client also gates the fetch (Pitfall C-2).
- **D-21:** **Bio-search ILIKE only fires when `q.length >= 3`** (subtle refinement of C-5). Username matches at 2 chars are useful (`bo` → `bob`); bio matches at 2 chars produce too much noise (`bo` matches every bio with the word "above"). Compound predicate: `WHERE profile_public AND (username ILIKE %q% OR (LENGTH(q) >= 3 AND bio ILIKE %q%))`.
- **D-22:** **Order by taste overlap DESC, username ASC, LIMIT 20** per SRCH-04. Compute taste overlap per row using the existing `computeTasteOverlap` helper (server-side; same as Suggested Collectors). LIMIT applied at the query (`limit(20)`); ordering applied after the JS overlap computation since the overlap isn't a SQL column. For 20 rows of name+bio data this is acceptable cost; revisit if the candidate-pool grows past O(few hundred).

### Desktop top nav cleanup (NAV-07 carry-over polish)

- **D-23:** **Delete `HeaderNav` from `DesktopTopNav.tsx` entirely.** Remove the import, remove the `<HeaderNav username={username} />` render, delete `src/components/layout/HeaderNav.tsx` itself (no other consumers). Grep for `from '@/components/layout/HeaderNav'` and confirm zero remaining references before deletion. Profile + Settings already live in `UserMenu` (lines 50-55 of `UserMenu.tsx`); the logo's `<Link href="/">` already routes to Collection.
- **D-24:** **Persistent nav search input visual restyle** — using Figma as inspiration only, exact dimensions are Claude's discretion:
  - Apply a muted fill background (e.g., `bg-muted/50` or equivalent token that reads as a soft pill).
  - Add a leading magnifier icon (`Search` from `lucide-react`) inside the input on the left.
  - Widen the input from current `max-w-xs` to a balanced width that feels prominent without dominating (judgment: `max-w-md` to `max-w-lg` range, but planner picks the value that visually balances logo · Explore · search · CTA cluster).
  - Round corners to match the rest of the chrome (`rounded-md` likely).
  - Keep `name="q"`, `type="search"`, `aria-label="Search"`, and the existing `handleSearchSubmit` handler — behavior is unchanged, only the visual shell changes.
- **D-25:** **Two separate search inputs by design.** Nav input is the dumb launcher (D-01 submit-only). The `/search` page mounts its OWN larger input (`name="q"`, autofocused, pre-filled from the URL `q` param) that owns the live debounce + AbortController + URL sync. Nav input on `/search` keeps rendering — when user submits from it on `/search`, it acts as a "reset query" path (re-fires the search with the new q). No `usePathname()` branching needed on the nav input itself. Layout-shift-free.
- **D-26:** **Wear button + Add icon + Bell + UserMenu trigger unchanged.** Phase 14 D-16 layout is preserved; Phase 16 only restyles the search input shell and removes HeaderNav. NavWearButton's filled-brand styling already matches the Figma intent.
- **D-27:** **Spacing/balance is Claude's discretion.** Per the user's explicit guidance ("the dimensions and spacing of the figma should just be considered inspiration. use your judgement to make decisions to make it balanced and look good"), planner + UI-checker decide exact gap values, container widths, and rhythm. Anchor on existing tokens (`gap-4`, `gap-6`, `gap-8`) rather than introducing one-off pixel values.

### Active-query and tab-state hook architecture

- **D-28:** **Single `useSearchState` hook** (Client Component) owns:
  - `q` (current input value, kept in local state for input responsiveness)
  - `debouncedQ` (250ms-debounced derivation of `q`)
  - `tab` (current tab, derived from `?tab=` URL param)
  - URL sync side effect (`router.replace()` on debouncedQ change)
  - Fetch effect with AbortController + cleanup
  - Result + loading + error state
  - Public API: `{ q, setQ, debouncedQ, tab, setTab, results, isLoading, hasError, isFollowingMap }`
  Single source of truth keeps the input ↔ URL ↔ fetch trifecta correct. Implement in `src/components/search/useSearchState.ts` (or co-locate with the page-level Client Component).
- **D-29:** **Page-level `/search` is a Client Component** (`'use client'`). The People-search interactive surface needs `useEffect` + `useState` for typeahead + abort + URL sync. Suggested-collector rendering inside the empty/no-results states reads from a Server Component child (passed in as a prop or rendered as `children` from the route's Server Component wrapper) — same pattern Phase 13 used for `MarkNotificationsSeenOnMount`.

### Folded Todos
- None — todo match-phase returned 0 matches for Phase 16 (pre-existing v1.0 TEST-04/05/06 are scoped as `TEST-FUT-*` per REQUIREMENTS Future Requirements).

### Claude's Discretion
- Exact pixel/Tailwind values for the nav search input (D-24): width, fill opacity, magnifier icon size, rounded radius. Goal is a balanced strip; planner picks values that look right against logo · Explore · CTA cluster.
- Exact copy for the All-tab coming-soon footer cards (D-06) — short hint that mentions the unblocking dependency in plain language.
- Exact copy for `/search` Watches + Collections coming-soon tab states (D-08).
- The `useSearchState` hook's exact return shape (D-28) — any equivalent shape that exposes the trifecta cleanly is fine.
- Whether match-highlighting (D-15) uses `<mark>`, `<strong>`, or a custom span with `font-semibold`. Pick whatever reads as "matched" against the existing typography.
- Whether the suggested-collector list during pre-query/no-results uses keyset pagination (Load More) like the home page or just renders a fixed count (e.g., 8). Default to fixed count for simplicity; add Load More only if the pre-query screen feels too thin.
- Whether `searchProfiles` lives in `src/data/profiles.ts` or a new `src/data/search.ts` file (D-19) — planner picks based on file-size/cohesion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & roadmap
- `.planning/PROJECT.md` — v3.0 milestone framing; **per-user independent watch entries** key decision (re-anchored as the dependency blocking Watches/Collections tabs); two-layer privacy pattern; `cacheComponents` + inline theme script pattern in KEY DECISIONS table.
- `.planning/REQUIREMENTS.md` — SRCH-01..07 acceptance criteria; SRCH-08 schema (already shipped Phase 11); SRCH-FUT-01..03 (deferred Watches search, Collections search, recent searches); Out of Scope row "Full pg_trgm similarity scoring (similarity > threshold ranking)" — confirms ILIKE-only this phase.
- `.planning/ROADMAP.md` §"Phase 16: People Search" — phase goal, success criteria, pitfalls C-1..C-5 (C-1 pg_trgm verification, C-2 server-side 2-char minimum, C-3 profile_public WHERE clause, C-4 batched isFollowing, C-5 bio search minimum-length guard).

### Prior phase context (locked decisions that must be honored)
- `.planning/phases/14-nav-shell-explore-stub/14-CONTEXT.md` — D-16 desktop top nav composition (logo · HeaderNav · Explore · search · NavWearButton · Add · Bell · UserMenu); D-17 UserMenu consolidates Profile + Settings + InlineThemeSegmented + Sign out (the reason HeaderNav can be deleted); D-19 `/search` was always a placeholder; D-21/D-22 PUBLIC_PATHS shared constant + auth-route exclusion (preserved); SlimTopNav D-11 mobile layout already matches Figma intent.
- `.planning/phases/13-notifications-foundation/13-CONTEXT.md` — D-25 explicit-`viewerId` two-layer privacy contract (mirror this in `searchProfiles` DAL: `viewerId` is a required parameter, not derived inside the DAL, so `'use cache'` keys correctly per viewer).
- `.planning/phases/12-visibility-ripple-in-dal/12-CONTEXT.md` — viewer-aware DAL pattern + two-layer privacy on cross-user reads; same shape applies to `searchProfiles` (DAL `WHERE profile_public = true` + RLS gate).
- `.planning/phases/11-schema-storage-foundation/11-CONTEXT.md` (or PLAN/migration files) — `pg_trgm` extension + GIN trigram indexes on `profiles.username` + `profiles.bio` are LIVE in prod. Verify with `EXPLAIN ANALYZE` showing index scan, not seq scan, on a representative ILIKE query before declaring SRCH-04 complete (Pitfall C-1).

### Code files (read to confirm current state before editing)

#### Search surface
- `src/app/search/page.tsx` — current Phase 14 stub; entire body replaced this phase. Becomes a Client Component (or Server wrapper around a `'use client'` body — planner picks; D-29).
- `src/components/home/SuggestedCollectorRow.tsx` — visual pattern to mirror (D-13). Read for the avatar / overlap-subtitle / mini-thumb-cluster / FollowButton layout.
- `src/components/profile/FollowButton.tsx` — already exposes `variant="inline"`; no component changes needed, just a new caller.
- `src/data/suggestions.ts` — `getSuggestedCollectorsForViewer` (the actual function name; REQUIREMENTS calls it `getCollectorsLikeUser` — alias note); reuse for empty state + no-results state. Read the keyset cursor + `notInArray(follows)` pattern.
- `src/data/profiles.ts` — likely home for the new `searchProfiles` DAL (D-19); read existing exports to decide co-location vs new `src/data/search.ts`.
- `src/data/follows.ts` — for the batched `isFollowing` lookup pattern (D-19); same anti-N+1 shape used by Suggested Collectors.
- `src/lib/tasteOverlap.ts` — `computeTasteOverlap` (label-based) used to derive the per-row overlap percentage (D-16).

#### Desktop nav cleanup
- `src/components/layout/DesktopTopNav.tsx` — primary edit target. Delete `HeaderNav` import + usage (D-23); restyle the `<Input>` shell with muted fill + leading magnifier (D-24); preserve `handleSearchSubmit` behavior byte-for-byte.
- `src/components/layout/HeaderNav.tsx` — file to **delete** after grep confirms no remaining importers (D-23). Phase 14 already removed Insights and only `baseNavItems = [{href:'/',label:'Collection'}]` plus Profile + Settings remain — all redundant with logo + UserMenu.
- `src/components/layout/UserMenu.tsx` — already contains Profile + Settings DropdownMenuItems (lines 50-55); confirms HeaderNav is safe to remove.
- `src/components/layout/SlimTopNav.tsx` — read-only; mobile layout intentionally unchanged this phase. Verify the existing search-icon → `/search` route still works once the page becomes interactive.
- `src/components/layout/Header.tsx` — delegator; no expected changes, but verify after HeaderNav deletion that no broken imports remain.

#### UI primitives
- `src/components/ui/input.tsx` — read existing variants/styles before applying the muted fill restyle (D-24); pick a path that reuses tokens vs introduces one-off classes.
- `src/components/ui/tabs.tsx` (if present) — for the 4-tab control on `/search`. If no Shadcn tabs primitive is installed, planner decides between adding it or composing manually.
- `src/components/ui/skeleton.tsx` (or wherever the existing skeleton primitive lives) — for the loading state (D-09).

### External docs
- Next.js 16 `cacheComponents` docs (`node_modules/next/dist/docs/...`) — `/search` is a dynamic interactive route; do NOT add `'use cache'` to its data fetches. The DAL functions called from inside the Client Component must remain regular Server Actions / Server-Component-only DAL functions.
- Postgres `pg_trgm` docs — `gin_trgm_ops` operator class enables ILIKE to use the GIN index. Phase 11's migration `20260422000000_phase11_storage_pg_trgm_indexes.sql` (or whatever name was used) is the source of truth for the index definitions; read it once before writing the EXPLAIN ANALYZE verification step.
- Drizzle ORM docs — `ilike()` operator + `inArray()` for the batched isFollowing lookup. Both already in use elsewhere in `src/data/`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`getSuggestedCollectorsForViewer`** (`src/data/suggestions.ts`) — already does the `WHERE profile_public = true` gate, the `notInArray(follows)` exclusion, the per-collector taste-overlap computation, and the keyset pagination. Empty state + no-results state both reuse this DAL with no modification (D-11, D-10).
- **`SuggestedCollectorRow`** (`src/components/home/SuggestedCollectorRow.tsx`) — canonical row layout (D-13). Either parameterize for use in `/search` (add a `bioSnippet?: string` slot) or fork as `PeopleSearchRow` and accept the slight duplication. Planner picks based on diff size.
- **`FollowButton variant="inline"`** (`src/components/profile/FollowButton.tsx`) — drop-in for the result row right-side action. No component changes.
- **`computeTasteOverlap`** (`src/lib/tasteOverlap.ts`) — bucket-label → numeric (0.85/0.55/0.20) used by Suggested Collectors. Mirror in `searchProfiles` so the per-row `X% taste overlap` rendering is identical (D-16).
- **`DesktopTopNav` `handleSearchSubmit`** (`src/components/layout/DesktopTopNav.tsx` L47-56) — already routes to `/search?q=...`; no behavior change needed (D-01, D-25).
- **`Input` primitive** (`src/components/ui/input.tsx`) — wrap with the muted fill + leading icon (D-24).
- **Skeleton primitive** — for the loading rows (D-09); follow `NetworkActivityFeed`'s shimmer pattern.
- **Phase 14 `/search` stub** (`src/app/search/page.tsx`) — entire body replaced; serves as the route + auth-gate envelope only.

### Established Patterns
- **Two-layer privacy on cross-user reads** — applies directly: `WHERE profile_public = true` in `searchProfiles` DAL + RLS on `profiles` (v2.0). Don't rely on RLS alone; don't rely on the WHERE alone (Phase 12 D-G1 anti-pattern).
- **Batched `inArray()` follow lookup** — used by `getSuggestedCollectorsForViewer` to avoid N+1; mirror in `searchProfiles` for `isFollowing` per row (D-19, Pitfall C-4).
- **`router.replace()` for active-state URL sync** — same pattern Phase 13 used for read-state updates without bloating the back-stack. Mirror for `q=` and `tab=` (D-04, D-12).
- **AbortController + `useEffect` cleanup** — standard React typeahead protection (D-03). The existing codebase doesn't have a typeahead surface yet, so this is the first use; keep the implementation in `useSearchState` so future search surfaces can copy it.
- **Server-Component-rendered Suspense fallbacks** — the loading skeleton fits this pattern; if the planner uses Suspense around the result list, the skeleton is the fallback. If using local state instead, the skeleton renders during `isLoading`.
- **`'use client'` Client Component owns interactive state** — exactly Phase 13's `NotificationRow` shape; mirror for the page-level component (D-29).

### Integration Points
- **`/search` route** — full page rewrite (Client Component or Server wrapper + Client body). Existing auth gate via `proxy.ts` PUBLIC_PATHS (D-21 from Phase 14) is preserved automatically.
- **`DesktopTopNav.tsx`** — two-line edit: delete HeaderNav import + render; restyle the `<Input>` element with muted fill + leading magnifier icon. Preserve the form/submit handler byte-for-byte.
- **`HeaderNav.tsx`** — file deletion. Grep `from '@/components/layout/HeaderNav'` for residual imports before removal.
- **`src/data/`** — new `searchProfiles` function added (D-19); decide co-location in `profiles.ts` vs new `search.ts`.
- **`computeTasteOverlap` callsite** — `searchProfiles` becomes a new caller; ensure the call uses the same `viewerId` + per-row arguments shape that `getSuggestedCollectorsForViewer` uses.
- **`Tabs` primitive** — if Shadcn tabs not yet installed (`src/components/ui/tabs.tsx` may or may not exist), planner adds it via `npx shadcn add tabs` and threads through. Otherwise compose manually with anchor links + active state.
- **No DB migration needed** — `pg_trgm` + GIN trigram indexes shipped Phase 11 (SRCH-08 already complete). Phase 16 only verifies them with EXPLAIN ANALYZE.

</code_context>

<specifics>
## Specific Ideas

- **Visual inspiration, not spec.** Figma node 1:3178 (the captured selection) shows the desktop top-nav layout the user wants to converge on: Horlo wordmark · "Explore" link · soft-fill search input with leading magnifier · solid brown "Wear" CTA (icon + label) · "+" add icon · bell with unread dot · avatar dropdown chevron. Phase 16 carries the visual *intent* (clean strip, no inline secondary nav links, prominent search) but treats every dimension as Claude's discretion. The user's exact words during discussion: "the dimensions and spacing of the figma should just be considered inspiration. use your judgement to make decisions to make it balanced and look good."
- **The "All" tab as the default landing** is a deliberate UX call (user picked it over the Recommended "People"). It positions `/search` as a search hub rather than a people-only surface, even when 3/4 sub-surfaces are coming-soon. The mirror+coming-soon-footers pattern (D-06) is what makes that choice workable — All looks active and useful even though only People populates.
- **Match highlighting** (D-15): when the query is `"li"` and the username is `"liam"`, render `<strong>li</strong>am`. When the bio is `"loves vintage chronographs"`, render `<strong>li</strong>... no wait, "li" doesn't appear in "loves vintage chronographs"` — only highlight where the substring actually occurs. Case-insensitive match, original casing preserved in render. Watch for HTML injection — never `dangerouslyInsertHTML` a user-supplied bio; build the highlighted output as React nodes via array splitting.
- **`searchProfiles` ordering precedence** (D-22): tie-break taste-overlap collisions with `username ASC`. SuggestedCollectorRow already uses `(overlap DESC, userId ASC)`; for search results, `username ASC` is more useful than `userId ASC` because the user can mentally predict the ordering when scanning results. Confirm with the planner that the cost of adding `username` to the ORDER BY is acceptable at LIMIT 20 (it should be — covered by an existing index on `profiles.username` for trigram, plus a btree if present).
- **The two-search-input architecture** (D-25) is non-obvious but right: the nav input is universal chrome, the page input is the live surface. Don't try to hoist the live state into the nav (would mean hydrating a stateful Client Component for every authenticated page) and don't try to make the nav input morph behavior on `/search` (couples nav layout to page state). Two inputs, two responsibilities — clean.
- **`isFollowing` per result row** (D-19) is required by the inline FollowButton render — without it the button would default to the wrong state and require a roundtrip on first click. The batched `inArray()` lookup pattern from Suggested Collectors handles this cleanly; the cost is one extra SELECT per search query, well under any latency budget.

</specifics>

<deferred>
## Deferred Ideas

- **Canonical watch DB / cross-user watch identity** — surfaced during /search structure discussion. Already a project-level deferred decision per `PROJECT.md` key decisions table ("Per-user independent watch entries" chosen in v2.0; revisit "in a future data strategy phase if social features need cross-user watch identity"). Re-anchored here because it's the prerequisite blocking the **Watches search tab** (SRCH-FUT-01) and the **Collections search tab** (SRCH-FUT-02). When that future "data strategy" phase ships, /search Watches and Collections tabs unblock at the same time. Likely shape: canonical `watch_models` table with curated brand/model identities + per-user `watches` rows reference a canonical FK + migration backfill from existing user data + search/dedupe surface on top.
- **Live dropdown panel under the persistent nav input** — explicitly considered and rejected (D-01) for Phase 16. If discovery patterns shift toward the user wanting search results without leaving their current page (likely once the home/explore feeds are richer), a future polish phase can add the dropdown without disturbing the page-level live search. Keep the page-level surface as the source of truth so the dropdown becomes a thin preview layer.
- **Recent searches / search history** — out of scope per REQUIREMENTS SRCH-FUT-03. Suggested collectors are the recovery surface this phase. If the product later needs query memory (re-tap a recent collector search), it lives in a future "search polish" phase with its own storage decision (localStorage vs server-side per-user history vs IndexedDB).
- **Trigram similarity scoring beyond ILIKE** — out of scope per REQUIREMENTS Out of Scope table. ILIKE + GIN trigram indexes are sufficient at sub-1000-user scale. If candidate-pool growth pushes ILIKE past acceptable latency (>200ms p95), the upgrade path is `WHERE similarity(username, q) > 0.3 ORDER BY similarity DESC` — same indexes, different operator, separate phase.
- **Mobile SlimTopNav restyle** — Phase 16 explicitly leaves SlimTopNav untouched (D-Area-4). If a future phase audits the mobile nav strip against the same Figma direction, it's a small standalone phase.
- **Global accent palette flip from warm-gold to Figma teal** — same deferred-palette decision carried from Phase 14 D-05. Out of scope; tracked separately.
- **`useSearchState` hook generalization** — Phase 16 implements it for `/search`. If future surfaces (Watches search tab when it unblocks, an in-page filter input on a profile, etc.) need the same q + debounce + AbortController + URL sync trifecta, the hook can be extracted to `src/lib/hooks/useTypeaheadState.ts` or similar. Premature this phase — keep it co-located with `/search` until a second caller exists.

### Reviewed Todos (not folded)
- None — todo match-phase returned 0 matches for Phase 16.

</deferred>

---

*Phase: 16-people-search*
*Context gathered: 2026-04-25*

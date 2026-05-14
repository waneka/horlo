---
slug: profile-page-404-top-nav
status: investigating
trigger: profile page 404 on top-nav click, refresh works
created: 2026-05-13T23:00:00Z
updated: 2026-05-14T14:45:00Z
---

## Symptoms

<DATA_START>
**Expected:** Clicking "Profile" (or any direct nav link to `/u/[username]/[tab]`) from the top nav navigates the user to their profile page (collection / wishlist / stats etc.) with the corresponding tab content rendered.

**Actual:** A 404 page is shown in the browser on first click from the top nav. Hard-refreshing the URL renders the profile page correctly. Behavior:
- Click "Profile" from top nav → 404
- Refresh same URL → collection (works)
- Click "Wishlist" tab from nav → 404
- Refresh → wishlist tab (works)

**Errors:** No console errors. No network errors visible in DevTools.

**Server response is correct:** User captured the RSC stream for `https://www.horlo.app/u/twwaneka_test/collection?_rsc=4m1o9` and it is a valid React Server Components payload — full `CollectionTabContent` tree, `isOwner: true`, correct `viewerId`, `targetUserId`, `username: "twwaneka_test"`, `watches: []`, `watchCount: 0`. The server returned the page correctly.

**Scope:** Affects basically every profile page; persistent across users.

**Cannot reproduce locally** — only happens on prod (horlo.app).

**Timeline:** Unknown when this started. Discovered during Phase 39b UAT (test 4) on 2026-05-13. Possibly predates recent work since the route logic in `src/app/u/[username]/[tab]/page.tsx` hasn't changed during this session.

**Reproduction (prod only):**
1. Sign in as any user on horlo.app.
2. Click "Profile" in the top nav (UserMenu component links directly to `/u/[username]/collection`).
3. See 404 page.
4. Reload (Cmd+R / F5) → page renders correctly.
5. Click "Wishlist" tab from nav → 404 again.
6. Refresh → works again.

**Known surface-area (orchestrator's pre-investigation):**
- Top nav: `src/components/layout/UserMenu.tsx:111` — `href={\`/u/${username}/collection\`}` (direct link, not via redirect).
- Profile route: `src/app/u/[username]/[tab]/page.tsx` — handles all tabs (collection/wishlist/worn/notes/stats/insights). Has `notFound()` calls scoped to specific privacy/owner conditions.
- Profile layout: `src/app/u/[username]/layout.tsx:35` — `if (!profile) notFound()` when username lookup fails.
- Redirect file: `src/app/u/[username]/page.tsx` — `redirect(\`/u/${username}/collection\`)` for the base `/u/[username]` URL (not on the path the top-nav uses).
- Possible cause: Next.js App Router prefetch cache poisoning. `<Link>` prefetches on hover/idle; if an earlier prefetch hit 404, cached 404 served on next click; hard refresh bypasses cache.
- Possible cause: middleware (`src/proxy.ts`?) interfering with prefetch requests vs direct nav.
- Possible cause: dynamic params validation (allowed tab list?) failing on the soft transition for some edge case.
<DATA_END>

## Current Focus

hypothesis: **Proxy intercepts prefetches before Next.js, poisoning Router Cache (refined 2026-05-14).** Phase 39c shipped the full structural refactor (thin Suspense shell, `'use cache'` resolver, `unstable_instant` gate). UAT post-deploy at fa22080 reports ~98% of profile-link clicks 404 again — the structural fix is NOT enough. The `prefetch={false}` mitigation has been reverted (Plan 39c-06), so prefetches are re-enabled.

**Why Phase 39c is insufficient:** `src/proxy.ts:11-15` runs an auth gate BEFORE Next.js routing — `if (!user && !isPublic) return NextResponse.redirect('/login?next=...')`. `/u/[username]` is NOT in `isPublicPath()` (verified: `src/lib/constants/public-paths.ts` only lists `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth`). So every RSC prefetch to `/u/[username]/[tab]` passes through `proxy.ts` → `updateSession(request)` → `supabase.auth.getUser()` → if that returns `null`, proxy 307s to `/login`. Next 16's Router Cache stores the 307 keyed on the requested pathname; subsequent clicks serve the cached entry → 404.

**The 2026-05-13 "approved" D-39c-09 prod-checkpoint was a false-positive.** At the time the operator ran the checkpoint, Phase 39c commits had NOT been pushed yet — production was still serving `2f42d00` (the `prefetch={false}` mitigation). The operator essentially re-verified the original mitigation, not the structural fix. The actual structural-fix push (37 commits, `2f42d00..ca8ea2d`, later `fa22080`) only landed on origin/main when the user explicitly said "Yes, push" later in the session. The UAT immediately after that push surfaced the regression.

**Why 98% failure and not 100%:** `supabase.auth.getUser()` does a network round-trip + may refresh tokens. The 2% pass rate likely matches the small window where: (a) auth round-trip succeeds AND (b) the response is fast enough that the Router Cache stores a valid 200 RSC AND (c) the user clicks before any contradicting cache write. Alternatively, the ~2% might be the "click after a successful navigation back to home → fresh prefetch" path where the cookie state is fresh.

**[SUPERSEDED]** Original 2026-05-13 finding below — kept for historical context. Phase 39c shipped the Path-A2 refactor in full. Bug recurred post-deploy → see refined hypothesis above.

**Option A investigation findings (2026-05-14): adding loading.tsx is INSUFFICIENT on its own.** Per Next 16 `loading.md:88` ("loading.js wraps `not-found.js`, `page.js`, and nested `layout.js` files in a `<Suspense>` boundary. It does **not** wrap the `layout.js`, `template.js`, or `error.js` in the same segment"), a `loading.tsx` at `src/app/u/[username]/loading.tsx` would wrap the children rendered into `{children}` slot but NOT the layout itself.

**The layout at `src/app/u/[username]/layout.tsx` is the actual blocker.** It performs uncached runtime data access throughout (lines 22-110): `getCurrentUser()`, `getProfileByUsername()`, `getProfileSettings()`, `getFollowerCounts()`, `getWatchesByUser()`, `getAllWearEventsByUser()`, `isFollowing()`, `resolveCommonGround()`. Per Next 16 `loading.md:90-95`:

> If the layout accesses uncached or runtime data (e.g. `cookies()`, `headers()`, or uncached fetches), `loading.js` will not show a fallback for it.
> - With Cache Components: Uncached or runtime data access in the layout must be explicitly wrapped in `<Suspense>` ... The static shell streams first, and the uncached content fills in.
> To ensure instant navigation, move uncached data fetching from `layout.js` into `page.js`, or wrap the runtime data access in your layout in its own `<Suspense>` boundary.

**This means the proper fix per Next 16 docs is a REFACTOR of `src/app/u/[username]/layout.tsx`**, not just a new file. The layout must EITHER:
  - Move all uncached data fetching out of the layout body and into the page (or a Server Component rendered as a `<Suspense>`-wrapped child), OR
  - Wrap each currently-uncached call site in its own `<Suspense fallback={...}>` boundary inside the layout.

That refactor is non-trivial: the layout's data fetches power the visible ProfileHeader (avatar, taste tags, follower counts) AND the gating logic (private-profile short-circuit at line 47, common-ground band at line 130, ProfileTabs `showCommonGround`/`isOwner` flags at line 138). The gating logic in particular needs to resolve BEFORE deciding which children to render — it can't trivially be Suspense-deferred without architectural changes.

test (refined 2026-05-14 — TWO failure modes to capture): Before adding code-level logging, capture both failure modes from production using DevTools.

  **Step T1A — capture the 404 path (Mode A — cache-poison):**
  1. Open `https://www.horlo.app/` in a logged-in session on desktop wifi (fast network — maximizes Mode A reproduction).
  2. DevTools → Network panel → filter by `_rsc=`.
  3. Hover the UserMenu avatar (top nav) — triggers prefetch. Capture the prefetch request:
     - **Status code** (307? 404? 200?)
     - **Location response header** (if 307 — where does it redirect?)
     - **Cache-Control response header**
     - **Next-Router-Prefetch request header** present? (y/n)
     - **Response body** first ~200 chars
  4. Click the Profile Link. Capture the click-time request — served from disk-cache (gray status)? If re-fetch, status?

  **Step T1B — capture the infinite-skeleton path (Mode B — stream hang):**
  1. On mobile (or desktop with network throttled to "Slow 3G" in DevTools), click the Profile link from a populated home page UNTIL you hit a non-404 click.
  2. When the skeleton shows and never resolves, observe:
     - In Network panel: is there a pending RSC request (status: "(pending)")? What's its URL?
     - Does the response status code show after a while (timeout, 200, 5xx)?
     - Switch to the request's "EventStream" or "Response" tab — is there partial RSC payload? Is the stream open but silent?
     - Open the browser console — any unhandled-promise warnings or RSC-specific errors?
  3. Wait ~60 seconds with the skeleton on screen. Does the network request eventually fail/succeed/keep hanging?

  **Step T2 — if T1 status is 307 (proxy intercept):** the hypothesis is confirmed. Three fix paths to consider in order of cost:
    - **F1 (cheapest, gives ground):** add `'/u'` to `isPublicPath` so the proxy doesn't gate it. Page-level auth is preserved (`getCurrentUser` in ProfileGate throws UnauthorizedError if needed, which the gate swallows; `notFound()` short-circuits if profile doesn't exist; LockedProfileState handles private). Risk: the proxy was the SOLE chrome-level guard for the profile route — removing it exposes profile pages to anonymous visitors. That's fine for *public* profiles (LockedProfileState handles private), and arguably aligns with the Phase 39b "build for cross-collector discovery" direction. Need user sign-off.
    - **F2 (correct, more work):** keep the proxy gate, but exempt RSC prefetch requests from auth redirection — detect `Next-Router-Prefetch` header in proxy.ts, let prefetches fall through with auth headers attached but no redirect. The page-level code already handles unauthenticated correctly (UnauthorizedError → swallowed → viewerId=null → public-or-locked branch). This keeps the proxy gate as a defense for full-document navs (browser-typed URL, direct link) but lets RSC prefetches reach Next.js without a 307. Risk: subtle — must carefully define "is this a prefetch request" because the existing browser nav also uses Next.js routing client-side.
    - **F3 (heaviest):** add `Cache-Control: no-store` to the proxy's 307 response so Next.js Router Cache won't store it. This addresses the *poisoning* but still imposes a 307 → /login flash on the prefetch (which the user would never see since prefetches are invisible). It would prevent the click-time 404 but does NOT actually make profile prefetch *work* — Next.js would just always re-fetch and always get a 307 → still no useful prefetch payload → click triggers a full document nav. Probably DON'T pick this one unless F1/F2 are blocked.

  **Step T3 — if T1 status is NOT 307 (something else):** different bug class. Most likely candidate: the static shell prerender is failing somewhere inside `<Suspense>` and Next returns 404 for the segment. Add server-side logging at `proxy.ts:6`, `layout.tsx:5`, `profile-gate.tsx:32`, `profile-shell-resolver.tsx` entry — one console.log each with timestamp + `request.headers.get('next-router-prefetch')` + auth state. Push, user retests, share logs.

  - **Path A1 (Suspense-wrap inside the layout):** Keep the layout, but wrap the data-fetching subtrees inside `<Suspense>` boundaries with skeleton fallbacks. The gating short-circuits (locked profile, private profile) would need to be moved INTO a Suspense-wrapped sub-component that decides what to render based on resolved data. The static shell of the layout — the page chrome / `<main>` wrapper — would prerender; auth-dependent content fills in. Pros: smallest refactor surface, preserves current data-flow. Cons: ProfileHeader needs to render placeholder UNTIL data resolves, which may flash unauthenticated-looking content for ~50-200ms; tab list also needs special handling (we don't know `showCommonGround`/`isOwner` yet during the static shell). Mitigated by using `<Suspense>` boundaries that fall back to a faithful skeleton (avatar circle + name placeholder + tab row of identical width).

  - **Path A2 (Move data fetching down):** Strip `src/app/u/[username]/layout.tsx` down to just the `<main>` shell + a `<Suspense fallback={<ProfileShellSkeleton />}>` boundary wrapping `{children}`. Move all current layout data fetching (profile, settings, counts, watches, wear events, taste tags, common-ground overlap) into `src/app/u/[username]/[tab]/page.tsx` (or a shared Server Component rendered from the page). ProfileHeader, CommonGroundHeroBand, and ProfileTabs render from the page, not the layout. Pros: cleanly satisfies the Next 16 model (layout is static shell, page resolves everything); a `loading.tsx` at `src/app/u/[username]/loading.tsx` then ACTUALLY works because there's nothing for it to wait on at the layout level. Cons: largest refactor — ProfileHeader and ProfileTabs are currently rendered once at the layout level and shared across all tabs; moving them down means each tab's page is responsible for rendering them, OR they need to be lifted into a shared internal Server Component imported by every tab page. Risk of regression in header/tab UI consistency.

  - **Path A3 (Hybrid):** Move ONLY the auth-dependent data (cookies-based `getCurrentUser()`, follow state, common-ground overlap) into Suspense-wrapped subcomponents. Keep the username-based profile resolution at the top of the layout because that's the gating signal that decides "render LockedProfileState vs ProfileHeader". `getProfileByUsername()` could be wrapped in `'use cache'` so it doesn't block — username → profile is the kind of read that's idempotent and cache-friendly per-username. Pros: balances refactor scope vs. correctness; the "private profile?" decision still happens synchronously in the layout because it doesn't depend on viewer auth. Cons: requires careful audit of which call sites actually access cookies/headers vs. which are pure DB reads that just happen to be unmarked.

expecting (refined 2026-05-14): T1's Network capture will produce one of three signatures:
  - **307 to /login** → proxy intercept (P1 confirmed); pick F1/F2 (likely F2 — exempt RSC prefetches from the gate).
  - **404 with empty body or "page not found" RSC** → Next.js itself is failing the prefetch despite Phase 39c; look at server logs, probably ProfileShellResolver throwing somewhere it shouldn't (e.g., DB connection during static-shell prerender).
  - **200 with a redirect-doc RSC body (Next 16 RSC redirect format)** → less likely, but would mean the proxy IS gating and the redirect is being encoded into the RSC payload, which the Router Cache later resolves to "this segment doesn't exist."

next_action: **CHECKPOINT — ask user to run T1 (DevTools capture) before any code logging.** It's free, takes 2 minutes, and disambiguates the whole hypothesis space. If T1 confirms 307, jump to F2 implementation (proxy-level prefetch exemption). If T1 shows something else, plan server-side logging next.
reasoning_checkpoint:
tdd_checkpoint:

## Evidence

- timestamp: 2026-05-13T23:15:00Z
  observation: `src/proxy.ts:5` exports `default function proxy()` — confirms migration to Next 16 `proxy.ts` (was `middleware.ts` pre-v16). File name is correct per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:11` ("middleware file convention is deprecated and has been renamed to proxy"). Not a misconfiguration.
- timestamp: 2026-05-13T23:16:00Z
  observation: `next.config.ts:13` has `experimental.cacheComponents: true`. Per `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md:34-46`, this enables React `<Activity>` for client-side navigation — "Component state is preserved when navigating between routes" and "Next.js uses heuristics to keep a few recently visited routes 'hidden', while older routes are removed from the DOM." With `cacheComponents`, route segments behave dynamically by default (no prerender unless explicit `'use cache'`).
- timestamp: 2026-05-13T23:17:00Z
  observation: No `loading.tsx` exists anywhere in `src/app/` (`find` returned empty). Per `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md:88` — "Dynamic Route: prefetching is skipped, or the route is partially prefetched if `loading.tsx` is present." The `/u/[username]/[tab]` route is dynamic AND has no loading boundary, so under standard rules Next.js should NOT prefetch it at all. With `cacheComponents: true` + Next 16's "incremental prefetching" (`version-16.md:587`), behavior may differ — Next 16 prefetches whatever segments are NOT already cached. The poisoned cache theory requires SOMETHING to have been cached.
- timestamp: 2026-05-13T23:18:00Z
  observation: `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md:298` — **"Prefetching is only enabled in production"**. This single docs line explains why dev never reproduces the bug. Prefetching is the discriminator between dev (works) and prod (broken).
- timestamp: 2026-05-13T23:19:00Z
  observation: Profile route's auth-gate path: layout (`src/app/u/[username]/layout.tsx:35`) calls `notFound()` if `getProfileByUsername(username)` returns null. Page (`src/app/u/[username]/[tab]/page.tsx:55,58,106,150`) calls `notFound()` for invalid tab, missing profile, missing common-ground overlap, and non-owner insights. None of these branches fire for a signed-in user viewing their OWN collection — but the BODY of the captured RSC payload is correct, so server-side did NOT hit any `notFound()` call.
- timestamp: 2026-05-13T23:20:00Z
  observation: `src/proxy.ts:11-15` — auth gate: `if (!user && !isPublic)` redirects to `/login?next=...`. If the prefetch was issued with no auth cookie (e.g., during login transition before cookie propagation), the proxy returns a **307 to /login**, NOT a 404. But Next.js client router may treat an unexpected redirect of a prefetch RSC fetch as "this URL is unavailable" and cache that result under the original pathname. Need to verify against Next 16 router source.
- timestamp: 2026-05-13T23:21:00Z
  observation: `src/app/login/login-form.tsx:24-33` — login flow: `supabase.auth.signInWithPassword()` (client-side cookie set), then `router.push(next)` + `router.refresh()`. The push navigates to `next` (probably `/`). The new homepage RSC fetch includes the cookie. BUT the Header now re-renders with the user, populating the UserMenu's avatar `<Link href="/u/{user}/collection">`. The Link enters the viewport → triggers a prefetch. **THIS prefetch carries the cookie correctly**, so should succeed. Yet the bug reproduces consistently after login. This suggests either: (a) the prefetch was issued BEFORE cookies finished propagating to fetch credentials, or (b) the poisoning happened on a prior session and persists in the local Router Cache across sessions (less likely — Router Cache is in-memory).
- timestamp: 2026-05-13T23:22:00Z
  observation: `src/components/layout/UserMenu.tsx:108-122`, `src/components/profile/ProfileTabs.tsx:73`, `src/components/layout/BottomNav.tsx:151` — all three navigation paths to `/u/{username}/{tab}` use bare `<Link href={...}>` with default `prefetch="auto"`. No prefetch-opt-out anywhere. These are exactly the entry points that 404 per the repro steps.
- timestamp: 2026-05-13T23:23:00Z
  observation: `https://horlo.app/` returns 307 to `https://www.horlo.app/` (verified via `curl -sI`). Apex→www redirect at Vercel/DNS level. If the user signed in on the apex domain (or had cookies scoped only to `www.horlo.app`), there could be a transient cookie-domain mismatch on first nav. But this is unlikely the primary cause since the user is on `www.horlo.app` when they captured the valid RSC response.
- timestamp: 2026-05-13T23:24:00Z
  observation: Knowledge base entry (`.planning/debug/knowledge-base.md`) describes a prior Next 16 cache bug — `revalidateTag` vs `updateTag` semantics — and the fix involved understanding that SWR (`revalidateTag(..., 'max')`) does NOT bundle a fresh RSC payload, while `updateTag(...)` does (commits its writes immediately). The 404-on-soft-nav symptom is a different shape (read-side cache hit on a stale entry, not write-side staleness), but the same family of Next 16 cache-timing pitfalls.
- timestamp: 2026-05-13T23:25:00Z
  observation: Tab-trigger 404 ("Click Wishlist tab → 404") confirms this is NOT just about the top-nav UserMenu link. ProfileTabs (`src/components/profile/ProfileTabs.tsx`) also prefetches each tab `<Link>` on viewport entry. Once the user is ON the profile page (after refresh), the tab links are in viewport and get prefetched. Clicking goes back to 404 → router cache poisoned for `/u/{user}/wishlist`. Same poisoning mechanism, broader surface.
- timestamp: 2026-05-14T00:25:00Z
  observation: **Option A (just-add-loading.tsx) blocked by layout architecture.** Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md:88,90-95` carefully. Two hard constraints emerge:
    1. `loading.tsx` wraps `page.js` and nested layouts but **NOT** the same-segment `layout.js` (line 88).
    2. With `cacheComponents: true` (which Horlo has — `next.config.ts:13`), if a layout accesses uncached/runtime data, `loading.js` will not show a fallback while that layout resolves (line 90-95). The recommended fix: move uncached fetches out of the layout, OR wrap them in `<Suspense>` inside the layout itself.
  `src/app/u/[username]/layout.tsx:22-110` performs many uncached runtime fetches (cookies, profile lookup, settings, counts, watches, wear events, follow state, common-ground overlap) at the top level — none in `<Suspense>`. So a naive `src/app/u/[username]/loading.tsx` would NOT show its fallback during prefetch because the layout itself must resolve first.
- timestamp: 2026-05-14T00:26:00Z
  observation: Read `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`. Next 16 introduces an `unstable_instant` route segment export. Setting `export const unstable_instant = { prefetch: 'static' }` on a page (or `false` on a layout to exempt it) causes Next to validate at dev and build time that every navigation entry point produces an instant static shell. Quote (line 16): "Always export `unstable_instant` from routes that should navigate instantly — it validates the caching structure at dev time and build time, catching issues before they reach users." This is the Next 16 native acceptance test for the refactor we're contemplating.
- timestamp: 2026-05-14T00:27:00Z
  observation: Build does not currently fail despite the layout's uncached data access without `<Suspense>` — meaning Next is permitting the layout to be dynamic at request time (it just blocks during navigation). The loading.md:90-95 advice ("Next.js guides you with a build-time error") applies only when `unstable_instant` is in play. Without it, the layout can be dynamic but pays the cost of blocking client-side soft navigations.
- timestamp: 2026-05-14T00:28:00Z
  observation: Reusable skeleton primitive exists at `src/components/ui/skeleton.tsx` (shadcn `<Skeleton className="animate-pulse rounded-md bg-muted" />`). Higher-level skeletons in repo: `HeaderSkeleton.tsx`, `SearchResultsSkeleton.tsx`, `WatchSearchResultsSkeleton.tsx`, `CollectionSearchResultsSkeleton.tsx`, `PhotoSkeleton.tsx`, `VerdictSkeleton.tsx`. No existing profile-shell skeleton; would need to author one (Avatar circle 96px + name placeholder + tab row of 5-6 fixed-width pills + content card placeholder).
- timestamp: 2026-05-14T00:29:00Z
  observation: Commit `2f42d00` diff confirmed: three sites carry `prefetch={false}` (UserMenu.tsx:111, ProfileTabs.tsx:73, BottomNav.tsx:158). A clean revert is `git revert 2f42d00 --no-edit` OR per-file Edit calls. The diagnostic added a `prefetch?: boolean` prop to BottomNav's NavLink — revert needs to remove that prop too.
- timestamp: 2026-05-14T14:40:00Z
  observation: **Phase 39c shipped end-to-end at fa22080 (origin/main). 39c-UAT post-deploy reports ~98% of profile-link clicks 404.** Tests 1-4 marked issue (blocker); Test 6 surfaced a separate watch-removal cache+persistence bug (out of scope for this debug session — tracked under Issue 2 in 39c-UAT.md). The structural Path-A2 refactor is in place: layout.tsx is 17 lines (verified — only Suspense + ProfileGate + ProfileShellSkeleton); profile-gate.tsx exists with `import 'server-only'`; profile-shell-resolver.tsx has `'use cache' + cacheTag + cacheLife`; unstable_instant exported from [tab]/page.tsx. So the structural pieces are present — but the bug reproduces anyway, meaning the structural fix is not sufficient on its own.
- timestamp: 2026-05-14T14:42:00Z
  observation: **proxy.ts:11-15 still gates /u/[username] on auth, no prefetch exemption.** Re-read of current state: `if (!user && !isPublic) return NextResponse.redirect(loginUrl)`. `isPublicPath` (src/lib/constants/public-paths.ts) only allows `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth` — no `/u/*`. Implication: every RSC prefetch to a profile path passes through this gate. If `supabase.auth.getUser()` returns null (any reason: cookie absent, validation fail, network blip on edge → supabase round-trip), proxy returns 307. Next 16 Router Cache stores the redirect under `/u/[username]/...` and serves it on click → 404.
- timestamp: 2026-05-14T14:43:00Z
  observation: **The 2026-05-13 "approved" sign-off was a false-positive.** Reconstruction: when the operator ran the D-39c-09 7-step protocol on 2026-05-13, Phase 39c commits existed only on local main; origin/main was still at 2f42d00 (the prefetch={false} mitigation). The operator essentially re-verified the original mitigation, not the structural fix. The actual push of 37 commits (2f42d00..ca8ea2d, later fa22080) happened LATER in the same session when the user explicitly said "Yes, push". The UAT immediately after that push surfaced the regression. Phase 39c verifier PASS at fa22080 is stale and should be considered superseded.
- timestamp: 2026-05-14T14:44:00Z
  observation: src/lib/supabase/proxy.ts:27-29 — `updateSession` calls `supabase.auth.getUser()` which is a network round-trip + token refresh. On Vercel edge or fluid compute, this is a sub-100ms call typically. But during prefetch (which fires on hover/viewport-entry), this call adds latency to every gated route. More importantly, IF `getUser()` returns null even once during the page lifecycle (e.g., supabase transient unavailable), the proxy 307s and the cache poisons.
- timestamp: 2026-05-14T14:55:00Z
  observation: **User-reported network-speed correlation (strongly supports prefetch-poisoning hypothesis).** Mobile cell-data session passes ~10% of clicks (vs ~2% on desktop wifi). Slower network = fewer prefetches complete in time = less Router Cache pre-population = more clicks fall through to a fresh fetch = fewer 404s. Inverse correlation between prefetch completion and bug rate. This is a textbook "race won by the cache poisoner on fast networks" signature.
- timestamp: 2026-05-14T14:56:00Z
  observation: **Page refresh NEVER 404s (user-confirmed).** Full document navigation skips the Router Cache entirely. Proxy sees the cookie on the full-doc request, falls through, Next renders the page → works. This confirms the bug lives in the Router Cache layer, not in the server-side route logic. Server-side rendering of `/u/[username]/collection` is healthy when reached directly.
- timestamp: 2026-05-14T14:57:00Z
  observation: **SECOND FAILURE MODE — infinite skeleton (user-reported).** On the ~10% of mobile clicks that DON'T 404, the static shell (ProfileShellSkeleton via Suspense fallback in layout.tsx) renders correctly but the dynamic content never streams in. Indefinite skeleton state. This means: (a) Phase 39c's Path-A2 refactor IS working at the shell-render layer (the static shell prerenders + streams to the client correctly); (b) something inside `ProfileGate` or `ProfileShellResolver` either hangs or fails to stream when invoked on the click-time RSC fetch. Most likely culprits: `getCurrentUser()` hanging (supabase auth round-trip blocked during RSC streaming context), `ProfileShellResolver`'s 'use cache' lookup blocking on a cache-miss that can't compute (DB unreachable from edge/fluid runtime?), or RSC stream cut mid-response. The two failure modes (404 cache-poison vs infinite-skeleton stream-hang) may share a root cause (proxy interference) OR may be independent bugs that happen to coexist.
- timestamp: 2026-05-14T15:05:00Z
  observation: **CAPTURE A — P1 (proxy-intercept) REFUTED.** Hover-prefetch of `/u/twwaneka/collection?_rsc=1kl4s` returned **Status 200 OK** (not 307). `Cache-Control: public, max-age=0, must-revalidate`. Response body is a pure Next 16 segment-tree payload — resource hints (`HL[…]` rows for css + woff2 fonts) followed by row `0:` with `{tree: {…segment hierarchy…}, staleTime: 300, buildId: "4GshjGLop1GEGMNOYQDgw"}`. NO content rows (`J:`, `D:`, `L:`). This is exactly what `unstable_instant = { prefetch: 'static' }` is documented to produce: a tree-only prefetch that tells the router "this URL exists, here's its segment structure" — actual content is supposed to be fetched on click. Proxy is letting prefetches through with valid auth, and Phase 39c's static-shell prerender is working at the prefetch layer. The cache poisoning hypothesis based on a 307 was wrong.
- timestamp: 2026-05-14T15:06:00Z
  observation: **CAPTURE B — infinite-skeleton path Network panel evidence.** User clicked the "worn" tab and saw infinite skeleton. Network panel shows ~25 RSC requests, ALL completing (200 or 304) within ~2 seconds. None pending. No console errors. Notably:
    - Many `collection?_rsc=…` and `worn?_rsc=…` requests with different RSC tokens (5x collection, 4x worn) — these are likely sibling-tab prefetches re-issued at click time
    - `worn?_rsc=yo8s5` is the largest at **2.5 kB** — suspiciously small for a "real content" RSC payload (a WornCalendar + WornList + HorizontalBarChart tree should be at least 5–20 kB)
    - All other `worn?_rsc=…` responses are 0.6–1.0 kB (tree-only sized)
    - Several `new?returnTo=%2Fu%2Ftwwaneka%2Fworn&_rsc=…` requests (304) — prefetches of `/watch/new` CTA links
  Interpretation: the click-time RSC fetch appears to ALSO return a tree-only payload (~2.5 kB max), not the full dynamic body. The page renders the static shell from the cached tree, then waits for content that never arrives because the click-time request also returned just tree. Network is healthy, server is responsive, but the body content is missing from every response.
- timestamp: 2026-05-14T15:08:00Z
  observation: **REFINED HYPOTHESIS (P2) — `unstable_instant` config misclassifies the dynamic body as static.** The combination on `[tab]/page.tsx`:
    ```
    export const unstable_instant = {
      prefetch: 'static',
      samples: [{ params: { username: 'twwaneka', tab: 'collection' } }],
      unstable_disableBuildValidation: true,
    }
    ```
  with `prefetch: 'static'` may be telling Next 16 "this entire route is statically prefetchable" — collapsing the dynamic body's RSC into the tree-only response. Both the hover-prefetch AND the click-time fetch then return tree-only because Next thinks the segment IS the static shell. Combined with `unstable_disableBuildValidation: true` (which skipped Vercel build-time validation), there's no prerendered dynamic-body fallback for the runtime to serve. The static shell prerenders fine (we see it), but there's no signal to the router that a *second-stage content fetch* is needed.
  Possible fixes (need verification):
    - Drop `unstable_instant` entirely — let Next 16's default partial-prefetch behavior apply
    - Set `prefetch: 'partial'` instead of `'static'` (if the API supports it — needs doc check)
    - Move `unstable_instant` from `[tab]/page.tsx` to `layout.tsx` and configure differently (the static shell IS the layout's Suspense fallback; the page itself isn't static)
  All three are testable in a single deploy. We need server-side log evidence first to confirm the click-time RSC body is missing dynamic-segment content.

eliminated_2026_05_14:
  - **P1 — proxy 307s prefetches → Router Cache poisoning:** Capture A returned 200 with tree-only RSC payload. Proxy let it through with valid auth. The 404 outcome must come from somewhere else.

## Eliminated

- middleware/proxy intercepting prefetch differently: src/proxy.ts:5-23 has no header-based branching. Same code path for full and prefetch requests.
- `notFound()` firing on server: user's captured RSC payload contains the correct CollectionTabContent, so server-side resolution succeeded. The 404 is client-side.
- Missing `loading.tsx` causing a build-time 404: Next.js doesn't 404 dynamic routes without `loading.tsx` — it just skips/partials the prefetch.
- Parallel-route `default.js` requirement (Next 16): no parallel routes exist in this codebase (`find -name "@*" -type d` returned empty).
- Username case mismatch: `getProfileByUsername` uses `lower(username) = lower(${username})` so case is handled. The user's username is `twwaneka_test` (already lowercase).
- **Just-add-loading.tsx as proper fix** (2026-05-14): adding `src/app/u/[username]/loading.tsx` (or `[tab]/loading.tsx`) without touching the layout will NOT enable partial prefetching because the same-segment layout's uncached data fetches block the loading fallback. Per `loading.md:88,90-95`.

## Resolution

root_cause: **Next.js 16 Router-Cache poisoning from a stale prefetch entry.** The Top-nav `<Link href="/u/{username}/collection">` (and ProfileTabs tab `<Link>`s) use default `prefetch="auto"`. Prefetching runs in prod only (Next docs link.md:298). At some point during the user's session — most likely during the login → homepage hop where the Header re-renders with the freshly-resolved username and the avatar Link mounts before auth cookies are fully attached to outbound fetches — the prefetch issues an RSC request without (or with a stale) auth cookie. The proxy (`src/proxy.ts:11-15`) responds 307 → `/login`, which Next.js 16's overhauled router caches as a not-found / unreachable entry keyed on the original `/u/{username}/collection` pathname. On subsequent clicks, the router serves the cached unreachable entry without re-fetching → browser shows 404. Hard refresh bypasses the Router Cache entirely → fresh request with cookies → server returns valid 200 RSC → page renders.

fix:
  - **Mitigation (deployed at commit 2f42d00, verified working in prod):** `prefetch={false}` on three Link sites (UserMenu avatar, ProfileTabs tabs, BottomNav Profile). Stops the prefetch from issuing → no poisoning → no 404.
  - **Proper fix (TBD — three candidate paths, see Current Focus):** refactor `src/app/u/[username]/layout.tsx` so its uncached data fetches no longer block the static shell. Then `src/app/u/[username]/loading.tsx` will actually have a fallback to show during prefetch.
    - Path A1: Suspense-wrap uncached fetches inside the layout.
    - Path A2: move data fetching from layout to page; layout becomes a static shell.
    - Path A3: hybrid — Suspense-wrap viewer-dependent data; keep username→profile lookup at the top of the layout (it's the gating signal).
  - **Root-cause hardening (deferred):** `src/app/login/login-form.tsx:32-33` — `router.push(next); router.refresh()` sequence may issue prefetches before the supabase cookie has fully propagated. Worth investigating after the layout refactor lands.
verification:
  - **Mitigation verified in prod 2026-05-13:** signed-in user clicks Profile in top nav → lands on `/u/{username}/collection` without 404. Click any tab → loads that tab. All three repro paths fixed.
  - **Proper fix verification (pending):** after refactor + revert of 2f42d00, prefetching is re-enabled on all three sites; clicking still works (no 404), AND DevTools Network panel shows partial prefetch (loading skeleton RSC) on viewport entry then full content RSC on click. Optionally add `export const unstable_instant = { prefetch: 'static' }` to the [tab]/page.tsx as a build-time gate.
files_changed:
  - src/components/layout/UserMenu.tsx (mitigation — add prefetch={false} — DONE 2f42d00)
  - src/components/profile/ProfileTabs.tsx (mitigation — add prefetch={false} — DONE 2f42d00)
  - src/components/layout/BottomNav.tsx (mitigation — add prefetch={false} on Profile NavLink — DONE 2f42d00)
  - src/app/u/[username]/layout.tsx (proper fix — refactor per chosen Path A1/A2/A3)
  - src/app/u/[username]/loading.tsx (proper fix — add Suspense shell, AFTER layout refactor)
  - src/app/login/login-form.tsx (root-cause hardening — fix push/refresh ordering, deferred)

# Phase 51: Profile Route PPR Opt-Out — Research

**Researched:** 2026-05-20
**Domain:** Next.js 16 (16.2.3) Cache Components + Vercel PPR edge behavior
**Confidence:** MEDIUM-HIGH (HIGH on what Cache Components docs say; MEDIUM on why Vercel-edge diverged from `next dev`)
**Next version verified:** `node_modules/next/package.json` line 3 → `"version": "16.2.3"`

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- ❌ **Do NOT re-ship** `unstable_instant = { prefetch: 'static' }` on `[tab]/page.tsx` — recurrence-1 cause.
- ❌ **Do NOT re-ship** page-level `await connection()` alone — F2 this session (commit `b963e6a`, reverted). Was silently ignored by Vercel's prod edge despite working in `next dev`. May be a component of a larger fix but is insufficient on its own.
- ❌ **Do NOT re-ship** `prefetch={false}` on Profile-targeting Links alone — F1 this session (commit `a6f1016`, reverted). Stops prefetch poisoning but does not prevent soft-nav state-tree-keyed clicks from returning 0 bytes server-side.
- **Confirmed evidence (prod, 2026-05-20):**
  - RSC requests to `/u/[username]/[tab]` carrying `Next-Router-Prefetch: 1` OR `Next-Router-State-Tree: <encoded>` headers return **200 / 0-bytes / `x-vercel-cache: HIT` / `x-nextjs-prerender: 1`**.
  - Same route with `RSC: 1` only → **200 / 18–36 KB body**. Server CAN produce full body; PPR-aware diffing flattens to empty on partial requests.
  - `next dev` honored `await connection()` (`x-nextjs-postponed: 1`); Vercel prod edge did NOT.
- **Verification protocol locked** (curl from CONTEXT.md `<decisions>`): non-zero body required for pass.
- **Phase 39c invariants MUST be preserved** unless they collide directly with the PPR fix:
  - `viewerId` MUST NOT leak into `'use cache'`-backed scope (Pitfall 1, D-39c-03).
  - Page-level `notFound()` gates in `[tab]/page.tsx` for missing profiles, invalid tabs, common-ground privacy.
  - Common-ground hero band (`CommonGroundHeroBand`), private-profile `LockedProfileState`, per-tab `collectionPublic/wishlistPublic/notesPublic` visibility flags.
  - Cache-tag invalidation chain from server actions (numerous files call `revalidatePath('/u/[username]', 'layout')`).
- **TDD posture locked:** Regression test must be authored and committed before the code change lands. Recurrence-3 — this is the hard gate against recurrence-4.

### Claude's Discretion
- Which F3 variant (A / B / C / D / Composite) to recommend — surface tradeoffs, but the planner picks.
- Branch A vs Branch B (anon viewability vs re-gated auth) — research both branches with concrete cost/risk; operator decides during planning.
- Test shape (e2e vs Vercel-runtime contract check vs local structural assertion) — research and rank.

### Deferred Ideas (OUT OF SCOPE)
- Variant C `/w/[ref]` unified watch detail route — Phase 50.1 TODO, reconsidered at v7.0.
- v6.0 Social Interaction features.
- Broader PPR audit across other routes (`/explore`, `/search`, `/watch/[id]`).
- Cleanup of `isProfilePath()` predicate if Branch B is chosen and predicate becomes unused.
</user_constraints>

## Summary

**The Cache Components docs are explicit and authoritative on the question "what causes a route to be prerender-eligible":** any descendant of a route that calls `'use cache'` (directly or transitively) contributes its output to the static shell. `<Suspense>` boundaries are not themselves the qualifier — they signal "this subtree may suspend at request time" and define where streaming begins, but a route's prerender eligibility comes from cached descendants and from any code that completes deterministically without runtime APIs. The current `/u/[username]/[tab]` route has BOTH conditions: (1) the layout wraps `<ProfileGate>` in `<Suspense>`, and (2) `<ProfileGate>` calls `<ProfileShellResolver/>` which is `'use cache'`-backed. The layout itself only awaits `params` (which is suspended by the `<Suspense>` boundary), so the layout has no other runtime-data sources blocking prerender.

**The Next 16 + Vercel CDN topology turns this prerender qualification into the 0-byte bug:** Vercel uses the "CDN Shell + Origin Compute" model (`ppr-platform-guide.md:57-68`). The static shell is cached at the edge; the dynamic portion is supposed to be filled by an origin POST resume. When the page body is essentially empty (the gate returns its full subtree, but does so behind `'use cache'`), the shell IS effectively the whole body — so the prefetch-shaped or state-tree-shaped RSC response is 0 bytes (just the shell skeleton structure, no dynamic content to resume). The router cache stores that, and soft-nav reads it → 404.

**Primary recommendation:** A composite F3-A + F3-B fix. **Move the only request-API-reading code (`getCurrentUser()` in `ProfileGate`) out of the cached subtree and inline into `[tab]/page.tsx`** while **removing the layout-level `<Suspense>` boundary** so the layout becomes a pure static shell that delegates everything else to the page. The page reads cookies via `getCurrentUser()` outside any cached scope and is wrapped per the "Working with runtime APIs" pattern (`/docs/app/getting-started/cache-components`) which forces the page to be a dynamic stream target. This makes the route non-prerender-eligible at its source — not just opted-out via `connection()` (which Vercel's edge demonstrably ignored when the layout's cached descendant was still in play). The cached `ProfileShellResolver` stays (preserving the cache-tag invalidation chain), but it is invoked from a dynamic page that already reads cookies — so its output is part of a dynamic response.

**On the dev/prod divergence:** No public Next.js GitHub issue, blog post, or doc explicitly explains why `await connection()` at the page level is honored by `next dev` but ignored by Vercel's prod edge. Best inference from the PPR Platform Guide: Vercel's edge serves the **build-time** static shell + a **build-time** postponed state pair atomically (`ppr-platform-guide.md:40-47`). If the build classified the page as PPR-eligible (because of a cached descendant rendered through the layout's Suspense boundary), the edge serves the build-time pair regardless of what the page's runtime code says. `connection()` only takes effect during render; if the edge never reaches render (serves the cached shell instead), `connection()` is dead code. **This is an inference, not a verified fact** — operator may want to file an issue.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render request/response | Next.js Route (Cache Components-aware) | Vercel Edge (PPR shell delivery) | The route's render topology determines what becomes static shell vs dynamic stream. The edge caches whatever build classifies as static. |
| Auth / viewer identity | Server Component (uncached) | — | Per `/docs/app/getting-started/cache-components` "Working with runtime APIs": components that access `cookies()` should be wrapped in `<Suspense>` and live outside cached scopes. |
| Per-username profile data | Cached Server Function (`'use cache'`) | — | Owner-scoped reads keyed on username only (D-39c-03). Lives in `ProfileShellResolver`. |
| Route opt-out from prerender | Code structure (no cached descendants OR runtime API in unwrapped scope) | `connection()` (page-level) | Next 16 + Cache Components only honors structural opt-outs; the `dynamic = 'force-dynamic'` escape hatch was removed in v16 (`route-segment-config/index.md:19`). |
| Proxy-level auth gate | Proxy (`src/proxy.ts`) — cookie-only optimistic checks | — | `authentication.md:1031` is unambiguous: Proxy must NOT do DB checks because it runs on prefetches. |
| Branch B re-gating safety | Proxy + page-level (defense in depth) | Vercel Firewall / BotID (out of scope) | Browser/edge cannot distinguish "RSC prefetch" from "browser nav" via headers in proxy — Next strips `next-router-prefetch` from `request.headers` (`proxy.md:438`). |

## Candidate F3 Ranking

| Variant | Effectiveness | Cost | Risk to Phase 39c | Recommendation (1=top) |
|---------|--------------|------|-------------------|------------------------|
| **F3-A** (Remove layout Suspense) | MEDIUM — necessary but not sufficient if the cached `ProfileShellResolver` descendant continues to contribute to the static shell. | LOW — 1-file edit; small TTFB loss (no shell-first skeleton). | LOW — `ProfileTabContentSkeleton` from `loading.tsx` still covers tab-switch. | 3 (as standalone) |
| **F3-B** (Move Suspense into page) | MEDIUM — same caveat as F3-A: still leaves the cached subtree as a potential static-shell contributor. | MEDIUM — restructures the page to own its suspension. | MEDIUM — page must coordinate skeleton with gate; risk of duplicate render of header. | 4 (as standalone) |
| **F3-C** (Remove `'use cache'` from resolver) | HIGH-to-CERTAIN — kills prerender eligibility at the source (no cached descendant → no static shell to cache → no 0-byte prefetch). | HIGH — every request roundtrips to Supabase for profile + settings + counts + watches + wear events (5 queries via `Promise.all`). 300s cache window is lost. Cache-tag invalidation chain (`revalidatePath('/u/[username]', 'layout')` from 6+ server actions) becomes a no-op — must be audited. | HIGH — removes the cache infrastructure 39c shipped (D-39c-03). | 5 (last resort; degrades 39c performance investment) |
| **F3-D** (Vercel-level / route-segment opt-out) | UNKNOWN-to-LOW — no documented mechanism. `dynamic = 'force-dynamic'` was REMOVED in v16 [VERIFIED: `route-segment-config/index.md:19`]. `runtime = 'edge'` is not supported by Cache Components [VERIFIED: `migrating-to-cache-components.md:175`]. | LOW if available; INFINITE if not. | LOW. | Drop from consideration unless operator finds a Vercel platform lever. |
| **F3-Composite (A + page-level dynamic API access)** | HIGH — combines layout-shell-collapse with page-level runtime API access (`getCurrentUser()` or `await connection()` outside any cached descendant) to make the page itself the dynamic stream target. The cached resolver stays for DB performance but is invoked from a dynamic page render context. | MEDIUM — page restructure + layout Suspense removal; preserves cache-tag chain. | LOW-MEDIUM — Phase 39c's "viewer outside cache" invariant is REINFORCED, not violated. | **1 (top recommendation)** |
| **F3-A + F3-C (Suspense + cache removal)** | CERTAIN. | VERY HIGH — combines TTFB loss with DB roundtrip on every request. | HIGH (same as F3-C). | 2 (fallback if F3-Composite proves insufficient on prod) |

**Why F3-Composite is top:** It is the only variant that simultaneously (a) preserves the Phase 39c cache-tag invalidation chain (the resolver and its `cacheTag('profile:${username}')` stay), (b) follows the explicit Next 16 Cache Components pattern for "Working with runtime APIs" verbatim, and (c) provides structural rather than runtime opt-out. The structural change is what `next build` validates at build time — so the prerender classification is set in the build artifact (not flipped at request time by `connection()`, which Vercel's edge appears not to honor when a cached descendant exists).

## Per-Variant Deep Dive

### F3-A: Remove layout-level `<Suspense fallback={<ProfileShellSkeleton/>}>` boundary

**Q1: Per Cache Components docs, does removing the layout Suspense around a `'use cache'`-backed child actually disable PPR qualification for the child route?**

PARTIAL. Per `/docs/app/getting-started/cache-components` (`Caching` guide):

> "`<Suspense>` provides a fallback UI while async work completes, but it does not itself opt a component into dynamic rendering. If a component only performs synchronous work, it will complete during prerendering regardless of whether it is wrapped in `<Suspense>`."

[CITED: nextjs.org/docs/app/getting-started/caching — "Streaming uncached data"]

The corollary: removing the `<Suspense>` does not by itself remove prerender qualification. What removes qualification is whether *the page produces any uncached output that the static shell cannot include*. With `'use cache'` still on `ProfileShellResolver`, the resolver's output is still cacheable and contributes to the static shell.

**Q2: TTFB cost?**

Currently: layout renders → static shell (with skeleton) streams immediately → `ProfileGate` resolves → swap in. Removing Suspense: layout renders → blocks until `ProfileGate` resolves → emit. On a warm cache hit (within 300s `cacheLife`), the resolver is in-memory — sub-millisecond. On a cold cache miss, ~3–5 DB queries via `Promise.all` (`getProfileByUsername` + `getProfileSettings` + `getFollowerCounts` + `getWatchesByUser` + `getAllWearEventsByUser`). Estimated cold TTFB delta: +100–400ms vs warm cache. With Activity preserving prior route DOM, the perceived impact is small for tab switches.

**Q3: Phase 39c invariants that depend on the layout Suspense (besides TTFB)?**

The `ProfileShellSkeleton` exists specifically as the fallback. If the layout's `<Suspense>` is removed, that skeleton is unused (but `ProfileTabContentSkeleton` from `loading.tsx` still covers tab-segment navigations per the comment at `loading.tsx:8-13`). No other 39c invariant depends on layout-level Suspense — `ProfileShellSkeleton.tsx` is purely a UX detail.

**Q4: Migration path?**

Single-file edit in `src/app/u/[username]/layout.tsx` — remove `<Suspense>` wrapper, render `<ProfileGate>` directly. `ProfileShellSkeleton` becomes dead code (delete or retain for `loading.tsx`-style boundaries). No ripples through children.

---

### F3-B: Move `<Suspense>` boundary down from layout into page

**Q1: Does the engine treat a page-owned Suspense differently from a layout-owned Suspense?**

The location of the Suspense doesn't change what is prerendered. From the same Cache Components doc:

> "At build time, Next.js renders your route's component tree. How each component is handled depends on the APIs it uses:
> - `use cache`: the result is cached and included in the static shell
> - `<Suspense>`: fallback UI is included in the static shell while the content streams at request time
> - Deterministic operations: like pure computations and module imports are automatically included in the static shell"

[CITED: nextjs.org/docs/app/getting-started/caching — "How rendering works"]

So a `<Suspense>` in the page or in the layout both contribute their **fallback** to the static shell; the *content* streams. The route is still PPR-eligible either way.

**Q2: Would the layout become a thin static shell?**

Yes — the layout file already only awaits `params` and renders the wrapper `<main>` + children. With the Suspense + ProfileGate machinery moved to the page, the layout's static-shell contribution would just be the `<main>` chrome element. That IS what Phase 39c's stated D-39c design intends. But this does NOT change PPR eligibility of the route — the page now owns the cached subtree.

**Q3: Does it preserve Phase 39c's ProfileGate locked-branch / common-ground hero band rendering?**

The gate logic must be invoked somewhere. Moving it from layout to page means: the page imports and renders `<ProfileGate>{tabContent}</ProfileGate>`. Locked-branch and common-ground rendering happen inside the gate, so they stay correct. The risk: every tab page now imports the gate; if you have ~7 tab paths they all need the same composition. Lower risk: keep the gate in the layout but remove the Suspense around it.

**Q4: Ripples?**

The change ripples through `page.tsx` and `[tab]/page.tsx` (must own the gate composition). `profile-gate.tsx` stays unchanged. Layout becomes a 5-line static wrapper.

---

### F3-C: Remove `'use cache'` from `ProfileShellResolver`

**Q1: Does this alone disable PPR qualification, or does the layout's `<Suspense>` keep the route PPR-eligible regardless?**

LIKELY YES — disables PPR qualification at the source. Per the Cache Components doc's "How rendering works" section, the static shell is composed of (`use cache` results) + (`<Suspense>` fallbacks) + (deterministic operations). Remove the `'use cache'`, and the resolver becomes an "uncached data" call that, if not inside a `<Suspense>` boundary, will trigger a build-time error per the `/docs/messages/blocking-route` doc:

> "When the `cacheComponents` feature is enabled, Next.js expects a parent `Suspense` boundary around any component that awaits data that should be accessed on every user request."

[CITED: nextjs.org/docs/messages/blocking-route]

So removing `'use cache'` *requires* keeping the wrapping `<Suspense>` (otherwise `next build` fails). The route remains a stream target — but now the streamed content is fresh from the DB on every request, not a cached blob. The static shell is just the Suspense fallback skeleton — the same shape as today's 0-byte bug. **This means F3-C alone may not change the symptom** — the 0-byte body is exactly the Suspense fallback already, so removing the cache may produce the SAME edge behavior with worse performance.

**Q2: Cost?**

Per resolver invocation: 5 queries (1 sequential + 4 in `Promise.all` per `profile-shell-resolver.tsx:36-41`). With current 300s cacheLife, a popular profile gets 1 query batch per 5 minutes; without cache, 1 batch per RSC request. Assuming ~10 RSC requests per profile pageview (initial + ~6 tab prefetches + tab clicks), and ~100 daily pageviews for a popular profile, that's ~1000 query batches/day instead of ~288 (one per 5 minutes). 3.5× DB load increase per profile.

**Q3: Is the per-username cache replaceable with React's `cache()`?**

YES, partially. React's `cache()` provides request-deduplication within a single render — so the layout, the page, and any nested components calling `ProfileShellResolver({ username })` in the same request would share one result. But it does NOT cache across requests. Useful as a request-deduplication helper alongside removing `'use cache'`, but it does not replace the cross-request caching benefit.

**Q4: Does removing `'use cache'` break the cache-tag invalidation chain?**

YES. `cacheTag('profile:${username}')` only has meaning when `'use cache'` is present. Without it, `revalidatePath('/u/[username]', 'layout')` calls from `watches.ts`, `notes.ts`, `profile.ts`, `follows.ts`, `divestments.ts`, `account.ts` become no-ops (well, they revalidate the page render but nothing is cached to invalidate). This means the cache-tag wiring done in Plan 39c-05 becomes dead code. Audit all `revalidatePath('/u/[username]', 'layout')` call sites and convert to `revalidatePath('/u/[username]/[tab]', 'page')` if needed, or remove.

---

### F3-D: Vercel-level / route-segment PPR opt-out

**Q1: Search for a documented per-route PPR opt-out mechanism in `vercel.ts` or via headers.**

NONE FOUND in Vercel's public docs (WebSearch surfaced no such mechanism as of 2026-05). The Next 16 route segment config docs explicitly state that the v15-era opt-outs are GONE:

> "`dynamic`, `dynamicParams`, `revalidate`, and `fetchCache` removed when Cache Components is enabled."
[VERIFIED: `route-segment-config/index.md:19`, Next 16.2.3]

> "`export const experimental_ppr = true` removed. A codemod is available."
[VERIFIED: `route-segment-config/index.md:20`, Next 16.2.3]

**Q2: Is there a `runtime` or `dynamic` config that Vercel honors specifically for the edge PPR layer that differs from Next's `dynamic = 'force-dynamic'`?**

NO. `runtime = 'edge'` is "Not supported" with Cache Components — "Cache Components requires the Node.js runtime" [VERIFIED: `migrating-to-cache-components.md:175`]. So you cannot opt this route into a different runtime to bypass PPR.

**Q3: Vercel config to disable the edge prerender cache for a route while keeping Next's local cache behavior?**

NONE FOUND. Vercel's edge cache for PPR follows the PPR Platform Guide model: shell + postponedState are atomic build artifacts. There is no documented header or `vercel.json` config to selectively disable the edge cache for one PPR route.

**Conclusion:** F3-D is a dead end. Operator may file a Vercel feature request, but no current lever exists.

---

### F3-Composite (recommended): Layout-shell-collapse + page-owned runtime API access

**Shape:**

1. **`src/app/u/[username]/layout.tsx`:** Reduce to a pure shell — `<main>{children}</main>`. No `<Suspense>`, no `<ProfileGate>`. The layout becomes a deterministic operation (no async, no cookies, no fetches) and is fully prerenderable as static.

2. **`src/app/u/[username]/[tab]/page.tsx`:**
   - At the top of the body: `await getCurrentUser().catch(() => null)` (already there) — but this is now the FIRST async call, before any cached resolver call.
   - Render the page's own `<Suspense fallback={<ProfileShellSkeleton/>}>` around `<ProfileGate username={username} viewerId={viewerId}>{tabContent}</ProfileGate>` — gate takes viewerId as a prop (no internal cookie read).
   - The page reads cookies (`getCurrentUser`), so it is "Working with runtime APIs" per `getting-started/cache-components`. The page itself is a stream target.
   - `ProfileShellResolver` stays exactly as it is.

3. **`src/app/u/[username]/profile-gate.tsx`:** Accept `viewerId: string | null` as a prop instead of calling `getCurrentUser()` internally. The gate becomes a pure async function of `(username, viewerId)`. The cached `ProfileShellResolver` is still called from inside the gate.

4. **`src/app/u/[username]/page.tsx` (bare-username):** Reading the PPR Platform Guide observation — the bare-username `redirect()` is being prerendered to a cached 200. Per the redirect docs: "When used in a streaming context, this will insert a meta tag to emit the redirect on the client side." That meta-tag redirect is exactly what's cached. **Fix:** Add `await connection()` at top to force per-request execution, OR convert to use a `next.config.ts` `redirects()` rule (preferred — built-in redirects are checked before routing and aren't subject to PPR). Documenting both options for the planner.

**Why this works where page-level `connection()` alone failed:** the page is now the FIRST async-runtime-API consumer in the route's render path. There is no parent component above it that contributes cached output to a static shell. The build classifies the page as dynamic (no cached descendants UP THE TREE; the cached `ProfileShellResolver` is INSIDE the dynamic page render, so its output is part of a dynamic response). Vercel's edge has no static shell for this route to serve — every request must hit origin compute.

**Risk to Phase 39c invariants:**
- D-39c-03 (viewer-out-of-cache) — REINFORCED. The gate becomes a pure function of (username, viewerId).
- D-39c-05 (cache-tag invalidation chain) — UNCHANGED. The cached resolver still has `cacheTag('profile:${username}')`.
- D-39c-06 (loading.tsx + skeleton) — `loading.tsx` continues to provide the tab-switch skeleton. `ProfileShellSkeleton` becomes the page-level fallback.
- D-39c-09 (locked-branch correct rendering) — UNCHANGED. The gate's locked-branch short-circuit still happens inside the gate body.

---

## Open Question: dev vs prod-edge divergence

**Question:** Why did `await connection()` work in `next dev` (returned `x-nextjs-postponed: 1`) but Vercel's prod edge ignored it (returned `x-nextjs-prerender: 1` + `x-vercel-cache: HIT` + 0-byte body)?

**Best inference (UNVERIFIED — no public source explicitly confirms):**

Per the PPR Platform Guide (`ppr-platform-guide.md:38-47`):

> "Each PPR route requires two artifacts to be stored together:
> 1. The static HTML shell.
> 2. The `postponedState` blob.
>
> These must be stored and updated atomically."

And `ppr-platform-guide.md:57-68` (CDN Shell + Origin Compute):

> "For better TTFB, the static HTML shell can be cached at the CDN edge. When a request arrives:
> 1. The CDN serves the cached shell immediately (edge latency).
> 2. The CDN sends a resume request to the origin server (ideally in parallel with streaming the shell)."

**Inference:** At build time, Vercel's adapter inspected the build output, saw `renderingMode: 'PARTIALLY_STATIC'` for `/u/[username]/[tab]`, and stored the shell + postponedState pair. At request time on prod, the edge served the shell from cache, then attempted to resume from origin. The page's `await connection()` would only take effect inside the resume render — but if the resume produced an empty body (because the cached resolver's content was ALREADY in the shell, leaving nothing dynamic to stream), the response body is the shell + nothing = 0 bytes for the prefetch-shaped request.

`next dev` does NOT use the CDN-shell topology; it always re-renders from source (`ppr-platform-guide.md:71-75` describes the resume protocol used in deployed-origin topology, not in `next start` / `next dev`). So `connection()` at the page level effectively made the route dynamic in dev because the dev server doesn't cache build artifacts.

**WebSearch returned NO Vercel-specific GitHub issues** matching the symptom (`connection()` honored locally but not on Vercel edge for cookie-reading PPR routes). The closest related issues:
- [GitHub issue #86182 — Navigation blocked/delayed by prefetch in Next.js 16 CacheComponents](https://github.com/vercel/next.js/issues/86182) — different bug (multiple prefetch requests block nav), but signals general flux in Next 16 prefetch behavior.
- [GitHub issue #85248 — Prefetching broken in Next.js v16](https://github.com/vercel/next.js/issues/85248) — closed without resolution detail. Different symptom (prefetch network request never made).
- [Discussion #89160 — Multiple issues after migrating to Cache Components](https://github.com/vercel/next.js/discussions/89160) — about form state / Activity component, not relevant.

**Recommendation for the planner:** Treat the divergence as the BUG that F3-Composite fixes structurally rather than as a separate thing to debug. The build-time PPR classification is what locks in the bad behavior; structural changes that prevent the build from classifying the route as PPR-eligible are the only reliable opt-out. Consider filing a Next.js issue with the verification curl, the layout/page/resolver code, and the dev/prod divergence — but do not BLOCK Phase 51 on that. If the planner wants to invest extra effort: add `NEXT_PRIVATE_DEBUG_CACHE=1` to a Vercel preview deploy to capture the build-time cache classification log (Cache Components doc → "Debugging cache behavior").

## Branch B Safety Analysis (re-gating `/u/*` to authenticated viewers)

**Q1: Re-read the recurrence-2 fix file.** Recurrence-2 root cause: `src/lib/supabase/proxy.ts:updateSession` calls `supabase.auth.getUser()` — a DB round-trip — on every proxy invocation including RSC prefetches. When that returns null (race or transient), proxy returns 307 → /login. Router Cache stored the 307; subsequent soft-navs read it → 404. The fix was to bypass the auth gate for `/u/*` (commit `5def872`).

**Q2: Per `authentication.md:1031`, safe patterns for proxy-level auth gating that do NOT cause Router Cache poisoning on prefetch:**

> "However, since Proxy runs on every route, including prefetched routes, it's important to only read the session from the cookie (optimistic checks), and avoid database checks to prevent performance issues."
[VERIFIED: `authentication.md:1031`, Next 16.2.3]

The Next 16 example pattern (`authentication.md:1035-1075`) does:
1. Read the encrypted session cookie (`(await cookies()).get('session')?.value`)
2. Decrypt it locally (no network)
3. Branch on `session?.userId` presence

The **safe path for Branch B** is: keep `updateSession` for cookie freshness if needed, but do NOT call `supabase.auth.getUser()` (the network call). Instead use Supabase's **`getSession()`** (reads decrypted JWT from cookie, no network) or read the access token cookie directly. The auth gate then becomes:

```ts
// pseudocode for the proxy auth gate (Branch B)
const accessToken = request.cookies.get('sb-access-token')?.value
const isAuthed = accessToken && !isExpired(accessToken) // optimistic — no network
if (!isAuthed && !isPublic) return redirectToLogin(...)
```

The token can be a forgery (Supabase verifies on the page side via `getUser()` for sensitive operations) — but for the gate, optimistic check is correct.

**Q3: Pattern that uses `Next-Router-Prefetch` header detection?**

NOT VIABLE.

> "During RSC requests, Next.js strips internal Flight headers from the `request` instance in Proxy. For example, headers like `rsc`, `next-router-state-tree`, and `next-router-prefetch` are not exposed through `request.headers`. This is to prevent accidentally handling an RSC request differently than the HTML request as both need to align."
[VERIFIED: `proxy.md:438`, Next 16.2.3]

So you CANNOT detect "this is a prefetch request" inside the proxy. The 307 → /login on a cookie-less prefetch will poison the cache REGARDLESS of whether you try to inspect the prefetch header. The only Vercel-safe way is to never issue a 307 at proxy level on a route whose 307 you cannot afford to cache.

**Q4: Vercel BotID / firewall / edge config?**

Vercel offers Firewall Rules and BotID at the edge, BEFORE proxy.ts runs. These can return a redirect, block, or rewrite a request without invoking the Next.js app at all. **However:** any 307 response (including from edge firewall) is also potentially cacheable in the Router Cache if it carries cacheable headers. Vercel Firewall responses can set `Cache-Control: private, no-store` which prevents Router Cache storage. This is a viable Branch B path — but requires operator-level Vercel project access to configure, and is outside the codebase change scope.

**Branch B verdict:** SAFE IF AND ONLY IF the proxy uses a cookie-only optimistic check (no `getUser()` network round-trip) AND any 307 response sets `Cache-Control: no-store` to prevent Router Cache storage. The cookie-only refactor is a 10-line change in `src/lib/supabase/proxy.ts`. The Branch B re-gate is then a 2-line change to `src/proxy.ts` (remove `!isProfile` from the auth-gate predicate) and the deletion of `isProfilePath()` in `src/lib/constants/public-paths.ts`.

**Branch B recommendation:** VIABLE for Phase 51, but adds scope. If operator wants Branch B, plan should include a "convert proxy auth check to cookie-only" task BEFORE the re-gate task. If operator does not need Branch B urgently, Branch A is the lower-scope choice and the project can revisit re-gating in a later phase. **Operator should NOT pick Branch B without the cookie-only refactor — re-gating without it reintroduces the recurrence-2 cause.**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (per `tests/profile-route-dynamic.test.ts` reference in debug log) |
| Config file | Not located in this research; planner should confirm via `find tests vitest.config.* package.json` |
| Quick run command | `npx vitest run tests/profile-route-51.test.ts` (proposed regression test) |
| Full suite command | `npx vitest run` |
| Prod contract check | `bash scripts/verify-phase-51-prod.sh` (proposed; wraps the CONTEXT.md curl) |

### Phase Requirements → Test Map

The CONTEXT.md does not assign requirement IDs. Use these proposed IDs derived from the locked decisions:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-51-01 | State-tree-aware RSC request to `/u/[username]/[tab]` returns non-empty body on prod | prod contract | `bash scripts/verify-phase-51-prod.sh` (post-deploy) | ❌ Wave 0 |
| REQ-51-02 | Prefetch-headed RSC request to `/u/[username]/[tab]` returns either non-empty body or `x-nextjs-postponed: 1` | prod contract | (same script, additional curl) | ❌ Wave 0 |
| REQ-51-03 | Local build artifact: `/u/[username]/[tab]` is NOT in the prerender output (or has no `postponedState` for the page body) | local structural | `node scripts/assert-phase-51-build.mjs` (proposed; reads `.next/server/app/u/[username]/[tab]/...` and asserts) | ❌ Wave 0 |
| REQ-51-04 | Layout file does NOT contain `<Suspense fallback={<ProfileShellSkeleton/>}>` wrapping `<ProfileGate>` (structural lock per F3-A) | unit | `npx vitest run tests/profile-route-51.test.ts -t "layout has no Suspense around gate"` | ❌ Wave 0 |
| REQ-51-05 | `ProfileGate` accepts `viewerId` as a prop (no internal `getCurrentUser()` call), preserving Phase 39c Pitfall 1 invariant (F3-Composite shape) | unit | `npx vitest run tests/profile-route-51.test.ts -t "gate accepts viewerId prop"` | ❌ Wave 0 |
| REQ-51-06 | `ProfileShellResolver` still has `'use cache'` + `cacheTag('profile:${username}')` (Phase 39c invariant) | unit | `npx vitest run tests/profile-route-51.test.ts -t "resolver remains cached"` | ❌ Wave 0 |
| REQ-51-07 (Branch B only) | Anon viewer to `/u/[public_user]/collection` receives a 307 with `Cache-Control` that prevents Router Cache storage | prod contract | extension of `verify-phase-51-prod.sh` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/profile-route-51.test.ts` (REQ-51-04, -05, -06)
- **Per wave merge:** `npx vitest run` + `npm run build` (REQ-51-03 via structural check)
- **Phase gate:** Deploy preview to Vercel + run `bash scripts/verify-phase-51-prod.sh` against the preview URL (REQ-51-01, -02)

### Wave 0 Gaps
- [ ] `tests/profile-route-51.test.ts` — covers REQ-51-04, -05, -06
- [ ] `scripts/verify-phase-51-prod.sh` — covers REQ-51-01, -02, -07
- [ ] `scripts/assert-phase-51-build.mjs` — covers REQ-51-03 (local structural lock)
- [ ] Possible: `tests/profile-route-dynamic.test.ts` from F2 attempt may need to be ADAPTED or DELETED — its assertions assumed `await connection()` was the fix; F3-Composite changes those assertions.

**Distinguishing CI vs prod:**
- **Verifiable in CI:** REQ-51-03, REQ-51-04, REQ-51-05, REQ-51-06 (structural and unit).
- **Verifiable only on Vercel preview/prod:** REQ-51-01, REQ-51-02, REQ-51-07 (requires Vercel's PPR edge topology to surface the bug).

The post-deploy contract check should be a `gh workflow` or `vercel build-output` step that runs after a successful preview deploy and fails the merge if the curl returns 0 bytes.

## Risks & Open Questions

### High-priority risks

1. **F3-Composite may need preview-deployment validation BEFORE merging to main.** Recurrence 3 demonstrated that local `next start` and Vercel's prod edge can disagree. The planner should require a Vercel preview deploy as a gate before merging, with the prod contract curl run against the preview URL.

2. **Activity preservation may interact with the page restructure.** Cache Components enables React `<Activity>` for preserving DOM/state across navigations (`cacheComponents.md:32-46`). Moving Suspense from layout to page changes which subtree gets preserved. UAT should verify that tab-switch state preservation (scroll, form inputs) still works.

3. **`generateMetadata` and `generateViewport` separately track runtime data.** If the page exports either, they must also follow the runtime-API pattern (`getting-started/cache-components` "Good to know" footer). The current `[tab]/page.tsx` does not export them, but be vigilant when restructuring.

4. **The bare `/u/[username]/page.tsx` redirect is being cached.** Evidence: `x-vercel-cache: PRERENDER` per the debug log. The page does `redirect(\`/u/${username}/collection\`)` synchronously. Per the `redirect` doc: "When used in a streaming context, this will insert a meta tag to emit the redirect on the client side." That meta-tag IS being baked into the prerender. **Fix options:** (a) `await connection()` at top (same caveats as `[tab]/page.tsx` — may not work on Vercel edge), (b) move the redirect to a `next.config.ts` `redirects()` rule (preferred — checked before routing, not subject to PPR), (c) convert to a Proxy rewrite. Planner must include this in scope or explicitly defer.

### Open questions

1. **Should the Phase 51 PR include a preview-environment test gate?** Operator preference is "structural fix that prevents recurrence 4" — a Vercel preview gate enforces this without burdening every PR. Planner should propose this.

2. **Does removing the layout Suspense break the `loading.tsx` instant-loading-state contract for cold loads?** The current `loading.tsx` renders only `ProfileTabContentSkeleton` (content card placeholder) per the comment at `loading.tsx:8-13`. If the layout Suspense is removed, cold loads will block until the gate resolves — there's no "instant shell + skeleton" experience. May be acceptable given that the gate's resolver is fast on warm cache (sub-ms). Worth measuring TTFB on cold prod.

3. **Branch B viability hinges on whether Supabase Auth's `getSession()` (cookie-only) is sufficient for the proxy.** Some Supabase Auth setups require `getUser()` because session refresh logic is non-trivial. Planner should sanity-check `@supabase/ssr` to confirm `getSession()` is exposed and safe.

4. **The reverted F2 commit (`b963e6a`) added `tests/profile-route-dynamic.test.ts` with 4 specs asserting `await connection()` is present.** Phase 51 should DELETE or REWRITE this test. Don't carry over assumptions from the failed fix.

5. **Vercel may offer a "force origin" header in `vercel.json` for specific routes** (`Cache-Control: no-cache` from the route handler is one path). Not documented in the public Vercel docs at time of research — operator could verify with Vercel support. Tracked but not blocking.

## Sources

### Primary (HIGH confidence — Next 16.2.3 installed docs and current nextjs.org docs)
- `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md:11-43,175` — `dynamic = 'force-dynamic'` is "Not needed"; `runtime = 'edge'` not supported
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md:6-8` — `connection()` purpose ("rendering should wait for an incoming user request before continuing")
- `node_modules/next/dist/docs/01-app/02-guides/ppr-platform-guide.md:14-25, 38-47, 57-68` — PPR build artifact model (shell + postponedState) and CDN Shell + Origin Compute topology
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md:88, 90-95` — `loading.js` boundary placement rules
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md:316-360` — Layout/loading.js interaction; "Move uncached data fetching from `layout.js` into `page.js`" pattern
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1031` — proxy MUST NOT do DB checks on prefetched routes
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:438` — proxy CANNOT read `rsc`, `next-router-state-tree`, `next-router-prefetch` headers
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md:32-46` — Activity-based navigation
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md:251-258, 308-365` — cache lifetime defaults; route-level cache examples
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache-private.md:15-26, 163-170` — private cache directive; `connection()` is prohibited in both `'use cache'` and `'use cache: private'`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md:46-62, 105-127` — `unstable_instant` modes and `false` opt-out
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/index.md:19-20` — v16 removals (`dynamic`, `revalidate`, `fetchCache`, `experimental_ppr`)
- `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md:99-107` — page-load vs client-navigation shells differ
- [nextjs.org/docs/app/getting-started/caching](https://nextjs.org/docs/app/getting-started/caching) — "How rendering works", "Working with runtime APIs", "Opting out of the static shell"
- [nextjs.org/docs/messages/blocking-route](https://nextjs.org/docs/messages/blocking-route) — "Uncached data was accessed outside of `<Suspense>`" error semantics
- [nextjs.org/docs/app/api-reference/functions/redirect](https://nextjs.org/docs/app/api-reference/functions/redirect) — `redirect()` in streaming context inserts a meta tag

### Secondary (MEDIUM confidence — Vercel/community sources, partially verified)
- [vercel.com/academy/nextjs-foundations/cache-components](https://vercel.com/academy/nextjs-foundations/cache-components) — Vercel's framing of cacheComponents matches the official docs
- [vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them)

### Tertiary (LOW confidence — community discussions, not definitive)
- [github.com/vercel/next.js/issues/86182](https://github.com/vercel/next.js/issues/86182) — Navigation blocked by prefetch in Next 16 + CacheComponents; different bug but evidence of v16 prefetch flux
- [github.com/vercel/next.js/issues/85248](https://github.com/vercel/next.js/issues/85248) — Prefetch broken in Next 16; closed without resolution detail
- [github.com/vercel/next.js/discussions/89160](https://github.com/vercel/next.js/discussions/89160) — Multiple Cache Components migration issues; surfaces Activity-related caveats
- [github.com/vercel/next.js/discussions/85502](https://github.com/vercel/next.js/discussions/85502) — Client-component state during navigation with Cache Components

### Source files in scope (read in this research)
- `src/app/u/[username]/layout.tsx` — current layout structure (17 lines)
- `src/app/u/[username]/profile-gate.tsx` — gate with documented Phase 39c invariants
- `src/app/u/[username]/profile-shell-resolver.tsx` — `'use cache'` boundary, cacheLife 300s, cacheTag `profile:${username}`
- `src/app/u/[username]/[tab]/page.tsx` — tab page (357 lines); calls `getCurrentUser()` + `ProfileShellResolver` + tab-specific renders
- `src/app/u/[username]/page.tsx` — bare-username redirect indirector (11 lines)
- `src/app/u/[username]/loading.tsx` — loading boundary using `ProfileTabContentSkeleton`
- `src/app/u/[username]/profile-shell-skeleton.tsx` — both skeletons (full + content-only)
- `src/proxy.ts` — current auth gate with `!isProfile` bypass (line 19)
- `src/lib/constants/public-paths.ts` — `isPublicPath()` + `isProfilePath()`
- `src/lib/supabase/proxy.ts` — `updateSession` with `getUser()` network call (line 29)
- `next.config.ts` — `experimental.cacheComponents: true`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel edge's "serves static shell + attempts origin resume" model is the mechanism by which `connection()` is bypassed on prod | "Open Question: dev vs prod-edge divergence" | If wrong, F3-Composite may still produce 0-byte bodies — would need a different structural fix. Mitigation: planner enforces Vercel preview gate before merge. |
| A2 | Vitest is the test framework in use | "Validation Architecture" | If wrong, swap to whatever `package.json scripts.test` resolves to — small adjustment, doesn't change phase content. |
| A3 | F3-Composite (page-owned runtime API + layout shell collapse) prevents Vercel's build from classifying the route as PPR-eligible | "Per-Variant Deep Dive: F3-Composite" | If wrong, the fix won't work on prod even after preview-test passes. Mitigation: Vercel preview gate + structural assertion on build output. |
| A4 | Cookie-only Supabase auth check via `getSession()` is sufficient for Branch B re-gating without poisoning | "Branch B Safety Analysis" | If wrong, Branch B re-introduces recurrence-2 cause. Mitigation: do NOT pick Branch B without the cookie-only refactor task. |
| A5 | The bare-username `/u/[username]/page.tsx` redirect being cached at `x-vercel-cache: PRERENDER` is symptomatic of the same PPR classification — fixing it via a `next.config.ts` redirect rule sidesteps Cache Components | "Risks & Open Questions §4" | Low risk; even if not fixed, the bare-username path is rarely the entry point. Operator's repro uses tab clicks, not bare-username navigation. |
| A6 | No public Next.js or Vercel GitHub issue currently documents the `connection()`-vs-edge divergence | "Open Question" | None — confirmed by multiple WebSearch passes; if such an issue exists, the planner can link it as evidence. |

## Open Questions

1. **Will F3-Composite alone (without preview-deploy validation) be enough to gate the PR to main?**
   - What we know: Local `next start` does not reproduce the bug; only Vercel's prod edge does.
   - What's unclear: Can a Vercel preview deploy reliably reproduce the bug pre-merge?
   - Recommendation: PLAN must include a Vercel preview deploy + curl-verification task as a hard gate before merging F3-Composite to main.

2. **Does the operator want the bare `/u/[username]/page.tsx` redirect fixed in Phase 51 or deferred?**
   - What we know: It's being cached at the edge as a 200; the bug is real but the impact path is rarely the user's primary navigation.
   - What's unclear: Operator preference for scope.
   - Recommendation: Surface to operator during planning discussion. Default to "include" — it's a 5-line fix via `next.config.ts redirects()`.

3. **Should the F2-era `tests/profile-route-dynamic.test.ts` be deleted or rewritten in this phase?**
   - What we know: It asserts `await connection()` is present in the tab page. F3-Composite does NOT use `await connection()` as its primary lever.
   - What's unclear: Whether the operator wants test history preserved (delete) or migrated (rewrite).
   - Recommendation: DELETE and write fresh `tests/profile-route-51.test.ts` reflecting REQ-51-* above.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js | All phase work | ✓ | 16.2.3 (`node_modules/next/package.json:3`) | — |
| Vercel CLI | Preview-deploy verification | Unknown (not checked) | — | `gh workflow run` / Vercel dashboard manual deploy |
| Vitest | Unit tests | Assumed present | Unknown | If not present, use the project's test framework (planner verifies via `package.json scripts.test`) |
| curl | Prod contract verification | ✓ (macOS default) | — | `wget` / `httpie` |
| Supabase Auth (`@supabase/ssr`) | Branch B cookie-only refactor only | ✓ (project already uses it) | Unknown (planner verifies if Branch B chosen) | If `getSession()` is not viable, defer Branch B |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Vercel CLI for local-driven preview deploys — can use `gh workflow` or web dashboard.

## Project Constraints (from CLAUDE.md)

CLAUDE.md and AGENTS.md (read at the start of this research):
- **AGENTS.md (file root):** "This is NOT the Next.js you know — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices." → This research has read all the relevant Cache Components / PPR / connection / loading / layout / authentication / proxy docs from `node_modules/next/dist/docs/` directly. No reliance on pre-v16 patterns.
- **CLAUDE.md (project):**
  - Tech stack: Next.js 16 App Router, no rewrites → F3-Composite is an in-place restructure, not a framework swap.
  - Data model: Watch/UserPreferences extends-don't-break → not applicable to Phase 51.
  - Personal first: Single-user data isolation → preserved by Phase 39c invariants which Phase 51 reinforces.
  - Performance: <500 watches per user → not impacted.
- **GSD Workflow Enforcement:** This research was spawned from `/gsd-research-phase` per the orchestrator instructions; no rule violations.

## Metadata

**Confidence breakdown:**
- Standard stack / Next 16 docs: HIGH — read directly from installed `node_modules/next/dist/docs/` (16.2.3) and cross-verified with current nextjs.org docs (16.2.6 — same major.minor cycle).
- F3 variant ranking: MEDIUM-HIGH — variant effectiveness claims are anchored in Cache Components docs but the ultimate test is Vercel prod behavior.
- Dev-vs-prod divergence explanation: MEDIUM — strong inference from PPR Platform Guide, but no public source explicitly confirms the exact mechanism. Flagged as A1 assumption.
- Branch B safety: MEDIUM — relies on Supabase Auth `getSession()` being sufficient (A4 assumption); planner should verify with `@supabase/ssr` docs if Branch B is chosen.

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (or until Next.js 16.3+ ships material changes to Cache Components — check changelog before reusing)

## RESEARCH COMPLETE

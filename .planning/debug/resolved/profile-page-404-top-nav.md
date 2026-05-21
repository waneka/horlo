---
slug: profile-page-404-top-nav
status: resolved
trigger: profile page 404 on top-nav click, refresh works
created: 2026-05-13T23:00:00Z
updated: 2026-05-21
reopened_at: 2026-05-20
resolved: 2026-05-21
resolved_at: 2026-05-21
resolved_by_phase: 51
phase: 51
recurrence_3_fix_commit: 84779ae
prod_verified: 2026-05-21
prior_resolutions:
  - cf250b1 (removed unstable_instant — wrong mechanism, recurrence 1)
  - 5def872 (isProfilePath ungates /u/* in proxy — held until 2026-05-20, recurrence 2)
recurrence_count: 3
recurrence_3_attempts:
  - { id: F2, commit: b963e6a, approach: "await connection() in [tab]/page.tsx + bare /u/[username]/page.tsx", result: FAILED_PROD_VERIFICATION, reason: "Vercel edge still returned x-vercel-cache: HIT + x-nextjs-prerender: 1 + 0-byte RSC for both prefetch and soft-nav (state-tree-keyed) requests. The Cache Components opt-out was not honored at the prod edge." }
  - { id: F1, commit: a6f1016, approach: "prefetch={false} on ProfileTabs / UserMenu / BottomNav Links", result: WOULD_NOT_HAVE_WORKED, reason: "Soft-nav click responses (with Next-Router-State-Tree header) also return 0 bytes server-side — F1 only stops prefetch-poisoning, not the click-time 0-byte response that would still render as 404." }
  - { id: F3-Composite, commit: 84779ae, approach: "Phase 51 — layout collapsed to static chrome (no <Suspense> over ProfileGate); ProfileGate accepts viewerId prop; [tab]/page.tsx is the data boundary; ProfileShellResolver retains 'use cache'+cacheTag; (Branch B) proxy.ts re-gates /u/* via getSession() cookie-only + Cache-Control: no-store on 307 → /login; bare-username redirect moved from app/u/[username]/page.tsx to next.config.ts redirects()", result: PROD_VERIFIED, reason: "Structural opt-out from Cache Components PPR qualification — route is no longer prerender-eligible because the F3-A pattern (Suspense over awaited shell that consumes cookies) is gone from layout.tsx per node_modules/next/dist/docs/01-app/02-guides/cache-components.md. Verified on prod 2026-05-21 via REQ-51-07 direct curl + operator UAT (two click cycles, zero 404s)." }
revert_action: hard reset to 61cd924 + force-push (operator-approved 2026-05-20)
next_path: RESOLVED via Phase 51 F3-Composite (+ Branch B re-gate). See .planning/phases/51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta/.
---

## RECURRENCE 3 — 2026-05-21 → RESOLVED via Phase 51 F3-Composite

**Status:** Resolved. Prod verified 2026-05-21. No further action required.

**Resolution commit (deploy SHA on main):** `84779ae` — pushed via `2459a3d..84779ae main -> main`; live at https://www.horlo.app.

**Phase 51 plans that did the work:**
- **51-02** — `ProfileGate` viewerId prop refactor (the seam): `profile-gate.tsx` no longer calls `getCurrentUser()` internally; receives `viewerId` from the page boundary.
- **51-03** — F3-Composite structural change (the keystone): `src/app/u/[username]/layout.tsx` is collapsed to a pure static chrome shell — no `<Suspense fallback=…>` over `<ProfileGate>`, no async cookie reads. `src/app/u/[username]/[tab]/page.tsx` becomes the route's runtime-API consumer (`getCurrentUser()`) and the dynamic stream target; wraps the tab JSX in `<Suspense fallback={<ProfileShellSkeleton/>}><ProfileGate username viewerId>...</ProfileGate></Suspense>`. The per-tab page is now where the data boundary lives.
- **51-04** — `src/lib/supabase/proxy.ts:updateSession` switched from `getUser()` (network call) to `getSession()` (cookie-only). Per `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1031`, proxy MUST be cookie-only on prefetch routes.
- **51-05** — Re-gated `/u/*` to authenticated viewers (Branch B) + `Cache-Control: no-store` on the `307 → /login` redirect (defense in depth against Next 16 Router Cache poisoning of the redirect itself, the recurrence-2 root cause).
- **51-07** — Moved the bare `/u/[username]` → `/u/[username]/collection` redirect from a page-level `redirect()` to `next.config.ts:redirects()` (the page-level version had been cached as PRERENDER).

**Root cause (the actual mechanism):**
- Cache Components PPR qualification of `/u/[username]/[tab]` produced empty RSC bodies on state-tree-keyed (post-prefetch / soft-nav click) requests. The Vercel edge served `200 + 0 bytes + x-vercel-cache: HIT + x-nextjs-prerender: 1` for the click-shape request, which the Next 16 router interpreted as "no segment data" → renders as 404.
- The qualification source was the F3-A pattern in `layout.tsx`: a `<Suspense fallback=…>` wrapping an awaited shell that itself consumed cookies (via `ProfileGate → getCurrentUser()`). Per `node_modules/next/dist/docs/01-app/02-guides/cache-components.md`, that exact topology is the signal Next uses to mark a route partially-prerenderable.
- `'use cache'` on `ProfileShellResolver` was NOT the qualifier (and still isn't — it stayed, intentionally, because the cacheTag + revalidate-path chain is load-bearing for Phase 39c).

**Branch B (re-gate) — why the operator chose it:** the proxy now redirects anonymous `/u/*` to `/login` BEFORE the route renders, so the recurrence-3 surface area (anonymous prefetch/state-tree-keyed RSC to a PPR-classified route) cannot be reached by unauthenticated clients. Authenticated clients still hit the route; the F3-Composite structural change is what protects THEM from the same symptom.

**Production verification (2026-05-21):**
- Direct curl REQ-51-07: anon `GET /u/twwaneka/collection` → **307** with `cache-control: no-store` and `location: /login?next=%2Fu%2Ftwwaneka%2Fcollection` ✓ (Router Cache poisoning vector closed)
- Operator UAT REQ-51-01 / REQ-51-02: authenticated session, two full click cycles across all profile tabs (collection → wishlist → worn → notes → stats → insights) — **zero 404s** ✓
- Local `assert-phase-51-build.mjs` REQ-51-03: `/u/[username]/[tab]` NOT classified as `PARTIALLY_STATIC` in the build manifest ✓
- Local vitest `tests/profile-route-51.test.ts` REQ-51-04, -05, -06: structural regression contract — layout has no `<Suspense>` over `ProfileGate`; `ProfileGate` accepts `viewerId` prop; `ProfileShellResolver` retains `'use cache'` + `cacheTag` — **3/3 PASS** ✓

**Why this won't regress (the recurrence-4 gate):**
- The route is now **structurally** opt-out of Cache Components PPR at source. `layout.tsx` no longer has the F3-A topology (Suspense over awaited shell consuming cookies) — without it, Next 16 cannot classify the route as partially prerenderable.
- `tests/profile-route-51.test.ts` encodes this structural contract as three assertions: (a) layout.tsx contains no `<Suspense>` over `<ProfileGate>`; (b) `ProfileGate` accepts `viewerId` as a prop; (c) `ProfileShellResolver` keeps `'use cache'` + `cacheTag`. CI would fail if any future change reintroduces the Suspense pattern or wires cookies back into the layout.
- `scripts/assert-phase-51-build.mjs` adds a build-time check — the script parses the build manifest and exits non-zero if `/u/[username]/[tab]` reappears as `PARTIALLY_STATIC`. Run pre-merge for any future change to `/u/[username]/**`.
- (Branch B) the proxy re-gate is itself defense in depth: even if the structural opt-out somehow regressed, anonymous traffic (the recurrence-3 repro shape: incognito + paste profile URL + tab click) is redirected to `/login` and never reaches the prerender-eligibility boundary.

**Recurrence-4 prevention checklist (for the next operator who touches `/u/[username]/**`):**
1. Run `npm test` — the three structural specs in `tests/profile-route-51.test.ts` MUST pass.
2. Run `npm run build && node scripts/assert-phase-51-build.mjs` — the build manifest assertion MUST exit 0.
3. If the change touches `layout.tsx`, verify NO `<Suspense>` boundary is reintroduced over any descendant that consumes cookies / `getCurrentUser()`. Move the boundary into `[tab]/page.tsx` instead.
4. If the change touches `proxy.ts`, keep it `getSession()` cookie-only (Phase 39c Pitfall 1) and keep `Cache-Control: no-store` on any `/u/*` redirect.

**Operator UAT repro path (still authoritative as a recurrence detector):**
"Sign in. Hard reload `/u/<your-username>/collection`. Click through every profile tab in order, then again." Expected: zero 404s. As of 2026-05-21, this path PASSES on prod.

**Original session diagnostic notes follow below — preserved verbatim as authoritative reference for any future investigation.**

---

## RECURRENCE 3 — 2026-05-20 (this session — REVERTED, NEEDS F3)

### TL;DR for the next investigation
- Symptom is back (third time). Bug is at the **Vercel edge PPR + Cache Components** boundary, not the proxy and not unstable_instant.
- Two attempts shipped + reverted this session. Both have written evidence below — read them before re-attempting.
- The actual fix is **F3 (layout restructure)** which was not designed or attempted yet. F1 and F2 as defined in this file are both inadequate; do not re-ship them.
- Operator chose hard-reset over forward-fix to restore a deterministic baseline before F3 planning. Prod is now back at commit `61cd924` (pre-session state). The bug WILL recur as soon as the CDN cache populates with poisoned entries.

### Confirmed root-cause evidence (do not re-discover this)
- Curl `/u/twwaneka/wishlist?_rsc=X` with `Next-Router-Prefetch: 1` → **200, 0 bytes**, `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`. This is the prefetch shape; F1 stops the client from sending it.
- Curl `/u/twwaneka/wishlist?_rsc=X` with `Next-Router-State-Tree: <encoded>` → **200, 0 bytes**, `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`. **This is the soft-nav click shape; F1 does NOT stop the client from sending it. This is why F1 cannot work.**
- Curl `/u/twwaneka/wishlist?_rsc=X` with `RSC: 1` only (no state tree, no prefetch header) → **200, 36 KB** (full body). Server CAN return the body; it just doesn't on state-tree-aware requests.
- All requests share `vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch`. The 0-byte response is cached per `(state-tree, prefetch-flag)` combination.
- Build output shows `◐ Partial Prerender` for `/u/[username]/[tab]`. With `cacheComponents: true`, the route IS being treated as PPR-eligible. The static shell is prerendered; the dynamic body is supposed to fill in at runtime. But on the prod edge, the dynamic-body-fill response is 0 bytes, so the state-tree-aware diff request resolves as "no segment data" → renders as 404.

### Why F2 (`await connection()`) didn't work
- `next dev` locally honored `await connection()` — curl returned `x-nextjs-postponed: 1` (the PPR resume signal that signals "this segment is dynamic, fetch the rest at runtime").
- Vercel's prod edge did NOT honor it — still returned `x-nextjs-prerender: 1` and `x-vercel-cache: HIT` with 0-byte bodies. Unclear whether this is:
  - A Vercel edge runtime divergence from `next dev`
  - The `'use cache'` boundary inside `ProfileShellResolver` (called via `ProfileGate` from the layout) overriding the page-level `connection()` opt-out
  - The layout's `<Suspense>` wrapping a `'use cache'`-backed child being the actual prerender qualifier (page-level opt-out wouldn't disable layout-level prerender)
- The most likely structural reason: **`await connection()` opts the PAGE COMPONENT out of prerender, but the LAYOUT's Suspense + cached-child boundary is what's actually making the route prerender-eligible.** Page-level connection() can't override layout-level PPR qualification.

### Why F1 (`prefetch={false}`) wouldn't work either
- Original recurrence-1 F1 (commit `2f42d00`, May 2026) worked because back then click-time RSC fetches returned valid bodies. The poison was purely in the prefetch path.
- Current state is different: click-time soft-nav requests (with state-tree header) also return 0 bytes from the server. Disabling prefetch only stops the prefetch shape from being sent; the click shape is unaffected and still returns empty.
- Verified via curl on post-F1 deploy `horlo-3dw3sg3ud-tyler-wanekas-projects.vercel.app` — state-tree-shaped request returned 0 bytes regardless of cache-busting unique query param.

### What F3 needs to address
- The route must NOT be PPR-eligible at all, OR its PPR shape must correctly include a dynamic body that responds to state-tree-aware requests with non-empty content.
- Most likely required change: restructure `src/app/u/[username]/layout.tsx` so that the cached `<ProfileGate>` (which calls `'use cache'`-backed `ProfileShellResolver`) is NOT inside a `<Suspense>` boundary that the layout owns. Options:
  - (F3-A) Remove the layout-level `<Suspense>` entirely. Force the gate to render synchronously. Loses TTFB optimization but kills PPR qualification.
  - (F3-B) Move the `<Suspense>` boundary into the page (children) rather than the layout. The layout becomes a static shell with no cached children; the page handles its own suspension. May still be PPR-eligible.
  - (F3-C) Remove `'use cache'` from `ProfileShellResolver` entirely. Forces every request to do the DB roundtrip. Heaviest cost; cleanest semantic. May NOT actually disable PPR if the layout's Suspense is the qualifier.
  - (F3-D) Investigate whether Vercel's PPR can be configured to disable per-route (e.g. via vercel.ts route config). Would be the cleanest opt-out if available.
- F3 should be a proper planned phase (e.g. via /gsd-plan-phase) rather than a hot-patch, because the layout/page boundary is load-bearing for Phase 39c invariants (cache key safety, locked-branch gating, common-ground hero band).

### Operator-supplied repro (still authoritative for F3 verification)
"Copy profile URL from logged-in session. Open incognito. Paste URL. First page load is fine. Click around on all the other profile tabs, each one 404s."

The verification curl for any future F3 attempt:
```bash
curl -s 'https://www.horlo.app/u/twwaneka/wishlist?_rsc=verify-$(date +%s)' \
  -H 'RSC: 1' \
  -H 'Next-Router-State-Tree: %5B%22%22%2C%7B%22children%22%3A%5B%22u%22%2C%7B%22children%22%3A%5B%5B%22username%22%2C%22twwaneka%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%5B%22tab%22%2C%22collection%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%5D%7D%5D%7D%5D%7D%5D%7D%2Cnull%2Cnull%2Ctrue%5D' \
  | wc -c
```
**Pass:** non-zero byte count.
**Fail:** 0 bytes — F3 didn't actually fix it; do not declare resolved.

---

## RECURRENCE 3 — original session diagnostic notes (before revert)

The remaining content of this section captures the diagnostic work performed before the revert decision. It is preserved verbatim for F3 planning context — DO NOT act on the F2/F1 recommendations contained below as the "fix"; those are the failed attempts.



**Operator report:** 404s consistently reproducing on profile pages this morning. User
notes uncertainty about how long after a fresh deploy the bug takes to manifest, but
this morning's session reproduced reliably. User also tempted to disable prefetch
entirely as a backstop.

**Critical new evidence (rules out auth race):** The 404s also reproduce for
**unauthenticated/logged-out viewers** of profile pages. The prior recurrence's root
cause (proxy `getUser()` race → 307 → /login) is structurally impossible for anon
users — they have no auth state to race against. This is a different mechanism.

**Verified still in place:**
  - `src/proxy.ts:19` — auth gate has `!user && !isPublic && !isProfile` guard; `/u/*` bypassed
  - `src/lib/constants/public-paths.ts:53-55` — `isProfilePath()` correctly matches `/u` and `/u/*`
  - `src/app/u/[username]/[tab]/page.tsx:33-39` — `unstable_instant` export confirmed REMOVED with explanatory comment

**Open hypothesis space (broader than prior session):**

H1 — **Page-layer `redirect()` in `/u/[username]/page.tsx` caches a 307 that surfaces as 404.**
The bare-username route (`src/app/u/[username]/page.tsx:10`) does
`redirect(\`/u/${username}/collection\`)`. Grep surfaced ~4 call sites linking to
bare `/u/${username}` (NotificationRow, ProfileSection, WearDetailMetadata) — but
all are inside authenticated chrome, so they don't explain logged-out 404s. Unless
the redirect is somehow being prefetched on a public-facing surface or hit by URL
rewriting at the CDN edge. **Status: plausible for auth'd users, doesn't explain anon.**

H2 — **'use cache' resolver returns a corrupted/empty payload after revalidation.**
`ProfileShellResolver` has `'use cache' + cacheTag('profile:${username}') + cacheLife({revalidate: 300})`.
Numerous server actions call `revalidatePath('/u/[username]', 'layout')` (watches.ts,
divestments.ts, notes.ts, profile.ts, follows.ts, account.ts). If a `revalidatePath`
fires during an in-flight RSC request, the response could be tree-only or empty. The
"time-after-deploy" symptom fits cache buildup or revalidation accumulation.

H3 — **Vercel CDN / edge cache poisoning across the deployment lifecycle.**
A fresh deploy issues new buildId-keyed assets. Edge nodes may serve stale RSC
payloads with old buildId until natural eviction. Mismatch could surface as 404.
Especially relevant if `Cache-Control` headers permit any shared caching.

H4 — **Next 16 Router Cache poisoning from a different 307 source.**
Some other handler (Vercel config, a new redirect rule, an unrelated route guard)
may be returning a 307 specifically on RSC prefetch. Need a fresh `curl -I` capture
of `/u/{user}/collection` and `/u/{user}/collection?_rsc=test` to confirm 200.

H5 — **`profile:${username}` cacheTag invalidation not firing → stale state lookups.**
Inverse of H2 — instead of corrupted reads, maybe cache entries are NOT being
invalidated when the underlying user data is deleted/renamed, and the resolver
returns a stale `null` profile → page calls `notFound()` → 404.

H6 — **A recent commit broke something.** Last meaningful work on this area was
Phase 50.1 (commit 039257e — ARCH-02 page-layer redirect on `/catalog/[catalogId]`).
That route is NOT `/u/*` but introduces the same pattern (page-layer `redirect()`
from a Server Component). Worth checking if the changed pattern propagated anywhere
unexpected, or if any of the v5.2 archival commits (15ad999, 348f2b4) touched
something subtle.

**First moves (cheapest disambiguation):**
  1. **CURL CAPTURE (free, 60s):** `curl -sI https://www.horlo.app/u/{public_username}/collection`
     both with and without `_rsc=xyz` query param. Status code immediately tells us
     if there's a 307 source (H1, H4) vs. a 200 with broken body (H2, H3, H5).
  2. **Identify a reliably-reproducing entry path** for the anon-user 404. The user
     should describe HOW they get to the 404 as anon — direct URL paste? Click from
     `/explore`? Click from search results? Different entry paths exercise different
     prefetch surfaces.
  3. **Check Vercel deploy logs** for any new build warnings or RSC-related errors
     since the last verified-passing deploy (deploy `horlo-40oj1rs0y` per prior
     session resolution).

**User's "disable prefetch" instinct:** That would mask H1/H4 (any redirect-cache
poisoning) but NOT H2/H3/H5 (cache/CDN). It also degrades perceived perf. Hold
that option as a backstop only after diagnosis.

---

## Resolution Summary (2026-05-20 — Recurrence 3 Fix)

**Status: awaiting prod verification** — branch `fix/profile-page-404-recurrence-3`,
applied 2026-05-20 ~22:35 UTC. Operator must deploy and run the prod verification
curl described below before this resolution can be closed.

**Root cause (recurrence 3 — confirmed):** With `experimental.cacheComponents: true`
(next.config.ts:13), the combination of:
  (a) the layout's top-level `<Suspense fallback={<ProfileShellSkeleton/>}>` wrapping
      `<ProfileGate>{children}</ProfileGate>` (src/app/u/[username]/layout.tsx:12-14)
  (b) `'use cache' + cacheLife({revalidate: 300})` on `ProfileShellResolver`
      (src/app/u/[username]/profile-shell-resolver.tsx:29-31)
  (c) no explicit dynamic-per-request opt-out on `[tab]/page.tsx`
made Next 16 treat the `/u/[username]/[tab]` route as PPR-eligible. Per the PPR
platform guide (`ppr-platform-guide.md:14-25`), PPR routes produce two artifacts at
build time: a static HTML shell and a `postponedState` blob. The Vercel edge CDN
cached an RSC prefetch response that contained only the static shell (zero bytes
of content under the `next-router-prefetch` vary key — curl on prod confirmed 0
bytes vs. 18 405 bytes for the same URL without the prefetch header). The client
Router Cache stored that 0-byte response as the canonical entry for the route.
Every subsequent soft-nav tab click served from cache → 404. This is the same
SHAPE as recurrence 1 (`unstable_instant` Mode A) but a different MECHANISM —
unstable_instant was already removed, so something else was producing the empty
prefetch. The PPR shell-only caching was the new vector.

**Why Vercel's CDN cached the empty payload:** Vercel's edge layer follows the
PPR platform guide's "CDN Shell + Origin Compute" model. The static shell IS
the prefetch response. Without a resume protocol trigger (postponed-state header
on the prefetch), the CDN stored the shell verbatim. The client Router Cache
treated the shell as the whole route — no resume happened on click → empty page
→ 404 render.

**Fix:** Add `await connection()` at the top of:
  - `src/app/u/[username]/[tab]/page.tsx` (primary fix — the tab page body)
  - `src/app/u/[username]/page.tsx` (secondary — the bare-username redirector,
    which was being prerendered into a 200 with `x-vercel-cache: PRERENDER`
    instead of issuing a live 307)

Per `migrating-to-cache-components.md:11-43` and `connection.md:6-8`, `await
connection()` is the Cache Components-native opt-out (NOT `dynamic =
'force-dynamic'`, which is "not needed" in Cache Components). It tells Next 16:
"rendering must wait for an incoming user request before continuing" — the
component is excluded from prerender, and prefetches now include either a real
dynamic body OR the `x-nextjs-postponed: 1` header that signals the CDN to
trigger a resume rather than serving an empty cached entry.

**What's intentionally preserved:**
  - `'use cache'` boundary inside `ProfileShellResolver` — owner-scoped DB
    reads (profile, settings, counts, watches, wear events, taste tags) remain
    cached per-username for 300s. Tab switches within that window still hit
    the cache; only the page-level render becomes dynamic.
  - Layout-level `<Suspense>` boundary — the static shell still streams the
    skeleton first for fast TTFB. What changes is that the shell no longer
    qualifies as the entire prefetch response.
  - Prior fix 5def872 (proxy bypass for `/u/*`) — still in place; prevents
    the recurrence 2 cause from reappearing.

**Files changed (commit forthcoming on branch):**
  - `src/app/u/[username]/[tab]/page.tsx` — import `connection` from `next/server`,
    add `await connection()` at the top of `ProfileTabPage` with explanatory
    comment referencing this debug file
  - `src/app/u/[username]/page.tsx` — same pattern for the redirect indirector
  - `tests/profile-route-dynamic.test.ts` — NEW regression test (4 specs) that
    asserts the structural invariant: imports present, `await connection()`
    inside the page body, and `'use cache'` still present in the resolver

**Verification (local):**
  - `npm run lint` on changed files: clean (pre-existing project-wide lint
    debt is unrelated to this change)
  - `npm run build`: passes (route table still shows `◐ Partial Prerender` for
    `/u/[username]/[tab]` — expected, the layout's static shell remains
    prerenderable; the page body is now dynamic-per-request)
  - `npx vitest run tests/profile-route-dynamic.test.ts`: 4/4 pass
  - `npx vitest run tests/proxy.test.ts`: 22/22 pass (no regression)
  - Local curl of `localhost:3000/u/twwaneka/collection?_rsc=test` WITH
    `Next-Router-Prefetch: 1` returns `x-nextjs-postponed: 1` (PPR resume
    signal) — confirms the route is no longer fully prerendered
  - Local artifact inspection: `.next/server/app/u/[username]/[tab].segments/`
    now contains a separate `__PAGE__.segment.rsc` with an `OutletBoundary`
    + Suspense wrapper, confirming the page is a dynamic stream target

**Prod verification (operator):** After deploying the branch, run:
  ```bash
  curl -sI 'https://www.horlo.app/u/twwaneka/collection?_rsc=test' \
    -H 'Next-Router-Prefetch: 1' \
    -H 'RSC: 1'
  ```
  Pass criteria — ONE of:
    - Body is non-empty (`content-length` > 0), OR
    - `x-nextjs-postponed: 1` header is present
  Fail criteria: 200 with `content-length: 0` AND no postponed header — the
  poisoned shape. If that recurs, escalate to F3 (layout restructure) per the
  recurrence-3 next_action options.

  Then click between tabs as a logged-in user and as an anon user pasting the
  URL into incognito. Both flows must navigate cleanly without 404.

**If verification fails:** revert this commit and pursue F3 — restructure the
layout/page boundary so the dynamic (cookie-reading) code lives outside the
layout's Suspense boundary entirely. This is heavier (requires moving
`getCurrentUser()` and the ProfileGate's locked-branch logic into an unwrapped
top-level layout component) but eliminates the PPR-eligibility classification
at its source.

---

## Resolution Summary (2026-05-19 — Recurrence Fix)

**Operator-approved 2026-05-19:** Fix deployed to production (deploy `horlo-40oj1rs0y`,
commit `5def872`). `curl` confirmed `/u/[username]` returns `200` instead of `307 → /login`.
Operator verified profile links navigate correctly on prod past the post-deploy warm-up
window — the cold/warm/refresh 404 signature is gone. Session closed.


**Root cause (recurrence):** `src/lib/supabase/proxy.ts:updateSession` calls
`supabase.auth.getUser()` — a full network round-trip to Supabase's auth server — on
EVERY request including RSC prefetch requests. The Next 16 authentication docs
(`authentication.md:1031`) explicitly warn: "since Proxy runs on every route, including
prefetched routes, it's important to only read the session from the cookie (optimistic
checks), and avoid database checks to prevent performance issues."

When `getUser()` returns null for any reason (token-refresh race, cookie timing, edge
transient), the proxy issued `307 → /login`. `/u/*` was NOT in `isPublicPath()`, so
profile routes were gated. The `307` was stored in Next 16's in-memory Router Cache keyed
on the profile pathname. Subsequent soft-nav clicks served the cached redirect entry →
browser rendered 404. Hard refresh bypassed the Router Cache → full-doc request →
`getUser()` had time to complete → valid 200 → page rendered.

The **cold-cache-works → warm-cache-breaks → refresh-works** pattern confirmed the
Router Cache poisoning signature.

**Fix:** Added `isProfilePath()` predicate to `src/lib/constants/public-paths.ts` and
updated `src/proxy.ts` to skip the auth gate for `/u/*` paths. The proxy now passes
profile route requests through regardless of auth state. Page-level code (`ProfileGate`)
already handles viewer identity correctly: `UnauthorizedError` → `viewerId = null` →
`LockedProfileState` for private profiles, `notFound()` for missing users. No 307 issued
for profile routes → no Router Cache poisoning → no 404 on soft-nav.

`isPublicPath()` (used by BottomNav and SlimTopNav for nav chrome visibility) was
intentionally NOT modified — profile pages still render authenticated chrome for
logged-in users.

**Why the 2026-05-14 fix (cf250b1 — removing `unstable_instant`) was insufficient:**
`unstable_instant` removal fixed the *static-prefetch body mismatch* bug (click-time RSC
returning tree-only payload → infinite skeleton). But the proxy auth gate race was an
independent, pre-existing poisoning vector that manifested reliably once prefetching was
re-enabled (Phase 39c reverted `prefetch={false}`). Both bugs existed simultaneously;
only one was identified in the first session.

**Files changed:**
- `src/lib/constants/public-paths.ts` — added `isProfilePath()` predicate
- `src/proxy.ts` — added `isProfile` check; profile routes bypass auth gate
- `tests/proxy.test.ts` — added "profile route ungating" test suite (6 new tests)

---

## Resolution Summary (2026-05-14)

**Root cause:** `export const unstable_instant = { prefetch: 'static' }` on `[tab]/page.tsx` (Phase 39c Plan 04) was misconfigured for this route. With `prefetch: 'static'`, Next 16 treated both hover-prefetch AND click-time RSC fetches as resolvable from the tree-only static prefetch — returning ~2.5 kB tree-only payloads for click navigation. Two visible failure modes resulted:
  - **404 (cache-poison):** Router Cache stored tree-only entries with no resolvable dynamic body; subsequent clicks rendered as missing routes.
  - **Infinite skeleton (stream miss):** When the click bypassed cache, the static shell rendered correctly (Plan 03 refactor working) but no dynamic content was ever fetched — the route handler was never invoked because Next thought the static prefetch was the whole response.

**Fix (cf250b1):** Remove the `unstable_instant` export. Fall back to Next 16's default partial-prefetch behavior, which uses `src/app/u/[username]/loading.tsx` (Plan 39c-01) as the static-shell boundary signal. The page body is dynamic; the layout's `'use cache'` resolver is what makes the static shell prerenderable. `unstable_instant` is for routes where the entire segment is statically prerenderable, which this one is not.

**Follow-up (61706b7):** Tab UX polish — narrow `loading.tsx` skeleton to content-card-only (chrome stays on screen during tab nav) + refactor `[tab]/page.tsx` to consume the cached `ProfileShellResolver` instead of duplicating its DB reads. Tab switches within the 300s cacheLife window are sub-ms server-side hits, feeling instant.

**Eliminated hypotheses (kept in Evidence below for reference):**
  - P1: proxy 307s prefetches → Capture A returned 200, not 307 (refuted)
  - P0 (original): Router-Cache poisoning from auth-cookie race during login → mitigation (prefetch={false}) worked but was a band-aid; root cause was unstable_instant misconfiguration that emerged after Phase 39c shipped

**Phase 39c original "approved" sign-off retroactively understood:** The 2026-05-13 D-39c-09 prod-checkpoint passed because Phase 39c commits hadn't been pushed yet at that moment — operator re-verified the original 2f42d00 prefetch={false} mitigation, not the structural fix. The actual structural fix only failed once pushed at fa22080; UAT immediately surfaced it; cf250b1 fixed it for real.

**Open follow-up (separate concern, not part of this session):** Phase 39c UAT Test 6 surfaced an unrelated bug — `removeWatch` action leaves stale state in home "from collectors like you" rail AND `/watch/[id]` user-status projection. That's a Plan 39c-05 cache-tag coverage gap + likely a derived-projection caching issue. Tracked in `.planning/phases/39c-profile-layout-next-16-conformance/39c-UAT.md` under Issue 2. Should be its own debug session or small fix phase.

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

status: **REOPENED 2026-05-20 — root cause confirmed (recurrence 3)**

hypothesis: **Cache Components prerender + Vercel edge CDN caches an empty (0-byte) RSC prefetch payload that the client Router Cache later serves on tab click → renders as 404.** Same Mode A shape as the prior `unstable_instant` failure — but a different mechanism is producing the tree-only/empty prefetch this time. Most likely culprit: the layout's top-level `<Suspense fallback={<ProfileShellSkeleton/>}>` + `'use cache' + cacheLife({revalidate: 300})` on `ProfileShellResolver` is causing Next 16 (with `experimental.cacheComponents: true`) to treat the entire `/u/[username]/[tab]` route as prerenderable. Prerender output for an RSC prefetch is the static shell only (skeleton, no body). That zero-byte body is then served from Vercel's edge CDN to subsequent prefetches keyed on `next-router-prefetch` vary header.

evidence (confirmed 2026-05-20 21:42 UTC via curl on prod):
  - `/u/twwaneka/collection` full doc: 200, 51 kB, `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`, `x-nextjs-stale-time: 300`, `age: 384`
  - `/u/twwaneka/collection?_rsc=test` WITHOUT prefetch header: 200, **18,405 bytes** (full content), `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`, content-type `text/x-component`
  - `/u/twwaneka/collection?_rsc=test` WITH `Next-Router-Prefetch: 1` header: 200, **0 bytes (EMPTY BODY)**, `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`
  - `/u/twwaneka` (bare, expected 307): 200, `x-vercel-cache: PRERENDER`, `x-matched-path: /u/[username]` — the `redirect()` is being prerendered to a 200 cached response, suggesting Next is statically resolving the redirect path
  - User repro: copy URL from logged-in session, paste into incognito, first load works, **every subsequent tab click 404s**
  - User confirms: immediately after a fresh deploy, NO 404s. They start appearing as edge cache accumulates poisoned entries.

eliminated this session (not the root cause):
  - Proxy auth gate (prior fix 5def872 still in place; `/u/*` correctly bypasses `isProfile` check at proxy.ts:19)
  - Auth-session race (anon users with no session also 404 — there's no session to race)
  - `unstable_instant` (confirmed removed from `[tab]/page.tsx` with explanatory comment; not the source of the prerender treatment this time)
  - Page-layer `redirect()` from `/u/[username]/page.tsx` (only hit by auth'd entry points; doesn't explain anon repro)

test: 
  1. **Vary-key disambiguation:** does the 0-byte response come from a server-side render that returns empty, OR from CDN serving a cached zero-byte entry? Add a unique header to bypass cache: `curl 'https://www.horlo.app/u/twwaneka/collection?_rsc=NOCACHE-$(date +%s)' -H 'Next-Router-Prefetch: 1' -H 'Cache-Control: no-cache'`. If still 0 bytes, the server is genuinely producing empty payloads for prefetches → root cause is Next 16 prerender behavior, not CDN poisoning. If non-empty, the bug is purely in the CDN layer.
  2. **Confirm by removing the layout-level Suspense:** locally, refactor `src/app/u/[username]/layout.tsx` to NOT wrap `<ProfileGate>` in `<Suspense>`. Build and check whether the route still appears as prerendered (`x-nextjs-prerender: 1`). If the route loses prerender status, the Suspense is what's qualifying it.
  3. **Confirm by force-dynamic:** add `export const dynamic = 'force-dynamic'` to `src/app/u/[username]/[tab]/page.tsx`. Rebuild; should remove `x-nextjs-prerender: 1`. Deploy and verify the 404 stops appearing as cache fills.

next_action: **CHECKPOINT — operator decision on fix path.** Three options to discuss:
  - F1 (cheapest, backstop): `prefetch={false}` on ProfileTabs Links (`src/components/profile/ProfileTabs.tsx:73`) — same band-aid as recurrence 1. Cost: ~200–400ms slower tab-switch (click-time fetch). Doesn't fix the underlying prerender mismatch but guarantees no Router Cache poisoning. Reversible.
  - F2 (structural): `export const dynamic = 'force-dynamic'` on `[tab]/page.tsx` (and possibly the layout). Removes prerender qualification. Cost: gives up the static shell optimization Phase 39c shipped. Forces every request to hit the data layer (still cached via the 'use cache' resolver, so DB cost is bounded). Probably the correct fix per Next 16 docs since the page reads cookies.
  - F3 (deepest): redesign the layout/page boundary so the dynamic (cookie-reading) code lives outside any Suspense boundary that qualifies for static prerender. Likely requires moving `getCurrentUser()` out of `ProfileGate` and into an unwrapped server component. Most work; cleanest semantically.

reasoning_checkpoint: This is recurrence 3 of the same symptom. Prior fixes addressed two different real causes but the underlying brittleness — that the profile route is *prerender-eligible* despite reading cookies and requiring viewer-specific rendering — has not been addressed. The structural fix (F2 or F3) is needed to stop the third bandage from also becoming insufficient.

tdd_checkpoint:

## Current Focus (SUPERSEDED — 2026-05-19 recurrence-2 investigation, kept for history)

status: **RESOLVED 2026-05-19**

hypothesis: **Router Cache poisoning via the proxy auth gate.** `src/proxy.ts:11-15` gates
`/u/*` on auth — `/u` is NOT in `isPublicPath()` (`src/lib/constants/public-paths.ts`). Every
RSC prefetch / soft-nav request to a profile path passes through the gate. If
`supabase.auth.getUser()` returns null for even one such request (token-refresh race, cookie
not attached to the RSC fetch, edge transient), the proxy returns `307 → /login`. Next 16
caches that redirect keyed on `/u/[username]/[tab]`; subsequent soft navs serve the poisoned
entry → 404. Verified live 2026-05-19: `curl https://www.horlo.app/u/twwaneka/collection`
(unauthenticated) → `307 → /login?next=%2Fu%2Ftwwaneka%2Fcollection`.

test: Operator confirmed the cold/warm/refresh signature on prod (see Recurrence evidence).
This matches the poisoning model exactly.

next_action: DONE — fix implemented and tests pass. Deploy to prod and verify
cold/warm/refresh signature is gone.

reasoning_checkpoint: Next 16 authentication docs (authentication.md:1031) confirm:
"since Proxy runs on every route, including prefetched routes, it's important to only
read the session from the cookie (optimistic checks), and avoid database checks."
`updateSession` calls `supabase.auth.getUser()` (network round-trip) which violates this
guidance. Making profile routes ungated in the proxy eliminates the poisoning vector
entirely while page-level ProfileGate handles viewer identity correctly.

---

## Current Focus (SUPERSEDED — 2026-05-14 investigation, kept for history)

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

- timestamp: 2026-05-20T21:42:00Z
  observation: **Curl evidence on prod (recurrence 3 — definitive Mode A confirmation).** Captured five responses against `https://www.horlo.app/u/twwaneka/...`:
    - `/collection` full HTML: 200, 51 138 bytes, `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`, `x-nextjs-stale-time: 300`, `age: 384` (6+ min old, shared)
    - `/collection?_rsc=test` (no prefetch header): 200, **18 405 bytes** (full RSC payload with content rows), `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`
    - `/collection?_rsc=test` + `Next-Router-Prefetch: 1` header: 200, **0 bytes (empty body)**, `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`
    - `/wishlist` (different tab): 200, full HTML, `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`
    - `/u/twwaneka` (bare, expected 307 → /collection): 200, `x-vercel-cache: PRERENDER`, `x-matched-path: /u/[username]` — the `redirect()` call in `src/app/u/[username]/page.tsx` is being prerendered into a cached 200 response, not surfaced as a 307
  All five share `vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch`. The `next-router-prefetch` vary key means the empty-body prefetch response and the full-body click response are stored under separate CDN cache entries — but the client's Router Cache stores the prefetch response (which is what subsequent click attempts read from) and that's the 0-byte poison.
- timestamp: 2026-05-20T21:35:00Z
  observation: **User repro signature (recurrence 3):** "copied profile url from logged in session. opened incognito and pasted url. first page load is fine, clicked around on all the other profile tabs, each one 404s." First hard nav = full doc, works. Subsequent tab clicks = soft nav via Router Cache, 404. This is the textbook Router Cache poisoning shape but exercised via `ProfileTabs` `<Link>` prefetches instead of top-nav links.
- timestamp: 2026-05-20T21:45:00Z
  observation: **Time-after-deploy correlation explained.** User notes "we just deployed so I'm not seeing the 404s right now." This is consistent with the hypothesis: a new buildId invalidates Vercel edge CDN entries; subsequent ProfileTabs prefetches populate the CDN with empty-body responses; the empty responses then poison the Router Cache for any user whose Link sees the cached prefetch. Bug surfaces as edge cache accumulates (within minutes of meaningful prefetch traffic), not immediately on deploy.
- timestamp: 2026-05-20T21:50:00Z
  observation: **Verified prior fix (5def872) still intact.** Re-read `src/proxy.ts:19` — auth gate has `!user && !isPublic && !isProfile` guard. `src/lib/constants/public-paths.ts:53-55` — `isProfilePath()` returns true for `/u` and `/u/*`. The proxy is NOT issuing 307s on `/u/*` prefetches; the 307-source hypothesis from prior recurrence is genuinely closed.

- timestamp: 2026-05-20T22:30:00Z
  observation: **Specialist consultation (no external skill — read Next 16 docs in `node_modules/next/dist/docs/`).** Key citations: (1) `migrating-to-cache-components.md:11-43` — `export const dynamic = 'force-dynamic'` is "Not needed" in Cache Components; the canonical opt-out is `await connection()`. (2) `connection.md:6-8` — "useful when a component doesn't use Request-time APIs, but you want it to be rendered at runtime and not prerendered at build time." (3) `ppr-platform-guide.md:14-25,57-68` — PPR routes produce a static shell + postponed state pair; the CDN can serve the shell from edge cache while resuming dynamic render at origin. This is exactly the Vercel deployment topology and matches the poisoning shape observed. Decision: F2 with `await connection()` (NOT `force-dynamic`).
- timestamp: 2026-05-20T22:35:00Z
  observation: **Fix applied on branch `fix/profile-page-404-recurrence-3`.** Added `import { connection } from 'next/server'` + `await connection()` at the top of both `src/app/u/[username]/[tab]/page.tsx` (primary — the tab page body) and `src/app/u/[username]/page.tsx` (secondary — the bare-username redirect indirector, which was being prerendered into `x-vercel-cache: PRERENDER`). Added `tests/profile-route-dynamic.test.ts` with 4 regression specs that lock the structural invariant (`connection` import present, `await connection()` inside the page body, `'use cache'` still present in `ProfileShellResolver`). Lint clean. Build passes. All tests pass.
- timestamp: 2026-05-20T22:38:00Z
  observation: **Local curl verification (production build).** After `rm -rf .next && npm run build && npm run start`: `curl 'localhost:3000/u/twwaneka/collection?_rsc=test' -H 'Next-Router-Prefetch: 1'` now returns headers `x-nextjs-prerender: 1` AND `x-nextjs-postponed: 1` (the new postponed-state signal). The same URL WITHOUT the prefetch header returns `HTTP 200, 16443 bytes` with `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. Build artifact inspection: `.next/server/app/u/[username]/[tab].segments/u/$d$username/$d$tab/__PAGE__.segment.rsc` exists (974 bytes) and contains an `OutletBoundary` + `Suspense` wrapper, confirming the page is now a dynamic stream target rather than a static shell. The local 404 on prefetch is an artifact of the local DB lacking the `twwaneka` profile (not a fix failure); the structural change is correct. Operator must verify on prod that the recurrence is gone.

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

root_cause: **Next.js 16 Router-Cache poisoning via proxy auth gate race on profile routes.**
`src/lib/supabase/proxy.ts:updateSession` calls `supabase.auth.getUser()` — a full network
round-trip to Supabase — on every request including RSC prefetch requests to `/u/*`. When
`getUser()` returns null (token-refresh race, cookie timing on login transition, edge
transient), the proxy issued `307 → /login`. `/u/*` was not in `isPublicPath()`, so the 307
was cached by Next 16's in-memory Router Cache keyed on the profile pathname. Subsequent
soft-nav clicks served the poisoned cache entry → 404. Hard refresh bypassed the Router
Cache → full-doc request with valid auth → 200.

This was NOT present in the 2026-05-14 investigation because at the time of CAPTURE A the
user was fully authenticated, so `getUser()` returned a valid user on every prefetch. The
recurrence became reliably reproducible after Phase 39c enabled prefetching and the
cold/warm/refresh signature emerged consistently in production.

Next 16 authentication docs (authentication.md:1031) explicitly warn against this pattern:
"since Proxy runs on every route, including prefetched routes, it's important to only read
the session from the cookie (optimistic checks), and avoid database checks."

fix: Added `isProfilePath()` to `src/lib/constants/public-paths.ts`. Updated `src/proxy.ts`
to check `!isProfile` alongside `!isPublic` in the auth gate. Profile routes (`/u/*`) now
bypass the proxy auth gate entirely. Page-level `ProfileGate` handles viewer identity:
`UnauthorizedError` → `viewerId = null` → `LockedProfileState` (private profiles) or
`notFound()` (missing users). No 307 issued → no Router Cache poisoning → no 404 on soft-nav.

verification: 21 proxy tests pass (including 6 new profile-route-ungating tests). Deploy to
prod and confirm: (a) cold-cache clicks work, (b) warm-cache clicks work (no 404), (c) hard
refresh continues to work.

files_changed:
  - src/lib/constants/public-paths.ts (add isProfilePath predicate)
  - src/proxy.ts (add isProfile check to auth gate bypass)
  - tests/proxy.test.ts (add profile route ungating test suite)

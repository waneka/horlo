---
slug: phase61-404-react-419-soft-nav
status: fix_applied
trigger: "404 + React #419 on profile pages and watch detail pages — soft-nav only (hard refresh works), re-introduced in Phase 61"
created: 2026-05-25
updated: 2026-05-26
source_phase: 61-photo-upload-carousel-ui
source_uat: .planning/phases/61-photo-upload-carousel-ui/61-HUMAN-UAT.md
reopened: 2026-05-26
---

# Debug: Phase 61 404 + React #419 (soft-nav only)

## ⚠ REOPENED 2026-05-26 — 98e7289 did NOT fix EITHER route (both still 404 on soft-nav)

After deploying 67fde76 (confirmed live on www.horlo.app = deployment `horlo-rfkbt86o1`, contains the full 98e7289 fix to BOTH routes), prod re-test by the user. **Initial read was WRONG and is corrected here:**

- An early observation suggested profile pages were fixed — that was a MISREAD (almost certainly a hard load / first paint).
- **CONFIRMED user behavior (2026-05-26):** on profile pages (`/u/[username]/[tab]`): **hard refresh ALWAYS loads; soft (in-app) navigation ALWAYS 404s** — consistent, not intermittent. Watch-detail (`/w/[ref]`): same — soft-nav 404s.
- **Conclusion: BOTH routes still 404/#419 on soft-nav.** Neither of 98e7289's ordering fixes resolved it.
- **The call-ORDERING model (P61-BUG-01, either direction) is the WRONG root-cause theory.**

**Signature (now well-characterized):** consistent (deterministic) React #419 + 404 on CLIENT/soft navigation to any Phase-61-touched cached/PPR route; full browser hard-refresh (SSR) always works; invisible to `npm run build` (exit 0) and to the static guard (which passes). Re-introduced by Phase 61's addition of a dynamic cookies API (`createSupabaseServerClient`/`signCoverUrls`) into these RSCs.

## Symptoms

- **expected:** Profile pages (`/u/[username]/[tab]`) and watch detail pages (`/w/[ref]`) load when navigating to them within the app (client-side / soft navigation).
- **actual:** 404 on ALL profile pages, and on watch detail pages reached via client-side navigation from the profile tabs (collection / wishlist / notes / stats) AND from search. React **minified error #419** appears in the browser console.
- **error:** `Uncaught Error: Minified React error #419` (https://react.dev/errors/419) + Next.js 404.
- **timeline:** Absent in the previous deployed version; **re-introduced during Phase 61** (Photo Upload + Carousel UI). Confirmed reproducible on the prod deploy of the latest `main` (commit 4f9e6b1).
- **reproduction:** Soft-navigate (in-app link click) to a profile tab, or from a profile tab / search result to a watch detail page → 404 + #419. **A hard browser refresh (full SSR document load) of the same URL loads the page correctly.** So the failure is specific to the client-side navigation/transition, not the server render.

## Current Focus

hypothesis: "STRUCTURAL (not ordering): Phase 61 introduced createSupabaseServerClient() (cookies()) for photo signing into PPR routes. The call-ordering fix (P61-BUG-01) was deployed and confirmed NOT to fix either route — ordering does not resolve the issue. The root cause is that any direct call to createSupabaseServerClient() (which invokes cookies()) in an RSC that also calls 'use cache' functions corrupts the PPR prerender boundary regardless of ordering. The fix: replace createSupabaseServerClient() with createSupabaseAdminClient() (service role) for URL signing — admin client is synchronous and does not call cookies(). Storage URL signing is safe with service role because: (a) storage paths are user-scoped {userId}/... by construction (IDOR fix in Phase 61), (b) signing creates a time-limited token, not a data query. This removes the cookies() dependency from the PPR path entirely."
test: "Deploy to prod via vercel deploy --prod. Have user soft-navigate between profile tabs and from collection/search to /w/[ref]. Both routes must load without 404 or React #419 on soft-nav."
expecting: "Removing cookies() dependency from the photo signing path (by using admin client) eliminates the soft-nav #419/404 on both routes. Hard refresh was always working and should continue to work."
next_action: "PROVISIONAL PASS — user reports prod soft-nav 404s look good after deploy 8a49a19 (first clean soft-nav result this session). User will re-verify in ~30 min before final close. Do NOT mark resolved or update the project_ppr_dynamic_before_use_cache memory until that re-confirmation lands. If confirmed: close session (status resolved), correct the stale ordering-theory memory, and capture the admin-client durable rule. If it regresses: reopen with next structural angle (note whether it fails on /u/[username]/[tab], /w/[ref], or both)."

## Evidence

- timestamp: 2026-05-25 — Phase 61 modified exactly these 5 RSCs (from 61-02 and 61-04 SUMMARYs): `src/app/w/[ref]/page.tsx` (signed-photo fetch, 61-02), `src/app/page.tsx`, `src/app/u/[username]/[tab]/page.tsx`, `src/app/u/[username]/profile-shell-resolver.tsx`, `src/app/search/page.tsx` (signCoverUrls wiring, 61-04). These are the ONLY structural changes to the affected routes this phase. Phase-61 commits: `91acf56` (wire signCoverUrls into home/profile-tab/resolver/search RSCs), `8b9fdf9` (signCoverUrls helper), and `f810fdf` (61-02 carousel/page.tsx). Diff base = the commit before Phase 61 began (`a77c3f8` docs(state) record phase 61 context, or the last Phase 60 commit `913302a`).
- timestamp: 2026-05-25 — 61-04 SUMMARY notes the resolver fix used `resolveProfileShellSigned` "outside the `'use cache'` scope" — verify this is actually outside and that signing didn't leak a dynamic call into the cached path.
- timestamp: 2026-05-25 — Build passes (exit 0) and full SSR refresh works → the server render is fine; the failure is the client soft-nav transition (PPR/Router-Cache resume). Classic React #419 (a Suspense boundary / prerender aborting during hydration-resume on soft-nav).
- timestamp: 2026-05-25 — MEMORY context: `project_router_cache_stale_instance`, `project_cc_audit_2026_05_21`, `project_phase_52_in_progress` — on `/u/[username]/[tab]` `unstable_instant` is unusable (runtime → #419; static → build fails); the route was made structurally safe in Phase 52. Check whether the Phase 61 edits to `[tab]/page.tsx` / `profile-shell-resolver.tsx` re-broke that structural fix.
- timestamp: 2026-05-26 — Call-ordering theory ABANDONED. The P61-BUG-01 fix (deployed in 98e7289 → 67fde76, confirmed live on prod) tried BOTH orderings: (1) dynamic-BEFORE-cache in `w/[ref]/page.tsx`, (2) dynamic-AFTER-cache in `[tab]/page.tsx`. BOTH routes still 404 on soft-nav. Conclusion: ordering of cookies() relative to 'use cache' calls in the function body does NOT determine the outcome. The mere presence of createSupabaseServerClient() (which calls cookies()) anywhere in an RSC that also calls 'use cache' functions corrupts the PPR prerender pipeline.
- timestamp: 2026-05-26 — Key observation from git diff: BEFORE Phase 61, both routes already had getCurrentUser() which internally calls createSupabaseServerClient() → cookies(). The routes WORKED. Phase 61 added a SECOND independent createSupabaseServerClient() call (for photo signing). getCurrentUser() is wrapped in React.cache() (request-scoped memoization). The direct createSupabaseServerClient() call in signCoverUrls/signing code is NOT memoized. This distinction appears to be why adding the second call breaks things — the unmemoized call is re-executed in each prerender pass (prospective + final runtime prerenders share headers/cookies but use separate React.cache scopes). The fix: use the admin client (service role, synchronous, no cookies()) for signing.
- timestamp: 2026-05-26 — STRUCTURAL FIX APPLIED: Changed `src/lib/storage/signCoverUrls.ts` to use `createSupabaseAdminClient()` (synchronous, no cookies()) instead of `createSupabaseServerClient()` (async, cookies()). Changed `src/app/w/[ref]/page.tsx` to use `createSupabaseAdminClient()` directly (no await needed) in both photo signing blocks (Branch 1 + D-06). Updated `src/app/u/[username]/[tab]/page.tsx` comment to remove stale P61-BUG-01 ordering references. `npm run build` exits 0. All affected routes remain `◐ Partial Prerender`.
- timestamp: 2026-05-26 — COMMITTED + DEPLOYED: commit `8a49a19` (fix(61): structural #419 fix — sign storage URLs via admin client, not cookies()), pushed to main. Manual `vercel deploy --prod` (auto-deploy still not firing) → deployment `dpl_ANs3tNYM6YrL4YbYtSySratSbWJa`, target production, readyState READY, aliased to www.horlo.app. `/w/[ref]` confirmed `◐ Partial Prerender` in the Vercel build output. Awaiting user prod soft-nav verification.
- timestamp: 2026-05-26 — PROVISIONAL PASS (user report): "404s look good for now" on prod soft-nav after deploy 8a49a19 — the FIRST clean soft-nav result this session. This is the admin-client structural fix (cookies() removed from the signing path), distinct mechanism from the abandoned ordering fix. User will re-verify in ~30 min before final close. Not marked resolved yet (prior reopen was a misread).

## Eliminated

- Call ordering of cookies() relative to 'use cache' calls — PROVEN NOT TO FIX. Both orderings (before and after) deployed to prod via 98e7289/67fde76, both still fail.
- `resolveProfileShellSigned` wrapper in profile-shell-resolver.tsx IS correctly outside the `'use cache'` scope — but it is dead code, never imported anywhere. Not the bug source.
- `unstable_instant = false` was still in place and correct on `[tab]/page.tsx`.
- `search/page.tsx` and `app/page.tsx` — signCoverUrls calls in these files are safe because their 'use cache' components are JSX children (rendered inside the returned JSX tree), not awaited functions in the same async body as signCoverUrls.
- The bug manifests only for users who have watches with raw storage paths in imageUrl (the signCoverUrls early-return for rawPaths.size === 0 means photo-less users don't hit the dynamic API at all — consistent with UAT reports).

## Resolution

- **root_cause:** Phase 61 added direct `createSupabaseServerClient()` calls (which invoke `cookies()`) for photo URL signing into RSCs that also call `'use cache'` functions. Unlike `getCurrentUser()` which is wrapped in `React.cache()` (memoized per render, does not re-execute `cookies()` in subsequent calls within the same render), the direct `createSupabaseServerClient()` calls re-execute `cookies()` fresh in every render pass. With Cache Components / PPR, Next.js runs a prospective + final runtime prerender pair (two separate render passes) to populate cache entries and produce the prefetch RSC payload. The unmemoized `cookies()` call in the photo signing code creates interference between these two passes, corrupting the PPR prerender boundary and causing React #419 on soft-nav. Call ordering (before or after 'use cache' calls) does NOT resolve this — the issue is that the call is unmemoized and re-executed in the secondary prerender pass.
- **fix:** Replaced `createSupabaseServerClient()` with `createSupabaseAdminClient()` (service role, synchronous, zero `cookies()` calls) in all photo signing code: `src/lib/storage/signCoverUrls.ts` (used by `[tab]/page.tsx` for cover URL signing) and `src/app/w/[ref]/page.tsx` (direct photo signing in Branch 1 + D-06). The admin client is safe for storage URL signing because paths are user-scoped by construction (IDOR fix) and signing creates time-limited access tokens — not data queries.
- **verified:** `npm run build` exits 0; all affected routes remain `◐ Partial Prerender`. Prod soft-nav re-test PENDING (requires `vercel deploy --prod` + user verification).
- **durable_rule:** In PPR routes, ONLY use `createSupabaseServerClient()` (or any `cookies()`-reading API) through a `React.cache()`-memoized wrapper OR within a component/function that is isolated in its own `<Suspense>` boundary (so it never re-executes in secondary prerender passes). For storage URL signing specifically: prefer `createSupabaseAdminClient()` — it is synchronous, cookie-free, and safe for generating time-limited signed URLs for user-scoped storage paths.

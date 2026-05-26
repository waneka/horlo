---
slug: phase61-404-react-419-soft-nav
status: resolved
trigger: "404 + React #419 on profile pages and watch detail pages — soft-nav only (hard refresh works), re-introduced in Phase 61"
created: 2026-05-25
updated: 2026-05-26
source_phase: 61-photo-upload-carousel-ui
source_uat: .planning/phases/61-photo-upload-carousel-ui/61-UAT.md
---

# Debug: Phase 61 404 + React #419 (soft-nav only)

## Symptoms

- **expected:** Profile pages (`/u/[username]/[tab]`) and watch detail pages (`/w/[ref]`) load when navigating to them within the app (client-side / soft navigation).
- **actual:** 404 on ALL profile pages, and on watch detail pages reached via client-side navigation from the profile tabs (collection / wishlist / notes / stats) AND from search. React **minified error #419** appears in the browser console.
- **error:** `Uncaught Error: Minified React error #419` (https://react.dev/errors/419) + Next.js 404.
- **timeline:** Absent in the previous deployed version; **re-introduced during Phase 61** (Photo Upload + Carousel UI). Confirmed reproducible on the prod deploy of the latest `main` (commit 4f9e6b1).
- **reproduction:** Soft-navigate (in-app link click) to a profile tab, or from a profile tab / search result to a watch detail page → 404 + #419. **A hard browser refresh (full SSR document load) of the same URL loads the page correctly.** So the failure is specific to the client-side navigation/transition, not the server render.

## Current Focus

hypothesis: "Phase 61 wired `signCoverUrls()` — which calls `createSupabaseServerClient()` (a dynamic, cookie/auth-dependent API) — into RSCs that are (or feed) cached / partially-prerendered renders: `src/app/u/[username]/profile-shell-resolver.tsx` (has a `'use cache'` scope; a `resolveProfileShellSigned` wrapper was added 'outside' that scope), `src/app/u/[username]/[tab]/page.tsx`, `src/app/search/page.tsx`, and the signed-photo fetch in `src/app/w/[ref]/page.tsx`. A dynamic call evaluated inside or across a `'use cache'`/PPR boundary aborts the prerender on soft navigation → React #419 → 404, while a full SSR refresh succeeds. This matches the project's prior #419 / Cache Components history (Phase 51 recurrences, Phase 52 structural fix)."
test: "Diff Phase 61's changes to the 5 modified RSCs and locate where signCoverUrls / createSupabaseServerClient is invoked relative to 'use cache' / Suspense / PPR boundaries — especially profile-shell-resolver.tsx (the soft-nav-only + profile-page symptom points hardest here)."
expecting: "A dynamic (cookie/auth) call newly placed inside a cached scope, or a signing call that moved a previously-static boundary into a dynamic one, in the profile-shell-resolver / [tab] path."
next_action: "RESOLVED — fix applied and build verified."

## Evidence

- timestamp: 2026-05-25 — Phase 61 modified exactly these 5 RSCs (from 61-02 and 61-04 SUMMARYs): `src/app/w/[ref]/page.tsx` (signed-photo fetch, 61-02), `src/app/page.tsx`, `src/app/u/[username]/[tab]/page.tsx`, `src/app/u/[username]/profile-shell-resolver.tsx`, `src/app/search/page.tsx` (signCoverUrls wiring, 61-04). These are the ONLY structural changes to the affected routes this phase. Phase-61 commits: `91acf56` (wire signCoverUrls into home/profile-tab/resolver/search RSCs), `8b9fdf9` (signCoverUrls helper), and `f810fdf` (61-02 carousel/page.tsx). Diff base = the commit before Phase 61 began (`a77c3f8` docs(state) record phase 61 context, or the last Phase 60 commit `913302a`).
- timestamp: 2026-05-25 — 61-04 SUMMARY notes the resolver fix used `resolveProfileShellSigned` "outside the `'use cache'` scope" — verify this is actually outside and that signing didn't leak a dynamic call into the cached path.
- timestamp: 2026-05-25 — Build passes (exit 0) and full SSR refresh works → the server render is fine; the failure is the client soft-nav transition (PPR/Router-Cache resume). Classic React #419 (a Suspense boundary / prerender aborting during hydration-resume on soft-nav).
- timestamp: 2026-05-25 — MEMORY context: `project_router_cache_stale_instance`, `project_cc_audit_2026_05_21`, `project_phase_52_in_progress` — on `/u/[username]/[tab]` `unstable_instant` is unusable (runtime → #419; static → build fails); the route was made structurally safe in Phase 52. Check whether the Phase 61 edits to `[tab]/page.tsx` / `profile-shell-resolver.tsx` re-broke that structural fix.
- timestamp: 2026-05-26 — ROOT CAUSE CONFIRMED: In PPR routes, calling a dynamic API (`cookies()` via `createSupabaseServerClient()`) in the SAME async function body as a `'use cache'` function, where the dynamic call is INTERLEAVED with (comes BETWEEN or AFTER) `'use cache'` calls, corrupts the PPR prerender boundary. The static prerender captures the function body up to and including the first `'use cache'` call; when the router cache replays the RSC payload on soft-nav, the resumed render re-encounters a dynamic API access that the static capture assumed was settled. Next.js rule (confirmed in use-cache.md:21): "To use cookies or headers, read them outside cached scopes and pass values as arguments." The rule extends to the surrounding function body ordering: all dynamic API access must come BEFORE all `'use cache'` calls in any given async scope.
- timestamp: 2026-05-26 — SPECIFIC VIOLATIONS FOUND:
  - `[tab]/page.tsx`: `signCoverUrls` (cookies) called AFTER `ProfileShellResolver` ('use cache') at line 191, and BEFORE `getBatchedWatchCountsCached` ('use cache') in the collection/wishlist/notes branch at line 360. The interleaved dynamic call between two 'use cache' calls is the trigger.
  - `w/[ref]/page.tsx` Branch 1: `createSupabaseServerClient()` called at line 148 AFTER `getLikesForTargetCached` ('use cache') at line 81.
  - `w/[ref]/page.tsx` D-06 branch: same pattern — `createSupabaseServerClient()` at line 325 after `getLikesForTargetCached` at line 285.
  - `app/page.tsx` and `search/page.tsx`: NOT affected because their 'use cache' functions are JSX children (CollectorsLikeYou etc.), not awaited in the same function body as the signing call.
- timestamp: 2026-05-26 — FIX APPLIED + BUILD VERIFIED: Restructured both files so dynamic API (signCoverUrls/createSupabaseServerClient) comes AFTER all 'use cache' calls in every execution path. In `[tab]/page.tsx`: moved signCoverUrls to INSIDE each tab branch, after getBatchedWatchCountsCached. In `w/[ref]/page.tsx`: moved photo fetch+sign to BEFORE getLikesForTargetCached in both Branch 1 and D-06 branch. `npm run build` exits 0. All routes remain `◐ Partial Prerender`.

## Eliminated

- `resolveProfileShellSigned` wrapper in profile-shell-resolver.tsx IS correctly outside the `'use cache'` scope — but it is dead code, never imported anywhere. Not the bug source.
- `unstable_instant = false` was still in place and correct on `[tab]/page.tsx`.
- `search/page.tsx` and `app/page.tsx` — signCoverUrls calls in these files are safe because their 'use cache' components are JSX children (rendered inside the returned JSX tree), not awaited functions in the same async body as signCoverUrls.
- The bug manifests only for users who have watches with raw storage paths in imageUrl (the signCoverUrls early-return for rawPaths.size === 0 means photo-less users don't hit the dynamic API at all — consistent with UAT reports).

## Resolution

- **root_cause:** Phase 61 placed `createSupabaseServerClient()` (a `cookies()`-dependent dynamic API) calls in the same async function body as `'use cache'` functions, with the dynamic call AFTER (or interleaved with) the cached calls. In PPR routes, this corrupts the prerender boundary: the static capture includes the 'use cache' call but not the subsequent dynamic API access, so soft-nav RSC replay re-encounters a dynamic API that the cached prerender assumed was settled — triggering React #419 and a 404. The rule from Next.js docs: dynamic API access must come BEFORE all 'use cache' calls in any given async scope.
- **fix:** In `src/app/u/[username]/[tab]/page.tsx`: removed the early `signCoverUrls` call (between ProfileShellResolver and getBatchedWatchCountsCached) and moved signing into each leaf tab branch AFTER getBatchedWatchCountsCached. In `src/app/w/[ref]/page.tsx`: moved the photo fetch+sign block (createSupabaseServerClient) to BEFORE getLikesForTargetCached in Branch 1 and the D-06 owned-watch branch. All dynamic API access now precedes all 'use cache' calls in every execution path.
- **verified:** `npm run build` exits 0; all affected routes remain `◐ Partial Prerender`.
- **durable_rule:** In PPR routes containing both 'use cache' functions and dynamic API access (cookies/headers) in the same async function body, the dynamic API calls MUST come before any 'use cache' calls. Violating this ordering causes React #419 on soft-nav (hard refresh works). Tag: P61-BUG-01.

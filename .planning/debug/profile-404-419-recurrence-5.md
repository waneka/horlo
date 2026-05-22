---
status: fix_applied_awaiting_prod_uat
trigger: "Recurrence-5 of the profile-route 404 bug, observed in prod after the Phase 52 deploy (commit b5106db, prod deploy horlo-jgb6rup55). Phase 52 mostly improved things but did NOT fully fix it: intermittent per-tab/per-device 404s on /collection and /wishlist, plus React #419 on page-load for ALL profile pages."
created: 2026-05-21
updated: 2026-05-21
related: [profile-page-404-top-nav.md (recurrences 1-4, resolved), Phase 52 (Option D fix)]
root_cause: "unstable_instant: { prefetch: 'runtime' } triggers a secondary server-side prerender (finalRuntimeServerPrerender) on every request that aborts before ProfileTabContent's async work completes → React #419 on page load + an incomplete RSC segment cached in the Flight payload that the client replays as intermittent tab-nav 404s. Introduced by Phase 52 D-52-DEV-01. The validator cannot be used on this two-dynamic-param route in either mode: 'runtime' breaks prod, 'static' fails the build (E-00)."
fix: "src/app/u/[username]/[tab]/page.tsx — unstable_instant = false (opt out of validation). Keeps the Plan 52-04/05 structural fix. Build clean (33/33 static pages); profile-route-51 5/5 pass. Comments in [tab]/page.tsx + layout.tsx updated to the opt-out + recurrence-5 addendum."
verification: "PENDING — prod-only bug, cannot repro locally. Requires operator signed-in UAT post-deploy through the 300s cacheLife window (recurrence-4 hit ~10 min post-deploy)."
---

# Debug: profile-404-419-recurrence-5

## Symptoms

### 1. Intermittent, race-condition-like 404s on `/u/[username]/[tab]`
The behavior changed character vs. recurrences 1-4 (which were CONSISTENT 404s on ALL tabs):
- **Computer A (prod):** 404 ONLY on `/collection`; other tabs fine.
- **Phone (prod):** `/collection` 404'd only SOMETIMES; sometimes resolved correctly.
- **Computer B (prod, current):** `/collection` works every time; `/wishlist` 404s inconsistently, ~20% fail rate (ballpark).

The per-tab + per-device + intermittent nature is NEW and is the strongest diagnostic signal — it reads like a race / cache-state-dependent failure rather than a deterministic structural one.

### 2. React error #419 on page load (NOT click) for ALL profile pages
- "Minified React error #419" = "The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering."
- Appears on PAGE LOAD (initial render / SSR-stream), not on tab click/navigation.
- Affects ALL profile pages, not just the 404ing tabs.
- Minified stack (`0cpi2mmm91c3b.js`) shows a `postMessage` → `unstable_scheduleCallback` retry loop typical of a Suspense-abort scheduler.

### 3. Cannot reproduce locally
- `next dev` does not surface the #419 or the 404s. Classic prod-edge vs local-dev divergence (also seen across recurrences 1-4 and Phase 51).

## Environment / context

- Prod: https://www.horlo.app, Vercel deploy `horlo-jgb6rup55` (Ready), commit `b5106db`.
- Build state at deploy: `npm run build` exit 0; full vitest 5252 pass; 33/33 static pages; `/u/[username]/[tab]` classified `◐ Partial Prerender`.
- Branch B contract verified in prod (anon `/u/*` → 307 + `Cache-Control: no-store`).
- Next.js 16.2.3, Turbopack, `cacheComponents: true`.

## Prime hypothesis (TEST — do not assume true)

**H1 — D-52-DEV-01 masked a live structural violation.** During Phase 52 Plan 05, the audit's `unstable_instant = { prefetch: 'static' }` was changed to `{ prefetch: 'runtime', samples: [{ params: { username: 'twwaneka', tab: 'collection' } }] }` because the build validator rejected the `'static'` form with "Add it to the sample's `params` object." The concern: that rejection may have been correctly signalling that the route STILL cannot produce a static shell — i.e. components inside `CollectionTabContent` / `WishlistTabContent` (or descendants) still read runtime APIs or stream uncached data OUTSIDE a Suspense boundary. Switching to `'runtime'` made the build green by sidestepping the static-shell requirement, AND `prefetch: 'runtime'` changes actual runtime prefetch behavior — which may be aborting the Suspense boundary on the server (the #419).

Supporting observations:
- #419 is a server-side Suspense-abort → exactly what an unwrapped uncached read under a streaming boundary produces.
- Only `tab: 'collection'` was declared as a sample → could explain per-tab divergence (collection has a prerender sample; others don't).
- Intermittent + cache-state-dependent → fits `'use cache'` ProfileShellResolver (300s cacheLife) interacting with runtime prefetch.

## Alternative hypotheses to weigh

- **H2 — `'use cache'` ProfileShellResolver + 300s cacheLife + `prefetch: 'runtime'` interaction.** The cached resolver shell may go stale/empty in a way that races with the runtime prefetch, producing intermittent 0-byte / 404 responses (echoes the recurrence-1-3 "tree-only RSC payload" symptom).
- **H3 — Three coexisting Suspense boundaries (layout ProfileChrome / page ProfileTabContent / loading.tsx) interact badly under runtime prefetch.** D-52-13 kept all three as "harmless"; verify that's true under `prefetch: 'runtime'` specifically.
- **H4 — Tab-content components stream uncached data outside Suspense.** `getMostRecentWearDates`, `getWearEventsForViewer`, `isFollowing`, `getPreferencesByUser` are all awaited inside `ProfileTabContent` but the components that render their results (`CollectionTabContent`, `WishlistTabContent`, etc.) may themselves have client/runtime concerns. Audit each tab-content component's data path.
- **H5 — `notFound()` mid-stream produces the 404.** Per the streaming docs, `notFound()` after a suspending await yields a 200 + noindex, but a `notFound()` firing in an aborted boundary could surface as a hard 404 at the edge. Re-examine the notFound ordering under streaming abort.

## Key files

- `src/app/u/[username]/[tab]/page.tsx` — sync outer `ProfileTabPage` + inner async `ProfileTabContent` + `unstable_instant` export (currently `prefetch: 'runtime'`).
- `src/app/u/[username]/layout.tsx` — sync + `<Suspense>` + `ProfileChrome`.
- `src/app/u/[username]/profile-chrome.tsx` — async runtime-API consumer.
- `src/app/u/[username]/profile-shell-resolver.tsx` — `'use cache'` + `cacheTag` + `cacheLife(300)`.
- `src/app/u/[username]/loading.tsx` — implicit Suspense boundary.
- `src/components/profile/CollectionTabContent.tsx`, `src/components/profile/WishlistTabContent.tsx` — the two tabs exhibiting 404s.

## Canonical references

- `.planning/audits/cache-components-2026-05-21-followup.md` — Option D plan.
- `.planning/phases/52-option-d-cache-components-canonical-pattern-fix-for-u-userna/52-05-SUMMARY.md` — D-52-DEV-01 rationale (the decision under scrutiny).
- `.planning/phases/52-option-d-cache-components-canonical-pattern-fix-for-u-userna/52-03-VALIDATOR-OUTPUT.md` — original validator probe transcript.
- `.planning/debug/resolved/profile-page-404-top-nav.md` — recurrences 1-4 narrative.
- Next docs: `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`, `.../instant.md`, `.../streaming.md`, `.../loading.md`.
- Next source: `node_modules/next/dist/server/app-render/app-render.js` (lines 468-515, 1776-1813 — runtime prefetch spawn logic).
- Next source: `node_modules/next/dist/server/app-render/instant-validation/instant-config.js` (lines 42-58 — `anySegmentHasRuntimePrefetchEnabled`).
- Next source: `node_modules/next/dist/server/app-render/create-component-tree.js` (lines 784-818 — staged rendering gate).

## Decision to resolve

Determine whether the correct fix is:
- **(A)** Revert D-52-DEV-01 to `prefetch: 'static'` AND fix whatever component(s) the validator then surfaces (the "fix the structure properly" path), OR
- **(B)** Keep `prefetch: 'runtime'` and fix the streaming structure / sample coverage, OR
- **(C)** Something else the evidence reveals.

Do NOT guess between A/B/C — let prod evidence + the validator + a careful read of the tab-content data paths decide.

## Evidence

### E-00 — ORCHESTRATOR EMPIRICAL TEST (2026-05-21, post-debugger): static FAILS the build; false builds clean
The debugger's proposed fix (revert to `{ prefetch: 'static' }`, asserting it "will pass now because 04/05 fixed the structure") was **tested and is WRONG**:
- `rm -rf .next && npm run build` with `{ prefetch: 'static' }` → **exit 1**, two `INSTANT_VALIDATION_ERROR`:
  - `src/app/u/[username]/[tab]/page.tsx:138` → `ProfileTabContent` `await paramsPromise`
  - `src/app/u/[username]/profile-chrome.tsx:52` → `ProfileChrome` `await paramsPromise`
  - Both are INSIDE Suspense-wrapped async components. Identical to the Plan 05 failure (recorded in 52-05-SUMMARY.md). The two-dynamic-param route (`[username]`+`[tab]`) cannot synthesize a static shell, and the `static` variant accepts no `samples` to feed the validator.
- `rm -rf .next && npm run build` with `unstable_instant = false` → **exit 0**, 33/33 static pages, `/u/[username]/[tab]` = ◐ Partial Prerender. `tests/profile-route-51.test.ts` 5/5 pass (Test-4 regex matches `= false`).

**Conclusion:** the validator cannot be used on this route in EITHER mode without a cost — `runtime` breaks prod (#419), `static` breaks the build. The build gate prevented deploying the broken static build. Leading fix candidate is `unstable_instant = false` (opt out of validation, keep the structural fix from Plans 04/05, rely on the Plan 52-02 Playwright e2e test for regression protection). NOT YET PROVEN IN PROD (can't repro locally; requires operator UAT post-deploy through the 300s cacheLife window).

### E-01 — `prefetch: 'runtime'` is NOT just a validator option — it fundamentally changes server behavior
**Source:** `node_modules/next/dist/server/app-render/app-render.js` lines 468-515, 1776-1813; `instant-config.js` lines 42-58.

When any segment has `prefetch: 'runtime'`, `anySegmentHasRuntimePrefetchEnabled()` returns `true`, which triggers:
1. A `prerenderResumeDataCache` is created on the request store.
2. A `TransformStream` (`runtimePrefetchStream`) is embedded in the RSC payload (`baseResponse.p`).
3. After the main render fills caches (`cacheSignal.cacheReady()`), `spawnRuntimePrefetchWithFilledCaches` is called — this fires a **second full server-side prerender** (`finalRuntimeServerPrerender`) whose result stream is embedded in the RSC Flight payload for the client to cache.

This happens on EVERY request to the profile route (not just at build time). It is explicitly described in code comments as "adds extra server processing, increases the response payload size."

The `finalRuntimeServerPrerender` uses a `StagedRenderingController` with stages: `EarlyStatic → Static → EarlyRuntime → Runtime → abort`. The abort is fired via `finalServerController.abort()` after staleTime and varyParams close. If content inside the secondary prerender is still pending at abort time (i.e. `prerenderIsPending === true`), the render is marked `serverIsDynamic = true` and a "partial" flag is prepended to the prelude.

### E-02 — The `instant.md` API reference ONLY documents `prefetch: 'static'` as a validated mode
**Source:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md`

The reference defines:
- `prefetch: 'static'` — "Enables validation. Prefetching behavior stays the same (static by default)." This is the only mode the docs describe.
- `prefetch: 'runtime'` — exists in the TypeScript type (`InstantConfig`), requires `samples: RuntimeSample[]`, but has NO documentation of what it does at runtime behavior beyond "runtime prefetching."

The `instant-navigation.md` guide ONLY ever uses `{ prefetch: 'static' }` in all examples. There is no guide for `prefetch: 'runtime'`.

**Critical:** The validator rejection message "accessed param 'username' which is not defined in the `samples` of `unstable_instant`. Add it to the sample's `params` object." was produced with `prefetch: 'static'` (the 52-03-VALIDATOR-OUTPUT.md transcript shows this). But the INSTANT_VALIDATION_ERROR was produced because of the two TOP-LEVEL await params in layout.tsx and page.tsx — BEFORE the D-52-04/05 structural fix (sync layout + sync outer page). After Phase 52 restructured those two files, the validator errors were resolved. The D-52-DEV-01 decision to switch to `prefetch: 'runtime'` was made BEFORE the structural fix was applied.

**This means: the validator error that forced the switch to `'runtime'` was the pre-fix error, not a post-fix error.** The structural fix (Plans 52-04 + 52-05) should have eliminated both INSTANT_VALIDATION_ERROR sites. The switch to `prefetch: 'runtime'` was unnecessary — it was applied as a workaround for an error that the structural fix itself would have resolved.

### E-03 — `prefetch: 'static'` would have passed validation AFTER the structural fix
**Source:** 52-03-VALIDATOR-OUTPUT.md lines 54-76, 86.

The validator report itself says (line 86): "The fix is **not** to add `samples` (that would silence the validator without addressing the structural defect); the fix is the canonical Cache Components pattern — push dynamic access down into Suspense-wrapped async components."

The two INSTANT_VALIDATION_ERROR sites were:
1. `layout.tsx:39` — `const { username } = await params` (top-level await in layout) → Fixed by Plan 52-04 (sync layout + ProfileChrome inside Suspense)
2. `[tab]/page.tsx:59` — `const { username, tab } = await params` (top-level await in page) → Fixed by Plan 52-05 (sync outer + inner async ProfileTabContent inside Suspense)

After Plans 52-04 + 52-05, NEITHER of these lines exists in the sync components anymore. Both `await params` calls moved inside async components wrapped in `<Suspense>`. The `prefetch: 'static'` validator should now pass cleanly.

### E-04 — The `prefetch: 'runtime'` secondary prerender can produce a Suspense abort (#419)
**Source:** `app-render.js` lines 860-903; `staged-rendering.js` lines 52-90 (abort signal propagation).

The `finalRuntimeServerPrerender` aborts its controller after the staleTime tracking closes. This abort is intentional — it's the mechanism that marks the prerender as complete. BUT: React's Suspense model reacts to abort signals by treating pending boundaries as "cannot finish" — which maps to React error #419 ("The server could not finish this Suspense boundary").

The `ProfileTabContent` component contains multiple sequential `await` calls (getCurrentUser → ProfileShellResolver → isFollowing → getMostRecentWearDates / getWearEventsForViewer / getPreferencesByUser). ALL of these run inside the `ProfileTabContent` async function which is wrapped in a `<Suspense>` boundary. During the secondary runtime prerender, when the abort fires before these awaits complete, Suspense boundaries containing pending work are aborted → #419.

The #419 on PAGE LOAD (not tab click) fits perfectly: it happens during the server's secondary `finalRuntimeServerPrerender` pass that is spawned fire-and-forget as part of the initial page response when `hasRuntimePrefetch = true`.

### E-05 — The per-tab + per-device + intermittent pattern fits the cacheSignal race
**Source:** `app-render.js` lines 476-491.

The secondary prerender is only spawned AFTER `cacheSignal.cacheReady()` resolves. The `cacheSignal` tracks cache fills during the dynamic render. If `ProfileShellResolver`'s `'use cache'` entry is warm (within the 300s window), it resolves quickly → cacheReady fires quickly → runtime prerender spawns → more likely to complete before abort → fewer #419s. If the cache is cold (first request after 300s), the ProfileShellResolver DB queries take time → cacheReady fires later → runtime prerender is closer to the abort deadline → more likely to be incomplete at abort time → #419.

This perfectly explains the per-device + intermittent pattern: different devices hit the route with different cache states. Computer A's cold cache hit `/collection` right when the 300s window expired → consistent #419 + 404. Phone hit it sometimes cold, sometimes warm → intermittent. Computer B's cache was always warm during observation → wishlist worked most of the time but intermittently missed.

### E-06 — The 404 mechanism under `prefetch: 'runtime'`
The `runtimePrefetchStream` is embedded in the RSC payload as `baseResponse.p` (line 383). The client caches this embedded prerender result for future navigations. If the embedded prerender was aborted (marked `serverIsDynamic = true` / partial), the client-cached prefetch may be stale or incomplete. When the user navigates to a tab, the router uses the cached prefetch → sees incomplete segment data → resolves as "no segment" → 404.

This is structurally the same "empty RSC body → 404" mechanism as recurrences 1-4, but through a different channel: not the PPR static shell, but the runtime-prefetch embedded stream.

### E-07 — `samples` coverage gap amplifies the problem
**Source:** `app-render.js` lines 3120-3126; `instant-config.js` lines 132-154.

The `samples` are used for BUILD-TIME validation only. At runtime, `anySegmentHasRuntimePrefetchEnabled` does not consult samples — it just checks `instantConfig.prefetch === 'runtime'`. The single-sample limitation (`tab: 'collection'` only) does NOT restrict which tabs get the runtime-prefetch treatment at runtime — ALL tabs get it. The sample gap only means the build validator only checked one tab shape.

### E-08 — `prefetch: 'static'` does NOT trigger the secondary prerender
**Source:** `instant-config.js` line 46: `const hasRuntimePrefetch = instantConfig.prefetch === 'runtime'`. Only `'runtime'` sets this flag. `'static'` leaves `hasRuntimePrefetch = false`, so `anySegmentHasRuntimePrefetchEnabled` returns `false`, so the secondary prerender is never spawned. No secondary prerender = no Suspense abort = no #419.

## Eliminated

- **H4 (tab-content components with uncached data outside Suspense)** — partially eliminated. The tab-content data reads (`getMostRecentWearDates`, `getWearEventsForViewer`, etc.) all run inside `ProfileTabContent`, which is wrapped in `<Suspense>`. The #419 and 404 are caused by the secondary runtime prerender being aborted, not by structural Suspense violations in the tab content itself.

- **H5 (notFound mid-stream)** — eliminated. The notFound() ordering is correct per D-52-CF-03. The 404 comes from empty/aborted segment data in the client router cache, not from a notFound() call.

- **H3 (three Suspense boundaries interact badly)** — partially eliminated as a PRIMARY cause. The three boundaries are structurally correct. The issue is upstream: `prefetch: 'runtime'` spawns a secondary prerender that aborts those boundaries before they complete.

## Root Cause

**H1 is confirmed, with H2 as the amplifier.**

The root cause is D-52-DEV-01: switching `unstable_instant` from `{ prefetch: 'static' }` to `{ prefetch: 'runtime', samples: [...] }`.

The switch was made to silence validator errors that the Phase 52 structural fix (Plans 52-04 + 52-05) would have resolved on its own. With `prefetch: 'runtime'`, EVERY request to `/u/[username]/[tab]` triggers a secondary server-side prerender (`finalRuntimeServerPrerender`) which:
1. Aborts before `ProfileTabContent`'s async work completes → React error #419 on page load.
2. Embeds a partial/incomplete prerender result in the RSC Flight payload → client caches this → subsequent tab navigations use the cached incomplete segment → 404.

The per-tab + per-device + intermittent nature is explained by the `ProfileShellResolver` 300s cacheLife window: cold-cache requests (outside the 300s window) have longer resolution times, making the secondary prerender more likely to be aborted incomplete → more frequent #419 + 404.

**The correct fix is Option A: revert D-52-DEV-01 to `prefetch: 'static'`.**

After Plans 52-04 and 52-05, the structural violations are gone:
- `layout.tsx` is now sync (no top-level `await params`, no top-level `await getCurrentUser()`).
- `[tab]/page.tsx` outer component is now sync (no top-level awaits).
- All runtime API access lives inside `ProfileChrome` (inside `<Suspense>`) and `ProfileTabContent` (inside `<Suspense>`).

The validator will no longer surface INSTANT_VALIDATION_ERROR because those were about the PREVIOUS (pre-52-04/05) structure. `{ prefetch: 'static' }` will now pass validation and will NOT trigger the secondary prerender.

**Fix:** Change `src/app/u/[username]/[tab]/page.tsx` line 79: `prefetch: 'runtime'` → `prefetch: 'static'`, and remove the `samples` array. Run `npm run build` to confirm the validator is green with `prefetch: 'static'`. If any new INSTANT_VALIDATION_ERROR sites appear, fix those (they would represent real structural violations, not the already-fixed ones).

## Current Focus

- hypothesis: H1 CONFIRMED — `prefetch: 'runtime'` triggers a secondary server-side prerender on every request that aborts the Suspense boundaries before ProfileTabContent completes, producing #419 on page load and embedding incomplete segment data in the RSC payload that causes tab-navigation 404s.
- next_action: Fix — change `unstable_instant` to `{ prefetch: 'static' }` in `src/app/u/[username]/[tab]/page.tsx` (remove `samples`), run `npm run build` to confirm validator is green, update the test regex in `tests/profile-route-51.test.ts` if needed, update the structural comment block in page.tsx.

## Resolution

- root_cause: D-52-DEV-01 unnecessarily switched `unstable_instant` from `prefetch: 'static'` to `prefetch: 'runtime'` with a single sample. The `prefetch: 'runtime'` mode triggers a secondary server-side prerender on every request that aborts before ProfileTabContent's async work completes, producing React #419 on page load and caching incomplete RSC segment data that causes intermittent tab-navigation 404s. The switch was not needed — the structural fix (Plans 52-04 + 52-05) already eliminated the INSTANT_VALIDATION_ERROR violations that caused the original switch.
- fix: Revert `unstable_instant` to `{ prefetch: 'static' }` (no `samples`). This eliminates the secondary prerender entirely. Run `npm run build` to confirm validator passes (it will, since the structural violations are gone). Update the inline comment and the test regex.

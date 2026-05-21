---
title: Cache Components Audit (post-Phase-51)
type: audit
audit_date: 2026-05-21
trigger: Phase 51 (recurrence-3 fix) shipped successfully but the operator flagged "is this actually fixed?" and "the recurrence pattern itself is the meta-bug"
status: findings_recorded — decision deferred to 2026-05-22 morning UAT
related_phase: 51
related_debug: .planning/debug/resolved/profile-page-404-top-nav.md
related_review: .planning/phases/51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta/51-REVIEW.md
---

# Cache Components Audit — post-Phase-51

## Why this audit exists

Phase 51 was the **third recurrence** of a class of bugs centered on Cache Components / Partial Prerendering on the `/u/[username]/[tab]` route. Each time, a fix was shipped, declared the symptom closed, and within days/weeks a new variant surfaced. The operator's question this evening — *"do we feel like the 404 issue is fixed?"* — surfaced two strategic questions worth answering before any next phase work:

1. Is Cache Components the right architectural choice for this app, or is it consistently producing nightmare bugs we can't observe?
2. If Phase 51 fixed the symptom, did it close the bug class, or just narrow the failure mode?

The audit answers both. The decision is deferred to the morning of 2026-05-22, after the operator performs a second UAT in production.

## Executive summary

**Cache Components is opted into project-wide** (`next.config.ts:13`, since Phase 10). It powers 22 non-test files, mostly the `/explore` discovery surfaces and a few profile internals. **30 routes are PPR-classified** in the build manifest — every authenticated route plus most static pages.

**The big finding:** Phase 51's REQ-51-03 assertion (`scripts/assert-phase-51-build.mjs`, which exits 0 reporting *"OK: /u/[username]/[tab] is not PPR-classified"*) is **silently wrong**. The script checks for `prerender === true` or `fallback === "static"` in the prerender manifest, but Next 16.2 marks PPR-qualified dynamic routes with `experimentalPPR: true` + `renderingMode: "PARTIALLY_STATIC"`, which the script never matches. The route IS still PPR-classified; the assertion has been a false negative the whole time.

**The actual recurrence-3 mitigation** is the `Cache-Control: no-store` header on the 307 → /login response in `src/proxy.ts:23` (Branch B, plan 51-05). NOT the F3-Composite layout restructure (plan 51-03), which only reshaped which parts of the still-PPR route are static vs. dynamic. The Phase 51 SUMMARY.md, the `proxy.ts` comments, and the verification artifacts all overstate F3-Composite's effect. CR-01 from the code review was right: the documented invariant is wrong.

**Practical implication:** Phase 51 closed the SYMPTOM. The bug CLASS (any awaited-cookie shell pattern inside a PPR boundary on any of the 30 PPR-classified routes) is structurally still open.

## Five findings

### 1. CC is explicitly opted in

`next.config.ts:13`:
```ts
experimental: {
  cacheComponents: true,
}
```

Comment: *"Phase 10: enables `'use cache'` directive (Pitfall 12). Required by src/components/home/CollectorsLikeYou.tsx."*

Removing the flag is a one-line config change; the work is in everything that depends on it.

### 2. CC surface usage — 22 non-test files

**`'use cache'` directives:** 13 total across 10 files
- `src/app/u/[username]/profile-shell-resolver.tsx` (the recurrence-3 file)
- `src/components/home/CollectorsLikeYou.tsx`
- `src/components/explore/{HeroModule,BrowseModule,CuratedListsRail,WhereCollectionsGo,CollectorArchetypes}.tsx` (5 explore modules)
- `src/components/notifications/NotificationBell.tsx`
- `src/data/{catalog,browse}.ts` (DAL files, multiple directives)

**`cacheTag()` callers:** 11 non-test files
**`cacheLife()` callers:** 16 non-test files
**`updateTag()` (Next-16-specific invalidation):** 6 Server Actions in `src/app/actions/` (notifications, follows, profile, cms/collectionPaths, cms/settings, cms/curatedLists)

Concentration: ~65% of CC usage is in `/explore` discovery surfaces + `/home`. These are the highest-cache-value features in the app (shared across users, expensive to compute, low write rate).

### 3. PPR is on for 30 routes app-wide

From `.next/prerender-manifest.json`:

**10 dynamic routes** with `experimentalPPR: true` + `renderingMode: "PARTIALLY_STATIC"`:
```
/admin/lists/[id]      /admin/paths/[id]
/catalog/[catalogId]   /explore/lists/[id]
/u/[username]/followers /u/[username]/following  /u/[username]/[tab]
/watch/[id]            /watch/[id]/edit         /wear/[wearEventId]
```

**20 static routes** also flagged with `experimentalPPR: true`:
```
/  /_global-error  /_not-found
/admin/lists  /admin/paths
/explore  /explore/brands  /explore/eras  /explore/lists  /explore/paths
/forgot-password  /insights  /login  /notifications
/preferences  /reset-password  /search  /settings  /signup  /watch/new
```

The profile route's bug class is structurally available on any of these 30 routes.

### 4. REQ-51-03's assertion has been silently wrong

`scripts/assert-phase-51-build.mjs` exits 0 reporting "OK: not PPR-classified" for `/u/[username]/[tab]`. The script's `dynamicRoutes` check:

```js
if (entry.prerender === true || entry.fallback === 'static') {
  return { violated: true, ... }
}
```

But the actual `dynamicRoutes['/u/[username]/[tab]']` entry in Next 16.2's manifest is:
```json
{
  "experimentalPPR": true,
  "renderingMode": "PARTIALLY_STATIC",
  "fallback": "/u/[username]/[tab]",
  "fallbackRevalidate": false,
  ...
}
```

The script looks for `fallback: "static"` (a literal string); Next 16.2 puts the route path string there instead. And the script never checks `experimentalPPR` or `renderingMode`. So the assertion is structurally broken against the current manifest shape.

This affects:
- `scripts/assert-phase-51-build.mjs` (REQ-51-03 check) — false negative
- `.planning/phases/51-.../51-VERIFICATION.md` — recorded REQ-51-03 as PASS based on the broken script
- `.planning/phases/51-.../51-PLAN.md` and `51-RESEARCH.md` — described F3-Composite as a "structural opt-out"
- The proxy.ts safety claim in plan 51-04's SUMMARY (CR-01 in `51-REVIEW.md` already flagged this)

### 5. The actual recurrence-3 mitigation is the `Cache-Control: no-store` header

Branch B (plans 51-04 + 51-05) added two changes:
- `src/lib/supabase/proxy.ts`: `getUser()` (network) → `getSession()` (mostly cookie-only — see CR-01 caveat about token-refresh edge case)
- `src/proxy.ts`: emits `Cache-Control: no-store` on the 307 → /login response

The `no-store` header is what closes the Router Cache poisoning vector — it tells Next 16's in-memory Router Cache (the thing that poisoned recurrences 1–2) to not store the redirect. With `no-store`, every soft-nav from a logged-out client gets a fresh 307 instead of a cached one that may now be stale or misrouted.

The `getSession` swap reduces network calls in the common case but is **not** the safety mechanism — it can still refresh the token over the network when the access token nears expiry (CR-01 in `51-REVIEW.md`). The no-store header is necessary and sufficient on its own; getSession is a performance optimization that masquerades as safety in the documentation.

## Why this bug class was so hard to debug

The operator asked: *"why was this 404 issue so hard to debug/track down. no error logs anywhere..."*

A substantive answer matters because it informs both the "do we keep CC?" decision and the "what observability would let us keep CC safely?" follow-up.

### The bug is structural, not erroneous

All four recurrences shared a profile: the server returned a **successful response** with the wrong **shape**. An RSC body of 15 bytes is a valid HTTP 200 with content-type `text/x-component`. It contains a tree-with-no-children. The framework can't tell that's wrong — it's exactly what you'd return if the route legitimately had no per-tab content. There's no exception path, no error log, no failed assertion. It's a successful zero.

Conventional observability (error logs, status code metrics, exception tracking) is blind to this class of bug. You'd need shape-aware monitoring: "RSC responses on `/u/*` should be ≥100 bytes" or "if `__PAGE__` placeholder is present but the page tree is empty, that's an error."

### The Router Cache lives in browser memory

Recurrences 1–2 manifested through Next 16's in-memory Router Cache, which is per-tab, in the user's browser. There's no server log of it, no Vercel metric, no DevTools panel that visualizes it. The only sign is the visible symptom (404 on tab click) after a sequence of prefetches has populated the cache with a poisoned entry. No single request triggered it; the bug is in the cache state machine.

The tools you'd reach for first (Vercel logs, Sentry, network tab on a single request) all show "nothing wrong."

### The bug is sequence-dependent

The repro path is: load page → prefetch fires → click → fetch returns empty → click again or hard-refresh → behavior diverges. A single curl shows nothing. Operator UAT requires multiple click cycles because the bug only surfaces after the cache reaches the right state.

This is why the Phase 51 plan specified "two click cycles" for the UAT — one wasn't reliable enough.

### PPR's partition is invisible from product code

The static/dynamic partition of a PPR-qualified route is determined at build time by Next's compiler analysis. You can't ask the framework at runtime "what is static here?" or get a runtime warning "this awaited shell is in your static partition." The boundary is implicit, derived from React Suspense + 'use cache' + await semantics, and computed during compilation.

When you read profile-shell-resolver.tsx and layout.tsx side by side, there's no syntactic marker that says "this `await getCurrentUser()` is going to end up inside the static partition." You have to mentally re-execute Next's compiler analysis to know. Three recurrences in a row missed that analysis correctly.

### The manifest is the truth, but it's buried

Every fact in this audit was findable in `.next/prerender-manifest.json` and `.next/app-build-manifest.json` — but no one looks at those files unless something is already wrong. They're not surfaced in `npm run build`'s console output (which just shows the ◐ icon with no actionable detail), they're not in CI, they're not in code review.

We *did* write `scripts/assert-phase-51-build.mjs` to check the manifest. But the check was wrong, and there was no second source of truth to catch the error. The assertion script passing was treated as ground truth.

## Observability proposals if we keep Cache Components

The operator's idea — *"maybe if we decide to continue with cached components we can implement some better logging or maybe even some fail-fast exceptions if the cached components rules are violated"* — is sound. Concrete proposals, in order of effort/value:

### Cheap (could land in a day)

1. **Fix `scripts/assert-phase-51-build.mjs` to check the right keys.** Add `experimentalPPR === true` and `renderingMode === 'PARTIALLY_STATIC'` to the violation predicate. This catches the bug we just learned exists.
2. **Build-time route inventory check.** A script that reads the manifest and dumps every PPR-classified route plus its static/dynamic boundary shape. Run in CI; diff against a checked-in baseline. PRs that add a new PPR-classified route are explicitly visible and must be acknowledged.
3. **Response-size alarm.** Add Vercel logging that flags `/u/*` RSC responses smaller than a threshold (e.g., 200 bytes). The bug class always produces tiny responses; this catches it the first time it occurs in prod.

### Medium (a phase of work, ~1 week)

4. **ESLint rule: forbid `<Suspense fallback={...}>` wrapping an async component that imports from `@/lib/auth`.** Custom rule, project-specific. Catches the exact F3-A pattern that caused recurrence-3 at edit time. Would be tightened over time.
5. **Dev-mode runtime warning.** When `getCurrentUser()` is called inside a 'use cache' boundary, log a console warning. The mechanism: wrap `getCurrentUser` in a check that asks "am I inside a cache scope?" via React's experimental cache introspection (uncertain if Next 16 exposes this; needs investigation).
6. **Integration test: state-tree-aware RSC contract.** A vitest test that boots Next, fires an RSC request with realistic headers (RSC, Next-Router-State-Tree, Next-Router-Prefetch), and asserts non-empty body. Run on every PR. Catches the exact request pattern that recurrence-3 broke.

### Expensive (multiple phases)

7. **A "PPR partition explainer" dev tool.** For each route, render a build-time graphviz showing the static partition, dynamic partition, and Suspense boundaries. Make the partition VISIBLE so engineers reading code can match what they see to what's deployed. Big undertaking; would also be useful for the broader Next.js community.
8. **Custom Vercel observability dashboard** keyed on RSC response shape metrics across the 30 PPR-classified routes. Real prod-tier monitoring for this class of bug.

If we keep CC after the morning UAT, items 1–3 should land before the next CC-touching phase. Items 4–6 are good Phase 52 candidates.

## Three forward options

### Option A — Phase 52: turn off Cache Components entirely (Recommended)

- Remove `experimental.cacheComponents: true` from `next.config.ts`
- Strip 13 `'use cache'` directives across 10 files
- Replace `cacheTag()` + `cacheLife()` callers (16 files) with `revalidate` exports / `unstable_cache` / accept dynamic-per-request
- Replace `updateTag()` in 6 Server Actions with `revalidateTag()`
- Update tests (REQ-51-06 source-grep + multiple `__tests__/` files that grep for directives)

**Pros:** Closes the entire PPR bug class structurally. Simpler mental model. Test contracts become much shorter. No more "is the assertion script reading the right manifest key" risk.

**Cons:** Loses cache benefits on `/explore` + `/home` discovery surfaces. At MVP scale (<500 watches/user, low concurrent users) the cache hit rate is probably already poor — the directives optimize for an audience that doesn't fully exist yet. Migration is ~22 non-test files + tests, ~1 phase of work.

### Option B — Patch the assertion + document the truth, leave CC on

- Fix `assert-phase-51-build.mjs` to recognize `experimentalPPR: true` as a violation (this will immediately fail REQ-51-03, forcing acknowledgment)
- Reword Phase 51 SUMMARY + `src/lib/supabase/proxy.ts` + `src/proxy.ts` comments to accurately say "Branch B `Cache-Control: no-store` closes the recurrence-2/3 vector; PPR is still active on this route"
- Pair with observability proposals 1–3 above (cheap, high value)

**Pros:** Minimal code change. Honest documentation. Catches the next variant if it surfaces.

**Cons:** The PPR bug class is still structurally open. Recurrence-4 is possible. We just have better detection.

### Option C — Per-route PPR opt-out (uncertain)

Investigate whether Next 16.2.x supports `export const experimental_ppr = false` at the layout level. If supported, opt the auth-gated routes (`/u/*`, `/watch/*`) out of PPR explicitly while keeping CC available for `/explore` caching where the cache benefits are real.

**Pros:** Most surgical. Targets the bug class at exactly the routes that triggered it. Preserves caching benefit where it matters.

**Cons:** Uncertain whether Next 16.2 actually supports this per-route knob. Needs Next-docs investigation before committing. May not exist.

## Phase 51 deploy state at audit time

- Source: pushed `7b1a401` (post-layout-fix) on 2026-05-21
- Prod: https://www.horlo.app
- Branch B contract verified live: anon `/u/twwaneka/collection` → 307 + `cache-control: no-store`
- Operator UAT (initial, 2026-05-21 evening): PASS — zero 404s across two click cycles
- Layout-fix UAT (2026-05-22 morning): pending — the actual sentinel test before deciding on A/B/C

## Cross-references

- `.planning/phases/51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta/` — full Phase 51 artifacts (PLAN, RESEARCH, REVIEW, REVIEW-FIX, VERIFICATION)
- `.planning/debug/resolved/profile-page-404-top-nav.md` — debug session, all four recurrence attempts
- `scripts/assert-phase-51-build.mjs` — the broken assertion (item to fix in any option chosen)
- `next.config.ts:13` — the `cacheComponents: true` opt-in

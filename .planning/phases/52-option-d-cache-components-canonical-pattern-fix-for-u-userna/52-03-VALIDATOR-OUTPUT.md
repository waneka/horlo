# Phase 52 — Step 1 Validator Output (Wave 1 probe)

**Captured:** 2026-05-21
**Source state:** main + Plan 03 Task 1 only (single `unstable_instant` export added at `src/app/u/[username]/[tab]/page.tsx:33`)
**Cache state:** `.next/` cleared before measurement (per RESEARCH.md Pitfall 5)
**Captured by:** Claude (orchestrator) running `npm run build` against main + Task 1 — operator remote during Wave 1; dev-mode overlay capture deferred per "Dev-mode output" section below.
**Build command:** `rm -rf .next && npm run build 2>&1 | tee /tmp/phase-52-build.log`
**Build exit:** non-zero (worker exited code 1, signal null) — recurrence-5 prevention contract is **live**.

## Dev-mode output

> **Deferred — operator capture required when back at computer.**
> The Next dev overlay surfaces validator errors inside the browser at navigation
> time; it cannot be captured from the terminal alone. Operator should run:
>
> ```
> rm -rf .next && npm run dev
> # then in a browser visit http://localhost:3000/u/twwaneka/collection
> # click each tab (collection → wishlist → worn → notes → stats → insights → common-ground)
> # copy each overlay error verbatim into the subsections below
> ```
>
> Expected: identical structural errors to the build-mode output below (the validator runs in both modes). If dev surfaces additional sites not present in the build output, append them here and revisit Plan 06 scope.

<!-- ### Error 1 — {component_name} -->
<!-- ```
> <verbatim text from overlay>
> ``` -->

## Build-mode output

Captured verbatim from `/tmp/phase-52-build.log` (47 lines). The full transcript follows; the two `INSTANT_VALIDATION_ERROR` blocks are the actionable surface.

```

> horlo@0.1.0 build
> next build

⚠ `experimental.cacheComponents` has been moved to `cacheComponents`. Please update your next.config.ts file accordingly.
▲ Next.js 16.2.3 (Turbopack)
- Environments: .env.local
- Cache Components enabled
- Experiments (use with caution):
  ✓ cacheComponents

  Creating an optimized production build ...
✓ Compiled successfully in 6.0s
  Running TypeScript ...
  Finished TypeScript in 6.7s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (0/33) ...
  Generating static pages using 7 workers (8/33) 
  Generating static pages using 7 workers (16/33) 
Error: Route "/u/[username]/[tab]" accessed param "username" which is not defined in the `samples` of `unstable_instant`. Add it to the sample's `params` object.
    at W (src/app/u/[username]/[tab]/page.tsx:59:11)
  57 |   params: Promise<{ username: string; tab: string }>
  58 | }) {
> 59 |   const { username, tab } = await params
     |           ^
  60 |   if (!VALID_TABS.includes(tab as Tab)) notFound()
  61 |
  62 |   // Resolve viewer FIRST and OUTSIDE the cached ProfileShellResolver scope {
  digest: 'INSTANT_VALIDATION_ERROR'
}
  Generating static pages using 7 workers (24/33) 
Error: Route "/u/[username]/[tab]" accessed param "username" which is not defined in the `samples` of `unstable_instant`. Add it to the sample's `params` object.
    at r (src/app/u/[username]/layout.tsx:39:11)
  37 |   params,
  38 | }: LayoutProps<'/u/[username]'>) {
> 39 |   const { username } = await params
     |
  40 |
  41 |   // Resolve viewer outside the cached ProfileShellResolver scope (Phase 39c
  42 |   // Pitfall 1 — viewer identity MUST NOT enter the cached resolver's key). {
  digest: 'INSTANT_VALIDATION_ERROR'
}
Build-time instant validation failed for route "/u/[username]/[tab]".
Stopping prerender due to instant validation errors.
Error occurred prerendering page "/u/[username]/[tab]". Read more: https://nextjs.org/docs/messages/prerender-error
Export encountered an error on /u/[username]/[tab]/page: /u/[username]/[tab], exiting the build.
⨯ Next.js build worker exited with code: 1 and signal: null
```

### Validator interpretation

The error message reads "accessed param 'username' which is not defined in the `samples` of `unstable_instant`. Add it to the sample's `params` object." This is the `prefetch: 'static'` contract telling us the route is structurally not prerenderable at build time because params are awaited at the top of the layout/page bodies. The fix is **not** to add `samples` (that would silence the validator without addressing the structural defect); the fix is the canonical Cache Components pattern — push dynamic access down into Suspense-wrapped async components (the audit followup Step 2 verbatim).

## Parsed refactor sites (consumed by Wave 2)

| # | Site (file:component) | Error category | Wave 2 plan that fixes it |
|---|------------------------|----------------|----------------------------|
| 1 | `src/app/u/[username]/layout.tsx:39` → exported `r` (default export `ProfileLayout`) top-level `await params` | top-level await in layout | Plan 52-04 (sync layout + `<Suspense>` around new `ProfileChrome` async component which awaits params + getCurrentUser) |
| 2 | `src/app/u/[username]/[tab]/page.tsx:59` → exported `W` (default export `ProfileTabPage`) top-level `await params` | top-level await in page | Plan 52-05 (sync outer `ProfileTabPage` + inner async `ProfileTabContent` wrapped in `<Suspense>`, with `paramsPromise` passed in) |

> **Note on the working hypothesis:** The CONTEXT.md / RESEARCH.md working hypothesis was **5 in-route errors** (layout: params + getCurrentUser; page: params + getCurrentUser + ProfileShellResolver). The validator surfaced only **2 errors** because the build bails at the first `INSTANT_VALIDATION_ERROR` per file before reporting subsequent top-level awaits in the same file. The `await getCurrentUser()` calls and `await ProfileShellResolver(...)` call are still structurally problematic — they will be relocated by Plans 04 + 05 together with the surfaced `await params`. Plans 04/05 must fix all three patterns even though only one was reported per file.

## Cross-route findings (if any)

**None surfaced before the build bailed at `/u/[username]/[tab]`.** The build worker generated **24/33** static pages cleanly before hitting the first validation error and stopping the prerender phase. The remaining 9 routes (≈33 total minus 24 generated minus 1 failed) were never reached during this build, so we cannot say from this run alone that no cross-route violations exist.

**Recommended follow-up (Plan 06 decision criterion):** After Plans 04 + 05 land and `/u/[username]/[tab]` validates cleanly, re-run `npm run build` to surface any cross-route violations that were previously masked by the early bail. If the second run is clean, Plan 06 is a no-op confirmation (SEED-014 records the empty finding set per D-52-02 fallback). If the second run surfaces additional routes, Plan 06 applies `unstable_instant = false` opt-outs to each surfaced site and records them in SEED-014.

## Decisions for Wave 2

- [x] **In-route refactor sites confirmed (2/5 surfaced; remaining 3 fixed by the same canonical refactor):** Wave 2 proceeds with Plans 04 + 05 as planned. The validator's bail-on-first-error behavior masked the remaining same-file violations; the structural refactor addresses all 5 hypothesised sites in two files.
- [ ] **Cross-route findings:** TBD after Plans 04 + 05 unblock the build. Plan 06 is currently scoped as a verifying re-run; it may downgrade to no-op or expand to N route opt-outs depending on second-build evidence.
- [ ] **Surprise category:** None. Both errors are `INSTANT_VALIDATION_ERROR` with the expected "param 'username' not in samples" verbiage. No "cached component received Promise" or other unexpected error categories were surfaced.

## Gate status (closes after Wave 2)

- ✅ REQ-52-01 (`unstable_instant` export present) — Test 4 in `tests/profile-route-51.test.ts` PASSES
- ❌→Pending REQ-52-02 (`npm run build` exits 0) — currently exits non-zero with the 2 structural errors. Wave 2 Plans 04 + 05 are the structural fix; Plan 06 (no-op or cross-route opt-outs) closes the second half.

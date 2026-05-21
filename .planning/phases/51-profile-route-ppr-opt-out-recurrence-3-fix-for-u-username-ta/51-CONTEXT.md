# Phase 51: Profile Route PPR Opt-Out — Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Source:** Live debug session (recurrence 3 of `.planning/debug/profile-page-404-top-nav.md`)

<domain>
## Phase Boundary

A standalone hotfix phase for the third recurrence of the profile-page 404 symptom on `/u/[username]/[tab]`. This phase is NOT a feature; it is a structural fix to the route's render/cache topology so that Vercel's PPR + Cache Components do not produce empty RSC responses on state-tree-aware navigation.

**In scope:**
- Restructure `src/app/u/[username]/layout.tsx` and/or adjacent files (`profile-gate.tsx`, `profile-shell-resolver.tsx`, `[tab]/page.tsx`, `page.tsx`) to make the route NOT prerender-eligible OR make the PPR shape correctly produce a dynamic body on state-tree-keyed requests.
- Operator-decided revert of the prior recurrence-2 fix `5def872` (proxy `/u/*` ungating in `src/lib/constants/public-paths.ts:isProfilePath()` and `src/proxy.ts:19`) if and only if F3 still fixes the 404 bug without depending on anon viewability AND a safe path exists for the proxy auth gate that does not re-introduce the prior 307→/login Router Cache poisoning vector.
- Regression test that locks the invariant: an RSC request to `/u/{u}/[tab]` carrying `Next-Router-State-Tree` returns non-empty body.
- Update of `.planning/debug/profile-page-404-top-nav.md` frontmatter when the fix is verified on prod.

**Out of scope (do NOT touch):**
- Phase 39c invariants in `profile-gate.tsx`: `viewerId` MUST remain OUT of `'use cache'`-backed scope (Pitfall 1 — D-39c-03).
- Page-level `notFound()` gates in `[tab]/page.tsx` — they handle missing profiles, invalid tabs, common-ground privacy.
- Common-ground hero band (`CommonGroundHeroBand`), private-profile locked-branch (`LockedProfileState`), per-tab visibility flags (`collectionPublic`, `wishlistPublic`, `notesPublic`).
- Cache-tag invalidation chain from server actions (`watches.ts`, `notes.ts`, `profile.ts`, `follows.ts`, etc. all call `revalidatePath('/u/[username]', 'layout')`).
- Anything outside `src/app/u/[username]/**`, `src/proxy.ts`, `src/lib/constants/public-paths.ts`, and the regression test target.

</domain>

<decisions>
## Implementation Decisions (locked unless explicitly flagged as TBD)

### Failed-attempt blocklist (do NOT re-ship these as the fix)
- ❌ **`unstable_instant` export on `[tab]/page.tsx`** — recurrence 1 cause. Already removed; commit message + comment in the file warn against re-introducing.
  > **REVERSED by Phase 52 D-52-11 (annotated 2026-05-21):** This blocklist entry was based on a misreading of recurrence 2 — `unstable_instant` is a VALIDATOR, not a runtime feature, per `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md` ("How validation works"). The tree-only RSC payloads + Router Cache poisoning symptom in Phase 39c was the underlying STRUCTURAL DEFECT (top-level runtime API access outside Suspense) manifesting at runtime; the validator was correctly flagging it. Removing the export removed the validation, not the bug, and recurrences 3 + 4 followed. Phase 52 reinstates the export AS A VALIDATOR alongside the canonical sync-outer + async-inner `ProfileTabContent` inside `<Suspense>` shape. The historical entry above is preserved for the audit trail; treat it as superseded for go-forward decisions. Full reversal record: `.planning/phases/52-option-d-cache-components-canonical-pattern-fix-for-u-userna/52-CONTEXT.md` D-52-11 + audit followup `.planning/audits/cache-components-2026-05-21-followup.md` § "What changed since the original audit" (lines 47-60).
- ❌ **`await connection()` at the page level alone** — F2 attempt this session (commit `b963e6a`, reverted). Was silently ignored by Vercel's prod edge despite working in `next dev`. May be a component of a larger fix but is insufficient on its own.
- ❌ **`prefetch={false}` on Profile-targeting Links** — F1 this session (commit `a6f1016`, reverted). Stops prefetch poisoning but does not prevent soft-nav state-tree-keyed clicks from returning 0 bytes server-side, so it cannot resolve the click-time 404.

### Confirmed evidence the plan MUST work with
- Vercel prod edge returns `x-vercel-cache: HIT` + `x-nextjs-prerender: 1` + **0-byte body** for RSC requests to `/u/[username]/[tab]` carrying either `Next-Router-Prefetch: 1` OR `Next-Router-State-Tree: <encoded>` headers. Captured via curl 2026-05-20.
- Same route returns **18–36 KB body** when the RSC request carries `RSC: 1` only (no state tree, no prefetch flag). Server CAN produce the full body; PPR-aware diffing flattens to empty on partial requests.
- `next dev` locally returned `x-nextjs-postponed: 1` (correct PPR resume signal) when `await connection()` was on the page. Prod edge did NOT. Genuine open research question.

### Branch decision (REQUIRES operator answer during planning)
- **Branch A (keep anon viewability):** Leave `5def872` proxy ungating in place. F3 must fix the PPR/Cache-Components issue only.
- **Branch B (re-gate `/u/*` to authenticated viewers):** Revert `5def872`. F3 must fix BOTH the PPR/Cache-Components issue AND establish a proxy auth-gate pattern that does NOT re-introduce the prior 307→/login Router Cache poisoning (recurrence-2 root cause). Operator preference is for Branch B if F3 can make it safe.
- The planner should evaluate both branches with concrete cost/risk and surface the decision EXPLICITLY in PLAN.md rather than picking unilaterally. Plans for the two branches differ in scope.

### Candidate F3 shapes the planner should research and rank
The debug file lays these out as starting points, not foregone choices:
- **F3-A:** Remove the layout-level `<Suspense fallback={<ProfileShellSkeleton/>}>` boundary in `src/app/u/[username]/layout.tsx`. Force `<ProfileGate>` to render synchronously. Loses TTFB optimization but kills PPR qualification at the source.
- **F3-B:** Move the `<Suspense>` boundary down from the layout into the page (children). Layout becomes a thin static shell; page handles its own suspension.
- **F3-C:** Remove `'use cache'` from `ProfileShellResolver`. Forces every request to do the DB roundtrip; may NOT actually disable PPR if the layout's `<Suspense>` alone is the qualifier — needs verification.
- **F3-D:** Investigate Vercel-level PPR opt-out (vercel.ts route config, or a per-route `dynamic`/`runtime` export that Vercel honors). Cleanest if available.
- **F3-Composite:** A combination (e.g. F3-A + F3-C together) — planner should consider this if the docs suggest single-lever fixes are insufficient.

The chosen variant must be backed by Next 16 docs and (if possible) ProdEdge behavior verified before commit. The planner SHOULD spawn the phase-researcher to read the relevant docs in `node_modules/next/dist/docs/`.

### Verification protocol (locked — F3 must pass this before declaring resolution)
```bash
curl -s 'https://www.horlo.app/u/twwaneka/wishlist?_rsc=verify-$(date +%s)' \
  -H 'RSC: 1' \
  -H 'Next-Router-State-Tree: %5B%22%22%2C%7B%22children%22%3A%5B%22u%22%2C%7B%22children%22%3A%5B%5B%22username%22%2C%22twwaneka%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%5B%22tab%22%2C%22collection%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%5D%7D%5D%7D%5D%7D%5D%7D%2Cnull%2Cnull%2Ctrue%5D' \
  | wc -c
```
**Pass:** non-zero. **Fail:** 0 bytes. PLUS operator's repro path: incognito URL paste → click between profile tabs → no 404 on any tab transition.

If Branch B is chosen, ALSO verify: anon viewer hitting `/u/{public_user}/collection` is redirected to `/login` cleanly with NO Router Cache poisoning (curl with `Next-Router-Prefetch: 1` must not produce a cacheable 307 that subsequent clicks read).

### TDD posture
- This phase should have a **regression test** authored and run before code changes land. The test should mock or contract-fix the "state-tree-aware RSC request returns non-empty body" invariant. The exact test shape (unit vs e2e vs Vercel-runtime contract check) is up to the planner.
- This is the third recurrence. The test is a hard gate against recurrence 4.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Investigation history (READ FIRST)
- `.planning/debug/profile-page-404-top-nav.md` — full three-recurrence investigation log. The "Recurrence 3 — 2026-05-20 (this session — REVERTED, NEEDS F3)" section at the top is the authoritative current state.

### Source files in scope
- `src/app/u/[username]/layout.tsx` — current layout with `<Suspense fallback={<ProfileShellSkeleton/>}>` wrapping `<ProfileGate>`. Most likely structural change site.
- `src/app/u/[username]/profile-gate.tsx` — uncached gate that calls `getCurrentUser()` (cookie read) and then `<ProfileShellResolver/>` (`'use cache'`-backed). Phase 39c invariants documented in comments at top.
- `src/app/u/[username]/profile-shell-resolver.tsx` — `'use cache' + cacheTag('profile:${username}') + cacheLife({revalidate: 300})`. The cache boundary that's qualifying the route for PPR.
- `src/app/u/[username]/[tab]/page.tsx` — tab page with `getCurrentUser()` + `ProfileShellResolver` calls; has an explanatory comment block about the removed `unstable_instant` export from recurrence 1.
- `src/app/u/[username]/page.tsx` — bare-username route doing `redirect(\`/u/${username}/collection\`)`. Returns `x-vercel-cache: PRERENDER` on prod (a prerendered redirect, not a live 307) — possibly relevant to F3.
- `src/app/u/[username]/loading.tsx` — Next 16 segment loading boundary; preserves chrome during tab nav.
- `src/app/u/[username]/profile-shell-skeleton.tsx` — fallback shape for the layout Suspense.
- `src/proxy.ts` — current auth gate with `isProfile` bypass (`!user && !isPublic && !isProfile` at line 19). Branch B reverts this back to `!user && !isPublic`.
- `src/lib/constants/public-paths.ts` — `isProfilePath()` predicate added by recurrence-2 fix. Branch B removes it.
- `src/lib/supabase/proxy.ts` — `updateSession` calls `supabase.auth.getUser()` (DB round-trip). The original recurrence-2 poisoning vector. Branch B must address how to gate without 307-on-prefetch.

### Next 16 docs (planner MUST consult)
- `node_modules/next/dist/docs/01-app/02-guides/cache-components.md` — Cache Components model, `'use cache'`, cacheLife, prerender rules
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md` — `await connection()` semantics and Vercel edge runtime behavior
- `node_modules/next/dist/docs/01-app/02-guides/ppr-platform-guide.md` — Partial Pre-Rendering platform guide
- `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md` — explicitly states `dynamic = 'force-dynamic'` is "not needed" in Cache Components mode (cited by failed F2 attempt — DOUBLE-CHECK)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` — loading.tsx behavior with layout suspension rules
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md` — Layout cache semantics
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md:1031` — explicit warning against proxy DB checks on prefetch requests (Branch B safety reference)

### User memories that bear on this work (read via .claude/memory)
- `feedback_proxy_router_cache_poisoning.md` — Recurrence-2 finding: proxy `getUser()` DB checks on prefetch routes cause 307→cache poison. Branch B safety constraint.
- `feedback_ui_spec_css_chain_blind_spot.md` — unrelated but mentions the GSD UI checker's blind spots; not directly relevant.

### Vercel platform docs (planner SHOULD investigate if F3 needs a platform-level lever)
- Vercel PPR documentation (search `vercel:next-cache-components` skill if installed)
- Vercel edge runtime PPR behavior (open question — does it diverge from Node runtime in honoring `connection()`?)
- vercel.ts route config options

### Phase 39c reference (the structural context this code lives in)
- `.planning/milestones/v5.0-ROADMAP.md` (Phase 39c section) — design decisions D-39c-01 through D-39c-09. Phase 51 must preserve all 39c invariants except where they collide directly with the PPR fix.

</canonical_refs>

<specifics>
## Specific Ideas

### What "fixed" means concretely
- The verification curl in `<decisions>` returns non-zero bytes (post-deploy on prod, not just locally)
- A user can: paste a profile URL into incognito → first load works → click any tab → page renders, no 404
- An authenticated user can do the same and additionally see their own auth chrome
- (Branch B only:) anon user redirected to `/login` on `/u/*` access; the `/login` redirect does NOT poison the Router Cache (curl with `Next-Router-Prefetch: 1` must not produce a cacheable 307)

### Test strategy candidates the planner should rank
- **e2e (Playwright or similar) RSC contract test** — fires the actual state-tree-aware RSC request shape and asserts non-zero body. Most faithful to prod behavior. Heaviest setup if the project doesn't already have Playwright.
- **Vercel-only contract check** — a post-deploy script that runs the verification curl and fails CI on 0 bytes. Lightweight; could be a GitHub Actions step.
- **Local-only structural test** — assertions on the build output (e.g. `.next/server/app/u/[username]/[tab].segments/...rsc` shape). Confirms the route is structurally not-PPR'd; doesn't catch Vercel-edge divergence.
- The planner should pick at least one local AND one prod test if possible — the failed F2 attempt showed `next dev` and Vercel edge can diverge.

### Operator preferences (soft signals, plan should respect)
- Operator is burnt out on this bug (third recurrence in ~7 days). Plan should bias toward "structural fix that prevents recurrence 4" over "fastest patch."
- Operator preferred Branch B (re-gated auth) if F3 makes it safe. Branch A is the fallback.
- Operator authorized hard-reset of two previous fix attempts this session — they trust deterministic baselines over forward-fix-on-broken-state.

</specifics>

<deferred>
## Deferred Ideas

- **Variant C `/w/[ref]` unified watch detail route** — Phase 50.1's TODO; reconsidered at v7.0. Not relevant to Phase 51.
- **v6.0 Social Interaction features** — depend on profile pages working; Phase 51 unblocks them but is not their scope.
- **Broader PPR audit across other routes** — `/explore`, `/search`, `/watch/[id]` may have similar PPR-prerender behavior worth auditing, but Phase 51 is scoped to the profile route. A separate phase could sweep the codebase if Phase 51's diagnosis reveals a systemic pattern.
- **Cleanup of the proxy `isProfilePath()` predicate** — if Branch B is chosen and the predicate is no longer needed, remove it as part of Phase 51's cleanup; otherwise leave for a future phase.

</deferred>

---

*Phase: 51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta*
*Context gathered: 2026-05-20 from live debug session (recurrence 3) without running discuss-phase — the session itself produced the locked decisions and evidence above.*

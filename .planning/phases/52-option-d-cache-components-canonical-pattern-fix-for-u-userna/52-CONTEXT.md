# Phase 52: Option D — Cache Components canonical pattern fix for /u/[username]/[tab] - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning
**Source:** `.planning/audits/cache-components-2026-05-21-followup.md` (Option D plan, post-recurrence-4 docs research)

<domain>
## Phase Boundary

Adopt the canonical Next 16 Cache Components pattern on `/u/[username]/[tab]` to eliminate the recurrence-4 React #419 ("server could not finish this Suspense boundary") that hit prod on 2026-05-20 night, ~10 min after the Phase 51 layout-fix deploy. The pattern is "push dynamic access down" — sync layout, async runtime-API consumer (`ProfileChrome`) wrapped in `<Suspense>`, and `unstable_instant = { prefetch: 'static' }` as the build/dev validator so this bug class is caught at build time, not in prod after the 300s `cacheLife` revalidation window.

**Diagnosis inversion (load-bearing):** Phase 51's CONTEXT.md placed `unstable_instant` on a "failed-attempt blocklist." Phase 52 reverses that. The instant-navigation doc reveals `unstable_instant` is a **validator**, not a runtime feature — it simulates client-side navigation at every shared layout boundary in the route and fails dev/build if Suspense structure can't produce instant nav. Removing it in Phase 39c removed the validation, not the bug. The "tree-only RSC payloads" symptom in Phase 39c was the structural defect (runtime API access outside Suspense) manifesting at runtime; the validator was correctly flagging it.

**In scope:**
- Add `unstable_instant = { prefetch: 'static' }` to `src/app/u/[username]/[tab]/page.tsx`
- Refactor `src/app/u/[username]/layout.tsx` to sync; introduce new `src/app/u/[username]/profile-chrome.tsx` (async; awaits `params` + `getCurrentUser`; wraps `ProfileGate`) inside a layout-level `<Suspense fallback={<ProfileShellSkeleton/>}>`
- Restructure `src/app/u/[username]/[tab]/page.tsx`: hoist the body into an inner async `ProfileTabContent` component wrapped in page-level `<Suspense fallback={<ProfileTabContentSkeleton/>}>`
- Update `tests/profile-route-51.test.ts` — Test 1 inverted (layout MUST NOT directly `await getCurrentUser`); add Test 4 asserting `unstable_instant` export on page
- Install `@playwright/test` + `@next/playwright`; add `playwright.config.ts`; add `tests/e2e/auth-setup.ts` (seeded-user storageState) + `tests/e2e/profile-tab-instant.test.ts` (`instant()` chrome-stays-mounted invariant); local dev server target
- Inline cleanups bundled into Phase 52:
  - CR-01: `src/proxy.ts` safety-comment correction (real safety is `no-store` header, not `getSession()` cookie-only)
  - Delete `scripts/assert-phase-51-build.mjs` (silently broken — Next 16.2 manifest shape mismatch; superseded by `unstable_instant` validator)
  - `src/app/u/[username]/loading.tsx` comment rewrite to describe Phase 52's three-boundary structure
  - Inline reversal note in Phase 51 `51-CONTEXT.md` `<decisions>` + the page comment block at `[tab]/page.tsx:33-39`
  - Grep `.planning/` for any `.continue-here.md` blocking anti-pattern referencing `unstable_instant`; retire if found
- Capture cross-route validator findings (if any) in new `.planning/seeds/SEED-014-cache-components-canonical-sweep.md`; link from Phase 52 CONTEXT.md and add `unstable_instant = false` opt-outs to the surfaced routes (audit followup's documented opt-out pattern)
- Preserve Phase 51 Branch B contract (anon `/u/*` → 307 + `Cache-Control: no-store`) and verify post-deploy via the existing curl script

**Out of scope (deferred to future phases):**
- `'use cache'` → `'use cache: remote'` migration for `ProfileShellResolver` (audit's in-memory-only-on-serverless finding)
- Real 404 HTTP status for unknown username (`notFound()` mid-stream is 200 + noindex meta per streaming docs)
- Broader PPR/Cache Components sweep across other routes — captured as SEED-014 by Phase 52, executed later
- Skeleton pixel-fidelity audit / UX polish (keep current intentionally-distinct skeletons)
- Vercel preview-deploy Playwright runs (Phase 52 ships with local dev target only; preview-deploy e2e is a separate infra phase)

</domain>

<decisions>
## Implementation Decisions

### Validator scope
- **D-52-01:** `unstable_instant = { prefetch: 'static' }` added to **only** `src/app/u/[username]/[tab]/page.tsx`. Narrow start per audit followup. Other PPR-classified routes are not modified in Phase 52.
- **D-52-02:** If the Phase 52 validator pass surfaces structural errors in **other** files (likely — page imports affect adjacent routes), apply the **`unstable_instant = false` opt-out** pattern from the docs at those sites. Documents intent ("this route legitimately can't be instant"), no behavior change, keeps Phase 52 narrow.
- **D-52-03:** `unstable_instant` export is a **hard CI gate** — `npm run build` failing on validator errors is the recurrence-5 prevention contract. Vercel build already fails on Next errors, so no extra CI config is required; the export itself is the contract.
- **D-52-04:** Cross-route validator findings are recorded in a new **`.planning/seeds/SEED-014-cache-components-canonical-sweep.md`** with each surfaced route + opt-out applied. Phase 52 CONTEXT.md links to it. Phase 52 stays scoped to `/u/[username]/[tab]`; the sweep is its own future phase.

### Playwright e2e test
- **D-52-05:** Phase 52 **introduces Playwright** to the codebase. Install `@playwright/test` + `@next/playwright`. New files: `playwright.config.ts`, `tests/e2e/auth-setup.ts`, `tests/e2e/profile-tab-instant.test.ts`.
- **D-52-06:** Auth setup uses a **test-only seeded user + Playwright `storageState`**. `tests/e2e/auth-setup.ts` signs in once (Supabase admin API or seeded credentials), saves `storageState.json`; all e2e tests reuse it. Standard Playwright pattern. Planner decides local-supabase vs preview-deploy target (local recommended per D-52-07).
- **D-52-07:** Test target is **local `npm run dev`** only. Playwright spawns local Next dev server before each test run. Fastest CI feedback. Acknowledged limitation: doesn't catch Vercel-edge divergence — but `unstable_instant` validator catches the structural defect, so e2e is a complement, not the prod contract.
- **D-52-08:** First e2e test uses the **`@next/playwright` `instant()` helper** per audit followup. The helper simulates the framework's instant-nav contract verbatim, aligning the assertion with what Next promises. Standard Playwright remains available for tests outside the instant-nav contract.

### Cleanup bundling
- **D-52-09:** CR-01 (proxy.ts safety-comment correction) **fixed inline in Phase 52**. Single-line comment update at `src/proxy.ts:23` area. Phase 52 already touches this file's neighborhood for Branch B verification.
- **D-52-10:** `scripts/assert-phase-51-build.mjs` is **deleted**. Audit followup's preferred option — Next's `unstable_instant` validator IS the source of truth for the structural contract. The script's purpose is subsumed. One less brittle artifact to maintain.
- **D-52-11:** Diagnosis reversal recorded in TWO places: (a) inline replacement of the comment block at `src/app/u/[username]/[tab]/page.tsx:33-39` with a Phase 52 reference + the audit followup citation; (b) a `<decisions>` annotation in `.planning/phases/51-.../51-CONTEXT.md` flagging the `unstable_instant` blocklist entry as reversed while preserving the historical record. The next session reading either doc must not be misled.
- **D-52-12:** Grep `.planning/` for any `.continue-here.md` blocking anti-pattern referencing `unstable_instant`. If found, revise to reflect the corrected diagnosis. Otherwise no-op. We confirmed Phase 51's dir has no `.continue-here.md`; this is preemptive.

### loading.tsx reconciliation
- **D-52-13:** Keep **all three Suspense boundaries** on the route post-Phase-52: layout `<Suspense fallback={<ProfileShellSkeleton/>}>` around ProfileChrome (cold-load chrome skeleton), page `<Suspense fallback={<ProfileTabContentSkeleton/>}>` around ProfileTabContent (tab-nav content skeleton), `src/app/u/[username]/loading.tsx` implicit Suspense (implicit-prefetch case during client navigation per linking-and-navigating docs). Audit says "having all is harmless."
- **D-52-14:** `loading.tsx` comment block is **rewritten** to describe Phase 52's three-boundary structure as the single source of truth for future debugging. The current comment references a layout Suspense that doesn't exist (stale from recurrence-3 collapse).
- **D-52-15:** Skeletons remain **intentionally distinct**. `ProfileShellSkeleton` (full chrome: avatar+header+counts+tags+hero+tabs+content) signals "loading whole page" on cold load. `ProfileTabContentSkeleton` (content area only) signals "chrome stays, content updating" on tab nav. Reinforces the persistent-chrome UX. Already implemented — no UX/design changes in Phase 52.
- **D-52-16:** **Always-Suspense, always-async-ProfileChrome.** Structural lock against future regressions. ProfileChrome stays async (so it can `await getCurrentUser`) and layout stays sync with Suspense — not conditionally, not for perf reasons, structurally per the "Interaction with loading.js" doc rule for Cache Components.

### Carrying forward from Phase 51
- **D-52-CF-01:** Branch B contract (anon `/u/*` → 307 + `Cache-Control: no-store`) MUST remain live through Phase 52. Verification curl is the same as Phase 51's deploy gate.
- **D-52-CF-02:** Phase 39c Pitfall 1 — `viewerId` stays OUT of `ProfileShellResolver`'s cached scope. `ProfileGate` cannot read cookies. `ProfileChrome` is the new runtime-API consumer (replaces the layout's direct role) and passes `viewerId` to `ProfileGate` via props.
- **D-52-CF-03:** Phase 39c notFound() ordering — `notFound()` MUST fire BEFORE any post-suspending `await`. Both `ProfileGate` and the inner `ProfileTabContent` must preserve this.
- **D-52-CF-04:** Resolver invariants unchanged: `'use cache'` + `cacheTag('profile:${username}')` + `cacheLife({ revalidate: 300 })`. Migration to `'use cache: remote'` is explicitly deferred.

### Claude's Discretion
- Final shape of the refactor is **validator-driven**. The proposed `ProfileChrome` + `ProfileTabContent` structure in the audit followup is a working hypothesis; planner spawns phase-researcher to confirm via Next 16 docs, then planner produces the executable shape based on the actual validator output from Step 1.
- Wave structure for the plan: Wave 0 (test scaffolds — TDD); Wave 1 (Step 1 probe — add `unstable_instant` line only, capture validator output, refine plan); Wave 2 (refactor based on validator output); Wave 3 (cleanups + tests); Wave 4 (deploy + UAT). Final structure is planner's call.
- Exact seed text and structure for SEED-014 is planner's call. Suggested fields: surfaced-route table (route, opt-out applied, suspected fix shape), confidence rating, sweep-ordering rationale.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 52 source-of-truth (READ FIRST)
- `.planning/audits/cache-components-2026-05-21-followup.md` — the refined Option D plan, Steps 1-8, diagnosis inversion explanation, proposed component shapes, open risks, doc-page references for mid-implementation consultation. This document drives Phase 52.
- `.planning/audits/cache-components-2026-05-21.md` — the original Cache Components audit. The "broken assertion script" finding, the "actual recurrence-3 mitigation was `Cache-Control: no-store`" finding, the 30 PPR-classified routes, the 22 files touching CC surfaces — all remain valid. Only the "Three forward options" section is superseded.
- `.planning/debug/resolved/profile-page-404-top-nav.md` — the four-recurrence narrative. Recurrence-4 added to the closed log post-fix.

### Phase 51 prior decisions (must preserve, with one explicit reversal)
- `.planning/phases/51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta/51-CONTEXT.md` — Phase 51 CONTEXT. The `unstable_instant`-on-blocklist entry is **REVERSED by Phase 52 D-52-11** but otherwise the file's invariants stand. Phase 52 will annotate this file with the reversal note.
- `.planning/phases/51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta/51-PLAN.md` — Phase 51 PLAN. Reference for Branch B implementation pattern (proxy gate + `Cache-Control: no-store`).
- `.planning/phases/51-profile-route-ppr-opt-out-recurrence-3-fix-for-u-username-ta/51-REVIEW.md` — Phase 51 code review. CR-01 + CR-02 + WR-01..06 + IN-01..03. CR-01 fixed in Phase 52 (D-52-09).
- `.planning/milestones/v5.0-ROADMAP.md` (Phase 39c section) — D-39c-01 through D-39c-09 invariants. Phase 52 carries forward D-39c-03 (Pitfall 1), D-39c-05, D-39c-07 (now restored).

### Source files in scope
- `src/app/u/[username]/layout.tsx` (60 lines) — current async layout with top-level `await params` + `await getCurrentUser`, no Suspense. Phase 52 makes it sync with Suspense around new ProfileChrome.
- `src/app/u/[username]/profile-chrome.tsx` — **NEW FILE** in Phase 52. Async; awaits `params` + `getCurrentUser`; wraps `ProfileGate`. Server-only.
- `src/app/u/[username]/profile-gate.tsx` — unchanged behavior. Signature already takes `viewerId` as prop (Phase 51 51-02). Comment block may need a tweak to reference ProfileChrome as the new caller.
- `src/app/u/[username]/profile-shell-resolver.tsx` — unchanged. `'use cache'` + `cacheTag` + `cacheLife` invariants preserved (D-52-CF-04).
- `src/app/u/[username]/[tab]/page.tsx` (368 lines) — current async page with top-level `await params` + `await getCurrentUser` + `await ProfileShellResolver` + tab-specific branching. Phase 52: add `unstable_instant` export; hoist body into inner async ProfileTabContent inside `<Suspense>`; replace lines 33-39 comment block with Phase 52 reversal note.
- `src/app/u/[username]/loading.tsx` — `<ProfileTabContentSkeleton/>`. Comment block rewritten per D-52-14.
- `src/app/u/[username]/profile-shell-skeleton.tsx` — exports `ProfileShellSkeleton` + `ProfileTabContentSkeleton`. Unchanged.
- `src/proxy.ts` — CR-01 fix at line 23 area (D-52-09). Comment correction only, no behavior change.
- `tests/profile-route-51.test.ts` (87 lines) — Test 1 inverted (D-52-04 — assert layout does NOT directly `await getCurrentUser` vs current "no Suspense" assertion); Test 4 added (assert `unstable_instant` export).
- `tests/e2e/auth-setup.ts` — **NEW FILE** (D-52-06).
- `tests/e2e/profile-tab-instant.test.ts` — **NEW FILE** (D-52-08).
- `playwright.config.ts` — **NEW FILE** (D-52-05).
- `package.json` — add `@playwright/test`, `@next/playwright` to devDependencies; add `test:e2e` script.
- `scripts/assert-phase-51-build.mjs` — **DELETED** (D-52-10).
- `.planning/seeds/SEED-014-cache-components-canonical-sweep.md` — **NEW FILE** (D-52-04).

### Next 16 docs (planner MUST consult; mid-implementation reference)
- **"Push dynamic access down"** section: `node_modules/next/dist/docs/01-app/02-guides/streaming.md` — the canonical principle Phase 52 implements. Sync layout pattern, cookie-promise pass-through to Suspended children.
- **"Interaction with loading.js"** section: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md` — the exact rule: "With Cache Components, runtime data access in the layout must be wrapped in its own `<Suspense>` boundary."
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-segment-config/instant.md` — `unstable_instant` reference. Validator behavior, opt-out pattern (`unstable_instant = false`), failure modes.
- `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md` — the canonical dynamic-route pattern Phase 52 mimics (the `ProductPage` example with `params.then(...)` inside Suspense).
- `node_modules/next/dist/docs/01-app/02-guides/cache-components.md` — `'use cache'` semantics; in-memory-only-on-serverless caveat (informs D-52-CF-04's deferral of `'use cache: remote'` migration).
- `node_modules/next/dist/docs/01-app/02-guides/streaming.md` — `notFound()` mid-stream returns 200 + noindex meta (informs "real 404" out-of-scope decision).
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` — `loading.tsx` is a regular `<Suspense>` boundary in Cache Components mode.
- Live (16.2.6) docs at https://nextjs.org/docs/app/ — only consult if local 16.2.3 docs are unclear on a point.

### Playwright docs
- `@next/playwright` package docs — `instant()` helper API
- Playwright `storageState` pattern docs — for `tests/e2e/auth-setup.ts`

### User memories relevant to this work (auto-loaded into context at session start)
- `project_cc_audit_2026_05_21.md` — Phase 51 recurrence-4 + Option D selection note. Will need an update at Phase 52 close.
- `feedback_proxy_router_cache_poisoning.md` — Branch B safety constraint. Phase 52 must preserve.
- `project_turbopack_next_cache_stale_css.md` — clear `.next/` between dev runs when verifying validator output. Relevant operational note.

### Vercel platform context
- `vercel:next-cache-components` skill — if planner needs Cache Components platform guidance during research.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProfileGate` (`src/app/u/[username]/profile-gate.tsx`) — already accepts `viewerId` as prop (Phase 51 51-02). Phase 52 reuses unchanged; ProfileChrome becomes its new caller.
- `ProfileShellResolver` (`src/app/u/[username]/profile-shell-resolver.tsx`) — `'use cache'`-backed, viewer-independent. Reused unchanged by Phase 52.
- `ProfileShellSkeleton` + `ProfileTabContentSkeleton` (`src/app/u/[username]/profile-shell-skeleton.tsx`) — both already exist. Layout Suspense uses `ProfileShellSkeleton`; page Suspense uses `ProfileTabContentSkeleton`. No new skeleton components needed.
- `getCurrentUser` + `UnauthorizedError` (`@/lib/auth`) — React `cache()`-memoized; same-request lookups are free. Moves from layout/page to ProfileChrome.
- `tests/profile-route-51.test.ts` source-grep pattern — Phase 52's Test 1 inversion follows this pattern (fs.readFileSync + regex assertions).
- Phase 51's `scripts/verify-phase-51-prod.sh` — reusable post-deploy contract curl for the Branch B 307 + no-store assertion.

### Established Patterns
- **Layouts own persistent chrome** (Phase 51 layout-fix decision) — Phase 52 preserves this. Layout has `<main>` wrapper; ProfileChrome inside Suspense renders the actual chrome composition. Tab navigation does not re-render chrome.
- **Cookies read only in the uncached layer** (Phase 39c Pitfall 1) — Phase 52 carries forward: `getCurrentUser` moves to ProfileChrome (uncached, async, inside Suspense), never inside `ProfileShellResolver`'s `'use cache'` scope.
- **`notFound()` before post-suspending awaits** (Phase 39c Pitfall 5) — Phase 52's `ProfileTabContent` must `await ProfileShellResolver` first, then `notFound()` if resolved.profile is null, then continue with viewer-overlap fetches.
- **Source-grep regression tests over runtime tests for structural invariants** — Phase 51 set this pattern. Phase 52 extends it: vitest source-grep for structural invariants (e.g., `unstable_instant` export present), Playwright for runtime invariants (chrome stays mounted).
- **TDD wave structure** (Phase 51 51-01) — Wave 0 authors tests/scaffolds that initially FAIL. Phase 52's planner should follow.

### Integration Points
- **`src/proxy.ts` Branch B gate** — Phase 52 must not break the `/u/*` → 307 + `Cache-Control: no-store` contract. The CR-01 cleanup (D-52-09) is comment-only.
- **`src/lib/auth.ts` `getCurrentUser` cache memoization** — `cache()`-wrapped per recent commit `172f211`. Phase 52's ProfileChrome calls it; the page also calls it (inside ProfileTabContent) for viewer-id-dependent branching. Same-request memoization makes the second call free.
- **Server Actions revalidation chain** — `watches.ts`, `notes.ts`, `profile.ts`, `follows.ts` all call `revalidatePath('/u/[username]', 'layout')`. Phase 52's structural change (layout sync, ProfileChrome async-inside-Suspense) does NOT change the revalidation contract — `revalidatePath('/u/[username]', 'layout')` still invalidates the layout + page subtree.
- **`src/app/u/[username]/loading.tsx`** — kept; comment rewritten (D-52-14). Continues to render `ProfileTabContentSkeleton` during the implicit-prefetch client-navigation case.
- **`tests/profile-route-51.test.ts`** — Test 1 inverted in-place; Test 4 added. File renamed? Plan TBD — could remain Phase 51 named since it pins the joint Phase 51+52 contract, or could be supplemented by a `tests/profile-route-52.test.ts` for Phase 52 specifics. Planner's call.
- **`package.json` `scripts.test`** — current vitest setup. Phase 52 adds `test:e2e` for Playwright. Verify these don't collide in CI (vitest runs in `test`, e2e separately).

</code_context>

<specifics>
## Specific Ideas

### What "fixed" means concretely
- `npm run build` exits 0 with no validator errors on `/u/[username]/[tab]`
- `npm run dev` does not show overlay errors on tab navigation
- The Playwright `instant()` test passes — chrome (heading, tablist) stays visible across the tab navigation; content streams in after
- `npx vitest run tests/profile-route-51.test.ts tests/proxy.test.ts tests/app/profile-tab-insights.test.tsx tests/app/profile-layout.test.tsx` all green
- Post-deploy: anon `/u/twwaneka/collection` → 307 + `Cache-Control: no-store` (Branch B contract holds)
- Post-deploy operator UAT: sign in, click tabs through two full cycles, no 404s
- Post-deploy 15-min wait + click again: cache revalidation (`cacheLife: 300`) does NOT trigger React #419

### Step 1 probe protocol (audit followup verbatim)
1. Add **only** `export const unstable_instant = { prefetch: 'static' }` to `src/app/u/[username]/[tab]/page.tsx`
2. Run `npm run dev` — watch overlay errors
3. Run `npm run build` — watch build-time errors
4. The validator output is **ground truth** for refactor scope. Do not pre-implement Step 2.

### Expected validator output (audit's best guess — confirm don't assume)
- Layout's top-level `await params` flagged
- Layout's top-level `await getCurrentUser()` flagged
- Page's top-level `await params` flagged
- Page's top-level `await getCurrentUser()` flagged
- Page's top-level `await ProfileShellResolver(...)` flagged
- Possibly: cached components receiving Promise-typed args instead of resolved values
- Possibly: cross-route violations in other files imported by the page

### Operator preferences (soft signals; plan should respect)
- Operator has been burned 4 times on this bug. Plan should bias toward **structural fixes that the build process enforces** (validator export + CI gate) over runtime tests alone.
- Operator chose "Yes — install Playwright + add e2e test" despite the cost. They want a runtime contract for the chrome-mounted invariant after four recurrences.
- Operator chose to bundle cleanups (CR-01, script delete, comment rewrites, anti-pattern retirement) into Phase 52 rather than defer. They want a single clean shipping artifact.

</specifics>

<deferred>
## Deferred Ideas

- **`'use cache'` → `'use cache: remote'` migration for `ProfileShellResolver`** — audit's in-memory-only-on-serverless finding. ProfileShellResolver may not actually be caching across requests on Vercel today. Worth quantifying impact (cold-start cost vs cache benefit) before migrating. Future polish phase.
- **Real 404 HTTP status for unknown username** — `notFound()` mid-stream is 200 + noindex meta per streaming docs. Would need username-existence check ABOVE any Suspense boundary. Probably worth doing for SEO + correctness, but not blocking Phase 52.
- **Vercel preview-deploy Playwright runs** — Phase 52 ships with local dev target. Preview-deploy e2e is its own infra phase (Vercel preview URL injection, deploy-then-test CI order, runner cost).
- **Broader Cache Components canonical-pattern sweep** — captured as SEED-014 by Phase 52 (D-52-04). Execute as future phase once Phase 52 surfaces the actual cross-route scope.
- **Skeleton pixel-fidelity audit** — `ProfileShellSkeleton` and `ProfileTabContentSkeleton` could be refined for better visual fidelity to the resolved state. Held off in Phase 52 to keep scope tight on the bug fix. UX/design phase candidate.
- **Cleanup of stale comments referencing removed patterns** — beyond the loading.tsx + page-comment-block updates Phase 52 does, there may be other comments across the profile route that drifted across the four recurrences. Sweep candidate for a future polish phase.

</deferred>

---

*Phase: 52-option-d-cache-components-canonical-pattern-fix-for-u-userna*
*Context gathered: 2026-05-21*

---
phase: 39c-profile-layout-next-16-conformance
plan: 07
type: execute
wave: 5
depends_on: [06]
files_modified: []
autonomous: false
requirements: [NEXT16-CONFORMANCE]
threat_refs: []
must_haves:
  truths:
    - "On prod (or preview), the signed-in user can click 'Profile' in the top nav and the profile route loads WITHOUT 404 — the original repro path from `.planning/debug/profile-page-404-top-nav.md` no longer reproduces"
    - "Each profile tab (wishlist / worn / notes / stats / insights) loads on click without 404"
    - "BottomNav Profile (mobile or DevTools emulation) loads without 404"
    - "DevTools Network shows partial-prefetch behavior: small RSC on viewport entry (skeleton chrome), full RSC on click (resolved content)"
    - "`npm run build` exits 0 — `unstable_instant` build-time gate from Plan 04 confirms the static shell is instant"
  artifacts: []
  key_links: []
---

<objective>
Execute the D-39c-09 7-step manual prod-checkpoint protocol on a preview URL or production deployment. This is the FINAL gate before the phase can close. Per RESEARCH §Manual-Only Verifications: the bug is prod-only (`link.md:298` — prefetching disabled in dev), so no automated test running locally can substitute for these steps.

Purpose: Phase 39c is structural: the refactor + revert sequence in Plans 01-06 will pass `npm run build` regardless of whether the prod Router-Cache poisoning bug is actually fixed. Plan 07 is the empirical check that proves the structural fix delivers the observable outcome: the three profile-link entry points (UserMenu avatar, ProfileTabs triggers, BottomNav Profile) prefetch and soft-nav cleanly with no 404 regression.

Output: One checkpoint task (autonomous=false). The user (twwaneka@gmail.com) executes the 7 steps; the assistant records pass/fail in the SUMMARY.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md
@.planning/phases/39c-profile-layout-next-16-conformance/39C-RESEARCH.md
@.planning/phases/39c-profile-layout-next-16-conformance/39C-VALIDATION.md
@.planning/debug/profile-page-404-top-nav.md
@.planning/phases/39c-profile-layout-next-16-conformance/39c-06-PLAN.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Execute D-39c-09 prod manual-checkpoint protocol (7 steps)</name>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md §D-39c-09 (the locked 7-step protocol)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-RESEARCH.md §Prod Manual-Checkpoint Protocol (lines 848-863 — the protocol with PASS criteria for each step)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-VALIDATION.md §Manual-Only Verifications (the table mapping each prod check to the bug it covers)
    - .planning/debug/profile-page-404-top-nav.md §Reproduction (the original failure mode — steps 1-6) and §Resolution → verification (the post-mitigation evidence)
  </read_first>
  <what-built>
    Plans 01-06 have shipped:
    - **Plan 01:** `src/app/u/[username]/profile-shell-skeleton.tsx` (chrome-only skeleton) + `src/app/u/[username]/loading.tsx` (Next 16 segment loading boundary)
    - **Plan 02:** `src/app/u/[username]/profile-shell-resolver.tsx` (`'use cache'` Server Component with `cacheTag('profile:${username}')` + `cacheLife({ revalidate: 300 })`)
    - **Plan 03:** `src/app/u/[username]/profile-gate.tsx` (uncached viewer-dependent gate) + refactored `src/app/u/[username]/layout.tsx` (thin Suspense shell — zero uncached top-level fetches)
    - **Plan 04:** `export const unstable_instant = { prefetch: 'static' }` added to `src/app/u/[username]/[tab]/page.tsx` (build-time gate confirming the static shell is instant)
    - **Plan 05:** Cache invalidation wiring across 4 Server Action files (`profile.ts`, `watches.ts`, `follows.ts`, `wearEvents.ts`) using the `profile:${username}` and `viewer:${viewerId}:profile:${ownerId}` tag families
    - **Plan 06:** Diagnostic commit `2f42d00` reverted — `prefetch={false}` removed from UserMenu / ProfileTabs / BottomNav; BottomNav's NavLink no longer carries the `prefetch?: boolean` prop

    `npm run build` exits 0 across the phase. Partial prefetching is re-enabled on the three profile-bound Link sites. The phase is structurally complete — Plan 07 verifies the structural fix actually resolves the prod bug.
  </what-built>
  <how-to-verify>
    Deploy the current `main` branch to a preview URL OR production (the bug is prod-only per `link.md:298`). The operator executes the following 7-step protocol verbatim from D-39c-09:

    1. **Deploy** to a preview URL or production after Plans 01-06 have all landed (`main` should be at the post-Plan-06 commit).
    2. **Sign in** as twwaneka@gmail.com on the deployed URL.
    3. **Click "Profile" in the top nav** (the UserMenu avatar Link at `src/components/layout/UserMenu.tsx`). Expected: `/u/twwaneka/collection` loads with the collection tab content rendered. **PASS criterion:** page renders, no 404, no console errors.
    4. **Click each tab in turn**: wishlist → worn → notes → stats → insights. The tab Links are the ProfileTabs render-prop Links at `src/components/profile/ProfileTabs.tsx`. **PASS criterion:** each tab renders without 404.
    5. **Click "Profile" in BottomNav** on mobile (or DevTools mobile-device emulation — the BottomNav `<NavLink href={profileHref} ... label="Profile" />` at `src/components/layout/BottomNav.tsx:157`). **PASS criterion:** page renders.
    6. **DevTools Network panel:** verify partial-prefetch behavior:
       - On viewport entry of the UserMenu avatar Link (mouse hover or scroll-into-view, depending on prefetch trigger), confirm an RSC prefetch fires (filter the Network panel by `?_rsc=` query param).
       - The prefetched RSC should be the **partial shell** (skeleton chrome) — small payload, no profile content. The size should be noticeably smaller than the full-page RSC.
       - On click, a second RSC fetch completes the full content. **PASS criterion:** two-stage prefetch behavior visible in Network panel.
    7. **Build-time gate:** verify `npm run build` exited 0 in CI (or locally) — the `unstable_instant = { prefetch: 'static' }` validation from Plan 04 must pass. **PASS criterion:** build exit code 0; no Next 16 warning about non-instant shell.

    If ANY step fails, the phase is NOT done. The orchestrator should treat the failure as gap-closure feedback and re-open Plans 03 / 04 / 06 as appropriate:
    - Step 3 / 4 / 5 fails (404 reproduces): the structural refactor is incomplete — most likely the layout still has an uncached top-level read OR the resolver leaks viewer state. Re-run static-analysis grep from VALIDATION.md.
    - Step 6 fails (only one large RSC, no partial prefetch): `unstable_instant` is not actually firing — verify Plan 04's export shipped and `cacheComponents: true` is still on at `next.config.ts:13`.
    - Step 7 fails (build error): the `unstable_instant` build-time gate caught a non-instant shell — read the Next 16 error overlay for the specific blocking component.

    NO automated test can substitute for steps 3-6. Local `npm run dev` cannot reproduce or verify because prefetching is disabled in dev per link.md:298. The deployed URL is the only valid verification surface.
  </how-to-verify>
  <resume-signal>
    Type one of:
    - **"approved"** — all 7 steps pass; phase 39c is verified done; the orchestrator can close the phase and update ROADMAP.md.
    - **"step N failed: <description>"** — record which step failed; the orchestrator routes to gap-closure on the appropriate plan per the failure-mode mapping in `<how-to-verify>` above.
    - **"deferred"** — preview URL not yet available; checkpoint blocks the phase close until a deployment lands.
  </resume-signal>
</task>

</tasks>

<verification>
- Manual prod-checkpoint signed off (7-step protocol per D-39c-09)
- ROADMAP SC#5 verified: "clicking Profile / any profile tab / any prefetched profile destination from a populated nav DOES NOT 404; hard reload still works; soft nav works"
- Partial-prefetch behavior confirmed in DevTools Network: viewport-entry prefetch hits the static shell (skeleton RSC), click hits the resolved content RSC
- `unstable_instant` build-time gate green (Plan 04 acceptance carried forward)
</verification>

<success_criteria>
- All 7 protocol steps signed off by the operator
- No 404 regression on any of the three profile-link entry points
- DevTools Network panel evidence of partial-prefetch (small RSC on viewport entry, full RSC on click)
- `npm run build` exit 0 in CI or locally
- ROADMAP SC#5 satisfied
</success_criteria>

<output>
After approval, create `.planning/phases/39c-profile-layout-next-16-conformance/39c-07-SUMMARY.md` capturing: the deployment URL used (preview or prod), the step-by-step pass/fail outcome for all 7 checks, any screenshots or DevTools Network entries the operator captured, any unexpected behavior surfaced (e.g., transient flashes during the streaming hop), and a final pass/fail verdict on ROADMAP SC#5. If any step failed, capture the failure mode for orchestrator gap-closure routing.
</output>

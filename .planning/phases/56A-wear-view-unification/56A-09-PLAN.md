---
phase: 56A-wear-view-unification
plan: "09"
type: execute
wave: 2
depends_on: ["08"]
files_modified:
  - src/app/wear/[wearEventId]/page.tsx
  - src/components/wear/WearCard.tsx
  - src/components/wear/WearPhotoClient.tsx
  - tests/e2e/wears-lane.test.ts
autonomous: false
gap_closure: true
requirements: []

must_haves:
  truths:
    - "On /wear/[id], the wear photo (and its avatar/username + brand/model overlays) RENDERS ON MOBILE at a ~375px viewport"
    - "The rendered photo block has non-zero width AND non-zero height at the 4:5 aspect ratio on mobile (it does not collapse/blank)"
    - "The desktop rendering of /wear/[id] is unchanged (no regression on the previously-working desktop layout)"
  artifacts:
    - path: "tests/e2e/wears-lane.test.ts"
      provides: "A mobile-viewport regression test asserting the /wear/[id] photo's rendered bounding box is non-zero and ~4:5"
      contains: "boundingBox"
  key_links:
    - from: "src/app/wear/[wearEventId]/page.tsx (article flex column) → WearCard → WearPhotoClient"
      to: "rendered 4:5 photo on mobile"
      via: "the CSS chain that establishes a definite width/height for aspect-[4/5]"
      pattern: "aspect-\\[4/5\\]"
---

<objective>
Close UAT gap #5 (BLOCKER): on /wear/[id], the photo + avatar/username + brand/model overlay block
renders correctly on DESKTOP but DOES NOT RENDER AT ALL on MOBILE for the same wear — the whole
photo+overlay block is collapsed/blank. Suspected regression from the 56A-04 WearCard refactor.

This is a DIAGNOSE-THEN-FIX gap, NOT a deterministic edit. Static analysis looks correct
(WearPhotoClient uses `w-full aspect-[4/5]`; the page wrapper is `<article className="flex flex-col
gap-4 pt-4">` → Suspense → WearCard → WearPhotoStreamed → WearCard photo layer). The collapse must be
reproduced on a real mobile viewport and the CSS chain traced explicitly.

DURABLE LESSON (bake into acceptance): GSD's 6-pillar UI checker validates DECLARED tokens, not whether
the CSS chain actually PRODUCES the visual contract. A black-bar / aspect-ratio bug shipped through 6/6
PASS before (see MEMORY: "GSD UI-SPEC CSS chain blind spot"). So acceptance criteria MUST assert the
RENDERED result (photo visible at ~4:5 on a ~375px viewport via Playwright boundingBox), not merely that
a class string is present. Also clear .next before concluding a CSS fix failed (MEMORY: Turbopack .next
cache serves stale CSS).

Purpose: restore the mobile photo render on /wear/[id] and lock it with a rendered-result regression test.
Output: the located CSS-chain fix + a Playwright mobile-viewport test asserting a non-zero ~4:5 photo box.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/56A-wear-view-unification/56A-CONTEXT.md
@.planning/phases/56A-wear-view-unification/56A-UI-SPEC.md
@.planning/phases/56A-wear-view-unification/56A-04-SUMMARY.md

AGENTS.md: this is Next.js 16 with breaking changes from training data — read the relevant doc under
node_modules/next/dist/docs/ before changing any Next-specific layout/streaming code.

<interfaces>
The /wear/[id] layout chain (suspected collapse path):
  src/app/layout.tsx:52   <body className="min-h-full flex flex-col bg-background">
  src/app/layout.tsx:58   <main className="flex-1 pb-[...] md:pb-0">  (a flex item inside the body flex column)
  src/app/wear/[wearEventId]/page.tsx:82   <article className="flex flex-col gap-4 pt-4">  (FLEX COLUMN)
  → <Suspense> → WearPhotoStreamed → WearCard
  src/components/wear/WearCard.tsx:100  <div>  (WearCard root — NOTE: NO width class)
  src/components/wear/WearCard.tsx:102  <div className="relative">  (photo layer + overflow anchor — NO width class)
  src/components/wear/WearPhotoClient.tsx:125  <div className="w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto relative">

PRIME SUSPECT (verify on a real viewport, do not assume): inside a `flex flex-col` parent (the article),
a flex item's cross-axis (width) is `stretch` by default — but if any ancestor in the WearCard subtree
(the root <div> at WearCard.tsx:100 or the .relative div at :102) does not establish a definite width,
the descendant `w-full` resolves against an `auto`/content width, and `aspect-[4/5]` then computes height
from a 0/auto width → the block collapses to ~0 height on mobile. On desktop `md:max-w-[600px] md:mx-auto`
gives the container a definite width so the same chain renders fine — which matches the EXACT symptom
(desktop OK, mobile collapsed). The likely minimal fix is adding `w-full` to the WearCard root <div>
and/or the .relative photo wrapper so width propagates down to the `w-full aspect-[4/5]` element. BUT
confirm this against the running viewport before editing — the collapse could instead be a min-width:0
flex issue, a Suspense fallback (PhotoSkeleton) sizing issue, or a global CSS rule. Assert the chain.

Test harness available:
  - tests/e2e/wears-lane.test.ts (Playwright, authenticated as twwaneka_1 via storageState; already
    navigates the worn tab to find an `a[href^="/wear/"]` link and opens /wear/[id]).
  - Playwright supports page.setViewportSize({ width: 375, height: 812 }) and locator.boundingBox()
    → { x, y, width, height } of the rendered element. This is the rendered-result assertion mechanism.
  - npm run test:e2e runs Playwright; playwright.config.ts + @next/playwright are installed.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Diagnose the mobile photo collapse on a running viewport and trace the CSS chain</name>
  <files>src/app/wear/[wearEventId]/page.tsx, src/components/wear/WearCard.tsx, src/components/wear/WearPhotoClient.tsx</files>
  <read_first>
    - src/app/layout.tsx (lines 52-61: body flex column → main flex-1) — the top of the layout chain.
    - src/app/wear/[wearEventId]/page.tsx (lines 81-107: the article flex column + Suspense + WearPhotoStreamed) — file in scope.
    - src/components/wear/WearCard.tsx (lines 99-138: the root <div>, the .relative photo wrapper, the WearPhotoClient/WearDetailHero branch) — file in scope.
    - src/components/wear/WearPhotoClient.tsx (lines 124-165: the w-full aspect-[4/5] happy-path container) — file in scope.
    - 56A-04-SUMMARY.md — the WearCard refactor that is the suspected regression source.
    - MEMORY note "Turbopack .next cache serves stale CSS" — clear .next (rm -rf .next) before concluding
      any CSS observation, so a stale cache does not mask or fake the result.
  </read_first>
  <action>
    DIAGNOSE on a real mobile viewport — do NOT assume the prime-suspect fix is correct without confirming.

    1. Start the dev server (or use Playwright headed/responsive devtools) and open a /wear/[id] permalink
       at a ~375px viewport (iPhone-class width). Confirm the photo block is collapsed/blank on mobile and
       renders on desktop (>=768px) for the SAME wear — reproduce the reported symptom.
    2. Trace the width/height chain element by element from <body> down to the `w-full aspect-[4/5]` element:
       inspect computed `width`, `height`, `min-width`, `flex`, and `aspect-ratio` at each node (body -> main
       -> article -> WearCard root div -> .relative div -> WearPhotoClient container). Identify the FIRST node
       where width resolves to 0/auto such that aspect-[4/5] computes ~0 height. Record the exact node and
       its computed style — this is the asserted chain (do not stop at "the class is present").
    3. If .next may be stale, run `rm -rf .next` and re-observe before concluding.
    4. Write down the located root cause in the SUMMARY: which node collapses, its computed width/height,
       and why desktop differs (md:max-w-[600px] gives a definite width).

    Do NOT apply the fix in this task — Task 2 applies it once the chain is confirmed. (Diagnosis and fix
    are split so the fix targets the actually-collapsed node, not a guess.)
  </action>
  <verify>
    <automated>MISSING — manual mobile-viewport diagnosis; Task 2 adds the automated regression test (tests/e2e/wears-lane.test.ts). Confirm the dev server builds: npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - The mobile collapse is reproduced on a ~375px viewport AND confirmed absent on desktop for the same wear.
    - The exact collapsing node in the chain (body -> main -> article -> WearCard root -> .relative -> WearPhotoClient
      container) is identified with its computed width/height, and recorded in the SUMMARY.
    - The diagnosis explicitly states WHY desktop renders (definite md:max-w-[600px] width) and mobile collapses
      (no definite width upstream) — i.e. the CSS chain is asserted, not assumed from class presence.
    - .next was cleared (rm -rf .next) if there was any doubt about stale cache before concluding.
  </acceptance_criteria>
  <done>The root cause of the mobile-only photo collapse is located and documented at the specific failing node.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Checkpoint: Confirm the mobile-collapse diagnosis before applying the fix</name>
  <action>Human confirms the reproduced collapse and the located root-cause node before the fix is applied.</action>
  <what-built>Reproduced the mobile collapse and traced the failing CSS-chain node (Task 1 diagnosis).</what-built>
  <how-to-verify>
    1. Confirm the diagnosis matches what you see: open a /wear/[id] permalink on your phone (or browser
       responsive mode at ~375px) and verify the photo block is currently collapsed/blank on mobile but
       renders on desktop.
    2. Review the located root-cause node and the proposed fix direction in the diagnosis output.
    3. Approve to proceed to the fix, or describe any discrepancy (e.g. it renders fine for you, or a
       different node collapses).
  </how-to-verify>
  <verify>Human confirmation of the reproduced collapse + located node.</verify>
  <done>Diagnosis approved; the fix can target the confirmed node.</done>
  <resume-signal>Type "approved" to apply the fix, or describe what differs.</resume-signal>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Apply the located fix + lock it with a mobile-viewport rendered-result regression test</name>
  <files>src/components/wear/WearCard.tsx, src/components/wear/WearPhotoClient.tsx, src/app/wear/[wearEventId]/page.tsx, tests/e2e/wears-lane.test.ts</files>
  <behavior>
    - At a 375x812 viewport, the /wear/[id] photo element's boundingBox().width is > 0 and > ~300px
      (it fills most of the mobile width).
    - At a 375x812 viewport, the photo element's boundingBox().height is approximately width * 5/4
      (4:5 portrait) — allow a tolerance band (e.g. within ~10%).
    - The photo's overlays (avatar/username, brand/model) are visible (the block is not blank).
    - Desktop (>=768px) boundingBox is unchanged from current behavior (no regression).
  </behavior>
  <read_first>
    - The Task 1 diagnosis output (SUMMARY) — apply the fix to the SPECIFIC node identified, not a guess.
    - src/components/wear/WearCard.tsx (root <div> at line 100; .relative wrapper at line 102) — likely fix site.
    - src/components/wear/WearPhotoClient.tsx (container at line 125) — possible fix site.
    - tests/e2e/wears-lane.test.ts (existing SC-3 test at lines 85-121 that already opens /wear/[id]) —
      extend with the mobile-viewport boundingBox assertion; reuse its navigation pattern + PROFILE constant.
    - MEMORY "GSD UI-SPEC CSS chain blind spot" — the test asserts the RENDERED box, not class presence.
  </read_first>
  <action>
    Apply the minimal fix located in Task 1 to the specific collapsing node. The most likely fix (confirm
    first) is adding `w-full` to the WearCard root <div> (WearCard.tsx:100) and/or the .relative photo
    wrapper (WearCard.tsx:102) so a definite width propagates to the `w-full aspect-[4/5]` element on mobile.
    If Task 1 found a different cause (min-w-0 flex issue, Suspense/PhotoSkeleton sizing, a global rule),
    fix THAT node instead. Keep the change minimal and do NOT touch the signed-URL retry machine, native
    img usage, gradient scrims, or the md: desktop classes (no desktop regression).

    Then add a regression test to tests/e2e/wears-lane.test.ts: a new test that sets a mobile viewport
    (page.setViewportSize({ width: 375, height: 812 })), navigates to a /wear/[id] permalink (reuse the
    existing SC-3 worn-tab navigation to find an a[href^="/wear/"] link), locates the rendered photo
    element (e.g. the wear photo img by alt text, or its aspect-[4/5] container — choose a stable selector),
    reads locator.boundingBox(), and asserts:
      - box.width > 300 (photo fills the mobile width, not collapsed)
      - box.height is within ~10% of box.width * 5/4 (4:5 portrait actually rendered)
    Skip gracefully (test.skip) if no wear link is found for the test user, mirroring the existing SC-3 test.

    Run the test BEFORE the fix is correct to confirm it FAILS (RED) on the collapse, then GREEN after the fix.
    Clear .next (rm -rf .next) before the final run to avoid stale-CSS false negatives.
  </action>
  <verify>
    <automated>rm -rf .next; npm run test:e2e -- wears-lane 2>&1 | tail -25</automated>
  </verify>
  <acceptance_criteria>
    - The fix is applied to the node identified in Task 1 (no blind guess); the change is minimal and does
      not alter the signed-URL machine, native img, scrims, or md: desktop classes.
    - tests/e2e/wears-lane.test.ts contains a new mobile-viewport test that uses setViewportSize(375x812)
      and locator.boundingBox(), asserting box.width > 300 and box.height ~= box.width * 5/4 (4:5, +/-~10%).
    - The new test FAILED before the fix (RED) and PASSES after (GREEN) — i.e. it genuinely guards the bug.
    - npm run test:e2e -- wears-lane passes (the mobile photo renders at ~4:5).
    - Desktop rendering of /wear/[id] is unchanged (no regression) — verified by the existing SC-3 test
      still passing.
    - .next was cleared before the final test run (stale-CSS guard).
  </acceptance_criteria>
  <done>The /wear/[id] photo renders at 4:5 on a ~375px mobile viewport, asserted by a rendered-result Playwright test, with desktop unchanged.</done>
</task>

</tasks>

<verification>
- npm run test:e2e -- wears-lane passes, including the new mobile-viewport boundingBox assertion.
- The existing SC-3 desktop/nav test still passes (no regression).
- npm run build succeeds.
- Manual: a /wear/[id] permalink on a real phone shows the photo + overlays (no blank/collapsed block).
</verification>

<success_criteria>
- The mobile-only photo collapse on /wear/[id] is diagnosed at the specific failing node and fixed minimally.
- A Playwright mobile-viewport test asserts the RENDERED photo box (non-zero, ~4:5) — guarding against the
  6-pillar "declared-token-but-not-rendered" blind spot.
- Desktop rendering is unchanged.
</success_criteria>

<output>
After completion, create `.planning/phases/56A-wear-view-unification/56A-09-SUMMARY.md`
Record the located root-cause node + computed styles (the asserted CSS chain) in the SUMMARY.
</output>

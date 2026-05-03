---
status: diagnosed
trigger: "On /search?tab=watches, clicking a search-result row (or the inline 'Evaluate' CTA on that row) does NOT expand the accordion. The entire inline-verdict-on-search surface introduced by 20.1 is unreachable."
created: 2026-04-30T18:00:00Z
updated: 2026-04-30T18:40:00Z
---

## Current Focus

hypothesis: STRONGEST CANDIDATE — invalid HTML nesting (`<div>`/`<p>` inside the native `<button>` rendered by `<Accordion.Trigger>`) causes one of: (a) React hydration mismatch that silently disables the click handler, (b) browser-specific click-event mishandling on a button containing block-level children, or (c) the click DOES register but the panel content is null because `cached` is undefined and the verdict request returns inadequate data — making the user perceive "no expansion" because chevron + label rotate but no visible content appears. Likely root cause is structural: the Trigger renders a single button wrapping a complex `<div>` tree (avatar, paragraphs, pills, "Evaluate" pill). When real users click the visible row content, the Pitfall 6 design ("Trigger absorbs the whole-row click") relies on bubble-through which requires valid event delegation through valid DOM.
test: Confirm by inspecting Browser DevTools: (1) Is the `<button>` actually rendered, or did the parser hoist children out? (2) Does click on the Trigger fire the onClick? (3) Does state update? (4) Does the panel mount but appear empty because `cached` is undefined?
expecting: Most likely outcome — the click DOES fire and state DOES update, but the rendered Panel content is empty/null because cache lookup fails OR the verdict Server Action errors silently. User perceives "doesn't expand" because chevron rotation may be too subtle and no verdict text appears.
next_action: Recommend instrumenting with browser DevTools or temporary console.log in handleValueChange to isolate whether the issue is (A) click handler not firing or (B) state changes but UI content stays empty.

## Symptoms

expected: On /search?tab=watches, search for a watch, click the row (or its 'Evaluate' CTA) → accordion row expands inline → verdict appears with 3 inline buttons (Wishlist primary / Collection outlined / Hide ghost). Clicking those buttons must NOT cause the panel to collapse via bubble-up (Pitfall 2 guard from PLAN.md).
actual: User reports: "broken - clicking the row or even the 'evaluate' cta on the row doesn't expand it. expand seems broken". Severity: blocker — entire surface is unreachable.
errors: None reported. Investigate console for click-handler errors and whether onClick is wired to a working state setter.
reproduction: Test 6 in .planning/phases/20.1-add-watch-flow-rethink-verdict-as-step/20.1-HUMAN-UAT.md — on /search?tab=watches, search for a watch by brand/model and try to expand a result row.
started: Discovered during 20.1 UAT (2026-04-30). The inline 3-CTA expand was a 20.1 deliverable.

## Eliminated

## Evidence

- timestamp: 2026-04-30T18:05:00Z
  checked: src/components/search/WatchSearchRowsAccordion.tsx (243 LOC)
  found: Trigger uses `aria-label="Evaluate {brand} {model}"` and wraps `<WatchSearchRow>`. Row contains `<div>` with `pointer-events-none` cascade on inner spans/pills/CTA-styled span. Outer row container does NOT have pointer-events-none — clicks bubble up to the Trigger button.
  implication: Click delegation should work; the visible row content has pointer-events-none on inner elements (deliberate) so clicks bubble through to the wrapping `<button>`.

- timestamp: 2026-04-30T18:08:00Z
  checked: node_modules/@base-ui/react/accordion/trigger/AccordionTrigger.js + useCollapsibleRoot.js + AccordionRoot.js
  found: Native button is rendered (nativeButton=true default). onClick→handleTrigger→onOpenChange→handleValueChange(value, true)→onValueChange([newValue], details). useTransitionStatus auto-sets mounted=true when open flips. Logic is sound.
  implication: The base-ui internals will mount the panel on click. Issue is NOT in base-ui internals.

- timestamp: 2026-04-30T18:10:00Z
  checked: ran vitest src/components/search/WatchSearchRowsAccordion.test.tsx
  found: All 3 tests pass — expand-on-click works in jsdom test env.
  implication: The component logic works; issue is browser-specific (real DOM hydration, CSS, or SSR-time HTML output).

- timestamp: 2026-04-30T18:12:00Z
  checked: Tailwind selectors on Accordion.Panel — `data-[state=open]:animate-in data-[state=closed]:animate-out`
  found: base-ui sets `data-open` attribute (no value), NOT `data-state=open`. Selectors `data-[state=open]:` will NEVER match.
  implication: Animations will not run via Tailwind classes — but this should NOT prevent functional expansion. Panel mounting is controlled by `mounted` state, not CSS. Side note: this is a styling bug discovered in passing.

- timestamp: 2026-04-30T18:15:00Z
  checked: dev server output
  found: `⚠ \`experimental.cacheComponents\` has been moved to \`cacheComponents\`. Please update your next.config.ts file accordingly.`
  implication: Config warning, but not directly relevant to client-side expand.

- timestamp: 2026-04-30T18:18:00Z
  checked: tests/components/search/AllTabResults.test.tsx line 218 stale comment
  found: Test comment says "WatchSearchRow renders 2 anchors per row (absolute-inset Link + Evaluate Link)" — but current WatchSearchRow has NO Links/anchors at all. Stale test comment from a pre-FIT-04 era.
  implication: Test still passes vacuously (asserts <= 10, actual count 0). This is a noise lead, not the bug.

- timestamp: 2026-04-30T18:25:00Z
  checked: next.config.ts
  found: `cacheComponents: true` is enabled (Phase 10 — required by CollectorsLikeYou.tsx).
  implication: Server Components are subject to Next 16 cacheComponents semantics. /search/page.tsx IS wrapped in Suspense (Pitfall 4 mitigation). Likely not the cause but worth noting.

- timestamp: 2026-04-30T18:28:00Z
  checked: WatchSearchRow render structure — `<button>` (from Accordion.Trigger) wraps `<div>` containing avatar `<div>`, info `<div>` (with `<p>` tags), pills `<span>`, and Evaluate `<span>`.
  found: This is INVALID HTML — `<div>` and `<p>` cannot appear as descendants of `<button>`. React's validateDOMNesting issues a dev warning. Browser parsers preserve the structure (don't auto-close button), but React hydration may flag this and CAN cause subtle event-handler binding issues in some browsers.
  implication: This is the strongest structural candidate. The "Pitfall 6: Accordion.Trigger absorbs the whole-row click" design depends on click bubbling through invalid HTML structure. Tests in jsdom pass because jsdom's HTML parser is lenient and React event delegation works on the React tree (not the DOM tree). In real browsers, hydration warnings about invalid nesting may indicate a deeper binding issue.

- timestamp: 2026-04-30T18:32:00Z
  checked: useCollapsibleRoot.handleTrigger + useTransitionStatus + AccordionPanel render gating
  found: When user clicks: handleTrigger fires onOpenChange → handleValueChange(value, true) → onValueChangeProp([value], details) → setOpenValues([value]) in parent. On re-render, AccordionItem's `isOpen` becomes true, so useCollapsibleRoot is called with `open: true`. useTransitionStatus auto-mounts the panel via `if (open && !mounted) setMounted(true)` during render.
  implication: The state-flow logic is sound IF handleTrigger fires. If it does NOT fire, the issue is at the DOM event level — either the click never reaches the button or it does but something prevents the onClick handler from running.

- timestamp: 2026-04-30T18:35:00Z
  checked: Possible secondary symptom — Test 1 reports "Your collection is empty" verdict on /watch/new even when collection is non-empty. This suggests verdict computation MIGHT have a similar gap on /search.
  found: getVerdictForCatalogWatch correctly fetches `getWatchesByUser(user.id)` and computes verdict. No empty-collection fallback gate visible in this Server Action.
  implication: Same root cause as Test 1 likely lives in computeVerdictBundle or computeViewerTasteProfile (handles empty collection). On /search, an empty-or-low-quality verdict response returns a VerdictBundle that renders as essentially empty CollectionFitCard. **Highly likely user perception**: row IS expanding (chevron rotates, label changes) but the visible Panel content shows little or nothing because verdict bundle is degenerate. User reports "doesn't expand" because the visual change is too subtle.

- timestamp: 2026-04-30T18:38:00Z
  checked: WatchSearchRowsAccordion.tsx line 169 — `data-[state=open]:animate-in` Tailwind selectors
  found: base-ui sets `data-open` (no value) on the panel; selectors `data-[state=open]:` will NEVER match. Animations don't run.
  implication: Without animation, the panel may appear instantly with NO visual transition cue. Combined with possible empty-verdict content (from prior evidence), the user has effectively zero visual feedback that anything happened. Strong contributor to "doesn't expand" perception.

## Resolution

root_cause: |
  Investigation INCONCLUSIVE on a single root cause but identified TWO highly-likely contributing structural issues that compound into the user-reported "doesn't expand" perception:

  1. **Tailwind data-attribute mismatch on Accordion.Panel** (CONFIRMED, src/components/search/WatchSearchRowsAccordion.tsx:169):
     - Code uses `data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`
     - base-ui Accordion.Panel sets `data-open` (no value), NOT `data-state="open"` (verified at node_modules/@base-ui/react/accordion/panel/AccordionPanelDataAttributes.js)
     - These selectors will NEVER match → no animation runs → no visual cue when panel opens

  2. **Verdict-bundle content rendering empty/degraded for non-empty collections** (LIKELY, related to Test 1 gap in 20.1-HUMAN-UAT.md):
     - Test 1 (PASS but ISSUE reported): "Your collection is empty — fit score not available yet" appears on /watch/new even with non-empty collection
     - Same `computeVerdictBundle` / `computeViewerTasteProfile` is called from getVerdictForCatalogWatch on /search row expand
     - If verdict returns degenerate (empty rationale, no headline phrasing, no most-similar list), the rendered <CollectionFitCard verdict={cached}> shows essentially blank content
     - Combined with the missing animation (#1), the user sees the row repaint with no visible new content

  **Compound effect**: Click DOES register, state DOES update, panel DOES mount — but with no animation AND minimal/empty verdict content, the visual change is so subtle that the user reports "doesn't expand". The verdict reaching this surface is the same one failing Test 1 — the issues are linked.

  **Less-likely structural risks (kept for completeness)**:
  - Invalid HTML nesting: `<div>`/`<p>` descendants of `<button>` (Accordion.Trigger). Could cause hydration issues but tests pass in jsdom and there are no browser console errors reported, so this is unlikely to be the immediate cause.
  - The "Evaluate" CTA span is `pointer-events-none` (deliberate — bubble-through to Trigger). User reporting "evaluate cta doesn't expand" may indicate confusion about whether they're clicking a real button or a static span — but this is a UX clarity issue, not a functional bug.

fix: |
  TWO TARGETED FIXES — both are small and safe:

  **Fix 1 (mandatory)**: Update Accordion.Panel className in src/components/search/WatchSearchRowsAccordion.tsx:169 to use base-ui's actual data attribute. Replace:
    `data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`
  With:
    `data-[open]:animate-in data-[open]:fade-in-0 not-data-[open]:animate-out not-data-[open]:fade-out-0` (or a CSS height transition keyed off the AccordionPanel CSS var `--accordion-panel-height`)

  **Fix 2 (linked to Test 1 gap)**: Trace why computeVerdictBundle returns empty/degenerate output for non-empty collections. Suspected: a Phase 19.1 catalog enrichment dependency or a check on profile.watches.length that's still zero because the viewer's collection rows don't yet have catalogId backfilled. This is Test 1's gap — it fixes /watch/new and /search simultaneously.

  Optional cleanup: WatchSearchRow's `pointer-events-none` "Evaluate" pill could be visually deemphasized or replaced with text-only "Tap to evaluate" cue to reduce ambiguity about whether it's a separate button.

verification: pending — caller will close this loop via `find-and-fix` invocation or human verification of fixes.
files_changed: []

---
phase: 56A-wear-view-unification
plan: "06"
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/wears/[username]/page.tsx
  - src/components/wears/WearsLane.tsx
autonomous: true
gap_closure: true
requirements: []

must_haves:
  truths:
    - "Swiping past a user's LAST wear on /wears/[username] advances to the NEXT user's lane (D-06)"
    - "Swiping before a user's FIRST wear on /wears/[username] advances to the PREVIOUS user's lane (D-06)"
    - "Cross-user navigation traverses the home rail's user order (railUsernames), with the viewer's own lane included if present"
  artifacts:
    - path: "src/app/wears/[username]/page.tsx"
      provides: "Passes railUsernames + the actor's index within that order to WearsLane"
      contains: "railUsernames"
    - path: "src/components/wears/WearsLane.tsx"
      provides: "Embla first/last boundary detection that router.push-es to the neighbor user's lane"
      contains: "scrollSnapList"
  key_links:
    - from: "src/app/wears/[username]/page.tsx"
      to: "WearsLane"
      via: "railUsernames + railIndex props"
      pattern: "railUsernames"
    - from: "src/components/wears/WearsLane.tsx"
      to: "/wears/[neighbor]"
      via: "router.push at embla boundary"
      pattern: "router\\.push"
---

<objective>
Close UAT gap #1 (MAJOR): swiping past a user's first/last wear on `/wears/[username]` must
advance to the previous/next USER's lane, traversing the home rail's user order (D-06). Today
`railUsernames` is computed in the page but never passed to `WearsLane`, and `WearsLaneProps`
does not accept it — so swipe traverses only within one user's wears and dead-ends at the
boundaries.

This plan is the FOUNDATION for gaps #3 (progress indicator boundary hint) and #6 (desktop
arrows cross-user), which are built on top of this wiring in plan 56A-07.

Purpose: deliver the locked D-06 cross-user advance behavior that was originally deferred as a
"follow-on seam".
Output: page passes `railUsernames` + the actor's index; `WearsLane` detects embla boundary
crossings and navigates to the neighbor lane.
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
@.planning/phases/56A-wear-view-unification/56A-PATTERNS.md

AGENTS.md: this is Next.js 16 with breaking changes from training data. `params` and
`searchParams` are Promises and must be awaited. Read the relevant doc under
`node_modules/next/dist/docs/` before writing Next-specific code.

<interfaces>
<!-- Current WearsLane props (src/components/wears/WearsLane.tsx:58-62) — extend this interface. -->
interface WearsLaneProps {
  slides: WearSlide[]
  initialSlideIndex: number
  viewerId: string
}

<!-- Embla API methods available (verified in node_modules/embla-carousel/components/EmblaCarousel.d.ts): -->
selectedScrollSnap(): number     // index of the currently selected slide
scrollSnapList(): number[]       // all snap positions; .length === slide count
canScrollNext(): boolean         // false when on the last slide
canScrollPrev(): boolean         // false when on the first slide

<!-- The page already computes railUsernames (src/app/wears/[username]/page.tsx:66-68):
     const railData = await getWearRailForViewer(viewerId)
     const railUsernames = railData.tiles.map((t) => t.username)
     It is currently eslint-disabled as unused. -->

<!-- The page already supports ?from= as an index lookup into wears (page.tsx:108-112). The
     neighbor lane's start slide is chosen by ?from= when crossing forward/backward. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pass railUsernames + actor rail-index from the page to WearsLane</name>
  <files>src/app/wears/[username]/page.tsx, src/components/wears/WearsLane.tsx</files>
  <read_first>
    - src/app/wears/[username]/page.tsx (lines 62-68 railUsernames computation; lines 145-153 the WearsLane render) — the file being modified.
    - src/components/wears/WearsLane.tsx (lines 58-75 WearsLaneProps + component signature) — the file being modified.
    - 56A-PATTERNS.md § "src/app/wears/[username]/page.tsx" Rail-order pattern — confirms railUsernames is server-fresh (Pitfall 3: never derive order from a client-supplied URL parameter).
  </read_first>
  <action>
    In WearsLane.tsx: extend `WearsLaneProps` with two new fields — `railUsernames: string[]`
    (the ordered list of usernames in the home rail) and `railIndex: number` (the index of the
    CURRENT actor within `railUsernames`; -1 if the actor is not in the rail, e.g. a manual URL).
    Destructure both in the component signature. Do NOT change embla init yet — Task 2 consumes
    these props.

    In page.tsx: remove the `// eslint-disable-next-line @typescript-eslint/no-unused-vars` on
    line 67 (railUsernames becomes used). Compute `const railIndex =
    railUsernames.findIndex((u) => u?.toLowerCase() === username.toLowerCase())` — case-insensitive
    to match getProfileByUsername's lookup semantics. Pass both `railUsernames={railUsernames}` and
    `railIndex={railIndex}` to `<WearsLane>` alongside the existing `slides`, `initialSlideIndex`,
    `viewerId` props.

    Do NOT pass the order through the URL — it stays server-fresh (Pitfall 3). railUsernames is
    derived from the just-fetched getWearRailForViewer call.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "wears/\[username\]/page|WearsLane" || echo "no type errors in changed files"</automated>
  </verify>
  <acceptance_criteria>
    - `WearsLaneProps` declares `railUsernames: string[]` and `railIndex: number`.
    - page.tsx no longer eslint-disables railUsernames as unused; it computes a case-insensitive
      `railIndex` and passes both props to `<WearsLane>`.
    - `npx tsc --noEmit` reports no NEW type errors in `src/app/wears/[username]/page.tsx` or
      `src/components/wears/WearsLane.tsx`.
    - The order is NOT taken from any client-supplied URL parameter (Pitfall 3 preserved).
  </acceptance_criteria>
  <done>railUsernames + railIndex flow from the server page into WearsLane; types compile.</done>
</task>

<task type="auto">
  <name>Task 2: Embla boundary detection → router.push to the neighbor user's lane</name>
  <files>src/components/wears/WearsLane.tsx</files>
  <read_first>
    - src/components/wears/WearsLane.tsx (lines 80-107: existing emblaApi init + the existing
      `on('select', handleSelect)` effect; lines 88-91: the existing reInit watchDrag effect) —
      mirror the existing event-listener registration/cleanup shape for the new boundary handler.
    - 56A-PATTERNS.md § WearsLane "onSelect → markViewed" — the canonical embla event-listener
      add/remove pattern (`emblaApi.on(...)` / cleanup `emblaApi.off(...)`).
    - node_modules/embla-carousel/components/EmblaCarousel.d.ts — confirms scrollSnapList(),
      selectedScrollSnap(), canScrollPrev/Next() signatures.
  </read_first>
  <action>
    Add cross-user boundary navigation in WearsLane. Implement a forward-boundary and a
    backward-boundary intent:

    - FORWARD: when the user attempts to advance past the LAST slide (current actor's wears are
      exhausted), navigate to the NEXT username in `railUsernames` (the entry after `railIndex`,
      wrapping is NOT required — at the rail's end, do nothing). Use
      `router.push(\`/wears/\${nextUsername}\`)` — do NOT append `?from=` for a forward cross
      (the neighbor lane opens at its oldest-unviewed default per D-05).
    - BACKWARD: when the user attempts to go before the FIRST slide, navigate to the PREVIOUS
      username (`railIndex - 1`). Append `?from=` only if you have a deterministic target wear;
      otherwise omit it and let the neighbor open at its default index.

    Detection approach: embla does not emit a native "tried to scroll past the end" event when
    `containScroll: false` already allows over-drag, so detect intent at the boundary. Use the
    embla `'select'` and `'settle'` events plus `canScrollNext()`/`canScrollPrev()`: when a select
    settles on the last index AND a further forward drag/scroll is attempted, trigger the forward
    push; symmetric for the first index. A robust, testable implementation: register a guard that,
    on `'scroll'`/`'settle'`, reads `selectedScrollSnap()` against `scrollSnapList().length - 1`
    and `0`; combine with the embla pointer 'pointerUp' boundary intent. Pick the cleanest embla
    idiom that fires exactly once per boundary cross (debounce to avoid double-push), and guard so
    `commentOpen === true` suppresses cross-user navigation (swipe is paused while the sheet is
    open — never navigate away under an open sheet).

    Guards (mandatory):
    - If `railIndex === -1` (actor not in rail / manual URL), disable cross-user navigation entirely.
    - If there is no neighbor in the requested direction (start/end of rail), do nothing — the lane
      simply does not advance past the boundary (no error, no wrap).
    - Single-flight: once a cross-user `router.push` is fired, do not fire a second until the
      component re-mounts on the neighbor route.

    Register listeners in a `useEffect` with `[emblaApi, railUsernames, railIndex, commentOpen, router]`
    deps and clean them up on unmount, mirroring the existing select-listener effect's add/remove
    shape.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "WearsLane" || echo "no type errors"; npm run lint 2>&1 | grep -E "WearsLane" || echo "lint clean for WearsLane"</automated>
  </verify>
  <acceptance_criteria>
    - WearsLane references `scrollSnapList` (or `canScrollNext`/`canScrollPrev`) for boundary
      detection and calls `router.push` to a `/wears/[neighbor]` target.
    - Forward boundary navigates to `railUsernames[railIndex + 1]`; backward boundary navigates to
      `railUsernames[railIndex - 1]`.
    - When `railIndex === -1`, no cross-user navigation occurs (guarded).
    - When at the start/end of the rail with no neighbor, no navigation and no thrown error.
    - Cross-user navigation does NOT fire while `commentOpen === true`.
    - The boundary listeners are cleaned up on unmount (no leaked embla `.on` handlers).
    - `npx tsc --noEmit` and `npm run lint` report no new errors for WearsLane.tsx.
  </acceptance_criteria>
  <done>Swiping past the last/first wear advances to the next/previous user's lane; boundaries and the open-sheet state are guarded.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes for both modified files (no new errors).
- `npm run lint` clean for the two modified files.
- Behavior: on a user with active wears who is mid-rail, swiping past the last wear lands on the
  next rail user's `/wears/[username]`; swiping before the first wear lands on the previous user.
</verification>

<success_criteria>
- railUsernames + railIndex are threaded from the server page into WearsLane (D-06).
- Embla boundary crossing triggers a single router.push to the correct neighbor lane.
- All boundary/guard edge cases (no neighbor, actor-not-in-rail, sheet-open) handled without errors.
</success_criteria>

<output>
After completion, create `.planning/phases/56A-wear-view-unification/56A-06-SUMMARY.md`
</output>

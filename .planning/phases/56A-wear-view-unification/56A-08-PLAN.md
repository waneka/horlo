---
phase: 56A-wear-view-unification
plan: "08"
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/wear/WearCard.tsx
  - src/components/wear/WearDetailHero.tsx
  - src/components/wear/WearPhotoClient.tsx
autonomous: true
gap_closure: true
requirements: []

must_haves:
  truths:
    - "Tapping the watch brand/model on a wear card navigates to that watch's detail page (/watch/[watchId]) (D-01)"
    - "The brand/model link works on BOTH routes (stories lane and detail page) because the card is shared"
  artifacts:
    - path: "src/components/wear/WearDetailHero.tsx"
      provides: "WearPhotoOverlays wraps the brand/model in a Link to /watch/[watchId]"
      contains: "/watch/"
    - path: "src/components/wear/WearCard.tsx"
      provides: "watchId is threaded into the photo layer (no longer discarded as _watchId)"
      contains: "watchId"
  key_links:
    - from: "src/components/wear/WearCard.tsx"
      to: "WearPhotoClient / WearDetailHero"
      via: "watchId prop"
      pattern: "watchId"
    - from: "src/components/wear/WearDetailHero.tsx (WearPhotoOverlays brand/model)"
      to: "/watch/[watchId]"
      via: "next/link Link href"
      pattern: "/watch/"
---

<objective>
Close UAT gap #2 (MAJOR): tapping a wear card's watch brand/model does nothing. Today the brand/model
render as plain spans inside WearPhotoOverlays (WearDetailHero.tsx:102-103), and `watchId` IS already
a WearCard prop but is discarded as `_watchId` (WearCard.tsx:71, code-review finding IN-01). The
avatar/username already links to /u/[username] in the same overlay (WearDetailHero.tsx:79-85) — this
plan matches that exact pattern for the brand/model.

The fix affects BOTH routes automatically because WearCard / WearPhotoOverlays is the single shared
card (D-12). It implements the locked D-01 behavior ("brand/model → /watch/[id]") and the UI-SPEC
Overlay Interaction Summary row ("Tap brand/model → Navigate to /watch/[watchId]").

Purpose: make the watch brand/model a working link to the watch detail page on both wear surfaces.
Output: watchId flows from WearCard through the photo layer into WearPhotoOverlays, where brand/model
is wrapped in a Link to /watch/[watchId].
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
@.planning/phases/56A-wear-view-unification/56A-PATTERNS.md

<interfaces>
WearCard already receives watchId (src/components/wear/WearCard.tsx:27 prop; line 71 it is destructured
as `watchId: _watchId` — i.e. accepted then discarded). It must instead be passed down to the photo
layer (WearPhotoClient when signedUrl !== null, WearDetailHero otherwise — WearCard.tsx:103-126).

WearPhotoOverlays (src/components/wear/WearDetailHero.tsx:54-108) is the single overlay component
rendered by BOTH WearDetailHero AND WearPhotoClient. It currently renders:
  - avatar/username: ALREADY a Link to /u/[username] (lines 79-85) — the analog to copy.
  - brand: a plain span (line 102)
  - model: a plain span (line 103)

The closest analog pattern (already in this file, lines 79-85):
  <Link href={`/u/${username}`} className={cn('text-sm font-semibold hover:opacity-80', textClass)}>
    {displayName ?? username}
  </Link>

The brand/model overlay sits inside a pointer-events scrim. The bottom overlay wrapper at
WearDetailHero.tsx:97-100 does NOT have pointer-events-none on the inner content row (line 101 is a
plain flex column with p-3) — confirm the brand/model link is clickable (the TOP overlay uses
pointer-events-none on the gradient wrapper + pointer-events-auto on the inner row at lines 69/72;
mirror that pattern on the bottom overlay if needed so the new Link is actually tappable).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Thread watchId from WearCard into the photo layer</name>
  <files>src/components/wear/WearCard.tsx, src/components/wear/WearPhotoClient.tsx</files>
  <read_first>
    - src/components/wear/WearCard.tsx (line 71 the `watchId: _watchId` discard; lines 103-126 the
      WearPhotoClient / WearDetailHero render where watchId must be forwarded) — file being modified.
    - src/components/wear/WearPhotoClient.tsx (lines 45-65 props signature; lines 79-119 the failed
      fallback paths that render WearPhotoOverlays; lines 153-163 the happy-path WearPhotoOverlays) —
      file being modified.
    - src/components/wear/WearDetailHero.tsx (props of WearDetailHero at lines 114-132; props of
      WearPhotoOverlays at lines 34-43) — to know what new prop name to thread (read-only here; Task 2
      modifies it).
  </read_first>
  <action>
    In WearCard.tsx: stop discarding watchId. Change the destructure `watchId: _watchId` (line 71) to
    `watchId`. Pass `watchId={watchId}` to BOTH photo-layer branches: the WearPhotoClient call
    (lines 104-114) and the WearDetailHero call (lines 116-125).

    In WearPhotoClient.tsx: add `watchId: string` to the props interface (lines 55-65) and destructure
    it (lines 45-54). Forward `watchId={watchId}` to EVERY WearPhotoOverlays render in this file: the
    failed→watchImageUrl fallback (line 91), the failed→no-photo fallback (line 109), and the happy-path
    render (line 154). All three must carry watchId so the brand/model link works in every photo state.

    Do NOT change the signed-URL retry state machine, the native img usage, or any aspect-ratio classes
    (Pitfall F-2 untouched).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -E "WearCard|WearPhotoClient" || echo "no type errors"; grep -q "_watchId" src/components/wear/WearCard.tsx && echo "STILL DISCARDED" || echo "watchId no longer discarded"</automated>
  </verify>
  <acceptance_criteria>
    - WearCard.tsx no longer contains `_watchId`; watchId is destructured normally and passed to both
      the WearPhotoClient and WearDetailHero branches.
    - WearPhotoClient.tsx props include `watchId: string`; all THREE WearPhotoOverlays renders in that
      file forward watchId.
    - npx tsc --noEmit reports no new errors for WearCard.tsx or WearPhotoClient.tsx.
    - The signed-URL retry state machine and aspect-ratio classes are unchanged.
  </acceptance_criteria>
  <done>watchId flows from WearCard into every WearPhotoOverlays render across both photo layers.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wrap brand/model in a Link to /watch/[watchId] in WearPhotoOverlays</name>
  <files>src/components/wear/WearDetailHero.tsx</files>
  <behavior>
    - Given WearPhotoOverlays rendered with watchId="w-123", the brand text is inside an anchor whose
      href is "/watch/w-123".
    - Given WearPhotoOverlays rendered with watchId="w-123", the model text is reachable via the same
      /watch/w-123 link (brand+model may share one Link or be two Links to the same href).
    - The brand/model Link visually matches the existing avatar/username Link (text-sm, hover:opacity,
      hasPhoto text-color switch) — no new accent color.
    - The brand/model link is actually clickable (not blocked by a pointer-events-none scrim).
  </behavior>
  <read_first>
    - src/components/wear/WearDetailHero.tsx (lines 1-6 imports — Link is ALREADY imported from
      next/link at line 2; lines 34-43 WearPhotoOverlays props; lines 79-92 the avatar/username Link
      ANALOG to copy; lines 96-105 the bottom brand/model overlay being modified; lines 134-171 the two
      WearDetailHero render branches that call WearPhotoOverlays) — file being modified.
    - 56A-UI-SPEC.md § Overlay Interaction Summary (Tap brand/model → Navigate to /watch/[watchId]) and
      §1 Shared WearCard Overlays — the visual contract for the brand/model overlay.
  </read_first>
  <action>
    Add `watchId: string` to the WearPhotoOverlays props interface (lines 34-43) and destructure it
    (lines 54-62). Wrap the brand and model spans (lines 101-104) in a single next/link Link with
    href={`/watch/${watchId}`}, mirroring the existing avatar/username Link at lines 79-85 (same
    className idiom: text-sm + hover:opacity-80 + the existing textClass for the hasPhoto color switch).
    Keep brand as font-semibold and model as regular weight inside the link.

    Pointer-events: the bottom overlay gradient wrapper (lines 97-100) must allow the link to be
    clickable. If the bottom wrapper inherits pointer-events-none anywhere, mirror the TOP overlay's
    pattern (pointer-events-none on the gradient wrapper at line 69 + pointer-events-auto on the inner
    content row at line 72) so the brand/model Link is tappable while the scrim itself does not block
    swipes. Verify the inner brand/model row carries pointer-events-auto if the wrapper is
    pointer-events-none.

    Then thread watchId into both WearDetailHero render branches: the watchImageUrl branch
    (WearPhotoOverlays call at lines 143-151) and the no-photo branch (lines 161-169). Add
    `watchId: string` to the WearDetailHero props interface (lines 114-132) and pass watchId down.
    (WearCard already forwards watchId to WearDetailHero per Task 1.)

    Do NOT use next/image. Do NOT change the aspect-[4/5] container classes or the gradient scrim values.
  </action>
  <verify>
    <automated>grep -q "/watch/" src/components/wear/WearDetailHero.tsx && npx tsc --noEmit 2>&1 | grep -E "WearDetailHero" || echo "linked + no type errors"</automated>
  </verify>
  <acceptance_criteria>
    - WearPhotoOverlays props include `watchId: string`; the brand/model render inside a next/link Link
      with href `/watch/${watchId}`.
    - WearDetailHero props include `watchId: string`; both render branches forward it to WearPhotoOverlays.
    - The brand/model Link mirrors the avatar/username Link styling (text-sm, hover:opacity-80, textClass
      hasPhoto switch) — no accent color.
    - The brand/model link is clickable (pointer-events-auto on the inner row if the scrim wrapper is
      pointer-events-none).
    - grep finds `/watch/` in WearDetailHero.tsx and npx tsc --noEmit reports no new errors there.
    - npm run lint clean for the three modified files.
  </acceptance_criteria>
  <done>Brand/model on a wear card is a working link to /watch/[watchId] on both routes (D-01).</done>
</task>

</tasks>

<verification>
- npx tsc --noEmit passes for WearCard.tsx, WearPhotoClient.tsx, WearDetailHero.tsx.
- npm run lint clean for all three files.
- grep -q "_watchId" src/components/wear/WearCard.tsx returns nothing (watchId no longer discarded).
- grep "/watch/" src/components/wear/WearDetailHero.tsx finds the brand/model link href.
- Behavior: on both /wears/[username] and /wear/[id], tapping the watch brand/model navigates to
  /watch/[watchId].
</verification>

<success_criteria>
- watchId is no longer discarded; it reaches every WearPhotoOverlays render across both photo layers.
- brand/model is wrapped in a Link to /watch/[watchId], matching the avatar/username Link pattern (D-01).
- The link works on BOTH routes because the card is shared (D-12).
</success_criteria>

<output>
After completion, create `.planning/phases/56A-wear-view-unification/56A-08-SUMMARY.md`
</output>

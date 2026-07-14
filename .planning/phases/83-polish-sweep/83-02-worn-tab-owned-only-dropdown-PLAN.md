---
phase: 83-polish-sweep
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/profile/WornTabContent.tsx
autonomous: true
requirements:
  - POLISH-02
tags:
  - ui
  - profile
  - worn-tab
  - polish

must_haves:
  truths:
    - "On the Worn tab, opening the `LogTodaysWearButton` dropdown shows only currently-owned watches — no wishlist items, no grail items (POLISH-02, per D-03)."
    - "On the Worn tab, opening the events-filter `Select` shows the same currently-owned-only list — no wishlist items, no grail items (per D-03)."
    - "The events-filter default `All watches` option remains — historical wear events for a watch whose status was later demoted are still visible in the `All watches` view (per D-04)."
    - "`watchMap` (the timeline-label lookup) stays populated from ALL watches so wear-event rows for demoted watches still render brand/model correctly (per D-05)."
    - "The dropdown source derives from the existing `ownedWatches: Watch[]` prop (already computed at page.tsx:493 as `watches.filter((w) => w.status === 'owned')`), not from `Object.values(watchMap)` (per D-05)."
    - "The literal predicate `status === 'owned'` is used at the derivation site — no forward-looking helper for Phase 85's `previously_owned` is introduced here (per D-06)."
  artifacts:
    - path: src/components/profile/WornTabContent.tsx
      provides: "Worn-tab dropdown source scoped to owned-only via existing ownedWatches prop"
      contains: "`watchOptions` derived from `ownedWatches`; `watchMap` prop still complete; both `Select` items map (events filter + LogTodaysWearButton) consume `watchOptions`"
  key_links:
    - from: "src/app/u/[username]/[tab]/page.tsx (line 493)"
      to: "src/components/profile/WornTabContent.tsx (`ownedWatches` prop)"
      via: "already-existing prop threading; no page-layer change required"
      pattern: "ownedWatches={watches.filter((w) => w.status === 'owned')}"
    - from: "src/components/profile/WornTabContent.tsx (`watchOptions` useMemo)"
      to: "events filter Select (line 149) and LogTodaysWearButton mount (line 157)"
      via: "both consumers already pass `watchOptions` — the change is purely to the derivation source"
      pattern: "watches={watchOptions}"
---

<objective>
POLISH-02: Constrain both watch-selection dropdowns on the Worn tab (the `LogTodaysWearButton` picker AND the events-filter `Select`) to `status === 'owned'` watches only. Wishlist and grail watches disappear from both dropdowns. The events-filter `All watches` default option remains untouched (per D-04) so historical wear-event rows for demoted watches still render in the "All" view.

Purpose: Wishlist and grail watches can never have wear events; showing them in the picker/filter is noise. The change is a single-line derivation swap — from `Object.values(watchMap)` to `ownedWatches` — and reuses the `ownedWatches` prop the page already threads through (line 493 of `[tab]/page.tsx`).

Output: `src/components/profile/WornTabContent.tsx` with `watchOptions` derived from `ownedWatches` (with the existing brand/model sort applied) instead of from `Object.values(watchMap)`. No changes to the page.tsx boundary, no changes to `watchMap`, no changes to `LogTodaysWearButton.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/83-polish-sweep/83-CONTEXT.md
@CLAUDE.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. Executor should use these directly. -->

From src/components/profile/WornTabContent.tsx (current):

```typescript
interface WatchSummary {
  id: string
  brand: string
  model: string
  imageUrl: string | null
}

interface WornTabContentProps {
  events: WearEventLite[]
  watchMap: Record<string, WatchSummary>   // built from ALL watches (page.tsx:434); stays complete
  isOwner: boolean
  username: string
  viewerId: string | null
  ownedWatches: Watch[]  // page.tsx:493 = watches.filter((w) => w.status === 'owned')
}
```

From src/lib/types.ts (reference — do not modify):

```typescript
type WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'
interface Watch {
  id: string
  brand: string
  model: string
  imageUrl?: string
  status: WatchStatus
  // ... other fields not relevant to this plan
}
```

Note: `Watch.imageUrl` is `string | undefined`; `WatchSummary.imageUrl` is `string | null`. The `watchOptions` array is currently typed as `WatchSummary[]` because `Object.values(watchMap)` produces `WatchSummary[]`. After the swap, `watchOptions` will be derived from `Watch[]` — the shape must be normalized to what the consumers (`LogTodaysWearButton` and the events-filter `Select`) need: `{ id, brand, model }`. `LogTodaysWearButton`'s local `WatchSummary` type only requires `{ id, brand, model }` (no imageUrl). The events-filter `SelectItem` only reads `w.id`, `w.brand`, `w.model`. So the map projection is `{ id, brand, model }` — imageUrl is not needed downstream.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap `watchOptions` derivation source from watchMap to ownedWatches in WornTabContent.tsx</name>
  <read_first>
    - src/components/profile/WornTabContent.tsx (target file — full file must be read; the `watchOptions` useMemo is at lines 70-77, the events-filter `Select` is at 140-155, `LogTodaysWearButton` is mounted at 157, the `WornTabContentProps` interface is at 34-48 including the pre-existing `ownedWatches: Watch[]` prop)
    - src/components/profile/LogTodaysWearButton.tsx (consumer — verify its local `WatchSummary` shape only requires `{ id, brand, model }` — line 23-27 confirms; no `imageUrl` is read)
    - src/app/u/[username]/[tab]/page.tsx (data-source boundary — lines 434-444 build `watchMap` from ALL watches; line 493 passes `ownedWatches={watches.filter((w) => w.status === 'owned')}` — no changes needed at this boundary)
    - .planning/phases/83-polish-sweep/83-CONTEXT.md (locked decisions D-03 / D-04 / D-05 / D-06)
  </read_first>
  <files>src/components/profile/WornTabContent.tsx</files>
  <action>
    Per D-03 / D-05 / D-06 (POLISH-02):

    1) Replace the `watchOptions` useMemo body. Currently at lines 70-77:

       - Input: `Object.values(watchMap)` (typed `WatchSummary[]`, contains ALL watches per D-05 rationale).
       - After the swap: read from the `ownedWatches` prop (`Watch[]`) and project each entry to the minimal shape both consumers need — `{ id: w.id, brand: w.brand, model: w.model }`.
       - The dependency array MUST change from `[watchMap]` to `[ownedWatches]`.
       - The existing sort predicate MUST be preserved verbatim: `(a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model)`.
       - The projected object shape MUST be compatible with `LogTodaysWearButton`'s local `WatchSummary` type (which requires `{ id: string; brand: string; model: string }` — see `LogTodaysWearButton.tsx:23-27`) AND with the events-filter `SelectItem` render (`{w.brand} {w.model}` at line 151). Both are satisfied by `{ id, brand, model }`.

       Do NOT introduce a helper module, a status enum re-export, or a Phase-85 forward-looking scaffold. Per D-06, the literal `status === 'owned'` predicate already lives at `page.tsx:493` (the source-of-truth filter); this plan does NOT re-implement it inside the component — it consumes the already-filtered prop.

    2) Do NOT change the `watchMap` prop, its type, or how the timeline consumes it (line 160: `<WornTimeline events={filtered} watchMap={watchMap} />`; line 162: `<WornCalendar events={filtered} watchMap={watchMap} />`). Per D-05, `watchMap` must stay populated from ALL watches so a wear-event row referencing a now-demoted watch still renders brand/model correctly.

    3) Do NOT change the events-filter `Select` default `All watches` option at line 148 (`<SelectItem value="all">All watches</SelectItem>`). Per D-04, this option stays as-is — historical wear events for demoted watches remain visible under the "All" filter; only the by-watch filter options for demoted watches disappear (which is the intended consequence of swapping the derivation source).

    4) Do NOT rename the `watchOptions` variable — its consumers on lines 149 (events-filter Select) and 157 (LogTodaysWearButton) already reference it by that name.

    5) Do NOT modify `LogTodaysWearButton.tsx`. Its `watches: WatchSummary[]` prop expects `{ id, brand, model }`; the new `watchOptions` shape satisfies that contract.

    6) Do NOT modify `src/app/u/[username]/[tab]/page.tsx`. `ownedWatches` is already threaded (line 493).

    Sanity check while editing: after the swap, `watchMap` still appears in the file (used by `filtered` events on line 82-83 by keying `e.watchId` and by the two view renderers on 160 + 162); it just isn't the source of `watchOptions` anymore.
  </action>
  <verify>
    <automated>cd /Users/tylerwaneka/Documents/horlo &amp;&amp; ( grep -n 'watchOptions' src/components/profile/WornTabContent.tsx ; echo '---' ; grep -n 'Object.values(watchMap)' src/components/profile/WornTabContent.tsx ; echo '---should be 0---' ; grep -c 'ownedWatches' src/components/profile/WornTabContent.tsx ; echo '---should be &gt;= 2 (prop + useMemo body)---' ; npm run build 2>&amp;1 | tail -5 )</automated>
  </verify>
  <acceptance_criteria>
    - Source assertion: `grep -c 'Object.values(watchMap)' src/components/profile/WornTabContent.tsx` returns 0 (old derivation source removed).
    - Source assertion: `grep -c 'ownedWatches' src/components/profile/WornTabContent.tsx` returns at least 3 (interface prop declaration, destructured param, useMemo body reference — was previously 2 before this plan, will be 3+ after).
    - Source assertion: the `watchOptions` useMemo dependency array reads `[ownedWatches]` (not `[watchMap]`) — verify by `grep -n 'watchOptions' src/components/profile/WornTabContent.tsx` and inspecting the trailing dependency-array line of the useMemo.
    - Source assertion: `watchMap` still appears as a prop on `<WornTimeline>` and `<WornCalendar>` (`grep -c 'watchMap={watchMap}' src/components/profile/WornTabContent.tsx` returns 2 — one per view renderer).
    - Source assertion: `<SelectItem value="all">All watches</SelectItem>` still present verbatim (`grep -c '<SelectItem value="all">All watches</SelectItem>' src/components/profile/WornTabContent.tsx` returns 1).
    - Source assertion: `LogTodaysWearButton.tsx` is NOT modified (`git diff --name-only -- src/components/profile/LogTodaysWearButton.tsx` returns empty; if using worktree, equivalent check).
    - Source assertion: `[tab]/page.tsx` is NOT modified (`git diff --name-only -- 'src/app/u/[username]/[tab]/page.tsx'` returns empty).
    - Build gate: `npm run build` exits 0.
    - Type gate: no new TS errors introduced against pre-plan baseline (per project_baseline_not_green_build_is_gate, the build is authoritative; do not rely on full-repo `tsc`).
    - Local-First verification surface (per D-13 — for the human walker, not the automated gate): `npm run dev` against local Supabase; sign in as `viewer@horlo.test` (or a seed user with a mixed status collection — vintage-anna has multiple statuses); navigate to Worn tab; confirm both the events-filter dropdown AND the "Log Today's Wear" dialog picker show only owned watches, no wishlist/grail. Confirm timeline rows for pre-existing wear events on demoted watches still render brand/model correctly (D-05 rationale — if no demoted-with-past-wear-event fixture exists locally, verify only the dropdown scope; the mobile Safari walk against prod (per D-13 + `feedback_mobile_ui_verify_on_prod`) covers the "All watches" behavior on real data).
  </acceptance_criteria>
  <done>`watchOptions` derives from `ownedWatches` with `{ id, brand, model }` projection; existing brand+model sort preserved; `watchMap` prop unchanged and still consumed by both timeline and calendar view renderers; `All watches` default filter option unchanged; no changes to `LogTodaysWearButton.tsx` or `[tab]/page.tsx`.</done>
</task>

</tasks>

<verification>
- `npm run build` exits 0.
- `grep -c 'Object.values(watchMap)' src/components/profile/WornTabContent.tsx` returns 0.
- `grep -c 'ownedWatches' src/components/profile/WornTabContent.tsx` returns ≥ 3.
- `watchMap` still passed to WornTimeline and WornCalendar (2 matches).
- Local-First per D-13: desktop `npm run dev` walk confirms both dropdowns scoped to owned-only; mobile Safari prod walk (per `feedback_mobile_ui_verify_on_prod`) confirms same on prod-data.
</verification>

<success_criteria>
- POLISH-02 satisfied: both Worn-tab watch dropdowns show only owned watches.
- Timeline/calendar rendering for demoted-watch historical wear events preserved (D-04 + D-05).
- Diff is a single-file, single-useMemo swap — no ripple.
</success_criteria>

<output>
After completion, create `.planning/phases/83-polish-sweep/83-02-SUMMARY.md`.
</output>

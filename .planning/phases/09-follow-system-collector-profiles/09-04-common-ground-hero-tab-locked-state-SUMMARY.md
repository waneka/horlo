---
phase: 09-follow-system-collector-profiles
plan: 04
subsystem: ui
tags: [react, server-component, client-component, next-navigation, server-only, common-ground, taste-overlap, locked-state, privacy-gate, tailwind, accessibility]

# Dependency graph
requires:
  - phase: 09-follow-system-collector-profiles
    plan: 01
    provides: getTasteOverlapData (React cache()-wrapped DAL) + computeTasteOverlap (pure lib) + TasteOverlapResult type
  - phase: 09-follow-system-collector-profiles
    plan: 02
    provides: layout.tsx server-hydrated isFollowing pattern + viewer/owner context flowing to header/locked branches
  - phase: 08-self-profile-privacy-controls
    provides: ProfileTabs, PrivateTabState inline helper (replaced here), profile_settings collectionPublic flag
provides:
  - src/app/u/[username]/common-ground-gate.ts — single-sourced three-way gate (viewerId && !isOwner && collectionPublic) with TasteOverlapResult | null return type
  - src/components/profile/LockedTabCard.tsx — per-tab locked state (replaces inline PrivateTabState) with worn → "worn history" remap
  - src/components/profile/CommonGroundHeroBand.tsx — compact band between ProfileHeader and ProfileTabs (3 pill variants + stat strip + drill-down link + empty-overlap single line)
  - src/components/profile/CommonGroundTabContent.tsx — 6th-tab detail (explainer card + shared watches grid + shared taste tags row + dual style/role bars)
  - src/components/profile/ProfileTabs.tsx — showCommonGround prop + data-tab-id attribute on every TabsTrigger
  - src/app/u/[username]/layout.tsx — resolveCommonGround invocation + CommonGroundHeroBand render + showCommonGround wiring
  - src/app/u/[username]/[tab]/page.tsx — VALID_TABS extends common-ground; common-ground branch dispatch; 5x LockedTabCard replacement of PrivateTabState
affects:
  - phase 10+ consumers of the Common Ground surface (no immediate downstream plans in phase 09)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-sourced privacy gate: layout.tsx + [tab]/page.tsx both call resolveCommonGround — neither imports the raw DAL — so T-09-21/22/23 mitigations cannot diverge across surfaces"
    - "Server-side aggregate-only payload: gate helper returns TasteOverlapResult (never TasteOverlapData). Client Components accept TasteOverlapResult only"
    - "Section-omit rendering: CommonGroundTabContent omits each of sharedWatches / sharedTasteTags / sharedStyleRows when empty — tab exists iff at least one has content"
    - "Conditional tab via prop: ProfileTabs appends 6th tab entry inside render when showCommonGround=true, keeping the component a pure rendering of tabs[] rather than hard-coded JSX per tab"
    - "data-tab-id testability attribute: every TabsTrigger carries data-tab-id={tab.id} so test can reliably count renderable tabs"

key-files:
  created:
    - src/components/profile/LockedTabCard.tsx
    - src/components/profile/CommonGroundHeroBand.tsx
    - src/components/profile/CommonGroundTabContent.tsx
    - src/app/u/[username]/common-ground-gate.ts
    - tests/components/profile/LockedTabCard.test.tsx
    - tests/components/profile/CommonGroundHeroBand.test.tsx
    - tests/components/profile/CommonGroundTabContent.test.tsx
    - tests/components/profile/ProfileTabs.test.tsx
    - tests/app/layout-common-ground-gate.test.ts
  modified:
    - src/components/profile/ProfileTabs.tsx
    - src/app/u/[username]/layout.tsx
    - src/app/u/[username]/[tab]/page.tsx

key-decisions:
  - "Three-way gate extracted to common-ground-gate.ts (server-only) — single-sourced between layout.tsx and [tab]/page.tsx (DRY + T-09-21/23 cannot diverge)"
  - "Gate helper returns TasteOverlapResult | null — the raw TasteOverlapData (with .viewer.watches, .owner.watches) never leaves this module, so Client Components cannot receive raw owner collection (T-09-22)"
  - "6th tab is NEVER 'locked' — either present (when !isOwner && overlap.hasAny) or absent (D-02, D-17). LockedTabCard returns null for tab='common-ground' as defense-in-depth; [tab]/page.tsx emits notFound() on gate fail or empty overlap."
  - "'worn' tab label remaps to 'worn history' in LockedTabCard copy per UI-SPEC line 357 — hard-coded in TAB_LABELS record, not a prop"
  - "CommonGroundTabContent renders 4 sections with space-y-8; each lower section omits when its data is empty — section-order rule per UI-SPEC"
  - "ProfileTabs extended with showCommonGround default=false + data-tab-id on every TabsTrigger for testability — tests count querySelectorAll('[data-tab-id]')"

patterns-established:
  - "Server-only gate module pattern: import 'server-only' + named export + returns aggregate-only result type; imported via relative path from layout.tsx and [tab]/page.tsx"
  - "Payload-shape contract pinned by test: not.toHaveProperty('viewer') + not.toHaveProperty('owner') on the returned TasteOverlapResult asserts raw collection cannot leak"
  - "Conditional UI via prop threading: layout computes overlap?.hasAny server-side, passes boolean down — Client Component ProfileTabs never calls the gate itself"

requirements-completed: [PROF-08, PROF-09]

# Metrics
duration: ~11min (including worktree rebase correction)
completed: 2026-04-21
---

# Phase 9 Plan 04: Common Ground Hero Band + 6th Tab + Locked State Summary

**Single-sourced three-way Common Ground gate (viewerId && !isOwner && collectionPublic) extracted to a server-only helper; hero band + 6th tab + per-tab LockedTabCard all wired and pinned by 36 new tests across 5 files. T-09-21 / T-09-22 / T-09-23 mitigations enforced at the gate helper with payload-shape contract assertions.**

## Performance

- **Duration:** ~11 min (first commit after worktree correction 2026-04-21T18:33Z → final task commit 2026-04-21T18:44Z)
- **Started:** 2026-04-21T18:34:15Z
- **Completed:** 2026-04-21T18:44:42Z
- **Tasks:** 4 (all green, TDD RED → GREEN per task)
- **Files created:** 9 (4 production + 5 test)
- **Files modified:** 3 (ProfileTabs, layout.tsx, [tab]/page.tsx)
- **Tests added:** 36 (8 LockedTabCard + 11 CommonGroundHeroBand + 8 CommonGroundTabContent + 3 ProfileTabs + 6 gate)
- **Full suite post-plan:** 1412 passed / 3 skipped / 0 failed

## Accomplishments

- Shipped the complete Phase 9 user-facing Common Ground surface: hero band on public profiles, 6th tab detail view, per-tab LockedTabCard for private tabs, and a single-sourced server-only privacy gate.
- `common-ground-gate.ts` enforces the three-way gate BEFORE the DAL fires — when any condition fails, `getTasteOverlapData` is not called and the helper returns null (T-09-08, T-09-21, T-09-23 mitigated).
- Payload-shape contract: `resolveCommonGround` returns `TasteOverlapResult | null` — never raw `TasteOverlapData`. Pinned by `not.toHaveProperty('viewer')` + `not.toHaveProperty('owner')` assertions in the gate test (T-09-22).
- CommonGroundHeroBand renders three pill variants (Strong / Some / Different overlap) with UI-SPEC color classes, pluralized stat strip, desktop-only drill-down link, and a centered empty-line fallback.
- CommonGroundTabContent renders four sections (explainer / shared watches / shared taste tags / Collection composition) with per-section omit-when-empty — section-order per UI-SPEC.
- ProfileTabs gained a `showCommonGround` prop (default false) and `data-tab-id` on every TabsTrigger so the test suite can reliably count renderable tabs.
- LockedTabCard replaces all 5 existing `PrivateTabState` usages with displayName+username awareness; inline helper removed entirely.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1 RED — LockedTabCard copy + lock icon per D-18** — `bcac069` (test)
2. **Task 1 GREEN — LockedTabCard component with per-tab copy** — `ac976d5` (feat)
3. **Task 2 RED — CommonGroundHeroBand variants + empty-overlap** — `ce72483` (test)
4. **Task 2 GREEN — CommonGroundHeroBand with pill variants + stat strip** — `46757ef` (feat)
5. **Task 3 RED — CommonGroundTabContent explainer variants + section omission + dual-bar widths** — `6ffc23d` (test)
6. **Task 3 RED — ProfileTabs showCommonGround conditional 6th tab** — `18bbab3` (test)
7. **Task 3 GREEN — CommonGroundTabContent + ProfileTabs extension** — `1c8d377` (feat)
8. **Task 4 RED — layout three-way Common Ground gate + payload-shape contract** — `306608c` (test)
9. **Task 4 GREEN — wire hero band + 6th tab + LockedTabCard + extracted resolveCommonGround gate** — `33ba630` (feat)

## Files Created/Modified

### Created

- `src/components/profile/LockedTabCard.tsx` — 53 lines. 6-tab-id union; returns null for `common-ground` (defense-in-depth). TAB_LABELS map remaps `worn` → `worn history`.
- `src/components/profile/CommonGroundHeroBand.tsx` — 91 lines. Three pill color variants; stat strip via fragments array joined with ` · `; Link to `/u/{username}/common-ground` with `hidden sm:inline`.
- `src/components/profile/CommonGroundTabContent.tsx` — 161 lines. DualBarGroup helper (inline, not exported). buildExplainerBody helper returns per-variant copy. space-y-8 between sections.
- `src/app/u/[username]/common-ground-gate.ts` — 44 lines. `import 'server-only'`. Exports `resolveCommonGround(input: GateInput): Promise<TasteOverlapResult | null>`.
- `tests/components/profile/LockedTabCard.test.tsx` — 8 tests: lock icon, 5 tab copy variants, common-ground null render, bg-card+rounded-xl+border+py-16 classes.
- `tests/components/profile/CommonGroundHeroBand.test.tsx` — 11 tests: three pill variants, pluralization (watch / tag), lean-style fragment render+omit, See full comparison link href+classes, empty-overlap single-line, container border/bg classes.
- `tests/components/profile/CommonGroundTabContent.test.tsx` — 8 tests: three explainer heading + body variants, three section-omit paths, dual-bar inline widths (60% + 50%), legend (You + ownerDisplayLabel).
- `tests/components/profile/ProfileTabs.test.tsx` — 3 tests: 5 triggers when false, 6 when true, existing 5 tabs each carry data-tab-id.
- `tests/app/layout-common-ground-gate.test.ts` — 6 tests: 3 NOT-called paths, 1 IS-called with exact args, payload-shape contract (no .viewer / .owner raw keys), repeated-call passthrough.

### Modified

- `src/components/profile/ProfileTabs.tsx` — Added `showCommonGround?: boolean` prop (default false). Renamed `TABS` → `BASE_TABS` + added `COMMON_GROUND_TAB` constant. Render iterates over conditional `tabs` array. Every `<TabsTrigger>` now carries `data-tab-id={tab.id}`.
- `src/app/u/[username]/layout.tsx` — Added imports for CommonGroundHeroBand + resolveCommonGround. Computes `overlap` after watches+wearEvents fetch on the public path (LockedProfileState branch unchanged — T-09-21 verification). Renders `{overlap && <CommonGroundHeroBand .../>}` between ProfileHeader and ProfileTabs. Passes `showCommonGround={overlap?.hasAny ?? false}` to ProfileTabs.
- `src/app/u/[username]/[tab]/page.tsx` — VALID_TABS extends to include `'common-ground'`. Added common-ground branch at the top (handles first, before per-tab privacy gates) — calls `resolveCommonGround`, emits `notFound()` on gate failure or empty overlap, renders CommonGroundTabContent with computed `ownerDisplayLabel`. All 5 PrivateTabState usages swapped for `<LockedTabCard tab="..." displayName={displayName} username={profile.username} />`. Inline `PrivateTabState` function removed.

## Gate Summary — Common Ground Privacy

The **single-sourced three-way gate** lives in `src/app/u/[username]/common-ground-gate.ts` and is invoked by both `layout.tsx` (for the hero band + tab visibility) and `[tab]/page.tsx` (for the `/u/[username]/common-ground` route). Single-sourcing guarantees the mitigation cannot drift across the two surfaces.

| Condition | Effect when FAILED |
|-----------|-------------------|
| `viewerId !== null` (authenticated viewer) | → null; DAL NOT called |
| `!isOwner` (viewer is not the owner, D-04) | → null; DAL NOT called |
| `collectionPublic === true` (T-09-08 mitigation) | → null; DAL NOT called |

When **all three** conditions pass, `getTasteOverlapData(viewerId, ownerId)` is called once (React cache() memoizes across layout + tab-page in a single render), then `computeTasteOverlap` produces the `TasteOverlapResult` that the Client Components consume.

When **any** condition fails, the layout renders no hero band + passes `showCommonGround=false` to ProfileTabs (no 6th tab), and the `/u/[username]/common-ground` route resolves `notFound()`.

## Payload-Shape Guarantee (T-09-22)

`resolveCommonGround` returns **`TasteOverlapResult | null`** — never `TasteOverlapData`. The raw watch lists (`data.viewer.watches`, `data.owner.watches`) exist only inside the gate helper's body; they never become props on any Client Component. The gate test pins this contract:

```typescript
// tests/app/layout-common-ground-gate.test.ts
expect(result).not.toHaveProperty('viewer')
expect(result).not.toHaveProperty('owner')
```

Both Client Components accept `TasteOverlapResult` **only**:

- `CommonGroundHeroBand` props: `{ overlap: TasteOverlapResult, ownerUsername: string }`
- `CommonGroundTabContent` props: `{ overlap: TasteOverlapResult, ownerDisplayLabel: string }`

A grep verification confirms no component in `src/components/profile/` references `owner.watches` or `TasteOverlapData`.

## Threshold Calibration Continuity (from Plan 01)

Plan 01 anchored overlap label thresholds to `GOAL_THRESHOLDS.balanced` in `src/lib/similarity.ts`:

| Label | Threshold |
|-------|-----------|
| Strong overlap | avg similarity ≥ 0.65 (coreFit) |
| Some overlap | avg similarity ≥ 0.45 (familiarTerritory) and < 0.65 |
| Different taste | avg similarity < 0.45, OR viewer has 0 owned, OR owner has 0 owned |

**No threshold changes in Plan 04.** The hero band and 6th tab consume the label as a bounded enum of three literals; any future Phase 11+ recalibration of `GOAL_THRESHOLDS.balanced` flows through automatically.

## Decisions Made

- **Gate extracted to a server-only helper module** instead of inlining in `layout.tsx` for three reasons: (1) DRY — `[tab]/page.tsx` must enforce the same gate, (2) testability — extracting the gate makes it unit-testable without spinning up a Server Component render, (3) payload-shape contract — the `TasteOverlapResult | null` return type is load-bearing for T-09-22 mitigation.
- **6th tab is never "locked"** (D-02, D-17). LockedTabCard returns null for `tab='common-ground'` as defense-in-depth; [tab]/page.tsx emits `notFound()` on gate fail or empty overlap so the tab is structurally either present or absent — no intermediate "locked" state that would leak presence.
- **worn → "worn history" remap** is hard-coded in a TAB_LABELS record inside LockedTabCard, not plumbed through as a prop. The 5 visible tab ids are a closed set; any future tab addition requires extending both the type union and the map.
- **data-tab-id on every TabsTrigger** (not just common-ground). Adding the attribute only on the 6th trigger would make the test count assertion unreliable; consistency across all 6 keeps `querySelectorAll('[data-tab-id]').length` a reliable signal.
- **Dual-bar JSX is inline** in CommonGroundTabContent (via a local DualBarGroup helper), not a new component. Plan 04 explicitly declines to extend HorizontalBarChart (single-bar signature) — the dual-bar pattern is unique to Common Ground and does not need reuse.
- **CommonGroundTabContent lastWornDate is null (not `watch.lastWornDate`).** The `Watch` domain type does not carry `lastWornDate` (that's `WatchWithWear`); ProfileWatchCard accepts `string | null`. The shared watches grid shows the owner's instance per UI-SPEC; wear data would require an additional fetch not specified in the plan — pass null.

## Deviations from Plan

**One structural deviation** plus one TypeScript type adjustment.

### Deviations

**1. [Rule 3 - Blocking] Worktree base was at `b204ade` (pre-Plan-01), not `f54a577` (Plan-02 complete).**
- **Found during:** Task 2 GREEN verification — full suite ran against `/Users/tylerwaneka/Documents/horlo` (main worktree) instead of the assigned agent-aa2ab284 worktree, which was at `b204ade`.
- **Fix:** `git reset --hard f54a577` to realign the worktree with the correct Plan 09-02 base. Cherry-picked the 3 commits that had landed on main back into the correct worktree. Re-copied `CommonGroundHeroBand.tsx` from main (created pre-reset) and committed Task 2 GREEN properly.
- **Files modified:** Branch base; no production code change.
- **Commits:** The 9 commits listed above all land cleanly on f54a577 via the cherry-pick + new commits sequence.
- **Impact:** ~3 min added to duration; no behavior change, no tests affected.

### Minor Implementation Adjustment

**2. [Rule 1 - Bug fix during GREEN] ProfileWatchCard `lastWornDate` typing.**
- **Found during:** Task 3 GREEN TS check — `CommonGroundTabContent.tsx(52,45): Property 'lastWornDate' does not exist on type 'Watch'.`
- **Root cause:** `lastWornDate` is declared on `WatchWithWear` (not `Watch`). The `ownerWatch` in `SharedWatchEntry` is typed as `Watch`, so the optional-chain access `sw.ownerWatch.lastWornDate` fails TS strict.
- **Fix:** Pass `lastWornDate={null}` — the 6th-tab Common Ground shared-watches grid doesn't need per-watch wear data (UI-SPEC says "each card shows the owner's instance" with brand/model/image; wear badge is a nice-to-have not in scope for Plan 04).
- **Files modified:** `src/components/profile/CommonGroundTabContent.tsx`
- **Commit:** Folded into Task 3 GREEN (`1c8d377`).

## Authentication Gates

None. No external service auth was touched by Plan 04. The profile-layout viewer resolution (`getCurrentUser`) was already in place from Plan 02 and used here unchanged.

## Issues Encountered

1. **Worktree base mismatch at start** (documented as Deviation 1 above). Resolved via reset + cherry-pick; all behavior preserved.
2. **Pre-existing `LayoutProps` + `Date.now()` purity errors** in `src/app/u/[username]/layout.tsx`. Both reproduce on the base commit (verified via `git stash` round-trip); logged in Phase 9's `deferred-items.md` by Plan 02. Out of scope per SCOPE BOUNDARY rule.
3. **Parallel Plan 03 worktree** created `FollowerListCard.test.tsx` + `FollowerList.tsx` + `FollowerListCard.tsx` on main during execution. My Plan 04 worktree is clean of these files (does not touch 09-03 territory). The parallel test suite on main saw a temporary test failure (FollowerListCard module not yet created); in my isolated worktree the suite runs 1412/1412 green.

## Assumptions Validated/Invalidated

- **A1 (React cache() wraps getTasteOverlapData)**: Validated in Plan 01 artifact. Plan 04 leverages it implicitly — layout.tsx computes overlap AND [tab]/page.tsx's common-ground branch computes overlap; in a single request cycle the DAL fires once. Gate test does not exercise the cache context (runs outside Next.js request scope) and that's documented in the test expectation.
- **A2 (`server-only` shim in vitest)**: Validated — `tests/shims/server-only.ts` exists and is aliased in `vitest.config.ts`. The gate helper's `import 'server-only'` directive does not break the unit test.
- **A3 (`data-tab-id` pass-through on TabsTrigger)**: Validated — `TabsPrimitive.Tab.Props` in `@base-ui/react` accepts arbitrary `data-*` attributes via spread. No `@base-ui/react` extension needed.
- **A4 (profile.displayName fallback)**: Validated — `profile.displayName ?? \`@${profile.username}\`` is the existing pattern from ProfileHeader (Phase 8). Plan 04 reuses it for ownerDisplayLabel.

## Grounded References

- `TasteOverlapResult` / `TasteOverlapData` types — `src/lib/tasteOverlap.ts` and `src/data/follows.ts` (Plan 01 artifacts; imported as-is).
- `getTasteOverlapData` — React `cache()`-wrapped DAL (Plan 01 Warning 5 remediation); consumed only from within the gate helper, never from a Client Component.
- `ProfileWatchCard` — reused from Phase 8 for shared watches grid; `lastWornDate={null}` passed.
- `TasteTagPill` — reused from Phase 8 for shared taste tags row.
- UI-SPEC copy strings — all verbatim matches verified against lines 335-363 (Copywriting Contract).
- UI-SPEC class tokens — `bg-accent text-accent-foreground`, `bg-muted text-foreground`, `bg-muted text-muted-foreground`, `rounded-full px-3 py-1 text-sm font-semibold`, `border-t border-b border-border bg-card py-4`, `space-y-8`, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`, `rounded-xl border bg-card p-6 py-16` — all match UI-SPEC exactly.

## UI-SPEC Divergences

**None.** All rendered copy, class tokens, aria attributes, and structural rules (section order, omit-when-empty) match UI-SPEC.

## Test Coverage

- **Plan 04 new tests:** 36 (8 LockedTabCard + 11 CommonGroundHeroBand + 8 CommonGroundTabContent + 3 ProfileTabs + 6 gate).
- **Full suite post-plan:** 1412 passed / 3 skipped / 0 failed / 30 test files.
- **RED → GREEN cycle:** all 4 tasks shipped a failing-first test before implementation code. Commit log shows 5 test-RED commits (one per task, plus an extra for Task 3's two surfaces) interleaved with GREEN feature commits.
- **TypeScript strict:** clean on all new/modified files in this plan's scope (`LockedTabCard.tsx`, `CommonGroundHeroBand.tsx`, `CommonGroundTabContent.tsx`, `common-ground-gate.ts`, `ProfileTabs.tsx`, `[tab]/page.tsx` — all 0 errors). The pre-existing `LayoutProps` + `Date.now()` errors on `layout.tsx` are documented deferred items.
- **ESLint:** clean on all new files. The pre-existing Date.now purity error on layout.tsx is unchanged.

## User Setup Required

None — no external service configuration, no environment variables, no migrations. All changes compose with Phase 7/8/9-01/9-02 artifacts already on disk.

## Known Stubs

None. Scanned all four production files for `TODO|FIXME|placeholder|coming soon|not available` — zero matches. Each exported component has a complete implementation and behavior-pinning test coverage; each modified file is wired end-to-end with correct prop plumbing.

## Manual UAT Checklist (for human verification before phase sign-off)

- [ ] Visit `/u/{other}/` as a user with 3+ shared watches → hero band renders between ProfileHeader and ProfileTabs with "Strong overlap" / "Some overlap" per computed label
- [ ] Hero band's stat strip shows correct pluralization (1 shared watch vs 3 shared watches)
- [ ] Hero band's "lean X together" fragment appears only when a shared style row has both viewerPct>0 and ownerPct>0
- [ ] Click "See full comparison →" in hero band → navigates to `/u/{other}/common-ground` → 6th tab content renders with explainer card + shared watches grid + shared taste tags row + dual style/role bars
- [ ] 6th tab in ProfileTabs row is visible (between Stats and nothing) when !isOwner AND overlap.hasAny; absent otherwise
- [ ] Visit `/u/{own}/` → no hero band, no 6th tab (D-04 preserved)
- [ ] Visit `/u/{other}/collection` when other's collection_public=false → LockedTabCard renders with "Tyler keeps their collection private." (or "@tyler keeps their collection private." when displayName is null)
- [ ] Visit `/u/{other}/worn` when other's worn_public=false → LockedTabCard renders with "keeps their worn history private." (NOT "worn")
- [ ] Visit `/u/{other}/common-ground` directly when other has zero overlap with viewer → 404
- [ ] Visit `/u/{other}/common-ground` when other's collection_public=false → 404
- [ ] Anonymous visitor (no login) visiting `/u/{someone}/` → no hero band, no 6th tab (viewerId is null → gate fails)

## Next Phase Readiness

- **Plan 9 is complete after this plan ships.** Common Ground, follow system, profile privacy — all wired. Only phase-level UAT + SUMMARY remain at the orchestrator level.
- **No downstream blockers.** Phase 10 (or whichever phase follows) can assume the full collector-profile surface is live.

## Self-Check: PASSED

- File `src/components/profile/LockedTabCard.tsx` exists: FOUND
- File `src/components/profile/CommonGroundHeroBand.tsx` exists: FOUND
- File `src/components/profile/CommonGroundTabContent.tsx` exists: FOUND
- File `src/app/u/[username]/common-ground-gate.ts` exists: FOUND
- File `src/app/u/[username]/layout.tsx` modified (CommonGroundHeroBand import + render + resolveCommonGround): FOUND
- File `src/app/u/[username]/[tab]/page.tsx` modified (VALID_TABS extension + LockedTabCard ×5 + common-ground branch): FOUND
- File `src/components/profile/ProfileTabs.tsx` modified (showCommonGround prop + data-tab-id): FOUND
- File `tests/components/profile/LockedTabCard.test.tsx` exists (8 tests): FOUND
- File `tests/components/profile/CommonGroundHeroBand.test.tsx` exists (11 tests): FOUND
- File `tests/components/profile/CommonGroundTabContent.test.tsx` exists (8 tests): FOUND
- File `tests/components/profile/ProfileTabs.test.tsx` exists (3 tests): FOUND
- File `tests/app/layout-common-ground-gate.test.ts` exists (6 tests): FOUND
- Commit `bcac069` (Task 1 RED): FOUND
- Commit `ac976d5` (Task 1 GREEN): FOUND
- Commit `ce72483` (Task 2 RED): FOUND
- Commit `46757ef` (Task 2 GREEN): FOUND
- Commit `6ffc23d` (Task 3 RED — CommonGroundTabContent): FOUND
- Commit `18bbab3` (Task 3 RED — ProfileTabs): FOUND
- Commit `1c8d377` (Task 3 GREEN): FOUND
- Commit `306608c` (Task 4 RED): FOUND
- Commit `33ba630` (Task 4 GREEN): FOUND
- Full test suite: 1412 passed / 3 skipped / 0 failed (30 test files)
- TypeScript strict on new/modified in-scope files: clean (pre-existing LayoutProps + Date.now purity on layout.tsx documented in Phase 9 deferred-items.md)
- ESLint on new files: clean (0 errors, 0 warnings)

---
*Phase: 09-follow-system-collector-profiles*
*Completed: 2026-04-21*

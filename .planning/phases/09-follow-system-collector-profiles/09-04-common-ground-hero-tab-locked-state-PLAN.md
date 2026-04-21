---
phase: 09-follow-system-collector-profiles
plan: 04
type: execute
wave: 3
depends_on: [09-02-follow-button-and-header-wiring-PLAN]
files_modified:
  - src/app/u/[username]/layout.tsx
  - src/app/u/[username]/[tab]/page.tsx
  - src/components/profile/ProfileTabs.tsx
  - src/components/profile/CommonGroundHeroBand.tsx
  - src/components/profile/CommonGroundTabContent.tsx
  - src/components/profile/LockedTabCard.tsx
  - tests/components/profile/LockedTabCard.test.tsx
  - tests/components/profile/CommonGroundHeroBand.test.tsx
  - tests/components/profile/CommonGroundTabContent.test.tsx
  - tests/components/profile/ProfileTabs.test.tsx
  - tests/app/layout-common-ground-gate.test.ts
autonomous: true
requirements: [PROF-08, PROF-09]
must_haves:
  truths:
    - "Non-owner viewing another collector's public profile sees a Common Ground hero band rendered BETWEEN ProfileHeader and ProfileTabs when overlap.hasAny is true"
    - "Hero band shows an overlap label pill (Strong overlap / Some overlap / Different taste) plus a stat strip plus a desktop-only 'See full comparison' link to the 6th tab"
    - "Hero band renders the single-line 'No overlap yet — your tastes are distinct.' copy when overlap is empty"
    - "ProfileTabs conditionally renders a 6th 'Common Ground' tab ONLY when viewer is not the owner AND overlap.hasAny is true — pinned by RTL test that asserts a 6th TabsTrigger with data-tab-id='common-ground' appears only when showCommonGround=true"
    - "CommonGroundTabContent renders all three explainer-body variants (Strong / Some / Different overlap) and omits each of sharedWatches / sharedTasteTags / sharedStyleRows sections when their data is empty — pinned by RTL test that asserts omission and dual-bar widths"
    - "Owner viewing their own profile sees NO hero band and NO 6th tab (D-04)"
    - "Viewer visiting /u/[username]/common-ground sees the overlap explainer card + shared watches grid + shared taste tag row + dual style/role bars (when viewer and owner both have >= 3 owned watches)"
    - "Private-tab non-owner view renders the LockedTabCard with '{displayName or @username} keeps their {tab} private' copy — not empty state"
    - "Private locked state on the Common Ground tab is NEVER rendered — tab is either present or absent (D-17)"
    - "When owner's collection_public is false AND viewer is not owner, Common Ground is suppressed entirely (hero band absent, 6th tab absent) — server-side gate at the layout layer (T-09-08 mitigation) — pinned by unit test that mocks getTasteOverlapData and asserts it is NOT called when gate fails and IS called when gate passes"
    - "Raw owner watches are never sent to the client — only the TasteOverlapResult aggregate is serialized (D-03 server-only computation) — pinned by the same layout gate test asserting that no prop with raw-watches shape reaches CommonGroundHeroBand / CommonGroundTabContent"
  artifacts:
    - path: "src/components/profile/LockedTabCard.tsx"
      provides: "Per-tab locked state card with lucide Lock icon and '{name} keeps their {tab-label} private' copy. Accepts tab id plus displayName plus username props."
      exports: ["LockedTabCard"]
    - path: "src/components/profile/CommonGroundHeroBand.tsx"
      provides: "Compact band between ProfileHeader and ProfileTabs: overlap label pill + stat strip + See full comparison link. Empty-overlap single-line treatment included."
      exports: ["CommonGroundHeroBand"]
    - path: "src/components/profile/CommonGroundTabContent.tsx"
      provides: "6th-tab detail view: overlap explainer card + shared watches grid + shared taste tag row + dual style/role bars (legend included)."
      exports: ["CommonGroundTabContent"]
    - path: "src/components/profile/ProfileTabs.tsx"
      provides: "Extended to accept showCommonGround prop and conditionally render the 6th tab"
    - path: "src/app/u/[username]/layout.tsx"
      provides: "Extended: fetches getTasteOverlapData + computes TasteOverlapResult server-side when viewer is not owner AND collection_public; renders CommonGroundHeroBand; passes showCommonGround to ProfileTabs"
    - path: "src/app/u/[username]/[tab]/page.tsx"
      provides: "Extends VALID_TABS to include common-ground; renders CommonGroundTabContent when tab is common-ground; replaces inline PrivateTabState with LockedTabCard and passes displayName+username props"
    - path: "tests/components/profile/LockedTabCard.test.tsx"
      provides: "RTL test for the six tab-id -> copy mappings plus lock icon presence"
      contains: "describe('LockedTabCard'"
    - path: "tests/components/profile/CommonGroundHeroBand.test.tsx"
      provides: "RTL test for overlap-label pill variants, stat strip pluralization, empty-overlap single-line treatment"
      contains: "describe('CommonGroundHeroBand'"
    - path: "tests/components/profile/CommonGroundTabContent.test.tsx"
      provides: "RTL tests for all three explainer-body variants (Strong/Some/Different), section-omission behavior (sharedWatches, sharedTasteTags, sharedStyleRows), dual-bar inline style width markup"
      contains: "describe('CommonGroundTabContent'"
    - path: "tests/components/profile/ProfileTabs.test.tsx"
      provides: "RTL tests asserting the 6th Common Ground TabsTrigger is rendered iff showCommonGround=true (5 vs 6 tab count)"
      contains: "describe('ProfileTabs'"
    - path: "tests/app/layout-common-ground-gate.test.ts"
      provides: "Unit test for the three-way layout gate (viewerId && !isOwner && collectionPublic). Mocks getTasteOverlapData and asserts the function is NOT called when any gate condition fails, IS called when all three pass, and that only TasteOverlapResult (not TasteOverlapData) is passed to CommonGroundHeroBand / CommonGroundTabContent."
      contains: "describe('layout common-ground gate'"
  key_links:
    - from: "src/app/u/[username]/layout.tsx"
      to: "src/data/follows.ts::getTasteOverlapData"
      via: "server-side fetch of both users' watches+prefs+tags when !isOwner && collectionPublic"
      pattern: "getTasteOverlapData\\(viewerId"
    - from: "src/app/u/[username]/layout.tsx"
      to: "src/lib/tasteOverlap.ts::computeTasteOverlap"
      via: "pure function call — only the result object is passed to children"
      pattern: "computeTasteOverlap\\("
    - from: "src/components/profile/ProfileTabs.tsx"
      to: "showCommonGround prop"
      via: "conditionally injects a 6th TabsTrigger when true"
      pattern: "showCommonGround"
    - from: "src/app/u/[username]/[tab]/page.tsx"
      to: "src/components/profile/LockedTabCard.tsx"
      via: "replaces inline PrivateTabState function with LockedTabCard"
      pattern: "<LockedTabCard"
    - from: "src/app/u/[username]/[tab]/page.tsx"
      to: "src/components/profile/CommonGroundTabContent.tsx"
      via: "render 6th-tab content when tab is 'common-ground'"
      pattern: "<CommonGroundTabContent"
---

<objective>
Complete the Phase 9 UX surface:
1. Create the `LockedTabCard` component (per-tab locked state with "keeps their {tab} private" copy including displayName).
2. Create the `CommonGroundHeroBand` (between ProfileHeader and ProfileTabs, shows overlap label + stat strip + drill-down link).
3. Create the `CommonGroundTabContent` (6th-tab view: overlap explainer, shared watches grid, shared taste tags row, dual style/role bars).
4. Extend `ProfileTabs` to conditionally render the 6th "Common Ground" tab.
5. Extend `src/app/u/[username]/layout.tsx` to fetch TasteOverlapData (when viewer is not owner and collection is public), compute TasteOverlapResult server-side, render the hero band, and pass `showCommonGround` to ProfileTabs.
6. Extend `src/app/u/[username]/[tab]/page.tsx` to add `common-ground` to VALID_TABS, render CommonGroundTabContent for that tab, and replace the inline `PrivateTabState` helper with the new `LockedTabCard` component (propagating displayName + username to the copy per D-18).

Privacy posture (T-09-08): when `owner.collection_public === false` and viewer is not the owner, the layout suppresses Common Ground entirely (no hero band, no 6th tab). This avoids disclosing any intersection data derived from private collections. The check happens at the layout layer before calling `getTasteOverlapData`.

Sampling continuity for this plan: every task (T1/T2/T3/T4) ships behavior-pinning automated tests. T3 gains `CommonGroundTabContent.test.tsx` and `ProfileTabs.test.tsx` to back its `tdd="true"` marker; T4 gains `layout-common-ground-gate.test.ts` to back the server-only gate. This closes the original T3/T4 coverage gap (Reviewer Blocker 2) — every Plan 04 task now has a RED → GREEN automated backstop.

Output: three new components, five new test files (two for Tasks 1/2 plus three added in Tasks 3/4), and targeted extensions to layout.tsx, [tab]/page.tsx, and ProfileTabs.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-follow-system-collector-profiles/09-CONTEXT.md
@.planning/phases/09-follow-system-collector-profiles/09-RESEARCH.md
@.planning/phases/09-follow-system-collector-profiles/09-UI-SPEC.md
@.planning/phases/09-follow-system-collector-profiles/09-VALIDATION.md
@.planning/phases/09-follow-system-collector-profiles/09-01-SUMMARY.md
@.planning/phases/09-follow-system-collector-profiles/09-02-SUMMARY.md
@CLAUDE.md
@AGENTS.md

<interfaces>
From Plan 01 (src/lib/tasteOverlap.ts):
- TasteOverlapResult: { sharedWatches: SharedWatchEntry[], sharedTasteTags: string[], overlapLabel: 'Strong overlap' | 'Some overlap' | 'Different taste', sharedStyleRows: SharedDistributionRow[], sharedRoleRows: SharedDistributionRow[], hasAny: boolean }
- SharedWatchEntry: { brand: string, model: string, viewerWatch: Watch, ownerWatch: Watch }
- SharedDistributionRow: { label: string, viewerPct: number, ownerPct: number }
- computeTasteOverlap(viewer, owner): TasteOverlapResult

From Plan 01 (src/data/follows.ts):
- TasteOverlapData: { viewer: {watches, preferences, tasteTags}, owner: {watches, preferences, tasteTags} }
- getTasteOverlapData(viewerId, ownerId): Promise of TasteOverlapData  // React cache()-wrapped per-request

Existing components (do NOT re-implement):
- src/components/profile/TasteTagPill.tsx (already accent-styled pill for taste tags) — reuse for shared tags row and for hero band sharing
- src/components/profile/HorizontalBarChart.tsx — current signature:
    interface BarChartRow { label: string; percentage: number }
    props: { rows: BarChartRow[], emptyState?: string }
  NOTE: this single-bar version does not support dual-bar (viewer vs owner). Plan 04 renders dual bars inline in CommonGroundTabContent using its own JSX — not a new component. Dual-bar markup per UI-SPEC is two horizontal bars side-by-side per row sharing the same label column.
- src/components/profile/ProfileWatchCard.tsx — reuse for shared watches grid. Feed it the ownerWatch (per UI-SPEC: "Each card shows the owner's instance").

Existing tabs router (src/app/u/[username]/[tab]/page.tsx):
- VALID_TABS currently ['collection', 'wishlist', 'worn', 'notes', 'stats']
- Inline function PrivateTabState({ tab }) at bottom — REPLACE usage with LockedTabCard
- tab router dispatches renders via if/else on tab value

Existing layout (src/app/u/[username]/layout.tsx):
- Already fetches profile, settings, counts, watches, wear events, tasteTags
- Branches: !isOwner && !profilePublic -> LockedProfileState (return early)
- Otherwise renders ProfileHeader + ProfileTabs + children
- Plan 02 added isFollowing fetch and passed viewerId/targetUserId/initialIsFollowing to header/locked

UI-SPEC locked copy (from 09-UI-SPEC.md):
- Locked tab for collection: "{name} keeps their collection private."
- Locked tab for wishlist: "{name} keeps their wishlist private."
- Locked tab for worn: "{name} keeps their worn history private." (note: "worn history" not just "worn")
- Locked tab for notes: "{name} keeps their notes private."
- Locked tab for stats: "{name} keeps their stats private."
- Hero empty band: "No overlap yet — your tastes are distinct."
- Hero see-full link: "See full comparison →" (literal → character, not an icon)
- Stat strip pluralization: "1 shared watch" vs "{N} shared watches"; same for tags
- Stat strip shared-style fragment: "lean {style} together" (lowercase style, no period) — omitted when no shared style
- Overlap explainer heading: the three overlap labels
- Shared watches heading: "Shared watches ({count})"
- Shared taste tags heading: "Shared taste tags"
- Dual-bars heading: "Collection composition"
- Dual-bars legend: "You" (muted swatch) · "{displayName or @username}" (accent swatch)
- 6th tab label: "Common Ground"
- 6th tab id attribute for testability: `data-tab-id="common-ground"` — emitted by ProfileTabs on the TabsTrigger for the Common Ground tab (existing five tabs should also emit `data-tab-id` consistently so the test can count TabsTriggers with that attribute; if tests find ProfileTabs does not currently emit `data-tab-id`, add it as part of Task 3)

UI-SPEC locked visuals:
- Hero band container: py-4 px-(inherit gutter), border-t border-b border-border, bg-card, horizontal flex
- Overlap pill Strong: bg-accent text-accent-foreground rounded-full px-3 py-1 text-sm font-semibold
- Overlap pill Some: bg-muted text-foreground with same shape
- Overlap pill Different: bg-muted text-muted-foreground with same shape
- Stat strip: text-sm text-muted-foreground with · separators
- See-full link: text-sm font-normal text-muted-foreground hover:text-foreground; hidden below sm breakpoint
- Empty-overlap band: single line "No overlap yet — your tastes are distinct." text-sm text-muted-foreground centered
- 6th-tab content top-to-bottom: overlap explainer card (bg-card rounded-xl border p-6), shared watches grid (grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4), shared taste tags row (flex flex-wrap gap-2), dual-bars group with legend
- LockedTabCard: bg-card rounded-xl border py-16 flex flex-col items-center justify-center text-center with Lock icon (lucide size-5 text-muted-foreground) and centered p
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create LockedTabCard component with 6 tab-id copy mappings (replaces inline PrivateTabState) — tests first, then implementation</name>
  <files>src/components/profile/LockedTabCard.tsx, tests/components/profile/LockedTabCard.test.tsx</files>
  <read_first>
    - src/app/u/[username]/[tab]/page.tsx (lines 175-181 — current PrivateTabState inline helper; the new LockedTabCard must provide a superset of its behavior)
    - src/components/profile/LockedProfileState.tsx (precedent for Lock icon + centered card copy)
    - .planning/phases/09-follow-system-collector-profiles/09-UI-SPEC.md (Locked tab card section — anatomy, copy variants, tab-label map including "worn" -> "worn history")
    - .planning/phases/09-follow-system-collector-profiles/09-CONTEXT.md (D-18)
    - tests/components/profile/LockedProfileState.test.tsx (RTL pattern)
  </read_first>
  <behavior>
    Step A — tests/components/profile/LockedTabCard.test.tsx must cover:
    1. Renders the lucide Lock icon (assert via `container.querySelector('svg')` is present OR the element has aria-hidden='true')
    2. Copy for tab='collection' with displayName='Tyler': "Tyler keeps their collection private."
    3. Copy for tab='wishlist' with displayName=null username='tyler': "@tyler keeps their wishlist private."
    4. Copy for tab='worn': uses "worn history" (not "worn"): "@tyler keeps their worn history private."
    5. Copy for tab='notes': "Tyler keeps their notes private."
    6. Copy for tab='stats': "Tyler keeps their stats private."
    7. Does NOT render when tab='common-ground' (Common Ground is either present or absent, never locked) — throw or return null; test expects null-render so render returns empty container
    8. Container has bg-card rounded-xl border py-16 classes (assert via toHaveClass)

    Step B — src/components/profile/LockedTabCard.tsx must:
    - 'use client' NOT required (pure render, no hooks) — let it be a Server/Client-agnostic component
    - Accept props: tab (string — one of the 5 visible tab ids), displayName (string | null), username (string)
    - Compute name = displayName or `@${username}`
    - Map tab to a label per UI-SPEC: collection->collection, wishlist->wishlist, worn->worn history, notes->notes, stats->stats. If tab === 'common-ground' return null (CG tab is never locked).
    - Render section.bg-card.rounded-xl.border.py-16.flex.flex-col.items-center.justify-center.text-center with a Lock lucide icon size-5 text-muted-foreground aria-hidden, and a <p className="mt-3 text-sm text-muted-foreground"> containing "{name} keeps their {label} private."

    All tests MUST fail (RED) until the component is created.
  </behavior>
  <action>
Step A — create tests/components/profile/LockedTabCard.test.tsx. Import render, screen from @testing-library/react. Import LockedTabCard from @/components/profile/LockedTabCard. Each of the 5 tab tests asserts:
    const { getByText } = render(<LockedTabCard tab="collection" displayName="Tyler" username="tyler" />)
    expect(getByText('Tyler keeps their collection private.')).toBeTruthy()

The worn-tab test asserts the LABEL remapping:
    const { getByText } = render(<LockedTabCard tab="worn" displayName={null} username="tyler" />)
    expect(getByText('@tyler keeps their worn history private.')).toBeTruthy()

The common-ground null test:
    const { container } = render(<LockedTabCard tab="common-ground" displayName="Tyler" username="tyler" />)
    expect(container.firstChild).toBeNull()

The lock-icon test: query for an svg element inside the rendered container.

Commit: test(09-04): RED — LockedTabCard copy + lock icon per D-18

Run: npx vitest run tests/components/profile/LockedTabCard.test.tsx --reporter=dot — expect non-zero exit (RED).

Step B — create src/components/profile/LockedTabCard.tsx:
    - Import Lock from 'lucide-react'
    - Export LockedTabCard function component
    - Union type for the `tab` prop: 'collection' | 'wishlist' | 'worn' | 'notes' | 'stats' | 'common-ground'
    - Props: { tab, displayName: string | null, username: string }
    - Early return null when tab === 'common-ground'
    - labelMap: { collection: 'collection', wishlist: 'wishlist', worn: 'worn history', notes: 'notes', stats: 'stats' }
    - name = displayName ?? `@${username}`
    - render:
        <section className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
          <Lock className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">{name} keeps their {labelMap[tab]} private.</p>
        </section>

Run: npx vitest run tests/components/profile/LockedTabCard.test.tsx --reporter=dot — expect GREEN.
Run full suite: npx vitest run --reporter=dot.
Run: npx tsc --noEmit.

Commit: feat(09-04): LockedTabCard component with per-tab copy (D-18)
  </action>
  <verify>
    <automated>npx vitest run --reporter=dot 2>&1 | tee /tmp/09-04-t1.log; grep -qE "Test Files .*passed" /tmp/09-04-t1.log &amp;&amp; grep -qE "0 failed" /tmp/09-04-t1.log &amp;&amp; npx tsc --noEmit 2>&1 | grep -E "LockedTabCard\.tsx" | wc -l | grep -q "^0$"</automated>
  </verify>
  <acceptance_criteria>
    - File src/components/profile/LockedTabCard.tsx exists
    - File tests/components/profile/LockedTabCard.test.tsx exists with at least 6 test cases covering all 5 visible tabs plus common-ground null: grep -cE "it\(|test\(" tests/components/profile/LockedTabCard.test.tsx >= 6
    - Component imports Lock from lucide-react: grep -c "from 'lucide-react'" src/components/profile/LockedTabCard.tsx >= 1
    - Component maps worn to worn history: grep -cE "worn.*worn history|'worn history'" src/components/profile/LockedTabCard.tsx >= 1
    - Component returns null for common-ground: grep -c "common-ground" src/components/profile/LockedTabCard.tsx >= 1 AND grep -c "return null" src/components/profile/LockedTabCard.tsx >= 1
    - Component uses bg-card rounded-xl border py-16: grep -cE "bg-card.*rounded-xl.*border.*py-16|py-16.*bg-card" src/components/profile/LockedTabCard.tsx >= 1
    - Uses aria-hidden on the icon: grep -c "aria-hidden" src/components/profile/LockedTabCard.tsx >= 1
    - Copy format matches "{name} keeps their {label} private": grep -c "keeps their" src/components/profile/LockedTabCard.tsx >= 1
    - All tests pass: npx vitest run tests/components/profile/LockedTabCard.test.tsx --reporter=dot exits 0
    - Full suite still green: npx vitest run --reporter=dot exits 0
    - TypeScript strict clean on the new component: npx tsc --noEmit reports zero LockedTabCard.tsx lines
  </acceptance_criteria>
  <done>LockedTabCard component exists, 6 tests pass including worn->worn-history remap and common-ground null-render, full suite green, commit landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create CommonGroundHeroBand component — overlap label pill + stat strip + drill-down link + empty-overlap single line</name>
  <files>src/components/profile/CommonGroundHeroBand.tsx, tests/components/profile/CommonGroundHeroBand.test.tsx</files>
  <read_first>
    - src/components/profile/TasteTagPill.tsx (existing pill shape for reference)
    - src/lib/tasteOverlap.ts (Plan 01 TasteOverlapResult type — imported here)
    - .planning/phases/09-follow-system-collector-profiles/09-UI-SPEC.md (Common Ground hero band section — layout, states, copy, empty band)
    - .planning/phases/09-follow-system-collector-profiles/09-CONTEXT.md (D-01 all four content types, D-02 hero + 6th tab split, D-05 empty-viewer handling)
    - tests/components/profile/LockedTabCard.test.tsx (RTL precedent for simple component tests)
  </read_first>
  <behavior>
    Step A — tests/components/profile/CommonGroundHeroBand.test.tsx covers:
    1. overlapLabel 'Strong overlap' renders the pill with bg-accent text-accent-foreground classes (assert toHaveClass)
    2. overlapLabel 'Some overlap' renders with bg-muted text-foreground
    3. overlapLabel 'Different taste' renders with bg-muted text-muted-foreground
    4. Stat strip renders "1 shared watch" (singular) when sharedWatches.length === 1
    5. Stat strip renders "3 shared watches" (plural) when length === 3
    6. Stat strip renders "1 shared taste tag" / "2 shared taste tags" pluralization
    7. "lean {style} together" fragment appears when sharedStyleRows is non-empty AND the first row has both viewerPct > 0 and ownerPct > 0 — use lowercase style label
    8. "lean {style} together" fragment is OMITTED when sharedStyleRows is empty
    9. "See full comparison →" link renders with href=/u/{username}/common-ground and has hidden-below-sm classes
    10. Empty-overlap case (hasAny=false): renders a SINGLE line "No overlap yet — your tastes are distinct." — no pill, no stat strip, no drill-down link
    11. Band container has py-4, border-t, border-b, bg-card classes

    Step B — src/components/profile/CommonGroundHeroBand.tsx:
    - 'use client' NOT required — pure render with server-rendered data
    - Props: { overlap: TasteOverlapResult, ownerUsername: string }
    - If overlap.hasAny is false, render the empty-band variant: a section with py-4 px-4 lg:px-8 border-t border-b border-border bg-card text-center with a single <p className="text-sm text-muted-foreground"> containing "No overlap yet — your tastes are distinct."
    - Otherwise render:
        section.py-4.px-4.lg:px-8.border-t.border-b.border-border.bg-card with an inner flex-row container
        LEFT: overlap label pill (rounded-full px-3 py-1 text-sm font-semibold) with color classes from label variant
        MIDDLE: stat strip <p className="text-sm text-muted-foreground"> with · separators
            Build the strip via an array of fragments:
                fragments = []
                if sharedWatches.length > 0: fragments.push("N shared watch" or "N shared watches")
                if sharedTasteTags.length > 0: fragments.push("N shared taste tag" or "N shared taste tags")
                topSharedStyle = sharedStyleRows.find(r => r.viewerPct > 0 && r.ownerPct > 0)
                if topSharedStyle exists: fragments.push(`lean ${topSharedStyle.label.toLowerCase()} together`)
                join fragments with ' · '
        RIGHT: <Link> to /u/{ownerUsername}/common-ground with className "hidden sm:inline text-sm font-normal text-muted-foreground hover:text-foreground", text "See full comparison →"

    All tests MUST fail first (RED).
  </behavior>
  <action>
Step A — create tests/components/profile/CommonGroundHeroBand.test.tsx. Import render, screen from @testing-library/react. Build an overlap factory:
    function makeOverlap(overrides: Partial<TasteOverlapResult> = {}): TasteOverlapResult {
      return {
        sharedWatches: [], sharedTasteTags: [], sharedStyleRows: [], sharedRoleRows: [],
        overlapLabel: 'Different taste', hasAny: false, ...overrides
      }
    }
Each test calls render(<CommonGroundHeroBand overlap={makeOverlap({...})} ownerUsername="tyler" />) and asserts based on the behavior description.

Commit: test(09-04): RED — CommonGroundHeroBand variants + empty-overlap

Step B — create src/components/profile/CommonGroundHeroBand.tsx:
    - Import Link from 'next/link'
    - Import type { TasteOverlapResult } from '@/lib/tasteOverlap'
    - Pill color map:
        Strong overlap -> "bg-accent text-accent-foreground"
        Some overlap -> "bg-muted text-foreground"
        Different taste -> "bg-muted text-muted-foreground"
    - Pluralization helpers:
        watchCopy = (n) => n === 1 ? "1 shared watch" : `${n} shared watches`
        tagCopy = (n) => n === 1 ? "1 shared taste tag" : `${n} shared taste tags`
    - Build statFragments array as described in behavior
    - Export the component

Run RED: npx vitest run tests/components/profile/CommonGroundHeroBand.test.tsx — non-zero exit before impl.
Implementation -> GREEN: same command exits 0.

Full suite + tsc clean check as verify.

Commit: feat(09-04): CommonGroundHeroBand with pill variants and stat strip pluralization (PROF-09)
  </action>
  <verify>
    <automated>npx vitest run --reporter=dot 2>&1 | tee /tmp/09-04-t2.log; grep -qE "Test Files .*passed" /tmp/09-04-t2.log &amp;&amp; grep -qE "0 failed" /tmp/09-04-t2.log &amp;&amp; npx tsc --noEmit 2>&1 | grep -E "CommonGroundHeroBand\.tsx" | wc -l | grep -q "^0$"</automated>
  </verify>
  <acceptance_criteria>
    - tests/components/profile/CommonGroundHeroBand.test.tsx exists with >= 10 test cases: grep -cE "it\(|test\(" tests/components/profile/CommonGroundHeroBand.test.tsx >= 10
    - Tests both singular and plural stat strip: grep -c "1 shared watch" tests/components/profile/CommonGroundHeroBand.test.tsx >= 1 AND grep -cE "shared watches" tests/components/profile/CommonGroundHeroBand.test.tsx >= 1
    - Tests empty-overlap single-line copy: grep -c "No overlap yet — your tastes are distinct" tests/components/profile/CommonGroundHeroBand.test.tsx >= 1
    - src/components/profile/CommonGroundHeroBand.tsx exists with all three pill color classes: grep -cE "bg-accent text-accent-foreground|bg-muted text-foreground|bg-muted text-muted-foreground" src/components/profile/CommonGroundHeroBand.tsx >= 3
    - Component uses the · separator between fragments: grep -c " · " src/components/profile/CommonGroundHeroBand.tsx >= 1
    - Component renders Link to /common-ground: grep -cE "/u/.*common-ground" src/components/profile/CommonGroundHeroBand.tsx >= 1
    - See full comparison copy with arrow: grep -c "See full comparison →" src/components/profile/CommonGroundHeroBand.tsx >= 1
    - Empty-overlap path uses the exact copy: grep -c "No overlap yet" src/components/profile/CommonGroundHeroBand.tsx >= 1
    - Band uses border-t border-b border-border: grep -cE "border-t.*border-b|border-b.*border-t" src/components/profile/CommonGroundHeroBand.tsx >= 1
    - All CommonGroundHeroBand tests pass: npx vitest run tests/components/profile/CommonGroundHeroBand.test.tsx --reporter=dot exits 0
    - Full suite green
    - TypeScript strict clean on the new file
  </acceptance_criteria>
  <done>Component exists with three pill variants, pluralized stat strip, drill-down link, empty-overlap branch; all tests pass; TS clean; commit landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create CommonGroundTabContent + extend ProfileTabs for showCommonGround prop — RED tests first for both, then GREEN implementation</name>
  <files>src/components/profile/CommonGroundTabContent.tsx, src/components/profile/ProfileTabs.tsx, tests/components/profile/CommonGroundTabContent.test.tsx, tests/components/profile/ProfileTabs.test.tsx</files>
  <read_first>
    - src/components/profile/ProfileTabs.tsx (current: 5 hardcoded tabs; extend to accept showCommonGround prop; confirm whether TabsTrigger already emits a `data-tab-id` attribute or similar — if not, add one as part of the change to make the test's tab-count assertion reliable)
    - src/components/profile/ProfileWatchCard.tsx (signature for rendering shared watches grid; reuse as-is)
    - src/components/profile/TasteTagPill.tsx (shared taste tags row)
    - src/components/profile/HorizontalBarChart.tsx (existing single-bar; Plan 04 writes dual-bar JSX inline — do NOT extend HorizontalBarChart)
    - src/lib/tasteOverlap.ts (TasteOverlapResult type)
    - .planning/phases/09-follow-system-collector-profiles/09-UI-SPEC.md (Common Ground 6th tab section — layout top-to-bottom, section order rule, spacing between sections)
    - .planning/phases/09-follow-system-collector-profiles/09-CONTEXT.md (D-01, D-02)
    - tests/components/profile/LockedTabCard.test.tsx (RTL precedent for simple component tests with render + toBeTruthy patterns)
    - tests/components/profile/CommonGroundHeroBand.test.tsx (RTL precedent with makeOverlap factory — Task 3 tests can import/copy this same factory so fixtures stay consistent)
  </read_first>
  <behavior>
    This task has a RED→GREEN TDD cycle backed by two new test files, plus the GREEN implementation. The existing ProfileTabs extension gains its own behavior test so the 6th-tab conditional is pinned, not assumed.

    Step 0 — tests/components/profile/CommonGroundTabContent.test.tsx (RED before Step B impl):
    1. Explainer variant — 'Strong overlap': renders the exact label literal "Strong overlap" as a heading, and the explainer body mentions `ownerDisplayLabel` AND `sharedWatches.length` (e.g. "3 watch" / "3 watches") AND the top shared style in lowercase (e.g. "sport"). Feed overlap with overlapLabel='Strong overlap', sharedWatches (length=3), sharedStyleRows (label='Sport', viewerPct=60, ownerPct=50).
    2. Explainer variant — 'Some overlap': renders heading "Some overlap" and explainer body mentions both counts (`sharedWatches.length` and `sharedTasteTags.length`) with correct pluralization.
    3. Explainer variant — 'Different taste': renders heading "Different taste" and the exact explainer body "Your collections dont overlap much — different taste, different styles."
    4. Omits sharedWatches section when `sharedWatches.length === 0` — render with sharedWatches=[] (but sharedTasteTags non-empty so hasAny still conceptually true); assert `queryByText(/Shared watches/)` returns null and no `<ProfileWatchCard>` renders.
    5. Omits sharedTasteTags section when empty — render with sharedTasteTags=[] (sharedWatches non-empty); assert `queryByText('Shared taste tags')` returns null.
    6. Omits sharedStyleRows section when empty — render with sharedStyleRows=[] AND sharedRoleRows=[]; assert `queryByText('Collection composition')` returns null.
    7. Dual-bar markup emits inline `style.width` percentage widths matching `viewerPct` and `ownerPct` for each row — render with sharedStyleRows=[{label:'Sport', viewerPct:60, ownerPct:50}]; query the container for any element with `style={{ width: '60%' }}` AND any element with `style={{ width: '50%' }}` (assert via `container.innerHTML.includes('width: 60%')` AND `...includes('width: 50%')`).
    8. Renders the legend: `queryByText('You')` truthy AND `queryByText(ownerDisplayLabel)` truthy within the dual-bars section when bars render.

    Step 0b — tests/components/profile/ProfileTabs.test.tsx (RED before Step C impl):
    1. When `showCommonGround={false}` (or prop omitted): the rendered tabstrip contains exactly 5 TabsTriggers (one per existing tab); a TabsTrigger with `data-tab-id="common-ground"` (or the attribute chosen for testability — confirmed in Task 3 reading of ProfileTabs.tsx) is NOT present.
       Implementation note for the test: the existing 5 tabs should also carry `data-tab-id` attributes (collection/wishlist/worn/notes/stats). If they currently don't, the ProfileTabs Step C change below adds them, and the test should count `container.querySelectorAll('[data-tab-id]')` and assert .length === 5.
    2. When `showCommonGround={true}`: the rendered tabstrip contains 6 TabsTriggers; a TabsTrigger with `data-tab-id="common-ground"` IS present (assertion: `container.querySelector('[data-tab-id="common-ground"]')` is truthy).
    3. The Common Ground tab label text is exactly "Common Ground" (assertion: `queryByText('Common Ground')` truthy when showCommonGround=true, null when false).

    Both test files MUST fail (RED) until Step B and Step C implementations land.
  </behavior>
  <action>
Step A — create tests/components/profile/CommonGroundTabContent.test.tsx:
- Import render, screen from @testing-library/react.
- Import type { TasteOverlapResult } from '@/lib/tasteOverlap'.
- Import CommonGroundTabContent from '@/components/profile/CommonGroundTabContent'.
- Copy or replicate the makeOverlap factory from CommonGroundHeroBand.test.tsx so both files use identical fixtures.
- Write 8 test cases per the <behavior> block. For dual-bar width assertions, prefer checking `container.innerHTML` for the literal substring `'width: 60%'` — this is reliable because inline styles are serialized in jsdom.
- Run `npx vitest run tests/components/profile/CommonGroundTabContent.test.tsx --reporter=dot`; expect non-zero RED (component not yet created).

Commit: `test(09-04): RED — CommonGroundTabContent explainer variants + section omission + dual-bar widths`

Step A' — create tests/components/profile/ProfileTabs.test.tsx:
- Import render, screen from @testing-library/react.
- Import ProfileTabs from '@/components/profile/ProfileTabs'.
- Mock next/navigation's `usePathname` to return a stable value like `/u/tyler/collection` (ProfileTabs likely uses `usePathname()` to compute activeTab; if it uses a different hook, mock accordingly — read the file to confirm).
- Write 3 test cases per the <behavior> block.
- Run `npx vitest run tests/components/profile/ProfileTabs.test.tsx --reporter=dot`; expect non-zero RED (ProfileTabs has not yet been extended with the prop and `data-tab-id` attributes).

Commit: `test(09-04): RED — ProfileTabs showCommonGround conditional 6th tab`

Step B — src/components/profile/CommonGroundTabContent.tsx:
    - 'use client' NOT required
    - Import ProfileWatchCard, TasteTagPill, type TasteOverlapResult from @/lib/tasteOverlap
    - Props: { overlap: TasteOverlapResult, ownerDisplayLabel: string /* already computed as displayName ?? @username */ }
    - Render top-to-bottom with space-y-8 between sections:

    1. Overlap explainer card:
        <section className="rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">{overlap.overlapLabel}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{explainerBody}</p>
        </section>
       explainerBody:
         Strong -> `You and ${ownerDisplayLabel} lean ${topSharedStyle?.label.toLowerCase() || 'similarly'} together and share ${overlap.sharedWatches.length} watch${overlap.sharedWatches.length === 1 ? '' : 'es'} in your collections.`
         Some -> `You share ${overlap.sharedWatches.length} watch${plural} and ${overlap.sharedTasteTags.length} taste tag${tagPlural} with ${ownerDisplayLabel}.`
         Different -> "Your collections dont overlap much — different taste, different styles."

    2. Shared watches grid (only when sharedWatches.length > 0):
        <section>
          <h3 className="text-base font-semibold">Shared watches ({overlap.sharedWatches.length})</h3>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {overlap.sharedWatches.map(sw => <ProfileWatchCard key={sw.ownerWatch.id} watch={sw.ownerWatch} ... />)}
          </div>
        </section>

    3. Shared taste tags row (only when sharedTasteTags.length > 0):
        <section>
          <h3 className="text-base font-semibold">Shared taste tags</h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {overlap.sharedTasteTags.map(t => <li key={t}><TasteTagPill>{t}</TasteTagPill></li>)}
          </ul>
        </section>

    4. Dual style + role bars (only when sharedStyleRows.length > 0 OR sharedRoleRows.length > 0):
        <section>
          <h3 className="text-base font-semibold">Collection composition</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="inline-block mr-2 size-3 bg-muted rounded"></span> You
            <span className="mx-2">·</span>
            <span className="inline-block mr-2 size-3 bg-accent rounded"></span> {ownerDisplayLabel}
          </p>
          <div className="mt-4 space-y-6">
            {overlap.sharedStyleRows.length > 0 && (
              <DualBarGroup title="Styles" rows={overlap.sharedStyleRows} />
            )}
            {overlap.sharedRoleRows.length > 0 && (
              <DualBarGroup title="Roles" rows={overlap.sharedRoleRows} />
            )}
          </div>
        </section>

    DualBarGroup helper (inline, not exported) — per row render:
        <li className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 truncate">{row.label}</span>
          <div className="flex-1 flex flex-col gap-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-muted border border-accent" style={{ width: `${row.viewerPct}%` }} />
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${row.ownerPct}%` }} />
            </div>
          </div>
          <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{Math.round(row.viewerPct)}% / {Math.round(row.ownerPct)}%</span>
        </li>

    Section-order rule per UI-SPEC: omit any section whose data is empty. Existence of the tab guarantees at least one section has content.

Run: `npx vitest run tests/components/profile/CommonGroundTabContent.test.tsx --reporter=dot` → expect GREEN.

Step C — extend src/components/profile/ProfileTabs.tsx:
    - Add prop showCommonGround: boolean (optional, default false) to the component props
    - Ensure every rendered TabsTrigger emits `data-tab-id={tab.id}` for testability (add if absent). If the existing 5 tabs don't have this attribute, add it for all of them in the same commit so ProfileTabs.test.tsx can count them reliably.
    - Append a 6th tab entry to TABS when showCommonGround true:
        const tabs = showCommonGround
          ? [...TABS, { id: 'common-ground', label: 'Common Ground' }]
          : TABS
      and iterate `tabs` instead of the const TABS when rendering
    - The existing activeTab match already uses `endsWith('/${t.id}')` so 'common-ground' matches `/u/.../common-ground` naturally

Run: `npx vitest run tests/components/profile/ProfileTabs.test.tsx --reporter=dot` → expect GREEN.

Commit: feat(09-04): CommonGroundTabContent + ProfileTabs showCommonGround prop + data-tab-id (PROF-09)
  </action>
  <verify>
    <automated>npx vitest run --reporter=dot 2>&1 | tee /tmp/09-04-t3.log; grep -qE "0 failed" /tmp/09-04-t3.log &amp;&amp; npx tsc --noEmit 2>&1 | grep -E "(CommonGroundTabContent|ProfileTabs)\.tsx" | wc -l | grep -q "^0$"</automated>
  </verify>
  <acceptance_criteria>
    - tests/components/profile/CommonGroundTabContent.test.tsx exists with >= 8 test cases: grep -cE "it\(|test\(" tests/components/profile/CommonGroundTabContent.test.tsx >= 8
    - CommonGroundTabContent test covers all three explainer variants: grep -c "'Strong overlap'" tests/components/profile/CommonGroundTabContent.test.tsx >= 1 AND grep -c "'Some overlap'" tests/components/profile/CommonGroundTabContent.test.tsx >= 1 AND grep -c "'Different taste'" tests/components/profile/CommonGroundTabContent.test.tsx >= 1
    - CommonGroundTabContent test asserts section omission for each of three empty-data paths: grep -ciE "omit|queryByText" tests/components/profile/CommonGroundTabContent.test.tsx >= 3
    - CommonGroundTabContent test asserts dual-bar inline widths: grep -cE "width.*60%|width.*50%|width:.*%" tests/components/profile/CommonGroundTabContent.test.tsx >= 2
    - tests/components/profile/ProfileTabs.test.tsx exists with >= 3 test cases: grep -cE "it\(|test\(" tests/components/profile/ProfileTabs.test.tsx >= 3
    - ProfileTabs test asserts 6th tab presence/absence via data-tab-id="common-ground": grep -c "common-ground" tests/components/profile/ProfileTabs.test.tsx >= 2 AND grep -cE "data-tab-id" tests/components/profile/ProfileTabs.test.tsx >= 1
    - src/components/profile/CommonGroundTabContent.tsx exists
    - Renders all 4 sections in correct order: grep -cE "Shared watches|Shared taste tags|Collection composition" src/components/profile/CommonGroundTabContent.tsx >= 3
    - Explainer card uses rounded-xl border bg-card p-6: grep -cE "rounded-xl.*border.*bg-card.*p-6|bg-card.*rounded-xl" src/components/profile/CommonGroundTabContent.tsx >= 1
    - Shared watches grid uses grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4: grep -cE "grid-cols-1.*sm:grid-cols-2.*lg:grid-cols-4" src/components/profile/CommonGroundTabContent.tsx >= 1
    - Uses space-y-8 between sections: grep -c "space-y-8" src/components/profile/CommonGroundTabContent.tsx >= 1
    - Renders ProfileWatchCard for shared watches: grep -c "<ProfileWatchCard" src/components/profile/CommonGroundTabContent.tsx >= 1
    - Renders TasteTagPill for shared tags: grep -c "<TasteTagPill" src/components/profile/CommonGroundTabContent.tsx >= 1
    - Legend present: grep -c ">You<" src/components/profile/CommonGroundTabContent.tsx >= 1
    - Dual-bar markup uses viewerPct and ownerPct: grep -cE "viewerPct|ownerPct" src/components/profile/CommonGroundTabContent.tsx >= 2
    - Section-omit pattern: grep -cE "(sharedWatches\.length > 0|sharedTasteTags\.length > 0|sharedStyleRows\.length > 0)" src/components/profile/CommonGroundTabContent.tsx >= 3
    - ProfileTabs accepts showCommonGround prop: grep -c "showCommonGround" src/components/profile/ProfileTabs.tsx >= 2 (once in interface, once in the conditional)
    - ProfileTabs conditionally adds a common-ground entry: grep -cE "common-ground" src/components/profile/ProfileTabs.tsx >= 1
    - ProfileTabs emits data-tab-id on its TabsTriggers: grep -c "data-tab-id" src/components/profile/ProfileTabs.tsx >= 1
    - ProfileTabs still exports (does not break existing import sites): grep -c "export function ProfileTabs" src/components/profile/ProfileTabs.tsx >= 1
    - Both new test files pass GREEN: `npx vitest run tests/components/profile/CommonGroundTabContent.test.tsx tests/components/profile/ProfileTabs.test.tsx --reporter=dot` exits 0
    - Full suite green; TypeScript strict clean on both files
  </acceptance_criteria>
  <done>CommonGroundTabContent shows all four sections with correct omission behavior and is RTL-tested; ProfileTabs accepts and honors showCommonGround with a data-tab-id testability attribute; both new test files pin the behavior; full suite green; commits landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Wire layout.tsx + [tab]/page.tsx — fetch TasteOverlapData, render hero band, dispatch common-ground tab, replace PrivateTabState with LockedTabCard — with gate + payload-shape behavior test</name>
  <files>src/app/u/[username]/layout.tsx, src/app/u/[username]/[tab]/page.tsx, tests/app/layout-common-ground-gate.test.ts</files>
  <read_first>
    - src/app/u/[username]/layout.tsx (current state after Plan 02 — already fetches isFollowing and passes viewerId+targetUserId+initialIsFollowing to header/locked state)
    - src/app/u/[username]/[tab]/page.tsx (current state — lines 30-40 VALID_TABS; lines 56-71 per-tab privacy gates; lines 175-181 inline PrivateTabState)
    - src/data/follows.ts (Plan 01 — getTasteOverlapData — React cache()-wrapped)
    - src/lib/tasteOverlap.ts (Plan 01 — computeTasteOverlap, TasteOverlapResult)
    - src/components/profile/CommonGroundHeroBand.tsx (Task 2)
    - src/components/profile/CommonGroundTabContent.tsx (Task 3)
    - src/components/profile/ProfileTabs.tsx (Task 3 — now accepts showCommonGround)
    - src/components/profile/LockedTabCard.tsx (Task 1)
    - tests/data/profiles.test.ts (precedent for mocking `@/db` and asserting call shape)
    - tests/actions/watches.test.ts (precedent for mocking data modules and asserting calls / non-calls)
    - .planning/phases/09-follow-system-collector-profiles/09-UI-SPEC.md (Privacy & State Visibility Rules table — specifies exactly when hero band and 6th tab render)
    - .planning/phases/09-follow-system-collector-profiles/09-RESEARCH.md (Pitfall 8 — collection-private suppression of Common Ground at layout layer)
    - .planning/phases/09-follow-system-collector-profiles/09-CONTEXT.md (D-03, D-04, D-15, D-16, D-17)
  </read_first>
  <behavior>
    Step 0 — tests/app/layout-common-ground-gate.test.ts (RED before Step A wiring):

    This is a unit test for the three-way gate logic in layout.tsx. Because layout.tsx is a default-exported async Server Component that does JSX, we don't render it; we extract the gate into a testable computation OR we test it via module mocks + a direct call.

    Recommended approach: Extract the gate and computation into a named exported helper inside layout.tsx OR into a small module `src/app/u/[username]/common-ground-gate.ts` with a signature like:

    ```typescript
    // src/app/u/[username]/common-ground-gate.ts (NEW — extracted from layout.tsx)
    import { cache } from 'react'
    import { getTasteOverlapData } from '@/data/follows'
    import { computeTasteOverlap, type TasteOverlapResult } from '@/lib/tasteOverlap'

    export interface GateInput {
      viewerId: string | null
      ownerId: string
      isOwner: boolean
      collectionPublic: boolean
    }

    /**
     * Server-side Common Ground gate (T-09-08 / T-09-21 / T-09-23).
     * Returns the TasteOverlapResult when the three-way gate passes, otherwise null.
     * Never returns raw TasteOverlapData — only the aggregate result.
     */
    export async function resolveCommonGround(input: GateInput): Promise<TasteOverlapResult | null> {
      if (!input.viewerId) return null
      if (input.isOwner) return null
      if (!input.collectionPublic) return null
      const data = await getTasteOverlapData(input.viewerId, input.ownerId)
      return computeTasteOverlap(data.viewer, data.owner)
    }
    ```

    layout.tsx calls this helper rather than inlining the gate. Extraction keeps the gate testable AND the layout JSX terse.

    The test asserts:
    1. `viewerId = null` + other props = anything → `getTasteOverlapData` is NOT called; `resolveCommonGround` returns null.
    2. `isOwner = true` → `getTasteOverlapData` is NOT called; returns null.
    3. `collectionPublic = false` → `getTasteOverlapData` is NOT called; returns null.
    4. All three gate conditions pass (`viewerId !== null && !isOwner && collectionPublic`) → `getTasteOverlapData` IS called exactly once with `(viewerId, ownerId)`; returns the TasteOverlapResult from a mocked computeTasteOverlap.
    5. Return type of `resolveCommonGround` is `TasteOverlapResult | null` — the returned value does NOT contain `.viewer.watches` or `.owner.watches` raw-data keys (payload-shape assertion: `expect(result).not.toHaveProperty('viewer')` AND `expect(result).not.toHaveProperty('owner')`).
    6. When called twice in a row with the same inputs, `getTasteOverlapData` is either called twice (both go through to the cache-wrapped DAL, which memoizes per-request — in the test we just assert the mock is invoked, since there's no Next.js request context to scope the cache). The test accepts ≥1 calls and focuses on the behavior: that the gate does not short-circuit caching.

    Mocks used by the test:
    ```typescript
    vi.mock('@/data/follows', () => ({
      getTasteOverlapData: vi.fn(async (_viewer, _owner) => ({
        viewer: { watches: [], preferences: {} as never, tasteTags: [] },
        owner:  { watches: [], preferences: {} as never, tasteTags: [] },
      })),
    }))
    vi.mock('@/lib/tasteOverlap', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/tasteOverlap')>()
      return {
        ...actual,
        computeTasteOverlap: vi.fn(() => ({
          sharedWatches: [], sharedTasteTags: [],
          overlapLabel: 'Different taste', sharedStyleRows: [], sharedRoleRows: [], hasAny: false,
        })),
      }
    })
    ```

    Each test does `beforeEach(() => vi.clearAllMocks())`. The test imports `resolveCommonGround` from `'@/app/u/[username]/common-ground-gate'` AFTER the mocks. It MUST fail (RED) before Step A lands because the helper module does not yet exist.

    Commit: `test(09-04): RED — layout three-way Common Ground gate + payload-shape contract`
  </behavior>
  <action>
**Step 0 FIRST** — Create tests/app/layout-common-ground-gate.test.ts per the <behavior> block. Note: this file creates the `tests/app/` directory (it does not yet exist in the repo — `ls tests/app/` fails currently). Vitest automatically picks up any `.test.ts` under `tests/`, so no config change is needed. Import `resolveCommonGround` from `'@/app/u/[username]/common-ground-gate'` — the module will be created in Step A.

Run: `npx vitest run tests/app/layout-common-ground-gate.test.ts --reporter=dot` — expect non-zero RED.

Commit: `test(09-04): RED — layout three-way Common Ground gate + payload-shape contract`

**Step A** — Create `src/app/u/[username]/common-ground-gate.ts`:

```typescript
import 'server-only'
import { getTasteOverlapData } from '@/data/follows'
import { computeTasteOverlap, type TasteOverlapResult } from '@/lib/tasteOverlap'

export interface GateInput {
  viewerId: string | null
  ownerId: string
  isOwner: boolean
  collectionPublic: boolean
}

/**
 * Server-side Common Ground gate (T-09-08 / T-09-21 / T-09-23).
 * Returns the TasteOverlapResult when the three-way gate passes, otherwise null.
 * Never returns raw TasteOverlapData — only the aggregate result — so raw owner
 * collection data cannot cross the server/client boundary through this helper.
 */
export async function resolveCommonGround(input: GateInput): Promise<TasteOverlapResult | null> {
  if (!input.viewerId) return null
  if (input.isOwner) return null
  if (!input.collectionPublic) return null
  const data = await getTasteOverlapData(input.viewerId, input.ownerId)
  return computeTasteOverlap(data.viewer, data.owner)
}
```

Remove `import 'server-only'` from the test-context only if the vitest jsdom shim (tests/shims/server-only.ts) is already wired — it is (per existing tests/data/profiles.test.ts precedent), so the `server-only` import is compatible with the test environment.

**Step B** — src/app/u/[username]/layout.tsx changes:

At top of file, add imports:
    import { resolveCommonGround } from './common-ground-gate'
    import { CommonGroundHeroBand } from '@/components/profile/CommonGroundHeroBand'

After existing `initialIsFollowing` computation (introduced by Plan 02), add Common Ground computation on the public path (after Promise.all block):

    // Common Ground gate — pure gate+payload-shape extraction lives in ./common-ground-gate
    // Test: tests/app/layout-common-ground-gate.test.ts
    const overlap = await resolveCommonGround({
      viewerId,
      ownerId: profile.id,
      isOwner,
      collectionPublic: settings.collectionPublic,
    })

Render flow update on the public path:
    <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
      <ProfileHeader ... />
      {overlap && <CommonGroundHeroBand overlap={overlap} ownerUsername={username} />}
      <div className="mt-6">
        <ProfileTabs username={username} showCommonGround={overlap?.hasAny ?? false} />
      </div>
      <div className="mt-6">{children}</div>
    </main>

Note: on the LockedProfileState (profile_public=false) branch, DO NOT call resolveCommonGround or render the hero band — preserves Pitfall 8 resolution. That branch remains untouched.

**Step C** — src/app/u/[username]/[tab]/page.tsx changes:

1. Extend VALID_TABS to include 'common-ground':
    const VALID_TABS = ['collection', 'wishlist', 'worn', 'notes', 'stats', 'common-ground'] as const

2. Replace the bottom-of-file inline `function PrivateTabState({ tab })` helper — DELETE it entirely.

3. At each of the 5 existing private-tab guards, replace `<PrivateTabState tab="..." />` with:
    <LockedTabCard tab="..." displayName={profile.displayName ?? null} username={profile.username} />

4. Add import at top:
    import { LockedTabCard } from '@/components/profile/LockedTabCard'

5. Add handling for tab === 'common-ground' BEFORE any of the existing tab branches, by calling the same gate helper so the gate logic is single-sourced (DRY + still cache()-memoized by React cache at the DAL layer):

    import { resolveCommonGround } from '../common-ground-gate'
    import { CommonGroundTabContent } from '@/components/profile/CommonGroundTabContent'
    import { notFound } from 'next/navigation'

    if (tab === 'common-ground') {
      const overlap = await resolveCommonGround({
        viewerId,
        ownerId: profile.id,
        isOwner,
        collectionPublic: settings.collectionPublic,
      })
      if (!overlap || !overlap.hasAny) notFound() // empty/missing overlap → 6th tab absent (D-02, D-04, D-17)
      const ownerDisplayLabel = profile.displayName ?? `@${profile.username}`
      return <CommonGroundTabContent overlap={overlap} ownerDisplayLabel={ownerDisplayLabel} />
    }

    Because `getTasteOverlapData` is wrapped in React `cache()` (Plan 01 Warning 5 remediation), the layout + [tab]/page.tsx double-call produces a single DB roundtrip per request.

6. Full file still handles collection/wishlist/worn/notes/stats branches exactly as before, just with LockedTabCard instead of PrivateTabState.

**Step D** — verify D-19 owner-only UI is still gated properly (no new exposure):
- Collection tab — CollectionTabContent already accepts isOwner prop (Phase 8 T-08-27) and hides +Add card; unchanged
- Worn tab — WornTabContent already accepts isOwner (Phase 8)
- Notes tab — NoteRow / NoteVisibilityPill / RemoveNoteDialog already gate on isOwner
- Stats tab — buildObservations runs but StatsTabContent gates private-aggregate cards; unchanged

After wiring, run:
- `npx vitest run tests/app/layout-common-ground-gate.test.ts --reporter=dot` → expect GREEN
- `npx vitest run --reporter=dot` → full suite green
- `npx tsc --noEmit` → clean
- Manual smoke via npm run dev (document in commit body): visit /u/{otherUser} → see hero band (if overlap exists); click "See full comparison" → navigates to /u/{other}/common-ground → renders 6th-tab view; visit /u/{otherUser}/collection when other's collection_public=false → see LockedTabCard with "{name} keeps their collection private."; visit /u/{own} → no hero band, no 6th tab.

Commit: feat(09-04): wire Common Ground hero band + 6th tab + LockedTabCard + extracted resolveCommonGround gate (PROF-08, PROF-09)
  </action>
  <verify>
    <automated>npx vitest run --reporter=dot 2>&1 | grep -qE "0 failed" &amp;&amp; npx tsc --noEmit 2>&1 | grep -E "layout\.tsx|\\[tab\\]/page\.tsx|common-ground-gate\.ts" | wc -l | grep -q "^0$" &amp;&amp; npx eslint src/app/u/\[username\]/layout.tsx src/app/u/\[username\]/\[tab\]/page.tsx src/app/u/\[username\]/common-ground-gate.ts 2>&1 | (! grep -qE "(error|Error)")</automated>
  </verify>
  <acceptance_criteria>
    - tests/app/layout-common-ground-gate.test.ts exists: test -f tests/app/layout-common-ground-gate.test.ts
    - Gate test mocks @/data/follows to spy getTasteOverlapData: grep -c "vi.mock('@/data/follows'" tests/app/layout-common-ground-gate.test.ts >= 1
    - Gate test asserts NOT-called paths (3 separate assertions for the three gate fail modes): grep -cE "toHaveBeenCalled|not\\.toHaveBeenCalled|getTasteOverlapData.*not" tests/app/layout-common-ground-gate.test.ts >= 3
    - Gate test asserts IS-called path when all three gate conditions pass: grep -cE "toHaveBeenCalledWith|toHaveBeenCalledExactlyOnceWith" tests/app/layout-common-ground-gate.test.ts >= 1
    - Gate test asserts payload shape (no `viewer` / `owner` raw-data keys on the returned value): grep -cE "not\\.toHaveProperty\\('viewer'\\)|not\\.toHaveProperty\\(\"viewer\"\\)" tests/app/layout-common-ground-gate.test.ts >= 1 AND grep -cE "not\\.toHaveProperty\\('owner'\\)|not\\.toHaveProperty\\(\"owner\"\\)" tests/app/layout-common-ground-gate.test.ts >= 1
    - src/app/u/[username]/common-ground-gate.ts exists and exports resolveCommonGround: grep -c "^export async function resolveCommonGround" src/app/u/\[username\]/common-ground-gate.ts >= 1
    - common-ground-gate.ts uses 'server-only': head -1 src/app/u/\[username\]/common-ground-gate.ts contains "import 'server-only'"
    - common-ground-gate.ts enforces the three-way gate before calling DAL: grep -cE "!input\\.viewerId|input\\.isOwner|!input\\.collectionPublic" src/app/u/\[username\]/common-ground-gate.ts >= 3
    - common-ground-gate.ts returns TasteOverlapResult | null (never TasteOverlapData): grep -c "TasteOverlapResult \\| null" src/app/u/\[username\]/common-ground-gate.ts >= 1
    - layout.tsx imports resolveCommonGround (not getTasteOverlapData directly): grep -c "from './common-ground-gate'" src/app/u/\[username\]/layout.tsx >= 1 AND grep -cE "^import \\{ ?getTasteOverlapData" src/app/u/\[username\]/layout.tsx returns 0
    - layout.tsx renders CommonGroundHeroBand between ProfileHeader and ProfileTabs: grep -cE "CommonGroundHeroBand" src/app/u/\[username\]/layout.tsx >= 1
    - layout.tsx passes showCommonGround to ProfileTabs: grep -cE "showCommonGround=\\{" src/app/u/\[username\]/layout.tsx >= 1
    - layout.tsx does NOT touch LockedProfileState branch (overlap only on public path): verify the LockedProfileState return early branch does not reference `overlap` — grep -A 15 "!settings.profilePublic" src/app/u/\[username\]/layout.tsx should NOT contain `overlap`
    - [tab]/page.tsx VALID_TABS extended to include common-ground: grep -cE "common-ground" src/app/u/\[username\]/\[tab\]/page.tsx >= 2 (once in VALID_TABS tuple, once in the `if tab === 'common-ground'` branch)
    - [tab]/page.tsx imports LockedTabCard: grep -c "LockedTabCard" src/app/u/\[username\]/\[tab\]/page.tsx >= 1
    - [tab]/page.tsx imports resolveCommonGround from the shared gate module (NOT getTasteOverlapData directly): grep -c "from '../common-ground-gate'" src/app/u/\[username\]/\[tab\]/page.tsx >= 1 AND grep -cE "^import \\{ ?getTasteOverlapData" src/app/u/\[username\]/\[tab\]/page.tsx returns 0
    - [tab]/page.tsx imports CommonGroundTabContent: grep -c "CommonGroundTabContent" src/app/u/\[username\]/\[tab\]/page.tsx >= 1
    - [tab]/page.tsx LockedTabCard usage count equals 5 (one per existing private-tab guard): grep -c "<LockedTabCard" src/app/u/\[username\]/\[tab\]/page.tsx >= 5
    - [tab]/page.tsx inline PrivateTabState function removed: grep -c "function PrivateTabState" src/app/u/\[username\]/\[tab\]/page.tsx returns 0
    - [tab]/page.tsx empty-overlap branch calls notFound: grep -cE "overlap.hasAny|!overlap" src/app/u/\[username\]/\[tab\]/page.tsx >= 1 AND grep -c "notFound()" src/app/u/\[username\]/\[tab\]/page.tsx >= 1
    - No raw `owner.watches` shape prop ever reaches a Client Component: grep -rE "owner\\.watches" src/components/profile/CommonGroundHeroBand.tsx src/components/profile/CommonGroundTabContent.tsx returns 0
    - CommonGroundHeroBand + CommonGroundTabContent accept TasteOverlapResult only (not TasteOverlapData): grep -c "TasteOverlapResult" src/components/profile/CommonGroundHeroBand.tsx src/components/profile/CommonGroundTabContent.tsx >= 2
    - Layout + [tab]/page.tsx both route through resolveCommonGround — DRY guarantees the same gate applies on both surfaces: grep -rc "resolveCommonGround" src/app/u/\[username\] >= 2 (layout.tsx + [tab]/page.tsx)
    - Gate test passes GREEN: `npx vitest run tests/app/layout-common-ground-gate.test.ts --reporter=dot` exits 0
    - Full suite green; TypeScript strict clean; ESLint clean on all three modified/created files
  </acceptance_criteria>
  <done>Gate extracted to `common-ground-gate.ts` and single-sourced across layout.tsx + [tab]/page.tsx; three-way gate + payload-shape contract pinned by tests/app/layout-common-ground-gate.test.ts; all 5 private-tab guards use LockedTabCard; inline PrivateTabState removed; full suite green; commit landed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Layout Server Component → resolveCommonGround helper → getTasteOverlapData DAL | DAL loads both viewer and owner full watch lists — service-role read bypasses RLS; the GATE HELPER (viewerId && !isOwner && collectionPublic) is the sole authorization before this load, and is single-sourced in `src/app/u/[username]/common-ground-gate.ts` |
| computeTasteOverlap (pure function) → serialized TasteOverlapResult | Only the aggregate result (shared watches, tags, label, distributions) crosses the server/client boundary; raw owner collection never does. The helper's return type is `TasteOverlapResult \| null`, so raw `TasteOverlapData` cannot leak through its call sites. |
| [tab]/page.tsx common-ground branch → resolveCommonGround | Same gate helper, same guarantees. notFound() on any guard failure hides existence. |
| Private-tab gate → LockedTabCard | Existence of private data is disclosed via the locked state (by product design — D-18), but content is not |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-21 | Information Disclosure | Common Ground computation leaks owner's private collection via shared-watch intersection | mitigate | Gate helper `resolveCommonGround` (src/app/u/[username]/common-ground-gate.ts) enforces `viewerId && !isOwner && collectionPublic` before calling `getTasteOverlapData`. When gate fails, no fetch happens and the helper returns null. layout.tsx + [tab]/page.tsx both route through the helper — single-source gate. Pinned by `tests/app/layout-common-ground-gate.test.ts` with assertions that `getTasteOverlapData` is NOT called on any gate-fail path. |
| T-09-22 | Information Disclosure | Server Component sends raw owner.watches to the client via a mistakenly-exposed prop | mitigate | `resolveCommonGround` returns `TasteOverlapResult \| null` — never `TasteOverlapData`. CommonGroundHeroBand and CommonGroundTabContent accept `TasteOverlapResult` ONLY. Pinned by the gate test's payload-shape assertions (`not.toHaveProperty('viewer')`, `not.toHaveProperty('owner')`) AND by grep acceptance criteria that no Client Component imports TasteOverlapData. |
| T-09-23 | Information Disclosure | Common Ground tab accessible via direct URL navigation on own profile | mitigate | `[tab]/page.tsx` common-ground branch uses the same `resolveCommonGround` helper. When gate fails (including `isOwner`), helper returns null and page calls `notFound()`. |
| T-09-24 | Information Disclosure | Private-tab locked state reveals existence of non-public data | accept | By product design (D-18 Letterboxd pattern). LockedTabCard copy "{name} keeps their {tab} private" is intentional signal, not a leak. |
| T-09-25 | Information Disclosure | 6th-tab visibility in tab row reveals whether overlap exists with the viewer | accept | By product design (D-17). The tab is either rendered or not rendered — no "locked 6th tab" state. This is the intended "taste-first follow prompt" surface. |
| T-09-26 | Tampering | Viewer forges `/u/[username]/common-ground` URL when they have zero overlap | mitigate | `[tab]/page.tsx` returns notFound() when `resolveCommonGround` returns null OR when `overlap.hasAny` is false, preserving D-02 "6th tab is NOT rendered at all" rule. |
| T-09-27 | Repudiation | User reports "I was shown Common Ground with a private user" | mitigate | Gate test provides hard evidence that `getTasteOverlapData` is not invoked on the `collectionPublic=false` path. Server logs (console.error on action failures) make any incorrect behavior traceable. No client-side bypass path exists because the gate runs in Server Components. |
| T-09-28 | Denial of Service | Every non-owner profile render incurs a double watch load (viewer + owner) | accept | Target scale <500 watches per user; load is bounded. Plan 01 Warning-5 remediation (React `cache()` on `getTasteOverlapData`) eliminates the redundant call when layout + common-ground-tab-page both invoke it in the same render cycle. Materialized-view swap-in documented as deferred. |
</threat_model>

<verification>
1. `npx vitest run --reporter=dot` exits 0.
2. `npx tsc --noEmit` exits 0 — verified with grep that no lines mention CommonGround*, LockedTabCard, layout.tsx, [tab]/page.tsx, or common-ground-gate.ts.
3. `npx eslint src/app/u/\[username\]/layout.tsx src/app/u/\[username\]/\[tab\]/page.tsx src/app/u/\[username\]/common-ground-gate.ts src/components/profile/CommonGroundHeroBand.tsx src/components/profile/CommonGroundTabContent.tsx src/components/profile/LockedTabCard.tsx src/components/profile/ProfileTabs.tsx` reports no errors.
4. No references to `overlap` from the LockedProfileState branch in layout.tsx (T-09-21 verification).
5. No Client Components receive `TasteOverlapData` (raw collections) — verified via grep that only `TasteOverlapResult` crosses into /profile/* components, and via the gate test's payload-shape `not.toHaveProperty` assertions.
6. Gate helper is single-sourced: both layout.tsx and [tab]/page.tsx call `resolveCommonGround` — neither imports `getTasteOverlapData` directly.
7. Full phase success criteria verified (see below).
8. Manual smoke (human UAT, not gating):
    - Visit /u/{other}/ as a user with 3+ shared watches → hero band renders with "Strong overlap" / "Some overlap" per computed label
    - Visit /u/{other}/common-ground → 6th-tab detail renders with explainer card + shared watches grid
    - Visit /u/{other}/collection when other's collection_public=false → LockedTabCard with "{other} keeps their collection private."
    - Visit /u/{own} → no hero band, no 6th tab
    - Visit /u/{other}/common-ground directly when /u/{other} has zero overlap → 404
    - Visit /u/{other}/common-ground when other's collection_public=false → 404
</verification>

<success_criteria>
- `src/app/u/[username]/common-ground-gate.ts` defines `resolveCommonGround(input)` which enforces the three-way gate (viewerId && !isOwner && collectionPublic) and returns `TasteOverlapResult | null` — never raw `TasteOverlapData`.
- layout.tsx and [tab]/page.tsx both call `resolveCommonGround` — single-sourced gate, DRY.
- When gate passes, CommonGroundHeroBand renders between ProfileHeader and ProfileTabs.
- ProfileTabs renders the 6th "Common Ground" tab only when !isOwner && overlap.hasAny. Backed by `tests/components/profile/ProfileTabs.test.tsx` asserting the conditional 6th TabsTrigger via `data-tab-id="common-ground"`.
- [tab]/page.tsx dispatches common-ground → CommonGroundTabContent. Any gate failure returns Next.js 404.
- CommonGroundTabContent renders three explainer variants and omits each section whose data is empty — backed by `tests/components/profile/CommonGroundTabContent.test.tsx` asserting all three variants + three omission paths + dual-bar inline widths.
- All 5 existing per-tab privacy gates use LockedTabCard (not the inline PrivateTabState) and pass displayName + username so the copy reads "{name} keeps their {tab} private" (with worn→"worn history" remap).
- Inline PrivateTabState helper removed from [tab]/page.tsx — grep confirms zero occurrences.
- Owner views contain no hero band, no 6th tab, no LockedTabCard (only owner-only UI affordances per D-19 — preserved from Phase 8).
- When owner's collection is private and viewer is not owner, Common Ground is entirely suppressed (hero band absent, 6th tab absent, direct URL returns 404). Pinned by `tests/app/layout-common-ground-gate.test.ts` — `getTasteOverlapData` is NOT called on this path. T-09-08 + Pitfall 8 mitigated.
- CommonGroundHeroBand renders three pill variants (Strong / Some / Different) with correct Tailwind classes per UI-SPEC, and the empty-overlap single-line treatment.
- CommonGroundTabContent renders sections top-to-bottom with UI-SPEC spacing (space-y-8), omitting each section whose data is empty.
- Tab-label map in LockedTabCard correctly remaps "worn" to "worn history" (D-18 grammatical flow).
- All new components + extensions typecheck under strict mode.
- Raw owner collection data never crosses the server/client boundary — `TasteOverlapData` stays server-side inside `getTasteOverlapData`'s caller graph, only `TasteOverlapResult` is propagated to components. Pinned by the gate test's payload-shape `not.toHaveProperty` assertions.
- Sampling continuity for this plan: 4/4 tasks have automated RED→GREEN coverage (no task ships production code without a behavior-pinning test at commit time).
</success_criteria>

<output>
After completion create .planning/phases/09-follow-system-collector-profiles/09-04-SUMMARY.md with:
- Files created (LockedTabCard, CommonGroundHeroBand, CommonGroundTabContent, common-ground-gate.ts) and extended (layout.tsx, [tab]/page.tsx, ProfileTabs.tsx)
- Test files created (LockedTabCard.test.tsx, CommonGroundHeroBand.test.tsx, CommonGroundTabContent.test.tsx, ProfileTabs.test.tsx, layout-common-ground-gate.test.ts)
- Gate summary for Common Ground (three conditions, single-sourced in common-ground-gate.ts, enforced in both layout.tsx and [tab]/page.tsx)
- Payload-shape guarantee (resolveCommonGround returns TasteOverlapResult | null — raw TasteOverlapData does not cross the server/client boundary) — pinned by gate test's `not.toHaveProperty` assertions
- Any threshold calibration notes carried from Plan 01
- Test count and green status
- Any UI-SPEC divergences (should be none)
- Manual UAT checklist (for human verification before phase sign-off)
</output>

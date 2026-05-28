---
status: diagnosed
trigger: "Phase 64 UAT Test 2 — On mobile, brand+model identifier is pushed below the fold by the carousel + filmstrip"
created: 2026-05-28T00:00:00Z
updated: 2026-05-28T00:00:00Z
---

## Current Focus

hypothesis: "On mobile (< 1024px), the WatchDetailHero grid collapses to a single column; the photo column (WatchPhotoSection: aspect-square carousel viewport + filmstrip + photo counter, all inside a `space-y-3` stack) is rendered as the FIRST DOM child of the grid; the title block (brand `<h1>` + model + ref + SpecsSublabel) is rendered as the SECOND child. With a square carousel filling the viewport width + a wrapping filmstrip below it, the title block lands below the fold on a typical phone viewport."
test: "Inspected WatchDetailHero.tsx layout primitive and child order; verified WatchPhotoSection vertical height contributors; verified WatchPageSkeleton mirror; confirmed Branch 3 (catalog) uses a different hero pattern."
expecting: "Layout-ordering decision, not a defect. The mobile single-column stack is functioning as specified by the UI contract (D-01 'mobile: single column' and the responsive contract table). The symptom is a UX hierarchy issue: the page's identifier is no longer above the fold on small viewports because the dominant visual is itself larger than the fold."
next_action: "Return ROOT CAUSE FOUND with structural locus + fix direction (Option A — mobile-only hoist brand+model <h1>). plan-phase --gaps owns the executable plan."

reasoning_checkpoint:
  hypothesis: "WatchDetailHero.tsx:159 uses a grid with `lg:grid-cols-[…]` (responsive desktop) but no `lg:` modifier on child ORDER, so on mobile the photo column (line 167) renders before the title column (line 209) by natural DOM order. The photo column contains WatchPhotoSection, whose viewport is `aspect-square w-full` (line 457 in WatchPhotoSection.tsx) + a `flex flex-wrap` filmstrip + a photo counter, totaling ~viewport-width + filmstrip-height vertical pixels. On a 390×844 iPhone-class viewport, a w-full square is ~390px tall + filmstrip ~80px + container padding/margins ~64px + page top padding `py-8` ~32px = ~566px of pre-title content. The `<h1>` lands well below an ~700-800px first-paint fold."
  confirming_evidence:
    - "WatchDetailHero.tsx:159 — `<div className=\"grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]\">` — single track on mobile, two-track on lg+. Order is DOM order on mobile."
    - "WatchDetailHero.tsx:167 — first child div containing `<WatchPhotoSection …/>` (carousel + filmstrip)."
    - "WatchDetailHero.tsx:209 — second child div containing the title block (`<h1>`, model `<p>`, `Ref. …` `<p>`, `<SpecsSublabel/>`)."
    - "WatchPhotoSection.tsx:457 — carousel viewport is `relative aspect-square w-full overflow-hidden rounded-lg bg-muted` (with `fill` prop set, the `max-w-md` cap is dropped → carousel fills its column width)."
    - "WatchPhotoSection.tsx:452 — wrapping container is `space-y-3` (carousel → photo counter → filmstrip stack)."
    - "WatchPhotoSection.tsx:694 — owner filmstrip is `flex flex-wrap gap-2 pb-1` (wraps to multiple rows when filmstrip is wide, adding more vertical pixels)."
    - "page.tsx:108-127 — WatchPageSkeleton uses the SAME grid (`lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]`) with carousel placeholder FIRST and right-column placeholders SECOND. Any mobile reorder must mirror here to avoid layout shift on cache-fill."
    - "page.tsx:675-700 — Branch 3 (catalog) uses a DIFFERENT pattern: `<div className=\"flex items-start gap-4\">` with a fixed 96px thumbnail + title beside it. This pattern is unaffected by the mobile-stack-order issue (title is always beside the small thumbnail, never below a full-width visual)."
  falsification_test: "If the title-below-fold issue persisted with the title block hoisted above the carousel in JSX (or shown to be above-the-fold via DOM inspector), the hypothesis would be wrong. Since the user's verbatim report names the photo + filmstrip as the cause and explicitly proposes hoisting the title above the photo as the fix, the hypothesis is well-supported by the user's own observation."
  fix_rationale: "Option A (mobile-only title hoist) addresses the structural cause directly: the brand+model `<h1>` becomes the first visual element on mobile, restoring identifier-first hierarchy. Desktop stays 60/40 grid with the photo dominant on the left and the title on the right (already adjacent in reading order on lg+). The spec strip (ref/type/size/color) staying below the photo on mobile is a deliberate UX choice — those are descriptive metadata, not identity — and matches the user's verbatim recommendation in UAT."
  blind_spots:
    - "Have not measured actual fold heights on physical iOS/Android viewports — math is approximate (390×844 baseline)."
    - "Have not checked whether wear-pic filmstrip presence (public wear pics from other users) further increases the vertical stack between carousel and title; with public wear pics the photo section adds a second filmstrip (WatchPhotoSection.tsx:725-727), pushing the title even further down."
    - "Have not verified that splitting title (brand+model) from the spec strip (ref/type/size/color) is accessibility-safe — the proposed split puts <h1> on top and the descriptive sub-block below the photo. Tab order on mobile: hero photo controls → title <h1> (non-interactive) → photo controls again? Needs verification that hoisted `<h1>` does not create an awkward tab order; since `<h1>` is non-interactive, this is likely safe but worth confirming during planning."
    - "Have not checked CommentGateLocked / other states whose presence in the photo section could further inflate the pre-title height."

## Symptoms

expected: "On mobile, the brand+model identifier is reachable above the fold on a /w/[ref] page."
actual: "On mobile, after the hero collapses to a single column, the user sees: photo carousel (~viewport-width square) → photo counter → filmstrip (wraps) → THEN brand+model <h1>. The identifier is pushed below the first-paint fold."
errors: "None. Functional pass."
reproduction: "Load any /w/[ref] page on a mobile viewport (≤640px wide). Observe vertical stack and where the <h1> lands relative to the first-paint fold."
started: "Phase 64 UAT 2026-05-28 — discovered after hero unification (commits 16c3700 → 084ec94 → bd90f54 → 95385e9) made the carousel full-column-width on desktop AND on mobile (`fill` prop relaxes the `max-w-md` cap on WatchPhotoSection)."

## Eliminated

- hypothesis: "Filmstrip CSS bug pushing content"
  evidence: "Filmstrip is the documented design (Phase 61); not a bug. The size of carousel+filmstrip is intentional. The 'bug' is in the relative ordering of identifier vs visual on a small viewport."
  timestamp: "2026-05-28T00:00:00Z"

- hypothesis: "Branch 3 (catalog) has the same issue"
  evidence: "Branch 3 uses a separate inline hero pattern (page.tsx:675 `<div className=\"flex items-start gap-4\">` with a fixed 96×96 thumbnail beside the title). Title and visual sit side-by-side on every viewport via flex — not stacked. Not affected."
  timestamp: "2026-05-28T00:00:00Z"

- hypothesis: "WatchDetailContextBlock position is interfering"
  evidence: "WatchDetailContextBlock renders BELOW the hero (page.tsx:347), so it cannot push the title down inside the hero. It is unaffected by the title's position; conversely, the hero's title position is unaffected by it."
  timestamp: "2026-05-28T00:00:00Z"

## Evidence

- timestamp: "2026-05-28T00:00:00Z"
  checked: "WatchDetailHero.tsx layout primitive (lines 159, 167, 209)"
  found: "Grid `grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]` with two children: left = photo column (line 167), right = title+verdict-empty+like+actions column (line 209). On mobile there is NO order-reverse class — DOM order rules."
  implication: "Locus confirmed. Mobile reorder must change the JSX child order OR add a responsive `order-` Tailwind utility (but D-07 explicitly bans CSS-order tricks — tab order must match visual order). The clean fix is JSX-level: extract `<h1>` + `<p>{model}</p>` into a small sub-block and render it conditionally before the photo column on mobile, then leave the spec strip (ref/type/size/color) in the existing right column."

- timestamp: "2026-05-28T00:00:00Z"
  checked: "Title block cohesion in WatchDetailHero.tsx:214-233"
  found: "The title block is rendered as ONE `<div>` containing: optional status Badge → `<h1>brand</h1>` → `<p>model</p>` → optional `<p>Ref. {reference}</p>` → `<SpecsSublabel/>`. Brand+model and the ref/specs are separable — SpecsSublabel is already a standalone component imported from `@/components/watch/SpecsSublabel`."
  implication: "Option A is structurally simple: extract a `<TitleHeader>` sub-block (brand `<h1>` + model `<p>`) and render it (a) on mobile, before the photo column AND (b) inside the right column on desktop — OR render it ONCE outside the grid above on mobile, hidden via `lg:hidden`, and keep the existing right-column block visible from `lg:` up. Either pattern is viable; the second avoids JSX duplication via a `hidden lg:block` / `lg:hidden` toggle."

- timestamp: "2026-05-28T00:00:00Z"
  checked: "page.tsx WatchPageSkeleton (lines 108-127)"
  found: "Skeleton uses the same grid; left placeholder is `aspect-square w-full rounded-lg` (carousel shape), right placeholders are `h-7 w-3/4` (brand) → `h-5 w-1/2` (model) → `h-4 w-1/3` (spec strip) → `h-40 w-full rounded-lg` (verdict) → `h-9 w-24` (like)."
  implication: "Skeleton MUST mirror the new mobile order or Test 7 regresses + the user sees a content-jump on cache-fill. Add a mobile-only title placeholder above the carousel placeholder in the skeleton (or use the same `lg:hidden`/`hidden lg:block` toggle on a small skeleton row that renders the brand+model placeholder above the carousel skeleton on mobile)."

- timestamp: "2026-05-28T00:00:00Z"
  checked: "WatchPhotoSection vertical contributors (lines 452, 457, 631-635, 694, 725)"
  found: "Photo section is `space-y-3` containing: square aspect carousel viewport (full-column-width), optional `text-sm text-muted-foreground text-center` photo counter (only when 2+ photos), `flex flex-wrap` owner filmstrip (when owner photos exist), optional second `flex flex-wrap mt-1` wear-pic filmstrip (when public wear pics exist)."
  implication: "Pre-title vertical pixels can be up to: aspect-square carousel (~width-of-viewport) + counter (~24px) + owner filmstrip (1-2 rows of 64×64 thumbnails) + wear-pic filmstrip (additional 64×64 row). On 390px-wide mobile that's ~390 + 24 + ~80 + ~80 ≈ 574px of pre-title content, plus container `py-8` (32px top) ≈ ~606px. iPhone 14 fold (with browser chrome) is roughly 700-740px, so identifier is at or below the fold — confirmed structurally."

- timestamp: "2026-05-28T00:00:00Z"
  checked: "Cross-viewer branch consistency"
  found: "WatchDetailHero is the sole hero for Branch 1 (owner, page.tsx:324) and Branch 2 (cross-user). Branch 3 (catalog, page.tsx:675) uses inline JSX with a side-by-side thumbnail+title flex row. Any mobile-title-hoist fix in WatchDetailHero applies uniformly to Branches 1 & 2; Branch 3 already shows the title beside the (small) image at every viewport and needs no change."
  implication: "Single-file fix locus. Branch 3 catalog page is unaffected and should not be touched."

## Resolution

root_cause: "Mobile stack-order: identifier below visual. WatchDetailHero.tsx:159 collapses a 2-column grid to a single track on mobile and renders its photo column (carousel + filmstrip(s) ≈ 470-580 vertical px on a typical phone) as the FIRST child, pushing the title block (brand <h1> + model + ref + SpecsSublabel — the SECOND child at line 209) below the first-paint fold. This is a layout-ordering decision in the UI-SPEC, not a defect — D-01 and the responsive-behavior table explicitly mandate 'mobile: single column' with the photo first — but the resulting visual hierarchy fails the implicit truth that the identifier should be reachable above the fold on a watch detail page. Branch 3 (catalog) uses a separate side-by-side flex pattern and is unaffected. The fix is a JSX-level reorder (NOT CSS `order-` — D-07 bans CSS-order tricks for tab-order parity), surfacing the brand+model <h1> + model <p> above the carousel on mobile and keeping the existing right-column block on desktop."
fix: ""
verification: ""
files_changed: []

# Deferred Items — Phase 46 (Explore Shell + Browse + Archetypes)

Two operator-raised follow-ups from the Phase 46 UAT approval (2026-05-19).
Both were explicitly approved as **end-of-v5.1 follow-ups** — not blocking
gaps. Address before the v5.1 milestone closes (after Phase 47, or as a
small v5.1 polish phase).

---

## FU-01 — Expose brand/era/genre/archetype facets in the `/search` filters menu

**Raised by:** operator, Phase 46 UAT approval.

**Observation:** Phase 46 makes brand/era/genre/archetype arrive at `/search`
as inline removable chips when the user deep-links in from `/explore`. But the
`/search` filters menu itself still only offers movement/size/style. Once a
user has landed on a prefiltered view, the only way to switch to a *different*
genre/era/archetype is to navigate back to `/explore` and pick again — which
feels unintuitive when the prefiltered `/search` is otherwise a full,
composable tool.

**Desired behavior:** The `/search` filters menu should let the user pick or
change brand/era/genre/archetype in place — the same facets that can arrive
via deep-link should be editable from the filter UI, no round-trip to
`/explore` required.

**Scope notes:**
- The facet *state* and URL round-trip already exist in `useSearchState.ts`
  (`brand`/`era`/`genre`/`archetype` + setters) and `catalog.ts`
  (`CatalogSearchFilters`). This is a UI-surface task: add controls to the
  filters menu component, wired to the existing setters.
- Decide whether all four facets belong in the menu or only a subset
  (archetype is a large vocabulary — may want a searchable select vs. chips).
- Relates to EXPL-03 / EXPL-05.

---

## FU-02 — `/explore/brands` A–Z letter-anchor scroll is still not smooth

**Raised by:** operator, Phase 46 UAT approval (Test 5 — supersedes the
"resolved" status recorded for gap G2).

**Observation:** Plan 46-06 added `scroll-smooth` to the `<main>` element on
`/explore/brands` to satisfy gap G2 (smooth ease-in-out scroll on A–Z letter
clicks). In the browser the vertical scroll to the clicked letter's section is
**still an instant hard jump** — `scroll-smooth` is not taking effect.

**Likely causes to investigate:**
- `scroll-behavior: smooth` must be on the actual *scrolling* element. If the
  document/`<html>` is the scroll container (not `<main>`), the class on
  `<main>` has no effect — move it to `html` (Tailwind: on the `<html>` tag in
  the root layout, or a global `html { scroll-behavior: smooth }`).
- A native anchor jump (`href="#letter-x"`) may bypass smooth behavior if the
  target is reached via `element.scrollIntoView()` without
  `{ behavior: 'smooth' }`, or if a sticky-offset hack uses `scrollTo`.
- Check for `prefers-reduced-motion` overrides and Turbopack stale `.next`
  CSS (see project memory: clear `.next` before concluding a CSS fix failed).

**Scope notes:**
- Pure CSS/markup fix on `src/app/explore/brands/page.tsx` (and possibly the
  root layout `<html>`).
- The G2 gap entry in `46-HUMAN-UAT.md` is marked `resolved` because plan
  46-06 shipped the intended change; this item tracks that the change did not
  actually produce the smooth behavior in the browser.

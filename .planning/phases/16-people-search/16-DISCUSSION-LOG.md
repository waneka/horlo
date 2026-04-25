# Phase 16: People Search - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 16-people-search
**Areas discussed:** Search interaction model, /search page structure, Result row + privacy UX, Desktop nav cleanup

---

## Search interaction model

### Q1: Persistent desktop top-nav search input behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Submit-only | Type → Enter routes to `/search?q=foo`. Live results live ON `/search` only. Simplest scope, ships fastest. | ✓ |
| Live dropdown panel | Type 2+ chars → dropdown panel under the input shows top ~5 People matches in real time. | |
| Hybrid — live preview, full /search | Minimal 3-row dropdown + explicit "View all" link to `/search`. | |

**User's choice:** Submit-only
**Notes:** Recommended path; keeps Phase 16 scope tight; live dropdown deferred to a future polish phase.

---

### Q2: Behavior when user lands on `/search?q=foo`?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-populate + fire | Input pre-fills with "foo" and the People query fires immediately. URL stays in sync as user keeps typing. | ✓ |
| Pre-populate, wait for typing | Input pre-fills but user must type or hit Enter again to query. | |
| Empty page, no pre-fill | `/search` ignores `?q=` entirely and starts blank with suggested collectors. | |

**User's choice:** Pre-populate + fire
**Notes:** Recommended path; user expects results immediately when they hit Enter from the nav input.

---

### Q3: Stale in-flight search handling?

| Option | Description | Selected |
|--------|-------------|----------|
| AbortController + 250ms debounce | Each new keystroke (after debounce) aborts the prior fetch. Standard React typeahead pattern. | ✓ |
| Debounce only, latest wins | 250ms debounce alone; results may flicker on flaky networks. | |

**User's choice:** AbortController + debounce
**Notes:** Recommended path; ~10 extra lines for race-safety.

---

### Q4: URL sync on continued typing?

| Option | Description | Selected |
|--------|-------------|----------|
| `router.replace()` on debounced fire | URL updates after each debounced query; back-button stays sane (one history entry); bookmarks/shares work. | ✓ |
| `pushState` per query | Each settled query pushes a new history entry. Probably too noisy for a fast-typing surface. | |
| URL stays at landing q | Only initial `/search?q=...` is in URL; subsequent typing is local state. | |

**User's choice:** `router.replace()` on debounced fire
**Notes:** Recommended path; matches typical typeahead behavior.

---

## /search page structure

### Q1: Default landing tab when `/search` opens?

| Option | Description | Selected |
|--------|-------------|----------|
| People | Only populated tab in v3.0 — default to where the user gets value. | |
| All | Broadest hook; pre-results shows suggested collectors + coming-soon teasers below. | ✓ |
| Last-used tab (localStorage) | Remember user's last selection. | |

**User's choice:** All
**Notes:** Picked over the Recommended "People" — positions `/search` as a search hub rather than a people-only surface. Pairs with the "Mirror People + coming-soon footers" content choice below to make this work even when 3/4 sub-surfaces are coming-soon.

---

### Q2: What does the All tab show?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror People + coming-soon footers | Pre-query: suggested collectors + 2 coming-soon cards. With query: People results + 2 coming-soon footers. | ✓ |
| Identical to People tab | All == People until Watches/Collections come online. | |
| Stitched sections with headers | Three subsections with headers; coming-soon banners for Watches/Collections. | |

**User's choice:** Mirror People + coming-soon footers
**Notes:** Recommended path; keeps the All tab feeling polished without over-engineering when 2/3 categories are stubs.

---

### Q3: Loading state during fetch?

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton rows | 3–5 row-shaped skeletons; matches NetworkActivityFeed + SuggestedCollectors pattern. | ✓ |
| Keep stale results visible | Old results stay visible (faded) while new ones fetch. | |
| Inline spinner only | Spinner in the input, no skeleton in the result area. | |

**User's choice:** Skeleton rows
**Notes:** Recommended path; codebase convention.

---

### Q4: Tab state in URL?

| Option | Description | Selected |
|--------|-------------|----------|
| `?tab=people` query string | Tab sync via search param. Bookmarkable, shareable, back-button works. Default tab omitted from URL. | ✓ |
| `/search/people` path segment | Tab as route segment. More semantic but requires nested route folders for stub tabs. | |
| Local state only, no URL | Tab is component state; reload loses tab. | |

**User's choice:** `?tab=people` query string
**Notes:** Recommended path; same `router.replace()` pattern as `q=` sync.

---

### Q5: No-results state for 0 People matches?

| Option | Description | Selected |
|--------|-------------|----------|
| "No results" message + suggested collectors below | Header + sub-header + suggested rows. Acknowledges dead end + offers recovery. | ✓ |
| Silently swap to suggested collectors | Empty result → same suggested-collector list as pre-query state, no "no results" header. | |
| Hard empty state, no suggestions | "No collectors match" with no recovery surface. | |

**User's choice:** "No results" message + suggested collectors below
**Notes:** Recommended path; matches REQUIREMENTS SRCH-06.

---

### Q6: Pre-query state on People + All tabs?

| Option | Description | Selected |
|--------|-------------|----------|
| Suggested collectors with section header | "Collectors you might like" header + suggested-collector rows from `getSuggestedCollectorsForViewer`. | ✓ |
| Empty state with prompt copy | Just instructional copy, no rows. | |
| Recent profiles you visited | Tracked viewed profiles, last 5. Deferred per SRCH-FUT-03. | |

**User's choice:** Suggested collectors with section header
**Notes:** Recommended path; reuses home page DAL.

---

### Tangential question (raised by user during this area)

User asked: *"when watches are added to a wishlist or collection - are they saved in any long-living watch database? i think the idea is that we will grow a watch DB overtime by saving and normalizing watches as they're added over time. is any of that wired up? i suppose that's maybe a different phase."*

Claude's answer: No canonical/normalized watch DB exists. PROJECT.md key decisions table records the explicit choice: "Per-user independent watch entries (no canonical watch table) — canonical normalization adds huge product complexity; per-user entries ship faster... revisit in a future 'data strategy' phase if social features need cross-user watch identity." This is the prerequisite blocking the Watches and Collections search tabs (SRCH-FUT-01, SRCH-FUT-02). Captured in CONTEXT.md `<deferred>` section.

---

## Result row + privacy UX

### Q1: Result row layout?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse SuggestedCollectorRow pattern | avatar · name + overlap · bio snippet · mini-thumbs + shared count · inline FollowButton. | ✓ |
| Simpler row — no shared watches cluster | avatar · name + bio snippet + overlap · FollowButton. | |
| Two-line text-heavy row | Bio-prominent row, no shared-watch visual. | |

**User's choice:** Reuse SuggestedCollectorRow pattern
**Notes:** Recommended path; visual continuity with home page rows.

---

### Q2: Bio snippet display?

| Option | Description | Selected |
|--------|-------------|----------|
| 1-line clamp with ellipsis | Predictable row height; full bio reachable via profile click. | ✓ |
| 2-line clamp | More context, but rows get tall. | |
| Snippet around match | Window around match position. More technical, marginal UX gain. | |

**User's choice:** 1-line clamp with ellipsis
**Notes:** Recommended path.

---

### Q3: Match highlighting?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — bold the match in username and bio | Wrap matched substrings in `<mark>` or `<strong>`. | ✓ |
| No highlighting | Plain text rendering. | |
| Highlight only bio matches, not username | Mixed approach. | |

**User's choice:** Yes — bold the match in username and bio
**Notes:** Recommended path; cheap to compute client-side.

---

### Q4: Privacy gate?

| Option | Description | Selected |
|--------|-------------|----------|
| Silently excluded at the DAL | `WHERE profile_public = true`; private profiles never appear; zero existence leak. | ✓ |
| Excluded for non-followers, visible to followers | LEFT JOIN follows cost on every search query. | |
| Show muted "Private collector" placeholder | Leaks existence of private profiles. | |

**User's choice:** Silently excluded at the DAL
**Notes:** Recommended path; matches v2.0 two-layer privacy pattern.

---

## Desktop nav cleanup

### Q1: HeaderNav (Collection / Profile / Settings inline links) fate?

| Option | Description | Selected |
|--------|-------------|----------|
| Remove entirely | Matches Figma. Logo → / handles Collection. Profile + Settings already in UserMenu. | ✓ |
| Keep just Profile inline | Profile inline next to Explore; Settings stays in dropdown only. | |
| Hide HeaderNav but keep file for future | Comment-out import, don't delete. | |

**User's choice:** Remove entirely
**Notes:** Recommended path; HeaderNav.tsx file deletion in scope.

---

### Q2: Persistent nav input vs `/search` page input — same or separate?

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate inputs | Nav = dumb launcher (submit-only). Page = smart (live debounce, AbortController, URL sync). | ✓ |
| Same input that morphs | One element, two behaviors based on pathname. | |
| Hide nav input on /search | When user is on /search, nav input disappears. | |

**User's choice:** Two separate inputs
**Notes:** Recommended path; clean separation of concerns.

---

### Q3: Mobile SlimTopNav scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Mobile unchanged — desktop only | SlimTopNav already matches Figma intent per Phase 14 D-11. | ✓ |
| Also revisit mobile spacing | Touch SlimTopNav too. | |

**User's choice:** Mobile unchanged — desktop only
**Notes:** Recommended path; mobile inherits the live `/search` experience for free without restyle.

---

## Claude's Discretion

- Exact pixel/Tailwind values for the nav search input (D-24): width, fill opacity, magnifier icon size, rounded radius.
- Exact copy for the All-tab coming-soon footer cards (D-06).
- Exact copy for `/search` Watches + Collections coming-soon tab states (D-08).
- The `useSearchState` hook's exact return shape (D-28).
- Whether match-highlighting (D-15) uses `<mark>`, `<strong>`, or a custom span.
- Whether the suggested-collector list uses keyset pagination (Load More) or a fixed count.
- Whether `searchProfiles` lives in `src/data/profiles.ts` or a new `src/data/search.ts` (D-19).

## Deferred Ideas

- Canonical watch DB / cross-user watch identity — prerequisite for Watches + Collections search tabs.
- Live dropdown panel under the persistent nav input — future polish phase.
- Recent searches / search history — SRCH-FUT-03.
- Trigram similarity scoring beyond ILIKE — out of scope.
- Mobile SlimTopNav restyle — separate small phase if needed.
- Global accent palette flip from warm-gold to Figma teal — Phase 14 D-05 carry-over.
- `useSearchState` hook generalization — premature until a second caller exists.

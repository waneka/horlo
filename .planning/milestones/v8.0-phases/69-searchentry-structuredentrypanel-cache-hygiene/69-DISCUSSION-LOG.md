# Phase 69: SearchEntry + StructuredEntryPanel + Cache Hygiene - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 69-searchentry-structuredentrypanel-cache-hygiene
**Areas discussed:** Typeahead a11y primitive, CLNP-07 signOut cache-clear wiring, No-match panel layout + SRCH-26 pre-seed, StructuredEntryPanel shape

---

## Typeahead a11y primitive

### Q1 — Which typeahead primitive should SearchEntry use?

| Option | Description | Selected |
|--------|-------------|----------|
| base-ui Combobox (Recommended) | `@base-ui/react/combobox` — already installed alongside accordion/drawer; provides the full WAI-ARIA combobox spec headless. | ✓ |
| Raw input + custom listbox | Mirror useSearchState.ts pattern; plain `<input>` + `<ul role="listbox">` + manual keydown. | |
| base-ui Autocomplete | `@base-ui/react/autocomplete` — narrower than Combobox (free-text-with-hints model). | |

**User's choice:** base-ui Combobox
**Notes:** Locks the WAI-ARIA contract; eliminates the custom keydown matrix Phase 68 D-04 also wrestled with.

### Q2 — How should Combobox state be wired?

| Option | Description | Selected |
|--------|-------------|----------|
| Controlled input + uncontrolled selection (Recommended) | Parent owns query; Combobox owns open/active-index; onValueChange hoists picked row. | ✓ |
| Fully controlled | Parent owns everything. | |
| Fully uncontrolled | Combobox owns everything; only onSelect surfaces upward. | |

**User's choice:** Controlled input + uncontrolled selection

### Q3 — What does picking a result emit from SearchEntry?

| Option | Description | Selected |
|--------|-------------|----------|
| onPick(result: SearchCatalogWatchResult) (Recommended) | Emit the full row; Phase 70 inspects viewerState for DUPE branching. | ✓ |
| onPick(catalogId: string) | Emit just the id; Phase 70 re-queries. | |
| Two callbacks: onPickOwned / onPickAvailable | SearchEntry branches on viewerState internally. | |

**User's choice:** onPick(result)
**Notes:** Keeps SearchEntry agnostic to DUPE; Phase 70 owns DUPE.

### Q4 — Debounce + stale-result mechanism for SearchEntry?

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror useSearchState (Recommended) | `setTimeout(250ms)` + per-effect `AbortController`. | ✓ |
| React 19 useDeferredValue | Defer input update; doesn't enforce 250ms or cancel inflight. | |
| Extract a useTypeaheadSearch hook | Wrap into a reusable hook shared with /search. | |

**User's choice:** Mirror useSearchState

### Q5 — Where does the no-match empty-state render — inside Combobox popup or outside?

| Option | Description | Selected |
|--------|-------------|----------|
| Outside the Combobox popup (Recommended) | Listbox closes; SearchEntry renders no-match panel inline below in normal document flow. | ✓ |
| Inside the popup as an empty option | Non-selectable empty row inside the listbox. | |

**User's choice:** Outside the Combobox popup

---

## CLNP-07 signOut cache-clear wiring

### Q1 — Where does the shared `lastUserId` check live?

| Option | Description | Selected |
|--------|-------------|----------|
| Each hook owns its own check (Recommended) | 4-line `if (moduleUserId !== viewerUserId) reset` block per cache; mirrors useWatchSearchVerdictCache. | ✓ |
| Shared useViewerCacheScope coordinator hook | One hook at AddWatchFlow root; risk of silent leak if call is missed. | |
| Global onAuthStateChange subscriber | `<CacheHygieneProvider>` at root; over-engineering. | |

**User's choice:** Each hook owns its own check

### Q2 — How is `viewerUserId` propagated to the caches?

| Option | Description | Selected |
|--------|-------------|----------|
| Prop-drilled from AddWatchFlow (Recommended) | Already-server-fetched viewer-id forwarded as typed prop; static. | ✓ |
| Pull via createSupabaseBrowserClient() inside each hook | Per-render network cost; conflicts with proxy-cache-poisoning lesson. | |
| Context provider over /watch/new | Only one consumer level deep — prop-drill is shorter. | |

**User's choice:** Prop-drilled from AddWatchFlow

### Q3 — How invasive should the retrofit of the two existing caches be?

| Option | Description | Selected |
|--------|-------------|----------|
| Add viewerUserId as required positional arg to both existing hooks (Recommended) | TS surfaces every caller (3 sites); closes success-criterion #5 leak in same change. | ✓ |
| Add as optional with backward-compat | Soft retrofit; tech-debt leak remains for WatchSearchRowsAccordion. | |
| Leave them alone; add the check only to the two new caches | Doesn't close the leak; non-compliant with CLNP-07 verbatim text. | |

**User's choice:** Required positional arg to both existing hooks

### Q4 — How is the cache-clear behavior tested?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-hook unit tests + AddWatchFlow integration test (Recommended) | Render under user A, set entry, re-render under user B, assert undefined; integration test on user-switch in AddWatchFlow.test.tsx. | ✓ |
| Unit tests only | Skip integration; cheaper. | |
| Add a static guard test | Grep-based; vitest_static_node_env memory bites at Vercel prebuild. | |

**User's choice:** Per-hook unit + AddWatchFlow integration

---

## No-match panel layout + SRCH-26 pre-seed

### Q1 — How should the no-match transition shape up?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline expand under the search input (Recommended) | SearchEntry stays mounted; structured panel renders inline below the input. | ✓ |
| State transition (separate panel takes over) | SearchEntry emits onNoMatch(query); Phase 70 transitions to a new FlowState kind. | |
| Side-by-side / drawer | Mobile-hostile; not the seed's direction. | |

**User's choice:** Inline expand under the search input

### Q2 — Who owns the no-match transition?

| Option | Description | Selected |
|--------|-------------|----------|
| SearchEntry renders inline; emits onSubmitStructured (Recommended) | SearchEntry mounts StructuredEntryPanel as no-match child; Phase 70 sees single callback per branch. | ✓ |
| SearchEntry emits onNoMatch(query); Phase 70 mounts panel | More flexible; expands FlowState surface. | |
| Compose externally | New `<SearchOrStructured>` wrapper; more files. | |

**User's choice:** SearchEntry renders inline + onSubmitStructured upward

### Q3 — SRCH-26 query pre-seed parser sophistication?

| Option | Description | Selected |
|--------|-------------|----------|
| Naive 3-token split (initial proposal) | Whitespace split; first/middle/last logic. | |
| Whole query → brand | Dumb default; user fixes. | |
| LLM-driven query parse pre-call | Round-trip BEFORE user sees panel; defeats EXTR-05 gate. | |
| **User answered freeform** | "Pull reference if possible from the 3 token split strategy. Can we try to match the brand on our catalog data? Do you understand what I'm asking?" | ✓ |

**User's choice:** Free-text — match brand against catalog data, then pull reference via digit-bearing token, model is whatever's left in the middle.

**Notes:** This handles the multi-word-brand case ("Tag Heuer", "A. Lange & Söhne") that a naive first-token-is-brand split breaks on. Claude proposed and confirmed: longest-prefix brand match (catalog brands sorted by length DESC) → on hit, brand = matched prefix (original case from catalog), reference = last digit-bearing token in remainder, model = middle. On miss, fall back to naive split (covers novel brands not yet in catalog). Threading: new `listCatalogBrands()` DAL fn, server-fetched at /watch/new and prop-drilled.

### Q4 — Did I capture the brand-matching parser correctly? And which fallback when no brand matches?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — fall back to naive split when no brand matches (Recommended) | Longest-prefix match first; naive split on miss. Best-of-both for novel brands. | ✓ |
| Yes — fall back to: whole query → brand | Safer (no guesses); loses novel-brand win. | |
| Yes — fall back to: leave all 3 fields blank | Pre-seed only fires on confident brand match. | |
| Yes but — fetch brands client-side instead of server-side prop | Round-trip per /watch/new visit. | |

**User's choice:** Naive-split fallback

### Q5 — How does the SRCH-24 "Not finding it?" footer relate to the no-match panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Both surfaces share one button; clicking expands the panel inline (Recommended) | Single behavior, two entry points. | ✓ |
| Footer is link; empty state is full panel | Different affordances — inconsistent. | |
| Footer always-visible at panel bottom | Two distinct DOM surfaces sharing copy. | |

**User's choice:** Shared button; same inline-expand mechanism

---

## StructuredEntryPanel shape

### Q1 — Field layout for the 4 inputs?

| Option | Description | Selected |
|--------|-------------|----------|
| 2-col responsive grid mirroring WatchForm (Recommended) | `grid grid-cols-1 gap-3 sm:grid-cols-2`; row 1 brand+model, row 2 reference+year. | ✓ |
| Stacked single column | Wastes desktop space. | |
| Brand+model row, reference+year inline below as smaller fields | Hierarchy guessing for user. | |

**User's choice:** 2-col responsive grid

### Q2 — Where does the photo affordance + URL backup link sit?

| Option | Description | Selected |
|--------|-------------|----------|
| Photo inline below fields; URL backup as ghost link below Find-specs (Recommended) | Linear top-to-bottom flow; photo always visible per EXTR-06. | ✓ |
| Photo behind 'Add a photo' reveal; URL link in panel footer | Reveal hides EXTR-06 affordance — borderline-noncompliant. | |
| Photo + URL backup in 'More options' collapsible | Over-organizes; wrong grouping. | |

**User's choice:** Photo inline; URL backup as ghost link

### Q3 — Loading state during the LLM round-trip?

| Option | Description | Selected |
|--------|-------------|----------|
| In-place: fields stay; VerdictSkeleton renders below Find-specs (Recommended) | User keeps context; matches EXTR-05 verbatim reference. | ✓ |
| Full-panel replacement | Disorienting. | |
| Inline button-only spinner | Doesn't telegraph the work; misses EXTR-05 reference. | |

**User's choice:** In-place + VerdictSkeleton

### Q4 — Cache key shape for `useStructuredExtractCache`?

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized JSON tuple (Recommended) | trim+lowercase per field; mirrors catalog DAL normalization. | ✓ |
| Raw string concat | Misses case/whitespace dupes. | |
| No cache | Burns LLM on back-button revisits. | |

**User's choice:** Normalized JSON tuple

---

## Claude's Discretion

Decisions left to Claude / planner discretion (captured in CONTEXT.md under "Claude's Discretion"):

- `useCatalogSearchCache` cache key normalization (trim+lowercase symmetric to D-18)
- Exact draft text for the structured-mode `structured-data-missing` ExtractErrorCard copy variant
- `viewerState` pill display copy ("In collection" / "On wishlist" per spec vs WatchSearchRow's "Owned"/"Wishlist")
- `@base-ui/react/combobox` slot styling tokens (UI-SPEC will lock)
- `HighlightedText` reuse against combined `${brand} ${model}` string + reference (per WatchSearchRow precedent)
- "Find specs" button styling, full-width-on-mobile vs flex-1-on-desktop split
- Photo upload + LLM call interaction sequencing (does the photo trigger photo-based enrichment immediately on upload, or only when "Find specs" fires)
- Whether the footer "Not finding it?" affordance lives inside the Combobox popup or just under it (UI-SPEC choice)
- Owners-count "0 collectors" edge copy (honest literal vs "Be the first")
- Whether `useCatalogSearchCache` cache survives across `/watch/new` page revisits via the same module-scope persistence as `useUrlExtractCache` (default: yes, mirrors precedent)

## Deferred Ideas

- Extract `useTypeaheadSearch` shared hook for `/search` reuse (future refactor)
- Brand-list staleness handling (new brands not appearing in parser until next page visit; acceptable per naive-split fallback)
- "0 collectors" copy iteration on UAT signal
- `<HorloCombobox>` wrapper if a second combobox surface lands
- ExtractErrorCard mode-branched copy text refinement on Phase 70 UAT
- Phase 70 follow-ups: wire onPick to DUPE branching, wire onSubmitStructured to ConfirmStep, wire onSwitchToUrl to URL-paste path, extend Phase 29 three-layer reset to include the two new caches (CLNP-05), "Skip search — enter manually" idle link routing to `?manual=1` (CLNP-06)
- Phase 71 follow-ups: delete `PasteSection.tsx`, `VerdictStep.tsx`, `WishlistRationalePanel.tsx` (+ test files); add static guard `tests/static/AddWatchFlow.no-paste-section.test.ts` with `// @vitest-environment node`

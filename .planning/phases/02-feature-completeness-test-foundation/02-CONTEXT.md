---
doc_type: phase-context
phase: "02"
phase_name: feature-completeness-test-foundation
gathered: 2026-04-11
status: ready-for-planning
source: discuss-phase interactive
---

# Phase 02: Feature Completeness & Test Foundation — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase` interactive session

<domain>
## Phase Boundary

Phase 2 wakes up every dead preference field in the similarity engine, turns the wishlist from a static list into an actionable decision surface, surfaces wear-pattern insights, and stands up the test foundation that later phases will build against.

**Requirement IDs in scope:** VIS-05, FEAT-01, FEAT-02, FEAT-03, FEAT-04, FEAT-05, FEAT-06, TEST-01, TEST-02, TEST-03

**Phase goal:** Stored preferences actually influence scoring, the wishlist becomes actionable, and the test runner is in place to catch regressions from the similarity rewiring.

</domain>

<decisions>
## Implementation Decisions

### Collection goals (FEAT-02)

Four goals total. Thresholds are tweaked softly — no extreme shifts. No touch to `hard-mismatch` so users can still buy occasional outliers without guilt.

| Goal | `roleConflict` | `coreFit` | `familiarTerritory` | Notes |
|---|---|---|---|---|
| `balanced` (default) | 0.70 (current) | 0.65 | 0.45 | unchanged baseline |
| `specialist` | 0.78 (+0.08) | 0.65 | 0.45 | role overlap is depth, not redundancy |
| `variety-within-theme` | 0.65 (−0.05) | 0.65 | 0.40 (−0.05) | celebrate taste-expansion copy |
| `brand-loyalist` | 0.70 | 0.65 | 0.45 | brand-aware routing (see below) |

**Reasoning-string changes per goal:**
- `specialist` — depth-positive copy when labeling owned collection ("5 divers — strong depth") and reasoning strings favor "continues the specialist path" over "similar to existing."
- `variety-within-theme` — `taste-expansion` label reframed from tentative ("adds variety while staying aligned") to affirmative ("exactly what this collection needs").
- `brand-loyalist` — on-brand watches get `role-duplicate` loosened to `0.78` dynamically (matches specialist behavior); off-brand watches get an extra reasoning line "Off-brand — breaks your {brands} pattern," score unchanged.

**Brand-loyalist inference:** detect the top 1–2 brands in the owned collection where each accounts for ≥30% of holdings. Empty collection → falls back to `balanced` behavior until a brand pattern emerges.

**Insight framing updates:** the insights page observations section picks goal-specific copy: specialist emphasizes depth, variety-within-theme emphasizes distinct roles + style cohesion, brand-loyalist emphasizes brand continuity.

**Deferred goals** (noted, not implemented):
- `heritage-only` / `vintage-era` — requires production year data; the schema change lands in this phase but the goal itself is deferred until there's enough data to be useful.
- `value-hunter` — overlaps with FEAT-03 "good deal" indicator.
- `completionist` — too niche for MVP.

### Gap-fill score (FEAT-05)

**What it measures:** coverage of the collector's self-declared scope, where scope is derived from `collectionGoal`.

**Universe by goal:**

| Goal | Tuple universe |
|---|---|
| `balanced` | Full `(styleTag × roleTag × dialColor)` |
| `specialist` | Restricted to specialty tuples only; out-of-scope watches get text label "Outside specialty" instead of a number |
| `variety-within-theme` | Restricted to role × dial combos that match the dominant design traits; theme-breakers get "Breaks theme" |
| `brand-loyalist` | Restricted to watches from loyal brands; off-brand watches get "Off-brand" |

**Scoring math:** within the selected tuple universe, `(new_tuples / total_tuples) × 100`. Normalized 0–100.
- 100 = every tuple is new (fills a totally unoccupied niche)
- 0 = all tuples already covered (pure duplicate)

**Theme / specialty detection:**
- **Specialty (for `specialist`):** dominant style tag in owned collection, defined as ≥50% of owned watches sharing it. If no style dominance, fall back to dominant role tag. If still no dominance → behave like `balanced`.
- **Theme (for `variety-within-theme`):** set of design traits shared by ≥50% of owned watches. A wishlist watch matches if it shares at least half of those traits.
- **Minimum collection size for detection:** 3 watches. Collections with fewer than 3 owned watches always use `balanced` universe regardless of goal.

**Tuple generation:** a watch with `styleTags: ['dive','sport']`, `roleTags: ['daily','travel']`, `dialColor: 'blue'` generates `2 × 2 × 1 = 4` tuples. Missing `dialColor` drops to 2-tuples (`style × role`).

**Display:**
- **Wishlist card:** top-right badge. Either `Gap 72` (numeric) or text chip `Outside specialty` / `Off-brand` / `Breaks theme`.
- **Watch detail:** callout section with score + tuple breakdown ("fills 3 new combos: dive + daily + blue, dive + travel + blue, sport + daily + blue").
- **Not shown on owned watches** — gap-fill is wishlist-only (same scoping discipline as target price).

**Edge cases:**
- Empty owned collection → any wishlist watch shows neutral "First watch" label instead of `Gap 100`.
- Owned collection with <3 watches → use `balanced` universe regardless of goal.

### Production year as Watch field

Add `productionYear?: number` to the `Watch` type (4-digit year, optional). Populated manually on the form under Specifications; extractors leave it null for now. Not yet consumed by similarity engine — this is schema groundwork for a future `heritage-era` goal without building the goal itself. Add a form field and surface it on the detail view.

### complicationExceptions (FEAT-01)

Semantics: a complication listed in `complicationExceptions` does NOT count toward the similarity overlap penalty calculation. Framing: "I'm fine owning multiple chronographs — don't penalize me for it." Applies only to the complications dimension of `calculatePairSimilarity`; other dimensions continue to contribute normally. UI copy in preferences should reinforce that framing.

### Good deal indicator + toggle (FEAT-03, FEAT-04)

- **Auto indicator (FEAT-03):** triggered when `marketPrice != null && targetPrice != null && marketPrice <= targetPrice`. No percentage buffer — at-or-below target is a deal. Renders as a subtle accent-color badge on the wishlist card.
- **Manual toggle (FEAT-04):** new field `isFlaggedDeal?: boolean` on the `Watch` type, orthogonal to the auto calc. User can pin any wishlist watch as "deal" regardless of price (e.g., a unicorn listing at retail is still a deal). Toggle lives on the watch detail view.
- **Display rule:** either `isFlaggedDeal === true` OR auto-trigger fires → card shows the "deal" badge.
- **Distinct section (FEAT-04):** a pinned "Good Deals" group on the `/insights` page listing all wishlist watches currently flagged (manual OR auto). On the collection page, when the status filter is "wishlist", good-deal items sort first.
- **Good-deal state is NOT on owned watches** — it's a wishlist-only concept; hide the toggle and badge for owned/sold statuses.

### Sleeping Beauties + days-since-worn (VIS-05)

- **Detail view:** add a "Last worn" line showing either the date + "(N days ago)" or "Not worn yet" when no wear data exists. Owned watches only.
- **Insights page:** new "Sleeping Beauties" card listing owned watches not worn in ≥30 days. Reuses the 30-day threshold already used by existing wear insights code. Fixed, not configurable — one less knob to tune in MVP.
- **Copy:** "These have been quiet for a while. Wear them or reconsider them." Soft nudging, not guilt-tripping.

### UUID migration (FEAT-06)

- **New watches:** `crypto.randomUUID()` via a single `generateId()` helper. Replace `Date.now()`-based generation everywhere.
- **Existing watches:** leave their IDs as-is. No migration. Rationale: existing IDs still work, no collision risk unless the user *batch-imports* new watches at the same millisecond, and rewriting IDs would break the watch detail URL bookmark if the user has one open. MVP tradeoff.

### MSW scope (TEST-01)

- **Phase 2:** install MSW in devDependencies (so the scaffolding exists) but do NOT wire it into any test yet. Similarity tests are pure functions; extractor tests can use fixture HTML imported directly. No network mocking needed.
- **Phase 6:** actual MSW usage lands in Phase 6 when route handler integration tests need it.

### Test coverage (TEST-02, TEST-03)

- **TEST-02 — similarity.ts:** one test file covering all six `SimilarityLabel` outputs AND preference-aware paths for each of the four `collectionGoal` values and `complicationExceptions`. Use Arrange-Act-Assert style, no mocking needed. Add fixtures for representative owned collections (empty, 1 watch, 3 watches same style, 3 watches same brand, 5 watches mixed).
- **TEST-03 — extractor pipeline:** three test files (`structured.test.ts`, `html.test.ts`, `index.test.ts`) using fixture HTML files checked into `tests/fixtures/`. Cover structured-data extraction, selector fallback, and the merge precedence rules.

### Claude's Discretion

The following are not explicit user decisions — planner chooses the approach:

- **Type definitions for gap-fill result and goal enum** — any reasonable shape that passes through the store and the display components.
- **Exact placement of the `isFlaggedDeal` toggle in the watch detail card layout** — anywhere in the actions/metadata area that respects the UI-SPEC Phase 1 pattern.
- **Test fixture owner** — if Phase 2 extractor tests need fixture HTML, they can go in `tests/fixtures/` and mirror the structure of the 3 extractor stages.
- **Migration strategy for existing owned/wishlist watches regarding new optional fields** (`productionYear`, `isFlaggedDeal`) — they default to `undefined` / `false` on existing records; no data migration needed.
- **Performance optimization for gap-fill computation** — for <500 watches, naive tuple enumeration is fine. No memoization or virtualization required.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 artifacts (foundation)
- `.planning/phases/01-visual-polish-security-hardening/01-UI-SPEC.md` — warm/brass palette, Instrument Serif display headings, monochromatic badges, semantic token discipline. Phase 2 UI must conform.
- `.planning/phases/01-visual-polish-security-hardening/01-RESEARCH.md` — Next.js 16 App Router patterns, shadcn primitive usage, Vitest + RTL setup that's already in place.

### Project context
- `.planning/PROJECT.md` — core value statement, constraints (Next.js 16, single-user MVP, <500 watches)
- `.planning/REQUIREMENTS.md` — full requirement list including VIS-05, FEAT-01..06, TEST-01..03 acceptance criteria
- `CLAUDE.md` + `AGENTS.md` — Next.js 16 is NOT the Next.js in training data; read `node_modules/next/dist/docs/` before writing framework code

### Existing code (reusable / affected)
- `src/lib/similarity.ts` — current engine; `collectionGoal` and `complicationExceptions` are the dead fields Phase 2 wires up
- `src/lib/types.ts` — `Watch`, `UserPreferences`, `SimilarityLabel`, `SimilarityResult` — all need extensions
- `src/store/watchStore.ts` — `generateId()` and `addWatch` are the FEAT-06 touchpoints
- `src/store/preferencesStore.ts` — existing shape for `complicationExceptions`, `overlapTolerance`, `collectionGoal`
- `src/app/insights/page.tsx` — where "Sleeping Beauties" and "Good Deals" sections land
- `src/components/watch/WatchCard.tsx` — gap-fill badge and good-deal badge display surface
- `src/components/watch/WatchDetail.tsx` — last-worn line, flagged-deal toggle, gap-fill breakdown callout
- `src/components/watch/WatchForm.tsx` — production year input (Specifications card), status-aware target price (already done in Phase 1 polish commit)

### Test infrastructure (from Phase 1)
- `vitest.config.ts` + `tests/setup.ts` — already configured with jsdom, RTL, jest-dom matchers
- `tests/no-raw-palette.test.ts` — existing invariant; Phase 2 new components must pass this

</canonical_refs>

<specifics>
## Specific Ideas

- **Four collection goals:** `balanced`, `specialist`, `variety-within-theme`, `brand-loyalist`
- **Threshold tweaks must be soft** — no extreme shifts; user explicitly called this out
- **Reasoning strings carry the personality** — the goal mostly shapes copy, not hard label boundaries
- **Gap-fill uses 3-tuple coverage** — `(styleTag × roleTag × dialColor)`, not per-dimension averages
- **Gap-fill universe is goal-dependent** — specialists see gaps only within their specialty; the same watch can score differently under different goals
- **Minimum 3 watches for theme/specialty detection** — below that, fall back to `balanced`
- **≥50% dominance for specialty/theme detection** — can tune later
- **`isFlaggedDeal` is a stored field**, not derived — gives the user a manual override for non-price-based "deals"
- **Sleeping Beauties reuses 30-day threshold** — don't add a preference knob
- **Production year** is a new optional `Watch` field added now for future use; does NOT feed similarity yet
- **MSW installed but unused in Phase 2** — scaffold now, wire up in Phase 6

</specifics>

<deferred>
## Deferred Ideas

- **`heritage-only` / `vintage-era` collection goal** — schema prep (productionYear field) lands in Phase 2, but the goal itself waits for enough data and user demand
- **`value-hunter` collection goal** — FEAT-03 covers the core behavior; a dedicated goal is over-engineering
- **`completionist` collection goal** — too niche (collect every Speedmaster ref); could be a filter, not a goal
- **Configurable Sleeping Beauties threshold** — fixed at 30 days for MVP
- **Gap-fill memoization** — not needed at <500 watches
- **UUID migration for existing watches** — leave them alone; Date.now() IDs still work
- **MSW network mocking in tests** — defer actual usage to Phase 6 integration tests

</deferred>

---

*Phase: 02-feature-completeness-test-foundation*
*Context gathered: 2026-04-11 via `/gsd-discuss-phase` interactive session*

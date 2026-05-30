# Phase 72: Search Composition Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 72-search-composition-fixes
**Areas discussed:** SRCH-01 catalog-cleanup scope, SRCH-01 DAL primitive, SRCH-02 keyboard contract scope, SRCH-02 root-cause method, SRCH-03 footer placement, regression test level

---

## SRCH-01 catalog-cleanup scope

| Option | Description | Selected |
|--------|-------------|----------|
| DAL fix only — no catalog edits | Phase 72 ships only the token-AND DAL change. The "TIMEX Weekender 38mm Fabric Strap Watch" row stays as-is; users see the noisy model field in results until a future catalog hygiene pass. | ✓ |
| DAL fix + ad-hoc cleanup of flagged rows | Phase 72 ships the DAL fix AND opportunistically cleans up the specific rows flagged in UAT. Scope is just the rows named — not a sweep. | |
| DAL fix + defer cleanup to a future catalog hygiene phase | Phase 72 ships only the DAL fix. Capture catalog noise as a deferred item for a future phase or SEED-009. | |

**User's choice:** DAL fix only — no catalog edits.
**Notes:** Token-AND DAL fix renders the cleanup orthogonal because "Timex Weekender" already substring-hits the noisy row. Captured in CONTEXT.md D-01.

---

## SRCH-01 DAL primitive

| Option | Description | Selected |
|--------|-------------|----------|
| Tokenize + AND-of-ORs over ILIKE | Drop-in v8.1-sized fix. Split q on whitespace; each token must hit brand OR model OR reference ILIKE. No migration, no new index, preserves exact-ref + popularity ranking tiers. | ✓ |
| Postgres tsvector + GIN now | Adds GENERATED STORED tsvector column + GIN index + websearch_to_tsquery; migrates BOTH DAL functions so they don't drift. Phase grows to ~3 plans. | |
| Planner picks after research | Lock the BEHAVIOR (token-AND across the 3 normalized columns); let the planner choose primitive after reading catalog row count + index footprint. | |

**User's choice:** Tokenize + AND-of-ORs over ILIKE (Recommended) — after asking for more detail on the Postgres option.
**Notes:** Provided detailed comparison covering tsvector mechanics, migration cost on both DBs per `db_wipeable_2026_05_09`, two-DAL-drift concern, stemmer trap (`english` vs `simple`), and Phase 17/19.5 architecture-shift framing. User confirmed v8.1 stays subtraction-of-defects; tsvector deferred to SEED-009 Catalog Expansion. Captured in CONTEXT.md D-02 with explicit rejection rationale.

---

## SRCH-02 keyboard contract scope

| Option | Description | Selected |
|--------|-------------|----------|
| Success-criterion minimum | Up/Down arrows move active option, Enter fires onPick, Tab/Escape exit popup cleanly (SC#2 + SC#4 verbatim). Whatever base-ui ships for free stays for free, untested. | ✓ |
| Full WAI-ARIA combobox contract | Adds Home/End, PageUp/PageDown, typeahead-first-letter, and explicit tests for each. More test surface; same fix code. | |
| Minimum + explicit Home/End tests only | Skip PageUp/PageDown + typeahead but add Home/End coverage. | |

**User's choice:** Success-criterion minimum (Recommended).
**Notes:** v8.1 is subtraction-of-defects; expanding to full WAI-ARIA contract would scope-creep. Captured in CONTEXT.md D-05.

---

## SRCH-02 root-cause method

| Option | Description | Selected |
|--------|-------------|----------|
| Research base-ui docs first, then fix | Planner reads node_modules/@base-ui/react/combobox docs + v1.3.0 changelog before changing code. Single targeted fix. | ✓ |
| Spike a minimal reproduction first | Planner builds a throwaway minimal Combobox to isolate the composition flaw. Most certainty, slowest. | |
| Strip to known-working composition, then add back | Planner reverts SearchEntry.tsx to canonical example; layers Horlo's customizations back one at a time to bisect. | |

**User's choice:** Research base-ui docs first, then fix (Recommended).
**Notes:** Composition LOOKS correct on paper; guess-and-revert would waste context. Aligns with AGENTS.md "read node_modules/next/dist/docs before writing code" applied to base-ui. Captured in CONTEXT.md D-06 + D-07 with rank-ordered likely suspects (object-valued value comparator, controlled-open active-index, itemToStringValue mismatch).

---

## SRCH-03 footer placement

| Option | Description | Selected |
|--------|-------------|----------|
| Outside Combobox.List, inside Combobox.Popup | Footer is a sibling of Combobox.List inside the same Popup. Popup positions it visually; listbox doesn't intercept clicks. Minimal CSS change. | ✓ |
| Outside the popup entirely, below the input | Footer renders in normal document flow alongside the empty-state StructuredEntryPanel mount point. Most consistent with D-05 "empty state OUTSIDE popup" decision. | |
| Combobox.Item with a 'manual' sentinel | Footer becomes a special Combobox.Item with MANUAL_SENTINEL value. Gets keyboard navigability for free; more invasive to onPick type contract. | |

**User's choice:** Outside Combobox.List, inside Combobox.Popup.
**Notes:** Closest to today's visual; keeps the "this row is part of the results menu" mental model. Captured in CONTEXT.md D-08; sentinel approach explicitly rejected to keep types narrow.

---

## Regression test level

| Option | Description | Selected |
|--------|-------------|----------|
| Per-defect tests at the most natural level | Vitest DAL unit for SRCH-01, RTL keyboard test for SRCH-02, RTL footer-click test for SRCH-03. 3 small additions. | ✓ |
| Roll into one integration test | Single end-to-end test typing multi-token query, navigating with keyboard, picking via Enter, then no-match + footer click. One scenario per phase; couples three independent regression surfaces. | |
| Skip regression tests; replay Phase 70 UAT on prod | Lean on user prod UAT walk. Violates v8.1 milestone constraint "each phase ships its own targeted regression test alongside the fix." | |

**User's choice:** Per-defect tests at the most natural level (Recommended).
**Notes:** Aligns with v8.1 milestone constraint; each fix gets a targeted guard. Captured in CONTEXT.md D-11 + D-12 (no new test-runner config; jsdom default + node pragma discipline preserved).

---

## Claude's Discretion

- `searchCatalogForAddFlow` early-return on empty token list (defensive vs upstream-only)
- Per-token pattern variable naming (`tokenPatterns: string[]` vs inline)
- Specific `Combobox.Item` value-shape fix (depends on base-ui docs research outcome)
- Footer button styling after relocation (top spacing adjustment; font-semibold guardrail preserved)
- DAL test seed strategy (existing catalog seed vs ad-hoc rows in beforeEach)
- base-ui docs verification command shape (planner picks the first investigation step)

## Deferred Ideas

- Catalog row cleanup sweep — `"TIMEX Weekender 38mm Fabric Strap Watch"` and similar noisy rows. Candidate home: SEED-009 Catalog Expansion or a small v8.2 polish.
- Postgres tsvector + GIN migration for catalog search — right architecture at SEED-009 scale + UX maturity.
- `/search` page DAL (`searchCatalogWatches`) multi-token parity — if user UAT surfaces the same symptom there, fold into a future phase.
- SRCH-02 full WAI-ARIA combobox contract — Home/End/PageUp/PageDown + typeahead first-letter tests.
- SRCH-03 keyboard-nav reach for the footer — would require Combobox.Item sentinel approach (rejected here to keep types narrow).
- Shared `tokenizeSearchQuery(q)` helper — premature with one consumer.
- `useTypeaheadSearch(query, action)` shared hook (carried forward from Phase 69 deferred).

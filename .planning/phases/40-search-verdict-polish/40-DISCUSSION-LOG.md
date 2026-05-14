# Phase 40: Search & Verdict Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 40-search-verdict-polish
**Areas discussed:** Facet URL contract + interaction with q; Case Size buckets + Style vocab source; Mobile bottom-sheet UX placement; FIT-05 drill-down trigger + taste dimensions shown

---

## Area 1 — Facet URL contract + interaction with `q`

### Q1.1 — Browse mode (can facets work without q?)

| Option | Description | Selected |
|--------|-------------|----------|
| Facets work alone — browse mode (Recommended) | User can apply facets with empty q; lifts the 2-char DAL gate when ≥1 facet active. | ✓ |
| Facets only refine an existing q ≥ 2 chars | Facets hidden / disabled until query typed. Simpler DAL. | |
| Facets always visible but inactive without q | Chips render but no effect — worst of both. | |

**User's choice:** Facets work alone — browse mode.
**Notes:** Captured as D-01.

### Q1.2 — Facet vs `q` debounce

| Option | Description | Selected |
|--------|-------------|----------|
| Facets fire instantly, no debounce (Recommended) | Chip click → immediate URL update + fetch. Separate from q's 250ms debounce. | ✓ |
| Share q's 250ms debounce | Facet change debounces before fetching. | |
| Hybrid (first instant, rapid follow-ups coalesce) | Adds state-machine complexity. | |

**User's choice:** Facets fire instantly, no debounce.
**Notes:** Captured as D-02.

### Q1.3 — URL parameter shape

| Option | Description | Selected |
|--------|-------------|----------|
| Separate params, comma-joined for multi (Recommended) | `?q=sub&movement=auto&size=40-42&style=tool,diver`. Human-readable, shareable. | ✓ |
| Separate params, repeated keys for multi | `?style=tool&style=diver`. HTML form convention. | |
| Single encoded blob (?f=base64) | Opaque; worst for sharing/debugging. | |

**User's choice:** Separate params, comma-joined for multi.
**Notes:** Captured as D-03.

### Q1.4 — Tab scope

| Option | Description | Selected |
|--------|-------------|----------|
| Watches tab only (Recommended) | Facets hidden on People/Collections/All; URL params survive tab switches. | ✓ |
| Watches tab + All tab Watches section | Adds an additional render site + DAL pathway. | |
| Watches tab; All-tab Watches section ignores facets | Inconsistent if user just set filters. | |

**User's choice:** Watches tab only.
**Notes:** Captured as D-04.

---

## Area 2 — Case Size buckets + Style vocab source

### Q2.1 — Case Size facet shape

| Option | Description | Selected |
|--------|-------------|----------|
| 5 chip bands: <36 / 36-39 / 40-42 / 43-45 / 46+ (Recommended) | Pre-defined buckets; chip group; ROADMAP-faithful. | ✓ |
| 3 coarser chips: Small / Mid / Large | Fewer chips, less precision. | |
| Numeric range slider | More precise but deviates from ROADMAP "chip group"; conflicts noted with REQUIREMENTS.md. | |
| Hybrid: chips by default, range expander toggle | More UI surface. | |

**User's choice:** 5 chip bands.
**Notes:** Captured as D-05. CONTEXT.md flags the REQUIREMENTS.md contradiction ("numeric range slider") for follow-up edit.

### Q2.2 — Style chip vocab source

| Option | Description | Selected |
|--------|-------------|----------|
| Top-N by frequency in watches_catalog.style_tags (Recommended) | DISTINCT + count DESC; no dead chips. | ✓ |
| Full project STYLE_TAGS constant | All ~15-20 tags as chips, alphabetical; risk of dead chips. | |
| Only style_tags present on ≥1 catalog row | Every chip returns ≥1 result; no top-N choice complexity. | |

**User's choice:** Top-N by frequency.
**Notes:** Captured as D-06.

### Q2.3 — Style multi-select logic

| Option | Description | Selected |
|--------|-------------|----------|
| OR-logic — any selected tag matches (Recommended) | tool + diver → tagged with either. Standard faceted-search idiom. | ✓ |
| AND-logic — all selected tags must match | Narrower; risk of empty results after adding 2nd chip. | |
| OR within facet, AND across facets | Same as A but explicit. | |

**User's choice:** OR-logic.
**Notes:** Captured as D-07. Implementation note: Postgres `&&` overlap operator on style_tags array.

### Q2.4 — Null-row handling

| Option | Description | Selected |
|--------|-------------|----------|
| Excluded when facet is active (Recommended) | DAL adds `IS NOT NULL` predicates to each active facet. Honest about data quality. | ✓ |
| Included with soft "Unknown" chip | Surfaces incomplete catalog data; complicates UI. | |
| Included silently regardless of facet state | Breaks user trust in the filter. | |

**User's choice:** Excluded when facet is active.
**Notes:** Captured as D-08.

### Q2.5 — Top-N count for Style chips

| Option | Description | Selected |
|--------|-------------|----------|
| Top 8, no overflow expander (Recommended) | Fits 4x2 grid on mobile; simplest. | ✓ |
| Top 6 + "More" expander | Adds extra interaction + state. | |
| Top 12, horizontal scroll on mobile | Conflicts with Phase 27 horizontal-scroll lock-down. | |

**User's choice:** Top 8, no overflow expander.
**Notes:** Captured as D-06 (count specified).

---

## Area 3 — Mobile bottom-sheet UX placement

### Q3.1 — Filter trigger placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline button above results, active-count badge (Recommended) | Scrolls with page; matches /search vertical rhythm. | ✓ |
| Sticky-top below tabs, hides on scroll | Adds sticky-stacking complexity. | |
| Floating action button bottom-right | Conflicts with mobile BottomNav.tsx. | |
| Active facets as inline removable chips + small "+ Filter" icon | More transparent but more UI surface. | |

**User's choice:** Inline button above results, active-count badge.
**Notes:** Captured as D-09.

### Q3.2 — Desktop facet render pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Same bottom-sheet on all widths (Recommended) | Single component, single interaction model. | ✓ |
| Inline chip groups on desktop, sheet on mobile | Two render paths, more responsive testing. | |
| Right-side drawer on desktop, bottom on mobile | Adds responsive branching. | |

**User's choice:** Same bottom-sheet on all widths.
**Notes:** Captured as D-10. Avoids responsive-branch complexity.

### Q3.3 — Sheet commit semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Commit on chip-tap, no Apply button (Recommended) | Tap → URL → fetch behind sheet. Matches D-02 fire-instantly. | ✓ |
| Staged in sheet, commit on Apply | Breaks fire-instantly contract; adds extra tap. | |
| Hybrid: live preview count + Apply commits | Two separate fetches; max complexity. | |

**User's choice:** Commit on chip-tap, no Apply button.
**Notes:** Captured as D-11. Footer has only Clear-all + drag-handle close.

---

## Area 4 — FIT-05 drill-down trigger + taste dimensions shown

### Q4.1 — Drill-down placement

| Option | Description | Selected |
|--------|-------------|----------|
| Always-visible section below mostSimilar (Recommended) | Auto-targets top-1 mostSimilar; no accordion. Simplest. | ✓ |
| Accordion expand per mostSimilar row | Conflicts with Phase 39 D-07 <Link> wrap. | |
| Top-level accordion section, default-collapsed | Compact; matches FIT-04 WatchSearchRowsAccordion idiom. | |
| Top-level accordion with picker to swap compared watch | More control but more UI surface. | |

**User's choice:** Always-visible section below mostSimilar.
**Notes:** Captured as D-12. Auto-targets `verdict.mostSimilar[0]`.

### Q4.2 — Compare table dimensions

| Option | Description | Selected |
|--------|-------------|----------|
| 6 CAT-13 taste fields only (Recommended) | Pure taste view; matches ROADMAP "only taste-relevant dimensions". | ✓ |
| CAT-13 + 3 spec rows (case size, movement, dial color) | Drifts from "taste-relevant" framing. | |
| CAT-13 + style_tags + role_tags as chip clusters | Most info-dense; risks reverting to "all 20+ columns". | |
| Curated 4 (archetype + era + combined positioning + motifs) | Tightest visual; needs UI-SPEC to define combined row. | |

**User's choice:** 6 CAT-13 taste fields only.
**Notes:** Captured as D-14.

### Q4.3 — Delta row content

| Option | Description | Selected |
|--------|-------------|----------|
| Single highest-delta dimension, plain-language phrase (Recommended) | One readable phrase; verdict-voice. | ✓ |
| Top 2-3 deltas as ranked bullet list | Verges on stats-dashboard tone. | |
| Fixed template: "[Reference] is more {dim} than your {OwnedWatch}" | Fights with categorical (archetype) differences. | |
| Symmetric: one line per non-trivial delta, max 3 | Hybrid of A + B. | |

**User's choice:** Single highest-delta dimension.
**Notes:** Captured as D-16 with full algorithm (scalar |delta|, categorical 0/1, motifs jaccard, "Very similar" fallback when all deltas trivial).

### Q4.4 — Confidence gate

| Option | Description | Selected |
|--------|-------------|----------|
| Hide entire drill-down section (Recommended) | Module-absent-not-empty; matches project-wide 0.5 floor. | ✓ |
| Render with "Insufficient taste data" message | Feels like dead-end mid-investigation. | |
| Fall back to visible specs when taste missing | Breaks "taste-relevant dimensions only" invariant. | |

**User's choice:** Hide entire drill-down section.
**Notes:** Captured as D-15. Other CollectionFitCard sections (headline, mostSimilar, role overlap) still render.

---

## Claude's Discretion

- Sheet internal layout (chip group arrangement)
- Top-N caching strategy for style vocab query
- FIT-05 column header voice
- Delta row scalar threshold (0.1 suggested; planner may calibrate against catalog data)
- Case Size band labels in chip UI (mm formatting; en-dash vs hyphen)

## Deferred Ideas

- Range slider variant of Case Size
- Filter on People + Collections + All tabs
- Apply button + staged preview count inside sheet
- Picker to swap which owned watch is compared in FIT-05
- Spec rows in FIT-05 compare table (case size, movement, dial color)
- NSV-41 — Search inline-expand fresh-account verdict reshape
- Active facet chip strip above results (alternative to simple Filter button)
- Sticky filter button on scroll
- Right-side drawer on desktop

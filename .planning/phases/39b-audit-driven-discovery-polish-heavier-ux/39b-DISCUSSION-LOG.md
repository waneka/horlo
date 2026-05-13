# Phase 39b: Audit-Driven Discovery Polish — Heavier UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 39b-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 39b-Audit-Driven Discovery Polish — Heavier UX
**Areas discussed:** NSV-18 roster shape, NSV-14 sub-cluster details, Lineage rail specifics, Curation seed list authoring

> **Note:** The Phase 39 discuss-phase (2026-05-12, captured in `39-CONTEXT.md`) already locked the major Phase 39b decisions D-39b-01 through D-39b-08 (ReferenceIdentityCard content/gate/placement, lineage rails inline-only, hide-if-empty pattern, operator-curation seed pass). This log captures only the refinement decisions (D-39b-09 through D-39b-20) made during this follow-up discussion.

---

## NSV-18 catalog other-owners roster

### Q1 — Roster size

| Option | Description | Selected |
|--------|-------------|----------|
| Top 5, no pagination | Up to 5 collectors, count label when total > 5. Cheapest query; matches PopularCollectors ceiling. | ✓ |
| Top 3, no pagination | Smaller footprint. Less Rdio drift utility. | |
| Top 10 with "See all" link | Adds /catalog/{id}/owners sub-route or modal. New surface beyond 39-CONTEXT.md scope. | |
| Top N tied to viewport | 3 mobile / 5 desktop. Adds responsive logic; harder to test. | |

**User's choice:** Top 5, no pagination (Recommended).

### Q2 — Roster sort

| Option | Description | Selected |
|--------|-------------|----------|
| Most-recent-added | ORDER BY watches.created_at DESC. Liveness signal; lowest aggregation cost. | ✓ |
| Collector-influence (follower count) | ORDER BY profile.follower_count DESC. Surfaces "authoritative" owners but risks same-collectors-everywhere. | |
| Alphabetical | Deterministic; boring as discovery. | |
| Random (re-roll per request) | Mixes each visit; fights cacheability. | |

**User's choice:** Most-recent-added (Recommended).

### Q3 — Roster layout

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal avatar+name chip row | Inline scrollable row, reuses /explore PopularCollectors vocabulary. Click → /u/{username}/collection. | ✓ |
| Vertical row list (FollowerListCard pattern) | Stacked rows with follow button. Heavier UI; encourages following from /catalog. | |
| Avatar-only grid (no names) | Compact; least scannable. | |
| Single line "@a, @b, @c +N others" | Inline text. Cheapest; weakest visual identity. | |

**User's choice:** Horizontal avatar+name chip row (Recommended).

---

## NSV-14 sub-cluster details

### Q1 — LockedTabCard Connect/Follow CTA

| Option | Description | Selected |
|--------|-------------|----------|
| Inline FollowButton + "Follow to unlock" caption | Reuses FollowButton; unauthenticated → "Sign in to follow" → /signin?returnTo. | ✓ |
| Single "View their profile" link → /u/{username} | Cheapest CTA; walk-back only; doesn't enable follow inline. | |
| Two CTAs: "Follow" + "Back to home" | Dual affordance; adds visual weight to calm dead-end fix. | |
| Engagement copy variant: "Connect to see their {label}" | New verb (connect) not seen elsewhere in Horlo. | |

**User's choice:** Inline FollowButton + "Follow to unlock" caption (Recommended).

### Q2 — WornCalendar day-cell onClick destination

| Option | Description | Selected |
|--------|-------------|----------|
| Below-calendar wear-detail panel | selectedDate state; panel renders below grid. No new route. First-day-with-events selected on mount. | ✓ |
| Modal/sheet overlay | Heavier UI; modal pattern not used elsewhere on profile surfaces. | |
| Link to /u/{username}/worn?date=YYYY-MM-DD | URL round-trip (shareable); worn tab needs filtered list view. | |
| New route /u/{username}/worn/{date} | Dedicated wear-detail page. Heaviest; not scoped in 39-CONTEXT.md. | |

**User's choice:** Below-calendar wear-detail panel (Recommended).

### Q3 — StatsTabContent Link wraps

| Option | Description | Selected |
|--------|-------------|----------|
| Most/Least Worn list rows only | Wrap WornList <li> with <Link>. Style/Role bars stay non-clickable (multi-watch aggregates). | ✓ |
| Most/Least Worn rows + Style/Role bars filter /search | Wraps WornList items + HorizontalBarChart bars → /search?style. Extends scope; SRCH-16 ships in Phase 40. | |
| Whole StatsCard wraps | Over-wraps cards with mixed aggregates. | |

**User's choice:** Most/Least Worn list rows only (Recommended).

---

## Lineage rail specifics

### Q1 — "Same family" rail sort heuristic

| Option | Description | Selected |
|--------|-------------|----------|
| Collector-popularity | ORDER BY COUNT(ownership) DESC, alphabetical tiebreaker. Highest Rdio drift utility. | ✓ |
| Catalog-id order (insertion order) | Cheapest deterministic; boring discovery. | |
| Alphabetical (brand + model) | Predictable; lowest discovery utility. | |
| Era (oldest first) | Hierarchy story; weird when era null/repeated. | |

**User's choice:** Collector-popularity (Recommended).

### Q2 — Lineage relationship_type display labels

| Option | Description | Selected |
|--------|-------------|----------|
| Directional labels | predecessor→Predecessor, successor→Successor, remake→Modern remake, tribute→Tribute to, homage→Homage to. Most semantically distinct. | ✓ |
| Verbose phrasing | "Came before this" / "Came after this" / "Modern remake of this" / "A tribute to this" / "An homage to this". Wraps awkwardly on mobile. | |
| Collapsed by family only | One "Lineage" header, no per-edge labels. Loses semantic distinction. | |
| Symbol prefixes | ←/→/↻/✱/⋯. Requires legend; a11y risk for screen readers. | |

**User's choice:** Directional labels (Recommended).

### Q3 — Card count cap per rail

| Option | Description | Selected |
|--------|-------------|----------|
| 6 cards per rail, scrollable on overflow | Hard cap 6 + "See all in family" link (disabled/hidden in 39b). Matches /explore conventions. | ✓ |
| 4 cards per rail, no overflow link | Tighter; less drift surface. | |
| Unlimited (scroll for all) | Performance risk; overwhelming card-wall. | |

**User's choice:** 6 cards per rail, scrollable horizontally on overflow (Recommended).

---

## Curation seed list authoring

### Q1 — Author timing

| Option | Description | Selected |
|--------|-------------|----------|
| Operator authors during plan execution | Planner ships scripts/seed-lineage.ts with TODO scaffold; operator writes values when curation plan runs. CONTEXT.md captures category guidance. | ✓ |
| Author inline in CONTEXT.md now | Discuss-phase locks all values; planner ships curation plan autonomously. Long discuss-phase. | |
| Author into separate seed-data JSON file now | Splits curation data from prose. Same authoring burden as inline. | |
| Defer curation plan to post-39b sidecar phase | Phase 39b ships rails + script scaffold only. Risks rails empty in prod if sidecar slips. | |

**User's choice:** Operator authors during plan execution (Recommended).

### Q2 — Curation plan scheduling

| Option | Description | Selected |
|--------|-------------|----------|
| Wave 0 — ships first, before UI plans | Curation commits ~20 families + ~15 edges to prod first. UI plans then ship against populated rails. Prod-deploy checkpoint at Wave 0 end. | ✓ |
| Wave 2 — ships after UI rails | UI rails ship first, mostly empty; rails look broken on staging until curation runs. Risks operator forgetting to run curation. | |
| Sidecar plan — no wave gating | autonomous: false; operator schedules independently. Most flexible; risks ordering drift. | |

**User's choice:** Wave 0 — ships first, before UI plans (Recommended).

### Q3 — Seed script idempotency contract

| Option | Description | Selected |
|--------|-------------|----------|
| Idempotent | UPDATE WHERE family_id IS NULL + INSERT ON CONFLICT DO NOTHING. Operator can re-run safely. Matches Phase 34 pattern. | ✓ |
| Strict mode — fail on conflict | Errors on any pre-existing state. Operator-hostile after partial commits. | |
| Overwrite-on-conflict | UPDATE family_id even if set; ON CONFLICT DO UPDATE for edges. Risks overwriting human edits. | |

**User's choice:** Idempotent (Recommended).

---

## Claude's Discretion

- **ReferenceIdentityCard visual treatment** — sparkline-pill vs horizontal bar vs concentric dot for the three numeric scales. UI-SPEC for Phase 39b shapes this; design tokens already exist in the project. Planner / UI-researcher picks the cleanest interpretation of D-39b-02.
- **Import-boundary static guard for ReferenceIdentityCard** — defensible either direction. Planner discretion whether to add `tests/static/ReferenceIdentityCard.no-engine.test.ts` analog.
- **Plan packaging / wave structure beyond Wave 0** — Wave 0 is locked as the curation plan (D-39b-19). Wave 1 packaging is planner discretion: likely 4 UI plans but may consolidate where files don't conflict.
- **WornCalendar wear-detail panel content density** — exact fields surfaced in the below-calendar panel. Minimum: watch image + brand + model + notes.
- **NSV-18 chip styling** — pill vs circular avatar, exact font weight, hover/focus treatment. UI-SPEC owns this; reuse /explore PopularCollectors vocabulary as starting point.
- **ReferenceIdentityCard fallback caption copy** — when card is suppressed below the 0.5 confidence gate, optional one-line caption like "Add a few watches to see how this one fits." Planner / UI-SPEC discretion on copy.

---

## Deferred Ideas

- **`/family/{familyId}` dedicated page** — deferred to v5.x or absorbed by SEED-008 v5.1 Browse the Catalog module. D-39b-17 hides the "See all in family" link in 39b.
- **`/catalog/{id}` explicit predecessor/successor chain visualization** — v5.x polish.
- **Admin UI for lineage edge curation** — 39b uses operator script only.
- **NSV-41 search inline-expand fresh-account verdict** — Phase 33b partial med; ReferenceIdentityCard COULD be reused later if leverage rerates.
- **All 21 med/low-leverage Phase 33b cells** — DEFERRED to v5.x per Phase 33b Q3.
- **WishlistRail drag-handle silent no-op (DISC-AUDIT-99)** — own bugfix ticket per Phase 33b A2.
- **Confidence numeric percentage display** — D-39b-02 explicitly chose no numeric percentage.
- **Style/Role HorizontalBarChart bar Link wraps** — excluded by D-39b-14; would require SRCH-16 from Phase 40.
- **WornCalendar day-cell modal/sheet overlay** — modal pattern not used on profile surfaces.
- **Roster pagination / "See all owners" sub-route** — hard-capped at top 5 in D-39b-09; could land in v5.x if real-world rosters exceed 5 frequently.

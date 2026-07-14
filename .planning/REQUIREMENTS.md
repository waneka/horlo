# Requirements: Horlo — v9.0 Collection Lifecycle & Wear Depth

**Defined:** 2026-07-14
**Milestone:** v9.0 Collection Lifecycle & Wear Depth
**Core Value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.

**Milestone goal:** Deepen what a collector can do with the watches they already own — richer wear history, persistent ordering, and honest lifecycle tracking (including watches they've parted with).

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### POLISH

Small UX cleanups that unblock the pile with low risk. Ships first.

- [x] **POLISH-01**: User no longer sees a `+` add-watch button in the desktop top nav.
- [ ] **POLISH-02**: User selecting the "log a wear" watch dropdown on the Worn tab sees only currently-owned watches (not wishlist, not previously-owned).
- [ ] **POLISH-03**: User removing a watch from wishlist sees "Remove from wishlist" copy on the action affordance and confirmation prompt, not "Delete."

### WEAR

Depth on the wear-history surface — link into existing per-wear detail, backfill missed dates, and roll wear counts up across the collection.

- [ ] **WEAR-01**: User can tap any entry in the Worn tab to open that wear's `/wear/[id]` detail page (route already exists from v6.0 Phase 56A).
- [ ] **WEAR-02**: User can log a wear on a past date without providing a photo, via a backfill affordance on the Worn tab.
- [ ] **WEAR-03**: User sees a wear-count aggregate section on the Worn tab with a segmented time-window control (1 mo / 3 mo / 6 mo / 12 mo / All time).
- [ ] **WEAR-04**: User sees a leaderboard of their owned watches ranked by wear count within the selected time window.

### LIFE

Collection lifecycle — the wishlist→owned promotion moment, honest tracking of watches that have left the collection, and preserving that history as data (sell price, reason, date) without polluting active views or the recommender.

- [ ] **LIFE-01**: A watch can carry a `previously_owned` `WatchStatus` value in addition to `owned` and `wishlist`.
- [ ] **LIFE-02**: A previously-owned watch stores an optional `disposal_reason` (`sold` | `lost` | `gifted` | `stolen` | `traded`), `sell_price`, and `disposal_date`.
- [ ] **LIFE-03**: User can mark an owned watch as previously-owned from its collection card, capturing the disposal reason plus optional sell price and disposal date.
- [ ] **LIFE-04**: User promoting a wishlist watch to owned sees a celebration moment distinguishing the promotion from a normal edit.
- [ ] **LIFE-05**: User sees a "Show previously owned" toggle on the Collection view; previously-owned watches are hidden by default.
- [ ] **LIFE-06**: Previously-owned watches are excluded from similarity insights and the recommender.

### REORDER

Explicit drag-and-drop reorder mode — fixes the mobile long-press-vs-link conflict by making DnD opt-in, and gives each tab its own persistent order.

- [ ] **REORDER-01**: User can enter a "Reorder" mode on the Collection grid that opts into drag-and-drop reordering.
- [ ] **REORDER-02**: User can enter the same "Reorder" mode on the Wishlist grid, with an order independent of Collection.
- [ ] **REORDER-03**: A user-chosen order persists per tab and applies as the default sort on subsequent loads.
- [ ] **REORDER-04**: The "Reorder" mode entry point is a visible on-screen affordance (not gesture-only), fixing the mobile long-press vs. link-menu conflict.

## v2 Requirements

Deferred beyond v9.0.

### Wear analytics depth

- **WEAR-V2-01**: Per-watch wear-count stats on the watch detail page (v9.0 keeps aggregates on the Worn tab only).
- **WEAR-V2-02**: Streak / cadence stats (e.g. "worn every Monday for 3 weeks").

### Lifecycle depth

- **LIFE-V2-01**: Multi-currency handling on `sell_price` (v9.0 stores single-currency numeric).
- **LIFE-V2-02**: Aggregate "previously owned" analytics (total sold value, average hold time, etc.).
- **LIFE-V2-03**: Bring-back-into-collection flow (previously-owned → owned again).

### Reorder depth

- **REORDER-V2-01**: Custom sorts per view (e.g. reorder inside filter subsets).
- **REORDER-V2-02**: Sub-collections / folders (explicitly out of scope for v9.0 per DnD scope decision — but a real future direction).

## Out of Scope

Explicit exclusions. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Sub-collections / folders / tags | DnD scope locked to reordering only for v9.0 (kickoff decision) — folders are a much larger schema + UI surface, deferred to v9.x+. |
| Distinct per-disposal-type `WatchStatus` values (e.g. `sold`, `gifted`, `stolen` as separate enum values) | Locked to single `previously_owned` + `disposal_reason` sub-enum for cleaner filters and simpler insights code (kickoff decision). |
| Per-watch wear counts on the detail page | v9.0 aggregates live on the Worn tab as an across-collection view; per-watch views deferred to v9.x. |
| Multi-currency `sell_price` | Single-currency numeric for v9.0; multi-currency is orthogonal to lifecycle. |
| v8.4 Phase 82 skip-search BrandPicker bypass (SEED-018 D-19 CLNP-06) | Not thematically part of v9.0; stays in STATE.md Deferred Items for a future polish milestone. |
| SEED-009 v9.0 Catalog Expansion | Preempted by this milestone (2026-07-13 decision). The ~205-row catalog on v8.4's canonical foundation is fine; volume work will resume when it actually pinches. |
| New wear-detail route | `/wear/[id]` already exists (v6.0 Phase 56A); WEAR-01 wires the Worn tab into it, no new route. |
| Bring-back-into-collection flow (previously-owned → owned) | Deferred to v2 (`LIFE-V2-03`); v9.0 disposal is one-way. |
| Photo capture for backfilled past-date wears | WEAR-02 is intentionally photo-less — backfill is "I forgot to log this" scope. Photo capture stays on the same-day WYWT path. |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| POLISH-01 | Phase 83 | Complete |
| POLISH-02 | Phase 83 | Pending |
| POLISH-03 | Phase 83 | Pending |
| WEAR-01 | Phase 84 | Pending |
| WEAR-02 | Phase 84 | Pending |
| WEAR-03 | Phase 84 | Pending |
| WEAR-04 | Phase 84 | Pending |
| LIFE-01 | Phase 85 | Pending |
| LIFE-02 | Phase 85 | Pending |
| LIFE-03 | Phase 85 | Pending |
| LIFE-04 | Phase 85 | Pending |
| LIFE-05 | Phase 85 | Pending |
| LIFE-06 | Phase 85 | Pending |
| REORDER-01 | Phase 86 | Pending |
| REORDER-02 | Phase 86 | Pending |
| REORDER-03 | Phase 86 | Pending |
| REORDER-04 | Phase 86 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-07-14*
*Last updated: 2026-07-14 — traceability populated after roadmap creation (Phases 83-86)*

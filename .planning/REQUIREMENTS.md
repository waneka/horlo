# Requirements: Horlo — v5.2 Polish + Taxonomy

**Defined:** 2026-05-19
**Core Value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.

## v5.2 Requirements

Requirements for milestone v5.2. Each maps to a roadmap phase.

### Bug Fixes

- [ ] **BUG-01**: A watch on the user's wishlist, viewed via `/catalog/[catalogId]` (the cross-user route reached from search), shows correct ownership state — labeled as wishlisted, never "you own this watch"
- [ ] **BUG-02**: `/search` filter chips render with legible text contrast in dark mode (no black-on-dark text) across all chip groups — movement/size/style and the v5.1 FU-01 brand/era/genre/archetype chips

### Taxonomy

- [ ] **TAX-01**: A spike audits how `genre` and `style` are each consumed (`/search` filters, taste/similarity engine, `/explore` Browse indices, watch cards) and produces a written recommendation — consolidate, remove one, or keep both — with rationale

### Architecture

- [ ] **ARCH-01**: A spike compares keeping `/catalog/[catalogId]` (cross-user, spec-only) and `/watch/[id]` (owner per-user detail) as separate views vs merging them, and produces a written decision — no merge implementation in v5.2 unless the spike strongly favors it and it is cheap

## Future Requirements

Deferred to future milestones. Tracked but not in the current roadmap.

### Social Interaction (v6.0 — SEED-012)

- **SOCL-xx**: Scoped likes/comments on collections, wishlists, and wears (wishlist comments mutual-follow gated)

### Watch Photos (v7.0 — SEED-013)

- **PHOTO-xx**: Multi-photo carousel per watch; public wear pics surface on watch detail

### Add-Watch Redesign (v8.0 — SEED-010)

- **ADD-xx**: Search-first add-watch flow

## Out of Scope

Explicitly excluded from v5.2. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Implementing a genre/style consolidation | TAX-01 is decision-only; a consolidation ships only if the spike strongly favors it and it is cheap — then added as a new requirement mid-milestone |
| Merging the two watch-detail views | ARCH-01 is decision-only; a merge ships only if the spike strongly favors it and it is cheap — then added as a new requirement mid-milestone |
| Fixing the "truncated" render on `/catalog/[catalogId]` | The slimmer cross-user spec-only view is by design; the user's observation feeds the ARCH-01 spike, not a bug fix |
| Catalog breadth expansion (SEED-009) | Unscheduled — catalog-growth strategy being rethought (decision 2026-05-19) |
| Social likes/comments (SEED-012) | v6.0 milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 48 | Pending |
| BUG-02 | Phase 48 | Pending |
| TAX-01 | Phase 49 | Pending |
| ARCH-01 | Phase 50 | Pending |

**Coverage:**
- v5.2 requirements: 4 total
- Mapped to phases: 4
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-19*
*Last updated: 2026-05-19 — traceability filled after roadmap creation*

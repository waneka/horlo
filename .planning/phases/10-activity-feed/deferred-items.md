
## Deferred: REQUIREMENTS.md docs update

**Flag from 10-CONTEXT.md** <domain> section:
> "Scope flag for downstream docs update: REQUIREMENTS.md and ROADMAP.md currently scope Phase 10 to Network Activity alone. The planner or /gsd-docs-update must update both to reflect the expanded 5-section home, promote WYWT-03/DISC-02/DISC-04 into v2.0, add a new FEED-05 'home personal insights surface' requirement, and refresh the Phase 10 Success Criteria."

**Status as of Plan 10-04 completion (2026-04-21):**
- WYWT-03 was promoted (line 147 of REQUIREMENTS.md).
- FEED-05 is NOT in v2.0 checkboxes — needs adding under "Activity Feed".
- DISC-02, DISC-04 are still under "Future Requirements" — need moving to v2.0 under "Discovery & Recommendations" or a new section, and marked [x] after Plan 10-07 delivers the UI.
- Traceability table (line 114) needs FEED-05, DISC-02, DISC-04 rows mapped to Phase 10.

**Recommended action:** Run `/gsd-docs-update` before closing Phase 10, or have the Phase 10 verifier add these as part of the final phase doc sweep.

**Why not auto-fixed in Plan 10-04:** The doc mutation falls outside the data-layer scope of this plan. The plan's `requirements` frontmatter correctly declares these three IDs so the data-layer work is traceable; only the centralized REQUIREMENTS.md index lags.

**Update 2026-04-22 (Plan 10-07 completion):** Plan 10-07 ships the UI for FEED-05, DISC-02, DISC-04 but again could not mark them complete in REQUIREMENTS.md because they still don't exist as v2.0 line-items. `gsd-tools requirements mark-complete` returned `not_found` for all three. Running `/gsd-docs-update` before the Phase 10 verifier pass is now the clear next step — both the data layer (Plan 04) and the UI layer (Plan 07) are landed and waiting for the traceability flip.

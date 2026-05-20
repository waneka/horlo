# Phase 48: User-Facing Bug Fixes - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 48 fixes two live production bugs:

- **BUG-01** — A watch on the viewer's wishlist (or marked `grail`, or `sold`), when viewed via `/catalog/[catalogId]`, is mislabeled "You own this watch" and rendered with the owned-watch framing.
- **BUG-02** — The inline removable filter chips on `/search` render near-black text on a dark background in dark mode (unreadable).

The chip fix expands into a small refactor: all 8 ad-hoc chip surfaces consolidate into one shared primitive (decided in discussion).

**In scope:** the two bug fixes; extraction of a shared chip primitive; regression tests for BUG-01.
**Out of scope:** the two-views merge question (Phase 50 / ARCH-01); any genre/style consolidation (Phase 49 / TAX-01); a positive "On your wishlist" callout on the catalog page.
</domain>

<decisions>
## Implementation Decisions

### BUG-01 — Catalog ownership mislabel
- **D-01:** Root cause is confirmed. `findViewerWatchByCatalogId(userId, catalogId)` in `src/app/catalog/[catalogId]/page.tsx` (~line 279) queries the `watches` table by `userId` + `catalogId` only, with **no `status` filter**. Any matching row — `wishlist`, `grail`, or `sold` — sets `viewerOwnedRow`, which triggers `verdict.framing = 'self-via-cross-user'` (page.tsx ~line 104) and the `YouOwnThisCallout` in `CollectionFitCard.tsx`.
- **D-02:** Fix: restrict the ownership query to `status = 'owned'` only. `wishlist`, `grail`, and `sold` rows must NOT be treated as owned. (`WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'` — only `owned` is truly owned.)
- **D-03:** When the watch is non-owned, the catalog page **falls through to the existing cross-user verdict path** (the `collection.length > 0` branch that computes a full `VerdictBundle` + `CatalogActionsSpec`). A wishlisted watch therefore shows the normal cross-user verdict and the existing wishlist-aware CTA. **No special "On your wishlist" callout** — that would be a new capability; minimal fix only, per SEED-011 "fix the labeling/state."

### BUG-02 — Dark-mode chip legibility
- **D-04:** Root cause is confirmed. The inline removable facet chips in `SearchPageClient.tsx` (~lines 493-536) use `bg-accent/10` + `text-accent-foreground`. In dark mode `--accent-foreground` is `oklch(0.14 ...)` (near-black) and `bg-accent/10` is a barely-tinted dark surface → black-on-dark.
- **D-05:** Fix: keep the tinted-pill background; swap `text-accent-foreground` for a foreground token legible on a dark tint (e.g. `text-accent` or `text-foreground`). Smallest-diff approach — do NOT restyle the chip to the solid `bg-accent` selected-pill look.
- **D-06:** The 7 drawer chip components (`BrandChips`, `EraChips`, `GenreChips`, `ArchetypeChips`, `MovementChips`, `CaseSizeChips`, `StyleChips`) already use safe token pairs (`bg-secondary`/`text-secondary-foreground` unselected, `bg-accent`/`text-accent-foreground` on a *solid* light `bg-accent` selected) and are not themselves broken — but they are still consolidated under D-07.

### Chip consolidation
- **D-07:** Extract one shared chip primitive into `src/components/ui/`, replacing all 8 ad-hoc chip surfaces (7 drawer chip components + the inline removable chips in `SearchPageClient.tsx`).
- **D-08:** **Unify the look** — after consolidation the drawer toggle chips and the inline removable chips should be visually consistent. This is a deliberate UI change, not a pure refactor. → A `/gsd-ui-phase 48` design contract is warranted before planning so the unified chip visuals are specified.
- **D-09:** The BUG-02 dark-mode fix (D-05) lands inside the new shared primitive — once consolidated, the legible-foreground token is defined in one place.

### Regression tests
- **D-10:** Add regression coverage. Minimum: a test asserting a `wishlist` (and ideally `grail` / `sold`) watch on `/catalog/[catalogId]` does NOT render "You own this watch" and instead renders the cross-user verdict. Extend the existing `tests/app/catalog-page.test.ts` (which currently only covers the owned `self-via-cross-user` path). A dark-mode chip legibility assertion may be added if practical given the test setup.

### Claude's Discretion
- **Chip primitive variant model** — user deferred ("you choose"). Recommended: a `class-variance-authority`-based primitive (CVA is already a project dependency) exposing a selectable `toggle` variant (selected/unselected states, for the drawer chips) and a `removable` variant (with the trailing `X` affordance, for the inline chips). Final API shape is the planner's call.
- Exact legible foreground token for D-05 (`text-accent` vs `text-foreground` vs another) — pick whatever the unified chip design (D-08) settles on.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/REQUIREMENTS.md` — BUG-01 and BUG-02 requirement text + the v5.2 Out of Scope table
- `.planning/ROADMAP.md` §"Phase 48" — phase goal + success criteria

### Bug area 1 — catalog ownership
- `src/app/catalog/[catalogId]/page.tsx` — the route; `findViewerWatchByCatalogId()` (~line 279), the `viewerOwnedRow` branch (~line 104)
- `src/app/watch/[id]/page.tsx` — the comparison route; uses `getWatchByIdForViewer()` → `isOwner` boolean → `same-user` vs `cross-user` framing
- `src/components/insights/CollectionFitCard.tsx` — renders `YouOwnThisCallout` (~line 124) gated on `verdict.framing === 'self-via-cross-user'` (~line 30)
- `src/lib/types.ts` — `WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'`
- `tests/app/catalog-page.test.ts` — existing catalog-page tests (owned path at ~line 157)
- `tests/components/insights/CollectionFitCard.test.tsx` — existing callout test (~line 60)

### Bug area 2 — dark-mode chips
- `src/components/search/SearchPageClient.tsx` — inline removable facet chips (~lines 408-537)
- `src/components/search/FilterDrawer.tsx` — drawer container hosting the chip components
- `src/components/search/{BrandChips,EraChips,GenreChips,ArchetypeChips,MovementChips,CaseSizeChips,StyleChips}.tsx` — the 7 drawer chip components (identical class patterns)
- `src/app/globals.css` §`:root` / §`.dark` (~lines 90-122) — theme token definitions (`--accent`, `--accent-foreground`, `--secondary`, `--secondary-foreground`)
- `src/components/ui/` — target directory for the new shared chip primitive
- `src/lib/utils.ts` — `cn()` helper used across all chip components

No external ADRs/specs — requirements fully captured in the decisions above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cn()` (`src/lib/utils.ts`) and `class-variance-authority` — already in the stack; the natural basis for the shared chip primitive.
- The 7 drawer chip components share a byte-identical className pattern — straightforward to fold into one primitive.
- `tests/app/catalog-page.test.ts` already exercises the catalog page render — extend it rather than starting a new test file.

### Established Patterns
- Catalog page verdict framing is a discriminated union: `self-via-cross-user` | `cross-user` | `same-user`. BUG-01 is purely a mis-selection of `self-via-cross-user`; the framing system itself is correct and should not change.
- Theme is token-driven (`oklch` CSS custom properties in `globals.css`, light `:root` + `.dark` override). The correct fix posture is theme tokens, never hardcoded colors — consistent with the `feedback_ui_spec_css_chain_blind_spot` memory.
- Shadcn/base-ui primitives live in `src/components/ui/` — the chosen home for the new chip primitive.

### Integration Points
- `findViewerWatchByCatalogId()` is local to `catalog/[catalogId]/page.tsx` — the BUG-01 fix is contained to that file (plus tests).
- The shared chip primitive is consumed by `FilterDrawer.tsx` (via the 7 chip components) and `SearchPageClient.tsx` (inline chips) — both must migrate to it.
</code_context>

<specifics>
## Specific Ideas

- BUG-01 must not regress the genuine owned path: an actually-owned watch on `/catalog/[catalogId]` must still show "You own this watch".
- BUG-02 fix must be token-based (legible foreground token), not a hardcoded color.
- Post-consolidation, drawer chips and inline removable chips should look visually consistent (D-08).
</specifics>

<deferred>
## Deferred Ideas

- Positive "On your wishlist" callout on `/catalog/[catalogId]` (symmetric to "You own this watch") — considered and explicitly declined for this phase; a possible future polish item, not a v5.2 requirement.
- The architecture question of whether `/catalog/[catalogId]` and `/watch/[id]` should remain two separate views — that is Phase 50 / ARCH-01, not this phase.

None of the discussion strayed beyond phase scope otherwise.
</deferred>

---

*Phase: 48-user-facing-bug-fixes*
*Context gathered: 2026-05-19*

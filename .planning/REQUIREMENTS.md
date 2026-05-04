# Horlo v4.1 Polish & Patch — Requirements

**Goal:** Clear v4.0 carryover with bug fixes, UX tweaks, and small features so v5.0 (Discovery North Star) starts clean.

**Scope posture:** Polish/patch. No new domain. All items extend existing v4.0 patterns (WatchCard, useFormFeedback, UserMenu, UI tabs, WYWT capture pipeline, Phase 25/26 verification process).

---

## v4.1 Requirements

### Wishlist UX

- [x] **WISH-01**: User can reorder wishlist items via drag-and-drop on desktop and long-press on mobile. Order persists across sessions via a new `sort_order` column on `watches`. Reordering is owner-only; public profile views render in the owner's chosen order.

### Visual Polish

- [x] **VIS-07**: Collection and wishlist grids render in 2 columns on mobile viewports (<768px). Desktop layout unchanged.
- [x] **VIS-08**: Watch card displays a price line — `paid_price` for owned watches, `target_price` for wishlist watches. Hidden when the relevant value is null.

### Form Feedback (Phase 25 useFormFeedback extension)

- [ ] **UX-09**: After adding a watch to collection or wishlist from any entry point (Add-Watch flow, /search row 3-CTA accordion, /catalog/[id] 3-CTA), a success toast appears with a link to the user's profile collection/wishlist tab. Extends Phase 25 `useFormFeedback` hook + `FormStatusBanner` primitive to support a CTA-link variant.

### Verdict Copy (FIT-04 follow-up)

- [ ] **FIT-06**: Rewrite the "unusual for your collection" verdict copy templates so they read coherently in TWO contexts: as a verdict-to-user message on `/watch/[id]` / `/search` accordion / `/catalog/[id]`, AND as the auto-fill source for wishlist notes. Revisit whether `contextualPhrasings[0]` is the right rationale-fill source for the wishlist note default — the verdict-to-user phrasing and the user's-own-note-about-why-they-want-it are different speech acts and may need different sources.

### Add-Watch Flow (Phase 20.1 follow-up)

- [ ] **ADD-08**: After completing or canceling the Add-Watch flow, the user returns to their entry point (collection, wishlist, search, /catalog/[id], or wherever they were when they clicked into Add-Watch). Implemented via `?returnTo=…` URL parameter captured at flow entry, validated against an allow-list of internal paths, and routed back on commit/cancel.

### Navigation (Phase 25 follow-up)

- [ ] **NAV-16**: Remove the redundant Profile link from the UserMenu dropdown. Phase 25 made avatar→profile the primary path (dual-affordance); the dropdown row is now duplicate. UserMenu retains Settings, Theme segmented, and Sign out.

### Profile Tabs

- [ ] **PROF-10**: Profile tab strip on `/u/[username]` scrolls only horizontally; vertical scroll is disabled (currently has unwanted vertical-scroll behavior on overflow).

### WYWT Capture (Phase 15 follow-up)

- [ ] **WYWT-22**: WYWT capture overlay (WristOverlaySvg) aligns with the actual capture frame, not the preview frame. Currently the preview shows a black bar at the bottom that the capture does not include — users align their wrist with the SVG expecting it to be centered, but in the saved image the wrist is at the bottom of the frame. Fix overlay positioning math to match capture coords (and/or crop preview to match capture dimensions). NOTE: SVG geometry redesign (canonical 10:10 + arm spacing) is owned by user and explicitly NOT in scope.

### v4.0 Carryover — Verification Backfill

- [ ] **DEBT-07**: Phase 23 phase-level VERIFICATION.md backfilled. Goal-backward audit of Phase 23 (Settings Sections + Schema-Field UI) against shipped code. Closes v4.0 verification asymmetry per `milestones/v4.0-MILESTONE-AUDIT.md`.
- [ ] **DEBT-08**: Phase 24 phase-level VERIFICATION.md backfilled. Goal-backward audit of Phase 24 (Notification Stub Cleanup + Test Fixture & Carryover) against shipped code. Closes v4.0 verification asymmetry.

---

## Future Requirements (Deferred to v5.0+)

Captured here for traceability; not v4.1 scope.

- **CAT-13**: Catalog → similarity engine rewire — anchor for v5.0 Discovery North Star (SEED-004)
- **CAT-14**: `SET NOT NULL` on `watches.catalog_id` — after 100% backfill verified across two consecutive deploys
- **DISC-09**: /explore Editorial Featured Collection — admin tooling required
- **DISC-10**: Trending feed widening — overlaps with SEED-002 hybrid recommender
- **SRCH-16**: Search facets (Movement / Case size / Style) on /search Watches
- **SRCH-17**: Advanced search facets (price range, market trends) — premium-gated candidate
- **FIT-05**: Pairwise drill-down — "Compare with watch I own" inside CollectionFitCard
- **SET-13**: Account → Delete Account / Wipe Collection — Danger Zone with multi-step confirm + soft-delete cron
- **SET-14**: Branded HTML email templates (currently using Supabase defaults via Resend)
- **SMTP-06**: Staging-prod sender split (`mail.staging.horlo.app`) — pending staging Supabase project
- **UX-10/11**: Phase 25 deferred items (see v4.0-REQUIREMENTS.md Future Requirements)

## Out of Scope

- **Total collection value** — promoted to v6.0 Market Value (SEED-005). Needs market price API + `market_prices` schema; v4.1 does not have the data layer.
- **WristOverlaySvg geometry redesign** (canonical 10:10 + arm spacing fix) — user owns the design pass; v4.1 only fixes overlay alignment math (WYWT-22).
- **Native apps** — not roadmapped; raised but explicitly deferred indefinitely.
- **Combine home and explore?** — v5.0 Phase 1 discovery audit answers it; do not pre-decide.
- **Premium subscription wiring** — `/gsd-explore` audit (SEED-006) runs between v4.1 close and v5.0 start; pricing/Stripe/Plan tab waits on the audit output.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| WISH-01 | Phase 27 | Complete |
| VIS-07 | Phase 27 | Complete |
| VIS-08 | Phase 27 | Complete |
| UX-09 | Phase 28 | Pending |
| FIT-06 | Phase 28 | Pending |
| ADD-08 | Phase 28 | Pending |
| NAV-16 | Phase 29 | Pending |
| PROF-10 | Phase 29 | Pending |
| WYWT-22 | Phase 30 | Pending |
| DEBT-07 | Phase 31 | Pending |
| DEBT-08 | Phase 31 | Pending |

Coverage: 11/11 requirements mapped to exactly one phase.

---

*Last updated: 2026-05-04 — roadmap created via `/gsd-roadmap`. 11 requirements mapped to 5 phases (27-31). Research skipped (polish/patch milestone, no new domain). All items extend existing v4.0 patterns.*

*Previous: 2026-05-04 — milestone initialized via `/gsd-new-milestone`. 11 requirements across 9 categories.*

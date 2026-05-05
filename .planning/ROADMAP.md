# Roadmap: Horlo

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Taste Network Foundation** — Phases 6-10 (shipped 2026-04-22) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Production Nav & Daily Wear Loop** — Phases 11-16 + 999.1 (shipped 2026-04-27) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Discovery & Polish** — Phases 17-26 + 19.1 + 20.1 (shipped 2026-05-03) — [archive](milestones/v4.0-ROADMAP.md)
- 🚧 **v4.1 Polish & Patch** — Phases 27-31 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-04-19</summary>

- [x] Phase 1: Visual Polish & Security Hardening (6/6 plans)
- [x] Phase 2: Feature Completeness & Test Foundation (5/5 plans)
- [x] Phase 3: Data Layer Foundation (3/3 plans)
- [x] Phase 4: Authentication (6/6 plans)
- [x] Phase 5: Zustand Cleanup, Similarity Rewire & Prod DB Bootstrap (6/6 plans)
- [ ] Phase 6: Test Suite Completion — deferred to v1.1 (TEST-04/05/06)

See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v2.0 Taste Network Foundation (Phases 6-10) — SHIPPED 2026-04-22</summary>

- [x] Phase 6: RLS Foundation (1/1 plans)
- [x] Phase 7: Social Schema & Profile Auto-Creation (3/3 plans)
- [x] Phase 8: Self Profile & Privacy Controls (4/4 plans)
- [x] Phase 9: Follow System & Collector Profiles (4/4 plans)
- [x] Phase 10: Network Home (9/9 plans)

35/35 requirements shipped. Cross-phase integration verified. End-to-end privacy flows audited.

See [v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) for full phase details and [v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v3.0 Production Nav & Daily Wear Loop (Phases 11-16 + 999.1) — SHIPPED 2026-04-27</summary>

- [x] Phase 11: Schema + Storage Foundation (5/5 plans)
- [x] Phase 12: Visibility Ripple in DAL (7/7 plans)
- [x] Phase 13: Notifications Foundation (5/5 plans)
- [x] Phase 14: Nav Shell + Explore Stub (9/9 plans)
- [x] Phase 15: WYWT Photo Post Flow (5/5 plans)
- [x] Phase 16: People Search (5/5 plans)
- [x] Phase 999.1: Phase 5 Code Review Follow-ups (1/1 plan, inserted)

51/51 requirements shipped at code level. Cross-phase integration verified. Audit status `tech_debt` — 31 deferred human-verification UAT items + ~30 advisory tech-debt items, none blocking.

See [v3.0-ROADMAP.md](milestones/v3.0-ROADMAP.md) for full phase details and [v3.0-MILESTONE-AUDIT.md](milestones/v3.0-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v4.0 Discovery & Polish (Phases 17-26 + 19.1 + 20.1) — SHIPPED 2026-05-03</summary>

- [x] Phase 17: Catalog Foundation (6/6 plans)
- [x] Phase 18: /explore Discovery Surface (5/5 plans)
- [x] Phase 19: /search Watches + Collections (6/6 plans)
- [x] Phase 19.1: Catalog Taste Enrichment (6/6 plans, inserted)
- [x] Phase 20: Collection Fit Surface Polish + Verdict Copy (6/6 plans)
- [x] Phase 20.1: Add-Watch Flow Rethink + Verdict-as-Step (8/8 plans incl. gap-closure 06/07/08, inserted)
- [x] Phase 21: Custom SMTP via Resend (2/2 plans)
- [x] Phase 22: Settings Restructure + Account Section (5/5 plans)
- [x] Phase 23: Settings Sections + Schema-Field UI (6/6 plans, no phase-level VERIFICATION.md)
- [x] Phase 24: Notification Stub Cleanup + Test Fixture/Carryover (8/8 plans, no phase-level VERIFICATION.md)
- [x] Phase 25: Profile Nav Prominence + Empty States + Form Polish (6/6 plans, UAT approved on prod)
- [x] Phase 26: WYWT Auto-Nav (2/2 plans, gap closed inline)

75/75 actionable requirements satisfied + 1 deferred (SMTP-06 staging-prod sender split). Audit status `tech_debt` — 2 phases without phase-level VERIFICATION.md, ~33 deferred human UAT items, Nyquist coverage partial. None blocking.

See [v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md) for full phase details and [v4.0-MILESTONE-AUDIT.md](milestones/v4.0-MILESTONE-AUDIT.md) for the audit report.

</details>

### v4.1 Polish & Patch (active)

- [x] **Phase 27: Watch Card & Collection Render Polish** — Reorderable wishlist (sort_order column), 2-column mobile grid, price line on card (completed 2026-05-04)
- [x] **Phase 28: Add-Watch Flow & Verdict Copy Polish** — Return-to-context, success-toast-with-link, "unusual" verdict copy rewrite + rationale-source rethink (completed 2026-05-05)
- [ ] **Phase 29: Nav & Profile Chrome Cleanup** — Remove redundant Profile from UserMenu, profile tabs horizontal-scroll only
- [ ] **Phase 30: WYWT Capture Alignment Fix** — Overlay positioning math matches capture frame, not preview frame
- [ ] **Phase 31: v4.0 Verification Backfill** — Phase 23 + Phase 24 phase-level VERIFICATION.md goal-backward audits

## Phase Details

### Phase 27: Watch Card & Collection Render Polish
**Goal**: Collection and wishlist owners can see and reorder their watches in a denser, price-aware grid that reflects the order they care about.
**Depends on**: v4.0 (WatchCard, Collection/Wishlist tabs, watches table schema)
**Requirements**: WISH-01, VIS-07, VIS-08
**Success Criteria** (what must be TRUE):
  1. On a mobile viewport (<768px), Collection and Wishlist tabs render watches in a 2-column grid (desktop layout unchanged).
  2. Each watch card shows a price line — `paid_price` for owned, `target_price` for wishlist — and the line is hidden when the relevant value is null.
  3. The owner can reorder Wishlist items via drag-and-drop on desktop and long-press-and-drag on mobile, and the new order persists across sessions and across devices.
  4. A non-owner viewing a public Wishlist sees the watches in the order the owner chose.
**Plans**: 5 plans across 4 waves

**Wave 1**
- [x] 27-01-PLAN.md — Wave 0 RED test scaffolds (7 new + 1 extend)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 27-02-PLAN.md — Schema column + drizzle/supabase migrations + DAL helpers + addWatch/editWatch sort_order; `[BLOCKING]` local drizzle-kit push
- [x] 27-04-PLAN.md — ProfileWatchCard status-driven price line + Image sizes attr; CollectionTabContent grid-cols-2

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 27-03-PLAN.md — reorderWishlist Server Action (Zod .strict, owner-only, ActionResult)

**Wave 4** *(blocked on Wave 3 completion; manual UAT checkpoint at end)*
- [x] 27-05-PLAN.md — Drag UX: install @dnd-kit/*, SortableProfileWatchCard with drop-indicator, WishlistTabContent DnD wiring + grid-cols-2; manual UAT

**Cross-cutting constraints** (appear in 2+ plans):
- Mobile `grid-cols-2` breakpoint (D-11, VIS-07) — Plans 01, 04, 05
- Owner-only enforcement at DAL + Action layers (D-10, T-27-01) — Plans 02, 03
- Status-driven price line bucket logic (D-15..D-21, VIS-08) — Plans 01, 04
- `[BLOCKING]` local drizzle-kit push gates Wave 3 (T-27-LOCAL: drizzle-kit push is LOCAL ONLY; prod uses `supabase db push --linked` at deploy time)

**UI hint**: yes

### Phase 28: Add-Watch Flow & Verdict Copy Polish
**Goal**: Adding a watch lands the user back where they started, gives them a clear next-step link, and the verdict copy reads coherently both as a verdict and as the wishlist-note auto-fill.
**Depends on**: Phase 27 (no hard dependency, but Phase 27 ships the price/grid surface UX-09's success toast links into); v4.0 Phases 20, 20.1, 25 (CollectionFitCard composer, Add-Watch Flow state machine, useFormFeedback hook)
**Requirements**: FIT-06, ADD-08, UX-09
**Success Criteria** (what must be TRUE):
  1. After adding a watch from any entry point (Add-Watch Flow, /search row 3-CTA accordion, /catalog/[id] 3-CTA), the user sees a success toast that includes a link to the corresponding profile collection or wishlist tab.
  2. After completing or canceling the Add-Watch Flow, the user is returned to the entry point they came from (collection, wishlist, search, /catalog, etc.) — not unconditionally to home — via a `?returnTo=` parameter validated against an allow-list of internal paths.
  3. The "unusual for your collection" verdict reads coherently to the user on `/watch/[id]`, the `/search` accordion, and `/catalog/[id]`.
  4. The wishlist note auto-fill, when populated from a verdict, reads as the user's own first-person rationale (not as a verdict-to-user message), and the source of that auto-fill text is intentional rather than incidentally `contextualPhrasings[0]`.
**Plans**: 5 plans across 3 waves

**Wave 1** *(parallel-safe — zero file overlap)*
- [x] 28-01-PLAN.md — FIT-06: verdict copy rewrite + speech-act split
- [x] 28-02-PLAN.md — UX-09 hook foundation: useFormFeedback successAction extension
- [x] 28-03-PLAN.md — ADD-08 server foundation: /watch/new returnTo whitelist + shared destinations.ts module

**Wave 2** *(blocked on Wave 1)*
- [x] 28-04-PLAN.md — UX-09 inline-commit wiring: /search + /catalog/[id] Wishlist commits switch to Sonner action-slot

**Wave 3** *(blocked on Wave 2)*
- [x] 28-05-PLAN.md — ADD-08 callsite append + UX-09 nav-on-commit: 8 entry-points + AddWatchFlow/WatchForm rewrites

**Cross-cutting constraints** (appear in 2+ plans):
- Sonner action-slot toast contract (D-01/D-02/D-03) — Plans 02, 04, 05
- viewerUsername server-side resolution (D-02/D-06) — Plans 03, 04
- BottomNav D-09 phantom (no Add slot since Phase 18) — explicitly NOT modified
- NotesTabContent D-10 skip (Server Component fallback to default destination)
- composer.test.ts FIT-02 lock preservation (D-22) — Plan 01 only
**UI hint**: yes

### Phase 29: Nav & Profile Chrome Cleanup
**Goal**: The UserMenu and profile tab strip are tight and predictable — no duplicate Profile affordance, no surprise vertical scroll on the tab strip.
**Depends on**: v4.0 Phase 25 (avatar dual-affordance shipped Profile as primary path)
**Requirements**: NAV-16, PROF-10
**Success Criteria** (what must be TRUE):
  1. The UserMenu dropdown no longer shows a "Profile" item; the avatar Link remains the primary path to `/u/{username}`. UserMenu still exposes Settings, Theme segmented control, and Sign out.
  2. On `/u/[username]`, the profile tab strip scrolls horizontally only when its tabs overflow — no vertical scroll-bar appears, no vertical-scroll gesture is consumed by the tab strip on touch or trackpad.
**Plans**: TBD
**UI hint**: yes

### Phase 30: WYWT Capture Alignment Fix
**Goal**: When a user aligns their wrist with the WYWT camera overlay, the saved photo crops the wrist where the overlay said it would be — not lower in the frame.
**Depends on**: v3.0 Phase 15 (CameraCaptureView, WristOverlaySvg, photo capture pipeline)
**Requirements**: WYWT-22
**Success Criteria** (what must be TRUE):
  1. The WYWT capture overlay's geometric center (or anchor point) corresponds to the same pixel coordinates in the saved JPEG that it visually occupies in the live preview.
  2. The capture pipeline either crops the preview to match the capture frame, or shifts the overlay to the capture coordinate space, so a user who aligns their wrist with the on-screen guide sees the same alignment in the resulting `/wear/[id]` photo.
  3. WristOverlaySvg geometry (canonical 10:10 + arm spacing) is unchanged — out of scope for this phase per requirement note.
**Plans**: TBD
**UI hint**: yes

### Phase 31: v4.0 Verification Backfill
**Goal**: Phase 23 and Phase 24 each have a phase-level VERIFICATION.md that goal-backward-audits the shipped code, closing the v4.0 verification asymmetry recorded in the milestone audit.
**Depends on**: v4.0 Phase 23 + Phase 24 (already shipped; this phase audits them retroactively)
**Requirements**: DEBT-07, DEBT-08
**Success Criteria** (what must be TRUE):
  1. `.planning/milestones/v4.0-phases/23-phase-23-settings-sections-and-schema-field-ui/VERIFICATION.md` (or equivalent path under the v4.0 milestone archive) exists and audits Phase 23's success criteria against shipped code.
  2. `.planning/milestones/v4.0-phases/24-phase-24-notification-stub-cleanup-and-test-fixture-carryover/VERIFICATION.md` (or equivalent) exists and audits Phase 24's success criteria against shipped code.
  3. The v4.0 milestone audit status note recording the missing VERIFICATION.md files is updated (or amended with a closure note) to reflect the backfill.
**Plans**: TBD

## Progress

| Milestone | Phases | Plans Complete | Status | Completed |
|-----------|--------|----------------|--------|-----------|
| v1.0 MVP | 1-5 | 26/26 | ✅ Complete | 2026-04-19 |
| v2.0 Taste Network Foundation | 6-10 | 21/21 | ✅ Complete | 2026-04-22 |
| v3.0 Production Nav & Daily Wear Loop | 11-16 + 999.1 | 37/37 | ✅ Complete | 2026-04-27 |
| v4.0 Discovery & Polish | 17-26 + 19.1 + 20.1 | 65/65 | ✅ Complete | 2026-05-03 |
| v4.1 Polish & Patch | 27-31 | 10/10 | 🚧 In progress | — |

### v4.1 Phase Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 27. Watch Card & Collection Render Polish | 5/5 | Complete    | 2026-05-04 |
| 28. Add-Watch Flow & Verdict Copy Polish | 5/5 | Complete    | 2026-05-05 |
| 29. Nav & Profile Chrome Cleanup | 0/0 | Not started | — |
| 30. WYWT Capture Alignment Fix | 0/0 | Not started | — |
| 31. v4.0 Verification Backfill | 0/0 | Not started | — |

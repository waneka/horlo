# Roadmap: Horlo

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-04-19) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Taste Network Foundation** — Phases 6-10 (shipped 2026-04-22) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Production Nav & Daily Wear Loop** — Phases 11-16 + 999.1 (shipped 2026-04-27) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Discovery & Polish** — Phases 17-26 + 19.1 + 20.1 (shipped 2026-05-03) — [archive](milestones/v4.0-ROADMAP.md)
- ✅ **v4.1 Polish & Patch** — Phases 27-31 (shipped 2026-05-05) — [archive](milestones/v4.1-ROADMAP.md)
- ✅ **v5.0 Discovery North Star** — Phases 32-42 (shipped 2026-05-16) — [archive](milestones/v5.0-ROADMAP.md)
- ✅ **v5.1 Explore Page Redesign** — Phases 43-47 (shipped 2026-05-19) — [archive](milestones/v5.1-ROADMAP.md)
- ✅ **v5.2 Polish + Taxonomy** — Phases 48-50 + 49.1 + 50.1 (shipped 2026-05-20) — [archive](milestones/v5.2-ROADMAP.md)
- 🔄 **v6.0 Social Interaction** — Phases 53-58 (in progress)
- 📋 **v7.0 Watch Photos** — planted (SEED-013)
- 📋 **v8.0 Add-Watch Redesign** — planted (SEED-010)
- 💤 **Catalog Expansion** — unscheduled; catalog strategy under review (SEED-009)
- 💤 **Market Value** — future, after v8.0 (SEED-005; needs the SEED-007 pricing spike first)

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
- [x] Phase 23: Settings Sections + Schema-Field UI (6/6 plans, no phase-level VERIFICATION.md → backfilled in v4.1 Phase 31)
- [x] Phase 24: Notification Stub Cleanup + Test Fixture/Carryover (8/8 plans, no phase-level VERIFICATION.md → backfilled in v4.1 Phase 31)
- [x] Phase 25: Profile Nav Prominence + Empty States + Form Polish (6/6 plans, UAT approved on prod)
- [x] Phase 26: WYWT Auto-Nav (2/2 plans, gap closed inline)

75/75 actionable requirements satisfied + 1 deferred (SMTP-06 staging-prod sender split). Audit status `tech_debt` — 2 phases without phase-level VERIFICATION.md (closed in v4.1), ~33 deferred human UAT items, Nyquist coverage partial. None blocking.

See [v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md) for full phase details and [v4.0-MILESTONE-AUDIT.md](milestones/v4.0-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v4.1 Polish & Patch (Phases 27-31) — SHIPPED 2026-05-05</summary>

- [x] Phase 27: Watch Card & Collection Render Polish (5/5 plans)
- [x] Phase 28: Add-Watch Flow & Verdict Copy Polish (5/5 plans)
- [x] Phase 29: Nav & Profile Chrome Cleanup (6/6 plans + 1 quick task)
- [x] Phase 30: WYWT Capture Alignment Fix (2/2 plans + 1 post-ship hotfix)
- [x] Phase 31: v4.0 Verification Backfill (3/3 plans)

12/12 requirements satisfied at code level. Cross-phase integration verified (7/7 seams pass). E2E flows trace cleanly (4/4). Audit status `tech_debt` — 1 NEW finding (DEBT-09: Phase 23-era `notesPublic` / `revalidatePath` regression discovered by Phase 31 audit) deferred to v4.2 / v5.0; Nyquist 4/5 partial. None blocking.

See [v4.1-ROADMAP.md](milestones/v4.1-ROADMAP.md) for full phase details and [v4.1-MILESTONE-AUDIT.md](milestones/v4.1-MILESTONE-AUDIT.md) for the audit report.

</details>

<details>
<summary>✅ v5.0 Discovery North Star (Phases 32-42) — SHIPPED 2026-05-16</summary>

- [x] Phase 32: DEBT-09 notesPublic Fix (1/1 plans) — completed 2026-05-06
- [x] Phase 33: Discovery Audit (4/4 plans) — completed 2026-05-08
- [x] Phase 33b: Discovery North-Star Audit (3/3 plans, inserted) — completed 2026-05-09
- [x] Phase 34: Layer A — Brand + Family Entities (4/4 plans) — completed 2026-05-09
- [x] Phase 35: Layer B — Lineage Edges + Structured Movement + Era/Material (7/7 plans) — completed 2026-05-10
- [x] Phase 36: Layer C — Variant Split + Clean-Slate Wipe + CAT-14 NOT NULL (5/5 plans) — completed 2026-05-11
- [x] Phase 37: Layer D — Provenance Fields + Divestments Table (5/5 plans) — completed 2026-05-11
- [x] Phase 38: CAT-13 Engine Rewire (4/4 plans) — completed 2026-05-12
- [x] Phase 39: Audit-Driven Discovery Polish — Cheap Patches (3/3 plans) — completed 2026-05-12
- [x] Phase 39b: Audit-Driven Discovery Polish — Heavier UX (5/5 plans) — completed 2026-05-13
- [x] Phase 39c: Profile Layout Next 16 Conformance (7/7 plans, inserted) — completed 2026-05-14
- [x] Phase 40: Search & Verdict Polish (7/7 plans) — completed 2026-05-14
- [x] Phase 41: Account Danger Zone + Branded Auth Emails (4/4 plans, parallel track) — completed 2026-05-16
- [x] Phase 42: Nyquist Hardening Sweep + UAT Triage (5/5 plans, parallel track) — completed 2026-05-16

16/16 in-scope v5.0 requirements shipped. DEBT-12 (prod drizzle journal repair) carried to v5.x as opportunistic housekeeping. Phase 33b and 39c were inserted phases (north-star audit reframe; Profile Layout Next 16 conformance bugfix). Milestone closed without a formal `/gsd-audit-milestone`; 4 verification gaps (Phases 35/38/40/41) + 2 human-UAT gaps (Phases 35/41) operator-approved at close.

See [v5.0-ROADMAP.md](milestones/v5.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v5.1 Explore Page Redesign (Phases 43-47) — SHIPPED 2026-05-19</summary>

- [x] Phase 43: Polish Pass (7/7 plans) — completed 2026-05-17
- [x] Phase 44: Catalog Enrichment (4/4 plans) — completed 2026-05-18
- [x] Phase 45: CMS Data Model + Admin Routes (6/6 plans) — completed 2026-05-18
- [x] Phase 46: Explore Shell + Browse + Archetypes (6/6 plans) — completed 2026-05-19
- [x] Phase 47: Curated Lists Rail + Hero + Where Collections Go (4/4 plans) — completed 2026-05-19

32/32 v5.1 requirements shipped. Two operator-raised end-of-milestone follow-ups (FU-01 `/search` facet menu, FU-02 `/explore/brands` smooth scroll) were closed as quick tasks before close. Milestone closed without a formal `/gsd-audit-milestone`; the pre-close artifact audit's 23 open items were all cosmetic flags or expected backlog, acknowledged as non-blocking.

See [v5.1-ROADMAP.md](milestones/v5.1-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v5.2 Polish + Taxonomy (Phases 48-50 + 49.1 + 50.1) — SHIPPED 2026-05-20</summary>

- [x] Phase 48: User-Facing Bug Fixes (3/3 plans) — completed 2026-05-19
- [x] Phase 49: Genre vs Style Taxonomy Spike (3/3 plans) — completed 2026-05-19
- [x] Phase 49.1: Remove Genre Surface (8/8 plans, inserted) — completed 2026-05-20
- [x] Phase 50: Watch-Detail Architecture Spike (4/4 plans) — completed 2026-05-20
- [x] Phase 50.1: URL Canonicalization (3/3 plans, inserted) — completed 2026-05-20

6/6 v5.2 requirements shipped (BUG-01, BUG-02, TAX-01, TAX-02, ARCH-01, ARCH-02). Two spike-then-execute chains landed: TAX-01 → TAX-02 (retired genre/archetype taxonomy surface; `style_tags` becomes single SoT for the functional-category axis); ARCH-01 → ARCH-02 (page-layer `redirect()` from `/catalog/[catalogId]` to `/watch/[id]` for owner viewer; Variant C unified `/w/[ref]` deferred to v7.0). Milestone-close audit closed D-DEBT-01 inline (dead `self-via-cross-user` framing surface removed across 6 files); status promoted `tech_debt` → `passed`. Operational gates D-DEBT-02 (5 Phase 49.1 prod/visual gates) + D-DEBT-03 (1 Phase 48 dark-mode UAT) remain as post-deploy verification.

See [v5.2-ROADMAP.md](milestones/v5.2-ROADMAP.md) for full phase details and [v5.2-MILESTONE-AUDIT.md](milestones/v5.2-MILESTONE-AUDIT.md) for the audit report.

</details>

### 🔄 v6.0 Social Interaction (Phases 53-58)

- [x] **Phase 53: Schema + RLS + Enum Extension** — interaction tables, two-layer security foundation (completed 2026-05-22)
- [x] **Phase 54: DAL — Reactions, Comments + Gate Logic** — data access layer with mutual-follow enforcement (completed 2026-05-22)
- [x] **Phase 55: Server Actions + Notification Dedup** — mutation entry points with Zod validation and notification fan-out (completed 2026-05-22)
- [x] **Phase 56: Like UI** — LikeButton component wired into watch and wear detail pages (completed 2026-05-23)
- [ ] **Phase 57: Comment Thread UI + Feed Extension + Grid Counts** — comment compose/list/edit/delete plus feed activities and profile grid counts
- [ ] **Phase 58: Notification UI + Settings Opt-Out** — bell/inbox rendering for new types plus notifyOnLike/notifyOnComment toggles

### 📋 v7.0 Watch Photos (Planted)

Not yet roadmapped — seeded as SEED-013. Multi-photo carousel per watch (replacing the single `imageUrl`); public wear pics surface on watch detail; wear pics persist in the Wears tab (Home rail stays ephemeral); add-watch flow encourages photos with a per-person cap. **Reconsider Variant C (unified `/w/[ref]` route)** at this milestone — `src/app/catalog/[catalogId]/page.tsx:228-234` carries a `TODO: revisit for Variant C in v7.0` comment planted by Phase 50.1 (ARCH-02) so the carousel implementation phase inherits an explicit decision point.

### 📋 v8.0 Add-Watch Redesign (Planted)

Not yet roadmapped — seeded as SEED-010. Search-first add-watch flow. The catalog-depth dependency is under review now that Catalog Expansion is unscheduled.

### 💤 Catalog Expansion (Unscheduled)

Seeded as SEED-009 — catalog breadth expansion past the ~100-row bootstrap. Unscheduled: the catalog-growth strategy is being rethought (decision 2026-05-19). v5.2 enriched the existing axis (retired the genre/archetype layer) without adding breadth.

### 💤 Market Value (Future)

Seeded as SEED-005 — Watch Charts integration + total-value insights. Sits after v8.0; needs the SEED-007 market-pricing API spike first. (No longer numbered v6.0 — that slot is now Social Interaction.)

## Phase Details

### Phase 53: Schema + RLS + Enum Extension
**Goal**: The database has all tables, constraints, and security policies required for likes and comments to exist safely — no interaction data can be read or written by unauthenticated users, cascading deletes are guaranteed, and the notification enum carries the four new event types.
**Depends on**: Phase 52 (Cache Components canonical pattern — already complete)
**Requirements**: SEC-01, SEC-04, SEC-06, LIKE-05, GATE-02
**Success Criteria** (what must be TRUE):
  1. Migration runs cleanly on both local and prod; `likes` and `comments` tables exist with FK constraints that cascade-delete rows when the parent watch or wear event is removed.
  2. A Postgres assertion in-migration confirms anon role cannot SELECT from the new tables (two-layer security: RLS `TO authenticated` + DAL WHERE).
  3. Any SECURITY DEFINER helper introduced (e.g., `isMutualFollow`) has EXECUTE revoked from PUBLIC and anon, verified by an in-migration `DO $$` assertion.
  4. `notification_type` enum carries four new values (`watch_like`, `wear_like`, `watch_comment`, `wear_comment`) via `ALTER TYPE ... ADD VALUE IF NOT EXISTS` statements executed outside a transaction block.
  5. A UNIQUE constraint on the likes table prevents duplicate likes for the same (actor, target) pair, verifiable by attempting a duplicate insert and observing a constraint violation.
**Plans**: 3 plans
  - [x] 53-01-PLAN.md — Author schema.ts + DDL migration (tables/RLS/REVOKE/CHECK/assertions) + non-transactional enum migration
  - [x] 53-02-PLAN.md — [BLOCKING] Apply both migrations to live local DB (DO $$ assertions fire) + cascade/duplicate-like smokes
  - [x] 53-03-PLAN.md — Push both migrations to prod via `supabase db push --linked` (checkpoint: human-action) + prod enum-count verify

### Phase 54: DAL — Reactions, Comments + Gate Logic
**Goal**: Server-side functions can read and write likes and comments with the wishlist mutual-follow gate enforced as a second privacy layer — independently of RLS — so a non-mutual-follower calling the DAL directly is rejected for wishlist watches.
**Depends on**: Phase 53
**Requirements**: GATE-01, GATE-04, GATE-05, SEC-02
**Success Criteria** (what must be TRUE):
  1. `getLikesForTarget` and `createLike` in `src/data/reactions.ts` enforce two-layer privacy: RLS blocks anon at the DB layer, DAL WHERE scopes to authenticated viewer.
  2. `getCommentsForTarget` returns comments for any authenticated viewer on owned/sold/grail watches and wears; on wishlist watches it returns comments only when the viewer is a mutual follower.
  3. `createComment` on a wishlist watch rejects a non-mutual-follower caller with a gate error — verified by an integration test that calls the DAL directly (bypassing RLS) as a non-mutual-follower.
  4. The collection owner can always read and create comments on their own watches regardless of the gate (GATE-04 verified in the same integration test suite).
  5. `isMutualFollow(userA, userB)` checks both directions in a single query and returns false when A follows B but B does not follow A.
**Plans**: 3 plans
  - [x] 54-01-PLAN.md — Wave 0: test scaffolds (localhost-gated SEC-02/GATE-04/GATE-05 integration suite + mocked-db unit suite); RED until impl lands
  - [x] 54-02-PLAN.md — Wave 1: isMutualFollow bidirectional single-query check (GATE-05) in follows.ts + reactions.ts likes DAL (getLikesForTarget/createLike/deleteLike)
  - [x] 54-03-PLAN.md — Wave 2: comments.ts gate (canViewerCommentOnTarget + CommentGateError + createComment/getCommentsForTarget/edit/delete) — GATE-01, GATE-04, SEC-02

### Phase 55: Server Actions + Notification Dedup
**Goal**: All like and comment mutations are callable from the UI through Zod-validated Server Actions that re-verify auth server-side, invalidate the correct cache tags, and fire like/comment notifications with deduplication — with no IDOR or cross-viewer cache leakage possible.
**Depends on**: Phase 54
**Requirements**: SEC-03, SEC-05, NOTIF-11, NOTIF-12, NOTIF-13, NOTIF-14
**Success Criteria** (what must be TRUE):
  1. `toggleLikeAction` and all comment actions (`addCommentAction`, `editCommentAction`, `deleteCommentAction`) call `getCurrentUser()` first and verify ownership/authorship server-side before any mutation — a crafted request with a mismatched `authorId` is rejected.
  2. Like notifications fire only on the `liked = true` direction (not unlike), are never sent to the watch/wear owner from themselves, and a dedup partial UNIQUE index on `notifications` prevents duplicate like notification rows for the same actor/target pair.
  3. Rapid like → unlike → like sequences produce at most one like notification entry (dedup confirmed in an integration or unit test against the dedup index).
  4. Comment notifications fire on every new comment that is not self-authored; the actor and target are stored correctly so the bell can deep-link to the watch or wear.
  5. Cache tags (`reactions:{targetType}:{targetId}`, `viewer:{userId}:reactions`) are invalidated on mutation: `updateTag` for read-your-own-writes, `revalidateTag(..., 'max')` for cross-user fan-out — viewer A's like state does not appear in viewer B's cache.
**Plans**: 6 plans
  - [x] 55-01-PLAN.md — Wave 0: Nyquist test scaffolds (reactions/comments action tests + extend logger.test.ts) — RED until impl
  - [x] 55-02-PLAN.md — Wave 1: dedup-index migration (NOTIF-14) + in-place WR-03 enum-assertion fix + local apply + ActionResult `code` field (D-09)
  - [x] 55-03-PLAN.md — Wave 1: logger extension — 4 payload types, union widening, notifyOnLike/Comment opt-out reads, raw-SQL ON CONFLICT like branches (NOTIF-11/12/13/14)
  - [x] 55-04-PLAN.md — Wave 2: toggleLikeAction (SEC-03 IDOR + SEC-05 two-tag cache + liked-only awaited notification)
  - [x] 55-05-PLAN.md — Wave 2: addCommentAction/editCommentAction/deleteCommentAction (SEC-03 + NOTIF-12 INSERT-only + D-09 gate code + profile-only invalidation)
  - [x] 55-06-PLAN.md — Wave 3: [BLOCKING] pre-push gate + `supabase db push --linked` prod push, confirm both dedup indexes live (D-03, autonomous:false)

### Phase 56: Like UI
**Goal**: Any authenticated viewer can like or unlike individual watches and wear posts from the detail pages, with optimistic UI that reflects their action immediately and rolls back cleanly on failure — like counts are visible next to the control and hidden when zero.
**Depends on**: Phase 55
**Requirements**: LIKE-01, LIKE-02, LIKE-03, LIKE-04
**Success Criteria** (what must be TRUE):
  1. A viewer can click the like control on any watch detail page (`/watch/[id]`) and on any wear detail page (`/wear/[wearEventId]`) regardless of the watch's status (owned/sold/grail/wishlist).
  2. The like control reflects the viewer's current like state (liked / not liked) without a page reload; toggling updates the state optimistically and snaps back if the Server Action returns an error.
  3. The like count appears next to the control when at least one like exists and is hidden when the count is zero.
  4. Liking the same watch or wear twice (e.g., via double-click or concurrent tabs) results in exactly one like row — the UNIQUE constraint is the backstop, and the UI does not show an error to the user for idempotent re-likes.
**Plans**: 3 plans
Plans:
**Wave 1**
- [x] 56-01-PLAN.md — LikeButton component + Wave 0 tests + getLikesForTargetCached cached read (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 56-02-PLAN.md — Watch detail page wiring: LikeButton under title + server hydration (Wave 2)
- [x] 56-03-PLAN.md — Wear detail redesign: photo overlays + footer LikeButton + anon hydration (Wave 2)
**UI hint**: yes

### Phase 56a: Wear View Unification
**Goal**: Unify the two disconnected wear-viewing experiences into two purpose-built routes that share one wear-content card, one LikeButton, and one comment component — so likes/comments are reachable while browsing instead of stranded on an orphan permalink — BEFORE the comment thread UI is built. `/wears/[username]` is the full-screen, no-nav, viewport-fit "stories" lane (swipe through a user's active wears ~48h, then user→user) with Reels-style INLINE engagement (comments in a bottom sheet over the photo); `/wear/[id]` is the conventional nav-retaining, vertically-scrollable single-wear permalink (inline comment list) reached by direct URL / share / notification deep-link.
**Depends on**: Phase 56
**Requirements**: TBD — defined at discuss/spec. UX/architecture restructuring: consumes LIKE-01..04 (Phase 56) and establishes the shared component contracts that shape CMNT-* delivery in Phase 57; relates to the WYWT feature (Phases 10/15) and FEED-06/07. See seed `wear-view-unification` + note `wear-view-unification-decisions`.
**Success Criteria** (what must be TRUE):
  1. Tapping a wear in the home rail opens `/wears/[username]` (a real route — not a client-only modal with the URL stuck on `/`), showing that user's active wears (~48h) in a swipeable carousel that advances user→user.
  2. `/wears/[username]` is full-screen on mobile (no nav chrome), fits the viewport without page scroll, and offers inline like + comment (comments open in a bottom sheet over the photo) — no navigation away to engage.
  3. `/wear/[id]` keeps the nav bars, is vertically scrollable, shows a single wear (no swipe) with the same photo/overlay card, the like control, and an inline comment list; it is reachable by direct URL / share / notification and has a working back/close affordance.
  4. The wear-content card, the LikeButton, and the comment component are single shared components rendered by both routes (visual + behavioral parity; divergence limited to container chrome).
  5. The legacy WYWT client overlay (`WywtOverlay`/`WywtSlide` modal that left the URL on `/`) is replaced by the routed `/wears/[username]` experience; the "Add to wishlist" action is preserved or relocated per the spec decision (open fork).
**Plans**: 5 plans
Plans:
**Wave 1**
- [x] 56A-01-PLAN.md — Wave 0 test scaffolds + getActiveWearsForUser DAL (48h/oldest-first/three-tier gate, raw photoUrl)
- [x] 56A-02-PLAN.md — Shared components: WearCard + WearCommentHost (empty placeholder body) + WearOverflowMenu (D-12/D-10/D-08/D-09)

**Wave 2** *(blocked on Wave 1)*
- [ ] 56A-03-PLAN.md — /wears/[username] stories lane page + WearsLane carousel (SC-1/SC-2, D-04/05/06/07, F-2)
- [ ] 56A-04-PLAN.md — /wear/[id] refactor to shared WearCard + EN-6 anon cleanup (SC-3/SC-4, D-02)

**Wave 3** *(blocked on Wave 2; deletion gated after lane renders, SC-5)*
- [ ] 56A-05-PLAN.md — WywtRail → router.push rewire + nav-hiding (BottomNav/SlimTopNav) + delete WywtOverlay/WywtSlide (SC-1/SC-2/SC-5)
**UI hint**: yes

### Phase 57: Comment Thread UI + Feed Extension + Grid Counts
**Goal**: Any authenticated viewer can read comments on watches and wears, compose and post new comments, edit or delete their own comments in place — with the wishlist mutual-follow gate reflected in a clear locked-state UI — and comment activity surfaces correctly in the Network Activity feed and on profile grid cards.
**Depends on**: Phase 56a
**Requirements**: CMNT-01, CMNT-02, CMNT-03, CMNT-04, CMNT-05, CMNT-06, CMNT-07, CMNT-08, CMNT-09, GATE-03, FEED-06, FEED-07, DISP-01
**Success Criteria** (what must be TRUE):
  1. A viewer can post a comment on a watch (owned/sold/grail) or wear event; comments appear newest-first with the compose box above the list, showing author avatar, linked username, body text, and relative timestamp.
  2. The compose box enforces a 500-character limit: the input itself, the Server Action (Zod `.strict()`), and the database CHECK all reject oversized or whitespace-only input; a live character counter appears as the user nears the limit.
  3. A comment author can edit their own comment in place (showing an "[edited]" indicator after save) and delete it via an inline confirm; non-authors see neither control.
  4. A new comment appears optimistically at the top of the list in a pending state and reconciles to the server-confirmed row on success, or disappears with a rollback indicator on failure.
  5. A non-mutual-follower viewing a wishlist watch sees a "Follow [username] to comment" locked-state CTA instead of the compose box, with no comment content visible; an owner always sees the compose box on their own watches.
  6. When a user comments on a watch or wear, a comment activity is recorded and appears in the home Network Activity feed for their followers — but a comment on a mutual-follow-gated wishlist watch is not surfaced to viewers who are not eligible to see it.
  7. Profile collection and wishlist grid cards show a "X likes · Y comments" line per watch sourced from a single batched query (no N+1 on grid load).
**Plans**: TBD
**UI hint**: yes

### Phase 58: Notification UI + Settings Opt-Out
**Goal**: Like and comment notifications appear in the existing bell/inbox with clear copy and deep-links to the target watch or wear, like notifications for the same target are grouped, and users can independently opt out of each notification type in Settings.
**Depends on**: Phase 57
**Requirements**: NOTIF-15, NOTIF-16
**Success Criteria** (what must be TRUE):
  1. The bell dot and `/notifications` inbox render `watch_like`, `wear_like`, `watch_comment`, and `wear_comment` notification types with copy that names the actor and the target, and each notification links directly to the relevant watch or wear detail page.
  2. Multiple likes on the same target are grouped into a single notification row ("Tyler and 2 others liked your Submariner") rather than one row per like.
  3. The Settings → Notifications section exposes `notifyOnLike` and `notifyOnComment` toggles; disabling `notifyOnLike` suppresses future like notification rows from being created (verified by toggling off, liking a watch, and confirming no new notification row appears).
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 53. Schema + RLS + Enum Extension | 3/3 | Complete    | 2026-05-22 |
| 54. DAL — Reactions, Comments + Gate Logic | 3/3 | Complete    | 2026-05-22 |
| 55. Server Actions + Notification Dedup | 6/6 | Complete    | 2026-05-22 |
| 56. Like UI | 3/3 | Complete   | 2026-05-23 |
| 56a. Wear View Unification | 2/5 | In Progress|  |
| 57. Comment Thread UI + Feed Extension + Grid Counts | 0/TBD | Not started | - |
| 58. Notification UI + Settings Opt-Out | 0/TBD | Not started | - |

## Next Up

v6.0 Social Interaction roadmapped 2026-05-22 — 6 phases (53-58), 34 requirements. Run `/gsd-plan-phase 53` to begin Phase 53.

### Phase 51: Profile Route PPR Opt-Out — recurrence-3 fix for /u/[username]/[tab] 404

**Goal:** Eliminate the `/u/[username]/[tab]` 404 on state-tree-aware RSC requests (third recurrence) by removing Cache Components PPR qualification at the source (F3-Composite). Operator-decided Branch B re-gates `/u/*` to authenticated viewers with a cookie-only proxy check and `Cache-Control: no-store` on the 307 — closes recurrence-2 cause structurally.
**Requirements**: REQ-51-01, REQ-51-02, REQ-51-03, REQ-51-04, REQ-51-05, REQ-51-06, REQ-51-07
**Depends on:** none (hotfix branch off main)
**Plans:** 8/9 plans executed

Plans:
- [x] 51-01-PLAN.md — Author tests/profile-route-51.test.ts + scripts/verify-phase-51-prod.sh + scripts/assert-phase-51-build.mjs (Wave 0, TDD scaffolds expected to initially FAIL)
- [x] 51-02-PLAN.md — Refactor ProfileGate to accept viewerId as a prop (Wave 1)
- [x] 51-03-PLAN.md — Collapse layout to static shell; move gate composition + Suspense into [tab]/page.tsx (Wave 2 — F3-Composite structural change)
- [x] 51-04-PLAN.md — (Branch B) Convert src/lib/supabase/proxy.ts:updateSession to cookie-only getSession() (Wave 3 — Branch B safety prerequisite)
- [x] 51-05-PLAN.md — (Branch B) Re-gate /u/* in src/proxy.ts; delete isProfilePath; add Cache-Control: no-store on 307 (Wave 4)
- [x] 51-06-PLAN.md — Vercel preview deploy + prod-contract curl verification + operator UAT + merge gate (Wave 5; non-autonomous)
- [x] 51-07-PLAN.md — (optional) Migrate /u/[username] bare-redirect to next.config.ts redirects() rule (Wave 5)
- [x] 51-08-PLAN.md — Close .planning/debug/profile-page-404-top-nav.md frontmatter (Wave 6)

### Phase 52: Option D — Cache Components canonical pattern fix for /u/[username]/[tab] (recurrence-4 React #419)

**Goal:** Eliminate the React #419 + 404 recurrence (4th) on authenticated `/u/[username]/[tab]` navigation by adopting the canonical Next 16 Cache Components pattern — push dynamic access down, wrap runtime-API consumers in Suspense, and re-introduce `unstable_instant = { prefetch: 'static' }` as a build/dev validator so this bug class is caught at build time, not in prod after cache revalidation. Keeps Phase 51 Branch B contract (anon `/u/*` → 307 + `no-store`) intact.
**Requirements**: REQ-52-01, REQ-52-02, REQ-52-03a, REQ-52-03b, REQ-52-04, REQ-52-05, REQ-52-06, REQ-52-07, REQ-52-08, REQ-52-09, REQ-52-10
**Depends on:** Phase 51 (Branch B 307 + `no-store` contract must remain live through this fix)
**Source:** `.planning/audits/cache-components-2026-05-21-followup.md` (Option D plan, supersedes the original audit's "three forward options")
**Related:** `.planning/audits/cache-components-2026-05-21.md`, `.planning/debug/resolved/profile-page-404-top-nav.md`
**Plans:** 9/9 plans complete

Plans:
**Wave 1**
- [x] 52-01-PLAN.md — Wave 0: invert Test 1 + add Tests 4/5 to tests/profile-route-51.test.ts (TDD source-grep scaffolds, expected to fail on current main)
- [x] 52-02-PLAN.md — Wave 0: install @playwright/test + @next/playwright, scaffold playwright.config.ts + tests/e2e/{auth-setup,profile-tab-instant}.test.ts (e2e regression contract)
- [x] 52-03-PLAN.md — Wave 1: Step 1 probe — add only `unstable_instant = { prefetch: 'static' }` to [tab]/page.tsx, capture validator output verbatim into 52-03-VALIDATOR-OUTPUT.md

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 52-04-PLAN.md — Wave 2: create profile-chrome.tsx (async runtime-API consumer) + refactor layout.tsx to sync + Suspense around ProfileChrome (REQ-52-03a/03b)
- [x] 52-05-PLAN.md — Wave 2: restructure [tab]/page.tsx — outer sync + inner async ProfileTabContent wrapped in Suspense (REQ-52-04)
- [x] 52-06-PLAN.md — Wave 2: apply unstable_instant=false opt-outs to cross-route surfaces from VALIDATOR-OUTPUT (REQ-52-05); record FINDINGS for SEED-014 hand-off

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 52-07-PLAN.md — Wave 3: CR-01 proxy.ts comment correction + delete scripts/assert-phase-51-build.mjs + create SEED-014-cache-components-canonical-sweep.md (REQ-52-09)
- [x] 52-08-PLAN.md — Wave 3: doc reversals — rewrite [tab]/page.tsx + loading.tsx + profile-gate.tsx comments + annotate 51-CONTEXT.md (D-52-11/12/14)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 52-09-PLAN.md — Wave 4: pre-deploy gates + Vercel deploy + Branch B curl verification + operator UAT (2x cycles + 15-min cache-revalidation wait) — recurrence-4 prevention contract

**Scope (provisional — validator output drives final shape):**
- Add `unstable_instant = { prefetch: 'static' }` to `src/app/u/[username]/[tab]/page.tsx` (validation export)
- Refactor `src/app/u/[username]/layout.tsx` to sync, with `<Suspense>` around a new async `ProfileChrome` component
- New file: `src/app/u/[username]/profile-chrome.tsx` (async; awaits `params` + `getCurrentUser()`; wraps `ProfileGate`)
- Restructure `src/app/u/[username]/[tab]/page.tsx`: hoist body into inner `ProfileTabContent` wrapped in `<Suspense>`
- Update `tests/profile-route-51.test.ts` regression assertions (REQ-51-04 revision)
- New Playwright `instant()` test pinning "chrome stays mounted across tab navigation"

**Out of scope (deferred to follow-up phases):**
- `'use cache'` → `'use cache: remote'` migration for `ProfileShellResolver` (in-memory-only-on-serverless finding)
- Real 404 HTTP status for unknown username (`notFound()` mid-stream is 200 + noindex)
- CR-01 `proxy.ts` safety-comment correction
- `scripts/assert-phase-51-build.mjs` delete/replace (silently broken — Next 16.2 manifest shape mismatch)

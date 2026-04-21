# Phase 10: Activity Feed - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Requirements (core):** FEED-01, FEED-02, FEED-03, FEED-04
**Requirements (expanded into Phase 10 per user decision):** WYWT-03, DISC-02, DISC-04 (+ new home-insights surface)

<domain>
## Phase Boundary

The home page at `/` becomes a 5-section network home for authenticated users. Sections, top → bottom:

1. **What You're Wearing Today (WYWT)** — Instagram Reels-style rail of last-48h wear events from followed collectors + viewer's self-post tile.
2. **From Collectors Like You** — rule-based watch recommendations drawn from similar collectors' owned watches.
3. **Network Activity** — keyset-paginated feed of `watch_added`, `wishlist_added`, `watch_worn` events from followed collectors.
4. **Personal Insights** — up to 4 cards (Sleeping Beauty, Most Worn This Month, Wishlist Gap, Common Ground with a follower).
5. **Suggested Collectors** — follow CTAs for unfollowed public profiles ranked by taste overlap.

Top nav in this phase: `+ Wear` button (opens watch picker → markAsWorn) + `+` Add button (Add Watch modal). Explore link, global search, and notifications bell are hidden until their respective requirements ship.

**Not in this phase:** Explore surface (EXPL-*), global search (SRCH-*), notifications (NOTF-*), real bulk-import UX (future phase; FEED-04 satisfied at feed-read via time-window collapse), cross-device viewed-state sync (localStorage-only), collaborative-filtering recommendations, rec-rotation cron.

**Scope flag for downstream docs update:** REQUIREMENTS.md and ROADMAP.md currently scope Phase 10 to Network Activity alone. The planner or `/gsd-docs-update` must update both to reflect the expanded 5-section home, promote WYWT-03/DISC-02/DISC-04 into v2.0, add a new FEED-05 "home personal insights surface" requirement, and refresh the Phase 10 Success Criteria.

</domain>

<decisions>
## Implementation Decisions

### Home Layout (all sections)

- **L-01: Section order = Figma order.** Top → bottom: WYWT → From Collectors Like You → Network Activity → Personal Insights → Suggested Collectors.
- **L-02: Zero-state = onboarding home.** A user with zero follows and zero wear events still sees the full layout. Each section has its own empty state: WYWT = self-prompt tile only; Collectors Like You = seeded recs (works off the viewer's own collection alone); Network Activity = "Follow collectors to see their activity"; Personal Insights = section hidden if viewer has no watches; Suggested = always rendered when public profiles exist.
- **L-03: Personal collection lives at `/u/[me]/collection`.** Already built in Phase 8. Top-nav `+` and WYWT self-tile give quick access without leaving home. No dedicated `/collection` route, no duplicated "My Collection" section on home.

### Network Activity Feed (FEED-01 / FEED-02 / FEED-03 / FEED-04)

- **F-01: Row layout = avatar left, text center, watch thumbnail right.** Row content: `{avatar} {username} {verb} {watchName}` over `{time ago}`, with watch thumbnail (from `activities.metadata.imageUrl`) on the far right. This overrides the Figma static mock (which draws avatar on the right).
- **F-02: Verbs are flat.** `wore {X}`, `added {X}`, `wishlisted {X}`. Same row template for all three event types; verb text differs.
- **F-03: Row click → collector profile.** Clicking anywhere on the row except the watch name navigates to `/u/{username}/collection`. Watch name is a separate tappable target → `/watch/{id}` (or the collector's watch detail route — planner decides).
- **F-04: Pagination = Load More button, 20 per page, keyset cursor.** Cursor = `(created_at, id)` DESC. No OFFSET. Server Action or DAL accepts a cursor; client swaps the button for a spinner while fetching, then appends new rows. Matches research PITFALL #6.
- **F-05: Filter viewer's own events out of the main feed.** Own activities remain visible on the viewer's own `/u/[me]/stats` / `/u/[me]/worn` tabs (Phase 8). Matches research recommendation: feed is for discovery, not personal log.
- **F-06: Privacy gate = per-event, no follow bypass.**
  - `watch_added` / `wishlist_added` hidden when actor's `collection_public` / `wishlist_public` is `false`
  - `watch_worn` hidden when actor's `worn_public` is `false`
  - Actor with `profile_public = false` → all their activity rows hidden from non-owner viewers
  - Follows do NOT unlock private content (carries Phase 9 D-08: privacy is per-tab, not per-relationship)
  - Enforced at BOTH RLS and DAL WHERE clause layers (carries Phase 9 D-20, PRIV-05)
- **F-07: New events = silent insert on router.refresh.** No "N new activities" banner, no highlight fade. `router.refresh()` after a follow/unfollow or periodic user-triggered refresh re-renders the feed server-side with fresh rows. Aligns with "no Realtime" posture.
- **F-08: Bulk aggregation = time-window collapse at feed-read time (FEED-04).** Feed DAL collapses `≥3` same-type events (`watch_added` or `wishlist_added`) from the same actor within a 1-hour window into ONE aggregated row. Display: `{username} added {N} watches · {time ago}`. Expandable on click (optional — planner discretion on expand UI). Zero writer-side changes. Works today for real-world bursty sessions; transparently handles any future bulk-import UX.

### WYWT Rail (WYWT-03 scoped in)

- **W-01: Source = last 48h rolling, most-recent-per-user.** Query `wear_events` where `worn_date ≥ now - 48h` AND actor is in viewer's follow list (or is viewer), then keep only each actor's most recent wear. Respects `profile_settings.worn_public` at the DAL layer. Viewer's own wear always included (self-tile).
- **W-02: Self-tile → watch picker dialog.** Tile label "What are you wearing?" with `+` icon. Click opens a lightweight modal listing the viewer's owned watches (thumbnail + brand + model, searchable if list is long). Select one → calls existing `markAsWorn` Server Action → rail updates to show self-tile with that watch. No navigation away from home.
- **W-03: Empty rail = self-tile only.** If viewer follows people but none of them have a wear in the last 48h, the rail shows only the self-CTA tile. Section is never hidden entirely.
- **W-04: Tile visual = Instagram Reels feel.** Full-bleed watch photo fills the tile square, username + time below. Viewed / not-viewed state shown via border ring (unviewed = accent/gold ring; viewed = neutral/muted). Signifier style is planner's discretion as long as there is a clear visual distinction.
- **W-05: Tap tile = full-screen on mobile, modal on desktop.** Overlay content:
  - Large watch photo (full bleed on mobile)
  - Username + relative time
  - Watch brand + model — tappable link → watch detail
  - "Add to wishlist" action button — creates a NEW watch row in viewer's collection with `status='wishlist'`, snapshotting brand/model/image from the viewed wear event. (Per Horlo's per-user-independent-entries model; no canonical watch table.)
  - Caption / note text if `wear_events.note` is non-empty
  - Swipe/tap forward → next tile. Swipe back → previous tile. Swipe down (mobile) / ESC or click-outside (desktop) → close.
  - Opening a tile marks its `wear_event.id` as viewed.
- **W-06: Viewed tracking = localStorage per viewer.** Set of viewed `wear_event.id` values stored in `localStorage` under a namespaced key. No DB writes, no cross-device sync. Acceptable because "unviewed" is a visual nudge, not load-bearing state. Cross-device sync via a `wear_event_views` table is deferred.
- **W-07: Rail = horizontal scroll, no hard cap.** Dedupe-per-user + 48h window naturally bounds the rail length; no artificial cap needed at MVP scale.

### From Collectors Like You (DISC-02 scoped in)

- **C-01: "Similar" = Phase 9 `tasteOverlap` score.** Top-N public collectors (excluding viewer) ranked by overlap score from `src/lib/tasteOverlap.ts`. N tunable by planner; start around 10–20 seed collectors to sample their owned-lists from.
- **C-02: Candidate pool = similar collectors' owned watches, minus viewer's own + wishlist.** Pull owned watches from those top-N collectors, dedupe by normalized `(brand, model)`, subtract anything the viewer already owns OR has wishlisted. Result is the rec candidate set.
- **C-03: Rationale = rule-based templates from tags.** No LLM. Template rules run per candidate watch against viewer's collection composition:
  - If candidate has `dive` roleTag and ≥5 similar collectors own it → "Popular among dive watch collectors"
  - If candidate brand = viewer's top-owned brand → "Fans of {brand} love this"
  - If candidate style overlaps >50% with viewer's dominant style → "Matches your {style} collection"
  - If candidate is paired (owned alongside) with viewer's most-worn watch type → "Often paired with {type}"
  - Exact thresholds and template list are planner's discretion; the constraint is: deterministic, no external calls, no ANTHROPIC_API_KEY dependency on home render.
- **C-04: 4 visible cards, horizontal scroll, cap ~12.** Top 4 by score render visible on desktop and mobile. Mobile swipes right to reveal cards 5–8 and 9–12. No "Load More" pattern here.
- **C-05: Card click → watch detail.** `/watch/{id}` for a representative owner's instance of that `(brand, model)`. Per-user watch entries mean the planner picks one instance; prefer the instance belonging to the highest-overlap collector for that `(brand, model)`.
- **C-06: Rec freshness = per-request, cached.** Computed server-side per home render; cached per viewer via Next.js 16 Cache Components (`cacheLife` ~5 minutes). Balances freshness against `tasteOverlap` cost as public collector count grows.
- **C-07: Dedupe = normalized `(brand, model)`.** Lowercase + trim both sides. Matches Phase 9 D-01 Common Ground dedupe. Prevents "Submariner" being recommended to someone who already owns a Submariner under a different casing.

### Personal Insights

- **I-01: Four cards in Phase 10.**
  - **Sleeping Beauty alert** (`Alert` badge) — reuses existing `/insights` logic for "not worn in N days"
  - **Most worn this month** — top watch by `wear_events` count for the current calendar month
  - **Wishlist gap** (`Tip` badge) — NEW logic: derive the under-represented style/role in owned collection and suggest addressing it
  - **Common Ground with a follower** — picks one follower (or followed collector) with highest `tasteOverlap`, shows their handle + shared watch count
- **I-02: Source = reuse `/insights` lib + new `wishlist-gap` fn.** Existing insight functions live in the shared lib under `src/lib/` (or wherever `/insights` already reads from). Phase 10 adds a `wishlistGap()` function. No duplication of insight logic between `/insights` and home.
- **I-03: Every card is clickable, contextual target.**
  - Sleeping Beauty → watch detail for the neglected watch (user override — NOT "Log Wear")
  - Most Worn → watch detail for that watch
  - Wishlist Gap → Claude's discretion (filtered wishlist view, or scroll-to / refresh Collectors Like You section with a style filter applied)
  - Common Ground → that follower's profile, defaulting to the Common Ground 6th tab from Phase 9
- **I-04: If viewer has no watches, hide Personal Insights section entirely.** Layout collapses gracefully.

### Suggested Collectors (DISC-04 scoped in)

- **S-01: Pool = public profiles the viewer does not follow.** Ordered by `tasteOverlap` DESC. Private profiles are excluded from suggestions (follow is possible on private profiles per Phase 9 D-08, but surfacing a profile the viewer cannot browse in a "discover" section feels off).
- **S-02: Card = Figma-faithful.** Row contents (left → right):
  - Avatar + username (top line) + overlap % "68% taste overlap" (second line)
  - 2–3 mini watch thumbnails showing shared `(brand, model)` watches
  - "{N} shared" count label
  - Follow button (right)
- **S-03: 3–5 rows visible, Load More reveals more.** Top 3–5 by overlap initially. Load More fetches the next batch.
- **S-04: Follow behavior = stay in place + button flips to "Following".** Row does not animate out on follow. Button uses the Phase 9 D-09 semantics: "Following" muted label, hover swap to "Unfollow" on desktop / two-tap pattern on mobile. Optimistic UI from Phase 9 D-06 applies.

### Top Nav (Phase 10 scope)

- **N-01: Phase 10 nav additions = `+ Wear` + `+` Add.**
  - `+ Wear` button in nav opens the same watch picker as the WYWT self-tile. (One dialog, two entry points.)
  - `+` Add button opens the Add Watch flow (reuses existing AddWatch UX).
- **N-02: Explore link, global search bar, notifications bell = hidden.** They appear in the Figma but belong to deferred requirements (EXPL-*, SRCH-*, NOTF-*). Render them in Phase 10 only if the planner sees no-cost way; otherwise omit entirely until the feature lands.
- **N-03: Real bulk-import UX is deferred to a future phase.** FEED-04 is satisfied in Phase 10 by F-08 time-window collapse. When a dedicated bulk-import form ships later, it can optionally emit ONE aggregate activity row at write time — but that's an optimization, not a requirement.

### Claude's Discretion

- Exact dimensions, spacing, and typographic scale of sections / cards / rails
- Exact SQL structure of the feed JOIN (activities ⋈ follows ⋈ users ⋈ profiles) — must be ≤2 queries per feed page, verified via EXPLAIN ANALYZE
- Keyset cursor encoding on the wire (opaque base64 of `{created_at, id}` vs. plain tuple)
- Thresholds and full template list for "Collectors Like You" rationale lines
- Swipe gesture implementation for WYWT overlay — hand-rolled pointer events or a lightweight library (avoid adding a heavy carousel dep)
- Wishlist-gap algorithm specifics (how to measure under-representation; what threshold makes it "a gap")
- Sign-in redirect UX if an unauth viewer somehow hits the "Add to wishlist" action from a WYWT overlay
- Toast placement and content on optimistic follow errors in the Suggested Collectors section
- Whether localStorage viewed-state schema uses an array, Set-as-JSON, or timestamp-indexed map
- Whether "Add to wishlist" from the WYWT overlay creates the new wishlist row server-side from the viewed `wear_event` metadata, or prompts the viewer to confirm brand/model first
- Choice between a `/watch/{id}` route and an existing watch-detail surface for feed + rec clicks (pick the one already wired in Phase 8/9, or create one here)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design
- **Figma node id `1:2205`** (Body frame) — the home-page design spec. Access via Figma desktop MCP: `get_design_context(nodeId: "1:2205")`. Full file URL to be added by the planner via `get_metadata` once the file key is resolved. Child frames worth individually inspecting: `1:2208` WearRail, `1:2361` From Collectors Like You, `1:2405` ActivityStack (Network Activity), `1:2553` PersonalInsightsPanel, `1:2585` UserSuggestionRow.

### Phase 10 Research (project-wide v2.0 research, not phase-specific)
- `.planning/research/ARCHITECTURE.md` — activity feed DAL shape (lines 337–350 feed flow, 417–421 integration steps), snapshot-metadata rationale (line 115), N+1 and lazy-loading pitfalls, per-event verb model
- `.planning/research/FEATURES.md` — feed-level decisions (line 27, 46, 65, 73, 75 event rate limiting for bulk), activity type signal strength, "discovery not engagement" positioning (line 56)
- `.planning/research/PITFALLS.md` — Pitfall 5 (N+1 in feed, line 136), Pitfall 6 (OFFSET pagination, line 176), RLS on `activities` (line 320), own-activity filter (line 363)

### Prior Phase Context (carry-forward)
- `.planning/phases/07-social-schema-profile-auto-creation/07-CONTEXT.md` — D-05 activities logged from day one (historical data exists), D-06 snapshot metadata guarantees feed readability post-delete, activities indexing decisions
- `.planning/phases/08-self-profile-privacy-controls/08-CONTEXT.md` — D-03 home preserved as dashboard until Phase 10 (this phase flips it), D-13 per-note `notes_public` model, D-15 two-layer privacy (RLS + DAL), D-09 Worn tab Log Today's Wear flow (reused by WYWT self-tile)
- `.planning/phases/09-follow-system-collector-profiles/09-CONTEXT.md` — D-06 optimistic-UI follow pattern (reused by Suggested Collectors), D-08 follows never bypass privacy (critical for F-06), D-09 hover-swap Following/Unfollow button (reused), D-20 two-layer privacy enforcement, tasteOverlap library

### Database & Schema
- `src/db/schema.ts` — `activities` table (lines 168–182: `userId`, `type`, `watchId`, `metadata jsonb`, `createdAt`; indexes `activities_user_id_idx` and composite `activities_user_created_at_idx`), `wear_events` (lines 184–198), `follows` (lines 144–157), `profile_settings` (lines 159–166), `profiles` (lines 130–142)

### DAL (read for extension in this phase)
- `src/data/activities.ts` — existing `logActivity` helper. Phase 10 adds `getFeedForUser(userId, cursor, limit)`, aggregation logic for F-08
- `src/data/follows.ts` — follow graph reads; feed JOIN consumes this
- `src/data/profiles.ts` — `getProfileByUsername`, `getProfileSettings`, `getFollowerCounts`
- `src/data/wearEvents.ts` — `getPublicWearEventsForViewer` (Phase 8 Plan 01); WYWT DAL consumes this
- `src/data/watches.ts` — watch reads for feed JOIN, recommendation candidate pool, self-tile watch picker

### Libraries (reuse + extend)
- `src/lib/tasteOverlap.ts` — Phase 9 server-compatible overlap. Consumed by Collectors Like You (C-01), Personal Insights Common Ground card (I-01), Suggested Collectors (S-01). Phase 10 is the third consumer.
- `src/lib/similarity.ts` — underlying similarity engine; no changes needed
- `src/lib/auth.ts` — `getCurrentUser` gate on every new DAL/Server Action
- Existing `/insights` page logic under `src/app/insights/*` and any supporting lib files — reused by Personal Insights cards (I-02)

### Home Page & Components
- `src/app/page.tsx` — currently renders `CollectionView`. Phase 10 replaces this with the 5-section home for authenticated users.
- `src/app/insights/*` — existing insights surface; Phase 10 extracts/reuses logic, doesn't replace the page
- `src/components/profile/ProfileWatchCard.tsx` — reuse for Collectors Like You cards if shape fits
- `src/components/profile/AvatarDisplay.tsx` — reuse in WYWT tiles, feed rows, Suggested Collectors
- `src/components/profile/TasteTagPill.tsx` — reuse if Personal Insights ends up rendering tags
- `src/components/profile/HorizontalBarChart.tsx` — reuse if any insight card needs a bar
- Phase 9 `FollowButton` component — reuse for Suggested Collectors rows

### Server Actions (new / extend)
- `src/app/actions/wearEvents.ts` — existing `markAsWorn`; WYWT self-tile picker calls this
- `src/app/actions/follows.ts` — existing `followUser` / `unfollowUser`; Suggested Collectors calls these
- `src/app/actions/` — NEW: potentially `addToWishlist` Server Action for WYWT overlay "Add to wishlist" button (or reuse existing `addWatch` with `status='wishlist'`)
- Feed pagination "Load More" — can use a Server Action that returns the next page, or a Server Component that re-reads with the cursor

### Next.js 16 / Vercel
- Next.js 16 Cache Components (`cacheLife`, `cacheTag`, `use cache`) for C-06 rec caching. Reference the Vercel `next-cache-components` skill before implementing.
- `router.refresh()` for silent-insert on follow/unfollow (carries Phase 9 D-06).

### Deploy & Migrations
- `docs/deploy-db-setup.md` — prod migration runbook. Phase 10 likely needs NO schema migrations (activities + wear_events already in prod from Phase 7); double-check during planning.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Activity logging is already live in prod.** `logActivity()` is wired into `addWatch` (src/app/actions/watches.ts:69) and `markAsWorn` (src/app/actions/wearEvents.ts:39). Historical data exists. Phase 10 is purely a read-side + UI build.
- **`wishlist_added` event type is already being written** — addWatch (watches.ts:66) branches on `status === 'wishlist' || 'grail'` and logs `wishlist_added`. Feed can rely on this today.
- **`activities_user_created_at_idx`** composite index on `(user_id, created_at)` is already in schema — supports the feed JOIN efficiently.
- **`getPublicWearEventsForViewer` DAL (Phase 8)** already handles worn_public privacy gating — WYWT DAL should compose with it rather than duplicate logic.
- **`tasteOverlap.ts` (Phase 9)** exists and is server-compatible. Three sections in Phase 10 consume it.
- **`FollowButton`, `AvatarDisplay`, `ProfileWatchCard`** from Phase 8/9 are ready-to-use.
- **Phase 8 D-03 explicitly noted**: "Phase 10 will introduce the activity feed at `/`." The home-page swap is expected.

### Established Patterns (must follow)
- Server Components for home page (Anti-Pattern #2 in research: never fetch feed in a client component)
- Single JOIN (or ≤2 queries) for feed — verified via EXPLAIN ANALYZE (Pitfall 5)
- Keyset cursor pagination, never OFFSET (Pitfall 6)
- Two-layer privacy: RLS + DAL WHERE clause (PRIV-05, Phase 9 D-20)
- Optimistic UI → Server Action → `router.refresh()` reconciliation (Phase 9 D-06)
- Zod strict schemas on every new Server Action input
- `getCurrentUser()` gate on every new DAL function
- Activity logging stays fire-and-forget — failure of a log write never blocks the primary mutation (carries Phase 7)
- No Supabase Realtime (free-tier WS cap); `router.refresh()` is the reconciliation primitive

### Integration Points
- `src/app/page.tsx` — replaced with the 5-section layout for authenticated users
- `src/data/activities.ts` — extended with `getFeedForUser(userId, cursor, limit)` that handles F-05 own-filter, F-06 privacy gating, F-08 time-window collapse
- New DAL function for WYWT rail (e.g., `getWearRailForViewer(userId)`) composing `getPublicWearEventsForViewer` with the 48h + dedupe rules
- New DAL function for Collectors Like You (e.g., `getRecommendationsForViewer(userId)`) composing `tasteOverlap` + candidate filtering
- New DAL function for Suggested Collectors (e.g., `getSuggestedCollectors(userId, cursor)`)
- `src/app/actions/wearEvents.ts` — `markAsWorn` callable from WYWT self-tile picker dialog
- RLS policies on `activities` table — confirm SELECT policy allows reading own + activities-from-followed-users (per research line 320). If missing, add in Phase 10.

### Constraints from Prior Phases
- Follows never bypass privacy (Phase 9 D-08) — enforced at both DAL and RLS
- Common Ground / tasteOverlap uses normalized `(brand, model)` dedupe (Phase 9 D-01) — Phase 10 reuses for C-07
- Per-user-independent watches (no canonical watch DB) — "Add to wishlist" from WYWT overlay creates a NEW watch row snapshotted from wear-event metadata
- `/` was the personal dashboard until now (Phase 8 D-03) — users will notice the swap; owner profile preserves their original UX at `/u/[me]/collection`

### Outdated Intel
- `.planning/codebase/INTEGRATIONS.md` still describes a localStorage-only single-user app with no DB. It is stale and must be ignored; project has moved to Supabase Postgres + Drizzle since Phase 3. Worth refreshing via `/gsd-map-codebase` or `/gsd-intel` at some point — not a Phase 10 blocker.

</code_context>

<specifics>
## Specific Ideas

- **"Instagram Reels feel" for WYWT** — the rail should read as an ephemeral, daily-refreshing strip of wear events from the network. Viewed-state borders give a gentle "you haven't seen this yet" nudge. This is the strongest daily-retention hook in the product; tilt decisions toward scannability and quick dismiss.
- **Event card row layout deviation from Figma** — avatar LEFT, text middle, watch thumbnail RIGHT. The Figma mock drew avatar on the right; user corrected this. This matches common feed patterns (Twitter, Letterboxd) and makes the username + verb + watch scan left-to-right.
- **Flat verbs over preposition-rich** — `wore X`, not `wore X today`. Keeps rows scannable at high density.
- **Row click → collector profile, not watch** — reinforces the "discovery through people" product vision. Watch detail is a secondary click target on the row.
- **Wishlist-gap is the biggest new insight surface** — not yet in the codebase anywhere. Planner will need to define what "gap" means operationally.
- **`+ Wear` nav button is a twin of the WYWT self-tile** — same watch picker, two entry points. Avoid divergence: one dialog component, two triggers.
- **"Add to wishlist" from the WYWT overlay is a conversion moment** — the collector saw the watch in context (on someone's wrist, today) and reacts. The path must be one tap with no confirmation friction.

</specifics>

<deferred>
## Deferred Ideas

- **Bulk-import UX (multi-URL / CSV / Chrono24 import)** — future phase. FEED-04 is satisfied in Phase 10 by the time-window collapse, so there is no functional gap; this is purely a future product capability.
- **Cross-device viewed-state sync for WYWT** — would need a `wear_event_views` table with RLS + reads on page render. Deferred in favor of localStorage (W-06). Re-evaluate if the "viewed" signal becomes load-bearing or if users demand cross-device.
- **Schema aggregate column on `activities`** (writer-side aggregation) — deferred; F-08 does it at read time. Revisit only if write volume grows to where read-time collapse becomes expensive.
- **Daily rec rotation / cron** — C-06 handles freshness via `cacheLife` ~5min. A daily cron becomes interesting if recommendation cost scales past that — not at MVP scale.
- **Collaborative-filtering recommendations** — deferred. C-01 uses tasteOverlap, which is sufficient and reuses existing infrastructure.
- **Explore page / global search / notifications** — Phase 10 hides these nav items. EXPL-*, SRCH-*, NOTF-* all land in future phases.
- **Notification surface for new followers** (NOTF-01) — deferred per REQUIREMENTS.md.
- **Rec cache invalidation on follow / unfollow** — worth considering in the planner: if viewer follows someone, should the rec cache invalidate for them? Trade-off: freshness vs. cache churn. Default: let `cacheLife` expire naturally.
- **WYWT auto-advance timer in overlay** — IG Reels auto-advances after N seconds. Not included in W-05 (manual swipe only). Easy to add later if the overlay feels too passive.
- **"You and {name} shared N recent wears this week" composite insight** — richer but not in I-01 scope. Candidate for a v2.1 insight card.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 10 scope per `gsd-tools todo match-phase 10` (todo_count: 0).

</deferred>

---

*Phase: 10-activity-feed*
*Context gathered: 2026-04-21*

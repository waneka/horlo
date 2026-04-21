# Phase 9: Follow System & Collector Profiles - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Requirements:** FOLL-01, FOLL-02, FOLL-03, FOLL-04, PROF-08, PROF-09

<domain>
## Phase Boundary

Collectors can follow and unfollow each other, view follower/following lists, and visit another collector's profile at `/u/[username]` in read-only mode — all five existing tabs respect that owner's privacy settings via per-tab locked states. On another collector's profile, a Common Ground section shows shared watches, shared taste tags, overlap label, and shared style/role distributions — computed server-side.

**Not in this phase:** follow approval/request workflow, notifications of new followers, discovery/search/explore surfaces, activity feed. Those are deferred by REQUIREMENTS.md or belong to Phase 10.

</domain>

<decisions>
## Implementation Decisions

### Common Ground (PROF-09)

- **D-01: Content = all four data types.** Common Ground includes:
  1. Shared watches (set intersection on normalized `(brand, model)` pairs — lowercase + trim, per research Anti-Pattern 3)
  2. Shared taste tags (intersection of viewer's + owner's computed tags)
  3. Overlap label derived server-side from `analyzeSimilarity()` logic ("Strong overlap" / "Some overlap" / "Different taste" — one phrase, not a numeric score)
  4. Shared styles + role breakdown (side-by-side mini bars using existing HorizontalBarChart)

- **D-02: Split UI across hero band + dedicated 6th tab.**
  - **Hero band** renders on non-owner profile view, between ProfileHeader and ProfileTabs. Compact: overlap label + small stat strip ("3 shared watches · 2 shared taste tags · lean sport together") + a "See full comparison →" link that deep-links to the 6th tab.
  - **6th tab: "Common Ground"** — only appears on other-user profiles (hidden on own profile and on locked private profiles). Full detail: shared watches grid (ProfileWatchCard), shared taste tag row (TasteTagPill), shared styles + role dual bars (HorizontalBarChart), overlap label explained.
  - **Empty overlap:** hero band shows "No overlap yet — your tastes are distinct." 6th tab is **not rendered at all** in this case (no empty tab).

- **D-03: Compute server-side on every render, no cache.** Phase 9 introduces `src/lib/tasteOverlap.ts` — a server-compatible version of the comparison logic that takes two users' `(watches, preferences)` and returns `TasteOverlapResult`. Invoked from the `/u/[username]` layout when viewer ≠ owner. At <500 watches/user, set intersection + similarity read is cheap.

- **D-04: Common Ground is never shown on own profile.** Owner viewing their own profile: no hero band, no 6th tab.

- **D-05: Empty-viewer-collection behavior.** If the **viewer** has zero watches, Common Ground still renders taste-tag intersection (if any) and the "No overlap yet" framing. Fallback signal > silent hide.

### Follow System (FOLL-01, FOLL-02, FOLL-03)

- **D-06: Optimistic UI + `router.refresh()`.** Click Follow → local count bumps instantly + button flips to "Following" → Server Action writes to `follows` → `router.refresh()` reconciles server-rendered counts. On error, rollback local state + toast. Satisfies Success Criterion #5 ("counts update without full page refresh").

- **D-07: Follow button placements.**
  - **ProfileHeader** on non-owner view (primary placement, solid-style).
  - **LockedProfileState** (wire up Phase 8's non-functional placeholder).
  - **Inline in follower/following list cards** — per-row button on every entry, `stopPropagation` so clicking the button doesn't navigate.
  - *Not* in the Common Ground hero band — header button is adjacent enough.

- **D-08: Private-profile follow flow = auto-accept, instant.** Follow writes the row immediately on private profiles. Content stays locked (privacy is per-tab, not per-relationship). No request/accept workflow (out of scope per REQUIREMENTS.md; NOTF-01 deferred).

- **D-09: Unfollow UX = hover-swap + instant click.** Button shows "Following" (muted). Hover (desktop) or tap (mobile) flips label to "Unfollow" (destructive tint). Click unfollows optimistically. Mobile: single tap reveals "Unfollow", second tap confirms (two-tap pattern avoids misfires without a dialog).

- **D-10: Follow action validations.**
  - Cannot follow yourself — Server Action rejects if `followerId === followingId`.
  - Idempotent — `(follower_id, following_id)` unique constraint already in schema (Phase 7); Server Action swallows duplicate-key as a no-op.
  - Auth required — `getCurrentUser()` gate; unauth users don't see Follow button (or see it with sign-in redirect — Claude's discretion).

### Follower / Following List (FOLL-04)

- **D-11: Dedicated routes.** `/u/[username]/followers` and `/u/[username]/following` as siblings of `/u/[username]/[tab]`. Shareable, back/forward works, consistent with existing routing pattern.

- **D-12: Entry card content.**
  - Avatar (AvatarDisplay component)
  - Primary label: `displayName ?? username` (fall back, **not** both side-by-side)
  - Secondary: one-line truncated bio
  - Stat strip: watch count · wishlist count (requires DAL JOIN — owner-side computed)
  - Inline Follow button (same optimistic pattern as D-06); hidden on your own row

- **D-13: Sort + pagination.** ORDER BY `follows.created_at DESC`. No pagination at MVP — <500 target per PROJECT.md. Simple list.

- **D-14: Click row → `/u/[other]/collection`.** Explicit default-tab link (skips the layout redirect hop). Follow button uses `stopPropagation`.

### Other-Profile Tab Visibility (PROF-08, PRIV-05)

- **D-15: All 5 tabs always render in the tab row.** Collection, Wishlist, Worn, Notes, Stats. Visibility of **content** is gated; the tab row is stable.

- **D-16: Per-tab privacy gates.**
  - **Collection** → `profile_settings.collection_public`
  - **Wishlist** → `profile_settings.wishlist_public`
  - **Worn** → `profile_settings.worn_public` (via existing `getPublicWearEventsForViewer` DAL from Phase 8 Plan 01)
  - **Notes** → per-row `notes_public` (per-note model from Phase 8 D-13). Tab always shows; content = public notes only. Zero public notes = "No public notes" empty state.
  - **Stats** → per-card gates. Style/Role distribution gated on `collection_public`. Most/Least Worn + wear observations gated on `worn_public`. Locked card per gated stat.

- **D-17: 6th "Common Ground" tab visibility.** Only on non-owner view, only when at least one of (shared watches, shared taste tags) is non-empty. Not in tab row on own profile.

- **D-18: Locked-tab rendering = per-tab locked card.** When a tab is private and viewer is not the owner, tab content renders a small card with lock icon + "{displayName ?? username} keeps their {collection|wishlist|worn|notes|stats} private". Viewer can still switch to other tabs. Matches Success Criterion #2 ("private tabs show locked state, not empty").

- **D-19: Owner-only UI hidden on other profiles.** Phase 8 already gates these — Phase 9 must preserve:
  - "+ Add Watch" card on Collection tab
  - "Log Today's Wear" CTA on Worn tab
  - Per-note visibility pill + 3-dot "Remove Note" menu on Notes tab
  - Inline edit on ProfileHeader
  - Stats "Observations" that expose private aggregates

### Privacy Enforcement (PRIV-05)

- **D-20: Two-layer enforcement persists.** All new reads (`getFollowersForProfile`, `getFollowingForProfile`, `getTasteOverlap`, etc.) must be gated at both RLS (DB-level) and DAL (app-level WHERE clause). Follows any identity with a foreign user's token cannot read private rows.

- **D-21: Follow writes have RLS too.** `follows` policies:
  - INSERT: `auth.uid() = follower_id` (you can only insert follow rows where you're the follower).
  - DELETE: `auth.uid() = follower_id` (you can only unfollow on your own behalf).
  - SELECT: anyone can read the graph (counts are public, lists obey profile_public gate at the DAL layer — not RLS — since listing another user's followers is not private data).

### Count Accuracy (Success Criterion #5)

- **D-22: Counts computed server-side each render.** `getFollowerCounts(userId)` already exists (Phase 7/8). After a Follow/Unfollow action, `router.refresh()` re-fetches the layout which calls this DAL again. No denormalized counts, no triggers.

### Claude's Discretion

- Exact shape of `TasteOverlapResult` type (output of `src/lib/tasteOverlap.ts`) — planner decides
- Exact SQL for `getFollowersForProfile` / `getFollowingForProfile` joins (profile+settings+watch/wishlist counts) — planner decides
- Micro-interactions: button loading states, hover transitions, toast positioning
- Exact wording of locked-tab copy variants (just match the "{username} keeps their {tab} private" spirit)
- Sign-in redirect behavior when unauth user clicks Follow
- Whether the Common Ground "stat strip" in hero band uses icons or plain punctuation separators
- Keyset-pagination migration path for follower lists when growth demands it (not shipped now)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 9 Research
- `.planning/research/ARCHITECTURE.md` — **Common Ground section** (server-side `src/lib/tasteOverlap.ts` shape, `TasteOverlapResult` fields), **Anti-Pattern 3** (match on normalized brand+model, NOT watch IDs), Step 8 (Collector Profile Page — Other User View)
- `.planning/research/FEATURES.md` — Common Ground differentiation framing, "Taste-first follow prompts" positioning
- `.planning/research/PITFALLS.md` — RLS policy pitfalls carried into new `follows`-related reads

### Prior Phase Context (carry-forward)
- `.planning/phases/07-social-schema-profile-auto-creation/07-CONTEXT.md` — `follows` + `profile_settings` schema, activity logging posture, RLS patterns
- `.planning/phases/08-self-profile-privacy-controls/08-CONTEXT.md` — D-01 routing (`/u/[username]/[tab]`), D-03 home preserved, D-13 per-note visibility, D-14 LockedProfileState + deferred Follow button placeholder, D-15 two-layer privacy enforcement

### Database & Auth
- `src/db/schema.ts` — `follows` table (lines 144–157), `profiles`, `profile_settings`, `activities`, `wear_events`
- `src/lib/auth.ts` — `getCurrentUser()`, `UnauthorizedError` used by every DAL/Server Action
- `src/lib/supabase/server.ts` — Supabase server client

### DAL (existing, extend)
- `src/data/profiles.ts` — already has `getProfileByUsername`, `getProfileById`, `getProfileSettings`, `getFollowerCounts`, `updateProfileFields`, `updateProfileSettingsField`. Phase 9 adds `getFollowersForProfile`, `getFollowingForProfile`, `getTasteOverlap`, and follow/unfollow helpers.
- `src/data/watches.ts` — existing watch DAL; read for Common Ground intersection
- `src/data/preferences.ts` — read for server-side similarity input
- `src/data/wearEvents.ts` — `getPublicWearEventsForViewer` (Phase 8 Plan 01) reused by Worn tab on other profiles

### Similarity Engine (extend)
- `src/lib/similarity.ts` — existing `analyzeSimilarity(targetWatch, collection, preferences)` (client-side). Phase 9 creates server-compatible comparison logic in `src/lib/tasteOverlap.ts` (no browser APIs).

### Profile Layout / Components (extend)
- `src/app/u/[username]/layout.tsx` — current layout; must add Common Ground hero band between ProfileHeader and ProfileTabs when viewer ≠ owner
- `src/app/u/[username]/page.tsx` — default redirect to `/collection`
- `src/app/u/[username]/[tab]/page.tsx` — tab router; extend to handle per-tab privacy + Common Ground as 6th tab
- `src/components/profile/ProfileHeader.tsx` — add Follow button for non-owner view
- `src/components/profile/ProfileTabs.tsx` — conditionally render 6th "Common Ground" tab on non-owner with overlap
- `src/components/profile/LockedProfileState.tsx` — wire existing Follow placeholder to live Server Action
- `src/components/profile/TasteTagPill.tsx` — reuse for shared tags
- `src/components/profile/HorizontalBarChart.tsx` — reuse for shared style/role dual bars
- `src/components/profile/ProfileWatchCard.tsx` — reuse for shared watches grid
- `src/components/profile/AvatarDisplay.tsx` — reuse in follower/following cards

### Server Actions (new)
- `src/app/actions/follows.ts` (new) — `followUser(userId)`, `unfollowUser(userId)`, both Zod-validated, `getCurrentUser()` gate, `revalidatePath` on relevant routes

### New Routes
- `src/app/u/[username]/followers/page.tsx` (new) — follower list
- `src/app/u/[username]/following/page.tsx` (new) — following list
- `src/app/u/[username]/[tab]/page.tsx` — extend `[tab]` union to include `common-ground` OR add a dedicated `/u/[username]/common-ground/page.tsx`

### Deploy & Migrations
- `docs/deploy-db-setup.md` — prod migration runbook (RLS on any new table/column)
- Drizzle migrations via `drizzle-kit` — plain SQL hand-written for RLS policies (follows table already exists in schema; Phase 9 adds policies if not yet present)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `follows` table (Phase 7) — schema + unique pair constraint + cascade deletes. No schema change in Phase 9.
- `getFollowerCounts()` — already used by ProfileHeader + LockedProfileState; `router.refresh()` re-invokes it server-side.
- Phase 8 LockedProfileState — Follow button placeholder awaiting wiring. Layout + messaging reused.
- `analyzeSimilarity()` in `src/lib/similarity.ts` — logic to extract into `tasteOverlap.ts` server-compatible variant.
- ProfileWatchCard, TasteTagPill, AvatarDisplay, HorizontalBarChart — all Phase 8 components, drop-in reuse.
- `getPublicWearEventsForViewer()` DAL (Phase 8 Plan 01) — already handles worn_public privacy gate for viewers.
- Per-note `notes_public` column + DAL gating (Phase 8 D-13) — already there.

### Established Patterns
- Server Components + Server Actions + DAL — all mutations go through Server Actions, all reads through DAL, `getCurrentUser()` gate on every data access.
- `revalidatePath()` on mutations; `router.refresh()` on client for reconciliation (no Realtime).
- Two-layer privacy (RLS + DAL WHERE) — must extend to every new Phase 9 read and write.
- Zod strict schemas on every Server Action input.
- Optimistic UI: local state bump → Server Action → `router.refresh()` → reconcile.

### Integration Points
- `/u/[username]/layout.tsx` — add Common Ground hero band between ProfileHeader and ProfileTabs for non-owner view
- `ProfileTabs` component — conditionally render 6th tab
- `ProfileHeader` — add Follow button slot when `!isOwner`
- `LockedProfileState` — wire Follow button to `followUser` Server Action
- Phase 10 will consume `follows` for feed JOIN — Phase 9 must not ship schema changes that would block that

### Constraints from Prior Phases
- No Supabase Realtime (free-tier 200 WS limit) — `router.refresh()` is the reconciliation pattern
- No watch linking / canonical watch DB — Common Ground uses normalized `(brand, model)` match, NOT `watch.id` intersection
- No approval workflow for follows — follows are instant, private is per-tab, not per-relationship
- `/` home stays as owner dashboard until Phase 10 ships the feed

</code_context>

<specifics>
## Specific Ideas

- "Common Ground can be hero band only if it all fits nicely; otherwise hero band shows high-level + link to a dedicated 6th tab." — user's mental model. Decision: always use both, because all 4 content types (shared watches + taste tags + overlap label + shared style/role bars) generate enough detail to warrant the drill-down tab.
- Follower/following entry primary label = `displayName ?? username` (fall back, not side-by-side). Keeps cards compact.
- Follow button "hover-swap Following → Unfollow" matches Twitter / X convention; avoids confirm dialog friction for a reversible action.
- Common Ground positioning research note: "Taste-first follow prompts — 'people who like what you like' as follow CTA" — Phase 9 delivers this by putting Common Ground above the Follow button (hero band) when viewer and owner have overlap.

</specifics>

<deferred>
## Deferred Ideas

- **Follow approval / request workflow** — would need a new phase + `follows.status` column + notification surface. Out of scope per REQUIREMENTS.md.
- **New-follower notifications** — NOTF-01 deferred to future milestone.
- **Preview popover on follower/following rows** — nice UX polish; re-evaluate after Phase 10.
- **Keyset pagination for follower lists** — swap in when a user crosses a threshold; pattern is already established in Phase 10 (FEED-03) for activities.
- **Sign-in redirect UX for unauth users clicking Follow** — Claude's discretion in planning; specific flow can land as polish follow-up.
- **Materialized Common Ground view / cache tags** — only if profile render becomes a hot path. Ship the simple version first.
- **Collection discovery surfaces (browse, search, suggestions)** — DISC-*, EXPL-*, SRCH-* requirements deferred to future milestone.
- **"Collectors who own this watch" on watch detail** — WTCH-* requirements deferred.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 9 scope.

</deferred>

---

*Phase: 09-follow-system-collector-profiles*
*Context gathered: 2026-04-21*

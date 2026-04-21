# Phase 9: Follow System & Collector Profiles - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 09-follow-system-collector-profiles
**Areas discussed:** Common Ground — content & placement, Followers / Following list, Follow button — optimism + placements, Other-profile tabs — which render, and how

---

## Common Ground — content & placement

### Q1: What should the Common Ground section contain?

| Option | Description | Selected |
|--------|-------------|----------|
| Shared watches list | Set intersection on normalized (brand, model). Thumbnails + brand/model for each shared watch. | ✓ |
| Shared taste tags | Intersection of viewer's + owner's computed taste tags. Small pill row using existing TasteTagPill. | ✓ |
| Overlap label from similarity engine | Summary label derived server-side from analyzeSimilarity() logic — "Strong taste overlap" / "Some overlap" / "Different taste". One phrase, not a numeric score. | ✓ |
| Shared styles + role breakdown | Side-by-side mini bars showing distribution similarity. | ✓ |

**User's choice:** All four selected.
**Notes:** User wants full content in Common Ground.

### Q2: Where does Common Ground live on another collector's profile?

| Option | Description | Selected |
|--------|-------------|----------|
| Hero band above tabs | Between ProfileHeader and ProfileTabs. Overlap immediately visible below Follow button. | |
| Dedicated 6th tab | Common Ground as its own tab (only on other-user profiles). Deeper content, lower prominence. | |
| Sidebar / right rail (desktop only) | Sticky right column on desktop. Breaks on mobile. | |
| Inline within Collection tab header | Shows only when Collection tab is active, above the grid. | |

**User's choice:** Combo approach — "hero band shows basic high level stuff and a link to see more in the 6th tab".
**Notes:** User reasoned: "if it all fits nicely in a hero band then no 6th tab. but if there's enough to show, the hero band can show the basic high level stuff and a link to see more in the 6th tab." Claude proposed the split (hero band always + 6th tab for drill-down; hide 6th tab when zero overlap) and user approved.

### Q3: When Common Ground has zero overlap, what shows?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide section entirely | No shared watches, no taste overlap → don't render Common Ground at all. | |
| Show 'No overlap yet' framing (Recommended) | Small muted card: "No shared watches yet — your tastes are distinct." | ✓ |
| Hide for viewers with empty collections | If viewer has 0 watches, hide Common Ground. | |
| Show shared styles/taste tags even with zero watches | Fall back to taste tag / preference overlap if no shared watches. | |

**User's choice:** Show 'No overlap yet' framing (Recommended).
**Notes:** Refined during synthesis: hero band shows framing; 6th tab is hidden (not rendered empty).

### Q4: How should Common Ground be computed and cached?

| Option | Description | Selected |
|--------|-------------|----------|
| Compute every render, no cache (Recommended) | Run server-side in /u/[username] layout/page whenever non-owner visits. | ✓ |
| Cache per (viewer, owner) pair with Next cache tag | Wrap in unstable_cache with tags invalidated on any watch mutation by either user. | |
| Materialize as DB view / derived column | Nightly job or trigger-based materialized view. | |

**User's choice:** Compute every render, no cache (Recommended).
**Notes:** Aligns with project's "no Supabase Realtime, router.refresh is enough" posture.

---

## Followers / Following list

### Q1: How should a user view follower/following lists?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated routes (Recommended) | /u/[username]/followers and /u/[username]/following as siblings to tab routes. Shareable, back/forward, consistent with existing pattern. | ✓ |
| Modal / dialog overlay | Instagram-style. Loses deep-linking; cramped on mobile. | |
| Sidebar drawer | Right-side drawer on desktop, full-screen sheet on mobile. Custom pattern — no precedent. | |
| Inline collapsible panel | Panel expands below header. Awkward with many rows. | |

**User's choice:** Dedicated routes (Recommended).

### Q2: What does each entry in the list show?

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar + username (Recommended) | AvatarDisplay + username text. Minimum viable. | ✓ |
| Display name + bio preview | displayName + truncated bio. More social context. | ✓ |
| Watch / wishlist counts | Small stat strip. Requires extra DAL joins. | ✓ |
| Inline Follow button | Per-row Follow/Following button. Optimistic-update surface. | ✓ |

**User's choice:** All four, with clarification: "i don't think we need username & display name. can we show display name if set and username as a default?"
**Notes:** Primary label = `displayName ?? username` fallback (not side-by-side). Locked in.

### Q3: Sort order and pagination for the list?

| Option | Description | Selected |
|--------|-------------|----------|
| Most recent first, no pagination (Recommended) | ORDER BY follows.createdAt DESC. Single query, safe at <500 target. | ✓ |
| Most recent first, keyset pagination | Same order + (createdAt, id) keyset cursor with Load more. Future-proof. | |
| Alphabetical by username | ORDER BY username ASC. Predictable, loses recency signal. | |
| Recently active first | Order by last activity event. Extra JOIN, higher cost. | |

**User's choice:** Most recent first, no pagination (Recommended).

### Q4: What happens when you click a row?

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to /u/[other]/collection (Recommended) | Default profile view. Follow button uses stopPropagation. | ✓ |
| Navigate to /u/[other] (layout default redirect) | Same end state, one extra hop. | |
| Preview popover on hover, click to navigate | Hover popover on desktop, irrelevant on mobile. | |

**User's choice:** Navigate to /u/[other]/collection (Recommended).

---

## Follow button — optimism + placements

### Q1: How should the Follow action update counts in the UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic UI + router.refresh (Recommended) | Click → local bump → Server Action → router.refresh reconciles. Rollback on error. | ✓ |
| Pending state, wait for server, then refresh | Spinner → Server Action → router.refresh. Simpler, feels slower. | |
| Fully optimistic, no server reconciliation | Client state holds count. Drift possible across tabs. | |

**User's choice:** Optimistic UI + router.refresh (Recommended).

### Q2: Where does the Follow button appear?

| Option | Description | Selected |
|--------|-------------|----------|
| ProfileHeader (non-owner view) (Recommended) | Primary placement next to counts. | ✓ |
| LockedProfileState (Recommended) | Wire up Phase 8's deferred placeholder. | ✓ |
| Common Ground hero band | CTA-adjacent to overlap summary. Duplicative with header. | |
| Inline in follower/following list cards | Per-row button on every entry. | ✓ |

**User's choice:** ProfileHeader + LockedProfileState + inline in list cards. Common Ground hero band NOT selected.
**Notes:** Header button is adjacent enough to Common Ground; avoids button duplication.

### Q3: When viewing a private profile, what does Follow do?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-accept, instant follow (Recommended) | Writes row immediately. Content stays locked (per-tab privacy, not per-relationship). | ✓ |
| Request/accept workflow | Writes pending row; owner must approve. Scope creep, new state + UI + notifications. | |
| Block follow entirely on private profiles | Disabled on locked profiles. Contradicts Phase 8 D-14. | |

**User's choice:** Auto-accept, instant follow (Recommended).

### Q4: Unfollow UX — how does it work after you're following?

| Option | Description | Selected |
|--------|-------------|----------|
| Hover-swap 'Following' → 'Unfollow' + instant on click (Recommended) | Hover/tap reveals destructive label. Click unfollows instantly. Twitter convention. | ✓ |
| Instant, no confirm, single click | Click 'Following' → unfollows immediately. Easy to misfire. | |
| Confirm dialog on every unfollow | 'Unfollow {username}?' dialog. Heavy for reversible action. | |

**User's choice:** Hover-swap 'Following' → 'Unfollow' + instant on click (Recommended).

---

## Other-profile tabs — which render, and how

### Q1: How should Notes tab behave on another collector's profile?

| Option | Description | Selected |
|--------|-------------|----------|
| Show tab always; render only public notes (Recommended) | Tab label always visible. Content = rows with notes_public=true. "No public notes" empty state if zero. | ✓ |
| Hide tab if owner has zero public notes | Dynamic tab visibility based on viewer-reachable content. Tabs shift. | |
| Gate entire tab behind a single notes_tab_public setting | Add a 5th PRIV toggle. Scope creep — contradicts Phase 8 D-13. | |

**User's choice:** Show tab always; render only public notes (Recommended).

### Q2: How should Stats tab behave on another collector's profile?

| Option | Description | Selected |
|--------|-------------|----------|
| Show tab; respect gates per stat card (Recommended) | Tab visible. Stats requiring worn_public data locked/empty if off. Style/Role gated on collection_public. | ✓ |
| Show tab only if both collection_public AND worn_public | All-or-nothing. Simpler but hides partial insights. | |
| Hide Stats on other profiles entirely | Owner-only. Simplest privacy, loses PROF-08 feature. | |
| Add a stats_public PRIV toggle | Scope creep. | |

**User's choice:** Show tab; respect gates per stat card (Recommended).

### Q3: When a tab is private and the viewer isn't the owner, what renders in the tab content?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-tab locked card: lock icon + '{username} keeps their {tab} private' (Recommended) | Small card inside tab content. Other tabs still switchable. | ✓ |
| Hide the tab link entirely when private | Silent — viewer has no idea a private version exists. | |
| Same full-page LockedProfileState component | Reuse Phase 8 component. Heavier, redundant when only one tab is private. | |
| Tab visible but disabled (muted, non-clickable) | Less informative than locked card, more visible than hiding. | |

**User's choice:** Per-tab locked card (Recommended).

---

## Claude's Discretion

- Exact shape of `TasteOverlapResult` type (output of `src/lib/tasteOverlap.ts`)
- Exact SQL for `getFollowersForProfile` / `getFollowingForProfile` joins
- Micro-interactions: button loading states, hover transitions, toast positioning
- Exact wording of locked-tab copy variants
- Sign-in redirect behavior when unauth user clicks Follow
- Whether the Common Ground "stat strip" uses icons or plain punctuation separators
- Keyset-pagination migration path for follower lists (not shipped now)

## Deferred Ideas

- Follow approval / request workflow (would need new phase + schema)
- New-follower notifications (NOTF-01)
- Preview popover on follower/following rows (post-Phase 10 polish)
- Keyset pagination for follower lists (swap in when scale demands)
- Sign-in redirect UX for unauth Follow clicks (planner's discretion)
- Materialized Common Ground view / cache tags (ship simple first)
- Collection discovery surfaces (DISC-*, EXPL-*, SRCH-* — future milestone)
- "Collectors who own this watch" on watch detail (WTCH-* — future milestone)

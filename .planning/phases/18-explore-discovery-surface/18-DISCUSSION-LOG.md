# Phase 18: /explore Discovery Surface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 18-explore-discovery-surface
**Areas discussed:** BottomNav 5-slot transition, Sparse-network welcome hero, Rail order + density + empty states, Trending vs Gaining Traction differentiation

---

## BottomNav 5-Slot Transition

### Q1: Initial framing — what ships in BottomNav this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Full swap now | Final v4.0 shape ships: Home/Search/Wear/Notifications/Explore. Drop Add + Profile entirely; rely on TopNav UserMenu until Phase 25. | |
| Half swap (preserve Profile) | Add Search + Notifications, drop Add, keep Profile until Phase 25. | |
| Minimum (Explore-only) | Read DISC-08 literally — keep current 5 slots, just verify Explore wires. | |

**User response:** Pushback — "i'm not sure i'm on board with dropping the profile from the bottom nav. i think the idea was to make it consistent across desktop and mobile, but my goal is to make profile MORE visible/accessible and this feels like a step in the wrong direction. and notifications in the bottom nav feels off too - i feel like people expect them in the top nav. talk this out with me"

### Q1-revised: Reframed after thinking-partner discussion

The constraint: 5 slots, 6 candidates {Home, Search, Wear, Notifications, Profile, Explore, Add}. Wear/Home/Explore are non-negotiable for v4.0 → 2 slots for {Search, Notifications, Profile, Add}.

Convention research:
- **Notifications in BottomNav:** X, TikTok, Bluesky, Threads, LinkedIn (feed-driven apps).
- **Notifications in TopNav:** Instagram, Pinterest (visual/curatorial apps).
- **Profile in BottomNav:** Instagram, TikTok, Threads, Bluesky (rightmost slot).
- **Profile in side-drawer:** X, LinkedIn.

Horlo identity = closer to Instagram/Pinterest. Profile-in-BottomNav matches user's "MORE visible" goal. Notifications-in-TopNav matches user's mental model.

**User response:** "yes i like it. add watch doesn't need to be in any nav, we should just put that in the places that a user might naturally want to add a watch (collection/wishlist,etc)."

**Locked:**
- D-01: Final BottomNav shape `Home / Search / Wear / Explore / Profile` (Profile rightmost, Explore at slot 4).
- D-02: Drop Add slot entirely; "+Add Watch" lives in contextual surfaces (collection / wishlist / etc empty-state CTAs — Phase 25 ships those).
- D-03: Profile stays in BottomNav permanently. NAV-13/15 (Phase 25) ships TopNav avatar as ADDITIONAL access, not replacement.
- D-04: Notifications stays in TopNav bell (already wired in SlimTopNav + DesktopTopNav from Phase 13/14).

**Note:** This re-decides DISC-08 (was: "Home/Search/Wear/Notifications/Explore") and NAV-14 (Phase 25 — was: "Home/Search/Wear/Notifications/Explore"). Both requirements need amendment when their phases plan.

---

## Sparse-Network Welcome Hero

### Q2: What's the hero's primary job?

| Option | Description | Selected |
|--------|-------------|----------|
| Welcome + single primary CTA | Warm copy + one clear next step. Frames the rails. | ✓ |
| Welcome + 2-3 CTAs | Multiple actions presented; risks competing with rails. | |
| Step checklist (1/2/3 done) | Onboarding-style; overkill for a single empty-state hero. | |

**User's choice:** Welcome + single primary CTA.

### Q3: When threshold crosses (3rd follow OR 1st wear), should the hero disappear?

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate — Server Component reads live counts | No client hide-state; server state always wins. | ✓ |
| Sticky for the session | Stays until full reload. | |
| Sticky until both thresholds met | Demanding; feels nagging. | |

**User's choice:** Immediate.

### Q4: Rails behavior when hero is showing?

User asked for clarification: "for all these items i just need more context. what are we talking about exactly, what are the rails, how should i make these decisions?"

After clarification (visual sketch + table of what each rail shows):

| Option | Description | Selected |
|--------|-------------|----------|
| Show all 3 rails below hero | Rails always render; hero frames them. "This surface is alive." | ✓ |
| Show only Popular Collectors below hero | Hide Trending + Gaining Traction; focus on the unlocking action. | |
| Hero only, no rails | Pure welcome screen until threshold passes. | |

**User's choice:** Show all 3 rails below hero.

### Q5: Where does the hero CTA route?

| Option | Description | Selected |
|--------|-------------|----------|
| Anchor-scroll to Popular Collectors rail | <a href='#popular-collectors'> + smooth-scroll. Same surface. | |
| Navigate to /search?tab=people | Off /explore to People search. | |
| Navigate to /explore/collectors (See-all) | Off the rail, into the full browseable list. | ✓ |

**User's choice:** Navigate to /explore/collectors. (Combines: rails visible AND CTA leaves the surface to a richer browse-all view.)

---

## Rail Order + Density + Empty States

### Q6: Top-to-bottom order on /explore?

| Option | Description | Selected |
|--------|-------------|----------|
| Popular Collectors → Trending Watches → Gaining Traction | People-first; matches PROJECT vision. | ✓ |
| Trending Watches → Gaining Traction → Popular Collectors | Items-first. | |
| Popular Collectors → Gaining Traction → Trending | People-first, then movement, then steadier rail. | |

**User's choice:** Popular Collectors → Trending Watches → Gaining Traction.

### Q7: How many items per rail?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 per rail | Matches Phase 10 SuggestedCollectors; established Horlo rhythm. | ✓ |
| 8 per rail | More density. | |
| 10 per rail | Probably too many. | |

**User's choice:** 5 per rail.

### Q8: Layout shape — horizontal-scroll cards or vertical list rows?

| Option | Description | Selected |
|--------|-------------|----------|
| Mixed — Collectors = vertical rows, Watches = horizontal cards | Mirrors Phase 10 patterns; type-appropriate. | ✓ |
| All 3 horizontal-scroll cards | Visual consistency; weakens collector metadata density. | |
| All 3 vertical rows | Visual consistency; weakens watch image prominence. | |

**User's choice:** Mixed.

### Q9: Gaining Traction first-week data wrinkle (snapshots just shipped, no 7-day window yet)?

| Option | Description | Selected |
|--------|-------------|----------|
| Always render rail; delta computes from whatever snapshots exist | 0 snapshots → empty-state copy; 1-6 days → partial window labeled accurately; 7+ days → full week. | ✓ |
| Hide rail until 7 days of snapshots exist | Cleanest but asymmetric during launch window. | |
| Always render with "Coming soon" until 7 days hit | Communicates intent; feels like a stub. | |

**User's choice:** Always render rail.

---

## Trending vs Gaining Traction Differentiation

### Q10: How visually distinct should the two watch rails feel?

| Option | Description | Selected |
|--------|-------------|----------|
| Same card shape, distinct sublabel + iconography | Component reuse; copy + icons carry the difference. | ✓ |
| Different card shapes per rail | Visually unmistakable; doubles component work. | |
| Same card, no extra iconography — just heading copy | Most minimal; risk users don't notice they're different. | |

**User's choice:** Same card, distinct sublabel + iconography (flame on Trending, trending-up arrow on Gaining Traction).

### Q11: Can the same watch appear in both rails?

| Option | Description | Selected |
|--------|-------------|----------|
| Allowed — each rail computes independently | "Most-collected ever" + "biggest mover this week" are distinct truths. | ✓ |
| Dedupe — Gaining Traction wins | Trending excludes any catalog_id already in Gaining Traction. | |
| Dedupe — Trending wins | Reverse precedence. | |

**User's choice:** Allowed.

### Q12: Sort tie-breaks within each rail?

| Option | Description | Selected |
|--------|-------------|----------|
| Alphabetical by brand+model | Deterministic; matches Phase 16 convention. | ✓ |
| Most recently updated first | Novelty-biased; less stable. | |
| Random / catalog_id | Stable but feels arbitrary. | |

**User's choice:** Alphabetical by `(brand_normalized ASC, model_normalized ASC)`.

---

## Claude's Discretion

Items where the user said "you decide" or deferred to UI-SPEC / planner:

- Empty-state policy for Popular Collectors / Trending Watches when 0 results (extremely unlikely; hide rail header).
- Exact hero copy + visual treatment (UI-SPEC owns).
- Hero illustration / icon choice.
- Watch-card click target in Trending + Gaining Traction rails until Phase 20 ships /evaluate?catalogId=.
- /explore/watches See-all surface internal layout (Trending + Gaining Traction unification — tab toggle vs sort select vs stacked).
- Caching strategy (`'use cache'` + `cacheLife` + `cacheTag` baselines proposed; planner tunes).
- DAL function naming and file placement (`src/data/discovery.ts` vs extending existing files).
- Whether to factor a single shared `<DiscoveryWatchCard>` or specialize per-rail.
- See-all route pagination shape (default: cap at 50, no infinite scroll; planner can adjust).

## Deferred Ideas

- `/evaluate?catalogId=` deep-link target (Phase 20)
- Editorial / featured collector slot (DISC-09 — v4.x)
- Trending feed widening to wears + follows (DISC-10 — v4.x)
- Filter facets on Trending Watches (v4.x)
- Realtime updates to /explore (project-wide deferral)
- Phase 25 NAV-14 + DISC-08 amendment (BottomNav shape decided here, requires re-derivation when Phase 25 plans)
- Hero illustration / motion design (UI-SPEC owns)
- /explore/watches See-all internal layout (UI-SPEC owns)

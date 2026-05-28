# Phase 65: Follow-Scoped Owners Module - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 65-follow-scoped-owners-module
**Areas discussed:** Branch visibility & owner-on-own-watch, Chip click destination, Coexistence with OtherOwnersRoster, Visual shape / count / overflow, Privacy gates

---

## Branch visibility & owner-on-own-watch

| Option | Description | Selected |
|--------|-------------|----------|
| All three branches, all viewers | Render on B1 (your watch + cross-user), B2, B3. Always from catalogId. Self-excludes viewer. Owner sees followed collectors on their own watch (social proof). Chip-set hide-if-empty. | ✓ |
| All branches, only when viewer is NOT owner | Same render footprint, but suppress on your-own-watch (B1 owner, B2 owner). Contradicts social-proof framing. | |
| Catalog-shaped surfaces only (B2 + B3, plus B1 cross-user) | Skip when viewer IS owner. Render on all viewer-is-not-owner cases. | |
| Catalog Branch 3 only | Tightest scope — only on pure catalog view. B1 + B2 don't get it. | |

**User's choice:** All three branches, all viewers (Recommended)
**Notes:** Locked as D-01. Self-exclusion handled at DAL WHERE (matches T-39b-04 pattern). Owner-on-own-watch retains the module — social proof is intentional. Hide-if-empty is intrinsic to the empty intersection (no DOM at zero matches → FOLL-01).

---

## Chip click destination

| Option | Description | Selected |
|--------|-------------|----------|
| Their per-user watch page (`/w/${their-watch-id}`) | Most specific — viewer lands on the owner's version of THIS watch. Best discovery payoff. DAL must project each owner's `watches.id`. | |
| Their profile collection page (`/u/${username}/collection`) | OtherOwnersRoster pattern exactly. Simpler DAL projection. Discovery one click shallower. | ✓ |
| Split target (username → profile, avatar → per-user watch) | Two tap-targets per chip. Undermines single-accessible-label contract. | |

**User's choice:** Their profile collection page (`/u/${username}/collection`)
**Notes:** Locked as D-02. DAL projection is `{ userId, username, displayName, avatarUrl }` — same as `CatalogCollector`. No need to resolve per-owner `watches.id`. `aria-label` mirrors OtherOwnersRoster.

---

## Coexistence with existing OtherOwnersRoster

| Option | Description | Selected |
|--------|-------------|----------|
| Both render — new module in hero right column, broad roster below as today | Two distinct surfaces with distinct meaning. No layout regression on Branch 3. | ✓ |
| New module REPLACES broad roster when ≥1 followed owner exists | Followed-only when matches, else broader. Hides social proof from non-followers + forces conditional ordering. | |
| Promote new module ABOVE broad roster (both below hero) | Stack as sibling above OtherOwnersRoster. Contradicts ROADMAP's "hero right column" placement. | |
| Replace broad roster entirely on Branch 3 | Followed-only on catalog page. Loses Phase 39b deliverable. | |

**User's choice:** Both render — new module in hero right column, broad roster below as today (Recommended)
**Notes:** Locked as D-03. Hero right column = "From your circle" (followed-only, taste/social). Below hero = "X collectors own this" (broad, untouched). On Branch 1 / Branch 2 the broad roster is not rendered today; Phase 65 does NOT introduce it there.

---

## Visual shape, count limit, overflow

| Option | Description | Selected |
|--------|-------------|----------|
| Compact vertical chips, top 5, "+N more" link | Avatar + @username + displayName stacked one-per-row, top 5 by recency. Natural in narrow desktop column + on mobile. | ✓ |
| Horizontal avatar-chip row matching OtherOwnersRoster pattern | Reuse `w-16` chips with horizontal scroll, top 5. Visual consistency; cramped in narrow hero right column. | |
| Overlapping avatar stack + "@username +N" caption | Stack 3-4 overlapping avatars with tight caption. Space-efficient, less scannable. | |
| You decide | Claude's discretion. | |

**User's choice:** Compact vertical chips, top 5, "+N more" link (Recommended)
**Notes:** Locked as D-04. Vertical because hero right column is the narrow `minmax(0,2fr)` track. Top 5 matches `getCollectorsForCatalog` default limit. Mobile inherits via natural single-column collapse (FOLL: no separate mobile layout).

### Follow-up: Header copy

| Option | Description | Selected |
|--------|-------------|----------|
| "People you follow who own this" | Plain, descriptive, matches ROADMAP phrasing exactly. | |
| "From your circle" | Warmer, identity-driven, fewer words; matches Rdio-inspired framing. | ✓ |
| No header — just the chips | Visual-only. Viewers can't tell why these collectors are listed vs the broader roster. | |

**User's choice:** "From your circle"
**Notes:** Locked as D-04a.

### Follow-up: "+N more" behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Plain-text caption, no link, this milestone | "and 3 more" as a static text suffix. Tight scope. | ✓ |
| Link to a see-all page (new route) | Adds `/w/${ref}/followed-owners` + pagination. Scope creep. | |
| Inline expand (click "+3 more" → reveals all in place) | Pure client-side expand. Adds 'use client' to hero right column; complicates B1 discipline. | |

**User's choice:** Plain-text caption, no link, this milestone (Recommended)
**Notes:** Locked as D-04c. See-all captured as deferred idea.

---

## Privacy gates

| Option | Description | Selected |
|--------|-------------|----------|
| Apply both gates — same as broad OtherOwnersRoster | Require `profilePublic=true` AND `collectionPublic=true`. Private follows do NOT appear. | ✓ |
| Follow implies access — require profilePublic only, ignore collectionPublic | Followed users always show if profile is technically reachable. Surfaces collections marked non-public. | |
| Follow grants full visibility — ignore both privacy flags for followed users | Followed users always show. Strongest discovery, weakest privacy. | |

**User's choice:** Apply both gates — same as broad OtherOwnersRoster (Recommended)
**Notes:** Locked as D-05. Consistent with rest of app — follow does not grant collection-visibility elsewhere. Two-layer privacy contract preserved.

---

## Claude's Discretion

- **D-06** — DAL strategy: new dedicated `getFollowedOwnersForCatalog` vs extending `getCollectorsForCatalog` with `viewerFollowingOnly` flag (planner decides; lean dedicated new function for regression-safety).
- **D-07** — Single JOIN'd query shape (Pitfall 3 dedup + Pitfall 4 totalCount mirror).
- **D-08** — Ordering by `watches.createdAt DESC` (matches existing roster D-39b-10 liveness signal).
- **D-09** — Promise.all pre-fetch vs separate `<Suspense>` boundary; pre-fetch by default, only Suspense-wrap if profiling shows >100ms p95 cost.
- **D-10** — Component placement inside hero right column (after LikeButton+jump-row, before Last-Worn block); new `FollowedOwnersModule.tsx` RSC.
- **D-11** — `FollowedOwner` row type lives in `src/data/follows.ts` (or wherever the DAL lands).
- **D-12** — Test coverage mirroring `tests/data/getCollectorsForCatalog.test.ts`.

## Deferred Ideas

- **See-all page for followed owners** — `/w/${ref}/followed-owners` with pagination. Out of FOLL-01..04.
- **Mutual-follow variant** — explicitly rejected by FOLL-02.
- **"Your followers who own this" surface** — reverse direction, explicitly rejected.
- **Per-user-watch-detail click target** — captured but not built (D-02). Trivially additive later.
- **Inline expand for "+N more"** — adds client island to hero; future polish if overflow becomes common.
- **Promoting FollowedOwnersModule to shared component for other surfaces** — out of v7.0 scope.

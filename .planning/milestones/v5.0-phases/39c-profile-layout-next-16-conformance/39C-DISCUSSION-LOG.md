# Phase 39c: Profile Layout Next 16 Conformance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 39c-profile-layout-next-16-conformance
**Areas discussed:** Architectural path, Cache boundaries + tag taxonomy, Viewer-dependent Suspense seams, ProfileShellSkeleton fidelity + unstable_instant

---

## Architectural path (A1 / A2 / A3)

| Option | Description | Selected |
|--------|-------------|----------|
| A3 — Hybrid (Recommended) | Cache username→profile + settings (idempotent reads); Suspense-wrap viewer-dependent fetches. Keeps the locked-profile gate synchronous (it depends only on profile + settings, both cacheable). Smallest surface that still gives a true static shell. | ✓ |
| A1 — Suspense-wrap in layout | Keep all fetches at the layout level but each (or the subtree depending on it) lives in a Suspense boundary. Gating short-circuit (`notFound` / LockedProfileState) moves into a wrapped inner Server Component. Smallest data-flow change but everything streams. | |
| A2 — Move data down to page.tsx | Layout becomes a pure static <main> shell. ProfileHeader / CommonGroundHeroBand / ProfileTabs move into a shared component imported by every tab page. Largest blast radius (six pages: [tab]/page.tsx + followers/following/etc.), highest regression risk. | |

**User's choice:** A3 — Hybrid
**Notes:** Path A3 selected because it balances refactor surface against architectural correctness. The locked-vs-public gate IS pushed into Suspense (the preview's "synchronous gate" was clarified during discussion to actually live inside the gate Suspense — `viewerId` cannot resolve at the top of the layout body without re-introducing the cache-poisoning blocker).

---

## Cache boundaries + tag taxonomy

### Sub-question 1: Tag family structure

| Option | Description | Selected |
|--------|-------------|----------|
| Per-profile-owner + per-viewer (Recommended) | Two new tag families. `profile:${username}` for owner-scoped reads, `viewer:${viewerId}:profile:${ownerId}` for per-viewer overlay. Profile updates fire `updateTag('profile:${username}')`; follow actions fire `updateTag('viewer:${viewerId}:profile:${ownerId}')` and `revalidateTag('profile:${ownerId}', 'max')` for follower-count update on target. | ✓ |
| Reuse existing tags only | Don't introduce new tag families. Cache profile reads behind `viewer:${ownerId}` and `explore` for global busts. Simpler but couples profile invalidation to the explore tag. | |
| Cache nothing in 39c — pure Suspense streaming | Skip 'use cache' entirely. Just wrap every uncached fetch in Suspense. Trades cache-hit performance for refactor simplicity. | |

**User's choice:** Per-profile-owner + per-viewer

### Sub-question 2: Cache scope granularity + cacheLife

| Option | Description | Selected |
|--------|-------------|----------|
| One cached resolver per shell, 300s (Recommended) | Single `<ProfileShellResolver username/>` Server Component marked `'use cache'` with cacheTag('profile:${username}') and cacheLife({ revalidate: 300 }). Resolves profile + counts + watches + wearEvents + tasteTags in one Promise.all. Matches PopularCollectors.tsx pattern. | ✓ |
| Split owner reads into two scopes | `<ProfileChromeResolver/>` for slow-changing data (profile, settings, taste tags) at cacheLife 3600s. `<ProfileLiveResolver/>` for fast-changing data (counts, watches, wearEvents) at cacheLife 60s. Two cache keys, tighter SWR windows on chrome. | |
| Per-DAL cache wrappers | Mark each DAL read as its own cached function. Most granular invalidation but breaks the existing convention (project caches at Server-Component boundary, not DAL boundary). | |

**User's choice:** One cached resolver per shell, 300s

**Notes:** Matches the established codebase pattern from `src/components/explore/PopularCollectors.tsx` and `src/components/notifications/NotificationBell.tsx`. CONTEXT.md flags an optional split-into-two-scopes refinement as planner discretion.

---

## Viewer-dependent Suspense seams

| Option | Description | Selected |
|--------|-------------|----------|
| Single gate Suspense (Recommended) | One `<Suspense fallback={<ProfileShellSkeleton/>}><ProfileGate username/></Suspense>` inside the layout's `<main>`. The gate resolves viewerId, decides locked-vs-public, and renders the entire downstream subtree. One streaming hop, simplest mental model. | ✓ |
| Layered Suspense (chrome first, viewer overlays second) | Outer Suspense wraps the gate. Inside the public branch, header chrome renders immediately from cached ProfileShellResolver, then nested Suspense boundaries fill in FollowButton state and CommonGroundHeroBand. Progressive reveal. | |
| Three parallel Suspense siblings | Drop `<ProfileGate>` and stream the static shell unconditionally. Inside layout: <ProfileHeaderResolver/>, <FollowAndCommonGroundResolver/>, {children} all in their own Suspense boundaries. The locked-state decision becomes a render concern internal to ProfileHeaderResolver. Risk of tab-then-collapse layout jank. | |

**User's choice:** Single gate Suspense
**Notes:** The simplest mental model wins. The gate threads `{children}` through itself; `notFound()` from inside the gate bubbles correctly to the closest not-found.tsx (Next 16 supports this from inside Suspense).

---

## ProfileShellSkeleton fidelity + unstable_instant

### Sub-question 1: Skeleton scope

| Option | Description | Selected |
|--------|-------------|----------|
| Chrome-only (Recommended) | Avatar 96px + name placeholder + tab pill row (5 fixed-width pills) + content card. No taste-tag chips, no common-ground band placeholder. Accept the small layout shift when taste tags appear. Simpler skeleton, no false placeholders on the locked branch. | ✓ |
| Full-shell (chrome + taste tags + common-ground line) | Chrome-only PLUS a 4-chip taste-tag row + a single-line common-ground band slot. No layout shift on public branch. Locked branch sees taste-tag + common-ground skeletons flash before LockedProfileState. | |
| Two-skeleton variants | ProfileShellSkeleton (prefetch fallback, chrome-only) + ProfilePublicSkeleton (deferred). Functionally equivalent to chrome-only for this phase. | |

**User's choice:** Chrome-only

### Sub-question 2: unstable_instant adoption

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add it (Recommended) | `export const unstable_instant = { prefetch: 'static' }` on `[tab]/page.tsx`. Build-time invariant. Debug doc identified this as the Next 16 native acceptance test for the refactor. | ✓ |
| No — defer | Skip the build-time gate. Trust manual verification + tests. Easier to land but loses the structural guarantee against regressions. | |
| Add it but only on the layout file | Per Next 16 docs, segment-level export goes on the page, not the layout. `unstable_instant = false` on a layout EXEMPTS it. Wrong scope for our use case. | |

**User's choice:** Yes — add it

---

## Claude's Discretion

- Whether to split `<ProfileShellResolver/>` into two cache scopes (gate-only vs. full chrome) — planner decides.
- Exact tag-key shape for `profile:${username}` vs. `profile:${profile.id}` at write-time call sites — use whichever the action has in hand.
- Exact file location for `<ProfileGate/>` and `<ProfileShellResolver/>` source files — co-locate or use a `_components/` subdirectory.
- Whether to keep `'use client'` on `<ProfileHeader/>` (current pattern, no refactor needed).

---

## Deferred Ideas

- **`src/app/login/login-form.tsx` push/refresh ordering hardening** — debug doc identified as possible upstream cause (prefetch issued before cookie propagation). Backlog follow-up.
- **Audit other layouts for similar `cacheComponents: true` violations** — there may be other layouts in `src/app/` performing uncached top-level fetches. Not enumerated in this phase.
- **Splitting `<ProfileShellResolver/>` into two cache scopes** (gate-only vs. full chrome) — v5.x perf polish backlog if planner defers.
- **`/u/[username]/followers` and `/u/[username]/following` pages** — sibling routes inherit the layout's static shell automatically but their own page bodies are out of scope for `unstable_instant` here.

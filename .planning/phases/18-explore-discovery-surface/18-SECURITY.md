---
phase: 18
slug: explore-discovery-surface
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-28
---

# Phase 18 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| HTTP request → /explore route | proxy.ts redirects unauth viewers to /login (Pitfall 7); only authenticated requests reach the page Server Component | viewer session cookie |
| client → /explore route handler | unauth user blocked by proxy.ts; auth user reaches Server Components | session cookie |
| Server Component → DAL | viewerId server-resolved via getCurrentUser(); never client-supplied | viewer userId |
| page render → cached children | viewerId flows as prop into PopularCollectors 'use cache' scope (Pitfall 1) | viewerId, collector profiles |
| DAL → Postgres | Drizzle parameterized queries (sql template); no raw concat | sanitized SQL params |
| Server Component render → React JSX | catalog data (brand/model/imageUrl) escaped by React; imageUrl protocol-validated by Phase 17 sanitizeHttpUrl | watch metadata, profile data |
| Server Action → Next 16 cache layer | invalidations run only after successful DAL writes; failure paths do not fire tags | cache tag invalidations |
| client → BottomNav render | usePathname is client-resolved; isPublicPath gate prevents nav chrome from leaking on auth pages (Phase 14 contract preserved) | route pathname |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-18-01-01 | Information Disclosure | getMostFollowedCollectors → profiles join | mitigate | `src/data/discovery.ts:87` — `eq(profileSettings.profilePublic, true)` two-layer-privacy WHERE clause | closed |
| T-18-01-02 | Tampering (SQL injection) | getGainingTractionCatalogWatches raw `sql` template | mitigate | `src/data/discovery.ts:212-216, 246, 265` — Drizzle `${}` parameterization for `${window}` and `${limit}`; both server-computed integers; no string concat | closed |
| T-18-01-03 | Tampering (IDOR) | getMostFollowedCollectors viewerId | mitigate | `src/app/explore/page.tsx:31,43`, `src/app/explore/collectors/page.tsx:18-19` — viewerId always `user.id` from `getCurrentUser()` | closed |
| T-18-01-04 | Information Disclosure (cross-user count leak) | getWearEventsCountByUser | mitigate | `src/data/wearEvents.ts:420-426` — DAL filters `eq(wearEvents.userId, userId)`; userId server-resolved at `src/app/explore/page.tsx:35` | closed |
| T-18-01-05 | DoS via empty notInArray | getMostFollowedCollectors | mitigate | `src/data/discovery.ts:88` — conditional guard `excludeIds.length > 0 ? notInArray(...) : undefined` | closed |
| T-18-01-06 | Information Disclosure (count() type coercion) | getMostFollowedCollectors followersCount sort | mitigate | `src/data/discovery.ts:80, 92, 105` and `src/data/wearEvents.ts:422` — all aggregates cast `count(...)::int` | closed |
| T-18-02-01 | Information Disclosure (cross-user cache leak) | PopularCollectors 'use cache' | mitigate | `src/components/explore/PopularCollectors.tsx:22-24` — viewerId is prop; `'use cache'` directive at line 23; cacheTag includes per-viewer suffix `viewer:${viewerId}` at line 24 | closed |
| T-18-02-02 | Information Disclosure (cache scope collision) | All three rails on 'explore' tag | mitigate | Per-rail tags verified: `PopularCollectors.tsx:24` per-viewer suffix; `TrendingWatches.tsx:19` `explore:trending-watches`; `GainingTractionWatches.tsx:21` `explore:gaining-traction`. Bare `explore` tag is fan-out root only | closed |
| T-18-02-03 | Stored XSS (catalog brand/model/imageUrl strings) | DiscoveryWatchCard render | mitigate | `src/components/explore/DiscoveryWatchCard.tsx:40-42` — brand/model rendered as JSX text nodes (auto-escaped); imageUrl line 33 protocol-validated by `sanitizeHttpUrl` at write time (`src/data/catalog.ts:20-29`); 0 `dangerouslySetInnerHTML` matches in `src/components/explore/` | closed |
| T-18-02-04 | Information Disclosure (private profile leak) | PopularCollectors row data | mitigate | `src/components/explore/PopularCollectorRow.tsx:21-71` consumes filtered DAL output; inherits two-layer-privacy gate at `src/data/discovery.ts:87` | closed |
| T-18-03-01 | Information Disclosure (auth bypass on See-all routes) | /explore/collectors and /explore/watches | mitigate | `src/lib/constants/public-paths.ts:1-7` — PUBLIC_PATHS contains only auth routes; 0 `/explore` matches. `src/proxy.ts:11-15` redirects all non-public paths to `/login` | closed |
| T-18-03-02 | Information Disclosure (per-viewer data in cached scope) | /explore page → PopularCollectors | mitigate | `src/app/explore/page.tsx:30-47` — page Server Component is NOT `'use cache'`; hero gate `Promise.all` runs uncached (line 33-36); viewerId flows as prop (line 43) | closed |
| T-18-03-03 | Tampering (URL manipulation to skip See-all auth) | /explore/collectors?bypass=1 etc | mitigate | `src/proxy.ts:8-15` — gate keys on `request.nextUrl.pathname` only; query params do not affect gate; `next` redirect param preserved | closed |
| T-18-04-01 | Information Disclosure (auth-chrome leak on PUBLIC_PATHS) | BottomNav | mitigate | `src/components/layout/BottomNav.tsx:8, 104` — imports `isPublicPath` from shared module; line 104 `if (isPublicPath(pathname)) return null` early-return preserved verbatim. `/search` is NOT in PUBLIC_PATHS | closed |
| T-18-04-02 | Tampering (active-state drift after slot reorder) | BottomNav predicates | mitigate | Grep across `src/` returns 0 `isAdd` references; `src/components/layout/BottomNav.tsx:107-110` defines exactly 5 active-state predicates covering all new slots | closed |
| T-18-04-03 | Tampering (silent navigation to deprecated /watch/new bottom-tap) | BottomNav slot 4 | accept | Phase 18 D-02 explicitly accepts interim friction between Phase 18 ship and Phase 25 ship. Mobile users still reach /watch/new via WatchPicker dialog and direct URL — risk is UX, not security. Reopen if friction surfaces during UAT | closed |
| T-18-05-01 | Information Disclosure (stale-cache leaking just-followed user to Popular Collectors) | followUser → PopularCollectors cache | mitigate | `src/app/actions/follows.ts:86` (followUser success path) and `:123` (unfollowUser success path) — `updateTag(\`explore:popular-collectors:viewer:${user.id}\`)` fires after DAL write succeeds | closed |
| T-18-05-02 | Tampering (single-arg revalidateTag legacy semantics) | addWatch invalidation | mitigate | `src/app/actions/watches.ts:177, 218, 248` — three call sites all use two-arg form `revalidateTag('explore', 'max')`; 0 single-arg legacy form for the explore tag | closed |
| T-18-05-03 | Information Disclosure (cache scope cross-user contamination via wrong tag) | followUser invalidation | mitigate | `src/app/actions/follows.ts:86, 123` — viewer-suffixed `viewer:${user.id}` (the FOLLOWER); grep `'explore'` returns 0 matches in `src/app/actions/follows.ts` — bare `explore` tag NOT fired by follow actions | closed |
| T-18-05-04 | Availability (over-invalidation cascade) | addWatch fan-out | accept | Bare `explore` tag invalidates all three rails on every addWatch. At v4.0 scale (<500 watches per user, low write rate) this is well under the cache-thrash threshold. Acceptable for SWR semantics | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-18-01 | T-18-04-03 | Interim UX friction (Phase 18 D-02): the Add slot in BottomNav was dropped to make room for Search/Explore. Mobile users still reach /watch/new via WatchPicker dialog and direct URL. Phase 25 will surface contextual CTAs (UX-01..UX-04) as the durable replacement. Reopen if UAT surfaces friction. | Tyler Waneka | 2026-04-28 |
| AR-18-02 | T-18-05-04 | Over-invalidation cascade: bare `explore` tag invalidates all three rails on every addWatch. At v4.0 scale (<500 watches/user, low write rate) this is well under cache-thrash threshold. Per-rail tag granularity deferred until scale warrants. | Tyler Waneka | 2026-04-28 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-28 | 20 | 20 | 0 | gsd-security-auditor (Sonnet) |

### Audit Notes (2026-04-28)
- All 18 `mitigate` threats verified with grep-evidenced patterns in implementation files.
- 2 `accept` threats (T-18-04-03, T-18-05-04) pre-documented in PLANs with rationale; rationale carried to Accepted Risks Log above.
- No unregistered threats surfaced; SUMMARY threat-status tables matched the registered IDs.
- ASVS Level 1 verification scope.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-28

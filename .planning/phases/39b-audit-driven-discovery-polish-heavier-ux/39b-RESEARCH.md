# Phase 39b: Audit-Driven Discovery Polish — Heavier UX — Research

**Researched:** 2026-05-13
**Domain:** Next.js 16 App Router (Server / Client component composition), Drizzle ORM aggregation queries, Postgres RLS + two-layer privacy pattern, shadcn / base-ui presentational components, idempotent operator backfill scripts
**Confidence:** HIGH

---

## Quick Summary

- **Zero new schema, zero new migrations.** All four closures are UI-only patches + queries against existing tables (`watches`, `profiles`, `profile_settings`, `watches_catalog`, `watch_lineage_edges`, `watch_families`). Wave 0 is data-only: operator runs `scripts/seed-lineage.ts` against prod DB to write `family_id` updates + lineage edge rows.
- **`getLineageForReference(catalogId)` already returns brand / model / reference / relationship_type / depth / direction.** It does NOT return `imageUrl`. Lineage rail consumption requires EITHER (a) extending the function to JOIN `image_url` from `watches_catalog`, OR (b) a follow-up `inArray` batch lookup. **Recommendation: extend the function** — single SQL touch, no N+1, mirrors the `mapRowToCatalogEntry` pattern.
- **`getCatalogById(catalogId)` already returns `CatalogTasteAttributes` fields embedded in `CatalogEntry`** (formality, sportiness, heritageScore, primaryArchetype, eraSignal, designMotifs, confidence, extractedFromPhoto — all on rows 77–84 of `src/data/catalog.ts`). `/catalog/{id}` ReferenceIdentityCard reads `catalogEntry.formality`/etc. directly. NO new DAL fetch needed. **`/watch/{id}` reads `watch.catalogTaste`** (Phase 38 D-10 LEFT JOIN, already populated by `getWatchesByUser`).
- **No canonical `getViewableUserIds()` helper exists.** Every privacy-gated DAL inlines the same pattern: `.innerJoin(profileSettings, eq(profileSettings.userId, profiles.id)).where(and(eq(profileSettings.profilePublic, true), ...))`. NSV-18 follows the same inline pattern — see Phase 18 `getMostFollowedCollectors` (`src/data/discovery.ts:74-93`) as the closest precedent.
- **NSV-18 ranking is `created_at DESC` on `watches`, NOT `ownersCount`.** D-39b-10 locks most-recent-added liveness signal; the chip row's collector list is "who most recently added this catalog ref to their collection," not "who is most popular."
- **`AvatarDisplay` only supports `size = 40 | 64 | 96`** (`src/components/profile/AvatarDisplay.tsx:10`). UI-SPEC specifies `size=36` for NSV-18 chips — this is a footgun. Planner must EITHER extend `AvatarDisplay` to accept `36` OR substitute `size=40` in the chip row. Recommendation: use `40` to avoid scope drift on a presentational primitive used in 6+ places.
- **`WornCalendar` `WearEventLite` interface omits `note` field** (`src/components/profile/WornCalendar.tsx:16-20`). The parent already passes notes from `WornTabContent` (`src/app/u/[username]/[tab]/page.tsx:255-260` maps `e.note ?? null`). Phase 39b patch must EXTEND the interface to include `note: string | null` so the wear-detail panel can render notes. NO upstream data-flow change needed.
- **`FollowButton` `variant="inline"` exists** at `src/components/profile/FollowButton.tsx:110-116` (border + h-8 + bg-muted-when-following). PopularCollectorRow uses exactly this variant — D-39b-12 LockedTabCard reuses the same pattern.
- **Server Components MAY import Client Components in Next 16 App Router** (verified at `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` § "Interleaving Server and Client Components"). LockedTabCard remains a Server Component; the imported `FollowButton` is the only client island. Precedent: `PopularCollectorRow.tsx` is a Server Component importing `FollowButton` without `'use client'`.
- **No new shadcn registry installs.** `Card`, `Badge`, `Button` (`buttonVariants`), `AvatarDisplay`, `Link`, `Image` all exist in `src/components/ui/` or `src/components/profile/`. Phase 39b ships zero `npx shadcn add` calls.
- **`scripts/backfill-catalog-brands.ts` is the canonical pattern** for `scripts/seed-lineage.ts`: `tsx --env-file=.env.local`, `DATABASE_URL` inline override for prod, 3-pass idempotent (each pass exits cleanly on re-run), summary line at finish, `process.exit(1)` on fail-assertion. Wave 0 plan ships the script + adds `db:seed-lineage` to `package.json`.

**Primary recommendation:** Plan Wave 1 as **5 plans** — (1) `ReferenceIdentityCard` component + static guard + page mounts, (2) NSV-14 sub-cluster (LockedTabCard + WornCalendar + StatsTabContent in one plan since file-overlap is zero), (3) NSV-18 roster (new DAL `getCollectorsForCatalog` + page section), (4) Lineage rails (extend `getLineageForReference` + new DAL `getSameFamilyForCatalog` + 2 inline rail server components), and **Wave 0** as 1 plan: operator-curation seed script + prod-DB commit.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward from Phase 39 CONTEXT.md (do NOT re-litigate):**
- **D-39b-01** — ReferenceIdentityCard is a NEW component at `src/components/insights/ReferenceIdentityCard.tsx`, sibling to `CollectionFitCard`. Renders catalog taste signature with no fit-judgment.
- **D-39b-02** — Card content: era + primary archetype headline; formality / sportiness / heritage scale bars; design motifs chip cluster. Confidence shown only as muted subtitle ("Inferred taste signature").
- **D-39b-03** — Confidence gate: `catalogTaste === null || catalogTaste.confidence < 0.5` → suppress card. Matches project-wide 0.5 gate (Phase 19.1 D-13, Phase 20 viewerTasteProfile, Phase 38 D-02).
- **D-39b-04** — Identical rendering on `/watch/{id}` and `/catalog/{id}`. ONE component, TWO callsites. CTAs render BELOW the card.
- **D-39b-05** — Inline rails only, no `/family/{familyId}` page.
- **D-39b-06** — Two rails per surface: "Same family" + "Lineage". Sourced from Phase 34 `family_id` and Phase 35 `getLineageForReference()` recursive CTE.
- **D-39b-07** — Hide-rail-if-empty graceful degradation. Module absent, NEVER empty state.
- **D-39b-08** — Operator-curation seed pass ships INSIDE Phase 39b via `scripts/seed-lineage.ts`. No admin UI.

**NSV-18 catalog roster (D-39b-09 .. D-39b-11):**
- **D-39b-09** — Roster size: top 5, no pagination. Show "X collectors own this" count label ONLY when total > 5. Hide entire section when total === 0.
- **D-39b-10** — Sort: `ORDER BY watches.created_at DESC`. Alphabetical tiebreaker only on tie. NO follower-count subquery.
- **D-39b-11** — Layout: horizontal avatar + username chip row. Click → `/u/{username}/collection`. Reuses `/explore` PopularCollectors visual vocabulary.

**NSV-14 sub-cluster (D-39b-12 .. D-39b-14):**
- **D-39b-12** — LockedTabCard CTA: inline `FollowButton` + caption "Follow @{username} to see their {label}." for logged-in viewers. "Sign in to follow" Link → `/signin?returnTo={currentPath}` for unauthenticated. Applied to all 4 locked variants (collection / wishlist / notes / stats). `tab === 'common-ground'` returns null unchanged.
- **D-39b-13** — WornCalendar day-cell onClick: add `selectedDate` client state; wear-detail panel BELOW the grid. First day with events selected on mount.
- **D-39b-14** — StatsTabContent Link wraps: wrap each `<li>` in `WornList` (Most Worn + Least Worn) with `<Link href="/watch/${watch.id}">`. Style/Role `HorizontalBarChart` bars stay non-clickable.

**Lineage rails (D-39b-15 .. D-39b-17):**
- **D-39b-15** — "Same family" rail sort: `ORDER BY COUNT(watches.catalog_id) DESC, brand ASC, model ASC`. Lineage rail orders by Phase 35 CTE traversal order (depth ASC, predecessor before successor).
- **D-39b-16** — Lineage rail relationship_type display labels: directional — `predecessor → "Predecessor"`, `successor → "Successor"`, `remake → "Modern remake"`, `tribute → "Tribute to"`, `homage → "Homage to"`. Each Lineage card renders a chip carrying its label. "Same family" rail has NO per-card chip.
- **D-39b-17** — Cap 6 cards per rail, scrollable horizontally on overflow. "See all in family" link HIDDEN in 39b (deferred to v5.x via TODO comment).

**Curation seed pass (D-39b-18 .. D-39b-20):**
- **D-39b-18** — Operator authors seed list during plan execution. Planner ships `scripts/seed-lineage.ts` with a TODO block listing target family categories (Submariner / Speedmaster / Royal Oak / Sub homages, etc.); operator writes actual values when curation plan runs.
- **D-39b-19** — Curation plan is **Wave 0 — BLOCKING** — ships BEFORE UI plans. Execution order: Wave 0 (operator seed → prod) → Wave 1 (UI plans). `autonomous: false` on curation plan; prod-deploy checkpoint at end of Wave 0.
- **D-39b-20** — Seed script idempotency contract: `UPDATE watches_catalog SET family_id = X WHERE catalog_id = Y AND family_id IS NULL` (never overwrite existing) + `INSERT INTO watch_lineage_edges (...) ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING`. Matches Phase 34 `scripts/backfill-catalog-brands.ts` pattern.

### Claude's Discretion (resolved by 39b-UI-SPEC.md)

- **ReferenceIdentityCard visual treatment** — RESOLVED: horizontal filled bar (`bg-foreground/70` fill over `bg-muted` track), `h-1.5` height, three bars stacked `space-y-2`. Stays inside existing project tokens; no SVG.
- **Import-boundary static guard for ReferenceIdentityCard** — MANDATED in UI-SPEC (Test Coverage Contract). Author `tests/static/ReferenceIdentityCard.no-engine.test.ts` mirroring `tests/static/CollectionFitCard.no-engine.test.ts`. Assert no imports from `@/lib/similarity` or `@/lib/verdict/composer`.
- **Plan packaging / wave structure** — Wave 0 = curation plan (D-39b-19). Wave 1 = 5 UI plans (planner discretion, see Wave plan in Quick Summary above).
- **WornCalendar wear-detail panel content density** — RESOLVED: watch image (48×48) + brand + model + notes only. No wear time, no photos.
- **NSV-18 chip styling** — RESOLVED: `w-16` chip width, `size=36` avatar (BUT see Pitfall below — AvatarDisplay primitive only supports 40/64/96), `text-xs text-muted-foreground` username label, absolute-inset Link.

### Deferred Ideas (OUT OF SCOPE)

- **`/family/{familyId}` dedicated page** → v5.x or absorbed by SEED-008 v5.1 Browse the Catalog module
- **Admin UI for lineage edge curation** → v5.x (39b uses operator script only)
- **`/catalog/{id}` explicit predecessor/successor chain visualization** → v5.x polish
- **WishlistRail drag-handle silent no-op (DISC-AUDIT-99)** → own bugfix ticket
- **NSV-41 search inline-expand fresh-account verdict** → v5.x
- **All 21 med/low-leverage Phase 33b cells** (NSV-03/04/07/09/10/13/17/21/23/24/25/27/29/30/31/33/34/36/37/38/39/41) → v5.x
- **Confidence numeric percentage display** on ReferenceIdentityCard — D-39b-02 explicit no-numeric lock
- **Style/Role HorizontalBarChart bar Link wraps** — D-39b-14 explicit exclusion (no single-watch click destination)
- **WornCalendar day-cell modal/sheet overlay** — D-39b-13 chose below-calendar panel pattern
- **Roster pagination / "See all owners" sub-route** — D-39b-09 hard-capped at top 5
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-11 (heavier-tier subset) | NSV-06+20 fresh-account ReferenceIdentityCard, NSV-14 8-row Collector Profile sub-cluster, NSV-18 catalog other-owners roster, NSV-02+16 inline lineage rails with operator-curation seed pass | All four closures map to existing schema + DALs. ReferenceIdentityCard consumes `Watch.catalogTaste` (Phase 38 D-10) and `CatalogEntry.{formality,sportiness,...}` (already populated by Phase 19.1). NSV-14 patches three sibling files with no new types. NSV-18 needs ONE new DAL (`getCollectorsForCatalog`). Lineage rails need ONE extension (`getLineageForReference` add imageUrl) + ONE new DAL (`getSameFamilyForCatalog`). Wave 0 ships data via idempotent operator script mirroring Phase 34's `scripts/backfill-catalog-brands.ts`. |

**Audit row anchors per ROADMAP §39b SC#1:**
- NSV-06: `DISC-AUDIT-81`, `DISC-AUDIT-131`
- NSV-20: `DISC-AUDIT-70`, `DISC-AUDIT-130`
- NSV-14: `DISC-AUDIT-97`, `DISC-AUDIT-102`, `DISC-AUDIT-111`, `DISC-AUDIT-122`, `DISC-AUDIT-123`, `DISC-AUDIT-124`
- NSV-18: `DISC-AUDIT-70`, `DISC-AUDIT-72`
- NSV-02: anchored to Phase 33b NSD-15 rule 3 (no per-row DISC-AUDIT id; missing affordance)
- NSV-16: `DISC-AUDIT-130`
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ReferenceIdentityCard (pure renderer) | Frontend Server (RSC) | — | No state, no hooks, no engine imports. Same constraint as `CollectionFitCard` (Phase 20 D-04). Renders on the server, ships zero JS to the client. |
| ReferenceIdentityCard mount + confidence gate (`/watch/{id}`) | Frontend Server (RSC, `src/app/watch/[id]/page.tsx`) | — | Page is already a Server Component; reads `watch.catalogTaste` from `getWatchesByUser` LEFT JOIN. No client hop. |
| ReferenceIdentityCard mount + confidence gate (`/catalog/{id}`) | Frontend Server (RSC, `src/app/catalog/[catalogId]/page.tsx`) | — | Page is already a Server Component; reads `catalogEntry.formality / .sportiness / ...` directly from `getCatalogById`. No client hop. |
| LockedTabCard inline FollowButton | Frontend Server (RSC, `LockedTabCard.tsx`) | Browser / Client (`FollowButton` client island) | Next 16 allows server → client component imports. LockedTabCard stays RSC; only FollowButton hydrates. Identical pattern to `PopularCollectorRow.tsx`. |
| WornCalendar wear-detail panel | Browser / Client (`'use client'` already set) | — | Component already client; `selectedDate` state addition does NOT change directive. |
| StatsTabContent Link wraps | Frontend Server (RSC) | — | Server-renderable `<Link>` wrap pattern; matches Phase 39 D-07 NSV-01/15 precedent. |
| NSV-18 other-owners roster aggregation | API / Database (Drizzle DAL in `src/data/collectors.ts` or `src/data/discovery.ts`) | Frontend Server (RSC mount) | Aggregation query (Drizzle ORM); RLS enforced at Postgres + DAL WHERE clause (two-layer privacy). Result serialized into RSC props. |
| NSV-18 chip row render | Frontend Server (RSC, inline section in `/catalog/{id}/page.tsx`) | — | Pure HTML output; no client interactivity beyond `<Link>` clicks. |
| Same-family rail aggregation | API / Database (Drizzle DAL — NEW `getSameFamilyForCatalog` in `src/data/hierarchy.ts`) | Frontend Server (RSC mount) | New DAL function; GROUP BY `watches.catalog_id` with COUNT for ranking; depends on Phase 34 `family_id` column. |
| Lineage rail aggregation | API / Database (`getLineageForReference` in `src/data/hierarchy.ts`, EXTENDED to include `image_url`) | Frontend Server (RSC mount) | Existing recursive CTE; trivial JOIN extension to surface imageUrl. No new function needed. |
| Operator-curation seed | Build / Operator script (`scripts/seed-lineage.ts`) | Database (prod DB via `DATABASE_URL` inline override) | Idempotent service-role write; matches `scripts/backfill-catalog-brands.ts` pattern. |

## Standard Stack

### Core (already in repo at HEAD — verified)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.3 | App Router server / client components | Already in package.json. Server / client interleaving verified in `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`. |
| `react` | 19.2.4 | Component rendering | Already in package.json. |
| `drizzle-orm` | ^0.45.2 | Type-safe SQL DSL for new DAL functions | Project standard since Phase 17. All existing DALs use `.select().from(...).innerJoin(...).where(...)` shape. |
| `drizzle-orm/sql` | (same) | Raw SQL escape for recursive CTE extension | Already used in `src/data/hierarchy.ts`. |
| `tsx` | (dev, transitive via existing scripts) | Run TypeScript files as scripts | Used by `scripts/backfill-catalog-brands.ts`. |
| `@/db` (postgres-js client) | — | Drizzle client | Already wired. |
| `lucide-react` | ^1.8.0 | Icons (`Lock`, `Flame`, etc.) | Already in components/profile and components/explore. |
| `tailwindcss` | ^4 | Utility classes | Project standard. |
| `vitest` | ^2.1.9 | Static guard test runner | Existing pattern at `tests/static/CollectionFitCard.no-engine.test.ts`. |

**Version verification (verified 2026-05-13 via `package.json` read):**
- next: 16.2.3 (locked at top-level)
- react: 19.2.4
- drizzle-orm: ^0.45.2 (latest installed; matches all Phase 34/35/36/37 DAL patterns)
- vitest: ^2.1.9

### Supporting (already in repo)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `next/link` | Client-side navigation; lineage rail card wraps; chip row Links; WornList Link wraps; LockedTabCard sign-in link | Every navigational affordance Phase 39b adds. |
| `next/image` | Wear-detail panel watch images (48×48); avatar images already handled by `AvatarDisplay` | Wear-detail panel only — chips use `AvatarDisplay`. |
| `@base-ui/react` | Existing primitives | NOT needed for Phase 39b (no new primitive surface). |
| `@/components/ui/card` `@/components/ui/badge` `@/components/ui/button` (`buttonVariants`) | shadcn primitives | ReferenceIdentityCard wraps in `<Card>`; lineage chip uses `<Badge variant="outline">`; LockedTabCard sign-in link styled with `buttonVariants({ variant: 'outline' })`. |
| `@/components/profile/AvatarDisplay` | Avatar component | NSV-18 chip row — see PITFALL: only supports size 40/64/96. |
| `@/components/profile/FollowButton` | Follow CTA | NSV-14 LockedTabCard inline — `variant="inline"`. |
| `@/components/explore/DiscoveryWatchCard` | Reusable rail card | Both lineage rails reuse this card unchanged. |
| `@/lib/watchFlow/destinations` `validateReturnTo` | Open-redirect-safe regex | NOT directly needed by 39b (Phase 39b uses `currentPath` at render time, not parse time), but mentioned in case planner wants to defense-in-depth the sign-in CTA. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extend `getLineageForReference` to JOIN image_url | Add separate `getCatalogImagesByIds(ids: string[])` batch helper | Both work. The JOIN extension is one SQL touch with no N+1 risk; the batch helper adds an extra round-trip. **Use JOIN extension.** |
| New DAL `getCollectorsForCatalog` in `src/data/collectors.ts` | Add to `src/data/discovery.ts` (already houses `getMostFollowedCollectors`) or `src/data/catalog.ts` | `discovery.ts` is the closest precedent (lives alongside the most-followed-collectors pattern); `catalog.ts` is catalog-row-shaped, not collector-shaped. **Recommendation: place in `src/data/discovery.ts`** to keep cross-collector aggregations co-located. |
| New DAL `getSameFamilyForCatalog` in `src/data/hierarchy.ts` | Add to `src/data/catalog.ts` | `hierarchy.ts` is the lineage / family DAL; `getSameFamilyForCatalog` is conceptually a sibling of `getLineageForReference`. **Recommendation: `src/data/hierarchy.ts`.** |
| LockedTabCard becomes `'use client'` | Keep as Server Component, import `FollowButton` (client) | Server-first wins on bundle size + RSC composition norms. PopularCollectorRow precedent already demonstrates this in production. **Keep as Server Component.** |

**Installation:** None. Zero new packages. Phase 39b ships entirely on existing dependencies.

## Architecture Patterns

### System Architecture Diagram — Phase 39b data flow

```
                       ┌──────────────────┐
   Operator (Wave 0) ─►│ seed-lineage.ts  │──► prod DB UPDATE watches_catalog.family_id
                       │ (idempotent)     │──► prod DB INSERT watch_lineage_edges
                       └──────────────────┘

                                  ▼ (after Wave 0 ships)

   Browser request /watch/[id]    Browser request /catalog/[catalogId]
            │                              │
            ▼                              ▼
   ┌─────────────────────┐        ┌────────────────────────┐
   │ src/app/watch/[id]/ │        │ src/app/catalog/       │
   │     page.tsx        │        │   [catalogId]/page.tsx │
   │  (Server Component) │        │  (Server Component)    │
   └──────────┬──────────┘        └───────────┬────────────┘
              │                                │
              │ getWatchesByUser (Phase 38      │ getCatalogById (taste fields
              │   LEFT JOIN catalogTaste)       │   already on CatalogEntry)
              │                                │
              ├──► ReferenceIdentityCard ◄─────┤  (one component, two callsites)
              │     (confidence ≥ 0.5 gate)    │
              │                                │
              │                                ├──► getCollectorsForCatalog ──► NSV-18 chip row
              │                                │     (NEW DAL — two-layer       (inline section)
              │                                │      privacy + ORDER BY
              │                                │      watches.created_at DESC)
              │                                │
              ├──► getSameFamilyForCatalog ◄───┤  (NEW DAL — GROUP BY catalog_id
              │     ──► Same-family rail        │   COUNT DESC; reuses
              │                                │   DiscoveryWatchCard)
              │                                │
              └──► getLineageForReference ─────┤  (EXISTING DAL — extend to
                    ──► Lineage rail            │   include image_url; chip
                    (DiscoveryWatchCard +       │   per card per D-39b-16
                     relationship chip)         │   relationship label)
                                                │
                                                └──► CTA block (already exists)

   Browser request /u/[username]/[tab]
            │
            ▼
   ┌────────────────────────────┐
   │ src/app/u/[username]/      │
   │   [tab]/page.tsx           │
   │ (Server Component — already)│
   └────────┬───────────────────┘
            │
            ├──► LockedTabCard (Server)
            │     └──► FollowButton (Client island — variant="inline")
            │
            ├──► WornCalendar ('use client' — already)
            │     └──► wear-detail panel (new client state: selectedDate)
            │
            └──► StatsTabContent (Server)
                  └──► WornList <li> wrapped in <Link href="/watch/{id}">
```

### Recommended Project Structure (delta from existing)

```
src/
├── components/
│   ├── insights/
│   │   ├── CollectionFitCard.tsx           # unchanged
│   │   └── ReferenceIdentityCard.tsx       # NEW — pure RSC, no engine imports
│   ├── profile/
│   │   ├── LockedTabCard.tsx               # PATCH — inline FollowButton + caption
│   │   ├── WornCalendar.tsx                # PATCH — selectedDate state + panel
│   │   ├── StatsTabContent.tsx             # PATCH — WornList <li> Link wraps
│   │   ├── FollowButton.tsx                # unchanged (reused)
│   │   └── AvatarDisplay.tsx               # unchanged (reused at size=40 — see Pitfall)
│   └── explore/
│       └── DiscoveryWatchCard.tsx          # unchanged (reused in lineage rails)
├── data/
│   ├── discovery.ts                        # PATCH — add getCollectorsForCatalog(catalogId, viewerId)
│   ├── hierarchy.ts                        # PATCH — extend getLineageForReference (add image_url JOIN)
│   │                                       #       — add getSameFamilyForCatalog(catalogId)
│   ├── catalog.ts                          # unchanged
│   ├── profiles.ts                         # unchanged
│   └── watches.ts                          # unchanged
├── app/
│   ├── watch/[id]/page.tsx                 # PATCH — mount RIC + rails (fresh-account branch)
│   └── catalog/[catalogId]/page.tsx        # PATCH — mount RIC + roster + rails (fresh-account branch)
└── lib/types.ts                            # unchanged (CatalogTasteAttributes already exists)

scripts/
└── seed-lineage.ts                         # NEW — operator-authored idempotent seed

tests/
└── static/
    └── ReferenceIdentityCard.no-engine.test.ts  # NEW — mirror CollectionFitCard guard

package.json                                # PATCH — add db:seed-lineage npm script
```

### Pattern 1: Two-layer privacy on cross-user aggregation (NSV-18)

**What:** Filter `watches × profiles × profile_settings` rows by `profile_public = true` AND `collection_public = true` AND viewer self-exclusion.

**When to use:** Any cross-user list that surfaces "other users who…" — Phase 39b's NSV-18 catalog other-owners roster is the load-bearing case.

**Example (canonical NSV-18 query — adapted from `src/data/discovery.ts:74-93`):**

```typescript
// Source: src/data/discovery.ts getMostFollowedCollectors pattern + src/data/search.ts:60-93
//
// NEW DAL — src/data/discovery.ts (or new src/data/collectors.ts)
//
export interface CatalogCollector {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export async function getCollectorsForCatalog(
  catalogId: string,
  viewerId: string,
  opts: { limit?: number } = {},
): Promise<{ collectors: CatalogCollector[]; totalCount: number }> {
  const limit = opts.limit ?? 5

  // Two-layer privacy: profile_public = true AND collection_public = true.
  // Self-exclusion: profiles.id != viewerId.
  // Sort: watches.created_at DESC (most-recent-added) per D-39b-10, alpha tiebreaker.
  const rows = await db
    .select({
      userId: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      addedAt: watches.createdAt,
    })
    .from(watches)
    .innerJoin(profiles, eq(profiles.id, watches.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .where(
      and(
        eq(watches.catalogId, catalogId),
        eq(profileSettings.profilePublic, true),
        eq(profileSettings.collectionPublic, true),
        sql`${profiles.id} != ${viewerId}`,
        // Optional: filter watches.status to non-divested? D-39b-09 silent on this
        // — RECOMMEND status IN ('owned', 'wishlist', 'grail') so a sold row
        // doesn't surface a collector who no longer owns the watch. Sold = past
        // ownership, not current. PLANNER MUST CONFIRM during discuss-phase.
      ),
    )
    .orderBy(desc(watches.createdAt), asc(profiles.username))
    .limit(50)  // pre-LIMIT cap; final slice below

  // Total count for "X collectors own this" label (D-39b-09).
  // SEPARATE query — count(*) on the same WHERE clause without LIMIT.
  const totalRows = await db
    .select({ count: sql<number>`count(DISTINCT ${profiles.id})::int` })
    .from(watches)
    .innerJoin(profiles, eq(profiles.id, watches.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .where(
      and(
        eq(watches.catalogId, catalogId),
        eq(profileSettings.profilePublic, true),
        eq(profileSettings.collectionPublic, true),
        sql`${profiles.id} != ${viewerId}`,
      ),
    )
  const totalCount = totalRows[0]?.count ?? 0

  // De-duplicate by userId (a collector may have multiple watches with the same
  // catalogId — e.g., wishlist row + owned row). Keep first occurrence (latest
  // addedAt because ORDER BY DESC).
  const seen = new Set<string>()
  const collectors: CatalogCollector[] = []
  for (const r of rows) {
    if (seen.has(r.userId)) continue
    seen.add(r.userId)
    collectors.push({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    })
    if (collectors.length >= limit) break
  }
  return { collectors, totalCount }
}
```

**Caveat:** Confirm with planner whether `watches.status` should be filtered. If a viewer's catalog page can surface collectors who marked the watch `sold` (divested), the count is misleading. RECOMMEND filter `status IN ('owned', 'wishlist', 'grail')` — defensible based on D-39b-09's "collectors own this" copy semantics. Sold ≠ owns.

### Pattern 2: Same-family rail with collector-popularity ranking (NSV-02+16)

**What:** Find catalog rows in the same `family_id`, ranked by how many `watches` rows link to them (collector popularity).

**Example (NEW DAL — `src/data/hierarchy.ts`):**

```typescript
// Source: pattern matches discovery.ts getTrendingCatalogWatches (`ownersCount`
// is denormalized via pg_cron in Phase 17 — could reuse, but Phase 39b spec
// asks for COUNT(watches.catalog_id) which is the live count, not snapshot).
//
// Recommendation: use the denormalized `owners_count` column ALREADY ON
// watches_catalog (computed daily by pg_cron) for the ORDER BY ranking.
// Faster, simpler, no JOIN. The trade-off: counts can be up to ~24h stale.
// For Phase 39b that's acceptable (D-39b-15 doesn't lock liveness).

export interface SameFamilyWatch {
  id: string                   // watches_catalog.id
  brand: string
  model: string
  imageUrl: string | null
  ownersCount: number          // for sublabel rendering
}

export async function getSameFamilyForCatalog(
  catalogId: string,
  opts: { limit?: number } = {},
): Promise<SameFamilyWatch[]> {
  const limit = opts.limit ?? 6

  // Two-pass: (1) read family_id of the input row, (2) find siblings.
  const rootRows = await db
    .select({ familyId: watchesCatalog.familyId })
    .from(watchesCatalog)
    .where(eq(watchesCatalog.id, catalogId))
    .limit(1)
  const familyId = rootRows[0]?.familyId
  if (!familyId) return []  // No family assigned → rail hides (D-39b-07)

  const rows = await db
    .select({
      id: watchesCatalog.id,
      brand: watchesCatalog.brand,
      model: watchesCatalog.model,
      imageUrl: watchesCatalog.imageUrl,
      ownersCount: watchesCatalog.ownersCount,
    })
    .from(watchesCatalog)
    .where(
      and(
        eq(watchesCatalog.familyId, familyId),
        sql`${watchesCatalog.id} != ${catalogId}::uuid`,  // exclude self
      ),
    )
    .orderBy(
      desc(watchesCatalog.ownersCount),
      asc(watchesCatalog.brand),
      asc(watchesCatalog.model),
    )
    .limit(limit)

  return rows
}
```

**Trade-off note:** D-39b-15 wording suggests `COUNT(watches.catalog_id)` (live JOIN). The denormalized `owners_count` already pre-computes this via Phase 17's pg_cron daily refresh. For a 6-card rail, the freshness penalty is invisible (a brand-new owner won't appear for up to ~24h). The query is 10× simpler. **Recommendation: use `owners_count` denormalized column.** Planner to confirm during discuss-phase.

### Pattern 3: Lineage rail with image_url JOIN extension

**Existing CTE returns:** `id, brand, model, reference, predecessor_catalog_id, successor_catalog_id, relationship_type, depth, direction, is_cycle` (verified at `src/data/hierarchy.ts:27-38`).

**Extension required:** Add `wc.image_url` to both `SELECT` clauses inside the recursive CTE. Add `imageUrl: string | null` to `LineageRow` interface.

**Example diff:**

```diff
   id: string                            // walks_catalog.id of the related row
   brand: string                         // watches_catalog.brand
   model: string                         // watches_catalog.model
   reference: string | null              // watches_catalog.reference
+  imageUrl: string | null               // watches_catalog.image_url (NEW Phase 39b)
   predecessor_catalog_id: string
```

```diff
       SELECT
-        wc.id, wc.brand, wc.model, wc.reference,
+        wc.id, wc.brand, wc.model, wc.reference, wc.image_url,
         e.predecessor_catalog_id, e.successor_catalog_id,
         ...
```

Existing 3-node lineage unit test at `tests/static/hierarchy.lineage-3-node.test.ts` may need a minor update to assert the new `imageUrl` field.

### Pattern 4: Operator-curation idempotent backfill script

**What:** Service-role write to prod DB; safe to re-run after partial commits.

**When to use:** Wave 0 of Phase 39b — `scripts/seed-lineage.ts` writes `family_id` updates + `watch_lineage_edges` rows.

**Example (mirrors `scripts/backfill-catalog-brands.ts`):**

```typescript
// scripts/seed-lineage.ts
//
// Phase 39b Wave 0 — operator curation seed.
// Usage: npm run db:seed-lineage
// Prod usage: DATABASE_URL="<prod pooler URL>" npm run db:seed-lineage
//
// Idempotent (D-39b-20):
//   family_id pass: UPDATE ... WHERE family_id IS NULL (never overwrites)
//   lineage edge pass: INSERT ... ON CONFLICT (predecessor_catalog_id,
//     successor_catalog_id, relationship_type) DO NOTHING
//
// Footgun T-34-04 inherited: WITHOUT inline DATABASE_URL override, this script
// reads .env.local (LOCAL Docker DB) and silently writes to the wrong DB.
// See docs/deploy-db-setup.md §34.2 + §35.x precedent.

import { db } from '../src/db'
import { sql } from 'drizzle-orm'

// ----- OPERATOR-AUTHORED SEED DATA -----
// TODO: operator fills these arrays before running. Categories guide:
//   - Submariner family (Rolex 16610 / 116610LN / 124060 / Sea-Dweller chain)
//   - Speedmaster family (Omega Moonwatch chain — 145.022 / 3570.50 / 310.30.42.50.01.001)
//   - Royal Oak family (Audemars Piguet 15202ST / 15500ST / 15510ST)
//   - GMT family (Rolex GMT II 16710 / 116710 / 126710)
//   - Submariner homages (Tudor Black Bay, Squale, Christopher Ward C60, etc.)
//   - Speedy homages (Sinn 103, Steinhart Ocean One Vintage GMT, etc.)
// Each family entry: catalog_id (UUID) + family_id (UUID).
// Each lineage edge: predecessor_catalog_id + successor_catalog_id + relationship_type.
const FAMILY_ASSIGNMENTS: Array<{ catalogId: string; familyId: string; brand: string; model: string }> = [
  // { catalogId: 'uuid-of-rolex-16610', familyId: 'uuid-of-submariner-family', brand: 'Rolex', model: 'Submariner 16610' },
  // ... ~20 entries operator authors
]

const LINEAGE_EDGES: Array<{
  predecessorCatalogId: string
  successorCatalogId: string
  relationshipType: 'predecessor' | 'successor' | 'remake' | 'tribute' | 'homage'
  note?: string
}> = [
  // { predecessorCatalogId: '...', successorCatalogId: '...', relationshipType: 'successor', note: '16610 → 116610LN' },
  // ... ~15 entries operator authors
]

async function passA_assignFamilies(): Promise<{ patched: number; skipped: number }> {
  let patched = 0
  let skipped = 0
  for (const entry of FAMILY_ASSIGNMENTS) {
    const result = await db.execute<{ updated_id: string }>(sql`
      UPDATE watches_catalog
         SET family_id = ${entry.familyId}::uuid,
             updated_at = NOW()
       WHERE id = ${entry.catalogId}::uuid
         AND family_id IS NULL
       RETURNING id AS updated_id
    `)
    const updated = (result as unknown as Array<{ updated_id: string }>).length
    if (updated > 0) {
      patched += 1
      console.log(`[seed-lineage] family: ${entry.brand} ${entry.model} ✓`)
    } else {
      skipped += 1
      console.log(`[seed-lineage] family: ${entry.brand} ${entry.model} (already assigned or row missing)`)
    }
  }
  return { patched, skipped }
}

async function passB_insertLineageEdges(): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped = 0
  for (const edge of LINEAGE_EDGES) {
    const result = await db.execute<{ id: string }>(sql`
      INSERT INTO watch_lineage_edges (
        predecessor_catalog_id, successor_catalog_id, relationship_type
      )
      VALUES (
        ${edge.predecessorCatalogId}::uuid,
        ${edge.successorCatalogId}::uuid,
        ${edge.relationshipType}::lineage_relationship_type
      )
      ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type)
      DO NOTHING
      RETURNING id
    `)
    const insertedRows = (result as unknown as Array<{ id: string }>).length
    if (insertedRows > 0) {
      inserted += 1
      console.log(`[seed-lineage] edge: ${edge.predecessorCatalogId} -[${edge.relationshipType}]-> ${edge.successorCatalogId}${edge.note ? ` (${edge.note})` : ''}`)
    } else {
      skipped += 1
    }
  }
  return { inserted, skipped }
}

async function main() {
  const startedAt = Date.now()
  console.log(`[seed-lineage] starting — ${FAMILY_ASSIGNMENTS.length} family assignments + ${LINEAGE_EDGES.length} lineage edges`)
  const families = await passA_assignFamilies()
  const edges = await passB_insertLineageEdges()
  const elapsedMs = Date.now() - startedAt
  console.log(`[seed-lineage] OK — family_patched=${families.patched} family_skipped=${families.skipped} edges_inserted=${edges.inserted} edges_skipped=${edges.skipped} elapsedMs=${elapsedMs}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-lineage] fatal:', err)
  process.exit(1)
})
```

**package.json delta:**
```json
"db:seed-lineage": "tsx --env-file=.env.local scripts/seed-lineage.ts",
```

### Anti-Patterns to Avoid

- **DO NOT mark LockedTabCard as `'use client'`.** It can remain a Server Component while importing `FollowButton` (a client component). Adding `'use client'` would force the entire profile-tab branch into client-render, bloating the bundle and contradicting the established PopularCollectorRow precedent.
- **DO NOT call `getCurrentUser()` from inside an `'use cache'` scope.** Phase 18 D-11 lesson — cache key omits the viewer and leaks state across users. ReferenceIdentityCard renders are NOT cached (per-page); NSV-18 roster MIGHT be cached but its DAL takes `viewerId` as an explicit parameter for self-exclusion, so any cache key must include `viewerId`. Recommendation: do NOT add `'use cache'` to NSV-18 in 39b — page-level RSC re-render on every request is acceptable for a 5-row roster.
- **DO NOT hard-code AvatarDisplay `size=36` in NSV-18 chip row** — primitive only accepts 40/64/96. See Pitfall 1 below.
- **DO NOT skip the import-boundary static guard for ReferenceIdentityCard.** Mandated by UI-SPEC Test Coverage Contract. The card MUST NOT import `@/lib/similarity` or `@/lib/verdict/composer`.
- **DO NOT extend `getLineageForReference` to filter by `confidence` or other taste fields.** Lineage is a structural relation; confidence is a taste-attribute property. Mixing concerns adds a future refactor surface.
- **DO NOT pre-emptively add `/family/{familyId}` routing.** D-39b-05 lock + D-39b-17 explicit "See all in family" deferral. Leave a TODO comment in the rail header per UI-SPEC.
- **DO NOT skip the `watches.status` filter on NSV-18 if planner adopts the recommendation.** A `sold` row is past ownership; surfacing the previous owner under "X collectors own this" is misleading. Confirm during discuss-phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Avatar component | New `Avatar.tsx` with `size=36` prop | Use existing `AvatarDisplay` at `size=40`; OR extend primitive to accept `36` | Six other call-sites already use `AvatarDisplay` — don't fork. |
| Watch card body | New card for lineage rails | Reuse `DiscoveryWatchCard` (`src/components/explore/DiscoveryWatchCard.tsx`) | Same card shape as `/explore` rails — consistency win. |
| Open-redirect-safe regex | Inline regex check on the `/signin?returnTo=` link | Inline `encodeURIComponent(currentPath)` is sufficient at render time; the `validateReturnTo` helper validates on the receiving end | The Sign-in page should already enforce `validateReturnTo` (Phase 22/28 precedent). LockedTabCard just emits the URL. |
| Recursive CTE for lineage | New CTE | Extend `getLineageForReference` to include `image_url` | Existing CTE has cycle clause + depth-guard; don't reinvent. |
| Two-layer privacy helper | New `getViewableUserIds()` | Inline `eq(profileSettings.profilePublic, true)` + `eq(profileSettings.collectionPublic, true)` pattern | Six existing DALs use the inline pattern; a helper would add an abstraction layer without simplifying anything. |
| Day-cell click drill-down route | New `/wear/{eventId}/page.tsx` | Inline below-grid panel in `WornCalendar.tsx` | D-39b-13 lock: no new route. |
| Family page | New `/family/{familyId}/page.tsx` | Inline rails on existing pages | D-39b-05 lock. |
| Confidence gauge / numeric % | Progress bar / pie chart for confidence | Muted subtitle "Inferred taste signature" only | D-39b-02 lock: never display numeric %. |

**Key insight:** Every Phase 39b component except `ReferenceIdentityCard` and `scripts/seed-lineage.ts` is a patch to an existing file or a reuse of an existing component. The risk surface is small — keep it that way.

## Runtime State Inventory

**Trigger applies:** Wave 0 writes to prod DB (`watches_catalog.family_id` UPDATES + `watch_lineage_edges` INSERTS).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | (a) `watches_catalog.family_id` column — currently empty for ~all rows (Phase 34 ships schema only; Wave 0 begins populating). (b) `watch_lineage_edges` table — currently empty for ~all rows (Phase 35 ships schema only; Wave 0 begins populating). | Operator-authored data migration via `scripts/seed-lineage.ts`. Idempotent; safe to re-run after partial commits. |
| Live service config | None — no Datadog tags, Cloudflare Tunnel, or n8n workflows reference Phase 39b entities. | None — verified by grep across `.planning/` for service-config references. |
| OS-registered state | None — no Windows Task Scheduler, pm2, launchd, systemd unit references. | None — verified by grep. |
| Secrets / env vars | `DATABASE_URL` consumed by `scripts/seed-lineage.ts` via `--env-file=.env.local` OR inline override for prod. No new secret keys. | None — operator uses existing prod pooler URL (per Phase 34 / 35 / 36 / 37 deploy precedent in `docs/deploy-db-setup.md`). |
| Build artifacts / installed packages | None — no compiled binaries, no new npm packages installed. The `db:seed-lineage` script is a `tsx`-executed `.ts` file (no build step). | None. |

**Canonical question:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?* — **N/A**: Phase 39b adds NEW data (it does not rename or remove existing data). Idempotent re-runs are safe.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All scripts + dev server | ✓ (assumed — project already requires it) | (no `.nvmrc`; matches Next 16 minimum ~v18) | — |
| `tsx` | `scripts/seed-lineage.ts` execution | ✓ (transitively via existing `db:backfill-*` npm scripts) | (from existing scripts; verified at `package.json:9-19`) | — |
| Postgres 15+ | `CYCLE` clause in `getLineageForReference` (existing) + new aggregation queries | ✓ (Supabase prod runs ≥15; Phase 35 verified) | 15+ | — |
| Prod DB connection (session-mode pooler) | Wave 0 prod write | ✓ (operator-supplied per Phase 34 deploy precedent) | — | — |
| `docs/deploy-db-setup.md` (operator runbook) | Wave 0 operator handoff | ✓ already contains §34 / §35 / §36 / §37 sections; Wave 0 plan may append §39b section | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Common Pitfalls

### Pitfall 1: AvatarDisplay does not accept `size=36`

**What goes wrong:** UI-SPEC § "NSV-18 — Other-Owners Roster" specifies `size={36}` on `AvatarDisplay`. The component's TypeScript prop type is `size?: 40 | 64 | 96`. Passing `36` is a type error.

**Why it happens:** UI-SPEC author probably aimed for a "compact roster" feel; the existing primitive supports three sizes only.

**How to avoid:**
- **Recommended:** substitute `size={40}` in the NSV-18 chip row. `w-16` chip width still accommodates 40px avatar with a 12px label below it. Zero primitive changes.
- **Alternative:** extend `AvatarDisplay` to accept `size = 36 | 40 | 64 | 96` (add `dimensionClass = size === 36 ? 'size-9' : ...` branch). Adds a 4th supported size to the primitive used in 6+ places.

**Warning signs:** TypeScript compile error in the new chip row code. Catch at plan-check via `tsc`.

### Pitfall 2: WornCalendar `WearEventLite` omits `note` field

**What goes wrong:** D-39b-13 wear-detail panel requires `event.notes` (or `event.note`) for display. The existing `WearEventLite` interface inside `WornCalendar.tsx:16-20` is:
```typescript
interface WearEventLite {
  id: string
  watchId: string
  wornDate: string // YYYY-MM-DD
}
```
No `note` field.

**Why it happens:** Phase 12 split the calendar from the timeline; the calendar didn't need notes at that time.

**How to avoid:** Extend the interface in the patch to:
```typescript
interface WearEventLite {
  id: string
  watchId: string
  wornDate: string
  note: string | null    // NEW
}
```
The parent already passes `note` from `WornTabContent` (`src/app/u/[username]/[tab]/page.tsx:255-260`). No upstream change needed.

**Warning signs:** Wear-detail panel `event.note` reference fails type-check. Caught at `tsc`.

### Pitfall 3: NSV-18 query MUST handle multiple rows per user (same catalog_id)

**What goes wrong:** A collector can own a watch with `status='owned'` AND have a separate `status='wishlist'` row for the same catalog_id. A naive `SELECT DISTINCT profile_id` plus `ORDER BY watches.created_at DESC` deduplicates wrong — the resulting `created_at` for a single user could be either row's timestamp, breaking the ranking.

**Why it happens:** `watches` is the user's per-row table; multiple rows can map to the same `catalog_id` if a user has both wishlist and owned entries.

**How to avoid:** Use Postgres `DISTINCT ON (profile_id)` ordered by `created_at DESC` OR (simpler for Drizzle) overfetch + deduplicate in JS:
- Query `LIMIT 50` (overfetch).
- ORDER BY `watches.created_at DESC, profiles.username ASC`.
- In JS, walk the rows, keep first occurrence of each `profile_id`, collect up to `limit` distinct collectors.
- See the Pattern 1 example code above.

**Warning signs:** Duplicate avatars in the chip row. Visible to operator UAT.

### Pitfall 4: NSV-18 `totalCount` cannot be derived from `rows.length`

**What goes wrong:** "X collectors own this" copy displays the **total distinct collector count** (not "rows returned"). If you derive `totalCount` from `rows.length` capped at 50, the label is wrong for any catalog with > 50 collectors.

**Why it happens:** The DAL function returns at-most-N rows (5 for display). The label needs a `SELECT count(DISTINCT user_id)` over the same WHERE clause without LIMIT.

**How to avoid:** Issue a SECOND query for `count(DISTINCT)`. Pattern 1 example above shows the two-query shape. The performance cost is negligible (single COUNT scan).

**Warning signs:** Label "5 collectors own this" appears when 200 own it. Caught only by manual UAT or a fixture test that seeds > 5 distinct collectors.

### Pitfall 5: Recursive CTE extension — both seed AND recursive arm need `wc.image_url`

**What goes wrong:** Extending `getLineageForReference` to surface `image_url`, you patch the seed arm but forget the recursive arm. Result: depth=1 rows have `imageUrl`, depth=2+ rows have NULL.

**Why it happens:** The CTE has two `SELECT` blocks separated by `UNION ALL`. Both must carry the same column set.

**How to avoid:** Patch BOTH `SELECT` clauses (seed + recursive arm). Add `image_url` to the CTE column declaration parenthesized list at the top too. See `src/data/hierarchy.ts:42-46`. The outer `SELECT … FROM lineage` also must select the new column.

**Warning signs:** Some lineage cards have images, others don't. Trace through the depth dimension to spot the asymmetry.

### Pitfall 6: ON CONFLICT clause spec on `watch_lineage_edges`

**What goes wrong:** D-39b-20 specifies `ON CONFLICT (predecessor_catalog_id, successor_catalog_id, relationship_type) DO NOTHING`. The actual unique constraint on the table is `lineage_edges_unique_triple` over these three columns — verified at `src/db/schema.ts:471-475`. ON CONFLICT with column list works only if there's a matching unique constraint or index.

**Why it happens:** Postgres requires the ON CONFLICT target column list to match exactly a unique constraint or unique index.

**How to avoid:** The constraint already exists (Phase 35 Plan 05 shipped it). The Wave 0 script just uses the three columns directly. Verified safe.

**Warning signs:** `ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification`. If hit, switch to `ON CONFLICT ON CONSTRAINT lineage_edges_unique_triple DO NOTHING`.

### Pitfall 7: Wave 0 prod-DB write footgun (T-34-04 inheritance)

**What goes wrong:** Operator runs `npm run db:seed-lineage` from a fresh shell. The script reads `.env.local` (local Docker DB). Operator believes they wrote to prod. Local data divergence.

**Why it happens:** package.json npm script hardcodes `--env-file=.env.local`. Without an inline `DATABASE_URL=...` override BEFORE the npm command, the local env wins.

**How to avoid:**
- Wave 0 plan AC includes the explicit prod command in the operator runbook:
  ```bash
  DATABASE_URL="<prod session-mode pooler URL>" npm run db:seed-lineage
  ```
- `docs/deploy-db-setup.md` Phase 39b section (operator runbook) MUST repeat this verbatim.
- Cross-reference `docs/deploy-db-setup.md` §34.2 T-34-04 / §17.2 T-17-BACKFILL-PROD-DB precedent.

**Warning signs:** Operator reports "I ran the script but the prod /catalog/{id} doesn't show any rails." Diagnosis: ran against local. Recovery: re-run with prod URL.

### Pitfall 8: Server / Client component import boundary on FollowButton inside LockedTabCard

**What goes wrong:** Patching LockedTabCard to import FollowButton triggers a "client component imported into server component without serialization" build-time error.

**Why it happens:** Misreading the Next 16 server-client boundary. The correct rule (per `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` § "Interleaving Server and Client Components"): a Server Component MAY import and render a Client Component. The client component hydrates on the browser; the server component does not become client.

**How to avoid:**
- LockedTabCard stays a Server Component (no `'use client'`).
- Import `FollowButton` like any other import.
- Pass viewerId, targetUserId, targetDisplayName, initialIsFollowing, variant as props (all serializable).
- Compare to `PopularCollectorRow.tsx` for the exact precedent.

**Warning signs:** Build error at deploy time. The Phase 39b plan checker should run `next build` (or at minimum `tsc`) before merging.

### Pitfall 9: ReferenceIdentityCard data source on `/catalog/{id}` is `catalogEntry`, not `watch.catalogTaste`

**What goes wrong:** Author patches `/catalog/{catalogId}/page.tsx` to read `catalogEntry.catalogTaste`. Field does not exist. The fields live directly on `CatalogEntry`: `catalogEntry.formality`, `catalogEntry.sportiness`, `catalogEntry.heritageScore`, `catalogEntry.primaryArchetype`, `catalogEntry.eraSignal`, `catalogEntry.designMotifs`, `catalogEntry.confidence`, `catalogEntry.extractedFromPhoto`.

**Why it happens:** Phase 38 D-10 added `Watch.catalogTaste` as a nested object on the per-user Watch type. `CatalogEntry` predates Phase 38 and surfaces the taste fields at the top level (Phase 19.1 D-01).

**How to avoid:** ReferenceIdentityCard component accepts `taste: CatalogTasteAttributes | null` as a prop (or accept the individual fields). The two callsites construct the prop differently:
- `/watch/{id}` callsite: `<ReferenceIdentityCard taste={watch.catalogTaste ?? null} />`
- `/catalog/{id}` callsite: `<ReferenceIdentityCard taste={{ formality: catalogEntry.formality, sportiness: catalogEntry.sportiness, heritageScore: catalogEntry.heritageScore, primaryArchetype: catalogEntry.primaryArchetype, eraSignal: catalogEntry.eraSignal, designMotifs: catalogEntry.designMotifs, confidence: catalogEntry.confidence, extractedFromPhoto: catalogEntry.extractedFromPhoto }} />` OR add a thin adapter `catalogEntryToTaste(entry): CatalogTasteAttributes`.

**Warning signs:** Runtime undefined errors on the catalog page; ReferenceIdentityCard renders empty bars.

### Pitfall 10: `numeric` Postgres type returns string in postgres-js client

**What goes wrong:** `formality`, `sportiness`, `heritageScore`, `confidence` are Postgres `numeric(3, 2)` (verified at `src/db/schema.ts:384-390`). The postgres-js driver returns `numeric` as STRING by default. ReferenceIdentityCard scale bars do `value * 100` math — string × number returns NaN.

**Why it happens:** Postgres `numeric` is arbitrary-precision; the JS driver preserves precision by stringifying.

**How to avoid:** Already handled — `src/data/catalog.ts:77-83` maps via `row.formality !== null ? Number(row.formality) : null`. So `CatalogEntry` already exposes numbers, not strings.

For the per-user `Watch.catalogTaste` (Phase 38 D-10 LEFT JOIN), confirm the equivalent `Number()` cast lives in `getWatchesByUser`. If not, ReferenceIdentityCard receives strings and rendering breaks.

**Warning signs:** Scale bars render with `width: NaN%` or `width: '0.501'%` (string interpolated into CSS).

**Verification step for the planner:** grep `getWatchesByUser` in `src/data/watches.ts` for a `Number(...)` cast on the taste fields.

## Code Examples

### Example 1: ReferenceIdentityCard skeleton (server component, no engine imports)

```typescript
// Source: Phase 39b UI-SPEC § ReferenceIdentityCard — Design Specification
// File: src/components/insights/ReferenceIdentityCard.tsx

import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CatalogTasteAttributes } from '@/lib/types'

interface ReferenceIdentityCardProps {
  taste: CatalogTasteAttributes | null
}

// D-39b-03 confidence gate — caller is responsible for not mounting below 0.5,
// but defense-in-depth here too. Returns null if gate fails.
export function ReferenceIdentityCard({ taste }: ReferenceIdentityCardProps) {
  if (!taste || taste.confidence === null || taste.confidence < 0.5) {
    return null
  }

  const eraLabel = taste.eraSignal ? ERA_LABELS[taste.eraSignal] : null
  const archetypeLabel = taste.primaryArchetype ? ARCHETYPE_LABELS[taste.primaryArchetype] : null
  const showHeadline = eraLabel || archetypeLabel
  const showMotifs = taste.designMotifs.length > 0
  const showScales =
    taste.formality !== null || taste.sportiness !== null || taste.heritageScore !== null

  return (
    <Card>
      <CardHeader>
        <CardDescription>Inferred taste signature</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showHeadline && (
          <p className="text-base font-medium text-foreground">
            {eraLabel && <span className="truncate">{eraLabel}</span>}
            {eraLabel && archetypeLabel && <span> · </span>}
            {archetypeLabel && <span className="truncate">{archetypeLabel}</span>}
          </p>
        )}
        {showScales && (
          <div className="space-y-2">
            {taste.formality !== null && (
              <ScaleBar label="Formality" value={taste.formality} />
            )}
            {taste.sportiness !== null && (
              <ScaleBar label="Sportiness" value={taste.sportiness} />
            )}
            {taste.heritageScore !== null && (
              <ScaleBar label="Heritage" value={taste.heritageScore} />
            )}
          </div>
        )}
        {showMotifs && (
          <div className="flex flex-wrap gap-1">
            {taste.designMotifs.map((m) => (
              <Badge key={m} variant="outline">{m}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ScaleBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div
        className="relative h-1.5 rounded-full bg-muted overflow-hidden"
        role="img"
        aria-label={`${label}: ${pct} out of 100`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-foreground/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground/60">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  )
}

const ERA_LABELS: Record<NonNullable<CatalogTasteAttributes['eraSignal']>, string> = {
  'vintage-leaning': 'Vintage-leaning',
  'modern': 'Modern era',
  'contemporary': 'Contemporary',
}

const ARCHETYPE_LABELS: Record<NonNullable<CatalogTasteAttributes['primaryArchetype']>, string> = {
  dress: 'Dress', dive: 'Dive', field: 'Field', pilot: 'Pilot',
  chrono: 'Chronograph', gmt: 'GMT', racing: 'Racing', sport: 'Sport',
  tool: 'Tool', hybrid: 'Hybrid',
}
```

### Example 2: ReferenceIdentityCard import-boundary static guard

```typescript
// Source: tests/static/CollectionFitCard.no-engine.test.ts (pattern verbatim)
// File: tests/static/ReferenceIdentityCard.no-engine.test.ts

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

describe('Phase 39b D-39b-01 — <ReferenceIdentityCard> pure-renderer invariant', () => {
  const cardPath = 'src/components/insights/ReferenceIdentityCard.tsx'

  it('does not import @/lib/similarity', () => {
    if (!existsSync(cardPath)) return  // vacuous pass before component lands
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]@\/lib\/similarity['"]/)
    expect(src).not.toMatch(/analyzeSimilarity\s*\(/)
  })

  it('does not import @/lib/verdict/composer', () => {
    if (!existsSync(cardPath)) return
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]@\/lib\/verdict\/composer['"]/)
    expect(src).not.toMatch(/composeVerdictCopy\s*\(/)
    expect(src).not.toMatch(/computeVerdictBundle\s*\(/)
  })

  it('does not import server-only modules into the client bundle', () => {
    if (!existsSync(cardPath)) return
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]server-only['"]/)
    expect(src).not.toMatch(/from ['"]@\/lib\/verdict\/viewerTasteProfile['"]/)
  })

  it('is a server component (no use client directive)', () => {
    if (!existsSync(cardPath)) return
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/^['"]use client['"]/m)
  })
})
```

### Example 3: NSV-18 chip row render (inline in `/catalog/{catalogId}/page.tsx`)

```typescript
// Source: 39b-UI-SPEC.md § "NSV-18 — Other-Owners Roster"
// Inline section in src/app/catalog/[catalogId]/page.tsx

import Link from 'next/link'
import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { getCollectorsForCatalog } from '@/data/discovery'  // or src/data/collectors.ts

// inside CatalogPage function, AFTER getCatalogById notFound check, BEFORE
// the existing CollectionFitCard + CatalogPageActions block:
const { collectors, totalCount } = await getCollectorsForCatalog(catalogId, user.id, { limit: 5 })

// ...

{collectors.length > 0 && (
  <section className="space-y-2">
    {totalCount > 5 && (
      <p className="text-sm text-muted-foreground">{totalCount} collectors own this</p>
    )}
    <div className="flex gap-2 overflow-x-auto scroll-smooth pb-1">
      {collectors.map((c) => {
        const name = c.displayName ?? `@${c.username}`
        return (
          <div key={c.userId} className="group relative flex flex-col items-center gap-2 w-16 shrink-0">
            <Link
              href={`/u/${c.username}/collection`}
              aria-label={`${name}'s collection`}
              className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <AvatarDisplay
              avatarUrl={c.avatarUrl}
              displayName={c.displayName}
              username={c.username}
              size={40}  // NOTE: UI-SPEC says 36 but primitive only supports 40/64/96
            />
            <p className="text-xs text-muted-foreground truncate w-full text-center">
              @{c.username}
            </p>
          </div>
        )
      })}
    </div>
  </section>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages router (`pages/api/*`) | App Router (`src/app/.../page.tsx`) | Next 13+; project on Next 16.2.3 | Server Components by default; `'use client'` directive only when state/hooks needed. |
| `pages/_app.tsx` global error handlers | `error.tsx` / `not-found.tsx` route conventions | Next 13+ | Phase 39b doesn't add new error boundaries — uses existing `notFound()` pattern. |
| Verdict card rendered on every viewer state | Phase 38 D-10 LEFT JOIN — taste attached to per-user Watch | Phase 38 (shipped 2026-05-12) | ReferenceIdentityCard reads `watch.catalogTaste` directly; no separate DAL call. |
| Single-file route (`pages/family/[familyId].tsx`) | Inline rails on existing pages | D-39b-05 lock | Saves route file + reduces URL surface; consistent with the SEED-008 v5.1 Browse the Catalog absorb. |
| `Number(numeric)` conversion at the consumer | `Number(...)` cast in DAL mapper | Phase 19.1 D-01 | `CatalogEntry` already returns numbers; ReferenceIdentityCard receives numbers. Confirm same for `Watch.catalogTaste`. |
| Server / Client opaque boundary | Server-may-import-client (Next 13+) | (project standard since v2.0) | LockedTabCard stays RSC while embedding the FollowButton client island. |

**Deprecated / outdated:**
- ❌ `analyzeSimilarity` import from a card component (Phase 20 D-04 lock; enforced by `tests/static/CollectionFitCard.no-engine.test.ts`).
- ❌ Free-text `movement` column (Phase 35 D-03 replaced with `movement_type` enum + `movement_caliber` text).
- ❌ "Connect" affordance terminology — D-39b-12 uses "Follow", matching the existing FollowButton.

## Validation Architecture

**Test Framework**

| Property | Value |
|----------|-------|
| Framework | `vitest` ^2.1.9 + `@testing-library/react` ^16.3.2 + `jsdom` (`environment: 'jsdom'`) |
| Config file | `vitest.config.ts` (verified at repo root) |
| Quick run command | `npx vitest run tests/static/ReferenceIdentityCard.no-engine.test.ts` |
| Full suite command | `npm test` (alias for `vitest run`) |

**Phase Requirements → Test Map**

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NSV-06 | ReferenceIdentityCard renders on `/watch/{id}` when collection empty + confidence ≥ 0.5 | Component / integration | `npx vitest run tests/components/insights/ReferenceIdentityCard.test.tsx -x` | ❌ Wave 0 (new file) |
| NSV-06 | ReferenceIdentityCard suppressed when `catalogTaste === null OR confidence < 0.5` | Component | (same file) | ❌ Wave 0 |
| NSV-06 / D-39b-01 | ReferenceIdentityCard has no engine / composer imports | Static guard | `npx vitest run tests/static/ReferenceIdentityCard.no-engine.test.ts -x` | ❌ Wave 0 (mandated by UI-SPEC) |
| NSV-20 | ReferenceIdentityCard renders identically on `/catalog/{id}` | Integration | `npx vitest run tests/app/catalog-page.test.ts` (extend existing) | ✅ exists |
| NSV-14 (LockedTabCard) | FollowButton renders for logged-in viewer when not following | Component | `npx vitest run tests/components/profile/LockedTabCard.test.tsx` | ❌ Wave 0 |
| NSV-14 (LockedTabCard) | Sign-in Link renders for unauthenticated viewer | Component | (same file) | ❌ Wave 0 |
| NSV-14 (LockedTabCard) | `tab === 'common-ground'` returns null unchanged | Component | (same file) | ❌ Wave 0 — covers Phase 39 D-09 regression guard |
| NSV-14 (WornCalendar) | `selectedDate` initializes to first day with events on mount | Component | `npx vitest run tests/components/profile/WornCalendar.test.tsx` | ❌ Wave 0 |
| NSV-14 (WornCalendar) | Empty-day selection renders "No wear events on {date}." caption | Component | (same file) | ❌ Wave 0 |
| NSV-14 (WornCalendar) | Day cell with events sets `selectedDate` on click | Component | (same file) | ❌ Wave 0 |
| NSV-14 (StatsTabContent) | Each WornList `<li>` wraps in `<Link href="/watch/{id}">` | Component | `npx vitest run tests/components/profile/StatsTabContent.test.tsx` (existing? verify) | (check) |
| NSV-18 | `getCollectorsForCatalog` two-layer privacy gate excludes private-profile users | Integration / DAL | `npx vitest run tests/data/collectors.test.ts` | ❌ Wave 0 |
| NSV-18 | `getCollectorsForCatalog` excludes viewer self | Integration / DAL | (same file) | ❌ Wave 0 |
| NSV-18 | `totalCount` accurate when distinct collectors exceed 50 (overfetch boundary) | Integration / DAL | (same file) | ❌ Wave 0 |
| NSV-18 | Roster section hidden when `collectors.length === 0` | Integration | `npx vitest run tests/app/catalog-page.test.ts` (extend existing) | ✅ exists |
| NSV-02+16 | `getSameFamilyForCatalog` returns siblings, excludes self, ordered by ownersCount DESC | DAL | `npx vitest run tests/data/hierarchy.test.ts` (new or extend hierarchy.lineage-3-node) | (check) |
| NSV-02+16 | `getLineageForReference` returns `imageUrl` field after extension | DAL | `npx vitest run tests/static/hierarchy.lineage-3-node.test.ts` (existing) | ✅ exists (update needed) |
| NSV-02+16 | Same-family rail hides when family_id missing | Integration | `npx vitest run tests/app/watch-page-verdict.test.ts` (extend) OR new `tests/app/lineage-rails.test.ts` | (check) |
| NSV-02+16 | Lineage rail hides when 0 edges | Integration | (same) | ❌ |
| Wave 0 | `scripts/seed-lineage.ts` idempotent — second run = no-ops | Manual smoke (operator) | `npm run db:seed-lineage` (twice, against local) — verify second run prints `family_skipped=N` `edges_skipped=N` | (operator UAT) |

**Sampling rate:**
- **Per task commit:** `npx vitest run tests/static/ReferenceIdentityCard.no-engine.test.ts tests/components/profile/LockedTabCard.test.tsx tests/components/profile/WornCalendar.test.tsx tests/data/collectors.test.ts` — ~1.5s wall time, fast enough for every commit
- **Per wave merge:** `npm test` (full suite — ~10-20s)
- **Phase gate:** Full suite green before `/gsd-verify-work`; plus operator UAT on `/watch/{id}` + `/catalog/{id}` + `/u/{user}/{tab}` against prod after Wave 0 ships.

**Wave 0 Gaps (new test files needed):**
- [ ] `tests/static/ReferenceIdentityCard.no-engine.test.ts` — mandated by UI-SPEC; covers D-39b-01 import-boundary
- [ ] `tests/components/insights/ReferenceIdentityCard.test.tsx` — covers confidence gate + suppression rule
- [ ] `tests/components/profile/LockedTabCard.test.tsx` — covers logged-in / unauthenticated / common-ground branches
- [ ] `tests/components/profile/WornCalendar.test.tsx` (extend if exists, else create) — selectedDate init + empty-day caption
- [ ] `tests/data/collectors.test.ts` (or extend `tests/data/discovery.test.ts`) — NSV-18 DAL privacy gate + de-duplication + totalCount
- [ ] `tests/data/hierarchy.test.ts` (extend `hierarchy.lineage-3-node.test.ts`) — NSV-02+16 getSameFamilyForCatalog + imageUrl extension on getLineageForReference
- [ ] `tests/app/lineage-rails.test.ts` (new) OR extend `watch-page-verdict.test.ts` / `catalog-page.test.ts` — rail mount + hide-if-empty integration

**Property invariants (must hold after Wave 0 + Wave 1 ship):**
- **Invariant 1 (confidence gate):** No `ReferenceIdentityCard` ever renders when `catalogTaste.confidence < 0.5`. Hold across both `/watch/{id}` and `/catalog/{id}`.
- **Invariant 2 (hide-if-empty rails):** Both Same-family + Lineage rails return `null` (DOM-absent) when their query returns 0 rows. No empty-state Card.
- **Invariant 3 (two-layer privacy on NSV-18):** No collector in the roster has `profilePublic = false` OR `collectionPublic = false`. No collector in the roster is the viewer.
- **Invariant 4 (self-exclusion):** `viewer.id` never appears in NSV-18 chip row (the viewer cannot "discover themselves").
- **Invariant 5 (engine-isolation):** `ReferenceIdentityCard.tsx` never imports `@/lib/similarity` or `@/lib/verdict/composer`. Phase 20 D-04 carries forward verbatim.
- **Invariant 6 (Wave 0 idempotency):** Re-running `npm run db:seed-lineage` after a successful run produces `family_patched=0 family_skipped=N edges_inserted=0 edges_skipped=N`.

**Minimum reference dataset for Phase 39b validation:**
- 1 brand row (`brands` table)
- 1 watch_family row linking to that brand
- 3 watches_catalog rows: rowA (input ref), rowB (same family sibling), rowC (lineage successor of rowA)
- 1 watch_lineage_edge row: `(predecessor=rowA, successor=rowC, relationship_type='successor')`
- 3 user profiles: viewer, ownerA (public profile + public collection), ownerB (private profile)
- watches rows: ownerA owns rowA + rowB; ownerB owns rowA. After privacy filter, NSV-18 returns ownerA only.
- 1 catalogTaste row on rowA with `confidence = 0.7` (above gate) + all 6 fields populated.
- Optional second catalogTaste row on rowB with `confidence = 0.3` (below gate; verifies the suppression rule).

This dataset proves all 6 success criteria:
- SC#1 (every plan cites NSV-NN) — verified by plan-frontmatter inspection at plan-check time
- SC#2 (ReferenceIdentityCard renders identically on both pages, suppresses below threshold) — Invariant 1 + dataset's rowA (above) + rowB (below)
- SC#3 (NSV-14 affordances reachable) — component tests on each sub-cell
- SC#4 (NSV-18 two-layer privacy verified by integration test) — Invariant 3 + ownerA visible / ownerB hidden / viewer-self excluded
- SC#5 (NSV-02+16 rails render when data exists, hide when absent) — Invariant 2 + dataset's rowB (same family) + edge (lineage)
- SC#6 (zero remaining Phase 33b Q3 high-leverage rows unaddressed) — verified by Wave 1 closure of NSV-06/14/18/20/02/16 (Phase 39 closed NSV-01/15/08/12 already)

## Security Domain

**security_enforcement is enabled (config.json absence = default-on).**

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Supabase Auth + `getCurrentUser()` in page server components. Phase 39b adds NO new auth surface. |
| V3 Session Management | yes (transitive) | Existing session via `@supabase/ssr` cookies. Phase 39b adds NO new session logic. |
| V4 Access Control | **YES — load-bearing** | NSV-18 catalog roster MUST gate `profile_public = true` AND `collection_public = true` AND `profiles.id != viewerId` at the DAL WHERE level. Mirrors Phase 18 D-09 / Phase 19 SRCH-12 / Phase 38 patterns. |
| V5 Input Validation | yes | `catalogId` UUID regex check already exists at `/catalog/{catalogId}/page.tsx:46-48`. Phase 39b adds NO new user input paths (no forms; the seed script is operator-only). |
| V6 Cryptography | no | No new crypto. |
| V7 Error Handling | yes | Wave 0 script logs structured errors via `console.error`; `process.exit(1)` on failure. Aligns with existing backfill scripts. |
| V13 API & Web Service | yes (transitive) | No new API routes. NSV-18 / lineage data flows through Server Components, not exposed endpoints. |

### Known Threat Patterns for Phase 39b stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Information disclosure: private collector surfaces in NSV-18 roster | Information Disclosure | Two-layer privacy gate at DAL (Pattern 1 above). RLS on `watches` + `profiles` is the second layer; the postgres-role connection bypasses RLS so DAL WHERE is load-bearing. |
| Self-exposure (viewer sees themselves in cross-user list) | Information Disclosure (low) | `sql\`${profiles.id} != ${viewerId}\`` predicate; matches Phase 16 `searchProfiles` precedent. |
| SQL injection via catalogId in `getCollectorsForCatalog` | Tampering | Drizzle ORM parameterizes all values; UUID regex check upstream rejects malformed input before the DAL is reached. |
| Open redirect via `?returnTo=` in LockedTabCard sign-in link | Tampering | The sign-in CTA emits `encodeURIComponent(currentPath)` at render time; the receiving `/signin` page enforces `validateReturnTo` (Phase 28 D-11). LockedTabCard MUST use a same-origin pathname (no absolute URL construction). |
| Service-role-bypass-via-seed-script | Elevation of Privilege | `scripts/seed-lineage.ts` uses the existing `@/db` postgres client which authenticates via service-role connection string. Operator MUST supply `DATABASE_URL` (Pitfall 7 above); the script does not embed creds. |
| Data exfiltration via NSV-18 over-fetch (returning too many rows) | Information Disclosure (low) | Hard LIMIT 50 in DAL; JS slice to top-N after de-dup. No unbounded queries. |
| XSS via collector username / displayName in roster | Cross-site scripting | React auto-escapes; no `dangerouslySetInnerHTML`; usernames are reads from `profiles.username` (validated at signup). |
| Cycle / depth-overrun in lineage rail | Denial of Service | Existing `getLineageForReference` carries Postgres 15 `CYCLE` clause + `depth < 10` guard. No new exposure. |

**Threat-register mapping (Phase 39b):**
- **T-39b-01 (Information Disclosure):** NSV-18 leaks private collector — mitigated by two-layer privacy gate + self-exclusion clause in DAL. Integration test required.
- **T-39b-02 (Information Disclosure):** Wave 0 seed script writes wrong DB (T-34-04 inheritance) — mitigated by operator runbook + explicit prod URL override + idempotency.
- **T-39b-03 (Tampering):** Open redirect via sign-in CTA returnTo — mitigated by encodeURIComponent on the producer + validateReturnTo on the consumer.
- **T-39b-04 (Information Disclosure low):** Roster reveals viewer self — mitigated by `profiles.id != viewerId` SQL predicate.
- **T-39b-05 (Information Disclosure low):** Lineage edge leak (operator inserts edge for a non-public catalog ref) — N/A: catalog refs are all public (no per-row privacy on `watches_catalog`).

## Assumptions Log

> Claims tagged `[ASSUMED]` need user confirmation before becoming locked decisions.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | NSV-18 query should filter `watches.status IN ('owned', 'wishlist', 'grail')` to exclude divested rows (Pitfall 5 / Pattern 1 caveat). [ASSUMED] | Pattern 1 | If wrong: roster shows past owners as if they currently own. Visible in chip count vs reality. **Defensible default per "X collectors own this" copy semantics. Operator can confirm in discuss-phase.** |
| A2 | Same-family rail uses denormalized `watches_catalog.owners_count` (pg_cron-refreshed daily) instead of a live `COUNT(watches.catalog_id)` JOIN. [ASSUMED] — D-39b-15 phrasing implies live count; the denormalized column is equivalent within ~24h freshness. | Pattern 2 | If wrong: a new-collector ranking adjustment is delayed up to 24h. For 6-card rail this is invisible. **Recommend: confirm in discuss-phase or accept the trade-off explicitly.** |
| A3 | `getWatchesByUser` casts `numeric` taste fields to `Number()` (matches `getCatalogById` mapper). [ASSUMED] — not verified in this research session. | Pitfall 10 | If wrong: scale bars render NaN%. **Planner verification step: grep `getWatchesByUser` in `src/data/watches.ts` for the `Number(...)` cast on `formality`, `sportiness`, `heritageScore`, `confidence`.** |
| A4 | `AvatarDisplay size=40` is the right substitution for UI-SPEC's `size=36`. [ASSUMED] — Pitfall 1 lays out both options; Phase 39b discuss-phase or plan-check can choose. | Pitfall 1 | If wrong: minor visual mismatch with UI-SPEC. Easily reversed. |
| A5 | LockedTabCard's existing `flex flex-col items-center justify-center` container will accommodate the inline FollowButton + caption with `gap-3` added to the section element. [VERIFIED via UI-SPEC § Sub-cell #1] | UI-SPEC | If wrong: visual layout drift; UI-SPEC 6/6 checker already approved this layout. |
| A6 | The recommendation to place `getCollectorsForCatalog` in `src/data/discovery.ts` (alongside `getMostFollowedCollectors`) is correct. [ASSUMED] — alternatively could go in a new `src/data/collectors.ts` (cleaner separation of concerns). | Recommendation | If wrong: minor file-organization rework; not load-bearing. |
| A7 | Operator's family-category guidance in `scripts/seed-lineage.ts` TODO block uses the categories from Phase 39b CONTEXT.md § Specifics (Submariner / Speedmaster / Royal Oak / Sub homages / Speedy chain). [VERIFIED via 39b-CONTEXT.md line 188] | Pattern 4 | Operator can extend the list; the script structure is operator-flexible. |

**If this table appears with assumptions:** Surface during `/gsd-discuss-phase` if any decision needs locking before plan execution. Most assumptions (A1, A2, A3) are low-risk and resolvable at plan-check or runtime; A1 is the only one that affects visible product behavior.

## Open Questions (RESOLVED)

1. **NSV-18: include or exclude `watches.status = 'sold'` rows?** (assumption A1)
   - What we know: D-39b-09 says "collectors **own** this." D-39b-10 says ranking by `created_at DESC`.
   - What's unclear: Does "own" include past ownership (sold)?
   - RESOLVED: Filter `status IN ('owned', 'wishlist', 'grail')` to exclude `sold`. Confirm in discuss-phase or accept as the inferred default.

2. **Same-family ranking: denormalized `owners_count` or live COUNT JOIN?** (assumption A2)
   - What we know: D-39b-15 phrasing implies a live COUNT subquery.
   - What's unclear: Whether the ~24h staleness of `owners_count` is acceptable.
   - RESOLVED: Use `owners_count` for simplicity; document the trade-off explicitly in the plan SUMMARY.

3. **Where does `getCollectorsForCatalog` live?** (assumption A6)
   - What we know: `getMostFollowedCollectors` lives in `src/data/discovery.ts`; `getLineageForReference` lives in `src/data/hierarchy.ts`; `getCatalogById` lives in `src/data/catalog.ts`.
   - What's unclear: Whether to extend `discovery.ts` or create new `src/data/collectors.ts`.
   - RESOLVED: extend `src/data/discovery.ts`. Lower file-count churn; co-located with the closest sibling function.

4. **AvatarDisplay size — extend primitive or substitute 40?** (assumption A4)
   - What we know: Primitive supports 40/64/96. UI-SPEC asks for 36 in chip row.
   - What's unclear: Whether to extend the primitive or substitute.
   - RESOLVED: Substitute size=40 for v1 ship; document the deviation in plan SUMMARY. If real-world chip row feels too large, extend primitive in a follow-up patch.

5. **`getWatchesByUser` numeric-cast verification.** (assumption A3 — verification step)
   - What we know: `getCatalogById` does `Number(row.formality)` etc.
   - What's unclear: Whether `getWatchesByUser` does the same for the LEFT-JOINed taste fields.
   - RESOLVED: Wave 0 plan AC includes a grep + visual confirmation; if missing, add the cast as a no-op patch.

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` — Server / Client component interleaving rules (Next 16.2.3 in repo)
- `src/data/hierarchy.ts:1-107` — existing `getLineageForReference` implementation with cycle clause + depth guard
- `src/data/discovery.ts:50-121` — canonical two-layer privacy pattern for cross-user aggregation (`getMostFollowedCollectors`)
- `src/data/search.ts:60-93` — search-profiles two-layer privacy + viewer self-exclusion canonical pattern
- `src/data/catalog.ts:51-88` — `mapRowToCatalogEntry` numeric cast pattern (`row.formality !== null ? Number(row.formality) : null`)
- `src/db/schema.ts:331-477` — schema definitions for `watchesCatalog` (taste fields, `familyId` FK), `watchLineageEdges` (unique constraint at line 471), `watchFamilies`, `brands`
- `src/components/profile/LockedTabCard.tsx:1-54` — Phase 39b patch site, current 53 lines
- `src/components/profile/WornCalendar.tsx:1-181` — Phase 39b patch site, current 181 lines
- `src/components/profile/StatsTabContent.tsx:50-86` — Phase 39b patch site, WornList interior
- `src/components/profile/FollowButton.tsx:107-123` — `variant="inline"` styling confirmation
- `src/components/explore/PopularCollectorRow.tsx:1-72` — Server-imports-Client precedent (canonical)
- `src/components/explore/DiscoveryWatchCard.tsx:1-52` — reusable rail card (sublabel accepts ReactNode)
- `src/components/insights/CollectionFitCard.tsx:1-100` — sibling component pattern for ReferenceIdentityCard
- `src/lib/types.ts:217-237` — `CatalogTasteAttributes`, `PrimaryArchetype`, `EraSignal` types
- `src/lib/taste/vocab.ts:16-41` — closed vocab for archetype / era / motifs
- `scripts/backfill-catalog-brands.ts:1-157` — canonical idempotent operator backfill pattern
- `tests/static/CollectionFitCard.no-engine.test.ts` — canonical import-boundary static guard pattern
- `.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-CONTEXT.md` — D-39b-01..D-39b-20 locked decisions
- `.planning/phases/39b-audit-driven-discovery-polish-heavier-ux/39b-UI-SPEC.md` — 6/6-approved UI design contract
- `.planning/phases/33-discovery-audit/33-DISCOVERY-AUDIT.md` — audit row IDs (DISC-AUDIT-70 / 72 / 81 / 97 / 102 / 111 / 122 / 123 / 124 / 130 / 131)
- `.planning/phases/39-audit-driven-discovery-polish/39-VERIFICATION.md` — Phase 39 5/5 PASS ship report

### Secondary (MEDIUM confidence)
- `package.json:5-19` — npm scripts confirm `tsx --env-file=.env.local` pattern; vitest available; no Anthropic Drizzle wrappers (vanilla postgres-js)
- `vitest.config.ts:1-23` — jsdom env + alias for `server-only` shim
- `src/data/wearEvents.ts:131-137` — `getAllWearEventsByUser` shape returns full rows (note field present)
- `src/app/u/[username]/[tab]/page.tsx:237-267` — current WornCalendar mount point and note passthrough

### Tertiary (LOW confidence)
- None — every claim is verified against repo files or in-repo `node_modules/next/dist/docs/` documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library version verified in `package.json`
- Architecture (server/client boundary): HIGH — Next 16.2.3 docs in `node_modules/next/dist/docs/` confirm pattern
- Pitfalls: HIGH — each pitfall traces to a specific line in the repo or a verified Postgres / Drizzle behavior
- Validation Architecture: HIGH — test files / patterns verified to exist
- NSV-18 DAL recommendation (place in `discovery.ts`): MEDIUM — alternative valid
- Same-family ranking (denormalized vs. live COUNT): MEDIUM — both valid, trade-off noted
- A1 (sold-row exclusion): MEDIUM — defensible inference from copy semantics; needs operator confirmation

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (30 days for stable patterns; the UI-SPEC and schema are locked, so no fast-moving surface)

**Pre-submission checklist:**
- [x] All domains investigated (stack, patterns, pitfalls, validation, security)
- [x] Negative claims verified with code grep (e.g., "no `getViewableUserIds` helper exists" verified by `grep -rn`)
- [x] Multiple sources cross-referenced for critical claims (server/client boundary: Next docs + 2 in-repo precedents)
- [x] URLs / file paths provided for authoritative sources
- [x] Publication dates checked — Next 16.2.3 in repo, drizzle-orm 0.45.2, vitest 2.1.9
- [x] Confidence levels assigned honestly
- [x] "What might I have missed?" review completed — checked AvatarDisplay size constraint, WornCalendar note interface gap, Number() cast on numeric, ON CONFLICT constraint name, two-query totalCount necessity
- [x] Runtime State Inventory completed — all 5 categories answered
- [x] Security domain included — ASVS V4 (load-bearing for NSV-18), STRIDE mapping with 5 T-39b-NN threats
- [x] ASVS categories verified against phase tech stack
- [x] Wave 0 dependency (operator seed → prod) explicitly captured
- [x] Validation Architecture covers all 6 ROADMAP success criteria

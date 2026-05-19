# Phase 47: Curated Lists Rail + Hero + Where Collections Go — Research

**Researched:** 2026-05-19
**Domain:** Next.js 16 Cache Components, editorial CMS public render, Drizzle schema migration
**Confidence:** HIGH — all findings verified directly against the codebase and Next.js 16 official docs

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01** — Freshness indicator = "New" badge (recent) + relative timestamp (every card).
**D-02** — New nullable `published_at` column on `curated_lists`; set on first draft→published transition; schema change + migration.
**D-03** — `setListStatus` must stamp `published_at` on first transition (null-only write); migration backfills `published_at = created_at` for existing published lists.
**D-04** — `/explore/lists` = responsive grid of all published lists; `'use client'` sort/filter controls layered over server-rendered data.
**D-05** — `/explore/paths` = every published path grouped by path-type label using the four-value `PATH_TYPES` vocab.
**D-06** — `/explore/lists/[id]` renders markdown intro copy (via `react-markdown`) then magazine-style editorial rows (watch image + per-item commentary); stacks vertically on mobile; taps open `/catalog/[catalogId]`.
**D-07** — Hero auto-selection: weekly rotation via deterministic week-index (`eligiblePool[weekIndex % pool.length]`); pool ordered by `published_at` then `id`; week index is part of the cache key (no cron).
**D-08** — Hero quality gate: `status = 'published'` AND `≥ 3 items` AND non-empty `cover_url` AND non-empty `intro_markdown`.
**D-09** — Hero `'use cache'` scope tagged `explore:hero`; manual pin (from `cms_settings.pinned_list_id`) overrides auto-select when not expired; pin fallback to auto-select if pinned list is no longer eligible.
**D-10** — Hero `return null` when no eligible content (EXPL-02); `HeroFeature` discriminated union on `format`; only `featured_list` wired this phase; shape must accept `featured_collector`.
**D-11** — Mobile (≥ 360px): numbered vertical stack with connector line/arrow (numbered 1→2→3→4).
**D-12** — Desktop: horizontal sequence (seed → next → next → next) with connectors and rationale under each.
**D-13** — Where Collections Go shows 3 paths at a time via weekly rotation (same week-index mechanism as Hero D-07).
**D-14** — Path-type chip on each path; watch taps open `/catalog/[catalogId]`; `ON DELETE RESTRICT` FKs guarantee every node resolves.

### Claude's Discretion

- "New" badge recency window (7 vs 14 days)
- Relative-timestamp formatting style ("3 days ago" vs "May 16")
- Week-index derivation function (ISO week vs epoch-days ÷ 7) — shared by Hero and Where Collections Go
- Cache tag names + `cacheLife` windows for rail and paths modules (Hero's `explore:hero` is locked)
- Whether `/explore/lists` sort/filter is URL-param-backed or local component state
- Responsive grid column counts; exact section ordering on `/explore/paths`
- Whether to extract `PATH_TYPES` to a shared constant (currently in `collectionPaths.ts` and `PathEditorClient.tsx`)

### Deferred Ideas (OUT OF SCOPE)

- `featured_collector` Hero format (shape accepts it; only `featured_list` wired)
- Computed collection paths (`source = 'computed'`)
- Any `/explore` personalization
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPL-06 | Curated Lists Rail: up to 12 published lists with cover, title, curator, watch count, freshness; "View all" links to `/explore/lists` | `getPublishedLists(12)` returns the right shape; `published_at` column (new) drives freshness; `getListItemCount` supplies watch count |
| EXPL-07 | Curated list detail page: renders intro copy and per-item editorial commentary | `getListWithItems(id)` returns list + items with brand/model/reference joined; `react-markdown` + `rehype-sanitize` pattern exists in `MarkdownEditor.tsx` |
| EXPL-08 | Hero: quality-gated featured list, auto/manual pin, hides when no eligible content; accepts featured-list and featured-collector formats | `getCmsSettings()` provides pin state; pool filtering + week-index selection is new logic; `explore:hero` tag is already wired in all Phase 45 write paths |
| EXPL-09 | Where Collections Go: rotating paths with seed + follow-ons, rationale, path-type chip; "Explore all paths" links to `/explore/paths` | `getPublishedPaths()` + `getPathNodes(pathId)` return the full shape; week-index rotation same mechanism as Hero |
</phase_requirements>

---

## Summary

Phase 47 wires three `return null` stub components — `CuratedListsRail`, `HeroModule`, `WhereCollectionsGo` — and ships two new public routes (`/explore/lists`, `/explore/lists/[id]`, `/explore/paths`). The Phase 45 DAL is complete and production-ready; this phase is almost entirely render logic plus one schema addition.

The most complex element is the Hero selection logic: it must read `cms_settings` (pin override), apply a quality gate against the published pool, then fall back to weekly-rotation auto-selection. The pool query and gate filtering happen inside a `'use cache'` scope tagged `explore:hero` — which is already wired to `revalidateTag('explore:hero', 'max')` in all four Phase 45 write paths. The week-index derivation must be a single shared utility consumed by both Hero and Where Collections Go.

The schema change is small: one nullable `published_at timestamptz` column on `curated_lists`, with a backfill of `created_at` for existing published rows. The `setListStatus` DAL function needs a conditional stamp (only when `published_at IS NULL`). The migration follows the same Drizzle + Supabase dual-push workflow (local: `drizzle-kit push`; prod: `supabase db push --linked`).

**Primary recommendation:** Read DAL signatures before writing any component props — the `getListItems` join already returns `brand`, `model`, `reference` alongside commentary and `catalogId`, which is the full shape needed for the list-detail editorial rows. Do not re-query.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CuratedListsRail data fetch + cache | Server Component | — | Viewer-independent; globally cached `'use cache'` scope |
| Hero selection + cache | Server Component | — | Viewer-independent; `explore:hero` tag; weekly rotation derived server-side |
| WhereCollectionsGo data fetch + cache | Server Component | — | Viewer-independent; weekly rotation via same week-index utility |
| `/explore/lists` sort/filter controls | Client Component (`'use client'`) | Server Component (data) | D-04 decision; data is server-rendered, controls are client-side only |
| `/explore/lists/[id]` detail page | Server Component | — | Static editorial content; auth assertion pattern |
| `/explore/paths` see-all page | Server Component | — | Static editorial; grouped by path-type label |
| `published_at` stamp on publish | API/Backend (DAL) | — | Conditional DB write in `setListStatus` |
| Week-index derivation | Shared utility (`src/lib/`) | — | Same logic consumed by Hero + WhereCollectionsGo |

---

## Standard Stack

### Core (all already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 | App Router, `'use cache'`, Server Components | Project constraint |
| Drizzle ORM | 0.45.x | Database queries, schema | Project standard |
| react-markdown | ^10.1.0 | Render markdown intro copy | Already declared in package.json [VERIFIED: package.json] |
| rehype-sanitize | ^6.0.0 | XSS-safe markdown rendering | Already declared in package.json [VERIFIED: package.json] |
| @tailwindcss/typography | ^0.5.19 | `prose` classes for markdown rendering | Already in package.json + globals.css [VERIFIED: src/app/globals.css:8] |

### Cache Components API (Next.js 16)

| API | Import | Notes |
|-----|--------|-------|
| `'use cache'` directive | — | Placed at function top; requires `cacheComponents: true` in next.config.ts |
| `cacheTag` | `import { cacheTag } from 'next/cache'` | Tags cache entry for on-demand invalidation |
| `cacheLife` | `import { cacheLife } from 'next/cache'` | Sets lifetime profile: `'hours'`, `'days'`, `'weeks'`, `'max'` |
| `revalidateTag` | `import { revalidateTag } from 'next/cache'` | Two-argument form: `revalidateTag(tag, 'max')` — single-arg is deprecated in Next.js 16 |

**Verified:** `cacheComponents: true` is in `next.config.ts` under `experimental` [VERIFIED: next.config.ts]. `revalidateTag` two-argument form confirmed from `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md`.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | ^4 | Utility classes | All components; no CSS modules |
| `cn()` utility | — | Conditional class composition | Any conditional className |
| `lucide-react` | ^1.8.0 | Icon set | Connectors, arrow indicators |
| `next/link` | built-in | Navigation links | All tap-through to `/catalog/[catalogId]` etc. |

---

## Architecture Patterns

### System Architecture Diagram

```
/explore page.tsx (Server Component)
  │
  ├── getCurrentUser() [auth assertion — OUTSIDE any 'use cache' scope]
  │
  ├── HeroModule (Server Component — 'use cache', tag: 'explore:hero')
  │     ├── getCmsSettings() → pin state
  │     ├── getPublishedLists() → quality-gate filter → eligible pool
  │     ├── weekIndex(now) → eligiblePool[weekIndex % pool.length]
  │     └── renders <Link href="/explore/lists/[id]"> OR null
  │
  ├── CollectorArchetypes (live, Phase 46)
  │
  ├── BrowseModule (live, Phase 46)
  │
  ├── CuratedListsRail (Server Component — 'use cache', tag: 'explore:lists')
  │     ├── getPublishedLists(12) → list rows (with published_at NEW)
  │     └── renders scrollable rail → "View all" /explore/lists
  │
  └── WhereCollectionsGo (Server Component — 'use cache', tag: 'explore:paths')
        ├── getPublishedPaths() → paths
        ├── getPathNodes(pathId) per path → nodes with catalog joins
        ├── weekIndex(now) → 3 paths slice
        └── renders D-11 mobile / D-12 desktop → "Explore all" /explore/paths

/explore/lists (new route — Server Component + 'use client' controls)
  ├── getCurrentUser() [auth assertion]
  ├── getPublishedLists() → all published lists
  └── ListSortFilterControls (Client Component) + list grid

/explore/lists/[id] (new route — Server Component)
  ├── getCurrentUser() [auth assertion]
  ├── getListWithItems(id) → { ...list, items: [...] }
  └── ReactMarkdown + editorial rows

/explore/paths (new route — Server Component)
  ├── getCurrentUser() [auth assertion]
  ├── getPublishedPaths() → all published paths
  ├── getPathNodes(pathId) per path
  └── sections grouped by pathType (D-05)
```

### Recommended Project Structure

New files for this phase:

```
src/
├── lib/
│   └── weekIndex.ts              # shared week-index utility (D-07, D-13)
├── components/explore/
│   ├── CuratedListsRail.tsx      # replace stub
│   ├── HeroModule.tsx            # replace stub
│   └── WhereCollectionsGo.tsx    # replace stub
└── app/explore/
    ├── lists/
    │   ├── page.tsx              # /explore/lists see-all
    │   └── [id]/
    │       └── page.tsx          # /explore/lists/[id] detail
    └── paths/
        └── page.tsx              # /explore/paths see-all
```

### Pattern 1: `'use cache'` Viewer-Independent Module (established pattern)

```typescript
// Source: src/components/explore/CollectorArchetypes.tsx (Phase 46)
// Source: src/components/explore/BrowseModule.tsx (Phase 46)
export async function CuratedListsRail() {
  'use cache'
  cacheTag('explore', 'explore:lists')
  cacheLife('hours')

  const lists = await getPublishedLists(12)
  if (lists.length === 0) return null  // EXPL-02 absent-not-empty

  return (
    <section className="space-y-4">
      <h2>...</h2>
      {/* scrollable rail */}
    </section>
  )
}
```

**Key rules:**
- `'use cache'` is the FIRST statement in the function body
- `cacheTag` and `cacheLife` immediately after
- `getCurrentUser()` MUST NOT be called inside any `'use cache'` scope — it is viewer-specific data that would poison a globally-shared cache entry [VERIFIED: src/app/explore/page.tsx:29]
- Return `null` (not empty container) when no content

### Pattern 2: Hero — Tag-Based Cache + Manual Pin Override

```typescript
// Source: design from D-07/D-08/D-09, revalidateTag pattern from src/app/actions/cms/settings.ts
export async function HeroModule() {
  'use cache'
  cacheTag('explore:hero')
  cacheLife('hours')

  // 1. Read pin state
  const settings = await getCmsSettings()

  // 2. Read published pool
  const allPublished = await getPublishedLists()

  // 3. Apply quality gate (D-08): ≥3 items + cover + intro
  // Note: item count requires getListItemCount per list — see Open Questions
  const eligible = allPublished.filter(qualityGate)

  if (eligible.length === 0) return null  // EXPL-02

  // 4. Check manual pin (D-09)
  let featured = null
  if (settings.pinnedListId && (!settings.pinExpiresAt || settings.pinExpiresAt > new Date())) {
    featured = eligible.find(l => l.id === settings.pinnedListId) ?? null
  }

  // 5. Weekly rotation fallback (D-07)
  if (!featured) {
    const week = getWeekIndex(new Date())
    featured = eligible[week % eligible.length]
  }

  // 6. Render HeroFeature (discriminated union: format = 'featured_list')
  return <HeroFeatureRender feature={{ format: 'featured_list', list: featured }} />
}
```

**Critical:** `revalidateTag('explore:hero', 'max')` is already called in all four write paths established in Phase 45: `setPinnedHero`, `clearPinnedHero`, `publishCuratedList`, `unpublishCuratedList`. This phase does NOT need to add new revalidation — it only needs to use `cacheTag('explore:hero')` in the component. [VERIFIED: src/app/actions/cms/settings.ts, src/app/actions/cms/curatedLists.ts]

### Pattern 3: Week-Index Utility (shared, deterministic)

The week-index must be deterministic, server-side only, and shared between Hero and Where Collections Go. The simplest approach is epoch-days ÷ 7 (milliseconds since Unix epoch ÷ 604800000):

```typescript
// src/lib/weekIndex.ts
export function getWeekIndex(now: Date): number {
  return Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))
}
```

This is Claude's discretion (CONTEXT.md). Both ISO week and epoch-days ÷ 7 are valid; epoch-days ÷ 7 is simpler and avoids the ISO week edge cases (year boundary, Mon-start). The function's return value becomes part of the implicit cache key because `'use cache'` captures the function's closure inputs — but since `new Date()` is called server-side at render time, the week-index advances naturally without a cron. [ASSUMED — the "part of the cache key" behavior is inferred from how `'use cache'` closures work; the core week-index derivation logic is not framework-specific]

### Pattern 4: DAL Signatures — What getPublishedLists Returns

```typescript
// Source: src/data/curatedLists.ts — getPublishedLists
// Returns array of curated_lists rows (all columns from the table):
{
  id: string                    // uuid
  title: string
  curatorName: string
  coverUrl: string | null
  introMarkdown: string | null
  status: 'draft' | 'published'
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  // NEW (Phase 47): published_at will be added by D-02 migration
  // publishedAt: Date | null
}
```

```typescript
// Source: src/data/curatedLists.ts — getListWithItems
// Returns { ...list, items: [...] } where items are:
{
  id: string
  listId: string
  catalogId: string             // watches_catalog.id — use for /catalog/[catalogId] link
  commentary: string | null
  sortOrder: number
  createdAt: Date
  brand: string                 // joined from watches_catalog
  model: string
  reference: string | null
  // NOTE: imageUrl is NOT joined — watches_catalog.imageUrl is not selected in getListItems
  // The planner must add imageUrl to getListItems SELECT for D-06 editorial rows
}
```

**CRITICAL GAP:** `getListItems` currently selects `brand`, `model`, `reference` from `watches_catalog` but does NOT select `imageUrl`. [VERIFIED: src/data/curatedLists.ts:149-166] The list-detail editorial row (D-06) requires the watch image. The planner must extend the `getListItems` SELECT to include `watchesCatalog.imageUrl`.

```typescript
// Source: src/data/collectionPaths.ts — getPublishedPaths
// Returns array of collection_paths rows:
{
  id: string
  seedCatalogId: string
  status: 'draft' | 'published'
  pathType: string              // one of: 'Going Deeper'|'Branching Out'|'Trading Up'|'Filling a Gap'
  rationale: string | null
  source: 'manual' | 'computed'
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

// Source: src/data/collectionPaths.ts — getPathWithNodes
// Returns { ...path, nodes: [...], seedWatch: {...} | null }
// nodes are:
{
  id: string
  pathId: string
  catalogId: string
  rationale: string | null
  sortOrder: number
  createdAt: Date
  brand: string                 // joined from watches_catalog
  model: string
  reference: string | null
  // NOTE: imageUrl also NOT selected in getPathNodes — same gap as list items
}
// seedWatch: { brand, model, reference } — also missing imageUrl
```

**SAME GAP FOR PATHS:** `getPathNodes` and the seed watch query in `getPathWithNodes` do not select `imageUrl`. [VERIFIED: src/data/collectionPaths.ts:83-100, 58-70] The path renderer (D-11/D-12) needs watch images. The planner must extend both queries.

```typescript
// Source: src/data/cmsSettings.ts — getCmsSettings
// Returns (from DB or safe default):
{
  id: 1
  pinnedListId: string | null
  pinExpiresAt: Date | null
  heroFormat: 'featured_list' | 'featured_collector'
  updatedAt: Date
}
```

### Pattern 5: setListStatus Extension for published_at (D-03)

Current `setListStatus` only flips `status`. The Phase 47 extension must be conditional:

```typescript
// Extension of src/data/curatedLists.ts — setListStatus
export async function setListStatus(id: string, status: 'draft' | 'published') {
  const set: Record<string, unknown> = { status, updatedAt: new Date() }
  if (status === 'published') {
    // D-03: stamp published_at only on first transition (null-only write)
    // Use SQL coalesce or a conditional update
    // Pattern: UPDATE ... SET published_at = COALESCE(published_at, now()) WHERE id = ...
  }
  await db.update(curatedLists).set(set).where(eq(curatedLists.id, id))
}
```

The `COALESCE(published_at, now())` pattern in raw SQL achieves the "first transition only" requirement without a round-trip read. Drizzle supports `sql` template literals for this. [ASSUMED — Drizzle SQL template + COALESCE pattern; the intent is clear from D-03]

### Pattern 6: react-markdown + rehype-sanitize (established pattern)

```typescript
// Source: src/components/admin/MarkdownEditor.tsx (Phase 45)
// CR-02 note: rehypeSanitize is REQUIRED wherever introMarkdown renders publicly
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

// Wrapping div is required for prose typography:
<div className="prose prose-sm dark:prose-invert max-w-none">
  <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{introMarkdown}</ReactMarkdown>
</div>
```

**Critical from MarkdownEditor.tsx comment (GAP-1/CR-02):** The `prose` wrapper and `rehypeSanitize` are both required on the public render path. Omitting `prose` makes headings/lists look like unstyled body text (Tailwind Preflight resets them). Omitting `rehypeSanitize` creates an XSS vector. The typography plugin is already registered in `globals.css` via `@plugin "@tailwindcss/typography"`. [VERIFIED: src/app/globals.css:8, src/components/admin/MarkdownEditor.tsx:15,26]

### Pattern 7: New Route Page Structure (established from brands/eras/genres)

```typescript
// Source: src/app/explore/brands/page.tsx, genres/page.tsx, eras/page.tsx
export const metadata = { title: 'Lists — Horlo' }

export default async function ListsPage() {
  // Auth assertion — OUTSIDE any 'use cache' boundary
  await getCurrentUser()

  const lists = await getPublishedLists()

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 max-w-6xl">
      <Link href="/explore">← Explore</Link>
      <h1 className="text-xl font-semibold ...">Curated Lists</h1>
      {/* grid content */}
    </main>
  )
}
```

`getCurrentUser()` is always the first statement in the page body, outside any cache scope. [VERIFIED: src/app/explore/brands/page.tsx:29, genres/page.tsx:39, eras/page.tsx]

### Anti-Patterns to Avoid

- **Per-viewer data inside `'use cache'`**: Calling `getCurrentUser()` inside a `'use cache'` scope would cache the first user's identity for all subsequent visitors. All three stub components are viewer-independent — there is no viewer context to inject.
- **Single-arg `revalidateTag`**: `revalidateTag('explore:hero')` without the second `'max'` argument is deprecated in Next.js 16. Always use `revalidateTag('explore:hero', 'max')`. [VERIFIED: official docs node_modules/next/dist/docs/.../revalidateTag.md:55]
- **Missing `rehypeSanitize`**: Rendering `introMarkdown` without `rehypeSanitize` is a CR-02 security violation. The admin CMS does not sanitize on write; sanitization is the renderer's responsibility.
- **Missing `prose` wrapper for markdown**: Without `<div className="prose ...">`, Tailwind Preflight strips all heading and list styles — the intro copy renders as unstyled text.
- **Hardcoding the Hero to `featured_list`**: The `HeroFeature` shape must be a discriminated union with a `format` field, even though only `featured_list` is wired. D-10 explicitly requires forward-compat.
- **`imageUrl` gap not addressed**: The list-detail editorial rows and path node renderer both need `imageUrl`; the current DAL joins do not select it. If this is not added in Wave 0 / Plan 1, components will silently render imageless cards.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering + sanitization | Custom parser | `react-markdown` + `rehypeSanitize` | Already in package.json; handles edge cases and XSS |
| CSS cache invalidation | Manual `revalidatePath` for hero | `revalidateTag('explore:hero', 'max')` already wired in Phase 45 write paths | All four write paths already emit this tag |
| Week rotation scheduling | cron job or background task | Week-index from `new Date()` as a deterministic cache key input | No infrastructure required; advances automatically |
| Typography reset fix | Custom CSS | `@tailwindcss/typography` `prose` classes | Already in globals.css; MarkdownEditor already uses this pattern |

---

## Schema Change: published_at

### Drizzle Schema Edit (src/db/schema.ts)

Add to `curatedLists` table definition:

```typescript
publishedAt: timestamp('published_at', { withTimezone: true }),  // nullable, no default
```

Placement: after `sortOrder`, before `createdAt`. [VERIFIED: src/db/schema.ts:570-586 — current column order]

### Migration File

Filename convention (from last migration): `20260518210000_phase45_cms_covers_bucket.sql` → new file should use a later timestamp, e.g. `20260519000000_phase47_published_at.sql`.

**Content:**

```sql
-- Phase 47 D-02: add published_at to curated_lists
ALTER TABLE public.curated_lists
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- D-03: backfill for existing published lists
UPDATE public.curated_lists
SET published_at = created_at
WHERE status = 'published' AND published_at IS NULL;
```

**Push commands:**
- Local: `npx drizzle-kit push` (LOCAL ONLY — see memory note `project_drizzle_supabase_db_mismatch`)
- Prod: `supabase db push --linked` (uses the `.sql` file in `supabase/migrations/`)

**Gotchas from `project_drizzle_supabase_db_mismatch` memory:**
1. Migration filename must be newer than last existing file (`20260518210000_...`)
2. No enum operations in this migration (plain `ALTER TABLE ADD COLUMN`) — enum-ordering rules do not apply
3. No SECURITY DEFINER functions — `SECDEF GRANTS` gotcha does not apply
4. The Drizzle journal (`drizzle/__drizzle_migrations`) may be out of sync with prod (DEBT-12 from STATE.md) — this migration uses a raw `.sql` file for Supabase, so it is not affected by the journal desync

---

## PATH_TYPES Vocab

```typescript
// Source: src/app/actions/cms/collectionPaths.ts:33 [VERIFIED]
const PATH_TYPES = ['Going Deeper', 'Branching Out', 'Trading Up', 'Filling a Gap'] as const
```

**Note on extraction:** This constant is currently defined in `collectionPaths.ts` (Server Action) and referenced in `PathEditorClient.tsx`. Phase 47's `/explore/paths` page (D-05) is a third consumer that groups paths into sections by path-type label. Claude's discretion allows extracting to a shared constant — recommended location: `src/lib/pathTypes.ts`. This avoids importing a `'use server'` file from a Server Component page. [VERIFIED: file location src/app/actions/cms/collectionPaths.ts:33]

---

## Common Pitfalls

### Pitfall 1: Per-Viewer Data Poisoning Globally-Shared Cache
**What goes wrong:** Calling `getCurrentUser()` or any viewer-scoped query inside a `'use cache'` scope on the explore page components caches the first viewer's identity for all subsequent visitors.
**Why it happens:** The three modules (HeroModule, CuratedListsRail, WhereCollectionsGo) are viewer-independent by design — they render the same content for all authenticated users.
**How to avoid:** All three modules must NOT call `getCurrentUser()`. Auth is already asserted in `ExplorePage` (page.tsx) before rendering any module. [VERIFIED: src/app/explore/page.tsx:29]
**Warning signs:** Any `getCurrentUser()` or `userId` inside a `'use cache'`-tagged function body.

### Pitfall 2: Missing imageUrl in DAL Joins (CRITICAL)
**What goes wrong:** List-detail editorial rows (D-06) and path renderers (D-11/D-12) silently render with broken/missing images because `getListItems` and `getPathNodes` do not select `watchesCatalog.imageUrl`.
**Why it happens:** Phase 45 built the DAL for admin CMS use; the admin cards show brand/model without images. The public render requires images.
**How to avoid:** Extend `getListItems` and `getPathNodes` (and the seed watch query in `getPathWithNodes`) to include `watchesCatalog.imageUrl` in the SELECT.
**Warning signs:** Watch cards with placeholder/empty image area in list-detail or path nodes.

### Pitfall 3: Hardcoding Hero Format
**What goes wrong:** Writing `{ format: 'featured_list', list: ... }` directly in the Hero render without a discriminated union type breaks the forward-compat requirement for `featured_collector`.
**Why it happens:** Only `featured_list` is wired this phase, so the union feels unnecessary.
**How to avoid:** Define `HeroFeature` as a discriminated union type: `{ format: 'featured_list'; list: CuratedList } | { format: 'featured_collector'; ... }`. The render switch-cases on `format`. [VERIFIED: D-10 in CONTEXT.md + src/db/schema.ts:652 — cmsSettings.heroFormat union]

### Pitfall 4: Single-Argument revalidateTag
**What goes wrong:** `revalidateTag('explore:hero')` (one arg) is a deprecated call that may be removed in future Next.js versions.
**Why it happens:** Common habit from Next.js < 16.
**How to avoid:** Always use two-argument form: `revalidateTag('explore:hero', 'max')`. [VERIFIED: official Next.js 16 docs + all Phase 45 action files]

### Pitfall 5: Hero Quality Gate Requiring N+1 Queries
**What goes wrong:** Applying the `≥ 3 items` quality gate (D-08) requires item counts per list. Doing this as `getListItemCount(listId)` for each published list creates N+1 queries.
**Why it happens:** `getPublishedLists()` does not include item counts.
**How to avoid:** Options: (a) add a single aggregated query that returns lists WITH item counts in one JOIN; (b) use a subquery/CTE. The simplest approach: extend `getPublishedLists` to accept a `withItemCount: true` option and add a subquery count to the SELECT. The Hero is the only context that needs counts for gating; the rail uses `getListItemCount` per-card for display (already exists). Given the pool is at most tens of lists, N+1 is technically acceptable for the Hero path — but a JOIN is cleaner.
**Warning signs:** Multiple sequential `getListItemCount` calls inside the Hero's `'use cache'` scope.

### Pitfall 6: CSS Chain for Hero Full-Bleed Image
**What goes wrong:** Hero cover image does not visually fill the container despite correct class names — `aspect-ratio` and `object-fit` classes don't compose as expected.
**Why it happens:** From `feedback_ui_spec_css_chain_blind_spot` memory: the 6-pillar checker validates declared tokens, not whether the CSS chain produces the claimed visual. Phase 30 shipped a black-bar through 6/6 PASS.
**How to avoid:** Explicitly assert the CSS chain: container must have explicit dimensions (fixed height or `aspect-video` / `aspect-[16/9]`), `overflow-hidden`, child `<img>` (or `<div>` background) with `w-full h-full object-cover`.
**Warning signs:** Image renders too short, letterboxed, or shows a black bar.

### Pitfall 7: /explore/lists sort controls on URL params causing full page reload
**What goes wrong:** Making sort/filter URL-param-backed causes a full navigation on every sort change, which re-runs the Server Component including `getCurrentUser()`.
**Why it happens:** URL params trigger navigation in Next.js App Router.
**How to avoid:** Per Claude's discretion in D-04, local component state is the simpler choice for this single-page sort/filter. No URL persistence needed for MVP.

---

## Code Examples

### Week-Index Utility

```typescript
// src/lib/weekIndex.ts
// Returns a monotonically increasing integer that advances every 7 days.
// Deterministic: same value for all callers on the same week.
// Used as an implicit cache-key input for Hero and WhereCollectionsGo rotation.
export function getWeekIndex(now: Date): number {
  return Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))
}
```

### Hero Quality Gate

```typescript
// D-08: eligible = published + ≥3 items + non-empty cover + non-empty intro
function isHeroEligible(list: CuratedListWithCount): boolean {
  return (
    list.status === 'published' &&
    list.itemCount >= 3 &&
    !!list.coverUrl &&
    !!list.introMarkdown
  )
}
```

### HeroFeature Discriminated Union

```typescript
// src/lib/types.ts (or a new src/lib/heroTypes.ts)
// Only 'featured_list' is wired in Phase 47; union kept for forward-compat (D-10)
export type HeroFeature =
  | { format: 'featured_list'; list: CuratedList }
  | { format: 'featured_collector'; /* future shape */ }
```

### Freshness Indicator (D-01)

```typescript
// "New" badge: published within last N days (Claude's discretion: 7 days recommended)
function isNew(publishedAt: Date | null, nowMs: number): boolean {
  if (!publishedAt) return false
  return nowMs - publishedAt.getTime() < 7 * 24 * 60 * 60 * 1000
}

// Relative timestamp: "3 days ago" — using Intl.RelativeTimeFormat (no dependency needed)
function relativeTime(publishedAt: Date | null): string {
  if (!publishedAt) return ''
  const diffDays = Math.floor((Date.now() - publishedAt.getTime()) / 86400000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (diffDays < 1) return 'Today'
  if (diffDays < 7) return rtf.format(-diffDays, 'day')
  if (diffDays < 30) return rtf.format(-Math.floor(diffDays / 7), 'week')
  return rtf.format(-Math.floor(diffDays / 30), 'month')
}
```

`Intl.RelativeTimeFormat` is a V8 built-in (no npm dependency), works server-side in Node.js, and produces "3 days ago", "last week", "2 months ago" format.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `unstable_cache` | `'use cache'` directive + `cacheTag`/`cacheLife` | Next.js 16 (this project) | Components can be directly tagged; no cache wrapper fn needed |
| Single-arg `revalidateTag(tag)` | Two-arg `revalidateTag(tag, 'max')` | Next.js 16 | Single-arg deprecated; two-arg provides SWR semantics |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 47 is purely code/schema changes. No new external services or CLI tools beyond what is already running (`npm run dev`, Drizzle, Supabase).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPL-06 | CuratedListsRail returns null when no published lists | unit | `npm test -- src/components/explore/__tests__/CuratedListsRail.test.tsx` | ❌ Wave 0 |
| EXPL-06 | CuratedListsRail renders up to 12 cards with freshness indicator | unit | same | ❌ Wave 0 |
| EXPL-07 | List detail page renders markdown intro (ReactMarkdown) | unit | `npm test -- src/app/explore/lists/[id]/__tests__/` | ❌ Wave 0 |
| EXPL-08 | HeroModule returns null when eligible pool is empty | unit | `npm test -- src/components/explore/__tests__/HeroModule.test.tsx` | ❌ Wave 0 |
| EXPL-08 | HeroModule uses manual pin when active and eligible | unit | same | ❌ Wave 0 |
| EXPL-08 | HeroModule falls back to weekly rotation when no valid pin | unit | same | ❌ Wave 0 |
| EXPL-09 | WhereCollectionsGo returns null when no published paths | unit | `npm test -- src/components/explore/__tests__/WhereCollectionsGo.test.tsx` | ❌ Wave 0 |
| D-03 | setListStatus stamps published_at on first transition only | unit | `npm test -- src/data/__tests__/curatedLists.test.ts` | ❌ Wave 0 |

**Manual-only** (no automated test viable):
- Full-bleed Hero image CSS chain (visual — assert in verify task)
- Mobile 360px vertical stack layout for WhereCollectionsGo (device/visual)
- `react-markdown` prose rendering with `@tailwindcss/typography` (visual)

### Sampling Rate

- **Per task commit:** `npm test -- --run` (full suite, fast — currently no slow DB tests)
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/explore/__tests__/CuratedListsRail.test.tsx` — covers EXPL-06 null-hide + card render
- [ ] `src/components/explore/__tests__/HeroModule.test.tsx` — covers EXPL-08 null/pin/rotation
- [ ] `src/components/explore/__tests__/WhereCollectionsGo.test.tsx` — covers EXPL-09 null-hide + rotation
- [ ] `src/lib/__tests__/weekIndex.test.ts` — covers D-07/D-13 deterministic utility
- [ ] `src/data/__tests__/curatedLists.test.ts` — extends existing patterns for D-03 published_at stamp

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (auth gate on pages) | `getCurrentUser()` as page-level auth assertion; `proxy.ts` redirects |
| V3 Session Management | no — read-only public render | — |
| V4 Access Control | limited — published content only | Explicit `WHERE status='published'` in every DAL public-read function (CR-01 draft-leak gate) |
| V5 Input Validation | yes (markdown render) | `rehypeSanitize` (GitHub-schema allow-list) on all public `ReactMarkdown` renders |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via markdown intro copy | Tampering | `rehypeSanitize` on all public `ReactMarkdown` renders (CR-02) |
| Draft content leakage | Information Disclosure | Explicit `WHERE status='published'` in DAL; RLS as backstop (CR-01) |
| Unauthenticated access to `/explore/*` | Information Disclosure | `proxy.ts` auth gate redirects to `/login`; `getCurrentUser()` in every page body |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Week-index via `now.getTime() / 604800000` is sufficient as an implicit cache-key input because `'use cache'` captures closure values | Architecture Patterns (Pattern 3) | If `'use cache'` does not capture `new Date()` derived values, rotation may not advance — would need to pass week index as an explicit prop/param |
| A2 | `Intl.RelativeTimeFormat` is available in the Node.js runtime used by this project and produces the expected format | Code Examples | If Node version is very old (< 14) or locale is unavailable, relative timestamps may error — fallback to a simple "N days ago" string template |
| A3 | N+1 item count queries for Hero quality gate are acceptable given the pool size (tens of lists, all within one `'use cache'` scope) | Common Pitfalls (Pitfall 5) | If pool grows to hundreds, a single aggregated query is required — not an issue at current catalog scale |

---

## Open Questions

1. **Hero quality gate — item count source**
   - What we know: `getListItemCount(listId)` exists and returns a count. `getPublishedLists()` does not include counts.
   - What's unclear: Should the Hero fetch all published lists and then do N `getListItemCount` calls, or should `getPublishedLists` be extended with a count subquery?
   - Recommendation: For plan clarity, extend `getPublishedLists` to optionally include a count (via a subquery or LEFT JOIN COUNT) when called from the Hero context. This is a single DB round-trip vs. N+1. Given the pool is small, N+1 is acceptable for MVP — the planner can decide.

2. **PATH_TYPES extraction timing**
   - What we know: `PATH_TYPES` is `as const` in `src/app/actions/cms/collectionPaths.ts` (a `'use server'` file). `/explore/paths` (a Server Component page) is a third consumer.
   - What's unclear: Can a Server Component page import from a `'use server'` file? In Next.js 16, `'use server'` marks a module as containing Server Actions — importing it from a Server Component page should work (Server Components can use Server Action imports), but it's cleaner to extract to a plain `src/lib/pathTypes.ts`.
   - Recommendation: Extract `PATH_TYPES` to `src/lib/pathTypes.ts` as a first wave task. This is low-risk and clean.

---

## Sources

### Primary (HIGH confidence)

- `src/data/curatedLists.ts` — exact return types of `getPublishedLists`, `getListWithItems`, `getListItems`, `setListStatus`, `getListItemCount` [VERIFIED]
- `src/data/collectionPaths.ts` — exact return types of `getPublishedPaths`, `getPathWithNodes`, `getPathNodes` [VERIFIED]
- `src/data/cmsSettings.ts` — exact return type of `getCmsSettings`; safe-default pattern [VERIFIED]
- `src/db/schema.ts` — `curatedLists` columns, `cmsSettings` columns, missing `published_at` [VERIFIED]
- `src/app/actions/cms/collectionPaths.ts:33` — `PATH_TYPES` four-value vocab [VERIFIED]
- `src/app/actions/cms/curatedLists.ts` — all `revalidateTag('explore:hero', 'max')` call sites [VERIFIED]
- `src/app/actions/cms/settings.ts` — `setPinnedHero`/`clearPinnedHero` revalidation [VERIFIED]
- `src/components/explore/CollectorArchetypes.tsx` — `'use cache'` + `cacheTag` + `cacheLife` pattern [VERIFIED]
- `src/components/explore/BrowseModule.tsx` — viewer-independent cache pattern [VERIFIED]
- `src/app/explore/page.tsx` — `getCurrentUser()` outside cache scope pattern [VERIFIED]
- `src/app/explore/brands/page.tsx`, `genres/page.tsx`, `eras/page.tsx` — new route structure pattern [VERIFIED]
- `src/components/admin/MarkdownEditor.tsx` — `react-markdown` + `rehypeSanitize` + `prose` pattern; CR-02 security annotation [VERIFIED]
- `src/app/globals.css` — `@plugin "@tailwindcss/typography"` registered [VERIFIED]
- `next.config.ts` — `cacheComponents: true` confirmed [VERIFIED]
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md` — two-arg deprecation note [VERIFIED]
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md` — cacheTag API [VERIFIED]
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheLife.md` — preset profiles table [VERIFIED]
- `supabase/migrations/20260518200000_phase45_cms_tables.sql` — migration convention and SQL patterns [VERIFIED]
- `package.json` — `react-markdown`, `rehype-sanitize`, `@tailwindcss/typography` versions [VERIFIED]

### Secondary (MEDIUM confidence)

- Memory note `project_drizzle_supabase_db_mismatch` — push workflow and filename/ordering gotchas [CITED]
- Memory note `feedback_ui_spec_css_chain_blind_spot` — Hero full-bleed CSS chain assertion requirement [CITED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json / globals.css
- Architecture: HIGH — Cache Components patterns verified from Phase 46 live components and Next.js 16 official docs
- DAL signatures: HIGH — read directly from source files
- Schema change: HIGH — read from schema.ts and migration convention from existing files
- Pitfalls: HIGH — DAL imageUrl gap verified by reading exact SELECT clauses; cache poisoning pattern verified from Phase 46 code
- Week-index cache-key behavior: MEDIUM (A1 above) — inferred from `'use cache'` semantics, not explicit in docs

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (stable stack; only risk is Next.js 16 minor version changes)

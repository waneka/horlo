# Phase 27: Watch Card & Collection Render Polish - Research

**Researched:** 2026-05-04
**Domain:** Reorderable list UI (drag-and-drop) on Next.js 16 + React 19 + Drizzle/Supabase
**Confidence:** HIGH (most claims verified against official docs, codebase, npm registry, or Next.js bundled docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema & sort order**
- D-01: Add a single `sort_order` column to `watches` (universal, on every row regardless of status). Type: `integer`. Indexed by `(user_id, status, sort_order)` is not required for v4.1 scale (<500 watches per user) — a plain `(user_id, sort_order)` index is sufficient if the read path needs one. No `NOT NULL` constraint needed; default 0.
- D-02: Backfill on migration — for each user, assign `sort_order` 0, 1, 2, … to their existing wishlist+grail watches in `createdAt DESC` order (newest first, current display order). Owned/sold can be backfilled the same way or left at default.
- D-03: New wishlist/grail add: `sort_order = max(sort_order) + 1` for that user's wishlist+grail set. New watch lands at end.
- D-04: Status transitions reset `sort_order` to `max + 1` for the destination group (wishlist+grail share one group; owned+sold are separate). No "remember original slot."
- D-05: Wishlist tab reorder treats `wishlist + grail` as one combined list (single `sort_order` sequence across both).

**Reorder UX**
- D-06: Desktop drag affordance — press-and-hold anywhere on the card (~150ms hold). No always-visible drag handle, no edit-mode toggle. Click without hold still navigates to `/watch/[id]`.
- D-07: Mobile drag affordance — long-press anywhere on the card (~250ms threshold). Tap = navigate; long-press = drag.
- D-08: Non-owner viewing public Wishlist sees plain cards — no drag affordance. Order is owner's chosen order, threaded through privacy gates.
- D-09: Reorder persistence is **optimistic UI** — local state updates immediately on drop, server action fires fire-and-forget, Sonner toast on error with local rollback. Bulk update for the user's wishlist+grail `sort_order` set in one round-trip.
- D-10: Reorder is owner-only at the action layer — server action validates `userId === session.user.id` for every row in the bulk update.

**Mobile grid density (VIS-07)**
- D-11: Change `CollectionTabContent` and `WishlistTabContent` grid from `grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4` to `grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4`. Mobile (<640px): 2 columns. Tablet+ unchanged.
- D-12: Render `ProfileWatchCard` content as-is at half-width on mobile. No responsive text-size variants, no compressed padding, no different-card-variant.
- D-13: Image aspect ratio stays `4:5` across all breakpoints. Update `Image sizes` to `(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw`.
- D-14: Wishlist meta lines (`Target: $X`, `Notes: …`) render unchanged on mobile half-width.

**Price line (VIS-08)**
- D-15: Add a single price line to `ProfileWatchCard` driven by status. Replace the existing wishlist-only `Target: $X` block with the unified line.
- D-16: Status → bucket mapping: `owned`/`sold` → paid bucket; `wishlist`/`grail` → target bucket.
- D-17: Fallback chain: paid bucket shows `pricePaid` else `marketPrice` else hide; target bucket shows `targetPrice` else `marketPrice` else hide.
- D-18: Labels are explicit prefixes — `"Paid: $X"`, `"Target: $X"`, `"Market: $X"`. Not bare amounts, not icons.
- D-19: No visual distinction between primary and fallback (no muted styling for `marketPrice` when standing in).
- D-20: `marketPrice` is NOT independently surfaced on `ProfileWatchCard` outside the fallback role. v6.0 owns first-class market display.
- D-21: Number formatting — `value.toLocaleString()` for thousands separators. USD, prefix `$`, no decimals.

### Claude's Discretion

- Drag-and-drop **library choice** (constraints: touch + keyboard sensors, React 19 + Server/Client boundary). `@dnd-kit/core` + `@dnd-kit/sortable` is the strong default candidate per CONTEXT.md.
- Long-press threshold values (150ms desktop / 250ms mobile) are starting defaults — adjust if testing reveals misfire patterns.
- Exact `reorderWishlist` server-action signature and read-path order-by clause shape.
- Whether `(user_id, sort_order)` index is added in the same migration or skipped.
- Cross-device sync: two-tab last-write-wins is acceptable; no conflict resolution beyond that.

### Deferred Ideas (OUT OF SCOPE)

- Add-Watch flow paid/target capture UX → Phase 28 candidate
- Reorder UX on Collection tab → future phase (column exists post-migration; UX deferred)
- Lexorank / midpoint sort_order positioning → if scale grows
- `marketPrice` first-class display on cards → v6.0 Market Value (SEED-005)
- Retail-vs-Market label disambiguation → schema decision deferred

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WISH-01 | Reorder wishlist via drag-and-drop on desktop, long-press on mobile; persists across sessions; owner-only | Standard Stack §dnd-kit; Architecture Pattern §SortableContext; Don't Hand-Roll §custom DnD; Code Examples §reorderWishlist server action; Validation Architecture §reorder action tests |
| VIS-07 | Collection + wishlist grids render in 2 columns on mobile (<768px) | Architecture Pattern §grid breakpoint change; Code Examples §grid class swap + sizes attr update |
| VIS-08 | Watch card displays price line — `pricePaid` for owned, `targetPrice` for wishlist; hidden when null | Architecture Pattern §status-driven price line; Code Examples §bucket+fallback render; Common Pitfalls §marketPrice fallback honesty |

</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

These are binding directives — research recommendations MUST honor them.

- **AGENTS.md:** "This is NOT the Next.js you know." Read `node_modules/next/dist/docs/` before writing Next.js code; do NOT rely on training data for Next.js 16 APIs. (Verified: docs are present at that path; all Next.js 16 claims in this research are sourced from those bundled docs.)
- **CLAUDE.md tech stack lock:** Next.js 16 App Router, React 19, Tailwind CSS 4, Drizzle ORM + Supabase, Zod, Sonner, shadcn `base-nova` preset, Server Actions for mutations. No rewrites; extend, don't break.
- **CLAUDE.md naming:** PascalCase for React components and component files; camelCase for non-component files; UPPER_SNAKE_CASE for constants; absolute imports via `@/*`.
- **CLAUDE.md state management:** Zustand `use<Name>Store` hooks where applicable, but server-side persistence (DAL + server action) is the source of truth. No client-only persistence for `sort_order`.
- **CLAUDE.md API conventions:** Server Actions return `ActionResult<T>` (discriminated union). Validate inputs with Zod `.strict()`. Use `getCurrentUser()` for auth. Use `revalidatePath` on success.
- **CLAUDE.md project memory landmines (binding):**
  - `drizzle-kit push` is LOCAL ONLY; prod schema changes go through `supabase db push --linked` with a `supabase/migrations/2026XXXXXXXXXX_phaseXX_*.sql` file.
  - Local DB reset: `supabase db reset` alone fails; follow with drizzle push + selective migrations via `docker exec psql`.
  - Supabase SECDEF grants: `REVOKE FROM PUBLIC` does NOT block anon; explicit `REVOKE FROM anon, authenticated, service_role` is required for SECURITY DEFINER fn restriction. (Not directly applicable to Phase 27 since no SECDEF fns are added, but flagged for awareness.)

## Summary

Phase 27 is a **polish/patch phase with one new domain**: client-side drag-and-drop reorder of a list of <50 items per user, persisted server-side via a Server Action that performs a single bulk UPDATE on a new `watches.sort_order` column. The other two requirements (mobile 2-col grid, status-driven price line) are local component changes with no architectural risk.

The drag-and-drop work is the load-bearing investigation. The recommended stack — `@dnd-kit/core@6.3.1` + `@dnd-kit/sortable@10.0.0` — is the project's existing default candidate (per CONTEXT.md "Claude's Discretion") and is verified production-ready against React 19 / Next.js 16 in May 2026 [VERIFIED: npm registry 2026-05-04; CITED: GitHub releases — useRef readonly fix for React 19 type compatibility]. The newer `@dnd-kit/react@0.4.0` package is a ground-up redesign published only 2 weeks ago with 53 production projects vs. 2,496 for `@dnd-kit/core` [CITED: npm-compare]; recommend AGAINST using it for v4.1.

The Server Action pattern is well-established in the codebase (`src/app/actions/watches.ts` and `wishlist.ts` both use Zod `.strict()` + `getCurrentUser()` + `ActionResult<T>` + `revalidatePath`). The bulk-update SQL pattern is a CASE WHEN expression built with Drizzle's `sql.join()` helper, executing in a single round-trip [CITED: orm.drizzle.team/docs/guides/update-many-with-different-value]. Owner-only enforcement is enforced both by Zod-validated `userId` from session AND by `WHERE user_id = ?` in the UPDATE — defense in depth.

The optimistic UI pattern uses React 19's `useOptimistic` hook directly. Two existing project examples (`PrivacyToggleRow.tsx`, `NoteVisibilityPill.tsx`, `NotificationRow.tsx`) provide the exact `useOptimistic + useTransition + ActionResult` shape to copy.

**Primary recommendation:** Wire `@dnd-kit/core` + `@dnd-kit/sortable` into `WishlistTabContent` (already a Client Component — natural client island), use separate `MouseSensor` (delay 150ms, tolerance 5px) + `TouchSensor` (delay 250ms, tolerance 8px) + `KeyboardSensor` with `sortableKeyboardCoordinates`, `rectSortingStrategy` for the 2-column grid, `DragOverlay` for the floating active card, and `useOptimistic` driving local order state. The Server Action computes a single bulk UPDATE via `sql` CASE WHEN. Schema migration: drizzle generates `drizzle/00XX_phase27_sort_order.sql`, then mirror to `supabase/migrations/20260504HHMMSS_phase27_sort_order.sql` for prod.

## Architectural Responsibility Map

Phase 27 spans frontend (mostly browser-tier interaction) + thin API/data layer. Each capability is mapped to its tier owner so the planner doesn't accidentally place data validation in the browser or DnD wiring on the server.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Drag-and-drop interaction (sensors, overlay, accessibility) | Browser / Client | — | DnD is inherently a browser-tier concern (DOM events, pointer/touch/keyboard sensors). Mounted via `'use client'` boundary at `WishlistTabContent`. |
| Optimistic UI state (local order on drop) | Browser / Client | — | `useOptimistic` is a React 19 client hook. Drives the `<SortableContext items={...}>` ordering between drop and server-confirmation. |
| Sonner error toast on persistence failure | Browser / Client | — | Toast surface is mounted client-side via `ThemedToaster`. Triggered when `ActionResult.success === false`. |
| Zod input validation | API / Backend (Server Action) | — | All validation is server-side in the Server Action. Client never trusted. Pattern from `watches.ts:17-49`. |
| Owner-only authorization | API / Backend (Server Action + DAL) | Database (RLS) | Layer 1: Server Action reads `userId` from `getCurrentUser()`. Layer 2: DAL `WHERE user_id = ?`. Layer 3 (existing): Supabase RLS on `watches`. |
| Bulk UPDATE of `sort_order` | API / Backend (DAL) | — | Single SQL round-trip: `UPDATE watches SET sort_order = CASE WHEN id = ? THEN ? ... END WHERE user_id = ? AND id IN (...)`. |
| `sort_order` column + backfill | Database / Storage (migration) | — | Schema in `src/db/schema.ts` (drizzle-kit) + parallel `supabase/migrations/2026XXXXXXXXXX_phase27_*.sql` for prod. |
| Read-path ORDER BY | API / Backend (DAL) | — | `getWatchesByUser` adds `.orderBy(asc(watches.sortOrder), desc(watches.createdAt))` — runs on every wishlist tab render. |
| Mobile grid breakpoint change (Tailwind class string) | Browser / Client | — | Pure CSS via Tailwind utility classes on `WishlistTabContent` and `CollectionTabContent`. |
| Price-line render (status-driven) | Browser / Client | — | Pure render logic in `ProfileWatchCard.tsx`. Reads from already-loaded `Watch` payload — no extra fetch. |
| Image `sizes` attribute update | Browser / Client | CDN (Next.js Image optimizer) | The `sizes` string lives in the JSX; the Next.js Image optimizer at the CDN layer uses it to pick a `srcset` candidate. |

**Tier sanity-check items for the planner:**
- The Server Action MUST NOT trust any `userId` field from the client. Read it from `getCurrentUser()` only.
- The DAL `getWatchesByUser` ORDER BY change is the canonical entry point — DO NOT re-sort on the client.
- The DnD wiring is client-only — `WishlistTabContent` is the natural mount point (already `'use client'`); do not push DnD into a Server Component.

## Standard Stack

### Core (new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | `^6.3.1` | Core drag/drop primitives — `DndContext`, sensors, `DragOverlay` | Most-adopted modern React DnD library (~2,496 projects vs. 53 for the new `@dnd-kit/react`); fully accessible (keyboard + screen reader); maintained; React-19-type-compatible patches landed in 6.3.1 [VERIFIED: npm 2026-05-04; CITED: github.com/clauderic/dnd-kit/releases] |
| `@dnd-kit/sortable` | `^10.0.0` | Sortable preset — `SortableContext`, `useSortable`, `arrayMove`, `sortableKeyboardCoordinates`, `rectSortingStrategy` | Official preset from the same maintainer; required for sortable list semantics (peer-deps `@dnd-kit/core` ^6.3.0) [VERIFIED: npm 2026-05-04 — peerDependencies] |
| `@dnd-kit/utilities` | `^3.2.2` | `CSS` helper for transforming the sortable item style | Transitive dep of `@dnd-kit/core` AND `@dnd-kit/sortable` (so it'll be installed anyway); explicit listing makes the `import { CSS } from '@dnd-kit/utilities'` line in `SortableProfileWatchCard` resolvable without npm hoisting accidents [VERIFIED: npm 2026-05-04] |

**Bundle size:** ~1.06 MB unpacked for `@dnd-kit/core` + 234 KB for `@dnd-kit/sortable` + 88 KB for `@dnd-kit/utilities` + 21 KB for `@dnd-kit/accessibility` (transitive) = ~1.4 MB unpacked total [VERIFIED: `npm view @dnd-kit/core dist.unpackedSize`]. Minified+gzipped on the wire is much smaller (industry rule of thumb: ~10–15% of unpacked = ~140–200 KB gzipped). Bundlephobia could not be scraped during research; planner should verify exact gzip size before merge if size-budget-sensitive. [ASSUMED: 140–200 KB gzipped estimate based on typical compression ratio.] Acceptable for the v4.1 scope (single client island, only loaded when the wishlist tab is rendered for the owner).

### Supporting (already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react@19.2.4` | installed | `useOptimistic`, `useTransition` | Optimistic local order state; covers D-09 server-fail rollback |
| `sonner@^2.0.7` | installed | Error toast | `Couldn't save new order. Reverted.` per UI-SPEC copywriting contract |
| `zod@^4.3.6` | installed | Server Action input validation `.strict()` | Reject any payload key not in the schema (mass-assignment defense) |
| `drizzle-orm@^0.45.2` | installed | `sql.join` for CASE WHEN bulk update; `asc()` / `desc()` for ORDER BY | Bulk reorder UPDATE; new ORDER BY in `getWatchesByUser` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@dnd-kit/core` (legacy) | `@dnd-kit/react@0.4.0` (new arch) | New arch is 2 weeks old, 53 production projects, no maintainer roadmap statement (discussion #1842 has 0 maintainer replies). Don't bet a v4.1 ship on it. [CITED: github.com/clauderic/dnd-kit/discussions/1842] |
| `@dnd-kit/core` | `react-beautiful-dnd` | Deprecated by Atlassian; not maintained; no React 19 support. Reject. [CITED: react-beautiful-dnd is unmaintained per pkgpulse 2026 comparison] |
| `@dnd-kit/core` | `react-dnd` | More flexible but requires HTML5 + Touch backend wiring; significantly more boilerplate; weaker accessibility story. Heavier bundle. [CITED: pkgpulse comparison] |
| `@dnd-kit/core` | Pragmatic Drag and Drop (Atlassian) | Modern, accessible, smaller bundle. Strong contender — but newer (less Stack Overflow / blog corpus), and the project already has `@dnd-kit/core` as the locked default candidate per CONTEXT.md. Don't churn the discretion choice unless `@dnd-kit/core` blocks. [CITED: pkgpulse blog "dnd-kit vs react-beautiful-dnd vs Pragmatic DnD 2026"] |
| Single `PointerSensor` with one delay | Separate `MouseSensor + TouchSensor` | Activation constraints are mutually exclusive on a single sensor. The mobile-vs-desktop differential (250ms vs 150ms) REQUIRES two separate sensors. [VERIFIED: dnd-kit official docs — "These activation constraints are mutually exclusive and may not be used simultaneously"] |
| Lexorank-style midpoint positioning | Whole-list bulk UPDATE | At <50 items per user, bulk UPDATE is fine and avoids float-collision rebalancing. CONTEXT D-09 locks this. |
| N individual UPDATE statements in a transaction | Single `UPDATE ... CASE WHEN` | Single round-trip is faster, simpler error path, matches Drizzle's `update-many-with-different-value` recipe. [CITED: orm.drizzle.team/docs/guides/update-many-with-different-value] |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Version verification (verified 2026-05-04 via `npm view`):**
- `@dnd-kit/core@6.3.1` — published 2025-05 (~1 year old). Peer-deps: `react >=16.8.0`, `react-dom >=16.8.0` — formally allows React 19. Latest `next` tag (`6.3.1-next-202411517925`) confirms no v6.4 stable yet.
- `@dnd-kit/sortable@10.0.0` — published 2025-04 (~1 year old). Peer-deps: `react >=16.8.0`, `@dnd-kit/core ^6.3.0`.
- `@dnd-kit/utilities@3.2.2` — published 2024 (~1.5 years old). Peer-deps: `react >=16.8.0`.

[ASSUMED: While the latest stable is a year old, the package is in maintenance mode rather than abandoned — the React 19 useRef-readonly type fix landed via PR #1971 in February 2026. The lack of a fresh version bump suggests new feature development moved to `@dnd-kit/react` 0.x while `@dnd-kit/core` receives type-only patches. Planner should re-check before final install in case a 6.3.2 lands with the React 19 type fix as a tagged release. As of 2026-05-04 the latest tag is still 6.3.1.]

## Architecture Patterns

### System Architecture Diagram

```
                     /u/[username]/wishlist/page.tsx (Server Component)
                                  │
                                  │ getWatchesByUser(userId)
                                  │   └─ ORDER BY sort_order ASC, created_at DESC
                                  │
                                  ▼
                        watches[] (with sort_order)
                                  │
                                  │ filter status === wishlist || grail
                                  │ pass isOwner=true
                                  │
                                  ▼
                  WishlistTabContent ('use client')  ◄── client island
                                  │
                                  │ if isOwner:
                                  │
                       ┌──────────┴──────────┐
                       ▼                     ▼
                  DndContext              isOwner=false
                  ├─ MouseSensor          render plain ProfileWatchCard list
                  │  (delay 150ms,        no DnD context, no overlay
                  │   tolerance 5px)
                  ├─ TouchSensor
                  │  (delay 250ms,
                  │   tolerance 8px)
                  └─ KeyboardSensor
                     (sortableKeyboardCoordinates)

                      SortableContext (rectSortingStrategy)
                      items = optimisticOrderedIds[]
                                  │
                                  │ for each id:
                                  ▼
                      SortableProfileWatchCard
                      ├─ useSortable({ id })
                      ├─ wraps ProfileWatchCard
                      └─ aria-label, aria-roledescription="sortable"

                      DragOverlay
                      └─ active item: scale-105 shadow-xl

                      onDragEnd(event):
                      ├─ arrayMove(items, oldIdx, newIdx) → newOrder
                      ├─ startTransition(() =>
                      │    setOptimistic(newOrder)
                      │    haptic: navigator.vibrate?.(10) (touch only — already fired on dragStart)
                      │    result = await reorderWishlist({ orderedIds: newOrder })
                      │    if !result.success:
                      │      toast.error("Couldn't save new order. Reverted.")
                      │      // useOptimistic rolls back automatically when transition ends
                      │  )

                                  ▼
            reorderWishlist Server Action ('use server')
            ├─ getCurrentUser() → user.id
            ├─ Zod schema.safeParse({ orderedIds: string[] }).strict()
            ├─ DAL.bulkReorderWishlist(user.id, orderedIds)
            │   ├─ Verify rows exist + belong to user (count check)
            │   ├─ Verify status ∈ {wishlist, grail}
            │   └─ UPDATE watches SET sort_order = CASE WHEN id=? THEN ? ... END
            │      WHERE user_id = ? AND id IN (?, ?, ...)
            ├─ revalidatePath('/u/[username]/wishlist')
            └─ return ActionResult<void>
```

### Recommended Project Structure

```
src/
├── components/profile/
│   ├── WishlistTabContent.tsx          # MODIFY: wrap in DndContext + SortableContext when isOwner
│   ├── CollectionTabContent.tsx        # MODIFY: grid-cols-2 only
│   ├── ProfileWatchCard.tsx            # MODIFY: status-driven price line, sizes attr, cursor-grab on hover
│   ├── SortableProfileWatchCard.tsx    # NEW: useSortable wrapper around ProfileWatchCard (owner-only render path)
│   └── WishlistTabContent.test.tsx     # MODIFY: extend coverage for owner DnD path + non-owner plain path
├── app/actions/
│   └── wishlist.ts                     # MODIFY: add reorderWishlist export
├── data/
│   └── watches.ts                      # MODIFY: add bulkReorderWishlist; modify getWatchesByUser ORDER BY
├── db/
│   └── schema.ts                       # MODIFY: add sortOrder column + (user_id, sort_order) index
drizzle/
└── 0006_phase27_sort_order.sql         # NEW: drizzle-generated local migration
supabase/migrations/
└── 20260504HHMMSS_phase27_sort_order.sql   # NEW: parallel prod migration (mirrors drizzle DDL + backfill)
```

### Pattern 1: useOptimistic + Server Action with Rollback

**What:** React 19 `useOptimistic` + `useTransition` + Server Action returning `ActionResult<T>`. On error, the optimistic state automatically reverts when the transition ends (because the new render reads server-truth). Sonner toast surfaces the error to the user.

**When to use:** Any owner-initiated mutation where instant feedback matters more than confirmed persistence. Project precedents: `PrivacyToggleRow.tsx`, `NoteVisibilityPill.tsx`, `NotificationRow.tsx`.

**Example:**
```typescript
// Source: src/components/profile/NoteVisibilityPill.tsx (project precedent)
//         + Next.js 16 docs node_modules/next/dist/docs/01-app/02-guides/forms.md (Optimistic updates section)
'use client'
import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'
import { reorderWishlist } from '@/app/actions/wishlist'

export function WishlistGrid({ initialIds }: { initialIds: string[] }) {
  // useOptimistic returns the optimistic value plus a setter that is only
  // valid inside a transition.
  const [optimisticIds, setOptimistic] = useOptimistic<string[], string[]>(
    initialIds,
    (_state, newOrder) => newOrder,
  )
  const [pending, startTransition] = useTransition()

  function handleDragEnd(newOrder: string[]) {
    startTransition(async () => {
      setOptimistic(newOrder)
      const result = await reorderWishlist({ orderedIds: newOrder })
      if (!result.success) {
        // Server-truth from revalidatePath rerender will snap optimisticIds back
        // to initialIds when the transition ends. Toast surfaces the error.
        toast.error("Couldn't save new order. Reverted.")
      }
    })
  }
  // ... DndContext + SortableContext using optimisticIds ...
}
```

### Pattern 2: dnd-kit Sortable on a 2-Column Grid

**What:** `DndContext` wraps a `SortableContext` keyed on the item id list (in render order). Each grid cell uses `useSortable({ id })` to get `setNodeRef`, `attributes`, `listeners`, `transform`, `transition`. A `DragOverlay` renders the floating card. `rectSortingStrategy` is the default, supports grids, but does NOT support virtualization (irrelevant at <50 items).

**When to use:** Any sortable grid with mixed-axis movement (left/right and up/down). For pure vertical lists, use `verticalListSortingStrategy` (it's more efficient + supports virtualization, neither relevant here).

**Example:**
```typescript
// Source: dnd-kit official docs (dndkit.com/legacy/presets/sortable/overview/)
//         adapted for Phase 27 constraints (MouseSensor 150ms, TouchSensor 250ms,
//         rectSortingStrategy for 2-col grid)
'use client'
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  DragOverlay,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { useState } from 'react'

const sensors = useSensors(
  // Two SEPARATE sensors — activation constraints are mutually exclusive on a
  // single sensor, and we need different delays for mouse vs. touch.
  useSensor(MouseSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  }),
  useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 8 },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  }),
)

const [activeId, setActiveId] = useState<string | null>(null)

return (
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragStart={(e: DragStartEvent) => {
      setActiveId(e.active.id as string)
      // Mobile haptic — TouchSensor onDragStart is the only entry point that
      // benefits from a tick. MouseSensor onDragStart can call this safely
      // (browsers ignore vibrate from non-touch contexts on most platforms).
      navigator.vibrate?.(10)
    }}
    onDragEnd={(e: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = e
      if (!over || active.id === over.id) return
      const oldIdx = optimisticIds.indexOf(active.id as string)
      const newIdx = optimisticIds.indexOf(over.id as string)
      handleDragEnd(arrayMove(optimisticIds, oldIdx, newIdx))
    }}
  >
    <SortableContext items={optimisticIds} strategy={rectSortingStrategy}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {optimisticIds.map((id) => (
          <SortableProfileWatchCard key={id} id={id} watch={watchesById[id]} />
        ))}
        {/* AddWatchCard is OUTSIDE SortableContext.items — not draggable */}
        <AddWatchCard variant="wishlist" />
      </div>
    </SortableContext>
    <DragOverlay>
      {activeId ? <ProfileWatchCard watch={watchesById[activeId]} /* presentational */ /> : null}
    </DragOverlay>
  </DndContext>
)
```

### Pattern 3: useSortable wrapper component

**What:** A presentational `ProfileWatchCard` is wrapped by `SortableProfileWatchCard` which calls `useSortable({ id })` and applies the transform/listeners. Allows the SAME `ProfileWatchCard` to render plain (for non-owners) and sortable (for owners) without prop drilling.

**Why split:** dnd-kit docs explicitly recommend "create a presentational version of your component that you intend on rendering in the drag overlay, and another version that is sortable." Prevents ID collisions in the DOM.

**Example:**
```typescript
// Source: src/components/profile/SortableProfileWatchCard.tsx (NEW)
'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ProfileWatchCard } from './ProfileWatchCard'
import type { Watch } from '@/lib/types'

interface Props {
  id: string
  watch: Watch
  lastWornDate: string | null
  showWishlistMeta: boolean
}

export function SortableProfileWatchCard({ id, watch, lastWornDate, showWishlistMeta }: Props) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Source-card opacity reduction during active drag — locked in UI-SPEC
    opacity: isDragging ? 0.3 : 1,
    // touch-action: manipulation prevents iOS Safari scroll-fight during long-press
    touchAction: 'manipulation',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-roledescription="sortable"
      aria-label={`Reorder ${watch.brand} ${watch.model}. Press and hold to drag, or focus and press space to pick up with keyboard.`}
      className="cursor-grab active:cursor-grabbing"
    >
      <ProfileWatchCard
        watch={watch}
        lastWornDate={lastWornDate}
        showWishlistMeta={showWishlistMeta}
      />
    </div>
  )
}
```

**Critical note about the wrapping `<Link>`:** Today `ProfileWatchCard` wraps everything in a `<Link>`. The drag listeners attached to a `<div>` wrapping the `<Link>` will receive pointer events first; the `delay`-based activation means a mousedown that releases before 150ms still propagates to the `<Link>` for navigation [VERIFIED: dnd-kit PointerSensor docs — "delay constraint" semantics]. After 150/250ms hold, the sensor fires `onDragStart` which calls `event.preventDefault()` to suppress click-through. **Planner verification step:** wire a real test (or manual check) that a quick tap navigates and a long-press drags — the dnd-kit docs are not 100% explicit on whether `event.preventDefault()` on the underlying mousedown is enough to suppress the wrapped `<Link>`'s click. If it isn't, the planner may need to (a) listen for `pointerdown` and call `preventDefault()` on the wrapped link, or (b) split `ProfileWatchCard` so the sortable wrapper renders its own `<Link>` and the existing `<Link>` is removed when sortable.

### Pattern 4: Server Action for bulk reorder

**What:** Standard `ActionResult<void>` server action. Zod `.strict()` to reject extra keys. `getCurrentUser()` for auth. Owner-only enforcement at TWO layers: (1) Zod payload doesn't accept `userId` — it comes from session; (2) the SQL `WHERE user_id = ?` ensures even a forged id list can't reorder another user's watches.

**Defense-in-depth: count check.** After the bulk UPDATE, verify the affected row count equals the input length. If smaller, the input contained ids that don't belong to this user (or don't exist) — this is an error condition, not a silent partial update.

**Example:**
```typescript
// Source: src/app/actions/wishlist.ts (extends existing file)
//         Pattern derived from src/app/actions/watches.ts:60 (addWatch)
//         + drizzle bulk-update pattern from
//         orm.drizzle.team/docs/guides/update-many-with-different-value
'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { bulkReorderWishlist } from '@/data/watches'
import type { ActionResult } from '@/lib/actionTypes'

const reorderSchema = z.object({
  // .strict() rejects mass-assignment of e.g. userId — owner is always session.
  orderedIds: z.array(z.string().uuid()).min(1).max(500),
}).strict()

export async function reorderWishlist(
  data: unknown,
): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  const parsed = reorderSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    await bulkReorderWishlist(user.id, parsed.data.orderedIds)
    revalidatePath(`/u/[username]/wishlist`, 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[reorderWishlist] unexpected error:', err)
    if (err instanceof Error && err.message.startsWith('Owner mismatch')) {
      return { success: false, error: 'Some watches do not belong to you.' }
    }
    return { success: false, error: "Couldn't save new order." }
  }
}
```

### Pattern 5: Bulk UPDATE via Drizzle CASE WHEN

**What:** Single round-trip UPDATE that sets `sort_order` to a different value per row, scoped by user. Uses Drizzle's `sql.join()` builder.

**Owner-only enforcement:** WHERE clause includes `eq(watches.userId, userId)`, so even if the input contains foreign ids the UPDATE will not affect them. The post-update count check catches that case and throws.

**Status guard:** WHERE clause optionally also includes `inArray(watches.status, ['wishlist', 'grail'])` — defends against the user trying to reorder owned/sold watches via this action. (Owned/sold reorder UX is deferred per CONTEXT `<deferred>`; the action signature should match that scope.)

**Example:**
```typescript
// Source: src/data/watches.ts (extends existing DAL)
//         Pattern from orm.drizzle.team/docs/guides/update-many-with-different-value
import 'server-only'
import { db } from '@/db'
import { watches } from '@/db/schema'
import { eq, and, inArray, sql, type SQL } from 'drizzle-orm'

export async function bulkReorderWishlist(
  userId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return

  // Build CASE WHEN chunks
  const chunks: SQL[] = [sql`(case`]
  orderedIds.forEach((id, idx) => {
    chunks.push(sql`when ${watches.id} = ${id} then ${idx}`)
  })
  chunks.push(sql`end)`)
  const caseExpr = sql.join(chunks, sql.raw(' '))

  const updated = await db
    .update(watches)
    .set({ sortOrder: caseExpr, updatedAt: new Date() })
    .where(
      and(
        eq(watches.userId, userId),
        inArray(watches.id, orderedIds),
        inArray(watches.status, ['wishlist', 'grail']),
      ),
    )
    .returning({ id: watches.id })

  // Defense-in-depth: count check. If fewer rows updated than input ids,
  // some ids were not owned by this user OR not in the wishlist+grail
  // status set. Throw — Server Action maps to ActionResult<void> error.
  if (updated.length !== orderedIds.length) {
    throw new Error(
      `Owner mismatch: expected ${orderedIds.length} rows, updated ${updated.length}`,
    )
  }
}
```

### Pattern 6: Read-path ORDER BY change

**What:** `getWatchesByUser` adds `.orderBy(asc(watches.sortOrder), desc(watches.createdAt))`. Tiebreaker on `createdAt DESC` defends against any rows that share `sort_order` (post-migration there shouldn't be ties, but it's a one-line safety net).

**Why no NULLS LAST:** Per D-01, `sort_order` defaults to 0 (no `NOT NULL` constraint), so the column will never be NULL after the backfill. Adding `nulls last` is unnecessary noise. If the planner wants belt-and-suspenders, `.orderBy(sql\`${watches.sortOrder} ASC NULLS LAST, ${watches.createdAt} DESC\`)` is the syntax [CITED: drizzle docs / answeroverflow.com/m/1295796205187502100].

**Example:**
```typescript
// Source: src/data/watches.ts:91 (modify existing getWatchesByUser)
//         Drizzle ORDER BY pattern from src/data/wearEvents.ts:88, 376
//         + drizzle docs orm.drizzle.team/docs/select
import { eq, and, asc, desc } from 'drizzle-orm'

export async function getWatchesByUser(userId: string): Promise<Watch[]> {
  const rows = await db
    .select()
    .from(watches)
    .where(eq(watches.userId, userId))
    .orderBy(asc(watches.sortOrder), desc(watches.createdAt))
  return rows.map(mapRowToWatch)
}
```

### Pattern 7: Schema migration (drizzle + supabase parallel)

**What:** Per the project memory landmine `project_drizzle_supabase_db_mismatch.md`, schema changes require BOTH a drizzle-side migration (for local dev `drizzle-kit push`) AND a parallel `supabase/migrations/2026...sql` file (for prod `supabase db push --linked`). Existing precedent: Phase 19.1 — `drizzle/0005_phase19_1_taste_columns.sql` paired with `supabase/migrations/20260429000000_phase19_1_drizzle_taste_columns.sql`.

**Drizzle workflow:**
1. Add the column to `src/db/schema.ts`:
   ```typescript
   sortOrder: integer('sort_order').notNull().default(0),
   ```
   Plus to the indexes array:
   ```typescript
   index('watches_user_sort_idx').on(table.userId, table.sortOrder),
   ```
2. Run `npx drizzle-kit generate` (or `drizzle-kit push` for local-only). Drizzle emits `drizzle/0006_phase27_sort_order.sql`.

**Supabase workflow (mirror for prod):**
1. Create `supabase/migrations/20260504HHMMSS_phase27_sort_order.sql`. Filename pattern is `YYYYMMDDHHmmss_short_description.sql` [CITED: supabase docs/guides/getting-started/ai-prompts/database-create-migration].
2. Mirror the drizzle DDL with `IF NOT EXISTS` for idempotency (so local re-applies are no-ops):
   ```sql
   ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;
   CREATE INDEX IF NOT EXISTS "watches_user_sort_idx" ON "watches" (user_id, sort_order);

   -- Per-user backfill: assign 0..N to each user's wishlist+grail rows
   -- in createdAt DESC order (newest = sort_order 0, matches current display).
   WITH ranked AS (
     SELECT id,
            row_number() OVER (
              PARTITION BY user_id
              ORDER BY created_at DESC
            ) - 1 AS rn
       FROM watches
      WHERE status IN ('wishlist', 'grail')
   )
   UPDATE watches
      SET sort_order = ranked.rn
     FROM ranked
    WHERE watches.id = ranked.id;
   ```
3. `supabase db push --linked` deploys to prod.

**Sequencing nuance:** For prod, apply the supabase migration FIRST so the column exists when Drizzle's narrower schema tries to query it. For local, drizzle-kit push covers it. (Phase 24 migration's header makes this same point in reverse for ENUM cleanups.)

### Anti-Patterns to Avoid

- **`'use client'` on the page-level component to enable DnD.** The page is a Server Component (loads watches via DAL). Push `'use client'` only into the smallest leaf — `WishlistTabContent` is already client. Don't escalate.
- **Re-sorting in the client after the DAL returns ordered rows.** The DAL ORDER BY is the single source of truth. Client only optimistically reorders during a drag.
- **Client-trusted `userId` in the Server Action payload.** Always read from `getCurrentUser()`. Zod `.strict()` defense + omitting `userId` from the schema closes the door.
- **Custom long-press detection with timers + manual `pointerdown` listeners.** This is the "Don't Hand-Roll" trap. dnd-kit's `activationConstraint: { delay, tolerance }` handles cancellation on movement, click vs. drag disambiguation, and accessibility — and is heavily battle-tested.
- **Single `PointerSensor` for both desktop and mobile.** Activation constraints are mutually exclusive — you'd be forced to pick one delay. Use `MouseSensor + TouchSensor` separately.
- **Re-implementing keyboard reorder accessibility.** dnd-kit's `KeyboardSensor` + `sortableKeyboardCoordinates` provides space-to-pick-up, arrow-to-move, space-to-drop, escape-to-cancel out of the box. Don't roll your own — accessibility is the #1 hand-roll trap in this domain.
- **`PointerSensor` instead of `MouseSensor + TouchSensor`.** Per dnd-kit docs: "If the above recommendations are not suitable for your use-case, we recommend that you use both the Mouse and Touch sensors instead, as Touch events do not suffer the same limitations as Pointer events." [CITED: dndkit.com/api-documentation/sensors/pointer]
- **Skipping `touch-action: manipulation` on the draggable wrapper.** iOS Safari will scroll-fight a long-press without it. dnd-kit docs explicitly call this out [CITED: dndkit.com/api-documentation/sensors/touch].
- **Animating opacity OR transform via Tailwind on the source card during drag.** dnd-kit's `useSortable` already returns `transform` and `transition` — apply via inline `style`, not Tailwind, or the Tailwind transitions will fight the dnd-kit ones.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Press-and-hold gesture detection (delay + tolerance + cancellation on movement) | `useEffect` + `setTimeout` + `pointermove` listener | `MouseSensor` / `TouchSensor` `activationConstraint: { delay, tolerance }` | Edge cases: scroll cancellation, multi-touch, pointer capture loss, click-vs-drag disambiguation. dnd-kit handles all of them. |
| Sortable list with keyboard accessibility | Custom `aria-grabbed` + key handlers | `KeyboardSensor` + `sortableKeyboardCoordinates` | Screen reader announcements, focus management, keyboard-only reorder. ~hundreds of lines of accessibility code you won't get right. |
| Drag overlay (the floating card under the cursor) | Manual `position: fixed` + cursor tracking | `<DragOverlay>` from `@dnd-kit/core` | Coordinate transforms across scroll containers, drop animations, RTL handling. |
| Bulk UPDATE of N rows with different per-row values in a single round-trip | `for (const id of ids) await db.update(...)` (N round-trips) | `sql.join()` building `CASE WHEN` | N round-trips at <50 items isn't catastrophic but is the wrong pattern; CASE WHEN is the recipe Drizzle docs recommend. [CITED: orm.drizzle.team/docs/guides/update-many-with-different-value] |
| Optimistic UI with rollback on server error | Manual `useState` + setState on error | `useOptimistic` + `useTransition` | React 19 native primitive; rollback is automatic when transition resolves; integrates cleanly with Server Actions. Project precedent in 3 components. |
| Per-user backfill with ROW_NUMBER ranking | Application-level loop reading + writing rows | Postgres `WITH ranked AS (SELECT row_number() OVER ...) UPDATE FROM ranked` | Single SQL statement, atomic, no race conditions, ~10x faster on cold start. |

**Key insight:** Drag-and-drop UX is a domain where the right library saves weeks of pain. The cost of `@dnd-kit/core` (~200 KB gzipped, dependency on a ~year-old release) is far smaller than the cost of getting touch + keyboard + accessibility wrong. The CONTEXT-locked default `@dnd-kit/core` is the correct call.

## Runtime State Inventory

> Phase 27 IS partly a schema/data migration phase (adding `sort_order` + per-user backfill). Inventory required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `watches` table — every row gets a new `sort_order` column. Backfill writes 0..N for each user's wishlist+grail rows in createdAt DESC order. Owned/sold rows get default 0 (or per-user backfill — D-02 says either is acceptable). | Data migration: per-user `WITH ranked AS (... ROW_NUMBER() ...) UPDATE FROM ranked`. Code edit: read path adds ORDER BY; write paths (addWatch, editWatch on status change) assign `max(sort_order) + 1` per D-03 / D-04. |
| Live service config | None — Horlo has no external services storing watch identifiers by id+sort. | None. |
| OS-registered state | None — no scheduled tasks, no pm2, no systemd. | None — verified by absence of any task-scheduler files in repo. |
| Secrets / env vars | None — `sort_order` is not a configured value. | None. |
| Build artifacts / installed packages | New npm deps add to `package-lock.json`. The drizzle-generated `drizzle/0006_phase27_sort_order.sql` is checked in. The `supabase/migrations/2026...sql` file is checked in. | Standard install + commit; no stale artifacts to clean. |

**The canonical question:** *After every file in the repo is updated, what runtime systems still have the old data?* Answer: only the production database, which is updated by `supabase db push --linked` running the parallel SQL migration. The drizzle-side migration runs against local Postgres only.

## Common Pitfalls

### Pitfall 1: drizzle-kit push hits prod DB by accident
**What goes wrong:** Running `drizzle-kit push` against a `DATABASE_URL` pointing at production silently rewrites the prod schema without the supabase migration audit trail.
**Why it happens:** Drizzle's `defineConfig` reads `process.env.DATABASE_URL` from `.env.local`; if the wrong URL is set, push goes to the wrong place.
**How to avoid:** Project memory `project_drizzle_supabase_db_mismatch.md` is binding: `drizzle-kit push` is LOCAL ONLY. Prod is `supabase db push --linked` against the parallel `supabase/migrations/...sql` file. Plan the migration as TWO files (drizzle + supabase) from the start.
**Warning signs:** A schema change shows up in prod without an entry in `supabase/migrations/`.

### Pitfall 2: Click-through navigation fires on a drag attempt
**What goes wrong:** User starts to drag, releases just before the 150ms threshold, and is navigated to `/watch/[id]` instead of seeing nothing happen. Or user drags successfully and `onDragEnd` fires correctly but a click ALSO fires from the wrapped `<Link>`.
**Why it happens:** dnd-kit calls `event.preventDefault()` on the activating pointer event, but if the `<Link>`'s click listener is BELOW the dnd listeners (e.g., wrapped INSIDE the sortable div), the click can still propagate. The interaction depends on event ordering and how the link is wired.
**How to avoid:** Test BOTH paths explicitly: tap should navigate; long-press-and-release-without-moving should land on `onDragEnd` with `over === active` (a drag with no target) and not navigate. If click-through is observed, options: (a) move the `<Link>` INSIDE `ProfileWatchCard` and stop wrapping `SortableProfileWatchCard` in another link; (b) listen for `pointerdown` and call `e.stopPropagation()` after the activation threshold elapses.
**Warning signs:** Mobile users report "I tried to drag and it just opened the watch detail."

### Pitfall 3: iOS Safari scroll-fights long-press
**What goes wrong:** User long-presses a card on iPhone; instead of initiating drag, the page starts scrolling.
**Why it happens:** Default touch behavior treats a held finger as a scroll gesture. Without `touch-action: manipulation` or `none` on the draggable element, Safari will reclaim the touch as scroll.
**How to avoid:** Add `style={{ touchAction: 'manipulation' }}` to `SortableProfileWatchCard`'s outer div. dnd-kit docs explicitly call this out as required for `TouchSensor`. Test on a real iOS device (not just Chrome desktop responsive mode).
**Warning signs:** Drag works on Android but not iOS; works in desktop responsive mode but not on real device.

### Pitfall 4: Backfill overwrites existing intentional order
**What goes wrong:** A user reorders their wishlist via drag, then a second migration / re-run of the backfill SQL re-assigns `sort_order` 0..N in createdAt DESC order, wiping their curated order.
**Why it happens:** Backfill scripts that don't gate on "is this the first time" can run twice.
**How to avoid:** The backfill SQL is part of the prod migration (`20260504HHMMSS_phase27_sort_order.sql`) which Supabase records as applied. It only runs once. If a re-backfill is ever needed (e.g., after a rollback), it MUST be a separate, named migration with explicit operator awareness — not a re-run of this one.
**Warning signs:** Users report their wishlist order changed after a deploy.

### Pitfall 5: Bulk UPDATE silently does nothing
**What goes wrong:** The CASE WHEN UPDATE runs, the WHERE clause filters out everything, and 0 rows are updated. Server Action returns success. User's reorder is lost.
**Why it happens:** A typo'd `eq(watches.userId, userId)` (e.g., passing `user.email` by mistake), a status filter excluding 'grail', or the orderedIds containing watch IDs that don't exist.
**How to avoid:** The post-update count check (`updated.length !== orderedIds.length`) catches this and throws. Server Action returns `ActionResult.failure`, optimistic state rolls back, Sonner shows error.
**Warning signs:** Reorder appears to succeed but refresh shows old order.

### Pitfall 6: marketPrice fallback masks honest "we don't know" state
**What goes wrong:** A wishlist watch has neither `targetPrice` (user hasn't set one) nor `marketPrice` (no Watch Charts integration in v4.1) but appears with a stale or misleading number.
**Why it happens:** marketPrice is currently set during URL-extraction in some paths and may be from a brand site (retail/MSRP) rather than secondary market — the label "Market" is not 100% accurate.
**How to avoid:** D-17 says "if both null, hide the line entirely." NEVER show "$0" or "Market: —". CONTEXT `<deferred>` already flags retail-vs-market disambiguation as a v5+ schema concern; v4.1 just uses "Market" as the honest fallback label. Verify the price-line render logic explicitly tests the both-null branch.
**Warning signs:** Watches with no price info show a price line.

### Pitfall 7: Status transition forgets to bump sort_order
**What goes wrong:** User moves a watch from owned → wishlist via the edit form. Watch lands somewhere in the middle of the wishlist (with sort_order 0 or its old value), not at the end.
**Why it happens:** D-04 says status transitions reset `sort_order` to `max + 1` for the destination group. If `editWatch` doesn't implement this, the watch keeps its old sort_order.
**How to avoid:** Add a status-change branch to `editWatch` (in `src/app/actions/watches.ts`) and to `addWatch`: when status changes (or new watch is wishlist/grail), look up `max(sort_order)` for that user's wishlist+grail set and assign `+1`. This is a separate query from the main update — wrap in a transaction to avoid a race with concurrent reorders.
**Warning signs:** A status-toggled watch appears in the middle of the wishlist instead of the bottom.

### Pitfall 8: Two-tab last-write-wins eats reorders
**What goes wrong:** User has two tabs open. Tab A reorders to [b, a, c]; Tab B (which still shows [a, b, c]) reorders to [c, b, a]. Tab A's reorder is lost.
**Why it happens:** Both server actions overwrite the same column with their full ordered set.
**How to avoid:** This is acceptable per CONTEXT D-09 ("Cross-device sync semantics — two-tab last-write-wins is acceptable"). Document it in the plan. Don't over-engineer with version columns / OCC at this scale.
**Warning signs:** Power user reports their reorder "didn't stick" after using a second device.

### Pitfall 9: useOptimistic doesn't roll back as expected
**What goes wrong:** Server fails, toast shows, but the optimistic state stays — user sees the new order even though the server rejected it.
**Why it happens:** `useOptimistic` rolls back to the parent's last-rendered initial value when the transition resolves. If the parent doesn't re-render (e.g., because `revalidatePath` wasn't called on the failure path), the rollback never lands. OR: if the order is held in `useState` somewhere BELOW the optimistic boundary, that state isn't reset.
**How to avoid:** Hold `initialIds` as a `prop` derived from the server-rendered watches list. The Server Action's failure path returns `ActionResult.failure` WITHOUT calling `revalidatePath` — the transition resolves, useOptimistic's reducer is no longer applied, and the rendered list reverts to `initialIds`. Test this explicitly: simulate server failure, confirm UI reverts.
**Warning signs:** Sonner error fires but the cards don't snap back.

### Pitfall 10: dnd-kit + React 19 strict-mode double-mount type warnings
**What goes wrong:** React 19 strict mode + dnd-kit emits a TypeScript or runtime warning about `useRef` readonly types or double-mount sensor registration.
**Why it happens:** `@dnd-kit/core@6.3.1` was published before React 19 and the `useRef` type fix landed in PR #1971 (Feb 2026); the latest published `dist-tag latest` may or may not include it.
**How to avoid:** [ASSUMED] If TypeScript complains, the planner can pin a slightly newer version via `npm view @dnd-kit/core versions --json` and check for a 6.3.x patch. If the warning is runtime (dev only), it's safe to ignore for v4.1. Confirmed working at the type level on React 19 — this is a developer-experience pitfall, not a correctness one.
**Warning signs:** TypeScript build error mentioning `useRef<...>` readonly; React strict-mode console warnings about effect double-firing.

## Code Examples

### Schema migration (drizzle side)

```typescript
// Source: src/db/schema.ts (modify watches table)
export const watches = pgTable(
  'watches',
  {
    // ... existing columns ...
    sortOrder: integer('sort_order').notNull().default(0), // NEW
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('watches_user_id_idx').on(table.userId),
    index('watches_catalog_id_idx').on(table.catalogId),
    index('watches_user_sort_idx').on(table.userId, table.sortOrder), // NEW
  ],
)
```

### Schema migration (supabase side, parallel)

```sql
-- Source: supabase/migrations/20260504HHMMSS_phase27_sort_order.sql
-- Mirrors drizzle/00XX_phase27_sort_order.sql for prod deploy via
-- supabase db push --linked. IF NOT EXISTS guards make local re-apply a no-op
-- (matches Phase 19.1 precedent at 20260429000000_phase19_1_drizzle_taste_columns.sql).

BEGIN;

ALTER TABLE "watches"
  ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "watches_user_sort_idx"
  ON "watches" (user_id, sort_order);

-- Per-user backfill: assign 0..N to each user's wishlist+grail rows in
-- created_at DESC order (newest watch = sort_order 0, matches current display
-- order so no visible change post-deploy).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id
           ORDER BY created_at DESC
         ) - 1 AS rn
    FROM watches
   WHERE status IN ('wishlist', 'grail')
)
UPDATE watches
   SET sort_order = ranked.rn
  FROM ranked
 WHERE watches.id = ranked.id;

-- Post-migration assertion (Phase 11 / Phase 24 precedent).
DO $$
DECLARE
  dup_users int;
BEGIN
  -- Verify no user has duplicate sort_order in their wishlist+grail set
  -- (post-backfill there should be no ties).
  SELECT count(*) INTO dup_users
    FROM (
      SELECT user_id, sort_order, count(*) c
        FROM watches
       WHERE status IN ('wishlist', 'grail')
       GROUP BY user_id, sort_order
       HAVING count(*) > 1
    ) t;

  IF dup_users > 0 THEN
    RAISE EXCEPTION 'Phase 27 post-check: % (user_id, sort_order) duplicates in wishlist+grail backfill', dup_users;
  END IF;
END $$;

COMMIT;
```

### Status-driven price line (replaces existing wishlist-only block)

```typescript
// Source: src/components/profile/ProfileWatchCard.tsx (replace lines 85-89)
//         Per CONTEXT D-15 → D-21
const priceLine = (() => {
  const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'
  const primary = isWishlistLike ? watch.targetPrice : watch.pricePaid
  const primaryLabel = isWishlistLike ? 'Target' : 'Paid'
  if (primary != null) return `${primaryLabel}: $${primary.toLocaleString()}`
  if (watch.marketPrice != null) return `Market: $${watch.marketPrice.toLocaleString()}`
  return null
})()

// Then in JSX, replace the existing showWishlistMeta && watch.targetPrice block:
{priceLine && (
  <p className="mt-1 text-xs font-normal text-foreground">
    {priceLine}
  </p>
)}
```

### Image sizes update

```typescript
// Source: src/components/profile/ProfileWatchCard.tsx line 50
// Per D-13 — change from:
sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
// to:
sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
```

[VERIFIED: Next.js 16 Image API docs at `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` line 199-231 — `sizes` semantics unchanged from v15. Multiple comma-separated `(media-query) value` entries; the LAST entry has no media query and is the default.]

### addWatch / editWatch sort_order assignment (D-03, D-04)

```typescript
// Source: src/data/watches.ts (NEW helper) + src/app/actions/watches.ts (call site)
// Per D-03 (new wishlist add) and D-04 (status transition into wishlist+grail)

// In src/data/watches.ts:
import 'server-only'
import { db } from '@/db'
import { watches } from '@/db/schema'
import { eq, and, inArray, sql } from 'drizzle-orm'

export async function getMaxWishlistSortOrder(userId: string): Promise<number> {
  const rows = await db
    .select({ maxSort: sql<number>`coalesce(max(${watches.sortOrder}), -1)::int` })
    .from(watches)
    .where(
      and(
        eq(watches.userId, userId),
        inArray(watches.status, ['wishlist', 'grail']),
      ),
    )
  return rows[0]?.maxSort ?? -1
}

// In src/app/actions/watches.ts addWatch:
//   if (parsed.data.status === 'wishlist' || parsed.data.status === 'grail') {
//     const maxSort = await getMaxWishlistSortOrder(user.id)
//     parsedWithSort = { ...parsed.data, sortOrder: maxSort + 1 }
//   }
//
// In editWatch on status transition INTO wishlist/grail:
//   if (newStatus is 'wishlist' or 'grail' AND oldStatus was not):
//     bump sort_order to max + 1
//
// In editWatch on status transition OUT of wishlist/grail:
//   no action — leave sort_order in place (D-04 implies destination resets, not source)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-beautiful-dnd` (Atlassian) | `@dnd-kit/core` or `Pragmatic Drag and Drop` | rbd deprecated 2023; dnd-kit became default 2023-2024 | Phase 27 picks dnd-kit per CONTEXT default and ecosystem dominance |
| Bulk UPDATE via N round-trips in transaction | Single UPDATE with `CASE WHEN` via `sql.join` | Drizzle 0.30+ codified this in docs | Phase 27 uses CASE WHEN (drizzle 0.45 in repo) |
| `useState` + manual rollback | `useOptimistic` + `useTransition` | React 19 stable (Dec 2024) | Phase 27 uses `useOptimistic` (3 project precedents) |
| `pages/api/...` route handler with custom auth | Server Action with `'use server'` + `getCurrentUser()` | Next.js 14 stable; Next.js 16 unchanged | Phase 27 uses Server Action (codebase pattern) |
| `router.refresh()` after mutation | `revalidatePath` in Server Action OR `refresh()` from `next/cache` | Next.js 16 added `refresh()` from `next/cache` for client-side refresh | Phase 27 uses `revalidatePath` (server-side, matches existing pattern) |

**Deprecated/outdated:**
- `react-beautiful-dnd` — abandoned by Atlassian; do not use.
- `react-dnd` — still maintained but heavier and less accessible than dnd-kit.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@dnd-kit/core` 6.3.1 minified+gzipped wire size is ~140–200 KB | Standard Stack §bundle size | Bundle audit may reveal a larger payload; planner can verify via Bundlephobia or webpack-bundle-analyzer if size-budget-sensitive. |
| A2 | The latest published 6.3.1 release of `@dnd-kit/core` includes the React 19 useRef readonly type fix from PR #1971 | Pitfall 10 | If the fix landed only on the new `@dnd-kit/react` package, planner may see TypeScript build warnings on React 19. Workaround: `// @ts-expect-error` or upgrade-and-retry. |
| A3 | The `<Link>` wrapping inside `ProfileWatchCard` interacts cleanly with dnd-kit's `event.preventDefault()` so click-through navigation is suppressed during a successful drag but allowed for a quick tap | Pattern 3 + Pitfall 2 | If click-through fires alongside drag, the planner needs to restructure `ProfileWatchCard` to NOT auto-wrap in a `<Link>`, or handle pointerdown explicitly. Plan should include a "verify no click-through" step. |
| A4 | `navigator.vibrate?.(10)` on `onDragStart` is safe to call regardless of pointer type — non-touch contexts ignore it | Pattern 2 / UI-SPEC haptic feedback | If a desktop browser vibrates the host machine (none currently do), users would be surprised. Industry consensus: `vibrate` is no-op on non-mobile; safe. |
| A5 | dnd-kit's `KeyboardSensor` + `sortableKeyboardCoordinates` handles 2-column grid arrow keys (left/right + up/down) without custom coordinate logic | Standard Stack §sensors + Pattern 2 | Docs confirm "supports grids" for the sortable preset but don't fully spec arrow-key behavior in a 2-col layout. Planner should manually verify keyboard reorder feels right; if not, custom `coordinateGetter` is the escape hatch. |
| A6 | Two-tab last-write-wins reorder is acceptable to the user and doesn't need OCC / version-column conflict resolution | Pitfall 8 | CONTEXT D-09 explicitly says this is acceptable. Re-confirmed against locked decisions; not assumed. **Removed from risk** — this is now [VERIFIED: CONTEXT.md D-09]. |

## Open Questions

1. **Bundle size at the wire**
   - What we know: ~1.4 MB unpacked across all dnd-kit packages. Industry rule of thumb suggests 140–200 KB gzipped, but unverified.
   - What's unclear: Real-world gzipped size when shipping only `DndContext`, `MouseSensor`, `TouchSensor`, `KeyboardSensor`, `DragOverlay`, `SortableContext`, `useSortable`, `arrayMove`, `rectSortingStrategy`, `sortableKeyboardCoordinates`, `CSS`. Tree-shaking may reduce this significantly.
   - Recommendation: Planner can run `npx next build` after the install and check `.next/static/chunks/*` for the wishlist tab island size. If larger than budget, defer or move to dynamic import (`const DndContext = dynamic(...)`).

2. **Click-through vs. drag dispatch on the wrapped `<Link>`**
   - What we know: dnd-kit calls `event.preventDefault()` on the activating pointer event when the activation threshold elapses. A quick tap (below threshold) does NOT call preventDefault and the click bubbles.
   - What's unclear: Whether the existing `<Link>` wrapping ALL of `ProfileWatchCard` interferes with the dnd-kit listeners attached to `SortableProfileWatchCard`'s outer div. Specifically: does a successful drag still fire a click on the `<Link>` after `onDragEnd`?
   - Recommendation: Explicit test in Wave 0 (or first task) — manual + automated. If click-through fires alongside drag, restructure `ProfileWatchCard` so that the `<Link>` is rendered conditionally (not wrapped) when the parent is a `SortableProfileWatchCard`. Cleanest solution: factor `ProfileWatchCard` into `ProfileWatchCardInner` (no link) + `ProfileWatchCard` (wraps in link). The sortable wrapper renders `Inner`.

3. **AddWatchCard placement in the grid post-reorder**
   - What we know: D-12 says `AddWatchCard` continues to render as the final grid cell. UI-SPEC says it's NOT in `SortableContext.items`.
   - What's unclear: When `optimisticIds` array is reordered, where does `AddWatchCard` render? After the SortableContext children, presumably. But the grid-cols-2 layout means it could end up in a non-final visual position depending on item count parity.
   - Recommendation: Render `AddWatchCard` AFTER the `SortableContext` `children` in the JSX. It naturally lands in the last grid cell. If item count is odd, it sits to the right of the last sortable card; if even, it's on a new row. This matches today's behavior and is fine.

4. **Backfill order semantics for owned/sold watches**
   - What we know: D-02 says owned/sold can be backfilled the same way OR left at default. CONTEXT says "either is acceptable since Collection reorder UX is not in this phase."
   - What's unclear: The migration SQL above only backfills wishlist+grail. Should owned/sold also get a per-user createdAt-DESC ranking, since the column exists for them too?
   - Recommendation: Backfill owned+sold separately with the same ROW_NUMBER pattern (different PARTITION BY scope to ensure owned and sold share a sort_order space, OR each has its own — D-04 says "owned+sold are separate" so they could share). Simplest: backfill all rows with `ROW_NUMBER() OVER (PARTITION BY user_id, status ORDER BY created_at DESC)`. Costs nothing at this scale and leaves Collection-tab reorder ready to wire in a future phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Local dev + CI | ✓ | (npm 10.x in env) | — |
| Drizzle Kit | Generate migration | ✓ | 0.31.10 | — |
| Supabase CLI | Apply prod migration | ⚠ unverified | — | If absent, planner notes the prod-deploy step requires `supabase db push --linked` which assumes the CLI is installed on the deployer's machine. Standard Horlo deploy workflow already uses this CLI per project memory. |
| Postgres (local) | Drizzle push | ⚠ unverified | — | Standard Horlo local dev uses Supabase Docker. Assume present. |
| @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities | Phase 27 implementation | ✗ | — | INSTALL via `npm install`. No fallback needed (this is the chosen library). |
| iOS device (or BrowserStack) for real touch testing | Manual UAT for long-press gesture | ⚠ unverified | — | Without a real iOS device, `touch-action: manipulation` issues won't surface in Chrome desktop responsive mode. Plan should include a "test on real iOS Safari" UAT item. |

**Missing dependencies with no fallback:**
- None blocking — `@dnd-kit/*` packages are npm-installable.

**Missing dependencies with fallback:**
- iOS testing — fall back to Android Chrome + manual code review of `touch-action: manipulation`. Schedule iOS UAT post-deploy if no device available.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + @testing-library/react 16.3.2 + jsdom 25 |
| Config file | `vitest.config.ts` (existing, repo root) |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npm test` (runs `vitest run`) |

[VERIFIED: `package.json` "test": "vitest run", `package.json` devDependencies contain vitest, @testing-library/react, jsdom, msw]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WISH-01 | New `sort_order` column exists, NOT NULL, default 0, indexed (user_id, sort_order) | migration smoke | `npx vitest run src/db/__tests__/phase27-schema.test.ts` (NEW) — query `information_schema.columns` + `pg_indexes` against local DB | ❌ Wave 0 |
| WISH-01 | Backfill assigns sort_order 0..N per user for wishlist+grail rows in createdAt DESC order; no duplicates | data-shape | `npx vitest run src/db/__tests__/phase27-backfill.test.ts` (NEW) — seed 5 wishlist watches across 2 users with known createdAt, run migration, assert sort_order shape | ❌ Wave 0 |
| WISH-01 | `bulkReorderWishlist` enforces owner-only via WHERE clause + count-check | unit | `npx vitest run src/data/__tests__/watches-bulkReorder.test.ts` (NEW) — call with mixed-owner ids, expect throw "Owner mismatch" | ❌ Wave 0 |
| WISH-01 | `reorderWishlist` Server Action: rejects unauthenticated, rejects non-strict payload (extra keys), rejects non-uuid ids, rejects status ≠ wishlist/grail | unit | `npx vitest run src/app/actions/__tests__/reorderWishlist.test.ts` (NEW) — Zod safeParse + getCurrentUser mocking | ❌ Wave 0 |
| WISH-01 | `getWatchesByUser` returns wishlist watches in `sort_order ASC` then `createdAt DESC` | unit | `npx vitest run src/data/__tests__/watches-getWatchesByUser-orderBy.test.ts` (NEW) — seed 3 wishlist watches with explicit sort_order, assert array order | ❌ Wave 0 |
| WISH-01 | `WishlistTabContent` renders draggable cards (DndContext, SortableContext) for `isOwner=true`; renders plain cards for `isOwner=false` | component smoke | `npx vitest run src/components/profile/WishlistTabContent.test.tsx` (EXTEND existing) — assert presence of `aria-roledescription="sortable"` for owner; absence for non-owner | ✅ existing — extend |
| WISH-01 | Drag-and-drop happy-path: drag card 0 to position 2, server returns success, order persists after re-render | E2E (manual or Playwright) | Manual — drag, refresh page, assert new order. (No Playwright in repo; mark as manual UAT.) | manual UAT |
| WISH-01 | Drag-and-drop rollback: server returns failure, Sonner shows error, optimistic order reverts | unit (component) | `npx vitest run src/components/profile/WishlistTabContent.test.tsx` (EXTEND) — mock `reorderWishlist` to return `{success:false}`, dispatch synthetic dragEnd event, assert toast called + items reverted | ✅ existing — extend |
| VIS-07 | `WishlistTabContent` and `CollectionTabContent` render `grid-cols-2` on mobile | unit (component) | `npx vitest run src/components/profile/WishlistTabContent.test.tsx` `CollectionTabContent.test.tsx` — assert grid className includes `grid-cols-2` | ✅ existing for Wishlist; ❌ Wave 0 for Collection |
| VIS-08 | `ProfileWatchCard` renders `Paid: $X` for owned with pricePaid; `Target: $X` for wishlist with targetPrice; `Market: $X` fallback when primary null but marketPrice present; line absent when both null | unit (component) | `npx vitest run src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx` (NEW) — table-driven test across 8 status × price-presence combos | ❌ Wave 0 |
| VIS-08 | `ProfileWatchCard` Image `sizes` attribute equals `(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw` | unit (component) | (covered by VIS-08 component test above) — assert `<img sizes="...">` matches | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=dot src/components/profile src/data src/app/actions/wishlist.ts src/db` (focused — fast)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** `npm test` green; manual UAT of drag-and-drop on real mobile device + desktop browser before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/db/__tests__/phase27-schema.test.ts` — verify column + index exist post-migration (covers WISH-01 schema)
- [ ] `src/db/__tests__/phase27-backfill.test.ts` — verify backfill row-shape (covers WISH-01 backfill)
- [ ] `src/data/__tests__/watches-bulkReorder.test.ts` — owner-only enforcement (covers WISH-01 action layer)
- [ ] `src/app/actions/__tests__/reorderWishlist.test.ts` — Server Action surface (covers WISH-01 Zod + auth)
- [ ] `src/data/__tests__/watches-getWatchesByUser-orderBy.test.ts` — read-path order (covers WISH-01 ORDER BY)
- [ ] `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx` — price line rendering (covers VIS-08)
- [ ] `src/components/profile/CollectionTabContent.test.tsx` — grid-cols-2 assertion (covers VIS-07)
- [ ] Extend existing `src/components/profile/WishlistTabContent.test.tsx` — owner DnD vs. non-owner plain (covers WISH-01 + VIS-07)
- [ ] No framework install needed (Vitest + RTL already present)
- [ ] No new MSW handlers needed (Server Actions are mocked at the import level)

## Sources

### Primary (HIGH confidence)
- **Next.js 16 bundled docs** at `node_modules/next/dist/docs/01-app/` — verified Server Actions, useOptimistic forms guide, Image `sizes` semantics. Files: `01-getting-started/07-mutating-data.md`, `02-guides/forms.md`, `03-api-reference/02-components/image.md`.
- **dnd-kit official docs** at https://dndkit.com/api-documentation/sensors/{pointer,touch,keyboard} and https://dndkit.com/legacy/presets/sortable/overview/ — verified MouseSensor + TouchSensor split, activationConstraint mutual exclusivity, rectSortingStrategy for grids, KeyboardSensor coordinate getter pattern.
- **Drizzle ORM official docs** at https://orm.drizzle.team/docs/guides/update-many-with-different-value — verified CASE WHEN bulk update pattern with `sql.join()`.
- **Supabase migration docs** at https://supabase.com/docs/guides/getting-started/ai-prompts/database-create-migration — verified `YYYYMMDDHHmmss_short_description.sql` filename pattern.
- **npm registry** (via `npm view`) — verified `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2` versions, peer-dependencies, unpacked sizes (2026-05-04).
- **Codebase precedents** (verified by direct read):
  - `src/components/profile/NoteVisibilityPill.tsx` — useOptimistic + useTransition + ActionResult pattern
  - `src/components/notifications/NotificationRow.tsx` — useOptimistic shape
  - `src/components/settings/PrivacyToggleRow.tsx` — useOptimistic shape
  - `src/app/actions/watches.ts` — Server Action pattern (Zod, getCurrentUser, ActionResult, revalidatePath)
  - `src/app/actions/wishlist.ts` — closest analog file for the new `reorderWishlist` action
  - `src/data/wearEvents.ts` — Drizzle `orderBy(desc(...), desc(...))` pattern
  - `src/data/watches.ts` — DAL row mapping + WHERE-scoped UPDATE pattern
  - `supabase/migrations/20260429000000_phase19_1_drizzle_taste_columns.sql` — drizzle/supabase parallel migration pattern
  - `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` — DO $$ post-migration assertion pattern

### Secondary (MEDIUM confidence)
- **GitHub releases** at https://github.com/clauderic/dnd-kit/releases — useRef readonly type fix for React 19 compatibility (PR #1971). Date and exact dist-tag uncertain; planner should verify.
- **GitHub discussion #1842** at https://github.com/clauderic/dnd-kit/discussions/1842 — clarification on @dnd-kit/react vs @dnd-kit/core roadmap; 0 maintainer replies as of Nov 2025.
- **PkgPulse comparison** ("dnd-kit vs react-beautiful-dnd vs Pragmatic DnD 2026") — adoption stats: 2,496 production projects on `@dnd-kit/core` vs. 53 on `@dnd-kit/react`.
- **Drizzle answeroverflow** at https://www.answeroverflow.com/m/1295796205187502100 — `sql\`${col} ASC NULLS LAST\`` syntax variant.

### Tertiary (LOW confidence — flagged for validation)
- **Bundle size estimate** — ~140–200 KB gzipped is an industry-rule-of-thumb derived from unpacked size. Bundlephobia returned no data during research; planner should verify if size budget is constraining.
- **React 19 strict mode warnings on dnd-kit 6.3.1** — uncertain whether the latest published 6.3.1 includes the type-only fix. Planner should run `npm install && tsc --noEmit` and check for warnings.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Versions, peer-deps, unpacked sizes verified via `npm view`. React 19 compatibility verified at the API/peer-dep level; type-level uncertainty noted in Pitfall 10.
- Architecture patterns: HIGH — All patterns verified against either Next.js bundled docs (server actions, useOptimistic, sizes), dnd-kit official docs (sensors, sortable), or codebase precedents (3 useOptimistic components, 2 Server Action files, 2 migration files). Pattern 5 (CASE WHEN) verified against Drizzle official docs.
- Pitfalls: HIGH for items 1–9 (each backed by official docs or codebase observation); MEDIUM for item 10 (React 19 strict-mode behavior is the only remaining uncertainty).
- Validation Architecture: HIGH — test framework verified by direct package.json read; Wave 0 gap list derived directly from the requirement→test map.
- Open Questions: appropriately framed as planner-actionable — none of these block planning.

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (30 days — `@dnd-kit/core` is in maintenance mode and unlikely to ship a breaking change. Re-verify if a `@dnd-kit/react` 1.0 stable lands, which would shift the recommendation.)

# Phase 27: Watch Card & Collection Render Polish - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 13 (4 NEW source + 1 NEW drizzle + 1 NEW supabase + 7 NEW tests, 6 MODIFIED)
**Analogs found:** 13 / 13

All files have a strong, recent codebase analog. No "no analog found" entries — this is a polish/extend phase atop well-established patterns (Server Actions with `ActionResult`, Drizzle column-add migrations, useOptimistic + useTransition components, integration tests gated on `DATABASE_URL`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/profile/SortableProfileWatchCard.tsx` (NEW) | component (client) | event-driven (drag) | `src/components/profile/ProfileWatchCard.tsx` (presentational sibling) + `src/components/profile/NoteVisibilityPill.tsx` (use-hook + client wrapper shape) | role-match (no existing dnd-kit consumer in repo, but the wrapper-around-presentational pattern is well-established) |
| `drizzle/00XX_phase27_sort_order.sql` (NEW) | migration (drizzle) | batch (DDL) | `drizzle/0005_phase19_1_taste_columns.sql` | exact |
| `supabase/migrations/20260504HHMMSS_phase27_sort_order.sql` (NEW) | migration (supabase prod) | batch (DDL + backfill + assertion) | `supabase/migrations/20260429000000_phase19_1_drizzle_taste_columns.sql` (parallel-mirror precedent) + `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` (DO $$ post-migration assertion) | exact |
| `src/db/__tests__/phase27-schema.test.ts` (NEW Wave 0) | test (integration) | request-response (information_schema queries) | `tests/integration/phase11-schema.test.ts` | exact |
| `src/db/__tests__/phase27-backfill.test.ts` (NEW Wave 0) | test (integration) | request-response (seed + run + assert) | `tests/integration/phase17-backfill-idempotency.test.ts` | exact |
| `src/data/__tests__/watches-bulkReorder.test.ts` (NEW Wave 0) | test (unit, DAL) | request-response (DB mutation + count check) | `tests/integration/phase17-backfill-idempotency.test.ts` (DB-touching unit shape) | role-match |
| `src/data/__tests__/watches-getWatchesByUser-orderBy.test.ts` (NEW Wave 0) | test (unit, DAL) | request-response (read-path order assertion) | `tests/integration/phase11-schema.test.ts` (smoke pattern) + `src/data/wearEvents.ts:84-90` orderBy precedent | role-match |
| `src/app/actions/__tests__/reorderWishlist.test.ts` (NEW Wave 0) | test (unit, action surface) | request-response (Zod + auth mocking) | `src/components/profile/AddWatchCard.test.tsx` (vi.mock import-level pattern, lightest) — for action mocking pattern see `src/components/profile/WishlistTabContent.test.tsx` | role-match |
| `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx` (NEW Wave 0) | test (unit, component) | transform (props → JSX) | `src/components/profile/AddWatchCard.test.tsx` | exact |
| `src/components/profile/__tests__/CollectionTabContent.test.tsx` (NEW Wave 0) | test (unit, component) | transform (props → JSX) | `src/components/profile/WishlistTabContent.test.tsx` | exact |
| `src/db/schema.ts` (MODIFY) | model (drizzle schema) | n/a (column add) | `src/db/schema.ts` itself, lines 48–110 (existing watches table; add column + index in same `(table) =>` array) | exact |
| `src/data/watches.ts` (MODIFY: add `bulkReorderWishlist` + `getMaxWishlistSortOrder`; modify `getWatchesByUser`) | service (DAL) | CRUD | self (existing CRUD helpers in same file: `createWatch:164`, `updateWatch:187`, `linkWatchToCatalog:224`); read-path orderBy from `src/data/wearEvents.ts:84-90, 116` | exact |
| `src/app/actions/wishlist.ts` (MODIFY: add `reorderWishlist` export) | controller (Server Action) | request-response | `src/app/actions/wishlist.ts` itself (existing `addToWishlistFromWearEvent` action — Zod `.strict()`, `getCurrentUser`, `ActionResult<T>`, `revalidatePath`) | exact |
| `src/components/profile/ProfileWatchCard.tsx` (MODIFY) | component (client) | transform (props → JSX) | self — local edits only (replace lines 50, 85-89) | exact |
| `src/components/profile/WishlistTabContent.tsx` (MODIFY: DndContext + SortableContext + useOptimistic + useTransition) | component (client) | event-driven (drag) | `src/components/profile/NoteVisibilityPill.tsx` (useOptimistic + useTransition + ActionResult shape); `src/components/settings/PrivacyToggleRow.tsx` (parallel useOptimistic precedent) | role-match (no existing dnd-kit consumer; the optimistic-update + Server Action shape is the strongest local analog) |
| `src/components/profile/CollectionTabContent.tsx` (MODIFY: grid-cols-2) | component (client) | transform | self — single class change at line 161 | exact |
| `src/components/profile/WishlistTabContent.test.tsx` (EXTEND existing) | test (unit, component) | transform | self — extend existing file with new `describe` block | exact |

## Pattern Assignments

---

### `src/components/profile/SortableProfileWatchCard.tsx` (NEW component, client, drag wrapper)

**Analog:** `src/components/profile/ProfileWatchCard.tsx` (presentational sibling) + `src/components/profile/NoteVisibilityPill.tsx` (client-component shape with `'use client'` + hook + JSX)

**Imports pattern** (model from `ProfileWatchCard.tsx` lines 1-11 + `NoteVisibilityPill.tsx` lines 1-5):
```typescript
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ProfileWatchCard } from './ProfileWatchCard'
import type { Watch } from '@/lib/types'
```

**Component shape** (model from `NoteVisibilityPill.tsx:23-71` and `ProfileWatchCard.tsx:19-23` for prop interface):
```typescript
interface SortableProfileWatchCardProps {
  id: string
  watch: Watch
  lastWornDate: string | null
  showWishlistMeta: boolean
}

export function SortableProfileWatchCard({ id, watch, lastWornDate, showWishlistMeta }: SortableProfileWatchCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  // touchAction: 'manipulation' is REQUIRED for iOS Safari long-press — see RESEARCH Pitfall 3.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
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

**Notes for planner:**
- Owner-only render path. `WishlistTabContent` decides whether to render `<SortableProfileWatchCard>` or plain `<ProfileWatchCard>` based on `isOwner` prop (CONTEXT D-08).
- The wrapping `<Link>` inside `ProfileWatchCard.tsx:42` interacts with the drag listeners; RESEARCH Pitfall 2 + Open Question #2 flag a verification step. The planner should test tap-to-navigate vs. long-press-to-drag explicitly. If click-through fires alongside drag, restructure `ProfileWatchCard` so the `<Link>` is conditionally rendered (factor into `ProfileWatchCardInner` + `ProfileWatchCard` with link).

---

### `drizzle/00XX_phase27_sort_order.sql` (NEW migration, drizzle)

**Analog:** `drizzle/0005_phase19_1_taste_columns.sql` (line 1-8)

**Pattern** (drizzle-emitted DDL via `npx drizzle-kit generate`):
```sql
ALTER TABLE "watches" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "watches_user_sort_idx" ON "watches" USING btree ("user_id","sort_order");
```

**Notes for planner:**
- This file is auto-generated — planner runs `npx drizzle-kit generate` after editing `src/db/schema.ts` (per RESEARCH §Pattern 7 step 1-2). The exact filename will be assigned by drizzle-kit's incrementing prefix; current latest is `0005`, so this will likely land as `0006_phase27_sort_order.sql`.
- The drizzle migration is LOCAL ONLY per `project_drizzle_supabase_db_mismatch.md` memory. Prod is the parallel supabase migration below.

---

### `supabase/migrations/20260504HHMMSS_phase27_sort_order.sql` (NEW migration, supabase prod)

**Analog 1 (column-add structure):** `supabase/migrations/20260429000000_phase19_1_drizzle_taste_columns.sql` (lines 1-13)
**Analog 2 (DO $$ post-assertion):** `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql` (lines 94-130)

**Header comment pattern** (model from phase19_1 line 1-4):
```sql
-- Phase 27 — drizzle-side schema: sort_order column on watches.
-- Ported from drizzle/00XX_phase27_sort_order.sql so prod can apply via supabase db push --linked.
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- Locally these already exist (drizzle-kit push); this migration is a no-op there.
```

**Column + index pattern** (mirrors drizzle DDL with IF NOT EXISTS guards):
```sql
BEGIN;

ALTER TABLE "watches"
  ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "watches_user_sort_idx"
  ON "watches" (user_id, sort_order);
```

**Backfill pattern** (RESEARCH §Code Examples — per-user ROW_NUMBER ranking):
```sql
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

**Post-migration assertion pattern** (model from phase24 lines 94-130):
```sql
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

**Notes for planner:**
- Filename pattern: `YYYYMMDDHHmmss_phaseXX_short_description.sql` per supabase docs / phase24 / phase19_1 precedent. `HHMMSS` is the planner's choice based on actual migration time; e.g. `20260504120000_phase27_sort_order.sql`.
- Wrap entire migration in `BEGIN; … COMMIT;` per phase24 precedent (line 18, 132).
- Backfill order semantics for owned/sold (RESEARCH Open Question #4) — D-02 says either all-statuses-backfilled or only-wishlist-grail-backfilled is acceptable. Recommend backfilling all statuses with `PARTITION BY user_id, status ORDER BY created_at DESC` for symmetry; costs nothing at <500 watches/user.

---

### `src/db/schema.ts` (MODIFY)

**Analog:** Self — existing `watches` table definition at lines 48–110.

**Column add pattern** (insert before line 103 `createdAt`):
```typescript
// Phase 27 — sort_order for wishlist drag-reorder (D-01).
// Default 0; backfilled per-user in createdAt DESC order via parallel
// supabase migration. Universal column on every row regardless of status.
sortOrder: integer('sort_order').notNull().default(0),
```

**Index add pattern** (insert into the `(table) => [...]` array at lines 106-109, after line 108):
```typescript
index('watches_user_sort_idx').on(table.userId, table.sortOrder),
```

**Notes for planner:**
- The existing schema.ts already imports `integer` (line 6) and `index` (line 12) — no new imports needed.
- After editing, run `npx drizzle-kit generate` to emit the `drizzle/00XX_phase27_sort_order.sql` file.

---

### `src/data/watches.ts` (MODIFY)

**Analog (existing CRUD helpers):** Self at lines 164-211 (`createWatch`, `updateWatch`, `deleteWatch`, `linkWatchToCatalog`).
**Analog (read-path ORDER BY):** `src/data/wearEvents.ts:84-90` and `116-117` (`.orderBy(desc(...))`).

**1. Modify `getWatchesByUser` at line 91** — add ORDER BY:
```typescript
import { eq, and, or, asc, desc, sql } from 'drizzle-orm'
// ... existing imports ...

export async function getWatchesByUser(userId: string): Promise<Watch[]> {
  const rows = await db
    .select()
    .from(watches)
    .where(eq(watches.userId, userId))
    .orderBy(asc(watches.sortOrder), desc(watches.createdAt))
  return rows.map(mapRowToWatch)
}
```

**2. Add `getMaxWishlistSortOrder` helper** (RESEARCH §Code Examples / D-03 / D-04):
```typescript
import { inArray } from 'drizzle-orm'
// (already need to add `inArray` and `asc` to imports)

/**
 * Returns max(sort_order) across the user's wishlist+grail set, or -1 if empty.
 * Used by addWatch (D-03 — new wishlist watch lands at end) and editWatch
 * status-transition branch (D-04 — destination group bumps sort_order).
 */
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
```

**3. Add `bulkReorderWishlist` helper** (RESEARCH §Pattern 5 — Drizzle CASE WHEN bulk update):
```typescript
import { type SQL } from 'drizzle-orm'

/**
 * Bulk-updates sort_order for the user's wishlist+grail set in a single
 * round-trip via UPDATE … CASE WHEN. Owner-only at the WHERE clause level.
 *
 * Throws "Owner mismatch" if the affected row count != orderedIds.length —
 * defense in depth against forged ids. Server Action maps to ActionResult.failure.
 */
export async function bulkReorderWishlist(
  userId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return

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

  if (updated.length !== orderedIds.length) {
    throw new Error(
      `Owner mismatch: expected ${orderedIds.length} rows, updated ${updated.length}`,
    )
  }
}
```

**4. Modify `mapDomainToRow` at line 54** to include `sortOrder` (CRUD path completeness):
```typescript
// Insert near line 82 (after notes mapping):
if ('sortOrder' in data && data.sortOrder !== undefined) row.sortOrder = data.sortOrder
```

**5. Modify `mapRowToWatch` at line 17** to expose `sortOrder` to domain:
```typescript
// Insert before catalogId at line 47:
sortOrder: row.sortOrder,
```

**Notes for planner:**
- `Watch` domain type in `src/lib/types.ts` will need `sortOrder?: number` added (or `sortOrder: number` if non-optional). Planner-owned per CONTEXT discretion.
- The `'server-only'` import at line 2 is preserved — DAL must remain server-only.

---

### `src/app/actions/wishlist.ts` (MODIFY: add `reorderWishlist` export)

**Analog:** Self — existing `addToWishlistFromWearEvent` at lines 1-149 demonstrates Zod `.strict()` + `getCurrentUser()` + `ActionResult<T>` + `revalidatePath`.

**Imports pattern** (lines 1-13 — extend existing imports):
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

import { db } from '@/db'
// ... existing imports ...
import { bulkReorderWishlist } from '@/data/watches'  // NEW import
import { getCurrentUser } from '@/lib/auth'
import type { ActionResult } from '@/lib/actionTypes'
```

**Zod schema pattern** (model from line 21 — same `.strict()` shape):
```typescript
// Mass-assignment defense: .strict() rejects any payload key other than
// orderedIds. userId is NEVER taken from the client — sourced from session.
const reorderWishlistSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(500),
}).strict()
```

**Server Action pattern** (model from `addToWishlistFromWearEvent` lines 44-149 — auth/parse/try-catch/revalidate):
```typescript
/**
 * Bulk-reorder the authenticated user's wishlist+grail watches.
 * Owner-only at TWO layers: (1) Zod payload omits userId (taken from session);
 * (2) DAL WHERE clause includes user_id; (3) post-update count check throws
 * "Owner mismatch" if any forged id slipped through.
 *
 * Returns ActionResult — never throws across the boundary.
 * Optimistic UI rollback on failure: client wraps this in startTransition so
 * useOptimistic auto-reverts when the server-truth re-render lands.
 */
export async function reorderWishlist(
  data: unknown,
): Promise<ActionResult<void>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = reorderWishlistSchema.safeParse(data)
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

**Notes for planner:**
- The `'use server'` directive at line 1 is preserved (file-level).
- `revalidatePath` invocation — `'page'` segment scope per Next.js 16 docs (matches `addToWishlistFromWearEvent:143` shape `revalidatePath('/')`).
- No catalog fanout / activity log / notification — reorder is a pure ordering write, no fan-out side effects. Distinct from `addWatch` / `editWatch` in `watches.ts` which fan out via `revalidateTag('explore', 'max')`.

---

### `src/components/profile/ProfileWatchCard.tsx` (MODIFY)

**Analog:** Self — three local edits to the existing component.

**1. Image `sizes` attr** at line 50 — change per D-13:
```typescript
// FROM:
sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
// TO:
sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
```

**2. Status-driven price line** — replace lines 85-89 (`showWishlistMeta && watch.targetPrice` block) with unified status-driven render per D-15 → D-21:
```typescript
// New helper inline above the JSX return (or hoist to a const above line 41):
const priceLine = (() => {
  const isWishlistLike = watch.status === 'wishlist' || watch.status === 'grail'
  const primary = isWishlistLike ? watch.targetPrice : watch.pricePaid
  const primaryLabel = isWishlistLike ? 'Target' : 'Paid'
  if (primary != null) return `${primaryLabel}: $${primary.toLocaleString()}`
  if (watch.marketPrice != null) return `Market: $${watch.marketPrice.toLocaleString()}`
  return null
})()

// Then in JSX, replace the lines 85-89 block with:
{priceLine && (
  <p className="mt-1 text-xs font-normal text-foreground">
    {priceLine}
  </p>
)}
```

**3. Notes preview gating preserved** at lines 90-93 — the existing `showWishlistMeta && watch.notes` block remains. Only the price block is unified across both bucket variants (D-15 makes price-line render unconditional based on status; notes preview stays Wishlist-only via the existing `showWishlistMeta` flag).

**Notes for planner:**
- The wrapping `<Link>` at line 42 is preserved. The non-owner code path renders this card as today (no change).
- Drag-affordance hover styling (`cursor-grab` per D-06) is applied by `SortableProfileWatchCard`'s outer `div`, NOT `ProfileWatchCard` itself — keeps non-owner path unchanged.
- `isWishlistLike` predicate matches the locked `WatchCard.tsx:23` shape (CONTEXT line 112). Reuse this pattern verbatim.

---

### `src/components/profile/WishlistTabContent.tsx` (MODIFY)

**Analog 1 (useOptimistic + useTransition + ActionResult):** `src/components/profile/NoteVisibilityPill.tsx:23-71` (lines below)
**Analog 2 (parallel useOptimistic precedent):** `src/components/settings/PrivacyToggleRow.tsx:21-36`
**Analog 3 (existing component shape):** Self (lines 1-69)

**`useOptimistic + useTransition` pattern excerpt** (from `NoteVisibilityPill.tsx:28-47`):
```typescript
const [optimisticPublic, setOptimistic] = useOptimistic(initialIsPublic)
const [pending, startTransition] = useTransition()

function handleClick() {
  if (disabled) return
  const next = !optimisticPublic
  startTransition(async () => {
    setOptimistic(next)
    const result = await updateNoteVisibility({
      watchId,
      isPublic: next,
    })
    if (!result.success) {
      // Revalidation from the parent Server Component re-renders the row
      // with the original initialIsPublic, snapping the pill back. Surface
      // the error to the console for now (toast pattern arrives later).
      console.error('[NoteVisibilityPill] save failed:', result.error)
    }
  })
}
```

**Adaptation for WishlistTabContent (per RESEARCH §Pattern 1 + Pattern 2):**
```typescript
'use client'

import { useOptimistic, useTransition, useState } from 'react'
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
import { toast } from 'sonner'
import { reorderWishlist } from '@/app/actions/wishlist'
import { ProfileWatchCard } from './ProfileWatchCard'
import { SortableProfileWatchCard } from './SortableProfileWatchCard'
import { AddWatchCard } from './AddWatchCard'
import type { Watch } from '@/lib/types'

// ... existing prop interface and empty-state branches preserved ...

// Inside the component (populated branch only — keep empty-state branches at lines 25-55 unchanged):

// Owner branch — DnD wired:
if (isOwner) {
  const watchesById = Object.fromEntries(watches.map((w) => [w.id, w]))
  const initialIds = watches.map((w) => w.id)

  const [optimisticIds, setOptimistic] = useOptimistic<string[], string[]>(
    initialIds,
    (_state, newOrder) => newOrder,
  )
  const [, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = optimisticIds.indexOf(active.id as string)
    const newIdx = optimisticIds.indexOf(over.id as string)
    const newOrder = arrayMove(optimisticIds, oldIdx, newIdx)

    startTransition(async () => {
      setOptimistic(newOrder)
      const result = await reorderWishlist({ orderedIds: newOrder })
      if (!result.success) {
        toast.error("Couldn't save new order. Reverted.")
        // useOptimistic snaps back to server-truth on transition end (server
        // didn't revalidatePath on the failure path → initialIds is restored).
      }
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e: DragStartEvent) => {
        setActiveId(e.active.id as string)
        navigator.vibrate?.(10)
      }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={optimisticIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {optimisticIds.map((id) => (
            <SortableProfileWatchCard
              key={id}
              id={id}
              watch={watchesById[id]}
              lastWornDate={wearDates[id] ?? null}
              showWishlistMeta
            />
          ))}
          <AddWatchCard variant="wishlist" />
        </div>
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <ProfileWatchCard
            watch={watchesById[activeId]}
            lastWornDate={wearDates[activeId] ?? null}
            showWishlistMeta
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// Non-owner branch — plain grid (mirrors existing line 56-68 behavior, plus grid-cols-2 update):
return (
  <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {watches.map((watch) => (
      <ProfileWatchCard
        key={watch.id}
        watch={watch}
        lastWornDate={wearDates[watch.id] ?? null}
        showWishlistMeta
      />
    ))}
  </div>
)
```

**Grid class change** (D-11) — at line 57, BOTH owner and non-owner branches:
```typescript
// FROM:
className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
// TO:
className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4"
```

**Notes for planner:**
- The `'use client'` directive at line 1 is preserved — already a client component.
- Empty-state branches at lines 25-55 are UNCHANGED per UI-SPEC line 110-114.
- `aria-live` region for keyboard reorder announcements (UI-SPEC copywriting contract) — add a visually-hidden div adjacent to the grid that announces pickup/drop/cancel events. Pattern reference: see `FormStatusBanner` (Phase 25) precedent in the project — search for `aria-live="assertive"`.
- `AddWatchCard` is OUTSIDE `SortableContext.items` (UI-SPEC line 236-237) but INSIDE the grid — renders as final cell.
- The `useOptimistic + useTransition` pattern from `NoteVisibilityPill.tsx` is the canonical project precedent. Three components use this exact shape: `NoteVisibilityPill`, `PrivacyToggleRow`, `NotificationRow`.

---

### `src/components/profile/CollectionTabContent.tsx` (MODIFY)

**Analog:** Self — single-line class change at line 161.

**Pattern:**
```typescript
// FROM (line 161):
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
// TO:
<div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
```

**Notes for planner:**
- ONLY this single line changes. NO drag-and-drop wiring (CONTEXT `<deferred>` keeps Collection-tab reorder out of scope).
- The empty-state grid at lines 89-115 (`sm:grid-cols-2`) is unrelated to the watch grid and stays as-is.

---

### `src/components/profile/WishlistTabContent.test.tsx` (EXTEND existing)

**Analog:** Self — existing file at lines 1-103.

**Existing structure** (mocks `next/link`, `next/image`, and `ProfileWatchCard` via `vi.mock`; renders with `@testing-library/react`):
```typescript
// Source: src/components/profile/WishlistTabContent.test.tsx:11-39
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, 'aria-label': ariaLabel, className }: ...) => (
    <a href={href} aria-label={ariaLabel} className={className}>
      {children}
    </a>
  ),
}))
vi.mock('next/image', () => ({
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}))
vi.mock('@/components/profile/ProfileWatchCard', () => ({
  ProfileWatchCard: () => <div data-testid="pwc" />,
}))
```

**Extension pattern** — append a new `describe` block per RESEARCH §Validation Architecture WISH-01 line 944, 946:
```typescript
// Add at the end of the file, after the existing describe at line 54-102:

vi.mock('@/app/actions/wishlist', () => ({
  reorderWishlist: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))
vi.mock('@/components/profile/SortableProfileWatchCard', () => ({
  SortableProfileWatchCard: ({ id }: { id: string }) => (
    <div data-testid="sortable-pwc" data-id={id} aria-roledescription="sortable" />
  ),
}))

describe('Phase 27 — WishlistTabContent owner DnD path (WISH-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('isOwner=true — wraps grid in DndContext, renders SortableProfileWatchCard with aria-roledescription="sortable"', () => {
    render(
      <WishlistTabContent
        watches={[buildWatch('w1'), buildWatch('w2')]}
        wearDates={{}}
        isOwner={true}
        username="alice"
      />,
    )
    const sortables = screen.getAllByRole('generic', { description: /sortable/ })
    expect(sortables.length).toBeGreaterThanOrEqual(2)
  })

  it('isOwner=false — plain ProfileWatchCard list, no aria-roledescription="sortable"', () => {
    render(
      <WishlistTabContent
        watches={[buildWatch('w1'), buildWatch('w2')]}
        wearDates={{}}
        isOwner={false}
        username="alice"
      />,
    )
    expect(screen.queryByRole('generic', { description: /sortable/ })).toBeNull()
  })

  it('grid uses grid-cols-2 (VIS-07)', () => {
    const { container } = render(
      <WishlistTabContent
        watches={[buildWatch('w1')]}
        wearDates={{}}
        isOwner={false}
        username="alice"
      />,
    )
    const grid = container.querySelector('.grid')
    expect(grid?.className).toContain('grid-cols-2')
  })

  // Rollback test (RESEARCH WISH-01 line 946) — exercises the optimistic
  // failure path. Mock reorderWishlist → {success:false}, dispatch synthetic
  // dragEnd, assert toast.error called and items reverted.
  it('reorder failure: server returns failure → toast.error called, optimistic state reverts', async () => {
    // ... synthetic dragEnd + mocked action ...
    // Implementation note for planner: dnd-kit's onDragEnd handler is hard
    // to invoke via RTL alone. Recommend extracting handleDragEnd as a named
    // function and exporting/testing in isolation, OR using @dnd-kit/test
    // utilities if they exist in the version being installed.
  })
})
```

**Notes for planner:**
- The existing `buildWatch` factory at lines 42-52 is reused.
- The component-level mocks for `next/link` / `next/image` / `ProfileWatchCard` already exist; planner adds `vi.mock` for `@/app/actions/wishlist`, `sonner`, and `@/components/profile/SortableProfileWatchCard` to the new describe block (or hoist to file scope alongside existing mocks).
- The rollback test is non-trivial because it requires invoking dnd-kit's `onDragEnd` synthetically. Planner should consider extracting `handleDragEnd` as a named exported function for direct unit testing, OR limit the WishlistTabContent test to assertion-of-presence and cover the rollback flow at the action-layer test (`reorderWishlist.test.ts`) which is cheaper and equally informative.

---

### Wave 0 Test Files (NEW)

#### `src/db/__tests__/phase27-schema.test.ts`

**Analog:** `tests/integration/phase11-schema.test.ts:1-100` (existence + shape assertions on information_schema)

**Pattern excerpt** (from phase11-schema lines 14-37):
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql } from 'drizzle-orm'

import { db } from '@/db'
import { users, watches } from '@/db/schema'
import { eq } from 'drizzle-orm'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 27 schema — sort_order column + index existence (WISH-01)', () => {
  it('watches has sort_order column (integer, NOT NULL, DEFAULT 0)', async () => {
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'watches'
         AND column_name = 'sort_order'
    `)
    const rows = (result as unknown as Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>) ?? []
    const col = rows[0]
    expect(col).toBeDefined()
    expect(col.data_type).toBe('integer')
    expect(col.is_nullable).toBe('NO')
    expect(col.column_default).toMatch(/^0/)
  })

  it('watches_user_sort_idx exists on (user_id, sort_order)', async () => {
    const result = await db.execute(sql`
      SELECT indexname, indexdef
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'watches'
         AND indexname = 'watches_user_sort_idx'
    `)
    const rows = (result as unknown as Array<{ indexname: string; indexdef: string }>) ?? []
    expect(rows[0]).toBeDefined()
    expect(rows[0].indexdef).toMatch(/user_id.*sort_order/)
  })
})
```

**Note:** File location per RESEARCH §Validation Architecture is `src/db/__tests__/phase27-schema.test.ts` — but the existing project pattern places integration tests in `tests/integration/`. The planner should choose between honoring RESEARCH's file path OR the existing `tests/integration/phase11-schema.test.ts` precedent. **Recommendation: use `tests/integration/phase27-schema.test.ts`** for consistency with all 17+ existing phase tests; update CONTEXT/RESEARCH if the path moves.

---

#### `src/db/__tests__/phase27-backfill.test.ts`

**Analog:** `tests/integration/phase17-backfill-idempotency.test.ts:1-80` (seed → run → assert pattern)

**Pattern excerpt** (from phase17-backfill lines 12-79):
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { sql, inArray, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { users, watches } from '@/db/schema'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = `p27bf${Date.now().toString(36)}`

maybe('Phase 27 backfill — sort_order ROW_NUMBER ranking per user (WISH-01)', () => {
  const userIdA = randomUUID()
  const userIdB = randomUUID()
  const seededWatchIds: string[] = []

  beforeAll(async () => {
    // Seed two users with 3 wishlist watches each, known createdAt ordering.
    // (After migration runs, sort_order should be 0, 1, 2 per user, in
    // createdAt DESC order.)
    await db.insert(users).values([
      { id: userIdA, email: `${STAMP}-a@horlo.test` },
      { id: userIdB, email: `${STAMP}-b@horlo.test` },
    ]).onConflictDoNothing()

    // Seed 3 wishlist watches per user with explicit createdAt timestamps
    // ... (use db.insert with returning() and capture ids) ...
  })

  afterAll(async () => {
    await db.delete(watches).where(inArray(watches.id, seededWatchIds))
    await db.delete(users).where(inArray(users.id, [userIdA, userIdB]))
  })

  it('per-user backfill: sort_order is 0..N in createdAt DESC order, no cross-user collision', async () => {
    // Read back rows and assert sort_order shape per user.
    const rowsA = await db
      .select({ id: watches.id, sortOrder: watches.sortOrder, createdAt: watches.createdAt })
      .from(watches)
      .where(and(eq(watches.userId, userIdA), inArray(watches.status, ['wishlist', 'grail'])))
      .orderBy(asc(watches.sortOrder))
    expect(rowsA.map((r) => r.sortOrder)).toEqual([0, 1, 2])

    // Verify newest createdAt has sort_order = 0
    const sortedByDate = [...rowsA].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    expect(sortedByDate[0].sortOrder).toBe(0)
  })

  it('no duplicate (user_id, sort_order) tuples post-backfill', async () => {
    // Mirrors the supabase migration's own DO $$ assertion at the test level.
    const result = await db.execute(sql`
      SELECT user_id, sort_order, count(*) c
        FROM watches
       WHERE status IN ('wishlist', 'grail')
       GROUP BY user_id, sort_order
       HAVING count(*) > 1
    `)
    const rows = (result as unknown as Array<{ count: number }>) ?? []
    expect(rows).toHaveLength(0)
  })
})
```

**Notes for planner:**
- `DATABASE_URL`-gated skip pattern is project standard — every existing integration test uses `const maybe = process.env.DATABASE_URL ? describe : describe.skip`.
- Test cleanup in `afterAll` deletes seeded data; uses `inArray` to bulk-delete.

---

#### `src/data/__tests__/watches-bulkReorder.test.ts`

**Analog:** `tests/integration/phase17-backfill-idempotency.test.ts` (DB-touching unit-test shape — seed + call + assert)

**Pattern (per RESEARCH §Validation Architecture WISH-01 line 941):**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, and, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { users, watches } from '@/db/schema'
import { bulkReorderWishlist } from '@/data/watches'

const maybe = process.env.DATABASE_URL ? describe : describe.skip
const STAMP = `p27br${Date.now().toString(36)}`

maybe('Phase 27 — bulkReorderWishlist owner-only enforcement (WISH-01 D-10)', () => {
  // Seed two users, three wishlist watches each
  // Call bulkReorderWishlist(userA, [a1, a2, a3]) — succeeds
  // Call bulkReorderWishlist(userA, [a1, b1, a2]) — should throw "Owner mismatch"
  //   (b1 belongs to userB; WHERE clause filters it; count check throws)

  it('bulkReorderWishlist accepts only ids belonging to the user — throws on foreign id', async () => {
    await expect(
      bulkReorderWishlist(userIdA, [aWatchId1, bWatchId1, aWatchId2]),
    ).rejects.toThrow(/Owner mismatch/)
  })

  it('bulkReorderWishlist excludes owned/sold watches even from the same user', async () => {
    // Seed userA with one 'owned' watch alongside their wishlist.
    // Calling bulkReorderWishlist with the owned id should throw count-mismatch.
  })

  it('happy path: all ids valid + wishlist+grail status — sort_order set to array index', async () => {
    await bulkReorderWishlist(userIdA, [a3, a1, a2])
    const rows = await db
      .select({ id: watches.id, sortOrder: watches.sortOrder })
      .from(watches)
      .where(inArray(watches.id, [a3, a1, a2]))
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.sortOrder]))
    expect(byId[a3]).toBe(0)
    expect(byId[a1]).toBe(1)
    expect(byId[a2]).toBe(2)
  })
})
```

---

#### `src/data/__tests__/watches-getWatchesByUser-orderBy.test.ts`

**Analog:** `tests/integration/phase11-schema.test.ts` (DB integration smoke pattern)
**Reference for orderBy semantics:** `src/data/wearEvents.ts:88, 116-117`

**Pattern (per RESEARCH §Validation Architecture WISH-01 line 943):**
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { users, watches } from '@/db/schema'
import { getWatchesByUser } from '@/data/watches'

const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase 27 — getWatchesByUser ORDER BY sort_order ASC, created_at DESC (WISH-01)', () => {
  // Seed user with 3 wishlist watches with EXPLICIT sort_order values: [2, 0, 1]
  // Each with distinct createdAt timestamps.
  // Call getWatchesByUser — assert order is by sort_order ASC.

  it('returns watches in sort_order ASC order', async () => {
    const watchesOrdered = await getWatchesByUser(userId)
    const wishlist = watchesOrdered.filter((w) => w.status === 'wishlist')
    // Watch with sortOrder 0 should come before 1, before 2.
    expect(wishlist.map((w) => w.sortOrder)).toEqual([0, 1, 2])
  })

  it('uses createdAt DESC as tiebreaker when sort_order ties', async () => {
    // Seed two watches with same sort_order, distinct createdAt.
    // Newer one should sort first.
  })
})
```

---

#### `src/app/actions/__tests__/reorderWishlist.test.ts`

**Analog (test file shape):** `src/components/profile/AddWatchCard.test.tsx` (vi.mock + describe + it + render-or-call-action)
**Analog (mocking pattern for getCurrentUser/db):** there is no direct precedent in `src/app/actions/__tests__/` (directory does not exist) — closest is the integration tests in `tests/integration/` which mock at the database layer rather than the auth layer.

**Pattern (per RESEARCH §Validation Architecture WISH-01 line 942):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock getCurrentUser at the lib/auth boundary
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))
// Mock the DAL helper
vi.mock('@/data/watches', () => ({
  bulkReorderWishlist: vi.fn(),
}))
// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { reorderWishlist } from '@/app/actions/wishlist'
import { getCurrentUser } from '@/lib/auth'
import { bulkReorderWishlist } from '@/data/watches'

describe('Phase 27 — reorderWishlist Server Action surface (WISH-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated requests', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Not authenticated'))
    const result = await reorderWishlist({ orderedIds: ['11111111-1111-1111-1111-111111111111'] })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not authenticated')
  })

  it('rejects payloads with extra keys (.strict() defense)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    const result = await reorderWishlist({
      orderedIds: ['11111111-1111-1111-1111-111111111111'],
      userId: 'forged-id',  // extra key — .strict() should reject
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid request')
  })

  it('rejects non-uuid ids', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    const result = await reorderWishlist({ orderedIds: ['not-a-uuid'] })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid request')
  })

  it('owner-mismatch from DAL → action returns "Some watches do not belong to you."', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    vi.mocked(bulkReorderWishlist).mockRejectedValue(new Error('Owner mismatch: ...'))
    const result = await reorderWishlist({ orderedIds: ['11111111-1111-1111-1111-111111111111'] })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Some watches do not belong to you.')
  })

  it('happy path: returns {success:true, data:undefined} and revalidates', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-id' } as any)
    vi.mocked(bulkReorderWishlist).mockResolvedValue(undefined)
    const result = await reorderWishlist({ orderedIds: ['11111111-1111-1111-1111-111111111111'] })
    expect(result.success).toBe(true)
  })
})
```

**Notes for planner:**
- This test does NOT touch the DB — `bulkReorderWishlist` is mocked. It exercises the action's surface contract (auth, Zod, error mapping).
- The Zod `.strict()` test at line "rejects payloads with extra keys" is critical — proves mass-assignment defense per CONTEXT D-10.

---

#### `src/components/profile/__tests__/ProfileWatchCard-priceLine.test.tsx`

**Analog:** `src/components/profile/AddWatchCard.test.tsx:1-62` (vi.mock + render + getByText pattern)

**Pattern excerpt** (from AddWatchCard.test:10-46):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock('next/image', () => ({
  default: (p: any) => <img src={p.src} alt={p.alt} sizes={p.sizes} />,
}))

import { ProfileWatchCard } from '@/components/profile/ProfileWatchCard'
import type { Watch } from '@/lib/types'

const buildWatch = (overrides: Partial<Watch>): Watch => ({
  id: 'w1',
  brand: 'Brand',
  model: 'Model',
  status: 'owned',
  movement: 'automatic',
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
  ...overrides,
})

describe('Phase 27 — ProfileWatchCard price line (VIS-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('owned + pricePaid → "Paid: $4,200"', () => {
    render(<ProfileWatchCard watch={buildWatch({ status: 'owned', pricePaid: 4200 })} lastWornDate={null} />)
    expect(screen.getByText('Paid: $4,200')).toBeInTheDocument()
  })

  it('wishlist + targetPrice → "Target: $15,000"', () => {
    render(<ProfileWatchCard watch={buildWatch({ status: 'wishlist', targetPrice: 15000 })} lastWornDate={null} showWishlistMeta />)
    expect(screen.getByText('Target: $15,000')).toBeInTheDocument()
  })

  it('owned + pricePaid null + marketPrice 8500 → "Market: $8,500"', () => {
    render(<ProfileWatchCard watch={buildWatch({ status: 'owned', pricePaid: undefined, marketPrice: 8500 })} lastWornDate={null} />)
    expect(screen.getByText('Market: $8,500')).toBeInTheDocument()
  })

  it('wishlist + targetPrice null + marketPrice null → no price line rendered', () => {
    const { container } = render(<ProfileWatchCard watch={buildWatch({ status: 'wishlist', targetPrice: undefined, marketPrice: undefined })} lastWornDate={null} showWishlistMeta />)
    expect(screen.queryByText(/Paid:|Target:|Market:/)).toBeNull()
  })

  it('grail + targetPrice → "Target: $X" (grail uses target bucket per D-16)', () => {
    render(<ProfileWatchCard watch={buildWatch({ status: 'grail', targetPrice: 50000 })} lastWornDate={null} showWishlistMeta />)
    expect(screen.getByText('Target: $50,000')).toBeInTheDocument()
  })

  it('sold + pricePaid → "Paid: $X" (sold uses paid bucket per D-16)', () => {
    render(<ProfileWatchCard watch={buildWatch({ status: 'sold', pricePaid: 3000 })} lastWornDate={null} />)
    expect(screen.getByText('Paid: $3,000')).toBeInTheDocument()
  })

  it('Image sizes attr equals "(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw" (D-13)', () => {
    const { container } = render(<ProfileWatchCard watch={buildWatch({ imageUrl: 'https://example.com/x.jpg' })} lastWornDate={null} />)
    const img = container.querySelector('img')
    expect(img?.getAttribute('sizes')).toBe('(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw')
  })
})
```

---

#### `src/components/profile/__tests__/CollectionTabContent.test.tsx`

**Analog:** `src/components/profile/WishlistTabContent.test.tsx:11-39` (vi.mock + describe + grid-class assertion)

**Pattern (per RESEARCH §Validation Architecture VIS-07 line 947):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))
vi.mock('@/components/profile/ProfileWatchCard', () => ({
  ProfileWatchCard: () => <div data-testid="pwc" />,
}))
vi.mock('@/components/profile/AddWatchCard', () => ({
  AddWatchCard: () => <div data-testid="add-card" />,
}))
vi.mock('@/components/profile/FilterChips', () => ({
  FilterChips: () => <div data-testid="filter-chips" />,
}))

import { CollectionTabContent } from '@/components/profile/CollectionTabContent'
import type { Watch } from '@/lib/types'

const buildWatch = (id: string): Watch => ({
  id,
  brand: 'Brand',
  model: 'Model',
  status: 'owned',
  movement: 'automatic',
  complications: [],
  styleTags: [],
  designTraits: [],
  roleTags: [],
})

describe('Phase 27 — CollectionTabContent grid (VIS-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('grid uses grid-cols-2 (mobile 2-column per D-11)', () => {
    const { container } = render(
      <CollectionTabContent
        watches={[buildWatch('w1'), buildWatch('w2')]}
        wearDates={{}}
        isOwner={true}
        hasUrlExtract={true}
      />,
    )
    const grid = container.querySelector('.grid.grid-cols-2')
    expect(grid).not.toBeNull()
    // Verify the existing breakpoint classes are preserved
    expect(grid?.className).toContain('sm:grid-cols-2')
    expect(grid?.className).toContain('lg:grid-cols-4')
  })
})
```

---

## Shared Patterns

### 1. Server Action shape (Zod `.strict()` + `getCurrentUser` + `ActionResult` + `revalidatePath`)

**Source:** `src/app/actions/wishlist.ts:21, 44-149` (existing `addToWishlistFromWearEvent`); also `src/app/actions/watches.ts:60, 269` (`addWatch`, `editWatch`)

**Apply to:** `src/app/actions/wishlist.ts` (new `reorderWishlist` export); also `src/app/actions/watches.ts` if planner adds the `addWatch`/`editWatch` sortOrder bump in those existing actions per CONTEXT D-03/D-04.

**Excerpt** (from `wishlist.ts:21, 44-57`):
```typescript
const schema = z.object({ wearEventId: z.string().uuid() }).strict()

export async function addToWishlistFromWearEvent(
  data: unknown,
): Promise<ActionResult<{ watchId: string }>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }
  // ... try/catch around DAL call → return ActionResult ...
}
```

**Why `.strict()`:** Mass-assignment defense per CONTEXT D-10 — payload key `userId` MUST never come from the client; it comes from session via `getCurrentUser()`. `.strict()` rejects ANY unknown key.

---

### 2. useOptimistic + useTransition for owner-initiated mutations

**Source:** `src/components/profile/NoteVisibilityPill.tsx:23-71` (canonical project precedent); `src/components/settings/PrivacyToggleRow.tsx:21-36` (parallel example)

**Apply to:** `src/components/profile/WishlistTabContent.tsx` (the new owner-only DnD path)

**Excerpt** (from `NoteVisibilityPill.tsx:23-47`):
```typescript
'use client'
import { useOptimistic, useTransition } from 'react'

export function NoteVisibilityPill({ watchId, initialIsPublic, disabled }: Props) {
  const [optimisticPublic, setOptimistic] = useOptimistic(initialIsPublic)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (disabled) return
    const next = !optimisticPublic
    startTransition(async () => {
      setOptimistic(next)
      const result = await updateNoteVisibility({ watchId, isPublic: next })
      if (!result.success) {
        // Revalidation from the parent Server Component re-renders the row
        // with the original initialIsPublic, snapping the pill back.
        console.error('[NoteVisibilityPill] save failed:', result.error)
      }
    })
  }
  // ...
}
```

**Adaptation note:** WishlistTabContent uses the same shape, but the optimistic state is an `string[]` (ordered ids) instead of a `boolean`, and the failure path calls `toast.error("Couldn't save new order. Reverted.")` instead of `console.error` (per UI-SPEC copywriting contract + CONTEXT D-09).

---

### 3. Drizzle/Supabase parallel migrations (LOCAL via drizzle-kit + PROD via supabase CLI)

**Sources:**
- Drizzle side: `drizzle/0005_phase19_1_taste_columns.sql` (parallel mirror)
- Supabase side: `supabase/migrations/20260429000000_phase19_1_drizzle_taste_columns.sql` (idempotent ADD COLUMN IF NOT EXISTS)
- Supabase side (post-migration assertion): `supabase/migrations/20260501000000_phase24_notification_enum_cleanup.sql:94-130`

**Apply to:** `drizzle/00XX_phase27_sort_order.sql` (auto-generated) AND `supabase/migrations/20260504HHMMSS_phase27_sort_order.sql` (hand-written)

**Mandatory landmine reference:** `project_drizzle_supabase_db_mismatch.md` — drizzle-kit push is LOCAL ONLY; prod is `supabase db push --linked`. The two migration files are never optional; they are paired siblings.

**Sequencing (critical):** Apply the supabase migration to prod FIRST so the column exists when Drizzle's narrower schema queries it. For local, drizzle-kit push covers it. Phase 24's migration header (lines 13-16 in the supabase file) makes this same point in reverse for ENUM cleanups.

**Idempotency guards:** Every `ALTER TABLE` / `CREATE INDEX` in the supabase file uses `IF NOT EXISTS` so local re-applies are no-ops (drizzle-kit push has already run locally).

**Post-migration assertion (DO $$ ... END $$):** Phase 11 / Phase 24 / Phase 13 all use a `DO $$` block at the end of the migration to verify shape. Phase 27's parallel pattern verifies "no duplicate (user_id, sort_order) tuples in wishlist+grail" post-backfill.

---

### 4. DATABASE_URL-gated integration test pattern

**Source:** `tests/integration/phase11-schema.test.ts:22` (and ALL 17+ other integration tests)

**Apply to:** Wave 0 schema/backfill/DAL tests for Phase 27.

**Excerpt:**
```typescript
const maybe = process.env.DATABASE_URL ? describe : describe.skip

maybe('Phase XX schema — ...', () => {
  // tests use db.execute(sql`...`) and information_schema queries
})
```

**Why:** CI runs without a local Postgres; the gate keeps the suite green. Local dev with Supabase Docker has DATABASE_URL set, so the tests run.

---

### 5. Component test scaffold (vi.mock + describe + getByText)

**Source:** `src/components/profile/AddWatchCard.test.tsx:1-62`; `src/components/profile/WishlistTabContent.test.tsx:1-103`

**Apply to:** All Wave 0 component tests for Phase 27 (`ProfileWatchCard-priceLine.test.tsx`, `CollectionTabContent.test.tsx`, the `WishlistTabContent.test.tsx` extension).

**Standard mocks:**
- `vi.mock('next/link', ...)` — render as `<a>`, preserve href + aria-label
- `vi.mock('next/image', ...)` — render as `<img>` preserving src/alt/sizes
- `vi.mock('@/components/profile/ProfileWatchCard', ...)` — when testing a parent that renders this child

**Excerpt** (from `AddWatchCard.test.tsx:13-29`):
```typescript
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    'aria-label': ariaLabel,
    className,
  }: {
    href: string
    children: React.ReactNode
    'aria-label'?: string
    className?: string
  }) => (
    <a href={href} aria-label={ariaLabel} className={className}>
      {children}
    </a>
  ),
}))
```

---

## No Analog Found

None. All 13 files have a strong codebase precedent. The closest "novel" introduction is `@dnd-kit/*` library wiring in `WishlistTabContent.tsx` and `SortableProfileWatchCard.tsx`, but the wrapping component shape (`'use client'` + hook + JSX) is well-established (see `NoteVisibilityPill.tsx`, `PrivacyToggleRow.tsx`) — only the specific dnd-kit hook calls (`useSortable`, `useSensors`, `DndContext`) are new, and those are documented exhaustively in RESEARCH.md §Pattern 2 + §Pattern 3 with example code.

## Metadata

**Analog search scope:**
- `src/components/profile/` (new + modified components)
- `src/app/actions/` (Server Actions)
- `src/data/` (DAL)
- `src/db/` (schema)
- `drizzle/` (migration generator output)
- `supabase/migrations/` (prod migrations)
- `tests/integration/` (existing integration test precedents)
- `src/components/settings/` (parallel useOptimistic pattern)

**Files scanned:** ~25 (research-flagged authoritative analogs + complementary precedents)

**Pattern extraction date:** 2026-05-04

**Files NOT scanned (out of scope for this phase):**
- `src/lib/types.ts` — planner will add `sortOrder?: number` to `Watch` type but the change is mechanical
- `src/components/watch/WatchCard.tsx` — explicitly OUT OF SCOPE per CONTEXT.md `<canonical_refs>` legacy note
- `src/app/u/[username]/[tab]/page.tsx` — already threads `isOwner` per CONTEXT line 122; no change required

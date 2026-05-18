import 'server-only'

import { db } from '@/db'
import { collectionPaths, collectionPathNodes } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Public-read DAL (D-03 draft-leak defense — CR-01 accuracy)
// The explicit WHERE status = 'published' below is the SOLE enforced draft-leak
// gate for these DAL functions. The Drizzle `db` client connects directly to
// Postgres (DATABASE_URL) and BYPASSES RLS, so the migration's
// collection_paths_select_published RLS policy does NOT apply here — it is a
// backstop only for a future Supabase-JS-client read path.
// ---------------------------------------------------------------------------

/**
 * D-03: Returns only published paths for public surfaces.
 * The WHERE status = 'published' predicate is the SOLE draft-leak guard for this
 * DAL function — RLS is bypassed by the Drizzle db client (CR-01). Never remove it.
 */
export async function getPublishedPaths(limit = 50) {
  return db
    .select()
    .from(collectionPaths)
    .where(eq(collectionPaths.status, 'published'))
    .orderBy(asc(collectionPaths.sortOrder))
    .limit(limit)
}

// ---------------------------------------------------------------------------
// Owner-scoped DAL (reads drafts — owner only)
// ---------------------------------------------------------------------------

/** Returns every path regardless of status. For admin/owner use only. */
export async function getAllPathsForOwner() {
  return db
    .select()
    .from(collectionPaths)
    .orderBy(asc(collectionPaths.sortOrder))
}

export async function getPathById(id: string) {
  const rows = await db
    .select()
    .from(collectionPaths)
    .where(eq(collectionPaths.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function getPathWithNodes(pathId: string) {
  const [path, nodes] = await Promise.all([
    getPathById(pathId),
    getPathNodes(pathId),
  ])
  if (!path) return null
  return { ...path, nodes }
}

// ---------------------------------------------------------------------------
// collection_path_nodes helpers
// ---------------------------------------------------------------------------

/** Returns nodes for a path ordered by sortOrder (slot 0 = first follow-on). */
export async function getPathNodes(pathId: string) {
  return db
    .select()
    .from(collectionPathNodes)
    .where(eq(collectionPathNodes.pathId, pathId))
    .orderBy(asc(collectionPathNodes.sortOrder))
}

export async function setPathNode(data: {
  pathId: string
  catalogId: string
  slot: number // 0-2 (max 3 follow-ons, CMS-07)
  rationale?: string | null
}) {
  // slot maps directly to sortOrder
  await db
    .insert(collectionPathNodes)
    .values({
      pathId: data.pathId,
      catalogId: data.catalogId,
      rationale: data.rationale ?? null,
      sortOrder: data.slot,
    })
    .onConflictDoNothing()
}

export async function removePathNode(nodeId: string) {
  await db
    .delete(collectionPathNodes)
    .where(eq(collectionPathNodes.id, nodeId))
}

// ---------------------------------------------------------------------------
// collection_paths CRUD
// ---------------------------------------------------------------------------

export async function createPath(data: {
  seedCatalogId: string
  pathType: string
  rationale?: string | null
  sortOrder?: number
}): Promise<string> {
  const rows = await db
    .insert(collectionPaths)
    .values({
      seedCatalogId: data.seedCatalogId,
      pathType: data.pathType,
      rationale: data.rationale ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning({ id: collectionPaths.id })
  return rows[0].id
}

export async function updatePath(
  id: string,
  data: {
    pathType?: string
    rationale?: string | null
  }
) {
  await db
    .update(collectionPaths)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(collectionPaths.id, id))
}

export async function deletePath(id: string) {
  await db.delete(collectionPaths).where(eq(collectionPaths.id, id))
}

export async function setPathStatus(id: string, status: 'draft' | 'published') {
  await db
    .update(collectionPaths)
    .set({ status, updatedAt: new Date() })
    .where(eq(collectionPaths.id, id))
}

// ---------------------------------------------------------------------------
// D-12: up/down ordering — swaps integer sortOrder values in a transaction
// ---------------------------------------------------------------------------

export async function swapPathSortOrder(idA: string, orderA: number, idB: string, orderB: number) {
  await db.transaction(async (tx) => {
    await tx
      .update(collectionPaths)
      .set({ sortOrder: orderB })
      .where(eq(collectionPaths.id, idA))
    await tx
      .update(collectionPaths)
      .set({ sortOrder: orderA })
      .where(eq(collectionPaths.id, idB))
  })
}

// WR-02: transactional path reorder — re-select inside the tx so the swap uses
// fresh sortOrder values, eliminating the lost-update race between fetch and swap.
export async function movePathInTransaction(pathId: string, direction: 'up' | 'down') {
  await db.transaction(async (tx) => {
    const paths = await tx
      .select({ id: collectionPaths.id, sortOrder: collectionPaths.sortOrder })
      .from(collectionPaths)
      .orderBy(asc(collectionPaths.sortOrder))
    const idx = paths.findIndex((p) => p.id === pathId)
    if (idx === -1) return
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1
    if (neighborIdx < 0 || neighborIdx >= paths.length) return // already at edge — no-op
    const current = paths[idx]
    const neighbor = paths[neighborIdx]
    await tx.update(collectionPaths).set({ sortOrder: neighbor.sortOrder }).where(eq(collectionPaths.id, current.id))
    await tx.update(collectionPaths).set({ sortOrder: current.sortOrder }).where(eq(collectionPaths.id, neighbor.id))
  })
}

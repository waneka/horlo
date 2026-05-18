'use server'

// CRITICAL: assertOwner() is the real security gate for every CMS Server Action.
// The admin layout redirect is UX only — Server Actions are HTTP-callable and bypass
// layout guards. Three-layer security: RLS write policies (DB) + layout redirect (UX)
// + assertOwner() here (SA). D-06.
//
// revalidateTag uses the two-argument form (single-arg is deprecated in Next.js 16).
// See node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md
// hero pin cache is GLOBAL — revalidateTag('explore:hero', 'max') is the correct
// primitive (stale-while-revalidate). See notifications.ts:14-55 for the source-level
// Next.js 16 rationale on why revalidateTag not updateTag is used for global caches.

import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { assertOwner } from '@/lib/auth'
import * as collectionPathsDAL from '@/data/collectionPaths'
import type { ActionResult } from '@/lib/actionTypes'

// D-16: path_type is a fixed four-value vocabulary. The DB CHECK constraint is layer 1;
// this zod enum is layer 2 (application-level rejection before the DB call).
const PATH_TYPES = ['Going Deeper', 'Branching Out', 'Trading Up', 'Filling a Gap'] as const

// Mass-assignment protection: .strict() rejects unknown keys (T-45-16).
const createPathSchema = z
  .object({
    seedCatalogId: z.string().uuid(),
    pathType: z.enum(PATH_TYPES),
    rationale: z.string().max(2000).optional(),
  })
  .strict()

const updatePathSchema = z
  .object({
    pathId: z.string().uuid(),
    pathType: z.enum(PATH_TYPES).optional(),
    rationale: z.string().max(2000).nullable().optional(),
  })
  .strict()

// slot 0-2 (max 3 follow-ons, CMS-07)
const setPathNodeSchema = z
  .object({
    pathId: z.string().uuid(),
    slot: z.number().int().min(0).max(2),
    catalogId: z.string().uuid(),
    rationale: z.string().max(2000).nullable().optional(),
  })
  .strict()

// ---------------------------------------------------------------------------
// createCollectionPath
// ---------------------------------------------------------------------------
export async function createCollectionPath(data: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  const parsed = createPathSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid data' }
  try {
    const id = await collectionPathsDAL.createPath(parsed.data)
    return { success: true, data: { id } }
  } catch (err) {
    console.error('[createCollectionPath] unexpected error:', err)
    return { success: false, error: "Couldn't create path. Try again." }
  }
}

// ---------------------------------------------------------------------------
// updateCollectionPath
// ---------------------------------------------------------------------------
export async function updateCollectionPath(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  const parsed = updatePathSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid data' }
  try {
    const { pathId, ...fields } = parsed.data
    await collectionPathsDAL.updatePath(pathId, fields)
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[updateCollectionPath] unexpected error:', err)
    return { success: false, error: "Couldn't update path. Try again." }
  }
}

// ---------------------------------------------------------------------------
// deleteCollectionPath
// ---------------------------------------------------------------------------
export async function deleteCollectionPath(pathId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  try {
    await collectionPathsDAL.deletePath(pathId)
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[deleteCollectionPath] unexpected error:', err)
    return { success: false, error: "Couldn't delete path. Try again." }
  }
}

// ---------------------------------------------------------------------------
// setPathNode — pathId, slot 0-2, catalogId, rationale?
// ---------------------------------------------------------------------------
export async function setPathNode(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  const parsed = setPathNodeSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid data' }
  try {
    await collectionPathsDAL.setPathNode(parsed.data)
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[setPathNode] unexpected error:', err)
    return { success: false, error: "Couldn't set path node. Try again." }
  }
}

// ---------------------------------------------------------------------------
// removePathNode
// ---------------------------------------------------------------------------
export async function removePathNode(nodeId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  try {
    await collectionPathsDAL.removePathNode(nodeId)
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[removePathNode] unexpected error:', err)
    return { success: false, error: "Couldn't remove node. Try again." }
  }
}

// ---------------------------------------------------------------------------
// D-12: movePathUp / movePathDown — integer order column, up/down arrows
// ---------------------------------------------------------------------------
export async function movePathUp(pathId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  try {
    const paths = await collectionPathsDAL.getAllPathsForOwner()
    const idx = paths.findIndex((p) => p.id === pathId)
    if (idx <= 0) return { success: true, data: undefined } // already first
    const above = paths[idx - 1]
    const current = paths[idx]
    await collectionPathsDAL.swapPathSortOrder(
      current.id, current.sortOrder,
      above.id, above.sortOrder,
    )
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[movePathUp] unexpected error:', err)
    return { success: false, error: "Couldn't reorder paths. Try again." }
  }
}

export async function movePathDown(pathId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  try {
    const paths = await collectionPathsDAL.getAllPathsForOwner()
    const idx = paths.findIndex((p) => p.id === pathId)
    if (idx < 0 || idx >= paths.length - 1) return { success: true, data: undefined } // already last
    const below = paths[idx + 1]
    const current = paths[idx]
    await collectionPathsDAL.swapPathSortOrder(
      current.id, current.sortOrder,
      below.id, below.sortOrder,
    )
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[movePathDown] unexpected error:', err)
    return { success: false, error: "Couldn't reorder paths. Try again." }
  }
}

// ---------------------------------------------------------------------------
// publishCollectionPath / unpublishCollectionPath
// Both call revalidateTag('explore:hero', 'max') — two-arg form (Next.js 16).
// ---------------------------------------------------------------------------
export async function publishCollectionPath(pathId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  try {
    await collectionPathsDAL.setPathStatus(pathId, 'published')
    // CRITICAL: two-argument form — single-arg is deprecated in Next.js 16 (AGENTS.md).
    // revalidateTag not updateTag — hero cache is GLOBAL, not read-your-own-writes.
    revalidateTag('explore:hero', 'max')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[publishCollectionPath] unexpected error:', err)
    return { success: false, error: "Couldn't publish path. Try again." }
  }
}

export async function unpublishCollectionPath(pathId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }
  try {
    await collectionPathsDAL.setPathStatus(pathId, 'draft')
    // CRITICAL: two-argument form — single-arg is deprecated in Next.js 16 (AGENTS.md).
    revalidateTag('explore:hero', 'max')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[unpublishCollectionPath] unexpected error:', err)
    return { success: false, error: "Couldn't unpublish path. Try again." }
  }
}

'use server'

// CRITICAL: assertOwner() is the SOLE enforced security gate for every CMS Server Action.
// The admin layout redirect is UX only — Server Actions are HTTP-callable and bypass
// layout guards. The CMS DAL runs through the Drizzle `db` client (direct Postgres
// connection), which BYPASSES RLS — the migration's RLS write policies do NOT protect
// this code path (CR-01). They are a backstop for any future Supabase-JS-client
// access only (e.g. Phase 47 public reads). D-06.
//
// revalidateTag uses the two-argument form (single-arg is deprecated in Next.js 16).
// See node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md
// hero pin cache is GLOBAL — revalidateTag('explore:hero', 'max') is the correct
// primitive (stale-while-revalidate). See notifications.ts:14-55 for the source-level
// Next.js 16 rationale on why revalidateTag not updateTag is used for global caches.
//
// GAP-3: every mutation also revalidatePath()s the admin index + editor routes so a
// change is visible on back-navigation / after the action without a hard reload.

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { assertOwner } from '@/lib/auth'
import * as collectionPathsDAL from '@/data/collectionPaths'
import type { ActionResult } from '@/lib/actionTypes'

// GAP-3: invalidate the path index and the dynamic editor route together.
function revalidateAdminPaths() {
  revalidatePath('/admin/paths')
  revalidatePath('/admin/paths/[id]', 'page')
}

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
    revalidateAdminPaths()
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
    revalidateTag('explore:hero', 'max')
    // CR-01: path-type / rationale edits are rendered on WhereCollectionsGo
    // and /explore/paths — 'explore:paths' invalidates both cached surfaces.
    revalidateTag('explore:paths', 'max')
    revalidateAdminPaths()
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
    revalidateTag('explore:hero', 'max')
    // CR-01: a deleted path must drop off WhereCollectionsGo + /explore/paths
    // immediately, not after the cacheLife('hours') window.
    revalidateTag('explore:paths', 'max')
    revalidateAdminPaths()
    return { success: true, data: undefined }
  } catch (err) {
    // WR-01: forward a discriminable error on FK violation. Deleting a
    // collection_paths row cascades to collection_path_nodes, so this branch is
    // not expected to fire for path deletes — but if a future schema change
    // adds a RESTRICT reference, the client's FK-detection branch will match.
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('foreign key') || message.includes('violates foreign key constraint')) {
      return { success: false, error: 'Cannot delete — this path is still referenced. (foreign key)' }
    }
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
    revalidateTag('explore:hero', 'max')
    // CR-01: path nodes are the watch sequence rendered by PathCard on
    // WhereCollectionsGo and /explore/paths — invalidate the paths surface.
    revalidateTag('explore:paths', 'max')
    revalidateAdminPaths()
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
    revalidateTag('explore:hero', 'max')
    // CR-01: removing a node changes the watch sequence rendered by PathCard
    // on WhereCollectionsGo and /explore/paths — invalidate the paths surface.
    revalidateTag('explore:paths', 'max')
    revalidateAdminPaths()
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
    // WR-02: lookup + swap inside one transaction — no lost-update race.
    await collectionPathsDAL.movePathInTransaction(pathId, 'up')
    revalidateTag('explore:hero', 'max')
    // CR-01: reordering changes path order on WhereCollectionsGo rotation +
    // /explore/paths grouping — invalidate the paths surface.
    revalidateTag('explore:paths', 'max')
    revalidateAdminPaths()
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
    // WR-02: lookup + swap inside one transaction — no lost-update race.
    await collectionPathsDAL.movePathInTransaction(pathId, 'down')
    revalidateTag('explore:hero', 'max')
    // CR-01: reordering changes path order on WhereCollectionsGo rotation +
    // /explore/paths grouping — invalidate the paths surface.
    revalidateTag('explore:paths', 'max')
    revalidateAdminPaths()
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
    // CR-01: publishing a path must make it appear on WhereCollectionsGo +
    // /explore/paths immediately — the cached HTML is served without
    // re-running getPublishedPaths until this tag fires.
    revalidateTag('explore:paths', 'max')
    revalidateAdminPaths()
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
    // CR-01: DRAFT-LEAK FIX — unpublishing must drop the path off
    // WhereCollectionsGo + /explore/paths immediately. The status='published'
    // DAL filter does NOT help, because the cached HTML is served without
    // re-running the DAL until this tag fires.
    revalidateTag('explore:paths', 'max')
    revalidateAdminPaths()
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[unpublishCollectionPath] unexpected error:', err)
    return { success: false, error: "Couldn't unpublish path. Try again." }
  }
}

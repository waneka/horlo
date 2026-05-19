'use server'

// NOTE: Per AGENTS.md — read node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md
// before using revalidateTag. Confirmed: two-argument form revalidateTag(tag, 'max') is correct.
// Single-argument form is deprecated in Next.js 16.
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { assertOwner } from '@/lib/auth'
import * as curatedListsDAL from '@/data/curatedLists'
import type { ActionResult } from '@/lib/actionTypes'

// ----- Zod schemas (all use .strict() — mass-assignment protection, T-45-10) -----

const createListSchema = z
  .object({
    title: z.string().min(1).max(200),
    curatorName: z.string().min(1).max(100),
    coverUrl: z.string().url().max(500).nullable().optional(),
    introMarkdown: z.string().max(5000).nullable().optional(),
  })
  .strict()

const updateListSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    curatorName: z.string().min(1).max(100).optional(),
    coverUrl: z.string().url().max(500).nullable().optional(),
    introMarkdown: z.string().max(5000).nullable().optional(),
  })
  .strict()

const addWatchSchema = z
  .object({
    listId: z.string().uuid(),
    catalogId: z.string().uuid(),
    commentary: z.string().max(1000).nullable().optional(),
  })
  .strict()

const updateCommentarySchema = z
  .object({
    itemId: z.string().uuid(),
    commentary: z.string().max(1000).nullable(),
  })
  .strict()

// ----- CRUD actions -----

// CRITICAL: assertOwner() is the SOLE enforced security gate for every CMS Server Action.
// The admin layout redirect is UX only — SAs are HTTP-callable and bypass layout guards.
// The CMS DAL runs through the Drizzle `db` client (direct Postgres connection),
// which BYPASSES RLS — the migration's RLS write policies do NOT protect this code
// path (CR-01). They are a backstop for any future Supabase-JS-client access only.
// Three-block pattern: (1) assertOwner, (2) zod parse, (3) DAL call + revalidation.

export async function createCuratedList(data: unknown): Promise<ActionResult<{ id: string }>> {
  // Block 1: auth gate (D-06)
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  // Block 2: input validation
  const parsed = createListSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid list data' }
  }

  // Block 3: DAL call
  try {
    const id = await curatedListsDAL.createList(parsed.data)
    // GAP-3: a newly created list must appear on /admin/lists immediately.
    revalidatePath('/admin/lists')
    return { success: true, data: { id } }
  } catch (err) {
    console.error('[createCuratedList] unexpected error:', err)
    return { success: false, error: "Couldn't create list. Try again." }
  }
}

export async function updateCuratedList(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  const parsed = updateListSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid list data' }
  }

  try {
    const { id, ...fields } = parsed.data
    await curatedListsDAL.updateList(id, fields)
    // WR-03: title/cover/intro edits change a pinned hero's rendered content.
    revalidateTag('explore:hero', 'max')
    // CR-01: title/cover edits also change the rail card + see-all page —
    // 'explore:lists' tags CuratedListsRail and /explore/lists (and the
    // umbrella 'explore' tag both share). Without this the rail serves a
    // stale title/cover for the full cacheLife('hours') window.
    revalidateTag('explore:lists', 'max')
    // GAP-3: invalidate the admin index + editor route caches so a list change
    // is visible on back-navigation without a hard reload.
    revalidatePath('/admin/lists')
    revalidatePath('/admin/lists/[id]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[updateCuratedList] unexpected error:', err)
    return { success: false, error: "Couldn't update list. Try again." }
  }
}

export async function deleteCuratedList(listId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  try {
    await curatedListsDAL.deleteList(listId)
    // CR-01: a deleted list must drop off the public rail + see-all + hero
    // immediately, not after the cacheLife('hours') window. A deleted
    // (formerly published) list left in the cached HTML is a draft-leak by
    // another route.
    revalidateTag('explore:hero', 'max')
    revalidateTag('explore:lists', 'max')
    revalidatePath('/admin/lists')
    return { success: true, data: undefined }
  } catch (err) {
    // WR-01: forward a discriminable error on FK violation. Deleting a
    // curated_lists row cascades to curated_list_items, so this branch is not
    // expected to fire for list deletes — but if a future schema change adds a
    // RESTRICT reference, the client's FK-detection branch will now match.
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('foreign key') || message.includes('violates foreign key constraint')) {
      return { success: false, error: 'Cannot delete — this list is still referenced. (foreign key)' }
    }
    console.error('[deleteCuratedList] unexpected error:', err)
    return { success: false, error: "Couldn't delete list. Try again." }
  }
}

// ----- List item actions -----

export async function addWatchToList(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  const parsed = addWatchSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid item data' }
  }

  try {
    await curatedListsDAL.addListItem(parsed.data)
    // WR-03: adding a watch changes a pinned hero's rendered list contents.
    revalidateTag('explore:hero', 'max')
    // CR-01: adding a watch changes the rail card's watch count and the
    // see-all / detail page contents — invalidate the lists surface.
    revalidateTag('explore:lists', 'max')
    // GAP-3: invalidate the admin index + editor route caches so a list change
    // is visible on back-navigation without a hard reload.
    revalidatePath('/admin/lists')
    revalidatePath('/admin/lists/[id]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    // Surface clean error for duplicate (unique constraint violation)
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('unique') || message.includes('duplicate')) {
      return { success: false, error: 'This watch is already in the list.' }
    }
    console.error('[addWatchToList] unexpected error:', err)
    return { success: false, error: "Couldn't add watch to list. Try again." }
  }
}

export async function updateListItemCommentary(data: unknown): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  const parsed = updateCommentarySchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid commentary data' }
  }

  try {
    await curatedListsDAL.updateListItemCommentary(parsed.data.itemId, parsed.data.commentary)
    // WR-03: commentary edits change a pinned hero's rendered list contents.
    revalidateTag('explore:hero', 'max')
    // CR-01: commentary is rendered on the public /explore/lists/[id] detail
    // page — invalidate the lists surface so edits show immediately.
    revalidateTag('explore:lists', 'max')
    // GAP-3: invalidate the admin index + editor route caches so a list change
    // is visible on back-navigation without a hard reload.
    revalidatePath('/admin/lists')
    revalidatePath('/admin/lists/[id]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[updateListItemCommentary] unexpected error:', err)
    return { success: false, error: "Couldn't update commentary. Try again." }
  }
}

export async function removeWatchFromList(itemId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  try {
    await curatedListsDAL.removeListItem(itemId)
    // WR-03: removing a watch changes a pinned hero's rendered list contents.
    revalidateTag('explore:hero', 'max')
    // CR-01: removing a watch changes the rail card's watch count and the
    // see-all / detail page contents — invalidate the lists surface.
    revalidateTag('explore:lists', 'max')
    // GAP-3: invalidate the admin index + editor route caches so a list change
    // is visible on back-navigation without a hard reload.
    revalidatePath('/admin/lists')
    revalidatePath('/admin/lists/[id]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[removeWatchFromList] unexpected error:', err)
    return { success: false, error: "Couldn't remove watch from list. Try again." }
  }
}

// ----- D-12: List ordering (up/down arrow buttons — integer sort_order) -----

export async function moveListUp(listId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  try {
    // WR-02: lookup + swap inside one transaction — no lost-update race.
    await curatedListsDAL.moveListInTransaction(listId, 'up')
    // WR-03: reordering changes a pinned hero's rendered list ordering.
    revalidateTag('explore:hero', 'max')
    // CR-01: getPublishedLists orders by sortOrder — reordering changes the
    // rail card order and the see-all grid order. Invalidate the lists surface.
    revalidateTag('explore:lists', 'max')
    // GAP-3: invalidate the admin index + editor route caches so a list change
    // is visible on back-navigation without a hard reload.
    revalidatePath('/admin/lists')
    revalidatePath('/admin/lists/[id]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[moveListUp] unexpected error:', err)
    return { success: false, error: "Couldn't reorder list. Try again." }
  }
}

export async function moveListDown(listId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  try {
    // WR-02: lookup + swap inside one transaction — no lost-update race.
    await curatedListsDAL.moveListInTransaction(listId, 'down')
    // WR-03: reordering changes a pinned hero's rendered list ordering.
    revalidateTag('explore:hero', 'max')
    // CR-01: getPublishedLists orders by sortOrder — reordering changes the
    // rail card order and the see-all grid order. Invalidate the lists surface.
    revalidateTag('explore:lists', 'max')
    // GAP-3: invalidate the admin index + editor route caches so a list change
    // is visible on back-navigation without a hard reload.
    revalidatePath('/admin/lists')
    revalidatePath('/admin/lists/[id]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[moveListDown] unexpected error:', err)
    return { success: false, error: "Couldn't reorder list. Try again." }
  }
}

// ----- D-12: List item ordering (up/down arrow buttons) -----

export async function moveListItemUp(itemId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  try {
    // WR-02: lookup + swap inside one transaction — no lost-update race.
    const res = await curatedListsDAL.moveListItemInTransaction(itemId, 'up')
    if (!res.found) return { success: false, error: 'Item not found.' }
    // WR-03: item reorder changes a pinned hero's rendered list contents.
    revalidateTag('explore:hero', 'max')
    // CR-01: item order is rendered on the public /explore/lists/[id] detail
    // page — invalidate the lists surface so reorders show immediately.
    revalidateTag('explore:lists', 'max')
    // GAP-3: invalidate the admin index + editor route caches so a list change
    // is visible on back-navigation without a hard reload.
    revalidatePath('/admin/lists')
    revalidatePath('/admin/lists/[id]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[moveListItemUp] unexpected error:', err)
    return { success: false, error: "Couldn't reorder item. Try again." }
  }
}

export async function moveListItemDown(itemId: string): Promise<ActionResult<void>> {
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  try {
    // WR-02: lookup + swap inside one transaction — no lost-update race.
    const res = await curatedListsDAL.moveListItemInTransaction(itemId, 'down')
    if (!res.found) return { success: false, error: 'Item not found.' }
    // WR-03: item reorder changes a pinned hero's rendered list contents.
    revalidateTag('explore:hero', 'max')
    // CR-01: item order is rendered on the public /explore/lists/[id] detail
    // page — invalidate the lists surface so reorders show immediately.
    revalidateTag('explore:lists', 'max')
    // GAP-3: invalidate the admin index + editor route caches so a list change
    // is visible on back-navigation without a hard reload.
    revalidatePath('/admin/lists')
    revalidatePath('/admin/lists/[id]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[moveListItemDown] unexpected error:', err)
    return { success: false, error: "Couldn't reorder item. Try again." }
  }
}

// ----- Publish/unpublish (with zero-watch guard and hero cache revalidation) -----

export async function publishCuratedList(listId: string): Promise<ActionResult<void>> {
  // Block 1: auth gate (D-06)
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  // D-03 / CMS-06: zero-watch guard — check item count BEFORE setting status
  const count = await curatedListsDAL.getListItemCount(listId)
  if (count === 0) {
    return { success: false, error: 'Cannot publish a list with no watches.' }
  }

  try {
    await curatedListsDAL.setListStatus(listId, 'published')
    // CRITICAL: two-argument form — single-arg is deprecated in Next.js 16 (Pitfall 3).
    // hero is a GLOBAL shared cache — use revalidateTag (NOT updateTag which is read-your-own-writes).
    revalidateTag('explore:hero', 'max')
    // CR-01: publishing a list must make it appear on the rail + /explore/lists
    // immediately — getPublishedLists filters status='published', but the
    // CACHED HTML is served without re-running the DAL until this tag fires.
    revalidateTag('explore:lists', 'max')
    // GAP-3: invalidate the admin index + editor route caches so a list change
    // is visible on back-navigation without a hard reload.
    revalidatePath('/admin/lists')
    revalidatePath('/admin/lists/[id]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[publishCuratedList] unexpected error:', err)
    return { success: false, error: "Couldn't publish list. Try again." }
  }
}

export async function unpublishCuratedList(listId: string): Promise<ActionResult<void>> {
  // Block 1: auth gate (D-06)
  try {
    await assertOwner()
  } catch {
    return { success: false, error: 'Not authorized' }
  }

  try {
    await curatedListsDAL.setListStatus(listId, 'draft')
    // CRITICAL: two-argument form — single-arg is deprecated in Next.js 16 (Pitfall 3).
    // hero is a GLOBAL shared cache — use revalidateTag (NOT updateTag which is read-your-own-writes).
    revalidateTag('explore:hero', 'max')
    // CR-01: DRAFT-LEAK FIX — unpublishing must drop the list off the public
    // rail + /explore/lists immediately. The status='published' DAL filter
    // does NOT help, because the cached rail HTML is served without re-running
    // the DAL until this tag fires. Without it, an unpublished list stays
    // publicly visible for the full cacheLife('hours') window.
    revalidateTag('explore:lists', 'max')
    // GAP-3: invalidate the admin index + editor route caches so a list change
    // is visible on back-navigation without a hard reload.
    revalidatePath('/admin/lists')
    revalidatePath('/admin/lists/[id]', 'page')
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[unpublishCuratedList] unexpected error:', err)
    return { success: false, error: "Couldn't unpublish list. Try again." }
  }
}

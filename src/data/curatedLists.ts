import 'server-only'

import { db } from '@/db'
import { curatedLists, curatedListItems } from '@/db/schema'
import { eq, asc, sql } from 'drizzle-orm'

// ----- Public-read functions -----
// D-03 / CR-01: the explicit WHERE status='published' below is the SOLE enforced
// draft-leak gate for these DAL functions. The Drizzle `db` client connects
// directly to Postgres (DATABASE_URL) and BYPASSES RLS, so the migration's
// curated_lists_select_published RLS policy does NOT apply here — it is a
// backstop only for a future Supabase-JS-client read path. ALWAYS include the
// explicit filter; there is no RLS net under DAL reads.

export async function getPublishedLists(limit = 12) {
  return db
    .select()
    .from(curatedLists)
    .where(eq(curatedLists.status, 'published')) // explicit filter — SOLE draft-leak gate for DAL reads (CR-01)
    .orderBy(asc(curatedLists.sortOrder))
    .limit(limit)
}

// ----- Owner-read functions -----
// No status filter — owner reads all rows including drafts.
// (The owner-scoped RLS SELECT policy exists in the migration but is not in
//  effect here — the Drizzle `db` client bypasses RLS. CR-01.)

export async function getAllListsForOwner() {
  return db
    .select()
    .from(curatedLists)
    .orderBy(asc(curatedLists.sortOrder))
  // No status filter — owner reads all rows (the Drizzle db client bypasses RLS; CR-01)
}

export async function getListById(id: string) {
  const rows = await db
    .select()
    .from(curatedLists)
    .where(eq(curatedLists.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function getListWithItems(id: string) {
  const list = await getListById(id)
  if (!list) return null
  const items = await getListItems(id)
  return { ...list, items }
}

// ----- Item count helper for publish guard (CMS-06) -----

export async function getListItemCount(listId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(curatedListItems)
    .where(eq(curatedListItems.listId, listId))
  return result[0]?.count ?? 0
}

// ----- List CRUD helpers -----

export async function createList(data: {
  title: string
  curatorName: string
  coverUrl?: string | null
  introMarkdown?: string | null
}): Promise<string> {
  const rows = await db
    .insert(curatedLists)
    .values({
      title: data.title,
      curatorName: data.curatorName,
      coverUrl: data.coverUrl ?? null,
      introMarkdown: data.introMarkdown ?? null,
    })
    .returning({ id: curatedLists.id })
  return rows[0].id
}

export async function updateList(
  id: string,
  data: {
    title?: string
    curatorName?: string
    coverUrl?: string | null
    introMarkdown?: string | null
  }
) {
  await db
    .update(curatedLists)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(curatedLists.id, id))
}

export async function deleteList(id: string) {
  await db.delete(curatedLists).where(eq(curatedLists.id, id))
}

export async function setListStatus(id: string, status: 'draft' | 'published') {
  await db
    .update(curatedLists)
    .set({ status, updatedAt: new Date() })
    .where(eq(curatedLists.id, id))
}

// ----- D-12: Sort-order swap in a transaction (integer-order up/down arrows) -----

export async function swapListSortOrder(
  idA: string,
  orderA: number,
  idB: string,
  orderB: number
) {
  await db.transaction(async (tx) => {
    await tx.update(curatedLists).set({ sortOrder: orderB }).where(eq(curatedLists.id, idA))
    await tx.update(curatedLists).set({ sortOrder: orderA }).where(eq(curatedLists.id, idB))
  })
}

// ----- WR-02: transactional reorder — re-select inside the tx so the swap
// uses fresh sortOrder values, eliminating the lost-update race between a
// separate fetch and a separate swap. `direction` picks the neighbour. -----

export async function moveListInTransaction(listId: string, direction: 'up' | 'down') {
  await db.transaction(async (tx) => {
    const lists = await tx
      .select({ id: curatedLists.id, sortOrder: curatedLists.sortOrder })
      .from(curatedLists)
      .orderBy(asc(curatedLists.sortOrder))
    const idx = lists.findIndex((l) => l.id === listId)
    if (idx === -1) return
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1
    if (neighborIdx < 0 || neighborIdx >= lists.length) return // already at edge — no-op
    const current = lists[idx]
    const neighbor = lists[neighborIdx]
    await tx.update(curatedLists).set({ sortOrder: neighbor.sortOrder }).where(eq(curatedLists.id, current.id))
    await tx.update(curatedLists).set({ sortOrder: current.sortOrder }).where(eq(curatedLists.id, neighbor.id))
  })
}

// ----- List item helpers -----

export async function getListItems(listId: string) {
  return db
    .select()
    .from(curatedListItems)
    .where(eq(curatedListItems.listId, listId))
    .orderBy(asc(curatedListItems.sortOrder))
}

export async function addListItem(data: {
  listId: string
  catalogId: string
  commentary?: string | null
}): Promise<string> {
  // The unique constraint curated_list_items_unique_pair enforces no duplicate watch in a list.
  // If the catalog watch is already in the list, the DB will throw a unique violation.
  const rows = await db
    .insert(curatedListItems)
    .values({
      listId: data.listId,
      catalogId: data.catalogId,
      commentary: data.commentary ?? null,
    })
    .returning({ id: curatedListItems.id })
  return rows[0].id
}

export async function updateListItemCommentary(itemId: string, commentary: string | null) {
  await db
    .update(curatedListItems)
    .set({ commentary })
    .where(eq(curatedListItems.id, itemId))
}

export async function removeListItem(itemId: string) {
  await db.delete(curatedListItems).where(eq(curatedListItems.id, itemId))
}

export async function getListItemById(itemId: string) {
  const rows = await db
    .select()
    .from(curatedListItems)
    .where(eq(curatedListItems.id, itemId))
    .limit(1)
  return rows[0] ?? null
}

// ----- D-12: List item sort-order swap in a transaction -----

export async function swapListItemSortOrder(
  idA: string,
  orderA: number,
  idB: string,
  orderB: number
) {
  await db.transaction(async (tx) => {
    await tx.update(curatedListItems).set({ sortOrder: orderB }).where(eq(curatedListItems.id, idA))
    await tx.update(curatedListItems).set({ sortOrder: orderA }).where(eq(curatedListItems.id, idB))
  })
}

// ----- WR-02: transactional list-item reorder — re-select inside the tx -----

export async function moveListItemInTransaction(itemId: string, direction: 'up' | 'down') {
  return db.transaction(async (tx) => {
    const target = await tx
      .select({ id: curatedListItems.id, listId: curatedListItems.listId })
      .from(curatedListItems)
      .where(eq(curatedListItems.id, itemId))
      .limit(1)
    if (!target[0]) return { found: false as const }
    const items = await tx
      .select({ id: curatedListItems.id, sortOrder: curatedListItems.sortOrder })
      .from(curatedListItems)
      .where(eq(curatedListItems.listId, target[0].listId))
      .orderBy(asc(curatedListItems.sortOrder))
    const idx = items.findIndex((i) => i.id === itemId)
    if (idx === -1) return { found: true as const }
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1
    if (neighborIdx < 0 || neighborIdx >= items.length) return { found: true as const }
    const current = items[idx]
    const neighbor = items[neighborIdx]
    await tx.update(curatedListItems).set({ sortOrder: neighbor.sortOrder }).where(eq(curatedListItems.id, current.id))
    await tx.update(curatedListItems).set({ sortOrder: current.sortOrder }).where(eq(curatedListItems.id, neighbor.id))
    return { found: true as const }
  })
}

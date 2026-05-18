import 'server-only'

import { db } from '@/db'
import { curatedLists, curatedListItems } from '@/db/schema'
import { eq, asc, sql } from 'drizzle-orm'

// ----- Public-read functions -----
// D-03: Two-layer draft defense:
//   Layer 1 — RLS USING(status='published') in supabase/migrations/...
//   Layer 2 — explicit WHERE status='published' in every public-read DAL function (here).
// ALWAYS include this explicit filter. RLS alone is insufficient per D-03.

export async function getPublishedLists(limit = 12) {
  return db
    .select()
    .from(curatedLists)
    .where(eq(curatedLists.status, 'published')) // explicit filter — always present (D-03 layer 2)
    .orderBy(asc(curatedLists.sortOrder))
    .limit(limit)
}

// ----- Owner-read functions -----
// No status filter — owner reads all rows including drafts.
// RLS owner SELECT policy (EXISTS is_admin predicate) permits this.

export async function getAllListsForOwner() {
  return db
    .select()
    .from(curatedLists)
    .orderBy(asc(curatedLists.sortOrder))
  // No status filter — owner reads all rows; RLS owner SELECT policy permits this
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

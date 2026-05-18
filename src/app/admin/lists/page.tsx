// /admin/lists — server component. Layout.tsx already guards this segment.
// Fetches all lists (owner-read, includes drafts) and passes to ListIndexClient.
// The "New List" button lives inside ListIndexClient (must invoke a Server Action).

import { getAllListsForOwner } from '@/data/curatedLists'
import { AdminSubNav } from '@/components/admin/AdminSubNav'
import { ListIndexClient } from '@/components/admin/ListIndexClient'

export default async function AdminListsPage() {
  const lists = await getAllListsForOwner()

  return (
    <>
      <AdminSubNav />
      <h1 className="text-xl font-semibold mb-6">Curated Lists</h1>
      <ListIndexClient lists={lists} />
    </>
  )
}

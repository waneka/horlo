// /admin/paths — server component. Layout.tsx already guards this segment.
// Fetches all paths (owner-read, includes drafts) and passes to PathIndexClient.
// The "New Path" control lives inside PathIndexClient (must invoke a Server Action).

import { getAllPathsForOwner } from '@/data/collectionPaths'
import { AdminSubNav } from '@/components/admin/AdminSubNav'
import { PathIndexClient } from '@/components/admin/PathIndexClient'

export default async function AdminPathsPage() {
  const paths = await getAllPathsForOwner()

  return (
    <>
      <AdminSubNav />
      <h1 className="text-xl font-semibold mb-6">Collection Paths</h1>
      <PathIndexClient paths={paths} />
    </>
  )
}

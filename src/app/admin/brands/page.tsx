// /admin/brands — Server Component. Layout.tsx already guards this segment via assertOwner().
// Fetches all brands (needs_review DESC, name ASC) + full brand list for the merge-target picker.
// No 'use cache' — admin pages are standard dynamic Server Components (no PPR opt-out needed).

import { listBrandsForQueue } from '@/data/brands'
import { listBrands } from '@/data/catalog'
import { AdminSubNav } from '@/components/admin/AdminSubNav'
import { BrandsQueue } from '@/components/admin/BrandsQueue'

export default async function AdminBrandsPage() {
  const [brands, allBrands] = await Promise.all([
    listBrandsForQueue(),
    listBrands(),
  ])

  return (
    <>
      <AdminSubNav />
      <h1 className="text-xl font-semibold mb-6">Brands</h1>
      <BrandsQueue brands={brands} allBrands={allBrands} />
    </>
  )
}

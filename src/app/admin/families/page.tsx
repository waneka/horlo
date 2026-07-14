// /admin/families — Server Component. Admin layout guard (assertOwner) lives in layout.tsx.
// Reads optional ?brandId= searchParam, validates as UUID (T-82-05 mitigation), then
// fetches watch_families for the queue + optionally resolves the brand name for the
// filter banner copy.
import { z } from 'zod'
import { AdminSubNav } from '@/components/admin/AdminSubNav'
import { FamiliesQueue } from '@/components/admin/FamiliesQueue'
import { listFamiliesForQueue, getBrandNameById } from '@/data/families'

interface FamiliesPageProps {
  searchParams: Promise<{ brandId?: string }>
}

// T-82-05: Zod uuid() validates brandId before use — fail-safe to null on invalid input.
const brandIdParam = z.string().uuid()

export default async function AdminFamiliesPage({ searchParams }: FamiliesPageProps) {
  const sp = await searchParams
  // Zod uuid() validates before consumption — invalid → fail-safe to null → no filter
  const parsed = sp.brandId ? brandIdParam.safeParse(sp.brandId) : null
  const brandIdFilter = parsed?.success ? parsed.data : null

  const [families, filterBrandName] = await Promise.all([
    listFamiliesForQueue(brandIdFilter),
    brandIdFilter ? getBrandNameById(brandIdFilter) : Promise.resolve(null),
  ])

  return (
    <>
      <AdminSubNav />
      <h1 className="text-xl font-semibold mb-6">Families</h1>
      <FamiliesQueue
        families={families}
        brandIdFilter={brandIdFilter}
        filterBrandName={filterBrandName}
      />
    </>
  )
}

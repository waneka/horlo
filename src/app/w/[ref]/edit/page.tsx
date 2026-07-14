import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getWatchById } from '@/data/watches'
import { WatchForm } from '@/components/watch/WatchForm'

interface EditWatchPageProps {
  params: Promise<{ ref: string }>
}

/**
 * Phase 59 D-09 — Edit form at /w/[ref]/edit (moved from /watch/[id]/edit).
 *
 * The `ref` on the edit route is ALWAYS a watches.id — only owners reach the
 * edit form. `getWatchById` is owner-scoped: a non-owner resolves null →
 * notFound(), which is the owner-only gate (ROUTE-06/D-15/T-59-07).
 *
 * No server redirects (D-02/D-08 — Router Cache poisoning avoidance).
 *
 * Phase 82-03 D-82-07: SSR-fetch viewer's is_admin from profiles, mirroring
 * the SEED-018 pattern at /watch/new page.tsx L100-104. Defensive: a fetch
 * error or missing row collapses to viewerIsAdmin=false (fail-closed).
 */
export default async function EditWatchPage({ params }: EditWatchPageProps) {
  const { ref } = await params
  const user = await getCurrentUser()

  const supabase = await createSupabaseServerClient()
  const [watch, profileAdminRow] = await Promise.all([
    getWatchById(user.id, ref),
    supabase.from('profiles').select('is_admin').eq('id', user.id).single(),
  ])

  if (!watch) {
    notFound()
  }

  const viewerIsAdmin = Boolean(profileAdminRow?.data?.is_admin)

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-8">Edit Watch</h1>
      <WatchForm watch={watch} mode="edit" viewerIsAdmin={viewerIsAdmin} />
    </div>
  )
}

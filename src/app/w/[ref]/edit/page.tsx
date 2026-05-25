import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
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
 */
export default async function EditWatchPage({ params }: EditWatchPageProps) {
  const { ref } = await params
  const user = await getCurrentUser()
  const watch = await getWatchById(user.id, ref)

  if (!watch) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-8">Edit Watch</h1>
      <WatchForm watch={watch} mode="edit" />
    </div>
  )
}

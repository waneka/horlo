import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getWatchById } from '@/data/watches'
import { WatchForm } from '@/components/watch/WatchForm'

interface EditWatchPageProps {
  params: Promise<{ id: string }>
}

export default async function EditWatchPage({ params }: EditWatchPageProps) {
  const { id } = await params
  const user = await getCurrentUser()
  const watch = await getWatchById(user.id, id)

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

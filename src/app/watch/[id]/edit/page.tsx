'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { useWatchStore } from '@/store/watchStore'
import { useIsHydrated } from '@/lib/hooks/useIsHydrated'
import { WatchForm } from '@/components/watch/WatchForm'

interface EditWatchPageProps {
  params: Promise<{ id: string }>
}

export default function EditWatchPage({ params }: EditWatchPageProps) {
  const { id } = use(params)
  const { getWatchById } = useWatchStore()
  const hydrated = useIsHydrated()

  if (!hydrated) {
    return <div className="container mx-auto px-4 py-8 max-w-3xl" />
  }

  const watch = getWatchById(id)
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

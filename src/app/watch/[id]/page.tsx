'use client'

import { use } from 'react'
import { notFound } from 'next/navigation'
import { useWatchStore } from '@/store/watchStore'
import { useIsHydrated } from '@/lib/hooks/useIsHydrated'
import { WatchDetail } from '@/components/watch/WatchDetail'

interface WatchPageProps {
  params: Promise<{ id: string }>
}

export default function WatchPage({ params }: WatchPageProps) {
  const { id } = use(params)
  const { getWatchById } = useWatchStore()
  const hydrated = useIsHydrated()

  if (!hydrated) {
    return <div className="container mx-auto px-4 py-8 max-w-4xl" />
  }

  const watch = getWatchById(id)
  if (!watch) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <WatchDetail watch={watch} />
    </div>
  )
}

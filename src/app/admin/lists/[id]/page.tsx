// /admin/lists/[id] — server component. Layout.tsx already guards this segment.
// Awaits dynamic params (Next.js 16 — params is a Promise).
// Fetches list with items + CMS settings (for hero-pin state).

import { notFound } from 'next/navigation'
import { getListWithItems } from '@/data/curatedLists'
import { getCmsSettings } from '@/data/cmsSettings'
import { AdminSubNav } from '@/components/admin/AdminSubNav'
import { ListEditorClient } from '@/components/admin/ListEditorClient'

export default async function AdminListEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // AGENTS.md: params is a Promise in Next.js 16 — must be awaited.
  const { id } = await params
  const [list, settings] = await Promise.all([
    getListWithItems(id),
    getCmsSettings(),
  ])
  if (!list) notFound()

  const isPinned = settings.pinnedListId === id

  return (
    <>
      <AdminSubNav />
      <ListEditorClient list={list} isPinned={isPinned} />
    </>
  )
}

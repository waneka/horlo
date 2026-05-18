// /admin/paths/[id] — server component. Layout.tsx already guards this segment.
// Awaits dynamic params (Next.js 16 — params is a Promise).
// Fetches path with nodes, calls notFound() if absent.

import { notFound } from 'next/navigation'
import { getPathWithNodes } from '@/data/collectionPaths'
import { AdminSubNav } from '@/components/admin/AdminSubNav'
import { PathEditorClient } from '@/components/admin/PathEditorClient'

export default async function AdminPathEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // AGENTS.md: params is a Promise in Next.js 16 — must be awaited.
  const { id } = await params
  const path = await getPathWithNodes(id)
  if (!path) notFound()

  return (
    <>
      <AdminSubNav />
      <PathEditorClient path={path} />
    </>
  )
}

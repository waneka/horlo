// TEMPORARY diagnostic — quick task 260614-f82.
// Reports which database the deployed app is talking to and counts a few rows.
// REMOVE AFTER the /admin/lists empty-state investigation is resolved.
//
// Admin-gated via assertOwner() — non-admins get 401.
// Sanitizes credentials before responding.

import { NextResponse } from 'next/server'
import { db } from '@/db'
import { curatedLists, collectionPaths, watchesCatalog } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { assertOwner } from '@/lib/auth'

export async function GET() {
  try {
    await assertOwner()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const dbUrl = process.env.DATABASE_URL ?? ''
  let host = 'UNKNOWN'
  let port = 'UNKNOWN'
  let projectRef: string | null = null
  try {
    const u = new URL(dbUrl.replace('postgresql://', 'http://'))
    host = u.hostname
    port = u.port
    const match = u.username.match(/postgres\.([a-z0-9]+)/i)
    projectRef = match?.[1] ?? null
  } catch {
    // ignore parse failures
  }

  const [listsCount, pathsCount, catalogCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(curatedLists),
    db.select({ count: sql<number>`count(*)::int` }).from(collectionPaths),
    db.select({ count: sql<number>`count(*)::int` }).from(watchesCatalog),
  ])

  const sampleLists = await db
    .select({
      title: curatedLists.title,
      curator: curatedLists.curatorName,
      status: curatedLists.status,
    })
    .from(curatedLists)
    .limit(3)

  return NextResponse.json({
    db: { host, port, projectRef },
    counts: {
      curated_lists: listsCount[0]?.count ?? 0,
      collection_paths: pathsCount[0]?.count ?? 0,
      watches_catalog: catalogCount[0]?.count ?? 0,
    },
    sampleLists,
  })
}

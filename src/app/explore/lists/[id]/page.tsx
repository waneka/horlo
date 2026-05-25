// src/app/explore/lists/[id]/page.tsx
// Phase 47 Plan 02 — Curated list detail page (EXPL-07, D-06).
//
// Magazine-style detail page: markdown intro copy at top, followed by per-item
// editorial rows (watch image + curator commentary). Each watch links to /catalog/[catalogId].
//
// Auth: getCurrentUser() is the FIRST statement in the page body.
// Security: T-47-07 — getListWithItems filters status='published'; draft id → null → notFound().
// Security: T-47-05 — introMarkdown rendered via ReactMarkdown + rehypeSanitize (XSS control, CR-02).
//
// Pattern: genres/page.tsx (auth + data fetch + render) + MarkdownEditor (react-markdown + prose).

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

import { getCurrentUser } from '@/lib/auth'
import { getListWithItems } from '@/data/curatedLists'
// WR-06: getRelativeTimestamp is now a single shared definition in
// src/lib/relativeTime.ts (was copy-pasted verbatim here and in RailListCard).
import { getRelativeTimestamp } from '@/lib/relativeTime'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const list = await getListWithItems(id)
  if (!list) return { title: 'List Not Found — Horlo' }
  return { title: `${list.title} — Horlo` }
}

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Auth assertion — must stay OUTSIDE any 'use cache' boundary.
  await getCurrentUser()

  const { id } = await params
  const list = await getListWithItems(id)

  // T-47-07: getListWithItems filters status='published'; draft resolves to null.
  if (!list) notFound()

  // CR-02: derive the displayed count from the already-fetched items so the
  // header count and the rendered editorial rows are guaranteed consistent.
  // The previous separate getListItemCount(id) counted curated_list_items
  // directly, while list.items is the result of an innerJoin against
  // watches_catalog — the two could disagree and the header would claim a
  // different watch count than the rows actually rendered. Dropping the
  // separate call also removes one DB round-trip per page load.
  const watchCount = list.items.length
  const timestamp = getRelativeTimestamp(list.publishedAt ?? null)

  return (
    <main className="container mx-auto px-4 md:px-8 py-8 max-w-3xl">
      {/* Back nav */}
      <Link
        href="/explore/lists"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-6"
      >
        <ChevronLeft className="size-4" aria-hidden />
        All lists
      </Link>

      {/* List header */}
      <div className="mb-8">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          {list.curatorName}
        </p>
        <h1 className="text-2xl font-semibold text-foreground leading-tight">
          {list.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {watchCount} watches{timestamp ? ` · ${timestamp}` : ''}
        </p>
      </div>

      {/* Markdown intro copy — REQUIRED: prose wrapper + rehypeSanitize (CR-02, T-47-05) */}
      {list.introMarkdown && (
        <div className="prose prose-sm dark:prose-invert max-w-none mb-10">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{list.introMarkdown}</ReactMarkdown>
        </div>
      )}

      {/* Editorial rows */}
      {list.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">This list has no watches yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {list.items.map((item) => (
            <div key={item.id} className="flex flex-col md:flex-row gap-4 py-6">
              {/* Watch image — UI-SPEC CSS Chain: w-full md:w-40 aspect-square + overflow-hidden + w-full h-full object-cover */}
              <Link href={`/w/${item.catalogId}`} className="shrink-0">
                <div className="w-full md:w-40 aspect-square rounded-md bg-muted overflow-hidden">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={`${item.brand} ${item.model}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">No image</span>
                    </div>
                  )}
                </div>
              </Link>

              {/* Commentary prose */}
              <div className="flex-1 min-w-0">
                <Link href={`/w/${item.catalogId}`} className="group">
                  <p className="text-sm font-semibold text-foreground group-hover:underline">
                    {item.brand}
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">
                    {item.model}{item.reference ? ` · ${item.reference}` : ''}
                  </p>
                </Link>
                {/* WR-01: item.commentary is curator-authored editorial copy.
                    It is INTENTIONALLY rendered as an escaped plain-text JSX
                    child — React escapes it, so there is no XSS here. If this
                    field is ever "upgraded" to markdown for parity with the
                    intro copy, it MUST route through ReactMarkdown with
                    rehypePlugins={[rehypeSanitize]} (see the introMarkdown
                    block above). Do NOT use dangerouslySetInnerHTML. */}
                {item.commentary && (
                  <p className="text-sm text-foreground leading-relaxed">{item.commentary}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

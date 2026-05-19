// src/components/explore/PathCard.tsx
//
// PathCard — sub-component for WhereCollectionsGo and /explore/paths.
//
// Renders a single curated collection path with:
//   - A path-type chip via Badge (D-14)
//   - Mobile layout (D-11): numbered vertical stack with connector lines, ≥360px
//   - Desktop layout (D-12): horizontal sequence with ChevronRight connectors
//
// Nodes: seed watch (index 0) + follow-on nodes (index 1+), ordered by sortOrder.
// Each watch node links to /catalog/[catalogId] (D-14).
//
// CSS chains explicitly declared per feedback_ui_spec_css_chain_blind_spot memory:
//   Connector line: w-px flex-1 bg-border min-h-[24px] inside flex-col items-center
//   Desktop node image: aspect-square rounded-md bg-muted overflow-hidden + w-full h-full object-cover

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ---- Node type ----
// Covers both seed watch + follow-on nodes from getPathWithNodes
type PathNode = {
  id: string
  catalogId: string
  brand: string
  model: string
  reference?: string | null
  rationale?: string | null
  imageUrl?: string | null
  sortOrder: number
}

type PathCardPath = {
  id: string
  pathType: string
  rationale?: string | null
  seedCatalogId: string
}

type PathWithNodes = PathCardPath & {
  nodes: Array<Omit<PathNode, 'id' | 'catalogId'> & { id: string; catalogId: string }>
  seedWatch: { brand: string; model: string; reference?: string | null; imageUrl?: string | null } | null
}

interface PathCardProps {
  pathWithNodes: PathWithNodes
}

export function PathCard({ pathWithNodes }: PathCardProps) {
  const { pathType, seedCatalogId, nodes, seedWatch } = pathWithNodes

  // Build ordered node list: seed watch first (node #1), then follow-ons sorted by sortOrder
  // Seed watch needs a synthetic id/catalogId for the key and link
  const seedNode: PathNode | null = seedWatch
    ? {
        id: `${pathWithNodes.id}-seed`,
        catalogId: seedCatalogId,
        brand: seedWatch.brand,
        model: seedWatch.model,
        reference: seedWatch.reference,
        rationale: pathWithNodes.rationale ?? null, // seed carries the PATH-level curator rationale
        imageUrl: seedWatch.imageUrl,
        sortOrder: -1, // renders before follow-ons
      }
    : null

  const sortedNodes = [...nodes].sort((a, b) => a.sortOrder - b.sortOrder)
  const allNodes: PathNode[] = seedNode ? [seedNode, ...sortedNodes] : sortedNodes

  return (
    <div className="space-y-3">
      {/* D-14: path-type chip above the path sequence */}
      <Badge variant="secondary" className="text-xs">
        {pathType}
      </Badge>

      {/* D-11: Mobile — numbered vertical stack (md:hidden) */}
      <div className="flex flex-col gap-3 md:hidden">
        {allNodes.map((node, i) => (
          <div key={node.id} className="flex gap-3 items-start">
            {/* Left column: number badge + connector line */}
            <div className="flex flex-col items-center gap-1">
              <span className="flex items-center justify-center size-6 rounded-full bg-accent text-accent-foreground text-xs font-semibold shrink-0">
                {i + 1}
              </span>
              {/* Connector line — omit on the last node */}
              {i < allNodes.length - 1 && (
                <div className="w-px flex-1 bg-border min-h-[24px]" />
              )}
            </div>
            {/* Right column: watch brand+model link + rationale */}
            <div className="flex-1 pb-2">
              <Link href={`/catalog/${node.catalogId}`}>
                <p className="text-sm font-semibold text-foreground">
                  {node.brand} {node.model}
                </p>
              </Link>
              {/* WR-01: node.rationale is curator-authored editorial copy,
                  INTENTIONALLY rendered as an escaped plain-text JSX child
                  (React escapes it — no XSS). Any future move to markdown MUST
                  route through ReactMarkdown + rehypePlugins={[rehypeSanitize]}.
                  Never use dangerouslySetInnerHTML for curator copy. */}
              {node.rationale && (
                <p className="text-sm text-muted-foreground">{node.rationale}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* D-12: Desktop — horizontal sequence with ChevronRight connectors (hidden md:flex) */}
      <div className="hidden md:flex gap-4 items-start">
        {allNodes.map((node, i) => (
          <Fragment key={node.id}>
            <div className="flex-1 min-w-0 max-w-[208px] space-y-2">
              {/* Watch image — DiscoveryWatchCard CSS chain: aspect-square + overflow-hidden + object-cover */}
              {/* group + relative: positioning context for the hover CTA overlay (Task 3) */}
              <div className="aspect-square rounded-md bg-muted overflow-hidden group relative">
                {node.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={node.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : null}
                {/* Hover CTA overlay — bottom-anchored, desktop-only, pure CSS (no JS state) */}
                <div className="absolute inset-x-0 bottom-0 flex items-end p-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <Button
                    render={<Link href={`/catalog/${node.catalogId}`} />}
                    variant="secondary"
                    size="sm"
                    className="w-full min-h-[44px]"
                  >
                    Watch Details
                  </Button>
                </div>
              </div>
              <Link href={`/catalog/${node.catalogId}`}>
                <p className="text-sm font-semibold text-foreground truncate">
                  {node.brand} {node.model}
                </p>
              </Link>
              {/* WR-01: node.rationale is curator-authored editorial copy,
                  INTENTIONALLY rendered as an escaped plain-text JSX child
                  (React escapes it — no XSS). Any future move to markdown MUST
                  route through ReactMarkdown + rehypePlugins={[rehypeSanitize]}.
                  Never use dangerouslySetInnerHTML for curator copy. */}
              {node.rationale && (
                <p className="text-sm text-muted-foreground">{node.rationale}</p>
              )}
            </div>
            {/* ChevronRight connector — omit after the last node */}
            {i < allNodes.length - 1 && (
              <ChevronRight className="size-5 text-muted-foreground mt-10 shrink-0" />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

import Link from 'next/link'
import Image from 'next/image'
import { Watch as WatchIcon } from 'lucide-react'

import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import { HighlightedText } from '@/components/search/HighlightedText'
import type { SearchCollectionResult } from '@/lib/searchTypes'

/**
 * Phase 19 Collections Search row (SRCH-11).
 *
 * Mirrors PeopleSearchRow visual grammar with two key differences:
 *   1. Click target → /u/{username}/collection (D-07; same as PeopleSearchRow)
 *      but no inline FollowButton (Collections row has no right-side button per
 *      UI-SPEC line 114-127).
 *   2. The "shared-watch cluster" becomes a "matched-watch cluster" — shows the
 *      watches that MATCHED the query, not the shared-with-viewer ones (D-11).
 *
 * Match-summary copy matrix (UI-SPEC lines 202-205):
 *   - 1 watch, name match: `owns {brand} {model}`
 *   - N watches, primary name match: `owns {brand} {model} + {N-1} more`
 *   - tag-only (all matchedWatches have matchPath==='tag'): `{matchCount} matching watches`
 *   - mixed (any name match alongside tags): `{matchCount} matches`
 *
 * Matched-tag pills (D-11): rendered after the cluster when matchedTags is
 * non-empty. Each pill: bg-muted text-muted-foreground text-xs.
 *
 * SRCH-15: displayName + matched-watch brand/model are wrapped in
 * <HighlightedText>; XSS-safe by construction (Phase 16 carry-forward).
 * Matched-watch thumbs carry an aria-label containing brand + model so the
 * cluster is announced even when text-only highlighting is hidden by sm:flex.
 */
export function CollectionSearchRow({
  result,
  q,
}: {
  result: SearchCollectionResult
  q: string
}) {
  const name = result.displayName ?? result.username

  // Match-summary copy matrix (D-11 / UI-SPEC).
  const summary = computeMatchSummary(result)

  return (
    <div className="group relative flex items-center gap-4 min-h-16 md:min-h-20 bg-card px-4 py-3 rounded-md transition-colors hover:bg-muted/40">
      <Link
        href={`/u/${result.username}/collection`}
        aria-label={`${name}'s collection`}
        className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <AvatarDisplay
        avatarUrl={result.avatarUrl}
        displayName={result.displayName}
        username={result.username}
        size={40}
      />
      <div className="relative flex-1 min-w-0 pointer-events-none">
        <p className="text-sm font-semibold truncate">
          <HighlightedText text={name} q={q} />
        </p>
        <p className="text-sm text-muted-foreground truncate">{summary}</p>
      </div>
      {result.matchedWatches.length > 0 && (
        <div className="relative hidden sm:flex items-center pointer-events-none">
          {result.matchedWatches.slice(0, 3).map((w, i) => (
            <div
              key={w.watchId}
              className="size-10 md:size-12 rounded-full bg-muted ring-2 ring-card overflow-hidden flex items-center justify-center"
              style={{ marginLeft: i === 0 ? 0 : '-0.5rem' }}
              aria-label={`${w.brand} ${w.model}`}
            >
              {w.imageUrl ? (
                <Image
                  src={w.imageUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <WatchIcon className="size-4 text-muted-foreground" aria-hidden />
              )}
            </div>
          ))}
        </div>
      )}
      {result.matchedTags.length > 0 && (
        <div className="relative hidden sm:flex gap-1 pointer-events-none">
          {result.matchedTags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function computeMatchSummary(result: SearchCollectionResult): string {
  const { matchedWatches, matchCount } = result
  const hasNameMatch = matchedWatches.some((w) => w.matchPath === 'name')
  const hasTagMatch = matchedWatches.some((w) => w.matchPath === 'tag')

  // 1 watch + name match → "owns {brand} {model}"
  if (matchCount === 1 && matchedWatches[0]?.matchPath === 'name') {
    const w = matchedWatches[0]
    return `owns ${w.brand} ${w.model}`
  }
  // N watches + primary name match
  if (hasNameMatch && matchCount > 1) {
    const first = matchedWatches.find((w) => w.matchPath === 'name')!
    if (hasTagMatch) {
      // Mixed (name + tag) → "{matchCount} matches"
      return `${matchCount} matches`
    }
    return `owns ${first.brand} ${first.model} + ${matchCount - 1} more`
  }
  // Tag-only
  if (!hasNameMatch && hasTagMatch) {
    return `${matchCount} matching watches`
  }
  return `${matchCount} matches`
}

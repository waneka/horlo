// src/components/explore/HeroModule.tsx
//
// Hero Module — Phase 47 EXPL-08.
//
// Quality-gated featured list hero with manual pin override and weekly rotation
// fallback. Returns null when no eligible content exists (EXPL-02 absent-not-empty).
//
// Cache scope: 'explore:hero' tag ONLY (not 'explore') — the Hero revalidates on
// editorial pin/publish changes via the pre-wired Phase 45 revalidateTag calls.
// Generic explore invalidation must NOT invalidate the Hero independently.
//
// D-08 quality gate: a list is eligible iff
//   - itemCount >= 3
//   - coverUrl is non-empty (truthy)
//   - introMarkdown is non-empty (truthy)
//
// D-09 pin override: if settings.pinnedListId is set AND (pinExpiresAt is null
// OR pinExpiresAt > now), use the matching eligible list. If the pinned list is
// not in the eligible pool, fall through to weekly rotation.
//
// D-07 weekly rotation: sort eligible pool by publishedAt asc then id (stable),
// compute getWeekIndex(new Date()), select sorted[week % sorted.length].
//
// T-47-12: No getCurrentUser() in this file — auth is asserted once in page.tsx
// outside any cache scope. Viewer-identity must NOT enter globally-shared cache entries.

import { cacheLife, cacheTag } from 'next/cache'
import Link from 'next/link'

import { getCmsSettings } from '@/data/cmsSettings'
import { getPublishedLists, getListItemCount } from '@/data/curatedLists'
import { getWeekIndex } from '@/lib/weekIndex'
import type { HeroFeature } from '@/lib/heroTypes'

export async function HeroModule() {
  'use cache'
  cacheTag('explore:hero')
  cacheLife('hours')

  // D-09 / D-08: fetch settings + published lists in parallel
  const [settings, allPublished] = await Promise.all([
    getCmsSettings(),
    getPublishedLists(50),
  ])

  // D-08: build per-list item counts via getListItemCount (N calls amortized by
  // the hours-long cache window — T-47-15 accepted for personal-first scale)
  const withCounts = await Promise.all(
    allPublished.map(async (l) => ({ ...l, itemCount: await getListItemCount(l.id) }))
  )

  // D-08: quality gate — eligible iff ≥3 items AND non-empty coverUrl AND non-empty introMarkdown
  const eligible = withCounts.filter(
    (l) => l.itemCount >= 3 && !!l.coverUrl && !!l.introMarkdown
  )

  // EXPL-02: no eligible content → hide entirely (return null, no empty container)
  if (eligible.length === 0) return null

  // D-09: manual pin override
  let featured: (typeof eligible)[number] | null = null
  if (
    settings.pinnedListId &&
    (!settings.pinExpiresAt || settings.pinExpiresAt > new Date())
  ) {
    featured = eligible.find((l) => l.id === settings.pinnedListId) ?? null
  }

  // D-07: weekly rotation fallback when no valid pin OR pinned list not eligible
  if (!featured) {
    const week = getWeekIndex(new Date())
    const sorted = [...eligible].sort(
      (a, b) =>
        (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0) ||
        a.id.localeCompare(b.id)
    )
    featured = sorted[week % sorted.length]
  }

  // Build HeroFeature discriminated union value (D-10 — forward-compat for SEED-008)
  const feature: HeroFeature = { format: 'featured_list', list: { ...featured, itemCount: featured.itemCount } }

  if (feature.format !== 'featured_list') return null
  const list = feature.list

  return (
    // Full hero surface is the tap target (no separate CTA button)
    <Link
      href={`/explore/lists/${list.id}`}
      className="block focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {/* CSS chain: explicit aspect-ratio + overflow-hidden — see 47-UI-SPEC.md CSS Chain Assertions */}
      <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-muted min-h-[200px]">
        {/* Full-bleed image — absolute inset-0 required; absence causes escape or no-fill */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={list.coverUrl!}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient overlay for legible text on image */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        {/* Text overlay — bottom-anchored */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1">
            {list.curatorName}
          </p>
          <h2 className="text-2xl font-semibold text-white leading-tight">{list.title}</h2>
          <p className="text-sm text-white/80 mt-1">{list.itemCount} watches</p>
        </div>
      </div>
    </Link>
  )
}

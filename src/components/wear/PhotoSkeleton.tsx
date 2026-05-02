import { Skeleton } from '@/components/ui/skeleton'

/**
 * PhotoSkeleton — Phase 26 Plan 01 (D-01). Loading placeholder for the
 * wear-detail hero image. Dimensions match WearDetailHero exactly so
 * there's zero cumulative layout shift when the image lands. Pure muted
 * pulsing block — no text, no icons (D-01).
 */
export function PhotoSkeleton() {
  return (
    <Skeleton className="w-full aspect-[4/5] md:rounded-lg md:max-w-[600px] md:mx-auto" />
  )
}

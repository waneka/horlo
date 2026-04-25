import { cn } from '@/lib/utils'

/**
 * Standard shadcn Skeleton primitive — `animate-pulse rounded-md bg-muted`.
 *
 * Used as a building block for higher-level loading states (e.g.,
 * SearchResultsSkeleton). Pure presentational div — no client interactivity,
 * Server-Component-safe.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  )
}

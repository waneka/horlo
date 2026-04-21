import Image from 'next/image'
import { cn } from '@/lib/utils'
import { getSafeImageUrl } from '@/lib/images'

interface AvatarDisplayProps {
  avatarUrl: string | null
  displayName: string | null
  username: string
  // Tailwind: size-10 (40px for list rows), size-16 (64px default), size-24 (96px header)
  size?: 40 | 64 | 96
  className?: string
}

export function AvatarDisplay({
  avatarUrl,
  displayName,
  username,
  size = 64,
  className,
}: AvatarDisplayProps) {
  const safe = avatarUrl ? getSafeImageUrl(avatarUrl) : null
  const initial =
    (displayName ?? username).trim().charAt(0).toUpperCase() || '?'
  const dimensionClass =
    size === 96 ? 'size-24' : size === 40 ? 'size-10' : 'size-16'

  if (safe) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-full bg-muted',
          dimensionClass,
          className,
        )}
      >
        <Image
          src={safe}
          alt={`${displayName ?? username} avatar`}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-accent text-accent-foreground font-semibold',
        dimensionClass,
        size === 96 ? 'text-3xl' : size === 40 ? 'text-sm' : 'text-xl',
        className,
      )}
      aria-label={`${displayName ?? username} avatar`}
    >
      {initial}
    </div>
  )
}

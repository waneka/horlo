import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function TasteTagPill({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'rounded-full bg-accent/10 text-accent border-accent/20 px-3 py-1 text-xs font-normal',
        className,
      )}
    >
      {children}
    </Badge>
  )
}

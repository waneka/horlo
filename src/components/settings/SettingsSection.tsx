import { cn } from '@/lib/utils'

interface SettingsSectionProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function SettingsSection({
  title,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn('mb-6', className)}>
      <h2 className="mb-2 text-xs font-normal uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="rounded-xl border bg-card p-4">{children}</div>
    </section>
  )
}

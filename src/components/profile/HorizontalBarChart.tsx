import { cn } from '@/lib/utils'

interface BarChartRow {
  label: string
  percentage: number // 0-100
}

interface HorizontalBarChartProps {
  rows: BarChartRow[]
  emptyState?: string
}

export function HorizontalBarChart({
  rows,
  emptyState = 'No data yet.',
}: HorizontalBarChartProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyState}</p>
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 truncate text-foreground">
            {row.label}
          </span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('absolute inset-y-0 left-0 rounded-full bg-accent')}
              style={{
                width: `${Math.min(100, Math.max(0, row.percentage))}%`,
              }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
            {Math.round(row.percentage)}%
          </span>
        </li>
      ))}
    </ul>
  )
}

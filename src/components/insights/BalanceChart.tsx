'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DistributionItem {
  label: string
  count: number
  percentage: number
}

interface BalanceChartProps {
  title: string
  data: DistributionItem[]
  emptyMessage?: string
}

// Interim implementation — Plan 01-06 replaces this with a Recharts chart
// wired through the shadcn Chart primitive. Until then, render as a sorted
// list with counts/percentages using semantic tokens only.
export function BalanceChart({ title, data, emptyMessage = 'Not enough data yet.' }: BalanceChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }

  const sortedData = [...data].sort((a, b) => b.count - a.count)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {sortedData.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="capitalize text-foreground">{item.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {item.count} · {Math.round(item.percentage)}%
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

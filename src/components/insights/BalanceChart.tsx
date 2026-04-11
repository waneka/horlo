'use client'

import { Bar, BarChart, XAxis, YAxis, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
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

const chartConfig = {
  count: {
    label: 'Count',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

export function BalanceChart({
  title,
  data,
  emptyMessage = 'Not enough data yet.',
}: BalanceChartProps) {
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
  const summary = sortedData
    .map((d) => `${d.label}: ${d.count}`)
    .join(', ')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="min-h-[200px] w-full"
          aria-label={`${title}: ${summary}`}
        >
          <BarChart
            accessibilityLayer
            data={sortedData}
            layout="vertical"
            margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={96}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {sortedData.map((_, i) => (
                <Cell key={i} fill={`var(--chart-${(i % 5) + 1})`} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

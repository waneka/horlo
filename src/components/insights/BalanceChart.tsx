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

const colors = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
]

export function BalanceChart({ title, data, emptyMessage = 'No data' }: BalanceChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">{emptyMessage}</p>
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
      <CardContent className="space-y-4">
        {sortedData.map((item, index) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="capitalize font-medium">{item.label}</span>
              <span className="text-gray-500">
                {item.count} ({Math.round(item.percentage)}%)
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[index % colors.length]} rounded-full transition-all duration-500`}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

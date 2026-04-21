import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface StatsCardProps {
  title: string
  children: React.ReactNode
}

export function StatsCard({ title, children }: StatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[120px]">{children}</CardContent>
    </Card>
  )
}

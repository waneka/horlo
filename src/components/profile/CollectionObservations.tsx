import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function CollectionObservations({
  observations,
}: {
  observations: string[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Collection Observations</CardTitle>
      </CardHeader>
      <CardContent>
        {observations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not enough data for observations yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {observations.map((o, i) => (
              <li key={i} className="text-sm text-foreground">
                {o}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BalanceChart } from '@/components/insights/BalanceChart'
import { GoodDealsSection } from '@/components/insights/GoodDealsSection'
import { SleepingBeautiesSection } from '@/components/insights/SleepingBeautiesSection'
import { getCurrentUser } from '@/lib/auth'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { detectLoyalBrands } from '@/lib/similarity'
import { daysSince } from '@/lib/wear'
import type { CollectionGoal, Watch } from '@/lib/types'

function observationCopy(goal: CollectionGoal, ownedWatches: Watch[]): string {
  switch (goal) {
    case 'specialist':
      return 'Your collection is building depth. Every owned piece reinforces a single specialty — redundancy reads as mastery here.'
    case 'variety-within-theme':
      return 'Distinct roles anchored by shared design DNA. Additions that add a new role while staying on-theme are exactly what this collection needs.'
    case 'brand-loyalist': {
      const loyal = detectLoyalBrands(ownedWatches)
      return loyal.length > 0
        ? `You're leaning into ${loyal.join(' and ')}. Off-brand additions will feel like detours.`
        : 'Your brand pattern is still emerging. Keep collecting and a loyal-brand signal will surface.'
    }
    case 'balanced':
    default:
      return 'A balanced collection — breadth across style, role, and dial color. New additions should fill a gap rather than double a slot.'
  }
}

function calculateDistribution(
  watches: Watch[],
  getValues: (watch: Watch) => string[]
): Array<{ label: string; count: number; percentage: number }> {
  const counts: Record<string, number> = {}

  watches.forEach((watch) => {
    getValues(watch).forEach((value) => {
      counts[value] = (counts[value] || 0) + 1
    })
  })

  const total = watches.length
  return Object.entries(counts).map(([label, count]) => ({
    label,
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
  }))
}

function calculateSingleValueDistribution(
  watches: Watch[],
  getValue: (watch: Watch) => string | undefined
): Array<{ label: string; count: number; percentage: number }> {
  const counts: Record<string, number> = {}

  watches.forEach((watch) => {
    const value = getValue(watch)
    if (value) {
      counts[value] = (counts[value] || 0) + 1
    }
  })

  const total = watches.length
  return Object.entries(counts).map(([label, count]) => ({
    label,
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
  }))
}

function computeWearInsights(ownedWatches: Watch[]) {
  const watchesWithWearData = ownedWatches.filter((w) => w.lastWornDate)
  const unwornWatches = ownedWatches.filter((w) => !w.lastWornDate)

  const notWornIn30Days = watchesWithWearData.filter((w) => {
    const days = daysSince(w.lastWornDate)
    return days !== null && days > 30
  })

  const recentlyWorn = watchesWithWearData.filter((w) => {
    const days = daysSince(w.lastWornDate)
    return days !== null && days <= 7
  })

  return {
    unwornWatches,
    notWornIn30Days,
    recentlyWorn,
    totalWithWearData: watchesWithWearData.length,
  }
}

function computeCollectionValue(ownedWatches: Watch[]) {
  const totalPaid = ownedWatches.reduce(
    (sum, w) => sum + (w.pricePaid || 0),
    0
  )
  const totalMarket = ownedWatches.reduce(
    (sum, w) => sum + (w.marketPrice || 0),
    0
  )
  const watchesWithBothPrices = ownedWatches.filter(
    (w) => w.pricePaid && w.marketPrice
  )

  return {
    totalPaid,
    totalMarket,
    watchesWithPriceData: watchesWithBothPrices.length,
  }
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount)

export default async function InsightsPage() {
  const user = await getCurrentUser()
  const [watches, preferences] = await Promise.all([
    getWatchesByUser(user.id),
    getPreferencesByUser(user.id),
  ])

  const goal: CollectionGoal = preferences.collectionGoal ?? 'balanced'
  const ownedWatches = watches.filter((w) => w.status === 'owned')
  const wishlistWatches = watches.filter(
    (w) => w.status === 'wishlist' || w.status === 'grail'
  )

  const styleDistribution = calculateDistribution(ownedWatches, (w) => w.styleTags)
  const roleDistribution = calculateDistribution(ownedWatches, (w) => w.roleTags)
  const dialColorDistribution = calculateSingleValueDistribution(
    ownedWatches,
    (w) => w.dialColor
  )
  const movementDistribution = calculateSingleValueDistribution(
    ownedWatches,
    (w) => w.movement
  )
  const strapDistribution = calculateSingleValueDistribution(
    ownedWatches,
    (w) => w.strapType
  )

  const wearInsights = computeWearInsights(ownedWatches)
  const collectionValue = computeCollectionValue(ownedWatches)

  if (watches.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-24">
          <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-4">
            Insights
          </h1>
          <p className="text-muted-foreground">
            Insights unlock once you add a few watches.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl text-foreground">
          Collection Insights
        </h1>
        <p className="text-muted-foreground mt-2">
          Understand your collection composition and identify gaps or biases.
        </p>
      </div>

      {/* Actionable Sections */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <GoodDealsSection watches={watches} />
        <SleepingBeautiesSection watches={watches} />
      </div>

      {/* Goal-aware Observations */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Observations</CardTitle>
            <CardDescription>Goal: {goal.replace(/-/g, ' ')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{observationCopy(goal, ownedWatches)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">{ownedWatches.length}</div>
            <p className="text-sm text-muted-foreground">Owned Watches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">{wishlistWatches.length}</div>
            <p className="text-sm text-muted-foreground">Wishlist / Grail</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">
              {collectionValue.totalPaid > 0
                ? formatCurrency(collectionValue.totalPaid)
                : '-'}
            </div>
            <p className="text-sm text-muted-foreground">Total Invested</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-semibold">
              {collectionValue.totalMarket > 0
                ? formatCurrency(collectionValue.totalMarket)
                : '-'}
            </div>
            <p className="text-sm text-muted-foreground">Est. Market Value</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Charts */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <BalanceChart
          title="Style Distribution"
          data={styleDistribution}
          emptyMessage="No style tags in collection"
        />
        <BalanceChart
          title="Role Distribution"
          data={roleDistribution}
          emptyMessage="No role tags in collection"
        />
        <BalanceChart
          title="Dial Color Distribution"
          data={dialColorDistribution}
          emptyMessage="No dial colors specified"
        />
        <BalanceChart
          title="Movement Types"
          data={movementDistribution}
          emptyMessage="No movement data"
        />
      </div>

      {/* Wear Insights */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Wear Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {wearInsights.totalWithWearData === 0 ? (
              <p className="text-sm text-muted-foreground">
                No wear data yet. Mark watches as worn to see insights.
              </p>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Worn in last 7 days</span>
                  <Badge variant="secondary">
                    {wearInsights.recentlyWorn.length}
                  </Badge>
                </div>
                {wearInsights.notWornIn30Days.length > 0 && (
                  <div>
                    <p className="text-sm text-accent mb-2">
                      Not worn in 30+ days:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {wearInsights.notWornIn30Days.slice(0, 5).map((watch) => (
                        <li key={watch.id}>
                          {watch.brand} {watch.model} (
                          {daysSince(watch.lastWornDate)} days)
                        </li>
                      ))}
                      {wearInsights.notWornIn30Days.length > 5 && (
                        <li className="text-muted-foreground/70">
                          +{wearInsights.notWornIn30Days.length - 5} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
                {wearInsights.unwornWatches.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Never worn (no data):
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {wearInsights.unwornWatches.slice(0, 3).map((watch) => (
                        <li key={watch.id}>
                          {watch.brand} {watch.model}
                        </li>
                      ))}
                      {wearInsights.unwornWatches.length > 3 && (
                        <li className="text-muted-foreground/70">
                          +{wearInsights.unwornWatches.length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Collection Observations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              {styleDistribution.length > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground/70">•</span>
                  <span>
                    {Math.round(styleDistribution[0]?.percentage || 0)}% of your
                    collection is{' '}
                    <span className="font-semibold capitalize text-foreground">
                      {styleDistribution[0]?.label}
                    </span>{' '}
                    style
                  </span>
                </li>
              )}
              {roleDistribution.length > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground/70">•</span>
                  <span>
                    Most common role:{' '}
                    <span className="font-semibold capitalize text-foreground">
                      {roleDistribution[0]?.label}
                    </span>{' '}
                    ({roleDistribution[0]?.count} watches)
                  </span>
                </li>
              )}
              {dialColorDistribution.length === 1 && (
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground/70">•</span>
                  <span>
                    All watches have{' '}
                    <span className="font-semibold capitalize text-foreground">
                      {dialColorDistribution[0]?.label}
                    </span>{' '}
                    dials - consider variety
                  </span>
                </li>
              )}
              {strapDistribution.length === 1 && (
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground/70">•</span>
                  <span>
                    All watches on{' '}
                    <span className="font-semibold capitalize text-foreground">
                      {strapDistribution[0]?.label}
                    </span>
                  </span>
                </li>
              )}
              {ownedWatches.length > 0 &&
                roleDistribution.every((r) => r.label !== 'formal') && (
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    <span>No formal/dress watches in collection</span>
                  </li>
                )}
              {ownedWatches.length > 0 &&
                roleDistribution.every((r) => r.label !== 'travel') && (
                  <li className="flex items-start gap-2">
                    <span className="text-accent">•</span>
                    <span>No dedicated travel watch</span>
                  </li>
                )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { notFound } from 'next/navigation'

const VALID_TABS = ['collection', 'wishlist', 'worn', 'notes', 'stats'] as const
type Tab = (typeof VALID_TABS)[number]

export default async function ProfileTabPage({
  params,
}: {
  params: Promise<{ username: string; tab: string }>
}) {
  const { tab } = await params
  if (!VALID_TABS.includes(tab as Tab)) notFound()

  return (
    <section
      data-slot="tab-placeholder"
      className="rounded-xl border bg-card p-8 text-center"
    >
      <p className="text-sm font-semibold capitalize">{tab} tab</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Content lands in Plan 03 (Collection/Wishlist/Notes) or Plan 04
        (Worn/Stats).
      </p>
    </section>
  )
}

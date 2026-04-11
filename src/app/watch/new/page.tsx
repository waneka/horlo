import { WatchForm } from '@/components/watch/WatchForm'

export default function NewWatchPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="font-serif text-3xl md:text-4xl text-foreground mb-8">Add Watch</h1>
      <WatchForm mode="create" />
    </div>
  )
}

import { WatchForm } from '@/components/watch/WatchForm'

export default function NewWatchPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Add Watch</h1>
      <WatchForm mode="create" />
    </div>
  )
}

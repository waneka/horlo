import type { Watch } from '@/lib/types'
import type { WatchFilters } from '@/store/watchStore'

export function filterWatches(watches: Watch[], filters: WatchFilters): Watch[] {
  return watches.filter((watch) => {
    if (filters.status !== 'all' && watch.status !== filters.status) return false
    if (filters.styleTags.length > 0 && !filters.styleTags.some((t) => watch.styleTags.includes(t))) return false
    if (filters.roleTags.length > 0 && !filters.roleTags.some((t) => watch.roleTags.includes(t))) return false
    if (filters.dialColors.length > 0 && watch.dialColor && !filters.dialColors.includes(watch.dialColor)) return false
    const { min, max } = filters.priceRange ?? { min: null, max: null }
    if (min != null || max != null) {
      if (watch.marketPrice == null) return false
      if (min != null && watch.marketPrice < min) return false
      if (max != null && watch.marketPrice > max) return false
    }
    return true
  })
}

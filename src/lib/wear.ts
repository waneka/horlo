export function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export const SLEEPING_BEAUTY_DAYS = 30

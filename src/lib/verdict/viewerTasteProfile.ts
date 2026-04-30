import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { watches, watchesCatalog } from '@/db/schema'
import type { Watch } from '@/lib/types'
import type { ViewerTasteProfile, PrimaryArchetype, EraSignal } from '@/lib/verdict/types'

/**
 * D-02 + Pitfall 4: catalog rows with confidence < 0.5 are too noisy to count
 * toward dominant-style detection. The aggregate excludes them; the per-candidate
 * confidence gate (Pitfall 4) is enforced separately in composer.ts.
 */
const CONFIDENCE_FLOOR = 0.5

export const EMPTY_PROFILE: ViewerTasteProfile = {
  meanFormality: null,
  meanSportiness: null,
  meanHeritageScore: null,
  dominantArchetype: null,
  dominantEraSignal: null,
  topDesignMotifs: [],
}

/**
 * Phase 20 D-02: viewer collection's aggregate taste profile.
 * Pure function (per-render); null-tolerant; O(N) over collection size.
 *
 * SQL: INNER JOIN watches → watches_catalog by catalogId, filtered by
 * watchIds and confidence ≥ 0.5. Watches without a catalogId are skipped
 * entirely (inner join eliminates them).
 *
 * Numeric columns (formality, sportiness, heritageScore, confidence) are
 * stored as Postgres `numeric` and surface as strings through postgres-js;
 * we coerce via `Number()` before averaging (see `numbersOf`).
 */
export async function computeViewerTasteProfile(
  collection: Watch[],
): Promise<ViewerTasteProfile> {
  if (collection.length === 0) return EMPTY_PROFILE

  const watchIds = collection.map((w) => w.id)
  const rows = await db
    .select({
      formality: watchesCatalog.formality,
      sportiness: watchesCatalog.sportiness,
      heritageScore: watchesCatalog.heritageScore,
      primaryArchetype: watchesCatalog.primaryArchetype,
      eraSignal: watchesCatalog.eraSignal,
      designMotifs: watchesCatalog.designMotifs,
    })
    .from(watches)
    .innerJoin(watchesCatalog, eq(watchesCatalog.id, watches.catalogId))
    .where(
      and(
        inArray(watches.id, watchIds),
        sql`${watchesCatalog.confidence} >= ${CONFIDENCE_FLOOR}`,
      ),
    )

  if (rows.length === 0) return EMPTY_PROFILE

  const numbersOf = (key: 'formality' | 'sportiness' | 'heritageScore'): number[] =>
    rows
      .map((r) => r[key] as unknown as number | string | null)
      .filter((x): x is number | string => x !== null)
      .map((x) => Number(x))
      .filter((n) => !Number.isNaN(n))

  const formalities = numbersOf('formality')
  const sportinesses = numbersOf('sportiness')
  const heritages = numbersOf('heritageScore')

  return {
    meanFormality: avg(formalities),
    meanSportiness: avg(sportinesses),
    meanHeritageScore: avg(heritages),
    dominantArchetype: mode<PrimaryArchetype>(
      rows
        .map((r) => r.primaryArchetype as PrimaryArchetype | null)
        .filter((x): x is PrimaryArchetype => x !== null),
    ),
    dominantEraSignal: mode<EraSignal>(
      rows
        .map((r) => r.eraSignal as EraSignal | null)
        .filter((x): x is EraSignal => x !== null),
    ),
    topDesignMotifs: topK(rows.flatMap((r) => r.designMotifs ?? []), 3),
  }
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function mode<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  const counts = new Map<T, number>()
  for (const x of arr) counts.set(x, (counts.get(x) ?? 0) + 1)
  let best: T | null = null
  let bestN = 0
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k
      bestN = n
    }
  }
  return best
}

function topK(arr: string[], k: number): string[] {
  if (arr.length === 0) return []
  const counts = new Map<string, number>()
  for (const x of arr) counts.set(x, (counts.get(x) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([s]) => s)
}

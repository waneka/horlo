import type { Watch, CatalogEntry, WatchStatus, MovementType, CrystalType } from '@/lib/types'

/**
 * Phase 20 D-09: caller shim at the engine boundary.
 * Converts a catalog row (CatalogEntry) into a Watch-shape so analyzeSimilarity
 * can score it as the candidate, without touching the engine body (D-09 byte-lock).
 *
 * Pitfall 7: candidate.status='wishlist' is synthetic. The engine at
 * src/lib/similarity.ts:225 filters the *collection* to status owned/grail —
 * the candidate's status is never read by scoring. 'wishlist' is chosen as a
 * neutral "being evaluated, not owned" sentinel.
 *
 * Assumption A1: catalog UUID and per-user watches.id never collide
 * (Postgres gen_random_uuid()).
 */
const STATUS_FOR_CANDIDATE: WatchStatus = 'wishlist'

const KNOWN_MOVEMENTS: ReadonlySet<MovementType> = new Set<MovementType>([
  'automatic',
  'manual',
  'quartz',
  'spring-drive',
  'other',
])

const KNOWN_CRYSTALS: ReadonlySet<CrystalType> = new Set<CrystalType>([
  'sapphire',
  'mineral',
  'acrylic',
  'hesalite',
  'hardlex',
])

function coerceMovement(m: string | null): MovementType {
  if (m === null) return 'other'
  return KNOWN_MOVEMENTS.has(m as MovementType) ? (m as MovementType) : 'other'
}

function coerceCrystal(c: string | null): CrystalType | undefined {
  if (c === null) return undefined
  return KNOWN_CRYSTALS.has(c as CrystalType) ? (c as CrystalType) : undefined
}

export function catalogEntryToSimilarityInput(entry: CatalogEntry): Watch {
  return {
    id: entry.id,                       // catalog UUID — A1 collision-safe
    brand: entry.brand,
    model: entry.model,
    reference: entry.reference ?? undefined,
    status: STATUS_FOR_CANDIDATE,       // Pitfall 7 — see header comment
    movement: coerceMovement(entry.movement),
    complications: entry.complications,
    caseSizeMm: entry.caseSizeMm ?? undefined,
    lugToLugMm: entry.lugToLugMm ?? undefined,
    waterResistanceM: entry.waterResistanceM ?? undefined,
    crystalType: coerceCrystal(entry.crystalType),
    dialColor: entry.dialColor ?? undefined,
    styleTags: entry.styleTags,
    designTraits: entry.designTraits,
    roleTags: entry.roleTags,
    isChronometer: entry.isChronometer ?? undefined,
    productionYear: entry.productionYear ?? undefined,
    imageUrl: entry.imageUrl ?? undefined,
  }
}

import 'server-only'
import { getTasteOverlapData } from '@/data/follows'
import {
  computeTasteOverlap,
  type TasteOverlapResult,
} from '@/lib/tasteOverlap'

export interface GateInput {
  viewerId: string | null
  ownerId: string
  isOwner: boolean
  collectionPublic: boolean
}

/**
 * Server-side Common Ground gate (T-09-08 / T-09-21 / T-09-23).
 *
 * Returns the TasteOverlapResult when the three-way gate passes, otherwise
 * null. Never returns raw TasteOverlapData — only the aggregate result — so
 * raw owner collection data cannot cross the server/client boundary through
 * this helper.
 *
 * Three-way gate (all must pass):
 *   1. viewerId !== null         — authenticated viewer
 *   2. !isOwner                  — viewer is not the profile owner
 *   3. collectionPublic === true — owner's collection visibility flag is on
 *
 * When any condition fails, getTasteOverlapData is NOT called — the DAL
 * round-trip (which bypasses RLS via service-role reads) is gated at the
 * application layer before any data leaves the DB.
 *
 * Single-sourced between layout.tsx and [tab]/page.tsx (DRY). Pinned by
 * tests/app/layout-common-ground-gate.test.ts.
 */
export async function resolveCommonGround(
  input: GateInput,
): Promise<TasteOverlapResult | null> {
  if (!input.viewerId) return null
  if (input.isOwner) return null
  if (!input.collectionPublic) return null
  const data = await getTasteOverlapData(input.viewerId, input.ownerId)
  return computeTasteOverlap(data.viewer, data.owner)
}

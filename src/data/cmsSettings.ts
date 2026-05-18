import 'server-only'

import { db } from '@/db'
import { cmsSettings } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// cms_settings — single-row settings table (PK id=1).
// Modeled on getProfileSettings in src/data/profiles.ts:
// missing-row → safe default (no throw, no pin active).
// ---------------------------------------------------------------------------

/**
 * Reads the id=1 row and returns a safe default when absent.
 * Safe default: no pin active, heroFormat='featured_list'.
 * SEED-008: heroFormat discriminated union forward-compat.
 * Do NOT denormalize cover URL here — Phase 47 joins curated_lists via pinned_list_id
 * (RESEARCH Open Question 2, RESOLVED).
 */
export async function getCmsSettings() {
  const rows = await db
    .select()
    .from(cmsSettings)
    .where(eq(cmsSettings.id, 1))
    .limit(1)
  return (
    rows[0] ?? {
      id: 1 as const,
      pinnedListId: null,
      pinExpiresAt: null,
      heroFormat: 'featured_list' as const,
      updatedAt: new Date(),
    }
  )
}

export async function setPinnedHero(listId: string, expiresAt: Date | null) {
  await db
    .update(cmsSettings)
    .set({ pinnedListId: listId, pinExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(cmsSettings.id, 1))
}

export async function clearPinnedHero() {
  await db
    .update(cmsSettings)
    .set({ pinnedListId: null, pinExpiresAt: null, updatedAt: new Date() })
    .where(eq(cmsSettings.id, 1))
}

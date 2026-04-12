// DAL is server-only — importing this from a client component is a build-time error.
import 'server-only'

import { db } from '@/db'
import { userPreferences } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { UserPreferences } from '@/lib/types'

// Row type inferred from the Drizzle schema — used for mapping only.
type PreferencesRow = typeof userPreferences.$inferSelect

/**
 * Default UserPreferences object returned when no row exists for the user.
 * Matches the defaultPreferences in src/store/preferencesStore.ts.
 * Avoids requiring a database row to exist before preferences can be read.
 */
const defaults: UserPreferences = {
  preferredStyles: [],
  dislikedStyles: [],
  preferredDesignTraits: [],
  dislikedDesignTraits: [],
  preferredComplications: [],
  complicationExceptions: [],
  preferredDialColors: [],
  dislikedDialColors: [],
  preferredCaseSizeRange: undefined,
  overlapTolerance: 'medium',
  collectionGoal: undefined,
  notes: undefined,
}

/**
 * Convert a Drizzle DB row to the domain UserPreferences type.
 * DB-internal fields (id, userId, createdAt, updatedAt) are stripped.
 */
function mapRowToPreferences(row: PreferencesRow): UserPreferences {
  return {
    preferredStyles: row.preferredStyles,
    dislikedStyles: row.dislikedStyles,
    preferredDesignTraits: row.preferredDesignTraits,
    dislikedDesignTraits: row.dislikedDesignTraits,
    preferredComplications: row.preferredComplications,
    complicationExceptions: row.complicationExceptions,
    preferredDialColors: row.preferredDialColors,
    dislikedDialColors: row.dislikedDialColors,
    // jsonb column: null → undefined; { min, max } object → pass through
    preferredCaseSizeRange: row.preferredCaseSizeRange != null
      ? (row.preferredCaseSizeRange as { min: number; max: number })
      : undefined,
    overlapTolerance: row.overlapTolerance,
    collectionGoal: row.collectionGoal ?? undefined,
    notes: row.notes ?? undefined,
  }
}

/**
 * Return preferences for a user. If no row exists, returns the default UserPreferences
 * object rather than throwing — preferences are always readable (D-08: throw for unexpected
 * DB failures, not for expected "no row" condition).
 */
export async function getPreferencesByUser(userId: string): Promise<UserPreferences> {
  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
  if (!rows[0]) {
    return { ...defaults }
  }
  return mapRowToPreferences(rows[0])
}

/**
 * Upsert preferences for a user. Inserts a new row or updates the existing one
 * on userId conflict. Merges provided fields with defaults for a complete row.
 * Returns the resulting UserPreferences domain object.
 */
export async function upsertPreferences(userId: string, data: Partial<UserPreferences>): Promise<UserPreferences> {
  // Build a complete insert row by merging defaults with the provided data.
  const insertValues = {
    userId,
    preferredStyles: data.preferredStyles ?? defaults.preferredStyles,
    dislikedStyles: data.dislikedStyles ?? defaults.dislikedStyles,
    preferredDesignTraits: data.preferredDesignTraits ?? defaults.preferredDesignTraits,
    dislikedDesignTraits: data.dislikedDesignTraits ?? defaults.dislikedDesignTraits,
    preferredComplications: data.preferredComplications ?? defaults.preferredComplications,
    complicationExceptions: data.complicationExceptions ?? defaults.complicationExceptions,
    preferredDialColors: data.preferredDialColors ?? defaults.preferredDialColors,
    dislikedDialColors: data.dislikedDialColors ?? defaults.dislikedDialColors,
    // jsonb: undefined in domain → null in DB; { min, max } → pass through
    preferredCaseSizeRange: 'preferredCaseSizeRange' in data
      ? (data.preferredCaseSizeRange ?? null)
      : null,
    overlapTolerance: data.overlapTolerance ?? defaults.overlapTolerance,
    collectionGoal: data.collectionGoal ?? null,
    notes: data.notes ?? null,
  }

  // Build the update set — only update fields that were explicitly provided.
  const updateValues: Partial<typeof insertValues & { updatedAt: Date }> = {
    updatedAt: new Date(),
  }
  if (data.preferredStyles !== undefined) updateValues.preferredStyles = data.preferredStyles
  if (data.dislikedStyles !== undefined) updateValues.dislikedStyles = data.dislikedStyles
  if (data.preferredDesignTraits !== undefined) updateValues.preferredDesignTraits = data.preferredDesignTraits
  if (data.dislikedDesignTraits !== undefined) updateValues.dislikedDesignTraits = data.dislikedDesignTraits
  if (data.preferredComplications !== undefined) updateValues.preferredComplications = data.preferredComplications
  if (data.complicationExceptions !== undefined) updateValues.complicationExceptions = data.complicationExceptions
  if (data.preferredDialColors !== undefined) updateValues.preferredDialColors = data.preferredDialColors
  if (data.dislikedDialColors !== undefined) updateValues.dislikedDialColors = data.dislikedDialColors
  if ('preferredCaseSizeRange' in data) {
    updateValues.preferredCaseSizeRange = data.preferredCaseSizeRange ?? null
  }
  if (data.overlapTolerance !== undefined) updateValues.overlapTolerance = data.overlapTolerance
  if ('collectionGoal' in data) updateValues.collectionGoal = data.collectionGoal ?? null
  if ('notes' in data) updateValues.notes = data.notes ?? null

  const upserted = await db
    .insert(userPreferences)
    .values(insertValues)
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: updateValues,
    })
    .returning()

  return mapRowToPreferences(upserted[0])
}

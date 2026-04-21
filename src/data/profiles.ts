import 'server-only'

import { db } from '@/db'
import { profiles, profileSettings, follows } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

export interface ProfileSettings {
  userId: string
  profilePublic: boolean
  collectionPublic: boolean
  wishlistPublic: boolean
  wornPublic: boolean
}

export type VisibilityField =
  | 'profilePublic'
  | 'collectionPublic'
  | 'wishlistPublic'
  | 'wornPublic'

const DEFAULT_SETTINGS: Omit<ProfileSettings, 'userId'> = {
  profilePublic: true,
  collectionPublic: true,
  wishlistPublic: true,
  wornPublic: true,
}

export async function getProfileByUsername(username: string) {
  // WR-05: lookup is case-insensitive so /u/Tyler and /u/tyler resolve to the
  // same profile. The signup trigger already lowercases usernames at insert
  // (see supabase/migrations/20260420000002_profile_trigger.sql), and a
  // companion migration adds a unique index on lower(username) as belt-and-
  // suspenders against mixed-case insertions going forward.
  const rows = await db
    .select()
    .from(profiles)
    .where(sql`lower(${profiles.username}) = lower(${username})`)
    .limit(1)
  return rows[0] ?? null
}

export async function getProfileById(userId: string) {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Returns the profile_settings row for a userId.
 * Missing-row → safe defaults (fully public). The Plan 01 backfill INSERT in the
 * Supabase migration prevents this case in prod; defaults exist as defense-in-depth
 * so the user can never be locked out of their own profile mid-migration.
 */
export async function getProfileSettings(userId: string): Promise<ProfileSettings> {
  const rows = await db
    .select()
    .from(profileSettings)
    .where(eq(profileSettings.userId, userId))
    .limit(1)
  if (rows[0]) {
    return {
      userId: rows[0].userId,
      profilePublic: rows[0].profilePublic,
      collectionPublic: rows[0].collectionPublic,
      wishlistPublic: rows[0].wishlistPublic,
      wornPublic: rows[0].wornPublic,
    }
  }
  return { userId, ...DEFAULT_SETTINGS }
}

export async function getFollowerCounts(
  userId: string
): Promise<{ followers: number; following: number }> {
  const [fr, fg] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, userId)),
  ])
  return { followers: fr[0]?.count ?? 0, following: fg[0]?.count ?? 0 }
}

export async function updateProfileFields(
  userId: string,
  fields: { displayName?: string | null; avatarUrl?: string | null; bio?: string | null }
) {
  await db
    .update(profiles)
    .set({
      ...(fields.displayName !== undefined ? { displayName: fields.displayName } : {}),
      ...(fields.avatarUrl !== undefined ? { avatarUrl: fields.avatarUrl } : {}),
      ...(fields.bio !== undefined ? { bio: fields.bio } : {}),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId))
}

export async function updateProfileSettingsField(
  userId: string,
  field: VisibilityField,
  value: boolean
) {
  // Upsert in case the row is somehow missing (defense in depth + Pitfall 8).
  // For the insert path we apply the new value to `field` and leave the other
  // three at their default (true) — matches the Phase 7 trigger behavior.
  await db
    .insert(profileSettings)
    .values({
      userId,
      profilePublic: field === 'profilePublic' ? value : true,
      collectionPublic: field === 'collectionPublic' ? value : true,
      wishlistPublic: field === 'wishlistPublic' ? value : true,
      wornPublic: field === 'wornPublic' ? value : true,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profileSettings.userId,
      set: { [field]: value, updatedAt: new Date() },
    })
}

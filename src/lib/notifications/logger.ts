import 'server-only'
import { db } from '@/db'
import { notifications, profileSettings } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import type { FollowPayload, WatchOverlapPayload } from './types'

/**
 * logNotification — fire-and-forget write path for Phase 13.
 *
 * Semantic divergence from `logActivity`: logNotification internally try/catches
 * so non-awaited callers don't produce unhandled-rejection warnings. Callers invoke
 * as `void logNotification(...)` — the caller's primary mutation is never blocked
 * or rolled back by a logger failure (Pitfall B-2, CONTEXT.md D-27/D-28).
 *
 * Opt-out (D-18): reads the recipient's profile_settings.notify_on_* BEFORE insert;
 * skips when the toggle is off. Missing row → safe default (both on) matches the
 * DEFAULT true in schema.
 *
 * Self-guard (D-24): defense-in-depth above the DB CHECK constraint —
 * short-circuit if actor === recipient so a self-insert never reaches the DB
 * (where it would throw a noisy CHECK violation during tests).
 *
 * watch_overlap (D-22, Phase 11 dedup): uses raw SQL with a dedup-aware conflict
 * clause to hit the named partial UNIQUE index `notifications_watch_overlap_dedup` —
 * Drizzle's default .onConflictDoNothing() targets the PK, which is wrong here.
 *
 * CALLER CONTRACT (RESEARCH §Open Questions #5 — REVERSED from research recommendation):
 * Callers MUST pre-resolve the actor profile (username + display_name) via
 * getProfileById(actorUserId) and pass them in the payload. The logger does NOT
 * fetch the profile — this keeps caller-visible latency predictable and avoids
 * an extra DB round-trip inside the fire-and-forget path. See Plan 04 Task 2 for
 * the canonical call sites in `followUser` and `addWatch`.
 */
export type LogNotificationInput =
  | {
      type: 'follow'
      recipientUserId: string
      actorUserId: string
      payload: FollowPayload
    }
  | {
      type: 'watch_overlap'
      recipientUserId: string
      actorUserId: string
      payload: WatchOverlapPayload
    }

export async function logNotification(input: LogNotificationInput): Promise<void> {
  try {
    // D-24 self-guard (belt-and-suspenders beyond the DB CHECK).
    if (input.recipientUserId === input.actorUserId) return

    // D-18 opt-out: read recipient's settings; skip if opted-out.
    // Missing row → safe default (both on) matches the DEFAULT true in schema.
    const [settings] = await db
      .select({
        notifyOnFollow: profileSettings.notifyOnFollow,
        notifyOnWatchOverlap: profileSettings.notifyOnWatchOverlap,
      })
      .from(profileSettings)
      .where(eq(profileSettings.userId, input.recipientUserId))
      .limit(1)

    const notifyOnFollow = settings?.notifyOnFollow ?? true
    const notifyOnOverlap = settings?.notifyOnWatchOverlap ?? true

    if (input.type === 'follow' && !notifyOnFollow) return
    if (input.type === 'watch_overlap' && !notifyOnOverlap) return

    if (input.type === 'watch_overlap') {
      // Raw SQL — hits partial UNIQUE `notifications_watch_overlap_dedup`.
      // Matches the pattern in tests/integration/phase11-notifications-rls.test.ts:107-130.
      await db.execute(sql`
        INSERT INTO notifications (user_id, actor_id, type, payload)
        VALUES (
          ${input.recipientUserId}::uuid,
          ${input.actorUserId}::uuid,
          'watch_overlap',
          ${input.payload}::jsonb
        )
        ON CONFLICT DO NOTHING
      `)
      return
    }

    // follow — straightforward Drizzle insert (no dedup index for follow type).
    await db.insert(notifications).values({
      userId: input.recipientUserId,
      actorId: input.actorUserId,
      type: 'follow',
      payload: input.payload,
    })
  } catch (err) {
    // D-27: fire-and-forget — never throws to caller.
    console.error('[logNotification] failed (non-fatal):', err)
  }
}

---
phase: 15
plan: 03a
type: execute
wave: 2
depends_on: ["15-01", "15-02"]
files_modified:
  - src/data/wearEvents.ts
  - src/app/actions/wearEvents.ts
  - tests/integration/phase15-wywt-photo-flow.test.ts
autonomous: true
requirements_addressed:
  - WYWT-12
  - WYWT-15
nyquist_compliant: true
tags: [wywt, server-action, dal, storage, duplicate-day, backend]

must_haves:
  truths:
    - "`getWornTodayIdsForUser(userId, today)` DAL returns a Set of watch IDs the user has wear events for on `today` (owner-only — no viewer gating)"
    - "`logWearEventWithPhoto({...})` DAL inserts a wear_events row; throws a PG 23505 error on duplicate-day unique-constraint violation (caller catches)"
    - "`logWearWithPhoto` Server Action: auth → zod → watch ownership → (if hasPhoto) Storage list probe → insert → logActivity → revalidatePath('/'); returns ActionResult<{wearEventId}>"
    - "On 23505: Server Action catches → returns `{success:false, error:'Already logged this watch today'}` → best-effort Storage cleanup when hasPhoto was asserted"
    - "On non-23505 insert failure when hasPhoto=true: best-effort Storage cleanup also fires (verified by integration Test 26)"
    - "`getWornTodayIdsForUserAction` Server Action wrapper: validates input, auth-checks caller, returns empty array when input.userId !== caller.id (defense — only returns caller's own set)"
    - "markAsWorn (existing) is BYTE-UNCHANGED; this plan appends new exports only"
  artifacts:
    - path: "src/data/wearEvents.ts"
      provides: "Append getWornTodayIdsForUser + logWearEventWithPhoto; existing getWearEventsForViewer, getWearRailForViewer, logWearEvent all unchanged"
      exports: ["getWornTodayIdsForUser", "logWearEventWithPhoto"]
    - path: "src/app/actions/wearEvents.ts"
      provides: "Append logWearWithPhoto + getWornTodayIdsForUserAction; existing markAsWorn unchanged"
      exports: ["markAsWorn", "logWearWithPhoto", "getWornTodayIdsForUserAction"]
    - path: "tests/integration/phase15-wywt-photo-flow.test.ts"
      provides: "Wave 0 integration — A5 smoke, happy no-photo, happy with-photo, hasPhoto-without-file rejection, duplicate-day (photo + no-photo), auth guard, cross-user watch, zod validation, preflight wrapper, NON-23505 orphan cleanup"
      exports: []
  key_links:
    - from: "src/app/actions/wearEvents.ts"
      to: "src/data/wearEvents.ts"
      via: "await logWearEventWithPhoto({id, userId, watchId, wornDate, note, photoUrl, visibility})"
      pattern: "logWearEventWithPhoto"
    - from: "src/app/actions/wearEvents.ts"
      to: "src/lib/supabase/server.ts"
      via: "supabase.storage.from('wear-photos').list(userId, {search: `${wearEventId}.jpg`})"
      pattern: "wear-photos.*list"
    - from: "src/app/actions/wearEvents.ts"
      to: "src/data/activities.ts"
      via: "await logActivity(userId, 'watch_worn', watchId, {brand, model, imageUrl, visibility})"
      pattern: "logActivity"
    - from: "src/app/actions/wearEvents.ts"
      to: "next/cache"
      via: "revalidatePath('/') on success"
      pattern: "revalidatePath"
---

<objective>
Ship the Phase 15 server surface — DAL helpers + Server Actions + integration tests — WITHOUT any frontend. Plan 03b (frontend composition) depends on this plan; splitting backend from frontend ensures the WywtPostDialog/ComposeStep client code in 03b can `import { getWornTodayIdsForUserAction, logWearWithPhoto } from '@/app/actions/wearEvents'` and `npx tsc --noEmit` passes on first commit.

Purpose: This plan exists because Plan 03 as originally written created a tsc-ordering bug — frontend tasks imported Server Action symbols that were created in a later task within the same plan. Splitting into 03a (backend) → 03b (frontend) makes the symbol graph acyclic by execution order.

Output: Two server-side files extended + one integration test file created (10+ tests). After this plan ships, every Server Action + DAL helper needed by 03b is in place and type-checked. No UI changes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/15-wywt-photo-post-flow/15-CONTEXT.md
@.planning/phases/15-wywt-photo-post-flow/15-RESEARCH.md
@.planning/phases/15-wywt-photo-post-flow/15-UI-SPEC.md
@.planning/phases/15-wywt-photo-post-flow/15-VALIDATION.md
@.planning/phases/15-wywt-photo-post-flow/15-01-SUMMARY.md
@.planning/phases/15-wywt-photo-post-flow/15-02-SUMMARY.md
@.planning/research/PITFALLS.md
@./CLAUDE.md
@./AGENTS.md

# Existing files the executor will read/modify:
@src/app/actions/wearEvents.ts
@src/data/wearEvents.ts
@src/data/activities.ts
@src/data/watches.ts
@src/lib/auth.ts
@src/lib/actionTypes.ts
@src/lib/wearVisibility.ts
@src/lib/supabase/server.ts
@src/db/schema.ts

<interfaces>
<!-- Key types and contracts the executor needs. -->

From existing codebase (verified):
```typescript
// src/lib/actionTypes.ts
export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string }

// src/lib/wearVisibility.ts
export type WearVisibility = 'public' | 'followers' | 'private'

// src/lib/auth.ts
export async function getCurrentUser(): Promise<{id: string, email: string, ...}>  // throws UnauthorizedError

// src/data/activities.ts — signature after Phase 12
type WatchWornMetadata = { brand: string; model: string; imageUrl: string | null; visibility: WearVisibility }
export async function logActivity(userId: string, type: 'watch_worn', targetId: string, metadata: WatchWornMetadata): Promise<void>

// src/data/watches.ts
export async function getWatchById(userId: string, watchId: string): Promise<Watch | null>

// src/db/schema.ts wear_events
// id (uuid, defaultRandom, primaryKey) · userId · watchId · wornDate (text ISO) · note · photoUrl · visibility · createdAt
// UNIQUE constraint `wear_events_unique_day` on (userId, watchId, wornDate)
```

NEW contracts this plan creates (consumed by Plan 03b frontend):

```typescript
// src/data/wearEvents.ts — append alongside existing
export async function getWornTodayIdsForUser(
  userId: string,
  today: string,  // ISO date '2026-04-24'
): Promise<ReadonlySet<string>>  // returns set of watch IDs worn today

export async function logWearEventWithPhoto(input: {
  id: string           // client-generated wearEventId; becomes wear_events.id
  userId: string
  watchId: string
  wornDate: string
  note: string | null
  photoUrl: string | null
  visibility: WearVisibility
}): Promise<void>  // throws on 23505 unique violation (caller catches)

// src/app/actions/wearEvents.ts — append alongside existing markAsWorn
'use server'
export async function logWearWithPhoto(input: {
  wearEventId: string  // client UUID
  watchId: string
  note: string | null
  visibility: WearVisibility
  hasPhoto: boolean
}): Promise<ActionResult<{ wearEventId: string }>>

export async function getWornTodayIdsForUserAction(
  input: { userId: string; today: string }
): Promise<string[]>  // Server Actions cannot return Sets; returns array. Client converts via new Set(ids).
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Append DAL helpers getWornTodayIdsForUser + logWearEventWithPhoto to src/data/wearEvents.ts (RED → GREEN)</name>
  <files>src/data/wearEvents.ts, tests/integration/phase15-wywt-photo-flow.test.ts</files>
  <read_first>
    - src/data/wearEvents.ts (lines 9-19 existing logWearEvent — mirror its shape; do NOT modify existing exports)
    - src/db/schema.ts lines 216-233 wearEvents table + UNIQUE constraint
    - tests/integration/home-privacy.test.ts (integration harness shape + Supabase env gating)
    - tests/integration/phase12-visibility-matrix.test.ts (9-cell matrix pattern as a reference)
    - RESEARCH.md §Pattern 6 — Duplicate-day handling (preflight DAL shape)
    - RESEARCH.md §Specifics — "Preflight DAL query shape" paragraph
    - RESEARCH.md §Assumption A9 — narrow DAL feasibility
    - CONTEXT.md D-13 (preflight DAL) + D-14 (server 23505) + D-15 (full insert)
    - VALIDATION.md row WYWT-12 automated command
    - node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md (Server Actions + mutations context — referenced by downstream Task 2 Server Action)
  </read_first>
  <behavior>
    - Test 4 (integration, gated on Supabase env vars): Insert 2 wear events for userA today with watchA and watchB; `getWornTodayIdsForUser(userA, today)` returns `Set(['watchA', 'watchB'])`; for yesterday returns empty set.
    - Test 5: `logWearEventWithPhoto({id, userId, watchId, wornDate: today, note: null, photoUrl: 'u/e.jpg', visibility: 'public'})` inserts a row with exactly those fields.
    - Test 6: Duplicate-day attempt throws; error has `code === '23505'`.
  </behavior>
  <action>
    Step 1 — Append to `src/data/wearEvents.ts`. Place AFTER existing `getWearEventsForViewer` / `getWearRailForViewer` / `logWearEvent` exports. Imports already include `db`, `wearEvents`, `eq`, `and` at the top of the file; verify `WearVisibility` type import; no new imports needed.

    ```typescript
    /**
     * Preflight duplicate-day helper (WYWT-12, CONTEXT.md D-13).
     * Returns set of watch IDs the user has wear events for on `today`.
     * Passed to WatchPickerDialog via `wornTodayIds` prop in Plan 03b.
     *
     * Owner-only query (no viewer gating) — only the actor's own picker
     * uses this DAL call; nothing cross-user. PROJECT.md caps watches at
     * <500/user so full scan per user+date is acceptable.
     */
    export async function getWornTodayIdsForUser(
      userId: string,
      today: string,
    ): Promise<ReadonlySet<string>> {
      const rows = await db
        .select({ watchId: wearEvents.watchId })
        .from(wearEvents)
        .where(and(eq(wearEvents.userId, userId), eq(wearEvents.wornDate, today)))
      return new Set(rows.map((r) => r.watchId))
    }

    /**
     * Photo-bearing wear event insert (WYWT-15, CONTEXT.md D-15).
     * Mirrors logWearEvent but accepts the full payload including a client-
     * generated id, the photo path (or null), and the three-tier visibility.
     * Throws on 23505 unique-violation; caller (logWearWithPhoto Server
     * Action) catches and maps to ActionResult error.
     */
    export async function logWearEventWithPhoto(input: {
      id: string
      userId: string
      watchId: string
      wornDate: string
      note: string | null
      photoUrl: string | null
      visibility: WearVisibility
    }): Promise<void> {
      await db.insert(wearEvents).values({
        id: input.id,
        userId: input.userId,
        watchId: input.watchId,
        wornDate: input.wornDate,
        note: input.note,
        photoUrl: input.photoUrl,
        visibility: input.visibility,
      })
      // NOTE: no onConflictDoNothing — caller catches 23505 explicitly so the
      // orphan-delete branch fires. If we silently swallowed, the client
      // would think the insert succeeded and the user wouldn't see the error.
    }
    ```

    Step 2 — Scaffold `tests/integration/phase15-wywt-photo-flow.test.ts` with the env-gate + describe-if pattern; add tests 4/5/6. Gate:
    ```typescript
    const ENABLED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    const describeIf = ENABLED ? describe : describe.skip
    ```
    Mirror `tests/integration/home-privacy.test.ts` for fixture seed + cleanup (beforeAll / afterAll).

    Step 3 — Verify existing DAL exports unchanged:
    ```bash
    grep -n "^export async function" src/data/wearEvents.ts
    # expect: getWearEventsForViewer, getWearRailForViewer, logWearEvent (all existing, unchanged)
    #   plus the two NEW: getWornTodayIdsForUser, logWearEventWithPhoto
    ```
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run test -- tests/integration/phase15-wywt-photo-flow.test.ts</automated>
  </verify>
  <done>
    - `getWornTodayIdsForUser` and `logWearEventWithPhoto` exported from `src/data/wearEvents.ts`
    - Existing `getWearEventsForViewer`, `getWearRailForViewer`, `logWearEvent` DAL exports byte-unchanged (verify via `git diff` line ranges)
    - Tests 4/5/6 pass in `tests/integration/phase15-wywt-photo-flow.test.ts` when Supabase env vars present; `describe.skip` when absent (same pattern as `home-privacy.test.ts`)
    - `npx tsc --noEmit` exits 0
    - Existing `tests/integration/home-privacy.test.ts` still passes (no regression)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Append logWearWithPhoto + getWornTodayIdsForUserAction Server Actions with orphan cleanup + preflight wrapper</name>
  <files>src/app/actions/wearEvents.ts, tests/integration/phase15-wywt-photo-flow.test.ts</files>
  <read_first>
    - src/app/actions/wearEvents.ts (current markAsWorn — mirror its shape; MUST remain byte-unchanged at the top of the file)
    - src/data/wearEvents.ts (getWornTodayIdsForUser + logWearEventWithPhoto just added in Task 1)
    - src/data/activities.ts (logActivity signature + WatchWornMetadata contract)
    - src/data/watches.ts (getWatchById — owner-scoped lookup)
    - src/lib/auth.ts (getCurrentUser + UnauthorizedError)
    - src/lib/supabase/server.ts (createSupabaseServerClient signature)
    - RESEARCH.md §Pattern 6 — Duplicate-day handling (23505 code, orphan delete)
    - RESEARCH.md §Pattern 7 — Client-direct upload + server validates (FULL code example for logWearWithPhoto)
    - RESEARCH.md §Pitfall 8 — Orphan Storage objects (best-effort remove)
    - RESEARCH.md §Pitfall 11 — toast() called inside Server Action (MUST NOT import sonner)
    - RESEARCH.md §Open Question 2 — whether .list works under session client (A5 — plan a smoke test)
    - RESEARCH.md §Security Domain + §Assumption A5
    - CONTEXT.md D-14 (server 23505), D-15 (full pipeline), D-16 (no-photo), D-17 (orphan delete)
    - UI-SPEC.md §Interaction Contracts → error handling for duplicate-day
    - VALIDATION.md rows WYWT-12 + WYWT-15
    - supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql (verify list RLS — session-client visibility)
    - node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md (canonical `'use server'` directive rules for Next 16 per AGENTS.md)
    - node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md (canonical Server Action pattern with revalidatePath + return ActionResult)
  </read_first>
  <behavior>
    Server Action `logWearWithPhoto` behaviors:
    - Test 16 (happy no-photo): `logWearWithPhoto({wearEventId, watchId, note:'nice', visibility:'public', hasPhoto:false})` → inserts wear_events row with `photoUrl:null`; returns `{success:true, data:{wearEventId}}`; `revalidatePath('/')` called; `logActivity('watch_worn', ..., {visibility:'public'})` fired.
    - Test 17 (happy with-photo): seed a `wear-photos/{userId}/{wearEventId}.jpg` object; call with `hasPhoto:true` → list probe finds it; inserts row with `photoUrl='{userId}/{wearEventId}.jpg'`; returns success.
    - Test 18 (client asserts hasPhoto but no file): DO NOT seed a Storage object; call with `hasPhoto:true` → list probe fails; returns `{success:false, error:'Photo upload failed — please try again'}`; NO row inserted; NO activity logged.
    - Test 19 (duplicate-day with photo): seed + insert a row for (user, watch, today); call again with the SAME (watchId, today) + seed a fresh orphan → 23505 caught; returns `{success:false, error:'Already logged this watch today'}`; orphan Storage object is REMOVED (list probe after returns empty).
    - Test 20 (duplicate-day no photo): call twice with `hasPhoto:false` → second returns the duplicate-day error; no orphan cleanup needed (nothing to clean).
    - Test 21 (unauthorized): `getCurrentUser` throws → returns `{success:false, error:'Not authenticated'}`.
    - Test 22 (cross-user watch): watchId belongs to another user → `getWatchById(user.id, watchId)` returns null → returns `{success:false, error:'Watch not found'}` (mirrors markAsWorn CR-01 uniform not-found).
    - Test 23 (zod validation): invalid wearEventId (non-UUID) → returns `{success:false, error:'Invalid input'}`.
    - Test 26 (NON-23505 insert failure with hasPhoto → orphan cleanup fires): seed a Storage object at `{userId}/{wearEventId}.jpg`; stub the DAL to throw a non-23505 error (e.g., FK violation via fixture mutation: delete the `profiles` row for the user so the wear_events FK fails with code '23503', OR use a vitest spy on `logWearEventWithPhoto` that throws `Object.assign(new Error('simulated RLS deny'), {code: '42501'})`). Assert: Server Action returns `{success:false, error:'Could not log that wear. Please try again.'}` AND the Storage object at that path has been deleted (verify via `.list()` returning empty). This test proves the `<done>` criterion "Non-23505 insert failure with hasPhoto also triggers best-effort orphan cleanup" — not reachable via the 23505 path alone.

    Preflight wrapper `getWornTodayIdsForUserAction` behaviors:
    - Test 24 (self): `getWornTodayIdsForUserAction({userId: self, today})` returns array of watchIds worn today by self.
    - Test 24b (defense — cross-user): `getWornTodayIdsForUserAction({userId: otherUser, today})` returns empty array (defense — only returns caller's own set).
    - Test 24c (bad input): `getWornTodayIdsForUserAction({userId: 'not-a-uuid', today: 'not-a-date'})` returns empty array (zod rejects).

    A5 smoke test:
    - Test 25: Using the session client (NOT service-role), `supabase.storage.from('wear-photos').list(userId, {search: `${wearEventId}.jpg`})` succeeds AND returns the object when it exists. If this test FAILS, switch the implementation to use service-role client and document in Summary. This is the FIRST test in the file — if it fails, executor MUST update Task 2's Server Action code to use service-role and re-run.
  </behavior>
  <action>
    Step 1 — Append to `src/app/actions/wearEvents.ts`. Keep `markAsWorn` UNCHANGED (byte-identical at the top of the file). Append the two new actions after `markAsWorn`.

    Imports (at the top of the file, add):
    ```typescript
    import { z } from 'zod'
    import { revalidatePath } from 'next/cache'
    import { createSupabaseServerClient } from '@/lib/supabase/server'
    import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
    import { getWatchById } from '@/data/watches'
    import { logActivity } from '@/data/activities'
    import * as wearEventDAL from '@/data/wearEvents'  // access new DAL helpers
    import type { WearVisibility } from '@/lib/wearVisibility'
    import type { ActionResult } from '@/lib/actionTypes'
    ```
    (Verify which of these are already imported at the top of wearEvents.ts; add only what's missing.)

    Zod schemas (verbatim from RESEARCH §Pattern 7):
    ```typescript
    const logWearWithPhotoSchema = z.object({
      wearEventId: z.string().uuid(),
      watchId: z.string().uuid(),
      note: z.string().max(200).nullable(),
      visibility: z.enum(['public', 'followers', 'private']),
      hasPhoto: z.boolean(),
    })

    const preflightSchema = z.object({
      userId: z.string().uuid(),
      today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    ```

    `logWearWithPhoto` Server Action (use RESEARCH §Pattern 7 code verbatim with the adjustments below):
    - `'use server'` directive (at top of file or on the function — already present in wearEvents.ts per markAsWorn convention)
    - `revalidatePath('/')` on success (D-19)
    - `note: parsed.data.note?.trim() || null` (normalize whitespace-only to null; client already trims but defense in depth)
    - On 23505 catch, log a structured error: `console.error('[logWearWithPhoto] duplicate-day detected; orphan cleanup:', cleanupResult)`
    - On NON-23505 insert failure when hasPhoto=true, ALSO run the orphan cleanup branch — structure as:
      ```typescript
      try {
        await wearEventDAL.logWearEventWithPhoto({...})
      } catch (err) {
        // Best-effort cleanup applies to ANY insert failure when hasPhoto asserted
        if (parsed.data.hasPhoto) {
          try {
            await supabase.storage
              .from('wear-photos')
              .remove([`${user.id}/${parsed.data.wearEventId}.jpg`])
          } catch (cleanupErr) {
            console.error('[logWearWithPhoto] orphan cleanup failed:', cleanupErr)
          }
        }
        // Map known errors to ActionResult
        const code = (err as { code?: string }).code
        if (code === '23505') {
          return { success: false, error: 'Already logged this watch today' }
        }
        console.error('[logWearWithPhoto] insert failed:', err)
        return { success: false, error: 'Could not log that wear. Please try again.' }
      }
      ```
    - Activity log (Phase 12 D-10 contract): `await logActivity(user.id, 'watch_worn', watchId, { brand: watch.brand, model: watch.model, imageUrl: watch.imageUrl ?? null, visibility: parsed.data.visibility })`
    - CRITICAL: No `import { toast } from 'sonner'` — Pitfall H-2. Server Actions do not call `toast()`. Client owns toast call-site.

    `getWornTodayIdsForUserAction` preflight wrapper:
    ```typescript
    export async function getWornTodayIdsForUserAction(
      input: { userId: string; today: string }
    ): Promise<string[]> {
      const parsed = preflightSchema.safeParse(input)
      if (!parsed.success) return []
      let user
      try { user = await getCurrentUser() } catch { return [] }
      // Defense: only returns the caller's own set (D-13 — not a cross-user leak)
      if (user.id !== parsed.data.userId) return []
      const set = await wearEventDAL.getWornTodayIdsForUser(user.id, parsed.data.today)
      return [...set]
    }
    ```

    Step 2 — Add integration tests 16-26 + 25 (A5 smoke) to `tests/integration/phase15-wywt-photo-flow.test.ts`. Order the A5 smoke test FIRST — if it fails, the executor MUST switch the Server Action's storage-list call to service-role and re-run. Document the A5 result in summary. Mirror the fixture/cleanup shape of `tests/integration/home-privacy.test.ts`.

    For Test 26 (non-23505 orphan cleanup), the cleanest approach is to use `vi.spyOn` on `wearEventDAL.logWearEventWithPhoto` and make it throw a custom error with `code !== '23505'` (e.g., `code: '42501'` — RLS violation). The Server Action's catch must still run the orphan cleanup branch because hasPhoto=true. Assert:
    ```typescript
    // After the Server Action call:
    const { data: listed } = await supabase.storage
      .from('wear-photos')
      .list(userId, { search: `${wearEventId}.jpg` })
    expect(listed ?? []).toHaveLength(0)  // orphan was cleaned up
    expect(result.success).toBe(false)
    expect(result.error).toBe('Could not log that wear. Please try again.')
    ```

    Step 3 — Verify with grep:
    ```bash
    grep -n "export async function markAsWorn" src/app/actions/wearEvents.ts  # existing, unchanged
    grep -n "export async function logWearWithPhoto" src/app/actions/wearEvents.ts  # new
    grep -n "export async function getWornTodayIdsForUserAction" src/app/actions/wearEvents.ts  # new
    grep -n "from 'sonner'" src/app/actions/wearEvents.ts  # expect 0 matches (Pitfall H-2)
    grep -n "toast(" src/app/actions/wearEvents.ts  # expect 0 matches
    ```
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run test -- tests/integration/phase15-wywt-photo-flow.test.ts</automated>
  </verify>
  <done>
    - `src/app/actions/wearEvents.ts` exports `markAsWorn` (BYTE-unchanged), `logWearWithPhoto`, `getWornTodayIdsForUserAction`
    - `logWearWithPhoto` performs: auth check → zod parse → watch ownership check → (if hasPhoto) Storage list probe → insert via `logWearEventWithPhoto` DAL → fire-and-forget logActivity → `revalidatePath('/')` → return `{success:true, data:{wearEventId}}`
    - 23505 caught; error string EXACTLY `"Already logged this watch today"`; orphan Storage object removed best-effort
    - NON-23505 insert failure with `hasPhoto=true` ALSO triggers best-effort orphan cleanup (Test 26 verifies via spyOn-throwing-42501)
    - No `toast(` anywhere in the file (grep confirms)
    - No `import { toast }` or `import * as sonner` (Pitfall H-2 architectural enforcement)
    - Integration tests 16-26 all pass when Supabase env vars present (or skip gracefully when absent — same pattern as home-privacy.test.ts)
    - A5 smoke test result (list under session client vs service-role) documented in 15-03a-SUMMARY.md
    - `npx tsc --noEmit` exits 0
    - `getWornTodayIdsForUserAction` returns empty array for cross-user input (defense) — verified by Test 24b
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → Server Action | Zod validation at action entry; reject malformed input |
| Server Action → Storage | Server validates object exists before insert (client could lie about hasPhoto) |
| Server Action → DB | UNIQUE (user_id, watch_id, worn_date) + RLS |
| Server Action internal → caller (preflight) | getWornTodayIdsForUserAction defends against cross-user leakage |

## STRIDE Threat Register

| Threat ID | Category | Severity | Component | Mitigation Plan |
|-----------|----------|----------|-----------|-----------------|
| T-15-04 | T (Client hasPhoto tampering) | HIGH | logWearWithPhoto | Server calls `supabase.storage.list(user.id, {search: `${wearEventId}.jpg`})` before insert; rejects when object absent. Returns generic "Photo upload failed — please try again" — no detailed info leak. |
| T-15-05 | T (Duplicate-day race — concurrent inserts) | MED | logWearEventWithPhoto / DB | DB UNIQUE constraint `wear_events_unique_day` + PG error code 23505 caught in Server Action. Orphan Storage cleanup on 23505. Preflight disable in Step 1 UI (Plan 03b) is defense-in-depth, not sole guard. |
| T-15-06 | T (Visibility-default tampering — client forces 'public' on a private draft) | MED | logWearWithPhoto zod | Zod enum `['public','followers','private']` validates; Server Action trusts input value (user-chosen visibility is the intent). No silent-fall-to-public coercion — invalid values rejected as 'Invalid input'. |
| T-15-27 | I (Duplicate-day error string leak — "Already logged this watch today") | LOW | logWearWithPhoto | Error string is a UX message, not a security boundary. The user who just attempted an insert already knows the watch exists in their collection — no cross-user existence leak. (Renumbered from T-15-07 to avoid collision with Plan 04's canonical T-15-07 = "Photo existence leak via response differential" per RESEARCH §Security Domain numbering.) |
| T-15-16 | I (Cross-user preflight leak via getWornTodayIdsForUserAction) | MED | getWornTodayIdsForUserAction | Server Action rejects (returns empty array) when `input.userId !== user.id` — only the caller's own set is returned. Zod validates userId (uuid) and today (ISO date). Test 24b verifies. |
| T-15-17 | E (Cross-user path write via client bug) | HIGH | logWearWithPhoto + Storage RLS | Storage path constructed server-side as `${user.id}/${wearEventId}.jpg` (never from client input) for the .list() probe; Plan 01's uploadWearPhoto also constructs the path client-side but Storage RLS (Phase 11) enforces `(storage.foldername(name))[1] = auth.uid()::text` on INSERT — a compromised client cannot write to another user's folder. |
| T-15-18 | I (Orphan Storage object leaks if cleanup fails) | LOW | logWearWithPhoto catch branch | Best-effort cleanup runs on ALL insert failures when hasPhoto=true (23505 AND non-23505 paths). Log-only on cleanup failure. Phase 11 D-04 MVP orphan-risk posture accepted. Storage objects in /{userId}/ folders are only readable via signed URLs; a bare path with no corresponding DB row never gets a URL minted → not externally discoverable. Test 26 verifies the non-23505 cleanup path. |
| T-15-19 | S (Server Action auth bypass) | HIGH | logWearWithPhoto | `getCurrentUser()` throws on no session; caught and returns 'Not authenticated'. Zod runs AFTER auth. |
| T-15-20 | I (Server Action logs sensitive input) | LOW | logWearWithPhoto console.error | Only err messages + error codes logged; no user input (note text, wearEventId) leaked in production logs. Verify executor only logs err objects and the literal strings in the action. |
</threat_model>

<verification>
## Plan-Level Verification

- `npx tsc --noEmit` exits 0 (critical — Plan 03b frontend imports these symbols)
- `npm run test -- tests/integration/phase15-wywt-photo-flow.test.ts` — 10+ tests pass (or skip-gated on missing env vars)
- `grep -rn "markAsWorn" src/app/actions/wearEvents.ts` — existing export intact
- `grep -rn "logWearWithPhoto\|getWornTodayIdsForUserAction" src/app/actions/wearEvents.ts` — both new exports present
- `grep -rn "toast(" src/app/actions/` returns 0 matches (Pitfall H-2 enforced)
- `grep -rn "from 'sonner'" src/app/actions/` returns 0 matches
- `git diff HEAD src/data/wearEvents.ts` shows only ADDITIONS (existing exports unchanged)
- A5 smoke result documented in plan summary
- Test 26 (non-23505 orphan cleanup) passes — proves the `<done>` criterion is verifiable, not just claimed
</verification>

<success_criteria>
## Plan Success Criteria

1. DAL helpers `getWornTodayIdsForUser` + `logWearEventWithPhoto` exported and integration-tested
2. Server Action `logWearWithPhoto`: auth → zod → watch ownership → list probe → insert → logActivity → revalidatePath
3. Server Action `getWornTodayIdsForUserAction` validated preflight wrapper; cross-user returns empty array
4. Duplicate-day: 23505 caught; error string EXACTLY "Already logged this watch today"; orphan Storage cleanup fires
5. Non-23505 insert failure with hasPhoto=true: orphan Storage cleanup ALSO fires (Test 26 verifies)
6. No Sonner / toast imports in any action file (H-2 enforced by grep)
7. A5 smoke test: session-client .list() either works OR service-role fallback documented
8. Existing markAsWorn byte-unchanged; existing DAL exports byte-unchanged
9. Plan 03b frontend can import `logWearWithPhoto` + `getWornTodayIdsForUserAction` and tsc passes on first commit
</success_criteria>

<output>
After completion, create `.planning/phases/15-wywt-photo-post-flow/15-03a-SUMMARY.md` documenting:
- A5 smoke result: did `.list()` succeed under session client? If not, what did we fall back to (service-role)?
- Any deviations from RESEARCH §Pattern 7 code (e.g., different error string, additional validation)
- Exact test count added in this plan (Tests 4-6 for DAL + Tests 16-26 for Server Actions + A5 = 14+)
- Whether Test 26 used vi.spyOn with a 42501 code OR a real RLS denial fixture (implementer's choice; document for Plan 03b context)
</output>

---
phase: quick-260913-cae
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/data/wearEvents.ts
  - tests/integration/wear-delete-dal.test.ts
  - src/app/actions/wearEvents.ts
  - tests/actions/wearEventsDelete.test.ts
  - src/components/wear/WearDeleteButton.tsx
  - tests/components/wear/WearDeleteButton.test.tsx
  - src/app/wear/[wearEventId]/page.tsx
autonomous: true
requirements: [QUICK-260913-cae]

must_haves:
  truths:
    - "The owner of a wear sees a 'Delete wear' control on /wear/[wearEventId]; a non-owner viewer never sees it (owner check is server-derived: wear.userId === viewerId in page.tsx)"
    - "Clicking 'Delete wear' opens a confirmation dialog; nothing is deleted until the destructive confirm button is pressed"
    - "Confirming deletes the wear_events row (wear_likes + comments cascade) and navigates with router.replace to /u/<username>/worn, where the wear no longer appears"
    - "deleteWearEvent re-checks ownership server-side: a cross-user or non-existent wearEventId returns the uniform 'Wear not found' and deletes nothing"
    - "Photo (photo_url) or video (media_path + poster_path) objects are removed from the wear-photos bucket ONLY when the path starts with '<callerUserId>/'; a storage failure after the DB delete is logged and non-fatal"
    - "The matching watch_worn activity is removed only when unambiguous (same user + type watch_worn + same watch_id + activity.created_at within [wear.created_at, wear.created_at + 60s], and no OTHER wear of the same user+watch was created within ±60s); otherwise the activity is left and the ambiguity is logged"
    - "wear_like / wear_comment notifications (payload->>'wear_event_id' = id, recipient = owner) and 'commented' activities (metadata->>'wearEventId' = id) are removed so no feed row or bell entry links to a 404"
    - "Caches invalidated with read-your-own-writes updateTag('profile:<username>') + updateTag('viewer:<userId>'), plus revalidatePath('/') and revalidatePath('/w/[ref]', 'page')"
  artifacts:
    - path: "src/data/wearEvents.ts"
      provides: "deleteWearEventForOwner(userId, wearEventId) transactional DAL"
      exports: ["deleteWearEventForOwner"]
    - path: "src/app/actions/wearEvents.ts"
      provides: "deleteWearEvent Server Action"
      exports: ["deleteWearEvent"]
    - path: "src/components/wear/WearDeleteButton.tsx"
      provides: "Owner-only delete trigger + confirmation Dialog"
      exports: ["WearDeleteButton"]
    - path: "tests/actions/wearEventsDelete.test.ts"
      provides: "Action contract tests (auth, zod, IDOR, storage prefix filter, non-fatal storage, cache)"
    - path: "tests/integration/wear-delete-dal.test.ts"
      provides: "DATABASE_URL-gated SQL test of the DAL matching rules"
  key_links:
    - from: "src/app/wear/[wearEventId]/page.tsx"
      to: "src/components/wear/WearDeleteButton.tsx"
      via: "rendered only when wear.userId === viewerId"
      pattern: "wear\\.userId === viewerId"
    - from: "src/components/wear/WearDeleteButton.tsx"
      to: "deleteWearEvent"
      via: "Server Action call inside useTransition"
      pattern: "deleteWearEvent\\("
    - from: "src/app/actions/wearEvents.ts"
      to: "wearEventDAL.deleteWearEventForOwner"
      via: "ownership-scoped transactional delete"
      pattern: "deleteWearEventForOwner\\(user\\.id"
    - from: "src/app/actions/wearEvents.ts"
      to: "storage wear-photos remove"
      via: "owner-prefix-filtered paths"
      pattern: "startsWith\\(ownerPrefix\\)"
---

<objective>
Add per-wear deletion: an owner-only, IDOR-safe `deleteWearEvent` Server Action backed by a transactional DAL function, and a "Delete wear" control with a confirmation dialog on the live `/wear/[wearEventId]` page, visible only to the wear's owner. After delete, the client goes to `/u/<username>/worn`.

Purpose: Today, the only way to remove a wear is deleting the whole account (`src/app/actions/account.ts`). Collectors need to remove a mistaken or duplicate wear log.
Output: DAL function + integration test, Server Action + unit tests, client delete component + component test, page wiring.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@./AGENTS.md

<design_decisions>
Planner-resolved choices (quick task, no CONTEXT.md). Executors implement exactly these.

DD-1 Activity matching rule (activities has no wear_event_id). All four watch_worn writers (markAsWorn, logWearWithPhoto, logWearWithVideo, logBackfillWear in src/app/actions/wearEvents.ts) insert the wear row FIRST and then call logActivity in the same request, and both created_at values come from the DB clock (defaultNow). So the activity for a wear lands at or shortly after wear.created_at. Rule, inside the DAL transaction:
  (a) Ambiguity guard: if any OTHER wear_events row (same user_id, same watch_id, id != this id) has created_at within [wear.createdAt - 60s, wear.createdAt + 60s], do NOT delete any watch_worn activity; return activityMatch 'ambiguous'.
  (b) Otherwise delete activities WHERE user_id = owner AND type = 'watch_worn' AND watch_id = wear.watchId AND created_at >= wear.createdAt AND created_at <= wear.createdAt + 60s. Return activityMatch 'matched' (rows > 0) or 'none' (0 rows — e.g. past-date backfill wears, which write no activity per 84 D-06).
  Window constant: WORN_ACTIVITY_MATCH_WINDOW_MS = 60_000, defined next to the DAL function.
  Accepted edge (document in the DAL doc comment): markAsWorn's onConflictDoNothing still logs an activity on a duplicate same-day tap (84 RESEARCH Pitfall 6). If such a phantom duplicate lands inside a different wear's 60s window, it is removed with that wear. That row is itself a duplicate of an existing activity, so removing it never hides a real, unique wear from the feed. Legacy activity rows written far from their wear's created_at (none known) are left in place — the trade-off favors never deleting an activity that could belong to another wear.

DD-2 Dangling-reference cleanup (exact-id matches only, zero ambiguity): in the same transaction delete notifications WHERE user_id = owner AND type in ('wear_like','wear_comment') AND payload->>'wear_event_id' = wearEventId (payload key confirmed in src/app/actions/reactions.ts and comments.ts), and activities WHERE type = 'commented' AND metadata->>'wearEventId' = wearEventId (CommentedMetadata in src/data/activities.ts; the feed gate always admits targetType 'wear' rows, so leaving them would render feed rows that link to a 404). Use or(eq(...), eq(...)) for the two notification types and scalar sql templates for the jsonb ->> comparisons. NEVER use sql`= ANY(${arr})` (memory: project_drizzle_sql_any_array_pitfall).

DD-3 Order of operations: DB delete first (transaction), storage removal second. Rationale: storage-first would leave a live wear with broken media if the DB delete failed; DB-first can at worst leave orphan objects, which are logged. This matches the task brief ("storage failure after a successful DB delete should be non-fatal and logged").

DD-4 Storage scope: collect non-null photoUrl, mediaPath, posterPath from the deleted row; keep only strings that start with `${user.id}/` and do not contain '..'; if any remain, call createSupabaseServerClient().storage.from('wear-photos').remove(paths). Session client is correct — policy wear_photos_delete_own_folder (supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql) already allows owners to delete in their own folder. Paths that fail the prefix filter are skipped and logged with console.error (Phase 61 IDOR storagePath lesson).

DD-5 UI placement: a standalone client component `WearDeleteButton` rendered by page.tsx directly below `<WearDetailMetadata>`, gated server-side on wear.userId === viewerId. We do NOT add a menu item to WearOverflowMenu/WearCard: WearCard is shared with the stories lane (/wears/[username]), and opening a Dialog from a base-ui DropdownMenuItem adds focus-return complexity. Trace confirmed: page.tsx renders WearPhotoStreamed -> WearCard, and WearDetailMetadata (note only). WearDetailHero is not the rendered surface here.

DD-6 Cache invalidation: revalidatePath('/') (home rail + feed), updateTag(`profile:${username}`) (read-your-own-writes on the Worn tab; updateTag expires for all viewers, so no extra revalidateTag(tag,'max') is needed — same reasoning as logBackfillWear), updateTag(`viewer:${user.id}`) (bell, because owner notifications were deleted), revalidatePath('/w/[ref]', 'page') (watch-detail wear-pic carousel; same form as hideWearPicAction). Do NOT call single-arg revalidateTag.
</design_decisions>

<interfaces>
Extracted from the codebase — use directly, no exploration needed.

src/app/actions/wearEvents.ts (top of file):
- 'use server'; imports revalidatePath, revalidateTag, updateTag from 'next/cache'; z from 'zod'; getCurrentUser from '@/lib/auth'; `import * as wearEventDAL from '@/data/wearEvents'`; `import * as profilesDAL from '@/data/profiles'`; createSupabaseServerClient from '@/lib/supabase/server'; type ActionResult from '@/lib/actionTypes'.
- Pattern to follow: logBackfillWear (lines ~514-599) — auth try/catch returning 'Not authenticated' -> strict zod safeParse returning 'Invalid input' -> write -> revalidatePath('/') -> profilesDAL.getProfileById(user.id) -> updateTag(`profile:${ownerProfile.username}`).
- ActionResult<T> = { success: true, data: T } | { success: false, error: string }.

src/data/wearEvents.ts (top):
- `import 'server-only'`; `import { db } from '@/db'`; imports wearEvents, profileSettings, follows, profiles, watches from '@/db/schema'; `eq, and, desc, inArray, gte, or, sql, asc, isNotNull` from 'drizzle-orm'. Add `activities`, `notifications` to the schema import and `lte`, `ne` to the drizzle import.
- db.transaction(async (tx) => { ... }) is an established pattern (src/data/brands.ts:74, src/data/curatedLists.ts:138).

src/db/schema.ts:
- wearEvents: id uuid, userId, watchId, wornDate text, note, photoUrl text|null, visibility, hiddenFromDetail, mediaType 'photo'|'video', mediaPath text|null, posterPath text|null, createdAt timestamptz. wear_likes.wear_event_id and comments.wear_event_id reference wear_events ON DELETE CASCADE.
- activities: id, userId, type text, watchId uuid|null (set null), metadata jsonb, createdAt timestamptz.
- notifications: id, userId (recipient), actorId, type enum incl. 'wear_like' | 'wear_comment', payload jsonb, readAt, createdAt.

src/app/wear/[wearEventId]/page.tsx: server component; `const user = await getCurrentUser(); const viewerId = user.id; const wear = await getWearEventByIdForViewer(viewerId, wearEventId)`; wear has userId, username (string|null), brand, model. Returns `<article className="flex flex-col gap-4 pt-4">` containing `<Suspense><WearPhotoStreamed .../></Suspense>` then `<WearDetailMetadata note={wear.note} />`.

src/components/ui/dialog.tsx exports Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription (base-ui). src/components/ui/button.tsx has variants incl. 'destructive' and 'outline'. Analog confirm modal: src/components/settings/WipeCollectionModal.tsx (controlled open + handleOpenChange reset). Toasts: `import { toast } from 'sonner'` (client only, as in WearOverflowMenu.tsx).

Test analogs: tests/actions/wearEventsBackfill.test.ts (vi.mock layout for auth, DAL, profiles, activities, next/cache, supabase server). tests/integration/phase15-wear-detail-gating.test.ts (DATABASE_URL-gated `maybe = process.env.DATABASE_URL ? describe : describe.skip`, fixed UUID users, cleanup, user insert -> trigger creates profile). tests/components/wear/WearCard.test.tsx (@testing-library/react).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Transactional DAL deleteWearEventForOwner + DB-gated integration test</name>
  <files>src/data/wearEvents.ts, tests/integration/wear-delete-dal.test.ts</files>
  <read_first>
    - src/data/wearEvents.ts lines 1-130 (imports, insert helpers) and 297-378 (getWearEventByIdForViewer select shape)
    - src/db/schema.ts lines 281-330 (activities, wearEvents) and 367-430 (wearLikes, comments, notifications)
    - src/data/activities.ts lines 40-62 (WatchWornMetadata, CommentedMetadata)
    - tests/integration/phase15-wear-detail-gating.test.ts (full file — harness, fixtures, catalog/watch seeding, cleanup)
    - src/data/brands.ts around line 74 (db.transaction usage)
  </read_first>
  <behavior>
    - Returns null and deletes nothing when wearEventId belongs to another user (IDOR) or does not exist
    - Owner delete removes the wear_events row; wear_likes and comments rows for it are gone (cascade)
    - watch_worn activity for the same user+watch created 1s after the wear is deleted; activityMatch 'matched'
    - watch_worn activity for the same watch created 10 minutes after the wear is NOT deleted
    - watch_worn activity for a DIFFERENT watch inside the window is NOT deleted
    - When another wear of the same user+watch has created_at within ±60s, no watch_worn activity is deleted; activityMatch 'ambiguous'
    - wear_like/wear_comment notifications with payload wear_event_id = id are deleted; a notification with a different wear_event_id survives
    - 'commented' activity with metadata wearEventId = id is deleted; one with a different wearEventId survives
    - Returned storagePaths contains exactly the non-null photoUrl / mediaPath / posterPath of the deleted row
  </behavior>
  <action>
    Add to src/data/wearEvents.ts an exported constant WORN_ACTIVITY_MATCH_WINDOW_MS = 60_000 and an exported async function deleteWearEventForOwner(userId: string, wearEventId: string) returning Promise of null or an object { watchId: string; storagePaths: string[]; activityMatch: 'matched' | 'none' | 'ambiguous'; removedActivityCount: number }. Implement inside db.transaction(async (tx) => ...):
    1. Select id, watchId, createdAt, photoUrl, mediaPath, posterPath from wearEvents where and(eq(wearEvents.id, wearEventId), eq(wearEvents.userId, userId)) limit 1. No row -> return null (covers both missing and cross-user; the ownership predicate lives in the WHERE so the DAL is IDOR-safe on its own).
    2. Compute windowStart = new Date(createdAt.getTime() - WORN_ACTIVITY_MATCH_WINDOW_MS) and windowEnd = new Date(createdAt.getTime() + WORN_ACTIVITY_MATCH_WINDOW_MS). Ambiguity guard per DD-1(a): select one id from wearEvents where userId matches, watchId matches, ne(wearEvents.id, wearEventId), gte(createdAt, windowStart), lte(createdAt, windowEnd). If found -> activityMatch 'ambiguous', skip step 3.
    3. Per DD-1(b): delete from activities where eq(userId), eq(type,'watch_worn'), eq(watchId, row.watchId), gte(createdAt, row.createdAt), lte(createdAt, windowEnd), with .returning({ id }) to count; activityMatch = count > 0 ? 'matched' : 'none'.
    4. Per DD-2: delete from activities where eq(type,'commented') and sql template comparing metadata ->> 'wearEventId' to the scalar wearEventId. Delete from notifications where eq(notifications.userId, userId), or(eq(type,'wear_like'), eq(type,'wear_comment')), and sql template payload ->> 'wear_event_id' = scalar wearEventId. Scalar params only — no arrays, no = ANY.
    5. Delete from wearEvents where and(eq(id, wearEventId), eq(userId, userId)). Cascade removes wear_likes and comments.
    6. Return { watchId, storagePaths: [photoUrl, mediaPath, posterPath] filtered to non-empty strings, activityMatch, removedActivityCount }.
    Write a doc comment above the function stating DD-1 (rule, rationale that all four writers insert wear then activity on the DB clock, and the accepted markAsWorn Pitfall-6 edge), DD-2, and that storage removal is the caller's job (DD-3). Add activities and notifications to the schema import and lte, ne to the drizzle-orm import.
    Create tests/integration/wear-delete-dal.test.ts mirroring phase15-wear-detail-gating.test.ts: `// @vitest-environment node` header, DATABASE_URL-gated maybe-describe, fixed UUIDs for two users (owner O, other user X), seed watches the same way the phase15 file does, insert wear_events/activities/notifications/wear_likes/comments rows with explicit createdAt values to exercise each behavior bullet, and a cleanup that deletes activities, notifications, comments, wear_likes, wear_events, watches, profiles, profile_settings, users for the fixture ids (run before and after). Do NOT seed rows into watches_catalog beyond what the phase15 harness already does (memory: watches_catalog is not wipeable in prod; tests only run locally).
  </action>
  <verify>
    <automated>! npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "src/data/wearEvents.ts|tests/integration/wear-delete-dal.test.ts" && if docker ps 2>/dev/null | grep -q supabase_db; then DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npx vitest run tests/integration/wear-delete-dal.test.ts; else npx vitest run tests/integration/wear-delete-dal.test.ts; echo "local Supabase not running - suite skipped; operator runs it in the local walk"; fi</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export async function deleteWearEventForOwner" src/data/wearEvents.ts` returns 1 line
    - `grep -n "WORN_ACTIVITY_MATCH_WINDOW_MS = 60_000" src/data/wearEvents.ts` returns 1 line
    - `grep -v '^\s*//' src/data/wearEvents.ts | grep -v '^\s*\*' | grep -c "ANY("` returns 0
    - The delete of wear_events and the SELECT both include eq(wearEvents.userId, userId)
    - tsc reports no errors in the two task files (pre-existing errors elsewhere are baseline)
    - Integration suite passes when local Supabase is up, or skips cleanly when DATABASE_URL is unset
  </acceptance_criteria>
  <done>DAL deletes a wear only for its owner, applies DD-1/DD-2 matching inside one transaction, returns storage paths, and the gated integration test encodes every behavior bullet.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: deleteWearEvent Server Action + unit tests</name>
  <files>src/app/actions/wearEvents.ts, tests/actions/wearEventsDelete.test.ts</files>
  <read_first>
    - src/app/actions/wearEvents.ts lines 1-12 (imports) and 483-599 (logBackfillWear pattern and its updateTag comment)
    - src/app/actions/wearEvents.ts lines 648-690 (hideWearPicAction revalidatePath('/w/[ref]', 'page') form)
    - tests/actions/wearEventsBackfill.test.ts (full file — mock layout, fixtures, beforeEach)
    - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md (confirm updateTag is Server-Action-only and single-arg)
  </read_first>
  <behavior>
    - getCurrentUser throws -> { success:false, error:'Not authenticated' }; DAL not called
    - Non-UUID wearEventId, or extra keys (e.g. userId) -> { success:false, error:'Invalid input' }; DAL not called
    - DAL returns null -> { success:false, error:'Wear not found' }; storage, updateTag, revalidatePath not called
    - DAL throws -> { success:false, error:"Couldn't delete that wear." }; console.error called
    - Photo wear (storagePaths ['<uid>/<id>.jpg']) -> storage.from('wear-photos').remove called once with exactly that array
    - Video wear (mp4 + -poster.jpg under '<uid>/') -> remove called once with both paths
    - No media (storagePaths []) -> remove not called
    - A path under another user's prefix or containing '..' is filtered out and never passed to remove
    - remove resolves with { error } or throws -> action still returns success; console.error called
    - Success -> revalidatePath('/'), revalidatePath('/w/[ref]','page'), updateTag('profile:<username>'), updateTag('viewer:<uid>') all called; revalidateTag never called; data = { username }
  </behavior>
  <action>
    In src/app/actions/wearEvents.ts add deleteWearEventSchema = z.object({ wearEventId: z.string().uuid() }).strict() and export async function deleteWearEvent(input: unknown): Promise<ActionResult<{ username: string | null }>>. Pipeline (mirror logBackfillWear ordering):
    1. Auth first: try getCurrentUser, catch -> 'Not authenticated'.
    2. safeParse(input); failure -> 'Invalid input'.
    3. try { result = await wearEventDAL.deleteWearEventForOwner(user.id, parsed.data.wearEventId) } catch (err) { console.error('[deleteWearEvent] delete failed:', err); return "Couldn't delete that wear." }. result null -> uniform 'Wear not found' (no existence leak for cross-user ids, T-QK-IDOR).
    4. If result.activityMatch === 'ambiguous', console.warn('[deleteWearEvent] watch_worn activity left in place (ambiguous match)', wearEventId).
    5. Storage per DD-3/DD-4: const ownerPrefix = `${user.id}/`; safePaths = result.storagePaths.filter(p => p.startsWith(ownerPrefix) && !p.includes('..')); log any dropped paths with console.error. If safePaths.length > 0, in try/catch: const supabase = await createSupabaseServerClient(); const { error } = await supabase.storage.from('wear-photos').remove(safePaths); if error console.error('[deleteWearEvent] storage cleanup failed (non-fatal):', error); catch -> console.error same prefix. Never return failure from this step.
    6. Cache per DD-6: revalidatePath('/'); revalidatePath('/w/[ref]', 'page'); const ownerProfile = await profilesDAL.getProfileById(user.id); if ownerProfile?.username updateTag(`profile:${ownerProfile.username}`); updateTag(`viewer:${user.id}`).
    7. Return { success: true, data: { username: ownerProfile?.username ?? null } }.
    Add a doc comment block in the style of logBackfillWear listing: pipeline, T-QK-IDOR (DAL WHERE scoped to user.id + uniform error), T-QK-STORAGE (owner-prefix filter, DB-first ordering rationale), T-QK-MASS (.strict()), DD-1 activity rule reference, and why updateTag (read-your-own-writes; expires for all viewers).
    Create tests/actions/wearEventsDelete.test.ts copying the vi.mock layout from wearEventsBackfill.test.ts (add deleteWearEventForOwner: vi.fn() to the @/data/wearEvents factory; mock createSupabaseServerClient to resolve an object whose storage.from returns { remove: vi.fn() }), with one `it` per behavior bullet. Use valid v4 UUID fixtures. Spy console.error / console.warn with vi.spyOn(...).mockImplementation(() => {}) and restore in afterEach.
  </action>
  <verify>
    <automated>npx vitest run tests/actions/wearEventsDelete.test.ts tests/actions/wearEventsBackfill.test.ts tests/actions/wearEventsVideo.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export async function deleteWearEvent(" src/app/actions/wearEvents.ts` returns 1 line
    - `grep -n "deleteWearEventForOwner(user.id" src/app/actions/wearEvents.ts` returns 1 line
    - `grep -n 'startsWith(ownerPrefix)' src/app/actions/wearEvents.ts` returns 1 line
    - Inside deleteWearEvent there is no single-arg or two-arg revalidateTag call (test asserts revalidateTag not called)
    - All three action test files pass (new file has at least 10 tests)
  </acceptance_criteria>
  <done>deleteWearEvent enforces auth, strict input, server-side ownership via the DAL, owner-prefixed non-fatal storage cleanup, and updateTag-based invalidation, all pinned by unit tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Owner-only WearDeleteButton with confirmation dialog, wired into the live /wear/[wearEventId] page</name>
  <files>src/components/wear/WearDeleteButton.tsx, tests/components/wear/WearDeleteButton.test.tsx, src/app/wear/[wearEventId]/page.tsx</files>
  <read_first>
    - src/app/wear/[wearEventId]/page.tsx (full — confirm it renders WearPhotoStreamed/WearCard + WearDetailMetadata; this IS the live surface, DD-5)
    - src/components/wear/WearDetailMetadata.tsx (container classes: px-4 md:max-w-[600px] md:mx-auto)
    - src/components/ui/dialog.tsx and src/components/ui/button.tsx (exports, destructive + outline variants)
    - src/components/settings/WipeCollectionModal.tsx lines 1-130 (controlled Dialog + reset-on-openChange pattern)
    - src/components/wear/WearOverflowMenu.tsx (useTransition + sonner toast usage)
    - tests/components/wear/WearCard.test.tsx lines 1-40 (RTL setup)
  </read_first>
  <behavior>
    - Renders a 'Delete wear' button; dialog content is not in the document until clicked
    - Clicking opens a dialog with title 'Delete this wear?' and copy explaining the photo/video, likes, and comments are removed permanently
    - 'Cancel' closes the dialog and deleteWearEvent is not called
    - Confirm calls deleteWearEvent({ wearEventId }) once; confirm button is disabled while pending (double-submit guard)
    - On success: router.replace('/u/<username>/worn') using the action's returned username (fallback to ownerUsername prop); toast('Wear deleted'); router.push/back never called
    - On failure: dialog stays open and shows the returned error inline (role="alert"); no navigation
    - Reopening after a failure shows no stale error (state reset when the dialog opens)
  </behavior>
  <action>
    Create src/components/wear/WearDeleteButton.tsx ('use client', named export WearDeleteButton, props { wearEventId: string; ownerUsername: string }). Use controlled Dialog with open state, useTransition for pending, and error state (string | null). handleOpenChange(next): when next is true reset error to null (one-shot state reset on open, not on mount — memory project_router_cache_stale_instance); block closing while pending. Trigger: Button variant="ghost" size="sm" with lucide Trash2 icon and label 'Delete wear', classes text-destructive plus hover:bg-destructive/10 and dark:hover:bg-destructive/20 (dark pair required for bg overrides; semantic tokens only — no raw palette colors). Wrap trigger in a div using className "px-4 md:max-w-[600px] md:mx-auto w-full" so it aligns with WearDetailMetadata. Dialog body: DialogHeader > DialogTitle 'Delete this wear?' + DialogDescription 'This permanently removes this wear, its photo or video, and any likes and comments. This can’t be undone.'; when error is set render a p with role="alert" and className "text-sm text-destructive". DialogFooter: Button variant="outline" 'Cancel' (disabled while pending, onClick closes); Button variant="destructive" 'Delete' (disabled while pending, label 'Deleting…' while pending). Confirm handler: if pending return; startTransition(async () => { const result = await deleteWearEvent({ wearEventId }); if (!result.success) { setError(result.error); return } setOpen(false); toast('Wear deleted'); router.replace(`/u/${result.data.username ?? ownerUsername}/worn`) }). Use useRouter from 'next/navigation'. router.replace (not push/back) so history does not return to the deleted /wear/[id]. Use font-semibold if any weight is needed, never font-bold. If ownerUsername is empty and the action returns null username, router.replace('/') as a safe fallback.
    Edit src/app/wear/[wearEventId]/page.tsx: import WearDeleteButton; inside the article, after WearDetailMetadata, render it only when wear.userId === viewerId (server-derived; DD-5), passing wearEventId and ownerUsername={wear.username ?? ''}. Add one line to the page doc comment noting the owner-only delete control (quick 260913-cae). Do not modify WearCard, WearOverflowMenu, or WearDetailHero.
    Create tests/components/wear/WearDeleteButton.test.tsx: vi.mock('@/app/actions/wearEvents', () => ({ deleteWearEvent: vi.fn() })), vi.mock('next/navigation') with a shared replace/push/back vi.fn router, vi.mock('sonner', () => ({ toast: vi.fn() })). One test per behavior bullet using @testing-library/react (fireEvent/waitFor; findByRole for the dialog). Include a disappearance assertion: after Cancel and after success, the dialog title is no longer in the document (memory feedback_test_assert_disappearance_too).
    Finish with the build gate: `npm run build` must exit 0 (authoritative per project memory; tsc/test suites carry baseline failures).
  </action>
  <verify>
    <automated>npx vitest run tests/components/wear/WearDeleteButton.test.tsx tests/components/wear/WearCard.test.tsx tests/no-raw-palette.test.ts && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "wear.userId === viewerId" "src/app/wear/[wearEventId]/page.tsx"` returns a line that renders WearDeleteButton
    - `grep -n "router.replace" src/components/wear/WearDeleteButton.tsx` returns at least 1 line; `grep -cE "router\.(push|back)\(" src/components/wear/WearDeleteButton.tsx` returns 0
    - `grep -n 'variant="destructive"' src/components/wear/WearDeleteButton.tsx` returns 1 line
    - `grep -c "font-bold" src/components/wear/WearDeleteButton.tsx` returns 0
    - Every `hover:bg-` override in WearDeleteButton.tsx has a matching `dark:hover:bg-` class
    - `git diff --name-only` shows no changes to src/components/wear/WearCard.tsx, WearOverflowMenu.tsx, or WearDetailHero.tsx
    - Component tests, WearCard tests, and no-raw-palette guard pass; `npm run build` exits 0
  </acceptance_criteria>
  <done>The owner sees 'Delete wear' on their own /wear/[id]; confirming deletes via the Server Action and lands on /u/&lt;username&gt;/worn; non-owners never see the control; build is green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> deleteWearEvent Server Action | Untrusted wearEventId; the caller may not own the wear |
| Server Action -> Supabase Storage (wear-photos) | Paths read from the DB row; must stay inside the caller's folder |
| Server Action -> Postgres (Drizzle service connection) | Deletes bypass RLS (local RLS off; service DAL is the real gate), so the WHERE clauses are the only guard |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-QK-IDOR | Elevation of Privilege | deleteWearEventForOwner / deleteWearEvent | mitigate | SELECT and DELETE both scoped with eq(wearEvents.userId, user.id) where user.id is from getCurrentUser(); miss returns uniform 'Wear not found'; UI gate is cosmetic only |
| T-QK-STORAGE | Tampering | storage remove in deleteWearEvent | mitigate | Only paths starting with `${user.id}/` and without '..' are removed; session client also bound by wear_photos_delete_own_folder RLS policy |
| T-QK-MASS | Tampering | deleteWearEventSchema | mitigate | z.object({ wearEventId: uuid }).strict() rejects extra keys such as userId |
| T-QK-OVERDELETE | Tampering / Integrity | activity + notification cleanup | mitigate | DD-1 60s window + ambiguity guard for watch_worn; DD-2 exact-id jsonb matches for notifications and commented activities; all in one transaction |
| T-QK-INFO | Information Disclosure | error messages | mitigate | Uniform 'Wear not found' for missing vs foreign; storage/DB internals only in console.error |
| T-QK-REPUDIATION | Repudiation | wear deletion | accept | Personal, owner-initiated data removal; no audit trail required |
| T-QK-DOS | Denial of Service | repeated delete calls | accept | Authenticated, owner-scoped, idempotent (second call returns 'Wear not found') |
</threat_model>

<verification>
- `npx vitest run tests/actions/wearEventsDelete.test.ts tests/components/wear/WearDeleteButton.test.tsx tests/integration/wear-delete-dal.test.ts` — pass (integration may skip without DATABASE_URL)
- `npm run build` exits 0 (authoritative gate)
- Operator local walk (REQUIRED before push, per CLAUDE.md Local-First Development — record in SUMMARY as a pending operator step, not a blocking checkpoint):
  1. `npm run dev` against local Supabase; sign in as vintage-anna@horlo.test / password123.
  2. Log a wear with a photo today (creates a watch_worn activity) and open /wear/<id>; confirm 'Delete wear' is visible.
  3. Sign in as viewer@horlo.test in another browser, open the same /wear/<id>; confirm no delete control. Like and comment on it.
  4. Back as vintage-anna: Delete wear -> Cancel (nothing changes) -> Delete wear -> Delete. Expect toast 'Wear deleted' and landing on /u/vintage-anna/worn without the wear; browser Back does not show the deleted wear page.
  5. SQL spot-check via docker exec psql on the local DB: no wear_events row for the id; no watch_worn activity for that user+watch in the window; no wear_like/wear_comment notification with payload wear_event_id = id; `select name from storage.objects where bucket_id='wear-photos' and name like '<anna-uid>/<id>%'` returns 0 rows.
  6. As viewer@horlo.test, reload home: no feed row for the deleted wear or the comment on it.
</verification>

<success_criteria>
- Owner can delete their own wear from /wear/[wearEventId] through a confirmation dialog and lands on their Worn tab with the wear gone
- Non-owners cannot see the control and cannot delete via direct action call
- Photo/video objects removed from the owner's folder only; storage failure never fails the delete
- Matching watch_worn activity removed only under the unambiguous DD-1 rule; wear notifications and commented activities cleaned by exact id
- Profile, bell, home, and watch-detail caches invalidated (updateTag for read-your-own-writes)
- `npm run build` exits 0
</success_criteria>

<output>
Create `.planning/quick/260913-cae-delete-wear-owner-only-action-delete-but/260913-cae-SUMMARY.md` when done. Include the DD-1 activity matching rule and its accepted edge, the DD-5 placement choice, and the operator local-walk steps from <verification> marked as PENDING (must run in `npm run dev` against local Supabase before push).
</output>

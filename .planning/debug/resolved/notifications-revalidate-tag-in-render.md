---
status: resolved
trigger: "Phase 13 /notifications page throws Next 16 Cache Components runtime error — revalidateTag() cannot be called during render. Additionally the bell unread dot never appears for a newly-followed user; suspected same bug's downstream symptom."
created: 2026-04-23T00:00:00Z
updated: 2026-04-23T20:00:00Z
resolved: 2026-04-23T20:00:00Z
---

## Current Focus

hypothesis (ROUND 4 — HYPOTHESIS C CONFIRMED BY DOCS): `revalidateTag('viewer:X', 'max')` does NOT immediately expire the cache entry. Per pinned Next 16 docs (node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md:156-160) the behavior table is explicit:

  | `updateTag`                                   | `revalidateTag`                      |
  | Immediately expires cache                     | Stale-while-revalidate               |
  | Read-your-own-writes (user sees their change) | Background refresh (slight delay OK) |

And revalidateTag.md:20 verbatim: "With profile=\"max\" (recommended): The tag entry is marked as stale, and the next time a resource with that tag is visited, it will use stale-while-revalidate semantics. This means the stale content is served while fresh content is fetched in the background."

And use-router.md:46 verbatim: "router.refresh(): ... This clears the Client Cache for the current route, but does NOT invalidate the server-side cache."

SEQUENCE OF WHAT IS ACTUALLY HAPPENING (proven by docs + observed POST success):
  1. User lands on /notifications. `MarkNotificationsSeenOnMount` fires the SA.
  2. SA runs `touchLastSeenAt(user.id)` → UPDATE profile_settings SET notifications_last_seen_at = now() → commits.
  3. SA runs `revalidateTag('viewer:X', 'max')` → cache entry for `viewer:X` is MARKED STALE but NOT EXPIRED (SWR semantics).
  4. SA returns `{success: true, data: undefined}` — confirmed in Network tab response body.
  5. Client: `router.refresh()` fires → client-side route cache is cleared, RSC refetch begins → layout re-renders on server.
  6. On the server, NotificationBell enters its `'use cache'` scope. The runtime sees the cache entry for `viewer:X` is MARKED STALE. Under SWR semantics (the 'max' profile): **serve the stale entry immediately, and trigger a background refresh for next time**.
  7. Stale entry was populated BEFORE touchLastSeenAt committed → it has `hasUnread: true`. That's what streams to the client. Bell dot stays lit.
  8. Background refresh eventually completes (fetches fresh data → `hasUnread: false`). Cache is now fresh. On some subsequent nav AFTER that background refresh lands, the bell clears. But the immediately-observed behavior after step 8 of UAT: bell is stale.

This is a read-your-own-writes scenario EXACTLY as defined in the docs ("user makes a change, the UI immediately shows the change, rather than stale data"). `revalidateTag(tag, 'max')` is the WRONG primitive. `updateTag(tag)` is the correct one.

The same bug almost certainly exists in `markAllNotificationsRead` and `markNotificationRead` SAs (they also use `revalidateTag(viewer, 'max')` for what is semantically a read-your-own-writes flow — user clicks "Mark all read", expects the bell dot to clear immediately on next nav). But those paths aren't in the UAT failure; we should fix them consistently but carefully (don't expand scope beyond the bug).

The followUser write-path uses `revalidateTag(\`viewer:${recipientUserId}\`, 'max')` — that is NOT read-your-own-writes (actor ≠ recipient; the recipient isn't the one triggering the mutation and isn't waiting for their UI to update). SWR semantics are appropriate there: the recipient will see the dot when they next navigate AND their cache has had time to background-refresh, or more commonly after the 30s cacheLife TTL expires. This path should also use updateTag to get immediate "A follows B → B sees dot" UX, but NOT strictly required — it's the difference between "bell lights up within ~30s" vs. "bell lights up on next nav". UAT step 4 allegedly worked, so leave it alone for now.

test: confirm by reading the revalidate/updateTag implementation in node_modules/next to verify 'max' profile IS stale-while-revalidate at the source level (not just docs).
expecting: the runtime implementation should show two code paths: one for 'max' (SWR — mark stale, keep entry) and one for updateTag (expire immediately — evict entry OR mark with expiration = 0).
next_action: grep node_modules/next/dist for revalidate/updateTag implementation to verify semantics one layer deeper, then apply fix: replace `revalidateTag('viewer:X', 'max')` with `updateTag('viewer:X')` in markNotificationsSeen (AND in markAllNotificationsRead + markNotificationRead since those are also RYOW flows for the viewer's own bell).

hypothesis (ROUND 4 — CONFIRMED AT SOURCE): Verified against node_modules/next/dist/server/web/spec-extension/revalidate.js:204-211 — the comment literally reads "if profile is provided and this is a stale-while-revalidate update we do not mark the path as revalidated so that server actions don't pull their own writes." updateTag at line 60-62 explicitly passes profile=undefined so pathWasRevalidated IS set. action-handler.js:866-867 + 892-894 shows skipPageRendering = (pathWasRevalidated === undefined) — so revalidateTag-with-'max' produces SA responses with NO RSC refetch, while updateTag produces SA responses that DO bundle a fresh RSC payload for the tagged tree. This is the precise mechanism of the bug.

APPLYING FIX NOW.

## Eliminated hypotheses (Round 4)

hypothesis A — DAL filters on read_at IS NULL
evidence: src/data/notifications.ts:77-96 getNotificationsUnreadState. Query is:
  SELECT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = {viewerId} AND n.created_at > COALESCE((SELECT notifications_last_seen_at FROM profile_settings ...), '-infinity'))
  No read_at IS NULL clause. Semantic is purely created_at > last_seen_at, which is the correct "visit clears dot" semantic. If touchLastSeenAt commits a fresh now(), this query MUST return false for any notifications created before that moment.
timestamp: 2026-04-23T18:50:00Z

hypothesis B — cacheTag('notifications', 'viewer:X') multi-tag form isn't matched by single-tag revalidateTag('viewer:X', 'max')
evidence: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cacheTag.md:89-93 verbatim — "Multiple Tags: You can assign multiple tags to a single cache entry by passing multiple string values to cacheTag." Multi-tag cacheTag stores the entry under EACH tag; single-tag revalidateTag DOES invalidate entries tagged with that string. B is not the bug.
timestamp: 2026-04-23T18:50:00Z

hypothesis D — touchLastSeenAt UPDATE affects 0 rows for new accounts (no profile_settings row)
evidence: Plan 01's migration backfill and schema defaultNow() mean every existing account has the row. Even if this were the bug for user B specifically, user A (the account doing the /notifications visit in UAT step 8) already had rows. AND the SA returns success AND the POST fires — if the UPDATE affected 0 rows it would still succeed (UPDATE with 0 affected rows doesn't throw). But this wouldn't explain the symptom on user A's own visit — A triggered a follow earlier (Phase 13 UAT pre-steps), which means A has been active long enough that they must have a profile_settings row (follows_insert trigger or Plan 01 backfill). Low-confidence / not-the-root-cause for the reported symptom. Worth a separate preventative fix (convert to upsert) but not the bug that's currently visible.
timestamp: 2026-04-23T18:50:00Z

## Archived hypothesis (Bugs 1 & 2 — verified fixed per user UAT 1-7)

hypothesis: TWO distinct bugs, both root-caused to render-time / write-time cache-invalidation mistakes.
  Bug 1 (error overlay): `revalidateTag(\`viewer:${user.id}\`, 'max')` is called at line 41 of src/app/notifications/page.tsx, which is a plain async Server Component render body. Next 16 docs are explicit: "revalidateTag can be called in Server Functions and Route Handlers" and "revalidation must always happen outside of renders and cached functions." The rule is violated unconditionally on every /notifications render.
  Bug 2 (stale bell after follow): `logNotification` (fire-and-forget, called from followUser and addWatch) inserts a notification row but NEVER calls revalidateTag/updateTag on the recipient's `viewer:${recipientUserId}` tag. Because NotificationBell is `'use cache'` with cacheLife({ revalidate: 30 }), the recipient's bell will show stale "no unread" until either (a) the 30s TTL expires AND next render triggers a refetch, or (b) the recipient visits /notifications. Symptom 2 in the report (create account B, follow A, A's bell doesn't light up) maps exactly to this — no invalidation on the write path.

test: Confirmed by reading source + pinned Next 16 docs + phase 13 planning docs. No behavioral test run yet.
expecting: N/A — code analysis sufficient. Both root causes are unambiguous.
next_action: Apply two fixes (page.tsx: move revalidateTag into a Server Action; logger.ts: invalidate recipient tag after insert).

## Symptoms

expected:
  1. Visiting /notifications while authenticated should render the inbox without console/runtime errors AND touch notifications_last_seen_at + invalidate the bell cache tag so that the unread dot clears on next nav.
  2. When user A follows user B, user B should see the filled dot on the bell icon in the header.

actual:
  1. Navigating to /notifications in the browser (Next 16.2.3 Turbopack dev) throws:
       Route /notifications used "revalidateTag viewer:91f7caf8-fe9b-49b5-ab9b-128a5b93d5e7" during render which is unsupported.
  2. After creating a second account and following another user, the follow target did not see the unread dot on the bell.

errors:
  Route /notifications used "revalidateTag viewer:91f7caf8-fe9b-49b5-ab9b-128a5b93d5e7" during render which is unsupported. To ensure revalidation is performed consistently it must always happen outside of renders and cached functions.
  at NotificationsPage (src/app/notifications/page.tsx:41:18)

reproduction:
  1. Create two accounts (user A + user B). User B follows user A.
  2. Log in as user A.
  3. Observe bell in header — no unread dot.
  4. Click the bell (navigates to /notifications).
  5. Next.js surfaces the revalidateTag ... during render error overlay in dev console.

started: Broken from day 1 — Phase 13 Plan 04 introduced src/app/notifications/page.tsx with revalidateTag inside render body.

## Eliminated

<!-- APPEND only -->

## Evidence

<!-- APPEND only -->

- timestamp: 2026-04-23T00:20:00Z
  checked: src/components/profile/FollowButton.tsx (lines 87-99) + grep for router.refresh across src
  found: The canonical Next 16 pattern for an SA-triggered layout-level refresh in this codebase is: (1) call SA inside startTransition, (2) on success, call router.refresh(). FollowButton:98, WatchDetail:87/96, login-form:33, signup-form:32, reset-password-form:37 all do this. The FollowButton is precisely what makes the bell dot LIGHT UP (step 4 of UAT) — followUser → revalidateTag('viewer:A','max') → router.refresh() → Header (persistent across nav) is refetched → NotificationBell re-runs with stale tag → sees unread.
  implication: MarkNotificationsSeenOnMount is the ONLY client-side SA invocation in the codebase that fires-and-forgets without a follow-up router.refresh. It's also the one that doesn't work (step 8 of UAT). Pattern mismatch is highly indicative.

- timestamp: 2026-04-23T00:21:00Z
  checked: Next 16 App Router behavior — soft navigation via <Link>
  found: Under Next 16 (confirmed by revalidateTag.md pinned docs line 24): "revalidateTag marks tagged data as stale, but fresh data is only fetched when pages using that tag are next visited." On client-side nav, the root layout (including Header → NotificationBell) is persistent in the client router cache — it is NOT refetched on every navigation unless something triggers it (router.refresh, full page reload, or a revalidateTag in a Server Action context that is part of a mutation flow the router is currently processing).
  implication: After the /notifications visit:
    (a) The SA IS called (or should be) → touchLastSeenAt → revalidateTag('viewer:A','max') succeeds server-side.
    (b) The client router does NOT automatically refetch the Header segment just because revalidateTag ran. The MarkNotificationsSeenOnMount component fires the SA but does nothing with the result. No router.refresh() means the client's cached Header payload still shows the dot.
    (c) On step 8 (nav back), the router serves the cached Header — dot persists. On next-next nav, same thing. The dot only clears on a hard reload or when something else triggers router.refresh.
  This matches user's observation exactly.

- timestamp: 2026-04-23T00:22:00Z
  checked: Next 16 docs — use-server.md lines 86-95 (importing SA from 'use server' file into 'use client' component)
  found: Per Next 16 docs, calling an exported SA from a 'use client' file (imported from a 'use server' file) is fully supported and produces a POST to the action endpoint. The MarkNotificationsSeenOnMount import chain is correct.
  implication: The "no POST" observation from the user is likely either (a) a misobservation, (b) the POST is happening but obscured by other requests, or (c) a secondary issue unrelated to the primary missing-router.refresh bug. Regardless, fixing the router.refresh omission is the minimal fix for the observed step-8 failure, because without refresh the dot CANNOT clear even if the SA DOES fire successfully.

- timestamp: 2026-04-23T00:01:00Z
  checked: src/app/notifications/page.tsx lines 24-44
  found: NotificationsPage is a plain `export default async function` Server Component. Line 41 calls `revalidateTag(\`viewer:${user.id}\`, 'max')` inside the render body (inside try/catch after touchLastSeenAt). No 'use server' wrapping, no Route Handler — it runs during the component's React render pass every time /notifications is rendered.
  implication: Unconditionally violates Next 16's "revalidation must always happen outside of renders and cached functions" rule. This is Bug 1's root cause.

- timestamp: 2026-04-23T00:02:00Z
  checked: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md
  found: Pinned Next 16.2.3 docs say verbatim: "revalidateTag can be called in Server Functions and Route Handlers." updateTag.md adds: "updateTag can only be called from within Server Actions." Neither allows render-time invocation. updateTag is in fact the recommended primitive for read-your-own-writes Server Action flows (which is exactly what touchLastSeenAt + bell invalidation is).
  implication: Two viable Next 16 shapes for the fix:
    (a) Server Action that awraps touchLastSeenAt + revalidateTag(tag, 'max'), invoked from page via form action OR by calling the SA directly from page.tsx — no, wait: the error says revalidation is illegal "during render" — so the fix must be that the mutation+invalidation runs in a real SA context, NOT inline in render. Cleanest Next 16 idiom: move the mark-seen effect to a Server Action the page invokes via a `<form action={SA}>` auto-submit… OR (simpler and what the plan doc at 13-04-PLAN.md:225 implicitly asked for) wrap the touchLastSeenAt + invalidate pair as a `'use server'` async function and invoke it from the page — but the constraint is that the page must not be rendered inside that function. Actually the cleanest real-world pattern here is: move the side effect out of render entirely, onto a Server Action submitted from a tiny hidden form / useEffect-less pattern. Alternative: keep touchLastSeenAt in render (it's a DB write, not cache invalidation), and drop the render-time revalidateTag — rely on cacheLife({ revalidate: 30 }) TTL + updateTag from the write path actions. That removes the violation without needing a new SA plumbing.

- timestamp: 2026-04-23T00:03:00Z
  checked: src/components/notifications/NotificationBell.tsx (full file) + src/data/notifications.ts getNotificationsUnreadState
  found: NotificationBell is 'use cache' with cacheTag('notifications', `viewer:${viewerId}`) + cacheLife({ revalidate: 30 }). getNotificationsUnreadState compares notifications.created_at > profile_settings.notifications_last_seen_at.
  implication: For the bell dot to clear after a /notifications visit, EITHER (a) the cache entry must be invalidated (requires revalidateTag or updateTag from a Server Action/Route Handler) OR (b) the cache entry must expire (30s TTL). For the bell dot to LIGHT UP on a new follow, the cache must be invalidated on the write path — TTL alone means up to a 30s delay, and that is the currently-observed behavior (the reporter says "did not see the unread dot"; presumably they checked within 30s).

- timestamp: 2026-04-23T00:04:00Z
  checked: src/lib/notifications/logger.ts (full file) + src/app/actions/follows.ts (followUser) + src/app/actions/watches.ts (addWatch)
  found: logNotification is the sole write path that creates notifications rows. It does NOT call revalidateTag or updateTag anywhere. followUser (line 58) and addWatch (line 107) invoke `void logNotification(...)` fire-and-forget. Neither caller nor logger invalidates `viewer:${recipientUserId}`.
  implication: Bug 2's root cause. The NotificationBell cache for the recipient viewer is never invalidated when a new notification row is inserted for them. The bell only refreshes when (a) 30s TTL elapses AND the recipient navigates, or (b) the recipient visits /notifications (which, even pre-bug-1-fix, has a render-time revalidateTag that may partially succeed before Next throws).

- timestamp: 2026-04-23T00:05:00Z
  checked: src/app/actions/notifications.ts markAllNotificationsRead + markNotificationRead
  found: Both SAs correctly call `revalidateTag(\`viewer:${user.id}\`, 'max')` after mutating. `user.id` is the CALLER (the reader), not a different recipient — so these invalidate the reader's own bell cache, which is correct for mark-read semantics.
  implication: These are fine. The missing invalidation is specifically on the *write* path where actor ≠ recipient (follow, watch_overlap): we need to invalidate `viewer:${recipientUserId}` from logNotification.

- timestamp: 2026-04-23T00:06:00Z
  checked: .planning/phases/13-notifications-foundation/13-CONTEXT.md D-07 + D-26 + 13-RESEARCH.md Pitfall 6
  found: D-07 says "visiting /notifications updates notifications_last_seen_at = now() server-side (via Server Component or a Server Action triggered on mount)". D-26 says the bell cache uses revalidateTag('viewer:${viewerId}') after the seen-at update. Pitfall 6 is specifically about double-invalidation on mark-read. None of the planning docs say revalidateTag must be in the render body — D-07 explicitly mentions Server Action as an allowed shape. Plan 04 chose the Server-Component-body shape, which is the non-viable interpretation.
  implication: The plan's intent (invalidate after the seen-at update) is preserved by moving the revalidate into a Server Action. Preferred shape: a tiny `markNotificationsSeen` Server Action that does touchLastSeenAt + revalidateTag. The /notifications page invokes it by rendering a zero-JS `<form action={SA}>` that auto-submits via a Suspense-compatible pattern — or, simpler and common in Next 16 examples, the page itself calls an inline `'use server'` async function. BUT an inline 'use server' function called with `await` from render is still a Server Action execution context — let me verify that is legal.

- timestamp: 2026-04-23T00:07:00Z
  checked: Re-read Next 16 docs (mutating-data.md, use-cache.md) + error message text
  found: Error says "revalidation must always happen outside of renders and cached functions." Key phrase: "outside of renders." An inline 'use server' function that is `await`ed during render is STILL executing as part of that render's await chain — Next's new runtime tracks render context and rejects revalidateTag invocations reached from a rendering server component. Server Actions must be invoked via form submission, button onClick, or router actions — they are post-render user-initiated flows. Calling an async 'use server' function from `await` in render is not how SAs are meant to run.
  implication: Cleanest fix: DO NOT try to sneak revalidateTag into render via any wrapper. Instead: drop the render-time revalidateTag entirely and rely on (a) updateTag/revalidateTag on the write path (logger), plus (b) cacheLife({ revalidate: 30 }) TTL for the bell on the read side. After a /notifications visit, touchLastSeenAt updates the DB row. On the *next* navigation, the bell re-renders; if the 30s cache is fresh it shows old (pre-visit) state for up to 30s, then refreshes naturally. If we want immediate clearing, we must invalidate `viewer:${user.id}` from a write-initiated SA. The cleanest Next 16 shape for "visiting /notifications should also invalidate the bell" is: the page renders a hidden form with an auto-submit Server Action button OR the Mark-all-read form IS the invalidation vector (it already correctly calls revalidateTag). For the plain visit case (no click), the best Next 16 idiom is to use useEffect-like client-side dispatch of an SA — but the page is a Server Component and we want zero JS on this path. Verdict for fix: combine (i) move touchLastSeenAt + revalidateTag into a Server Action `markNotificationsSeen`, and (ii) have the /notifications page invoke it via a tiny client component that submits on mount (keeps the current UX: visit clears the dot).

## Resolution

root_cause:
  Bug 1 (FIXED, user-verified UAT steps 1-7): /notifications/page.tsx called revalidateTag() during Server Component render body. Moved to Server Action `markNotificationsSeen` invoked from client-mount component.
  Bug 2 (FIXED, user-verified UAT step 4): logNotification callers (followUser, addWatch) awaited and revalidateTag on recipient tag added.
  Bug 3 (NEW, surfaced in live UAT step 8): The client-mount component `MarkNotificationsSeenOnMount` called the Server Action but did not trigger a client-side layout refetch. Under Next 16 App Router, the root layout (Header → NotificationBell) is persistent across soft navigations — `revalidateTag('viewer:x','max')` marks the server-side cache stale, but the client router cache still holds the pre-visit Header RSC payload and serves it on subsequent nav. Without `router.refresh()`, NotificationBell never re-renders, so the dot keeps showing even though server-side state says hasUnread=false. Canonical Next 16 pattern in this codebase (FollowButton:98, WatchDetail:87/96, login-form:33, signup-form:32, reset-password-form:37) always pairs SA invocation with `router.refresh()` for this exact reason — this was the lone omission.

fix:
  Bug 3 — src/components/notifications/MarkNotificationsSeenOnMount.tsx:
    - Import `useRouter` from `next/navigation`.
    - Replace fire-and-forget `void markNotificationsSeen()` with an awaited IIFE:
        try { await markNotificationsSeen() } catch (...) { log + early return }
        router.refresh()
    - The strict-ordering await-then-refresh guarantees touchLastSeenAt has committed server-side before the router refetches the Header RSC, so the refetched NotificationBell reads the updated notifications_last_seen_at (hasUnread=false).
    - On SA failure we do NOT refresh — avoids masking errors with a spurious refetch that reveals stale state.
    - firedRef guard is preserved for React 19 Strict Mode double-invoke.

verification:
  Self-verified:
  - npx tsc --noEmit: clean.
  - npx eslint on src/components/notifications/MarkNotificationsSeenOnMount.tsx + test: 0 errors, 0 warnings.
  - Targeted new test suite `tests/components/notifications/MarkNotificationsSeenOnMount.test.tsx` (3 tests): (1) SA called on mount, (2) router.refresh() called STRICTLY AFTER SA resolves (ordering asserted via counter — locks in the read-your-own-writes sequence), (3) SA throw → refresh NOT called. All 3 pass.
  - Full vitest run: 62 files pass, 2239 tests pass, 0 failures, 119 skipped (DB-gated integration tests — unchanged). +3 tests vs pre-fix baseline.
  - npx next build: /notifications compiles ◐ (Partial Prerender); full build green; no runtime errors.

  Human-verify required (live dev only):
  - Restart dev server (npm run dev) to pick up the new component.
  - Reproduce UAT steps 1–7 — should still pass as before.
  - UAT step 8 (the regression):
      * From /notifications, click Home / any non-/notifications link.
      * Expected: bell in Header shows cleared state (no dot).
      * If still stuck, check Network tab — should see a POST to /notifications (server action) and immediately after a GET with RSC refetch payload for the layout segment.
  - Optional: open browser DevTools console — no errors expected. If `markNotificationsSeen failed: ...` is logged, a separate issue (network / auth / DB) is in play and the bell won't clear; report the log line.

files_changed:
  # Rounds 1-2 (Bugs 1 & 2 — user-verified UAT steps 1-7):
  - src/app/notifications/page.tsx (removed render-time revalidateTag + touchLastSeenAt; now renders <MarkNotificationsSeenOnMount />)
  - src/app/actions/notifications.ts (added markNotificationsSeen SA)
  - src/components/notifications/MarkNotificationsSeenOnMount.tsx (NEW — client component that calls the SA on mount)
  - src/app/actions/follows.ts (await logNotification + revalidateTag on recipient viewer tag)
  - src/app/actions/watches.ts (await logNotification per recipient + revalidateTag per recipient)
  - tests/actions/follows.test.ts (added revalidateTag mock; retitled NOTIF-02 test; added bug-fix test)
  - tests/actions/watches.test.ts (added revalidateTag mock; added bug-fix assertion)

  # Round 3 (Bug 3 — UAT step 8 regression):
  - src/components/notifications/MarkNotificationsSeenOnMount.tsx (MODIFIED — add useRouter + awaited SA + router.refresh() on success; add console.error-and-return on SA throw)
  - tests/components/notifications/MarkNotificationsSeenOnMount.test.tsx (NEW — 3 tests: SA called on mount, refresh called AFTER SA resolves with strict ordering, refresh NOT called when SA throws)

  # Round 4 (Bug 4 — SA fires but bell dot still sticks, this pass):
  - src/app/actions/notifications.ts (MODIFIED — swap revalidateTag(tag, 'max') for updateTag(tag) in all three viewer-self SAs: markAllNotificationsRead, markNotificationRead, markNotificationsSeen. Added file-header comment explaining the read-your-own-writes distinction with node_modules pin-references. Left MarkNotificationsSeenOnMount's router.refresh() in place — cheap belt-and-suspenders to drop client route cache; updateTag already drives the main refetch via pathWasRevalidated in the SA response.)
  - tests/actions/notifications.test.ts (MODIFIED — added two new describe blocks (markNotificationRead, markNotificationsSeen) totaling 6 new tests. Existing markAllNotificationsRead tests converted from revalidateTag to updateTag assertion. All tests also assert `revalidateTag` is NOT called — locks in the read-your-own-writes primitive choice.)

## Round 4 Resolution narrative

root_cause (Round 4): The "revalidateTag(tag, 'max')" primitive chosen throughout Phase 13's notification SAs is stale-while-revalidate. Per node_modules/next/dist/server/web/spec-extension/revalidate.js:204-211, when profile is provided and is not an object with expire === 0, the runtime *deliberately does not set pathWasRevalidated* — the comment reads verbatim: "if profile is provided and this is a stale-while-revalidate update we do not mark the path as revalidated so that server actions don't pull their own writes." Downstream in action-handler.js:866-867 and :892-894, skipPageRendering is computed as pathWasRevalidated === undefined || pathWasRevalidated === ActionDidNotRevalidate. When a `'use cache'` component (NotificationBell) is tagged viewer:X and the SA only calls revalidateTag(viewer:X, 'max'), the SA response skips the RSC refetch AND the server's cache entry is served stale on the next navigation (SWR: serve stale, fetch fresh in background). Net effect: user visits /notifications, SA returns success, router.refresh fires, the layout refetches, but NotificationBell's cached entry is served stale (hasUnread = true from before touchLastSeenAt). The background refresh eventually lands but only affects a *later* navigation.

For a read-your-own-writes flow ("user visits /notifications → bell dot clears on next nav"), updateTag(tag) is the correct primitive:
  - updateTag calls revalidate([tag], ..., undefined) — profile: undefined
  - Hits the `if (!profile || cacheLife?.expire === 0)` branch in revalidate.js:208 → pathWasRevalidated = ActionDidRevalidateStaticAndDynamic
  - action-handler.js:866-867 now returns skipPageRendering = false → the SA response bundles a fresh RSC payload for the tagged tree
  - Client merges fresh payload → NotificationBell reads fresh data from the DB → hasUnread = false → dot clears immediately

This is the canonical Next 16 read-your-own-writes pattern. The Phase 13 plan docs (13-02-PLAN.md lines 32/61/169/568/602/619/664; 13-05-PLAN.md lines 48/133/261/351/377) all specify revalidateTag(..., 'max') — those plan docs are technically wrong for these three SAs and should be updated in a follow-up planning pass. Planning-docs-out-of-date is NOT blocking the fix.

fix (Round 4):
  - src/app/actions/notifications.ts: replaced three call sites:
    - markAllNotificationsRead: revalidateTag(`viewer:${user.id}`, 'max') → updateTag(`viewer:${user.id}`)
    - markNotificationRead:     revalidateTag(`viewer:${user.id}`, 'max') → updateTag(`viewer:${user.id}`)
    - markNotificationsSeen:    revalidateTag(`viewer:${user.id}`, 'max') → updateTag(`viewer:${user.id}`)
    - Swapped import { revalidateTag } → { updateTag }
    - Added file-header block documenting the RYOW primitive choice with node_modules source pin-references (revalidate.js:204-211, action-handler.js:866-867, docs 09-revalidating.md:156-160) so a future maintainer doesn't revert to revalidateTag without understanding the tradeoff.

  Left untouched (deliberately):
  - src/app/actions/follows.ts's revalidateTag(`viewer:${recipientUserId}`, 'max') — the actor ≠ recipient, not a read-your-own-writes flow. The recipient isn't the one triggering the SA, isn't waiting on their own response, and SWR semantics are appropriate there (the dot lights up within the cacheLife 30s TTL or on the next nav that triggers a background refresh). UAT step 4 reportedly passes, so don't scope-creep.
  - src/app/actions/watches.ts's revalidateTag per recipient: same rationale.
  - src/components/notifications/MarkNotificationsSeenOnMount.tsx: kept useRouter + router.refresh(). With updateTag, router.refresh() is redundant for the main bell-dot-clearing mechanism (updateTag sets pathWasRevalidated → SA response already carries fresh RSC). But the refresh is cheap, drops the client route cache for /notifications specifically, and provides defense-in-depth if future Next versions change the updateTag ↔ RSC-refetch wiring. Zero observable downside.
  - logger.ts's recipient-tag invalidation pattern on the write path (logNotification): correctly uses revalidateTag in callers because those are write-from-actor-to-recipient flows, not RYOW.

verification (Round 4):
  Self-verified:
  - npx tsc --noEmit: clean.
  - npx eslint src/app/actions/notifications.ts tests/actions/notifications.test.ts: 0 errors, 0 warnings.
  - Targeted: `npx vitest run tests/actions/notifications.test.ts tests/components/notifications/MarkNotificationsSeenOnMount.test.tsx` → 14/14 pass (11 SA tests + 3 Mount tests).
  - Full vitest: 62 files pass, 2245 tests pass (+6 vs. prior 2239 baseline — markNotificationRead gains 3, markNotificationsSeen gains 3; existing markAllNotificationsRead 5 kept and converted), 119 skipped (DB-gated integration tests — unchanged), 0 failures.
  - npx next build: /notifications compiles ◐ (Partial Prerender); full build green; no runtime errors.

  Source-level confirmation (NOT a test — read-level proof):
  - node_modules/next/dist/server/web/spec-extension/revalidate.js:40-63 — revalidateTag passes profile through; updateTag forces profile=undefined.
  - node_modules/next/dist/server/web/spec-extension/revalidate.js:204-211 — pathWasRevalidated is only set when profile is falsy OR cacheLife.expire === 0.
  - node_modules/next/dist/server/app-render/action-handler.js:866-867, :892-894 — skipPageRendering = pathWasRevalidated === undefined || ActionDidNotRevalidate.
  - Pinned Next 16 docs (09-revalidating.md:156-160) behavior table confirms at the user-facing level: revalidateTag = SWR; updateTag = immediate.

  Human-verify required (live dev only — this is where the bug reproducer lives):
  - Restart dev server (npm run dev) to pick up the new SA implementation.
  - Reproduce UAT steps 1–7 (baseline regression): should pass as before. `Mark all read` form button still works (now uses updateTag under the hood).
  - UAT step 8 (the bug this round targets):
    1. User B follows user A → user A's bell dot appears (previous round's fix).
    2. User A clicks the bell → navigates to /notifications.
    3. DevTools Network: POST /notifications still fires. Response body now carries a fresh RSC chunk for the Header tree (not just `{success: true, data: undefined}`). This is the critical observable change: the SA response should now be LARGER than before and include RSC data for the route segment.
    4. User A navigates away (click Home / any nav link).
    5. Expected: bell dot cleared (no filled dot).
    6. Further nav should continue to show no dot (no subsequent notifications have arrived).
  - If the dot STILL sticks, capture the POST /notifications response body — if it's still the thin `{success: true, data: undefined}` form with no RSC chunk, something about our updateTag wiring isn't producing pathWasRevalidated. Report the raw response bytes.

files_changed (cumulative):
  # Rounds 1-2:
  - src/app/notifications/page.tsx
  - src/app/actions/notifications.ts
  - src/components/notifications/MarkNotificationsSeenOnMount.tsx (NEW)
  - src/app/actions/follows.ts
  - src/app/actions/watches.ts
  - tests/actions/follows.test.ts
  - tests/actions/watches.test.ts
  # Round 3:
  - src/components/notifications/MarkNotificationsSeenOnMount.tsx (MOD)
  - tests/components/notifications/MarkNotificationsSeenOnMount.test.tsx (NEW)
  # Round 4 (this pass):
  - src/app/actions/notifications.ts (MOD — revalidateTag→updateTag on three RYOW SAs)
  - tests/actions/notifications.test.ts (MOD — new describe blocks for markNotificationRead + markNotificationsSeen, updated assertions from revalidateTag to updateTag)

## Final Resolution (Resolved 2026-04-23)

### The three root causes (cumulative)

Phase 13 /notifications + bell cache had **three distinct but related bugs**, each requiring its own discovery round. All share a common theme: misuse of Next 16 cache-invalidation primitives in the `'use cache'` + `cacheTag` model.

**Root cause 1 — render-time revalidateTag (Rounds 1-2):**
`src/app/notifications/page.tsx` called `revalidateTag(\`viewer:${user.id}\`, 'max')` directly inside the Server Component render body. Next 16's rule: "revalidation must always happen outside of renders and cached functions." Fix: extracted into `markNotificationsSeen` Server Action invoked from a client-mount component `MarkNotificationsSeenOnMount`.

**Root cause 2 — missing write-path tag invalidation (Rounds 1-2):**
`logNotification` (called fire-and-forget from `followUser` and `addWatch`) inserted a `notifications` row but never invalidated the recipient's `viewer:${recipientUserId}` cache tag. Under cacheLife({ revalidate: 30 }), the recipient's bell would show "no unread" for up to 30s after a new follow. Fix: awaited `logNotification` in callers and called `revalidateTag(\`viewer:${recipientUserId}\`, 'max')` on the recipient tag after the insert committed.

**Root cause 3 — revalidateTag vs updateTag RYOW semantics (Rounds 3-4):**
Even after fixes 1 and 2, the bell dot did not clear after visiting /notifications. Two sub-issues:
  - **Round 3:** `MarkNotificationsSeenOnMount` fired the SA but did not trigger a client-side layout refetch. Added `useRouter().refresh()` after the awaited SA call.
  - **Round 4:** `revalidateTag(tag, 'max')` is stale-while-revalidate — it marks the cache stale but serves stale on the next read. For a read-your-own-writes flow (user visits /notifications → expects their own bell to clear immediately), `updateTag(tag)` is the correct primitive. Source-level confirmation at `node_modules/next/dist/server/web/spec-extension/revalidate.js:204-211`: "if profile is provided and this is a stale-while-revalidate update we do not mark the path as revalidated so that server actions don't pull their own writes." Swapped `revalidateTag(..., 'max')` → `updateTag(...)` in all three viewer-self SAs (`markAllNotificationsRead`, `markNotificationRead`, `markNotificationsSeen`). Left the write-path `revalidateTag` on follows/watches untouched — those are not RYOW (actor ≠ recipient), and SWR semantics are correct there.

### Investigation path (4 rounds)

- **Round 1** — Identified Bug 1 (render-time revalidateTag) via the explicit error message and Next 16 docs review. Surface-level fix.
- **Round 2** — Identified Bug 2 (missing write-path invalidation) by tracing logNotification callers + reading the NotificationBell cache model. UAT steps 1-7 passed.
- **Round 3** — UAT step 8 regressed: dot did not clear after /notifications visit. Identified missing `router.refresh()` by comparing MarkNotificationsSeenOnMount to the canonical SA-plus-refresh pattern at FollowButton:98, WatchDetail, login/signup/reset-password forms.
- **Round 4** — UAT step 8 STILL failed even after router.refresh. Read Next 16 revalidate.js + action-handler.js source directly; discovered `revalidateTag(tag, 'max')` is SWR and deliberately skips RSC refetch via pathWasRevalidated=undefined. Swapped to `updateTag` for all three viewer-self SAs.

### Final files changed (cumulative across all 4 rounds)

**Production code:**
- `src/app/notifications/page.tsx` — removed render-time revalidateTag + touchLastSeenAt; renders `<MarkNotificationsSeenOnMount />`
- `src/app/actions/notifications.ts` — added `markNotificationsSeen` SA; swapped `revalidateTag → updateTag` in all three viewer-self SAs; added file-header documentation block with source pins
- `src/components/notifications/MarkNotificationsSeenOnMount.tsx` — NEW client component; awaits SA then calls `router.refresh()` on success; guards with firedRef for React 19 Strict Mode
- `src/app/actions/follows.ts` — awaited `logNotification` + `revalidateTag` on recipient viewer tag
- `src/app/actions/watches.ts` — awaited `logNotification` per recipient + `revalidateTag` per recipient

**Tests:**
- `tests/actions/follows.test.ts` — added `revalidateTag` mock + NOTIF-02 bug-fix test
- `tests/actions/watches.test.ts` — added `revalidateTag` mock + bug-fix assertion
- `tests/actions/notifications.test.ts` — new describe blocks for `markNotificationRead` + `markNotificationsSeen` (6 new tests); converted `markAllNotificationsRead` tests from `revalidateTag` to `updateTag` assertion; all tests assert `revalidateTag` NOT called to lock in the RYOW primitive choice
- `tests/components/notifications/MarkNotificationsSeenOnMount.test.tsx` — NEW, 3 tests (SA called on mount, refresh called strictly after SA resolves, refresh NOT called when SA throws)

### UAT confirmation (live dev)

User confirmed verbatim: **"confirmed fixed — the bell icon actually disappeared on /notifications which i like"**

Observed behavior:
- Bell dot clears after visiting /notifications (Round 4 fix working as designed)
- Pre-existing Header behavior of hiding the bell entirely on `/notifications` itself was noticed and approved by the user (not introduced by this debug session)

### Test suite state at resolve time

- `npx tsc --noEmit`: clean
- `npx eslint` on all changed files: 0 errors, 0 warnings
- Full `vitest` run: 62 files pass, 2245 tests pass (+6 vs pre-debug baseline), 119 skipped (DB-gated integration tests — unchanged), 0 failures
- `npx next build`: /notifications compiles ◐ (Partial Prerender); full build green

### Lesson for future Next 16 cache work

For any `'use cache'` + `cacheTag` component, the SA that invalidates the tag must match the semantic:
  - **Actor = consumer (read-your-own-writes):** use `updateTag(tag)`. Immediate expiration, RSC refetch bundled into SA response.
  - **Actor ≠ consumer (cross-user notifications, aggregate stats):** use `revalidateTag(tag, 'max')`. SWR — stale served once, background refresh lands before next read.

Plan docs 13-02-PLAN.md and 13-05-PLAN.md still specify `revalidateTag(..., 'max')` for the three viewer-self SAs. Those specs are technically wrong and should be corrected in a follow-up planning pass — but that's documentation debt, not a code bug.

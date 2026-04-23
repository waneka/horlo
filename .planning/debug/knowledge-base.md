# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## notifications-revalidate-tag-in-render — /notifications render error + bell stale cache after follow/visit (3 related Next 16 cache bugs)
- **Date:** 2026-04-23
- **Error patterns:** revalidateTag, during render, NotificationsPage, viewer tag, bell unread dot, notifications_last_seen_at, cacheTag, use cache, stale-while-revalidate, updateTag, router.refresh, read-your-own-writes, Next 16 Cache Components
- **Root cause:** Three distinct bugs in Next 16 `'use cache'` + `cacheTag` flow: (1) `revalidateTag()` called inside Server Component render body on /notifications/page.tsx — illegal per Next 16 rule "revalidation must always happen outside of renders and cached functions"; (2) `logNotification` write path (followUser/addWatch callers) never invalidated recipient's `viewer:${recipientUserId}` cache tag — bell showed stale "no unread" until cacheLife TTL; (3) `revalidateTag(tag, 'max')` is stale-while-revalidate — it deliberately skips pathWasRevalidated so the SA response does NOT bundle a fresh RSC payload, meaning read-your-own-writes flows (user visits /notifications → expects own bell to clear) see stale data on next nav. For RYOW flows, `updateTag(tag)` is the correct primitive.
- **Fix:** (1) Extracted mark-seen into `markNotificationsSeen` Server Action invoked from client-mount component `MarkNotificationsSeenOnMount`; (2) Awaited `logNotification` in callers and added `revalidateTag(\`viewer:${recipientUserId}\`, 'max')` on write path; (3) `MarkNotificationsSeenOnMount` awaits SA then calls `router.refresh()`; swapped `revalidateTag(..., 'max')` → `updateTag(...)` in all three viewer-self SAs (`markAllNotificationsRead`, `markNotificationRead`, `markNotificationsSeen`). Left write-path `revalidateTag` on follows/watches untouched — those are actor≠recipient, SWR is correct.
- **Files changed:** src/app/notifications/page.tsx, src/app/actions/notifications.ts, src/components/notifications/MarkNotificationsSeenOnMount.tsx (NEW), src/app/actions/follows.ts, src/app/actions/watches.ts, tests/actions/follows.test.ts, tests/actions/watches.test.ts, tests/actions/notifications.test.ts, tests/components/notifications/MarkNotificationsSeenOnMount.test.tsx (NEW)
---

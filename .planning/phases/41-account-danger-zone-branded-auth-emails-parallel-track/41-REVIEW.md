---
phase: 41-account-danger-zone-branded-auth-emails-parallel-track
reviewed: 2026-05-15T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/lib/supabase/admin.ts
  - src/app/actions/account.ts
  - src/components/settings/AccountSection.tsx
  - src/components/settings/DangerZoneSection.tsx
  - src/components/settings/DeleteAccountModal.tsx
  - src/components/settings/WipeCollectionModal.tsx
  - emails/components/HorloEmailLayout.tsx
  - emails/confirm-signup.tsx
  - emails/reset-password.tsx
  - emails/change-email.tsx
  - tests/components/DeleteAccountModal.test.tsx
  - tests/components/WipeCollectionModal.test.tsx
  - tests/components/settings/AccountSection.test.tsx
  - tests/integration/account-delete.test.ts
  - tests/integration/account-wipe.test.ts
  - tests/static/email-templates.test.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
  resolved: 4
  resolved_ids: [CR-01, WR-02, WR-03, WR-04]
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-05-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 41 ships two destructive server actions (`wipeCollection`, `deleteAccount`) backed by a service-role Supabase client, two type-to-confirm modals, and four branded auth email templates.

The authorization model is sound: both server actions derive `user.id` exclusively from the server-side session via `getCurrentUser()` and never accept a user identifier as an argument — the modals invoke `wipeCollection()` / `deleteAccount()` with zero arguments, so IDOR is structurally impossible. The service-role client is correctly fenced behind `import 'server-only'`, created per-call, and only referenced from a `'use server'` module. The storage-purge-before-DB-delete ordering and the `public.users`-before-`auth.admin.deleteUser()` ordering both match the documented pitfalls.

However, there is one **BLOCKER**: the storage-purge pagination loop silently skips files when a user has more than 1000 wear photos, leaving orphaned objects behind on both wipe and account-delete. There are also several robustness gaps: the re-auth password check is bypassable, the post-delete client sign-out can fail silently, and the wipe action's cache invalidation does not actually mirror `removeWatch` as its comment claims.

## Critical Issues

### CR-01: Storage purge pagination skips files past the first 1000 — orphaned objects on large collections [RESOLVED]

**Resolution (2026-05-15):** Fixed in commit `a515814`. `purgeWearPhotos` now always re-lists from offset 0; each `remove()` consumes the head of the listing, so the loop terminates when `list()` returns empty.


**File:** `src/app/actions/account.ts:27-47`
**Issue:** `purgeWearPhotos` lists a page of objects at `offset`, removes them, then advances `offset += PAGE_SIZE`. But `remove()` deletes the listed objects, so the next `list()` call sees a *shrunk* listing. After deleting the first 1000 objects, the objects formerly at indices 1000–1999 shift down to indices 0–999. Advancing `offset` to 1000 then lists indices 1000–1999 of the now-shortened set — skipping the 1000 files that moved into the 0–999 window.

Concrete trace with 2500 files:
- Iteration 1: `list(offset=0)` returns files 0–999, removes them. 1500 remain. `offset` becomes 1000.
- Iteration 2: `list(offset=1000)` returns what is now files 1000–1499 of the 1500 survivors (i.e. the *last* 500), removes them. 1000 remain. `offset` becomes 2000.
- Iteration 3: `list(offset=2000)` returns empty → loop breaks.
- Result: **1000 wear photos orphaned** in `wear-photos/{userId}/`.

For `deleteAccount` this is worse: the `public.users` row and `auth.users` row are deleted, so the orphaned storage objects can never be re-listed or cleaned by the (now-deleted) user — permanent dead storage. This directly violates Phase 41 success criterion 2 ("storage purged before DB delete") for any collection above the page size.

**Fix:** Always re-list from offset 0, since each `remove()` consumes the head of the list. Drop the `offset` variable entirely:
```ts
async function purgeWearPhotos(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<void> {
  const PAGE_SIZE = 1000
  while (true) {
    const { data: files, error: listErr } = await supabase.storage
      .from('wear-photos')
      .list(userId, { limit: PAGE_SIZE }) // always offset 0
    if (listErr) throw listErr
    if (!files || files.length === 0) break

    const paths = files.map((f) => `${userId}/${f.name}`)
    const { error: removeErr } = await supabase.storage
      .from('wear-photos')
      .remove(paths)
    if (removeErr) throw removeErr
  }
}
```
The loop terminates because every iteration removes `min(PAGE_SIZE, remaining)` objects until `list()` returns empty.

## Warnings

### WR-01: Re-auth password gate is advisory only — `wipeCollection`/`deleteAccount` execute regardless of password correctness

**File:** `src/components/settings/DeleteAccountModal.tsx:73-89`, `src/components/settings/WipeCollectionModal.tsx:68-84`
**Issue:** The modals call `supabase.auth.signInWithPassword()` on the *browser* client and short-circuit on error, then call the server action. But the server action (`deleteAccount` / `wipeCollection`) performs **no password re-verification** — it only checks `getCurrentUser()`. A user with a hijacked session, an open laptop, or anyone able to invoke the server action directly (it is a public `'use server'` export) can destroy the account/collection with no password at all. The password prompt is purely a client-side UX speed bump, not a security control. The doc comment in both modals claims it "reuses PasswordReauthDialog pattern — signInWithPassword before server action, short-circuit on wrong password," implying a real re-auth gate that does not exist server-side.

A secondary issue: a successful `signInWithPassword` issues a *fresh* session/refresh token, mutating auth state as a side effect of a "verification" call.

**Fix:** Treat the password as a confirmation token verified server-side. Pass the password to the action and re-verify within the action using a transient client, e.g. `await admin.auth.signInWithPassword(...)` against the session user's email before any destructive step, or have the action call `getUserById` + a dedicated reauth path. At minimum, document explicitly that the password check is non-authoritative UX-only so a future reader does not mistake it for a security boundary.

### WR-02: Post-delete client sign-out failure is swallowed — user can stay logged into a deleted account [RESOLVED]

**Resolution (2026-05-15):** Fixed in commit `0155a1c`. `signOut()` is now wrapped in try/catch and the modal hard-navigates with `window.location.assign('/')` so the redirect and client-state clear always happen even when sign-out fails. The unused `useRouter` import was dropped.


**File:** `src/components/settings/DeleteAccountModal.tsx:91-95`
**Issue:** After `deleteAccount()` succeeds, the modal calls `await createSupabaseBrowserClient().auth.signOut()` and `router.push('/')` with no error handling. If `signOut()` rejects or the network drops, the catch in `useFormFeedback.run` will fire `toast.error` and set error state — but the account is already destroyed. The user sees an error toast on a deleted account, is not redirected, and holds a now-invalid session cookie. The local browser session JWT remains valid until expiry even though the `auth.users` row is gone, so the app may render in a half-broken authenticated state until the next server round-trip 401s.

**Fix:** Make the redirect resilient — perform `router.push('/')` (or a hard `window.location.assign('/')`) in a `finally`-style guarantee even if `signOut()` throws, and do not treat sign-out failure as a user-facing error once the delete has already committed:
```ts
const result = await deleteAccount()
if (!result.success) { return { success: false as const, error: '…' } }
try { await createSupabaseBrowserClient().auth.signOut() } catch { /* account already gone */ }
window.location.assign('/') // hard nav clears all client state + stale session
return { success: true as const, data: undefined }
```

### WR-03: `wipeCollection` cache invalidation does not mirror `removeWatch` as the comment claims [RESOLVED]

**Resolution (2026-05-15):** Fixed in commit `e9de2a2`. `wipeCollection` now calls `revalidatePath('/u/[username]', 'layout')` so the owner's public profile grid is invalidated after a wipe. (Note: the live `removeWatch` does not itself call this path; the established convention used by `addWatch`/`editWatch`/`follows`/`divestments`/`notes`/`profile` was followed.)


**File:** `src/app/actions/account.ts:85-93`
**Issue:** The comment on line 86 states the invalidation set "mirror[s] removeWatch's invalidation set." It does not. `removeWatch` in `src/app/actions/watches.ts` (lines 473-488) calls `revalidatePath('/')`, `revalidatePath('/u/[username]', 'layout')`, `revalidateTag('profile:…', 'max')`, and `revalidateTag('explore', 'max')`. `wipeCollection` omits `revalidatePath('/u/[username]', 'layout')` entirely. After a wipe, the user's own public profile page at `/u/{username}` will continue serving a stale cached collection until something else revalidates that layout. Since wipe removes *all* watches, the staleness is maximally visible (a wiped collector still shows a full grid on their profile).

**Fix:** Add the missing revalidation, or correct the comment to state which paths intentionally diverge and why:
```ts
revalidatePath('/')
revalidatePath('/u/[username]', 'layout')
```

### WR-04: `deleteAccount` failure between `db.delete(users)` and `auth.admin.deleteUser()` leaves a deletable-but-orphaned auth user [RESOLVED]

**Resolution (2026-05-15):** Fixed in commit `9f1bbd3` via option (b). `deleteAccount` is now idempotently re-runnable: in the partial state `getCurrentUser()` still succeeds, `db.delete(users)` no-ops on 0 rows, and the auth delete completes the cleanup. A `dbDeleted` flag drives a distinct partial-completion log line so an operator can see exactly where a run stopped.


**File:** `src/app/actions/account.ts:141-148`
**Issue:** The action deletes `public.users` (line 141), then calls `auth.admin.deleteUser()` (line 147). If the process crashes, the request times out, or `adminErr` is thrown between those two steps, the `public.users` row and its 9 cascade children are gone but the `auth.users` row survives. The user can still log in (auth succeeds) but the app has no `public.users` row for them — every authenticated query keyed on `users.id` will fail or render an empty/broken account with no recovery path from the UI (the Danger Zone itself may not render). There is no compensating retry or transactional guarantee, and the generic catch returns "Failed to delete account" without indicating partial completion.

**Fix:** This is inherent to spanning two systems (Postgres + GoTrue) without a distributed transaction, but the failure mode should be made recoverable: either (a) call `auth.admin.deleteUser()` *first* then `db.delete(users)` and accept the inverse orphan (orphaned `public.users` with no login — which the existing code's own comment at lines 117-119 says is the dangerous one, so this is a genuine tradeoff to document), or (b) wrap with an idempotent retry so a re-invocation of `deleteAccount` completes the auth delete even when `public.users` is already gone (guard the `db.delete` to tolerate 0 rows). At minimum, log the partial-completion state distinctly so an operator can finish the cleanup.

### WR-05: `purgeWearPhotos` deletes the entire `wear-photos/{userId}/` prefix indiscriminately during wipe — no scoping to collection-owned events

**File:** `src/app/actions/account.ts:23-48`, used at `:79`
**Issue:** For `wipeCollection`, the intent is to delete photos for wear events being removed. `purgeWearPhotos` removes *every* object under `wear-photos/{userId}/`. That happens to be correct only if every object under that prefix belongs to a `wear_events` row owned by the user (the flat `{userId}/{wearEventId}.jpg` layout suggests it does). But the function is named generically and the wipe doc comment lists "All objects under wear-photos/{userId}/" as deleted — if any future feature stores other per-user photos under the same prefix, `wipeCollection` will silently destroy them even though wipe is documented to "preserve the account." This is a latent coupling bug, not a current data-loss bug.

**Fix:** Either rename to make the prefix-purge intent explicit (`purgeUserWearPhotoPrefix`) and add an assertion comment that the `wear-photos/{userId}/` prefix is exclusively wear-event photos, or scope the wipe deletion to the `wearEventId`s actually being deleted.

### WR-06: `purgeWearPhotos` `supabase` parameter type is misleadingly narrow

**File:** `src/app/actions/account.ts:23-26`
**Issue:** The parameter is typed `Awaited<ReturnType<typeof createSupabaseServerClient>>`, and the JSDoc says "session-scoped or admin client; caller decides." But the admin client (`createSupabaseAdminClient`, from `@supabase/supabase-js`) and the server client (`createServerClient`, from `@supabase/ssr`) are different types. Passing the admin client would be a type error despite the doc inviting it. Both actions only ever pass the session client, so this never breaks today — but the doc and the type contradict each other, which will mislead a future caller who tries to pass the admin client (e.g. to purge storage after the session is revoked, which the `deleteAccount` comment at lines 130-134 explicitly worries about).

**Fix:** Either narrow the JSDoc to "session-scoped client only" or widen the parameter type to a union / minimal structural type covering just the `.storage.from().list()/.remove()` surface both clients share.

## Info

### IN-01: `signInWithPassword` re-auth races against the post-delete `signOut`

**File:** `src/components/settings/DeleteAccountModal.tsx:73-93`
**Issue:** `handleExecute` creates one browser client for `signInWithPassword`, then a *second* `createSupabaseBrowserClient()` instance for `signOut` (line 93). The comment ("Do not cache session objects across re-auth -> action -> signOut") justifies the fresh instance, but both instances share the same persisted storage, so creating a second client provides no isolation — it is the same session under the hood. Harmless, but the comment overstates the protection.
**Fix:** Reuse the `supabase` const from line 73 for the sign-out call; drop the misleading second instantiation.

### IN-02: Type-to-confirm keyword check is case- and whitespace-sensitive with no normalization

**File:** `src/components/settings/DeleteAccountModal.tsx:179`, `src/components/settings/WipeCollectionModal.tsx:175`
**Issue:** `typed !== 'DELETE'` / `typed !== 'WIPE'` is an exact-match gate. A trailing space (`'DELETE '`) or autocapitalized mobile input keeps the button disabled with no feedback explaining why. This is intentional friction for a destructive action and is defensible, but mobile keyboards that auto-add a trailing space on autocomplete can frustrate a legitimate user with no hint.
**Fix:** Consider `typed.trim() !== 'DELETE'` to tolerate trailing whitespace while keeping case sensitivity as the deliberate friction. Optional.

### IN-03: `deleteAccount` integration test asserts call ordering with a conditional that can no-op

**File:** `tests/integration/account-delete.test.ts:118-125`, `tests/integration/account-wipe.test.ts:94-98`
**Issue:** The ordering assertions are wrapped in `if (storageIdx !== -1 && dbIdx !== -1)`. If the action regressed and never called storage-remove (e.g. purge skipped), `storageIdx` would be `-1`, the `if` would be false, and the test would pass green despite the regression. The "storage purge precedes DB delete" contract — the phase's success criterion 2 — is therefore not actually enforced when storage is empty or skipped.
**Fix:** Assert unconditionally that both indices are `!== -1` (the test seeds a file via `mockStorageList`, so both calls *must* happen), then assert ordering. Remove the `if` guard.

### IN-04: Email footer copy is inaccurate for the confirm-signup template

**File:** `emails/components/HorloEmailLayout.tsx:84-86`
**Issue:** The shared footer reads "You're receiving this because someone used this address to sign in to Horlo." For `confirm-signup.tsx` the recipient has *signed up*, not *signed in* — they cannot sign in until they confirm. For `reset-password` and `change-email` the wording is also imprecise (a reset request is not a sign-in). Minor copy accuracy issue; the "if that wasn't you, ignore this" intent still lands.
**Fix:** Use neutral wording such as "You're receiving this because this address was used with a Horlo account." Optional copy polish.

---

_Reviewed: 2026-05-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

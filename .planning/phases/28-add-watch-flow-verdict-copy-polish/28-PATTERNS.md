# Phase 28: Add-Watch Flow & Verdict Copy Polish — Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 18 modify-targets + 4 new-test targets
**Analogs found:** 18 / 18 (every modify-target has at least one in-codebase analog; no "no analog" rows)

---

## File Classification

### Files to MODIFY

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/lib/hooks/useFormFeedback.ts` | Hook (Client) | input → side-effect (toast + banner state) | self — additive extension | exact (extending the file itself) |
| `src/app/watch/new/page.tsx` | Server Component | searchParams → validate → render | self — extends in-file whitelist (lines 50-70) | exact (mirror in-file) |
| `src/components/watch/AddWatchFlow.tsx` | Client Component (orchestrator) | props + state → addWatch + router.push | self — Wishlist commit handler (lines 266-298) | exact (in-file rewrite) |
| `src/components/watch/WatchForm.tsx` | Client Component (form) | formData → addWatch → router.push | self — line 209 (`router.push('/')`) | exact (in-file replacement) |
| `src/components/watch/WishlistRationalePanel.tsx` | Client Component | verdict → defaultRationale text | self — `defaultRationale` (lines 42-46) + hint (line 84-86) | exact (in-file rewire) |
| `src/lib/verdict/templates.ts` | Library (server-only types) | (none — pure const) | self — TEMPLATES (lines 14-119) + DESCRIPTION_FOR_LABEL (lines 130-137) | exact (in-file extension) |
| `src/lib/verdict/types.ts` | Type Definition | (types-only) | self — VerdictBundleFull (lines 22-31), Template (lines 74-83) | exact (in-file additive field) |
| `src/lib/verdict/composer.ts` | Library (server-only) | inputs → analyzeSimilarity → bundle | self — TEMPLATES loop (lines 62-72) + return (lines 74-84) | exact (in-file lockstep) |
| `src/components/layout/DesktopTopNav.tsx` | Client Component (already `'use client'`) | href construction | `FollowButton.tsx:65-73` (`?next=` capture) | role-match — adapt to `?returnTo=` |
| `src/components/profile/CollectionTabContent.tsx` | Client Component (`'use client'`) | href on `<Link>` (line 111) | `FollowButton.tsx:65-73` | role-match |
| `src/components/profile/WishlistTabContent.tsx` | Client Component (`'use client'`) | href on `<Link>` (line 61) | `FollowButton.tsx:65-73` | role-match |
| `src/components/profile/AddWatchCard.tsx` | Server Component (current) — D-10 (a) convert OR (b) accept prop from Client parent | Plain `<Link href>` | `FollowButton.tsx:65-73` (capture pattern) + `AddWatchCard.tsx` itself | role-match — D-10 decision |
| `src/components/profile/NotesTabContent.tsx` | Server Component (line 57 `<Link href="/watch/new"/>`) | href on `<Link>` | RESEARCH Pitfall 5 — D-10 option (b) skip returnTo, fall back to default | role-match |
| `src/components/search/WatchSearchRowsAccordion.tsx` | Client Component | router.push at line 104 | `FollowButton.tsx:65-73` (event-handler `window.location` capture) | exact (event handler pattern) |
| `src/components/watch/CatalogPageActions.tsx` | Client Component | router.push at line 107 | `FollowButton.tsx:65-73` (event-handler `window.location` capture) | exact |
| `src/components/home/WatchPickerDialog.tsx` | Client Component | `<Link href="/watch/new"/>` at line 144 | `FollowButton.tsx:65-73` | role-match |
| `src/components/watch/AddWatchFlow.tsx` (line 335 `manualAction`) | Internal self-nav | router.push within /watch/new | RESEARCH §"Entry-Point Audit row 10" — preserve `initialReturnTo` passthrough | role-match |

### NEW test files (planner decides co-located vs separate)

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/lib/hooks/useFormFeedback.test.tsx` (extend existing) | Test | success/error invariants | `src/lib/hooks/useFormFeedback.test.tsx` (existing) | exact (extend existing test file) |
| `src/app/watch/new/page.test.ts` OR co-located returnTo whitelist test | Test | searchParams → validation outcome | RESEARCH Pattern 2 (whitelist shape) + auth-callback regex tests if any | role-match — NEW test file |
| `src/lib/verdict/composer.test.ts` (extend existing) | Test | composer output invariants | `src/lib/verdict/composer.test.ts:200-298` (existing) | exact (extend existing) |
| `src/components/watch/WishlistRationalePanel.test.tsx` (NEW or extend) | Test | verdict prop → textarea value | None in tree — model after RTL conventions used by `useFormFeedback.test.tsx` | NEW — modeled after `useFormFeedback.test.tsx` |

### Files NOT modified (read-only references)

- `src/components/ui/ThemedToaster.tsx` — Sonner mount stays as-is (D-03 inherits theme).
- `src/components/ui/FormStatusBanner.tsx` — D-07 explicitly forbids edit.
- `src/lib/similarity.ts:340-379` (`getSimilarityDisplay`) — divergence audit is planner-discretion (CONTEXT `<deferred>`); no edit mandated.
- `src/components/insights/CollectionFitCard.tsx` — reads `contextualPhrasings`; new `rationalePhrasings` is consumed only by `WishlistRationalePanel`.
- `src/components/watch/VerdictStep.tsx` — wraps `<CollectionFitCard>`; no read-side change.
- `src/components/layout/SlimTopNav.tsx` — verified per RESEARCH: NO add-watch link exists in this surface.
- `src/components/layout/BottomNav.tsx` — verified per RESEARCH: BottomNav has no Add slot in v4.0+ (Phase 18 dropped it). CONTEXT D-09 lists BottomNav as a candidate but the slot is gone — surface to user as a CONTEXT discrepancy. **No edit needed.**

---

## Pattern Assignments

### `src/lib/hooks/useFormFeedback.ts` (Hook, side-effect — D-04)

**Analog:** self (in-file additive extension). The hook already wires `useTransition`, `toast.success`/`toast.error`, and a banner-state setter; D-04 only adds an optional `successAction?: { label, href }` to the `run()` opts and an internal `useRouter()` to wire the onClick.

**Existing imports + opts shape** (lines 1-58, with NEW lines marked):
```typescript
'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
// NEW (D-04):
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/lib/actionTypes'

// ...

export interface UseFormFeedbackReturn<T> {
  pending: boolean
  state: 'idle' | 'pending' | 'success' | 'error'
  message: string | null
  dialogMode: boolean
  run: (
    action: () => Promise<ActionResult<T>>,
    opts?: {
      successMessage?: string
      errorMessage?: string
      // NEW (D-04 — declarative; hook owns the router.push):
      successAction?: { label: string; href: string }
    },
  ) => Promise<void>
  reset: () => void
}
```

**Existing `toast.success` callsite** (line 141-155 — the only edit point inside the hook body):
```typescript
if (result.success) {
  const msg = opts?.successMessage ?? 'Saved'
  startTransition(() => {
    setState('success')
    setMessage(msg)
  })
  toast.success(msg)              // ← edit this line per D-03 + D-04
  // Schedule the 5s auto-dismiss (D-16). Errors do NOT get this — they
  // persist until the next run() call.
  timeoutRef.current = setTimeout(() => {
    timeoutRef.current = null
    if (!mountedRef.current) return
    setState('idle')
    setMessage(null)
  }, SUCCESS_AUTO_DISMISS_MS)
}
```

**Phase 28 replacement** (mirror RESEARCH §"Pattern 3" + UI-SPEC §"Toast emission shape"):
```typescript
const router = useRouter()  // ADD at top of hook body (around line 67)
// ...
if (result.success) {
  const msg = opts?.successMessage ?? 'Saved'
  // ...
  // NEW: forward declarative action; hook owns router.push (D-04).
  const sonnerOpts = opts?.successAction
    ? {
        action: {
          label: opts.successAction.label,
          onClick: () => router.push(opts.successAction!.href),
        },
      }
    : undefined
  toast.success(msg, sonnerOpts)
  // ...
}
```

Add `router` to the `useCallback` deps (currently `[reset]` at line 166 → becomes `[reset, router]`).

**Suppress-toast carve-out** (UI-SPEC §"useFormFeedback (extended)" + D-05 — caller-side, not hook-side): when both `successMessage` and `successAction` are `undefined`, the hook should short-circuit and emit NO toast. Add this guard at the top of the success branch:
```typescript
if (result.success) {
  const msg = opts?.successMessage
  const sonnerOpts = opts?.successAction
    ? { action: { label: opts.successAction.label, onClick: () => router.push(opts.successAction!.href) } }
    : undefined

  if (msg !== undefined) {
    // existing setState + toast.success(msg, sonnerOpts) + 5s timer
  }
  // else: caller suppresses (D-05 — destination matches post-commit landing)
}
```

**Test contract** (extending `src/lib/hooks/useFormFeedback.test.tsx`):
- Existing Test 7 (line 107-115): `toast.success` called with `'Saved'` — STILL PASSES (no `successAction` provided).
- Existing Test 8 (line 118-125): `successMessage: 'Profile updated'` — STILL PASSES.
- NEW: `successAction: { label: 'View', href: '/u/x/wishlist' }` provided → `toast.success` called with `(msg, { action: { label: 'View', onClick: <fn> } })`. Asserting the function shape (typeof onClick === 'function') is sufficient; can also fire it and assert `router.push` was called with the href via a mocked `useRouter`.
- NEW: omitting `successAction` → second arg to `toast.success` is `undefined` (byte-identical to today).
- NEW: `successMessage === undefined` AND `successAction === undefined` → `toast.success` is NOT called.

---

### `src/app/watch/new/page.tsx` (Server Component, validate-and-pass)

**Analog:** self (lines 50-70). The new `returnTo` validation slots into the same Promise-await + literal-or-regex whitelist shape used today.

**Existing whitelist pattern** (lines 50-70 — copy verbatim shape):
```typescript
const sp = await searchParams

// Whitelist intent (Security T-20.1-04-01): only literal 'owned' is allowed.
const initialIntent: 'owned' | null = sp.intent === 'owned' ? 'owned' : null

// Phase 25 T-25-05-01 mitigation: literal-match whitelist for `manual` and
// `status`. Both flow into AddWatchFlow as local FlowState only — NEVER used
// to construct a URL. Defense-in-depth: server whitelist + client typing both
// reject anything else.
const initialManual: boolean = sp.manual === '1'
const initialStatus: 'wishlist' | null = sp.status === 'wishlist' ? 'wishlist' : null

// Validate catalogId is a UUID-shaped string before fetching (defense-in-depth
// for T-20.1-04-02 — getCatalogById uses Drizzle parameterized queries so SQL
// injection is not viable, but the regex prevents arbitrary strings from
// hitting the DAL at all).
const catalogId =
  typeof sp.catalogId === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sp.catalogId)
    ? sp.catalogId
    : null
```

**Existing searchParams type** (line 28-36 — extend with `returnTo?: string`):
```typescript
interface NewWatchPageProps {
  searchParams: Promise<{
    catalogId?: string
    intent?: string
    manual?: string
    status?: string
    // NEW (D-11):
    returnTo?: string
  }>
}
```

**Auth-callback regex source** (verbatim from `src/app/auth/callback/route.ts:49-61` — copy regex AND prose comment):
```typescript
// Same-origin guard — Open-redirect protection (Pitfall 8 / T-22-S6).
//
// Tightened from the prior `startsWith('/') && !startsWith('//')` check to
// also reject backslash and CRLF/tab control chars. URL decoding by
// `searchParams.get` means a `next=%0d%0aSet-Cookie:...` value would, after
// decode, contain raw `\r\n`. Node's HTTP layer already rejects header
// values with control chars at runtime, but explicit validation up-front is
// defense-in-depth and clearer than relying on the throw.
//
// Allowed shape: starts with `/`, second char is NOT `/` (rejects
// `//evil.com`), and the remainder contains no backslash or control chars.
const safeNext =
  next && /^\/(?!\/)[^\\\r\n\t]*$/.test(next) ? next : null
```

**Phase 28 addition (drop in after line 70)**:
```typescript
// NEW: D-11 two-stage validation. Mirror the auth/callback regex (verified
// at src/app/auth/callback/route.ts:60-61). Required shape: starts with `/`,
// second char is NOT `/` (rejects //evil.com), and the remainder contains
// no backslash or control chars. Plus a self-loop guard against
// ?returnTo=/watch/new?... infinite-trap vectors.
const RETURN_TO_REGEX = /^\/(?!\/)[^\\\r\n\t]*$/
const initialReturnTo: string | null = (() => {
  if (typeof sp.returnTo !== 'string') return null
  if (!RETURN_TO_REGEX.test(sp.returnTo)) return null
  if (sp.returnTo.startsWith('/watch/new')) return null  // self-loop guard
  return sp.returnTo
})()
```

**Username resolution** (RESEARCH §"Username resolution at /watch/new"):
```typescript
import { getProfileById } from '@/data/profiles'  // ADD import

// After getCurrentUser() and the searchParams whitelist:
const viewerProfile = await getProfileById(user.id)
const viewerUsername = viewerProfile?.username ?? null
// At v4.0+ every authenticated user has a username via the signup trigger,
// so null is a soft alarm — fall back to no-toast behavior at the call site.
```

`getProfileById` shape (from `src/data/profiles.ts:48-55`):
```typescript
export async function getProfileById(userId: string) {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1)
  return rows[0] ?? null
}
```

**Render delta** (`<AddWatchFlow .../>` at lines 82-89 — add 2 props):
```tsx
<AddWatchFlow
  collectionRevision={collection.length}
  initialCatalogId={catalogId}
  initialIntent={initialIntent}
  initialCatalogPrefill={catalogPrefill}
  initialManual={initialManual}
  initialStatus={initialStatus}
  initialReturnTo={initialReturnTo}    // NEW
  viewerUsername={viewerUsername}      // NEW
/>
```

**Test target (NEW):** A small Server-Component-style test (or even a unit test on the validation function refactored to a pure helper) that asserts:
- `?returnTo=/search?q=tudor` → kept verbatim
- `?returnTo=//evil.com` → null (regex rejects)
- `?returnTo=/watch/new?returnTo=...` → null (self-loop guard)
- `?returnTo=/path%0d%0aHeader` → null (CRLF after decode)
- `?returnTo=` (empty) → null
- `?returnTo` not provided → null

Best implemented by extracting the validator to a tiny pure helper inside the same file or a sibling util — easier to unit-test than the full Server Component.

---

### `src/components/watch/AddWatchFlow.tsx` (Client orchestrator — D-12, D-14, D-15)

**Analog:** self (in-file rewrite). The Wishlist commit handler at lines 266-298 is the primary edit site; the `initialX` props pattern at lines 46-63 is the prop-shape extension model.

**Existing props shape** (lines 46-63 — append two fields):
```typescript
interface AddWatchFlowProps {
  collectionRevision: number
  initialCatalogId: string | null
  initialIntent: 'owned' | null
  initialCatalogPrefill: ExtractedWatchData | null
  initialManual: boolean
  initialStatus: 'wishlist' | null
  // NEW (D-12 + D-02/D-13):
  initialReturnTo: string | null
  viewerUsername: string | null
}
```

Match the destructure shape too (lines 67-74):
```typescript
export function AddWatchFlow({
  collectionRevision,
  initialCatalogId,
  initialIntent,
  initialCatalogPrefill,
  initialManual,
  initialStatus,
  initialReturnTo,    // NEW
  viewerUsername,     // NEW
}: AddWatchFlowProps) {
```

**Existing Wishlist commit handler** (lines 266-298 — current code):
```typescript
const handleWishlistConfirm = (notes: string) => {
  if (state.kind !== 'wishlist-rationale-open') return
  const captured = state
  setState({
    kind: 'submitting-wishlist',
    catalogId: captured.catalogId,
    extracted: captured.extracted,
    verdict: captured.verdict,
    notes,
  })
  startTransition(async () => {
    // Pitfall 5: notes is verbatim — '' if user blanked.
    // Pitfall 6: NEVER pass photoSourcePath from URL-extract surface.
    const payload = buildAddWatchPayload(captured.extracted, 'wishlist', notes)
    const result = await addWatch(payload)
    if (result.success) {
      toast.success('Added to wishlist')
      // Pitfall 3: refresh so collectionRevision bumps and verdict cache drops.
      router.refresh()
      setUrl('')
      setState({ kind: 'idle' })
    } else {
      toast.error(result.error)
      // Roll back to wishlist-rationale-open so user can retry.
      setState({
        kind: 'wishlist-rationale-open',
        catalogId: captured.catalogId,
        extracted: captured.extracted,
        verdict: captured.verdict,
      })
    }
  })
}
```

**Phase 28 rewrite** (replaces lines 281-286 — RESEARCH §"Example 3"):
```typescript
if (result.success) {
  // D-13 default + D-14 returnTo: where to go on commit.
  const dest = initialReturnTo ?? defaultDestinationForStatus('wishlist', viewerUsername)
  const actionHref = viewerUsername ? `/u/${viewerUsername}/wishlist` : null  // D-02
  const suppress =
    actionHref !== null &&
    canonicalize(dest, viewerUsername) === canonicalize(actionHref, viewerUsername)

  if (suppress || actionHref === null) {
    // D-05: post-commit page = destination tab; no toast, no CTA.
    // (Also no toast when viewerUsername unresolved — soft fallback.)
  } else {
    toast.success('Added to your wishlist', {
      action: { label: 'View', onClick: () => router.push(actionHref) },  // D-03 + D-01
    })
  }
  // D-15: REMOVED router.refresh() — destination page Server Component
  // re-fetches getWatchesByUser naturally; no double-fetch needed.
  router.push(dest)
  // setUrl + setState({kind:'idle'}) intentionally NOT called — mid-nav unmount handles cleanup.
}
```

The error branch (lines 287-296) stays identical.

**Helper functions** (NEW — add to bottom of file alongside `extractedToPartialWatch`):
```typescript
/** D-13 status→tab mapping. */
function defaultDestinationForStatus(status: WatchStatus, username: string | null): string {
  if (!username) return '/'  // soft fallback — should not happen at v4.0+
  const tab = (status === 'wishlist' || status === 'grail') ? 'wishlist' : 'collection'
  return `/u/${username}/${tab}`
}

/** D-06 canonicalization: resolve `/u/me/...` shorthand; strip query + trailing slash. */
function canonicalize(path: string, viewerUsername: string | null): string {
  if (!viewerUsername) return path  // can't canonicalize without username
  let p = path.startsWith('/u/me/')
    ? `/u/${viewerUsername}/` + path.slice('/u/me/'.length)
    : path
  const queryStart = p.indexOf('?')
  if (queryStart >= 0) p = p.slice(0, queryStart)
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}
```

**`/u/me/...` shorthand source** (`src/components/home/WishlistGapCard.tsx:24` — verbatim context for D-06):
```tsx
<Link
  href={`/u/me/wishlist?filter=${gap.role}`}
  aria-label={`Wishlist gap: ${gap.role}`}
  ...
>
```
This is why canonicalization must rewrite `/u/me/...` → `/u/{viewerUsername}/...` before comparison.

**Manual-self-nav line 335** (RESEARCH Entry-Point row 10):
```typescript
const manualAction = useCallback(() => {
  // Phase 28: preserve initialReturnTo through the manual-entry restart so
  // the user doesn't lose their entry-point context after re-pasting.
  const qs = initialReturnTo
    ? `?manual=1&returnTo=${encodeURIComponent(initialReturnTo)}`
    : '?manual=1'
  router.push(`/watch/new${qs}`)
}, [router, initialReturnTo])
```

**WatchForm prop-thread** (Form-prefill render at line 419-425, manual-entry render at line 446-454 — both pass `returnTo` + `viewerUsername` so WatchForm can resolve dest at submit):
```tsx
<WatchForm
  mode="create"
  lockedStatus="owned"
  watch={extractedToPartialWatch(state.extracted, 'owned')}
  returnTo={initialReturnTo}            // NEW
  viewerUsername={viewerUsername}       // NEW
/>
```

---

### `src/components/watch/WatchForm.tsx` (Client form — D-13, D-14)

**Analog:** self (line 209). The single `router.push('/')` is the replacement site.

**Existing submit handler** (lines 141-213 — focused excerpt around line 209):
```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault()
  if (!validate()) return

  const successMessage =
    mode === 'edit'
      ? 'Watch updated'
      : 'Watch added'

  run(async () => {
    // ... photo upload + submitData build ...
    const result =
      mode === 'edit' && watch
        ? await editWatch(watch.id, formData)
        : await addWatch(submitData)

    if (result.success) {
      // router.push fires before run() resolves; the hook's setState happens
      // on the next tick + Sonner's portal-mounted toast persists across the
      // navigation, so the user sees `successMessage` after landing on `/`.
      // The form unmounts mid-nav, so the inline FormStatusBanner does NOT
      // render post-nav — toast is the canonical post-add affordance here.
      router.push('/')             // ← REPLACE PER D-13
    }
    return result
  }, { successMessage })
}
```

**Existing props shape** (lines 33-45 — extend):
```typescript
interface WatchFormProps {
  watch?: Watch
  mode: 'create' | 'edit'
  lockedStatus?: WatchStatus
  defaultStatus?: WatchStatus
  // NEW (Phase 28 D-13/D-14):
  returnTo?: string | null
  viewerUsername?: string | null
}
```

**Phase 28 replacement** (replaces line 209 + adjusts the `run()` call to pass `successAction`):
```typescript
run(async () => {
  // ... photo upload + submitData build (unchanged) ...
  const result =
    mode === 'edit' && watch
      ? await editWatch(watch.id, formData)
      : await addWatch(submitData)

  if (result.success && mode === 'create') {
    // D-13/D-14: resolve destination based on returnTo prop + status→tab mapping.
    const finalStatus: WatchStatus = lockedStatus ?? formData.status
    const tab = (finalStatus === 'wishlist' || finalStatus === 'grail') ? 'wishlist' : 'collection'
    const dest = returnTo ?? (viewerUsername ? `/u/${viewerUsername}/${tab}` : '/')
    router.push(dest)
  } else if (result.success) {
    // mode === 'edit' — preserve existing redirect-to-home? Or back?
    // Per D-13 the new behavior applies to mode='create' (Add-Watch flow).
    // Edit-mode redirect is not in Phase 28 scope — keep router.push('/') OR
    // router.back() per planner choice. Recommend: router.back() since edit
    // mode is invoked from /watch/[id]/edit and "back" is the user's intent.
    router.push('/')
  }
  return result
}, {
  successMessage,
  // D-05 suppress carve-out: when destination matches the action href, omit
  // successAction AND let the hook's short-circuit suppress the toast entirely.
  // Caller computes the comparison up-front:
  // (See AddWatchFlow's helper functions for canonicalize() — extract to shared util OR duplicate.)
  ...(shouldFireToast(/* see below */) && {
    successAction: { label: 'View', href: actionHref },
  }),
})
```

The exact dest/actionHref/suppress resolution belongs alongside the planner's decision on whether to share canonicalize/defaultDestinationForStatus across AddWatchFlow + WatchForm (recommend extracting to `src/lib/watchFlow/destinations.ts` — small pure module).

**Toast body literal:** `'Added to your collection'` for `'owned'`/`'sold'`; `'Saved to your wishlist'` for `'wishlist'`/`'grail'` (UI-SPEC §"Locked literals"). The current `successMessage` constant (`'Watch added'`/`'Watch updated'`) needs a parallel branch since the new toasts are status-dependent.

---

### `src/components/watch/WishlistRationalePanel.tsx` (Client — D-20)

**Analog:** self (lines 42-46 + line 84-86). One-line source switch + one-line hint copy update.

**Existing `defaultRationale`** (lines 42-46):
```typescript
function defaultRationale(verdict: VerdictBundle | null): string {
  if (!verdict) return ''
  if (verdict.framing === 'self-via-cross-user') return ''
  return verdict.contextualPhrasings[0] ?? ''
}
```

**Phase 28 rewrite** (replaces line 45):
```typescript
function defaultRationale(verdict: VerdictBundle | null): string {
  if (!verdict) return ''
  if (verdict.framing === 'self-via-cross-user') return ''
  return verdict.rationalePhrasings[0] ?? ''  // CHANGED from contextualPhrasings[0]
}
```

The `framing === 'self-via-cross-user'` branch stays untouched — `VerdictBundleSelfOwned` has neither `contextualPhrasings` nor `rationalePhrasings`, so the early return is the only correct branch for that framing.

**Existing hint paragraph** (line 84-86):
```tsx
<p id="wishlist-notes-hint" className="text-xs text-muted-foreground">
  Pre-filled from the fit verdict. Edit or clear as you like.
</p>
```

**Phase 28 rewrite** (UI-SPEC §"Locked literals" — `Pre-filled with why this watch fits — written as if you wrote it. Edit to make it yours, or clear it.`):
```tsx
<p id="wishlist-notes-hint" className="text-xs text-muted-foreground">
  Pre-filled with why this watch fits — written as if you wrote it. Edit to make it yours, or clear it.
</p>
```

`aria-describedby="wishlist-notes-hint"` on the `<Textarea>` (line 82) is unchanged.

**Test target (NEW or extend):**
- Verdict with `rationalePhrasings: ['I want this for X']` → textarea value = `'I want this for X'`.
- Verdict with `rationalePhrasings: []` → textarea value = `''`.
- Verdict with `framing: 'self-via-cross-user'` → textarea value = `''` regardless of rationalePhrasings content (early-return branch lock).
- Verdict `null` → textarea value = `''` (Pitfall 6 from RESEARCH).
- Existing assertions (if any) on `contextualPhrasings`-driven pre-fill must be migrated to `rationalePhrasings`.

---

### `src/lib/verdict/templates.ts` (Library, types-only — D-16, D-17, D-18)

**Analog:** self. The 12 TEMPLATES entries (lines 14-119) get a `rationaleTemplate` field; the 6 DESCRIPTION_FOR_LABEL strings (lines 130-137) are rewritten; a new `RATIONALE_FOR_LABEL` constant is added.

**Existing TEMPLATES entry shape (1 of 12)** — line 16-25:
```typescript
{
  id: 'fills-a-hole',
  predicate: (result, profile, _candidate, taste) => {
    if (result.label !== 'taste-expansion' && result.label !== 'outlier') return null
    if (!taste.primaryArchetype) return null
    if (profile.dominantArchetype === taste.primaryArchetype) return null
    return { archetype: taste.primaryArchetype }
  },
  template: 'Fills a hole in your collection — your first ${archetype}.',
},
```

**Phase 28 shape (D-17 — additive `rationaleTemplate`):**
```typescript
{
  id: 'fills-a-hole',
  predicate: (result, profile, _candidate, taste) => {
    if (result.label !== 'taste-expansion' && result.label !== 'outlier') return null
    if (!taste.primaryArchetype) return null
    if (profile.dominantArchetype === taste.primaryArchetype) return null
    return { archetype: taste.primaryArchetype }
  },
  template: 'Fills a hole in your collection — your first ${archetype}.',  // UNCHANGED
  rationaleTemplate: 'My first ${archetype} — fills a real hole in what I own.',  // NEW (UI-SPEC candidate)
},
```

UI-SPEC §"Voice rules — rationaleTemplate" candidates for the 4 roadmap-locked templates:

| Template id | `template` (UNCHANGED) | `rationaleTemplate` candidate |
|-------------|------------------------|-------------------------------|
| `fills-a-hole` | `Fills a hole in your collection — your first ${archetype}.` | `My first ${archetype} — fills a real hole in what I own.` |
| `aligns-with-heritage` | `Aligns with your heritage-driven taste.` | `Heritage-driven, like the rest of what I'm drawn to.` |
| `collection-skews-contrast` | `Your collection skews ${dominant} — this is a ${contrast}.` | `My collection leans ${dominant}; this gives me a ${contrast} to balance it.` |
| `overlaps-with-specific` | `Overlaps strongly with your ${specific}.` | `Plays in the same space as my ${specific}.` |

The other 8 supporting TEMPLATES (`first-watch`, `core-fit-confirmed`, `role-duplicate-warning`, `archetype-echo`, `era-echo`, `formality-aligned`, `sportiness-contrast`, `hard-mismatch-stated`) — planner drafts in PLAN.md per D-21 voice rules.

**Existing DESCRIPTION_FOR_LABEL** (lines 130-137):
```typescript
export const DESCRIPTION_FOR_LABEL: Record<SimilarityLabel, string> = {
  'core-fit': 'Highly aligned with your taste',
  'familiar-territory': 'Similar to what you like',
  'role-duplicate': 'May compete for wrist time',
  'taste-expansion': 'New but still aligned',
  'outlier': 'Unusual for your collection',
  'hard-mismatch': 'Conflicts with stated dislikes',
}
```

**Phase 28 rewrite (D-16 — UI-SPEC §"Voice rules — DESCRIPTION_FOR_LABEL" candidates):**
```typescript
export const DESCRIPTION_FOR_LABEL: Record<SimilarityLabel, string> = {
  'core-fit': 'Lines up cleanly with what you already like.',
  'familiar-territory': "Sits in territory you've already explored.",
  'role-duplicate': "Plays a role you've already filled in your collection.",
  'taste-expansion': "Stretches your taste in a direction it's already leaning.",
  'outlier': "Stands apart from your collection but doesn't conflict.",
  'hard-mismatch': 'Conflicts with styles you said you avoid.',
}
```

**Phase 28 NEW constant (D-18) — mirror DESCRIPTION_FOR_LABEL shape:**
```typescript
export const RATIONALE_FOR_LABEL: Record<SimilarityLabel, string> = {
  'core-fit': '...',           // 1st-person; planner drafts per D-21
  'familiar-territory': '...',
  'role-duplicate': '...',
  'taste-expansion': '...',
  'outlier': '...',
  'hard-mismatch': '...',
}
```

---

### `src/lib/verdict/types.ts` (Type Definition — D-19)

**Analog:** self. Two additive fields.

**Existing `VerdictBundleFull`** (lines 22-31):
```typescript
export interface VerdictBundleFull {
  framing: 'same-user' | 'cross-user'
  label: SimilarityLabel
  headlinePhrasing: string
  contextualPhrasings: string[]
  mostSimilar: VerdictMostSimilar[]
  roleOverlap: boolean
}
```

**Phase 28 extension (D-19 — additive):**
```typescript
export interface VerdictBundleFull {
  framing: 'same-user' | 'cross-user'
  label: SimilarityLabel
  headlinePhrasing: string
  contextualPhrasings: string[]
  /** Phase 28 D-19 — 1st-person rationale-voice strings, lockstep with contextualPhrasings.
   *  rationalePhrasings.length === contextualPhrasings.length and
   *  rationalePhrasings[i] is the rationale-voice version of contextualPhrasings[i]. */
  rationalePhrasings: string[]
  mostSimilar: VerdictMostSimilar[]
  roleOverlap: boolean
}
```

**Existing `Template`** (lines 74-83):
```typescript
export interface Template {
  id: string
  predicate: (
    result: import('@/lib/types').SimilarityResult,
    profile: ViewerTasteProfile,
    candidate: Watch,
    candidateTaste: CandidateTasteSnapshot,
  ) => Record<string, string> | null
  template: string
}
```

**Phase 28 extension (D-17 — additive):**
```typescript
export interface Template {
  id: string
  predicate: (
    result: import('@/lib/types').SimilarityResult,
    profile: ViewerTasteProfile,
    candidate: Watch,
    candidateTaste: CandidateTasteSnapshot,
  ) => Record<string, string> | null
  template: string
  /** Phase 28 D-17 — 1st-person rationale-voice template; same `${slot}` grammar as `template`. */
  rationaleTemplate: string
}
```

---

### `src/lib/verdict/composer.ts` (Library — D-19, D-22)

**Analog:** self (lines 58-72 — the lockstep loop point + fallback branch).

**Existing imports** (lines 10-14):
```typescript
import {
  TEMPLATES,
  HEADLINE_FOR_LABEL,
  DESCRIPTION_FOR_LABEL,
} from '@/lib/verdict/templates'
```

**Phase 28 import addition:**
```typescript
import {
  TEMPLATES,
  HEADLINE_FOR_LABEL,
  DESCRIPTION_FOR_LABEL,
  RATIONALE_FOR_LABEL,  // NEW
} from '@/lib/verdict/templates'
```

**Existing template loop + fallback** (lines 58-72 — current code):
```typescript
let contextualPhrasings: string[]
if (isFallback) {
  contextualPhrasings = [DESCRIPTION_FOR_LABEL[result.label]]
} else {
  const phrasings: string[] = []
  for (const t of TEMPLATES) {
    const slots = t.predicate(result, profile, candidate, candidateTaste)
    if (!slots) continue
    let copy = fillTemplate(t.template, slots)
    if (isHedged) copy = applyHedge(copy)
    phrasings.push(copy)
  }
  contextualPhrasings =
    phrasings.length > 0 ? phrasings : [DESCRIPTION_FOR_LABEL[result.label]]
}
```

**Phase 28 rewrite (D-19 — RESEARCH §"Pattern 5"):**
```typescript
let contextualPhrasings: string[]
let rationalePhrasings: string[]   // NEW
if (isFallback) {
  contextualPhrasings = [DESCRIPTION_FOR_LABEL[result.label]]
  rationalePhrasings = [RATIONALE_FOR_LABEL[result.label]]   // NEW
} else {
  const phrasings: string[] = []
  const rationales: string[] = []   // NEW — lockstep
  for (const t of TEMPLATES) {
    const slots = t.predicate(result, profile, candidate, candidateTaste)
    if (!slots) continue
    let copy = fillTemplate(t.template, slots)
    let rationale = fillTemplate(t.rationaleTemplate, slots)   // NEW
    if (isHedged) {
      copy = applyHedge(copy)
      rationale = applyHedge(rationale)   // NEW — same hedge prefix
    }
    phrasings.push(copy)
    rationales.push(rationale)   // NEW
  }
  contextualPhrasings =
    phrasings.length > 0 ? phrasings : [DESCRIPTION_FOR_LABEL[result.label]]
  rationalePhrasings =
    rationales.length > 0 ? rationales : [RATIONALE_FOR_LABEL[result.label]]   // NEW
}
```

**Existing return** (lines 74-84):
```typescript
return {
  framing,
  label: result.label,
  headlinePhrasing: HEADLINE_FOR_LABEL[result.label],
  contextualPhrasings,
  mostSimilar: result.mostSimilarWatches.map(({ watch, score }) => ({
    watch,
    score,
  })),
  roleOverlap: result.roleOverlap,
}
```

**Phase 28 return:**
```typescript
return {
  framing,
  label: result.label,
  headlinePhrasing: HEADLINE_FOR_LABEL[result.label],
  contextualPhrasings,
  rationalePhrasings,  // NEW
  mostSimilar: result.mostSimilarWatches.map(({ watch, score }) => ({
    watch,
    score,
  })),
  roleOverlap: result.roleOverlap,
}
```

**FIT-02 lock preservation (D-22):** the existing test at `composer.test.ts:215-227` asserts:
```typescript
expect(out.contextualPhrasings).toEqual([DESCRIPTION_FOR_LABEL['core-fit']])
expect(out.contextualPhrasings).toEqual(['Highly aligned with your taste'])  // ← becomes stale literal
```

Per RESEARCH Pitfall 4: the second assertion locks the literal `'Highly aligned with your taste'`, which D-16 rewrites. **Recommended:** delete line 226 (literal lock) and keep line 225 (by-reference lock against `DESCRIPTION_FOR_LABEL['core-fit']`). The other 4 roadmap-template tests (in earlier sections of `composer.test.ts`) lock by-reference on `template` strings, which are UNCHANGED in Phase 28.

**New tests to add (D-22):**
- `rationalePhrasings.length === contextualPhrasings.length` for every fixture (lockstep invariant — Pitfall 3).
- `rationalePhrasings` falls back to `[RATIONALE_FOR_LABEL[label]]` when no template fires (mirror existing `'returns at least one phrasing'` test at line 251-275).
- Hedge prefix applied to `rationalePhrasings` when 0.5 ≤ confidence < 0.7 (mirror existing test at line 229-249).
- `rationalePhrasings` falls back to `[RATIONALE_FOR_LABEL[label]]` when confidence < 0.5 (mirror existing test at line 215-227 — but using by-reference, not literal).

---

### Entry-point callsites — `?returnTo=` capture (D-08, D-09, D-10)

For all 9 callsites, the analog is the same: **`FollowButton.tsx:65-73` `?next=` capture pattern**.

**Canonical analog** — `src/components/profile/FollowButton.tsx:65-73`:
```typescript
function handleClick() {
  // Unauth: bounce to sign-in preserving the current profile as next-param.
  // `/login` route verified at src/app/login/page.tsx. The `next` value is
  // always a same-origin pathname (window.location.pathname) — absolute URLs
  // are not produced by this component (T-09-10).
  if (viewerId === null) {
    const next = encodeURIComponent(window.location.pathname)
    router.push(`/login?next=${next}`)
    return
  }
  // ...
}
```

**Phase 28 adaptation — Pattern A (event-handler / router.push callsites):**
```typescript
const handleAddToCollection = (r: SearchCatalogWatchResult) => {
  // Phase 28 D-08: capture entry pathname+search at click time so commit can
  // route the user back here. Mirrors FollowButton.tsx:71 `?next=` shape.
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
  router.push(`/watch/new?catalogId=${encodeURIComponent(r.catalogId)}&intent=owned&returnTo=${returnTo}`)
}
```

**Phase 28 adaptation — Pattern B (`<Link>` href in Client Component):** read `usePathname()` (and optionally `useSearchParams()`) at the top of the component, build the href in render:
```typescript
import { usePathname, useSearchParams } from 'next/navigation'

const pathname = usePathname() ?? '/'
const sp = useSearchParams()
const search = sp?.toString() ?? ''
const returnTo = encodeURIComponent(pathname + (search ? `?${search}` : ''))
const href = `/watch/new?manual=1&returnTo=${returnTo}`

// in JSX:
<Link href={href}>...</Link>
```

**Phase 28 adaptation — Pattern C (Server Component, D-10 option (a)):** wrap the `<Link>` in a tiny Client Component child (`AddWatchLinkClient.tsx`) that reads `usePathname()`. OR — Pattern D — accept `returnTo` as a prop from a Client parent that has `usePathname` access.

**Per-callsite treatment:**

| # | File:line | Current shape | Treatment | Pattern |
|---|-----------|---------------|-----------|---------|
| 1 | `src/components/layout/DesktopTopNav.tsx:98` | `<Link href="/watch/new" aria-label="Add watch">` (already `'use client'`, has `usePathname` at line 49) | Append `?returnTo=...` from `usePathname` | B |
| 2 | `src/components/profile/CollectionTabContent.tsx:111` | `<Button render={<Link href="/watch/new?manual=1" />}>` (already `'use client'`) | Append `&returnTo=` from `usePathname` | B |
| 3 | `src/components/profile/WishlistTabContent.tsx:61` | `<Button render={<Link href="/watch/new?status=wishlist" />}>` (already `'use client'`) | Append `&returnTo=` from `usePathname` | B |
| 4 | `src/components/profile/AddWatchCard.tsx:21` | `<Link href="/watch/new">` (Server Component) | D-10 option: pass `returnTo` prop from Client parents (`CollectionTabContent`, `WishlistTabContent`) — KEEP `AddWatchCard` as Server Component | D |
| 5 | `src/components/profile/NotesTabContent.tsx:57` | `<Button render={<Link href="/watch/new" />}>` (Server Component) | D-10 option (b): SKIP `?returnTo=` entirely; rely on D-13 default destination (the user's collection tab — sensible for "zero notes, adding first watch"). RESEARCH Pitfall 5 documents the rationale. | (skip) |
| 6 | `src/components/search/WatchSearchRowsAccordion.tsx:104` | `router.push('/watch/new?catalogId=...&intent=owned')` (event handler, `'use client'`) | Append `&returnTo=` from `window.location.pathname + window.location.search` | A |
| 7 | `src/components/watch/CatalogPageActions.tsx:107` | `router.push('/watch/new?catalogId=...&intent=owned')` (event handler, `'use client'`) | Append `&returnTo=` from `window.location.pathname` | A |
| 8 | `src/components/home/WatchPickerDialog.tsx:144` | `<Link href="/watch/new">` (already `'use client'`) | Append `?returnTo=` from `usePathname` | B |
| 9 | `src/components/watch/AddWatchFlow.tsx:335` (`manualAction`) | `router.push('/watch/new?manual=1')` (internal self-nav, `'use client'`) | Preserve `initialReturnTo` passthrough (RESEARCH row 10): `?manual=1&returnTo=${ENC(initialReturnTo)}` if set | A (special — uses prop, not window.location) |

**Existing search/catalog inline Wishlist commit handlers** also need the `successAction` toast, NOT just `?returnTo=`. The Wishlist commit on `/search` (line 92) and `/catalog` (line 93) currently fires `toast.success('Added to wishlist')` and `router.refresh()`. Phase 28 changes those to:

```typescript
// /search WatchSearchRowsAccordion handleAddToWishlist (line 73-101) edit:
if (result.success) {
  toast.success('Saved to your wishlist', {
    action: {
      label: 'View',
      onClick: () => router.push(`/u/${viewerUsername}/wishlist`),
    },
  })
  setOpenValues([])
  router.refresh()  // KEEP — this surface stays on /search; refresh updates the row's verdict cache
} else {
  toast.error(result.error)
}
```

`/catalog` `CatalogPageActions.handleWishlist` (line 66-103) gets the same edit. Both surfaces stay on their current page (D-05 row 5/6 — toast always fires here, no suppress).

**`viewerUsername` thread to /search and /catalog:** both surfaces currently do not have a viewer-username prop. The page Server Components for `/search` and `/catalog/[id]` already auth-load the viewer (`getCurrentUser`); they need to also call `getProfileById(user.id)` and thread `viewerUsername` down to `WatchSearchRowsAccordion` / `CatalogPageActions` as a new prop. Pattern matches RESEARCH §"Username resolution at /watch/new".

---

## Shared Patterns

### Authentication & viewer-username resolution

**Source:** `src/data/profiles.ts:48-55` (`getProfileById`) — combined with `getCurrentUser()` from `src/lib/auth.ts`.

**Apply to:** `/watch/new` page (D-13 default destination), `/search` page (Wishlist commit toast destination), `/catalog/[id]` page (Wishlist commit toast destination).

**Excerpt:**
```typescript
import { getCurrentUser } from '@/lib/auth'
import { getProfileById } from '@/data/profiles'

const user = await getCurrentUser()
const viewerProfile = await getProfileById(user.id)
const viewerUsername = viewerProfile?.username ?? null
```

### Open-redirect-safe path validation

**Source:** `src/app/auth/callback/route.ts:49-61` (regex + prose comment).

**Apply to:** `/watch/new` page returnTo whitelist.

**Excerpt:**
```typescript
// Allowed shape: starts with `/`, second char is NOT `/` (rejects
// `//evil.com`), and the remainder contains no backslash or control chars.
const RETURN_TO_REGEX = /^\/(?!\/)[^\\\r\n\t]*$/
```

### `?next=` / `?returnTo=` capture at click time

**Source:** `src/components/profile/FollowButton.tsx:65-73`.

**Apply to:** All 9 entry-point callsites (Pattern A or B per shape).

**Excerpt:**
```typescript
const next = encodeURIComponent(window.location.pathname)
router.push(`/login?next=${next}`)
```

For Phase 28: include search string when present —
```typescript
const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
```

### Sonner action-slot toast emission

**Source:** No existing `action:` callsite in the codebase (verified — `grep -rn "action:" src --include="*.tsx" | grep "toast"` returns nothing). Sonner's `Action` interface verified in `node_modules/sonner/dist/index.d.ts` (per RESEARCH §"Pattern 4").

**Closest existing analog (non-action):** `src/components/search/WatchSearchRowsAccordion.tsx:92` and `src/components/watch/CatalogPageActions.tsx:93` — both fire bare `toast.success('Added to wishlist')` today, which is the primary edit site.

**Apply to:** All 4 commit-fires of toasts in Phase 28 (AddWatchFlow Wishlist commit, WatchForm Collection commit, /search inline Wishlist, /catalog inline Wishlist).

**Excerpt (Phase 28 standard shape):**
```typescript
toast.success('Saved to your wishlist', {
  action: {
    label: 'View',
    onClick: () => router.push(`/u/${viewerUsername}/wishlist`),
  },
})
```

### Existing `useFormFeedback` callers — additive prop pattern

**Source:** 8 existing callers; representative examples:

`src/components/preferences/PreferencesClient.tsx:64` — single-line `run()`:
```typescript
run(() => savePreferences(patch), { successMessage: 'Preferences saved' })
```

`src/components/profile/ProfileEditForm.tsx:31-48` — `dialogMode: true`, async wrapper:
```typescript
const { pending, message, run } = useFormFeedback({ dialogMode: true })

function handleSave() {
  run(async () => {
    const result = await updateProfile({ ... })
    if (result.success) onDone()
    return result
  }, { successMessage: 'Profile updated' })
}
```

`src/components/watch/WatchForm.tsx:154-212` — full submit handler with photo upload:
```typescript
run(async () => {
  // ... photo upload + submitData ...
  const result = await addWatch(submitData)
  if (result.success) router.push('/')
  return result
}, { successMessage })
```

**Phase 28 additive shape (D-04 — every existing caller stays byte-identical; new `successAction` is OPTIONAL):**
```typescript
run(async () => { ... }, {
  successMessage: 'Saved to your wishlist',
  successAction: { label: 'View', href: `/u/${viewerUsername}/wishlist` },  // NEW (optional)
})
```

The 8 existing callers do NOT need to change.

### `/u/{username}/{tab}` destination resolution (D-02, D-13)

**Source:** `src/components/layout/BottomNav.tsx:110-112` shows the username→tab pattern (collection-as-default):
```typescript
const isProfile = pathname.startsWith(`/u/${username}`)
const profileHref = `/u/${username}/collection`
```

**Apply to:** AddWatchFlow `defaultDestinationForStatus` helper, WatchForm submit handler dest resolution, and the 4 commit-fire toast `successAction.href` values.

**Status→tab mapping (D-02 + D-13):**
- `'wishlist'` | `'grail'` → `/u/{username}/wishlist`
- `'owned'` | `'sold'` → `/u/{username}/collection`

### `/u/me/...` shorthand canonicalization (D-06)

**Source:** `src/components/home/WishlistGapCard.tsx:24` — the only place `/u/me/...` appears today:
```tsx
<Link href={`/u/me/wishlist?filter=${gap.role}`} aria-label={`Wishlist gap: ${gap.role}`}>
```

**Apply to:** AddWatchFlow `canonicalize` helper (used in suppress-toast comparison D-05/D-06).

**Algorithm (recommended):**
```typescript
function canonicalize(path: string, viewerUsername: string | null): string {
  if (!viewerUsername) return path
  let p = path.startsWith('/u/me/')
    ? `/u/${viewerUsername}/` + path.slice('/u/me/'.length)
    : path
  const queryStart = p.indexOf('?')
  if (queryStart >= 0) p = p.slice(0, queryStart)
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}
```

---

## No Analog Found

**None.** Every Phase 28 edit-target either:
1. Modifies an existing file in-place (`useFormFeedback.ts`, `templates.ts`, `composer.ts`, `types.ts`, `WatchForm.tsx`, `AddWatchFlow.tsx`, `WishlistRationalePanel.tsx`, `page.tsx`, all 9 entry-point callsites), OR
2. Mirrors an in-codebase analog verbatim (`FollowButton.tsx:65-73` for `?returnTo=` capture; `auth/callback/route.ts:60-61` for the regex; `BottomNav.tsx:110-112` for username→tab destination; `getProfileById` for username resolution).

The only "no in-codebase precedent" pattern is **Sonner's `action:` slot itself** — but the slot is a built-in feature of `sonner@2.0.7` (verified in `node_modules/sonner/dist/index.d.ts`); D-03 explicitly requires using it. So while the codebase has no example, the LIBRARY shape IS the spec.

---

## Metadata

**Analog search scope:**
- `src/lib/hooks/` — useFormFeedback + tests
- `src/app/watch/new/` — page Server Component
- `src/app/auth/callback/` — regex source
- `src/components/watch/` — AddWatchFlow, WatchForm, WishlistRationalePanel, CatalogPageActions
- `src/components/profile/` — FollowButton, AddWatchCard, CollectionTabContent, WishlistTabContent, NotesTabContent, ProfileEditForm
- `src/components/search/` — WatchSearchRowsAccordion
- `src/components/home/` — WishlistGapCard, WatchPickerDialog
- `src/components/layout/` — BottomNav, DesktopTopNav, SlimTopNav
- `src/components/notifications/` — MarkAllReadButton
- `src/components/preferences/` — PreferencesClient
- `src/lib/verdict/` — composer, templates, types, composer.test
- `src/data/` — profiles

**Files scanned:** 18 source files + 1 type-def package (sonner 2.0.7) + RESEARCH.md + CONTEXT.md + UI-SPEC.md.

**Pattern extraction date:** 2026-05-04

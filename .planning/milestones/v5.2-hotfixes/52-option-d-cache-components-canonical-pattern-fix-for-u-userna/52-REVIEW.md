---
phase: 52-option-d-cache-components-canonical-pattern-fix-for-u-userna
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/app/u/[username]/[tab]/page.tsx
  - src/app/u/[username]/layout.tsx
  - src/app/u/[username]/profile-chrome.tsx
  - src/app/u/[username]/profile-gate.tsx
  - src/app/u/[username]/loading.tsx
  - src/proxy.ts
  - tests/profile-route-51.test.ts
  - tests/app/profile-tab-insights.test.tsx
  - tests/app/profile-layout.test.tsx
  - tests/app/common-ground-fallback.test.tsx
  - tests/e2e/auth-setup.ts
  - tests/e2e/profile-tab-nav.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: addressed
disposition:
  fixed_inline: [WR-02, WR-03, WR-04, IN-02, IN-03]
  deferred: [WR-01, IN-01]
---

# Phase 52: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 12
**Status:** addressed (5 fixed inline; 2 deferred — see Disposition)

## Disposition (2026-05-21, post-review)

| Finding | Action | Notes |
|---------|--------|-------|
| WR-02 — Test 4 comment misrepresents the `unstable_instant` export | **Fixed** | Rewrote the test title + comment in `tests/profile-route-51.test.ts` to describe the value evolution (static → runtime → `false`) and that the test pins PRESENCE of the declaration, not an active validator gate. |
| WR-03 — stale `instant()` references in `page.tsx` + `layout.tsx` | **Fixed** | Updated both comment blocks to name the actual `tests/e2e/profile-tab-nav.test.ts` (reshaped away from `instant()`). |
| WR-04 — fragile e2e heading assertion | **Fixed** | `profile-tab-nav.test.ts` now asserts `getByRole('heading', { level: 1 })` (both initial-load and per-tab) instead of matching username text. |
| IN-02 — `page.tsx` D-52-11 block claims an active CI gate | **Fixed** | Rewrote the closing paragraph: the validator diagnosis is right in principle but the export is `false` (opt-out); there is NO build-time CI gate on this route. |
| IN-03 — double `storageState()` call | **Fixed** | `auth-setup.ts` consolidated to a single `storageState({ path })` call (writes + returns). |
| WR-01 — double `isFollowing` DB call per non-owner request | **Deferred** | Real perf nit (the Phase 51 WR-02 `initialIsFollowing` optimization is now unreachable because `ProfileChrome` can't pre-compute it without the resolved `profile.id`). Non-blocking; not a correctness issue. Tracked as a follow-up. |
| IN-01 — dev-only `console.log` in `proxy.ts` | **Deferred** | Pre-existing (satisfies a ROADMAP success criterion); out of this phase's scope. |

## Summary

Phase 52 implements the canonical Next 16 Cache Components pattern on
`/u/[username]/[tab]` — sync layout, async `ProfileChrome` inside
`<Suspense>`, async `ProfileTabContent` inside page-level `<Suspense>`,
and an `unstable_instant = false` opt-out after the recurrence-5
`prefetch: 'runtime'` prod failure. The structural invariants (D-52-CF-01
through D-52-CF-04, D-52-16) are correctly implemented.

No critical/security issues. Four warnings surface correctness concerns
that don't block prod but would bite the next developer touching these
files.

---

## Warnings

### WR-01: `isFollowing` called twice per request for non-owner authenticated viewers

**File:** `src/app/u/[username]/profile-chrome.tsx:66` and
`src/app/u/[username]/profile-gate.tsx:97-98`

**Issue:** `ProfileChrome` passes `viewerId` to `ProfileGate` but does
NOT pass `initialIsFollowing`. `ProfileGate` therefore always falls
through to its own `await isFollowing(viewerId, profile.id)` call (line
97-98) for any non-owner authenticated viewer who has not hit the private
profile short-circuit. Separately, `ProfileTabContent` in
`[tab]/page.tsx:187-189` also calls `await isFollowing(viewerId,
profile.id)` to drive its `LockedTabCard` branches. Two independent DB
round-trips per request for the same (viewerId, ownerId) pair.

The WR-02 optimization from Phase 51 (the optional `initialIsFollowing`
prop on `ProfileGate`, with the comment "the /u/[tab] page hoists this
fetch") is now unreachable from the layout path because `ProfileChrome`
never populates the prop. The optimization was designed for the old
architecture where page and layout communicated directly; the Phase 52
refactor broke the hoisting path without providing a replacement.

**Fix:** Two options:
1. Forward the page-computed `initialIsFollowing` to `ProfileGate` via
   the layout's `children` composition (complex; not recommended for this
   component shape).
2. Remove the redundant gate-level `isFollowing` call by always resolving
   it in `ProfileChrome` and passing it as a prop:

```tsx
// profile-chrome.tsx
export async function ProfileChrome({ paramsPromise, children }: Props) {
  const { username } = await paramsPromise
  let viewerId: string | null = null
  try {
    viewerId = (await getCurrentUser()).id
  } catch (err) {
    if (!(err instanceof UnauthorizedError)) throw err
  }
  return (
    <ProfileGate username={username} viewerId={viewerId}>
      {children}
    </ProfileGate>
  )
}
```

Actually the simplest fix — since React `cache()` memoization does NOT
apply across different Suspense tree branches in this architecture — is to
rely on the profile-gate's existing fallback and accept the two-DB-call
cost per non-owner request, but remove the misleading `initialIsFollowing`
opt-in comment from `ProfileGate` that implies hoisting is happening. If
the duplicate call is worth eliminating, move `isFollowing` into
`ProfileChrome` and pass it as a prop to `ProfileGate`.

---

### WR-02: Test 4 comment block in `profile-route-51.test.ts` misrepresents what the export does

**File:** `tests/profile-route-51.test.ts:113-129`

**Issue:** The comment inside Test 4 (`page exports unstable_instant for
build-time validator gate`) describes `unstable_instant` as the mechanism
by which "this page participates in instant navigation" and "cannot be
registered as an instant-navigation leaf in the router tree" without it.
But the actual export is `unstable_instant = false`, which is the
**opt-out** from instant-navigation validation — the exact opposite of
participation. The comment also references "Phase 52 D-52-DEV-01 ships
with an inline type annotation" which describes the `prefetch: 'runtime',
samples` form that was reverted by the recurrence-5 fix.

The test regex (`/export\s+const\s+unstable_instant\b/`) passes for both
`= false` and `= { prefetch: ... }`, so the assertion is structurally
correct — it just pins that the identifier is exported. But the comment
actively misleads a future reader about what the export value means and
why recurrence-5 happened.

**Fix:** Replace the comment with an accurate description:

```ts
// REQ-52-01: `unstable_instant = false` must be present as an explicit
// opt-out of instant-navigation validation. The value `false` prevents
// Next 16 from spawning the secondary `finalRuntimeServerPrerender` that
// `prefetch: 'runtime'` triggered (recurrence-5 root cause — see
// .planning/debug/resolved/profile-404-419-recurrence-5.md).
// This regex matches any value (`false`, `{ prefetch: ... }`, etc.) —
// the presence of the export is the assertion; the correct value is
// `false` per the recurrence-5 fix.
expect(/export\s+const\s+unstable_instant\b/.test(source)).toBe(true)
```

---

### WR-03: `page.tsx` comment block references `instant()` e2e test that no longer exists

**File:** `src/app/u/[username]/[tab]/page.tsx:51`

**Issue:** The comment at line 51 reads: "backed by the Plan 52-02
Playwright `instant()` e2e test, NOT the build validator." But per
`52-02-SUMMARY.md`, the Plan 52-02 test was **reshaped** away from the
`@next/playwright` `instant()` helper to a direct nav-no-404/no-#419
assertion (`tests/e2e/profile-tab-nav.test.ts`). The `instant()` helper
was dropped because `unstable_instant = false` opts the route OUT of
instant navigation, making the helper inapplicable.

Similarly, `layout.tsx:35` contains "RECURRENCE-5 ADDENDUM ... see
`[tab]/page.tsx` ... exports `unstable_instant = false` (opt-out). The
bug-prevention contract on this route is the STRUCTURAL pattern ... plus
the Plan 52-02 Playwright e2e test" — accurate in spirit but the cited
`instant()` test doesn't exist.

**Fix:** Update the comment at `page.tsx:51` and `layout.tsx:36` to
reference the actual test file and assertion type:

```ts
// backed by the Plan 52-02 Playwright regression test
// (tests/e2e/profile-tab-nav.test.ts — direct nav-no-404 / no-#419
// assertion, NOT the @next/playwright instant() helper — the route
// opts out of instant-nav so instant() does not apply), NOT the
// build validator.
```

---

### WR-04: `profile-tab-nav.test.ts` heading assertion fails if `twwaneka_1` has a display name

**File:** `tests/e2e/profile-tab-nav.test.ts:50`

**Issue:** The persistent-chrome assertion checks:

```ts
await expect(page.getByRole('heading', { name: new RegExp(PROFILE) })).toBeVisible()
```

where `PROFILE = process.env.TEST_USER_PROFILE || 'twwaneka_1'`. The
`ProfileHeader` h1 renders `displayName ?? \`@\${username}\`` (see
`src/components/profile/ProfileHeader.tsx:61`). If the test user
`twwaneka_1` has a `displayName` set (e.g. "Tyler Waneka"), the heading
text will be that display name — not containing `twwaneka_1` — and the
regex `/twwaneka_1/` will not match. The assertion would fail even though
the chrome is correctly mounted.

This is a latent test failure: the test happens to pass in the current
environment because the test user may not have a display name, or the
local Supabase setup may have been configured with a matching display name.
Any developer who runs this against a local instance where `twwaneka_1`
has a display name will see a spurious failure.

**Fix:** Replace the heading content assertion with a role-only existence
check (the heading being visible at all proves the chrome is mounted):

```ts
// Chrome is mounted if the <h1> heading is visible — content varies by
// displayName; role-only check avoids fragility against test-user data.
await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
```

Or add `data-testid="profile-name-heading"` to the `<h1>` in
`ProfileHeader.tsx` and target that instead.

---

## Info

### IN-01: `proxy.ts` dev-only `console.log` is a production noise risk if guard is incorrect

**File:** `src/proxy.ts:46-48`

**Issue:**

```ts
if (process.env.NODE_ENV !== 'production') {
  console.log(`[proxy] ${pathname} user=${userId ?? 'anon'} public=${isPublic}`)
}
```

The guard is correct (`!== 'production'`) so this will never fire in
production. However, the comment says it satisfies "ROADMAP success
criterion #2" — meaning the log exists only to satisfy a test criterion,
not for operational use. It fires on every single request in dev and test
environments, including CI test runs, cluttering test output. This is a
minor quality issue, not a bug.

**Fix:** Remove the log once the ROADMAP criterion is considered
permanently satisfied, or replace it with a structured debug logger that
respects a `DEBUG=horlo:proxy` env flag.

---

### IN-02: `unstable_instant` export comment block at `page.tsx:94-117` is a reversal note about a reversal

**File:** `src/app/u/[username]/[tab]/page.tsx:94-117`

**Issue:** Lines 94-117 contain a second comment block ("Phase 52 D-52-11
— DIAGNOSIS REVERSAL") that describes reinstating `unstable_instant` as a
validator — but the export immediately after this block is `= false` (the
opt-out). The D-52-11 block was authored before the recurrence-5 fix and
describes the then-intended `prefetch: 'runtime'` form. After the
recurrence-5 fix changed the export to `false`, neither the D-52-11
block's description nor its D-52-03 citation ("failing build IS the CI
gate") is accurate — the build now passes *because* the validator is
disabled, not because it's gating anything.

**Fix:** Replace the D-52-11 block with a condensed cross-reference:

```ts
// D-52-11 REVERSAL NOTE: Phase 39c wrongly blocklisted this export;
// Phase 52 reinstated it. Then D-52-DEV-01 set prefetch: 'runtime'
// which caused recurrence-5; the recurrence-5 fix set it to `false`.
// Full record: .planning/debug/resolved/profile-404-419-recurrence-5.md
```

---

### IN-03: `tests/e2e/auth-setup.ts:44` calls `storageState()` twice unnecessarily

**File:** `tests/e2e/auth-setup.ts:43-45`

**Issue:**

```ts
await page.context().storageState({ path: STORAGE_STATE })
const state = await page.context().storageState()
expect(state.cookies.length).toBeGreaterThan(0)
```

`storageState()` is called twice: once to persist to disk (line 43) and
once to read back for the sanity assertion (line 44-45). The second call
performs a redundant serialization of the browser context state. The state
written to disk on line 43 is the same state that would be returned on
line 44. Minor overhead in a setup step that runs once per suite.

**Fix:**

```ts
const state = await page.context().storageState({ path: STORAGE_STATE })
expect(state.cookies.length).toBeGreaterThan(0)
```

`storageState({ path })` returns the state AND writes to disk in a single
call.

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: "04"
plan: 6
plan_name: header-usermenu
subsystem: authentication
tags: [phase-4, wave-4, header, user-menu, server-components, base-ui, uat]
requirements: [AUTH-01]
wave: 4
depends_on: [2, 5]
dependency_graph:
  requires:
    - "src/lib/auth.ts — getCurrentUser + UnauthorizedError (from 04-02)"
    - "src/app/actions/auth.ts — logout Server Action (from 04-02)"
    - "src/components/ui/dropdown-menu.tsx — shadcn/base-ui primitive (from 04-01)"
    - "src/app/login, /signup, /forgot-password, /reset-password pages (from 04-05)"
    - "src/proxy.ts — deny-by-default proxy (from 04-03)"
  provides:
    - "src/components/layout/Header.tsx — async Server Component that resolves current user"
    - "src/components/layout/HeaderNav.tsx — client child owning usePathname-aware nav"
    - "src/components/layout/UserMenu.tsx — Server Component with DropdownMenu + no-JS logout form"
    - "Phase 4 UAT sign-off — all AUTH-01..04 success criteria observed end-to-end"
  affects:
    - "Phase 5 (migration + Zustand demotion) — auth surface is now stable and exercisable"
    - "Any future layout change touching header auth affordances"
tech-stack:
  added: []
  patterns:
    - "Server Component Header awaits getCurrentUser with UnauthorizedError catch → null fallback"
    - "Client leaf (HeaderNav) extracted from otherwise server-friendly header so usePathname stays isolated"
    - "Progressive-enhancement logout: <form action={logout}> inside DropdownMenuItem (works without client JS)"
    - "@base-ui/react Menu.GroupLabel MUST live inside a Menu.Group — wrap label + items in DropdownMenuGroup"
    - "@base-ui/react primitives use `render={<Element />}` prop, NOT shadcn-radix `asChild` pattern"
key-files:
  created:
    - path: "src/components/layout/HeaderNav.tsx"
      purpose: "'use client' nav with usePathname active-link styling — 3 navItems (Collection, Insights, Preferences)"
    - path: "src/components/layout/UserMenu.tsx"
      purpose: "Server Component; renders 'Sign in' Link when user=null, otherwise DropdownMenu with initials trigger, email label, and logout form"
  modified:
    - path: "src/components/layout/Header.tsx"
      purpose: "Converted from client component to async Server Component; awaits getCurrentUser, catches UnauthorizedError, renders UserMenu and conditional 'Add Watch'"
    - path: "src/proxy.ts"
      purpose: "Moved from repo root to src/ during UAT-driven fix (belongs to 04-03 semantically — see deviations)"
    - path: "tests/proxy.test.ts"
      purpose: "Updated import from ../proxy to @/proxy after proxy.ts relocation"
decisions:
  - "Used @base-ui/react's `render={<Element />}` prop instead of the plan's `asChild` — base-ui's Menu primitives do not expose asChild; render is the equivalent composition slot"
  - "Wrapped DropdownMenuLabel + logout item in DropdownMenuGroup — required by @base-ui/react Menu.GroupLabel context contract"
  - "Kept HeaderNav as the only client component in the header tree — Header, UserMenu, MobileNav imports, and ThemeToggle all compose cleanly under an async Server Component parent"
  - "Phase-wide UAT checkpoint type was human-verify (blocking); approved after the two post-Task-1 fixes landed"
metrics:
  duration_minutes: 17
  tasks_completed: 1
  files_created: 2
  files_modified: 1
  completed_date: 2026-04-12
---

# Phase 4 Plan 6: Header + UserMenu Summary

**Converted Header.tsx to an async Server Component that resolves the current user via getCurrentUser, extracted usePathname nav into a HeaderNav client child, and shipped a UserMenu dropdown with a no-JS logout form — then ran the Phase 4 UAT end-to-end against the local Supabase stack and received human sign-off.**

## Outcome

The authenticated UX loop is closed. A visitor hitting `/` either sees the full collection with an initials badge in the header (logged in) or is redirected to `/login?next=%2F` (logged out). The initials badge opens a DropdownMenu showing the signed-in email and a Log out item that submits a Server Action form — works without client JS. "Add Watch" is only rendered when the user is present, so the logged-out shell never teases an action that would bounce to /login.

Critically, the phase-wide UAT exercised every AUTH-01..04 success criterion against a real browser + real Supabase + real Inbucket — not just automated tests. The human approved after the two post-Task-1 fixes landed.

## Task Log

### Task 1 — Extract HeaderNav + convert Header to Server Component + add UserMenu
- **Commit:** `afab306`
- Created `HeaderNav.tsx` (client) with usePathname-aware nav — 3 items (Collection, Insights, Preferences)
- Created `UserMenu.tsx` (server) — renders `<Link href="/login">Sign in</Link>` when `user=null`, otherwise a DropdownMenu whose trigger shows email-derived initials, whose content shows "Signed in as <email>" and a Log out `<form action={logout}>` item
- Rewrote `Header.tsx` as `export async function Header()` — awaits `getCurrentUser()`, catches `UnauthorizedError` (other errors re-thrown), conditionally renders the "Add Watch" button only when the user is present, and always renders `<UserMenu user={user} />`
- Header.tsx no longer contains `'use client'`, `usePathname`, or any client hook
- Verified: `npx tsc --noEmit` clean on all three files; `npm run build` completed; `npm test` green

### Task 2 — UAT checkpoint (phase-wide human verification)
- **Checkpoint type:** `checkpoint:human-verify`, gate=blocking
- **Result:** APPROVED by human after post-Task-1 fixes landed
- Every line in `<how-to-verify>` was walked against `npm run dev` + local Supabase stack + Inbucket:
  - **AUTH-02** — proxy deny-by-default: unauth `/` → `/login?next=%2F` (after the src/proxy.ts relocation fix)
  - **AUTH-02** — `[proxy] /insights user=<uuid> public=false` log line printed on protected route
  - **AUTH-02** — tampered `sb-*` cookie redirected to `/login?next=%2F` (server-side getUser rejected it)
  - **AUTH-01** — signup → immediately logged in, header flipped to initials badge
  - **AUTH-01** — logout via UserMenu DropdownMenu → redirected to `/login`, subsequent `/` visit bounced to `/login?next=%2F`
  - **AUTH-01** — password reset: forgot-password form → Inbucket (localhost:54324) → reset link → `/reset-password` → login with new password
  - **AUTH-03** — visible cross-user isolation: User 1 cannot see User 2's watches in the UI; `tests/data/isolation.test.ts` green
  - **AUTH-04** — `curl -X POST /api/extract-watch` with no session → `HTTP/1.1 401` + `{"error":"Unauthorized"}`
  - Full automated suite `npm test` — green
- **Human sign-off:** "approved"

## Deviations from Plan

### In-task: asChild → render prop (Task 1)

**[Rule 3 — Blocking] @base-ui/react primitives use `render` prop, not `asChild`**
- **Found during:** Task 1 implementation
- **Issue:** The plan code used `<DropdownMenuTrigger asChild>` and `<DropdownMenuItem asChild>`, but `src/components/ui/dropdown-menu.tsx` wraps `@base-ui/react`'s Menu primitives, which expose a `render={<Element />}` composition slot instead of the shadcn-radix `asChild` convention. Passing `asChild` silently dropped the custom child in base-ui.
- **Fix:** Switched to the base-ui `render={...}` form: `<DropdownMenuTrigger render={<Button ...>{initials}</Button>} />` and `<DropdownMenuItem render={<form action={logout}>...</form>} />`
- **Files modified:** `src/components/layout/UserMenu.tsx`
- **Verification:** `tsc --noEmit` clean; dropdown trigger rendered in UAT; logout form POST fired the Server Action
- **Committed in:** `afab306` (as part of Task 1)

### Post-Task-1 fix #1 — DropdownMenuLabel context crash

**[Rule 1 — Bug] Menu.GroupLabel requires a Menu.Group parent**
- **Found during:** Phase 4 UAT step 6 — clicking the UserMenu initials trigger crashed the React tree with `"MenuGroupRootContext is missing"` from `@base-ui/react`.
- **Issue:** `DropdownMenuLabel` is a thin wrapper over `Menu.GroupLabel`, which `@base-ui/react` requires to live inside a `Menu.Group`. The plan's JSX rendered the label and item bare inside `DropdownMenuContent`, so the runtime context chain never resolved.
- **Fix:** Wrapped both `DropdownMenuLabel` and the separator + logout `DropdownMenuItem` in a `<DropdownMenuGroup>…</DropdownMenuGroup>`. Added `DropdownMenuGroup` to the imports.
- **Files modified:** `src/components/layout/UserMenu.tsx`
- **Verification:** UAT step 6 repeated — dropdown now opens without error and shows "Signed in as <email>" + Log out
- **Committed in:** `e84f980` — `fix(04-06): wrap DropdownMenuLabel in DropdownMenuGroup`

### Post-Task-1 fix #2 — proxy.ts location (belongs semantically to 04-03)

**[Rule 1 — Bug] proxy.ts must live at src/proxy.ts, not repo root, for src/-layout projects**
- **Found during:** Phase 4 UAT step 1 — unauthenticated request to `/` returned 200 instead of the expected `/login?next=%2F` redirect. The proxy was never invoked.
- **Issue:** The 04-03 plan text placed `proxy.ts` at the repo root, but per Next.js 16 docs: *"Create a proxy.ts file in the project root, or inside src if applicable, so that it is located at the same level as pages or app."* Since Horlo uses `src/app/`, `proxy.ts` must live at `src/proxy.ts` — at the repo root it was silently not loaded and every request bypassed the auth gate entirely.
- **Fix:** `git mv proxy.ts src/proxy.ts`; updated `tests/proxy.test.ts` import from `'../proxy'` to `'@/proxy'`; deleted `.next/` cache; restarted the dev server.
- **Files modified:** `proxy.ts` → `src/proxy.ts` (rename), `tests/proxy.test.ts` (import path)
- **Verification:** UAT step 1 repeated — unauth `/` now redirects to `/login?next=%2F`; `[proxy] ...` log line prints; `tests/proxy.test.ts` still green
- **Committed in:** `54dc07f` — `fix(04-03): move proxy.ts to src/ (same level as src/app/)`
- **Traceability note:** This fix semantically belongs to Plan 04-03 (the plan that authored `proxy.ts`) and the commit is namespaced `fix(04-03)`, but it was discovered during 04-06's UAT and therefore lands in this summary's deviation ledger. Plan 04-03's SUMMARY predates this fix — future readers looking for "why is proxy.ts in src/" should find this entry.

---

**Total deviations:** 3 (1 in-task Rule 3 blocking, 2 UAT-driven Rule 1 bugs)
**Impact on plan:** All three were correctness fixes — no scope creep. The asChild switch was unavoidable (base-ui API contract). The two UAT fixes were the point of having a UAT checkpoint: automated tests passed but the real browser surfaced both the Menu.Group context requirement and the proxy-location silent failure.

## Test Deltas

- No new unit tests added for this plan — coverage is the phase-wide UAT, not per-file
- `tests/proxy.test.ts` — import path updated to `@/proxy` alias (same 2 assertions, still green)
- `npm test` — full suite green before and after all three commits
- `tests/data/isolation.test.ts` — 3 IDOR assertions green against local Postgres during UAT

## Known Stubs

None. Header, HeaderNav, and UserMenu all render real data: user comes from server-verified `getCurrentUser()`, nav state from real `usePathname`, logout from real Server Action. No hardcoded empty values, no placeholder copy.

## Threat Surface

Plan's `<threat_model>` threats all mitigated:

| Threat ID | Status | Verification |
|-----------|--------|--------------|
| T-4-02 (spoofing via tampered cookie) | Mitigated | Header catches UnauthorizedError → user=null → "Sign in" link; UAT cookie-tamper step confirmed |
| T-4-04 (logout repudiation/replay) | Mitigated | `<form action={logout}>` uses Next 16 Server Action CSRF origin check; `supabase.auth.signOut()` clears cookies via setAll adapter |
| T-4-05 (email information disclosure) | Accepted | Only the signed-in user's own email is shown in their own dropdown; single-user app model |
| T-4-07 (getCurrentUser on every render) | Accepted | Known cost; documented in RESEARCH Risk #13; not a v1 blocker |

No new threat surface introduced beyond what the plan's threat_model already covered.

## Verification

- `npx tsc --noEmit` — zero errors on `Header.tsx`, `HeaderNav.tsx`, `UserMenu.tsx`
- Header.tsx does NOT contain `'use client'`, DOES contain `await getCurrentUser()`, DOES contain `UnauthorizedError`, does NOT contain `usePathname`
- HeaderNav.tsx first non-comment line is `'use client'`, contains `usePathname` + `navItems`
- UserMenu.tsx contains `<form action={logout}`, imports `DropdownMenuGroup`, renders `Sign in` when user is null
- `npm run build` — completed successfully
- `npm test` — full suite green
- **UAT** — all 12 acceptance_criteria lines from the checkpoint task signed off by the human ("approved")

## Commits

- `afab306` — feat(04-06): convert Header to Server Component with UserMenu
- `e84f980` — fix(04-06): wrap DropdownMenuLabel in DropdownMenuGroup (UAT-driven)
- `54dc07f` — fix(04-03): move proxy.ts to src/ (same level as src/app/) (UAT-driven, traceability note above)

## Phase 4 Readiness

Phase 4 is done. Every ROADMAP success criterion for AUTH-01..04 has been observed end-to-end against real infrastructure:

1. Sign-up → immediately logged in (no email confirmation gate per D-09) ✓
2. Login after logout ✓
3. Logout from header UserMenu ✓
4. Password reset via local Inbucket ✓
5. Proxy deny-by-default with `[proxy]` log line ✓
6. Tampered cookie rejected server-side (Server Action re-verification) ✓
7. Cross-user isolation — User 1 cannot see User 2's watches (UI + integration test) ✓
8. `/api/extract-watch` returns 401 on unauth curl ✓

Ready to hand off to Phase 5 (migration + Zustand demotion).

## Self-Check: PASSED

- FOUND: src/components/layout/Header.tsx (Server Component, awaits getCurrentUser)
- FOUND: src/components/layout/HeaderNav.tsx ('use client', usePathname)
- FOUND: src/components/layout/UserMenu.tsx (DropdownMenuGroup, form action={logout}, render prop)
- FOUND: src/proxy.ts (relocated from repo root)
- FOUND: commit afab306
- FOUND: commit e84f980
- FOUND: commit 54dc07f
- VERIFIED: Header.tsx has no 'use client' directive
- VERIFIED: HeaderNav.tsx first line is 'use client'
- VERIFIED: UserMenu imports DropdownMenuGroup and uses render prop (not asChild)
- VERIFIED: tests/proxy.test.ts imports from @/proxy
- VERIFIED: Phase 4 UAT approved by human
